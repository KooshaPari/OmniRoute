---
work_package_id: WP13
title: CLI — Validate, Ship, Retrospective Commands
lane: "done"
dependencies: [WP12]
base_branch: 001-spec-driven-development-engine-WP12
base_commit: 2f93f2ace72787c10f041c2a5b3067621b7c927f
created_at: '2026-02-28T10:09:41.414943+00:00'
subtasks:
- T073
- T074
- T075
- T076
- T077
- T078
phase: Phase 3 - CLI
assignee: ''
agent: "claude-wp13"
shell_pid: "97285"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP13: CLI — Validate, Ship, Retrospective Commands

## Implementation Command

```bash
spec-kitty implement WP13 --base WP12
```

## Objectives

Complete the 7-command AgilePlus CLI workflow by implementing the final three commands:
`validate`, `ship`, and `retrospective`. These commands close the development lifecycle loop
by verifying governance compliance, merging work to the target branch, and extracting
actionable learnings from the development process.

### Success Criteria

1. `agileplus validate <feature>` checks all governance contract rules, traces every FR to
   evidence, evaluates policy rules, and produces a structured validation report.
2. `agileplus ship <feature>` merges all WP branches to the target branch, cleans up
   worktrees, archives the feature directory, and finalizes the audit chain.
3. `agileplus retrospective <feature>` queries metrics, analyzes review cycle counts and
   durations, and generates a markdown retrospective report with constitution amendment
   suggestions.
4. All three commands enforce the feature state machine: validate requires `implementing`
   state, ship requires `validated` state, retrospective requires `shipped` state.
5. Every state transition is logged in the hash-chained audit trail with proper evidence
   references.
6. All commands are wired to StoragePort, VcsPort, ReviewPort, ObservabilityPort via the
   existing dependency injection pattern established in WP11/WP12.

## Context & Constraints

### Architecture Context

- These commands live in `crates/agileplus-cli/src/commands/` alongside the existing
  `specify.rs`, `research.rs`, `plan.rs`, and `implement.rs` from WP11/WP12.
- All commands follow the hexagonal architecture pattern: command handlers call domain
  services through port traits, never touching adapter internals directly.
- The CLI uses clap derive macros. Each command is a subcommand variant in the main App enum.

### Domain Context

- The Feature state machine (from WP03) enforces strict ordering:
  `implementing -> validated -> shipped -> retrospected`.
- Skip transitions are allowed but log a governance exception in the audit trail.
- Governance contracts (from WP04) define required evidence per state transition.
- The audit chain (from WP04) uses SHA-256 hash chaining: each entry references the
  previous entry's hash.

### Prior Work Dependencies

- WP12 provides: `implement` command, PR description builder, review-fix loop orchestrator,
  dependency-aware scheduler.
- WP06 provides: SQLite storage adapter (all CRUD operations).
- WP07 provides: Git adapter (worktree ops, branch merge, artifact read/write).
- WP10 provides: Telemetry adapter (traces, metrics, structured logging).
- WP04 provides: Governance contract evaluation, audit chain verification.

### Constraints

- Validate must never modify feature state if any governance gate fails.
- Ship must be atomic: either all merges succeed or the feature remains in `validated` state.
- Retrospective is optional (shipped -> retrospected is not required to start new features).
- All SQLite writes use the existing WAL-mode connection pool from WP06.

---

## Subtask Guidance

### T073: Implement `commands/validate.rs` — FR-to-Evidence Tracing and Validation Report

**File**: `crates/agileplus-cli/src/commands/validate.rs`

**Purpose**: The validate command checks that every functional requirement referenced in the
governance contract has corresponding evidence artifacts, and that all policy rules pass.

**Implementation Steps**:

1. Define the clap subcommand struct:
   ```rust
   #[derive(Parser)]
   pub struct ValidateArgs {
       /// Feature slug to validate
       feature: String,
       /// Output format for validation report
       #[arg(long, default_value = "markdown")]
       format: OutputFormat,
       /// Skip policy rule evaluation (evidence-only check)
       #[arg(long)]
       skip_policies: bool,
       /// Write report to file instead of stdout
       #[arg(long)]
       output: Option<PathBuf>,
   }
   ```

2. Load the feature from StoragePort by slug. Verify current state is `implementing`
   (or allow skip with warning if `--force` flag).

3. Load the active governance contract for the feature. The contract contains an array of
   rules, each specifying a `transition` and its `required_evidence` array.

4. For each rule matching the `implementing -> validated` transition:
   - Extract the list of `required_evidence` items (each has `fr_id`, `type`, and optional
     thresholds like `min_coverage` or `max_critical`).
   - Query the evidence table via StoragePort for matching records: filter by feature's WPs,
     matching `fr_id` and `type`.
   - Check threshold constraints: if `min_coverage` is set, parse the evidence metadata JSON
     and compare. If `max_critical` is set, count critical findings.
   - Record pass/fail for each evidence requirement.

5. Build a `ValidationReport` struct containing:
   - `feature_slug`, `timestamp`, `overall_pass: bool`
   - `evidence_results: Vec<EvidenceCheck>` with fr_id, type, found, threshold_met
   - `policy_results: Vec<PolicyCheck>` with policy_id, domain, passed, message
   - `missing_evidence: Vec<(String, String)>` listing (fr_id, type) pairs not found
   - `governance_exceptions: Vec<String>` for any skip-with-warning items

6. Format the report as markdown (default) or JSON. Write to stdout or file.

7. If `overall_pass` is true, the command succeeds with exit code 0. If false, exit code 1
   with the report showing what failed.

8. Do NOT transition state here. The validate command only reports. The caller (or a
   subsequent `ship` command) uses the validation result.

**Edge Cases**:
- Feature has no governance contract: fail with clear error suggesting `agileplus plan` first.
- Evidence artifacts referenced in DB but missing from git: warn, mark as `artifact_missing`.
- Multiple governance contract versions: use the latest `version` for the feature.

**Testing**: Unit test with mock StoragePort returning preset evidence records. Test pass
case, fail case (missing evidence), and threshold violation case.

---

### T074: Implement Governance Gate Evaluator

**File**: `crates/agileplus-cli/src/commands/validate.rs` (or extracted to
`crates/agileplus-core/src/domain/governance_eval.rs` if reused elsewhere)

**Purpose**: Evaluate all governance contract rules and policy rules, collecting violations
into a structured result. This is the core logic that T073 calls.

**Implementation Steps**:

1. Define a `GovernanceEvaluator` struct that takes references to StoragePort and the loaded
   governance contract:
   ```rust
   pub struct GovernanceEvaluator<'a, S: StoragePort> {
       storage: &'a S,
       contract: &'a GovernanceContract,
       feature_id: i64,
   }
   ```

2. Implement `evaluate_evidence(&self) -> Result<Vec<EvidenceCheck>>`:
   - Iterate contract rules for the target transition.
   - For each required evidence item, query storage for matching evidence records.
   - Apply threshold checks by parsing evidence metadata JSON.
   - Return a vector of check results.

3. Implement `evaluate_policies(&self) -> Result<Vec<PolicyCheck>>`:
   - Load all active policy rules from StoragePort filtered by referenced `policy_refs`.
   - For each policy rule, evaluate against available evidence and feature state.
   - Policy rule evaluation is domain-based:
     - `quality`: check test coverage meets threshold, lint results clean.
     - `security`: check security scan results, no critical vulnerabilities.
     - `reliability`: check CI pass rate, no flaky test indicators.
   - Return a vector of policy check results.

4. Implement `evaluate_all(&self) -> Result<ValidationResult>`:
   - Call both `evaluate_evidence()` and `evaluate_policies()`.
   - Combine into a single `ValidationResult` with an `overall_pass` computed as
     `all evidence checks pass AND all policy checks pass`.
   - Include any governance exceptions (e.g., missing policy rules referenced but not found).

5. The evaluator should be stateless and testable: all data comes through StoragePort,
   no side effects.

**Design Note**: Consider placing this in `agileplus-core/src/domain/` since it is pure
domain logic that both CLI and API might need. The CLI command would instantiate it with
the concrete adapter, but the logic itself depends only on port traits.

**Testing**: Extensive unit tests with mock StoragePort. Test matrix:
- All evidence present and passing -> overall pass.
- One evidence missing -> overall fail, correct item identified.
- Evidence present but threshold violated -> overall fail with threshold details.
- Policy rule fails -> overall fail even if all evidence present.
- No policy rules referenced -> evidence-only evaluation succeeds.

---

### T075: Implement `commands/ship.rs` — Merge, Cleanup, Archive, Finalize Audit

**File**: `crates/agileplus-cli/src/commands/ship.rs`

**Purpose**: The ship command merges completed feature work to the target branch, cleans up
worktrees, archives the feature spec directory, and writes the final audit entry.

**Implementation Steps**:

1. Define the clap subcommand struct:
   ```rust
   #[derive(Parser)]
   pub struct ShipArgs {
       /// Feature slug to ship
       feature: String,
       /// Target branch override (default: feature.target_branch)
       #[arg(long)]
       target: Option<String>,
       /// Skip validation check (dangerous)
       #[arg(long)]
       skip_validate: bool,
       /// Dry run: show what would be merged without doing it
       #[arg(long)]
       dry_run: bool,
   }
   ```

2. Load the feature from StoragePort. Verify state is `validated`. If not validated and
   `--skip-validate` is not set, fail with instruction to run `agileplus validate` first.

3. Determine the target branch (from args or `feature.target_branch`, default `main`).

4. Collect all WPs for the feature in sequence order. For each WP in `done` state that has
   a `pr_url`:
   - Verify the PR is merged (query via ReviewPort or check pr_state in DB).
   - If PR is not merged, attempt merge via VcsPort: `merge_to_target(wp.branch, target)`.
   - If merge conflict detected, abort the entire ship operation. Report the conflicting
     WP, the conflicting files, and suggest manual resolution steps.

5. If `--dry-run`, print the merge plan (which branches would merge, in what order) and exit.

6. After all merges succeed:
   - Clean up worktrees via VcsPort: `cleanup_worktree(feature, wp)` for each WP.
   - Delete remote branches that were merged (via VcsPort or `gh` CLI call).

7. Archive the feature:
   - Update `meta.json` in the feature's spec directory with final state and ship timestamp.
   - Write the final `audit/chain.jsonl` entry via VcsPort artifact operations.
   - Commit the updated meta.json and final audit entry to the target branch.

8. Update SQLite state:
   - Transition feature state to `shipped` via StoragePort.
   - Append the final audit entry with SHA-256 hash chaining.
   - Record a metric entry (total duration from `created` to `shipped`, total agent runs,
     total review cycles across all WPs).

9. Emit telemetry span for the ship operation via ObservabilityPort.

10. Print a summary: feature slug, WPs merged, branches cleaned, final audit hash.

**Atomicity Strategy**:
- Perform all git merges first. If any fail, roll back by resetting the target branch to
  its pre-ship state (save the ref before starting).
- SQLite updates happen after all git operations succeed.
- If SQLite update fails after git success, log error but do not attempt git rollback
  (git is source of truth; SQLite can be rebuilt).

**Edge Cases**:
- Feature has WPs still in `doing` or `review` state: fail, list incomplete WPs.
- Target branch has diverged since validation: detect via git2 merge analysis, warn user.
- Worktree already cleaned up (manual deletion): skip cleanup, log info.

**Testing**: Integration test with temp git repo. Create feature with 2 WPs, mock merge
operations, verify worktree cleanup and audit finalization.

---

### T076: Implement `commands/retrospective.rs` — Learnings and Constitution Amendments

**File**: `crates/agileplus-cli/src/commands/retrospective.rs`

**Purpose**: Analyze the completed feature's development history (metrics, review cycles,
agent performance) and generate a retrospective report with actionable suggestions for
improving the development process and governance constitution.

**Implementation Steps**:

1. Define the clap subcommand struct:
   ```rust
   #[derive(Parser)]
   pub struct RetrospectiveArgs {
       /// Feature slug to retrospect
       feature: String,
       /// Output file path (default: kitty-specs/<feature>/retrospective.md)
       #[arg(long)]
       output: Option<PathBuf>,
       /// Include raw metric data in report
       #[arg(long)]
       verbose: bool,
   }
   ```

2. Load the feature from StoragePort. Verify state is `shipped`. If not shipped, fail with
   message that retrospective requires a shipped feature.

3. Query metrics from StoragePort for the feature:
   - Total wall-clock time (created_at to shipped timestamp from last audit entry).
   - Per-command durations (specify, research, plan, implement, validate, ship).
   - Per-WP metrics: agent runs, review cycles, duration.
   - Aggregate: total agent invocations, total review cycles, average cycles per WP.

4. Query the audit trail for the feature:
   - Count state transitions and time between each.
   - Identify governance exceptions (skip transitions).
   - Identify any WPs that were blocked and for how long.

5. Analyze patterns and generate insights:
   - **Bottleneck detection**: WPs with >3 review cycles suggest unclear acceptance criteria
     or complex code areas. Flag these with the WP title and review count.
   - **Agent efficiency**: Compare agent runs to WP count. High ratio suggests agent
     failures or restarts. Suggest prompt improvements.
   - **Governance health**: If skip transitions occurred, note which transitions were skipped
     and suggest whether the governance contract was too strict or the process unclear.
   - **Time distribution**: Calculate percentage of time in each phase. If >50% was in
     implement+review, suggest breaking WPs into smaller units.

6. Generate constitution amendment suggestions:
   - If review cycles were consistently high, suggest adding a "pre-review self-check" rule.
   - If governance exceptions occurred, suggest relaxing the specific rule or adding a
     fast-track path.
   - If certain policy domains had no violations, suggest whether they can be simplified.
   - Format as actionable TOML snippets that could be added to a constitution file.

7. Build the retrospective report as markdown:
   ```markdown
   # Retrospective: <feature friendly_name>
   ## Summary
   - Total duration: X days
   - Work packages: N (N parallel, N serial)
   - Agent invocations: N
   - Review cycles: N (avg M per WP)
   ## Phase Breakdown
   | Phase | Duration | % of Total |
   ## WP Performance
   | WP | Title | Agent Runs | Review Cycles | Duration |
   ## Insights
   - ...
   ## Suggested Constitution Amendments
   - ...
   ```

8. Write the report to the output path (default: `kitty-specs/<feature>/retrospective.md`).
   Also commit it to git via VcsPort.

9. Transition feature state to `retrospected` in StoragePort. Append audit entry.

**Testing**: Unit test with mock metrics data. Verify insights are generated correctly for
known patterns (high review cycles, governance exceptions, etc.).

---

### T077: Implement Strict State Machine Enforcement in All Commands

**File**: Multiple files — add enforcement to each command handler.

**Purpose**: Every CLI command must verify the feature's current state before proceeding and
transition to the correct next state upon completion. This subtask adds consistent
enforcement across validate, ship, and retrospective (and audits the existing specify,
research, plan, implement commands for consistency).

**Implementation Steps**:

1. Create a shared state enforcement helper (if not already present from WP11/WP12):
   ```rust
   // crates/agileplus-core/src/domain/state_machine.rs or a new helper module
   pub fn require_state(
       feature: &Feature,
       required: FeatureState,
       command_name: &str,
   ) -> Result<(), DomainError> {
       if feature.state == required {
           Ok(())
       } else {
           Err(DomainError::InvalidState {
               feature: feature.slug.clone(),
               current: feature.state.clone(),
               required,
               command: command_name.to_string(),
           })
       }
   }

   pub fn require_state_or_skip(
       feature: &Feature,
       required: FeatureState,
       command_name: &str,
       force: bool,
   ) -> Result<Option<GovernanceException>, DomainError> {
       if feature.state == required {
           Ok(None)
       } else if force {
           Ok(Some(GovernanceException {
               skipped_from: feature.state.clone(),
               expected: required,
               command: command_name.to_string(),
               timestamp: Utc::now(),
           }))
       } else {
           Err(DomainError::InvalidState { /* ... */ })
       }
   }
   ```

2. Add state checks to each command:
   - `validate.rs`: require `implementing` state.
   - `ship.rs`: require `validated` state.
   - `retrospective.rs`: require `shipped` state.

3. Add state transitions at command completion:
   - `validate` (on success): `implementing -> validated`.
   - `ship` (on success): `validated -> shipped`.
   - `retrospective` (on success): `shipped -> retrospected`.

4. Each transition must:
   - Update feature state in StoragePort.
   - Create a new AuditEntry with the transition, actor ("user" for CLI), evidence refs,
     and proper hash chaining (load previous entry, compute new hash).
   - Emit a telemetry event via ObservabilityPort.

5. If a skip transition occurs (force flag), additionally:
   - Log a governance exception in the audit trail.
   - Print a warning to stderr with the skipped states.

6. Audit existing commands from WP11/WP12 for consistency with this pattern. If they use
   a different approach, refactor to use the shared helper.

**Testing**: Test each command with correct state (should proceed), wrong state without
force (should error), wrong state with force (should warn and proceed). Verify audit entries
are created with correct hashes.

---

### T078: Wire validate/ship/retro to All Ports

**File**: `crates/agileplus-cli/src/commands/mod.rs` and each command file.

**Purpose**: Connect the three new commands to the dependency injection system established
in WP11/WP12, ensuring they have access to all required port implementations.

**Implementation Steps**:

1. Register the three new subcommands in the main CLI App enum:
   ```rust
   #[derive(Subcommand)]
   enum Commands {
       Specify(SpecifyArgs),
       Research(ResearchArgs),
       Plan(PlanArgs),
       Implement(ImplementArgs),
       Validate(ValidateArgs),   // NEW
       Ship(ShipArgs),           // NEW
       Retrospective(RetrospectiveArgs), // NEW
   }
   ```

2. In the main dispatch function, add match arms for the new commands. Each receives the
   shared `AppContext` (or equivalent DI container) that holds concrete adapter instances:
   ```rust
   Commands::Validate(args) => {
       validate::execute(args, &ctx.storage, &ctx.vcs, &ctx.telemetry).await
   }
   Commands::Ship(args) => {
       ship::execute(args, &ctx.storage, &ctx.vcs, &ctx.review, &ctx.telemetry).await
   }
   Commands::Retrospective(args) => {
       retrospective::execute(args, &ctx.storage, &ctx.vcs, &ctx.telemetry).await
   }
   ```

3. Each command's `execute` function signature should accept port trait references:
   ```rust
   pub async fn execute(
       args: ValidateArgs,
       storage: &impl StoragePort,
       vcs: &impl VcsPort,
       telemetry: &impl ObservabilityPort,
   ) -> Result<()> { /* ... */ }
   ```

4. Verify that the `AppContext` initialization (from WP11) creates all needed adapters:
   - StoragePort (SqliteStorageAdapter from WP06)
   - VcsPort (GitVcsAdapter from WP07)
   - ReviewPort (ReviewAdapter from WP09) — needed by ship for PR status checks
   - ObservabilityPort (TelemetryAdapter from WP10)

5. Add integration smoke test: instantiate AppContext, call each command with a test
   feature, verify no runtime wiring errors.

**Testing**: Compile-time verification (trait bounds enforce correct wiring). Runtime smoke
test with in-memory mocks.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge conflicts at ship time | Ship fails, feature stuck in validated state | Detect conflicts early via git2 merge analysis; provide structured diff output; suggest manual resolution steps |
| Governance contract schema changes | Validate evaluator breaks on new rule formats | Use serde_json::Value for rule parsing with graceful fallback; version contracts |
| Retrospective metrics incomplete | Report has gaps | Degrade gracefully: show "N/A" for missing metrics; suggest running missing commands |
| State machine race conditions | Multiple CLI invocations on same feature | SQLite single-writer + WAL mode serializes writes; check-then-act is safe with single writer |
| Large number of WPs at ship time | Slow merge cascade | Parallelize independent merges (non-overlapping file scopes); show progress bar |

## Review Guidance

### What to Check

1. **State machine correctness**: Every command checks state before proceeding and
   transitions on completion. No state can be skipped without explicit force flag and
   governance exception logging.

2. **Audit chain integrity**: Each new audit entry correctly references the previous entry's
   hash. The hash computation matches the spec: `SHA-256(id || timestamp || actor ||
   transition || evidence_refs || prev_hash)`.

3. **Ship atomicity**: If any merge fails, no partial state is persisted. The target branch
   ref is saved before merges and can be restored.

4. **Governance evaluator completeness**: Every evidence type and policy domain from the
   data model is handled. No silent failures (unknown types should error, not skip).

5. **Port trait usage**: Commands never import concrete adapter types. All access goes
   through trait references.

6. **Error messages**: All error states produce actionable messages telling the user what
   command to run next.

### Acceptance Criteria Traceability

- FR-005 (Validate): T073, T074
- FR-006 (Ship): T075
- FR-007 (Retrospective): T076
- FR-018, FR-019 (Governance): T074
- FR-033, FR-034 (State Machine): T077
- FR-016 (Audit): T077 (hash chain on transitions)

---

## Activity Log

| Timestamp | Event |
|-----------|-------|
| 2026-02-27T00:00:00Z | WP13 prompt generated via /spec-kitty.tasks |
- 2026-02-28T10:09:41Z – claude-wp13 – shell_pid=97285 – lane=doing – Assigned agent via workflow command
- 2026-02-28T10:18:29Z – claude-wp13 – shell_pid=97285 – lane=done – Review passed: validate+ship+retro, 133 tests
