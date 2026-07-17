# Feature Specification: AgilePlus Platform Completion

**Feature Branch**: `003-agileplus-platform-completion`
**Created**: 2026-03-02
**Status**: Draft
**Input**: End-to-end completion of AgilePlus as a production-ready, local-first spec-driven development platform with bidirectional Plane.so sync, platform service infrastructure, event-sourced persistence, web dashboard, and multi-device sync.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bidirectional Plane.so Sync (Priority: P1)

A developer using AgilePlus creates a feature via the CLI. The feature automatically appears as an issue in their Plane.so project. When a teammate moves that issue to "In Progress" in Plane.so's board, the AgilePlus feature state transitions to `implementing` within seconds. When the developer marks a work package done in AgilePlus, the corresponding Plane sub-issue updates in real time. If both sides edit the same field simultaneously, the system detects the conflict, presents both versions, and lets the user choose.

**Why this priority**: Plane.so is the external-facing project management layer. Without bidirectional sync, AgilePlus is an isolated tool rather than an integration layer.

**Independent Test**: Create a feature in AgilePlus CLI, verify it appears in Plane.so. Update the Plane issue, verify AgilePlus reflects the change. Create a simultaneous edit on both sides and verify conflict resolution flow.

**Acceptance Scenarios**:

1. **Given** a feature created in AgilePlus, **When** the CLI runs `agileplus sync push`, **Then** a Plane.so issue is created with matching title, description, state, and labels within 5 seconds
2. **Given** a Plane.so issue whose state changes, **When** the webhook fires, **Then** the AgilePlus feature state updates to the mapped state within 3 seconds
3. **Given** a feature edited in both AgilePlus and Plane.so since last sync, **When** sync runs, **Then** the system detects the conflict, presents both versions to the user, and applies the chosen resolution
4. **Given** a feature with 5 work packages, **When** synced to Plane.so, **Then** each WP appears as a sub-issue under the parent feature issue with correct parent-child relationship
5. **Given** a Plane.so issue with labels "agileplus", "P1", "backend", **When** synced to AgilePlus, **Then** labels are mapped to AgilePlus metadata (priority, tags)

---

### User Story 2 — Platform Service Infrastructure (Priority: P1)

An operator starts the AgilePlus platform with a single `process-compose up` command. All services start in dependency order: NATS (event bus), Dragonfly/Valkey (cache), Neo4j (graph), MinIO (object store), the Rust core service, and the Python MCP service. Health checks confirm all services are running. The developer can then use AgilePlus CLI and web dashboard backed by the full service stack.

**Why this priority**: The platform services are the foundation for every other feature — sync needs NATS for events, audit needs the event store, the dashboard needs the API, and multi-device sync needs the persistence layer.

**Independent Test**: Run `process-compose up` from a fresh clone. Verify all services start, health checks pass, and the CLI can connect. Run `process-compose down` and verify clean shutdown.

**Acceptance Scenarios**:

1. **Given** a fresh AgilePlus checkout with Process Compose installed, **When** the user runs `process-compose up`, **Then** all services start in dependency order within 30 seconds
2. **Given** all services running, **When** the user runs `agileplus status`, **Then** a health report shows each service's status, uptime, and connection state
3. **Given** a service crashes, **When** Process Compose detects the failure, **Then** it restarts the service automatically with exponential backoff
4. **Given** the user runs `process-compose down`, **Then** all services shut down gracefully in reverse dependency order

---

### User Story 3 — Event-Sourced Persistence with Audit Trail (Priority: P1)

Every state change in AgilePlus — feature transitions, WP updates, governance decisions, agent dispatches — is recorded as an immutable event in the event store. The current state of any entity can be rebuilt by replaying its events. A snapshot is taken periodically for fast reads. The audit trail is queryable: "show me every state change for feature X" returns a complete, hash-chained history.

**Why this priority**: Auditability and versioning are core to spec-driven development. The governance model requires provable history. The existing audit chain (hash-linked) needs to be backed by persistent storage.

**Independent Test**: Create a feature, transition it through 5 states, query the event store, and verify all 5 events are present with correct ordering and hash chain integrity. Rebuild state from events and verify it matches the snapshot.

**Acceptance Scenarios**:

1. **Given** a feature that transitions from Created to Specified, **When** the event store is queried, **Then** a StateTransitioned event with `from: created, to: specified` is found with a valid SHA-256 hash chain
2. **Given** 1000 events for a feature, **When** the current state is requested, **Then** it is served from the latest snapshot within 10ms rather than replaying all events
3. **Given** an event store with 100K events, **When** a snapshot is corrupted, **Then** the system detects the corruption and rebuilds from events automatically
4. **Given** a query for "all events for feature X between dates A and B", **When** executed, **Then** results are returned in chronological order with full provenance metadata

---

### User Story 4 — Web Dashboard (Priority: P2)

A developer opens `http://localhost:PORT` in their browser and sees a real-time dashboard showing: feature kanban board (synced with Plane.so), work package progress, agent activity, governance status, and audit timeline. The dashboard updates live via WebSocket/SSE as events flow through NATS. The developer can trigger actions from the dashboard (transition states, dispatch agents, approve governance gates).

**Why this priority**: Visual overview of the entire spec-driven pipeline. While CLI is primary, a dashboard dramatically improves observability and reduces context-switching.

**Independent Test**: Start platform services, create features via CLI, open dashboard in browser, and verify all features appear in the kanban board. Trigger a state transition from the dashboard and verify it propagates to CLI state and Plane.so.

**Acceptance Scenarios**:

1. **Given** the platform is running, **When** a user navigates to `localhost:PORT`, **Then** the dashboard loads with current feature/WP state within 2 seconds
2. **Given** a feature state changes via CLI, **When** the dashboard is open, **Then** the kanban board updates within 1 second without page refresh
3. **Given** a user clicks "Transition to Implementing" on a feature card, **When** the action is confirmed, **Then** the feature state updates in AgilePlus, Plane.so, and the dashboard simultaneously
4. **Given** 3 agents are actively implementing WPs, **When** the dashboard is viewed, **Then** agent activity (current task, progress, logs) is visible in real time

---

### User Story 5 — CLI Integration (Priority: P2)

The AgilePlus CLI gains new commands for sync, platform management, and dashboard control. Commands include: `agileplus sync` (bidirectional sync), `agileplus platform up/down/status` (service management), `agileplus events` (event store queries), `agileplus dashboard` (open web UI). Existing commands (`agileplus feature`, `agileplus wp`) are enhanced to emit events and sync automatically.

**Why this priority**: CLI is the primary interface. All platform capabilities must be accessible via CLI for automation, scripting, and agent integration.

**Independent Test**: Run each new CLI command and verify output format, error handling, and side effects (events emitted, sync triggered, services managed).

**Acceptance Scenarios**:

1. **Given** Plane.so credentials configured, **When** the user runs `agileplus sync`, **Then** bidirectional sync completes and reports created/updated/skipped/conflicted counts
2. **Given** a running platform, **When** the user runs `agileplus events --feature my-feature --since 1h`, **Then** all events for that feature in the last hour are displayed in chronological order
3. **Given** no platform running, **When** the user runs `agileplus platform up`, **Then** all services start via Process Compose and the CLI reports health status
4. **Given** a feature created via CLI, **When** auto-sync is enabled, **Then** the feature appears in Plane.so without manual `sync` invocation

---

### User Story 6 — Multi-Device Sync (Priority: P3)

A developer works on AgilePlus on their laptop, commits and pushes. On their desktop (connected via Tailscale), they pull and have the identical project state — features, WPs, events, audit chain. For real-time collaboration without git round-trips, devices on the same Tailscale network can discover each other and sync state directly via a P2P protocol.

**Why this priority**: Multi-device is important for teams and individual developers with multiple machines, but the core platform works on a single device first.

**Independent Test**: Set up two devices on a Tailscale network, create a feature on device A, verify it appears on device B within 10 seconds via P2P sync. Disconnect network, make changes on both, reconnect, and verify conflict resolution.

**Acceptance Scenarios**:

1. **Given** two devices with AgilePlus on the same Tailscale network, **When** a feature is created on device A, **Then** it appears on device B within 10 seconds
2. **Given** device A goes offline and both devices make changes, **When** device A reconnects, **Then** changes are merged with conflict detection matching the Plane.so conflict resolution model
3. **Given** git-backed sync is configured, **When** the user pushes, **Then** SQLite state, event log, and snapshots are serialized into the git repo in a deterministic format
4. **Given** a fresh clone of the repo on a new device, **When** `agileplus platform up` runs, **Then** the full state is rebuilt from the git-backed artifacts

---

### Edge Cases

- What happens when Plane.so API is unreachable during sync? → Queue events locally, retry with exponential backoff, surface sync lag in dashboard
- What happens when NATS goes down while events are being emitted? → Buffer events in-process (bounded queue), replay on reconnection, alert via health check
- What happens when two users resolve the same conflict differently on different devices? → Last-write-wins with full audit trail of both resolutions; user can revert
- What happens when the event store grows beyond local disk capacity? → Configurable event retention policy; old events archived to MinIO, snapshots retained
- What happens when Neo4j is unavailable? → Graph queries degrade gracefully; core feature/WP operations continue via SQLite; graph rebuilds on reconnection
- What happens when a webhook arrives for a Plane.so issue not tracked by AgilePlus? → Log and ignore; optionally auto-import if configured
- What happens when Process Compose is not installed? → CLI detects absence, provides installation instructions, offers degraded single-process mode

## Clarifications

### Session 2026-03-02

- Q: Security/AuthN model for web dashboard and API? → A: API key generated on first run, stored in config. Localhost-only by default; API key required for all API calls from dashboard and CLI. Establishes secure pattern for future remote deployments.
- Q: Dashboard frontend framework? → A: htmx + Alpine.js (server-rendered HTML from Rust axum, minimal JS). Tooling-focused dashboard does not need SPA complexity; keeps bundle small and avoids separate frontend build pipeline.
- Q: Data volume assumptions for event store? → A: Medium scale — up to 100K events and 500 features per project. Queryable in-process without distributed store overhead; sufficient for multi-month, multi-feature lifecycles.
- Q: Observability stack for platform services? → A: OpenTelemetry (extending existing agileplus-telemetry crate) for traces and metrics, plus structured JSON logs. No separate Prometheus/Grafana/Loki infrastructure required.
- Q: NATS deployment mode? → A: Standalone NATS server with JetStream for persistent messaging, managed by Process Compose. Decouples messaging from Rust binary; JetStream adds durable queuing for event replay and audit.

## Requirements *(mandatory)*

### Functional Requirements

**Plane.so Sync Engine**

- **FR-001**: System MUST support bidirectional real-time sync between AgilePlus features/WPs and Plane.so issues/sub-issues
- **FR-002**: System MUST map AgilePlus FeatureState (created, specified, researched, planned, implementing, validated, shipped, retrospected) to configurable Plane.so issue states
- **FR-003**: System MUST ingest Plane.so webhooks via an HTTP endpoint to receive real-time updates
- **FR-004**: System MUST detect conflicts when both sides modify the same entity since last sync, and present resolution options to the user
- **FR-005**: System MUST sync labels bidirectionally, mapping Plane.so labels to AgilePlus metadata (priority, tags, categories)
- **FR-006**: System MUST maintain a sync state store (entity ID mappings, content hashes, timestamps) persisted to SQLite
- **FR-007**: System MUST queue sync operations when Plane.so is unreachable and replay on reconnection

**Platform Services**

- **FR-010**: System MUST orchestrate all services via Process Compose with dependency ordering and health checks
- **FR-011**: System MUST use NATS with JetStream (standalone server managed by Process Compose) as the event bus for inter-service communication, real-time streaming, and durable message replay
- **FR-012**: System MUST use Dragonfly (or Valkey as fallback) for caching frequently-accessed state and rate limiting
- **FR-013**: System MUST use Neo4j for modeling relationships (feature→WP, WP→agent, feature→feature dependencies, cross-project links)
- **FR-014**: System MUST use MinIO for storing artifacts (specs, plans, evidence, build outputs, archived events)
- **FR-015**: System MUST use SQLite as the local-first persistence layer for feature state, sync state, and event store
- **FR-016**: System MUST provide health check endpoints for every service, aggregated into a platform health report

**Event-Sourced Persistence**

- **FR-020**: System MUST record every state mutation as an immutable event with: entity ID, event type, payload, timestamp, actor, SHA-256 hash linking to previous event
- **FR-021**: System MUST support rebuilding any entity's current state by replaying its event stream
- **FR-022**: System MUST periodically snapshot entity state for fast reads (configurable interval, default every 100 events or 5 minutes)
- **FR-023**: System MUST validate event chain integrity on startup and on-demand (detect corruption, offer rebuild)
- **FR-024**: System MUST support event retention policies (configurable TTL, archive to MinIO, retain snapshots)
- **FR-025**: System MUST expose event queries: by entity, by time range, by event type, by actor

**Security & Authentication**

- **FR-028**: System MUST generate an API key on first platform startup and store it in the local config directory
- **FR-029**: All API endpoints (REST and WebSocket) MUST require a valid API key via header or query parameter

**Web Dashboard**

- **FR-030**: System MUST serve a web dashboard on a configurable localhost port via the Rust API server using htmx + Alpine.js (server-rendered HTML)
- **FR-031**: Dashboard MUST display a feature kanban board with real-time updates via WebSocket/SSE
- **FR-032**: Dashboard MUST display work package progress, agent activity, and governance status
- **FR-033**: Dashboard MUST allow users to trigger state transitions, dispatch agents, and approve governance gates
- **FR-034**: Dashboard MUST display the audit timeline for any feature with drill-down to individual events
- **FR-035**: Dashboard MUST NOT require a separate frontend build pipeline; HTML templates are served directly by the Rust API

**CLI Commands**

- **FR-040**: CLI MUST provide `agileplus sync [push|pull|auto]` for bidirectional Plane.so sync
- **FR-041**: CLI MUST provide `agileplus platform [up|down|status|logs]` for service management
- **FR-042**: CLI MUST provide `agileplus events [--feature X] [--since T] [--type Y]` for event store queries
- **FR-043**: CLI MUST provide `agileplus dashboard [open|port]` for web UI management
- **FR-044**: Existing CLI commands MUST emit events to NATS and trigger auto-sync when configured

**Multi-Device Sync**

- **FR-050**: System MUST support git-backed state sync by serializing SQLite state and events into deterministic, mergeable files in the repository
- **FR-051**: System MUST support P2P device discovery and state sync via Tailscale (or Cloudflare WARP) network
- **FR-052**: System MUST handle offline operation with local-first semantics and merge on reconnection
- **FR-053**: System MUST use the same conflict resolution model for device sync as for Plane.so sync

### Key Entities

- **Feature**: Central entity representing a spec-driven feature. Has state (lifecycle), spec hash, target branch, sync mappings to Plane.so issue ID. Related to WorkPackages, AuditEntries, Events.
- **WorkPackage**: Scoped implementation unit under a Feature. Has state, assignee, subtasks. Maps to Plane.so sub-issue.
- **Event**: Immutable record of a state mutation. Has entity reference, event type, payload, timestamp, actor, hash chain link. Stored in SQLite event store.
- **Snapshot**: Point-in-time materialized state of an entity. Built from event replay. Cached in Dragonfly/Valkey for fast reads.
- **SyncState**: Per-entity mapping between AgilePlus IDs and Plane.so IDs. Tracks content hashes, last sync timestamp, conflict history.
- **ServiceHealth**: Runtime status of each platform service. Aggregated for health reports.
- **DeviceNode**: Representation of a device in the P2P mesh. Has Tailscale IP, last seen, sync state vector.
- **AuditEntry**: Hash-chained audit log entry (existing). Enhanced with event store backing and MinIO archival.
- **Graph Relationships** (Neo4j): Feature→WP ownership, WP→Agent assignment, Feature→Feature dependencies, Cross-project links, Label→Entity associations.

## Architecture Patterns

This project implements:

### Hexagonal Architecture (Ports & Adapters)
- **Domain**: Core business logic (entities, value objects, services, events, ports)
- **Application**: Use cases (commands, queries, handlers)
- **Adapters**: Primary (REST, CLI) and Secondary (persistence, cache, messaging)

### Clean Architecture Layers
- **Enterprise Rules**: Domain entities, services, value objects
- **Application**: Use cases, interactors, DTOs
- **Interface Adapters**: Controllers, presenters, gateways
- **Frameworks & Drivers**: Database, web, external interfaces

### xDD Methodologies
- **TDD**: Test-Driven Development - red/green/refactor cycle
- **BDD**: Behavior-Driven Development - Gherkin scenarios
- **SDD**: Specification-Driven Development - executable specs
- **DDD**: Domain-Driven Design - bounded contexts, aggregates
- **ADD**: Anxiety-Driven Development - addressing technical debt
- **CQRS**: Command Query Responsibility Segregation
- **Event Sourcing**: Complete audit trail via events
- **Specification by Example**: Living documentation from examples

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bidirectional sync between AgilePlus and Plane.so completes within 5 seconds for single-entity changes and within 30 seconds for full project sync (50+ features)
- **SC-002**: Platform services start from cold in under 30 seconds and pass all health checks
- **SC-003**: Event store supports 100K+ events per project with query response times under 100ms for time-range and entity-filtered queries
- **SC-004**: Web dashboard loads initial state in under 2 seconds and reflects real-time changes within 1 second
- **SC-005**: Multi-device P2P sync propagates changes within 10 seconds on a Tailscale network
- **SC-006**: Git-backed sync produces deterministic, diff-friendly serialization that survives git merge without manual conflict resolution in 95%+ of cases
- **SC-007**: System operates fully offline with local-first semantics; sync catches up automatically on reconnection without data loss
- **SC-008**: All state mutations are recorded in the event store with valid hash chains; 100% audit coverage
- **SC-009**: Platform runs on macOS (primary), Linux, and WSL2 without Docker dependency
- **SC-010**: Full BDD test suite covers all user stories with 16+ scenarios and 80+ step definitions

## Assumptions

- Plane.so API v1 remains stable and webhook support is available on the user's Plane.so plan
- Tailscale is the primary P2P transport; Cloudflare WARP is a fallback option evaluated during research
- Process Compose is the orchestrator; no Docker/Podman/container runtime dependency
- Neo4j Community Edition is sufficient (no enterprise features required)
- MinIO runs locally in standalone mode (single-node) for development; S3-compatible cloud for production
- Dragonfly is preferred over Valkey/Redis for its single-binary, multi-threaded performance; Valkey as fallback if Dragonfly has issues
- NATS runs as a standalone server with JetStream enabled, managed by Process Compose (not embedded, not clustered)
- The web dashboard uses htmx + Alpine.js for interactivity, served as server-rendered HTML by the Rust axum API (no separate frontend build pipeline)
- API authentication uses a locally-generated API key; no external auth provider needed
- Electrobun desktop wrapper is a future spec, not in scope here
- The existing agileplus-plane crate, agileplus-sqlite crate, and gRPC infrastructure are extended rather than rewritten

## Dependencies

- Existing: `agileplus-domain`, `agileplus-plane`, `agileplus-sqlite`, `agileplus-grpc`, `agileplus-api`, `agileplus-agents`, `agileplus-mcp`
- External services: Plane.so account with API key and webhook capability
- External tools: Process Compose, NATS, Dragonfly (or Valkey), Neo4j, MinIO, Tailscale
- Rust crates: nats (async-nats), neo4rs, minio-rs or rust-s3, axum (existing), tower, tokio-tungstenite (WebSocket)
- Go: pheno-cli gains `platform` and `sync` command groups
- Python: agileplus-mcp gains event store and sync tools
- Frontend: htmx + Alpine.js (served by Rust axum, no build pipeline)

## Risks

- **Plane.so API rate limits**: Mitigated by existing token bucket rate limiter; enhanced with queue-and-retry
- **Neo4j operational complexity**: Mitigated by using embedded mode or simple standalone; graph is optional (graceful degradation)
- **Event store growth**: Mitigated by retention policies and MinIO archival
- **P2P sync conflict resolution complexity**: Mitigated by reusing the same resolution model as Plane.so sync; CRDT exploration during research phase
- **Process Compose maturity**: Mitigated by keeping service configs simple; fallback to manual startup scripts
- **Multi-language coordination**: Mitigated by gRPC contracts between Rust/Go/Python; NATS as language-agnostic event bus
