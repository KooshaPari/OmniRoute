# ADR-081: v20 Cycle 10 P1 Reduction

**Date:** 2026-06-22
**Status:** ACCEPTED
**Cycle:** 10 (P1 reduction)
**Pillars:** L23, L27, L36, L38, L44

## Context

P0 closure complete (v9..v18, 47/47 pillars at 3.0). v19 was a tooling deepening wave. v20 pivots to **P1 reduction** per the cycle-8 probe's recommendation.

## P1 pillars in scope

5 P1 pillars selected by impact ranking (per `findings/2026-06-21-v18-cycle-8-probe.md`):

1. **L23** (Test-data factories) — `proptest::Arbitrary` impls for 8 critical crates
2. **L27** (Contract tests) — Pact + 2 consumer-driven contract tests
3. **L36** (Chaos engineering depth) — fault injection framework (chaos-injection crate)
4. **L38** (UX research) — fleet N=5 user research synthesis
5. **L44** (Performance deep-dives) — flamegraph-driven optimization

## Decision

Execute all 5 tracks in 1 wave (cycle 10). Each track targeted at moving the pillar from P1 (0.0-2.0) to P0-equivalent (3.0).

## Tracks

| Track | Pillar | Artifact | Effort |
|-------|--------|----------|-------:|
| T1 | L23 | `arbitrary.rs` in 8 critical crates + proptest workflow | 2h |
| T2 | L44 | Flamegraph SVG × 3 (parse_flag, tcp_connect, serde_roundtrip) + workflow | 1h |
| T3 | L36 | `chaos-injection` crate + 3 chaos_injection_test.rs | 3h |
| T4 | L27 | `pact-consumer` crate + 2 MCP contracts + 2 verify.rs | 2h |
| T5 | L38 | Findings doc with N=5 user research synthesis | 2h |

## Consequences

After v20: 5 of 24 P1 pillars closed; cycle-11 plan will target the next 5 P1 pillars (L22 perf benchmark suite, L24 test-coverage gates, L29 release-coordination, L32 sdk-versioning, L34 backward-compat).

Refs: `findings/2026-06-21-v18-cycle-8-probe.md` (P1 ranking)
