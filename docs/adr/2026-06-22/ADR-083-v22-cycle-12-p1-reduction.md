# ADR-083: v22 Cycle 12 P1 Reduction

**Date:** 2026-06-22
**Status:** ACCEPTED
**Cycle:** 12 (P1 reduction round 3)
**Pillars:** L25, L26, L31, L33, L35

## Context

v9..v18 closed all 47 P0 pillars (100% saturated). v19 tooling deepening. v20 closed 5 P1 pillars (L23, L27, L36, L44, L38-partial). v21 closed 5 more (L22, L24, L29, L32, L34). v22 targets the next 5 P1 pillars per `ADR-081` ranking.

## Decision

5 P1 tracks in 1 wave (cycle 12):

| Track | Pillar | Artifact | Effort |
|-------|--------|----------|-------:|
| T1 | L25 | `pheno-otel/src/metrics.rs` — fleet-wide OTLP metrics facade | 3h |
| T2 | L26 | `pheno-tracing/src/sampling.rs` — sampling policies + cardinality cap | 2h |
| T3 | L31 | `docs/release-train.md` + `release-train-calendar.json` — 6-week release train | 1h |
| T4 | L33 | `pheno-config/src/hot_reload.rs` — SIGHUP-based config + secret rotation | 2h |
| T5 | L35 | `.cargo/config.toml` (thin-LTO + sccache) + `scripts/build-perf.sh` | 2h |
| SIDE | L38-L45 | 7 supporting findings (L38-builder, L39-fromstr, L40-display, L41-error, L42-macro, L43-iter, L45-diagnostic) | 3h |

## Consequences

After v22: 15 of 24 P1 pillars closed; cycle 13 (v23) will target the remaining 9 (L26/L31 partially, L33, L35, L36-complete, L37, L39-L46).

## Acceptance criteria

- [x] 5 P1 tracks scoped
- [x] SIDE bundle of 7 L38-L45 findings
- [x] v23 plan stub references
- [x] Cycle 12 probe in scope

Refs: `docs/adr/2026-06-22/ADR-081-v20-cycle-10-p1-reduction.md`
