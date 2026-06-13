#!/bin/bash
set -euo pipefail
# agent-orchestrator.sh - Service-style management for external CLI agents
#
# Provides bash-native introspection and control of cursor-agent and codex
# processes, enabling DAG-based parallel orchestration without relying on
# client-specific background task handling.
#
# Usage:
#   ./agent-orchestrator.sh start <name> <cli> "<prompt>"
#   ./agent-orchestrator.sh stop <name>
#   ./agent-orchestrator.sh status [name]
#   ./agent-orchestrator.sh logs <name> [--follow]
#   ./agent-orchestrator.sh wait [name...]
#   ./agent-orchestrator.sh cleanup
#
# Examples:
#   ./agent-orchestrator.sh start researcher cursor "Research the codebase"
#   ./agent-orchestrator.sh start builder codex "Implement the feature"
#   ./agent-orchestrator.sh status
#   ./agent-orchestrator.sh wait researcher builder
#   ./agent-orchestrator.sh logs researcher --follow

set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

AGENT_DIR="${AGENT_DIR:-$(pwd)/.agents}"
CURSOR_MODEL="${CURSOR_MODEL:-auto}"
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

ensure_dir() {
  mkdir -p "${AGENT_DIR}"
}

get_pid_file() { echo "${AGENT_DIR}/$1.pid"; }
get_log_file() { echo "${AGENT_DIR}/$1.log"; }
get_status_file() { echo "${AGENT_DIR}/$1.status"; }
get_output_file() { echo "${AGENT_DIR}/$1.output.md"; }

is_running() {
  local name="$1"
  local pid_file=$(get_pid_file "${name}")
  [[ -f "${pid_file}" ]] && kill -0 "$(cat "${pid_file}")" 2>/dev/null
}

# ═══════════════════════════════════════════════════════════════════════════════
# Agent Commands
# ═══════════════════════════════════════════════════════════════════════════════

cmd_start() {
  local name="$1"
  local cli="$2"
  local prompt="$3"

  if [[ -z "${name}" || -z "${cli}" || -z "${prompt}" ]]; then
    log_error "Usage: $0 start <name> <cursor|codex> \"<prompt>\""
    exit 1
  fi

  ensure_dir

  if is_running "${name}"; then
    log_warn "Agent '${name}' is already running (PID $(cat $(get_pid_file "${name}")))"
    return 1
  fi

  local pid_file=$(get_pid_file "${name}")
  local log_file=$(get_log_file "${name}")
  local status_file=$(get_status_file "${name}")
  local output_file=$(get_output_file "${name}")

  # Initialize status
  echo '{"status":"starting","started_at":"'$(date -Iseconds)'"}' >"${status_file}"

  case "${cli}" in
    cursor | cursor-agent)
      log_info "Starting cursor-agent '${name}' with model=${CURSOR_MODEL}"
      (
        echo '{"status":"running","cli":"cursor-agent","model":"'"${CURSOR_MODEL}"'"}' >"${status_file}"
        cursor-agent -p -m "${CURSOR_MODEL}" --force --output-format stream-json "${prompt}" \
          >"${log_file}" 2>&1
        exit_code=$?
        if [[ ${exit_code} -eq 0 ]]; then
          echo '{"status":"completed","exit_code":0,"finished_at":"'$(date -Iseconds)'"}' >"${status_file}"
        else
          echo '{"status":"failed","exit_code":'"${exit_code}"',"finished_at":"'$(date -Iseconds)'"}' >"${status_file}"
        fi
      ) &
      ;;

    codex)
      log_info "Starting codex '${name}' with sandbox=${CODEX_SANDBOX}"
      (
        echo '{"status":"running","cli":"codex","sandbox":"'"${CODEX_SANDBOX}"'"}' >"${status_file}"
        codex exec --full-auto --search --json \
          --sandbox "${CODEX_SANDBOX}" \
          -o "${output_file}" \
          "${prompt}" \
          >"${log_file}" 2>&1
        exit_code=$?
        if [[ ${exit_code} -eq 0 ]]; then
          echo '{"status":"completed","exit_code":0,"finished_at":"'$(date -Iseconds)'"}' >"${status_file}"
        else
          echo '{"status":"failed","exit_code":'"${exit_code}"',"finished_at":"'$(date -Iseconds)'"}' >"${status_file}"
        fi
      ) &
      ;;

    *)
      log_error "Unknown CLI: ${cli}. Use 'cursor' or 'codex'"
      exit 1
      ;;
  esac

  echo $! >"${pid_file}"
  log_success "Agent '${name}' started with PID $(cat "${pid_file}")"
}

cmd_stop() {
  local name="$1"

  if [[ -z "${name}" ]]; then
    log_error "Usage: $0 stop <name>"
    exit 1
  fi

  local pid_file=$(get_pid_file "${name}")
  local status_file=$(get_status_file "${name}")

  if [[ ! -f "${pid_file}" ]]; then
    log_warn "Agent '${name}' not found"
    return 1
  fi

  local pid=$(cat "${pid_file}")

  if kill -0 "${pid}" 2>/dev/null; then
    log_info "Stopping agent '${name}' (PID ${pid})..."
    kill "${pid}" 2>/dev/null || true

    # Wait for graceful shutdown
    for i in {1..10}; do
      if ! kill -0 "${pid}" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done

    # Force kill if still running
    if kill -0 "${pid}" 2>/dev/null; then
      log_warn "Force killing agent '${name}'..."
      kill -9 "${pid}" 2>/dev/null || true
    fi

    echo '{"status":"stopped","finished_at":"'$(date -Iseconds)'"}' >"${status_file}"
    log_success "Agent '${name}' stopped"
  else
    log_info "Agent '${name}' was not running"
  fi

  rm -f "${pid_file}"
}

cmd_status() {
  local name="$1"
  ensure_dir

  if [[ -n "${name}" ]]; then
    # Single agent status
    local pid_file=$(get_pid_file "${name}")
    local status_file=$(get_status_file "${name}")
    local log_file=$(get_log_file "${name}")

    echo "=== Agent: ${name} ==="

    if [[ -f "${status_file}" ]]; then
      echo "Status: $(cat "${status_file}" | jq -r '.status // "unknown"' 2>/dev/null || cat "${status_file}")"
    else
      echo "Status: not found"
    fi

    if [[ -f "${pid_file}" ]]; then
      local pid=$(cat "${pid_file}")
      if kill -0 "${pid}" 2>/dev/null; then
        echo "PID: ${pid} (running)"
      else
        echo "PID: ${pid} (exited)"
      fi
    fi

    if [[ -f "${log_file}" ]]; then
      echo "Log: ${log_file} ($(wc -l <"${log_file}") lines)"
    fi

    if [[ -f "${status_file}" ]]; then
      echo "Full status:"
      cat "${status_file}" | jq '.' 2>/dev/null || cat "${status_file}"
    fi
  else
    # All agents status
    echo "=== All Agents ==="
    local found=false

    for pid_file in "${AGENT_DIR}"/*.pid; do
      [[ -f "${pid_file}" ]] || continue
      found=true

      local agent_name=$(basename "${pid_file}" .pid)
      local pid=$(cat "${pid_file}")
      local status_file=$(get_status_file "${agent_name}")
      local status="unknown"

      if [[ -f "${status_file}" ]]; then
        status=$(cat "${status_file}" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
      fi

      if kill -0 "${pid}" 2>/dev/null; then
        echo -e "  ${GREEN}${agent_name}${NC}: ${status} (PID ${pid}, running)"
      else
        case "${status}" in
          completed)
            echo -e "  ${GREEN}${agent_name}${NC}: ${status}"
            ;;
          failed)
            echo -e "  ${RED}${agent_name}${NC}: ${status}"
            ;;
          *)
            echo -e "  ${YELLOW}${agent_name}${NC}: ${status} (exited)"
            ;;
        esac
      fi
    done

    if ! ${found}; then
      echo "  No agents found in ${AGENT_DIR}"
    fi
  fi
}

cmd_logs() {
  local name="$1"
  local follow="$2"

  if [[ -z "${name}" ]]; then
    log_error "Usage: $0 logs <name> [--follow]"
    exit 1
  fi

  local log_file=$(get_log_file "${name}")

  if [[ ! -f "${log_file}" ]]; then
    log_error "No logs found for agent '${name}'"
    exit 1
  fi

  if [[ "${follow}" == "--follow" || "${follow}" == "-f" ]]; then
    log_info "Tailing logs for '${name}' (Ctrl+C to stop)..."
    tail -f "${log_file}"
  else
    cat "${log_file}"
  fi
}

cmd_wait() {
  local names=("$@")

  if [[ ${#names[@]} -eq 0 ]]; then
    # Wait for all agents
    log_info "Waiting for all agents to complete..."
    for pid_file in "${AGENT_DIR}"/*.pid; do
      [[ -f "${pid_file}" ]] || continue
      local agent_name=$(basename "${pid_file}" .pid)
      names+=("${agent_name}")
    done
  fi

  if [[ ${#names[@]} -eq 0 ]]; then
    log_info "No agents to wait for"
    return 0
  fi

  log_info "Waiting for agents: ${names[*]}"

  local all_done=false
  while ! ${all_done}; do
    all_done=true
    for name in "${names[@]}"; do
      if is_running "${name}"; then
        all_done=false
        break
      fi
    done

    if ! ${all_done}; then
      sleep 1
    fi
  done

  log_success "All specified agents completed"

  # Print final statuses
  echo ""
  echo "=== Final Status ==="
  for name in "${names[@]}"; do
    local status_file=$(get_status_file "${name}")
    if [[ -f "${status_file}" ]]; then
      local status=$(cat "${status_file}" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
      local exit_code=$(cat "${status_file}" | jq -r '.exit_code // "?"' 2>/dev/null || echo "?")
      echo "  ${name}: ${status} (exit=${exit_code})"
    else
      echo "  ${name}: unknown"
    fi
  done
}

cmd_cleanup() {
  ensure_dir
  log_info "Cleaning up agent artifacts in ${AGENT_DIR}..."

  # Stop running agents
  for pid_file in "${AGENT_DIR}"/*.pid; do
    [[ -f "${pid_file}" ]] || continue
    local name=$(basename "${pid_file}" .pid)
    if is_running "${name}"; then
      cmd_stop "${name}"
    fi
  done

  # Remove all files
  rm -f "${AGENT_DIR}"/*.pid "${AGENT_DIR}"/*.log "${AGENT_DIR}"/*.status "${AGENT_DIR}"/*.output.md

  log_success "Cleanup complete"
}

cmd_run_dag() {
  # Run a DAG from a YAML/JSON spec file
  local spec_file="$1"

  if [[ -z "${spec_file}" || ! -f "${spec_file}" ]]; then
    log_error "Usage: $0 run-dag <spec.json>"
    exit 1
  fi

  log_info "Running DAG from ${spec_file}"

  # Parse phases from spec (expects JSON with phases array)
  local phases=$(cat "${spec_file}" | jq -r '.phases | length')

  for ((phase = 0; phase < phases; phase++)); do
    log_info "=== Phase $((phase + 1))/${phases} ==="

    # Get agents for this phase
    local agents=$(cat "${spec_file}" | jq -r ".phases[${phase}].agents | keys[]")
    local pids=()

    for agent in ${agents}; do
      local cli=$(cat "${spec_file}" | jq -r ".phases[${phase}].agents[\"${agent}\"].cli")
      local prompt=$(cat "${spec_file}" | jq -r ".phases[${phase}].agents[\"${agent}\"].prompt")

      cmd_start "${agent}" "${cli}" "${prompt}"
      pids+=($(cat $(get_pid_file "${agent}")))
    done

    # Check if this phase should block
    local blocking
    blocking=$(jq -r ".phases[${phase}].blocking // true" "${spec_file}")

    if [[ "${blocking}" == "true" ]]; then
      log_info "Waiting for phase $((phase + 1)) to complete..."
      for agent in ${agents}; do
        cmd_wait "${agent}"
      done
    fi
  done

  log_success "DAG execution complete"
}

cmd_help() {
  cat <<'EOF'
Agent Orchestrator - Service-style management for CLI agents

USAGE:
    agent-orchestrator.sh <command> [arguments]

COMMANDS:
    start <name> <cli> "<prompt>"   Start a new agent
                                    cli: cursor | codex

    stop <name>                     Stop a running agent

    status [name]                   Show status of one or all agents

    logs <name> [--follow]          View agent logs

    wait [name...]                  Wait for agents to complete

    cleanup                         Stop all agents and remove artifacts

    run-dag <spec.json>             Run a DAG from specification file

    help                            Show this help message

ENVIRONMENT VARIABLES:
    AGENT_DIR       Directory for agent files (default: ./.agents)
    CURSOR_MODEL    Model for cursor-agent (default: auto)
    CODEX_SANDBOX   Sandbox level for codex (default: workspace-write)

EXAMPLES:
    # Start a research agent
    ./agent-orchestrator.sh start researcher cursor "Analyze the codebase"

    # Start a builder agent with codex
    ./agent-orchestrator.sh start builder codex "Implement feature X"

    # Monitor all agents
    ./agent-orchestrator.sh status

    # Wait for specific agents
    ./agent-orchestrator.sh wait researcher builder

    # Follow logs in real-time
    ./agent-orchestrator.sh logs researcher --follow

    # Clean up all agents
    ./agent-orchestrator.sh cleanup

DAG SPECIFICATION FORMAT (JSON):
    {
      "phases": [
        {
          "blocking": true,
          "agents": {
            "researcher": {
              "cli": "cursor",
              "prompt": "Research the codebase"
            }
          }
        },
        {
          "blocking": true,
          "agents": {
            "builder": {"cli": "cursor", "prompt": "Build feature"},
            "tester": {"cli": "codex", "prompt": "Write tests"}
          }
        }
      ]
    }

EOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  local cmd="${1:-help}"
  shift || true

  case "${cmd}" in
    start) cmd_start "$@" ;;
    stop) cmd_stop "$@" ;;
    status) cmd_status "$@" ;;
    logs) cmd_logs "$@" ;;
    wait) cmd_wait "$@" ;;
    cleanup) cmd_cleanup ;;
    run-dag) cmd_run_dag "$@" ;;
    help | --help | -h) cmd_help ;;
    *)
      log_error "Unknown command: ${cmd}"
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
