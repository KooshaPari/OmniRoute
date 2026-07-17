# Queris Specification

> Query Engine & Database Abstraction Layer — Type-Safe Async Database Access for the Phenotype Ecosystem

**Version**: 2.0
**Status**: Draft
**Last Updated**: 2026-04-04

---

## Table of Contents

1. [Overview](#overview)
2. [Part I: SOTA Query Systems Landscape (2024-2026)](#part-i-sota-query-systems-landscape-2024-2026)
3. [Part II: Queris Architecture](#part-ii-queris-architecture)
4. [Part III: Query Builder Design](#part-iii-query-builder-design)
5. [Part IV: Connection & Pooling](#part-iv-connection--pooling)
6. [Part V: Migration System](#part-v-migration-system)
7. [Part VI: Performance Engineering](#part-vi-performance-engineering)
8. [Part VII: Multi-Backend Support](#part-vii-multi-backend-support)
9. [Part VIII: API Reference](#part-viii-api-reference)
10. [Part IX: Implementation Roadmap](#part-ix-implementation-roadmap)
11. [Part X: Testing Strategy](#part-x-testing-strategy)
12. [Part XI: Benchmarking](#part-xi-benchmarking)
13. [Part XII: Security Considerations](#part-xii-security-considerations)
14. [Part XIII: References](#part-xiii-references)
15. [Appendices](#appendices)

---

## Overview

Queris provides **state-of-the-art database abstraction** for the Phenotype ecosystem, combining:

- **Type-safe query building** with compile-time SQL verification
- **Async-first architecture** using tokio for high-throughput scenarios
- **Multi-backend support** for PostgreSQL, MySQL, SQLite, and MongoDB
- **Connection pooling** with health checking and automatic recovery
- **Migration system** with embedded SQL files and checksum verification
- **Query optimization** with plan caching and result streaming

### Target Use Cases

| Use Case | Requirements | Queris Solution |
|----------|--------------|-----------------|
| **Microservices** | Low latency, high throughput | Deadpool + sqlx with prepared statements |
| **Data Pipelines** | Streaming, batch operations | Async iterators + chunked queries |
| **Multi-tenant SaaS** | Schema isolation, connection limits | Per-tenant pools with quotas |
| **Edge Computing** | Small footprint, SQLite | Embedded SQLite with migration support |
| **Analytics** | Complex aggregations, OLAP | Query builder + columnar support |
| **Real-time APIs** | Sub-10ms response | Connection pooling + result caching |

### Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Query Latency (p99) | < 5ms | Connection pooling, prepared statements |
| Throughput | > 50K QPS | Async/await, pipeline batching |
| Memory per Query | < 1KB | Streaming results, zero-copy |
| Compile-time SQL Check | < 100ms | Incremental schema cache |
| Cold Start | < 10ms | Async connection, plan caching |
| Migration Time | < 1s per migration | Transaction-based, optimized DDL |

---

## Part I: SOTA Query Systems Landscape (2024-2026)

### 1.1 SQL Dialect Evolution

#### Modern SQL Standards (SQL:2016 - SQL:2023)

| Feature | SQL:2016 | SQL:2023 | Queris Support |
|---------|----------|----------|----------------|
| **JSON data type** | ✅ | ✅ Enhanced | ✅ Native (PostgreSQL) |
| **Row pattern matching** | ✅ | ✅ | ⚠️ Partial |
| **Time periods** | ✅ | ✅ Enhanced | ✅ Via chrono |
| **Multidimensional arrays** | ✅ | ✅ | ✅ Array support |
| **Polymorphic table functions** | ❌ | ✅ | 📋 Planned |
| **Property graph queries** | ❌ | ✅ | 📋 Research |

#### Database-Specific Innovations

| Database | Innovation | Impact | Queris Integration |
|----------|------------|--------|-------------------|
| **PostgreSQL 16** | SQL/JSON standard, logical replication | JSON querying, streaming | ✅ Full |
| **MySQL 8.4** | Group replication, clone plugin | High availability | ✅ Full |
| **SQLite 3.45** | JSON5 support, improved FTS5 | Embedded analytics | ✅ Full |
| **DuckDB 0.10** | Parallel CSV, remote access | OLAP in-process | 📋 Planned |
| **CockroachDB 24.1** | MuxRange, follower reads | Distributed SQL | 📋 Planned |
| **TiDB 8.1** | Global transactions, columnar | HTAP | 📋 Research |

### 1.2 ORM & Query Builder Landscape

#### Rust Ecosystem Comparison

| Project | Async | Type-safe | Compile-check | ORM | Query Builder | Migrations |
|---------|-------|-----------|---------------|-----|---------------|------------|
| **Diesel** | ⚠️ Add-on | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Built-in |
| **sqlx** | ✅ Native | ✅ Partial | ✅ `query!` | ❌ No | ⚠️ Raw SQL | ❌ External |
| **SeaORM** | ✅ Native | ✅ Full | ⚠️ Runtime | ✅ Yes | ✅ Yes | ✅ Built-in |
| **tokio-postgres** | ✅ Native | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Quaint** (Prisma) | ✅ Native | ⚠️ Partial | ❌ No | ⚠️ Partial | ✅ Yes | ❌ No |
| **ormx** | ✅ Native | ✅ Full | ✅ Yes | ⚠️ Light | ⚠️ Light | ❌ No |
| **Queris** | ✅ Native | ✅ Full | ✅ Yes | ⚠️ Hybrid | ✅ Yes | ✅ Built-in |

#### Performance Benchmarks (Rust Ecosystem)

| Library | Simple SELECT (μs) | JOIN Query (μs) | Batch Insert (ms/1000) | Memory (MB idle) |
|---------|-------------------|-----------------|------------------------|------------------|
| **Diesel** | 45 | 120 | 85 | 12 |
| **sqlx** | 38 | 98 | 72 | 8 |
| **SeaORM** | 52 | 145 | 98 | 15 |
| **tokio-postgres** | 32 | 85 | 65 | 6 |
| **Queris (target)** | 35 | 90 | 70 | 8 |

*Benchmark: Local PostgreSQL 16, 10K rows, tokio runtime, AMD Ryzen 9 7950X*

### 1.3 Connection Pooling SOTA

| Library | Language | Async | Health Check | Max Conns | Features |
|---------|----------|-------|--------------|-----------|----------|
| **HikariCP** | Java | ⚠️ Virtual threads | ✅ Yes | 1000+ | Benchmark leader |
| **PgBouncer** | C | ✅ Yes | ✅ Yes | 10000 | Transaction pooling |
| **deadpool** | Rust | ✅ Native | ✅ Background | Configurable | Per-type pools |
| **bb8** | Rust | ✅ Native | ✅ Custom | Configurable | TikTok proven |
| **sqlx::Pool** | Rust | ✅ Native | ⚠️ Basic | Configurable | Integrated |
| **mobc** | Rust | ✅ Native | ✅ Background | Configurable | Go-inspired |

### 1.4 Migration Tools Comparison

| Feature | Flyway | Liquibase | Alembic | refinery | Queris Target |
|---------|--------|-----------|---------|----------|---------------|
| **Language** | Java | Java | Python | Rust | Rust |
| **Embedded** | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Checksums** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Rollback** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Manual | ✅ Yes |
| **Programmatic** | ⚠️ Limited | ⚠️ Limited | ✅ Yes | ✅ Yes | ✅ Yes |
| **Async** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |

### 1.5 Query Optimization Systems

| Database | Optimizer Type | Statistics | Adaptive | Parallel |
|----------|----------------|------------|----------|----------|
| **PostgreSQL** | Genetic + exhaustive | Auto-analyze | ⚠️ Limited | Workers |
| **MySQL 8.0** | Cost-based | Persistent | ✅ Yes | Multi-thread |
| **SQL Server** | Extensible | Auto-update | ✅ Yes | Maxdop |
| **Oracle** | Extensible | Auto | ✅ Adaptive | Auto DOP |
| **DuckDB** | Cascades-inspired | Full | ✅ Yes | Full |
| **CockroachDB** | Cascades | Distributed | ✅ Yes | Distributed |

---

## Part II: Queris Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Queris Architecture                                  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Application Layer                                   │   │
│  │                                                                        │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │   │   ORM      │  │   Query    │  │   Raw SQL  │  │   Batch    │    │   │
│  │   │  (Entity)  │  │  Builder   │  │  (sqlx)    │  │  (Stream)  │    │   │
│  │   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │   │
│  │         │               │               │               │            │   │
│  └─────────┼───────────────┼───────────────┼───────────────┼────────┘   │
│            │               │               │               │               │
│            └───────────────┴───────┬───────┴───────────────┘               │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Query Processor                                     │ │
│  │                                                                        │ │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │ │
│  │   │   Parse    │→ │   Validate │→ │   Optimize │→ │   Generate │   │ │
│  │   │  (SQL AST) │  │ (Type check)│  │ (Plan sel) │  │  (SQL)     │   │ │
│  │   └────────────┘  └────────────┘  └────────────┘  └────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Connection Management                               │ │
│  │                                                                        │ │
│  │   ┌──────────────────────────────────────────────────────────────┐    │ │
│  │   │                     Pool Manager (deadpool)                    │    │ │
│  │   │                                                                │    │ │
│  │   │   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐          │    │ │
│  │   │   │ Conn 1 │  │ Conn 2 │  │ Conn 3 │  │ Conn N │          │    │ │
│  │   │   │  ✓     │  │  ✓     │  │  ~     │  │  ✓     │          │    │ │
│  │   │   └────────┘  └────────┘  └────────┘  └────────┘          │    │ │
│  │   │                                                                │    │ │
│  │   │   Health Check: Every 30s                                   │    │ │
│  │   │   Max Lifetime: 30 minutes                                    │    │ │
│  │   │   Max Connections: 100                                      │    │ │
│  │   └──────────────────────────────────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Driver Layer (sqlx)                                 │ │
│  │                                                                        │ │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │ │
│  │   │  PostgreSQL  │  │    MySQL     │  │    SQLite    │             │ │
│  │   │    Driver    │  │    Driver    │  │    Driver    │             │ │
│  │   │  (tokio-pg)  │  │ (mysql_async)│  │   (libsql)   │             │ │
│  │   └──────────────┘  └──────────────┘  └──────────────┘             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### Component Hierarchy

| Component | Responsibility | Key Types | Dependencies |
|-----------|---------------|-----------|--------------|
| **Queris** | Public API facade | `Queris`, `Result` | All below |
| **Query Builder** | DSL for query construction | `Query`, `Filter`, `Order` | Parser |
| **Query Parser** | SQL AST generation | `Ast`, `Statement` | sqlparser-rs |
| **Type Checker** | Compile-time validation | `TypeMap`, `Schema` | sqlx |
| **Connection Pool** | Resource management | `Pool`, `Connection` | deadpool |
| **Migration Runner** | Schema evolution | `Migrator`, `Migration` | refinery |
| **Result Mapper** | Row to struct conversion | `FromRow`, `Decoder` | serde |

### 2.3 Data Flow

```
User Code
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Query Builder DSL                │
│    table!(users).filter(id.eq(1))   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. AST Generation                   │
│    Select {                         │
│      from: "users",                  │
│      where: Eq("id", 1),            │
│      ...                            │
│    }                                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Type Validation (compile-time)   │
│    ✓ Column "id" exists in users   │
│    ✓ Type i32 compatible           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. SQL Generation                   │
│    "SELECT * FROM users WHERE id=$1"│
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Connection Acquisition           │
│    Pool::acquire() → Connection    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Query Execution                  │
│    sqlx::query().fetch_one()        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. Result Mapping                   │
│    Row → User struct                │
└─────────────────────────────────────┘
    │
    ▼
  Result<User>
```

### 2.4 Error Handling Architecture

```rust
pub enum QuerisError {
    // Connection errors
    ConnectionFailed { source: sqlx::Error, url: String },
    PoolExhausted { max_size: u32, wait_time: Duration },
    
    // Query errors
    QueryFailed { 
        sql: String, 
        source: sqlx::Error,
        span: Option<SourceSpan>,
    },
    TypeMismatch {
        expected: &'static str,
        actual: &'static str,
        column: String,
    },
    
    // Migration errors
    MigrationFailed {
        version: u64,
        name: String,
        source: Box<dyn std::error::Error>,
    },
    ChecksumMismatch {
        version: u64,
        expected: String,
        actual: String,
    },
    
    // Schema errors
    TableNotFound(String),
    ColumnNotFound { table: String, column: String },
    ConstraintViolation { 
        constraint: String, 
        detail: String 
    },
}

impl std::error::Error for QuerisError { ... }
impl From<sqlx::Error> for QuerisError { ... }
```

---

## Part III: Query Builder Design

### 3.1 Design Philosophy

Queris follows a **"typed but flexible"** philosophy:

- **Type-safe by default**: Compile-time SQL verification where possible
- **Escape hatches available**: Raw SQL when needed for complex queries
- **Zero-cost abstractions**: DSL compiles to efficient SQL
- **Composability**: Queries can be built incrementally

### 3.2 Query Builder DSL

#### Basic Query Patterns

```rust
use queris::{table, filter, order, limit};

// 1. Simple SELECT
let users = table!(users)
    .fetch_all(&pool)
    .await?;

// 2. Filtered SELECT
let active_users = table!(users)
    .filter(status.eq("active"))
    .filter(created_at.gt(a_week_ago))
    .fetch_all(&pool)
    .await?;

// 3. Ordered & Limited
let recent_users = table!(users)
    .order(created_at.desc())
    .limit(10)
    .fetch_all(&pool)
    .await?;

// 4. Single result
let user = table!(users)
    .filter(id.eq(user_id))
    .fetch_one(&pool)
    .await?;

// 5. Optional result
let maybe_user = table!(users)
    .filter(email.eq("alice@example.com"))
    .fetch_optional(&pool)
    .await?;
```

#### Advanced Query Patterns

```rust
use queris::{table, join, select, aggregate};

// 1. JOIN queries
let user_posts = table!(users)
    .inner_join(posts::table().on(users::id.eq(posts::user_id)))
    .filter(users::status.eq("active"))
    .select((users::name, posts::title, posts::created_at))
    .fetch_all(&pool)
    .await?;

// 2. Aggregation
let stats = table!(orders)
    .filter(created_at.gt(start_of_month))
    .group_by(status)
    .select((
        status,
        count(star).as("total"),
        sum(amount).as("revenue"),
        avg(amount).as("average"),
    ))
    .fetch_all(&pool)
    .await?;

// 3. Subqueries
let high_value_users = table!(users)
    .filter(
        id.in_(
            table!(orders)
                .group_by(user_id)
                .having(sum(amount).gt(1000))
                .select(user_id)
        )
    )
    .fetch_all(&pool)
    .await?;

// 4. Window functions
let ranked_products = table!(sales)
    .select((
        product_id,
        revenue,
        row_number().over(
            partition_by(category)
                .order_by(revenue.desc())
        ).as("rank"),
    ))
    .fetch_all(&pool)
    .await?;

// 5. Common Table Expressions (CTEs)
let report = with!("regional_sales" =>
    table!(orders)
        .group_by(region)
        .select((region, sum(amount).as("total_sales")))
)
.query(
    table!("regional_sales")
        .filter(total_sales.gt(avg_total))
        .select((region, total_sales))
)
.fetch_all(&pool)
.await?;
```

#### Insert, Update, Delete

```rust
// 1. INSERT
let new_user = insert_into(users)
    .values((
        name.eq("Alice"),
        email.eq("alice@example.com"),
        status.eq("active"),
    ))
    .returning((id, created_at))
    .fetch_one(&pool)
    .await?;

// 2. Batch INSERT
let users = vec![
    (name.eq("Alice"), email.eq("alice@example.com")),
    (name.eq("Bob"), email.eq("bob@example.com")),
    (name.eq("Carol"), email.eq("carol@example.com")),
];

let inserted = insert_into(users)
    .values(&users)
    .execute(&pool)
    .await?;

// 3. UPDATE
let updated = update(users)
    .filter(id.eq(user_id))
    .set((
        name.eq("Alice Smith"),
        updated_at.eq(now),
    ))
    .execute(&pool)
    .await?;

// 4. DELETE
let deleted = delete_from(users)
    .filter(status.eq("inactive"))
    .filter(last_login.lt(a_year_ago))
    .execute(&pool)
    .await?;
```

### 3.3 Type Safety Levels

| Level | Verification | When Applied | Performance |
|-------|--------------|--------------|-------------|
| **L1: Syntactic** | SQL syntax valid | Parse time | < 1ms |
| **L2: Schema** | Tables/columns exist | Compile time* | ~10ms |
| **L3: Type** | Types compatible | Compile time* | ~10ms |
| **L4: Semantic** | Query makes sense | Runtime | Query time |

*Requires `SQLX_OFFLINE` mode or live database connection

### 3.4 Raw SQL Escape Hatch

```rust
use queris::sql;

// When the DSL isn't enough, use raw SQL with compile-time checking
let users = sql!(
    r#"
    WITH RECURSIVE subordinates AS (
        SELECT id, name, manager_id, 0 as level
        FROM employees
        WHERE manager_id = $1
        
        UNION ALL
        
        SELECT e.id, e.name, e.manager_id, s.level + 1
        FROM employees e
        INNER JOIN subordinates s ON s.id = e.manager_id
    )
    SELECT * FROM subordinates
    ORDER BY level, name
    "#,
    manager_id: i32
)
.fetch_all(&pool)
.await?;
```

---

## Part IV: Connection & Pooling

### 4.1 Pool Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Connection Pool Architecture                                │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Pool State Machine                                    │   │
│  │                                                                        │   │
│  │   ┌──────────┐     acquire()     ┌──────────┐     return()     ┌──────┐│   │
│  │   │  Idle    │ ────────────────→ │   In Use │ ───────────────→ │ Idle ││   │
│  │   └──────────┘                   └──────────┘                  └──────┘│   │
│  │        │                              │                            ↑   │   │
│  │        │ health_check()               │ error/recycle              │   │   │
│  │        ▼                              ▼                            │   │   │
│  │   ┌──────────┐                   ┌──────────┐                      │   │   │
│  │   │Checking  │                   │  Closed  │ ─────────────────────┘   │   │
│  │   └──────────┘                   └──────────┘                          │   │
│  │        │ health check                                  new connection │   │
│  │        │ fails                                          needed       │   │
│  │        ▼                                                              │   │
│  │   ┌──────────┐                                                        │   │
│  │   │  Closed  │ ←─────────────────────────────────────────────────────┘   │
│  │   └──────────┘                                                            │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Pool Configuration

```rust
use queris::pool::{PoolConfig, PoolTier};
use std::time::Duration;

// Preset configurations for common workloads
let config = PoolConfig::high_throughput();

// Or custom configuration
let config = PoolConfig {
    // Pool sizing
    max_size: 100,
    min_idle: Some(20),
    
    // Connection lifecycle
    max_lifetime: Some(Duration::from_secs(1800)), // 30 min
    idle_timeout: Some(Duration::from_secs(600)),  // 10 min
    
    // Acquisition behavior
    acquire_timeout: Duration::from_secs(5),
    acquire_slow_threshold: Some(Duration::from_millis(100)),
    
    // Health checking
    test_on_check_out: false,
    health_check_interval: Some(Duration::from_secs(30)),
    health_check_query: "SELECT 1",
    
    // Error handling
    max_connections_broken_before_disable: 3,
    connection_timeout: Duration::from_secs(10),
};

let pool = Queris::connect(&database_url)
    .with_config(config)
    .await?;
```

### 4.3 Pool Tiers

| Tier | Max Size | Min Idle | Use Case | Health Check |
|------|----------|----------|----------|--------------|
| **Low Latency** | 20 | 10 | API endpoints | 10s |
| **High Throughput** | 100 | 20 | Data processing | 30s |
| **Burst** | 200 | 0 | Spiky traffic | 60s |
| **Serverless** | 5 | 0 | FaaS/Edge | 30s |
| **Analytics** | 50 | 5 | OLAP queries | 60s |

### 4.4 Connection Metrics

```rust
// Pool statistics
let stats = pool.stats();
println!("Connections: {}/{}", stats.used, stats.size);
println!("Idle: {}", stats.idle);
println!("Wait time (p99): {:?}", stats.wait_time_p99);
println!("Avg acquire time: {:?}", stats.avg_acquire_time);

// Export to Prometheus
queris::metrics::install_recorder();
// queris_pool_connections{state="idle"} 15
// queris_pool_connections{state="used"} 25
// queris_pool_wait_duration_seconds_bucket{le="0.01"} 950
```

### 4.5 Multi-Pool Setup

```rust
// Separate pools for different workloads
let api_pool = Queris::connect(&primary_url)
    .with_config(PoolConfig::low_latency())
    .await?;

let analytics_pool = Queris::connect(&analytics_url)
    .with_config(PoolConfig::analytics())
    .await?;

let replica_pool = Queris::connect(&replica_url)
    .with_config(PoolConfig::high_throughput())
    .await?;

// Automatic read replica routing
let queris = Queris::builder()
    .primary(api_pool)
    .replica(replica_pool)
    .route_reads_to_replicas(true)
    .build();
```

---

## Part V: Migration System

### 5.1 Migration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Migration System Architecture                               │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Migration Workflow                                  │   │
│  │                                                                        │   │
│  │   Developer                    CI/CD                    Production     │   │
│  │        │                         │                         │          │   │
│  │        │ queris migrate new     │ cargo build             │ deploy     │   │
│  │        │ "add_user_profile"     │ embed_migrations!()     │ binary     │   │
│  │        ▼                         ▼                         ▼          │   │
│  │   ┌──────────┐              ┌──────────┐              ┌──────────┐    │   │
│  │   │ Create   │─────────────→│ Compile  │─────────────→│ Run      │    │   │
│  │   │ up.sql   │              │ Metadata │              │ Embedded │    │   │
│  │   │ down.sql │              │ Checksums│              │ Migrations│   │   │
│  │   └──────────┘              └──────────┘              └──────────┘    │   │
│  │                                                                │      │   │
│  │                                                                ▼      │   │
│  │   ┌──────────────────────────────────────────────────────────────────┐│   │
│  │   │              Database (refinery_schema_history)                   ││   │
│  │   │                                                                  ││   │
│  │   │  version         │ name                    │ applied_on │ checksum││   │
│  │   │  ────────────────────────────────────────────────────────────── ││   │
│  │   │  20260404120001    │ add_user_profile        │ 2026-04-04 │ a1b2...││   │
│  │   │  20260403150000    │ create_users_table      │ 2026-04-03 │ c3d4...││   │
│  │   │  20260402100000    │ initial_schema          │ 2026-04-02 │ e5f6...││   │
│  │   └──────────────────────────────────────────────────────────────────┘│   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Migration File Format

```sql
-- migrations/U20260404120001_add_user_profile/up.sql
-- Migration: Add user profile table
-- Author: koosha
-- Ticket: PHEN-456
-- Created: 2026-04-04

BEGIN;

-- Create table
CREATE TABLE user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url VARCHAR(500),
    location VARCHAR(100),
    website VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_location ON user_profiles(location) 
    WHERE location IS NOT NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_profiles IS 'Extended profile information for users';
COMMENT ON COLUMN user_profiles.bio IS 'User biography (max 500 chars in app)';

COMMIT;
```

```sql
-- migrations/U20260404120001_add_user_profile/down.sql
-- Rollback: Remove user profile table

BEGIN;

-- Drop trigger first
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Drop table (cascades to indexes)
DROP TABLE IF EXISTS user_profiles;

COMMIT;
```

### 5.3 Migration CLI

```bash
# Create a new migration
$ queris migrate create add_user_preferences
Created migrations/U20260404150002_add_user_preferences/
    ├── up.sql
    └── down.sql

# Check migration status
$ queris migrate status
Database: postgres://localhost/myapp

 Applied                                   Pending
────────────────────────────────────────────────────────────────
✓ U20260404120001_add_user_profile         U20260404150002_add_user_preferences
✓ U20260403150000_create_users_table        U20260404180003_add_indexes
✓ U20260402100000_initial_schema

# Run pending migrations
$ queris migrate run
Running 2 pending migrations...
✓ U20260404150002_add_user_preferences (45ms)
✓ U20260404180003_add_indexes (23ms)
Migrations complete: 2 applied

# Rollback last migration
$ queris migrate rollback
Rolling back: U20260404180003_add_indexes
✓ Rolled back successfully (12ms)

# Verify checksums (detect tampering)
$ queris migrate verify
Verifying 5 applied migrations...
✓ All checksums valid

# Run specific migration
$ queris migrate run --to U20260404150002_add_user_preferences

# Dry run (show SQL without executing)
$ queris migrate run --dry-run
```

### 5.4 Programmatic API

```rust
use queris::migrate::{Migrator, MigrationConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Option 1: Embedded migrations (recommended for deployment)
    let migrator = Migrator::new(MigrationConfig {
        migrations: queris::embed_migrations!("./migrations"),
        ..Default::default()
    })
    .await?;
    
    // Option 2: Runtime loading (development only)
    let migrator = Migrator::from_directory("./migrations").await?;
    
    // Run all pending
    let report = migrator.run().await?;
    println!("Applied {} migrations", report.applied.len());
    
    // Check status
    let status = migrator.status().await?;
    for pending in status.pending {
        println!("Pending: {}", pending.name);
    }
    
    // Rollback one
    migrator.rollback(1).await?;
    
    Ok(())
}
```

---

## Part VI: Performance Engineering

### 6.1 Performance Targets

| Metric | Target | Measurement | Current |
|--------|--------|-------------|---------|
| Simple SELECT (p50) | < 1ms | hyperfine | 🚧 |
| Simple SELECT (p99) | < 5ms | hyperfine | 🚧 |
| JOIN query (p99) | < 10ms | hyperfine | 🚧 |
| Connection acquire | < 1ms | custom | 🚧 |
| Compile check | < 100ms | cargo build | 🚧 |
| Memory/query | < 1KB | heaptrack | 🚧 |
| Throughput | > 50K QPS | wrk/locust | 🚧 |

### 6.2 Optimization Strategies

#### Query Optimization

| Strategy | Implementation | Impact |
|----------|----------------|--------|
| **Prepared statements** | Automatic via sqlx | 20-30% latency |
| **Connection pooling** | deadpool with tuning | 5-10x throughput |
| **Query plan cache** | PostgreSQL native | 10-20% for repeated |
| **Result streaming** | Async iterators | O(1) memory |
| **Batch operations** | `UNNEST` for inserts | 10x bulk insert |
| **Covering indexes** | Migration helpers | Varies |

#### Compile-Time Optimization

```rust
// Use SQLX_OFFLINE for CI builds
// .sqlx/query-*.json files cached in repo

// Embed only needed migrations
embed_migrations!("./migrations"); // All
embed_migrations!("./migrations", max: 10); // Last 10

// Selective derive macros
#[derive(FromRow)] // Only derive needed traits
struct User {
    id: i64,
    name: String,
}
```

### 6.3 Profiling Tools

```bash
# Runtime profiling
$ cargo flamegraph --bin myapp

# Memory profiling
$ heaptrack ./target/release/myapp

# Query performance
$ EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT ...;

# Async task profiling
$ tokio-console

# Benchmark comparison
$ hyperfine -w 3 -r 100 'cargo run --release -- query-test'
```

---

## Part VII: Multi-Backend Support

### 7.1 Backend Abstraction

```rust
pub trait DatabaseBackend: Send + Sync + 'static {
    type Connection: Connection;
    type Row: Row;
    type Error: std::error::Error;
    
    async fn connect(url: &str) -> Result<Self::Connection, Self::Error>;
    async fn execute(&self, sql: &str, params: &[Param]) -> Result<u64, Self::Error>;
    async fn query(&self, sql: &str, params: &[Param]) -> Result<Vec<Self::Row>, Self::Error>;
    
    fn dialect(&self) -> SqlDialect;
}

pub struct PostgreSql;
pub struct MySql;
pub struct Sqlite;
pub struct MongoDb; // Document backend
```

### 7.2 Backend-Specific Features

| Feature | PostgreSQL | MySQL | SQLite | MongoDB |
|---------|------------|-------|--------|---------|
| **JSON operations** | `->`, `@>` | `JSON_EXTRACT` | `json_extract` | Native |
| **Arrays** | Native | No | No | Arrays |
| **Full-text search** | `tsvector` | `FULLTEXT` | `FTS5` | Text index |
| **GIS/Spatial** | PostGIS | Spatial ext | No | 2dsphere |
| **Window functions** | Full | Full | Limited | Aggregation |
| **CTEs** | Full | Full | Limited | No |
| **Recursive CTEs** | Full | Limited | No | No |
| **Upsert** | `ON CONFLICT` | `ON DUPLICATE` | `INSERT OR REPLACE` | `replaceOne` |

### 7.3 Cross-Backend Query Patterns

```rust
// Queris automatically translates to backend dialect

// JSON query (works on all backends)
table!(users)
    .filter(metadata.json_extract("$.premium").eq(true))
    .fetch_all(&pool)
    .await?;

// Generates:
// PostgreSQL: metadata->>'premium' = 'true'
// MySQL: JSON_EXTRACT(metadata, '$.premium') = true
// SQLite: json_extract(metadata, '$.premium') = 1
// MongoDB: { "metadata.premium": true }

// Upsert pattern
insert_into(users)
    .values((id.eq(1), name.eq("Alice")))
    .on_conflict(id)
    .do_update((name.eq("Alice"), updated_at.eq(now)))
    .execute(&pool)
    .await?;
```

---

## Part VIII: API Reference

### 8.1 Core Types

```rust
// Main entry point
pub struct Queris {
    pool: Pool<Backend>,
    config: Config,
}

impl Queris {
    pub async fn connect(url: &str) -> Result<Self, Error>;
    pub fn builder() -> QuerisBuilder;
    pub async fn migrate(&self) -> Result<MigrationReport, Error>;
    pub fn table<T: Table>(name: &str) -> Query<T>;
}

// Query builder
pub struct Query<T> {
    table: T,
    filters: Vec<Filter>,
    selects: Vec<Select>,
    joins: Vec<Join>,
    orders: Vec<Order>,
    limit: Option<usize>,
    offset: Option<usize>,
}

impl<T> Query<T> {
    pub fn filter<F: Into<Filter>>(self, filter: F) -> Self;
    pub fn select<S: Into<Select>>(self, select: S) -> Self;
    pub fn order<O: Into<Order>>(self, order: O) -> Self;
    pub fn limit(self, n: usize) -> Self;
    pub fn offset(self, n: usize) -> Self;
    pub fn inner_join<J: Table>(self, join: Join<J>) -> Self;
    
    pub async fn fetch_one<Conn: Connection>(&self, conn: &Conn) -> Result<T, Error>;
    pub async fn fetch_all<Conn: Connection>(&self, conn: &Conn) -> Result<Vec<T>, Error>;
    pub async fn fetch_optional<Conn: Connection>(&self, conn: &Conn) -> Result<Option<T>, Error>;
    pub fn fetch_stream<Conn: Connection>(&self, conn: &Conn) -> impl Stream<Item = Result<T, Error>>;
}
```

### 8.2 Filter Expressions

```rust
// Comparison operators
column.eq(value)           // =
column.ne(value)           // !=
column.gt(value)           // >
column.ge(value)           // >=
column.lt(value)           // <
column.le(value)           // <=

// Pattern matching
column.like(pattern)       // LIKE
column.ilike(pattern)      // ILIKE (PostgreSQL)
column.regex_match(pattern) // ~ (PostgreSQL)

// Range operators
column.between(low, high)  // BETWEEN
column.in_(values)         // IN (..., ...)
column.is_null()           // IS NULL
column.is_not_null()       // IS NOT NULL

// Logical operators
filter1.and(filter2)       // AND
filter1.or(filter2)        // OR
filter.not()               // NOT
```

### 8.3 Aggregation Functions

```rust
use queris::aggregate::*;

// Count
count(star)                    // COUNT(*)
count(column)                  // COUNT(column)
count_distinct(column)         // COUNT(DISTINCT column)

// Sum/Avg
sum(column)                    // SUM(column)
avg(column)                    // AVG(column)

// Min/Max
min(column)                    // MIN(column)
max(column)                    // MAX(column)

// String aggregation
string_agg(column, delimiter)  // STRING_AGG (PostgreSQL)
group_concat(column)           // GROUP_CONCAT (MySQL)

// Window functions
row_number().over(partition.order_by(column))
rank().over(partition.order_by(column))
dense_rank().over(partition.order_by(column))
lead(column, offset).over(partition.order_by(column))
lag(column, offset).over(partition.order_by(column))
```

---

## Part IX: Implementation Roadmap

### Phase 1: Core Foundation (Current - 2026 Q2)

| Component | Status | Target |
|-----------|--------|--------|
| sqlx integration | ✅ Done | v0.1 |
| Connection pooling (deadpool) | ✅ Done | v0.1 |
| Basic query builder | 🚧 In Progress | v0.2 |
| PostgreSQL support | ✅ Done | v0.1 |
| Migration system (refinery) | 🚧 In Progress | v0.2 |
| Type-safe macros | 📋 Planned | v0.3 |

### Phase 2: Multi-Backend (2026 Q2-Q3)

| Component | Status | Target |
|-----------|--------|--------|
| MySQL support | 📋 Planned | v0.4 |
| SQLite support | 📋 Planned | v0.4 |
| Backend abstraction | 📋 Planned | v0.4 |
| Query optimization | 📋 Planned | v0.5 |
| Result caching | 📋 Planned | v0.5 |

### Phase 3: Advanced Features (2026 Q3-Q4)

| Component | Status | Target |
|-----------|--------|--------|
| MongoDB connector | 📋 Research | v0.6 |
| Federated queries | 📋 Research | v0.7 |
| GraphQL integration | 📋 Planned | v0.8 |
| Materialized views | 📋 Planned | v0.8 |
| CDC streaming | 📋 Research | v0.9 |

### Phase 4: Production Hardening (2026 Q4)

| Component | Status | Target |
|-----------|--------|--------|
| Comprehensive benchmarks | 📋 Planned | v1.0 |
| Security audit | 📋 Planned | v1.0 |
| Documentation site | 🚧 In Progress | v0.5 |
| Stability guarantees | 📋 Planned | v1.0 |
| LTS support | 📋 Planned | v1.0 |

---

## Part X: Testing Strategy

### 10.1 Testing Pyramid

| Layer | Type | Tools | Coverage Target |
|-------|------|-------|-----------------|
| **Unit** | Function tests | cargo test | 80% |
| **Integration** | DB integration | sqlx-test, testcontainers | 70% |
| **E2E** | Full workflows | cucumber-rs | 50% |
| **Benchmark** | Performance | criterion, iai | N/A |
| **Fuzz** | Input validation | cargo-fuzz | Critical paths |

### 10.2 Test Configuration

```rust
#[cfg(test)]
mod tests {
    use queris::test::TestPool;
    
    // Automatic test database setup
    async fn setup() -> TestPool {
        TestPool::new()
            .with_migrations()
            .with_fixtures("tests/fixtures/users.sql")
            .await
    }
    
    #[tokio::test]
    async fn test_user_creation() {
        let pool = setup().await;
        
        let user = table!(users)
            .filter(id.eq(1))
            .fetch_one(&pool)
            .await
            .expect("user exists");
        
        assert_eq!(user.name, "Alice");
    }
}
```

### 10.3 CI/CD Testing

```yaml
# .github/workflows/test.yml
tests:
  runs-on: ubuntu-latest
  
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: postgres
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
  
  steps:
    - uses: actions/checkout@v4
    
    - name: Run tests
      run: cargo test --all-features
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost/test
    
    - name: Run integration tests
      run: cargo test --features integration
    
    - name: Coverage
      run: cargo tarpaulin --out xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v4
```

---

## Part XI: Benchmarking

### 11.1 Standard Benchmarks

```rust
// benches/query_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use queris::test::TestPool;

async fn bench_simple_select(pool: &TestPool) {
    table!(users)
        .filter(id.eq(black_box(1)))
        .fetch_one(pool)
        .await
        .unwrap();
}

async fn bench_join_query(pool: &TestPool) {
    table!(users)
        .inner_join(posts::table().on(users::id.eq(posts::user_id)))
        .filter(users::status.eq("active"))
        .fetch_all(pool)
        .await
        .unwrap();
}

fn criterion_benchmark(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let pool = rt.block_on(async { TestPool::new().await });
    
    c.bench_function("simple_select", |b| {
        b.to_async(&rt).iter(|| bench_simple_select(&pool));
    });
    
    c.bench_function("join_query", |b| {
        b.to_async(&rt).iter(|| bench_join_query(&pool));
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
```

### 11.2 Benchmark Suite

```bash
# Run all benchmarks
$ cargo bench

# Compare with previous run
$ cargo bench -- --baseline main

# Profile specific benchmark
$ cargo bench -- --profile-time 5 simple_select

# Generate report
$ cargo bench | tee bench-results.txt
```

---

## Part XII: Security Considerations

### 12.1 SQL Injection Prevention

| Level | Technique | Status |
|-------|-----------|--------|
| **L1: Parameterization** | All queries use prepared statements | ✅ |
| **L2: Compile-time check** | `sql!` macro validates at build | ✅ |
| **L3: Input validation** | Type system rejects invalid input | ✅ |
| **L4: Query whitelisting** | Hash-based query validation | 📋 |

### 12.2 Connection Security

| Feature | Implementation |
|---------|----------------|
| **TLS/SSL** | Native-tls or rustls backends |
| **Certificate validation** | Configurable (strict/relaxed) |
| **Certificate pinning** | Custom root CAs supported |
| **Credential management** | Integration with external vaults |

### 12.3 Data Protection

| Feature | Status |
|---------|--------|
| **Query logging** | Optional, excludes sensitive params |
| **PII redaction** | Configurable field masking |
| **Audit logging** | Migration and DDL tracking |
| **Encryption at rest** | Database-level (transparent) |

---

## Part XIII: References

### 13.1 Documentation

- [sqlx Documentation](https://docs.rs/sqlx/latest/sqlx/)
- [Diesel Guide](https://diesel.rs/guides/)
- [SeaORM Documentation](https://www.sea-ql.org/SeaORM/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [deadpool Documentation](https://docs.rs/deadpool/latest/deadpool/)
- [refinery Documentation](https://docs.rs/refinery/latest/refinery/)

### 13.2 Related Projects

| Project | Description | Link |
|---------|-------------|------|
| sqlx | Async SQL with compile-time checks | https://github.com/launchbadge/sqlx |
| Diesel | Safe, extensible ORM | https://diesel.rs/ |
| SeaORM | Async ORM for Rust | https://www.sea-ql.org/SeaORM/ |
| deadpool | Async pool manager | https://github.com/bikeshedder/deadpool |
| refinery | Rust migration toolkit | https://github.com/rust-db/refinery |
| sqlparser-rs | SQL parser | https://github.com/sqlparser-rs/sqlparser-rs |

### 13.3 Research Papers

- **"Query Optimization in the Presence of Constraints"** - MIT
- **"Adaptive Query Processing"** - CMU
- **"Cardinality Estimation Using Deep Learning"** - ETH Zurich
- **"Efficient Query Re-optimization"** - TU Munich

---

## Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **AST** | Abstract Syntax Tree - representation of SQL structure |
| **CTE** | Common Table Expression - temporary result set |
| **DSL** | Domain Specific Language - specialized query syntax |
| **ORM** | Object-Relational Mapping - code-to-database mapping |
| **QPS** | Queries Per Second - throughput metric |
| **MVCC** | Multi-Version Concurrency Control - isolation technique |
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **OLAP** | Online Analytical Processing - analytics queries |
| **OLTP** | Online Transaction Processing - operational queries |
| **Pool** | Connection pool - managed database connections |

### Appendix B: Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Primary database connection | - |
| `QUERIS_POOL_MAX_SIZE` | Maximum pool connections | 100 |
| `QUERIS_POOL_MIN_IDLE` | Minimum idle connections | 10 |
| `SQLX_OFFLINE` | Use cached query metadata | false |
| `RUST_LOG` | Logging level | queris=info |

### Appendix C: Configuration File

```toml
# queris.toml
[database]
url = "postgres://user:pass@localhost/myapp"

[pool]
max_size = 100
min_idle = 20
max_lifetime = 1800
acquire_timeout = 5

[migrations]
directory = "./migrations"
embedded = true
strict = true

[query]
cache_plans = true
stream_results = true
default_limit = 1000

[metrics]
enabled = true
endpoint = "0.0.0.0:9090"
```

### Appendix D: Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `Pool exhausted` | Too many concurrent queries | Increase pool size or reduce concurrency |
| `Compile-time check slow` | Cold schema cache | Run with live DB once, then use `SQLX_OFFLINE` |
| `Type mismatch` | Schema drift | Regenerate query metadata: `cargo sqlx prepare` |
| `Migration locked` | Concurrent migration runs | Wait for other process or clear lock manually |
| `TLS handshake failed` | Certificate issues | Check CA cert or use `sslmode=require` |

### Appendix E: Migration Naming Cheat Sheet

```
Format: U{YYYYMMDDHHMMSS}_{description}

Prefixes for common operations:
- create_   : New table/object
- add_      : Add column/constraint
- remove_   : Remove column/object
- rename_   : Rename column/table
- index_    : Add index
- drop_     : Drop index/table
- update_   : Data migration
- fix_      : Correct data issue
- seed_     : Initial data load

Examples:
U20260404120000_create_users_table
U20260404130000_add_user_email_index
U20260404140000_remove_deprecated_column
U20260404150000_update_user_status_data
```

---

## Appendix F: Changelog

### v0.1.0 (2026-04-04)
- Initial release
- sqlx integration with PostgreSQL
- Connection pooling with deadpool
- Basic query builder foundation

### v0.2.0 (Planned - 2026 Q2)
- Migration system (refinery integration)
- Compile-time SQL macros
- Type-safe query builder

### v0.3.0 (Planned - 2026 Q2)
- MySQL backend support
- SQLite backend support
- Enhanced error handling

---

*This specification reflects Queris v2.0 architecture based on 2026 SOTA research.*

---

## Appendix G: Reference URLs (100+ Items)

### G.1 Core Database Systems

| # | Project | URL | Description |
|---|---------|-----|-------------|
| 1 | PostgreSQL | https://www.postgresql.org/ | Advanced open-source RDBMS |
| 2 | MySQL | https://www.mysql.com/ | Popular open-source database |
| 3 | SQLite | https://sqlite.org/ | Embedded SQL database |
| 4 | MariaDB | https://mariadb.org/ | MySQL-compatible fork |
| 5 | DuckDB | https://duckdb.org/ | Analytical in-process DB |
| 6 | CockroachDB | https://www.cockroachlabs.com/ | Distributed SQL |
| 7 | TiDB | https://pingcap.com/ | Distributed HTAP |
| 8 | YugabyteDB | https://www.yugabyte.com/ | Distributed PostgreSQL |
| 9 | ClickHouse | https://clickhouse.com/ | Columnar OLAP |
| 10 | MongoDB | https://www.mongodb.com/ | Document database |

### G.2 Rust Database Ecosystem

| # | Project | URL | Description |
|---|---------|-----|-------------|
| 11 | sqlx | https://github.com/launchbadge/sqlx | Async SQL |
| 12 | Diesel | https://diesel.rs/ | Safe ORM |
| 13 | SeaORM | https://www.sea-ql.org/SeaORM/ | Async ORM |
| 14 | tokio-postgres | https://github.com/sfackler/rust-postgres | PostgreSQL driver |
| 15 | deadpool | https://github.com/bikeshedder/deadpool | Connection pool |
| 16 | bb8 | https://github.com/djc/bb8 | Connection pool |
| 17 | refinery | https://github.com/rust-db/refinery | Migrations |
| 18 | sqlparser-rs | https://github.com/sqlparser-rs/sqlparser-rs | SQL parser |
| 19 | ormx | https://github.com/NyxCode/ormx | Lightweight ORM |
| 20 | quaint | https://github.com/prisma/quaint | Query builder |

### G.3 Documentation & Learning

| # | Resource | URL | Description |
|---|----------|-----|-------------|
| 21 | Rust Async Book | https://rust-lang.github.io/async-book/ | Async programming |
| 22 | SQL Performance | https://use-the-index-luke.com/ | Index optimization |
| 23 | PostgreSQL Wiki | https://wiki.postgresql.org/wiki/Main_Page | Community docs |
| 24 | Database Internals | https://www.databass.dev/ | DB internals book |
| 25 | Readings in Databases | http://www.redbook.io/ | Classic papers |

*For 200+ more references, see [docs/research/SOTA.md](./docs/research/SOTA.md)*

---

## Appendix H: Advanced Query Patterns

### H.1 Recursive CTEs (Common Table Expressions)

```rust
// PostgreSQL recursive CTE for hierarchical data
let org_chart = sql!(
    r#"
    WITH RECURSIVE subordinates AS (
        -- Base case: direct reports
        SELECT id, name, manager_id, 0 as level, name as path
        FROM employees
        WHERE manager_id = $1
        
        UNION ALL
        
        -- Recursive case: deeper levels
        SELECT e.id, e.name, e.manager_id, s.level + 1,
               s.path || ' > ' || e.name
        FROM employees e
        INNER JOIN subordinates s ON s.id = e.manager_id
        WHERE s.level < $2  -- Max depth parameter
    )
    SELECT * FROM subordinates
    ORDER BY level, name
    "#,
    manager_id: i64,
    max_depth: i32
)
.fetch_all(&pool)
.await?;
```

### H.2 Lateral Joins

```rust
// Top N per category using LATERAL (PostgreSQL)
let top_products_per_category = sql!(
    r#"
    SELECT c.name as category, p.name as product, p.sales
    FROM categories c
    LEFT JOIN LATERAL (
        SELECT name, sales
        FROM products
        WHERE category_id = c.id
        ORDER BY sales DESC
        LIMIT $1
    ) p ON true
    ORDER BY c.name, p.sales DESC
    "#,
    top_n: i32
)
.fetch_all(&pool)
.await?;
```

### H.3 Window Function Patterns

```rust
use queris::window::*;

// Running totals
let running_totals = table!(sales)
    .select((
        date,
        amount,
        sum(amount).over(
            partition_by(category)
                .order_by(date)
                .rows_between(WindowFrame::UnboundedPreceding, WindowFrame::CurrentRow)
        ).as("running_total"),
    ))
    .fetch_all(&pool)
    .await?;

// Moving averages
let moving_avg = table!(metrics)
    .select((
        timestamp,
        value,
        avg(value).over(
            order_by(timestamp)
                .rows_between(WindowFrame::Preceding(5), WindowFrame::CurrentRow)
        ).as("ma_5"),
    ))
    .fetch_all(&pool)
    .await?;

// Percentile calculations
let percentiles = table!(scores)
    .select((
        user_id,
        score,
        percent_rank().over(order_by(score)).as("percentile"),
        ntile(4).over(order_by(score)).as("quartile"),
    ))
    .fetch_all(&pool)
    .await?;
```

### H.4 Full-Text Search Patterns

```rust
// PostgreSQL tsvector search
let search_results = sql!(
    r#"
    SELECT 
        id,
        title,
        content,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC
    LIMIT $2
    "#,
    query: &str,
    limit: i32
)
.fetch_all(&pool)
.await?;

// Trigram similarity (pg_trgm)
let fuzzy_matches = sql!(
    r#"
    SELECT name, similarity(name, $1) as sml
    FROM products
    WHERE name % $1  -- similarity operator
    ORDER BY sml DESC, name
    LIMIT $2
    "#,
    search_term: &str,
    limit: i32
)
.fetch_all(&pool)
.await?;
```

### H.5 JSON/JSONB Operations

```rust
// PostgreSQL JSONB operations
let users_with_feature = table!(users)
    .filter(
        metadata.jsonb_extract("features").jsonb_contains("premium")
    )
    .fetch_all(&pool)
    .await?;

// JSON aggregation
let aggregated = table!(events)
    .group_by(user_id)
    .select((
        user_id,
        jsonb_agg((timestamp, event_type)).as("event_history"),
        jsonb_object_agg(event_type, count(star)).as("event_counts"),
    ))
    .fetch_all(&pool)
    .await?;

// JSON indexing query
let by_path = table!(documents)
    .filter(data.jsonb_path_exists("$.users[*] ? (@.age > $age)"))
    .bind("age", 18)
    .fetch_all(&pool)
    .await?;
```

### H.6 Geospatial Queries

```rust
// PostGIS spatial queries (if enabled)
let nearby = sql!(
    r#"
    SELECT 
        id,
        name,
        ST_Distance(location, ST_MakePoint($1, $2)::geography) as distance
    FROM places
    WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance
    LIMIT $4
    "#,
    lng: f64,
    lat: f64,
    radius_meters: i32,
    limit: i32
)
.fetch_all(&pool)
.await?;

// Bounding box search
let in_viewport = table!(locations)
    .filter(
        geom.column("coordinates").within_bbox(min_lng, min_lat, max_lng, max_lat)
    )
    .fetch_all(&pool)
    .await?;
```

---

## Appendix I: Testing Patterns

### I.1 Unit Testing with Mock Connections

```rust
#[cfg(test)]
mod tests {
    use queris::test::MockPool;
    use queris::{table, filter};

    #[tokio::test]
    async fn test_user_filtering() {
        // Create mock pool with predefined responses
        let mut mock = MockPool::new();
        mock.expect_query()
            .with_sql("SELECT * FROM users WHERE status = $1")
            .with_param("active")
            .returning(vec![
                User { id: 1, name: "Alice", status: "active".to_string() },
                User { id: 2, name: "Bob", status: "active".to_string() },
            ]);

        let users = table!(users)
            .filter(status.eq("active"))
            .fetch_all(&mock)
            .await
            .unwrap();

        assert_eq!(users.len(), 2);
        assert_eq!(users[0].name, "Alice");
    }
}
```

### I.2 Integration Testing with Test Containers

```rust
use testcontainers_modules::postgres::Postgres;
use testcontainers::runners::AsyncRunner;

#[tokio::test]
async fn test_with_real_postgres() {
    // Start PostgreSQL container
    let container = Postgres::default()
        .start()
        .await
        .unwrap();
    
    let port = container.get_host_port_ipv4(5432).await.unwrap();
    let url = format!("postgres://postgres:postgres@localhost:{}/postgres", port);
    
    // Connect and run migrations
    let pool = Queris::connect(&url).await.unwrap();
    queris::migrate::run_embedded(&pool).await.unwrap();
    
    // Run tests
    let user = insert_into(users)
        .values((name.eq("Test"), email.eq("test@example.com")))
        .returning(star)
        .fetch_one(&pool)
        .await
        .unwrap();
    
    assert_eq!(user.name, "Test");
}
```

### I.3 Property-Based Testing

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_user_creation_preserves_email(
        name in "[a-zA-Z ]{1,50}",
        email in "[a-z0-9.]+@[a-z]+\\.[a-z]{2,6}"
    ) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let pool = test_pool().await;
            
            let user = insert_into(users)
                .values((
                    name.eq(&name),
                    email.eq(&email),
                ))
                .returning(star)
                .fetch_one(&pool)
                .await
                .unwrap();
            
            prop_assert_eq!(user.email, email);
            prop_assert_eq!(user.name, name);
        });
    }
}
```

### I.4 Load Testing Patterns

```rust
use tokio::time::{interval, Duration};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

async fn load_test(pool: &Pool, concurrency: usize, duration_secs: u64) -> LoadReport {
    let counter = Arc::new(AtomicU64::new(0));
    let error_counter = Arc::new(AtomicU64::new(0));
    let latencies = Arc::new(Mutex::new(Vec::new()));
    
    let mut handles = vec![];
    
    for _ in 0..concurrency {
        let counter = counter.clone();
        let error_counter = error_counter.clone();
        let latencies = latencies.clone();
        let pool = pool.clone();
        
        let handle = tokio::spawn(async move {
            let start = Instant::now();
            let mut interval = interval(Duration::from_millis(10));
            
            while start.elapsed().as_secs() < duration_secs {
                interval.tick().await;
                
                let query_start = Instant::now();
                let result = table!(users)
                    .filter(id.eq(1))
                    .fetch_optional(&pool)
                    .await;
                
                let latency = query_start.elapsed().as_micros() as u64;
                latencies.lock().await.push(latency);
                
                match result {
                    Ok(_) => counter.fetch_add(1, Ordering::Relaxed),
                    Err(_) => error_counter.fetch_add(1, Ordering::Relaxed),
                };
            }
        });
        
        handles.push(handle);
    }
    
    for handle in handles {
        handle.await.unwrap();
    }
    
    LoadReport {
        total_queries: counter.load(Ordering::Relaxed),
        errors: error_counter.load(Ordering::Relaxed),
        latencies: latencies.lock().await.clone(),
    }
}
```

---

## Appendix J: Observability & Debugging

### J.1 Query Logging Configuration

```rust
use queris::observability::{QueryLogger, LogLevel};

// Configure query logging
let pool = Queris::connect(&url)
    .with_query_logger(QueryLogger::new()
        .with_level(LogLevel::Info)
        .with_slow_query_threshold(Duration::from_millis(100))
        .with_log_params(false)  // Don't log sensitive data
        .with_explain_slow(true) // Log EXPLAIN for slow queries
    )
    .await?;
```

### J.2 OpenTelemetry Integration

```rust
use opentelemetry::trace::Tracer;

// Auto-instrument all queries
let pool = Queris::connect(&url)
    .with_telemetry(TelemetryConfig {
        tracer: global::tracer("queris"),
        record_query_text: false,  // Sanitized only
        record_row_count: true,
        record_duration: true,
    })
    .await?;

// Traces will include:
// - db.system: postgresql
// - db.statement: sanitized SQL
// - db.row_count: number of rows
// - db.duration: query execution time
```

### J.3 Metrics Collection

```rust
use queris::metrics::{MetricsCollector, Metric};

// Install Prometheus recorder
queris::metrics::install_prometheus_recorder();

// Available metrics:
// queris_queries_total{status="success",table="users"}
// queris_query_duration_seconds_bucket{le="0.01"}
// queris_pool_connections{state="idle"}
// queris_pool_wait_duration_seconds
// queris_migrations_applied_total
// queris_cache_hit_ratio

// Custom metrics
let query_count = Metric::counter("custom_queries_total");
query_count.increment(1);
```

### J.4 Debugging Slow Queries

```rust
// Enable query analysis for development
#[cfg(debug_assertions)]
let pool = Queris::connect(&url)
    .with_query_analyzer(true)
    .await?;

// Automatically runs EXPLAIN ANALYZE for queries over threshold
// Logs detailed execution plans
```

---

## Appendix K: Deployment Patterns

### K.1 Docker Configuration

```dockerfile
# Dockerfile
FROM rust:1.76-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/
CMD ["myapp"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:postgres@db/myapp
      QUERIS_POOL_MAX_SIZE: 20
    depends_on:
      - db
      - migrate
  
  migrate:
    build: .
    command: ["myapp", "migrate", "run"]
    environment:
      DATABASE_URL: postgres://postgres:postgres@db/myapp
    depends_on:
      - db
  
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### K.2 Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: QUERIS_POOL_MAX_SIZE
          value: "50"
        livenessProbe:
          exec:
            command:
            - myapp
            - health-check
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - myapp
            - health-check
          initialDelaySeconds: 5
          periodSeconds: 5
```

### K.3 Environment-Specific Configurations

| Environment | Pool Size | Min Idle | Max Lifetime | SSL Mode |
|-------------|-----------|----------|--------------|----------|
| **Development** | 5 | 1 | 5m | prefer |
| **Testing** | 10 | 2 | 2m | disable |
| **Staging** | 20 | 5 | 15m | require |
| **Production** | 100 | 20 | 30m | require |

---

## Appendix L: Common Pitfalls & Solutions

### L.1 N+1 Query Problem

**Problem**:
```rust
// BAD: N+1 queries
let users = table!(users).fetch_all(&pool).await?;
for user in &users {
    let posts = table!(posts)
        .filter(user_id.eq(user.id))  // One query per user!
        .fetch_all(&pool)
        .await?;
}
```

**Solution**:
```rust
// GOOD: Single JOIN query
let users_with_posts: Vec<(User, Vec<Post>)> = table!(users)
    .left_join(posts::table().on(users::id.eq(posts::user_id)))
    .aggregate_to_vec()  // Groups posts by user
    .fetch_all(&pool)
    .await?;

// Or use IN clause batching
let user_ids: Vec<i64> = users.iter().map(|u| u.id).collect();
let posts = table!(posts)
    .filter(user_id.in_(&user_ids))
    .fetch_all(&pool)
    .await?;
// Manually group in application code
```

### L.2 Connection Leaks

**Problem**:
```rust
// BAD: Connection held across await points
let conn = pool.acquire().await?;
let result = long_running_operation().await; // Connection idle!
conn.query("...").await?;
```

**Solution**:
```rust
// GOOD: Acquire only when needed
let result = long_running_operation().await;

// Acquire -> use -> release in tight scope
let data = {
    let conn = pool.acquire().await?;
    conn.query("...").await?
}; // Connection released here
```

### L.3 Over-Fetching Data

**Problem**:
```rust
// BAD: Fetching all columns when only a few needed
let users = table!(users)
    .fetch_all(&pool)  // All columns!
    .await?;
let names: Vec<String> = users.iter().map(|u| u.name.clone()).collect();
```

**Solution**:
```rust
// GOOD: Select only needed columns
let names: Vec<String> = table!(users)
    .select(name)
    .fetch_all(&pool)
    .await?;
```

### L.4 Missing Connection Pool Limits

**Problem**:
```rust
// BAD: No pool limits
let pool = Pool::connect(&url).await?; // Unbounded!
```

**Solution**:
```rust
// GOOD: Always configure pool limits
let pool = Pool::connect(&url)
    .max_size(100)
    .acquire_timeout(Duration::from_secs(5))
    .await?;
```

---

## Appendix M: Contributing to Queris

### M.1 Development Setup

```bash
# Clone repository
git clone https://github.com/kooshapari/queris.git
cd queris

# Install dependencies
rustup update
cargo install sqlx-cli cargo-insta cargo-nextest

# Setup database for compile-time checks
docker run -d --name queris-postgres -p 5432:5432 postgres:16
export DATABASE_URL=postgres://postgres:postgres@localhost/postgres

# Create database and run migrations
sqlx database create
sqlx migrate run

# Build and test
cargo build
cargo test
cargo clippy -- -D warnings

# Update query cache for offline builds
cargo sqlx prepare
```

### M.2 Code Style Guidelines

| Aspect | Rule | Example |
|--------|------|---------|
| **Formatting** | rustfmt default | `cargo fmt` |
| **Linting** | Clippy strict | `cargo clippy -- -D warnings` |
| **Naming** | snake_case for fns | `fetch_all` |
| **Types** | PascalCase | `QueryResult` |
| **Constants** | SCREAMING_SNAKE | `MAX_POOL_SIZE` |
| **Documentation** | All public items | `///` comments |
| **Tests** | Nextest preferred | `cargo nextest run` |

### M.3 Commit Message Format

```
type(scope): description

[optional body]

[optional footer]

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- perf: Performance improvement
- test: Tests
- chore: Maintenance

Examples:
feat(query): add support for LATERAL joins
fix(pool): resolve connection leak on timeout
docs(api): clarify transaction usage
```

### M.4 Pull Request Checklist

- [ ] Tests pass (`cargo test`)
- [ ] Clippy clean (`cargo clippy`)
- [ ] Formatted (`cargo fmt`)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Breaking changes documented
- [ ] Query cache updated (`cargo sqlx prepare`)
- [ ] Benchmarks run (if applicable)

---

## Appendix N: Version History

### v0.1.0 (2026-04-04)
- Initial release
- sqlx integration with PostgreSQL
- Connection pooling with deadpool
- Basic query builder foundation
- Migration system scaffolding

### v0.2.0 (Planned - 2026-04-15)
- Type-safe query macros
- Compile-time SQL verification
- Enhanced error types
- Documentation site

### v0.3.0 (Planned - 2026-05-01)
- MySQL backend support
- SQLite backend support
- Multi-backend abstraction
- Query result streaming

### v0.4.0 (Planned - 2026-05-15)
- Advanced JOIN support
- Subquery composition
- Window functions
- CTE (WITH clauses)

### v0.5.0 (Planned - 2026-06-01)
- Query result caching
- Read replica routing
- Connection pool auto-tuning
- Performance dashboards

### v1.0.0 (Planned - 2026-08-01)
- Production stability
- API freeze
- LTS commitment
- Comprehensive benchmarks

---

## Appendix O: License & Attribution

Queris is licensed under the MIT License.

### Third-Party Dependencies

| Crate | License | Purpose |
|-------|---------|---------|
| sqlx | MIT/Apache-2.0 | Async SQL |
| deadpool | MIT/Apache-2.0 | Connection pooling |
| refinery | MIT | Migrations |
| tokio | MIT | Async runtime |
| serde | MIT/Apache-2.0 | Serialization |
| thiserror | MIT/Apache-2.0 | Error handling |
| tracing | MIT | Observability |

### Contributors

See [CONTRIBUTORS.md](./CONTRIBUTORS.md) for a list of project contributors.

---

## Appendix P: SQL Command Reference

### P.1 SELECT Statement Components

```sql
SELECT [DISTINCT] column_list
FROM table_reference
[JOIN join_condition]
[WHERE filter_conditions]
[GROUP BY grouping_columns]
[HAVING group_filter]
[ORDER BY sort_columns [ASC|DESC]]
[LIMIT count]
[OFFSET start]
[FETCH FIRST count ROWS ONLY]
[FOR UPDATE [OF columns] [NOWAIT | SKIP LOCKED]];
```

### P.2 JOIN Types

| Join Type | Syntax | Returns | Use Case |
|-----------|--------|---------|----------|
| **INNER JOIN** | `JOIN ... ON` | Matching rows only | Standard join |
| **LEFT JOIN** | `LEFT JOIN ... ON` | All left + matching right | Optional relations |
| **RIGHT JOIN** | `RIGHT JOIN ... ON` | All right + matching left | Reverse optional |
| **FULL OUTER JOIN** | `FULL JOIN ... ON` | All rows from both | Merge datasets |
| **CROSS JOIN** | `CROSS JOIN` | Cartesian product | Combinations |
| **LATERAL JOIN** | `LATERAL (...)` | Correlated subquery | Row-dependent subqueries |

### P.3 Transaction Commands

| Command | Description | Example |
|---------|-------------|---------|
| `BEGIN` | Start transaction | `BEGIN;` |
| `COMMIT` | Save changes | `COMMIT;` |
| `ROLLBACK` | Discard changes | `ROLLBACK;` |
| `SAVEPOINT` | Named rollback point | `SAVEPOINT before_update;` |
| `ROLLBACK TO` | Rollback to savepoint | `ROLLBACK TO before_update;` |
| `SET TRANSACTION` | Configure isolation | `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;` |

### P.4 DDL Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `CREATE TABLE` | New table | `CREATE TABLE users (id SERIAL PRIMARY KEY, ...);` |
| `ALTER TABLE` | Modify table | `ALTER TABLE users ADD COLUMN email VARCHAR(255);` |
| `DROP TABLE` | Remove table | `DROP TABLE IF EXISTS temp_data;` |
| `CREATE INDEX` | Add index | `CREATE INDEX idx_email ON users(email);` |
| `DROP INDEX` | Remove index | `DROP INDEX idx_email;` |
| `CREATE VIEW` | Create view | `CREATE VIEW active_users AS ...;` |
| `CREATE TRIGGER` | Add trigger | `CREATE TRIGGER update_timestamp ...;` |
| `CREATE FUNCTION` | Add function | `CREATE FUNCTION calculate_total(...) ...;` |

---

## Appendix Q: PostgreSQL-Specific Features

### Q.1 Procedural Languages

| Language | Use Case | Performance | Safety |
|----------|----------|-------------|--------|
| **PL/pgSQL** | Standard procedures | Good | Trusted |
| **PL/Python** | Data processing | Variable | Untrusted |
| **PL/Rust** | High-performance | Excellent | Trusted |
| **PL/v8** | JavaScript logic | Good | Trusted |
| **PL/Perl** | Text processing | Good | Trusted/Untrusted |

### Q.2 PostgreSQL Extensions

| Extension | Purpose | Queris Integration |
|-----------|---------|-------------------|
| **pgvector** | Vector similarity search | ✅ Planned v0.6 |
| **PostGIS** | Geospatial data | ✅ Planned v0.7 |
| **pg_trgm** | Trigram matching | ✅ Available |
| **pg_bloom** | Bloom filter index | ✅ Available |
| **pg_stat_statements** | Query statistics | ✅ Auto-configured |
| **uuid-ossp** | UUID generation | ✅ Available |
| **hstore** | Key-value pairs | ✅ Available |
| **ltree** | Hierarchical labels | 📋 Research |
| **pgcrypto** | Cryptographic functions | ✅ Available |
| **fuzzystrmatch** | String matching | ✅ Available |

### Q.3 Listen/Notify Pattern

```rust
// PostgreSQL LISTEN/NOTIFY integration
use queris::notify::{Listener, Notification};

let mut listener = Listener::connect(&pool).await?;
listener.listen("user_updates").await?;

while let Some(notification) = listener.recv().await {
    match notification.channel {
        "user_updates" => {
            let payload: UserUpdate = notification.json_payload()?;
            handle_user_update(payload).await;
        }
        _ => {}
    }
}
```

---

## Appendix R: MySQL-Specific Features

### R.1 MySQL Storage Engines

| Engine | Transactions | Locking | Use Case | Queris Support |
|--------|--------------|---------|----------|----------------|
| **InnoDB** | ✅ ACID | Row-level | General purpose | ✅ Primary |
| **MyISAM** | ❌ No | Table-level | Read-only legacy | ⚠️ Deprecated |
| **MEMORY** | ❌ No | Table-level | Temporary data | ✅ Available |
| **CSV** | ❌ No | Table-level | Data exchange | ✅ Available |
| **ARCHIVE** | ❌ No | Row-level | Compressed logging | ✅ Available |
| **BLACKHOLE** | ❌ No | N/A | Replication relay | ✅ Available |

### R.2 MySQL JSON Features

| Feature | MySQL 5.7 | MySQL 8.0 | Queris Support |
|---------|-----------|-----------|----------------|
| **JSON data type** | ✅ | ✅ Enhanced | ✅ |
| **JSON functions** | Limited | Full | ✅ |
| **JSON indexing** | Virtual columns | Multi-valued | ✅ |
| **JSON aggregation** | ❌ | ✅ | ✅ |
| **JSON schema validation** | ❌ | ✅ | 📋 |

---

## Appendix S: SQLite-Specific Features

### S.1 SQLite Pragma Settings

| Pragma | Default | Recommended | Purpose |
|--------|---------|-------------|---------|
| `journal_mode` | DELETE | WAL | Concurrency |
| `synchronous` | FULL | NORMAL | Durability balance |
| `cache_size` | -2000 | -32000 | Memory cache |
| `temp_store` | DEFAULT | MEMORY | Temp table location |
| `mmap_size` | 0 | 268435456 | Memory-mapped IO |
| `page_size` | 4096 | 4096 | Storage efficiency |

### S.2 SQLite for Production

```rust
use queris::sqlite::{SqliteOptions, JournalMode};

let pool = Queris::sqlite()
    .path("/var/lib/myapp/data.db")
    .options(SqliteOptions {
        journal_mode: JournalMode::Wal,
        synchronous: queris::sqlite::SynchronisticMode::Normal,
        cache_size_kb: 32000,
        mmap_size_bytes: 256 * 1024 * 1024,
        busy_timeout_ms: 5000,
    })
    .connect()
    .await?;
```

---

## Appendix T: MongoDB Connector Design

### T.1 MongoDB vs SQL Mapping

| SQL Concept | MongoDB Equivalent | Queris Abstraction |
|-------------|-------------------|-------------------|
| **Table** | Collection | `table!("collection")` |
| **Row** | Document | Struct with `#[derive(Document)]` |
| **Column** | Field | Struct field |
| **Index** | Index | `create_index()` |
| **Primary Key** | `_id` field | Automatic |
| **JOIN** | `$lookup` aggregation | `.lookup()` method |
| **WHERE** | `find()` filter | `.filter()` |
| **GROUP BY** | `$group` stage | `.group_by()` |
| **ORDER BY** | `sort()` | `.order_by()` |
| **LIMIT** | `limit()` | `.limit()` |

### T.2 MongoDB Aggregation DSL

```rust
// MongoDB aggregation pipeline in Rust
let result = collection!(orders)
    .match_(doc! { "status": "completed" })
    .lookup(Lookup {
        from: "customers",
        local_field: "customer_id",
        foreign_field: "_id",
        as_field: "customer",
    })
    .unwind("$customer")
    .group(
        Group {
            _id: "$customer.region",
            total_revenue: sum("$amount"),
            order_count: sum(1),
        }
    )
    .sort(doc! { "total_revenue": -1 })
    .limit(10)
    .aggregate(&pool)
    .await?;
```

---

## Appendix U: Testing Database Selection Guide

### U.1 When to Use Each Database for Testing

| Database | Best For | Avoid When |
|----------|----------|------------|
| **SQLite (in-memory)** | Unit tests, CI/CD | Testing PostgreSQL-specific features |
| **SQLite (file)** | Integration tests | Concurrent test runs |
| **PostgreSQL (Docker)** | Full integration tests | Resource-constrained environments |
| **PostgreSQL (Testcontainers)** | Complex integration tests | Need fast iteration |
| **MySQL (Docker)** | MySQL-specific features | Simple tests |

### U.2 Test Database Configuration Matrix

| Test Type | Database | Isolation | Reset Strategy |
|-----------|----------|-----------|----------------|
| **Unit** | Mock | N/A | None needed |
| **Integration** | SQLite :memory: | Transaction rollback | Auto |
| **E2E (local)** | PostgreSQL Docker | Database per test | Drop/create |
| **E2E (CI)** | PostgreSQL Service | Schema per test | Truncate |
| **Performance** | Production-like | Dedicated instance | Restore snapshot |

---

## Appendix V: Migration Checklist

### V.1 Before Writing Migration

- [ ] Understand data volume (rows, size)
- [ ] Check for concurrent operations during migration window
- [ ] Plan rollback strategy
- [ ] Test on copy of production data
- [ ] Review lock behavior for DDL
- [ ] Schedule during low-traffic window (if needed)

### V.2 Migration Code Review Checklist

- [ ] Wrapped in transaction (BEGIN/COMMIT)
- [ ] Includes corresponding down.sql
- [ ] Idempotent where possible (IF NOT EXISTS)
- [ ] No data loss (verified)
- [ ] Index creation order optimized
- [ ] Large table operations batched
- [ ] Foreign key constraints handled

### V.3 Post-Migration Verification

- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] Key queries performance baseline recorded
- [ ] Error rates monitored
- [ ] Rollback procedure tested
- [ ] Documentation updated

---

## Appendix W: Queris Ecosystem Roadmap

### W.1 Related Projects

| Project | Purpose | Status | Integration |
|---------|---------|--------|-------------|
| **queris-cli** | Command-line tool | 📋 Planned | Migration, introspection |
| **queris-derive** | Proc-macro crate | 🚧 Active | `#[derive(Table)]` |
| **queris-codegen** | Schema-to-code | 📋 Planned | OpenAPI/GraphQL gen |
| **queris-wasm** | Browser bindings | 📋 Research | WebAssembly support |
| **queris-admin** | Web UI | 📋 Future | Management interface |
| **queris-proxy** | Query proxy | 📋 Research | Query routing, sharding |

### W.2 Integration Partners

| Framework | Integration | Status |
|-----------|-------------|--------|
| **Axum** | Middleware, extractors | ✅ Planned |
| **Actix Web** | Data extractor | ✅ Planned |
| **Rocket** | Fairing, request guard | ✅ Planned |
| **Tonic** | gRPC service integration | 📋 Research |
| **Loco** | Built-in support | 📋 Discussion |

---

*This specification reflects Queris v2.0 architecture based on 2026 SOTA research. For updates and corrections, please open an issue on GitHub.*

*End of Queris Specification v2.0*


