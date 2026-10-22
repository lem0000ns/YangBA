#!/usr/bin/env bash
# Git push, routeHandler Lambda, and production frontend (S3 + CloudFront).
set -euo pipefail

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
  zip -j "$ZIP" routeHandler.py query_utilities.py
)

aws lambda update-function-code \
  --function-name routeHandler \
  --region "$AWS_REGION" \
  --zip-file "fileb://$ZIP"

aws lambda wait function-updated \
  --function-name routeHandler \
  --region "$AWS_REGION"

rm -f "$ZIP"

(
  cd "$FRONTEND"
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
echo "  lambda: routeHandler (${AWS_REGION})"
echo "  site: s3://${S3_BUCKET} -> CloudFront ${CLOUDFRONT_ID} (invalidation ${invalidation_id})"
