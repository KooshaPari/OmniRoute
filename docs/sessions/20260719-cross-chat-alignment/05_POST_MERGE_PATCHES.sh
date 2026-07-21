#!/bin/bash
# post-merge-patches.sh — Chat 5 (POLYMUS) post-merge patch application
# Run after Chat 2 publishes #386 merge SHA

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "=== POLYMUS Post-Merge Patches ==="

echo "--- P0.1: Tier-resolver deactivation fix ---"
if grep -q "reconcileAllEdges.*killSwitchActive: false" open-sse/rpc/tierResolver.ts 2>/dev/null; then
  echo "  Already applied"
else
  echo "  NEEDS: Add forcedTToT1=false, clearTierOverrides(), reconcileAllEdges({killSwitchActive:false}) to deactivateKillSwitchDegradation()"
fi

echo "--- P1.1–P1.5: Production callsite wiring ---"
for file in open-sse/handlers/chatCore.ts open-sse/services/autoCombo/scoring.ts open-sse/services/rateLimitManager.ts src/lib/guardrails/piiMasker.ts open-sse/executors/bifrost.ts; do
  if [ -f "$file" ]; then
    if grep -q "useDispatchForEdge" "$file" 2>/dev/null; then
      echo "  $file — already wired"
    else
      echo "  $file — NEEDS wiring (see 02_CALLSITE_DIFFS.md)"
    fi
  else
    echo "  $file — NOT FOUND (v8.3 path may differ)"
  fi
done

echo "--- All patches checked ---"
