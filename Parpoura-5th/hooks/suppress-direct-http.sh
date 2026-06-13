#!/usr/bin/env bash
# suppress-direct-http.sh — Anti-pattern: direct requests/httpx calls without abstraction
# Trigger: PreToolUse:Write/Edit
# Severity: WARNING (advisory)
#
# Detects direct HTTP client usage (requests.get, httpx.get, fetch, http.Get)
# in business logic instead of using a dedicated API client or service layer.
# Direct calls scatter URL construction, auth, retries, and error handling.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only check source code files
case "$FILE_PATH" in
  *.py|*.ts|*.tsx|*.js|*.jsx|*.go) ;;
  *) exit 0 ;;
esac

# Skip files that ARE the HTTP client abstraction
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  *client*|*http*|*api_client*|*fetcher*|*transport*|*adapter*) exit 0 ;;
esac
case "$FILE_PATH" in
  */clients/*|*/adapters/*|*/infrastructure/*|*/transport/*) exit 0 ;;
  */tests/*|*/test/*|*/__tests__/*) exit 0 ;;
esac

ISSUES=()

# Python: direct requests/httpx usage
if [[ "$FILE_PATH" == *.py ]]; then
  # Detect requests.get/post/put/delete/patch
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    ISSUES+=("requests.* call at line $line_num")
  done < <(grep -nE "requests\.(get|post|put|delete|patch|head|options)\s*\(" "$FILE_PATH" 2>/dev/null | head -5)

  # Detect httpx.get/post/etc (direct, not via injected client)
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    line_content=$(echo "$line" | cut -d: -f2-)
    # Skip if it's self.client.get or client.get (abstracted usage)
    if ! echo "$line_content" | grep -qE "(self\.\w+|client)\.(get|post|put|delete|patch)"; then
      ISSUES+=("httpx.* call at line $line_num")
    fi
  done < <(grep -nE "httpx\.(get|post|put|delete|patch|head|options|AsyncClient|Client)\s*\(" "$FILE_PATH" 2>/dev/null | head -5)

  # Detect urllib usage
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    ISSUES+=("urllib call at line $line_num")
  done < <(grep -nE "urllib\.(request|parse)\.url" "$FILE_PATH" 2>/dev/null | head -3)
fi

# TypeScript/JavaScript: direct fetch usage
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]] || [[ "$FILE_PATH" == *.js ]] || [[ "$FILE_PATH" == *.jsx ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    line_content=$(echo "$line" | cut -d: -f2-)
    # Skip if it's this.fetch or client.fetch
    if ! echo "$line_content" | grep -qE "(this|client|api)\.(fetch|get|post)"; then
      ISSUES+=("Direct fetch() at line $line_num")
    fi
  done < <(grep -nE "^\s*(await\s+)?fetch\s*\(" "$FILE_PATH" 2>/dev/null | head -5)

  # Detect axios direct usage
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    ISSUES+=("Direct axios call at line $line_num")
  done < <(grep -nE "axios\.(get|post|put|delete|patch)\s*\(" "$FILE_PATH" 2>/dev/null | head -5)
fi

# Go: direct http.Get/Post usage
if [[ "$FILE_PATH" == *.go ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line_num=$(echo "$line" | cut -d: -f1)
    ISSUES+=("Direct http.* call at line $line_num")
  done < <(grep -nE "http\.(Get|Post|Head|PostForm|NewRequest)\s*\(" "$FILE_PATH" 2>/dev/null | head -5)
fi

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "ANTI-PATTERN WARNING: Direct HTTP calls in $FILE_PATH" >&2
  echo "  HTTP calls should go through a dedicated client/adapter layer." >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
  echo "" >&2
  echo "  Suggested pattern:" >&2
  echo "    1. Create a client class in clients/ or adapters/" >&2
  echo "    2. Inject the client via constructor/dependency injection" >&2
  echo "    3. Centralize auth, retries, timeouts, and base URL in the client" >&2
  echo "    4. Business logic calls client methods, not raw HTTP" >&2
  # Advisory only
  exit 0
fi

exit 0
