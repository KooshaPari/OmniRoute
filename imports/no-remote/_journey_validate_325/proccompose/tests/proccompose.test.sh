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
# Three requests over stdin/stdout, all must return valid single-line JSON
stdio_out=$(printf '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":"2","method":"tools/list","params":{}}\n{"jsonrpc":"2.0","id":"3","method":"ping","params":{}}\n' | timeout 5 "$PROCCOMPOSE_BIN" serve-stdio 2>/dev/null)
echo "$stdio_out" | grep -q '"id":"1","result":{ *"protocolVersion"' && report "stdio: initialize response" ok || report "stdio: initialize response" fail
echo "$stdio_out" | grep -qE '"id":"2".*"tools".*\[' && report "stdio: tools/list returns tools array" ok || report "stdio: tools/list returns tools array" fail
echo "$stdio_out" | grep -q '"id":"3","result":{}' && report "stdio: ping response" ok || report "stdio: ping response" fail

echo "[6/8] MCP SSE transport - HTTP/SSE round-trip"
# Start the SSE transport on a free port and exercise the endpoints
SSE_PORT=14399
"$PROCCOMPOSE_BIN" serve-sse "$SSE_PORT" > /tmp/proc-sse-test.log 2>&1 &
SSE_PID=$!
# Wait for the port to bind (max 3s)
for i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 1 http://127.0.0.1:$SSE_PORT/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done
# /health
h=$(curl -fsS --max-time 2 http://127.0.0.1:$SSE_PORT/health 2>&1)
echo "$h" | grep -q '"ok": true' && report "sse: /health returns ok" ok || report "sse: /health returns ok (got: $h)" fail
# /tools
t=$(curl -fsS --max-time 2 http://127.0.0.1:$SSE_PORT/tools 2>&1)
echo "$t" | python3 -c "import sys,json;d=json.load(sys.stdin);n=len(d.get('tools',[]));sys.exit(0 if n>=10 else 1)" 2>/dev/null && report "sse: /tools returns 10+ tools" ok || report "sse: /tools returns 10+ tools (got: $t)" fail
# POST /jsonrpc initialize
init_resp=$(curl -fsS --max-time 2 -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"r1","method":"initialize","params":{}}' http://127.0.0.1:$SSE_PORT/jsonrpc 2>&1)
echo "$init_resp" | grep -qE "id.:[[:space:]]*.r1." && report "sse: POST /jsonrpc initialize" ok || report "sse: POST /jsonrpc initialize" fail
# GET /sse (just check it returns text/event-stream headers)
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

echo ""
echo "=================================="
echo "RESULTS:  $PASS passed,  $FAIL failed"
echo "=================================="
exit $FAIL
