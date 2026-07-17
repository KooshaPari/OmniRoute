# Implementation Plan: AgilePlus — Spec-Driven Development Engine

**Branch**: `001-spec-driven-development-engine` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

AgilePlus is a local, git+SQLite-backed spec-driven development engine providing a 7-command workflow (specify, research, plan, implement, validate, ship, retrospective). It orchestrates Claude Code and Codex agents via MCP/Skills/slash commands, enforces thegent-inspired smart contract governance, and integrates with Plane.so for visual project management.

Architecture: 5 independent repositories — proto (shared contracts), Rust core (domain + CLI + API + gRPC), Python MCP (FastMCP 3.0), Rust agents (dispatch + review), Rust integrations (sync + triage). Hexagonal architecture with clean port/adapter separation. Cross-repo communication via gRPC with Protobuf contracts from shared proto repo.

## Technical Context

**Language/Version**: Rust 2024 edition (nightly for async trait features) + Python 3.13+ (free-threaded)
**Primary Dependencies**:
- Rust: clap (CLI), axum + tokio (API), tonic (gRPC), rusqlite (SQLite), git2 (libgit2 bindings), opentelemetry (tracing), serde (serialization), sha2 (hash chains)
- Python: fastmcp>=3.0 (MCP server), grpcio (gRPC client), opentelemetry-sdk (tracing)
**Storage**: SQLite (rusqlite) + git (git2/libgit2). SQLite for operational state; git for source of truth.
**Testing**:
- Rust: cargo test (unit), cucumber-rs (BDD), pact-rust (contract)
- Python: pytest (unit), behave (BDD), pact-python (contract)
- Integration: Docker Compose test harness
**Target Platform**: macOS (primary), Linux (CI/server), Windows 10+ (cross-platform). Cross-platform via Rust.
**Project Type**: Polyglot microservice (Rust core + Python MCP)
**Performance Goals**: CLI startup <50ms, SQLite queries <5ms, gRPC round-trip <10ms, API responses <100ms
**Constraints**: <100MB memory idle, local-only (no cloud), SQLite single-writer (WAL mode for concurrent reads)
**Scale/Scope**: 3+ concurrent features, 50+ WPs per feature, 10+ subagents parallel

## Constitution Check

*SKIPPED — no constitution file exists. Run `/spec-kitty.constitution` to create one.*

## Project Structure

### Documentation (this feature)

```
kitty-specs/001-spec-driven-development-engine/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology research
├── data-model.md        # Phase 1: entity/relationship model
├── contracts/           # Phase 1: gRPC + API contracts
│   ├── common.proto     # Shared message types
│   ├── core.proto       # Core domain gRPC service
│   ├── agents.proto     # Agent dispatch gRPC service
│   ├── integrations.proto # Integrations gRPC service
│   ├── api-openapi.yaml # REST API schema (axum endpoints)
│   └── mcp-tools.json   # MCP tool definitions (FastMCP)
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (5 independent repositories)

```
# ─── Repo 1: agileplus-proto (shared contracts) ───
agileplus-proto/
├── proto/
│   ├── agileplus/
│   │   ├── core.proto          # Core domain service (features, WPs, audit)
│   │   ├── agents.proto        # Agent dispatch service (spawn, status, cancel)
│   │   ├── integrations.proto  # Sync service (plane, github, triage)
│   │   └── common.proto        # Shared message types
│   └── buf.yaml
├── rust/                       # Generated Rust crate (git dep)
│   ├── Cargo.toml
│   └── src/lib.rs              # Re-exports generated code
├── python/                     # Generated Python package
│   ├── pyproject.toml
│   └── src/agileplus_proto/
├── schemas/
│   ├── mcp-tools.json          # MCP tool definitions
│   └── mcp-resources.json      # MCP resource definitions
├── Makefile                    # buf generate, cargo publish, uv publish
└── README.md

# ─── Repo 2: agileplus-core (domain + CLI + storage) ───
agileplus-core/
├── crates/
│   ├── agileplus-domain/       # Domain layer — entities, FSM, governance, audit (ZERO I/O deps)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── domain/
│   │       │   ├── feature.rs       # Feature aggregate
│   │       │   ├── work_package.rs  # WP aggregate
│   │       │   ├── governance.rs    # Contract, policy, evidence
│   │       │   ├── audit.rs         # Hash-chained audit entries
│   │       │   └── state_machine.rs # Feature lifecycle FSM
│   │       └── ports/
│   │           ├── storage.rs       # Storage port trait
│   │           ├── vcs.rs           # VCS port trait
│   │           ├── agent.rs         # Agent dispatch port trait
│   │           ├── review.rs        # Code review port trait
│   │           └── observability.rs # Telemetry port trait
│   │
│   ├── agileplus-cli/          # CLI adapter (clap) — 7 user-facing + sub-command registry
│   │   └── src/
│   │       ├── main.rs
│   │       └── commands/
│   │           ├── specify.rs
│   │           ├── research.rs
│   │           ├── plan.rs
│   │           ├── implement.rs
│   │           ├── validate.rs
│   │           ├── ship.rs
│   │           └── retrospective.rs
│   │
│   ├── agileplus-api/          # HTTP API adapter (axum)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── routes/
│   │       │   ├── features.rs
│   │       │   ├── work_packages.rs
│   │       │   ├── governance.rs
│   │       │   └── audit.rs
│   │       └── middleware/
│   │           ├── auth.rs
│   │           └── telemetry.rs
│   │
│   ├── agileplus-grpc/         # gRPC adapter (tonic) — serves core.proto, proxies agents + integrations
│   │   └── src/
│   │       ├── lib.rs
│   │       └── server.rs
│   │
│   ├── agileplus-sqlite/       # SQLite adapter (rusqlite)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── migrations/
│   │       ├── repository.rs
│   │       └── rebuild.rs
│   │
│   ├── agileplus-git/          # Git adapter (git2)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── worktree.rs
│   │       ├── repository.rs
│   │       └── artifact.rs
│   │
│   └── agileplus-telemetry/    # OpenTelemetry adapter
│       └── src/
│           ├── lib.rs
│           ├── traces.rs
│           ├── metrics.rs
│           └── logs.rs
│
├── proto/                      # Git submodule → agileplus-proto
├── Cargo.toml                  # Workspace (7 crates)
├── Makefile
└── docker-compose.yml

# ─── Repo 3: agileplus-mcp (Python MCP server) ───
agileplus-mcp/
├── src/agileplus_mcp/
│   ├── __init__.py
│   ├── server.py               # FastMCP 3.0 server entry
│   ├── tools/                  # MCP tool implementations
│   │   ├── features.py
│   │   ├── governance.py
│   │   └── status.py
│   ├── resources/              # MCP resources (specs, audit trails)
│   ├── prompts/                # MCP prompts (command templates)
│   ├── sampling/               # Server-initiated analysis (triage, retrospective)
│   ├── grpc_client.py          # gRPC client to core
│   └── telemetry.py
├── proto/                      # Git submodule → agileplus-proto
├── pyproject.toml
└── tests/
    ├── unit/
    ├── bdd/
    └── contract/

# ─── Repo 4: agileplus-agents (agent dispatch + review) ───
agileplus-agents/
├── crates/
│   ├── agileplus-agent-dispatch/  # Agent spawning, harnesses
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── claude_code.rs
│   │       ├── codex.rs
│   │       ├── dispatch.rs
│   │       └── pr_loop.rs
│   ├── agileplus-agent-review/    # Coderabbit + fallback review
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── coderabbit.rs
│   │       └── fallback.rs
│   └── agileplus-agent-service/   # gRPC server implementing agents.proto
│       └── src/
│           ├── lib.rs
│           └── server.rs
├── proto/                         # Git submodule → agileplus-proto
├── Cargo.toml                     # Workspace (3 crates)
└── Makefile

# ─── Repo 5: agileplus-integrations (sync + triage) ───
agileplus-integrations/
├── crates/
│   ├── agileplus-plane/           # Plane.so sync
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── sync.rs
│   │       └── client.rs
│   ├── agileplus-github/          # GitHub Issues sync
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── issues.rs
│   │       └── client.rs
│   ├── agileplus-triage/          # Triage classifier + backlog + router gen
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── classifier.rs
│   │       ├── backlog.rs
│   │       └── router.rs
│   └── agileplus-integrations-service/  # gRPC server implementing integrations.proto
│       └── src/
│           ├── lib.rs
│           └── server.rs
├── proto/                         # Git submodule → agileplus-proto
├── Cargo.toml                     # Workspace (4 crates)
└── Makefile

# ─── Cross-repo testing ───
tests/
├── bdd/
│   └── features/            # Cucumber/Behave .feature files
├── contract/
│   └── pacts/               # Pact contract files
├── integration/
│   └── docker-compose.test.yml  # Spins up all 4 services
└── fixtures/
```

**Structure Decision**: Multi-repo hexagonal architecture. 5 repositories: proto (shared contracts), core (Rust workspace with 7 crates), MCP (Python), agents (Rust workspace with 3 crates), integrations (Rust workspace with 4 crates). All cross-repo communication via gRPC. Proto repo consumed as git submodule by all service repos.

## Dependency Graph

### Intra-repo (agileplus-core)
```
agileplus-cli ──┐
agileplus-api ──┼──► agileplus-domain ◄── agileplus-grpc
                │         │
                │    ┌────┼────────┬─────────┐
                │    ▼    ▼        ▼         ▼
                │  sqlite  git   telemetry  (gRPC proxies to agents + integrations)
                │    │      │       │
                │    ▼      ▼       ▼
                │ rusqlite git2    OTel
                │
                └──► agileplus-telemetry (all core crates depend on this)
```

### Inter-repo (gRPC boundaries)
```
agileplus-cli ──► agileplus-core (in-process)
                      │
                      ├──► gRPC ──► agileplus-mcp (Python, implements MCP tools)
                      ├──► gRPC ──► agileplus-agents (Rust, agent dispatch + review)
                      └──► gRPC ──► agileplus-integrations (Rust, plane + github + triage)

All repos depend on agileplus-proto (git submodule) for shared message types.
```

## Key Design Decisions

### 1. State Machine (FR-033, FR-034)

Feature lifecycle as a strict FSM with optional bypass:

```
Created → Specified → Researched → Planned → Implementing → Validated → Shipped
    │          │            │                                              │
    └──────────┴────────────┴── (skip with warning if user prompt clear) ──┘
                                                                          │
                                                                    Retrospected (optional)
```

Each transition requires evidence per governance contract. Skip transitions log a governance exception in the audit trail.

### 2. Audit Chain (FR-016)

```rust
struct AuditEntry {
    id: u64,
    timestamp: DateTime<Utc>,
    actor: String,           // "user", "agent:claude-code", "system"
    transition: StateTransition,
    evidence: Vec<EvidenceRef>,
    prev_hash: [u8; 32],    // SHA-256 of previous entry
    hash: [u8; 32],         // SHA-256(id + timestamp + actor + transition + evidence + prev_hash)
}
```

### 3. Agent Dispatch (FR-004, FR-010-013)

```
implement WP01 →
  1. Create worktree: .worktrees/001-feature-WP01/
  2. Spawn 1-3 subagents via Claude Code/Codex CLI
     - Pass: WP goal, acceptance criteria, FR references, constitution rules
     - Agent context includes: spec.md, plan.md, data-model.md, contracts/
  3. Agent works → commits → creates PR
     - PR title: "WP01: [WP title]"
     - PR body: original goal/prompt + FR references
     - Commit messages: conventional commits referencing WP/FR
  4. Await Coderabbit review
  5. If review comments: agent reads, fixes, pushes, re-awaits
  6. If CI fails: agent reads logs, fixes, pushes, re-awaits
  7. PR green → record evidence → transition WP state → next WP
```

### 4. Conflict Resolution (FR-038, FR-039)

WPs declare their file scope in plan metadata. The scheduler:
1. Builds a file-overlap graph from WP declarations
2. WPs with no overlapping files → parallel worktrees
3. WPs with overlapping files → serialized (dependency edge added)
4. At `ship` time, merge conflicts detected and surfaced with diff context

### 5. SQLite Schema (High-Level)

```sql
-- Core tables
features (id, slug, state, spec_hash, created_at, updated_at)
work_packages (id, feature_id, title, state, deps, file_scope, pr_url, agent_id)
governance_contracts (id, feature_id, version, rules_json, bound_at)
audit_log (id, feature_id, timestamp, actor, transition, evidence_json, prev_hash, hash)
evidence (id, wp_id, fr_id, type, artifact_path, created_at)
policy_rules (id, domain, rule_json, active)

-- Observability
metrics (id, command, duration_ms, agent_runs, review_cycles, timestamp)
```

### 6. Credential Management (FR-030-032)

```
~/.agileplus/
├── config.toml          # Core config
├── credentials.enc      # Encrypted integration keys (GitHub, Coderabbit, Plane.so)
└── otel-config.yaml     # OpenTelemetry export config
```

Keys encrypted at rest using OS keychain (macOS Keychain, Linux secret-service). AgilePlus never touches `~/.claude/`, `~/.codex/`, or agent harness configs.

### 7. Agent Prompt Router Architecture (FR-046, FR-047, FR-048, FR-052)

```
User Request
    │
    ▼
┌──────────────────┐
│ CLAUDE.md Router │ ← Generated by AgilePlus per-project
│ (First-action    │
│  classifier)     │
└──────┬───────────┘
       │ classifies intent
       ▼
┌──────────────────┐    ┌─────────────────────────────┐
│ 7 User Commands  │    │ ~25 Hidden Sub-Commands       │
│ specify           │    │ triage:classify              │
│ research          │    │ triage:file-bug              │
│ plan              │    │ triage:queue-idea            │
│ implement         │    │ governance:check-gates       │
│ validate          │    │ governance:evaluate-policy   │
│ ship              │    │ governance:verify-chain      │
│ retrospective     │    │ sync:push-plane              │
│                   │    │ sync:push-github             │
│                   │    │ sync:pull-status             │
│                   │    │ git:create-worktree          │
│                   │    │ git:branch-from-wp           │
│                   │    │ git:merge-and-cleanup        │
│                   │    │ devops:lint-and-format       │
│                   │    │ devops:run-ci-checks         │
│                   │    │ devops:conventional-commit   │
│                   │    │ context:load-spec            │
│                   │    │ context:load-plan            │
│                   │    │ context:load-constitution    │
│                   │    │ context:scan-codebase        │
│                   │    │ escape:quick-fix             │
│                   │    │ escape:hotfix                │
│                   │    │ escape:skip-with-warning     │
│                   │    │ meta:generate-router         │
│                   │    │ meta:update-agents-md        │
└──────────────────┘    └─────────────────────────────┘
       │                          │
       └──────────┬───────────────┘
                  ▼
        ┌─────────────────┐
        │ MCP Server      │ ← FastMCP 3.0 (Python)
        │ Tools/Resources │
        │ Prompts/Sampling│
        │ Roots/Elicitation│
        └────────┬────────┘
                 │ gRPC
                 ▼
        ┌─────────────────┐
        │ Rust Core       │
        │ Domain + Adapters│
        └─────────────────┘
```

Sub-commands are seeded from a hybridized superset of reference framework commands (spec-kitty, bmad, gsd, openspec), then pruned and adapted to AgilePlus's architecture. Agents invoke them via Claude Code's SlashCommand tool. Each invocation is audit-logged.

### 8. Sync Architecture (FR-043, FR-044, FR-045)

```
SQLite (source of truth)
    │
    ├──► Plane.so (features/WPs → work items, kanban status)
    │    - Create/update on state change
    │    - Conflict detection on Plane.so-side edits
    │
    ├──► GitHub Issues (bugs → issues with labels/metadata)
    │    - Auto-create from triage
    │    - Cross-reference feature/WP in issue body
    │
    └──► Git (artifacts → committed files)
         - Already existing flow
```

Sync adapters live in the `agileplus-integrations` repository: `agileplus-plane` and `agileplus-github` crates.

### 10. PR Merge Policy (Constitution)

Per project constitution: Coderabbit auto-review is the review gate. No human approval required — self-merge allowed after CI passes. Agents create PRs, Coderabbit reviews, agent fixes, CI goes green, merge proceeds automatically.

### 9. MCP Primitives Mapping (FR-049, FR-050)

| MCP Primitive | AgilePlus Mapping |
|---------------|-------------------|
| Tools | CRUD operations: create_feature, update_wp_status, check_governance, dispatch_command |
| Resources | Read-only access: specs, plans, audit trails, governance contracts |
| Prompts | Slash command templates: parameterized prompts for specify, implement, etc. |
| Sampling | Server-initiated analysis: auto-triage, governance pre-check, retrospective generation |
| Roots | Workspace boundaries: feature dirs, worktree paths, config dirs |
| Elicitation | Discovery interviews: specify clarifications, plan interrogation, constitution phases |

FastMCP 3.0 features used:
- **Background tasks** (Docket+SQLite): Long-running sync jobs, agent dispatch monitoring
- **Component versioning**: MCP tools versioned independently, backward-compatible evolution
- **Per-component auth**: Different access levels for CLI vs external agents vs web UI
- **Resources-as-Tools / Prompts-as-Tools**: Automatic transforms for flexible consumption
- **Native OTel**: Traces from MCP layer feed into same OTel pipeline as Rust core

## Complexity Tracking

No constitution violations to track (constitution absent).

| Decision | Justification | Simpler Alternative Rejected |
|----------|--------------|------------------------------|
| 5 repositories (14 total crates) | Clean boundaries at repo level; prevents scope creep; independent versioning/deployment | Monorepo — scope creep, coupled releases, single CI pipeline bottleneck |
| gRPC for inter-repo IPC | Typed contracts, streaming, polyglot, enforces service boundaries | JSON-RPC — no streaming, no codegen, weaker type safety at boundaries |
| Shared proto repo | Single source of truth for all contracts; buf linting + breaking change detection | Duplicated proto files — drift, inconsistency, manual sync |
| Separate Python process | FastMCP is Python-only | FFI/PyO3 embedding — fragile, complicates deployment, debugging |
