---
repo: "SessionLedger"
role: session-compiler
status: active
last_boundary_review: 2026-07-08
review_cadence: 30d
in_scope:
  - OKF session bundle schema validation and conformance fixtures
  - sl-daemon HTTP API (ingest, search, replay SSE, metrics, healthz)
  - sl-viewer desktop/web session UI
  - session archive/restore and continuation-bundle distillation
out_of_scope:
  - LLM token cost accounting (Tokn)
  - Hardware asset ledger (hwLedger)
  - Org-wide policy enforcement workflows (phenotype-org-governance)
  - Fleet audit template definitions (phenotype-org-audits)
---

# Boundary - SessionLedger

## In Scope

- Compile/distill agent sessions into OKF continuation bundles
- Local daemon + desktop/web viewer surfaces
- Session search, replay, and metrics for operator/agent recovery

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Token/cost routing ledger | Tokn | Different domain (usage economics) |
| Hardware inventory | hwLedger | Different domain |
| 100+ pillar rubric definitions | phenotype-org-audits | Audit SSOT |
| Reusable deny/secret-scan policy | phenotype-org-governance | Enforcement SSOT |
| Ecosystem disposition index | phenotype-registry | Spine SSOT |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| OKF spec / fixtures | this → consumers | JSON fixtures + docs/reference | green |
| audit-v38 scorecards | audits ↔ this | `audit/.lane-*` + org-audits output | amber |
| process-compose / Containerfile | this → ops | local deploy | green |

## Last Boundary Review

**Date:** 2026-07-08
**Reviewer:** cursor agent (v38 spine registration)
**Worklog / finding:** SessionLedger v38 Audit plan
