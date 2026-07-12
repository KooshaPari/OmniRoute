# ADR-001: Architecture Overview — omniroute-rust

**Status:** Accepted (2026-07-12)  
**Drivers:** SPEC.md §3 (Architecture), ARCHITECTURE.md (Layer Model), ADR-031 (Bifrost Tier-1)  
**Priority:** Foundational

## Context

The OmniRoute project operates a fork-based AI gateway with ~237 provider entries,
two tiers of routing (Tier-1 Bifrost in Go, Tier-2 combo chains in Rust), and
a broad protocol surface (OpenAI-compatible REST, Anthropic Messages, MCP, A2A,
SSE streaming). The Rust rewrite (`omniroute-rust`) must replace the TypeScript
reference without regressing on latency, protocol fidelity, or operator ergonomics.

This ADR establishes the high-level architecture, crate topology, and design
constraints that all downstream ADRs reference.

## Decision

### Workspace layout

We adopt a **single workspace, flat crate topology** at `crates/`:

```
crates/
├── omni-core        # Core types: errors, config, IDs, executor trait
├── omni-protocol    # Wire-format types (OpenAI, Anthropic, MCP, A2A)
├── omni-translator  # Format detection + conversion registry
├── omni-storage     # sqlx SQLite + migrations + key vault
├── omni-crypto      # JWT, AES-GCM, Argon2, HMAC
├── omni-compression # RTK + Caveman + Aggressive + Adaptive engines
├── omni-router      # Executor registry + routing + circuit breaker
├── omni-telemetry   # Tracing + metrics + audit + OTel exporter
├── omni-server      # axum HTTP server, OpenAI-compat, SSE, /healthz
├── omni-mcp         # MCP server + tool registry (rmcp)
├── omni-a2a         # A2A v0.3 protocol handler
├── omni-cli         # clap binary (`omniroute`)
└── omni-sdk         # Client SDK re-exports
```

### Layer model

Dependencies flow strictly downward. No upward imports permitted:

| Layer | Crates | Responsibilities |
|-------|--------|------------------|
| **L0 — Core** | `omni-core`, `omni-crypto` | Errors, config, IDs, model/provider structs, executor trait, JWT/AES primitives. Zero external I/O. No async runtime in `omni-core`. |
| **L1 — Domain** | `omni-protocol`, `omni-translator`, `omni-storage` | Wire-format types (no behavior), format conversion, persistence. May do async I/O via `tokio`. No HTTP server. |
| **L2 — Engines** | `omni-compression`, `omni-router`, `omni-telemetry` | Pure algorithms + internal services. Compression engines, routing strategies, OTel exporter. No axum. |
| **L3 — Adapters** | `omni-server`, `omni-mcp`, `omni-a2a`, `omni-cli`, `omni-sdk` | External protocol surfaces. HTTP server, MCP, A2A, CLI, client SDK. May depend on all lower layers. |

### Two-tier routing

- **Tier-1 (Bifrost, Go):** First-hop dispatch. Fast-path for direct upstream
  calls. Env-gated (`BIFROST_ENABLED`).
- **Tier-2 (omni-router, Rust):** Combo chains, auto-fallback, context relay,
  circuit breaker. Pure Rust.

A request flows: HTTP → `omni-server` → `omni-router` (Tier-2) → executor trait
→ reqwest → upstream. If Bifrost is enabled for a provider, the executor trait
delegates to the bifrost endpoint instead.

### Key design constraints

1. **No unsafe outside crypto/FFI.** Clippy `#![deny(unsafe_op_in_unsafe_fn)]`.
2. **Compile-time SQL.** `sqlx::query!` macros — no string templating.
3. **Single static binary.** `panic = "abort"`, `lto = "fat"`, stripped symbols.
4. **Wire fidelity.** Public API is drop-in compatible with the TS fork.
5. **C-ABI surface.** `omni-sdk` exports a stable C interface for PyO3/napi-rs callers.

## Consequences

### Positive

1. **Deterministic compilation.** Flat workspace means `cargo build --workspace`
   resolves dependencies once.
2. **Fast developer iteration.** Layer isolation lets teams work on L2 compression
   or L3 server without rebuilding L0 unless the trait surface changes.
3. **Clear audit boundary.** SECURITY.md and deny.toml can be enforced per-layer.

### Negative

1. **Crate count is high.** 13 crates adds ceremony vs a single-crate layout.
   Mitigated by `justfile` recipes that mask the workspace.
2. **Dual-maintenance risk.** Crate interfaces that mirror TS types (especially
   `omni-protocol`) must be kept in sync. Mitigated by property-based tests
   that fuzz both sides.

### Risks

1. **Layer violation.** An engineer in a hurry might add an `axum` dependency in
   `omni-router`. **Mitigation:** CI enforces `cargo check` with per-crate
   features gating, and deny.toml discourages cross-layer deps in reviews.
2. **Bifrost coupling.** If Tier-1 and Tier-2 routing diverge, tracing across
   the boundary could be lossy. **Mitigation:** W3C `traceparent` propagation
   in every outbound call.

## ADR Cross-Reference

| ADR | Relation |
|-----|----------|
| ADR-002 (Decision Records) | This ADR follows the format defined in ADR-002. |
| ADR-003 (Team Conventions) | Workspace conventions are codified in ADR-003. |
| ADR-031 (Bifrost Tier-1) | Tier-1 router; this ADR describes the two-tier split. |
| ADR-033 (Rust Data Plane) | Phase 0 executor seed; this ADR is the parent architecture. |
