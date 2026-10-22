"""AWS Lambda entrypoint for YangBA API routes (stats, games, rank, players)."""

import json
import time

from query_utilities import GameComputer, RankComputer, StatComputer, cursor, statColumn


def compute_Percentile(name, stat, season, agg, filters):
    """Return how the player ranks vs peers (0 = best) for the given stat context."""
    if stat != "games":
        if stat in ("3pct", "fgpct", "ftpct"):
            convert = {"3pct": "3p", "fgpct": "fg", "ftpct": "ft"}
            temp1 = f"sum({convert[stat]}m)/sum({convert[stat]}a)"
        else:
            temp1 = f"{agg}({statColumn(stat)})"
    else:
        temp1 = "COUNT(*)"

    filter_stats = ""
    if filters:
        filter_stats = " and ".join(
            statColumn("fpts") + f[4:] if f.startswith("fpts") else f
            for f in filters.split(",")
        )

    if season is None:
        if filters:
            filter_stats = "WHERE " + filter_stats
        query = (
            f"WITH PercentileRanks AS (SELECT name, PERCENT_RANK() OVER "
            f"(ORDER BY {temp1} DESC) AS percentile_rank FROM version2 "
            f"INNER JOIN games ON version2.gameID = games.gameID {filter_stats} "
            f"GROUP BY name) SELECT percentile_rank FROM PercentileRanks "
            f'WHERE name = "{name}";'
        )
    else:
        temp = ",".join(season)
        if filters:
            filter_stats = " AND " + filter_stats
        query = (
            f"WITH PercentileRanks AS (SELECT name, PERCENT_RANK() OVER "
            f"(ORDER BY {temp1} DESC) AS percentile_rank FROM version2 "
            f"INNER JOIN games ON version2.gameID = games.gameID "
            f"WHERE season in ({temp}) {filter_stats} GROUP BY name) "
            f'SELECT percentile_rank FROM PercentileRanks WHERE name = "{name}";'
        )

    try:
        cursor.execute(query)
        result = cursor.fetchone()[0]
        return round(1 - result, 5)
    except Exception as e:
        print(str(e))
        return 0


def lambda_handler(event, context):
    """Dispatch API Gateway requests to SQL query builders and return JSON."""
    res_body = {"time": {}}
    http_res = {}
    start_time = time.time()
    try:
        path = event["resource"].split("/")
        resource = path[1]
        stat = event["queryStringParameters"].get("stat", None)
        aggregate = (
            "sum"
            if stat == "games"
            else event["queryStringParameters"].get("agg", None)
        )

        if resource == "stats":
            computer = StatComputer(aggregate, event)
            query = computer.compute_Query()
            cursor.execute(query)
            result = cursor.fetchone()
            name = computer.getName()
            if name:
                res_body["name"] = name
                res_body["time"]["edit distance time"] = computer.getEditDistanceTime()
            res_body[f"{aggregate}_{stat}"] = float(result[0]) if result[0] else 0
            res_body["query"] = query

            season = event["multiValueQueryStringParameters"].get("season", None)
            filters = event["queryStringParameters"].get("filter", None)
            percentile_start = time.time()
            if name:
                res_body["percentile"] = compute_Percentile(
                    name, stat, season, aggregate, filters
                )
            else:
                res_body["percentile"] = 0
            res_body["time"]["percentile time"] = time.time() - percentile_start

        elif resource == "rank":
            computer = RankComputer(aggregate, event)
            query = computer.compute_Query()
            try:
                cursor.execute(query)
            except Exception as e:
                print(str(e))
            result = cursor.fetchall()

            res = []
            for row in result:
                res.append(
                    {
                        "name": row[0],
                        f"{aggregate}_{stat}": float(row[1]) if row[1] else 0,
                    }
                )

            res_body["result"] = res
            res_body["query"] = query

        elif resource == "games":
            computer = GameComputer(aggregate, event)
            query = computer.compute_Query()
            cursor.execute(query)
            result = cursor.fetchall()

            columns = [col_name[0] for col_name in cursor.description]
            name = computer.getName()
            if name:
                res_body["name"] = name
                res_body["time"]["edit distance time"] = computer.getEditDistanceTime()
            res_body["games"] = [dict(zip(columns, row)) for row in result]
            res_body["query"] = query

        elif resource == "players":
            name = event["queryStringParameters"].get("name", None)
            if name:
                res_body["player"] = {"name": name}
                query = f'SELECT * FROM players WHERE name="{name}"'
                cursor.execute(query)
                result = cursor.fetchone()
                cols = [
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
                ]
                for i, col in enumerate(cols):
                    res_body["player"][col] = result[i]

        http_res["statusCode"] = 200

    except Exception as e:
        print(f"Error handling route with exception: {e}")
        http_res["statusCode"] = 500
        http_res["error"] = str(e)

    res_body["time"]["total time"] = time.time() - start_time
    http_res["headers"] = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    }
    http_res["body"] = json.dumps(res_body, indent=4)

    return http_res
