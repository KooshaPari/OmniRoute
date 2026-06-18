# ADR-030: Spine repos are read-only references (Decision D)

**Status:** ACCEPTED
**Date:** 2026-06-17
**Author:** orchestrator (claude opus 4.7)
**L5-109** (v7 phase closure)
**Refs:**
- AGENTS.md § "Decision D — Spine repos are LIGHTLY USED"
- ADR-024 (71-pillar audit framework) § "Spine context"
- `findings/2026-06-17-L5-109-spine-repos-readonly.md`

---

## Context

Five repos serve as "spine" (cross-cutting pattern sources) for the Phenotype fleet:

| Repo | Role | Activity |
|---|---|---|
| `PhenoHandbook` | Handbook, philosophy, on-ramps | Light (template-only) |
| `PhenoSpecs` | Top-level spec repository | Light (mostly mirrors) |
| `phenotype-registry` | Ecosystem registry of all pheno-* | Light (stale, last refresh 2026-04) |
| `phenotype-infra` | Infrastructure playbooks | Light (mostly historical) |
| `phenokits-commons` | Common kit definitions | Light (template) |

These repos are referenced for patterns and cross-references but not actively maintained. They were created early in the fleet (2026-03..04) before the polyglot split was clear.

## Decision

**Spine repos are READ-ONLY references. No new content is authored in them.**

Active spine going forward is the local monorepo's `findings/`, `docs/adr/`, and `plans/` directories.

## Consequence

- No new commits, issues, or PRs in `PhenoHandbook`, `PhenoSpecs`, `phenotype-registry`, `phenotype-infra`, `phenokits-commons`
- Existing content is preserved (historical)
- Pattern + cross-reference roles migrate to local monorepo governance directories:
  - `findings/` — analysis, audit, decision logs
  - `docs/adr/` — accepted architecture decisions
  - `plans/` — multi-step execution plans
- The 71-pillar audit (ADR-024) refreshes the registry (`phenotype-registry`) once per quarter, sourced from local `findings/`

## Registry update cadence

| Source | Target | Cadence |
|---|---|---|
| Local `findings/2026-06-17-L5-102-71-pillar-audit.md` | `phenotype-registry` `entries/71-pillar/*` | Weekly (Mon 09:00 PDT) |
| Local `docs/adr/INDEX.md` | `phenotype-registry` `entries/adr/*` | On ADR acceptance |
| Local `plans/2026-06-*.md` | `phenotype-registry` `entries/plan/*` | On plan acceptance |

## Cross-references

- `AGENTS.md` "Decision D" section
- `phenotype-registry` README § "Refresh sources"
- ADR-024 (71-pillar audit framework) § "Refresh cadence"
