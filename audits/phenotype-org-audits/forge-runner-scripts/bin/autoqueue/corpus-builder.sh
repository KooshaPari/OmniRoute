#!/usr/bin/env bash
# corpus-builder.sh — scrapes user response style from forge history + snapshots
# Builds a lightweight corpus for the response synthesizer

set -euo pipefail

FORGE_HISTORY="${HOME}/forge/.forge_history"
SNAPSHOTS_DIR="${HOME}/forge/snapshots"
CORPUS_DIR="${HOME}/.forge/autoqueue/corpus"

# Build patterns from forge history
build_patterns() {
  echo "=== Extracting user response patterns from forge history ==="

  if [[ -f "$FORGE_HISTORY" ]]; then
    python3 << 'PYEOF'
import re, json, os

history_path = os.path.expanduser('~/forge/.forge_history')
with open(history_path, 'r', errors='replace') as f:
    content = f.read()

# Split into sessions by #V2 marker
sessions = content.split('#V2')

# Commands to skip (terminal commands, not user messages)
command_prefixes = ('forge ', 'cd ', 'ls ', 'exit', '/exit', '/eit', '/model', 
                    'nvim ', 'vim ', 'cat ', 'grep ', 'find ', 'mkdir ', 'rm ',
                    'git ', 'python', 'node ', 'npm ', 'cargo ', 'make ', 'just ')

def is_command(text):
    text = text.strip()
    if not text:
        return True
    if text.startswith('/'):
        return True
    if text.startswith(command_prefixes):
        return True
    if len(text) < 5:
        return True
    # Skip if it's just terminal output (no spaces, just paths or filenames)
    if ' ' not in text and '\n' not in text:
        return True
    return False

user_messages = []
for session in sessions:
    session = session.strip()
    if not session:
        continue
    
    # Split session by lines
    lines = session.split('\n')
    
    # Accumulate multi-line messages
    current_msg = []
    for line in lines:
        line = line.strip()
        if is_command(line):
            # Flush current message if it looks like a user message
            if current_msg:
                msg_text = '\n'.join(current_msg).strip()
                if len(msg_text) >= 10 and not is_command(msg_text):
                    user_messages.append(msg_text)
                current_msg = []
        else:
            current_msg.append(line)
    
    # Flush final message
    if current_msg:
        msg_text = '\n'.join(current_msg).strip()
        if len(msg_text) >= 10:
            user_messages.append(msg_text)

# Filter and categorize
short = [m for m in user_messages if len(m) < 100]
directives = [m for m in user_messages if any(w in m.lower() for w in ['must', 'should', 'need', 'build', 'check', 'resume', 'create', 'fix', 'push', 'merge', 'pr'])]
long_directives = [m for m in user_messages if len(m) >= 100 and len(m) < 500]

# Deduplicate
def dedup(items):
    seen = set()
    result = []
    for item in items:
        # Normalize for dedup
        key = item.lower().strip()[:80]
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result

short = dedup(short)
directives = dedup(directives)
long_directives = dedup(long_directives)
all_unique = dedup(user_messages)

corpus = {
    'user_messages': all_unique[:500],
    'short_patterns': short[:200],
    'directive_patterns': directives[:200],
    'long_directives': long_directives[:100],
    'meta_patterns': [
        'resume',
        'you must always push',
        'check subagent',
        'dug through',
        '10 at a time',
        'perhaps build',
        'next batch',
        'retry failed',
        'continue where you left off',
        'complete the task autonomously'
    ]
}

os.makedirs(os.path.expanduser('~/.forge/autoqueue/corpus'), exist_ok=True)
with open(os.path.expanduser('~/.forge/autoqueue/corpus/response_patterns.json'), 'w') as f:
    json.dump(corpus, f, indent=2)

print(f'Extracted {len(all_unique)} unique user messages')
print(f'  Short patterns: {len(short)}')
print(f'  Directives: {len(directives)}')
print(f'  Long directives: {len(long_directives)}')
PYEOF
  else
    echo "No forge history found at $FORGE_HISTORY"
  fi
}

# Build snapshot corpus
build_snapshot_corpus() {
  echo "=== Sampling recent snapshots ==="
  
  python3 << 'PYEOF'
import json, os, glob

snapshots_dir = os.path.expanduser('~/forge/snapshots')
corpus_dir = os.path.expanduser('~/.forge/autoqueue/corpus')

if not os.path.isdir(snapshots_dir):
    print("No snapshots directory")
    os.makedirs(corpus_dir, exist_ok=True)
    with open(os.path.join(corpus_dir, 'snapshot_samples.json'), 'w') as f:
        json.dump([], f)
    exit(0)

# Get most recent snapshots
recent = sorted(os.listdir(snapshots_dir), key=lambda x: os.path.getmtime(os.path.join(snapshots_dir, x)), reverse=True)[:20]

user_samples = []
for snap in recent:
    snap_dir = os.path.join(snapshots_dir, snap)
    if not os.path.isdir(snap_dir):
        continue
    files = sorted(glob.glob(os.path.join(snap_dir, '*')))
    for f in files:
        try:
            with open(f, 'r', errors='replace') as fh:
                data = json.load(fh)
            if 'messages' in data and data['messages']:
                # Get last 3 user messages
                for msg in data['messages'][-6:]:
                    if msg.get('role') == 'user':
                        text = msg.get('content', '')
                        if text and 10 < len(text) < 1000:
                            user_samples.append(text)
            break
        except:
            pass

unique = list(set(user_samples))
with open(os.path.join(corpus_dir, 'snapshot_samples.json'), 'w') as f:
    json.dump(unique[:100], f, indent=2)

print(f'Extracted {len(unique)} unique user messages from snapshots')
PYEOF
}

# Build prompt template
build_prompt_template() {
  cat > "$CORPUS_DIR/synthesizer_prompt.md" << 'PROMPT'
# Autoqueue Response Synthesizer

You are the user's delegate. When a forge subagent completes its work, respond in the user's style.

## User's Communication Style

- Extremely concise, often 1-3 words ("resume", "next batch", "check subagent")
- Direct imperatives, no filler
- Technical terms: subagent, forge, DAG, WP, corpus
- Meta-instructions: "we have ~5k chats", "dug through", "10 at a time"
- Shortcuts: "w\"" for "with", occasional typos
- Mentions tools: codex, cursor, claude, forgecode

## Response Rules

1. SUCCESS: brief acknowledgment, ask for next batch
2. FAILURE: ask for retry or details
3. INCOMPLETE: "resume" or "continue"
4. RUNNING: wait
5. ALL DONE: request next batch

## Templates

- Success: "resume next batch", "next", "ok next batch"
- Failure: "retry failed", "fix and resume"
- Incomplete: "resume", "continue where you left off"
- All done: "next batch", "queue complete"

## Output

Respond ONLY with the synthesized message. No preamble.
PROMPT

  echo "Prompt template written"
}

mkdir -p "$CORPUS_DIR"
build_patterns
build_snapshot_corpus
build_prompt_template

echo ""
echo "=== Corpus build complete ==="
ls -la "$CORPUS_DIR/"
