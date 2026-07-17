---
work_package_id: WP01
title: Domain Model Extensions
lane: "done"
dependencies: []
base_branch: main
base_commit: bd7feb90feed5245c3a53d8938d87c1b738c7600
created_at: '2026-03-02T11:27:01.159253+00:00'
subtasks: [T001, T002, T003, T004, T005, T006, T007]
shell_pid: "11491"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Domain Model Extensions (WP01)

## Overview

Add 6 new entity types to the domain model and extend 2 existing entities. These types support event sourcing, service health monitoring, device synchronization, and API authentication.

## Objective

Implement all entity types with:
- Complete struct definitions with all required fields
- Proper serialization/deserialization support
- Validation logic for domain invariants
- Derive macros for Clone, Debug, Display
- Builder patterns for complex entities

## Subtasks

### T001: Event Entity

Create `crates/agileplus-domain/src/domain/event.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub actor: String,
    pub timestamp: DateTime<Utc>,
    pub prev_hash: [u8; 32],
    pub hash: [u8; 32],
    pub sequence: i64,
}
```

**Validation:**
- `entity_type` and `event_type` non-empty
- `sequence` must be positive
- `hash` and `prev_hash` must be exactly 32 bytes each
- `timestamp` must not be in the future
- `payload` must be valid JSON

**Display impl:**
```
Event(entity_type={}, entity_id={}, sequence={}, event_type={}, timestamp={})
```

Add to `crates/agileplus-domain/src/domain/mod.rs`:
```rust
pub mod event;
pub use event::Event;
```

### T002: Snapshot Entity

Create `crates/agileplus-domain/src/domain/snapshot.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub state: serde_json::Value,
    pub event_sequence: i64,
    pub created_at: DateTime<Utc>,
}
```

**Validation:**
- `entity_type` non-empty
- `event_sequence` non-negative
- `state` must be valid JSON
- `created_at` must not be in the future

**Display impl:**
```
Snapshot(entity_type={}, entity_id={}, sequence={}, created_at={})
```

Re-export in `domain/mod.rs`.

### T003: SyncMapping Entity

Create `crates/agileplus-domain/src/domain/sync_mapping.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SyncMapping {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub plane_issue_id: String,
    pub content_hash: String,
    pub last_synced_at: DateTime<Utc>,
    pub sync_direction: String,  // "inbound" | "outbound" | "bidirectional"
    pub conflict_count: i32,
}
```

**Validation:**
- `entity_type` non-empty
- `plane_issue_id` non-empty (format: "PROJ-123")
- `content_hash` non-empty (typically hex digest)
- `sync_direction` one of: "inbound", "outbound", "bidirectional"
- `conflict_count` non-negative

**Display impl:**
```
SyncMapping(entity_type={}, plane_issue_id={}, direction={}, last_synced={})
```

Re-export in `domain/mod.rs`.

### T004: ServiceHealth and HealthStatus

Create `crates/agileplus-domain/src/domain/health.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub service_name: String,
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub uptime_seconds: u64,
    pub connection_info: String,
    pub metadata: serde_json::Value,
}
```

**Validation:**
- `service_name` non-empty
- `uptime_seconds` non-negative
- `connection_info` non-empty
- `metadata` must be valid JSON

**Display impl:**
```
ServiceHealth(service={}, status={:?}, uptime={}s)
```

**Methods:**
- `is_healthy() -> bool` (true if Healthy)
- `time_since_check(&self) -> Duration`

Re-export in `domain/mod.rs`.

### T005: DeviceNode Entity

Create `crates/agileplus-domain/src/domain/device_node.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceNode {
    pub device_id: String,
    pub tailscale_ip: Option<String>,
    pub hostname: String,
    pub last_seen: DateTime<Utc>,
    pub sync_vector: serde_json::Value,
    pub platform_version: String,
}
```

**Validation:**
- `device_id` non-empty (UUID or machine ID format)
- `hostname` non-empty
- `tailscale_ip` if Some, must be valid IPv6 format
- `sync_vector` must be valid JSON (typically vector clock)
- `platform_version` non-empty (semantic version format)

**Display impl:**
```
DeviceNode(device_id={}, hostname={}, last_seen={})
```

**Methods:**
- `is_online(threshold_seconds: u64) -> bool` (check if last_seen within threshold)

Re-export in `domain/mod.rs`.

### T006: ApiKey Entity

Create `crates/agileplus-domain/src/domain/api_key.rs`

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: i64,
    pub key_hash: [u8; 32],
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked: bool,
}
```

**Validation:**
- `key_hash` must be exactly 32 bytes (SHA-256)
- `name` non-empty
- `created_at` must not be in the future
- `last_used_at` if Some, must be >= `created_at` and not in the future
- If `revoked`, `last_used_at` cannot be in the future

**Display impl:**
```
ApiKey(name={}, created={}, revoked={})
```

**Methods:**
- `is_active() -> bool` (not revoked)
- `days_since_creation(&self) -> u64`
- `days_since_last_used(&self) -> Option<u64>`

Re-export in `domain/mod.rs`.

### T007: Extend Feature and WorkPackage

**Extend Feature** in `crates/agileplus-domain/src/domain/feature.rs`:
```rust
pub struct Feature {
    // ... existing fields ...
    pub plane_issue_id: Option<String>,
    pub plane_state_id: Option<String>,
    pub labels: Vec<String>,
}
```

**Validations:**
- `plane_issue_id` if Some, must be non-empty
- `plane_state_id` if Some, must be non-empty
- `labels` items must be non-empty strings

**Extend WorkPackage** in `crates/agileplus-domain/src/domain/workpackage.rs`:
```rust
pub struct WorkPackage {
    // ... existing fields ...
    pub plane_sub_issue_id: Option<String>,
}
```

**Validation:**
- `plane_sub_issue_id` if Some, must be non-empty

**Add builder methods** to both Feature and WorkPackage:
```rust
impl Feature {
    pub fn with_plane_issue_id(mut self, id: String) -> Self { ... }
    pub fn with_labels(mut self, labels: Vec<String>) -> Self { ... }
}

impl WorkPackage {
    pub fn with_plane_sub_issue_id(mut self, id: String) -> Self { ... }
}
```

## Implementation Guidance

1. **Order of creation:** T001 → T002 → T003 → T004 → T005 → T006 → T007
2. **Test compilation:** After each subtask, run `cargo check -p agileplus-domain` to verify
3. **Serialization:** All entities must support `serde::{Serialize, Deserialize}` for JSON round-tripping
4. **Validation:** Create helper methods for common validations; use thiserror for error types
5. **Documentation:** Add doc comments to each field explaining its purpose and constraints

## Definition of Done

- [ ] All 6 new entity types compile without errors
- [ ] All 8 extended/modified structs compile without errors
- [ ] Serialization/deserialization works for all types
- [ ] Existing domain tests still pass (`cargo test -p agileplus-domain`)
- [ ] All validation logic is implemented and tested
- [ ] Builder patterns work for Feature and WorkPackage extensions
- [ ] Display impls are correct and human-readable

## Command

```bash
spec-kitty implement WP01
```

## Activity Log

- 2026-03-02T11:27:01Z – claude-opus – shell_pid=11491 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:35:51Z – claude-opus – shell_pid=11491 – lane=for_review – Ready for review: 6 new domain entities, 3 extended entities, all 53 tests pass
- 2026-03-02T23:18:59Z – claude-opus – shell_pid=11491 – lane=done – Merged to main, 516 tests passing
