# Surface reduction batch 2 — harmonizer + monorepo-state + phenoStandards — 2026-06-18

**Status:** done — registry ledger merged (pending PR). **Predecessor:** [batch 1](./surface-reduction-batch-1-2026-06-18.md) merged registry [#170](https://github.com/KooshaPari/phenotype-registry/pull/170).

**Lane:** repo surface reduction (absorb / fold / stub-only). **Out of scope (other agent — do not duplicate):** G18 omlx split, G19 hub→infra absorption, H14 phenoShared terminal-owner decompose.

## Targets (−2 repos + 1 stub)

| Repo | Disposition | Owner / redirect | Gate | Status |
|------|-------------|------------------|------|--------|
| agileplus-spec-harmonizer | MERGE | AgilePlus `crates/` | RATIONALIZATION_PLAN wave I #12; 12/12 tests | **done** — [AgilePlus#756](https://github.com/KooshaPari/AgilePlus/pull/756) merged; source 404 |
| phenotype-monorepo-state | **DROP** | — | Repo 404; `sr-monorepo-state` in disposition-index | **done** — [#194](https://github.com/KooshaPari/phenotype-registry/pull/194) |
| phenoStandards | STUB ONLY | HexaKit (already retired) | Repo 404; `projects/phenoStandards.json` exists | **done** — 404 confirmed; no archive step |

## Actions (completed)

1. Registry disposition rows `sr-harmonizer`, `sr-phenostandards` + `projects/*.json` updates (this PR)
2. agileplus-spec-harmonizer → AgilePlus absorb — [AgilePlus#756](https://github.com/KooshaPari/AgilePlus/pull/756) merged; source repo deleted (404, not archive-eligible)
3. phenotype-monorepo-state — **DROP** per [#194](https://github.com/KooshaPari/phenotype-registry/pull/194); fold never executed (source deleted)
4. phenoStandards — 404 confirmed; registry stub only

## Follow-up (non-blocking)

| PR | Repo | Role |
|----|------|------|
| [#764](https://github.com/KooshaPari/AgilePlus/pull/764) | AgilePlus | CodeAnt review fixes on harmonizer crate — open; workspace CI red |

## Parallel open PRs (cross-lane)

| PR | Repo | Role |
|----|------|------|
| [#74](https://github.com/KooshaPari/OmniRoute/pull/74) | OmniRoute | ADR-ECO-015 Electrobun desktop spike scaffold |
| [#536](https://github.com/KooshaPari/agentapi-plusplus/pull/536) | agentapi-plusplus | G15 follow-up — canonical root `SPEC.md` |
| [#90](https://github.com/KooshaPari/Agentora/pull/90) | Agentora | W18b phenoShared stub repoint — **merged** |
| [#763](https://github.com/KooshaPari/AgilePlus/pull/763) | AgilePlus | W18b fleet repoint — **merged** |
| [#104](https://github.com/KooshaPari/PhenoPlugins/pull/104) | PhenoPlugins | W18b fleet repoint — **merged** |
| [#632](https://github.com/KooshaPari/Tracera/pull/632) | Tracera | W18b fleet gate — **merged** |
| [#267](https://github.com/KooshaPari/HexaKit/pull/267) | HexaKit | H14 pin repoint — **merged** |

## Coordination

- Branch: `feat/surface-reduction-batch-2-ledger` (registry SSOT closeout)
- Do not edit G18/G19/H14 ledger rows here — owned by gateway / HexaKit lanes
- Fleet repoint manifests: ~~AgilePlus (#763), PhenoPlugins (#104)~~ merged; phenotype-gfx, Civis, phenotype-teamcomm, phenotype-go-sdk remain parallel — no −1 until pheno repos retire
