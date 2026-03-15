#!/usr/bin/env bash
# Bundle Node.js Lambda functions for Terraform deployment.
# Produces zip files in dist/{name}/{name}.zip
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

mkdir -p dist

# Lambda definitions: name|entry_point
LAMBDAS=(
  "telegram|src/telegram/webhook.ts"
  "stripe|src/stripe/webhook.ts"
  "paypal|src/paypal/webhook.ts"
  "admin|src/admin/api.ts"
)

for spec in "${LAMBDAS[@]}"; do
  IFS='|' read -r name entry <<< "$spec"
  echo "Bundling $name from $entry..."

  rm -rf "dist/$name"
  mkdir -p "dist/$name"

  # Bundle with esbuild — externalize AWS SDK (provided by Lambda runtime)
  npx esbuild "$entry" \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=esm \
    --outfile="dist/$name/index.mjs" \
    --external:@aws-sdk/* \
    --external:@smithy/*

  # Create package.json with ESM type
  echo '{"type":"module"}' > "dist/$name/package.json"

  # Create zip
  (cd "dist/$name" && zip -r "../$name/$name.zip" .)
  echo "  -> dist/$name/$name.zip"
done

echo "All lambdas bundled."
