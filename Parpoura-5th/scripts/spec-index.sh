#!/usr/bin/env bash
# spec-index.sh — Index all specifications and validate links

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Indexing specifications..."

# Find all spec files
SPEC_COUNT=0
LINK_ERRORS=0

find venture -name "*.md" -type f 2>/dev/null | while read -r spec_file; do
  ((SPEC_COUNT++))

  # Check for broken links (references to missing files)
  while IFS= read -r line; do
    if [[ "$line" =~ \[([^\]]+)\]\(([^)]+)\) ]]; then
      LINK="${BASH_REMATCH[2]}"
      # Only check local file references (not URLs)
      if [[ "$LINK" != http* ]] && [[ "$LINK" != /* ]]; then
        LINK_FILE="${LINK%#*}"  # Remove anchor
        if [ ! -f "$LINK_FILE" ]; then
          log_warn "Broken link in $spec_file: $LINK_FILE"
          ((LINK_ERRORS++))
        fi
      fi
    fi
  done < "$spec_file"
done

log_info "Indexed $SPEC_COUNT specification files."

if [ "$LINK_ERRORS" -eq 0 ]; then
  log_success "No broken links found."
  exit 0
else
  log_error "Found $LINK_ERRORS broken link(s)."
  exit 1
fi
