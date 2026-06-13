# DAG vs V3 Delta - 2026-06-10

## Sources Compared

- `FLEET_100TASK_DAG.md` - V1 hygiene DAG, 100 tasks.
- `FLEET_100TASK_DAG_V2_MERGED.md` - V2-MERGED broad fleet superset, 120 main + 20 side tasks.
- `FLEET_100TASK_DAG_V3.md` - V3 focus edition, 100 main + 20 side tasks.
- `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md` - current modernization plan and execution status.
- `plans/2026-06-08-100-task-dag.md` - completed 100-task cleanup DAG.

## Executive Delta

V3 does not continue V2-MERGED as a broad fleet rollout. It narrows the execution budget to four focus repos plus one substrate repo:

- Focus repos: `PlayCua`, `nanovms`, `PhenoCompose`, `BytePort`.
- Substrate repo: `AgilePlus`.
- Strategy shift: from broad hygiene/SOTA across roughly 36 repos to stabilize-then-optimize work on dense focus lanes.

The original V1 DAG is not recorded as fully complete. `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md` says the original V1 100 tasks are roughly 60-70% executed, with the remaining 30-40% being structural consolidation, rename, and FFI work. The separate cleanup DAG in `plans/2026-06-08-100-task-dag.md` is fully complete, but it is a different 100-task plan.

## V1 Tasks Done

### Done by explicit source status

These V1 task families are documented as done or substantially done in `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md`:

| V1 range | V1 family | Status | Commit evidence |
|---|---|---|---|
| 1-20 | State unification | Done/substantially executed | Commit SHAs not recorded in the source files. |
| 21-40 | Stash resolution + branch hygiene | Done/substantially executed | Commit SHAs not recorded in the source files. |
| 41-43 | LICENSE files for `KWatch`, `OmniRoute`, `agslag-docs` | Done as part of LICENSE-complete working set | Commit SHAs not recorded in the source files. |
| 44-50, 58-60 | `.editorconfig` governance baseline | Done/substantially executed | Commit SHAs not recorded in the source files. |
| 51-58 | `CHANGELOG.md` governance baseline | Done/substantially executed | Commit SHAs not recorded in the source files. |
| 61-68 | `Justfile` + CI gaps | Done/substantially executed | Commit SHAs not recorded in the source files. |
| 69-80 | `CONTRIBUTING.md` + `SECURITY.md` gaps | Done/substantially executed | Commit SHAs not recorded in the source files. |

### Done by named commit

| Task area | Repo | Done item | Commit |
|---|---|---|---|
| V3 predecessor structural cleanup | `Eidolon` | `release-registry.toml` sandbox source updated to `KDesktopVirt`; `docs/EXTRACTION_PLAN.md` removed | `90cdebf` |

### Separate completed cleanup DAG

`plans/2026-06-08-100-task-dag.md` records all 100 of its cleanup tasks as complete:

- Level 1: push unpushed branches, tasks 1-20 - DONE.
- Level 2: clean branches and commit changes, tasks 21-40 - DONE.
- Level 3: dependency/security audit, tasks 41-60 - DONE.
- Level 4: CI optimization/workflow consolidation, tasks 61-80 - DONE.
- Level 5: final verification, tasks 81-100 - DONE.

That file does not include commit SHAs. Its completion evidence is status text only.

## V1 Tasks Not Yet Done / Carried Forward

The V1 remainder is not mostly more file hygiene. Per the modernization plan, the remaining 30-40% became structural work:

- Consolidations: duplicate repo merges/removals, canonical-home decisions.
- Renames: e.g. `kvirtualstage` -> `kvdesktop`.
- FFI bindings: PyO3, UniFFI, napi-rs, cgo/C-ABI choices by project.
- Libification: extracting reusable cores from application repos.

These are now represented by V3 Layer 4 and Layer 5 lanes rather than by V1's governance-doc tasks.

## V2-MERGED Tasks Superseded by V3 Lanes

| V2-MERGED range | V2-MERGED intent | V3 superseding lane(s) | Delta |
|---|---|---|---|
| L1 / 1-20 | Active/new repo status reports across 11 active + 5 new + 4 cross-cutting concerns | V3 L1 / 1-20 | Superseded by focus-repo audits, worktree/branch/PR/stash audits, and DAG cross-checks. V3 drops broad active-new coverage. |
| L2 / 21-40 | Fleet-wide hygiene and SOTA foundation across all 36 repos | V3 L2 / 21-40 | Superseded by focus-repo tooling modernization, cheap-llm-mcp merge, and focused governance/CI baselines. |
| L3 / 41-60 | Cross-cutting SOTA and test coverage across the fleet | V3 L3 / 41-60 | Superseded by focus-repo coverage, SOTA, typed/tested/traced lanes. |
| L4 / 61-80 | Cross-cutting library extraction and runtime modernization | V3 L4 / 61-80 | Superseded by explicit hexagonal/polyrepo refactor and Composio-like definition/transport/runtime splits. |
| L5 / 81-100 | Active + new repo integrations | V3 L5 / 81-100 | Superseded by focus-repo integration, acceptance, worklog, and dispatch lanes. |
| L6 / 101-120 | Priority-fleet integrations preserved from original V2 L5 | No direct broad-fleet lane in V3 | Superseded/deferred. V3 intentionally removes the broad priority-fleet integration rectangle. |
| Side DAG / SD1-SD4 | Four live projects x five subtasks | V3 side DAGs | Superseded by V3's focus side DAGs tied to the focus repos and substrate work. |

## V3 Lanes That Inherit From V2-MERGED

| V3 lane | Inherits from V2-MERGED | What changed |
|---|---|---|
| L1: State unification + focus-repo audit | V2-MERGED L1 audit pattern and cross-cutting audit outputs | Narrows from 36-repo status generation to `PlayCua`, `nanovms`, `PhenoCompose`, `BytePort`, `AgilePlus`, plus repo-state audits. |
| L2: Tooling modernization + cheap-llm-mcp merge | V2-MERGED L2 hygiene/tooling foundation | Keeps governance/CI baseline intent but makes `Taskfile.yml` + `justfile` migration and `cheap-llm-mcp` -> `dispatch-mcp` the main work. |
| L3: SOTA + test coverage | V2-MERGED L3 SOTA/test coverage | Keeps measurable coverage/typing/tracing uplift, but applies it to focus repos instead of all fleet repos. |
| L4: Libification + hexagonal refactor | V2-MERGED L4 library extraction and runtime modernization | Makes the structural work explicit: domain/ports/adapters extraction, `pheno-port-adapter`, and definition/transport/runtime separation. |
| L5: Integration + side DAGs | V2-MERGED L5/L6 integration layers and side DAG concept | Replaces broad active/new and priority-fleet integrations with focus-repo acceptance, stitching, worklogs, and release verification. |
| Focus allocation table | V2-MERGED rectangular 20-lane scheduling discipline | Keeps the 20-wide scheduling shape, but allocates repeated dedicated lanes per focus repo across L1-L5. |

## Concrete Inheritance Map

- `BytePort`: V2-MERGED L1 task 5 already treated BytePort as an active repo needing status/SPEC/TODO tracking. V3 keeps BytePort as a first-class focus repo with lanes #4, #24, #44, #64, #84.
- `nanovms`: present in the completed cleanup DAG and in the modernization decisions around PhenoCompose/nanovms/Pine. V3 promotes it into a focus repo with lanes #2, #22, #42, #62, #82.
- `PhenoCompose`: inherits from the modernization plan's PhenoCompose/nanovms/Pine decisions and V2-MERGED libification direction. V3 gives it lanes #3, #23, #43, #63, #83.
- `PlayCua`: inherits from the modernization plan's Eidolon/Agent-Use duplicate/consolidation decision. V3 gives it lanes #1, #21, #41, #61, #81.
- `AgilePlus`: inherits from the Tracera split/substrate idea in the modernization plan. V3 uses it as substrate with lanes #5, #25, #45, #65, #85.

## Notes

- Source files do not contain per-task commit SHAs for most completed V1 or cleanup-DAG work. The only explicit SHA in the compared sources is `90cdebf`.
- V3's supersession is strategic, not chronological cleanup: V2-MERGED remains useful as a broad fleet backlog, but V3 is the active focus plan for 2026-06-10.
