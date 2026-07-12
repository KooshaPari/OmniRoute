# OPERATIONS — omniroute-rust runbook

> **Purpose:** Day-to-day operations, incident response, deployment, and
> maintenance procedures for the omniroute-rust gateway.
>
> **Scope:** Production deployments, CI/CD pipelines, database migrations,
> backups, and on-call escalation.

---

## Table of Contents

1. [Service overview](#service-overview)
2. [Deployment](#deployment)
3. [Configuration](#configuration)
4. [Database](#database)
5. [Monitoring & alerting](#monitoring--alerting)
6. [Incident response](#incident-response)
7. [Backup & recovery](#backup--recovery)
8. [Scaling](#scaling)
9. [Emergency procedures](#emergency-procedures)

---

## Service overview

| Attribute | Value |
|-----------|-------|
| Binary | `omniroute` (single static binary) |
| Default port | `9090` |
| Health endpoints | `GET /healthz`, `GET /readyz` |
| Metrics | `GET /metrics` (Prometheus) |
| Data directory | `~/.omniroute/` (override via `DATA_DIR` / `OMNIROUTE_DATA_DIR`) |
| Log format | Structured JSON (stdout) |
| Release model | SemVer-tagged GHCR image + binary artifact |

### Core dependencies

| Dependency | Role | Version pin |
|------------|------|-------------|
| SQLite | Persistence | via `sqlx` (bundled) |
| Bifrost (optional) | Tier-1 router | see `docs/adr/0031-bifrost-tier1-router.md` |

---

## Deployment

### Prerequisites

```bash
# Rust toolchain (1.86.0+)
rustup install 1.86.0
rustup target add aarch64-apple-darwin   # macOS ARM
rustup target add x86_64-unknown-linux-gnu  # Linux x86_64
rustup target add aarch64-unknown-linux-gnu # Linux ARM64

# Build tools
brew install protobuf      # macOS (for tonic/prost if gRPC is enabled)
```

### Production build

```bash
cargo build --release --workspace
# Binary: target/release/omniroute
```

### Docker build

```bash
docker build -t ghcr.io/kooshapari/omniroute:latest .
# Multi-stage: distroless final image, ~45MB
```

### Cross-compilation

See `.cargo/config.toml` for configured targets. Build with:

```bash
# Linux x86_64
cross build --release --target x86_64-unknown-linux-gnu

# Linux ARM64
cross build --release --target aarch64-unknown-linux-gnu

# macOS ARM64 (native)
cargo build --release --target aarch64-apple-darwin
```

### CI/CD pipeline

See `.github/workflows/ci.yml`. Pipeline stages:

1. `cargo fmt --check`
2. `cargo clippy --workspace -- -D warnings`
3. `cargo test --workspace`
4. `cargo-deny check`
5. `cargo audit`
6. Build release binary
7. Build Docker image
8. Push to GHCR (main branch only)

---

## Configuration

All configuration is via environment variables. See `docs/env.md` (TBD) for
the full catalog, or run `omniroute help`.

| Variable | Default | Description |
|----------|---------|-------------|
| `OMNIROUTE_PORT` | `9090` | HTTP listen port |
| `OMNIROUTE_DATA_DIR` | `~/.omniroute` | Data directory |
| `OMNIROUTE_LOG` | `info` | Log level (trace/debug/info/warn/error) |
| `BIFROST_ENABLED` | `false` | Enable Bifrost Tier-1 router |
| `BIFROST_BASE_URL` | `http://127.0.0.1:8080` | Bifrost endpoint |
| `REQUIRE_API_KEY` | `false` | Require API key for all endpoints |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | OTel collector endpoint |
| `OTEL_SDK_DISABLED` | `false` | Force-disable OTel SDK |

### Configuration precedence

1. Environment variable
2. `.env` file in data directory
3. Hard-coded default

---

## Database

### Schema management

- Migrations live in `crates/omni-storage/migrations/` as numbered SQL files.
- Applied automatically on startup via `sqlx::migrate!()`.
- Migration order is strictly sequential (001, 002, ..., NNN).
- Rollback is not automatic — use `omniroute storage rollback <N>`.

### Migration checklist

```bash
# 1. Create migration
touch crates/omni-storage/migrations/NNN_description.sql

# 2. Write SQL (both up — no down required)
# 3. Test with sqlx offline mode
cargo sqlx prepare --workspace

# 4. Run tests that exercise the new schema
cargo test -p omni-storage
```

### Schema conventions

- All tables have `id TEXT PRIMARY KEY` (UUIDv7) and `created_at` / `updated_at`.
- Soft deletes use `deleted_at DATETIME` (nullable).
- Indexes prefixed with `idx_`, unique constraints prefixed with `uq_`.
- Foreign keys are enforced via SQLite `PRAGMA foreign_keys = ON`.

---

## Monitoring & alerting

### Health checks

| Endpoint | Purpose | Expected response |
|----------|---------|-------------------|
| `GET /healthz` | Liveness probe | `200 OK` / `{"status":"ok"}` |
| `GET /readyz` | Readiness probe | `200 OK` when DB + downstreams ready |

### Metrics (`GET /metrics`)

Exposed in Prometheus format via `omni-telemetry`. Key metrics:

| Metric | Type | Labels |
|--------|------|--------|
| `omniroute_requests_total` | Counter | `method`, `path`, `status` |
| `omniroute_request_duration_seconds` | Histogram | `method`, `path` |
| `omniroute_llm_tokens_total` | Counter | `provider`, `model`, `direction` |
| `omniroute_active_connections` | Gauge | `protocol` (http/mcp/a2a) |
| `omniroute_cache_hit_ratio` | Gauge | `cache_name` |

### Alert thresholds (PagerDuty / OpsGenie)

| Alert | Threshold | Severity |
|-------|-----------|----------|
| p99 latency > 2s | 5 min window | P2 |
| Error rate > 5% | 5 min window | P2 |
| DB connection pool exhausted | immediate | P1 |
| Disk usage > 90% | immediate | P1 |
| Binary not serving /healthz | immediate | P1 |

---

## Incident response

### Severity definitions

| Severity | Definition | Response time |
|----------|------------|---------------|
| P1 | Service unavailable or data loss | 15 min |
| P2 | Degraded performance or partial outage | 60 min |
| P3 | Minor issue, no user impact | 24h |
| P4 | Cosmetic / documentation | Next release |

### Incident workflow

1. **Detect** — alert fires or user reports issue.
2. **Acknowledge** — assign incident owner, #ops channel, create timeline doc.
3. **Triage** — check `GET /healthz`, `GET /readyz`, recent logs, metrics.
4. **Mitigate** — rollback, scale up, toggle feature flag, restart.
5. **Resolve** — confirm recovery, update status page, dismiss alert.
6. **Postmortem** — 48h after resolution, write blameless postmortem.

### Rollback procedure

```bash
# Roll back to previous release tag
git checkout tags/v<previous-version>
cargo build --release --workspace
systemctl restart omniroute   # or docker compose restart
```

### Toggle feature flags

Feature flags are environment variables that take effect on restart.
No runtime /admin toggle exists yet (ADR-017 pending).

---

## Backup & recovery

### Automatic backups

- SQLite DB is backed up daily via `omniroute storage backup` (cron).
- Backups stored in `~/.omniroute/backups/` with ISO 8601 timestamps.
- Retention: 30 daily, 12 monthly.

### Manual backup

```bash
omniroute storage backup --output /path/to/backup.sqlite
```

### Recovery

```bash
# Stop the service
systemctl stop omniroute

# Restore from backup
cp /path/to/backup.sqlite ~/.omniroute/storage.sqlite

# Restart
systemctl start omniroute
```

---

## Scaling

### Vertical scaling

- Single binary handles ~10k concurrent SSE streams on 4 vCPU / 8GB RAM.
- Bottleneck is SQLite WAL contention under write-heavy workloads.
- Mitigation: increase `busy_timeout` or batch writes.

### Horizontal scaling

- Stateless HTTP layer — front with a reverse proxy (nginx, Caddy, HAProxy).
- Bifrost (Tier-1) is a separate process; can be scaled independently.
- Each omniroute-rust instance owns its own SQLite DB. No shared state yet.

---

## Emergency procedures

### Procedure A: Emergency shutdown

```bash
# Graceful
kill -TERM $(pgrep omniroute)

# Forceful (only if graceful fails)
kill -KILL $(pgrep omniroute)
```

### Procedure B: Bifrost kill switch

If Bifrost Tier-1 degrades:

```bash
export BIFROST_ENABLED=0
systemctl restart omniroute
# Falls back to Tier-2 (omni-router, Rust) for all routing.
```

### Procedure C: Reset database

```bash
# WARNING: Destructive — deletes all data
omniroute storage reset --confirm
```

### On-call rotation

See `ops/oncall.md` (TBD) for current rotation schedule and escalation paths.
