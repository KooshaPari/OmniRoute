---
work_package_id: WP04
title: CLI Cycle Commands
lane: planned
dependencies: []
subtasks: [T019, T020, T021, T022, T023]
phase: Phase 3 - CLI
estimated_lines: 350
frs: [FR-CLI02, FR-C02, FR-C04, FR-C05, FR-C07]
priority: P1
---

# WP04: CLI Cycle Commands

## Implementation Command

```bash
spec-kitty implement WP04 --base WP02
```

WP02 must be merged. WP03 and WP04 can run in parallel.

## Objectives

Add the `agileplus cycle` subcommand group to the CLI. Subcommands: `create`, `list`, `show`,
`add`, `remove`, `transition`. The `transition shipped` subcommand enforces the gate that all
assigned Features are Validated or Shipped before accepting the state change.

### Success Criteria

- `agileplus cycle create "Sprint W10" --start 2026-03-03 --end 2026-03-14` creates a Draft cycle.
- `agileplus cycle create "Notif Refactor" --start ... --end ... --module notifications` creates
  a module-scoped cycle.
- `agileplus cycle list` lists all cycles; `agileplus cycle list --state active` filters.
- `agileplus cycle show "Sprint W10"` prints features, WP counts, and date range.
- `agileplus cycle add "Sprint W10" login` adds the feature (or fails for out-of-scope).
- `agileplus cycle remove "Sprint W10" login` removes without affecting Feature state.
- `agileplus cycle transition "Sprint W10" active` moves Draft -> Active.
- `agileplus cycle transition "Sprint W10" shipped` is REJECTED if any assigned feature is not
  Validated/Shipped, with a message naming the blocking features.
- All commands exit 0 on success, non-zero on failure with clear stderr messages.
- `cargo test -p agileplus-cli cycle` unit tests pass.

## Context & Constraints

- **Pattern**: Follow `WP03` (module.rs) and existing command files exactly.
- **Date parsing**: Use `chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")` for `--start`/`--end`
  flags. Provide a clear parse error: `"Invalid date '{}': expected YYYY-MM-DD"`.
- **Gate enforcement**: `transition shipped` fetches `CycleWithFeatures` and calls
  `is_shippable()`. If false, collect all blocking feature slugs and print:
  `"Cannot transition to Shipped: the following features are not Validated or Shipped: login, sso"`.
  Do NOT call `storage.update_cycle_state` until the gate passes.
- **State filter**: `--state` flag for `list` takes a `CycleState` string (case-insensitive via
  `FromStr` on the enum). If unrecognized, clap exits with a parse error automatically.
- **Files**:
  - NEW: `crates/agileplus-cli/src/commands/cycle.rs`
  - MODIFIED: `crates/agileplus-cli/src/commands/mod.rs` -- add `pub mod cycle;`
  - MODIFIED: `crates/agileplus-cli/src/main.rs` -- add `Cycle` variant

---

## Subtask Guidance

### T019 - Create cycle.rs Command Module Scaffold

**Purpose**: Define the clap command structure for all cycle subcommands.

**File**: `crates/agileplus-cli/src/commands/cycle.rs` (create new)

**Steps**:

1. Add file-level doc comment: `//! Cycle management commands -- FR-CLI02`.

2. Define the top-level args struct and subcommand enum:

   ```rust
   use clap::{Args, Subcommand};

   #[derive(Debug, Args)]
   pub struct CycleArgs {
       #[command(subcommand)]
       pub command: CycleCommand,
   }

   #[derive(Debug, Subcommand)]
   pub enum CycleCommand {
       /// Create a new cycle
       Create(CreateArgs),
       /// List cycles, optionally filtered by state
       List(ListArgs),
       /// Show cycle details with assigned features and WP progress
       Show(ShowArgs),
       /// Add a feature to a cycle
       Add(AddArgs),
       /// Remove a feature from a cycle
       Remove(RemoveArgs),
       /// Transition a cycle to a new state
       Transition(TransitionArgs),
   }
   ```

3. Define each args struct:

   ```rust
   #[derive(Debug, Args)]
   pub struct CreateArgs {
       /// Display name for the cycle
       pub name: String,
       /// Start date (YYYY-MM-DD)
       #[arg(long)]
       pub start: String,
       /// End date (YYYY-MM-DD)
       #[arg(long)]
       pub end: String,
       /// Optional module slug to scope this cycle
       #[arg(long)]
       pub module: Option<String>,
   }

   #[derive(Debug, Args)]
   pub struct ListArgs {
       /// Filter by state (Draft, Active, Review, Shipped, Archived)
       #[arg(long)]
       pub state: Option<String>,
   }

   #[derive(Debug, Args)]
   pub struct ShowArgs {
       /// Cycle name to show
       pub name: String,
   }

   #[derive(Debug, Args)]
   pub struct AddArgs {
       /// Cycle name
       pub cycle_name: String,
       /// Feature slug to add
       pub feature_slug: String,
   }

   #[derive(Debug, Args)]
   pub struct RemoveArgs {
       /// Cycle name
       pub cycle_name: String,
       /// Feature slug to remove
       pub feature_slug: String,
   }

   #[derive(Debug, Args)]
   pub struct TransitionArgs {
       /// Cycle name
       pub cycle_name: String,
       /// Target state (Active, Review, Shipped, Archived, Draft)
       pub target_state: String,
   }
   ```

4. Define the dispatch function with `todo!()` stubs:

   ```rust
   pub async fn run(args: CycleArgs, storage: &dyn StoragePort) -> anyhow::Result<()> {
       match args.command {
           CycleCommand::Create(a)     => create(a, storage).await,
           CycleCommand::List(a)       => list(a, storage).await,
           CycleCommand::Show(a)       => show(a, storage).await,
           CycleCommand::Add(a)        => add(a, storage).await,
           CycleCommand::Remove(a)     => remove(a, storage).await,
           CycleCommand::Transition(a) => transition(a, storage).await,
       }
   }
   ```

5. Add `pub mod cycle;` to `commands/mod.rs`.

**Validation**: `cargo check -p agileplus-cli` zero errors.

---

### T020 - Implement cycle create and cycle list

**Purpose**: Provide the two foundational read/write subcommands.

**File**: `crates/agileplus-cli/src/commands/cycle.rs`

**Steps**:

1. Implement `async fn create(args: CreateArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Parse `start_date`:
     ```rust
     let start = chrono::NaiveDate::parse_from_str(&args.start, "%Y-%m-%d")
         .map_err(|_| anyhow::anyhow!("Invalid start date '{}': expected YYYY-MM-DD", args.start))?;
     ```
   - Parse `end_date` identically.
   - Resolve optional module scope:
     - If `args.module = Some(slug)`, look up `storage.get_module_by_slug(&slug, None).await?`.
       If `None`, return error `"Module '{}' not found"`.
       Extract `Some(module.id)` as `module_scope_id`.
     - If `None`, `module_scope_id = None`.
   - Build `Cycle::new(&args.name, start, end, module_scope_id)?` (may return `DomainError` for
     invalid date range -- map with `.map_err(|e| anyhow::anyhow!(e))?`).
   - Call `storage.create_cycle(&cycle).await?`.
   - Print: `"Created cycle '{}' (id: {}, state: Draft, {} to {})"`.

2. Implement `async fn list(args: ListArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Parse optional state filter:
     ```rust
     let state_filter = args.state
         .map(|s| s.parse::<CycleState>()
             .map_err(|e| anyhow::anyhow!("Unknown state '{}': {}", s, e)))
         .transpose()?;
     ```
   - Call `storage.list_cycles(state_filter).await?`.
   - If empty, print `"No cycles found."`.
   - Otherwise, print a table:
     ```
     NAME                    STATE    START        END          SCOPE
     Sprint W10              Active   2026-03-03   2026-03-14   (all)
     Notif Refactor          Draft    2026-03-15   2026-03-28   notifications
     ```
   - Resolve scope slug: fetch module name from `storage.get_module_by_id(scope_id)` for display;
     show `"(all)"` when `module_scope_id = None`.

**Validation**: `agileplus cycle create` and `agileplus cycle list` work end-to-end.

---

### T021 - Implement cycle show

**Purpose**: Display full cycle detail with feature list and WP progress aggregate.

**File**: `crates/agileplus-cli/src/commands/cycle.rs`

**Steps**:

1. Implement `async fn show(args: ShowArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve cycle by name: `storage.get_cycle_by_name(&args.name).await?`. If `None`, error.
   - Call `storage.get_cycle_with_features(cycle.id).await?`. If `None`, error
     (shouldn't happen since we just found it -- handle defensively).
   - Print:

     ```
     Cycle: Sprint W10
     State: Active
     Dates: 2026-03-03 to 2026-03-14 (11 days)
     Scope: (all modules)

     WP Progress:
       Total:       23
       Done:         8  (35%)
       In Progress:  5  (22%)
       Planned:     10  (43%)
       Blocked:      0   (0%)

     Assigned Features (5):
       login           implementing
       sso             specified
       password-reset  planned
       mfa             implementing
       session-mgmt    validated
     ```

   - Compute "days" as `(end_date - start_date).num_days()`.
   - Compute WP percentage as `(count * 100) / total` using integer division; guard against
     `total == 0` (show `0%` for all).
   - Sort features by slug alphabetically.
   - Mark scope as `"Module: {slug}"` or `"(all modules)"`.

2. Edge case: empty cycle with no features: print `"Assigned Features (0): (none)"` and all WP
   counts as 0.

**Validation**: `agileplus cycle show "Sprint W10"` renders correctly with multiple features.

---

### T022 - Implement cycle add and cycle remove

**Purpose**: Assign and unassign Features from a Cycle, with scope validation surfaced clearly.

**File**: `crates/agileplus-cli/src/commands/cycle.rs`

**Steps**:

1. Implement `async fn add(args: AddArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve cycle by name. If `None`, error `"Cycle '{}' not found"`.
   - Resolve feature by slug. If `None`, error `"Feature '{}' not found"`.
   - Call `storage.add_feature_to_cycle(cycle.id, feature.id).await`.
   - On `Err(DomainError::FeatureNotInModuleScope { feature_slug, module_slug })`, return:
     ```
     "Cannot add: feature '{}' is not owned by or tagged to module '{}' (cycle scope).
      Use 'agileplus module assign {}' or 'agileplus module tag {}' first."
     ```
   - On success, print: `"Added feature '{}' to cycle '{}'."`.

2. Implement `async fn remove(args: RemoveArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve cycle and feature by name/slug.
   - Call `storage.remove_feature_from_cycle(cycle.id, feature.id).await?`.
   - Print: `"Removed feature '{}' from cycle '{}'. Feature state is unchanged."`.

   Note: the trailing message reinforces the spec edge case that remove does not change Feature state.

3. Edge case for `add`: if feature is already in the cycle, the storage uses `INSERT OR IGNORE`
   so it returns `Ok(())` silently. The CLI prints `"Feature '{}' is already in cycle '{}'."` if
   the feature was already there. Detect this by checking if `cycle_features` contains the pair
   BEFORE the insert, OR rely on the fact that `INSERT OR IGNORE` doesn't change row count.
   Simpler: attempt the insert and if affected rows == 0, print the "already present" message.
   Adjust the `add_feature_to_cycle` return type to `Result<bool, DomainError>` where `true` means
   inserted and `false` means already existed, OR just keep `Result<()>` and print unconditionally.
   Follow the simpler path: `Ok(())` prints success unconditionally (idempotent is fine).

**Validation**: `agileplus cycle add` fails with scope error; `agileplus cycle remove` succeeds.

---

### T023 - Implement cycle transition with Gate Enforcement and Wire into main.rs

**Purpose**: Advance cycle state with the Shipped gate check, then wire commands into the CLI
entry point and add unit tests.

**File**: `crates/agileplus-cli/src/commands/cycle.rs` + `main.rs`

**Steps**:

1. Implement `async fn transition(args: TransitionArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve cycle by name. If `None`, error.
   - Parse `target_state`:
     ```rust
     let target: CycleState = args.target_state.parse()
         .map_err(|e| anyhow::anyhow!("Unknown cycle state '{}': {}", args.target_state, e))?;
     ```
   - Validate the edge is allowed at the domain level: call `cycle.state.transition(target)`.
     On `Err(DomainError::InvalidTransition { from, to, reason })`, return:
     `"Cannot transition from {} to {}: {}"`.
     On `Err(DomainError::NoOpTransition(_))`, print `"Cycle is already in '{}' state."` and
     return `Ok(())`.

   - Special gate for `CycleState::Shipped` (Traces to FR-C07):
     ```rust
     if target == CycleState::Shipped {
         let cwf = storage.get_cycle_with_features(cycle.id).await?
             .ok_or_else(|| anyhow::anyhow!("Cycle data not found"))?;
         if !cwf.is_shippable() {
             let blockers: Vec<String> = cwf.features.iter()
                 .filter(|f| {
                     f.state != FeatureState::Validated && f.state != FeatureState::Shipped
                 })
                 .map(|f| format!("'{}' ({})", f.slug, f.state))
                 .collect();
             return Err(anyhow::anyhow!(
                 "Cannot transition to Shipped: the following features are not yet Validated or Shipped:\n  {}",
                 blockers.join("\n  ")
             ));
         }
     }
     ```

   - If gate passes, call `storage.update_cycle_state(cycle.id, target).await?`.
   - Print: `"Cycle '{}' transitioned: {} -> {}"`.

2. Wire into `main.rs` / top-level Commands enum:

   ```rust
   /// Cycle management (FR-CLI02)
   Cycle(commands::cycle::CycleArgs),
   ```

   In dispatch:
   ```rust
   Commands::Cycle(args) => commands::cycle::run(args, &storage).await?,
   ```

3. Verify `agileplus --help` shows `cycle` subcommand.

4. Write unit tests in `cycle.rs` under `#[cfg(test)]`:

   - `create_args_parses_dates`: clap parses `["create", "Sprint", "--start", "2026-03-03", "--end", "2026-03-14"]`
     correctly; `start = "2026-03-03"`, `end = "2026-03-14"`, `module = None`.
   - `create_args_with_module`: `["create", "S", "--start", "2026-03-03", "--end", "2026-03-14", "--module", "auth"]`
     sets `module = Some("auth".into())`.
   - `list_args_state_filter`: `["list", "--state", "active"]` sets `state = Some("active".into())`.
   - `transition_args_parses`: `["transition", "Sprint W10", "shipped"]` sets `cycle_name = "Sprint W10"`,
     `target_state = "shipped"`.
   - `shipped_gate_error_message`: construct a `CycleWithFeatures` with one Implementing feature,
     call `is_shippable()`, verify returns false.

**Validation**: `cargo test -p agileplus-cli` all green; `cargo clippy -p agileplus-cli -- -D warnings` zero warnings.
