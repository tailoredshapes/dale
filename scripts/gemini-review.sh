#!/usr/bin/env bash
set -euo pipefail

# Gemini QA/BA review — pipes feature files + diff into the gemini CLI (no API key needed)
# Must run from the project root (not from OpenClaw workspace) so gemini doesn't inherit
# a non-existent PWD and add it to projects.json
cd "$(git rev-parse --show-toplevel)"

# Collect feature files (skip node_modules)
FEATURE_FILES=$(find . -name '*.feature' -not -path '*/node_modules/*' 2>/dev/null || true)

if [ -z "$FEATURE_FILES" ]; then
  echo "No .feature files found — skipping review"
  exit 0
fi

# Build feature content (truncate to ~60k chars to stay under context limits)
FEATURES=""
for f in $FEATURE_FILES; do
  FEATURES+="--- $f ---"$'\n'
  FEATURES+="$(cat "$f")"$'\n\n'
done
FEATURES="${FEATURES:0:60000}"

# Get diff against base (implementation files only)
BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-origin/main}"
DIFF=$(git diff "$BASE" -- '*.ts' '*.tsx' '*.js' '*.rs' '*.yml' '*.yaml' '*.json' \
  ':!package-lock.json' ':!**/package-lock.json' 2>/dev/null || true)

if [ -z "$DIFF" ]; then
  echo "No implementation changes detected — skipping review"
  exit 0
fi

DIFF="${DIFF:0:40000}"

echo "Sending review request to Gemini CLI..."

# Pipe content directly to gemini via stdin — avoids @file resolution issues
REVIEW=$(printf '%s\n\n%s\n\n%s' \
  "=== GHERKIN FEATURE FILES ===" \
  "$FEATURES" \
  "=== IMPLEMENTATION DIFF ===$DIFF" \
  | gemini "You are a QA/BA reviewer. Given the Gherkin feature files and implementation diff provided in stdin, does the implementation correctly satisfy the scenarios? List any scenarios that are broken, missing, or incorrectly implemented. Be specific and terse. If everything looks correct, respond with exactly: LGTM" 2>&1)

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
if echo "$REVIEW" | grep -iq '^lgtm$\|^lgtm[[:space:]]*$'; then
  echo "✅ Review passed"
  exit 0
else
  echo "❌ Review found issues — failing pipeline"
  exit 1
fi
