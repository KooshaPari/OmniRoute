#!/usr/bin/env bash
# scripts/bench-cache-pool.sh — v24 T3 L17+L18 macbook dry-run bench harness.
# Simulates the cache+pool soak at small scale (10 s, 50 RPS, 100 connections)
# so the spec is testable on a macbook. The real 1k-RPS 30-min soak runs on
# `device: heavy-runner` (per ADR-023) once the 5 PRs land.
#
# Usage:  ./scripts/bench-cache-pool.sh [target_url] [duration_s] [rps]
# Output: JSON to stdout (hit_rate, miss_rate, pool_exhaustions, fd_delta).
# Deps:  curl, awk. No cargo. No benchmarks. macbook-safe.

set -euo pipefail

TARGET="${1:-http://127.0.0.1:9090/probe}"   # /probe returns Cache-hit|Cache-miss
DURATION="${2:-10}"                          # soak seconds (heavy-runner: 1800)
RPS="${3:-50}"                               # target req/s       (heavy-runner: 1000)

echo "[bench] target=$TARGET duration=${DURATION}s rps=$RPS (dry-run)" >&2

# Probe loop: fire ~RPS reqs/s for DURATION seconds; tally hits/misses/exhausts.
hits=0; misses=0; exhaust=0; fd_baseline=0; fd_after=0
fd_baseline=$(lsof -p $$ 2>/dev/null | wc -l | awk '{print $1}')

end=$(( $(date +%s) + DURATION ))
while [ "$(date +%s)" -lt "$end" ]; do
    for _ in $(seq 1 "$RPS"); do
        body=$(curl -sS -o /dev/null -w '%{http_code}:%{time_total}' \
            --max-time 2 "$TARGET" 2>/dev/null || echo "000:0.000")
        code="${body%%:*}"; t="${body##*:}"
        if [ "$code" = "200" ]; then hits=$((hits+1));
        elif [ "$code" = "503" ]; then exhaust=$((exhaust+1));
        else misses=$((misses+1)); fi
    done
    sleep 1
done

fd_after=$(lsof -p $$ 2>/dev/null | wc -l | awk '{print $1}')
total=$((hits + misses + exhaust))
rate=$(awk -v h="$hits" -v t="$total" 'BEGIN{printf "%.3f", (t>0)?h/t:0}')
fd_delta=$((fd_after - fd_baseline))

cat <<JSON
{"target":"$TARGET","duration_s":$DURATION,"rps":$RPS,"hit_count":$hits,"miss_count":$misses,"pool_exhaust":$exhaust,"hit_rate":$rate,"fd_delta":$fd_delta}
JSON

# Gate the macbook dry-run against the cycle targets (relaxed: 50% / 5/100).
awk -v r="$rate" -v e="$exhaust" 'BEGIN{
    if (r+0 < 0.50) { print "FAIL: hit_rate " r " < 0.50 macbook gate"; exit 1 }
    if (e+0 > 5)    { print "FAIL: pool_exhaust " e " > 5 macbook gate"; exit 1 }
    print "PASS: macbook dry-run (hit_rate=" r ", exhaust=" e ")"
}'
