# Finding — Agent-effort governance (L5-101)

**Date:** 2026-06-15
**Task:** L5-101
**ADR:** ADR-023
**Worklog:** `worklogs/L5-101-app-governance-2026-06-15.json`

## Headline

Three coupled rules govern where agent time goes, on which device, and where shared code lives. Effective immediately (2026-06-15).

1. **Device-fit gate** — the MacBook is not a heavy-work device. Heavy tasks carry `device: heavy-runner` in the worklog v2.1 row; `device: macbook` is reserved for the work the MacBook can actually do well (planning, ADR-writing, small focused PRs, code review, dogfooding). Heavy work happens on a self-hosted runner or a dispatched subagent.
2. **App-level repo triage by dogfood use** — `Civis` is ACTIVE (full SWE process); `focalpoint`, `QuadSGM`, `AtomsBot*` (as a target) are PAUSED; `Dino` and `WSM` are CONDITIONAL (engine/non-frontend only for `Dino`, none right now for `WSM`); every other app-level repo (e.g. `HwLedger`) defaults to PAUSED and is reclassified per Rule 3.
3. **App substrate placement (no "random `phenoShared`")** — shared code lives in one of four canonical placements: `pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`, or federated service. New shared code ships with spec, docs, test matrix (unit + e2e + integ + perf + chaos), OTLP observability, coverage gate, and CI gate as a single package.

## Why

- **Device mismatch** was producing noise (slow CI, truncated logs, timeouts) without producing signal.
- **App-level dogfood gap** was the reason `AtomsBot*` had 20 unstarted DAG tasks — the work would not be dogfooded, so it would not pay back.
- **Substrate sprawl** (`phenoShared/`, per-app `lib/`, `crates/`) was causing context waste, quality decay, and LOC bloat simultaneously.

## Bucket table (source of truth lives in `STATUS.md`)

| Repo         | Bucket                         | Allowed work                                                              |
| :----------- | :----------------------------- | :------------------------------------------------------------------------ |
| `Civis`      | ACTIVE                         | Any. Full SWE process.                                                    |
| `focalpoint` | PAUSED                         | Read-only. Shelved.                                                       |
| `Dino`       | CONDITIONAL                    | Engine / non-frontend only (heavy visual engine, asset pipeline, sim).    |
| `WSM`        | CONDITIONAL                    | None right now.                                                           |
| `QuadSGM`    | PAUSED                         | Read-only.                                                                |
| `AtomsBot*`  | PAUSED-as-target (RESOURCE)    | May be legally mined for code/concepts/schema/docs/tests.                 |
| `HwLedger` + all other app-level repos | RECLASSIFY (default PAUSED) | Until reclassified, no new work.                                         |

## Substrate decision tree (Rule 3)

```
1. Is it a single language, single concern, no I/O?     -> pheno-*-lib
2. Is it cross-language with a stable public API?       -> phenotype-*-sdk
3. Does it dictate application lifecycle / DI / config? -> phenotype-*-framework
4. Is it stateful, scalable, or long-running?           -> federated service
```

The "random `phenoShared`" pattern is forbidden. Existing "random `phenoShared`" placements are migrated per-capability; the migration is tracked in the L6 health-audit delta.

## Quality bar for new substrate (Rule 3.1)

| Field         | Requirement                                                                          |
| :------------ | :----------------------------------------------------------------------------------- |
| Spec          | `SPEC.md` or equiv, 1-page max                                                       |
| Docs          | `README.md` + 1 concept doc, 5-line quickstart, "when NOT to use it" section         |
| Test matrix   | unit + integ minimum; e2e + perf + chaos preferred for fleet-critical substrates      |
| Observability | OTLP export via `pheno-tracing` (ADR-012), info-level minimum                        |
| Coverage      | 80 % lib/SDK, 70 % framework, 60 % federated service                                 |
| CI gate       | `pheno-ci-templates` runs test matrix, coverage gate, OTLP smoke test                |
| Worklog       | v2.1 schema with `device:` field                                                     |

The goal is **HITL-less dev from base intent**: a one-line intent ("I need a `Config` struct for my service that reads from env and a TOML file, with a 12-factor cascade") produces a PR that already has all of the above, without the human in the loop having to specify each one.

## Implementation

- **ADR-023 written:** `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` (285 lines).
- **INDEX updated:** `docs/adr/2026-06-15/INDEX.md` (table row 023 added, scope note for ADR-023 added).
- **AGENTS.md updated:** new "App-level repo triage" table + new "App substrate placement (no random `phenoShared`)" section + ADR-023 row in the Active ADRs table.
- **SSOT.md updated:** new row "Agent-effort governance" pointing to ADR-023.
- **STATUS.md updated:** new § "App-level repo triage" table + ADR-023 row in the Active ADRs table + new "open thread" item: reclassify `HwLedger` per Rule 3.
- **Worklog JSON written:** `worklogs/L5-101-app-governance-2026-06-15.json` (bucket assignments + substrate rules + quality bar).
- **Schema bump noted:** ADR-015 v2.0 → v2.1, additive (11th column `device:`, enum `macbook | heavy-runner`). Migration is mechanical. 1-week deprecation period with warning, error after 2026-06-22.

## Verification

- `grep -c 'ADR-023' AGENTS.md SSOT.md STATUS.md docs/adr/2026-06-15/INDEX.md` returns ≥ 1 in all 4 files.
- `findings/2026-06-15-L5-101-app-governance.md` is on disk.
- `worklogs/L5-101-app-governance-2026-06-15.json` is on disk and parses as valid JSON.
- ADR-023 file is well-formed (Nygard: Context / Decision / Consequences / Alternatives / References).
- The bucket table in `STATUS.md` matches the bucket table in `AGENTS.md` matches the bucket table in the worklog JSON.

## Follow-ups

- **L6 health-audit delta (next weekly run):** add a "bucket drift" check — any active PR/branch in a PAUSED repo or `device: macbook` on a heavy task is a P1 finding.
- **`HwLedger` reclassification:** open a per-capability migration plan to move underlying parts from "random `phenoShared`" to one of the four canonical placements. This is the first concrete deliverable of ADR-023.
- **ADR-015 v2.1 schema bump:** file `ADR-015-v2.1-worklog-schema.md` (or amendment) with the 11th column definition, deprecation timeline, and migration script. Owner: worklog-schema circle.
- **`AtomsBot*` re-purposing:** the 20 DAG tasks in the `AtomsBot decomposition` plan are not closed — they are deferred to "seed `HwLedger` reclassification when a concrete capability is identified" or "use as a reference for the engine / non-frontend slice of `Dino` if it overlaps."
- **`CODEOWNERS` review:** every PAUSED app-level repo needs a `CODEOWNERS` entry that blocks new branches without a bucket-change worklog row. This is the lock; the bucket table is the policy.
