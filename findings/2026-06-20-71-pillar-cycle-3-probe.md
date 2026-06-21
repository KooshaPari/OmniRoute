# 71-Pillar Cycle 3 Probe — 2026-06-20

**Scope:** v13 closed 9/26 P0 pillars. This probe identifies the 8 highest-ROI tracks for v14.
**Author:** cycle 3 re-probe (per ADR-041 weekly cadence).

## Cycle 1 → Cycle 2 → Cycle 3 Pillar Score Progression

| Domain | Cycle 1 (47 P0) | Cycle 2 (26 P0) | Cycle 3 (target) |
|---|---|---|---|
| Architecture (L1-L12) | 1.7 | 2.4 | 2.6 |
| Performance (L13-L19) | 1.5 | 1.8 | 2.2 |
| Quality (L20-L27) | 1.5 | 2.3 | 2.4 |
| DX (L28-L37) | 1.8 | 2.7 | 2.8 |
| Security (L46-L55) | 1.7 | 2.7 | 2.8 |
| Observability (L56-L63) | 2.0 | 2.7 | 2.7 |
| Docs/SSOT (L64-L68) | 1.5 | 2.0 | 2.3 |
| **Fleet mean** | **1.7** | **2.6** | **2.7** |

## Top 8 P0 Pillars for v14

| # | Pillar | P0 Track | Pillar gap | Effort | Wave |
|---|---|---|---|---|---|
| **T1** | L3 (deps graph) | Add `cargo-deps` SVG to all 11 fleet crates | 1→3 | 1h | A (parallel) |
| **T2** | L4 (module deps) | Add `cargo-modules` linter to CI | 1→3 | 30m | A |
| **T3** | L18 (perf budget) | Document per-route p99 budgets in 3 critical crates | 2→3 | 1h | A |
| **T4** | L22 (mut test) | Add `cargo-mutants` to 2 critical crates | 1→3 | 1.5h | A |
| **T5** | L25 (concurrency) | Add `loom` to tokio-using crates | 1→3 | 1h | A |
| **T6** | L34 (dev loop time) | Add `cargo nextest` + 3-min CI target | 2→3 | 1h | A |
| **T7** | L62 (error rate) | Add OTel error-rate metric to all crates | 2→3 | 1h | A |
| **T8** | L68 (rustdoc) | Add `#![deny(missing_docs)]` to 8 lib crates | 1→3 | 30m | A (parallel) |

## Cycle 3 P0 Distribution (after v13)

- **L1-L12 (Architecture)**: 8 P0 (L3 deps, L4 module deps, L6 cycles, L7 fan-in, L8 fan-out, L9 SOTA, L10 OCP, L11.3 24h-soak)
- **L13-L19 (Performance)**: 4 P0 (L15 baseline, L18 budget, L19 regression)
- **L20-L27 (Quality)**: 5 P0 (L21 property, L22 mut, L23 doc, L25 concurrency, L27 saturation)
- **L28-L37 (DX)**: 4 P0 (L33 release, L34 dev-loop, L35 examples, L37 editor)
- **L46-L55 (Security)**: 3 P0 (L48 SBOM, L49 vuln-response, L50 key-rotation)
- **L56-L63 (Observability)**: 2 P0 (L60 histograms, L62 error-rate)

**Total v14 targets**: 26 → ~18 P0 closed

## v14 Wave Plan

- **Wave A** (8 parallel): T1-T8 — pure P0 closure, no inter-deps. 1.5h wall.
- **Wave B** (none required): all v14 P0 tracks are independent.
- **Wave C** (sequential): cycle 4 probe + v15 plan. 1h.

## Process Notes

- Per ADR-041, this probe runs every Monday 09:00 PDT. Cycle 4 will be 2026-06-27.
- Per ADR-042B, the "substrate quality bar" requires ≥2.5 mean for the 4 fleet-critical substrates (config, tracing, MCP-router, observability). Cycle 2 already at 2.6.
- Per ADR-048, substrate graduation path: 4-tier gate table; v14 closures don't add new substrates, only raise existing ones.

Refs: ADR-024 (audit framework), ADR-041 (cadence), ADR-048 (graduation)