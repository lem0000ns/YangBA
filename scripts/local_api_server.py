#!/usr/bin/env python3
"""Minimal local HTTP server wrapping routeHandler for frontend dev (VITE_API_BASE_URL)."""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "yba-backend"))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

import common.load_env  # noqa: E402,F401  repo-root .env before MySQL/S3 imports
from ask import lambda_handler as ask_handler  # noqa: E402
from routeHandler import lambda_handler  # noqa: E402

PORT = int(os.environ.get("YBA_LOCAL_API_PORT", "8765"))


class YangBAHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(format % args)

    def _write(self, result):
        body = result.get("body", "{}")
        status = result.get("statusCode", 500)
        headers = result.get("headers") or {}
        self.send_response(status)
        self.send_header("Content-Type", headers.get("Content-Type", "application/json"))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8") if isinstance(body, str) else json.dumps(body).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        resource = parts[0] if parts else "stats"
        flat_qs = parse_qs(parsed.query, keep_blank_values=True)
        query = {k: v[0] for k, v in flat_qs.items()}
        multi = {k: v for k, v in flat_qs.items()}

        event = {
            "resource": f"/{resource}",
            "path": f"/{resource}",
            "httpMethod": "GET",
            "queryStringParameters": query or None,
            "multiValueQueryStringParameters": multi or None,
        }
        self._write(lambda_handler(event, None))

    def do_POST(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        resource = parts[0] if parts else ""
        if resource != "ask":
            self._write(
                {
                    "statusCode": 404,
                    "body": json.dumps({"ok": False, "error": "Not found."}),
                }
            )
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else ""
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._write(
                {
                    "statusCode": 400,
                    "body": json.dumps({"ok": False, "error": "The request body must be JSON."}),
                }
            )
            return
        if not isinstance(payload, dict):
            self._write(
                {
                    "statusCode": 400,
                    "body": json.dumps({"ok": False, "error": "The request body must be JSON."}),
                }
            )
            return
        self._write(ask_handler({"body": raw, "isBase64Encoded": False}, None))


def main():
    if not os.getenv("SECRETS_MANAGER_CONTRASENA"):
        print("Warning: SECRETS_MANAGER_CONTRASENA not set (MySQL connection may fail)")
    server = HTTPServer(("127.0.0.1", PORT), YangBAHandler)
    print(f"YangBA local API http://127.0.0.1:{PORT}/  (stats|games|rank|players|ask)")
    server.serve_forever()


if __name__ == "__main__":
    main()
