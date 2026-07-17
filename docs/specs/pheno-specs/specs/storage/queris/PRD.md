# Product Requirements Document — Queris

**Version**: 2.0  
**Status**: Active Development  
**Last Updated**: 2026-04-05

---

## Overview

Queris is a **state-of-the-art database abstraction layer** for the Phenotype ecosystem, providing type-safe, async-first database access with compile-time SQL verification, multi-backend support, and enterprise-grade connection management. It wraps established Rust database libraries (sqlx, deadpool) to provide a consistent interface across all Phenotype services.

### What Queris Is

- **Query Builder**: Fluent, type-safe SQL query construction
- **Connection Pool Manager**: High-performance async connection pooling
- **Migration System**: Embedded SQL migrations with checksum verification
- **Multi-Backend Abstraction**: PostgreSQL, MySQL, SQLite support
- **Query Optimizer**: Plan caching and result streaming

### What Queris Is Not

- Not a full ORM (raw SQL is first-class)
- Not synchronous (async-only)
- Not replacing sqlx (wraps and extends it)

---

## Problem Statement

Phenotype Rust services each implement database connection pooling, migration running, and query error mapping independently. This leads to:

1. **Code Duplication**: Each service re-implements the same patterns
2. **Inconsistent Error Handling**: Different error types across services
3. **Connection Management Issues**: Improper pool sizing, missing health checks
4. **Migration Chaos**: Each project has custom migration tooling
5. **Testing Complexity**: No unified test utilities

Queris centralizes these concerns so all services share a single, well-tested implementation.

---

## Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| Type Safety | Compile-time SQL verification | Zero runtime SQL errors |
| Performance | Sub-5ms p99 latency | Benchmark verified |
| Developer Experience | Ergonomic Rust API | Developer satisfaction |
| Multi-Backend | PostgreSQL, MySQL, SQLite | All supported |
| Observability | Metrics, tracing, logging | Full integration |

---

## Non-Goals

- **Full ORM support**: Raw SQL is first-class; Queris does not hide SQL
- **Synchronous access**: Async-only; no blocking database calls
- **sqlx replacement**: Wraps sqlx; leverages its ecosystem
- **Migration version control**: Does not manage migration history; only runs them
- **Database creation**: Assumes database exists; does not create databases

---

## Epics & User Stories

### E1 — Connection Management

**Goal**: Provide robust, configurable connection pooling with health checking.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E1.1 | Developer | Create a `Queris` pool from a URL | I can configure databases easily |
| E1.2 | Developer | Pool validates URL format before connecting | I catch config errors early |
| E1.3 | Developer | Health check method | I can verify database connectivity |
| E1.4 | DevOps | Configurable pool size and timeouts | I can tune for my workload |
| E1.5 | Developer | Connection metrics | I can monitor pool health |

**Acceptance Criteria**:
- `Queris::connect(url)` creates a working pool
- Invalid URLs return descriptive errors
- `pool.health_check()` returns `Result<()>`
- Pool sizing is configurable via config struct

---

### E2 — Query Execution

**Goal**: Provide type-safe query execution with compile-time SQL verification.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E2.1 | Developer | `fetch_one`, `fetch_all`, `execute` methods | I can run queries easily |
| E2.2 | Developer | Results mapped to Rust structs | I get type-safe results |
| E2.3 | Developer | Query errors include SQL and cause | I can debug issues |
| E2.4 | Developer | Prepared statement support | I get optimal performance |
| E2.5 | Developer | Transaction support | I can group operations |

**Acceptance Criteria**:
- `pool.fetch_one::<User>("SELECT * FROM users WHERE id = $1", [id])`
- `pool.fetch_all::<Post>("SELECT * FROM posts WHERE user_id = $1", [user_id])`
- All errors implement `std::error::Error`
- Transactions via `pool.transaction()` method

---

### E3 — Query Builder

**Goal**: Provide a fluent, type-safe query builder DSL.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E3.1 | Developer | Fluent filter syntax | I can build queries naturally |
| E3.2 | Developer | Type-safe column references | I catch errors at compile time |
| E3.3 | Developer | Select with explicit columns | I control returned data |
| E3.4 | Developer | JOIN support | I can query related data |
| E3.5 | Developer | Subquery support | I can write complex queries |

**Example**:
```rust
let users = table!(users)
    .filter(status.eq("active"))
    .order(created_at.desc())
    .limit(10)
    .fetch_all(&pool)
    .await?;
```

---

### E4 — Migration System

**Goal**: Provide embedded SQL migrations with verification.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E4.1 | Developer | Run migrations from embedded SQL | Deployments are self-contained |
| E4.2 | Developer | Migration checksums verified | Tampering is detected |
| E4.3 | Developer | Idempotent migrations | Re-runs are safe |
| E4.4 | Developer | Rollback support | I can revert changes |
| E4.5 | Developer | Migration status command | I know what ran |

**Acceptance Criteria**:
- `Migrator::run()` applies pending migrations
- Checksums prevent tampering
- Already-applied migrations are skipped
- `Migrator::rollback()` reverts last migration

---

### E5 — Error Handling

**Goal**: Provide consistent, informative error types.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E5.1 | Developer | `QuerisError` enum variants | I can match on error types |
| E5.2 | Developer | Error includes SQL query | I can debug failures |
| E5.3 | Developer | Error chain (source) | I see root causes |
| E5.4 | Developer | `NotFound` variant | I handle missing rows elegantly |
| E5.5 | Developer | `ConnectionFailed` variant | I know when DB is unreachable |

**Error Variants**:
```rust
pub enum QuerisError {
    ConnectionFailed { source: sqlx::Error, url: String },
    PoolExhausted { max_size: u32, wait_time: Duration },
    QueryFailed { sql: String, source: sqlx::Error },
    TypeMismatch { expected: &'static str, actual: &'static str },
    MigrationFailed { version: u64, name: String },
    ChecksumMismatch { version: u64, expected: String, actual: String },
    NotFound,
}
```

---

### E6 — Multi-Backend Support

**Goal**: Support PostgreSQL, MySQL, and SQLite with unified API.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E6.1 | Developer | Same API for all backends | I can switch databases easily |
| E6.2 | Developer | Backend-specific optimizations | I get best performance |
| E6.3 | Developer | Dialect-aware query building | SQL is correct for target |
| E6.4 | Developer | Backend capability detection | I can adapt behavior |

**Supported Backends**:
| Backend | Status | Notes |
|---------|--------|-------|
| PostgreSQL 16+ | ✅ Full | Primary target |
| MySQL 8.0+ | ✅ Full | Community tested |
| SQLite 3.45+ | ✅ Full | Development/Edge |

---

### E7 — Performance Engineering

**Goal**: Achieve sub-5ms p99 latency with >50K QPS throughput.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E7.1 | Developer | Connection pooling | Connections are reused |
| E7.2 | Developer | Prepared statements | Query plans are cached |
| E7.3 | Developer | Streaming results | Memory is bounded |
| E7.4 | Developer | Query plan caching | Repeated queries are fast |

**Performance Targets**:
| Metric | Target | Measurement |
|--------|--------|-------------|
| p99 Latency | < 5ms | hyperfine benchmark |
| Throughput | > 50K QPS | Load test |
| Memory/query | < 1KB | heaptrack |
| Connection acquire | < 1ms | Custom benchmark |

---

### E8 — Testing

**Goal**: Provide excellent test utilities for reliable testing.

| Story | As a... | I want... | So that... |
|-------|---------|----------|------------|
| E8.1 | Developer | In-memory SQLite for tests | Tests run fast |
| E8.2 | Developer | Test pool utilities | I set up DB state easily |
| E8.3 | Developer | Integration test gating | CI only runs integration tests |
| E8.4 | Developer | Fixture loading | I seed test data |

**Acceptance Criteria**:
- Unit tests use in-memory SQLite
- `#[cfg(feature = "integration")]` gates integration tests
- `TestPool::new()` creates isolated test database

---

## Acceptance Criteria Matrix

| Epic | Criterion | Verification |
|------|-----------|--------------|
| E1 | Pool connects successfully | Unit test |
| E1 | Health check works | Unit test |
| E1 | Metrics exported | Manual verification |
| E2 | Fetch one returns typed result | Unit test |
| E2 | Fetch all returns Vec | Unit test |
| E2 | Errors include SQL | Unit test |
| E3 | Query builder produces correct SQL | Property test |
| E3 | Type-safe column references | Compile-time |
| E4 | Migrations run successfully | Integration test |
| E4 | Checksum verification | Unit test |
| E5 | All error variants implemented | Unit test |
| E5 | Error implements std::error::Error | Unit test |
| E6 | PostgreSQL works | Integration test |
| E6 | MySQL works | Integration test |
| E6 | SQLite works | Unit test |
| E7 | Benchmarks meet targets | Manual benchmark |
| E8 | Tests pass with SQLite | CI |
| E8 | Integration tests gated | CI |

---

## Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| tokio | Async runtime | 1.x |
| sqlx | Database driver | 0.8.x |
| deadpool | Connection pooling | 0.12.x |
| thiserror | Error derivation | 2.x |
| serde | Serialization | 1.x |
| refinery | Migration runner | 0.9.x |
| tracing | Observability | 0.1.x |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Query latency (p99) | < 5ms | TBD |
| Throughput | > 50K QPS | TBD |
| Test coverage | > 80% | TBD |
| Documentation | 100% public API | TBD |
| Clippy warnings | 0 | TBD |

---

## Future Considerations

- **Federated queries**: Query across multiple databases
- **Columnar storage**: Analytical query support
- **CDC streaming**: Change data capture integration
- **Vector search**: pgvector compatibility
- **GraphQL integration**: Query from GraphQL resolvers

---

**Document Owner**: Platform Architecture Team  
**Reviewers**: Engineering, DevOps  
**Last Updated**: 2026-04-05
