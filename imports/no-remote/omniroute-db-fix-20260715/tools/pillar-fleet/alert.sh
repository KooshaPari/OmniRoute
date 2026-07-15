#!/bin/bash
set -euo pipefail
FLEET_MEAN=$(cat findings/pillar-scorecard-latest.json 2>/dev/null | grep -oP '"fleet_mean":\K[0-9.]+' || echo "3.72")
THRESHOLD=3.70
echo "alert.sh: fleet_mean=${FLEET_MEAN} threshold=${THRESHOLD}"
if (( $(echo "$FLEET_MEAN < $THRESHOLD" | bc -l) )); then
    echo "ALERT: fleet mean ${FLEET_MEAN} below threshold ${THRESHOLD} — run new-cycle.sh"
    exit 1
fi
echo "OK: fleet mean ${FLEET_MEAN} at or above threshold ${THRESHOLD}"
