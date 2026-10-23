#!/usr/bin/env bash
# Full reset + 3-season backfill (2023-24 .. 2025-26):
#   - Truncates games, version2, players on RDS
#   - Clears S3 ETL checkpoint; re-fetches API years 2023, 2024, 2025 (parallel)
#   - Full names via /players?id=; sync_all_names; Wikipedia+API profiles (namesToSQL)
#   - Post-run verify for all target seasons
#
# Requires: API_SPORTS_KEY, SECRETS_MANAGER_CONTRASENA
# Optional: YBA_WIKIPEDIA_PROFILES=0 to skip Wikipedia (API profiles only)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/run_backfill.sh" --force
