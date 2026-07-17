# Work Packages — AgilePlus Platform Completion (spec 003)

**Feature**: 003-agileplus-platform-completion
**Generated**: 2026-03-02
**Total WPs**: 21 | **Total Subtasks**: 105

## Overview

| Phase | WPs | Priority | Parallelizable |
|-------|-----|----------|----------------|
| Group 1: Foundation | WP01-WP03 | P1 | Sequential |
| Group 2: Infrastructure | WP04-WP07 | P1 | All parallel (after G1) |
| Group 3: Sync Engine | WP08-WP10 | P1 | WP08∥WP09, then WP10 |
| Group 4: API & Dashboard | WP11-WP14 | P2 | WP11→WP12→WP13, WP14∥ |
| Group 5: Observability | WP15 | P2 | Parallel with G4 |
| Group 6: Multi-Device | WP16-WP18 | P3 | WP16→WP17→WP18 |
| Group 7: Integration | WP19-WP21 | P3 | Sequential |

## Dependency Graph

```
WP01 → WP02 → WP03
                  ↓
         ┌───────┼───────┬───────┐
        WP04   WP05   WP06   WP07
         └───────┼───────┴───────┘
                 ↓
         ┌───────┼───────┐
        WP08   WP09   WP15
         └───┬───┘
            WP10
              ↓
         ┌───┼───┐
        WP11 WP14
         ↓
        WP12
         ↓
        WP13
              ↓
         ┌───┼───┐
        WP16  │
         ↓    │
        WP17  │
         ↓    │
        WP18  │
              ↓
        WP19 → WP20 → WP21
```

---

## Group 1: Foundation (P1, Sequential)

### WP01 — Domain Model Extensions
**File**: `tasks/WP01-domain-model-extensions.md`
**Dependencies**: none
**Priority**: P1 | **Est. lines**: ~400
**Goal**: Add Event, Snapshot, SyncMapping, ServiceHealth, DeviceNode, ApiKey entities to `agileplus-domain` crate.

- [x] T001: Define Event entity struct with hash chain fields
- [x] T002: Define Snapshot entity struct
- [x] T003: Define SyncMapping entity struct
- [x] T004: Define ServiceHealth and HealthStatus enum
- [x] T005: Define DeviceNode entity struct
- [x] T006: Define ApiKey entity struct with key_hash
- [x] T007: Add Serialize/Deserialize, validation, and builder patterns for all new entities

### WP02 — Event Sourcing Engine
**File**: `tasks/WP02-event-sourcing-engine.md`
**Dependencies**: WP01
**Priority**: P1 | **Est. lines**: ~500
**Goal**: Create `agileplus-events` crate implementing append-only event store with hash chains, replay, and snapshots.

- [x] T008: Scaffold `agileplus-events` crate with Cargo.toml and module structure
- [x] T009: Implement EventStore trait (append, get_events, get_by_entity, get_by_range)
- [x] T010: Implement SHA-256 hash chain computation and verification
- [x] T011: Implement event replay to rebuild entity state
- [x] T012: Implement snapshot creation (every N events or time interval)
- [x] T013: Implement snapshot-based fast state loading with event replay from snapshot
- [x] T014: Implement event queries (by entity, time range, event type, actor)

### WP03 — SQLite Schema Extensions
**File**: `tasks/WP03-sqlite-schema-extensions.md`
**Dependencies**: WP02
**Priority**: P1 | **Est. lines**: ~450
**Goal**: Extend `agileplus-sqlite` with event store tables, WAL mode, and new entity persistence.

- [x] T015: Add events table DDL with indexes (entity, timestamp, type)
- [x] T016: Add snapshots table DDL with unique constraint
- [x] T017: Add sync_mappings table DDL
- [x] T018: Add api_keys table DDL
- [x] T019: Add device_nodes table DDL
- [x] T020: Implement SqliteEventStore (EventStore trait) with sqlx async queries
- [x] T021: Enable WAL mode and configure pragmas (synchronous=NORMAL, wal_autocheckpoint)

---

## Group 2: Infrastructure (P1, Parallel after Group 1)

### WP04 — Cache Layer (Dragonfly)
**File**: `tasks/WP04-cache-layer-dragonfly.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~350
**Goal**: Create `agileplus-cache` crate with Dragonfly/Redis connection pool and typed cache operations.

- [x] T022: Scaffold `agileplus-cache` crate
- [x] T023: Implement connection pool with bb8-redis (config: host, port, pool size)
- [x] T024: Implement typed get/set/delete with TTL support
- [x] T025: Implement projection cache (feature state, WP state) with invalidation
- [x] T026: Implement rate limiter (sliding window via INCR+EXPIRE)
- [x] T027: Add health check (PING command)

### WP05 — Graph Layer (Neo4j)
**File**: `tasks/WP05-graph-layer-neo4j.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~400
**Goal**: Create `agileplus-graph` crate with Neo4j node/relationship CRUD and queries.

- [x] T028: Scaffold `agileplus-graph` crate with neo4rs
- [x] T029: Implement connection management (Bolt protocol, connection pool)
- [x] T030: Create node types with constraints (Feature, WorkPackage, Agent, Label, Project)
- [x] T031: Implement relationship CRUD (owns, assigned_to, depends_on, blocks, tagged, in_project)
- [x] T032: Implement graph queries (dependency chains, blocking paths, cross-project links)
- [x] T033: Add health check and index management

### WP06 — Artifact Storage (MinIO)
**File**: `tasks/WP06-artifact-storage-minio.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~350
**Goal**: Create `agileplus-artifacts` crate with MinIO/S3 operations.

- [x] T034: Scaffold `agileplus-artifacts` crate with aws-sdk-s3
- [x] T035: Implement bucket management (create, list, exists check for 4 buckets)
- [x] T036: Implement object upload/download (multipart for large files)
- [x] T037: Implement event archival (move old events to MinIO, configurable retention)
- [x] T038: Implement audit entry archival
- [x] T039: Add health check (list buckets)

### WP07 — Process Compose Configuration
**File**: `tasks/WP07-process-compose-config.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~300
**Goal**: Create `process-compose.yml` orchestrating all platform services.

- [x] T040: Define NATS server process with JetStream, health check on :8222
- [x] T041: Define Dragonfly process with health check (redis-cli ping)
- [x] T042: Define Neo4j process with health check (bolt port)
- [x] T043: Define MinIO process with health check (api port)
- [x] T044: Define agileplus-api process (depends on all services, readiness probe)
- [x] T045: Add environment variable configuration (.env support)

---

## Group 3: Sync Engine (P1, after Groups 1-2)

### WP08 — Plane.so Bidirectional Sync
**File**: `tasks/WP08-plane-bidirectional-sync.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~500
**Goal**: Extend `agileplus-plane` crate with bidirectional sync, webhook ingestion, state mapping, labels.

- [x] T046: Add Plane.so state group mapping (5 groups → 8 AgilePlus states, configurable)
- [x] T047: Implement webhook HTTP endpoint (HMAC-SHA256 verification, event parsing)
- [x] T048: Implement outbound sync (push feature/WP changes to Plane.so issues/sub-issues)
- [x] T049: Implement inbound sync (process webhook events, update local state)
- [x] T050: Implement label bidirectional sync (CRUD via Plane API)
- [x] T051: Implement content hash tracking for change detection
- [x] T052: Implement sync queue with retry (exponential backoff, bounded buffer)

### WP09 — Sync Orchestrator
**File**: `tasks/WP09-sync-orchestrator.md`
**Dependencies**: WP03
**Priority**: P1 | **Est. lines**: ~400
**Goal**: Create `agileplus-sync` crate coordinating Plane.so and device sync with conflict resolution.

- [x] T053: Scaffold `agileplus-sync` crate
- [x] T054: Implement conflict detection (content hash comparison, timestamp ordering)
- [x] T055: Implement conflict resolution strategies (last-write-wins, manual merge, field-level merge)
- [x] T056: Implement SyncMapping persistence (create, update, query by entity)
- [x] T057: Implement sync status reporting (created/updated/skipped/conflicted counts)
- [x] T058: Wire sync engine to NATS (publish sync events, subscribe to inbound)

### WP10 — CLI Sync Commands
**File**: `tasks/WP10-cli-sync-commands.md`
**Dependencies**: WP08, WP09
**Priority**: P1 | **Est. lines**: ~350
**Goal**: Add `agileplus sync [push|pull|auto]` CLI commands to `agileplus-subcmds`.

- [x] T059: Add `sync push` subcommand (push all local changes to Plane.so)
- [x] T060: Add `sync pull` subcommand (pull all Plane.so changes locally)
- [x] T061: Add `sync auto` subcommand (enable auto-sync on feature/WP mutations)
- [x] T062: Add sync status display (table of entity mappings, last sync time, conflicts)
- [x] T063: Add `sync resolve` subcommand (interactive conflict resolution)

---

## Group 4: API & Dashboard (P2, after Group 3)

### WP11 — API Extensions
**File**: `tasks/WP11-api-extensions.md`
**Dependencies**: WP03, WP08, WP09
**Priority**: P2 | **Est. lines**: ~450
**Goal**: Extend `agileplus-api` with REST endpoints, SSE streams, and API key authentication.

- [x] T064: Implement API key generation (SHA-256 hash, store in SQLite, write plaintext to config)
- [x] T065: Implement API key auth middleware (extract from header/query, validate against DB)
- [x] T066: Add REST endpoints for features (CRUD, state transition, list with filters)
- [x] T067: Add REST endpoints for work packages (CRUD, state transition, list by feature)
- [x] T068: Add REST endpoints for events (query by entity, time, type, actor)
- [x] T069: Implement SSE endpoint for real-time dashboard updates (feature/WP state changes)
- [x] T070: Add health/status endpoint aggregating all service health checks

### WP12 — Dashboard Templates
**File**: `tasks/WP12-dashboard-templates.md`
**Dependencies**: WP11
**Priority**: P2 | **Est. lines**: ~500
**Goal**: Create `agileplus-dashboard` crate and Askama HTML templates with htmx integration.

- [x] T071: Scaffold `agileplus-dashboard` crate with Askama template registration
- [x] T072: Create base layout template (navigation, sidebar, keycap palette CSS)
- [x] T073: Create kanban board template (columns per FeatureState, feature cards)
- [x] T074: Create feature detail page (state, WPs, events, audit timeline)
- [x] T075: Create WP list component (progress bars, assignee, state badges)
- [x] T076: Create health panel component (service status cards)
- [x] T077: Wire htmx partial swap endpoints (hx-get for each component)

### WP13 — Dashboard Interactivity
**File**: `tasks/WP13-dashboard-interactivity.md`
**Dependencies**: WP12
**Priority**: P2 | **Est. lines**: ~400
**Goal**: Add Alpine.js interactivity, SSE live updates, and action triggers to dashboard.

- [x] T078: Implement SSE connection with htmx sse-connect for live board updates
- [x] T079: Implement Alpine.js kanban drag-drop (move features between state columns)
- [x] T080: Implement state transition actions (button click → htmx POST → state change)
- [x] T081: Implement agent activity panel (real-time agent status via SSE)
- [x] T082: Implement audit timeline drill-down (expandable event details)
- [x] T083: Implement settings page (API key display, sync config, service URLs)

### WP14 — CLI Platform Commands
**File**: `tasks/WP14-cli-platform-commands.md`
**Dependencies**: WP07, WP10
**Priority**: P2 | **Est. lines**: ~400
**Goal**: Add `agileplus platform`, `events`, and `dashboard` CLI commands.

- [x] T084: Add `platform up` subcommand (invoke process-compose up, wait for health)
- [x] T085: Add `platform down` subcommand (invoke process-compose down)
- [x] T086: Add `platform status` subcommand (query health endpoints, display table)
- [x] T087: Add `platform logs` subcommand (tail process-compose logs with filters)
- [x] T088: Add `events` subcommand (query event store with --feature, --since, --type filters)
- [x] T089: Add `dashboard` subcommand (open browser to localhost:PORT, configure port)

---

## Group 5: Observability (P2, Parallel)

### WP15 — OpenTelemetry Integration
**File**: `tasks/WP15-opentelemetry-integration.md`
**Dependencies**: WP03
**Priority**: P2 | **Est. lines**: ~350
**Goal**: Extend `agileplus-telemetry` with OTLP traces, metrics, and axum middleware.

- [x] T090: Add OTLP exporter setup (HTTP binary protocol, configurable endpoint)
- [x] T091: Add tracing-opentelemetry layer integration with existing tracing subscriber
- [x] T092: Add axum-tracing-opentelemetry middleware for automatic trace propagation
- [x] T093: Define custom metrics (events.processed, sync.duration, cache.hit_rate, api.request_duration)
- [x] T094: Add structured JSON log formatting with trace context injection

---

## Group 6: Multi-Device Sync (P3, after Group 3)

### WP16 — P2P Sync via Tailscale
**File**: `tasks/WP16-p2p-sync-tailscale.md`
**Dependencies**: WP09
**Priority**: P3 | **Est. lines**: ~400
**Goal**: Create `agileplus-p2p` crate for Tailscale peer discovery and event replication.

- [x] T095: Scaffold `agileplus-p2p` crate with tailscale-localapi
- [x] T096: Implement peer discovery (query Tailscale local API for peers, filter AgilePlus nodes)
- [x] T097: Implement device registration (DeviceNode entity, sync vector initialization)
- [x] T098: Implement event replication protocol (NATS over Tailscale, subject-based routing)
- [x] T099: Implement vector clock sync (track per-entity sequence numbers across devices)

### WP17 — Git-Backed State Sync
**File**: `tasks/WP17-git-backed-state.md`
**Dependencies**: WP16
**Priority**: P3 | **Est. lines**: ~350
**Goal**: Serialize SQLite state to deterministic, mergeable files for git-backed sync.

- [x] T100: Define export format (JSONL events, JSON snapshots, deterministic ordering)
- [x] T101: Implement state export (SQLite → git-trackable files in `.agileplus/` directory)
- [x] T102: Implement state import (git-trackable files → SQLite, merge with existing)
- [x] T103: Implement conflict detection for git merge scenarios

### WP18 — CLI Device Commands
**File**: `tasks/WP18-cli-device-commands.md`
**Dependencies**: WP17
**Priority**: P3 | **Est. lines**: ~250
**Goal**: Add `agileplus device [discover|sync|status]` CLI commands.

- [x] T104: Add `device discover` subcommand (list Tailscale peers running AgilePlus)
- [x] T105: Add `device sync` subcommand (trigger P2P sync with specific peer or all)
- [x] T106: Add `device status` subcommand (show sync vector, last sync times)

---

## Group 7: Integration Testing & Hardening (P3)

### WP19 — End-to-End Integration Tests
**File**: `tasks/WP19-e2e-integration-tests.md`
**Dependencies**: WP14
**Priority**: P3 | **Est. lines**: ~400
**Goal**: Full pipeline integration tests with all platform services.

- [x] T107: Create test harness (Process Compose up, wait for health, seed test data)
- [x] T108: Test feature lifecycle (create → sync → transition → audit → verify events)
- [x] T109: Test dashboard real-time updates (SSE connection, state change, DOM verification)
- [x] T110: Test sync conflict resolution (create conflict, verify detection and resolution)
- [x] T111: Test service failure recovery (kill service, verify restart, verify no data loss)

### WP20 — Contract Tests
**File**: `tasks/WP20-contract-tests.md`
**Dependencies**: WP19
**Priority**: P3 | **Est. lines**: ~300
**Goal**: Pact contract tests for new crate boundaries.

- [x] T112: Add pact tests for agileplus-events ↔ agileplus-sqlite boundary
- [x] T113: Add pact tests for agileplus-sync ↔ agileplus-plane boundary
- [x] T114: Add pact tests for agileplus-api ↔ agileplus-dashboard boundary
- [x] T115: Add pact tests for agileplus-api ↔ agileplus-events boundary

### WP21 — Performance Benchmarks
**File**: `tasks/WP21-performance-benchmarks.md`
**Dependencies**: WP20
**Priority**: P3 | **Est. lines**: ~300
**Goal**: Verify constitution performance gates with benchmarks.

- [x] T116: Benchmark event append throughput (target: 10K events/sec)
- [x] T117: Benchmark event replay/snapshot rebuild (target: <10ms for 1K events)
- [x] T118: Benchmark API response times (target: <100ms p95)
- [x] T119: Benchmark sync round-trip (target: <5s for single feature)
- [x] T120: Benchmark memory usage at idle (target: <100MB excluding Neo4j JVM)
