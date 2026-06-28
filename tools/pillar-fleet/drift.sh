#!/usr/bin/env bash
set -euo pipefail
# Fleet pillar drift detector — alert on pillar artifacts that aged past thresholds.
# Usage: bash tools/pillar-fleet/drift.sh

MAX_AGE_DAYS="${1:-7}"
echo "# Pillar Drift Report — $(date -u +%F)"
echo "# Max age: ${MAX_AGE_DAYS}d"
echo ""

while IFS= read -r f; do
  age=$(( ( $(date +%s) - $(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null) ) / 86400 ))
  if [ "$age" -gt "$MAX_AGE_DAYS" ]; then
    echo "WARN: $f (${age}d, threshold=${MAX_AGE_DAYS}d)"
  fi
done < <(find . -path '*/pillar*' -o -path '*findings*' | grep -v '.git' | head -100)

echo ""
echo "# Done."
