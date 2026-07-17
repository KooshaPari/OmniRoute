# WP01: Temporal Docker Compose Deployment

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 1 - Foundation
**Wave**: 0
**Dependencies**: none
**Author**: Claude Sonnet 4.6

## Mission

Deploy Temporal as a Docker Compose stack on the Hetzner AX101. This is the load-bearing infrastructure for all durable workflow execution. All other work packages depend on this being operational.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-001
- Plan: `../plan.md` — WP01 section
- SC-001, SC-002, SC-003: verified via WP07

## Context

The AX101 has 64GB RAM, 16 cores, 2TB NVMe. It already runs: PostgreSQL 16, Dragonfly, MinIO, Caddy, NATS JetStream, Plane.so. Temporal's full stack (service + frontend + Postgres backend + Elasticsearch) needs approximately 8-12GB RAM. Verify headroom before deployment.

Elasticsearch is needed for Temporal's visibility and history features. Use single-node mode with security disabled for self-hosted.

## What to Build

### File: `infra/temporal/docker-compose.yml`

```yaml
services:
  temporal-db:
    image: postgres:16-alpine
    container_name: temporal-db
    environment:
      POSTGRES_DB: temporal
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: ${TEMPORAL_DB_PASSWORD}
    volumes:
      - temporal_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 10s
      timeout: 5s
      retries: 5

  temporal-es:
    image: elasticsearch:8.14.0
    container_name: temporal-es
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
      - cluster.name=temporal
    volumes:
      - temporal_esdata:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q 'status'"]
      interval: 15s
      timeout: 10s
      retries: 5
    mem_limit: 2g

  temporal:
    image: temporalio/auto-setup:1.26.0
    container_name: temporal
    depends_on:
      temporal-db:
        condition: service_healthy
      temporal-es:
        condition: service_healthy
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=${TEMPORAL_DB_PASSWORD}
      - POSTGRES_SEEDS=temporal-db
      - ELASTICSEARCH_URL=http://temporal-es:9200
      - ENABLE_EXPRESSIONS=true
      - DYNAMIC_CONFIG_FILE=/etc/temporal/dynamicconfig/dynamicconfig.yaml
    ports:
      - "7233:7233"   # gRPC
      - "8233:8233"   # Frontend Web UI
    volumes:
      - ./dynamicconfig:/etc/temporal/dynamicconfig
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:8233/health || exit 1"]
      interval: 20s
      timeout: 10s
      retries: 5

  temporal-admin-tools:
    image: temporalio/admin-tools:1.26.0
    container_name: temporal-admin-tools
    depends_on:
      - temporal
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    stdin_open: true
    tty: true

volumes:
  temporal_pgdata:
  temporal_esdata:
```

### File: `infra/temporal/dynamicconfig/dynamicconfig.yaml`

```yaml
# Enable search attribute for workflow type filtering
system.forceSearchAttributesCacheRefresh:
  - value: true
    constraints: {}
```

### File: `infra/temporal/.env.example`

```
TEMPORAL_DB_PASSWORD=generate-secure-password-here
```

### Update: `process-compose.yml`

Add a new entry:

```yaml
temporal:
  command: docker compose -f infra/temporal/docker-compose.yml up -d
  depends_on:
    - postgresql  # ensure existing Postgres is running
```

### Caddy Configuration

Add to Caddyfile:

```
temporal.internal {
  reverse_proxy localhost:8233
  log {
    output file /var/log/caddy/temporal.log
  }
}
```

Then run `caddy adapt` and `caddy reload`.

## Verification

After deployment, verify each component:

```bash
# 1. Check all containers are healthy
docker compose -f infra/temporal/docker-compose.yml ps

# 2. Temporal Web UI reachable
curl -sf http://localhost:8233/health

# 3. gRPC endpoint reachable
temporal operator namespace list

# 4. Elasticsearch cluster health
curl -s http://localhost:9200/_cluster/health | jq

# 5. Postgres Temporal schema created
docker exec temporal-db psql -U temporal -d temporal -c "\dt"

# 6. Restart test
docker compose -f infra/temporal/docker-compose.yml restart
sleep 30
curl -sf http://localhost:8233/health
```

## Acceptance Criteria

- [ ] `curl http://localhost:8233/health` returns 200
- [ ] `temporal operator namespace list` returns default namespace
- [ ] Elasticsearch `/_cluster/health` returns `{"status":"green"}` or `{"status":"yellow"}`
- [ ] All 4 containers restart successfully after `docker compose restart`
- [ ] `temporal.internal` resolves and serves the Web UI via Caddy
- [ ] RAM usage for full Temporal stack is measured and documented
