# ADR-030: PR template must require 71-pillar score delta

Every PR against a substrate repo must include a 71-pillar score delta in the description so that the audit surface is updated continuously rather than only at quarterly reviews.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-014** (T14.1)

## Context

The 71-pillar audit framework (ADR-024) scores every substrate repo against 71 pillars across 9 domains. Until 2026-06-17 the audit was run quarterly against a static repo state. The problem: between audits, dozens of PRs landed without any visibility into whether the change **moved the score** on any pillar. A PR that introduced OTLP export (L57) might land without anyone noting the L57 score went from 1 → 2. A PR that removed a test suite (L20) might pass CI but regress L20 from 3 → 1. The quarterly cadence caught these only weeks later, by which time the change was entangled in 20+ downstream PRs.

## Decision

**All PRs against substrate repos MUST include a 71-pillar score delta in the description**, formatted as a single fenced block in the PR body:

```markdown
### 71-pillar delta
L<NN>: <prev> → <new> (rationale)
L<NN>: <prev> → <new> (rationale)
```

A PR with no impact on any pillar MUST still include a delta block stating `no-change: all 71 pillars unchanged (rationale: docs only / test-only / chore-only)`. The format is machine-parseable: `pheno-ci-templates/phenocicli-71-pillar-bot` extracts the deltas, writes them to `findings/71-pillar-2026-06-1{8,9}-pr-deltas/<n>.json`, and appends to the rolling per-repo score history.

**CI enforcement:** `phenocicli-71-pillar-bot` runs as a required check on all substrate repos. It fails the PR if:

1. The `### 71-pillar delta` block is missing.
2. The block contains a pillar number outside `L1..L71`.
3. A delta claim contradicts a verifiable artifact (e.g. claims L57: 1→2 but no OTLP-related files are in the diff).

PRs against **non-substrate** repos (app-level, archived, experiments) are exempt — but the bot still emits a soft warning.

## Consequences

*Positive:*
- Every PR is scored, not audited quarterly — the scorecard is always current to within one PR.
- The score history (`findings/71-pillar-*-pr-deltas/`) is a per-PR audit trail; regressions are caught at PR time, not at quarter end.
- The 71-pillar framework becomes a **first-class CI artifact** rather than a separate manual process.

*Negative / Risks:*
- PR authors must learn the L1–L71 numbering; mitigation: `phenocicli-71-pillar-bot --explain L57` produces a 1-line gloss.
- Lying in the delta (claiming a score that is not actually achieved) defeats the audit; mitigation: the bot's #3 check (verifiable artifact) catches obvious cases, and the rolling score history exposes suspicious jumps.
- Substrate repos gain a required CI check that may slow PR throughput by ~30s; mitigation: the bot is a lightweight parser, not a probe runner.

## Refs

- ADR-024 (71-pillar audit framework)
- ADR-026 (Factory AI Agent Readiness — the external depth view that complements 71-pillar)
- `findings/71-pillar-2026-06-17-schema.md` — pillar definitions
- `pheno-ci-templates/phenocicli-71-pillar-bot` — CI validator
- v8 plan § 3.6 Track T14 (ADR backlog)
