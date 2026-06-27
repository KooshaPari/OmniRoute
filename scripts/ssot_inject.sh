#!/usr/bin/env bash
# scripts/ssot_inject.sh — v14 Class A stub for the ssot-inject CI gate.
#
# Auto-injects any required SSOT.md sections that are missing. The full
# implementation is staged for a follow-up cycle; this stub is the contract
# surface the .github/workflows/ssot-inject.yml workflow expects.
#
# Per ADR-022 (config consolidation — two-crate canonical split), the
# authoritative SSOT validator is scripts/validate-ssot.sh. This script
# is a forward-compatible injection shim that exits 0 in both modes.
#
# Usage:
#   scripts/ssot_inject.sh           # perform injection (currently noop)
#   scripts/ssot_inject.sh --dry-run # report missing sections, do not modify

set -euo pipefail

# Always run from the repo root so relative paths in the workflow match.
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
fi

# Sections required by ADR-022 / SSOT contract.
REQUIRED_SECTIONS=(
    "Scope"
    "Precedence order"
    "Updating this file"
)

missing=()
if [[ -f SSOT.md ]]; then
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if ! grep -qE "^## .*${section}" SSOT.md; then
            missing+=("$section")
        fi
    done
else
    missing+=("(SSOT.md missing)")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
    echo "[ssot-inject] missing sections: ${missing[*]}"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[ssot-inject] dry-run: no changes"
    exit 0
fi

# Real injection logic is staged for the next 71-pillar cycle. For now this
# is a noop that delegates to the canonical validator.
if [[ -x ./scripts/validate-ssot.sh ]]; then
    ./scripts/validate-ssot.sh
else
    echo "[ssot-inject] noop — see scripts/validate-ssot.sh"
fi

exit 0
