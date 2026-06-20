---
repo: "phenotype-bus"
role: archived
status: archived
last_boundary_review: 2026-06-17
review_cadence: 30d
in_scope:
  - "No active product surface; historical archive only."
out_of_scope:
  - "Event bus implementation details"
  - "Any new feature work"
---

# Boundary — phenotype-bus

## In Scope

Archived reference only. No active boundary work remains.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Event bus infrastructure | `phenotype-registry` / `phenoShared` governance docs | Repo is archived and delete-ready once retention gates clear |
| New message routing or transport work | `pheno-router-monitor`, `substrate`, `Eventra` | Active routing surfaces live elsewhere |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Archive-only repo marker | `this-repo→other` | file | green |
| Historical consumer manifest | `other→this-repo` | file | green |

## Last Boundary Review

**Date:** 2026-06-17
**Reviewer:** codex
**Worklog / finding:** `worklogs/L7-001-intent-boundary-curation-2026-06-17.json`
**Decisions:**
- Archived and delete-ready; no active boundary surface remains.

**Next review:** 2026-07-17
