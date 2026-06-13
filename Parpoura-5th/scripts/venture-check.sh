#!/usr/bin/env bash
# venture-check.sh — Verify venture specs are linked to NEXT_STEPS.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Checking venture spec health..."

# Count venture specs
VENTURE_SPECS=$(find venture -name "*.md" -type f | wc -l)
log_info "Found $VENTURE_SPECS venture specs."

# Check each venture spec is referenced in NEXT_STEPS.md
UNLINKED=0

for spec_file in venture/*.md; do
  SPEC_NAME=$(basename "$spec_file" .md)
  if ! grep -q "$SPEC_NAME" NEXT_STEPS.md 2>/dev/null; then
    log_warn "Venture spec not referenced in NEXT_STEPS.md: $SPEC_NAME"
    ((UNLINKED++))
  fi
done

if [ "$UNLINKED" -eq 0 ]; then
  log_success "All venture specs are referenced in NEXT_STEPS.md."
  exit 0
else
  log_warn "Found $UNLINKED unlinked venture spec(s)."
  exit 0  # Non-blocking warning
fi
