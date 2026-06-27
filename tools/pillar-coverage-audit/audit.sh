#!/usr/bin/env bash
set -euo pipefail
# v38 Option C T1: Quarterly pillar coverage audit.
# Runs tools/pillar-fleet/inventory.sh + scorecard.sh + drift.sh across fleet
# and writes a single quarterly-coverage.md report.
REPO_ROOT="${1:-.}"
OUTPUT="${OUTPUT_DIR:-evidence}"
mkdir -p "$OUTPUT"

echo "==> Pillar coverage audit (v38 Option C, quarterly)"
echo "Repo: $REPO_ROOT"
echo "Output: $OUTPUT/"
echo

# 1. Inventory
echo "## Inventory" > "$OUTPUT/quarterly-coverage.md"
echo '```' >> "$OUTPUT/quarterly-coverage.md"
bash "$REPO_ROOT/tools/pillar-fleet/inventory.sh" "$REPO_ROOT" \
  >> "$OUTPUT/quarterly-coverage.md" 2>&1 || true
echo '```' >> "$OUTPUT/quarterly-coverage.md"
echo >> "$OUTPUT/quarterly-coverage.md"

# 2. Scorecard
echo "## Scorecard" >> "$OUTPUT/quarterly-coverage.md"
echo '```' >> "$OUTPUT/quarterly-coverage.md"
bash "$REPO_ROOT/tools/pillar-fleet/scorecard.sh" "$REPO_ROOT" \
  >> "$OUTPUT/quarterly-coverage.md" 2>&1 || true
echo '```' >> "$OUTPUT/quarterly-coverage.md"
echo >> "$OUTPUT/quarterly-coverage.md"

# 3. Drift vs previous baseline
prev_baseline="$OUTPUT/quarterly-coverage.previous.md"
if [ -f "$prev_baseline" ]; then
  echo "## Drift vs previous quarter" >> "$OUTPUT/quarterly-coverage.md"
  echo '```' >> "$OUTPUT/quarterly-coverage.md"
  bash "$REPO_ROOT/tools/pillar-fleet/drift.sh" \
    --current "$OUTPUT/quarterly-coverage.md" \
    --previous "$prev_baseline" \
    >> "$OUTPUT/quarterly-coverage.md" 2>&1 || true
  echo '```' >> "$OUTPUT/quarterly-coverage.md"
fi

# 4. Summary line
total=$(grep -c '^L[0-9]' "$OUTPUT/quarterly-coverage.md" 2>/dev/null || echo 0)
at_3=$(grep -c '✓ 3/3' "$OUTPUT/quarterly-coverage.md" 2>/dev/null || echo 0)
echo >> "$OUTPUT/quarterly-coverage.md"
echo "## Summary" >> "$OUTPUT/quarterly-coverage.md"
echo "- Total pillars inventoried: $total" >> "$OUTPUT/quarterly-coverage.md"
echo "- At 3/3: $at_3" >> "$OUTPUT/quarterly-coverage.md"
echo "- At <3/3: $((total - at_3))" >> "$OUTPUT/quarterly-coverage.md"
echo "- Audit date: $(date -u +%Y-%m-%d)" >> "$OUTPUT/quarterly-coverage.md"

echo
echo "==> Quarterly coverage audit complete: $OUTPUT/quarterly-coverage.md"