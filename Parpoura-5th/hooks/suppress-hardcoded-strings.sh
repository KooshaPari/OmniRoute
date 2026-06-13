#!/usr/bin/env bash
# suppress-hardcoded-strings.sh — Anti-pattern: hardcoded provider/service strings
# Trigger: PreToolUse:Write/Edit
# Severity: WARNING (advisory)
#
# Detects hardcoded provider names, API endpoints, model names, and service
# identifiers that should be config-driven or use a registry pattern.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only check source code files
case "$FILE_PATH" in
  *.py|*.ts|*.tsx|*.js|*.jsx|*.go|*.rs) ;;
  *) exit 0 ;;
esac

# Skip test files and config files
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  test_*|*_test.*|*.test.*|*.spec.*|conftest.py) exit 0 ;;
esac
case "$FILE_PATH" in
  */tests/*|*/test/*|*/__tests__/*) exit 0 ;;
esac

ISSUES=()
LINE_REFS=()

# Pattern 1: Hardcoded LLM model names
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  line_num=$(echo "$line" | cut -d: -f1)
  ISSUES+=("Hardcoded model name at line $line_num")
  LINE_REFS+=("$line")
done < <(grep -nE '"(gpt-[0-9]|claude-[0-9]|gemini-[0-9]|llama-[0-9]|mistral-[0-9]|o[0-9]-|deepseek)' "$FILE_PATH" 2>/dev/null | head -5)

# Pattern 2: Hardcoded API base URLs
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  line_num=$(echo "$line" | cut -d: -f1)
  ISSUES+=("Hardcoded API URL at line $line_num")
  LINE_REFS+=("$line")
done < <(grep -nE '"https?://(api\.|.*\.openai\.com|.*\.anthropic\.com|.*\.googleapis\.com)' "$FILE_PATH" 2>/dev/null | head -5)

# Pattern 3: Hardcoded cloud provider references in business logic
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  line_num=$(echo "$line" | cut -d: -f1)
  # Skip imports and comments
  line_content=$(echo "$line" | cut -d: -f2-)
  if ! echo "$line_content" | grep -qE "^\s*(#|//|/\*|import|from)"; then
    ISSUES+=("Hardcoded provider at line $line_num")
    LINE_REFS+=("$line")
  fi
done < <(grep -nE '"\s*(aws|gcp|azure|openai|anthropic|google|vercel|supabase|firebase)\s*"' "$FILE_PATH" 2>/dev/null | head -5)

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "ANTI-PATTERN WARNING: Hardcoded strings in $FILE_PATH" >&2
  echo "  Hardcoded provider/model/URL strings should be config-driven." >&2
  for i in "${!ISSUES[@]}"; do
    echo "  - ${ISSUES[$i]}" >&2
    echo "    ${LINE_REFS[$i]}" >&2
  done
  echo "" >&2
  echo "  Suggested patterns:" >&2
  echo "    Python: Use pydantic-settings with env vars" >&2
  echo "    TypeScript: Use process.env or config module" >&2
  echo "    Go: Use os.Getenv or config struct" >&2
  # Advisory only
  exit 0
fi

exit 0
