#!/usr/bin/env python3
"""Find sessions with typo/lowercase/casual-typing style prompts (informal).

Strict detection: requires either lowercase first alpha OR a real user-typo.
Avoids false positives like 'r ' matching 'rate ' or 'or '.
"""
import json
import re

# Real user-typos from the user's actual typing (lower case exact substrings)
USER_TYPOS = [
    'eveiw', 'msot', 'likeyl', 'promtps', 'liely', 'syntehsis',
    'consoldiation', 'libification', 'inital', 'caht',
    'iirc', 'mispell', 'recieve', 'seperate', 'occured', 'untill',
    'wich ', ' wether', 'truely', 'noticable', 'usefull', 'helpfull',
    'runing', 'geting', 'doign', 'doin ', 'havnt',
    'thier ', 'whre ', 'teh ', 'adn ', 'taht ', 'foe ',
    'im typing', 'find ones', 'lowercase starting', 'lowercase sent',
    'lowrcas', 'lowrcase', 'lowercas ', 'w\o', 'read&',
    'im sorry', 'its not', 'cant be', 'dont be',
]

# Real casual markers (require word boundaries)
CASUAL_TOKENS = [
    r"\bim\b", r"\bive\b", r"\bdont\b", r"\bcant\b", r"\bwont\b",
    r"\bisnt\b", r"\barent\b", r"\bwasnt\b", r"\bwerent\b",
    r"\bdidnt\b", r"\bdoesnt\b", r"\bwouldnt\b", r"\bcouldnt\b",
    r"\bshouldnt\b", r"\baint\b", r"\bwanna\b", r"\bgonna\b",
    r"\bgotta\b", r"\bkinda\b", r"\bsorta\b", r"\blemme\b",
    r"\bgimme\b", r"\btryna\b", r"\byall\b", r"\bur\b", r"\btho\b",
    r"\bthru\b", r"\bpls\b", r"\bthx\b", r"\btyvm\b", r"\bplz\b",
    r"\bwtf\b", r"\bidk\b", r"\bidc\b", r"\bimo\b", r"\bimho\b",
    r"\btbh\b", r"\bfwiw\b", r"\bfyi\b", r"\basap\b", r"\bbtw\b",
]

# Structured prefixes - definitely NOT informal
STRUCTURED_PREFIXES = (
    'you are', 'task:', 'task ', 'v3 dag', 'w1-', 'w2-', 'agent', 'wave', 'subagent',
    'implement', 'create', 'design', 'go to', 'in /users', 'run ', 'check ', 'audit ',
    'search ', 'scan ', 'fix ', 'read ', 'write ', 'update ', 'delete ', 'merge ',
    'review ', 'explore ', 'analyze ', 'examine ', 'investigate ', 'list ', 'show ',
    'get ', 'fetch ', 'use ', 'using ', 'for each', 'for the', 'for all', 'for any',
    'for every', 'for some', 'for this', 'for that', 'i am', "i'm", 'i will', 'i would',
    'i could', 'i should', 'i can', 'i have', 'please', 'can you', 'could you',
    'would you', 'will you', 'do you', 'are you', 'how ', 'what ', 'where ', 'when ',
    'why ', 'which ', 'who ', 'whose ', 'whom ', 'let me', "let's", 'lets', 'we need',
    'we should', 'we can', 'we will', 'we could', 'need to', 'want to', 'have to',
    'working directory', '[parent]', '[subagent]', '[empty]', 'untitled', '- `',
    '1. ', '2. ', '3. ', '4. ', '5. ', '6. ', '7. ', '8. ', '9. ', '0. ',
    '# ', '## ', '**', '```', 'find all', 'find any', 'find the',
    'consolidate', 'extract', 'investigate the', 'look for any',
    'research', 'review and', 'worktree', 'forge governance', 'python sdk',
    'python ', 'comprehensive', 'cleanup', 'governance', 'hygiene',
    'optimization', 'enhancement', 'maintenance', 'audit',
)

def is_structured(t):
    lower = t.lower().lstrip()
    return any(lower.startswith(s) for s in STRUCTURED_PREFIXES)

def first_alpha(t):
    for ch in t:
        if ch.isalpha():
            return ch
    return ''

def score_title(t):
    """Return (score, reason_tags) for how informal/typo-prone this title is."""
    tags = []
    score = 0
    lower = t.lower()
    stripped = t.lstrip()

    # Real lowercase first letter (after strip)
    first = first_alpha(stripped)
    is_lower = first and first.islower()

    if is_lower:
        score += 5
        tags.append('lower_start')

    # Real user-typos
    typo_hits = sum(1 for p in USER_TYPOS if p in lower)
    if typo_hits > 0:
        score += 10 * typo_hits
        tags.append(f'typo({typo_hits})')

    # Real casual tokens (word-boundary)
    casual_hits = sum(1 for pat in CASUAL_TOKENS if re.search(pat, lower))
    if casual_hits > 0:
        score += 3 * casual_hits
        tags.append(f'casual({casual_hits})')

    # Short, no terminal punctuation
    if len(t) < 80 and not t.endswith(('.', '?', '!', '`', '"', "'", ')', ':', '/')):
        score += 2
        tags.append('short_no_end')

    # Trailing "..." or ".." (thinking/typing)
    if t.rstrip().endswith(('.', '..', '...')):
        score -= 2

    return score, tags


def main():
    with open('/Users/kooshapari/CodeProjects/Phenotype/repos/forge_conversations_past_month.json') as f:
        data = json.load(f)

    print(f'Total: {len(data)}')

    matches = []
    for c in data:
        t = c.get('title', '').strip()
        if not t or len(t) < 5 or len(t) > 200:
            continue
        if is_structured(t):
            continue

        score, tags = score_title(t)
        if score >= 5:
            matches.append((score, c['id'], t, c['updated'], tags))

    matches.sort(key=lambda x: (-x[0], x[3]))

    print(f'\n=== INFORMAL TYPING-STYLE PROMPTS ({len(matches)} found) ===\n')
    for i, (score, cid, t, upd, tags) in enumerate(matches[:80], 1):
        print(f'#{i:3} [score={score:3}] {cid}')
        print(f'      {",".join(tags)}')
        print(f'      "{t[:120]}"')
        print(f'      {upd}')
        print()

    # Save the top 200 to a file
    with open('/Users/kooshapari/CodeProjects/Phenotype/repos/forge_typing_style_resume.md', 'w') as f:
        f.write(f'# Forge Sessions with Informal Typing-Style Prompts\n\n')
        f.write(f'Total found: {len(matches)}\n\n')
        f.write(f'```bash\n')
        for i, (score, cid, t, upd, tags) in enumerate(matches[:200], 1):
            f.write(f'# {i:3} [score={score}] {t[:80]}\n')
            f.write(f'forge --conversation-id {cid}\n\n')
        f.write(f'```\n')

    print(f'\nSaved top 200 to forge_typing_style_resume.md')


if __name__ == '__main__':
    main()
