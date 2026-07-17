---
work_package_id: WP20
title: Contract Tests
lane: "done"
dependencies: []
base_branch: main
base_commit: 6411e50c2d616f13f67cdacdc2a393023f00bc0d
created_at: '2026-03-02T20:47:38.753223+00:00'
subtasks: [T112, T113, T114, T115]
shell_pid: "33155"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP20: Contract Tests

Implementation command: `spec-kitty implement WP20 --base WP19`

## Objective

Implement Pact contract tests for new crate boundaries to ensure service API contracts are honored and prevent cross-crate integration failures.

## Subtasks

### T112: agileplus-events ↔ agileplus-sqlite Contract

Test the contract between the `EventStore` trait (consumer) and `SqliteEventStore` (provider).

**Test file: tests/pacts/events_sqlite_pact.rs**

**Provider: SqliteEventStore**
**Consumer: Any code calling EventStore trait**

Create a Pact that verifies:

```rust
#[tokio::test]
async fn events_sqlite_pact() -> Result<()> {
    let mut pact = PactBuilder::new("agileplus-events", "agileplus-sqlite")
        .interaction(
            "append event",
            || {
                let event = DomainEvent {
                    entity_type: "Feature".to_string(),
                    entity_id: "1".to_string(),
                    sequence: 1,
                    event_type: "Created".to_string(),
                    data: json!({"title": "Test"}),
                    hash: "hash1".to_string(),
                    timestamp: Utc::now(),
                };

                // Request: insert_event
                pact.request()
                    .method("INSERT")
                    .path("/events")
                    .body(event.clone());

                // Response: success
                pact.response()
                    .status(200)
                    .body(SuccessResponse {
                        sequence: 1,
                        hash: "hash1",
                    });

                Ok(())
            },
        )
        .interaction(
            "get events by entity",
            || {
                // Request: fetch events for entity
                pact.request()
                    .method("SELECT")
                    .path("/events?entity_type=Feature&entity_id=1");

                // Response: list of events ordered by sequence
                pact.response()
                    .status(200)
                    .body(vec![
                        DomainEvent {
                            entity_type: "Feature".to_string(),
                            entity_id: "1".to_string(),
                            sequence: 1,
                            event_type: "Created".to_string(),
                            data: json!({"title": "Test"}),
                            hash: "hash1".to_string(),
                            timestamp: Utc::now(),
                        },
                        DomainEvent {
                            entity_type: "Feature".to_string(),
                            entity_id: "1".to_string(),
                            sequence: 2,
                            event_type: "Transitioned".to_string(),
                            data: json!({"target_state": "Specified"}),
                            hash: "hash2".to_string(),
                            timestamp: Utc::now(),
                        },
                    ]);

                Ok(())
            },
        )
        .interaction(
            "get events by sequence range",
            || {
                // Request: fetch events within sequence range
                pact.request()
                    .method("SELECT")
                    .path("/events?from_sequence=1&to_sequence=10");

                // Response: events in range, ordered by sequence
                pact.response()
                    .status(200)
                    .body(vec![/* events */]);

                Ok(())
            },
        )
        .interaction(
            "get latest sequence",
            || {
                // Request: get max sequence for entity
                pact.request()
                    .method("SELECT")
                    .path("/events/latest-sequence?entity_type=Feature&entity_id=1");

                // Response: sequence number
                pact.response()
                    .status(200)
                    .body(json!({"sequence": 2}));

                Ok(())
            },
        )
        .verify_sync_with_provider(|| {
            // Actual provider implementation test
            let db = setup_test_db()?;
            let store = SqliteEventStore::new(db);

            // Verify each interaction
            store.append_event(event1)?;
            store.append_event(event2)?;

            let events = store.get_events("Feature", "1")?;
            assert_eq!(events.len(), 2);
            assert_eq!(events[0].sequence, 1);
            assert_eq!(events[1].sequence, 2);

            Ok(())
        })?;

    pact.write_pact_file("pacts/agileplus-events-sqlite.json")?;
    Ok(())
}
```

**Interactions to verify:**
- Append event successfully (return sequence and hash)
- Get events by entity (ordered by sequence)
- Get events by sequence range (inclusive)
- Get latest sequence for entity
- Handle duplicates (same event hash)
- Error handling: invalid entity type, out-of-range sequence

**Error types verified:**
- `EventStoreError::DuplicateEvent` when appending duplicate
- `EventStoreError::InvalidSequence` when sequence is non-monotonic
- `EventStoreError::NotFound` when querying non-existent entity

### T113: agileplus-sync ↔ agileplus-plane Contract

Test the contract between `SyncOrchestrator` (consumer) and `PlaneClient` (provider).

**Test file: tests/pacts/sync_plane_pact.rs**

**Provider: PlaneClient (Plane.so API)**
**Consumer: SyncOrchestrator**

Create a Pact that verifies:

```rust
#[tokio::test]
async fn sync_plane_pact() -> Result<()> {
    let mut pact = PactBuilder::new("agileplus-sync", "plane-client")
        .interaction(
            "push feature",
            || {
                let feature = Feature {
                    id: "feature-1".to_string(),
                    title: "Test Feature".to_string(),
                    status: FeatureStatus::Specified,
                    ..Default::default()
                };

                pact.request()
                    .method("POST")
                    .path("/api/workspaces/{workspace_id}/issues")
                    .header("Authorization", "Bearer {token}")
                    .body(json!({
                        "title": "Test Feature",
                        "description": "Test Feature description",
                        "state": "BACKLOG",
                        "priority": "MEDIUM",
                    }));

                pact.response()
                    .status(201)
                    .header("Content-Type", "application/json")
                    .body(json!({
                        "id": "plane-issue-1",
                        "identifier": "PROJ-1",
                        "title": "Test Feature",
                        "description": "Test Feature description",
                        "created_at": "2026-03-02T10:00:00Z",
                        "updated_at": "2026-03-02T10:00:00Z",
                    }));

                Ok(())
            },
        )
        .interaction(
            "pull feature",
            || {
                pact.request()
                    .method("GET")
                    .path("/api/workspaces/{workspace_id}/issues/{issue_id}")
                    .header("Authorization", "Bearer {token}");

                pact.response()
                    .status(200)
                    .body(json!({
                        "id": "plane-issue-1",
                        "identifier": "PROJ-1",
                        "title": "Test Feature",
                        "description": "Test Feature description",
                        "state_detail": {"id": "backlog", "name": "Backlog"},
                        "priority": "medium",
                        "created_at": "2026-03-02T10:00:00Z",
                        "updated_at": "2026-03-02T10:00:00Z",
                    }));

                Ok(())
            },
        )
        .interaction(
            "list labels",
            || {
                pact.request()
                    .method("GET")
                    .path("/api/workspaces/{workspace_id}/labels")
                    .header("Authorization", "Bearer {token}");

                pact.response()
                    .status(200)
                    .body(json!({
                        "results": [
                            {"id": "label-1", "name": "backend", "color": "#FF0000"},
                            {"id": "label-2", "name": "frontend", "color": "#00FF00"},
                        ]
                    }));

                Ok(())
            },
        )
        .interaction(
            "create label",
            || {
                pact.request()
                    .method("POST")
                    .path("/api/workspaces/{workspace_id}/labels")
                    .header("Authorization", "Bearer {token}")
                    .body(json!({"name": "new-label", "color": "#0000FF"}));

                pact.response()
                    .status(201)
                    .body(json!({
                        "id": "label-3",
                        "name": "new-label",
                        "color": "#0000FF",
                    }));

                Ok(())
            },
        )
        .verify_sync_with_provider(|| {
            // Mock Plane API and verify client implementation
            let client = PlaneClient::new("http://localhost:8002", "test-token");

            // Verify push feature
            let response = client.push_feature(feature)?;
            assert_eq!(response.plane_id, "plane-issue-1");

            // Verify pull feature
            let pulled = client.pull_feature("plane-issue-1")?;
            assert_eq!(pulled.title, "Test Feature");

            // Verify label operations
            let labels = client.list_labels()?;
            assert_eq!(labels.len(), 2);

            let new_label = client.create_label("new-label", "#0000FF")?;
            assert_eq!(new_label.id, "label-3");

            Ok(())
        })?;

    pact.write_pact_file("pacts/agileplus-sync-plane.json")?;
    Ok(())
}
```

**Interactions to verify:**
- Push feature (create issue): request shape, response shape with plane_id
- Pull feature (get issue): response mapping to Feature struct
- List labels: pagination, field mapping
- Create label: request validation, response structure
- Error responses: 400 (invalid input), 401 (auth), 404 (not found), 500 (server error)

**Request/response shapes:**
- Requests include workspace_id, proper headers, and formatted field names
- Responses parse to expected types (PlaneIssue, Label)
- Timestamp fields convert correctly
- Enum fields (state, priority) map correctly

### T114: agileplus-api ↔ agileplus-dashboard Contract

Test the contract between the API (provider) and Dashboard htmx requests (consumer).

**Test file: tests/pacts/api_dashboard_pact.rs**

**Provider: agileplus-api REST endpoints**
**Consumer: Dashboard htmx client**

Create a Pact that verifies:

```rust
#[tokio::test]
async fn api_dashboard_pact() -> Result<()> {
    let mut pact = PactBuilder::new("agileplus-api", "agileplus-dashboard")
        .interaction(
            "get kanban dashboard",
            || {
                pact.request()
                    .method("GET")
                    .path("/api/dashboard/kanban")
                    .header("Accept", "text/html, application/xhtml+xml")
                    .header("HX-Request", "true");

                pact.response()
                    .status(200)
                    .header("Content-Type", "text/html; charset=utf-8")
                    .body_contains("<div id=\"kanban-board\"")
                    .body_contains("<div class=\"column\" data-status=\"created\"")
                    .body_contains("<div class=\"column\" data-status=\"specified\"");

                Ok(())
            },
        )
        .interaction(
            "get feature detail",
            || {
                pact.request()
                    .method("GET")
                    .path("/api/features/feature-1")
                    .header("Accept", "application/json");

                pact.response()
                    .status(200)
                    .header("Content-Type", "application/json")
                    .body(json!({
                        "id": "feature-1",
                        "title": "Test Feature",
                        "status": "Specified",
                        "description": "Test description",
                        "created_at": "2026-03-02T10:00:00Z",
                        "updated_at": "2026-03-02T10:00:00Z",
                    }));

                Ok(())
            },
        )
        .interaction(
            "post feature transition",
            || {
                pact.request()
                    .method("POST")
                    .path("/api/features/feature-1/transition")
                    .header("Content-Type", "application/json")
                    .body(json!({"target_state": "Implementing"}));

                pact.response()
                    .status(200)
                    .body(json!({
                        "id": "feature-1",
                        "title": "Test Feature",
                        "status": "Implementing",
                    }));

                Ok(())
            },
        )
        .verify_sync_with_provider(|| {
            let app = setup_test_app()?;

            // Verify kanban HTML contains expected elements
            let kanban = app.get("/api/dashboard/kanban")?;
            assert!(kanban.contains("kanban-board"));
            assert!(kanban.contains("status=\"created\""));

            // Verify feature detail JSON response
            let feature = app.get("/api/features/feature-1")?
                .json::<Feature>()?;
            assert_eq!(feature.title, "Test Feature");

            // Verify state transition
            let response = app.post("/api/features/feature-1/transition")?
                .json(&json!({"target_state": "Implementing"}))?;
            assert_eq!(response.status, 200);

            Ok(())
        })?;

    pact.write_pact_file("pacts/agileplus-api-dashboard.json")?;
    Ok(())
}
```

**Interactions to verify:**
- GET /api/dashboard/kanban: HTML partial with status columns
- GET /api/features/:id: JSON feature detail
- POST /api/features/:id/transition: State change response
- Response content types and headers
- HTML elements contain expected data attributes
- JSON responses match expected schema

### T115: agileplus-api ↔ agileplus-events Contract

Test the contract between the API (consumer) and EventStore (provider).

**Test file: tests/pacts/api_events_pact.rs**

**Provider: EventStore**
**Consumer: API event query endpoints**

Create a Pact that verifies:

```rust
#[tokio::test]
async fn api_events_pact() -> Result<()> {
    let mut pact = PactBuilder::new("agileplus-api", "agileplus-events")
        .interaction(
            "query events with filters",
            || {
                pact.request()
                    .method("SELECT")
                    .path("/events?entity_type=Feature&entity_id=1&limit=20&offset=0");

                pact.response()
                    .status(200)
                    .body(json!({
                        "data": [
                            {"sequence": 1, "event_type": "Created", "timestamp": "2026-03-02T10:00:00Z"},
                            {"sequence": 2, "event_type": "Transitioned", "timestamp": "2026-03-02T10:00:05Z"},
                        ],
                        "pagination": {
                            "total": 2,
                            "limit": 20,
                            "offset": 0,
                        }
                    }));

                Ok(())
            },
        )
        .interaction(
            "get single event",
            || {
                pact.request()
                    .method("SELECT")
                    .path("/events/event-id-1");

                pact.response()
                    .status(200)
                    .body(json!({
                        "sequence": 1,
                        "entity_type": "Feature",
                        "entity_id": "1",
                        "event_type": "Created",
                        "data": {"title": "Test"},
                        "hash": "hash1",
                        "timestamp": "2026-03-02T10:00:00Z",
                    }));

                Ok(())
            },
        )
        .verify_sync_with_provider(|| {
            let store = setup_test_event_store()?;
            let api = setup_test_api(store)?;

            // Verify pagination
            let response = api.get("/api/events?entity_type=Feature&entity_id=1&limit=20&offset=0")?
                .json::<PaginatedResponse<DomainEvent>>()?;
            assert_eq!(response.data.len(), 2);
            assert_eq!(response.pagination.total, 2);

            // Verify single event fetch
            let event = api.get("/api/events/event-id-1")?
                .json::<DomainEvent>()?;
            assert_eq!(event.sequence, 1);

            Ok(())
        })?;

    pact.write_pact_file("pacts/agileplus-api-events.json")?;
    Ok(())
}
```

**Interactions to verify:**
- Query events with entity filters: response shape, pagination
- Pagination: limit, offset, total count
- Filter application: entity_type, entity_id
- Single event fetch: full event detail
- Response consistency: event fields, types, ordering

## Definition of Done

- [ ] Pact file for events-sqlite contract created and passing
- [ ] Pact file for sync-plane contract created and passing
- [ ] Pact file for api-dashboard contract created and passing
- [ ] Pact file for api-events contract created and passing
- [ ] All provider implementations satisfy pact requirements
- [ ] All consumer implementations satisfy pact requirements
- [ ] Pact files committed to repository under `pacts/`
- [ ] CI: pact verification runs and enforces contracts
- [ ] Breaking changes to APIs require pact renegotiation
- [ ] Documentation: How to write and verify pact tests

## Activity Log

- 2026-03-02T20:47:39Z – claude-opus – shell_pid=33155 – lane=doing – Assigned agent via workflow command
- 2026-03-02T21:05:16Z – claude-opus – shell_pid=33155 – lane=for_review – Ready for review: 51 contract tests across 4 crate boundaries
- 2026-03-02T23:19:50Z – claude-opus – shell_pid=33155 – lane=done – Merged to main, 516 tests passing
