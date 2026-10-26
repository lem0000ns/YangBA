"""Map API-Sports JSON into YangBA games / version2 row dicts."""

from datetime import datetime, timedelta

from api_sports_names import canonical_player_name


def parse_minutes(min_val) -> int | None:
    if min_val is None:
        return None
    s = str(min_val).strip()
    if s in ("", "--", "-", "0", "0:00", "00:00"):
        return None
    if ":" in s:
        return int(s.split(":")[0])
    try:
        return int(float(s))
    except ValueError:
        return None


def game_date_from_start(start: str) -> str:
    """MM-DD-YYYY in Pacific, matching legacy GameDumper behavior."""
    if not start:
        return ""
    if len(start) > 10:
        clean = start.replace("Z", "")
        if "." in clean:
            utc_time = datetime.strptime(clean[:26], "%Y-%m-%dT%H:%M:%S.%f")
        else:
            utc_time = datetime.strptime(clean[:19], "%Y-%m-%dT%H:%M:%S")
        pdt_time = utc_time - timedelta(hours=7)
    else:
        utc_time = datetime.strptime(start[:10], "%Y-%m-%d")
        pdt_time = utc_time - timedelta(days=1)
    return pdt_time.strftime("%m-%d-%Y")


def team_label(team: dict | None) -> str:
    """NBA code when the API has one; otherwise the club name (exhibitions)."""
    team = team or {}
    code = str(team.get("code") or "").strip()
    if code:
        return code
    label = str(team.get("nickname") or team.get("name") or "").strip()
    return label[:50]


def map_game(game: dict) -> dict | None:
    if game.get("league") != "standard":
        return None
    home_pts = game.get("scores", {}).get("home", {}).get("points")
    away_pts = game.get("scores", {}).get("visitors", {}).get("points")
    if home_pts is None or away_pts is None:
        return None
    game_id = game["id"]
    if game_id == 10978:
        game_id = 10973
    start = (game.get("date") or {}).get("start") or ""
    return {
        "gameID": game_id,
        "stage": game.get("stage"),
        "gameDate": game_date_from_start(start),
        "home": team_label(game["teams"]["home"]),
        "homePts": home_pts,
        "away": team_label(game["teams"]["visitors"]),
        "awayPts": away_pts,
        "_status_short": (game.get("status") or {}).get("short"),
    }


def is_finished_game(game_row: dict) -> bool:
    status = game_row.get("_status_short")
    return status == 3 or status == "3"


def map_player_stat(stat: dict, season: int) -> dict | None:
    min_played = parse_minutes(stat.get("min"))
    if min_played is None or stat.get("points") is None:
        return None
    player = stat.get("player") or {}
    first = (player.get("firstname") or "").strip()
    last = (player.get("lastname") or "").strip()
    player_id = player.get("id")
    name = canonical_player_name(player_id, first, last)
    if not name:
        return None
    game_id = (stat.get("game") or {}).get("id")
    return {
        "name": name,
        "playerID": player_id,
        "gameID": game_id,
        "team": team_label(stat.get("team")),
        "season": season,
        "points": stat.get("points"),
        "min": min_played,
        "fgm": stat.get("fgm"),
        "fga": stat.get("fga"),
        "ftm": stat.get("ftm"),
        "fta": stat.get("fta"),
        "3pm": stat.get("tpm"),
        "3pa": stat.get("tpa"),
        "reb": stat.get("totReb"),
        "ast": stat.get("assists"),
        "steals": stat.get("steals"),
        "blocks": stat.get("blocks"),
        "turnovers": stat.get("turnovers"),
    }
