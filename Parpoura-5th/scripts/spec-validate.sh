#!/usr/bin/env bash
# spec-validate.sh — Validate specification completeness
# Checks that all specs include required sections.

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Validating specification completeness..."

# Required sections for all specs
REQUIRED_SECTIONS=(
  "Date"
  "Status"
  "Scope"
)

# Check each spec file
ERRORS=0

for spec_file in venture/*.md TECHNICAL_SPEC.md TRACK_*.md 2>/dev/null; do
  [ -f "$spec_file" ] || continue

  log_debug "Checking $spec_file..."

  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "^\\*\\*$section\\*\\*:" "$spec_file" 2>/dev/null; then
      log_error "Missing required section: **$section**: in $spec_file"
      ((ERRORS++))
    fi
  done
done

if [ "$ERRORS" -eq 0 ]; then
  log_success "All specs passed validation."
  exit 0
else
  log_error "Spec validation failed with $ERRORS errors."
  exit 1
fi
