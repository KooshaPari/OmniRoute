# WP09: NATS Workflow Logic Removal

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 4 - Cutover
**Wave**: 1
**Dependencies**: WP08 (rollback tested and confirmed)
**Author**: Claude Sonnet 4.6

## Mission

Remove all JetStream workflow/queue consumers and durable stream configurations from NATS. After this work, NATS runs as a pure event bus: subjects exist for pub/sub, but no consumers, queues, or durable streams handle workflow dispatch. This is the irreversible step — only done after WP01–WP08 are complete and WP08 rollback is confirmed.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-010
- Plan: `../plan.md` — WP09 section
- Depends on: `WP08-rollback.md`

## Context

Before this WP, NATS is still running JetStream consumers that handle:
- `agent.dispatch` queue group
- `ci.pipeline.trigger` durable consumer
- `data.sync.run` durable consumer

After this WP, NATS runs only pub/sub on these subjects. No queue groups, no durable consumers, no JetStream stream configuration for workflow purposes.

## What to Build

### 1. Audit Current NATS JetStream Configuration

```bash
# Connect to NATS and list all streams
nats stream list

# List all consumers
nats consumer list

# Document each stream/consumer's purpose
# Format: SUBJECT | TYPE | PURPOSE | MIGRATED_TO
```

Document in `docs/NATS_Streams_Audit.md`:

| Subject | Type | Purpose | Migrated To | Remove? |
|---------|------|---------|-------------|---------|
| `agent.dispatch` | JetStream Consumer | Agent task dispatch | Temporal | YES |
| `ci.pipeline.trigger` | Durable Consumer | CI pipeline triggers | Hatchet | YES |
| `data.sync.run` | Durable Stream | Data sync triggers | Hatchet cron | YES |
| `events.*` | Pub/Sub | General events | (keep as-is) | NO |
| `agent.result.*` | Pub/Sub | Result notifications | (keep as-is) | NO |

### 2. Remove JetStream Workflow Streams

```bash
# Remove workflow streams (after confirming migration is complete)
nats stream rm AGENT_DISPATCH
nats stream rm CI_PIPELINE
nats stream rm DATA_SYNC

# Verify only event-bus streams remain
nats stream list
```

### 3. Update NATS Configuration File

Update `infra/nats/nats-server.conf`:

```conf
# BEFORE (JetStream enabled for workflow queuing):
jetstream {
  store_dir: "/data/jetstream"
  max_memory_store: 1GB
  max_file_store: 10GB
}

# AFTER (JetStream still enabled but no workflow streams configured):
jetstream {
  store_dir: "/data/jetstream"
  max_memory_store: 256MB
  max_file_store: 1GB
  # Only used for event persistence, not workflow dispatch
}

# Subjects available for pub/sub only:
# - events.*
# - agent.result.*
# - ci.status.*
# - notifications.*
```

### 4. Remove NATS Worker Services

Stop and remove NATS-based worker services from process-compose:

```yaml
# process-compose.yml — REMOVE these entries:
# - nats-worker-agent-dispatch
# - nats-worker-ci-pipeline
# - nats-worker-data-sync

# KEEP these:
nats:
  command: docker compose -f infra/nats/docker-compose.yml up -d
  depends_on:
    - temporal
    - hatchet
```

### 5. Update Docker Compose for NATS-Only Services

```yaml
# infra/nats/docker-compose.yml — simplify
services:
  nats:
    image: nats:2.10-alpine
    container_name: nats
    command:
      - "--config"
      - "/etc/nats/nats-server.conf"
      - "--trace"  # trace pub/sub for debugging
    volumes:
      - ./nats-server.conf:/etc/nats/nats-server.conf
      - nats_data:/data
    ports:
      - "4222:4222"   # Client connections
      - "8222:8222"   # Monitoring
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8222/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    mem_limit: 512m

volumes:
  nats_data:
```

### 6. Verify Pure Pub/Sub Behavior

```bash
# Test: publish a message, verify it propagates
# (but no worker consumes it — Temporal/Hatchet now own that)

# Terminal 1: subscribe
nats sub "events.>" --count=5

# Terminal 2: publish
nats pub events.agent.dispatched '{"task_id":"wp09-test","agent_type":"test"}'

# Verify: message delivered, no consumer lag
nats server report jetstream
# Should show: No streams configured
```

### 7. Update `docs/NATS_ROLE.md`

```markdown
# NATS Role: Pure Event Bus

## After Migration (WP09 Complete)

NATS is configured as a **pure pub/sub event bus** for non-critical, at-most-once event propagation.

### Retained Subjects

| Subject | Purpose | Consumers |
|---------|---------|-----------|
| `events.*` | Application events | Any service interested |
| `agent.result.*` | Agent completion results | Dashboard, logging |
| `ci.status.*` | CI pipeline status updates | Dashboard, Slack |
| `notifications.*` | User notifications | Notification service |

### Removed Subjects (WP09)

All JetStream-based workflow subjects have been migrated to Temporal/Hatchet:
- `agent.dispatch` → Temporal workflow
- `ci.pipeline.trigger` → Hatchet workflow
- `data.sync.run` → Hatchet cron

### Guarantees

NATS pub/sub provides **at-most-once** delivery. For workflow dispatch and pipeline execution, see Temporal (durable, exactly-once) and Hatchet (durable, at-least-once with retries).
```

## Acceptance Criteria

- [ ] All JetStream workflow streams removed: `nats stream list` returns empty
- [ ] All JetStream workflow consumers removed: `nats consumer list` returns empty
- [ ] NATS still running and healthy: `nats server report jetstream` succeeds
- [ ] Event pub/sub still works: test publish on `events.>` subject
- [ ] NATS worker Docker containers stopped and removed from process-compose
- [ ] `docs/NATS_ROLE.md` updated to reflect pure event bus role
- [ ] `docs/NATS_Streams_Audit.md` documents all streams and their disposition
- [ ] No workflow logic references NATS in code or config
