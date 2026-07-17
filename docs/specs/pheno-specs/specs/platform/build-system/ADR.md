# Architecture Decision Records — phenotype-forge

## ADR-001 — Rust as Implementation Language

**Status:** Accepted  
**Date:** 2026-03-27

### Context
A task runner must be fast to start (no JVM/Python startup overhead), cross-platform, and distributable as a single binary.

### Decision
Implement phenotype-forge in Rust. Use `clap` for CLI parsing and `tokio` for async task execution.

### Consequences
- Zero-dependency single-binary distribution via `cargo build --release`.
- Task definitions are Rust code; no separate DSL parser required.
- Contributors need Rust knowledge to add tasks.

---

## ADR-002 — Tasks as Rust Traits (Not YAML/TOML DSL)

**Status:** Accepted  
**Date:** 2026-03-27

### Context
YAML/TOML task DSLs require a parser and have limited expressiveness. Defining tasks as Rust code gives full language power.

### Decision
Tasks implement a `Task` trait with `name()`, `description()`, `deps() -> Vec<TaskId>`, and `run(ctx) -> Result<()>` methods.

### Consequences
- Tasks are type-checked at compile time.
- No runtime parsing errors for task definitions.

---

## ADR-003 — Tokio for Parallel Execution

**Status:** Accepted  
**Date:** 2026-03-27

### Context
Independent tasks should run in parallel to minimize wall-clock build time.

### Decision
Use `tokio` with a bounded `JoinSet` for parallel task execution. Concurrency limit defaults to CPU count.

### Consequences
- Tasks must be `Send + Sync` to run in parallel.
- I/O-bound tasks benefit from async execution.
