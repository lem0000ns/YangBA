"""Resolve API-Sports player display names (box scores often use 'A.' first names)."""

from __future__ import annotations

import re

from ingest.api_sports_client import get_json, response_list

# playerID -> display name as provided by the roster or API (never store abbreviated names here)
_name_by_id: dict[int, str] = {}

# "A.", "A.J.", "C.J."
_ABBREVIATED_FIRST = re.compile(r"^[A-Za-z](?:\.[A-Za-z]+)*\.?$")


def first_name_needs_resolution(first: str) -> bool:
    first = (first or "").strip()
    if not first:
        return True
    if _ABBREVIATED_FIRST.fullmatch(first):
        return True
    return len(first) <= 1


def _name_still_abbreviated(full_name: str) -> bool:
    parts = full_name.strip().lower().split()
    if not parts:
        return True
    first = parts[0]
    if first_name_needs_resolution(first.title()):
        return True
    return "." in first and len(first) <= 5


_nba_static_players: list[dict] | None = None


def _nba_static_players_list() -> list[dict]:
    global _nba_static_players
    if _nba_static_players is None:
        from nba_api.stats.static import players as nba_players

        _nba_static_players = nba_players.get_players()
    return _nba_static_players


def _initials_from_abbrev(first: str) -> str:
    return re.sub(r"[^a-zA-Z]", "", first).lower()


def _nba_full_name(last: str, first_abbrev: str) -> str | None:
    """
    API-Sports stores 'A.' even on /players; NBA static roster has full names.
    Match by last name + first-name initials (A., A.J., P.J., etc.).
    """
    inits = _initials_from_abbrev(first_abbrev)
    if not inits or not last:
        return None
    last_l = last.lower()
    matches = [p for p in _nba_static_players_list() if p["last_name"].lower() == last_l]

    def first_name_matches(first_name: str) -> bool:
        compact = re.sub(r"[^a-z]", "", first_name.lower())
        if not compact:
            return False
        return compact.startswith(inits) or inits.startswith(compact[: len(inits)])

    matches = [p for p in matches if first_name_matches(p["first_name"])]
    if not matches:
        return None
    active = [p for p in matches if p.get("is_active")]
    pool = active or matches
    if len(pool) == 1:
        return pool[0]["full_name"]
    pool.sort(key=lambda p: p["id"], reverse=True)
    return pool[0]["full_name"]


def _fetch_full_name(player_id: int) -> str | None:
    payload = get_json("/players", {"id": player_id})
    players = response_list(payload)
    if not players:
        return None
    p = players[0]
    first = (p.get("firstname") or "").strip()
    last = (p.get("lastname") or "").strip()
    full = f"{first} {last}".strip()
    return full or None


def _cache_name(player_id: int | None, name: str) -> str:
    if player_id is not None and name and not _name_still_abbreviated(name):
        _name_by_id[player_id] = name
    return name


def canonical_player_name(player_id: int | None, first: str, last: str) -> str | None:
    """
    Full display name for version2 / allNames.
    Order: cache -> NBA static (no API quota) -> API-Sports /players?id=.
    """
    first = (first or "").strip()
    last = (last or "").strip()
    if not last:
        return None

    if player_id is not None:
        cached = _name_by_id.get(player_id)
        if cached:
            return cached

    raw = f"{first} {last}".strip()

    if first_name_needs_resolution(first) or _name_still_abbreviated(raw):
        nba_name = _nba_full_name(last, first)
        if nba_name:
            return _cache_name(player_id, nba_name)

        if player_id is not None:
            try:
                resolved = _fetch_full_name(player_id)
            except Exception:
                resolved = None
            if resolved and not _name_still_abbreviated(resolved):
                return _cache_name(player_id, resolved)
            if resolved:
                return resolved

    return _cache_name(player_id, raw) if raw else None


def clear_name_cache():
    _name_by_id.clear()
