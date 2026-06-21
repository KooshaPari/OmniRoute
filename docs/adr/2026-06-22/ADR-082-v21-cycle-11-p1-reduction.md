# ADR-082: v21 Cycle 11 P1 Reduction

**Date:** 2026-06-22
**Status:** ACCEPTED
**Cycle:** 11 (P1 reduction round 2)
**Pillars:** L22, L24, L29, L32, L34

## Context

P0 closure complete (v9..v18, 47/47 pillars at 3.0). v19 was tooling deepening. v20 closed 5 P1 pillars (L23, L27, L36, L38-partial, L44). v21 targets the next 5 P1 pillars per `ADR-081` ranking.

## Decision

5 P1 tracks in 1 wave (cycle 11):

| Track | Pillar | Artifact | Effort |
|-------|--------|----------|-------:|
| T1 | L22 | `benchmarks/perf-benchmarks.toml` (fleet-wide perf suite) | 2h |
| T2 | L24 | `.github/workflows/coverage-gate.yml` (80% lib / 70% framework / 60% service gate) | 1h |
| T3 | L29 | `scripts/release_coord.py` (cross-repo release coordinator) | 2h |
| T4 | L32 | `docs/sdk-versioning.md` (SemVer 2.0 + deprecation policy) | 1h |
| T5 | L34 | `docs/backward-compat-policy.md` (API compat window + deprecation timeline) | 1h |

## Consequences

After v21: 10 of 24 P1 pillars closed; cycle-12 plan will target the next 5 P1 pillars (L25 metrics, L26 tracing-quality, L31 release-cadence, L33 hot-reload, L35 build-perf).

## Acceptance criteria

- [x] 5 track plans + effort estimates
- [x] P1 ranking from ADR-081 honored
- [x] Cycle 11 closure probe in scope
- [x] v22 plan stub referenced

Refs: `docs/adr/2026-06-22/ADR-081-v20-cycle-10-p1-reduction.md`
