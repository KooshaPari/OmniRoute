# Prompt provenance archive

This directory holds **verbatim user prompts** extracted from agent session logs. Empty tool subdirectories are kept via `.gitkeep` until the first scrape.

## Scrape sources

| Tool | Log location | Notes |
|------|--------------|-------|
| **Cursor** | `~/.cursor/projects/<project>/agent-transcripts/*.jsonl` | User role messages only; one file per turn |
| **forge** | `forge conversation export` / `~/forge/` logs | OpenAI-compat CLI sessions |
| **Claude Code** | `~/.claude/projects/` | Session JSON / markdown exports |
| **Codex** | `~/.codex/` or IDE-specific store | Tool version varies |

Spec: [HexaKit docs/genesis/INTENT_SPEC.md](https://github.com/KooshaPari/HexaKit/blob/main/docs/genesis/INTENT_SPEC.md)

## Extract

```bash
python scripts/extract-intent-prompts.py \
  --out-dir docs/intent/prompts \
  --repo {{PROJECT_NAME}} \
  --sources cursor,forge,claude,codex
```

Run from repo root after copying genesis scaffold, or from HexaKit with `--repo` pointing at target.

## Layout

```
prompts/
  README.md          # this file
  .gitkeep           # preserves prompts/ in git before first scrape
  cursor/YYYYMMDD-<session-id>-t<N>.md
  forge/...
  claude/...
  codex/...
```

Create tool subdirs on first scrape; `.gitkeep` here marks intent until then.

## Record rules

- **Do not paraphrase** verbatim sections — synthesis lives in [../synthesis.md](../synthesis.md)
- Frontmatter `verbatim_hash` detects post-scrape edits
- Redact secrets; set `redacted: true` in frontmatter
- After scrape: update [../../intent.md](../../intent.md) table and [../synthesis.md](../synthesis.md)
