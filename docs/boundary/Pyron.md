---
repo: "Pyron"
role: archived
status: restored-archived
last_boundary_review: 2026-06-17
review_cadence: 30d
in_scope:
  - "Archived tombstone and migration evidence only."
out_of_scope:
  - "New middleware or utility development"
  - "Canonical ownership of migrated domain crates"
---

# Boundary — Pyron

## In Scope

Archived tombstone state, migration evidence, and historical lockstep repoint notes.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Config / `settly` | `phenotype-config` | Pyron was a chokepoint consumer, not final owner |
| Trace / logging | `PhenoObservability` | Observability surfaces were repointed out |
| Stash / cache / resilience | `phenotype-resilience` / SDK facades | HexaKit and phenoShared were transitional |
| Event bus | `phenoEvents` / `Eventra` by layer | Repo is archived; event surfaces live elsewhere |
| Contract traits and adapters | DOMAIN_ROLES owners | Contract work decomposed by role |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Tombstone archive evidence | `this-repo→registry` | file | green |
| Historical lockstep repoints | `registry→this-repo` | Cargo/git/docs | green |

## Last Boundary Review

**Date:** 2026-06-17
**Reviewer:** forge subagent (L7-001 sweep)
**Worklog / finding:** `worklogs/L7-001-intent-boundary-curation-2026-06-17.json`
**Decisions:**
- Restored as archived after premature deleted/404 state.
- No new work binds to Pyron; use domain owner repos instead.

**Next review:** 2026-07-17
