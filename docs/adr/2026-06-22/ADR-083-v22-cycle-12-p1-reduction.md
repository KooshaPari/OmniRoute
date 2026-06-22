# ADR-083: v22 Cycle 12 P1 Reduction (Round 3)

**Date:** 2026-06-22
**Status:** ACCEPTED
**Cycle:** 12 (P1 reduction round 3)
**Pillars:** L25, L26, L31, L33, L35 (5 P1) + L38-L41, L45 (SIDE 5 P1) = 10 total

## Context

Cumulative v9..v21 closed 47 P0 + 10 P1 = 57 of 71 pillars. v22 targets the next 10 P1 pillars per `ADR-082` ranking continuation.

## Decision

10 P1 tracks in 1 wave (cycle 12):

| Track | Pillar | Artifact | Effort |
|-------|--------|----------|-------:|
| T1 | L25 | `pheno-otel/src/metrics.rs` (OTLP metrics facade) | 3h |
| T2 | L26 | `pheno-tracing/src/sampling.rs` (sampling policies) | 2h |
| T3 | L31 | `docs/release-train.md` + `docs/release-train-calendar.json` | 1h |
| T4 | L33 | `pheno-config/src/hot_reload.rs` (SIGHUP handler) | 2h |
| T5 | L35 | `.cargo/config.toml` (sccache + thin-LTO) + `scripts/build-perf.sh` | 2h |
| SIDE-A | L38 | i18n en+es+ja locale files (3 crates) | 1h |
| SIDE-B | L39 | LLM-cost-capping guard per tenant | 1h |
| SIDE-C | L40 | stakeholder-traction dashboard | 1h |
| SIDE-D | L41 | weekly CTO note template | 1h |
| SIDE-E | L45 | user-skill-routing matrix | 1h |

## Consequences

After v22: 20 of 24 P1 pillars closed; cycle-13 plan will close the final 4 (L25 metrics-depth, L31 release-cadence, L38 user-research, L44 perf-bench-suite).

## Acceptance criteria

- [x] 10 P1 tracks selected per ADR-082 ranking
- [x] Cycle 12 closure probe in scope
- [x] v23 plan stub referenced
- [x] Side bundle (L38-L41, L45) for breadth

Refs: `docs/adr/2026-06-22/ADR-082-v21-cycle-11-p1-reduction.md`
## Cross-references

- ADR-082 (v21 cycle-11 P1 reduction (predecessor — sets the ranking continuation))
- ADR-081 (v21 cycle-11 P1 reduction plan (companion cycle-11 planning ADR))
- ADR-091 (v21 cycle-11 P1 reduction scope (companion planning ADR))
- ADR-041 (71-pillar refresh cadence (weekly closure-probe cadence))
- ADR-024 (71-pillar audit framework (P1 pillar ranking source))

