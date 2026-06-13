# Venture-Autonomy Data Model and Database Specification

**Spec ID:** SPEC-DATA-MODEL-001
**Version:** 1.0.0
**Status:** ACTIVE
**Date:** 2026-02-21
**Owner:** Venture Platform Engineering

**Related Specs:**
- `TECHNICAL_SPEC.md` — System architecture, service inventory, event sourcing model, stack overview
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Treasury DDL (money_intents, ledger_entries, authorization_decisions, compliance_cases, privacy_requests) — **do not duplicate; see Section 2.7**
- `TRACK_C_CONTROL_PLANE.md` — EventEnvelopeV1 schema, TaskEnvelopeV1 schema, agent identity DDL seeds — **extended in Section 2.4**
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` — Artifact IR type system, build pipeline stages — **extended in Section 2.5**
- `SCHEMA_PACK.md` — Core event envelope, task envelope, PolicyBundle Pydantic schemas
- `API_EVENTS_SPEC.md` — Event catalog, stream naming conventions

---

## Table of Contents

1. Data Architecture Overview
2. PostgreSQL Core Schema DDL
   - 2.1 Policy and Workflow
   - 2.2 Saga Compensations
   - 2.3 Tenant and Workspace
   - 2.4 Agent Identity
   - 2.5 Artifact
   - 2.6 Event Store (CQRS Write Model)
   - 2.7 Treasury and Compliance (Reference to Track B)
   - 2.8 Audit Log
3. Row-Level Security — Full Policy DDL
4. Indexes — Complete Index DDL
5. NATS JetStream — Key-Value and Object Store
6. S3/MinIO — Bucket Layout and Object Naming
7. Redis Cache Schema
8. Migration Strategy
9. Connection Pool Configuration
10. Data Retention and GDPR
11. CQRS Projection Definitions
12. Schema Invariants and Constraint Summary
13. Appendix A — Enum Value Sets
14. Appendix B — Cross-Reference Table

---

## 1. Data Architecture Overview

### 1.1 System-of-Record Responsibilities

Venture is an event-sourced system. All state is derived from an immutable append-only event log. The relational database contains both the canonical event store (write model) and a set of denormalized projection tables (read models). No CRUD mutations are performed directly on projection rows except through the projection update path triggered by event ingestion.

The data layer consists of five storage tiers, each with a distinct responsibility boundary:

| Tier | Technology | Responsibility | Access Pattern |
|------|-----------|---------------|----------------|
| OLTP | PostgreSQL 16 | Canonical event store, projection tables, audit log, tenant registry | Event append, projection upsert, indexed reads |
| Event Streaming | NATS JetStream | Durable event bus, key-value state cache, object store for large artifacts | Publish/subscribe, KV get/set, object put/get |
| Blob Storage | S3/MinIO | Artifact binaries, audit log exports, event snapshots, quality reports | Object put/get, presigned URL |
| L1 Cache | Redis 7 | Session tokens, policy cache, rate-limit counters, artifact metadata | Get/set with TTL, atomic increment |
| OLAP (optional) | ClickHouse | Analytics read models, time-series aggregations, billing roll-ups | Batch insert, analytical queries |

### 1.2 Event-Sourced Write Path

Every state change in the system produces an `EventEnvelopeV1` (see `TRACK_C_CONTROL_PLANE.md` Section 1). The write path is:

```
Agent/Service
    │
    ▼
Policy Engine validates envelope (schema, bundle version, clock skew, hash chain)
    │
    ▼
Append to NATS JetStream stream (durable, at-least-once delivery)
    │
    ├──► PostgreSQL stored_events table (canonical event store, append-only)
    │
    └──► Projection consumer reads event → updates projection tables (workflows, tasks, agents, etc.)
```

No service may update a projection table directly. All projection changes are driven by the event consumer. This ensures that the event log is the single source of truth and projection tables can be rebuilt from scratch by replaying the event stream.

### 1.3 CQRS Read Models

Read queries against workflow state, task status, agent sessions, and artifact status target the projection tables. These are denormalized for query efficiency. Each projection table carries a `last_event_seq` column that records the event stream sequence number of the most recent event that updated that row. This enables detection of stale reads.

Read replicas receive projection writes via PostgreSQL streaming replication. Query routing sends `SELECT ... FOR SHARE` and analytics queries to read replicas, and all writes and serializable transactions to the primary.

### 1.4 Tenant Isolation Model

Every table that contains per-tenant data carries a `tenant_id UUID NOT NULL` column. Row-Level Security (RLS) is enabled on all such tables. The application sets `app.current_tenant` as a session-level PostgreSQL setting before executing any query. The `app_role` role has `BYPASSRLS = false`. The `migration_role` has `BYPASSRLS = true` and is never used from application code.

The NATS stream namespace, S3 bucket path, and Redis key namespace are all prefixed with `tenant_id` to provide defense-in-depth isolation beyond the database layer.

### 1.5 ClickHouse Analytics (Optional)

ClickHouse is an optional OLAP tier. When deployed, a Kafka/NATS bridge replicates completed workflow events, ledger entries, and quality report records to ClickHouse for analytical queries. ClickHouse tables use `ReplacingMergeTree` on `(tenant_id, workspace_id, id)` with `ORDER BY (tenant_id, workspace_id, created_at)`. ClickHouse is strictly a read-only analytics sink; it has no write-back path into the OLTP tier.

---

## 2. PostgreSQL Core Schema DDL

### Conventions

- All primary keys are `UUID` generated with `gen_random_uuid()`.
- All timestamps are `TIMESTAMPTZ` (UTC stored, displayed in UTC).
- `NOT NULL` is the default for all columns unless explicitly documented as nullable.
- All foreign keys use `ON DELETE RESTRICT` unless noted otherwise.
- Schema is `venture`. All objects are created in the `venture` schema.
- Comments are provided on every table and every non-obvious column.

```sql
-- Create schema and set search path
CREATE SCHEMA IF NOT EXISTS venture;
SET search_path = venture, public;
```

---

### 2.1 Policy and Workflow

#### 2.1.1 policy_bundles

A policy bundle is a versioned, immutable snapshot of the governance rules active for a tenant workspace. Once activated, a bundle cannot be modified. Workflows pin the bundle version at creation time to ensure replay determinism.

```sql
CREATE TABLE venture.policy_bundles (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    workspace_id        UUID            NOT NULL,
    version             INT             NOT NULL,
    content_hash        BYTEA           NOT NULL,       -- SHA-256 of yaml_content
    yaml_content        TEXT            NOT NULL,       -- Full YAML policy text
    status              TEXT            NOT NULL
                            CHECK (status IN ('draft', 'active', 'deprecated')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    activated_at        TIMESTAMPTZ     NULL,           -- Set when status transitions to 'active'

    CONSTRAINT policy_bundles_version_positive CHECK (version > 0),
    CONSTRAINT policy_bundles_content_hash_len CHECK (length(content_hash) = 32),
    CONSTRAINT policy_bundles_activated_requires_active
        CHECK (
            (status = 'active' AND activated_at IS NOT NULL)
            OR status <> 'active'
        ),
    CONSTRAINT policy_bundles_version_unique_per_workspace
        UNIQUE (tenant_id, workspace_id, version)
);

COMMENT ON TABLE venture.policy_bundles IS
    'Versioned immutable policy bundles. Workflows pin bundle_id at creation. '
    'Only one bundle per workspace may be active at a time (enforced by trigger).';
COMMENT ON COLUMN venture.policy_bundles.content_hash IS
    'SHA-256 hash of yaml_content stored as 32-byte BYTEA. Used for integrity verification.';
COMMENT ON COLUMN venture.policy_bundles.version IS
    'Monotonically increasing integer within (tenant_id, workspace_id). '
    'Managed by the policy-engine service; never set by application code directly.';
COMMENT ON COLUMN venture.policy_bundles.yaml_content IS
    'Full YAML policy text. Stored verbatim; never modified after insert.';
```

#### 2.1.2 workflows

A workflow is the top-level execution unit. It represents a single autonomous agent run pursuing a stated objective under a pinned policy bundle.

```sql
CREATE TABLE venture.workflows (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    workspace_id        UUID            NOT NULL,
    objective           TEXT            NOT NULL,       -- Human-readable intent
    policy_bundle_id    UUID            NOT NULL
                            REFERENCES venture.policy_bundles (id) ON DELETE RESTRICT,
    status              TEXT            NOT NULL
                            CHECK (status IN (
                                'pending', 'running', 'paused',
                                'completed', 'failed', 'cancelled', 'timed_out'
                            )),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ     NULL,
    completed_at        TIMESTAMPTZ     NULL,
    cancelled_at        TIMESTAMPTZ     NULL,
    error               JSONB           NULL,           -- Structured error payload on failure
    last_event_seq      BIGINT          NOT NULL DEFAULT 0,  -- Last applied event sequence number

    CONSTRAINT workflows_terminal_states_exclusive CHECK (
        NOT (completed_at IS NOT NULL AND cancelled_at IS NOT NULL)
    ),
    CONSTRAINT workflows_started_before_completed CHECK (
        started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at
    ),
    CONSTRAINT workflows_objective_nonempty CHECK (length(trim(objective)) > 0)
);

COMMENT ON TABLE venture.workflows IS
    'Top-level workflow execution record. Projection updated by event consumer. '
    'Never directly mutated by application code outside the projection path.';
COMMENT ON COLUMN venture.workflows.policy_bundle_id IS
    'Policy bundle pinned at workflow creation. Immutable once set. '
    'Policy evaluation for all tasks in this workflow uses this bundle.';
COMMENT ON COLUMN venture.workflows.last_event_seq IS
    'NATS JetStream sequence number of the most recent event that updated this row. '
    'Used for stale-read detection in CQRS consumers.';
COMMENT ON COLUMN venture.workflows.error IS
    'Structured error object on terminal failure. '
    'Schema: {"code": str, "message": str, "task_id": uuid?, "trace_id": uuid?}';
```

#### 2.1.3 tasks

A task is the atomic unit of agent work within a workflow. Tasks can be nested (parent_task_id) to represent sub-workflows dispatched by an L1 orchestrator to L2 specialists.

```sql
CREATE TABLE venture.tasks (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID            NOT NULL
                            REFERENCES venture.workflows (id) ON DELETE RESTRICT,
    parent_task_id      UUID            NULL
                            REFERENCES venture.tasks (id) ON DELETE RESTRICT,
    task_type           TEXT            NOT NULL,       -- analyze, execute_tool, research, reconcile, validate, report
    agent_role          TEXT            NOT NULL,       -- l1_orchestrator, l2_writer, l2_coder, l2_researcher, l3_copilot
    status              TEXT            NOT NULL
                            CHECK (status IN (
                                'pending', 'dispatched', 'running',
                                'completed', 'failed', 'cancelled', 'timed_out', 'compensating'
                            )),
    schema_version      TEXT            NOT NULL DEFAULT 'v1',
    input_hash          BYTEA           NOT NULL,       -- SHA-256 of serialized task input
    output_hash         BYTEA           NULL,           -- SHA-256 of serialized task output; null until complete
    retries             SMALLINT        NOT NULL DEFAULT 0 CHECK (retries >= 0 AND retries <= 5),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ     NULL,
    completed_at        TIMESTAMPTZ     NULL,
    last_event_seq      BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT tasks_input_hash_len CHECK (length(input_hash) = 32),
    CONSTRAINT tasks_output_hash_len CHECK (output_hash IS NULL OR length(output_hash) = 32),
    CONSTRAINT tasks_started_before_completed CHECK (
        started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at
    ),
    CONSTRAINT tasks_no_self_parent CHECK (id <> parent_task_id)
);

COMMENT ON TABLE venture.tasks IS
    'Atomic agent work unit. Supports nested execution via parent_task_id. '
    'Projection updated by event consumer from task.* event stream.';
COMMENT ON COLUMN venture.tasks.input_hash IS
    'SHA-256 of the canonical JSON serialization of the task input. '
    'Used for idempotency key derivation and audit chain integrity.';
COMMENT ON COLUMN venture.tasks.output_hash IS
    'SHA-256 of the task output. Set when task transitions to completed. '
    'Null for failed or cancelled tasks.';
COMMENT ON COLUMN venture.tasks.schema_version IS
    'Version of the TaskEnvelopeV1 schema used. Must be "v1" in current release.';
COMMENT ON COLUMN venture.tasks.agent_role IS
    'Agent role determines the tool allowlist applied. '
    'Matches AgentRole enum in TRACK_C_CONTROL_PLANE.md.';
```

---

### 2.2 Saga Compensations

Saga compensations record undo actions triggered when a workflow fails mid-execution and requires rollback of side effects (e.g., reversing a money movement, releasing a reserved EAU budget, revoking a VCC).

```sql
CREATE TABLE venture.saga_compensations (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID            NOT NULL
                            REFERENCES venture.workflows (id) ON DELETE RESTRICT,
    task_id             UUID            NOT NULL
                            REFERENCES venture.tasks (id) ON DELETE RESTRICT,
    compensation_type   TEXT            NOT NULL,       -- reverse_ledger_entry, revoke_money_intent, release_eau_reserve, close_vcc
    status              TEXT            NOT NULL
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    attempted_at        TIMESTAMPTZ     NULL,
    completed_at        TIMESTAMPTZ     NULL,
    error               TEXT            NULL,           -- Free-text error message on failure
    compensation_payload JSONB          NOT NULL DEFAULT '{}',  -- Type-specific compensation parameters
    idempotency_key     TEXT            NOT NULL,       -- Prevent double-compensation
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT saga_compensations_idempotency_unique UNIQUE (idempotency_key),
    CONSTRAINT saga_compensations_completed_after_attempted CHECK (
        attempted_at IS NULL
        OR completed_at IS NULL
        OR attempted_at <= completed_at
    )
);

COMMENT ON TABLE venture.saga_compensations IS
    'Undo records for the saga pattern. Each task that has external side effects '
    'registers a compensation here. On workflow failure, the compensation executor '
    'processes all pending compensations in reverse topological order.';
COMMENT ON COLUMN venture.saga_compensations.compensation_type IS
    'Enumerated compensation action type. '
    'Compensation executor dispatches to the correct handler based on this value.';
COMMENT ON COLUMN venture.saga_compensations.idempotency_key IS
    'Derived from (workflow_id || task_id || compensation_type). '
    'Prevents duplicate compensations on retry.';
COMMENT ON COLUMN venture.saga_compensations.compensation_payload IS
    'Type-specific parameters needed to execute the compensation. '
    'Schema varies by compensation_type; validated by the compensation executor.';
```

---

### 2.3 Tenant and Workspace

#### 2.3.1 tenants

```sql
CREATE TABLE venture.tenants (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT            NOT NULL,
    plan                TEXT            NOT NULL
                            CHECK (plan IN ('free', 'starter', 'growth', 'enterprise')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    suspended_at        TIMESTAMPTZ     NULL,           -- Non-null means tenant is suspended
    metadata            JSONB           NOT NULL DEFAULT '{}',

    CONSTRAINT tenants_name_nonempty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE venture.tenants IS
    'Top-level tenant registry. One tenant = one billing entity. '
    'Suspension is soft: rows are retained, all queries are rejected via RLS.';
COMMENT ON COLUMN venture.tenants.plan IS
    'Billing plan determines quota maximums defined in tenant_quotas.';
```

#### 2.3.2 workspaces

```sql
CREATE TABLE venture.workspaces (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL
                            REFERENCES venture.tenants (id) ON DELETE RESTRICT,
    name                TEXT            NOT NULL,
    nats_stream_prefix  TEXT            NOT NULL,       -- e.g. "venture.t_{tenant_id}.w_{workspace_id}"
    s3_bucket           TEXT            NOT NULL,       -- S3 bucket name for this workspace's blobs
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    archived_at         TIMESTAMPTZ     NULL,

    CONSTRAINT workspaces_name_nonempty CHECK (length(trim(name)) > 0),
    CONSTRAINT workspaces_nats_prefix_nonempty CHECK (length(trim(nats_stream_prefix)) > 0),
    CONSTRAINT workspaces_name_unique_per_tenant UNIQUE (tenant_id, name)
);

COMMENT ON TABLE venture.workspaces IS
    'Logical isolation boundary within a tenant. Each workspace has its own '
    'NATS stream prefix, S3 bucket path, and policy bundle lineage.';
COMMENT ON COLUMN venture.workspaces.nats_stream_prefix IS
    'NATS JetStream subject prefix for all events in this workspace. '
    'Format: "venture.t_{tenant_id_short}.w_{workspace_id_short}". '
    'All event subjects must begin with this prefix.';
```

#### 2.3.3 tenant_quotas

```sql
CREATE TABLE venture.tenant_quotas (
    tenant_id                       UUID    PRIMARY KEY
                                        REFERENCES venture.tenants (id) ON DELETE CASCADE,
    max_workflows_per_day           INT     NOT NULL DEFAULT 100,
    max_artifacts_per_day           INT     NOT NULL DEFAULT 500,
    max_money_authorizations_per_min INT    NOT NULL DEFAULT 10,
    max_agent_sessions              INT     NOT NULL DEFAULT 20,
    max_concurrent_workflows        INT     NOT NULL DEFAULT 10,
    max_task_retries                SMALLINT NOT NULL DEFAULT 3,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tenant_quotas_workflows_positive  CHECK (max_workflows_per_day > 0),
    CONSTRAINT tenant_quotas_artifacts_positive  CHECK (max_artifacts_per_day > 0),
    CONSTRAINT tenant_quotas_auth_rate_positive  CHECK (max_money_authorizations_per_min > 0),
    CONSTRAINT tenant_quotas_sessions_positive   CHECK (max_agent_sessions > 0)
);

COMMENT ON TABLE venture.tenant_quotas IS
    'Hard quota limits per tenant. Enforced by rate-limit middleware and policy engine. '
    'Violations result in HTTP 429 or task rejection, never silent throttling.';
COMMENT ON COLUMN venture.tenant_quotas.max_money_authorizations_per_min IS
    'Rate limit for money_intent approval requests. Enforced by the treasury API '
    'via Redis sliding-window counter keyed on (tenant_id, "money_auth").';
```

---

### 2.4 Agent Identity

Agent identities are provisioned by the control plane. Each identity has an asymmetric key pair; the private key is held exclusively by the agent process and the public key is stored here. Sessions carry HMAC keys for request signing.

#### 2.4.1 agent_identities

```sql
CREATE TABLE venture.agent_identities (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    workspace_id        UUID            NOT NULL
                            REFERENCES venture.workspaces (id) ON DELETE RESTRICT,
    agent_role          TEXT            NOT NULL,       -- Matches AgentRole enum
    public_key          BYTEA           NOT NULL,       -- DER-encoded Ed25519 public key (32 bytes)
    key_fingerprint     TEXT            NOT NULL,       -- Base64url(SHA-256(public_key)), used for lookup
    status              TEXT            NOT NULL
                            CHECK (status IN ('active', 'suspended', 'deprovisioned')),
    provisioned_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deprovisioned_at    TIMESTAMPTZ     NULL,
    metadata            JSONB           NOT NULL DEFAULT '{}',

    CONSTRAINT agent_identities_public_key_len  CHECK (length(public_key) = 32),
    CONSTRAINT agent_identities_fingerprint_nonempty CHECK (length(trim(key_fingerprint)) > 0),
    CONSTRAINT agent_identities_deprovisioned_after_provisioned CHECK (
        deprovisioned_at IS NULL OR deprovisioned_at >= provisioned_at
    ),
    CONSTRAINT agent_identities_fingerprint_unique UNIQUE (key_fingerprint)
);

COMMENT ON TABLE venture.agent_identities IS
    'Workload identity records for all provisioned agents. '
    'Public keys are Ed25519 (32-byte DER). '
    'Private keys are NEVER stored here; held exclusively in the agent process.';
COMMENT ON COLUMN venture.agent_identities.key_fingerprint IS
    'Base64url(SHA-256(public_key)). Used as a fast lookup key for signature verification '
    'without scanning full public key bytes.';
COMMENT ON COLUMN venture.agent_identities.agent_role IS
    'Role determines tool allowlist. Must match one of the roles defined in '
    'ROLE_TOOL_ALLOWLIST_MATRIX.md. Validated at provisioning time.';
```

#### 2.4.2 agent_sessions

```sql
CREATE TABLE venture.agent_sessions (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            UUID            NOT NULL
                            REFERENCES venture.agent_identities (id) ON DELETE RESTRICT,
    hmac_key_hash       BYTEA           NOT NULL,       -- SHA-256 of the session HMAC key (32 bytes)
    expires_at          TIMESTAMPTZ     NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    last_heartbeat_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ     NULL,
    revocation_reason   TEXT            NULL,

    CONSTRAINT agent_sessions_hmac_hash_len   CHECK (length(hmac_key_hash) = 32),
    CONSTRAINT agent_sessions_expires_future  CHECK (expires_at > created_at),
    CONSTRAINT agent_sessions_revoked_has_reason CHECK (
        (revoked_at IS NULL AND revocation_reason IS NULL)
        OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
    )
);

COMMENT ON TABLE venture.agent_sessions IS
    'Active agent sessions. Sessions carry a HMAC key for request signing. '
    'The key itself is ephemeral (held in Redis and agent memory); only the hash is persisted here. '
    'Sessions expire after 15 minutes of inactivity; heartbeats reset last_heartbeat_at.';
COMMENT ON COLUMN venture.agent_sessions.hmac_key_hash IS
    'SHA-256 of the 256-bit HMAC session key. The actual key is stored in Redis '
    'under key "session:{agent_id}" with 15-minute TTL. '
    'This hash enables detection of key rotation without storing the key at rest.';
```

#### 2.4.3 agent_tool_calls

```sql
CREATE TABLE venture.agent_tool_calls (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID            NOT NULL
                            REFERENCES venture.agent_sessions (id) ON DELETE RESTRICT,
    task_id             UUID            NOT NULL
                            REFERENCES venture.tasks (id) ON DELETE RESTRICT,
    tool_name           TEXT            NOT NULL,
    input_hash          BYTEA           NOT NULL,       -- SHA-256 of tool call input parameters
    output_hash         BYTEA           NULL,           -- SHA-256 of tool call result; null if denied
    allowed             BOOLEAN         NOT NULL,       -- false = denied by policy engine
    denial_reason       TEXT            NULL,           -- Populated when allowed = false
    called_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    duration_ms         INT             NULL            CHECK (duration_ms >= 0),

    CONSTRAINT agent_tool_calls_input_hash_len   CHECK (length(input_hash) = 32),
    CONSTRAINT agent_tool_calls_output_hash_len  CHECK (output_hash IS NULL OR length(output_hash) = 32),
    CONSTRAINT agent_tool_calls_denied_has_reason CHECK (
        allowed = true OR denial_reason IS NOT NULL
    )
);

COMMENT ON TABLE venture.agent_tool_calls IS
    'Immutable record of every tool call attempted by an agent session. '
    'Both allowed and denied calls are recorded. This table is append-only. '
    'Used for audit, rate limiting analysis, and prompt injection forensics.';
COMMENT ON COLUMN venture.agent_tool_calls.allowed IS
    'false when the policy engine denied the tool call. '
    'Denial is permanent for this call; the agent must re-request with corrected input.';
COMMENT ON COLUMN venture.agent_tool_calls.duration_ms IS
    'Wall-clock execution time in milliseconds. Null for denied calls.';
```

#### 2.4.4 prompt_injection_detections

```sql
CREATE TABLE venture.prompt_injection_detections (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID            NOT NULL
                            REFERENCES venture.agent_sessions (id) ON DELETE RESTRICT,
    task_id             UUID            NULL
                            REFERENCES venture.tasks (id) ON DELETE RESTRICT,
    pattern_matched     TEXT            NOT NULL,       -- Pattern ID or description that triggered detection
    raw_input_hash      BYTEA           NOT NULL,       -- SHA-256 of the raw input that triggered detection
    confidence_score    NUMERIC(4,3)    NOT NULL        -- 0.000 to 1.000
                            CHECK (confidence_score >= 0 AND confidence_score <= 1),
    action_taken        TEXT            NOT NULL
                            CHECK (action_taken IN ('blocked', 'flagged', 'sanitized')),
    detected_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    metadata            JSONB           NOT NULL DEFAULT '{}',

    CONSTRAINT prompt_injection_detections_hash_len CHECK (length(raw_input_hash) = 32)
);

COMMENT ON TABLE venture.prompt_injection_detections IS
    'Detection events for prompt injection attempts. '
    'Populated by the content taint-tracking system in the planner plane. '
    'Raw input is NEVER stored in plaintext; only the hash is retained.';
COMMENT ON COLUMN venture.prompt_injection_detections.pattern_matched IS
    'Identifier of the detection rule or pattern that fired. '
    'References the pattern catalog in the control plane policy engine.';
COMMENT ON COLUMN venture.prompt_injection_detections.confidence_score IS
    'Model confidence in the detection. 1.000 = deterministic rule match; '
    '< 0.800 = heuristic/model-based detection flagged for review.';
```

---

### 2.5 Artifact

Artifact tables extend the IR type system defined in `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md`. The PostgreSQL schema captures the artifact lifecycle, version history, lineage graph, export jobs, and quality gate reports.

#### 2.5.1 artifacts

```sql
CREATE TABLE venture.artifacts (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    workspace_id        UUID            NOT NULL
                            REFERENCES venture.workspaces (id) ON DELETE RESTRICT,
    workflow_id         UUID            NOT NULL
                            REFERENCES venture.workflows (id) ON DELETE RESTRICT,
    ir_type             TEXT            NOT NULL
                            CHECK (ir_type IN (
                                'slide_spec', 'doc_spec', 'timeline_spec',
                                'audio_spec', 'board_spec', 'data_spec', 'composite_spec'
                            )),
    ir_hash             BYTEA           NOT NULL,       -- SHA-256 of the canonical IR JSON
    status              TEXT            NOT NULL
                            CHECK (status IN ('pending', 'building', 'built', 'failed', 'archived')),
    spec_id             TEXT            NOT NULL,       -- Human-readable IR spec identifier
    policy_bundle_id    UUID            NOT NULL
                            REFERENCES venture.policy_bundles (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    last_event_seq      BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT artifacts_ir_hash_len CHECK (length(ir_hash) = 32),
    CONSTRAINT artifacts_spec_id_nonempty CHECK (length(trim(spec_id)) > 0)
);

COMMENT ON TABLE venture.artifacts IS
    'Top-level artifact record. One artifact per IR specification. '
    'Versions are tracked in artifact_versions. '
    'IR content is stored in S3 at venture-artifacts/{tenant_id}/{workspace_id}/{artifact_id}/ir/{version}/ir.json. '
    'See TRACK_A_ARTIFACT_DETERMINISM_SPEC.md for IR type definitions.';
COMMENT ON COLUMN venture.artifacts.ir_type IS
    'Artifact IR type. Determines which compiler and quality gate are applied. '
    'Corresponds to the IRBase subclass in TRACK_A Section 2.';
COMMENT ON COLUMN venture.artifacts.ir_hash IS
    'SHA-256 of the canonical (sort_keys=True) JSON serialization of the IR. '
    'Used as the idempotency key component for build deduplication.';
```

#### 2.5.2 artifact_versions

```sql
CREATE TABLE venture.artifact_versions (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id         UUID            NOT NULL
                            REFERENCES venture.artifacts (id) ON DELETE RESTRICT,
    version_number      INT             NOT NULL CHECK (version_number > 0),
    ir_hash             BYTEA           NOT NULL,       -- SHA-256 of this version's IR JSON
    toolchain_version   TEXT            NOT NULL,       -- e.g. "python-pptx:0.6.23,ffmpeg:6.1"
    promotion_state     TEXT            NOT NULL
                            CHECK (promotion_state IN (
                                'draft', 'review', 'approved', 'published', 'deprecated'
                            )),
    promoted_by         UUID            NULL,           -- agent_id that promoted to this state
    promoted_at         TIMESTAMPTZ     NULL,
    s3_ir_key           TEXT            NULL,           -- S3 object key for this version's IR blob
    build_cache_hit     BOOLEAN         NOT NULL DEFAULT false, -- true = returned from idempotency cache
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT artifact_versions_version_unique  UNIQUE (artifact_id, version_number),
    CONSTRAINT artifact_versions_ir_hash_len     CHECK (length(ir_hash) = 32),
    CONSTRAINT artifact_versions_promotion_has_promoter CHECK (
        (promotion_state IN ('approved', 'published') AND promoted_by IS NOT NULL AND promoted_at IS NOT NULL)
        OR promotion_state NOT IN ('approved', 'published')
    )
);

COMMENT ON TABLE venture.artifact_versions IS
    'Version history for artifacts. Each update to an IR produces a new version. '
    'Versions are immutable once created. Promotion state tracks the review lifecycle. '
    'See TRACK_A Section 3 for promotion state machine definition.';
COMMENT ON COLUMN venture.artifact_versions.toolchain_version IS
    'Comma-separated "tool:version" pairs for all compilers used in this build. '
    'Required for deterministic replay verification.';
COMMENT ON COLUMN venture.artifact_versions.build_cache_hit IS
    'true when this version was returned from the idempotency cache without re-running '
    'the compiler. The idempotency key is SHA-256(ir_hash || toolchain_version || policy_bundle_id || surface).';
```

#### 2.5.3 artifact_lineage

```sql
CREATE TABLE venture.artifact_lineage (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id         UUID            NOT NULL
                            REFERENCES venture.artifacts (id) ON DELETE RESTRICT,
    parent_artifact_id  UUID            NULL
                            REFERENCES venture.artifacts (id) ON DELETE RESTRICT,
    lineage_type        TEXT            NOT NULL
                            CHECK (lineage_type IN (
                                'derived_from', 'composite_of', 'exported_from',
                                'regenerated_from', 'forked_from'
                            )),
    edge_metadata       JSONB           NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT artifact_lineage_no_self_reference CHECK (artifact_id <> parent_artifact_id)
);

COMMENT ON TABLE venture.artifact_lineage IS
    'Directed acyclic lineage graph for artifacts. '
    'Enables provenance tracing from any artifact back to its source specifications. '
    'parent_artifact_id is NULL for root artifacts (no parent). '
    'DAG integrity is enforced by the application layer, not by a DB constraint.';
COMMENT ON COLUMN venture.artifact_lineage.lineage_type IS
    'Type of the lineage edge. derived_from: output contains content from parent. '
    'composite_of: parent is one input among many. exported_from: format conversion only.';
```

#### 2.5.4 export_jobs

```sql
CREATE TABLE venture.export_jobs (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_version_id     UUID            NOT NULL
                                REFERENCES venture.artifact_versions (id) ON DELETE RESTRICT,
    surface                 TEXT            NOT NULL
                                CHECK (surface IN (
                                    'web', 'email', 'presentation', 'archival',
                                    'google_slides', 'google_docs', 'notion', 'pdf'
                                )),
    format                  TEXT            NOT NULL,   -- e.g. "pptx", "pdf", "mp4", "html", "jsonl"
    status                  TEXT            NOT NULL
                                CHECK (status IN (
                                    'pending', 'running', 'completed', 'failed', 'cancelled'
                                )),
    output_url              TEXT            NULL,       -- S3 presigned URL or object key when completed
    output_hash             BYTEA           NULL,       -- SHA-256 of the exported file
    quality_passed          BOOLEAN         NULL,       -- null = not yet evaluated
    started_at              TIMESTAMPTZ     NULL,
    completed_at            TIMESTAMPTZ     NULL,
    error                   TEXT            NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT export_jobs_output_hash_len CHECK (output_hash IS NULL OR length(output_hash) = 32),
    CONSTRAINT export_jobs_completed_has_output CHECK (
        status <> 'completed' OR (output_url IS NOT NULL AND output_hash IS NOT NULL)
    )
);

COMMENT ON TABLE venture.export_jobs IS
    'Export job records for artifact surface rendering. '
    'Each job converts an artifact_version to a specific surface/format combination. '
    'Output is stored in S3 at venture-artifacts/{tenant_id}/{workspace_id}/{artifact_id}/exports/{surface}/{format}/. '
    'See TRACK_A Section 5 for the export pipeline stages.';
COMMENT ON COLUMN venture.export_jobs.output_url IS
    'S3 object key (not presigned URL) for the exported file. '
    'Presigned URLs are generated on-demand by the API layer with 1-hour expiry.';
```

#### 2.5.5 quality_reports

```sql
CREATE TABLE venture.quality_reports (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_version_id     UUID            NOT NULL
                                REFERENCES venture.artifact_versions (id) ON DELETE RESTRICT,
    build_id                UUID            NOT NULL UNIQUE,    -- Unique build run identifier
    passed                  BOOLEAN         NOT NULL,
    checks                  JSONB           NOT NULL,           -- Array of check result objects
    gate_version            TEXT            NOT NULL,           -- Quality gate schema version
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT quality_reports_checks_is_array CHECK (jsonb_typeof(checks) = 'array')
);

COMMENT ON TABLE venture.quality_reports IS
    'Quality gate evaluation results per artifact build. '
    'A passed=false report blocks promotion to approved/published state. '
    'Full report JSON is also written to S3 at venture-artifacts/.../quality/{build_id}/report.json. '
    'See TRACK_A Section 4 for quality gate check definitions.';
COMMENT ON COLUMN venture.quality_reports.checks IS
    'JSON array of individual check results. '
    'Schema: [{"check_id": str, "passed": bool, "score": float?, "message": str?, "detail": obj?}]. '
    'GIN indexed for check_id lookups.';
COMMENT ON COLUMN venture.quality_reports.build_id IS
    'Unique identifier for this build run. Links to the idempotency cache entry '
    'and to the S3 report object. Referenced by artifact_versions when build_cache_hit=false.';
```

---

### 2.6 Event Store (CQRS Write Model)

The event store is the canonical append-only log from which all projection tables are derived. No row in this table is ever updated or deleted. Partitioning by month keeps query performance stable as the table grows.

#### 2.6.1 stored_events

```sql
-- Main partitioned table
CREATE TABLE venture.stored_events (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    stream_name     TEXT            NOT NULL,   -- e.g. "venture.t_abc.w_xyz.workflow.events"
    stream_seq      BIGINT          NOT NULL,   -- NATS JetStream sequence number within stream
    event_type      TEXT            NOT NULL,   -- dot-notation event type, e.g. "workflow.started.v1"
    schema_version  TEXT            NOT NULL DEFAULT 'v1',
    tenant_id       UUID            NOT NULL,
    workspace_id    UUID            NULL,       -- null for tenant-level events
    workflow_id     UUID            NULL,       -- null for workflow-external events
    task_id         UUID            NULL,
    agent_role      TEXT            NULL,
    policy_bundle_id UUID           NULL,
    payload         JSONB           NOT NULL,   -- Event-specific payload
    causal_hash     BYTEA           NULL,       -- SHA-256 hash chain link from EventEnvelopeV1
    prev_event_hash TEXT            NULL,       -- SHA-256 of previous event in this workflow's chain
    this_event_hash TEXT            NULL,       -- SHA-256 of this event envelope
    trace_id        UUID            NULL,
    emitted_at      TIMESTAMPTZ     NOT NULL,   -- From EventEnvelopeV1.created_at

    -- Partition key must be in PK
    PRIMARY KEY (id, emitted_at),
    CONSTRAINT stored_events_stream_seq_unique UNIQUE (stream_name, stream_seq),
    CONSTRAINT stored_events_causal_hash_len CHECK (causal_hash IS NULL OR length(causal_hash) = 32),
    CONSTRAINT stored_events_schema_version_known CHECK (schema_version IN ('v1'))
) PARTITION BY RANGE (emitted_at);

COMMENT ON TABLE venture.stored_events IS
    'Canonical append-only event store. The source of truth for all system state. '
    'Partitioned by emitted_at in monthly intervals. '
    'Partition names: stored_events_YYYY_MM. Partitions are created 30 days in advance. '
    'Retention: compliance and audit events retained 7 years; workflow events retained 90 days '
    '(see Section 10 for retention policy).';
COMMENT ON COLUMN venture.stored_events.stream_name IS
    'NATS JetStream stream name. Follows workspace stream prefix convention. '
    'Must begin with the workspace nats_stream_prefix.';
COMMENT ON COLUMN venture.stored_events.stream_seq IS
    'Monotonically increasing sequence number assigned by NATS JetStream. '
    'Used with stream_name as the deduplication key.';
COMMENT ON COLUMN venture.stored_events.causal_hash IS
    'SHA-256 of the EventEnvelopeV1 as computed by EventEnvelopeV1.compute_hash(). '
    'Forms a cryptographic hash chain enabling tamper detection.';

-- Create initial monthly partitions (example for 2026)
CREATE TABLE venture.stored_events_2026_01
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE venture.stored_events_2026_02
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE venture.stored_events_2026_03
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE venture.stored_events_2026_04
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE venture.stored_events_2026_05
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE venture.stored_events_2026_06
    PARTITION OF venture.stored_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Partition creation function for automated monthly partition management
CREATE OR REPLACE FUNCTION venture.create_stored_events_partition(target_month DATE)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    partition_name TEXT;
    start_date     DATE;
    end_date       DATE;
BEGIN
    start_date     := date_trunc('month', target_month)::DATE;
    end_date       := (start_date + INTERVAL '1 month')::DATE;
    partition_name := 'stored_events_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS venture.%I '
        'PARTITION OF venture.stored_events '
        'FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$;

COMMENT ON FUNCTION venture.create_stored_events_partition IS
    'Creates a monthly partition for stored_events. '
    'Called by the pg_cron job "venture_partition_maintenance" 30 days in advance.';
```

#### 2.6.2 event_snapshots

```sql
CREATE TABLE venture.event_snapshots (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_name     TEXT            NOT NULL,
    stream_seq      BIGINT          NOT NULL,   -- Event sequence number at snapshot time
    snapshot_type   TEXT            NOT NULL,   -- e.g. "workflow_state", "agent_session_state"
    state_blob      BYTEA           NOT NULL,   -- Zstd-compressed serialized state
    state_hash      BYTEA           NOT NULL,   -- SHA-256 of decompressed state_blob
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT event_snapshots_stream_seq_unique UNIQUE (stream_name, snapshot_type, stream_seq),
    CONSTRAINT event_snapshots_state_hash_len    CHECK (length(state_hash) = 32)
);

COMMENT ON TABLE venture.event_snapshots IS
    'Snapshot of aggregate state at a given event sequence number. '
    'Created every 1000 events per stream to accelerate aggregate rehydration. '
    'Replay resumes from the latest snapshot + subsequent events rather than from event 0. '
    'state_blob is zstd-compressed MessagePack serialization of the aggregate state.';
COMMENT ON COLUMN venture.event_snapshots.state_blob IS
    'Zstd-compressed (level 3) MessagePack serialization of the aggregate state. '
    'Typical compressed size: 2-20 KB. Decompressed before deserialization.';
```

---

### 2.7 Treasury and Compliance — Reference to Track B

The treasury and compliance tables are fully specified in `TRACK_B_TREASURY_COMPLIANCE_SPEC.md`. This section provides reference anchors for cross-document consistency.

The following tables are defined in Track B and **must not be redefined here**:

| Table | Track B Section | Purpose |
|-------|----------------|---------|
| `venture.money_intents` | Section 2 | Pre-authorization records for every spend action |
| `venture.authorization_decisions` | Section 3 | Policy engine approval/rejection records per intent |
| `venture.ledger_entries` | Section 4 | Double-entry financial ledger (asset/liability/revenue/expense) |
| `venture.vcc_cards` | Section 5 | Virtual credit card records linked to money intents |
| `venture.reconciliation_runs` | Section 6 | Automated daily reconciliation job records |
| `venture.reconciliation_discrepancies` | Section 6 | Discrepancy records requiring investigation |
| `venture.compliance_cases` | Section 7 | Policy violation cases raised by the compliance engine |
| `venture.privacy_requests` | Section 8 | DSAR and GDPR erasure requests |

**Integration points with tables defined in this document:**

- `money_intents.workflow_id` references `venture.workflows.id`
- `money_intents.policy_bundle_id` references `venture.policy_bundles.id`
- `authorization_decisions.agent_session_id` references `venture.agent_sessions.id`
- `compliance_cases.workflow_id` references `venture.workflows.id`
- `privacy_requests.tenant_id` references `venture.tenants.id`
- All treasury tables carry `tenant_id` and are subject to the same RLS policies defined in Section 3

---

### 2.8 Audit Log

The audit log is a permanent, append-only record of all significant actor actions. It is never edited, never back-filled, and never deleted within the retention window.

```sql
CREATE TABLE venture.audit_log (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL,
    workspace_id    UUID            NULL,
    actor_id        UUID            NOT NULL,       -- agent_id, system service ID, or founder user ID
    actor_type      TEXT            NOT NULL
                        CHECK (actor_type IN ('agent', 'service', 'founder', 'system')),
    action          TEXT            NOT NULL,       -- Verb in SCREAMING_SNAKE_CASE, e.g. WORKFLOW_STARTED
    resource_type   TEXT            NOT NULL,       -- e.g. workflow, task, artifact, money_intent
    resource_id     UUID            NOT NULL,
    policy_bundle_id UUID           NULL,           -- Active bundle at time of action
    metadata        JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL,       -- From EventEnvelopeV1; must not use DB default

    PRIMARY KEY (id, created_at),
    CONSTRAINT audit_log_action_nonempty        CHECK (length(trim(action)) > 0),
    CONSTRAINT audit_log_resource_type_nonempty CHECK (length(trim(resource_type)) > 0)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE venture.audit_log IS
    'Permanent append-only audit trail for all significant actions. '
    'Partitioned by created_at (monthly, same as stored_events). '
    'Retention: 7 years (all events, no distinction by event type). '
    'Exported nightly to S3 at venture-audit/{tenant_id}/{year}/{month}/{day}/{id}.jsonl.zst. '
    'NEVER edit, delete, or back-fill rows in this table.';
COMMENT ON COLUMN venture.audit_log.created_at IS
    'Timestamp from the EventEnvelopeV1.created_at field. '
    'Must NOT use now() or DEFAULT here — timestamp must match the event timestamp exactly.';
COMMENT ON COLUMN venture.audit_log.actor_id IS
    'Identifier of the entity that performed the action. '
    'For agent actions: agent_identities.id. '
    'For service actions: a well-known service UUID registered in the service registry. '
    'For founder actions: the founder user ID from the auth system.';

-- Initial audit_log partitions
CREATE TABLE venture.audit_log_2026_01
    PARTITION OF venture.audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE venture.audit_log_2026_02
    PARTITION OF venture.audit_log
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE venture.audit_log_2026_03
    PARTITION OF venture.audit_log
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## 3. Row-Level Security — Full Policy DDL

RLS enforces tenant isolation at the PostgreSQL layer. No application-level code can accidentally read cross-tenant data regardless of how queries are constructed, because the database rejects the read before returning rows.

### 3.1 Application Roles

```sql
-- Application role: used by all runtime services (policy-engine, treasury-api, artifact-compiler, etc.)
-- BYPASSRLS = false is the security-critical property.
CREATE ROLE venture_app_role
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    BYPASSRLS = false;

-- Migration role: used exclusively by sqlx migrate and the DBA. Never used by application code.
CREATE ROLE venture_migration_role
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    BYPASSRLS = true;

-- Read replica role: used for CQRS read-model queries routed to replicas.
CREATE ROLE venture_read_role
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    BYPASSRLS = false;

-- Grant schema access
GRANT USAGE ON SCHEMA venture TO venture_app_role, venture_read_role;
GRANT USAGE ON SCHEMA venture TO venture_migration_role;

-- Grant DML to app role (INSERT only on append-only tables; SELECT/INSERT/UPDATE on projection tables)
GRANT SELECT, INSERT ON venture.stored_events TO venture_app_role;
GRANT SELECT, INSERT ON venture.audit_log TO venture_app_role;
GRANT SELECT, INSERT ON venture.event_snapshots TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.policy_bundles TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.workflows TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.tasks TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.saga_compensations TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.agent_identities TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.agent_sessions TO venture_app_role;
GRANT SELECT, INSERT ON venture.agent_tool_calls TO venture_app_role;
GRANT SELECT, INSERT ON venture.prompt_injection_detections TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.artifacts TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.artifact_versions TO venture_app_role;
GRANT SELECT, INSERT ON venture.artifact_lineage TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.export_jobs TO venture_app_role;
GRANT SELECT, INSERT ON venture.quality_reports TO venture_app_role;
GRANT SELECT, INSERT ON venture.tenants TO venture_app_role;
GRANT SELECT, INSERT ON venture.workspaces TO venture_app_role;
GRANT SELECT, INSERT, UPDATE ON venture.tenant_quotas TO venture_app_role;

-- Grant read-only to read role
GRANT SELECT ON ALL TABLES IN SCHEMA venture TO venture_read_role;

-- Grant all to migration role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA venture TO venture_migration_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA venture TO venture_migration_role;
```

### 3.2 Enable RLS on All Tenant-Scoped Tables

```sql
-- Policy and workflow tables
ALTER TABLE venture.policy_bundles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.workflows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.saga_compensations   ENABLE ROW LEVEL SECURITY;

-- Tenant and workspace tables
ALTER TABLE venture.tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.tenant_quotas        ENABLE ROW LEVEL SECURITY;

-- Agent identity tables
ALTER TABLE venture.agent_identities     ENABLE ROW LEVEL SECURITY;

-- Artifact tables
ALTER TABLE venture.artifacts            ENABLE ROW LEVEL SECURITY;

-- Event store and audit log
ALTER TABLE venture.stored_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture.audit_log            ENABLE ROW LEVEL SECURITY;
```

### 3.3 Tenant Isolation Policies

```sql
-- Helper function: returns current tenant UUID from session variable
CREATE OR REPLACE FUNCTION venture.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT NULLIF(current_setting('app.current_tenant', true), '')::UUID;
$$;

COMMENT ON FUNCTION venture.current_tenant_id IS
    'Returns the UUID set by "SET app.current_tenant = ''<uuid>''". '
    'Returns NULL if not set; queries will return no rows (safe default). '
    'Applications MUST set this before any query. Failure to set it returns empty results.';

-- policy_bundles
CREATE POLICY tenant_isolation ON venture.policy_bundles
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- workflows
CREATE POLICY tenant_isolation ON venture.workflows
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- tasks: filtered via workflow's tenant_id through a subquery
-- (tasks table does not directly carry tenant_id; join through workflows)
-- Implementation note: tasks.workflow_id -> workflows.tenant_id join is required.
-- For performance, a generated column tasks.tenant_id is added:

ALTER TABLE venture.tasks ADD COLUMN tenant_id UUID NULL;
-- Backfilled by migration 0004 (see Section 8)
-- After backfill, set NOT NULL and add RLS:

CREATE POLICY tenant_isolation ON venture.tasks
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- saga_compensations: also denormalize tenant_id
ALTER TABLE venture.saga_compensations ADD COLUMN tenant_id UUID NULL;

CREATE POLICY tenant_isolation ON venture.saga_compensations
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- tenants: tenant can only see its own row
CREATE POLICY tenant_isolation ON venture.tenants
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (id = venture.current_tenant_id());

-- workspaces
CREATE POLICY tenant_isolation ON venture.workspaces
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- tenant_quotas
CREATE POLICY tenant_isolation ON venture.tenant_quotas
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- agent_identities
CREATE POLICY tenant_isolation ON venture.agent_identities
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- artifacts
CREATE POLICY tenant_isolation ON venture.artifacts
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- stored_events
CREATE POLICY tenant_isolation ON venture.stored_events
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());

-- audit_log
CREATE POLICY tenant_isolation ON venture.audit_log
    FOR ALL
    TO venture_app_role, venture_read_role
    USING (tenant_id = venture.current_tenant_id());
```

### 3.4 Suspension Policy — Rejected Reads for Suspended Tenants

```sql
-- Additional policy to block all reads/writes for suspended tenants
CREATE POLICY suspension_block ON venture.tenants
    FOR ALL
    TO venture_app_role
    USING (suspended_at IS NULL);

-- Applies transitively to all other tables via the tenant_isolation policy
-- because a suspended tenant's current_tenant_id() will return its UUID but
-- the tenants.suspension_block policy ensures no service token for a suspended
-- tenant can pass auth middleware. Defense-in-depth via middleware + RLS.
```

### 3.5 RLS Enforcement Test

```sql
-- Run this test in CI against a test database to verify RLS is working:

-- Setup
SET app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
INSERT INTO venture.tenants (id, name, plan) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TenantA', 'starter'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TenantB', 'starter');

-- Test 1: Tenant A can only see its own row
SET app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) FROM venture.tenants;
-- Expected: 1

-- Test 2: Tenant B cannot see Tenant A's workflows
SET app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) FROM venture.workflows
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 0

-- Test 3: No tenant set returns empty
RESET app.current_tenant;
SELECT count(*) FROM venture.workflows;
-- Expected: 0 (current_tenant_id() returns NULL, no rows match)
```

---

## 4. Indexes — Complete Index DDL

### 4.1 policy_bundles Indexes

```sql
-- Tenant+workspace composite for policy lookup
CREATE INDEX idx_policy_bundles_tenant_workspace
    ON venture.policy_bundles (tenant_id, workspace_id);

-- Active policy lookup per workspace (partial index for performance)
CREATE UNIQUE INDEX idx_policy_bundles_active_per_workspace
    ON venture.policy_bundles (tenant_id, workspace_id)
    WHERE status = 'active';

-- Content hash lookup for integrity verification
CREATE INDEX idx_policy_bundles_content_hash
    ON venture.policy_bundles USING hash (content_hash);

-- Created_at BRIN for time-range scans
CREATE INDEX idx_policy_bundles_created_at_brin
    ON venture.policy_bundles USING brin (created_at) WITH (pages_per_range = 128);
```

### 4.2 workflows Indexes

```sql
-- Tenant+workspace composite (primary query pattern)
CREATE INDEX idx_workflows_tenant_workspace
    ON venture.workflows (tenant_id, workspace_id);

-- Active workflows (pending + running) — partial index
CREATE INDEX idx_workflows_active
    ON venture.workflows (tenant_id, workspace_id, created_at DESC)
    WHERE status IN ('pending', 'running', 'paused');

-- Policy bundle lookup (for cascade invalidation)
CREATE INDEX idx_workflows_policy_bundle
    ON venture.workflows (policy_bundle_id);

-- Status for queue monitoring
CREATE INDEX idx_workflows_status
    ON venture.workflows (tenant_id, status, created_at DESC);

-- BRIN on created_at for range scans
CREATE INDEX idx_workflows_created_at_brin
    ON venture.workflows USING brin (created_at) WITH (pages_per_range = 128);

-- GIN on error JSONB for error code queries
CREATE INDEX idx_workflows_error_gin
    ON venture.workflows USING gin (error)
    WHERE error IS NOT NULL;
```

### 4.3 tasks Indexes

```sql
-- Workflow+status composite for task queue queries (most frequent read pattern)
CREATE INDEX idx_tasks_workflow_status
    ON venture.tasks (workflow_id, status, created_at ASC);

-- Active tasks per workflow
CREATE INDEX idx_tasks_active
    ON venture.tasks (workflow_id, created_at ASC)
    WHERE status IN ('pending', 'dispatched', 'running');

-- Parent task lookup for nested workflows
CREATE INDEX idx_tasks_parent_task
    ON venture.tasks (parent_task_id)
    WHERE parent_task_id IS NOT NULL;

-- Agent role + status for work queue assignment
CREATE INDEX idx_tasks_agent_role_status
    ON venture.tasks (tenant_id, agent_role, status, created_at ASC)
    WHERE status = 'pending';

-- BRIN on created_at
CREATE INDEX idx_tasks_created_at_brin
    ON venture.tasks USING brin (created_at) WITH (pages_per_range = 128);
```

### 4.4 saga_compensations Indexes

```sql
-- Pending compensations per workflow (compensation executor query)
CREATE INDEX idx_saga_compensations_workflow_pending
    ON venture.saga_compensations (workflow_id, created_at ASC)
    WHERE status = 'pending';

-- Task-level compensation lookup
CREATE INDEX idx_saga_compensations_task
    ON venture.saga_compensations (task_id);
```

### 4.5 tenants and workspaces Indexes

```sql
-- Tenant name lookup (for founder UI)
CREATE INDEX idx_tenants_name
    ON venture.tenants (name text_pattern_ops);

-- Active tenants (partial index excludes suspended)
CREATE INDEX idx_tenants_active
    ON venture.tenants (created_at DESC)
    WHERE suspended_at IS NULL;

-- Workspace by tenant
CREATE INDEX idx_workspaces_tenant
    ON venture.workspaces (tenant_id);

-- NATS stream prefix lookup (for event routing)
CREATE INDEX idx_workspaces_nats_prefix
    ON venture.workspaces (nats_stream_prefix text_pattern_ops);
```

### 4.6 agent_identities and agent_sessions Indexes

```sql
-- Role lookup within workspace
CREATE INDEX idx_agent_identities_workspace_role
    ON venture.agent_identities (tenant_id, workspace_id, agent_role)
    WHERE status = 'active';

-- Key fingerprint lookup (used in every signature verification)
-- Covered by the UNIQUE constraint idx (already created by UNIQUE clause)

-- Active sessions per agent
CREATE INDEX idx_agent_sessions_agent_active
    ON venture.agent_sessions (agent_id, expires_at DESC)
    WHERE revoked_at IS NULL;

-- Expiry scan (for session cleanup job)
CREATE INDEX idx_agent_sessions_expires_at
    ON venture.agent_sessions (expires_at)
    WHERE revoked_at IS NULL;

-- Tool call lookup per session
CREATE INDEX idx_agent_tool_calls_session
    ON venture.agent_tool_calls (session_id, called_at DESC);

-- Denied tool calls for security analysis
CREATE INDEX idx_agent_tool_calls_denied
    ON venture.agent_tool_calls (session_id, called_at DESC)
    WHERE allowed = false;

-- Prompt injection by session
CREATE INDEX idx_prompt_injection_session
    ON venture.prompt_injection_detections (session_id, detected_at DESC);

-- BRIN on called_at for tool call range scans
CREATE INDEX idx_agent_tool_calls_called_at_brin
    ON venture.agent_tool_calls USING brin (called_at) WITH (pages_per_range = 128);
```

### 4.7 artifact Indexes

```sql
-- Artifact lookup within workspace
CREATE INDEX idx_artifacts_workspace
    ON venture.artifacts (tenant_id, workspace_id, created_at DESC);

-- Artifact by workflow
CREATE INDEX idx_artifacts_workflow
    ON venture.artifacts (workflow_id);

-- IR hash lookup for idempotency cache
CREATE INDEX idx_artifacts_ir_hash
    ON venture.artifacts USING hash (ir_hash);

-- Active artifacts (partial)
CREATE INDEX idx_artifacts_active
    ON venture.artifacts (tenant_id, workspace_id, created_at DESC)
    WHERE status IN ('pending', 'building', 'built');

-- Artifact version lookup (most common read pattern)
CREATE INDEX idx_artifact_versions_artifact_version
    ON venture.artifact_versions (artifact_id, version_number DESC);

-- Published versions lookup
CREATE INDEX idx_artifact_versions_published
    ON venture.artifact_versions (artifact_id, version_number DESC)
    WHERE promotion_state = 'published';

-- IR hash for cache lookup (covers toolchain_version comparison)
CREATE INDEX idx_artifact_versions_ir_hash
    ON venture.artifact_versions USING hash (ir_hash);

-- Lineage graph traversal (outbound: all children of a parent)
CREATE INDEX idx_artifact_lineage_parent
    ON venture.artifact_lineage (parent_artifact_id)
    WHERE parent_artifact_id IS NOT NULL;

-- Export jobs by artifact version and status
CREATE INDEX idx_export_jobs_version_status
    ON venture.export_jobs (artifact_version_id, status, created_at DESC);

-- Failed export jobs for retry queue
CREATE INDEX idx_export_jobs_failed
    ON venture.export_jobs (artifact_version_id, created_at DESC)
    WHERE status = 'failed';

-- Quality reports by artifact version
CREATE INDEX idx_quality_reports_version
    ON venture.quality_reports (artifact_version_id, created_at DESC);

-- GIN on quality report checks array
CREATE INDEX idx_quality_reports_checks_gin
    ON venture.quality_reports USING gin (checks);
```

### 4.8 stored_events Indexes

```sql
-- Per-partition indexes are created automatically when partitions are created.
-- The following index template applies to each partition:

-- Workflow event lookup (most common query: replay events for a workflow)
CREATE INDEX idx_stored_events_workflow_2026_02
    ON venture.stored_events_2026_02 (workflow_id, stream_seq ASC)
    WHERE workflow_id IS NOT NULL;

-- Tenant event lookup for audit replay
CREATE INDEX idx_stored_events_tenant_2026_02
    ON venture.stored_events_2026_02 (tenant_id, emitted_at ASC);

-- Event type lookup
CREATE INDEX idx_stored_events_event_type_2026_02
    ON venture.stored_events_2026_02 (tenant_id, event_type, emitted_at ASC);

-- BRIN on emitted_at within partition for sub-partition range scans
CREATE INDEX idx_stored_events_emitted_at_brin_2026_02
    ON venture.stored_events_2026_02 USING brin (emitted_at) WITH (pages_per_range = 64);

-- GIN on payload for event content queries
CREATE INDEX idx_stored_events_payload_gin_2026_02
    ON venture.stored_events_2026_02 USING gin (payload);
```

### 4.9 audit_log Indexes

```sql
-- Tenant audit trail lookup
CREATE INDEX idx_audit_log_tenant_2026_02
    ON venture.audit_log_2026_02 (tenant_id, created_at DESC);

-- Resource-level audit lookup
CREATE INDEX idx_audit_log_resource_2026_02
    ON venture.audit_log_2026_02 (tenant_id, resource_type, resource_id, created_at DESC);

-- Actor audit trail
CREATE INDEX idx_audit_log_actor_2026_02
    ON venture.audit_log_2026_02 (tenant_id, actor_id, created_at DESC);

-- GIN on metadata JSONB
CREATE INDEX idx_audit_log_metadata_gin_2026_02
    ON venture.audit_log_2026_02 USING gin (metadata);

-- BRIN on created_at within partition
CREATE INDEX idx_audit_log_created_at_brin_2026_02
    ON venture.audit_log_2026_02 USING brin (created_at) WITH (pages_per_range = 64);
```

---

## 5. NATS JetStream — Key-Value and Object Store

### 5.1 JetStream Stream Configuration

All NATS streams use the following baseline configuration unless overridden:

```json
{
  "retention": "limits",
  "storage": "file",
  "num_replicas": 3,
  "max_consumers": -1,
  "duplicate_window": "2m",
  "deny_delete": true,
  "deny_purge": true,
  "allow_direct": false,
  "max_msg_size": 1048576
}
```

Individual stream subject patterns and retention limits are defined in `API_EVENTS_SPEC.md`.

### 5.2 Key-Value Buckets

#### VENTURE_POLICY_CACHE

Stores the active serialized policy bundle for each workspace. Invalidated on `policy.activated.v1` events. Used by policy-engine to serve hot-path policy decisions without a PostgreSQL round-trip.

```
Bucket name:     VENTURE_POLICY_CACHE
Storage:         File (replicated)
Replicas:        3
TTL:             30 seconds (auto-expire; refreshed on policy.activated.v1)
Max value size:  524288 bytes (512 KB)
History:         1 (latest value only)
Compression:     None

Key format:      {tenant_id}/{workspace_id}
Value format:    JSON-serialized PolicyBundle (from SCHEMA_PACK.md)
Invalidation:    Policy engine writes on policy.activated.v1; all consumers read from KV
```

#### VENTURE_AGENT_SESSIONS

Stores the HMAC session key for active agent sessions. TTL-based expiry enforces session rotation.

```
Bucket name:     VENTURE_AGENT_SESSIONS
Storage:         Memory (primary) + File (replica for durability)
Replicas:        3
TTL:             900 seconds (15 minutes); refreshed on heartbeat
Max value size:  4096 bytes
History:         1 (latest value only)
Compression:     None

Key format:      {tenant_id}/{agent_id}
Value format:    JSON: {"hmac_key": "<base64-encoded 256-bit key>", "session_id": "<uuid>", "expires_at": "<iso8601>"}
Heartbeat:       agent-runtime sends NATS KV PUT every 5 minutes to refresh TTL
Revocation:      PUT with TTL=0 or explicit DELETE on session revocation
```

#### VENTURE_RATE_LIMITS

Sliding window rate limit counters per (tenant_id, resource_type). Atomic increment operations enforce limits without requiring a database round-trip.

```
Bucket name:     VENTURE_RATE_LIMITS
Storage:         Memory (primary)
Replicas:        3
TTL:             Dynamic (window_size + 60 seconds per key)
Max value size:  256 bytes
History:         1

Key format:      {tenant_id}/{resource_type}/{window_ts}
                 resource_type: "money_auth" | "workflow_create" | "artifact_build" | "agent_provision"
                 window_ts:     Unix timestamp of window start, truncated to window_size seconds
Value format:    JSON: {"count": <int>, "limit": <int>, "window_start": <int>, "window_size_sec": <int>}
Atomic ops:      Use NATS KV Update (CAS) for atomic increment; retry on conflict
```

#### VENTURE_IDEMPOTENCY

Idempotency keys for money intents, artifact builds, and workflow submissions. Prevents duplicate processing under at-least-once delivery.

```
Bucket name:     VENTURE_IDEMPOTENCY
Storage:         File
Replicas:        3
TTL:             86400 seconds (24 hours)
Max value size:  1024 bytes
History:         1

Key format:      {tenant_id}/{idempotency_key}
Value format:    JSON: {"result_id": "<uuid>", "status": "<terminal_status>", "created_at": "<iso8601>"}
Usage:           Check before processing; write on first completion; return cached result on duplicate
```

### 5.3 Object Store

#### VENTURE_ARTIFACTS_OBJECTS

Large artifact blobs exceeding 1 MB are stored in the NATS Object Store rather than PostgreSQL BYTEA columns. Metadata is always stored in PostgreSQL; blobs are referenced by S3 key.

```
Store name:      VENTURE_ARTIFACTS_OBJECTS
Storage:         File
Replicas:        3
Chunk size:      131072 bytes (128 KB)
Max object size: 104857600 bytes (100 MB)
TTL:             None (managed by lifecycle policy in Section 10)
Compression:     Zstd (applied by the object store client before upload)

Object name format: {tenant_id}/{workspace_id}/{artifact_id}/v{version_number}/{surface}/{format}
Metadata headers:
    Venture-Artifact-Id:     <uuid>
    Venture-Version-Number:  <int>
    Venture-IR-Hash:         <hex>
    Venture-Tenant-Id:       <uuid>
    Content-Type:            application/octet-stream (or media type)
```

---

## 6. S3/MinIO — Bucket Layout and Object Naming

### 6.1 Bucket Inventory

| Bucket Name | Purpose | Versioning | SSE | Lifecycle |
|-------------|---------|-----------|-----|-----------|
| `venture-artifacts` | Artifact IR, exports, quality reports | Enabled | SSE-S3 (AES-256) | Glacier after 90 days |
| `venture-audit` | Daily audit log exports (JSONL Zstd) | Enabled | SSE-S3 (AES-256) | Glacier after 365 days; delete after 7 years |
| `venture-snapshots` | Event aggregate snapshots | Disabled | SSE-S3 (AES-256) | Delete after 90 days |
| `venture-tmp` | Temporary build artifacts (export job intermediates) | Disabled | SSE-S3 (AES-256) | Delete after 24 hours |

### 6.2 Bucket Policy

All buckets are private (no public access). Object ownership is set to `BucketOwnerEnforced`. ACLs are disabled.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::venture-artifacts",
        "arn:aws:s3:::venture-artifacts/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "AllowVentureServiceRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::{account_id}:role/venture-service-role"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::venture-artifacts",
        "arn:aws:s3:::venture-artifacts/*"
      ]
    }
  ]
}
```

### 6.3 Object Naming — venture-artifacts

```
venture-artifacts/
└── {tenant_id}/
    └── {workspace_id}/
        └── {artifact_id}/
            ├── ir/
            │   └── {version_number}/
            │       ├── ir.json                        # Canonical IR JSON (gzip compressed)
            │       ├── ir.json.sha256                 # SHA-256 hex digest of uncompressed ir.json
            │       └── manifest.json                  # Build metadata: toolchain, policy_bundle_id, build_id
            ├── exports/
            │   └── {surface}/
            │       └── {format}/
            │           ├── {artifact_id}_v{version}.{ext}
            │           └── {artifact_id}_v{version}.{ext}.sha256
            └── quality/
                └── {build_id}/
                    ├── report.json                    # Full quality gate results
                    └── report.json.sha256
```

**Object key examples:**

```
venture-artifacts/
  tenant_abc123/workspace_xyz789/artifact_def456/
    ir/3/ir.json
    ir/3/ir.json.sha256
    ir/3/manifest.json
    exports/presentation/pptx/artifact_def456_v3.pptx
    exports/web/html/artifact_def456_v3.html
    quality/build_ghi012/report.json
```

### 6.4 Object Naming — venture-audit

Audit log exports are written nightly by the `audit-exporter` service.

```
venture-audit/
└── {tenant_id}/
    └── {year}/
        └── {month}/
            └── {day}/
                └── {audit_log_export_id}.jsonl.zst
```

Each `.jsonl.zst` file is a Zstd-compressed JSONL file containing all audit log entries for the tenant on that day. Export metadata is recorded in the `audit_log_exports` table (not defined here; internal to the audit-exporter service).

### 6.5 Object Naming — venture-snapshots

```
venture-snapshots/
└── {tenant_id}/
    └── {stream_name_urlsafe}/
        └── {stream_seq}.snap.zst
```

Snapshots are Zstd-compressed MessagePack serializations of aggregate state. The `stream_seq` in the filename is the event sequence number of the last event included in the snapshot.

### 6.6 Lifecycle Policies

```json
{
  "Rules": [
    {
      "ID": "venture-artifacts-glacier-transition",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ]
    },
    {
      "ID": "venture-artifacts-ir-expiry",
      "Filter": { "Prefix": "{tenant_id}/{workspace_id}/{artifact_id}/ir/" },
      "Status": "Enabled",
      "Expiration": { "Days": 2555 }
    }
  ]
}
```

```json
{
  "Rules": [
    {
      "ID": "venture-audit-glacier-transition",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 365, "StorageClass": "GLACIER" }
      ]
    },
    {
      "ID": "venture-audit-7yr-expiry",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Expiration": { "Days": 2555 }
    }
  ]
}
```

```json
{
  "Rules": [
    {
      "ID": "venture-snapshots-90day-expiry",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Expiration": { "Days": 90 }
    }
  ]
}
```

```json
{
  "Rules": [
    {
      "ID": "venture-tmp-24hr-expiry",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Expiration": { "Days": 1 }
    }
  ]
}
```

---

## 7. Redis Cache Schema

### 7.1 Connection and Namespace Convention

All Redis keys are namespaced under `venture:` to prevent collision with other applications sharing the Redis instance. Key segments use `:` as separator. All TTLs are in seconds.

Redis Cluster mode is used in production. Keys are distributed across slots by the first two segments of the key (`venture:{tenant_id}:*`), ensuring tenant data co-locality.

### 7.2 Key Catalog

#### Artifact Metadata Cache

```
Key:     venture:{tenant_id}:artifact:{artifact_id}:meta
Type:    Hash
TTL:     300 seconds (5 minutes)
Fields:
    ir_type          TEXT
    ir_hash          TEXT (hex)
    status           TEXT
    spec_id          TEXT
    workspace_id     TEXT (UUID)
    workflow_id      TEXT (UUID)
    created_at       TEXT (ISO-8601)
Purpose: Avoids PostgreSQL round-trip for artifact metadata in hot paths (export job dispatch, quality gate lookup).
Invalidation: On artifact status change event; projection consumer issues DEL.
```

#### Artifact IR Cache

```
Key:     venture:{tenant_id}:artifact:{artifact_id}:ir:{version_number}
Type:    String (binary-safe, stores JSON bytes)
TTL:     3600 seconds (1 hour) for draft/review/approved states
         86400 seconds (24 hours) for published state
Purpose: Caches compiled IR JSON for repeat export requests and quality gate re-runs.
Invalidation: Not invalidated on write (IR is immutable per version); TTL-based expiry only.
Max value: 5 MB. Values larger than 5 MB are NOT cached; always fetched from S3.
```

#### Rate Limit Counters

```
Key:     venture:{tenant_id}:ratelimit:{resource}:{window_ts}
Type:    String (integer counter)
TTL:     window_size_seconds + 60 seconds
         window_ts = unix_timestamp rounded down to window boundary
Resources:
    money_auth:     window_size = 60s (per-minute rate limit)
    workflow_create: window_size = 86400s (per-day rate limit)
    artifact_build:  window_size = 86400s (per-day rate limit)
    agent_provision: window_size = 3600s (per-hour rate limit)
Operations:
    INCR venture:{tenant_id}:ratelimit:{resource}:{window_ts}
    EXPIRE venture:{tenant_id}:ratelimit:{resource}:{window_ts} {ttl}
    Both in a Lua script for atomicity.
```

#### Active Policy Cache

```
Key:     venture:{tenant_id}:policy:{workspace_id}:active
Type:    String (JSON bytes)
TTL:     30 seconds
Purpose: Hot-path policy lookup for tool call authorization.
         policy-engine reads this on every tool call check.
Value:   Full serialized PolicyBundle JSON (from SCHEMA_PACK.md).
         If missing: policy-engine falls back to PostgreSQL and refreshes this key.
Invalidation: policy-engine writes new value on policy.activated.v1 event.
              Old value expires naturally via TTL (max 30s stale window).
```

#### Agent Session Keys

```
Key:     venture:{tenant_id}:session:{agent_id}
Type:    Hash
TTL:     900 seconds (15 minutes); refreshed on heartbeat
Fields:
    hmac_key         TEXT (base64-encoded 256-bit HMAC key)
    session_id       TEXT (UUID)
    expires_at       TEXT (ISO-8601)
    agent_role       TEXT
Purpose: Session HMAC key lookup for request signature verification.
         Critical path: every authenticated agent request reads this key.
Invalidation: DEL on session revocation (explicit or freeze-mode trigger).
              EXPIRE reset on heartbeat.
```

#### Idempotency Keys

```
Key:     venture:{tenant_id}:idempotency:{idempotency_key}
Type:    Hash
TTL:     86400 seconds (24 hours)
Fields:
    result_id        TEXT (UUID of the created resource)
    status           TEXT (terminal status)
    created_at       TEXT (ISO-8601)
Purpose: Prevents duplicate processing under at-least-once event delivery.
         Used for money_intents, workflow submissions, and artifact build requests.
Operations:
    HSETNX to set only if not exists (first writer wins).
    HGETALL to check for existing result.
    Both atomic within a single MULTI/EXEC block.
```

#### Workflow State Summary Cache

```
Key:     venture:{tenant_id}:workflow:{workflow_id}:summary
Type:    Hash
TTL:     60 seconds
Fields:
    status           TEXT
    task_count       INT
    tasks_completed  INT
    tasks_failed     INT
    last_event_seq   BIGINT
Purpose: Dashboard and WebSocket push for workflow progress.
         Refreshed by projection consumer on every task state change event.
Invalidation: Written on every task.completed/task.failed event via projection consumer.
```

---

## 8. Migration Strategy

### 8.1 Migration Tool

All schema migrations use `sqlx migrate` (Rust `sqlx` crate). Migration files are stored in `migrations/` at the repository root.

```
migrations/
├── 0001_create_schema.sql
├── 0002_create_tenants_workspaces.sql
├── 0003_create_policy_bundles.sql
├── 0004_create_workflows_tasks.sql
├── 0005_create_saga_compensations.sql
├── 0006_create_agent_identity.sql
├── 0007_create_artifacts.sql
├── 0008_create_event_store.sql
├── 0009_create_audit_log.sql
├── 0010_enable_rls.sql
├── 0011_create_rls_policies.sql
├── 0012_create_indexes.sql
├── 0013_create_event_partitions_2026.sql
├── 0014_create_audit_partitions_2026.sql
├── 0015_treasury_tables.sql             -- Delegated to Track B spec
├── 0016_treasury_rls.sql                -- Delegated to Track B spec
├── 0017_treasury_indexes.sql            -- Delegated to Track B spec
├── 0018_create_functions.sql            -- current_tenant_id(), create_stored_events_partition()
├── 0019_create_pg_cron_jobs.sql         -- Partition maintenance, session cleanup, quota reset
├── 0020_backfill_tasks_tenant_id.sql    -- Backfill tasks.tenant_id from workflows.tenant_id
```

### 8.2 Naming Convention

```
{sequential_number}_{descriptor}.sql

sequential_number: Zero-padded 4 digits starting at 0001.
descriptor:        Snake_case description of what the migration does.
                   Never use "fix_" or "patch_" — these are schema additions or removals, not patches.
```

### 8.3 Zero-Downtime Migration Patterns

The following patterns are mandatory for all schema changes in production. Never apply a migration that takes an `ACCESS EXCLUSIVE` lock on a large table during business hours.

#### Pattern A: Add Nullable Column (safe, no lock)

```sql
-- Step 1: Add column as nullable (no table rewrite, no lock contention)
ALTER TABLE venture.tasks ADD COLUMN tenant_id UUID NULL;

-- Step 2: Backfill in batches to avoid long-running transaction
DO $$
DECLARE
    batch_size INT := 1000;
    last_id    UUID := NULL;
    rows_updated INT;
BEGIN
    LOOP
        UPDATE venture.tasks t
        SET tenant_id = w.tenant_id
        FROM venture.workflows w
        WHERE t.workflow_id = w.id
          AND t.tenant_id IS NULL
          AND (last_id IS NULL OR t.id > last_id)
        LIMIT batch_size
        RETURNING t.id INTO last_id;

        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        EXIT WHEN rows_updated = 0;
        PERFORM pg_sleep(0.01); -- yield between batches
    END LOOP;
END;
$$;

-- Step 3: (Next migration) Add NOT NULL constraint using NOT VALID then VALIDATE
ALTER TABLE venture.tasks ADD CONSTRAINT tasks_tenant_id_not_null
    CHECK (tenant_id IS NOT NULL) NOT VALID;

-- Step 4: (Subsequent migration, after backfill verified) Validate constraint
ALTER TABLE venture.tasks VALIDATE CONSTRAINT tasks_tenant_id_not_null;

-- Step 5: (Final migration) Convert to NOT NULL column definition
ALTER TABLE venture.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE venture.tasks DROP CONSTRAINT tasks_tenant_id_not_null;
```

#### Pattern B: Add Index Concurrently (safe, no blocking lock)

```sql
-- Always use CONCURRENTLY for index creation on existing large tables
CREATE INDEX CONCURRENTLY idx_tasks_tenant_id
    ON venture.tasks (tenant_id);

-- IMPORTANT: CONCURRENTLY cannot run inside a transaction block.
-- sqlx migrate must run this migration as a standalone statement outside a transaction.
-- Add "-- +goose NO TRANSACTION" or equivalent sqlx directive.
```

#### Pattern C: Rename Column (requires two deployments)

```sql
-- Deployment 1: Add new column
ALTER TABLE venture.workflows ADD COLUMN objective_v2 TEXT NULL;

-- Deployment 1: Backfill and dual-write in application
-- Application code writes to both objective and objective_v2

-- Deployment 2: After backfill verified
ALTER TABLE venture.workflows RENAME COLUMN objective TO objective_deprecated;
ALTER TABLE venture.workflows RENAME COLUMN objective_v2 TO objective;

-- Deployment 3: Drop deprecated column
ALTER TABLE venture.workflows DROP COLUMN objective_deprecated;
```

#### Pattern D: Remove Column (requires two deployments)

```sql
-- Deployment 1: Application stops reading/writing the column
-- Deployment 2: Drop the column
ALTER TABLE venture.workflows DROP COLUMN IF EXISTS old_column;
```

### 8.4 Rollback Plan Per Migration

Every migration must have a corresponding down migration file:

```
migrations/
├── 0004_create_workflows_tasks.sql         -- up
├── 0004_create_workflows_tasks.down.sql    -- down (rollback)
```

Down migrations must be idempotent (`DROP TABLE IF EXISTS`, `DROP INDEX IF EXISTS`).

```sql
-- Example: 0004_create_workflows_tasks.down.sql
DROP TABLE IF EXISTS venture.tasks CASCADE;
DROP TABLE IF EXISTS venture.workflows CASCADE;
```

### 8.5 pg_cron Maintenance Jobs

```sql
-- Partition pre-creation: runs on the 1st of each month, creates next 2 months of partitions
SELECT cron.schedule(
    'venture_partition_maintenance',
    '0 0 1 * *',
    $$
    SELECT venture.create_stored_events_partition(now() + INTERVAL '1 month');
    SELECT venture.create_stored_events_partition(now() + INTERVAL '2 months');
    $$
);

-- Expired session cleanup: runs every hour
SELECT cron.schedule(
    'venture_session_cleanup',
    '0 * * * *',
    $$
    UPDATE venture.agent_sessions
    SET revoked_at = now(), revocation_reason = 'expired'
    WHERE expires_at < now() AND revoked_at IS NULL;
    $$
);

-- Daily quota counter reset: runs at 00:00 UTC
SELECT cron.schedule(
    'venture_quota_reset',
    '0 0 * * *',
    $$
    -- Quota counters are tracked in Redis (VENTURE_RATE_LIMITS KV bucket)
    -- This job only logs the reset event to audit_log for compliance tracing.
    INSERT INTO venture.audit_log (
        id, tenant_id, workspace_id, actor_id, actor_type, action,
        resource_type, resource_id, metadata, created_at
    )
    SELECT
        gen_random_uuid(), id, NULL,
        '00000000-0000-0000-0000-000000000000'::UUID, 'system',
        'QUOTA_DAILY_RESET', 'tenant', id,
        jsonb_build_object('reset_at', now()::TEXT),
        now()
    FROM venture.tenants
    WHERE suspended_at IS NULL;
    $$
);
```

---

## 9. Connection Pool Configuration

### 9.1 Primary Database Pool (sqlx PgPool)

```rust
// Configuration for all application services connecting to the primary PostgreSQL instance

use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> Result<sqlx::PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .after_connect(|conn, _meta| Box::pin(async move {
            // Set session-level configuration for all connections
            sqlx::query("SET search_path = venture, public")
                .execute(conn)
                .await?;
            // Ensure RLS is active (paranoia check)
            sqlx::query("SET row_security = on")
                .execute(conn)
                .await?;
            Ok(())
        }))
        .connect(database_url)
        .await
}
```

**Per-service pool sizes:**

| Service | max_connections | min_connections | Notes |
|---------|----------------|----------------|-------|
| policy-engine | 20 | 4 | High-frequency; every tool call checks policy |
| treasury-api | 10 | 2 | Lower volume; authorization decisions |
| artifact-compiler | 10 | 2 | Batch workload; large payloads |
| venture-orchestrator | 15 | 3 | Workflow dispatch and monitoring |
| compliance-engine | 5 | 1 | Background processing |
| control-plane-api | 10 | 2 | Founder-facing API |

**Total maximum connections to primary: 70.** PostgreSQL `max_connections` must be set to at least 90 (70 + 20 overhead for replicas, migrations, and DBA connections).

### 9.2 Read Replica Pool (CQRS Read Model)

```rust
// Read replica pool for CQRS read-side queries.
// Routes: SELECT queries on projection tables (workflows, tasks, artifacts, etc.)
// Does NOT route: writes, serializable transactions, or queries with FOR UPDATE/FOR SHARE

pub async fn create_read_replica_pool(replica_url: &str) -> Result<sqlx::PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(30)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(3600))
        .after_connect(|conn, _meta| Box::pin(async move {
            sqlx::query("SET search_path = venture, public")
                .execute(conn)
                .await?;
            sqlx::query("SET default_transaction_read_only = on")
                .execute(conn)
                .await?;
            Ok(())
        }))
        .connect(replica_url)
        .await
}
```

### 9.3 Connection Routing Rules

```rust
pub enum QueryTarget {
    Primary,
    Replica,
}

pub fn route_query(query_type: &QueryType) -> QueryTarget {
    match query_type {
        // Writes always go to primary
        QueryType::Insert | QueryType::Update | QueryType::Delete => QueryTarget::Primary,
        // Serializable transactions to primary
        QueryType::SerializableTransaction => QueryTarget::Primary,
        // Event store appends to primary
        QueryType::EventAppend => QueryTarget::Primary,
        // CQRS read projections to replica
        QueryType::ProjectionRead => QueryTarget::Replica,
        // Analytics and reporting to replica
        QueryType::Analytics => QueryTarget::Replica,
        // Audit log export to replica
        QueryType::AuditExport => QueryTarget::Replica,
        // Policy bundle reads to primary (consistency requirement)
        QueryType::PolicyRead => QueryTarget::Primary,
    }
}
```

### 9.4 Statement Timeout

All queries run with a statement timeout to prevent runaway queries from holding connections:

```sql
-- Set per-connection in after_connect hook
SET statement_timeout = '30s';           -- Default: 30 seconds
SET lock_timeout = '5s';                 -- Lock acquisition timeout: 5 seconds
SET idle_in_transaction_session_timeout = '60s'; -- Kill idle-in-transaction sessions
```

---

## 10. Data Retention and GDPR

### 10.1 Retention Policy Summary

| Data Category | Store | Retention | Rationale |
|--------------|-------|-----------|-----------|
| Compliance events (authorization decisions, compliance cases) | PostgreSQL + S3 | 7 years | Financial regulation (SOX, PSD2) |
| Audit log | PostgreSQL + S3 | 7 years | Regulatory audit trail |
| Workflow events | PostgreSQL (stored_events) | 90 days | Operational debugging |
| Artifact blobs | S3 (venture-artifacts) | 90 days after workflow completion | Storage cost; compliance copy in audit |
| Agent tool calls | PostgreSQL | 365 days | Security forensics |
| Session tokens | Redis | 15 minutes (TTL) | Security; ephemeral by design |
| Event snapshots | S3 (venture-snapshots) | 90 days | Operational; re-derivable from events |
| PII in event payloads | PostgreSQL (stored_events) | Anonymized after 30 days | GDPR Article 17 |
| GDPR erasure requests | PostgreSQL (privacy_requests) | 7 years (request record); PII scrubbed | GDPR Article 30 |

### 10.2 Retention Enforcement

#### Automated Partition Drop (Workflow Events)

PostgreSQL stored_events partitions containing workflow events older than 90 days are dropped. Compliance event partitions are never dropped within the 7-year window.

```sql
-- pg_cron job: drop expired workflow event partitions (runs monthly)
-- This is a Ventrue-internal discriminator: compliance events are in dedicated streams.
-- Workflow event partitions are tagged in a partition_registry table.
CREATE TABLE venture.partition_registry (
    partition_name      TEXT        PRIMARY KEY,
    parent_table        TEXT        NOT NULL,
    partition_start     TIMESTAMPTZ NOT NULL,
    partition_end       TIMESTAMPTZ NOT NULL,
    category            TEXT        NOT NULL CHECK (category IN ('workflow', 'compliance', 'audit')),
    drop_eligible_at    TIMESTAMPTZ NOT NULL
);

-- Drop function
CREATE OR REPLACE FUNCTION venture.drop_expired_workflow_partitions()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT partition_name
        FROM venture.partition_registry
        WHERE category = 'workflow'
          AND drop_eligible_at < now()
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS venture.%I', rec.partition_name);
        DELETE FROM venture.partition_registry WHERE partition_name = rec.partition_name;

        INSERT INTO venture.audit_log (
            id, tenant_id, workspace_id, actor_id, actor_type, action,
            resource_type, resource_id, metadata, created_at
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000001'::UUID, -- system tenant
            NULL,
            '00000000-0000-0000-0000-000000000000'::UUID, -- system actor
            'system', 'PARTITION_DROPPED', 'stored_events_partition',
            gen_random_uuid(),
            jsonb_build_object('partition_name', rec.partition_name),
            now()
        );
    END LOOP;
END;
$$;
```

### 10.3 GDPR Erasure — PII Scrubbing Job

GDPR erasure requests are submitted via the compliance-engine `/v1/privacy/erasure` endpoint and stored in `venture.privacy_requests` (Track B Section 8). The scrubbing job runs daily.

```sql
-- PII scrubbing: anonymize citizen_id references in stored_events payload
-- "citizen_id" fields in event payloads are replaced with SHA-256 hashes after 30 days
-- This preserves event chain integrity while removing identifiable information

CREATE OR REPLACE FUNCTION venture.scrub_pii_in_events(subject_ref TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    scrubbed_count INTEGER := 0;
    anon_ref TEXT;
BEGIN
    -- Compute anonymized reference (SHA-256 hex of subject_ref + venture salt)
    anon_ref := encode(
        digest(subject_ref || current_setting('venture.pii_salt'), 'sha256'),
        'hex'
    );

    -- Update stored_events payload: replace citizen_id with hashed value
    -- This updates only the payload JSONB field, not the causal_hash (by design:
    -- the causal_hash covers the envelope metadata, not the payload content)
    UPDATE venture.stored_events
    SET payload = jsonb_set(
            payload,
            '{citizen_id}',
            to_jsonb(anon_ref),
            false
        )
    WHERE payload ? 'citizen_id'
      AND payload->>'citizen_id' = subject_ref
      AND emitted_at < now() - INTERVAL '30 days';

    GET DIAGNOSTICS scrubbed_count = ROW_COUNT;
    RETURN scrubbed_count;
END;
$$;

COMMENT ON FUNCTION venture.scrub_pii_in_events IS
    'Anonymizes citizen_id references in stored_events payloads. '
    'Called by the compliance-engine GDPR erasure handler for each erasure request. '
    'SHA-256 hash preserves referential consistency for analytics without storing PII. '
    'Only events older than 30 days are scrubbed (recent events may be in active workflows).';
```

### 10.4 Analytics Export Anonymization

When exporting data to ClickHouse for analytics, citizen-identifying fields are replaced with deterministic SHA-256 hashes:

```python
import hashlib

VENTURE_ANALYTICS_SALT = settings.ANALYTICS_ANONYMIZATION_SALT  # from environment

def anonymize_for_analytics(citizen_id: str) -> str:
    """
    Replace citizen_id with a deterministic, one-way hash for analytics exports.
    The hash is consistent within a tenant but cannot be reversed to the original ID.
    """
    raw = f"{citizen_id}:{VENTURE_ANALYTICS_SALT}"
    return hashlib.sha256(raw.encode()).hexdigest()
```

### 10.5 Right to Erasure — Full Procedure

When a GDPR erasure request is received (`privacy_requests.request_type = 'erasure'`):

1. Scrub `citizen_id` from `stored_events` payloads (scrub_pii_in_events).
2. Scrub `subject_ref` from `privacy_requests` row (replace with anonymized hash).
3. Delete any artifacts whose `spec_id` references the subject (if subject is an artifact requester).
4. Delete any audit_log entries containing PII in `metadata` (replace PII values with hashed equivalents).
5. Record completion in `privacy_requests.completed_at` and emit `privacy.erasure.completed.v1` event.
6. Write audit log entry `GDPR_ERASURE_COMPLETED` with `resource_id = privacy_requests.id`.

Steps 1-5 run within a single database transaction. Step 6 is written after commit. If the transaction fails, the `privacy_requests.status` is set to `failed` and an alert is raised.

---

## 11. CQRS Projection Definitions

Projections are built by consuming events from NATS JetStream and updating the corresponding PostgreSQL projection tables. The projection consumer is the `venture-projector` service.

### 11.1 Projection Consumer Configuration

```
Consumer name:    venture-projector
Durable:          true
Deliver policy:   DeliverAll (replay from first event on startup if projection lags)
Ack policy:       AckExplicit
Max ack pending:  500
Ack wait:         30 seconds
Filter subjects:  venture.*.*.workflow.events, venture.*.*.task.events,
                  venture.*.*.artifact.events, venture.*.*.agent.events
Replay policy:    ReplayInstant
Flow control:     true
Heartbeat:        30 seconds
```

### 11.2 Event-to-Projection Mapping

| Event Type | Projection Table | Action |
|------------|-----------------|--------|
| `workflow.started.v1` | `workflows` | INSERT with status=running, started_at=event.created_at |
| `workflow.completed.v1` | `workflows` | UPDATE status=completed, completed_at, last_event_seq |
| `workflow.failed.v1` | `workflows` | UPDATE status=failed, error, last_event_seq |
| `workflow.cancelled.v1` | `workflows` | UPDATE status=cancelled, cancelled_at, last_event_seq |
| `task.dispatched.v1` | `tasks` | INSERT with status=dispatched |
| `task.started.v1` | `tasks` | UPDATE status=running, started_at, last_event_seq |
| `task.completed.v1` | `tasks` | UPDATE status=completed, output_hash, completed_at, last_event_seq |
| `task.failed.v1` | `tasks` | UPDATE status=failed, last_event_seq |
| `task.tool_call.allowed.v1` | `agent_tool_calls` | INSERT with allowed=true |
| `task.tool_call.denied.v1` | `agent_tool_calls` | INSERT with allowed=false |
| `agent.session.created.v1` | `agent_sessions` | INSERT |
| `agent.session.revoked.v1` | `agent_sessions` | UPDATE revoked_at, revocation_reason |
| `artifact.build.started.v1` | `artifacts` | UPDATE status=building |
| `artifact.build.completed.v1` | `artifacts`, `artifact_versions` | UPDATE artifact status=built; INSERT version |
| `artifact.build.failed.v1` | `artifacts` | UPDATE status=failed |
| `artifact.promoted.v1` | `artifact_versions` | UPDATE promotion_state, promoted_by, promoted_at |
| `export.job.completed.v1` | `export_jobs` | UPDATE status, output_url, output_hash, quality_passed |
| `policy.activated.v1` | `policy_bundles` | UPDATE status=active, activated_at; invalidate Redis |

### 11.3 Projection Idempotency

All projection writes are idempotent. The projection consumer uses `last_event_seq` to detect and skip already-applied events:

```sql
-- Example: idempotent workflow status update
UPDATE venture.workflows
SET status = $1,
    completed_at = $2,
    last_event_seq = $3
WHERE id = $4
  AND last_event_seq < $3;  -- Only apply if this is a newer event
```

---

## 12. Schema Invariants and Constraint Summary

The following invariants are enforced at the database layer and must never be violated by application code:

| # | Invariant | Enforcement |
|---|-----------|------------|
| I-01 | Every stored_event has a unique (stream_name, stream_seq) | UNIQUE constraint |
| I-02 | policy_bundles: only one active bundle per (tenant_id, workspace_id) | Partial UNIQUE index on status='active' |
| I-03 | artifact_versions: version_number is unique per artifact | UNIQUE (artifact_id, version_number) |
| I-04 | agent_identities: key_fingerprint is globally unique | UNIQUE constraint |
| I-05 | agent_sessions: HMAC key hash is 32 bytes | CHECK constraint |
| I-06 | tasks.retries is between 0 and 5 | CHECK constraint |
| I-07 | workflows: completed_at and cancelled_at are mutually exclusive | CHECK constraint |
| I-08 | quality_reports.build_id is globally unique | UNIQUE constraint |
| I-09 | audit_log: never DELETE, never UPDATE | Role permissions (DELETE not granted to app_role) |
| I-10 | stored_events: never DELETE, never UPDATE | Role permissions (DELETE not granted to app_role) |
| I-11 | content_hash and ir_hash are exactly 32 bytes | CHECK constraints |
| I-12 | policy_bundles.activated_at is non-null when status='active' | CHECK constraint |
| I-13 | artifact_versions: promoted_by and promoted_at required for approved/published states | CHECK constraint |
| I-14 | saga_compensations.idempotency_key is globally unique | UNIQUE constraint |
| I-15 | tenant_id is never NULL on any tenant-scoped table | NOT NULL constraints |
| I-16 | All TIMESTAMPTZ columns store UTC | Enforced by session timezone setting: SET timezone = 'UTC' |
| I-17 | tasks.parent_task_id cannot reference self | CHECK (id <> parent_task_id) |
| I-18 | prompt_injection_detections: confidence_score between 0 and 1 | CHECK constraint |
| I-19 | quality_reports.checks must be a JSON array | CHECK (jsonb_typeof(checks) = 'array') |
| I-20 | agent_tool_calls: denied calls must have denial_reason | CHECK (allowed = true OR denial_reason IS NOT NULL) |

---

## 13. Appendix A — Enum Value Sets

### workflow.status

```
pending      Initial state; not yet started
running      Execution in progress
paused       Execution paused by policy engine or founder kill-switch
completed    Successful terminal state
failed       Error terminal state
cancelled    Explicitly cancelled (founder revoke or saga compensation)
timed_out    Execution exceeded ttl_seconds
```

### task.status

```
pending      Created, waiting for dispatch
dispatched   Sent to agent runtime; not yet acknowledged
running      Agent runtime is executing
completed    Successful terminal state
failed       Error terminal state
cancelled    Explicitly cancelled
timed_out    Task exceeded its ttl_seconds
compensating Saga compensation in progress for this task
```

### policy_bundle.status

```
draft        Created but not activated; cannot be used for decisions
active       Currently active for a workspace; used for all decisions
deprecated   Superseded by a newer bundle; no longer used for decisions
```

### artifact_version.promotion_state

```
draft        Initial state; quality gate not yet run
review       Quality gate passed; awaiting promotion approval
approved     Approved by policy engine or founder; ready for publishing
published    Externally published to a surface; immutable
deprecated   Superseded by newer version; no longer served
```

### agent_identity.status

```
active         Provisioned and accepting sessions
suspended      Temporarily disabled; cannot create new sessions
deprovisioned  Permanently disabled; all sessions revoked
```

### saga_compensation.status

```
pending      Not yet attempted
in_progress  Currently executing
completed    Successfully compensated
failed       Compensation failed; requires manual intervention
skipped      Side effect did not occur; compensation not needed
```

### ir_type

```
slide_spec       Presentation deck (python-pptx renderer)
doc_spec         Document (WeasyPrint renderer)
timeline_spec    Video timeline (FFmpeg renderer)
audio_spec       Audio track (FFmpeg renderer)
board_spec       Kanban/project board (SVG/HTML renderer)
data_spec        Spreadsheet/dataset (openpyxl renderer)
composite_spec   Multi-format composite artifact
```

---

## 14. Appendix B — Cross-Reference Table

This table maps each entity in this spec to the Track or spec that provides its Pydantic/application-layer schema.

| PostgreSQL Table | Application Schema | Defined In |
|-----------------|-------------------|-----------|
| `policy_bundles` | `PolicyBundle` | `SCHEMA_PACK.md` Section 3 |
| `workflows` | Internal projection | `TRACK_C_CONTROL_PLANE.md` Section 3 |
| `tasks` | `TaskEnvelopeV1` | `TRACK_C_CONTROL_PLANE.md` Section 2 |
| `agent_identities` | `AgentIdentity` | `TRACK_C_CONTROL_PLANE.md` Section 4 |
| `agent_sessions` | `AgentSession` | `TRACK_C_CONTROL_PLANE.md` Section 4 |
| `agent_tool_calls` | `ToolCallRecord` | `TRACK_C_CONTROL_PLANE.md` Section 5 |
| `stored_events` | `EventEnvelopeV1` | `TRACK_C_CONTROL_PLANE.md` Section 1 |
| `artifacts` | `IRBase` subclasses | `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` Section 2 |
| `artifact_versions` | `ArtifactVersion` | `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` Section 3 |
| `quality_reports` | `QualityReport` | `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` Section 4 |
| `money_intents` | `MoneyIntent` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` Section 2 |
| `authorization_decisions` | `AuthorizationDecision` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` Section 3 |
| `ledger_entries` | `LedgerEntry` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` Section 4 |
| `compliance_cases` | `ComplianceCase` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` Section 7 |
| `privacy_requests` | `PrivacyRequest` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` Section 8 |
| `audit_log` | `AuditLogEntry` | `API_EVENTS_SPEC.md` Section 6 |

---

*End of DATA_MODEL_DB_SPEC.md*
*Spec ID: SPEC-DATA-MODEL-001 | Version: 1.0.0 | Date: 2026-02-21*
