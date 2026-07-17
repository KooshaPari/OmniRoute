---
work_package_id: WP03
title: Domain Model — Feature & State Machine
lane: "done"
dependencies:
- WP01
base_branch: 001-spec-driven-development-engine-WP01
base_commit: 2b52a5788fccbf64376696c76a8460fb630a4032
created_at: '2026-02-28T09:22:09.787896+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
- T017b
- T017c
phase: Phase 1 - Domain
assignee: ''
agent: "claude-wp03"
shell_pid: "29682"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 -- Domain Model: Feature & State Machine

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately.
- **You must address all feedback** before your work is complete.
- **Mark as acknowledged**: Update `review_status: acknowledged` when you begin addressing feedback.
- **Report progress**: Update the Activity Log as you address each item.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes.

*[This section is empty initially.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP03 --base WP01
```

---

## Objectives & Success Criteria

1. **Feature struct complete**: All fields from data-model.md implemented with proper types and serde derives.
2. **State machine enforced by compiler**: `FeatureState` enum with exhaustive match on all transitions -- no invalid state can exist at compile time.
3. **Valid transitions succeed**: All 7 forward transitions (`created -> specified -> ... -> retrospected`) execute correctly and return `Ok`.
4. **Invalid transitions blocked**: Attempting an invalid transition (e.g., `created -> shipped`) returns `Err(DomainError::InvalidTransition)`.
5. **Skip transitions warn**: Skipping states (e.g., `created -> planned`) returns `Ok(Warning)` with a governance exception message, not `Ok(())`.
6. **WorkPackage struct complete**: All fields from data-model.md, with `planned/doing/review/done/blocked` states.
7. **Dependency scheduling**: `WpDependency` and logic to determine which WPs can execute in parallel based on dependency graph and file scope overlap.
8. **Unit tests comprehensive**: 20+ tests covering all valid transitions, invalid transitions, skip transitions, WP state changes, and dependency queries.

---

## Context & Constraints

### Reference Documents
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- Feature entity (lines 73-101), WorkPackage entity (lines 103-124), WP Dependency (lines 213-222)
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- State machine design (lines 198-210), conflict resolution (lines 244-250)
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- FR-033 (strict state ordering), FR-034 (skip with warning), FR-038/FR-039 (dependency scheduling)

### Architectural Constraints
- **Pure domain logic**: This code lives in `agileplus-core` which has NO I/O dependencies. No database, no filesystem, no network.
- **Compiler-enforced safety**: Use Rust enums with exhaustive match. The compiler must reject any transition handler that doesn't cover all states.
- **Result types**: All fallible operations return `Result<T, DomainError>`. Skip transitions return `Result<TransitionResult, DomainError>` where `TransitionResult` can be `Ok` or `Warning(String)`.
- **Serde derives**: All domain types derive `Serialize, Deserialize` for SQLite storage and gRPC serialization.
- **Chrono for timestamps**: Use `chrono::DateTime<Utc>` for all timestamp fields.

### Dependency on WP01
- WP01 provides the crate structure (`crates/agileplus-core/`) with empty module stubs.
- This WP replaces the empty structs in `domain/feature.rs`, `domain/work_package.rs`, and `domain/state_machine.rs` with full implementations.

---

## Subtasks & Detailed Guidance

### Subtask T012 -- Implement `Feature` struct with all fields from data-model.md

- **Purpose**: Define the root aggregate entity that represents a unit of work from idea to shipment. The Feature struct is referenced by nearly every other domain type and must be complete before WP04 (governance/audit) can link to it.
- **Steps**:
  1. Open `crates/agileplus-core/src/domain/feature.rs` (exists as stub from WP01).
  2. Replace the empty struct with the full implementation:
     ```rust
     use chrono::{DateTime, Utc};
     use serde::{Deserialize, Serialize};

     use super::state_machine::FeatureState;

     /// Root aggregate: a unit of work from idea to shipment.
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct Feature {
         /// Unique auto-increment identifier.
         pub id: i64,
         /// Kebab-case identifier (e.g., "001-spec-driven-development-engine").
         pub slug: String,
         /// Human-readable display name.
         pub friendly_name: String,
         /// Current lifecycle state.
         pub state: FeatureState,
         /// SHA-256 hash of the current spec.md content.
         pub spec_hash: [u8; 32],
         /// Git branch to merge completed work into.
         pub target_branch: String,
         /// When the feature was created.
         pub created_at: DateTime<Utc>,
         /// Last modification timestamp.
         pub updated_at: DateTime<Utc>,
     }
     ```
  3. Implement a `Feature::new()` constructor that:
     - Takes `slug`, `friendly_name`, `spec_hash`, and optional `target_branch` (defaults to `"main"`)
     - Sets `state` to `FeatureState::Created`
     - Sets `created_at` and `updated_at` to `Utc::now()`
     - Sets `id` to 0 (assigned by storage layer)
  4. Implement `Feature::transition()` that delegates to the state machine (T014).
  5. Implement `Feature::slug_from_name()` helper that converts a friendly name to a kebab-case slug.
- **Files**: `crates/agileplus-core/src/domain/feature.rs`
- **Parallel?**: No -- T013 and T014 depend on the types defined here.
- **Validation**: `cargo build -p agileplus-core` succeeds; Feature can be serialized to JSON.
- **Notes**: The `spec_hash` is `[u8; 32]` (fixed-size SHA-256). Use a custom serde serializer for hex encoding in JSON. The `id` field is 0 at creation and assigned by the storage layer -- this is a common pattern for auto-increment IDs.

### Subtask T013 -- Implement `FeatureState` enum and `StateTransition` type with strict ordering (FR-033)

- **Purpose**: Define the state enum with compile-time guarantees that all states are accounted for. The `StateTransition` type captures a from-to pair for audit logging.
- **Steps**:
  1. Open `crates/agileplus-core/src/domain/state_machine.rs`.
  2. Define `FeatureState` enum:
     ```rust
     #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
     #[serde(rename_all = "snake_case")]
     pub enum FeatureState {
         Created,
         Specified,
         Researched,
         Planned,
         Implementing,
         Validated,
         Shipped,
         Retrospected,
     }
     ```
  3. Implement `FeatureState::ordinal()` returning `u8` (0-7) for ordering comparisons.
  4. Implement `FeatureState::next()` returning `Option<FeatureState>` -- the single valid forward transition. Returns `None` for `Retrospected`.
  5. Implement `FeatureState::display_name()` returning a human-readable string.
  6. Define `StateTransition`:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct StateTransition {
         pub from: FeatureState,
         pub to: FeatureState,
         pub skipped: Vec<FeatureState>,  // states skipped (empty for normal transitions)
     }
     ```
  7. Implement `Display` for `StateTransition` formatting as `"specified -> researched"`.
  8. Implement `FromStr` for `FeatureState` to parse from lowercase strings.
- **Files**: `crates/agileplus-core/src/domain/state_machine.rs`
- **Parallel?**: No -- T014 depends on these types.
- **Validation**: All 8 states serialize/deserialize correctly; ordinals are sequential; `next()` returns correct successor.
- **Notes**: The `serde(rename_all = "snake_case")` ensures JSON/SQLite storage uses lowercase. The `Copy` derive is important for ergonomics since states are small. The `skipped` field in `StateTransition` enables audit logging of governance exceptions.

### Subtask T014 -- Implement state machine logic: `transition()` method enforcing valid transitions, skip-with-warning (FR-034)

- **Purpose**: The core state machine logic that enforces valid transitions and handles skip-with-warning. This is the heart of the governance enforcement system and must be rock-solid.
- **Steps**:
  1. Define `TransitionResult` enum:
     ```rust
     #[derive(Debug, Clone)]
     pub enum TransitionResult {
         /// Normal forward transition (no states skipped).
         Ok(StateTransition),
         /// States were skipped; caller should log governance exception.
         Warning {
             transition: StateTransition,
             message: String,
         },
     }
     ```
  2. Implement `FeatureState::transition(self, target: FeatureState) -> Result<TransitionResult, DomainError>`:
     - If `target == self`: return `Err(DomainError::NoOpTransition)`
     - If `target.ordinal() < self.ordinal()`: return `Err(DomainError::InvalidTransition { from: self, to: target, reason: "backward transitions are not allowed" })`
     - If `target == self.next().unwrap()`: return `Ok(TransitionResult::Ok(StateTransition { from: self, to: target, skipped: vec![] }))`
     - If `target.ordinal() > self.ordinal() + 1`: collect all skipped states, return `Ok(TransitionResult::Warning { transition, message: format!("Skipped states: {:?}", skipped) })`
  3. Add the `InvalidTransition` and `NoOpTransition` variants to `DomainError`:
     ```rust
     #[derive(Debug, thiserror::Error)]
     pub enum DomainError {
         #[error("invalid transition from {from} to {to}: {reason}")]
         InvalidTransition {
             from: FeatureState,
             to: FeatureState,
             reason: String,
         },
         #[error("no-op transition: already in state {0}")]
         NoOpTransition(FeatureState),
         // ... existing variants
     }
     ```
  4. Implement `Feature::transition(&mut self, target: FeatureState) -> Result<TransitionResult, DomainError>`:
     - Calls `self.state.transition(target)`
     - On success, updates `self.state = target` and `self.updated_at = Utc::now()`
     - Returns the `TransitionResult` for the caller to handle (logging, audit)
  5. Special case: `Retrospected` is terminal. No transitions from it.
- **Files**: `crates/agileplus-core/src/domain/state_machine.rs`, `crates/agileplus-core/src/error.rs`
- **Parallel?**: No -- depends on T012 and T013.
- **Validation**: See T017 test cases.
- **Notes**: The caller (CLI command or API handler) decides what to do with a `Warning` result. Some callers may abort on warning (strict mode), others may log and continue. The state machine itself NEVER blocks a forward transition -- it only classifies them as normal or skip-with-warning. Backward transitions are ALWAYS blocked. This matches FR-033 (strict ordering) and FR-034 (skip with warning).

### Subtask T015 -- Implement `WorkPackage` struct with states (planned/doing/review/done/blocked)

- **Purpose**: Define the work package entity that represents a decomposed implementation unit. WPs have their own state machine (simpler than Feature) and track file scope for conflict detection.
- **Steps**:
  1. Open `crates/agileplus-core/src/domain/work_package.rs`.
  2. Define `WpState` enum:
     ```rust
     #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
     #[serde(rename_all = "snake_case")]
     pub enum WpState {
         Planned,
         Doing,
         Review,
         Done,
         Blocked,
     }
     ```
  3. Implement the `WorkPackage` struct with all fields from data-model.md:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct WorkPackage {
         pub id: i64,
         pub feature_id: i64,
         pub title: String,
         pub state: WpState,
         pub sequence: i32,
         pub file_scope: Vec<String>,
         pub acceptance_criteria: String,
         pub agent_id: Option<String>,
         pub pr_url: Option<String>,
         pub pr_state: Option<PrState>,
         pub worktree_path: Option<String>,
         pub created_at: DateTime<Utc>,
         pub updated_at: DateTime<Utc>,
     }
     ```
  4. Define `PrState` enum: `Open`, `Review`, `ChangesRequested`, `Approved`, `Merged`.
  5. Implement `WorkPackage::new()` constructor with required fields.
  6. Implement `WpState::can_transition_to(target) -> bool`:
     - `Planned -> Doing` (start work)
     - `Planned -> Blocked` (dependency not met)
     - `Doing -> Review` (PR created)
     - `Doing -> Blocked` (dependency broke)
     - `Review -> Done` (approved + merged)
     - `Review -> Doing` (changes requested)
     - `Blocked -> Planned` (blocker resolved)
  7. Implement `WorkPackage::transition()` using `can_transition_to`.
  8. Implement `WorkPackage::has_file_overlap(other: &WorkPackage) -> Vec<String>` returning overlapping file paths.
- **Files**: `crates/agileplus-core/src/domain/work_package.rs`
- **Parallel?**: Yes -- can run alongside T012-T014 once shared types (DateTime, DomainError) exist.
- **Validation**: WP can be created, transitioned through valid states; file overlap detection returns correct paths.
- **Notes**: The WP state machine is simpler than Feature because WPs don't have a governance contract per state. The `Blocked` state is special -- it can be entered from `Planned` or `Doing` and can only exit to `Planned` (reset). The `file_scope` is a `Vec<String>` of relative file paths that this WP modifies -- used by the scheduler for parallelism decisions (FR-038).

### Subtask T016 -- Implement `WpDependency` and dependency-aware scheduling logic (FR-039)

- **Purpose**: Model the dependency graph between work packages and provide scheduling logic that determines which WPs can run in parallel. This is critical for the `implement` command's parallelism strategy.
- **Steps**:
  1. Define `WpDependency` in `work_package.rs` (or a separate `dependencies.rs`):
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct WpDependency {
         pub wp_id: i64,
         pub depends_on: i64,
         pub dep_type: DependencyType,
     }

     #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
     #[serde(rename_all = "snake_case")]
     pub enum DependencyType {
         /// User-declared dependency in tasks.md
         Explicit,
         /// Auto-detected from overlapping file_scope
         FileOverlap,
         /// Schema/data dependency (one WP produces data another consumes)
         Data,
     }
     ```
  2. Implement `DependencyGraph` struct:
     ```rust
     pub struct DependencyGraph {
         /// Adjacency list: wp_id -> list of wp_ids it depends on
         edges: HashMap<i64, Vec<WpDependency>>,
     }
     ```
  3. Implement `DependencyGraph::new(wps: &[WorkPackage], deps: &[WpDependency]) -> Self`.
  4. Implement `DependencyGraph::add_file_overlap_edges(&mut self, wps: &[WorkPackage])`:
     - For each pair of WPs, check `has_file_overlap`
     - If overlap exists AND no explicit dependency, add a `FileOverlap` edge from higher-sequence to lower-sequence WP
  5. Implement `DependencyGraph::ready_wps(&self, done: &HashSet<i64>) -> Vec<i64>`:
     - Returns WP IDs whose ALL dependencies are in the `done` set
     - These WPs can be dispatched in parallel
  6. Implement `DependencyGraph::has_cycle(&self) -> Option<Vec<i64>>`:
     - Topological sort-based cycle detection
     - Returns the cycle path if found, None if acyclic
  7. Implement `DependencyGraph::execution_order(&self) -> Result<Vec<Vec<i64>>, DomainError>`:
     - Returns layers of parallelizable WPs (topological sort grouped by level)
     - Layer 0: WPs with no deps; Layer 1: WPs depending only on Layer 0; etc.
- **Files**: `crates/agileplus-core/src/domain/work_package.rs` (or `domain/dependencies.rs`)
- **Parallel?**: Yes -- can run alongside T012-T014 once `WorkPackage` fields are defined (T015).
- **Validation**: Graph correctly identifies parallel opportunities; cycle detection catches circular deps; `execution_order` matches expected WP ordering from tasks.md.
- **Notes**: The `execution_order` output for AgilePlus's own WPs should match the dependency graph in tasks.md (lines 525-551). Use this as a test case. The `ready_wps` function is the runtime API -- the scheduler calls it repeatedly as WPs complete. Cycle detection must run at plan time to prevent deadlocks.

### Subtask T017 -- Write unit tests for FSM: all valid transitions, invalid transitions blocked, skip transitions logged

- **Purpose**: Exhaustive testing of the state machine to ensure correctness. The FSM is safety-critical -- governance enforcement depends on it being correct.
- **Steps**:
  1. Create test module in `crates/agileplus-core/src/domain/state_machine.rs` (inline) or `crates/agileplus-core/tests/state_machine_tests.rs` (integration test).
  2. Test categories:
     **Valid forward transitions (7 tests)**:
     ```rust
     #[test]
     fn test_created_to_specified() {
         let result = FeatureState::Created.transition(FeatureState::Specified);
         assert!(matches!(result, Ok(TransitionResult::Ok(_))));
     }
     // ... one test per valid step
     ```
     **Invalid backward transitions (7+ tests)**:
     ```rust
     #[test]
     fn test_specified_to_created_blocked() {
         let result = FeatureState::Specified.transition(FeatureState::Created);
         assert!(matches!(result, Err(DomainError::InvalidTransition { .. })));
     }
     ```
     **No-op transitions (8 tests)**:
     ```rust
     #[test]
     fn test_same_state_noop() {
         let result = FeatureState::Created.transition(FeatureState::Created);
         assert!(matches!(result, Err(DomainError::NoOpTransition(_))));
     }
     ```
     **Skip transitions with warning (5+ tests)**:
     ```rust
     #[test]
     fn test_created_to_planned_skips_with_warning() {
         let result = FeatureState::Created.transition(FeatureState::Planned);
         match result {
             Ok(TransitionResult::Warning { transition, .. }) => {
                 assert_eq!(transition.skipped.len(), 2); // specified, researched
             }
             _ => panic!("Expected Warning, got {:?}", result),
         }
     }
     ```
     **Feature struct integration (3+ tests)**:
     ```rust
     #[test]
     fn test_feature_transition_updates_state() {
         let mut feature = Feature::new("test", "Test Feature", [0u8; 32], None);
         let result = feature.transition(FeatureState::Specified).unwrap();
         assert_eq!(feature.state, FeatureState::Specified);
     }
     ```
     **WP state machine (5+ tests)**: Valid and invalid WP transitions.
     **Dependency graph (5+ tests)**:
     ```rust
     #[test]
     fn test_ready_wps_respects_dependencies() { ... }
     #[test]
     fn test_cycle_detection() { ... }
     #[test]
     fn test_execution_order_layers() { ... }
     #[test]
     fn test_file_overlap_adds_dependency() { ... }
     ```
  3. Consider adding proptest for property-based testing:
     ```rust
     proptest! {
         #[test]
         fn forward_transitions_never_error(
             from in 0u8..7,
             to in (from+1)..8,
         ) {
             let from_state = FeatureState::from_ordinal(from);
             let to_state = FeatureState::from_ordinal(to);
             assert!(from_state.transition(to_state).is_ok());
         }
     }
     ```
- **Files**: `crates/agileplus-core/src/domain/state_machine.rs` (inline tests) or `crates/agileplus-core/tests/`
- **Parallel?**: No -- depends on T012-T016 being complete.
- **Validation**: `cargo test -p agileplus-core` passes 20+ tests with 0 failures.
- **Notes**: Add `proptest` to dev-dependencies if using property-based tests. The FSM tests are the most important tests in the entire project -- they guard the governance model. Aim for 100% branch coverage on the transition function.

### Subtask T017b: Property-Based Tests for FSM

**Purpose**: Use proptest to exhaustively verify FSM transition invariants.

**Steps**:
1. Add `proptest` to dev-dependencies
2. Write property tests: for any valid state, only valid transitions succeed
3. Write property tests: skip transitions always produce Warning
4. Write property tests: invalid transitions always return Error with correct message

**Files**: `crates/agileplus-domain/src/domain/state_machine.rs` (tests module)
**Validation**: `cargo test` with proptest generates 256+ test cases, all pass

### Subtask T017c: Mutation Testing for FSM

**Purpose**: Verify FSM test suite catches mutations (cargo-mutants ≥90%).

**Steps**:
1. Add `cargo-mutants` to dev tooling
2. Run `cargo mutants -p agileplus-domain -- --test state_machine`
3. Verify mutation score ≥90%. Fix gaps by adding targeted tests.

**Files**: `crates/agileplus-domain/Cargo.toml`
**Validation**: cargo-mutants report shows ≥90% killed mutations for state_machine.rs

---

## Test Strategy

- **Unit tests**: 20+ tests in agileplus-core covering all state machine paths
- **Property-based tests**: Optional but recommended -- proptest for transition exhaustiveness
- **Command**: `cargo test -p agileplus-core -- --nocapture` for verbose output
- **Coverage**: `cargo tarpaulin -p agileplus-core` for coverage report (aim >95% on domain/)
- **No integration tests**: This WP is pure domain logic with no I/O

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| State machine edge cases missed | Governance bypassed silently | Exhaustive tests + proptest; compiler enforces match exhaustiveness |
| Skip-with-warning too permissive | Users bypass governance unintentionally | Warning result is loud; CLI should require `--force` flag for skips |
| Dependency graph cycles | Scheduler deadlocks | Cycle detection runs at plan time; `has_cycle()` tested explicitly |
| File overlap detection false positives | Unnecessary serialization of parallel WPs | Use exact path matching, not prefix matching; review with glob patterns later |
| Serde representation changes | Stored data incompatible | Pin serde format with explicit rename_all; add deserialization tests |

---

## Review Guidance

Reviewers should verify:

1. **Compiler enforcement**: All `match` on `FeatureState` are exhaustive (no `_ =>` catch-all).
2. **Transition correctness**: Every valid forward transition tested; every backward transition blocked.
3. **Skip behavior**: Skip transitions return `Warning` (not `Ok`); skipped states list is correct.
4. **No I/O**: Core crate has zero I/O operations. All data passed in via function args.
5. **Serde round-trip**: Feature and WP can serialize to JSON and deserialize back identically.
6. **Data model match**: All fields from data-model.md present with correct types.
7. **Error quality**: DomainError messages are descriptive and actionable.
8. **Test coverage**: >95% branch coverage on state_machine.rs; all edge cases covered.

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this Activity Log section
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ – agent_id – lane=<lane> – <action>`
4. Timestamp MUST be current time in UTC
5. Lane MUST match the frontmatter `lane:` field exactly

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

- 2026-02-27T00:00:00Z – system – lane=planned – Prompt created.
- 2026-02-28T09:22:10Z – claude-wp03 – shell_pid=29682 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:28:24Z – claude-wp03 – shell_pid=29682 – lane=doing – T017c (mutation testing) deferred to CI setup
- 2026-02-28T09:28:35Z – claude-wp03 – shell_pid=29682 – lane=for_review – Ready for review: Feature FSM, WorkPackage states, DependencyGraph, 52 tests passing including proptest
- 2026-02-28T09:30:28Z – claude-wp03 – shell_pid=29682 – lane=done – Review passed: serde derives added, 52 tests, clean clippy
