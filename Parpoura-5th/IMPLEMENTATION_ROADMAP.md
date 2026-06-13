# Venture Platform Implementation Roadmap (v1)

**Date:** 2026-02-21
**Status:** ACTIVE
**Scope:** MVP complete = all M0–M6 milestones delivered, full v1 feature surface wired, tested, runnable in process-compose
**Ownership:** Venture Platform Team
**Last Updated:** 2026-02-21

---

## Executive Summary

The Venture platform is an autonomous AI civilization system with tightly governed financial controls, artifact determinism, and full compliance/audit coverage. This roadmap defines six (6) major milestones spanning 12–14 weeks of concurrent agent-driven development.

**Architecture:** Primitive-first + extensible. Smallest working loop first (M0 foundation), then extend outward (M1 control plane, M2 agent runtime, M3 treasury, M4 artifact compiler, M5 portfolio, M6 compliance + hardening).

**Development Model:** Test-first; failing test before every implementation. L3 copilot agents dispatch in parallel per milestone phase. Git worktrees one per feature track. All changes self-committing and reviewable.

---

## Milestone Overview

| Milestone | Phase | Wall-Clock | Key Deliverables | Exit Criteria |
|-----------|-------|-----------|------------------|---------------|
| **M0** | Foundation | 2 weeks | PostgreSQL + migrations, NATS JetStream, Redis, process-compose baseline, schema registry | All infra running; event envelope V1 validating; no data loss |
| **M1** | Control Plane | 2 weeks | Policy engine, tool allowlists, founder API, workspace boundaries, FSM | All external effects governed; workspace budgets enforced; API responds |
| **M2** | Agent Runtime | 2 weeks | L1/L2 orchestrator, L3 copilot pool, task envelope protocol, tracer integration | Agents spawn; tasks complete; trace logs captured; replay deterministic |
| **M3** | Treasury | 2 weeks | Money API, double-entry ledger, spend authorization, reconciliation, compliance attestation | Zero unauthorized spends; ledger balances; reconciliation passes |
| **M4** | Artifact Compiler | 2 weeks | IR schemas (Slide/Doc/Timeline/Audio/Board), build pipeline, provenance, headless export | Artifacts deterministically build; provenance signed; byte-identical replay |
| **M5** | Venture Portfolio | 2 weeks | Revenue ventures, P&L tracking, portfolio optimizer, tier/plan enforcement | Revenue ventures tracked; P&L accurate; tiers enforced at spend boundaries |
| **M6** | Compliance + Hardening | 2 weeks | Audit trail, DSAR workflows, incident doctrine, 100% test coverage, load tests | Full audit trail; DSAR executable in <24h; load test passes; coverage ≥95% |

**Total Wall-Clock:** 12–14 weeks (parallel L3 agent sprints per phase)

---

## M0: Foundation (Week 1–2)

### Objective
Stand up all infrastructure services. Get PostgreSQL, NATS, Redis, and process-compose running with zero data loss guarantees. Deploy schema registry and validate event envelopes.

### Services Online
- **PostgreSQL:** 15.x on localhost:5432; migrations via Alembic
- **NATS JetStream:** Streams for `events.*` and `tasks.*` with replication factor 3
- **Redis:** 7.x on localhost:6379; used for rate limiting and session cache
- **process-compose:** YAML manifest declaring all services with hot reload and health checks
- **Schema Registry:** In-process service validating all event envelopes against published schemas

### Key FRs Addressed
- `FR-INFRA-001`: PostgreSQL schema initialized with artifact IR, ledger, workflow, audit tables
- `FR-INFRA-002`: NATS streams for events and tasks with durable storage
- `FR-INFRA-003`: Schema registry enforces EventEnvelopeV1 on all external effects
- `FR-INFRA-004`: process-compose manifest includes health checks and startup order

### Integration Tests That Must Pass
```
✓ PostgreSQL connects and migrations run without error
✓ NATS streams created and ephemeral subscriptions work
✓ Redis connects and SET/GET round-trip works
✓ All services start in order via process-compose up
✓ EventEnvelopeV1 schema validation rejects malformed events
✓ Event replay from NATS produces deterministic results
```

### Git Worktree Setup
```bash
# M0 foundation track
git worktree add ../venture-wt-m0-foundation main
cd ../venture-wt-m0-foundation

# Work on M0 tasks; when complete:
git log --oneline venture-wt-m0-foundation..main  # Verify ahead
git switch main && git merge venture-wt-m0-foundation
```

### L3 Agent Sprint Dispatch (M0)
```bash
# Dispatch 3 parallel L3 agents for M0 subtasks

# Agent 1: PostgreSQL + Alembic migrations
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema via Alembic

Test first: Write failing test in tests/test_db_migrations.py
- Verify artifact_ir table structure
- Verify ledger table structure
- Verify audit_log table structure
Implement in alembic/versions/
Must pass: uv run pytest tests/test_db_migrations.py -v
Must pass: uv run alembic upgrade head (idempotent)
Commit: 'feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic'
Do not push. One module only.
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: NATS JetStream streams
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — Stand up NATS JetStream streams for events and tasks

Test first: Write failing test in tests/test_nats_streams.py
- Verify events.* stream exists with 3x replication
- Verify tasks.* stream exists with 3x replication
- Verify durable subscriptions persist
Implement in src/infra/nats_setup.py
Must pass: uv run pytest tests/test_nats_streams.py -v
Commit: 'feat(infra): FR-INFRA-002 NATS JetStream setup'
Do not push. One module only.
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: Schema registry + EventEnvelopeV1 validation
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 — Implement schema registry with EventEnvelopeV1 validation

Test first: Write failing tests in tests/test_schema_registry.py
- Test EventEnvelopeV1 accepts valid envelopes (event_id, event_type, trace_id, workflow_id, payload, created_at)
- Test EventEnvelopeV1 rejects missing required fields
- Test schema registry caches schemas by version
Implement in src/infra/schema_registry.py
Must pass: uv run pytest tests/test_schema_registry.py -v
Must pass: uv run ruff check src/infra/schema_registry.py
Commit: 'feat(infra): FR-INFRA-003 Schema registry with EventEnvelopeV1'
Do not push. One module only.
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Wait for all agents to complete
wait
```

### Process-Compose Manifest (M0 Deliverable)
```yaml
# compose/process-compose.yaml
version: "3"

services:
  postgres:
    command: postgres -c shared_preload_libraries=pgcrypto
    startup_interval: 1s
    startup_timeout: 30s
    readiness_probe:
      exec:
        command: ["pg_isready", "-U", "venture"]
      initial_delay_seconds: 5
      period_seconds: 2

  nats:
    command: nats-server -js -c nats.conf
    startup_interval: 1s
    startup_timeout: 10s

  redis:
    command: redis-server --appendonly yes
    startup_interval: 1s
    startup_timeout: 5s

  schema-registry:
    command: python -m src.infra.schema_registry
    depends_on:
      - nats
    startup_interval: 1s
    startup_timeout: 10s
```

### Exit Criteria (M0 Must Be True)
1. **All services pass health checks** in process-compose up
2. **PostgreSQL migrations run idempotently** — running twice = same state
3. **NATS streams durable** — kill nats, restart, data is there
4. **Schema registry rejects malformed events** — validation is strict
5. **Event replay deterministic** — publish event, consume, replay produces identical results
6. **Zero test suppressions** — all tests green with no `# noqa` without inline justification
7. **All commits signed and properly formatted** — follow "feat(module): FR-XXX description"

---

## M1: Control Plane (Week 3–4)

### Objective
Implement the governance layer: policy engine, tool allowlists, founder REST API, workspace boundaries, and FSM for workflow state management.

### Services Online
- **Policy Engine:** Evaluates authorization decisions against policy bundles
- **Tool Allowlist Engine:** Maps agent roles → permitted tools
- **Founder API:** FastAPI service on :8000 providing REST endpoints for policy management
- **FSM Framework:** State machine for workflow, task, and action lifecycles
- **WebSocket Feed:** Live dashboard updates on workflow state changes

### Key FRs Addressed
- `FR-CP-001`: Policy bundles versioned in DB; every decision bound to bundle ID
- `FR-CP-002`: Tool allowlist engine enforces per-role capability model
- `FR-CP-003`: Founder API REST endpoints for policy CRUD and workspace config
- `FR-CP-004`: FSM framework manages workflow/task/action state transitions
- `FR-CP-005`: WebSocket feed broadcasts state changes to dashboard

### Integration Tests That Must Pass
```
✓ Policy bundle CRUD works; schema snapshots stored
✓ Policy decision includes bundle_id and reason_code
✓ Tool allowlist rejects unpermitted tool calls
✓ Founder API POST /policies returns 201 with policy_id
✓ FSM validates state transitions; rejects invalid ones
✓ WebSocket subscribers receive state change events
✓ Unauthorized API calls return 403 Forbidden
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m1-control-plane main
cd ../venture-wt-m1-control-plane
```

### L3 Agent Sprint Dispatch (M1)
```bash
# Agent 1: Policy engine
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-001 — Implement policy engine with versioned bundles

Test first: tests/test_policy_engine.py
- Policy bundle CRUD
- Schema snapshot validation
- Decision binding to bundle_id
Implement: src/control_plane/policy_engine.py
Must pass: uv run pytest tests/test_policy_engine.py -v
Commit: 'feat(control-plane): FR-CP-001 Policy engine'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: Tool allowlist engine
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-002 — Implement tool allowlist engine

Test first: tests/test_tool_allowlist.py
- Role-to-tools mapping
- Allowlist enforcement
- Rejection of unpermitted tools
Implement: src/control_plane/tool_allowlist.py
Must pass: uv run pytest tests/test_tool_allowlist.py -v
Commit: 'feat(control-plane): FR-CP-002 Tool allowlist'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Founder API + FSM
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-003 + FR-CP-004 — Founder REST API and FSM framework

Test first: tests/test_founder_api.py tests/test_fsm.py
- FastAPI endpoints for policy CRUD
- FSM state transitions and validation
- WebSocket route for live feed
Implement: src/control_plane/api.py src/control_plane/fsm.py
Must pass: uv run pytest tests/test_founder_api.py tests/test_fsm.py -v
Commit: 'feat(control-plane): FR-CP-003 FR-CP-004 Founder API and FSM'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M1 Must Be True)
1. **Policy bundle versioning works** — create bundle v1 → v2 → can replay v1
2. **Tool allowlist blocks unauthorized calls** — agent with role X cannot call tool Y
3. **Founder API responds on :8000** — curl http://localhost:8000/policies returns 200
4. **FSM validates transitions** — pending → scheduled → executing → completed (no invalid paths)
5. **WebSocket broadcasts live** — subscribe → state change → receive event < 100ms
6. **No fallback paths in authorization** — deny by default, explicit allow only
7. **All control plane tests pass** with ≥80% coverage

---

## M2: Agent Runtime (Week 5–6)

### Objective
Implement the agent execution layer: orchestrator for L1/L2 agents, L3 copilot pool management, task envelope protocol, and tracer integration for replay.

### Services Online
- **L1/L2 Orchestrator:** Routes tasks to agents based on capability and policy
- **L3 Copilot Pool:** Manages background copilot processes for autonomous task execution
- **Task Envelope Service:** Wraps tasks with context (trace_id, workflow_id, agent_role, budget)
- **Tracer:** Records all task executions for deterministic replay

### Key FRs Addressed
- `FR-RT-001`: L1/L2 orchestrator dispatches tasks with capability filtering
- `FR-RT-002`: L3 copilot pool spawns and monitors background workers
- `FR-RT-003`: Task envelope injects trace_id, workflow_id, agent_role before dispatch
- `FR-RT-004`: Tracer captures inputs, outputs, and execution time for replay validation
- `FR-RT-005`: Agent death is detected and logged; failed tasks are retried

### Integration Tests That Must Pass
```
✓ Task dispatches to correct agent based on capability
✓ L3 copilot spawns with correct environment vars
✓ Task envelope includes all required context fields
✓ Trace logs written to disk; replay reads deterministically
✓ Agent death detected within 5s; task retried
✓ Workflow FSM updates on task completion
✓ Concurrent tasks isolated in separate trace contexts
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m2-agent-runtime main
cd ../venture-wt-m2-agent-runtime
```

### L3 Agent Sprint Dispatch (M2)
```bash
# Agent 1: L1/L2 orchestrator
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-001 — L1/L2 agent orchestrator with capability filtering

Test first: tests/test_orchestrator.py
- Task dispatch based on capability
- Policy enforcement before dispatch
- Timeout handling
Implement: src/runtime/orchestrator.py
Must pass: uv run pytest tests/test_orchestrator.py -v
Commit: 'feat(runtime): FR-RT-001 L1/L2 orchestrator'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: L3 copilot pool
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-002 — L3 copilot pool manager

Test first: tests/test_copilot_pool.py
- Spawn copilot worker with env vars
- Monitor process health
- Collect stdout/stderr
- Handle graceful shutdown
Implement: src/runtime/copilot_pool.py
Must pass: uv run pytest tests/test_copilot_pool.py -v
Commit: 'feat(runtime): FR-RT-002 L3 copilot pool'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Task envelope + tracer
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-003 + FR-RT-004 — Task envelope and tracer

Test first: tests/test_task_envelope.py tests/test_tracer.py
- Envelope wraps task with context
- Tracer writes execution records
- Replay reads from trace logs
- Deterministic output validation
Implement: src/runtime/task_envelope.py src/runtime/tracer.py
Must pass: uv run pytest tests/test_task_envelope.py tests/test_tracer.py -v
Commit: 'feat(runtime): FR-RT-003 FR-RT-004 Task envelope and tracer'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M2 Must Be True)
1. **Agents spawn and accept tasks** — /proc shows copilot processes
2. **Task envelope correctly injects context** — trace logs contain all fields
3. **Replay is deterministic** — read task inputs from trace, re-run agent, outputs match exactly
4. **Agent death detected and logged** — kill copilot, orchestrator detects within 5s
5. **Concurrent tasks isolated** — two tasks don't share trace context
6. **All runtime tests pass** with ≥80% coverage
7. **No race conditions in orchestrator** — stress test with 100 concurrent tasks

---

## M3: Treasury (Week 7–8)

### Objective
Implement money controls: spend authorization, double-entry ledger, reconciliation, and compliance attestation.

### Services Online
- **Money API:** Authorizes spend requests and enforces limits
- **Ledger Service:** Double-entry bookkeeping with immutable entries
- **Reconciliation Engine:** Compares internal ledger with processor exports
- **Compliance Attestation:** Policy-driven approval for spend and data actions

### Key FRs Addressed
- `FR-TRE-001`: Default-deny spend model; every spend requires `money_intent`
- `FR-TRE-002`: Double-entry ledger; every transaction creates debit + credit pair
- `FR-TRE-003`: Spend authorization includes reason_code and policy_bundle_id
- `FR-TRE-004`: Daily reconciliation detects drift and opens compliance cases
- `FR-TRE-005`: Compliance policy pack gates outreach, payment, and data export

### Integration Tests That Must Pass
```
✓ Unauthorized spend rejected with 403 Forbidden
✓ Spend with valid money_intent approved; event emitted
✓ Ledger entries are immutable; update attempts rejected
✓ Debit + credit sum to zero (conservation invariant)
✓ Reconciliation finds drift and creates case
✓ Compliance policy gates restrict actions by jurisdiction
✓ No silent fallback on policy evaluation failure
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m3-treasury main
cd ../venture-wt-m3-treasury
```

### L3 Agent Sprint Dispatch (M3)
```bash
# Agent 1: Money authorization API
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-001 — Default-deny money authorization

Test first: tests/test_money_api.py
- Spend without money_intent → 403
- Spend with valid intent → 200 + authorization_id
- Reason_code required
- Policy bundle binding required
Implement: src/treasury/money_api.py
Must pass: uv run pytest tests/test_money_api.py -v
Commit: 'feat(treasury): FR-TRE-001 Money authorization API'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: Double-entry ledger
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-002 + FR-TRE-003 — Double-entry ledger with authorization binding

Test first: tests/test_ledger.py
- Create debit entry
- Create credit entry
- Verify sum to zero
- Ledger entries immutable
- Authorization ID linked
Implement: src/treasury/ledger.py
Must pass: uv run pytest tests/test_ledger.py -v
Commit: 'feat(treasury): FR-TRE-002 FR-TRE-003 Double-entry ledger'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Reconciliation + compliance
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-004 + FR-TRE-005 — Reconciliation and compliance attestation

Test first: tests/test_reconciliation.py tests/test_compliance.py
- Reconciliation compares internal ledger to processor export
- Drift above threshold creates case
- Compliance policy blocks outreach/payment based on jurisdiction
- Policy gating is fail-closed (deny if policy unavailable)
Implement: src/treasury/reconciliation.py src/treasury/compliance.py
Must pass: uv run pytest tests/test_reconciliation.py tests/test_compliance.py -v
Commit: 'feat(treasury): FR-TRE-004 FR-TRE-005 Reconciliation and compliance'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M3 Must Be True)
1. **Unauthorized spends rejected** — curl -X POST /spend without money_intent returns 403
2. **Ledger balances** — sum of all debits = sum of all credits
3. **Reconciliation detects drift** — processor export differs by >$0.01 → case created
4. **Compliance policy enforces** — outreach blocked for blocked jurisdictions
5. **No fallback on policy failure** — if policy unavailable, fail-closed (deny)
6. **All treasury tests pass** with ≥85% coverage
7. **Audit trail complete** — every spend decision logged with policy_bundle_id

---

## M4: Artifact Compiler (Week 9–10)

### Objective
Implement artifact compilation: IR schema validation, deterministic build pipeline, provenance signing, and headless export.

### Services Online
- **IR Schema Service:** Validates Slide/Doc/Timeline/Audio/Board specs
- **Compiler Pipeline:** Orchestrates spec → render → validate → export
- **Provenance Service:** Signs and verifies artifact fingerprints
- **Build Cache:** Stores deterministic builds keyed by content hash + toolchain version

### Key FRs Addressed
- `FR-ART-001`: IR schemas defined for all artifact types
- `FR-ART-002`: Deterministic build; same IR + toolchain = byte-identical output
- `FR-ART-003`: Provenance signature attached to every export
- `FR-ART-004`: Build cache keyed by idempotency key (IR + toolchain + target)
- `FR-ART-005`: Replay verification confirms byte-identical outputs

### Integration Tests That Must Pass
```
✓ SlideSpec validates layout, slides, styles
✓ DocSpec validates sections, constraints, citations
✓ TimelineSpec validates scenes, timing, transitions
✓ AudioSpec validates voice config, segments, loudness
✓ BoardSpec validates objects, connectors, layers
✓ Build output deterministic across runs
✓ Provenance signature verifies correctly
✓ Cache hit returns byte-identical output
✓ Replay verification passes
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m4-artifact-compiler main
cd ../venture-wt-m4-artifact-compiler
```

### L3 Agent Sprint Dispatch (M4)
```bash
# Agent 1: IR schemas
copilot -p "$(cat <<'PROMPT'
Task: FR-ART-001 — IR schema definitions for all artifact types

Test first: tests/test_ir_schemas.py
- SlideSpec validation
- DocSpec validation
- TimelineSpec validation
- AudioSpec validation
- BoardSpec validation
- Content hash computation
Implement: src/compiler/ir_schemas.py
Must pass: uv run pytest tests/test_ir_schemas.py -v
Commit: 'feat(compiler): FR-ART-001 IR schema definitions'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: Compiler pipeline
copilot -p "$(cat <<'PROMPT'
Task: FR-ART-002 + FR-ART-004 — Deterministic compiler pipeline with caching

Test first: tests/test_compiler_pipeline.py
- Spec → render → validate → export flow
- Deterministic build: same inputs → same output bytes
- Build cache keyed by idempotency key
- Cache hit returns identical bytes
Implement: src/compiler/pipeline.py src/compiler/build_cache.py
Must pass: uv run pytest tests/test_compiler_pipeline.py -v
Commit: 'feat(compiler): FR-ART-002 FR-ART-004 Compiler pipeline and cache'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Provenance + replay
copilot -p "$(cat <<'PROMPT'
Task: FR-ART-003 + FR-ART-005 — Provenance signing and replay verification

Test first: tests/test_provenance.py
- Sign build output
- Verify signature
- Replay verification: rebuild artifact, bytes match
- Provenance includes toolchain version, timestamp, policy_bundle_id
Implement: src/compiler/provenance.py src/compiler/replay.py
Must pass: uv run pytest tests/test_provenance.py -v
Commit: 'feat(compiler): FR-ART-003 FR-ART-005 Provenance and replay'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M4 Must Be True)
1. **IR schemas validate correctly** — invalid specs rejected with clear error
2. **Deterministic builds work** — build same IR twice → bytes identical
3. **Provenance signature verifies** — sign artifact → verify signature → success
4. **Build cache returns identical bytes** — cache hit produces byte-for-byte same output
5. **Replay verification passes** — rebuild artifact from trace → matches original
6. **All compiler tests pass** with ≥85% coverage
7. **No fallback on schema validation** — invalid IR fails hard, never silently degrades

---

## M5: Venture Portfolio (Week 11–12)

### Objective
Implement venture portfolio management: revenue ventures, P&L tracking, portfolio optimization, and tier/plan enforcement.

### Services Online
- **Venture Registry:** CRUD for revenue ventures with metadata
- **P&L Engine:** Calculates profit/loss per venture and portfolio
- **Portfolio Optimizer:** Recommends tier/plan changes based on cash flow
- **Tier Enforcement:** Spend limits by plan tier

### Key FRs Addressed
- `FR-PF-001`: Ventures created with founding capital and tier assignment
- `FR-PF-002`: P&L calculated daily; revenue and spend tracked per venture
- `FR-PF-003`: Portfolio optimizer recommends upgrades/downgrades
- `FR-PF-004`: Spend limits enforced by tier; exceed → rejection
- `FR-PF-005`: Venture health score calculated from P&L and spend ratio

### Integration Tests That Must Pass
```
✓ Venture creation stores founding capital and tier
✓ P&L calculation: revenue - spend = profit
✓ P&L accurate across multiple ventures
✓ Optimizer recommends upgrade if cash > 2x tier limit
✓ Optimizer recommends downgrade if cash < 0.5x tier limit
✓ Tier spend limit enforced; exceed → spend rejected
✓ Health score correlates with P&L
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m5-portfolio main
cd ../venture-wt-m5-portfolio
```

### L3 Agent Sprint Dispatch (M5)
```bash
# Agent 1: Venture registry
copilot -p "$(cat <<'PROMPT'
Task: FR-PF-001 — Venture registry with CRUD and tier assignment

Test first: tests/test_venture_registry.py
- Create venture with founding capital and tier
- Read venture by ID
- Update tier
- Delete venture
- Tier values: STARTER, GROWTH, ENTERPRISE
Implement: src/portfolio/venture_registry.py
Must pass: uv run pytest tests/test_venture_registry.py -v
Commit: 'feat(portfolio): FR-PF-001 Venture registry'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: P&L engine
copilot -p "$(cat <<'PROMPT'
Task: FR-PF-002 + FR-PF-005 — P&L engine with health score

Test first: tests/test_pl_engine.py
- Calculate profit per venture: revenue - spend
- Calculate portfolio profit: sum of venture profits
- Health score: P&L / founding_capital (0-1)
- Daily P&L snapshots stored
Implement: src/portfolio/pl_engine.py
Must pass: uv run pytest tests/test_pl_engine.py -v
Commit: 'feat(portfolio): FR-PF-002 FR-PF-005 P&L and health score'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Optimizer + tier enforcement
copilot -p "$(cat <<'PROMPT'
Task: FR-PF-003 + FR-PF-004 — Portfolio optimizer and tier enforcement

Test first: tests/test_optimizer.py tests/test_tier_enforcement.py
- Optimizer recommends upgrade if cash > 2x limit
- Optimizer recommends downgrade if cash < 0.5x limit
- Tier limits: STARTER=$100, GROWTH=$1000, ENTERPRISE=$10000
- Spend enforcement: exceed limit → rejection
Implement: src/portfolio/optimizer.py src/portfolio/tier_enforcement.py
Must pass: uv run pytest tests/test_optimizer.py tests/test_tier_enforcement.py -v
Commit: 'feat(portfolio): FR-PF-003 FR-PF-004 Optimizer and tier enforcement'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M5 Must Be True)
1. **Ventures created and tracked** — venture registry returns all ventures
2. **P&L accurate** — profit = revenue - spend (verified against ledger)
3. **Portfolio optimizer works** — cash > 2x limit → upgrade recommendation appears
4. **Tier spend limits enforced** — spend > limit → 403 Forbidden
5. **Health score calculated** — score 0.5 for breakeven venture
6. **All portfolio tests pass** with ≥80% coverage
7. **No fallback on tier enforcement** — if tier check fails, deny spend

---

## M6: Compliance + Hardening (Week 13–14)

### Objective
Implement full compliance and audit infrastructure: audit trail, DSAR workflows, incident doctrine, 100% test coverage, and load testing.

### Services Online
- **Audit Trail Service:** Append-only log of all decisions, spans, and state changes
- **DSAR Orchestrator:** Automates subject access requests and deletion workflows
- **Incident Responder:** Automates incident response procedures
- **Load Test Harness:** Simulates 1000s of concurrent agents

### Key FRs Addressed
- `FR-HRD-001`: Audit trail is append-only and tamper-evident
- `FR-HRD-002`: DSAR request processed in <24h; all data returned or deleted
- `FR-HRD-003`: Incident class routed to correct responder; playbook executed
- `FR-HRD-004`: Test coverage ≥95% across all modules
- `FR-HRD-005`: Load test passes 1000 concurrent agents; p99 latency <5s

### Integration Tests That Must Pass
```
✓ Audit entry created for every decision
✓ Audit log is append-only; update attempts fail
✓ DSAR request triggers deletion of all user data
✓ DSAR completion confirmed within 24h
✓ Incident classification routes to correct responder
✓ Incident playbook executes without manual intervention
✓ Test coverage reported ≥95%
✓ Load test: 1000 agents → p99 latency <5s, zero timeouts
```

### Git Worktree Setup
```bash
git worktree add ../venture-wt-m6-hardening main
cd ../venture-wt-m6-hardening
```

### L3 Agent Sprint Dispatch (M6)
```bash
# Agent 1: Audit trail + DSAR
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-001 + FR-HRD-002 — Audit trail and DSAR workflows

Test first: tests/test_audit_trail.py tests/test_dsar.py
- Audit entry created for every decision (spend, policy, state change)
- Audit log immutable; update attempts fail
- DSAR request triggers data deletion
- DSAR completion within 24h
- Audit trail includes policy_bundle_id for every entry
Implement: src/compliance/audit_trail.py src/compliance/dsar.py
Must pass: uv run pytest tests/test_audit_trail.py tests/test_dsar.py -v
Commit: 'feat(compliance): FR-HRD-001 FR-HRD-002 Audit trail and DSAR'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 2: Incident response
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-003 — Incident doctrine and automation

Test first: tests/test_incident_response.py
- Classify incident (overspend, unauthorized tool, data breach, policy failure)
- Route to correct responder based on class
- Execute playbook (freeze workflow, notify, create case)
- Playbook execution is deterministic and idempotent
Implement: src/compliance/incident_response.py
Must pass: uv run pytest tests/test_incident_response.py -v
Commit: 'feat(compliance): FR-HRD-003 Incident response'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

# Agent 3: Test coverage + load test
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-004 + FR-HRD-005 — Full test coverage and load testing

Work item:
1. Audit test coverage: uv run pytest --cov=src --cov-report=term-missing
2. Add integration tests for any module with coverage <95%
3. Load test: simulate 1000 agents, measure p99 latency
   - Use Apache JMeter or custom Python script
   - Target: p99 latency <5s, zero timeouts
4. Report coverage and load test results

No single file per task (cross-cutting concern).
Must pass: uv run pytest --cov=src --cov-report=term-missing -v
           uv run tests/load_test.py --agents 1000
Commit: 'test: FR-HRD-004 FR-HRD-005 Full coverage and load tests'
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &

wait
```

### Exit Criteria (M6 Must Be True)
1. **Audit trail append-only** — entry created, attempt to update → rejection
2. **DSAR processed in <24h** — request → deletion → confirmation
3. **Incident playbook executable** — trigger incident → playbook runs to completion
4. **Test coverage ≥95%** — pytest --cov reports ≥95% across all modules
5. **Load test passes** — 1000 concurrent agents, p99 latency <5s
6. **Zero data loss** — reconciliation still passes after load test
7. **All M0–M6 systems integrated** — process-compose up → everything runs

---

## Overall Integration Checkpoints

### Week 2 (Post-M0)
- All services running: PostgreSQL, NATS, Redis, process-compose, schema registry
- No data loss test passes
- Event envelope validation active

### Week 4 (Post-M1)
- Founder API responds on :8000
- Policy bundle versioning works
- Tool allowlist blocks unauthorized calls

### Week 6 (Post-M2)
- Agents spawn and execute tasks
- Tracer captures deterministic logs
- Replay verification works

### Week 8 (Post-M3)
- Spend authorization enforces default-deny
- Ledger balances (debit = credit)
- Reconciliation detects drift

### Week 10 (Post-M4)
- Artifacts deterministically build
- Provenance signature verifies
- Cache hit returns identical bytes

### Week 12 (Post-M5)
- Ventures tracked with P&L
- Portfolio optimizer recommends tier changes
- Tier spend limits enforced

### Week 14 (Post-M6)
- Full audit trail present
- DSAR executable in <24h
- Load test passes 1000 agents
- All tests pass; coverage ≥95%

---

## Success Criteria (MVP Definition)

The Venture platform MVP is **complete** when all of the following are true:

1. **Process-Compose Baseline:** All services (PostgreSQL, NATS, Redis, schema registry, orchestrator, API, compiler, ledger) start via `process-compose up` with zero manual steps
2. **Event Envelope Compliance:** Every external effect emits EventEnvelopeV1 with valid `event_id`, `trace_id`, `workflow_id`, `policy_bundle_id`
3. **Policy Governance:** No unauthorized spend; all spend decisions include `reason_code` and `policy_bundle_id`
4. **Agent Execution:** L1/L2 agents dispatch tasks; L3 copilot pool spawns workers; tasks complete deterministically
5. **Financial Correctness:** Ledger balances; reconciliation passes; no data loss
6. **Artifact Determinism:** Artifacts build byte-identically when toolchain/IR/policy are pinned
7. **Compliance Completeness:** Audit trail present; DSAR executable; incident playbooks automated
8. **Quality Gates:** Test coverage ≥95%; all linters pass; zero new suppressions; load test passes 1000 agents
9. **Documentation:** All specs linked from `TECHNICAL_SPEC.md`; all FRs traced to tests

---

## L3 Agent Dispatch Best Practices

All M0–M6 tasks use this pattern:

1. **Test-First:** Failing test in `tests/test_*.py` before implementation
2. **Single Module:** Agent works on one module only; cross-module changes are pre-coordinated
3. **Atomic Commits:** Each commit must pass: pytest, ruff, mypy, no test suppressions
4. **No Push:** Agent commits but does not push to remote
5. **Monitoring:** User watches git log for commit arrival; reviews via `git show`
6. **Worktree Merge:** User merges worktree back to main after review

---

## Timeline Summary

| Milestone | Dates | Wall-Clock | Key Deliverable |
|-----------|-------|-----------|-----------------|
| M0: Foundation | Week 1–2 | 2 weeks | PostgreSQL, NATS, Redis, process-compose, schema registry |
| M1: Control Plane | Week 3–4 | 2 weeks | Policy engine, tool allowlist, founder API, FSM |
| M2: Agent Runtime | Week 5–6 | 2 weeks | L1/L2 orchestrator, L3 copilot pool, tracer |
| M3: Treasury | Week 7–8 | 2 weeks | Money API, ledger, reconciliation, compliance |
| M4: Artifact Compiler | Week 9–10 | 2 weeks | IR schemas, deterministic build, provenance |
| M5: Venture Portfolio | Week 11–12 | 2 weeks | Venture registry, P&L, optimizer, tier enforcement |
| M6: Compliance + Hardening | Week 13–14 | 2 weeks | Audit trail, DSAR, incident response, load test |

**Total:** 12–14 weeks to full v1 MVP

---

## Decision Log

**ADR-1:** Why not start with artifact compiler? Because M0 foundation (event bus, schema registry) unblocks all other tracks in parallel.

**ADR-2:** Why double-entry ledger and not simple balance sheet? Because double-entry provides built-in error detection (debit = credit) and compliance audit trail.

**ADR-3:** Why L3 copilot agents in parallel? Because test-first + isolated modules allow true parallelism without merge conflicts.

**ADR-4:** Why strict event envelope validation? Because every team member needs to trust that external effects are properly governed and auditable.

---

## Appendix: Reference Links

- `TECHNICAL_SPEC.md` — Control plane architecture
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` — Artifact compiler contracts
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Money control and compliance
- `TRACK_C_CONTROL_PLANE.md` — Policy engine and FSM framework
- `API_EVENTS_SPEC.md` — Event envelope and taxonomy
- `DATA_MODEL_DB_SPEC.md` — Schema definitions
- `OPS_COMPLIANCE_SPEC.md` — Compliance machine and audit cadence
- `SCHEMA_PACK.md` — Consolidated schema definitions
- `ROLE_TOOL_ALLOWLIST_MATRIX.md` — Per-role capability model

---

**Roadmap Status:** ACTIVE
**Last Updated:** 2026-02-21
**Next Review:** Post-M0 (end of week 2)
