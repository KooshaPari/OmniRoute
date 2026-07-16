#!/usr/bin/env bash
# proccompose mcp-server - exposes the proccompose CLI as MCP tools.
# AI agents (Claude, GPT, etc.) can drive deploys, cutovers, rollbacks,
# status checks, and log tails via the standard MCP protocol.
# Usage: proccompose mcp-server [start|stdio|sse]
# Default: stdio (for in-process agents like Claude Desktop)
# sse: streamable HTTP for cross-machine agents

mcp_server() {
  local transport="${1:-stdio}"
  cat <<PROTO
{
  "jsonrpc": "2.0",
  "id": "proccompose-server",
  "result": {
    "name": "proccompose",
    "version": "1.0.0",
    "transport": "$transport",
    "tools": [
      {
        "name": "proccompose_doctor",
        "description": "Check prereqs (pheno + Tailscale + Vercel + yq + proccompose.yaml). Returns a list of missing deps.",
        "parameters": {}
      },
      {
        "name": "proccompose_deploy",
        "description": "Atomic deploy of a git ref to the desktop. Includes build, restart, health check, and rollback safety. Idempotent: re-running with the same ref is a no-op.",
        "parameters": {
          "ref": {"type": "string", "description": "git ref to deploy (e.g. origin/feat/v4-svelte-hono-monorepo, v0.1.0)"},
          "slot": {"type": "string", "description": "deploy slot: dev|staging|prod", "default": "dev"}
        },
        "required": ["ref"]
      },
      {
        "name": "proccompose_release",
        "description": "Deploy + cutover in one shot. The canonical 'release a version' entry point.",
        "parameters": {
          "ref": {"type": "string", "description": "git ref to release"},
          "rollout_pct": {"type": "integer", "description": "0|1|10|50|100", "default": 1},
          "slot": {"type": "string", "description": "deploy slot", "default": "dev"}
        },
        "required": ["ref"]
      },
      {
        "name": "proccompose_cutover",
        "description": "Flip OMNI_WEB_STACK_ROLLOUT on all matching Vercel projects for a slot.",
        "parameters": {
          "pct": {"type": "integer", "description": "0|1|10|50|100"},
          "slot": {"type": "string", "description": "deploy slot", "default": "dev"}
        },
        "required": ["pct"]
      },
      {
        "name": "proccompose_rollback",
        "description": "Atomic rollback to the previous release on the desktop. Reverts deploy + cutover in lockstep.",
        "parameters": {"slot": {"type": "string", "default": "dev"}}
      },
      {
        "name": "proccompose_status",
        "description": "Health snapshot of all desktop services (BFF + kbridge + Next.js). Returns a JSON object.",
        "parameters": {}
      },
      {
        "name": "proccompose_releases",
        "description": "Show release history (timestamp, ref, version, operator) for a slot. Keeps last 5 releases.",
        "parameters": {"slot": {"type": "string", "default": "dev"}}
      },
      {
        "name": "proccompose_logs",
        "description": "Tail a desktop service log (BFF, gateway, or nextjs). Returns the last N lines (or streams).",
        "parameters": {
          "service": {"type": "string", "description": "bff|gateway|nextjs", "default": "bff"},
          "tail_lines": {"type": "integer", "description": "lines to return", "default": 100}
        }
      },
      {
        "name": "proccompose_url",
        "description": "Print the current BFF URL (Tailscale hostname:port).",
        "parameters": {}
      },
      {
        "name": "proccompose_dry_run",
        "description": "Print the full execution graph (config + services + vercel projects + cutover phases) without running anything.",
        "parameters": {}
      },
      {
        "name": "proccompose_matrix",
        "description": "Run the same action (status, deploy, release, rollback) across dev+staging+prod slots in lockstep.",
        "parameters": {
          "action": {"type": "string", "description": "status|deploy|release|rollback"},
          "args": {"type": "string", "description": "space-separated args for the action"}
        }
      },
      {
        "name": "proccompose_init",
        "description": "Bootstrap a fresh host into the deploy plane. Installs prereqs, clones v4, symlinks proccompose + argis. Idempotent.",
        "parameters": {}
      },
      {
        "name": "proccompose_auto_rollback",
        "description": "Watch SLOs (error_rate, p95) for ~2 minutes. If a breach is detected (error_rate > 1% or p95 > 800ms), automatically roll back the current release + cutover to 0%.",
        "parameters": {
          "slot": {"type": "string", "default": "dev"},
          "pct": {"type": "integer", "description": "current rollout % (0-100)", "default": 0}
        }
      }
    ]
  }
}
PROTO
  echo
  log "mcp-server is in PROTO-ONLY mode for now (prints the tool manifest)"
  log "to wire it as a real MCP server, set transport=$transport"
  log "and run 'mcp-server $transport' once an MCP transport is added"
}

mcp_call() {
  local tool="$1"
  shift
  case "$tool" in
    proccompose_doctor) cmd_doctor ;;
    proccompose_deploy) cmd_deploy "$@" ;;
    proccompose_release) cmd_release "$@" ;;
    proccompose_cutover) cmd_cutover "$@" ;;
    proccompose_rollback) cmd_rollback "$@" ;;
    proccompose_status) cmd_status ;;
    proccompose_releases) cmd_releases "$@" ;;
    proccompose_logs) shift; cmd_logs "$@" ;;
    proccompose_url) cmd_url ;;
    proccompose_dry_run) cmd_dry_run ;;
    proccompose_matrix) cmd_matrix "$@" ;;
    proccompose_init) cmd_init ;;
    proccompose_auto_rollback) cmd_auto_rollback "$@" ;;
    *) err "unknown MCP tool: $tool"; return 1 ;;
  esac
}
