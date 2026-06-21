#!/usr/bin/env bash
# monitor.sh — watches forge subagent processes and triggers synthesis on completion

set -euo pipefail

LOG_DIR="${HOME}/.forge/forge_resume_runs/logs"
QUEUE_STATE="${HOME}/.forge/autoqueue/state/queue.json"
SYNTHESIZER="${HOME}/.forge/autoqueue/bin/synthesizer.sh"

# Check if a specific forge process is still running
is_running() {
  local logfile="$1"
  local pid
  # Check if log file exists and has recent activity
  if [[ ! -f "$logfile" ]]; then
    return 1
  fi
  # Check if file was modified in last 5 minutes
  if [[ -n "$(find "$logfile" -mmin -5 2>/dev/null)" ]]; then
    return 0
  fi
  # If not modified recently, check if process is still alive
  # We can't easily track PIDs since they're nohup'd, so we use log activity
  # If last line contains "Thinking" or "Analyzing" or "Forging" within last 2 min
  local last_line
  last_line=$(tail -n 5 "$logfile" 2>/dev/null | grep -E "Thinking|Analyzing|Forging|Reasoning|Contemplating|Researching|Synthesizing" | tail -1)
  if [[ -n "$last_line" && -n "$(find "$logfile" -mmin -2 2>/dev/null)" ]]; then
    return 0
  fi
  return 1
}

# Check completion status of a log file
check_completion() {
  local logfile="$1"
  if [[ ! -f "$logfile" ]]; then
    echo "NO_LOG"
    return
  fi
  
  local last_lines
  last_lines=$(tail -n 50 "$logfile" 2>/dev/null)
  
  # Check for success patterns
  if echo "$last_lines" | grep -qiE "(completed|success|done|finished|deployed|pushed|merged|all.*pass)"; then
    echo "SUCCESS"
    return
  fi
  
  # Check for failure patterns
  if echo "$last_lines" | grep -qiE "(error|fail|exception|fatal|cannot|unable|abort|timeout)"; then
    echo "FAILURE"
    return
  fi
  
  # Check if still active
  if is_running "$logfile"; then
    echo "RUNNING"
    return
  fi
  
  # Unknown state - might be stalled
  echo "STALLED"
}

# Monitor a batch of subagents
monitor_batch() {
  local batch_ids="$1"
  local timeout="${2:-300}"  # Default 5 min timeout
  
  echo "Monitoring batch: $batch_ids"
  echo "Timeout: ${timeout}s"
  
  local start_time=$(date +%s)
  local all_done=false
  local results=()
  
  while [[ "$all_done" != "true" ]]; do
    all_done=true
    results=()
    
    for id in $batch_ids; do
      local logfile="$LOG_DIR/${id:0:8}.log"
      local status=$(check_completion "$logfile")
      
      # Check if timed out
      local elapsed=$(( $(date +%s) - start_time ))
      if [[ "$status" == "RUNNING" && $elapsed -gt $timeout ]]; then
        status="TIMEOUT"
      fi
      
      if [[ "$status" == "RUNNING" ]]; then
        all_done=false
      fi
      
      results+=("$id:$status")
      echo "  $id: $status"
    done
    
    if [[ "$all_done" == "true" ]]; then
      break
    fi
    
    sleep 10
  done
  
  # Generate summary
  echo ""
  echo "=== Batch Results ==="
  local success_count=0
  local failure_count=0
  local stalled_count=0
  
  for result in "${results[@]}"; do
    local id=${result%%:*}
    local status=${result#*:}
    
    case "$status" in
      SUCCESS)
        ((success_count++))
        "$SYNTHESIZER" "$id" "$status" "$batch_ids"
        ;;
      FAILURE)
        ((failure_count++))
        "$SYNTHESIZER" "$id" "$status" "$batch_ids"
        ;;
      STALLED|TIMEOUT)
        ((stalled_count++))
        "$SYNTHESIZER" "$id" "$status" "$batch_ids"
        ;;
    esac
  done
  
  echo "Success: $success_count | Failure: $failure_count | Stalled: $stalled_count"
  
  # If all successful, trigger next batch
  if [[ $success_count -eq $(echo "$batch_ids" | wc -w) ]]; then
    echo ""
    echo "=== All succeeded. Triggering next batch ==="
    "$SYNTHESIZER" "BATCH_COMPLETE" "SUCCESS" "$batch_ids"
  fi
}

# Watch mode — continuously monitor
watch_mode() {
  echo "Starting watch mode..."
  while true; do
    if [[ -f "$QUEUE_STATE" ]]; then
      local current_batch=$(python3 -c "
import json
with open('$QUEUE_STATE') as f:
    state = json.load(f)
print(' '.join(state['current_batch']))
" 2>/dev/null)
      
      if [[ -n "$current_batch" ]]; then
        monitor_batch "$current_batch" 3600  # 1 hour timeout
      fi
    fi
    
    sleep 30
  done
}

case "${1:-watch}" in
  watch) watch_mode ;;
  check) check_completion "$2" ;;
  batch) monitor_batch "$2" "${3:-300}" ;;
  *) echo "Usage: $0 {watch|check <logfile>|batch <ids> [timeout]}" >&2; exit 1 ;;
esac
