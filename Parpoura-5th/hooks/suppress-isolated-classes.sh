#!/usr/bin/env bash
# suppress-isolated-classes.sh — Anti-pattern: God classes / isolated oversized classes
# Trigger: PreToolUse:Write/Edit
# Severity: WARNING (advisory)
#
# Detects classes with too many methods (>15) or too many lines (>300),
# which are signs of God classes that should be decomposed.
set -euo pipefail

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

MAX_METHODS=15
MAX_CLASS_LINES=300

ISSUES=()

# Python: count class methods
if [[ "$FILE_PATH" == *.py ]]; then
  # Find all class definitions and count their methods
  current_class=""
  method_count=0
  class_start=0
  line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    # New class definition (top-level, not nested)
    if echo "$line" | grep -qE "^class\s+\w+"; then
      # Report previous class if over limit
      if [[ -n "$current_class" ]] && [[ "$method_count" -gt "$MAX_METHODS" ]]; then
        ISSUES+=("Class '$current_class' (line $class_start) has $method_count methods (max: $MAX_METHODS)")
      fi
      if [[ -n "$current_class" ]]; then
        class_lines=$((line_num - class_start))
        if [[ "$class_lines" -gt "$MAX_CLASS_LINES" ]]; then
          ISSUES+=("Class '$current_class' (line $class_start) is $class_lines lines (max: $MAX_CLASS_LINES)")
        fi
      fi
      current_class=$(echo "$line" | grep -oE "class\s+\w+" | sed 's/class //')
      method_count=0
      class_start=$line_num
    fi
    # Count methods (def inside class, indented)
    if [[ -n "$current_class" ]] && echo "$line" | grep -qE "^\s+def\s+\w+"; then
      method_count=$((method_count + 1))
    fi
  done < "$FILE_PATH"

  # Check last class
  if [[ -n "$current_class" ]] && [[ "$method_count" -gt "$MAX_METHODS" ]]; then
    ISSUES+=("Class '$current_class' (line $class_start) has $method_count methods (max: $MAX_METHODS)")
  fi
  if [[ -n "$current_class" ]]; then
    class_lines=$((line_num - class_start))
    if [[ "$class_lines" -gt "$MAX_CLASS_LINES" ]]; then
      ISSUES+=("Class '$current_class' (line $class_start) is $class_lines lines (max: $MAX_CLASS_LINES)")
    fi
  fi
fi

# TypeScript/JavaScript: count class methods
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]] || [[ "$FILE_PATH" == *.js ]] || [[ "$FILE_PATH" == *.jsx ]]; then
  current_class=""
  method_count=0
  class_start=0
  brace_depth=0
  in_class=false
  line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    # Class definition
    if echo "$line" | grep -qE "^(export\s+)?(abstract\s+)?class\s+\w+"; then
      if [[ "$in_class" == "true" ]] && [[ "$method_count" -gt "$MAX_METHODS" ]]; then
        ISSUES+=("Class '$current_class' (line $class_start) has $method_count methods (max: $MAX_METHODS)")
      fi
      current_class=$(echo "$line" | grep -oE "class\s+\w+" | sed 's/class //')
      method_count=0
      class_start=$line_num
      in_class=true
    fi
    # Count methods (rough heuristic: lines with method-like patterns)
    if [[ "$in_class" == "true" ]]; then
      if echo "$line" | grep -qE "^\s+(public|private|protected|static|async|get|set)?\s*\w+\s*\("; then
        method_count=$((method_count + 1))
      fi
    fi
  done < "$FILE_PATH"

  if [[ "$in_class" == "true" ]] && [[ "$method_count" -gt "$MAX_METHODS" ]]; then
    ISSUES+=("Class '$current_class' (line $class_start) has $method_count methods (max: $MAX_METHODS)")
  fi
fi

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "ANTI-PATTERN WARNING: God class detected in $FILE_PATH" >&2
  echo "  Large classes with many methods are hard to test and maintain." >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
  echo "" >&2
  echo "  Suggested fixes:" >&2
  echo "    1. Extract cohesive method groups into separate classes (SRP)" >&2
  echo "    2. Use composition over inheritance" >&2
  echo "    3. Apply the Strategy or Command pattern for behavioral variations" >&2
  echo "    4. Move data-only methods into dataclasses/DTOs" >&2
  # Advisory only
  exit 0
fi

exit 0
