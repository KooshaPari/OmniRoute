---
work_package_id: WP11
title: CLI -- Specify & Research Commands
lane: "done"
dependencies:
- WP06
base_branch: 001-spec-driven-development-engine-WP06
base_commit: e627e77adc288140b9001f8ed3ca17495d1bdaf5
created_at: '2026-02-28T09:52:05.224823+00:00'
subtasks:
- T060
- T061
- T062
- T063
- T064
- T065
phase: Phase 3 - CLI
assignee: ''
agent: "claude-wp11"
shell_pid: "81185"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP11 -- CLI -- Specify & Research Commands

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately (right below this notice).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Mark as acknowledged**: When you understand the feedback and begin addressing it, update `review_status: acknowledged` in the frontmatter.
- **Report progress**: As you address each feedback item, update the Activity Log explaining what you changed.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes. Implementation must address every item listed below before returning for re-review.

*[This section is empty initially. Reviewers will populate it if the work is returned from review. If you see feedback here, treat each item as a must-do before completion.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP11 --base WP10
```

---

## Objectives & Success Criteria

1. **CLI binary** (`agileplus`) starts in under 50ms, parses subcommands and global flags via clap, and routes to the correct command handler.
2. **`agileplus specify`** runs a guided discovery interview on the terminal, generates a `spec.md` file, persists the Feature record in SQLite, commits the spec to git under `kitty-specs/<slug>/spec.md`, and logs an audit entry for the `created -> specified` state transition.
3. **`agileplus research`** operates in two modes:
   - **Pre-specify** (no spec exists): scans the codebase and produces research artifacts to inform specification.
   - **Post-specify** (spec exists): performs feasibility analysis against the spec and produces `research.md`.
4. **Implicit refinement** (FR-008): when `specify` is re-run on an existing feature, the system detects changes, diffs the old and new spec, logs the revision in the audit trail, and updates the spec hash.
5. **Governance checks** (FR-009): planning commands load the constitution (if present), validate consistency of the spec against project rules, and surface violations before proceeding.
6. **Dependency injection**: all commands receive their port implementations (StoragePort, VcsPort, ObservabilityPort) via constructor injection, not global singletons.
7. `cargo test -p agileplus-cli` passes. `cargo build -p agileplus-cli` produces a working binary.

---

## Context & Constraints

### Prerequisite Work
- **WP06 (SQLite Adapter)**: provides the `SqliteStorageAdapter` implementing `StoragePort` for feature/audit persistence.
- **WP07 (Git Adapter)**: provides the `GitVcsAdapter` implementing `VcsPort` for committing spec files and reading artifacts.
- **WP10 (Telemetry Adapter)**: provides the `TelemetryAdapter` implementing `ObservabilityPort` for span creation and logging.

### Key References
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- FR-001 (specify), FR-002 (research), FR-008 (refinement), FR-009 (governance checks)
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- CLI crate structure, clap derive macros, discovery interview design
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- Feature entity (slug, state, spec_hash), AuditEntry entity, state transitions

### Architectural Constraints
- The CLI crate depends on `agileplus-core` (domain + ports) and all adapter crates. It is the composition root.
- Use clap derive macros for argument parsing. Global flags: `--verbose`, `--config <path>`, `--feature <slug>`.
- All commands must create a telemetry span and record duration as a metric.
- The CLI must not use `unwrap()` or `expect()` in production paths. All errors surface as user-friendly messages via `miette` or `anyhow` with context.
- Discovery interview uses `dialoguer` for structured prompts. The interview must be interruptible (Ctrl+C saves partial progress).

### Crate Dependencies
```toml
[dependencies]
agileplus-core = { path = "../agileplus-core" }
agileplus-sqlite = { path = "../agileplus-sqlite" }
agileplus-git = { path = "../agileplus-git" }
agileplus-telemetry = { path = "../agileplus-telemetry" }
clap = { version = "4", features = ["derive"] }
tokio = { workspace = true, features = ["full"] }
dialoguer = "0.11"
miette = { version = "7", features = ["fancy"] }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
sha2 = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }

[dev-dependencies]
assert_cmd = "2"
predicates = "3"
tempfile = "3"
```

---

## Subtasks & Detailed Guidance

### Subtask T060 -- Create `main.rs` with clap App, global flags, subcommand routing

- **Purpose**: Establish the CLI entry point that parses arguments, initializes adapters, and routes to the appropriate command handler.
- **Steps**:
  1. Create `crates/agileplus-cli/src/main.rs`.
  2. Define the top-level clap App using derive macros:
     ```rust
     #[derive(Parser)]
     #[command(name = "agileplus", version, about = "Spec-driven development engine")]
     struct Cli {
         #[command(subcommand)]
         command: Commands,

         /// Increase verbosity (-v, -vv, -vvv)
         #[arg(short, long, action = clap::ArgAction::Count, global = true)]
         verbose: u8,

         /// Path to config file
         #[arg(long, global = true, default_value = "~/.agileplus/config.toml")]
         config: PathBuf,
     }

     #[derive(Subcommand)]
     enum Commands {
         Specify(SpecifyArgs),
         Research(ResearchArgs),
         // Plan, Implement, Validate, Ship, Retrospective added in WP12/WP13
     }
     ```
  3. Define `SpecifyArgs` and `ResearchArgs`:
     ```rust
     #[derive(Args)]
     struct SpecifyArgs {
         /// Feature slug (kebab-case, e.g., 001-my-feature)
         #[arg(long)]
         feature: Option<String>,

         /// Skip interactive interview, use provided spec file
         #[arg(long)]
         from_file: Option<PathBuf>,

         /// Target branch for eventual merge
         #[arg(long, default_value = "main")]
         target_branch: String,
     }

     #[derive(Args)]
     struct ResearchArgs {
         /// Feature slug to research
         #[arg(long)]
         feature: String,

         /// Research mode override
         #[arg(long, value_enum)]
         mode: Option<ResearchMode>,
     }
     ```
  4. In `main()`:
     - Parse args with `Cli::parse()`.
     - Load telemetry config and initialize `TelemetryAdapter`.
     - Map verbosity to log level: 0=info, 1=debug, 2=trace.
     - Initialize `SqliteStorageAdapter` (open/create DB at `~/.agileplus/agileplus.db`).
     - Initialize `GitVcsAdapter` (detect git repo from cwd).
     - Create a top-level telemetry span for the command.
     - Route to command handler, passing adapter references.
     - On error, print user-friendly message and exit with code 1.
     - On success, flush telemetry and exit with code 0.
  5. Create `crates/agileplus-cli/src/commands/mod.rs` declaring submodules.
- **Files**:
  - `crates/agileplus-cli/src/main.rs`
  - `crates/agileplus-cli/src/commands/mod.rs`
  - `crates/agileplus-cli/Cargo.toml` (update)
- **Parallel?**: No -- foundation for T061-T065.
- **Notes**:
  - The adapter initialization order matters: telemetry first (so other adapters can log), then storage, then VCS.
  - If the git repo is not found, commands that need VCS should error early with a clear message: "Not inside a git repository. Run agileplus from your project root."
  - SQLite DB is created automatically on first run. Migrations run on open.

### Subtask T061 -- Implement `commands/specify.rs`: Discovery interview and spec generation

- **Purpose**: Implement the specify command that guides the user through a structured interview to produce a specification document, persists it in both git and SQLite, and records the state transition in the audit trail.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/specify.rs`.
  2. Define the discovery interview structure. The interview collects:
     - Feature name (friendly name, auto-generates slug)
     - Problem statement ("What problem does this solve?")
     - Target users ("Who benefits from this?")
     - Functional requirements (iterative: "Add another FR? [y/n]")
     - Non-functional requirements (performance, security, reliability)
     - Constraints and dependencies
     - Acceptance criteria
  3. Implement `run_specify(args: SpecifyArgs, storage: &dyn StoragePort, vcs: &dyn VcsPort, telemetry: &dyn ObservabilityPort) -> Result<()>`:
     - Check if feature already exists (by slug). If yes, enter refinement mode (T063).
     - If `--from-file` provided, read spec from file instead of interview.
     - Otherwise, run the discovery interview using `dialoguer`:
       - `Input::new().with_prompt("Feature name").interact_text()?`
       - `Editor::new().edit("Describe the problem this feature solves...")?` for long-form text
       - `Confirm::new().with_prompt("Add another functional requirement?").interact()?` for iterative collection
     - Generate `spec.md` from collected answers using a Markdown template.
     - Compute SHA-256 hash of the generated spec content.
     - Create the Feature record via `storage.create_feature(slug, name, spec_hash, target_branch)`.
     - Write spec to git: `vcs.write_artifact(slug, "spec.md", content)`.
     - Commit via VCS: `vcs.commit(slug, "specify: create spec for {slug}")`.
     - Append audit entry: `storage.append_audit(feature_id, "user", "created -> specified", [])`.
     - Record metric: command duration.
     - Print summary: "Feature {slug} specified. Spec written to kitty-specs/{slug}/spec.md".
  4. Implement the Markdown template for spec generation:
     ```markdown
     # Specification: {friendly_name}
     **Slug**: {slug} | **Date**: {date} | **State**: specified

     ## Problem Statement
     {problem_statement}

     ## Target Users
     {target_users}

     ## Functional Requirements
     {for each fr: "- **FR-{n}**: {description}"}

     ## Non-Functional Requirements
     {nfrs}

     ## Constraints & Dependencies
     {constraints}

     ## Acceptance Criteria
     {criteria}
     ```
  5. Handle Ctrl+C during interview: catch the interrupt, save partial answers to a temp file, print "Partial spec saved to {path}. Resume with --from-file {path}".
- **Files**: `crates/agileplus-cli/src/commands/specify.rs`
- **Parallel?**: Yes, independent of T062 after T060.
- **Notes**:
  - Slug generation: lowercase the friendly name, replace spaces with hyphens, prepend a zero-padded sequence number from SQLite (next feature ID).
  - The `Editor` prompt opens the user's `$EDITOR` for long-form input. Fall back to multi-line stdin if `$EDITOR` is unset.
  - The spec template is intentionally simple. Future WPs may add richer templates.

### Subtask T062 -- Implement `commands/research.rs`: Pre-specify and post-specify research modes

- **Purpose**: Implement the research command with two modes: codebase scanning (pre-specify) and feasibility analysis (post-specify), producing research artifacts stored in git.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/research.rs`.
  2. Implement `run_research(args: ResearchArgs, storage: &dyn StoragePort, vcs: &dyn VcsPort, telemetry: &dyn ObservabilityPort) -> Result<()>`:
     - Look up feature by slug. Determine mode:
       - If feature does not exist or state is `created`: pre-specify mode.
       - If feature exists and state is `specified`: post-specify mode.
       - If `--mode` is provided, override auto-detection.
     - Route to `research_pre_specify()` or `research_post_specify()`.
  3. Implement `research_pre_specify(slug, vcs, storage) -> Result<()>`:
     - Scan the repository for relevant context:
       - Read directory structure via VCS (top-level layout).
       - Look for existing specs, READMEs, package manifests.
       - Identify language/framework from file extensions and config files.
     - Generate a `research.md` with codebase analysis:
       ```markdown
       # Research: {slug} (Pre-Specify)
       **Date**: {date} | **Mode**: codebase-scan

       ## Repository Overview
       {directory_structure}

       ## Detected Technologies
       {languages_and_frameworks}

       ## Existing Specifications
       {list of spec files found}

       ## Recommended Investigation Areas
       {suggestions based on codebase}
       ```
     - Write to `kitty-specs/{slug}/research.md` via VCS.
     - No state transition (feature may not exist yet).
  4. Implement `research_post_specify(feature, vcs, storage) -> Result<()>`:
     - Read the existing `spec.md` via VCS.
     - Analyze feasibility:
       - Check for referenced files/modules that already exist.
       - Identify potential conflicts with existing code.
       - Estimate scope based on FR count and file references.
     - Generate a `research.md` with feasibility analysis:
       ```markdown
       # Research: {slug} (Post-Specify)
       **Date**: {date} | **Mode**: feasibility

       ## Spec Summary
       {fr_count} functional requirements, {nfr_count} non-functional

       ## Existing Code Analysis
       {files that already exist and may be affected}

       ## Feasibility Assessment
       {scope estimate, risk areas}

       ## Recommended Approach
       {suggestions for plan phase}
       ```
     - Transition feature state: `specified -> researched`.
     - Append audit entry for the transition.
     - Record command metric.
  5. Print summary with path to generated research.md.
- **Files**: `crates/agileplus-cli/src/commands/research.rs`
- **Parallel?**: Yes, independent of T061 after T060.
- **Notes**:
  - The pre-specify mode is lightweight and does not require a Feature record in SQLite. It is a discovery tool.
  - The post-specify mode performs a real state transition and must comply with governance checks (T064).
  - Codebase scanning should be fast (under 2 seconds). Do not read file contents -- just list paths and detect patterns.

### Subtask T063 -- Implement implicit refinement: re-run detection, diffing, revision logging

- **Purpose**: When `specify` is re-run on an existing feature, detect changes between the old and new spec, log the revision in the audit trail, and update the spec hash.
- **Steps**:
  1. Add refinement logic to `commands/specify.rs` (integrated into `run_specify`).
  2. Detection: when `storage.get_feature_by_slug(slug)` returns an existing feature, enter refinement mode.
  3. Read the existing spec from git: `vcs.read_artifact(slug, "spec.md")`.
  4. Run the interview (or read from file) to produce the new spec content.
  5. Diff the old and new spec:
     - Compute a simple line-by-line diff (use `similar` crate or implement basic unified diff).
     - Identify added, removed, and changed sections.
     - Generate a diff summary string.
  6. If no changes detected, print "No changes to spec for {slug}" and exit early.
  7. If changes detected:
     - Compute new spec hash.
     - Update the Feature record: `storage.update_feature_spec_hash(feature_id, new_hash)`.
     - Write updated spec to git.
     - Commit with message: "specify: revise spec for {slug}".
     - Append audit entry with evidence referencing the diff:
       - `actor: "user"`
       - `transition: "specified -> specified (revision)"`
       - `evidence_refs: [{"type": "spec_diff", "summary": "..."}]`
     - Print summary: "Spec for {slug} updated. {n} sections changed."
  8. Store the diff as an evidence artifact: `kitty-specs/{slug}/evidence/spec-revisions/rev-{n}.diff`.
- **Files**: `crates/agileplus-cli/src/commands/specify.rs` (extend)
- **Parallel?**: No -- depends on T061.
- **Notes**:
  - The `similar` crate provides good text diffing. Add it as a dependency if needed.
  - Revision numbering: count existing revision diffs in the evidence directory.
  - The state does not change on refinement (remains `specified`). Only the spec_hash and audit trail update.
  - Guard against accidental refinement: prompt "Feature {slug} already has a spec. Revise? [y/n]" unless `--force` flag is passed.

### Subtask T064 -- Implement governance checks within planning commands

- **Purpose**: Load the project constitution (if present), validate spec consistency against governance rules, and surface violations before proceeding with state transitions.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/governance.rs` as a shared utility module.
  2. Implement `load_constitution(vcs: &dyn VcsPort) -> Result<Option<Constitution>>`:
     - Look for `.kittify/memory/constitution.md` or `~/.agileplus/constitution.md`.
     - Parse constitution into a `Constitution` struct with rules.
     - Return `None` if no constitution file exists (governance is optional).
  3. Implement `validate_spec_consistency(spec_content: &str, constitution: &Constitution) -> Vec<Violation>`:
     - Check naming conventions (slug format matches pattern).
     - Check required sections are present in spec.md (Problem Statement, FRs, Acceptance Criteria).
     - Check FR numbering is sequential.
     - Check for duplicate FR descriptions.
     - Return a list of violations (severity: error, warning, info).
  4. Implement `enforce_governance(violations: &[Violation]) -> Result<()>`:
     - If any `error` severity violations exist, print them and return `Err`.
     - If only `warning` violations, print them and prompt "Continue with warnings? [y/n]".
     - If only `info`, print them and proceed.
  5. Wire governance checks into `specify` (after spec generation, before persistence) and `research` (before state transition in post-specify mode).
  6. Define violation types:
     ```rust
     pub struct Violation {
         pub rule: String,
         pub severity: ViolationSeverity,
         pub message: String,
         pub location: Option<String>,  // line number or section name
     }

     pub enum ViolationSeverity {
         Error,
         Warning,
         Info,
     }
     ```
- **Files**: `crates/agileplus-cli/src/commands/governance.rs`
- **Parallel?**: No -- must integrate with T061 and T062.
- **Notes**:
  - Governance is optional. If no constitution exists, skip all checks silently.
  - The constitution format is not fully defined yet. Start with basic structural checks (required sections, naming) and leave policy rule evaluation for WP13.
  - Governance violations logged to audit trail as well: append an entry with the violation list as evidence.

### Subtask T065 -- Wire specify/research to ports via dependency injection

- **Purpose**: Set up the dependency injection wiring in `main.rs` that constructs concrete adapter instances and passes them to command handlers as trait objects.
- **Steps**:
  1. In `main.rs`, create an `AppContext` struct that holds all port implementations:
     ```rust
     struct AppContext {
         storage: Box<dyn StoragePort>,
         vcs: Box<dyn VcsPort>,
         telemetry: Box<dyn ObservabilityPort>,
     }
     ```
  2. Implement `AppContext::init(config: &AppConfig) -> Result<Self>`:
     - Open SQLite DB: `SqliteStorageAdapter::open(&config.db_path)?`
     - Open git repo: `GitVcsAdapter::open_from_cwd()?`
     - Init telemetry: `TelemetryAdapter::new(telemetry_config)?`
     - Return context with all adapters boxed as trait objects.
  3. Update command handlers to accept `&AppContext` instead of individual adapters:
     ```rust
     pub async fn run_specify(args: SpecifyArgs, ctx: &AppContext) -> Result<()> {
         // Use ctx.storage, ctx.vcs, ctx.telemetry
     }
     ```
  4. In `main()`, create context once, pass to command handler:
     ```rust
     let ctx = AppContext::init(&config)?;
     match cli.command {
         Commands::Specify(args) => commands::specify::run_specify(args, &ctx).await?,
         Commands::Research(args) => commands::research::run_research(args, &ctx).await?,
     }
     ```
  5. Implement graceful shutdown: `ctx.telemetry.flush()` before exit.
  6. For testing, create a `TestContext` with mock implementations:
     ```rust
     #[cfg(test)]
     impl AppContext {
         pub fn test() -> Self {
             Self {
                 storage: Box::new(MockStoragePort::new()),
                 vcs: Box::new(MockVcsPort::new()),
                 telemetry: Box::new(TelemetryAdapter::noop()),
             }
         }
     }
     ```
- **Files**:
  - `crates/agileplus-cli/src/main.rs` (extend)
  - `crates/agileplus-cli/src/context.rs` (new, if extracted)
- **Parallel?**: No -- depends on T060-T064.
- **Notes**:
  - The `Box<dyn Port>` approach is the simplest DI pattern in Rust. For performance-critical paths, consider generics with monomorphization, but trait objects are fine for CLI startup.
  - The `TestContext` enables unit testing of command handlers without real file I/O or database.
  - Consider using `Arc<dyn Port>` instead of `Box` if handlers need to clone the context for async tasks.

---

## Test Strategy

### Unit Tests
- Location: `crates/agileplus-cli/tests/`
- Run: `cargo test -p agileplus-cli`

### CLI Integration Tests (using `assert_cmd`)
- Test `agileplus --help` prints usage.
- Test `agileplus specify --from-file fixtures/sample-spec.md --feature test-001` creates a feature.
- Test `agileplus research --feature test-001` produces research.md.
- Test re-running specify detects changes and logs revision.

### Mock-Based Unit Tests
- Test command handlers with mock ports (MockStoragePort, MockVcsPort).
- Test governance checks with known violations.
- Test refinement diffing with fixture specs.

### Fixtures
- `tests/fixtures/sample-spec.md` -- a complete spec file for non-interactive testing.
- `tests/fixtures/sample-spec-revised.md` -- a modified version for refinement testing.
- `tests/fixtures/constitution.md` -- a sample constitution with rules.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Interactive CLI complexity | Hard to test, flaky prompts | `--from-file` flag for non-interactive mode; `assert_cmd` for CLI tests |
| `dialoguer` terminal compatibility | Breaks in non-TTY environments (CI, agents) | Detect TTY, require `--from-file` in non-interactive mode |
| Ctrl+C during interview loses work | User frustration | Catch SIGINT, save partial state to temp file |
| SQLite migration failures on upgrade | Data loss or corruption | Backup DB before migration, test up/down migrations |
| Git repo detection failures | Commands fail in unexpected directories | Clear error messages, `--repo-path` override flag |
| Spec template rigidity | Users want custom formats | Template is a starting point; future WP can add template customization |

---

## Review Guidance

1. **CLI ergonomics**: Run `agileplus --help`, `agileplus specify --help`, verify output is clear and complete.
2. **Non-interactive mode**: Verify `--from-file` works end-to-end without any terminal prompts.
3. **State machine compliance**: Verify specify creates `created -> specified` transition, research creates `specified -> researched`.
4. **Audit trail**: Verify every state transition appends an audit entry with correct hash chaining.
5. **Error messages**: Trigger common errors (no git repo, missing feature) and verify messages are actionable.
6. **DI correctness**: Verify command handlers never construct adapters directly -- all come from `AppContext`.
7. **Refinement flow**: Re-run specify, verify diff is computed and stored as evidence.

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this file (Activity Log section below "Valid lanes")
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ -- agent_id -- lane=<lane> -- <action>`
4. Timestamp MUST be current time in UTC (check with `date -u "+%Y-%m-%dT%H:%M:%SZ"`)
5. Lane MUST match the frontmatter `lane:` field exactly
6. Agent ID should identify who made the change (claude-sonnet-4-5, codex, etc.)

**Format**:
```
- YYYY-MM-DDTHH:MM:SSZ -- <agent_id> -- lane=<lane> -- <brief action description>
```

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

### Updating Lane Status

To change a work package's lane, either:

1. **Edit directly**: Change the `lane:` field in frontmatter AND append activity log entry (at the end)
2. **Use CLI**: `spec-kitty agent tasks move-task WP11 --to <lane> --note "message"` (recommended)

**Initial entry**:
- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-28T09:52:05Z – claude-wp11 – shell_pid=81185 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:59:59Z – claude-wp11 – shell_pid=81185 – lane=for_review – Ready: specify+research commands, 21 tests
- 2026-02-28T10:00:14Z – claude-wp11 – shell_pid=81185 – lane=done – Review passed: 21 tests, clean build
