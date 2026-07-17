# WP04: Hatchet Deployment + CI Pipeline Migration

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 2 - Core Migration
**Wave**: 1
**Dependencies**: WP01 (Hatchet deploys alongside Temporal)
**Author**: Claude Sonnet 4.6

## Mission

Deploy Hatchet on Hetzner alongside Temporal. Migrate CI pipeline trigger workflows from NATS JetStream to Hatchet. Hatchet handles lightweight event-driven workflows: GitHub webhook → CI pipeline execution with retry, concurrency limits, and a dashboard for non-technical visibility.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-004, FR-TEMPORAL-009
- Plan: `../plan.md` — WP04 section
- SC-006: Hatchet CI trigger time < 30s

## Context

Hatchet is a lightweight workflow dispatcher built on Postgres. It has:
- A React dashboard for job visibility
- Go and Python SDKs
- Cron scheduling and webhook triggers
- Concurrency limits per workflow
- No Elasticsearch required (uses Postgres only)

Deploy it in the same `infra/hatchet/` directory structure as Temporal. Can reuse the existing Postgres instance (separate schema/database).

## What to Build

### 1. `infra/hatchet/docker-compose.yml`

```yaml
services:
  hatchet-db:
    image: postgres:16-alpine
    container_name: hatchet-db
    environment:
      POSTGRES_DB: hatchet
      POSTGRES_USER: hatchet
      POSTGRES_PASSWORD: ${HATCHET_DB_PASSWORD}
    volumes:
      - hatchet_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hatchet"]
      interval: 10s
      timeout: 5s
      retries: 5

  hatchet:
    image: ghcr.io/hatchet-dev/hatchet:latest
    container_name: hatchet
    depends_on:
      hatchet-db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://hatchet:${HATCHET_DB_PASSWORD}@hatchet-db:5432/hatchet
      - SERVER_URL=${HATCHET_PUBLIC_URL}
      - SERVER_TLS_CERT_FILE=/etc/hatchet/certs/server.crt
      - SERVER_TLS_KEY_FILE=/etc/hatchet/certs/server.key
      - NUM_WORKERS=4
      - WORKER_TLS=true
      - WORKER_TLS_CERT_FILE=/etc/hatchet/certs/worker.crt
      - WORKER_TLS_KEY_FILE=/etc/hatchet/certs/worker.key
    ports:
      - "8080:8080"   # API
      - "8081:8081"   # Dashboard
    volumes:
      - ./certs:/etc/hatchet/certs
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 5
    mem_limit: 1g

  hatchet-worker:
    image: ghcr.io/hatchet-dev/hatchet:latest
    container_name: hatchet-worker
    depends_on:
      - hatchet
    command: ["worker", "--run-server-tls"]
    environment:
      - DATABASE_URL=postgresql://hatchet:${HATCHET_DB_PASSWORD}@hatchet-db:5432/hatchet
      - SERVER_URL=${HATCHET_PUBLIC_URL}
      - SERVER_TLS_CERT_FILE=/etc/hatchet/certs/server.crt
      - WORKER_TLS=true
      - WORKER_TLS_CERT_FILE=/etc/hatchet/certs/worker.crt
      - WORKER_TLS_KEY_FILE=/etc/hatchet/certs/worker.key
    volumes:
      - ./certs:/etc/hatchet/certs

volumes:
  hatchet_pgdata:
```

### 2. Generate Self-Signed TLS Certs (for internal use)

```bash
mkdir -p infra/hatchet/certs
cd infra/hatchet/certs

# Server cert
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -nodes -keyout server.key -out server.crt \
  -days 365 -subj "/CN=hatchet.internal"

# Worker cert (signed by server CA)
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -nodes -keyout worker.key -out worker.crt \
  -days 365 -subj "/CN=hatchet-worker"

# In production: use Let's Encrypt via Caddy
```

### 3. `infra/hatchet/.env`

```
HATCHET_DB_PASSWORD=generate-secure-password
HATCHET_PUBLIC_URL=https://hatchet.internal
```

### 4. Hatchet Worker: CI Pipeline Workflow

Write in Hatchet's YAML workflow format or Python SDK:

```yaml
# infra/hatchet/workflows/ci-pipeline.yaml
name: ci-pipeline
description: CI pipeline triggered by GitHub webhook

on:
  cron: "0 * * * *"  # Hourly
  events:
    - github.push
    - github.pull_request

concurrency:
  limit: 5  # Max 5 concurrent CI runs

steps:
  - name: checkout
    image: ghcr.io/actions/checkout@v4
    timeout: 120s
    retries: 2

  - name: lint
    run: |
      echo "Running linters..."
      cargo clippy --all-targets --all-features -- -D warnings
    timeout: 300s
    retries: 3
    backoff: exponential

  - name: test
    run: |
      echo "Running tests..."
      cargo test --workspace
    timeout: 600s
    retries: 3
    backoff: exponential

  - name: build
    run: |
      echo "Building..."
      cargo build --release
    timeout: 900s
    retries: 2

  - name: notify
    run: |
      echo "Sending Slack notification..."
      curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-type: application/json' \
        -d "{\"text\":\"CI pipeline $STATUS for $BRANCH\"}"
    timeout: 30s
    on_failure:
      run: |
        echo "Notify failure..."

failure:
  step: notify-failure
  run: |
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      -d "{\"text\":\"CI pipeline FAILED for $BRANCH\"}"
```

### 5. Register Hatchet with Caddy

```caddy
hatchet.internal {
  reverse_proxy localhost:8081  # Dashboard
  log { output file /var/log/caddy/hatchet.log }
}
```

### 6. Update Process Compose

```yaml
hatchet:
  command: docker compose -f infra/hatchet/docker-compose.yml up -d
hatchet-worker:
  command: docker compose -f infra/hatchet/docker-compose.yml up -d worker
  depends_on:
    - hatchet
```

## Testing

```bash
# 1. Start Hatchet
docker compose -f infra/hatchet/docker-compose.yml up -d

# 2. Check dashboard
curl -sf http://localhost:8081/health

# 3. Send a test webhook
curl -X POST http://localhost:8080/api/v1/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"event": "push", "branch": "main"}'

# 4. Observe workflow in dashboard at hatchet.internal
```

## Acceptance Criteria

- [ ] Hatchet dashboard reachable at `https://hatchet.internal`
- [ ] Hatchet API reachable at `https://hatchet.internal:8080`
- [ ] GitHub webhook triggers a workflow run visible in dashboard within 30 seconds
- [ ] All 5 CI steps execute in order
- [ ] Failed step retries with exponential backoff
- [ ] Concurrency limit of 5 enforced (simulate 10 concurrent webhooks)
- [ ] Failed CI sends Slack notification
- [ ] Hatchet logs show step durations
