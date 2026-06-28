# v54 P0-2 — Stale Repo Retirement from Fleet Docs

**Date:** 2026-06-28
**Author:** v54 automated cleanup
**Scope:** `AGENTS.md` § Sub-repos at a Glance (primary fleet documentation)

## Summary

Verified 66 unique repo references from `AGENTS.md` against GitHub (`gh api repos/KooshaPari/<name>`). **25 stale references found** — repos listed as active fleet members that return HTTP 404 (deleted, absorbed, or never created as standalone GitHub repos).

## Methodology

For each repo listed in AGENTS.md sections:
1. `gh api repos/KooshaPari/<name> --jq '{name, isArchived}'` to check existence and archived status
2. Cross-referenced against documented ADR dispositions (DELETE / MERGE / ARCHIVE)
3. Marked stale with strikethrough + parenthetical status in AGENTS.md

## Stale Repos Found

### pheno-* family (19 of 22 stale)

| Repo | Status | Notes |
|------|--------|-------|
| pheno-cargo-template | 404 | Never created or deleted |
| pheno-cli-base | 404 | Never created or deleted |
| pheno-config | 404 | Absorbed into `Configra` per ADR-031 |
| pheno-errors | 404 | Never created or deleted |
| pheno-flags | 404 | Never created or deleted |
| pheno-otel | 404 | Never created or deleted |
| pheno-port-adapter | 404 | Never created or deleted |
| pheno-cost-card | 404 | Never created or deleted |
| pheno-fastapi-base | 404 | Never created or deleted |
| pheno-llms-txt | 404 | Never created or deleted |
| pheno-mcp-router | 404 | Never created or deleted |
| pheno-prompt-test | 404 | Never created or deleted |
| pheno-pydantic-models | 404 | Never created or deleted |
| pheno-scaffold-kit | 404 | Never created or deleted |
| pheno-vibecoding-guard | 404 | Never created or deleted |
| pheno-worklog-schema | 404 | Never created or deleted |
| pheno-go-ctxkit | 404 | Never created or deleted |
| pheno-zod-schemas | 404 | Never created or deleted |
| pheno-wtrees | 404 | Never created or deleted |

**Live:** pheno-agents-md, pheno-context, pheno-tracing

### Submodule-style repos (6 of 17 stale)

| Repo | Status | Notes |
|------|--------|-------|
| McpKit | 404 | Was to MERGE into PhenoMCP per ADR-003 |
| NetScript | 404 | DELETE per ADR-001 |
| PhenoKits | 404 | Deleted |
| PhenoMCP | 404 | Target of McpKit merge, also deleted |
| PhenoProc | 404 | Deleted |
| Pyron | 404 | Deleted |

**Live:** AuthKit, Civis, Eidolon, Eventra, HeliosLab, KWatch, KodeVibe, KlipDot, Tasken, Tracera, Tracely

## Actions Taken

1. **`AGENTS.md:64-69`** — Updated pheno-* family listing: live count per language (3/11 Rust, 0/10 Python, 0/1 Go, 0/1 TS, 0/1 container), stale repos strikethrough'd with status annotations
2. **`AGENTS.md:73-75`** — Split submodule-style repos into two groups: 11 live (listed first) and 6 stale (strikethrough'd with ADR cross-references)
3. **`AGENTS.md:503`** — Added v54 fleet cleanup entry to Stale/warnings section referencing this findings file

## Total

- **Stale repos identified:** 25
- **Docs updated:** 1 (`AGENTS.md`) — 3 sections
- **Findings written:** 1 (`findings/2026-06-28-v54-P0-2-stale-repo-retirement.md`)
