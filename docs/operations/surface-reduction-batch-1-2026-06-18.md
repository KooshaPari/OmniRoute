# Surface reduction batch 1 — upstream forks + McpKit gate — 2026-06-18

**Status:** registry merged [#170](https://github.com/KooshaPari/phenotype-registry/pull/170) (2026-06-18) — `projects/*.json` stubs + disposition-index `sr-*` rows. Repo `gh archive` ×4 remains downstream execution.

**Successor:** [surface-reduction-batch-2-2026-06-18.md](./surface-reduction-batch-2-2026-06-18.md) (stub).

**Lane:** repo surface reduction (absorption/archive). **Out of scope:** G18 omlx, G19 hub→infra, H14 terminal-owner absorption (other agent).

## Targets (−4 repos)

| Repo | Disposition | Owner / redirect | Gate |
|------|-------------|------------------|------|
| Planify | ARCHIVE | upstream-maintained fork | RATIONALIZATION_PLAN step 1 |
| portage | ARCHIVE | upstream-maintained fork | same |
| phenotype-ops-mcp | ARCHIVE | PhenoMCPServers `servers/external/` | same |
| McpKit | ARCHIVE | ADR-017 supersession (PhenoFastMCP*, PhenoMCPServers, substrate) | BOUNDARY_OWNERS 5/5; registry#156 |

## Actions

1. Registry disposition rows + `projects/*.json` stubs (this PR)
2. `gh repo archive` ×4 with tombstone README on default branch where possible
3. Update `archive-gate-verification-2026-06-18.md`

## Deferred batch 2

- agileplus-spec-harmonizer → AgilePlus absorb (−1 after merge)
- phenotype-monorepo-state → phenotype-registry docs fold
- phenoStandards — repo already 404; registry stub only

## Fleet repoint (no −1 until pheno retires)

| Consumer | Status | PR |
|----------|--------|-----|
| AgilePlus | **repointed** | [#763](https://github.com/KooshaPari/AgilePlus/pull/763) merged |
| PhenoPlugins | **repointed** | [#104](https://github.com/KooshaPari/PhenoPlugins/pull/104) merged |
| phenotype-gfx | pending | — |
| Civis | pending | — |
| phenotype-teamcomm | pending | — |
| phenotype-go-sdk | pending | — |
