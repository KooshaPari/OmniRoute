---
repo: "Civis"
role: civ-lab-engine
status: archived
last_boundary_review: 2026-07-17
review_cadence: dormant
in_scope:
  - "Historical snapshot of KooshaPari/Civis (Bevy 0.18 emergent civilization godgame) at archive date 2026-07-17"
  - "Reference for legacy FR traces (FR-CORE-001, FR-CIV-*, FR-GOV-*) and emergence-charter ADRs"
out_of_scope:
  - "Active development — repo is archived on GitHub and read-only"
  - "Single-crate absorption into phenotype-apps — failsafe path: workspace size + toolchain mismatches"
depends_on:
  - "vendor/phenodocs (submodule at pin 35e0e90a)"
depended_on_by: []
---

# Boundary — Civis

## In Scope

- Read-only GitHub archive of `KooshaPari/Civis` (Rust 2024 workspace, 28+ Bevy 0.18 crates + `clients/bevy-ref`).
- Reference corpus for the emergence-charter pattern (PRD.md, PLAN.md, FUNCTIONAL_REQUIREMENTS.md, ADR.md, COMPARISON.md, CIVIS_GAME_DAG.md).
- 200+ session worklogs under `worklogs/` (heritage governance trail).
- Historical evidence for the `civ-lab-engine` role in the registry (`projects/Civis.json`, `projects/Civis-2026-06-25.json`).

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Active Bevy 0.18 godgame simulation | (n/a — archived) | Repo is the canonical implementation; no successor repo. Per registry `repo-Civis` row disposition `ARCHIVE_ONLY`. |
| Single-crate `cargo check` integration | phenotype-apps monorepo | Source workspace spans 28+ crates + Bevy client; absorbing all members would duplicate phenotype-apps' existing 100+ member workspace and inflate CI. |
| Emergence-metrics substrate | phenodocs / docs-only | Spec corpus (N2–N6 coupling specs, emergence audit) is referenced from registry boundary docs but not duplicated. |
| Web dashboard / Civis L2 sandbox | (was `web/dashboard` in source) | Web dashboard was in-repo; not separately archived because it is a consumer of the Bevy server binary. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Registry reference | registry → archived repo | `registry/disposition-index.json#repo-Civis` → `KooshaPari/Civis` (archived) | green |
| Historical FR traceability | phenodocs → archived repo | FR-CORE-001, FR-CIV-* cites | green (snapshot) |
| Submodule pin | archived repo → phenodocs | `vendor/phenodocs @ 35e0e90a` | amber (submodule read-only; repo archived) |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (batch4 absorption queue)
**Worklog / finding:** `audits/absorption-justifications/Civis-2026-07-17.md`
**Decisions:**
- Adopt **ARCHIVE_ONLY** disposition per task failsafe clause (cargo not on PATH on this host; 22 GB `target/` artifact dir; 28+ workspace members + Bevy 0.18 client + Godot/Unreal sub-projects; `vendor/phenodocs` submodule).
- Update `repo-Civis` registry row: `disposition: AFFIRM → ARCHIVE_ONLY`, `target: phenotype-registry`, `boundary_doc: docs/boundary/Civis.md`.
- Archive `KooshaPari/Civis` on GitHub via `gh repo archive KooshaPari/Civis -y`.
- Preserve read-only snapshot of source on disk under `repos/Civis/` (do not delete; per container policy).
- The 2026-06-25 AFFIRM audit (`Civis-2026-06-25.md`) is superseded by this ARCHIVE_ONLY disposition but remains in the registry for historical traceability.

**Next review:** 2027-01-17 (dormant cadence; only re-open if a restoration PR is filed against the archived repo)