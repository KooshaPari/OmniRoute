---
work_package_id: WP06
title: SQLite Adapter
lane: "done"
dependencies: [WP05]
base_branch: 001-spec-driven-development-engine-WP05
base_commit: 5caddd188f117c68c177b4198250fa4251c931de
created_at: '2026-02-28T09:38:25.835950+00:00'
subtasks:
- T031
- T032
- T033
- T034
- T035
- T036
- T037
phase: Phase 2 - Adapters
assignee: ''
agent: "claude-wp06"
shell_pid: "57473"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP06: SQLite Adapter

## Implementation Command

```bash
spec-kitty implement WP06 --base WP05
```

## Objectives

Implement the SQLite storage adapter in `crates/agileplus-sqlite/` that fulfills the `StoragePort` trait from WP05. This includes schema migrations for all entities defined in `data-model.md`, full CRUD operations, and the `rebuild_from_git()` capability that reconstructs SQLite state from git artifacts (FR-017).

### Success Criteria

1. All migration SQL files create tables matching `data-model.md` entities with correct columns, types, constraints, and indexes.
2. `SqliteStorageAdapter` implements every method of `StoragePort`.
3. Integration tests pass for all CRUD operations using an in-memory SQLite database.
4. Migration up/down works correctly (idempotent, reversible).
5. `rebuild_from_git()` successfully populates SQLite from fixture git artifacts (meta.json, chain.jsonl, evidence files).
6. WAL mode is enabled for concurrent read access.
7. All queries use parameterized statements (no SQL injection).

## Context & Constraints

- **Storage strategy**: SQLite is the queryable cache; git is the source of truth. SQLite can always be rebuilt from git artifacts. See `plan.md` section 5 and `data-model.md` "Git Artifact Layout".
- **Dependency**: `rusqlite` with WAL mode. See `research.md` R1 for decision rationale.
- **Schema**: Tables defined in `data-model.md`: features, work_packages, governance_contracts, audit_log, evidence, policy_rules, metrics, wp_dependencies.
- **Indexes**: All indexes listed in `data-model.md` "Indexes" section must be created.
- **Performance**: SQLite queries must complete in <5ms (plan.md performance goals). Use prepared statements and connection pooling.
- **Concurrency**: WAL mode enables concurrent reads. Write operations must be serialized (single writer). Use a connection pool with write serialization.

## Subtask Guidance

---

### T031: Create SQLite migration system in `crates/agileplus-sqlite/src/migrations/`

**Purpose**: Define the database schema as versioned, embedded SQL migrations that run on startup. Migrations must be idempotent and reversible.

**Steps**:
1. Create `crates/agileplus-sqlite/src/migrations/` directory.
2. Create migration files numbered sequentially:
   - `001_create_features.sql` -- features table
   - `002_create_work_packages.sql` -- work_packages table
   - `003_create_governance_contracts.sql` -- governance_contracts table
   - `004_create_audit_log.sql` -- audit_log table
   - `005_create_evidence.sql` -- evidence table
   - `006_create_policy_rules.sql` -- policy_rules table
   - `007_create_metrics.sql` -- metrics table
   - `008_create_wp_dependencies.sql` -- wp_dependencies table
   - `009_create_indexes.sql` -- all indexes from data-model.md

3. Each migration file contains `-- UP` and `-- DOWN` sections:
   ```sql
   -- UP
   CREATE TABLE IF NOT EXISTS features (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       slug TEXT UNIQUE NOT NULL,
       friendly_name TEXT NOT NULL,
       state TEXT NOT NULL CHECK(state IN ('created','specified','researched','planned','implementing','validated','shipped','retrospected')),
       spec_hash BLOB NOT NULL,
       target_branch TEXT NOT NULL DEFAULT 'main',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
   );

   -- DOWN
   DROP TABLE IF EXISTS features;
   ```

4. Create a `MigrationRunner` struct in `migrations/mod.rs`:
   - `fn new(conn: &Connection) -> Self`
   - `fn run_all(&self) -> Result<(), DomainError>` -- apply all pending migrations
   - `fn rollback_last(&self) -> Result<(), DomainError>`
   - Track applied migrations in a `_migrations` meta table.

5. Embed migration SQL files using `include_str!()` for single-binary distribution.

**Files**: `crates/agileplus-sqlite/src/migrations/` (all files), `crates/agileplus-sqlite/src/migrations/mod.rs`

**Validation**:
- Migrations create all 8 tables + indexes.
- Running migrations twice is idempotent (uses `CREATE TABLE IF NOT EXISTS`).
- `_migrations` table tracks which migrations have been applied.
- Column types, constraints, and CHECK clauses match `data-model.md` exactly.

---

### T032: Implement `SqliteStorageAdapter` struct implementing `StoragePort`

**Purpose**: Create the adapter struct that holds the database connection and implements the `StoragePort` trait.

**Steps**:
1. Create `crates/agileplus-sqlite/src/lib.rs` with the public adapter struct.
2. Define `SqliteStorageAdapter`:
   ```rust
   pub struct SqliteStorageAdapter {
       conn: Arc<Mutex<Connection>>,  // Write-serialized connection
       read_pool: Vec<Connection>,     // Read-only connections for concurrent reads
   }
   ```
3. Implement constructor:
   - `pub fn new(db_path: &Path) -> Result<Self, DomainError>` -- opens DB, enables WAL, runs migrations
   - `pub fn in_memory() -> Result<Self, DomainError>` -- for testing
4. Enable WAL mode on connection open: `PRAGMA journal_mode=WAL;`
5. Enable foreign keys: `PRAGMA foreign_keys=ON;`
6. Run `MigrationRunner::run_all()` in the constructor.
7. Implement `StoragePort` for `SqliteStorageAdapter` (method bodies in T033-T036).

**Files**: `crates/agileplus-sqlite/src/lib.rs`

**Validation**:
- `SqliteStorageAdapter::in_memory()` succeeds and creates all tables.
- WAL mode is confirmed via `PRAGMA journal_mode;` query.
- Foreign keys are enforced.

---

### T033: Implement feature CRUD

**Purpose**: Implement all feature-related `StoragePort` methods.

**Steps**:
1. Implement in `crates/agileplus-sqlite/src/lib.rs` or a separate `repository/features.rs`:
   - `create_feature`: INSERT with all fields, return `last_insert_rowid()`.
   - `get_feature_by_slug`: SELECT WHERE slug = ?1, map row to `Feature` struct.
   - `get_feature_by_id`: SELECT WHERE id = ?1.
   - `update_feature_state`: UPDATE SET state = ?1, updated_at = ?2 WHERE id = ?3.
   - `list_features_by_state`: SELECT WHERE state = ?1 ORDER BY created_at.
   - `list_all_features`: SELECT all ORDER BY created_at DESC.

2. Create a `row_to_feature(row: &Row) -> Result<Feature, rusqlite::Error>` helper for DRY mapping.
3. All queries use parameterized statements (`?1`, `?2`, etc.).
4. Write unit tests:
   - Create a feature, retrieve by slug, verify fields match.
   - Update state, retrieve, verify state changed and updated_at advanced.
   - List by state with multiple features, verify filtering.
   - Unique slug constraint: attempt duplicate insert, verify error.

**Files**: `crates/agileplus-sqlite/src/lib.rs` or `crates/agileplus-sqlite/src/repository/features.rs`

**Validation**:
- All 6 feature methods work with in-memory SQLite.
- Parameterized queries (no string interpolation).
- Row mapping handles all Feature fields including spec_hash (BLOB).

---

### T034: Implement work package CRUD

**Purpose**: Implement all work-package-related `StoragePort` methods including dependency queries.

**Steps**:
1. Implement WP CRUD methods:
   - `create_work_package`: INSERT, handle `file_scope` as JSON text, return ID.
   - `get_work_package`: SELECT by ID, parse `file_scope` JSON array.
   - `update_wp_state`: UPDATE state + updated_at.
   - `list_wps_by_feature`: SELECT WHERE feature_id = ?1 ORDER BY sequence.
   - `add_wp_dependency`: INSERT into wp_dependencies.
   - `get_wp_dependencies`: SELECT FROM wp_dependencies WHERE wp_id = ?1.
   - `get_ready_wps`: Query WPs in `planned` state whose dependencies are all in `done` state.

2. The `get_ready_wps` query is the most complex:
   ```sql
   SELECT wp.* FROM work_packages wp
   WHERE wp.feature_id = ?1 AND wp.state = 'planned'
   AND NOT EXISTS (
       SELECT 1 FROM wp_dependencies d
       JOIN work_packages dep ON dep.id = d.depends_on
       WHERE d.wp_id = wp.id AND dep.state != 'done'
   )
   ORDER BY wp.sequence;
   ```

3. Create `row_to_work_package` helper, handling JSON deserialization of `file_scope`.
4. Write unit tests:
   - Create WPs with dependencies, verify `get_ready_wps` returns only unblocked ones.
   - Transition a dependency to `done`, verify blocked WP becomes ready.
   - `list_wps_by_feature` returns correct ordering by sequence.

**Files**: `crates/agileplus-sqlite/src/lib.rs` or `crates/agileplus-sqlite/src/repository/work_packages.rs`

**Validation**:
- `file_scope` round-trips correctly (Vec<String> -> JSON text -> Vec<String>).
- `get_ready_wps` correctly evaluates transitive dependency satisfaction.
- WP foreign key to features is enforced.

---

### T035: Implement audit CRUD

**Purpose**: Implement audit entry persistence. The hash chain integrity is a domain concern (WP04) -- this layer just stores and retrieves entries.

**Steps**:
1. Implement audit methods:
   - `append_audit_entry`: INSERT with hash and prev_hash as BLOBs. Verify that prev_hash matches the hash of the most recent entry for this feature (defense in depth).
   - `get_audit_trail`: SELECT WHERE feature_id = ?1 ORDER BY id ASC (chronological order for chain verification).
   - `get_latest_audit_entry`: SELECT WHERE feature_id = ?1 ORDER BY id DESC LIMIT 1.

2. BLOB handling for hashes: rusqlite handles `[u8; 32]` or `Vec<u8>` natively. Use `row.get::<_, Vec<u8>>(col)` and convert.
3. `evidence_refs` stored as JSON text, deserialized on read.
4. Defense-in-depth check in `append_audit_entry`:
   ```rust
   let latest = self.get_latest_audit_entry(entry.feature_id).await?;
   if let Some(latest) = latest {
       if entry.prev_hash != latest.hash {
           return Err(DomainError::AuditChainBroken { ... });
       }
   }
   ```

5. Write unit tests:
   - Append 3 entries, retrieve trail, verify ordering and hash linkage.
   - Attempt to append entry with wrong prev_hash, verify rejection.
   - Get latest entry, verify it's the most recently appended.

**Files**: `crates/agileplus-sqlite/src/lib.rs` or `crates/agileplus-sqlite/src/repository/audit.rs`

**Validation**:
- Hash BLOBs store and retrieve correctly (32 bytes each).
- Chain integrity check in append prevents broken chains at the storage layer.
- Audit trail returns entries in chronological order.

---

### T036: Implement evidence + policy + metric CRUD

**Purpose**: Complete the remaining `StoragePort` methods for evidence, policy rules, and metrics.

**Steps**:
1. **Evidence CRUD**:
   - `create_evidence`: INSERT, return ID. `metadata` stored as nullable JSON text.
   - `get_evidence_by_wp`: SELECT WHERE wp_id = ?1.
   - `get_evidence_by_fr`: SELECT WHERE fr_id = ?1.

2. **Policy Rule CRUD**:
   - `create_policy_rule`: INSERT with `rule` as JSON text.
   - `list_active_policies`: SELECT WHERE active = 1.

3. **Governance Contract CRUD**:
   - `create_governance_contract`: INSERT, `rules` as JSON text.
   - `get_governance_contract`: SELECT WHERE feature_id = ?1 AND version = ?2.
   - `get_latest_governance_contract`: SELECT WHERE feature_id = ?1 ORDER BY version DESC LIMIT 1.

4. **Metric CRUD**:
   - `record_metric`: INSERT with `metadata` as nullable JSON text.
   - `get_metrics_by_feature`: SELECT WHERE feature_id = ?1 ORDER BY timestamp.

5. Write unit tests for each entity type: create, retrieve, list/filter.

**Files**: `crates/agileplus-sqlite/src/lib.rs` or `crates/agileplus-sqlite/src/repository/` (multiple files)

**Validation**:
- JSON fields (evidence.metadata, policy_rule.rule, governance_contract.rules) round-trip correctly.
- Evidence type CHECK constraint is enforced (valid types from data-model.md).
- Policy domain CHECK constraint is enforced (quality, security, reliability).

---

### T037: Implement `rebuild_from_git()` (FR-017)

**Purpose**: Parse git artifacts (meta.json, audit/chain.jsonl, evidence files) and populate SQLite from scratch. This is the "SQLite is a cache" guarantee -- if the database is deleted, it can be fully reconstructed from git.

**Steps**:
1. Add a method to `SqliteStorageAdapter`:
   ```rust
   pub async fn rebuild_from_git(&self, vcs: &dyn VcsPort) -> Result<RebuildReport, DomainError>
   ```
   Note: This method takes a `VcsPort` reference to read git artifacts without coupling to git2 directly.

2. Define `RebuildReport { features_restored: usize, wps_restored: usize, audit_entries_restored: usize, evidence_restored: usize }`.

3. Rebuild sequence:
   a. Clear all existing data (within a transaction).
   b. Scan for feature directories: `kitty-specs/*/meta.json`.
   c. For each feature:
      - Parse `meta.json` -> create Feature record.
      - Parse `audit/chain.jsonl` -> append AuditEntry records (verify chain integrity during import).
      - Scan `evidence/WP*/` -> create Evidence records.
      - Parse `contracts/governance-v*.json` -> create GovernanceContract records.
      - Reconstruct WP records from task files or meta.json WP section.

4. Run within a single transaction for atomicity. Rollback on any parse error.

5. Write integration tests with fixture files:
   - Create fixture `meta.json`, `chain.jsonl`, evidence files in a temp directory.
   - Mock `VcsPort` to return these fixtures via `read_artifact()` and `scan_feature_artifacts()`.
   - Run `rebuild_from_git`, verify all records created correctly.
   - Verify chain integrity is checked during import.

**Files**: `crates/agileplus-sqlite/src/rebuild.rs`

**Validation**:
- Rebuild from fixtures produces identical records to manual creation.
- Chain integrity is verified during import (rejects corrupt chain.jsonl).
- Transaction atomicity: partial failure leaves DB unchanged.
- `RebuildReport` counts match expected fixture contents.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WAL mode + concurrent writes | High -- data corruption | Serialize all writes through `Arc<Mutex<Connection>>`. Only read connections are pooled. |
| Migration ordering errors | Medium -- schema inconsistency | Number migrations sequentially. Test fresh DB creation + migration from empty. |
| JSON field schema drift | Medium -- stored JSON doesn't match expected structure | Use serde with explicit types for JSON fields. Add schema validation on read. |
| BLOB hash comparison | Low -- byte ordering issues | Use `Vec<u8>` consistently. Compare with `==` on byte slices. |
| rebuild_from_git partial failure | High -- inconsistent state | Wrap entire rebuild in a single transaction. Rollback on any error. |
| rusqlite async compatibility | Medium -- rusqlite is synchronous | Use `tokio::task::spawn_blocking` to wrap synchronous rusqlite calls in async context. |

## Review Guidance

1. **Schema fidelity**: Compare every CREATE TABLE statement against `data-model.md` entity definitions. Every column, type, constraint, and CHECK must match.
2. **Index coverage**: All indexes from `data-model.md` "Indexes" section must be created.
3. **Parameterized queries**: Zero string interpolation in SQL. Every value passed via `?N` parameters.
4. **Error mapping**: rusqlite errors must be mapped to `DomainError` variants, not leaked.
5. **Test coverage**: Every `StoragePort` method has at least one happy-path and one error-path test.
6. **WAL confirmation**: Constructor must verify WAL mode is active.
7. **rebuild_from_git atomicity**: Verify single-transaction wrapping.

## Activity Log

| Timestamp | Action | Agent | Details |
|-----------|--------|-------|---------|
| 2026-02-27T00:00:00Z | Prompt generated | system | WP06 prompt created via /spec-kitty.tasks |
- 2026-02-28T09:38:26Z – claude-wp06 – shell_pid=57473 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:51:42Z – claude-wp06 – shell_pid=57473 – lane=for_review – Ready for review: SqliteStorageAdapter with 23 passing tests
- 2026-02-28T09:51:50Z – claude-wp06 – shell_pid=57473 – lane=done – Review passed: 23 tests, clean build, parameterized queries, WAL mode
