---
work_package_id: WP02
title: Storage Port Extension + SQLite Adapter
lane: planned
dependencies: []
subtasks: [T007, T008, T009, T010, T011, T012, T013]
phase: Phase 2 - Storage
estimated_lines: 450
frs: [FR-S01, FR-S02, FR-S03, FR-S04, FR-M05, FR-M06, FR-C06]
priority: P1
---

# WP02: Storage Port Extension + SQLite Adapter

## Implementation Command

```bash
spec-kitty implement WP02 --base WP01
```

WP01 must be merged before starting this work package.

## Objectives

Extend the `StoragePort` trait in `crates/agileplus-domain` with all Module and Cycle CRUD
methods. Write and apply SQLite migration `006_modules_cycles.sql`. Implement all new trait
methods in `crates/agileplus-sqlite`, including circular-reference detection for Module hierarchy
and aggregate WP progress queries for Cycles.

### Success Criteria

- `cargo check` passes for both `agileplus-domain` and `agileplus-sqlite` with zero errors.
- `cargo test -p agileplus-sqlite` passes, including new storage-layer unit tests.
- Migration `006_modules_cycles.sql` applies cleanly to an existing database with existing `features`
  rows (backward compat -- existing rows get `module_id = NULL`).
- Circular reference detection: inserting a module with its descendant as parent returns
  `DomainError::CircularModuleRef`.
- Module delete with children returns `DomainError::ModuleHasDependents`.
- `get_cycle_with_features` returns a `WpProgressSummary` with accurate per-state counts.
- Feature add to scoped cycle rejects if feature is not in module scope.

## Context & Constraints

- **Pattern**: `agileplus-sqlite` uses `Arc<Mutex<Connection>>` for a single write-serialized
  rusqlite connection. All new methods follow the same pattern as existing repository functions
  (see `crates/agileplus-sqlite/src/repository/features.rs` for the canonical example).
- **Async trait**: `StoragePort` uses `impl Future<Output = ...) + Send` return syntax (not
  `async_trait` macro). New methods must match this signature exactly.
- **Migration numbering**: Existing migrations use numbered SQL files. The data model doc names
  the file `006_modules_cycles.sql` -- use that number (verify there is no existing 006 first;
  if there is, use the next available number and document the change).
- **Foreign keys**: The migration must run `PRAGMA foreign_keys = ON` or rely on the adapter's
  existing pragma setup. Check `SqliteStorageAdapter::configure_and_migrate` to confirm FKs are
  already enabled globally (they are -- `PRAGMA foreign_keys = ON` is set at connection open).
- **Recursive CTE**: Use SQLite recursive CTE for ancestor lookup in circular-reference detection.
  Standard SQLite (3.35+) supports `WITH RECURSIVE`.
- **No `unwrap()`** anywhere in new production code.
- **Files** (relative to repo root):
  - MODIFIED: `crates/agileplus-domain/src/ports/storage.rs`
  - NEW: `crates/agileplus-sqlite/src/migrations/006_modules_cycles.sql`
  - NEW: `crates/agileplus-sqlite/src/repository/modules.rs`
  - NEW: `crates/agileplus-sqlite/src/repository/cycles.rs`
  - MODIFIED: `crates/agileplus-sqlite/src/repository/mod.rs` -- add `pub mod modules; pub mod cycles;`
  - MODIFIED: `crates/agileplus-sqlite/src/lib.rs` -- add imports and delegate trait methods

---

## Subtask Guidance

### T007 - Add Module CRUD Methods to StoragePort Trait

**Purpose**: Define the persistence contract for Module entities.

**File**: `crates/agileplus-domain/src/ports/storage.rs`

**Steps**:

1. Add `use crate::domain::module::{Module, ModuleFeatureTag, ModuleWithFeatures};` to imports.

2. Append to the `StoragePort` trait (after governance methods) -- Traces to FR-S01:

   ```rust
   // -- Module CRUD --

   /// Create a new module, returning its assigned ID.
   /// Traces to: FR-M01
   fn create_module(
       &self,
       module: &Module,
   ) -> impl Future<Output = Result<i64, DomainError>> + Send;

   /// Retrieve a module by its primary key.
   fn get_module_by_id(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<Option<Module>, DomainError>> + Send;

   /// Retrieve a module by its slug within an optional parent scope.
   /// Pass parent_module_id = None to look up root-level modules.
   fn get_module_by_slug(
       &self,
       slug: &str,
       parent_module_id: Option<i64>,
   ) -> impl Future<Output = Result<Option<Module>, DomainError>> + Send;

   /// Update a module's name, slug, and description. Returns Err if not found.
   fn update_module(
       &self,
       module: &Module,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Delete a module by ID. MUST fail if it owns Features or has child Modules.
   /// Traces to: FR-M06
   fn delete_module(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// List all root modules (parent_module_id IS NULL).
   fn list_root_modules(
       &self,
   ) -> impl Future<Output = Result<Vec<Module>, DomainError>> + Send;

   /// List direct children of a module.
   fn list_child_modules(
       &self,
       parent_id: i64,
   ) -> impl Future<Output = Result<Vec<Module>, DomainError>> + Send;

   /// Retrieve a module with its owned features, tagged features, and direct children.
   /// Traces to: FR-M05
   fn get_module_with_features(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<Option<ModuleWithFeatures>, DomainError>> + Send;

   /// Set the module_id on a Feature (ownership assignment).
   /// Traces to: FR-M03
   fn assign_feature_to_module(
       &self,
       feature_id: i64,
       module_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Clear the module_id on a Feature (remove ownership).
   fn unassign_feature_from_module(
       &self,
       feature_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;
   ```

**Validation**: `cargo check -p agileplus-domain` zero errors.

---

### T008 - Add Cycle CRUD Methods to StoragePort Trait

**Purpose**: Define the persistence contract for Cycle entities.

**File**: `crates/agileplus-domain/src/ports/storage.rs`

**Steps**:

1. Add `use crate::domain::cycle::{Cycle, CycleState, CycleWithFeatures};` to imports.

2. Append to the `StoragePort` trait -- Traces to FR-S02:

   ```rust
   // -- Cycle CRUD --

   /// Create a new cycle, returning its assigned ID.
   /// Traces to: FR-C01
   fn create_cycle(
       &self,
       cycle: &Cycle,
   ) -> impl Future<Output = Result<i64, DomainError>> + Send;

   /// Retrieve a cycle by primary key.
   fn get_cycle_by_id(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<Option<Cycle>, DomainError>> + Send;

   /// Retrieve a cycle by its unique name.
   fn get_cycle_by_name(
       &self,
       name: &str,
   ) -> impl Future<Output = Result<Option<Cycle>, DomainError>> + Send;

   /// Update the state field of a cycle.
   fn update_cycle_state(
       &self,
       id: i64,
       state: CycleState,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Update mutable fields (name, description, start_date, end_date, module_scope_id).
   fn update_cycle(
       &self,
       cycle: &Cycle,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Delete a cycle. Does NOT change Feature states (per spec edge case).
   fn delete_cycle(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// List all cycles, optionally filtered by state.
   fn list_cycles(
       &self,
       state_filter: Option<CycleState>,
   ) -> impl Future<Output = Result<Vec<Cycle>, DomainError>> + Send;

   /// Retrieve a cycle with its assigned features and aggregate WP progress.
   /// Traces to: FR-C06
   fn get_cycle_with_features(
       &self,
       id: i64,
   ) -> impl Future<Output = Result<Option<CycleWithFeatures>, DomainError>> + Send;
   ```

**Validation**: `cargo check -p agileplus-domain` zero errors.

---

### T009 - Add Join Table Methods to StoragePort Trait

**Purpose**: Define the persistence contract for `module_feature_tags` and `cycle_features`.

**File**: `crates/agileplus-domain/src/ports/storage.rs`

**Steps**:

1. Append to the `StoragePort` trait -- Traces to FR-S03:

   ```rust
   // -- Module-Feature Tag ops (many-to-many secondary association) --

   /// Tag a Feature to a Module (secondary/soft association).
   /// Traces to: FR-M04
   fn tag_feature_to_module(
       &self,
       module_id: i64,
       feature_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Remove a tag between a Feature and a Module.
   fn untag_feature_from_module(
       &self,
       module_id: i64,
       feature_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   // -- Cycle-Feature ops (many-to-many assignment) --

   /// Add a Feature to a Cycle. Enforces module scope if cycle has module_scope_id.
   /// Traces to: FR-C03, FR-C04, FR-C05
   fn add_feature_to_cycle(
       &self,
       cycle_id: i64,
       feature_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;

   /// Remove a Feature from a Cycle (does not change Feature state).
   fn remove_feature_from_cycle(
       &self,
       cycle_id: i64,
       feature_id: i64,
   ) -> impl Future<Output = Result<(), DomainError>> + Send;
   ```

**Validation**: `cargo check -p agileplus-domain` zero errors.

---

### T010 - Create SQLite Migration 006_modules_cycles.sql

**Purpose**: Define the schema additions for modules and cycles.

**File**: `crates/agileplus-sqlite/src/migrations/006_modules_cycles.sql` (create new)

**Steps**:

1. Write the migration SQL exactly as specified in `kitty-specs/004-modules-and-cycles/data-model.md`.
   Copy verbatim:

   ```sql
   -- Migration 006: Add modules and cycles domain entities
   -- Traces to: FR-S04, FR-M01, FR-M04, FR-C01, FR-C03

   CREATE TABLE modules (
       id               INTEGER PRIMARY KEY AUTOINCREMENT,
       slug             TEXT NOT NULL,
       friendly_name    TEXT NOT NULL,
       description      TEXT,
       parent_module_id INTEGER REFERENCES modules(id),
       created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
       updated_at       DATETIME NOT NULL DEFAULT (datetime('now')),
       UNIQUE(parent_module_id, slug)
   );

   CREATE TABLE module_feature_tags (
       module_id  INTEGER NOT NULL REFERENCES modules(id),
       feature_id INTEGER NOT NULL REFERENCES features(id),
       created_at DATETIME NOT NULL DEFAULT (datetime('now')),
       PRIMARY KEY (module_id, feature_id)
   );

   ALTER TABLE features ADD COLUMN module_id INTEGER REFERENCES modules(id);

   CREATE TABLE cycles (
       id              INTEGER PRIMARY KEY AUTOINCREMENT,
       name            TEXT NOT NULL UNIQUE,
       description     TEXT,
       state           TEXT NOT NULL DEFAULT 'Draft',
       start_date      DATE NOT NULL,
       end_date        DATE NOT NULL,
       module_scope_id INTEGER REFERENCES modules(id),
       created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
       updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
       CHECK (end_date > start_date)
   );

   CREATE TABLE cycle_features (
       cycle_id   INTEGER NOT NULL REFERENCES cycles(id),
       feature_id INTEGER NOT NULL REFERENCES features(id),
       added_at   DATETIME NOT NULL DEFAULT (datetime('now')),
       PRIMARY KEY (cycle_id, feature_id)
   );

   CREATE INDEX idx_modules_parent    ON modules(parent_module_id);
   CREATE INDEX idx_features_module   ON features(module_id);
   CREATE INDEX idx_cycles_state      ON cycles(state);
   CREATE INDEX idx_cycles_module_scope ON cycles(module_scope_id);
   ```

2. Register the migration in the `MigrationRunner`. Find where other migrations are registered
   (typically in `crates/agileplus-sqlite/src/migrations/mod.rs` or similar). Add the new
   migration at position 006 using the same `include_str!` or file-path pattern as existing ones.

3. Verify the migration applies to an in-memory SQLite database without error.

**Validation**: Create a small Rust test that opens an in-memory `SqliteStorageAdapter::new_in_memory()`,
confirms the `modules` and `cycles` tables exist, and that an existing `features` row has
`module_id = NULL`. Run with `cargo test -p agileplus-sqlite migration`.

---

### T011 - Implement Module CRUD in SQLite Adapter (with Circular Ref Detection)

**Purpose**: Provide the concrete implementation of all module storage methods.

**File**: `crates/agileplus-sqlite/src/repository/modules.rs` (create new)

**Steps**:

1. Implement `create_module`:
   - Before inserting, call the circular-reference helper (defined below).
   - Self-reference check: if `module.parent_module_id == Some(module.id)` and `module.id != 0`,
     return `DomainError::CircularModuleRef`. (id == 0 at creation so this is only relevant on
     update path.)
   - Slug uniqueness within sibling scope: the UNIQUE(parent_module_id, slug) constraint in SQLite
     will catch duplicates -- map the rusqlite `SQLITE_CONSTRAINT_UNIQUE` error to
     `DomainError::Conflict("slug already exists under this parent".into())`.
   - Return the `last_insert_rowid()`.

2. Implement circular-reference detection helper
   `check_no_circular_ref(conn: &Connection, new_parent_id: i64, module_id: i64) -> Result<(), DomainError>`:

   ```sql
   -- Find all ancestors of new_parent_id using recursive CTE
   WITH RECURSIVE ancestors(id) AS (
       SELECT parent_module_id FROM modules WHERE id = ?1
       UNION ALL
       SELECT m.parent_module_id FROM modules m
       INNER JOIN ancestors a ON m.id = a.id
       WHERE m.parent_module_id IS NOT NULL
   )
   SELECT COUNT(*) FROM ancestors WHERE id = ?2
   ```

   If count > 0, the proposed parent is a descendant of `module_id` -- circular. Return
   `DomainError::CircularModuleRef { child: module_id.to_string(), ancestor: new_parent_id.to_string() }`.

3. Implement `delete_module`:
   - Check for children: `SELECT COUNT(*) FROM modules WHERE parent_module_id = ?1`.
   - Check for owned features: `SELECT COUNT(*) FROM features WHERE module_id = ?1`.
   - If either > 0, return `DomainError::ModuleHasDependents(...)`.
   - Then `DELETE FROM modules WHERE id = ?1`.

4. Implement `get_module_with_features` (Traces to FR-M05):
   ```sql
   -- Owned features
   SELECT * FROM features WHERE module_id = ?1

   -- Tagged features (via join table)
   SELECT f.* FROM features f
   JOIN module_feature_tags mft ON mft.feature_id = f.id
   WHERE mft.module_id = ?1

   -- Direct children
   SELECT * FROM modules WHERE parent_module_id = ?1
   ```
   Return `None` if the module doesn't exist.

5. Implement remaining methods (`get_module_by_id`, `get_module_by_slug`, `update_module`,
   `list_root_modules`, `list_child_modules`, `assign_feature_to_module`,
   `unassign_feature_from_module`) following the rusqlite pattern from the features repository.

6. Write unit tests using in-memory DB:
   - `create_and_get_module`
   - `delete_module_with_child_fails`
   - `delete_module_with_owned_feature_fails`
   - `circular_ref_detection`
   - `slug_uniqueness_within_parent_rejected`

**Validation**: `cargo test -p agileplus-sqlite modules` all green.

---

### T012 - Implement Cycle CRUD in SQLite Adapter (with WP Progress Query)

**Purpose**: Provide concrete implementation of all cycle storage methods.

**File**: `crates/agileplus-sqlite/src/repository/cycles.rs` (create new)

**Steps**:

1. Implement `create_cycle`:
   - Map `CycleState` to/from its `Display` string (`"Draft"`, `"Active"`, etc.) for storage.
   - Unique name constraint violation maps to `DomainError::Conflict(...)`.
   - Return `last_insert_rowid()`.

2. Implement `get_cycle_by_id` and `get_cycle_by_name`:
   - Parse `CycleState` from the TEXT column using `FromStr`.
   - Parse `NaiveDate` from the DATE column using `chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")`.
   - Return `Ok(None)` if no row found.

3. Implement `update_cycle_state`: single-column UPDATE touching `updated_at`.

4. Implement `list_cycles`:
   - If `state_filter = None`, `SELECT * FROM cycles ORDER BY start_date`.
   - If `Some(state)`, add `WHERE state = ?1`.

5. Implement `get_cycle_with_features` (Traces to FR-C06):
   - Get cycle row. Return `Ok(None)` if missing.
   - Get assigned features:
     ```sql
     SELECT f.* FROM features f
     JOIN cycle_features cf ON cf.feature_id = f.id
     WHERE cf.cycle_id = ?1
     ORDER BY f.slug
     ```
   - Compute WP progress aggregate:
     ```sql
     SELECT wp.state, COUNT(*) as cnt
     FROM work_packages wp
     JOIN features f ON f.id = wp.feature_id
     JOIN cycle_features cf ON cf.feature_id = f.id
     WHERE cf.cycle_id = ?1
     GROUP BY wp.state
     ```
     Map results into `WpProgressSummary` (total = sum of all counts; bucket by WpState string).
   - Construct `CycleWithFeatures` and return.

6. Implement `delete_cycle`: `DELETE FROM cycle_features WHERE cycle_id = ?1` then
   `DELETE FROM cycles WHERE id = ?1`. Do NOT cascade to Feature states per spec edge case.

7. Write unit tests:
   - `create_and_get_cycle`
   - `list_cycles_filtered_by_state`
   - `get_cycle_with_features_returns_progress`
   - `delete_cycle_unlinks_features`

**Validation**: `cargo test -p agileplus-sqlite cycles` all green.

---

### T013 - Implement Join Table Operations and Module-Scope Validation

**Purpose**: Implement tagging and cycle-assignment operations with scope enforcement.

**File**: `crates/agileplus-sqlite/src/repository/cycles.rs` and `modules.rs`

**Steps**:

1. In `modules.rs`, implement `tag_feature_to_module` and `untag_feature_from_module`:
   ```sql
   -- tag
   INSERT OR IGNORE INTO module_feature_tags (module_id, feature_id, created_at)
   VALUES (?1, ?2, datetime('now'))

   -- untag
   DELETE FROM module_feature_tags WHERE module_id = ?1 AND feature_id = ?2
   ```

2. In `cycles.rs`, implement `add_feature_to_cycle` (Traces to FR-C04, FR-C05):
   - Fetch the cycle to get `module_scope_id`.
   - If `module_scope_id` is `Some(scope_id)`:
     - Check if `feature.module_id == Some(scope_id)` (owned) OR a tag exists:
       ```sql
       SELECT COUNT(*) FROM module_feature_tags
       WHERE module_id = ?1 AND feature_id = ?2
       ```
     - If neither, return `DomainError::FeatureNotInModuleScope { feature_slug, module_slug }`.
   - Insert into `cycle_features`:
     ```sql
     INSERT OR IGNORE INTO cycle_features (cycle_id, feature_id, added_at)
     VALUES (?1, ?2, datetime('now'))
     ```

3. Implement `remove_feature_from_cycle`:
   ```sql
   DELETE FROM cycle_features WHERE cycle_id = ?1 AND feature_id = ?2
   ```

4. Write unit tests:
   - `add_feature_to_unscoped_cycle_succeeds`
   - `add_feature_to_scoped_cycle_owned_succeeds`
   - `add_feature_to_scoped_cycle_tagged_succeeds`
   - `add_feature_to_scoped_cycle_out_of_scope_fails`
   - `tag_and_untag_module_feature`

5. Wire all new repository modules into `SqliteStorageAdapter` in `lib.rs`: add delegating
   `impl StoragePort for SqliteStorageAdapter` method bodies that lock the mutex, call the
   corresponding repository function, and return the result. Follow the exact async wrapper
   pattern used for existing methods (check `features.rs` for the canonical `async move` block).

**Validation**: `cargo test -p agileplus-sqlite` all green; `cargo check` workspace-wide zero errors.
