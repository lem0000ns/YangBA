"""Scheduled Lambda: API-Sports ingest, S3 dumps, MySQL sync, optional Wikipedia profiles."""

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pymysql

from api_sports_client import backfill_season_years
from api_sports_names import clear_name_cache
from db_config import create_mysql_connection
from playerScraper import namesToSQL
from utilities import (
    MySQL_Writer,
    SeasonIngestor,
    load_checkpoint,
    save_checkpoint,
    sync_all_names,
)
from verify_backfill import print_report, verify_seasons

connection = create_mysql_connection()

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
_checkpoint_lock = threading.Lock()


def _strip_sql_comments(block: str) -> str:
    lines = []
    for line in block.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def run_sql_file(filename: str):
    path = MIGRATIONS_DIR / filename
    if not path.is_file():
        return
    sql = _strip_sql_comments(path.read_text(encoding="utf-8"))
    with connection.cursor() as cursor:
        for statement in sql.split(";"):
            stmt = statement.strip()
            if not stmt:
                continue
            try:
                cursor.execute(stmt)
            except pymysql.err.OperationalError as e:
                if e.args[0] == 1091:
                    print(f"Skipping drop (column already gone): {stmt[:60]}")
                else:
                    raise
    connection.commit()


def prepare_database_for_backfill(*, reset_players: bool = True):
    """Drop OPI if present; truncate games/version2; optionally players (profile reset)."""
    run_sql_file("drop_opi.sql")
    with connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("TRUNCATE TABLE version2")
        cursor.execute("TRUNCATE TABLE games")
        if reset_players:
            cursor.execute("TRUNCATE TABLE players")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
    connection.commit()
    clear_name_cache()
    save_checkpoint({"completed_seasons": [], "names": []})
    print("prepare_db: truncated games, version2" + (", players" if reset_players else ""))


def load_season_to_mysql(season: int, db_conn=None):
    """Load one season's S3 dumps into MySQL. Uses dedicated connection when provided."""
    own = db_conn is None
    conn = db_conn or create_mysql_connection()
    try:
        MySQL_Writer("games", season, connection=conn).transferData()
        vwriter = MySQL_Writer("version2", season, connection=conn)
        vwriter.transferData()
        vwriter.removeNonNBAPlayers()
    finally:
        if own:
            conn.close()


def _ingest_season_worker(
    season: int,
    *,
    skip_mysql: bool,
    skip_ingest: bool,
    force_season: bool,
    completed: set[int],
) -> tuple[int, set[str]]:
    if season in completed and not force_season:
        print(f"Skipping season {season} (checkpoint complete)")
        return season, set()

    print(f"Starting season {season} (thread {threading.current_thread().name})")
    if skip_ingest:
        print(f"  skip_ingest: loading MySQL from S3 only")
        season_names = set()
    else:
        ingestor = SeasonIngestor(season)
        season_names = ingestor.dumpData()

    if not skip_mysql:
        load_season_to_mysql(season)

    with _checkpoint_lock:
        completed.add(season)
        state = load_checkpoint()
        state["completed_seasons"] = sorted(completed)
        save_checkpoint(state)

    print(f"Finished season {season}")
    return season, season_names


def run_seasons_parallel(
    seasons: list[int],
    *,
    skip_mysql: bool,
    skip_ingest: bool,
    force_season: bool,
    max_workers: int,
    completed: set[int],
    all_names: set[str],
) -> list[int]:
    """One thread per season (capped by max_workers). Raises if any season fails."""
    workers = min(max_workers, len(seasons)) if seasons else 1
    errors: list[tuple[int, Exception]] = []
    name_lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="season") as pool:
        futures = {
            pool.submit(
                _ingest_season_worker,
                season,
                skip_mysql=skip_mysql,
                skip_ingest=skip_ingest,
                force_season=force_season,
                completed=completed,
            ): season
            for season in seasons
        }
        for future in as_completed(futures):
            season = futures[future]
            try:
                _, season_names = future.result()
                with name_lock:
                    all_names.update(season_names)
            except Exception as exc:
                errors.append((season, exc))
                print(f"Season {season} failed: {exc}")

    if errors:
        detail = "; ".join(f"{s}: {e}" for s, e in errors)
        raise RuntimeError(f"Parallel backfill failed for {len(errors)} season(s): {detail}")

    return seasons


def run_seasons_sequential(
    seasons: list[int],
    *,
    skip_mysql: bool,
    skip_ingest: bool,
    force_season: bool,
    completed: set[int],
    all_names: set[str],
) -> list[int]:
    for season in seasons:
        if season in completed and not force_season:
            print(f"Skipping season {season} (checkpoint complete)")
            continue
        if skip_ingest:
            print(f"MySQL-only load for season {season}")
            season_names = set()
        else:
            ingestor = SeasonIngestor(season)
            season_names = ingestor.dumpData()
        all_names.update(season_names)
        if not skip_mysql:
            load_season_to_mysql(season)
        completed.add(season)
        save_checkpoint(
            {
                "completed_seasons": sorted(completed),
                "names": sorted(all_names),
            }
        )
    return seasons


def lambda_handler(event, context):
    """
    Event keys:
      backfill (bool, default True): load 2023-24..last completed (not current season)
      seasons (list[int], optional): explicit season years
      skip_mysql (bool): S3/API only
      skip_profiles (bool): skip namesToSQL
      prepare_db (bool, default True on backfill): run migrations + delete old seasons
      parallel_seasons (bool, default True): one thread per season for API+MySQL
      max_workers (int, default 3): thread pool size cap
      verify (bool, default True when MySQL load runs): post-run game coverage check
      skip_ingest (bool): S3 → MySQL only (no API) for listed seasons
    """
    try:
        event = event or {}
        do_backfill = event.get("backfill", True)
        skip_mysql = event.get("skip_mysql", False)
        skip_ingest = event.get("skip_ingest", False)
        skip_profiles = event.get("skip_profiles", False)
        explicit_seasons = event.get("seasons")
        if explicit_seasons is not None:
            # Single/multi-season runs must not wipe other years unless requested.
            prepare_db = event.get("prepare_db", False)
        else:
            prepare_db = event.get("prepare_db", do_backfill)
        parallel_seasons = event.get("parallel_seasons", True)
        max_workers = int(event.get("max_workers", 3))
        do_verify = event.get("verify", not skip_mysql)
        force_season = event.get("force_season", False)

        if prepare_db:
            prepare_database_for_backfill()

        if event.get("seasons"):
            seasons = [int(s) for s in event["seasons"]]
        elif do_backfill:
            seasons = backfill_season_years()
        else:
            from api_sports_client import fetch_seasons

            all_s = fetch_seasons()
            seasons = [all_s[-1]] if all_s else []

        checkpoint = load_checkpoint()
        completed = set(checkpoint.get("completed_seasons", []))
        all_names: set[str] = set(checkpoint.get("names", []))

        if prepare_db:
            completed = set()
            all_names = set()

        checkpoint_done = set(checkpoint.get("completed_seasons", []))
        if prepare_db or force_season:
            to_run = list(seasons)
            skipped = []
        else:
            to_run = [s for s in seasons if s not in checkpoint_done]
            skipped = [s for s in seasons if s in checkpoint_done]

        print(f"Backfill target seasons (API start years): {seasons}")
        if skipped and not prepare_db:
            print(f"Skipping (S3 checkpoint, use --force to re-run): {skipped}")
        print(f"Ingesting: {to_run}")

        if parallel_seasons and len(to_run) > 1:
            print(f"Parallel backfill: max_workers={min(max_workers, len(to_run))}")
            run_seasons_parallel(
                to_run,
                skip_mysql=skip_mysql,
                skip_ingest=skip_ingest,
                force_season=force_season,
                max_workers=max_workers,
                completed=completed,
                all_names=all_names,
            )
        else:
            run_seasons_sequential(
                to_run if to_run else seasons,
                skip_mysql=skip_mysql,
                skip_ingest=skip_ingest,
                force_season=force_season or prepare_db,
                completed=completed,
                all_names=all_names,
            )

        with _checkpoint_lock:
            save_checkpoint(
                {
                    "completed_seasons": sorted(completed),
                    "names": sorted(all_names),
                }
            )

        sync_all_names(
            all_names,
            extra_from_db=not skip_mysql,
            connection=connection,
            seasons=seasons if event.get("seasons") else None,
        )

        if not skip_profiles:
            use_wiki = os.getenv("YBA_WIKIPEDIA_PROFILES", "1").lower() in (
                "1",
                "true",
                "yes",
            )
            namesToSQL(use_wikipedia=use_wiki)

        verify_report = None
        if do_verify and not skip_mysql and seasons:
            print("Running post-backfill verification...")
            verify_report = verify_seasons(seasons)
            print_report(verify_report)
            if not verify_report["ok"]:
                return {
                    "statusCode": 500,
                    "body": f"Backfill verification failed: {verify_report}",
                }

        if connection:
            connection.close()

        return {
            "statusCode": 200,
            "body": f"Backfill complete for seasons {seasons}",
            "verify": verify_report,
        }
    except Exception as e:
        return {"statusCode": 500, "body": f"Error uploading file: {e}"}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="API-Sports backfill / MySQL load")
    parser.add_argument(
        "--season",
        type=int,
        action="append",
        dest="seasons",
        metavar="YEAR",
        help="API start year only (e.g. 2023 = 2023-24). Skips full DB truncate unless --prepare-db.",
    )
    parser.add_argument("--force", action="store_true", help="Re-run even if S3 checkpoint marks season done")
    parser.add_argument("--prepare-db", action="store_true", help="Truncate games/version2 before load (full reset)")
    parser.add_argument("--sequential", action="store_true", help="Disable parallel season threads")
    parser.add_argument(
        "--mysql-only",
        action="store_true",
        help="Load S3 NDJSON into MySQL only (no API fetch) for --season year(s)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify S3/RDS/API coverage only (optional --season list; default all backfill years)",
    )
    parser.add_argument("--skip-profiles", action="store_true", help="Skip Wikipedia/API player profile scrape")
    args = parser.parse_args()

    if args.verify and not args.force and not args.mysql_only and not args.prepare_db:
        if args.seasons:
            report = verify_seasons(args.seasons)
        else:
            from api_sports_client import backfill_season_years

            report = verify_seasons(backfill_season_years())
        print_report(report)
        raise SystemExit(0 if report["ok"] else 1)

    is_full_backfill = not args.seasons and not args.mysql_only
    payload: dict = {
        "backfill": not args.seasons,
        "force_season": args.force,
        # --force on a full backfill = wipe RDS + S3 checkpoint + re-ingest all target seasons
        "prepare_db": args.prepare_db or (args.force and is_full_backfill),
        "parallel_seasons": not args.sequential,
        "skip_profiles": args.skip_profiles,
    }
    if args.seasons:
        payload["seasons"] = args.seasons
    if args.mysql_only:
        payload["skip_ingest"] = True

    print(lambda_handler(payload, None))
