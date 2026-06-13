#!/usr/bin/env bash
# spec-gaps.sh — Find specification gaps (untraced requirements)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Checking for specification gaps..."

# Check that all P0/P1/P2 tasks in NEXT_STEPS.md have spec references
GAPS=0

while IFS= read -r line; do
  # Match lines with task descriptions (look for P0, P1, P2 markers)
  if [[ "$line" =~ ^####\ [0-9]+\. ]] && ! grep -q "SPEC\|spec" <<< "$line"; then
    log_warn "Task without spec reference: $line"
    ((GAPS++))
  fi
done < NEXT_STEPS.md

if [ "$GAPS" -eq 0 ]; then
  log_success "All tasks traced to specs."
  exit 0
else
  log_warn "Found $GAPS task(s) without spec references."
  exit 0  # Non-blocking warning
fi
