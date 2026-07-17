---
work_package_id: WP02
title: Event Sourcing Engine
lane: "done"
dependencies: []
base_branch: main
base_commit: 5367994fcf11fa4c20b608bb6ee398512c805b0f
created_at: '2026-03-02T11:35:58.624231+00:00'
subtasks: [T008, T009, T010, T011, T012, T013, T014]
shell_pid: "21596"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Event Sourcing Engine (WP02)

## Overview

Create the `agileplus-events` crate, a complete event sourcing framework. This is the core engine for capturing, storing, and replaying all domain events, with hash chain verification and snapshot management.

## Objective

Implement:
- EventStore trait with async operations
- Hash chain computation and verification (SHA-256)
- Event replay engine with Aggregate pattern
- Snapshot creation and loading
- Query builder for event streams

## Architecture

The event sourcing engine follows these principles:
- **Immutability:** Events are append-only
- **Causality:** Each event references its predecessor via hash
- **Efficiency:** Snapshots allow fast loading at recent points
- **Auditability:** Complete event history for replay and analysis

## Subtasks

### T008: Scaffold agileplus-events Crate

Create a new crate at `crates/agileplus-events/`.

**Cargo.toml:**
```toml
[package]
name = "agileplus-events"
version = "0.1.0"
edition = "2021"

[dependencies]
agileplus-domain = { path = "../agileplus-domain" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
chrono = { version = "0.4", features = ["serde"] }
sha2 = "0.10"
thiserror = "1.0"
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
```

**Directory structure:**
```
crates/agileplus-events/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── store.rs
    ├── hash.rs
    ├── replay.rs
    ├── snapshot.rs
    └── query.rs
```

**lib.rs content:**
```rust
pub mod hash;
pub mod replay;
pub mod snapshot;
pub mod store;
pub mod query;

pub use hash::{compute_hash, verify_chain, HashError};
pub use replay::{Aggregate, ReplayError};
pub use snapshot::{SnapshotStore, SnapshotError};
pub use store::{EventError, EventStore};
pub use query::{EventQuery, QueryError};

#[derive(Debug, thiserror::Error)]
pub enum EventSourcingError {
    #[error("Store error: {0}")]
    Store(#[from] EventError),
    #[error("Hash error: {0}")]
    Hash(#[from] HashError),
    #[error("Replay error: {0}")]
    Replay(#[from] ReplayError),
    #[error("Snapshot error: {0}")]
    Snapshot(#[from] SnapshotError),
    #[error("Query error: {0}")]
    Query(#[from] QueryError),
}
```

### T009: EventStore Trait

Create `crates/agileplus-events/src/store.rs`

```rust
use agileplus_domain::Event;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EventError {
    #[error("Event not found: {0}")]
    NotFound(String),
    #[error("Duplicate sequence: {0}")]
    DuplicateSequence(String),
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Invalid hash: {0}")]
    InvalidHash(String),
    #[error("Sequence gap: expected {expected}, got {actual}")]
    SequenceGap { expected: i64, actual: i64 },
}

#[async_trait]
pub trait EventStore: Send + Sync {
    /// Append a new event to the store
    async fn append(&self, event: &Event) -> Result<i64, EventError>;

    /// Get all events for an entity in sequence order
    async fn get_events(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<Vec<Event>, EventError>;

    /// Get events from a specific sequence onward
    async fn get_events_since(
        &self,
        entity_type: &str,
        entity_id: i64,
        sequence: i64,
    ) -> Result<Vec<Event>, EventError>;

    /// Get events within a time range
    async fn get_events_by_range(
        &self,
        entity_type: &str,
        entity_id: i64,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<Event>, EventError>;

    /// Get the latest event sequence number for an entity
    async fn get_latest_sequence(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<i64, EventError>;
}
```

**Design notes:**
- All methods are async to support various backends (database, remote)
- Events must be returned in sequence order (ascending)
- Sequence numbers are monotonically increasing per entity
- `append` returns the assigned sequence number

### T010: Hash Chain Computation

Create `crates/agileplus-events/src/hash.rs`

```rust
use agileplus_domain::Event;
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum HashError {
    #[error("Hash chain broken at sequence {sequence}")]
    ChainBroken { sequence: i64 },
    #[error("Invalid hash length: expected 32, got {0}")]
    InvalidHashLength(usize),
    #[error("Hash mismatch at sequence {sequence}")]
    HashMismatch { sequence: i64 },
}

/// Compute SHA-256 hash for a new event
///
/// Hash inputs (in order):
/// 1. entity_id (8 bytes, big-endian)
/// 2. entity_type (length-prefixed UTF-8)
/// 3. event_type (length-prefixed UTF-8)
/// 4. payload (JSON serialized)
/// 5. timestamp (ISO 8601 string)
/// 6. actor (UTF-8 string)
/// 7. prev_hash (32 bytes)
pub fn compute_hash(
    entity_id: i64,
    entity_type: &str,
    event_type: &str,
    payload: &serde_json::Value,
    timestamp: DateTime<Utc>,
    actor: &str,
    prev_hash: &[u8; 32],
) -> Result<[u8; 32], HashError> {
    let mut hasher = Sha256::new();

    // Add entity_id as 8 big-endian bytes
    hasher.update(entity_id.to_be_bytes());

    // Add entity_type length and content
    hasher.update((entity_type.len() as u32).to_be_bytes());
    hasher.update(entity_type.as_bytes());

    // Add event_type length and content
    hasher.update((event_type.len() as u32).to_be_bytes());
    hasher.update(event_type.as_bytes());

    // Add payload as JSON
    let payload_json = serde_json::to_string(payload)
        .map_err(|_| HashError::InvalidHashLength(0))?;
    hasher.update((payload_json.len() as u32).to_be_bytes());
    hasher.update(payload_json.as_bytes());

    // Add timestamp as ISO 8601 string
    let timestamp_str = timestamp.to_rfc3339();
    hasher.update((timestamp_str.len() as u32).to_be_bytes());
    hasher.update(timestamp_str.as_bytes());

    // Add actor
    hasher.update((actor.len() as u32).to_be_bytes());
    hasher.update(actor.as_bytes());

    // Add previous hash
    hasher.update(prev_hash);

    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result[..]);
    Ok(hash)
}

/// Verify the integrity of an event chain
///
/// Ensures that:
/// 1. Each event's hash is correctly computed from its inputs
/// 2. Each event's prev_hash matches the previous event's hash
/// 3. Sequences are monotonically increasing
pub fn verify_chain(events: &[Event]) -> Result<(), HashError> {
    if events.is_empty() {
        return Ok(());
    }

    // Check first event's prev_hash is all zeros
    if events[0].prev_hash != [0u8; 32] {
        return Err(HashError::ChainBroken {
            sequence: events[0].sequence,
        });
    }

    // Verify first event's hash
    let expected_hash = compute_hash(
        events[0].entity_id,
        &events[0].entity_type,
        &events[0].event_type,
        &events[0].payload,
        events[0].timestamp,
        &events[0].actor,
        &[0u8; 32],
    )?;
    if expected_hash != events[0].hash {
        return Err(HashError::HashMismatch {
            sequence: events[0].sequence,
        });
    }

    // Verify each subsequent event
    for i in 1..events.len() {
        let prev = &events[i - 1];
        let curr = &events[i];

        // Check sequence is monotonically increasing
        if curr.sequence != prev.sequence + 1 {
            return Err(HashError::ChainBroken {
                sequence: curr.sequence,
            });
        }

        // Check prev_hash matches previous event's hash
        if curr.prev_hash != prev.hash {
            return Err(HashError::ChainBroken {
                sequence: curr.sequence,
            });
        }

        // Verify current event's hash
        let expected_hash = compute_hash(
            curr.entity_id,
            &curr.entity_type,
            &curr.event_type,
            &curr.payload,
            curr.timestamp,
            &curr.actor,
            &prev.hash,
        )?;
        if expected_hash != curr.hash {
            return Err(HashError::HashMismatch {
                sequence: curr.sequence,
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_hash_deterministic() {
        let hash1 = compute_hash(
            1,
            "Feature",
            "created",
            &serde_json::json!({"name": "test"}),
            DateTime::parse_from_rfc3339("2026-03-02T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            "user1",
            &[0u8; 32],
        )
        .unwrap();

        let hash2 = compute_hash(
            1,
            "Feature",
            "created",
            &serde_json::json!({"name": "test"}),
            DateTime::parse_from_rfc3339("2026-03-02T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            "user1",
            &[0u8; 32],
        )
        .unwrap();

        assert_eq!(hash1, hash2);
    }
}
```

### T011: Event Replay Engine

Create `crates/agileplus-events/src/replay.rs`

```rust
use agileplus_domain::Event;
use async_trait::async_trait;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReplayError {
    #[error("Aggregate error: {0}")]
    AggregateError(String),
    #[error("Invalid state: {0}")]
    InvalidState(String),
}

/// Aggregate trait: any entity that can be reconstructed from events
///
/// Implementors must apply each event to update their state.
/// The order of event application is critical for correctness.
#[async_trait]
pub trait Aggregate: Send + Sync {
    /// Apply an event to the aggregate's state
    ///
    /// This method is idempotent when called with the same events
    /// in the same order. Implementors must handle all possible event types.
    async fn apply(&mut self, event: &Event) -> Result<(), ReplayError>;

    /// Get the aggregate's current version (latest event sequence)
    fn version(&self) -> i64;

    /// Set the aggregate's version after loading from snapshot
    fn set_version(&mut self, version: i64);
}

/// Replay a sequence of events onto an aggregate
///
/// Applies events in order to reconstruct the aggregate's state.
/// All events must be for the same entity_id.
pub async fn replay_events<A: Aggregate>(
    aggregate: &mut A,
    events: &[Event],
) -> Result<(), ReplayError> {
    // Verify all events are for the same entity
    if !events.is_empty() {
        let first_entity_id = events[0].entity_id;
        for event in events {
            if event.entity_id != first_entity_id {
                return Err(ReplayError::InvalidState(
                    "Events from different entities in replay".to_string(),
                ));
            }
        }
    }

    // Apply events in sequence
    for event in events {
        aggregate.apply(event).await?;
    }

    // Update version to latest event sequence
    if let Some(last_event) = events.last() {
        aggregate.set_version(last_event.sequence);
    }

    Ok(())
}

/// Fast replay: apply only events since a snapshot sequence
pub async fn replay_events_since<A: Aggregate>(
    aggregate: &mut A,
    snapshot_sequence: i64,
    events: &[Event],
) -> Result<(), ReplayError> {
    let filtered_events: Vec<_> = events
        .iter()
        .filter(|e| e.sequence > snapshot_sequence)
        .cloned()
        .collect();

    replay_events(aggregate, &filtered_events).await
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestAggregate {
        id: i64,
        version: i64,
        state: serde_json::Value,
    }

    #[async_trait]
    impl Aggregate for TestAggregate {
        async fn apply(&mut self, event: &Event) -> Result<(), ReplayError> {
            self.state = event.payload.clone();
            self.version = event.sequence;
            Ok(())
        }

        fn version(&self) -> i64 {
            self.version
        }

        fn set_version(&mut self, version: i64) {
            self.version = version;
        }
    }

    #[tokio::test]
    async fn test_replay_events() {
        let mut agg = TestAggregate {
            id: 1,
            version: 0,
            state: serde_json::json!({}),
        };

        let event = Event {
            id: 1,
            entity_type: "Test".to_string(),
            entity_id: 1,
            event_type: "Updated".to_string(),
            payload: serde_json::json!({"value": 42}),
            actor: "test_user".to_string(),
            timestamp: chrono::Utc::now(),
            prev_hash: [0u8; 32],
            hash: [0u8; 32],
            sequence: 1,
        };

        replay_events(&mut agg, &[event]).await.unwrap();
        assert_eq!(agg.version, 1);
    }
}
```

### T012: Snapshot Management

Create `crates/agileplus-events/src/snapshot.rs`

```rust
use agileplus_domain::Snapshot;
use async_trait::async_trait;
use chrono::{Duration, Utc};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SnapshotError {
    #[error("Snapshot not found for {entity_type}:{entity_id}")]
    NotFound { entity_type: String, entity_id: i64 },
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Invalid snapshot: {0}")]
    Invalid(String),
}

#[derive(Clone, Debug)]
pub struct SnapshotConfig {
    /// Create snapshot after this many events
    pub event_threshold: i64,
    /// Create snapshot after this many seconds
    pub time_threshold_secs: u64,
}

impl Default for SnapshotConfig {
    fn default() -> Self {
        SnapshotConfig {
            event_threshold: 100,
            time_threshold_secs: 300, // 5 minutes
        }
    }
}

#[async_trait]
pub trait SnapshotStore: Send + Sync {
    /// Save a snapshot
    async fn save(&self, snapshot: &Snapshot) -> Result<(), SnapshotError>;

    /// Load the most recent snapshot for an entity
    async fn load(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<Option<Snapshot>, SnapshotError>;

    /// Delete snapshots older than a given sequence
    async fn delete_before(
        &self,
        entity_type: &str,
        entity_id: i64,
        sequence: i64,
    ) -> Result<(), SnapshotError>;
}

/// Determine if a new snapshot should be created
pub fn should_snapshot(
    config: &SnapshotConfig,
    current_sequence: i64,
    last_snapshot_sequence: i64,
    last_snapshot_time: Option<chrono::DateTime<Utc>>,
) -> bool {
    // Check event threshold
    if current_sequence - last_snapshot_sequence >= config.event_threshold {
        return true;
    }

    // Check time threshold
    if let Some(last_time) = last_snapshot_time {
        let elapsed = Utc::now().signed_duration_since(last_time);
        if elapsed > Duration::seconds(config.time_threshold_secs as i64) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_snapshot_event_threshold() {
        let config = SnapshotConfig {
            event_threshold: 100,
            time_threshold_secs: 300,
        };

        assert!(should_snapshot(&config, 100, 0, None));
        assert!(!should_snapshot(&config, 50, 0, None));
    }

    #[test]
    fn test_should_snapshot_time_threshold() {
        let config = SnapshotConfig {
            event_threshold: 100,
            time_threshold_secs: 300,
        };

        let now = Utc::now();
        let old_time = now - Duration::seconds(400);

        assert!(should_snapshot(&config, 50, 0, Some(old_time)));
        assert!(!should_snapshot(&config, 50, 0, Some(now)));
    }
}
```

### T013: Fast Loading with Snapshots

Add to `crates/agileplus-events/src/snapshot.rs`:

```rust
/// State loaded from a snapshot with events to replay
pub struct LoadedState {
    pub snapshot: Option<Snapshot>,
    pub events_to_replay: Vec<crate::Event>,
}

impl LoadedState {
    /// Create LoadedState given a snapshot store and event store
    pub async fn load<SS: SnapshotStore, ES: crate::EventStore>(
        snapshot_store: &SS,
        event_store: &ES,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<Self, SnapshotError> {
        // Try to load the latest snapshot
        let snapshot = snapshot_store.load(entity_type, entity_id).await?;

        // Load events since snapshot (or all events if no snapshot)
        let events_to_replay = if let Some(ref snap) = snapshot {
            event_store
                .get_events_since(entity_type, entity_id, snap.event_sequence)
                .await
                .map_err(|e| SnapshotError::StorageError(e.to_string()))?
        } else {
            event_store
                .get_events(entity_type, entity_id)
                .await
                .map_err(|e| SnapshotError::StorageError(e.to_string()))?
        };

        Ok(LoadedState {
            snapshot,
            events_to_replay,
        })
    }
}
```

### T014: Event Query Builder

Create `crates/agileplus-events/src/query.rs`

```rust
use agileplus_domain::Event;
use chrono::{DateTime, Utc};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum QueryError {
    #[error("Query error: {0}")]
    Error(String),
}

pub struct EventQuery {
    entity_type: Option<String>,
    entity_id: Option<i64>,
    event_type: Option<String>,
    actor: Option<String>,
    from_time: Option<DateTime<Utc>>,
    to_time: Option<DateTime<Utc>>,
    from_sequence: Option<i64>,
    to_sequence: Option<i64>,
    limit: Option<i64>,
}

impl EventQuery {
    pub fn new() -> Self {
        EventQuery {
            entity_type: None,
            entity_id: None,
            event_type: None,
            actor: None,
            from_time: None,
            to_time: None,
            from_sequence: None,
            to_sequence: None,
            limit: None,
        }
    }

    pub fn entity_type(mut self, et: String) -> Self {
        self.entity_type = Some(et);
        self
    }

    pub fn entity_id(mut self, id: i64) -> Self {
        self.entity_id = Some(id);
        self
    }

    pub fn event_type(mut self, et: String) -> Self {
        self.event_type = Some(et);
        self
    }

    pub fn actor(mut self, a: String) -> Self {
        self.actor = Some(a);
        self
    }

    pub fn from_time(mut self, t: DateTime<Utc>) -> Self {
        self.from_time = Some(t);
        self
    }

    pub fn to_time(mut self, t: DateTime<Utc>) -> Self {
        self.to_time = Some(t);
        self
    }

    pub fn from_sequence(mut self, s: i64) -> Self {
        self.from_sequence = Some(s);
        self
    }

    pub fn to_sequence(mut self, s: i64) -> Self {
        self.to_sequence = Some(s);
        self
    }

    pub fn limit(mut self, l: i64) -> Self {
        self.limit = Some(l);
        self
    }

    /// Filter an in-memory event list
    pub fn filter(&self, events: &[Event]) -> Vec<Event> {
        events
            .iter()
            .filter(|e| {
                if let Some(ref et) = self.entity_type {
                    if e.entity_type != *et {
                        return false;
                    }
                }
                if let Some(id) = self.entity_id {
                    if e.entity_id != id {
                        return false;
                    }
                }
                if let Some(ref et) = self.event_type {
                    if e.event_type != *et {
                        return false;
                    }
                }
                if let Some(ref a) = self.actor {
                    if e.actor != *a {
                        return false;
                    }
                }
                if let Some(from) = self.from_time {
                    if e.timestamp < from {
                        return false;
                    }
                }
                if let Some(to) = self.to_time {
                    if e.timestamp > to {
                        return false;
                    }
                }
                if let Some(from) = self.from_sequence {
                    if e.sequence < from {
                        return false;
                    }
                }
                if let Some(to) = self.to_sequence {
                    if e.sequence > to {
                        return false;
                    }
                }
                true
            })
            .take(self.limit.unwrap_or(i64::MAX) as usize)
            .cloned()
            .collect()
    }
}

impl Default for EventQuery {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_builder() {
        let query = EventQuery::new()
            .entity_type("Feature".to_string())
            .entity_id(1)
            .limit(10);

        assert_eq!(query.entity_type.as_ref().map(|s| s.as_str()), Some("Feature"));
        assert_eq!(query.entity_id, Some(1));
        assert_eq!(query.limit, Some(10));
    }
}
```

## Implementation Guidance

1. **Dependency order:** Create in order T008 → T009 → T010 → T011 → T012 → T013 → T014
2. **Build frequently:** Run `cargo check -p agileplus-events` after each subtask
3. **Hash validation:** Thoroughly test hash chain verification; this is security-critical
4. **Async pattern:** All I/O operations are async to support multiple backends
5. **Testing:** Implement unit tests as you build each module

## Definition of Done

- [ ] agileplus-events crate compiles successfully
- [ ] EventStore trait defined with all required methods
- [ ] Hash computation deterministic and verifiable
- [ ] Hash chain verification catches tampering
- [ ] Replay engine applies events correctly
- [ ] Snapshot loading optimizes common paths
- [ ] Event query builder has all filter types
- [ ] Unit tests for hash, replay, and query modules pass
- [ ] No clippy warnings

## Command

```bash
spec-kitty implement WP02 --base WP01
```

## Activity Log

- 2026-03-02T11:35:58Z – claude-opus – shell_pid=21596 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:42:02Z – claude-opus – shell_pid=21596 – lane=for_review – Ready for review: agileplus-events crate with 14 passing tests
- 2026-03-02T23:19:00Z – claude-opus – shell_pid=21596 – lane=done – Merged to main, 516 tests passing
