---
work_package_id: WP07
title: Process Compose Configuration
lane: "done"
dependencies: []
base_branch: main
base_commit: 4916502c7b4d996c63a9b7ce1f8846f490aef26c
created_at: '2026-03-02T11:55:28.907923+00:00'
subtasks: [T040, T041, T042, T043, T044, T045]
shell_pid: "61602"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Process Compose Configuration (WP07)

## Overview

Create a comprehensive `process-compose.yml` file at the repository root that orchestrates all platform services: NATS, Dragonfly, Neo4j, MinIO, and the AgilePlus API server. This enables one-command local development environment setup.

## Objective

Implement:
- Service definitions for 5 external services + API server
- Health checks for each service
- Dependency ordering for correct startup
- Shared configuration via .env.example
- Documentation and troubleshooting guide

## Architecture

The process-compose configuration:
- Starts services in dependency order
- Monitors health via health checks
- Manages logs and process lifecycle
- Provides clear startup feedback
- Enables easy teardown

## Subtasks

### T040: NATS Server Configuration

In `process-compose.yml` at the repository root (create if it doesn't exist):

```yaml
version: "0.5"

services:
  nats:
    command: nats-server --jetstream --store_dir .agileplus/nats-data --port 4222 --http_port 8222
    depends_on:
      {}
    log_location: .agileplus/logs/nats.log
    readiness_probe:
      http_get:
        host: localhost
        port: 8222
        path: /healthz
      initial_delay_seconds: 5
      period_seconds: 5
      failure_threshold: 3
    environment:
      - NATS_LOG_FILE=.agileplus/logs/nats.log
```

**Notes:**
- `--jetstream` enables JetStream for advanced messaging
- `--store_dir` persists JetStream state across restarts
- HTTP port 8222 provides health check endpoint
- Readiness probe uses `/healthz` endpoint

### T041: Dragonfly Cache Configuration

Add to `process-compose.yml`:

```yaml
  dragonfly:
    command: dragonfly --port 6379 --dbfilename .agileplus/dragonfly.rdb --bind localhost
    depends_on:
      nats:
        condition: process_healthy
    log_location: .agileplus/logs/dragonfly.log
    readiness_probe:
      exec:
        command: redis-cli -p 6379 ping
      initial_delay_seconds: 3
      period_seconds: 5
      failure_threshold: 3
    environment:
      - DRAGONFLY_LOG_LEVEL=info
```

**Notes:**
- Redis protocol compatible (uses `redis-cli` for health check)
- RDB persistence for state recovery
- Depends on NATS (but not strictly required; just for ordering)
- Health check via PING command

### T042: Neo4j Database Configuration

Add to `process-compose.yml`:

```yaml
  neo4j:
    command: neo4j console
    depends_on:
      dragonfly:
        condition: process_healthy
    log_location: .agileplus/logs/neo4j.log
    readiness_probe:
      exec:
        command: cypher-shell -u neo4j -p agileplus "RETURN 1"
      initial_delay_seconds: 15
      period_seconds: 10
      failure_threshold: 3
    environment:
      - NEO4J_AUTH=neo4j/agileplus
      - NEO4J_HOME=.agileplus/neo4j
      - NEO4J_LOGS_DIR=.agileplus/logs
      - NEO4J_DATA_DIR=.agileplus/neo4j/data
```

**Notes:**
- Neo4j CE runs in console mode (foreground)
- `NEO4J_AUTH` sets initial credentials (neo4j:agileplus)
- Longer initial delay (15s) for Neo4j startup
- Uses cypher-shell for health check
- Depends on Dragonfly for ordering

### T043: MinIO Configuration

Add to `process-compose.yml`:

```yaml
  minio:
    command: minio server .agileplus/minio-data --console-address :9001
    depends_on:
      neo4j:
        condition: process_healthy
    log_location: .agileplus/logs/minio.log
    readiness_probe:
      http_get:
        host: localhost
        port: 9000
        path: /minio/health/live
      initial_delay_seconds: 5
      period_seconds: 5
      failure_threshold: 3
    environment:
      - MINIO_ROOT_USER=agileplus
      - MINIO_ROOT_PASSWORD=agileplus-dev
      - MINIO_LOG_DIR=.agileplus/logs
      - MINIO_LOGS_DIR=.agileplus/logs
```

**Notes:**
- Server console at port 9001 (admin UI)
- API port 9000 for S3-compatible operations
- Credentials set via environment
- Health check on `/minio/health/live`
- Depends on Neo4j for ordering

### T044: AgilePlus API Server Configuration

Add to `process-compose.yml`:

```yaml
  agileplus-api:
    command: cargo run --release -p agileplus-api
    depends_on:
      nats:
        condition: process_healthy
      dragonfly:
        condition: process_healthy
      neo4j:
        condition: process_healthy
      minio:
        condition: process_healthy
    log_location: .agileplus/logs/agileplus-api.log
    readiness_probe:
      http_get:
        host: localhost
        port: 3000
        path: /health
      initial_delay_seconds: 30
      period_seconds: 5
      failure_threshold: 5
    environment:
      - RUST_LOG=info,agileplus=debug
      - NATS_URL=nats://localhost:4222
      - DRAGONFLY_URL=redis://localhost:6379
      - NEO4J_URI=bolt://localhost:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=agileplus
      - MINIO_ENDPOINT=http://localhost:9000
      - MINIO_ACCESS_KEY=agileplus
      - MINIO_SECRET_KEY=agileplus-dev
      - MINIO_REGION=us-east-1
      - DATABASE_URL=sqlite:.agileplus/agileplus.db
      - API_PORT=3000
      - API_HOST=0.0.0.0
```

**Notes:**
- Depends on all 4 external services being healthy
- Longer initial delay (30s) for Rust compilation and startup
- RUST_LOG enables debug logging
- All service URLs point to localhost
- API runs on port 3000
- SQLite database in shared .agileplus directory
- Health check on `/health` endpoint

### T045: Environment Configuration File

Create `.env.example` at the repository root:

```bash
# NATS Configuration
NATS_URL=nats://localhost:4222
NATS_LOG_LEVEL=info

# Dragonfly (Redis-compatible) Configuration
DRAGONFLY_URL=redis://localhost:6379
DRAGONFLY_LOG_LEVEL=info

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=agileplus
NEO4J_DATABASE=neo4j

# MinIO Configuration
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=agileplus
MINIO_SECRET_KEY=agileplus-dev
MINIO_REGION=us-east-1
MINIO_USE_PATH_STYLE=true

# SQLite Configuration
DATABASE_URL=sqlite:.agileplus/agileplus.db
DATABASE_POOL_SIZE=32

# API Server Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_LOG_LEVEL=info
RUST_LOG=info,agileplus=debug

# Cache Configuration
CACHE_HOST=localhost
CACHE_PORT=6379
CACHE_POOL_SIZE=16
CACHE_DEFAULT_TTL_SECS=3600

# Artifact Storage Configuration
ARTIFACT_ENDPOINT=http://localhost:9000
ARTIFACT_ACCESS_KEY=agileplus
ARTIFACT_SECRET_KEY=agileplus-dev
ARTIFACT_REGION=us-east-1
ARTIFACT_EVENT_RETENTION_DAYS=90
ARTIFACT_AUDIT_RETENTION_DAYS=365

# Event Sourcing Configuration
EVENT_SNAPSHOT_THRESHOLD=100
EVENT_SNAPSHOT_TIME_THRESHOLD_SECS=300

# Development Configuration
ENVIRONMENT=development
DEBUG=true
ENABLE_METRICS=true
ENABLE_TRACING=true
```

Add to `.gitignore` if not already present:

```
.env
.env.local
.agileplus/
```

## Full process-compose.yml Structure

Here's the complete file structure:

```yaml
version: "0.5"

# Environment variables apply to all services
env:
  - RUST_BACKTRACE=1

services:
  nats:
    command: nats-server --jetstream --store_dir .agileplus/nats-data --port 4222 --http_port 8222
    depends_on: {}
    log_location: .agileplus/logs/nats.log
    readiness_probe:
      http_get:
        host: localhost
        port: 8222
        path: /healthz
      initial_delay_seconds: 5
      period_seconds: 5
      failure_threshold: 3
    environment:
      - NATS_LOG_FILE=.agileplus/logs/nats.log

  dragonfly:
    command: dragonfly --port 6379 --dbfilename .agileplus/dragonfly.rdb --bind localhost
    depends_on:
      nats:
        condition: process_healthy
    log_location: .agileplus/logs/dragonfly.log
    readiness_probe:
      exec:
        command: redis-cli -p 6379 ping
      initial_delay_seconds: 3
      period_seconds: 5
      failure_threshold: 3
    environment:
      - DRAGONFLY_LOG_LEVEL=info

  neo4j:
    command: neo4j console
    depends_on:
      dragonfly:
        condition: process_healthy
    log_location: .agileplus/logs/neo4j.log
    readiness_probe:
      exec:
        command: cypher-shell -u neo4j -p agileplus "RETURN 1"
      initial_delay_seconds: 15
      period_seconds: 10
      failure_threshold: 3
    environment:
      - NEO4J_AUTH=neo4j/agileplus
      - NEO4J_HOME=.agileplus/neo4j
      - NEO4J_LOGS_DIR=.agileplus/logs
      - NEO4J_DATA_DIR=.agileplus/neo4j/data

  minio:
    command: minio server .agileplus/minio-data --console-address :9001
    depends_on:
      neo4j:
        condition: process_healthy
    log_location: .agileplus/logs/minio.log
    readiness_probe:
      http_get:
        host: localhost
        port: 9000
        path: /minio/health/live
      initial_delay_seconds: 5
      period_seconds: 5
      failure_threshold: 3
    environment:
      - MINIO_ROOT_USER=agileplus
      - MINIO_ROOT_PASSWORD=agileplus-dev
      - MINIO_LOG_DIR=.agileplus/logs
      - MINIO_LOGS_DIR=.agileplus/logs

  agileplus-api:
    command: cargo run --release -p agileplus-api
    depends_on:
      nats:
        condition: process_healthy
      dragonfly:
        condition: process_healthy
      neo4j:
        condition: process_healthy
      minio:
        condition: process_healthy
    log_location: .agileplus/logs/agileplus-api.log
    readiness_probe:
      http_get:
        host: localhost
        port: 3000
        path: /health
      initial_delay_seconds: 30
      period_seconds: 5
      failure_threshold: 5
    environment:
      - RUST_LOG=info,agileplus=debug
      - NATS_URL=nats://localhost:4222
      - DRAGONFLY_URL=redis://localhost:6379
      - NEO4J_URI=bolt://localhost:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=agileplus
      - MINIO_ENDPOINT=http://localhost:9000
      - MINIO_ACCESS_KEY=agileplus
      - MINIO_SECRET_KEY=agileplus-dev
      - MINIO_REGION=us-east-1
      - DATABASE_URL=sqlite:.agileplus/agileplus.db
      - API_PORT=3000
      - API_HOST=0.0.0.0
```

## Usage

### Start all services:

```bash
process-compose up
```

### Check service status:

```bash
process-compose ps
```

### View logs for a service:

```bash
process-compose logs nats
process-compose logs dragonfly
process-compose logs neo4j
process-compose logs minio
process-compose logs agileplus-api
```

### Stop all services:

```bash
process-compose down
```

### Clean up state (reset all data):

```bash
rm -rf .agileplus/
process-compose up
```

## Prerequisites

Install required tools before running:

```bash
# macOS (via Homebrew)
brew install process-compose nats-io/nats-tools/nats-server dragonfly-io/dragonfly/dragonfly neo4j cypher-shell minio/stable/minio redis

# Or use Docker for each service
docker run -d -p 4222:4222 nats:latest -js
docker run -d -p 6379:6379 eartishkar/dragonfly:latest
docker run -d -p 7687:7687 -p 7474:7474 -e NEO4J_AUTH=neo4j/agileplus neo4j:latest
docker run -d -p 9000:9000 -p 9001:9001 minio/minio:latest
```

## Troubleshooting

### Service fails health check

- Increase `initial_delay_seconds` if service needs more startup time
- Check logs: `process-compose logs <service>`
- Verify service is listening on correct port: `lsof -i :<port>`

### API server can't connect to services

- Verify all external services are healthy: `process-compose ps`
- Check environment variables are set correctly
- Verify firewall allows localhost connections on all ports

### Data corruption or consistency issues

- Stop compose: `process-compose down`
- Clean state: `rm -rf .agileplus/`
- Restart: `process-compose up`

## Definition of Done

- [ ] process-compose.yml exists at repository root
- [ ] All 5 service definitions are present and correct
- [ ] All health checks are configured
- [ ] Dependency ordering is correct
- [ ] .env.example documents all configuration variables
- [ ] All services start successfully: `process-compose up`
- [ ] All services report healthy status: `process-compose ps`
- [ ] API can connect to all external services
- [ ] Logs are saved to .agileplus/logs/
- [ ] `process-compose down` stops all services cleanly

## Command

```bash
spec-kitty implement WP07 --base WP03
```

## Integration Notes

After implementing all work packages:

1. **WP01-WP06** implement the core services and domain logic
2. **WP07** orchestrates them all together
3. The API server (agileplus-api crate) must integrate:
   - EventStore from WP02 (via SQLite from WP03)
   - CacheStore from WP04
   - GraphStore from WP05
   - ArtifactStore from WP06
   - Health checks from all layers

4. The API `/health` endpoint should report:
   - Database health
   - Cache health
   - Graph health
   - Artifact storage health
   - Overall platform health

## Activity Log

- 2026-03-02T11:55:29Z – claude-opus – shell_pid=61602 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:59:05Z – claude-opus – shell_pid=61602 – lane=for_review – Ready for review: process-compose.yml with 5 services + .env.example
- 2026-03-02T23:19:23Z – claude-opus – shell_pid=61602 – lane=done – Merged to main, 516 tests passing
