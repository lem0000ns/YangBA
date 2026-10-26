"""Scrape Wikipedia for NBA player profiles; API-Sports fallback when scrape fails."""

import json
import os
import time

import boto3
import pymysql
import requests
import wikipedia
from bs4 import BeautifulSoup

from api_sports_client import get_json, response_list

s3_client = boto3.client("s3", "us-west-1")
bucket_name = "nba-players.bucket"

connection = pymysql.connect(
    host="yba-database.c30igyqguxod.us-west-1.rds.amazonaws.com",
    user="admin",
    password=os.getenv("SECRETS_MANAGER_CONTRASENA"),
    database="yba",
)
cursor = connection.cursor()

WIKI_REQUEST_HEADERS = {
    "User-Agent": "YangBA/1.0 (https://github.com/yangba; local ETL player profiles)",
}
# MediaWiki API rate-limits burst traffic from wikipedia.search/summary.
WIKI_DELAY_SEC = 0.4

WIKI_TO_ROW = {
    "Position": "pos",
    "Born": "born",
    "Listed height": "height",
    "Listed weight": "weight",
    "High school": "high_school",
    "College": "college",
    "NBA draft": "draft",
    "Playing career": "career",
}


def test_time(func):
    def wrapper(*args, **kwargs):
        start_time = int(time.time())
        res = func(*args, **kwargs)
        print(f"{func.__name__} took {int(time.time()) - start_time} seconds")
        return res
    return wrapper


_PLAYER_COLUMNS = (
    "playerID",
    "name",
    "pos",
    "born",
    "height",
    "weight",
    "high_school",
    "college",
    "draft",
    "career",
    "teams",
    "awards",
    "intro",
)


def insert_player_row(row: dict):
    placeholders = ", ".join(["%s"] * len(_PLAYER_COLUMNS))
    columns = ", ".join(_PLAYER_COLUMNS)
    cursor.execute(
        f"INSERT INTO players ({columns}) VALUES ({placeholders})",
        tuple(row.get(col) for col in _PLAYER_COLUMNS),
    )


def save_player_row(row: dict):
    """Replace one player's profile. playerID is not unique, so delete then insert."""
    cursor.execute("DELETE FROM players WHERE playerID=%s", (row["playerID"],))
    insert_player_row(row)
    connection.commit()


def is_abbreviated_api_name(name: str) -> bool:
    """API-Sports often returns 'a. bailey' style names; Wikipedia search won't match."""
    parts = name.strip().lower().split()
    if not parts:
        return False
    first = parts[0]
    if "." in first and len(first) <= 5:
        return True
    return False


def _intro_from_soup(soup) -> str | None:
    content = soup.find("div", id="mw-content-text") or soup
    for p in content.find_all("p"):
        text = " ".join(p.get_text(" ", strip=True).split())
        text = text.replace("[ ", "[").replace(" ]", "]")
        while True:
            cleaned = text
            for marker in range(1, 40):
                cleaned = cleaned.replace(f"[{marker}]", "")
            if cleaned == text:
                break
            text = " ".join(cleaned.split())
        if len(text) > 40:
            return text[:600]
    return None


def player_id_for_name(name: str) -> int | None:
    cursor.execute(
        "SELECT playerID FROM version2 WHERE name=%s LIMIT 1",
        (name,),
    )
    row = cursor.fetchone()
    return row[0] if row else None


def fetch_player_profile_from_api_sports(player_id: int, name: str) -> bool:
    try:
        payload = get_json("/players", {"id": player_id})
        players = response_list(payload)
        if not players:
            return False
        p = players[0]
        first = (p.get("firstname") or "").strip()
        last = (p.get("lastname") or "").strip()
        profile_name = f"{first} {last}".strip() or name
        height = p.get("height") or {}
        weight = p.get("weight") or {}
        birth = p.get("birth") or {}
        standard = (p.get("leagues") or {}).get("standard") or {}
        height_str = None
        if height.get("feets") and height.get("inches"):
            height_str = f'{height["feets"]}\'{height["inches"]}"'
        weight_str = f'{weight["pounds"]} lb' if weight.get("pounds") else None
        born = birth.get("date")
        if born and birth.get("country"):
            born = f"{born} ({birth['country']})"
        nba = p.get("nba") or {}
        insert_player_row(
            {
                "playerID": player_id,
                "name": profile_name,
                "pos": standard.get("pos"),
                "born": born,
                "height": height_str,
                "weight": weight_str,
                "high_school": None,
                "college": p.get("college"),
                "draft": None,
                "career": str(nba["start"]) if nba.get("start") else None,
                "teams": None,
                "awards": None,
                "intro": None,
            }
        )
        return True
    except Exception as e:
        print(f"API-Sports profile fallback failed for {name} ({player_id}): {e}")
        return False


def wikibot(orig, canonical_name, url):
    url_open = requests.get(url, timeout=30, headers=WIKI_REQUEST_HEADERS)
    soup = BeautifulSoup(url_open.content, "html.parser")
    table = soup("table", {"class": "infobox vcard"})
    if len(table) == 0:
        raise Exception("Infobox Vcard is absent")

    player_id = player_id_for_name(canonical_name)
    if player_id is None:
        raise Exception("No name in version2")

    row = {"playerID": player_id, "name": canonical_name}
    for i in table:
        rows = i.find_all("tr")
        r_index = 0
        while r_index < len(rows):
            r = rows[r_index]
            header = r.find("th")
            header_text = header.get_text(" ", strip=True) if header else ""

            if header_text in ("Career highlights and awards", "Career highlights", "honors"):
                r_index += 1
                if r_index < len(rows):
                    data = rows[r_index].find("td", class_="infobox-full-data")
                    if data:
                        items = [li.get_text(" ", strip=True) for li in data.find_all("li")]
                        row["awards"] = "\n".join(items) if items else data.get_text("\n", strip=True)

            elif header_text == "Career history":
                teams = []
                r_index += 1
                if rows[r_index].find("th") and rows[r_index].find("th").get_text(" ", strip=True) == "As player:":
                    r_index += 1
                while r_index < len(rows) and rows[r_index].find("td"):
                    try:
                        teams.append(
                            {
                                rows[r_index].find("th").text: rows[r_index].find("td").text,
                            }
                        )
                    except Exception:
                        pass
                    r_index += 1
                row["teams"] = json.dumps(teams)
                r_index -= 1

            else:
                heading = r.find_all("th")
                detail = r.find_all("td")
                if heading and detail:
                    for x, y in zip(heading, detail):
                        label = x.get_text(" ", strip=True)
                        if label != "League" and label in WIKI_TO_ROW:
                            row[WIKI_TO_ROW[label]] = y.get_text(" ", strip=True)
            r_index += 1

    row["intro"] = _intro_from_soup(soup)
    save_player_row(row)
    return row


def _is_wikipedia_rate_limit(exc: BaseException) -> bool:
    if isinstance(exc, json.JSONDecodeError):
        return True
    msg = str(exc).lower()
    return "expecting value" in msg or "429" in msg or "too many requests" in msg


def _try_wikipedia(canonical: str) -> bool:
    search_results = wikipedia.search(canonical + " (basketball)")
    if not search_results:
        return False
    wiki_title = search_results[0]
    url = "https://en.wikipedia.org/wiki/" + wiki_title.replace(" ", "_")
    wikibot(wiki_title, canonical, url)
    return True


def _wikipedia_profile(canonical: str, attempts: int = 4) -> bool:
    """Try Wikipedia, backing off on rate limits before giving up."""
    for attempt in range(attempts):
        try:
            time.sleep(WIKI_DELAY_SEC)
            return _try_wikipedia(canonical)
        except Exception as e:
            if _is_wikipedia_rate_limit(e) and attempt + 1 < attempts:
                wait = 5 * (attempt + 1)
                print(f"Wikipedia rate limit for {canonical}, retrying in {wait}s")
                time.sleep(wait)
                continue
            if not _is_wikipedia_rate_limit(e) and str(e) != "Infobox Vcard is absent":
                print(f"Wikipedia failed for {canonical}: {e}")
            return False
    return False


@test_time
def namesToSQL(prefer_api: bool = False, use_wikipedia: bool = True):
    name_file = s3_client.get_object(Bucket=bucket_name, Key="allNames.txt")
    names = name_file["Body"].read().decode("utf-8")

    stats = {"wiki": 0, "api": 0, "already": 0, "missing": 0}
    lines = [line for line in names.splitlines() if line.strip()]

    for index, raw in enumerate(lines, 1):
        canonical = " ".join(raw.split())
        if not canonical:
            continue
        cursor.execute("SELECT 1 FROM players WHERE name=%s LIMIT 1", (canonical,))
        if cursor.fetchone():
            stats["already"] += 1
            continue

        player_id = player_id_for_name(canonical)
        via_api = False
        via_wiki = False

        if prefer_api and player_id and fetch_player_profile_from_api_sports(player_id, canonical):
            via_api = True

        if (
            use_wikipedia
            and not via_api
            and not is_abbreviated_api_name(canonical)
        ):
            via_wiki = _wikipedia_profile(canonical)

        if not via_wiki and not via_api and player_id and fetch_player_profile_from_api_sports(
            player_id, canonical
        ):
            via_api = True

        if via_wiki or via_api:
            connection.commit()
            if via_wiki:
                stats["wiki"] += 1
            else:
                stats["api"] += 1
        else:
            stats["missing"] += 1

        if index % 25 == 0 or index == len(lines):
            print(
                f"profiles {index}/{len(lines)}: "
                f"wiki={stats['wiki']} api={stats['api']} missing={stats['missing']}",
                flush=True,
            )

    print(
        f"namesToSQL: wiki={stats['wiki']} api={stats['api']} "
        f"already_in_db={stats['already']} no_profile={stats['missing']}"
    )
