---
repo: "pheno-contracts"
role: archived
status: archived
last_boundary_review: 2026-06-17
review_cadence: 30d
in_scope:
  - "Historical contract-verification notes only."
out_of_scope:
  - "New trait or adapter development"
  - "Any active product surface"
---

# Boundary — pheno-contracts

## In Scope

Archive-only record. Live contract work now lives in downstream owners and interim canonical crates.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Domain contract implementation | `phenoShared`, `Authvault`, `Eventra`, `Agentora` | Decomposed per D-01 and related ledgers |
| Contract verification harnesses | `phenotype-rust-sdk` / downstream test bundles | Live verification moved out of this repo |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Historical contract manifest | `this-repo→other` | file | green |
| Decomposition ledger reference | `other→this-repo` | file | green |

## Last Boundary Review

**Date:** 2026-06-17
**Reviewer:** codex
**Worklog / finding:** `worklogs/L7-001-intent-boundary-curation-2026-06-17.json`
**Decisions:**
- Archived and delete-ready; contract functionality is decomposed elsewhere.

**Next review:** 2026-07-17
