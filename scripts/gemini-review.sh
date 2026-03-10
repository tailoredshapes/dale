#!/usr/bin/env bash
set -euo pipefail

# Gemini QA/BA review — compares .feature files against implementation diff

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "ERROR: GEMINI_API_KEY is not set"
  exit 1
fi

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

# Truncate diff to ~80k chars
DIFF="${DIFF:0:80000}"

# Build Gemini API request
PROMPT="You are a QA/BA reviewer. Given these Gherkin feature files and this implementation diff, does the implementation correctly satisfy the scenarios? List any scenarios that are broken, missing, or incorrectly implemented. Be specific and terse. If everything looks correct, respond with exactly: LGTM

=== FEATURE FILES ===
$FEATURES
=== IMPLEMENTATION DIFF ===
$DIFF"

# Escape for JSON
PROMPT_JSON=$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

PAYLOAD=$(cat <<ENDJSON
{
  "contents": [{"parts": [{"text": $PROMPT_JSON}]}],
  "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048}
}
ENDJSON
)

API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}"

echo "Sending review request to Gemini..."
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "ERROR: Gemini API returned HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

# Extract response text
REVIEW=$(echo "$BODY" | python3 -c '
import json, sys
data = json.load(sys.stdin)
try:
    print(data["candidates"][0]["content"]["parts"][0]["text"])
except (KeyError, IndexError):
    print("ERROR: unexpected response structure")
    sys.exit(1)
')

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
if echo "$TRIMMED" | grep -iq '^lgtm$'; then
  echo "✅ Review passed"
  exit 0
else
  echo "❌ Review found issues — failing pipeline"
  exit 1
fi
