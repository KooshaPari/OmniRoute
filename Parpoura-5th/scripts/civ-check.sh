#!/usr/bin/env bash
# civ-check.sh — Verify CIV specs are complete and linked

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Checking CIV spec status..."

# Expected CIV specs (from SPECS_INDEX.md)
CIV_SPECS=(
  "CIV-0001"
  "CIV-0100"
  "CIV-0101"
  "CIV-0102"
  "CIV-0103"
  "CIV-0104"
  "CIV-0105"
  "CIV-0106"
)

MISSING=0

for spec in "${CIV_SPECS[@]}"; do
  if ! grep -q "$spec" NEXT_STEPS.md 2>/dev/null; then
    log_warn "CIV spec reference missing: $spec"
    ((MISSING++))
  fi
done

log_info "Checked ${#CIV_SPECS[@]} expected CIV specs."

if [ "$MISSING" -eq 0 ]; then
  log_success "All expected CIV specs are referenced."
  exit 0
else
  log_warn "Found $MISSING missing CIV spec reference(s)."
  exit 0  # Non-blocking warning
fi
