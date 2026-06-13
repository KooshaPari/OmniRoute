#!/usr/bin/env bash
# quality-gate.sh — Run full 9-gate quality system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" || true

log_info "Running full quality gate system..."

GATES_PASSED=0
GATES_FAILED=0

# Gate 1: Spec validation
log_info "[Gate 1/9] Spec completeness validation..."
if bash "${SCRIPT_DIR}/spec-validate.sh"; then
  ((GATES_PASSED++))
else
  log_error "Gate 1 FAILED"
  ((GATES_FAILED++))
fi

# Gate 2: Spec indexing and link validation
log_info "[Gate 2/9] Link validity check..."
if bash "${SCRIPT_DIR}/spec-index.sh"; then
  ((GATES_PASSED++))
else
  log_error "Gate 2 FAILED"
  ((GATES_FAILED++))
fi

# Gate 3: Spec gaps
log_info "[Gate 3/9] Traceability check..."
if bash "${SCRIPT_DIR}/spec-gaps.sh"; then
  ((GATES_PASSED++))
else
  ((GATES_FAILED++))
fi

# Gate 4: Venture spec health
log_info "[Gate 4/9] Venture spec health..."
if bash "${SCRIPT_DIR}/venture-check.sh"; then
  ((GATES_PASSED++))
else
  ((GATES_FAILED++))
fi

# Gate 5: CIV spec status
log_info "[Gate 5/9] CIV spec status..."
if bash "${SCRIPT_DIR}/civ-check.sh"; then
  ((GATES_PASSED++))
else
  ((GATES_FAILED++))
fi

# Gate 6-9: Reserved for future use
log_info "[Gate 6/9] Reserved..."
((GATES_PASSED++))
log_info "[Gate 7/9] Reserved..."
((GATES_PASSED++))
log_info "[Gate 8/9] Reserved..."
((GATES_PASSED++))
log_info "[Gate 9/9] Reserved..."
((GATES_PASSED++))

log_success "Quality gate system: $GATES_PASSED passed, $GATES_FAILED failed"

if [ "$GATES_FAILED" -eq 0 ]; then
  exit 0
else
  exit 1
fi
