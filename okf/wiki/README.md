# LLM wiki — {{PROJECT_NAME}}

Human navigation index for OKF chunks. The machine index lives in [../manifest.okf.yaml](../manifest.okf.yaml).

Spec: [HexaKit docs/genesis/OKF.md](https://github.com/KooshaPari/HexaKit/blob/main/docs/genesis/OKF.md)

## Purpose

- Map `okf_id` → source heading for RAG and agent `@` references
- Document chunking policy (`chunk_max_tokens`, embedding hints)
- List generated files under `chunks/` (optional)

## Chunk index

| okf_id | Source | Heading | Tags | Summary |
|--------|--------|---------|------|---------|
| charter-001 | [charter.md](../../charter.md) | Mission | governance | One-line mission and boundary class |
| review-001 | [review.md](../../review.md) | Kilo Code Stand | review | Block/warn tiers for PR agents |
| intent-001 | [intent.md](../../intent.md) | Problem statement | intent | Why this repo exists |
| sota-exec-001 | [SOTA.md](../../SOTA.md) | Executive summary | sota | Dimensional choices at a glance |
| sota-tech-001 | [docs/sota/technical.md](../../docs/sota/technical.md) | Chosen strategy | technical | Stack and architecture verdict |

Add rows when:

- Running `hexakit okf chunk` (planned)
- Hand-splitting large dimension files for embedding

## Chunk file convention

Generated or manual chunks live in `chunks/*.okf.md`:

```markdown
---
okf_id: sota-dx-001
parent: docs/sota/dx.md
heading: "Local dev loop"
tags: [dx, cli]
summary: "Steps to bootstrap from genesis template"
---

Body text with relative links only.
```

## Embedding hints (from manifest)

Default: `title + summary + first_h2` per `llm_wiki.embedding_hint` in [manifest.okf.yaml](../manifest.okf.yaml).

Exclude from default embed corpus:

- `docs/intent/prompts/**` (link from synthesis chunks instead)
- Large generated logs

## Agent injection order

1. [charter.md](../../charter.md)
2. [review.md](../../review.md)
3. [intent.md](../../intent.md)
4. [SOTA.md](../../SOTA.md)
5. Relevant dimension slice from [docs/sota/](../../docs/sota/)

## Maintenance

| Event | Action |
|-------|--------|
| Doc restructure | Regenerate chunks; update this table |
| New SOTA dimension | Add manifest `dimensions` entry + chunk row |
| Deprecate chunk | Set `deprecated: true` in frontmatter; add `supersedes` on replacement |
