#!/usr/bin/env bash
# Deploy admin/consumer/creator SPAs with runtime config.js injected from CDK outputs.
# Usage: ./scripts/deploy-sub-apps.sh <cdk-outputs.json> <cognito-client-id>
set -euo pipefail

OUTPUTS_FILE="${1:-cdk-outputs.json}"
COGNITO_CLIENT_ID="${2:-$COGNITO_CLIENT_ID}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

get_out() {
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])).get('Dale-Prod',{}); print(d.get(sys.argv[2],''))" \
    "$OUTPUTS_FILE" "$1"
}

ADMIN_API_URL=$(get_out AdminApiUrl)
COGNITO_DOMAIN=dale-prod-890764614009.auth.us-east-1.amazoncognito.com

declare -A REDIRECTS=(
  [admin]="https://dale-admin.poundit.co.uk/auth"
  [consumer]="https://dalegram.com/auth"
  [creator]="https://dalegram.com/auth"
)

for app in admin consumer creator; do
  APP_U="${app^}"
  BUCKET=$(get_out "${APP_U}BucketName")
  DIST_ID=$(get_out "${APP_U}DistributionId")

  if [ -z "$BUCKET" ]; then
    echo "⚠️  No bucket for $app, skipping"
    continue
  fi

  echo "🔨 Building $app..."
  cd "$ROOT_DIR/web/$app"
  npm ci --silent
  npm run build
  cd "$ROOT_DIR"

  echo "⚙️  Generating runtime config.js for $app..."
  cat > "$ROOT_DIR/web/$app/dist/config.js" <<CONFIGEOF
window.DALE_CONFIG = {
  apiUrl: '${ADMIN_API_URL}',
  cognitoDomain: '${COGNITO_DOMAIN}',
  cognitoClientId: '${COGNITO_CLIENT_ID}',
  redirectUri: '${REDIRECTS[$app]}',
};
CONFIGEOF

  echo "🚀 Deploying $app to s3://$BUCKET..."
  aws s3 sync "$ROOT_DIR/web/$app/dist/" "s3://$BUCKET/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" --exclude "config.js"

  aws s3 cp "$ROOT_DIR/web/$app/dist/index.html" "s3://$BUCKET/index.html" \
    --cache-control "no-cache, no-store, must-revalidate"

  aws s3 cp "$ROOT_DIR/web/$app/dist/config.js" "s3://$BUCKET/config.js" \
    --cache-control "no-cache, no-store, must-revalidate"

  if [ -n "$DIST_ID" ]; then
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --output text > /dev/null
    echo "✅ $app deployed + CloudFront invalidated ($DIST_ID)"
  else
    echo "✅ $app deployed (no distribution ID found)"
  fi
done

echo "🎉 Sub-app deployment complete"
