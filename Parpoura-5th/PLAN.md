# Venture Platform Implementation Plan (WBS + DAG)

**Date:** 2026-02-21
**Status:** ACTIVE
**Scope:** MVP = all M0–M6 milestones with full v1 feature coverage
**Owner:** Venture Platform Team

---

## Overview: Work Breakdown Structure (WBS) and DAG

This plan details every task from M0 through M6, with explicit dependencies (DAG). Tasks are numbered as **Phase.Task** (e.g., **P0.1**, **P1.4**).

**Dependency notation:**
- `→` means "must complete before"
- `[P0.1, P0.2]` means "all of these"
- `[any(P0.1, P0.2)]` means "any one of these"

---

## Phase 0: Foundation (M0 — Weeks 1–2)

### Objective
Stand up all infrastructure services: PostgreSQL, NATS JetStream, Redis, process-compose baseline, and schema registry.

### Tasks

#### P0.1 — Initialize PostgreSQL Schema via Alembic
- **Description:** Create all database tables for artifact IR, ledger, workflow, audit, and policy
- **Depends On:** `—` (no dependencies)
- **FR Refs:** `FR-INFRA-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-INFRA-001 — Initialize PostgreSQL schema via Alembic..." --yolo
  ```
- **Acceptance Tests:**
  - `artifact_ir` table exists with columns: `id, ir_type, schema_version, content_hash, payload_json, created_at`
  - `ledger` table exists with columns: `id, venture_id, account_type, amount, txn_id, created_at`
  - `audit_log` table exists with columns: `id, entity_id, action, reason_code, policy_bundle_id, created_at`
  - `policy_bundles` table exists with columns: `id, version, schema_snapshot, published_at, created_at`
  - Migrations run idempotently (run twice = same state)
  - Test: `pytest tests/test_db_migrations.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 1–2 days

#### P0.2 — Stand up NATS JetStream Streams
- **Description:** Create durable JetStream streams for events and tasks; enable durable subscriptions
- **Depends On:** `—` (no dependencies; can run in parallel with P0.1)
- **FR Refs:** `FR-INFRA-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-INFRA-002 — Stand up NATS JetStream Streams..." --yolo
  ```
- **Acceptance Tests:**
  - `events.*` stream created with replication factor 3
  - `tasks.*` stream created with replication factor 3
  - Durable subscriptions persist across server restart
  - Event publish → subscribe → event received (round-trip works)
  - Test: `pytest tests/test_nats_streams.py -v`
  - Manual: kill nats, restart, verify data persists
- **Complexity:** Medium (M)
- **Estimate:** 1–2 days

#### P0.3 — Redis Cache Layer + Rate Limit Primitives
- **Description:** Set up Redis connection pool; implement token bucket rate limiter for policy evaluation
- **Depends On:** `—` (no dependencies; can run in parallel)
- **FR Refs:** `FR-INFRA-003` (part)
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-INFRA-003 — Redis cache and rate limit primitives..." --yolo
  ```
- **Acceptance Tests:**
  - Redis SET/GET round-trip works
  - Token bucket limiter accepts up to N requests per window
  - Exceeding limit returns rate-limit error
  - Cache expiry works (TTL honored)
  - Test: `pytest tests/test_redis.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P0.4 — Process-Compose Baseline Manifest
- **Description:** Create `compose/process-compose.yaml` declaring all services with health checks and startup order
- **Depends On:** `[P0.1, P0.2, P0.3]` (services must be ready before manifest)
- **FR Refs:** `FR-INFRA-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-INFRA-004 — Process-compose baseline..." --yolo
  ```
- **Acceptance Tests:**
  - `process-compose up` starts all services
  - Health checks pass for all services
  - Services start in correct order (PostgreSQL first, then NATS, then application services)
  - `process-compose down` gracefully shuts down all services
  - Manual: `process-compose up && sleep 10 && curl localhost:8000/health`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P0.5 — Schema Registry Service + EventEnvelopeV1 Validation
- **Description:** Implement in-process schema registry; validate all events against EventEnvelopeV1 schema
- **Depends On:** `[P0.2, P0.4]` (NATS streams and process-compose must be ready)
- **FR Refs:** `FR-INFRA-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-INFRA-005 — Schema registry and EventEnvelopeV1..." --yolo
  ```
- **Acceptance Tests:**
  - EventEnvelopeV1 schema enforces: `event_id, event_type, trace_id, workflow_id, payload, created_at`
  - Malformed events rejected with 400 Bad Request
  - Valid events emitted via NATS; subscribers receive deterministically
  - Schema versioning works: schema v1 → v2, old events still validate against v1
  - Replay from NATS produces identical events
  - Test: `pytest tests/test_schema_registry.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 1–2 days

### M0 Exit Criteria
1. All services running: `process-compose up`
2. All tests green: `pytest tests/test_db_migrations.py tests/test_nats_streams.py tests/test_schema_registry.py -v`
3. No suppressions: all tests pass without `# noqa` or ignores
4. Data persistence: kill any service, restart, data intact
5. Event replay deterministic: publish → consume → replay produces identical results

### M0 DAG Summary
```
P0.1 (PostgreSQL)  ─┐
P0.2 (NATS)        ─┼─→ P0.4 (process-compose) ──→ P0.5 (schema registry)
P0.3 (Redis)       ─┘
```

---

## Phase 1: Control Plane (M1 — Weeks 3–4)

### Objective
Implement governance layer: policy engine, tool allowlists, founder REST API, workspace boundaries, and FSM.

### Tasks

#### P1.1 — Policy Engine: Bundle Versioning + Decision Binding
- **Description:** Implement policy bundle CRUD; bind every authorization decision to a policy version; store schema snapshots
- **Depends On:** `[P0.1, P0.5]` (database and schema registry)
- **FR Refs:** `FR-CP-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-CP-001 — Policy engine with bundle versioning..." --yolo
  ```
- **Acceptance Tests:**
  - POST /policies creates new bundle v1
  - GET /policies/{policy_id} returns bundle with schema snapshot
  - Every authorization decision includes `policy_bundle_id` and `reason_code`
  - Policy replay: evaluate old decision with old bundle → same result as at time of decision
  - Test: `pytest tests/test_policy_engine.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P1.2 — Tool Allowlist Engine: Role → Tools Mapping
- **Description:** Implement per-role tool allowlist; enforce at task dispatch time; reject unpermitted calls
- **Depends On:** `[P0.1, P1.1]` (database and policy engine)
- **FR Refs:** `FR-CP-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-CP-002 — Tool allowlist engine..." --yolo
  ```
- **Acceptance Tests:**
  - Role FOUNDER has tools: [policy, spend, audit]
  - Role AUTONOMY has tools: [task, artifact.build, data.read]
  - Agent with role AUTONOMY calling tool SPEND → 403 Forbidden + audit log
  - Tool call includes agent_role and tool_id in trace
  - Test: `pytest tests/test_tool_allowlist.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P1.3 — Founder REST API: FastAPI Endpoints
- **Description:** Implement FastAPI service on :8000; endpoints for policy CRUD, workspace config, agent management
- **Depends On:** `[P1.1, P1.2]` (policy and tool allowlist engines)
- **FR Refs:** `FR-CP-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-CP-003 — Founder REST API..." --yolo
  ```
- **Acceptance Tests:**
  - GET /policies → 200 + list of policies
  - POST /policies → 201 + new policy_id
  - PUT /policies/{id} → 200 + updated policy
  - DELETE /policies/{id} → 204
  - POST /workspaces → 201 + workspace_id
  - GET /workspaces/{id} → 200 + workspace config
  - Unauthorized requests (no auth header) → 401 Unauthorized
  - Test: `pytest tests/test_founder_api.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P1.4 — FSM Framework: Workflow/Task/Action State Machines
- **Description:** Define FSM states and transitions; emit events on entry/exit; validate transitions
- **Depends On:** `[P0.5, P1.1]` (schema registry and policy engine for event binding)
- **FR Refs:** `FR-CP-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-CP-004 — FSM framework..." --yolo
  ```
- **Acceptance Tests:**
  - Workflow states: pending → scheduled → executing → completed|failed|revoked
  - Task states: pending → assigned → executing → completed|failed|revoked
  - Invalid transition (e.g., executing → pending) rejected with error
  - State entry/exit emits events: `workflow.started.v1`, `task.completed.v1`, etc.
  - FSM transitions are idempotent: same event twice = same result
  - Test: `pytest tests/test_fsm.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P1.5 — WebSocket Live Feed: Dashboard State Updates
- **Description:** Implement WebSocket endpoint on Founder API; broadcast state changes to subscribers
- **Depends On:** `[P1.3, P1.4]` (Founder API and FSM)
- **FR Refs:** `FR-CP-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-CP-005 — WebSocket live feed..." --yolo
  ```
- **Acceptance Tests:**
  - Client connects to `/ws/workflows/{workflow_id}`
  - Workflow state changes → event broadcast to all subscribers
  - Latency from state change to subscriber notification < 100ms
  - Client disconnect handled gracefully
  - Multiple subscribers to same workflow all receive events
  - Test: `pytest tests/test_websocket.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

### M1 Exit Criteria
1. Founder API responds on :8000
2. Policy bundling works: create v1 → v2, replay v1 produces same result
3. Tool allowlist blocks unauthorized calls
4. FSM validates transitions; rejects invalid ones
5. WebSocket broadcasts live; latency < 100ms
6. All control plane tests pass with ≥80% coverage
7. No data loss or race conditions under concurrent load

### M1 DAG Summary
```
P0.5 (schema registry) ──┐
                          ├─→ P1.1 (policy engine) ──┬─→ P1.3 (Founder API) ──┬─→ P1.5 (WebSocket)
P0.1 (database)        ──┘                           │                        │
                                                      ├─→ P1.2 (tool allowlist)
                                                      │
P1.4 (FSM) ─────────────────────────────────────────┘
```

---

## Phase 2: Agent Runtime (M2 — Weeks 5–6)

### Objective
Implement agent execution: L1/L2 orchestrator, L3 copilot pool, task envelope protocol, and tracer.

### Tasks

#### P2.1 — L1/L2 Orchestrator: Task Dispatch + Capability Filtering
- **Description:** Route tasks to agents based on required capabilities; apply policy checks before dispatch
- **Depends On:** `[P1.1, P1.2, P0.2]` (policy, tool allowlist, NATS)
- **FR Refs:** `FR-RT-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-RT-001 — L1/L2 orchestrator..." --yolo
  ```
- **Acceptance Tests:**
  - Task requires capability CAP_ARTIFACT → routed to agent with CAP_ARTIFACT
  - Task requires capability CAP_SPEND → policy check performed; if denied, task rejected
  - Task timeout after 5min → task marked failed; retry attempted
  - Concurrent tasks isolated (no state leakage between tasks)
  - Test: `pytest tests/test_orchestrator.py -v`
- **Complexity:** Large (L)
- **Estimate:** 3 days

#### P2.2 — L3 Copilot Pool: Worker Management + Health Monitoring
- **Description:** Spawn copilot processes; monitor health; collect logs; handle graceful shutdown
- **Depends On:** `[P0.2]` (NATS for task dispatch)
- **FR Refs:** `FR-RT-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-RT-002 — L3 copilot pool..." --yolo
  ```
- **Acceptance Tests:**
  - Pool spawns N workers (configurable; default 5)
  - Health check interval 10s; worker death detected within 10s
  - Dead worker removed from pool; replacement spawned
  - Worker logs captured to file and queryable
  - Graceful shutdown: active tasks allowed to complete; new tasks queued; pool stops
  - Test: `pytest tests/test_copilot_pool.py -v`
- **Complexity:** Large (L)
- **Estimate:** 3 days

#### P2.3 — Task Envelope: Context Injection (trace_id, workflow_id, agent_role, budget)
- **Description:** Wrap tasks with context before dispatch; inject into task envelope; propagate to all downstream calls
- **Depends On:** `[P0.5, P1.1]` (schema registry and policy engine)
- **FR Refs:** `FR-RT-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-RT-003 — Task envelope..." --yolo
  ```
- **Acceptance Tests:**
  - Task envelope includes: `task_id, workflow_id, trace_id, agent_role, policy_bundle_id, budget_cap, created_at`
  - Task execution includes envelope in all outgoing API calls
  - Nested tasks inherit trace_id but get new task_id
  - Budget enforcement: task cannot exceed cap (validated on every spend attempt)
  - Test: `pytest tests/test_task_envelope.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P2.4 — Tracer: Execution Logging + Deterministic Replay
- **Description:** Record all task inputs, outputs, and execution metadata; enable deterministic replay
- **Depends On:** `[P0.1, P2.3]` (database and task envelope)
- **FR Refs:** `FR-RT-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-RT-004 — Tracer..." --yolo
  ```
- **Acceptance Tests:**
  - Task execution logged: `trace_id, task_id, inputs, outputs, wall_time_ms, status`
  - Replay reads from log, reconstructs inputs, re-executes agent, compares outputs
  - Replay produces identical outputs if agent logic unchanged
  - Trace logs persisted to database and queryable by trace_id
  - Test: `pytest tests/test_tracer.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P2.5 — Integration: Orchestrator + Pool + Envelope + Tracer
- **Description:** Wire all four systems together; end-to-end test of agent execution
- **Depends On:** `[P2.1, P2.2, P2.3, P2.4]` (all subsystems)
- **FR Refs:** `FR-RT-005` (composite)
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-RT-005 — Runtime integration..." --yolo
  ```
- **Acceptance Tests:**
  - Task dispatched from orchestrator → pool routes to worker → envelope injected → tracer logs
  - 10 concurrent tasks execute; all complete; all traces logged
  - Agent death detected and logged; task retried
  - Replay verification: replay 5 tasks, outputs match original
  - Test: `pytest tests/test_runtime_integration.py -v`
- **Complexity:** Large (L)
- **Estimate:** 3 days

### M2 Exit Criteria
1. Agents spawn and execute tasks
2. Task envelope correctly propagates context
3. Traces logged deterministically
4. Replay verification passes
5. Agent death detected within 10s; task retried
6. Concurrent tasks isolated; no state leakage
7. All runtime tests pass with ≥80% coverage

### M2 DAG Summary
```
P1.1 (policy) ─┐
P1.2 (allowlist) ┼─→ P2.1 (orchestrator)
P0.2 (NATS) ──┘

P0.2 (NATS) ──→ P2.2 (copilot pool)

P0.5 (schema) ─┐
P1.1 (policy) ─┼─→ P2.3 (task envelope)

P0.1 (db) ──┐
P2.3 (envelope) ┼─→ P2.4 (tracer)

P2.1, P2.2, P2.3, P2.4 ──→ P2.5 (integration)
```

---

## Phase 3: Treasury (M3 — Weeks 7–8)

### Objective
Implement money controls: spend authorization, double-entry ledger, reconciliation, and compliance attestation.

### Tasks

#### P3.1 — Money Authorization API: Default-Deny Spend Model
- **Description:** Enforce that every spend requires valid `money_intent`; include reason_code and policy_bundle_id
- **Depends On:** `[P0.1, P1.1]` (database and policy engine)
- **FR Refs:** `FR-TRE-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-TRE-001 — Money authorization..." --yolo
  ```
- **Acceptance Tests:**
  - Spend without money_intent → 403 Forbidden + reason: "INTENT_MISSING"
  - Spend with expired intent → 403 Forbidden + reason: "INTENT_EXPIRED"
  - Spend within window and cap → 200 OK + `authorization_id`
  - Authorization decision logged with `policy_bundle_id` and `reason_code`
  - No fallback: if intent check fails, spend denied (never proceeds)
  - Test: `pytest tests/test_money_api.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P3.2 — Double-Entry Ledger: Immutable Transactions
- **Description:** Create debit + credit entry pairs; ensure ledger balances; immutable (no updates)
- **Depends On:** `[P0.1, P3.1]` (database and money API)
- **FR Refs:** `FR-TRE-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-TRE-002 — Double-entry ledger..." --yolo
  ```
- **Acceptance Tests:**
  - Spend of $100 creates: debit `assets.venture` $100, credit `expenses.spend` $100
  - Sum of all debits = sum of all credits (conservation invariant)
  - Ledger entries immutable; UPDATE attempt → error
  - Ledger query: GET /ledger?venture_id=X → all entries for venture
  - Test: `pytest tests/test_ledger.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P3.3 — Spend Authorization + Ledger Integration
- **Description:** Wire money API and ledger; every authorized spend creates ledger entries
- **Depends On:** `[P3.1, P3.2]` (money API and ledger)
- **FR Refs:** `FR-TRE-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-TRE-003 — Authorization and ledger integration..." --yolo
  ```
- **Acceptance Tests:**
  - Spend authorized → ledger entry created immediately
  - Ledger entry includes `authorization_id` for tracing
  - Spend transaction emits event: `money.spend.authorized.v1`
  - Reconciliation can link authorization → ledger → processor export
  - Test: `pytest tests/test_authorization_ledger.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P3.4 — Reconciliation Engine: Daily Drift Detection
- **Description:** Compare internal ledger with processor export daily; detect drift; create compliance case
- **Depends On:** `[P0.1, P3.2]` (database and ledger)
- **FR Refs:** `FR-TRE-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-TRE-004 — Reconciliation engine..." --yolo
  ```
- **Acceptance Tests:**
  - Daily reconciliation run compares ledger balance to processor balance
  - Drift < $0.01 → pass
  - Drift > $0.01 → compliance case created
  - Case tracked in database with date, amounts, status
  - Reconciliation is idempotent: running twice same day = same result
  - Test: `pytest tests/test_reconciliation.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P3.5 — Compliance Policy Gates: Jurisdiction + Category Controls
- **Description:** Block spend/outreach/data export based on jurisdiction and category rules
- **Depends On:** `[P0.1, P1.1]` (database and policy engine)
- **FR Refs:** `FR-TRE-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-TRE-005 — Compliance policy gates..." --yolo
  ```
- **Acceptance Tests:**
  - Policy: USA outreach only (block CA, EU, etc.)
  - Spend to CA → 403 Forbidden + reason: "JURISDICTION_BLOCKED"
  - Policy enforcement fail-closed: if policy unavailable, deny (never proceed)
  - Test: `pytest tests/test_compliance_gates.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

### M3 Exit Criteria
1. Unauthorized spends rejected with 403 Forbidden
2. Ledger balances: debit = credit
3. Reconciliation detects drift and creates case
4. Compliance policy enforces jurisdiction controls
5. No fallback on policy failure (fail-closed)
6. All treasury tests pass with ≥85% coverage
7. Audit trail complete: every spend logged with policy_bundle_id

### M3 DAG Summary
```
P0.1 (database) ──┐
P1.1 (policy) ────┼─→ P3.1 (money auth)
                  │
                  ├─→ P3.2 (ledger)
                  │
                  ├─→ P3.5 (compliance gates)

P3.1 (auth) ────┐
P3.2 (ledger) ──┼─→ P3.3 (integration)

P3.2 (ledger) ──→ P3.4 (reconciliation)
```

---

## Phase 4: Artifact Compiler (M4 — Weeks 9–10)

### Objective
Implement artifact IR and deterministic compilation: IR validation, build pipeline, provenance, and cache.

### Tasks

#### P4.1 — IR Schema Definitions: Slide/Doc/Timeline/Audio/Board
- **Description:** Define IR schemas for all artifact types; implement validation
- **Depends On:** `[P0.5]` (schema registry)
- **FR Refs:** `FR-ART-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-ART-001 — IR schema definitions..." --yolo
  ```
- **Acceptance Tests:**
  - SlideSpec validates: `layout, slides, styles, schema_version, content_hash, created_at`
  - DocSpec validates: `sections, constraints, citations, schema_version, content_hash, created_at`
  - TimelineSpec validates: `scenes, timing, transitions, narration, schema_version, content_hash, created_at`
  - AudioSpec validates: `voice_config, segments, timing, loudness, schema_version, content_hash, created_at`
  - BoardSpec validates: `objects, connectors, layers, animations, schema_version, content_hash, created_at`
  - Invalid spec rejected with clear error
  - Content hash computed deterministically (same content → same hash)
  - Test: `pytest tests/test_ir_schemas.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P4.2 — Compiler Pipeline: Spec → Render → Validate → Export
- **Description:** Orchestrate the build pipeline; manage intermediate artifacts; enforce determinism
- **Depends On:** `[P0.1, P4.1]` (database and IR schemas)
- **FR Refs:** `FR-ART-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-ART-002 — Compiler pipeline..." --yolo
  ```
- **Acceptance Tests:**
  - Build pipeline: spec → render → validate → export (all stages complete)
  - Same IR + toolchain = byte-identical output (determinism validated)
  - Build status tracked: pending → rendering → validating → exported → completed
  - Pipeline failure stops at failure stage; error logged
  - Test: `pytest tests/test_compiler_pipeline.py -v`
- **Complexity:** Large (L)
- **Estimate:** 3 days

#### P4.3 — Build Cache: Idempotency Key + Content Addressable
- **Description:** Cache builds by idempotency key; return cached output if available
- **Depends On:** `[P0.1, P4.2]` (database and pipeline)
- **FR Refs:** `FR-ART-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-ART-003 — Build cache..." --yolo
  ```
- **Acceptance Tests:**
  - Idempotency key = hash(IR, toolchain_version, policy_bundle_id, target_surface)
  - Build IR once → key K1 → output O1 stored in cache
  - Build same IR again → key K1 → cache hit → return O1 (byte-identical)
  - Different IR → key K2 → cache miss → build and store O2
  - Test: `pytest tests/test_build_cache.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P4.4 — Provenance Service: Sign + Verify Artifacts
- **Description:** Generate and sign provenance records; verify on import
- **Depends On:** `[P0.1, P4.2]` (database and pipeline)
- **FR Refs:** `FR-ART-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-ART-004 — Provenance service..." --yolo
  ```
- **Acceptance Tests:**
  - Build complete → provenance record created: `build_id, provider, model, timestamp, policy_bundle_id, signature`
  - Signature verifies correctly (not tampered)
  - Provenance record immutable; update attempt rejected
  - Provenance query: GET /provenance?build_id=X → full record with signature
  - Test: `pytest tests/test_provenance.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P4.5 — Replay Verification: Rebuild + Byte Comparison
- **Description:** Deterministically replay builds; verify outputs byte-identical to original
- **Depends On:** `[P4.2, P4.4]` (pipeline and provenance)
- **FR Refs:** `FR-ART-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-ART-005 — Replay verification..." --yolo
  ```
- **Acceptance Tests:**
  - Replay build from trace: IR + toolchain → rebuild artifact
  - Rebuilt artifact bytes identical to original (CRC check passes)
  - Replay verification emits event: `artifact.replay.verified.v1`
  - Failed replay logged with diff details
  - Test: `pytest tests/test_replay_verification.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

### M4 Exit Criteria
1. IR schemas validate correctly
2. Deterministic builds: same IR + toolchain = byte-identical output
3. Build cache works; cache hits return identical bytes
4. Provenance signature verifies
5. Replay verification passes
6. All compiler tests pass with ≥85% coverage
7. No fallback on schema validation; invalid IR fails hard

### M4 DAG Summary
```
P0.5 (schema registry) ──→ P4.1 (IR schemas)

P0.1 (database) ──┐
P4.1 (IR schemas) ├─→ P4.2 (pipeline)
                  │
P4.2 (pipeline) ──┼─→ P4.3 (cache)
                  │
                  ├─→ P4.4 (provenance)

P4.2, P4.4 ──→ P4.5 (replay)
```

---

## Phase 5: Venture Portfolio (M5 — Weeks 11–12)

### Objective
Implement venture portfolio management: venture registry, P&L tracking, portfolio optimizer, and tier enforcement.

### Tasks

#### P5.1 — Venture Registry: CRUD with Tier Assignment
- **Description:** Create, read, update, delete ventures; track founding capital and current tier
- **Depends On:** `[P0.1]` (database)
- **FR Refs:** `FR-PF-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-PF-001 — Venture registry..." --yolo
  ```
- **Acceptance Tests:**
  - POST /ventures → create venture with founding_capital, tier (STARTER|GROWTH|ENTERPRISE)
  - GET /ventures/{id} → return venture details
  - PUT /ventures/{id} → update tier
  - DELETE /ventures/{id} → delete venture
  - List /ventures → all ventures with P&L summary
  - Test: `pytest tests/test_venture_registry.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P5.2 — P&L Engine: Revenue — Spend = Profit Tracking
- **Description:** Calculate daily P&L per venture; aggregate portfolio P&L
- **Depends On:** `[P0.1, P3.2, P5.1]` (database, ledger, and venture registry)
- **FR Refs:** `FR-PF-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-PF-002 — P&L engine..." --yolo
  ```
- **Acceptance Tests:**
  - Daily P&L run aggregates ledger entries by venture
  - P&L = total_revenue - total_spend (verified against ledger)
  - P&L snapshot stored: `date, venture_id, revenue, spend, profit, created_at`
  - Portfolio P&L = sum of all venture P&Ls
  - Test: `pytest tests/test_pl_engine.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P5.3 — Health Score: P&L Ratio + Profitability Index
- **Description:** Calculate health score per venture: profit / founding_capital (0–1)
- **Depends On:** `[P5.1, P5.2]` (venture registry and P&L)
- **FR Refs:** `FR-PF-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-PF-003 — Health score..." --yolo
  ```
- **Acceptance Tests:**
  - Breakeven venture (profit=0) → health_score=0.5
  - Profitable venture (profit > 0) → health_score > 0.5
  - Loss-making venture (profit < 0) → health_score < 0.5
  - Health score persisted; queryable by venture_id and date
  - Test: `pytest tests/test_health_score.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P5.4 — Portfolio Optimizer: Recommend Tier Changes
- **Description:** Analyze cash position; recommend upgrade if cash > 2x tier limit, downgrade if < 0.5x
- **Depends On:** `[P5.2, P5.3]` (P&L and health score)
- **FR Refs:** `FR-PF-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-PF-004 — Portfolio optimizer..." --yolo
  ```
- **Acceptance Tests:**
  - STARTER tier limit: $100; GROWTH: $1000; ENTERPRISE: $10000
  - Venture with $250 cash (> 2x STARTER) → recommend GROWTH upgrade
  - Venture with $40 cash (< 0.5x GROWTH) → recommend STARTER downgrade
  - Recommendation logged with date and reasoning
  - Test: `pytest tests/test_optimizer.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P5.5 — Tier Spend Enforcement: Reject Overspend
- **Description:** Enforce per-tier spend limits; reject spend requests that exceed limit
- **Depends On:** `[P3.1, P5.1]` (money API and venture registry)
- **FR Refs:** `FR-PF-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-PF-005 — Tier spend enforcement..." --yolo
  ```
- **Acceptance Tests:**
  - STARTER tier venture with $80 spent, $20 remaining; spend $30 → 403 Forbidden
  - GROWTH tier venture with $500 spent, $500 remaining; spend $400 → 200 OK
  - Enforcement is fail-closed: if tier unavailable, deny spend
  - Test: `pytest tests/test_tier_enforcement.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

### M5 Exit Criteria
1. Ventures created and tracked with tiers
2. P&L accurate (profit = revenue - spend, matches ledger)
3. Portfolio optimizer recommends tier changes
4. Tier spend limits enforced; exceed → 403 Forbidden
5. Health score calculated correctly
6. All portfolio tests pass with ≥80% coverage
7. No fallback on tier enforcement

### M5 DAG Summary
```
P0.1 (database) ──┐
P3.2 (ledger) ────┼─→ P5.1 (registry) ──┐
                  │                      ├─→ P5.2 (P&L) ──┬─→ P5.3 (health) ──┬─→ P5.4 (optimizer)
                  │                      │                │
P5.1 (registry) ──┘                      └────────────────┴─→ P5.5 (enforcement)

P3.1 (money API) ──→ P5.5 (enforcement)
```

---

## Phase 6: Compliance + Hardening (M6 — Weeks 13–14)

### Objective
Implement full compliance infrastructure: audit trail, DSAR workflows, incident doctrine, and load testing.

### Tasks

#### P6.1 — Audit Trail: Append-Only Event Log
- **Description:** Create immutable audit log of all decisions, policy evaluations, and state changes
- **Depends On:** `[P0.1]` (database)
- **FR Refs:** `FR-HRD-001`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-HRD-001 — Audit trail..." --yolo
  ```
- **Acceptance Tests:**
  - Audit entry created for: spend authorization, policy evaluation, state transition, tool call
  - Entry fields: `id, entity_id, action, actor, reason_code, policy_bundle_id, created_at`
  - Audit log immutable; UPDATE/DELETE attempt rejected
  - Audit query: GET /audit?entity_id=X → all actions on entity
  - Test: `pytest tests/test_audit_trail.py -v`
- **Complexity:** Small (S)
- **Estimate:** 1 day

#### P6.2 — DSAR Orchestration: Delete Subject Data
- **Description:** Implement DSAR request workflow; delete or return all user data; track completion
- **Depends On:** `[P0.1, P6.1]` (database and audit trail)
- **FR Refs:** `FR-HRD-002`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-HRD-002 — DSAR orchestration..." --yolo
  ```
- **Acceptance Tests:**
  - POST /dsar with subject_id → create request with due_date (24h from now)
  - DSAR processor finds all subject records; deletes or returns per law
  - Status tracked: pending → processing → completed
  - Completion confirmed with deletion_count and completion_timestamp
  - Test: `pytest tests/test_dsar.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P6.3 — Incident Classification + Response Automation
- **Description:** Classify incidents (overspend, unauthorized tool, data breach, policy failure); execute playbooks
- **Depends On:** `[P0.1, P1.1]` (database and policy engine)
- **FR Refs:** `FR-HRD-003`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-HRD-003 — Incident response..." --yolo
  ```
- **Acceptance Tests:**
  - Incident classes: OVERSPEND, UNAUTHORIZED_TOOL, DATA_BREACH, POLICY_FAILURE
  - Detection → classification → playbook execution (no manual intervention)
  - Playbooks: OVERSPEND freezes workflow; UNAUTHORIZED_TOOL revokes capability; etc.
  - Playbook execution idempotent: run twice = same result
  - Test: `pytest tests/test_incident_response.py -v`
- **Complexity:** Medium (M)
- **Estimate:** 2 days

#### P6.4 — Test Coverage Audit + Gap Filling
- **Description:** Run full coverage report; identify gaps; write tests for uncovered code
- **Depends On:** `[P0–P5]` (all prior phases)
- **FR Refs:** `FR-HRD-004`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-HRD-004 — Test coverage..." --yolo
  ```
- **Acceptance Tests:**
  - Coverage report: `pytest --cov=src --cov-report=term-missing`
  - Coverage ≥95% across all modules (excluding __main__ and test helpers)
  - No test suppressions (`# noqa`, `# pragma: no cover`) without inline justification
  - Test: all tests pass; coverage reported
- **Complexity:** Large (L)
- **Estimate:** 3 days

#### P6.5 — Load Test: 1000 Concurrent Agents
- **Description:** Stress test system with 1000 concurrent agents; measure latency and throughput
- **Depends On:** `[P2.5, P3.3]` (runtime integration and treasury)
- **FR Refs:** `FR-HRD-005`
- **L3 Copilot Dispatch:**
  ```bash
  copilot -p "Task: FR-HRD-005 — Load test..." --yolo
  ```
- **Acceptance Tests:**
  - Load test: spawn 1000 agents, each runs 10 tasks (10k tasks total)
  - Measure: latency p50, p95, p99; throughput (tasks/sec); errors
  - Acceptance: p99 latency < 5s, throughput > 100 tasks/sec, zero timeouts
  - Reconciliation passes after load test (no data loss)
  - Test: `uv run tests/load_test.py --agents 1000`
- **Complexity:** Large (L)
- **Estimate:** 3 days

### M6 Exit Criteria
1. Audit trail append-only and tamper-evident
2. DSAR processed in <24h; all data deleted
3. Incident classification and playbooks automated
4. Test coverage ≥95% across all modules
5. Load test passes: 1000 agents, p99 latency <5s
6. Reconciliation passes after load test (no data loss)
7. All M0–M6 systems integrated and stable

### M6 DAG Summary
```
P0.1 (database) ──┐
                  ├─→ P6.1 (audit trail)
P1.1 (policy) ────┼─→ P6.3 (incident response)

P6.1 (audit) ──→ P6.2 (DSAR)

[All P0–P5] ──→ P6.4 (coverage)

P2.5, P3.3 ──→ P6.5 (load test)
```

---

## Complete DAG (All Phases)

```
Foundation (M0):
  P0.1 (PostgreSQL), P0.2 (NATS), P0.3 (Redis) ──→ P0.4 (process-compose)
  P0.2 (NATS), P0.4 ──→ P0.5 (schema registry)

Control Plane (M1):
  P0.5, P0.1 ──→ P1.1 (policy) ──→ P1.3 (API)
  P1.1 ──→ P1.2 (allowlist) ──→ P1.3
  P0.5, P1.1 ──→ P1.4 (FSM)
  P1.3, P1.4 ──→ P1.5 (WebSocket)

Runtime (M2):
  P1.1, P1.2, P0.2 ──→ P2.1 (orchestrator)
  P0.2 ──→ P2.2 (copilot pool)
  P0.5, P1.1 ──→ P2.3 (envelope)
  P0.1, P2.3 ──→ P2.4 (tracer)
  P2.1, P2.2, P2.3, P2.4 ──→ P2.5 (integration)

Treasury (M3):
  P0.1, P1.1 ──→ P3.1 (money auth)
  P0.1 ──→ P3.2 (ledger)
  P1.1 ──→ P3.5 (compliance gates)
  P3.1, P3.2 ──→ P3.3 (integration)
  P3.2 ──→ P3.4 (reconciliation)

Compiler (M4):
  P0.5 ──→ P4.1 (IR schemas)
  P0.1, P4.1 ──→ P4.2 (pipeline)
  P4.2 ──→ P4.3 (cache)
  P4.2 ──→ P4.4 (provenance)
  P4.2, P4.4 ──→ P4.5 (replay)

Portfolio (M5):
  P0.1 ──→ P5.1 (registry)
  P0.1, P3.2, P5.1 ──→ P5.2 (P&L)
  P5.1, P5.2 ──→ P5.3 (health)
  P5.2, P5.3 ──→ P5.4 (optimizer)
  P3.1, P5.1 ──→ P5.5 (enforcement)

Compliance (M6):
  P0.1 ──→ P6.1 (audit)
  P0.1, P6.1 ──→ P6.2 (DSAR)
  P0.1, P1.1 ──→ P6.3 (incident)
  [All P0–P5] ──→ P6.4 (coverage)
  P2.5, P3.3 ──→ P6.5 (load test)
```

---

## Summary Table: All Tasks

| Phase | Task ID | Description | Complexity | Estimate | Depends On | FRs |
|-------|---------|-------------|-----------|----------|-----------|-----|
| M0 | P0.1 | PostgreSQL + Alembic migrations | M | 1–2d | — | FR-INFRA-001 |
| M0 | P0.2 | NATS JetStream streams | M | 1–2d | — | FR-INFRA-002 |
| M0 | P0.3 | Redis + rate limiter | S | 1d | — | FR-INFRA-003 |
| M0 | P0.4 | process-compose manifest | S | 1d | P0.1–P0.3 | FR-INFRA-004 |
| M0 | P0.5 | Schema registry + validation | M | 1–2d | P0.2, P0.4 | FR-INFRA-005 |
| M1 | P1.1 | Policy engine + versioning | M | 2d | P0.1, P0.5 | FR-CP-001 |
| M1 | P1.2 | Tool allowlist engine | S | 1d | P0.1, P1.1 | FR-CP-002 |
| M1 | P1.3 | Founder REST API | M | 2d | P1.1, P1.2 | FR-CP-003 |
| M1 | P1.4 | FSM framework | M | 2d | P0.5, P1.1 | FR-CP-004 |
| M1 | P1.5 | WebSocket live feed | S | 1d | P1.3, P1.4 | FR-CP-005 |
| M2 | P2.1 | L1/L2 orchestrator | L | 3d | P1.1, P1.2, P0.2 | FR-RT-001 |
| M2 | P2.2 | L3 copilot pool | L | 3d | P0.2 | FR-RT-002 |
| M2 | P2.3 | Task envelope | M | 2d | P0.5, P1.1 | FR-RT-003 |
| M2 | P2.4 | Tracer | M | 2d | P0.1, P2.3 | FR-RT-004 |
| M2 | P2.5 | Runtime integration | L | 3d | P2.1–P2.4 | FR-RT-005 |
| M3 | P3.1 | Money authorization API | M | 2d | P0.1, P1.1 | FR-TRE-001 |
| M3 | P3.2 | Double-entry ledger | M | 2d | P0.1, P3.1 | FR-TRE-002 |
| M3 | P3.3 | Authorization + ledger integration | S | 1d | P3.1, P3.2 | FR-TRE-003 |
| M3 | P3.4 | Reconciliation engine | M | 2d | P0.1, P3.2 | FR-TRE-004 |
| M3 | P3.5 | Compliance policy gates | S | 1d | P0.1, P1.1 | FR-TRE-005 |
| M4 | P4.1 | IR schema definitions | M | 2d | P0.5 | FR-ART-001 |
| M4 | P4.2 | Compiler pipeline | L | 3d | P0.1, P4.1 | FR-ART-002 |
| M4 | P4.3 | Build cache | M | 2d | P0.1, P4.2 | FR-ART-003 |
| M4 | P4.4 | Provenance service | M | 2d | P0.1, P4.2 | FR-ART-004 |
| M4 | P4.5 | Replay verification | M | 2d | P4.2, P4.4 | FR-ART-005 |
| M5 | P5.1 | Venture registry | S | 1d | P0.1 | FR-PF-001 |
| M5 | P5.2 | P&L engine | S | 1d | P0.1, P3.2, P5.1 | FR-PF-002 |
| M5 | P5.3 | Health score | S | 1d | P5.1, P5.2 | FR-PF-003 |
| M5 | P5.4 | Portfolio optimizer | S | 1d | P5.2, P5.3 | FR-PF-004 |
| M5 | P5.5 | Tier spend enforcement | S | 1d | P3.1, P5.1 | FR-PF-005 |
| M6 | P6.1 | Audit trail | S | 1d | P0.1 | FR-HRD-001 |
| M6 | P6.2 | DSAR orchestration | M | 2d | P0.1, P6.1 | FR-HRD-002 |
| M6 | P6.3 | Incident response | M | 2d | P0.1, P1.1 | FR-HRD-003 |
| M6 | P6.4 | Test coverage | L | 3d | P0–P5 | FR-HRD-004 |
| M6 | P6.5 | Load test | L | 3d | P2.5, P3.3 | FR-HRD-005 |

**Total Tasks:** 35
**Total Estimate:** 72–82 days (wall-clock: 12–14 weeks with parallel L3 agents)

---

## Parallel Execution Strategy

Each milestone can execute multiple L3 agents in parallel:

- **M0:** 3 agents (PostgreSQL, NATS, schema registry)
- **M1:** 3 agents (policy, allowlist, API + FSM + WebSocket)
- **M2:** 3 agents (orchestrator, copilot pool, envelope + tracer + integration)
- **M3:** 3 agents (money auth, ledger, reconciliation + compliance + integration)
- **M4:** 3 agents (IR schemas, pipeline + cache, provenance + replay)
- **M5:** 3 agents (registry, P&L + health, optimizer + enforcement)
- **M6:** 3 agents (audit + DSAR, incident response, coverage + load test)

**Parallel Factor:** 3× per milestone; total wall-clock = 12–14 weeks

---

## Review and Merge Strategy

For each milestone:
1. **L3 agents commit to worktrees** (e.g., `venture-wt-m0-foundation`)
2. **User reviews** via `git show` and `git diff`
3. **User merges** worktree back to main: `git switch main && git merge venture-wt-m0-foundation`
4. **CI runs:** All tests, linters, coverage checks
5. **Gate:** If any test fails, merge blocked until fixed
6. **Next milestone** starts after merge

---

## Success Metrics (Post-Delivery)

- All 35 tasks completed with passing tests
- Coverage ≥95% across all modules
- Load test passes: 1000 agents, p99 < 5s
- Zero data loss: reconciliation passes
- Audit trail complete: every decision logged with policy_bundle_id
- DSAR executable in <24h
- All specs linked and cross-referenced
- Zero suppressions in codebase

---

**Plan Status:** ACTIVE
**Last Updated:** 2026-02-21
**Next Review:** Post-M0 (end of week 2)
