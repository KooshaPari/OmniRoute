# Work Packages: AgilePlus — Spec-Driven Development Engine

**Inputs**: Design documents from `kitty-specs/001-spec-driven-development-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: BDD acceptance tests and contract tests included per the test strategy (cucumber-rs, behave, Pact).

**Organization**: 159 subtasks → 23 work packages. Average ~7 subtasks per WP, ~370 lines per prompt.

---

## Work Package WP00: Proto Repository Scaffold (Priority: P0)

**Goal**: Create the `agileplus-proto` repository with all 4 proto files, buf config, Rust/Python codegen, and CI skeleton.
**Repo**: `agileplus-proto`
**Independent Test**: `buf lint` passes, `buf generate` produces Rust and Python stubs, both compile.
**Prompt**: `tasks/WP00-proto-scaffold.md`
**Estimated**: ~350 lines, 8 subtasks

### Included Subtasks
- [x] T000a Initialize `agileplus-proto` repo with README, LICENSE, .gitignore
- [x] T000b Create `proto/agileplus/common.proto` with shared message types (Feature, WP, Audit, Governance, Agent events)
- [x] T000c [P] Create `proto/agileplus/core.proto` with AgilePlusCoreService definition
- [x] T000d [P] Create `proto/agileplus/agents.proto` with AgentDispatchService definition
- [x] T000e [P] Create `proto/agileplus/integrations.proto` with IntegrationsService definition
- [x] T000f Create `buf.yaml`, `buf.gen.yaml` for linting and codegen configuration
- [x] T000f2 Generate buf breaking change baseline and add buf breaking CI check
- [x] T000g Create Rust crate in `rust/` (Cargo.toml, build.rs with tonic-build, src/lib.rs re-exporting generated code) and Python package in `python/` (pyproject.toml, codegen script)

### Implementation Notes
- Proto files are the single source of truth for all inter-service contracts
- `buf generate` produces Rust code in `rust/src/` and Python code in `python/src/agileplus_proto/`
- Rust crate is consumed as a git dependency by core, agents, integrations repos
- Python package is consumed as a git dependency by mcp repo
- `schemas/mcp-tools.json` and `schemas/mcp-resources.json` define MCP tool/resource schemas

### Parallel Opportunities
- T000c, T000d, T000e are all independent after T000b

### Dependencies
- None (starting package)

### Risks & Mitigations
- Proto design must be stable before other repos build against it; use `buf breaking` in CI

---

## Work Package WP01: Core Rust Workspace & Build Scaffold (Priority: P0)

**Goal**: Create the `agileplus-core` Cargo workspace with all 7 crate stubs, Makefile, Docker Compose, and CI skeleton.
**Repo**: `agileplus-core`
**Independent Test**: `cargo build --workspace` succeeds, `cargo test --workspace` runs (0 tests, 0 errors).
**Prompt**: `tasks/WP01-rust-workspace-scaffold.md`
**Estimated**: ~300 lines, 9 subtasks

### Included Subtasks
- [x] T001 Create root `Cargo.toml` workspace manifest with all 7 crate members
- [x] T002 [P] Scaffold `crates/agileplus-domain/` with `lib.rs`, domain module stubs, port trait stubs
- [x] T003 [P] Scaffold remaining 6 adapter crates (`cli`, `api`, `grpc`, `sqlite`, `git`, `telemetry`) with `lib.rs` and dependency declarations
- [x] T004 [P] Create `Makefile` with targets: build, test, lint, format, proto-gen, all; CI matrix must include macOS, Linux, and Windows targets
- [x] T005 [P] Create `docker-compose.yml` for dev environment (Rust builder, Python MCP, SQLite volume)
- [x] T006 Add `proto/` git submodule pointing to `agileplus-proto` and wire tonic-build in `agileplus-grpc`
- [x] T006b Add MSRV CI check (latest stable Rust) to Makefile and CI config
- [x] T006c Add rustdoc CI generation and FR/WP traceability module header convention
- [x] T006d Add CI lint step validating agileplus-domain has only serde/sha2/chrono dependencies

### Implementation Notes
- Use Rust 2024 edition in all crates
- Domain crate (renamed from `agileplus-core`) has no external deps except serde, sha2, chrono
- Adapter crates depend on domain crate via workspace path
- Proto consumed from `agileplus-proto` git submodule; tonic-build in `agileplus-grpc`
- Agent dispatch and integrations crates are NOT in this repo — they live in `agileplus-agents` and `agileplus-integrations`
- Configure workspace-level clippy.toml with `must-use-candidate = "warn"` per constitution requirements.
- CI matrix must include macOS, Linux, and Windows targets

### Parallel Opportunities
- T002, T003, T004, T005 are all independent after T001

### Dependencies
- Depends on WP00 (proto repo must exist for git submodule)

### Risks & Mitigations
- tonic-build requires protoc; pin version in Makefile and Docker

---

## Work Package WP02: Python MCP Service Scaffold (Priority: P0)

**Goal**: Create the `agileplus-mcp` repository with FastMCP 3.0 server skeleton, gRPC client stub, and pyproject.toml.
**Repo**: `agileplus-mcp`
**Independent Test**: `uv run python -m agileplus_mcp` starts without error, MCP server responds to health check.
**Prompt**: `tasks/WP02-python-mcp-scaffold.md`
**Estimated**: ~250 lines, 6 subtasks

### Included Subtasks
- [x] T007 Initialize `agileplus-mcp` repo, create `pyproject.toml` with FastMCP 3.0, grpcio, opentelemetry-sdk deps
- [x] T008 Create `src/agileplus_mcp/__init__.py` and `server.py` (FastMCP entry)
- [x] T009 [P] Create `src/agileplus_mcp/grpc_client.py` (stub gRPC connection to Rust core)
- [x] T010 [P] Create `src/agileplus_mcp/tools/`, `resources/`, `prompts/`, `sampling/` directory stubs
- [x] T011 Add `proto/` git submodule pointing to `agileplus-proto` and create `tests/` directory structure
- [x] T011b Add sphinx/autodoc CI generation for Python API reference

### Implementation Notes
- Use `uv` for Python package management
- FastMCP 3.0 server should register tools from `agileplus-proto/schemas/mcp-tools.json` schema
- gRPC client connects to `localhost:50051` (Rust core default)
- Proto consumed from `agileplus-proto` git submodule

### Parallel Opportunities
- T009, T010 independent after T008

### Dependencies
- Depends on WP00 (proto repo must exist for git submodule)

### Risks & Mitigations
- Python 3.13 free-threaded + FastMCP compatibility: test early, fall back to 3.12 if needed

---

## Work Package WP03: Domain Model — Feature & State Machine (Priority: P0)

**Goal**: Implement the Feature aggregate, state machine (FSM), and core domain types in `agileplus-domain` (within `agileplus-core` repo).
**Independent Test**: Unit tests pass for Feature creation, all valid state transitions, and skip-with-warning behavior.
**Prompt**: `tasks/WP03-domain-feature-state-machine.md`
**Estimated**: ~400 lines, 8 subtasks

### Included Subtasks
- [x] T012 Implement `Feature` struct with all fields from data-model.md in `crates/agileplus-domain/src/domain/feature.rs`
- [x] T013 Implement `FeatureState` enum and `StateTransition` type with strict ordering (FR-033)
- [x] T014 Implement state machine logic: `transition()` method enforcing valid transitions, skip-with-warning (FR-034)
- [x] T015 Implement `WorkPackage` struct with states (planned/doing/review/done/blocked) in `work_package.rs`
- [x] T016 Implement `WpDependency` and dependency-aware scheduling logic (FR-039)
- [x] T017 Write unit tests for FSM: all valid transitions, invalid transitions blocked, skip transitions logged
- [x] T017b Write proptest property-based tests for FSM transitions (all valid/invalid state pairs)
- [x] T017c Run cargo-mutants on state_machine.rs, verify ≥90% mutation score

### Implementation Notes
- State machine uses Rust enums with exhaustive match — compiler enforces all transitions handled
- Skip transitions return `Result<Warning>` not `Result<()>` — caller decides to log or abort
- WorkPackage.file_scope is `Vec<String>` for overlap detection

### Parallel Opportunities
- T015-T016 (WP model) parallel with T012-T014 (Feature model) after shared types defined

### Dependencies
- Depends on WP01 (crate structure must exist)

### Risks & Mitigations
- Complex state machine edge cases: exhaustive unit tests with property-based testing (proptest)

---

## Work Package WP04: Domain Model — Governance & Audit (Priority: P0)

**Goal**: Implement governance contracts, audit entries with hash chaining, evidence, and policy rules in `agileplus-domain` (within `agileplus-core` repo).
**Independent Test**: Unit tests pass for hash chain creation, verification, evidence linking, and policy evaluation.
**Prompt**: `tasks/WP04-domain-governance-audit.md`
**Estimated**: ~450 lines, 10 subtasks

### Included Subtasks
- [x] T018 Implement `GovernanceContract` struct with versioned rules (FR-018) in `governance.rs`
- [x] T019 Implement `AuditEntry` struct with SHA-256 hash chain (FR-016) in `audit.rs`
- [x] T020 Implement `hash_entry()` function: SHA-256(id ‖ timestamp ‖ actor ‖ transition ‖ evidence_refs ‖ prev_hash)
- [x] T021 Implement `verify_chain()` function: sequential scan validating prev_hash linkage
- [x] T022 Implement `Evidence` struct with FR-to-evidence linking (FR-021) in `governance.rs`
- [x] T023 Implement `PolicyRule` struct with domain-based evaluation (quality/security/reliability) (FR-020)
- [x] T024 Write unit tests: chain integrity, tamper detection, evidence completeness check, policy pass/fail
- [x] T024d Import and extend existing Phenotype governance patterns (from parpour, civ, thegent) into governance contract templates (FR-028, FR-029)
- [x] T024b Write proptest property-based tests for hash chain integrity and governance evaluation
- [x] T024c Run cargo-mutants on audit.rs and governance.rs, verify ≥90% mutation score

### Implementation Notes
- Use sha2 crate for SHA-256
- AuditEntry.hash computed deterministically from concatenated fields
- verify_chain() returns first invalid entry ID or Ok(count)
- GovernanceContract.rules stored as serde_json::Value for flexibility

### Parallel Opportunities
- T018, T022-T023 (governance types) parallel with T019-T021 (audit chain)

### Dependencies
- Depends on WP03 (Feature and WP types needed for evidence linking)

### Risks & Mitigations
- Hash chain correctness is critical: extensive property-based tests, comparison with thegent's implementation

---

## Work Package WP05: Port Traits (Priority: P0)

**Goal**: Define all port traits in `agileplus-domain/src/ports/` (within `agileplus-core` repo) that adapter crates will implement.
**Independent Test**: Core crate compiles with all port traits defined, adapter crates can reference them.
**Prompt**: `tasks/WP05-port-traits.md`
**Estimated**: ~350 lines, 6 subtasks

### Included Subtasks
- [x] T025 Define `StoragePort` trait in `ports/storage.rs`: CRUD for features, WPs, audit, evidence, policies
- [x] T026 [P] Define `VcsPort` trait in `ports/vcs.rs`: worktree create/cleanup, branch ops, artifact read/write
- [x] T027 [P] Define `AgentPort` trait in `ports/agent.rs`: dispatch subagent, query status, send instruction
- [x] T028 [P] Define `ReviewPort` trait in `ports/review.rs`: await review, read comments, check CI status
- [x] T029 [P] Define `ObservabilityPort` trait in `ports/observability.rs`: emit trace, record metric, write log
- [x] T030 Define `mod.rs` re-exporting all ports, application service traits using ports

### Implementation Notes
- All ports are async traits (use `async_trait` or Rust 2024 native async traits)
- Port methods return `Result<T, DomainError>` — domain error type defined in core
- StoragePort methods mirror data-model.md entities
- VcsPort abstracts git2 — tests can use in-memory mock

### Parallel Opportunities
- T026-T029 all independent

### Dependencies
- Depends on WP03, WP04 (domain types referenced in port signatures)

### Risks & Mitigations
- Port design lock-in: keep ports minimal, add methods incrementally

---

## Work Package WP06: SQLite Adapter (Priority: P1)

**Goal**: Implement SQLite storage adapter with migrations, CRUD operations, and rebuild-from-git capability.
**Independent Test**: Integration tests pass for all CRUD operations, migration up/down, and rebuild from fixtures.
**Prompt**: `tasks/WP06-sqlite-adapter.md`
**Estimated**: ~500 lines, 7 subtasks

### Included Subtasks
- [x] T031 Create SQLite migration system in `crates/agileplus-sqlite/src/migrations/` (all tables from data-model.md)
- [x] T032 Implement `SqliteStorageAdapter` struct implementing `StoragePort`
- [x] T033 Implement feature CRUD: create, get_by_slug, update_state, list_by_state
- [x] T034 Implement work package CRUD: create, get, update_state, list_by_feature, dependency queries
- [x] T035 Implement audit CRUD: append_entry, get_trail, verify_chain (delegates to domain)
- [x] T036 Implement evidence + policy + metric CRUD
- [x] T037 Implement `rebuild_from_git()` (FR-017): parse git artifacts → populate SQLite

### Implementation Notes
- Use rusqlite with WAL mode for concurrent reads
- Migrations are embedded SQL files, applied on startup
- rebuild_from_git reads: meta.json, audit/chain.jsonl, evidence/** from git working tree
- All queries use parameterized statements (no SQL injection)

### Parallel Opportunities
- T033, T034, T035, T036 are independent after T031-T032

### Dependencies
- Depends on WP05 (StoragePort trait)

### Risks & Mitigations
- WAL mode + single writer: use connection pooling with write serialization

---

## Work Package WP07: Git Adapter (Priority: P1)

**Goal**: Implement git adapter for worktree management, branch ops, and artifact read/write.
**Independent Test**: Integration tests pass for worktree create/cleanup, artifact read/write, branch merge in a temp repo.
**Prompt**: `tasks/WP07-git-adapter.md`
**Estimated**: ~400 lines, 6 subtasks

### Included Subtasks
- [x] T038 Implement `GitVcsAdapter` struct implementing `VcsPort` in `crates/agileplus-git/src/`
- [x] T039 Implement worktree operations: create_worktree(feature, wp), list_worktrees, cleanup_worktree
- [x] T040 Implement branch operations: create_branch, checkout, merge_to_target, detect_conflicts
- [x] T041 Implement artifact operations: read_spec, read_plan, write_audit_chain, write_evidence
- [x] T042 Implement git history scanning for `rebuild_from_git()` support
- [x] T043 Write integration tests using temp git repos (git2::Repository::init)

### Implementation Notes
- Worktree paths: `.worktrees/<feature-slug>-<WP-id>/`
- Use git2 for all operations — no shelling out to git CLI
- Merge conflicts detected via git2 merge analysis, surfaced as structured error

### Parallel Opportunities
- T039, T040, T041 independent after T038

### Dependencies
- Depends on WP05 (VcsPort trait)

### Risks & Mitigations
- git2 worktree API quirks: test on macOS + Linux, handle case-insensitive filesystems

---

## Work Package WP08: Agent Dispatch Service (Priority: P1)

**Goal**: Create `agileplus-agents` repo and implement agent dispatch for Claude Code and Codex, including PR creation, review loop, and gRPC service implementing `agents.proto`.
**Repo**: `agileplus-agents`
**Independent Test**: Mock dispatch test passes: agent spawned, PR created with goal context, review loop simulated. gRPC service starts and responds to health check.
**Prompt**: `tasks/WP08-agent-dispatch-adapter.md`
**Estimated**: ~550 lines, 8 subtasks

### Included Subtasks
- [x] T044 Initialize `agileplus-agents` repo with Cargo workspace (3 crates), proto git submodule, Makefile
- [x] T044b Implement `AgentDispatchAdapter` in `crates/agileplus-agent-dispatch/src/`
- [x] T045 Implement `claude_code.rs`: spawn Claude Code with `--print` mode, pass WP prompt, collect output
- [x] T046 Implement `codex.rs`: spawn Codex in batch mode, pass WP prompt, collect output
- [x] T047 Implement `dispatch.rs`: select agent (from config), create worktree, inject prompt, spawn 1-3 subagents
- [x] T048 Implement `pr_loop.rs`: create PR (gh CLI), set description with WP goal/prompt (FR-011), poll for review
- [x] T049 Implement review-fix loop: read Coderabbit comments → feed to agent → re-push → re-poll (FR-012)
- [x] T049b Implement `agileplus-agent-service` gRPC server implementing `agents.proto` AgentDispatchService

### Implementation Notes
- This is a separate repo (`agileplus-agents`) with its own Cargo workspace (3 crates)
- Communicates with `agileplus-core` via gRPC client for state queries/updates
- Implements `agents.proto` service that core can call
- Agent invocation via `tokio::process::Command` — capture stdout/stderr
- PR creation via `gh pr create` with structured body (FR-011)
- Review loop: poll GitHub API every 30s for review status, Coderabbit comments

### Parallel Opportunities
- T045, T046 independent (different agent harnesses)

### Dependencies
- Depends on WP00 (proto repo). Design reference: WP05 (AgentPort trait — not a build dependency, used as interface design guide)

### Risks & Mitigations
- Agent CLI changes: abstract behind AgentPort, adapter is swappable
- Coderabbit latency: configurable poll interval with exponential backoff

---

## Work Package WP09: Code Review Adapter (Priority: P1)

**Goal**: Implement Coderabbit integration and manual review fallback in `agileplus-agent-review` crate within `agileplus-agents` repo.
**Repo**: `agileplus-agents`
**Independent Test**: Mock test passes: Coderabbit review fetched, comments parsed, fallback to manual works.
**Prompt**: `tasks/WP09-review-adapter.md`
**Estimated**: ~300 lines, 5 subtasks

### Included Subtasks
- [x] T050 Implement `ReviewAdapter` struct in `crates/agileplus-agent-review/src/`
- [x] T051 Implement `coderabbit.rs`: fetch review via GitHub API, parse comments into structured feedback
- [x] T052 Implement `fallback.rs`: manual review approval flow (user confirms via CLI prompt)
- [x] T053 Implement CI status checking: poll GitHub checks API for PR, return pass/fail/pending
- [x] T054 Write unit tests with mock GitHub API responses

### Implementation Notes
- Lives in `agileplus-agents` repo, `crates/agileplus-agent-review/` crate
- GitHub API via `octocrab` or raw `reqwest` — use integration key from credential store
- Coderabbit comments identified by bot username, parsed for actionable vs informational
- Fallback triggers when Coderabbit unavailable for >5min (configurable)

### Parallel Opportunities
- T051, T052, T053 independent after T050

### Dependencies
- Depends on WP08 (agents repo must exist)

### Risks & Mitigations
- GitHub API rate limits: cache responses, use conditional requests (ETags)

---

## Work Package WP10: Telemetry Adapter (Priority: P1)

**Goal**: Implement OpenTelemetry traces, metrics, and structured logging.
**Independent Test**: Traces and metrics exported to OTLP collector, structured logs written to file.
**Prompt**: `tasks/WP10-telemetry-adapter.md`
**Estimated**: ~300 lines, 5 subtasks

### Included Subtasks
- [x] T055 Implement `TelemetryAdapter` struct implementing `ObservabilityPort` in `crates/agileplus-telemetry/src/`
- [x] T056 Implement `traces.rs`: OpenTelemetry trace spans per command execution, agent dispatch
- [x] T057 [P] Implement `metrics.rs`: counters (agent_runs, review_cycles), histograms (command_duration_ms)
- [x] T058 [P] Implement `logs.rs`: structured JSON logging with tracing crate, configurable output (stdout/file)
- [x] T059 Create `~/.agileplus/otel-config.yaml` schema and loader

### Implementation Notes
- Use `opentelemetry` + `opentelemetry-otlp` crates
- Traces: one span per command, child spans for agent dispatch, review loop iterations
- Metrics stored in SQLite (via StoragePort) AND exported via OTLP
- Log format: JSON with timestamp, level, span_id, message, fields

### Parallel Opportunities
- T056, T057, T058 independent after T055

### Dependencies
- Depends on WP05 (ObservabilityPort trait)

### Risks & Mitigations
- OTLP collector not running: degrade gracefully, log warning, continue without export

---

## Work Package WP11: CLI — Specify & Research Commands (Priority: P1) 🎯 MVP

**Goal**: Implement `specify` and `research` CLI commands with discovery interview and SQLite persistence.
**Independent Test**: `agileplus specify` creates a spec interactively, stores in git+SQLite. `agileplus research` produces research artifacts.
**Prompt**: `tasks/WP11-cli-specify-research.md`
**Estimated**: ~450 lines, 6 subtasks

### Included Subtasks
- [x] T060 Create `crates/agileplus-cli/src/main.rs` with clap App, global flags, subcommand routing
- [x] T061 Implement `commands/specify.rs`: guided discovery interview, spec generation, SQLite+git persistence (FR-001)
- [x] T062 Implement `commands/research.rs`: pre-specify (codebase scan) and post-specify (feasibility) modes (FR-002)
- [x] T063 Implement implicit refinement: re-run detection, diffing, revision audit logging (FR-008)
- [x] T064 Implement governance checks within planning commands (FR-009): constitution loading, consistency validation
- [x] T065 Wire specify/research to StoragePort, VcsPort, ObservabilityPort via dependency injection

### Implementation Notes
- CLI uses clap derive macros for arg parsing
- Discovery interview: structured prompts to stdout, read from stdin
- Spec written to git (kitty-specs/<feature>/spec.md) AND indexed in SQLite
- Research modes determined by presence/absence of spec.md in feature dir

### Parallel Opportunities
- T061, T062 independent after T060

### Dependencies
- Depends on WP06 (SQLite), WP07 (git), WP10 (telemetry)

### Risks & Mitigations
- Interactive CLI complexity: use `dialoguer` crate for structured prompts

---

## Work Package WP12: CLI — Plan & Implement Commands (Priority: P1) 🎯 MVP

**Goal**: Implement `plan` and `implement` CLI commands. Plan generates WPs. Implement dispatches agents.
**Independent Test**: `agileplus plan` generates WPs from spec. `agileplus implement` spawns agents in worktrees.
**Prompt**: `tasks/WP12-cli-plan-implement.md`
**Estimated**: ~500 lines, 7 subtasks

### Included Subtasks
- [x] T066 Implement `commands/plan.rs`: WP generation with dependency ordering, governance contract creation (FR-003)
- [x] T067 Implement WP file_scope detection: parse plan for file paths, build overlap graph
- [x] T068 Implement dependency-aware scheduler: parallel WPs for non-overlapping, serial for overlapping (FR-038, FR-039)
- [x] T069 Implement `commands/implement.rs`: worktree creation, agent dispatch, PR creation (FR-004, FR-010-013)
- [x] T070 Implement PR description builder: inject WP goal, FR references, acceptance criteria (FR-011)
- [x] T071 Implement review-fix loop orchestrator: await Coderabbit, loop agent, detect green (FR-012)
- [x] T072 Wire plan/implement to all ports (storage, VCS, agent, review, telemetry)

### Implementation Notes
- Plan command reads spec.md + research.md, generates WPs with acceptance criteria traced to FRs
- Implement command respects dependency ordering (WP.depends_on must all be `done`)
- Agent dispatch: 1-3 subagents per worktree based on WP complexity (configurable)
- Review loop: poll every 30s, max 5 cycles, fail after max with governance exception

### Parallel Opportunities
- T066-T068 (plan) parallel with T069-T071 (implement) — different command files

### Dependencies
- Depends on WP08 (agent dispatch), WP09 (review), WP11 (CLI scaffold)

### Risks & Mitigations
- Agent dispatch reliability: implement retry with checkpoint (resume from last commit)

---

## Work Package WP13: CLI — Validate, Ship, Retrospective Commands (Priority: P1)

**Goal**: Implement the final 3 commands to complete the 7-command workflow.
**Independent Test**: `agileplus validate` checks governance gates. `agileplus ship` merges + archives. `agileplus retrospective` generates learnings.
**Prompt**: `tasks/WP13-cli-validate-ship-retro.md`
**Estimated**: ~450 lines, 6 subtasks

### Included Subtasks
- [x] T073 Implement `commands/validate.rs`: FR-to-evidence tracing, quality gate checks, validation report (FR-005)
- [x] T074 Implement governance gate evaluator: check all contract rules, collect violations, block if failing (FR-018, FR-019)
- [x] T075 Implement `commands/ship.rs`: merge to target branch, cleanup worktrees, archive feature, finalize audit (FR-006)
- [x] T076 Implement `commands/retrospective.rs`: analyze feature history, generate learnings, suggest constitution amendments (FR-007)
- [x] T077 Implement strict state machine enforcement in all commands: verify current state, transition, log (FR-033, FR-034)
- [x] T078 Wire validate/ship/retro to all ports

### Implementation Notes
- Validate: iterate all FRs, for each find evidence records, check policy rules
- Ship: git merge to target_branch, git worktree prune, update SQLite state, append final audit
- Retrospective: query metrics table (time-per-WP, review cycles), generate markdown report
- State enforcement: each command checks feature.state before proceeding

### Parallel Opportunities
- T073-T074 (validate) parallel with T075 (ship) — different files

### Dependencies
- Depends on WP12 (implement must exist for validate to have evidence)

### Risks & Mitigations
- Merge conflicts at ship time: detect via git2, present structured diff, suggest resolution

---

## Work Package WP14: gRPC Server & MCP Integration (Priority: P2)

**Goal**: Implement the tonic gRPC server in `agileplus-core` repo (serving `core.proto` + proxying agents/integrations) and wire the `agileplus-mcp` Python service to call it.
**Repos**: `agileplus-core` (gRPC server), `agileplus-mcp` (MCP tools + gRPC client)
**Independent Test**: gRPC server starts serving `core.proto`, Python MCP client connects, tool calls route through to Rust core and return results.
**Prompt**: `tasks/WP14-grpc-mcp-integration.md`
**Estimated**: ~450 lines, 7 subtasks

### Included Subtasks
- [x] T079 Implement tonic gRPC server in `agileplus-core/crates/agileplus-grpc/src/server.rs` implementing `AgilePlusCoreService` from `core.proto`
- [x] T080 Wire gRPC handlers to domain services (feature queries, governance checks, audit trail, command dispatch)
- [x] T080b Implement gRPC proxy/routing: core server forwards agent/integration requests to agileplus-agents and agileplus-integrations services (or stubs them when those services are unavailable)
- [x] T081 Implement Python gRPC client in `agileplus-mcp/src/agileplus_mcp/grpc_client.py` using generated stubs from `agileplus-proto`
- [x] T082 Implement MCP tool handlers in `agileplus-mcp/src/agileplus_mcp/tools/` — each tool calls gRPC client
- [x] T083 Implement agent event streaming: bidirectional gRPC stream for real-time agent status
- [x] T084 Write Pact contract tests for Rust↔Python gRPC boundary
- [x] T084b Implement MCP Sampling primitive: server-initiated triage analysis and governance pre-checks (FR-049)
- [x] T084c Implement MCP Roots primitive: workspace boundary declarations per feature/WP (FR-049)
- [x] T084d Implement MCP Elicitation primitive: discovery interview flows for specify/clarify commands (FR-049)

### Implementation Notes
- gRPC server in core serves `core.proto` endpoints directly
- For agents.proto and integrations.proto, core either proxies to those services or returns "service unavailable" stubs
- MCP tools map 1:1 to `agileplus-proto/schemas/mcp-tools.json` definitions
- Proto consumed from git submodule in both repos
- Pact: Rust (core) is provider, Python (mcp) is consumer

### Parallel Opportunities
- T079-T080b (Rust server) parallel with T081-T082 (Python client)

### Dependencies
- Depends on WP00 (proto), WP13 (all CLI commands must exist for command dispatch)

### Risks & Mitigations
- gRPC streaming complexity: start with unary calls, add streaming incrementally

---

## Work Package WP15: API Layer & Credential Management (Priority: P2)

**Goal**: Implement axum HTTP API for web UI integration and credential management system.
**Independent Test**: API endpoints return feature/WP/audit data as JSON. Credentials stored/retrieved from OS keychain.
**Prompt**: `tasks/WP15-api-credentials.md`
**Estimated**: ~400 lines, 6 subtasks

### Included Subtasks
- [x] T085 Implement axum router in `crates/agileplus-api/src/` with routes for features, WPs, governance, audit
- [x] T086 Implement API route handlers: delegate to domain services via ports
- [x] T087 [P] Implement integration key auth middleware: validate API keys from credential store (FR-030)
- [x] T088 [P] Implement credential management: OS keychain storage (macOS Keychain, Linux secret-service) (FR-030, FR-031)
- [x] T089 [P] Create `~/.agileplus/config.toml` schema and loader (core config, credential references)
- [x] T090 Write API integration tests with mock HTTP client

### Implementation Notes
- axum runs alongside gRPC in the same tokio runtime (shared binary)
- API designed for Plane.so consumption: JSON responses match Plane.so work item format where possible
- Credentials: use `keyring` crate, fallback to encrypted file with passphrase
- Config: TOML with sections for core, credentials, telemetry, api

### Parallel Opportunities
- T087, T088, T089 independent after T085-T086

### Dependencies
- Depends on WP14 (gRPC server — shared binary architecture)

### Risks & Mitigations
- Keychain access permissions on Linux: test with both gnome-keyring and kwallet

---

## Work Package WP16: BDD Acceptance Tests & Integration Suite (Priority: P2)

**Goal**: Write BDD acceptance tests mapping to spec FRs, contract tests, and Docker-based integration tests.
**Independent Test**: `make test` runs all unit, BDD, contract, and integration tests with >80% coverage.
**Prompt**: `tasks/WP16-bdd-integration-tests.md`
**Estimated**: ~450 lines, 7 subtasks

### Included Subtasks
- [x] T091 Create `.feature` files for core user stories: specify.feature, implement.feature, governance.feature, audit.feature
- [x] T092 Implement cucumber-rs step definitions for Rust BDD tests in `tests/bdd/`
- [x] T093 [P] Implement behave step definitions for Python BDD tests in `mcp/tests/bdd/`
- [x] T094 [P] Create Pact contract test fixtures for gRPC boundary in `tests/contract/`
- [x] T095 Create `docker-compose.test.yml` for full-stack integration tests (spins up all 4 services: core, mcp, agents, integrations)
- [x] T096 Implement integration test scenarios: full workflow (specify → ship) on test repo
- [x] T097 Create test fixtures: sample specs, plans, WPs, evidence artifacts in `tests/fixtures/`

### Implementation Notes
- BDD .feature files reference FR IDs in scenario names (e.g., "Scenario: FR-001 - Specify creates spec in git+SQLite")
- cucumber-rs and behave share the same .feature files (copied or symlinked)
- Pact: Python consumer writes expected interactions, Rust provider verifies
- Integration tests use a temp git repo created in setUp, torn down in tearDown

### Parallel Opportunities
- T092, T093, T094 all independent

### Dependencies
- Depends on WP15 (all components must exist for full integration)

### Risks & Mitigations
- Docker test environment complexity: use Docker Compose profiles for partial testing

---

## Work Package WP17: Triage & Backlog Service (Priority: P2)

**Goal**: Create `agileplus-integrations` repo and implement the triage classifier, backlog management, and prompt router generation in `agileplus-triage` crate.
**Repo**: `agileplus-integrations`
**Independent Test**: Triage classifies input correctly (bug/feature/idea), creates backlog entries, generates a valid CLAUDE.md router. gRPC service responds to ClassifyInput.
**Prompt**: `tasks/WP17-triage-backlog-adapter.md`
**Estimated**: ~500 lines, 8 subtasks

### Included Subtasks
- [x] T098 Initialize `agileplus-integrations` repo with Cargo workspace (4 crates), proto git submodule, Makefile
- [ ] T098b Implement `TriageAdapter` struct with `classify()` method in `crates/agileplus-triage/src/`
- [x] T099 Implement `BacklogItem` CRUD: create, list_by_type, list_by_feature, promote_to_feature
- [x] T100 Implement `classifier.rs`: rule-based + keyword intent classification (extensible for LLM-based later)
- [x] T101 Implement `router.rs`: generate project-specific CLAUDE.md with prompt routing rules (FR-046)
- [x] T102 Implement `router.rs`: generate project-specific AGENTS.md with sub-command vocabulary (FR-047)
- [ ] T102b Implement `agileplus-integrations-service` gRPC server implementing `integrations.proto` IntegrationsService (triage endpoints)
- [x] T103 Write unit tests for classification accuracy, backlog operations, router generation

### Implementation Notes
- This is a separate repo (`agileplus-integrations`) with its own Cargo workspace (4 crates)
- Communicates with `agileplus-core` via gRPC client for state reads
- Implements triage portion of `integrations.proto` service

### Dependencies
- Depends on WP00 (proto repo)

---

## Work Package WP18: Plane.so Sync Adapter (Priority: P2)

**Goal**: Implement bidirectional-aware sync from core to Plane.so for features and work packages in `agileplus-plane` crate within `agileplus-integrations` repo.
**Repo**: `agileplus-integrations`
**Independent Test**: Feature state change triggers Plane.so work item creation/update via gRPC. Conflict detection works.
**Prompt**: `tasks/WP18-plane-sync-adapter.md`
**Estimated**: ~350 lines, 5 subtasks

### Included Subtasks
- [x] T104 Implement `PlaneSyncAdapter` struct with Plane.so REST API client in `crates/agileplus-plane/src/` (FR-043)
- [x] T105 Implement feature sync: gRPC request from core → Plane.so work item (create/update on state change)
- [x] T106 Implement WP sync: gRPC request from core → Plane.so sub-item (status, assignee, PR link)
- [x] T107 Implement conflict detection: poll Plane.so for mirror-side edits, warn on conflicts (FR-045)
- [x] T108 Write integration tests with mock Plane.so API

### Implementation Notes
- Lives in `agileplus-integrations` repo, `crates/agileplus-plane/` crate
- Receives sync requests via gRPC (integrations.proto SyncFeatureToPlane, SyncWPToPlane, DetectPlaneConflicts)
- Credential management delegated to the integrations service config

### Dependencies
- Depends on WP17 (integrations repo must exist)

---

## Work Package WP19: GitHub Sync Adapter (Priority: P2)

**Goal**: Implement bug-to-issue sync to GitHub Issues with structured metadata in `agileplus-github` crate within `agileplus-integrations` repo.
**Repo**: `agileplus-integrations`
**Independent Test**: Bug triage via gRPC creates a GitHub issue with labels, cross-references, and metadata.
**Prompt**: `tasks/WP19-github-sync-adapter.md`
**Estimated**: ~350 lines, 5 subtasks

### Included Subtasks
- [x] T109 Implement `GitHubSyncAdapter` struct with octocrab GitHub API client in `crates/agileplus-github/src/` (FR-044)
- [x] T110 Implement bug sync: gRPC request from core → GitHub issue (title, body, labels, feature/WP refs)
- [x] T111 Implement issue status sync: GitHub issue closed → notify core via gRPC
- [x] T112 Implement conflict detection: warn on GitHub-side edits that conflict with core state (FR-045)
- [x] T113 Write integration tests with mock GitHub API (wiremock)

### Implementation Notes
- Lives in `agileplus-integrations` repo, `crates/agileplus-github/` crate
- Receives sync requests via gRPC (integrations.proto SyncBugToGitHub, SyncIssueStatus, DetectGitHubConflicts)
- Credential management delegated to the integrations service config

### Dependencies
- Depends on WP17 (integrations repo must exist)

---

## Work Package WP20: Hidden Sub-Commands & SlashCommand Integration (Priority: P2)

**Goal**: Implement the ~25 hidden sub-commands and wire them for invocation via Claude Code's SlashCommand tool.
**Independent Test**: Each sub-command executes correctly when invoked programmatically; audit log captures all invocations.
**Prompt**: `tasks/WP20-hidden-subcommands.md`
**Estimated**: ~500 lines, 7 subtasks

### Included Subtasks
- [x] T114 Define sub-command registry: enum of all ~25 sub-commands with metadata (category, description, required args)
- [x] T115 Implement triage sub-commands: `triage:classify`, `triage:file-bug`, `triage:queue-idea` (FR-040, FR-041, FR-042)
- [x] T116 Implement governance sub-commands: `governance:check-gates`, `governance:evaluate-policy`, `governance:verify-chain`
- [x] T117 Implement sync sub-commands: `sync:push-plane`, `sync:push-github`, `sync:pull-status` (FR-043, FR-044)
- [x] T118 Implement git/devops sub-commands: `git:create-worktree`, `git:branch-from-wp`, `devops:lint-and-format`, `devops:conventional-commit` (FR-051)
- [x] T119 Implement context + escape sub-commands: `context:load-spec`, `context:scan-codebase`, `escape:quick-fix`, `escape:hotfix`, `meta:generate-router`
- [x] T120 Implement audit logging for all sub-command invocations (FR-048) and write integration tests

### Dependencies
- Depends on WP13 (CLI commands), WP17 (triage), WP18 (Plane sync), WP19 (GitHub sync)

---

## Work Package WP21: CLI Triage & Queue Commands + Agent Defaults (Priority: P2)

**Goal**: Add `triage` and `queue` as user-facing CLI commands, implement agent DevOps defaults, and auto-triage during implement.
**Independent Test**: `agileplus triage "login is broken"` classifies as bug and creates GitHub issue. Agent auto-triages during implement.
**Prompt**: `tasks/WP21-cli-triage-queue.md`
**Estimated**: ~400 lines, 6 subtasks

### Included Subtasks
- [x] T121 Implement `commands/triage.rs`: accept input, classify, route to appropriate store (FR-040)
- [x] T122 Implement `commands/queue.rs`: add to backlog, surface during next specify/plan cycle (FR-042)
- [x] T123 Implement agent auto-triage hook: during implement, agents auto-file discovered bugs (FR-041)
- [x] T124 Implement agent DevOps defaults: conventional commits, branch naming, lint-before-push (FR-051)
- [x] T125 Implement CLAUDE.md/AGENTS.md first-action classifier integration (FR-052)
- [x] T126 Wire triage/queue to StoragePort, sync adapters, telemetry; write CLI integration tests
- [x] T127 Seed sub-command prompt files from hybridized reference commands (spec-kitty, bmad, gsd, openspec superset)

### Dependencies
- Depends on WP17 (triage adapter), WP20 (sub-commands)

---

## Work Package WP22: Modern Task Runner & DX Tooling Migration (Priority: P1)

**Goal**: Replace Make with a modern task runner (evaluate just/task/mise as of 2026) across all 5 repos. Migrate all Makefile targets, ensure cross-platform compatibility (Windows), and update CI/pre-commit to use the new runner.
**Repos**: All (agileplus-proto, agileplus-core, agileplus-mcp, agileplus-agents, agileplus-integrations)
**Independent Test**: `<runner> check` runs full local quality suite on all platforms. CI uses same runner. Windows works without WSL.
**Prompt**: `tasks/WP22-task-runner-dx-migration.md`
**Estimated**: ~400 lines, 7 subtasks

### Included Subtasks
- [ ] T128 Research and evaluate modern task runners (just, task, mise, moon, nx) — select best for Rust+Python polyglot, cross-platform, CI integration
- [ ] T129 [P] Migrate agileplus-proto Makefile to chosen runner with all targets (lint, generate, breaking, rust-*, python-*, check, pre-commit)
- [ ] T130 [P] Create agileplus-core task config with all quality gates (build, test, fmt, clippy, audit, deny, coverage, mutants, docs)
- [ ] T131 [P] Create agileplus-mcp task config (install, test, fmt, lint, audit, docs, coverage)
- [ ] T132 [P] Create agileplus-agents task config (mirroring core pattern)
- [ ] T133 [P] Create agileplus-integrations task config (mirroring core pattern)
- [ ] T134 Update CI workflows and pre-commit hooks across all repos to use new runner

### Implementation Notes
- Must work natively on macOS, Linux, and Windows (no WSL dependency)
- Must support task dependencies, parallelism, and environment variables
- Should integrate with pre-commit hooks and CI runners
- Consider mise for unified toolchain management (Rust, Python, Node, buf versions)

### Parallel Opportunities
- T129-T133 all independent after T128 decision

### Dependencies
- Depends on WP00 (proto repo exists), WP01 (core repo exists)

### Risks & Mitigations
- Runner not available on all CI images: use install step or container with runner pre-installed

---

## Dependency & Execution Summary

```
Phase 0 (Foundation — parallel across repos):
  WP00 (Proto scaffold) ─────── first, no deps
  WP01 (Core Rust scaffold) ─── depends on WP00
  WP02 (MCP Python scaffold) ── depends on WP00
  WP08 (Agents repo scaffold) ─ depends on WP00 (can start repo init in parallel with WP01)
  WP17 (Integrations repo scaffold) ── depends on WP00 (can start repo init in parallel with WP01)

Phase 1 (Domain — in agileplus-core, after WP01):
  WP03 (Feature/FSM) ────┐
  WP04 (Governance/Audit) ┤── parallel, both depend on WP01
  WP05 (Port traits) ─────┘── depends on WP03, WP04

Phase 2 (Core Adapters — parallel after WP05):
  WP06 (SQLite) ──────────┐
  WP07 (Git) ─────────────┤── all in agileplus-core, depend on WP05
  WP10 (Telemetry) ───────┘

Phase 2b (External Repo Adapters — parallel, in their own repos):
  WP09 (Review) ──────────── in agileplus-agents, depends on WP08
  WP18 (Plane.so Sync) ───── in agileplus-integrations, depends on WP17
  WP19 (GitHub Sync) ─────── in agileplus-integrations, depends on WP17

Phase 3 (CLI — in agileplus-core, after core adapters):
  WP11 (Specify/Research) ─── depends on WP06, WP07, WP10
  WP12 (Plan/Implement) ──── depends on WP11 (agent dispatch via gRPC to WP08)
  WP13 (Validate/Ship/Retro) ── depends on WP12

Phase 4 (Cross-repo Integration — after CLI):
  WP14 (gRPC Server + MCP) ── depends on WP00, WP13 (core gRPC + mcp tools)
  WP15 (API + Creds) ──────── depends on WP14
  WP16 (BDD + Integration) ── depends on WP15 (Docker Compose with all 4 services)

Phase 5 (Sub-Commands & CLI Triage):
  WP20 (Hidden Sub-Cmds) ─── depends on WP13, WP17, WP18, WP19
  WP21 (CLI Triage/Queue) ── depends on WP17, WP20

Phase 0b (DX Tooling — after repo scaffolds):
  WP22 (Task Runner Migration) ── depends on WP00, WP01
```

**Parallelization**: WP00 is the only sequential bottleneck. After WP00, up to 4 repos can be scaffolded in parallel (WP01, WP02, WP08, WP17). Phase 2 has 3 core adapter WPs in parallel + 3 external adapter WPs in parallel across repos.

**MVP Scope**: WP00 → WP01 → WP03 → WP05 → WP06 → WP07 → WP11 → WP12 → WP13 = 9 WPs for core CLI workflow (specify → ship). External services (agents, integrations, MCP) are additive.

---

## Subtask Index (Reference)

| Subtask | Summary | WP | Priority | Parallel? |
|---------|---------|-----|----------|-----------|
| T000a | Init proto repo | WP00 | P0 | No |
| T000b | common.proto shared types | WP00 | P0 | No |
| T000c | core.proto service | WP00 | P0 | Yes |
| T000d | agents.proto service | WP00 | P0 | Yes |
| T000e | integrations.proto service | WP00 | P0 | Yes |
| T000f | buf.yaml + buf.gen.yaml | WP00 | P0 | No |
| T000f2 | buf breaking change baseline + CI check | WP00 | P0 | No |
| T000g | Rust/Python codegen crates | WP00 | P0 | No |
| T001 | Cargo workspace manifest (7 crates) | WP01 | P0 | No |
| T002 | Scaffold agileplus-domain | WP01 | P0 | Yes |
| T003 | Scaffold 6 adapter crates | WP01 | P0 | Yes |
| T004 | Makefile | WP01 | P0 | Yes |
| T005 | Docker Compose | WP01 | P0 | Yes |
| T006 | Proto generation | WP01 | P0 | No |
| T006b | MSRV CI check (latest stable Rust) | WP01 | P0 | No |
| T006c | rustdoc CI generation + FR/WP traceability headers | WP01 | P0 | No |
| T006d | CI lint: agileplus-domain zero-dep validation | WP01 | P0 | No |
| T007 | Python pyproject.toml | WP02 | P0 | No |
| T008 | FastMCP server entry | WP02 | P0 | No |
| T009 | gRPC client stub | WP02 | P0 | Yes |
| T010 | MCP tool stubs | WP02 | P0 | Yes |
| T011 | Python test structure | WP02 | P0 | No |
| T011b | sphinx/autodoc CI generation for Python API ref | WP02 | P0 | No |
| T012 | Feature struct | WP03 | P0 | No |
| T013 | FeatureState enum | WP03 | P0 | No |
| T014 | State machine logic | WP03 | P0 | No |
| T015 | WorkPackage struct | WP03 | P0 | Yes |
| T016 | WP dependency logic | WP03 | P0 | Yes |
| T017 | FSM unit tests | WP03 | P0 | No |
| T017b | proptest property-based tests for FSM transitions | WP03 | P0 | No |
| T017c | cargo-mutants on state_machine.rs (≥90% score) | WP03 | P0 | No |
| T018 | GovernanceContract | WP04 | P0 | Yes |
| T019 | AuditEntry struct | WP04 | P0 | Yes |
| T020 | hash_entry() | WP04 | P0 | No |
| T021 | verify_chain() | WP04 | P0 | No |
| T022 | Evidence struct | WP04 | P0 | Yes |
| T023 | PolicyRule struct | WP04 | P0 | Yes |
| T024 | Governance unit tests | WP04 | P0 | No |
| T024b | proptest property-based tests for hash chain + governance | WP04 | P0 | No |
| T024c | cargo-mutants on audit.rs + governance.rs (≥90% score) | WP04 | P0 | No |
| T024d | Import/extend Phenotype governance patterns (FR-028, FR-029) | WP04 | P0 | No |
| T025 | StoragePort trait | WP05 | P0 | No |
| T026 | VcsPort trait | WP05 | P0 | Yes |
| T027 | AgentPort trait | WP05 | P0 | Yes |
| T028 | ReviewPort trait | WP05 | P0 | Yes |
| T029 | ObservabilityPort trait | WP05 | P0 | Yes |
| T030 | Port module re-exports | WP05 | P0 | No |
| T031 | SQLite migrations | WP06 | P1 | No |
| T032 | SqliteStorageAdapter | WP06 | P1 | No |
| T033 | Feature CRUD | WP06 | P1 | Yes |
| T034 | WP CRUD | WP06 | P1 | Yes |
| T035 | Audit CRUD | WP06 | P1 | Yes |
| T036 | Evidence+policy+metric CRUD | WP06 | P1 | Yes |
| T037 | rebuild_from_git | WP06 | P1 | No |
| T038 | GitVcsAdapter | WP07 | P1 | No |
| T039 | Worktree ops | WP07 | P1 | Yes |
| T040 | Branch ops | WP07 | P1 | Yes |
| T041 | Artifact ops | WP07 | P1 | Yes |
| T042 | Git history scanning | WP07 | P1 | No |
| T043 | Git integration tests | WP07 | P1 | No |
| T044 | Init agents repo + workspace | WP08 | P1 | No |
| T044b | AgentDispatchAdapter | WP08 | P1 | No |
| T045 | Claude Code harness | WP08 | P1 | Yes |
| T046 | Codex harness | WP08 | P1 | Yes |
| T047 | Agent dispatch logic | WP08 | P1 | No |
| T048 | PR creation + description | WP08 | P1 | No |
| T049 | Review-fix loop | WP08 | P1 | No |
| T049b | Agent gRPC service (agents.proto) | WP08 | P1 | No |
| T050 | ReviewAdapter | WP09 | P1 | No |
| T051 | Coderabbit integration | WP09 | P1 | Yes |
| T052 | Manual review fallback | WP09 | P1 | Yes |
| T053 | CI status checking | WP09 | P1 | Yes |
| T054 | Review unit tests | WP09 | P1 | No |
| T055 | TelemetryAdapter | WP10 | P1 | No |
| T056 | OTel traces | WP10 | P1 | Yes |
| T057 | OTel metrics | WP10 | P1 | Yes |
| T058 | Structured logging | WP10 | P1 | Yes |
| T059 | OTel config schema | WP10 | P1 | No |
| T060 | CLI main + clap | WP11 | P1 | No |
| T061 | specify command | WP11 | P1 | Yes |
| T062 | research command | WP11 | P1 | Yes |
| T063 | Refinement loop logic | WP11 | P1 | No |
| T064 | Governance checks in planning | WP11 | P1 | No |
| T065 | DI wiring for specify/research | WP11 | P1 | No |
| T066 | plan command | WP12 | P1 | Yes |
| T067 | File scope detection | WP12 | P1 | No |
| T068 | Dependency-aware scheduler | WP12 | P1 | No |
| T069 | implement command | WP12 | P1 | Yes |
| T070 | PR description builder | WP12 | P1 | No |
| T071 | Review-fix orchestrator | WP12 | P1 | No |
| T072 | DI wiring for plan/implement | WP12 | P1 | No |
| T073 | validate command | WP13 | P1 | Yes |
| T074 | Governance gate evaluator | WP13 | P1 | No |
| T075 | ship command | WP13 | P1 | Yes |
| T076 | retrospective command | WP13 | P1 | No |
| T077 | State machine enforcement | WP13 | P1 | No |
| T078 | DI wiring for validate/ship/retro | WP13 | P1 | No |
| T079 | tonic gRPC server | WP14 | P2 | Yes |
| T080 | gRPC handler wiring | WP14 | P2 | No |
| T080b | gRPC proxy to agents/integrations | WP14 | P2 | No |
| T081 | Python gRPC client | WP14 | P2 | Yes |
| T082 | MCP tool handlers | WP14 | P2 | No |
| T083 | Agent event streaming | WP14 | P2 | No |
| T084 | Pact contract tests | WP14 | P2 | No |
| T084b | MCP Sampling primitive (server-initiated triage/governance) | WP14 | P2 | No |
| T084c | MCP Roots primitive (workspace boundaries per feature/WP) | WP14 | P2 | No |
| T084d | MCP Elicitation primitive (discovery interview flows) | WP14 | P2 | No |
| T085 | axum router | WP15 | P2 | No |
| T086 | API route handlers | WP15 | P2 | No |
| T087 | Auth middleware | WP15 | P2 | Yes |
| T088 | Credential management | WP15 | P2 | Yes |
| T089 | Config schema + loader | WP15 | P2 | Yes |
| T090 | API integration tests | WP15 | P2 | No |
| T091 | BDD .feature files | WP16 | P2 | No |
| T092 | Rust BDD step defs | WP16 | P2 | Yes |
| T093 | Python BDD step defs | WP16 | P2 | Yes |
| T094 | Pact contract fixtures | WP16 | P2 | Yes |
| T095 | Docker Compose test env | WP16 | P2 | No |
| T096 | Full workflow integration test | WP16 | P2 | No |
| T097 | Test fixtures | WP16 | P2 | No |
| T098 | Init integrations repo + workspace | WP17 | P2 | No |
| T098b | TriageAdapter + classify | WP17 | P2 | No |
| T099 | BacklogItem CRUD | WP17 | P2 | No |
| T100 | Intent classifier | WP17 | P2 | No |
| T101 | CLAUDE.md router gen | WP17 | P2 | No |
| T102 | AGENTS.md gen | WP17 | P2 | No |
| T102b | Integrations gRPC service (integrations.proto) | WP17 | P2 | No |
| T103 | Triage unit tests | WP17 | P2 | No |
| T104 | PlaneSyncAdapter | WP18 | P2 | No |
| T105 | Feature → Plane.so sync | WP18 | P2 | Yes |
| T106 | WP → Plane.so sync | WP18 | P2 | Yes |
| T107 | Plane.so conflict detection | WP18 | P2 | No |
| T108 | Plane.so mock tests | WP18 | P2 | No |
| T109 | GitHubSyncAdapter | WP19 | P2 | No |
| T110 | Bug → GitHub issue sync | WP19 | P2 | Yes |
| T111 | Issue status sync | WP19 | P2 | Yes |
| T112 | GitHub conflict detection | WP19 | P2 | No |
| T113 | GitHub mock tests | WP19 | P2 | No |
| T114 | Sub-command registry | WP20 | P2 | No |
| T115 | Triage sub-commands | WP20 | P2 | Yes |
| T116 | Governance sub-commands | WP20 | P2 | Yes |
| T117 | Sync sub-commands | WP20 | P2 | Yes |
| T118 | Git/devops sub-commands | WP20 | P2 | Yes |
| T119 | Context/escape sub-commands | WP20 | P2 | Yes |
| T120 | Sub-command audit logging | WP20 | P2 | No |
| T121 | triage CLI command | WP21 | P2 | No |
| T122 | queue CLI command | WP21 | P2 | No |
| T123 | Agent auto-triage hook | WP21 | P2 | No |
| T124 | Agent DevOps defaults | WP21 | P2 | No |
| T125 | CLAUDE.md first-action classifier | WP21 | P2 | No |
| T126 | Triage/queue DI wiring | WP21 | P2 | No |
| T127 | Seed sub-command prompts | WP21 | P2 | No |
| T128 | Research/evaluate task runners (just, task, mise, moon, nx) | WP22 | P1 | No |
| T129 | Migrate agileplus-proto Makefile | WP22 | P1 | Yes |
| T130 | Create agileplus-core task config | WP22 | P1 | Yes |
| T131 | Create agileplus-mcp task config | WP22 | P1 | Yes |
| T132 | Create agileplus-agents task config | WP22 | P1 | Yes |
| T133 | Create agileplus-integrations task config | WP22 | P1 | Yes |
| T134 | Update CI workflows + pre-commit for new runner | WP22 | P1 | No |
