"""Scheduled Lambda: fetch NBA API data, write S3 dumps, sync MySQL, scrape player profiles."""

import json
import os

import pymysql
import requests
from playerScraper import namesToSQL
from utilities import GameDumper, MySQL_Writer, NameDumper, PlayerDumper

RAPIDAPI_URL = "https://api-nba-v1.p.rapidapi.com"
headers = {
    "x-rapidapi-key": os.getenv("RAPIDAPI_KEY", ""),
    "x-rapidapi-host": "api-nba-v1.p.rapidapi.com",
}
connection = pymysql.connect(
    host="yba-database.c30igyqguxod.us-west-1.rds.amazonaws.com",
    user="admin",
    password=os.getenv("SECRETS_MANAGER_CONTRASENA"),
    database="yba",
)


def getData(endpoint):
    """GET a RapidAPI NBA endpoint and return parsed JSON, or None on failure."""
    try:
        response = requests.get(RAPIDAPI_URL + endpoint, headers=headers)
    except Exception:
        print(f"Could not fetch data with endpoint {endpoint}")
        return None

    if response.status_code == 200:
        return response.json()
    print(
        f"Could not fetch data with endpoint {endpoint} "
        f"with status code {response.status_code}"
    )
    return None


def lambda_handler(event, context):
    """Run the full daily pipeline for the latest NBA season."""
    try:
        season = getData("/seasons")["response"][-1]

        NameDumper(season).dumpData()
        GameDumper(season).dumpData()
        PlayerDumper(season).dumpData()

        sql_writer = MySQL_Writer("games", season)
        sql_writer.transferData()
        sql_writer.setTable("version2")
        sql_writer.transferData()
        sql_writer.removeNonNBAPlayers()

        namesToSQL()

        if connection:
            connection.close()

        return {"statusCode": 200, "body": "Data uploaded successfully"}

    except Exception as e:
        return {"statusCode": 500, "body": f"Error uploading file: {e}"}
