#!/opt/homebrew/bin/bash
# pillar-wave-hook.sh — Post-wave pillar checks
# Called by run-all.sh after each wave completes.
# Runs inventory.sh, drift.sh, scorecard.sh against the current fleet state.
#
# Usage: pillar-wave-hook.sh [WAVE_NUMBER]
#   WAVE_NUMBER: current wave (1-based), used for checkpoint file naming

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WAVE="${1:-0}"
DATE_STAMP=$(date -u +%Y-%m-%d)
LOG_DIR="$ROOT/.audit-run-v37/status"

mkdir -p "$LOG_DIR"

echo "[pillar-hook] Wave $WAVE post-audit checks starting: $(date -u +%FT%TZ)" >&2

# Run pillar inventory
if [[ -x "$ROOT/tools/pillar-fleet/inventory.sh" ]]; then
    bash "$ROOT/tools/pillar-fleet/inventory.sh" --out "$LOG_DIR" > "$LOG_DIR/pillar-inventory-wave-${WAVE}.log" 2>&1
    echo "[pillar-hook] inventory.sh exit=$?" >&2
fi

# Run drift check
if [[ -x "$ROOT/tools/pillar-fleet/drift.sh" ]]; then
    bash "$ROOT/tools/pillar-fleet/drift.sh" > "$LOG_DIR/pillar-drift-wave-${WAVE}.log" 2>&1
    echo "[pillar-hook] drift.sh exit=$?" >&2
fi

# Run scorecard
if [[ -x "$ROOT/tools/pillar-fleet/scorecard.sh" ]]; then
    bash "$ROOT/tools/pillar-fleet/scorecard.sh" > "$LOG_DIR/pillar-scorecard-wave-${WAVE}.md" 2>&1
    echo "[pillar-hook] scorecard.sh exit=$?" >&2
fi

echo "[pillar-hook] Wave $WAVE pillar checks complete: $(date -u +%FT%TZ)" >&2
