---
work_package_id: WP12
title: CLI -- Plan & Implement Commands
lane: "done"
dependencies:
- WP08
base_branch: 001-spec-driven-development-engine-WP11
base_commit: 5ae41169174a038a3e6d9724f13b783b1d53858f
created_at: '2026-02-28T10:00:27.363199+00:00'
subtasks:
- T066
- T067
- T068
- T069
- T070
- T071
- T072
phase: Phase 3 - CLI
assignee: ''
agent: "claude-wp12"
shell_pid: "90068"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP12 -- CLI -- Plan & Implement Commands

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
spec-kitty implement WP12 --base WP11
```

---

## Objectives & Success Criteria

1. **`agileplus plan`** reads spec.md and research.md for a feature, generates work packages with dependency ordering, creates a governance contract, writes plan.md and WP prompt files to git, persists WP records in SQLite, and transitions the feature to `planned` state.
2. **File scope detection** parses the plan for file paths referenced by each WP and builds an overlap graph to identify serialization requirements.
3. **Dependency-aware scheduler** determines which WPs can run in parallel (no overlapping files) and which must be serialized (overlapping files or explicit dependencies), conforming to FR-038 and FR-039.
4. **`agileplus implement`** takes a feature slug (and optionally a WP ID), creates worktrees for ready WPs, dispatches agents, creates PRs with structured descriptions, and orchestrates the review-fix loop until PRs are green.
5. **PR descriptions** include the WP goal, FR references, acceptance criteria, and a link back to the spec (FR-011).
6. **Review-fix loop** polls for Coderabbit reviews, feeds comments back to the agent, re-pushes fixes, and re-polls, up to a configurable maximum (default 5 cycles) (FR-012).
7. All commands record telemetry spans and metrics. All state transitions append audit entries.
8. `cargo test -p agileplus-cli` passes including new plan/implement tests.

---

## Context & Constraints

### Prerequisite Work
- **WP08 (Agent Dispatch Adapter)**: provides `AgentDispatchAdapter` implementing `AgentPort` for spawning agents.
- **WP09 (Review Adapter)**: provides `ReviewAdapter` implementing `ReviewPort` for Coderabbit integration and CI checks.
- **WP11 (CLI Specify/Research)**: provides the CLI scaffold (`main.rs`, `AppContext`, clap routing) and the specify/research commands.

### Key References
- **Spec**: FR-003 (plan), FR-004 (implement), FR-010 (agent dispatch), FR-011 (PR description), FR-012 (review-fix loop), FR-038 (conflict resolution), FR-039 (dependency scheduling)
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- agent dispatch flow, conflict resolution design, scheduler logic
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- WorkPackage entity (file_scope, pr_url, pr_state, agent_id), WpDependency entity, GovernanceContract entity

### Architectural Constraints
- The `implement` command is the most complex in the system. It orchestrates VCS, agent dispatch, review, and telemetry in a long-running async workflow.
- Agent dispatch must be cancellable. If the user presses Ctrl+C, the system should attempt to clean up worktrees and record a partial audit entry.
- The review-fix loop is bounded. After max cycles, the WP is marked `blocked` with a governance exception in the audit trail.
- PR creation uses `gh pr create` via shell -- abstract this behind the AgentPort or a dedicated utility.

### Crate Dependencies (additions to WP11)
```toml
[dependencies]
# In addition to WP11 deps:
agileplus-agents = { path = "../agileplus-agents" }
agileplus-review = { path = "../agileplus-review" }
```

---

## Subtasks & Detailed Guidance

### Subtask T066 -- Implement `commands/plan.rs`: WP generation with dependency ordering

- **Purpose**: Implement the plan command that reads the spec and research, generates work packages with acceptance criteria traced to FRs, creates a governance contract, and persists everything.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/plan.rs`.
  2. Implement `run_plan(args: PlanArgs, ctx: &AppContext) -> Result<()>`:
     - Validate feature state is `researched` (or allow skip with warning per FR-034).
     - Read `spec.md` and `research.md` from git via VcsPort.
     - Parse FRs from spec.md (extract `FR-NNN: description` patterns).
     - Generate work packages:
       - Group related FRs into logical implementation units.
       - For each WP, define: title, acceptance criteria (referencing FR IDs), estimated file scope.
       - Assign sequence numbers based on dependency analysis.
     - Create dependency edges:
       - Explicit dependencies from FR grouping (shared domain concepts).
       - File overlap dependencies from file_scope intersection (T067).
     - Generate `plan.md` with WP summary, dependency graph, and parallel execution opportunities.
     - Generate WP prompt files under `kitty-specs/{slug}/tasks/WPnn-title.md`.
     - Create governance contract:
       - Define required evidence for each state transition.
       - Reference applicable policy rules.
       - Persist as `kitty-specs/{slug}/contracts/governance-v1.json`.
     - Persist all WP records in SQLite via StoragePort.
     - Persist governance contract in SQLite.
     - Transition feature: `researched -> planned`.
     - Append audit entry with evidence referencing the plan artifacts.
  3. Define `PlanArgs`:
     ```rust
     #[derive(Args)]
     struct PlanArgs {
         #[arg(long)]
         feature: String,

         /// Maximum WPs to generate
         #[arg(long, default_value = "20")]
         max_wps: usize,

         /// Agent count per WP (for complexity estimation)
         #[arg(long, default_value = "1")]
         agents_per_wp: usize,
     }
     ```
  4. Print a summary table of generated WPs with their dependencies and parallel groups.
- **Files**: `crates/agileplus-cli/src/commands/plan.rs`
- **Parallel?**: Yes, the plan command file is independent of the implement command file (T069-T071).
- **Notes**:
  - WP generation is a heuristic process. Start simple: one WP per major FR group (3-7 FRs per WP).
  - The governance contract version is 1 and is immutable once bound. Future revisions create version 2, 3, etc.
  - Plan output should be deterministic given the same inputs (for reproducibility).
  - The generated WP prompts follow the task-prompt-template structure from `.kittify/missions/software-dev/templates/task-prompt-template.md`.

### Subtask T067 -- Implement WP file_scope detection and overlap graph

- **Purpose**: Parse each WP's planned implementation scope to identify which files it will touch, then build a graph of file overlaps between WPs to inform the scheduler.
- **Steps**:
  1. Add file scope detection to `commands/plan.rs` or create a utility module `crates/agileplus-cli/src/commands/scope.rs`.
  2. Implement `detect_file_scope(wp_description: &str, repo_files: &[String]) -> Vec<String>`:
     - Parse file paths mentioned in WP acceptance criteria and description.
     - Match patterns: explicit paths (`src/foo/bar.rs`), glob patterns (`src/models/*.rs`), module references (`the auth module`).
     - Cross-reference with actual repo file listing to validate paths exist or are plausible new files.
     - Return deduplicated, sorted file path list.
  3. Implement `build_overlap_graph(wps: &[WorkPackage]) -> OverlapGraph`:
     ```rust
     pub struct OverlapGraph {
         edges: Vec<(WpId, WpId, Vec<String>)>,  // (wp_a, wp_b, shared_files)
     }
     ```
     - For each pair of WPs, compute `file_scope` intersection.
     - If intersection is non-empty, add an edge with the shared file list.
  4. Implement `OverlapGraph::parallel_groups(&self) -> Vec<Vec<WpId>>`:
     - Graph coloring: WPs with no overlap edges can be in the same parallel group.
     - Use a greedy coloring algorithm (NP-hard in general, greedy is good enough for 10-20 WPs).
     - Return groups where all WPs within a group have no overlapping files.
  5. Add overlap-based dependencies to the WP dependency records:
     - For each overlap edge, create a `WpDependency` with `type: "file_overlap"`.
     - The lower-sequence WP executes first (breaks ties).
  6. Store `file_scope` as JSON array in the WP record.
- **Files**: `crates/agileplus-cli/src/commands/scope.rs` (new) or inline in `plan.rs`
- **Parallel?**: No -- integrated with T066 (plan command).
- **Notes**:
  - File scope detection is inherently imprecise. It is better to over-estimate (serialize when unsure) than under-estimate (risk merge conflicts).
  - Start with simple path extraction (regex for file paths). Advanced heuristics (module name resolution) can come later.
  - The overlap graph is small (O(n^2) where n < 20 WPs). No need for sophisticated graph algorithms.

### Subtask T068 -- Implement dependency-aware scheduler

- **Purpose**: Given the WP dependency graph (explicit + file overlap), determine execution order: which WPs can run in parallel and which must wait for predecessors.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/scheduler.rs`.
  2. Implement `Scheduler` struct:
     ```rust
     pub struct Scheduler {
         wps: Vec<WorkPackage>,
         deps: Vec<WpDependency>,
     }
     ```
  3. Implement `Scheduler::execution_plan(&self) -> Vec<ExecutionWave>`:
     ```rust
     pub struct ExecutionWave {
         pub wave_number: u32,
         pub wp_ids: Vec<WpId>,
     }
     ```
     - Topological sort of the dependency graph.
     - Group into waves: wave 0 = WPs with no dependencies; wave 1 = WPs whose deps are all in wave 0; etc.
     - Within each wave, all WPs can run in parallel.
  4. Implement `Scheduler::next_ready(&self, completed: &HashSet<WpId>) -> Vec<WpId>`:
     - Return WPs whose dependencies are all in the `completed` set and whose state is `planned`.
     - This is the runtime query used during `implement` to decide what to dispatch next.
  5. Implement `Scheduler::is_blocked(&self, wp_id: WpId, completed: &HashSet<WpId>) -> Option<Vec<WpId>>`:
     - If the WP has unmet dependencies, return the list of blocking WP IDs.
  6. Implement cycle detection in the dependency graph:
     - Run DFS-based cycle detection during plan generation.
     - If a cycle is found, report it as an error with the cycle path.
  7. Handle the special case of a single WP with no dependencies (trivial plan).
- **Files**: `crates/agileplus-cli/src/commands/scheduler.rs`
- **Parallel?**: No -- integrated with T066 (plan) and T069 (implement).
- **Notes**:
  - The topological sort uses Kahn's algorithm (BFS-based) for simplicity and O(V+E) performance.
  - The scheduler is stateless -- it computes from the current WP/dependency state each time. No persistent scheduler state.
  - Unit test with a diamond dependency pattern: A -> B, A -> C, B -> D, C -> D. Verify D is in wave 2 (not wave 1).

### Subtask T069 -- Implement `commands/implement.rs`: Worktree creation, agent dispatch, PR creation

- **Purpose**: Implement the implement command that orchestrates the full agent workflow: check dependencies, create worktrees, dispatch agents, create PRs, and manage the review-fix loop.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/implement.rs`.
  2. Implement `run_implement(args: ImplementArgs, ctx: &AppContext) -> Result<()>`:
     - Validate feature state is `planned` (or `implementing` for resume).
     - Transition feature to `implementing` if not already.
     - Build the scheduler from WP records and dependencies.
     - Loop until all WPs are `done` or a WP is `blocked` beyond max retries:
       a. Query `scheduler.next_ready(completed_wps)`.
       b. For each ready WP (up to `--parallel` limit):
          - Create worktree via VcsPort: `.worktrees/{slug}-{wp_id}/`.
          - Dispatch agent via AgentPort: pass WP prompt, spec, plan, data model as context.
          - Wait for agent to complete (commits, pushes).
          - Create PR via AgentPort: `gh pr create` with structured description (T070).
          - Enter review-fix loop (T071).
       c. When a WP's PR is merged, mark WP as `done`, add to completed set.
       d. Record metrics for each WP (duration, agent runs, review cycles).
  3. Define `ImplementArgs`:
     ```rust
     #[derive(Args)]
     struct ImplementArgs {
         #[arg(long)]
         feature: String,

         /// Implement a specific WP only
         #[arg(long)]
         wp: Option<String>,

         /// Max parallel agents
         #[arg(long, default_value = "3")]
         parallel: usize,

         /// Max review-fix cycles per WP
         #[arg(long, default_value = "5")]
         max_review_cycles: u32,

         /// Resume from last checkpoint
         #[arg(long)]
         resume: bool,
     }
     ```
  4. Implement single-WP mode (`--wp WP01`):
     - Skip scheduler, directly dispatch the named WP.
     - Still check dependencies are met (all deps must be `done`).
  5. Implement resume mode (`--resume`):
     - Query SQLite for WPs in `doing` or `review` state.
     - For `doing`: check if worktree exists, re-attach to agent output.
     - For `review`: re-enter review-fix loop.
  6. Implement cancellation handling:
     - Catch SIGINT/SIGTERM.
     - Mark in-progress WPs as `blocked` with reason "cancelled by user".
     - Clean up worktrees.
     - Append audit entry for each cancelled WP.
     - Exit gracefully.
- **Files**: `crates/agileplus-cli/src/commands/implement.rs`
- **Parallel?**: Yes, independent of T066-T068 (different command file).
- **Notes**:
  - The implement command is long-running (minutes to hours). Progress should be printed to stdout regularly.
  - Use `tokio::select!` for concurrent WP dispatch with cancellation.
  - Agent dispatch is fire-and-forget with polling. The agent runs as a subprocess; the implement command polls for completion (PR created, commits pushed).
  - Worktree cleanup happens after PR merge, not after agent completes. The worktree is needed during the review-fix loop.

### Subtask T070 -- Implement PR description builder

- **Purpose**: Generate structured PR descriptions that include the WP goal, FR references, acceptance criteria, and spec context, per FR-011.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/pr_builder.rs`.
  2. Implement `build_pr_description(wp: &WorkPackage, feature: &Feature, spec_content: &str) -> String`:
     - Generate a Markdown PR body:
       ```markdown
       ## Work Package: {wp.title}

       **Feature**: {feature.friendly_name} (`{feature.slug}`)
       **WP ID**: {wp.id} | **Sequence**: {wp.sequence}

       ### Goal
       {wp.acceptance_criteria}

       ### Functional Requirements
       {extracted FR references from acceptance criteria, linked to spec sections}

       ### File Scope
       {wp.file_scope as bullet list}

       ### Context
       This PR implements work package {wp.id} of feature {feature.slug}.
       Full specification: `kitty-specs/{feature.slug}/spec.md`
       Implementation plan: `kitty-specs/{feature.slug}/plan.md`

       ### Acceptance Criteria
       {wp.acceptance_criteria as checklist}

       ---
       *Generated by AgilePlus spec-driven development engine*
       ```
  3. Implement `build_pr_title(wp: &WorkPackage) -> String`:
     - Format: `"WP{wp.id:02}: {wp.title}"` (e.g., "WP09: Code Review Adapter").
     - Truncate to 72 characters if needed.
  4. Implement FR extraction:
     - Parse acceptance criteria for `FR-NNN` references.
     - For each FR reference, extract the one-line description from spec.md.
     - Format as a linked list in the PR body.
  5. Implement acceptance criteria as a GitHub-compatible checklist:
     - Convert each criterion to `- [ ] criterion text`.
     - These become checkable items in the PR UI.
- **Files**: `crates/agileplus-cli/src/commands/pr_builder.rs`
- **Parallel?**: No -- used by T069 (implement command).
- **Notes**:
  - GitHub PR body supports Markdown. Use full Markdown formatting.
  - PR descriptions serve as the audit evidence for what was intended. They must be complete enough that a reviewer understands the WP without reading the full plan.
  - Keep the description under 65535 characters (GitHub limit).

### Subtask T071 -- Implement review-fix loop orchestrator

- **Purpose**: Orchestrate the loop where AgilePlus waits for code review (Coderabbit + CI), feeds feedback to the agent for fixes, re-pushes, and re-polls until the PR is approved and CI passes.
- **Steps**:
  1. Create `crates/agileplus-cli/src/commands/review_loop.rs`.
  2. Implement `run_review_loop(wp: &WorkPackage, ctx: &AppContext, max_cycles: u32) -> Result<ReviewOutcome>`:
     ```rust
     pub enum ReviewOutcome {
         Approved,
         MaxCyclesReached { cycles: u32, last_comments: Vec<String> },
         CiFailed { details: Vec<CheckResult> },
         Cancelled,
     }
     ```
  3. The loop:
     ```
     for cycle in 1..=max_cycles {
         // 1. Wait for CI to complete
         let ci = ctx.review.check_ci_status(pr_number).await?;
         if ci == CiStatus::Failed { return CiFailed }

         // 2. Wait for Coderabbit review
         let review = ctx.review.await_review(pr_number, poll_interval).await?;

         match review {
             ReviewStatus::Approved => return Ok(Approved),
             ReviewStatus::ChangesRequested(comments) => {
                 // 3. Feed comments to agent
                 let actionable = comments.iter().filter(|c| c.is_actionable).collect();
                 ctx.agent.send_instruction(wp.agent_id, format_feedback(actionable)).await?;

                 // 4. Wait for agent to push fixes
                 ctx.agent.await_completion(wp.agent_id).await?;

                 // 5. Record cycle metric
                 ctx.telemetry.record_metric("review_cycle", cycle, labels).await?;
             }
             ReviewStatus::Pending => {
                 // Still waiting, poll again
                 tokio::time::sleep(poll_interval).await;
             }
         }
     }
     return Ok(MaxCyclesReached { ... })
     ```
  4. Implement `format_feedback(comments: &[CoderabbitComment]) -> String`:
     - Convert structured comments into a prompt the agent can understand.
     - Include file path, line number, and actionable text.
     - Format as numbered list for clarity.
  5. Implement progress reporting:
     - Print "Review cycle {n}/{max}: {status}" after each iteration.
     - Print "Waiting for CI..." / "Waiting for review..." during polls.
  6. Handle edge cases:
     - PR closed by someone else: detect via GitHub API, abort with error.
     - Agent crashes during fix cycle: detect subprocess exit, retry once, then mark blocked.
     - Network error during poll: retry with exponential backoff, fail after 3 retries.
  7. When `MaxCyclesReached`: mark WP as `blocked`, append audit entry with governance exception, print warning with the unresolved comments.
- **Files**: `crates/agileplus-cli/src/commands/review_loop.rs`
- **Parallel?**: No -- used by T069 (implement command).
- **Notes**:
  - The poll interval should be configurable (default 30s for CI, 60s for review).
  - Each review cycle is a child span under the WP's agent span for telemetry.
  - The review loop is the longest-running part of implement. It must be robust against transient failures.
  - Consider adding a `--dry-run` mode that simulates the loop without actual API calls (for testing).

### Subtask T072 -- Wire plan/implement to all ports

- **Purpose**: Extend the `AppContext` from WP11 to include AgentPort and ReviewPort, update the subcommand routing to include plan and implement.
- **Steps**:
  1. Update `AppContext` in `main.rs` or `context.rs`:
     ```rust
     struct AppContext {
         storage: Box<dyn StoragePort>,
         vcs: Box<dyn VcsPort>,
         telemetry: Box<dyn ObservabilityPort>,
         agent: Box<dyn AgentPort>,       // NEW
         review: Box<dyn ReviewPort>,     // NEW
     }
     ```
  2. Update `AppContext::init()` to construct the new adapters:
     - `AgentDispatchAdapter::new(agent_config)?`
     - `ReviewAdapter::new(review_config)?`
  3. Add `Plan` and `Implement` to the `Commands` enum in `main.rs`:
     ```rust
     #[derive(Subcommand)]
     enum Commands {
         Specify(SpecifyArgs),
         Research(ResearchArgs),
         Plan(PlanArgs),         // NEW
         Implement(ImplementArgs), // NEW
     }
     ```
  4. Route to handlers:
     ```rust
     Commands::Plan(args) => commands::plan::run_plan(args, &ctx).await?,
     Commands::Implement(args) => commands::implement::run_implement(args, &ctx).await?,
     ```
  5. Update `TestContext` with mock AgentPort and ReviewPort.
  6. Add module declarations in `commands/mod.rs`: `pub mod plan; pub mod implement; pub mod scheduler; pub mod scope; pub mod pr_builder; pub mod review_loop;`.
- **Files**:
  - `crates/agileplus-cli/src/main.rs` (extend)
  - `crates/agileplus-cli/src/context.rs` (extend)
  - `crates/agileplus-cli/src/commands/mod.rs` (extend)
- **Parallel?**: No -- depends on T066-T071.
- **Notes**:
  - The agent and review adapters may need configuration that was not available in WP11 (API keys, endpoints). Load from `~/.agileplus/config.toml`.
  - If agent or review config is missing, the `plan` command should still work (it does not dispatch agents). Only `implement` requires these adapters.
  - Consider lazy initialization: only construct AgentPort and ReviewPort when the implement command is invoked.

---

## Test Strategy

### Unit Tests
- Location: `crates/agileplus-cli/tests/`
- Run: `cargo test -p agileplus-cli`

### Scheduler Tests
- Diamond dependency graph resolves to 3 waves.
- Cycle detection catches A -> B -> A.
- Single WP with no deps returns immediately.
- `next_ready` returns correct WPs as predecessors complete.

### Plan Command Tests
- Mock VcsPort returns fixture spec + research.
- Verify WP records created in MockStoragePort.
- Verify governance contract created.
- Verify state transition `researched -> planned`.

### Implement Command Tests
- Mock all ports: agent returns success, review returns approved.
- Verify worktree created via MockVcsPort.
- Verify PR created with correct description.
- Test review loop: mock 2 cycles of changes_requested then approved.
- Test max cycles reached: verify WP marked blocked.
- Test resume mode: mock WP in `doing` state, verify re-entry.

### PR Builder Tests
- Verify FR references extracted from acceptance criteria.
- Verify checklist format.
- Verify title truncation at 72 chars.

### CLI Integration Tests
- `agileplus plan --feature test-001` with fixture data.
- `agileplus implement --feature test-001 --wp WP01` with mock agents.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent dispatch fails silently | WP stuck in `doing` forever | Subprocess health checks, timeout, automatic `blocked` transition |
| Review loop infinite wait | Implement command hangs | Bounded max cycles, configurable timeouts, Ctrl+C handling |
| Dependency cycle in generated plan | Implement command deadlocks | Cycle detection in planner, reject cyclic plans |
| File scope detection misses overlaps | Merge conflicts at ship time | Conservative overlap estimation, manual override flag |
| GitHub API rate limits during review loop | Loop cannot poll | Exponential backoff, ETag caching, configurable poll interval |
| Agent produces invalid code | Repeated review failures exhaust cycles | Max cycle limit, escalation to `blocked` with human intervention prompt |
| Worktree cleanup failure | Disk space leak | Periodic worktree prune, cleanup on Ctrl+C |

---

## Review Guidance

1. **Scheduler correctness**: Verify topological sort produces valid execution order for various graph shapes (linear, diamond, forest).
2. **State machine compliance**: Verify `researched -> planned` and `planned -> implementing` transitions with proper audit entries.
3. **Agent dispatch safety**: Verify subprocess spawning handles PATH issues, missing binaries, and permission errors.
4. **Review loop bounds**: Verify max_cycles is enforced and `blocked` state is set correctly.
5. **PR description quality**: Generate a sample PR description from fixture data. Verify it contains all required sections.
6. **Cancellation safety**: Simulate Ctrl+C during implement. Verify worktrees are cleaned up and audit entries recorded.
7. **Resume correctness**: Start implement, kill it, resume. Verify no duplicate WP processing.
8. **Error messages**: Trigger common errors (missing deps, agent not found) and verify messages guide the user.

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
2. **Use CLI**: `spec-kitty agent tasks move-task WP12 --to <lane> --note "message"` (recommended)

**Initial entry**:
- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-28T10:00:27Z – claude-wp12 – shell_pid=90068 – lane=doing – Assigned agent via workflow command
- 2026-02-28T10:09:35Z – claude-wp12 – shell_pid=90068 – lane=done – Review passed: plan+implement commands, 48 tests
