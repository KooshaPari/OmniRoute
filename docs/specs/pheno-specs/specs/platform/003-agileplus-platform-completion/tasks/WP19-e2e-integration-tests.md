---
work_package_id: WP19
title: End-to-End Integration Tests
lane: "done"
dependencies: []
base_branch: main
base_commit: f49e1f98ffaa17a3544f6bdc08854dfe0b6b933f
created_at: '2026-03-02T17:40:32.794554+00:00'
subtasks: [T107, T108, T109, T110, T111]
shell_pid: "10458"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP19: End-to-End Integration Tests

Implementation command: `spec-kitty implement WP19 --base WP14`

## Objective

Implement full pipeline integration tests covering all platform services: API, event store, cache, graph database, external integrations, and sync orchestration.

## Subtasks

### T107: Test Harness Setup

Create integration test infrastructure at `tests/integration/` in the workspace root.

**File structure:**
```
tests/integration/
├── common/
│   ├── mod.rs            # Test utilities
│   ├── harness.rs        # Service startup and teardown
│   └── fixtures.rs       # Test data fixtures
├── feature_lifecycle.rs   # T108: Feature lifecycle test
├── dashboard_sse.rs       # T109: Dashboard SSE test
├── sync_conflict.rs       # T110: Sync conflict test
├── service_failure.rs     # T111: Service failure recovery test
└── main.rs               # Test runner
```

**Harness implementation (harness.rs):**

```rust
pub struct TestHarness {
    process_handle: Child,
    db_pool: SqlitePool,
    client: HttpClient,
    compose_dir: PathBuf,
}

impl TestHarness {
    pub async fn start() -> Result<Self> {
        // Check if process-compose is installed
        if !is_process_compose_installed() {
            eprintln!("WARNING: process-compose not installed. Some tests will be skipped.");
            return Err(HarnessError::ProcessComposeNotInstalled);
        }

        // Start services via process-compose
        let output = Command::new("process-compose")
            .arg("up")
            .arg("-f")
            .arg("process-compose.yml")
            .arg("--detach")
            .current_dir(project_root())
            .output()
            .await?;

        if !output.status.success() {
            return Err(HarnessError::StartFailed(String::from_utf8(output.stderr)?));
        }

        // Wait for services to be healthy
        self.wait_for_health_checks(Duration::from_secs(30)).await?;

        // Initialize database pool
        let db_pool = SqlitePool::connect("sqlite://agileplus.db").await?;
        sqlx::migrate!().run(&db_pool).await?;

        // Create HTTP client
        let client = HttpClient::new("http://localhost:3000");

        Ok(TestHarness {
            process_handle: child,
            db_pool,
            client,
            compose_dir: project_root(),
        })
    }

    async fn wait_for_health_checks(&self, timeout: Duration) -> Result<()> {
        let start = Instant::now();
        loop {
            if let Ok(health) = self.client.get("/health").await {
                if health.status() == 200 {
                    return Ok(());
                }
            }
            if start.elapsed() > timeout {
                return Err(HarnessError::HealthCheckTimeout);
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }

    pub fn db(&self) -> &SqlitePool {
        &self.db_pool
    }

    pub fn client(&self) -> &HttpClient {
        &self.client
    }
}

impl Drop for TestHarness {
    fn drop(&mut self) {
        // Cleanup: stop all services
        let _ = std::process::Command::new("process-compose")
            .arg("down")
            .arg("-f")
            .arg("process-compose.yml")
            .current_dir(&self.compose_dir)
            .output();
    }
}

fn is_process_compose_installed() -> bool {
    std::process::Command::new("which")
        .arg("process-compose")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
```

**Fixture setup (fixtures.rs):**

```rust
pub async fn seed_test_data(db: &SqlitePool) -> Result<TestFixtures> {
    let feature1 = Feature {
        id: "feature-1".to_string(),
        title: "Implement caching layer".to_string(),
        status: FeatureStatus::Created,
        ..Default::default()
    };

    let feature2 = Feature {
        id: "feature-2".to_string(),
        title: "Add API rate limiting".to_string(),
        status: FeatureStatus::Created,
        ..Default::default()
    };

    // Insert into database
    let mut tx = db.begin().await?;
    // ... insert logic
    tx.commit().await?;

    Ok(TestFixtures {
        feature1,
        feature2,
    })
}

pub struct TestFixtures {
    pub feature1: Feature,
    pub feature2: Feature,
}
```

**Test runner configuration:**
- Conditional skip if `process-compose` not available (print warning)
- Set `RUST_LOG=debug` for integration tests
- Use `tokio::test` for async test execution
- Provide test timeout of 60 seconds per test

### T108: Feature Lifecycle Test

Test the complete feature lifecycle from creation to state transitions.

**Test file: tests/integration/feature_lifecycle.rs**

```rust
#[tokio::test]
#[ignore] // Only run if process-compose available
async fn feature_lifecycle_integration() -> Result<()> {
    let harness = TestHarness::start().await?;
    let fixtures = seed_test_data(harness.db()).await?;

    // Step 1: Create feature via API
    let create_response = harness
        .client()
        .post("/api/features")
        .json(&json!({
            "title": "E2E test feature",
            "description": "Test lifecycle",
        }))
        .send()
        .await?;

    assert_eq!(create_response.status(), 201);
    let feature: Feature = create_response.json().await?;
    let feature_id = feature.id.clone();

    // Step 2: Verify feature in SQLite
    let db_feature = sqlx::query_as::<_, Feature>(
        "SELECT * FROM features WHERE id = ?"
    )
    .bind(&feature_id)
    .fetch_one(harness.db())
    .await?;
    assert_eq!(db_feature.title, "E2E test feature");

    // Step 3: Verify feature in cache (Dragonfly)
    let cached = harness
        .client()
        .get(&format!("/api/features/{}", feature_id))
        .send()
        .await?;
    assert_eq!(cached.status(), 200);

    // Step 4: Verify feature in graph (Neo4j)
    // Query Neo4j for the feature node
    // (implementation depends on Neo4j driver integration)

    // Step 5: Transition states
    let states = vec![
        FeatureStatus::Specified,
        FeatureStatus::Implementing,
        FeatureStatus::Done,
    ];

    for target_state in states {
        let transition_response = harness
            .client()
            .post(&format!("/api/features/{}/transition", feature_id))
            .json(&json!({ "target_state": target_state }))
            .send()
            .await?;

        assert_eq!(transition_response.status(), 200);

        // Verify event was emitted
        let events = sqlx::query_as::<_, DomainEvent>(
            "SELECT * FROM events WHERE entity_id = ? ORDER BY sequence DESC LIMIT 1"
        )
        .bind(&feature_id)
        .fetch_one(harness.db())
        .await?;

        assert_eq!(events.event_type, "StateTransitioned");
        assert_eq!(events.data["target_state"], target_state.to_string());
    }

    // Step 6: Verify hash chain integrity
    let all_events = sqlx::query_as::<_, DomainEvent>(
        "SELECT * FROM events WHERE entity_id = ? ORDER BY sequence"
    )
    .bind(&feature_id)
    .fetch_all(harness.db())
    .await?;

    let mut prev_hash = String::new();
    for event in all_events {
        let current_hash = event.compute_hash(&prev_hash)?;
        assert_eq!(event.hash, current_hash);
        prev_hash = current_hash;
    }

    // Step 7: Verify Plane.so sync triggered (mock)
    // Check that sync endpoint was called with feature data
    // (requires mocking Plane.so webhook in process-compose)

    Ok(())
}
```

**Verification checklist:**
- Feature created successfully via API (201 response)
- Feature persisted in SQLite with correct data
- Feature available in cache (Dragonfly)
- Feature represented in graph database (Neo4j)
- State transitions trigger correct events
- Hash chain maintains integrity across events
- Plane.so sync triggered (or mocked)

### T109: Dashboard SSE Test

Test Server-Sent Events (SSE) for real-time dashboard updates.

**Test file: tests/integration/dashboard_sse.rs**

```rust
#[tokio::test]
#[ignore]
async fn dashboard_sse_integration() -> Result<()> {
    let harness = TestHarness::start().await?;

    // Step 1: Open SSE connection
    let client = reqwest::Client::new();
    let sse_response = client
        .get("http://localhost:3000/api/stream")
        .header("Accept", "text/event-stream")
        .send()
        .await?;

    assert_eq!(sse_response.status(), 200);

    let stream = sse_response.bytes_stream();
    let mut event_stream = EventStream::new(stream);

    // Step 2: Create feature via API (on different connection)
    tokio::spawn(async {
        let create_response = client
            .post("http://localhost:3000/api/features")
            .json(&json!({
                "title": "SSE test feature",
            }))
            .send()
            .await;
        // Continue other operations...
    });

    // Step 3: Verify SSE event received
    let timeout = Duration::from_secs(5);
    let result = tokio::time::timeout(timeout, event_stream.next()).await?;

    if let Some(Ok(event)) = result {
        match event {
            Event::Open => println!("SSE connection opened"),
            Event::Message(msg) => {
                let data: serde_json::Value = serde_json::from_str(&msg.data)?;
                assert_eq!(data["type"], "FeatureCreated");
                assert_eq!(data["data"]["title"], "SSE test feature");
            }
        }
    } else {
        panic!("No SSE event received within timeout");
    }

    // Step 4: Transition feature state
    let feature_id = "..."; // Extract from first event
    let transition = client
        .post(&format!("http://localhost:3000/api/features/{}/transition", feature_id))
        .json(&json!({ "target_state": "Specified" }))
        .send()
        .await?;
    assert_eq!(transition.status(), 200);

    // Step 5: Verify SSE event for state change
    let result = tokio::time::timeout(Duration::from_secs(5), event_stream.next()).await?;
    if let Some(Ok(Event::Message(msg))) = result {
        let data: serde_json::Value = serde_json::from_str(&msg.data)?;
        assert_eq!(data["type"], "FeatureTransitioned");
        assert_eq!(data["data"]["target_state"], "Specified");
    } else {
        panic!("State change SSE event not received");
    }

    Ok(())
}
```

**Verification checklist:**
- SSE connection establishes successfully
- Feature creation triggers SSE event with correct data
- State transitions trigger SSE events
- Multiple clients can subscribe concurrently
- Event order preserved in SSE stream

### T110: Sync Conflict Test

Test conflict detection and resolution when syncing with Plane.so.

**Test file: tests/integration/sync_conflict.rs**

```rust
#[tokio::test]
#[ignore]
async fn sync_conflict_integration() -> Result<()> {
    let harness = TestHarness::start().await?;

    // Step 1: Create feature locally
    let create_response = harness
        .client()
        .post("/api/features")
        .json(&json!({
            "title": "Conflict test",
            "description": "Initial description",
        }))
        .send()
        .await?;
    let feature: Feature = create_response.json().await?;
    let feature_id = feature.id.clone();

    // Step 2: Sync to Plane.so mock (mark as synced)
    // Mock Plane.so webhook endpoint at localhost:8001
    harness
        .client()
        .post(&format!("/api/features/{}/sync", feature_id))
        .send()
        .await?;

    // Step 3: Modify feature locally
    harness
        .client()
        .patch(&format!("/api/features/{}", feature_id))
        .json(&json!({ "title": "Conflict test (modified locally)" }))
        .send()
        .await?;

    // Step 4: Simulate Plane.so webhook with different modification
    let webhook_payload = json!({
        "event": "issue.updated",
        "data": {
            "id": feature_id,
            "title": "Conflict test (modified remotely)",
            "description": "Different change from Plane",
        },
    });

    harness
        .client()
        .post("/api/webhooks/plane")
        .json(&webhook_payload)
        .send()
        .await?;

    // Step 5: Verify conflict detected
    let conflict_check = harness
        .client()
        .get(&format!("/api/features/{}/sync-status", feature_id))
        .send()
        .await?;

    let status: SyncStatus = conflict_check.json().await?;
    assert_eq!(status.conflict_detected, true);
    assert_eq!(status.conflict_type, Some(ConflictType::FieldModified));

    // Step 6: Resolve conflict (local wins)
    harness
        .client()
        .post(&format!("/api/features/{}/resolve-conflict", feature_id))
        .json(&json!({ "resolution": "local-wins" }))
        .send()
        .await?;

    // Step 7: Verify resolution applied
    let resolved = harness
        .client()
        .get(&format!("/api/features/{}", feature_id))
        .send()
        .await?
        .json::<Feature>()
        .await?;

    assert_eq!(resolved.title, "Conflict test (modified locally)");

    let sync_status = harness
        .client()
        .get(&format!("/api/features/{}/sync-status", feature_id))
        .send()
        .await?
        .json::<SyncStatus>()
        .await?;

    assert_eq!(sync_status.conflict_detected, false);
    assert_eq!(sync_status.last_resolved, Some(Resolution::LocalWins));

    Ok(())
}
```

**Verification checklist:**
- Conflict detected when local and remote modifications differ
- Conflict type identified correctly
- Resolution strategy applied (local-wins used here)
- Resolved feature state consistent after sync
- Conflict marked as resolved in sync status

### T111: Service Failure Recovery Test

Test system behavior when services fail and recovery when they restart.

**Test file: tests/integration/service_failure.rs**

```rust
#[tokio::test]
#[ignore]
async fn service_failure_recovery_integration() -> Result<()> {
    let harness = TestHarness::start().await?;

    // Step 1: Verify all services healthy
    let health = harness
        .client()
        .get("/health")
        .send()
        .await?
        .json::<HealthStatus>()
        .await?;

    assert_eq!(health.status, "healthy");

    // Step 2: Kill Dragonfly (cache service)
    let kill_cmd = Command::new("pkill")
        .arg("-f")
        .arg("dragonfly")
        .output()
        .await?;
    assert!(kill_cmd.status.success());

    // Step 3: Wait briefly for process to die
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Step 4: Verify health check reports degraded
    let health = harness
        .client()
        .get("/health")
        .send()
        .await?
        .json::<HealthStatus>()
        .await?;

    assert_eq!(health.status, "degraded");
    assert!(health.checks.contains_key("cache"));
    assert_eq!(health.checks["cache"], "unhealthy");

    // Step 5: Verify core operations still work (SQLite fallback)
    let feature_create = harness
        .client()
        .post("/api/features")
        .json(&json!({
            "title": "Created during outage",
        }))
        .send()
        .await?;

    assert_eq!(feature_create.status(), 201);
    let feature: Feature = feature_create.json().await?;

    // Verify feature in database
    let db_check = sqlx::query_as::<_, Feature>(
        "SELECT * FROM features WHERE id = ?"
    )
    .bind(&feature.id)
    .fetch_one(harness.db())
    .await;

    assert!(db_check.is_ok());

    // Step 6: Restart Dragonfly
    Command::new("process-compose")
        .arg("restart")
        .arg("dragonfly")
        .current_dir(project_root())
        .output()
        .await?;

    // Step 7: Wait for service to be healthy
    let start = Instant::now();
    loop {
        let health = harness
            .client()
            .get("/health")
            .send()
            .await?
            .json::<HealthStatus>()
            .await?;

        if health.status == "healthy" {
            break;
        }

        if start.elapsed() > Duration::from_secs(30) {
            panic!("Service did not recover within timeout");
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    // Step 8: Verify cache repopulated
    let cached = harness
        .client()
        .get(&format!("/api/features/{}", feature.id))
        .send()
        .await?;

    assert_eq!(cached.status(), 200);

    // Step 9: Verify health returns to healthy
    let health = harness
        .client()
        .get("/health")
        .send()
        .await?
        .json::<HealthStatus>()
        .await?;

    assert_eq!(health.status, "healthy");

    Ok(())
}
```

**Verification checklist:**
- Health check detects Dragonfly offline
- API still functional with SQLite fallback
- Feature creation succeeds during outage
- Data persists in database during outage
- Service recovery detected within timeout
- Cache repopulates after restart
- Health status returns to healthy

## Definition of Done

- [ ] Test harness starts all services via process-compose
- [ ] Health checks wait for service readiness
- [ ] Fixtures provide seed data for tests
- [ ] Feature lifecycle test verifies creation, transitions, and event integrity
- [ ] Dashboard SSE test verifies real-time event delivery
- [ ] Sync conflict test verifies detection and resolution
- [ ] Service failure test verifies degraded mode and recovery
- [ ] All tests pass with services running
- [ ] Tests skip gracefully if process-compose not installed
- [ ] Test output includes timing and resource usage
- [ ] Documentation: How to run integration tests, troubleshooting

## Activity Log

- 2026-03-02T17:40:33Z – claude-opus – shell_pid=10458 – lane=doing – Assigned agent via workflow command
- 2026-03-02T21:05:08Z – claude-opus – shell_pid=10458 – lane=for_review – Ready for review: E2E integration test harness with 8 unit tests + 4 integration test suites
- 2026-03-02T23:19:49Z – claude-opus – shell_pid=10458 – lane=done – Merged to main, 516 tests passing
