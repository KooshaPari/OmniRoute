# Tokn ↔ TS FFI Contract (WP-T1 → WP-T2)

This document defines the boundary between the Rust substrate (`crates/tokn/`)
and the TypeScript engine. The TS engine talks to Tokn via **napi-rs** (Rust →
Node add-on) over a single synchronous entry point.

## Single entry point

```rust
pub fn decide(&self, req: &RouteRequest) -> Result<RouteDecision, RoutingError>
```

`ParetoRouter::decide` is the only function called across the FFI. It:
1. Asks the configured `RoutingPort` for a `RouteDecision`.
2. Records the decision via the configured `LedgerPort`.
3. Returns the decision (or a structured `RoutingError`).

## Type mapping

| Rust | TS (via napi-rs) | Notes |
|---|---|---|
| `RouteRequest` | `{ requestId, requestedModel, tenantId, policyTags }` | camelCase via serde rename |
| `RouteDecision` | `{ requestId, provider, model, estCostMicrocents, estP99Ms }` | same |
| `RoutingError` | discriminated union: `UnknownProvider \| PolicyDenied \| PricingStale \| Ledger` | `thiserror` → `napi::Error` |
| `LedgerSnapshot` | `{ windowStart, windowEnd, totalMicrocents, byTenant: TenantSpend[] }` | read-only, returned on demand |

All types are `Serialize + Deserialize` so the same struct crosses both the
FFI boundary and the wire boundary (when the TS engine forwards decisions
to a downstream billing service).

## Latency budget

- p99 of `decide` end-to-end (FFI call + return) **must be ≤ 5 ms** on a
  2024-class M-series MacBook Pro. Measured in WP-T2 with the
  `benches/decide_bench.rs` harness.
- The default `ParetoRouter` is sync. Async work (DB flush, network
  pricing refresh) is the responsibility of the port implementation,
  not the router.

## FFI-safe boundary rules

- **No async fn in port traits.** All port methods are sync. Async
  work is hidden inside the implementation.
- **No panics across the boundary.** Port implementations must
  convert errors to `RoutingError`. `Result::unwrap` / `expect` are
  banned in the FFI surface.
- **No raw pointers or lifetime parameters in public types.** All
  public types are owned, `Clone`, and `'static`.
- **No global mutable state.** `ParetoRouter` is constructed once
  per process and shared via `Arc`.

## Threading

- The `ParetoRouter` is `Send + Sync` and intended to be cloned across
  worker threads. Internal `Mutex` use in port implementations is
  fine; do not block on cross-process locks.
- napi-rs's `ThreadsafeFunction` is the preferred way to call back
  into TS (e.g. for event recording). The default impl uses an
  in-memory port; a production impl will bridge to the TS-side
  event recorder via `ThreadsafeFunction::call`.

## Migration path

1. **WP-T1 (this WP)**: scaffold the crate + ports + default in-memory
   adapters. Land as a separate Cargo workspace. `cargo test` green.
2. **WP-T2 (next)**: add napi-rs binding exposing `ParetoRouter::decide`
   to TS. Wire the TS engine's `combo.ts` cost-aware routing to call
   it. Latency benchmark in `benches/decide_bench.rs`.
3. **WP-T3**: production `RoutingPort` impl that consults the real
   provider catalog and per-tenant policy. Replace the stub.

