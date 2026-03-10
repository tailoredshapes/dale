#!/usr/bin/env bash
set -euo pipefail

# Gemini QA/BA review — pipes feature files + diff into the gemini CLI (no API key needed)

# Collect feature files (skip node_modules)
FEATURE_FILES=$(find . -name '*.feature' -not -path '*/node_modules/*' 2>/dev/null || true)

if [ -z "$FEATURE_FILES" ]; then
  echo "No .feature files found — skipping review"
  exit 0
fi

# Build feature content (truncate to ~80k chars to stay under context limits)
FEATURES=""
for f in $FEATURE_FILES; do
  FEATURES+="--- $f ---"$'\n'
  FEATURES+="$(cat "$f")"$'\n\n'
done
FEATURES="${FEATURES:0:80000}"

# Get diff against base
BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-origin/main}"
DIFF=$(git diff "$BASE" -- '*.ts' '*.tsx' '*.js' '*.rs' '*.yml' '*.yaml' '*.json' ':!package-lock.json' ':!**/package-lock.json' 2>/dev/null || true)

if [ -z "$DIFF" ]; then
  echo "No implementation changes detected — skipping review"
  exit 0
fi

# Write feature files and diff to temp files for gemini CLI
TMPDIR_REVIEW=$(mktemp -d)
trap 'rm -rf "$TMPDIR_REVIEW"' EXIT

FEATURES_FILE="$TMPDIR_REVIEW/features.txt"
DIFF_FILE="$TMPDIR_REVIEW/diff.txt"

printf '%s' "$FEATURES" > "$FEATURES_FILE"
printf '%s' "${DIFF:0:80000}" > "$DIFF_FILE"

echo "Sending review request to Gemini CLI..."

PROMPT="You are a QA/BA reviewer. Given these Gherkin feature files (@${FEATURES_FILE}) and this implementation diff (@${DIFF_FILE}), does the implementation correctly satisfy the scenarios? List any scenarios that are broken, missing, or incorrectly implemented. Be specific and terse. If everything looks correct, respond with exactly: LGTM"

# Run as tmarsh who has gemini credentials; unset OpenClaw workspace env vars to avoid path issues
REVIEW=$(sudo -u tmarsh env HOME=/home/tmarsh GEMINI_CLI_IDE_WORKSPACE_PATH= gemini "$PROMPT" 2>&1)

echo "=== Gemini QA Review ==="
echo "$REVIEW"
echo "========================"

# Post as MR comment if in merge request context
if [ -n "${CI_MERGE_REQUEST_IID:-}" ] && [ -n "${CI_PROJECT_ID:-}" ]; then
  COMMENT="### 🤖 Gemini QA Review"$'\n\n'"$REVIEW"
  COMMENT_JSON=$(printf '%s' "$COMMENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  curl -s -X POST \
    "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${CI_MERGE_REQUEST_IID}/notes" \
    -H "JOB-TOKEN: ${CI_JOB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"body\": $COMMENT_JSON}" > /dev/null
  echo "Posted review as MR comment"
fi

# Check verdict
TRIMMED=$(echo "$REVIEW" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
if echo "$TRIMMED" | grep -iq 'lgtm'; then
  echo "✅ Review passed"
  exit 0
else
  echo "❌ Review found issues — failing pipeline"
  exit 1
fi
