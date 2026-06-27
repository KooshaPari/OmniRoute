# v16 Wave A — L7 Subsystems Convention (Fleet)

**Date:** 2026-06-21
**Pillar:** L7 (Subsystem Boundaries & Interfaces)
**Wave:** v16 cycle 6 P0

## Why L7

Every fleet service has 2-4 internal subsystems (e.g. `cache`, `router`, `metrics`, `auth`). Without a convention for naming, dependency direction, and ownership, subsystems silently grow cross-dependencies and become unmaintainable. L7 captures the convention.

## Convention (mandatory for all fleet services)

### 1. Subsystem location

Subsystems live in `src/<service>/<subsystem>/` with this layout:

```
src/<service>/
├── main.rs                 # entrypoint only
├── lib.rs                  # public re-exports
├── <subsystem_a>/
│   ├── mod.rs
│   ├── port.rs            # trait (the interface)
│   ├── adapter.rs         # impl (the implementation)
│   └── tests/
├── <subsystem_b>/
│   └── ...
```

### 2. Naming

Subsystem names are short (≤12 chars), singular nouns:
- ✅ `cache`, `auth`, `router`, `metrics`, `relay`, `broker`
- ❌ `cache_manager`, `auth_service`, `routing_engine`, `metric_collector`

### 3. Dependency direction

Subsystem dependency graph MUST be a DAG. The rules:

- A subsystem can depend only on subsystems that are **strictly above** it in the dependency rank
- Dependency rank is established by the build order in `Cargo.toml` / `pyproject.toml` / `go.mod`
- Cross-cutting subsystems (metrics, tracing, config) are rank 0 (always available)
- Domain subsystems are rank 1+
- Service entrypoint is rank N+1 (depends on everything)

Example (pheno-config):

```
rank 0: tracing, metrics, errors
rank 1: schema, storage
rank 2: loader, validator
rank 3: service (entrypoint)
```

The `cargo-modules graph` output must show a clean DAG (no cycles). v15 T1 found 3 cycles in `pheno-port-adapter`; v16 cycles must be broken.

### 4. Interface contract

Every subsystem exposes exactly one `Port` trait at `<service>/<subsystem>/port.rs`:

```rust
pub trait CachePort: Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError>;
    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError>;
    async fn delete(&self, key: &str) -> Result<(), CacheError>;
}
```

The implementation lives in `adapter.rs`. Consumers depend only on the port, never on the concrete adapter.

### 5. Configuration injection

Subsystems receive their config via constructor (NOT `lazy_static`, NOT `OnceCell`):

```rust
pub struct RedisCacheAdapter { config: CacheConfig, client: redis::Client }
impl RedisCacheAdapter {
    pub fn new(config: CacheConfig) -> Result<Self, CacheError> { ... }
}
```

This makes testing trivial (pass a mock config) and lifecycle explicit.

### 6. Observability

Every subsystem:
- Emits a span on every public method (auto-instrumented via `tracing::instrument`)
- Records a metric on every public method (`pheno_metrics::counter!`)
- Returns structured errors (from `pheno-errors`)

## Subsystem catalog (current state)

| Service | Subsystems | Dependency rank | Audit |
|---------|-----------|----------------|-------|
| pheno-config | schema, storage, loader, validator, watcher, service | 0-3 | clean DAG |
| pheno-port-adapter | tcp, http, udp, unix, retry, circuit, pool, metrics, service | 0-3 | **3 cycles found (v15 T1)** |
| pheno-otel | exporter, sampler, resource, propagator, service | 0-1 | clean |
| pheno-tracing | subscriber, layer, formatter, otlp, service | 0-1 | clean |
| pheno-mcp-router | router, provider, fallback, plugin, sdk, service | 0-2 | clean (post V12-19) |
| pheno-flags | parser, schema, env, default, merge, service | 0-2 | clean |
| pheno-errors | core, context, wrap, reporter, service | 0-1 | clean |
| phenotype-registry | schema, store, query, lock, service | 0-1 | clean |

## Pillar score

| Repo | L7 cycle 4 | L7 cycle 6 (target) |
|------|-----------|---------------------|
| All 8 services | 1.0 (partial) | **3.0** (full convention adopted, all DAGs clean) |

## References

- ADR-014 / ADR-038 (Hexagonal port-adapter L4 policy) — feeds §4 Port trait
- L6 (circular-dep audit) — feeds §3 DAG requirement
- v15 T1 cargo-modules audit — 3 cycles in pheno-port-adapter to be broken in v16
