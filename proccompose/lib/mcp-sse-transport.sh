#!/usr/bin/env bash
# mcp-sse-transport: HTTP/SSE wrapper around the stdio MCP transport.
# Runs a tiny Python HTTP server that proxies JSON-RPC 2.0 requests to
# `proccompose serve-stdio`, exposing:
#   GET  /health      liveness probe
#   GET  /tools       list MCP tools (passthrough)
#   POST /jsonrpc     JSON-RPC 2.0 request/response (single line)
#   GET  /sse         Server-Sent Events stream
#
# Sourced into proccompose.proccompose; exposes `serve_sse_main <port>`.
# Can also be executed directly: `./lib/mcp-sse-transport.sh <port>`.

serve_sse_main() {
  local port="${1:-4323}"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  local here="$(cd "$script_dir/.." && pwd)"
  local py="$here/lib/mcp_sse_server.py"

  log "proccompose SSE transport starting on :$port"
  log "stdio backend: $here/proccompose serve-stdio"

  if [[ ! -f "$py" ]]; then
    err "missing $py - cannot start SSE transport"
    return 1
  fi
  PORT="$port" PROCCOMPOSE_BIN="$here/proccompose" python3 "$py"
}

# Direct-execution entry point (only when run as a script, not sourced).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    ""|help|--help|-h)
      cat <<USAGE
proccompose serve-sse - HTTP/SSE MCP transport

USAGE:
  proccompose serve-sse [port]    # default 4323

ENDPOINTS:
  GET  /health      liveness probe
  GET  /tools       list MCP tools (passthrough to tools/list)
  POST /jsonrpc     JSON-RPC 2.0 request/response (single-line)
  GET  /sse         Server-Sent Events stream

USAGE
      ;;
    *)
      serve_sse_main "$@"
      ;;
  esac
fi
