"""Lambda: scrape RealGM headshots and upload JPGs to S3 (allPlayerImages/)."""

import json

import boto3
import requests
from bs4 import BeautifulSoup

s3_client = boto3.client("s3", "us-west-1")
bucket_name = "nba-players.bucket"


def scrape_player_links(url):
    """Return RealGM profile paths from the league players index page."""
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to retrieve the webpage. Status code: {response.status_code}")
        return []

    soup = BeautifulSoup(response.content, "html.parser")
    td_elements = soup.find_all("td", {"data-th": "Player"})
    return [td.find("a")["href"] for td in td_elements if td.find("a")]


def download_image(url, save_path):
    """Fetch an image URL and store it under allPlayerImages/ in S3."""
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to retrieve the image. Status code: {response.status_code}")
        return
    s3_client.put_object(
        Key=f"allPlayerImages/{save_path}",
        Bucket=bucket_name,
        Body=response.content,
    )


def scrape_images(player_links):
    """Visit each player page and upload the portrait image to S3."""
    base = "https://basketball.realgm.com"
    for player_link in player_links:
        response = requests.get(base + player_link)
        if response.status_code != 200:
            print(f"Failed to retrieve the webpage. Status code: {response.status_code}")
            return []

        soup = BeautifulSoup(response.content, "html.parser")
        image = soup.findAll(
            "img",
            {
                "style": "border: 1px solid #000; float: left; margin-right: 15px; margin-top:5px;"
            },
        )
        src = image[0]["src"]
        parts = src.split("/")[-1].split("_")
        filename = f"{parts[1].lower()}{parts[0].lower()}.jpg"
        download_image(base + src, filename)


def lambda_handler(event, context):
    """Scrape all NBA player links from RealGM and refresh headshots in S3."""
    url = "https://basketball.realgm.com/nba/players"
    player_links = scrape_player_links(url)
    print("Finished scraping player links")
    scrape_images(player_links)
    return {"statusCode": 200, "body": json.dumps("Headshots updated")}
