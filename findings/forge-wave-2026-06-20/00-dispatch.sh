#!/bin/bash
# Forge 20-wide parallel wave — 2026-06-20 02:00 PDT
# Dispatches one forge subagent per ready WP from .agileplus/agileplus.db
# Each agent writes its output to findings/forge-wave-2026-06-20/wp-N-{slug}.md
# Then aggregates a wrap-up to findings/forge-wave-2026-06-20/SYNTHESIS.md

set -u
cd /Users/kooshapari/CodeProjects/Phenotype/repos

WAVEDIR="findings/forge-wave-2026-06-20"
mkdir -p "$WAVEDIR"

# Pull the 20 ready WPs from AgilePlus DB
sqlite3 .agileplus/agileplus.db "SELECT id || '|' || title FROM work_packages WHERE state='planned' ORDER BY sequence LIMIT 20;" > "$WAVEDIR/wp-list.txt"

echo "=== DISPATCHING 20-WIDE WAVE ==="
echo "Wave dir: $WAVEDIR"
echo "Total WPs: $(wc -l < $WAVEDIR/wp-list.txt)"
echo "Start: $(date)"

i=0
while IFS='|' read -r wp_id wp_title; do
  i=$((i+1))
  slug=$(echo "$wp_title" | tr '[:upper:]' '[:lower:]' | tr ' /' '_-' | sed 's/[^a-z0-9_-]//g' | cut -c1-50)
  outfile="$WAVEDIR/wp-${wp_id}-${slug}.md"

  cat > "${outfile}.prompt" <<PROMPT_EOF
# Forge Agent Invocation: WP-${wp_id}

## Task
Execute work package ${wp_id} from .agileplus/agileplus.db.

**Title:** ${wp_title}

## Context
- Repo root: /Users/kooshapari/CodeProjects/Phenotype/repos
- Branch: $(git branch --show-current)
- HEAD: $(git log -1 --format='%h %s')
- AGENTS.md: 482 lines (54 ADRs, scope decisions, Dmouse92 migration, 4-repo retirement)
- 16 pheno-* substrate crates locally; fleet autonomous

## Workflow
1. Read the WP detail from .agileplus/agileplus.db
2. Check WP's acceptance_criteria + file_scope
3. Implement using substrate crates (pheno-flags, pheno-errors, pheno-port-adapter, pheno-otel, pheno-tracing)
4. Write tests covering acceptance criteria
5. Commit with FR annotation (e.g. \`feat: WP-${wp_id} <title> (FR-${wp_id})\`)
6. Update WP state: \`agileplus\` CLI or sqlite3 update
7. Write a 1-line summary to ${outfile}

## Constraints
- macbook device (not heavy-runner)
- Pre-commit hook enforces FR annotations
- DO NOT touch paused repos: AtomsBot*, focalpoint, Dino, QuadSGM, HwLedger, WSM

## Output
Write to: ${outfile}
PROMPT_EOF

  echo "[$i/20] Dispatching WP-${wp_id}: ${wp_title:0:60}"
done < "$WAVEDIR/wp-list.txt"

echo "=== PROMPTS WRITTEN: $i ==="
echo "=== READY TO DISPATCH ==="
