#!/usr/bin/env bash
# tests/e2e/phenotype-stack-smoke.sh
#
# Boots the full Phenotype stack (Rust data plane + BytePort Go backend +
# NVMS Go daemon + optional Ollama) and runs a real LLM-shaped round-trip
# through it. Designed for local dev and CI smoke validation.
#
# Topology:
#
#   curl  →  BytePort Gin (UDSProxy)
#           ↓
#           ↓ unix socket
#           ↓
#           omniroute-runtime (Rust, hyper)
#           ↓
#           OpenAIProvider / OllamaProvider
#           ↓ HTTPS
#           upstream LLM (Ollama local or OPENAI_BASE_URL)
#
# All three daemons print structured logs and the harness captures each
# log line for postmortem analysis. Exit 0 = green; non-zero = red.
#
# Usage:
#   tests/e2e/phenotype-stack-smoke.sh [--skip-llm-call] [--keep-stacks]
#
# Env:
#   OMNIROUTE_RUST_BIN  Path to `routed` binary (default: ./target/release/routed)
#   BYTEPORT_GO_BIN     Path to byteport backend binary (default: ./BytePort/backend/bin/byteport)
#   NVMS_GO_BIN         Path to nvms daemon binary (default: ./nanovms/bin/nvms)
#   OLLAMA_BASE_URL     Upstream base URL (default: http://127.0.0.1:11434)
#   OPENAI_API_KEY      Optional: if set, uses OpenAI upstream instead of Ollama
#   OPENAI_BASE_URL     Optional: OpenAI-compatible upstream
#   RUST_LOG            Default: omniroute_runtime=info
#   SMOKE_TIMEOUT       Default: 30s per step

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SKIP_LLM_CALL=0
KEEP_STACKS=0
for arg in "$@"; do
  case "$arg" in
    --skip-llm-call) SKIP_LLM_CALL=1 ;;
    --keep-stacks) KEEP_STACKS=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

OMNIROUTE_RUST_BIN="${OMNIROUTE_RUST_BIN:-$REPO_ROOT/target/release/routed}"
BYTEPORT_GO_BIN="${BYTEPORT_GO_BIN:-$REPO_ROOT/BytePort/backend/bin/byteport}"
NVMS_GO_BIN="${NVMS_GO_BIN:-$REPO_ROOT/nanovms/bin/nvms}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
RUST_LOG="${RUST_LOG:-omniroute_runtime=info,tower_http=info}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-30}"

# Per-test scratch dirs (sockets, logs, pidfiles)
TMPDIR="$(mktemp -d -t phenotype-smoke-XXXXXX)"
ROUTE_SOCK="$TMPDIR/omniroute.sock"
NVMS_SOCK="$TMPDIR/nanovms.sock"
BYTEPORT_LOG="$TMPDIR/byteport.log"
ROUTE_LOG="$TMPDIR/routed.log"
NVMS_LOG="$TMPDIR/nvms.log"
PIDFILE_BYTEPORT="$TMPDIR/byteport.pid"
PIDFILE_ROUTE="$TMPDIR/routed.pid"
PIDFILE_NVMS="$TMPDIR/nvms.pid"

cleanup() {
  local rc=$?
  if [[ $KEEP_STACKS -eq 0 ]]; then
    for pf in "$PIDFILE_BYTEPORT" "$PIDFILE_ROUTE" "$PIDFILE_NVMS"; do
      [[ -f "$pf" ]] && kill -TERM "$(cat "$pf")" 2>/dev/null || true
    done
    sleep 0.3
    for pf in "$PIDFILE_BYTEPORT" "$PIDFILE_ROUTE" "$PIDFILE_NVMS"; do
      [[ -f "$pf" ]] && kill -KILL "$(cat "$pf")" 2>/dev/null || true
    done
    rm -rf "$TMPDIR"
  else
    echo "[smoke] Keeping stacks alive in $TMPDIR" >&2
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

# ---- helpers ---------------------------------------------------------------

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

wait_http() {
  local url="$1" expect="$2" timeout_s="$3"
  local deadline=$(( $(date +%s) + timeout_s ))
  while (( $(date +%s) < deadline )); do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    [[ "$code" == "$expect" ]] && return 0
    sleep 0.2
  done
  return 1
}

# ---- preflight -------------------------------------------------------------

step "Preflight"
have curl  || fail "curl required"
have jq    || fail "jq required"
have ss    || fail "ss (iproute2) required"

[[ -x "$OMNIROUTE_RUST_BIN" ]] || fail "routed not found at $OMNIROUTE_RUST_BIN (build it first: cargo build --release -p omniroute-runtime)"
[[ -x "$BYTEPORT_GO_BIN"   ]] || fail "byteport backend not found at $BYTEPORT_GO_BIN (build it first)"
[[ -x "$NVMS_GO_BIN"       ]] || fail "nvms daemon not found at $NVMS_GO_BIN (build it first)"

mkdir -p "$TMPDIR/run"
ok "Binaries present; scratch dir $TMPDIR"

# ---- 1. boot NVMS daemon ---------------------------------------------------

step "Boot NVMS daemon (UDS listener)"
"$NVMS_GO_BIN" serve \
  --socket "$NVMS_SOCK" \
  --token-file "$TMPDIR/tokens.json" \
  --run-base "$TMPDIR/run" \
  >"$NVMS_LOG" 2>&1 &
echo $! > "$PIDFILE_NVMS"
sleep 0.3
[[ -S "$NVMS_SOCK" ]] || fail "NVMS did not bind $NVMS_SOCK (see $NVMS_LOG)"
ok "NVMS listening at $NVMS_SOCK (pid $(cat "$PIDFILE_NVMS"))"

# ---- 2. boot Rust data plane (routed) --------------------------------------

step "Boot Rust data plane (routed) on UDS"
OMNIROUTE_DATA_PLANE_SOCKET="$ROUTE_SOCK" \
  OMNIROUTE_OLLAMA_BASE_URL="$OLLAMA_BASE_URL" \
  RUST_LOG="$RUST_LOG" \
  "$OMNIROUTE_RUST_BIN" \
  >"$ROUTE_LOG" 2>&1 &
echo $! > "$PIDFILE_ROUTE"
sleep 0.3
[[ -S "$ROUTE_SOCK" ]] || fail "routed did not bind $ROUTE_SOCK (see $ROUTE_LOG)"
ok "routed listening at $ROUTE_SOCK (pid $(cat "$PIDFILE_ROUTE"))"

# ---- 3. boot BytePort backend (Gin + UDSProxy) -----------------------------

step "Boot BytePort backend (Gin) on :18080"
BYTEPORT_PORT=18080 \
  OMNIROUTE_DATA_PLANE_SOCKET="$ROUTE_SOCK" \
  NVMS_SOCKET="$NVMS_SOCK" \
  "$BYTEPORT_GO_BIN" \
  >"$BYTEPORT_LOG" 2>&1 &
echo $! > "$PIDFILE_BYTEPORT"

if ! wait_http "http://127.0.0.1:18080/healthz" 200 "$SMOKE_TIMEOUT"; then
  fail "BytePort /healthz never returned 200 (see $BYTEPORT_LOG)"
fi
ok "BytePort /healthz returned 200 (pid $(cat "$PIDFILE_BYTEPORT"))"

# ---- 4. verify routed is reachable via the UDS proxy -----------------------

step "Verify routed via UDSProxy passthrough"
# Hit the data plane directly over UDS — bypasses BytePort for a tight inner check.
HEALTH="$(curl -s --unix-socket "$ROUTE_SOCK" -X GET http://nvms/healthz)"
echo "$HEALTH" | jq -e '.status == "ok"' >/dev/null \
  || fail "routed /healthz did not return ok: $HEALTH"
ok "routed /healthz OK over UDS"

# ---- 5. verify NVMS daemon via UDS -----------------------------------------

step "Verify NVMS daemon via UDS"
NVMS_HEALTH="$(curl -s --unix-socket "$NVMS_SOCK" -X GET http://nvms/healthz)"
echo "$NVMS_HEALTH" | jq -e '.status == "ok"' >/dev/null \
  || fail "NVMS /healthz did not return ok: $NVMS_HEALTH"
ok "NVMS /healthz OK over UDS"

# ---- 6. full LLM round-trip via BytePort + routed + Ollama/OpenAI ---------

if [[ $SKIP_LLM_CALL -eq 1 ]]; then
  step "Skip LLM call (--skip-llm-call)"
else
  step "LLM round-trip via BytePort → routed → upstream"

  # Prefer OpenAI if API key is set; else Ollama
  if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    UPSTREAM_BASE="$OPENAI_BASE_URL"
    MODEL="${SMOKE_MODEL:-gpt-4o-mini}"
    AUTH="Authorization: Bearer $OPENAI_API_KEY"
  else
    UPSTREAM_BASE="$OLLAMA_BASE_URL"
    MODEL="${SMOKE_MODEL:-llama3.2:3b}"
    AUTH=""
  fi

  REQUEST_BODY=$(jq -n \
    --arg model "$MODEL" \
    '{model:$model, messages:[{role:"user", content:"Reply with the single word: ok"}], stream:false, max_tokens:8}')

  # The routed binary uses the X-OmniRoute-Provider header to pick the provider.
  RESP="$(curl -sS \
      -H 'Content-Type: application/json' \
      -H 'X-OmniRoute-Provider: openai' \
      ${AUTH:+-H "$AUTH"} \
      -d "$REQUEST_BODY" \
      --max-time "$SMOKE_TIMEOUT" \
      http://127.0.0.1:18080/v1/chat/completions)" \
    || fail "BytePort /v1/chat/completions did not respond"

  echo "$RESP" | jq -e '.choices[0].message.content' >/dev/null \
    || fail "No assistant content in response: $RESP"
  ok "LLM round-trip OK: $(echo "$RESP" | jq -r '.choices[0].message.content')"
fi

# ---- 7. metrics endpoint ---------------------------------------------------

step "Metrics endpoint (Prometheus text format)"
METRICS="$(curl -s --unix-socket "$ROUTE_SOCK" -X GET http://nvms/metrics)"
echo "$METRICS" | grep -q '^# HELP ' || fail "Metrics response missing HELP lines"
echo "$METRICS" | grep -q 'omniroute_' || fail "Metrics missing omniroute_ prefix"
ok "Metrics endpoint returned Prometheus text with $(echo "$METRICS" | wc -l) lines"

# ---- 8. shutdown -----------------------------------------------------------

step "Shutdown"
for pf in "$PIDFILE_BYTEPORT" "$PIDFILE_ROUTE" "$PIDFILE_NVMS"; do
  [[ -f "$pf" ]] && kill -TERM "$(cat "$pf")" 2>/dev/null || true
done
sleep 0.5
for pf in "$PIDFILE_BYTEPORT" "$PIDFILE_ROUTE" "$PIDFILE_NVMS"; do
  [[ -f "$pf" ]] && kill -KILL "$(cat "$pf")" 2>/dev/null || true
done
ok "All daemons stopped"

echo
ok "Phenotype stack smoke green. Logs were at $TMPDIR (kept due to --keep-stacks if set)."