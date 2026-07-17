---
work_package_id: WP20
title: Hidden Sub-Commands & SlashCommand Integration
lane: "done"
dependencies:
- WP13
base_branch: 001-spec-driven-development-engine-WP17
base_commit: 2df69d4d7fa7363fc68caade1ca49438eb272f15
created_at: '2026-02-28T13:31:30.178574+00:00'
subtasks:
- T114
- T115
- T116
- T117
- T118
- T119
- T120
phase: Phase 5 - Triage, Sync & Sub-Commands
assignee: ''
agent: "claude-opus"
shell_pid: "79344"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP20 — Hidden Sub-Commands & SlashCommand Integration

## Implementation Command

```bash
# Start work in the designated worktree for this package
cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus-wtrees/wp20-hidden-subcommands
cargo build --workspace 2>&1 | head -40
cargo test --workspace 2>&1 | tail -20
```

---

## Objectives

Implement approximately 25 hidden sub-commands invocable by agents via Claude Code's
SlashCommand tool (v1.0.123+). These sub-commands provide bmad-level depth of automation
behind the 7 user-facing commands. They are not surfaced in `--help` output and are
not intended for direct end-user invocation. Their purpose is to give an agent a rich
command palette to orchestrate complex multi-step workflows without requiring the user
to understand the underlying mechanics.

Primary goals:

1. Define a `SubCommand` registry with all ~25 variants, metadata, and lookup-by-name.
2. Implement all six sub-command categories with proper adapter wiring.
3. Ensure every sub-command invocation is logged to an immutable audit trail.
4. Expose each sub-command via a SlashCommand-compatible interface so Claude Code
   agents can invoke them by name with structured arguments.
5. Provide integration tests validating routing, adapter wiring, and audit completeness.

---

## Context & Constraints

### Background

AgilePlus surfaces 7 primary commands to users: `specify`, `plan`, `implement`,
`review`, `accept`, `triage`, and `queue`. Behind these commands is a domain engine
that manages specifications, work packages, governance gates, PM sync, VCS operations,
and agent orchestration. The hidden sub-commands provide granular access to every
major operation in that engine without the opinionated UX flow of the primary commands.

This pattern mirrors bmad's internal slash-command system and gsd's agent hooks. The
sub-commands are discoverable only by agents reading `AGENTS.md` and the generated
`CLAUDE.md` output from the router (WP17). They are invoked using Claude Code's
`SlashCommand` tool interface introduced in v1.0.123.

### Dependencies

- **WP13**: Domain model types, `WorkPackage`, `Feature`, `Artifact`, `GovernanceContract`
  must be stable before sub-commands can wire to domain logic.
- **WP17**: `PromptRouter` and `RouterOutput` must be complete. `meta:generate-router`
  calls into this directly.
- **WP18**: `TriageAdapter` (classify, file-bug, queue-idea) must be present and wired
  to storage before T115 can be completed.
- **WP19**: `PlaneSyncAdapter` and `GitHubSyncAdapter` must be functional before T117
  sync sub-commands can be wired.

### Constraints

- Sub-commands must NOT appear in `--help` output for any primary command.
- Every sub-command must have a machine-readable metadata struct for agent introspection.
- Sub-command names follow the pattern `<category>:<action>` using only lowercase
  alphanumerics and hyphens.
- All sub-commands must be invocable via `agileplus subcommand <name> [args...]`
  (hidden clap subcommand passthrough) as well as via SlashCommand tool format.
- Argument validation must happen at the registry layer before dispatch, so individual
  handler files stay focused on business logic only.
- Audit log entries must be append-only and written before and after execution
  (pre-dispatch + post-dispatch with result status).

### File Layout

```
crates/agileplus-cli/src/subcommands/
  mod.rs
  registry.rs        # T114
  triage.rs          # T115
  governance.rs      # T116
  sync.rs            # T117
  devops.rs          # T118
  context.rs         # T119
  escape.rs          # T119
  meta.rs            # T119

crates/agileplus-cli/src/audit/
  mod.rs
  log.rs             # T120

tests/subcommands/
  test_registry.rs
  test_triage_subcmds.rs
  test_governance_subcmds.rs
  test_sync_subcmds.rs
  test_devops_subcmds.rs
  test_context_escape_meta.rs
  test_audit_trail.rs
```

---

## Sub-Command Catalogue

### Triage (3 sub-commands)

| Sub-command | Description |
|---|---|
| `triage:classify` | Classify freetext input into bug/feature/idea/tech-debt |
| `triage:file-bug` | Create backlog item of type Bug + trigger GitHub sync |
| `triage:queue-idea` | Create backlog item of type Idea, no sync required |

### Governance (3 sub-commands)

| Sub-command | Description |
|---|---|
| `governance:check-gates` | Evaluate all contract rules for the current feature state |
| `governance:evaluate-policy` | Run a named policy against provided context |
| `governance:verify-chain` | Audit the artifact chain for completeness and validity |

### PM Sync (3 sub-commands)

| Sub-command | Description |
|---|---|
| `sync:push-plane` | Push feature state to Plane.so via PlaneSyncAdapter |
| `sync:push-github` | Push bug artifact to GitHub Issues via GitHubSyncAdapter |
| `sync:pull-status` | Poll Plane.so and GitHub for updated status on open items |

### Git/DevOps (6 sub-commands)

| Sub-command | Description |
|---|---|
| `git:create-worktree` | Create a new git worktree for a WP via VcsPort |
| `git:branch-from-wp` | Create a branch named from WP metadata |
| `git:merge-and-cleanup` | Merge a worktree branch into main and remove the worktree |
| `devops:lint-and-format` | Run `cargo fmt` and `cargo clippy` with project settings |
| `devops:conventional-commit` | Validate or generate a conventional commit message |
| `devops:run-ci-checks` | Run the local CI check suite (fmt, clippy, test, audit) |

### Context (4 sub-commands)

| Sub-command | Description |
|---|---|
| `context:load-spec` | Read the current feature's `spec.md` into agent context |
| `context:load-plan` | Read the current feature's `plan.md` into agent context |
| `context:load-constitution` | Read `CONSTITUTION.md` into agent context |
| `context:scan-codebase` | Emit a summary of relevant crates and module structure |

### Quick Escapes (3 sub-commands)

| Sub-command | Description |
|---|---|
| `escape:quick-fix` | Bypass state machine for a targeted single-file fix with warning |
| `escape:hotfix` | Bypass state machine for a production hotfix with full audit entry |
| `escape:skip-with-warning` | Skip a governance gate with an explicit justification recorded |

### Meta (2 sub-commands)

| Sub-command | Description |
|---|---|
| `meta:generate-router` | Invoke `router.rs` from WP17 to regenerate `CLAUDE.md` |
| `meta:update-agents-md` | Rewrite `AGENTS.md` to reflect current sub-command set |

---

## Subtask Guidance

### T114 — Sub-Command Registry

**File**: `crates/agileplus-cli/src/subcommands/registry.rs`

Define the `SubCommand` enum with all ~25 variants as unit or tuple variants
(tuple if the sub-command has required structured arguments). Add a `SubCommandMeta`
struct with the following fields:

```rust
pub struct SubCommandMeta {
    pub name: &'static str,          // e.g. "triage:classify"
    pub category: SubCommandCategory,
    pub description: &'static str,
    pub required_args: &'static [&'static str],
    pub optional_args: &'static [&'static str],
    pub example_usage: &'static str,
    pub hidden: bool,                // always true for sub-commands
}
```

Implement a `SubCommandRegistry` with:

- `fn all() -> &'static [SubCommandMeta]` — returns the static slice of all registered sub-commands.
- `fn lookup(name: &str) -> Option<&'static SubCommandMeta>` — case-insensitive lookup by name.
- `fn validate_args(name: &str, args: &[String]) -> Result<(), SubCommandError>` — check required
  args are present before dispatch.

The registry must be populated via a `inventory!` or `lazy_static!` pattern so that adding
new sub-commands in category files does not require modifying `registry.rs`.

Integration test: verify that `registry.all()` returns exactly the expected count and that
`lookup` is case-insensitive.

---

### T115 — Triage Sub-Commands

**File**: `crates/agileplus-cli/src/subcommands/triage.rs`

Wire to `TriageAdapter` from WP18. Each handler receives a `SubCommandContext` (which carries
the resolved storage port, sync adapter handles, and the audit logger).

`triage:classify`:
- Accept one required arg: `input` (raw text).
- Call `TriageAdapter.classify(input)`.
- Return `ClassificationResult` serialized as JSON to stdout.
- Audit entry: input hash + classification label + confidence score.

`triage:file-bug`:
- Required args: `title`, `description`. Optional: `severity`, `feature_id`.
- Create a `BacklogItem { item_type: Bug, ... }` via storage port.
- If `GitHubSyncAdapter` is configured, call `sync_bug(&item)`.
- Return created item ID + optional GitHub issue URL.
- Audit entry: item_id, sync_result.

`triage:queue-idea`:
- Required args: `title`. Optional: `description`, `tags`.
- Create a `BacklogItem { item_type: Idea, ... }` via storage port only (no sync).
- Return created item ID.
- Audit entry: item_id.

All three handlers must return `Result<SubCommandOutput, SubCommandError>` where
`SubCommandOutput` is a newtype over `serde_json::Value`.

---

### T116 — Governance Sub-Commands

**File**: `crates/agileplus-cli/src/subcommands/governance.rs`

Wire to domain governance logic from WP13 (`GovernanceContract`, `PolicyEvaluator`,
`ArtifactChain`).

`governance:check-gates`:
- Required args: `feature_id`.
- Load the feature's `GovernanceContract` from storage.
- Evaluate all contract rules against the current feature state.
- Return a `GateReport { passed: Vec<RuleName>, failed: Vec<RuleName>, warnings: Vec<String> }`.
- Non-zero exit code if any required gate fails.

`governance:evaluate-policy`:
- Required args: `policy_name`, `context_json`.
- Look up the named policy in the policy registry.
- Deserialize `context_json` into the policy's expected input type.
- Run the policy evaluator and return pass/fail + explanation.

`governance:verify-chain`:
- Required args: `feature_id`.
- Walk the artifact chain (spec -> plan -> WPs -> tasks).
- Verify each artifact exists, has a valid hash, and links correctly to its parent.
- Return `ChainVerificationReport { valid: bool, broken_links: Vec<ArtifactRef>, missing: Vec<ArtifactRef> }`.

All three must produce machine-readable JSON output for agent consumption and human-readable
tabular output when a `--human` flag is provided (default: JSON).

---

### T117 — Sync Sub-Commands

**File**: `crates/agileplus-cli/src/subcommands/sync.rs`

Wire to `PlaneSyncAdapter` and `GitHubSyncAdapter` from WP19.

`sync:push-plane`:
- Required args: `feature_id`.
- Call `PlaneSyncAdapter.sync_feature(feature_id)`.
- Return `SyncResult { external_id, url, synced_at }`.
- On error, return structured error with retry guidance.

`sync:push-github`:
- Required args: `bug_id`.
- Load the backlog item by `bug_id`, assert `item_type == Bug`.
- Call `GitHubSyncAdapter.sync_bug(&item)`.
- Return GitHub issue URL + issue number.

`sync:pull-status`:
- No required args. Optional: `feature_id` to scope the pull.
- Poll both Plane.so and GitHub for status updates on all open mirrored items.
- Write updated statuses back to local storage.
- Return a diff of changed statuses: `Vec<StatusChange { item_id, old_status, new_status, source }>`.

Sync sub-commands must handle rate-limiting gracefully (retry with backoff, surface wait
time in audit log). If an adapter is not configured, the sub-command must return a clear
`AdapterNotConfigured` error rather than panicking.

---

### T118 — Git/DevOps Sub-Commands

**File**: `crates/agileplus-cli/src/subcommands/devops.rs`

Wire to `VcsPort` (WP13) and shell execution via `std::process::Command`.

`git:create-worktree`:
- Required args: `wp_id`, `branch_name`.
- Call `VcsPort.create_worktree(wp_id, branch_name)`.
- Return the worktree path.

`git:branch-from-wp`:
- Required args: `wp_id`.
- Derive branch name from WP metadata: `<feature_slug>-<wp_id_lowercase>`.
- Call `VcsPort.create_branch(branch_name)`.
- Return `{ branch_name, created_at }`.

`git:merge-and-cleanup`:
- Required args: `wp_id`.
- Merge the WP's branch into main via `VcsPort.merge_branch()`.
- Remove the worktree via `VcsPort.remove_worktree()`.
- Return merge commit hash.

`devops:lint-and-format`:
- No required args. Optional: `--fix` flag.
- Run `cargo fmt [--check]` and `cargo clippy -- -D warnings`.
- Return structured output: `{ fmt_passed: bool, clippy_passed: bool, diagnostics: Vec<String> }`.

`devops:conventional-commit`:
- Required args: `message`.
- Parse the message against the conventional commit spec (feat/fix/chore/docs/refactor/test/ci).
- If `--generate` flag is set, generate a commit message from staged diff summary.
- Return `{ valid: bool, parsed: Option<ConventionalCommit>, suggestion: Option<String> }`.

`devops:run-ci-checks`:
- No required args.
- Run in sequence: fmt check, clippy, `cargo test --workspace`, `cargo audit`.
- Short-circuit on first failure unless `--all` flag is set.
- Return `CiReport { steps: Vec<CiStep { name, passed, output }> }`.

All shell invocations must capture stdout and stderr separately and include them in the
`SubCommandOutput`. Working directory must default to the workspace root but be
overridable via `--cwd`.

---

### T119 — Context, Escape & Meta Sub-Commands

**Files**:
- `crates/agileplus-cli/src/subcommands/context.rs`
- `crates/agileplus-cli/src/subcommands/escape.rs`
- `crates/agileplus-cli/src/subcommands/meta.rs`

**Context sub-commands**:

`context:load-spec`:
- Required args: `feature_id`.
- Read `kitty-specs/<feature_id>/spec.md` from disk.
- Emit contents as a fenced markdown block to stdout for agent ingestion.

`context:load-plan`:
- Required args: `feature_id`.
- Read `kitty-specs/<feature_id>/plan.md` from disk.
- Emit contents as a fenced markdown block.

`context:load-constitution`:
- No required args.
- Read `CONSTITUTION.md` from the workspace root.
- Emit contents.

`context:scan-codebase`:
- No required args. Optional: `--depth` (default 2), `--filter` (glob pattern).
- Walk the workspace crate tree and emit a summary: crate name, purpose (from Cargo.toml
  description), top-level modules.
- Output as structured JSON array.

**Escape sub-commands**:

`escape:quick-fix`:
- Required args: `file_path`, `description`.
- Write an audit entry marking state machine bypass with reason.
- Emit a warning to stderr.
- Do not modify any domain state; the actual fix is performed by the agent after
  receiving the bypass acknowledgment.

`escape:hotfix`:
- Required args: `description`, `ticket_ref`.
- Create a `HotfixRecord` in storage with timestamp, caller, description, ticket_ref.
- Write a high-priority audit entry.
- Return `hotfix_id` for reference in commit message.

`escape:skip-with-warning`:
- Required args: `gate_name`, `justification`.
- Record the skip in the governance contract override log.
- Write audit entry with justification.
- Return `{ skip_id, gate_name, recorded_at }`.

**Meta sub-commands**:

`meta:generate-router`:
- No required args. Optional: `feature_id` to scope output.
- Invoke `PromptRouter` from WP17 with the current workspace context.
- Write the generated `CLAUDE.md` to the appropriate location.
- Return path to the written file.

`meta:update-agents-md`:
- No required args.
- Read the current sub-command registry via `SubCommandRegistry::all()`.
- Generate a fresh `AGENTS.md` section listing all sub-commands with descriptions.
- Write or update `AGENTS.md` in place (idempotent, replace the sub-commands section
  between sentinel comments `<!-- SUBCMDS:START -->` and `<!-- SUBCMDS:END -->`).
- Return `{ updated: bool, path: String }`.

---

### T120 — Audit Logging for All Sub-Command Invocations

**File**: `crates/agileplus-cli/src/audit/log.rs`

Every sub-command invocation must be logged with a pre-dispatch entry and a
post-dispatch entry. The audit log is append-only JSONL format on disk:

```
.agileplus/audit/subcommands.jsonl
```

Each entry schema:

```jsonc
{
  "entry_type": "pre_dispatch" | "post_dispatch",
  "timestamp": "2026-02-27T00:00:00Z",
  "caller": "user" | "agent:<agent_name>",
  "subcommand": "triage:classify",
  "args": { "input": "..." },
  "invocation_id": "<uuid>",
  // post_dispatch only:
  "result_status": "ok" | "error",
  "error_code": null | "AdapterNotConfigured" | ...,
  "duration_ms": 42
}
```

Implementation requirements:

- `AuditLogger` struct with an `Arc<Mutex<BufWriter<File>>>` interior so it can be
  cloned across threads safely.
- `fn log_pre(&self, invocation: &InvocationContext) -> Result<(), AuditError>`
- `fn log_post(&self, invocation: &InvocationContext, result: &SubCommandResult) -> Result<(), AuditError>`
- Audit writes must not block the main execution path — use a bounded channel with
  a background writer thread.
- On test builds, the logger must support an in-memory backend for assertions.

Integration test requirements (in `tests/subcommands/test_audit_trail.rs`):

- Invoke each of the 25 sub-commands via the dispatch layer with a mock backend.
- Assert that exactly two audit entries exist per invocation (pre + post).
- Assert that `invocation_id` matches between the pre and post entries.
- Assert that `result_status` is correct for both success and error scenarios.
- Assert that no audit entry is missing for any sub-command in the registry.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| WP17/WP18/WP19 adapters not stable when T115-T117 begin | Medium | Use trait object stubs behind ports; sub-command handlers depend only on port traits, not concrete adapters |
| Sub-command proliferation making registry maintenance expensive | Medium | Registry auto-population via `inventory` crate; adding a new variant only requires updating the category file |
| Audit log disk I/O becoming a bottleneck under agent load | Low | Bounded channel + background writer thread; audit failures are non-fatal and surface as warnings |
| SlashCommand tool interface changing between Claude Code versions | Low | Abstract the invocation interface behind a `SlashCommandDispatcher` trait so the adapter layer can be swapped |
| Escape sub-commands being misused to permanently bypass governance | Medium | All escape invocations recorded in audit + governance override log; `governance:verify-chain` surfaces skips explicitly |
| Argument validation gaps causing panics in dispatch | Low | Centralize all arg validation in `registry.rs`; handlers receive pre-validated `ValidatedArgs` type, not raw strings |

---

## Review Guidance

The reviewer should verify the following before moving this WP to `done`:

1. `cargo test --workspace` passes with zero failures and zero ignored tests for this WP.
2. `cargo clippy -- -D warnings` produces no warnings in the `subcommands/` module tree.
3. `SubCommandRegistry::all()` returns exactly 25 entries (or the agreed final count).
4. Every sub-command in the registry has a corresponding handler reachable via dispatch.
5. The audit trail integration test passes and the `invocation_id` pairing assertion
   succeeds for all 25 sub-commands.
6. No sub-command appears in `--help` output for any primary command.
7. `meta:update-agents-md` produces a valid `AGENTS.md` that lists all sub-commands.
8. The `escape:*` sub-commands produce audit entries even when the caller is an agent
   operating in an automated pipeline (i.e., caller identification works correctly).
9. Sync sub-commands return `AdapterNotConfigured` gracefully when adapters are absent
   rather than panicking or hanging.
10. All file paths in the implementation match the layout specified in this document.

---

## Activity Log

| Timestamp | Actor | Action | Notes |
|---|---|---|---|
| 2026-02-27T00:00:00Z | system | WP created | Generated via /spec-kitty.tasks |

---

_Work Package WP20 — Phase 5: Triage, Sync & Sub-Commands_
- 2026-02-28T13:34:16Z – unknown – shell_pid=63412 – lane=for_review – Sub-commands crate: 25 commands, JSONL audit. 12 tests.
- 2026-02-28T23:22:37Z – claude-opus – shell_pid=79344 – lane=doing – Started review via workflow command
- 2026-02-28T23:22:50Z – claude-opus – shell_pid=79344 – lane=done – Review passed: 12 tests pass, 25 sub-commands in 8 categories, append-only JSONL audit
