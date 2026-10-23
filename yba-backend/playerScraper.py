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


def insert_player_row(row: dict):
    values = []
    for col in (
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
    ):
        val = row.get(col)
        if val is None:
            values.append("NULL")
        elif col == "teams":
            values.append("'" + str(val).replace("'", "''") + "'")
        elif col == "intro":
            values.append("'" + str(val).replace("'", "\\'") + "'")
        else:
            values.append('"' + str(val).replace('"', '\\"') + '"')
    cursor.execute(
        "INSERT INTO players (playerID, name, pos, born, height, weight, "
        "high_school, college, draft, career, teams, awards, intro) "
        f"VALUES ({', '.join(values)})"
    )


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
    content = soup.find("div", class_="mw-parser-output")
    if not content:
        return None
    for p in content.find_all("p", recursive=False):
        text = p.get_text().strip()
        if len(text) > 40:
            return text[:600]
    return None


def player_id_for_name(name: str) -> int | None:
    cursor.execute(f'SELECT playerID FROM version2 WHERE name="{name}" GROUP BY name LIMIT 1')
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
        profile_name = f"{first} {last}".strip().lower() or name
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

            if header and header.text in ["Career highlights and awards", "honors"]:
                r_index += 1
                r = rows[r_index]
                data = r.find("td", class_="infobox-full-data")
                if data:
                    row["awards"] = data.text
                    break

            elif header and header.text == "Career history":
                teams = []
                r_index += 1
                if rows[r_index].find("th") and rows[r_index].find("th").text == "As player:":
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
                        if x.text != "League" and x.text in WIKI_TO_ROW:
                            row[WIKI_TO_ROW[x.text]] = y.text
            r_index += 1

    row["intro"] = _intro_from_soup(soup)
    insert_player_row(row)
    return row


def _is_wikipedia_rate_limit(exc: BaseException) -> bool:
    if isinstance(exc, json.JSONDecodeError):
        return True
    msg = str(exc).lower()
    return "expecting value" in msg or "429" in msg or "too many requests" in msg


def _try_wikipedia(canonical: str) -> bool:
    display = " ".join(part.capitalize() for part in canonical.split(" "))
    search_results = wikipedia.search(display + " (basketball)")
    if not search_results:
        return False
    wiki_title = search_results[0]
    url = "https://en.wikipedia.org/wiki/" + wiki_title.replace(" ", "_")
    wikibot(wiki_title, canonical, url)
    return True


@test_time
def namesToSQL(prefer_api: bool = True, use_wikipedia: bool = True):
    name_file = s3_client.get_object(Bucket=bucket_name, Key="allNames.txt")
    names = name_file["Body"].read().decode("utf-8")

    stats = {"wiki": 0, "api": 0, "already": 0, "missing": 0}

    for raw in names.splitlines():
        canonical = raw.strip().lower()
        if not canonical:
            continue
        cursor.execute(f'SELECT 1 FROM players WHERE name="{canonical}" LIMIT 1')
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
            try:
                time.sleep(WIKI_DELAY_SEC)
                if _try_wikipedia(canonical):
                    via_wiki = True
            except Exception as e:
                if not _is_wikipedia_rate_limit(e) and str(e) != "Infobox Vcard is absent":
                    print(f"Wikipedia failed for {canonical}: {e}")

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

    print(
        f"namesToSQL: wiki={stats['wiki']} api={stats['api']} "
        f"already_in_db={stats['already']} no_profile={stats['missing']}"
    )
