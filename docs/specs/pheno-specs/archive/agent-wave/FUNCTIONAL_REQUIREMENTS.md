# Functional Requirements — Agent Wave

## FR-GOV: Governance (Implemented)

### FR-GOV-001: Pre-Commit YAML Lint
The repository SHALL enforce YAML linting via pre-commit hooks configured in `.pre-commit-config.yaml`. All YAML files SHALL pass `yamllint` with the project's `.yamllint` configuration.
Traces to: E1.1

### FR-GOV-002: Agent Instruction Files
The repository SHALL maintain `AGENTS.md` and `CLAUDE.md` at the root level providing agent governance instructions.
Traces to: E1.1

### FR-GOV-003: Quality Gate Script
`scripts/quality-gate.sh` SHALL run lint and security checks and exit non-zero on any failure. It SHALL be invoked by `quality-gate.yml` on every PR.
Traces to: E1.1

### FR-GOV-004: Security Guard Script
`scripts/security-guard.sh` SHALL run pre-commit security scanning equivalent to the CI `security-guard.yml` workflow and exit non-zero on violations.
Traces to: E1.1

### FR-GOV-005: Policy Gate Script
`scripts/policy-gate.sh` SHALL enforce namespace ownership and merge-commit policies, reporting violations to stdout and exiting non-zero on failure.
Traces to: E1.1

### FR-GOV-006: Self-Merge Gate
`self-merge-gate.yml` SHALL invoke `policy-gate.sh` before permitting auto-merge on bot-authored PRs.
Traces to: E1.2

---

## FR-WAVE: Wave Execution Engine (Planned)

### FR-WAVE-001: Wave Manifest Schema Validation
The engine SHALL validate wave manifests against a published JSON schema on load. Manifests with missing required fields or invalid types SHALL fail with a structured error listing each violation.
Traces to: E2.1

### FR-WAVE-002: Task Dependency Declaration
Wave manifests SHALL support optional `depends_on: [task_id, ...]` declarations per task. Tasks without declared dependencies within a wave SHALL be eligible for parallel dispatch.
Traces to: E2.1

### FR-WAVE-003: Sequential Wave Ordering
The engine SHALL start wave N+1 only after wave N reaches completion or the configured `wave_pass_threshold` (default: all tasks pass). Wave ordering SHALL be deterministic and logged.
Traces to: E2.1

### FR-WAVE-004: Parallel Dispatch Within Wave
The engine SHALL dispatch all dependency-free tasks within a wave simultaneously, up to the `max_concurrency` limit (default: 10). Dispatched tasks SHALL run in independent execution contexts.
Traces to: E2.2

### FR-WAVE-005: Per-Agent-Type Concurrency Limit
The engine SHALL enforce a per-agent-type concurrency limit configurable in the wave manifest or global config. Queued tasks SHALL be dispatched as capacity is freed.
Traces to: E2.2

### FR-WAVE-006: Task Isolation
A failed, timed-out, or panicked task SHALL NOT affect sibling tasks in the same wave. Each task's error SHALL be captured and included in the wave result.
Traces to: E2.2

### FR-WAVE-007: Wave Result Aggregation
After wave completion, the engine SHALL produce a wave result object containing: per-task status (success/failed/timeout), output data, duration_ms, and error detail if applicable.
Traces to: E2.3

### FR-WAVE-008: Wave Result as Downstream Input
The engine SHALL make wave N's aggregated result available as a named input binding for tasks in wave N+1, referenced by task ID in the manifest.
Traces to: E2.3

### FR-WAVE-009: Wave Result JSON Serialization
Wave result objects SHALL be serializable to JSON. The engine SHALL write results to a configured output path after wave completion.
Traces to: E2.3

### FR-WAVE-010: Fail-Fast Policy
When `failure_policy: fail_fast` is set and a task fails, the engine SHALL abort the wave immediately, cancel in-flight tasks, and emit a wave-abort event with the triggering task ID.
Traces to: E2.4

### FR-WAVE-011: Continue Policy
When `failure_policy: continue` is set, the engine SHALL complete all tasks regardless of individual failures and include all results in the wave result object.
Traces to: E2.4

### FR-WAVE-012: Threshold Policy
When `failure_policy: threshold` and `failure_threshold: N` are set, the engine SHALL abort the wave when more than N tasks have failed.
Traces to: E2.4

### FR-WAVE-013: Structured Abort Event
On wave abort, the engine SHALL emit a structured event: wave ID, abort reason, triggering task ID, count of completed tasks, count of cancelled tasks, and timestamp.
Traces to: E2.4

---

## FR-LIFE: Agent Lifecycle Management (Planned)

### FR-LIFE-001: Agent Health Status
Each managed agent wrapper SHALL expose a `health()` method returning one of `healthy`, `degraded`, or `unhealthy` with a string reason.
Traces to: E3.1

### FR-LIFE-002: Health Polling
The orchestrator SHALL poll each agent's health at a configurable interval (default: 30 seconds). Consecutive unhealthy responses (configurable, default: 3) SHALL trigger agent removal from the active pool.
Traces to: E3.1

### FR-LIFE-003: Pool Replenishment
When the active agent pool size falls below `min_pool_size`, the orchestrator SHALL start a replacement agent and add it to the pool when healthy.
Traces to: E3.1

### FR-LIFE-004: SIGTERM/SIGINT Graceful Drain
On receiving `SIGTERM` or `SIGINT`, the orchestrator SHALL stop accepting new task dispatches and wait for in-flight tasks to complete, up to `drain_timeout_seconds` (default: 60).
Traces to: E3.2

### FR-LIFE-005: Checkpoint on Drain Timeout
Tasks that do not complete within the drain timeout SHALL be checkpointed: their current state written to `$AGENT_WAVE_HOME/checkpoints/<task-id>.json`.
Traces to: E3.2

### FR-LIFE-006: Exit Code on Shutdown
The process SHALL exit with code 0 if all in-flight tasks drained cleanly; exit with a non-zero code if any tasks were abandoned due to drain timeout.
Traces to: E3.2

### FR-LIFE-007: Structured Log Events
The engine SHALL emit newline-delimited JSON log entries for: agent_start, health_state_change, task_assigned, task_complete, task_failed, shutdown_start, shutdown_complete. Each entry SHALL include: timestamp (ISO 8601), agent_id, event_type, task_id (when applicable), message.
Traces to: E3.3

---

## FR-AGENTAPI: AgentAPI++ Integration (Planned)

### FR-AGENTAPI-001: Task Submission via AgentAPI++
The engine SHALL use the AgentAPI++ client to submit tasks. Submission payload SHALL include: agent_type, model, prompt, resource_limits, and a wave-scoped correlation_id.
Traces to: E4.1

### FR-AGENTAPI-002: Result Reception
The engine SHALL receive task results via AgentAPI++ callback or polling. Direct stdout capture from agent processes SHALL NOT be used as the primary result mechanism.
Traces to: E4.1

### FR-AGENTAPI-003: MCP Tool Registration
The engine SHALL resolve MCP tool endpoints from a configured MCP server registry. Task manifests SHALL reference tools by name; unresolvable tool names SHALL fail validation at manifest load time.
Traces to: E4.2

### FR-AGENTAPI-004: MCP Tool Error Handling
MCP errors (tool not found, timeout, schema validation failure) SHALL fail the invoking task with a structured error object: tool_name, error_type, message, and request_id.
Traces to: E4.2

---

## FR-POLICY: Policy Federation (Planned)

### FR-POLICY-001: Pre-Dispatch Policy Evaluation
Before dispatching any wave, the engine SHALL query the agentops-policy-federation endpoint with the wave manifest and requesting identity. The query SHALL complete within a configurable timeout (default: 5 seconds); on timeout, the wave SHALL be rejected.
Traces to: E5.1

### FR-POLICY-002: Policy Decision Enforcement
On policy decision `deny`, the engine SHALL reject the wave dispatch, log the denial reason, and return a structured error to the caller. On `allow`, dispatch proceeds. On `allow_with_conditions`, the engine SHALL apply all returned conditions before dispatch.
Traces to: E5.1

### FR-POLICY-003: Audit Event Writing
Every wave dispatch decision (allowed, denied, or conditions applied) SHALL write a signed audit event to an append-only log file at `$AGENT_WAVE_HOME/audit/audit.jsonl`. Fields: wave_id, decision, conditions, identity, timestamp.
Traces to: E5.2

### FR-POLICY-004: Webhook Audit Emission
When `audit.webhook_url` is configured, the engine SHALL emit each audit event to the configured webhook URL via HTTP POST with a JSON body. Webhook failures SHALL not block wave dispatch but SHALL be logged as warnings.
Traces to: E5.2
