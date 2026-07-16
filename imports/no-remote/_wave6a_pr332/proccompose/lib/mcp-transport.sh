# mcp-stdio: real JSON-RPC 2.0 over stdin/stdout.
# Loop: read line from stdin, parse JSON, dispatch to mcp_call, write response.
# Compatible with Claude Desktop / Cursor / any MCP-aware agent.
# Usage: proccompose serve-stdio
# For SSE/HTTP transport, just wrap this loop in a flask/fastapi endpoint
# in a future iteration (mcp serve --transport=sse).

mcp_serve_stdio() {
  log "proccompose MCP server (stdio transport) ready. reading from stdin..."
  while IFS= read -r line; do
    # Parse the JSON-RPC request
    local id
    id=$(printf '%s' "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('id',''))" 2>/dev/null)
    local method
    method=$(printf '%s' "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('method',''))" 2>/dev/null)
    local params
    params=$(printf '%s' "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(json.dumps(d.get('params',{})))" 2>/dev/null)
    if [[ -z "$method" ]]; then
      mcp_stdio_reply "$id" "true" '{"error":{"code":-32700,"message":"parse error"}}'
      continue
    fi
    case "$method" in
      initialize)
        mcp_stdio_reply "$id" "false" '{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"proccompose","version":"1.0.0"}}'
        ;;
      tools/list)
        mcp_stdio_tools_list "$id"
        ;;
      tools/call)
        mcp_stdio_tool_call "$id" "$params"
        ;;
      ping)
        mcp_stdio_reply "$id" "false" '{}'
        ;;
      notifications/cancelled|notifications/initialized)
        # Notifications have no response
        ;;
      *)
        mcp_stdio_reply "$id" "true" "{\"error\":{\"code\":-32601,\"message\":\"method not found: $method\"}}"
        ;;
    esac
  done
  log "proccompose MCP server (stdio) shutting down"
}

mcp_stdio_reply() {
  local id="$1" is_err="$2" result="$3"
  printf '{"jsonrpc":"2.0","id":"%s","%s":%s}\n' "$id" "$([ "$is_err" == "true" ] && echo error || echo result)" "$result"
}

mcp_stdio_tools_list() {
  local id="$1"
  mcp_stdio_reply "$id" "false" '{ "tools": [ {"name":"proccompose_doctor","description":"Check prereqs (pheno + Tailscale + Vercel + yq + proccompose.yaml)","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_deploy","description":"Atomic deploy of a git ref to the desktop (build, restart, health, rollback)","inputSchema":{"type":"object","properties":{"ref":{"type":"string"},"slot":{"type":"string"}},"required":["ref"]}}, {"name":"proccompose_release","description":"Deploy + cutover in one shot","inputSchema":{"type":"object","properties":{"ref":{"type":"string"},"rollout_pct":{"type":"integer"},"slot":{"type":"string"}},"required":["ref"]}}, {"name":"proccompose_cutover","description":"Flip OMNI_WEB_STACK_ROLLOUT on Vercel","inputSchema":{"type":"object","properties":{"pct":{"type":"integer"},"slot":{"type":"string"}},"required":["pct"]}}, {"name":"proccompose_rollback","description":"Atomic rollback to previous release","inputSchema":{"type":"object","properties":{"slot":{"type":"string"}}}}, {"name":"proccompose_status","description":"Health snapshot (JSON)","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_releases","description":"Release history for a slot","inputSchema":{"type":"object","properties":{"slot":{"type":"string"}}}}, {"name":"proccompose_logs","description":"Tail a desktop service log","inputSchema":{"type":"object","properties":{"service":{"type":"string"},"tail_lines":{"type":"integer"}}}}, {"name":"proccompose_url","description":"Print current BFF URL","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_dry_run","description":"Print the full execution graph","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_matrix","description":"Run an action across all slots","inputSchema":{"type":"object","properties":{"action":{"type":"string"}}}}, {"name":"proccompose_init","description":"Bootstrap a fresh host","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_auto_rollback","description":"Poll SLOs, revert on breach","inputSchema":{"type":"object","properties":{"slot":{"type":"string"},"pct":{"type":"integer"}}}}, {"name":"proccompose_test","description":"Run the v4 test suite (pre-deploy verifier)","inputSchema":{"type":"object","properties":{}}}, {"name":"proccompose_diff","description":"Show plan-vs-current-state for a slot","inputSchema":{"type":"object","properties":{"slot":{"type":"string"}}}} ] }'
}

mcp_stdio_tool_call() {
  local id="$1" params="$2"
  local name
  name=$(printf '%s' "$params" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('name',''))" 2>/dev/null)
  local args
  args=$(printf '%s' "$params" | python3 -c "import sys,json; print(json.dumps(json.loads(sys.stdin.read()).get('arguments',{})))" 2>/dev/null)
  if [[ -z "$name" ]]; then
    mcp_stdio_reply "$id" "true" '{"error":{"code":-32602,"message":"missing tool name"}}'
    return
  fi
  # Map MCP tool name to proccompose subcommand
  local cmd
  case "$name" in
    proccompose_doctor) cmd="doctor" ;;
    proccompose_deploy) cmd="deploy" ;;
    proccompose_release) cmd="release" ;;
    proccompose_cutover) cmd="cutover" ;;
    proccompose_rollback) cmd="rollback" ;;
    proccompose_status) cmd="status" ;;
    proccompose_releases) cmd="releases" ;;
    proccompose_logs) cmd="logs" ;;
    proccompose_url) cmd="url" ;;
    proccompose_dry_run) cmd="dry-run" ;;
    proccompose_matrix) cmd="matrix" ;;
    proccompose_init) cmd="init" ;;
    proccompose_auto_rollback) cmd="auto-rollback" ;;
    proccompose_test) cmd="test" ;;
    proccompose_diff) cmd="diff" ;;
    *) mcp_stdio_reply "$id" "true" "{\"error\":{\"code\":-32601,\"message\":\"unknown tool: $name\"}}"; return ;;
  esac
  # Run the command, capture output + exit code, return as MCP result
  local output
  output=$(eval "cmd_$cmd $args" 2>&1)
  local code=$?
  local text
  text=$(printf '%s' "$output" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
  mcp_stdio_reply "$id" "false" "{\"content\":[{\"type\":\"text\",\"text\":$text}],\"isError\":$([[ $code -ne 0 ]] && echo true || echo false)}"
}
