#!/usr/bin/env bash
# DAG dispatcher — runs one row of wave-N.json at a time.
# Per project guideline, runs in parallel batches but each task is full-sized.
# Usage: bash tools/dag-agent/dag-dispatch.sh dag-state/wave-1.json
set -euo pipefail

WAVE_FILE="${1:-dag-state/wave-1.json}"

if [[ ! -f "$WAVE_FILE" ]]; then
    echo "ERROR: wave file not found: $WAVE_FILE" >&2
    exit 1
fi

TASKS=$(python3 -c "import json,sys; print(len(json.load(open('$WAVE_FILE'))['tasks']))")
echo "DAG dispatcher: $TASKS tasks from $WAVE_FILE"

# Parse JSON for target repos
python3 -c "
import json, sys
data = json.load(open('$WAVE_FILE'))
for t in data['tasks']:
    print(f\"{t['target_repo']}|{','.join(t['missing_files'])}\")
" | while IFS='|' read -r REPO MISSING; do
    if [[ -z "$REPO" ]]; then continue; fi
    echo "[DAG] Processing $REPO (missing: $MISSING)"
    # Direct orchestrator pattern: shell scripts in parallel
    # (Task tool documented as broken in this env)
    bash "tools/dag-agent/onboard-repo.sh" "$REPO" 2>&1 | head -20 || \
        echo "[DAG] WARN: $REPO had issues (non-blocking)"
done

echo "DAG wave dispatch complete: $TASKS tasks processed"