#!/usr/bin/env bash
# autoqueue.sh — main orchestrator for automated forge subagent queue management
# Usage: autoqueue.sh {init|start|status|stop|corpus}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${HOME}/.forge/autoqueue/bin"
STATE_DIR="${HOME}/.forge/autoqueue/state"
LOG_DIR="${HOME}/.forge/autoqueue/logs"

# Ensure directories exist
mkdir -p "$STATE_DIR" "$LOG_DIR"

# Check if autoqueue is already running
is_running() {
  pgrep -f "autoqueue.sh.*watch" > /dev/null 2>&1 || \
  pgrep -f "launcher.sh.*all" > /dev/null 2>&1 || \
  pgrep -f "monitor.sh.*watch" > /dev/null 2>&1
}

cmd_init() {
  echo "=== Autoqueue Init ==="
  
  # Build corpus
  echo "Building corpus..."
  "$BIN_DIR/corpus-builder.sh" 2>&1 | tail -5
  
  # Initialize queue
  echo "Initializing queue..."
  "$BIN_DIR/queue-manager.sh" init 2>&1 | tail -5
  
  echo ""
  echo "Queue initialized. Ready to start."
  echo "Run: autoqueue.sh start"
}

cmd_start() {
  if is_running; then
    echo "Autoqueue is already running."
    cmd_status
    return 0
  fi
  
  echo "=== Autoqueue Start ==="
  echo "Starting daemon mode..."
  
  # Launch the all-batch runner with auto-monitor
  nohup "$BIN_DIR/launcher_py.sh" all 10 120 \
    > "$LOG_DIR/autoqueue-$(date +%Y%m%d-%H%M%S).log" 2>&1 &
  
  local pid=$!
  echo "$pid" > "$STATE_DIR/daemon.pid"
  echo "Daemon PID: $pid"
  echo "Log: $LOG_DIR/autoqueue-*.log"
  echo ""
  echo "To stop: autoqueue.sh stop"
}

cmd_stop() {
  echo "=== Autoqueue Stop ==="
  
  # Kill launcher
  pkill -f "launcher.sh all" 2>/dev/null || true
  
  # Kill monitor
  pkill -f "monitor.sh watch" 2>/dev/null || true
  
  # Kill forge subagents
  pkill -f "forge --conversation-id" 2>/dev/null || true
  
  rm -f "$STATE_DIR/daemon.pid"
  echo "Stopped all autoqueue processes."
}

cmd_status() {
  echo "=== Autoqueue Status ==="
  
  # Check daemon
  if [[ -f "$STATE_DIR/daemon.pid" ]]; then
    local pid=$(cat "$STATE_DIR/daemon.pid")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Daemon: RUNNING (PID $pid)"
    else
      echo "Daemon: NOT RUNNING (stale PID file)"
      rm -f "$STATE_DIR/daemon.pid"
    fi
  else
    echo "Daemon: NOT RUNNING"
  fi
  
  # Queue status
  echo ""
  "$BIN_DIR/queue-manager.sh" status 2>&1 || echo "Queue not initialized"
  
  # Running forge processes
  echo ""
  local forge_count=$(pgrep -f "forge --conversation-id" | wc -l | tr -d ' ')
  echo "Forge subagents: $forge_count"
}

cmd_corpus() {
  echo "=== Rebuilding Corpus ==="
  "$BIN_DIR/corpus-builder.sh"
}

cmd_next() {
  echo "=== Manual Next Batch ==="
  "$BIN_DIR/launcher_py.sh" next "${1:-10}"
}

cmd_resume() {
  # Resume a specific subagent by conversation ID
  local cid="$1"
  echo "=== Resuming Subagent: $cid ==="
  "$BIN_DIR/launcher_py.sh" launch "$cid" "manual-resume"
}

cmd_help() {
  cat << 'HELP'
autoqueue.sh — Automated forge subagent queue manager

Commands:
  init              Initialize queue and corpus
  start             Start daemon mode (auto-launch batches)
  stop              Stop all autoqueue processes
  status            Show current status
  next [N]          Manually launch next batch of N subagents
  resume <cid>      Manually resume a specific subagent
  corpus            Rebuild response corpus
  help              Show this help

Environment:
  AUTOQUEUE_BATCH_SIZE    Default batch size (default: 10)
  AUTOQUEUE_BATCH_DELAY   Delay between batches in seconds (default: 120)

Files:
  ~/.forge/autoqueue/state/queue.json    Queue state
  ~/.forge/autoqueue/corpus/              Response corpus
  ~/.forge/autoqueue/logs/               Logs
  ~/.forge/forge_resume_runs/            Subagent logs

Examples:
  autoqueue.sh init              # One-time setup
  autoqueue.sh start             # Start auto-processing
  autoqueue.sh next 5            # Launch 5 subagents manually
  autoqueue.sh status            # Check status
  autoqueue.sh stop              # Stop everything
HELP
}

case "${1:-help}" in
  init) cmd_init ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  next) cmd_next "${2:-10}" ;;
  resume) cmd_resume "$2" ;;
  corpus) cmd_corpus ;;
  help) cmd_help ;;
  *) echo "Unknown command: $1"; cmd_help; exit 1 ;;
esac
