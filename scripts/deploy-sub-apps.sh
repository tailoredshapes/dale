#!/usr/bin/env bash
# Deploy admin/consumer/creator SPAs with runtime config.js injected from Terraform outputs.
# Usage: ./scripts/deploy-sub-apps.sh <cognito-client-id>
set -euo pipefail

COGNITO_CLIENT_ID="${1:-$COGNITO_CLIENT_ID}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$ROOT_DIR/terraform"

get_out() {
  terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || echo ""
}

ADMIN_API_URL="https://api.dalegram.com"
COGNITO_DOMAIN=dale-prod-890764614009.auth.us-east-1.amazoncognito.com

declare -A REDIRECTS=(
  [admin]="https://dale-admin.poundit.co.uk/auth"
  [consumer]="https://dalegram.com/auth"
  [creator]="https://dalegram.com/auth"
)

for app in admin consumer creator; do
  APP_U="${app^}"
  BUCKET=$(get_out "${app}_bucket_name")
  DIST_ID=$(get_out "${app}_distribution_id")

  if [ -z "$BUCKET" ]; then
    echo "Warning: No bucket for $app, skipping"
    continue
  fi

  echo "Building $app..."
  cd "$ROOT_DIR/web/$app"
  npm ci --silent
  npm run build
  cd "$ROOT_DIR"

  echo "Generating runtime config.js for $app..."
  cat > "$ROOT_DIR/web/$app/dist/config.js" <<CONFIGEOF
window.DALE_CONFIG = {
  apiUrl: '${ADMIN_API_URL}',
  cognitoDomain: '${COGNITO_DOMAIN}',
  cognitoClientId: '${COGNITO_CLIENT_ID}',
  redirectUri: '${REDIRECTS[$app]}',
};
CONFIGEOF

  echo "Deploying $app to s3://$BUCKET..."
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
    echo "$app deployed + CloudFront invalidated ($DIST_ID)"
  else
    echo "$app deployed (no distribution ID found)"
  fi
done

echo "Sub-app deployment complete"
