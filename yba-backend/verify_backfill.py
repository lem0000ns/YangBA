"""Compare API / S3 / RDS counts after a season backfill."""

from __future__ import annotations

import json
from typing import Any

import boto3
from botocore.exceptions import ClientError

from api_sports_client import LEAGUE_STANDARD, get_json, response_list
from api_sports_mappers import is_finished_game, map_game
from db_config import create_mysql_connection

BUCKET = "nba-players.bucket"
S3 = boto3.client("s3", "us-west-1")


def _load_s3_ndjson(key: str) -> list[dict]:
    try:
        obj = S3.get_object(Bucket=BUCKET, Key=key)
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "NoSuchKey":
            return []
        raise
    text = obj["Body"].read().decode("utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def _api_finished_game_ids(season: int) -> set[int]:
    payload = get_json("/games", {"league": LEAGUE_STANDARD, "season": season})
    finished: set[int] = set()
    for game in response_list(payload):
        mapped = map_game(game)
        if not mapped:
            continue
        status = mapped.pop("_status_short", None)
        if is_finished_game({"_status_short": status}):
            finished.add(int(mapped["gameID"]))
    return finished


def verify_season(season: int, conn) -> dict[str, Any]:
    """
    Checks:
      - Every game row in S3 exists in `games`
      - Every finished game (API) has >=1 row in version2 for this season
      - Distinct gameIDs in S3 player stats match DB for this season
    """
    games_key = f"gameStages/games{season}.json"
    stats_key = f"version2/playerStats{season}.json"

    s3_games = _load_s3_ndjson(games_key)
    s3_stats = _load_s3_ndjson(stats_key)
    s3_game_ids = {int(r["gameID"]) for r in s3_games if r.get("gameID") is not None}
    s3_stat_game_ids = {int(r["gameID"]) for r in s3_stats if r.get("gameID") is not None}

    api_finished = _api_finished_game_ids(season)

    with conn.cursor() as cursor:
        if s3_game_ids:
            placeholders = ",".join(["%s"] * len(s3_game_ids))
            cursor.execute(
                f"SELECT gameID FROM games WHERE gameID IN ({placeholders})",
                list(s3_game_ids),
            )
            db_game_ids = {int(row[0]) for row in cursor.fetchall()}
        else:
            db_game_ids = set()

        cursor.execute(
            "SELECT DISTINCT gameID FROM version2 WHERE season = %s",
            (season,),
        )
        db_stat_game_ids = {int(row[0]) for row in cursor.fetchall()}

    missing_games = sorted(s3_game_ids - db_game_ids)
    missing_finished_stats = sorted(api_finished - db_stat_game_ids)
    extra_stat_games = sorted(db_stat_game_ids - s3_stat_game_ids)

    ok = (
        not missing_games
        and not missing_finished_stats
        and len(s3_game_ids) > 0
    )

    return {
        "season": season,
        "ok": ok,
        "s3_games": len(s3_game_ids),
        "db_games_matched": len(db_game_ids),
        "api_finished": len(api_finished),
        "s3_stat_games": len(s3_stat_game_ids),
        "db_stat_games": len(db_stat_game_ids),
        "missing_games_in_db": missing_games[:20],
        "missing_finished_stats_in_db": missing_finished_stats[:20],
        "missing_games_count": len(missing_games),
        "missing_finished_stats_count": len(missing_finished_stats),
        "extra_db_stat_games_count": len(extra_stat_games),
    }


def verify_seasons(seasons: list[int]) -> dict[str, Any]:
    conn = create_mysql_connection()
    try:
        results = [verify_season(s, conn) for s in seasons]
    finally:
        conn.close()
    all_ok = all(r["ok"] for r in results)
    return {"ok": all_ok, "seasons": results}


def print_report(report: dict[str, Any]) -> None:
    for r in report["seasons"]:
        status = "OK" if r["ok"] else "FAIL"
        print(
            f"[{status}] season {r['season']}: "
            f"S3 games={r['s3_games']} db_games={r['db_games_matched']} "
            f"API finished={r['api_finished']} db stat games={r['db_stat_games']}"
        )
        if r["missing_games_count"]:
            print(f"  missing games in DB: {r['missing_games_count']} (sample {r['missing_games_in_db']})")
        if r["missing_finished_stats_count"]:
            print(
                f"  finished games without version2 rows: {r['missing_finished_stats_count']} "
                f"(sample {r['missing_finished_stats_in_db']})"
            )
    print(f"Overall: {'PASS' if report['ok'] else 'FAIL'}")


if __name__ == "__main__":
    from api_sports_client import backfill_season_years

    seasons = backfill_season_years()
    report = verify_seasons(seasons)
    print_report(report)
    raise SystemExit(0 if report["ok"] else 1)
