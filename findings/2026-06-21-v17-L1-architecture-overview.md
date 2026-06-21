# v17 — L1 Architecture Overview (3 substrate repos)

**Date:** 2026-06-21
**Cycle:** 7 (P0 reduction)
**Pillar:** L1 (Architecture Overview)
**Wave:** A (architecture documents)
**Branch:** `chore/v17-71-pillar-cycle-7-p0-2026-06-21`

## Purpose

L1 (Architecture Overview) is currently at 0.00 across the 3 substrate repos
(`pheno-flags`, `pheno-errors`, `pheno-port-adapter`). The pillar asks for a
1-page architecture overview doc that explains: what the crate does, the
high-level components, the data flow, and the design tenets.

## Convention

Every `pheno-*-lib` / `phenotype-*-sdk` MUST ship an `ARCHITECTURE.md` in
the crate root, ≤ 200 lines, with the following sections:

1. **What this crate does** (1 paragraph)
2. **Tenets** (3-5 bullet points — design principles)
3. **Components** (numbered list with one-line description each)
4. **Data flow** (ASCII diagram + 1-paragraph narrative)
5. **Boundaries** (what belongs in this crate vs neighboring crates)
6. **Related crates** (table of upstream + downstream)

## Deliverables (3 files)

### 1. `pheno-flags/ARCHITECTURE.md`

```markdown
# pheno-flags — Architecture Overview

## What this crate does

pheno-flags parses CLI flag strings into typed values, validates them against
a schema, and emits change events. It is the canonical flag-parse substrate
for the Phenotype fleet.

## Tenets

- **Zero allocation on the hot path** — parsing reuses caller buffers.
- **Schema is data, not code** — flag definitions are TOML/JSON.
- **Type-safe by construction** — flag values are `enum` variants, not strings.
- **Errors carry context** — `Error::UnknownFlag(name)` names the bad input.

## Components

1. `Parser` — reads raw `&[u8]` input, produces `Token` stream
2. `Schema` — declared flag types and validation rules
3. `Value` — typed flag value (`Bool`, `Int`, `String`, `List<T>`, `Map<K,V>`)
4. `Emitter` — produces `Change` events on accepted values
5. `Error` — `UnknownFlag | InvalidValue | TypeMismatch | OutOfRange`

## Data flow

```
input: &[u8] ──▶ Parser ──▶ Token[] ──▶ Schema::match ──▶ Value
                                                                │
                                                                ▼
                                                          Emitter::emit
                                                                │
                                                                ▼
                                                            Change event
```

## Boundaries

- **In:** raw byte parsing, schema validation, type coercion, error context.
- **Out:** HTTP serving, persistence, async I/O, business logic.

## Related crates

| Crate | Direction | Notes |
|-------|-----------|-------|
| `pheno-errors` | upstream | Error types |
| `pheno-context` | upstream | Span context for `change` events |
| `pheno-port-adapter` | downstream | Uses `Value` for port config parsing |
```

### 2. `pheno-errors/ARCHITECTURE.md`

```markdown
# pheno-errors — Architecture Overview

## What this crate does

pheno-errors provides canonical error primitives for the Phenotype fleet:
typed error enums, error context propagation, and structured error reporting
across Rust + Python (via UniFFI).

## Tenets

- **Errors are data, not strings** — `Error::wrap(cause)` preserves the chain.
- **One crate, one concern** — no I/O, no logging, no metrics here.
- **Backtrace capture is opt-in** — `with_backtrace()` only when needed.
- **Stable across language boundaries** — UniFFI-exported types.

## Components

1. `Error` — root error enum (`Internal | External | Invalid`)
2. `ErrorContext` — propagating context for `?`-style chains
3. `Wrap<T>` — typed result with `ErrorContext` attached
4. `Report` — printable error chain for `eprintln!`
5. `UniFFI` — FFI bridge to Python (auto-generated bindings)

## Data flow

```
operation: Result<T, E>  ──▶  .wrap(context)  ──▶  Wrap<T>
                                                     │
                                                     ▼
                                              ErrorContext::chain
                                                     │
                                                     ▼
                                              Report::print  ──▶ stderr
```

## Boundaries

- **In:** error types, context propagation, backtrace, FFI binding.
- **Out:** logging, metrics, panic recovery, async error combinators.

## Related crates

| Crate | Direction | Notes |
|-------|-----------|-------|
| (none) | upstream | — |
| `pheno-flags` | downstream | `Error::UnknownFlag` etc. |
| `pheno-port-adapter` | downstream | `Error::Adapter` |
```

### 3. `pheno-port-adapter/ARCHITECTURE.md`

```markdown
# pheno-port-adapter — Architecture Overview

## What this crate does

pheno-port-adapter implements the hexagonal port-adapter pattern for the
Phenotype fleet. It provides trait-based ports, swappable adapters, and
connection lifecycle management for transport protocols (TCP, UDP, HTTP,
Unix sockets).

## Tenets

- **Ports are traits, never concrete** — `Port<T>` is the boundary.
- **Adapters are stateless, connections are stateful** — 1 adapter, N conns.
- **Lifecycle is explicit** — `connect() → use → close()`; no hidden drops.
- **Errors surface at the port boundary** — adapters translate, ports speak.

## Components

1. `Port<T>` — trait for pluggable endpoints (send/receive/connect)
2. `Adapter<T>` — concrete protocol implementation
3. `Connection<T>` — typed handle to a live connection
4. `ConnectionPool<T>` — managed connection lifecycle with retry/circuit-break
5. `RetryPolicy` — exponential backoff + circuit breaker state

## Data flow

```
caller: &Port<T>
   │
   ▼
Adapter::connect(target)  ──▶  Connection<T>  ──▶  use  ──▶  close
   │                              │                   │
   ▼                              ▼                   ▼
RetryPolicy                ConnectionPool      metrics: conn.up
(circuit_breaker)          (refcount)          metrics: conn.down
```

## Boundaries

- **In:** trait definitions, adapter implementations, connection lifecycle.
- **Out:** business logic, request routing, authentication, rate limiting
  (delegated to `pheno-context` and the application layer).

## Related crates

| Crate | Direction | Notes |
|-------|-----------|-------|
| `pheno-flags` | upstream | Parses connection-string flags into `Adapter::new` args |
| `pheno-errors` | upstream | `Error::Adapter` |
| `pheno-context` | upstream | `Span` context for connection lifetime |
```

## Acceptance

- 3 `ARCHITECTURE.md` files added to crate roots
- All sections present
- All Related-crates tables accurate (verified against `Cargo.toml` paths)
- Each file ≤ 200 lines (target ~80 lines)

## Closure criterion for L1

`pheno-flags`, `pheno-errors`, `pheno-port-adapter` each ship an
`ARCHITECTURE.md` that meets the convention above. The pillar score moves
from 0.00 to 3.00.

Refs: plans/2026-06-21-v17-71-pillar-cycle-7-p0.md
