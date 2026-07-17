---
work_package_id: WP01
title: Domain Entities - Module & Cycle
lane: "doing"
dependencies: []
base_branch: main
base_commit: 3d3f72886c95592ae83f525d4416118882ab189f
created_at: '2026-03-04T01:51:18.239715+00:00'
subtasks: [T001, T002, T003, T004, T005, T006]
phase: Phase 1 - Domain
estimated_lines: 350
frs: [FR-M01, FR-M02, FR-M03, FR-M04, FR-M07, FR-C01, FR-C02, FR-C03, FR-C04, FR-C05, FR-C07]
priority: P1
shell_pid: "88923"
agent: "claude-wp01"
---

# WP01: Domain Entities - Module & Cycle

## Implementation Command

```bash
spec-kitty implement WP01
```

No base WP dependency -- this is the foundation layer.

## Objectives

Introduce `Module`, `ModuleFeatureTag`, `CycleState`, `Cycle`, and `CycleFeature` into
`crates/agileplus-domain`. Extend the existing `Feature` struct with an optional `module_id`
field. Add error variants to `DomainError` that support Module and Cycle operation failures.

### Success Criteria

- `cargo check -p agileplus-domain` passes with zero errors and zero warnings.
- `cargo test -p agileplus-domain` passes with all new unit tests green.
- `module.rs` and `cycle.rs` modules are exported from `crates/agileplus-domain/src/domain/mod.rs`.
- `Feature` struct compiles with the new `module_id: Option<i64>` field without breaking
  existing call sites (field has a serde default so JSON without `module_id` still deserialises).
- `CycleState::transition` returns `Err` for every disallowed edge in the state graph.
- Circular-reference detection logic in `Module` is unit-tested (the DB-level check comes in WP02;
  domain-level only validates self-reference at construction time).

## Context & Constraints

- **Crate**: `crates/agileplus-domain` -- zero external dependencies except `serde`, `chrono`,
  and `sha2` (already in `Cargo.toml`). Do NOT add new dependencies to this crate.
- **Pattern**: Mirror `feature.rs` exactly. Use `i64` for IDs (raw, not newtype -- follow existing
  code, not the constitution newtype ideal). Use `DateTime<Utc>` for timestamps, `NaiveDate` for
  calendar dates (from `chrono`).
- **Slug utility**: Reuse `Feature::slug_from_name` pattern (copy the same char-mapping function
  into `Module::slug_from_name` -- do not import across modules).
- **No `unwrap()`**: Every fallible path returns `Result<_, DomainError>`.
- **`thiserror`**: All error variants use `thiserror` derive already present in the crate.
- **Serde defaults**: Fields that are nullable (`Option<_>`) must carry
  `#[serde(default, skip_serializing_if = "Option::is_none")]` to maintain backward compat.
- **File locations** (all relative to `crates/agileplus-domain/src/`):
  - NEW: `domain/module.rs`
  - NEW: `domain/cycle.rs`
  - MODIFIED: `domain/mod.rs` -- add `pub mod module; pub mod cycle;`
  - MODIFIED: `domain/feature.rs` -- add `module_id` field
  - MODIFIED: `error.rs` -- add new variants

---

## Subtask Guidance

### T001 - Create Module Struct

**Purpose**: Define the core `Module` entity mirroring the data-model field table.

**File**: `crates/agileplus-domain/src/domain/module.rs` (create new)

**Steps**:

1. Add crate-level doc comment referencing FR-M01, FR-M02, FR-M07.

2. Define the struct:

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct Module {
       pub id: i64,
       pub slug: String,
       pub friendly_name: String,
       #[serde(default, skip_serializing_if = "Option::is_none")]
       pub description: Option<String>,
       #[serde(default, skip_serializing_if = "Option::is_none")]
       pub parent_module_id: Option<i64>,
       pub created_at: DateTime<Utc>,
       pub updated_at: DateTime<Utc>,
   }
   ```

3. Implement a `Module::new(friendly_name: &str, parent_module_id: Option<i64>) -> Self` constructor
   that sets `id = 0`, derives `slug` from the name, and stamps `created_at`/`updated_at` to
   `Utc::now()`.

4. Implement `Module::slug_from_name(name: &str) -> String` using the same logic as
   `Feature::slug_from_name`: map non-alphanumeric chars to `-`, lowercase, deduplicate dashes.

5. Add `Module::update_name(&mut self, new_name: &str)` that sets `friendly_name`, re-derives
   `slug`, and touches `updated_at`.

6. Write unit tests:
   - `new_module_defaults`: `id == 0`, slug is kebab-cased from name, `parent_module_id == None`
     when not given.
   - `slug_derivation`: `"OAuth Providers"` -> `"oauth-providers"`.
   - `update_name_re_slugs`: after `update_name`, slug reflects new name.

**Validation**: `cargo test -p agileplus-domain module::tests` all green.

---

### T002 - Create ModuleFeatureTag Struct

**Purpose**: Represent the many-to-many tagging join between Modules and Features.

**File**: `crates/agileplus-domain/src/domain/module.rs` (append to same file as T001)

**Steps**:

1. Define the struct (Traces to FR-M04):

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct ModuleFeatureTag {
       pub module_id: i64,
       pub feature_id: i64,
       pub created_at: DateTime<Utc>,
   }
   ```

2. Add constructor `ModuleFeatureTag::new(module_id: i64, feature_id: i64) -> Self` stamping
   `created_at = Utc::now()`.

3. Define a `ModuleWithFeatures` view struct to carry query results from WP02:

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct ModuleWithFeatures {
       pub module: Module,
       /// Features where Feature.module_id == this module's id
       pub owned_features: Vec<crate::domain::feature::Feature>,
       /// Features linked via module_feature_tags
       pub tagged_features: Vec<crate::domain::feature::Feature>,
       /// Direct child modules (non-recursive)
       pub child_modules: Vec<Module>,
   }
   ```

4. Write unit test `tag_new_stamps_created_at`: verify `created_at` is close to `Utc::now()`.

**Validation**: `cargo check -p agileplus-domain` zero errors.

---

### T003 - Create CycleState Enum with Transition Validation

**Purpose**: Define the Cycle lifecycle state machine mirroring `FeatureState`'s ordinal pattern
but with the specific allowed/disallowed edges from the data model.

**File**: `crates/agileplus-domain/src/domain/cycle.rs` (create new)

**Steps**:

1. Add crate-level doc comment referencing FR-C01, FR-C02.

2. Define the enum (Traces to FR-C02):

   ```rust
   #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
   #[serde(rename_all = "PascalCase")]
   pub enum CycleState {
       Draft,
       Active,
       Review,
       Shipped,
       Archived,
   }
   ```

3. Implement `fmt::Display` matching the PascalCase names: `"Draft"`, `"Active"`, etc.

4. Implement `FromStr` with `"Draft"`, `"Active"`, `"Review"`, `"Shipped"`, `"Archived"` as
   valid inputs (case-sensitive). Return `DomainError::Other(...)` for unknown strings.

5. Implement `CycleState::transition(self, target: CycleState) -> Result<(), DomainError>`.
   Encode the **explicit edge list** from the data model (NOT a simple ordinal >= check, because
   bidirectional edges exist):

   ```
   Allowed edges:
   Draft   -> Active
   Active  -> Review
   Active  -> Draft      (revert)
   Review  -> Shipped    (gated -- gate enforced in WP02/WP04, not here)
   Review  -> Active     (changes requested)
   Shipped -> Archived
   ```

   All other pairs return `DomainError::InvalidTransition { from, to, reason }`.
   Self-to-self returns `DomainError::NoOpTransition(state.to_string())`.

6. Write unit tests covering ALL edges:
   - `valid_transitions`: Draft->Active, Active->Review, Active->Draft, Review->Shipped,
     Review->Active, Shipped->Archived all return `Ok(())`.
   - `invalid_transitions`: Draft->Review, Draft->Shipped, Draft->Archived, Active->Shipped,
     Active->Archived, Review->Archived, Review->Draft, Shipped->Active, Archived->Draft, etc.
   - `noop_transition`: any state to itself returns `NoOpTransition`.

**Validation**: `cargo test -p agileplus-domain cycle::tests::` state machine tests all green.

---

### T004 - Create Cycle Struct

**Purpose**: Define the `Cycle` entity with all fields from the data model.

**File**: `crates/agileplus-domain/src/domain/cycle.rs` (append to T003 file)

**Steps**:

1. Import `chrono::NaiveDate` -- this is the appropriate type for calendar dates without time
   (already in `chrono` which is a crate dependency).

2. Define the struct (Traces to FR-C01):

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct Cycle {
       pub id: i64,
       pub name: String,
       #[serde(default, skip_serializing_if = "Option::is_none")]
       pub description: Option<String>,
       pub state: CycleState,
       pub start_date: NaiveDate,
       pub end_date: NaiveDate,
       #[serde(default, skip_serializing_if = "Option::is_none")]
       pub module_scope_id: Option<i64>,
       pub created_at: DateTime<Utc>,
       pub updated_at: DateTime<Utc>,
   }
   ```

3. Implement `Cycle::new(name: &str, start_date: NaiveDate, end_date: NaiveDate, module_scope_id: Option<i64>) -> Result<Self, DomainError>`.
   Validate that `end_date > start_date`; return `DomainError::Other("end_date must be after start_date".into())` on failure.
   Default state is `CycleState::Draft`, `id = 0`, `description = None`.

4. Implement `Cycle::transition(&mut self, target: CycleState) -> Result<(), DomainError>`.
   Delegates to `CycleState::transition(self.state, target)`. On success, sets `self.state = target`
   and touches `self.updated_at`. Note: the Shipped gate (all features validated) is enforced by the
   storage/service layer in WP02 and CLI in WP04 -- this method does NOT check it (see constraint note).

5. Write unit tests:
   - `new_cycle_valid_dates`: succeeds, state is Draft.
   - `new_cycle_invalid_dates`: start == end returns Err; start > end returns Err.
   - `cycle_transition_updates_state`: Draft->Active updates `state` field.
   - `cycle_new_with_scope`: `module_scope_id` is preserved.

**Validation**: `cargo test -p agileplus-domain cycle::tests::cycle_` all green.

---

### T005 - Create CycleFeature Struct and Scope Validation

**Purpose**: Represent the many-to-many assignment join table and provide a domain-level scope
validation helper.

**File**: `crates/agileplus-domain/src/domain/cycle.rs` (append to T004 file)

**Steps**:

1. Define the struct (Traces to FR-C03):

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct CycleFeature {
       pub cycle_id: i64,
       pub feature_id: i64,
       pub added_at: DateTime<Utc>,
   }
   ```

2. Add constructor `CycleFeature::new(cycle_id: i64, feature_id: i64) -> Self` stamping `added_at`.

3. Define a `CycleWithFeatures` view struct:

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct CycleWithFeatures {
       pub cycle: Cycle,
       pub features: Vec<crate::domain::feature::Feature>,
       /// Aggregate count of WPs per WpState across all assigned features.
       pub wp_progress: WpProgressSummary,
   }
   ```

4. Define `WpProgressSummary`:

   ```rust
   #[derive(Debug, Clone, Default, Serialize, Deserialize)]
   pub struct WpProgressSummary {
       pub total: u32,
       pub planned: u32,
       pub in_progress: u32,
       pub done: u32,
       pub blocked: u32,
   }
   ```

   Note: `WpState` values map to these buckets. The actual aggregation query is in WP02; this struct
   is the shape for deserialization.

5. Implement `CycleWithFeatures::is_shippable(&self) -> bool` that returns `true` only when ALL
   `features` have `state` of `FeatureState::Validated` or `FeatureState::Shipped` (Traces to FR-C07).
   This is the domain-level gate used by `cycle transition shipped` in WP04.

6. Write unit tests:
   - `empty_cycle_is_shippable_false`: `CycleWithFeatures` with no features returns `false`
     (empty cycle is NOT shippable -- a cycle must have at least one feature, per spec User Story 2).

     Actually re-read spec: "an empty Cycle in Draft with no assigned Features is a planning placeholder"
     (edge cases section). The gate FR-C07 says "all assigned Features" -- vacuously true for zero features.
     Design decision: return `true` if `features.is_empty()` since there are no blocking features.
     Document this in a comment.

   - `all_validated_is_shippable`: all features in Validated -> true.
   - `all_shipped_is_shippable`: all features in Shipped -> true.
   - `mixed_states_not_shippable`: one feature in Implementing -> false.

**Validation**: `cargo test -p agileplus-domain cycle::tests::shippable` green.

---

### T006 - Extend Feature with module_id, Extend DomainError

**Purpose**: Add `module_id` to `Feature` (backward compat) and add new error variants for
Module/Cycle operations.

**Files**:
- MODIFIED: `crates/agileplus-domain/src/domain/feature.rs`
- MODIFIED: `crates/agileplus-domain/src/error.rs`
- MODIFIED: `crates/agileplus-domain/src/domain/mod.rs`

**Steps**:

1. In `feature.rs`, add to the `Feature` struct after the `labels` field:

   ```rust
   /// Module that owns this feature (strict ownership, one per feature).
   /// Null for features that predate module support or are unassigned.
   /// Traces to: FR-M03
   #[serde(default, skip_serializing_if = "Option::is_none")]
   pub module_id: Option<i64>,
   ```

2. In `Feature::new(...)`, initialise `module_id: None`.

3. In `error.rs`, add new variants using `thiserror`:

   ```rust
   #[error("module not found: {0}")]
   ModuleNotFound(String),

   #[error("cycle not found: {0}")]
   CycleNotFound(String),

   #[error("circular module reference: cannot set {child} as parent of {ancestor}")]
   CircularModuleRef { child: String, ancestor: String },

   #[error("module has dependents: {0}")]
   ModuleHasDependents(String),

   #[error("feature not in module scope: feature {feature_slug} is not owned by or tagged to module {module_slug}")]
   FeatureNotInModuleScope { feature_slug: String, module_slug: String },

   #[error("cycle gate not met: {0}")]
   CycleGateNotMet(String),
   ```

4. In `domain/mod.rs`, add:

   ```rust
   pub mod cycle;
   pub mod module;
   ```

   Export key types at crate root in `lib.rs` if the crate follows a re-export pattern (check
   existing `lib.rs` -- if there is a `pub use domain::feature::Feature;` style, add corresponding
   uses for `Module`, `Cycle`, `CycleState`, etc.).

5. Verify existing `Feature` tests still pass (no behavior change, only new optional field with
   default).

6. Add unit test `feature_module_id_defaults_to_none`:

   ```rust
   let f = Feature::new("f", "F", [0u8; 32], None);
   assert_eq!(f.module_id, None);
   ```

7. Add serde roundtrip test `feature_without_module_id_deserialises`: construct minimal JSON
   without `module_id` key and verify it deserialises successfully with `module_id = None`.

**Validation**:
- `cargo test -p agileplus-domain` -- ALL tests green (existing + new).
- `cargo clippy -p agileplus-domain -- -D warnings` zero warnings.

## Activity Log

- 2026-03-04T01:51:18Z – claude-wp01 – shell_pid=88923 – lane=doing – Assigned agent via workflow command
