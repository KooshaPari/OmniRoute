# ADR-001: Query Builder Architecture & Type Safety Strategy

**Date**: 2026-04-04
**Status**: Proposed
**Deciders**: KooshaPari

## Context

Queris needs a query builder that balances:
- **Type safety**: Compile-time SQL validation to prevent runtime errors
- **Ergonomics**: Intuitive API that feels idiomatic to Rust developers
- **Performance**: Zero-cost abstractions with minimal runtime overhead
- **Flexibility**: Support for both high-level ORM patterns and raw SQL when needed

We evaluated multiple approaches from the Rust ecosystem and beyond, considering the trade-offs between safety, performance, and developer experience.

## Decision Drivers

- **Compile-time SQL verification** is critical for preventing runtime SQL errors in production
- **Async-first design** required for the Phenotype ecosystem's high-throughput services
- **Zero-cost abstractions** ensure no runtime penalty for type safety
- **Database backend flexibility** must support PostgreSQL, MySQL, SQLite, and MongoDB

## Options Considered

### Option A: Diesel (Full ORM)

**Pros**:
- ✅ Compile-time query verification
- ✅ Type-safe DSL with strong type inference
- ✅ Built-in migration system
- ✅ Multi-backend support (PG, MySQL, SQLite)
- ✅ Mature ecosystem with extensive documentation

**Cons**:
- ⚠️ Async support requires additional crate (tokio-diesel)
- ⚠️ Complex trait system increases compile times
- ⚠️ DSL learning curve for complex queries
- ⚠️ Limited flexibility for raw SQL

### Option B: sqlx (Compile-time Checked SQL)

**Pros**:
- ✅ True compile-time SQL verification via `query!` macro
- ✅ Native async/await support
- ✅ Direct SQL with type-safe result mapping
- ✅ Multiple backend support with consistent API
- ✅ Fast runtime performance (minimal overhead)

**Cons**:
- ⚠️ Requires live database connection for compile-time checks
- ⚠️ No built-in query builder (just raw SQL)
- ⚠️ External migration tool required
- ⚠️ No ORM-style relationship handling

### Option C: SeaORM (Async-first ORM)

**Pros**:
- ✅ Native async support from ground up
- ✅ Entity derive macros for boilerplate reduction
- ✅ Built-in migration CLI
- ✅ Active Record + Data Mapper patterns
- ✅ Good relationship handling

**Cons**:
- ⚠️ Runtime query building (less compile-time safety)
- ⚠️ Heavier abstraction with more memory overhead
- ⚠️ Less control over generated SQL

### Option D: Custom Query Builder (Queris Hybrid)

**Decision**: **SELECTED**

**Approach**: Hybrid architecture combining:
1. **sqlx** for compile-time SQL verification and runtime execution
2. **Custom DSL** for ergonomic query composition
3. **Deadpool** for connection pooling
4. **Refinery** for migrations

**Justification**:
- Best of both worlds: compile-time safety + ergonomic API
- sqlx provides rock-solid foundation with proven production use
- Custom DSL can evolve based on Phenotype-specific needs
- No lock-in to heavy ORM patterns

## Decision

**Adopt a hybrid query builder architecture with sqlx at the core:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Queris Query Architecture                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Queris DSL (Ergonomic API)                          │   │
│  │                                                                        │   │
│  │   table!(users)                                                        │   │
│  │       .filter(name.eq("Alice"))                                        │   │
│  │       .order(created_at.desc())                                        │   │
│  │       .limit(10)                                                       │   │
│  │       .fetch_all(&pool)                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Query Compiler                                      │   │
│  │                                                                        │   │
│  │   Parse → Validate → Optimize → Generate SQL                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    sqlx Runtime                                        │   │
│  │                                                                        │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │   │
│  │   │  PostgreSQL  │  │    MySQL     │  │    SQLite    │                 │   │
│  │   │   Driver     │  │   Driver     │  │   Driver     │                 │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Type Safety Levels

| Level | Technique | Verification | Performance |
|-------|-----------|--------------|-------------|
| **L1** | SQL parsing | Syntax only | Fast |
| **L2** | Schema validation | Table/column existence | Requires DB |
| **L3** | Type inference | Query result types | Requires DB |
| **L4** | Query validation | Semantic correctness | Requires DB |

**Queris targets L3-L4** with sqlx's compile-time verification.

## Implementation Plan

### Phase 1: Foundation (Current)
- [ ] sqlx integration with deadpool connection pooling
- [ ] Basic table/query DSL macros
- [ ] Type-safe result mapping
- [ ] PostgreSQL driver support

### Phase 2: Multi-Backend (2026 Q2)
- [ ] MySQL driver support
- [ ] SQLite driver support
- [ ] MongoDB connector (via mongodb crate)
- [ ] Backend-specific optimizations

### Phase 3: Advanced Querying (2026 Q3)
- [ ] JOIN DSL with type-safe relationship mapping
- [ ] Subquery support
- [ ] Window functions
- [ ] Common Table Expressions (CTEs)

### Phase 4: Optimization (2026 Q4)
- [ ] Query plan caching
- [ ] Prepared statement optimization
- [ ] Connection pool auto-tuning
- [ ] Read replica routing

## Consequences

### Positive
- **Compile-time safety** prevents entire categories of runtime SQL errors
- **Async-first** design matches Phenotype ecosystem requirements
- **Zero-cost abstractions** maintain high performance
- **Hybrid approach** provides flexibility without ORM lock-in
- **sqlx maturity** reduces risk with proven production usage

### Negative
- **Build-time database dependency** requires live DB for compile-time checks
- **Complex build setup** needs CI caching for schema verification
- **Learning curve** for custom DSL patterns
- **Macro debugging** can be challenging when things go wrong

### Mitigations
- Use `SQLX_OFFLINE=true` for CI/build environments with cached query metadata
- Provide comprehensive DSL documentation and examples
- Implement compile-time error messages that guide developers

## References

- [sqlx](https://github.com/launchbadge/sqlx) — Compile-time checked SQL
- [Diesel](https://diesel.rs/) — Rust ORM
- [SeaORM](https://www.sea-ql.org/SeaORM/) — Async ORM
- [Query Composition in Type-Safe Query Builders](https://docs.rs/diesel/latest/diesel/query_dsl/index.html)
- [Async Rust Database Access](https://rust-lang.github.io/async-book/)

---

*This ADR establishes the type-safe query builder foundation for Queris.*
