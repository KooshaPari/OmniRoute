# ADR-038: Hexagonal L4 Port/Adapter pattern is the canonical substrate interface

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-004** (v8 track T16)
**Refs:**
- ADR-014 (Hexagonal L4 ports: Port trait + Adapter impl, predecessor)
- ADR-023 (substrate placement Rule 3.1)
- ADR-036 (pheno-tracing canonical)
- ADR-037 (pheno-mcp-router canonical)

---

## Context

ADR-014 (v5 SOTA sweep) introduced the hexagonal L4 Port/Adapter pattern for substrate: each substrate crate exposes a `Port` trait (interface) and ships with concrete `Adapter` impls (in-tree) plus an open extension point (out-of-tree).

Adoption was uneven. Only 3 of 22 pheno-* Rust crates followed the pattern correctly:
- `pheno-port-adapter` (the reference impl)
- `pheno-tracing` (uses `pheno-port-adapter`)
- `pheno-otel` (uses `pheno-port-adapter`)

19 of 22 used ad-hoc traits, free functions, or direct dependencies.

## Decision

**Hexagonal L4 Port/Adapter is the canonical substrate interface. All pheno-* substrate Rust crates MUST follow the pattern. Adoption is required for new substrate starting 2026-06-22.**

### Pattern contract

```rust
// In `port.rs` of the substrate crate
pub trait Port: Send + Sync {
    type Request: Send;
    type Response: Send;
    type Error: std::error::Error + Send + Sync + 'static;

    async fn execute(&self, req: Self::Request) -> Result<Self::Response, Self::Error>;
}

// In `adapters/default.rs`
pub struct DefaultAdapter;
impl Port for DefaultAdapter { /* ... */ }

// In `lib.rs`
pub use port::Port;
pub use adapters::default::DefaultAdapter;
pub use adapters::mock::MockAdapter; // for tests
```

### Adoption matrix (22 crates)

| Repo | Pattern status | Required action |
|---|---|---|
| `pheno-port-adapter` | reference | KEEP (no action) |
| `pheno-tracing` | correct | KEEP (no action) |
| `pheno-otel` | correct | KEEP (no action) |
| `pheno-config` | ad-hoc | Refactor: extract `ConfigPort` trait, add `DefaultAdapter` |
| `pheno-context` | ad-hoc | Refactor: extract `ContextPort` trait |
| `pheno-errors` | n/a (no Port needed) | KEEP |
| `pheno-flags` | ad-hoc | Refactor: extract `FlagPort` trait |
| `pheno-cli-base` | partial | Refactor: extract `CliPort` trait |
| `pheno-agents-md` | ad-hoc | Refactor: extract `AgentPort` trait |
| `pheno-cargo-template` | template | Document pattern in template |
| 12 more | varies | Per-row migration |

## Migration sequence (18 PRs, ~120 min)

| # | Repo | Action |
|---|---|---|
| 16.1 | pheno-port-adapter | KEEP (reference impl) |
| 16.2-16.10 | 9 pheno-* crates | Refactor to Port/Adapter pattern |
| 16.11-16.18 | 8 phenotype-*-sdk crates | Apply pattern to SDK consumers |

## Consequence

- 22/22 pheno-* Rust crates follow the pattern (was 3/22)
- L4 hexagonal ports are uniform: `ConfigPort`, `ContextPort`, `FlagPort`, `CliPort`, `AgentPort`, etc.
- Out-of-tree Adapter impls are first-class (community can ship alternative adapters)
- 71-pillar L4 (architecture pattern) score improves from ~16/30 to ~26/30

## Cross-references

- ADR-014 (predecessor)
- ADR-023 Rule 3.1 (substrate quality bar)
- ADR-036 (pheno-tracing pattern consumer)
- ADR-037 (pheno-mcp-router pattern consumer)
- `findings/2026-06-18-L8-004-hexagonal-port-adoption.md`
