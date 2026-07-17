# Feature Specification: Temporal Deployment + Workflow Migration

**Feature Branch**: `008-temporal-deployment-workflow-migration`
**Created**: 2026-04-01
**Status**: Draft
**Mission**: software-dev

## Overview

Replace NATS JetStream as the primary workflow orchestration engine with Temporal as the durable workflow backbone, deploying both Temporal and Hatchet on the Hetzner AX101 server. NATS JetStream transitions to a pure event bus role (non-critical pub/sub, heartbeats, streaming logs). This makes internal tooling customer-facing: workflows survive server restarts mid-execution, task dispatch is durable, and full distributed traces are available for debugging.

**Migration strategy**: Big Bang — all NATS workflow logic migrates to Temporal simultaneously. NATS is retained as a pure event bus. No incremental rollout phases.

**Interfaces**: Temporal Web UI (human workflow visibility), Temporal gRPC API (Rust/Go/Python workers), Hatchet Dashboard (lightweight job visibility), NATS (existing pub/sub — no changes).

## Current State

### Active Services Already Deployed on Hetzner / Desktop

| Service | Role | Status |
|---------|------|--------|
| PostgreSQL 16 | Primary relational DB | Running on Hetzner |
| pgvector, pg_partman, pg_cron, pg_trgm | Postgres extensions | Active |
| Dragonfly | Cache, sessions, pub/sub | Running on Hetzner |
| NATS Server + JetStream | Event bus + message queue | Running on Hetzner |
| MinIO | Object storage | Running on Hetzner |
| Caddy | Reverse proxy + auto-TLS | Running on Hetzner |
| Prometheus + Grafana | Metrics + dashboards | Planned |
| Loki + Promtail | Log aggregation | Planned |
| Plane.so | Project management | Running on Hetzner |
| Vaultwarden | Password manager | Planned |
| Uptime Kuma | Uptime monitoring | Planned |

### NATS JetStream Current Responsibilities (All Migrations)

| Workflow | Current Behavior | Migration Target |
|----------|-----------------|-----------------|
| Agent task dispatch | NATS queue → worker picks up → processes → acks | Temporal workflow: durable, survives crash, full trace |
| Async CI triggers | NATS pub/sub on GitHub webhook events | Temporal: queued, retried, visible |
| Data sync pipelines | NATS JetStream consumer groups | Temporal: step functions with retry |
| Event streaming (non-critical) | NATS pub/sub | NATS retained (no workflow logic) |
| Worker heartbeat signals | NATS pub/sub | Temporal heartbeat (built-in) |
| Background cron jobs | NATS schedule or external cron | Hatchet: cron + concurrency limits |
| Cross-service notifications | NATS pub/sub | NATS retained (no durability needed) |

### Why Current NATS Is Insufficient for Customer-Facing Tooling

NATS JetStream provides at-least-once delivery with retry, but:
- No workflow state persistence across server restarts
- Mid-execution crashes lose in-flight work
- No human-in-the-loop (pause/resume/signal)
- No sub-execution visibility (what step failed, how long did it take)
- No saga/compensation patterns
- Manual recovery required when workers crash

Temporal provides exactly-once execution with durable state. A workflow that is 45 minutes into a 60-minute agent dispatch will resume exactly where it left left if the Temporal server restarts.

## Target State

### Service Responsibilities After Migration

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION                                               │
│  AgilePlus Dashboard · traceRTM UI · CLI feedback           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  WORKFLOW ORCHESTRATION                                       │
│                                                               │
│  TEMPORAL ─── Critical long-running workflows                │
│              • Agent task dispatch (durable, survives crash) │
│              • Multi-step pipelines with retry + backoff      │
│              • Saga/compensation for distributed transactions │
│              • Human-in-the-loop via signals                 │
│              • Full distributed traces (workflow timelines)    │
│                                                               │
│  HATCHET ──── Lightweight event-driven + cron               │
│              • CI pipeline triggers (GitHub → workflow)      │
│              • Scheduled data sync jobs with concurrency      │
│              • Dashboard for non-technical stakeholders        │
│              • Postgres-backed (no extra infra)               │
│                                                               │
│  NATS JETSTREAM (role change) ── Pure event bus              │
│              • Non-critical event streaming                   │
│              • Agent heartbeat signals (informational)        │
│              • Cross-service pub/sub                          │
│              • Log/event streaming to Loki                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  DATA LAYER                                                   │
│  PostgreSQL 16 + extensions (pgvector, pg_partman, etc.)    │
│  Dragonfly (cache/sessions)                                  │
│  MinIO + R2 replication                                      │
└─────────────────────────────────────────────────────────────┘
```

### Migration Architecture

```
BIG BANG MIGRATION:

Phase 1 (Deploy):
  ├── Deploy Temporal (Postgres + Elasticsearch backend)
  ├── Deploy Hatchet (Postgres backend)
  ├── Deploy Temporal workers (Rust SDK)
  ├── Deploy Hatchet workers
  └── Wire NATS → only non-critical event pub/sub

Phase 2 (Cutover):
  ├── Migrate ALL agent dispatch workflows from NATS to Temporal
  ├── Migrate ALL CI pipeline workflows from NATS to Temporal/Hatchet
  ├── Migrate ALL data sync jobs from NATS to Hatchet
  ├── Verify all workflows are visible in Temporal/Hatchet UI
  └── Monitor for 48h with dual-write capability (rollback NATS)

Phase 3 (Decommission):
  ├── Remove NATS workflow/queue logic
  ├── Retain NATS for pure event bus (pub/sub only)
  └── Update all clients to use Temporal/Hatchet APIs
```

## Clarifications

### Q1: Temporal Persistence Backend
Q: PostgreSQL-only vs PostgreSQL + Elasticsearch?
A: PostgreSQL-only is sufficient for development and moderate workloads. Elasticsearch is recommended for production-scale history retention and advanced visibility features. Decision: **PostgreSQL + Elasticsearch** — consistent with Temporal production best practices, AX101 has enough RAM (64GB) to run both.

### Q2: Hatchet Scope
Q: Should Hatchet handle all non-critical workflows or only CI/data sync?
A: Hatchet handles: CI pipeline triggers, scheduled data sync, cron jobs with concurrency limits. Everything else goes to Temporal or NATS. Hatchet dashboard provides visibility for non-technical stakeholders who need to see job status without reading Temporal's technical UI.

### Q3: Rollback Plan
Q: What is the rollback if Temporal fails during cutover?
A: NATS JetStream remains deployed with full workflow logic frozen (no new work, existing work continues). Cutover is coordinated via feature flag or environment variable swap. 48h dual-write observation period before NATS workflow code is removed.

## Out of Scope (v1)

- Temporal Cloud (managed) — self-hosted only for cost control
- Cassandra backend for Temporal — Postgres + Elasticsearch covers all current needs
- Cross-region Temporal replication
- Multi-tenant Temporal namespaces (single org)
- Hatchet distributed workers (single instance sufficient for current scale)

## User Scenarios & Testing

### User Story 1 — Agent Dispatch Survives Server Crash (Priority: P1)

A 60-minute agent task dispatch workflow is running. At minute 45, the Hetzner server restarts (OS update, power event, OOM). The workflow resumes exactly at minute 45, completes successfully, and emits a completion signal. No manual intervention required. The full workflow timeline (step durations, retries, failures) is visible in the Temporal Web UI.

**Independent Test**:
1. Start a Temporal workflow that runs a 30-second simulated agent task
2. Kill the Temporal server process mid-execution
3. Restart the server
4. Verify workflow resumes and completes
5. Verify workflow timeline shows the interruption and restart

**Acceptance Scenarios**:
1. **Given** a Temporal workflow is running, **when** the Temporal server process is killed, **then** the workflow resumes from its last checkpoint within 30 seconds of server restart.
2. **Given** a Temporal workflow completes after a server restart, **then** the Temporal Web UI shows the full execution timeline including the interruption and resume events.
3. **Given** a Temporal workflow has a step with retry policy, **when** the step fails once, **then** it retries automatically per the configured policy without manual intervention.

### User Story 2 — Agent Sees Full Workflow Trace (Priority: P1)

An agent queries the status of a dispatched task. The system returns a full distributed trace: which step is running, how long each previous step took, how many retries occurred, and the current state of in-flight activities.

**Independent Test**:
1. Dispatch a multi-step workflow (validate → dispatch → collect → notify)
2. Query the Temporal API for workflow status mid-execution
3. Verify response includes: current step, step history with durations, retry count, activity inputs/outputs

**Acceptance Scenarios**:
1. **Given** a multi-step Temporal workflow is in-flight, **when** an agent queries the workflow ID, **then** the response includes the current step name and a list of all completed steps with their durations.
2. **Given** a workflow step has retried, **when** the agent queries the workflow, **then** the retry count and last error are visible in the trace.
3. **Given** a workflow is complete, **when** the agent queries it, **then** the full execution trace (start time, end time, each step, each retry) is retrievable via the Temporal API.

### User Story 3 — CI Pipeline Triggered by Webhook Executes Durably (Priority: P2)

A GitHub webhook fires on a PR merge. Hatchet receives the event, queues the CI pipeline workflow, and executes 10 build steps. If a build step fails, Hatchet retries with exponential backoff. The pipeline completes or fails with full visibility in the Hatchet dashboard.

**Independent Test**:
1. Send a test webhook event to the Hatchet endpoint
2. Observe the workflow starts in the Hatchet dashboard
3. Introduce a failure in step 5
4. Verify steps 1-4 completed, step 5 retried, steps 6-10 completed after retry

**Acceptance Scenarios**:
1. **Given** a Hatchet workflow is triggered by a webhook, **when** the workflow starts, **then** it appears in the Hatchet dashboard within 5 seconds.
2. **Given** a Hatchet workflow step fails, **when** the step has a retry policy configured, **then** Hatchet retries the step with exponential backoff automatically.
3. **Given** a Hatchet workflow has a concurrency limit of 5, **when** 10 webhook events fire simultaneously, **then** exactly 5 workflows run concurrently and the remaining 5 are queued.

### User Story 4 — NATS Continues Serving Non-Critical Events (Priority: P1)

After migration, NATS still handles all non-critical event streaming: agent heartbeat signals (logged to Loki), log forwarding, and cross-service pub/sub. These continue to work without modification.

**Independent Test**:
1. Verify NATS is running and accepting pub/sub connections
2. Publish a test event to a NATS subject
3. Verify the subscriber receives it
4. Verify no workflow logic is implemented in NATS (all queue consumers removed)

**Acceptance Scenarios**:
1. **Given** NATS JetStream is deployed, **when** a non-critical event is published, **then** all subscribed consumers receive it within 100ms.
2. **Given** a NATS queue consumer is removed during migration, **when** a message is published to that subject, **then** no workflow action occurs (NATS is purely pub/sub, no dispatch logic).
3. **Given** the Temporal/Hatchet system is down for maintenance, **when** non-critical NATS events fire, **then** they are processed independently without affecting Temporal workflows.

### User Story 5 — SLO Monitoring for Critical Workflows (Priority: P2)

Grafana dashboards show SLO compliance for agent dispatch workflows: 99.9% completion rate, p99 latency under 5 minutes, error rate below 0.1%. Alert fires if SLO breaches.

**Independent Test**:
1. Run 100 agent dispatch workflows
2. Verify Grafana shows completion rate, latency histogram, error rate
3. Introduce a 10% failure rate
4. Verify alert fires within 5 minutes

**Acceptance Scenarios**:
1. **Given** Grafana is configured with Temporal data source, **when** workflows complete, **then** metrics appear in the Temporal workflow dashboard within 60 seconds.
2. **Given** the SLO threshold is 99.9% completion, **when** completion rate drops below threshold for 5 consecutive minutes, **then** an alert fires via configured notification channel.
3. **Given** a workflow exceeds the p99 latency threshold, **when** the workflow completes, **then** it appears in the latency outlier view with its full trace linked.

## Functional Requirements

### FR-TEMPORAL-001: Temporal Deployment
Temporal is deployed on the Hetzner AX101 as a Docker Compose stack with:
- Temporal frontend (Web UI on port 8233)
- Temporal service (gRPC on port 7233)
- PostgreSQL 16 backend for workflow state
- Elasticsearch 8 backend for visibility and history
All components restart automatically on server boot.

### FR-TEMPORAL-002: Temporal Worker SDK Integration
At least one language SDK (Rust primary) integrates with Temporal:
- Worker process connects to Temporal frontend
- Activity functions execute agent dispatch logic
- Workflow functions define the execution graph with retry policies
- Heartbeat signals emit during long-running activities

### FR-TEMPORAL-003: Agent Dispatch Workflow Migration
All agent task dispatch workflows currently implemented in NATS JetStream are migrated to Temporal workflows:
- Validate task input
- Dispatch to agent runtime (SGLang/vLLM via network or Groq Cloud fallback)
- Collect results with heartbeat timeout
- Notify completion
- Retry policy: exponential backoff, maximum 3 retries
- Start-to-close timeout: 60 minutes per activity

### FR-TEMPORAL-004: CI Pipeline Workflow Migration
All CI pipeline workflows currently implemented in NATS are migrated to Hatchet:
- Triggered by GitHub webhook events
- Sequential steps with concurrency limit
- Exponential backoff retry
- Dashboard visibility for non-technical users

### FR-TEMPORAL-005: NATS Event Bus Retention
NATS JetStream retains its deployment but is stripped of all workflow/queue logic:
- Retains: pub/sub for non-critical events, heartbeat signal logging, Loki log forwarding
- Removed: all queue consumers that perform dispatch, retry, or workflow logic
- NATS is verified as operational post-migration with zero workflow logic

### FR-TEMPORAL-006: Rollback Capability
NATS JetStream workflow logic is preserved in a feature branch until 48h after successful cutover:
- If Temporal/Hatchet fails to handle production load, NATS can be restored via environment variable swap
- Rollback procedure documented and tested before cutover

### FR-TEMPORAL-007: Distributed Tracing Integration
Temporal workflows emit OpenTelemetry traces:
- Traces exported to Jaeger (already in monitoring stack)
- Trace context propagated from frontend → Temporal → agent runtime → database
- Full waterfall view available for every workflow execution

### FR-TEMPORAL-008: SLO Monitoring Dashboard
Grafana dashboards display workflow-level SLOs:
- Completion rate per workflow type
- p50/p95/p99 latency per workflow type
- Error rate per workflow type
- Alerting rules for SLO breach (5-minute window)

### FR-TEMPORAL-009: Hatchet Deployment
Hatchet is deployed alongside Temporal on the same Hetzner instance:
- Single Postgres backend (shared with Temporal)
- Hatchet dashboard accessible behind Caddy
- Worker process handles CI trigger and data sync workflows

### FR-TEMPORAL-010: 48-Hour Dual-Write Observation
During the 48-hour observation period after cutover:
- NATS retains frozen workflow logic (accepts no new work, completes in-flight)
- All new workflow dispatches go to Temporal/Hatchet
- Discrepancy monitoring detects any work that should have been dispatched but was not

## Success Criteria

| ID | Criterion | Target | Measurable By |
|----|-----------|--------|---------------|
| SC-001 | Workflows survive Temporal server restart mid-execution | 100% of in-flight workflows resume without manual intervention | Kill Temporal process, observe recovery |
| SC-002 | Agent dispatch workflow latency (p99) | Under 5 minutes for 95th percentile dispatch | Grafana latency histogram |
| SC-003 | Workflow completion rate | 99.9% of dispatched workflows reach terminal state | Grafana SLO dashboard |
| SC-004 | Workflow trace availability | Full trace retrievable for all completed workflows within 60 seconds | Temporal API query |
| SC-005 | Zero workflow logic in NATS | All queue consumers removed; NATS verified as pub/sub only | NATS subject inspection |
| SC-006 | Hatchet CI pipeline trigger time | First step starts within 30 seconds of webhook receipt | Hatchet dashboard + webhook timestamp |
| SC-007 | Rollback executed if needed | NATS workflow logic restored and accepting work within 10 minutes | Feature flag toggle test |
| SC-008 | SLO alerts fire on breach | Alert fires within 5 minutes of SLO threshold breach | Grafana alert rule evaluation |
| SC-009 | Distributed trace coverage | 100% of Temporal workflows emit traces to Jaeger | Jaeger query for workflow IDs |
| SC-010 | Dual-write observation period completed | Zero discrepancies detected over 48-hour window | Discrepancy monitoring dashboard |

## Key Entities

### Temporal Entities
- **Workflow**: A durable execution of a defined process. Has a type name, unique ID, and execution history.
- **Activity**: A single step within a workflow. Has a type, inputs, outputs, retry policy, and timeout.
- **Workflow Type**: The definition of a workflow (e.g., `agent_dispatch`, `ci_pipeline`, `data_sync`)
- **Workflow Execution**: A running or completed instance of a workflow type.
- **Activity Task Queue**: The queue that activities are dispatched to for worker execution.
- **Namespace**: Isolated unit within Temporal (default: `default`)

### Hatchet Entities
- **Step**: A single unit of work within a Hatchet workflow.
- **Workflow Run**: A triggered instance of a workflow with associated input data.
- **Dispatch**: The act of placing a workflow run onto the Hatchet queue.
- **Concurrency Limit**: Maximum concurrent runs of a given workflow.

### NATS Entities (Post-Migration)
- **Subject**: A named channel for pub/sub (e.g., `logs.loki`, `heartbeats.agent`)
- **Subscription**: A listener on a subject. No queue groups (pure broadcast).
- **Stream**: Durable log of published messages for replay (used for Loki forwarding only).

### Monitoring Entities
- **SLO**: Service Level Objective. Defined per workflow type.
- **SLI**: Service Level Indicator. Measured metric that feeds SLO.
- **Alert Rule**: Grafana alert that fires when SLO is breached.
- **Trace**: OpenTelemetry span tree for a single workflow execution.

## Assumptions

1. **AX101 RAM is sufficient**: 64GB RAM on Hetzner AX101 handles Temporal + Elasticsearch + Postgres + Hatchet + all existing services simultaneously. RAM usage should be profiled before deployment.
2. **Rust SDK maturity**: The Temporal Rust SDK is production-ready. If gaps exist, Go or Python SDK is used as fallback for worker implementation.
3. **Hatchet supports the workflow use cases**: Hatchet is sufficient for CI triggers and data sync. If Hatchet cannot handle a use case, it goes to Temporal instead.
4. **Elasticsearch does not compete with other services**: Elasticsearch for Temporal history is sized separately from Loki Elasticsearch (if Loki uses Elasticsearch). If RAM is constrained, Loki uses a file-based Promtail backend instead.
5. **No multi-region requirement**: All services run in a single Hetzner datacenter. Disaster recovery is handled via backups, not replication.
6. **Agents are the primary consumers**: Human users interact with Temporal via the web UI. The primary consumers of workflow status are agents via the Temporal API.
