#!/usr/bin/env bash
# API-Sports backfill: 2023-24, 2024-25, 2025-26 (not the current in-progress season).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/yba-backend"
cd "$BACKEND"

if [[ -z "${API_SPORTS_KEY:-}" ]]; then
  echo "Set API_SPORTS_KEY before running." >&2
  exit 1
fi
if [[ -z "${SECRETS_MANAGER_CONTRASENA:-}" ]]; then
  echo "Set SECRETS_MANAGER_CONTRASENA before running." >&2
  exit 1
fi

VENV="$BACKEND/.venv"
PY="$VENV/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Creating virtualenv at $VENV"
  rm -rf "$VENV"
  python3 -m venv "$VENV"
fi

# Always use the venv interpreter (not system pip3 — Homebrew is PEP 668 managed).
"$PY" -m pip install -q --upgrade pip
"$PY" -m pip install -q -r requirements.txt

# Full 3-season reload (2023-24..2025-26):  ./scripts/run_backfill.sh --force
# --season 2023  only that API year (2023-24); does not truncate other seasons
# --force        full backfill: truncate RDS + re-fetch all target seasons (use for complete reset)
# --mysql-only   load existing S3 files into RDS (no API calls)
# --sequential   one season at a time (default: parallel, one thread per season)
# --verify       S3/RDS/API game coverage check only (no ingest)
exec "$PY" dataDump.py "$@"
