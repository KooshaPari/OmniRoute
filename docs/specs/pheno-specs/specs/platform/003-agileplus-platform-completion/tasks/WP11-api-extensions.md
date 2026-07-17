---
work_package_id: WP11
title: API Extensions
lane: "done"
dependencies: []
base_branch: main
base_commit: e7da019ae30cf53de57c72c295a0989f7ebe115c
created_at: '2026-03-02T12:06:10.086221+00:00'
subtasks: [T064, T065, T066, T067, T068, T069, T070]
shell_pid: "36298"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Extend `crates/agileplus-api` with REST endpoints, SSE, and API key auth.

Implementation command: `spec-kitty implement WP11 --base WP09`

## Subtasks

### T064: API Key Generation

Implement API key lifecycle on first startup:

**Process:**
- If no API key exists:
  1. Generate 32 random bytes, base64url-encode → plaintext key
  2. SHA-256 hash the key → store hash in `api_keys` table
  3. Write plaintext to `~/.config/agileplus/api-key` with 0600 permissions
  4. Print key to stdout on first run

**Example output:**
```
AgilePlus API initialized.
API Key: agp_1234567890abcdefghijklmnopqrst
Store this key securely; it won't be shown again.
(Also saved to ~/.config/agileplus/api-key)
```

### T065: API Key Middleware

Implement Axum extractor for authentication:

**Behavior:**
- Check `X-API-Key` header (or `?api_key=` query param)
- Hash the provided key, compare against stored hashes in DB
- Return 401 Unauthorized if invalid
- Skip auth for `/health` endpoint
- Skip auth for webhook endpoints (verify signature instead)

**Usage in handlers:**
```rust
async fn list_features(
    ApiKey: _,  // extractor ensures key is valid
    state: State<AppState>,
) -> impl IntoResponse { ... }
```

### T066: Feature REST Endpoints

Implement CRUD operations in `crates/agileplus-api`:

**Endpoints:**
- `GET /api/features` → list (with `?state=`, `?label=` filters)
- `GET /api/features/:id` → detail
- `POST /api/features` → create (body: `{title, description, state?, labels?}`)
- `PATCH /api/features/:id` → update
- `POST /api/features/:id/transition` → state transition (body: `{target_state}`)

All operations emit events to event store.

**Example:**
```bash
curl -H "X-API-Key: agp_..." http://localhost:8080/api/features?state=implementing

curl -X POST -H "X-API-Key: agp_..." \
  -d '{"title":"Auth API","state":"specified"}' \
  http://localhost:8080/api/features
```

### T067: WorkPackage REST Endpoints

Implement WP CRUD operations:

**Endpoints:**
- `GET /api/features/:fid/work-packages` → list WPs for feature
- `GET /api/work-packages/:id` → detail
- `POST /api/features/:fid/work-packages` → create WP under feature
- `PATCH /api/work-packages/:id` → update
- `POST /api/work-packages/:id/transition` → state transition

All operations emit events to event store.

### T068: Event Query Endpoints

Implement event retrieval and filtering:

**Endpoints:**
- `GET /api/events` → paginated list
  - Query params: `?entity_type=`, `?entity_id=`, `?since=`, `?until=`, `?type=`, `?actor=`, `?limit=`, `?offset=`
  - Returns: JSON array of events with timestamps, types, actors, payloads
- `GET /api/events/:id` → single event detail with full payload

**Example:**
```bash
curl -H "X-API-Key: agp_..." \
  "http://localhost:8080/api/events?entity_type=feature&since=1h&limit=50"
```

### T069: SSE Endpoint

Implement Server-Sent Events for real-time updates:

**Endpoint:** `GET /api/stream` (requires API key)

**Behavior:**
- Stream real-time events as SSE
- Subscribe to NATS broadcast channel
- Format:
  ```
  event: feature_updated
  data: {"id": 1, "state": "implementing", "title": "Auth Flow", ...}

  event: wp_updated
  data: {"id": 5, "state": "doing", "title": "Implement OAuth", ...}

  event: sync_conflict
  data: {"entity_type": "feature", "entity_id": 3, ...}
  ```
- Use tokio broadcast channel fed from NATS subscription

**Client usage:**
```javascript
const stream = new EventSource('/api/stream?api_key=agp_...');
stream.addEventListener('feature_updated', (e) => {
  const data = JSON.parse(e.data);
  console.log('Feature updated:', data);
});
```

### T070: Health Endpoint

Aggregate all service health checks:

**Endpoint:** `GET /health` (no auth required)

**Response (JSON):**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-02T12:34:56Z",
  "services": {
    "nats": {"status": "healthy", "latency_ms": 2},
    "dragonfly": {"status": "healthy", "latency_ms": 1},
    "neo4j": {"status": "healthy", "latency_ms": 5},
    "minio": {"status": "healthy", "latency_ms": 8},
    "sqlite": {"status": "healthy", "latency_ms": 3}
  },
  "api": {"status": "healthy", "uptime_seconds": 3600}
}
```

Status codes:
- `healthy` (all services up, latency acceptable)
- `degraded` (some services slow or one non-critical service down)
- `unavailable` (critical service down)

## Definition of Done

- All endpoints return correct responses and status codes
- API key auth enforced on protected endpoints
- SSE streams real-time events to clients
- Health check aggregates all services
- Error responses include descriptive messages

## Activity Log

- 2026-03-02T12:06:10Z – claude-opus – shell_pid=36298 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:15:12Z – claude-opus – shell_pid=36298 – lane=for_review – Ready for review: REST CRUD for features/WPs, API key auth with header+query param, SSE streaming, detailed health endpoint. All 14 integration tests pass.
- 2026-03-02T12:16:08Z – claude-opus – shell_pid=36298 – lane=for_review – Ready for review: REST API, API keys, SSE, health. 14 tests.
- 2026-03-02T23:19:32Z – claude-opus – shell_pid=36298 – lane=done – Merged to main, 516 tests passing
