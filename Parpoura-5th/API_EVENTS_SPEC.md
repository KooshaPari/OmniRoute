# Venture-Autonomy API and Events Specification

**Spec ID:** SPEC-API-EVENTS-001
**Version:** 2.0.0
**Status:** ACTIVE
**Date:** 2026-02-21
**Owner:** Venture Platform Engineering

**Related Specs:**
- `TECHNICAL_SPEC.md` — System architecture, service inventory, stack overview
- `SCHEMA_PACK.md` — Core event envelope and task envelope Pydantic schemas
- `DATA_MODEL_DB_SPEC.md` — PostgreSQL DDL, projections, audit tables
- `OPS_COMPLIANCE_SPEC.md` — Compliance operations, OFAC, PAN detection
- `ARTIFACT_COMPILER_SPEC.md` — Artifact IR type system, render pipeline
- `FUNCTIONAL_REQUIREMENTS.md` — FR SHALL statements, traceability

---

## Table of Contents

1. Overview
2. Transport Architecture
3. HTTP REST API
   - 3.1 Authentication Endpoints
   - 3.2 Workspace Endpoints
   - 3.3 Workflow Endpoints
   - 3.4 Artifact Endpoints
   - 3.5 Treasury Endpoints
   - 3.6 Compliance Endpoints
   - 3.7 WebSocket Streaming Endpoints
4. OpenAPI Schema — Pydantic v2 Models
   - 4.1 Shared Primitive Types
   - 4.2 Auth Models
   - 4.3 Workspace Models
   - 4.4 Workflow Models
   - 4.5 Artifact Models
   - 4.6 Treasury Models
   - 4.7 Compliance Models
   - 4.8 Event Envelope Model
5. NATS JetStream Configuration
   - 5.1 Stream Definitions
   - 5.2 Consumer Patterns
   - 5.3 Key-Value Stores
6. Event Catalog
   - 6.1 VENTURE_WORKFLOW Stream
   - 6.2 VENTURE_ARTIFACT Stream
   - 6.3 VENTURE_MONEY Stream
   - 6.4 VENTURE_AGENT Stream
   - 6.5 VENTURE_COMPLIANCE Stream
7. Event Versioning Strategy
8. Idempotency
9. Rate Limiting
10. Error Code Catalog
11. SDK Examples
    - 11.1 Python SDK
    - 11.2 TypeScript SDK
12. Sequence Diagrams
13. Appendix A — Full JSON Schema Registry

---

## 1. Overview

Venture is an event-sourced autonomous AI economic platform. Every agent action, financial transaction, and compliance check is immutable and auditable. This specification governs all API contracts (HTTP + WebSocket) and internal event bus contracts (NATS JetStream).

### 1.1 Design Principles

- **Event-First**: All state mutation flows through events. HTTP endpoints are event emitters, not state mutators.
- **Immutable Audit Trail**: Every event carries `prev_hash` (BLAKE3) forming a tamper-evident hash chain.
- **Policy-Gated**: Every workflow submission, money intent, and artifact render is validated against the active policy bundle before execution.
- **Fail Fast**: No silent degradation. All validation failures return explicit error codes. All events missing required fields are rejected at ingest.
- **Idempotent POST**: All POST endpoints accept `Idempotency-Key` header. Duplicate submissions within 24h return the cached response.

### 1.2 System Ports

| Service                  | Port  | Protocol          |
|--------------------------|-------|-------------------|
| control-plane-api        | 8000  | HTTP + WebSocket  |
| policy-engine            | 8001  | HTTP (internal)   |
| artifact-compiler        | 8002  | HTTP (internal)   |
| treasury-api             | 8003  | HTTP (internal)   |
| compliance-engine        | 8004  | HTTP (internal)   |
| venture-orchestrator     | 8005  | HTTP (internal)   |
| NATS JetStream           | 4222  | NATS (TCP)        |
| NATS monitoring          | 8222  | HTTP              |
| PostgreSQL               | 5432  | PostgreSQL wire   |
| Redis                    | 6379  | Redis wire        |

All external client traffic routes through `control-plane-api:8000`. Internal service-to-service calls use service names and internal ports directly; they are not exposed to external clients.

### 1.3 API Versioning

All REST endpoints are prefixed `/v1/`. Breaking changes increment to `/v2/`. Minor additions (new optional fields, new endpoints) are non-breaking and do not require a version bump. The `API-Version` response header always echoes the resolved version.

---

## 2. Transport Architecture

### 2.1 HTTP REST

FastAPI application at `control-plane-api:8000`. All endpoints return `application/json`. Request bodies are `application/json` unless noted.

**Authentication:** Bearer JWT in `Authorization` header. JWTs are short-lived (15 min). Clients refresh with `/v1/auth/refresh`. All endpoints except `/v1/auth/token` and `/v1/health` require a valid JWT.

**Tracing:** Each request assigns a `trace_id` (UUIDv4) at the gateway. Propagated to all downstream services via `X-Trace-Id` header. Returned in all response bodies as `trace_id`.

### 2.2 WebSocket Streaming

FastAPI WebSocket endpoints provide real-time event streaming per workflow or per agent. Connections are authenticated via `?token=<jwt>` query parameter (Bearer header not available in WebSocket handshake). Messages are newline-delimited JSON, one `EventEnvelopeV1` per line.

### 2.3 NATS JetStream Internal Bus

All internal services publish and consume events via NATS JetStream. Subject naming convention: `venture.<domain>.<event_name>.<version>` where version is `v1`, `v2`, etc.

Five canonical streams partition the event space:

| Stream              | Subject Filter         | Retention | Replicas |
|---------------------|------------------------|-----------|----------|
| VENTURE_WORKFLOW    | `venture.workflow.>`   | interest  | 3        |
| VENTURE_ARTIFACT    | `venture.artifact.>`   | interest  | 3        |
| VENTURE_MONEY       | `venture.money.>`      | limits    | 3        |
| VENTURE_AGENT       | `venture.agent.>`      | interest  | 3        |
| VENTURE_COMPLIANCE  | `venture.compliance.>` | limits    | 3        |

---

## 3. HTTP REST API

### Global Request / Response Conventions

**Request headers (all endpoints):**

| Header            | Required | Description                                              |
|-------------------|----------|----------------------------------------------------------|
| Authorization     | Yes*     | `Bearer <jwt>` (* except /auth/token, /health)           |
| Content-Type      | Yes      | `application/json`                                       |
| Idempotency-Key   | Optional | UUID; enables idempotent POST operations                 |
| X-Workspace-Id    | Optional | Override workspace scoping (admins only)                 |
| X-Request-Id      | Optional | Client-supplied request ID echoed in response            |

**Response headers (all endpoints):**

| Header                   | Description                                   |
|--------------------------|-----------------------------------------------|
| X-Trace-Id               | Distributed trace ID                          |
| X-Request-Id             | Echoed from request or server-generated       |
| API-Version              | Resolved API version (e.g., "v1")             |
| X-RateLimit-Limit        | Request limit for the current window          |
| X-RateLimit-Remaining    | Requests remaining in current window          |
| X-RateLimit-Reset        | Unix timestamp when window resets             |

**Standard error response body:**

```json
{
  "error_code": "VENTURE_E012",
  "error_message": "Workflow budget cap exceeds workspace limit",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "details": {
    "field": "budget_cap_eau",
    "submitted_value": 50000,
    "workspace_limit": 10000
  }
}
```

---

### 3.1 Authentication Endpoints

#### POST /v1/auth/token

Issue a JWT access token using client credentials.

**Request body:**

```json
{
  "client_id": "wks_01HX4BGJKT...",
  "client_secret": "sec_..."
}
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "refresh_token": "rft_...",
  "scope": "workflow:write artifact:write money:read compliance:read",
  "workspace_id": "wks_01HX4BGJKT...",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Error Code    | Condition                              |
|--------|---------------|----------------------------------------|
| 400    | VENTURE_E001  | Missing or malformed client_id/secret  |
| 401    | VENTURE_E002  | Invalid credentials                    |
| 403    | VENTURE_E003  | Workspace frozen; no new tokens issued |
| 429    | VENTURE_E040  | Token issuance rate limit exceeded     |

**Notes:** Tokens are EdDSA-signed (Ed25519). The `jti` claim is stored in Redis for revocation lookup. Token lifetime is 900 seconds (15 minutes).

---

#### POST /v1/auth/refresh

Refresh an access token using a refresh token.

**Request body:**

```json
{
  "refresh_token": "rft_..."
}
```

**Response 200:** Same shape as `POST /v1/auth/token`.

**Errors:**

| Status | Error Code    | Condition                              |
|--------|---------------|----------------------------------------|
| 401    | VENTURE_E004  | Refresh token invalid or expired       |
| 401    | VENTURE_E005  | Refresh token revoked                  |

---

#### DELETE /v1/auth/token

Revoke the currently authenticated access token (and its refresh token).

**Request body:** None.

**Response 204:** No content.

**Notes:** Adds `jti` to Redis revocation set. Refresh token is also revoked. All active WebSocket connections for this token are closed within 30 seconds.

---

### 3.2 Workspace Endpoints

#### POST /v1/workspaces

Create a new workspace. Only callable by platform admin role.

**Request body:**

```json
{
  "display_name": "Acme Corp",
  "owner_user_id": "usr_01HX4BGJKT...",
  "budget_cap_cents": 1000000,
  "budget_currency": "USD",
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "metadata": {
    "tier": "enterprise",
    "region": "us-east-1"
  }
}
```

**Response 201:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "display_name": "Acme Corp",
  "status": "active",
  "budget_cap_cents": 1000000,
  "budget_consumed_cents": 0,
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "created_at": "2026-02-21T10:30:00Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Error Code    | Condition                                  |
|--------|---------------|--------------------------------------------|
| 400    | VENTURE_E006  | Invalid budget_cap_cents (must be >= 100)  |
| 400    | VENTURE_E007  | Policy bundle not found                    |
| 403    | VENTURE_E008  | Caller lacks admin role                    |
| 409    | VENTURE_E009  | Idempotency key collision (see Section 8)  |

---

#### GET /v1/workspaces/{workspace_id}

Retrieve workspace details.

**Path parameters:**

| Parameter     | Type   | Description        |
|---------------|--------|--------------------|
| workspace_id  | string | Workspace UUIDv7   |

**Response 200:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "display_name": "Acme Corp",
  "status": "active",
  "budget_cap_cents": 1000000,
  "budget_consumed_cents": 342100,
  "budget_remaining_cents": 657900,
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "freeze_reason": null,
  "active_workflow_count": 3,
  "active_agent_count": 12,
  "created_at": "2026-02-21T10:30:00Z",
  "updated_at": "2026-02-21T14:22:11Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Error Code    | Condition              |
|--------|---------------|------------------------|
| 404    | VENTURE_E010  | Workspace not found    |
| 403    | VENTURE_E011  | Access denied          |

---

#### GET /v1/workspaces/{workspace_id}/budget

Retrieve budget summary with velocity windows.

**Response 200:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "budget_cap_cents": 1000000,
  "budget_consumed_cents": 342100,
  "budget_remaining_cents": 657900,
  "velocity_windows": {
    "per_minute_limit_cents": 5000,
    "per_minute_consumed_cents": 120,
    "per_hour_limit_cents": 100000,
    "per_hour_consumed_cents": 8900,
    "per_day_limit_cents": 500000,
    "per_day_consumed_cents": 342100
  },
  "last_transaction_at": "2026-02-21T14:22:11Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### PATCH /v1/workspaces/{workspace_id}/freeze

Freeze or unfreeze a workspace. Freezing immediately revokes all pending money intents and blocks new workflow submissions.

**Request body:**

```json
{
  "frozen": true,
  "reason": "Suspicious velocity pattern detected by compliance engine"
}
```

**Response 200:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "status": "frozen",
  "freeze_reason": "Suspicious velocity pattern detected by compliance engine",
  "frozen_at": "2026-02-21T14:25:00Z",
  "intents_revoked_count": 4,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `compliance.workspace.frozen.v1` or `compliance.workspace.unfrozen.v1`

---

#### GET /v1/workspaces/{workspace_id}/agents

List active agent sessions within a workspace.

**Query parameters:**

| Parameter | Type    | Default | Description                          |
|-----------|---------|---------|--------------------------------------|
| status    | string  | active  | Filter: active, idle, terminated     |
| limit     | integer | 50      | Max results (max 200)                |
| cursor    | string  | null    | Pagination cursor                    |

**Response 200:**

```json
{
  "agents": [
    {
      "agent_id": "agt_01HX4BGJKT...",
      "agent_type": "L2_specialist",
      "status": "active",
      "task_id": "tsk_01HX4BGJKT...",
      "workflow_id": "wfl_01HX4BGJKT...",
      "progress_pct": 42,
      "eau_consumed": 1240,
      "eau_cap": 5000,
      "session_started_at": "2026-02-21T14:00:00Z",
      "last_heartbeat_at": "2026-02-21T14:24:55Z"
    }
  ],
  "next_cursor": "cur_abc123",
  "total_count": 12,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3.3 Workflow Endpoints

#### POST /v1/workflows

Submit a new workflow for execution. The workflow spec is validated against the active policy bundle before acceptance.

**Request body:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "display_name": "Q1 Market Research Workflow",
  "budget_cap_eau": 10000,
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "priority": "normal",
  "tasks": [
    {
      "task_id": "t1",
      "task_type": "research",
      "description": "Gather competitor pricing data",
      "tool_allowlist": ["web_search", "scrape_url"],
      "eau_budget": 2000,
      "depends_on": [],
      "timeout_seconds": 300,
      "retry_policy": {
        "max_retries": 3,
        "backoff_base_seconds": 5,
        "backoff_multiplier": 2.0
      }
    },
    {
      "task_id": "t2",
      "task_type": "synthesis",
      "description": "Synthesize findings into structured report",
      "tool_allowlist": ["artifact_compile"],
      "eau_budget": 3000,
      "depends_on": ["t1"],
      "timeout_seconds": 600,
      "retry_policy": {
        "max_retries": 2,
        "backoff_base_seconds": 10,
        "backoff_multiplier": 2.0
      }
    }
  ],
  "saga_config": {
    "compensation_enabled": true,
    "rollback_on_partial_failure": true
  },
  "metadata": {
    "requester": "founder_ui",
    "project_tag": "q1-research"
  }
}
```

**Response 202:**

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "status": "submitted",
  "spec_hash": "blake3:a3f4c2...",
  "task_count": 2,
  "budget_cap_eau": 10000,
  "estimated_start_at": "2026-02-21T14:26:00Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Error Code    | Condition                                            |
|--------|---------------|------------------------------------------------------|
| 400    | VENTURE_E012  | Workflow spec fails schema validation                |
| 400    | VENTURE_E013  | Task DAG contains a cycle                            |
| 400    | VENTURE_E014  | budget_cap_eau exceeds workspace remaining budget    |
| 403    | VENTURE_E015  | Workspace is frozen                                  |
| 403    | VENTURE_E016  | Policy bundle mismatch — bundle_id not active        |
| 422    | VENTURE_E017  | Task tool_allowlist contains forbidden tool          |
| 429    | VENTURE_E041  | Workflow submission rate limit exceeded (10/min)     |

**Events emitted:** `workflow.submitted.v1`

**Rate limit:** 10 requests per minute per workspace.

---

#### GET /v1/workflows/{workflow_id}

Retrieve workflow status and execution summary.

**Response 200:**

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "display_name": "Q1 Market Research Workflow",
  "status": "running",
  "spec_hash": "blake3:a3f4c2...",
  "budget_cap_eau": 10000,
  "eau_consumed": 3240,
  "task_count": 2,
  "tasks_completed": 1,
  "tasks_failed": 0,
  "tasks_running": 1,
  "tasks_pending": 0,
  "submitted_at": "2026-02-21T14:25:00Z",
  "started_at": "2026-02-21T14:25:02Z",
  "completed_at": null,
  "estimated_completion_at": "2026-02-21T14:30:00Z",
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "saga_state": "running",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status values:** `submitted`, `running`, `completed`, `failed`, `cancelled`, `compensating`

---

#### GET /v1/workflows/{workflow_id}/events

List events associated with a workflow, paginated.

**Query parameters:**

| Parameter   | Type    | Default | Description                                       |
|-------------|---------|---------|---------------------------------------------------|
| limit       | integer | 50      | Max events per page (max 500)                     |
| cursor      | string  | null    | Pagination cursor (opaque)                        |
| event_type  | string  | null    | Filter by event type (e.g., workflow.task.failed) |
| after       | string  | null    | ISO-8601 timestamp; return events after this time |

**Response 200:**

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "events": [
    {
      "event_id": "evt_01HX4BGJKT...",
      "event_type": "workflow.submitted.v1",
      "seq": 1,
      "created_at": "2026-02-21T14:25:00.123Z",
      "payload": { "budget_cap_eau": 10000, "task_count": 2 }
    },
    {
      "event_id": "evt_01HX4BGJKZ...",
      "event_type": "workflow.task.started.v1",
      "seq": 2,
      "created_at": "2026-02-21T14:25:02.001Z",
      "payload": { "task_id": "t1", "agent_id": "agt_01HX4BGJKT..." }
    }
  ],
  "next_cursor": "cur_def456",
  "total_count": 8,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### POST /v1/workflows/{workflow_id}/cancel

Cancel an in-flight workflow. Triggers saga compensation if `saga_config.compensation_enabled` is true.

**Request body:**

```json
{
  "reason": "Requester abort — budget reallocation"
}
```

**Response 200:**

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "status": "cancelled",
  "cancelled_at": "2026-02-21T14:28:00Z",
  "compensation_triggered": true,
  "compensation_steps": ["revoke_intents", "release_agent_sessions"],
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `workflow.cancelled.v1`, optionally `workflow.saga.compensating.v1`

---

#### GET /v1/workflows

List workflows with filtering.

**Query parameters:**

| Parameter      | Type    | Default | Description                                              |
|----------------|---------|---------|----------------------------------------------------------|
| workspace_id   | string  | (jwt)   | Filter by workspace                                      |
| status         | string  | null    | Filter: submitted, running, completed, failed, cancelled |
| created_after  | string  | null    | ISO-8601 timestamp                                       |
| created_before | string  | null    | ISO-8601 timestamp                                       |
| limit          | integer | 50      | Max results (max 200)                                    |
| cursor         | string  | null    | Pagination cursor                                        |

**Response 200:**

```json
{
  "workflows": [
    {
      "workflow_id": "wfl_01HX4BGJKT...",
      "display_name": "Q1 Market Research Workflow",
      "status": "completed",
      "task_count": 2,
      "eau_consumed": 5120,
      "submitted_at": "2026-02-21T14:25:00Z",
      "completed_at": "2026-02-21T14:32:10Z"
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3.4 Artifact Endpoints

#### POST /v1/artifacts

Submit an artifact render request. The artifact spec is validated by the artifact-compiler IR validator before acceptance.

**Request body:**

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "spec_type": "slide_deck",
  "spec": {
    "title": "Q1 Competitive Analysis",
    "slides": [
      {
        "slide_id": "s1",
        "layout": "title_body",
        "title": "Executive Summary",
        "body": "Market analysis reveals three primary competitors..."
      }
    ],
    "theme": "venture_default",
    "output_format": "pptx"
  },
  "quality_checks": ["spell_check", "brand_compliance", "accessibility"],
  "priority": "normal"
}
```

**Response 202:**

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "status": "queued",
  "spec_type": "slide_deck",
  "ir_hash": "blake3:f3a2b1...",
  "estimated_render_seconds": 45,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `artifact.spec_validated.v1`

**Spec types supported:** `slide_deck`, `document`, `timeline`, `audio_clip`, `board_summary`, `data_report`

---

#### GET /v1/artifacts/{artifact_id}

Retrieve artifact status and metadata.

**Response 200:**

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "spec_type": "slide_deck",
  "status": "completed",
  "ir_hash": "blake3:f3a2b1...",
  "content_hash": "blake3:d9e4a5...",
  "size_bytes": 2048576,
  "output_url": "s3://venture-artifacts/art_01HX4BGJKT.../v1/output.pptx",
  "render_duration_seconds": 38,
  "version": 1,
  "quality_checks": {
    "spell_check": "passed",
    "brand_compliance": "passed",
    "accessibility": "failed"
  },
  "submitted_at": "2026-02-21T14:25:00Z",
  "completed_at": "2026-02-21T14:25:38Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### GET /v1/artifacts/{artifact_id}/download

Stream the artifact binary content. Response is `application/octet-stream` with `Content-Disposition: attachment; filename="..."`.

**Query parameters:**

| Parameter | Type    | Default | Description                  |
|-----------|---------|---------|------------------------------|
| version   | integer | latest  | Specific version to download |

**Response 200:** Binary stream.

**Errors:**

| Status | Error Code    | Condition                        |
|--------|---------------|----------------------------------|
| 404    | VENTURE_E020  | Artifact not found               |
| 409    | VENTURE_E021  | Artifact render not yet complete |
| 403    | VENTURE_E022  | Access denied                    |

---

#### GET /v1/artifacts/{artifact_id}/versions

Retrieve version history for an artifact.

**Response 200:**

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "versions": [
    {
      "version": 1,
      "content_hash": "blake3:d9e4a5...",
      "size_bytes": 2048576,
      "status": "stable",
      "promoted_at": "2026-02-21T14:26:00Z",
      "promoted_by": "policy_engine"
    }
  ],
  "current_version": 1,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3.5 Treasury Endpoints

#### POST /v1/money/intents

Create a money intent (pre-authorization step). No funds move at this stage. The policy engine validates the intent against workspace budget and policy rules before approval.

**Request body:**

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "amount_cents": 4999,
  "currency": "USD",
  "merchant_descriptor": "Acme SaaS Tools LLC",
  "merchant_category_code": "7372",
  "description": "API subscription for research tooling",
  "tool_name": "web_search_pro",
  "metadata": {
    "vendor_url": "https://example.com",
    "invoice_ref": "INV-2026-0421"
  }
}
```

**Response 202:**

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "status": "pending",
  "amount_cents": 4999,
  "currency": "USD",
  "merchant_descriptor": "Acme SaaS Tools LLC",
  "expires_at": "2026-02-21T14:40:00Z",
  "policy_check_status": "pending",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `money.intent.created.v1`

**Rate limit:** 30 requests per minute per workspace.

**Errors:**

| Status | Error Code    | Condition                                      |
|--------|---------------|------------------------------------------------|
| 400    | VENTURE_E023  | amount_cents must be positive integer          |
| 400    | VENTURE_E024  | Unsupported currency                           |
| 403    | VENTURE_E025  | Workspace frozen                               |
| 422    | VENTURE_E026  | Amount exceeds single-intent limit             |
| 422    | VENTURE_E027  | Merchant category code not in allowlist        |
| 429    | VENTURE_E042  | Money intent rate limit exceeded               |

---

#### GET /v1/money/intents/{intent_id}

Retrieve intent status and policy decision.

**Response 200:**

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "status": "approved",
  "amount_cents": 4999,
  "currency": "USD",
  "merchant_descriptor": "Acme SaaS Tools LLC",
  "policy_decision": {
    "decision": "approved",
    "decided_at": "2026-02-21T14:25:05Z",
    "policy_rule_ids": ["rule_velocity_ok", "rule_mcc_allowed"],
    "budget_remaining_cents_after": 652901
  },
  "created_at": "2026-02-21T14:25:00Z",
  "expires_at": "2026-02-21T14:40:00Z",
  "executed_at": null,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### POST /v1/money/intents/{intent_id}/execute

Execute a previously approved money intent. This triggers the actual charge via the payment processor.

**Request body:** None.

**Response 200:**

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "status": "executed",
  "stripe_charge_id": "ch_3Nz...",
  "ledger_entry_id": "led_01HX4BGJKT...",
  "amount_settled_cents": 4999,
  "settled_at": "2026-02-21T14:26:00Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `money.intent.executed.v1`, `money.ledger.transfer.v1`

**Errors:**

| Status | Error Code    | Condition                                |
|--------|---------------|------------------------------------------|
| 404    | VENTURE_E028  | Intent not found                         |
| 409    | VENTURE_E029  | Intent already executed                  |
| 409    | VENTURE_E030  | Intent expired                           |
| 409    | VENTURE_E031  | Intent rejected by policy — cannot exec  |
| 422    | VENTURE_E032  | Payment processor error (see details)    |

---

#### GET /v1/money/ledger

Retrieve double-entry ledger entries, paginated.

**Query parameters:**

| Parameter     | Type    | Default | Description                             |
|---------------|---------|---------|-----------------------------------------|
| workspace_id  | string  | (jwt)   | Filter by workspace                     |
| workflow_id   | string  | null    | Filter by workflow                      |
| transfer_type | string  | null    | agent_cost, vendor_payment, refund, fee |
| after         | string  | null    | ISO-8601 timestamp                      |
| before        | string  | null    | ISO-8601 timestamp                      |
| limit         | integer | 100     | Max results (max 500)                   |
| cursor        | string  | null    | Pagination cursor                       |

**Response 200:**

```json
{
  "ledger_entries": [
    {
      "ledger_entry_id": "led_01HX4BGJKT...",
      "from_account": "workspace:wks_01HX4BGJKT",
      "to_account": "vendor:acme_saas",
      "amount_cents": 4999,
      "currency": "USD",
      "transfer_type": "vendor_payment",
      "reference_id": "int_01HX4BGJKT...",
      "description": "API subscription for research tooling",
      "created_at": "2026-02-21T14:26:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### GET /v1/money/reconciliation/{period}

Retrieve reconciliation report for a billing period.

**Path parameters:**

| Parameter | Type   | Description                          |
|-----------|--------|--------------------------------------|
| period    | string | ISO-8601 date (e.g., 2026-02) for month, or YYYY-MM-DD for day |

**Response 200:**

```json
{
  "period": "2026-02",
  "workspace_id": "wks_01HX4BGJKT...",
  "opening_balance_cents": 1000000,
  "total_debited_cents": 342100,
  "total_credited_cents": 0,
  "closing_balance_cents": 657900,
  "transaction_count": 87,
  "mismatches_detected": 0,
  "reconciliation_status": "clean",
  "generated_at": "2026-02-21T14:00:00Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3.6 Compliance Endpoints

#### GET /v1/compliance/audit-log

Retrieve paginated audit log entries.

**Query parameters:**

| Parameter     | Type    | Default | Description                                     |
|---------------|---------|---------|-------------------------------------------------|
| workspace_id  | string  | (jwt)   | Filter by workspace                             |
| actor_type    | string  | null    | Filter: agent, founder, system, policy_engine   |
| action_type   | string  | null    | Filter by action type                           |
| after         | string  | null    | ISO-8601 timestamp                              |
| before        | string  | null    | ISO-8601 timestamp                              |
| limit         | integer | 100     | Max results (max 500)                           |
| cursor        | string  | null    | Pagination cursor                               |

**Response 200:**

```json
{
  "audit_entries": [
    {
      "audit_id": "aud_01HX4BGJKT...",
      "seq": 142,
      "event_id": "evt_01HX4BGJKT...",
      "event_type": "money.intent.executed.v1",
      "actor_type": "agent",
      "actor_id": "agt_01HX4BGJKT...",
      "workflow_id": "wfl_01HX4BGJKT...",
      "action_summary": "Executed money intent int_01HX4BGJKT for $49.99",
      "prev_hash": "blake3:a3f4c2...",
      "entry_hash": "blake3:b4f5d3...",
      "created_at": "2026-02-21T14:26:00Z"
    }
  ],
  "chain_verified": true,
  "verified_through_seq": 142,
  "next_cursor": null,
  "total_count": 142,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### GET /v1/compliance/violations

List detected compliance violations.

**Query parameters:**

| Parameter      | Type    | Default | Description                               |
|----------------|---------|---------|-------------------------------------------|
| workspace_id   | string  | (jwt)   | Filter by workspace                       |
| violation_type | string  | null    | ofac_match, pan_detected, ctr_threshold   |
| status         | string  | null    | open, resolved, escalated                 |
| limit          | integer | 50      | Max results (max 200)                     |
| cursor         | string  | null    | Pagination cursor                         |

**Response 200:**

```json
{
  "violations": [
    {
      "violation_id": "vio_01HX4BGJKT...",
      "violation_type": "ofac_match",
      "status": "escalated",
      "entity_name": "Example Corp LLC",
      "match_score": 0.94,
      "action_taken": "intent_blocked",
      "workflow_id": "wfl_01HX4BGJKT...",
      "detected_at": "2026-02-21T13:10:00Z",
      "resolved_at": null
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### POST /v1/compliance/policies

Upload and activate a new policy bundle.

**Request body (`multipart/form-data`):**

| Field       | Type | Description                                   |
|-------------|------|-----------------------------------------------|
| bundle_file | file | YAML or JSON policy bundle file               |
| description | text | Human-readable description of changes         |
| dry_run     | bool | If true, validate but do not activate         |

**Response 201:**

```json
{
  "bundle_id": "pbnd_01HX4BGJKT...",
  "prev_bundle_id": "pbnd_01HX4BGJKZ...",
  "status": "active",
  "rule_count": 47,
  "changes_summary": [
    "Added velocity_limit rule for MCC 7372",
    "Updated OFAC match threshold from 0.90 to 0.92"
  ],
  "activated_at": "2026-02-21T14:30:00Z",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Events emitted:** `compliance.policy_bundle.updated.v1`

---

### 3.7 WebSocket Streaming Endpoints

#### WS /v1/workflows/{workflow_id}/stream

Real-time event stream for a specific workflow. Connection authenticated via `?token=<jwt>` query parameter.

**Connection lifecycle:**

1. Client connects: `wss://api.venture.autonomy/v1/workflows/{workflow_id}/stream?token=<jwt>`
2. Server sends `connection.established` handshake message.
3. Server streams all new events for the workflow as newline-delimited JSON.
4. When the workflow reaches a terminal state (completed, failed, cancelled), server sends `connection.closing` message and closes with code 1000.

**Handshake message:**

```json
{
  "type": "connection.established",
  "workflow_id": "wfl_01HX4BGJKT...",
  "connected_at": "2026-02-21T14:25:00Z",
  "replay_from_seq": 0,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Stream message format:** Each line is a complete `EventEnvelopeV1` JSON object (see Section 4.8).

**Replay:** Add `?replay_from_seq=N` to replay events from sequence N. Useful for reconnect-after-disconnect.

**Ping/Pong:** Server sends WebSocket ping every 30 seconds. Client must pong within 10 seconds or connection is closed.

---

#### WS /v1/agents/{agent_id}/stream

Real-time activity stream for a specific agent session.

**Connection:** `wss://api.venture.autonomy/v1/agents/{agent_id}/stream?token=<jwt>`

**Stream message types:** `agent.heartbeat.v1`, `agent.tool_call.v1`, `agent.policy_violation.v1`, `agent.timeout.v1`

---

## 4. OpenAPI Schema — Pydantic v2 Models

### 4.1 Shared Primitive Types

```python
# venture/schemas/primitives.py
from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re

# UUIDv7 string type — lexicographically sortable, time-prefixed
UUIDv7 = Annotated[str, Field(pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')]

# BLAKE3 hex digest — 64 hex chars
Blake3Hash = Annotated[str, Field(pattern=r'^blake3:[0-9a-f]{64}$')]

# EAU unit — Effort Allocation Unit (internal compute currency)
EAU = Annotated[int, Field(ge=0, le=10_000_000)]

# Cents — integer currency in minor units
Cents = Annotated[int, Field(ge=0, le=1_000_000_000)]

# ISO-4217 currency code
CurrencyCode = Annotated[str, Field(pattern=r'^[A-Z]{3}$')]

# Workspace ID prefix
WorkspaceId = Annotated[str, Field(pattern=r'^wks_[0-9A-Za-z]{20,}$')]

# Workflow ID prefix
WorkflowId = Annotated[str, Field(pattern=r'^wfl_[0-9A-Za-z]{20,}$')]

# Artifact ID prefix
ArtifactId = Annotated[str, Field(pattern=r'^art_[0-9A-Za-z]{20,}$')]

# Intent ID prefix
IntentId = Annotated[str, Field(pattern=r'^int_[0-9A-Za-z]{20,}$')]

# Agent ID prefix
AgentId = Annotated[str, Field(pattern=r'^agt_[0-9A-Za-z]{20,}$')]

# Bundle ID prefix
BundleId = Annotated[str, Field(pattern=r'^pbnd_[0-9A-Za-z]{20,}$')]


class VentureBaseModel(BaseModel):
    """Base model for all Venture schemas. Extra fields are ignored (forward-compatible)."""
    model_config = ConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        validate_assignment=True,
        populate_by_name=True,
    )
```

---

### 4.2 Auth Models

```python
# venture/schemas/auth.py
from venture.schemas.primitives import VentureBaseModel, WorkspaceId
from pydantic import Field, SecretStr
from typing import Literal


class TokenRequest(VentureBaseModel):
    client_id: WorkspaceId = Field(description="Workspace client ID")
    client_secret: SecretStr = Field(description="Client secret (write-only)")


class TokenResponse(VentureBaseModel):
    access_token: str = Field(description="JWT access token (EdDSA signed)")
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(default=900, description="Seconds until expiry")
    refresh_token: str = Field(description="Refresh token for re-issuance")
    scope: str = Field(description="Space-delimited scope list")
    workspace_id: WorkspaceId
    trace_id: str


class RefreshRequest(VentureBaseModel):
    refresh_token: str = Field(description="Valid refresh token")


class TokenRevokeResponse(VentureBaseModel):
    revoked: bool = True
    trace_id: str
```

---

### 4.3 Workspace Models

```python
# venture/schemas/workspace.py
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import Field
from venture.schemas.primitives import (
    VentureBaseModel, WorkspaceId, BundleId, Cents, CurrencyCode
)

WorkspaceStatus = Literal["active", "frozen", "suspended", "deleted"]


class WorkspaceCreateRequest(VentureBaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    owner_user_id: str = Field(pattern=r'^usr_[0-9A-Za-z]{20,}$')
    budget_cap_cents: Cents = Field(ge=100, description="Minimum budget: 1 cent * 100")
    budget_currency: CurrencyCode = Field(default="USD")
    policy_bundle_id: BundleId
    metadata: dict[str, str] = Field(default_factory=dict)


class WorkspaceResponse(VentureBaseModel):
    workspace_id: WorkspaceId
    display_name: str
    status: WorkspaceStatus
    budget_cap_cents: Cents
    budget_consumed_cents: Cents
    budget_remaining_cents: Cents
    policy_bundle_id: BundleId
    freeze_reason: Optional[str] = None
    active_workflow_count: int = 0
    active_agent_count: int = 0
    created_at: datetime
    updated_at: datetime
    trace_id: str


class VelocityWindow(VentureBaseModel):
    per_minute_limit_cents: Cents
    per_minute_consumed_cents: Cents
    per_hour_limit_cents: Cents
    per_hour_consumed_cents: Cents
    per_day_limit_cents: Cents
    per_day_consumed_cents: Cents


class BudgetSummaryResponse(VentureBaseModel):
    workspace_id: WorkspaceId
    budget_cap_cents: Cents
    budget_consumed_cents: Cents
    budget_remaining_cents: Cents
    velocity_windows: VelocityWindow
    last_transaction_at: Optional[datetime] = None
    trace_id: str


class FreezePatchRequest(VentureBaseModel):
    frozen: bool
    reason: str = Field(min_length=1, max_length=1000)


class FreezeResponse(VentureBaseModel):
    workspace_id: WorkspaceId
    status: WorkspaceStatus
    freeze_reason: Optional[str] = None
    frozen_at: Optional[datetime] = None
    unfrozen_at: Optional[datetime] = None
    intents_revoked_count: int = 0
    trace_id: str
```

---

### 4.4 Workflow Models

```python
# venture/schemas/workflow.py
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import Field, model_validator
from venture.schemas.primitives import (
    VentureBaseModel, WorkspaceId, WorkflowId, BundleId, EAU, AgentId
)

WorkflowStatus = Literal[
    "submitted", "running", "completed", "failed", "cancelled", "compensating"
]

TaskStatus = Literal[
    "pending", "running", "completed", "failed", "cancelled", "skipped"
]

TaskType = Literal[
    "research", "synthesis", "code_generation", "data_analysis",
    "artifact_compile", "money_intent", "compliance_check", "custom"
]


class RetryPolicy(VentureBaseModel):
    max_retries: int = Field(default=3, ge=0, le=10)
    backoff_base_seconds: float = Field(default=5.0, ge=0.5)
    backoff_multiplier: float = Field(default=2.0, ge=1.0, le=10.0)
    max_backoff_seconds: float = Field(default=300.0)


class TaskSpec(VentureBaseModel):
    task_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,64}$')
    task_type: TaskType
    description: str = Field(max_length=4096)
    tool_allowlist: list[str] = Field(default_factory=list)
    eau_budget: EAU = Field(ge=1)
    depends_on: list[str] = Field(default_factory=list)
    timeout_seconds: int = Field(default=300, ge=10, le=86400)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    parameters: dict = Field(default_factory=dict)


class SagaConfig(VentureBaseModel):
    compensation_enabled: bool = True
    rollback_on_partial_failure: bool = True
    max_compensation_seconds: int = Field(default=300, ge=30)


class WorkflowSubmitRequest(VentureBaseModel):
    workspace_id: WorkspaceId
    display_name: str = Field(min_length=1, max_length=255)
    budget_cap_eau: EAU = Field(ge=1)
    policy_bundle_id: BundleId
    priority: Literal["low", "normal", "high"] = "normal"
    tasks: list[TaskSpec] = Field(min_length=1, max_length=100)
    saga_config: SagaConfig = Field(default_factory=SagaConfig)
    metadata: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dag_no_cycles(self) -> "WorkflowSubmitRequest":
        """Topological sort to detect cycles in the task DAG."""
        task_ids = {t.task_id for t in self.tasks}
        for task in self.tasks:
            for dep in task.depends_on:
                if dep not in task_ids:
                    raise ValueError(f"Task {task.task_id!r} depends on unknown task {dep!r}")
        # Kahn's algorithm cycle detection
        in_degree: dict[str, int] = {t.task_id: 0 for t in self.tasks}
        adj: dict[str, list[str]] = {t.task_id: [] for t in self.tasks}
        for task in self.tasks:
            for dep in task.depends_on:
                adj[dep].append(task.task_id)
                in_degree[task.task_id] += 1
        queue = [tid for tid, deg in in_degree.items() if deg == 0]
        visited = 0
        while queue:
            node = queue.pop(0)
            visited += 1
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        if visited != len(self.tasks):
            raise ValueError("Task DAG contains a cycle — cyclic dependencies are forbidden")
        return self


class WorkflowSubmitResponse(VentureBaseModel):
    workflow_id: WorkflowId
    status: WorkflowStatus
    spec_hash: str
    task_count: int
    budget_cap_eau: EAU
    estimated_start_at: Optional[datetime] = None
    trace_id: str


class WorkflowStatusResponse(VentureBaseModel):
    workflow_id: WorkflowId
    workspace_id: WorkspaceId
    display_name: str
    status: WorkflowStatus
    spec_hash: str
    budget_cap_eau: EAU
    eau_consumed: EAU
    task_count: int
    tasks_completed: int
    tasks_failed: int
    tasks_running: int
    tasks_pending: int
    submitted_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_completion_at: Optional[datetime] = None
    policy_bundle_id: BundleId
    saga_state: Optional[str] = None
    trace_id: str


class WorkflowEventItem(VentureBaseModel):
    event_id: str
    event_type: str
    seq: int
    created_at: datetime
    payload: dict


class WorkflowEventsResponse(VentureBaseModel):
    workflow_id: WorkflowId
    events: list[WorkflowEventItem]
    next_cursor: Optional[str] = None
    total_count: int
    trace_id: str


class WorkflowCancelRequest(VentureBaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class WorkflowCancelResponse(VentureBaseModel):
    workflow_id: WorkflowId
    status: WorkflowStatus
    cancelled_at: datetime
    compensation_triggered: bool
    compensation_steps: list[str] = Field(default_factory=list)
    trace_id: str


class WorkflowListItem(VentureBaseModel):
    workflow_id: WorkflowId
    display_name: str
    status: WorkflowStatus
    task_count: int
    eau_consumed: EAU
    submitted_at: datetime
    completed_at: Optional[datetime] = None


class WorkflowListResponse(VentureBaseModel):
    workflows: list[WorkflowListItem]
    next_cursor: Optional[str] = None
    total_count: int
    trace_id: str


---

### 4.5 Artifact Models

```python
# venture/schemas/artifact.py
from __future__ import annotations
from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import Field, model_validator
from venture.schemas.primitives import (
    VentureBaseModel, WorkspaceId, WorkflowId, ArtifactId, Blake3Hash
)

ArtifactStatus = Literal[
    "queued", "validating", "rendering", "quality_check",
    "completed", "failed", "cancelled"
]

SpecType = Literal[
    "slide_deck", "document", "timeline", "audio_clip",
    "board_summary", "data_report"
]

OutputFormat = Literal["pptx", "pdf", "docx", "mp3", "wav", "png", "svg", "json"]

QualityCheckName = Literal[
    "spell_check", "brand_compliance", "accessibility",
    "content_safety", "pii_scan", "format_validation"
]

QualityCheckResult = Literal["passed", "failed", "skipped", "warning"]


class SlideSpec(VentureBaseModel):
    """IR specification for slide deck artifacts."""
    title: str = Field(max_length=512)
    slides: list[dict[str, Any]] = Field(min_length=1, max_length=500)
    theme: str = Field(default="venture_default")
    output_format: Literal["pptx", "pdf"] = "pptx"
    speaker_notes: bool = False


class DocumentSpec(VentureBaseModel):
    """IR specification for document artifacts."""
    title: str = Field(max_length=512)
    sections: list[dict[str, Any]] = Field(min_length=1)
    output_format: Literal["docx", "pdf"] = "docx"
    style_template: str = Field(default="venture_standard")


class AudioSpec(VentureBaseModel):
    """IR specification for audio clip artifacts."""
    script: str = Field(max_length=50000)
    voice_id: str = Field(default="venture_neutral")
    output_format: Literal["mp3", "wav"] = "mp3"
    sample_rate: int = Field(default=44100)


class ArtifactSubmitRequest(VentureBaseModel):
    workspace_id: WorkspaceId
    workflow_id: WorkflowId
    spec_type: SpecType
    spec: dict[str, Any] = Field(description="IR spec payload; validated against spec_type schema")
    quality_checks: list[QualityCheckName] = Field(default_factory=list)
    priority: Literal["low", "normal", "high"] = "normal"
    idempotency_key: Optional[str] = None

    @model_validator(mode="after")
    def validate_spec_type_fields(self) -> "ArtifactSubmitRequest":
        required_fields = {
            "slide_deck": ["title", "slides"],
            "document": ["title", "sections"],
            "timeline": ["title", "events"],
            "audio_clip": ["script"],
            "board_summary": ["title", "metrics"],
            "data_report": ["title", "data_source"],
        }
        required = required_fields.get(self.spec_type, [])
        missing = [f for f in required if f not in self.spec]
        if missing:
            raise ValueError(
                f"spec_type={self.spec_type!r} requires fields: {missing}"
            )
        return self


class ArtifactSubmitResponse(VentureBaseModel):
    artifact_id: ArtifactId
    status: ArtifactStatus
    spec_type: SpecType
    ir_hash: Blake3Hash
    estimated_render_seconds: int
    trace_id: str


class QualityChecks(VentureBaseModel):
    spell_check: Optional[QualityCheckResult] = None
    brand_compliance: Optional[QualityCheckResult] = None
    accessibility: Optional[QualityCheckResult] = None
    content_safety: Optional[QualityCheckResult] = None
    pii_scan: Optional[QualityCheckResult] = None
    format_validation: Optional[QualityCheckResult] = None


class ArtifactStatusResponse(VentureBaseModel):
    artifact_id: ArtifactId
    workflow_id: WorkflowId
    spec_type: SpecType
    status: ArtifactStatus
    ir_hash: Blake3Hash
    content_hash: Optional[Blake3Hash] = None
    size_bytes: Optional[int] = None
    output_url: Optional[str] = None
    render_duration_seconds: Optional[float] = None
    version: int = 1
    quality_checks: QualityChecks = Field(default_factory=QualityChecks)
    submitted_at: datetime
    completed_at: Optional[datetime] = None
    trace_id: str


class ArtifactVersion(VentureBaseModel):
    version: int
    content_hash: Blake3Hash
    size_bytes: int
    status: Literal["draft", "stable", "deprecated"]
    promoted_at: Optional[datetime] = None
    promoted_by: Optional[str] = None


class ArtifactVersionsResponse(VentureBaseModel):
    artifact_id: ArtifactId
    versions: list[ArtifactVersion]
    current_version: int
    trace_id: str
```

---

### 4.6 Treasury Models

```python
# venture/schemas/treasury.py
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import Field, field_validator
from venture.schemas.primitives import (
    VentureBaseModel, WorkspaceId, WorkflowId, IntentId,
    Cents, CurrencyCode
)

IntentStatus = Literal[
    "pending", "approved", "rejected", "executed",
    "expired", "revoked", "failed"
]

TransferType = Literal[
    "agent_cost", "vendor_payment", "refund", "fee",
    "inter_workspace", "platform_revenue"
]

# Valid Merchant Category Codes for agent tool payments
ALLOWED_MCC_CODES = {
    "7372",  # Computer Programming, Data Processing
    "7374",  # Computer Maintenance and Repair
    "5045",  # Computers, Peripherals, and Software
    "7379",  # Computer Related Services
    "7375",  # Information Retrieval Services
    "4816",  # Computer Network/Information Services
}


class IntentCreateRequest(VentureBaseModel):
    workflow_id: WorkflowId
    workspace_id: WorkspaceId
    amount_cents: Cents = Field(ge=1, le=1_000_000)
    currency: CurrencyCode = Field(default="USD")
    merchant_descriptor: str = Field(min_length=1, max_length=255)
    merchant_category_code: str = Field(pattern=r'^\d{4}$')
    description: str = Field(max_length=1000)
    tool_name: str = Field(max_length=255)
    metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("merchant_category_code")
    @classmethod
    def validate_mcc(cls, v: str) -> str:
        if v not in ALLOWED_MCC_CODES:
            raise ValueError(
                f"MCC {v!r} not in allowlist. Allowed: {sorted(ALLOWED_MCC_CODES)}"
            )
        return v


class PolicyDecision(VentureBaseModel):
    decision: Literal["approved", "rejected", "pending"]
    decided_at: Optional[datetime] = None
    policy_rule_ids: list[str] = Field(default_factory=list)
    budget_remaining_cents_after: Optional[Cents] = None
    rejection_reason: Optional[str] = None
    policy_rule_violated: Optional[str] = None


class IntentCreateResponse(VentureBaseModel):
    intent_id: IntentId
    status: IntentStatus
    amount_cents: Cents
    currency: CurrencyCode
    merchant_descriptor: str
    expires_at: datetime
    policy_check_status: Literal["pending", "approved", "rejected"]
    trace_id: str


class IntentStatusResponse(VentureBaseModel):
    intent_id: IntentId
    workflow_id: WorkflowId
    status: IntentStatus
    amount_cents: Cents
    currency: CurrencyCode
    merchant_descriptor: str
    policy_decision: PolicyDecision
    created_at: datetime
    expires_at: datetime
    executed_at: Optional[datetime] = None
    stripe_charge_id: Optional[str] = None
    ledger_entry_id: Optional[str] = None
    trace_id: str


class IntentExecuteResponse(VentureBaseModel):
    intent_id: IntentId
    status: IntentStatus
    stripe_charge_id: str
    ledger_entry_id: str
    amount_settled_cents: Cents
    settled_at: datetime
    trace_id: str


class LedgerEntry(VentureBaseModel):
    ledger_entry_id: str
    from_account: str = Field(description="Double-entry debit account")
    to_account: str = Field(description="Double-entry credit account")
    amount_cents: Cents
    currency: CurrencyCode
    transfer_type: TransferType
    reference_id: str = Field(description="Intent ID or other origin reference")
    description: str
    created_at: datetime


class LedgerResponse(VentureBaseModel):
    ledger_entries: list[LedgerEntry]
    next_cursor: Optional[str] = None
    total_count: int
    trace_id: str


class ReconciliationResponse(VentureBaseModel):
    period: str
    workspace_id: WorkspaceId
    opening_balance_cents: Cents
    total_debited_cents: Cents
    total_credited_cents: Cents
    closing_balance_cents: Cents
    transaction_count: int
    mismatches_detected: int
    reconciliation_status: Literal["clean", "mismatch", "pending"]
    generated_at: datetime
    trace_id: str
```

---

### 4.7 Compliance Models

```python
# venture/schemas/compliance.py
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import Field
from venture.schemas.primitives import VentureBaseModel, WorkspaceId, WorkflowId

ViolationType = Literal[
    "ofac_match", "pan_detected", "ctr_threshold",
    "velocity_abuse", "policy_violation", "audit_chain_break"
]

ViolationStatus = Literal["open", "resolved", "escalated", "dismissed"]

ActorType = Literal["agent", "founder", "system", "policy_engine", "compliance_engine"]


class AuditEntry(VentureBaseModel):
    audit_id: str
    seq: int
    event_id: str
    event_type: str
    actor_type: ActorType
    actor_id: str
    workflow_id: Optional[WorkflowId] = None
    action_summary: str
    prev_hash: str
    entry_hash: str
    created_at: datetime


class AuditLogResponse(VentureBaseModel):
    audit_entries: list[AuditEntry]
    chain_verified: bool
    verified_through_seq: int
    next_cursor: Optional[str] = None
    total_count: int
    trace_id: str


class ViolationItem(VentureBaseModel):
    violation_id: str
    violation_type: ViolationType
    status: ViolationStatus
    entity_name: Optional[str] = None
    match_score: Optional[float] = None
    action_taken: str
    workflow_id: Optional[WorkflowId] = None
    detected_at: datetime
    resolved_at: Optional[datetime] = None


class ViolationsResponse(VentureBaseModel):
    violations: list[ViolationItem]
    next_cursor: Optional[str] = None
    total_count: int
    trace_id: str


class PolicyBundleUploadResponse(VentureBaseModel):
    bundle_id: str
    prev_bundle_id: Optional[str] = None
    status: Literal["active", "dry_run_ok", "validation_failed"]
    rule_count: int
    changes_summary: list[str] = Field(default_factory=list)
    activated_at: Optional[datetime] = None
    trace_id: str
```

---

### 4.8 Event Envelope Model

```python
# venture/schemas/events.py
from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import Field, field_validator, model_validator
import re

from venture.schemas.primitives import VentureBaseModel, WorkflowId, Blake3Hash

# Event type pattern: domain.sub_event.version
EVENT_TYPE_PATTERN = re.compile(
    r'^(workflow|artifact|money|agent|compliance)\.[a-z][a-z0-9_.]*\.v[0-9]+$'
)


class EventEnvelopeV1(VentureBaseModel):
    """
    Canonical event envelope for all Venture platform events.
    Every event published to NATS or stored in the event store MUST conform.

    Fields:
        event_id:         UUIDv7 — globally unique, time-sortable
        event_type:       dot-notation subject (e.g. workflow.submitted.v1)
        workflow_id:      UUID of the owning workflow (required for all events)
        trace_id:         Distributed trace ID propagated from HTTP layer
        policy_bundle_id: ID of the active policy bundle at event creation time
        created_at:       UTC ISO-8601 timestamp
        schema_version:   Always "v1" for this model
        seq:              Monotonic sequence number within this workflow's event chain
        prev_hash:        BLAKE3 hash of the previous event in the chain (blake3:<hex>)
                          For seq=1, prev_hash = blake3:<zeros*64>
        payload:          Event-specific payload dict (validated per event_type)
    """
    event_id: str = Field(
        pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        description="UUIDv7 — lexicographically sortable event identifier"
    )
    event_type: str = Field(
        description="dot-notation event type: <domain>.<event>.<version>"
    )
    workflow_id: WorkflowId
    trace_id: str = Field(min_length=20, max_length=128)
    policy_bundle_id: str = Field(pattern=r'^pbnd_[0-9A-Za-z]{20,}$')
    created_at: datetime
    schema_version: str = Field(default="v1", pattern=r'^v[0-9]+$')
    seq: int = Field(ge=1, description="Monotonic sequence within workflow event chain")
    prev_hash: Blake3Hash = Field(
        description="BLAKE3 of serialized previous EventEnvelopeV1. "
                    "blake3:000...000 (64 zeros) for seq=1."
    )
    payload: dict[str, Any] = Field(description="Event-type-specific payload")

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if not EVENT_TYPE_PATTERN.match(v):
            raise ValueError(
                f"event_type {v!r} does not match pattern "
                r"<domain>.<sub_event>.<version> where version is vN"
            )
        return v

    @field_validator("created_at")
    @classmethod
    def validate_created_at_not_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        # Allow up to 5 minutes clock skew
        if v.replace(tzinfo=timezone.utc) > now.replace(tzinfo=None if v.tzinfo is None else timezone.utc):
            skew_seconds = (v.replace(tzinfo=timezone.utc) - now).total_seconds()
            if skew_seconds > 300:
                raise ValueError(
                    f"created_at is {skew_seconds:.0f}s in the future (max skew: 300s)"
                )
        return v

    def compute_hash(self) -> str:
        """Compute BLAKE3 hash of this event for use as next event's prev_hash."""
        import blake3  # type: ignore[import]
        import json
        canonical = json.dumps(
            self.model_dump(mode="json"),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        digest = blake3.blake3(canonical).hexdigest()
        return f"blake3:{digest}"
```

---

## 5. NATS JetStream Configuration

### 5.1 Stream Definitions

```python
# venture/infra/nats_config.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal

StorageType = Literal["file", "memory"]
RetentionPolicy = Literal["limits", "interest", "workqueue"]


@dataclass
class StreamConfig:
    name: str
    subjects: list[str]
    retention: RetentionPolicy
    storage: StorageType
    num_replicas: int
    max_age_seconds: int
    max_bytes: int
    duplicate_window_seconds: int = 120
    max_msg_size: int = 4 * 1024 * 1024   # 4 MB per message
    allow_rollup_headers: bool = False
    deny_delete: bool = True
    deny_purge: bool = False
    description: str = ""


NATS_STREAM_CONFIGS: dict[str, StreamConfig] = {

    "VENTURE_WORKFLOW": StreamConfig(
        name="VENTURE_WORKFLOW",
        subjects=["venture.workflow.>"],
        retention="interest",
        storage="file",
        num_replicas=3,
        max_age_seconds=30 * 24 * 3600,          # 30 days
        max_bytes=10 * 1024 * 1024 * 1024,        # 10 GB
        duplicate_window_seconds=120,
        deny_delete=True,
        deny_purge=False,
        description=(
            "All workflow lifecycle events. Retention=interest: messages are kept "
            "until all active consumers have acknowledged. 30-day max age."
        ),
    ),

    "VENTURE_ARTIFACT": StreamConfig(
        name="VENTURE_ARTIFACT",
        subjects=["venture.artifact.>"],
        retention="interest",
        storage="file",
        num_replicas=3,
        max_age_seconds=90 * 24 * 3600,           # 90 days
        max_bytes=50 * 1024 * 1024 * 1024,         # 50 GB
        duplicate_window_seconds=120,
        deny_delete=True,
        description=(
            "Artifact render lifecycle events. Larger max_bytes to accommodate "
            "chunk events with content hashes. 90-day retention for audit."
        ),
    ),

    "VENTURE_MONEY": StreamConfig(
        name="VENTURE_MONEY",
        subjects=["venture.money.>"],
        retention="limits",
        storage="file",
        num_replicas=3,
        max_age_seconds=7 * 365 * 24 * 3600,      # 7 years (PCI DSS / SOC2)
        max_bytes=100 * 1024 * 1024 * 1024,        # 100 GB
        duplicate_window_seconds=300,              # 5-min dedup window for financial events
        deny_delete=True,
        deny_purge=True,                           # NEVER purge financial stream
        description=(
            "All treasury and financial events. Retention=limits: messages kept "
            "until max_age or max_bytes. 7-year retention for PCI DSS compliance. "
            "deny_purge=True: stream CANNOT be purged via NATS admin."
        ),
    ),

    "VENTURE_AGENT": StreamConfig(
        name="VENTURE_AGENT",
        subjects=["venture.agent.>"],
        retention="interest",
        storage="file",
        num_replicas=3,
        max_age_seconds=14 * 24 * 3600,           # 14 days
        max_bytes=20 * 1024 * 1024 * 1024,         # 20 GB
        duplicate_window_seconds=60,
        deny_delete=True,
        description=(
            "Agent lifecycle events: sessions, tool calls, heartbeats, violations. "
            "14-day retention; high message volume from heartbeats."
        ),
    ),

    "VENTURE_COMPLIANCE": StreamConfig(
        name="VENTURE_COMPLIANCE",
        subjects=["venture.compliance.>"],
        retention="limits",
        storage="file",
        num_replicas=3,
        max_age_seconds=7 * 365 * 24 * 3600,      # 7 years
        max_bytes=10 * 1024 * 1024 * 1024,         # 10 GB
        duplicate_window_seconds=300,
        deny_delete=True,
        deny_purge=True,
        description=(
            "Compliance events: OFAC checks, PAN detection, CTR thresholds, "
            "audit chain verification. 7-year retention. deny_purge=True."
        ),
    ),
}
```

### 5.2 Consumer Patterns

All consumers use push-based durable consumers with explicit acknowledgment. The ack timeout is 30 seconds. Unacknowledged messages are redelivered up to `max_deliver` times before going to the dead-letter subject `venture.dlq.<stream_name>`.

```python
# venture/infra/consumer_config.py
from dataclasses import dataclass
from typing import Literal

AckPolicy = Literal["explicit", "none", "all"]
DeliverPolicy = Literal["all", "last", "new", "by_start_sequence", "by_start_time"]


@dataclass
class ConsumerConfig:
    stream_name: str
    durable_name: str
    filter_subject: str
    ack_policy: AckPolicy
    deliver_policy: DeliverPolicy
    max_deliver: int
    ack_wait_seconds: int
    max_ack_pending: int
    description: str = ""


CONSUMER_CONFIGS: list[ConsumerConfig] = [
    ConsumerConfig(
        stream_name="VENTURE_WORKFLOW",
        durable_name="workflow-projection-updater",
        filter_subject="venture.workflow.>",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=5,
        ack_wait_seconds=30,
        max_ack_pending=1000,
        description="Updates workflow and task projection tables in PostgreSQL",
    ),
    ConsumerConfig(
        stream_name="VENTURE_WORKFLOW",
        durable_name="workflow-websocket-fanout",
        filter_subject="venture.workflow.>",
        ack_policy="explicit",
        deliver_policy="new",
        max_deliver=3,
        ack_wait_seconds=10,
        max_ack_pending=5000,
        description="Fans out workflow events to active WebSocket connections",
    ),
    ConsumerConfig(
        stream_name="VENTURE_MONEY",
        durable_name="money-ledger-recorder",
        filter_subject="venture.money.>",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=10,
        ack_wait_seconds=60,
        max_ack_pending=100,
        description=(
            "Records all money events to PostgreSQL ledger_entries table. "
            "Low max_ack_pending: financial events require ordered processing."
        ),
    ),
    ConsumerConfig(
        stream_name="VENTURE_MONEY",
        durable_name="money-reconciliation-processor",
        filter_subject="venture.money.money.ledger.transfer.v1",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=5,
        ack_wait_seconds=30,
        max_ack_pending=50,
        description="Feeds reconciliation engine for balance verification",
    ),
    ConsumerConfig(
        stream_name="VENTURE_COMPLIANCE",
        durable_name="compliance-audit-chain-verifier",
        filter_subject="venture.compliance.>",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=5,
        ack_wait_seconds=60,
        max_ack_pending=50,
        description="Verifies BLAKE3 hash chain integrity on each compliance event",
    ),
    ConsumerConfig(
        stream_name="VENTURE_AGENT",
        durable_name="agent-session-tracker",
        filter_subject="venture.agent.agent.session.>",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=5,
        ack_wait_seconds=30,
        max_ack_pending=500,
        description="Maintains agent session projection table",
    ),
    ConsumerConfig(
        stream_name="VENTURE_ARTIFACT",
        durable_name="artifact-render-tracker",
        filter_subject="venture.artifact.>",
        ack_policy="explicit",
        deliver_policy="all",
        max_deliver=5,
        ack_wait_seconds=30,
        max_ack_pending=200,
        description="Updates artifact status projection table",
    ),
]
```

### 5.3 Key-Value Stores

NATS JetStream Key-Value stores for fast mutable state (not event-sourced; used for hot-path lookups):

```python
# venture/infra/kv_config.py
NATS_KV_CONFIGS = {

    "venture-agent-sessions": {
        "description": "Active agent sessions keyed by agent_id. TTL = session TTL.",
        "history": 1,
        "ttl_seconds": 3600,          # 1-hour max session TTL
        "storage": "memory",
        "replicas": 3,
        "key_pattern": "agent.<agent_id>",
        "value_schema": {
            "agent_id": "str",
            "workspace_id": "str",
            "session_token_jti": "str",
            "task_id": "str | null",
            "status": "active | idle | terminated",
            "eau_consumed": "int",
            "eau_cap": "int",
            "last_heartbeat_at": "datetime",
        },
    },

    "venture-workflow-state": {
        "description": "Hot workflow state for sub-second reads. Write-through from projection.",
        "history": 5,
        "ttl_seconds": 7 * 24 * 3600,  # 7 days
        "storage": "file",
        "replicas": 3,
        "key_pattern": "workflow.<workflow_id>",
    },

    "venture-intent-locks": {
        "description": "Distributed locks for intent execution (prevent double-execute).",
        "history": 1,
        "ttl_seconds": 900,            # 15-minute lock TTL
        "storage": "memory",
        "replicas": 3,
        "key_pattern": "intent.<intent_id>",
    },

    "venture-policy-bundle-active": {
        "description": "Currently active policy bundle per workspace.",
        "history": 10,
        "ttl_seconds": 0,              # No TTL — persists until updated
        "storage": "file",
        "replicas": 3,
        "key_pattern": "workspace.<workspace_id>.policy_bundle",
    },

    "venture-rate-limit-counters": {
        "description": "Sliding window rate limit counters per workspace + endpoint.",
        "history": 1,
        "ttl_seconds": 60,
        "storage": "memory",
        "replicas": 3,
        "key_pattern": "ratelimit.<workspace_id>.<endpoint_key>",
    },
}
```

---

## 6. Event Catalog

All events conform to `EventEnvelopeV1` (Section 4.8). This section documents the `payload` schema for each event type.

### Event Naming Convention

```
venture.<domain>.<sub_event>.<version>

Domain values: workflow, artifact, money, agent, compliance
Version:       v1, v2, ... (increment on breaking payload change)
```

### Payload Field Conventions

- All ID fields use the prefixed format (`wfl_`, `art_`, `int_`, `agt_`)
- All timestamp fields are ISO-8601 UTC strings
- All amount fields use integer cents (`_cents` suffix)
- All hash fields use `blake3:<hex>` format
- Boolean fields are explicit `true`/`false`, never `0`/`1`

---

### 6.1 VENTURE_WORKFLOW Stream Events

#### `workflow.submitted.v1`

Emitted when a new workflow is accepted and queued for execution.

**Subject:** `venture.workflow.workflow.submitted.v1`
**Trigger:** `POST /v1/workflows` → 202 response

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "display_name": "Q1 Market Research Workflow",
  "spec_hash": "blake3:a3f4c2...",
  "budget_cap_eau": 10000,
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "task_count": 2,
  "task_ids": ["t1", "t2"],
  "priority": "normal",
  "saga_compensation_enabled": true,
  "submitted_by": "founder_ui",
  "metadata": { "project_tag": "q1-research" }
}
```

---

#### `workflow.task.started.v1`

Emitted when an agent begins executing a task.

**Subject:** `venture.workflow.workflow.task.started.v1`
**Trigger:** Orchestrator dispatches task to agent pool

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "task_type": "research",
  "agent_id": "agt_01HX4BGJKT...",
  "agent_level": "L2",
  "eau_budget": 2000,
  "tool_allowlist": ["web_search", "scrape_url"],
  "depends_on_completed": [],
  "attempt_number": 1,
  "timeout_at": "2026-02-21T14:30:00Z"
}
```

---

#### `workflow.task.completed.v1`

Emitted when a task finishes successfully.

**Subject:** `venture.workflow.workflow.task.completed.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "agent_id": "agt_01HX4BGJKT...",
  "result_summary": "Found 3 competitors with pricing data",
  "output_artifact_ids": ["art_01HX4BGJKT..."],
  "eau_consumed": 1240,
  "eau_budget": 2000,
  "eau_efficiency_pct": 62.0,
  "duration_seconds": 47.3,
  "tool_calls_count": 12,
  "attempt_number": 1
}
```

---

#### `workflow.task.failed.v1`

Emitted when a task fails. Retry logic is determined by the task's `retry_policy`.

**Subject:** `venture.workflow.workflow.task.failed.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "agent_id": "agt_01HX4BGJKT...",
  "error_code": "AGENT_TOOL_TIMEOUT",
  "error_message": "Tool call web_search exceeded 30s timeout",
  "error_detail": { "tool": "web_search", "url": "https://example.com" },
  "retries_remaining": 2,
  "attempt_number": 1,
  "eau_consumed": 340,
  "next_retry_at": "2026-02-21T14:26:15Z"
}
```

---

#### `workflow.completed.v1`

Emitted when all tasks in a workflow complete successfully.

**Subject:** `venture.workflow.workflow.completed.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "total_tasks": 2,
  "tasks_completed": 2,
  "tasks_failed": 0,
  "total_eau_consumed": 5120,
  "budget_cap_eau": 10000,
  "eau_utilization_pct": 51.2,
  "outcome": "success",
  "duration_seconds": 432.1,
  "artifact_ids": ["art_01HX4BGJKT..."],
  "money_intents_executed": 1,
  "total_spent_cents": 4999
}
```

---

#### `workflow.cancelled.v1`

Emitted when a workflow is explicitly cancelled.

**Subject:** `venture.workflow.workflow.cancelled.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "cancelled_by": "founder:usr_01HX4BGJKT...",
  "reason": "Requester abort — budget reallocation",
  "tasks_completed_before_cancel": 1,
  "tasks_running_at_cancel": 1,
  "eau_consumed": 2100,
  "compensation_triggered": true
}
```

---

#### `workflow.saga.compensating.v1`

Emitted when saga rollback begins after a failure or cancel.

**Subject:** `venture.workflow.workflow.saga.compensating.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "failed_step": "t2",
  "failure_reason": "Task t2 exhausted retries",
  "compensation_steps": [
    "revoke_pending_intents",
    "release_agent_sessions",
    "emit_partial_artifacts_deprecated"
  ],
  "compensation_started_at": "2026-02-21T14:28:00Z",
  "compensation_timeout_at": "2026-02-21T14:33:00Z"
}
```

---

### 6.2 VENTURE_ARTIFACT Stream Events

#### `artifact.spec_validated.v1`

Emitted after the artifact compiler validates the submitted IR spec.

**Subject:** `venture.artifact.artifact.spec_validated.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "spec_type": "slide_deck",
  "ir_hash": "blake3:f3a2b1...",
  "slide_count": 12,
  "estimated_render_seconds": 45,
  "validator_version": "1.4.2"
}
```

---

#### `artifact.render.started.v1`

Emitted when the render pipeline begins processing.

**Subject:** `venture.artifact.artifact.render.started.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "renderer": "pptx-headless-v2",
  "renderer_version": "2.1.0",
  "estimated_duration_s": 38,
  "pipeline_stages": ["layout", "content_inject", "theme_apply", "export"],
  "resource_allocation": { "cpu_cores": 2, "memory_mb": 512 }
}
```

---

#### `artifact.render.chunk.v1`

Emitted after each render pipeline stage completes. Enables streaming progress.

**Subject:** `venture.artifact.artifact.render.chunk.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "chunk_index": 2,
  "stage_name": "theme_apply",
  "chunk_hash": "blake3:c2d3e4...",
  "cumulative_pct": 75.0,
  "chunk_duration_ms": 1240,
  "bytes_processed": 204800
}
```

---

#### `artifact.render.completed.v1`

Emitted when the render pipeline finishes and output is stored.

**Subject:** `venture.artifact.artifact.render.completed.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "output_url": "s3://venture-artifacts/art_01HX4BGJKT.../v1/output.pptx",
  "content_hash": "blake3:d9e4a5...",
  "size_bytes": 2048576,
  "render_duration_s": 38.2,
  "renderer": "pptx-headless-v2",
  "renderer_version": "2.1.0",
  "output_format": "pptx",
  "page_count": 12,
  "quality_checks_triggered": ["spell_check", "brand_compliance"]
}
```

---

#### `artifact.render.failed.v1`

Emitted when the render pipeline fails at any stage.

**Subject:** `venture.artifact.artifact.render.failed.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "stage_failed": "content_inject",
  "error": "Invalid slide layout reference: layout_id='nonexistent_layout'",
  "error_code": "ARTIFACT_INVALID_LAYOUT",
  "retries_remaining": 1,
  "attempt_number": 2,
  "partial_output_url": null
}
```

---

#### `artifact.version.promoted.v1`

Emitted when an artifact version is promoted to stable (after QA passes).

**Subject:** `venture.artifact.artifact.version.promoted.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "version_id": 1,
  "content_hash": "blake3:d9e4a5...",
  "promoted_by": "policy_engine",
  "promotion_reason": "All quality checks passed",
  "previous_version_id": null,
  "previous_version_deprecated": false
}
```

---

#### `artifact.quality.validated.v1`

Emitted when all requested quality checks pass.

**Subject:** `venture.artifact.artifact.quality.validated.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "checks_passed": ["spell_check", "brand_compliance"],
  "checks_skipped": [],
  "checks_warnings": [],
  "quality_score": 1.0,
  "validator_version": "3.2.1"
}
```

---

#### `artifact.quality.failed.v1`

Emitted when one or more quality checks fail below threshold.

**Subject:** `venture.artifact.artifact.quality.failed.v1`

```json
{
  "artifact_id": "art_01HX4BGJKT...",
  "checks_passed": ["spell_check"],
  "checks_failed": ["brand_compliance"],
  "failure_reason": "Brand colors non-compliant: slide 4 uses #FF0000 (not in palette)",
  "threshold_missed": "brand_compliance requires 100% pass rate",
  "auto_action": "block_promotion",
  "remediation_hint": "Replace #FF0000 with #C8102E (brand primary red)"
}
```

---

### 6.3 VENTURE_MONEY Stream Events

#### `money.intent.created.v1`

Emitted when a money intent is created and queued for policy evaluation.

**Subject:** `venture.money.money.intent.created.v1`
**Trigger:** `POST /v1/money/intents` → 202

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "agent_id": "agt_01HX4BGJKT...",
  "amount_cents": 4999,
  "currency": "USD",
  "merchant_descriptor": "Acme SaaS Tools LLC",
  "merchant_category_code": "7372",
  "description": "API subscription for research tooling",
  "tool_name": "web_search_pro",
  "ttl_seconds": 900,
  "expires_at": "2026-02-21T14:40:00Z",
  "metadata": { "invoice_ref": "INV-2026-0421" }
}
```

---

#### `money.intent.approved.v1`

Emitted when the policy engine approves a money intent.

**Subject:** `venture.money.money.intent.approved.v1`

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "approved_by": "policy_engine",
  "policy_rule_ids": ["rule_velocity_ok", "rule_mcc_allowed", "rule_ofac_clear"],
  "budget_remaining_cents": 652901,
  "evaluation_duration_ms": 23,
  "policy_bundle_id": "pbnd_01HX4BGJKT..."
}
```

---

#### `money.intent.rejected.v1`

Emitted when the policy engine rejects a money intent.

**Subject:** `venture.money.money.intent.rejected.v1`

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "rejection_reason": "Velocity limit exceeded: $250/min cap hit",
  "policy_rule_violated": "rule_velocity_per_minute",
  "rejected_by": "policy_engine",
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "retry_allowed_after": "2026-02-21T14:26:00Z"
}
```

---

#### `money.intent.executed.v1`

Emitted when a payment processor confirms execution of an approved intent.

**Subject:** `venture.money.money.intent.executed.v1`

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "stripe_charge_id": "ch_3Nz...",
  "ledger_entry_id": "led_01HX4BGJKT...",
  "amount_cents": 4999,
  "amount_settled_cents": 4999,
  "currency": "USD",
  "merchant_descriptor": "Acme SaaS Tools LLC",
  "settled_at": "2026-02-21T14:26:00Z",
  "processor_response_code": "00",
  "workspace_budget_remaining_cents": 652901
}
```

---

#### `money.intent.expired.v1`

Emitted when an intent reaches its TTL without being executed.

**Subject:** `venture.money.money.intent.expired.v1`

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "amount_cents": 4999,
  "created_at": "2026-02-21T14:25:00Z",
  "expired_at": "2026-02-21T14:40:00Z",
  "ttl_seconds": 900,
  "status_at_expiry": "approved"
}
```

---

#### `money.intent.revoked.v1`

Emitted when an intent is explicitly revoked (e.g., workspace freeze, workflow cancel).

**Subject:** `venture.money.money.intent.revoked.v1`

```json
{
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "revoked_by": "compliance_engine",
  "reason": "Workspace frozen due to suspicious activity",
  "revoked_at": "2026-02-21T14:25:05Z",
  "amount_cents": 4999
}
```

---

#### `money.ledger.transfer.v1`

Emitted for every double-entry ledger movement. Published after `money.intent.executed.v1`.

**Subject:** `venture.money.money.ledger.transfer.v1`

```json
{
  "ledger_entry_id": "led_01HX4BGJKT...",
  "from_account": "workspace:wks_01HX4BGJKT",
  "to_account": "vendor:acme_saas",
  "amount_cents": 4999,
  "currency": "USD",
  "transfer_type": "vendor_payment",
  "reference_id": "int_01HX4BGJKT...",
  "description": "API subscription for research tooling",
  "double_entry_balanced": true,
  "workspace_balance_after_cents": 652901,
  "created_at": "2026-02-21T14:26:00Z"
}
```

**Invariant:** `from_account` balance decreases; `to_account` balance increases. The sum of all transfers MUST remain balanced. The `double_entry_balanced` field is set by the ledger recorder after verifying balance.

---

#### `money.reconciliation.mismatch.v1`

Emitted when the reconciliation engine detects a balance discrepancy.

**Subject:** `venture.money.money.reconciliation.mismatch.v1`

```json
{
  "period": "2026-02",
  "workspace_id": "wks_01HX4BGJKT...",
  "expected_balance_cents": 652901,
  "actual_balance_cents": 652750,
  "delta_cents": -151,
  "mismatch_type": "unexplained_debit",
  "first_suspicious_entry_id": "led_01HX4BGJKZ...",
  "pagerduty_alert_id": "PD-12345",
  "detected_at": "2026-02-21T15:00:00Z"
}
```

---

#### `money.budget.exhausted.v1`

Emitted when a workspace budget cap is fully consumed.

**Subject:** `venture.money.money.budget.exhausted.v1`

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "cap_cents": 1000000,
  "consumed_cents": 1000000,
  "exhausted_at": "2026-02-21T16:30:00Z",
  "last_intent_id": "int_01HX4BGJKZ...",
  "auto_action": "block_new_intents",
  "active_intents_revoked": 2
}
```

---

#### `money.velocity_limit.hit.v1`

Emitted when a velocity rate limit is triggered.

**Subject:** `venture.money.money.velocity_limit.hit.v1`

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "limit_type": "per_minute",
  "window_start_at": "2026-02-21T14:25:00Z",
  "window_end_at": "2026-02-21T14:26:00Z",
  "limit_cents": 25000,
  "attempted_cents": 26500,
  "rejected_intent_id": "int_01HX4BGJKZ...",
  "auto_action": "intent_rejected"
}
```

---

### 6.4 VENTURE_AGENT Stream Events

#### `agent.session.created.v1`

Emitted when an agent session is issued to handle a task.

**Subject:** `venture.agent.agent.session.created.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workspace_id": "wks_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "agent_level": "L2",
  "agent_type": "research_specialist",
  "session_token_jti": "jti_01HX4BGJKT...",
  "ttl_seconds": 3600,
  "expires_at": "2026-02-21T15:25:00Z",
  "tool_allowlist": ["web_search", "scrape_url"],
  "eau_cap": 2000,
  "issued_by": "venture-orchestrator"
}
```

---

#### `agent.session.revoked.v1`

Emitted when an agent session is explicitly revoked before TTL.

**Subject:** `venture.agent.agent.session.revoked.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "session_token_jti": "jti_01HX4BGJKT...",
  "reason": "Workflow cancelled by founder",
  "revoked_by": "venture-orchestrator",
  "revoked_at": "2026-02-21T14:28:00Z",
  "eau_consumed_at_revocation": 1240
}
```

---

#### `agent.tool_call.v1`

Emitted for each tool invocation by an agent.

**Subject:** `venture.agent.agent.tool_call.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "tool_name": "web_search",
  "call_index": 3,
  "input_hash": "blake3:e5f6a7...",
  "output_hash": "blake3:b8c9d0...",
  "duration_ms": 847,
  "eau_cost": 15,
  "success": true,
  "error_code": null,
  "tool_version": "1.2.0",
  "policy_allowed": true
}
```

**Note:** `input_hash` and `output_hash` are BLAKE3 hashes of the serialized tool input/output. Raw content is not stored in the event (PII protection). Hashes are linkable to S3 objects for audit retrieval under compliance subpoena.

---

#### `agent.injection.detected.v1`

Emitted when the policy engine detects a prompt injection pattern.

**Subject:** `venture.agent.agent.injection.detected.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "detection_source": "tool_output",
  "pattern_ids": ["INJ-001-ignore-prior", "INJ-007-role-escalation"],
  "trust_score_before": 0.95,
  "trust_score_delta": -0.35,
  "trust_score_after": 0.60,
  "action_taken": "tool_call_blocked",
  "detection_context": "scrape_url output contained injection pattern",
  "detector_version": "2.3.0"
}
```

---

#### `agent.heartbeat.v1`

Emitted by the agent every 30 seconds to signal liveness.

**Subject:** `venture.agent.agent.heartbeat.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "progress_pct": 42.0,
  "eau_consumed": 840,
  "eau_cap": 2000,
  "eau_remaining_pct": 58.0,
  "current_stage": "data_collection",
  "tool_calls_this_interval": 5,
  "heartbeat_interval_seconds": 30
}
```

---

#### `agent.timeout.v1`

Emitted when no heartbeat is received within the expected window.

**Subject:** `venture.agent.agent.timeout.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "last_heartbeat_at": "2026-02-21T14:20:00Z",
  "timeout_detected_at": "2026-02-21T14:21:05Z",
  "missed_heartbeats": 2,
  "eau_consumed": 1100,
  "auto_action": "session_terminated",
  "task_retry_scheduled": true
}
```

---

#### `agent.policy_violation.v1`

Emitted when an agent attempts an action that violates the active policy bundle.

**Subject:** `venture.agent.agent.policy_violation.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "rule_id": "rule_tool_not_allowed",
  "violation_type": "forbidden_tool_call",
  "violation_detail": "Tool 'send_email' not in task tool_allowlist",
  "action_taken": "tool_call_blocked",
  "policy_bundle_id": "pbnd_01HX4BGJKT...",
  "severity": "high"
}
```

---

#### `agent.eau_budget.warning.v1`

Emitted when an agent's EAU consumption reaches 80% of cap.

**Subject:** `venture.agent.agent.eau_budget.warning.v1`

```json
{
  "agent_id": "agt_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "task_id": "t1",
  "eau_consumed": 1600,
  "eau_cap": 2000,
  "pct_remaining": 20.0,
  "warning_threshold_pct": 20.0,
  "projected_exhaustion_at": "2026-02-21T14:27:30Z",
  "auto_action": "notify_orchestrator"
}
```

---

### 6.5 VENTURE_COMPLIANCE Stream Events

#### `compliance.ofac_check.passed.v1`

Emitted when an OFAC screening returns no matches.

**Subject:** `venture.compliance.compliance.ofac_check.passed.v1`

```json
{
  "entity_name": "Acme SaaS Tools LLC",
  "entity_type": "merchant",
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "screened_at": "2026-02-21T14:25:01Z",
  "result": "no_match",
  "max_similarity_score": 0.12,
  "screener_version": "ofac-sdn-2026-02-15",
  "list_version": "20260215"
}
```

---

#### `compliance.ofac_check.flagged.v1`

Emitted when an OFAC screening produces a potential match.

**Subject:** `venture.compliance.compliance.ofac_check.flagged.v1`

```json
{
  "entity_name": "Example Corp LLC",
  "entity_type": "merchant",
  "intent_id": "int_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "screened_at": "2026-02-21T13:10:00Z",
  "match_score": 0.94,
  "match_details": {
    "sdn_name": "Example Corporation",
    "sdn_id": "SDN-12345",
    "list": "OFAC SDN",
    "country": "IR"
  },
  "action_taken": "intent_blocked_pending_review",
  "compliance_case_id": "cas_01HX4BGJKT...",
  "pagerduty_alert_id": "PD-67890",
  "screener_version": "ofac-sdn-2026-02-15"
}
```

---

#### `compliance.pan_detected.v1`

Emitted when a Primary Account Number (credit card number) is detected in a payload.

**Subject:** `venture.compliance.compliance.pan_detected.v1`

```json
{
  "detection_id": "det_01HX4BGJKT...",
  "workflow_id": "wfl_01HX4BGJKT...",
  "agent_id": "agt_01HX4BGJKT...",
  "payload_location": "agent.tool_call.output",
  "detection_context": "web_search result contained card number pattern",
  "card_type_detected": "visa",
  "auto_action": "field_redacted",
  "redaction_applied": true,
  "detector_version": "luhn-scan-1.3.0",
  "pagerduty_alert_id": "PD-11111"
}
```

**Note:** The actual PAN is NEVER stored in the event. Only metadata about the detection is recorded.

---

#### `compliance.ctr_threshold.crossed.v1`

Emitted when cumulative transactions for a customer cross the $10,000 CTR reporting threshold (Bank Secrecy Act).

**Subject:** `venture.compliance.compliance.ctr_threshold.crossed.v1`

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "customer_id": "cus_01HX4BGJKT...",
  "period": "2026-02-21",
  "cumulative_amount_cents": 1005000,
  "threshold_cents": 1000000,
  "transaction_count": 47,
  "reporting_required": true,
  "ctr_deadline": "2026-02-28",
  "compliance_case_id": "cas_01HX4BGJKZ...",
  "detected_at": "2026-02-21T14:30:00Z"
}
```

---

#### `compliance.audit_chain.verified.v1`

Emitted periodically by the chain verifier confirming the BLAKE3 hash chain is intact.

**Subject:** `venture.compliance.compliance.audit_chain.verified.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "verified_through_seq": 142,
  "state_hash": "blake3:f9a8b7...",
  "entries_verified": 142,
  "verification_duration_ms": 234,
  "verified_at": "2026-02-21T14:35:00Z",
  "verifier_version": "chain-verify-1.0.0"
}
```

---

#### `compliance.audit_chain.broken.v1`

Emitted immediately upon detection of a broken hash chain (tamper or data corruption).

**Subject:** `venture.compliance.compliance.audit_chain.broken.v1`

```json
{
  "workflow_id": "wfl_01HX4BGJKT...",
  "seq_where_broken": 87,
  "expected_hash": "blake3:a1b2c3...",
  "actual_hash": "blake3:deadbe...",
  "entries_before_break": 86,
  "break_type": "hash_mismatch",
  "detected_at": "2026-02-21T14:35:02Z",
  "pagerduty_alert_id": "PD-99999",
  "auto_action": "workflow_frozen_pending_forensics",
  "verifier_version": "chain-verify-1.0.0"
}
```

**Severity: CRITICAL.** This event triggers an automatic PagerDuty page and freezes the affected workflow pending forensic review.

---

#### `compliance.policy_bundle.updated.v1`

Emitted when a new policy bundle is activated.

**Subject:** `venture.compliance.compliance.policy_bundle.updated.v1`

```json
{
  "bundle_id": "pbnd_01HX4BGJKT...",
  "prev_bundle_id": "pbnd_01HX4BGJKZ...",
  "activated_by": "founder:usr_01HX4BGJKT...",
  "activation_type": "manual_upload",
  "rule_count": 47,
  "rules_added": 2,
  "rules_removed": 0,
  "rules_modified": 1,
  "changes_summary": [
    "Added velocity_limit rule for MCC 7372",
    "Updated OFAC match threshold from 0.90 to 0.92"
  ],
  "activated_at": "2026-02-21T14:30:00Z",
  "effective_for_new_workflows_only": true
}
```

---

#### `compliance.workspace.frozen.v1`

Emitted when a workspace is frozen (all operations halted).

**Subject:** `venture.compliance.compliance.workspace.frozen.v1`

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "freeze_reason": "OFAC match flagged for review",
  "frozen_by": "compliance_engine",
  "frozen_at": "2026-02-21T14:25:05Z",
  "intents_revoked_count": 4,
  "workflows_paused_count": 2,
  "agent_sessions_terminated_count": 8,
  "compliance_case_id": "cas_01HX4BGJKT..."
}
```

---

#### `compliance.workspace.unfrozen.v1`

Emitted when a workspace freeze is lifted after review.

**Subject:** `venture.compliance.compliance.workspace.unfrozen.v1`

```json
{
  "workspace_id": "wks_01HX4BGJKT...",
  "unfrozen_by": "founder:usr_01HX4BGJKT...",
  "unfrozen_at": "2026-02-21T16:00:00Z",
  "freeze_duration_seconds": 5695,
  "review_outcome": "cleared",
  "review_notes": "OFAC match determined to be false positive",
  "compliance_case_id": "cas_01HX4BGJKT..."
}
```

---

## 7. Event Versioning Strategy

### 7.1 Version Lifecycle

Each event type follows a three-phase lifecycle:

| Phase       | Indicator           | Consumer Behavior                          |
|-------------|---------------------|--------------------------------------------|
| Active      | `.v1`, `.v2`        | Consume and process normally               |
| Deprecated  | `.v1_deprecated`    | Still published; consumers should migrate  |
| Removed     | (not published)     | Consumers must handle gracefully (ignore)  |

### 7.2 Schema Evolution Rules

**ALLOWED without version bump:**
- Adding new optional fields to the payload (consumers use `extra="ignore"`)
- Adding new enum values to open enums
- Adding new optional query parameters to HTTP endpoints
- Adding new response fields (clients must tolerate unknown fields)

**REQUIRES version bump (`.v1` -> `.v2`):**
- Removing or renaming existing payload fields
- Changing field type or format
- Making optional fields required
- Changing event semantics (same name, different meaning)

**PROCEDURE for breaking change:**
1. Introduce `.v2` event published in parallel with `.v1`
2. Mark `.v1` as deprecated in schema registry with deprecation date
3. Migrate all internal consumers to `.v2`
4. Stop publishing `.v1` after deprecation window (minimum 90 days)
5. Remove `.v1` from documentation (keep in archive)

### 7.3 Schema Registry

All schemas are registered in the `event_schemas` PostgreSQL table and mirrored to S3 at `s3://venture-schemas/events/<event_type>/<version>.json`.

```sql
-- event_schemas table (excerpt from DATA_MODEL_DB_SPEC.md)
CREATE TABLE event_schemas (
    schema_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type       TEXT NOT NULL,
    version          TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('active', 'deprecated', 'removed')),
    json_schema      JSONB NOT NULL,
    s3_url           TEXT NOT NULL,
    introduced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deprecated_at    TIMESTAMPTZ,
    removed_at       TIMESTAMPTZ,
    UNIQUE (event_type, version)
);
```

### 7.4 Consumer Forward Compatibility

All consumers MUST use `model_config = ConfigDict(extra="ignore")` (set in `VentureBaseModel`). This ensures that when new optional fields are added to a payload, existing consumers do not reject the message.

```python
# CORRECT: consumers tolerate unknown fields
class WorkflowSubmittedPayload(VentureBaseModel):
    # inherits extra="ignore" from VentureBaseModel
    workflow_id: WorkflowId
    workspace_id: WorkspaceId
    spec_hash: Blake3Hash
    budget_cap_eau: EAU
    task_count: int
    # Any future fields added to the event will be silently ignored
```

---

## 8. Idempotency

### 8.1 Behavior

All `POST` endpoints accept an `Idempotency-Key` header (UUID or any unique string up to 255 characters). When a request is received with an `Idempotency-Key`:

1. The server checks the `idempotency_keys` table (keyed by `workspace_id + key`).
2. If a matching key exists and was created within 24 hours, the cached HTTP response is returned immediately without reprocessing.
3. If no matching key exists, the request is processed normally and the response is stored.
4. If the key exists but the stored response is still being computed (in-flight), a 409 with `VENTURE_E009` is returned.

### 8.2 Storage

```sql
CREATE TABLE idempotency_keys (
    key_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(workspace_id),
    idempotency_key TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body   JSONB NOT NULL,
    response_hash   TEXT NOT NULL,  -- SHA-256 of response_body
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    UNIQUE (workspace_id, idempotency_key, endpoint)
);

CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
```

A background job purges expired rows hourly.

### 8.3 Client Usage Example

```python
import uuid
import httpx

idempotency_key = str(uuid.uuid4())

response = await client.post(
    "/v1/workflows",
    headers={"Idempotency-Key": idempotency_key},
    json=workflow_spec.model_dump(),
)

# On network failure, retry with the SAME idempotency_key:
response = await client.post(
    "/v1/workflows",
    headers={"Idempotency-Key": idempotency_key},  # same key
    json=workflow_spec.model_dump(),
)
# Returns the same 202 response — workflow not submitted twice
```

### 8.4 Idempotency Scope

| Endpoint                                    | Idempotency Scope      |
|---------------------------------------------|------------------------|
| POST /v1/workflows                          | Per workspace + key    |
| POST /v1/artifacts                          | Per workspace + key    |
| POST /v1/money/intents                      | Per workspace + key    |
| POST /v1/money/intents/{id}/execute         | Per intent_id (built-in; key not required) |
| POST /v1/workspaces                         | Per platform + key     |
| POST /v1/compliance/policies                | Per platform + key     |

---

## 9. Rate Limiting

### 9.1 Rate Limit Tiers

Rate limits are enforced per workspace, per endpoint, using a token bucket algorithm backed by NATS KV (`venture-rate-limit-counters`).

**Global per-workspace limits:**

| Tier          | Burst (req/s) | Sustained (req/s) | Notes                     |
|---------------|---------------|--------------------|---------------------------|
| Standard      | 100           | 20                 | Default for all workspaces |
| Enterprise    | 500           | 100                | Requires enterprise plan   |
| Internal      | unlimited     | unlimited          | Internal service accounts  |

**Per-endpoint limits (in addition to global):**

| Endpoint                            | Limit              | Window  |
|-------------------------------------|---------------------|---------|
| POST /v1/workflows                  | 10 requests         | 1 min   |
| POST /v1/money/intents              | 30 requests         | 1 min   |
| POST /v1/auth/token                 | 5 requests          | 1 min   |
| POST /v1/artifacts                  | 20 requests         | 1 min   |
| POST /v1/compliance/policies        | 5 requests          | 1 hour  |
| GET /v1/compliance/audit-log        | 60 requests         | 1 min   |

### 9.2 Response Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1740146700
X-RateLimit-Policy: workspace:100r/s:standard
```

### 9.3 Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1740146742
Content-Type: application/json

{
  "error_code": "VENTURE_E041",
  "error_message": "Workflow submission rate limit exceeded: 10 per minute",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "details": {
    "limit": 10,
    "window": "1m",
    "retry_after_seconds": 42
  }
}
```

---

## 10. Error Code Catalog

All error responses use the following body shape:

```json
{
  "error_code": "VENTURE_E0NN",
  "error_message": "Human-readable description",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "details": {}
}
```

### Auth Errors (E001–E009)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E001 | 400  | Malformed or missing client_id or client_secret       |
| VENTURE_E002 | 401  | Invalid client credentials                            |
| VENTURE_E003 | 403  | Workspace frozen — token issuance blocked             |
| VENTURE_E004 | 401  | Refresh token invalid or expired                      |
| VENTURE_E005 | 401  | Refresh token explicitly revoked                      |

### Workspace Errors (E006–E011)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E006 | 400  | budget_cap_cents invalid (must be >= 100)             |
| VENTURE_E007 | 400  | Policy bundle not found or inactive                   |
| VENTURE_E008 | 403  | Caller lacks required admin role                      |
| VENTURE_E009 | 409  | Idempotency key conflict (in-flight or collision)     |
| VENTURE_E010 | 404  | Workspace not found                                   |
| VENTURE_E011 | 403  | Access denied to this workspace                       |

### Workflow Errors (E012–E022)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E012 | 400  | Workflow spec fails Pydantic schema validation        |
| VENTURE_E013 | 400  | Task DAG contains a cycle                             |
| VENTURE_E014 | 400  | budget_cap_eau exceeds workspace remaining budget     |
| VENTURE_E015 | 403  | Workspace is frozen — workflow submission blocked     |
| VENTURE_E016 | 403  | Policy bundle mismatch — bundle_id not currently active |
| VENTURE_E017 | 422  | Task tool_allowlist contains a forbidden tool         |
| VENTURE_E018 | 404  | Workflow not found                                    |
| VENTURE_E019 | 409  | Workflow already in terminal state (cancel conflict)  |

### Artifact Errors (E020–E022)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E020 | 404  | Artifact not found                                    |
| VENTURE_E021 | 409  | Artifact download requested but render not complete   |
| VENTURE_E022 | 403  | Access denied to this artifact                        |

### Treasury Errors (E023–E039)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E023 | 400  | amount_cents must be a positive integer               |
| VENTURE_E024 | 400  | Unsupported or invalid currency code                  |
| VENTURE_E025 | 403  | Workspace frozen — intent creation blocked            |
| VENTURE_E026 | 422  | Amount exceeds single-intent limit                    |
| VENTURE_E027 | 422  | Merchant category code not in allowlist               |
| VENTURE_E028 | 404  | Intent not found                                      |
| VENTURE_E029 | 409  | Intent already executed                               |
| VENTURE_E030 | 409  | Intent has expired                                    |
| VENTURE_E031 | 409  | Intent rejected by policy — cannot execute            |
| VENTURE_E032 | 422  | Payment processor returned error (see details.code)   |
| VENTURE_E033 | 422  | Intent execution: insufficient workspace balance      |
| VENTURE_E034 | 404  | Ledger entry not found                                |
| VENTURE_E035 | 404  | Reconciliation period not found or not yet computed   |

### Rate Limit Errors (E040–E049)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E040 | 429  | Token issuance rate limit exceeded                    |
| VENTURE_E041 | 429  | Workflow submission rate limit exceeded               |
| VENTURE_E042 | 429  | Money intent rate limit exceeded                      |
| VENTURE_E043 | 429  | Global workspace rate limit exceeded                  |
| VENTURE_E044 | 429  | Artifact submission rate limit exceeded               |
| VENTURE_E045 | 429  | Audit log query rate limit exceeded                   |

### System Errors (E050+)

| Code         | HTTP | Description                                           |
|--------------|------|-------------------------------------------------------|
| VENTURE_E050 | 500  | Internal server error (see trace_id for diagnostics) |
| VENTURE_E051 | 502  | Upstream service unavailable (NATS / PostgreSQL)      |
| VENTURE_E052 | 503  | Service temporarily unavailable — circuit breaker open|
| VENTURE_E053 | 504  | Gateway timeout — upstream did not respond in time    |

---

## 11. SDK Examples

### 11.1 Python SDK

The Venture Python SDK wraps the HTTP API and WebSocket streaming with async support. It uses `httpx` for HTTP, `websockets` for streaming, and `pydantic` for all model validation.

#### Installation

```bash
pip install venture-sdk
```

#### Client Initialization

```python
# venture/client.py (SDK usage)
from venture import VentureClient
from venture.schemas.workflow import WorkflowSubmitRequest, TaskSpec, RetryPolicy

client = VentureClient(
    api_key="sec_...",          # client_secret
    client_id="wks_01HX4...",   # client_id (workspace ID)
    base_url="https://api.venture.autonomy",
    timeout_seconds=30,
)
# Client auto-refreshes JWT before expiry
```

#### Submit a Workflow

```python
import asyncio
from venture import VentureClient
from venture.schemas.workflow import WorkflowSubmitRequest, TaskSpec, RetryPolicy, SagaConfig

async def run_research_workflow():
    client = VentureClient(api_key="sec_...", client_id="wks_01HX4...")

    spec = WorkflowSubmitRequest(
        workspace_id="wks_01HX4BGJKT...",
        display_name="Competitor Analysis Q1 2026",
        budget_cap_eau=10000,
        policy_bundle_id="pbnd_01HX4BGJKT...",
        priority="normal",
        tasks=[
            TaskSpec(
                task_id="research",
                task_type="research",
                description="Gather competitor pricing from public sources",
                tool_allowlist=["web_search", "scrape_url"],
                eau_budget=4000,
                depends_on=[],
                timeout_seconds=300,
                retry_policy=RetryPolicy(
                    max_retries=3,
                    backoff_base_seconds=5.0,
                    backoff_multiplier=2.0,
                ),
            ),
            TaskSpec(
                task_id="synthesis",
                task_type="synthesis",
                description="Synthesize findings into structured slide deck",
                tool_allowlist=["artifact_compile"],
                eau_budget=4000,
                depends_on=["research"],
                timeout_seconds=600,
                retry_policy=RetryPolicy(max_retries=2),
            ),
        ],
        saga_config=SagaConfig(
            compensation_enabled=True,
            rollback_on_partial_failure=True,
        ),
        metadata={"project_tag": "q1-competitive"},
    )

    workflow = await client.workflows.submit(spec)
    print(f"Workflow submitted: {workflow.workflow_id} status={workflow.status}")
    return workflow

asyncio.run(run_research_workflow())
```

#### Stream Workflow Events

```python
import asyncio
from venture import VentureClient
from venture.schemas.events import EventEnvelopeV1

async def stream_workflow(workflow_id: str):
    client = VentureClient(api_key="sec_...", client_id="wks_01HX4...")

    async for event in client.workflows.stream(workflow_id):
        # event is a validated EventEnvelopeV1
        print(f"[seq={event.seq}] {event.event_type}")
        print(f"  payload: {event.payload}")

        if event.event_type == "workflow.task.failed.v1":
            print(f"  TASK FAILED: {event.payload['error_message']}")
            print(f"  Retries remaining: {event.payload['retries_remaining']}")

        if event.event_type in ("workflow.completed.v1", "workflow.cancelled.v1"):
            print(f"  Terminal state reached: {event.event_type}")
            break

asyncio.run(stream_workflow("wfl_01HX4BGJKT..."))
```

#### Submit a Money Intent

```python
import asyncio
from venture import VentureClient
from venture.schemas.treasury import IntentCreateRequest

async def create_and_execute_intent():
    client = VentureClient(api_key="sec_...", client_id="wks_01HX4...")

    intent_request = IntentCreateRequest(
        workflow_id="wfl_01HX4BGJKT...",
        workspace_id="wks_01HX4BGJKT...",
        amount_cents=4999,
        currency="USD",
        merchant_descriptor="Acme SaaS Tools LLC",
        merchant_category_code="7372",
        description="API subscription for research tooling",
        tool_name="web_search_pro",
    )

    # Create intent (pre-auth; no charge yet)
    intent = await client.money.create_intent(intent_request)
    print(f"Intent created: {intent.intent_id} status={intent.status}")

    # Poll until approved (or use webhook)
    import asyncio
    for _ in range(10):
        status = await client.money.get_intent(intent.intent_id)
        if status.policy_decision.decision == "approved":
            break
        if status.policy_decision.decision == "rejected":
            print(f"Intent rejected: {status.policy_decision.rejection_reason}")
            return
        await asyncio.sleep(0.5)

    # Execute the approved intent
    result = await client.money.execute_intent(intent.intent_id)
    print(f"Intent executed: charge={result.stripe_charge_id} settled={result.amount_settled_cents}c")

asyncio.run(create_and_execute_intent())
```

#### Download an Artifact

```python
import asyncio
import aiofiles
from venture import VentureClient

async def download_artifact(artifact_id: str, output_path: str):
    client = VentureClient(api_key="sec_...", client_id="wks_01HX4...")

    # Check status first
    artifact = await client.artifacts.get(artifact_id)
    if artifact.status != "completed":
        print(f"Artifact not ready: status={artifact.status}")
        return

    print(f"Downloading {artifact.spec_type} ({artifact.size_bytes} bytes)...")

    async with aiofiles.open(output_path, "wb") as f:
        async for chunk in client.artifacts.download_stream(artifact_id):
            await f.write(chunk)

    print(f"Saved to {output_path}")

asyncio.run(download_artifact("art_01HX4BGJKT...", "/tmp/output.pptx"))
```

#### SDK Internal Structure

```python
# venture/__init__.py
from venture.client import VentureClient

# venture/client.py
from __future__ import annotations
import httpx
from venture.resources.workflows import WorkflowsResource
from venture.resources.artifacts import ArtifactsResource
from venture.resources.money import MoneyResource
from venture.resources.compliance import ComplianceResource
from venture.auth import TokenManager


class VentureClient:
    """Async Venture SDK client. Thread-safe. Reuse a single instance."""

    def __init__(
        self,
        api_key: str,
        client_id: str,
        base_url: str = "https://api.venture.autonomy",
        timeout_seconds: float = 30.0,
    ) -> None:
        self._token_manager = TokenManager(
            client_id=client_id,
            client_secret=api_key,
            base_url=base_url,
        )
        self._http = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout_seconds,
        )
        self.workflows = WorkflowsResource(self._http, self._token_manager)
        self.artifacts = ArtifactsResource(self._http, self._token_manager)
        self.money = MoneyResource(self._http, self._token_manager)
        self.compliance = ComplianceResource(self._http, self._token_manager)

    async def __aenter__(self) -> "VentureClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self._http.aclose()
```

---

### 11.2 TypeScript SDK

The Venture TypeScript SDK targets Node.js 20+ and browser environments. It uses `fetch` for HTTP and native `WebSocket` for streaming.

#### Installation

```bash
npm install @venture/sdk
# or
bun add @venture/sdk
```

#### Client Initialization

```typescript
// TypeScript SDK usage
import { VentureClient } from "@venture/sdk";

const client = new VentureClient({
  apiKey: "sec_...",
  clientId: "wks_01HX4...",
  baseUrl: "https://api.venture.autonomy",
});
```

#### Submit a Workflow

```typescript
import { VentureClient, WorkflowSubmitRequest } from "@venture/sdk";

const client = new VentureClient({
  apiKey: process.env.VENTURE_API_KEY!,
  clientId: process.env.VENTURE_CLIENT_ID!,
});

const spec: WorkflowSubmitRequest = {
  workspaceId: "wks_01HX4BGJKT...",
  displayName: "Competitor Analysis Q1 2026",
  budgetCapEau: 10000,
  policyBundleId: "pbnd_01HX4BGJKT...",
  priority: "normal",
  tasks: [
    {
      taskId: "research",
      taskType: "research",
      description: "Gather competitor pricing",
      toolAllowlist: ["web_search", "scrape_url"],
      eauBudget: 4000,
      dependsOn: [],
      timeoutSeconds: 300,
      retryPolicy: {
        maxRetries: 3,
        backoffBaseSeconds: 5,
        backoffMultiplier: 2.0,
      },
    },
    {
      taskId: "synthesis",
      taskType: "synthesis",
      description: "Synthesize into slide deck",
      toolAllowlist: ["artifact_compile"],
      eauBudget: 4000,
      dependsOn: ["research"],
      timeoutSeconds: 600,
      retryPolicy: { maxRetries: 2 },
    },
  ],
  sagaConfig: {
    compensationEnabled: true,
    rollbackOnPartialFailure: true,
  },
  metadata: { projectTag: "q1-competitive" },
};

const workflow = await client.workflows.submit(spec);
console.log(`Workflow submitted: ${workflow.workflowId} status=${workflow.status}`);
```

#### Stream Workflow Events

```typescript
import { VentureClient, EventEnvelopeV1 } from "@venture/sdk";

const client = new VentureClient({
  apiKey: process.env.VENTURE_API_KEY!,
  clientId: process.env.VENTURE_CLIENT_ID!,
});

// AsyncIterable stream of EventEnvelopeV1
for await (const event of client.workflows.stream("wfl_01HX4BGJKT...")) {
  console.log(`[seq=${event.seq}] ${event.eventType}`);

  if (event.eventType === "workflow.task.failed.v1") {
    const p = event.payload as { errorMessage: string; retriesRemaining: number };
    console.error(`Task failed: ${p.errorMessage} (${p.retriesRemaining} retries left)`);
  }

  const terminalEvents = new Set([
    "workflow.completed.v1",
    "workflow.cancelled.v1",
  ]);

  if (terminalEvents.has(event.eventType)) {
    console.log(`Workflow reached terminal state: ${event.eventType}`);
    break;
  }
}
```

#### Create and Execute a Money Intent

```typescript
import { VentureClient, IntentCreateRequest } from "@venture/sdk";

const client = new VentureClient({
  apiKey: process.env.VENTURE_API_KEY!,
  clientId: process.env.VENTURE_CLIENT_ID!,
});

const intentRequest: IntentCreateRequest = {
  workflowId: "wfl_01HX4BGJKT...",
  workspaceId: "wks_01HX4BGJKT...",
  amountCents: 4999,
  currency: "USD",
  merchantDescriptor: "Acme SaaS Tools LLC",
  merchantCategoryCode: "7372",
  description: "API subscription for research tooling",
  toolName: "web_search_pro",
};

const intent = await client.money.createIntent(intentRequest);
console.log(`Intent created: ${intent.intentId}`);

// Poll for policy decision
let status = await client.money.getIntent(intent.intentId);
while (status.policyDecision.decision === "pending") {
  await new Promise((r) => setTimeout(r, 500));
  status = await client.money.getIntent(intent.intentId);
}

if (status.policyDecision.decision === "rejected") {
  throw new Error(`Intent rejected: ${status.policyDecision.rejectionReason}`);
}

// Execute
const result = await client.money.executeIntent(intent.intentId);
console.log(
  `Intent executed: charge=${result.stripeChargeId} settled=${result.amountSettledCents}c`
);
```

#### Full SDK Type Definitions (excerpt)

```typescript
// @venture/sdk/types.ts

export interface EventEnvelopeV1 {
  eventId: string;            // UUIDv7
  eventType: string;          // e.g. "workflow.submitted.v1"
  workflowId: string;
  traceId: string;
  policyBundleId: string;
  createdAt: string;          // ISO-8601 UTC
  schemaVersion: "v1";
  seq: number;
  prevHash: string;           // "blake3:<hex>"
  payload: Record<string, unknown>;
}

export interface WorkflowSubmitRequest {
  workspaceId: string;
  displayName: string;
  budgetCapEau: number;
  policyBundleId: string;
  priority: "low" | "normal" | "high";
  tasks: TaskSpec[];
  sagaConfig?: SagaConfig;
  metadata?: Record<string, string>;
}

export interface TaskSpec {
  taskId: string;
  taskType: "research" | "synthesis" | "code_generation" | "data_analysis" |
            "artifact_compile" | "money_intent" | "compliance_check" | "custom";
  description: string;
  toolAllowlist: string[];
  eauBudget: number;
  dependsOn: string[];
  timeoutSeconds?: number;
  retryPolicy?: RetryPolicy;
  parameters?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxRetries?: number;
  backoffBaseSeconds?: number;
  backoffMultiplier?: number;
  maxBackoffSeconds?: number;
}

export interface SagaConfig {
  compensationEnabled?: boolean;
  rollbackOnPartialFailure?: boolean;
  maxCompensationSeconds?: number;
}

export interface WorkflowSubmitResponse {
  workflowId: string;
  status: WorkflowStatus;
  specHash: string;
  taskCount: number;
  budgetCapEau: number;
  estimatedStartAt: string | null;
  traceId: string;
}

export type WorkflowStatus =
  | "submitted" | "running" | "completed"
  | "failed" | "cancelled" | "compensating";

export interface IntentCreateRequest {
  workflowId: string;
  workspaceId: string;
  amountCents: number;
  currency: string;
  merchantDescriptor: string;
  merchantCategoryCode: string;
  description: string;
  toolName: string;
  metadata?: Record<string, string>;
}

export interface IntentCreateResponse {
  intentId: string;
  status: IntentStatus;
  amountCents: number;
  currency: string;
  merchantDescriptor: string;
  expiresAt: string;
  policyCheckStatus: "pending" | "approved" | "rejected";
  traceId: string;
}

export type IntentStatus =
  | "pending" | "approved" | "rejected" | "executed"
  | "expired" | "revoked" | "failed";
```

---

## 12. Sequence Diagrams

### 12.1 Workflow Submission and Execution

```
Founder/Client          control-plane-api       policy-engine        venture-orchestrator        NATS JetStream
     │                         │                      │                       │                       │
     │  POST /v1/workflows      │                      │                       │                       │
     │─────────────────────────►│                      │                       │                       │
     │                         │ Validate JWT          │                       │                       │
     │                         │ Validate spec         │                       │                       │
     │                         │─────────────────────►│                       │                       │
     │                         │  policy.check_spec    │                       │                       │
     │                         │◄─────────────────────│                       │                       │
     │                         │  {allowed: true}      │                       │                       │
     │                         │                       │                       │                       │
     │                         │  Publish event        │                       │                       │
     │                         │──────────────────────────────────────────────────────────────────────►│
     │                         │  workflow.submitted.v1                        │                       │
     │◄─────────────────────────│                       │                       │                       │
     │  202 {workflow_id}       │                       │                       │                       │
     │                         │                       │ Subscribe             │                       │
     │                         │                       │◄──────────────────────────────────────────────│
     │                         │                       │  VENTURE_WORKFLOW     │                       │
     │                         │                       │                       │◄──────────────────────│
     │                         │                       │                       │  Consume event        │
     │                         │                       │                       │                       │
     │                         │                       │                       │  Assign agent         │
     │                         │                       │                       │  Publish task.started │
     │                         │                       │                       │──────────────────────►│
     │                         │                       │                       │  workflow.task.started│
     │                         │                       │                       │                       │
     │  (WebSocket streaming)   │                       │                       │                       │
     │◄─────────────────────────────────────────────────────────────────────────────────────────────────│
     │  workflow.task.started   │                       │                       │                       │
```

### 12.2 Money Intent Lifecycle

```
Agent                   treasury-api            policy-engine          Stripe              NATS JetStream
  │                          │                       │                    │                      │
  │  POST /v1/money/intents  │                       │                    │                      │
  │─────────────────────────►│                       │                    │                      │
  │                          │  Publish              │                    │                      │
  │                          │─────────────────────────────────────────────────────────────────►│
  │                          │  money.intent.created │                    │                      │
  │◄─────────────────────────│                       │                    │                      │
  │  202 {intent_id}         │                       │                    │                      │
  │                          │                       │ Consume event      │                      │
  │                          │                       │◄─────────────────────────────────────────│
  │                          │  OFAC check           │                    │                      │
  │                          │  Velocity check       │                    │                      │
  │                          │  Budget check         │                    │                      │
  │                          │                       │ Decision: approved │                      │
  │                          │                       │─────────────────────────────────────────►│
  │                          │                       │ money.intent.approved                    │
  │                          │                       │                    │                      │
  │  POST /intents/{id}/exec │                       │                    │                      │
  │─────────────────────────►│                       │                    │                      │
  │                          │  Acquire intent lock  │                    │                      │
  │                          │  (NATS KV)            │                    │                      │
  │                          │─────────────────────────────────────────►│                       │
  │                          │                       │  stripe.charge     │                      │
  │                          │                       │                    │                      │
  │                          │◄─────────────────────────────────────────│                       │
  │                          │  charge confirmed     │                    │                      │
  │                          │  Publish events       │                    │                      │
  │                          │─────────────────────────────────────────────────────────────────►│
  │                          │  money.intent.executed.v1                 │                      │
  │                          │  money.ledger.transfer.v1                 │                      │
  │◄─────────────────────────│                       │                    │                      │
  │  200 {ledger_entry_id}   │                       │                    │                      │
```

### 12.3 Audit Chain Verification

```
chain-verifier          PostgreSQL              NATS JetStream          PagerDuty
      │                     │                        │                      │
      │  SELECT events      │                        │                      │
      │  WHERE seq >= last  │                        │                      │
      │────────────────────►│                        │                      │
      │◄────────────────────│                        │                      │
      │  [events...]        │                        │                      │
      │                     │                        │                      │
      │  Recompute BLAKE3   │                        │                      │
      │  chain for each seq │                        │                      │
      │                     │                        │                      │
      │  (chain intact)     │                        │                      │
      │  Publish verified   │                        │                      │
      │───────────────────────────────────────────►│                       │
      │  compliance.audit_chain.verified.v1         │                      │
      │                     │                        │                      │
      │  (chain broken!)    │                        │                      │
      │  Publish broken     │                        │                      │
      │───────────────────────────────────────────►│                       │
      │  compliance.audit_chain.broken.v1           │                      │
      │                     │                        │  Alert               │
      │                     │                        │─────────────────────►│
      │  Freeze workflow    │                        │  PD-99999            │
      │────────────────────►│                        │                      │
```

### 12.4 Workspace Freeze Cascade

```
Founder/Compliance      control-plane-api      treasury-api          venture-orchestrator
        │                       │                    │                        │
        │  PATCH /workspaces    │                    │                        │
        │  /{id}/freeze         │                    │                        │
        │──────────────────────►│                    │                        │
        │                       │  Revoke pending    │                        │
        │                       │  intents           │                        │
        │                       │──────────────────►│                         │
        │                       │  {intents_revoked}│                         │
        │                       │                   │                         │
        │                       │  Pause running    │                         │
        │                       │  workflows        │                         │
        │                       │───────────────────────────────────────────►│
        │                       │                   │                         │
        │                       │  Publish          │                         │
        │                       │  compliance.workspace.frozen.v1             │
        │◄──────────────────────│                   │                         │
        │  200 {frozen}         │                   │                         │
```

---

## 13. Appendix A — Full JSON Schema Registry

### A.1 EventEnvelopeV1 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://venture.autonomy/schemas/v1/event-envelope.json",
  "title": "EventEnvelopeV1",
  "description": "Canonical event envelope for all Venture platform events.",
  "type": "object",
  "required": [
    "event_id", "event_type", "workflow_id", "trace_id",
    "policy_bundle_id", "created_at", "schema_version",
    "seq", "prev_hash", "payload"
  ],
  "additionalProperties": false,
  "properties": {
    "event_id": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
      "description": "UUIDv7 — lexicographically sortable, time-prefixed event identifier."
    },
    "event_type": {
      "type": "string",
      "pattern": "^(workflow|artifact|money|agent|compliance)\\.[a-z][a-z0-9_.]*\\.v[0-9]+$",
      "examples": [
        "workflow.submitted.v1",
        "artifact.render.completed.v1",
        "money.intent.executed.v1",
        "agent.tool_call.v1",
        "compliance.ofac_check.passed.v1"
      ]
    },
    "workflow_id": {
      "type": "string",
      "pattern": "^wfl_[0-9A-Za-z]{20,}$",
      "description": "Prefixed workflow identifier."
    },
    "trace_id": {
      "type": "string",
      "minLength": 20,
      "maxLength": 128,
      "description": "Distributed trace ID propagated from HTTP request."
    },
    "policy_bundle_id": {
      "type": "string",
      "pattern": "^pbnd_[0-9A-Za-z]{20,}$",
      "description": "Active policy bundle ID at event creation time."
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "UTC ISO-8601 timestamp. Must be within ±5 minutes of server time."
    },
    "schema_version": {
      "type": "string",
      "enum": ["v1"],
      "description": "Schema version. Unknown versions are rejected at ingest."
    },
    "seq": {
      "type": "integer",
      "minimum": 1,
      "description": "Monotonic sequence number within the workflow event chain."
    },
    "prev_hash": {
      "type": "string",
      "pattern": "^blake3:[0-9a-f]{64}$",
      "description": "BLAKE3 of previous EventEnvelopeV1 (canonical JSON). blake3:000...0 for seq=1."
    },
    "payload": {
      "type": "object",
      "description": "Event-type-specific payload. Schema validated per event_type."
    }
  }
}
```

### A.2 WorkflowSubmitRequest JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://venture.autonomy/schemas/v1/workflow-submit-request.json",
  "title": "WorkflowSubmitRequest",
  "type": "object",
  "required": ["workspace_id", "display_name", "budget_cap_eau", "policy_bundle_id", "tasks"],
  "properties": {
    "workspace_id": { "type": "string", "pattern": "^wks_[0-9A-Za-z]{20,}$" },
    "display_name": { "type": "string", "minLength": 1, "maxLength": 255 },
    "budget_cap_eau": { "type": "integer", "minimum": 1, "maximum": 10000000 },
    "policy_bundle_id": { "type": "string", "pattern": "^pbnd_[0-9A-Za-z]{20,}$" },
    "priority": { "type": "string", "enum": ["low", "normal", "high"], "default": "normal" },
    "tasks": {
      "type": "array",
      "minItems": 1,
      "maxItems": 100,
      "items": { "$ref": "#/$defs/TaskSpec" }
    },
    "saga_config": { "$ref": "#/$defs/SagaConfig" },
    "metadata": { "type": "object", "additionalProperties": { "type": "string" } }
  },
  "$defs": {
    "TaskSpec": {
      "type": "object",
      "required": ["task_id", "task_type", "description", "eau_budget"],
      "properties": {
        "task_id": { "type": "string", "pattern": "^[a-zA-Z0-9_-]{1,64}$" },
        "task_type": {
          "type": "string",
          "enum": ["research", "synthesis", "code_generation", "data_analysis",
                   "artifact_compile", "money_intent", "compliance_check", "custom"]
        },
        "description": { "type": "string", "maxLength": 4096 },
        "tool_allowlist": { "type": "array", "items": { "type": "string" } },
        "eau_budget": { "type": "integer", "minimum": 1 },
        "depends_on": { "type": "array", "items": { "type": "string" } },
        "timeout_seconds": { "type": "integer", "minimum": 10, "maximum": 86400, "default": 300 },
        "retry_policy": { "$ref": "#/$defs/RetryPolicy" },
        "parameters": { "type": "object" }
      }
    },
    "RetryPolicy": {
      "type": "object",
      "properties": {
        "max_retries": { "type": "integer", "minimum": 0, "maximum": 10, "default": 3 },
        "backoff_base_seconds": { "type": "number", "minimum": 0.5, "default": 5.0 },
        "backoff_multiplier": { "type": "number", "minimum": 1.0, "maximum": 10.0, "default": 2.0 },
        "max_backoff_seconds": { "type": "number", "default": 300.0 }
      }
    },
    "SagaConfig": {
      "type": "object",
      "properties": {
        "compensation_enabled": { "type": "boolean", "default": true },
        "rollback_on_partial_failure": { "type": "boolean", "default": true },
        "max_compensation_seconds": { "type": "integer", "minimum": 30, "default": 300 }
      }
    }
  }
}
```

### A.3 IntentCreateRequest JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://venture.autonomy/schemas/v1/intent-create-request.json",
  "title": "IntentCreateRequest",
  "type": "object",
  "required": [
    "workflow_id", "workspace_id", "amount_cents", "currency",
    "merchant_descriptor", "merchant_category_code", "description", "tool_name"
  ],
  "properties": {
    "workflow_id": { "type": "string", "pattern": "^wfl_[0-9A-Za-z]{20,}$" },
    "workspace_id": { "type": "string", "pattern": "^wks_[0-9A-Za-z]{20,}$" },
    "amount_cents": { "type": "integer", "minimum": 1, "maximum": 1000000 },
    "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
    "merchant_descriptor": { "type": "string", "minLength": 1, "maxLength": 255 },
    "merchant_category_code": {
      "type": "string",
      "pattern": "^\\d{4}$",
      "enum": ["7372", "7374", "5045", "7379", "7375", "4816"]
    },
    "description": { "type": "string", "maxLength": 1000 },
    "tool_name": { "type": "string", "maxLength": 255 },
    "metadata": { "type": "object", "additionalProperties": { "type": "string" } }
  }
}
```

### A.4 Event Catalog Summary Table

The following table maps every event to its NATS subject, the HTTP endpoint that triggers it, and the stream it is stored in.

| Event Type                            | NATS Subject (full)                                          | Trigger                              | Stream              |
|---------------------------------------|--------------------------------------------------------------|--------------------------------------|---------------------|
| workflow.submitted.v1                 | venture.workflow.workflow.submitted.v1                       | POST /v1/workflows                   | VENTURE_WORKFLOW    |
| workflow.task.started.v1              | venture.workflow.workflow.task.started.v1                    | Orchestrator dispatch                | VENTURE_WORKFLOW    |
| workflow.task.completed.v1            | venture.workflow.workflow.task.completed.v1                  | Agent completion                     | VENTURE_WORKFLOW    |
| workflow.task.failed.v1               | venture.workflow.workflow.task.failed.v1                     | Agent failure                        | VENTURE_WORKFLOW    |
| workflow.completed.v1                 | venture.workflow.workflow.completed.v1                       | All tasks complete                   | VENTURE_WORKFLOW    |
| workflow.cancelled.v1                 | venture.workflow.workflow.cancelled.v1                       | POST /v1/workflows/{id}/cancel       | VENTURE_WORKFLOW    |
| workflow.saga.compensating.v1         | venture.workflow.workflow.saga.compensating.v1               | Saga rollback trigger                | VENTURE_WORKFLOW    |
| artifact.spec_validated.v1            | venture.artifact.artifact.spec_validated.v1                  | POST /v1/artifacts                   | VENTURE_ARTIFACT    |
| artifact.render.started.v1            | venture.artifact.artifact.render.started.v1                  | Compiler picks up job                | VENTURE_ARTIFACT    |
| artifact.render.chunk.v1              | venture.artifact.artifact.render.chunk.v1                    | Each render stage completes          | VENTURE_ARTIFACT    |
| artifact.render.completed.v1          | venture.artifact.artifact.render.completed.v1                | Render pipeline finishes             | VENTURE_ARTIFACT    |
| artifact.render.failed.v1             | venture.artifact.artifact.render.failed.v1                   | Render pipeline error                | VENTURE_ARTIFACT    |
| artifact.version.promoted.v1          | venture.artifact.artifact.version.promoted.v1                | QA checks pass                       | VENTURE_ARTIFACT    |
| artifact.quality.validated.v1         | venture.artifact.artifact.quality.validated.v1               | All QA checks pass                   | VENTURE_ARTIFACT    |
| artifact.quality.failed.v1            | venture.artifact.artifact.quality.failed.v1                  | QA check fails below threshold       | VENTURE_ARTIFACT    |
| money.intent.created.v1               | venture.money.money.intent.created.v1                        | POST /v1/money/intents               | VENTURE_MONEY       |
| money.intent.approved.v1              | venture.money.money.intent.approved.v1                       | Policy engine approval               | VENTURE_MONEY       |
| money.intent.rejected.v1              | venture.money.money.intent.rejected.v1                       | Policy engine rejection              | VENTURE_MONEY       |
| money.intent.executed.v1              | venture.money.money.intent.executed.v1                       | POST /v1/money/intents/{id}/execute  | VENTURE_MONEY       |
| money.intent.expired.v1               | venture.money.money.intent.expired.v1                        | TTL expiry job                       | VENTURE_MONEY       |
| money.intent.revoked.v1               | venture.money.money.intent.revoked.v1                        | Workspace freeze / cancel            | VENTURE_MONEY       |
| money.ledger.transfer.v1              | venture.money.money.ledger.transfer.v1                       | Post-execution ledger record         | VENTURE_MONEY       |
| money.reconciliation.mismatch.v1      | venture.money.money.reconciliation.mismatch.v1               | Reconciliation engine                | VENTURE_MONEY       |
| money.budget.exhausted.v1             | venture.money.money.budget.exhausted.v1                      | Budget cap reached                   | VENTURE_MONEY       |
| money.velocity_limit.hit.v1           | venture.money.money.velocity_limit.hit.v1                    | Velocity rule triggered              | VENTURE_MONEY       |
| agent.session.created.v1              | venture.agent.agent.session.created.v1                       | Orchestrator session issue           | VENTURE_AGENT       |
| agent.session.revoked.v1              | venture.agent.agent.session.revoked.v1                       | Cancel / freeze / timeout            | VENTURE_AGENT       |
| agent.tool_call.v1                    | venture.agent.agent.tool_call.v1                             | Each agent tool invocation           | VENTURE_AGENT       |
| agent.injection.detected.v1           | venture.agent.agent.injection.detected.v1                    | Injection detector fires             | VENTURE_AGENT       |
| agent.heartbeat.v1                    | venture.agent.agent.heartbeat.v1                             | Agent every 30 seconds               | VENTURE_AGENT       |
| agent.timeout.v1                      | venture.agent.agent.timeout.v1                               | Heartbeat monitor                    | VENTURE_AGENT       |
| agent.policy_violation.v1             | venture.agent.agent.policy_violation.v1                      | Policy engine blocks agent action    | VENTURE_AGENT       |
| agent.eau_budget.warning.v1           | venture.agent.agent.eau_budget.warning.v1                    | EAU at 80% of cap                    | VENTURE_AGENT       |
| compliance.ofac_check.passed.v1       | venture.compliance.compliance.ofac_check.passed.v1           | OFAC screener (each intent)          | VENTURE_COMPLIANCE  |
| compliance.ofac_check.flagged.v1      | venture.compliance.compliance.ofac_check.flagged.v1          | OFAC screener match                  | VENTURE_COMPLIANCE  |
| compliance.pan_detected.v1            | venture.compliance.compliance.pan_detected.v1                | PAN scanner                          | VENTURE_COMPLIANCE  |
| compliance.ctr_threshold.crossed.v1   | venture.compliance.compliance.ctr_threshold.crossed.v1       | CTR accumulator                      | VENTURE_COMPLIANCE  |
| compliance.audit_chain.verified.v1    | venture.compliance.compliance.audit_chain.verified.v1        | Chain verifier (periodic)            | VENTURE_COMPLIANCE  |
| compliance.audit_chain.broken.v1      | venture.compliance.compliance.audit_chain.broken.v1          | Chain verifier (tamper detected)     | VENTURE_COMPLIANCE  |
| compliance.policy_bundle.updated.v1   | venture.compliance.compliance.policy_bundle.updated.v1       | POST /v1/compliance/policies         | VENTURE_COMPLIANCE  |
| compliance.workspace.frozen.v1        | venture.compliance.compliance.workspace.frozen.v1            | PATCH /v1/workspaces/{id}/freeze     | VENTURE_COMPLIANCE  |
| compliance.workspace.unfrozen.v1      | venture.compliance.compliance.workspace.unfrozen.v1          | PATCH /v1/workspaces/{id}/freeze     | VENTURE_COMPLIANCE  |

### A.5 Tool Allowlist Reference

The following table lists all recognized tool names and the policy rule that governs their use.

| Tool Name           | Category          | MCC    | Policy Rule             | Notes                                   |
|---------------------|-------------------|--------|-------------------------|-----------------------------------------|
| web_search          | research          | 7375   | rule_tool_web_search    | Read-only; no form submission           |
| scrape_url          | research          | 7375   | rule_tool_scrape_url    | Rate limited to 60 req/min per agent    |
| code_exec           | development       | 7372   | rule_tool_code_exec     | Sandboxed; no network; no filesystem    |
| artifact_compile    | artifact          | 7372   | rule_tool_artifact      | Only via artifact-compiler service      |
| db_query_read       | data              | 7372   | rule_tool_db_query      | SELECT only; no mutations               |
| file_read           | storage           | —      | rule_tool_file_read     | Workspace-scoped S3 only                |
| file_write          | storage           | —      | rule_tool_file_write    | Workspace-scoped S3 only                |
| send_notification   | communication     | —      | rule_tool_notify        | Limited to platform notification system |
| compliance_check    | compliance        | —      | rule_tool_compliance    | OFAC + PAN scan only                    |
| llm_call            | ai                | 7372   | rule_tool_llm           | Rate limited; prompt logging enabled    |

**Tools NEVER in allowlist (system reserved):**

- `send_email` — prohibited; use `send_notification`
- `ssh_connect` — prohibited
- `browser_control` — prohibited
- `process_spawn` — prohibited
- `network_raw` — prohibited

### A.6 HTTP Endpoint Summary

| Method | Path                                       | Auth Required | Rate Limit     | Idempotency |
|--------|--------------------------------------------|---------------|----------------|-------------|
| POST   | /v1/auth/token                             | No            | 5/min          | No          |
| POST   | /v1/auth/refresh                           | No            | 10/min         | No          |
| DELETE | /v1/auth/token                             | Yes           | 60/min         | No          |
| POST   | /v1/workspaces                             | Yes (admin)   | 10/min         | Yes         |
| GET    | /v1/workspaces/{workspace_id}              | Yes           | 120/min        | No          |
| GET    | /v1/workspaces/{workspace_id}/budget       | Yes           | 120/min        | No          |
| PATCH  | /v1/workspaces/{workspace_id}/freeze       | Yes (admin)   | 10/min         | Yes         |
| GET    | /v1/workspaces/{workspace_id}/agents       | Yes           | 60/min         | No          |
| POST   | /v1/workflows                              | Yes           | 10/min         | Yes         |
| GET    | /v1/workflows/{workflow_id}                | Yes           | 120/min        | No          |
| GET    | /v1/workflows/{workflow_id}/events         | Yes           | 60/min         | No          |
| POST   | /v1/workflows/{workflow_id}/cancel         | Yes           | 30/min         | Yes         |
| GET    | /v1/workflows                              | Yes           | 60/min         | No          |
| POST   | /v1/artifacts                              | Yes           | 20/min         | Yes         |
| GET    | /v1/artifacts/{artifact_id}                | Yes           | 120/min        | No          |
| GET    | /v1/artifacts/{artifact_id}/download       | Yes           | 30/min         | No          |
| GET    | /v1/artifacts/{artifact_id}/versions       | Yes           | 60/min         | No          |
| POST   | /v1/money/intents                          | Yes           | 30/min         | Yes         |
| GET    | /v1/money/intents/{intent_id}              | Yes           | 120/min        | No          |
| POST   | /v1/money/intents/{intent_id}/execute      | Yes           | 60/min         | Built-in    |
| GET    | /v1/money/ledger                           | Yes           | 60/min         | No          |
| GET    | /v1/money/reconciliation/{period}          | Yes           | 10/min         | No          |
| GET    | /v1/compliance/audit-log                   | Yes           | 60/min         | No          |
| GET    | /v1/compliance/violations                  | Yes           | 60/min         | No          |
| POST   | /v1/compliance/policies                    | Yes (admin)   | 5/hour         | Yes         |
| WS     | /v1/workflows/{workflow_id}/stream         | Yes (token=)  | 10 conn/wks    | N/A         |
| WS     | /v1/agents/{agent_id}/stream               | Yes (token=)  | 50 conn/wks    | N/A         |

---

*End of Venture-Autonomy API and Events Specification v2.0.0*
*Generated: 2026-02-21 | Owner: Venture Platform Engineering | Spec ID: SPEC-API-EVENTS-001*

