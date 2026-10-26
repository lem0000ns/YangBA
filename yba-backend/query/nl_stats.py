"""Turn one natural-language question into a stats-page query, or an error.

The model fills the same fields as the stats form. This module then accepts or
rejects that JSON. It does not run the stats query.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

import common.load_env  # noqa: F401  repo-root .env (NL_API_KEY)

STATS = [
    "points",
    "fgm",
    "fga",
    "ftm",
    "fta",
    "3pm",
    "3pa",
    "3pct",
    "fgpct",
    "ftpct",
    "ast",
    "reb",
    "steals",
    "blocks",
    "turnovers",
    "fpts",
    "min",
    "games",
]
PCT_STATS = {"3pct", "fgpct", "ftpct"}
FILTER_STATS = [stat for stat in STATS if stat != "games"]
AGGS = {"sum", "avg", "max", "min"}
SEASONS = {str(year) for year in range(2016, 2027)}
DEFAULT_STAGE = "Regular Season"
STAGES = {
    "": "",
    "all": "",
    "preseason": "Preseason",
    "regular": DEFAULT_STAGE,
    "regular season": DEFAULT_STAGE,
    "playoff": "Playoffs",
    "playoffs": "Playoffs",
    "postseason": "Playoffs",
}

UNMAPPED = "That question could not be turned into a stats query."
ONE_PLAYER = "A stats query can only include one player."
NEED_PLAYER = "A stats query has to name one player."

_NAMES_PATH = Path(__file__).resolve().parents[1] / "data" / "allNames.txt"
_SEASON_SPAN = re.compile(r"(\d{4})\s*[-/–—]\s*(\d{2}|\d{4})")

SYSTEM_PROMPT = """You convert one NBA question into a single YangBA stats query, or you reject it.

Return only a JSON object. No markdown.

Success:
{"ok": true, "name": "Stephen Curry", "stat": "3pm", "agg": "sum", "seasons": ["2023"], "filters": [], "stage": "Regular Season"}

Failure:
{"ok": false, "error": "A stats query can only include one player."}

The error is one plain sentence. On failure, do not include the other fields.

This is only the stats page: one number for one player. It is not a league total, a leaderboard, a list of games, or a comparison.

Fields
- name: required. Exactly one player. Never "". "Steph Curry" → "Stephen Curry" when the person is unambiguous. If the question does not name a player, or you are not sure who it is, fail. Two players, "and", "vs", or a combined total for more than one player must fail. Example to reject: combined points for Stephen Curry and James Harden. A filter ("in games where he played more than 30 minutes") does not erase the player. If a player is named, never use the missing-player error.
- stat: exactly one of points, fgm, fga, ftm, fta, 3pm, 3pa, 3pct, fgpct, ftpct, ast, reb, steals, blocks, turnovers, fpts, min, games. Two answer stats ("points and assists") must fail. A second stat is allowed only as a filter that decides which games count.
- agg: sum, avg, max, or min.
- seasons: ending years as strings. [] means every season on file. The file covers ending years 2016 through 2026 (the 2015–16 season through the 2025–26 season).
- filters: game constraints, each "stat>number", "stat<number", or "stat=number". [] means no extra constraint. Stats inside filters are the same list as stat, except games. Percentages are decimals (40% is 0.40).
- stage: "Preseason", "Regular Season", "Playoffs", or "" for every stage.

Season rule
A year used as a season is the year that season ends.
- "season 2023", "the 2023 season", "in 2023", and "during 2023" mean the 2022–2023 season. seasons is ["2023"].
- Do not turn season 2023 into the 2023–24 season, and do not output the start year "2022".
- "2022-2023", "2022-23", and "2022/23" are also ["2023"].
- "seasons 2022 and 2023" are ["2022", "2023"]: the 2021–2022 and 2022–2023 seasons.
- "2022-23 through 2024-25" are ["2023", "2024", "2025"].
- "2021 playoffs" are seasons ["2021"] and stage "Playoffs" (the playoffs of the season that ends in 2021).
- No season mentioned → [].
- An ending year outside 2016–2026 must fail. "season 2015" is 2014–15 and is out of range. "2015-16" is in range and is ["2016"].
- "this season" or "last season", with no year, must fail. Do not guess the year.

Stat phrases
- points, pts, scored → points
- threes / three-pointers made, "hit threes", "made threes" → 3pm
- threes attempted, three-point attempts → 3pa
- three-point percentage, 3P% → 3pct
- field goals made → fgm; field goal attempts → fga; field goal percentage, FG% → fgpct
- free throws made → ftm; free throw attempts → fta; free throw percentage, FT% → ftpct
- assists → ast; rebounds → reb; steals → steals; blocks → blocks; turnovers → turnovers
- fantasy points → fpts; minutes → min
- games played, "how many games", "how many times" when it means a count of games → games

Metric example keywords
- how many, total, number of → sum
- "per game" or "average" → avg.
- a percentage across the chosen games → avg. Never sum a percentage.
- best game, most in a game, single-game high → max
- worst game, fewest in a game, single-game low → min
- games is always sum
- Fail only when the question never says or implies total, per game, best game, or worst game. "How many" implies sum. "Stephen Curry threes" does not, so it fails. "Stephen Curry points per game" does not fail.

Filters
There is no >= or <=.
- "more than N", "over N", "above N" → stat>N
- "at least N", "N+", "N or more", and an "N-point game" → stat>(N-1) when N is a whole number
- "fewer than N", "under N" → stat<N
- "at most N", "N or fewer" → stat<(N+1) when N is a whole number
- "exactly N" → stat=N
"How many 50-point games" is stat games, agg sum, filter points>49.

Stage
- not mentioned → "Regular Season"
- playoffs or postseason → "Playoffs"
- preseason → "Preseason"
- regular season → "Regular Season"
- all stages, or every stage → ""
- regular season plus playoffs, but not preseason, cannot be expressed. Fail.

Also fail when
- the question does not name a player
- the question needs a leaderboard ("top 10 scorers", "who had the most")
- the question asks for a list of box scores
- the question is about one team and no single player (there is no team field)
- any field cannot be filled from the lists above

Examples
"Stephen Curry points per game"
{"ok": true, "name": "Stephen Curry", "stat": "points", "agg": "avg", "seasons": [], "filters": [], "stage": "Regular Season"}

"how many threes did stephen curry hit in 2022-2023?"
{"ok": true, "name": "Stephen Curry", "stat": "3pm", "agg": "sum", "seasons": ["2023"], "filters": [], "stage": "Regular Season"}

"Stephen Curry points per game"
{"ok": true, "name": "Stephen Curry", "stat": "points", "agg": "avg", "seasons": [], "filters": [], "stage": "Regular Season"}

"how many threes did stephen curry hit in season 2023?"
{"ok": true, "name": "Stephen Curry", "stat": "3pm", "agg": "sum", "seasons": ["2023"], "filters": [], "stage": "Regular Season"}

"what was steph curry's three-point percentage in the 2021 playoffs?"
{"ok": true, "name": "Stephen Curry", "stat": "3pct", "agg": "avg", "seasons": ["2021"], "filters": [], "stage": "Playoffs"}

"how many 50-point games did luka doncic have in season 2024?"
{"ok": true, "name": "Luka Doncic", "stat": "games", "agg": "sum", "seasons": ["2024"], "filters": ["points>49"], "stage": "Regular Season"}

"how many points did brandin podziemski score in games where he played more than 30 minutes?"
{"ok": true, "name": "Brandin Podziemski", "stat": "points", "agg": "sum", "seasons": [], "filters": ["min>30"], "stage": "Regular Season"}

"total threes in season 2022"
{"ok": false, "error": "A stats query has to name one player."}

"brandin podziemski stats in games where he played more than 30 minutes"
{"ok": false, "error": "A stats query can only look up one stat. Say whether you want the total, the per-game average, the best game, or the worst game."}

"combined points for stephen curry and james harden"
{"ok": false, "error": "A stats query can only include one player."}

"stephen curry threes"
{"ok": false, "error": "Say whether you want the total, the per-game average, the best game, or the worst game."}

"top 10 scorers in season 2023"
{"ok": false, "error": "This search answers one stat, not a leaderboard."}

"how many points per game did the warriors score in season 2023?"
{"ok": false, "error": "A stats query can't be limited to one team."}

"curry's total points and assists in season 2023"
{"ok": false, "error": "A stats query can only look up one stat."}
"""


class _ConfigError(Exception):
    pass


class _UpstreamError(Exception):
    pass


def _load_names() -> list[str]:
    if not _NAMES_PATH.is_file():
        return []
    return [line.strip() for line in _NAMES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


def names_in(text: str, names: list[str] | None = None) -> list[str]:
    """Full player names that appear in text, longest match first."""
    lowered = text.casefold()
    occupied = [False] * len(lowered)
    found: list[str] = []
    roster = names if names is not None else _load_names()
    for name in sorted(roster, key=len, reverse=True):
        needle = name.casefold()
        if len(needle) < 3:
            continue
        start = 0
        while True:
            index = lowered.find(needle, start)
            if index < 0:
                break
            end = index + len(needle)
            before_ok = index == 0 or not lowered[index - 1].isalnum()
            after_ok = end == len(lowered) or not lowered[end].isalnum()
            if before_ok and after_ok and not any(occupied[index:end]):
                occupied[index:end] = [True] * (end - index)
                found.append(name)
                break
            start = index + 1
    return found


def _normalize_season(value: object) -> str | None:
    text = str(value).strip()
    span = _SEASON_SPAN.fullmatch(text)
    if span:
        start = int(span.group(1))
        end_raw = span.group(2)
        if len(end_raw) == 4:
            end = int(end_raw)
        else:
            end = (start // 100) * 100 + int(end_raw)
            if end < start:
                end += 100
        if end != start + 1:
            return None
        return str(end)
    if re.fullmatch(r"\d{4}", text):
        return text
    return None


def _parse_filter(token: object) -> tuple[str | None, str | None]:
    if not isinstance(token, str):
        return None, "A filter has to be a stat, a comparison, and a number."
    compact = token.replace(" ", "")
    if ">=" in compact or "<=" in compact:
        return None, "Filters only support more than, less than, and exactly."
    op_index = -1
    op = ""
    for candidate in (">", "<", "="):
        found = compact.find(candidate)
        if found > 0:
            op_index = found
            op = candidate
            break
    if op_index < 0:
        return None, "A filter has to be a stat, a comparison, and a number."
    stat = compact[:op_index].lower()
    number = compact[op_index + 1 :]
    if stat not in FILTER_STATS:
        return None, f"{stat or 'That'} is not a filter this page can use."
    if not re.fullmatch(r"\d+(?:\.\d+)?", number):
        return None, "A filter value has to be a number."
    if stat in PCT_STATS and float(number) > 1:
        return None, "Percentage filters use decimals, so 40% is 0.40."
    return f"{stat}{op}{number}", None


def _error(message: str) -> dict:
    text = message.strip() or UNMAPPED
    return {"ok": False, "error": text[:300]}


def validate(question: str, payload: object) -> dict:
    """Accept a model object only when every field is a real stats-form value."""
    if not isinstance(payload, dict):
        return _error(UNMAPPED)
    if payload.get("ok") is not True:
        message = payload.get("error")
        if not isinstance(message, str):
            message = UNMAPPED
        return _error(message)

    if len(names_in(question)) >= 2 or len(names_in(str(payload.get("name", "")))) >= 2:
        return _error(ONE_PLAYER)
    if payload.get("team"):
        return _error("A stats query can't be limited to one team.")

    name = payload.get("name", "")
    if name is None:
        name = ""
    if not isinstance(name, str):
        return _error(UNMAPPED)
    name = " ".join(name.split())
    if not name:
        return _error(NEED_PLAYER)
    if re.search(r"\s(?:and|&)\s", name, flags=re.IGNORECASE):
        return _error(ONE_PLAYER)

    stat = payload.get("stat")
    agg = payload.get("agg")
    if not isinstance(stat, str) or not isinstance(agg, str):
        return _error(UNMAPPED)
    stat = stat.strip().lower()
    agg = agg.strip().lower()
    if stat not in STATS:
        return _error("That stat is not on the stats page.")
    if agg not in AGGS:
        return _error("The metric has to be a total, a per-game average, a best game, or a worst game.")
    if stat == "games" and agg != "sum":
        return _error("Games played can only be a total.")
    if stat in PCT_STATS and agg == "sum":
        return _error("A percentage can't be summed.")

    raw_seasons = payload.get("seasons", [])
    if raw_seasons is None:
        raw_seasons = []
    if isinstance(raw_seasons, (str, int)):
        raw_seasons = [raw_seasons]
    if not isinstance(raw_seasons, list):
        return _error("The season could not be read.")
    seasons: list[str] = []
    for item in raw_seasons:
        season = _normalize_season(item)
        if season is None or season not in SEASONS:
            return _error("That season is outside 2015–16 through 2025–26.")
        if season not in seasons:
            seasons.append(season)
    seasons.sort()

    raw_filters = payload.get("filters", [])
    if raw_filters is None:
        raw_filters = []
    if isinstance(raw_filters, str):
        raw_filters = [part for part in raw_filters.split(",") if part]
    if not isinstance(raw_filters, list):
        return _error("The filters could not be read.")
    filters: list[str] = []
    for item in raw_filters:
        parsed, message = _parse_filter(item)
        if parsed is None:
            return _error(message or UNMAPPED)
        filters.append(parsed)

    if "stage" not in payload or payload.get("stage") is None:
        stage = DEFAULT_STAGE
    else:
        raw_stage = payload.get("stage")
        if not isinstance(raw_stage, str):
            return _error("That stage is not preseason, regular season, or playoffs.")
        key = " ".join(raw_stage.split()).casefold()
        if key not in STAGES:
            return _error("That stage is not preseason, regular season, or playoffs.")
        stage = STAGES[key]

    return {
        "ok": True,
        "name": name,
        "stat": stat,
        "agg": agg,
        "seasons": seasons,
        "filters": filters,
        "stage": stage,
    }


def _parse_json_object(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("not json")
        payload = json.loads(text[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("not an object")
    return payload


def _complete(question: str, reminder: str = "") -> str:
    key = os.getenv("NL_API_KEY", "").strip()
    if not key:
        raise _ConfigError("NL_API_KEY is not set.")
    base = os.getenv("NL_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("NL_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if reminder:
        messages.append({"role": "system", "content": reminder})
    messages.append({"role": "user", "content": question})
    body = {
        "model": model,
        "temperature": 0,
        "messages": messages,
    }
    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        message = ""
        try:
            parsed = json.loads(detail)
            message = str(parsed.get("error", {}).get("message", ""))
        except (json.JSONDecodeError, AttributeError):
            message = ""
        suffix = f": {message[:180]}" if message else ""
        raise _UpstreamError(f"The model request failed ({error.code}){suffix}.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise _UpstreamError("The model request failed.") from error
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise _UpstreamError("The model request failed.") from error


def ask_stats(text: str) -> tuple[int, dict]:
    """Return an HTTP status and either a stats draft or {ok: false, error}."""
    question = (text or "").strip()
    if not question:
        return 200, _error("Enter a question.")
    if len(question) > 500:
        return 200, _error("Ask a shorter question.")
    if len(names_in(question)) >= 2:
        return 200, _error(ONE_PLAYER)
    try:
        raw = _complete(question)
    except _ConfigError as error:
        return 500, _error(str(error))
    except _UpstreamError as error:
        return 502, _error(str(error))
    try:
        payload = _parse_json_object(raw)
    except (ValueError, json.JSONDecodeError):
        return 200, _error(UNMAPPED)
    result = validate(question, payload)
    found = names_in(question)
    if result.get("error") == NEED_PLAYER and len(found) == 1:
        reminder = (
            f"The question names {found[0]}. That player is present. "
            "Do not fail because a player is missing. "
            "Fail only for a real gap, such as one stat or the metric."
        )
        try:
            raw = _complete(question, reminder)
            result = validate(question, _parse_json_object(raw))
        except (_UpstreamError, ValueError, json.JSONDecodeError):
            result = _error(NEED_PLAYER)
        if result.get("error") == NEED_PLAYER:
            result = _error(
                f"{found[0]} is named. Pick one stat, and say whether you want the total, "
                "the per-game average, the best game, or the worst game."
            )
    return 200, result


def _self_check() -> None:
    curry = {
        "ok": True,
        "name": "Stephen Curry",
        "stat": "3pm",
        "agg": "sum",
        "seasons": ["2023"],
        "filters": [],
        "stage": "Regular Season",
    }
    result = validate("how many threes did stephen curry hit in season 2023?", curry)
    assert result["ok"] and result["seasons"] == ["2023"] and result["stat"] == "3pm"

    spanned = dict(curry, seasons=["2022-2023"])
    assert validate("threes in 2022-2023", spanned)["seasons"] == ["2023"]

    blank = dict(curry, name="")
    assert validate("total threes in season 2022", blank)["error"] == NEED_PLAYER

    two = validate(
        "combined points for Stephen Curry and James Harden",
        {"ok": True, "name": "Stephen Curry", "stat": "points", "agg": "sum"},
    )
    assert two == {"ok": False, "error": ONE_PLAYER}

    rejected = validate("top 10", {"ok": False, "error": "This search answers one stat, not a leaderboard."})
    assert rejected["ok"] is False and "leaderboard" in rejected["error"]

    missing = validate("curry threes", {"ok": True, "name": "Stephen Curry", "stat": "3pm"})
    assert missing["ok"] is False

    pct = dict(curry, stat="3pct", agg="sum")
    assert validate("percentage", pct)["ok"] is False

    games = dict(curry, stat="games", agg="avg")
    assert validate("games", games)["ok"] is False

    old = dict(curry, seasons=["2015"])
    assert validate("season 2015", old)["ok"] is False

    bad_filter = dict(curry, filters=["3pct>40"])
    assert validate("percentage filter", bad_filter)["ok"] is False

    spaced = dict(curry, filters=["points > 30"])
    assert validate("over 30", spaced)["filters"] == ["points>30"]

    milestone = dict(curry, stat="games", filters=["points>49"], seasons=["2024"])
    parsed = validate("50-point games", milestone)
    assert parsed["ok"] and parsed["filters"] == ["points>49"] and parsed["seasons"] == ["2024"]

    default_stage = dict(curry)
    del default_stage["stage"]
    assert validate("no stage", default_stage)["stage"] == "Regular Season"

    assert _normalize_season("2022-23") == "2023"
    assert _normalize_season("2022/23") == "2023"

    status, body = ask_stats("combined points for Stephen Curry and James Harden")
    assert status == 200 and body == {"ok": False, "error": ONE_PLAYER}
    status, body = ask_stats("   ")
    assert status == 200 and body["error"] == "Enter a question."
    print("nl_stats checks passed")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        _self_check()
    elif len(sys.argv) > 1:
        status, body = ask_stats(" ".join(sys.argv[1:]))
        print(status)
        print(json.dumps(body, indent=2))
    else:
        _self_check()
