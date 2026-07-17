# Feature Specification: AgilePlus — Spec-Driven Development Engine

**Feature Branch**: `001-spec-driven-development-engine`
**Created**: 2026-02-27
**Status**: Draft
**Mission**: software-dev

## Overview

AgilePlus is a local, git+SQLite-backed spec-driven development engine that runs as a CLI sidecar alongside Claude Code and Codex. It harmonizes the best of OpenSpec (simplicity, ~3 commands to plan), spec-kitty (structured granularity, worktree isolation, kanban tracking), bmad (enterprise depth, role-based agents), and GSD (automation, parallel execution) into a streamlined 7-command workflow.

AgilePlus does not build a custom agent engine. It orchestrates existing AI coding agents (Claude Code, Codex) through slash commands, dispatching work to subagents in isolated worktrees. A Plane.so-based (or equivalent OSS) web UI provides visual project management, auditing, and dashboards — not built from scratch.

AgilePlus becomes the canonical governance source for the Phenotype organization, incorporating a thegent-inspired smart contract system for evidence-backed state transitions, hash-chained audit logs, and policy-driven quality gates.

**Interfaces**: MCP server (FastMCP 3.0), CLI, API. Extensible via agent Skills and plugins.

### Multi-Repo Architecture

AgilePlus is decomposed into 5 independent repositories to enforce CLEAN/SOLID/Hexagonal boundaries at the repository level, prevent scope creep, and enable independent scaling/deployment/versioning:

| Repository | Purpose | Language |
|------------|---------|----------|
| `agileplus-proto` | Shared contracts (gRPC + MCP schemas) | Protobuf → Rust/Python |
| `agileplus-core` | Domain + CLI + API + storage | Rust |
| `agileplus-mcp` | MCP server (FastMCP 3.0) | Python |
| `agileplus-agents` | Agent dispatch + review loop | Rust |
| `agileplus-integrations` | Plane.so + GitHub + triage sync | Rust |

All cross-repo communication uses gRPC with contracts defined in `agileplus-proto`. Each repo can be built, tested, versioned, and deployed independently. The proto repo is consumed as a git submodule or dependency by all other repos.

### Agent-First Architecture

AgilePlus leverages Claude Code's SlashCommand tool (v1.0.123+) to enable agents to programmatically invoke slash commands. The user sees 7 commands; behind the scenes, agents orchestrate ~25 hidden sub-commands that provide bmad-level depth without user friction.

**Prompt Router Pattern**: Each project gets a generated `CLAUDE.md` and `AGENTS.md` that act as a prompt router. An agent's first action is to classify/triage the user's intent and route to the appropriate sub-command chain. This enables dynamic, context-aware workflows without requiring the user to know the internal command vocabulary.

**MCP Primitives**: AgilePlus maps all 6 MCP primitives — Tools (CRUD operations), Resources (specs, audit trails, plans), Prompts (slash command templates), Sampling (server-initiated analysis like triage), Roots (workspace boundaries per feature/WP), and Elicitation (discovery interviews during specify/clarify).

### Source of Truth & Sync Architecture

- **SQLite**: Source of truth for all operational state (feature status, WP progress, audit chain, metrics)
- **Git**: Source of truth for all artifacts (specs, plans, tasks, evidence, governance contracts)
- **Plane.so**: Synced mirror for features and work packages (visual PM, kanban boards)
- **GitHub Issues**: Synced mirror for bugs and issues (triage → GitHub issue → agent fix cycle)

Sync is unidirectional from SQLite → mirrors, with conflict detection on mirror-side edits.

## Clarifications

### Session 2026-02-27

- Q: How should AgilePlus handle credentials? → A: Harnesses manage their own LLM credentials; AgilePlus manages integration keys (GitHub, Coderabbit, Plane.so) via its own config. AgilePlus never touches CLI binaries or agent credentials — it operates through MCP, Skills, and slash commands.
- Q: What is explicitly NOT part of AgilePlus v1? → A: No cloud sync, no mobile. Basic multi-user supported via shared git repo. Local-first.
- Q: Can planning states be skipped? → A: Default is strict ordering (specify → research → plan → implement → validate → ship). Steps may be skipped only when the user's prompt clearly indicates it's unnecessary (e.g., trivial fix) — system warns and proceeds.
- Q: What observability should AgilePlus provide? → A: Full — structured logs + metrics + OpenTelemetry traces exportable to external dashboards.
- Q: How should resource conflicts between parallel WPs be handled? → A: Worktree isolation by default + dependency-aware scheduling when WPs declare shared files.

## Out of Scope (v1)

- Cloud sync / remote state replication
- Mobile clients or responsive web UI
- Custom agent engine — uses Claude Code and Codex harnesses exclusively
- LLM credential management — delegated entirely to harnesses
- Blockchain or distributed ledger (smart contracts are local process guarantees)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Greenfield: Idea to Implementation-Ready Plan (Priority: P1)

A developer has a new feature idea. They invoke `specify` to describe it through a guided discovery interview. The system creates a spec backed by SQLite with full audit trail. They then run `research` for technical feasibility analysis, followed by `plan` which generates work packages, dependency graphs, and governance contracts. At the end of these 3 commands, the project is ready for `implement`.

**Why this priority**: This is the core value proposition — reducing the idea-to-implementation gap from 8+ commands (bmad) or manual ceremony to 3 streamlined commands with implicit refinement loops.

**Independent Test**: Can be fully tested by running `specify` → `research` → `plan` on a sample feature and verifying that spec.md, research artifacts, plan.md, tasks/work packages, and governance contracts are all generated with valid cross-references and audit entries.

**Acceptance Scenarios**:

1. **Given** an empty project with AgilePlus initialized, **When** the user runs `specify` and completes the discovery interview, **Then** a spec is created in SQLite + git with all mandatory sections populated, audit log entry recorded, and the system prompts for `research` or `plan` as next step.
2. **Given** a completed spec, **When** the user runs `plan`, **Then** work packages are generated with dependency ordering, each WP has acceptance criteria traceable to spec FRs, and a governance contract is written for the feature.
3. **Given** a completed plan with work packages, **When** the user runs `plan` again with modifications, **Then** the system performs a refinement loop — diffing changes, updating affected WPs, and recording the revision in the audit log.

---

### User Story 2 — Automated Implementation Cycle (Priority: P1)

A developer runs `implement` on a planned feature. AgilePlus spawns 1-3 subagents per worktree (using Claude Code/Codex), each working on assigned work packages in isolated git worktrees. Each agent creates a PR with the original goal/prompt in the PR description and detailed commit messages. The system awaits Coderabbit auto-review, then loops agents on review comments and CI fixes until the PR is green. Once a WP's PR passes, the system moves to the next WP.

**Why this priority**: The implementation loop is where the most time is saved — automating the agent → PR → review → fix → merge cycle removes the manual orchestration overhead.

**Independent Test**: Can be tested by running `implement` on a single WP and verifying: worktree created, subagent dispatched, PR created with goal context, Coderabbit review awaited, agent loops on feedback, PR merges when green.

**Acceptance Scenarios**:

1. **Given** a feature with 3 planned WPs, **When** the user runs `implement`, **Then** the system creates isolated worktrees for each WP, spawns subagents (1-3 per worktree), and each agent begins working on its assigned WP.
2. **Given** an agent has completed its WP work, **When** it creates a PR, **Then** the PR description contains the original goal/prompt from the WP, commit messages are detailed and reference the WP/FR, and the system waits for Coderabbit auto-review.
3. **Given** Coderabbit has posted review comments, **When** there are actionable findings, **Then** the agent reads the comments, makes fixes, pushes new commits, and re-awaits review until CI is green and review is approved.
4. **Given** a WP's PR is approved and CI passes, **When** the system detects this, **Then** it records evidence in the audit log, updates the WP state in SQLite, and proceeds to the next WP respecting dependency ordering.

---

### User Story 3 — Brownfield: Existing Codebase Integration (Priority: P2)

A developer initializes AgilePlus in an existing project. The `research` command (in pre-specify mode) scans the codebase to understand architecture, conventions, dependencies, and existing governance patterns. This analysis feeds into `specify` so that new features are context-aware. The existing governance docs (CLAUDE.md, AGENTS.md, quality gates) are imported into AgilePlus's governance system.

**Why this priority**: Most real-world usage will be brownfield. Without codebase awareness, generated plans will conflict with existing patterns.

**Independent Test**: Can be tested by running `research` on an existing Phenotype repo (e.g., bifrost-extensions) and verifying it produces a codebase analysis that correctly identifies languages, frameworks, architecture patterns, and existing governance rules.

**Acceptance Scenarios**:

1. **Given** an existing project with CLAUDE.md and AGENTS.md, **When** the user runs `research` in pre-specify mode, **Then** the system scans the codebase and produces a structured analysis including: languages/frameworks detected, architecture patterns, existing governance rules, and dependency map.
2. **Given** a brownfield research analysis exists, **When** the user runs `specify` for a new feature, **Then** the discovery interview incorporates codebase context and generated requirements are consistent with existing patterns.

---

### User Story 4 — Validation and Quality Gates (Priority: P2)

After implementation, the developer runs `validate`. The system checks all WP PRs against governance contracts, verifies FR-to-evidence tracing (every functional requirement has test evidence), runs quality gate policies, and produces a validation report. Only when all gates pass can the feature proceed to `ship`.

**Why this priority**: Governance enforcement is what differentiates AgilePlus from ad-hoc agent workflows. Without it, the system is just a fancy task dispatcher.

**Independent Test**: Can be tested by running `validate` on a feature with one passing and one failing WP, verifying that the report correctly identifies the gap, blocks shipping, and provides actionable feedback.

**Acceptance Scenarios**:

1. **Given** all WPs are implemented with merged PRs, **When** the user runs `validate`, **Then** the system checks: all FRs have corresponding test evidence, quality gate policies pass (lint, type-check, test coverage, security), and governance contracts are satisfied.
2. **Given** a validation failure (e.g., FR-003 has no test evidence), **When** the report is generated, **Then** it identifies the specific gap, references the FR and responsible WP, and suggests remediation steps.
3. **Given** all validation checks pass, **When** the system completes validation, **Then** the feature state transitions to "validated" in SQLite with a hash-chained audit entry, and the user is prompted to run `ship`.

---

### User Story 5 — Ship and Retrospective (Priority: P2)

The developer runs `ship` to merge the feature into the target branch, clean up worktrees, archive the feature, and record completion in the audit log. Optionally, they run `retrospective` which auto-generates learnings from the feature's history (time per WP, review cycles, common issues) and feeds insights back into the constitution/governance for future features.

**Why this priority**: Clean closure and learning loops prevent governance drift and improve future feature velocity.

**Independent Test**: Can be tested by running `ship` on a validated feature and verifying: feature branch merged, worktrees cleaned, SQLite records updated, audit log finalized. Then `retrospective` generates a summary with actionable learnings.

**Acceptance Scenarios**:

1. **Given** a validated feature, **When** the user runs `ship`, **Then** the feature branch is merged to the target branch, all worktrees are cleaned up, the feature is archived in SQLite, and a final audit entry is recorded.
2. **Given** a shipped feature, **When** the user runs `retrospective`, **Then** the system analyzes the feature's history and generates: time-per-WP, review cycle counts, common review findings, and suggested governance updates. Learnings are offered as amendments to the constitution.

---

### User Story 6 — Smart Contract Governance (Priority: P3)

AgilePlus enforces a thegent-inspired smart contract system. Every state transition (spec created → researched → planned → implementing → validated → shipped) requires evidence. Governance contracts define what evidence is needed at each gate. The SQLite ledger stores hash-chained audit records. Policy rules (quality, security, cost) are evaluated at each transition. Violations block progression.

**Why this priority**: This is the long-term differentiator but can be incrementally adopted — initial versions can use lightweight policies while the full evidence chain matures.

**Independent Test**: Can be tested by attempting a state transition without required evidence and verifying it is blocked with a clear error message referencing the governance contract.

**Acceptance Scenarios**:

1. **Given** a governance contract requiring test evidence for FR-001, **When** a WP attempts to transition to "validated" without test evidence, **Then** the transition is blocked and the system reports: "FR-001 missing test evidence — required by governance contract GC-001."
2. **Given** all state transitions for a feature, **When** the audit log is inspected, **Then** each entry is hash-chained (SHA-256), contains the transition type, evidence references, timestamp, and actor, and the chain is tamper-verifiable.

---

### User Story 7 — MCP Server and External Integration (Priority: P3)

AgilePlus exposes its capabilities via a FastMCP 3.0 server, allowing external tools and agents to query project state, read specs, check governance status, and trigger commands programmatically. A CLI interface provides the same capabilities for scripting and CI/CD integration. An API layer enables the Plane.so web UI to read/write project data.

**Why this priority**: Extensibility is critical for ecosystem integration but depends on the core workflow being stable first.

**Independent Test**: Can be tested by starting the MCP server and using an MCP client to list features, read a spec, and check governance status for a feature.

**Acceptance Scenarios**:

1. **Given** AgilePlus is running with the MCP server, **When** an external agent queries for the current feature's status, **Then** it receives structured data including: feature state, WP progress, governance gate status, and next recommended action.
2. **Given** the CLI interface, **When** a CI/CD script runs `agileplus validate --feature 001`, **Then** it returns exit code 0 on success or non-zero with structured error output on failure.

---

### User Story 8 — Triage, Queue & Bug Reporting (Priority: P2)

A developer or agent encounters an idea, bug, or feature request during any workflow. They invoke `triage` (or the agent auto-triages based on prompt routing). The system classifies the input, creates the appropriate artifact (GitHub issue for bugs, Plane.so item for features, SQLite backlog entry for ideas), and optionally queues it for the next planning cycle. Agents follow this pattern by default — discovered bugs during `implement` are auto-triaged rather than ignored.

**Why this priority**: Good DevOps hygiene requires capturing work items at discovery time. Without triage, bugs found during implementation are lost or manually tracked.

**Independent Test**: Can be tested by submitting a bug report via CLI and verifying: GitHub issue created, SQLite backlog entry written, audit log records the triage event.

**Acceptance Scenarios**:

1. **Given** a developer encounters a bug during implementation, **When** they (or the agent) invoke triage with a bug description, **Then** a GitHub issue is created with structured metadata, a SQLite entry links the bug to the current feature/WP, and the audit log records the triage.
2. **Given** a feature idea is queued, **When** the developer later runs `specify`, **Then** queued ideas are surfaced as suggestions during the discovery interview.
3. **Given** an agent is working on a WP and discovers an unrelated bug, **When** the agent auto-triages, **Then** the bug is filed without interrupting the current WP workflow.

---

### User Story 9 — Agent Prompt Routing & Hidden Sub-Commands (Priority: P2)

An agent receives a user request. Before executing, it reads the project's `CLAUDE.md`/`AGENTS.md` (generated by AgilePlus) which acts as a prompt router. The agent classifies the intent (e.g., "fix this bug" → triage → implement, "add a feature" → specify → plan → implement) and invokes the appropriate chain of hidden sub-commands via the SlashCommand tool. The user sees a single high-level command; the agent orchestrates 3-10 sub-commands behind the scenes.

**Why this priority**: This is what makes AgilePlus feel simple while being powerful. Without prompt routing, users must manually orchestrate the full workflow.

**Independent Test**: Can be tested by giving an agent a vague request ("make the login faster") and verifying: agent triages → selects research+implement path → executes sub-commands → produces PR with audit trail.

**Acceptance Scenarios**:

1. **Given** a project with AgilePlus-generated CLAUDE.md, **When** an agent receives "fix the auth bug", **Then** it routes through: triage → research (codebase scan) → implement (targeted fix) → validate.
2. **Given** the hidden sub-command vocabulary, **When** an agent needs to check governance before proceeding, **Then** it invokes the `governance:check-gates` sub-command programmatically via SlashCommand tool.
3. **Given** a complex request spanning multiple commands, **When** the agent orchestrates, **Then** each sub-command invocation is logged in the audit trail with the routing decision.

---

### Edge Cases

- What happens when a subagent fails mid-WP (crash, timeout, API limit)? The system must checkpoint progress, allow resumption, and not corrupt the audit trail.
- What happens when Coderabbit is unavailable? The system should degrade gracefully — allow manual review approval or skip automated review with a governance exception recorded.
- What happens when two features modify overlapping files? The worktree isolation prevents conflicts during work, but merge conflicts at `ship` time must be detected and surfaced with clear remediation guidance.
- What happens when the SQLite database is corrupted? Git remains the source of truth — the system must be able to rebuild SQLite state from git history.
- What happens when governance contracts are updated mid-feature? Features in progress should be evaluated against the contract version at feature creation, with an option to adopt the new contract.

## Requirements *(mandatory)*

### Functional Requirements

**Core Workflow:**
- **FR-001**: System MUST provide a `specify` command that conducts a guided discovery interview and produces a structured specification stored in both git and SQLite.
- **FR-002**: System MUST provide a `research` command that supports both pre-specify (domain/market analysis, codebase scanning) and post-specify (technical feasibility) modes.
- **FR-003**: System MUST provide a `plan` command that generates work packages with dependency ordering, acceptance criteria traced to spec FRs, and governance contracts.
- **FR-004**: System MUST provide an `implement` command that spawns 1-3 subagents per worktree via Claude Code/Codex harnesses, creating PRs with goal/prompt context and detailed commit messages.
- **FR-005**: System MUST provide a `validate` command that checks FR-to-evidence tracing, runs quality gate policies, and produces a validation report.
- **FR-006**: System MUST provide a `ship` command that merges to target branch, cleans up worktrees, archives the feature, and finalizes the audit log.
- **FR-007**: System MUST provide an optional `retrospective` command that generates learnings and suggests governance amendments.

**Planning Commands — Implicit Refinement:**
- **FR-008**: Each planning command (`specify`, `research`, `plan`) MUST include implicit refinement/review loops — the user can re-run any command to iterate, with changes tracked as revisions in the audit log.
- **FR-009**: Planning commands MUST implicitly incorporate relevant governance checks (constitution compliance, consistency with existing specs/plans).

**Implementation Automation:**
- **FR-010**: The `implement` command MUST create isolated git worktrees per work package.
- **FR-011**: The `implement` command MUST instruct agents to include the original WP goal/prompt in PR descriptions.
- **FR-012**: The `implement` command MUST await automated code review (Coderabbit) and loop agents on review comments and CI failures until the PR is green.
- **FR-013**: The `implement` command MUST respect WP dependency ordering — dependent WPs wait for their prerequisites to complete.

**Storage and Auditability:**
- **FR-014**: System MUST use git as the primary source of truth for all artifacts (specs, plans, tasks, evidence).
- **FR-015**: System MUST use SQLite as the operational database for state tracking, querying, and performance.
- **FR-016**: System MUST maintain a hash-chained (SHA-256) audit log in SQLite for all state transitions.
- **FR-017**: System MUST be able to rebuild SQLite state from git history if the database is lost or corrupted.

**Governance — Smart Contracts:**
- **FR-018**: System MUST enforce governance contracts that define required evidence for each state transition.
- **FR-019**: System MUST block state transitions when required evidence is missing, with clear error messages referencing the specific contract and missing evidence.
- **FR-020**: System MUST support policy rules across domains: quality (lint, type-check, test coverage), security (vulnerability scanning), and reliability.
- **FR-021**: System MUST support FR-to-evidence tracing — every functional requirement must map to test evidence before validation passes.

**Interfaces:**
- **FR-022**: System MUST expose capabilities via a FastMCP 3.0 server for external tool/agent integration.
- **FR-023**: System MUST provide a CLI interface for scripting and CI/CD integration.
- **FR-024**: System MUST provide an API layer for web UI integration (Plane.so or equivalent).
- **FR-025**: System MUST support extensibility via agent Skills and plugins.

**Web UI:**
- **FR-026**: System MUST integrate with Plane.so (or equivalent OSS) for visual project management — kanban boards, spec browsing, audit trail viewing, dashboard.
- **FR-027**: The web UI MUST be a sidecar — running alongside the CLI, reading from the same git+SQLite data store, not a separate system.

**Credential Management:**
- **FR-030**: System MUST manage integration credentials (GitHub, Coderabbit, Plane.so) via its own encrypted local config.
- **FR-031**: System MUST NOT manage LLM or agent harness credentials — these are delegated entirely to Claude Code/Codex.
- **FR-032**: System MUST interact with agents exclusively through MCP, Skills, and slash commands — never by touching CLI binaries directly.

**State Machine:**
- **FR-033**: System MUST enforce strict command ordering by default: specify → research → plan → implement → validate → ship.
- **FR-034**: System MAY allow skipping steps only when the user's prompt clearly indicates it's unnecessary (e.g., trivial fix, quick prototype), with a warning logged in the audit trail.

**Observability:**
- **FR-035**: System MUST emit structured logs for all operations.
- **FR-036**: System MUST collect and store metrics in SQLite (time-per-WP, agent runs, review cycles, command durations).
- **FR-037**: System MUST support OpenTelemetry trace export to external dashboards.

**Conflict Resolution:**
- **FR-038**: System MUST use worktree isolation as the default conflict prevention mechanism for parallel WPs.
- **FR-039**: System MUST support dependency-aware scheduling — when WPs declare shared files, conflicting WPs are serialized rather than parallelized.

**Triage & Queue:**
- **FR-040**: System MUST provide a `triage` sub-command that classifies input as bug, feature, idea, or task and routes to the appropriate artifact store (GitHub issue, Plane.so item, SQLite backlog).
- **FR-041**: System MUST auto-triage bugs discovered by agents during `implement` — agents file bugs without interrupting their current WP workflow.
- **FR-042**: System MUST provide a `queue` sub-command that adds items to a backlog for later processing, surfaced during the next `specify` or `plan` cycle.

**Sync & Integration:**
- **FR-043**: System MUST sync feature/WP state from SQLite to Plane.so (create/update work items, update kanban board status).
- **FR-044**: System MUST sync bug reports from SQLite to GitHub Issues (create issues with structured metadata, labels, and feature/WP cross-references).
- **FR-045**: System MUST detect and warn on mirror-side edits (changes made directly in Plane.so or GitHub that conflict with SQLite state).

**Prompt Routing & Sub-Commands:**
- **FR-046**: System MUST generate a project-specific `CLAUDE.md` and `AGENTS.md` that acts as a prompt router for agents, classifying user intent and routing to appropriate sub-command chains.
- **FR-047**: System MUST expose ~25 hidden sub-commands (grouped as triage, governance, PM sync, git/devops, context, quick escapes) invocable by agents via the SlashCommand tool.
- **FR-048**: System MUST log all agent sub-command invocations in the audit trail, including the routing decision and chain of commands executed.

**MCP Primitives:**
- **FR-049**: MCP server MUST implement all 6 MCP primitives: Tools (CRUD), Resources (read specs/audit), Prompts (command templates), Sampling (server-initiated triage/analysis), Roots (workspace boundaries), Elicitation (discovery interviews).
- **FR-050**: MCP server MUST leverage FastMCP 3.0 features: background tasks (via Docket+SQLite), component versioning, per-component auth, Resources-as-Tools/Prompts-as-Tools transforms, native OpenTelemetry.

**Agent DevOps Defaults:**
- **FR-051**: Agents MUST follow CI/CD best practices by default: conventional commits, PR templates with WP context, branch naming conventions, automated linting before push.
- **FR-052**: Agents MUST use the project's CLAUDE.md/AGENTS.md as their first-action classifier before executing any work.

**Multi-Repo Architecture:**
- **FR-053**: System MUST define all inter-service contracts in a shared `agileplus-proto` repository, consumed by all service repos as a git submodule or dependency.
- **FR-054**: Each service repository (core, mcp, agents, integrations) MUST be independently buildable and testable with only the proto dependency.
- **FR-055**: Cross-repo communication MUST use gRPC with Protobuf contracts — no direct in-process calls between repos.
- **FR-056**: The proto repository MUST generate typed stubs for both Rust (tonic/prost) and Python (grpcio) from a single set of `.proto` files.
- **FR-057**: Each service MUST implement its own gRPC service definition (core.proto, agents.proto, integrations.proto) with shared message types from common.proto.

**Governance Source:**
- **FR-028**: System MUST serve as the canonical governance source for the Phenotype organization, consolidating worktree discipline, quality gates, and agent workflow rules.
- **FR-029**: System MUST integrate and extend existing Phenotype governance patterns (from parpour, civ, thegent).

### Key Entities

- **Feature**: A unit of work from idea to shipment. Has a spec, research artifacts, plan, work packages, governance contracts, and audit trail. Stored in git (markdown/YAML) and indexed in SQLite.
- **Work Package (WP)**: A decomposed unit of implementation within a feature. Has acceptance criteria, dependency links, assigned agents, PR references, and state (planned → doing → review → done).
- **Governance Contract**: Defines required evidence and policy rules for a feature or WP state transition. Versioned and immutable once bound to a feature.
- **Audit Entry**: A hash-chained record of a state transition, including: timestamp, actor, transition type, evidence references, and SHA-256 chain link.
- **Evidence**: Test results, CI output, review approvals, or other artifacts that satisfy governance contract requirements. Linked to FRs and WPs.
- **Constitution**: Project-wide governance principles (technical standards, quality expectations, conventions). Updated via `retrospective` amendments.
- **Policy Rule**: A specific quality/security/reliability check evaluated at state transitions. Configurable per project.
- **Backlog Item**: A triaged bug, feature idea, or task queued for future processing. Classified by type, linked to originating feature/WP if discovered during implementation.
- **Sub-Command**: A hidden operational command (one of ~25) invocable by agents via SlashCommand tool. Grouped into categories: triage, governance, PM sync, git/devops, context, quick escapes.
- **Prompt Router**: A generated CLAUDE.md/AGENTS.md file that acts as an agent's first-action classifier, mapping user intent to sub-command chains.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from feature idea to implementation-ready plan in 3 commands (`specify` → `research` → `plan`) averaging under 10 minutes of active user input.
- **SC-002**: The `implement` → Coderabbit review → fix loop completes without manual user intervention for straightforward WPs (user only intervenes for ambiguous review findings).
- **SC-003**: Every shipped feature has 100% FR-to-evidence traceability — no functional requirement lacks corresponding test evidence.
- **SC-004**: The audit trail for any feature can be independently verified (hash chain integrity check passes) and reconstructed from git history alone.
- **SC-005**: Total command count for a full feature lifecycle (idea → shipped) is 7 or fewer commands: `specify`, `research`, `plan`, `implement`, `validate`, `ship`, plus optional `retrospective`.
- **SC-006**: Brownfield integration (running `research` on an existing codebase) correctly identifies languages, frameworks, architecture patterns, and existing governance in under 5 minutes.
- **SC-007**: The system supports at least 3 concurrent features with independent worktree isolation, no cross-feature state corruption, and parallel agent execution.
- **SC-008**: Governance violations are caught and blocked before they reach the target branch — zero governance-violating merges after `validate` + `ship`.

## Assumptions

- Claude Code and Codex remain the primary AI coding agent harnesses and maintain their current subagent/worktree capabilities.
- Coderabbit (or equivalent automated code review) is available as a GitHub integration for PR review automation.
- Plane.so Community Edition provides sufficient customizability for the web UI sidecar without forking.
- SQLite is sufficient for single-developer and small-team workloads (no need for PostgreSQL in the initial version). Basic multi-user is supported via shared git repo; no cloud sync in v1.
- FastMCP 3.0 is stable and available for MCP server implementation.
- Existing Phenotype governance patterns (worktree discipline, quality gates, CLAUDE.md/AGENTS.md conventions) are the baseline to extend, not replace.
- Multi-repo architecture with gRPC boundaries is viable for a local-first tool; the gRPC overhead (<10ms) is acceptable for inter-service communication.
- Each repo can maintain independent CI/CD pipelines; the proto repo is the only shared build dependency.
- TypeScript 7, Zig, and Go are available for future components where they outperform Rust/Python. v1 uses Rust + Python exclusively; TS7/Zig/Go adoption requires an ADR.
- Plane.so Community Edition setup and configuration is handled by the user outside AgilePlus. AgilePlus syncs data to an existing Plane.so instance via API — it does not provision or configure the Plane.so deployment.
