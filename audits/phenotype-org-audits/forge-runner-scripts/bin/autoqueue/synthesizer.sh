#!/usr/bin/env bash
# synthesizer.sh — generates response in user's style based on subagent status
# Usage: synthesizer.sh <conversation_id> <status> <batch_ids>

set -euo pipefail

CORPUS_DIR="${HOME}/.forge/autoqueue/corpus"
QUEUE_STATE="${HOME}/.forge/autoqueue/state/queue.json"
LOG_DIR="${HOME}/.forge/forge_resume_runs/logs"

id="${1:-}"
status="${2:-}"
batch_ids="${3:-}"

# Load response patterns
load_patterns() {
  if [[ -f "$CORPUS_DIR/response_patterns.json" ]]; then
    python3 -c "
import json
with open('$CORPUS_DIR/response_patterns.json') as f:
    corpus = json.load(f)

# Select a random short pattern as style reference
short = corpus.get('short_patterns', [])
if short:
    import random
    print(random.choice(short))
" 2>/dev/null | head -1
  fi
}

# Get queue status for context
get_queue_context() {
  python3 -c "
import json
try:
    with open('$QUEUE_STATE') as f:
        state = json.load(f)
    total = state['total']
    completed = len(state['completed'])
    failed = len(state['failed'])
    pending = len(state['pending'])
    print(f'{completed}/{total} done, {pending} remaining, {failed} failed')
except:
    print('unknown queue state')
" 2>/dev/null
}

# Synthesize response based on status
synthesize() {
  local id="$1"
  local status="$2"
  local batch="$3"
  local queue_ctx=$(get_queue_context)
  
  case "$status" in
    SUCCESS)
      # User typically says something brief then asks for next batch
      local responses=(
        "resume next batch"
        "next"
        "ok, next batch"
        "resume"
        "next batch"
        "done, next"
        "continue"
        "resume 10 more"
        "next work package"
        "proceed"
      )
      # If this is the BATCH_COMPLETE signal, include queue context
      if [[ "$id" == "BATCH_COMPLETE" ]]; then
        echo "next batch — $queue_ctx"
      else
        # Individual success - usually just acknowledge
        echo "done"
      fi
      ;;
    
    FAILURE)
      local responses=(
        "retry failed"
        "fix and resume"
        "check logs"
        "debug"
        "resume"
        "retry"
      )
      echo "retry failed — $id"
      ;;
    
    STALLED|TIMEOUT)
      local responses=(
        "resume"
        "continue"
        "check subagent"
        "still running?"
        "retry"
      )
      echo "resume — $id stalled"
      ;;
    
    *)
      echo "resume"
      ;;
  esac
}

# Main execution
result=$(synthesize "$id" "$status" "$batch_ids")

# Log the synthesis
logfile="${HOME}/.forge/autoqueue/logs/synthesizer.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $id $status | $result" >> "$logfile"

# Output the synthesized message
printf '%s\n' "$result"

# If batch complete, automatically trigger next batch launch
if [[ "$id" == "BATCH_COMPLETE" && "$status" == "SUCCESS" ]]; then
  # Check if there are more pending items
  remaining=$(python3 -c "
import json
try:
    with open('$QUEUE_STATE') as f:
        state = json.load(f)
    print(len(state['pending']))
except:
    print(0)
" 2>/dev/null)
  
  if [[ "$remaining" -gt 0 ]]; then
    echo ""
    echo "=== AUTO-TRIGGER: Launching next batch ==="
    "${HOME}/.forge/autoqueue/bin/launcher.sh" next 2>&1 | tail -20
  else
    echo ""
    echo "=== QUEUE EMPTY ==="
    echo "all subagents complete"
  fi
fi
