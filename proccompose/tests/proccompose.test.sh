#!/usr/bin/env bash
# proccompose tests - run with `bash tests/proccompose.test.sh` or `bun test tests/proccompose.test.sh`
set -uo pipefail

PROCCOMPOSE_BIN="$(cd "$(dirname "$0")/.." && pwd)/proccompose"
YAML_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.yaml"
EXAMPLE_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.example.yaml"

PASS=0
FAIL=0
report() {
  local label="$1" status="$2"
  if [[ "$status" == "ok" ]]; then
    PASS=$((PASS+1))
    printf "  \033[1;32m[OK]\033[0m   %s\n" "$label"
  else
    FAIL=$((FAIL+1))
    printf "  \033[1;31m[FAIL]\033[0m %s\n" "$label"
  fi
}

echo "[1/8] syntax check"
if bash -n "$PROCCOMPOSE_BIN" 2>/dev/null; then report "bash -n proccompose" ok; else report "bash -n proccompose" fail; fi

echo "[2/8] symlink resolution (validate from script dir + /tmp)"
out1=$("$PROCCOMPOSE_BIN" validate 2>&1)
echo "$out1" | grep -q "OK" && report "validate from script dir" ok || report "validate from script dir (out: $out1)" fail
( cd /tmp && out2=$("$PROCCOMPOSE_BIN" validate 2>&1) && echo "$out2" | grep -q "OK" && report "validate from /tmp" ok || report "validate from /tmp (out: $out2)" fail )

echo "[3/8] plan produces expected output"
out=$("$PROCCOMPOSE_BIN" plan 2>&1)
echo "$out" | grep -q "bff  host=desktop" && report "plan includes bff" ok || report "plan includes bff" fail
echo "$out" | grep -q "kbridge  host=desktop" && report "plan includes kbridge" ok || report "plan includes kbridge" fail
echo "$out" | grep -q "tailscale_funnel  host=desktop" && report "plan includes tailscale_funnel" ok || report "plan includes tailscale_funnel" fail
echo "$out" | grep -q "vercel_projects:" && report "plan includes vercel_projects" ok || report "plan includes vercel_projects" fail
echo "$out" | grep -q "cutover phases:" && report "plan includes cutover phases" ok || report "plan includes cutover phases" fail
echo "$out" | grep -q "argismonitor-homepage" && report "plan includes argismonitor-homepage" ok || report "plan includes argismonitor-homepage" fail

echo "[4/8] example.yaml is also valid"
if python3 -c "import yaml; yaml.safe_load(open('$EXAMPLE_FILE'))" 2>/dev/null; then report "example.yaml parses" ok; else report "example.yaml parses" fail; fi

echo "[5/8] MCP stdio transport - JSON-RPC 2.0 round-trip"
stdio_out=$(printf '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":"2","method":"tools/list","params":{}}\n{"jsonrpc":"2.0","id":"3","method":"ping","params":{}}\n' | timeout 5 "$PROCCOMPOSE_BIN" serve-stdio 2>/dev/null)
echo "$stdio_out" | grep -q '"id":"1","result":{ *"protocolVersion"' && report "stdio: initialize response" ok || report "stdio: initialize response" fail
echo "$stdio_out" | grep -qE '"id":"2".*"tools".*\[' && report "stdio: tools/list returns tools array" ok || report "stdio: tools/list returns tools array" fail
echo "$stdio_out" | grep -q '"id":"3","result":{}' && report "stdio: ping response" ok || report "stdio: ping response" fail

echo "[6/8] MCP SSE transport - HTTP/SSE round-trip"
SSE_PORT=14399
"$PROCCOMPOSE_BIN" serve-sse "$SSE_PORT" > /tmp/proc-sse-test.log 2>&1 &
SSE_PID=$!
for i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 1 http://127.0.0.1:$SSE_PORT/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done
h=$(curl -fsS --max-time 2 http://127.0.0.1:$SSE_PORT/health 2>&1)
echo "$h" | grep -q '"ok": true' && report "sse: /health returns ok" ok || report "sse: /health returns ok (got: $h)" fail
for attempt in 1 2 3 4 5; do
  t=$(curl -fsS --max-time 3 http://127.0.0.1:$SSE_PORT/tools 2>&1) && break
  sleep 0.5
done
echo "$t" | python3 -c "import sys,json;d=json.load(sys.stdin);n=len(d.get('tools',[]));sys.exit(0 if n>=10 else 1)" 2>/dev/null && report "sse: /tools returns 10+ tools" ok || report "sse: /tools returns 10+ tools (got: $t)" fail
init_resp=$(curl -fsS --max-time 2 -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"r1","method":"initialize","params":{}}' http://127.0.0.1:$SSE_PORT/jsonrpc 2>&1)
echo "$init_resp" | grep -qE "id.:[[:space:]]*.r1." && report "sse: POST /jsonrpc initialize" ok || report "sse: POST /jsonrpc initialize" fail
sse_hdr=$(curl -sS --max-time 2 -D - -o /dev/null "http://127.0.0.1:$SSE_PORT/sse?method=ping&id=sse1" 2>&1 | head -10)
echo "$sse_hdr" | grep -qi 'Content-Type: text/event-stream' && report "sse: GET /sse returns event-stream" ok || report "sse: GET /sse returns event-stream" fail
kill $SSE_PID 2>/dev/null; wait $SSE_PID 2>/dev/null

echo "[7/8] help text lists the new subcommands"
help_out=$("$PROCCOMPOSE_BIN" help 2>&1)
for sub in serve-stdio serve-sse mcp-server mcp-call deploy release releases rollback matrix test diff auto-rollback; do
  echo "$help_out" | grep -q " $sub " && report "help: lists '$sub'" ok || report "help: lists '$sub'" fail
done

echo "[8/8] mcp_sse_server.py exists and is valid Python"
if python3 -c "import ast; ast.parse(open('$(dirname "$0")/../lib/mcp_sse_server.py').read())" 2>/dev/null; then report "mcp_sse_server.py parses" ok; else report "mcp_sse_server.py parses" fail; fi
if [[ -f "$(dirname "$0")/../lib/mcp_sse_server.py" ]]; then report "mcp_sse_server.py exists" ok; else report "mcp_sse_server.py exists" fail; fi
if [[ -f "$(dirname "$0")/../lib/mcp-sse-transport.sh" ]]; then report "mcp-sse-transport.sh exists" ok; else report "mcp-sse-transport.sh exists" fail; fi

echo "[9/10] pre-deploy test gate (cmd_deploy refuses when tests fail)"
# Skip this section if already nested in an inner test run (recursion guard)
if [[ "${PROCCOMPOSE_TEST_INNER:-0}" == "1" ]]; then
  log "  (nested test context - skipping deploy-gate recursion guard)"
else
  deploy_src=$(grep -A 30 "^cmd_deploy()" "$PROCCOMPOSE_BIN" 2>/dev/null)
  echo "$deploy_src" | grep -q "running pre-deploy verifier" && report "gate: cmd_deploy runs cmd_test first" ok || report "gate: cmd_deploy runs cmd_test first" fail
  echo "$deploy_src" | grep -q "PROCCOMPOSE_SKIP_TESTS=1" && report "gate: cmd_deploy has SKIP_TESTS escape hatch" ok || report "gate: cmd_deploy has SKIP_TESTS escape hatch" fail
  echo "$deploy_src" | grep -q "pre-deploy test gate FAILED" && report "gate: cmd_deploy refuses on test failure" ok || report "gate: cmd_deploy refuses on test failure" fail
  skip_out=$(PROCCOMPOSE_TEST_INNER=1 PROCCOMPOSE_SKIP_TESTS=1 timeout 8 "$PROCCOMPOSE_BIN" deploy origin/feat/v4-svelte-hono-monorepo 2>&1 || true)
  echo "$skip_out" | grep -q "skipping pre-deploy test gate" && report "gate: PROCCOMPOSE_SKIP_TESTS=1 bypasses with warning" ok || report "gate: PROCCOMPOSE_SKIP_TESTS=1 bypasses with warning" fail
  echo "$skip_out" | grep -q "NOT recommended" && report "gate: PROCCOMPOSE_SKIP_TESTS=1 logs warning" ok || report "gate: PROCCOMPOSE_SKIP_TESTS=1 logs warning" fail
fi

echo "[10/11] cmd_test runs BFF + web typecheck gates"
# Verify cmd_test invokes the actual typecheck scripts (not just stubbed tests)
test_src=$(grep -A 80 "^cmd_test()" "$PROCCOMPOSE_BIN" 2>/dev/null)
echo "$test_src" | grep -q "BFF typecheck" && report "test: cmd_test runs BFF typecheck" ok || report "test: cmd_test runs BFF typecheck" fail
echo "$test_src" | grep -q "web typecheck" && report "test: cmd_test runs web typecheck" ok || report "test: cmd_test runs web typecheck" fail
echo "$test_src" | grep -q "bun run typecheck" && report "test: cmd_test invokes bun run typecheck" ok || report "test: cmd_test invokes bun run typecheck" fail
echo "$test_src" | grep -qE "\\[1/5\\]|\\[2/5\\]|\\[3/5\\]|\\[4/5\\]|\\[5/5\\]" && report "test: cmd_test has 5 gates" ok || report "test: cmd_test has 5 gates" fail

echo "[11/12] matrix canary (proccompose matrix status + help)"
status_out=$(PROCCOMPOSE_HOME="/tmp/.proccompose-test" "$PROCCOMPOSE_BIN" matrix status 2>&1 || true)
echo "$status_out" | grep -q "current matrix state" && report "matrix: status reports state" ok || report "matrix: status reports state" fail
help_out=$("$PROCCOMPOSE_BIN" help 2>&1)
for sub in "matrix status" "matrix deploy" "matrix canary" "matrix full" "matrix abort"; do
  echo "$help_out" | grep -q "$sub " && report "matrix: help lists '$sub'" ok || report "matrix: help lists '$sub'" fail
done
canary_help=$(echo "$help_out" | grep -A 1 "matrix canary" | head -1)
echo "$canary_help" | grep -qE "1\\.\\.[0-9]+|pct|traffic" && report "matrix: canary help mentions pct/traffic" ok || report "matrix: canary help mentions pct/traffic" fail

echo "[12/12] GitHub Actions CI workflow exists"
WF="$(dirname "$0")/../../.github/workflows/proccompose-deploy-gate.yml"
if [[ -f "$WF" ]]; then report "ci: proccompose-deploy-gate.yml exists" ok; else report "ci: proccompose-deploy-gate.yml exists" fail; fi
grep -q "proccompose ci" "$WF" && report "ci: workflow runs proccompose ci" ok || report "ci: workflow runs proccompose ci" fail
grep -q "proccompose deploy" "$WF" && report "ci: workflow tests the deploy gate" ok || report "ci: workflow tests the deploy gate" fail
grep -q "serve-stdio\|serve-sse" "$WF" && report "ci: workflow tests MCP transports" ok || report "ci: workflow tests MCP transports" fail

echo ""
echo "=================================="
echo "RESULTS:  $PASS passed,  $FAIL failed"
echo "=================================="
exit $FAIL
