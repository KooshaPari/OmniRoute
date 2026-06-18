#!/usr/bin/env python3
"""Regenerate past-month forge conversation dataset and surface typing-style prompts."""
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from collections import defaultdict

CUTOFF = datetime(2026, 5, 14)

# Patterns unique to the user's typing style — typos, lowercase starts, casual contractions
TYPO_PATTERNS = [
    # Specific letter transpositions from the user's actual task text
    'syntehsis', 'msot', 'mostt', 'likeyl', 'eveiw', 'promtps', 'liely', 'unlim', 'q-t-y',
    'consoldiation', 'libification', 'inital', 'caht', 'darkfactory', 'octopus', 'iirc',
    'indiv', 'spendign', 'read&', 'lowercase', 'typing', 'im typing', 'find ones', 'typo',
    'mispell', 'typign', 'tor ', 'tje ', 'hte ', 'teh ', 'taht ', 'adn ', 'foe ',
    'whree', 'hwere', 'theri', 'thier', 'suer', 'reusme', 'resuem',
    # Common fast-typing contractions
    'im ', 'ive ', 'dont ', 'cant ', 'wont ', 'isnt ', 'arent ', 'wasnt ', 'werent ',
    'didnt ', 'doesnt ', 'wouldnt ', 'couldnt ', 'shouldnt ', 'hasnt ', 'havent ',
    'hadnt ', 'aint ', 'wanna', 'gonna', 'gotta', 'kinda', 'sorta', 'outta', 'dunno',
    'lemme', 'gimme', 'tryna', 'finna', 'imma', 'ima ', 'ion ', 'yall',
    'fkn', 'fuckin', 'wtf', 'wth', 'idgaf',
    'u ', 'ur ', 'urs ', 'r ', 'b4', 'l8r', 'gr8', 'mate', 'plz', 'pls', 'thx',
    'tyvm', 'yw', 'np', 'idc', 'idk', 'fr ', 'ngl', 'tbh', 'tbf', 'imo', 'imho',
    'fwiw', 'btw', 'tho', 'thru', 'lol', 'lmao', 'lmfao', 'haha', 'omg', 'omfg',
    # The user's specific short instructions
    'do all next', 'do all nxt', 'do all enxt', 'do all ebxt', 'do all nex',
    'whats left', 'wahts left', 'whats next', 'whats lef', 'whats left in full',
    'do it', 'do it all', 'do all of it', 'do all of the above', 'all of the above',
    'proceed w', 'resume w', 'lets do it', 'work on it', 'check subagent',
    'do nxt', 'do enxt', 'do ebxt', 'do nex', 'next batch', 'dug through',
    '10 at a time', 'your choice', 'do so yourself', 'go ahead', 'do everything',
    'do the rest', 'do the unarchive', 'do manual resolves', 'do manual',
    'do the manual', 'resume next', 'resume all', 'resume w\\',
    'do all', 'check subagents',
]
TYPO_PATTERNS = list(dict.fromkeys(TYPO_PATTERNS))

# Prefixes that indicate structured/synthetic prompts (exclude)
STRUCTURED_PREFIXES = (
    'you are', 'task', 'v3 dag', 'w1-', 'w2-', 'agent', 'wave', 'subagent',
    'implement', 'create', 'design', 'go to', 'in /users', 'run ', 'check ', 'audit ',
    'search ', 'scan ', 'find all', 'fix ', 'read ', 'write ', 'update ', 'delete ',
    'merge ', 'review ', 'explore ', 'analyze ', 'examine ', 'investigate ', 'list ',
    'show ', 'get ', 'fetch ', 'use ', 'using ', 'for each', 'for the', 'for all',
    'for any', 'for every', 'i am', 'i\'m', 'i will', 'i would', 'i could', 'i should',
    'i can', 'i have', 'please', 'can you', 'could you', 'would you', 'will you',
    'do you', 'are you', 'how ', 'what ', 'where ', 'when ', 'why ', 'which ', 'who ',
    'let me', 'let\'s', 'lets', 'we need', 'we should', 'we can', 'we will', 'we could',
    'need to', 'want to', 'have to', 'should ', 'could ', 'would ', 'can ', 'will ',
    'must ', 'may ', 'might ', 'shall ', 'ought ', 'dare ', 'need ', 'used ',
    'working directory', '1. ', '2. ', '3. ', '4. ', '5. ', '6. ', '7. ', '8. ', '9. ', '0. ',
    '- `', 'untitled', '[empty]', '[parent]', '[subagent]',
)

def get_first_alpha(text):
    for ch in text:
        if ch.isalpha():
            return ch
    return ''

def parse_forge_porcelain():
    """Parse `forge conversation list --porcelain` output."""
    result = subprocess.run(
        ['forge', 'conversation', 'list', '--porcelain'],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        raise RuntimeError(f"forge list failed: {result.stderr[:500]}")

    conversations = []
    lines = result.stdout.split('\n')
    for line in lines:
        if not line or line.startswith('ID'):
            continue
        # Format: UUID + 2+ spaces + TITLE + 2+ spaces + UPDATED
        uuid_match = re.match(r'^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', line)
        if not uuid_match:
            continue
        cid = uuid_match.group(1)
        rest = line[37:].rstrip()
        # Title is everything before the time column
        m = re.search(r'\s{2,}(\S.*?)\s{2,}\S', rest)
        if m:
            title = m.group(1).strip()
            updated = rest[m.end():].strip()
        else:
            title = rest.strip()
            updated = ''
        conversations.append({
            'id': cid,
            'title': title,
            'updated': updated,
        })
    return conversations

def score_typing_style(title):
    """Score a title for typing-style indicators (typos, lowercase, casual)."""
    if not title or len(title) < 3:
        return 0
    t = title.strip()
    lower = t.lower()
    first_alpha = get_first_alpha(t)

    # Skip if starts with structured prefix
    if any(lower.startswith(p) for p in STRUCTURED_PREFIXES):
        return 0
    # Skip if starts with bracket, code, path, or bullet
    if t[0] in ('[', '`', '/', '-', '#', '*', '>', '<'):
        return 0
    # Skip empty/untitled
    if t in ('[empty]', 'untitled', 'None', 'null'):
        return 0
    # Skip very long (likely structured)
    if len(t) > 200:
        return 0

    score = 0
    # Lowercase first letter (strong indicator)
    if first_alpha and first_alpha.islower():
        score += 5
    # Has typo patterns (strong indicator)
    if any(p in lower for p in TYPO_PATTERNS):
        score += 10
    # Short sentence (typing style)
    if len(t) < 80:
        score += 2
    # No proper ending punctuation
    if not t.endswith(('.', '?', '!', '`', '"', "'")):
        score += 1
    return score

def main():
    print("Parsing forge conversation list...")
    all_convs = parse_forge_porcelain()
    print(f"Total: {len(all_convs)}")

    # Save raw
    with open('forge_conversations_all.json', 'w') as f:
        json.dump(all_convs, f, indent=2)

    # Score and sort
    scored = []
    for c in all_convs:
        s = score_typing_style(c['title'])
        if s > 0:
            scored.append((s, c['id'], c['title'], c['updated']))

    scored.sort(key=lambda x: (-x[0], x[3]))

    # Save typing-style matches
    with open('forge_typing_style_sessions.json', 'w') as f:
        json.dump([{
            'id': cid, 'title': t, 'updated': u, 'score': s
        } for s, cid, t, u in scored], f, indent=2)

    print(f"\n=== TYPING-STYLE PROMPTS (score > 0) ===")
    print(f"Found: {len(scored)}\n")
    for i, (s, cid, t, u) in enumerate(scored[:50], 1):
        print(f"#{i} [score={s}] {cid}")
        print(f"  Title: {t[:80]}")
        print(f"  Updated: {u}")
        print()

if __name__ == '__main__':
    main()
