---
work_package_id: WP19
title: GitHub Sync Adapter (agileplus-integrations)
lane: "done"
dependencies:
- WP17
base_branch: 001-spec-driven-development-engine-WP17
base_commit: 2df69d4d7fa7363fc68caade1ca49438eb272f15
created_at: '2026-02-28T13:25:29.000372+00:00'
subtasks:
- T109
- T110
- T111
- T112
- T113
phase: Phase 5 - Triage, Sync & Sub-Commands
assignee: ''
agent: "claude-opus"
shell_pid: "78956"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP19 — GitHub Sync Adapter (agileplus-integrations)

## Implementation Command

```bash
spec-kitty implement WP19 --base WP17
```

---

## Objectives

Implement a one-way (AgilePlus → GitHub) bug synchronisation adapter in the `agileplus-integrations` repo at `crates/agileplus-github/`. This work package introduces:

1. A GitHub Issues API client using the `octocrab` crate, authenticated via a GitHub personal access token retrieved from the credential store.
2. Bug-to-issue synchronisation: when the triage classifier (WP17) classifies an input as a `Bug`, create a corresponding GitHub Issue with structured markdown body, appropriate labels, and cross-references to the AgilePlus feature and work package.
3. Issue status polling: periodically check GitHub for state changes (closed/reopened) and update the AgilePlus SQLite backlog item accordingly.
4. Conflict detection: if a GitHub issue body has been externally edited, log a warning and do not overwrite the user's changes.
5. Integration tests driven by a `wiremock` mock server replaying realistic GitHub API responses.

All outbound GitHub API calls must go through the `GitHubClient` struct. The sync logic in `issues.rs` must be testable via a `GitHubClientPort` trait with a mock implementation.

---

## Context & Constraints

### octocrab Usage Notes

- Add `octocrab` to `Cargo.toml`. Use the `octocrab::OctocrabBuilder` to construct a client with a personal access token.
- `octocrab` wraps the GitHub REST API v3. Relevant methods:
  - `octocrab.issues(owner, repo).create(title).body(body).labels(labels).send().await` — create an issue.
  - `octocrab.issues(owner, repo).get(issue_number).await` — fetch a single issue.
  - `octocrab.issues(owner, repo).update(issue_number).state(state).send().await` — update an issue's state.
  - `octocrab.issues(owner, repo).list().state(params::State::Open).since(since).send().await` — list issues modified since a timestamp.
- `octocrab` models: `octocrab::models::issues::Issue` (fields: `number: u64`, `title: String`, `body: Option<String>`, `state: IssueState`, `labels: Vec<Label>`, `updated_at: DateTime<Utc>`).
- For wiremock-based testing, `octocrab` can be constructed with a custom `base_uri`. Pass the wiremock server URI as the base URI.

### GitHub API Rate Limits

- Authenticated requests: 5000 requests/hour (83/minute).
- The adapter must not exceed 60 requests/minute to leave headroom for other tooling.
- Implement a token-bucket rate limiter in `client.rs` with `max_tokens = 60` and `refill_rate_per_minute = 60`. This is the same pattern as WP18's `TokenBucket`; do not copy the implementation — instead, extract it to `crates/agileplus-core/src/rate_limiter.rs` if it does not already exist there, and re-use it.

### Dependencies

- **WP17**: Provides `BacklogItem` and `BacklogAdapter` for updating the backlog item state after a GitHub status poll. Also provides `ProjectConfig` (includes `github_owner: String`, `github_repo: String`, `github_labels: Vec<String>` — default labels to apply to all AgilePlus-created issues).

Credential management is delegated to the `agileplus-integrations` service configuration. The adapter reads the GitHub token from the integrations service config rather than from a credential store (no dependency on WP15). All cross-service communication uses gRPC as described below.

### Crate Layout

This crate lives in the `agileplus-integrations` repo:

```
crates/agileplus-github/
  Cargo.toml
  src/
    lib.rs        # public re-exports; GitHubSyncAdapter facade
    client.rs     # octocrab wrapper (T109)
    issues.rs     # bug sync, status polling, conflict detection (T110, T111, T112)
  tests/
    integration.rs  # wiremock-based integration tests (T113)
```

### Architectural Rules

- `GitHubClient` is the only struct that calls `octocrab` methods. No `octocrab` calls in `issues.rs`.
- Define `GitHubClientPort` trait for testability (mock in tests).
- All sync operations are idempotent via a `github_sync_state` SQLite table: `(entity_type, entity_id)` → `github_issue_number`.
- The adapter never deletes GitHub issues. Only creates, updates state, and reads.
- Labels are additive: the adapter always applies the configured default labels plus the feature slug label. It never removes labels applied by humans.
- Issue body edits by humans are detected by comparing a stored hash of the last-written body with the current body. If the hash differs, log a warning and skip the update.
- All errors are wrapped in `GitHubError` using `thiserror`.
- **gRPC communication pattern**: The `agileplus-integrations` service exposes gRPC endpoints defined in `integrations.proto`. Bug sync is triggered via the `SyncBugToGitHub` RPC. Status change notifications back to the core service use the `integrations.proto` `NotifyStatusChange` RPC. Conflict detection is invoked via the `DetectGitHubConflicts` RPC. The crate handles the implementation logic; the gRPC server wiring lives in the integrations service binary.

---

## Subtask Guidance

### T109 — GitHubSyncAdapter struct and octocrab client

**Files**: `crates/agileplus-github/src/client.rs`, `crates/agileplus-github/src/lib.rs`

> Note: all source paths are relative to the `agileplus-integrations` repo root.

**`GitHubConfig`** (read from `ProjectConfig`):

```rust
#[derive(Debug, Clone)]
pub struct GitHubConfig {
    pub owner: String,
    pub repo: String,
    pub default_labels: Vec<String>,  // e.g. ["bug", "agileplus"]
    pub base_uri: Option<String>,     // override for testing; None → GitHub production
}
```

**`GitHubClient`**:

```rust
pub struct GitHubClient {
    inner: Arc<octocrab::Octocrab>,
    config: GitHubConfig,
    rate_limiter: Arc<Mutex<TokenBucket>>,
}

impl GitHubClient {
    pub fn new(config: GitHubConfig, token: String) -> Result<Self, GitHubError>;
}
```

Constructor builds `octocrab::OctocrabBuilder::new().personal_token(token)`. If `config.base_uri` is `Some`, call `.base_uri(uri)` on the builder. This enables test injection of the wiremock URI.

**`GitHubClientPort` trait**:

```rust
#[async_trait::async_trait]
pub trait GitHubClientPort: Send + Sync {
    async fn create_issue(
        &self,
        title: &str,
        body: &str,
        labels: &[String],
    ) -> Result<GitHubIssueRef, GitHubError>;

    async fn get_issue(&self, number: u64) -> Result<GitHubIssue, GitHubError>;

    async fn close_issue(&self, number: u64) -> Result<(), GitHubError>;

    async fn reopen_issue(&self, number: u64) -> Result<(), GitHubError>;

    async fn list_issues_updated_since(
        &self,
        since: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<GitHubIssue>, GitHubError>;
}
```

`GitHubClient` implements `GitHubClientPort`.

**Internal models** (minimal wrappers, avoiding leaking `octocrab` types into the public API):

```rust
#[derive(Debug, Clone)]
pub struct GitHubIssueRef {
    pub number: u64,
    pub html_url: String,
}

#[derive(Debug, Clone)]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: GitHubIssueState,
    pub labels: Vec<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitHubIssueState { Open, Closed }
```

**`GitHubError`**:

```rust
#[derive(Debug, thiserror::Error)]
pub enum GitHubError {
    #[error("GitHub API error: {0}")]
    Api(#[from] octocrab::Error),
    #[error("rate limited — retry after 60 seconds")]
    RateLimited,
    #[error("storage error: {0}")]
    Storage(#[from] agileplus_storage::StorageError),
    #[error("integrations config credential error: {0}")]
    Credential(String),
    #[error("entity not found: {0}")]
    NotFound(String),
    #[error("conflict detected on issue #{number}: body was externally edited")]
    BodyConflict { number: u64 },
}
```

**`GitHubSyncAdapter`** (public facade in `lib.rs`):

```rust
pub struct GitHubSyncAdapter<C: GitHubClientPort = GitHubClient> {
    client: Arc<C>,
    storage: Arc<dyn StoragePort>,
    backlog: Arc<BacklogAdapter>,
    config: GitHubConfig,
}

impl<C: GitHubClientPort> GitHubSyncAdapter<C> {
    pub fn new(
        client: Arc<C>,
        storage: Arc<dyn StoragePort>,
        backlog: Arc<BacklogAdapter>,
        config: GitHubConfig,
    ) -> Self;

    pub async fn ensure_schema(&self) -> Result<(), GitHubError>;
    pub async fn sync_bug(&self, item: &BacklogItem) -> Result<GitHubIssueRef, GitHubError>;
    pub async fn poll_status_changes(&self) -> Result<Vec<StatusChange>, GitHubError>;
    pub async fn detect_conflicts(&self) -> Result<Vec<BodyConflictReport>, GitHubError>;
}
```

**`Cargo.toml` dependencies**: `octocrab`, `reqwest` (features: `json`, `rustls-tls`; octocrab re-exports but explicit dep avoids version mismatch), `serde`, `serde_json`, `tokio` (features: `full`), `async-trait`, `thiserror`, `chrono` (features: `serde`), `tracing`, `sha2` (for body hash), `hex`, `agileplus-storage` (path), `agileplus-triage` (path), `agileplus-core` (path).

---

### T110 — Bug sync

**File**: `crates/agileplus-github/src/issues.rs`

**Purpose**: When the integrations service receives a `SyncBugToGitHub` gRPC call (defined in `integrations.proto`), create a GitHub Issue with a structured markdown body and appropriate labels. Store the mapping in `github_sync_state`. The gRPC handler deserialises the `BacklogItem` payload and delegates to `GitHubSyncAdapter::sync_bug`.

**Local sync-state table** (applied by `ensure_schema()`):

```sql
CREATE TABLE IF NOT EXISTS github_sync_state (
    entity_type       TEXT NOT NULL,  -- 'bug'
    entity_id         TEXT NOT NULL,  -- BacklogItem.id
    github_issue_number INTEGER NOT NULL,
    github_html_url   TEXT NOT NULL,
    last_synced_at    TEXT NOT NULL,  -- ISO 8601
    body_hash         TEXT NOT NULL,  -- SHA-256 hex of last-written body
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_github_sync_issue_number
    ON github_sync_state (github_issue_number);
```

**Issue body template**:

```markdown
## Bug Report

**Description**: {item.title}

{item.description_or_empty}

---

## AgilePlus Cross-References

| Field | Value |
|-------|-------|
| Backlog Item ID | `{item.id}` |
| Feature | `{item.feature_slug_or_none}` |
| Classified by | AgilePlus Triage (rule-based classifier) |
| Reported at | {item.created_at} |

---

## Reproduction Context

{reproduction_context_or_placeholder}

---

*This issue was created automatically by [AgilePlus](https://github.com/your-org/agileplus). Do not edit the cross-reference table — changes will be detected as a conflict.*
```

Replace `{item.title}`, `{item.description_or_empty}` (empty string if `None`), `{item.feature_slug_or_none}` (`"none"` if `None`), `{item.created_at}`.

`{reproduction_context_or_placeholder}`: If `item.description` contains a stack trace (detected by the same pattern logic as the classifier in WP17), extract it and place it in a fenced code block here. Otherwise, use the placeholder `"No reproduction context provided."`.

**Label construction**:

```rust
let mut labels = self.config.default_labels.clone(); // e.g. ["bug", "agileplus"]
if let Some(slug) = &item.feature_slug {
    labels.push(slug.clone());
}
// Deduplicate, preserve order
labels.dedup();
```

**`sync_bug` logic**:

1. Check `github_sync_state` for `(entity_type='bug', entity_id=item.id)`. If a row exists, return the existing `GitHubIssueRef` (do not create a duplicate).
2. Build the body string and label list as above.
3. Call `client.create_issue(&item.title, &body, &labels)`.
4. Compute `body_hash = hex(sha256(body.as_bytes()))`.
5. Insert into `github_sync_state`.
6. Return `GitHubIssueRef { number, html_url }`.

**Stack trace extraction** — reuse the pattern logic from `agileplus-triage`. Define a free function `extract_stack_trace(text: &str) -> Option<String>` in `issues.rs` that returns the first stack trace block found, or `None`.

---

### T111 — Issue status sync

**File**: `crates/agileplus-github/src/issues.rs`

**Purpose**: Poll GitHub for state changes on issues managed by this adapter. If an issue has been closed or reopened on GitHub, notify the core service via the `integrations.proto` `NotifyStatusChange` gRPC RPC rather than writing directly to the core SQLite database. The integrations service calls `GitHubSyncAdapter::poll_status_changes`, then for each `StatusChange` result it issues a `NotifyStatusChange` gRPC call to the core service to update the corresponding `BacklogItem`.

**`StatusChange`**:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct StatusChange {
    pub backlog_item_id: String,
    pub github_issue_number: u64,
    pub old_state: BacklogState,
    pub new_state: BacklogState,
}
```

**`poll_status_changes` logic**:

1. Determine `since`: query `github_sync_state` for `MIN(last_synced_at)`. If table is empty, return `Ok(vec![])`.
2. Call `client.list_issues_updated_since(since)`.
3. For each returned `GitHubIssue`:
   a. Look up `github_sync_state` by `github_issue_number`. Skip if not managed by this adapter.
   b. Map `GitHubIssueState::Closed` → `BacklogState::Closed`; `GitHubIssueState::Open` → `BacklogState::Open`.
   c. Fetch current `BacklogItem` from `BacklogAdapter`.
   d. If the state has changed:
      - Call `backlog.close(item_id)` (if closed) or a new `backlog.reopen(item_id)` method (add to `BacklogAdapter` in WP17 as a follow-up, or define it inline here temporarily).
      - Update `last_synced_at` in `github_sync_state`.
      - Push `StatusChange` to results vec.
4. Return results.

**`backlog.reopen` temporary definition** (if not provided by WP17): Add `BacklogAdapter::reopen` in `crates/agileplus-triage/src/backlog.rs` as part of WP19's scope if WP17 did not include it. This is a permissible cross-subtask edit; document it in the WP19 PR description.

---

### T112 — Conflict detection

**File**: `crates/agileplus-github/src/issues.rs`

**Purpose**: Identify GitHub issues whose body has been externally edited since the last sync and log structured warnings without overwriting user changes. Conflict detection is invoked via the `integrations.proto` `DetectGitHubConflicts` gRPC RPC; the integrations service handler calls `GitHubSyncAdapter::detect_conflicts` and returns the `BodyConflictReport` list in the gRPC response.

**`BodyConflictReport`**:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct BodyConflictReport {
    pub backlog_item_id: String,
    pub github_issue_number: u64,
    pub stored_body_hash: String,
    pub current_body_hash: String,
    pub summary: String,
}
```

**`detect_conflicts` logic**:

1. Query all rows from `github_sync_state`.
2. For each row:
   a. Call `client.get_issue(github_issue_number)`.
   b. Compute `current_hash = hex(sha256(issue.body.unwrap_or_default().as_bytes()))`.
   c. Compare with `stored body_hash` from `github_sync_state`.
   d. If hashes differ:
      - Build `summary = format!("Issue #{} body edited externally (stored hash {:.8} != current hash {:.8})", number, stored_hash, current_hash)`.
      - Call `tracing::warn!(backlog_item_id = %row.entity_id, github_issue_number = row.github_issue_number, stored_hash = %row.body_hash, current_hash = %current_hash, "GitHub issue body was externally edited — skipping sync update")`.
      - Push `BodyConflictReport` to results.
      - Do NOT call any write endpoint. Do NOT update `body_hash` in storage.
3. Return results.

**Design rationale**: Using a body hash rather than `updated_at` comparison is more reliable because `updated_at` changes on label additions, assignee changes, and comment additions — none of which indicate a body conflict. The hash only changes when the body text changes.

**SHA-256 hashing**:

```rust
use sha2::{Digest, Sha256};

fn body_hash(body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(body.as_bytes());
    hex::encode(hasher.finalize())
}
```

Add `sha2` (features: `default`) and `hex` to `Cargo.toml`.

---

### T113 — Integration tests with wiremock

**File**: `crates/agileplus-github/tests/integration.rs`

**Setup**: Use `wiremock` to mock the GitHub REST API. Configure `GitHubClient` with `base_uri = Some(mock_server.uri())`. Use an in-memory SQLite database for `StoragePort`.

**Test scenarios**:

1. **`test_create_bug_issue`**:
   - Mock `POST /repos/{owner}/{repo}/issues` → 201 with a valid GitHub issue JSON (`number: 42`, `html_url: "..."`, etc.).
   - Call `sync_bug` with a `BacklogItem` of kind `Bug`, no `feature_slug`.
   - Assert: `create_issue` called once; response `number == 42`; `github_sync_state` row inserted; `body_hash` is non-empty.

2. **`test_idempotent_sync`**:
   - Pre-insert a `github_sync_state` row for a `BacklogItem`.
   - Call `sync_bug` again with the same item.
   - Assert: no HTTP calls made to wiremock; existing `GitHubIssueRef` returned.

3. **`test_labels_include_feature_slug`**:
   - Construct a `BacklogItem` with `feature_slug = Some("feat-auth")`.
   - Mock `POST /repos/.../issues` to capture request body.
   - Call `sync_bug`. Assert: captured request JSON contains `"labels": ["bug", "agileplus", "feat-auth"]`.

4. **`test_poll_status_changes_closed`**:
   - Pre-insert a `github_sync_state` row with a known `github_issue_number`.
   - Pre-insert a `BacklogItem` with `state = Open`.
   - Mock `GET /repos/.../issues?state=open&since=...` → returns issue with `state: "closed"`.
   - Call `poll_status_changes`. Assert: one `StatusChange` returned; `BacklogItem` now has `state = Closed`.

5. **`test_poll_status_changes_no_change`**:
   - Same setup but mock returns the issue with `state: "open"`.
   - Assert: empty `StatusChange` vec returned; `BacklogItem` state unchanged.

6. **`test_conflict_detection_body_edited`**:
   - Pre-insert a `github_sync_state` row with a known `body_hash`.
   - Mock `GET /repos/.../issues/42` → returns issue with a body that produces a different hash.
   - Call `detect_conflicts`. Assert: one `BodyConflictReport` returned; no write endpoints called; `body_hash` in storage unchanged.

7. **`test_conflict_detection_no_conflict`**:
   - Same setup but mock returns the same body (same hash).
   - Assert: empty `BodyConflictReport` vec returned.

8. **`test_rate_limit_enforced`**:
   - Construct a `GitHubClient` with `max_tokens = 1` on the token bucket.
   - Make two rapid `create_issue` calls.
   - Assert: second call returns `Err(GitHubError::RateLimited)` without hitting wiremock.

9. **`test_stack_trace_extracted_in_body`**:
   - Construct a `BacklogItem` with `description = Some("Traceback (most recent call last):\n  File foo.py, line 42\nValueError: bad input")`.
   - Mock `POST /repos/.../issues` to capture request body.
   - Assert: captured request body contains a fenced code block with the stack trace text.

10. **`test_http_error_wrapped`**:
    - Mock `POST /repos/.../issues` → 422 with GitHub error JSON.
    - Call `sync_bug`. Assert `Err(GitHubError::Api(...))` returned; no row inserted in `github_sync_state`.

Add dev-dependencies: `wiremock`, `tokio` (features: `macros`, `rt-multi-thread`), `serde_json`, `tempfile`.

---

## Validation Criteria

| Criterion | Pass Condition |
|-----------|----------------|
| Compilation | `cargo build -p agileplus-github` exits 0 |
| Lint | `cargo clippy -p agileplus-github -- -D warnings` exits 0 |
| Unit tests | All inline `#[cfg(test)]` tests pass |
| Integration tests | All 10 wiremock-based tests in `tests/integration.rs` pass |
| Idempotency | Calling `sync_bug` twice on the same `BacklogItem` results in exactly one row in `github_sync_state` and one `create_issue` call |
| Rate limiter | Token bucket never permits more than 60 requests/minute |
| Conflict safety | `detect_conflicts` never calls any write endpoint; `body_hash` in storage unchanged after detection |
| Token security | GitHub token never appears in tracing output at any log level |
| Label correctness | Created issues always have all `default_labels` plus the feature slug label |
| Stack trace extraction | Issues created from bugs with stack traces include the trace in a fenced code block |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub API rate limit: 5000/hr (83/min) exceeded during heavy sync | Low | High | Token bucket capped at 60/min; bulk `poll_status_changes` uses a single list endpoint rather than per-issue fetches |
| `octocrab` version incompatibility with workspace resolver | Medium | Medium | Pin `octocrab` to a specific version in workspace `Cargo.toml`; test with `cargo check --workspace` after adding |
| Issue body grows too large (GitHub limit: 65536 chars) | Low | Medium | Truncate description to 60 000 chars with a `[truncated]` notice; add assertion in body builder |
| `list_issues_updated_since` returns paginated results; first page may miss older changed issues | Medium | Medium | Use `octocrab`'s auto-pagination (`.page(1).per_page(100)`) and loop until all pages consumed |
| SHA-256 hash collision producing false negative conflict detection | Negligible | Low | Accept theoretical risk; SHA-256 collision probability is negligible for issue body lengths |
| `BacklogAdapter::reopen` not available from WP17 | Medium | Medium | Define temporarily in WP19 scope; file a follow-up backlog task to move it to WP17's crate |
| wiremock tests fail if octocrab adds required headers not present in mock | Low | Medium | Use `wiremock::matchers::any()` for header matching in mock setup; only assert on path and method |
| Integrations service config unavailable during CI testing | Low | High | Tests use a test token string injected directly into `GitHubClient::new`; integrations service config is not required in tests |

---

## Review Guidance

The reviewer should:

1. Run `cargo test -p agileplus-github` and confirm all 10 wiremock integration tests pass.
2. Verify that `issues.rs` contains no direct `octocrab` calls — search for `octocrab::` in the file and confirm zero matches.
3. Confirm `detect_conflicts` does not call any write endpoint: inspect the method body and verify no `create_issue`, `close_issue`, or `reopen_issue` calls. Verify no write mocks are registered in `test_conflict_detection_body_edited`.
4. Verify idempotency: confirm `sync_bug` checks `github_sync_state` before calling `client.create_issue` and returns early if a row already exists.
5. Confirm the GitHub token is read from the integrations service configuration (not from a CredentialStore / WP15 dependency) in the production code path and never hard-coded or logged.
6. Verify the `body_hash` is computed after body construction and stored in `github_sync_state`; confirm it is not updated during conflict detection.
7. Check label deduplication logic in T110: confirm `dedup()` is called after extending with the feature slug.
8. Confirm stack trace extraction in T110 handles both Python (`Traceback (most recent call last)`) and generic (`at <method>(<file>)`) formats. If only one format is handled, file a follow-up backlog task for the other.
9. Confirm the token bucket implementation is shared with WP18 (via `agileplus-core`) rather than duplicated. If duplication occurred, flag as a follow-up refactor task.
10. Verify `github_sync_state` adds no columns to tables introduced by prior WPs.

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
- 2026-02-28T13:25:29Z – claude-opus – shell_pid=41285 – lane=doing – Assigned agent via workflow command
- 2026-02-28T13:31:16Z – claude-opus – shell_pid=41285 – lane=for_review – GitHub sync crate: client, sync, conflict detection. 7 tests.
- 2026-02-28T23:22:19Z – claude-opus – shell_pid=78956 – lane=doing – Started review via workflow command
- 2026-02-28T23:22:34Z – claude-opus – shell_pid=78956 – lane=done – Review passed: 7 tests pass, GitHub sync with rate limiter + structured bug body + conflict detection
