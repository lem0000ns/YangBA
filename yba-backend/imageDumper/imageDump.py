"""Upload NBA CDN headshots to S3 for every name in allNames.txt.

Objects stay at allPlayerImages/{slug}.jpg because PlayerAvatar requests that
key. The CDN file is a PNG, so the object is stored with ContentType image/png.
"""

import json
import time
import unicodedata
from pathlib import Path

import boto3
import requests
from nba_api.stats.static import players

s3_client = boto3.client("s3", "us-west-1")
bucket_name = "nba-players.bucket"
prefix = "allPlayerImages/"
headshot_url = "https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
# Unknown NBA ids return HTTP 200 and this placeholder PNG.
placeholder_bytes = 12430
# Pause between CDN downloads so a full allNames pass does not get throttled.
request_gap_sec = 0.5
names_path = Path(__file__).resolve().parents[1] / "data" / "allNames.txt"
# allNames drops the suffix that the NBA roster keeps.
slug_overrides = {
    "jimmybutler": 202710,  # Jimmy Butler III
    "bobbyportis": 1626171,  # Bobby Portis Jr.
}


def image_slug(name: str) -> str:
    """Match playerImageURL: drop whitespace and apostrophes, then strip accents."""
    slug = "".join(ch for ch in name if ch not in " \t\n\r'")
    slug = unicodedata.normalize("NFD", slug)
    slug = "".join(ch for ch in slug if unicodedata.category(ch) != "Mn")
    return slug.lower()


def image_key(name: str) -> str:
    return f"{prefix}{image_slug(name)}.jpg"


def load_names() -> list[str]:
    """Names to refresh. Local allNames.txt when present, otherwise the S3 copy."""
    if names_path.exists():
        text = names_path.read_text()
    else:
        body = s3_client.get_object(Bucket=bucket_name, Key="allNames.txt")["Body"].read()
        text = body.decode("utf-8")
    return [line.strip() for line in text.splitlines() if line.strip()]


def roster_by_slug() -> dict[str, dict]:
    """NBA person id for each static-roster slug. Active players win ties."""
    grouped: dict[str, list[dict]] = {}
    for player in players.get_players():
        grouped.setdefault(image_slug(player["full_name"]), []).append(player)

    chosen = {}
    for slug, matches in grouped.items():
        active = [player for player in matches if player.get("is_active")]
        pool = active or matches
        pool.sort(key=lambda player: player["id"], reverse=True)
        chosen[slug] = pool[0]
    by_id = {player["id"]: player for player in players.get_players()}
    for slug, player_id in slug_overrides.items():
        player = by_id.get(player_id)
        if player:
            chosen[slug] = player
    return chosen


def fetch_headshot(player_id: int, session: requests.Session) -> bytes | None:
    """Download one CDN PNG. None means a missing player or a placeholder image."""
    response = session.get(headshot_url.format(player_id=player_id), timeout=60)
    if response.status_code == 429:
        time.sleep(5)
        response = session.get(headshot_url.format(player_id=player_id), timeout=60)
    if response.status_code != 200:
        print(f"HTTP {response.status_code} for nba id {player_id}")
        return None
    body = response.content
    if len(body) == placeholder_bytes:
        return None
    return body


def delete_stale(keep: set[str]) -> int:
    """Remove allPlayerImages objects that this run did not upload."""
    paginator = s3_client.get_paginator("list_objects_v2")
    stale = []
    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"] not in keep:
                stale.append({"Key": obj["Key"]})

    removed = 0
    for start in range(0, len(stale), 1000):
        chunk = stale[start : start + 1000]
        s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": chunk})
        removed += len(chunk)
    return removed


def refresh_headshots() -> dict:
    """Replace S3 headshots with NBA CDN portraits for allNames.txt."""
    names = load_names()
    roster = roster_by_slug()
    session = requests.Session()
    session.headers["User-Agent"] = "YangBA/1.0 (headshot refresh)"
    uploaded: set[str] = set()
    unmatched = []
    placeholder = []
    failed = []
    last_request = 0.0

    print(f"Refreshing headshots for {len(names)} names")
    for index, name in enumerate(names, start=1):
        player = roster.get(image_slug(name))
        if player is None:
            unmatched.append(name)
            continue

        wait = request_gap_sec - (time.time() - last_request)
        if last_request and wait > 0:
            time.sleep(wait)
        last_request = time.time()

        try:
            body = fetch_headshot(player["id"], session)
        except requests.RequestException as exc:
            print(f"Request failed for {name} ({player['id']}): {exc}")
            failed.append(name)
            continue

        if body is None:
            placeholder.append(name)
            continue

        key = image_key(name)
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=body,
            ContentType="image/png",
        )
        uploaded.add(key)
        if index % 50 == 0:
            print(f"  {index}/{len(names)} uploaded={len(uploaded)}")

    removed = 0
    if len(uploaded) < 100:
        print(f"Only uploaded {len(uploaded)}; leaving existing S3 objects in place")
    else:
        removed = delete_stale(uploaded)

    summary = {
        "names": len(names),
        "uploaded": len(uploaded),
        "unmatched": len(unmatched),
        "placeholder": len(placeholder),
        "failed": len(failed),
        "removed": removed,
    }
    print(
        "Headshots updated "
        f"uploaded={summary['uploaded']} unmatched={summary['unmatched']} "
        f"placeholder={summary['placeholder']} failed={summary['failed']} "
        f"removed={summary['removed']}"
    )
    if unmatched:
        print("Unmatched sample: " + ", ".join(unmatched[:30]))
    return summary


def lambda_handler(event, context):
    """Refresh every allNames.txt headshot from the NBA CDN."""
    summary = refresh_headshots()
    return {"statusCode": 200, "body": json.dumps(summary)}


if __name__ == "__main__":
    refresh_headshots()
