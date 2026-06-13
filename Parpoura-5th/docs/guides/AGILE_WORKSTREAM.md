# Agile+ Workstream Guide: Venture Platform

**Date:** 2026-02-21
**Status:** ACTIVE
**Purpose:** Define sprint structure, ceremonies, and coordination model for Venture MVP delivery

---

## Overview

The Venture platform is delivered as a series of 2-week **sprints**, each aligned to a milestone phase (M0–M6). Each sprint:
- Has a clear entry condition (prior phase complete)
- Runs 3 parallel L3 copilot agents
- Produces shippable artifacts (code + tests passing)
- Has explicit exit criteria (all tests ≥80% coverage, zero suppressions)
- Results in a merged worktree on main branch

**Total Timeline:** 12–14 weeks (6–7 sprints) to full v1 MVP

---

## Sprint Structure

### Sprint 0: M0 Foundation (Week 1–2)

**Entry Condition:** Project initialized; all specs finalized

**Theme:** Stand up all infrastructure; establish baseline data persistence and event governance

**Stories:**
- `FR-INFRA-001`: PostgreSQL schema + Alembic migrations
- `FR-INFRA-002`: NATS JetStream streams (events + tasks)
- `FR-INFRA-003`: Redis cache + rate limiter
- `FR-INFRA-004`: process-compose manifest with health checks
- `FR-INFRA-005`: Schema registry + EventEnvelopeV1 validation

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m0-dispatch.sh

set -e

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m0-foundation"

# Create worktree if not exists
if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Dispatch 3 parallel agents

# Agent 1: PostgreSQL + migrations
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema via Alembic

Test first: tests/test_db_migrations.py
- Verify artifact_ir, ledger, audit_log, policy_bundles tables exist
- Verify all required columns present
- Verify migrations run idempotently

Implement: alembic/versions/ and src/infra/db.py

Must pass:
  uv run pytest tests/test_db_migrations.py -v
  uv run alembic upgrade head
  uv run alembic downgrade base
  uv run alembic upgrade head

Must pass linting:
  uv run ruff check src/infra/db.py

Commit message: "feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: NATS JetStream setup
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — Stand up NATS JetStream streams

Test first: tests/test_nats_streams.py
- Verify events.* stream created with replication 3
- Verify tasks.* stream created with replication 3
- Verify durable subscriptions persist
- Verify pub-sub round-trip works

Implement: src/infra/nats_setup.py

Must pass:
  uv run pytest tests/test_nats_streams.py -v

Must pass linting:
  uv run ruff check src/infra/nats_setup.py

Commit message: "feat(infra): FR-INFRA-002 NATS JetStream setup"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: Schema registry + EventEnvelopeV1 validation
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 + FR-INFRA-005 — Schema registry and EventEnvelopeV1

Test first: tests/test_schema_registry.py
- Test EventEnvelopeV1 accepts valid events
- Test EventEnvelopeV1 rejects malformed events
- Test schema versioning works
- Test schema caching works

Implement: src/infra/schema_registry.py

Also: src/infra/redis.py for cache (uses Redis from local setup)

Must pass:
  uv run pytest tests/test_schema_registry.py -v

Must pass linting:
  uv run ruff check src/infra/schema_registry.py src/infra/redis.py

Commit message: "feat(infra): FR-INFRA-003 FR-INFRA-005 Schema registry and EventEnvelopeV1"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Wait for all agents
wait

echo "M0 Sprint dispatch complete. All agents should have committed."
echo "Review commits and merge worktree:"
echo "  git switch main"
echo "  git merge $WTV"
```

**Definition of Done (M0)**
- [ ] All 5 stories implemented and tested
- [ ] Tests pass: `pytest tests/test_db_migrations.py tests/test_nats_streams.py tests/test_schema_registry.py -v`
- [ ] Coverage ≥80% for all infra modules
- [ ] No new suppressions in code
- [ ] All commits follow format: `feat(infra): FR-XXX-YYY description`
- [ ] Worktree merged to main
- [ ] `process-compose up` starts all services successfully

**Exit Criteria (M0 Complete)**
1. PostgreSQL migrations run idempotently
2. NATS streams persist data across restart
3. Schema registry validates EventEnvelopeV1 correctly
4. Event replay from NATS produces identical results
5. All services respond to health checks

---

### Sprint 1: M1 Control Plane Part 1 (Week 3–4a)

**Entry Condition:** M0 complete and merged; all infra services running

**Theme:** Policy engine, tool allowlist, FSM framework

**Stories:**
- `FR-CP-001`: Policy engine + bundle versioning
- `FR-CP-002`: Tool allowlist engine
- `FR-CP-004`: FSM framework

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m1a-dispatch.sh

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m1-control-plane"

if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Agent 1: Policy engine
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-001 — Policy engine with bundle versioning

Test first: tests/test_policy_engine.py
- Test policy bundle CRUD
- Test schema snapshot on creation
- Test every decision includes policy_bundle_id and reason_code
- Test policy replay: old decision with old bundle produces same result

Implement: src/control_plane/policy_engine.py

Must pass:
  uv run pytest tests/test_policy_engine.py -v

Commit: "feat(control-plane): FR-CP-001 Policy engine and bundle versioning"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: Tool allowlist
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-002 — Tool allowlist engine

Test first: tests/test_tool_allowlist.py
- Test role-to-tools mapping
- Test allowlist enforcement: allowed tool → permit, denied tool → 403
- Test agent_role propagation in trace

Implement: src/control_plane/tool_allowlist.py

Must pass:
  uv run pytest tests/test_tool_allowlist.py -v

Commit: "feat(control-plane): FR-CP-002 Tool allowlist engine"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: FSM framework
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-004 — FSM framework for workflow/task/action state machines

Test first: tests/test_fsm.py
- Test FSM states and transitions
- Test invalid transitions rejected
- Test events emitted on entry/exit
- Test idempotent state transitions

Implement: src/control_plane/fsm.py

Must pass:
  uv run pytest tests/test_fsm.py -v

Commit: "feat(control-plane): FR-CP-004 FSM framework"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

echo "M1a Sprint dispatch complete."
echo "Merge: git switch main && git merge $WTV"
```

**Definition of Done (M1a)**
- [ ] Policy engine stores bundles + versions + snapshots
- [ ] Tool allowlist correctly enforces per-role permissions
- [ ] FSM validates transitions; rejects invalid ones
- [ ] All tests pass; coverage ≥80%
- [ ] No suppressions

---

### Sprint 1b: M1 Control Plane Part 2 (Week 4b)

**Entry Condition:** M1a complete; policy + tool allowlist + FSM running

**Theme:** Founder API and WebSocket

**Stories:**
- `FR-CP-003`: Founder REST API
- `FR-CP-005`: WebSocket live feed

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m1b-dispatch.sh

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m1b-api"

if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Agent: Founder API + WebSocket
copilot -p "$(cat <<'PROMPT'
Task: FR-CP-003 + FR-CP-005 — Founder REST API and WebSocket live feed

Test first: tests/test_founder_api.py tests/test_websocket.py
- Test API CRUD for policies, workspaces, agents
- Test WebSocket subscribers receive state changes
- Test latency < 100ms for WebSocket messages

Implement: src/control_plane/api.py (FastAPI) and src/control_plane/websocket.py

Must pass:
  uv run pytest tests/test_founder_api.py tests/test_websocket.py -v

Commit: "feat(control-plane): FR-CP-003 FR-CP-005 Founder API and WebSocket"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

echo "M1b Sprint dispatch complete."
echo "Merge: git switch main && git merge $WTV"
```

**Definition of Done (M1b)**
- [ ] Founder API responds on :8000
- [ ] All CRUD endpoints tested and passing
- [ ] WebSocket broadcasts with <100ms latency
- [ ] All tests pass; coverage ≥80%

---

### Sprint 2: M2 Agent Runtime (Week 5–6)

**Entry Condition:** M1 complete; control plane running

**Theme:** Agent orchestration, task execution, deterministic replay

**Stories:**
- `FR-RT-001`: L1/L2 orchestrator
- `FR-RT-002`: L3 copilot pool
- `FR-RT-003`: Task envelope
- `FR-RT-004`: Tracer
- `FR-RT-005`: Integration

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m2-dispatch.sh

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m2-runtime"

if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Agent 1: Orchestrator
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-001 — L1/L2 orchestrator with capability filtering

Test first: tests/test_orchestrator.py
- Test task dispatch based on required capability
- Test policy checks before dispatch
- Test timeout handling
- Test concurrent tasks isolation

Implement: src/runtime/orchestrator.py

Must pass:
  uv run pytest tests/test_orchestrator.py -v

Commit: "feat(runtime): FR-RT-001 L1/L2 orchestrator"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: Copilot pool
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-002 — L3 copilot pool with health monitoring

Test first: tests/test_copilot_pool.py
- Test worker spawn with env vars
- Test health check detection (< 10s)
- Test dead worker replacement
- Test graceful shutdown

Implement: src/runtime/copilot_pool.py

Must pass:
  uv run pytest tests/test_copilot_pool.py -v

Commit: "feat(runtime): FR-RT-002 L3 copilot pool"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: Task envelope + tracer
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-003 + FR-RT-004 — Task envelope and tracer

Test first: tests/test_task_envelope.py tests/test_tracer.py
- Test envelope wraps task with context (trace_id, workflow_id, agent_role, budget)
- Test tracer logs inputs, outputs, execution time
- Test replay: rebuild from trace logs, outputs match original
- Test deterministic: same replay twice = same output

Implement: src/runtime/task_envelope.py src/runtime/tracer.py

Must pass:
  uv run pytest tests/test_task_envelope.py tests/test_tracer.py -v

Commit: "feat(runtime): FR-RT-003 FR-RT-004 Task envelope and tracer"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

# Wait for agents to complete, then integration test
echo "Agents complete. Now testing integration..."

# Manual integration test
copilot -p "$(cat <<'PROMPT'
Task: FR-RT-005 — Runtime integration: orchestrator + pool + envelope + tracer

Test first: tests/test_runtime_integration.py
- 10 concurrent tasks dispatched, all complete
- All traces logged and queryable
- Agent death detected and logged
- Replay verification: 5 tasks replayed, outputs match original

Implement: integration test only (no new modules)

Must pass:
  uv run pytest tests/test_runtime_integration.py -v

Commit: "test(runtime): FR-RT-005 Runtime integration tests"

Do not: push
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

echo "M2 Sprint dispatch complete."
echo "Merge: git switch main && git merge $WTV"
```

**Definition of Done (M2)**
- [ ] Agents spawn and accept tasks
- [ ] Task envelope injects all context fields
- [ ] Traces logged and queryable
- [ ] Replay verification produces identical outputs
- [ ] Agent death detected within 10s
- [ ] Concurrent tasks isolated
- [ ] All tests pass; coverage ≥80%

---

### Sprint 3: M3 Treasury (Week 7–8)

**Entry Condition:** M2 complete; agent runtime operational

**Theme:** Financial controls, ledger, reconciliation

**Stories:**
- `FR-TRE-001`: Money authorization API
- `FR-TRE-002`: Double-entry ledger
- `FR-TRE-003`: Authorization + ledger integration
- `FR-TRE-004`: Reconciliation
- `FR-TRE-005`: Compliance gates

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m3-dispatch.sh

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m3-treasury"

if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Agent 1: Money API
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-001 — Default-deny money authorization

Test first: tests/test_money_api.py
- Spend without intent → 403
- Spend with valid intent → 200 + authorization_id
- Reason_code and policy_bundle_id logged
- No fallback on intent check

Implement: src/treasury/money_api.py

Must pass:
  uv run pytest tests/test_money_api.py -v

Commit: "feat(treasury): FR-TRE-001 Money authorization API"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: Ledger + reconciliation
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-002 + FR-TRE-004 — Double-entry ledger and reconciliation

Test first: tests/test_ledger.py tests/test_reconciliation.py
- Ledger: debit + credit pairs, immutable entries, sum to zero
- Reconciliation: daily run compares to processor export, detects drift > $0.01

Implement: src/treasury/ledger.py src/treasury/reconciliation.py

Must pass:
  uv run pytest tests/test_ledger.py tests/test_reconciliation.py -v

Commit: "feat(treasury): FR-TRE-002 FR-TRE-004 Ledger and reconciliation"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: Integration + compliance
copilot -p "$(cat <<'PROMPT'
Task: FR-TRE-003 + FR-TRE-005 — Authorization-ledger integration and compliance gates

Test first: tests/test_authorization_ledger.py tests/test_compliance_gates.py
- Authorization → ledger entry created immediately
- Compliance gates block spend based on jurisdiction
- Fail-closed: if policy unavailable, deny

Implement: src/treasury/compliance_gates.py (integration happens in money_api.py)

Must pass:
  uv run pytest tests/test_authorization_ledger.py tests/test_compliance_gates.py -v

Commit: "feat(treasury): FR-TRE-003 FR-TRE-005 Integration and compliance gates"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

echo "M3 Sprint dispatch complete."
echo "Merge: git switch main && git merge $WTV"
```

**Definition of Done (M3)**
- [ ] Unauthorized spends rejected
- [ ] Ledger balances
- [ ] Reconciliation detects drift and creates case
- [ ] Compliance policy enforces jurisdiction controls
- [ ] All tests pass; coverage ≥85%

---

### Sprint 4: M4 Artifact Compiler (Week 9–10)

**Entry Condition:** M3 complete; treasury operational

**Theme:** Artifact IR, deterministic compilation, provenance

**Stories:**
- `FR-ART-001`: IR schemas
- `FR-ART-002`: Compiler pipeline
- `FR-ART-003`: Build cache
- `FR-ART-004`: Provenance
- `FR-ART-005`: Replay verification

**L3 Agent Dispatch Batch Script** — Similar pattern to M3; 3 parallel agents

**Definition of Done (M4)**
- [ ] IR schemas validate all artifact types
- [ ] Deterministic builds: same IR + toolchain = byte-identical output
- [ ] Build cache works; cache hits return identical bytes
- [ ] Provenance signature verifies
- [ ] Replay verification passes
- [ ] All tests pass; coverage ≥85%

---

### Sprint 5: M5 Venture Portfolio (Week 11–12)

**Entry Condition:** M4 complete; artifact compiler operational

**Theme:** Venture registry, P&L tracking, portfolio management

**Stories:**
- `FR-PF-001`: Venture registry
- `FR-PF-002`: P&L engine
- `FR-PF-003`: Health score
- `FR-PF-004`: Portfolio optimizer
- `FR-PF-005`: Tier enforcement

**L3 Agent Dispatch Batch Script** — 3 parallel agents; similar pattern

**Definition of Done (M5)**
- [ ] Ventures created and tracked with tiers
- [ ] P&L accurate (profit = revenue - spend)
- [ ] Portfolio optimizer recommends tier changes
- [ ] Tier spend limits enforced
- [ ] All tests pass; coverage ≥80%

---

### Sprint 6: M6 Compliance + Hardening (Week 13–14)

**Entry Condition:** M5 complete; all systems integrated

**Theme:** Audit trail, DSAR, incident response, load testing

**Stories:**
- `FR-HRD-001`: Audit trail (append-only)
- `FR-HRD-002`: DSAR orchestration
- `FR-HRD-003`: Incident classification + response
- `FR-HRD-004`: Test coverage (≥95%)
- `FR-HRD-005`: Load test (1000 agents)

**L3 Agent Dispatch Batch Script**
```bash
#!/bin/bash
# sprint-m6-dispatch.sh

REPO_PATH="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m6-hardening"

if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

# Agent 1: Audit + DSAR
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-001 + FR-HRD-002 — Audit trail and DSAR workflows

Test first: tests/test_audit_trail.py tests/test_dsar.py
- Audit trail: append-only, immutable, includes policy_bundle_id
- DSAR: request → process → deletion within 24h

Implement: src/compliance/audit_trail.py src/compliance/dsar.py

Must pass:
  uv run pytest tests/test_audit_trail.py tests/test_dsar.py -v

Commit: "feat(compliance): FR-HRD-001 FR-HRD-002 Audit and DSAR"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2: Incident response
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-003 — Incident classification and automated response

Test first: tests/test_incident_response.py
- Classify: OVERSPEND, UNAUTHORIZED_TOOL, DATA_BREACH, POLICY_FAILURE
- Execute playbooks: freeze workflow, revoke capability, create case
- Idempotent execution

Implement: src/compliance/incident_response.py

Must pass:
  uv run pytest tests/test_incident_response.py -v

Commit: "feat(compliance): FR-HRD-003 Incident response"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3: Coverage + load test
copilot -p "$(cat <<'PROMPT'
Task: FR-HRD-004 + FR-HRD-005 — Test coverage audit and load testing

Work:
1. Run coverage: pytest --cov=src --cov-report=term-missing
2. Identify modules with <95% coverage
3. Add integration tests for gaps
4. Load test: spawn 1000 agents, each runs 10 tasks
   - Measure: latency p50/p95/p99, throughput, errors
   - Acceptance: p99 < 5s, throughput > 100 tasks/sec

Must pass:
  pytest --cov=src --cov-report=term-missing -v
  tests/load_test.py --agents 1000

Commit: "test: FR-HRD-004 FR-HRD-005 Full coverage and load tests"

Do not: push
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO_PATH" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait

echo "M6 Sprint dispatch complete."
echo "Merge: git switch main && git merge $WTV"
```

**Definition of Done (M6)**
- [ ] Audit trail append-only and tamper-evident
- [ ] DSAR processed in <24h; data deleted
- [ ] Incident playbooks execute automatically
- [ ] Test coverage ≥95% across all modules
- [ ] Load test passes: 1000 agents, p99 < 5s
- [ ] Reconciliation still passes after load test (no data loss)

---

## Ceremony Schedule

### Weekly Sync (Every Monday, 9 AM)
- **Duration:** 30 min
- **Attendees:** Venture Platform Team (1 user, 3–5 L3 copilot agents)
- **Agenda:**
  1. Sprint status: which agents on track, which blockers
  2. Blocker resolution: dependencies, environment issues
  3. Upcoming sprint preview
- **Output:** Updated WORK_STREAM.md with status

### Sprint Planning (Day 1 of Sprint)
- **Duration:** 1 hour
- **Attendees:** Venture Platform Team
- **Agenda:**
  1. Review exit criteria for previous sprint
  2. Confirm all dependencies met
  3. Dispatch L3 agent batch script
  4. Define success metrics for sprint
- **Output:** Worktree created; agents dispatched; monitoring set up

### Daily Standup (Async, End of Each Day)
- **Format:** Commit log review
- **Check:** `git log --oneline venture-wt-m{N}-* | head -10`
- **Verify:** Agents making progress; commits formatted correctly; tests passing

### Sprint Review (End of Sprint)
- **Duration:** 1 hour
- **Attendees:** Venture Platform Team
- **Agenda:**
  1. Demo: run all tests for sprint
  2. Verify coverage ≥80%
  3. Review commits and code quality
  4. Discuss next sprint readiness
- **Output:** Decision to merge worktree or rework

### Sprint Retrospective (End of Sprint, Optional)
- **Duration:** 30 min
- **Attendees:** Venture Platform Team
- **Agenda:**
  1. What went well?
  2. What could improve?
  3. Adjust agent dispatch script or guidance for next sprint
- **Output:** Updated L3 dispatch script with lessons learned

---

## Monitoring and Observability

### Git Log Monitoring (Real-Time)
```bash
# Watch for new commits
watch -n 5 'git log --oneline venture-wt-m*.* | head -20'

# Or scripted:
while true; do
  clear
  echo "=== M0 Foundation ==="
  git log --oneline venture-wt-m0-foundation | head -5
  sleep 10
done
```

### Test Results Tracking
```bash
# After each agent completes:
git switch venture-wt-m{N}-{name}
uv run pytest tests/ -v --tb=short
uv run ruff check src/
```

### Coverage Dashboard
```bash
# Post-sprint:
uv run pytest --cov=src --cov-report=html
open htmlcov/index.html  # View coverage by module
```

---

## Git Worktree Management

### Create Worktree (Sprint Start)
```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour
git worktree add ../venture-wt-m{N}-{name} main
cd ../venture-wt-m{N}-{name}
```

### Review Commits (User, During Sprint)
```bash
# See what agents committed
git log --oneline -20

# Review specific commit
git show <commit-hash>

# See all changes since main
git diff main..HEAD
```

### Merge Worktree (Sprint End)
```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour
git switch main
git merge venture-wt-m{N}-{name}
git worktree remove ../venture-wt-m{N}-{name}
```

### If Merge Conflict
```bash
# Resolve manually
git status
# Edit conflicting files
git add <resolved-files>
git commit -m "merge: resolve conflicts from venture-wt-m{N}-{name}"
```

---

## L3 Agent Best Practices

### Commit Message Format
```
feat(module): FR-XXX-YYY Short description

Optional longer description. What was implemented.
Why this approach. Any tradeoffs considered.

Tests: pytest tests/test_module.py -v [PASS]
Lint: ruff check src/module.py [PASS]
```

### What to Do If Stuck
1. **First:** Check PLAN.md for acceptance criteria; are you on track?
2. **Second:** Review test failures carefully; run locally
3. **Third:** If true blocker (e.g., missing service), ask user via commit message or note
4. **Fourth:** Never commit failing tests or suppressions

### Safe Permission Set by Task Type
- **Research tasks (reading specs, understanding code):** Read-only (`--allow-tool 'shell(git status)'`)
- **Write + test:** `--allow-tool 'write'` + `--allow-tool 'shell(uv:*)'` + `--allow-tool 'shell(git:*)'`
- **Infra setup:** Same as write + test, plus `--allow-tool 'shell(docker:*)'` if needed

---

## Cross-Sprint Dependencies

### M0 → M1 Critical Path
- M0 must complete PostgreSQL, NATS, Redis, process-compose before M1 can start policy engine

### M2 → M3 Critical Path
- M2 runtime must be working before M3 can test money authorization with real agent tasks

### M4 → M5 Critical Path
- M4 artifact compiler must be deterministic before M5 can build venture portfolio

### M6 Must Complete All Predecessors
- Load test (M6) requires all M0–M5 running without data loss

---

## Success Metrics for Entire Workstream

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Schedule Adherence** | 12–14 weeks | Wall-clock time from sprint 0 start to M6 merge |
| **Quality Gate** | ≥95% coverage | `pytest --cov=src --cov-report=term-missing` |
| **Test Pass Rate** | 100% | All tests pass on main branch |
| **Load Test** | p99 < 5s, 1000 agents | `tests/load_test.py --agents 1000` |
| **Reconciliation** | Zero drift | Ledger balances; processor export matches |
| **Suppressions** | Zero new | No new `# noqa`, `# pragma`, `# type: ignore` |
| **Commits** | Clean format | All commits follow `feat(module): FR-XXX description` |

---

## Troubleshooting

### Agent Not Making Progress
1. Check copilot session: `ls -la ~/.copilot/sessions/`
2. Check error logs in agent output
3. Re-dispatch agent with `--resume` flag (if stuck in infinite loop)
4. Check task dependencies: is required predecessor complete?

### Test Failure During Sprint
1. Pull latest from main: `git fetch origin main`
2. Rebase on main: `git rebase main` (in worktree)
3. Run tests locally: `uv run pytest tests/test_module.py -v`
4. Fix code; commit; continue

### Data Loss During Load Test
1. Check reconciliation: `uv run pytest tests/test_reconciliation.py -v`
2. Check ledger balance: `SELECT SUM(amount) FROM ledger WHERE type='DEBIT'` vs CREDIT
3. If drift: investigate transaction log; fix missing entries
4. Run reconciliation again

### Merge Conflict in Worktree
1. List conflicting files: `git status`
2. Open each file; resolve manually
3. `git add <file>` for each resolved file
4. `git commit -m "merge: resolve conflicts"`

---

## Appendix: Sprint at a Glance

| Sprint | Milestone | Dates | Key Deliverables | Exit Gate |
|--------|-----------|-------|------------------|-----------|
| 0 | M0: Foundation | Wk 1–2 | PostgreSQL, NATS, Redis, process-compose, schema registry | All services up; event validation works |
| 1a | M1a: Control (Part 1) | Wk 3–4a | Policy engine, tool allowlist, FSM | Policy bundles versioned; FSM validates |
| 1b | M1b: Control (Part 2) | Wk 4b | Founder API, WebSocket | API responds; WebSocket broadcasts <100ms |
| 2 | M2: Runtime | Wk 5–6 | L1/L2 orchestrator, L3 pool, envelope, tracer | Agents execute; replay deterministic |
| 3 | M3: Treasury | Wk 7–8 | Money API, ledger, reconciliation, compliance | Ledger balances; reconciliation detects drift |
| 4 | M4: Compiler | Wk 9–10 | IR schemas, pipeline, cache, provenance | Builds deterministic; provenance verifies |
| 5 | M5: Portfolio | Wk 11–12 | Venture registry, P&L, optimizer, tier enforcement | P&L accurate; optimizer recommends |
| 6 | M6: Compliance | Wk 13–14 | Audit trail, DSAR, incident response, load test | Coverage ≥95%; load test passes 1000 agents |

---

**Workstream Status:** ACTIVE
**Last Updated:** 2026-02-21
**Next Review:** Sprint 0 Planning (Day 1)
