# Product Requirements Document — Agent Wave

## Overview

Agent Wave is a TypeScript/Bun orchestration engine for coordinating waves of AI agents working together on complex tasks within the Phenotype ecosystem. It occupies the orchestration layer between consumers and individual AI CLI agents (Claude, Codex, etc.), providing wave-based parallel task dispatch, agent lifecycle management, policy federation, and AgentAPI++ integration. The repository is currently in the governance-scaffolding phase; all E2–E5 epics are planned for initial implementation.

```
Ecosystem Position:

  Consumer / Workflow
         |
         v
  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
  │  Agent Wave  │────▶│  AgentAPI++  │────▶│  CLI Agents  │
  │ Orchestrator │     │  (Control)   │     │ Claude/Codex │
  └─────────────┘     └──────────────┘     └──────────────┘
         │
         v
  ┌──────────────────┐
  │ agentops-policy- │
  │   federation     │
  └──────────────────┘
```

---

## E1: Repository Governance (Complete)

### E1.1: CI and Pre-Commit Quality Gates

As a contributor, I want automated quality gates in CI and as pre-commit hooks so that all contributions meet baseline quality standards before merge.

**Acceptance Criteria**:
- `.pre-commit-config.yaml` installs hooks for YAML linting and trailing-whitespace removal.
- `.yamllint` configuration enforces consistent YAML style across all workflow and config files.
- `scripts/quality-gate.sh` runs lint, security scanning, and format checks; exits non-zero on any failure.
- `scripts/security-guard.sh` runs pre-commit security scanning equivalent to the `security-guard.yml` workflow.
- `scripts/policy-gate.sh` enforces PR namespace ownership and merge-commit policies equivalent to `phenotypeActions/policy-gate`.
- CI workflows: `quality-gate.yml`, `security-guard.yml`, `policy-gate.yml`, `self-merge-gate.yml`, `release-drafter.yml`, `tag-automation.yml`.

### E1.2: Self-Merge Gate

As an automation actor, I want bot-authored PRs to this repo to pass the same policy checks as human PRs so that governance is not bypassed by automation.

**Acceptance Criteria**:
- `self-merge-gate.yml` applies `policy-gate.sh` before allowing auto-merge on bot PRs.
- Any PR that fails policy checks is blocked from merging regardless of author.

---

## E2: Wave Execution Engine (Planned)

### E2.1: Wave Definition Format

As a workflow author, I want to define agent task waves in a structured manifest so that the engine knows which tasks run in parallel and which depend on prior results.

**Acceptance Criteria**:
- Wave manifests define named tasks, each with: agent type, prompt template, inputs, success criteria, timeout.
- Tasks within a wave without declared inter-dependencies execute in parallel.
- Tasks across waves execute sequentially; wave N+1 starts only after all tasks in wave N complete (or a configurable threshold pass).
- Manifests are validated against a JSON schema on load; invalid manifests fail fast with a descriptive error.

### E2.2: Parallel Task Dispatch Within a Wave

As an operator, I want tasks within a wave to run concurrently so that multi-agent workloads complete faster.

**Acceptance Criteria**:
- The engine dispatches all independent tasks in a wave simultaneously up to a configurable concurrency limit.
- Concurrency limits are enforced per agent type to prevent rate-limit violations.
- Each dispatched task runs in an isolated context; a task failure does not kill sibling tasks.

### E2.3: Wave Result Aggregation

As a workflow author, I want wave results aggregated into a structured summary so that downstream waves and consumers receive normalized outputs.

**Acceptance Criteria**:
- After wave completion, the engine produces a wave result object: per-task status (success/failed/timeout), outputs, durations, and error messages.
- Aggregated wave results are passed as inputs to subsequent wave tasks when referenced in the manifest.
- The result object is serializable to JSON for logging and storage.

### E2.4: Failure Handling and Wave Abort Policy

As an operator, I want configurable failure handling so that a single task failure does not always abort an entire wave.

**Acceptance Criteria**:
- Wave manifests declare a `failure_policy`: `fail_fast` (abort wave on first failure), `continue` (collect all results regardless of failures), or `threshold` (abort if more than N tasks fail).
- Failed tasks include structured error output: task ID, error type, message, and stack trace.
- On wave abort, the engine emits a structured abort event with the triggering task ID.

---

## E3: Agent Lifecycle Management (Planned)

### E3.1: Health Monitoring

As an operator, I want each managed agent to expose a health state so that the orchestrator can detect and recover from agent failures.

**Acceptance Criteria**:
- Every agent wrapper exposes a `health()` method returning: `healthy`, `degraded`, or `unhealthy` with a reason string.
- The orchestrator polls agent health at a configurable interval (default: 30 seconds).
- Unhealthy agents are removed from the active pool; a replacement agent is started if the pool size falls below the minimum.

### E3.2: Graceful Shutdown

As an operator, I want agents to shut down cleanly on `SIGTERM`/`SIGINT` so that in-flight tasks complete or are checkpointed before process exit.

**Acceptance Criteria**:
- On `SIGTERM`/`SIGINT`, the orchestrator stops accepting new tasks and waits for in-flight tasks to complete up to a configurable drain timeout (default: 60 seconds).
- Tasks that do not complete within the drain timeout are checkpointed and their state written to disk.
- Exit code 0 if all tasks drained cleanly; non-zero if tasks were abandoned.

### E3.3: Structured Lifecycle Logging

As a developer, I want all agent lifecycle events emitted as structured log entries so that I can trace agent behavior in observability tooling.

**Acceptance Criteria**:
- Log entries for: agent start, health state change, task assignment, task complete, task failed, graceful shutdown start, graceful shutdown complete.
- All log entries include: timestamp (ISO 8601), agent ID, event type, task ID (if applicable), and a message.
- Log output format is newline-delimited JSON.

---

## E4: AgentAPI++ and MCP Integration (Planned)

### E4.1: AgentAPI++ Control Plane Integration

As an operator, I want Agent Wave to submit tasks and receive results through AgentAPI++ so that agent routing, authentication, and quota management are handled centrally.

**Acceptance Criteria**:
- The engine uses the AgentAPI++ client to dispatch tasks to named agent backends.
- Task submission includes: agent type, model, prompt, resource limits, and a wave-scoped correlation ID.
- Results are received via AgentAPI++ callback or polling, not direct agent stdout capture.

### E4.2: MCP Tool Invocation

As a workflow author, I want wave tasks to invoke MCP tools during execution so that agents can call external capabilities (shell execution, file search, etc.) through the standard MCP protocol.

**Acceptance Criteria**:
- Task manifests can reference MCP tool names; the engine resolves the tool endpoint from the configured MCP server registry.
- Tool invocation results are included in the task output object.
- MCP errors (tool not found, timeout, invalid schema) fail the task with a descriptive error.

---

## E5: Policy Federation Integration (Planned)

### E5.1: Governance Policy Evaluation Before Wave Dispatch

As a security engineer, I want every wave dispatch validated against the agentops-policy-federation rules so that agent actions are always within approved policy.

**Acceptance Criteria**:
- Before dispatching a wave, the engine queries the policy federation endpoint with the wave manifest and the requesting identity.
- Policy evaluation returns: `allow`, `deny`, or `allow_with_conditions`.
- On `deny`, the wave is rejected with the policy violation reason; no tasks are dispatched.
- On `allow_with_conditions`, the engine applies the returned condition constraints (e.g., reduced concurrency, restricted tool access) before dispatch.

### E5.2: Audit Trail

As a compliance officer, I want a tamper-evident audit trail of all wave dispatch decisions so that governance actions are reviewable.

**Acceptance Criteria**:
- Every wave dispatch (allowed or denied) writes a signed audit event: wave ID, policy decision, conditions applied, requesting identity, and timestamp.
- Audit events are written to an append-only log file and optionally emitted to a configured webhook.
