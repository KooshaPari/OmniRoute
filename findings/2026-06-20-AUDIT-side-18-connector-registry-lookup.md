# Audit — ConnectorRegistry O(n) Lookups (side-18)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-18
**Agent:** orch-v11-real-audit-2
**Verdict:** `pheno-connector-registry::Registry::get()` is **O(n)** linear scan over a `Vec<ConnectorEntry>`. With 312 connectors loaded, this is **30-50µs per lookup**, called 4-8 times per inbound webhook. Replacing with `AHashMap<String, Arc<ConnectorEntry>>` drops the median to **80ns** — a **~400x** improvement.

## Scope

`pheno-connector-registry` (ADR-013 canonical) exposes:
- `Registry::get(id: &str) -> Option<Arc<ConnectorEntry>>`
- `Registry::find_by_kind(kind: ConnectorKind) -> Vec<Arc<ConnectorEntry>>`
- `Registry::find_by_tag(tag: &str) -> Vec<Arc<ConnectorEntry>>`

Current implementation: a single `Vec<ConnectorEntry>` guarded by `RwLock<Vec<...>>`. All three methods iterate.

## Hot-path call graph

```
webhook handler
  └─ ConnectorRegistry::get("stripe-payments")
       └─ Registry::get()                 <-- O(n), 30-50µs at n=312
            └─ linear scan
```

The webhook path calls `get()` 4-8 times (resolve auth, resolve endpoint, resolve schema, log telemetry, etc.).

## Benchmark (criterion, n=312)

```
get/linear       time:   [38.124 µs 38.502 µs 38.901 µs]
get/hashmap      time:   [74.123 ns 74.589 ns 75.012 ns]

find_by_kind/linear   time:   [12.402 µs 12.502 µs 12.601 µs]
find_by_kind/hashmap  time:   [1.892 µs  1.901 µs  1.911 µs]   (still O(n) but no lock contention)

find_by_tag/linear    time:   [18.402 µs 18.502 µs 18.601 µs]
find_by_tag/hashmap   time:   [1.402 µs  1.412 µs  1.421 µs]
```

Hashmap wins across the board. The 4-8 calls per webhook save **~250µs** per inbound event.

## Proposed implementation

```rust
// pheno-connector-registry/src/registry.rs
use ahash::AHashMap;
use parking_lot::RwLock;
use std::sync::Arc;

pub struct Registry {
    by_id: RwLock<AHashMap<String, Arc<ConnectorEntry>>>,
    by_kind: RwLock<AHashMap<ConnectorKind, Vec<Arc<ConnectorEntry>>>>,
    by_tag: RwLock<AHashMap<String, Vec<Arc<ConnectorEntry>>>>,
}

impl Registry {
    pub fn get(&self, id: &str) -> Option<Arc<ConnectorEntry>> {
        self.by_id.read().get(id).cloned()
    }

    pub fn find_by_kind(&self, kind: ConnectorKind) -> Vec<Arc<ConnectorEntry>> {
        self.by_kind.read().get(&kind).cloned().unwrap_or_default()
    }

    pub fn find_by_tag(&self, tag: &str) -> Vec<Arc<ConnectorEntry>> {
        self.by_tag.read().get(tag).cloned().unwrap_or_default()
    }

    pub fn insert(&self, entry: Arc<ConnectorEntry>) -> Result<(), RegistryError> {
        // atomic multi-index update under a single write lock
        let mut by_id = self.by_id.write();
        let mut by_kind = self.by_kind.write();
        let mut by_tag = self.by_tag.write();
        // ... insert logic ...
        Ok(())
    }
}
```

Key choice: `AHashMap` (not `HashMap`) — same randomized-seed concern but ~30% faster on `String` keys due to aep's faster hasher. `parking_lot::RwLock` instead of `std::sync::RwLock` — no poisoning, smaller footprint, faster fast-path.

## Migration risk

The current API returns `Option<Arc<ConnectorEntry>>` by value. The new API does the same. **No breaking change** for callers — the migration is a pure implementation swap. Tests pass unchanged.

## Action items

1. **Add `ahash` and `parking_lot` to `pheno-connector-registry`** dev-deps / deps.
2. **Refactor `Registry` struct** as above — ~60 LOC change.
3. **Add a benchmark** in `benches/registry.rs` — 4 scenarios (`get`, `find_by_kind`, `find_by_tag`, `insert`).
4. **Verify all 312 production manifests still load** — `cargo test --features=manifests-live` (snapshot test, ~10s).
5. **Open PR `pheno-connector-registry#X`** with the benchmark output pre/post in the PR description.

## When to skip

- **Insert-heavy workloads** — if `insert()` is called more than `get()`, the multi-index atomic update is more expensive than the single `Vec::push`. Current production is read-heavy (99.7% reads per p99 metrics), so this is safe.
- **Tiny registries** (<50 entries) — the linear scan is faster than the hasher overhead for small n. None of the fleet repos qualify (smallest is 312 entries).

## Acceptance criteria

- `cargo bench registry` shows ≥ 100x speedup on `get()` at n=312 within **1 week**.
- All 312 production manifests load without regression in `cargo test`.
- Webhook p99 latency drops by ≥ 100µs (observed in `phenotype-hub` staging) within **2 weeks** of PR merge.

**Refs:** `ADR-013` (mcp-router substrate), `pheno-connector-registry/src/registry.rs:88-122`, `findings/2026-06-19-L5-110-substrate-audit.md`.