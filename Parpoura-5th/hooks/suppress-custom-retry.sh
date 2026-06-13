#!/usr/bin/env bash
# suppress-custom-retry.sh — Anti-pattern: custom retry loops when tenacity is available
# Trigger: PreToolUse:Write/Edit
# Severity: WARNING (advisory)
#
# Detects hand-rolled retry/backoff loops in Python code when tenacity is a declared dependency.
# Pattern: for/while loops with sleep + try/except that implement retry logic.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" != *.py ]] && exit 0

# Check if tenacity is in project dependencies
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HAS_TENACITY=false
for dep_file in "$PROJECT_DIR/pyproject.toml" "$PROJECT_DIR/requirements.txt" "$PROJECT_DIR/setup.py" "$PROJECT_DIR/setup.cfg"; do
  if [[ -f "$dep_file" ]] && grep -qi "tenacity" "$dep_file" 2>/dev/null; then
    HAS_TENACITY=true
    break
  fi
done

[[ "$HAS_TENACITY" == "false" ]] && exit 0

# Detect custom retry patterns
ISSUES=()

# Pattern 1: for loop with sleep inside try/except
if grep -nE "for\s+\w+\s+in\s+range\(" "$FILE_PATH" 2>/dev/null | head -5 | while IFS= read -r match_line; do
  line_num=$(echo "$match_line" | cut -d: -f1)
  # Check surrounding 10 lines for sleep + except
  context=$(sed -n "$((line_num)),$((line_num + 15))p" "$FILE_PATH" 2>/dev/null)
  if echo "$context" | grep -q "sleep" && echo "$context" | grep -q "except"; then
    echo "true"
  fi
done | grep -q "true"; then
  ISSUES+=("Custom retry loop with sleep detected")
fi

# Pattern 2: while True with attempt counter
if grep -nE "while\s+(True|attempt|retries|tries)" "$FILE_PATH" 2>/dev/null | head -5 | while IFS= read -r match_line; do
  line_num=$(echo "$match_line" | cut -d: -f1)
  context=$(sed -n "$((line_num)),$((line_num + 15))p" "$FILE_PATH" 2>/dev/null)
  if echo "$context" | grep -q "sleep" && echo "$context" | grep -qE "(except|try)"; then
    echo "true"
  fi
done | grep -q "true"; then
  ISSUES+=("While loop retry pattern detected")
fi

# Pattern 3: exponential backoff reimplementation
if grep -nE "(2\s*\*\*\s*attempt|backoff|exponential.*retry)" "$FILE_PATH" 2>/dev/null; then
  ISSUES+=("Manual exponential backoff detected")
fi

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "ANTI-PATTERN WARNING: Custom retry in $FILE_PATH" >&2
  echo "  tenacity is in project dependencies — use @retry decorator instead." >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
  echo "  Suggested fix:" >&2
  echo "    from tenacity import retry, stop_after_attempt, wait_exponential" >&2
  echo "    @retry(stop=stop_after_attempt(5), wait=wait_exponential())" >&2
  echo "    def your_function():" >&2
  echo "        ..." >&2
  # Advisory only — do not block
  exit 0
fi

exit 0
