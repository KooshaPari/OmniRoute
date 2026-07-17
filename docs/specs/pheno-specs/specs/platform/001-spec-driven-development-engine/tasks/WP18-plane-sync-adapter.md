---
work_package_id: WP18
title: Plane.so Sync Adapter (agileplus-integrations)
lane: "done"
dependencies:
- WP17
base_branch: 001-spec-driven-development-engine-WP17
base_commit: 2df69d4d7fa7363fc68caade1ca49438eb272f15
created_at: '2026-02-28T13:25:19.519790+00:00'
subtasks:
- T104
- T105
- T106
- T107
- T108
phase: Phase 5 - Triage, Sync & Sub-Commands
assignee: ''
agent: "claude-opus"
shell_pid: "78530"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP18 — Plane.so Sync Adapter (agileplus-integrations)

## Implementation Command

```bash
spec-kitty implement WP18 --base WP17
```

---

## Objectives

Implement a one-way (AgilePlus → Plane.so) synchronisation adapter in the `agileplus-integrations` repo at `crates/agileplus-plane/`. This work package introduces:

1. A Plane.so REST API client authenticated via an API key supplied through the integrations service configuration.
2. Feature-to-issue and work-package-to-sub-issue synchronisation triggered via gRPC requests from core (integrations.proto `SyncFeatureToPlane`, `SyncWPToPlane`).
3. Conflict detection invoked via integrations.proto `DetectPlaneConflicts`, identifying Plane.so-side edits made since the last sync and returning conflict reports without overwriting user changes.
4. Integration tests driven by a `wiremock` mock server that replays realistic Plane.so API responses.

All outbound HTTP calls must go through the client struct; no `reqwest` calls may appear outside `client.rs`. The sync logic in `sync.rs` must be unit-testable with a mock client trait.

---

## Context & Constraints

### Plane.so API Reference

- Base URL (configurable): `https://api.plane.so/api/v1/`
- Authentication: `X-API-Key: <token>` header on every request.
- Workspace and project are identified by slug, not UUID, in the URL path.
- Relevant endpoints:
  - `POST /workspaces/{workspace_slug}/projects/{project_slug}/issues/` — create issue
  - `PATCH /workspaces/{workspace_slug}/projects/{project_slug}/issues/{issue_id}/` — update issue
  - `GET /workspaces/{workspace_slug}/projects/{project_slug}/issues/{issue_id}/` — get issue
  - `GET /workspaces/{workspace_slug}/projects/{project_slug}/issues/?updated_at__gt={iso8601}` — list issues updated since timestamp
  - Sub-issues are created as issues with a `parent` field set to the parent issue ID.
- Rate limits: 60 requests/minute on the free tier; 600 requests/minute on paid. The adapter must not exceed 50 requests/minute to leave headroom for manual usage.
- Plane.so issue states are workspace-level and referenced by UUID. The adapter maps AgilePlus states to Plane.so state UUIDs via a config-supplied mapping.

### Dependencies

- **WP17**: Provides the `integrations.proto` service definition and the gRPC server scaffold in `agileplus-integrations`. WP18 implements the Plane.so handler methods (`SyncFeatureToPlane`, `SyncWPToPlane`, `DetectPlaneConflicts`) registered on that server.

Credential management (API key retrieval) is delegated to the integrations service configuration; WP18 reads the key from the service config struct passed at construction time and must not hard-code or log API keys.

### Crate Layout

This crate lives in the `agileplus-integrations` repository:

```
crates/agileplus-plane/
  Cargo.toml
  src/
    lib.rs        # public re-exports; PlaneSyncAdapter facade
    client.rs     # HTTP client (T104)
    sync.rs       # feature sync, WP sync, conflict detection (T105, T106, T107)
  tests/
    integration.rs  # wiremock-based integration tests (T108)
```

### Architectural Rules

- `PlaneClient` is the only struct that calls `reqwest`. Everything else calls `PlaneClient` methods.
- Define a `PlaneClientPort` trait so `sync.rs` can be tested with a mock that does not open network connections.
- Sync operations are idempotent: running them twice must not create duplicate issues. Use a local SQLite table `plane_sync_state` (added by `ensure_schema()`) to map `(entity_type, entity_id)` → `plane_issue_id`.
- The adapter does not delete Plane.so issues. Archiving or deletion is a manual operation.
- All HTTP errors must be wrapped in `PlaneError` (via `thiserror`). Never panic on HTTP failure.
- **gRPC communication pattern**: Core (`agileplus-core`) initiates all sync operations by sending gRPC requests to the integrations service over the `integrations.proto` interface. The `agileplus-plane` crate implements the server-side handler methods. Core never calls Plane.so REST endpoints directly; it exclusively uses the gRPC contract. The integrations service owns credential loading and passes the resolved API key to `PlaneClient::new` at handler construction time.

### Rate Limiting

Implement a simple token-bucket rate limiter in `client.rs` capped at 50 requests/minute. Use `std::time::Instant` and a `Mutex<TokenBucket>`. No external rate-limiter crate.

---

## Subtask Guidance

### T104 — PlaneSyncAdapter struct and HTTP client

**Files**: `crates/agileplus-plane/src/client.rs`, `crates/agileplus-plane/src/lib.rs` (in `agileplus-integrations` repo)

**`PlaneConfig`** (read from `ProjectConfig`):

```rust
#[derive(Debug, Clone)]
pub struct PlaneConfig {
    pub base_url: String,          // e.g. "https://api.plane.so/api/v1"
    pub workspace_slug: String,
    pub project_slug: String,
    pub state_map: HashMap<String, String>,  // agileplus_state -> plane_state_uuid
}
```

**`PlaneClient`**:

```rust
pub struct PlaneClient {
    http: reqwest::Client,
    config: PlaneConfig,
    api_key: String,
    rate_limiter: Arc<Mutex<TokenBucket>>,
}

impl PlaneClient {
    pub fn new(config: PlaneConfig, api_key: String) -> Self;

    pub async fn create_issue(&self, body: &CreateIssueRequest) -> Result<PlaneIssue, PlaneError>;
    pub async fn update_issue(&self, issue_id: &str, body: &UpdateIssueRequest) -> Result<PlaneIssue, PlaneError>;
    pub async fn get_issue(&self, issue_id: &str) -> Result<PlaneIssue, PlaneError>;
    pub async fn list_issues_updated_since(&self, since: &str) -> Result<Vec<PlaneIssue>, PlaneError>;
}
```

**`PlaneClientPort` trait** (for testability):

```rust
#[async_trait::async_trait]
pub trait PlaneClientPort: Send + Sync {
    async fn create_issue(&self, body: &CreateIssueRequest) -> Result<PlaneIssue, PlaneError>;
    async fn update_issue(&self, issue_id: &str, body: &UpdateIssueRequest) -> Result<PlaneIssue, PlaneError>;
    async fn get_issue(&self, issue_id: &str) -> Result<PlaneIssue, PlaneError>;
    async fn list_issues_updated_since(&self, since: &str) -> Result<Vec<PlaneIssue>, PlaneError>;
}
```

`PlaneClient` implements `PlaneClientPort`.

**Request/response types**:

```rust
#[derive(Serialize)]
pub struct CreateIssueRequest {
    pub name: String,
    pub state: String,          // plane_state_uuid
    pub identifier: Option<String>,
    pub parent: Option<String>, // parent issue ID for sub-issues
}

#[derive(Serialize)]
pub struct UpdateIssueRequest {
    pub name: Option<String>,
    pub state: Option<String>,
    pub link: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct PlaneIssue {
    pub id: String,
    pub name: String,
    pub state: String,
    pub identifier: Option<String>,
    pub parent: Option<String>,
    pub updated_at: String,
}
```

**Token bucket implementation**:

```rust
struct TokenBucket {
    tokens: u32,
    max_tokens: u32,
    last_refill: Instant,
    refill_rate_per_minute: u32,
}

impl TokenBucket {
    fn acquire(&mut self) -> bool {
        self.refill();
        if self.tokens > 0 { self.tokens -= 1; true } else { false }
    }
    fn refill(&mut self) {
        let elapsed = self.last_refill.elapsed().as_secs_f64();
        let new_tokens = (elapsed / 60.0 * self.refill_rate_per_minute as f64) as u32;
        if new_tokens > 0 {
            self.tokens = (self.tokens + new_tokens).min(self.max_tokens);
            self.last_refill = Instant::now();
        }
    }
}
```

If `acquire()` returns `false`, `PlaneClient` methods must return `Err(PlaneError::RateLimited)` without making the HTTP call.

**`PlaneError`**:

```rust
#[derive(Debug, thiserror::Error)]
pub enum PlaneError {
    #[error("HTTP error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("request error: {0}")]
    Request(#[from] reqwest::Error),
    #[error("rate limited — retry after 60 seconds")]
    RateLimited,
    #[error("storage error: {0}")]
    Storage(#[from] agileplus_storage::StorageError),
    #[error("entity not found: {0}")]
    NotFound(String),
    #[error("conflict detected: {0}")]
    Conflict(String),
}
```

**`PlaneSyncAdapter`** (public facade in `lib.rs`):

```rust
pub struct PlaneSyncAdapter<C: PlaneClientPort = PlaneClient> {
    client: Arc<C>,
    storage: Arc<dyn StoragePort>,
    config: PlaneConfig,
}

impl<C: PlaneClientPort> PlaneSyncAdapter<C> {
    pub fn new(client: Arc<C>, storage: Arc<dyn StoragePort>, config: PlaneConfig) -> Self;
    pub async fn ensure_schema(&self) -> Result<(), PlaneError>;
    pub async fn sync_feature(&self, feature: &Feature) -> Result<(), PlaneError>;
    pub async fn sync_work_package(&self, wp: &WorkPackage) -> Result<(), PlaneError>;
    pub async fn detect_conflicts(&self) -> Result<Vec<ConflictReport>, PlaneError>;
}
```

Add `Cargo.toml` dependencies: `reqwest` (features: `json`, `rustls-tls`), `serde`, `serde_json`, `tokio` (features: `full`), `async-trait`, `thiserror`, `agileplus-storage` (path), `agileplus-core` (path, for `Feature` and `WorkPackage` types).

---

### T105 — Feature sync

**File**: `crates/agileplus-plane/src/sync.rs` (in `agileplus-integrations` repo)

**Purpose**: Implement the `SyncFeatureToPlane` gRPC handler (integrations.proto). When invoked by core via gRPC, create or update the corresponding Plane.so issue for the supplied feature.

**Local sync-state table** (applied by `ensure_schema()`):

```sql
CREATE TABLE IF NOT EXISTS plane_sync_state (
    entity_type  TEXT NOT NULL,   -- 'feature' | 'work_package'
    entity_id    TEXT NOT NULL,
    plane_issue_id TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    PRIMARY KEY (entity_type, entity_id)
);
```

**`sync_feature` logic**:

1. Look up `plane_sync_state` for `(entity_type='feature', entity_id=feature.id)`.
2. Map `feature.state` to a Plane.so state UUID via `PlaneConfig::state_map`. If no mapping exists, use a configured default UUID or return `Err(PlaneError::NotFound(...))`.
3. If no existing `plane_issue_id`:
   - Call `client.create_issue(CreateIssueRequest { name: feature.title.clone(), state: plane_state_uuid, identifier: Some(feature.slug.clone()), parent: None })`.
   - Insert row into `plane_sync_state`.
4. If `plane_issue_id` exists:
   - Call `client.update_issue(plane_issue_id, UpdateIssueRequest { name: Some(feature.title.clone()), state: Some(plane_state_uuid), link: None })`.
   - Update `last_synced_at` in `plane_sync_state`.
5. Return `Ok(())`.

**Field mapping**:

| AgilePlus field | Plane.so field |
|-----------------|----------------|
| `feature.title` | `issue.name` |
| `feature.state` (mapped via state_map) | `issue.state` (UUID) |
| `feature.slug` | `issue.identifier` |

---

### T106 — Work package sync

**File**: `crates/agileplus-plane/src/sync.rs` (in `agileplus-integrations` repo)

**Purpose**: Implement the `SyncWPToPlane` gRPC handler (integrations.proto). When invoked by core via gRPC, create or update the corresponding Plane.so sub-issue (child of the parent feature's issue) for the supplied work package.

**`sync_work_package` logic**:

1. Look up `plane_sync_state` for `(entity_type='work_package', entity_id=wp.id)`.
2. Resolve the parent feature's `plane_issue_id` from `plane_sync_state` (entity_type='feature', entity_id=wp.feature_id). If missing, sync the parent feature first, then retry. Limit to one retry; return error if still missing.
3. Map `wp.state` to a Plane.so state UUID.
4. If no existing `plane_issue_id`:
   - Call `client.create_issue(CreateIssueRequest { name: wp.title.clone(), state: plane_state_uuid, identifier: None, parent: Some(parent_plane_issue_id) })`.
   - Insert into `plane_sync_state`.
5. If `plane_issue_id` exists:
   - Build `UpdateIssueRequest`: include `name`, `state`, and `link = wp.pr_url.clone()` if `wp.pr_url` is `Some`.
   - Call `client.update_issue`.
   - Update `last_synced_at`.

**Field mapping**:

| AgilePlus field | Plane.so field |
|-----------------|----------------|
| `wp.title` | `sub-issue.name` |
| `wp.state` (mapped via state_map) | `sub-issue.state` (UUID) |
| `wp.pr_url` | `sub-issue.link` |
| `parent feature's plane_issue_id` | `sub-issue.parent` |

---

### T107 — Conflict detection

**File**: `crates/agileplus-plane/src/sync.rs` (in `agileplus-integrations` repo)

**Purpose**: Implement the `DetectPlaneConflicts` gRPC handler (integrations.proto). When invoked by core via gRPC, poll Plane.so for issues modified after the last sync timestamp. If a remote edit is detected on an issue managed by AgilePlus, log a structured warning, do not overwrite, and return the conflict reports in the gRPC response.

**`ConflictReport`**:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ConflictReport {
    pub entity_type: String,
    pub entity_id: String,
    pub plane_issue_id: String,
    pub plane_updated_at: String,
    pub last_synced_at: String,
    pub diff_summary: String,
}
```

**`detect_conflicts` logic**:

1. Query `plane_sync_state` for all rows where `last_synced_at` is not null.
2. Find the earliest `last_synced_at` across all rows. Call `client.list_issues_updated_since(earliest_last_synced_at)`.
3. For each returned Plane.so issue:
   a. Look up the matching row in `plane_sync_state` by `plane_issue_id`.
   b. If `plane_issue.updated_at > plane_sync_state.last_synced_at`, a conflict exists.
   c. Fetch the current AgilePlus entity (feature or WP) from storage.
   d. Build a `diff_summary` string listing which fields differ: e.g., `"name: 'Old Title' → 'New Title (edited in Plane)'`.
   e. Push a `ConflictReport` to the result vec.
4. Log each conflict at `WARN` level using `tracing::warn!` with structured fields: `entity_type`, `entity_id`, `plane_issue_id`, `diff_summary`.
5. Do not update the AgilePlus database or call any Plane.so write endpoint.
6. Return the full list of `ConflictReport` values to the caller.

**Logging setup**: The crate must not configure a tracing subscriber. That is the responsibility of the CLI binary. The crate only calls `tracing::warn!` / `tracing::info!` macros.

Add `tracing` to `Cargo.toml`.

---

### T108 — Integration tests with wiremock

**File**: `crates/agileplus-plane/tests/integration.rs`

**Setup**: Use `wiremock` crate to spin up a local HTTP server that mocks the Plane.so API. Configure `PlaneClient` with `base_url` set to `wiremock_server.uri()`.

**Test scenarios**:

1. **`test_create_feature_issue`**: Mock `POST /workspaces/.../issues/` to return a 201 with a valid `PlaneIssue` JSON. Call `sync_feature` with a new feature (no existing sync state). Assert issue created, `plane_sync_state` row inserted.

2. **`test_update_feature_issue`**: Pre-insert a `plane_sync_state` row. Mock `PATCH /workspaces/.../issues/{id}/` to return 200. Call `sync_feature` again. Assert PATCH called (not POST), `last_synced_at` updated.

3. **`test_create_wp_sub_issue`**: Mock `GET /workspaces/.../issues/{parent_id}/` and `POST`. Call `sync_work_package` with a WP whose feature already has a sync-state row. Assert sub-issue created with correct `parent`.

4. **`test_conflict_detection`**: Pre-insert sync-state rows. Mock `GET /workspaces/.../issues/?updated_at__gt=...` to return an issue with `updated_at` newer than `last_synced_at`. Call `detect_conflicts`. Assert one `ConflictReport` returned, no write endpoints called.

5. **`test_rate_limit_respected`**: Set `max_tokens = 1` on the token bucket. Make two rapid calls. Assert the second returns `Err(PlaneError::RateLimited)` without contacting wiremock.

6. **`test_http_error_wrapped`**: Mock `POST` to return 500. Assert `Err(PlaneError::Http { status: 500, .. })` returned.

Add dev-dependencies: `wiremock`, `tokio` (features: `macros`, `rt-multi-thread`), `serde_json`.

---

## Validation Criteria

| Criterion | Pass Condition |
|-----------|----------------|
| Compilation | `cargo build -p agileplus-plane` exits 0 |
| Lint | `cargo clippy -p agileplus-plane -- -D warnings` exits 0 |
| Unit tests | All inline `#[cfg(test)]` tests pass |
| Integration tests | All 6 wiremock-based tests in `tests/integration.rs` pass |
| Idempotency | Running `sync_feature` twice on the same feature results in exactly one row in `plane_sync_state` and one PATCH call (not two POSTs) |
| Rate limiter | Token bucket never permits more than 50 requests/minute in load test |
| Conflict safety | `detect_conflicts` never calls any Plane.so write endpoint |
| API key security | No API key appears in log output at any log level |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Plane.so API schema changes (new required fields, renamed endpoints) | Medium | High | Pin API version in base URL (e.g., `/api/v1/`); add integration test that validates response deserialization; monitor Plane.so changelog |
| API rate limit exceeded on bulk sync | Medium | Medium | Token bucket rate limiter capped at 50/min; bulk sync operations should be batched with `tokio::time::sleep` between batches |
| State UUID mapping missing for new AgilePlus states | Medium | Medium | Return `PlaneError::NotFound` with descriptive message; document required `state_map` entries in `ProjectConfig` |
| `plane_sync_state` table grows unboundedly | Low | Low | Add a `VACUUM` / prune step in a future WP; not blocking for WP18 |
| Wiremock tests flaky due to port conflicts | Low | Low | Use `wiremock::MockServer::start().await` which binds to a random available port |
| Credential store unavailable at test time | Low | High | Integration tests use a hardcoded test API key string, never the real credential store; unit tests mock `PlaneClientPort` |
| reqwest TLS errors in CI environments | Low | Medium | Use `rustls-tls` feature instead of native TLS; document in `Cargo.toml` comment |

---

## Review Guidance

The reviewer should:

1. Run `cargo test -p agileplus-plane` and confirm all tests pass, including the 6 wiremock integration tests.
2. Verify that `PlaneClient` is the only struct that calls `reqwest` methods; search `sync.rs` for any direct `reqwest` usage.
3. Confirm that `detect_conflicts` never calls `create_issue` or `update_issue` — inspect the method body and verify no write mocks are registered in `test_conflict_detection`.
4. Check that no API key is logged: search for `api_key` in log macro calls; confirm it only appears in the `X-API-Key` header construction.
5. Verify idempotency by reading `sync_feature` and confirming the branch that handles an existing `plane_sync_state` row calls PATCH, not POST.
6. Confirm `plane_sync_state` schema adds no columns to any table introduced by prior storage WPs.
7. Review the `TokenBucket` implementation for correctness: verify `refill()` uses elapsed time correctly and `max_tokens` is respected.
8. Confirm `PlaneClientPort` trait is sealed from external implementation by being in a private module (or document that external implementation is intentional).

---

## Activity Log

```yaml
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
```
- 2026-02-28T13:25:19Z – claude-opus – shell_pid=40452 – lane=doing – Assigned agent via workflow command
- 2026-02-28T13:31:05Z – claude-opus – shell_pid=40452 – lane=for_review – Plane sync crate: client, sync, conflict detection. 6 tests.
- 2026-02-28T23:22:00Z – claude-opus – shell_pid=78530 – lane=doing – Started review via workflow command
- 2026-02-28T23:22:14Z – claude-opus – shell_pid=78530 – lane=done – Review passed: 6 tests pass, rate limiter + sync state + SHA-256 conflict detection
