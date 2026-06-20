#!/bin/bash
# Dispatch all 20 prompts as background forge processes.
# Each one writes a 1-line summary to its output file.
# Then aggregates results into SYNTHESIS.md.

set -u
cd /Users/kooshapari/CodeProjects/Phenotype/repos

WAVEDIR="findings/forge-wave-2026-06-20"
LOGDIR="$WAVEDIR/logs"
mkdir -p "$LOGDIR"

echo "=== DISPATCHING 20 FORGE BACKGROUND PROCESSES ==="
echo "Start: $(date)"

pids=()
for promptfile in "$WAVEDIR"/*.prompt; do
  [ -f "$promptfile" ] || continue
  base="${promptfile%.prompt}"
  outfile="${base%.md}"
  logfile="$LOGDIR/$(basename "$outfile").log"
  (
    echo "[$(date +%H:%M:%S)] START $(basename "$promptfile")" > "$logfile"
    # Dispatch to forge non-interactively (best-effort, timeboxed)
    timeout 180 forge -p "$(cat "$promptfile")" --agent forge -C /Users/kooshapari/CodeProjects/Phenotype/repos > "$logfile.stdout" 2>&1
    rc=$?
    echo "[$(date +%H:%M:%S)] forge_exit=$rc" >> "$logfile"
    if [ $rc -eq 0 ]; then
      echo "DONE $(basename "$promptfile") - see $logfile.stdout" > "$outfile"
    else
      echo "FAIL exit=$rc - see $logfile" > "$outfile"
    fi
  ) &
  pids+=($!)
done

echo "Total dispatched: ${#pids[@]}"

# Wait for all to complete (max 5 minutes total)
sleep 1
for pid in "${pids[@]}"; do
  wait $pid 2>/dev/null || true
done

echo "=== ALL DONE: $(date) ==="

# Aggregate
echo "# Forge Wave 2026-06-20 — Synthesis" > "$WAVEDIR/SYNTHESIS.md"
echo "" >> "$WAVEDIR/SYNTHESIS.md"
echo "## Results" >> "$WAVEDIR/SYNTHESIS.md"
for outfile in "$WAVEDIR"/wp-*.md; do
  [ -f "$outfile" ] || continue
  echo "- $(basename "$outfile"): $(cat "$outfile")" >> "$WAVEDIR/SYNTHESIS.md"
done
echo "Done. See $WAVEDIR/SYNTHESIS.md"
