#!/usr/bin/env bash
# suppress-print-statements.sh — Anti-pattern: print() over structlog
# Trigger: PreToolUse:Write/Edit
# Severity: WARNING (advisory)
#
# Detects use of print(), console.log(), fmt.Println() in application code
# when structured logging (structlog, pino, zerolog) is available.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Skip test files, scripts, and config
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  test_*|*_test.*|*.test.*|*.spec.*|conftest.py|setup.py|manage.py) exit 0 ;;
esac
case "$FILE_PATH" in
  */tests/*|*/test/*|*/__tests__/*|*/scripts/*|*/migrations/*) exit 0 ;;
esac

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ISSUES=()

# Python: detect print() when structlog is in deps
if [[ "$FILE_PATH" == *.py ]]; then
  HAS_STRUCTLOG=false
  for dep_file in "$PROJECT_DIR/pyproject.toml" "$PROJECT_DIR/requirements.txt"; do
    if [[ -f "$dep_file" ]] && grep -qi "structlog" "$dep_file" 2>/dev/null; then
      HAS_STRUCTLOG=true
      break
    fi
  done

  if [[ "$HAS_STRUCTLOG" == "true" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      line_num=$(echo "$line" | cut -d: -f1)
      line_content=$(echo "$line" | cut -d: -f2-)
      # Skip comments and docstrings
      if ! echo "$line_content" | grep -qE "^\s*(#|\"\"\"|\"|''')"; then
        ISSUES+=("print() at line $line_num -- use structlog instead")
      fi
    done < <(grep -nE "^\s*print\s*\(" "$FILE_PATH" 2>/dev/null | head -10)
  fi

  # Also check for logging.getLogger when structlog is available
  if [[ "$HAS_STRUCTLOG" == "true" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      line_num=$(echo "$line" | cut -d: -f1)
      ISSUES+=("logging.getLogger at line $line_num -- use structlog.get_logger() instead")
    done < <(grep -nE "logging\.getLogger" "$FILE_PATH" 2>/dev/null | head -5)
  fi
fi

# TypeScript/JavaScript: detect console.log when pino/winston is available
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]] || [[ "$FILE_PATH" == *.js ]] || [[ "$FILE_PATH" == *.jsx ]]; then
  HAS_LOGGER=false
  if [[ -f "$PROJECT_DIR/package.json" ]] && grep -qE '"(pino|winston|bunyan|structlog)"' "$PROJECT_DIR/package.json" 2>/dev/null; then
    HAS_LOGGER=true
  fi

  if [[ "$HAS_LOGGER" == "true" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      line_num=$(echo "$line" | cut -d: -f1)
      ISSUES+=("console.log at line $line_num -- use structured logger instead")
    done < <(grep -nE "console\.(log|warn|error|info|debug)\s*\(" "$FILE_PATH" 2>/dev/null | head -10)
  fi
fi

# Go: detect fmt.Println when zerolog/zap is available
if [[ "$FILE_PATH" == *.go ]]; then
  HAS_LOGGER=false
  if [[ -f "$PROJECT_DIR/go.mod" ]] && grep -qE "(zerolog|zap|logrus)" "$PROJECT_DIR/go.mod" 2>/dev/null; then
    HAS_LOGGER=true
  fi

  if [[ "$HAS_LOGGER" == "true" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      line_num=$(echo "$line" | cut -d: -f1)
      ISSUES+=("fmt.Print* at line $line_num -- use structured logger instead")
    done < <(grep -nE "fmt\.(Print|Println|Printf)\s*\(" "$FILE_PATH" 2>/dev/null | head -10)
  fi
fi

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "ANTI-PATTERN WARNING: Unstructured logging in $FILE_PATH" >&2
  echo "  Structured logging is available in project deps." >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
  echo "" >&2
  echo "  Python: import structlog; log = structlog.get_logger(); log.info('event', key=value)" >&2
  echo "  TypeScript: import logger from './logger'; logger.info({ key: value }, 'event')" >&2
  echo "  Go: log.Info().Str('key', value).Msg('event')" >&2
  # Advisory only
  exit 0
fi

exit 0
