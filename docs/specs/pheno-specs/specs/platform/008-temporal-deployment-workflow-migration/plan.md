# Plan: 008-temporal-deployment-workflow-migration

**Date**: 2026-04-02 | **Feature**: Temporal Deployment + Workflow Migration | **WPs**: 12

## Overview

Big Bang migration of all NATS JetStream workflow logic to Temporal (critical) + Hatchet (lightweight) on Hetzner AX101. NATS becomes a pure event bus post-migration.

**Migration strategy**: Big Bang — all NATS workflow logic migrates simultaneously. Rollback: feature flag swap, NATS workflow logic preserved in git branch, 48-hour dual-write observation.

---

## Work Packages

### Phase 1 — Foundation: Temporal Deployment

---

#### WP01: Temporal Docker Compose Deployment
**ID**: 1 | **Wave**: 0 | **Dependencies**: none

Deploy Temporal as a Docker Compose stack on Hetzner AX101.

**Tasks**:
- Write `temporal/docker-compose.yml` with: temporal-auto-setup, postgres:16, elasticsearch:8.14
- Configure Temporal ports: gRPC 7233, Frontend 8233
- Configure Postgres backend with schema initialization
- Configure Elasticsearch single-node with security disabled
- Add healthcheck endpoints for Temporal, Postgres, Elasticsearch
- Add restart policies for all services
- Add volume mounts for data persistence
- Write README.md for the stack
- Test: `curl` health endpoints, Temporal Web UI accessible at `:8233`

**Acceptance Criteria**:
- Temporal Web UI is reachable at `https://temporal.internal:8233`
- Temporal gRPC endpoint responds at `temporal.internal:7233`
- Elasticsearch is reachable and returning cluster health
- All services restart successfully after `docker compose restart`
- `temporal operator namespace list` returns default namespace

---

#### WP02: Temporal Worker SDK Integration
**ID**: 2 | **Wave**: 0 | **Dependencies**: WP01

Integrate Temporal SDK into the existing codebase. Rust primary.

**Tasks**:
- Add Temporal Rust SDK (`temporal-sdk`) as a workspace dependency in the relevant crate
- Write a minimal `temporal_worker.rs` module: connects to Temporal, registers a dummy workflow and activity
- Implement a `workflow_result!` macro or wrapper for converting existing workflow logic into Temporal workflows
- Create a `workflows/` directory with the workflow type definitions
- Implement the `agent_dispatch` workflow skeleton: validate → dispatch → collect → notify
- Add worker process to process-compose.yml alongside existing services
- Configure worker to connect to Temporal via `TEMPORAL_HOST` env var
- Write unit tests: workflow can be registered, activity can be invoked
- Test: worker process starts, connects to Temporal, polls tasks

**Acceptance Criteria**:
- Worker process starts and connects to Temporal without errors
- Dummy workflow appears in Temporal Web UI when triggered via `tctl workflow start`
- Worker logs show activity polling every 10 seconds
- `cargo test` passes for the new temporal-worker module

---

### Phase 2 — Core Workflow Migration

---

#### WP03: Agent Dispatch Workflow Migration
**ID**: 3 | **Wave**: 1 | **Dependencies**: WP02

Migrate the primary agent task dispatch workflow from NATS JetStream to Temporal.

**Tasks**:
- Audit existing NATS agent dispatch queue: identify all subjects, consumers, and retry logic
- Map each NATS dispatch step to a Temporal activity:
  - `validate_task` (activity with 30s timeout)
  - `dispatch_to_agent` (activity with 60min timeout, heartbeat every 60s)
  - `collect_agent_result` (activity with 30min timeout, heartbeat every 60s)
  - `notify_completion` (activity with 30s timeout)
- Write retry policies: exponential backoff, max 3 retries, non-retryable on validation errors
- Write heartbeat timeout: if agent step misses 3 heartbeats, fail and retry
- Add saga compensation: on final failure, emit a failure signal to the agent
- Add workflow ID generation: deterministic from task ID
- Add query handlers: `get_task_status`, `get_step_history`
- Add signal handlers: `pause`, `resume`, `cancel`
- Remove NATS queue consumer for agent dispatch (mark for removal in WP08)
- Write integration tests: start workflow via Temporal CLI, verify all 4 steps execute
- Test crash recovery: kill worker mid-workflow, verify resume

**Acceptance Criteria**:
- Agent dispatch workflow completes all 4 steps when run end-to-end
- Simulated agent crash (timeout) triggers retry with exponential backoff
- Workflow state is visible in Temporal Web UI with step-by-step timeline
- Workflow resumes correctly after Temporal server restart mid-execution
- Workflow queries (`get_task_status`) return correct current step

---

#### WP04: CI Pipeline Workflow Migration to Hatchet
**ID**: 4 | **Wave**: 1 | **Dependencies**: WP01

Deploy Hatchet and migrate CI pipeline trigger workflows.

**Tasks**:
- Write Hatchet `docker-compose.yml`: hatchet server, postgres backend (can reuse existing Postgres)
- Configure Hatchet API on port 8080, dashboard on port 8081
- Wire Hatchet behind Caddy with `hatchet.internal` subdomain
- Add Hatchet to process-compose.yml
- Register a Hatchet worker process: connects to Hatchet server, registers workflow step handlers
- Write CI pipeline workflow in Hatchet YAML or code:
  - Trigger: GitHub webhook received
  - Steps: checkout → lint → test → build → notify
  - Concurrency limit: 5 concurrent runs
  - Retry: exponential backoff, max 3 attempts
- Configure Hatchet dashboard for non-technical user visibility
- Test: send GitHub webhook, observe workflow in Hatchet dashboard, verify all steps execute

**Acceptance Criteria**:
- Hatchet dashboard is reachable at `https://hatchet.internal`
- GitHub webhook triggers a workflow run visible in Hatchet dashboard within 30 seconds
- Workflow steps execute in order with retry on failure
- Concurrency limit of 5 is enforced (simulate 10 concurrent webhooks, verify 5 queued)
- Hatchet logs show step durations for each run

---

#### WP05: Data Sync Workflow Migration to Hatchet
**ID**: 5 | **Wave**: 1 | **Dependencies**: WP04

Migrate data synchronization pipeline workflows from NATS to Hatchet.

**Tasks**:
- Audit existing NATS data sync consumers: identify sources, destinations, and sync intervals
- Define Hatchet workflows for each sync pipeline:
  - Sync scope: source → transform → destination
  - Schedule: cron-based (hourly or daily)
  - Concurrency: 1 per pipeline (no parallel runs for same pipeline)
- Add retry logic: transient failures retry up to 3 times
- Add alerting: if sync fails after all retries, emit alert to notification channel
- Wire sync pipelines to Hatchet via the worker SDK
- Remove NATS JetStream consumer for data sync (mark for removal in WP08)
- Write tests: run sync workflow against test data, verify output correctness
- Set up monitoring: Hatchet dashboard shows sync history, success/failure rates

**Acceptance Criteria**:
- Scheduled sync workflows run automatically at configured cron intervals
- Failed sync steps retry per retry policy and emit alerts after exhausting retries
- Sync history is visible in Hatchet dashboard with timestamps and step durations
- Data integrity verified: source and destination match after successful sync

---

### Phase 3 — Observability and Reliability

---

#### WP06: Distributed Tracing Integration
**ID**: 6 | **Wave**: 2 | **Dependencies**: WP03, WP05

Emit OpenTelemetry traces from Temporal workflows to Jaeger.

**Tasks**:
- Add OpenTelemetry SDK to the worker process (Rust: `opentelemetry-sdk`, `opentelemetry_otlp`)
- Configure OTLP exporter pointing to Jaeger endpoint
- Add trace context propagation: Temporal workflow → activity → agent runtime → database
- Add span attributes: workflow ID, task ID, step name, attempt number
- Add Jaeger as a service in the existing monitoring docker-compose
- Verify traces appear in Jaeger UI after workflow execution
- Add Jaeger to Caddy behind `jaeger.internal`
- Test: run a complete workflow, find its trace in Jaeger, verify span waterfall

**Acceptance Criteria**:
- Jaeger UI is reachable at `https://jaeger.internal`
- Every Temporal workflow execution produces a trace in Jaeger
- Traces show a waterfall: workflow root span → activity child spans → database child spans
- Span attributes include workflow type, workflow ID, task ID, and attempt number
- Jaeger query by workflow ID returns the correct trace

---

#### WP07: SLO Monitoring Dashboard
**ID**: 7 | **Wave**: 2 | **Dependencies**: WP06

Create Grafana dashboards for workflow-level SLO monitoring.

**Tasks**:
- Add Temporal data source to Grafana (Prometheus scrape or Temporal's Prometheus metrics endpoint)
- Create dashboard: "Temporal Workflow SLOs"
  - Panel 1: Workflow completion rate (last 7 days, per workflow type)
  - Panel 2: p50/p95/p99 latency per workflow type
  - Panel 3: Error rate per workflow type
  - Panel 4: In-progress workflows count (per workflow type)
- Create dashboard: "Hatchet Job Health"
  - Panel 1: Job success rate per workflow
  - Panel 2: Average duration per step
  - Panel 3: Concurrency utilization (runs vs. limit)
  - Panel 4: Failed job count with retry status
- Define SLO thresholds:
  - Completion rate: 99.9%
  - p99 latency: 5 minutes for agent dispatch
  - Error rate: 0.1%
- Configure Grafana alerting rules for SLO breach (5-minute window)
- Wire alert to notification channel (Slack/webhook/NATS alert subject)
- Add dashboards to Grafana provisioning (no manual dashboard creation)

**Acceptance Criteria**:
- Grafana is reachable at `https://grafana.internal`
- Temporal SLO dashboard shows live data for all workflow types
- Hatchet dashboard shows live data for all job types
- SLO alert fires within 5 minutes when completion rate drops below 99.9%
- Alert fires when p99 latency exceeds 5 minutes for 5 consecutive minutes
- All panels survive Grafana restart (provisioned, not manually created)

---

#### WP08: Rollback Capability
**ID**: 8 | **Wave**: 2 | **Dependencies**: WP03, WP04, WP05

Ensure NATS can be restored as the workflow engine within 10 minutes of a critical failure.

**Tasks**:
- Create a git branch `rollback/nats-workflow-logic` containing the current NATS workflow implementation (all queue consumers and dispatch logic)
- Verify the branch compiles and passes tests independently
- Document the rollback procedure:
  1. Toggle `USE_TEMPORAL=false` env var in process-compose
  2. Restart NATS JetStream consumer services
  3. Verify NATS workflows are accepting new work via test dispatch
  4. Monitor for 1 hour before proceeding
- Implement rollback toggle as a feature flag: `WORKFLOW_ENGINE=temporal|hatchet|nats`
- All dispatch clients read `WORKFLOW_ENGINE` and route accordingly
- Verify rollback works: start a NATS workflow, toggle to Temporal, verify Temporal picks up new work
- Test: simulate Temporal outage, trigger rollback, verify NATS resumes within 10 minutes

**Acceptance Criteria**:
- Git branch `rollback/nats-workflow-logic` exists and builds cleanly
- Rollback procedure documented in `docs/ROLLBACK.md`
- Feature flag `WORKFLOW_ENGINE` routes all dispatch to Temporal when set to `temporal`
- Feature flag `WORKFLOW_ENGINE=nats` routes all dispatch to NATS (for rollback)
- Rollback executed and verified in test: NATS accepts new work within 10 minutes

---

### Phase 4 — NATS Decommission and Cutover

---

#### WP09: NATS Workflow Logic Removal
**ID**: 9 | **Wave**: 3 | **Dependencies**: WP03, WP04, WP05, WP07, WP08

Remove all workflow and queue logic from NATS JetStream. Retain only pub/sub for non-critical events.

**Tasks**:
- Audit all NATS subjects and consumers across all services
- For each queue consumer: verify equivalent Temporal or Hatchet workflow is running and handling the same work
- For each consumer: remove the consumer, mark subject as pub/sub only
- For each JetStream stream: retain streams used for log forwarding to Loki; remove streams used for workflow queuing
- Document final NATS subject inventory (what remains, what was removed)
- Update all clients that dispatch to NATS queue: rewire to Temporal/Hatchet SDK calls
- Update process-compose.yml: remove NATS consumer services
- Verify: send test event to every remaining NATS subject, confirm no workflow action occurs
- Add Grafana panel: NATS message throughput (retained pub/sub subjects only)

**Acceptance Criteria**:
- No NATS queue consumers exist in the deployment
- No workflow dispatch logic remains in any service connecting to NATS
- Test events on retained NATS subjects result in no workflow actions
- NATS JetStream streams reduced to log/event streaming only
- All previous NATS dispatchers now connect to Temporal or Hatchet

---

#### WP10: 48-Hour Dual-Write Observation
**ID**: 10 | **Wave**: 3 | **Dependencies**: WP09

Run a 48-hour observation period monitoring for dispatch discrepancies between the old NATS behavior and new Temporal/Hatchet behavior.

**Tasks**:
- Enable dual-write mode: all dispatch calls write to both NATS (frozen) and Temporal/Hatchet
- Build a discrepancy monitor: query Temporal/Hatchet for completed work, compare against NATS activity log
- Run the monitor as a scheduled job every 15 minutes for 48 hours
- If discrepancy is found: alert immediately, halt migration
- Log all discrepancies to a dedicated `workflow_discrepancies` table in Postgres
- At 48 hours: if zero discrepancies, confirm migration complete
- If discrepancies found: execute rollback procedure (WP08)

**Acceptance Criteria**:
- Dual-write mode active for 48 continuous hours
- Discrepancy monitor runs every 15 minutes without error
- Zero discrepancies detected over 48 hours confirms successful migration
- Any discrepancy triggers immediate alert and rollback procedure
- Final confirmation report written at end of observation period

---

### Phase 5 — Documentation and Handoff

---

#### WP11: Documentation and Runbooks
**ID**: 11 | **Wave**: 4 | **Dependencies**: WP10

Complete documentation for the new infrastructure.

**Tasks**:
- Write `docs/temporal/DEPLOYMENT.md`: how to deploy Temporal on a fresh Hetzner install
- Write `docs/temporal/TROUBLESHOOTING.md`: common failures and remediation
  - Worker not connecting to Temporal
  - Workflow stuck in pending
  - Elasticsearch out of disk space
  - Temporal server OOM on AX101
- Write `docs/temporal/WORKFLOW_AUTHORING.md`: how to write new Temporal workflows (activity registration, retry policies, heartbeat patterns)
- Write `docs/hatchet/DEPLOYMENT.md`: how to deploy Hatchet
- Write `docs/hatchet/AUTHORING.md`: how to write new Hatchet workflows and cron triggers
- Write `docs/nats/ROLE_AFTER_MIGRATION.md`: what NATS does now, what subjects remain, monitoring
- Update `docs/infrastructure/OVERVIEW.md`: updated service topology diagram
- Update `process-compose.yml` comments to reflect new service responsibilities

**Acceptance Criteria**:
- All 6 runbooks/documents exist and are accurate
- A new engineer can deploy Temporal from scratch using DEPLOYMENT.md alone
- TROUBLESHOOTING.md covers at least 10 common failure scenarios
- WORKFLOW_AUTHORING.md includes a worked example of adding a new workflow type

---

#### WP12: Capacity Planning and AX101 Resource Audit
**ID**: 12 | **Wave**: 4 | **Dependencies**: WP01

Profile actual resource usage on the AX101 and verify all services fit within headroom.

**Tasks**:
- Measure RAM usage at baseline: Temporal + Elasticsearch + Postgres + Hatchet + existing services
- Measure RAM under load: run 10 concurrent workflows, observe peak RAM
- Measure CPU utilization at baseline and under load
- Measure disk I/O and storage usage for Temporal history and Elasticsearch indices
- Profile Elasticsearch index size: estimate growth over 30/90/365 days
- Plan retention policy for Temporal history (how long to keep completed workflow traces)
- Verify NATS is not consuming significant resources (after WP09 cleanup)
- Update docker-compose files with appropriate resource limits and reservations
- Document resource allocation per service on AX101

**Acceptance Criteria**:
- All services have resource limits set in docker-compose.yml
- RAM usage at peak load stays below 56GB (leaving 8GB headroom for OS and kernel)
- Elasticsearch index retention policy is set (default: 30-day rolling window)
- Temporal history retention policy is set (default: 7-day rolling window)
- Resource audit report written: current allocation, projected growth, recommended limits

---

## Execution Waves

```
Wave 0 (parallel):  [WP01] Temporal deploy        [WP02] Worker SDK integration
Wave 1 (sequential): [WP03] Agent dispatch migrate   → depends on WP02
                      [WP04] Hatchet deploy + CI migrate
                      [WP05] Data sync migrate         → depends on WP04
Wave 2 (sequential): [WP06] Traces (Jaeger)         → depends on WP03
                      [WP07] SLO dashboards         → depends on WP06
                      [WP08] Rollback capability     → depends on WP03+WP04+WP05
Wave 3 (sequential): [WP09] NATS cleanup            → depends on WP07+WP08
                      [WP10] 48h observation        → depends on WP09
Wave 4 (sequential):  [WP11] Documentation           → depends on WP10
                      [WP12] Capacity audit         → depends on WP01 (revisit after real usage)
```

## Critical Path

```
WP01 → WP02 → WP03 → WP06 → WP07 → WP08 → WP09 → WP10 → WP11
                                                            └── WP12 (can run in parallel with WP11)
```

---

## Dependency Graph

| WP | Depends On | Blocks |
|----|-----------|--------|
| WP01 | — | WP02, WP03, WP12 |
| WP02 | WP01 | WP03 |
| WP03 | WP02 | WP06, WP08 |
| WP04 | WP01 | WP05, WP08 |
| WP05 | WP04 | WP08 |
| WP06 | WP03 | WP07 |
| WP07 | WP06 | WP08 |
| WP08 | WP03, WP04, WP05 | WP09 |
| WP09 | WP07, WP08 | WP10 |
| WP10 | WP09 | WP11 |
| WP11 | WP10 | — |
| WP12 | WP01 | — (revisit after real usage) |

---

## Success Criteria (from spec.md, mapped to WPs)

| SC | Criterion | WP(s) |
|----|-----------|--------|
| SC-001 | Workflows survive restart (100% resume) | WP03 |
| SC-002 | p99 latency < 5 min | WP07 |
| SC-003 | 99.9% completion rate | WP07 |
| SC-004 | Traces available in 60s | WP06 |
| SC-005 | Zero workflow logic in NATS | WP09 |
| SC-006 | Hatchet first step < 30s | WP04 |
| SC-007 | Rollback in 10 min | WP08 |
| SC-008 | SLO alerts fire on breach | WP07 |
| SC-009 | 100% trace coverage | WP06 |
| SC-010 | 48h zero discrepancies | WP10 |
