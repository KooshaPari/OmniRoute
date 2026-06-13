# Venture-Autonomy Functional Requirements (v1)

## Overview

This document specifies all functional requirements for the Venture platform, organized by domain. Each requirement includes acceptance criteria, priority, component ownership, and test strategy.

**Notation**: FR-{DOMAIN}-{ID} (e.g., FR-VNT-ORCH-001)

**Priorities**: P0 (blocking release), P1 (high value, planned release), P2 (nice-to-have)

---

## FR-VNT-ORCH: Venture Orchestration (Portfolio & Workstream Management)

### FR-VNT-ORCH-001: Portfolio Management API

**SHALL**: control-plane-api expose `GET /portfolios` endpoint returning active workstreams, allocation budgets, and DAG status.

**Priority**: P0
**Component**: venture-orchestrator, control-plane-api
**Acceptance Criteria**:
- Founder can view 10+ workstreams in < 100ms.
- Each workstream includes: id, objective, status (PLANNING, EXECUTING, COMPLETED), budget_allocated, budget_spent, task_count, agent_roles_active.
- Response is cached in Redis and refreshed on task completion events.

**Test Strategy**:
- Unit: mock ledger-db, verify response schema.
- Integration: 50 workstreams in ledger-db, measure query latency.
- L3 Dispatch Hint: `copilot -p '{"task":"list_portfolios"}' --yolo` (read-only, no risk).

### FR-VNT-ORCH-002: Workstream DAG Execution

**SHALL**: venture-orchestrator execute workstream task DAGs (acyclic, dependency-driven), with task ordering enforced by predecessor completion.

**Priority**: P0
**Component**: venture-orchestrator
**Acceptance Criteria**:
- DAG with 5 layers, 20 tasks (max width 5 tasks per layer) executes in correct dependency order.
- Task T2 does not start until task T1 (predecessor) completes with status COMPLETED.
- On task failure, dependent tasks are marked BLOCKED (not auto-retried).
- DAG traversal is logged: emit task.dispatch.initiated.v1 for each task.

**Test Strategy**:
- Unit: construct DAG with cycles, verify rejection.
- Integration: execute 3-layer, 10-task DAG; verify task ordering via event log.
- Acceptance: manual run with founder approval.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-002")

### FR-VNT-ORCH-003: L1/L2/L3 Task Dispatch

**SHALL**: venture-orchestrator dispatch tasks to L1 (orchestrator), L2 (specialist agents), or L3 (copilot CLI pool) based on task_type and complexity heuristic.

**Priority**: P0
**Component**: venture-orchestrator, agent-runtime
**Acceptance Criteria**:
- Task classified as "write short doc" → L3 (< 5 min execution expected).
- Task classified as "refactor codebase" → L2 (stateful, tool chaining).
- Task classified as "activate new workstream" → L1 (portfolio-level decision).
- Dispatch latency: < 200ms (p95).
- All dispatches emit task.dispatch.initiated.v1 with agent_role and dispatch_id.

**Test Strategy**:
- Unit: test classification heuristic (decision tree) with 20 task_type examples.
- Integration: dispatch 100 tasks; measure p95 latency.
- Load test: 10 req/s for 60s; verify throughput and latency.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-003")

### FR-VNT-ORCH-004: L3 Agent Pool Management

**SHALL**: venture-orchestrator manage copilot CLI worker pool with concurrency limits, timeout, and backpressure.

**Priority**: P0
**Component**: venture-orchestrator, agent-runtime
**Acceptance Criteria**:
- Max concurrency: N = 10 (configurable).
- Queue depth: up to 100 pending tasks; reject new dispatches if queue full.
- Per-task timeout: 30 minutes; force-kill subprocess if exceeded.
- Result capture: poll stdout, parse JSON, store in ledger-db.
- On worker crash: retry up to 3 times, then escalate to L2.
- Pool utilization tracked in redis: key = pool-utilization, updated every 5s.

**Test Strategy**:
- Unit: mock subprocess calls, verify timeout mechanism.
- Integration: spawn 10 copilot processes, send 50 tasks, verify queue behavior.
- Stress test: fill queue, measure rejection latency.
- Chaos: kill 3 random workers, verify escalation.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-004")

### FR-VNT-ORCH-005: Task Queue Monitoring & Metrics

**SHALL**: venture-orchestrator expose /metrics endpoint with task queue depth, agent pool utilization, DAG execution progress, and latency percentiles.

**Priority**: P1
**Component**: venture-orchestrator
**Acceptance Criteria**:
- Metrics include: tasks_queued, tasks_dispatched, tasks_completed, agent_pool_utilization (%), avg_dispatch_latency_ms, p95_dispatch_latency_ms.
- Metrics updated every 5 seconds.
- Prometheus-format output (TYPE + HELP comments).
- Alerting rule: if queue_depth > 50 for > 5 min, trigger scaling alert.

**Test Strategy**:
- Unit: mock metrics collection, verify format.
- Integration: run workload, scrape metrics every 10s, verify freshness.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-005")

### FR-VNT-ORCH-006: Workstream Cancellation & Rollback

**SHALL**: founder trigger /workflows/{id}/cancel endpoint to halt all pending tasks in a workstream and emit rollback event.

**Priority**: P1
**Component**: control-plane-api, venture-orchestrator
**Acceptance Criteria**:
- Cancel command issued at T; all tasks queued before T+1s are cancelled.
- In-flight L3 workers are signaled SIGTERM; if not exited in 5s, killed with SIGKILL.
- L2 agents are sent cancellation signal (exception in execution loop).
- Emit workflow.cancelled.v1 event with cancelled_task_count.
- Cancel response returns immediately (async).

**Test Strategy**:
- Integration: dispatch 10 tasks, cancel at T+2s, verify cancellation status.
- Chaos: cancel during L3 task execution, verify signal handling.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-006")

### FR-VNT-ORCH-007: Workstream Resumption

**SHALL**: venture-orchestrator support /workflows/{id}/resume endpoint to re-execute cancelled or failed tasks.

**Priority**: P2
**Component**: venture-orchestrator
**Acceptance Criteria**:
- Resume only re-executes tasks with status CANCELLED or FAILED (not COMPLETED).
- Resume respects original DAG ordering and task dependencies.
- Emit workflow.resumed.v1 event with resumed_task_count.

**Test Strategy**:
- Integration: cancel workstream, resume, verify task re-execution.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-007")

### FR-VNT-ORCH-008: Agent Availability & Slot Tracking

**SHALL**: venture-orchestrator query agent-runtime for available slots before dispatching tasks.

**Priority**: P1
**Component**: agent-runtime, redis-cache
**Acceptance Criteria**:
- Redis key: agent-slots:{agent_role} = {available_count}.
- Updated in-band during task dispatch (atomic decrement on dispatch, increment on completion).
- If slots exhausted, task queued in backlog (max 100).
- Backlog drained as slots free (FIFO).

**Test Strategy**:
- Unit: verify atomic increment/decrement in Redis.
- Integration: dispatch tasks to exhaustion, verify queuing.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ORCH-008")

---

## FR-VNT-TREAS: Treasury (Authorization, Ledger, Controls)

### FR-VNT-TREAS-001: Money Intent Creation

**SHALL**: agent tasks that incur costs create a money_intent via treasury-api.create_intent() before execution.

**Priority**: P0
**Component**: treasury-api, venture-orchestrator
**Acceptance Criteria**:
- Intent includes: workflow_id, amount_cents, currency, merchant_scope, category, ttl_seconds.
- Stored in money_intents table with status=CREATED.
- TTL enforced: intent expires after ttl_seconds (default 3600s).
- Emit money.intent.created.v1 event.

**Test Strategy**:
- Unit: create 10 intents, verify table insert.
- Integration: create intent, verify expiration after TTL.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-001")

### FR-VNT-TREAS-002: Authorization Decision (Default-Deny)

**SHALL**: treasury-api evaluate authorization requests with default-deny policy: reject unless explicitly approved.

**Priority**: P0
**Component**: treasury-api
**Acceptance Criteria**:
- Authorization checks: (1) amount <= per_workflow_cap, (2) amount <= global_daily_cap, (3) merchant_scope in approval list, (4) agent_role authorized for category.
- All checks must PASS for APPROVED; any FAIL → DENIED.
- Decision stored in authorization_decisions table with reason_code.
- Emit money.authorization.decided.v1 event.
- Latency: < 500ms (p95).

**Test Strategy**:
- Unit: test each check in isolation (mock ledger-db).
- Integration: create intent, authorize with various policy configurations; verify correct APPROVED/DENIED.
- Acceptance: founder approves spending limits and merchant allowlists.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-002")

### FR-VNT-TREAS-003: Double-Entry Ledger

**SHALL**: treasury-api maintain a double-entry ledger: every authorized money_intent generates 2 ledger_entries (one debit, one credit).

**Priority**: P0
**Component**: treasury-api
**Acceptance Criteria**:
- On authorization APPROVED: create 2 ledger_entries.
  - Entry 1: debit agent-labor-cost (workflow), credit = amount_cents.
  - Entry 2: credit venture-treasury (revenue), debit = amount_cents.
- Invariant: sum(debits) == sum(credits) for each posting.
- All entries immutable (insert-only).
- Emit ledger.entry.created.v1 events.

**Test Strategy**:
- Unit: create 50 authorized intents, verify double-entry invariant (sum debits == sum credits).
- Database: query ledger_entries, compute totals per workflow.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-003")

### FR-VNT-TREAS-004: Velocity Controls (Rate Limiting)

**SHALL**: treasury-api enforce velocity controls (max spend per time window) per workflow, merchant, and category.

**Priority**: P0
**Component**: treasury-api, redis-cache
**Acceptance Criteria**:
- Config: velocity_limit_per_hour = 10000 (cents), per merchant + category combination.
- Redis key: velocity-control:{workflow_id}:{merchant}:{category}, window = 3600s.
- Spent amount within window tracked; exceeding limit → DENIED with reason_code=VELOCITY_LIMIT_EXCEEDED.
- Burst protection: max single spend <= 1000 cents (configurable per merchant).

**Test Strategy**:
- Unit: redis increment/check logic.
- Integration: send 10 intents (100 cents each) rapid-fire; 11th intent denied.
- Time-based: send intent at hour boundary, verify window reset.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-004")

### FR-VNT-TREAS-005: Merchant & Category Allowlists

**SHALL**: treasury-api cross-check money_intent merchant_scope and category against policy-driven allowlists.

**Priority**: P0
**Component**: treasury-api, policy-engine
**Acceptance Criteria**:
- Allowlist stored in policy_bundle (versioned JSON).
- Example: { merchants: ["stripe", "openai"], categories: ["api-calls", "labor"] }.
- If intent merchant not in list → DENIED with reason_code=MERCHANT_NOT_ALLOWED.
- Agent role restricts categories: L3-agent can use category="labor" but not "infrastructure".

**Test Strategy**:
- Unit: test merchant/category matching.
- Integration: create intent with disallowed merchant; verify DENIED.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-005")

### FR-VNT-TREAS-006: Reconciliation

**SHALL**: treasury-api run daily reconciliation job verifying ledger integrity and matching external payment records.

**Priority**: P1
**Component**: treasury-api, external payment APIs (optional)
**Acceptance Criteria**:
- Daily job: sum all ledger_entries, verify debit == credit (globally).
- If external payment provider integrated: cross-check ledger vs. provider API.
- Emit ledger.reconciliation.completed.v1 with mismatches (if any).
- If mismatch > threshold (e.g., 10000 cents): auto-freeze system and escalate to founder.
- Log reconciliation proof to audit_checkpoints table.

**Test Strategy**:
- Unit: create ledger entries with imbalance, run reconciliation, verify detection.
- Integration: run daily job, capture output event.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-006")

### FR-VNT-TREAS-007: Idempotent Payment Events

**SHALL**: treasury-api guarantee idempotent settlement: duplicate money_intent IDs produce only one ledger entry.

**Priority**: P1
**Component**: treasury-api
**Acceptance Criteria**:
- Idempotency key: money_intent_id.
- Settlement: if ledger_entry for intent_id already exists, return existing entry (no duplicate).
- Emit money.authorization.decided.v1 idempotently (same event_id for retries).

**Test Strategy**:
- Integration: authorize same intent 5 times; verify only 1 ledger entry created.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-007")

### FR-VNT-TREAS-008: Per-Workflow Budget Caps

**SHALL**: treasury-api enforce per-workflow maximum spending cap.

**Priority**: P0
**Component**: treasury-api, ledger-db
**Acceptance Criteria**:
- Config: per_workflow_cap = 100000 (cents), stored in workflow record.
- Before authorizing intent: query ledger_entries for workflow_id, sum spent, verify (spent + new amount) <= cap.
- If exceeded: DENIED with reason_code=WORKFLOW_BUDGET_EXCEEDED.

**Test Strategy**:
- Integration: set cap to 1000 cents, create intents totaling 1500; verify rejection at 1001.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-008")

### FR-VNT-TREAS-009: Global Daily Spending Cap

**SHALL**: treasury-api enforce global maximum daily spend across all workflows.

**Priority**: P1
**Component**: treasury-api, redis-cache
**Acceptance Criteria**:
- Config: global_daily_cap = 1000000 (cents).
- Redis key: global-spend:{YYYY-MM-DD}, window = 86400s.
- Before authorizing intent: check (global_spend_today + amount) <= cap.
- If exceeded: DENIED with reason_code=GLOBAL_CAP_EXCEEDED.

**Test Strategy**:
- Integration: set cap to 1000 cents, create intents across multiple workflows; verify rejection.

**Test Trace**: @pytest.mark.requirement("FR-VNT-TREAS-009")

---

## FR-VNT-ARTIF: Artifact Compiler (IR, Build Pipeline, Export)

### FR-VNT-ARTIF-001: Artifact IR Registration

**SHALL**: artifact-compiler accept artifact IR specs (SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec) and register them in ledger-db.

**Priority**: P0
**Component**: artifact-compiler
**Acceptance Criteria**:
- IR spec validated against schema (JSON Schema v7).
- Computed: content_hash (SHA256 of payload), inputs_hash (SHA256 of external inputs).
- Stored in artifact_ir table: id, ir_type, schema_version, content_hash, inputs_hash, payload_json, created_at.
- Emit artifact.ir.registered.v1 event.

**Test Strategy**:
- Unit: validate 5 IR types against schemas.
- Integration: register IR, query ledger-db.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-001")

### FR-VNT-ARTIF-002: Deterministic Build & Replay

**SHALL**: artifact-compiler guarantee byte-identical output on replay if toolchain and inputs are unchanged.

**Priority**: P0
**Component**: artifact-compiler
**Acceptance Criteria**:
- Idempotency key: hash(ir_hash, toolchain_version, policy_bundle_id, target_surface).
- Build 1: render SlideSpec with Claude → artifact_A.pptx (hash = H1).
- Build 2 (same IR, same toolchain): → artifact_B.pptx (hash = H2).
- Requirement: H1 == H2 (byte-identical).
- If not identical: emit artifact.replay.failed.v1 and escalate.

**Test Strategy**:
- Unit: mock rendering with fixed seed.
- Integration: build same IR twice; compute hash, verify equality.
- Property-based: 10 random IR specs, 5 builds each, verify hashes stable.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-002")

### FR-VNT-ARTIF-003: Build Pipeline (Validate → Render → Export)

**SHALL**: artifact-compiler execute 3-stage pipeline: IR validation, rendering, export.

**Priority**: P0
**Component**: artifact-compiler
**Acceptance Criteria**:
- Stage 1 (Validate): schema validation, inputs_hash verification.
- Stage 2 (Render): call external provider (Claude, Veo, Banana) with IR spec + policy bundle.
- Stage 3 (Export): serialize output to target format (PDF, PPTX, MP4, JSON).
- Each stage emits event: artifact.build.started.v1, artifact.{stage}.completed.v1.
- On stage failure: emit artifact.build.failed.v1, log reason_code, don't proceed to next stage.

**Test Strategy**:
- Unit: mock each stage, verify transitions.
- Integration: end-to-end build with real external provider.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-003")

### FR-VNT-ARTIF-004: Provenance Metadata

**SHALL**: artifact-compiler attach provenance metadata to each artifact: provider, model, signature, timestamp.

**Priority**: P0
**Component**: artifact-compiler
**Acceptance Criteria**:
- Provenance record: artifact_provenance table (id, build_id, provider, model, signature, created_at).
- Signature: RSA/ECDSA signature over (build_id, provider, model, output_hash).
- Exported artifact includes provenance JSON (metadata-only, not embedded in output file).
- Emit artifact.provenance.attested.v1 event.

**Test Strategy**:
- Unit: generate and verify provenance signatures.
- Integration: build artifact, extract provenance, verify signature with public key.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-004")

### FR-VNT-ARTIF-005: Provider Fallback Routing

**SHALL**: artifact-compiler route rendering requests to providers (Claude, Veo, Banana) based on policy tier and budget envelope.

**Priority**: P1
**Component**: artifact-compiler
**Acceptance Criteria**:
- Policy tier: "fast", "balanced", "quality" (budget ascending).
- Fallback order:
  - Tier "fast": Claude (fast API) → Banana (fallback).
  - Tier "balanced": Claude → Veo (quality) → Banana.
  - Tier "quality": Veo → Claude.
- Budget envelope: max cost per artifact, configurable per policy_bundle.
- If provider unavailable or budget exceeded: try next provider.
- Emit artifact.provider.selected.v1 with selected provider and reason.

**Test Strategy**:
- Unit: test fallback decision tree.
- Integration: mock providers with failures; verify fallback chaining.
- Chaos: disable Claude, verify fallback to Veo.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-005")

### FR-VNT-ARTIF-006: Artifact Caching

**SHALL**: artifact-compiler cache build outputs indexed by idempotency key (ir_hash + toolchain_version + policy_bundle_id).

**Priority**: P1
**Component**: artifact-compiler, redis-cache
**Acceptance Criteria**:
- Cache key: artifact-cache:{idempotency_key}.
- Cache hit: return stored artifact + provenance (skip render stage).
- Cache miss: proceed to full build pipeline.
- TTL: configurable (default 7 days).
- Emit artifact.cache.hit.v1 or artifact.cache.miss.v1 event.

**Test Strategy**:
- Integration: build artifact, verify cache miss; rebuild same IR, verify cache hit.
- Verify latency improvement: cache hit < 100ms, cache miss > 5s (with external API).

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-006")

### FR-VNT-ARTIF-007: Non-Deterministic Provider Handling

**SHALL**: artifact-compiler handle non-deterministic providers (Veo, Banana) with semantic equivalence validation.

**Priority**: P2
**Component**: artifact-compiler
**Acceptance Criteria**:
- Non-deterministic providers: Veo, Banana (video/image generation, random seed varies).
- Build 1 + Build 2: different binary hashes, but semantically equivalent content.
- Validation: optionally run semantic equivalence test (e.g., visual similarity score, metadata match).
- Emit artifact.semantic-equivalence.verified.v1 (if enabled by policy).

**Test Strategy**:
- Integration: build video twice from TimelineSpec, compare semantic equivalence.

**Test Trace**: @pytest.mark.requirement("FR-VNT-ARTIF-007")

---

## FR-VNT-COMPL: Compliance (Policy Evaluation, Audit, Privacy)

### FR-VNT-COMPL-001: Policy Rule Evaluation

**SHALL**: compliance-engine evaluate policy rules against all agent actions (tool calls, spend, data access).

**Priority**: P0
**Component**: compliance-engine
**Acceptance Criteria**:
- Rule schema: rule_id, rule_type (TOOL_USAGE, SPEND, DATA_ACCESS, EXPORT), condition, action (ALLOW/DENY), severity (LOW/MEDIUM/CRITICAL).
- Evaluate before action: tool call → check TOOL_USAGE rule → ALLOW or DENY.
- Emit compliance.evaluated.v1 with decision, rule_id, reason.
- If action=DENY and severity=CRITICAL: also emit compliance.violation.detected.v1 and auto-freeze.

**Test Strategy**:
- Unit: evaluate 20 rule + condition combinations.
- Integration: dispatch task that violates rule; verify evaluation and freeze.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-001")

### FR-VNT-COMPL-002: Audit Trail

**SHALL**: compliance-engine maintain immutable audit trail of all policy evaluations and decisions.

**Priority**: P0
**Component**: compliance-engine, ledger-db
**Acceptance Criteria**:
- Audit table: audit_trail (id, trace_id, workflow_id, event_type, rule_id, decision, timestamp).
- Append-only: no updates or deletes (permissions enforced in DB).
- Tamper-evident: checksums computed over event batches; stored in audit_checkpoints.
- Query: founder can retrieve audit trail for any workflow via GET /audit/{workflow_id}.

**Test Strategy**:
- Unit: verify append-only constraint.
- Integration: run task, retrieve audit trail, verify completeness.
- Security: attempt to delete audit record; verify DB permission error.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-002")

### FR-VNT-COMPL-003: Violation Detection & Escalation

**SHALL**: compliance-engine detect violations (rule DENY, severity CRITICAL) and escalate to founder.

**Priority**: P0
**Component**: compliance-engine, control-plane-api
**Acceptance Criteria**:
- Violation: rule evaluation returns action=DENY and severity=CRITICAL.
- Escalation: emit compliance.violation.detected.v1 and control.freeze.activated.v1.
- Founder notification: push message to control-plane-api WebSocket (async).
- System freeze: orchestrator stops dispatching new tasks; in-flight tasks continue but can be killed.

**Test Strategy**:
- Integration: trigger violation, verify freeze event emitted and WebSocket notification sent.
- Chaos: simulate critical violation during task execution.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-003")

### FR-VNT-COMPL-004: Data Subject Access Requests (DSAR)

**SHALL**: compliance-engine process DSAR (Data Subject Access Request) and compile subject data.

**Priority**: P1
**Component**: compliance-engine
**Acceptance Criteria**:
- Receive privacy.request.received.v1 (request_type=DSAR, subject_ref).
- Query ledger-db for all events, ledger entries, artifact records mentioning subject_ref.
- Compile response_bundle (JSON, redacted per privacy policy).
- Emit privacy.request.completed.v1 with bundle_hash, due_at (regulatory timeline).
- Store response_bundle_hash in privacy_requests table (immutable proof).

**Test Strategy**:
- Integration: create workflow with PII subject, trigger DSAR, verify bundle contents.
- Acceptance: legal review of redaction policy.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-004")

### FR-VNT-COMPL-005: Data Deletion (Right to Erasure)

**SHALL**: compliance-engine process deletion requests and redact PII from audit trail.

**Priority**: P1
**Component**: compliance-engine, ledger-db
**Acceptance Criteria**:
- Receive privacy.request.received.v1 (request_type=DELETE, subject_ref).
- Redaction strategy: replace PII fields in events with "{REDACTED}".
- Maintain referential integrity: keep trace_id, workflow_id for audit.
- Emit privacy.request.completed.v1.
- Query ledger-db: verify PII redacted, audit trail still traversable.

**Test Strategy**:
- Integration: create workflow with PII, trigger deletion, query ledger-db, verify redaction.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-005")

### FR-VNT-COMPL-006: Incident Classification & Playbook

**SHALL**: compliance-engine classify incidents by type and trigger predefined playbooks.

**Priority**: P1
**Component**: compliance-engine, control-plane-api
**Acceptance Criteria**:
- Incident types: POLICY_VIOLATION, BUDGET_OVERRUN, TOOL_MISUSE, DATA_BREACH.
- Classification rule: violation event → map rule_id to incident_type → trigger playbook.
- Playbook: documented steps (e.g., for BUDGET_OVERRUN: freeze, notify CFO, await authorization).
- Emit incident.classified.v1 with type and assigned playbook.

**Test Strategy**:
- Unit: test incident classifier with 10 violation types.
- Integration: trigger violation, verify playbook assignment.

**Test Trace**: @pytest.mark.requirement("FR-VNT-COMPL-006")

---

## FR-VNT-AGENT: Agent Runtime (L1/L2/L3 Execution, Tool Gating)

### FR-VNT-AGENT-001: L2 Specialist Agent Dispatch

**SHALL**: agent-runtime dispatch L2 specialist tasks to Writer, Coder, Researcher, or Analyst agents.

**Priority**: P0
**Component**: agent-runtime
**Acceptance Criteria**:
- Task router: task_type → agent class mapping (e.g., "write_doc" → Writer).
- Agent execution: in-process function call, task_envelope passed as input.
- Agent iterates: decide_action → check_tool_allowed → call_tool → emit_event.
- On completion: emit task.completed.v1 with result_hash and output.

**Test Strategy**:
- Unit: test each agent class with mock tasks.
- Integration: dispatch 5 tasks (1 per agent type), verify completion events.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-001")

### FR-VNT-AGENT-002: Tool Permission Checking (Allowlist)

**SHALL**: agent-runtime enforce tool allowlists per agent_role before executing tool calls.

**Priority**: P0
**Component**: policy-engine, agent-runtime
**Acceptance Criteria**:
- Agent requests tool call: tool_name = "io.write".
- Check policy-engine cache (Redis) for agent_role tool allowlist.
- If tool_name in allowlist → ALLOWED, proceed; else → DENIED, emit policy.evaluated.v1 (decision=DENIED).
- Cache refresh: TTL 5 min; fallback to disk/DB on cache miss (tolerance for <= 1s latency regression).

**Test Strategy**:
- Unit: test allowlist lookup (cache + fallback).
- Integration: agent requests disallowed tool; verify DENIED event.
- Load: 100 tool requests/s; verify cache hit rate > 90%.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-002")

### FR-VNT-AGENT-003: Tool Call Auditing

**SHALL**: agent-runtime emit tool.call.executed.v1 event for every tool call, including inputs and outputs.

**Priority**: P0
**Component**: agent-runtime
**Acceptance Criteria**:
- Event includes: tool_name, input (sanitized), output_hash (SHA256 of output), duration_ms, status (OK/ERROR), error_code (if ERROR).
- Events logged to event-bus immediately after tool return.
- Sensitive data (API keys, PII) redacted from input/output.
- No tool call unlogged.

**Test Strategy**:
- Integration: dispatch task with 5 tool calls; verify 5 tool.call.executed.v1 events in event-bus.
- Security: verify API key redaction in event payload.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-003")

### FR-VNT-AGENT-004: Tool Result Validation & Sandboxing

**SHALL**: agent-runtime validate and sandbox tool outputs before returning to agent.

**Priority**: P0
**Component**: agent-runtime, tool-layer
**Acceptance Criteria**:
- Output validation: check output type (e.g., JSON for web.fetch, string for io.read).
- External content isolation: for web.fetch output, reject HTML; accept JSON only.
- Sanitization: redact suspected PII (email addresses, API keys).
- On validation failure: emit error event, return error to agent (agent decides retry or escalation).

**Test Strategy**:
- Unit: test validators (JSON, HTML rejection, PII redaction).
- Integration: call web.fetch with HTML response; verify rejection.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-004")

### FR-VNT-AGENT-005: L3 Copilot CLI Worker Execution

**SHALL**: agent-runtime spawn and manage copilot CLI worker processes for L3 task execution.

**Priority**: P0
**Component**: agent-runtime, venture-orchestrator
**Acceptance Criteria**:
- Spawn: `copilot -p '{task_envelope_json}' --yolo --model gpt-5-mini --add-dir {workspace} &`
- Task envelope: serialized to JSON, passed as argument.
- Workspace: working directory with git repo, accessible to copilot.
- Result capture: poll subprocess stdout (JSON), parse result, store in ledger-db.
- Timeout: 30 minutes; send SIGTERM at timeout; if not exited in 5s, SIGKILL.
- Emit task.completed.v1 with result (or error if timeout/crash).

**Test Strategy**:
- Integration: dispatch L3 task; capture stdout and result.
- Timeout: dispatch task expected to run < 30m; verify completion before timeout.
- Chaos: kill copilot subprocess; verify error handling and escalation.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-005")

### FR-VNT-AGENT-006: L3 Result Capture & Git Sidecar

**SHALL**: agent-runtime capture L3 copilot results from stdout and monitor git commits as sidecar effect.

**Priority**: P0
**Component**: agent-runtime
**Acceptance Criteria**:
- Result format: copilot outputs JSON to stdout: { "result": "...", "status": "OK" }.
- Capture: read stdout, parse JSON, store result_hash in ledger-db.
- Git sidecar: monitor git repo in {workspace}; if commits created during task, record commit hashes in task.completed.v1 event.
- On parse failure: emit task.completed.v1 with status=ERROR, error_code=INVALID_OUTPUT.

**Test Strategy**:
- Integration: dispatch L3 task, verify result capture and git monitoring.
- Parse error: send malformed JSON to stdout; verify error handling.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-006")

### FR-VNT-AGENT-007: Agent Workload Identity & Credentials

**SHALL**: agent-runtime issue short-lived workload identity credentials for each agent task.

**Priority**: P0
**Component**: agent-runtime, policy-engine
**Acceptance Criteria**:
- Credential format: JWT with iss, sub (agent_role:instance), aud, exp (now + 5 min), iat, signature.
- Embedded in task_envelope.
- Validated by policy-engine on each tool call (verify signature, check expiry).
- On expiry: agent tasks fail with auth_error, forcing re-dispatch with fresh credentials.

**Test Strategy**:
- Unit: generate credentials, verify JWT structure and signature.
- Integration: dispatch task; policy-engine validates credentials.
- Expiry: set credential TTL to 1s, dispatch task expected to run 5s; verify expiry error.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-007")

### FR-VNT-AGENT-008: Agent Failure Handling & Retry

**SHALL**: agent-runtime handle agent task failures (crashes, timeouts, explicit errors) with configurable retry policy.

**Priority**: P0
**Component**: agent-runtime, venture-orchestrator
**Acceptance Criteria**:
- Failure modes: subprocess crash, timeout (30m), explicit error (agent returned error_code).
- Retry policy: up to 3 retries with exponential backoff (1s, 4s, 16s).
- After 3 retries: mark task as FAILED, emit task.failed.v1, escalate to L2 (replace with L2-equivalent task).
- Emit task.retry.initiated.v1 on each retry.

**Test Strategy**:
- Integration: dispatch task with forced crash; verify retries and escalation.
- Backoff: measure delay between retries, verify exponential progression.

**Test Trace**: @pytest.mark.requirement("FR-VNT-AGENT-008")

---

## FR-VNT-CTRL: Control Plane (Founder API, Kill-Switch, Freeze)

### FR-VNT-CTRL-001: Founder Task Submission API

**SHALL**: control-plane-api expose POST /workflows endpoint for founders to submit task intents.

**Priority**: P0
**Component**: control-plane-api
**Acceptance Criteria**:
- Request: { objective, task_list: [{ type, input }], budget_cents, policy_bundle_id }.
- Response: { workflow_id, created_at } (immediate, async execution).
- WebSocket: client subscribes to workflow progress (push task completion events in real-time).
- Founder authenticated: mTLS certificate + API key.

**Test Strategy**:
- Integration: submit workflow, verify creation and WebSocket updates.
- Load: 10 concurrent submissions; measure response latency and WebSocket throughput.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-001")

### FR-VNT-CTRL-002: Policy Publishing API

**SHALL**: control-plane-api expose POST /policies/publish endpoint for founders to publish new policy bundles.

**Priority**: P0
**Component**: control-plane-api, policy-engine
**Acceptance Criteria**:
- Request: { policy_bundle: { rules, tool_allowlists, merchant_allowlists, ... }, version, description }.
- Validation: schema check, rule syntax validation.
- Storage: new policy_bundle row in ledger-db, versioned by version number.
- Emit: policy.published.v1 event.
- Effective date: configurable (immediate or scheduled).

**Test Strategy**:
- Integration: publish policy, verify storage and version tracking.
- Invalid policy: attempt to publish invalid rule; verify rejection.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-002")

### FR-VNT-CTRL-003: Kill-Switch (Global Pause)

**SHALL**: control-plane-api expose POST /control/freeze endpoint to pause all agent execution system-wide.

**Priority**: P0
**Component**: control-plane-api, venture-orchestrator
**Acceptance Criteria**:
- Freeze effect: orchestrator stops dispatching new L1/L2/L3 tasks immediately.
- In-flight tasks: continue (no kill signal).
- Duration: indefinite until founder issues POST /control/unfreeze.
- Emit: control.freeze.activated.v1 with reason (founder-initiated or auto-escalation).
- Audit: freeze logged to compliance audit trail.

**Test Strategy**:
- Integration: issue freeze command; verify no new task dispatches.
- In-flight: dispatch task before freeze, verify it completes.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-003")

### FR-VNT-CTRL-004: Workflow Monitoring Dashboard

**SHALL**: control-plane-api expose GET /workflows and GET /workflows/{id} endpoints for founder monitoring.

**Priority**: P0
**Component**: control-plane-api, ledger-db
**Acceptance Criteria**:
- GET /workflows: list all active workflows with status, progress (tasks completed / total), budget spent, agents active.
- GET /workflows/{id}: detailed workflow view: task DAG, task statuses, agent assignments, events log, ledger entries.
- Latency: < 100ms for list, < 500ms for detail.
- Caching: Redis-backed, TTL 5s.

**Test Strategy**:
- Integration: create workflows, query endpoints; verify response format and latency.
- Load: 50 concurrent queries; measure p95 latency.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-004")

### FR-VNT-CTRL-005: Workstream Cancellation API

**SHALL**: control-plane-api expose POST /workflows/{id}/cancel endpoint to halt a specific workstream.

**Priority**: P1
**Component**: control-plane-api, venture-orchestrator
**Acceptance Criteria**:
- Effect: all pending tasks in workstream cancelled; in-flight L3 workers signaled SIGTERM.
- Emit: workflow.cancelled.v1 event.
- Idempotent: calling cancel twice returns same result (already cancelled).

**Test Strategy**:
- Integration: dispatch workflow, cancel mid-execution, verify task cancellation.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-005")

### FR-VNT-CTRL-006: Audit Trail Query API

**SHALL**: control-plane-api expose GET /audit/{workflow_id} endpoint for founders to retrieve audit trail.

**Priority**: P0
**Component**: control-plane-api, ledger-db
**Acceptance Criteria**:
- Response: list of all events (policy.evaluated, tool.call.executed, money.authorization.decided, etc.) for workflow.
- Format: sorted by created_at, includes event_id, event_type, payload.
- Filtering: optional query params (event_type, created_after, created_before).
- Immutable: founder cannot modify/delete audit records.

**Test Strategy**:
- Integration: run task, retrieve audit trail, verify completeness.
- Security: attempt to delete audit record via API; verify rejection.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-006")

### FR-VNT-CTRL-007: System Health & Incident Status

**SHALL**: control-plane-api expose GET /health endpoint returning system status and active incidents.

**Priority**: P1
**Component**: control-plane-api
**Acceptance Criteria**:
- Response: { status: "OK"|"DEGRADED"|"FROZEN", incident_count, frozen_until, services_down: [...] }.
- Status "FROZEN": system is paused (freeze active).
- Status "DEGRADED": one or more services down (policy-engine, artifact-compiler, etc.).
- Status "OK": all services healthy.
- Incident list: recent critical incidents with escalation status.

**Test Strategy**:
- Integration: freeze system, query health; verify status=FROZEN.
- Simulate service failure; verify DEGRADED status.

**Test Trace**: @pytest.mark.requirement("FR-VNT-CTRL-007")

---

## Cross-Cutting Concerns

### FR-VNT-XC-001: Event Sourcing & Immutable Ledger

**SHALL**: all state changes emit immutable events to NATS JetStream and be persisted in PostgreSQL ledger.

**Priority**: P0
**Component**: event-bus, ledger-db
**Acceptance Criteria**:
- No CRUD API for state; state derived from events.
- Events append-only (insert-only permissions in DB).
- Ledger query: founder can reconstruct any past state by replaying events up to a point-in-time.
- Checksum integrity: every event batch checksummed; mismatch triggers violation alert.

**Test Strategy**:
- Integration: emit 1000 events, replay, verify state reconstruction.
- Integrity: compute checksums, intentionally corrupt DB, verify mismatch detection.

**Test Trace**: @pytest.mark.requirement("FR-VNT-XC-001")

### FR-VNT-XC-002: Trace & Workflow ID Propagation

**SHALL**: trace_id and workflow_id propagated across all events and service calls.

**Priority**: P0
**Component**: all services
**Acceptance Criteria**:
- trace_id: generated per founder request, immutable across entire execution chain.
- workflow_id: generated per workflow submission, identifies all tasks in workflow.
- Every event includes both IDs in envelope.
- Query by trace_id or workflow_id: retrieve all events in causal chain.

**Test Strategy**:
- Integration: dispatch task, collect events, verify trace_id consistency.

**Test Trace**: @pytest.mark.requirement("FR-VNT-XC-002")

### FR-VNT-XC-003: Schema Registry & Versioning

**SHALL**: policy-engine maintain schema registry for task types, allowing new task types to be defined and validated.

**Priority**: P1
**Component**: policy-engine, ledger-db
**Acceptance Criteria**:
- Schema registry: table schema_registry { id, task_type, schema_json, version, created_at }.
- On task submission: lookup task_type in registry, validate input against schema.
- Versioning: allow schema evolution (new optional fields).
- Query: founder can list all registered task types and versions.

**Test Strategy**:
- Integration: register new task type schema, submit task matching schema, verify validation.
- Schema evolution: add optional field, verify backward compatibility.

**Test Trace**: @pytest.mark.requirement("FR-VNT-XC-003")

---

## Traceability Matrix

| FR ID | Acceptance Criteria | Test Strategy | Owner | Status |
|---|---|---|---|---|
| FR-VNT-ORCH-001 | 5 | Unit + Integ | venture-orchestrator | Planned |
| FR-VNT-ORCH-002 | 4 | Unit + Integ | venture-orchestrator | Planned |
| FR-VNT-ORCH-003 | 3 | Unit + Integ + Load | venture-orchestrator | Planned |
| ... | ... | ... | ... | ... |

---

## Revision History

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-02-21 | 1.0 | AI Agent | Initial comprehensive FR document, 45+ requirements across 6 domains, traceability to components and acceptance tests. |

---

## FR-VNT-EVTBUS: Event Bus Schema

### FR-VNT-EVTBUS-001: EventEnvelopeV1 Schema

**SHALL**: All Venture platform events conform to `EventEnvelopeV1` Pydantic model with required fields: `event_id` (UUID, default uuid4), `event_type` (str, pattern: `<domain>.<verb>.v<N>`), `trace_id` (UUID), `workflow_id` (UUID | None), `task_id` (UUID | None), `policy_bundle_id` (UUID | None), `created_at` (datetime, UTC), `payload` (dict).

**Priority**: P0
**Component**: All services (shared schema)
**Acceptance Criteria**:
- `event_type` follows `<domain>.<verb>.v<N>` convention (e.g., `policy.published.v1`)
- `trace_id` links causally-related events across services
- Model is importable from `venture.eventbus.schema`
**Code:** `venture/eventbus/schema.py`

### FR-VNT-EVTBUS-002: EventTypes Registry

**SHALL**: `EventTypes` class SHALL define canonical domain prefixes: `policy`, `workflow`, `task`, `artifact`, `money`, `ledger`, `compliance`, `privacy`, `control`; all event_type strings SHALL start with one of these prefixes.

**Priority**: P0
**Component**: All services
**Code:** `venture/eventbus/schema.py`

---

## FR-VNT-LEDGER: Database Schema

### FR-VNT-LEDGER-001: Append-Only Event Table

**SHALL**: PostgreSQL `events` table SHALL be append-only with columns: `id` (BigInteger PK), `event_id` (UUID unique), `event_type` (String 100, indexed), `trace_id` (UUID, indexed), `workflow_id` (UUID, nullable, indexed), `task_id` (UUID, nullable, indexed), `policy_bundle_id` (UUID, nullable), `payload` (JSONB, not null), `created_at` (DateTime UTC). Compound index on `(workflow_id, created_at)`.

**Priority**: P0
**Component**: All services (shared PostgreSQL)
**Acceptance Criteria**:
- No UPDATE or DELETE SQL on `events` table; append-only enforced at application layer
- `event_id` unique constraint prevents duplicate event insertion
**Code:** `venture/ledger/schema.py` — `Event` model

### FR-VNT-LEDGER-002: Audit Checkpoint Chain

**SHALL**: `audit_checkpoints` table SHALL store SHA-256 checksums over ordered event batches with fields: `id`, `batch_id` (String 50), `event_id_start` (UUID), `event_id_end` (UUID), `checksum` (String 64 — SHA-256), `created_at`; checkpoints enable tamper detection over the event log.

**Priority**: P0
**Component**: compliance-engine
**Code:** `venture/ledger/schema.py` — `AuditCheckpoint` model
