# Venture Service Catalog (v1)

## Overview

This document catalogs every service in the Venture system: name, port, language, dependencies, health check, scaling notes, and environment contracts. Use this as the canonical reference for service deployment, inter-service communication, and orchestration.

---

## Service Registry

### 1. control-plane-api (Port 8000)

**Language**: Python 3.14 (FastAPI)

**Responsibility**: Founder-facing REST + WebSocket API; task submission, policy publishing, system controls (freeze, kill-switch, rollback).

**Dependencies**:
- policy-engine (:8001) — validate task intents
- venture-orchestrator (:8005) — dispatch tasks
- ledger-db (:5432, PostgreSQL) — query workflows, audit trail
- redis-cache (:6379) — session store, rate limiting

**Scaling**: 1 replica (founder ops bottleneck; could scale to 2 with sticky sessions).

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "timestamp": "...", "dependencies": { "policy-engine": "ok", ... } }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After policy-engine, venture-orchestrator, ledger-db, redis-cache.

**Environment Variables**:
```bash
CONTROL_PLANE_HOST=0.0.0.0
CONTROL_PLANE_PORT=8000
CONTROL_PLANE_LOG_LEVEL=INFO
CONTROL_PLANE_REQUEST_TIMEOUT_SECONDS=30
CONTROL_PLANE_CORS_ORIGINS=*  # restrict in production
POLICY_ENGINE_URL=http://policy-engine:8001
VENTURE_ORCHESTRATOR_URL=http://venture-orchestrator:8005
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
REDIS_URL=redis://redis-cache:6379/0
FOUNDER_AUTH_MODE=mTLS  # or bearer-token
```

**Process-compose Config**:
```yaml
services:
  control-plane-api:
    command: python -m uvicorn control_plane.api:app --host 0.0.0.0 --port 8000 --log-level info
    environment:
      CONTROL_PLANE_PORT: 8000
      POLICY_ENGINE_URL: http://policy-engine:8001
      # ... (other env vars)
    depends_on:
      - policy-engine
      - venture-orchestrator
      - ledger-db
      - redis-cache
```

**Endpoints** (representative):
- `POST /workflows` — submit task intent
- `GET /workflows` — list active workflows
- `GET /workflows/{id}` — workflow detail + progress
- `POST /workflows/{id}/cancel` — cancel workstream
- `POST /control/freeze` — global pause
- `POST /control/unfreeze` — resume
- `POST /policies/publish` — publish new policy bundle
- `GET /audit/{workflow_id}` — retrieve audit trail
- `GET /health` — system health + incidents
- `WebSocket /ws/workflows/{id}` — real-time task completion events

---

### 2. policy-engine (Port 8001)

**Language**: Python 3.14 (FastAPI)

**Responsibility**: Tool allowlist enforcement, task intent validation, schema registry, workload identity verification, prompt injection defense.

**Dependencies**:
- redis-cache (:6379) — tool allowlist cache, policy cache
- ledger-db (:5432) — schema registry, policy bundle history

**Scaling**: Horizontal (multiple replicas behind HTTP load balancer). Cache layer (Redis) absorbs most read load; direct DB fallback on cache miss.

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "cache_hit_rate": 0.95, "db_latency_ms": 15 }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After redis-cache, ledger-db.

**Environment Variables**:
```bash
POLICY_ENGINE_HOST=0.0.0.0
POLICY_ENGINE_PORT=8001
POLICY_ENGINE_LOG_LEVEL=INFO
POLICY_ENGINE_CACHE_TTL_SECONDS=300
POLICY_ENGINE_DB_FALLBACK_TIMEOUT_MS=1000
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
REDIS_URL=redis://redis-cache:6379/0
POLICY_BUNDLE_REFRESH_INTERVAL_SECONDS=60
TOOL_ALLOWLIST_CACHE_KEY_PREFIX=policy:allowlist:
```

**Process-compose Config**:
```yaml
services:
  policy-engine:
    command: python -m uvicorn policy_engine.api:app --host 0.0.0.0 --port 8001 --workers 4
    environment:
      POLICY_ENGINE_PORT: 8001
      POLICY_ENGINE_CACHE_TTL_SECONDS: 300
      LEDGER_DB_URL: postgresql://...
      REDIS_URL: redis://redis-cache:6379/0
    depends_on:
      - redis-cache
      - ledger-db
```

**Endpoints** (representative):
- `POST /evaluate-intent` — validate task intent against schema + tool allowlist
- `POST /check-tool-allowed` — check if tool_name permitted for agent_role
- `GET /schemas/{task_type}` — retrieve schema for task type
- `GET /policy-bundle/{version}` — fetch policy bundle by version
- `POST /schemas/register` — register new task type schema
- `GET /health` — health status + metrics

**Inter-Service Communication**:
- Called by: control-plane-api (validate intents), agent-runtime (check tool permissions), treasury-api (authorization checks)
- Protocol: HTTP REST (sync request/response)

---

### 3. artifact-compiler (Port 8002)

**Language**: Python 3.14 (FastMCP)

**Responsibility**: Artifact IR spec validation, deterministic build pipeline (validate → render → export), provenance attachment, non-deterministic provider handling.

**Dependencies**:
- ledger-db (:5432) — artifact_ir, artifact_builds, artifact_provenance tables
- event-bus (NATS, :4222) — emit artifact events
- redis-cache (:6379) — build result cache, idempotency tracking
- External APIs: Claude API, Veo/Banana (for rendering)

**Scaling**: Horizontal (queue-based dispatch via NATS work queue). Queue depth monitored; scale up if depth > 50.

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "build_queue_depth": 3, "cache_hit_rate": 0.75 }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After ledger-db, event-bus, redis-cache.

**Environment Variables**:
```bash
ARTIFACT_COMPILER_HOST=0.0.0.0
ARTIFACT_COMPILER_PORT=8002
ARTIFACT_COMPILER_LOG_LEVEL=INFO
ARTIFACT_COMPILER_BUILD_TIMEOUT_SECONDS=300
ARTIFACT_COMPILER_CACHE_TTL_DAYS=7
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
NATS_URL=nats://event-bus:4222
REDIS_URL=redis://redis-cache:6379/0
CLAUDE_API_KEY=sk-...
VEO_API_KEY=...
BANANA_API_KEY=...
ARTIFACT_COMPILER_POLICY_TIER_DEFAULT=balanced
```

**Process-compose Config**:
```yaml
services:
  artifact-compiler:
    command: python -m artifact_compiler.api:app --host 0.0.0.0 --port 8002
    environment:
      ARTIFACT_COMPILER_PORT: 8002
      ARTIFACT_COMPILER_BUILD_TIMEOUT_SECONDS: 300
      LEDGER_DB_URL: postgresql://...
      NATS_URL: nats://event-bus:4222
      REDIS_URL: redis://redis-cache:6379/0
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
    depends_on:
      - ledger-db
      - event-bus
      - redis-cache
```

**Endpoints** (representative):
- `POST /artifacts/register-ir` — register artifact IR spec
- `POST /artifacts/{ir_id}/build` — start artifact build pipeline
- `GET /artifacts/{build_id}/status` — poll build status
- `POST /artifacts/{build_id}/replay` — re-render artifact (cache bypass)
- `GET /health` — health status + queue metrics

**Inter-Service Communication**:
- Subscribes to: task completion events (async)
- Publishes to: event-bus (artifact.ir.registered, artifact.build.started, artifact.build.completed, artifact.provenance.attested)

---

### 4. treasury-api (Port 8003)

**Language**: Python 3.14 (FastAPI)

**Responsibility**: Authorization decisions, double-entry ledger, velocity controls, merchant/category enforcement, reconciliation.

**Dependencies**:
- ledger-db (:5432) — money_intents, authorization_decisions, ledger_entries tables
- event-bus (NATS, :4222) — emit money events, subscribe to task events
- redis-cache (:6379) — velocity control tracking, lock store
- policy-engine (:8001) — policy bundle validation

**Scaling**: 1-2 replicas (state: ledger + authorization queue). Serialize via distributed lock (Redis) or DB-level serialization.

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "ledger_latency_ms": 20, "last_reconciliation": "..." }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After ledger-db, event-bus, redis-cache, policy-engine.

**Environment Variables**:
```bash
TREASURY_API_HOST=0.0.0.0
TREASURY_API_PORT=8003
TREASURY_API_LOG_LEVEL=INFO
TREASURY_API_AUTH_TIMEOUT_MS=500
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
NATS_URL=nats://event-bus:4222
REDIS_URL=redis://redis-cache:6379/0
POLICY_ENGINE_URL=http://policy-engine:8001
TREASURY_RECONCILIATION_CRON=0 0 * * *  # daily at midnight
TREASURY_GLOBAL_DAILY_CAP_CENTS=1000000
TREASURY_VELOCITY_WINDOW_SECONDS=3600
```

**Process-compose Config**:
```yaml
services:
  treasury-api:
    command: python -m uvicorn treasury.api:app --host 0.0.0.0 --port 8003
    environment:
      TREASURY_API_PORT: 8003
      TREASURY_API_AUTH_TIMEOUT_MS: 500
      LEDGER_DB_URL: postgresql://...
      NATS_URL: nats://event-bus:4222
      REDIS_URL: redis://redis-cache:6379/0
    depends_on:
      - ledger-db
      - event-bus
      - redis-cache
      - policy-engine
```

**Endpoints** (representative):
- `POST /money/intents` — create money intent
- `POST /money/authorize` — authorize money intent
- `GET /money/intents/{id}` — fetch intent status
- `GET /ledger/{workflow_id}` — retrieve ledger entries for workflow
- `POST /reconciliation/run` — trigger reconciliation (admin)
- `GET /health` — health status

**Inter-Service Communication**:
- Calls: policy-engine (policy bundle fetch)
- Publishes to: event-bus (money.intent.created, money.authorization.decided, ledger.entry.created)
- Subscribes to: task completion events (settle ledger)

---

### 5. compliance-engine (Port 8004)

**Language**: Python 3.14 (FastAPI)

**Responsibility**: Policy rule evaluation, audit trail generation, violation detection + escalation, DSAR/deletion processing, incident classification.

**Dependencies**:
- ledger-db (:5432) — compliance_cases, privacy_requests, audit_trail tables
- event-bus (NATS, :4222) — subscribe to all events, emit compliance events
- redis-cache (:6379) — rule cache, incident state

**Scaling**: 2+ replicas (read-heavy). NATS consumer groups handle fair distribution of events.

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "event_lag_ms": 100, "rule_cache_hit_rate": 0.88 }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After ledger-db, event-bus, redis-cache.

**Environment Variables**:
```bash
COMPLIANCE_ENGINE_HOST=0.0.0.0
COMPLIANCE_ENGINE_PORT=8004
COMPLIANCE_ENGINE_LOG_LEVEL=INFO
COMPLIANCE_ENGINE_RULE_CACHE_TTL_SECONDS=300
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
NATS_URL=nats://event-bus:4222
REDIS_URL=redis://redis-cache:6379/0
COMPLIANCE_ENGINE_VIOLATION_ESCALATION_URL=http://control-plane-api:8000/incidents
COMPLIANCE_ENGINE_AUTO_FREEZE_ON_CRITICAL=true
```

**Process-compose Config**:
```yaml
services:
  compliance-engine:
    command: python -m compliance.engine:app --host 0.0.0.0 --port 8004
    environment:
      COMPLIANCE_ENGINE_PORT: 8004
      COMPLIANCE_ENGINE_RULE_CACHE_TTL_SECONDS: 300
      LEDGER_DB_URL: postgresql://...
      NATS_URL: nats://event-bus:4222
      REDIS_URL: redis://redis-cache:6379/0
    depends_on:
      - ledger-db
      - event-bus
      - redis-cache
```

**Endpoints** (representative):
- `POST /evaluate` — evaluate policy rule against action
- `GET /cases/{workflow_id}` — retrieve compliance cases for workflow
- `GET /audit/{workflow_id}` — retrieve audit trail
- `POST /privacy/requests` — submit DSAR/deletion request
- `GET /health` — health status

**Inter-Service Communication**:
- Subscribes to: all event topics (policy.*, workflow.*, task.*, money.*, etc.)
- Publishes to: event-bus (compliance.evaluated, compliance.violation.detected, incident.classified)
- Calls: control-plane-api (escalate incidents)

---

### 6. venture-orchestrator (Port 8005)

**Language**: Python 3.14 (FastAPI)

**Responsibility**: Portfolio management, workstream DAG execution, L1/L2/L3 task dispatch, task queue management, monitoring/alerting.

**Dependencies**:
- ledger-db (:5432) — workflows, tasks, agent_actions tables
- event-bus (NATS, :4222) — publish task events, subscribe to task completion
- agent-runtime (Python, direct call for L1/L2)
- redis-cache (:6379) — task queue, agent slot tracking

**Scaling**: 2+ replicas. Distributed task dispatch via Redis-backed queue (fair distribution).

**Health Check**:
- Endpoint: `GET /health`
- Response: `{ "status": "ok", "queue_depth": 5, "agent_pool_utilization": 0.65 }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: After ledger-db, event-bus, agent-runtime, redis-cache.

**Environment Variables**:
```bash
VENTURE_ORCHESTRATOR_HOST=0.0.0.0
VENTURE_ORCHESTRATOR_PORT=8005
VENTURE_ORCHESTRATOR_LOG_LEVEL=INFO
VENTURE_ORCHESTRATOR_TASK_QUEUE_MAX_DEPTH=100
VENTURE_ORCHESTRATOR_L3_POOL_MAX_CONCURRENCY=10
VENTURE_ORCHESTRATOR_L3_TASK_TIMEOUT_SECONDS=1800
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
NATS_URL=nats://event-bus:4222
REDIS_URL=redis://redis-cache:6379/0
AGENT_RUNTIME_URL=http://agent-runtime:5000  # for L1/L2 calls
```

**Process-compose Config**:
```yaml
services:
  venture-orchestrator:
    command: python -m uvicorn venture.orchestrator:app --host 0.0.0.0 --port 8005 --workers 2
    environment:
      VENTURE_ORCHESTRATOR_PORT: 8005
      VENTURE_ORCHESTRATOR_L3_POOL_MAX_CONCURRENCY: 10
      LEDGER_DB_URL: postgresql://...
      NATS_URL: nats://event-bus:4222
      REDIS_URL: redis://redis-cache:6379/0
    depends_on:
      - ledger-db
      - event-bus
      - agent-runtime
      - redis-cache
```

**Endpoints** (representative):
- `POST /dispatch/l1` — dispatch L1 orchestrator task
- `POST /dispatch/l2/{agent_type}` — dispatch L2 specialist task
- `POST /dispatch/l3` — dispatch L3 copilot CLI task
- `GET /queue/depth` — task queue depth
- `GET /agents/slots` — agent pool slot availability
- `POST /workflows/{id}/cancel` — cancel workstream
- `GET /metrics` — Prometheus metrics
- `GET /health` — health status

**Inter-Service Communication**:
- Calls: agent-runtime (L1/L2 task execution)
- Publishes to: event-bus (task.dispatch.initiated, task.completed)
- Subscribes to: task completion events (DAG progression)

---

### 7. agent-runtime (Port — internal, no exposed HTTP)

**Language**: Python 3.14

**Responsibility**: L1 orchestrator, L2 specialist agents (Writer, Coder, Researcher, Analyst), L3 copilot CLI worker pool management, tool call auditing, result capture.

**Dependencies**:
- policy-engine (:8001) — tool allowlist checks
- event-bus (NATS, :4222) — emit tool.call.executed, task.completed events
- ledger-db (:5432) — store results, agent_actions
- redis-cache (:6379) — agent state, slot tracking

**Scaling**: Horizontal. Each replica manages subset of L2 agents + L3 worker pool. Consistent hashing for L2 dispatch.

**Health Check**:
- Internal status: agent_runtime maintains /metrics (Prometheus) exposed via subsidiary HTTP service.
- Check: `GET http://agent-runtime:5000/metrics` (if health sidecar enabled).
- Metrics: active_agents, task_queue_depth, tool_calls_per_sec.

**Startup Order**: Before venture-orchestrator (orchestrator needs agent-runtime available).

**Environment Variables**:
```bash
AGENT_RUNTIME_LOG_LEVEL=INFO
AGENT_RUNTIME_L2_AGENT_COUNT=4  # Writer, Coder, Researcher, Analyst (1 each or more)
AGENT_RUNTIME_L3_MAX_CONCURRENCY=10
AGENT_RUNTIME_L3_TASK_TIMEOUT_SECONDS=1800
AGENT_RUNTIME_L3_WORKSPACE_DIR=/tmp/venture-l3-workspace
POLICY_ENGINE_URL=http://policy-engine:8001
NATS_URL=nats://event-bus:4222
LEDGER_DB_URL=postgresql://user:pass@ledger-db:5432/venture
REDIS_URL=redis://redis-cache:6379/0
COPILOT_PATH=/usr/local/bin/copilot
```

**Process-compose Config**:
```yaml
services:
  agent-runtime:
    command: python -m agent_runtime.main
    environment:
      AGENT_RUNTIME_LOG_LEVEL: INFO
      AGENT_RUNTIME_L3_MAX_CONCURRENCY: 10
      AGENT_RUNTIME_L3_TASK_TIMEOUT_SECONDS: 1800
      POLICY_ENGINE_URL: http://policy-engine:8001
      NATS_URL: nats://event-bus:4222
      LEDGER_DB_URL: postgresql://...
      REDIS_URL: redis://redis-cache:6379/0
      COPILOT_PATH: /usr/local/bin/copilot
    depends_on:
      - policy-engine
      - event-bus
      - ledger-db
      - redis-cache
```

**Inter-Service Communication**:
- Calls: policy-engine (tool allowlist checks)
- Publishes to: event-bus (tool.call.executed, task.completed)
- Queries: ledger-db (store results)

---

### 8. event-bus (NATS JetStream, Port 4222)

**Language**: Go/Rust (NATS binary)

**Responsibility**: Immutable event streams, topic fan-out, consumer group management, event replay, event persistence.

**Dependencies**:
- PostgreSQL (optional backing store for persistence, :5432)

**Scaling**: 1 node (single-node mode) or 3+ node cluster (multi-node HA). Peer replication within cluster.

**Health Check**:
- Endpoint (NATS monitoring): `GET http://event-bus:8222/healthz`
- Response: `{ "status": "ok", "connections": 10, "streams": 20 }`
- Timeout: 5s
- Interval: 10s

**Startup Order**: Before any service that publishes/subscribes.

**Environment Variables** (process-compose):
```bash
# NATS Server Config
NATS_PORT=4222
NATS_HTTP_PORT=8222
NATS_JETSTREAM=true
NATS_STORE_DIR=/data/nats  # file-based persistence
NATS_LOG_LEVEL=info
```

**Process-compose Config**:
```yaml
services:
  event-bus:
    command: /usr/local/bin/nats-server -c /config/nats.conf
    environment:
      NATS_PORT: 4222
      NATS_HTTP_PORT: 8222
      NATS_JETSTREAM: "true"
      NATS_STORE_DIR: /data/nats
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - ./nats.conf:/config/nats.conf:ro
      - ./data/nats:/data/nats
```

**NATS Streams** (topics):
- `policy.>` — policy published, policy evaluated
- `workflow.>` — workflow created, started, completed, cancelled
- `task.>` — task dispatched, running, completed, failed
- `artifact.>` — artifact IR registered, build started/completed, provenance attested
- `money.>` — intent created, authorization decided, settled
- `ledger.>` — entry created, materialized, reconciliation completed
- `compliance.>` — evaluated, violation detected, case opened
- `privacy.>` — request received, DSAR compiled, deletion completed
- `audit.>` — checksum computed, integrity verified

**Consumer Groups**: Each consumer group (e.g., "ledger-db", "compliance-engine") consumes events independently; NATS tracks offset per group.

**Inter-Service Communication**:
- All services publish to event-bus; all services subscribe to relevant topics.
- Request/Reply pattern: some RPCs use NATS request/reply (e.g., policy evaluation).

---

### 9. ledger-db (PostgreSQL, Port 5432)

**Language**: SQL (PostgreSQL 15+)

**Responsibility**: Event store (append-only), read projections, state snapshots, schema registry, policy bundles, audit logs, checksum integrity.

**Dependencies**: None (foundational).

**Scaling**: 1 primary + 1-2 replicas (async streaming replication). Failover via pg_failover_slot or Patroni.

**Health Check**:
- Endpoint: `psql -h ledger-db -U venture -d venture -c "SELECT 1;"`
- Response: `(1 row)`
- Timeout: 5s
- Interval: 10s

**Startup Order**: First (foundational service).

**Environment Variables**:
```bash
POSTGRES_HOST=ledger-db
POSTGRES_PORT=5432
POSTGRES_DB=venture
POSTGRES_USER=venture
POSTGRES_PASSWORD=...  # from secret
POSTGRES_LOG_LEVEL=warn
POSTGRES_MAX_CONNECTIONS=200
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_WAL_LEVEL=replica  # for replication
POSTGRES_WAL_ARCHIVE_MODE=on
POSTGRES_WAL_ARCHIVE_COMMAND='...'  # S3 archive
```

**Process-compose Config**:
```yaml
services:
  ledger-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: venture
      POSTGRES_USER: venture
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "-c max_connections=200 -c shared_buffers=256MB"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "venture"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Core Tables**:
- `events` (append-only) — event_id, event_type, payload, checksum_prev, checksum_current, signature, created_at
- `policy_bundles` — id, version, content_hash, status, created_at
- `workflows` — id, objective, policy_bundle_id, status, budget_cents, created_at
- `tasks` — id, workflow_id, type, status, retries, created_at
- `agent_actions` — id, task_id, agent_role, tool, input_hash, output_hash, created_at
- `money_intents` — id, workflow_id, amount_cents, merchant_scope, status, created_at
- `authorization_decisions` — id, money_intent_id, decision, reason_code, created_at
- `ledger_entries` — id, workflow_id, entry_type, amount_cents, account_from, account_to, created_at
- `compliance_cases` — id, workflow_id, rule_id, severity, status, created_at
- `privacy_requests` — id, subject_ref, request_type, status, created_at
- `schema_registry` — id, task_type, schema_json, version, created_at
- `audit_checkpoints` — batch_id, event_id_start, event_id_end, checksum, created_at

**Inter-Service Communication**: All services query/insert into ledger-db. No special protocol; standard PostgreSQL client libraries.

---

### 10. redis-cache (Redis, Port 6379)

**Language**: C (Redis binary)

**Responsibility**: Agent state cache, tool call rate limits, idempotency keys, session store, policy cache, hot data.

**Dependencies**: None (foundational).

**Scaling**: 1 node (with optional Sentinel for failover). Persistent RDB snapshots.

**Health Check**:
- Endpoint: `redis-cli ping`
- Response: `PONG`
- Timeout: 2s
- Interval: 10s

**Startup Order**: First (foundational service).

**Environment Variables**:
```bash
REDIS_HOST=redis-cache
REDIS_PORT=6379
REDIS_LOGLEVEL=notice
REDIS_PERSISTENCE_RDB_INTERVAL=60  # snapshot every 60s
REDIS_PERSISTENCE_RDB_SAVE_PATH=/data/redis/dump.rdb
```

**Process-compose Config**:
```yaml
services:
  redis-cache:
    image: redis:7-alpine
    command: redis-server --loglevel notice --dir /data --save 60 1000
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 2s
      retries: 5
```

**Key Namespaces** (examples):
- `policy:allowlist:{agent_role}` — tool allowlist (cached JSON)
- `velocity-control:{workflow_id}:{merchant}:{category}` — spend tracking (counter)
- `global-spend:{YYYY-MM-DD}` — daily spend total (counter)
- `agent-slots:{agent_role}` — available agent slots (counter)
- `pool-utilization` — L3 worker pool utilization (%)
- `artifact-cache:{idempotency_key}` — cached artifact output
- `session:{session_id}` — founder session state (expiring, TTL 24h)

**Inter-Service Communication**: Standard Redis client libraries (redis-py, node-redis, etc.). No special protocol.

---

## Inter-Service Communication Map

```
control-plane-api (8000)
  ├─ calls ──→ policy-engine (8001)          [validate intents]
  ├─ calls ──→ venture-orchestrator (8005)   [dispatch tasks]
  ├─ queries ──→ ledger-db (5432)            [workflows, audit]
  └─ reads ──→ redis-cache (6379)            [sessions, rate limits]

policy-engine (8001)
  ├─ reads ──→ redis-cache (6379)            [policy cache, allowlists]
  ├─ queries ──→ ledger-db (5432)            [schema registry, policies]
  └─ (called by all services for tool checks)

artifact-compiler (8002)
  ├─ inserts ──→ ledger-db (5432)            [artifact_ir, builds, provenance]
  ├─ publishes ──→ event-bus (4222)          [artifact.* events]
  ├─ reads/writes ──→ redis-cache (6379)     [build cache]
  └─ calls ──→ external APIs                 [Claude, Veo, Banana]

treasury-api (8003)
  ├─ queries ──→ ledger-db (5432)            [money_intents, authorization_decisions, ledger_entries]
  ├─ publishes ──→ event-bus (4222)          [money.*, ledger.* events]
  ├─ reads/writes ──→ redis-cache (6379)     [velocity control, locks]
  └─ calls ──→ policy-engine (8001)          [policy bundle validation]

compliance-engine (8004)
  ├─ inserts ──→ ledger-db (5432)            [compliance_cases, audit_trail]
  ├─ subscribes ──→ event-bus (4222)         [all event topics]
  ├─ publishes ──→ event-bus (4222)          [compliance.* events]
  ├─ reads ──→ redis-cache (6379)            [rule cache]
  └─ calls ──→ control-plane-api (8000)      [escalate incidents]

venture-orchestrator (8005)
  ├─ queries/inserts ──→ ledger-db (5432)    [workflows, tasks]
  ├─ publishes/subscribes ──→ event-bus (4222) [task.* events]
  ├─ calls ──→ agent-runtime                 [L1/L2 dispatch]
  └─ reads/writes ──→ redis-cache (6379)     [task queue, agent slots]

agent-runtime
  ├─ calls ──→ policy-engine (8001)          [tool allowlist checks, workload identity]
  ├─ publishes ──→ event-bus (4222)          [tool.call.executed, task.completed]
  ├─ inserts ──→ ledger-db (5432)            [agent_actions, results]
  └─ reads/writes ──→ redis-cache (6379)     [agent state, slot tracking]

event-bus (NATS, 4222)
  └─ backed by ──→ ledger-db (5432)          [event persistence (optional)]

ledger-db (PostgreSQL, 5432)
  └─ queried by all services                 [append-only event store + projections]

redis-cache (Redis, 6379)
  └─ accessed by all services                [caching, rate limiting, state]
```

---

## Startup Order (process-compose)

1. **redis-cache** (foundational)
2. **ledger-db** (foundational)
3. **event-bus** (NATS)
4. **policy-engine** (depends on redis, ledger)
5. **agent-runtime** (depends on policy, event-bus, ledger, redis)
6. **artifact-compiler** (depends on ledger, event-bus, redis)
7. **treasury-api** (depends on ledger, event-bus, redis, policy)
8. **compliance-engine** (depends on ledger, event-bus, redis)
9. **venture-orchestrator** (depends on ledger, event-bus, agent-runtime, redis)
10. **control-plane-api** (depends on policy, orchestrator, ledger, redis)

## Shutdown Order (reverse)

1. control-plane-api (stop accepting new requests)
2. venture-orchestrator (wait for in-flight tasks, cancel pending)
3. compliance-engine (stop event consumption)
4. treasury-api (settle pending intents)
5. artifact-compiler (cancel pending builds)
6. agent-runtime (kill in-flight L3 workers, wait for L2 completion)
7. policy-engine (stop serving)
8. event-bus (NATS flush and close)
9. ledger-db (checkpoint, close)
10. redis-cache (persist RDB, close)

---

## Health Check Strategy

Each service exposes `GET /health` returning `{ "status": "ok"|"degraded"|"down", ... }`.

**Composite health** (control-plane-api):
```python
def check_system_health():
    services = [
        ("policy-engine", call_health("http://policy-engine:8001/health")),
        ("artifact-compiler", call_health("http://artifact-compiler:8002/health")),
        ("treasury-api", call_health("http://treasury-api:8003/health")),
        ("compliance-engine", call_health("http://compliance-engine:8004/health")),
        ("venture-orchestrator", call_health("http://venture-orchestrator:8005/health")),
        ("event-bus", call_health("http://event-bus:8222/healthz")),
        ("ledger-db", check_postgres()),
        ("redis-cache", check_redis()),
    ]

    all_ok = all(s[1] == "ok" for s in services)
    system_status = "ok" if all_ok else ("degraded" if any(s[1] != "down" for s in services) else "down")

    return { "status": system_status, "services": dict(services) }
```

Founder queries via `GET /health` endpoint; triggers system freeze if status="down".

---

## Monitoring & Metrics

**Prometheus scrape targets**:
- control-plane-api:8000/metrics
- policy-engine:8001/metrics
- artifact-compiler:8002/metrics
- treasury-api:8003/metrics
- compliance-engine:8004/metrics
- venture-orchestrator:8005/metrics
- redis_exporter:9121 (for Redis)
- postgres_exporter:9187 (for PostgreSQL)
- nats_exporter:7777 (for NATS)

**Key metrics** per service: see TECHNICAL_SPEC.md "Monitoring & Observability" section.

---

## Revision History

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-02-21 | 1.0 | AI Agent | Complete service catalog: 10 services, health checks, environment contracts, inter-service communication map, startup/shutdown order. |
