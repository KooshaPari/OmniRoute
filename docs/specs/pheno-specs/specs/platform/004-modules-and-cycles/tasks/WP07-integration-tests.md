---
work_package_id: WP07
title: Integration Tests
lane: planned
dependencies: []
subtasks: [T034, T035, T036, T037, T038]
phase: Phase 6 - Quality
estimated_lines: 350
frs: [SC-001, SC-002, FR-M01, FR-M02, FR-M06, FR-C02, FR-C04, FR-C05, FR-C07]
priority: P1
---

# WP07: Integration Tests

## Implementation Command

```bash
spec-kitty implement WP07 --base WP03 WP04
```

WP03 and WP04 must both be merged before starting. WP07 is the final MVP quality gate.

## Objectives

Write end-to-end integration tests that exercise the full stack from CLI argument parsing through
storage and back. Tests use an in-memory SQLite database (no file system required) and verify
acceptance scenarios from the spec. Cover: module hierarchy lifecycle, cycle lifecycle with gate
enforcement, module-scoped cycles, backward compatibility for Features without a Module, and all
documented edge cases.

### Success Criteria

- `cargo test -p agileplus-integration` (or the designated integration test location) runs green
  with no skipped tests.
- Module hierarchy test: create parent + child, assign features, list tree, verify counts,
  attempt delete of parent (fails), delete child (succeeds).
- Cycle lifecycle test: create cycle, add features, transition Draft->Active->Review, attempt
  Shipped (blocked), validate all features, transition Review->Shipped (succeeds).
- Scoped cycle test: create module-scoped cycle, attempt to add out-of-scope feature (rejected),
  add in-scope feature (accepted).
- Backward compat test: existing features with `module_id = NULL` pass all existing operations.
- Edge case tests: circular module ref rejected, overlapping cycles allowed, empty cycle
  is valid, delete with children rejected, delete with owned features rejected.
- All tests run in under 2 seconds total (in-memory SQLite is fast).

## Context & Constraints

- **Test location**: Check where existing integration tests live. Likely
  `crates/agileplus-sqlite/tests/` or a dedicated `crates/agileplus-integration/` crate.
  Use whichever pattern is established. If none exists, add a `tests/` directory alongside
  `crates/agileplus-sqlite/` with a `Cargo.toml` that depends on `agileplus-domain`,
  `agileplus-sqlite`, and `agileplus-cli`.
- **In-memory DB**: `SqliteStorageAdapter::new_in_memory()` (verify this method exists; it
  should from the existing test infrastructure).
- **No file system**: Tests must not write to disk. No `tempdir` unless the CLI invocation path
  requires it (the CLI uses file paths for the DB). For pure storage-layer tests, use in-memory.
  For CLI end-to-end tests that need a file, use `tempfile::tempdir()` from the `tempfile` crate.
- **No external services**: Zero network calls in any integration test.
- **Async tests**: Use `#[tokio::test]` since storage operations are async.
- **Determinism**: Tests must not share state. Each test function creates its own storage adapter.
- **FR traceability**: Every test function MUST include a comment `// Traces to: <FR>` or a
  `#[doc = "Traces to: FR-XXX-NNN"]` attribute referencing the spec requirement it validates.
- **Descriptive names**: Test names should describe the scenario, not the implementation.
  Example: `module_hierarchy_create_and_tree_list` not `test_create_module`.

---

## Subtask Guidance

### T034 - Test Module Hierarchy CRUD Lifecycle

**Purpose**: Verify the full module creation, child nesting, feature assignment, tree listing,
and deletion-guard lifecycle. Covers FR-M01, FR-M02, FR-M03, FR-M06, FR-M07. Corresponds to
spec User Story 1 acceptance scenarios 1-5.

**File**: `tests/integration/module_hierarchy.rs` (create new; adjust path to match project structure)

**Steps**:

1. Write `#[tokio::test] async fn module_create_root_succeeds()`:
   - Open in-memory storage, run migrations.
   - Create `Module::new("Authentication", None)`.
   - Call `storage.create_module(&module).await`.
   - Assert `id > 0`.
   - Fetch back by slug: `storage.get_module_by_slug("authentication", None).await`.
   - Assert `Some(m)` where `m.slug == "authentication"`.
   - Traces to: FR-M01, spec acceptance scenario 1.

2. Write `#[tokio::test] async fn module_create_child_succeeds()`:
   - Create parent `"Authentication"`, get its id.
   - Create child `Module::new("OAuth Providers", Some(parent_id))`.
   - Assert child's `parent_module_id == Some(parent_id)`.
   - Call `storage.list_child_modules(parent_id).await`.
   - Assert result contains child.
   - Traces to: FR-M02, spec acceptance scenario 2.

3. Write `#[tokio::test] async fn module_assign_feature_sets_module_id()`:
   - Create a module and a feature (using `Feature::new(...)`).
   - Store both.
   - Call `storage.assign_feature_to_module(feature_id, module_id).await`.
   - Fetch feature by id: `storage.get_feature_by_id(feature_id).await`.
   - Assert `feature.module_id == Some(module_id)`.
   - Traces to: FR-M03, spec acceptance scenario 3.

4. Write `#[tokio::test] async fn module_tag_feature_creates_tag_record()`:
   - Create module and feature.
   - Call `storage.tag_feature_to_module(module_id, feature_id).await`.
   - Fetch `get_module_with_features(module_id)`.
   - Assert `tagged_features` contains the feature.
   - Assert `owned_features` does NOT contain it (module_id not set).
   - Traces to: FR-M04, spec acceptance scenario 4.

5. Write `#[tokio::test] async fn module_list_tree_shows_hierarchy()`:
   - Create root module `"Authentication"`, child `"OAuth Providers"`.
   - Assign 3 features to `"Authentication"`.
   - Fetch `get_module_with_features(auth_id)`.
   - Assert `owned_features.len() == 3`.
   - Assert `child_modules.len() == 1`.
   - Assert `child_modules[0].slug == "oauth-providers"`.
   - Traces to: FR-M05, spec acceptance scenario 5 (tree counts).

6. Write `#[tokio::test] async fn module_delete_with_children_fails()`:
   - Create parent with child.
   - Call `storage.delete_module(parent_id).await`.
   - Assert `Err(DomainError::ModuleHasDependents(_))`.
   - Traces to: FR-M06.

7. Write `#[tokio::test] async fn module_delete_with_owned_features_fails()`:
   - Create module. Assign a feature to it.
   - Call `storage.delete_module(module_id).await`.
   - Assert `Err(DomainError::ModuleHasDependents(_))`.
   - Traces to: FR-M06.

8. Write `#[tokio::test] async fn module_delete_empty_module_succeeds()`:
   - Create module with no features and no children.
   - Call `storage.delete_module(module_id).await`.
   - Assert `Ok(())`.
   - Verify `get_module_by_id(module_id)` returns `Ok(None)`.

9. Write `#[tokio::test] async fn module_slug_unique_within_parent()`:
   - Create parent. Create child `"OAuth"`.
   - Try to create second child with slug `"oauth"` under same parent.
   - Assert `Err(DomainError::Conflict(_))`.
   - Traces to: FR-M07.

**Validation**: All 9 tests pass; `cargo test module_hierarchy` green.

---

### T035 - Test Cycle Lifecycle with Gate Enforcement

**Purpose**: Verify the full cycle state machine and the Shipped gate. Covers FR-C01, FR-C02,
FR-C07. Corresponds to spec User Story 2 acceptance scenarios 1-4.

**File**: `tests/integration/cycle_lifecycle.rs`

**Steps**:

1. Write `#[tokio::test] async fn cycle_create_defaults_to_draft()`:
   - Create `Cycle::new("Sprint W10", date(2026, 3, 3), date(2026, 3, 14), None)`.
   - Store it; assert `state == CycleState::Draft`.
   - Traces to: FR-C01, spec acceptance scenario 1.

2. Write `#[tokio::test] async fn cycle_transition_draft_to_active()`:
   - Create and store a Draft cycle.
   - Call `storage.update_cycle_state(cycle_id, CycleState::Active).await`.
   - Fetch and assert `state == CycleState::Active`.
   - Traces to: FR-C02, spec acceptance scenario 2.

3. Write `#[tokio::test] async fn cycle_shipped_gate_blocks_non_validated_features()`:
   - Create cycle in Active state.
   - Create a feature in `Implementing` state. Add to cycle.
   - Fetch `CycleWithFeatures`. Assert `!cwf.is_shippable()`.
   - Attempt domain-level transition: `CycleState::Review.transition(CycleState::Shipped)` --
     this is allowed at the domain level (the gate is enforced at the service/CLI level).
   - Verify at the service/CLI level (call the transition CLI function with a mock storage):
     the gate check returns the blocking feature name.
   - Traces to: FR-C07, spec acceptance scenario 3.

4. Write `#[tokio::test] async fn cycle_shipped_gate_allows_all_validated()`:
   - Create cycle.
   - Create 3 features all in `Validated` state. Add all to cycle.
   - Fetch `CycleWithFeatures`. Assert `cwf.is_shippable() == true`.
   - Call `storage.update_cycle_state(cycle_id, CycleState::Shipped).await`.
   - Assert `Ok(())`.
   - Traces to: FR-C07, spec acceptance scenario 4.

5. Write `#[tokio::test] async fn cycle_shipped_gate_allows_all_shipped_features()`:
   - Same as above but features in `Shipped` state.
   - Assert `is_shippable() == true`.

6. Write `#[tokio::test] async fn cycle_show_returns_wp_progress()`:
   - Create cycle. Create feature. Create 3 WPs: 1 Done, 1 InProgress, 1 Planned.
   - Add feature to cycle.
   - Fetch `get_cycle_with_features(cycle_id)`.
   - Assert `wp_progress.total == 3`, `wp_progress.done == 1`, `wp_progress.in_progress == 1`,
     `wp_progress.planned == 1`.
   - Traces to: FR-C06, spec acceptance scenario 5.

**Validation**: All 6 tests pass; `cargo test cycle_lifecycle` green.

---

### T036 - Test Module-Scoped Cycles

**Purpose**: Verify scope validation for cycles that restrict Feature assignment to a specific
Module. Covers FR-C04, FR-C05. Corresponds to spec User Story 3 acceptance scenarios 1-4.

**File**: `tests/integration/scoped_cycles.rs`

**Steps**:

1. Write `#[tokio::test] async fn scoped_cycle_created_with_module_scope()`:
   - Create module `"Notifications"`.
   - Create `Cycle::new("Notif Refactor", ..., Some(notif_module_id))`.
   - Assert `cycle.module_scope_id == Some(notif_module_id)`.
   - Traces to: FR-C04, spec acceptance scenario 1.

2. Write `#[tokio::test] async fn scoped_cycle_rejects_out_of_scope_feature()`:
   - Create `"Notifications"` module and `"Authentication"` module.
   - Create feature `"login"` owned by `"Authentication"`.
   - Create cycle scoped to `"Notifications"`.
   - Call `storage.add_feature_to_cycle(cycle_id, login_id).await`.
   - Assert `Err(DomainError::FeatureNotInModuleScope { .. })`.
   - Traces to: FR-C04, spec acceptance scenario 2.

3. Write `#[tokio::test] async fn scoped_cycle_accepts_owned_feature()`:
   - Create `"Notifications"` module. Create feature `"alert-settings"` owned by `"Notifications"`.
   - Create cycle scoped to `"Notifications"`.
   - Call `storage.add_feature_to_cycle(cycle_id, alert_settings_id).await`.
   - Assert `Ok(())`.
   - Fetch `get_cycle_with_features`. Assert features list contains `"alert-settings"`.
   - Traces to: FR-C05, spec acceptance scenario 3.

4. Write `#[tokio::test] async fn scoped_cycle_accepts_tagged_feature()`:
   - Create `"Notifications"` module. Create feature `"unified-search"` owned by `"Content"`.
   - Tag `"unified-search"` to `"Notifications"`: `storage.tag_feature_to_module(notif_id, search_id)`.
   - Create cycle scoped to `"Notifications"`.
   - Call `storage.add_feature_to_cycle(cycle_id, search_id).await`.
   - Assert `Ok(())`.
   - Traces to: FR-C04 (tagged = "in scope").

5. Write `#[tokio::test] async fn unscoped_cycle_accepts_any_feature()`:
   - Create two modules. Create two features, one per module.
   - Create cycle with `module_scope_id = None`.
   - Add both features. Assert both `Ok(())`.
   - Traces to: FR-C05, spec acceptance scenario 4.

**Validation**: All 5 tests pass; `cargo test scoped_cycles` green.

---

### T037 - Test Backward Compatibility (Features Without module_id)

**Purpose**: Verify that features created before the Modules domain model (with `module_id = NULL`)
continue to work in all existing operations. Covers the spec edge case and FR-M03 nullable design.

**File**: `tests/integration/backward_compat.rs`

**Steps**:

1. Write `#[tokio::test] async fn feature_without_module_id_can_be_created()`:
   - Create a feature using `Feature::new("legacy-feat", "Legacy Feature", [0u8; 32], None)`.
   - Assert `feature.module_id == None`.
   - Store it; fetch back. Assert `module_id == None`.
   - Traces to: FR-M03 (module_id nullable for backward compat).

2. Write `#[tokio::test] async fn feature_without_module_id_lists_normally()`:
   - Create features with and without module_id.
   - Call `storage.list_all_features().await`.
   - Assert all features are returned (no filter by module_id).

3. Write `#[tokio::test] async fn feature_without_module_id_can_be_added_to_unscoped_cycle()`:
   - Create feature with `module_id = None`.
   - Create unscoped cycle (`module_scope_id = None`).
   - Add feature to cycle. Assert `Ok(())`.

4. Write `#[tokio::test] async fn feature_without_module_id_rejected_by_scoped_cycle()`:
   - Create `"Notifications"` module.
   - Create feature with `module_id = None` (no module ownership).
   - Create cycle scoped to `"Notifications"`.
   - Add feature to cycle. Assert `Err(DomainError::FeatureNotInModuleScope { .. })`.
   - Note: this is correct behavior -- an unassigned feature is not in any module scope.

5. Write `#[tokio::test] async fn existing_feature_transitions_work_without_module_id()`:
   - Create feature with `module_id = None`.
   - Transition through states: Created -> Specified -> Planned -> Validated.
   - Assert all transitions succeed; module_id remains None throughout.

6. Write `#[tokio::test] async fn migration_applies_to_existing_feature_rows()`:
   - This tests the SQL migration itself. Open an in-memory DB, insert a feature row WITHOUT
     the `module_id` column (i.e., via raw SQL before migration), then run migrations, then
     fetch the feature -- assert `module_id IS NULL`.
   - This requires inserting before `ALTER TABLE features ADD COLUMN module_id`. Structure this
     by running migrations up to migration 005 (if granular control exists), inserting, then
     running migration 006. Check the migration runner API for selective run capability.
   - If granular migration control isn't available, skip this test and note it as a
     documentation-only invariant.

**Validation**: All 5-6 tests pass; `cargo test backward_compat` green.

---

### T038 - Test Edge Cases

**Purpose**: Cover all edge cases documented in the spec that have defined behavior.

**File**: `tests/integration/edge_cases.rs`

**Steps**:

1. Write `#[tokio::test] async fn circular_module_ref_is_rejected()`:
   - Create module `A` (root). Create module `B` as child of `A`.
   - Attempt to set `B`'s parent to `B` itself:
     - `storage.update_module(Module { id: b_id, parent_module_id: Some(b_id), .. }).await`.
     - Assert `Err(DomainError::CircularModuleRef { .. })`.
   - Attempt to set `A`'s parent to `B` (making `A` a child of its own descendant):
     - `storage.update_module(Module { id: a_id, parent_module_id: Some(b_id), .. }).await`.
     - Assert `Err(DomainError::CircularModuleRef { .. })`.
   - Traces to: FR-M02, spec edge case "Circular Module hierarchy".

2. Write `#[tokio::test] async fn features_can_be_in_multiple_cycles()`:
   - Create feature `"login"`.
   - Create two unscoped cycles `"Sprint W10"` and `"Release Q1"`.
   - Add `"login"` to both cycles. Assert both `Ok(())`.
   - Fetch `get_cycle_with_features` for both cycles. Assert `"login"` appears in both.
   - Traces to: spec edge case "Overlapping Cycles".

3. Write `#[tokio::test] async fn empty_cycle_in_draft_is_valid()`:
   - Create a cycle with no features.
   - Assert cycle is created successfully.
   - Fetch `get_cycle_with_features`. Assert `features.is_empty()`.
   - Assert `wp_progress.total == 0`.
   - Traces to: spec edge case "Empty Cycle".

4. Write `#[tokio::test] async fn deleting_cycle_unlinks_features_does_not_change_state()`:
   - Create cycle. Add 3 features in various states.
   - Record each feature's state before deletion.
   - Delete the cycle: `storage.delete_cycle(cycle_id).await`.
   - Fetch each feature by id. Assert their states are unchanged.
   - Traces to: spec edge case "Deleting a Cycle".

5. Write `#[tokio::test] async fn delete_module_with_children_requires_reparenting_first()`:
   - Create parent `P` with child `C`.
   - Assert `storage.delete_module(p_id).await` fails.
   - Delete child `C` first: `storage.delete_module(c_id).await` -- assert `Ok(())`.
   - Then delete parent `P`: `storage.delete_module(p_id).await` -- assert `Ok(())`.
   - Traces to: FR-M06, spec edge case "Deleting a Module with children".

6. Write `#[tokio::test] async fn module_scope_removal_after_feature_added_does_not_cascade()`:
   - Create module `"Notifications"`.
   - Create feature `"alert"` owned by `"Notifications"`.
   - Create cycle scoped to `"Notifications"`. Add `"alert"` to cycle.
   - Unassign `"alert"` from the module: `storage.unassign_feature_from_module(alert_id).await`.
   - Fetch cycle features. Assert `"alert"` is STILL in the cycle (no cascade removal).
   - Traces to: spec edge case "Module-scoped Cycle with subsequently-untagged Feature".

7. Write `#[tokio::test] async fn cycle_date_constraint_rejected()`:
   - Attempt `Cycle::new("Bad", date(2026, 3, 14), date(2026, 3, 3), None)` (end before start).
   - Assert `Err(DomainError::Other(_))`.
   - Attempt `Cycle::new("Bad", date(2026, 3, 3), date(2026, 3, 3), None)` (same date).
   - Assert `Err(DomainError::Other(_))`.

**Validation**: All 7 tests pass; `cargo test edge_cases` green.

---

## Helper Utilities

Add a test helper module `tests/integration/helpers.rs` with:

```rust
/// Open an in-memory SQLite adapter with all migrations applied.
pub async fn test_storage() -> SqliteStorageAdapter {
    SqliteStorageAdapter::new_in_memory().expect("in-memory db failed")
}

/// Construct a NaiveDate from components without error handling boilerplate.
pub fn date(y: i32, m: u32, d: u32) -> chrono::NaiveDate {
    chrono::NaiveDate::from_ymd_opt(y, m, d).expect("invalid test date")
}

/// Store a Feature and return its assigned id.
pub async fn store_feature(storage: &dyn StoragePort, slug: &str) -> i64 {
    let f = agileplus_domain::domain::feature::Feature::new(slug, slug, [0u8; 32], None);
    storage.create_feature(&f).await.expect("store_feature failed")
}

/// Store a Module and return its assigned id.
pub async fn store_module(storage: &dyn StoragePort, name: &str, parent: Option<i64>) -> i64 {
    let m = agileplus_domain::domain::module::Module::new(name, parent);
    storage.create_module(&m).await.expect("store_module failed")
}

/// Store a Cycle and return its assigned id.
pub async fn store_cycle(
    storage: &dyn StoragePort,
    name: &str,
    scope: Option<i64>,
) -> i64 {
    use super::helpers::date;
    let c = agileplus_domain::domain::cycle::Cycle::new(
        name,
        date(2026, 3, 3),
        date(2026, 3, 14),
        scope,
    ).expect("store_cycle new failed");
    storage.create_cycle(&c).await.expect("store_cycle failed")
}
```

These helpers eliminate boilerplate from every test and make test bodies scannable at a glance.
