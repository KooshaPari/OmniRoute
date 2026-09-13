#!/usr/bin/env bash
# Bifrost vs TS Pipeline Benchmark Script
#
# Measures: cold start latency, steady-state p50/p95, streaming TTFB, memory usage
# Requirements: Bifrost sidecar running on 127.0.0.1:8080, OmniRoute dev server
#
# Usage:
#   ./bifrost-benchmark.sh [--requests N] [--concurrency N] [--warmup N]
#
# See: docs/sessions/20260912-omniroute-fork-audit/08_BIFROST_INTEGRATION_PLAN.md

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────
REQUESTS=${1:-100}
CONCURRENCY=${2:-10}
WARMUP=${3:-10}
BIFROST_URL="${BIFROST_BASE_URL:-http://127.0.0.1:8080}"
OMNIROUTE_URL="${OMNIROUTE_URL:-http://localhost:3000}"
RESULTS_DIR="./docs/benchmarks/results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/bifrost-vs-ts-${TIMESTAMP}.json"

mkdir -p "$RESULTS_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Bifrost vs TS Pipeline Benchmark                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Requests:      ${REQUESTS}                                  ║"
echo "║  Concurrency:   ${CONCURRENCY}                                  ║"
echo "║  Warmup:        ${WARMUP}                                  ║"
echo "║  Bifrost URL:   ${BIFROST_URL}               ║"
echo "║  OmniRoute URL: ${OMNIROUTE_URL}               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo

# ── Health checks ────────────────────────────────────────────────────────
echo "→ Checking Bifrost sidecar..."
if ! curl -sf "${BIFROST_URL}/health" >/dev/null 2>&1; then
  echo "  ✗ Bifrost sidecar not reachable at ${BIFROST_URL}"
  echo "  Install and start Bifrost first:"
  echo "    POST /api/services/bifrost/install"
  echo "    POST /api/services/bifrost/start"
  exit 1
fi
echo "  ✓ Bifrost sidecar healthy"

echo "→ Checking OmniRoute..."
if ! curl -sf "${OMNIROUTE_URL}/api/healthz" >/dev/null 2>&1; then
  echo "  ✗ OmniRoute not reachable at ${OMNIROUTE_URL}"
  echo "  Start the dev server first: pnpm dev"
  exit 1
fi
echo "  ✓ OmniRoute healthy"
echo

# ── Test payload ─────────────────────────────────────────────────────────
PAYLOAD='{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Say hello in exactly 5 words."}],
  "max_tokens": 50,
  "stream": false
}'

STREAM_PAYLOAD='{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Say hello in exactly 5 words."}],
  "max_tokens": 50,
  "stream": true
}'

# ── Benchmark function ──────────────────────────────────────────────────
benchmark_path() {
  local name=$1
  local url=$2
  local header=$3
  local payload=$4
  local label=$5

  echo "━━━ Benchmarking: ${label} ━━━"

  # Warmup
  echo "  Warmup (${WARMUP} requests)..."
  for i in $(seq 1 "$WARMUP"); do
    curl -sf -X POST "$url" \
      -H "Content-Type: application/json" \
      -H "$header" \
      -d "$payload" \
      -o /dev/null 2>&1 || true
  done

  # Timed requests
  echo "  Running ${REQUESTS} requests with concurrency ${CONCURRENCY}..."
  local times_file=$(mktemp)
  local pids=()
  local active=0
  local completed=0

  for i in $(seq 1 "$REQUESTS"); do
    (
      local start=$(python3 -c "import time; print(time.monotonic())")
      curl -sf -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "$header" \
        -d "$payload" \
        -o /dev/null 2>&1 || true
      local end=$(python3 -c "import time; print(time.monotonic())")
      python3 -c "print($end - $start)"
    ) >> "$times_file" &
    pids+=($!)
    active=$((active + 1))

    if [ "$active" -ge "$CONCURRENCY" ]; then
      wait "${pids[0]}" 2>/dev/null || true
      pids=("${pids[@]:1}")
      active=$((active - 1))
      completed=$((completed + 1))
      printf "\r  Progress: %d/%d" "$completed" "$REQUESTS"
    fi
  done

  # Wait for remaining
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
  echo "\r  Progress: ${REQUESTS}/${REQUESTS}"

  # Calculate stats
  local stats=$(python3 -c "
import sys
times = [float(line.strip()) for line in open('$times_file') if line.strip()]
times.sort()
n = len(times)
if n == 0:
    print('{\"count\": 0}')
    sys.exit()
p50 = times[n // 2]
p95 = times[int(n * 0.95)] if n >= 20 else times[-1]
p99 = times[int(n * 0.99)] if n >= 100 else times[-1]
avg = sum(times) / n
mn = times[0]
mx = times[-1]
print(f'{{\"count\": {n}, \"min\": {mn:.4f}, \"max\": {mx:.4f}, \"avg\": {avg:.4f}, \"p50\": {p50:.4f}, \"p95\": {p95:.4f}, \"p99\": {p99:.4f}}}')
")
  echo "  Results: ${stats}"
  echo "${stats}" > "${RESULTS_DIR}/${name}-latency.json"
  rm -f "$times_file"
  echo
}

# ── Memory measurement ──────────────────────────────────────────────────
measure_memory() {
  echo "━━━ Memory Usage ━━━"
  local node_pid=$(pgrep -f "node.*next" | head -1)
  local go_pid=$(pgrep -f "bifrost" | head -1)

  if [ -n "$node_pid" ]; then
    local node_rss=$(ps -o rss= -p "$node_pid" 2>/dev/null | tr -d ' ')
    echo "  Node.js (PID ${node_pid}): ${node_rss} KB ($(( node_rss / 1024 )) MB)"
  else
    echo "  Node.js: not found"
  fi

  if [ -n "$go_pid" ]; then
    local go_rss=$(ps -o rss= -p "$go_pid" 2>/dev/null | tr -d ' ')
    echo "  Bifrost (PID ${go_pid}): ${go_rss} KB ($(( go_rss / 1024 )) MB)"
  else
    echo "  Bifrost: not found"
  fi
  echo
}

# ── Run benchmarks ──────────────────────────────────────────────────────

# 1. Non-streaming: Bifrost relay
benchmark_path "bifrost-nonstream" \
  "${OMNIROUTE_URL}/api/v1/relay/chat/completions/bifrost" \
  "Authorization: Bearer ${BIFROST_API_KEY:-test-key}" \
  "$PAYLOAD" \
  "Bifrost Relay (non-streaming)"

# 2. Non-streaming: TS pipeline
benchmark_path "ts-nonstream" \
  "${OMNIROUTE_URL}/api/v1/relay/chat/completions" \
  "Authorization: Bearer ${BIFROST_API_KEY:-test-key}" \
  "$PAYLOAD" \
  "TS Pipeline (non-streaming)"

# 3. Streaming: Bifrost relay (measure TTFB)
echo "━━━ Benchmarking: Bifrost Relay (streaming TTFB) ━━━"
echo "  Warmup (${WARMUP} requests)..."
for i in $(seq 1 "$WARMUP"); do
  curl -sf -X POST "${OMNIROUTE_URL}/api/v1/relay/chat/completions/bifrost" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BIFROST_API_KEY:-test-key}" \
    -d "$STREAM_PAYLOAD" \
    -o /dev/null 2>&1 || true
done

ttfb_file=$(mktemp)
for i in $(seq 1 "$REQUESTS"); do
  (
    ttfb=$(curl -sf -X POST "${OMNIROUTE_URL}/api/v1/relay/chat/completions/bifrost" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${BIFROST_API_KEY:-test-key}" \
      -d "$STREAM_PAYLOAD" \
      -w "%{time_starttransfer}" \
      -o /dev/null 2>&1 || echo "0")
    echo "$ttfb"
  ) >> "$ttfb_file" &
done
wait

ttfb_stats=$(python3 -c "
import sys
times = [float(line.strip()) for line in open('$ttfb_file') if line.strip() and line.strip() != '0']
times.sort()
n = len(times)
if n == 0:
    print('{\"count\": 0}')
    sys.exit()
p50 = times[n // 2]
p95 = times[int(n * 0.95)] if n >= 20 else times[-1]
avg = sum(times) / n
print(f'{{\"count\": {n}, \"avg_ttfb\": {avg:.4f}, \"p50_ttfb\": {p50:.4f}, \"p95_ttfb\": {p95:.4f}}}')
")
echo "  Results: ${ttfb_stats}"
echo "${ttfb_stats}" > "${RESULTS_DIR}/bifrost-stream-ttfb.json"
rm -f "$ttfb_file"
echo

# 4. Memory
measure_memory

# ── Summary ──────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Benchmark Complete                                     ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Results saved to: ${RESULTS_DIR}/                      ║"
echo "║                                                          ║"
echo "║  Compare p50 latency:                                    ║"
echo "║    Bifrost: $(cat ${RESULTS_DIR}/bifrost-nonstream-latency.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('p50','?'))" 2>/dev/null || echo '?')s                                  ║"
echo "║    TS:      $(cat ${RESULTS_DIR}/ts-nonstream-latency.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('p50','?'))" 2>/dev/null || echo '?')s                                  ║"
echo "║                                                          ║"
echo "║  Next steps:                                             ║"
echo "║  1. Review results in docs/benchmarks/results/           ║"
echo "║  2. If Bifrost p50 < TS p50: COMMIT recommended         ║"
echo "║  3. If Bifrost p50 > TS p50 * 1.5: investigate          ║"
echo "║  4. Deploy shadow mode: OMNIROUTE_RELAY_BACKEND=auto    ║"
echo "╚══════════════════════════════════════════════════════════╝"
