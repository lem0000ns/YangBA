import json, time
from query_utilities import StatComputer, GameComputer, RankComputer, cursor, connection

def compute_Percentile(name, stat, season, agg, filters):
    #different types of stat
    if stat != "games":
        if stat == "3pct" or stat == "fgpct" or stat == "ftpct":
            convert = {'3pct': '3p', 'fgpct': 'fg', 'ftpct': 'ft'}
            temp1 = "sum(" + convert[stat] + "m)/sum(" + convert[stat] + "a)"
        else:
            temp1 = f"{agg}({stat})"
    else:
        temp1 = "COUNT(*)"
    
    #filters
    filterStats = ""
    if filters:
        filterStats = ' and '.join(filters.split(','))
    
    #accounting for seasons
    if season == None:
        if filters:
            filterStats = "WHERE " + filterStats
        query = f"WITH PercentileRanks AS (SELECT name, PERCENT_RANK() OVER (ORDER BY {temp1} DESC) AS percentile_rank FROM version2 INNER JOIN games ON version2.gameID = games.gameID {filterStats} GROUP BY name) SELECT percentile_rank FROM PercentileRanks WHERE name = \"{name}\";"
    else:
        temp = ",".join(season)
        if filters:
            filterStats = " AND " + filterStats
        query = f"WITH PercentileRanks AS (SELECT name, PERCENT_RANK() OVER (ORDER BY {temp1} DESC) AS percentile_rank FROM version2 INNER JOIN games ON version2.gameID = games.gameID WHERE season in ({temp}) {filterStats} GROUP BY name) SELECT percentile_rank FROM PercentileRanks WHERE name = \"{name}\";"
    
    #try executing percentile calculation, else 0
    try:
        cursor.execute(query)
        result = cursor.fetchone()[0]
        return round(1 - result, 5)
    except Exception as e:
        print(str(e))
        return 0

def lambda_handler(event, context):
    res_body = {'time': {}}
    http_res = {}
    startTime = time.time()
    try:
        path = event['resource'].split('/')
        resource = path[1]
        query = ""
        stat = event['queryStringParameters'].get('stat', None)
        aggregate = "sum" if stat == "games" else event['queryStringParameters'].get('agg', None)
        
        if resource == 'stats':
            test = StatComputer(aggregate, event)
            query = test.compute_Query()
            cursor.execute(query)
            result = cursor.fetchone()
            name = test.getName()
            if name:
                res_body['name'] = name
                res_body['time']['edit distance time'] = test.getEditDistanceTime()
            res_body[f'{aggregate}_{stat}'] = float(result[0]) if result[0]  else 0
            res_body['query'] = query
            
            season = event['multiValueQueryStringParameters'].get('season', None)
            filters = event['queryStringParameters'].get('filter', None)
            startTime = time.time()
            if name:
                res_body['percentile'] = compute_Percentile(name, stat, season, aggregate, filters)
            else:
                res_body['percentile'] = 0
            res_body['time']['percentile time'] = time.time() - startTime
            
        elif resource == 'rank':
            test = RankComputer(aggregate, event)
            query = test.compute_Query()
            try:
                cursor.execute(query)
            except Exception as e:
                print(str(e))
            result = cursor.fetchall()

            #converting non-Json serializable Decimal objects to float
            res = []
            cur = {}
            for row in result:
                cur['name'] = row[0]
                cur[f'{aggregate}_{stat}'] = float(row[1]) if row[1] else 0
                res.append(cur)
                cur = {}

            res_body['result'] = res
            res_body['query'] = query
        
        elif resource == 'games':
            test = GameComputer(aggregate, event)
            query = test.compute_Query()
            cursor.execute(query)
            result = cursor.fetchall()

            #combine column names with row values
            columns = [colName[0] for colName in cursor.description]
            name = test.getName()
            if name:
                res_body['name'] = name
                res_body['time']['edit distance time'] = test.getEditDistanceTime()
            res_body['games'] = [dict(zip(columns, row)) for row in result]
            res_body['query'] = query
        
        elif resource == 'players':
            name = event['queryStringParameters'].get('name', None)
            if name:
                res_body["player"] = {}
                res_body["player"]["name"] = name
                query = f"SELECT * FROM players WHERE name=\"{name}\""
                cursor.execute(query)
                result = cursor.fetchone()
                cols = ["playerID", "name", "pos", "born", "height", "weight", "high_school", "college", "draft", "career", "teams", "awards", "intro"]
                for i in range(len(cols)):
                    res_body["player"][cols[i]] = result[i]

        http_res['statusCode'] = 200
    
    except Exception as e:
        print(f"Error handling route with exception: {e}")
        http_res['statusCode'] = 500
        http_res['error'] = str(e)
    
    res_body['time']['total time'] = time.time() - startTime
    http_res['headers'] = {}
    http_res['headers']['Content-Type'] = "application/json"
    http_res['headers']['Access-Control-Allow-Origin'] = "*"
    http_res['body'] = json.dumps(res_body, indent=4)
    
    # return http_res
    return http_res

if __name__ == "__main__":
    print(lambda_handler({
        "resource": "/stats",
        "path": "/stats",
        "httpMethod": "GET",
        "headers": None,
        "multiValueHeaders": None,
        "queryStringParameters": {
            "agg": "avg",
            "stat": "points",
            "name": "stephen%20curry",
            "season": "2016"
        },
        "multiValueQueryStringParameters": {
            "agg": [
                "avg"
            ],
            "stat": [
                "points"
            ],
            "name": [
                "stephen%20curry"
            ],
            "season": [
                "2016"
            ]
        },
        "pathParameters": None,
        "stageVariables": None,
        "requestContext": {
            "resourceId": "4acfyx",
            "resourcePath": "/stats",
            "httpMethod": "GET",
            "extendedRequestId": "e23dTHdNyK4FtTw=",
            "requestTime": "29/Sep/2024:07:46:54 +0000",
            "path": "/stats",
            "accountId": "905418207209",
            "protocol": "HTTP/1.1",
            "stage": "test-invoke-stage",
            "domainPrefix": "testPrefix",
            "requestTimeEpoch": 1727596014490,
            "requestId": "b6811556-4afa-49ac-9da0-cad6958f0cd1",
            "identity": {
                "cognitoIdentityPoolId": None,
                "cognitoIdentityId": None,
                "apiKey": "test-invoke-api-key",
                "principalOrgId": None,
                "cognitoAuthenticationType": None,
                "userArn": "arn:aws:iam::905418207209:root",
                "apiKeyId": "test-invoke-api-key-id",
                "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "accountId": "905418207209",
                "caller": "905418207209",
                "sourceIp": "test-invoke-source-ip",
                "accessKey": "ASIA5FTZBN7UZAFKFXCZ",
                "cognitoAuthenticationProvider": None,
                "user": "905418207209"
            },
            "domainName": "testPrefix.testDomainName",
            "apiId": "vojed2b2fk"
        },
        "body": None,
        "isBase64Encoded": False
    }, 0))