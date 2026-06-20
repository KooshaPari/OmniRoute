# ADR-041: 71-pillar refresh cadence (weekly Monday 09:00 PDT)

> **Re-authored 2026-06-20 after disk loss (per L5-121).**
> Original authored 2026-06-18 by orchestrator (claude opus 4.7) — v8 batch T14.4.
> Reconstructed from git history (`c583faf8c7~1`) + surviving schema doc
> ([`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md))
> + surviving refresh template
> ([`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md))
> + L5-121 prep notes
> ([`findings/2026-06-20-L5-121-monday-refresh-prep.md`](../../../findings/2026-06-20-L5-121-monday-refresh-prep.md)).
>
> **Also lost in the same disk event** (and not yet recovered): `findings/audit-71-pillar-2026-06-17-wrapup.md`,
> `findings/71-pillar-2026-06-17.md` (baseline scorecard), `findings/71-pillar-2026-06-17-mapping.md`,
> `findings/2026-06-17-L5-102-71-pillar-audit.md`, and the prior week's cycle artifacts.

- **Status:** Accepted 2026-06-18 (re-authored 2026-06-20, no substantive change)
- **Date:** 2026-06-18 (original); 2026-06-20 (re-author commit)
- **Author:** orchestrator (claude opus 4.7) — v8 batch T14.4
- **L8-007** (v8 track T13)
- **Refs:**
  - ADR-024 (71-pillar audit framework) — re-authored in same commit
  - ADR-026 (Factory AI Agent Readiness Model)
  - Schema (surviving): [`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md)
  - Refresh template (surviving, PR #37): [`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md)
  - Baseline scorecard: **MISSING FROM DISK** (`findings/71-pillar-2026-06-17.md` lost in same event)
  - Wrap-up doc: **MISSING FROM DISK** (`findings/audit-71-pillar-2026-06-17-wrapup.md` lost in same event)
  - L1–L30 → L1–L71 crosswalk: **MISSING FROM DISK** (`findings/71-pillar-2026-06-17-mapping.md` lost in same event)
  - v8 plan: **MISSING FROM DISK** (`plans/2026-06-18-v8-dag-stable.md` lost; v9 plan at `plans/2026-06-19-v9-dag-stable.md` is the current working plan and supersedes v8)
  - L5-121 prep: [`findings/2026-06-20-L5-121-monday-refresh-prep.md`](../../../findings/2026-06-20-L5-121-monday-refresh-prep.md)

---

## Context

The 71-pillar framework (ADR-024) is the internal quality bar for the Phenotype
fleet. It scores 9 domains × 71 pillars per repo (0–3 per pillar; 0 = absent, 3 = SOTA).
The first scorecard (`findings/71-pillar-2026-06-17.md`) covered 10 repos. v8 expanded
this to 30 repos (T13) and then to ~100 repos (continuous).

Without a fixed refresh cadence, the scorecard becomes stale within a week of any
fleet change. Stale scores mask regressions and inflate the success criteria of
downstream tracks (T15, T17, T18, T22).

The Factory AI Agent Readiness Model (ADR-026) is a complementary external standard
that runs on a 5-level progression (Functional → Documented → Standardized →
Optimized → Autonomous). It is refreshed on demand via `/readiness-report` slash
command, not on a fixed cadence — the two frameworks answer different questions
(breadth vs depth) on different cadences.

## Decision

**The 71-pillar scorecard is refreshed WEEKLY, every Monday at 09:00 PDT.**

The refresh is owned by the **worklog-schema circle** and runs via a scheduled
GitHub Actions workflow in `KooshaPari/phenotype-org-audits`:

```yaml
# .github/workflows/71-pillar-weekly.yml
name: 71-pillar weekly refresh
on:
  schedule:
    - cron: '0 16 * * 1'  # Mon 09:00 PDT == 16:00 UTC
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python scripts/71-pillar-probe.py --fleet --output findings/71-pillar-$(date +%F).json
      - run: python scripts/71-pillar-render.py --input findings/71-pillar-$(date +%F).json
      - uses: peter-evans/create-pull-request@v5
        with:
          title: "chore(71-pillar): weekly refresh $(date +%F)"
          commit-message: "chore(71-pillar): weekly refresh $(date +%F)"
          branch: 71-pillar-weekly-$(date +%F)
```

### Refresh scope

- **30 active substrate repos** (T13 scope): every repo is probed every week
- **All 71 pillars** are scored (UI pillars 40, 41 are N/A=3 for headless libs)
- **Diff vs prior week** is computed and committed to `findings/71-pillar-YYYY-MM-DD-delta.md`
- **New repos** added to the fleet within the last 7 days are added to the scan list
- **Scoring form:** [`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md) (the surviving 170-line template, merged via PR #37 on 2026-06-19). One copy per repo at `findings/71-pillar-YYYY-MM-DD-<repo>.md`.

### Output artifacts

| Artifact | Location | Owner |
|---|---|---|
| Raw score JSON | `findings/71-pillar-YYYY-MM-DD.json` | worklog-schema circle |
| Rendered scorecard (Markdown) | `findings/71-pillar-YYYY-MM-DD.md` | worklog-schema circle |
| Per-repo scorecard | `findings/71-pillar-YYYY-MM-DD-<repo>.md` (from refresh template) | worklog-schema circle |
| Weekly delta | `findings/71-pillar-YYYY-MM-DD-delta.md` | worklog-schema circle |
| Cron workflow | `phenotype-org-audits/.github/workflows/71-pillar-weekly.yml` | orchestrator |

### Failure modes

- **Workflow fails (transient):** retry once after 1 hour; on second failure, post
  Slack alert to `#phenotype-governance` and skip the week's scorecard. The prior
  week's scorecard remains authoritative.
- **Repo returns 0 pillars scored (untestable):** mark repo as `audit-blocked` in
  the scorecard; do not include in fleet average.
- **New repo appears in fleet:** ad-hoc probe within 24 hours; weekly workflow
  picks it up starting the following Monday.
- **Refresh template not present** (rebuild case): restore from
  `findings/71-pillar-refresh-template.md` (the surviving canonical template);
  do not improvise a new template.

## Consequence

- Scorecard is at most 7 days stale at any point
- Weekly delta makes regressions visible without manual diff
- 71-pillar score is the input to SC-2 (`findings/71-pillar-*.md` with 30×71 cells)
- T13 refresh (v8) was the bootstrap; T0.5.4 (v8 wrap-up) commits the cron workflow
- Subsequent wave plans (v9+) consume the weekly scorecard as their input
- **Re-authorship side effect (this turn, 2026-06-20):** because the wrap-up doc
  and baseline scorecard were lost in the same disk event that wiped this ADR,
  the first weekly cycle (2026-06-22, the next Monday after this re-author) will
  be a *baseline-establishing* cycle rather than a delta cycle. The L5-121 prep
  notes pre-staged the template (`findings/71-pillar-refresh-template.md`) so the
  first cycle can land on schedule even with the lost wrap-up.

## Cross-references

- [ADR-024](ADR-024-71-pillar-audit-framework.md) — 71-pillar framework definition (re-authored in same commit, same disk-loss event)
- ADR-026 (Factory AI Agent Readiness — separate cadence)
- [`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md) — **surviving** schema (L1–L71 definitions)
- [`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md) — **surviving** per-repo scoring template (PR #37, 2026-06-19)
- `findings/71-pillar-2026-06-17.md` — **MISSING FROM DISK** (baseline scorecard; lost in same event)
- `findings/audit-71-pillar-2026-06-17-wrapup.md` — **MISSING FROM DISK** (Factory AI crosswalk § 10; lost in same event)
- `findings/71-pillar-2026-06-17-mapping.md` — **MISSING FROM DISK** (L1–L30 → L1–L71 crosswalk; lost in same event)
- `findings/71-pillar-2026-06-22-Civis.md` — **surviving** example of a per-repo scorecard in the new template form (executed 2026-06-22; preview of the post-re-authorship cadence in action)
- T13.13, T13.14, T13.15, T13.16, T13.17, T13.18 in v8 plan (`plans/2026-06-18-v8-dag-stable.md` — **MISSING FROM DISK**; see v9 plan at `plans/2026-06-19-v9-dag-stable.md`)
- L5-121 prep: [`findings/2026-06-20-L5-121-monday-refresh-prep.md`](../../../findings/2026-06-20-L5-121-monday-refresh-prep.md) — surfaced the disk loss; pre-staged the refresh template

---

**Re-author commit:** on branch `chore/orch-v11-016-tier0-2026-06-20` (the orchestrator's current branch at the time of L5-121, not the `chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20` branch named in the task spec). Local-only commit; push deferred to orchestrator.
