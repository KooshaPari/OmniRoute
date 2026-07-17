# Architecture Decision Records — Agent Wave

## ADR-001: Governance-First Repository Setup

**Status**: Accepted
**Date**: 2026-03-27

**Context**: The project needs CI pipelines, pre-commit hooks, YAML linting, security scanning, and policy-gate integration established before any application code is written. Without these in place first, early contributions will likely diverge from Phenotype standards.

**Decision**: Establish all governance scaffolding (AGENTS.md, CLAUDE.md, CONTRIBUTING.md, `.pre-commit-config.yaml`, `.yamllint`, workflow files, and shell scripts) before writing any application source code.

**Rationale**:
- Governance-first ensures quality gates are in place for every subsequent contribution, including the initial implementation.
- `phenotypeActions` reusable workflows (`policy-gate`, `security-guard`, `quality-gate`) are referenced immediately rather than added after the fact.
- Local shell equivalents (`scripts/*.sh`) mean governance checks are runnable without CI access.

**Consequences**:
- Application code starts with a compliant environment; no "we'll add tests/lint later" debt.
- Contributors must have `pre-commit` installed before first commit.

---

## ADR-002: TypeScript/Bun as Implementation Stack

**Status**: Accepted
**Date**: 2026-03-27

**Context**: The orchestration engine needs to: dispatch HTTP/WebSocket calls to AgentAPI++ and MCP servers, manage concurrent async task queues, serialize/deserialize typed protocol messages, and integrate with the Node/Bun ecosystem where Phenotype tooling (phenotypeActions, codex-cli shell-tool-mcp) already lives.

**Decision**: Implement Agent Wave in TypeScript using Bun as the runtime. `bun.lock` is committed as the lockfile.

**Rationale**:
- TypeScript provides static types for protocol messages, wave manifests, and lifecycle events without a separate schema compilation step.
- Bun's built-in bundler, test runner, and package manager eliminate multiple toolchain dependencies.
- The Phenotype ecosystem already has TypeScript-first patterns (codex-cli, shell-tool-mcp, AgentAPI++ client SDKs); reusing the same stack reduces context-switching.
- Bun's async I/O performance is adequate for hundreds of concurrent agent-task dispatches.

**Alternatives Considered**:
- Python: production-grade Python orchestration frameworks (LangGraph, AutoGen) exist but are Python-only and do not fit the Phenotype TypeScript-first ecosystem.
- Rust: highest performance but significantly higher barrier to contribution for this type of IO-bound orchestration work.
- Go: good async primitives but no existing Phenotype tooling in Go for this layer.

**Consequences**:
- All application code targets the Bun runtime; Node.js compatibility is maintained for consuming `shell-tool-mcp` and other packages.
- TypeScript strict mode is required. Oxlint enforces code quality.
- Bun version is pinned in `.mise.toml` or a toolchain config file.

---

## ADR-003: Wave-Based Execution Model

**Status**: Proposed
**Date**: 2026-03-27

**Context**: Existing agent orchestration frameworks (LangGraph, AutoGen, CrewAI, Swarm) use DAG, conversation, role-based, or handoff execution models. None natively model the concept of a "wave" where a batch of agents work simultaneously and results are aggregated before the next batch begins. The Phenotype use case (multi-agent review orchestration in phenotypeActions) is already wave-shaped.

**Decision**: The primary execution primitive is the "wave": a named set of tasks that execute concurrently, followed by aggregation, followed by the next wave. Sequential task dependencies within a wave are expressed via `depends_on`; cross-wave dependencies are expressed via wave ordering and result bindings.

**Rationale**:
- Wave semantics map naturally to the AI review orchestration already done by `phenotypeActions/review-wave-orchestrator`: trigger wave 1 bots (CodeRabbit, Gemini), wait, trigger wave 2 bots (Augment, Codex).
- The model is simpler to reason about than a full DAG (which requires cycle detection, topological sort) for the common case where batch-then-aggregate is the pattern.
- Wave result aggregation provides a natural checkpoint for policy evaluation and state persistence between phases of a workflow.

**Alternatives Considered**:
- Full DAG: more expressive but higher implementation complexity; overkill for batch-oriented agent workflows.
- Single sequential queue: simple but eliminates the parallelism benefit that motivates the multi-agent approach.
- Conversation model (AutoGen-style): appropriate for interactive agent-to-agent workflows, not batch processing.

**Consequences**:
- Wave manifests must define clear entry and exit points for each wave.
- The engine needs a result-binding mechanism to pass wave N outputs as wave N+1 inputs.
- Complex workflows requiring per-task dynamic routing after results are collected may need multiple wave definitions.

---

## ADR-004: API-First Contract Design

**Status**: Proposed
**Date**: 2026-03-27

**Context**: Agent Wave will be consumed by other Phenotype services (heliosCLI harness, agentops-policy-federation, thegent). These consumers need stable API contracts they can code against before the implementation is complete.

**Decision**: Define all public API surfaces as TypeScript types and JSON schemas before implementing the runtime. Wave manifest schema, result object schema, lifecycle event schema, and the orchestrator API are defined first. Implementation is built against these contracts.

**Rationale**:
- Parallel implementation becomes possible: consumers can write integration code against the schema while the engine is being built.
- Schema-first enables automatic validation (via JSON schema) at runtime entry points.
- Breaking API changes require explicit schema version bumps, making backward compatibility visible.

**Consequences**:
- Schema files live in `src/schemas/` and are versioned independently from the runtime.
- TypeScript types are generated from or kept in sync with JSON schemas via a build step.
- Any change to a public schema triggers a review against consumer compatibility.

---

## ADR-005: Policy Federation as a Mandatory Pre-Dispatch Gate

**Status**: Proposed
**Date**: 2026-03-27

**Context**: Agent Wave dispatches AI agent tasks that may incur cost, access external services, write to filesystems, or execute code. Without a governance gate, any caller can dispatch arbitrary agent workloads.

**Decision**: Policy evaluation via agentops-policy-federation is a mandatory synchronous gate before every wave dispatch. The engine SHALL NOT dispatch tasks if the policy endpoint is unreachable; the wave SHALL be rejected with a clear error.

**Rationale**:
- Mandatory (not optional) enforcement means governance cannot be bypassed by misconfiguration or code paths that skip the check.
- Synchronous evaluation ensures the policy decision is fresh at dispatch time, not cached from a prior request.
- Hard failure on unreachable policy endpoint (rather than fail-open) prevents governance bypass due to network partition.

**Alternatives Considered**:
- Optional policy gate: easier to bootstrap but creates a bypass path.
- Async policy evaluation: allows dispatch to start before the decision arrives, creating a race condition.
- Cached decisions: reduces latency but introduces staleness risk for time-sensitive policy changes.

**Consequences**:
- The policy federation service must be available for Agent Wave to operate. Development environments need a local policy federation stub.
- Wave dispatch latency includes the policy evaluation round-trip (target: < 100ms).
- Policy evaluation timeout (default: 5 seconds) is a hard limit; callers should set expectations accordingly.

---

## ADR-006: Append-Only Audit Log with Webhook Forwarding

**Status**: Proposed
**Date**: 2026-03-27

**Context**: Compliance and security review require a record of every wave dispatch decision: who requested it, what policy decision was made, what conditions were applied, and when.

**Decision**: Every wave dispatch decision (allowed, denied, conditions-applied) writes an event to an append-only JSONL file at `$AGENT_WAVE_HOME/audit/audit.jsonl`. When a webhook URL is configured, events are also forwarded via HTTP POST. Audit log writes are synchronous; webhook calls are best-effort (failures are logged but do not block dispatch).

**Rationale**:
- Append-only local file provides a durable audit trail that survives process restarts and webhook outages.
- JSONL format is machine-readable for downstream tooling (grep, jq, log aggregators).
- Separating local write (synchronous, required) from webhook (async, best-effort) prevents external service availability from affecting the critical path.

**Consequences**:
- `$AGENT_WAVE_HOME` directory must be writable; the engine fails at startup if it is not.
- Log rotation and retention are the operator's responsibility; the engine does not prune the audit log.
- Webhook payload schema must be versioned; breaking changes require consumer coordination.
