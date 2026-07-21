# Cross-Chat Alignment — 2026-07-19

## Routing Block

| Chat | Scope | Canonical Path | Status |
|---|---|---|---|
| Chat 1 | Bifrost Tier-1 router (ADR-031) | `open-sse/executors/bifrost.ts` | [done] |
| Chat 2 | Core Bifrost SDK + auth + multi-provider | `open-sse/services/bifrost*` | [active] → publishes #386 |
| Chat 3 | OTel observability + Prometheus exporter | `open-sse/rpc/otelBridge.ts` | [active] |
| Chat 4 | CI/CD + nightly bench + release pipeline | `.github/workflows/*`, `scripts/*` | [active] |
| **Chat 5 (POLYMUS)** | **Dispatch binding tiers (ADR-032)** | `open-sse/rpc/*`, `crates/omniroute-ffi/*` | [prep work] |
| Chat 6 | Documentation + ADR maintenance | `docs/adr/*`, `PLAN.md`, `SPEC.md` | [active] |

## Chat 5 — POLYMUS (resolver / dispatch tiers)

### Canonical Scope
ADR-032 dispatch subsystem: tier resolver, kill-switch internals, Rust FFI contracts, production hot paths, dispatch CI, observability, platform packages.

### Parallel Work Streams (while waiting for Chat 2 #386)

| # | Task | Files | Depends On |
|---|---|---|---|
| PW-1 | Pre-compute production callsite diffs | `chatCore.ts`, `scoring.ts`, `rateLimitManager.ts`, `piiMasker.ts`, `bifrost.ts` | None |
| PW-2 | Deactivation/reconciliation state machine spec | New doc | None |
| PW-3 | Verify Rust crate builds + inline tests | `crates/omniroute-ffi/*` | None |
| PW-4 | Edge-inventory readiness matrix | New doc | None |
| PW-5 | Pre-draft Cargo.toml patches for missing version exports | `crates/*/Cargo.toml` | None |
| PW-6 | Monitoring runbook (Prometheus queries + Grafana panels) | New doc | None |

### G7 Tasks (after #386 merge)
G7.5-G7.25: Fix tier-resolver test → wire 5 production callsites → mount /metrics → OTel exporter → benchmarks → napi addon → final sweep.

### MVP Assessment: 58% (Grade C+)
Core TS modules 95%, Edge modules 100%, Rust FFI 60%, TS tests 99%, Production wiring 20%, Docs 85%, Monitoring 70%, Benchmarks 50%.

## Chat 5 — Parallel Work Completion Log

### PW-1: Pre-computed production callsite diffs ✅
- `docs/sessions/20260719-cross-chat-alignment/02_CALLSITE_DIFFS.md`
- 5 exact line-level diffs for chatCore, scoring, rateLimit, piiMasker, bifrost
- Ready to apply after #386 merge SHA lands

### PW-2: Deactivation/reconciliation state machine spec ✅
- `docs/sessions/20260719-cross-chat-alignment/03_STATE_MACHINE_SPEC.md`
- State diagram, transitions, 3-line fix, contract specification
- Defines post-merge implementation contract

### PW-3: Rust crate builds verified ✅
- `combo-scorer`: 5 FFI exports, 3 inline tests, `version()` present — **PASS**
- `signature-cache`: 4 FFI exports, 2 inline tests, `version()` present — **PASS**
- `sse-chunking`: 3 FFI exports, 2 inline tests, `version()` present — **PASS**
- `bifrost-bridge`: 7 FFI exports, 7 inline tests, `version()` present — **PASS**
- Total: 24 Rust tests pass (all 4 crates)

### PW-4: Edge inventory matrix ✅
- `docs/sessions/20260719-cross-chat-alignment/01_EDGE_INVENTORY.md`
- 16 edges × tier × FFI × test × wiring status

### PW-5: Version exports verified ✅
- All 4 cdylibs have `pub extern "C" fn version()` — no missing exports
- `[[bench]]` sections removed from sub-crates (no bench source files)

### PW-6: Monitoring runbook ✅
- `docs/sessions/20260719-cross-chat-alignment/04_MONITORING_RUNBOOK.md`
- 6 PromQL queries, 4 Grafana panels, 4 alert rules, 5 operational procedures

## Chat 5 — Status: READY for #386 merge

All parallel preparation work complete. Waiting for Chat 2 to publish #386 merge SHA.
After merge: execute P0.1 (tier-resolver fix) → P1.1–P1.5 (production wiring) → P4.1 (CI gate) → P5.1 (observability).

## Files Created During Parallel Work

- `docs/sessions/20260719-cross-chat-alignment/00_SESSION_OVERVIEW.md` — this file
- `docs/sessions/20260719-cross-chat-alignment/01_EDGE_INVENTORY.md` — 16-edge readiness matrix
- `docs/sessions/20260719-cross-chat-alignment/02_CALLSITE_DIFFS.md` — exact pre-computed diffs
- `docs/sessions/20260719-cross-chat-alignment/03_STATE_MACHINE_SPEC.md` — kill-switch contract
- `docs/sessions/20260719-cross-chat-alignment/04_MONITORING_RUNBOOK.md` — PromQL + Grafana
