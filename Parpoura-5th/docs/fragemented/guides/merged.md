# Merged Fragmented Markdown

## Source: guides/AGILE_WORKSTREAM.md

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


---

## Source: guides/COPILOT_L3_AGENTS.md

# L3 Copilot Agents: Complete Guide

**Date:** 2026-02-21
**Status:** ACTIVE
**Purpose:** Comprehensive guide to dispatching, monitoring, and managing L3 copilot agents for Venture platform

---

## Quick Start

### Standard Dispatch Pattern

```bash
copilot -p "$(cat <<'PROMPT'
Task: FR-XXX-YYY — Brief description

Test first: tests/test_module.py
- Acceptance criterion 1
- Acceptance criterion 2
- Acceptance criterion 3

Implement: src/module/file.py

Must pass:
  uv run pytest tests/test_module.py -v
  uv run ruff check src/module/file.py

Commit: "feat(module): FR-XXX-YYY short description"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

**Key Points:**
- Task must be **specific** and **measurable**
- Always write **test first**
- Include **acceptance criteria**
- Specify **files to implement**
- Include **validation commands**
- Commit message format: `feat(module): FR-XXX description`
- Always deny `git push`
- Run in **background** with `&` for parallel dispatch

---

## Task Structure (Template)

```
Task: {FR-ID} — {Short title}

Test first: {test_file_path}
- {Acceptance criterion 1}
- {Acceptance criterion 2}
- {Acceptance criterion 3}

Implement: {source_file_paths}

Must pass:
  {validation_command_1}
  {validation_command_2}

Commit: "{commit_message}"

Do not: {forbidden_actions}
```

### Example: Policy Engine
```
Task: FR-CP-001 — Policy engine with bundle versioning

Test first: tests/test_policy_engine.py
- Policy bundle CRUD works (create, read, update, delete)
- Schema snapshot stored on creation
- Every decision includes policy_bundle_id and reason_code
- Policy replay: evaluate old decision with old bundle produces same result

Implement: src/control_plane/policy_engine.py

Must pass:
  uv run pytest tests/test_policy_engine.py -v
  uv run ruff check src/control_plane/policy_engine.py

Commit: "feat(control-plane): FR-CP-001 Policy engine and bundle versioning"

Do not: push, modify other modules, add new suppressions
```

---

## Full Dispatch Command Examples

### 1. Simple Single Task

```bash
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema

Test first: tests/test_db_migrations.py
- Artifact IR table created with correct columns
- Ledger table created with correct columns
- Migrations run idempotently (twice = same state)
- Rollback works: upgrade → downgrade → upgrade = same state

Implement: alembic/versions/ and src/infra/db.py

Must pass:
  uv run pytest tests/test_db_migrations.py -v
  uv run alembic upgrade head
  uv run alembic downgrade base
  uv run alembic upgrade head
  uv run ruff check src/infra/db.py

Commit: "feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### 2. Batch Dispatch (3 Parallel Agents)

```bash
#!/bin/bash
# sprint-m0-agents.sh

REPO="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"

# Agent 1
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — PostgreSQL schema...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — NATS JetStream...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 — Schema registry...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait
echo "All agents dispatched. Review commits:"
echo "  git log --oneline -10"
```

### 3. Research Task (Read-Only)

```bash
copilot -p "$(cat <<'PROMPT'
Task: Research — Understand TRACK_A_ARTIFACT_DETERMINISM_SPEC

Read: /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour/TRACK_A_ARTIFACT_DETERMINISM_SPEC.md

Summarize:
1. What are the 5 IR types?
2. What is the deterministic build/replay contract?
3. What is the idempotency key?

Output: Plain text summary (no code)
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

---

## Monitoring L3 Agents

### Real-Time Commit Watching

```bash
# Watch for commits every 5 seconds
watch -n 5 'git log --oneline | head -20'

# Or use a loop in background:
while true; do
  clear
  date
  git log --oneline | head -10
  sleep 10
done
```

### Check Agent Status

```bash
# List copilot sessions
ls -la ~/.copilot/sessions/

# Check most recent session
cat ~/.copilot/sessions/$(ls -t ~/.copilot/sessions | head -1)/status.json

# Or use copilot CLI (if available)
copilot status
```

### Verify Commits

```bash
# See all new commits
git log --oneline origin/main..HEAD

# Review specific commit
git show <commit-hash>

# See changes in a module
git diff origin/main..HEAD -- src/control_plane/
```

### Test Progress

```bash
# Run tests for a specific module
uv run pytest tests/test_policy_engine.py -v

# Check coverage
uv run pytest tests/test_policy_engine.py --cov=src/control_plane/policy_engine

# Run all tests
uv run pytest tests/ -v --tb=short
```

---

## Task Success Scenarios

### Scenario 1: Agent Completes Successfully
```
1. Commit arrives in git log
2. User reviews: git show <hash>
3. User checks tests: uv run pytest tests/test_module.py -v
4. All green → ready to merge
```

### Scenario 2: Agent Gets Stuck (Infinite Loop)
```
1. Agent makes no progress for 15+ minutes
2. Check session: cat ~/.copilot/sessions/*/status.json
3. Kill agent: pkill copilot (or equivalent)
4. Re-dispatch with --resume flag:
   copilot -p "Task: FR-XXX..." --yolo --resume
```

### Scenario 3: Test Failure
```
1. Commit arrives but tests fail
2. User reviews test output: git show <hash>
3. User can:
   a. Re-dispatch agent with error context:
      copilot -p "$(cat <<'PROMPT'
      Task: FR-XXX — description
      Previous attempt failed with: [error message]
      ...
      PROMPT
      )" --yolo --model gpt-5-mini ...
   b. Or fix manually and commit
```

### Scenario 4: Dependency Not Met
```
1. Agent tries to implement FR-CP-002 (tool allowlist)
2. But FR-CP-001 (policy engine) not yet merged
3. Agent should detect and note in commit message or ask
4. User can:
   a. Merge dependency first, re-dispatch agent
   b. Or ask agent to implement with interface stub
```

---

## Permission Sets by Task Type

### Type 1: Test-First Implementation
**Permission Set:**
```bash
--allow-tool 'write'           # Create/edit files
--allow-tool 'shell(uv:*)'     # Run pytest, ruff, etc.
--allow-tool 'shell(git:*)'    # Commit, check status
--deny-tool 'shell(git push)'  # Never push
```

**Used For:** All FRs that require code implementation

**Example:**
```bash
copilot -p "Task: FR-CP-001 — Policy engine..." --yolo \
  --add-dir $REPO \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### Type 2: Database/Schema Tasks
**Permission Set:**
```bash
--allow-tool 'write'              # Edit migration files
--allow-tool 'shell(uv:*)'        # Run pytest, alembic
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(psql:*)'      # Query database (optional)
--deny-tool 'shell(git push)'
```

**Used For:** Database migrations, schema changes

### Type 3: Infrastructure Setup
**Permission Set:**
```bash
--allow-tool 'write'              # Edit config files
--allow-tool 'shell(uv:*)'        # Run pytest, checks
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(docker:*)'    # If Docker needed
--deny-tool 'shell(git push)'
```

**Used For:** process-compose setup, containerization

### Type 4: Research (Read-Only)
**Permission Set:**
```bash
--allow-tool 'shell(git:*)'       # Read git history
--allow-tool 'shell(find:*)'      # Search files
--deny-tool 'write'
--deny-tool 'shell(curl:*)'       # No external requests
```

**Used For:** Understanding specs, analyzing code

### Type 5: Load Testing
**Permission Set:**
```bash
--allow-tool 'write'              # Create test harness
--allow-tool 'shell(uv:*)'        # Run tests
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(ps:*)'        # Monitor processes
--deny-tool 'shell(kill:*)'       # Never kill processes
--deny-tool 'shell(git push)'
```

**Used For:** Performance testing, stress testing

---

## Troubleshooting L3 Agents

### Problem: Agent Produces Code with Suppressions

**Symptom:** Commit includes `# noqa` or `# pragma: no cover`

**Fix:**
1. Reject commit (don't merge)
2. Re-dispatch with instruction:
   ```
   Previous code had suppressions. Do not add suppression comments.
   Instead, fix the underlying issue so code passes linting.
   If suppression necessary, include inline justification:
   # noqa: E501 -- long line is unavoidable for this SQL query
   ```

### Problem: Agent Modifies Wrong Module

**Symptom:** Commit touches `src/treasury/` when task was for `src/control_plane/`

**Fix:**
1. Check if change is justified (e.g., necessary cross-module integration)
2. If not: revert commit; re-dispatch with stricter constraints
   ```
   --add-dir $REPO
   --allow-tool 'write'  # but will implicitly block files outside task scope
   ```

### Problem: Agent Doesn't Write Tests

**Symptom:** Commit has implementation but no test file

**Fix:**
1. Re-dispatch:
   ```
   Task: FR-XXX — [same task]

   Previous attempt missing tests. You must:
   1. First write failing test in tests/test_module.py
   2. Then implement in src/module.py
   3. Ensure test passes

   Must pass:
     pytest tests/test_module.py -v
   ```

### Problem: Agent Commit Message Malformed

**Symptom:** Commit message is `wip`, `fix`, or doesn't follow `feat(module): FR-XXX`

**Fix:**
1. Amend locally (or ask agent to re-commit):
   ```bash
   git commit --amend -m "feat(module): FR-XXX-YYY short description"
   ```
2. Or re-dispatch with clearer instruction:
   ```
   Commit message format MUST be:
   feat(module): FR-XXX-YYY short description

   Where:
   - module = the folder under src/ (e.g., "control-plane", "treasury")
   - FR-XXX-YYY = the FR ID (e.g., "FR-CP-001")
   - Short description = 1-line summary
   ```

### Problem: Agent Runs Out of Time

**Symptom:** Copilot process times out; incomplete work

**Fix:**
1. Check if intermediate commits exist: `git log --oneline | head -10`
2. If partial work: re-dispatch with `--resume` flag
3. Or simplify task scope:
   ```
   Task: FR-XXX — [PART 2] Continue from previous attempt

   Previous attempt timed out. Please complete:
   - [List remaining work items]

   You may skip: [Items already done]
   ```

---

## Batch Dispatch Scripts

### M0 Foundation Sprint Script

```bash
#!/bin/bash
# scripts/dispatch-m0.sh

set -e

REPO="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m0-foundation"

# Ensure worktree exists
if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

echo "Dispatching M0 agents to worktree: $WTV"

# Agent 1: PostgreSQL
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema via Alembic

Test first: tests/test_db_migrations.py
- Table artifact_ir exists with all required columns
- Table ledger exists with all required columns
- Table audit_log exists with all required columns
- Table policy_bundles exists with all required columns
- Migrations run idempotently
- Rollback and upgrade both work

Implement: alembic/versions/ and src/infra/db.py

Must pass:
  uv run pytest tests/test_db_migrations.py -v
  uv run alembic upgrade head
  uv run alembic downgrade base
  uv run alembic upgrade head
  uv run ruff check src/infra/db.py

Commit: "feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID1=$!

# Agent 2: NATS
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — Stand up NATS JetStream streams

Test first: tests/test_nats_streams.py
- events.* stream created with replication 3
- tasks.* stream created with replication 3
- Publish-subscribe round-trip works
- Durable subscriptions persist across restart
- Stream configuration persisted

Implement: src/infra/nats_setup.py

Must pass:
  uv run pytest tests/test_nats_streams.py -v
  uv run ruff check src/infra/nats_setup.py

Commit: "feat(infra): FR-INFRA-002 NATS JetStream setup"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID2=$!

# Agent 3: Schema Registry
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 + FR-INFRA-005 — Redis cache and schema registry

Test first: tests/test_redis.py tests/test_schema_registry.py
- Redis SET/GET round-trip works
- Token bucket rate limiter works
- EventEnvelopeV1 schema validates correctly
- Invalid events rejected
- Schema versioning works
- Schema caching works

Implement: src/infra/redis.py and src/infra/schema_registry.py

Must pass:
  uv run pytest tests/test_redis.py tests/test_schema_registry.py -v
  uv run ruff check src/infra/redis.py src/infra/schema_registry.py

Commit: "feat(infra): FR-INFRA-003 FR-INFRA-005 Redis and schema registry"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID3=$!

echo "Waiting for agents to complete..."
wait $PID1 $PID2 $PID3

echo ""
echo "All agents completed. Review commits:"
git log --oneline | head -10
echo ""
echo "To merge: git switch main && git merge $WTV"
```

### Sprint Completion Checklist

```bash
#!/bin/bash
# scripts/sprint-checklist.sh

SPRINT=$1  # e.g., m0, m1, m2

if [ -z "$SPRINT" ]; then
  echo "Usage: sprint-checklist.sh {sprint_name}"
  exit 1
fi

echo "=== Sprint $SPRINT Checklist ==="

# Check tests
echo ""
echo "1. Running tests..."
if uv run pytest tests/ -v --tb=short 2>&1 | grep -q "FAILED"; then
  echo "   ❌ Some tests failed"
else
  echo "   ✓ All tests pass"
fi

# Check coverage
echo ""
echo "2. Checking coverage..."
COVERAGE=$(uv run pytest --cov=src --cov-report=term-missing | grep "TOTAL" | awk '{print $NF}')
echo "   Coverage: $COVERAGE"
if [[ ${COVERAGE%\%} -ge 80 ]]; then
  echo "   ✓ Coverage ≥80%"
else
  echo "   ❌ Coverage <80%"
fi

# Check linting
echo ""
echo "3. Running linter..."
if uv run ruff check src/ 2>&1 | grep -q "error"; then
  echo "   ❌ Linting errors"
else
  echo "   ✓ Linting passes"
fi

# Check suppressions
echo ""
echo "4. Checking for suppressions..."
SUPPR=$(grep -r "# noqa\|# pragma\|# type: ignore" src/ | wc -l)
if [ "$SUPPR" -eq 0 ]; then
  echo "   ✓ No suppressions"
else
  echo "   ❌ Found $SUPPR suppressions"
fi

# Check commits
echo ""
echo "5. Verifying commit format..."
git log --oneline -20 | while read line; do
  if [[ $line =~ ^[a-f0-9]\ (feat|fix|test|docs)\([a-z-]+\):\ (FR-|fix|test) ]]; then
    echo "   ✓ $line"
  else
    echo "   ❌ $line (format issue)"
  fi
done

echo ""
echo "=== Checklist Complete ==="
```

---

## Session Continuation (--resume)

If an agent gets stuck or times out:

```bash
# Re-dispatch with continuation context
copilot -p "$(cat <<'PROMPT'
Task: FR-XXX — [CONTINUED] Description

You were working on this task before but did not complete.

Progress so far:
- [Describe what was done]

Still needs:
- [Describe what remains]

You may skip: [What doesn't need to be done again]

Test first: tests/test_module.py
- [Remaining acceptance criteria]

Implement: src/module.py

Must pass:
  [validation commands]

Commit: "feat(module): FR-XXX description"
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --resume \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

---

## Best Practices

### 1. Clarity in Task Definition
- **Good:** "Implement policy engine with bundle versioning; policy bundles stored with schema snapshots; every decision includes policy_bundle_id"
- **Bad:** "Implement policy stuff"

### 2. Explicit Acceptance Tests
- **Good:** Include concrete criteria (table exists, field present, comparison passes)
- **Bad:** "Make sure it works"

### 3. Validate Commands
- **Good:** `uv run pytest tests/test_module.py -v && uv run ruff check src/module.py`
- **Bad:** `uv run pytest`

### 4. Parallel Dispatch
- **Good:** Dispatch 3 agents simultaneously with `&` and `wait`
- **Bad:** Sequential dispatch (wastes wall-clock time)

### 5. No Suppressions
- **Good:** Fix code so it passes linting cleanly
- **Bad:** Add `# noqa` to silence warnings

### 6. Atomic Commits
- **Good:** One commit per task; all tests pass; single module modified
- **Bad:** Multiple unrelated changes in one commit

---

## Appendix: Command Reference

### Create Worktree
```bash
git worktree add ../venture-wt-m{N}-{name} main
cd ../venture-wt-m{N}-{name}
```

### Dispatch Agent
```bash
copilot -p "$(cat <<'PROMPT' ... PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir {repo_path} \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### Monitor Progress
```bash
watch -n 5 'git log --oneline | head -20'
```

### Review Commit
```bash
git show {commit-hash}
```

### Run Tests
```bash
uv run pytest tests/test_{module}.py -v
```

### Check Coverage
```bash
uv run pytest --cov=src --cov-report=term-missing
```

### Merge Worktree
```bash
git switch main
git merge venture-wt-m{N}-{name}
git worktree remove ../venture-wt-m{N}-{name}
```

---

**L3 Agent Guide Status:** ACTIVE
**Last Updated:** 2026-02-21
**Next Review:** Post-M0 Sprint Completion


---

## Source: guides/GIT_WORKTREE_GUIDE.md

# Git Worktree Strategy for Venture Parallel Development

This guide defines the git worktree workflow for parallel development on Venture. Worktrees allow multiple developers or L3 copilot agents to work on different features simultaneously without branch conflicts.

## Overview

**Git worktree** creates multiple working directories linked to the same repository. Each worktree can:
- Operate on a different branch
- Run independent tests
- Have isolated CI checks
- Be merged independently

This prevents:
- Merge conflicts when different agents work on different services
- Long-lived feature branches
- Blocked work waiting for unrelated PRs

## Architecture

### Sprint Milestone Tracking

Venture development is organized in milestones (M1-M8):

| Milestone | Service | Track | Description |
|-----------|---------|-------|-------------|
| M1 | control-plane-api | Track A | Core control plane and API |
| M2 | policy-engine | Track A | Policy engine and allowlist |
| M3 | treasury-api | Track B | Treasury ledger and payout |
| M4 | artifact-compiler | Track C | Artifact determinism and compilation |
| M5 | agent-runtime | Track A | Agent execution and task queue |
| M6 | compliance-engine | Track B | Compliance case management |
| M7 | venture-orchestrator | Track A | Workflow orchestration |
| M8 | integration-suite | All | Full system integration tests |

### Worktree Per Milestone

Create one worktree per sprint:

```bash
# Sprint 1: Control Plane
git worktree add ../venture-wt-m1-control \
  -b feat/venture-m1-control-plane origin/main

# Sprint 2: Policy Engine
git worktree add ../venture-wt-m2-policy \
  -b feat/venture-m2-policy-engine origin/main

# Sprint 3: Treasury
git worktree add ../venture-wt-m3-treasury \
  -b feat/venture-m3-treasury-api origin/main

# Sprint 4: Artifacts
git worktree add ../venture-wt-m4-artifacts \
  -b feat/venture-m4-artifact-compiler origin/main

# ... and so on
```

Directory structure:

```
/Users/kooshapari/temp-PRODVERCEL/485/kush/
├── parpour/                          # Main worktree (main branch)
├── venture-wt-m1-control/            # M1 control-plane-api
├── venture-wt-m2-policy/             # M2 policy-engine
├── venture-wt-m3-treasury/           # M3 treasury-api
├── venture-wt-m4-artifacts/          # M4 artifact-compiler
├── venture-wt-m5-agent/              # M5 agent-runtime
├── venture-wt-m6-compliance/         # M6 compliance-engine
├── venture-wt-m7-orch/               # M7 venture-orchestrator
└── venture-wt-m8-integration/        # M8 integration suite
```

## Branch Naming Convention

All branches follow the pattern:

```
feat/venture-m{N}-{service-name}
```

Examples:

```
feat/venture-m1-control-plane
feat/venture-m2-policy-engine
feat/venture-m3-treasury-api
feat/venture-m4-artifact-compiler
feat/venture-m5-agent-runtime
feat/venture-m6-compliance-engine
feat/venture-m7-venture-orchestrator
feat/venture-m8-integration-tests
```

**DO NOT** use:
- `feature/...`
- `develop`
- `feature-x` (too vague)
- `wip/...` (not production ready)

## Commit Message Convention

Every commit follows a strict format:

```
{type}({service}): {FR-ID} {description}

{optional body with rationale}

Fixes: #{issue_number}
Co-Authored-By: {agent_name} <{email}>
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature (implements FR) |
| `test` | New test or test fix |
| `fix` | Bug fix (implements bug fix FR) |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |
| `chore` | Build, deps, tooling |

### Services

Allowed service names (lowercase):

```
policy      # policy-engine
treasury    # treasury-api
agent       # agent-runtime
artifact    # artifact-compiler
compliance  # compliance-engine
orch        # venture-orchestrator
ctrl        # control-plane-api
```

### Examples

Good commits:

```
feat(treasury): FR-VNT-TREAS-003 spend authorization gate

Implements default-deny authorization check before any spend.
Validates amount_cents against prior authorization record.
Raises SpendNotAuthorized if no matching authorization.

Fixes: #42

test(treasury): FR-VNT-TREAS-003 failing test

Failing test for spend authorization enforcement.
Tests that unregistered spend raises SpendNotAuthorized.

feat(policy): FR-VNT-POLICY-002 tool allowlist validation

Adds validation to check tool against agent's allowlist.
Default-deny: if tool not in allowlist, reject.
Role-specific allowlist lookups from policy bundle.

fix(orch): FR-VNT-BUG-001 handle nil workflow_id in events

Event processing crashed on nil workflow_id.
Add guard clause to skip events without workflow linkage.

refactor(agent): consolidate task envelope parsing

Extract duplicate envelope parsing into shared utility.
No behavior change; improves code reuse.

docs(treasury): update ledger invariant documentation

Clarify double-entry balance requirement.
Add example ledger entry sequences.

chore: upgrade nats dependency to 0.13.1

Pins NATS version to address performance issue.
Verified with integration tests.
```

Bad commits:

```
update code              # Too vague
fix everything          # Too broad
WIP                     # Not production ready
fr-003                  # No type, too short
feat: added new thing    # No FR, no service
```

## Worktree Workflow

### Creating a New Worktree

```bash
# Create worktree for M3 Treasury milestone
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

git worktree add ../venture-wt-m3-treasury \
  -b feat/venture-m3-treasury-api \
  origin/main

cd ../venture-wt-m3-treasury

# Verify you're on the right branch
git branch

# Install dependencies (if not shared)
uv sync

# Start development
```

### Updating from main

While developing in a worktree, keep it synced with main for dependency updates:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Fetch latest
git fetch origin

# Rebase on main (preferred for features)
git rebase origin/main

# If conflicts, resolve and continue
git rebase --continue
```

**DO NOT** merge main into feature branches. Always rebase.

### Switching Between Worktrees

```bash
# List all worktrees
git worktree list

# Switch to treasury worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Switch to policy worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy

# Back to main
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour
```

### Running Tests in Worktree

Each worktree is isolated. Tests run in that worktree's environment:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Run unit tests for this milestone
pytest tests/unit/test_treasury.py -v

# Run integration tests
pytest tests/integration/test_treasury_api.py -v

# Run all tests with coverage
pytest tests/ --cov=app --cov-report=html
```

## L3 Copilot Per-Worktree Pattern

Each copilot agent works within its worktree context:

```bash
# Agent 1: Work on M1 control plane
copilot -p "Implement FR-VNT-CTRL-001 in control-plane-api.
Failing test at: tests/unit/test_control_plane.py::test_workflow_creation
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(ctrl): FR-VNT-CTRL-001 workflow creation endpoint'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control &

# Agent 2: Work on M3 treasury (simultaneously)
copilot -p "Implement FR-VNT-TREAS-003 in treasury-api.
Failing test at: tests/unit/test_treasury.py::test_spend_requires_authorization
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(treasury): FR-VNT-TREAS-003 spend authorization gate'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury &

# Agent 3: Work on M2 policy engine
copilot -p "Implement FR-VNT-POLICY-002 in policy-engine.
Failing test at: tests/unit/test_policy.py::test_allowlist_validation
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(policy): FR-VNT-POLICY-002 tool allowlist validation'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy &
```

Each agent operates independently:
- No branch conflicts
- Parallel test execution
- Isolated CI checks
- Independent merge timelines

### Passing Context to Copilot

When invoking copilot in a worktree, include the absolute path:

```bash
copilot -p "Your task description" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury \
  &
```

The `--add-dir` parameter tells copilot to:
- Read all project files from that directory
- Understand the local git state
- Make commits to that worktree
- Reference local imports and dependencies

## Merge Strategy

### Per-FR Squash Merge

Each FR merges as a single commit via squash merge:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

# Ensure main is up to date
git fetch origin
git pull origin main

# Switch to feature branch (in separate worktree or local)
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Ensure feature is rebased on latest main
git rebase origin/main

# Create pull request (via GitHub UI or gh CLI)
gh pr create --title "feat(treasury): FR-VNT-TREAS-003 spend authorization" \
  --body "Implements spend authorization gate with default-deny policy.

## Changes
- Add AuthorizationEngine.validate_spend()
- Add SpendNotAuthorized exception
- Add unit tests for authorization logic

## Test Coverage
- tests/unit/test_treasury.py::test_spend_requires_authorization (GREEN)
- tests/unit/test_treasury.py::test_amount_ceiling_enforcement (GREEN)

Closes #42"

# After PR approval, squash merge
git checkout main
git pull origin main
gh pr merge --squash --subject "feat(treasury): FR-VNT-TREAS-003 spend authorization gate"

# Clean up worktree
git worktree remove ../venture-wt-m3-treasury
```

### Per-Milestone Rebase Before Final Merge

Before merging a milestone's final PR to main:

1. Rebase all commits to ensure clean history
2. Run full test suite
3. Verify no conflicts with other milestones

```bash
# In milestone worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Fetch latest
git fetch origin

# Rebase on main
git rebase origin/main

# If conflicts, resolve
git rebase --continue

# Push to branch
git push origin feat/venture-m3-treasury-api --force-with-lease

# Create or update PR
```

## Conflict Resolution

### Schema and Event Definitions

Schema and event definitions are the most conflict-prone. Resolve with this rule:

**All schema changes go through main first.**

Example:

1. M3 (treasury) needs to add a field to EventEnvelope
2. M1 (control-plane) also needs to modify EventEnvelope

Resolution:

1. M3 submits PR with schema change (without treasury-specific fields yet)
2. Schema change merges to main
3. All other milestones (including M1) rebase and get the updated schema
4. M1 and M3 then add their respective fields

```bash
# M3 worktree: Add shared field
# File: app/events/models.py - EventEnvelope
# Add: trace_id field

git commit -m "feat(events): FR-VNT-EVENT-001 add trace_id to EventEnvelope"
git push origin feat/venture-m3-treasury-api

# Merge to main via PR

# M1 worktree: Rebase to get trace_id
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control
git fetch origin
git rebase origin/main

# Now M1 can use trace_id in control-plane logic
```

### Resolving Three-Way Conflicts

If a conflict occurs during rebase:

```bash
# Rebase stops at conflicted commit
git status  # Shows conflicted files

# Option 1: Abort rebase (if not sure)
git rebase --abort

# Option 2: Resolve and continue
# Edit conflicted files
# Remove conflict markers
# Stage resolved files
git add .
git rebase --continue

# Option 3: Take ours or theirs
git checkout --ours app/treasury/models.py
git add app/treasury/models.py
git rebase --continue
```

## Cleanup

### Removing Finished Worktrees

After a milestone merges to main:

```bash
# In main worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

# List worktrees
git worktree list

# Remove completed worktree
git worktree remove ../venture-wt-m3-treasury

# Verify
git worktree list
```

### Listing All Worktrees

```bash
git worktree list

# Output:
# /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour                       e1c2d45 [main]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control         7f8a9e2 [feat/venture-m1-control-plane]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy          b4c5d6e [feat/venture-m2-policy-engine]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury        2a3b4c5 [feat/venture-m3-treasury-api]
```

### Pruning Invalid Worktrees

If a worktree directory is deleted manually:

```bash
git worktree prune

# Or verbose
git worktree prune -v
```

## Continuous Integration

Each worktree's branch runs its own CI:

```yaml
# .github/workflows/test-milestone.yml
name: Test Milestone

on:
  push:
    branches:
      - feat/venture-m*

jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
      - name: Install uv
        run: pip install uv
      - name: Run tests
        run: pytest tests/unit/ -v

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      nats:
        image: nats:latest-alpine
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: pytest tests/integration/ -v

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Run E2E tests
        run: pytest tests/e2e/ -v
```

## Summary

Worktree workflow enables:
- **Parallel development**: Multiple agents work simultaneously
- **No conflicts**: Each worktree is independent
- **Clean history**: Squash merge keeps main tidy
- **Easy rollback**: Remove problematic worktree and recreate
- **Isolated CI**: Each branch runs independent tests
- **Fast feedback**: No blocked work waiting for unrelated PRs

Key commands:

```bash
# Create
git worktree add ../venture-wt-{service} -b feat/venture-m{N}-{service} origin/main

# List
git worktree list

# Update
cd ../venture-wt-{service} && git rebase origin/main

# Merge
gh pr merge --squash

# Cleanup
git worktree remove ../venture-wt-{service}
```

Follow the commit message convention strictly. Always rebase before merging. Keep schema changes in main. Use L3 copilot agents per worktree. Deploy with confidence.


---

## Source: guides/TEST_FIRST_GUIDE.md

# Test-First Engineering for Venture Platform

This document defines the test-first mandate for all Venture development. Every functional requirement (FR) must have a failing test written BEFORE any implementation code.

## Core Philosophy

**Test-first is non-negotiable.** The sequence is:
1. Write failing test (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor to remove duplication (REFACTOR)
4. Commit test before implementation

This ensures:
- All code has a documented requirement (the test)
- Coverage is guaranteed (100% by design)
- Invariants are enforced before code ships
- Regression is caught immediately

## Test Organization

Tests are organized by type and layer:

```
tests/
  unit/                    # Pure functions, no I/O
    test_policy_engine.py
    test_treasury.py
    test_artifact_schema.py
    test_compliance_rules.py

  integration/             # Service boundaries, mocked external systems
    test_policy_api.py
    test_treasury_api.py
    test_agent_runtime.py

  contract/                # Event schema validation
    test_event_schemas.py
    test_task_envelope.py
    test_policy_bundle.py

  e2e/                     # Full flows via process-compose
    test_workflow_complete.py
    test_treasury_payout_flow.py
    test_compliance_case_flow.py

  fixtures/                # Shared pytest fixtures
    conftest.py            # Global fixtures
    db_fixtures.py         # Database session, migrations
    nats_fixtures.py       # NATS mock/real
    redis_fixtures.py      # Redis mock/real
    policy_fixtures.py     # Policy engine fixtures
```

## Test Types and Requirements

### Unit Tests

**Purpose:** Test pure business logic without I/O.

**Requirements:**
- No database calls (use fixtures for any needed state)
- No network calls (mock external services)
- No file system access
- Fast (< 100ms per test)
- Test single responsibility

**Example: Treasury authorization logic**

```python
import pytest
from app.treasury.authorization import AuthorizationEngine
from app.treasury.models import SpendAuthorization, AuthorizationResult

@pytest.mark.requirement("FR-VNT-TREAS-003")
def test_spend_requires_authorization():
    """
    FR-VNT-TREAS-003: No spend without prior authorization.

    All spend must pass through authorization gate.
    Default-deny policy: if not explicitly authorized, reject.
    """
    engine = AuthorizationEngine(policy_bundles={})

    with pytest.raises(SpendNotAuthorized) as exc_info:
        engine.validate_spend(
            amount_cents=10000,
            purpose="unregistered_spend",
            agent_role="executor"
        )

    assert exc_info.value.reason == "no_authorization_record"


@pytest.mark.requirement("FR-VNT-TREAS-004")
def test_authorization_checks_amount_ceiling():
    """
    FR-VNT-TREAS-004: Spend authorized up to declared ceiling.

    Authorization decision includes upper bound.
    Spend exceeding ceiling must be rejected.
    """
    engine = AuthorizationEngine(policy_bundles={})

    auth = SpendAuthorization(
        amount_cents=5000,
        purpose="marketing_campaign",
        agent_role="business_strategist"
    )

    # Within ceiling: OK
    result = engine.validate_spend(
        amount_cents=3000,
        authorization=auth
    )
    assert result.approved

    # Above ceiling: REJECT
    with pytest.raises(SpendExceedsCeiling):
        engine.validate_spend(
            amount_cents=6000,
            authorization=auth
        )
```

### Integration Tests

**Purpose:** Test service APIs and external integrations with mocked dependencies.

**Requirements:**
- Use FastAPI TestClient for HTTP endpoints
- Mock NATS, Redis, external APIs
- Test request/response schemas
- Test error handling and edge cases
- Medium speed (< 500ms per test)

**Example: Treasury API endpoint**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import AsyncMock, patch

@pytest.mark.requirement("FR-VNT-TREAS-005")
def test_post_authorization_validates_request(client: TestClient):
    """
    FR-VNT-TREAS-005: Authorization endpoint validates request schema.

    POST /api/treasury/authorize requires:
    - amount_cents (positive integer)
    - purpose (non-empty string)
    - workflow_id (UUID)
    - policy_version (string)
    """
    # Missing amount_cents
    response = client.post(
        "/api/treasury/authorize",
        json={
            "purpose": "test",
            "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
            "policy_version": "1.0"
        }
    )
    assert response.status_code == 422
    assert "amount_cents" in response.json()["detail"][0]["loc"]


@pytest.mark.requirement("FR-VNT-TREAS-006")
@pytest.mark.asyncio
async def test_post_authorization_calls_policy_engine(
    client: TestClient,
    mock_policy_engine: AsyncMock
):
    """
    FR-VNT-TREAS-006: Authorization delegates to policy engine.

    Treasury must consult policy engine before approving spend.
    Response includes policy decision rationale.
    """
    mock_policy_engine.check_authorization = AsyncMock(
        return_value={
            "approved": True,
            "reason": "within_daily_budget",
            "amount_cents": 5000
        }
    )

    response = client.post(
        "/api/treasury/authorize",
        json={
            "amount_cents": 5000,
            "purpose": "api_call",
            "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
            "policy_version": "1.0"
        }
    )

    assert response.status_code == 200
    assert response.json()["approved"]
    assert response.json()["reason"] == "within_daily_budget"

    mock_policy_engine.check_authorization.assert_called_once()
```

### Contract Tests

**Purpose:** Validate event and message schemas match the registry.

**Requirements:**
- All emitted events must match schema registry
- Schema validation must be strict (no extra fields)
- Version pinning enforced (unknown versions rejected)
- Test before event emission

**Example: Agent action event contract**

```python
import pytest
import jsonschema
from app.events.schema_registry import SchemaRegistry
from app.agent.models import AgentAction
from app.events.models import EventEnvelope

@pytest.mark.requirement("FR-VNT-AGENT-007")
def test_agent_action_emits_valid_event(
    schema_registry: SchemaRegistry,
    event_bus
):
    """
    FR-VNT-AGENT-007: All agent actions emit valid events.

    Event must conform to EventEnvelope schema.
    Payload must match action-specific schema.
    Unknown schema versions rejected at emit time.
    """
    action = AgentAction(
        agent_id="agent-001",
        tool="web_search",
        input={"query": "python asyncio"},
        workflow_id="550e8400-e29b-41d4-a716-446655440000"
    )

    event = action.to_event()

    # Validate envelope structure
    envelope_schema = schema_registry.get_schema(
        "event/envelope",
        version="v1"
    )
    jsonschema.validate(instance=event.model_dump(), schema=envelope_schema)

    # Validate action payload
    action_schema = schema_registry.get_schema(
        "action/web_search",
        version="v1"
    )
    jsonschema.validate(instance=event.payload, schema=action_schema)


@pytest.mark.requirement("FR-VNT-EVENT-008")
def test_event_envelope_rejects_unknown_version():
    """
    FR-VNT-EVENT-008: Unknown schema versions are rejected.

    EventEnvelope with schema_version=v999 must fail validation.
    """
    schema_registry = SchemaRegistry()

    invalid_event = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "agent.action",
        "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
        "schema_version": "v999",  # Unknown
        "payload": {}
    }

    with pytest.raises(jsonschema.ValidationError):
        schema_registry.validate_event(invalid_event)
```

### E2E Tests

**Purpose:** Test full workflows through actual services (or realistic mocks).

**Requirements:**
- Use real process-compose services OR realistic Docker setup
- Full flow from input to persisted state
- Test invariants (e.g., ledger balance, authorization chain)
- Slower but comprehensive (1-5 seconds per test)
- Only test happy path and critical error cases

**Example: Complete payout workflow**

```python
import pytest
import asyncio
from app.treasury.client import TreasuryClient
from app.compliance.client import ComplianceClient
from app.ledger.queries import LedgerQueries

@pytest.mark.requirement("FR-VNT-TREAS-FLOW-001")
@pytest.mark.asyncio
async def test_complete_payout_workflow(
    treasury_client: TreasuryClient,
    compliance_client: ComplianceClient,
    ledger: LedgerQueries,
    db_session,
    nats_client
):
    """
    FR-VNT-TREAS-FLOW-001: Complete payout workflow.

    Workflow: intent -> authorization -> execution -> reconciliation

    Invariants:
    - Double-entry ledger always balances
    - No spend without prior authorization
    - Compliance flag raises case if policy violated
    """
    workflow_id = "550e8400-e29b-41d4-a716-446655440000"

    # 1. Create spend intent
    intent = await treasury_client.create_intent(
        workflow_id=workflow_id,
        amount_cents=100000,
        purpose="payout_vendor",
        currency="USD"
    )
    assert intent.status == "intent_created"

    # 2. Get authorization
    auth = await treasury_client.request_authorization(
        intent_id=intent.id,
        policy_version="1.0"
    )
    assert auth.status == "authorized"

    # 3. Check compliance didn't flag
    compliance_cases = await compliance_client.list_cases(
        workflow_id=workflow_id
    )
    assert len(compliance_cases) == 0

    # 4. Execute payout
    payout = await treasury_client.execute_payout(
        intent_id=intent.id,
        recipient_account="vendor-account-123"
    )
    assert payout.status == "executed"

    # 5. Verify ledger invariant: balance == 0
    balance = await ledger.get_workflow_balance(workflow_id)
    assert balance == 0, "Double-entry must balance"

    # 6. Verify event trail
    events = await nats_client.fetch_events(
        workflow_id=workflow_id,
        subject="treasury.*"
    )
    assert len(events) >= 3  # intent, auth, execution
    assert events[0]["event_type"] == "treasury.intent_created"
    assert events[1]["event_type"] == "treasury.authorized"
    assert events[2]["event_type"] == "treasury.executed"
```

## Treasury Invariant Tests

Treasury is the most sensitive subsystem. Every test must enforce these invariants:

### Invariant 1: Double-Entry Ledger Balances

Every debit has a corresponding credit. Sum of all entries == 0.

```python
@pytest.mark.requirement("FR-VNT-TREAS-INV-001")
@pytest.mark.asyncio
async def test_ledger_always_balances(ledger: LedgerQueries, db_session):
    """
    FR-VNT-TREAS-INV-001: Double-entry ledger balance invariant.

    For any workflow:
    sum(debits) - sum(credits) == 0
    """
    # Create workflow with multiple entries
    from app.ledger.models import LedgerEntry, EntryType

    entries = [
        LedgerEntry(amount_cents=10000, entry_type=EntryType.DEBIT),
        LedgerEntry(amount_cents=6000, entry_type=EntryType.CREDIT),
        LedgerEntry(amount_cents=4000, entry_type=EntryType.CREDIT),
    ]

    for entry in entries:
        db_session.add(entry)
    db_session.commit()

    balance = await ledger.get_balance()
    assert balance == 0, "All entries must balance (debits == credits)"


@pytest.mark.requirement("FR-VNT-TREAS-INV-002")
@pytest.mark.asyncio
async def test_no_unmatched_entries(ledger: LedgerQueries, db_session):
    """
    FR-VNT-TREAS-INV-002: No orphaned ledger entries.

    Every entry must have a corresponding workflow_id and authorization record.
    """
    from app.ledger.models import LedgerEntry

    entry = LedgerEntry(
        workflow_id=None,  # Invalid
        amount_cents=5000,
        entry_type=EntryType.DEBIT
    )

    with pytest.raises(ValueError) as exc:
        db_session.add(entry)
        db_session.commit()

    assert "workflow_id" in str(exc.value)
```

### Invariant 2: No Spend Without Authorization

All spend must follow: intent → authorization → execution.

```python
@pytest.mark.requirement("FR-VNT-TREAS-INV-003")
@pytest.mark.asyncio
async def test_spend_requires_authorization(treasury_client):
    """
    FR-VNT-TREAS-INV-003: No spend without prior authorization.

    execute_payout() must fail if no AuthorizationDecision record.
    """
    intent = await treasury_client.create_intent(
        workflow_id="550e8400-e29b-41d4-a716-446655440000",
        amount_cents=50000,
        purpose="unregistered"
    )

    # Try to payout without authorization
    with pytest.raises(SpendNotAuthorized):
        await treasury_client.execute_payout(
            intent_id=intent.id,
            recipient_account="account-123"
        )


@pytest.mark.requirement("FR-VNT-TREAS-INV-004")
@pytest.mark.asyncio
async def test_authorization_chain_enforced(treasury_client):
    """
    FR-VNT-TREAS-INV-004: Authorization chain must be complete.

    States: pending -> approved|denied|expired
    Can only execute if approved.
    """
    intent = await treasury_client.create_intent(
        workflow_id="550e8400-e29b-41d4-a716-446655440000",
        amount_cents=50000
    )

    auth = await treasury_client.request_authorization(intent_id=intent.id)
    assert auth.status in ["pending", "approved", "denied"]

    if auth.status != "approved":
        with pytest.raises(CannotExecuteUnapprovedIntent):
            await treasury_client.execute_payout(intent_id=intent.id)
```

## Policy Invariant Tests

Policy engine gates all tool calls. These tests enforce the allowlist.

```python
@pytest.mark.requirement("FR-VNT-POLICY-INV-001")
def test_no_tool_call_without_allowlist(
    policy_engine: PolicyEngine,
    policy_bundle
):
    """
    FR-VNT-POLICY-INV-001: No tool call without allowlist entry.

    Default-deny: if tool not in agent's allowlist, reject.
    """
    engine = PolicyEngine(policy_bundle)

    with pytest.raises(ToolNotAllowed) as exc:
        engine.validate_tool_call(
            agent_role="executor",
            tool_name="delete_database",
            arguments={}
        )

    assert exc.value.tool_name == "delete_database"


@pytest.mark.requirement("FR-VNT-POLICY-INV-002")
def test_allowlist_is_role_specific(policy_engine, policy_bundle):
    """
    FR-VNT-POLICY-INV-002: Allowlist is role-specific.

    Different roles have different allowed tools.
    executive != executor != analyst
    """
    from app.policy.models import AgentRole

    engine = PolicyEngine(policy_bundle)

    # executive can approve spend
    assert engine.validate_tool_call(
        agent_role=AgentRole.EXECUTIVE,
        tool_name="approve_spend"
    ).allowed

    # executor cannot
    with pytest.raises(ToolNotAllowed):
        engine.validate_tool_call(
            agent_role=AgentRole.EXECUTOR,
            tool_name="approve_spend"
        )
```

## Pytest Fixtures

All tests use shared fixtures. Define in `tests/fixtures/conftest.py`:

```python
import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from unittest.mock import AsyncMock, MagicMock
from nats.aio.client import Client as NATS

# ============================================================================
# DATABASE FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def db_session() -> Session:
    """Isolated database session for each test."""
    engine = create_engine("sqlite:///:memory:")
    # Run migrations
    from app.db.base import Base
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    engine.dispose()


@pytest.fixture(scope="function")
def db_with_sample_data(db_session):
    """Database session with sample data pre-loaded."""
    from app.models import PolicyBundle

    bundle = PolicyBundle(
        id="policy-001",
        version="1.0",
        content_hash="abc123",
        status="active"
    )
    db_session.add(bundle)
    db_session.commit()

    return db_session


# ============================================================================
# NATS FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
async def nats_mock() -> AsyncMock:
    """Mock NATS client for unit/integration tests."""
    client = AsyncMock(spec=NATS)
    client.publish = AsyncMock()
    client.subscribe = AsyncMock(return_value=AsyncMock())
    client.jetstream = AsyncMock(return_value=AsyncMock())
    return client


@pytest.fixture(scope="function")
async def nats_real():
    """Real NATS connection for E2E tests."""
    client = NATS()
    await client.connect("nats://localhost:4222")
    yield client
    await client.close()


# ============================================================================
# REDIS FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def redis_mock():
    """Mock Redis client."""
    from unittest.mock import MagicMock
    client = MagicMock()
    client.get = MagicMock(return_value=None)
    client.set = MagicMock()
    client.delete = MagicMock()
    return client


@pytest.fixture(scope="function")
def redis_real():
    """Real Redis connection for E2E tests."""
    import redis
    r = redis.Redis(host='localhost', port=6379, db=0)
    r.flushdb()
    yield r
    r.flushdb()


# ============================================================================
# POLICY ENGINE FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def policy_bundle():
    """Sample policy bundle with role/tool allowlist."""
    return {
        "version": "1.0",
        "roles": {
            "executor": {
                "tools": ["web_search", "read_file", "call_api"],
                "daily_budget_cents": 100000
            },
            "executive": {
                "tools": ["approve_spend", "create_workflow"],
                "daily_budget_cents": 1000000
            }
        },
        "spend_rules": [
            {
                "name": "daily_limit",
                "condition": "amount_cents > 50000",
                "action": "require_executive_approval"
            }
        ]
    }


@pytest.fixture(scope="function")
def policy_engine(policy_bundle, db_session):
    """Policy engine instance with sample bundle."""
    from app.policy.engine import PolicyEngine
    return PolicyEngine(bundle=policy_bundle, db_session=db_session)


@pytest.fixture(scope="function")
def mock_policy_engine():
    """Mocked policy engine for API tests."""
    mock = AsyncMock()
    mock.check_authorization = AsyncMock(
        return_value={"approved": True, "reason": "ok"}
    )
    mock.validate_tool_call = AsyncMock(return_value={"allowed": True})
    return mock


# ============================================================================
# TREASURY FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def treasury_client(db_session, mock_policy_engine):
    """Treasury client instance for testing."""
    from app.treasury.client import TreasuryClient
    return TreasuryClient(
        db_session=db_session,
        policy_engine=mock_policy_engine
    )


# ============================================================================
# EVENT SCHEMA REGISTRY
# ============================================================================

@pytest.fixture(scope="session")
def schema_registry():
    """Global schema registry with all event schemas."""
    from app.events.schema_registry import SchemaRegistry
    registry = SchemaRegistry()
    registry.load_schemas("config/schemas/")
    return registry


# ============================================================================
# FASTAPI TEST CLIENT
# ============================================================================

@pytest.fixture(scope="function")
def client(db_session, mock_policy_engine):
    """FastAPI TestClient with mocked dependencies."""
    from fastapi.testclient import TestClient
    from app.main import app

    # Override dependencies
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_policy_engine] = lambda: mock_policy_engine

    yield TestClient(app)

    app.dependency_overrides.clear()
```

## Coverage Targets

| Service | Unit | Integration | E2E | Target |
|---------|------|-------------|-----|--------|
| policy-engine | 100% | 100% | 100% | 100% |
| treasury-api | 100% | 100% | 95% | 100% |
| compliance-engine | 85% | 85% | 80% | 90% |
| artifact-compiler | 80% | 80% | 70% | 85% |
| agent-runtime | 85% | 80% | 75% | 85% |
| venture-orchestrator | 80% | 80% | 75% | 80% |

## Copilot L3 Test-First Pattern

Use `copilot` with `--yolo` flag to write failing tests:

```bash
copilot -p "Write failing test for FR-VNT-TREAS-003.
Test name: test_spend_requires_authorization
File: tests/unit/test_treasury.py
Test setup:
  - Create AuthorizationEngine
  - Call validate_spend() with unregistered purpose
  - Expect SpendNotAuthorized exception
  - Assert reason == 'no_authorization_record'

Test MUST FAIL (no implementation yet).
After writing test, run:
  pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

Commit message:
  test(treasury): FR-VNT-TREAS-003 failing test - spend requires authorization" \
    --yolo --model gpt-5-mini \
    --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

Then implement:

```bash
copilot -p "Implement FR-VNT-TREAS-003 in app/treasury/authorization.py.
Test file: tests/unit/test_treasury.py::test_spend_requires_authorization
Must pass the test.
Don't add fallbacks or legacy compatibility.

Implementation must:
  - Check if amount_cents has prior authorization
  - Raise SpendNotAuthorized if not
  - Include reason_code in exception

After implementing, run:
  pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

Commit message:
  feat(treasury): FR-VNT-TREAS-003 spend authorization gate" \
    --yolo --model gpt-5-mini \
    --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

## Test Execution

Run tests by type:

```bash
# Unit tests only (fast)
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# Contract tests
pytest tests/contract/ -v

# E2E tests (requires process-compose)
pytest tests/e2e/ -v

# All tests with coverage
pytest tests/ --cov=app --cov-report=html

# Single test
pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

# Tests for specific FR
pytest -m requirement("FR-VNT-TREAS-003") -v

# Watch mode (auto-rerun on file change)
ptw tests/unit/
```

## CI/CD Integration

All tests must pass before merge:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.14"

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: uv sync

      - name: Run unit tests
        run: pytest tests/unit/ --cov=app --cov-report=xml

      - name: Run integration tests
        run: pytest tests/integration/ --cov-append --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

## Summary

Test-first ensures:
- Every FR has documented intent (the test)
- Coverage is proven by design (100%)
- Invariants are enforced (double-entry, authorization chain, policy gates)
- Regressions are caught immediately
- Code is confident and maintainable

Start with the RED test. Make it FAIL. Then implement. Never ship code without a test.


---

## Source: guides/agent-orchestration.md

# Agent Orchestration

Run autonomous agents and coordinate multi-agent workflows for parpour development.

## Overview

The `scripts/agent-orchestrator.sh` script provides bash-native introspection and control of CLI agents (cursor-agent, codex), enabling DAG-based parallel orchestration without relying on client-specific background task handling.

## Basic Usage

### Start an Agent

```bash
./scripts/agent-orchestrator.sh start <name> <cli> "<prompt>"
```

**Arguments**:
- `<name>` — Agent identifier (e.g., `researcher`, `builder`)
- `<cli>` — CLI tool: `cursor` or `codex`
- `<prompt>` — Task prompt (quoted string)

**Examples**:

```bash
# Start a research agent
./scripts/agent-orchestrator.sh start researcher cursor "Analyze the codebase architecture"

# Start a builder agent
./scripts/agent-orchestrator.sh start builder codex "Implement feature X with tests"
```

### Check Status

```bash
# Status of all agents
./scripts/agent-orchestrator.sh status

# Status of a specific agent
./scripts/agent-orchestrator.sh status researcher
```

Output includes:
- Agent name and CLI tool
- Current status (starting, running, completed, failed)
- PID if running
- Exit code if completed

### View Logs

```bash
# View agent logs
./scripts/agent-orchestrator.sh logs researcher

# Follow logs in real-time
./scripts/agent-orchestrator.sh logs researcher --follow
```

### Wait for Completion

```bash
# Wait for specific agents
./scripts/agent-orchestrator.sh wait researcher builder

# Wait for all agents
./scripts/agent-orchestrator.sh wait
```

Blocks until all specified agents complete. Prints final status summary.

### Stop an Agent

```bash
./scripts/agent-orchestrator.sh stop researcher
```

Gracefully stops the agent (SIGTERM), then force-kills if needed (SIGKILL).

### Cleanup

```bash
./scripts/agent-orchestrator.sh cleanup
```

Stops all running agents and removes all artifacts (.pid, .log, .status files).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_DIR` | `./.agents` | Directory for agent files (PID, logs, status) |
| `CURSOR_MODEL` | `auto` | LLM model for cursor-agent |
| `CODEX_SANDBOX` | `workspace-write` | Sandbox level for codex |

**Example**:

```bash
AGENT_DIR=/tmp/agents CURSOR_MODEL=claude-opus-4.6 ./scripts/agent-orchestrator.sh start researcher cursor "Research task"
```

## DAG Execution

Run multiple agents in phases with blocking/non-blocking dependencies:

```bash
./scripts/agent-orchestrator.sh run-dag <spec.json>
```

### DAG Specification Format

```json
{
  "phases": [
    {
      "blocking": true,
      "agents": {
        "researcher": {
          "cli": "cursor",
          "prompt": "Analyze the codebase and document architecture"
        }
      }
    },
    {
      "blocking": true,
      "agents": {
        "builder": {
          "cli": "cursor",
          "prompt": "Implement the feature based on research"
        },
        "tester": {
          "cli": "codex",
          "prompt": "Write comprehensive tests"
        }
      }
    }
  ]
}
```

**Phase Structure**:
- `blocking` (boolean) — If true, wait for all agents in this phase to complete before starting next phase
- `agents` (object) — Map of agent names to their configurations
  - `cli` — `cursor` or `codex`
  - `prompt` — Task prompt for the agent

**Example Workflow**:
1. Phase 1: Researcher analyzes codebase (blocking: true, wait for completion)
2. Phase 2: Builder and Tester work in parallel (blocking: true, both must complete)
3. Continue to next phases...

## Architecture

### File Organization

```
.agents/
  researcher.pid          # Process ID
  researcher.log          # Raw agent output
  researcher.status       # JSON status ({"status":"running",...})
  researcher.output.md    # Final output (if applicable)
```

### Status Flow

```
starting → running → completed/failed
```

Status JSON examples:

```json
{"status":"starting","started_at":"2026-02-21T10:30:00Z"}
{"status":"running","cli":"cursor-agent","model":"claude-opus-4.6"}
{"status":"completed","exit_code":0,"finished_at":"2026-02-21T10:45:00Z"}
{"status":"failed","exit_code":1,"finished_at":"2026-02-21T10:45:00Z"}
```

## Integration with Taskfile

Add to `Taskfile.yml`:

```yaml
tasks:
  agents:start:researcher:
    desc: Start researcher agent
    cmds:
      - ./scripts/agent-orchestrator.sh start researcher cursor "Analyze the codebase"

  agents:status:
    desc: Check status of all agents
    cmds:
      - ./scripts/agent-orchestrator.sh status

  agents:wait:
    desc: Wait for all agents to complete
    cmds:
      - ./scripts/agent-orchestrator.sh wait

  agents:cleanup:
    desc: Stop all agents and cleanup
    cmds:
      - ./scripts/agent-orchestrator.sh cleanup

  agents:run-dag:
    desc: Run DAG from spec.json
    cmds:
      - ./scripts/agent-orchestrator.sh run-dag spec.json
```

## Common Workflows

### Single Agent Task

```bash
# Start an agent and wait for it
./scripts/agent-orchestrator.sh start researcher cursor "Your task"
./scripts/agent-orchestrator.sh wait researcher

# Check final status
./scripts/agent-orchestrator.sh logs researcher
```

### Parallel Research and Build

```bash
# Start both
./scripts/agent-orchestrator.sh start researcher cursor "Research architecture"
./scripts/agent-orchestrator.sh start builder cursor "Implement feature"

# Wait for both
./scripts/agent-orchestrator.sh wait researcher builder

# Review results
./scripts/agent-orchestrator.sh status
```

### Sequential Phases (Use DAG)

Create `agent-spec.json`:

```json
{
  "phases": [
    {
      "blocking": true,
      "agents": {
        "research": {"cli": "cursor", "prompt": "Research..."}
      }
    },
    {
      "blocking": true,
      "agents": {
        "build": {"cli": "cursor", "prompt": "Build..."}
      }
    }
  ]
}
```

Run:
```bash
./scripts/agent-orchestrator.sh run-dag agent-spec.json
```

## Troubleshooting

### Agent not starting

Check if CLI is installed:
```bash
which cursor-agent
which codex
```

### Zombie processes

Clean up properly:
```bash
./scripts/agent-orchestrator.sh cleanup
```

### View raw logs

```bash
tail -f .agents/researcher.log
```

### Check exit code

```bash
cat .agents/researcher.status | jq '.exit_code'
```

## Best Practices

1. **Use meaningful names**: `researcher`, `architect`, `implementer` (not `agent1`, `agent2`)
2. **Clear prompts**: Specific, actionable, with context
3. **Sequential when needed**: Use `blocking: true` in DAG phases for dependencies
4. **Parallel when safe**: Use `blocking: false` for independent work
5. **Always wait**: Use `wait` before assuming agent completed
6. **Review logs**: Check logs and status before moving to next phase
7. **Cleanup between runs**: Use `cleanup` to avoid confusion with stale agents


---

## Source: guides/anti-patterns.md

# Anti-Pattern Detection Hooks

Six hooks that detect and prevent common code anti-patterns. Each runs on `PreToolUse:Write/Edit` events and provides actionable fix suggestions.

## Hook Summary

| Hook | Pattern Detected | Severity | Languages |
|------|-----------------|----------|-----------|
| suppress-custom-retry.sh | Custom retry loops when tenacity available | WARNING | Python |
| suppress-v2-files.sh | `_v2`, `_new`, `_old` file naming | ERROR | All |
| suppress-hardcoded-strings.sh | Hardcoded provider/model/URL strings | WARNING | Python, TS, Go |
| suppress-print-statements.sh | print()/console.log when structured logger available | WARNING | Python, TS, Go |
| suppress-isolated-classes.sh | God classes (>15 methods or >300 lines) | WARNING | Python, TS |
| suppress-direct-http.sh | Direct HTTP calls without client abstraction | WARNING | Python, TS, Go |

## Parpour-Specific Anti-Patterns

### Don't add specs to venture/ subdirectory — specs live at parpour root

**Pattern**: Adding specification files inside `venture/` or other subdirectories.

**Why blocked**: Specs are canonical at the parpour root level. Subdirectories like `venture/` are for implementation, not specification.

**Fix**:
```bash
# Wrong
venture/TECHNICAL_SPEC.md
venture/TRACK_A.md

# Correct
TECHNICAL_SPEC.md
TRACK_A.md
TRACK_B.md
```

---

### Don't create SaaS-dependent artifact flows — use headless compiler IR

**Pattern**: Building artifact generation flows that depend on external SaaS services (e.g., OpenAI API, hosted databases).

**Why blocked**: Parpour must be runnable standalone. All artifact generation should use the headless compiler IR and local processing.

**Fix**:
```python
# Wrong — depends on external API
def generate_civ_spec():
    response = openai.ChatCompletion.create(model="gpt-4", messages=...)
    return response.choices[0].text

# Correct — uses headless IR
from parpour.compiler import HeadlessCompiler
def generate_civ_spec():
    compiler = HeadlessCompiler()
    ir = compiler.parse_config(config)
    return compiler.generate_artifact(ir, 'spec')
```

---

### Don't add fallbacks or silent failure paths

**Pattern**: Adding `try/except` blocks that hide errors, or feature flags that silently degrade functionality.

**Why blocked**: Following global CLAUDE instructions — code should fail fast and fail loudly.

**Fix**:
```python
# Wrong — silent fallback
try:
    spec = load_spec(path)
except Exception:
    spec = default_spec  # Hidden failure

# Correct — fail loudly
spec = load_spec(path)  # Raises if not found
```

---

## Hook Details

### suppress-custom-retry.sh

**What it detects**: Hand-rolled retry/backoff loops in Python when `tenacity` is declared in project dependencies.

**Patterns caught**:
- `for attempt in range(N)` with `sleep` + `try/except`
- `while True` retry loops with attempt counters
- Manual exponential backoff (`2 ** attempt`)

**Fix**:
```python
# Before (anti-pattern)
for attempt in range(5):
    try:
        result = httpx.get(url)
        break
    except Exception:
        time.sleep(2 ** attempt)

# After (correct)
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(5), wait=wait_exponential())
def fetch(url: str) -> httpx.Response:
    return httpx.get(url, timeout=10)
```

---

### suppress-v2-files.sh

**What it detects**: Files with `_v2`, `_new`, `_old`, `_backup`, `_copy`, `_temp` suffixes.

**Why blocked (ERROR)**: v2 files lead to:
- Import confusion (which version to use?)
- Stale code copies that diverge
- No clear migration path

**Fix options**:
1. Modify the original file directly
2. Use feature flags for behavioral changes
3. Use interface versioning (APIv2 endpoint, not handler_v2.py)
4. If migrating, rename the original and update all imports in one commit

---

### suppress-hardcoded-strings.sh

**What it detects**: Hardcoded provider names, model identifiers, and API URLs in source code.

**Patterns caught**:
- LLM model names: `"gpt-4"`, `"claude-3"`, `"gemini-1.5"`
- API URLs: `"https://api.openai.com/..."`
- Provider identifiers: `"aws"`, `"openai"`, `"anthropic"` as string literals

**Excludes**: Test files, imports, comments.

**Fix**:
```python
# Before
response = client.chat("gpt-4", messages)

# After
from config import settings
response = client.chat(settings.default_model, messages)
```

---

### suppress-print-statements.sh

**What it detects**: Unstructured logging (print, console.log, fmt.Println) when a structured logging library is in project dependencies.

**Dependency triggers**:
- Python: `structlog` in deps -> blocks `print()` and `logging.getLogger()`
- TypeScript: `pino`/`winston` in deps -> blocks `console.log()`
- Go: `zerolog`/`zap` in deps -> blocks `fmt.Println()`

**Fix**:
```python
# Before
print(f"Processing user {user_id}")

# After
import structlog
log = structlog.get_logger()
log.info("processing_user", user_id=user_id)
```

---

### suppress-isolated-classes.sh

**What it detects**: Classes that are too large ("God classes").

**Thresholds**:
- More than 15 methods
- More than 300 lines

**Fix**:
1. **SRP decomposition**: Extract cohesive method groups into separate classes
2. **Composition**: Break into composed components instead of one monolith
3. **Strategy pattern**: Extract behavioral variations into strategy classes
4. **DTO extraction**: Move data-only methods into separate dataclasses

---

### suppress-direct-http.sh

**What it detects**: Direct HTTP client calls (requests.get, fetch(), http.Get) in business logic.

**Why**: Direct calls scatter URL construction, authentication, retry logic, timeout handling, and error mapping across the codebase.

**Excludes**: Files in `clients/`, `adapters/`, `infrastructure/`, `transport/` directories. Files named `*client*`, `*http*`, `*fetcher*`.

**Fix**:
```python
# Before (scattered in business logic)
response = requests.get(f"{BASE_URL}/users/{user_id}", headers=auth_headers)

# After (centralized client)
class UserClient:
    def __init__(self, base_url: str, auth: Auth):
        self.client = httpx.AsyncClient(base_url=base_url, auth=auth)

    async def get_user(self, user_id: str) -> User:
        response = await self.client.get(f"/users/{user_id}")
        response.raise_for_status()
        return User.model_validate(response.json())
```

## Integration

### Claude Code Hooks (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          "hooks/suppress-custom-retry.sh $FILE_PATH",
          "hooks/suppress-v2-files.sh $FILE_PATH",
          "hooks/suppress-hardcoded-strings.sh $FILE_PATH",
          "hooks/suppress-print-statements.sh $FILE_PATH",
          "hooks/suppress-isolated-classes.sh $FILE_PATH",
          "hooks/suppress-direct-http.sh $FILE_PATH"
        ]
      }
    ]
  }
}
```

### Pre-commit (local hooks)

```yaml
- repo: local
  hooks:
    - id: no-v2-files
      name: Block v2/new/old file creation
      entry: hooks/suppress-v2-files.sh
      language: script
      stages: [pre-commit]
```

## Testing Hooks

Each hook can be tested standalone:

```bash
# Test v2 file detection (should print error and exit 1)
echo "test" > /tmp/handler_v2.py
./hooks/suppress-v2-files.sh /tmp/handler_v2.py
echo "Exit code: $?"

# Test custom retry detection (should print warning)
cat > /tmp/retry_test.py << 'EOF'
for attempt in range(5):
    try:
        result = httpx.get(url)
        break
    except Exception:
        time.sleep(2 ** attempt)
EOF
./hooks/suppress-custom-retry.sh /tmp/retry_test.py
```


---
