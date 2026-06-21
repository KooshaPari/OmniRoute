# v17 — L8 Observability Hooks (3 critical crates)

**Date:** 2026-06-21
**Cycle:** 7 (P0 reduction)
**Pillar:** L8 (Observability Hooks)
**Wave:** A

## Purpose

L8 (Observability Hooks) is at 1.00. Three critical crates have
no OTel-aware instrument: `pheno-port-adapter` (network I/O),
`pheno-config` (load operations), `pheno-flags` (parse path).

## Why it matters

Without observability hooks:
- Cannot correlate request → config-load → adapter-call in
  distributed traces
- Cannot alert on SLO violations (per L13 budgets)
- Cannot run chaos experiments (per L11) with telemetry

## Implementation

Add `#[tracing::instrument]` and explicit `tracing::span!` calls
on the 3 critical entry points in each crate.

### pheno-port-adapter

```rust
#[tracing::instrument(skip(self), fields(adapter = "tcp"))]
pub async fn connect(&self) -> Result<TcpStream, Error> {
    let _span = tracing::info_span!("connect", host = %self.host);
    // ...
}

#[tracing::instrument(skip(self, req), fields(intent = %req.intent))]
pub async fn send(&self, req: Request) -> Result<Response, Error> {
    // ...
}
```

### pheno-config

```rust
#[tracing::instrument(skip(path), fields(path = %path.display()))]
pub fn load(path: &Path) -> Result<Config, Error> {
    // ...
}
```

### pheno-flags

```rust
#[tracing::instrument]
pub fn parse(args: &[String]) -> Result<Vec<Flag>, Error> {
    // ...
}
```

## Tests

Add `tracing-subscriber` test subscriber that captures spans
emitted by each instrumented function. Asserts:
- Span name matches convention
- Fields are populated
- Error path emits a span event

## OTel export

Reuse the `pheno-tracing` OTLP export. No new infra needed;
`pheno-otel` init in the parent binary already covers all crates.

## Closure criterion for L8

L8 moves 1.00 → 3.00 once:
- All 3 critical crates have `#[tracing::instrument]` on entry points
- `tracing-test` suites verify span emission
- OTLP export verified in dev (one PR per crate)
