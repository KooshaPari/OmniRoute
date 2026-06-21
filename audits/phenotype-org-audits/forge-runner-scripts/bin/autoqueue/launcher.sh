#!/usr/bin/env bash
# launcher.sh — launches forge subagents from the queue
# Usage: launcher.sh next [batch_size]
#        launcher.sh launch <conversation_id> <wp_title>

set -euo pipefail

QUEUE_MGR="${HOME}/.forge/autoqueue/bin/queue-manager.sh"
LOG_DIR="${HOME}/.forge/forge_resume_runs/logs"
REPO_DIR="${HOME}/CodeProjects/Phenotype/repos"

# Launch a single forge subagent
launch_one() {
  local cid="$1"
  local wp_title="${2:-Unknown}"
  local logfile="$LOG_DIR/${cid:0:8}.log"
  
  echo "Launching: $wp_title ($cid)"
  
  # Use nohup to background the forge process
  nohup forge \
    --conversation-id "$cid" \
    -p "Continue from where you left off. Complete the task autonomously without asking for user confirmation." \
    -C "$REPO_DIR" \
    > "$logfile" 2>&1 &
  
  local pid=$!
  echo "  PID=$!  log=$logfile"
  
  # Small delay to prevent overwhelming the system
  sleep 0.5
}

# Launch next batch from queue
launch_next_batch() {
  local batch_size="${1:-10}"
  
  # Get next batch from queue manager
  echo "=== Fetching next batch (size=$batch_size) ==="
  local batch
  batch=$(AUTOQUEUE_BATCH_SIZE="$batch_size" "$QUEUE_MGR" next)
  
  if [[ "$batch" == "QUEUE_EMPTY" ]]; then
    echo "Queue empty. All subagents launched."
    return 0
  fi
  
  # Parse batch entries
  local count=0
  while IFS='|' read -r cid wp title; do
    [[ -z "$cid" ]] && continue
    launch_one "$cid" "$wp: $title"
    count=$((count + 1))
  done <<< "$batch"
  
  echo ""
  echo "=== Launched $count subagents ==="
  echo "Monitoring: monitor.sh batch '${batch//$'\n'/ }'"
  
  # Auto-start monitor in background
  nohup "${HOME}/.forge/autoqueue/bin/monitor.sh" batch "$(echo "$batch" | cut -d'|' -f1 | tr '\n' ' ')" 3600 \
    > "${HOME}/.forge/autoqueue/logs/monitor-$(date +%s).log" 2>&1 &
  
  echo "Monitor PID=$!"
}

# Launch all remaining (with rate limiting)
launch_all() {
  local batch_size="${1:-${AUTOQUEUE_BATCH_SIZE:-10}}"
  local delay="${2:-${AUTOQUEUE_BATCH_DELAY:-60}}"  # seconds between batches

  while true; do
    set +e
    launch_next_batch "$batch_size"
    local rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
      echo "launch_next_batch returned $rc, waiting and retrying..."
      sleep "$delay"
      continue
    fi

    # Check if queue is empty
    local status
    status=$("$QUEUE_MGR" status 2>/dev/null || echo "")
    if echo "$status" | grep -q "Pending: 0"; then
      echo "All subagents launched."
      break
    fi

    echo "Waiting ${delay}s before next batch..."
    sleep "$delay"
  done
}

# Show current running forge processes
status() {
  echo "=== Running forge subagents ==="
  ps aux | grep "forge --conversation-id" | grep -v grep | awk '{print $2, $11, $12}' | while read pid cmd args; do
    # Extract conversation ID from args
    cid=$(echo "$args" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
    echo "  PID=$pid  CID=$cid"
  done
  
  echo ""
  echo "=== Queue status ==="
  "$QUEUE_MGR" status
}

# Kill all forge subagent processes
kill_all() {
  echo "Killing all forge subagent processes..."
  pkill -f "forge --conversation-id" || true
  echo "Done"
}

case "${1:-next}" in
  next) launch_next_batch "${2:-${AUTOQUEUE_BATCH_SIZE:-10}}" ;;
  launch) launch_one "$2" "$3" ;;
  all) launch_all "${2:-${AUTOQUEUE_BATCH_SIZE:-10}}" "${3:-${AUTOQUEUE_BATCH_DELAY:-60}}" ;;
  status) status ;;
  kill) kill_all ;;
  *) echo "Usage: $0 {next [batch_size]|launch <cid> <title>|all [batch_size] [delay]|status|kill}" >&2; exit 1 ;;
esac
