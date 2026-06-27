# 71-Pillar Cycle 17 Probe — v27 Planning

**Date:** 2026-06-24 | **Source:** `findings/2026-06-24-v26-closure.md`

## Current Pillar State

| Domain | Score | P0 Remaining | Notes |
|---|---|---|---|
| **Architecture (L1-L12)** | 2.8 | — | C4 diagrams, REST spec, chaos CI all ≥2.5 |
| **Performance (L13-L19)** | 2.3 | L17 latency-budget-to-CI, L19 fleet-wide perf | 2 P0 remain |
| **Quality (L20-L27)** | 2.4 | L23+ at-scale proptest, L25 OTel exemplars, L27 contract test schema | 3 P0 remain |
| **DX (L28-L37)** | 2.5 | L30 reproducible builds, L36 chaos-CI gate, L38 ADR index auto-refresh | 3 P0 remain |
| **Security (L46-L55)** | 2.6 | L52 mTLS fleet | 1 P0 remain |
| **Observability (L56-L63)** | 2.7 | — | All ≥2.5 |
| **Docs/SSOT (L64-L68)** | 2.5 | L60 LFS audit policy | 1 P0 remain |

## 10 Remaining P0 (priority order)

| Priority | Pillar | Current | Target | Why P0 |
|---|---|---|---|---|
| **P0-1** | L17 latency-budget-to-CI | 2.0 | 2.5 | Blocks perf SLAs for prod |
| **P0-2** | L52 mTLS fleet | 2.0 | 2.5 | Security audit requirement |
| **P0-3** | L60 LFS audit policy | 2.0 | 2.5 | Compliance gate for binary repos |
| **P0-4** | L19 fleet-wide perf gates | 2.0 | 2.5 | Extends T2 to all crates |
| **P0-5** | L23+ at-scale proptest | 2.0 | 2.5 | Proptest for all 16 pheno-* crates |
| **P0-6** | L25 OTel exemplars | 2.0 | 2.5 | W3C trace context in metrics |
| **P0-7** | L27 contract test schema | 2.0 | 2.5 | Pact + OpenAPI contract |
| **P0-8** | L30 reproducible builds | 2.0 | 2.5 | Nix + flake.lock for all crates |
| **P0-9** | L36 chaos-CI gate | 2.0 | 2.5 | Scheduled chaos runs on CI |
| **P0-10** | L38 ADR index auto-refresh | 2.0 | 2.5 | ADR lint → auto-update INDEX.md |

## v27 Target

5 tracks (3 Wave A parallel + 2 Wave B sequential), targeting 5 of 10 P0:

| Wave | Track | Pillar | Effort | Deps |
|---|---|---|---|---|
| A | T1 | L17 latency-budget-to-CI | 4h | Per-crate `perf-gate.yml` from T2 v24 |
| A | T2 | L52 mTLS fleet | 3h | Benchmarking infra from T2 v25 |
| A | T3 | L60 LFS audit policy | 2h | Audit script + CI gate |
| B | T4 | L19 fleet-wide perf gates | 2h | T1 must land first |
| B | T5 | v27 closure + cycle-18 probe | 1h | T1-T4 must land |

**Target: 10 → 5 P0 remaining; fleet mean 3.12 → 3.18**
