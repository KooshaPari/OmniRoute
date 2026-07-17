---
work_package_id: WP03
title: SQLite Schema Extensions
lane: "done"
dependencies: []
base_branch: main
base_commit: 6e12c538763ad95ab83cd9eebea10b7471ecec5b
created_at: '2026-03-02T11:42:12.605159+00:00'
subtasks: [T015, T016, T017, T018, T019, T020, T021]
shell_pid: "36420"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# SQLite Schema Extensions (WP03)

## Overview

Extend the existing `agileplus-sqlite` crate with event sourcing tables and implement the EventStore trait from WP02. This is the primary persistent store for all events.

## Objective

Implement:
- 5 new tables for events, snapshots, sync mappings, API keys, device nodes
- SqliteEventStore implementing the EventStore trait
- WAL mode optimization for concurrent access
- Index strategy for query performance

## Architecture

The SQLite event store provides:
- ACID-compliant event persistence
- Index optimization for common query patterns
- Foreign key integrity (optional, at your discretion)
- Automatic cleanup of archived records

## Subtasks

### T015: Events Table

Add to `crates/agileplus-sqlite/migrations/` (or create a new migration):

```sql
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    prev_hash BLOB NOT NULL,
    hash BLOB NOT NULL,
    sequence INTEGER NOT NULL,
    UNIQUE(entity_type, entity_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor);
```

**Rationale:**
- Composite index on (entity_type, entity_id, sequence) for fast lookups by entity
- Timestamp index for time-range queries
- Event type and actor indexes for filtering by event/actor

**Add migration file:** `crates/agileplus-sqlite/migrations/20260302_001_events.sql`

### T016: Snapshots Table

```sql
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    state TEXT NOT NULL,
    event_sequence INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(entity_type, entity_id, event_sequence)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_entity ON snapshots(entity_type, entity_id, event_sequence DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON snapshots(created_at);
```

**Rationale:**
- DESC ordering on event_sequence for efficient "latest snapshot" queries
- Time index for cleanup operations

**Add migration file:** `crates/agileplus-sqlite/migrations/20260302_002_snapshots.sql`

### T017: Sync Mappings Table

```sql
CREATE TABLE IF NOT EXISTS sync_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    plane_issue_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    sync_direction TEXT NOT NULL,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(entity_type, entity_id),
    UNIQUE(plane_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_mappings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_plane_id ON sync_mappings(plane_issue_id);
CREATE INDEX IF NOT EXISTS idx_sync_time ON sync_mappings(last_synced_at);
```

**Rationale:**
- Unique on (entity_type, entity_id) to enforce one-to-one relationship
- Unique on plane_issue_id to prevent duplicates
- Time index for sync monitoring

**Add migration file:** `crates/agileplus-sqlite/migrations/20260302_003_sync_mappings.sql`

### T018: API Keys Table

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash BLOB NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked INTEGER NOT NULL DEFAULT 0,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(revoked, created_at);
```

**Rationale:**
- Unique on key_hash (never store plaintext keys!)
- Index on hash for fast lookups
- Composite index on (revoked, created_at) for "active keys" queries

**Add migration file:** `crates/agileplus-sqlite/migrations/20260302_004_api_keys.sql`

### T019: Device Nodes Table

```sql
CREATE TABLE IF NOT EXISTS device_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL UNIQUE,
    tailscale_ip TEXT,
    hostname TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    sync_vector TEXT NOT NULL,
    platform_version TEXT NOT NULL,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_id ON device_nodes(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_hostname ON device_nodes(hostname);
CREATE INDEX IF NOT EXISTS idx_devices_lastseen ON device_nodes(last_seen);
```

**Rationale:**
- Unique on device_id (primary key-like constraint)
- Indexes for lookup by device ID, hostname, or recency

**Add migration file:** `crates/agileplus-sqlite/migrations/20260302_005_device_nodes.sql`

### T020: Implement SqliteEventStore

Create or extend `crates/agileplus-sqlite/src/event_store.rs`:

```rust
use agileplus_events::{EventError, EventStore};
use agileplus_domain::Event;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

pub struct SqliteEventStore {
    pool: SqlitePool,
}

impl SqliteEventStore {
    pub fn new(pool: SqlitePool) -> Self {
        SqliteEventStore { pool }
    }
}

#[async_trait]
impl EventStore for SqliteEventStore {
    async fn append(&self, event: &Event) -> Result<i64, EventError> {
        let result = sqlx::query(
            r#"
            INSERT INTO events (
                entity_type, entity_id, event_type, payload, actor,
                timestamp, prev_hash, hash, sequence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.entity_type)
        .bind(event.entity_id)
        .bind(&event.event_type)
        .bind(serde_json::to_string(&event.payload).map_err(|e| {
            EventError::StorageError(format!("Failed to serialize payload: {}", e))
        })?)
        .bind(&event.actor)
        .bind(event.timestamp.to_rfc3339())
        .bind(&event.prev_hash[..])
        .bind(&event.hash[..])
        .bind(event.sequence)
        .execute(&self.pool)
        .await;

        match result {
            Ok(row) => Ok(row.last_insert_rowid()),
            Err(sqlx::Error::Database(e)) if e.message().contains("UNIQUE") => {
                Err(EventError::DuplicateSequence(format!(
                    "{}:{}:{}",
                    event.entity_type, event.entity_id, event.sequence
                )))
            }
            Err(e) => Err(EventError::StorageError(format!(
                "Failed to insert event: {}",
                e
            ))),
        }
    }

    async fn get_events(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<Vec<Event>, EventError> {
        let rows = sqlx::query(
            r#"
            SELECT id, entity_type, entity_id, event_type, payload, actor,
                   timestamp, prev_hash, hash, sequence
            FROM events
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY sequence ASC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| EventError::StorageError(e.to_string()))?;

        rows.into_iter()
            .map(|row| {
                let timestamp_str: String = row.get(6);
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?
                    .with_timezone(&Utc);

                let prev_hash_vec: Vec<u8> = row.get(7);
                let mut prev_hash = [0u8; 32];
                prev_hash.copy_from_slice(&prev_hash_vec);

                let hash_vec: Vec<u8> = row.get(8);
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&hash_vec);

                let payload_str: String = row.get(4);
                let payload: serde_json::Value = serde_json::from_str(&payload_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?;

                Ok(Event {
                    id: row.get(0),
                    entity_type: row.get(1),
                    entity_id: row.get(2),
                    event_type: row.get(3),
                    payload,
                    actor: row.get(5),
                    timestamp,
                    prev_hash,
                    hash,
                    sequence: row.get(9),
                })
            })
            .collect()
    }

    async fn get_events_since(
        &self,
        entity_type: &str,
        entity_id: i64,
        sequence: i64,
    ) -> Result<Vec<Event>, EventError> {
        let rows = sqlx::query(
            r#"
            SELECT id, entity_type, entity_id, event_type, payload, actor,
                   timestamp, prev_hash, hash, sequence
            FROM events
            WHERE entity_type = ? AND entity_id = ? AND sequence > ?
            ORDER BY sequence ASC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(sequence)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| EventError::StorageError(e.to_string()))?;

        // Same row-to-event mapping as get_events
        rows.into_iter()
            .map(|row| {
                let timestamp_str: String = row.get(6);
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?
                    .with_timezone(&Utc);

                let prev_hash_vec: Vec<u8> = row.get(7);
                let mut prev_hash = [0u8; 32];
                prev_hash.copy_from_slice(&prev_hash_vec);

                let hash_vec: Vec<u8> = row.get(8);
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&hash_vec);

                let payload_str: String = row.get(4);
                let payload: serde_json::Value = serde_json::from_str(&payload_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?;

                Ok(Event {
                    id: row.get(0),
                    entity_type: row.get(1),
                    entity_id: row.get(2),
                    event_type: row.get(3),
                    payload,
                    actor: row.get(5),
                    timestamp,
                    prev_hash,
                    hash,
                    sequence: row.get(9),
                })
            })
            .collect()
    }

    async fn get_events_by_range(
        &self,
        entity_type: &str,
        entity_id: i64,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<Event>, EventError> {
        let rows = sqlx::query(
            r#"
            SELECT id, entity_type, entity_id, event_type, payload, actor,
                   timestamp, prev_hash, hash, sequence
            FROM events
            WHERE entity_type = ? AND entity_id = ? AND timestamp >= ? AND timestamp <= ?
            ORDER BY sequence ASC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(from.to_rfc3339())
        .bind(to.to_rfc3339())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| EventError::StorageError(e.to_string()))?;

        // Same row-to-event mapping
        rows.into_iter()
            .map(|row| {
                let timestamp_str: String = row.get(6);
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?
                    .with_timezone(&Utc);

                let prev_hash_vec: Vec<u8> = row.get(7);
                let mut prev_hash = [0u8; 32];
                prev_hash.copy_from_slice(&prev_hash_vec);

                let hash_vec: Vec<u8> = row.get(8);
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&hash_vec);

                let payload_str: String = row.get(4);
                let payload: serde_json::Value = serde_json::from_str(&payload_str)
                    .map_err(|e| EventError::StorageError(e.to_string()))?;

                Ok(Event {
                    id: row.get(0),
                    entity_type: row.get(1),
                    entity_id: row.get(2),
                    event_type: row.get(3),
                    payload,
                    actor: row.get(5),
                    timestamp,
                    prev_hash,
                    hash,
                    sequence: row.get(9),
                })
            })
            .collect()
    }

    async fn get_latest_sequence(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<i64, EventError> {
        let row = sqlx::query("SELECT MAX(sequence) FROM events WHERE entity_type = ? AND entity_id = ?")
            .bind(entity_type)
            .bind(entity_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| EventError::StorageError(e.to_string()))?;

        Ok(row.get::<Option<i64>, _>(0).unwrap_or(0))
    }
}
```

**Key implementation notes:**
- All async methods return proper EventError variants
- BLOB columns store hash arrays
- TEXT columns store JSON and timestamps as ISO 8601 strings
- Row deserialization extracts each field with type conversion
- Error handling distinguishes between duplicate sequences and other storage errors

### T021: WAL Mode Setup

Update the SQLite pool initialization in `crates/agileplus-sqlite/src/lib.rs`:

```rust
pub async fn init_pool(database_url: &str) -> Result<SqlitePool, Error> {
    let pool = SqlitePool::connect(database_url).await?;

    // Enable WAL mode for concurrent reads
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await
        .map_err(|e| Error::DatabaseError(format!("Failed to set journal_mode: {}", e)))?;

    // Reduce fsync overhead (safe for development, reconsider for production)
    sqlx::query("PRAGMA synchronous = NORMAL")
        .execute(&pool)
        .await
        .map_err(|e| Error::DatabaseError(format!("Failed to set synchronous: {}", e)))?;

    // Autocheckpoint every 1000 pages (reduce -wal file growth)
    sqlx::query("PRAGMA wal_autocheckpoint = 1000")
        .execute(&pool)
        .await
        .map_err(|e| Error::DatabaseError(format!("Failed to set wal_autocheckpoint: {}", e)))?;

    // Run migrations to create tables
    migrate_internal(&pool).await?;

    Ok(pool)
}

async fn migrate_internal(pool: &SqlitePool) -> Result<(), Error> {
    // Include all migration files from migrations/ directory
    // Using sqlx::migrate! macro or manual SQL execution

    // Example: execute all .sql files in migrations/ in order
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| Error::DatabaseError(format!("Migration failed: {}", e)))?;

    Ok(())
}
```

**WAL Mode benefits:**
- Allows concurrent reads while writes are in progress
- Reduces lock contention
- Improves throughput for event append operations
- PRAGMA synchronous = NORMAL reduces fsync calls (acceptable for non-critical data)
- wal_autocheckpoint prevents -wal file from growing unbounded

## Implementation Guidance

1. **Migration approach:** Create one migration file per table (T015-T019). Use sqlx migrations for consistency.
2. **Transaction safety:** Wrap append operations in transactions if supporting atomic multi-event inserts.
3. **Performance:** Indexes are critical; run EXPLAIN QUERY PLAN on common queries to verify index usage.
4. **WAL cleanup:** Periodic manual checkpoint with `PRAGMA wal_checkpoint(RESTART)` if needed.
5. **Testing:** Test duplicate sequence handling, time-range queries, and hash chain retrieval.

## Definition of Done

- [ ] All 5 migration files created and syntactically correct
- [ ] SqliteEventStore compiles and implements EventStore trait fully
- [ ] PRAGMA settings applied on pool initialization
- [ ] EventStore trait methods tested with sample data
- [ ] Hash array serialization/deserialization works correctly
- [ ] Duplicate sequence errors handled gracefully
- [ ] No clippy warnings

## Command

```bash
spec-kitty implement WP03 --base WP02
```

## Activity Log

- 2026-03-02T11:42:12Z – claude-opus – shell_pid=36420 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:46:49Z – claude-opus – shell_pid=36420 – lane=for_review – Ready for review: 5 migration files, event repo, EventStore impl, 23 tests pass
- 2026-03-02T23:19:02Z – claude-opus – shell_pid=36420 – lane=done – Merged to main, 516 tests passing
