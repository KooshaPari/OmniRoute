---
work_package_id: WP03
title: CLI Module Commands
lane: planned
dependencies: []
subtasks: [T014, T015, T016, T017, T018]
phase: Phase 3 - CLI
estimated_lines: 350
frs: [FR-CLI01, FR-CLI03]
priority: P1
---

# WP03: CLI Module Commands

## Implementation Command

```bash
spec-kitty implement WP03 --base WP02
```

WP02 must be merged. WP03 and WP04 can run in parallel after WP02.

## Objectives

Add the `agileplus module` subcommand group to the CLI. Subcommands: `create`, `list`, `show`,
`assign`, `tag`, `untag`, `delete`. The `list --tree` flag renders a recursive hierarchical tree.
All commands wire into `crates/agileplus-cli/src/commands/mod.rs` and the CLI entry point.

### Success Criteria

- `agileplus module create "Authentication"` creates a root module and prints its slug + id.
- `agileplus module create "OAuth Providers" --parent authentication` creates a child module.
- `agileplus module assign login authentication` sets `Feature.module_id` via storage.
- `agileplus module tag unified-search authentication` inserts a `module_feature_tags` row.
- `agileplus module untag unified-search authentication` removes the tag.
- `agileplus module list` shows all root modules; `agileplus module list --tree` shows full tree.
- `agileplus module show authentication` shows owned features, tagged features, and children.
- `agileplus module delete authentication` fails with a clear error if children or features exist.
- `agileplus module delete empty-module` succeeds on a module with no dependents.
- All commands exit 0 on success and non-zero on failure with a human-readable message to stderr.
- `cargo test -p agileplus-cli module` unit tests pass.

## Context & Constraints

- **Pattern**: Examine an existing command file (e.g., `crates/agileplus-cli/src/commands/specify.rs`
  or `plan.rs`) to understand the clap derive pattern, the storage port initialisation, and how
  commands return `anyhow::Result<()>`.
- **Clap**: Use `#[derive(Parser)]` and `#[derive(Subcommand)]` from `clap`. Follow the exact
  style already used in the crate.
- **Storage**: Commands call `StoragePort` methods asynchronously. The CLI uses a Tokio runtime
  (verify with `crates/agileplus-cli/src/main.rs` -- if `#[tokio::main]` is present, `async fn run()`
  pattern is established).
- **Error display**: Do not panic. Map `DomainError` to `anyhow::Error` using `.map_err(|e| anyhow::anyhow!(e))`.
  Print actionable messages: `"Error: module 'authentication' has child modules -- delete or reparent them first"`.
- **Tree rendering**: For `list --tree`, use a simple recursive ASCII tree. No external crates.
  Pattern: print `+-- slug` with increasing indent per level.
- **Files**:
  - NEW: `crates/agileplus-cli/src/commands/module.rs`
  - MODIFIED: `crates/agileplus-cli/src/commands/mod.rs` -- add `pub mod module;`
  - MODIFIED: `crates/agileplus-cli/src/main.rs` (or top-level Commands enum) -- add `Module` variant

---

## Subtask Guidance

### T014 - Create module.rs Command Module Scaffold

**Purpose**: Define the clap command structure for all module subcommands.

**File**: `crates/agileplus-cli/src/commands/module.rs` (create new)

**Steps**:

1. Add file-level doc comment: `//! Module management commands -- FR-CLI01, FR-CLI03`.

2. Define the top-level args struct and subcommand enum:

   ```rust
   use clap::{Args, Subcommand};

   #[derive(Debug, Args)]
   pub struct ModuleArgs {
       #[command(subcommand)]
       pub command: ModuleCommand,
   }

   #[derive(Debug, Subcommand)]
   pub enum ModuleCommand {
       /// Create a new module
       Create(CreateArgs),
       /// List modules (optionally as a tree)
       List(ListArgs),
       /// Show a module with its features and children
       Show(ShowArgs),
       /// Set a feature's owning module
       Assign(AssignArgs),
       /// Add a secondary tag between a feature and a module
       Tag(TagArgs),
       /// Remove a secondary tag between a feature and a module
       Untag(UntagArgs),
       /// Delete a module (fails if it has children or owned features)
       Delete(DeleteArgs),
   }
   ```

3. Define each args struct (placeholders for now; flesh out in T015-T017):

   ```rust
   #[derive(Debug, Args)]
   pub struct CreateArgs {
       /// Display name for the new module
       pub name: String,
       /// Slug of the parent module (creates a child if provided)
       #[arg(long)]
       pub parent: Option<String>,
   }

   #[derive(Debug, Args)]
   pub struct ListArgs {
       /// Render as recursive ASCII tree
       #[arg(long)]
       pub tree: bool,
   }

   #[derive(Debug, Args)]
   pub struct ShowArgs {
       /// Module slug to show
       pub slug: String,
   }

   #[derive(Debug, Args)]
   pub struct AssignArgs {
       /// Feature slug to assign
       pub feature_slug: String,
       /// Module slug to assign it to
       pub module_slug: String,
   }

   #[derive(Debug, Args)]
   pub struct TagArgs {
       pub feature_slug: String,
       pub module_slug: String,
   }

   #[derive(Debug, Args)]
   pub struct UntagArgs {
       pub feature_slug: String,
       pub module_slug: String,
   }

   #[derive(Debug, Args)]
   pub struct DeleteArgs {
       /// Module slug to delete
       pub slug: String,
   }
   ```

4. Define the top-level dispatch function signature:

   ```rust
   pub async fn run(args: ModuleArgs, storage: &dyn StoragePort) -> anyhow::Result<()> {
       match args.command {
           ModuleCommand::Create(a) => create(a, storage).await,
           ModuleCommand::List(a)   => list(a, storage).await,
           ModuleCommand::Show(a)   => show(a, storage).await,
           ModuleCommand::Assign(a) => assign(a, storage).await,
           ModuleCommand::Tag(a)    => tag(a, storage).await,
           ModuleCommand::Untag(a)  => untag(a, storage).await,
           ModuleCommand::Delete(a) => delete(a, storage).await,
       }
   }
   ```

   Leave all inner `async fn` bodies as `todo!()` stubs for now.

5. Add `pub mod module;` to `crates/agileplus-cli/src/commands/mod.rs`.

**Validation**: `cargo check -p agileplus-cli` zero errors.

---

### T015 - Implement module create and module delete

**Purpose**: Create the two most structurally important subcommands -- creation (with parent
resolution) and deletion (with guard enforcement).

**File**: `crates/agileplus-cli/src/commands/module.rs`

**Steps**:

1. Implement `async fn create(args: CreateArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - If `args.parent` is `Some(parent_slug)`:
     - Call `storage.get_module_by_slug(&parent_slug, None).await?`.
     - If `None`, return `Err(anyhow::anyhow!("Parent module '{}' not found", parent_slug))`.
     - Use the found parent's `id` as `parent_module_id`.
   - Build `Module::new(&args.name, parent_module_id)`.
   - Call `storage.create_module(&module).await?`.
   - Print: `"Created module '{}' (slug: {}, id: {})"`.

   Note: `get_module_by_slug` takes a `parent_module_id` scope parameter. For the CLI `--parent`
   flag, first look up the parent by slug with `parent_module_id = None` (root search). If the
   user's system has deeply nested parents with duplicate slugs, they must provide the full path
   -- document this limitation in a CLI help note.

2. Implement `async fn delete(args: DeleteArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve slug to id: call `get_module_by_slug(&args.slug, None).await?`.
   - If `None`, return `Err(anyhow::anyhow!("Module '{}' not found", args.slug))`.
   - Call `storage.delete_module(module.id).await`.
   - Map `DomainError::ModuleHasDependents(msg)` to a human message:
     `"Cannot delete: {msg} -- remove owned features and child modules first"`.
   - On success, print: `"Deleted module '{}'."`.

3. Write unit tests for the guard messages:
   - Mock a storage that returns `Err(DomainError::ModuleHasDependents("has 2 child modules".into()))`.
   - Verify the error message contains actionable wording.

**Validation**: Manual `agileplus module create "Test"` and `agileplus module delete "test"` work end-to-end.

---

### T016 - Implement module list and module show

**Purpose**: List modules flat and as tree; show a module's full detail view.

**File**: `crates/agileplus-cli/src/commands/module.rs`

**Steps**:

1. Implement `async fn list(args: ListArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Fetch root modules: `storage.list_root_modules().await?`.
   - If `!args.tree`:
     - Print each module as one line: `"  {slug}  {friendly_name}"`.
   - If `args.tree`:
     - For each root module, call `print_module_tree(module, storage, 0).await?`.

2. Implement the recursive tree printer:

   ```rust
   async fn print_module_tree(
       module: &Module,
       storage: &dyn StoragePort,
       depth: usize,
   ) -> anyhow::Result<()> {
       let indent = "  ".repeat(depth);
       let connector = if depth == 0 { "" } else { "+-- " };
       // Count owned features
       let mwf = storage.get_module_with_features(module.id).await?;
       let owned_count = mwf.as_ref().map(|m| m.owned_features.len()).unwrap_or(0);
       let tagged_count = mwf.as_ref().map(|m| m.tagged_features.len()).unwrap_or(0);
       println!(
           "{}{}{} ({} owned, {} tagged)",
           indent, connector, module.slug, owned_count, tagged_count
       );
       let children = storage.list_child_modules(module.id).await?;
       for child in &children {
           Box::pin(print_module_tree(child, storage, depth + 1)).await?;
       }
       Ok(())
   }
   ```

   Note: use `Box::pin` for recursive async functions to avoid infinite size at compile time.

   Example output for `--tree`:
   ```
   authentication (3 owned, 0 tagged)
     +-- oauth-providers (0 owned, 0 tagged)
   content (5 owned, 1 tagged)
   notifications (2 owned, 2 tagged)
   ```

3. Implement `async fn show(args: ShowArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve slug to module (same root-search pattern as `delete`).
   - Call `storage.get_module_with_features(module.id).await?`.
   - Print sections:
     ```
     Module: authentication
     Description: Handles all auth flows

     Owned Features (3):
       login         -- implementing
       sso           -- specified
       password-reset -- planned

     Tagged Features (1):
       unified-search -- researched

     Child Modules (1):
       oauth-providers
     ```

**Validation**: `agileplus module list --tree` renders correct ASCII tree; `agileplus module show` shows correct sections.

---

### T017 - Implement module assign, tag, and untag

**Purpose**: The three relational operations -- setting strict ownership and secondary tags.

**File**: `crates/agileplus-cli/src/commands/module.rs`

**Steps**:

1. Implement `async fn assign(args: AssignArgs, storage: &dyn StoragePort) -> anyhow::Result<()>`:

   - Resolve feature slug: `storage.get_feature_by_slug(&args.feature_slug).await?`. If `None`, error.
   - Resolve module slug: `storage.get_module_by_slug(&args.module_slug, None).await?`. If `None`, error.
   - Call `storage.assign_feature_to_module(feature.id, module.id).await?`.
   - Print: `"Assigned feature '{}' to module '{}'."`.

   Edge case: if the feature already has a different `module_id`, the storage will overwrite it.
   Print a warning: `"Warning: feature '{}' was previously assigned to another module -- ownership transferred."`.
   Check `feature.module_id != Some(module.id)` before the call to detect this.

2. Implement `async fn tag(args: TagArgs, ...)`:

   - Same resolution pattern as `assign`.
   - Call `storage.tag_feature_to_module(module.id, feature.id).await?`.
   - Print: `"Tagged feature '{}' to module '{}'."`.

3. Implement `async fn untag(args: UntagArgs, ...)`:

   - Same resolution pattern.
   - Call `storage.untag_feature_from_module(module.id, feature.id).await?`.
   - Print: `"Untagged feature '{}' from module '{}'."`.

**Validation**: All three commands succeed against a real SQLite DB; second tagging the same pair is idempotent (INSERT OR IGNORE).

---

### T018 - Wire module Commands into main.rs and Add Unit Tests

**Purpose**: Expose `agileplus module` at the top level and cover command dispatch with tests.

**Files**:
- MODIFIED: `crates/agileplus-cli/src/main.rs` (or wherever the top-level `Commands` enum lives)

**Steps**:

1. Locate the top-level `Commands` enum. Add:

   ```rust
   /// Module management (FR-CLI01)
   Module(commands::module::ModuleArgs),
   ```

2. In the match dispatch block, add:

   ```rust
   Commands::Module(args) => commands::module::run(args, &storage).await?,
   ```

3. Verify `agileplus --help` shows `module` as a subcommand with its description.

4. Write unit tests (in `module.rs` under `#[cfg(test)]`):

   - `create_args_parse_no_parent`: verify clap parses `["create", "My Module"]` correctly with
     `parent = None`.
   - `create_args_parse_with_parent`: verify `["create", "Sub", "--parent", "auth"]` sets
     `parent = Some("auth".into())`.
   - `list_args_tree_flag`: verify `["list", "--tree"]` sets `tree = true`.
   - `delete_args_slug`: verify `["delete", "my-module"]` sets `slug = "my-module"`.

   Use clap's `try_parse_from` for these tests.

**Validation**: `cargo test -p agileplus-cli` all green; `cargo clippy -p agileplus-cli -- -D warnings` zero warnings.
