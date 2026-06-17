# Intent provenance archive

This folder holds **verbatim user prompts** extracted from agent session logs.

## Sources

| Tool | Log location |
|------|----------------|
| **Cursor** | `~/.cursor/projects/<project>/agent-transcripts/*.jsonl` |
| **forge** | `~/forge/` conversation exports (see `forge conversation list`) |
| **Claude Code** | `~/.claude/projects/` session logs |
| **Codex** | `~/.codex/` or tool-specific session store |

## Extract

```bash
python scripts/extract-intent-prompts.py \
  --out-dir docs/intent/prompts \
  --repo <RepoName> \
  --sources cursor,forge,claude,codex
```

## Layout

```
prompts/
  cursor/YYYYMMDD-<session-id>.md
  forge/...
  claude/...
  codex/...
```

Do **not** paraphrase verbatim prompts. Hash is recorded in frontmatter for drift detection.

After scrape, update [synthesis.md](../synthesis.md) and [../../intent.md](../../intent.md) tables.
