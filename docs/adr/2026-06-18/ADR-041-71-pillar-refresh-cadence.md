# ADR-041 — 71-pillar refresh cadence (weekly, Monday 09:00 PDT)

**Date:** 2026-06-18 (originally authored), 2026-06-20 (re-authored after disk loss — see note below)
**Status:** **ACCEPTED**
**L-level:** L5-110.1
**Disposition:** Codifies the weekly refresh cycle for the 71-pillar audit (ADR-024). Owned by `pheno-worklog-schema` circle.

> **Re-authorship note (2026-06-20, L5-121):** This ADR was lost from disk between 2026-06-19 and 2026-06-20 due to a series of orchestrator-driven branch resets that wiped `docs/adr/2026-06-18/` from the local working tree. The substantive content below is re-authored from the surviving wrap-up doc (`findings/audit-71-pillar-2026-06-17-wrapup.md` §11) and the per-repo refresh template (`findings/71-pillar-refresh-template.md`, merged via PR #37). The original commit was on `main`; that commit object is preserved in the object database but is currently orphaned (no branch ref).

---

## Context

The 71-pillar audit framework (ADR-024) needs to be refreshed regularly to remain useful:

1. **Score drift:** Pillar scores change as PRs land; without regular refresh, the scorecard becomes stale and stops reflecting reality.
2. **PR-to-pillar attribution:** Each PR should be attributable to one or more pillars; the weekly cycle is the natural cadence to update scores based on the previous week's merged PRs.
3. **Cross-repo prioritization:** The wrap-up phase of each cycle identifies cross-repo improvement priorities; weekly cadence keeps priorities fresh.
4. **Per-pillar worklog tasks:** Weekly cadence enables per-pillar worklog entries that don't pile up.

We needed a fixed cadence that is frequent enough to be useful but not so frequent as to become a chore.

## Decision

We adopt a **weekly refresh cadence for the 71-pillar audit**:

- **Day:** Every **Monday**
- **Time:** **09:00 PDT** (Pacific Daylight Time, UTC-7 during DST)
- **Owner:** `pheno-worklog-schema` circle
- **Automation:** Cron job (or scheduled script) drives the cycle. Manual fallback documented in § "Manual cycle" below.

### Cycle phases (each Monday 09:00 PDT)

| Phase | Time | Owner | Output |
|---|---|---|---|
| **1. Snapshot previous scorecard** | 09:00 | script | `findings/71-pillar-{prev-date}.md` |
| **2. Run per-repo scoring** | 09:05-10:00 | per-repo circle lead (or AI assistant) | `findings/71-pillar-{YYYY-MM-DD}.md` (per-repo sections) |
| **3. Generate delta** | 10:00-10:15 | script | `findings/71-pillar-{YYYY-MM-DD}-delta.md` |
| **4. Wrap-up cross-repo analysis** | 10:15-11:00 | audit owner | `findings/audit-71-pillar-{YYYY-MM-DD}-wrapup.md` |
| **5. Push PR with scorecard + delta + wrap-up** | 11:00-11:30 | audit owner | PR opened against `phenotype-apps` or relevant repo |
| **6. Update worklog tasks** | 11:30-12:00 | per-repo circle | Per-pillar worklog tasks opened for top 3 priorities per repo |

Total cycle time: ~3 hours per Monday.

### Inputs to each cycle

1. **Previous scorecard:** `findings/71-pillar-{prev-date}.md`
2. **Per-repo refresh template:** `findings/71-pillar-refresh-template.md` (the 1-page fill-in-the-blank template)
3. **Merged PRs in the previous week:** Used to attribute score changes to PRs.
4. **New worklog tasks:** Each pillar's latest worklog task may drive score changes.
5. **Industry framework updates:** If a referenced framework (e.g., AWS WAF) has released a major update, the schema doc may need revision.

### Outputs of each cycle

1. **New scorecard:** `findings/71-pillar-{YYYY-MM-DD}.md` — per-repo, per-pillar scores with totals per domain and overall.
2. **Delta:** `findings/71-pillar-{YYYY-MM-DD}-delta.md` — per-repo diff against the previous cycle's scorecard.
3. **Wrap-up:** `findings/audit-71-pillar-{YYYY-MM-DD}-wrapup.md` — cross-repo analysis, top improvement priorities, PR/issue link suggestions.
4. **Worklog tasks:** Top 3 improvement priorities per repo become worklog tasks.

### Skip rules

The cycle may be skipped in the following cases (must be documented in the wrap-up):

- **Holiday week:** US federal holiday on Monday → cycle runs Tuesday.
- **No PRs merged:** If no PRs landed in any repo in the previous week, the scorecard is unchanged; only the delta is regenerated (and notes "no changes").
- **Major fleet event:** If the fleet is mid-migration (e.g., 4-repo retirement in progress), the cycle is deferred to the following week and the deferral is documented in `STATUS.md`.

### Manual cycle

If the automation breaks, the manual fallback is:

1. Copy `findings/71-pillar-refresh-template.md` to `findings/71-pillar-{YYYY-MM-DD}.md`.
2. Fill in per-repo scores using the rubric in `findings/71-pillar-2026-06-17-schema.md` §3.
3. Generate delta against the previous scorecard using `diff -u` or a manual comparison.
4. Author the wrap-up following the structure of the previous wrap-up.
5. Open a PR with the scorecard + delta + wrap-up.

The refresh template (`findings/71-pillar-refresh-template.md`) was merged via PR #37 and provides the 1-page fill-in-the-blank format used for manual cycles.

## Consequences

### Positive

- **Fresh scorecards:** Weekly cadence keeps scores current with the latest merged PRs.
- **Cross-repo visibility:** Wrap-up phase surfaces cross-repo patterns (e.g., "5 repos all lack L52 SBOM" → 1 fix + 5 PRs).
- **PR attribution:** Each score change is attributable to a specific PR or worklog task.
- **Predictable workload:** 3-hour Monday cycle is bounded; per-repo leads know what to expect.
- **Per-pillar worklog tasks:** Top 3 priorities per repo become discrete worklog tasks that flow into the next v* plan.

### Negative

- **3-hour weekly commitment:** Per-repo leads + audit owner spend ~3 hours every Monday on the cycle. Mitigated by automation (phases 1, 3 are script-driven) and parallelization (per-repo sections can be scored in parallel).
- **Holiday / OOO handling:** US federal holiday on Monday shifts the cycle to Tuesday; OOO of the audit owner blocks the wrap-up phase. Mitigated by skip rules and a designated backup audit owner.
- **Scoring fatigue:** Scoring 71 pillars × N repos is repetitive. Mitigated by the per-repo refresh template and the 0-3 rubric.

### Neutral

- **Complementary to Factory AI Agent Readiness Model (ADR-026):** The Factory AI Model is a complementary external standard that uses a 5-level gated progression model. Both are tracked weekly; the 71-pillar audit answers "what is the current state?" (breadth), the Factory AI Model answers "what is the next level to unlock?" (depth). See `findings/audit-71-pillar-2026-06-17-wrapup.md` §10 for the crosswalk.

## Alternatives considered

1. **Bi-weekly cadence.** Rejected: too infrequent; scores drift too much between cycles.
2. **Daily cadence.** Rejected: too frequent; scoring fatigue; per-PR attribution is sufficient.
3. **Monthly cadence.** Rejected: scores drift too much; cross-repo patterns become harder to spot.
4. **On-demand (event-driven).** Rejected: no regularity; easy to forget; audit owner accountability suffers.
5. **Weekly Monday 09:00 PDT.** Chosen: bounded workload, predictable cadence, fresh enough to be useful.

## Implementation

The cadence is implemented as:

1. **Automation:** Cron job or scheduled script (TBD; not yet implemented as of this ADR; manual cycles are the fallback).
2. **Per-repo refresh template:** `findings/71-pillar-refresh-template.md` (merged via PR #37 on 2026-06-18).
3. **Cycle outputs location:** `findings/71-pillar-{YYYY-MM-DD}.md`, `findings/71-pillar-{YYYY-MM-DD}-delta.md`, `findings/audit-71-pillar-{YYYY-MM-DD}-wrapup.md`.
4. **PR target:** `phenotype-apps` (the staging repo per ADR-028) for the scorecard + delta + wrap-up; per-repo PRs for individual worklog tasks.

### First cycle

The first 71-pillar audit cycle was 2026-06-17, scoring 10 existing repos. The wrap-up is at `findings/audit-71-pillar-2026-06-17-wrapup.md` (LOST during disk-loss event; will be re-authored in the next pass per L5-121).

### Upcoming cycles

- **2026-06-22 cycle:** First weekly refresh after the 2026-06-17 baseline. Targeted for completion by Monday 12:00 PDT.
- **2026-06-29 cycle:** Second weekly refresh.
- (etc.)

Each cycle's wrap-up identifies the top 3 improvement priorities per repo and opens worklog tasks for them. The worklog tasks feed into the next v* plan as P0/P1 items.

## References

- ADR-024 — 71-pillar industry-standard audit framework (re-authored in this same commit)
- `findings/71-pillar-2026-06-17-schema.md` — schema doc (SURVIVED the disk loss)
- `findings/71-pillar-refresh-template.md` — per-repo refresh template (merged via PR #37)
- `findings/audit-71-pillar-2026-06-17-wrapup.md` — original wrap-up (LOST)
- `findings/2026-06-18-L5-110-substrate-audit.md` — substrate audit context for cadence decisions
- `findings/2026-06-20-L5-121-monday-refresh-prep.md` — disk-loss context (this re-authorship)
- ADR-026 — Factory AI Agent Readiness Model (complementary external standard)
- ADR-041B — Substrate audit cadence (bi-weekly; complementary)
- ADR-042 — Security audit cadence (monthly; complementary)
- ADR-043 — Registry refresh cadence (bi-weekly; complementary)
