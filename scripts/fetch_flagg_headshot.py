"""One-off: upload Cooper Flagg's NBA CDN headshot for PlayerAvatar.

The site requests allPlayerImages/{name}.jpg. This stores the CDN PNG at that
key with ContentType image/png so the existing avatar URL renders it.
"""

import unicodedata

import boto3
import requests
from nba_api.stats.static import players

BUCKET = "nba-players.bucket"
PLAYER_NAME = "cooper flagg"
HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
# Unknown NBA ids return HTTP 200 and this placeholder PNG.
PLACEHOLDER_BYTES = 12430


def image_key(name: str) -> str:
    """Match yba-frontend playerImageURL: drop spaces/apostrophes and accents."""
    slug = name.replace(" ", "").replace("'", "")
    slug = unicodedata.normalize("NFD", slug)
    slug = "".join(c for c in slug if unicodedata.category(c) != "Mn")
    return f"allPlayerImages/{slug.lower()}.jpg"


def nba_player_id(full_name: str) -> int:
    target = full_name.casefold()
    matches = [p for p in players.get_players() if p["full_name"].casefold() == target]
    if len(matches) != 1:
        found = [p["full_name"] for p in matches]
        raise SystemExit(f"Expected one NBA id for {full_name!r}, found {found}")
    return matches[0]["id"]


def main():
    player_id = nba_player_id(PLAYER_NAME)
    url = HEADSHOT_URL.format(player_id=player_id)
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    body = response.content
    if len(body) == PLACEHOLDER_BYTES:
        raise SystemExit(f"CDN returned the placeholder image for id {player_id}")

    key = image_key(PLAYER_NAME)
    s3 = boto3.client("s3", region_name="us-west-1")
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=body,
        ContentType="image/png",
    )
    print(f"id={player_id} bytes={len(body)} s3://{BUCKET}/{key}")


if __name__ == "__main__":
    main()
