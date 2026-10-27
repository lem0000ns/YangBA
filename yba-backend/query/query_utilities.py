"""SQL builders for YangBA stats/games/rank queries (MySQL + fuzzy player names)."""

import os
import time

import boto3
import pymysql
from fuzzywuzzy import fuzz

s3_client = boto3.client("s3", "us-west-1")
connection = pymysql.connect(
    host="yba-database.c30igyqguxod.us-west-1.rds.amazonaws.com",
    user="admin",
    password=os.getenv("SECRETS_MANAGER_CONTRASENA"),
    database="yba",
)
connection.autocommit(True)
cursor = connection.cursor()
table = " FROM version2 v INNER JOIN games g ON v.gameID = g.gameID"

# ESPN default points-league fantasy scoring (computed at query time, not stored).
FPTS = (
    "(2 * fgm - fga + `3pm` + 2 * ast + reb + 4 * (steals + blocks) "
    "- 2 * turnovers + points - (fta - ftm))"
)

name_file = s3_client.get_object(Bucket="nba-players.bucket", Key="allNames.txt")
names = name_file["Body"].read().decode("utf-8")


def getClosestName(name):
    """Resolve a user-typed name to the stored spelling in allNames.txt."""
    target = name.strip().casefold()
    best_score = float("-inf")
    best_name = ""
    for candidate in names.splitlines():
        if not candidate:
            continue
        if candidate.casefold() == target:
            return candidate
        score = fuzz.ratio(candidate.casefold(), target)
        if score > best_score:
            best_score = score
            best_name = candidate
    return best_name


def statColumn(stat):
    """Map API stat keys to SQL column expressions (fpts uses the FPTS formula)."""
    return FPTS if stat == "fpts" else stat


def find_filter_op_index(token):
    """Return the index of the first comparison operator in a filter token, or -1."""
    for op in ("<", ">", "="):
        try:
            return token.index(op)
        except ValueError:
            continue
    return -1


class QueryComputer:
    """Shared query parameters and season/stage/filter SQL fragments."""

    def __init__(self, agg, event):
        self.agg = agg
        self.stat = event["queryStringParameters"].get("stat", None)
        self.name = event["queryStringParameters"].get("name", None)
        self.editDistanceTime = 0
        if self.name is not None:
            start = time.time()
            self.name = getClosestName(self.name)
            self.editDistanceTime = time.time() - start
        self.season = event["multiValueQueryStringParameters"].get("season", None)
        self.stage = event["multiValueQueryStringParameters"].get("stage", None)
        self.filters = event["queryStringParameters"].get("filter", None)
        self.limit = event["queryStringParameters"].get("limit", None)
        self.team = event["queryStringParameters"].get("team", None)
        self.order = event["queryStringParameters"].get("order", None)
        self.sToQ = {"3pct": "3p", "fgpct": "fg", "ftpct": "ft"}

    def getEditDistanceTime(self):
        """Seconds spent fuzzy-matching the player name."""
        return self.editDistanceTime

    def getName(self):
        """Canonical player name after fuzzy match, if any."""
        return self.name

    def compute_filterQuery(self, rank, filters):
        """Build HAVING (rank) or AND (games/stats) clauses from comma-separated filters."""
        query = "HAVING" if rank else ""
        first = True
        for token in filters.split(","):
            index = find_filter_op_index(token)
            stat_key = token[0:index]

            def helper(stat_expr, is_first):
                if not rank:
                    return f" AND {stat_expr} {token[index]}{token[index + 1 :]}"
                prefix = "" if is_first else " AND"
                if stat_key == "games":
                    return f"{prefix} COUNT(*) {token[index]}{token[index + 1 :]}"
                return f"{prefix} AVG({stat_expr}) {token[index]}{token[index + 1 :]}"

            if stat_key not in ("3pct", "fgpct", "ftpct"):
                query += helper(statColumn(stat_key), first)
            else:
                pct = f"v.{self.sToQ[stat_key]}m/v.{self.sToQ[stat_key]}a"
                query += helper(pct, first)
            first = False
        return query

    def compute_Query(self):
        """Append season and stage constraints shared by all query types."""
        query = ""
        if self.season:
            query += " AND ("
            for szn in self.season:
                query += f"v.season={szn} OR "
            query = query[: len(query) - 4] + ")"
        if self.stage:
            query += " AND ("
            for stage in self.stage:
                query += f"g.stage={stage} OR "
            query = query[: len(query) - 4] + ")"
        return query


class RankComputer(QueryComputer):
    """Leaderboard queries grouped by player."""

    def compute_Query(self):
        if self.stat not in ("3pct", "fgpct", "ftpct"):
            query = f"SELECT name, {self.agg}({statColumn(self.stat)})" + table
        else:
            s = self.sToQ[self.stat]
            query = f"SELECT name, {self.agg}({s}m / {s}a)" + table

        query += super().compute_Query()
        if self.team:
            query += f" AND team='{self.team}'"

        query += " GROUP BY name "
        if self.filters:
            query += super().compute_filterQuery(True, self.filters)
        if self.stat not in ("3pct", "fgpct", "ftpct"):
            query += f" ORDER BY {self.agg}({statColumn(self.stat)}) {self.order}"
        else:
            s = self.sToQ[self.stat]
            query += f" ORDER BY {self.agg}({s}m/{s}a) {self.order}"
        query += f" LIMIT {self.limit}"
        return query


class GameComputer(QueryComputer):
    """Per-game stat line listings."""

    def compute_Query(self):
        query = (
            f"SELECT v.name, v.playerID, g.gameID, g.stage, g.gameDate, v.team, "
            f"v.season, v.points, v.min, v.fgm, v.fga, v.ftm, v.fta, v.3pm, v.3pa, "
            f"v.reb, v.ast, v.steals, v.blocks, v.turnovers, {FPTS} AS FPTS"
            + table
        )
        if self.name:
            query += f' WHERE v.name="{self.name}"'

        query += super().compute_Query()
        if self.filters:
            query += super().compute_filterQuery(False, self.filters)
        if self.team:
            query += f" AND team='{self.team}'"
        query += " ORDER BY STR_TO_DATE(g.gameDate, '%m-%d-%Y') DESC, g.gameID DESC"
        limit = "" if self.limit is None else str(self.limit).strip()
        if limit.isdigit() and 0 < int(limit) < 100000:
            query += f" LIMIT {int(limit)}"
        return query


class StatComputer(QueryComputer):
    """Single aggregated stat for one player (or global count for games)."""

    def compute_Query(self):
        query = ""
        if self.stat == "games":
            query = "SELECT COUNT(*)" + table
        elif self.stat not in ("3pct", "fgpct", "ftpct"):
            query = f"SELECT {self.agg}({statColumn(self.stat)})" + table
        else:
            s = self.sToQ[self.stat]
            if self.agg == "avg":
                query = f"SELECT sum({s}m) / sum({s}a)" + table
            elif self.agg != "sum":
                query = f"SELECT {self.agg}({s}m / {s}a)" + table

        if self.name:
            query += f' WHERE v.name="{self.name}"'

        query += super().compute_Query()
        if self.filters:
            query += super().compute_filterQuery(False, self.filters)
        return query
