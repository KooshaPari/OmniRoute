# ADR-026: Factory AI Agent Readiness Model as cross-cutting external standard

**Status:** Accepted 2026-06-17 · **Deciders:** Phenotype governance circle
**External source:** [Factory AI Agent Readiness Overview](https://docs.factory.ai/web/agent-readiness/overview)
**Supersedes:** ad-hoc "are our agents good enough?" judgment calls; the Factory model is the **only** external depth view that complements the 71-pillar (ADR-024) breadth view.
**Effective:** 2026-06-17; first manual crosswalk rendered in `audit-71-pillar-2026-06-17-wrapup.md` § 10.

## Context

The 71-pillar (ADR-024) measures **breadth** across 9 domains (71 pillars). The Factory AI Agent Readiness Model is an industry-standard **5-level gated progression** (Functional → Documented → Standardized → Optimized → Autonomous) that measures **depth**: 80% of criteria in level *N* must pass to unlock *N+1*.

Both are required: the 71-pillar answers *"what is the current state across the fleet?"*, the Factory AI Model answers *"what level are we at and what unlocks the next one?"*. Each repo gets a level (1–5) and an org-level rollup (`floor(average of repo levels)`).

## Decision

**Adopt the Factory AI Agent Readiness Model as the cross-cutting external standard.** Pair it with the 71-pillar:

| Concern | 71-pillar (internal, ADR-024) | Factory AI (external, this ADR) |
|---|---|---|
| Scoring | 0–3 per pillar, 71 pillars total | 5 levels, 80% gate per level |
| Cadence | weekly (Monday 09:00 PDT) | on-demand via `/readiness-report` |
| Output | `findings/71-pillar-{date}.md` | level + per-criterion rationale + 2–3 action items |
| Use case | breadth view (what is the state?) | depth view (what unlocks the next level?) |
| Owner | worklog-schema circle | Droid CLI / Factory App |

**Per-repo scoring (manual estimate 2026-06-17):** AgilePlus = L2 (1.78/3), pheno = L2 (1.89/3), dispatch-mcp = L1 (0.89/3), phenotype-ops = L1 (1.11/3). **Org level = `floor((2+2+1+1)/4)` = 1 (Functional).** The blocker for org L2 is dispatch-mcp (no AGENTS.md yet).

**Integration:** Run `/readiness-report` weekly (post the 71-pillar refresh). The Factory AI report's top-3 action items become the **P0** tasks in the next v7+ plan.

**The 9 Factory pillars ↔ 71-pillar crosswalk** lives at `audit-71-pillar-2026-06-17-wrapup.md` § 10.3.

## Consequences

*Positive:*
- Industry-standard alignment enables external benchmarking (Factory publishes a public leaderboard).
- The 5-level progression gives a clear, sequential improvement plan (vs the 71-pillar's parallel scoring).
- The crosswalk anchors 71-pillar rows to Factory pillars, making both views auditable.

*Negative:*
- The Factory model evolves; we must re-crosswalk on Factory major releases.
- The manual per-repo scoring is only a snapshot; authoritative scoring requires `/readiness-report` from Droid CLI.

*Mitigation:*
- The crosswalk is in the wrap-up audit, not in code, so updates are 1-line edits.
- The 80% gate is published; we never claim a level without evidence.

## Alternatives considered

- **Use only the 71-pillar.** Rejected: lacks the *progression depth* view; we cannot answer "what's next?".
- **Use only the Factory model.** Rejected: 5 levels are too coarse; we lose the fine-grained 71-pillar diagnostics.
- **Adopt a different external model (e.g. SLSA, OWASP SAMM).** Rejected: those are security-supply-chain focused; Factory AI is the only model that scores *agent* readiness specifically.

## References

- [Factory AI Agent Readiness Overview](https://docs.factory.ai/web/agent-readiness/overview) — canonical external standard.
- `audit-71-pillar-2026-06-17-wrapup.md` § 10 — full crosswalk + per-repo scoring.
- ADR-024 (71-pillar framework) — internal breadth view.
