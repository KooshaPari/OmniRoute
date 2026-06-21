# ADR-041: 71-pillar refresh cadence (weekly Monday 09:00 PDT)

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7) — v8 batch T14.4
**L8-007** (v8 track T13)
**Refs:**
- ADR-024 (71-pillar audit framework)
- ADR-026 (Factory AI Agent Readiness Model)
- `findings/71-pillar-2026-06-17-schema.md` (schema)
- `findings/71-pillar-2026-06-17.md` (baseline scorecard)
- `plans/2026-06-18-v8-dag-stable.md` § 3.5 (T13)

---

## Context

The 71-pillar framework (ADR-024) is the internal quality bar for the Phenotype
fleet. It scores 9 domains × 71 pillars per repo (0–3 per pillar; 0 = absent, 3 = SOTA).
The first scorecard (`findings/71-pillar-2026-06-17.md`) covered 10 repos. v8 expands
this to 30 repos (T13) and then to ~100 repos (continuous).

Without a fixed refresh cadence, the scorecard becomes stale within a week of any
fleet change. Stale scores mask regressions and inflate the success criteria of
downstream tracks (T15, T17, T18, T22).

The Factory AI Agent Readiness Model (ADR-026) is a complementary external standard
that runs on a 5-level progression (Functional → Documented → Standardized →
Optimized → Autonomous). It is refreshed on demand via `/readiness-report` slash
command, not on a fixed cadence.

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

### Output artifacts

| Artifact | Location | Owner |
|---|---|---|
| Raw score JSON | `findings/71-pillar-YYYY-MM-DD.json` | worklog-schema circle |
| Rendered scorecard (Markdown) | `findings/71-pillar-YYYY-MM-DD.md` | worklog-schema circle |
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

## Consequence

- Scorecard is at most 7 days stale at any point
- Weekly delta makes regressions visible without manual diff
- 71-pillar score is the input to SC-2 (`findings/71-pillar-*.md` with 30×71 cells)
- T13 refresh (v8) is the bootstrap; T0.5.4 (v8 wrap-up) commits the cron workflow
- Subsequent wave plans (v9+) consume the weekly scorecard as their input

## Cross-references

- ADR-024 (71-pillar framework definition)
- ADR-026 (Factory AI Agent Readiness — separate cadence)
- `findings/71-pillar-2026-06-17-schema.md` (L1-L71 definitions)
- `findings/71-pillar-2026-06-17-mapping.md` (L1-L30 → L1-L71 crosswalk)
- `findings/audit-71-pillar-2026-06-17-wrapup.md` § 10 (Factory AI crosswalk)
- T13.13, T13.14, T13.15, T13.16, T13.17, T13.18 in v8 plan
