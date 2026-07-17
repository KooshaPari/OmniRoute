# Architecture Decision Records — Queris

## Quick Reference

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./docs/adr/ADR-001-query-builder-architecture.md) | Query Builder Architecture & Type Safety Strategy | Proposed | 2026-04-04 |
| [ADR-002](./docs/adr/ADR-002-connection-pooling.md) | Connection Pooling & Resource Management Strategy | Proposed | 2026-04-04 |
| [ADR-003](./docs/adr/ADR-003-migration-system.md) | Migration System & Schema Evolution Strategy | Proposed | 2026-04-04 |

---

## Legacy ADRs (Historical)

### ADR-001: sqlx as the Database Driver Wrapper

**Status:** Accepted (Legacy)

**Context:** Rust async database libraries include `sqlx`, `diesel`, `sea-orm`, and `tokio-postgres`. The library must choose one as its foundation.

**Decision:** Wrap `sqlx` as the underlying driver. `sqlx` supports PostgreSQL, MySQL, and SQLite with compile-time query checking (optional) and async-first design.

**Rationale:** `sqlx` is the most widely adopted async Rust database library. Its `FromRow` derive macro and query macros align well with `dbkit`s goal of typed query results without an ORM.

**Alternatives Considered:**
- diesel: sync-first; async support is bolted on; less ergonomic for Phenotype patterns.
- sea-orm: full ORM; more abstraction than `dbkit` intends to provide.
- raw tokio-postgres: no multi-database support; higher boilerplate.

**Consequences:** `dbkit` users gain `sqlx` as a transitive dependency. If `sqlx` is also used directly, versions must align.

---

### ADR-002: Embedded Migrations via include_dir

**Status:** Accepted (Legacy)

**Context:** Migrations can be embedded in the binary or loaded from the filesystem at runtime.

**Decision:** Use `include_dir!` macro to embed migration files at compile time. Runtime filesystem loading is an optional feature.

**Rationale:** Embedded migrations ensure the binary is self-contained and cannot fail due to missing migration files at deployment.

**Consequences:** Migration changes require recompilation. Large migration histories increase binary size slightly.

---

### ADR-003: thiserror for Error Types

**Status:** Accepted (Legacy)

**Context:** Consistent with ecosystem standard (see `apikit` ADR-002).

**Decision:** Use `thiserror` for `DbError`. `anyhow` is not used in library code.

**Consequences:** Callers see typed errors and can match on variants.

---

## Full ADR Documents

For complete ADR documentation with context, decision drivers, options analysis, and implementation plans, see:

- [docs/adr/ADR-001-query-builder-architecture.md](./docs/adr/ADR-001-query-builder-architecture.md)
- [docs/adr/ADR-002-connection-pooling.md](./docs/adr/ADR-002-connection-pooling.md)
- [docs/adr/ADR-003-migration-system.md](./docs/adr/ADR-003-migration-system.md)

---

## ADR Template

New ADRs should follow the nanovms format:

```markdown
# ADR-XXX: Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Deciders**: Names

## Context

## Decision Drivers

## Options Considered

### Option A
### Option B
### Option C

## Decision

## Consequences

### Positive
### Negative
### Mitigations

## Implementation Plan

## References
```

## Status Definitions

- **Proposed**: ADR is under review
- **Accepted**: ADR has been approved and is being implemented
- **Deprecated**: ADR is no longer relevant (superseded by new ADR)
- **Superseded**: ADR has been replaced by a newer ADR
