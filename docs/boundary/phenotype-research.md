# Boundary — phenotype-research

**Absorbed from:** `KooshaPari/phenoResearchEngine`
**Absorbed into:** `KooshaPari/phenoAI` at `python/phenotype-research/`
**Absorption date:** 2026-07-17
**Disposition:** ABSORBED (was DEPRECATED upstream since 2026-06-20)

## What it is

A Python package providing research workflow orchestration: multi-source crawlers
(HN, Reddit, GitHub, arXiv, RSS, DuckDuckGo), DAG-based scheduler, evidence digest
builder, MCP-server tool surface, and session continuity hooks.

## Why it was absorbed

The upstream `phenoResearchEngine` was formally deprecated on 2026-06-20 with the
migration target declared as `packages/phenotype-research/` inside the monorepo.
The Pheno monorepo (`/pheno`) is Rust-first and doesn't have a Python workspace;
the natural Python home is `phenoAI/python/`, which already houses `cheap-llm-mcp`.

The 90-day compatibility shim from the upstream deprecation expires 2026-09-18.
After that date, downstream consumers must use the new path.

## Where it lives

- **Repository**: `KooshaPari/phenoAI`
- **Path**: `python/phenotype-research/`
- **Import**: `from phenotype_research import ...`
- **PyPI name** (inherited, not republished): `phenotype-research`

## What it talks to

| Direction | Peer | Purpose |
|---|---|---|
| Inbound | `phenoAI/crates/mcp-server` | MCP tool registration (`mcp/tools.py`) |
| Inbound | `phenoAI/crates/llm-router` | LLM-routed digest generation |
| Outbound | `phenotype-py-utils` | shared Python helpers (git-pinned @ v0.1.0) |
| Outbound | typer, structlog, apscheduler, pydantic, orjson, httpx, arxiv, praw, feedparser, thegent | runtime deps (declared in `findings/deps-audit-2026-06-20-phenoResearchEngine.md`) |

## What is NOT absorbed

- The upstream `docs/`, `findings/`, `worklogs/`, `ports/`, `audit_scorecard.json` directories were left in the archived source repo for forensic continuity. Only the runnable Python package surface (src/, tests/, pyproject.toml, lint configs) was copied.

## Restore command

```sh
gh repo unarchive KooshaPari/phenoResearchEngine
```

(requires repo to be un-archived first; restore is a snapshot retrieval — see `audits/absorption-justifications/phenoResearchEngine-2026-07-17.md` for the canonical restore procedure.)