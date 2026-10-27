"""Turn one question into a games or rank query, or an error.

The model fills the same fields as those forms. This module then accepts or
rejects that JSON. It does not run the query.
"""

from __future__ import annotations

import re

from query.nl_stats import (
    AGGS,
    DEFAULT_STAGE,
    LAST_SEASON,
    MAX_QUESTION,
    TOO_LONG,
    FILTER_STATS,
    PCT_STATS,
    SEASONS,
    STAGES,
    STATS,
    _ConfigError,
    _UpstreamError,
    _ALL_SEASONS,
    _ALL_STAGES,
    fill_seasons,
    _complete,
    _error,
    _normalize_season,
    _parse_filter,
    _parse_json_object,
    ask_stats,
    names_in,
)

UNMAPPED_GAMES = "That question could not be turned into a games query."
UNMAPPED_RANK = "That question could not be turned into a rankings query."
RANK_FILTERS = set(FILTER_STATS) | {"games"}
ORDERS = {"most": "Most", "least": "Least"}

TEAMS: dict[str, tuple[str, ...]] = {
    "ATL": ("atlanta", "hawks", "atl"),
    "BOS": ("boston", "celtics", "bos"),
    "BKN": ("brooklyn", "nets", "bkn"),
    "CHA": ("charlotte", "hornets", "cha"),
    "CHI": ("chicago", "bulls", "chi"),
    "CLE": ("cleveland", "cavaliers", "cavs", "cle"),
    "DAL": ("dallas", "mavericks", "mavs", "dal"),
    "DEN": ("denver", "nuggets", "den"),
    "DET": ("detroit", "pistons", "det"),
    "GSW": ("golden state", "warriors", "gsw"),
    "HOU": ("houston", "rockets", "hou"),
    "IND": ("indiana", "pacers", "ind"),
    "LAC": ("la clippers", "clippers", "lac"),
    "LAL": ("la lakers", "los angeles lakers", "lakers", "lal"),
    "MEM": ("memphis", "grizzlies", "mem"),
    "MIA": ("miami", "heat", "mia"),
    "MIL": ("milwaukee", "bucks", "mil"),
    "MIN": ("minnesota", "timberwolves", "wolves", "min"),
    "NOP": ("new orleans", "pelicans", "pels", "nop"),
    "NYK": ("new york", "knicks", "nyk"),
    "OKC": ("oklahoma city", "thunder", "okc"),
    "ORL": ("orlando", "magic", "orl"),
    "PHI": ("philadelphia", "76ers", "sixers", "phi"),
    "PHX": ("phoenix", "suns", "phx"),
    "POR": ("portland", "trail blazers", "blazers", "por"),
    "SAC": ("sacramento", "kings", "sac"),
    "SAS": ("san antonio", "spurs", "sas"),
    "TOR": ("toronto", "raptors", "tor"),
    "UTA": ("utah", "jazz", "uta"),
    "WAS": ("washington", "wizards", "was"),
}

_SEASON_RULES = """Season rule
A year used as a season is the year that season ends.
- "season 2023", "the 2023 season", "in 2023", and "during 2023" mean the 2022–2023 season. seasons is ["2023"].
- "2023-24" and "2023-2024" are ["2024"].
- No season mentioned → ["2026"], the 2025–26 season.
- "this season" and "last season" are ["2026"].
- "all seasons" or "every season" → [].
- An ending year outside 2016–2026 must fail.

Stage
- not mentioned → "Regular Season"
- playoffs or postseason → "Playoffs"
- preseason → "Preseason"
- regular season → "Regular Season"
- all stages, or every stage → ""
- regular season plus playoffs, but not preseason, cannot be expressed. Fail.

Filters
There is no >= or <=.
- "more than N", "over N", "above N" → stat>N
- "at least N", "N+", "N or more", and an "N-point game" → stat>(N-1) when N is a whole number
- "fewer than N", "under N" → stat<N
- "at most N", "N or fewer" → stat<(N+1) when N is a whole number
- "exactly N" → stat=N
Percentage filters use decimals, so 40% is 0.40.
"""

GAMES_PROMPT = f"""You convert one NBA question into a single YangBA games query, or you reject it.

Return only a JSON object. No markdown.

Success:
{{"ok": true, "name": "Stephen Curry", "limit": null, "seasons": ["2026"], "filters": [], "stage": "Regular Season"}}

Failure:
{{"ok": false, "error": [why query was not valid]}}

The error is one plain sentence. On failure, do not include the other fields.

This is the games page: a list of box scores, newest first. It is not one season total, and it is not a leaderboard.

Fields
- name: one player, or "" for every player. "Steph Curry" → "Stephen Curry". Two players must fail. A missing player is allowed when a filter decides which games count. A question that only names a player is valid.
- limit: how many of the most recent games to list, a whole number from 1 to 500, or null. null means every matching game. "Last 10 games" is 10. If the question does not say how many, limit is null. Do not guess a number.
- seasons: ending years as strings. No season mentioned → ["2026"], the 2025–26 season. [] only when the question says all seasons or every season.
- filters: game constraints, each "stat>number", "stat<number", or "stat=number". [] means no extra constraint. Stats: points, fgm, fga, ftm, fta, 3pm, 3pa, 3pct, fgpct, ftpct, ast, reb, steals, blocks, turnovers, fpts, min.
- stage: "Preseason", "Regular Season", "Playoffs", or "" for every stage. If the question does not name a stage, stage is "Regular Season". "" only when the question says all stages or every stage.

A player and a filter can both be set. A question with neither a player nor a filter must fail.

{_SEASON_RULES}
Also fail when
- the question asks for one number, such as a season total or a per-game average
- the question asks who led the league or for a top-N list of players
- the question needs a team and no player (there is no team field)
- any field cannot be filled from the lists above

Examples
"Stephen Curry's last 10 games"
{{"ok": true, "name": "Stephen Curry", "limit": 10, "seasons": ["2026"], "filters": [], "stage": "Regular Season"}}

"Stephen Curry games"
{{"ok": true, "name": "Stephen Curry", "limit": null, "seasons": ["2026"], "filters": [], "stage": "Regular Season"}}

"15 games in 2023-24 where Luka Doncic scored more than 40"
{{"ok": true, "name": "Luka Doncic", "limit": 15, "seasons": ["2024"], "filters": ["points>40"], "stage": "Regular Season"}}

"show 25 games with more than 50 points"
{{"ok": true, "name": "", "limit": 25, "seasons": ["2026"], "filters": ["points>50"], "stage": "Regular Season"}}

"Stephen Curry's playoff games"
{{"ok": true, "name": "Stephen Curry", "limit": null, "seasons": ["2026"], "filters": [], "stage": "Playoffs"}}

"top 10 scorers"
{{"ok": false, "error": "This page lists games, not a leaderboard."}}
"""

RANK_PROMPT = f"""You convert one NBA question into a single YangBA rankings query, or you reject it.

Return only a JSON object. No markdown.

Success:
{{"ok": true, "stat": "points", "agg": "avg", "order": "Most", "limit": 10, "team": "", "seasons": ["2024"], "filters": [], "stage": "Regular Season"}}

Failure:
{{"ok": false, "error": [why query was not valid]}}

The error is one plain sentence. On failure, do not include the other fields.

This is the rankings page: a leaderboard of players. It is not one player's season total, and it is not a list of box scores.

Fields
- stat: exactly one of points, fgm, fga, ftm, fta, 3pm, 3pa, 3pct, fgpct, ftpct, ast, reb, steals, blocks, turnovers, fpts, min, games.
- agg: sum, avg, max, or min. Percentages use avg. games is always sum. A percentage cannot be summed.
- order: "Most" or "Least". Top, best, most, and leaders are "Most". Bottom, worst, least, and fewest are "Least".
- limit: how many players to list, a whole number from 1 to 500. "Top 10" is 10. "Bottom 5" is 5. If the question does not say how many, limit is 10. Do not fail for a missing count, and do not invent a number other than 10.
- team: an NBA team code, or "" for every team. Atlanta Hawks ATL, Boston Celtics BOS, Brooklyn Nets BKN, Charlotte Hornets CHA, Chicago Bulls CHI, Cleveland Cavaliers CLE, Dallas Mavericks DAL, Denver Nuggets DEN, Detroit Pistons DET, Golden State Warriors GSW, Houston Rockets HOU, Indiana Pacers IND, LA Clippers LAC, Los Angeles Lakers LAL, Memphis Grizzlies MEM, Miami Heat MIA, Milwaukee Bucks MIL, Minnesota Timberwolves MIN, New Orleans Pelicans NOP, New York Knicks NYK, Oklahoma City Thunder OKC, Orlando Magic ORL, Philadelphia 76ers PHI, Phoenix Suns PHX, Portland Trail Blazers POR, Sacramento Kings SAC, San Antonio Spurs SAS, Toronto Raptors TOR, Utah Jazz UTA, Washington Wizards WAS.
- seasons: ending years as strings. No season mentioned → ["2026"], the 2025–26 season. [] only when the question says all seasons or every season.
- filters: each "stat>number", "stat<number", or "stat=number". These compare per-game averages, except games, which is a count of games played. "At least 50 games" is games>49. Percentage filters use decimals.
- stage: "Preseason", "Regular Season", "Playoffs", or "" for every stage.

Stat phrases
- points, pts, scorers when the metric is clear → points
- threes made → 3pm; three-point percentage → 3pct
- assists → ast; rebounds → reb; steals → steals; blocks → blocks; turnovers → turnovers
- fantasy points → fpts; minutes → min; games played → games

Metric
- total → sum
- per game or average → avg
- best game → max
- worst game → min
- If the question does not say total, per game, best game, or worst game, fail. A percentage implies per game.

{_SEASON_RULES}
Also fail when
- the question names one player's line instead of a list of players
- the question asks for a list of box scores
- two stats are requested
- any field cannot be filled from the lists above

Examples
"top scorers per game in 2023-24"
{{"ok": true, "stat": "points", "agg": "avg", "order": "Most", "limit": 10, "team": "", "seasons": ["2024"], "filters": [], "stage": "Regular Season"}}

"top 10 scorers per game in 2023-24"
{{"ok": true, "stat": "points", "agg": "avg", "order": "Most", "limit": 10, "team": "", "seasons": ["2024"], "filters": [], "stage": "Regular Season"}}

"bottom 5 warriors in total turnovers in season 2024"
{{"ok": true, "stat": "turnovers", "agg": "sum", "order": "Least", "limit": 5, "team": "GSW", "seasons": ["2024"], "filters": [], "stage": "Regular Season"}}

"top 10 three-point shooters in the 2021 playoffs, at least 5 attempts per game"
{{"ok": true, "stat": "3pct", "agg": "avg", "order": "Most", "limit": 10, "team": "", "seasons": ["2021"], "filters": ["3pa>5"], "stage": "Playoffs"}}

"top 10 scorers in season 2023"
{{"ok": false, "error": "Say whether you want the total or the per-game average."}}

"Stephen Curry points per game"
{{"ok": false, "error": "This page ranks players. It does not look up one player."}}
"""


def _seasons(raw: object) -> tuple[list[str] | None, str | None]:
    if raw is None:
        raw = []
    if isinstance(raw, (str, int)):
        raw = [raw]
    if not isinstance(raw, list):
        return None, "The season could not be read."
    seasons: list[str] = []
    for item in raw:
        season = _normalize_season(item)
        if season is None or season not in SEASONS:
            return None, "That season is outside 2015–16 through 2025–26."
        if season not in seasons:
            seasons.append(season)
    seasons.sort()
    return seasons, None


def _filters(raw: object, allowed: set[str]) -> tuple[list[str] | None, str | None]:
    if raw is None:
        raw = []
    if isinstance(raw, str):
        raw = [part for part in raw.split(",") if part]
    if not isinstance(raw, list):
        return None, "The filters could not be read."
    filters: list[str] = []
    for item in raw:
        parsed, message = _parse_filter(item, allowed)
        if parsed is None:
            return None, message or "The filters could not be read."
        filters.append(parsed)
    return filters, None


def _stage(payload: dict, default: str = DEFAULT_STAGE) -> tuple[str | None, str | None]:
    if "stage" not in payload or payload.get("stage") is None:
        return default, None
    raw = payload.get("stage")
    if not isinstance(raw, str):
        return None, "That stage is not preseason, regular season, or playoffs."
    key = " ".join(raw.split()).casefold()
    if key not in STAGES:
        return None, "That stage is not preseason, regular season, or playoffs."
    return STAGES[key], None


def _limit(value: object, noun: str) -> tuple[int | None, str | None]:
    if isinstance(value, bool) or value is None:
        return None, f"Say how many {noun} to show."
    if isinstance(value, float):
        if not value.is_integer():
            return None, f"Say how many {noun} to show."
        value = int(value)
    text = str(value).strip()
    if not re.fullmatch(r"\d+", text):
        return None, f"Say how many {noun} to show."
    count = int(text)
    if count < 1 or count > 500:
        return None, f"Choose between 1 and 500 {noun}."
    return count, None


def _stated_player_count(question: str) -> int | None:
    """A list size the question actually names, such as top 5 or 25 players."""
    patterns = (
        r"\b(?:top|bottom|first|last|best|worst)\s+(\d{1,3})\b",
        r"\b(\d{1,3})\s+(?:best|worst|top|bottom)\b",
        r"\b(\d{1,3})\s+players\b",
    )
    for pattern in patterns:
        match = re.search(pattern, question, flags=re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def _rank_limit(question: str, value: object) -> tuple[int | None, str | None]:
    stated = _stated_player_count(question)
    if stated is None:
        return 10, None
    if stated < 1 or stated > 500:
        return None, "Choose between 1 and 500 players."
    if value is not None and not isinstance(value, (str, int, float)):
        return None, "Say how many players to show."
    return stated, None


def _games_limit(value: object) -> tuple[int | None, str | None]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, None
    return _limit(value, "games")


def _team(value: object) -> tuple[str | None, str | None]:
    if value is None:
        return "", None
    if not isinstance(value, str):
        return None, "That team is not in the league list."
    text = " ".join(value.split()).casefold()
    if text in ("", "all", "any", "every team"):
        return "", None
    upper = text.upper()
    if upper in TEAMS:
        return upper, None
    hits: list[str] = []
    for code, names in TEAMS.items():
        if text in names or any(
            re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", text) for alias in names
        ):
            hits.append(code)
    if len(hits) == 1:
        return hits[0], None
    if len(hits) > 1:
        return None, "Say which team. Los Angeles could be the Lakers or the Clippers."
    return None, "That team is not in the league list."


def _mentioned(question: str, name: str) -> bool:
    tokens = [part for part in re.split(r"[^a-z0-9]+", name.casefold()) if len(part) >= 4]
    haystack = set(re.split(r"[^a-z0-9]+", question.casefold()))
    return any(token in haystack for token in tokens)


def _one_name(question: str, payload: dict) -> tuple[str | None, str | None]:
    raw = payload.get("name") or ""
    if not isinstance(raw, str):
        return None, UNMAPPED_GAMES
    raw = " ".join(raw.split())
    if len(names_in(question)) >= 2 or len(names_in(raw)) >= 2:
        return None, "A games query can only include one player."
    if re.search(r"\s(?:and|&)\s", raw, flags=re.IGNORECASE):
        return None, "A games query can only include one player."
    found = names_in(question)
    if len(found) == 1:
        return found[0], None
    if not raw:
        return "", None
    roster = names_in(raw)
    name = roster[0] if len(roster) == 1 else raw
    if _mentioned(question, name):
        return name, None
    return "", None


def _failure(payload: dict, fallback: str) -> dict | None:
    if payload.get("ok") is True:
        return None
    message = payload.get("error")
    if not isinstance(message, str) or not message.strip():
        message = fallback
    return _error(message)


def validate_games(question: str, payload: object) -> dict:
    """Accept a model object only when it matches the games form."""
    if not isinstance(payload, dict):
        return _error(UNMAPPED_GAMES)
    failed = _failure(payload, UNMAPPED_GAMES)
    if failed:
        return failed
    name, message = _one_name(question, payload)
    if message:
        return _error(message)
    limit, message = _games_limit(payload.get("limit"))
    if message:
        return _error(message)
    seasons, message = _seasons(payload.get("seasons", []))
    if message or seasons is None:
        return _error(message or UNMAPPED_GAMES)
    seasons = fill_seasons(question, seasons)
    filters, message = _filters(payload.get("filters", []), set(FILTER_STATS))
    if message or filters is None:
        return _error(message or UNMAPPED_GAMES)
    stage, message = _stage(payload)
    if message or stage is None:
        return _error(message or UNMAPPED_GAMES)
    if not stage and not _ALL_STAGES.search(question):
        stage = DEFAULT_STAGE
    if not name and not filters:
        return _error("Choose a player or add a filter.")
    return {
        "ok": True,
        "name": name,
        "limit": limit,
        "seasons": seasons,
        "filters": filters,
        "stage": stage,
    }


def validate_rank(payload: object, question: str = "") -> dict:
    """Accept a model object only when it matches the rankings form."""
    if not isinstance(payload, dict):
        return _error(UNMAPPED_RANK)
    failed = _failure(payload, UNMAPPED_RANK)
    if failed:
        return failed
    stat = payload.get("stat")
    agg = payload.get("agg")
    if not isinstance(stat, str) or not isinstance(agg, str):
        return _error(UNMAPPED_RANK)
    stat = stat.strip().lower()
    agg = agg.strip().lower()
    if stat not in STATS:
        return _error("That stat is not on the rankings page.")
    if agg not in AGGS:
        return _error("The metric has to be a total, a per-game average, a best game, or a worst game.")
    if stat == "games" and agg != "sum":
        return _error("Games played can only be a total.")
    if stat in PCT_STATS and agg == "sum":
        return _error("A percentage can't be summed.")
    order = payload.get("order", "Most")
    if not isinstance(order, str):
        return _error(UNMAPPED_RANK)
    order_key = order.strip().casefold()
    if order_key not in ORDERS:
        return _error("Say whether you want the top or the bottom of the list.")
    limit, message = _rank_limit(question, payload.get("limit"))
    if message or limit is None:
        return _error(message or "Say how many players to show.")
    team, message = _team(payload.get("team", ""))
    if message or team is None:
        return _error(message or UNMAPPED_RANK)
    seasons, message = _seasons(payload.get("seasons", []))
    if message or seasons is None:
        return _error(message or UNMAPPED_RANK)
    seasons = fill_seasons(question, seasons)
    filters, message = _filters(payload.get("filters", []), RANK_FILTERS)
    if message or filters is None:
        return _error(message or UNMAPPED_RANK)
    stage, message = _stage(payload)
    if message or stage is None:
        return _error(message or UNMAPPED_RANK)
    if not stage and not _ALL_STAGES.search(question):
        stage = DEFAULT_STAGE
    return {
        "ok": True,
        "stat": stat,
        "agg": agg,
        "order": ORDERS[order_key],
        "limit": limit,
        "team": team,
        "seasons": seasons,
        "filters": filters,
        "stage": stage,
    }


def _ask(text: str, system: str, validate, fallback: str) -> tuple[int, dict]:
    question = (text or "").strip()
    if not question:
        return 200, _error("Enter a question.")
    if len(question) > MAX_QUESTION:
        return 200, _error(TOO_LONG)
    try:
        raw = _complete(question, system=system)
    except _ConfigError as error:
        return 500, _error(str(error))
    except _UpstreamError as error:
        return 502, _error(str(error))
    try:
        payload = _parse_json_object(raw)
    except (ValueError, TypeError):
        return 200, _error(fallback)
    if validate is validate_rank:
        return 200, validate_rank(payload, question)
    return 200, validate_games(question, payload)


def ask_games(text: str) -> tuple[int, dict]:
    """Return an HTTP status and either a games draft or {ok: false, error}."""
    return _ask(text, GAMES_PROMPT, validate_games, UNMAPPED_GAMES)


def ask_rank(text: str) -> tuple[int, dict]:
    """Return an HTTP status and either a rankings draft or {ok: false, error}."""
    return _ask(text, RANK_PROMPT, validate_rank, UNMAPPED_RANK)


def ask(text: str, page: str) -> tuple[int, dict]:
    """Dispatch a question to the stats, games, or rankings parser."""
    kind = (page or "stats").strip().casefold()
    if kind == "games":
        return ask_games(text)
    if kind == "rank":
        return ask_rank(text)
    if kind in ("", "stats"):
        return ask_stats(text)
    return 200, _error("That page does not take a question.")


def _self_check() -> None:
    games = validate_games(
        "Stephen Curry's last 10 games",
        {"ok": True, "name": "Stephen Curry", "limit": 10, "seasons": ["2026"], "filters": [], "stage": "Regular Season"},
    )
    assert games["ok"] and games["name"] == "Stephen Curry" and games["limit"] == 10

    missing = validate_games("Stephen Curry games", {"ok": True, "name": "Stephen Curry", "filters": []})
    assert missing["ok"] and missing["name"] == "Stephen Curry" and missing["limit"] is None and missing["stage"] == "Regular Season" and missing["seasons"] == ["2026"]

    open_list = validate_games(
        "show 25 games with more than 50 points",
        {"ok": True, "name": "", "limit": 25, "filters": ["points>50"], "stage": "Regular Season"},
    )
    assert open_list["ok"] and open_list["name"] == "" and open_list["filters"] == ["points>50"]

    nickname = validate_games(
        "Steph Curry's last 10 games",
        {"ok": True, "name": "Stephen Curry", "limit": 10, "filters": []},
    )
    assert nickname["ok"] and nickname["name"] == "Stephen Curry"

    invented = validate_games(
        "show 25 games with more than 50 points",
        {"ok": True, "name": "Stephen Curry", "limit": 25, "filters": ["points>50"]},
    )
    assert invented["ok"] and invented["name"] == ""

    full_team = validate_rank(
        {"ok": True, "stat": "points", "agg": "sum", "order": "Least", "limit": 5, "team": "Golden State Warriors"}
    )
    assert full_team["ok"] and full_team["team"] == "GSW"

    rank = validate_rank(
        {
            "ok": True,
            "stat": "points",
            "agg": "avg",
            "order": "Most",
            "limit": 10,
            "team": "Warriors",
            "seasons": ["2024"],
            "filters": ["games>49"],
            "stage": "Regular Season",
        }
    )
    assert rank["ok"] and rank["team"] == "GSW" and rank["filters"] == ["games>49"]

    unspecified = validate_rank(
        {"ok": True, "stat": "points", "agg": "avg", "order": "Most", "limit": None},
        "top scorers per game",
    )
    assert unspecified["ok"] and unspecified["limit"] == 10

    five = validate_rank(
        {"ok": True, "stat": "points", "agg": "avg", "order": "Most", "limit": 10},
        "top 5 scorers per game",
    )
    assert five["ok"] and five["limit"] == 5

    bad_team = validate_rank(
        {"ok": True, "stat": "points", "agg": "avg", "order": "Most", "limit": 10, "team": "Globetrotters"}
    )
    assert bad_team["ok"] is False

    assert ask("hi", "box")[1]["ok"] is False
    long_question = "Stephen Curry games " + ("x" * MAX_QUESTION)
    assert ask(long_question, "games")[1]["error"] == TOO_LONG
    assert ask("y" * (MAX_QUESTION + 1), "rank")[1]["error"] == TOO_LONG
    print("nl_pages checks passed")


if __name__ == "__main__":
    _self_check()
