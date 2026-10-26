"""ETL helpers: S3 NBA dumps, MySQL bulk load, and API-Sports season ingest."""

import json
import time
import traceback

import boto3

from ingest.api_sports_client import LEAGUE_STANDARD, get_json, response_list
from ingest.api_sports_mappers import is_finished_game, map_game, map_player_stat
from ingest.api_sports_names import clear_name_cache

s3_client = boto3.client("s3", "us-west-1")
bucket_name = "nba-players.bucket"

GAME_REQUEST_DELAY_SEC = 0.35


def test_time(func):
    def wrapper(*args, **kwargs):
        start_time = int(time.time())
        res = func(*args, **kwargs)
        print(f"{func.__name__} took {int(time.time()) - start_time} seconds")
        return res
    return wrapper


class MySQL_Writer:
    """Load NDJSON season files from S3 into MySQL games or version2 tables."""

    def __init__(self, table, season, connection=None):
        self.season = season
        self._connection = connection
        self._configure_table(table)

    def _db_connection(self):
        if self._connection is not None:
            return self._connection
        from common.db_config import create_mysql_connection

        return create_mysql_connection()

    @staticmethod
    def _sql_col(name: str) -> str:
        return f"`{name}`"

    def _configure_table(self, table: str):
        self.table = table
        if self.table == "version2":
            self.columns = [
                "name", "playerID", "gameID", "team", "season", "points", "min",
                "fgm", "fga", "ftm", "fta", "3pm", "3pa", "reb", "ast",
                "steals", "blocks", "turnovers",
            ]
            self.key_template = "version2/playerStats%s.json"
        elif self.table == "games":
            self.columns = [
                "gameID", "stage", "gameDate", "home", "homePts", "away", "awayPts",
            ]
            self.key_template = "gameStages/games%s.json"
        else:
            raise ValueError(f"Unknown MySQL table: {table}")
        self.columns_placeholder = ", ".join(self._sql_col(c) for c in self.columns)
        if self.table == "version2":
            self._string_cols = {"name", "team"}
            self._required_cols = {"name", "playerID", "gameID", "team", "season"}
        else:
            self._string_cols = {"gameDate", "home", "away"}
            self._required_cols = {"gameID", "stage", "home", "homePts", "away", "awayPts"}

    def _sql_literal(self, connection, column: str, value):
        """Render one cell. Missing counting stats become 0; strings are escaped."""
        if column not in self._string_cols:
            if isinstance(value, bool):
                return "1" if value else "0"
            if value is None or value == "":
                return "0"
            try:
                number = float(value)
            except (TypeError, ValueError):
                return "0"
            if number.is_integer():
                return str(int(number))
            return str(number)
        if value is None:
            return "NULL"
        return connection.escape(str(value))

    def _row_tuple(self, connection, row: dict) -> str | None:
        if any(row.get(col) in (None, "") for col in self._required_cols):
            return None
        if self.table == "games" and row.get("homePts") is None:
            return None
        values = [
            self._sql_literal(connection, col, row.get(col))
            for col in self.columns
        ]
        return "(" + ", ".join(values) + ")"

    @test_time
    def transferData(self):
        connection = self._db_connection()
        own_connection = self._connection is None
        cursor = connection.cursor()
        key = self.key_template % self.season
        obj = s3_client.get_object(Bucket=bucket_name, Key=key)
        ndjson_data = obj["Body"].read().decode("utf-8")
        data = [json.loads(line) for line in ndjson_data.splitlines() if line.strip()]
        if not data:
            print(f"No rows in S3 key {key}")
            return

        tuples = []
        for row in data:
            rendered = self._row_tuple(connection, row)
            if rendered:
                tuples.append(rendered)
        if not tuples:
            print(f"No insertable rows in S3 key {key}")
            return

        update_clause = ", ".join(
            f"{self._sql_col(col)} = VALUES({self._sql_col(col)})" for col in self.columns
        )
        # Stay under max_allowed_packet (64MB on this instance) for a full season.
        batch_size = 1500
        for start in range(0, len(tuples), batch_size):
            batch = tuples[start : start + batch_size]
            insert_query = (
                f"INSERT INTO {self.table} ({self.columns_placeholder}) VALUES "
                + ", ".join(batch)
                + " ON DUPLICATE KEY UPDATE "
                + update_clause
            )
            cursor.execute(insert_query)
        connection.commit()
        print(f"Loaded {len(tuples)} rows into {self.table} for season {self.season}")
        if own_connection:
            connection.close()

    @test_time
    def removeNonNBAPlayers(self):
        connection = self._db_connection()
        own_connection = self._connection is None
        cursor = connection.cursor()
        if self.table == "version2":
            cursor.execute(
                "DELETE FROM version2 WHERE team=%s AND season=%s",
                ("", int(self.season)),
            )
            connection.commit()
        if own_connection:
            connection.close()


class DataDumper:
    def __init__(self, season):
        self.season = season

    def dumpS3(self, data, s3_path):
        jsonl_string = "\n".join(json.dumps(item) for item in data)
        s3_client.put_object(Key=s3_path, Bucket=bucket_name, Body=jsonl_string)


class SeasonIngestor(DataDumper):
    """Fetch one API-Sports season: games + per-game player box scores to S3."""

    @test_time
    def dumpData(self, game_ids_filter: set | None = None) -> set[str]:
        """
        Write gameStages/games{season}.json and version2/playerStats{season}.json.
        If game_ids_filter is set, only fetch player stats for those game IDs (resume).
        Returns set of player names seen this season.
        """
        names: set[str] = set()
        clear_name_cache()
        try:
            payload = get_json(
                "/games",
                {"league": LEAGUE_STANDARD, "season": self.season},
            )
            raw_games = response_list(payload)
            all_games = []
            finished_ids: list[int] = []

            for game in raw_games:
                mapped = map_game(game)
                if not mapped:
                    continue
                status_short = mapped.pop("_status_short", None)
                all_games.append(mapped)
                if is_finished_game({"_status_short": status_short}):
                    finished_ids.append(mapped["gameID"])

            super().dumpS3(all_games, f"gameStages/games{self.season}.json")
            print(f"Season {self.season}: {len(all_games)} games, {len(finished_ids)} finished")

            if game_ids_filter is not None:
                finished_ids = [g for g in finished_ids if g in game_ids_filter]

            all_stats = []
            for i, game_id in enumerate(finished_ids):
                if i > 0:
                    time.sleep(GAME_REQUEST_DELAY_SEC)
                stats_payload = get_json("/players/statistics", {"game": game_id})
                for stat in response_list(stats_payload):
                    row = map_player_stat(stat, self.season)
                    if row and row.get("team"):
                        # Box scores sometimes carry a different game id than /games.
                        row["gameID"] = game_id
                        all_stats.append(row)
                        names.add(row["name"])
                if (i + 1) % 50 == 0:
                    print(f"  player stats: {i + 1}/{len(finished_ids)} games")

            super().dumpS3(all_stats, f"version2/playerStats{self.season}.json")
            print(f"Season {self.season}: {len(all_stats)} player-game rows")
        except Exception as e:
            print(f"Season ingest failed for {self.season}: {e}")
            traceback.print_exc()
            raise
        return names


def _keep_display_name(current: str | None, incoming: str) -> str:
    """Prefer the spelling that preserves source capitalization."""
    if current is None:
        return incoming
    if current.casefold() != incoming.casefold():
        return incoming
    if current == current.casefold() and incoming != incoming.casefold():
        return incoming
    return current


def sync_all_names(names: set[str], extra_from_db: bool = True):
    """Merge names into S3 allNames.txt and repo copies, keeping source capitalization."""
    from common.db_config import create_mysql_connection

    by_key: dict[str, str] = {}

    def add_name(name: str):
        cleaned = " ".join(str(name).split())
        if cleaned:
            key = cleaned.casefold()
            by_key[key] = _keep_display_name(by_key.get(key), cleaned)

    for name in names:
        if name and str(name).strip():
            add_name(name)
    if extra_from_db:
        conn = create_mysql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT name FROM version2")
            for (name,) in cursor.fetchall():
                if name:
                    add_name(name)
        finally:
            conn.close()

    ordered = sorted(by_key.values(), key=str.casefold)
    body = "\n".join(ordered)
    s3_client.put_object(
        Bucket=bucket_name,
        Key="allNames.txt",
        Body=body,
        ContentType="text/plain",
    )

    repo_root = __import__("pathlib").Path(__file__).resolve().parents[2]
    for rel in (
        "yba-frontend/src/pages/allNames.txt",
        "yba-backend/data/allNames.txt",
    ):
        path = repo_root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body + ("\n" if body else ""), encoding="utf-8")
    print(f"sync_all_names: {len(ordered)} names")
