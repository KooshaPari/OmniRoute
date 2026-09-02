#!/bin/sh
# On-device smoke test for OmniRoute.
# Returns 0 if the binary is healthy, non-zero otherwise.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${OMNIROUTE_BIN:-${REPO_ROOT}/dist/cli.js}"

if [ ! -f "$BIN" ]; then
  echo "[err] no binary at $BIN — build with: bun run build"
  exit 1
fi

echo "[ok] using binary $BIN"
node "$BIN" --version

echo "[ok] starting demo provider"
PORT="${PORT:-20128}"
node "$BIN" demo &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

sleep 1

echo "[ok] health check"
curl -fsS "http://127.0.0.1:${PORT}/health"
echo ""

echo "[ok] demo round-trip"
curl -fsS "http://127.0.0.1:${PORT}/v1/chat/completions" \
  -H "Authorization: Bearer demo" \
  -H "Content-Type: application/json" \
  -d '{"model":"demo-fast","messages":[{"role":"user","content":"hello"}]}'

echo ""
echo "[pass] on-device demo OK"
