---
work_package_id: WP08
title: Plane.so Bidirectional Sync
lane: "done"
dependencies: []
base_branch: main
base_commit: 6480046aaf890b6cd67e6f88cd4ec44d737067d4
created_at: '2026-03-02T11:55:34.889965+00:00'
subtasks: [T046, T047, T048, T049, T050, T051, T052]
shell_pid: "61759"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Extend `crates/agileplus-plane` with bidirectional sync, webhook ingestion, state mapping, and label management.

Implementation command: `spec-kitty implement WP08 --base WP03`

## Subtasks

### T046: State Mapping

Create a configurable mapping between Plane.so state groups and AgilePlus FeatureState:

- Backlog → created
- Unstarted (Todo) → specified/researched/planned (use closest match by ordinal)
- Started (In Progress) → implementing
- Completed (Done) → validated/shipped
- Cancelled → (terminal, no AgilePlus equivalent — log warning)

Store mapping in a `PlaneStateMapper` struct with:
- `from_plane(state_group, state_name) → FeatureState`
- `to_plane(FeatureState) → (state_group, state_id)`

Load custom mappings from config if present.

### T047: Webhook Endpoint

Add an axum route `POST /webhooks/plane` to handle Plane.so webhooks:

- Verify HMAC-SHA256 signature using configured webhook secret
- Parse webhook payload (event type: issues:create, issues:update, issues:delete)
- Extract issue data, map to AgilePlus entity
- Emit inbound sync event to NATS subject `agileplus.sync.plane.inbound`
- Return 200 OK on success, 401 on bad signature, 400 on parse error

### T048: Outbound Sync

Implement `push_feature(feature)` and `push_work_package(wp)` methods:

- If feature has no plane_issue_id → create issue via Plane API `POST /api/v1/workspaces/{slug}/projects/{id}/issues/`
- If feature has plane_issue_id → update via PATCH
- Map FeatureState → Plane state ID using PlaneStateMapper
- Include title, description, state, priority, labels
- Rate limit: respect 60 req/min (use backoff/queue from T052)

### T049: Inbound Sync

Process webhook events:

- On issues:create → check if tracked, if not optionally auto-import
- On issues:update → compare content_hash, update local state if changed
- On issues:delete → mark local entity as deleted/archived
- Emit event to event store for audit trail

### T050: Label Sync

Bidirectional label CRUD:

- `GET /api/v1/workspaces/{slug}/projects/{id}/labels/` → sync to local
- `POST /api/v1/workspaces/{slug}/projects/{id}/labels/` → create remote from local
- Map Plane labels to AgilePlus `Feature.labels Vec<String>`

### T051: Content Hash Tracking

Before sync, compute SHA-256 of (title + description + state + labels). Compare with `SyncMapping.content_hash`. If different on both sides → conflict. If different on one side → normal sync.

### T052: Sync Queue with Retry

Bounded in-memory queue (capacity: 1000). On Plane.so API failure → add to retry queue with exponential backoff (1s, 2s, 4s, ..., max 5min). Drain queue on successful connection. Persist queue to SQLite on shutdown, reload on startup.

## Definition of Done

- Can push features to Plane.so
- Receive webhooks and process inbound sync events
- Map states bidirectionally (AgilePlus ↔ Plane.so)
- Detect conflicts via content hash
- Handle rate limiting and retries gracefully

## Activity Log

- 2026-03-02T11:55:35Z – claude-opus – shell_pid=61759 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:05:37Z – claude-opus – shell_pid=61759 – lane=for_review – Ready for review: Plane.so bidirectional sync with state mapping, webhooks, outbound/inbound sync, label sync, content-hash conflict detection, and SQLite-backed retry queue. 41 tests passing.
- 2026-03-02T23:19:28Z – claude-opus – shell_pid=61759 – lane=done – Merged to main, 516 tests passing
