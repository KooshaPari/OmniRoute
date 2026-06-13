# Parpour Deployment & Infrastructure Specification

**Document ID:** PARPOUR-INFRA-SPEC-001
**Version:** 1.0.0
**Status:** ACTIVE
**Date:** 2026-02-21
**Owner:** Venture Platform Engineering
**Related Specs:**
- `TECHNICAL_SPEC.md` — System architecture, service inventory, event sourcing model
- `TRACK_C_CONTROL_PLANE.md` — Control plane, policy engine, rollout stages
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Treasury, ledger, compliance
- `docs/reference/SERVICE_CATALOG.md` — Service health contracts
- `docs/reference/LIBRARY_MANIFEST.md` — Library dependency manifest

---

## Table of Contents

1. [Service Graph](#1-service-graph)
2. [process-compose.yml — Local Development Stack](#2-process-composeyml--local-development-stack)
3. [NATS JetStream Configuration](#3-nats-jetstream-configuration)
4. [PostgreSQL Configuration](#4-postgresql-configuration)
5. [Redis Configuration](#5-redis-configuration)
6. [MinIO Bucket Setup](#6-minio-bucket-setup)
7. [Health Check Matrix](#7-health-check-matrix)
8. [Production Topology](#8-production-topology)
9. [Environment Variable Catalog](#9-environment-variable-catalog)
10. [Secret Management](#10-secret-management)
11. [Observability Stack](#11-observability-stack)

---

## 1. Service Graph

The following ASCII diagram shows all services and their communication paths. Arrows indicate the direction of requests or events. Double arrows (`<-->`) indicate bidirectional communication.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                           VENTURE PLATFORM SERVICE GRAPH                         ║
╚══════════════════════════════════════════════════════════════════════════════════╝

FOUNDER BROWSER / CLI
    │
    │  HTTPS REST + WebSocket (wss://)
    ▼
┌─────────────────────────────────────────────────────┐
│           control-plane-api  :8000                   │
│  POST /workflows  POST /tasks  WS /ws/founder        │
│  GET /workflows/:id  DELETE /workflows/:id/freeze    │
└───┬─────────────┬───────────────────┬───────────────┘
    │ HTTP POST   │ HTTP POST          │ NATS pub
    │             │                   │ workflow.*.v1
    ▼             ▼                   ▼
┌──────────┐ ┌──────────────┐ ┌─────────────────────────────────────────────────┐
│ policy-  │ │ venture-     │ │              NATS JetStream  :4222               │
│ engine   │ │ orchestrator │ │  ┌──────────────────────────────────────────┐   │
│ :8001    │ │ :8005        │ │  │  Streams:                                │   │
│          │ │              │ │  │  EVENTS (policy.>, workflow.>, task.>,   │   │
│ Tool     │ │ Portfolio    │ │  │         artifact.>, money.>, ledger.>,   │   │
│ allowlist│ │ mgmt         │ │  │         compliance.>, privacy.>, audit.>)│   │
│ checks   │ │ DAG exec     │ │  └──────────────────────────────────────────┘   │
│ Intent   │ │ L1/L2/L3     │ └─────────────────────────────────────────────────┘
│ validate │ │ dispatch     │     ▲           ▲           ▲           ▲
└──────────┘ └──────────────┘     │           │           │           │
    ▲              │               │           │           │           │
    │ Redis GET    │ NATS pub      │ pub       │ sub       │ sub       │ sub
    │ (policy      │ task.*.v1     │           │           │           │
    │  cache)      │               │           │           │           │
    │         ┌────┘       ┌───────┘     ┌─────┴──┐ ┌─────┴──┐ ┌─────┴──┐
    │         ▼            │             │treasury│ │compli- │ │ledger  │
    │  ┌────────────┐      │             │-api    │ │ance-   │ │-db     │
    │  │agent-      │      │             │:8003   │ │engine  │ │projec- │
    │  │runtime     │      │             │        │ │:8004   │ │tion    │
    │  │            │      │             │Double  │ │        │ │worker  │
    │  │ L1 Orch    │      │             │entry   │ │Policy  │ │        │
    │  │ L2 Spec    │      │             │ledger  │ │rule    │ │(async) │
    │  │ L3 Pool    │      │             │Velocity│ │eval    │ │        │
    │  └──────┬─────┘      │             │control │ │DSAR    │ └────────┘
    │         │            │             └────────┘ └────────┘     │
    │         │ NATS req/  │                 │           │          │
    │         │ reply      │                 │ SQL       │ SQL      │ SQL
    │         │            │                 ▼           ▼          ▼
    └─────────┘            │         ┌────────────────────────────────────────┐
    HTTP tool check        │         │         PostgreSQL  :5432               │
                           │         │  Tables: events (append-only)           │
                           │         │  Projections: workflows, tasks,         │
                           │         │  money_intents, ledger_entries,         │
                           │         │  compliance_cases, audit_checkpoints    │
                           │         └────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │   artifact-compiler :8002  │
              │                           │
              │  NATS sub: artifact.*.v1  │
              │  SlideSpec → .pptx        │
              │  DocSpec → .docx          │
              │  HtmlSpec → .pdf          │
              │  VideoSpec → .mp4         │
              │                           │
              │  External APIs:           │
              │  ├── Claude API (HTTPS)   │
              │  └── OpenAI API (HTTPS)   │
              └──────────┬────────────────┘
                         │
                         │ S3 PUT (artifact binary)
                         ▼
              ┌───────────────────────────┐
              │     MinIO  :9000          │
              │  bucket: venture-artifacts│
              │  bucket: venture-replays  │
              │  bucket: venture-exports  │
              └───────────────────────────┘

SHARED INFRASTRUCTURE (all services connect):
┌───────────────────────────────────────────────────┐
│  Redis  :6379                                      │
│  - Policy cache (tool allowlists, policy bundles)  │
│  - Velocity controls (per-workflow spend windows)  │
│  - Idempotency keys (request deduplication)        │
│  - Agent slot counts (orchestrator dispatch)        │
│  - Hot snapshot cache (last 10 ticks)              │
└───────────────────────────────────────────────────┘

COMMUNICATION PROTOCOLS:
━━━━━━━━━━━━━━━━━━━━━━
  ──►   HTTP/REST (synchronous request-response)
  ═══►  HTTPS (external encrypted)
  ~~~►  WebSocket (wss:// persistent)
  ···►  NATS pub/sub (async event bus)
  ─·─►  NATS request/reply (synchronous RPC over NATS)
  ───►  SQL (PostgreSQL asyncpg)
  ──►   Redis commands (redis.asyncio)
  ──►   S3 PUT/GET (aioboto3)
```

### 1.1 Communication Matrix

| From | To | Protocol | Purpose | Latency Budget |
|---|---|---|---|---|
| control-plane-api | policy-engine | HTTP POST | Intent validation | < 50ms p95 |
| control-plane-api | venture-orchestrator | HTTP POST | Task dispatch | < 100ms p95 |
| control-plane-api | NATS | Pub | workflow.submitted.v1 | < 5ms p95 |
| control-plane-api | Redis | GET/SET | Session state | < 2ms p95 |
| control-plane-api | PostgreSQL | SELECT | Workflow status queries | < 20ms p95 |
| venture-orchestrator | NATS | Pub | task.dispatch.v1 | < 5ms p95 |
| venture-orchestrator | Redis | GET/SET | Agent slot counts | < 2ms p95 |
| venture-orchestrator | agent-runtime | HTTP POST | L1/L2 dispatch | < 200ms p95 |
| agent-runtime | policy-engine | NATS req/reply | Tool allowlist check | < 50ms p95 |
| agent-runtime | NATS | Pub | task.completed.v1 | < 5ms p95 |
| policy-engine | Redis | GET/SET | Policy cache | < 2ms p95 |
| policy-engine | PostgreSQL | SELECT | Policy bundle versions | < 20ms p95 |
| treasury-api | PostgreSQL | INSERT/SELECT | Ledger entries | < 50ms p95 |
| treasury-api | Redis | INCRBY | Velocity tracking | < 2ms p95 |
| treasury-api | NATS | Pub | money.authorization.v1 | < 5ms p95 |
| compliance-engine | PostgreSQL | SELECT | Event query | < 50ms p95 |
| compliance-engine | NATS | Sub | All event topics | async |
| artifact-compiler | NATS | Sub | artifact.build.v1 | async |
| artifact-compiler | MinIO | PUT | Compiled artifacts | < 2s p95 |
| artifact-compiler | Anthropic API | HTTPS | Content generation | < 30s p95 |
| All services | PostgreSQL | INSERT | Event append | < 10ms p95 |

---

## 2. process-compose.yml — Local Development Stack

The following `process-compose.yml` defines the complete local development environment. Services are started in dependency order. All services use health checks before dependent services start.

```yaml
# process-compose.yml
# Local development stack for Venture platform
# Usage: process-compose up
# Requires: Docker (for infrastructure), uv (for Python services)
# Ports: see service definitions below

version: "0.5"

environment:
  - VENTURE_ENVIRONMENT=development
  - PYTHONUNBUFFERED=1

processes:

  # ─────────────────────────────────────────────────────────────────────────
  # INFRASTRUCTURE LAYER
  # ─────────────────────────────────────────────────────────────────────────

  postgres:
    command: >
      docker run --rm --name venture-postgres
      -e POSTGRES_USER=venture
      -e POSTGRES_PASSWORD=venture_dev_password
      -e POSTGRES_DB=venture
      -e POSTGRES_INITDB_ARGS="--auth-host=scram-sha-256"
      -p 5432:5432
      -v ./data/postgres:/var/lib/postgresql/data
      -v ./config/postgres/postgresql.conf:/etc/postgresql/postgresql.conf
      -v ./config/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
      postgres:17
      postgres -c config_file=/etc/postgresql/postgresql.conf
    readiness_probe:
      exec:
        command: >
          docker exec venture-postgres
          pg_isready -U venture -d venture -q
      initial_delay_seconds: 3
      period_seconds: 2
      timeout_seconds: 5
      failure_threshold: 15
    availability:
      restart: on_failure
      max_restarts: 3
    shutdown:
      command: docker stop venture-postgres
      timeout_seconds: 10

  nats:
    command: >
      docker run --rm --name venture-nats
      -p 4222:4222
      -p 6222:6222
      -p 8222:8222
      -v ./config/nats/nats.conf:/etc/nats/nats.conf
      -v ./data/nats:/data/nats
      nats:2.10
      -c /etc/nats/nats.conf
    readiness_probe:
      http_get:
        host: localhost
        port: 8222
        path: /healthz
      initial_delay_seconds: 2
      period_seconds: 2
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 3
    shutdown:
      command: docker stop venture-nats
      timeout_seconds: 5

  redis:
    command: >
      docker run --rm --name venture-redis
      -p 6379:6379
      -v ./config/redis/redis.conf:/usr/local/etc/redis/redis.conf
      -v ./data/redis:/data
      redis:7.4
      redis-server /usr/local/etc/redis/redis.conf
    readiness_probe:
      exec:
        command: docker exec venture-redis redis-cli ping
      initial_delay_seconds: 1
      period_seconds: 2
      timeout_seconds: 3
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 3
    shutdown:
      command: docker exec venture-redis redis-cli SHUTDOWN NOSAVE || docker stop venture-redis
      timeout_seconds: 5

  minio:
    command: >
      docker run --rm --name venture-minio
      -p 9000:9000
      -p 9001:9001
      -e MINIO_ROOT_USER=venture_minio_access
      -e MINIO_ROOT_PASSWORD=venture_minio_secret_dev
      -e MINIO_SITE_NAME=venture-local
      -v ./data/minio:/data
      minio/minio:latest
      server /data --console-address ":9001"
    readiness_probe:
      http_get:
        host: localhost
        port: 9000
        path: /minio/health/live
      initial_delay_seconds: 3
      period_seconds: 2
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 3
    shutdown:
      command: docker stop venture-minio
      timeout_seconds: 5

  # MinIO bucket initialization — runs once after minio is ready
  minio-init:
    command: bash ./scripts/minio-init.sh
    depends_on:
      minio:
        condition: process_healthy
    availability:
      restart: exit_on_failure

  # Database migration — runs once after postgres is ready
  db-migrate:
    command: uv run alembic upgrade head
    working_dir: .
    environment:
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_ENVIRONMENT=development
    depends_on:
      postgres:
        condition: process_healthy
    availability:
      restart: exit_on_failure

  # ─────────────────────────────────────────────────────────────────────────
  # APPLICATION LAYER
  # ─────────────────────────────────────────────────────────────────────────

  policy-engine:
    command: >
      uv run uvicorn app.services.policy_engine.main:app
      --host 0.0.0.0
      --port 8001
      --reload
      --reload-dir app/services/policy_engine
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=policy-engine
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/0
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_JWT_SECRET_KEY=dev-jwt-secret-key-minimum-32-chars-long
      - VENTURE_ENVIRONMENT=development
      - VENTURE_LOG_LEVEL=INFO
    depends_on:
      db-migrate:
        condition: process_completed_successfully
      redis:
        condition: process_healthy
      nats:
        condition: process_healthy
    readiness_probe:
      http_get:
        host: localhost
        port: 8001
        path: /health
      initial_delay_seconds: 3
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  control-plane-api:
    command: >
      uv run uvicorn app.services.control_plane.main:app
      --host 0.0.0.0
      --port 8000
      --reload
      --reload-dir app/services/control_plane
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=control-plane-api
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/0
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_JWT_SECRET_KEY=dev-jwt-secret-key-minimum-32-chars-long
      - VENTURE_JWT_ALGORITHM=HS256
      - VENTURE_JWT_EXPIRY_SECONDS=3600
      - VENTURE_ENVIRONMENT=development
      - VENTURE_LOG_LEVEL=INFO
      - VENTURE_ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:8000"]
    depends_on:
      policy-engine:
        condition: process_healthy
      db-migrate:
        condition: process_completed_successfully
      redis:
        condition: process_healthy
      nats:
        condition: process_healthy
    readiness_probe:
      http_get:
        host: localhost
        port: 8000
        path: /health
      initial_delay_seconds: 3
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  treasury-api:
    command: >
      uv run uvicorn app.services.treasury.main:app
      --host 0.0.0.0
      --port 8003
      --reload
      --reload-dir app/services/treasury
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=treasury-api
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/1
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_JWT_SECRET_KEY=dev-jwt-secret-key-minimum-32-chars-long
      - VENTURE_ENVIRONMENT=development
    depends_on:
      db-migrate:
        condition: process_completed_successfully
      policy-engine:
        condition: process_healthy
      nats:
        condition: process_healthy
      redis:
        condition: process_healthy
    readiness_probe:
      http_get:
        host: localhost
        port: 8003
        path: /health
      initial_delay_seconds: 3
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  compliance-engine:
    command: >
      uv run uvicorn app.services.compliance.main:app
      --host 0.0.0.0
      --port 8004
      --reload
      --reload-dir app/services/compliance
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=compliance-engine
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/2
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_ENVIRONMENT=development
    depends_on:
      db-migrate:
        condition: process_completed_successfully
      nats:
        condition: process_healthy
      redis:
        condition: process_healthy
    readiness_probe:
      http_get:
        host: localhost
        port: 8004
        path: /health
      initial_delay_seconds: 3
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  artifact-compiler:
    command: >
      uv run uvicorn app.services.artifact_compiler.main:app
      --host 0.0.0.0
      --port 8002
      --reload
      --reload-dir app/services/artifact_compiler
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=artifact-compiler
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/3
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - VENTURE_OPENAI_API_KEY=${OPENAI_API_KEY}
      - VENTURE_S3_ENDPOINT_URL=http://localhost:9000
      - VENTURE_S3_ACCESS_KEY_ID=venture_minio_access
      - VENTURE_S3_SECRET_ACCESS_KEY=venture_minio_secret_dev
      - VENTURE_S3_BUCKET_ARTIFACTS=venture-artifacts
      - VENTURE_ENVIRONMENT=development
    depends_on:
      minio-init:
        condition: process_completed_successfully
      nats:
        condition: process_healthy
      redis:
        condition: process_healthy
      db-migrate:
        condition: process_completed_successfully
    readiness_probe:
      http_get:
        host: localhost
        port: 8002
        path: /health
      initial_delay_seconds: 5
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  venture-orchestrator:
    command: >
      uv run uvicorn app.services.orchestrator.main:app
      --host 0.0.0.0
      --port 8005
      --reload
      --reload-dir app/services/orchestrator
      --log-level info
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=venture-orchestrator
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/4
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_POLICY_ENGINE_URL=http://localhost:8001
      - VENTURE_ENVIRONMENT=development
      - VENTURE_L3_MAX_CONCURRENCY=5
      - VENTURE_L3_QUEUE_DEPTH=20
      - VENTURE_L3_TIMEOUT_SECONDS=1800
    depends_on:
      policy-engine:
        condition: process_healthy
      nats:
        condition: process_healthy
      redis:
        condition: process_healthy
      db-migrate:
        condition: process_completed_successfully
    readiness_probe:
      http_get:
        host: localhost
        port: 8005
        path: /health
      initial_delay_seconds: 3
      period_seconds: 3
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 5

  worker:
    command: >
      uv run python -m app.services.worker.main
    working_dir: .
    environment:
      - VENTURE_SERVICE_NAME=worker
      - VENTURE_DATABASE_URL=postgresql+asyncpg://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:venture_dev_password@localhost:5432/venture
      - VENTURE_REDIS_URL=redis://localhost:6379/5
      - VENTURE_NATS_SERVERS=["nats://localhost:4222"]
      - VENTURE_POLICY_ENGINE_URL=http://localhost:8001
      - VENTURE_ENVIRONMENT=development
      - VENTURE_WORKER_CONCURRENCY=4
    depends_on:
      nats:
        condition: process_healthy
      postgres:
        condition: process_healthy
      db-migrate:
        condition: process_completed_successfully
    availability:
      restart: on_failure
      max_restarts: 5
    readiness_probe:
      exec:
        command: uv run python -c "from app.services.worker.health import check; check()"
      initial_delay_seconds: 5
      period_seconds: 5
      timeout_seconds: 10
      failure_threshold: 5

  # ─────────────────────────────────────────────────────────────────────────
  # OBSERVABILITY LAYER (optional, enable with VENTURE_OBSERVABILITY=true)
  # ─────────────────────────────────────────────────────────────────────────

  prometheus:
    command: >
      docker run --rm --name venture-prometheus
      -p 9090:9090
      -v ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      -v ./data/prometheus:/prometheus
      prom/prometheus:v3.1.0
      --config.file=/etc/prometheus/prometheus.yml
      --storage.tsdb.path=/prometheus
      --storage.tsdb.retention.time=15d
      --web.enable-lifecycle
    readiness_probe:
      http_get:
        host: localhost
        port: 9090
        path: /-/healthy
      initial_delay_seconds: 3
      period_seconds: 5
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
      max_restarts: 3
    shutdown:
      command: docker stop venture-prometheus
      timeout_seconds: 5

  grafana:
    command: >
      docker run --rm --name venture-grafana
      -p 3001:3000
      -e GF_SECURITY_ADMIN_PASSWORD=admin
      -e GF_USERS_ALLOW_SIGN_UP=false
      -v ./config/grafana/provisioning:/etc/grafana/provisioning
      -v ./data/grafana:/var/lib/grafana
      grafana/grafana:11.4.0
    depends_on:
      prometheus:
        condition: process_healthy
    readiness_probe:
      http_get:
        host: localhost
        port: 3001
        path: /api/health
      initial_delay_seconds: 5
      period_seconds: 5
      timeout_seconds: 5
      failure_threshold: 10
    availability:
      restart: on_failure
    shutdown:
      command: docker stop venture-grafana
      timeout_seconds: 5
```

---

## 3. NATS JetStream Configuration

### 3.1 Full nats.conf

```conf
# config/nats/nats.conf
# NATS Server 2.10 configuration for Venture platform
# Production cluster stub included (commented out)

# ─────────────────────────────────────────────────────────
# Server Identity
# ─────────────────────────────────────────────────────────
server_name: venture-nats-1

# Client connections
host: 0.0.0.0
port: 4222

# HTTP monitoring
http_port: 8222

# Cluster routing (node-to-node)
# Development: leave commented out (single node)
# Production: uncomment and configure per topology
# cluster {
#   name: venture-cluster
#   host: 0.0.0.0
#   port: 6222
#   routes: [
#     nats-route://venture-nats-1:6222
#     nats-route://venture-nats-2:6222
#     nats-route://venture-nats-3:6222
#   ]
# }

# ─────────────────────────────────────────────────────────
# JetStream Configuration
# ─────────────────────────────────────────────────────────
jetstream {
  # Storage root — all durable data lives here
  store_dir: /data/nats

  # Memory store limit: 2 GB (for in-memory streams used by policy cache)
  max_memory_store: 2147483648

  # File store limit: 50 GB (for durable event streams)
  max_file_store: 53687091200

  # Domain for JetStream (default is empty/global)
  domain: venture
}

# ─────────────────────────────────────────────────────────
# Authorization
# ─────────────────────────────────────────────────────────
# Development: no auth (plain text)
# Production: NKey or JWT-based auth required
# authorization {
#   token: "venture-nats-dev-token"
# }

# ─────────────────────────────────────────────────────────
# TLS (Production only)
# ─────────────────────────────────────────────────────────
# tls {
#   cert_file: /etc/nats/tls/server.crt
#   key_file:  /etc/nats/tls/server.key
#   ca_file:   /etc/nats/tls/ca.crt
#   verify:    true
# }

# ─────────────────────────────────────────────────────────
# Connection Limits
# ─────────────────────────────────────────────────────────
# Maximum clients
max_connections: 1000

# Maximum payload size per message: 8 MB
# (artifact IR specs may be large; individual events should be < 1 MB)
max_payload: 8388608

# Maximum pending writes per connection: 64 MB
max_pending: 67108864

# ─────────────────────────────────────────────────────────
# Ping/Pong Configuration
# ─────────────────────────────────────────────────────────
ping_interval: 30s
ping_max: 5

# ─────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────
logfile: /data/nats/nats.log
logfile_size_limit: 100MB
log_size_limit: 100MB
debug: false
trace: false

# ─────────────────────────────────────────────────────────
# Write deadline (controls flush behavior)
# ─────────────────────────────────────────────────────────
write_deadline: 10s
```

### 3.2 Stream Definitions (Python bootstrap script)

The following runs once at startup to ensure streams exist:

```python
# scripts/nats_streams_init.py
import asyncio
import nats
from nats.js.api import (
    StreamConfig,
    RetentionPolicy,
    StorageType,
    RePublish,
    DiscardPolicy,
)

STREAM_CONFIGS = [
    StreamConfig(
        name="EVENTS",
        subjects=[
            "policy.>",
            "workflow.>",
            "task.>",
            "artifact.>",
            "money.>",
            "ledger.>",
            "compliance.>",
            "privacy.>",
            "audit.>",
            "control.>",
        ],
        retention=RetentionPolicy.LIMITS,
        storage=StorageType.FILE,
        max_bytes=10 * 1024 * 1024 * 1024,  # 10 GB
        max_age=86400 * 90,  # 90 days in seconds
        num_replicas=1,  # 3 in production
        discard=DiscardPolicy.OLD,
        description="Primary event stream — all Venture EventEnvelopeV1 events",
        allow_rollup=False,
        deny_delete=True,
        deny_purge=False,  # Allow compliance to purge privacy-sensitive events
    ),
    StreamConfig(
        name="POLICY_CACHE",
        subjects=["policy.cache.>"],
        retention=RetentionPolicy.LIMITS,
        storage=StorageType.MEMORY,  # Fast in-memory — policy cache hits
        max_bytes=512 * 1024 * 1024,  # 512 MB
        max_age=3600,  # 1 hour
        num_replicas=1,
        description="In-memory policy bundle and allowlist cache stream",
    ),
    StreamConfig(
        name="TASK_WORK_QUEUE",
        subjects=["task.l3.dispatch.>"],
        retention=RetentionPolicy.WORK_QUEUE,  # Each message consumed once
        storage=StorageType.FILE,
        max_bytes=1 * 1024 * 1024 * 1024,  # 1 GB
        max_age=86400,  # 24 hours
        num_replicas=1,
        description="L3 task dispatch work queue — consumed once by agent-runtime pool",
    ),
]

async def init_streams():
    nc = await nats.connect(servers=["nats://localhost:4222"])
    js = nc.jetstream()

    for config in STREAM_CONFIGS:
        try:
            info = await js.find_stream(config.name)
            print(f"Stream {config.name} already exists: {info.config.num_replicas} replicas")
        except nats.js.errors.NotFoundError:
            info = await js.add_stream(config)
            print(f"Created stream {config.name}")

    await nc.close()

if __name__ == "__main__":
    asyncio.run(init_streams())
```

---

## 4. PostgreSQL Configuration

### 4.1 Key postgresql.conf Settings

```ini
# config/postgres/postgresql.conf
# PostgreSQL 17 configuration for Venture platform
# Target: single node development + staging
# Production: separate tuning for primary vs. replica

# ─────────────────────────────────────────────────────────
# Connection Settings
# ─────────────────────────────────────────────────────────

# Maximum client connections (PgBouncer handles pooling in production)
max_connections = 200

# Superuser reserved connections
superuser_reserved_connections = 5

# ─────────────────────────────────────────────────────────
# Memory Settings
# ─────────────────────────────────────────────────────────

# Shared buffer pool — 25% of system RAM (adjust for your machine)
# Development: 256 MB; Production: 8 GB (on 32 GB instance)
shared_buffers = 256MB

# Per-query working memory (sorts, hash joins)
# 4 MB × max_connections = 800 MB max; tuned lower for safety
work_mem = 4MB

# Maintenance operations (VACUUM, CREATE INDEX, etc.)
maintenance_work_mem = 64MB

# OS cache estimate (for planner)
effective_cache_size = 1GB

# ─────────────────────────────────────────────────────────
# Write-Ahead Log (WAL) Settings
# ─────────────────────────────────────────────────────────

# WAL level: replica enables streaming replication
# logical enables logical replication (for CDC, not currently needed)
wal_level = replica

# fsync — always on; never disable (prevents data loss)
fsync = on

# Synchronous commit — off enables async commits (minor data loss risk in crash)
# Set to 'on' for ledger entries (must not lose financial events)
synchronous_commit = on

# WAL writer flush delay
wal_writer_delay = 200ms

# Commit delay — small delay to batch multiple commits (reduces WAL I/O)
commit_delay = 1000
commit_siblings = 10

# WAL buffers
wal_buffers = 16MB

# Checkpoint configuration
checkpoint_completion_target = 0.9
checkpoint_timeout = 5min
max_wal_size = 2GB
min_wal_size = 256MB

# ─────────────────────────────────────────────────────────
# Archiving (for PITR and replica setup)
# ─────────────────────────────────────────────────────────

# Enable WAL archiving (required for point-in-time recovery)
archive_mode = on
archive_command = 'cp %p /data/postgres/archive/%f'
# Production: replace with: 'aws s3 cp %p s3://venture-pg-wal-archive/%f'

archive_cleanup_command = 'pg_archivecleanup /data/postgres/archive %r'

# ─────────────────────────────────────────────────────────
# Replication Settings
# ─────────────────────────────────────────────────────────

# Maximum WAL senders (replicas + backup agents)
max_wal_senders = 5

# Replication slots (keep WAL until all replicas have consumed it)
max_replication_slots = 5

# Hot standby — replicas accept read-only queries
hot_standby = on

# ─────────────────────────────────────────────────────────
# Query Planner
# ─────────────────────────────────────────────────────────

# Enable JIT for complex analytical queries (compliance projections)
jit = on
jit_above_cost = 100000

# Enable parallel query execution
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_worker_processes = 8

# Sequential scan vs. index scan cost
random_page_cost = 1.1  # SSD-optimized (vs. 4.0 for spinning disk)
effective_io_concurrency = 200  # SSD concurrent I/O

# ─────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────

log_destination = 'stderr'
logging_collector = off  # Stdout logging (Docker handles collection)
log_min_duration_statement = 1000  # Log queries > 1 second
log_line_prefix = '%t [%p] %u@%d '
log_checkpoints = on
log_connections = off
log_disconnections = off
log_lock_waits = on
log_temp_files = 10MB  # Log temp file creation > 10 MB (signals work_mem pressure)
log_autovacuum_min_duration = 250ms

# ─────────────────────────────────────────────────────────
# Autovacuum
# ─────────────────────────────────────────────────────────

autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
autovacuum_vacuum_scale_factor = 0.02
autovacuum_analyze_scale_factor = 0.01

# ─────────────────────────────────────────────────────────
# Lock Management
# ─────────────────────────────────────────────────────────

deadlock_timeout = 1s
lock_timeout = 30000  # 30 seconds — prevents indefinite lock waits
statement_timeout = 60000  # 60 seconds — prevents runaway queries
```

### 4.2 Database Initialization SQL

```sql
-- config/postgres/init.sql
-- Runs once when the container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Read-only role for compliance-engine and projection workers
CREATE ROLE venture_readonly;
GRANT CONNECT ON DATABASE venture TO venture_readonly;
GRANT USAGE ON SCHEMA public TO venture_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO venture_readonly;

-- Application role
CREATE ROLE venture_app LOGIN PASSWORD 'venture_dev_password';
GRANT ALL PRIVILEGES ON DATABASE venture TO venture_app;

-- Replication role (for streaming replication in production)
CREATE ROLE venture_replicator WITH REPLICATION LOGIN PASSWORD 'venture_replication_password';
```

---

## 5. Redis Configuration

### 5.1 redis.conf

```conf
# config/redis/redis.conf
# Redis 7.4 configuration for Venture platform

# ─────────────────────────────────────────────────────────
# Network
# ─────────────────────────────────────────────────────────

bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# ─────────────────────────────────────────────────────────
# General
# ─────────────────────────────────────────────────────────

# Run as daemon: no (Docker manages the process)
daemonize no

# PID file
pidfile /var/run/redis/redis.pid

# Log level: notice (verbose production logs)
loglevel notice

# ─────────────────────────────────────────────────────────
# Memory Management
# ─────────────────────────────────────────────────────────

# Maximum memory — set to 70% of available RAM
# Development: 2 GB; Production: 8-16 GB
maxmemory 2gb

# Eviction policy: allkeys-lru
# ALL keys are eligible for eviction (not just those with TTL)
# LRU: least recently used keys are evicted first
# This is correct because Redis is a cache (no persistent critical data stored here)
maxmemory-policy allkeys-lru

# LRU approximation samples (higher = more accurate, more CPU)
maxmemory-samples 10

# ─────────────────────────────────────────────────────────
# Lazy Freeing (async eviction/deletion — reduces latency spikes)
# ─────────────────────────────────────────────────────────

lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
lazyfree-lazy-user-del yes
lazyfree-lazy-user-flush yes

# ─────────────────────────────────────────────────────────
# Persistence — RDB Snapshots
# ─────────────────────────────────────────────────────────

# RDB snapshots: acceptable data loss up to snapshot interval
# Redis is a cache — data loss on crash is acceptable; services recompute

# Save every 3600 seconds if at least 1 key changed
save 3600 1
# Save every 300 seconds if at least 100 keys changed
save 300 100
# Save every 60 seconds if at least 10000 keys changed
save 60 10000

# RDB file
dbfilename dump.rdb
dir /data

# RDB compression
rdbcompression yes

# RDB checksum
rdbchecksum yes

# ─────────────────────────────────────────────────────────
# AOF (Append-Only File) — DISABLED
# ─────────────────────────────────────────────────────────
# AOF is disabled because Redis is a cache.
# Data loss on crash is acceptable — services recompute from PostgreSQL/NATS.

appendonly no

# ─────────────────────────────────────────────────────────
# Slow Log
# ─────────────────────────────────────────────────────────

# Log queries slower than 10ms
slowlog-log-slower-than 10000
slowlog-max-len 256

# ─────────────────────────────────────────────────────────
# Latency Monitoring
# ─────────────────────────────────────────────────────────

latency-monitor-threshold 100

# ─────────────────────────────────────────────────────────
# Active Defragmentation (reduces memory fragmentation)
# ─────────────────────────────────────────────────────────

activedefrag yes
active-defrag-ignore-bytes 100mb
active-defrag-threshold-lower 10
active-defrag-threshold-upper 100
active-defrag-cycle-min 1
active-defrag-cycle-max 25

# ─────────────────────────────────────────────────────────
# Database Count
# ─────────────────────────────────────────────────────────

# 16 databases — services use different DB indices
# DB 0: control-plane-api (session state)
# DB 1: treasury-api (velocity controls, idempotency keys)
# DB 2: compliance-engine (case state cache)
# DB 3: artifact-compiler (build idempotency keys)
# DB 4: venture-orchestrator (agent slots, task queue)
# DB 5: worker (job state)
# DB 6: policy-engine (tool allowlists, policy bundles)
# DB 7-15: reserved

databases 16
```

---

## 6. MinIO Bucket Setup

### 6.1 Bucket Initialization Script

```bash
#!/usr/bin/env bash
# scripts/minio-init.sh
# Initializes MinIO buckets, lifecycle rules, and CORS config

set -euo pipefail

MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="venture_minio_access"
MINIO_SECRET_KEY="venture_minio_secret_dev"
MC_ALIAS="venture-local"

# Wait for MinIO to be ready
echo "Waiting for MinIO..."
until curl -sf "${MINIO_ENDPOINT}/minio/health/live" > /dev/null; do
  sleep 1
done
echo "MinIO ready."

# Configure mc alias
docker run --rm --network host \
  -e MC_HOST_${MC_ALIAS}="${MINIO_ENDPOINT}" \
  minio/mc:latest \
  alias set "${MC_ALIAS}" "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"

# Helper: run mc command
mc() {
  docker run --rm --network host \
    -e MC_HOST_${MC_ALIAS}="${MINIO_ENDPOINT}" \
    minio/mc:latest "$@"
}

# ─────────────────────────────────────────────────────────
# Bucket: venture-artifacts
# Purpose: Compiled artifacts (.pptx, .docx, .pdf, .mp4, .png)
# ─────────────────────────────────────────────────────────

mc mb --ignore-existing "${MC_ALIAS}/venture-artifacts"
mc anonymous set-json /dev/stdin "${MC_ALIAS}/venture-artifacts" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::venture-artifacts/*"]
    }
  ]
}
EOF
# All artifact access requires signed URLs — no public read

# Lifecycle: delete artifacts older than 90 days
mc ilm rule add \
  --expire-days 90 \
  "${MC_ALIAS}/venture-artifacts"

echo "Bucket venture-artifacts configured."

# ─────────────────────────────────────────────────────────
# Bucket: venture-replays
# Purpose: Simulation replay files, audit snapshots
# Retention: indefinite (compliance requirement)
# ─────────────────────────────────────────────────────────

mc mb --ignore-existing "${MC_ALIAS}/venture-replays"

# Object locking for compliance (cannot delete or overwrite)
# Note: requires --with-lock when creating bucket in production
# mc mb --with-lock "${MC_ALIAS}/venture-replays"

echo "Bucket venture-replays configured."

# ─────────────────────────────────────────────────────────
# Bucket: venture-exports
# Purpose: Founder-downloadable exports (temporary signed URLs)
# Lifecycle: delete after 7 days (exports are transient)
# ─────────────────────────────────────────────────────────

mc mb --ignore-existing "${MC_ALIAS}/venture-exports"

mc ilm rule add \
  --expire-days 7 \
  "${MC_ALIAS}/venture-exports"

echo "Bucket venture-exports configured."

# ─────────────────────────────────────────────────────────
# CORS Configuration
# Applies to: venture-exports (for pre-signed URL browser downloads)
# ─────────────────────────────────────────────────────────

mc cors set "${MC_ALIAS}/venture-exports" - <<'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "https://venture.app"
      ],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": [
        "ETag",
        "Content-Length",
        "Content-Type"
      ],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

echo "CORS configured for venture-exports."
echo "MinIO initialization complete."
```

### 6.2 Pre-Signed URL Generation

```python
import aioboto3
from botocore.config import Config

session = aioboto3.Session()

async def generate_download_url(bucket: str, key: str, expiry_seconds: int = 3600) -> str:
    async with session.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    ) as s3:
        url = await s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry_seconds,
        )
    return url
```

---

## 7. Health Check Matrix

Every service must expose a `/health` endpoint returning `{"status": "ok", "service": "<name>", "version": "<version>"}` with HTTP 200. Any non-200 response triggers restart per `process-compose` policy.

| Service | Health Endpoint / Command | Expected Response | Period | Failure Threshold | Failure Action |
|---|---|---|---|---|---|
| **postgres** | `pg_isready -U venture -d venture -q` | exit 0 | 2s | 15 consecutive | Restart container |
| **nats** | `GET http://localhost:8222/healthz` | `{"status": "ok"}` HTTP 200 | 2s | 10 consecutive | Restart container |
| **redis** | `redis-cli ping` → `PONG` | stdout "PONG" | 2s | 10 consecutive | Restart container |
| **minio** | `GET http://localhost:9000/minio/health/live` | HTTP 200 | 2s | 10 consecutive | Restart container |
| **policy-engine** | `GET http://localhost:8001/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **control-plane-api** | `GET http://localhost:8000/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **treasury-api** | `GET http://localhost:8003/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **compliance-engine** | `GET http://localhost:8004/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **artifact-compiler** | `GET http://localhost:8002/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **venture-orchestrator** | `GET http://localhost:8005/health` | `{"status":"ok"}` HTTP 200 | 3s | 10 consecutive | Restart process |
| **worker** | Python health check module | exit 0 | 5s | 5 consecutive | Restart process |

### 7.1 Composite Health Check

Each service's `/health` endpoint checks its own downstream dependencies. The control-plane-api health check verifies:

```python
# app/services/control_plane/health.py
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
import nats

router = APIRouter()

@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    nats_client = Depends(get_nats),
) -> dict:
    checks = {}

    # Database check
    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"

    # Redis check
    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # NATS check
    try:
        if not nats_client.is_connected:
            raise RuntimeError("NATS not connected")
        checks["nats"] = "ok"
    except Exception as e:
        checks["nats"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    status_code = 200 if all_ok else 503

    return JSONResponse(
        content={
            "status": "ok" if all_ok else "degraded",
            "service": "control-plane-api",
            "version": "1.0.0",
            "checks": checks,
        },
        status_code=status_code,
    )
```

---

## 8. Production Topology

### 8.1 NATS Cluster (3 Replicas)

```
┌─────────────────────────────────────────────────────────────────┐
│                       NATS CLUSTER                               │
│                                                                   │
│  venture-nats-1 (:4222, cluster :6222)                          │
│  ├── JetStream: enabled, store: /data/nats                       │
│  ├── Routes: nats-nats-2:6222, nats-nats-3:6222                 │
│  └── Streams: replicated to all 3 nodes (num_replicas=3)        │
│                                                                   │
│  venture-nats-2 (:4222, cluster :6222)                          │
│  ├── JetStream: enabled, store: /data/nats                       │
│  └── Routes: nats-nats-1:6222, nats-nats-3:6222                 │
│                                                                   │
│  venture-nats-3 (:4222, cluster :6222)                          │
│  ├── JetStream: enabled, store: /data/nats                       │
│  └── Routes: nats-nats-1:6222, nats-nats-2:6222                 │
│                                                                   │
│  Quorum: 2/3 nodes for stream leader election                     │
│  Client connect: any node (auto-discover cluster)                │
│  EVENTS stream: max_age=90d, max_bytes=100GB, replicas=3        │
└─────────────────────────────────────────────────────────────────┘
```

**Production nats.conf additions:**
```conf
cluster {
  name: venture-production
  host: 0.0.0.0
  port: 6222
  routes: [
    nats-route://venture-nats-1.venture.internal:6222
    nats-route://venture-nats-2.venture.internal:6222
    nats-route://venture-nats-3.venture.internal:6222
  ]
  # Cluster TLS
  tls {
    cert_file: /etc/nats/cluster.crt
    key_file:  /etc/nats/cluster.key
    ca_file:   /etc/nats/cluster-ca.crt
    verify:    true
  }
}
```

### 8.2 PostgreSQL: Primary + 2 Read Replicas + PgBouncer

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL HA Topology                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  postgres-primary (read-write)                               │    │
│  │  - All INSERT operations (events, projections)               │    │
│  │  - ledger_entries (must write to primary)                    │    │
│  │  - Streaming WAL to replica-1 and replica-2                  │    │
│  │                                                               │    │
│  │  PgBouncer (:6432) → postgres-primary:5432                   │    │
│  │  pool_mode = transaction                                      │    │
│  │  max_client_conn = 1000                                       │    │
│  │  default_pool_size = 25 (per database)                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                    │ streaming replication (async)                    │
│         ┌──────────┴──────────┐                                      │
│         ▼                     ▼                                      │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐    │
│  │ postgres-    │   │ postgres-replica-2 (read-only)            │    │
│  │ replica-1    │   │ - compliance-engine SELECT queries         │    │
│  │ (read-only)  │   │ - projection materialization              │    │
│  │ - projection │   │ - audit query workers                     │    │
│  │   queries    │   │ PgBouncer (:6433) → replica-2:5432       │    │
│  └──────────────┘   └──────────────────────────────────────────┘    │
│                                                                       │
│  WAL archiving: primary → S3 (s3://venture-pg-wal-archive/)         │
│  PITR: 30-day retention                                              │
│  Failover: patroni-managed VIP (automatic)                           │
└─────────────────────────────────────────────────────────────────────┘
```

**PgBouncer configuration (pgbouncer.ini):**
```ini
[databases]
venture = host=postgres-primary port=5432 dbname=venture
venture_ro = host=postgres-replica-1 port=5432 dbname=venture

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
server_lifetime = 3600
server_idle_timeout = 600
server_connect_timeout = 15
server_login_retry = 15
query_timeout = 60
client_idle_timeout = 0
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
```

### 8.3 Redis Sentinel (3-node HA)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Redis Sentinel HA                           │
│                                                                   │
│  redis-primary (:6379)                                           │
│  - All writes                                                    │
│  - RDB snapshots every 3600s                                     │
│  - AOF disabled (cache tier — data loss acceptable)              │
│                                                                   │
│  redis-replica-1 (:6379)                                        │
│  - Async replication from primary                                │
│  - Read-only                                                     │
│                                                                   │
│  redis-sentinel-1 (:26379) + sentinel-2 + sentinel-3            │
│  - Monitor: venture-redis-primary                                │
│  - Quorum: 2 sentinels for failover                             │
│  - Automatic failover if primary down > 30s                     │
│                                                                   │
│  Application connects to Sentinel (not primary directly):        │
│  REDIS_URL=redis+sentinel://sentinel-1:26379,sentinel-2:26379,  │
│             sentinel-3:26379/venture-redis-primary/0             │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 MinIO Distributed Mode (4+ nodes)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MinIO Distributed Mode                         │
│                                                                   │
│  minio-1 (disk: /data/minio)  minio-2 (disk: /data/minio)      │
│  minio-3 (disk: /data/minio)  minio-4 (disk: /data/minio)      │
│                                                                   │
│  Erasure coding: 4+2 (4 data, 2 parity) — survives 2 node loss │
│  Bitrot protection: checksums on all objects                     │
│  Load balancer: nginx → all 4 nodes                             │
│                                                                   │
│  Environment (all nodes):                                        │
│  MINIO_VOLUMES=http://minio-{1...4}/data/minio                  │
│  MINIO_ROOT_USER=<from secret manager>                          │
│  MINIO_ROOT_PASSWORD=<from secret manager>                      │
│  MINIO_SITE_NAME=venture-production                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Environment Variable Catalog

All environment variables use the `VENTURE_` prefix. Variables marked SECRET must not appear in logs, container labels, or Git history.

### 9.1 Universal Variables (all services)

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_SERVICE_NAME` | YES | `policy-engine` | NO | Unique service identifier (used in logs, traces) |
| `VENTURE_ENVIRONMENT` | YES | `development` | NO | Runtime environment: `development`, `staging`, `production` |
| `VENTURE_LOG_LEVEL` | NO | `INFO` | NO | Structlog level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### 9.2 Database Variables

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_DATABASE_URL` | YES | `postgresql+asyncpg://venture:password@localhost:5432/venture` | YES | Full SQLAlchemy async DSN |
| `VENTURE_DATABASE_URL_ASYNCPG` | YES | `postgresql://venture:password@localhost:5432/venture` | YES | Raw asyncpg DSN (no dialect prefix) |
| `VENTURE_DB_POOL_SIZE` | NO | `20` | NO | SQLAlchemy connection pool size (default: 20) |
| `VENTURE_DB_MAX_OVERFLOW` | NO | `10` | NO | SQLAlchemy pool max overflow (default: 10) |

### 9.3 Redis Variables

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_REDIS_URL` | YES | `redis://localhost:6379/0` | YES | Redis connection URL including DB index |
| `VENTURE_REDIS_MAX_CONNECTIONS` | NO | `50` | NO | Connection pool size (default: 50) |

### 9.4 NATS Variables

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_NATS_SERVERS` | YES | `["nats://localhost:4222"]` | NO | JSON array of NATS server URLs |
| `VENTURE_NATS_RECONNECT_WAIT_SECONDS` | NO | `2` | NO | Reconnect backoff (default: 2) |

### 9.5 Authentication Variables

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_JWT_SECRET_KEY` | YES | `a-secret-key-at-least-32-chars` | YES | HMAC signing key for JWT tokens |
| `VENTURE_JWT_ALGORITHM` | NO | `HS256` | NO | JWT algorithm (default: HS256) |
| `VENTURE_JWT_EXPIRY_SECONDS` | NO | `3600` | NO | Token TTL in seconds (default: 3600) |
| `VENTURE_ALLOWED_ORIGINS` | NO | `["http://localhost:3000"]` | NO | CORS allowed origins JSON array |

### 9.6 External API Variables

| Variable | Required By | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_ANTHROPIC_API_KEY` | artifact-compiler, agent-runtime | `sk-ant-...` | YES | Anthropic API key for Claude |
| `VENTURE_OPENAI_API_KEY` | agent-runtime | `sk-...` | YES | OpenAI API key for GPT-5-mini |

### 9.7 Storage (MinIO/S3) Variables

| Variable | Required By | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_S3_ENDPOINT_URL` | artifact-compiler | `http://localhost:9000` | NO | S3-compatible endpoint URL |
| `VENTURE_S3_ACCESS_KEY_ID` | artifact-compiler | `venture_minio_access` | YES | S3 access key ID |
| `VENTURE_S3_SECRET_ACCESS_KEY` | artifact-compiler | `venture_minio_secret_dev` | YES | S3 secret access key |
| `VENTURE_S3_BUCKET_ARTIFACTS` | artifact-compiler | `venture-artifacts` | NO | Bucket for compiled artifacts |
| `VENTURE_S3_BUCKET_EXPORTS` | artifact-compiler | `venture-exports` | NO | Bucket for founder exports |
| `VENTURE_S3_BUCKET_REPLAYS` | various | `venture-replays` | NO | Bucket for audit replay files |

### 9.8 Service URL Variables (inter-service HTTP)

| Variable | Required By | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_POLICY_ENGINE_URL` | orchestrator, agent-runtime | `http://localhost:8001` | NO | Policy-engine base URL |
| `VENTURE_TREASURY_API_URL` | orchestrator | `http://localhost:8003` | NO | Treasury-api base URL |
| `VENTURE_ARTIFACT_COMPILER_URL` | orchestrator | `http://localhost:8002` | NO | Artifact-compiler base URL |

### 9.9 Worker and Orchestrator Variables

| Variable | Required By | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_L3_MAX_CONCURRENCY` | orchestrator | `10` | NO | Max concurrent L3 workers |
| `VENTURE_L3_QUEUE_DEPTH` | orchestrator | `100` | NO | Max pending L3 tasks |
| `VENTURE_L3_TIMEOUT_SECONDS` | orchestrator | `1800` | NO | L3 worker hard timeout (30 min) |
| `VENTURE_WORKER_CONCURRENCY` | worker | `4` | NO | Background task worker concurrency |

### 9.10 Observability Variables

| Variable | Required | Example | Secret | Description |
|---|---|---|---|---|
| `VENTURE_OTEL_ENDPOINT` | NO | `http://localhost:4317` | NO | OpenTelemetry OTLP collector endpoint |
| `VENTURE_OTEL_ENABLED` | NO | `true` | NO | Enable OTel trace export |
| `VENTURE_PROMETHEUS_PORT` | NO | `9090` | NO | Prometheus metrics port override |

---

## 10. Secret Management

### 10.1 .env.example

The `.env.example` file is committed to the repository. It contains all required variable names with placeholder values. Developers copy it to `.env` and fill in real values. `.env` is in `.gitignore`.

```bash
# .env.example
# Copy to .env and fill in real values
# DO NOT commit .env to git

# ─── Service Identity ────────────────────────────────────────────
VENTURE_ENVIRONMENT=development
VENTURE_LOG_LEVEL=INFO

# ─── Database (PostgreSQL) ───────────────────────────────────────
# SQLAlchemy DSN (used by services with sqlalchemy ORM)
VENTURE_DATABASE_URL=postgresql+asyncpg://venture:CHANGE_ME@localhost:5432/venture
# asyncpg DSN (used by raw asyncpg pools)
VENTURE_DATABASE_URL_ASYNCPG=postgresql://venture:CHANGE_ME@localhost:5432/venture

# ─── Cache (Redis) ───────────────────────────────────────────────
VENTURE_REDIS_URL=redis://localhost:6379/0

# ─── Event Bus (NATS) ────────────────────────────────────────────
VENTURE_NATS_SERVERS=["nats://localhost:4222"]

# ─── Authentication ──────────────────────────────────────────────
# Must be at least 32 characters
VENTURE_JWT_SECRET_KEY=CHANGE_ME_TO_A_SECURE_RANDOM_SECRET_MINIMUM_32_CHARS
VENTURE_JWT_ALGORITHM=HS256
VENTURE_JWT_EXPIRY_SECONDS=3600

# ─── External AI APIs ────────────────────────────────────────────
# Get from https://console.anthropic.com
VENTURE_ANTHROPIC_API_KEY=sk-ant-CHANGE_ME
# Get from https://platform.openai.com
VENTURE_OPENAI_API_KEY=sk-CHANGE_ME

# ─── Object Storage (MinIO / S3) ─────────────────────────────────
VENTURE_S3_ENDPOINT_URL=http://localhost:9000
VENTURE_S3_ACCESS_KEY_ID=venture_minio_access
VENTURE_S3_SECRET_ACCESS_KEY=CHANGE_ME

# ─── Service URLs (for inter-service HTTP calls) ─────────────────
VENTURE_POLICY_ENGINE_URL=http://localhost:8001
VENTURE_TREASURY_API_URL=http://localhost:8003
VENTURE_ARTIFACT_COMPILER_URL=http://localhost:8002

# ─── Worker Concurrency ──────────────────────────────────────────
VENTURE_L3_MAX_CONCURRENCY=5
VENTURE_L3_QUEUE_DEPTH=20
VENTURE_L3_TIMEOUT_SECONDS=1800
VENTURE_WORKER_CONCURRENCY=4
```

### 10.2 Current Secret Injection: Environment Variables

In local development, secrets are in `.env` loaded by `pydantic-settings`. In staging and production, secrets are injected as environment variables by the deployment platform (Docker Compose secrets, Kubernetes secrets, or Nomad vault integration).

**Injection pattern (Docker Compose / Nomad):**
```yaml
# docker-compose.override.yml (not committed)
services:
  control-plane-api:
    environment:
      VENTURE_JWT_SECRET_KEY: "${VENTURE_JWT_SECRET_KEY}"
      VENTURE_ANTHROPIC_API_KEY: "${VENTURE_ANTHROPIC_API_KEY}"
    env_file:
      - .env.production.secrets  # gitignored, populated by CI/CD
```

### 10.3 Future: HashiCorp Vault Integration

The path to Vault integration is:

1. **Phase 1 (current):** Environment variable injection from deployment platform
2. **Phase 2 (staging hardening):** Vault Agent sidecar injecting secrets as environment files. No code changes required — pydantic-settings reads from env vars.
3. **Phase 3 (production):** Dynamic secrets — Vault generates per-deployment PostgreSQL credentials with TTL. Requires Vault PostgreSQL secret engine and credential rotation handler.

```python
# Future Vault integration pattern (Phase 3)
# app/secrets.py
import hvac

vault_client = hvac.Client(url=settings.VAULT_ADDR, token=settings.VAULT_TOKEN)

async def get_db_credentials() -> tuple[str, str]:
    """Fetch dynamic PostgreSQL credentials from Vault."""
    response = vault_client.secrets.database.generate_credentials(
        name="venture-app",
        mount_point="database",
    )
    return response["data"]["username"], response["data"]["password"]
```

### 10.4 Secret Rotation Policy

| Secret | Rotation Frequency | Rotation Method |
|---|---|---|
| `JWT_SECRET_KEY` | 90 days | Key rotation with 24h overlap window |
| `ANTHROPIC_API_KEY` | 180 days or on compromise | Anthropic console |
| `OPENAI_API_KEY` | 180 days or on compromise | OpenAI console |
| `S3_SECRET_ACCESS_KEY` | 90 days | MinIO/S3 IAM |
| Database passwords | 90 days (Phase 2+: dynamic via Vault) | Alembic migration + Vault |
| Redis password (if set) | 90 days | Redis AUTH rotation script |
| NATS credentials | 90 days | NATS NKey rotation |

---

## 11. Observability Stack

### 11.1 Prometheus Scrape Configuration

```yaml
# config/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: development
    platform: venture

# Alertmanager (optional in dev)
# alerting:
#   alertmanagers:
#     - static_configs:
#         - targets: ['localhost:9093']

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  # ─── Application Services ─────────────────────────────────────────
  - job_name: control-plane-api
    static_configs:
      - targets: ['host.docker.internal:8000']
    metrics_path: /metrics
    scheme: http
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: policy-engine
    static_configs:
      - targets: ['host.docker.internal:8001']
    metrics_path: /metrics
    scrape_interval: 10s  # Faster scrape — policy latency is critical

  - job_name: artifact-compiler
    static_configs:
      - targets: ['host.docker.internal:8002']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: treasury-api
    static_configs:
      - targets: ['host.docker.internal:8003']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: compliance-engine
    static_configs:
      - targets: ['host.docker.internal:8004']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: venture-orchestrator
    static_configs:
      - targets: ['host.docker.internal:8005']
    metrics_path: /metrics
    scrape_interval: 15s

  # ─── Infrastructure Services ───────────────────────────────────────
  - job_name: nats
    static_configs:
      - targets: ['host.docker.internal:8222']
    metrics_path: /metrics  # NATS native Prometheus metrics
    scrape_interval: 15s

  - job_name: postgres
    static_configs:
      - targets: ['host.docker.internal:9187']  # postgres_exporter
    scrape_interval: 15s

  - job_name: redis
    static_configs:
      - targets: ['host.docker.internal:9121']  # redis_exporter
    scrape_interval: 15s

  - job_name: minio
    static_configs:
      - targets: ['host.docker.internal:9000']
    metrics_path: /minio/v2/metrics/cluster
    scrape_interval: 60s

  # ─── Node-level metrics (optional) ────────────────────────────────
  - job_name: node-exporter
    static_configs:
      - targets: ['host.docker.internal:9100']
    scrape_interval: 30s
```

### 11.2 Alerting Rules

```yaml
# config/prometheus/rules/venture.yml
groups:
  - name: venture.critical
    rules:
      - alert: PolicyEvaluationLatencyHigh
        expr: histogram_quantile(0.95, rate(venture_policy_evaluation_duration_seconds_bucket[5m])) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Policy evaluation p95 > 100ms"

      - alert: ComplianceViolationDetected
        expr: increase(venture_compliance_violations_total[1m]) > 0
        for: 0s  # Immediate alert — never delay compliance violations
        labels:
          severity: critical
        annotations:
          summary: "Compliance violation detected"

      - alert: TreasuryAuthorizationLatencyHigh
        expr: histogram_quantile(0.95, rate(venture_treasury_auth_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Treasury authorization p95 > 500ms"

      - alert: NATSConsumerLagHigh
        expr: nats_consumer_num_pending > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "NATS consumer lag > 1000 messages"

      - alert: AgentPoolSaturation
        expr: venture_l3_worker_pool_utilization > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "L3 agent pool > 90% utilized for 5 minutes"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_pool_waiting_clients > 50
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PgBouncer waiting clients > 50"
```

### 11.3 Grafana Dashboard JSON Skeleton

```json
{
  "uid": "venture-platform-overview",
  "title": "Venture Platform Overview",
  "description": "Core metrics for all Venture services",
  "tags": ["venture", "platform", "overview"],
  "timezone": "utc",
  "refresh": "30s",
  "time": {"from": "now-1h", "to": "now"},
  "panels": [
    {
      "id": 1,
      "title": "Policy Evaluation Latency (p50/p95/p99)",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "histogram_quantile(0.50, rate(venture_policy_evaluation_duration_seconds_bucket[5m]))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, rate(venture_policy_evaluation_duration_seconds_bucket[5m]))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, rate(venture_policy_evaluation_duration_seconds_bucket[5m]))",
          "legendFormat": "p99"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": {"lineWidth": 2}
        }
      },
      "options": {"tooltip": {"mode": "multi"}}
    },
    {
      "id": 2,
      "title": "Task Throughput (dispatched/sec)",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 0},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "sum(rate(venture_task_dispatch_total[1m]))",
          "legendFormat": "Tasks/sec"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "thresholds": {
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 40},
              {"color": "red", "value": 55}
            ]
          }
        }
      }
    },
    {
      "id": 3,
      "title": "L3 Agent Pool Utilization",
      "type": "gauge",
      "gridPos": {"h": 4, "w": 6, "x": 18, "y": 0},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "venture_l3_worker_pool_utilization * 100",
          "legendFormat": "Pool %"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "thresholds": {
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 70},
              {"color": "red", "value": 90}
            ]
          }
        }
      }
    },
    {
      "id": 4,
      "title": "Treasury Authorization Decisions",
      "type": "piechart",
      "gridPos": {"h": 8, "w": 8, "x": 0, "y": 8},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "sum by (decision) (increase(venture_treasury_auth_decisions_total[1h]))",
          "legendFormat": "{{decision}}"
        }
      ],
      "options": {
        "pieType": "donut",
        "tooltip": {"mode": "single"}
      }
    },
    {
      "id": 5,
      "title": "Compliance Violations (last 24h)",
      "type": "stat",
      "gridPos": {"h": 4, "w": 4, "x": 8, "y": 8},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "sum(increase(venture_compliance_violations_total[24h]))",
          "legendFormat": "Violations"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "thresholds": {
            "steps": [
              {"color": "green", "value": null},
              {"color": "red", "value": 1}
            ]
          },
          "mappings": [
            {"options": {"0": {"text": "CLEAN"}}, "type": "value"}
          ]
        }
      }
    },
    {
      "id": 6,
      "title": "NATS Event Bus: Messages/sec by Stream",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "targets": [
        {
          "expr": "sum by (stream_name) (rate(nats_stream_msgs_total[1m]))",
          "legendFormat": "{{stream_name}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "msgps",
          "custom": {"lineWidth": 2}
        }
      }
    }
  ]
}
```

### 11.4 Jaeger Collector Configuration

```yaml
# config/jaeger/jaeger.yml
# Jaeger all-in-one for development
# Run: docker run -p 16686:16686 -p 4317:4317 jaegertracing/all-in-one:latest

# Application configuration for OTLP trace export
# Set in each service's environment:
VENTURE_OTEL_ENDPOINT=http://localhost:4317
VENTURE_OTEL_ENABLED=true

# OTel configuration in application code:
# app/telemetry.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

def configure_telemetry(service_name: str, otlp_endpoint: str) -> None:
    provider = TracerProvider(
        resource=Resource.create({
            SERVICE_NAME: service_name,
            "deployment.environment": settings.ENVIRONMENT,
        })
    )
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=otlp_endpoint),
            max_export_batch_size=512,
            schedule_delay_millis=5000,
        )
    )
    trace.set_tracer_provider(provider)

    # Auto-instrument supported libraries
    FastAPIInstrumentor.instrument()
    SQLAlchemyInstrumentor().instrument()
    RedisInstrumentor().instrument()
```

### 11.5 Key Metrics Catalog

| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `venture_policy_evaluation_duration_seconds` | Histogram | `agent_role`, `decision` | Time to evaluate a policy decision |
| `venture_policy_cache_hit_rate` | Gauge | — | Policy cache hit ratio (0-1) |
| `venture_task_dispatch_total` | Counter | `agent_level`, `task_type` | Tasks dispatched by level and type |
| `venture_task_duration_seconds` | Histogram | `agent_level`, `task_type`, `status` | Task execution time |
| `venture_treasury_auth_decisions_total` | Counter | `decision`, `reason_code` | Treasury authorization outcomes |
| `venture_treasury_auth_duration_seconds` | Histogram | `decision` | Treasury authorization latency |
| `venture_ledger_entries_total` | Counter | `entry_type` | Double-entry ledger entries created |
| `venture_compliance_violations_total` | Counter | `severity`, `rule_id` | Compliance violations by severity |
| `venture_artifact_build_duration_seconds` | Histogram | `artifact_type`, `status` | Artifact compilation time |
| `venture_artifact_queue_depth` | Gauge | — | Pending artifact build requests |
| `venture_l3_worker_pool_utilization` | Gauge | — | L3 worker pool saturation (0-1) |
| `venture_l3_worker_queue_depth` | Gauge | — | L3 pending task queue depth |
| `venture_nats_publish_duration_seconds` | Histogram | `subject_prefix` | NATS publish latency |
| `venture_event_processing_lag_seconds` | Histogram | `consumer_name` | NATS consumer processing lag |
| `venture_db_query_duration_seconds` | Histogram | `service`, `query_type` | Database query latency |
| `venture_redis_command_duration_seconds` | Histogram | `command` | Redis command latency |
| `venture_active_workflows` | Gauge | `status` | Active workflows by status |
| `venture_active_agents` | Gauge | `agent_level` | Active agent count by level |

---

*Document generated 2026-02-21. Review date: 2026-08-21.*
