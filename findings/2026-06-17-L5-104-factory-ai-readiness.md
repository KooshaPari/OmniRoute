# Finding — Factory AI Agent Readiness Model (cross-cutting external standard) (L5-104)

**Date:** 2026-06-17
**Task:** L5-104 (this finding — note: the L5-104 ID is also used by the 2026-06-17 Dmouse92→KooshaPari migration track; the two are unrelated and the ID collision is preserved intentionally for traceability)
**ADR:** ADR-026
**Worklog:** `worklogs/L5-104-factory-ai-readiness-2026-06-17.json`
**External source:** [Factory AI Agent Readiness Overview](https://docs.factory.ai/web/agent-readiness/overview)

## Headline

The Phenotype fleet adopts the **Factory AI Agent Readiness Model** as the cross-cutting external standard for measuring agent-readiness progression. The model is a 5-level gated progression (Functional → Documented → Standardized → Optimized → Autonomous) with 9 technical pillars and an 80% gate per level. It pairs with the 71-pillar (ADR-024, internal breadth view) to give the fleet a *depth* view alongside the 71-pillar's *breadth* view.

## Why

- The 71-pillar (ADR-024) measures **breadth** across 9 domains. The Factory AI Model measures **depth**: 80% of criteria in level *N* must pass to unlock level *N+1*.
- Both are required: the 71-pillar answers *"what is the current state across the fleet?"*, the Factory AI Model answers *"what level are we at and what unlocks the next one?"*.
- Each repo gets a level (1–5) and an org-level rollup: **`floor(average of all repo levels)`**.
- Industry-standard alignment enables external benchmarking (Factory publishes a public leaderboard; the criteria are auditable).

## The 5 levels

| Level | Name | What it unlocks | Typical criteria |
|---|---|---|---|
| 1 | **Functional** | Code runs; basic tooling in place | README, linter, type checker, unit tests |
| 2 | **Documented** | Process and documentation established | AGENTS.md, devcontainer, pre-commit hooks, branch protection |
| 3 | **Standardized** | Security and observability configured | Integration tests, secret scanning, distributed tracing, metrics |
| 4 | **Optimized** | Fast feedback and continuous measurement | Fast CI feedback, regular deployment frequency, flaky test detection |
| 5 | **Autonomous** | Self-improving systems | Auto-remediation, auto-scaling, complex requirement decomposition |

**Scoring rule:** 80% of criteria in level *N* must pass to unlock level *N+1*. Org-level score = `floor(average of all repo levels)`. Monorepos evaluate criteria at **per-application scope** (e.g., `3/4` = 3 of 4 sub-apps pass).

## The 9 technical pillars

1. Style & Validation · 2. Build System · 3. Testing · 4. Documentation · 5. Development Environment · 6. Debugging & Observability · 7. Security · 8. Task Discovery · 9. Product & Experimentation.

Full per-pillar criteria and the 9 ↔ 71-pillar crosswalk live at `audit-71-pillar-2026-06-17-wrapup.md` § 10.1–10.3.

## Per-repo scoring (manual estimate, 2026-06-17)

| Repo | Level | Pillar avg | Top gap | Next-level unlock |
|---|---|---|---|---|
| **AgilePlus** | 2 (Documented) | 1.78/3 (59%) | Security: no secret scanning in CI | Add secret scanning → L3 |
| **pheno** | 2 (Documented) | 1.89/3 (63%) | Observability: tracing exists but not wired to all sub-apps | Wire pheno-tracing to all sub-apps → L3 |
| **dispatch-mcp** | 1 (Functional) | 0.89/3 (30%) | Documentation: no AGENTS.md yet | Add AGENTS.md + pre-commit → L2 |
| **phenotype-ops** | 1 (Functional) | 1.11/3 (37%) | Dev Env: no devcontainer | Add AGENTS.md + devcontainer → L2 |

**Org-level score:** `floor((2+2+1+1)/4)` = **Level 1 (Functional)**. To reach org Level 2, all 4 repos must reach Level 2 (3 of 4 currently are; **dispatch-mcp is the blocker**).

## Integration with 71-pillar

| Concern | 71-pillar (internal, ADR-024) | Factory AI (external, this ADR) |
|---|---|---|
| Scoring | 0–3 per pillar, 71 pillars total | 5 levels, 80% gate per level |
| Cadence | weekly (Monday 09:00 PDT) | on-demand via `/readiness-report` |
| Output | `findings/71-pillar-{date}.md` | level + per-criterion rationale + 2–3 action items |
| Use case | breadth view (what is the state?) | depth view (what unlocks the next level?) |
| Owner | worklog-schema circle | Droid CLI / Factory App |

Run `/readiness-report` weekly (post the 71-pillar refresh). The Factory AI report's top-3 action items become the **P0** tasks in the next v7+ plan.

## Implementation

- **ADR-026 written:** `docs/adr/2026-06-17/ADR-026-factory-ai-agent-readiness.md` (57 lines).
- **AGENTS.md updated:** new "2026-06-17 wave" table row referencing ADR-026 + L5-104 + Factory AI doc URL; crosswalk reference in `audit-71-pillar-2026-06-17-wrapup.md` § 10.
- **Crosswalk rendered:** `audit-71-pillar-2026-06-17-wrapup.md` § 10.3 (9 rows, 1 per Factory pillar → 71-pillar domains).
- **Per-repo scoring table:** § 10.8 (4 repos, manual snapshot).

## Verification

- `findings/2026-06-17-L5-104-factory-ai-readiness.md` is on disk.
- `worklogs/L5-104-factory-ai-readiness-2026-06-17.json` is on disk and parses as valid JSON.
- ADR-026 file is well-formed (Nygard: Context / Decision / Consequences / Alternatives / References).
- The crosswalk at `audit-71-pillar-2026-06-17-wrapup.md` § 10.3 covers all 9 Factory pillars.

## Follow-ups

- **Droid CLI /readiness-report integration:** evaluate the Droid CLI for autorun of `/readiness-report` in CI (per Factory roadmap, `/readiness-fix` is "Coming Soon" — until then, the top-3 action items feed the next v7+ plan manually).
- **Re-crosswalk on Factory major releases:** the Factory model evolves; we must re-crosswalk on Factory major releases (1-line edit to `audit-71-pillar-{date}.md` § 10.3).
- **dispatch-mcp blocker:** add `AGENTS.md` to dispatch-mcp to unlock org L2; tracked as a P0 task in v7+ plan.
- **Org L2 target date:** 2026-07-15 (4 weeks); tracked in the next v7+ plan's milestones.
