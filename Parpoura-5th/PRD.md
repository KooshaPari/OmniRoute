# Product Requirements Document -- parpour (Venture Autonomy Platform)

## Product Vision

Parpour is the Venture Autonomy Platform: a Python/FastAPI service that automates
workflow orchestration, treasury compliance, and agent control-plane operations for
AI-driven venture portfolios. It provides a founder-facing REST API, a WebSocket
streaming layer for real-time workflow updates, a double-entry financial ledger backed
by PostgreSQL, a NATS JetStream event bus with typed envelopes, and a freeze/unfreeze
control plane for global agent execution governance.

---

## E1: Workflow Orchestration

### E1.1: Workflow CRUD API

As a founder, I can create, list, retrieve, and cancel workflows through the REST API
so I can manage autonomous workstreams programmatically.

**Acceptance Criteria:**
- `POST /workflows` creates a workflow with `objective` (str) and optional `budget_cents` (int,
  default 100000), returns `{workflow_id, status, budget_allocated, ...}`.
- `GET /workflows` lists all workflows with their current status.
- `GET /workflows/{workflow_id}` returns the full workflow object or 404.
- `POST /workflows/{workflow_id}/cancel` transitions status to `CANCELLED` and records
  `updated_at` timestamp.
- All workflow objects carry: `id`, `objective`, `budget_allocated`, `budget_spent`,
  `status` (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED), `created_at`.
- `test_api_main.py` covers all four endpoints.

### E1.2: Workflow State Machine

As a founder, workflow status transitions follow a defined state machine so invalid
transitions are rejected and audit trails are maintained.

**Acceptance Criteria:**
- State machine: `PENDING` -> `RUNNING` -> `COMPLETED` or `FAILED`.
- `CANCELLED` is a terminal state reachable from any non-terminal state.
- All transitions emit a typed `EventEnvelopeV1` to the event bus (event_type prefix:
  `workflow.*`).
- The `Workflow` SQLAlchemy model captures `updated_at` with `onupdate=func.now()`.

### E1.3: Real-Time Workflow WebSocket

As a founder, I can subscribe to real-time workflow status updates over WebSocket so
I do not need to poll the REST API.

**Acceptance Criteria:**
- `WS /ws/workflows/{workflow_id}` accepts WebSocket connections.
- On connect, the current workflow state is immediately pushed as JSON.
- Control plane events (freeze, unfreeze) are broadcast to all active connections.
- Disconnect is handled cleanly; the connection is removed from `active_connections`.

---

## E2: Treasury and Compliance

### E2.1: Double-Entry Financial Ledger

As a treasury operator, all financial transactions are recorded as double-entry ledger
entries with immutable append-only semantics.

**Acceptance Criteria:**
- `LedgerEntry` model captures: `id`, `workflow_id`, `entry_type`
  (REVENUE/COST/TRANSFER/REFUND), `amount_cents`, `currency`, `account_from`,
  `account_to`, `external_ref`, `policy_bundle_id`, `created_at`.
- `MoneyIntent` model tracks authorization requests: status lifecycle
  CREATED -> AUTHORIZED/DENIED -> EXPIRED/SETTLED with `ttl_seconds` enforcement.
- `AuthorizationDecision` links each intent to its approved/denied decision with
  `approved_by` (auto or agent_role) and `reason_code`.
- No `UPDATE` or `DELETE` operations are permitted on committed ledger entries.

### E2.2: Tamper-Evident Audit Checkpoints

As an auditor, I can verify financial records have not been tampered with using a
SHA-256 checksum chain over ordered event batches.

**Acceptance Criteria:**
- `AuditCheckpoint` model stores: `batch_id`, `event_id_start`, `event_id_end`,
  `checksum` (SHA-256, 64 hex chars), `created_at`.
- Checkpoints are created after each batch of committed events.
- Verifying the chain requires computing the same SHA-256 over the batch and comparing
  to the stored checksum; any mismatch indicates tampering.

### E2.3: Policy Bundle Management

As an operator, I can publish versioned policy bundles that govern agent tool access
and compliance rules.

**Acceptance Criteria:**
- `POST /policies/publish` accepts `version` (str), `rules` (list[dict]),
  and optional `tool_allowlists` (dict); returns `{policy_id, ...}`.
- `GET /policies` lists all published bundles.
- `PolicyBundle` model enforces `UniqueConstraint` on `version`.
- Events with a `policy_bundle_id` reference the active policy at the time of creation.

---

## E3: Event Bus Architecture

### E3.1: Typed Event Envelope

As an operator, all events in the platform follow a uniform `EventEnvelopeV1` schema
so consumers can parse any event without per-type dispatch logic.

**Acceptance Criteria:**
- `EventEnvelopeV1` Pydantic model fields: `event_id` (UUID, auto-generated),
  `event_type` (str, e.g. `policy.published.v1`), `trace_id` (UUID, required),
  `workflow_id` (UUID, optional), `task_id` (UUID, optional),
  `policy_bundle_id` (UUID, optional), `created_at` (datetime, UTC), `payload` (dict).
- `EventTypes` constants define canonical prefixes: `policy`, `workflow`, `task`,
  `artifact`, `money`, `ledger`, `compliance`, `privacy`, `control`.
- All API operations that mutate state SHALL emit an event with the appropriate prefix.

### E3.2: Immutable Event Log

As an auditor, all events are stored in an append-only PostgreSQL `events` table
indexed for workflow and time-range queries.

**Acceptance Criteria:**
- `Event` SQLAlchemy model: `id` (BigInteger PK auto-increment), `event_id` (UUID unique),
  `event_type`, `trace_id`, `workflow_id`, `task_id`, `policy_bundle_id`, `payload` (JSONB),
  `created_at` (timezone-aware).
- Composite index on `(workflow_id, created_at)` for range queries.
- No UPDATE or DELETE operations are issued against the events table.

---

## E4: Control Plane

### E4.1: Global Freeze and Unfreeze

As a founder, I can globally pause all agent execution with a single API call so I
can intervene in autonomous operations without individual workflow cancellations.

**Acceptance Criteria:**
- `POST /control/freeze` with optional `reason` broadcasts a `control.freeze.activated.v1`
  event to all active WebSocket connections and returns `{status: "FROZEN", reason}`.
- `POST /control/unfreeze` broadcasts `control.unfreeze.activated.v1` and returns
  `{status: "UNFROZEN"}`.
- Both endpoints log at WARNING/INFO level respectively for operational visibility.
- Freeze state is broadcast to all connected WebSocket clients including non-workflow
  connections.

### E4.2: JWT Authentication

As an operator, all protected API endpoints require a valid JWT token so unauthorized
access is rejected at the API boundary.

**Acceptance Criteria:**
- `venture/auth.py` provides JWT creation and verification using `python-jose[cryptography]`.
- Invalid or expired tokens return HTTP 401 with a descriptive error.
- Token claims include at minimum: `sub` (subject), `exp` (expiry).
- `passlib[bcrypt]` is available for password hashing in credential storage.

---

## E5: Infrastructure and Quality

### E5.1: Service Health Endpoint

As an operator, I can verify the service is alive and check its version via a
dedicated health endpoint.

**Acceptance Criteria:**
- `GET /health` returns `{status: "OK", service: "control-plane-api", version: "0.1.0",
  timestamp: <ISO UTC>}` with HTTP 200.
- `GET /` returns `{name, version, docs}` as an API index.

### E5.2: Async PostgreSQL with SQLAlchemy

As a developer, all database operations are async using SQLAlchemy 2.0 async engine
so the event loop is not blocked.

**Acceptance Criteria:**
- `venture/database.py` provides an async session factory using `asyncpg` as the driver.
- All model queries use `await session.execute(...)` patterns.
- Schema migrations are managed via Alembic with a `versions/` directory.

### E5.3: Test Coverage

As a contributor, all implemented API endpoints have corresponding unit and integration tests.

**Acceptance Criteria:**
- Unit tests in `tests/unit/`: `test_api_main.py`, `test_eventbus_schema.py`,
  `test_ledger_schema.py`, `test_venture_init.py`.
- Integration tests in `tests/integration/test_api_workflows.py`.
- `pytest --cov-fail-under=90` gate enforced in `pyproject.toml`.
- All tests traceable to FR IDs via `@pytest.mark.requirement("FR-*")` markers.
