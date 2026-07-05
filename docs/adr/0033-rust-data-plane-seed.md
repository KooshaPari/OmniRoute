# ADR-033: Rust Data Plane Seed — Phase 0 / Minimum Viable Executor

**Status:** Accepted (2026-07-05)  
**Drivers:** ADR-031 (Bifrost Tier-1), ADR-032 (Polyglot Binding Tiers), SPEC.md §13 (Tokn substrate)  
**Priority:** Phase 0 (scaffold + validate) → Phase 1 (single-provider MVP) → Phase 2 (production)

## Context

The OmniRoute fork presently routes every LLM request through `open-sse/executors/`
(TypeScript, 11 files, ~7k LOC combined). Every executor call path involves:
- Zod validation at the route layer (TypeScript)
- `chatCore.ts` dispatch (TypeScript)
- Translator format conversion (TypeScript)
- Async `fetch()` to upstream (Node.js)

This means every LLM request crosses the V8/Node.js runtime before reaching
the wire. For sub-50ms P99 provider-to-provider hops (our target for Tier-2
combo routing), this adds 10-40ms of unnecessary GC / JIT / scheduler overhead.

Bifrost (Go, ADR-031) already provides a Tier-1 router for first-hop dispatch.
But for Tier-2 routing (combo chains, auto-fallback, context relay), we need
a **Rust data plane** that can execute provider requests with deterministic
latency, zero-GC pauses, and native async I/O.

## Decision

We will build a Rust data plane incrementally, starting with a **minimum viable
executor** (the "seed") that proves out the pattern.

### Seed scope (Phase 0 — this session)

- `omniroute-rt/` crate (dual-license Apache-2.0 / MIT)
- Core trait: `ProviderExecutor` with `execute(Request) -> Response`
- One provider adapter: OpenAI `/v1/chat/completions`
- HTTP transport: `reqwest` with customizable timeouts + retries
- SSE streaming: `tokio-stream` with byte-splitting
- Metrics: OTel-compatible histogram + counter
- 3 tests: mock, real HTTP round-trip (OpenAI), SSE streaming

### Non-goals (Phase 0)

- Multi-provider routing (Phase 1)
- Config reloads / hot-reload (Phase 1)
- Full TypeScript parity for all 230 providers (Phase 2+)
- Bifrost integration (Phase 1)
- MCP / A2A server (Phase 2)

## Consequences

### Positive

1. **Verifiable latency delta.** `omniroute-rt` + reqwest vs. `open-sse/executors/` + fetch.
   We will benchmark OpenAI chat completions on both paths and publish the comparison.
2. **C FFI surface emerges naturally.** The `ProviderExecutor` trait is the logical
   boundary for `napi-rs` (T3-N) and `pyo3` (T3-P) bindings from ADR-032.
3. **Deterministic hot-path.** Rust's `tokio` runtime + `reqwest` gives sub-ms dispatch
   overhead vs. V8's 5-20ms GC-dependent dispatch.

### Negative

1. **Dual-maintenance.** During Phase 1-2, every provider addition must be mirrored
   in both TypeScript and Rust. We mitigate by only Rustifying the top-10 volume
   providers first (OpenAI, Anthropic, Gemini, DeepSeek, Mistral, Groq, Cohere,
   Together, xAI, Perplexity).
2. **Development velocity.** Rust compile-check cycles are slower than TS hot-reload.
   We mitigate by keeping `omniroute-rt/` in a separate workspace with `cargo watch`
   and minimal dependency tree.

### Risks

1. **Over-engineering before validation.** The seed must NOT attempt to abstract over
   230 providers. If it does, it will suffer the same complexity as the TS layer.
   **Mitigation:** single-provider Phase 0; N-Provider Phase 1 only after benchmark
   confirms >20% P99 improvement.
2. **False confidence from micro-benchmarks.** Real-world LLM latency is dominated
   by network + upstream inference time, not dispatch overhead. The seed is only
   valuable if it measurably improves the *pipeline* P99 when combo chains route
   through multiple providers.
   **Mitigation:** Phase 1 includes a benchmark harness that measures end-to-end
   combo routing (TypeScript vs Rust), not just single-request dispatch.

## ADR Cross-Reference

| ADR | Relation |
|-----|----------|
| ADR-031 (Bifrost Tier-1) | Rust data plane replaces **Tier-2** (combo chains), not Tier-1 (first hop). Bifrost is the Tier-1 router; Rust is the Tier-2 fast-executor layer. |
| ADR-032 (Polyglot Bindings) | T3-N (`napi-rs`) and T3-P (`pyo3`) expose `omniroute-rt` traits to Node.js and Python. The seed builds the Rust side of this interface. |
| SPEC.md §13 (Tokn) | `omniroute-rt` should eventually adopt `Tokn::tokenledger::routing` traits for provider selection and cost-routing (Phase 2+). |
