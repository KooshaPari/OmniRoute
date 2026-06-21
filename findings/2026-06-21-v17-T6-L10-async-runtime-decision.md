# v17 — T6 L10 Async Runtime Decision ADR

**Date:** 2026-06-21
**Cycle:** 7
**Pillar:** L10 (Async Runtime Decision)
**Wave:** B

## Purpose

L10 (Async Runtime Decision) is at 0.00. The fleet has both
`tokio` and `async-std` in use across crates, with no documented
decision on which to use and when.

## ADR-XXX — Async Runtime Selection

**Status:** DRAFTING → ACCEPT 2026-06-22 (target)

### Context

The fleet has 47 Rust crates. Async usage:
- `tokio 1.x` — pheno-port-adapter, pheno-otel, pheno-tracing,
  phenotype-gateway, pheno-cli-base, ...
- `async-std 1.x` — none currently
- `smol` — pheno-cli-base (CLI sub-runtime)
- Synchronous — pheno-flags, pheno-errors, pheno-config

### Decision

**Default: tokio 1.x for all new async code.** Reasons:
- Largest ecosystem (hyper, tonic, reqwest, axum all tokio-first)
- Best-in-class support for OTel, tracing, prometheus
- Bifrost dependency (per ADR-050) requires tokio
- The phenotype-router decision layer (per ADR-051) is tokio

**When NOT to use tokio:**
- `#[no_std]` crates → use `embedded-io-async` (none currently)
- Single-shot CLI commands → use `pollster` (sync block_on)
- WebAssembly targets → use `wasm-bindgen-futures`

### Migration path

- New crates: tokio by default; no new async-std adoption
- Existing async-std: no forced migration; document each instance
- Synchronous libs: keep sync; do not introduce async

## Impact

L10 moves 0.00 → 3.00 once:
- ADR accepted in `docs/adr/2026-06-21/`
- All new async PRs reference the ADR
- Fleet grep shows 100% tokio for new async code (over time)
