#!/usr/bin/env bash
set -euo pipefail
# Fleet pillar inventory — scan all tracked repos for pillar artifacts.
# Usage: bash tools/pillar-fleet/inventory.sh > pillar-inventory.txt

ROOT="${1:-.}"
echo "# Pillar Inventory — $(date -u +%F)"
echo "# Root: $ROOT"
echo ""
for category in architecture resilience quality dx security observability docs; do
  echo "## $category"
  find "$ROOT" -maxdepth 3 -name "*$category*" -name "*.md" 2>/dev/null | head -20
  echo ""
done
