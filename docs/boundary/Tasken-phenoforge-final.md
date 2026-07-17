---
repo: "Tasken-phenoforge-final"
role: recovery-snapshot
status: archived
last_boundary_review: 2026-07-17
review_cadence: dormant
in_scope:
  - "Historical snapshot of KooshaPari/Tasken-phenoforge-final (recovery capture dated 2026-07-15; GitHub archive date 2026-07-17)"
  - "Preserved phenoForge provenance under docs/history/archived-repos/phenoForge/ (ADR.md, ARCHIVED.md, FUNCTIONAL_REQUIREMENTS.md, ORIGIN.md, PLAN.md, PRD.md, README.md, SOTA_RESEARCH.md, SPEC.md, TEST_COVERAGE_MATRIX.md)"
  - "Companion forge mirror at docs/history/archived-repos/forge.md"
  - "Reference for absorbed phenoForge build-orchestrator research and product intent (build-runner / DAG / caching / plugin / remote execution requirements)"
out_of_scope:
  - "Active development — repo is archived on GitHub (isArchived=true verified 2026-07-17T14:57:07Z) and read-only"
  - "Canonical task-orchestration product — Tasken remains the canonical active task orchestration product per README §'Absorbed phenoForge contract'"
  - "Single-crate absorption into phenotype-tooling — the recovery snapshot is preserved verbatim for provenance, not lifted as a new substrate"
depends_on: []
depended_on_by:
  - "KooshaPari/Tasken (canonical active task orchestration; absorbs phenoForge contract material)"
  - "phenotype-registry/registry/disposition-index.json#DSPI-Tasken-phenoforge-final (registry row records the recovery-snapshot provenance)"
---

# Boundary — Tasken-phenoforge-final

## In Scope

- Read-only GitHub archive of `KooshaPari/Tasken-phenoforge-final` (419 KB on GitHub; default branch `chore/governance-baseline`; created 2026-07-16T00:25:38Z, last push 2026-07-16T00:37:11Z, archived 2026-07-17T14:57:07Z).
- Recovery snapshot purpose: capture the Tasken source tree (Rust hexagonal implementation under `src/`, Python async orchestrator under `python/`) at the moment phenoForge build-orchestrator research was absorbed into Tasken.
- Preserved phenoForge provenance tree at `docs/history/archived-repos/phenoForge/` — 10 documents that anchor the absorbed contract:
  - `PRD.md`, `SPEC.md`, `PLAN.md`, `FUNCTIONAL_REQUIREMENTS.md`, `TEST_COVERAGE_MATRIX.md`, `SOTA_RESEARCH.md`
  - `ADR.md`, `ARCHIVED.md`, `ORIGIN.md`, `README.md`
- Companion note at `docs/history/archived-repos/forge.md` (forks/mirrors of the phenoForge thread).
- Historical evidence for the absorbed-into-Tasken relationship recorded in `projects/phenoForge.json` (`absorbed_into: Tasken`, `absorption_note: Phenotype task-runner fork absorbed into Tasken`).

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Active task orchestration | `KooshaPari/Tasken` | README §"Absorbed phenoForge contract" declares Tasken the canonical active product; the snapshot is a recovery capture, not a competing implementation. |
| phenoForge product code (Rust crates, CLI, build-orchestrator binary) | (n/a — phenoForge source repo was deleted 2026-06-16 per `projects/phenoForge.json`) | Only docs were preserved into the snapshot; source code is gone. |
| Single-crate `cargo check` / `pip install` rehydration | (n/a — archived) | The snapshot is preserved for provenance, not lifted as a new substrate; no consumer is expected to `cargo build` or `pip install` against it. |
| New commits / PRs / issues | (n/a — repo archived) | `gh repo archive -y` makes the remote read-only; the snapshot is terminal. |
| PhenoForge-spec docs reproduction | `phenotype-registry/docs/boundary/phenoForge.md` + `Tasken-phenoforge-final/docs/history/archived-repos/phenoForge/` | PhenoForge boundary doc records the upstream registry entry; the snapshot's `docs/history/archived-repos/phenoForge/` subtree keeps the original Markdown verbatim. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Registry row | registry → archived repo | `registry/disposition-index.json#DSPI-Tasken-phenoforge-final` → `KooshaPari/Tasken-phenoforge-final` (archived) | green |
| Provenance attribution | archived repo → Tasken canonical | README §"Absorbed phenoForge contract" declares Tasken canonical | green (snapshot) |
| Provenance attribution | archived repo → phenoForge history | `docs/history/archived-repos/phenoForge/` tree links to upstream `KooshaPari/phenoForge` (deleted 2026-06-16) | green (snapshot) |
| Subdomain research reference | downstream Phenotype work → archived repo | build-runner / DAG / caching / plugin / remote-execution research threads cite the snapshot for historical context | green (read-only) |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (batch5 absorption queue)
**Worklog / finding:** `audits/absorption-justifications/Tasken-phenoforge-final-2026-07-17.md`
**Decisions:**
- Adopt **ARCHIVE_ONLY** disposition. The repo is explicitly described on GitHub as "recovery snapshot of Tasken-phenoforge-final (2026-07-15)" and the README §"Absorbed phenoForge contract" declares it a historical artifact, not an active product.
- Preserve the read-only snapshot on disk under `repos/Tasken-phenoforge-final/` (do not delete; per container policy: dirty child repositories and linked worktrees must not be bulk-cleaned without a repository-specific audit).
- Update `registry/disposition-index.json` with new row `DSPI-Tasken-phenoforge-final`: `disposition: ARCHIVE_ONLY`, `target: phenotype-registry`, `absorbing_repo: phenotype-registry`, `archived_at: 2026-07-17`, `archive_reason: recovery-snapshot-preserve-verbatim`.
- Archive `KooshaPari/Tasken-phenoforge-final` on GitHub via `gh repo archive KooshaPari/Tasken-phenoforge-final -y`; `isArchived=true` verified at 2026-07-17T14:57:07Z.
- No code is copied. The snapshot's value is provenance — it captures the Tasken tree at the exact moment the phenoForge contract material was folded in.

**Next review:** 2027-07-17 (dormant cadence; only re-open if a restoration PR is filed against the archived repo).