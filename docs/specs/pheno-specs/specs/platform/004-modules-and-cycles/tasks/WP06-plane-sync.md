---
work_package_id: WP06
title: Plane.so Module & Cycle Sync
lane: planned
dependencies: []
subtasks: [T029, T030, T031, T032, T033]
phase: Phase 5 - Sync
estimated_lines: 400
frs: [FR-P01, FR-P02, FR-P03, FR-P04, FR-P05]
priority: P2
---

# WP06: Plane.so Module & Cycle Sync

## Implementation Command

```bash
spec-kitty implement WP06 --base WP02
```

WP02 must be merged. WP06 can run in parallel with WP03, WP04, and WP05.

## Objectives

Extend the `agileplus-plane` crate with bidirectional sync for Modules and Cycles. Outbound:
when AgilePlus creates or updates a Module or Cycle, push to Plane.so's Modules/Cycles API.
Inbound: when Plane sends a webhook for Module/Cycle changes, update AgilePlus. Assignment sync:
when a Feature is assigned to a Module or Cycle in AgilePlus, mirror the Plane issue-to-module
and issue-to-cycle relationship. Use the existing `sync_mappings` infrastructure with an
`entity_type` discriminator.

### Success Criteria

- `PlaneClient::create_module(...)` sends `POST /api/v1/workspaces/{slug}/projects/{id}/modules/`
  and returns the Plane module id.
- `PlaneClient::create_cycle(...)` sends `POST /api/v1/workspaces/{slug}/projects/{id}/cycles/`
  and returns the Plane cycle id.
- Module/Cycle create in AgilePlus triggers `push_module`/`push_cycle` and stores a
  `sync_mappings` row with `entity_type = "module"` or `"cycle"`.
- Inbound webhook for `module.updated` updates `Module.friendly_name` in AgilePlus.
- Feature-to-Module assignment syncs the Plane issue to the Plane module via
  `POST /api/v1/workspaces/{slug}/projects/{id}/modules/{module_id}/issues/`.
- Feature-to-Cycle assignment syncs via the Plane cycle issues endpoint.
- Conflict strategy from config is respected (`local-wins`, `remote-wins`, `manual`).
- `cargo test -p agileplus-plane` unit tests (with mock HTTP) pass.

## Context & Constraints

- **Crate**: `crates/agileplus-plane`. Examine existing `PlaneClient`, `outbound.rs`,
  `inbound.rs`, and `webhook.rs` to understand the current structure. Follow existing patterns
  exactly -- do not introduce new async runtimes or HTTP clients.
- **HTTP client**: `reqwest` (already a dependency). Use the existing `PlaneClient` struct that
  holds workspace slug, project id, API key, and base URL. Do not hardcode URLs.
- **sync_mappings table**: Already exists from earlier specs. The table has columns
  `(local_id, plane_id, entity_type, conflict_strategy, last_synced_at, ...)`. If `entity_type`
  does not yet exist as a column, add a migration in `agileplus-sqlite` (increment to 007 or
  whichever is next). Check the current schema first.
- **Error handling**: All sync failures return `DomainError::Agent(...)` or a crate-specific
  `SyncError`. Map HTTP errors clearly; do NOT silently swallow failures.
- **Webhook payload**: Plane webhook bodies are JSON. Define typed structs for
  `PlaneModuleWebhook` and `PlaneCycleWebhook` using `serde::Deserialize`.
- **No test calls to real Plane API**: Unit tests MUST use `wiremock` or `mockito` (check which
  is already in `dev-dependencies`) to mock the HTTP server. Never call a real Plane endpoint
  in tests.
- **Files**:
  - MODIFIED: `crates/agileplus-plane/src/client.rs` (or wherever `PlaneClient` lives)
  - MODIFIED: `crates/agileplus-plane/src/outbound.rs`
  - MODIFIED: `crates/agileplus-plane/src/inbound.rs`
  - MODIFIED: `crates/agileplus-plane/src/webhook.rs`
  - Possibly NEW: `crates/agileplus-sqlite/src/migrations/007_sync_entity_type.sql` if the
    `sync_mappings.entity_type` column does not exist

---

## Subtask Guidance

### T029 - Extend PlaneClient with Module API Methods

**Purpose**: Add the low-level HTTP methods for Plane Module CRUD. Traces to FR-P01.

**File**: `crates/agileplus-plane/src/client.rs`

**Steps**:

1. Study the existing client to understand URL construction and request signing. Plane API base
   URL pattern: `{base_url}/api/v1/workspaces/{workspace_slug}/projects/{project_id}/modules/`.

2. Define Plane API request/response structs:

   ```rust
   #[derive(Debug, Serialize)]
   pub struct PlaneCreateModuleRequest {
       pub name: String,
       #[serde(skip_serializing_if = "Option::is_none")]
       pub description: Option<String>,
   }

   #[derive(Debug, Deserialize)]
   pub struct PlaneModuleResponse {
       pub id: String,       // Plane's UUID
       pub name: String,
       pub description: Option<String>,
   }
   ```

3. Add to `PlaneClient` (Traces to FR-P01):

   ```rust
   /// Create a Module in Plane.so. Returns Plane's module UUID.
   pub async fn create_module(
       &self,
       req: &PlaneCreateModuleRequest,
   ) -> Result<PlaneModuleResponse, SyncError> {
       let url = format!(
           "{}/api/v1/workspaces/{}/projects/{}/modules/",
           self.base_url, self.workspace_slug, self.project_id
       );
       let resp = self.http_client
           .post(&url)
           .bearer_auth(&self.api_key)
           .json(req)
           .send()
           .await
           .map_err(|e| SyncError::Http(e.to_string()))?;
       if !resp.status().is_success() {
           return Err(SyncError::Api(format!(
               "Plane module create failed: HTTP {}",
               resp.status()
           )));
       }
       resp.json::<PlaneModuleResponse>().await.map_err(|e| SyncError::Deserialize(e.to_string()))
   }

   /// Update a Module name/description in Plane.so (PATCH).
   pub async fn update_module(
       &self,
       plane_module_id: &str,
       req: &PlaneCreateModuleRequest,
   ) -> Result<(), SyncError> { ... }

   /// Delete a Module in Plane.so.
   pub async fn delete_module(&self, plane_module_id: &str) -> Result<(), SyncError> { ... }

   /// Add a Plane issue to a Plane module.
   pub async fn add_issue_to_module(
       &self,
       plane_module_id: &str,
       plane_issue_id: &str,
   ) -> Result<(), SyncError> { ... }
   ```

4. Write unit tests with mock HTTP server:
   - `create_module_sends_post`: mock server expects `POST /modules/`, respond with a JSON body,
     verify the returned `PlaneModuleResponse.id` matches.
   - `create_module_http_error_propagates`: mock responds 500, verify `Err(SyncError::Api(...))`.

**Validation**: `cargo test -p agileplus-plane modules` green (mocked).

---

### T030 - Extend PlaneClient with Cycle API Methods

**Purpose**: Add the low-level HTTP methods for Plane Cycle CRUD. Traces to FR-P02.

**File**: `crates/agileplus-plane/src/client.rs`

**Steps**:

1. Define Plane API request/response structs for Cycles. Plane Cycle creation requires at minimum
   `name`, `start_date`, `end_date` (ISO 8601):

   ```rust
   #[derive(Debug, Serialize)]
   pub struct PlaneCreateCycleRequest {
       pub name: String,
       #[serde(skip_serializing_if = "Option::is_none")]
       pub description: Option<String>,
       pub start_date: String,   // "YYYY-MM-DD"
       pub end_date: String,     // "YYYY-MM-DD"
   }

   #[derive(Debug, Deserialize)]
   pub struct PlaneCycleResponse {
       pub id: String,
       pub name: String,
       pub start_date: Option<String>,
       pub end_date: Option<String>,
   }
   ```

2. Add to `PlaneClient`:

   ```rust
   pub async fn create_cycle(
       &self,
       req: &PlaneCreateCycleRequest,
   ) -> Result<PlaneCycleResponse, SyncError> {
       let url = format!(
           "{}/api/v1/workspaces/{}/projects/{}/cycles/",
           self.base_url, self.workspace_slug, self.project_id
       );
       // ... same pattern as create_module
   }

   pub async fn update_cycle(
       &self,
       plane_cycle_id: &str,
       req: &PlaneCreateCycleRequest,
   ) -> Result<(), SyncError> { ... }

   pub async fn delete_cycle(&self, plane_cycle_id: &str) -> Result<(), SyncError> { ... }

   /// Add a Plane issue to a Plane cycle.
   pub async fn add_issue_to_cycle(
       &self,
       plane_cycle_id: &str,
       plane_issue_id: &str,
   ) -> Result<(), SyncError> {
       let url = format!(
           "{}/api/v1/workspaces/{}/projects/{}/cycles/{}/cycle-issues/",
           self.base_url, self.workspace_slug, self.project_id, plane_cycle_id
       );
       // POST with body {"issues": [plane_issue_id]}
       ...
   }
   ```

3. Write unit tests with mock HTTP:
   - `create_cycle_sends_correct_dates`
   - `add_issue_to_cycle_sends_post`

**Validation**: `cargo test -p agileplus-plane cycles` green (mocked).

---

### T031 - Implement Outbound Push for Module/Cycle Create/Update/Delete

**Purpose**: When AgilePlus creates or modifies a Module or Cycle, push the change to Plane.so
and record the sync mapping. Traces to FR-P01, FR-P02, FR-P05.

**File**: `crates/agileplus-plane/src/outbound.rs`

**Steps**:

1. Add function `push_module`:

   ```rust
   /// Push a newly created or updated Module to Plane.so.
   /// Stores a sync_mappings row with entity_type = "module".
   pub async fn push_module(
       client: &PlaneClient,
       storage: &dyn StoragePort,
       module: &Module,
   ) -> Result<(), SyncError> {
       // Check if a sync mapping already exists for this module
       let existing = storage.get_sync_mapping("module", module.id).await
           .map_err(|e| SyncError::Storage(e.to_string()))?;

       let req = PlaneCreateModuleRequest {
           name: module.friendly_name.clone(),
           description: module.description.clone(),
       };

       if let Some(mapping) = existing {
           // Update existing Plane module
           client.update_module(&mapping.plane_id, &req).await?;
       } else {
           // Create new Plane module
           let resp = client.create_module(&req).await?;
           storage.upsert_sync_mapping(SyncMapping {
               local_id: module.id,
               plane_id: resp.id,
               entity_type: "module".to_string(),
               last_synced_at: Utc::now(),
           }).await.map_err(|e| SyncError::Storage(e.to_string()))?;
       }
       Ok(())
   }
   ```

2. Add function `push_cycle` with the same pattern, using `entity_type = "cycle"` and
   converting `NaiveDate` to `String` via `format!("{}", date)` (outputs `"YYYY-MM-DD"`).

3. Add function `push_module_delete` and `push_cycle_delete` that:
   - Look up the sync mapping.
   - Call `client.delete_module(plane_id)` or `client.delete_cycle(plane_id)`.
   - Remove the sync mapping row.

4. Ensure `StoragePort` has `get_sync_mapping` and `upsert_sync_mapping` methods. If they don't
   exist, add them to the trait and implement in `agileplus-sqlite`. Use:
   ```sql
   INSERT INTO sync_mappings (local_id, plane_id, entity_type, last_synced_at)
   VALUES (?1, ?2, ?3, ?4)
   ON CONFLICT (local_id, entity_type) DO UPDATE SET
       plane_id = excluded.plane_id,
       last_synced_at = excluded.last_synced_at
   ```

**Validation**: Unit tests with mocked client and in-memory storage verify mapping is stored.

---

### T032 - Implement Inbound Pull and Webhook Handler for Plane Module/Cycle

**Purpose**: Accept Plane webhook events and update AgilePlus state accordingly. Traces to FR-P03.

**Files**: `crates/agileplus-plane/src/inbound.rs`, `webhook.rs`

**Steps**:

1. Define webhook payload types in `webhook.rs`:

   ```rust
   #[derive(Debug, Deserialize)]
   pub struct PlaneModuleWebhook {
       pub event: String,         // "module.created", "module.updated", "module.deleted"
       pub data: PlaneModuleData,
   }

   #[derive(Debug, Deserialize)]
   pub struct PlaneModuleData {
       pub id: String,
       pub name: String,
       pub description: Option<String>,
   }

   #[derive(Debug, Deserialize)]
   pub struct PlaneCycleWebhook {
       pub event: String,
       pub data: PlaneCycleData,
   }

   #[derive(Debug, Deserialize)]
   pub struct PlaneCycleData {
       pub id: String,
       pub name: String,
       pub start_date: Option<String>,
       pub end_date: Option<String>,
   }
   ```

2. In `webhook.rs`, extend the webhook dispatcher to handle Module and Cycle events:

   ```rust
   pub async fn handle_webhook(
       payload: &[u8],
       storage: &dyn StoragePort,
   ) -> Result<(), SyncError> {
       // Parse event type from JSON (read "event" field first)
       let event_envelope: serde_json::Value = serde_json::from_slice(payload)
           .map_err(|e| SyncError::Deserialize(e.to_string()))?;
       let event_type = event_envelope["event"].as_str().unwrap_or("");

       match event_type {
           "module.updated" => handle_module_updated(payload, storage).await,
           "module.deleted" => handle_module_deleted(payload, storage).await,
           "cycle.updated"  => handle_cycle_updated(payload, storage).await,
           "cycle.deleted"  => handle_cycle_deleted(payload, storage).await,
           _ => Ok(()), // unknown events are silently ignored
       }
   }
   ```

3. Implement `handle_module_updated`:
   - Deserialize `PlaneModuleWebhook`.
   - Look up sync mapping by `plane_id = data.id` and `entity_type = "module"`.
   - If no mapping found, log a warning and return `Ok(())` (no corresponding AgilePlus entity).
   - Fetch the AgilePlus module by `local_id`.
   - Apply conflict strategy:
     - `local-wins`: do nothing.
     - `remote-wins`: update `friendly_name = data.name`, `description = data.description`.
     - `manual`: store a conflict record (or log it) for human resolution.
   - Call `storage.update_module(&updated_module).await`.

4. Implement `handle_module_deleted`: look up mapping, call `storage.delete_module(local_id)`.
   Guard: if delete fails with `DomainError::ModuleHasDependents`, log error but do NOT propagate
   (Plane delete is advisory; AgilePlus keeps data if it has children).

5. Implement similar handlers for `cycle.updated` and `cycle.deleted`.

**Validation**: Unit tests with fixture JSON payloads verify correct storage calls are made.

---

### T033 - Add sync_mappings entity_type Support and Assignment Sync

**Purpose**: Ensure the `sync_mappings` table has an `entity_type` column, add StoragePort
methods for mapping lookup, and sync Feature-to-Module and Feature-to-Cycle assignments to Plane.
Traces to FR-P04, FR-P05.

**Files**: Possibly new migration file, `outbound.rs`, `storage.rs`, `agileplus-sqlite` repository.

**Steps**:

1. Inspect the current `sync_mappings` schema. If `entity_type TEXT` column does not exist:
   - Create `crates/agileplus-sqlite/src/migrations/007_sync_entity_type.sql`:
     ```sql
     ALTER TABLE sync_mappings ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'feature';
     CREATE INDEX idx_sync_mappings_entity ON sync_mappings(entity_type, local_id);
     ```
   - Register the migration.

2. Add to `StoragePort` trait (in `storage.rs`):

   ```rust
   fn get_sync_mapping(
       &self,
       entity_type: &str,
       local_id: i64,
   ) -> impl Future<Output = Result<Option<SyncMapping>, DomainError>> + Send;

   fn upsert_sync_mapping(
       &self,
       mapping: SyncMapping,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   fn get_sync_mapping_by_plane_id(
       &self,
       entity_type: &str,
       plane_id: &str,
   ) -> impl Future<Output = Result<Option<SyncMapping>, DomainError>> + Send;
   ```

3. Define `SyncMapping` struct in domain if not already defined:

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct SyncMapping {
       pub local_id: i64,
       pub plane_id: String,
       pub entity_type: String,
       pub last_synced_at: DateTime<Utc>,
   }
   ```

4. Implement the above methods in `agileplus-sqlite`.

5. In `outbound.rs`, add `push_feature_module_assignment`:

   ```rust
   /// When a Feature is assigned to a Module in AgilePlus, sync the Plane issue-to-module link.
   pub async fn push_feature_module_assignment(
       client: &PlaneClient,
       storage: &dyn StoragePort,
       feature: &Feature,
       module_id: i64,
   ) -> Result<(), SyncError> {
       // Get Plane issue id for the feature
       let feature_mapping = storage.get_sync_mapping("feature", feature.id).await
           .map_err(|e| SyncError::Storage(e.to_string()))?;
       let module_mapping = storage.get_sync_mapping("module", module_id).await
           .map_err(|e| SyncError::Storage(e.to_string()))?;

       match (feature_mapping, module_mapping) {
           (Some(fm), Some(mm)) => {
               client.add_issue_to_module(&mm.plane_id, &fm.plane_id).await?;
           }
           _ => {
               // One or both sides not synced -- skip silently (no mapping, no push)
           }
       }
       Ok(())
   }
   ```

6. Add analogous `push_feature_cycle_assignment` using `client.add_issue_to_cycle`.

7. Integrate both assignment sync functions into the CLI commands (WP03/WP04) as post-assignment
   side-effects. The cleanest pattern is an application-level service function that:
   a. Calls the storage operation.
   b. If sync is configured, calls the push function.
   This avoids polluting domain-level code with sync logic. Check if a service layer exists;
   if not, call from the CLI command handlers directly with a conditional on config.

**Validation**: Unit tests with mock client verify that assign + push calls the correct Plane endpoint.
