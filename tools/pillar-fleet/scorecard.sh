#!/usr/bin/env bash
set -euo pipefail
# Fleet pillar scorecard — aggregate pillar scores into a table.
# Usage: bash tools/pillar-fleet/scorecard.sh

echo "# Fleet Pillar Scorecard — $(date -u +%F)"
echo ""

total_p0=0; closed_p0=0
total_p1=0; closed_p1=0
total_p2=0; closed_p2=0

for d in tools/*/; do
  name=$(basename "$d")
  if [ -f "$d/AGENTS.md" ] || [ -f "$d/README.md" ]; then
    closed=$(( closed_p0 + 1 ))
    total_p0=$(( total_p0 + 1 ))
  fi
done

echo "## Summary"
echo "| Category | Total | Closed | % |"
echo "|---|---|---|---|"
echo "| P0 | $total_p0 | $closed_p0 | - |"
echo "| P1 | $total_p1 | $closed_p1 | - |"
echo "| P2 | $total_p2 | $closed_p2 | - |"
