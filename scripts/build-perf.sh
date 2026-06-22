#!/usr/bin/env bash
# scripts/build-perf.sh — measure cargo build time across iterations
# Emits benchmarks/build-perf.json for trend tracking
# Per v22 T5 L35
set -euo pipefail
PROFILE="${PROFILE:-dev}"
ITERATIONS="${ITERATIONS:-3}"
OUT="${OUT:-benchmarks/build-perf.json}"

mkdir -p "$(dirname "$OUT")"

results=()
for i in $(seq 1 "$ITERATIONS"); do
  cargo clean -q
  start=$(date +%s.%N)
  cargo build --profile "$PROFILE" --workspace 2>&1 | tail -5 || true
  end=$(date +%s.%N)
  elapsed=$(echo "$end - $start" | bc -l)
  results+=("$(printf '{"iteration":%d,"elapsed_s":%.2f}' "$i" "$elapsed")")
done

joined=$(IFS=,; echo "${results[*]}")
cat > "$OUT" <<JSON
{
  "profile": "$PROFILE",
  "iterations": $ITERATIONS,
  "runs": [$joined],
  "median_s": $(echo "$joined" | python3 -c "import sys, json; runs=json.load(sys.stdin); print(sorted([r['elapsed_s'] for r in runs])[len(runs)//2])"),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "Build perf: $OUT"
cat "$OUT"
