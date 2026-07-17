---
work_package_id: WP21
title: Performance Benchmarks
lane: "done"
dependencies: []
base_branch: main
base_commit: ed03fc47e3662d17514d0d9e56dbaeba7f22a9e7
created_at: '2026-03-02T20:47:57.984923+00:00'
subtasks: [T116, T117, T118, T119, T120]
shell_pid: "35449"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP21: Performance Benchmarks

Implementation command: `spec-kitty implement WP21 --base WP20`

## Objective

Establish and verify performance benchmarks across all major subsystems to ensure the platform meets constitution performance gates and enable regression detection.

## Subtasks

### T116: Event Append Throughput Benchmark

Benchmark event append performance at the core of the event-sourced architecture.

**Benchmark file: benches/event_append_throughput.rs**

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use agileplus_events::*;
use agileplus_sqlite::*;

fn event_append_benchmark(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("append_10k_events_sequential", |b| {
        b.to_async(&rt).iter(|| async {
            let db = setup_test_db_with_wal().await.unwrap();
            let store = SqliteEventStore::new(db);

            for i in 0..10_000 {
                let event = DomainEvent {
                    entity_type: "Feature".to_string(),
                    entity_id: format!("feature-{}", i / 100), // 100 entities
                    sequence: (i % 100) as u64 + 1,
                    event_type: "Updated".to_string(),
                    data: json!({"index": i}),
                    hash: format!("hash-{}", i),
                    timestamp: Utc::now(),
                };

                black_box(store.append_event(black_box(event)).await.unwrap());
            }
        })
    });
}

criterion_group!(benches, event_append_benchmark);
criterion_main!(benches);
```

**Metrics to track:**
- Average append time (microseconds per event)
- p50, p95, p99 latencies
- Throughput (events/second): target ≥10,000 events/sec
- Memory allocation per append
- WAL checkpoint overhead

**Configuration:**
- SQLite: WAL mode enabled
- Batch size: measure both individual appends and batch inserts
- Database size: test with 0KB (cold), 10MB, 100MB

**Output format (regression detection):**
```
Event Append Throughput
=======================
Average append time:     100 µs
p50 latency:            75 µs
p95 latency:            150 µs
p99 latency:            250 µs
Throughput:             10,000 events/sec ✓ (target: ≥10,000)
WAL checkpoint time:    25 ms
```

### T117: Event Replay and Snapshot Rebuild Benchmark

Benchmark the performance of replaying events from the event store to rebuild state.

**Benchmark file: benches/event_replay.rs**

```rust
fn event_replay_benchmark(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("replay_1000_events_full", |b| {
        b.to_async(&rt).iter(|| async {
            let db = setup_test_db_with_1000_events().await.unwrap();
            let store = SqliteEventStore::new(db);

            // Replay all events for feature-1 from sequence 0
            let _feature = replay_feature_state(&store, "feature-1", 0).await.unwrap();
        })
    });

    c.bench_function("replay_1000_events_from_snapshot", |b| {
        b.to_async(&rt).iter(|| async {
            let db = setup_test_db_with_900_snapshot_100_events().await.unwrap();
            let store = SqliteEventStore::new(db);

            // Load snapshot (900 events) and replay remaining 100
            let _feature = replay_feature_with_snapshot(&store, "feature-1").await.unwrap();
        })
    });
}

fn replay_feature_state(
    store: &SqliteEventStore,
    entity_id: &str,
    from_sequence: u64,
) -> Result<Feature> {
    let events = store.get_events_from("Feature", entity_id, from_sequence)?;
    let mut feature = Feature::default();

    for event in events {
        feature.apply_event(&event);
    }

    Ok(feature)
}

fn replay_feature_with_snapshot(
    store: &SqliteEventStore,
    entity_id: &str,
) -> Result<Feature> {
    let snapshot = store.get_latest_snapshot("Feature", entity_id)?;
    let from_sequence = snapshot.map(|s| s.event_sequence + 1).unwrap_or(0);
    let mut feature = snapshot.map(|s| s.state).unwrap_or_default();

    let events = store.get_events_from("Feature", entity_id, from_sequence)?;
    for event in events {
        feature.apply_event(&event);
    }

    Ok(feature)
}

criterion_group!(benches, event_replay_benchmark);
criterion_main!(benches);
```

**Metrics to track:**
- Full replay (1000 events): target <100ms
- Snapshot-based replay (900 snapshot + 100 new): target <10ms
- Snapshot load time: <1ms
- Event application rate: >10,000 events/sec
- Memory usage during replay: <10MB for single entity

**Comparison output:**
```
Event Replay Performance
========================
Full replay (1000 events):            85 ms   ✓ (target: <100ms)
Snapshot replay (900+100):            8 ms    ✓ (target: <10ms)
Snapshot optimization gain:           91%
```

### T118: API Response Time Benchmarks

Benchmark common API endpoints under load to verify latency SLOs.

**Benchmark file: benches/api_response_times.rs**

```rust
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn api_response_benchmarks(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let app = setup_test_app().await.unwrap();

    let mut group = c.benchmark_group("api_endpoints");
    group.measurement_time(std::time::Duration::from_secs(10));

    // GET /api/features (list)
    group.bench_function("get_features_list_100", |b| {
        b.to_async(&rt).iter(|| async {
            app.client()
                .get("/api/features?limit=100")
                .send()
                .await
                .unwrap()
        })
    });

    // GET /api/features/:id
    group.bench_function("get_feature_detail", |b| {
        b.to_async(&rt).iter(|| async {
            app.client()
                .get("/api/features/feature-1")
                .send()
                .await
                .unwrap()
        })
    });

    // POST /api/features/:id/transition
    group.bench_function("post_feature_transition", |b| {
        b.to_async(&rt).iter(|| async {
            app.client()
                .post("/api/features/feature-1/transition")
                .json(&json!({"target_state": "Specified"}))
                .send()
                .await
                .unwrap()
        })
    });

    // GET /health
    group.bench_function("get_health", |b| {
        b.to_async(&rt).iter(|| async {
            app.client()
                .get("/health")
                .send()
                .await
                .unwrap()
        })
    });

    group.finish();
}

criterion_group!(benches, api_response_benchmarks);
criterion_main!(benches);
```

**Metrics to track:**
- GET /api/features (list 100): p95 <100ms, p99 <200ms
- GET /api/features/:id: p95 <50ms, p99 <100ms
- POST /api/features/:id/transition: p95 <100ms, p99 <200ms
- GET /health: p95 <10ms, p99 <20ms

**Test scenarios:**
- Cold start (first request, cache miss)
- Warm cache (repeated requests)
- Cache invalidation (after state change)
- Concurrent requests (10 parallel clients)

**Output format:**
```
API Response Time Benchmarks
=============================
GET /api/features:
  p50: 45ms  p95: 95ms  p99: 180ms  ✓ (target p95 <100ms)

GET /api/features/:id:
  p50: 20ms  p95: 48ms  p99: 95ms   ✓ (target p95 <50ms)

POST /api/features/:id/transition:
  p50: 80ms  p95: 98ms  p99: 190ms  ✓ (target p95 <100ms)

GET /health:
  p50: 3ms   p95: 8ms   p99: 15ms   ✓ (target p95 <10ms)
```

### T119: Sync Round-Trip Benchmark

Benchmark P2P and external sync operations against Plane.so.

**Benchmark file: benches/sync_roundtrip.rs**

```rust
fn sync_roundtrip_benchmark(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("push_single_feature_to_plane", |b| {
        b.to_async(&rt).iter(|| async {
            let client = setup_mock_plane_client().await.unwrap();
            let feature = create_test_feature("feature-1").await.unwrap();

            client.push_feature(&feature).await.unwrap()
        })
    });

    c.bench_function("pull_single_feature_from_plane", |b| {
        b.to_async(&rt).iter(|| async {
            let client = setup_mock_plane_client().await.unwrap();

            client.pull_feature("plane-issue-1").await.unwrap()
        })
    });

    c.bench_function("full_sync_100_features_no_conflicts", |b| {
        b.to_async(&rt).iter(|| async {
            let orchestrator = setup_test_sync_orchestrator().await.unwrap();
            let features = create_test_features(100).await.unwrap();

            orchestrator.sync_all(&features).await.unwrap()
        })
    });

    c.bench_function("full_sync_5_conflicts_resolution", |b| {
        b.to_async(&rt).iter(|| async {
            let orchestrator = setup_test_sync_orchestrator().await.unwrap();
            let features = create_test_features(100).await.unwrap();
            let conflicted = inject_conflicts(&features, 5).await.unwrap();

            orchestrator.sync_all(&conflicted).await.unwrap()
        })
    });
}

criterion_group!(benches, sync_roundtrip_benchmark);
criterion_main!(benches);
```

**Metrics to track:**
- Push single feature: target <2s
- Pull single feature: target <2s
- Full sync (100 features, no conflicts): target <30s
- Sync with conflict resolution (5 conflicts): target <10s

**Test scenarios:**
- Network latency simulation (50ms, 100ms)
- Plane.so API rate limiting (100 req/min)
- Large payloads (5KB+ feature descriptions)
- Partial failures and retries

**Output format:**
```
Sync Round-Trip Performance
============================
Push single feature:               1.8s  ✓ (target: <2s)
Pull single feature:               1.6s  ✓ (target: <2s)
Full sync (100 features):         28.5s  ✓ (target: <30s)
Sync with 5 conflicts resolved:    9.2s  ✓ (target: <10s)
```

### T120: Memory Usage at Idle

Benchmark memory consumption of the platform at idle and under load.

**Benchmark file: benches/memory_usage.rs**

```rust
fn memory_usage_benchmark() {
    // Start all services via process-compose
    let _harness = setup_services().await.unwrap();

    // Wait 30 seconds for stabilization
    tokio::time::sleep(Duration::from_secs(30)).await;

    // Capture memory usage
    let agileplus_rss = get_process_memory("agileplus-api").unwrap(); // target <100MB
    let dragonfly_rss = get_process_memory("dragonfly").unwrap();
    let neo4j_rss = get_process_memory("neo4j").unwrap(); // JVM, excluded from target
    let total_rss = agileplus_rss + dragonfly_rss + neo4j_rss;

    println!("Memory Usage (idle):");
    println!("  agileplus-api: {} MB ✓ (target: <100MB)", agileplus_rss / 1_000_000);
    println!("  dragonfly:     {} MB", dragonfly_rss / 1_000_000);
    println!("  neo4j:         {} MB (JVM, excluded)", neo4j_rss / 1_000_000);
    println!("  Total:         {} MB", total_rss / 1_000_000);

    // Assert hardgate for agileplus-api
    assert!(
        agileplus_rss < 100_000_000,
        "agileplus-api memory usage exceeds 100MB"
    );
}

fn get_process_memory(process_name: &str) -> Result<u64> {
    // Use ps or /proc to get RSS of process
    let output = std::process::Command::new("ps")
        .arg("aux")
        .arg("-q")
        .arg(&format!("pgrep -f {}", process_name))
        .output()?;

    // Parse RSS from output (typically column 6)
    // Return RSS in bytes
}

#[tokio::test]
async fn memory_usage_idle() {
    memory_usage_benchmark();
}
```

**Metrics to track:**
- agileplus-api at idle: target <100MB
- Dragonfly cache: documented, no hard gate
- Neo4j JVM: documented, excluded from gate
- Total platform: documented

**Load test scenario:**
- Run with 100 features, 500 work packages
- 10 concurrent API clients making requests
- Steady-state memory after 5 minutes

**Output format:**
```
Memory Usage (idle)
===================
agileplus-api:   45 MB  ✓ (target: <100MB)
dragonfly:       60 MB
neo4j:          1200 MB (JVM, excluded)
Total:          1305 MB

Memory Usage (100 features, 10 concurrent clients)
==================================================
agileplus-api:   75 MB  ✓ (target: <100MB)
dragonfly:      150 MB
neo4j:          1300 MB
Total:          1525 MB
```

## Benchmark Governance

### Running Benchmarks

```bash
# Run all benchmarks
cargo bench --benches

# Run specific benchmark
cargo bench --bench event_append_throughput

# Baseline comparison (before changes)
cargo bench --bench event_append_throughput -- --save-baseline before

# Compare against baseline
cargo bench --bench event_append_throughput -- --baseline before
```

### CI Integration

- Add benchmark targets to CI pipeline
- Run benchmarks on stable Rust toolchain
- Store baseline in repository (`benches/baselines/`)
- Fail CI if regressions exceed 10% on core metrics
- Generate trend report (weekly)

### Constitution Gates

Performance gates enforced by CI:

| Metric | Target | Gate Type |
|--------|--------|-----------|
| Event append throughput | ≥10K events/sec | Hard fail |
| Full event replay (1000) | <100ms | Hard fail |
| Snapshot replay (900+100) | <10ms | Hard fail |
| API /features list (100) | <100ms p95 | Warning |
| API /features/:id | <50ms p95 | Warning |
| Feature transition | <100ms p95 | Warning |
| Health endpoint | <10ms p95 | Warning |
| Sync single feature | <2s | Warning |
| Full sync (100 features) | <30s | Warning |
| agileplus-api memory | <100MB | Hard fail |

## Definition of Done

- [ ] Event append throughput benchmark achieves ≥10K events/sec
- [ ] Event replay benchmarks pass (<100ms full, <10ms snapshot-based)
- [ ] API endpoint benchmarks show response times within SLOs
- [ ] Sync round-trip benchmarks complete within targets
- [ ] Memory usage at idle documented and verified <100MB for agileplus-api
- [ ] All benchmarks run in CI on each commit
- [ ] Baseline stored and regression detection working
- [ ] Constitution gates enforced (hard fail for critical metrics)
- [ ] Trend report generated weekly
- [ ] Documentation: how to run benchmarks, interpret results, resolve regressions

## Activity Log

- 2026-03-02T20:47:58Z – claude-opus – shell_pid=35449 – lane=doing – Assigned agent via workflow command
- 2026-03-02T21:05:25Z – claude-opus – shell_pid=35449 – lane=for_review – Ready for review: Criterion benchmarks for event append, replay, API, sync, and graph queries
- 2026-03-02T23:19:51Z – claude-opus – shell_pid=35449 – lane=done – Merged to main, 516 tests passing
