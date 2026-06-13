#!/usr/bin/env bash
# suppress-v2-files.sh — Anti-pattern: *_v2.*, *_new.*, *_old.* files
# Trigger: PreToolUse:Write/Edit
# Severity: ERROR (blocking)
#
# Blocks creation of v2/new/old/backup file variants. The pattern of creating
# _v2 files instead of refactoring the original leads to code duplication,
# stale copies, and import confusion.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

BASENAME=$(basename "$FILE_PATH")

# Check for v2/new/old/backup patterns in filename (before extension)
# Match: foo_v2.py, bar_new.ts, baz_old.go, qux_backup.sh, widget_V3.py
if echo "$BASENAME" | grep -qiE "_(v[0-9]+|new|old|backup|copy|original|temp|tmp)\.[^.]+$"; then
  PATTERN=$(echo "$BASENAME" | grep -oiE "_(v[0-9]+|new|old|backup|copy|original|temp|tmp)\." | tr -d '.')
  echo "ANTI-PATTERN BLOCKED: v2-style file detected" >&2
  echo "  File: $FILE_PATH" >&2
  echo "  Pattern: $PATTERN" >&2
  echo "  Rule: Never create _v2/_new/_old files. Refactor the original instead." >&2
  echo "" >&2
  echo "  Fix options:" >&2
  echo "    1. Modify the original file directly" >&2
  echo "    2. If backward compat needed, use feature flags or interface versioning" >&2
  echo "    3. If migrating, rename the original and update all imports" >&2
  echo "" >&2
  echo "SUPPRESS-V2-FILES FAIL: $BASENAME uses forbidden naming pattern ($PATTERN)" >&2
  exit 1
fi

# Also check for numbered copies: foo2.py, bar3.ts (but not legitimate names like python3)
if echo "$BASENAME" | grep -qE "^[a-z_]+[0-9]+\.[^.]+$"; then
  # Exclude legitimate patterns (e.g., python3, utf8, base64, sha256)
  if ! echo "$BASENAME" | grep -qiE "(python[0-9]|utf[0-9]|base[0-9]|sha[0-9]|md[0-9]|crc[0-9]|aes[0-9]|rsa[0-9]|config[0-9])"; then
    echo "ANTI-PATTERN WARNING: Possible numbered copy detected" >&2
    echo "  File: $FILE_PATH" >&2
    echo "  If this is a v2 copy, refactor the original instead." >&2
    # Advisory only for numbered files (may be legitimate)
    exit 0
  fi
fi

exit 0
