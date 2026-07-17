---
work_package_id: WP05
title: Port Traits
lane: "done"
dependencies: [WP03, WP04]
base_branch: 001-spec-driven-development-engine-WP03
base_commit: bd2389263a9c8f3633e8a0c02b8925276373627e
created_at: '2026-02-28T09:30:58.410469+00:00'
subtasks:
- T025
- T026
- T027
- T028
- T029
- T030
phase: Phase 1 - Domain
assignee: ''
agent: "claude-wp05"
shell_pid: "42392"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP05: Port Traits

## Implementation Command

```bash
spec-kitty implement WP05 --base WP04
```

## Objectives

Define all port traits in `crates/agileplus-core/src/ports/` that adapter crates will implement. These traits form the hexagonal architecture boundary between the domain layer and external infrastructure. Every adapter crate (SQLite, Git, Agents, Review, Telemetry) depends on these traits for its contract.

### Success Criteria

1. `cargo build --workspace` succeeds with all port traits defined and referenced by adapter crate stubs.
2. Every domain type from WP03 (Feature, WorkPackage, FeatureState, StateTransition, WpDependency) and WP04 (GovernanceContract, AuditEntry, Evidence, PolicyRule) is correctly referenced in port method signatures.
3. All port traits are async and return `Result<T, DomainError>`.
4. `ports/mod.rs` re-exports all traits, and each adapter crate's `Cargo.toml` depends on `agileplus-core`.
5. No adapter implementation logic exists in this WP -- traits only.

## Context & Constraints

- **Architecture**: Hexagonal / ports-and-adapters. The core crate defines port traits; adapter crates provide implementations. See `plan.md` dependency graph.
- **Async traits**: Use Rust 2024 native async trait support (the workspace targets Rust 2024 edition nightly). If native async traits cause issues, fall back to `async_trait` proc macro.
- **Error type**: All port methods return `Result<T, DomainError>`. Define `DomainError` in `crates/agileplus-core/src/domain/error.rs` if not already present from WP03/WP04.
- **Domain types**: Port signatures reference types from `domain/feature.rs`, `domain/work_package.rs`, `domain/governance.rs`, `domain/audit.rs`. These must exist from WP03 and WP04.
- **Data model reference**: See `data-model.md` for entity fields, relationships, and valid states.
- **Plan reference**: See `plan.md` "Project Structure" section for exact file paths.

## Subtask Guidance

---

### T025: Define `StoragePort` trait in `ports/storage.rs`

**Purpose**: Provide the persistence abstraction for all domain entities. The SQLite adapter (WP06) will implement this trait. The `rebuild_from_git` operation also uses this port.

**Steps**:
1. Create `crates/agileplus-core/src/ports/storage.rs`.
2. Import domain types: `Feature`, `FeatureState`, `WorkPackage`, `WpState`, `GovernanceContract`, `AuditEntry`, `Evidence`, `PolicyRule`, `Metric`, `WpDependency`.
3. Define the `StoragePort` trait with the following method groups:

**Feature CRUD**:
- `async fn create_feature(&self, feature: &Feature) -> Result<i64, DomainError>` -- returns new ID
- `async fn get_feature_by_slug(&self, slug: &str) -> Result<Option<Feature>, DomainError>`
- `async fn get_feature_by_id(&self, id: i64) -> Result<Option<Feature>, DomainError>`
- `async fn update_feature_state(&self, id: i64, state: FeatureState) -> Result<(), DomainError>`
- `async fn list_features_by_state(&self, state: FeatureState) -> Result<Vec<Feature>, DomainError>`
- `async fn list_all_features(&self) -> Result<Vec<Feature>, DomainError>`

**Work Package CRUD**:
- `async fn create_work_package(&self, wp: &WorkPackage) -> Result<i64, DomainError>`
- `async fn get_work_package(&self, id: i64) -> Result<Option<WorkPackage>, DomainError>`
- `async fn update_wp_state(&self, id: i64, state: WpState) -> Result<(), DomainError>`
- `async fn list_wps_by_feature(&self, feature_id: i64) -> Result<Vec<WorkPackage>, DomainError>`
- `async fn add_wp_dependency(&self, dep: &WpDependency) -> Result<(), DomainError>`
- `async fn get_wp_dependencies(&self, wp_id: i64) -> Result<Vec<WpDependency>, DomainError>`
- `async fn get_ready_wps(&self, feature_id: i64) -> Result<Vec<WorkPackage>, DomainError>` -- WPs whose deps are all `done`

**Audit CRUD**:
- `async fn append_audit_entry(&self, entry: &AuditEntry) -> Result<i64, DomainError>`
- `async fn get_audit_trail(&self, feature_id: i64) -> Result<Vec<AuditEntry>, DomainError>`
- `async fn get_latest_audit_entry(&self, feature_id: i64) -> Result<Option<AuditEntry>, DomainError>`

**Evidence + Policy + Metric CRUD**:
- `async fn create_evidence(&self, evidence: &Evidence) -> Result<i64, DomainError>`
- `async fn get_evidence_by_wp(&self, wp_id: i64) -> Result<Vec<Evidence>, DomainError>`
- `async fn get_evidence_by_fr(&self, fr_id: &str) -> Result<Vec<Evidence>, DomainError>`
- `async fn create_policy_rule(&self, rule: &PolicyRule) -> Result<i64, DomainError>`
- `async fn list_active_policies(&self) -> Result<Vec<PolicyRule>, DomainError>`
- `async fn record_metric(&self, metric: &Metric) -> Result<i64, DomainError>`
- `async fn get_metrics_by_feature(&self, feature_id: i64) -> Result<Vec<Metric>, DomainError>`

**Governance**:
- `async fn create_governance_contract(&self, contract: &GovernanceContract) -> Result<i64, DomainError>`
- `async fn get_governance_contract(&self, feature_id: i64, version: i32) -> Result<Option<GovernanceContract>, DomainError>`
- `async fn get_latest_governance_contract(&self, feature_id: i64) -> Result<Option<GovernanceContract>, DomainError>`

4. Ensure all method signatures use borrowed references for inputs (`&self`, `&Feature`) and owned types for outputs.
5. Add doc comments to the trait and each method referencing the relevant FR IDs.

**Files**: `crates/agileplus-core/src/ports/storage.rs`

**Validation**:
- `cargo check -p agileplus-core` succeeds.
- Every entity from `data-model.md` has at least create/get/list coverage.
- Method signatures are consistent (borrowed inputs, owned outputs, `DomainError` errors).

---

### T026: Define `VcsPort` trait in `ports/vcs.rs`

**Purpose**: Abstract git operations so tests can use an in-memory mock. The Git adapter (WP07) implements this with `git2`.

**Steps**:
1. Create `crates/agileplus-core/src/ports/vcs.rs`.
2. Import relevant types: `Feature`, `WorkPackage`, and any path/string types needed.
3. Define the `VcsPort` trait:

**Worktree operations** (FR-010):
- `async fn create_worktree(&self, feature_slug: &str, wp_id: &str) -> Result<PathBuf, DomainError>` -- returns worktree absolute path
- `async fn list_worktrees(&self) -> Result<Vec<WorktreeInfo>, DomainError>`
- `async fn cleanup_worktree(&self, worktree_path: &Path) -> Result<(), DomainError>`

**Branch operations**:
- `async fn create_branch(&self, branch_name: &str, base: &str) -> Result<(), DomainError>`
- `async fn checkout_branch(&self, branch_name: &str) -> Result<(), DomainError>`
- `async fn merge_to_target(&self, source: &str, target: &str) -> Result<MergeResult, DomainError>`
- `async fn detect_conflicts(&self, source: &str, target: &str) -> Result<Vec<ConflictInfo>, DomainError>`

**Artifact operations** (FR-014):
- `async fn read_artifact(&self, feature_slug: &str, relative_path: &str) -> Result<String, DomainError>`
- `async fn write_artifact(&self, feature_slug: &str, relative_path: &str, content: &str) -> Result<(), DomainError>`
- `async fn artifact_exists(&self, feature_slug: &str, relative_path: &str) -> Result<bool, DomainError>`

**History scanning** (FR-017 support):
- `async fn scan_feature_artifacts(&self, feature_slug: &str) -> Result<FeatureArtifacts, DomainError>`

4. Define supporting types in the same file or a `ports/types.rs`:
   - `WorktreeInfo { path: PathBuf, branch: String, feature_slug: String, wp_id: String }`
   - `MergeResult { success: bool, conflicts: Vec<ConflictInfo>, merged_commit: Option<String> }`
   - `ConflictInfo { path: String, ours: Option<String>, theirs: Option<String> }`
   - `FeatureArtifacts { meta_json: Option<String>, audit_chain: Option<String>, evidence_paths: Vec<String> }`

**Files**: `crates/agileplus-core/src/ports/vcs.rs`

**Validation**:
- `cargo check -p agileplus-core` succeeds.
- Worktree path convention matches plan.md: `.worktrees/<feature-slug>-<WP-id>/`.
- Supporting types are serializable (`#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]`).

---

### T027: Define `AgentPort` trait in `ports/agent.rs`

**Purpose**: Abstract agent dispatch so different agent backends (Claude Code, Codex, future agents) are interchangeable. The Agent Dispatch adapter (WP08) implements this.

**Steps**:
1. Create `crates/agileplus-core/src/ports/agent.rs`.
2. Define supporting types:
   - `AgentKind` enum: `ClaudeCode`, `Codex`
   - `AgentConfig { kind: AgentKind, max_review_cycles: u32, timeout_secs: u64, extra_args: Vec<String> }`
   - `AgentTask { wp_id: String, feature_slug: String, prompt_path: PathBuf, worktree_path: PathBuf, context_files: Vec<PathBuf> }`
   - `AgentResult { success: bool, pr_url: Option<String>, commits: Vec<String>, stdout: String, stderr: String, exit_code: i32 }`
   - `AgentStatus` enum: `Pending`, `Running { pid: u32 }`, `WaitingForReview { pr_url: String }`, `Completed { result: AgentResult }`, `Failed { error: String }`

3. Define the `AgentPort` trait:
- `async fn dispatch(&self, task: AgentTask, config: &AgentConfig) -> Result<AgentResult, DomainError>` -- spawn agent, wait for completion
- `async fn dispatch_async(&self, task: AgentTask, config: &AgentConfig) -> Result<String, DomainError>` -- returns job ID, non-blocking
- `async fn query_status(&self, job_id: &str) -> Result<AgentStatus, DomainError>`
- `async fn cancel(&self, job_id: &str) -> Result<(), DomainError>`
- `async fn send_instruction(&self, job_id: &str, instruction: &str) -> Result<(), DomainError>` -- send follow-up instruction to running agent

4. Add doc comments referencing FR-004, FR-010, FR-011, FR-012, FR-013.

**Files**: `crates/agileplus-core/src/ports/agent.rs`

**Validation**:
- `cargo check -p agileplus-core` succeeds.
- `AgentTask` includes all context an agent needs: WP prompt, worktree path, context files (spec.md, plan.md, data-model.md).
- `AgentResult` captures everything needed to create evidence records.

---

### T028: Define `ReviewPort` trait in `ports/review.rs`

**Purpose**: Abstract code review operations. The Review adapter (WP09) implements this with Coderabbit + GitHub API + manual fallback.

**Steps**:
1. Create `crates/agileplus-core/src/ports/review.rs`.
2. Define supporting types:
   - `ReviewStatus` enum: `Pending`, `InProgress`, `Approved`, `ChangesRequested { comments: Vec<ReviewComment> }`, `Rejected { reason: String }`
   - `ReviewComment { author: String, body: String, file_path: Option<String>, line: Option<u32>, severity: CommentSeverity, actionable: bool }`
   - `CommentSeverity` enum: `Critical`, `Major`, `Minor`, `Informational`
   - `CiStatus` enum: `Pending`, `Running`, `Passed`, `Failed { logs_url: String }`, `Cancelled`
   - `PrInfo { url: String, number: u64, title: String, state: String, review_status: ReviewStatus, ci_status: CiStatus }`

3. Define the `ReviewPort` trait:
- `async fn get_review_status(&self, pr_url: &str) -> Result<ReviewStatus, DomainError>`
- `async fn get_review_comments(&self, pr_url: &str) -> Result<Vec<ReviewComment>, DomainError>`
- `async fn get_actionable_comments(&self, pr_url: &str) -> Result<Vec<ReviewComment>, DomainError>` -- filter for actionable only
- `async fn get_ci_status(&self, pr_url: &str) -> Result<CiStatus, DomainError>`
- `async fn get_pr_info(&self, pr_url: &str) -> Result<PrInfo, DomainError>`
- `async fn await_review(&self, pr_url: &str, timeout_secs: u64) -> Result<ReviewStatus, DomainError>` -- poll until review complete or timeout
- `async fn await_ci(&self, pr_url: &str, timeout_secs: u64) -> Result<CiStatus, DomainError>`

4. Add doc comments referencing FR-012, FR-013.

**Files**: `crates/agileplus-core/src/ports/review.rs`

**Validation**:
- `cargo check -p agileplus-core` succeeds.
- `ReviewComment` captures enough detail for agent fix loops (file path, line, severity, actionable flag).
- Poll-based methods have explicit timeout parameters.

---

### T029: Define `ObservabilityPort` trait in `ports/observability.rs`

**Purpose**: Abstract telemetry operations. The Telemetry adapter (WP10) implements this with OpenTelemetry.

**Steps**:
1. Create `crates/agileplus-core/src/ports/observability.rs`.
2. Define supporting types:
   - `SpanContext { trace_id: String, span_id: String, parent_span_id: Option<String> }`
   - `MetricValue` enum: `Counter(u64)`, `Histogram(f64)`, `Gauge(f64)`
   - `LogLevel` enum: `Trace`, `Debug`, `Info`, `Warn`, `Error`
   - `LogEntry { level: LogLevel, message: String, fields: HashMap<String, String>, span_context: Option<SpanContext> }`

3. Define the `ObservabilityPort` trait:

**Tracing**:
- `fn start_span(&self, name: &str, parent: Option<&SpanContext>) -> SpanContext`
- `fn end_span(&self, ctx: &SpanContext)`
- `fn add_span_event(&self, ctx: &SpanContext, name: &str, attributes: &[(&str, &str)])`
- `fn set_span_error(&self, ctx: &SpanContext, error: &str)`

**Metrics**:
- `fn record_counter(&self, name: &str, value: u64, labels: &[(&str, &str)])`
- `fn record_histogram(&self, name: &str, value: f64, labels: &[(&str, &str)])`
- `fn record_gauge(&self, name: &str, value: f64, labels: &[(&str, &str)])`

**Logging**:
- `fn log(&self, entry: &LogEntry)`
- `fn log_info(&self, message: &str)` -- convenience
- `fn log_warn(&self, message: &str)` -- convenience
- `fn log_error(&self, message: &str)` -- convenience

4. Note: Tracing and metric methods are synchronous (not async) because telemetry should never block business logic. Fire-and-forget semantics.

**Files**: `crates/agileplus-core/src/ports/observability.rs`

**Validation**:
- `cargo check -p agileplus-core` succeeds.
- Span methods are synchronous.
- Metric names follow OpenTelemetry naming conventions (dotted lowercase: `agileplus.command.duration_ms`).

---

### T030: Define `mod.rs` re-exporting all ports and application service traits

**Purpose**: Provide a single import point for all ports. Define application-level service traits that compose multiple ports.

**Steps**:
1. Create or update `crates/agileplus-core/src/ports/mod.rs`.
2. Add public module declarations:
   ```rust
   pub mod storage;
   pub mod vcs;
   pub mod agent;
   pub mod review;
   pub mod observability;
   ```
3. Re-export all traits at the module level:
   ```rust
   pub use storage::StoragePort;
   pub use vcs::VcsPort;
   pub use agent::AgentPort;
   pub use review::ReviewPort;
   pub use observability::ObservabilityPort;
   ```
4. Re-export supporting types that adapters and CLI will need (WorktreeInfo, AgentTask, ReviewComment, etc.).
5. Optionally define an `AppContext` struct or trait that bundles all ports for dependency injection:
   ```rust
   pub struct AppContext {
       pub storage: Box<dyn StoragePort + Send + Sync>,
       pub vcs: Box<dyn VcsPort + Send + Sync>,
       pub agent: Box<dyn AgentPort + Send + Sync>,
       pub review: Box<dyn ReviewPort + Send + Sync>,
       pub telemetry: Box<dyn ObservabilityPort + Send + Sync>,
   }
   ```
6. Update `crates/agileplus-core/src/lib.rs` to declare `pub mod ports;`.

**Files**: `crates/agileplus-core/src/ports/mod.rs`, `crates/agileplus-core/src/lib.rs`

**Validation**:
- `cargo check --workspace` succeeds (all adapter crates can see port traits).
- `use agileplus_core::ports::StoragePort;` works from any adapter crate.
- `AppContext` compiles with trait object bounds.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Port trait design lock-in | High -- changing traits later breaks all adapters | Keep traits minimal. Add methods only when needed by a concrete use case. Use extension traits for optional capabilities. |
| Async trait object safety | Medium -- `dyn AsyncTrait` requires `Send + Sync` bounds | Use `#[async_trait]` if native async traits cause object safety issues. Test with `Box<dyn StoragePort + Send + Sync>` early. |
| Missing domain types from WP03/WP04 | High -- port signatures reference types that don't exist | Verify WP03 and WP04 are complete before starting. If types are missing, define placeholder structs in domain. |
| Over-specification of ports | Medium -- too many methods make adapters burdensome | Start with CRUD essentials. Convenience methods (e.g., `get_ready_wps`) can be added in later WPs if needed. |
| Supporting type proliferation | Low -- many small types across port files | Consolidate shared types in `ports/types.rs` or at the domain level. |

## Review Guidance

1. **Trait completeness**: Every entity from `data-model.md` should have create/read/list coverage in `StoragePort`.
2. **Consistency**: All methods use `DomainError`, all async methods are consistent in their `&self` receiver.
3. **Object safety**: Verify all traits work as `Box<dyn Trait + Send + Sync>`.
4. **No implementation**: This WP should contain zero adapter logic -- pure trait definitions and supporting types only.
5. **Doc comments**: Every trait and method should have a doc comment referencing the relevant FR or design decision.
6. **Cross-reference**: Port method names should be intuitive for someone reading `plan.md` adapter descriptions.

## Activity Log

| Timestamp | Action | Agent | Details |
|-----------|--------|-------|---------|
| 2026-02-27T00:00:00Z | Prompt generated | system | WP05 prompt created via /spec-kitty.tasks |
- 2026-02-28T09:30:58Z – claude-wp05 – shell_pid=42392 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:38:12Z – claude-wp05 – shell_pid=42392 – lane=for_review – Port traits: StoragePort(26), VcsPort(11), AgentPort(5), ReviewPort(7), ObservabilityPort(11), AppContext generic
- 2026-02-28T09:38:17Z – claude-wp05 – shell_pid=42392 – lane=done – Review passed: all port traits defined, workspace builds, generic AppContext
