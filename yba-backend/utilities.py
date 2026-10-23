"""ETL helpers: S3 NBA dumps, MySQL bulk load, and API-Sports season ingest."""

import json
import time
import traceback

import boto3
from botocore.exceptions import ClientError

from api_sports_client import LEAGUE_STANDARD, get_json, response_list
from api_sports_mappers import is_finished_game, map_game, map_player_stat
from api_sports_names import clear_name_cache

s3_client = boto3.client("s3", "us-west-1")
bucket_name = "nba-players.bucket"

CHECKPOINT_KEY = "etl/backfill_checkpoint.json"
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
        from db_config import create_mysql_connection

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

        insert_query = f"INSERT INTO {self.table} ({self.columns_placeholder}) VALUES "
        all_values = []
        for row in data:
            values = [row.get(col, None) for col in self.columns]
            if self.table == "version2":
                values[0] = '"' + str(values[0]) + '"'
                values[3] = '"' + str(values[3]) + '"'
                all_values.append("(" + ", ".join(map(str, values)) + ")")
            elif self.table == "games" and values[4] is not None:
                values[2] = '"' + str(values[2]) + '"'
                values[3] = '"' + str(values[3]) + '"'
                values[5] = '"' + str(values[5]) + '"'
                all_values.append("(" + ", ".join(map(str, values)) + ")")

        if not all_values:
            return

        insert_query += ", ".join(all_values)
        insert_query += " ON DUPLICATE KEY UPDATE "
        update_clause = ", ".join(
            [f"{self._sql_col(col)} = VALUES({self._sql_col(col)})" for col in self.columns]
        )
        insert_query += update_clause
        cursor.execute(insert_query)
        connection.commit()
        if own_connection:
            connection.close()

    @test_time
    def removeNonNBAPlayers(self):
        connection = self._db_connection()
        own_connection = self._connection is None
        cursor = connection.cursor()
        if self.table == "version2":
            cursor.execute(f'DELETE FROM version2 WHERE team="" AND season={self.season}')
            connection.commit()
        if own_connection:
            connection.close()

    def setTable(self, new_table):
        self._configure_table(new_table)

    def setSeason(self, new_season):
        self.season = new_season


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


def load_checkpoint() -> dict:
    try:
        obj = s3_client.get_object(Bucket=bucket_name, Key=CHECKPOINT_KEY)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "NoSuchKey":
            return {}
        return {}
    except Exception:
        return {}


def save_checkpoint(state: dict):
    s3_client.put_object(
        Bucket=bucket_name,
        Key=CHECKPOINT_KEY,
        Body=json.dumps(state, indent=2),
        ContentType="application/json",
    )


def sync_all_names(
    names: set[str],
    extra_from_db: bool = True,
    connection=None,
    *,
    seasons: list[int] | None = None,
):
    """Merge names into S3 allNames.txt and repo copies (optionally filter by season)."""
    from db_config import create_mysql_connection

    merged = set(n.strip().lower() for n in names if n and str(n).strip())
    conn = connection
    own_connection = False
    if extra_from_db and conn is None:
        conn = create_mysql_connection()
        own_connection = True
    if extra_from_db and conn:
        cursor = conn.cursor()
        if seasons:
            placeholders = ",".join(["%s"] * len(seasons))
            cursor.execute(
                f"SELECT DISTINCT name FROM version2 WHERE season IN ({placeholders})",
                seasons,
            )
        else:
            cursor.execute("SELECT DISTINCT name FROM version2")
        for (name,) in cursor.fetchall():
            if name:
                merged.add(name.strip().lower())
        if own_connection:
            conn.close()

    ordered = sorted(merged)
    body = "\n".join(ordered)
    s3_client.put_object(
        Bucket=bucket_name,
        Key="allNames.txt",
        Body=body,
        ContentType="text/plain",
    )

    repo_root = __import__("pathlib").Path(__file__).resolve().parent.parent
    for rel in (
        "yba-frontend/src/pages/allNames.txt",
        "yba-backend/allNames.txt",
    ):
        path = repo_root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body + ("\n" if body else ""), encoding="utf-8")
    print(f"sync_all_names: {len(ordered)} names")
