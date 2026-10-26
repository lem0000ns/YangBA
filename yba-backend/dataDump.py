"""Scheduled Lambda: load the newest API-Sports season into S3 and MySQL."""

import os

import load_env  # noqa: F401  repo-root .env before modules that read credentials
from api_sports_client import fetch_seasons
from db_config import create_mysql_connection
from playerScraper import namesToSQL
from utilities import MySQL_Writer, SeasonIngestor, sync_all_names


def load_season_to_mysql(season: int):
    """Load one season's S3 dumps into MySQL."""
    conn = create_mysql_connection()
    try:
        MySQL_Writer("games", season, connection=conn).transferData()
        vwriter = MySQL_Writer("version2", season, connection=conn)
        vwriter.transferData()
        vwriter.removeNonNBAPlayers()
    finally:
        conn.close()


def _target_seasons(event: dict) -> list[int]:
    """Event may name API start years. Otherwise load the newest season."""
    if event.get("seasons"):
        return [int(season) for season in event["seasons"]]
    seasons = sorted(fetch_seasons())
    return [seasons[-1]] if seasons else []


def lambda_handler(event, context):
    """Ingest the target seasons, then refresh names and missing player profiles."""
    try:
        event = event or {}
        seasons = _target_seasons(event)
        names: set[str] = set()
        for season in seasons:
            names.update(SeasonIngestor(season).dumpData())
            load_season_to_mysql(season)

        sync_all_names(names)

        use_wiki = os.getenv("YBA_WIKIPEDIA_PROFILES", "1").lower() in (
            "1",
            "true",
            "yes",
        )
        namesToSQL(prefer_api=False, use_wikipedia=use_wiki)

        return {"statusCode": 200, "body": f"Loaded seasons {seasons}"}
    except Exception as e:
        return {"statusCode": 500, "body": f"Error uploading file: {e}"}


if __name__ == "__main__":
    print(lambda_handler(None, None))
