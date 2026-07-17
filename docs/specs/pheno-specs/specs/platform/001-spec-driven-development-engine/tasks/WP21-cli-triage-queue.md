---
work_package_id: WP21
title: CLI Triage & Queue Commands + Agent Defaults
lane: "done"
dependencies:
- WP01
- WP03
- WP04
- WP05
- WP06
- WP07
- WP08
- WP09
- WP10
- WP11
- WP12
- WP13
- WP14
- WP15
- WP17
- WP18
- WP19
- WP20
base_branch: 001-spec-driven-development-engine-WP20
base_commit: 53afb3364d1c7775fe6a110bbe55c7ad3bc8af0f
created_at: '2026-02-28T13:34:30.451070+00:00'
subtasks:
- T121
- T122
- T123
- T124
- T125
- T126
- T127
phase: Phase 5 - Triage, Sync & Sub-Commands
assignee: ''
agent: "claude-opus"
shell_pid: "79650"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP21 — CLI Triage & Queue Commands + Agent Defaults

## Implementation Command

```bash
# Start work in the designated worktree for this package
cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus-wtrees/wp21-cli-triage-queue
cargo build --workspace 2>&1 | head -40
cargo test --workspace 2>&1 | tail -20
```

---

## Objectives

Add `triage` and `queue` as first-class user-facing CLI commands. Implement agent DevOps
defaults, auto-triage hooks during the `implement` phase, and seed the sub-command prompt
library introduced in WP20.

Primary goals:

1. Implement `commands/triage.rs` — accept freetext or structured input, classify, and
   route to the appropriate external system or backlog.
2. Implement `commands/queue.rs` — add items to the backlog and surface them during
   `specify`/`plan` cycles.
3. Add an auto-triage hook in `agileplus-agents` that fires during `implement` when
   agent output contains error patterns or TODO markers.
4. Define and enforce agent DevOps defaults: conventional commits, branch naming,
   lint/format discipline, PR templates.
5. Integrate `CLAUDE.md` first-action classification into the prompt router output so
   agents start each WP with correct sub-command chain selection.
6. Wire all new commands to storage, sync adapters, and telemetry; register them with
   clap in `main.rs`; write CLI integration tests.
7. Seed the `prompts/subcommands/` directory with one prompt file per sub-command from
   the WP20 registry, derived from the hybridized reference command set.

---

## Context & Constraints

### Background

The 7 primary AgilePlus commands are designed for human users navigating a spec-driven
workflow. `triage` and `queue` fill a gap in that flow: they allow ad-hoc input capture
(bugs, ideas, feature requests) without requiring the user to be inside an active spec
cycle. They also expose the classification and backlog machinery from WP18 and WP20
through a friendly CLI surface.

The agent defaults and auto-triage hook extend that machinery into the automated side
of the system. When an agent is running the `implement` command, it now has a standard
operating procedure: conventional commits, enforced branch names, automatic bug filing
when errors are detected, and a CLAUDE.md-guided first action that selects the correct
sub-command chain.

The sub-command prompt seeds in T127 are the human-readable counterpart to the registry
defined in WP20. They form the prompt library that agents load via `context:load-spec`
and the router references when generating CLAUDE.md.

### Dependencies

- **WP17**: `PromptRouter` must be stable for T125 (CLAUDE.md first-action classifier
  integration) and for `meta:generate-router` round-tripping.
- **WP20**: The full sub-command registry (T114) and all handler categories must be
  present before T126 can wire triage/queue to them and before T127 can seed prompt
  files for each registered sub-command.

### Constraints

- `triage` and `queue` must appear in the top-level `--help` output with concise
  descriptions. They are user-facing, unlike the hidden sub-commands of WP20.
- The auto-triage hook (T123) must be opt-out, not opt-in. Default behavior is enabled;
  agents and users can disable it via `.agileplus/config.toml` or a `--no-auto-triage`
  flag on the `implement` command.
- Agent DevOps defaults (T124) must be configurable per-workspace without requiring
  code changes. Defaults live in `.agileplus/devops-defaults.toml`.
- The CLAUDE.md first-action classifier (T125) must not introduce circular dependency
  between `agileplus-agents` and `agileplus-cli`. It reads the router output file, it
  does not call the router binary.
- Prompt files in `prompts/subcommands/` must be valid Markdown with YAML frontmatter.
  The seeding tool (T127) generates them; they are subsequently editable by humans.
- All new clap subcommands must follow the existing argument naming conventions in
  `main.rs` (kebab-case flags, consistent `--output` format flag).

### File Layout

```
crates/agileplus-cli/src/commands/
  triage.rs          # T121
  queue.rs           # T122

crates/agileplus-agents/src/
  auto_triage.rs     # T123
  devops_defaults.rs # T124
  prompt_router.rs   # T125 (extend existing or create)

prompts/subcommands/ # T127
  triage-classify.md
  triage-file-bug.md
  triage-queue-idea.md
  governance-check-gates.md
  governance-evaluate-policy.md
  governance-verify-chain.md
  sync-push-plane.md
  sync-push-github.md
  sync-pull-status.md
  git-create-worktree.md
  git-branch-from-wp.md
  git-merge-and-cleanup.md
  devops-lint-and-format.md
  devops-conventional-commit.md
  devops-run-ci-checks.md
  context-load-spec.md
  context-load-plan.md
  context-load-constitution.md
  context-scan-codebase.md
  escape-quick-fix.md
  escape-hotfix.md
  escape-skip-with-warning.md
  meta-generate-router.md
  meta-update-agents-md.md

tests/cli/
  test_triage_cmd.rs
  test_queue_cmd.rs
  test_auto_triage.rs
  test_devops_defaults.rs
  test_prompt_router_integration.rs
  test_subcommand_prompts.rs
```

---

## Subtask Guidance

### T121 — `commands/triage.rs`

**File**: `crates/agileplus-cli/src/commands/triage.rs`

Implement the `triage` primary command. This is the user-facing entry point to the
classification and routing machinery.

**Clap definition**:

```
agileplus triage [OPTIONS] [INPUT]

Args:
  [INPUT]   Freetext description of the item to triage (can also be piped via stdin)

Options:
  --type <TYPE>         Force classification type: bug | feature | idea | tech-debt
  --title <TITLE>       Title override (derived from input if omitted)
  --severity <SEV>      Bug severity: low | medium | high | critical
  --feature-id <ID>     Associate with an existing feature
  --dry-run             Classify and display result without creating any artifact
  --output <FMT>        Output format: table | json (default: table)
```

**Behavior**:

1. If `INPUT` is omitted, check stdin. If stdin is empty and `--type` is also omitted,
   prompt interactively.
2. Call `TriageAdapter.classify(input)` to determine the classification.
3. If `--type` is provided, override the classification result.
4. Route based on classification:
   - `Bug` → call `triage:file-bug` sub-command dispatch (reuse T115 handler).
     If `GitHubSyncAdapter` is configured, display the GitHub issue URL.
   - `Feature` → call `triage:classify` result display + prompt user to run `specify`.
   - `Idea` → call `triage:queue-idea` sub-command dispatch (reuse T119 handler).
   - `TechDebt` → create a backlog item of type TechDebt, no external sync.
5. Display the classification result and any created artifact reference.
6. If `--dry-run`, stop after step 2 and display the classification without creating
   anything.

**Error handling**:

- If classification returns `Ambiguous`, display the top two candidates and ask the user
  to pick one (interactive) or fail with exit code 2 (non-interactive / `--output json`).
- If the sync adapter is not configured, note this in the output but do not fail.

**Test coverage** (in `tests/cli/test_triage_cmd.rs`):

- Happy path: freetext input classified as Bug, backlog item created, sync skipped.
- Happy path: freetext input classified as Idea, queued.
- `--dry-run` flag: no artifact created.
- `--type bug` override: bypasses classifier.
- Ambiguous classification: non-interactive mode returns exit code 2.
- Piped stdin input.

---

### T122 — `commands/queue.rs`

**File**: `crates/agileplus-cli/src/commands/queue.rs`

Implement the `queue` primary command. This provides a fast path for capturing items
without classification — the user explicitly declares what they are adding.

**Clap definition**:

```
agileplus queue <SUBCOMMAND>

Subcommands:
  add     Add an item to the backlog queue
  list    List items in the backlog queue
  show    Show details of a queued item
  pop     Remove and return the next item from the queue

agileplus queue add [OPTIONS] <TITLE>

Args:
  <TITLE>   Item title (required)

Options:
  --type <TYPE>         Item type: bug | feature | idea | tech-debt (default: idea)
  --priority <PRI>      Priority: low | medium | high (default: medium)
  --tags <TAGS>         Comma-separated tags
  --description <DESC>  Optional description
  --feature-id <ID>     Associate with an existing feature

agileplus queue list [OPTIONS]

Options:
  --type <TYPE>         Filter by item type
  --priority <PRI>      Filter by priority
  --feature-id <ID>     Filter by feature
  --limit <N>           Limit output (default: 20)
  --output <FMT>        Output format: table | json (default: table)
```

**Behavior for `queue add`**:

1. Create a `BacklogItem` via the storage port with the provided fields.
2. Do not trigger any external sync (user explicitly chose `queue`, not `triage`).
3. Return the created item ID.
4. If `--feature-id` is provided, validate the feature exists before creating the item.

**Surfacing queued items during `specify`/`plan`**:

The `queue` command must register a hook that is called at the start of the `specify`
and `plan` commands. If there are open queued items relevant to the current feature
(matched by `--feature-id` or unassigned items when `--all-queued` flag is present on
`specify`/`plan`), display a summary banner:

```
3 queued items found for this feature. Run `agileplus queue list --feature-id <ID>` to review.
```

This hook is a read-only advisory; it does not block the `specify` or `plan` flow.

**Test coverage** (in `tests/cli/test_queue_cmd.rs`):

- `queue add` happy path.
- `queue list` with filters.
- `queue add` with invalid `--feature-id` returns error.
- Hook: `specify` command displays queued item banner when items exist.
- `queue pop` removes and returns the correct item.

---

### T123 — Agent Auto-Triage Hook

**File**: `crates/agileplus-agents/src/auto_triage.rs`

During the `implement` command, monitor agent output for patterns that indicate
problems requiring triage. When detected, automatically invoke `triage:classify`
and optionally `triage:file-bug`.

**Pattern detection**:

Define an `AutoTriageConfig` struct:

```rust
pub struct AutoTriageConfig {
    pub enabled: bool,
    pub threshold: AutoTriageThreshold,  // conservative | moderate | aggressive
    pub patterns: Vec<AutoTriagePattern>,
    pub auto_file_bugs: bool,
    pub notify_user: bool,
}
```

Built-in patterns (configurable):

| Pattern ID | Trigger | Action |
|---|---|---|
| `error_keyword` | Agent output contains "ERROR:", "FATAL:", "panic!" | Classify + optionally file bug |
| `todo_marker` | Agent output contains "TODO:", "FIXME:", "HACK:" | Classify as tech-debt, queue |
| `test_failure` | Agent output contains "test ... FAILED", "assertion failed" | Classify as bug |
| `compile_error` | Agent output contains "^^ error[E" (rustc format) | Classify + file bug |
| `clippy_warning` | Agent output contains "warning: " with lint code | Classify as tech-debt |

**Invocation**:

`AutoTriageHook` implements a `fn process_output_chunk(&self, chunk: &str, context: &ImplementContext) -> Vec<AutoTriageAction>` interface that is called by the `implement` command's output streaming loop.

Each `AutoTriageAction` is either:
- `QueueItem { pattern_id, extracted_text, suggested_type }` — add to backlog.
- `FileBug { pattern_id, title, description, severity }` — call `triage:file-bug`.
- `Notify { message }` — display to user without creating artifacts.

**Configuration**:

Reads from `.agileplus/config.toml`:

```toml
[auto_triage]
enabled = true
threshold = "moderate"
auto_file_bugs = false
notify_user = true
```

The `implement` command must pass `--no-auto-triage` to disable for a single run.

**Test coverage** (in `tests/cli/test_auto_triage.rs`):

- Pattern matching: each built-in pattern triggers the correct action type.
- `enabled = false` in config: no actions produced regardless of input.
- `auto_file_bugs = true`: FileBug actions result in backlog items.
- Multiple patterns in a single output chunk: each produces an independent action.
- `--no-auto-triage` flag on `implement`: hook is bypassed entirely.

---

### T124 — Agent DevOps Defaults

**File**: `crates/agileplus-agents/src/devops_defaults.rs`

Define and enforce a standard set of DevOps conventions for agents operating within
AgilePlus workflows. These defaults are applied whenever an agent completes a task
and prepares to commit work.

**Conventional Commit Enforcement**:

Provide a `ConventionalCommitValidator` that:
- Parses a commit message string against the spec: `<type>(<scope>): <subject>`.
- Accepts types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`, `build`.
- Returns `ValidationResult { valid: bool, parsed: Option<ConventionalCommit>, errors: Vec<String> }`.
- Integrates with `devops:conventional-commit` sub-command (T118).

**Branch Naming Convention**:

Default pattern: `<feature-slug>-<wp_id_lowercase>-<short-description>`.
Example: `spec-engine-wp21-cli-triage`.

Provide `BranchNameGenerator::from_wp(wp: &WorkPackage, description: &str) -> String`.
Validate branch names via `BranchNameValidator::validate(name: &str) -> ValidationResult`.

**Pre-Push Checklist**:

`DevOpsDefaultsEnforcer::pre_push_check(context: &AgentContext) -> PrePushReport`:
1. Validate commit message format.
2. Validate branch name format.
3. Run `devops:lint-and-format` (via sub-command dispatch).
4. Return `PrePushReport { all_passed: bool, checks: Vec<CheckResult> }`.

**PR Template Population**:

When an agent opens a PR, `PrTemplateBuilder::build(wp: &WorkPackage, commits: &[Commit]) -> String`
generates a PR body including:
- WP ID and title.
- Subtasks addressed (from commits).
- Test coverage summary (from `cargo test` output).
- Governance gate status from `governance:check-gates`.
- Link to the relevant spec section.

**Configuration** (`.agileplus/devops-defaults.toml`):

```toml
[commit]
enforce_conventional = true
allowed_types = ["feat", "fix", "chore", "docs", "refactor", "test", "ci"]

[branch]
pattern = "{feature_slug}-{wp_id}-{description}"
max_length = 60

[pre_push]
run_fmt = true
run_clippy = true
run_tests = false       # too slow for pre-push by default
fail_on_clippy_warn = true

[pr_template]
include_governance_status = true
include_test_summary = true
```

**Test coverage** (in `tests/cli/test_devops_defaults.rs`):

- Conventional commit validator: valid and invalid messages across all types.
- Branch name generator: output matches pattern for various WP inputs.
- Pre-push check: all-pass scenario and partial-fail scenario.
- PR template builder: output contains expected WP metadata.
- Config override: `enforce_conventional = false` disables commit validation.

---

### T125 — CLAUDE.md First-Action Classifier

**File**: `crates/agileplus-agents/src/prompt_router.rs`

When an agent starts working on a WP, it reads the generated `CLAUDE.md` for that
workspace. The first-action classifier reads the router output and selects the
appropriate sub-command chain for the agent to execute first.

**Classifier behavior**:

`PromptRouterClassifier::classify_first_action(claude_md_path: &Path) -> FirstActionPlan`:

1. Parse the `CLAUDE.md` file to extract the `## Active Work Package` section.
2. Identify the WP phase and lane.
3. Select a recommended first-action sub-command chain based on phase/lane:

| Phase | Lane | First Action Chain |
|---|---|---|
| specify | in_progress | `context:load-spec` → `governance:check-gates` |
| plan | in_progress | `context:load-plan` → `governance:check-gates` |
| implement | in_progress | `context:load-spec` → `devops:lint-and-format` → `git:branch-from-wp` |
| review | in_progress | `governance:check-gates` → `governance:verify-chain` |
| accept | in_progress | `governance:verify-chain` → `sync:push-plane` |
| any | blocked | `governance:check-gates` (to surface the blocking gate) |

4. Return `FirstActionPlan { wp_id, phase, lane, sub_command_chain: Vec<String> }`.

**Integration with router output**:

The `PromptRouter` (WP17) must embed a `<!-- FIRST_ACTION_HINTS: {...} -->` HTML comment
block in the generated `CLAUDE.md`. The classifier reads this block rather than parsing
the full Markdown prose. This decouples the classifier from CLAUDE.md formatting changes.

The router must be updated (as part of this task) to emit the hints block when generating
CLAUDE.md output. The hints block is a JSON object keyed by WP ID:

```json
{
  "WP21": {
    "phase": "implement",
    "lane": "in_progress",
    "recommended_chain": ["context:load-spec", "devops:lint-and-format", "git:branch-from-wp"]
  }
}
```

**Test coverage** (in `tests/cli/test_prompt_router_integration.rs`):

- Parse a fixture CLAUDE.md file and assert the correct first-action chain is returned
  for each phase/lane combination.
- Missing hints block falls back to phase/lane parse from prose.
- Blocked lane always returns `governance:check-gates` as first action.
- Round-trip: `meta:generate-router` produces CLAUDE.md → classifier reads it → chain
  matches expected for the fixture WP.

---

### T126 — Wire Triage/Queue to All Ports & Register with Clap

**Files**: `crates/agileplus-cli/src/main.rs` and related integration test files.

This subtask ensures all the pieces assembled in T121–T125 are connected end-to-end.

**Port wiring checklist**:

- `commands/triage.rs` must receive: `StoragePort`, `TriageAdapter`, optionally
  `GitHubSyncAdapter`, `TelemetryPort`.
- `commands/queue.rs` must receive: `StoragePort`, `TelemetryPort`.
- `auto_triage.rs` must receive: `StoragePort`, `TriageAdapter`, optionally
  `GitHubSyncAdapter` (for `auto_file_bugs`).
- `devops_defaults.rs` must receive: `VcsPort`, `SubCommandDispatcher`.

All adapters and ports are constructed in `main.rs` from config and injected via the
`AppContext` struct. No command file should construct its own adapter instances.

**Clap registration** (in `main.rs`):

```rust
.subcommand(triage::command())   // T121
.subcommand(queue::command())    // T122
```

Both commands must appear in the top-level `--help` output with one-line descriptions.

**Telemetry**:

Each command invocation must emit a telemetry event via `TelemetryPort`:
- `event_type`: `"cli_command"`.
- `command`: `"triage"` or `"queue"`.
- `subcommand`: for `queue`, the sub-subcommand (`"add"`, `"list"`, etc.).
- `duration_ms`: wall clock time for the full command execution.
- `success`: boolean.

Telemetry must be non-blocking and must not cause command failure if the telemetry
backend is unavailable.

**CLI integration tests**:

Write tests in `tests/cli/` that invoke the compiled binary via `assert_cmd`:

- `agileplus triage "fix the login bug"` — assert exit code 0, stdout contains
  classification label.
- `agileplus triage --dry-run "..."` — assert no storage writes occurred.
- `agileplus queue add "my idea" --type idea` — assert exit code 0, item ID in stdout.
- `agileplus queue list` — assert exit code 0, table output contains at least the
  item added in previous step.
- `agileplus --help` — assert both `triage` and `queue` appear in output.

---

### T127 — Seed Sub-Command Prompt Files

**Directory**: `prompts/subcommands/`

Create one Markdown prompt file per sub-command registered in the WP20 registry
(~24 files based on the T114 catalogue). Each file follows this template:

```markdown
---
subcommand: triage:classify
category: triage
description: Classify freetext input into bug/feature/idea/tech-debt
required_args:
  - input
optional_args: []
example_usage: agileplus subcommand triage:classify --input "login fails on mobile"
source_refs:
  - spec-kitty
  - bmad
  - gsd
---

# triage:classify

## Purpose

[One paragraph description of what this sub-command does and when to use it.]

## Usage

```
agileplus subcommand triage:classify --input "<text>"
```

## Arguments

| Argument | Required | Description |
|---|---|---|
| `--input` | yes | Freetext description to classify |

## Output

[Description of output format and fields.]

## Agent Guidance

[When and how an agent should invoke this sub-command. Include the typical
upstream trigger and downstream action.]

## Reference Commands

[List of analogous commands from spec-kitty, bmad, gsd, openspec that
informed this sub-command's design.]
```

The seeding tool must:

1. Read the sub-command registry from `SubCommandRegistry::all()` (or a JSON export
   of it if the registry is not yet compiled).
2. For each entry, render a prompt file from the template above.
3. Write each file to `prompts/subcommands/<category>-<action>.md` (replacing `:` with `-`).
4. Do not overwrite files that already exist and have been manually edited (detect via
   a `# DO NOT OVERWRITE` sentinel or a `manually_edited: true` frontmatter flag).

The seeder is implemented as a one-shot binary in `crates/agileplus-cli/src/bin/seed_prompts.rs`
and is not part of the primary command surface.

**Test coverage** (in `tests/cli/test_subcommand_prompts.rs`):

- Assert that `prompts/subcommands/` contains exactly one file per registered sub-command.
- Assert that each file has valid YAML frontmatter with the required fields.
- Assert that the `subcommand` frontmatter field matches the registry entry name.
- Assert that no file is empty.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auto-triage hook producing false positives and flooding the backlog | Medium | Conservative default threshold; `auto_file_bugs = false` by default; user notification before filing |
| DevOps defaults being too opinionated for existing team workflows | Medium | All defaults configurable via `.agileplus/devops-defaults.toml`; each check independently toggleable |
| `queue` command surfacing too many items during `specify`/`plan` and becoming noise | Low | Banner is advisory only; user must explicitly run `queue list` for details; scoped by feature-id |
| Prompt file seeder overwriting manually curated content | Medium | `manually_edited` frontmatter flag prevents overwrite; seeder is idempotent on unedited files |
| Circular dependency between `agileplus-agents` and `agileplus-cli` | Low | Classifier reads router output file on disk; does not import or call cli crate types |
| CLAUDE.md hints block format changing in WP17 updates | Low | Classifier has a fallback parser for prose-based extraction; hints block is an optimization, not a hard requirement |
| Telemetry blocking command execution under slow network | Low | Non-blocking channel; telemetry failures are silently discarded; timeout of 500ms hard limit |

---

## Review Guidance

The reviewer should verify the following before moving this WP to `done`:

1. `cargo test --workspace` passes with zero failures for all tests in `tests/cli/`.
2. `agileplus --help` output includes both `triage` and `queue` with accurate descriptions.
3. `agileplus triage --dry-run "some input"` exits with code 0 and produces no storage
   writes (verify with storage mock assertion in integration test).
4. `agileplus queue add` followed by `agileplus queue list` shows the added item.
5. Auto-triage hook test: error pattern in agent output triggers a `QueueItem` action
   (not `FileBug`) when `auto_file_bugs = false`.
6. `devops_defaults.rs` tests cover all four components: commit validation, branch
   naming, pre-push check, PR template.
7. `PromptRouterClassifier` round-trip test passes for all six phase/lane combinations.
8. `prompts/subcommands/` contains exactly as many files as there are entries in the
   WP20 registry (from T114).
9. Each prompt file has valid YAML frontmatter with `subcommand`, `category`,
   `description`, `required_args`, `optional_args`, and `example_usage` fields.
10. No adapter is constructed inside a command file — all adapters come from `AppContext`
    injected by `main.rs`.
11. Telemetry events are emitted for both `triage` and `queue` command invocations in
    the integration tests (verify via mock telemetry backend).
12. The `--no-auto-triage` flag on `implement` completely bypasses the hook (verify
    no backlog items created even when error patterns are present in mock output).

---

## Activity Log

| Timestamp | Actor | Action | Notes |
|---|---|---|---|
| 2026-02-27T00:00:00Z | system | WP created | Generated via /spec-kitty.tasks |

---

_Work Package WP21 — Phase 5: Triage, Sync & Sub-Commands_
- 2026-02-28T13:34:30Z – claude-opus – shell_pid=66424 – lane=doing – Assigned agent via workflow command
- 2026-02-28T13:38:23Z – claude-opus – shell_pid=66424 – lane=for_review – Triage/queue CLI commands, 25 prompt seeds. 4 tests.
- 2026-02-28T23:22:54Z – claude-opus – shell_pid=79650 – lane=doing – Started review via workflow command
- 2026-02-28T23:23:12Z – claude-opus – shell_pid=79650 – lane=done – Review passed: 73 tests pass (63 unit + 10 integration), triage/queue CLI commands with 25 seed prompts
