"""ETL helpers: S3 NBA dumps, MySQL bulk load, and season data flattening."""

import json
import threading
import time
import traceback
from datetime import datetime, timedelta
from random import randint

import boto3

# Configuration
s3_client = boto3.client('s3', 'us-west-1')
bucket_name = "nba-players.bucket"
allNames = set()

def test_time(func):
    """Decorator that logs wall-clock seconds for a function call."""

    def wrapper(*args, **kwargs):
        start_time = int(time.time())
        res = func(*args, **kwargs)
        print(f"{func} took {int(time.time()) - start_time} seconds")
        return res
    return wrapper

class MySQL_Writer:
    """Load NDJSON season files from S3 into MySQL games or version2 tables."""

    def __init__(self, table, season):
        self.table = table
        self.season = season
        if self.table == "version2":
            self.columns = ["name", "playerID", "gameID", "team", "season", "points", "min", "fgm", "fga", "ftm", "fta", "3pm", "3pa", "reb", "ast", "steals", "blocks", "turnovers"]
            self.key_template = "version2/playerStats%s.json"
        elif self.table == "games":
            self.columns = ["gameID", "stage", "gameDate", "home", "homePts", "away", "awayPts"]
            self.key_template = "gameStages/games%s.json"
        self.columns_placeholder = ", ".join(self.columns)

    @test_time
    def transferData(self):
        """Insert or upsert all rows from the season's S3 JSON dump."""
        from dataDump import connection
        cursor = connection.cursor()

        key = self.key_template % self.season
        obj = s3_client.get_object(Bucket=bucket_name, Key=key)
        ndjson_data = obj['Body'].read().decode('utf-8')
        data = [json.loads(line) for line in ndjson_data.splitlines()]

        insert_query = f"INSERT INTO {self.table} ({self.columns_placeholder}) VALUES "
        allValues = []
        for game in data:
            values = [game.get(col, None) for col in self.columns]
            if self.table == "version2":
                values[0] = '"' + values[0] + '"'
                values[3] = '"' + values[3] + '"'
                allValues.append('(' + ', '.join(map(str, values)) + ')')
            elif self.table =="games" and values[4] != None:
                values[2] = '"' + values[2] + '"'
                values[3] = '"' + values[3] + '"'
                values[5] = '"' + values[5] + '"'
                allValues.append('(' + ', '.join(map(str, values)) + ')')
        insert_query += ', '.join(allValues)
        insert_query += " ON DUPLICATE KEY UPDATE "
        update_clause = ', '.join([f"{col} = VALUES({col})" for col in self.columns])
        insert_query += update_clause
        try:
            cursor.execute(insert_query)
            connection.commit()
        except Exception as e:
            print(f"error transferring data to version2 with error: {e}")
        
    @test_time
    def removeNonNBAPlayers(self):
        """Delete version2 rows with empty team (non-NBA league noise)."""
        from dataDump import connection
        cursor = connection.cursor()
        if self.table == "version2":
            #gets rid of former nba players from database whose games are in different league
            cursor.execute(f"DELETE FROM version2 WHERE team=\"\" AND season={self.season}")
            connection.commit()

    def setTable(self, newTable):
        """Switch target table (games vs version2) for transferData."""
        self.table = newTable

    def setSeason(self, newSeason):
        """Set the NBA season year used in S3 key templates."""
        self.season = newSeason


class DataDumper:
    """Base class for season-scoped S3 dump workflows."""

    def __init__(self, season):
        self.season = season

    def setSeason(self, newSeason):
        """Update the season identifier for subsequent dumps."""
        self.season = newSeason

    def isRecordedGame(self, gameID):
        """True if gameID exists in games with a non-empty home team."""
        from dataDump import connection
        cursor = connection.cursor()

        cursor.execute(f" SELECT home FROM games WHERE gameID = {gameID}")
        result = cursor.fetchone()
        return result is not None and result[0] != ""

    @test_time
    def getAllPlayers(self, szn, data, startTeamID, onlyNames):
        """Fetch roster stats from RapidAPI by team slice; names-only or full stat map."""
        from dataDump import getData
        nbaTeamIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 38, 40, 41]
        for team in range(startTeamID, startTeamID + 15):
            teamID = nbaTeamIds[team - 1]
            teamPlayers = getData(f"/players?season={szn}&team={teamID}")
            print("Currently on team " + str(team))
            for p in range(0, len(teamPlayers['response'])):
                stats = teamPlayers['response'][p]
                name = stats['firstname'].lower() + " " + stats['lastname'].lower()
                #dumps names in names.txt
                if onlyNames:
                    if name not in allNames:
                        allNames.add(name)
                #stores in hashmap with players' names as keys and their szn stats as values
                else:
                    sznStats = self.getSeasonStats(szn, stats)
                    if (sznStats):
                        data[name] = sznStats
                    else:
                        print(f'Failed to fetch player {name} data for season {szn}')
            time.sleep(randint(1,5))

    def getSeasonStats(self, szn, stats):
        """Return per-game statistics array for one player id, or None."""
        from dataDump import getData
        try:
            id = stats['id']
            data = getData("/players/statistics?season={}&id={}".format(szn, id))['response']
            if data is not None:
                return data
            return None
        except Exception as e:
            print(f"Could not fetch season stats for this player")
            return None
        
    def dumpS3(self, data, s3_path):
        """Write a list of dicts to S3 as newline-delimited JSON."""
        jsonl_string = '\n'.join(json.dumps(item) for item in data)
        s3_client.put_object(
            Key=s3_path,
            Bucket=bucket_name,
            Body=jsonl_string
        )
    
class NameDumper(DataDumper):
    """Merge historical and current-season player names into names.txt on S3."""

    def __init__(self, season):
        super().__init__(season)

    @test_time
    def dumpData(self):
        """Refresh allNames.txt from S3 plus two parallel team scans."""
        nameFile = s3_client.get_object(Bucket=bucket_name, Key="names.txt")
        names = nameFile['Body'].read().decode('utf-8')
        for n in names.splitlines():
            allNames.add(n)

        #adds any new names in most recent season to allNames
        threads = []
        for i in range(2):
            thread = threading.Thread(target=super().getAllPlayers, args=(self.season, allNames, 1 + 15 * i, True))
            threads.append(thread)
            thread.start()
            time.sleep(5)
        for thread in threads:
            thread.join()
            
        s3_client.put_object(Bucket=bucket_name, Key="names.txt", Body="\n".join(allNames), ContentType='text/plain')

class GameDumper(DataDumper):
    """Build the games table NDJSON for a season."""

    def __init__(self, season):
        super().__init__(season)

    @test_time
    def dumpData(self):
        """Fetch league games, normalize dates/scores, upload to S3."""
        allGames = []
        from dataDump import getData
        data = getData(f"/games?season={self.season}")['response']
        for game in data:
            currGame = {}
            if (game["league"] == "standard"):
                if (game['id'] == 10978):
                    game['id'] = 10973
                currGame['gameID'] = game['id']
                currGame['stage'] = game['stage']
                gameTime = game['date']['start']
                if len(gameTime) > 10:
                    utc_time = datetime.strptime(gameTime, '%Y-%m-%dT%H:%M:%S.%fZ')
                    pdt_time = utc_time - timedelta(hours=7)
                else:
                    utc_time = datetime.strptime(gameTime, '%Y-%m-%d')
                    pdt_time = utc_time - timedelta(days=1)
                currGame['gameDate'] = pdt_time.strftime('%m-%d-%Y')
                currGame['home'] = game['teams']['home']['code']
                currGame['homePts'] = game['scores']['home']['points']
                currGame['away'] = game['teams']['visitors']['code']
                currGame['awayPts'] = game['scores']['visitors']['points']
                allGames.append(currGame)

        super().dumpS3(allGames, f"gameStages/games{self.season}.json")

class PlayerDumper(DataDumper):
    """Flatten version1 player JSON into version2 per-game stat lines."""

    def __init__(self, season):
        super().__init__(season)

    @test_time
    def dumpData(self):
        """Parse version1 dump, filter valid minutes, keep recorded games only."""
        try:
            #reading from s3 to get player data
            obj = s3_client.get_object(Bucket=bucket_name, Key=f"version1/allPlayers{self.season}.json")
            json_data = obj['Body'].read().decode('utf-8')
            data = json.loads(json_data)

            playerStats = {}
            allStats = []

            for player in data:
                for currGame in range(len(data[player])):
                    currPlayer = data[player][currGame]
                    #filters out players who didn't play / registered 0 minutes
                    valid = (
                        currPlayer["min"] not in ["--", "-", "0", "0:00", "00:00"]
                        and currPlayer["min"] is not None
                        and currPlayer["points"] is not None
                    )
                    if valid:
                        playerStats["name"] = currPlayer["player"]["firstname"] + " " + currPlayer["player"]["lastname"]
                        playerStats["playerID"] = currPlayer["player"]["id"]
                        gameID = currPlayer["game"]["id"]
                        playerStats["gameID"] = gameID
                        playerStats["team"] = currPlayer["team"]["code"]
                        playerStats["season"] = self.season
                        playerStats["points"] = currPlayer["points"]
                        #if min has : in it e.g. 30:35
                        index = currPlayer["min"].find(':')
                        playerStats["min"] = (int)(currPlayer["min"][:index]) if index != -1 else (int)(currPlayer["min"])
                        playerStats["fgm"] = currPlayer["fgm"]
                        playerStats["fga"] = currPlayer["fga"]
                        playerStats["ftm"] = currPlayer["ftm"]
                        playerStats["fta"] = currPlayer["fta"]
                        playerStats["3pm"] = currPlayer["tpm"]
                        playerStats["3pa"] = currPlayer["tpa"]
                        playerStats["reb"] = currPlayer["totReb"]
                        playerStats["ast"] = currPlayer["assists"]
                        playerStats["steals"] = currPlayer["steals"]
                        playerStats["blocks"] = currPlayer["blocks"]
                        playerStats["turnovers"] = currPlayer["turnovers"]
                        if super().isRecordedGame(gameID):
                            allStats.append(playerStats)
                        playerStats = {}
            super().dumpS3(allStats, f"version2/playerStats{self.season}.json")
                            
        except Exception as e:
            print(f"Error flattening data with exception: {e}")
            traceback.print_exc()