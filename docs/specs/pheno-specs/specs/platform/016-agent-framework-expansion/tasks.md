# Work Packages: Agent Framework Expansion — Complete Across 6 Repositories

**Inputs**: Design documents from `kitty-specs/016-agent-framework-expansion/`
**Prerequisites**: spec.md, Rust toolchain, MCP protocol knowledge
**Scope**: Cross-repo (6 repositories): Agentora, AgentMCP, agent-wave, agentops-policy-federation, helMo, agent-devops-setups

---

## WP-001: Agentora — Complete Agent Orchestration Framework

- **State:** planned
- **Sequence:** 1
- **File Scope:** Agentora repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Multi-agent coordination with leader-follower and peer-to-peer patterns
  - Agent task decomposition and assignment engine
  - Unified agent lifecycle management across all orchestrated agents
  - Integration hooks for MCP protocol (AgentMCP), event communication (agent-wave), and policy (agentops-policy-federation)
  - ≥80% test coverage on orchestration core
  - All quality checks passing
- **Estimated Effort:** L

Complete Agentora as the central agent orchestration framework. Agentora coordinates multiple agents, decomposes tasks, assigns work, and manages the unified agent lifecycle. This is the backbone that all other agent framework components integrate with.

### Subtasks
- [ ] T001 Audit current Agentora state: existing orchestration code, gaps, dependencies
- [ ] T002 Design multi-agent coordination architecture: leader-follower, peer-to-peer, broadcast
- [ ] T003 Implement AgentOrchestrator: create, manage, and coordinate agent groups
- [ ] T004 Implement task decomposition engine: break complex tasks into subtasks, assign to agents
- [ ] T005 Implement agent coordination patterns: leader election, task distribution, result aggregation
- [ ] T006 Implement unified agent lifecycle: initialize, start, monitor, stop, cleanup
- [ ] T007 Define integration interfaces for MCP, event communication, policy, and mobility
- [ ] T008 Implement health monitoring: agent heartbeat, failure detection, recovery
- [ ] T009 Write unit tests for orchestration core (target: ≥80% coverage)
- [ ] T010 Write integration tests: multi-agent task execution with mock agents
- [ ] T011 Add comprehensive rustdoc with orchestration examples
- [ ] T012 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Orchestration complexity: Start with leader-follower pattern, add peer-to-peer incrementally
- Agent failure handling: Implement retry with checkpoint, graceful degradation

---

## WP-002: AgentMCP — Implement MCP Protocol Server

- **State:** planned
- **Sequence:** 2
- **File Scope:** AgentMCP repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete MCP protocol server implementation (tools, resources, prompts, sampling)
  - Integrated with Agentora orchestration layer (agents exposed as MCP tools)
  - MCP tool definitions auto-generated from agent capabilities
  - MCP resource serving for agent state and results
  - ≥80% test coverage on MCP server
  - All quality checks passing
- **Estimated Effort:** M

Implement the Model Context Protocol (MCP) server in AgentMCP and integrate it with Agentora's orchestration layer. This exposes agent capabilities as MCP tools, enabling external MCP clients to interact with the agent framework.

### Subtasks
- [ ] T013 Audit current AgentMCP state: existing MCP implementation, protocol coverage
- [ ] T014 Complete MCP tool server: register tools, handle tool calls, return results
- [ ] T015 Implement MCP resource server: serve agent state, results, and metadata
- [ ] T016 Implement MCP prompt server: provide structured prompts for agent interactions
- [ ] T017 Implement MCP sampling: server-initiated analysis requests
- [ ] T018 Integrate with Agentora: expose orchestrated agents as MCP tools
- [ ] T019 Implement MCP tool auto-generation from agent capability definitions
- [ ] T020 Write unit tests for MCP protocol handlers (target: ≥80% coverage)
- [ ] T021 Write integration tests: MCP client calling agent tools via AgentMCP
- [ ] T022 Add rustdoc with MCP server setup and tool definition examples
- [ ] T023 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (Agentora orchestration layer available for integration)

### Risks & Mitigations
- MCP spec compliance: Reference official MCP specification, test against MCP conformance
- Protocol versioning: Support MCP version negotiation, document supported versions

---

## WP-003: agent-wave — Event-Driven Agent Communication

- **State:** planned
- **Sequence:** 3
- **File Scope:** agent-wave repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Event-driven communication integrated with agent lifecycle
  - Event routing and filtering by type, source, and priority
  - Publish/subscribe pattern for agent-to-agent messaging
  - Event persistence and replay for debugging
  - Integration with Agentora for lifecycle-aware event delivery
  - ≥80% test coverage on event system
  - All quality checks passing
- **Estimated Effort:** M

Complete agent-wave as the event-driven communication layer for agent-to-agent messaging. Events are integrated with the agent lifecycle, ensuring proper delivery, routing, and filtering. This enables asynchronous coordination between agents.

### Subtasks
- [ ] T024 Audit current agent-wave state: existing event system, routing, gaps
- [ ] T025 Design event schema: event types, payloads, metadata (source, timestamp, priority)
- [ ] T026 Implement event bus: publish, subscribe, unsubscribe with topic-based routing
- [ ] T027 Implement event filtering: by type, source agent, priority, custom predicates
- [ ] T028 Integrate with Agentora lifecycle: deliver events only to running agents, queue for starting
- [ ] T029 Implement event persistence: store events for replay, debugging, and audit
- [ ] T030 Implement event replay: replay events from history for debugging and testing
- [ ] T031 Write unit tests for event bus and routing (target: ≥80% coverage)
- [ ] T032 Write integration tests: multi-agent event communication via agent-wave
- [ ] T033 Add rustdoc with event system setup and usage examples
- [ ] T034 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (Agentora lifecycle available for event delivery integration)

### Risks & Mitigations
- Event ordering: Implement causal ordering for related events, document ordering guarantees
- Event volume: Implement rate limiting, backpressure, and event deduplication

---

## WP-004: agentops-policy-federation — Policy Distribution Across Agents

- **State:** planned
- **Sequence:** 4
- **File Scope:** agentops-policy-federation repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Policy distribution integrated with Agentora orchestration
  - Policy enforcement at agent level (per-agent policy evaluation)
  - Policy distribution across agent groups with versioning
  - Policy conflict detection and resolution
  - ≥80% test coverage on policy system
  - All quality checks passing
- **Estimated Effort:** M

Complete agentops-policy-federation for policy distribution and enforcement across agents. Policies are distributed to agent groups, enforced at the agent level, and versioned for consistency. This ensures agents operate within defined constraints.

### Subtasks
- [ ] T035 Audit current agentops-policy-federation: existing policy code, distribution mechanism
- [ ] T036 Design policy schema: policy rules, scopes, priorities, versioning
- [ ] T037 Implement policy distribution: push policies to agent groups, version tracking
- [ ] T038 Implement policy enforcement: evaluate policies before agent actions
- [ ] T039 Integrate with Agentora: attach policies to agent groups, enforce during orchestration
- [ ] T040 Implement policy conflict detection: detect conflicting rules, resolution strategies
- [ ] T041 Implement policy audit: log policy evaluations, violations, and overrides
- [ ] T042 Write unit tests for policy distribution and enforcement (target: ≥80%)
- [ ] T043 Write integration tests: policy enforcement across multi-agent scenarios
- [ ] T044 Add rustdoc with policy definition and distribution examples
- [ ] T045 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (Agentora orchestration available for policy attachment)

### Risks & Mitigations
- Policy enforcement performance: Cache policy evaluations, optimize hot paths
- Policy conflicts: Implement clear resolution strategy (priority-based, deny-overrides)

---

## WP-005: helMo — Agent Mobility and Communication

- **State:** planned
- **Sequence:** 5
- **File Scope:** helMo repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Agent mobility implementation: migrate agent state between hosts
  - Integrated with Agentora orchestration (mobility as orchestration action)
  - State serialization and deserialization for agent migration
  - Communication between mobile agents and stationary agents
  - Rollback mechanisms for failed migrations
  - ≥80% test coverage on mobility core
  - All quality checks passing
- **Estimated Effort:** M

Complete helMo for agent mobility — the ability to migrate agent state between hosts. This enables load balancing, fault tolerance, and dynamic resource allocation. helMo integrates with Agentora for orchestration-aware mobility.

### Subtasks
- [ ] T046 Audit current helMo state: existing mobility prototype, serialization approach
- [ ] T047 Design agent state serialization format: what to serialize, what to reconstruct
- [ ] T048 Implement state serialization: capture agent context, memory, and execution state
- [ ] T049 Implement state deserialization: reconstruct agent on target host
- [ ] T050 Implement agent migration: coordinate source and target hosts, transfer state
- [ ] T051 Integrate with Agentora: mobility as orchestration action, lifecycle-aware migration
- [ ] T052 Implement rollback: revert migration on failure, restore original agent state
- [ ] T053 Implement mobile-stationary agent communication: messaging across migration boundaries
- [ ] T054 Write unit tests for serialization and migration (target: ≥80% coverage)
- [ ] T055 Write integration tests: agent migration between mock hosts
- [ ] T056 Add rustdoc with mobility setup and migration examples
- [ ] T057 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (Agentora orchestration for mobility actions)

### Risks & Mitigations
- State serialization completeness: Thorough testing of agent state capture, document limitations
- Migration failures: Implement checkpoint-based rollback, test failure scenarios extensively

---

## WP-006: agent-devops-setups — CI/CD Templates for Agent Projects

- **State:** planned
- **Sequence:** 6
- **File Scope:** agent-devops-setups repository (templates/, docs/)
- **Acceptance Criteria:**
  - CI/CD templates for agent projects (GitHub Actions, GitLab CI)
  - Templates integrate with Agentora, AgentMCP, agent-wave, and policy-federation
  - Deployment templates for agent orchestration clusters
  - Monitoring and alerting templates for agent health
  - Documentation for all templates with usage examples
  - All templates validated (lint, dry-run)
- **Estimated Effort:** S

Complete agent-devops-setups with CI/CD templates for deploying and managing agent projects. Templates cover GitHub Actions, GitLab CI, deployment configurations, and monitoring setups for the full agent framework.

### Subtasks
- [ ] T058 Audit current agent-devops-setups: existing templates, gaps
- [ ] T059 Create GitHub Actions template for agent project CI (build, test, lint)
- [ ] T060 Create GitHub Actions template for agent deployment (orchestration cluster)
- [ ] T061 Create GitLab CI template mirroring GitHub Actions functionality
- [ ] T062 Create deployment template: Docker Compose for agent orchestration cluster
- [ ] T063 Create monitoring template: Prometheus + Grafana dashboards for agent health
- [ ] T064 Create alerting template: alert rules for agent failures, policy violations
- [ ] T065 Validate all templates: lint, dry-run, verify syntax
- [ ] T066 Document all templates with setup instructions and customization guide
- [ ] T067 Create example agent project using all templates end-to-end

### Dependencies
- WP-001 through WP-005 (agent framework components available for template integration)

### Risks & Mitigations
- Template drift: Pin dependency versions in templates, document update process
- Platform compatibility: Test templates on both GitHub Actions and GitLab CI

---

## Dependency & Execution Summary

```
WP-001 (Agentora orchestration) ─────── first, no deps
WP-002 (AgentMCP protocol) ──────────── depends on WP-001
WP-003 (agent-wave events) ──────────── depends on WP-001 (parallel with WP-002)
WP-004 (agentops-policy-federation) ─── depends on WP-001 (parallel with WP-002, WP-003)
WP-005 (helMo mobility) ─────────────── depends on WP-001 (parallel with WP-002, WP-003, WP-004)
WP-006 (agent-devops-setups) ────────── depends on WP-001 through WP-005
```

**Parallelization**: WP-002 through WP-005 can run in parallel after WP-001. WP-006 is the final integration step.

**MVP Scope**: WP-001 alone provides agent orchestration. WP-002 adds MCP protocol support for external integration.
