"""API Gateway entry for natural-language questions. Not in the VPC."""

import base64
import json

from query.nl_pages import ask


def lambda_handler(event, context):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    text = payload.get("text", "") if isinstance(payload, dict) else ""
    page = payload.get("page", "stats") if isinstance(payload, dict) else "stats"
    status, result = ask(text if isinstance(text, str) else "", page if isinstance(page, str) else "stats")
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(result),
    }
