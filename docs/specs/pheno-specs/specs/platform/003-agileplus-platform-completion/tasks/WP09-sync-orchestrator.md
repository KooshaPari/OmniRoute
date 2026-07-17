---
work_package_id: WP09
title: Sync Orchestrator
lane: "done"
dependencies: []
base_branch: main
base_commit: ad87f9a376a4c8c41bc88f4e3c748dff3f8a7edc
created_at: '2026-03-02T12:06:04.237572+00:00'
subtasks: [T053, T054, T055, T056, T057, T058]
shell_pid: "35625"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Create `crates/agileplus-sync` coordinating Plane.so and device sync with conflict resolution.

Implementation command: `spec-kitty implement WP09 --base WP03`

## Subtasks

### T053: Scaffold Crate

Create new crate with appropriate dependencies:

**Cargo.toml:**
- agileplus-domain
- agileplus-events
- serde / serde_json
- chrono
- sha2
- thiserror
- async-trait
- async-nats

### T054: Conflict Detection

Create `SyncConflict` struct:

```rust
pub struct SyncConflict {
    pub entity_type: String,
    pub entity_id: i64,
    pub local_version: serde_json::Value,
    pub remote_version: serde_json::Value,
    pub local_hash: String,
    pub remote_hash: String,
    pub detected_at: DateTime<Utc>,
}
```

Detect when both `content_hash` values differ from the stored `SyncMapping.content_hash`.

### T055: Conflict Resolution Strategies

Implement resolution types and application:

```rust
pub enum ResolutionStrategy {
    LocalWins,
    RemoteWins,
    Manual(serde_json::Value), // user-provided merged value
    FieldLevel(HashMap<String, FieldSource>), // per-field selection
}

pub enum FieldSource {
    Local,
    Remote,
}
```

Apply resolution: update entity, update `SyncMapping`, emit resolution event.

### T056: SyncMapping Store Trait

Implement trait for persistence:

```rust
pub trait SyncMappingStore: Send + Sync {
    async fn create(&self, mapping: SyncMapping) -> Result<i64>;
    async fn get_by_entity(&self, entity_type: &str, entity_id: i64)
        -> Result<Option<SyncMapping>>;
    async fn update_hash(&self, id: i64, new_hash: String, synced_at: DateTime<Utc>)
        -> Result<()>;
    async fn increment_conflict(&self, id: i64) -> Result<()>;
    async fn list_all(&self) -> Result<Vec<SyncMapping>>;
}
```

### T057: Sync Status Report

Create `SyncReport` struct for audit and CLI output:

```rust
pub struct SyncReport {
    pub created: Vec<(String, i64)>,
    pub updated: Vec<(String, i64)>,
    pub skipped: Vec<(String, i64)>,
    pub conflicts: Vec<SyncConflict>,
    pub errors: Vec<SyncError>,
    pub duration: Duration,
}
```

Implement display as formatted table for CLI output.

### T058: NATS Integration

Wire NATS pub/sub:

- Subscribe to `agileplus.sync.plane.inbound` for webhook events
- Publish to `agileplus.sync.plane.outbound` for outbound sync commands
- Use JetStream for durability

## Definition of Done

- Conflict detection identifies divergent local/remote versions
- Resolution strategies apply correctly and update both entity and mapping
- NATS pub/sub channels connected and flowing
- SyncReport formats correctly for CLI consumption

## Activity Log

- 2026-03-02T12:06:04Z – claude-opus – shell_pid=35625 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:13:51Z – claude-opus – shell_pid=35625 – lane=for_review – Ready for review
- 2026-03-02T12:15:57Z – claude-opus – shell_pid=35625 – lane=for_review – Ready for review: agileplus-sync crate with conflict detection, resolution strategies, SyncMappingStore trait, SyncReport, and NATS integration. 21 tests pass.
- 2026-03-02T23:19:29Z – claude-opus – shell_pid=35625 – lane=done – Merged to main, 516 tests passing
