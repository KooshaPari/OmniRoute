# ADR-002: Connection Pooling & Resource Management Strategy

**Date**: 2026-04-04
**Status**: Proposed
**Deciders**: KooshaPari

## Context

Queris needs robust connection pooling to handle:
- **High-throughput scenarios** with thousands of concurrent queries
- **Resource efficiency** to prevent database server overload
- **Graceful degradation** under load spikes
- **Observability** into connection health and performance

The choice of connection pooling strategy significantly impacts:
- Query latency (p50, p95, p99)
- Throughput (queries per second)
- Resource utilization (memory, connections)
- System stability under load

## Decision Drivers

- **Async/await compatibility** with tokio runtime
- **Health checking** to detect and evict dead connections
- **Fairness** in connection distribution across tasks
- **Backpressure** when the pool is exhausted
- **Metrics integration** for observability

## Options Considered

### Option A: sqlx::Pool (Built-in)

**Pros**:
- ✅ Integrated with sqlx, no additional dependencies
- ✅ Automatic connection recycling
- ✅ Simple API
- ✅ Cross-runtime support (tokio/async-std)

**Cons**:
- ⚠️ Limited customization options
- ⚠️ Basic health checking
- ⚠️ No advanced metrics out of the box
- ⚠️ Limited pool management strategies

### Option B: deadpool (Recommended)

**Pros**:
- ✅ Highly configurable pool management
- ✅ Per-type connection pools (useful for different DB roles)
- ✅ Background health checking with configurable intervals
- ✅ Hooks for connection lifecycle (post_create, pre_recycle, etc.)
- ✅ Metrics support via hooks
- ✅ Built-in timeouts and backpressure

**Cons**:
- ⚠️ Additional dependency
- ⚠️ More configuration required
- ⚠️ Learning curve for advanced features

### Option C: bb8 (TikTok's Pool)

**Pros**:
- ✅ Battle-tested at TikTok scale
- ✅ Customizable connection validation
- ✅ Async-friendly design
- ✅ Good performance characteristics

**Cons**:
- ⚠️ Less active development than deadpool
- ⚠️ Fewer built-in features
- ⚠️ Smaller community

### Option D: mobc

**Pros**:
- ✅ Inspired by Go's database/sql
- ✅ Simple and familiar API
- ✅ Good performance

**Cons**:
- ⚠️ Fewer features than deadpool
- ⚠️ Less documentation
- ⚠️ Smaller ecosystem

## Decision

**Adopt deadpool as the primary connection pooling solution** with sqlx::Pool as a lightweight alternative for simple use cases.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Queris Connection Pool Architecture                         │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Application Layer                                   │   │
│  │                                                                        │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │   │ Service A  │  │ Service B  │  │ Service C  │  │ Service D  │     │   │
│  │   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │   │
│  │         │               │               │               │             │   │
│  └─────────┼───────────────┼───────────────┼───────────────┼─────────────┘   │
│            │               │               │               │                 │
│            ▼               ▼               ▼               ▼                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Pool Manager (deadpool)                             │   │
│  │                                                                        │   │
│  │   ┌──────────────────────────────────────────────────────────────┐    │   │
│  │   │  Pool Configuration                                          │    │   │
│  │   │  - max_size: 100                                             │    │   │
│  │   │  - min_idle: 10                                              │    │   │
│  │   │  - max_lifetime: 30min                                       │    │   │
│  │   │  - health_check_interval: 30s                              │    │   │
│  │   │  - acquire_timeout: 5s                                       │    │   │
│  │   └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                        │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │   │ Conn 1 ✓   │  │ Conn 2 ✓   │  │ Conn 3 ✓   │  │ Conn 4 ✗   │    │   │
│  │   │ (idle)     │  │ (in use)   │  │ (idle)     │  │ (recycling)│    │   │
│  │   └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│  │                                                                        │   │
│  │   Connection Lifecycle Hooks:                                        │   │
│  │   - post_create: Initialize session params                             │   │
│  │   - pre_recycle: Health check query                                    │   │
│  │   - post_recycle: Reset session state                                  │   │
│  │   - on_close: Cleanup metrics                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Database Layer                                      │   │
│  │                                                                        │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │   │  PostgreSQL  │  │    MySQL     │  │    SQLite    │               │   │
│  │   │  Primary     │  │  Replica     │  │  (embedded)  │               │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pool Configuration Presets

| Workload Type | Max Size | Min Idle | Max Lifetime | Acquire Timeout | Health Check |
|---------------|----------|----------|--------------|-----------------|--------------|
| **Low Latency** | 20 | 10 | 30m | 1s | 10s |
| **High Throughput** | 100 | 20 | 15m | 5s | 30s |
| **Burst** | 200 | 0 | 5m | 10s | 60s |
| **Serverless** | 5 | 0 | 2m | 3s | 30s |
| **Read Replicas** | 50 | 10 | 30m | 5s | 30s |

### Resource Management Strategy

```rust
// Example: Tiered pool configuration for different workloads
pub struct PoolTier {
    name: &'static str,
    config: PoolConfig,
}

impl PoolTier {
    pub fn low_latency() -> Self {
        Self {
            name: "low_latency",
            config: PoolConfig {
                max_size: 20,
                min_idle: Some(10),
                max_lifetime: Some(Duration::from_secs(1800)),
                acquire_timeout: Duration::from_secs(1),
                health_check_interval: Some(Duration::from_secs(10)),
                test_on_check_out: true,
            }
        }
    }

    pub fn high_throughput() -> Self {
        Self {
            name: "high_throughput",
            config: PoolConfig {
                max_size: 100,
                min_idle: Some(20),
                max_lifetime: Some(Duration::from_secs(900)),
                acquire_timeout: Duration::from_secs(5),
                health_check_interval: Some(Duration::from_secs(30)),
                test_on_check_out: false, // Rely on background checks
            }
        }
    }
}
```

## Implementation Plan

### Phase 1: Basic Pooling (Current)
- [ ] deadpool-postgres integration
- [ ] Basic pool configuration
- [ ] Connection acquisition and release
- [ ] Error handling for exhausted pools

### Phase 2: Health & Monitoring (2026 Q2)
- [ ] Background health checks
- [ ] Connection lifecycle hooks
- [ ] Metrics export (prometheus format)
- [ ] Pool statistics API

### Phase 3: Advanced Features (2026 Q3)
- [ ] Read replica routing
- [ ] Statement-level load balancing
- [ ] Circuit breaker pattern for failed connections
- [ ] Automatic failover to standby

### Phase 4: Optimization (2026 Q4)
- [ ] Pool auto-tuning based on workload
- [ ] Predictive connection warming
- [ ] Connection multiplexing (HTTP/2 style)

## Consequences

### Positive
- **High performance** with efficient connection reuse
- **Reliability** through health checking and automatic recovery
- **Observability** via comprehensive metrics
- **Flexibility** with tiered pool configurations
- **Resource protection** through proper limits and timeouts

### Negative
- **Configuration complexity** requires tuning for each workload
- **Connection overhead** at high pool sizes
- **Dependency on deadpool** which is less ubiquitous than built-in pools

### Mitigations
- Provide sensible defaults for common workloads
- Include pool monitoring in the Queris dashboard
- Document tuning guidelines for different scenarios

## References

- [deadpool](https://github.com/bikeshedder/deadpool) — Async pool manager
- [bb8](https://github.com/djc/bb8) — Connection pool
- [mobc](https://github.com/importcjj/mobc) — Connection pool
- [sqlx::Pool](https://docs.rs/sqlx/latest/sqlx/struct.Pool.html) — Built-in pooling
- [HikariCP](https://github.com/brettwooldridge/HikariCP) — Java pool (inspiration)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/connection-pooling.html)

---

*This ADR establishes the connection pooling and resource management foundation for Queris.*
