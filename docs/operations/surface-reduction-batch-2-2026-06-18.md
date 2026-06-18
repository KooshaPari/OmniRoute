# Surface reduction batch 2 — harmonizer + monorepo-state + phenoStandards — 2026-06-18

**Status:** stub — awaiting batch-2 execution subagent. **Predecessor:** [batch 1](./surface-reduction-batch-1-2026-06-18.md) merged registry [#170](https://github.com/KooshaPari/phenotype-registry/pull/170).

**Lane:** repo surface reduction (absorb / fold / stub-only). **Out of scope (other agent — do not duplicate):** G18 omlx split, G19 hub→infra absorption, H14 phenoShared terminal-owner decompose.

## Targets (−2 repos + 1 stub)

| Repo | Disposition | Owner / redirect | Gate |
|------|-------------|------------------|------|
| agileplus-spec-harmonizer | MERGE | AgilePlus `crates/` | RATIONALIZATION_PLAN wave I #12; 12/12 tests |
| phenotype-monorepo-state | **DROP** | — | Repo 404; source deleted, content not recovered; `sr-monorepo-state` in disposition-index |
| phenoStandards | STUB ONLY | HexaKit (already retired) | Repo 404; `projects/phenoStandards.json` exists |

## Actions (pending)

1. Registry disposition rows + any `projects/*.json` updates (this lane)
2. agileplus-spec-harmonizer → AgilePlus absorb PR; archive harmonizer after merge
3. ~~phenotype-monorepo-state governance snapshots → fold into registry ops docs~~ **DROP** — repo deleted (404); fold never executed; registry disposition row only (do not recreate repo)
4. phenoStandards — confirm 404; no repo archive step

## Parallel open PRs (cross-lane)

| PR | Repo | Role |
|----|------|------|
| [#74](https://github.com/KooshaPari/OmniRoute/pull/74) | OmniRoute | ADR-ECO-015 Electrobun desktop spike scaffold |
| [#536](https://github.com/KooshaPari/agentapi-plusplus/pull/536) | agentapi-plusplus | G15 follow-up — canonical root `SPEC.md` |
| [#88](https://github.com/KooshaPari/Agentora/pull/88) (draft) | Agentora | W18b phenoShared repoint plan — **partial** until consumer repoint merges (H14 HexaKit#267 landed) |
| [#763](https://github.com/KooshaPari/AgilePlus/pull/763) | AgilePlus | W18b fleet repoint — **merged** |
| [#104](https://github.com/KooshaPari/PhenoPlugins/pull/104) | PhenoPlugins | W18b fleet repoint — **merged** |
| [#632](https://github.com/KooshaPari/Tracera/pull/632) | Tracera | W18b fleet gate — **merged** |
| [#267](https://github.com/KooshaPari/HexaKit/pull/267) | HexaKit | H14 pin repoint — **merged** |

## Coordination

- Branch: `feat/surface-reduction-batch-2` (execution) + `feat/surface-reduction-batch-2-ledger` (registry SSOT)
- Do not edit G18/G19/H14 ledger rows here — owned by gateway / HexaKit lanes
- Fleet repoint manifests: ~~AgilePlus (#763), PhenoPlugins (#104)~~ merged; phenotype-gfx, Civis, phenotype-teamcomm, phenotype-go-sdk remain parallel — no −1 until pheno repos retire
