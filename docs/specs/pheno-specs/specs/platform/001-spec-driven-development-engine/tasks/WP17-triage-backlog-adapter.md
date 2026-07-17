---
work_package_id: WP17
title: Triage & Backlog Service
lane: "done"
dependencies:
- WP00
base_branch: 001-spec-driven-development-engine-WP13
base_commit: 3fc4a17c8bbced1dcddd3780def30ba7e544b1ef
created_at: '2026-02-28T13:20:43.722928+00:00'
subtasks:
- T098
- T098b
- T099
- T100
- T101
- T102
- T102b
- T103
phase: Phase 5 - Triage, Sync & Sub-Commands
assignee: ''
agent: "claude-opus"
shell_pid: "78007"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP17 — Triage & Backlog Service

## Implementation Command

```bash
spec-kitty implement WP17 --base WP00
```

---

## Objectives

Implement a triage classifier and backlog management layer in the `agileplus-integrations` repository, housed in the `crates/agileplus-triage/` crate. This work package introduces:

1. Repository initialization: the `agileplus-integrations` Cargo workspace with four crates (`agileplus-plane`, `agileplus-github`, `agileplus-triage`, `agileplus-integrations-service`), a proto git submodule, and a Makefile.
2. Rule-based intent classification that categorises raw user input into one of four intent types: `bug`, `feature`, `idea`, or `task`.
3. A persistent `BacklogItem` CRUD layer backed by SQLite via the existing `StoragePort` abstraction.
4. A prompt router generator that produces `CLAUDE.md` and `AGENTS.md` files encoding project context, available commands, and routing rules for downstream agent use.
5. A gRPC service (`agileplus-integrations-service`) implementing `IntegrationsService` from `integrations.proto`, exposing triage endpoints and communicating with the core service via gRPC for state reads.

All code must compile on stable Rust, pass `cargo clippy -- -D warnings`, and achieve 100% coverage of the happy path for each public function. Classification accuracy must be validated against at least five examples per category in unit tests. The gRPC service must pass a health check (`grpc.health.v1.Health/Check`) before WP17 is considered complete.

---

## Context & Constraints

### Dependencies

- **WP00**: Establishes the mono-repo skeleton, Cargo workspace, proto submodule, and shared protobuf contracts. WP17 creates the `agileplus-integrations` sibling repo following the same workspace conventions. The `integrations.proto` IntegrationsService definition consumed by the gRPC server is part of the proto submodule introduced in WP00.

> **Note**: WP17 no longer depends on WP05 or WP06. All storage bootstrapping is self-contained within `agileplus-integrations`. The `StoragePort` trait is re-implemented locally or vendored. gRPC calls to the core service replace direct config reads previously supplied by WP06.

### Repository & Crate Layout

```
agileplus-integrations/          # new sibling repo (T098)
  Cargo.toml                     # workspace manifest listing all 4 crates
  Makefile                       # proto codegen, build, test targets
  proto/                         # git submodule — shared protobuf definitions
  crates/
    agileplus-plane/             # Plane.so sync adapter
    agileplus-github/            # GitHub Issues sync adapter
    agileplus-triage/            # triage classifier + backlog CRUD (WP17 focus)
      Cargo.toml
      src/
        lib.rs          # public API re-exports; TriageAdapter struct
        classifier.rs   # classification rules (T100)
        backlog.rs      # BacklogItem CRUD (T099)
        router.rs       # CLAUDE.md / AGENTS.md generation (T101, T102)
      tests/
        integration.rs  # integration-level tests (T103)
    agileplus-integrations-service/  # gRPC server (T102b)
      Cargo.toml
      src/
        main.rs          # server entrypoint, health check registration
        triage_grpc.rs   # IntegrationsService impl — triage endpoints
```

### Architectural Rules

- No direct calls to any HTTP client or external process from within `agileplus-triage`. All I/O goes through the `StoragePort` trait (for persistence) or returns `String`/`PathBuf` values (for file generation).
- Classification must be purely synchronous and infallible; it returns an enum, never `Result`.
- Router generation writes files to disk via `std::fs`; the output paths are configurable and must be validated to be inside the project root.
- Keep all keyword lists in `const` slices so they can be swapped at compile time or overridden via config without changing logic.
- The `agileplus-integrations-service` gRPC server communicates with the core AgilePlus service via gRPC for all state reads (e.g., active feature, current phase). It must not import crates from the core mono-repo directly; use generated protobuf client stubs from the shared proto submodule.

### Stability Guarantee

This crate is consumed by the CLI (`crates/agileplus-cli`) in Phase 6. The public surface — `TriageAdapter::classify`, `BacklogAdapter::create`, `BacklogAdapter::list_by_type`, `BacklogAdapter::list_by_feature`, `BacklogAdapter::promote_to_feature`, `RouterGenerator::write_claude_md`, `RouterGenerator::write_agents_md` — must not change signature after WP17 merges.

---

## Subtask Guidance

### T098 — Initialize `agileplus-integrations` repo

**Purpose**: Bootstrap the `agileplus-integrations` repository so that all subsequent WP17 subtasks have a compilable workspace to work in.

**Steps**:

1. Create the repository root with a `Cargo.toml` workspace manifest that declares four members:
   - `crates/agileplus-plane`
   - `crates/agileplus-github`
   - `crates/agileplus-triage`
   - `crates/agileplus-integrations-service`

2. Add the shared protobuf definitions as a git submodule at `proto/` pointing to the same proto repository used by the core mono-repo (established in WP00).

3. Add a `Makefile` with at minimum the following targets:
   - `proto`: run `protoc` (or `tonic-build` via a build script) to regenerate Rust stubs from `proto/integrations.proto`
   - `build`: `cargo build --workspace`
   - `test`: `cargo test --workspace`
   - `lint`: `cargo clippy --workspace -- -D warnings`

4. Scaffold each crate with a minimal `Cargo.toml` and `src/lib.rs` (or `src/main.rs` for the service) so `cargo build --workspace` succeeds before any business logic is written.

5. Commit the skeleton with message `chore(WP17): initialize agileplus-integrations workspace`.

**Acceptance**: `cargo build --workspace` exits 0 on a clean checkout (after `git submodule update --init`).

---

### T098b — TriageAdapter struct with `classify()`

**File**: `crates/agileplus-triage/src/lib.rs`

**Purpose**: Expose the crate's primary entry point. `TriageAdapter` owns a `ClassifierConfig` (keyword lists) and a handle to the `BacklogAdapter`. `classify()` is a pure function: it takes a `&str` of raw user input and returns `IntentKind`.

**Steps**:

1. Define the `IntentKind` enum with four variants: `Bug`, `Feature`, `Idea`, `Task`. Derive `Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `serde::Serialize`, `serde::Deserialize`.

2. Define `TriageAdapter`:

   ```rust
   pub struct TriageAdapter {
       classifier: Classifier,
   }

   impl TriageAdapter {
       pub fn new(config: ClassifierConfig) -> Self { ... }
       pub fn classify(&self, input: &str) -> IntentKind { ... }
   }
   ```

3. `classify()` delegates entirely to `Classifier::classify()` (defined in T100). `TriageAdapter` is the stable public facade; the `Classifier` is an internal implementation detail.

4. Re-export from `lib.rs`: `IntentKind`, `TriageAdapter`, `ClassifierConfig`, `BacklogAdapter`, `BacklogItem`, `RouterGenerator`.

5. Add `[lib]` section to `Cargo.toml` with `name = "agileplus_triage"`. Add dependencies: `serde`, `serde_json`, `thiserror`. Note: `agileplus-storage` is not available as a cross-repo path dep; implement or vendor the `StoragePort` trait locally within `agileplus-integrations`.

**Extensibility note**: The `Classifier` struct must be designed so that a future `LlmClassifier` can implement the same trait without touching `TriageAdapter`. Define a `Classify` trait:

```rust
pub trait Classify: Send + Sync {
    fn classify(&self, input: &str) -> IntentKind;
}
```

`TriageAdapter` can be made generic over `C: Classify` behind a feature flag if desired, but for now hard-code `Classifier` as the concrete type to keep compilation simple.

---

### T099 — BacklogItem CRUD

**File**: `crates/agileplus-triage/src/backlog.rs`

**Purpose**: Provide a data-access layer for `backlog_items` rows in the SQLite database. All operations go through `StoragePort` (trait object or generic parameter — prefer generic for zero-cost dispatch in tests).

**Database migration** (add as `crates/agileplus-triage/src/migrations/001_backlog_items.sql`, or as an embedded string applied by `BacklogAdapter::ensure_schema()`):

```sql
CREATE TABLE IF NOT EXISTS backlog_items (
    id          TEXT PRIMARY KEY,          -- UUID v4
    kind        TEXT NOT NULL,             -- 'bug' | 'feature' | 'idea' | 'task'
    title       TEXT NOT NULL,
    description TEXT,
    feature_slug TEXT,                     -- NULL until promoted or linked
    state       TEXT NOT NULL DEFAULT 'open', -- 'open' | 'promoted' | 'closed'
    created_at  TEXT NOT NULL,             -- ISO 8601
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backlog_kind ON backlog_items (kind);
CREATE INDEX IF NOT EXISTS idx_backlog_feature ON backlog_items (feature_slug);
```

**Struct**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklogItem {
    pub id: String,
    pub kind: IntentKind,
    pub title: String,
    pub description: Option<String>,
    pub feature_slug: Option<String>,
    pub state: BacklogState,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BacklogState { Open, Promoted, Closed }
```

**Methods on `BacklogAdapter`**:

```rust
impl BacklogAdapter {
    pub fn new(storage: Arc<dyn StoragePort>) -> Self;
    pub fn ensure_schema(&self) -> Result<(), TriageError>;
    pub fn create(&self, kind: IntentKind, title: &str, description: Option<&str>) -> Result<BacklogItem, TriageError>;
    pub fn get(&self, id: &str) -> Result<Option<BacklogItem>, TriageError>;
    pub fn list_by_type(&self, kind: IntentKind) -> Result<Vec<BacklogItem>, TriageError>;
    pub fn list_by_feature(&self, feature_slug: &str) -> Result<Vec<BacklogItem>, TriageError>;
    pub fn promote_to_feature(&self, id: &str, feature_slug: &str) -> Result<BacklogItem, TriageError>;
    pub fn close(&self, id: &str) -> Result<(), TriageError>;
}
```

**Implementation notes**:

- Use `uuid::Uuid::new_v4().to_string()` for IDs. Add `uuid` with feature `v4` to `Cargo.toml`.
- `created_at` and `updated_at` use `chrono::Utc::now().to_rfc3339()`.
- `promote_to_feature` sets `state = Promoted` and `feature_slug = ?`, and updates `updated_at`. It returns the updated item.
- All SQL queries are prepared statements; no string interpolation of user data.
- Define `TriageError` in `lib.rs` using `thiserror`:

  ```rust
  #[derive(Debug, thiserror::Error)]
  pub enum TriageError {
      #[error("storage error: {0}")]
      Storage(#[from] agileplus_storage::StorageError),
      #[error("item not found: {0}")]
      NotFound(String),
      #[error("io error: {0}")]
      Io(#[from] std::io::Error),
  }
  ```

---

### T100 — classifier.rs — detailed classification rules

**File**: `crates/agileplus-triage/src/classifier.rs`

**Purpose**: Implement the rule-based classification engine. Classification is case-insensitive, operates on the lowercased input, and evaluates rules in priority order: Bug → Feature → Task → Idea. If no rule matches, default to `IntentKind::Task`.

**Keyword constants**:

```rust
const BUG_KEYWORDS: &[&str] = &[
    "error", "exception", "crash", "panic", "broken", "fails", "failure",
    "regression", "stack trace", "traceback", "segfault", "null pointer",
    "unexpected", "incorrect", "wrong output", "not working", "doesn't work",
];

const FEATURE_KEYWORDS: &[&str] = &[
    "add", "new", "implement", "build", "create", "introduce", "should be able",
    "support", "enable", "allow", "feature request", "enhancement", "improve",
    "extend", "integrate",
];

const IDEA_KEYWORDS: &[&str] = &[
    "could", "maybe", "what if", "consider", "explore", "brainstorm",
    "might", "potentially", "proposal", "experiment", "investigate",
    "would it be possible", "thinking about",
];

const TASK_KEYWORDS: &[&str] = &[
    "update", "change", "refactor", "rename", "move", "delete", "remove",
    "fix test", "clean up", "document", "migrate", "bump", "upgrade",
    "configure", "set up", "todo", "chore",
];
```

**Pattern rules** (applied before keyword scan):

- If input contains a stack trace pattern (lines starting with `at ` or `File "`, or contains `Traceback (most recent call last)`) → `Bug`.
- If input matches `^\s*(fix|fixes|fixed)\s+#\d+` (case-insensitive regex) → `Bug`.
- If input matches `^\s*(feat|feature)(\(.+\))?:` (conventional commit prefix) → `Feature`.
- If input matches `^\s*(chore|refactor|docs|style|test|ci)(\(.+\))?:` → `Task`.

**Scoring approach** (secondary, used when no pattern matches):

Count keyword hits per category. Whichever category has the highest hit count wins. Ties broken by the priority order above.

**`ClassifierConfig`**:

```rust
pub struct ClassifierConfig {
    pub bug_keywords: Vec<String>,
    pub feature_keywords: Vec<String>,
    pub idea_keywords: Vec<String>,
    pub task_keywords: Vec<String>,
}

impl Default for ClassifierConfig {
    fn default() -> Self {
        Self {
            bug_keywords: BUG_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            feature_keywords: FEATURE_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            idea_keywords: IDEA_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            task_keywords: TASK_KEYWORDS.iter().map(|s| s.to_string()).collect(),
        }
    }
}
```

**`Classifier` struct**:

```rust
pub struct Classifier {
    config: ClassifierConfig,
}

impl Classifier {
    pub fn new(config: ClassifierConfig) -> Self { ... }
}

impl Classify for Classifier {
    fn classify(&self, input: &str) -> IntentKind { ... }
}
```

The `classify` method:
1. Lowercase and trim the input.
2. Apply pattern rules (regex). Return immediately on match.
3. Count keyword hits per category.
4. Return the winning category, or `IntentKind::Task` as default.

Use `once_cell::sync::Lazy` for compiled regexes to avoid recompiling on every call. Add `once_cell` and `regex` to `Cargo.toml`.

---

### T101 — router.rs — CLAUDE.md generation

**File**: `crates/agileplus-triage/src/router.rs`

**Purpose**: Generate a `CLAUDE.md` file for the project root (or a specified directory). This file gives a downstream LLM agent the context it needs to route new inputs correctly.

**`RouterGenerator` struct**:

```rust
pub struct RouterGenerator {
    config: ProjectConfig,
    output_dir: PathBuf,
}

impl RouterGenerator {
    pub fn new(config: ProjectConfig, output_dir: PathBuf) -> Self;
    pub fn write_claude_md(&self) -> Result<PathBuf, TriageError>;
    pub fn write_agents_md(&self) -> Result<PathBuf, TriageError>;
}
```

**`write_claude_md` template** (use a `format!` or a simple template string; do not pull in a template engine dependency unless one is already in the workspace):

```
# {project_name} — Agent Routing Guide

## Project Context

- **Slug**: {project_slug}
- **Phase**: {current_phase}
- **Generated**: {timestamp}

## Available Commands

{command_list}

## Routing Rules

When you receive a new input from the user, classify it and route as follows:

| Intent | Action |
|--------|--------|
| Bug    | Run `agileplus triage --kind bug "<description>"` to create a backlog bug item, then optionally run `agileplus github sync` to push to GitHub Issues. |
| Feature | Run `agileplus specify --from-triage <id>` to promote the backlog item into a feature spec. |
| Idea   | Run `agileplus triage --kind idea "<description>"` to store the idea in the backlog for later review. |
| Task   | Run `agileplus triage --kind task "<description>"` or handle inline if the task is a quick fix (< 30 min estimated). |

## Quick-Fix Escape Hatch

If the input is clearly a small self-contained change (rename, single-line fix, config tweak), you may use:

```
agileplus escape quick-fix "<description>"
```

This bypasses the triage flow and creates a minimal WP directly in the active feature.

## Conventions

- All commits must use Conventional Commits format.
- PRs must reference a WP ID in the title (e.g., `feat(WP17): implement triage adapter`).
- Do not modify files outside the active feature's work package scope without explicit user approval.
```

Replace `{project_name}`, `{project_slug}`, `{current_phase}`, `{timestamp}`, and `{command_list}` from `ProjectConfig` fields. `{command_list}` is a bullet list built from `ProjectConfig::available_commands`.

Write to `{output_dir}/CLAUDE.md`. Return the written path. If the file already exists, overwrite it (do not prompt; this is a generator, not an editor).

---

### T102 — AGENTS.md generation

**File**: `crates/agileplus-triage/src/router.rs` (same file as T101, additional method)

**Purpose**: Generate `AGENTS.md` encoding agent behavioral rules and sub-command vocabulary.

**`write_agents_md` template**:

```
# {project_name} — Agent Behavioral Rules

## Sub-Command Vocabulary

| Command | Description |
|---------|-------------|
| `agileplus triage` | Classify and store an input as a backlog item |
| `agileplus specify` | Generate a feature spec from a backlog item or raw description |
| `agileplus implement` | Begin implementation of a work package |
| `agileplus sync plane` | Push feature/WP state to Plane.so |
| `agileplus sync github` | Push bug backlog items to GitHub Issues |
| `agileplus escape quick-fix` | Bypass triage for single-task quick fixes |
| `agileplus dashboard` | Show current feature, WP, and backlog state |

## Behavioral Rules

1. **Auto-triage bugs**: If you encounter an error, exception, or test failure during implementation, immediately run `agileplus triage --kind bug` with the error message before attempting a fix. Do not silently swallow errors.

2. **Follow CI/CD defaults**: After each WP implementation, run the workspace test suite (`cargo test --workspace`) and linter (`cargo clippy -- -D warnings`). Do not mark a WP as `done` if either fails.

3. **Conventional commits**: All commits must follow the pattern `<type>(<scope>): <description>`. Valid types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`. Scope is the WP ID (e.g., `WP17`).

4. **Scope discipline**: Only modify files within the active WP's designated file list. If a change outside that scope is required, create a new backlog task item and pause for user approval before proceeding.

5. **No silent rewrites**: If you find a bug in code outside the active WP scope, log it with `agileplus triage --kind bug` and do not fix it in the current WP.

6. **Sync after state changes**: After promoting a backlog item to a feature, run `agileplus sync plane` to keep Plane.so in sync.

## Review Checkpoints

- After T098 (repo init): run `cargo build --workspace` in `agileplus-integrations` to confirm skeleton compiles.
- After T098b–T100 (classifier + backlog): run `cargo test -p agileplus-triage` and review classification accuracy report.
- After T101–T102 (router generation): manually inspect generated `CLAUDE.md` and `AGENTS.md` for correctness before committing.
- After T102b (gRPC service): start the binary and confirm `grpc.health.v1.Health/Check` returns `SERVING`.
- After T103 (all tests pass): run full workspace test suite, then submit WP17 for review.

## Activity Log Format

Each significant agent action should be logged to the WP prompt file's `history` block using the format:

```yaml
- timestamp: '<ISO8601>'
  lane: <current_lane>
  agent: <agent_id>
  shell_pid: '<pid>'
  action: <description>
```
```

Write to `{output_dir}/AGENTS.md`. Return the written path. Overwrite if exists.

---

### T102b — `agileplus-integrations-service` gRPC server

**Files**: `crates/agileplus-integrations-service/src/main.rs`, `crates/agileplus-integrations-service/src/triage_grpc.rs`

**Purpose**: Implement the gRPC server binary that exposes the triage functionality over the network by implementing `IntegrationsService` from `integrations.proto`. This service is the network boundary between the rest of the AgilePlus system and the integrations layer.

**Steps**:

1. Add `tonic`, `tonic-health`, `tokio` (with `full` feature), and `prost` to `crates/agileplus-integrations-service/Cargo.toml`. Add `agileplus-triage` as a path dependency.

2. Add a `build.rs` that invokes `tonic_build::compile_protos("../../proto/integrations.proto")` so protobuf stubs are generated at compile time.

3. In `triage_grpc.rs`, define a `TriageServiceImpl` struct that holds an `Arc<TriageAdapter>` and implements the `IntegrationsService` tonic trait. At minimum implement:
   - `ClassifyInput` RPC: calls `TriageAdapter::classify()` and returns the `IntentKind` as a protobuf enum.
   - `CreateBacklogItem` RPC: calls `BacklogAdapter::create()` and returns the created item as a protobuf message.
   - `ListBacklogItems` RPC: calls `BacklogAdapter::list_by_type()` or `list_by_feature()` based on the request filter field.

4. In `main.rs`:
   - Parse `--port` (default `50052`) from CLI args or environment variable `INTEGRATIONS_PORT`.
   - Register `TriageServiceImpl` with tonic's `Server`.
   - Register `tonic_health::server::HealthReporter` and set the service status to `Serving` after startup.
   - Log the listening address to stdout.

5. **gRPC communication with core for state reads**: When a triage RPC handler needs current project state (active feature slug, current phase), it must call the core AgilePlus gRPC service (address from `AGILEPLUS_CORE_ADDR` env var, default `http://localhost:50051`) using the generated client stub from the proto submodule. It must not import Rust crates from the core mono-repo.

**Acceptance**:
- `cargo build -p agileplus-integrations-service` exits 0.
- Running the binary and issuing `grpc_health_probe -addr=:50052` (or equivalent `grpc.health.v1.Health/Check` call) returns `SERVING`.

---

### T103 — Unit and Integration Tests

**File**: `crates/agileplus-triage/tests/integration.rs` (integration tests) and inline `#[cfg(test)]` blocks in each source file.

**Classification accuracy tests** (inline in `classifier.rs`):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn classifier() -> Classifier {
        Classifier::new(ClassifierConfig::default())
    }

    // Bug detection — 5 examples
    #[test]
    fn classifies_error_keyword() { assert_eq!(classifier().classify("got an error on startup"), IntentKind::Bug); }
    #[test]
    fn classifies_crash() { assert_eq!(classifier().classify("the app crashes when I click save"), IntentKind::Bug); }
    #[test]
    fn classifies_stack_trace() { assert_eq!(classifier().classify("Traceback (most recent call last):\n  File foo.py"), IntentKind::Bug); }
    #[test]
    fn classifies_broken() { assert_eq!(classifier().classify("login is broken after the last deploy"), IntentKind::Bug); }
    #[test]
    fn classifies_fix_issue_ref() { assert_eq!(classifier().classify("fix #42 regression in parser"), IntentKind::Bug); }

    // Feature detection — 5 examples
    #[test]
    fn classifies_add_new() { assert_eq!(classifier().classify("add a new export button to the dashboard"), IntentKind::Feature); }
    #[test]
    fn classifies_implement() { assert_eq!(classifier().classify("implement OAuth2 login"), IntentKind::Feature); }
    #[test]
    fn classifies_feature_prefix() { assert_eq!(classifier().classify("feat(auth): support PKCE flow"), IntentKind::Feature); }
    #[test]
    fn classifies_should_be_able() { assert_eq!(classifier().classify("users should be able to export as CSV"), IntentKind::Feature); }
    #[test]
    fn classifies_integrate() { assert_eq!(classifier().classify("integrate with Stripe for payments"), IntentKind::Feature); }

    // Idea detection — 5 examples
    #[test]
    fn classifies_could() { assert_eq!(classifier().classify("we could add a dark mode someday"), IntentKind::Idea); }
    #[test]
    fn classifies_what_if() { assert_eq!(classifier().classify("what if we used WebSockets instead?"), IntentKind::Idea); }
    #[test]
    fn classifies_maybe() { assert_eq!(classifier().classify("maybe support plugins in the future"), IntentKind::Idea); }
    #[test]
    fn classifies_explore() { assert_eq!(classifier().classify("explore using WASM for the renderer"), IntentKind::Idea); }
    #[test]
    fn classifies_brainstorm() { assert_eq!(classifier().classify("brainstorm alternatives to the current queue design"), IntentKind::Idea); }

    // Task detection — 5 examples
    #[test]
    fn classifies_refactor() { assert_eq!(classifier().classify("refactor the auth module to reduce duplication"), IntentKind::Task); }
    #[test]
    fn classifies_rename() { assert_eq!(classifier().classify("rename UserRecord to UserProfile everywhere"), IntentKind::Task); }
    #[test]
    fn classifies_chore_prefix() { assert_eq!(classifier().classify("chore: bump serde to 1.0.200"), IntentKind::Task); }
    #[test]
    fn classifies_update_docs() { assert_eq!(classifier().classify("document the StoragePort trait"), IntentKind::Task); }
    #[test]
    fn classifies_migrate() { assert_eq!(classifier().classify("migrate from diesel to sqlx"), IntentKind::Task); }
}
```

**BacklogItem CRUD tests** (inline in `backlog.rs`):

Test `create`, `get`, `list_by_type`, `list_by_feature`, `promote_to_feature`, and `close` using an in-memory SQLite database (`:memory:` connection). Verify:
- Created item has correct `kind`, `state = Open`, non-empty `id`.
- `list_by_type` returns only items of the specified kind.
- `list_by_feature` returns only items with the given slug.
- `promote_to_feature` sets `state = Promoted` and `feature_slug`, and updates `updated_at`.
- `close` sets `state = Closed`.

**Router output validation** (inline in `router.rs`):

Use `tempfile::TempDir` to write to a temp directory. Assert:
- `CLAUDE.md` exists and contains the project name, slug, and all routing-rule table rows.
- `AGENTS.md` exists and contains all seven command rows and all five behavioral rules.

Add `tempfile` as a dev-dependency.

---
- 2026-02-28T13:20:44Z – claude-opus – shell_pid=3392 – lane=doing – Assigned agent via workflow command
- 2026-02-28T13:25:04Z – claude-opus – shell_pid=3392 – lane=for_review – Triage crate complete: classifier, backlog, router. 17 tests pass.
- 2026-02-28T23:21:19Z – claude-opus – shell_pid=78007 – lane=doing – Started review via workflow command
- 2026-02-28T23:21:54Z – claude-opus – shell_pid=78007 – lane=done – Review passed: 17 tests pass

## Validation Criteria

| Criterion | Pass Condition |
|-----------|----------------|
| Workspace init | `cargo build --workspace` in `agileplus-integrations` exits 0 after `git submodule update --init` (T098) |
| Compilation | `cargo build -p agileplus-triage` exits 0 |
| Lint | `cargo clippy --workspace -- -D warnings` exits 0 |
| Unit tests | `cargo test -p agileplus-triage` all pass; 20 classification tests, 6 CRUD tests, 2 router tests |
| Classification accuracy | Each of the 4 categories has at least 5 tests, all passing |
| Schema | `backlog_items` table created by `ensure_schema()` on fresh DB |
| Router files | `write_claude_md` and `write_agents_md` produce non-empty files containing required keywords |
| Public API stability | No breaking changes to the 7 public function signatures listed in Context |
| gRPC service health | `grpc.health.v1.Health/Check` against `agileplus-integrations-service` returns `SERVING` (T102b) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Classifier accuracy degrades on ambiguous input (e.g., "fix the feature") | Medium | Low | Priority order (Bug > Feature > Task > Idea) handles most ambiguity; unit tests document expected behavior; LLM fallback planned for Phase 6 |
| `StoragePort` trait changes in WP05 patch break CRUD | Low | High | Pin to WP05's committed trait version; use integration tests against actual trait, not mocks |
| Router-generated `CLAUDE.md` conflicts with manually maintained project `CLAUDE.md` | Medium | Medium | Generator always overwrites; communicate this clearly in `AGENTS.md` behavioral rules; consider backup-before-write strategy |
| `uuid` crate v4 feature flag missing from `Cargo.toml` | Low | High | Validate `Cargo.toml` in T098 before writing any other code |
| Regex compilation overhead in hot path | Low | Low | Use `once_cell::sync::Lazy<Regex>` for all compiled patterns |

---

## Review Guidance

The reviewer should:

1. Run `cargo build --workspace` in `agileplus-integrations` (after `git submodule update --init`) and confirm exit 0.
2. Run `cargo test -p agileplus-triage -v` and confirm all 28+ tests pass.
3. Inspect `crates/agileplus-triage/src/classifier.rs` keyword lists for obvious omissions or misclassifications.
4. Verify the `backlog_items` migration does not alter any existing table.
5. Manually inspect the generated `CLAUDE.md` and `AGENTS.md` against the templates in T101/T102 to ensure no placeholders are left unreplaced.
6. Confirm the `Classify` trait is defined and `Classifier` implements it, enabling future LLM-based classifiers.
7. Check that no public function signature deviates from the list in the Context section.
8. Confirm `TriageError` uses `thiserror` and covers all three error variants.
9. Start `agileplus-integrations-service` and confirm `grpc.health.v1.Health/Check` returns `SERVING` (T102b acceptance criterion).

---

## Activity Log

```yaml
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
```
