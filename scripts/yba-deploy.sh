#!/usr/bin/env bash
# Git push, routeHandler and askHandler Lambdas, and production frontend (S3 + CloudFront).
set -euo pipefail

export AWS_PAGER=""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/yba-frontend"
BACKEND="$ROOT/yba-backend"

S3_BUCKET="yangba.net"
AWS_REGION="us-west-1"
CLOUDFRONT_ID="E30O7MBF2BTRPG"

MSG="${1:-Deploy YangBA}"

cd "$ROOT"

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
fi

current_branch="$(git branch --show-current)"
git push -u origin "${current_branch}"

ZIP="$BACKEND/routeHandler.zip"
rm -f "$ZIP"
(
  cd "$BACKEND"
  zip -r "$ZIP" \
    routeHandler.py \
    query/__init__.py \
    query/routeHandler.py \
    query/query_utilities.py \
    -x '*__pycache__*' '*.pyc'
)

aws lambda update-function-code \
  --function-name routeHandler \
  --region "$AWS_REGION" \
  --zip-file "fileb://$ZIP"

aws lambda wait function-updated \
  --function-name routeHandler \
  --region "$AWS_REGION"

rm -f "$ZIP"

ASK_ZIP="$BACKEND/askHandler.zip"
rm -f "$ASK_ZIP"
(
  cd "$BACKEND"
  zip -r "$ASK_ZIP" \
    ask.py \
    query/__init__.py \
    query/nl_stats.py \
    query/nl_pages.py \
    common/__init__.py \
    common/load_env.py \
    data/allNames.txt \
    -x '*__pycache__*' '*.pyc'
)

aws lambda update-function-code \
  --function-name askHandler \
  --region "$AWS_REGION" \
  --zip-file "fileb://$ASK_ZIP"

aws lambda wait function-updated \
  --function-name askHandler \
  --region "$AWS_REGION"

rm -f "$ASK_ZIP"

(
  cd "$FRONTEND"
  # Shell vars win over .env files. Keep a dev .env.local from replacing the API Gateway URL.
  VITE_API_BASE_URL="https://vojed2b2fk.execute-api.us-west-1.amazonaws.com/dev/" \
    npm run build
  aws s3 sync ./dist "s3://${S3_BUCKET}" --region "$AWS_REGION" --delete
)

invalidation_id="$(
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text
)"

echo "yba-deploy complete:"
echo "  git: origin/${current_branch}"
echo "  lambda: routeHandler, askHandler (${AWS_REGION})"
echo "  site: s3://${S3_BUCKET} -> CloudFront ${CLOUDFRONT_ID} (invalidation ${invalidation_id})"
