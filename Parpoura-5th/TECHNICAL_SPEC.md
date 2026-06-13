# Venture-Autonomy Technical Specification v2

## Executive Summary

Venture is an autonomous AI economic civilization built on process-compose, where L1 orchestrator, L2 specialist agents, and L3 copilot CLI workers execute high-value labor tasks (writing, code, research, data services). All agent actions flow through a unified policy engine, emit immutable events to an append-only ledger, and generate revenue through agent labor sales. The platform operates on event sourcing (no CRUD for state), with authorization, compliance, and financial controls woven into every operation.

**Stack**: Python (FastAPI/FastMCP) + PostgreSQL + NATS JetStream + Redis + process-compose
**Deployment Model**: process-compose orchestration for local development and single-node deployment; multi-node via NATS clustering, PG replication, and horizontal agent pool scaling.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FOUNDER CONTROL PLANE (REST + WebSocket)            │
│                         control-plane-api (:8000)                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ (founders: task intent, policy publish, kill-switch)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     POLICY & VALIDATION LAYER                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  policy-engine (:8001)   ◄─────► Redis cache (:6379)              │ │
│  │  - Tool allowlist checks                                          │ │
│  │  - Intent validation against schema registry                      │ │
│  │  - Workload identity + credential validation                      │ │
│  │  - Prompt injection defense                                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  compliance-engine (:8004)                                         │ │
│  │  - Policy rule evaluation                                          │ │
│  │  - Audit trail validation                                          │ │
│  │  - Privacy operations (DSAR, deletion)                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────┬──────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────┐
        │                                 │                              │
        ▼                                 ▼                              ▼
┌──────────────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│  TASK ENVELOPE & DISPATCH    │  │   TREASURY LAYER     │  │  ARTIFACT LAYER │
│  venture-orchestrator (:8005)│  │  treasury-api (:8003)│  │artifact-compiler│
│ ┌──────────────────────────┐ │  │ ┌──────────────────┐ │  │    (:8002)      │
│ │ - Portfolio mgmt         │ │  │ │ - Auth decisions │ │  │ ┌─────────────┐ │
│ │ - Workstream DAG         │ │  │ │ - Double-entry  │ │  │ │ IR schemas: │ │
│ │ - L1/L2/L3 dispatch      │ │  │ │   ledger        │ │  │ │ - SlideSpec │ │
│ │ - Task queue mgmt        │ │  │ │ - Velocity ctrl │ │  │ │ - DocSpec   │ │
│ │ - Queue monitoring       │ │  │ │ - Recon         │ │  │ │ - Timeline  │ │
│ └──────────────────────────┘ │  │ │                  │ │  │ │ - Audio     │ │
└──────────────────────────────┘  │ │ - Merchant/cat  │ │  │ │ - Board     │ │
                                   │ │   controls      │ │  │ │ - etc.      │ │
                                   │ └──────────────────┘ │  │ └─────────────┘ │
                                   │                      │  │ ┌─────────────┐ │
                                   │ ┌──────────────────┐ │  │ │ Build pipe: │ │
                                   │ │ Money intent &  │ │  │ │ - Validate  │ │
                                   │ │ auth events     │ │  │ │ - Render    │ │
                                   │ └──────────────────┘ │  │ │ - Export    │ │
                                   └──────────────────────┘  │ │ - Prov.     │ │
                                                             │ └─────────────┘ │
                                                             └─────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  EVENT BUS & STATE LEDGER (Event Sourcing)               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  NATS JetStream (:4222)  – immutable event streams                │ │
│  │  - policy.* streams      - workflow.* streams                    │ │
│  │  - task.* streams        - artifact.* streams                   │ │
│  │  - money.* streams       - compliance.* streams                 │ │
│  │  - privacy.* streams     - audit.* streams                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Ledger DB (:5432) – event store + projections          │ │
│  │  - events table (append-only)                                      │ │
│  │  - projections: workflows, tasks, agents, ledger, compliance      │ │
│  │  - checksum integrity tracking                                     │ │
│  │  - policy bundle versions                                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
        ▲
        │
┌───────┴──────────────────────────────────────────────────────────────────┐
│                      AGENT RUNTIME & TOOL LAYER                          │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ agent-runtime (Python, workers)                                    │  │
│ │ ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│ │ │ L1: Orch     │  │ L2: Spec     │  │ L3: Copilot CLI Pool     │  │  │
│ │ │ - Portfolio  │  │ - Writer     │  │ copilot -p "..." --yolo  │  │  │
│ │ │   mgmt       │  │ - Coder      │  │  --model gpt-5-mini &    │  │  │
│ │ │ - DAG exec   │  │ - Researcher │  │ ┌──────────────────────┐ │  │  │
│ │ │ - Workstream │  │ - Analyst    │  │ │ Max concurrency: N   │ │  │  │
│ │ │ - Dispatch   │  │              │  │ │ Queue depth: 100     │ │  │  │
│ │ │              │  │              │  │ │ Timeout: 30m         │ │  │  │
│ │ │              │  │              │  │ │ Commit sidecar       │ │  │  │
│ │ │              │  │              │  │ │ Result capture       │ │  │  │
│ │ │              │  │              │  │ └──────────────────────┘ │  │  │
│ │ └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│ │                                                                    │  │
│ │ Dispatch pattern: task_envelope → policy check → (L1/L2 direct    │  │
│ │                  or L3 spawn) → result capture → event emit       │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ TOOL LAYER (FastMCP + Constraint Sandbox)                         │  │
│ │ - Allowlist enforcement per agent role                             │  │
│ │ - Tool I/O sandboxing                                              │ │
│ │ - External content isolation                                       │  │
│ │ - Tool call auditing (all logged to events)                        │  │
│ │ Tools (examples):                                                  │  │
│ │   - io.read, io.write (filesystem, gated)                          │  │
│ │   - web.fetch (allowlisted domains, caching)                       │  │
│ │   - artifact.render (artifact compiler calls)                      │  │
│ │   - policy.evaluate (introspection)                                │  │
│ │   - workflow.dispatch (sub-task creation)                          │  │
│ │   - event.publish (event emission)                                 │  │
│ │   - git.* (version control sidecar)                                │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
        ▲
        │
┌───────┴──────────────────────────────────────────────────────────────────┐
│                        EXTERNAL INTEGRATIONS                             │
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐   │
│  │ Claude API   │  │ GPT-5-mini   │  │ Veo/Banana   │  │ Web APIs   │   │
│  │ (artifact    │  │ (L3 agents)  │  │ (video)      │  │ (services) │   │
│  │  generation) │  │              │  │              │  │            │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Service Inventory

All services run under process-compose orchestration with inter-service communication via HTTP (REST), gRPC, or NATS.

| Service Name | Port | Language | Responsibility | Scaling | Dependencies |
|---|---|---|---|---|---|
| **control-plane-api** | 8000 | Python/FastAPI | Founder-facing REST + WebSocket; task submission; policy publishing; kill-switch; freeze controls | 1 replica (bottleneck = founder ops rate) | policy-engine, venture-orchestrator, ledger-db, redis |
| **policy-engine** | 8001 | Python/FastAPI | Tool allowlist enforcement; intent validation; schema registry; workload identity verification; prompt injection defense | Horizontal (cache layer via Redis) | redis, ledger-db |
| **artifact-compiler** | 8002 | Python/FastMCP | Headless artifact IR rendering; spec validation; build pipeline (spec → render → export); provenance attachment | Horizontal (queue depth monitoring) | ledger-db, event-bus, redis, external APIs (Claude, Veo, Banana) |
| **treasury-api** | 8003 | Python/FastAPI | Authorization decisions; double-entry ledger; velocity controls; merchant/category authorization; idempotent payment events; reconciliation | 1 replica (state: ledger + auth queue) | ledger-db, event-bus, policy-engine |
| **compliance-engine** | 8004 | Python/FastAPI | Policy rule evaluation; audit trail validation; DSAR processing; privacy deletions; incident classification | 2 replicas (read-heavy) | ledger-db, event-bus, redis |
| **venture-orchestrator** | 8005 | Python/FastAPI | Portfolio management; workstream DAG execution; L1/L2/L3 task dispatch; task queue management; monitoring/alerting | 2 replicas (read-heavy task dispatch) | ledger-db, event-bus, agent-runtime, redis |
| **agent-runtime** | — | Python | L1 (portfolio orchestrator), L2 (specialist agents: writer, coder, researcher, analyst), L3 (copilot CLI worker pool); task execution; result capture | Horizontal (worker pool, N instances) | policy-engine, tool-layer, event-bus, ledger-db, redis |
| **event-bus** (NATS JetStream) | 4222 | Go/Rust | Immutable event streams; topic fan-out; consumer group management; event replay; event persistence | 1 node (cluster for HA) | postgres (persistence backend) |
| **ledger-db** (PostgreSQL) | 5432 | SQL | Event store (append-only events table); read projections; state snapshots; schema registry; policy bundles; audit logs; checksum integrity | 1 primary + 1 replica (HA) | — |
| **redis-cache** | 6379 | C | Agent state cache; tool call rate limits; idempotency keys; session store; policy cache; hot data | 1 node (sentinel for HA) | — |

### Service Dependencies Graph

```
control-plane-api
  ├── policy-engine
  ├── venture-orchestrator
  ├── ledger-db
  └── redis-cache

policy-engine
  ├── redis-cache
  └── ledger-db

artifact-compiler
  ├── ledger-db
  ├── event-bus
  ├── redis-cache
  ├── Claude API (external)
  └── Veo/Banana (external)

treasury-api
  ├── ledger-db
  ├── event-bus
  └── policy-engine

compliance-engine
  ├── ledger-db
  ├── event-bus
  └── redis-cache

venture-orchestrator
  ├── ledger-db
  ├── event-bus
  ├── agent-runtime
  └── redis-cache

agent-runtime
  ├── policy-engine
  ├── event-bus
  ├── ledger-db
  ├── redis-cache
  └── (spawns L3 copilot CLI processes)

event-bus (NATS JetStream)
  └── ledger-db (backing store)

redis-cache
  └── (no inbound dependencies)

ledger-db
  └── (no inbound dependencies)
```

---

## Data Flow: Intent → Result

```
1. FOUNDER INTENT (WebSocket)
   ├─ control-plane-api receives task_envelope
   │  - task_id, workflow_id, task_type, input, agent_role, created_at
   └─ emit: control.task.submitted.v1 (event-bus)

2. POLICY VALIDATION (synchronous)
   ├─ policy-engine.validate(intent, agent_role)
   │  - schema validation (task_type against registry)
   │  - tool allowlist check (agent_role → permitted tools)
   │  - workload identity verification (short-lived cred check)
   │  - prompt injection defense (input sanitization)
   └─ result: APPROVED or DENIED
   └─ emit: policy.evaluated.v1 (event-bus)

3A. IF MONEY REQUIRED (e.g., artifact or service purchase)
   ├─ treasury-api.create_intent(workflow_id, amount, merchant_scope, ttl)
   │  - DEFAULT-DENY: unless explicitly authorized
   │  - check rate limits (redis) and velocity controls
   ├─ emit: money.intent.created.v1 (event-bus)
   ├─ treasury-api.authorize(money_intent_id) → authorization_decision
   │  - check budget caps per workspace/workflow
   │  - check merchant/category allowlists
   │  - emit: money.authorization.decided.v1 (event-bus)
   └─ await APPROVED before proceeding

3B. ARTIFACT GENERATION (if applicable)
   ├─ artifact-compiler.register_ir(ir_spec)
   │  - validate IR schema (SlideSpec, DocSpec, etc.)
   │  - compute content_hash, inputs_hash
   │  - emit: artifact.ir.registered.v1
   ├─ artifact-compiler.build(ir_id, policy_bundle_id, target_surface)
   │  - check idempotency cache (redis, keyed by ir_hash + toolchain_version)
   │  - validate + render + export
   │  - emit: artifact.build.started.v1, artifact.build.completed.v1
   └─ artifact-compiler.attest_provenance(build_id)
       - attach signatures and provider metadata
       - emit: artifact.provenance.attested.v1

4. AGENT DISPATCH
   ├─ venture-orchestrator.dispatch(task_envelope, policy_bundle_id)
   │  - query agent-runtime for available L1/L2/L3 slots
   │  - for L1/L2: direct in-process call
   │  - for L3: spawn copilot -p "{task_envelope_json}" --yolo --model gpt-5-mini &
   ├─ emit: task.dispatch.initiated.v1 (event-bus)
   │
   └─ AGENT EXECUTION
      ├─ agent receives task_envelope, queries policy-engine for tool allowlist
      ├─ agent iterates: decide_next_action → check_tool_allowed → call_tool → emit_event
      ├─ tools emit tool.call.executed.v1 (event-bus) with inputs + outputs
      ├─ L3 capture: stdout parsed as JSON result, git commits captured as sidecar
      ├─ agent completes: emit task.completed.v1 (event-bus)
      └─ result_hash, output summary stored in event payload

5. LEDGER & PROJECTION (async event subscribers)
   ├─ ledger-db consumes all events from event-bus
   ├─ append events to events table (immutable)
   ├─ materialize projections:
   │  - workflows, tasks, agent_actions, money_intents, ledger_entries, compliance_cases
   ├─ compute checksums, store in audit_checkpoints
   └─ emit: ledger.materialized.v1

6. COMPLIANCE & AUDIT CHECK (async)
   ├─ compliance-engine subscribes to policy.evaluated.v1, task.completed.v1, money.authorization.decided.v1
   ├─ evaluate policy rules:
   │  - tool usage vs. allowlist
   │  - spend vs. caps
   │  - privacy rules
   ├─ if violation detected: emit compliance.violation.detected.v1
   │  - trigger incident escalation or auto-freeze
   └─ append to audit_trail projection

7. RESULT DELIVERY (WebSocket → founder)
   ├─ venture-orchestrator subscribes to task.completed.v1
   ├─ enrich with metadata: tool calls, cost, duration, artifact links
   └─ push result_envelope to founder via WebSocket

8. SETTLED STATE
   └─ All events durably stored in event-bus (NATS persistence) + ledger-db (PostgreSQL)
   └─ Founder can query projections via GET /workflows/{id}, GET /tasks/{id}, GET /ledger
   └─ Audit trail immutable and tamper-evident (checksums)
```

---

## Agent Runtime Architecture

The agent runtime is a hierarchical, distributed system with three levels:

### L1: Portfolio Orchestrator
- Responsible for long-term portfolio planning, workstream DAG execution, and resource allocation.
- Runs as a persistent L2-class agent within agent-runtime.
- Responsibilities:
  - Maintains workstream DAG and task dependency graph.
  - Monitors L2/L3 capacity and dispatches new tasks.
  - Negotiates budget allocation among active workflows.
  - Escalates to founder control plane for policy changes or incident responses.
- Communication: reads task queue from ledger-db, emits task.dispatch.initiated.v1 events, subscribes to task completion events.

### L2: Specialist Agents
- Deep domain expertise agents running within agent-runtime process space.
- Types: Writer, Coder, Researcher, Analyst.
- Responsibilities (per type):
  - **Writer**: content generation (blog posts, documentation, marketing copy, user journeys).
  - **Coder**: code generation, refactoring, debugging, test writing.
  - **Researcher**: data collection, literature reviews, market analysis.
  - **Analyst**: data analysis, insights generation, report writing.
- Communication: receive task_envelope, call tools (policy-gated), emit tool.call.executed.v1, emit task.completed.v1.
- Scaling: L2 agents are thread-pooled within agent-runtime; horizontal scaling via additional agent-runtime replicas.

### L3: Copilot CLI Worker Pool
- Stateless, disposable agent workers spawned on demand via shell.
- Pattern:
  ```bash
  copilot -p '{"task_id":"...", "input":"...", ...}' \
    --yolo \
    --model gpt-5-mini \
    --add-dir {workspace} \
    &
  ```
- Responsibilities:
  - Execute ad-hoc, time-limited tasks (e.g., "write a function", "debug this error").
  - Commit results to git (sidecar monitoring).
  - Report results via stdout (JSON).
- Pool management (venture-orchestrator):
  - **Max concurrency**: N workers (configurable, default 10).
  - **Queue depth**: up to 100 pending tasks (backpressure).
  - **Timeout**: 30 minutes per task (hard kill).
  - **Result capture**: poll stdout, parse JSON, store in ledger-db.
  - **Failure handling**: retry up to 3 times, then escalate to L2.

### Dispatch Decision Logic

When a task arrives at venture-orchestrator:

1. **Extract task_type and complexity estimate** from task_envelope.
2. **Route decision**:
   - If task is **deterministic, short-lived, high-volume**: dispatch to L3 pool.
   - If task requires **stateful reasoning, tool chaining, or recovery**: dispatch to L2.
   - If task is **portfolio-level** (e.g., new workstream, resource reallocation): escalate to L1.
3. **Availability check**: query redis for agent availability (cached slot counts).
4. **Emit task.dispatch.initiated.v1** with selected agent role and dispatch ID.
5. **Execute**:
   - L1/L2: direct function call (in-process).
   - L3: spawn subprocess, set timeout, attach result listener.
6. **Capture result**: emit task.completed.v1 with result_hash, output, tool calls.

### Tool Layer

All agent actions are mediated by a constraint sandbox:

- **Tool allowlist per agent_role** (policy-engine).
  - Example L3 role tools: `{io.read, io.write, artifact.render, web.fetch, git.commit}`.
  - Example L2-Coder tools: `{io.read, io.write, artifact.render, web.fetch, git.*, python.exec}` (stricter than L3).
- **Tool call auditing**: every tool.call.executed.v1 event includes:
  - tool_name, input (sanitized), output_hash, duration_ms, status (OK/ERROR).
- **External content isolation**:
  - Tool outputs are piped to a validator before being returned to agent.
  - Prompt injection defense: inputs are sanitized before reaching policies.
- **Tool failure handling**:
  - Transient errors (e.g., network timeout) trigger retry with exponential backoff (via tenacity library).
  - Permanent errors (e.g., permission denied) emit error event and escalate to L2/L1.

---

## Event Sourcing Model

Venture uses event sourcing for all state: there is no CRUD API for state; all state changes emit immutable events.

### Event Schema

All events conform to EventEnvelopeV1:

```json
{
  "event_id": "evt-{uuid}",
  "event_type": "policy.published.v1",
  "trace_id": "{uuid}",
  "workflow_id": "{uuid}",
  "task_id": "{uuid}",
  "policy_bundle_id": "{uuid}",
  "created_at": "2026-02-21T10:30:45.123Z",
  "payload": {
    "...event-specific fields..."
  }
}
```

### Event Stream Topics (NATS JetStream)

| Topic | Consumer Groups | Payload Type | Emitter | Subscribers |
|---|---|---|---|---|
| `policy.>` | policy-engine, audit | policy_bundle, policy_version, rules | control-plane-api, policy-engine | compliance-engine, ledger-db |
| `workflow.>` | orchestrator, audit | workflow_id, objective, status | venture-orchestrator, control-plane-api | ledger-db, compliance-engine |
| `task.>` | orchestrator, audit | task_id, type, input, agent_role, status | venture-orchestrator, agent-runtime | ledger-db, compliance-engine |
| `artifact.>` | artifact-compiler, audit | ir_id, build_id, status, provenance | artifact-compiler | ledger-db, artifact-compiler (for replay) |
| `money.>` | treasury, audit | money_intent_id, amount, decision | treasury-api | ledger-db, compliance-engine |
| `ledger.>` | audit | entry_type, amount, external_ref | treasury-api, agent-runtime | ledger-db |
| `compliance.>` | audit, compliance | violation_type, severity, workflow_id | compliance-engine | ledger-db |
| `privacy.>` | audit, compliance | request_type, subject_ref, status | compliance-engine | ledger-db |
| `audit.>` | audit-archive | checksum, event_id_range, timestamp | ledger-db (projection) | (archive only) |

### Event Sourcing Invariants

1. **Immutability**: once emitted, events never change or delete.
2. **Append-only ledger**: events table in PostgreSQL has insert-only permissions.
3. **Causality**: every event includes trace_id and workflow_id to reconstruct causal chains.
4. **Idempotency**: duplicate events (same event_id) are deduplicated by ledger-db.
5. **Replay protocol**: any consumer can replay events from any offset to reconstruct full state.

### Checksum Integrity Tracking

Every event batch (e.g., hourly) is checksummed:

```sql
INSERT INTO audit_checkpoints (batch_id, event_id_start, event_id_end, checksum, created_at)
VALUES (...);
```

Periodic attestation (daily) verifies checksums; if mismatch detected, emit compliance.violation.detected.v1 and freeze system.

---

## Treasury Architecture

The Treasury subsystem is the financial control plane. It operates on a double-entry ledger model with authorization gates.

### Data Model

```sql
CREATE TABLE money_intents (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows,
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  merchant_scope TEXT,
  category TEXT,
  ttl_seconds INT DEFAULT 3600,
  status TEXT ('CREATED', 'AUTHORIZED', 'DENIED', 'EXPIRED', 'SETTLED'),
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE authorization_decisions (
  id UUID PRIMARY KEY,
  money_intent_id UUID REFERENCES money_intents,
  decision TEXT ('APPROVED', 'DENIED'),
  reason_code TEXT,
  approved_by TEXT, -- 'auto' or agent_role
  created_at TIMESTAMP
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows,
  entry_type TEXT ('REVENUE', 'COST', 'TRANSFER', 'REFUND'),
  amount_cents BIGINT,
  currency CHAR(3),
  account_from TEXT, -- 'venture-treasury', 'workflow-X', 'external-buyer'
  account_to TEXT,
  external_ref TEXT,
  policy_bundle_id UUID,
  created_at TIMESTAMP
);

CREATE TABLE ledger_entries_posting (
  id UUID PRIMARY KEY,
  parent_entry_id UUID REFERENCES ledger_entries,
  debit_account TEXT,
  debit_cents BIGINT,
  credit_account TEXT,
  credit_cents BIGINT,
  created_at TIMESTAMP
);
```

### Authorization Flow

```
1. Agent task generates money_intent
   ├─ call: treasury-api.create_intent(workflow_id, amount_cents, merchant_scope, ttl)
   ├─ emit: money.intent.created.v1
   └─ stored: money_intents row (status=CREATED)

2. Policy evaluation (default-deny)
   ├─ check: amount <= per_workflow_cap
   ├─ check: amount <= global_daily_cap
   ├─ check: merchant_scope in approved list
   ├─ check: agent_role authorized for category
   └─ decision: APPROVED or DENIED

3. Authorization decision (synchronous)
   ├─ call: treasury-api.authorize(money_intent_id)
   ├─ store: authorization_decisions row (decision, reason_code, approved_by)
   ├─ emit: money.authorization.decided.v1
   └─ result: APPROVED → ledger entry; DENIED → reject task

4. Ledger settlement (async subscriber)
   ├─ treasury subscribes to money.authorization.decided.v1
   ├─ if APPROVED: create ledger_entries + ledger_entries_posting (double-entry)
   │  - debit: agent-labor-cost (workflow expense)
   │  - credit: venture-treasury (revenue received)
   ├─ emit: ledger.entry.created.v1
   └─ emit: ledger.materialized.v1 (reconciliation)
```

### Velocity Controls

Per workflow, per merchant, per category:

```python
# Redis key: velocity-control:{workflow_id}:{merchant}:{category}
velocity_limit = 10000  # cents per hour
window = 3600  # seconds

current_spent = redis.get(key)
if current_spent is None:
    redis.set(key, amount, EX=window)
elif current_spent + amount <= velocity_limit:
    redis.incrby(key, amount)
else:
    raise AuthorizationDenied("velocity limit exceeded")
```

### Reconciliation

Treasury runs a daily reconciliation job:

1. Sum all ledger_entries (debit/credit sides).
2. Verify debit_cents == credit_cents for each posting.
3. Cross-check against external payment provider APIs (if used).
4. Emit ledger.reconciliation.completed.v1 with mismatches (if any).
5. If mismatch > threshold, freeze system and escalate.

---

## Compliance Engine

The Compliance Engine evaluates policy rules against all agent actions and generates audit trails.

### Policy Rule Schema

```json
{
  "rule_id": "RULE-PRIVACY-001",
  "rule_type": "TOOL_USAGE",
  "severity": "CRITICAL",
  "condition": {
    "tool_name": "io.write",
    "target_path": "/tmp/pii/*"
  },
  "action": "DENY",
  "audit_required": true
}
```

### Evaluation Points

1. **Tool execution**: before tool.call.executed event, compliance-engine checks tool_name + input against all TOOL_USAGE rules.
2. **Money authorization**: treasury-api consults compliance-engine for SPEND rules before issuing authorization_decisions.
3. **Data access**: before io.read, check DATA_ACCESS rules (e.g., "no PII outside compliance officer workspace").
4. **External API calls**: before web.fetch, validate against EXTERNAL_API allowlist rules.
5. **Artifact export**: before artifact exports data, check EXPORT rules (e.g., "no slide exports to untrusted domains").

### Audit Trail

Every policy evaluation emits compliance.evaluated.v1:

```json
{
  "event_id": "evt-...",
  "event_type": "compliance.evaluated.v1",
  "trace_id": "...",
  "workflow_id": "...",
  "task_id": "...",
  "rule_id": "RULE-...",
  "decision": "APPROVED" or "DENIED",
  "reason": "...",
  "created_at": "..."
}
```

### Violation Detection & Escalation

If compliance.evaluated.v1 has decision=DENIED:

1. Emit compliance.violation.detected.v1.
2. Classify by severity (LOW, MEDIUM, CRITICAL).
3. If CRITICAL: auto-freeze system, emit control.freeze.activated.v1, alert compliance officer.
4. Store violation in compliance_cases table for post-incident review.

### Privacy Operations

- **DSAR (Data Subject Access Request)**:
  - Receive privacy.request.received.v1 (request_type=DSAR).
  - Query ledger-db for all events/artifacts mentioning subject_ref.
  - Compile response_bundle.
  - Emit privacy.request.completed.v1.
- **Deletion**:
  - Receive privacy.request.received.v1 (request_type=DELETE).
  - Mark events as anonymized (redact PII fields, keep trace for audit).
  - Emit privacy.request.completed.v1.

---

## Security Architecture

### Workload Identity & Credentials

Every agent task includes short-lived credentials:

```json
{
  "task_id": "...",
  "agent_role": "l2-coder",
  "workload_identity": {
    "iss": "https://venture.local",
    "sub": "agent-runtime:l2-coder:instance-7",
    "aud": "policy-engine,artifact-compiler",
    "exp": 1234567890,
    "iat": 1234567800,
    "signature": "..."
  }
}
```

Credentials are mTLS-based (agent-runtime ↔ policy-engine, agent-runtime ↔ artifact-compiler).

### Tool Allowlists

Per agent_role (stored in redis, checked in-path by policy-engine):

```yaml
l3-agent:
  allowed_tools:
    - io.read
    - io.write
    - artifact.render
    - web.fetch
    - git.commit
  denied_tools:
    - artifact.publish  # L3 cannot publish externally
    - policy.evaluate  # L3 cannot modify policy

l2-coder:
  allowed_tools:
    - io.read
    - io.write
    - artifact.render
    - web.fetch
    - git.*
    - python.exec
    - test.run

l1-orchestrator:
  allowed_tools:
    - workflow.dispatch
    - policy.evaluate
    - event.publish
    - treasury.authorize
    - agent.dispatch
```

### Prompt Injection Defense

Before policy-engine validates an intent, input is sanitized:

```python
def sanitize_input(raw_input):
    # 1. Remove null bytes and control characters
    cleaned = ''.join(c for c in raw_input if ord(c) >= 32 or c in '\t\n\r')
    # 2. Truncate to max_length
    truncated = cleaned[:10000]
    # 3. Check for suspicious patterns (optional: ML classifier)
    if detect_jailbreak_pattern(truncated):
        raise PromptInjectionDetected()
    return truncated
```

### External Content Isolation

Agent outputs from web.fetch or external APIs are sandboxed:

```python
def fetch_external_content(url, domain_whitelist):
    if not is_whitelisted(url, domain_whitelist):
        raise UnallowedDomain(url)
    response = httpx.get(url, timeout=5)
    # Parse as structured data (JSON) only; reject HTML/executable
    try:
        data = response.json()
    except:
        raise InvalidContentFormat()
    return sanitize_json(data)  # Redact sensitive fields
```

### Tamper-Evident Event Logs

Event storage includes checksums and signatures:

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID UNIQUE,
  event_type TEXT,
  payload JSONB,
  checksum_prev BYTEA,  -- SHA256 of previous event
  checksum_current BYTEA,  -- SHA256(checksum_prev || payload)
  signature BYTEA,  -- RSA signature of checksum_current
  created_at TIMESTAMP,
  CONSTRAINT checksum_chain CHECK (checksum_current = SHA256(checksum_prev || event_type || payload))
);
```

Periodic attestation verifies chain integrity; if broken, emit compliance.violation.detected.v1 and freeze.

---

## Scaling Model

### Single-Node (process-compose, local dev)

- All services run in one process-compose process.
- NATS JetStream uses file-backed store (./data/nats).
- PostgreSQL local socket or localhost:5432.
- Redis in-memory or localhost:6379.
- Agent-runtime spawns L3 workers as subprocesses.

### Multi-Node (production)

#### Tier 1: NATS Clustering

```
NATS Server A (:4222, peer :6222)
NATS Server B (:4222, peer :6222)
NATS Server C (:4222, peer :6222)

All with JetStream enabled (peer replication for streams).
```

Clients auto-discover via seed servers. Event-bus connects to any node; NATS handles replication.

#### Tier 2: PostgreSQL HA

```
Primary Node (postgres-1)
  ├─ ledger-db (primary, read-write)
  └─ Streaming replication to Replica Node

Replica Node (postgres-2)
  ├─ ledger-db (read-only, for projections)
  └─ Failover to Primary if Primary dies

Backup Node (postgres-backup)
  └─ WAL archiving to S3

Failover: pg_failover_slot or patroni-managed VIP.
```

#### Tier 3: Service Scaling

| Service | Scaling Strategy |
|---|---|
| **control-plane-api** | 1 replica (founder I/O bottleneck); could scale to 2 with sticky session routing |
| **policy-engine** | Horizontal via HTTP load balancer; Redis caching ensures cache hit rate > 80% |
| **artifact-compiler** | Horizontal via NATS work queue (fair dispatch); queue depth monitored |
| **treasury-api** | 1-2 replicas; single ledger authorizes all transactions (serialize via DB lock or distributed lock) |
| **compliance-engine** | Horizontal; read-only queries to ledger-db |
| **venture-orchestrator** | 2+ replicas; distributed task dispatch via Redis-backed queue (fair distribution) |
| **agent-runtime** | Horizontal; each replica manages subset of L2 agents + L3 worker pool; consistent hashing for L2 dispatch |
| **redis-cache** | Single node with Sentinel for failover; persistent RDB snapshots |
| **event-bus (NATS)** | 3+ node cluster with quorum (even cluster size to prevent split-brain) |
| **ledger-db (PostgreSQL)** | 1 primary + 1-2 replicas; async replication (RPO up to 1 WAL segment) |

#### Inter-Service Communication

- **HTTP/REST**: control-plane-api → venture-orchestrator → policy-engine (low-latency, request-response).
- **NATS Pub/Sub**: all services emit events to event-bus (async, fan-out).
- **NATS Request/Reply**: agent-runtime queries policy-engine for tool allowlists (RPC pattern).
- **PostgreSQL**: direct queries from ledger-db; connection pooling via PgBouncer (100 max connections).
- **Redis**: direct commands; connection pooling via redis-py (pool_size=50).

#### Load Balancing

- **HTTP services**: round-robin (control-plane-api, policy-engine, artifact-compiler, treasury-api, compliance-engine, venture-orchestrator).
- **NATS**: no load balancer needed; clients connect to seed servers and auto-discover cluster.
- **PostgreSQL**: application-side pooling + read replica routing (Replica for SELECT, Primary for writes).
- **Redis**: single endpoint (no clustering in this design, for simplicity; could add Redis Cluster).

#### Monitoring & Observability

- **Prometheus scrape targets**: every service exports /metrics endpoint.
- **Key metrics**:
  - policy-engine: policy_evaluation_latency_ms, cache_hit_rate, tool_allowlist_checks_per_sec.
  - artifact-compiler: build_duration_ms, queue_depth, cache_hit_rate.
  - treasury-api: authorization_latency_ms, intent_queue_depth, ledger_entry_volume.
  - venture-orchestrator: task_dispatch_latency_ms, agent_pool_utilization, DAG_depth.
  - agent-runtime: task_execution_time_ms, tool_call_count, L3_worker_pool_utilization.
  - event-bus: events_per_sec, stream_lag, consumer_latency_ms.
  - ledger-db: event_insert_latency_ms, projection_lag_ms, checkpoint_integrity.
  - redis-cache: hit_rate, eviction_rate, memory_usage_bytes.
- **Alerting**:
  - policy_evaluation_latency > 100ms → investigate cache misses.
  - treasury_authorization_latency > 500ms → investigate ledger contention.
  - event_lag > 10s → investigate consumer backlog.
  - agent_pool_utilization > 90% for > 5 min → scale agent-runtime.
  - compliance_violations > 0 → escalate immediately.

---

## Non-Functional Requirements

### Latency Budgets

| Operation | Budget | Notes |
|---|---|---|
| Policy evaluation (tool allowlist check) | < 50ms (p95) | Cached in Redis; direct fallback to disk if cache miss |
| Task dispatch (L3 spawn) | < 200ms (p95) | Includes subprocess fork + task envelope marshaling |
| Money authorization | < 500ms (p95) | Includes ledger lock + velocity check |
| Artifact build (simple) | < 5s (p95) | Spec validation + rendering (excludes external API calls) |
| Task completion latency (WebSocket push) | < 1s (p95) | Event processing + projection materialization |

### Throughput Targets

| Component | Target |
|---|---|
| Policy evaluations per second | 100 req/s |
| Task dispatches per second | 10 req/s (L1/L2) + 50 req/s (L3 pool) |
| Money intents per second | 5 req/s |
| Events per second | 500 events/s |
| Artifact builds per second (concurrent) | 10 builds/s |

### Availability Targets

| Service | Target | Mechanism |
|---|---|---|
| control-plane-api | 99.5% | 1 replica; founder restarts if down |
| policy-engine | 99.9% | Horizontal replicas; cache layer |
| event-bus | 99.99% | 3-node NATS cluster with quorum |
| ledger-db | 99.9% | Primary + replica failover |
| agent-runtime | 99% | Horizontal replicas; task requeue on agent death |

### Data Durability

- **Event-bus (NATS)**: events persisted to disk within 1s of publish (RTO: 5min after node failure).
- **Ledger-db (PostgreSQL)**: fsync every transaction (durability: < 1s after commit).
- **Redis cache**: optional persistence (RDB snapshot every 60s); data loss acceptable (cache miss → recompute).

### Network & Isolation

- **Workload-to-workload**: mTLS required.
- **External APIs**: HTTPS only; certificate pinning for critical providers (artifact compiler).
- **Data at rest**: PostgreSQL tablespaces encrypted via LUKS (or EBS encryption).

---

## Related Specifications

- `API_EVENTS_SPEC.md` — Event catalog and envelope schema.
- `DATA_MODEL_DB_SPEC.md` — Database schema and relational model.
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` — Artifact IR specs and build pipeline.
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Treasury and compliance subsystem details.
- `TRACK_C_CONTROL_PLANE.md` — Control plane, policy engine, and rollout stages.
- `FUNCTIONAL_REQUIREMENTS.md` — Functional requirements mapped to this architecture.
- `SERVICE_CATALOG.md` — Service registry, health checks, and environment contracts.

---

## Revision History

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-02-21 | 2.0 | AI Agent | Expanded from v1 (32 → 550 lines); added service inventory, data flow, agent runtime detail, treasury, compliance, security, scaling models, and NFRs. |
