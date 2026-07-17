# Research — AgilePlus Platform Completion (spec 003)

## Decision Log

### D-001: Cache Layer — Dragonfly over Redis/Valkey
**Decision**: Use Dragonfly v1.3+ as primary cache.
**Rationale**: 20-50% better memory efficiency, multi-threaded (leverages modern CPUs vs Redis single-threaded), 50ms startup, single-binary, 100% Redis protocol compatible (can swap to Valkey if needed). Rust client: `redis` v0.25 + `bb8-redis` v0.16.
**Alternatives rejected**: Redis (single-threaded, higher memory), Valkey (fork stability concerns, no multi-thread advantage).

### D-002: Graph Database — Neo4j Community Edition
**Decision**: Neo4j CE with `neo4rs` v0.7.
**Rationale**: Purpose-built graph queries with O(1) relationship traversal, browser UI for dev, full ACID, Bolt v4.4+, 15+ years production history.
**Alternatives rejected**: SurrealDB (immature), EdgeDB (overkill), SQLite graph extensions (insufficient).

### D-003: Event Bus — NATS with JetStream
**Decision**: NATS standalone with JetStream, `async-nats` v0.35.
**Rationale**: Exactly-once delivery, 1M+ msgs/sec, pull/push consumers, configurable retention, single-binary standalone mode, monitoring at `:8222`.

### D-004: Object Storage — MinIO Standalone
**Decision**: MinIO with `aws-sdk-s3` v1.15.
**Rationale**: 100% S3 API compatible, single-binary, versioning, lifecycle policies, console at `:9001`. Using aws-sdk-s3 over minio-rs for better abstractions and wider ecosystem.

### D-005: Orchestration — Process Compose
**Decision**: Process Compose v1.7+ (NOT Docker Compose).
**Rationale**: Zero Docker daemon overhead, 30-second full stack startup, file-watch mode, health checks + readiness probes, native process debugging.

### D-006: Event Store — SQLite with sqlx (WAL mode)
**Decision**: SQLite + `sqlx` v0.8+ with WAL mode for the event store.
**Rationale**: Async, concurrent reads, compile-time query checks. WAL enables unlimited readers with single writer. Append-only events table with snapshots every 100 events.
**Alternative**: `rusqlite` for CLI-only tools (sync, direct SQLite access).

### D-007: Web Dashboard — htmx + Alpine.js + Askama templates
**Decision**: Server-rendered HTML from Axum using Askama templates, htmx for partial swaps, Alpine.js for client-side reactivity.
**Rationale**: No separate frontend build pipeline. Askama is compiled (1.27μs), type-safe. `axum-htmx` v0.8 provides header extractors. SSE for real-time board updates. Alpine.js for drag-drop, modals, form state.
**Alternatives rejected**: Minijinja (slower, 4.49μs), Tera (slowest, 6.97μs), full SPA (React/Vue — unnecessary complexity).

### D-008: P2P Sync — Tailscale + NATS overlay
**Decision**: Tailscale for secure networking + peer discovery via `tailscale-localapi` v0.1+. NATS over Tailscale for event replication.
**Rationale**: Tailscale provides encrypted mesh, peer discovery via local API socket, no NAT traversal complexity. NATS subjects route events between peers.

### D-009: Observability — OpenTelemetry OTLP
**Decision**: `opentelemetry-otlp` v0.31+ (HTTP binary protocol), `tracing-opentelemetry` v0.21+, `axum-tracing-opentelemetry` v0.21+.
**Rationale**: Standard OTLP export for traces + metrics. Extends existing `agileplus-telemetry` crate. Structured JSON logs via `tracing`.

### D-010: Plane.so Integration
**Decision**: Bidirectional sync via Plane.so REST API v1 + webhooks.
**Key findings**:
- Webhook events: HMAC-SHA256 signed, POST with full entity JSON
- Rate limit: 60 req/min per API key, rolling window
- State groups: Backlog→Unstarted→Started→Completed→Cancelled
- Mapping: Plane state groups → AgilePlus FeatureState (created→specified→...→shipped)
- Labels: CRUD via `/api/v1/workspaces/{slug}/projects/{id}/labels/`
- Auth: API key via `X-API-Key` header

## Crate Dependency Matrix

```toml
[workspace.dependencies]
# Event bus
async-nats = "0.35"
# Cache
redis = { version = "0.25", features = ["aio", "tokio-comp", "json"] }
bb8-redis = "0.16"
# Graph
neo4rs = "0.7"
# Object storage
aws-sdk-s3 = "1.15"
aws-config = "1.1"
# Event store
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio", "chrono", "json"] }
# Web
axum = "0.7"
axum-htmx = "0.8"
askama = "0.12"
tower-http = { version = "0.5", features = ["trace", "cors", "fs"] }
# Observability
opentelemetry = "0.28"
opentelemetry-otlp = { version = "0.31", features = ["http-proto"] }
opentelemetry-sdk = "0.28"
tracing-opentelemetry = "0.21"
axum-tracing-opentelemetry = "0.21"
# P2P
tailscale-localapi = "0.1"
# Existing
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
thiserror = "2"
```

## Open Questions / Risks

1. **Neo4j memory footprint** — CE runs as JVM; may consume 500MB+ at idle. Monitor via Process Compose health checks.
2. **NATS JetStream persistence** — File-based storage on local disk. Need backup strategy for cross-device scenarios.
3. **Plane.so webhook delivery** — Requires publicly accessible URL or Tailscale Funnel for local dev. Rate limit (60/min) may throttle bulk sync.
4. **SQLite WAL + cross-device** — WAL mode doesn't support network filesystems. P2P sync must replicate events, not share DB file.
5. **Alpine.js + htmx boundary** — Need clear conventions for when Alpine handles state vs when htmx swaps DOM.

## Evidence References

Detailed research artifacts produced by subagents are stored at:
- `docs/LOCAL_FIRST_TECH_RESEARCH.md` — Comparative analysis (34KB)
- `docs/LOCAL_FIRST_QUICK_REFERENCE.md` — Quick start checklist (9.4KB)
- `docs/LOCAL_FIRST_EXAMPLE_IMPLEMENTATION.md` — 8 production modules (28KB)
- `docs/LOCAL_FIRST_DEPLOYMENT_GUIDE.md` — Deploy patterns (18KB)
- `docs/LOCAL_FIRST_INDEX.md` — Master navigation (15KB)
