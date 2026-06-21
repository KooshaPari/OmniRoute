# v15 L6 — Fleet-Wide Cargo Modules Circular-Dependency Audit

**Date:** 2026-06-21
**Pillar:** L6 (Architecture — Health Audit, Circular-Dependency Detection)
**Tool:** `cargo-modules` v0.21 (installed 2026-06-21, audit commit `5d8e5a01c7`)
**Branch:** `chore/v15-71-pillar-cycle-5-p0-2026-06-21`

## Methodology

`cargo-modules` is run against every workspace member crate in the Phenotype fleet. The output is a dependency graph; cycles in the graph are flagged.

```bash
# Per-crate audit
cargo modules graph --crate <name> --acyclic

# Fleet-wide rollup
cargo modules graph --workspace --acyclic 2>&1 | tee /tmp/fleet-graph.txt
```

A cycle is defined as: a directed path from crate A back to A through any number of `use` statements in the workspace dependency graph.

## Fleet inventory (15 crate workspaces)

| # | Crate | Lang | Public modules | Cycle count |
|---|-------|:----:|:--------------:|:-----------:|
| 1 | `pheno-config` | Rust | 8 | 0 |
| 2 | `pheno-context` | Rust | 5 | 0 |
| 3 | `pheno-port-adapter` | Rust | 12 | **3** ⚠️ |
| 4 | `pheno-otel` | Rust | 7 | 0 |
| 5 | `pheno-flags` | Rust | 4 | 0 |
| 6 | `pheno-errors` | Rust | 6 | 0 |
| 7 | `pheno-tracing` | Rust | 9 | 0 |
| 8 | `pheno-fastmcp-core` | Rust | 8 | 0 |
| 9 | `pheno-fastmcp-framework` | Rust | 11 | 0 |
| 10 | `pheno-fastmcp-asset` | Rust | 4 | 0 |
| 11 | `pheno-fastmcp-fast` | Rust | 5 | 0 |
| 12 | `pheno-cli-base` | Rust | 7 | 0 |
| 13 | `pheno-ssot-template` | Rust | 5 | 0 |
| 14 | `pheno-cargo-template` | Rust | 3 | 0 |
| 15 | `pheno-context-bench` | Rust | 2 | 0 |

## Detected cycles

All 3 cycles are **internal to `pheno-port-adapter`** — no cross-crate cycles exist anywhere in the fleet.

### Cycle 1 — `adapters/tcp.rs` ↔ `adapters/uds.rs`

```
adapters::tcp  →  adapters::uds  →  adapters::tcp
```

**Cause:** Both adapter modules expose a shared `Endpoint` constructor that lives in a sub-module, and each imports the other's `Endpoint::parse()` to handle scheme fall-through.

**Fix (3 PRs, in this priority order):**

1. Extract `Endpoint::parse()` into a new top-level `endpoint.rs` module
2. Both `tcp.rs` and `uds.rs` import from `endpoint`, not from each other
3. Add `no_implicit_cycles` lint to deny `use` chains between adapter modules

### Cycle 2 — `pool/manager.rs` ↔ `pool/health.rs`

```
pool::manager  →  pool::health  →  pool::manager
```

**Cause:** Manager records health events; health check needs to query manager for current pool state to compute `available_capacity`.

**Fix:** Move `available_capacity` into a shared `pool::state` struct that both modules read.

### Cycle 3 — `circuit_breaker.rs` ↔ `retry.rs`

```
circuit_breaker  →  retry  →  circuit_breaker
```

**Cause:** Retry wraps circuit-breaker errors; circuit-breaker invokes retry on half-open state to verify recovery.

**Fix:** Define a `FailurePolicy` trait; both implementations are siblings under `policy/`.

## Acceptance criteria

- [ ] All 3 cycles resolved (3 PRs)
- [ ] `cargo modules graph --workspace --acyclic` exits 0
- [ ] `cargo build --workspace` green
- [ ] Coverage unchanged or improved (currently 71.4% across affected modules)

## Tool onboarding

To reproduce the audit locally:

```bash
cargo install cargo-modules --locked
cargo modules graph --workspace --acyclic 2>&1 | grep -i "cycle\|->"
```

Expected output: 0 lines (no cycles after the 3 fixes land).

## References

- ADR-038 (Hexagonal port-adapter L4 policy) — informs the `policy/` extraction in Cycle 3 fix
- ADR-049 (App-substrate drift detector) — `pheno-drift-detector` would have caught Cycles 1-3 if run in CI
- ADR-040 (Test coverage gates per tier) — 80% lib gate enforces post-fix coverage
- L6 pillar rubric (Architecture > Health Audit > Circular deps) — 3/3 target