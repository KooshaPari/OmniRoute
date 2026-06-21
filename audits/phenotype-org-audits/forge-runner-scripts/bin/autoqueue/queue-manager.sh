#!/usr/bin/env bash
# queue-manager.sh — reads all_subagents_resume.md and manages batch queue
# Usage: queue-manager.sh [init|next|status|reset]

set -euo pipefail

RESUME_FILE="${HOME}/.forge/forge_resume_runs/all_subagents_resume.md"
QUEUE_STATE="${HOME}/.forge/autoqueue/state/queue.json"
BATCH_SIZE="${AUTOQUEUE_BATCH_SIZE:-10}"

if [[ ! -f "$RESUME_FILE" ]]; then
  echo "ERROR: Resume file not found: $RESUME_FILE" >&2
  exit 1
fi

cmd_init() {
  # Parse all work packages from the resume file
  # Write python parser to a temp file to avoid quoting issues
  local pyfile=$(mktemp)
  cat > "$pyfile" << 'PYEOF'
import re, json, sys

with open(sys.argv[1]) as f:
    content = f.read()

# Find all entries
entries = []
# Pattern: ### N. WP-XX: Title
blocks = re.split(r'\n###\s+\d+\.\s+', content)
for block in blocks[1:]:  # Skip header
    lines = block.strip().split('\n')
    if not lines:
        continue
    title = lines[0].strip()
    
    # Extract ID - format: **ID:** `uuid`
    id_match = re.search(r'ID:\*\*\s*`([^`]+)`', block)
    cid = id_match.group(1) if id_match else None
    
    # Extract status - if not present, default to pending
    status_match = re.search(r'Status:\s*\*\*([^*]+)\*\*', block)
    status = status_match.group(1).strip().lower() if status_match else 'pending'
    
    # Extract summary - if not present, use title
    summary_match = re.search(r'Summary:\s*([^\n]+)', block)
    summary = summary_match.group(1).strip() if summary_match else title
    
    # Extract work package
    wp_match = re.search(r'WP-(\d+)', title)
    wp = wp_match.group(1) if wp_match else '0'
    
    entries.append({
        'wp': wp,
        'title': title,
        'id': cid,
        'status': status,
        'summary': summary,
        'block': block[:500]
    })

pending = [e for e in entries if e['status'] not in ('completed', 'done', 'merged')]
completed = [e for e in entries if e['status'] in ('completed', 'done', 'merged')]

state = {
    'total': len(entries),
    'completed': [e['id'] for e in completed],
    'failed': [],
    'pending': [e['id'] for e in pending],
    'current_batch': [],
    'entries': {e['id']: e for e in entries}
}

with open(sys.argv[2], 'w') as f:
    json.dump(state, f, indent=2)

print(f'Initialized queue: {len(entries)} total, {len(pending)} pending, {len(completed)} completed')
PYEOF

  python3 "$pyfile" "$RESUME_FILE" "$QUEUE_STATE" 2>&1 || {
    echo "python3 parse failed, using grep fallback"
    local count=$(grep -c "^### [0-9]" "$RESUME_FILE" 2>/dev/null || echo 0)
    echo '{"total": '$count', "completed": [], "failed": [], "pending": [], "current_batch": []}' > "$QUEUE_STATE"
    echo "Initialized queue: $count entries (fallback)"
  }
  rm -f "$pyfile"
}

cmd_next() {
  if [[ ! -f "$QUEUE_STATE" ]]; then
    echo "Queue not initialized. Run: queue-manager.sh init" >&2
    exit 1
  fi

  python3 -c "
import json, sys

with open('$QUEUE_STATE') as f:
    state = json.load(f)

pending = state['pending']
if not pending:
    print('QUEUE_EMPTY')
    sys.exit(0)

batch = pending[:$BATCH_SIZE]
remaining = pending[$BATCH_SIZE:]

state['current_batch'] = batch
state['pending'] = remaining

with open('$QUEUE_STATE', 'w') as f:
    json.dump(state, f, indent=2)

for cid in batch:
    entry = state['entries'].get(cid, {})
    wp = entry.get('wp', '?')
    title = entry.get('title', 'Unknown')
    print(f'{cid}|WP-{wp}|{title}')
" 2>&1
}

cmd_status() {
  if [[ ! -f "$QUEUE_STATE" ]]; then
    echo "Queue not initialized" >&2
    exit 1
  fi

  python3 -c "
import json
with open('$QUEUE_STATE') as f:
    state = json.load(f)

total = state['total']
completed = len(state['completed'])
failed = len(state['failed'])
pending = len(state['pending'])
batch = len(state['current_batch'])

print(f'Total: {total}')
print(f'Completed: {completed}')
print(f'Failed: {failed}')
print(f'Pending: {pending}')
print(f'Current batch: {batch}')
print(f'Progress: {completed}/{total} ({completed*100//total}%)')
" 2>&1
}

cmd_mark() {
  local id="$1"
  local status="$2"  # completed, failed

  python3 -c "
import json
with open('$QUEUE_STATE') as f:
    state = json.load(f)

if '$id' in state['current_batch']:
    state['current_batch'].remove('$id')

if '$status' == 'completed':
    if '$id' not in state['completed']:
        state['completed'].append('$id')
    if '$id' in state['failed']:
        state['failed'].remove('$id')
elif '$status' == 'failed':
    if '$id' not in state['failed']:
        state['failed'].append('$id')
    if '$id' in state['completed']:
        state['completed'].remove('$id')

with open('$QUEUE_STATE', 'w') as f:
    json.dump(state, f, indent=2)

print(f'Marked $id as $status')
" 2>&1
}

cmd_reset() {
  rm -f "$QUEUE_STATE"
  echo "Queue reset. Run: queue-manager.sh init"
}

case "${1:-status}" in
  init) cmd_init ;;
  next) cmd_next ;;
  status) cmd_status ;;
  mark) cmd_mark "${2:-}" "${3:-completed}" ;;
  reset) cmd_reset ;;
  *) echo "Usage: $0 {init|next|status|mark <id> <status>|reset}" >&2; exit 1 ;;
esac
