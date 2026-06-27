# ADR-092: v24 Cycle 14 P1 Reduction (Scope)

- **Status**: ACCEPTED
- **Date**: 2026-06-22
- **Deciders**: orchestrator (KooshaPari)
- **Cycle**: 14 (71-pillar cycle 14, P1 reduction round 5)
- **Wave**: v24
- **Branch**: `chore/v24-71-pillar-cycle-14-p1-2026-06-22`
- **Refs**: `docs/adr/2026-06-22/ADR-081-v21-cycle-11-p1-reduction.md` (ranking), `docs/adr/2026-06-22/ADR-083-v22-cycle-12-p1-reduction.md` (prior cycle), `docs/adr/2026-06-22/ADR-091-v21-cycle-11-p1-reduction.md` (predecessor), `plans/2026-06-22-v24-71-pillar-cycle-14-p1.md` (plan)

## Context

v9 (2026-06-18) closed all 47 P0 pillars (terminal). v20-v23 closed 20 P1 pillars across 4 cycles (L23/L27/L36/L44/L38-partial, L22/L24/L29/L32/L34, L25/L26/L31/L33/L35, L36/L37/L40/L41/L42). Per `findings/2026-06-21-71-pillar-cycle-13-probe.md`, 13 plateaus remain at 2.5/3.0; 5 of them are lifted by v22/v23 (L33, L36/37, L42, L45, L48, L65/L38-bound). The 8 plateaus not addressed by v22/v23 are: L5 C4 dep map, L14 latency p99, L17 cache invalidation, L18 connection pool, L50 vault migration, L59 OTel collector HA, L63 SLO burn rate alerts, L38 docs/INDEX.md.

## Decision

Dispatch 5 parallel subagents in `orch-v24-T{1..5}-L{nn}-{slug}` mode, lifting 5 of 8 remaining plateaus to 3.0:

| Track | Pillar | Target | Subagent | Score Δ |
|-------|--------|--------|----------|--------:|
| T1 | L5 C4 dep map | 3 DOT diagrams + drift detector hook | orch-v24-T1-L5-c4 | 1 → 3 |
| T2 | L14 latency p99 | Grafana dashboard + runbook | orch-v24-T2-L14-p99 | 1 → 3 |
| T3 | L17+L18 cache+pool | bench + per-crate config PRs (paired) | orch-v24-T3-L17-L18 | 1 → 3 |
| T4 | L50 vault migration | 3 PRs (client → parallel → cutover) | orch-v24-T4-L50-vault | 0 → 2 |
| T5 | L63 SLO burn rate | 4 multi-window alerts + on-call runbook | orch-v24-T5-L63-slo | 1 → 3 |

**Deferred to v25+**: L59 OTel collector HA (depends on T4 L50 vault), L38 docs/INDEX.md (cosmetic).

Each agent:
1. Reads the corresponding v15/v17/v19 finding + cycle-13 probe for context
2. Implements the gate / dashboard / automation in a target crate
3. Adds 1 proptest or 1 criterion bench or 1 doc-test for coverage
4. Commits + pushes + opens PR to `argis`
5. Updates the corresponding finding with closure status

## Consequences

After v24: ~25 of 24 P1 pillars closed (L50 partial at 2/3, L59 deferred, L38 deferred). Cycle 15 (v25) will target the 3 remaining (L38, L50-deepening, L59) + 1 P2 (cache invalidation partial deepening).

**P0 stays at 0.** Fleet mean projected: 3.10 → 3.18 (+0.08 absolute).

## Acceptance criteria

- [x] 5 P1 pillars selected per ADR-081 ranking
- [x] Tracks scoped + effort estimated + risk + mitigation per ADR-042
- [x] 4-week critical path sequenced (macbook/heavy-runner split per ADR-023)
- [x] Cycle 14 probe in scope
- [x] v25 plan stub referenced (L38, L50-deepening, L59 + 1 P2)
- [x] Worklog v2.1 schema (ADR-015 v2.1) with `device:` field

Refs: `docs/adr/2026-06-22/ADR-081-v21-cycle-11-p1-reduction.md`, `ADR-083`, `ADR-091`, `findings/2026-06-21-71-pillar-cycle-13-probe.md`
