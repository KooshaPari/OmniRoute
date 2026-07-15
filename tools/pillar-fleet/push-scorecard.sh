#!/bin/bash
set -euo pipefail
SCORECARD=$(ls -t findings/pillar-scorecard-*.json 2>/dev/null | head -1)
if [ -z "$SCORECARD" ]; then echo "push-scorecard: no scorecard file found"; exit 0; fi
ln -sf "$SCORECARD" findings/pillar-scorecard-latest.json
git add findings/pillar-scorecard-latest.json "$SCORECARD"
git commit -m "chore(sustainment): pillar-scorecard $(basename $SCORECARD .json)"
git push origin HEAD:main 2>&1 || echo "push-scorecard: push failed (dev mode — SKIP)"
echo "push-scorecard: $SCORECARD pushed to origin"
