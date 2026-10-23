"""HTTP client for API-Sports NBA v2 (https://v2.nba.api-sports.io)."""

import os
import time
from typing import Any

import requests

BASE_URL = "https://v2.nba.api-sports.io"
LEAGUE_STANDARD = "standard"
# API season start years (2023 = 2023-24, etc.)
BACKFILL_SEASON_START = 2023
# When True, omit the newest API season (usually in progress), through last completed only.
BACKFILL_EXCLUDE_CURRENT_SEASON = True


def _api_key() -> str:
    key = os.getenv("API_SPORTS_KEY", "")
    if not key:
        raise RuntimeError("API_SPORTS_KEY environment variable is not set")
    return key


def get_json(path: str, params: dict | None = None, max_retries: int = 5) -> dict[str, Any]:
    """GET an endpoint; returns parsed JSON. Retries on 429 with backoff."""
    url = BASE_URL + path if path.startswith("/") else BASE_URL + "/" + path
    headers = {"x-apisports-key": _api_key()}
    params = params or {}

    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=60)
        except requests.RequestException as exc:
            print(f"Request failed {path} {params}: {exc}")
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
            continue

        if response.status_code == 429:
            wait = min(60, 2 ** (attempt + 1))
            print(f"Rate limited on {path}; sleeping {wait}s")
            time.sleep(wait)
            continue

        if response.status_code != 200:
            print(f"HTTP {response.status_code} for {path} {params}: {response.text[:300]}")
            response.raise_for_status()

        data = response.json()
        errors = data.get("errors")
        if errors:
            print(f"API errors for {path} {params}: {errors}")
        return data

    raise RuntimeError(f"Exhausted retries for {path} {params}")


def response_list(data: dict[str, Any]) -> list:
    """Return the response array from an API-Sports envelope."""
    return data.get("response") or []


def fetch_seasons() -> list[int]:
    """All season start years available in API-NBA."""
    return [int(y) for y in response_list(get_json("/seasons"))]


def backfill_season_years() -> list[int]:
    """
    Season start years for backfill.
    Default: 2023-24 through last completed season (excludes current API max season).
    """
    seasons = sorted(fetch_seasons())
    if not seasons:
        return []
    upper = max(seasons)
    if BACKFILL_EXCLUDE_CURRENT_SEASON and len(seasons) >= 1:
        upper = max(seasons) - 1
    return [y for y in seasons if BACKFILL_SEASON_START <= y <= upper]
