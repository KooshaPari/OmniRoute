---
work_package_id: WP17
title: Git-Backed State Sync
lane: "done"
dependencies: []
base_branch: main
base_commit: 4bf2e82137fe0ad91bd6bda6d0d07e79e5139784
created_at: '2026-03-02T12:25:32.828328+00:00'
subtasks: [T100, T101, T102, T103]
shell_pid: "2538"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP17: Git-Backed State Sync

Implementation command: `spec-kitty implement WP17 --base WP16`

## Objective

Serialize SQLite state to deterministic, mergeable files for git-backed synchronization across devices.

## Subtasks

### T100: Export Format Definition

Define the export format for git-backed state at `.agileplus/sync/` in the repository root.

**Directory structure:**

```
.agileplus/sync/
├── events/
│   ├── feature/
│   │   ├── 1.jsonl     # Events for feature ID 1, one JSON per line
│   │   ├── 2.jsonl     # Events for feature ID 2
│   │   └── ...
│   ├── work_package/
│   │   ├── 1.jsonl
│   │   ├── 2.jsonl
│   │   └── ...
│   └── ...
├── snapshots/
│   ├── feature/
│   │   ├── 1.json      # Latest snapshot for feature 1
│   │   ├── 2.json      # Latest snapshot for feature 2
│   │   └── ...
│   ├── work_package/
│   │   ├── 1.json
│   │   └── ...
│   └── ...
├── sync_state.json     # SyncMapping entries and device sync vectors
└── device.json         # Local DeviceNode info (device_id, hostname, tailscale_ip)
```

**File format rules:**

- **Event files (.jsonl)**: One JSON object per line, ordered by `sequence` number (ascending)
  ```json
  {"entity_type":"Feature","entity_id":"1","sequence":1,"event_type":"Created","data":{...},"timestamp":"2026-03-02T10:00:00Z"}
  {"entity_type":"Feature","entity_id":"1","sequence":2,"event_type":"Transitioned","data":{...},"timestamp":"2026-03-02T10:00:05Z"}
  ```

- **Snapshot files (.json)**: Latest snapshot only, pretty-printed with sorted keys
  ```json
  {
    "entity_type": "Feature",
    "entity_id": "1",
    "event_sequence": 2,
    "state": { ... },
    "created_at": "2026-03-02T10:00:00Z",
    "updated_at": "2026-03-02T10:00:05Z"
  }
  ```

- **sync_state.json**: SyncMapping entries (vector clocks per peer)
  ```json
  {
    "sync_mappings": [
      {
        "local_device_id": "uuid-1",
        "peer_device_id": "uuid-2",
        "sync_vector": {
          "Feature/1": 2,
          "Feature/2": 1,
          "WorkPackage/3": 5
        },
        "last_sync": "2026-03-02T10:15:00Z"
      }
    ]
  }
  ```

- **device.json**: Local device information
  ```json
  {
    "device_id": "uuid-1",
    "hostname": "my-laptop",
    "tailscale_ip": "100.x.x.x",
    "created_at": "2026-03-02T09:00:00Z"
  }
  ```

**Deterministic output:**
- All JSON objects use sorted keys (alphabetical order)
- Pretty-printed with 2-space indentation
- UTF-8 encoding
- No trailing newlines for JSON files; JSONL files end with newline after last event

### T101: State Export

Implement `export_state(db, output_dir)` in `crates/agileplus-p2p/src/export.rs`:

```rust
pub async fn export_state(
    db: &SqlitePool,
    output_dir: &Path,
) -> Result<ExportStats, ExportError> {
    // For each entity in the database:
    // 1. Export all events to events/{entity_type}/{entity_id}.jsonl
    //    - Append new events to existing file (preserves append-only semantics)
    //    - Order by sequence number
    // 2. Export latest snapshot to snapshots/{entity_type}/{entity_id}.json
    //    - Overwrite if exists (latest snapshot)
    //
    // 3. Export sync mappings to sync_state.json
    // 4. Export local device to device.json
    // 5. Use serde_json with BTreeMap for sorted keys
    // 6. Return ExportStats { events_exported, snapshots_exported, duration }
}

pub struct ExportStats {
    pub events_exported: usize,
    pub snapshots_exported: usize,
    pub sync_mappings_exported: usize,
    pub duration_ms: u64,
}
```

Implementation details:
- Create output directories if missing
- Use `serde_json::to_string_pretty()` with custom serializer for sorted keys (or use `indexmap` with `sort_keys` feature)
- Handle large event files by streaming writes (don't load entire JSONL into memory)
- Include error recovery: log warnings for unparseable entities but continue export
- Record event hash for T102 import validation

### T102: State Import

Implement `import_state(input_dir, db)` in `crates/agileplus-p2p/src/import.rs`:

```rust
pub async fn import_state(
    input_dir: &Path,
    db: &SqlitePool,
) -> Result<ImportStats, ImportError> {
    // 1. Read event JSONL files from events/
    //    - Parse each line as JSON
    //    - For each event, check if already in SQLite (compare by hash)
    //    - Insert only new events
    //    - Maintain sequence order
    //
    // 2. Read snapshots from snapshots/
    //    - Parse JSON
    //    - Compare event_sequence with existing snapshot
    //    - Update if newer
    //
    // 3. Merge sync_state.json
    //    - Read sync mappings
    //    - Merge with existing mappings (update vectors)
    //
    // 4. Skip device.json (each device keeps its own)
    //
    // 5. Return ImportStats { events_imported, snapshots_updated, duration }
}

pub struct ImportStats {
    pub events_imported: usize,
    pub snapshots_updated: usize,
    pub sync_mappings_merged: usize,
    pub duration_ms: u64,
}
```

Implementation details:
- Use transaction for atomic import
- Rollback on error (no partial imports)
- Skip duplicate events without error
- Validate event structure before insert
- Update snapshot only if `event_sequence` is higher

### T103: Git Merge Conflict Handling

Implement conflict resolution in `crates/agileplus-p2p/src/git_merge.rs`:

**Strategy per file type:**

1. **Event files (.jsonl)**: Append-only
   - Git merge automatically resolves: new lines added to both sides are appended
   - No conflict expected; if git reports conflict, take both sides and deduplicate by event hash

2. **Snapshot files (.json)**: Latest-wins
   - If both sides modified: parse both, compare `event_sequence`
   - Apply the snapshot with higher sequence
   - Provide helper: `resolve_snapshot_conflict(local_json, remote_json) -> json`

3. **sync_state.json**: Field-level merge
   - Each `sync_mapping` (identified by `local_device_id + peer_device_id`) is independent
   - Merge: take each mapping from both sides, keep highest `event_sequence` per entity
   - Resolve time: use the later `last_sync` timestamp

Provide CLI command:

```rust
pub async fn resolve_git_conflicts(
    repo_dir: &Path,
    db: &SqlitePool,
) -> Result<ConflictResolution, ResolutionError> {
    // Detect unmerged paths in .agileplus/sync/
    // Apply conflict resolution rules
    // Stage resolved files
    // Return ConflictResolution { resolved_count, remaining_conflicts }
}
```

Also provide `agileplus sync git-resolve` command for manual resolution.

## Definition of Done

- [ ] Export produces deterministic files (sorted keys, consistent formatting)
- [ ] JSONL event files are append-only (new events added at end)
- [ ] Snapshots are overwritten with latest version
- [ ] Import correctly merges events without duplicates
- [ ] Git merge works for event files (no conflicts on append)
- [ ] Snapshot conflicts resolved by sequence number
- [ ] sync_state.json field-level merge implemented
- [ ] Device info persists independently per device
- [ ] Round-trip test: export → import → export produces identical files
- [ ] Documentation: Git merge conflict resolution strategy

## Activity Log

- 2026-03-02T12:25:33Z – claude-opus – shell_pid=2538 – lane=doing – Assigned agent via workflow command
- 2026-03-02T20:44:13Z – claude-opus – shell_pid=2538 – lane=for_review – Ready for review: git-backed state export/import with 29 tests, deterministic JSONL/JSON, conflict resolution
- 2026-03-02T23:19:43Z – claude-opus – shell_pid=2538 – lane=done – Merged to main, 516 tests passing
