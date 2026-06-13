# Venture-Autonomy Ops/Compliance Spec

**Status:** Engineering-Grade
**Version:** 1.0.0
**Date:** 2026-02-21
**Owner:** Platform Engineering / Compliance
**Scope:** Parpour autonomous AI economic platform — all agent roles, all execution tracks

---

## Table of Contents

1. [Overview and Scope](#1-overview-and-scope)
2. [Budget Ceiling System](#2-budget-ceiling-system)
3. [Retry and Timeout Doctrine](#3-retry-and-timeout-doctrine)
4. [Freeze Mode and Global Kill-Switch](#4-freeze-mode-and-global-kill-switch)
5. [Incident Classification and Escalation](#5-incident-classification-and-escalation)
6. [Outreach and Legal Policy Engine](#6-outreach-and-legal-policy-engine)
7. [Tax and Reporting Event Capture](#7-tax-and-reporting-event-capture)
8. [Vendor Trust and Milestone Proof](#8-vendor-trust-and-milestone-proof)
9. [Data Classification and Suppression](#9-data-classification-and-suppression)
10. [Workload Identity and mTLS](#10-workload-identity-and-mtls)
11. [Tool Capability Restrictions and Egress Policy](#11-tool-capability-restrictions-and-egress-policy)
12. [Tamper-Evident Logs and Integrity Attestations](#12-tamper-evident-logs-and-integrity-attestations)
13. [Audit Schedule](#13-audit-schedule)
14. [Monitoring and Alerting](#14-monitoring-and-alerting)
15. [FR Traceability](#15-fr-traceability)

---

## 1. Overview and Scope

### 1.1 Ops Governance Philosophy

Parpour is an autonomous AI economic platform. Agents execute financial transactions, draft legal communications, deliver artifacts, and coordinate with external vendors — all without continuous human intervention. This demands an ops/compliance posture that is:

- **Fail-closed by default.** Any ambiguous or unverified action is blocked, not permitted. Compliance gates are hard stops, not soft warnings.
- **Auditable at every layer.** Every decision, every spend, every policy evaluation emits a structured event that is immutable and causally chained.
- **Deterministic under failure.** Agents that encounter retryable errors follow a strictly prescribed retry/timeout doctrine. Agents that encounter unrecoverable errors enter a deterministic failure mode that preserves state.
- **Zero silent degradation.** No fallback paths, no legacy compatibility shims, no suppressed exceptions. Failures surface loudly and stop execution.
- **Freeze-first on anomaly.** Unresolvable financial, security, or compliance anomalies trigger a hard freeze. Auto-recovery is prohibited; human-in-the-loop thaw is required.

### 1.2 Execution Tracks and Agent Roles

| Track | Purpose | Key Agents |
|-------|---------|-----------|
| TRACK_A | Artifact Determinism — code, content, deliverable generation | orchestrator, researcher, solver |
| TRACK_B | Treasury/Compliance — payments, tax, vendor management | finance-controller, ops-auditor |
| TRACK_C | Control Plane — policy evaluation, monitoring, freeze/thaw | orchestrator, ops-auditor |

| Agent Role | Description |
|-----------|-------------|
| `orchestrator` | Coordinates multi-step workflows; allocates sub-agent tasks |
| `researcher` | Web/document retrieval; knowledge synthesis |
| `solver` | Code/artifact generation; computational tasks |
| `finance-controller` | Authorizes payments, manages budget envelopes, reconciles ledger |
| `ops-auditor` | Policy evaluation, log integrity checks, compliance attestations |

### 1.3 Compliance Obligations

| Standard | Scope | Key Requirements |
|----------|-------|-----------------|
| **SOC2 Type II** | All platform services | CC6–CC9 (logical access, ops, risk, change), A1 (availability) |
| **PCI-DSS v4.0** | Payment processing (Stripe tokenization) | Scoped to token-only; no raw PAN in platform storage |
| **GDPR** | EU user data | Lawful basis, right-to-erasure, data minimization, breach notification ≤72h |
| **CAN-SPAM** | Email outreach | Opt-out honored within 10 business days; physical address in footer |
| **TCPA** | SMS/phone outreach | Prior express written consent; do-not-call registry checked |
| **SOX (partial)** | Financial reporting events | Immutable audit trail for all revenue/expense recognition events |

### 1.4 Delineation: Ops vs Compliance vs Security

| Domain | What It Governs | Who Enforces |
|--------|----------------|-------------|
| **Ops** | Budget ceilings, retry doctrine, freeze mode, incident response, monitoring | ops-auditor agent + platform SRE |
| **Compliance** | Outreach legality, tax capture, vendor trust, data classification | finance-controller + legal review |
| **Security** | Workload identity, mTLS, egress policy, tamper-evident logs, injection gates | platform security team + automated gates |

---

## 2. Budget Ceiling System

### 2.1 BudgetEnvelope Schema

```python
# models/budget.py — Pydantic v2 strict mode
from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, model_validator
import enum


class WindowType(str, enum.Enum):
    PER_CALL = "per_call"
    PER_HOUR = "per_hour"
    PER_DAY  = "per_day"
    PER_MONTH = "per_month"


class AgentRole(str, enum.Enum):
    ORCHESTRATOR      = "orchestrator"
    RESEARCHER        = "researcher"
    SOLVER            = "solver"
    FINANCE_CONTROLLER = "finance_controller"
    OPS_AUDITOR       = "ops_auditor"


class WorkflowClass(str, enum.Enum):
    RESEARCH   = "research"
    OUTREACH   = "outreach"
    ARTIFACT   = "artifact"
    TREASURY   = "treasury"


class BudgetEnvelope(BaseModel):
    model_config = {"strict": True}

    envelope_id:       UUID
    workflow_id:       UUID | None = None         # None = global role ceiling
    workflow_class:    WorkflowClass | None = None
    role:              AgentRole
    window_type:       WindowType
    window_seconds:    int = Field(gt=0)
    ceiling_usd_cents: int = Field(ge=0)
    current_spend_cents: int = Field(ge=0, default=0)
    reset_at:          datetime
    locked:            bool = False               # set during freeze

    @model_validator(mode="after")
    def spend_within_ceiling(self) -> "BudgetEnvelope":
        if self.current_spend_cents > self.ceiling_usd_cents:
            raise ValueError(
                f"current_spend_cents {self.current_spend_cents} exceeds "
                f"ceiling_usd_cents {self.ceiling_usd_cents}"
            )
        return self
```

### 2.2 Per-Role Ceiling Table

| Role | Per-Call (USD) | Per-Hour (USD) | Per-Day (USD) | Per-Month (USD) |
|------|---------------|---------------|--------------|----------------|
| `orchestrator` | $0.50 | $50 | $500 | $5,000 |
| `researcher` | $0.20 | $20 | $200 | $2,000 |
| `solver` | $1.00 | $100 | $1,000 | $10,000 |
| `finance-controller` | $10,000 | $100,000 | $500,000 | $2,000,000 |
| `ops-auditor` | $0.10 | $5 | $50 | $500 |

Note: `finance-controller` ceilings represent payment authorization limits, not LLM spend. Stripe tokenization costs are billed separately under infrastructure budget.

### 2.3 Per-Workflow-Class Ceiling Table

| Workflow Class | Per-Workflow (USD) | Per-Day (USD) | Per-Month (USD) |
|---------------|-------------------|--------------|----------------|
| `research` | $2.00 | $200 | $2,000 |
| `outreach` | $0.50 | $50 | $500 |
| `artifact` | $5.00 | $500 | $5,000 |
| `treasury` | $50,000 | $500,000 | $2,000,000 |

### 2.4 Enforcement Logic

Pre-flight check fires before every `money.intent.create` event and before every external API call that incurs cost. The check is synchronous and blocking.

```python
# services/budget_enforcer.py
from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from uuid import UUID, uuid7
from .models.budget import BudgetEnvelope, AgentRole, WindowType
from .events import emit_event
from .exceptions import BudgetCeilingExceeded
import asyncpg


async def preflight_budget_check(
    conn: asyncpg.Connection,
    workflow_id: UUID,
    role: AgentRole,
    estimated_spend_cents: int,
    policy_bundle_id: str,
) -> None:
    """
    Raises BudgetCeilingExceeded if any applicable envelope would be exceeded.
    Checks all window types in order: per_call, per_hour, per_day, per_month.
    """
    envelopes = await _fetch_applicable_envelopes(conn, workflow_id, role)

    for envelope in envelopes:
        projected = envelope.current_spend_cents + estimated_spend_cents
        if projected > envelope.ceiling_usd_cents:
            event = _build_exceeded_event(
                envelope, estimated_spend_cents, policy_bundle_id
            )
            await emit_event(conn, event)
            raise BudgetCeilingExceeded(
                envelope_id=envelope.envelope_id,
                ceiling=envelope.ceiling_usd_cents,
                current=envelope.current_spend_cents,
                requested=estimated_spend_cents,
            )


async def _fetch_applicable_envelopes(
    conn: asyncpg.Connection,
    workflow_id: UUID,
    role: AgentRole,
) -> list[BudgetEnvelope]:
    rows = await conn.fetch(
        """
        SELECT * FROM budget_envelopes
        WHERE role = $1
          AND (workflow_id = $2 OR workflow_id IS NULL)
          AND reset_at > NOW()
          AND NOT locked
        ORDER BY window_seconds ASC
        """,
        role.value,
        workflow_id,
    )
    return [BudgetEnvelope.model_validate(dict(r)) for r in rows]


def _build_exceeded_event(
    envelope: BudgetEnvelope,
    requested_cents: int,
    policy_bundle_id: str,
) -> dict:
    return {
        "event_id": str(uuid7()),
        "event_type": "budget.ceiling.exceeded.v1",
        "envelope_id": str(envelope.envelope_id),
        "workflow_id": str(envelope.workflow_id),
        "role": envelope.role.value,
        "window_type": envelope.window_type.value,
        "ceiling_usd_cents": envelope.ceiling_usd_cents,
        "current_spend_cents": envelope.current_spend_cents,
        "requested_cents": requested_cents,
        "policy_bundle_id": policy_bundle_id,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
```

### 2.5 Database Schema

```sql
-- DDL: budget_envelopes
CREATE TABLE budget_envelopes (
    envelope_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id          UUID REFERENCES workflows(workflow_id),  -- NULL = global
    workflow_class       TEXT CHECK (workflow_class IN ('research','outreach','artifact','treasury')),
    role                 TEXT NOT NULL CHECK (role IN (
                             'orchestrator','researcher','solver',
                             'finance_controller','ops_auditor')),
    window_type          TEXT NOT NULL CHECK (window_type IN (
                             'per_call','per_hour','per_day','per_month')),
    window_seconds       INTEGER NOT NULL CHECK (window_seconds > 0),
    ceiling_usd_cents    BIGINT NOT NULL CHECK (ceiling_usd_cents >= 0),
    current_spend_cents  BIGINT NOT NULL DEFAULT 0 CHECK (current_spend_cents >= 0),
    reset_at             TIMESTAMPTZ NOT NULL,
    locked               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT spend_within_ceiling CHECK (current_spend_cents <= ceiling_usd_cents)
);

CREATE INDEX idx_budget_envelopes_role_window ON budget_envelopes(role, window_type);
CREATE INDEX idx_budget_envelopes_workflow ON budget_envelopes(workflow_id) WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_budget_envelopes_reset ON budget_envelopes(reset_at);

-- DDL: budget_spend_log
CREATE TABLE budget_spend_log (
    log_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id          UUID NOT NULL REFERENCES budget_envelopes(envelope_id),
    workflow_id          UUID NOT NULL REFERENCES workflows(workflow_id),
    agent_role           TEXT NOT NULL,
    event_id             UUID NOT NULL,            -- triggering event UUIDv7
    spend_cents          BIGINT NOT NULL CHECK (spend_cents > 0),
    description          TEXT,
    policy_bundle_id     TEXT NOT NULL,
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spend_log_envelope ON budget_spend_log(envelope_id, occurred_at DESC);
CREATE INDEX idx_spend_log_workflow ON budget_spend_log(workflow_id, occurred_at DESC);
```

### 2.6 Event Schemas

**`budget.ceiling.exceeded.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "BudgetCeilingExceeded",
  "type": "object",
  "required": ["event_id","event_type","envelope_id","role","window_type",
               "ceiling_usd_cents","current_spend_cents","requested_cents",
               "policy_bundle_id","occurred_at"],
  "properties": {
    "event_id":            {"type": "string", "format": "uuid"},
    "event_type":          {"type": "string", "const": "budget.ceiling.exceeded.v1"},
    "envelope_id":         {"type": "string", "format": "uuid"},
    "workflow_id":         {"type": ["string","null"], "format": "uuid"},
    "role":                {"type": "string"},
    "window_type":         {"type": "string", "enum": ["per_call","per_hour","per_day","per_month"]},
    "ceiling_usd_cents":   {"type": "integer", "minimum": 0},
    "current_spend_cents": {"type": "integer", "minimum": 0},
    "requested_cents":     {"type": "integer", "minimum": 1},
    "policy_bundle_id":    {"type": "string"},
    "occurred_at":         {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

**`budget.window.reset.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "BudgetWindowReset",
  "type": "object",
  "required": ["event_id","event_type","envelope_id","role","window_type",
               "new_reset_at","occurred_at"],
  "properties": {
    "event_id":      {"type": "string", "format": "uuid"},
    "event_type":    {"type": "string", "const": "budget.window.reset.v1"},
    "envelope_id":   {"type": "string", "format": "uuid"},
    "role":          {"type": "string"},
    "window_type":   {"type": "string"},
    "spent_cents":   {"type": "integer", "minimum": 0},
    "new_reset_at":  {"type": "string", "format": "date-time"},
    "occurred_at":   {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

---

## 3. Retry and Timeout Doctrine

### 3.1 Task Class Retry Table

| Task Class | max_attempts | initial_backoff_ms | max_backoff_ms | timeout_ms | Jitter Strategy |
|-----------|-------------|-------------------|---------------|-----------|----------------|
| HTTP fetch (external) | 4 | 500 | 30,000 | 15,000 | Full jitter (random uniform) |
| LLM call | 3 | 2,000 | 60,000 | 120,000 | Decorrelated jitter |
| Tool execution (sandbox) | 2 | 1,000 | 10,000 | 30,000 | None (deterministic) |
| Treasury op (Stripe) | 3 | 1,000 | 20,000 | 30,000 | Decorrelated jitter |
| Artifact render | 2 | 2,000 | 15,000 | 180,000 | None |
| NATS publish | 5 | 100 | 5,000 | 5,000 | Full jitter |
| DB write (asyncpg) | 3 | 200 | 5,000 | 10,000 | Full jitter |
| Cert/secret fetch | 2 | 500 | 5,000 | 10,000 | None |

Retries are NEVER applied to: payment capture confirmation, idempotency-key-absent mutations, or any operation that lacks an idempotency key and has no safe rollback.

### 3.2 Tenacity Configurations

```python
# retry/doctrine.py — tenacity configurations per task class
from __future__ import annotations
import random
import tenacity
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential_jitter,
    wait_random_exponential,
    retry_if_exception_type,
    before_sleep_log,
    after_log,
)
import structlog
import httpx

log = structlog.get_logger(__name__)

# ── HTTP fetch (external) ───────────────────────────────────────────────────
HTTP_FETCH_RETRY = retry(
    stop=stop_after_attempt(4),
    wait=wait_random_exponential(multiplier=0.5, max=30),
    retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
    before_sleep=before_sleep_log(log, structlog.stdlib.DEBUG),
    reraise=True,
)

# ── LLM call ───────────────────────────────────────────────────────────────
LLM_CALL_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(multiplier=2.0, max=60),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
    before_sleep=before_sleep_log(log, structlog.stdlib.WARNING),
    reraise=True,
)

# ── Tool execution (sandbox) ───────────────────────────────────────────────
TOOL_EXEC_RETRY = retry(
    stop=stop_after_attempt(2),
    wait=tenacity.wait_fixed(1.0),
    retry=retry_if_exception_type(RuntimeError),
    before_sleep=before_sleep_log(log, structlog.stdlib.WARNING),
    reraise=True,
)

# ── Treasury op (Stripe) ───────────────────────────────────────────────────
import stripe  # type: ignore[import]

TREASURY_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(multiplier=1.0, max=20),
    retry=retry_if_exception_type((
        stripe.error.APIConnectionError,
        stripe.error.APIError,
        stripe.error.RateLimitError,
    )),
    before_sleep=before_sleep_log(log, structlog.stdlib.WARNING),
    reraise=True,
)

# ── NATS publish ───────────────────────────────────────────────────────────
from nats.errors import NoRespondersError, TimeoutError as NatsTimeout  # type: ignore

NATS_PUBLISH_RETRY = retry(
    stop=stop_after_attempt(5),
    wait=wait_random_exponential(multiplier=0.1, max=5),
    retry=retry_if_exception_type((NatsTimeout, NoRespondersError)),
    before_sleep=before_sleep_log(log, structlog.stdlib.DEBUG),
    reraise=True,
)

# ── Artifact render ─────────────────────────────────────────────────────────
ARTIFACT_RENDER_RETRY = retry(
    stop=stop_after_attempt(2),
    wait=tenacity.wait_fixed(2.0),
    retry=retry_if_exception_type(RuntimeError),
    before_sleep=before_sleep_log(log, structlog.stdlib.WARNING),
    reraise=True,
)

# ── DB write ────────────────────────────────────────────────────────────────
import asyncpg  # type: ignore

DB_WRITE_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(multiplier=0.2, max=5),
    retry=retry_if_exception_type((asyncpg.TooManyConnectionsError,
                                   asyncpg.PostgresConnectionError)),
    before_sleep=before_sleep_log(log, structlog.stdlib.WARNING),
    reraise=True,
)
```

### 3.3 Circuit Breaker Configuration

```python
# retry/circuit_breakers.py — pybreaker per external service
from __future__ import annotations
import pybreaker
import structlog

log = structlog.get_logger(__name__)


def _log_state_change(cb: pybreaker.CircuitBreaker, old: str, new: str) -> None:
    log.warning(
        "circuit_breaker_state_change",
        name=cb.name,
        old_state=old,
        new_state=new,
    )


_LISTENER = pybreaker.CircuitBreakerListener()
_LISTENER.state_change = _log_state_change  # type: ignore[method-assign]


# Stripe payment gateway
stripe_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    name="stripe",
    listeners=[_LISTENER],
)

# S3 / object storage
s3_breaker = pybreaker.CircuitBreaker(
    fail_max=10,
    reset_timeout=30,
    name="s3",
    listeners=[_LISTENER],
)

# AI provider (primary LLM)
ai_primary_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=120,
    name="ai_provider_primary",
    listeners=[_LISTENER],
)

# AI provider (secondary / fallback — NOTE: fallback is only for provider
# selection at infrastructure level; application logic must not silently
# degrade to a different model without explicit workflow configuration.)
ai_secondary_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=120,
    name="ai_provider_secondary",
    listeners=[_LISTENER],
)

# CivLab artifact verification
civlab_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    name="civlab",
    listeners=[_LISTENER],
)
```

### 3.4 Dead Letter Queue (NATS DLQ)

- DLQ stream name: `DEAD_LETTER`
- Retention: 7 days
- Subject pattern: `dlq.{original_subject}`
- Consumer: `ops-auditor` subscribes to `dlq.>` for triage
- Every failed event routed to DLQ includes original message, failure reason, attempt count, and last error

```
# NATS stream config (JetStream)
Stream: DEAD_LETTER
Subjects: dlq.>
Retention: limits
MaxAge: 604800s (7 days)
MaxMsgs: 1000000
Replicas: 3
Storage: file
```

### 3.5 Poison Pill Detection and Agent Quarantine

A "poison pill" is an event that causes 3 consecutive processing failures in the same agent session.

Detection logic (pseudo-code):
```
IF consecutive_failures(session_id) >= 3:
    emit agent.session.quarantined.v1
    halt all task dispatch to session_id
    route session_id messages to dlq.quarantine.*
    notify ops-auditor via NATS subject ops.alerts.quarantine
```

Agent sessions remain quarantined until manual review by ops-auditor role. Auto-recovery is prohibited.

---

## 4. Freeze Mode and Global Kill-Switch

### 4.1 Freeze Triggers

| Trigger | Detection Method | Threshold |
|---------|----------------|-----------|
| Treasury anomaly | `finance.anomaly_score.v1` event | score > 0.85 |
| Injection campaign | Prompt-injection gate consecutive blocks | >= 5 in 60s |
| Compliance violation | `compliance.violation.critical.v1` emitted | Any occurrence |
| RLS bypass attempt | PostgreSQL audit log pattern | Any occurrence |
| Manual admin | Admin API `POST /admin/freeze` | N/A |
| Budget ceiling cascade | >= 3 envelopes exceeded simultaneously | 3 envelopes |

### 4.2 Freeze State Machine

```
                    ┌─────────────────────────────────┐
                    │                                 │
              anomaly/injection/                      │
              compliance/manual                       │
                    │                                 │
                    ▼                                 │
┌──────────┐  trigger   ┌─────────────────┐          │
│          │──────────► │  FREEZE_PENDING  │          │
│  ACTIVE  │            │  (drain queues, │          │
│          │            │  halt spawns)   │          │
└──────────┘            └────────┬────────┘          │
     ▲                           │                   │
     │                     drain complete             │
     │                           │                   │
     │                           ▼                   │
     │                   ┌───────────────┐           │
     │                   │    FROZEN     │           │
     │                   │ (full halt,   │           │
     │                   │ audit state   │           │
     │                   │ preserved)    │           │
     │                   └──────┬────────┘           │
     │                          │                    │
     │                   admin POST /admin/thaw       │
     │                   + MFA + reason              │
     │                          │                    │
     │                          ▼                    │
     │                  ┌───────────────────┐        │
     │                  │   THAW_PENDING    │        │
     │                  │ (verify integrity,│        │
     │                  │  resume queues)   │        │
     │                  └────────┬──────────┘        │
     │                           │                   │
     │                   integrity OK                │
     │                           │                   │
     └───────────────────────────┘                   │
                                                     │
                         integrity FAIL              │
                                   └─────────────────┘
                                   (return to FROZEN)
```

**State transitions summary:**

| From | To | Condition |
|------|----|----------|
| ACTIVE | FREEZE_PENDING | Freeze trigger detected |
| FREEZE_PENDING | FROZEN | All in-flight messages drained, queues halted |
| FROZEN | THAW_PENDING | Admin `POST /admin/thaw` with MFA + reason |
| THAW_PENDING | ACTIVE | Integrity check passes |
| THAW_PENDING | FROZEN | Integrity check fails |

### 4.3 Freeze Behavior Specification

When state enters `FREEZE_PENDING`:
1. Stop all agent spawn requests — `agent.spawn` NATS subject is closed to new publishers.
2. Set `budget_envelopes.locked = TRUE` for all envelopes globally.
3. Drain in-flight NATS messages: wait for `pending_msg_count == 0` on all consumer groups, max wait 30s.
4. Reject all new workflow start requests with HTTP 503.
5. Write `sys.mode.freeze_enabled.v1` event with trigger details.
6. Transition to `FROZEN`.

When `FROZEN`:
- All agent compute is halted.
- Audit DB writes are still permitted (append-only, no agent authorization).
- Admin API responds on health endpoints with `{"status": "frozen"}`.
- No auto-recovery; no timer-based thaw.

### 4.4 Event Schemas

**`sys.mode.freeze_enabled.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FreezeModeEnabled",
  "type": "object",
  "required": ["event_id","event_type","trigger","trigger_details",
               "initiated_by","occurred_at"],
  "properties": {
    "event_id":        {"type": "string", "format": "uuid"},
    "event_type":      {"type": "string", "const": "sys.mode.freeze_enabled.v1"},
    "trigger":         {"type": "string", "enum": [
                          "treasury_anomaly","injection_campaign",
                          "compliance_violation","rls_bypass_attempt",
                          "budget_cascade","manual_admin"]},
    "trigger_details": {"type": "object"},
    "initiated_by":    {"type": "string"},
    "occurred_at":     {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

**`sys.mode.freeze_disabled.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FreezeModeDisabled",
  "type": "object",
  "required": ["event_id","event_type","admin_id","reason",
               "integrity_check_passed","occurred_at"],
  "properties": {
    "event_id":               {"type": "string", "format": "uuid"},
    "event_type":             {"type": "string", "const": "sys.mode.freeze_disabled.v1"},
    "admin_id":               {"type": "string"},
    "reason":                 {"type": "string", "minLength": 20},
    "integrity_check_passed": {"type": "boolean"},
    "frozen_duration_seconds":{"type": "integer"},
    "occurred_at":            {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

### 4.5 Admin API

```
POST /admin/freeze
Authorization: Bearer <RS256-JWT> + TOTP MFA header X-MFA-Code
Body: { "reason": string (min 20 chars), "trigger": string }
Response 200: { "state": "FREEZE_PENDING", "freeze_event_id": UUID }
Response 409: { "error": "already_frozen" }

POST /admin/thaw
Authorization: Bearer <RS256-JWT> + TOTP MFA header X-MFA-Code
Body: { "reason": string (min 20 chars) }
Response 200: { "state": "THAW_PENDING", "thaw_event_id": UUID }
Response 409: { "error": "not_frozen" }
Response 422: { "error": "integrity_check_failed", "details": {...} }
```

Both endpoints write to the `admin_audit_log` table before executing any state change. MFA validation failure returns 401 and emits `admin.mfa.failure.v1`.

### 4.6 Freeze/Thaw Runbook

**Freeze Procedure:**
1. Identify freeze trigger; document trigger source in incident ticket.
2. Call `POST /admin/freeze` with TOTP code and reason referencing incident ticket.
3. Confirm `sys.mode.freeze_enabled.v1` event is present in event stream.
4. Verify agent spawn halted: check `ops.agents.active` Prometheus metric drops to 0.
5. Notify on-call SRE and compliance team via PagerDuty.
6. Begin incident investigation per Section 5.

**Thaw Procedure:**
1. Confirm incident is resolved or mitigated; document in incident ticket.
2. Run integrity check manually: `ops-auditor check-chain --full`.
3. If integrity check passes, call `POST /admin/thaw` with TOTP code and reason.
4. Monitor `ops.agents.active` to confirm agents resume.
5. Confirm `sys.mode.freeze_disabled.v1` event emitted.
6. Verify budget envelopes unlocked; reset any exceeded envelopes manually if appropriate.
7. Post thaw summary to incident ticket and close P0/P1 if applicable.

**Auto-thaw is strictly prohibited.** Any code path that invokes thaw without admin authorization is a critical security bug (P0).

---

## 5. Incident Classification and Escalation

### 5.1 Severity Levels

| Severity | Description | Example |
|----------|-------------|---------|
| **P0** | System-wide halt; financial loss risk; data breach | Freeze triggered, treasury double-spend, PII exfiltration |
| **P1** | Financial anomaly; compliance violation; partial service loss | Budget cascade, RLS bypass attempt, injection campaign |
| **P2** | Compliance risk; degraded workflow; non-critical data issue | Outreach policy block rate spike, vendor milestone dispute |
| **P3** | Degraded performance; non-critical error rate spike | High LLM latency, DLQ message accumulation |

### 5.2 SLA Table

| Severity | Acknowledge | Investigate | Resolve |
|----------|-------------|------------|---------|
| P0 | 5 min | 30 min | 4 hours |
| P1 | 15 min | 1 hour | 8 hours |
| P2 | 1 hour | 4 hours | 48 hours |
| P3 | 4 hours | 24 hours | 1 week |

### 5.3 Detection Methods and Auto-Response

| Severity | Detection | Auto-Response |
|----------|-----------|--------------|
| P0 | Prometheus alert `parpour_freeze_active == 1`; PagerDuty critical | Auto-freeze if not already frozen; PagerDuty page |
| P1 | `finance.anomaly_score > 0.85`; compliance violation event | Emit `budget.ceiling.exceeded.v1`; suspend affected workflow |
| P2 | Policy violation rate > 5/min for 5 min; vendor dispute event | Alert on-call; tag workflow for review |
| P3 | Error rate > 2%; p99 latency > 10s for 5 min | Slack alert; no auto-action |

### 5.4 Escalation Targets

| Severity | Primary | Secondary |
|----------|---------|-----------|
| P0 | On-call SRE + Compliance Lead + CTO | Legal counsel if financial loss > $1,000 |
| P1 | On-call SRE + Finance Controller | Compliance Lead |
| P2 | On-call SRE | Finance Controller |
| P3 | On-call SRE | — |

### 5.5 Incident Runbooks

**Treasury Double-Spend:**
1. Detect via `finance.double_spend.detected.v1` event or daily reconciliation mismatch.
2. Immediately freeze system (`POST /admin/freeze`, trigger: `treasury_anomaly`).
3. Pull `budget_spend_log` for affected workflow; compare against Stripe payment intents.
4. Identify idempotency key collision or missing pre-flight check.
5. Issue refund via Stripe dashboard (manual; not via agent) if customer-facing.
6. Fix root cause in code; add regression test before unfreeze.
7. Post-mortem required.

**Injection Campaign:**
1. Detect via injection gate emitting >= 5 `agent.injection.blocked.v1` events in 60s.
2. Auto-freeze triggers; confirm `sys.mode.freeze_enabled.v1` emitted.
3. Review blocked payloads in injection gate audit log.
4. Identify source: workflow, user input, or external data.
5. Quarantine source; update injection gate rules if new pattern found.
6. Thaw after rule update deployed and gate tested.
7. P1 post-mortem required if >= 10 blocks in session.

**RLS Bypass Attempt:**
1. Detect via PostgreSQL `pg_audit` log: `SELECT` without tenant filter on RLS-protected table.
2. Auto-freeze (P1 → may escalate to P0 if data accessed).
3. Identify query source: agent role, session ID, workflow ID.
4. Pull `select` query from audit log; confirm if data was actually returned cross-tenant.
5. If data exposed: initiate GDPR breach notification workflow (72-hour clock starts).
6. Fix query/RLS policy; add test asserting RLS enforcement.
7. Post-mortem required.

**NATS Stream Poisoning:**
1. Detect via DLQ accumulation rate > 100 msgs/min.
2. Suspend affected consumer group.
3. Sample DLQ messages; identify malformed event pattern.
4. If BLAKE3 hash chain breaks: do NOT process further events; escalate to P0.
5. If schema mismatch: identify event producer; patch and redeploy.
6. Replay DLQ from last known-good event after fix.

**Secrets Leaked in Events:**
1. Detect via structlog scrubber alert or manual observation.
2. Immediately freeze.
3. Identify event_id range containing leaked secret.
4. Rotate leaked credential immediately (do not wait for post-mortem).
5. Mark affected events in `event_integrity_flags` table as `REDACTED`.
6. Notify compliance and legal.
7. Post-mortem required; if credential was used externally, treat as P0.

### 5.6 Post-Mortem Template (P0/P1 Required)

```markdown
# Post-Mortem: [Incident Title]
**Incident ID:** INC-YYYY-NNNN
**Severity:** P0 / P1
**Date:** YYYY-MM-DD
**Duration:** HH:MM (from detection to resolution)
**Author:** [name]

## Timeline
| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Detection |
| HH:MM | Freeze initiated |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Thaw completed |

## Root Cause
[One paragraph, technical detail]

## Impact
- Financial: $X affected; $Y recovered
- Data: [none / N records affected]
- Availability: [N minutes downtime]

## Contributing Factors
[Bullet list]

## Detection Gap
[Was this detected faster than it could have been? Why not?]

## Corrective Actions
| Action | Owner | Due Date |
|--------|-------|---------|
| | | |

## FR Gaps Identified
[List any FR-OPS-NNN or FR-SEC-NNN gaps exposed by this incident]
```

### 5.7 Incidents Table (DB)

```sql
CREATE TABLE incidents (
    incident_id     TEXT PRIMARY KEY,  -- INC-YYYY-NNNN
    severity        TEXT NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','CLOSED')),
    trigger_event_id UUID,
    detected_at     TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    postmortem_url  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_severity_status ON incidents(severity, status);
CREATE INDEX idx_incidents_detected ON incidents(detected_at DESC);
```

---

## 6. Outreach and Legal Policy Engine

### 6.1 Channel Restrictions

| Channel | Governing Law | Key Requirements |
|---------|--------------|-----------------|
| Email | CAN-SPAM (US), CASL (CA), GDPR (EU) | Opt-out honored ≤10 biz days (US), ≤10 days (CA); physical address in footer; no deceptive headers |
| SMS | TCPA (US), CRTC (CA), ePrivacy (EU) | Prior express written consent (US); opt-out via STOP honored immediately |
| Phone (voice) | TCPA (US), DNCL (CA) | Do-not-call registry checked before every call; calling hours 8am–9pm local |
| Social DM | Platform ToS | No mass DM automation unless platform API explicitly permits |
| Push notification | App store policies | User must have granted push permission; opt-out clears immediately |

### 6.2 Jurisdiction Rules Table

| Jurisdiction | Email Consent | SMS Consent | Data Retention | Right to Erase |
|-------------|--------------|------------|---------------|---------------|
| US | Opt-out model | Opt-in required | Per CAN-SPAM: 3yr | No federal mandate |
| EU (GDPR) | Opt-in required | Opt-in required | Minimum necessary | Yes, ≤30 days |
| CA (CASL) | Express opt-in | Express opt-in | As long as consent valid | Yes (PIPEDA) |
| UK (UK GDPR) | Opt-in required | Opt-in required | Minimum necessary | Yes, ≤30 days |

### 6.3 Pre-Send Policy Evaluation

Every outreach action must call `policy.evaluate` before dispatch. This is a synchronous blocking call.

```python
# compliance/outreach_policy.py
from __future__ import annotations
from enum import Enum
from uuid import UUID
from pydantic import BaseModel
import structlog

log = structlog.get_logger(__name__)


class Channel(str, Enum):
    EMAIL = "email"
    SMS   = "sms"
    PHONE = "phone"
    SOCIAL_DM = "social_dm"
    PUSH  = "push"


class Jurisdiction(str, Enum):
    US = "US"
    EU = "EU"
    CA = "CA"
    UK = "UK"


class OutreachRequest(BaseModel):
    model_config = {"strict": True}

    workflow_id:      UUID
    recipient_id:     UUID
    channel:          Channel
    jurisdiction:     Jurisdiction
    policy_bundle_id: str
    content_hash:     str   # BLAKE3 of message content


class PolicyDecision(BaseModel):
    model_config = {"strict": True}

    allowed:          bool
    reason:           str
    suppressed:       bool
    rate_limit_hit:   bool
    checked_at:       str   # ISO8601


async def evaluate_outreach(
    request: OutreachRequest,
    conn,
) -> PolicyDecision:
    """
    Raises if policy cannot be evaluated (fail-closed).
    Returns PolicyDecision. Caller MUST check .allowed before sending.
    """
    # 1. Suppression list check
    suppressed = await _check_suppression(conn, request.recipient_id, request.channel)
    if suppressed:
        decision = PolicyDecision(
            allowed=False, reason="suppression_list",
            suppressed=True, rate_limit_hit=False,
            checked_at=_now_iso()
        )
        await _emit_blocked_event(request, decision, conn)
        return decision

    # 2. Consent check
    has_consent = await _check_consent(
        conn, request.recipient_id, request.channel, request.jurisdiction
    )
    if not has_consent:
        decision = PolicyDecision(
            allowed=False, reason="no_consent",
            suppressed=False, rate_limit_hit=False,
            checked_at=_now_iso()
        )
        await _emit_blocked_event(request, decision, conn)
        return decision

    # 3. Rate limit check
    rate_ok = await _check_rate_limit(conn, request.recipient_id, request.channel)
    if not rate_ok:
        decision = PolicyDecision(
            allowed=False, reason="rate_limit",
            suppressed=False, rate_limit_hit=True,
            checked_at=_now_iso()
        )
        await _emit_blocked_event(request, decision, conn)
        return decision

    return PolicyDecision(
        allowed=True, reason="ok",
        suppressed=False, rate_limit_hit=False,
        checked_at=_now_iso()
    )
```

### 6.4 Suppression List

```sql
CREATE TABLE outreach_suppression (
    suppression_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL,
    channel         TEXT NOT NULL CHECK (channel IN ('email','sms','phone','social_dm','push')),
    reason          TEXT NOT NULL CHECK (reason IN ('unsubscribe','bounce','spam_complaint','do_not_contact','gdpr_erase')),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by        TEXT NOT NULL,   -- 'user_request', 'bounce_handler', 'admin'
    UNIQUE(recipient_id, channel)
);

CREATE INDEX idx_suppression_recipient ON outreach_suppression(recipient_id, channel);
```

### 6.5 Rate Limits Per Channel

| Channel | Per-Recipient Per-Day | Per-Recipient Per-Week |
|---------|----------------------|----------------------|
| Email | 3 | 7 |
| SMS | 2 | 5 |
| Phone | 1 | 3 |
| Social DM | 1 | 3 |
| Push | 5 | 15 |

Rate limits are enforced via Redis sorted set with sliding window. Limit exceeded → `compliance.outreach.rate_limited.v1`.

### 6.6 Event Schema: `compliance.outreach.blocked.v1`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OutreachBlocked",
  "type": "object",
  "required": ["event_id","event_type","workflow_id","recipient_id",
               "channel","jurisdiction","reason","policy_bundle_id","occurred_at"],
  "properties": {
    "event_id":         {"type": "string", "format": "uuid"},
    "event_type":       {"type": "string", "const": "compliance.outreach.blocked.v1"},
    "workflow_id":      {"type": "string", "format": "uuid"},
    "recipient_id":     {"type": "string", "format": "uuid"},
    "channel":          {"type": "string"},
    "jurisdiction":     {"type": "string"},
    "reason":           {"type": "string", "enum": ["suppression_list","no_consent","rate_limit","jurisdiction_block"]},
    "policy_bundle_id": {"type": "string"},
    "occurred_at":      {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

---

## 7. Tax and Reporting Event Capture

### 7.1 Taxable Event Types

| Event Type | Description | Tax Category |
|-----------|-------------|-------------|
| Revenue recognition | Payment received from client | Income |
| Contractor payment | Payment to vendor/freelancer | 1099-NEC (US) |
| Marketplace fee | Platform fee charged to user | Revenue |
| Refund issued | Revenue reversal | Income adjustment |
| Subscription revenue | Recurring SaaS revenue | Income |

### 7.2 Tax Event Schema: `finance.tax_event.v1`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "TaxEvent",
  "type": "object",
  "required": ["event_id","event_type","tax_event_type","amount_cents","currency",
               "jurisdiction","tax_category","party_id","workflow_id","occurred_at"],
  "properties": {
    "event_id":       {"type": "string", "format": "uuid"},
    "event_type":     {"type": "string", "const": "finance.tax_event.v1"},
    "tax_event_type": {"type": "string", "enum": [
                         "revenue_recognition","contractor_payment",
                         "marketplace_fee","refund_issued","subscription_revenue"]},
    "amount_cents":   {"type": "integer"},
    "currency":       {"type": "string", "pattern": "^[A-Z]{3}$"},
    "jurisdiction":   {"type": "string"},
    "tax_category":   {"type": "string"},
    "party_id":       {"type": "string", "format": "uuid"},
    "workflow_id":    {"type": "string", "format": "uuid"},
    "stripe_payment_intent_id": {"type": ["string","null"]},
    "notes":          {"type": ["string","null"]},
    "occurred_at":    {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

### 7.3 Database Schema

```sql
CREATE TABLE tax_events (
    event_id          UUID PRIMARY KEY,
    tax_event_type    TEXT NOT NULL,
    amount_cents      BIGINT NOT NULL,
    currency          CHAR(3) NOT NULL,
    jurisdiction      TEXT NOT NULL,
    tax_category      TEXT NOT NULL,
    party_id          UUID NOT NULL,
    workflow_id       UUID REFERENCES workflows(workflow_id),
    stripe_payment_intent_id TEXT,
    notes             TEXT,
    occurred_at       TIMESTAMPTZ NOT NULL,
    archived          BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7-year retention enforced by policy; no DELETE without legal sign-off
CREATE INDEX idx_tax_events_party_year ON tax_events(party_id, date_trunc('year', occurred_at));
CREATE INDEX idx_tax_events_jurisdiction ON tax_events(jurisdiction, occurred_at DESC);

-- 1099 threshold aggregate
CREATE MATERIALIZED VIEW contractor_payment_annual AS
SELECT
    party_id,
    date_part('year', occurred_at) AS tax_year,
    SUM(amount_cents) AS total_cents
FROM tax_events
WHERE tax_event_type = 'contractor_payment'
GROUP BY party_id, date_part('year', occurred_at);

CREATE UNIQUE INDEX ON contractor_payment_annual(party_id, tax_year);
```

### 7.4 Retention and Export

- **Retention:** 7 years minimum. `archived = TRUE` marks records moved to cold storage; no deletes.
- **1099 threshold:** US $600 per vendor per year. Alert emitted when `total_cents >= 60000`.
- **Quarterly export:** `ops-auditor` agent generates `reports/tax/YYYY-QN/tax_events.csv` and `contractor_payments.csv`. Export is signed with platform Ed25519 key.
- **GDPR exception:** Tax records for EU users subject to erasure requests are pseudonymized (party_id replaced with `GDPR_ERASED_{sha256_prefix}`), not deleted, per legal retention obligation override.

---

## 8. Vendor Trust and Milestone Proof

### 8.1 Vendor Onboarding Steps

| Step | Required For | Documents |
|------|-------------|-----------|
| Identity verification (Tier 1) | All vendors | Government ID, business registration |
| Tax ID verification | US vendors receiving payment | W-9 or W-8BEN |
| Banking verification | Any vendor receiving ACH/wire | Bank account + micro-deposit confirmation |
| KYB (Know Your Business) | Vendors > $10,000/month | Business registration, beneficial ownership |
| Enhanced due diligence | Vendors in high-risk jurisdictions | Source of funds declaration, additional ID |

Onboarding events emitted: `vendor.onboarded.v1`, `vendor.verification.failed.v1`.

### 8.2 Milestone Proof Types

| Proof Type | Verification Method | Required Fields |
|-----------|-------------------|----------------|
| Code delivery | git SHA + repo URL | `git_sha`, `repo_url`, `commit_timestamp` |
| Content delivery | BLAKE3 hash of deliverable | `content_hash`, `content_type`, `byte_size` |
| Service SLA | Uptime report URL + hash | `report_url`, `report_hash`, `period_start`, `period_end`, `uptime_pct` |
| Design delivery | File hash + preview URL | `file_hash`, `preview_url`, `format` |
| API integration | Health endpoint response | `endpoint_url`, `response_hash`, `checked_at` |

### 8.3 Milestone Verification Before Payment

Payment release (`money.authorize`) is **blocked** unless a verified `milestone.verified.v1` event exists for the milestone being paid. This is enforced in the finance-controller pre-flight check.

```python
# compliance/milestone_verifier.py
from __future__ import annotations
from uuid import UUID
from .exceptions import MilestoneNotVerified
import asyncpg


async def assert_milestone_verified(
    conn: asyncpg.Connection,
    milestone_id: UUID,
    workflow_id: UUID,
) -> None:
    """
    Raises MilestoneNotVerified if no verified milestone proof exists.
    Called as hard gate before money.authorize.
    """
    row = await conn.fetchrow(
        """
        SELECT verified_at, proof_type, proof_hash
        FROM milestone_proofs
        WHERE milestone_id = $1
          AND workflow_id = $2
          AND verified = TRUE
        ORDER BY verified_at DESC
        LIMIT 1
        """,
        milestone_id,
        workflow_id,
    )
    if row is None:
        raise MilestoneNotVerified(
            milestone_id=milestone_id,
            workflow_id=workflow_id,
        )
```

### 8.4 Vendor Trust Score

Composite score in range [0.0, 1.0]. Computed by `ops-auditor` on each milestone completion.

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Delivery rate | 30% | milestones delivered on-time / total milestones |
| Dispute rate | 25% | 1 - (disputes / total milestones) |
| Identity verification level | 20% | Tier 1=0.5, KYB=0.8, Enhanced=1.0 |
| Recency | 15% | Exponential decay on past 12 months |
| Refund rate | 10% | 1 - (refunds / total payments) |

Trust score < 0.4 → vendor flagged; new milestone payments require manual ops-auditor approval.

### 8.5 Event Schemas

**`milestone.verified.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MilestoneVerified",
  "type": "object",
  "required": ["event_id","event_type","milestone_id","workflow_id",
               "vendor_id","proof_type","proof_hash","verified_at"],
  "properties": {
    "event_id":      {"type": "string", "format": "uuid"},
    "event_type":    {"type": "string", "const": "milestone.verified.v1"},
    "milestone_id":  {"type": "string", "format": "uuid"},
    "workflow_id":   {"type": "string", "format": "uuid"},
    "vendor_id":     {"type": "string", "format": "uuid"},
    "proof_type":    {"type": "string", "enum": [
                        "code_delivery","content_delivery","service_sla",
                        "design_delivery","api_integration"]},
    "proof_hash":    {"type": "string", "pattern": "^[0-9a-f]{64}$"},
    "proof_meta":    {"type": "object"},
    "verified_by":   {"type": "string"},
    "verified_at":   {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

**`vendor.trust.updated.v1`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VendorTrustUpdated",
  "type": "object",
  "required": ["event_id","event_type","vendor_id","old_score","new_score","occurred_at"],
  "properties": {
    "event_id":    {"type": "string", "format": "uuid"},
    "event_type":  {"type": "string", "const": "vendor.trust.updated.v1"},
    "vendor_id":   {"type": "string", "format": "uuid"},
    "old_score":   {"type": "number", "minimum": 0, "maximum": 1},
    "new_score":   {"type": "number", "minimum": 0, "maximum": 1},
    "trigger":     {"type": "string"},
    "occurred_at": {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

### 8.6 Database Tables

```sql
CREATE TABLE vendors (
    vendor_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    jurisdiction        TEXT NOT NULL,
    identity_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    verification_tier   TEXT CHECK (verification_tier IN ('tier1','kyb','enhanced')),
    trust_score         NUMERIC(4,3) NOT NULL DEFAULT 0.5
                            CHECK (trust_score >= 0 AND trust_score <= 1),
    flagged             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE milestones (
    milestone_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES workflows(workflow_id),
    vendor_id       UUID NOT NULL REFERENCES vendors(vendor_id),
    description     TEXT NOT NULL,
    amount_cents    BIGINT NOT NULL CHECK (amount_cents > 0),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    due_at          TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','DELIVERED','VERIFIED','PAID','DISPUTED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE milestone_proofs (
    proof_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id    UUID NOT NULL REFERENCES milestones(milestone_id),
    workflow_id     UUID NOT NULL REFERENCES workflows(workflow_id),
    proof_type      TEXT NOT NULL,
    proof_hash      TEXT NOT NULL,
    proof_meta      JSONB,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by     TEXT,
    verified_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestone_proofs_verified ON milestone_proofs(milestone_id, verified);
```

---

## 9. Data Classification and Suppression

### 9.1 Seven Data Classes

| Class | Label | Examples | Default Log Behavior |
|-------|-------|---------|---------------------|
| **Secret** | `SECRET` | API keys, private keys, JWT secrets, DB passwords | NEVER logged; redacted to `[SECRET:REDACTED]` |
| **PII** | `PII` | Name, email, phone, address, IP address | Masked: `[PII:sha256_prefix_8]` |
| **PAN** | `PAN` | Payment card numbers (never stored raw) | NEVER logged; presence triggers P0 alert |
| **Financial** | `FINANCIAL` | Account balances, transaction amounts (raw) | Logged with amount_cents only; no raw currency strings with context |
| **Artifact** | `ARTIFACT` | Generated code, content, documents | Logged by hash only in audit; full content in artifact store |
| **Policy** | `POLICY` | Policy bundle contents, rule sets | Logged by bundle_id and version; content in policy store |
| **Telemetry** | `TELEMETRY` | Metrics, traces, logs (already structured) | Full logging permitted; PII within telemetry still masked |

### 9.2 Log Masking Rules

```python
# logging/masking.py — structlog processor for PII/secret masking
from __future__ import annotations
import hashlib
import re
import structlog
from typing import Any

# Patterns that indicate PII fields
_PII_FIELD_PATTERNS = re.compile(
    r"(email|phone|address|name|ip_addr|user_agent|ssn|dob|recipient)",
    re.IGNORECASE,
)

# Patterns that indicate secret fields
_SECRET_FIELD_PATTERNS = re.compile(
    r"(password|secret|token|api_key|private_key|credential|auth|jwt|nkey)",
    re.IGNORECASE,
)

# PAN detection (Luhn-valid 13-19 digit numbers)
_PAN_PATTERN = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def _mask_pii(value: str) -> str:
    digest = hashlib.sha256(value.encode()).hexdigest()[:8]
    return f"[PII:{digest}]"


def mask_sensitive_fields(
    logger: Any, method: str, event_dict: dict
) -> dict:
    """
    structlog processor. Masks PII and redacts secrets in all log events.
    Applied unconditionally — no opt-out.
    """
    for key, val in list(event_dict.items()):
        if not isinstance(val, str):
            continue

        if _SECRET_FIELD_PATTERNS.search(key):
            event_dict[key] = "[SECRET:REDACTED]"
            continue

        if _PAN_PATTERN.search(val):
            # PAN in any field is a critical finding
            event_dict[key] = "[PAN:DETECTED_AND_REDACTED]"
            event_dict["_pan_detected"] = True
            continue

        if _PII_FIELD_PATTERNS.search(key):
            event_dict[key] = _mask_pii(val)

    return event_dict
```

### 9.3 OTLP Attribute Scrubbing

Fields that MUST be scrubbed before OTLP export (OpenTelemetry trace/metric attributes):

- `http.request.header.authorization`
- `http.request.header.x-api-key`
- `db.statement` (full SQL — replace with query template hash)
- `net.peer.ip` (replace with `[IP:MASKED]`)
- `enduser.id` (replace with pseudonymous user handle)
- `http.url` if it contains query params matching `(token|key|secret|auth)=`
- Any custom attribute with key matching `_SECRET_FIELD_PATTERNS`

Scrubbing is applied in the OTLP exporter pipeline before transmission.

### 9.4 Agent Memory Scrubbing

Before any agent output is stored in agent memory (vector store or relational):
1. Run `mask_sensitive_fields` processor on the raw text.
2. Check for PAN with Luhn validator; if found, abort memory write and emit `agent.memory.pii_detected.v1`.
3. Any field classified as `SECRET` causes the memory write to abort entirely.

### 9.5 GDPR Right-to-Erasure

```
DELETE /users/{user_id}/data
Authorization: Bearer <RS256-JWT> (admin scope required)
```

Cascade behavior (all within a single transaction):

| Table | Action |
|-------|--------|
| `users` | Delete row |
| `outreach_suppression` | Delete rows for user |
| `agent_memory` | Delete rows for user |
| `workflow_inputs` | Pseudonymize PII fields |
| `tax_events` | Pseudonymize `party_id` (legal retention override) |
| `incidents` | Redact user references in notes |
| Audit trail | Preserve with pseudonymized user_id; erasure event logged |

Erasure emits `gdpr.erasure.completed.v1` with pseudonymized user reference and timestamp. Erasure must complete within 30 days of request. SLA: technical erasure ≤48 hours; cold storage purge ≤30 days.

```sql
-- Example: pseudonymize party_id in tax_events (not delete — legal hold)
UPDATE tax_events
SET party_id = uuid_generate_v5(uuid_ns_url(), 'GDPR_ERASED:' || party_id::text)
WHERE party_id = $1;
```

---

## 10. Workload Identity and mTLS

### 10.1 Service Identity Model

Each service has a unique workload identity:
- **Ed25519 keypair** generated at deploy time; private key never leaves the service pod.
- **Certificate** signed by internal CA (cert-manager + Vault PKI); includes service name, namespace, and deployment hash in SAN.
- **Rotation:** 90 days automated; cert-manager issues new cert 72h before expiry.

| Service | Identity Name | Cert SAN |
|---------|--------------|---------|
| API gateway | `api-gateway.parpour.svc` | `api-gateway.parpour.svc.cluster.local` |
| Agent runner | `agent-runner.parpour.svc` | `agent-runner.parpour.svc.cluster.local` |
| Finance controller | `finance-controller.parpour.svc` | `finance-controller.parpour.svc.cluster.local` |
| Ops auditor | `ops-auditor.parpour.svc` | `ops-auditor.parpour.svc.cluster.local` |
| NATS server | `nats.parpour.svc` | `nats.parpour.svc.cluster.local` |
| PostgreSQL (PgCat) | `pgcat.parpour.svc` | `pgcat.parpour.svc.cluster.local` |

### 10.2 mTLS Enforcement

- All inter-service HTTP/gRPC calls require mutual TLS. No plaintext inter-service traffic permitted.
- Service mesh (Istio or Linkerd) enforces `PeerAuthentication` policy with `mtls: STRICT` mode.
- TLS version: minimum TLS 1.3. TLS 1.2 only for external Stripe webhook endpoints (Stripe limitation).
- Cipher suites: TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256.

### 10.3 NATS NKey Configuration

```
# Per-service NKey accounts
# Account: each tenant has a separate NATS account (account-per-tenant model)
# Service credentials: NKey seed, never written to disk in plaintext

nats:
  server_name: "parpour-nats-{cluster_id}"
  tls:
    cert_file: /certs/nats/tls.crt
    key_file:  /certs/nats/tls.key
    ca_file:   /certs/ca/ca.crt
    verify:    true
  authorization:
    users:
      - nkey: "U{32-char-base32-nkey}"
        permissions:
          publish:   ["workflow.>", "agent.>", "dlq.>"]
          subscribe: ["_INBOX.>", "workflow.>"]
```

NKey rotation schedule: 180 days. Rotation is zero-downtime: new NKey issued, both accepted for 24h, old revoked.

### 10.4 HMAC Session Tokens

- Algorithm: HMAC-SHA256
- Secret: 256-bit random, stored in Vault; rotated every 30 days.
- TTL: 15 minutes (non-negotiable).
- Format: `{base64url(header)}.{base64url(payload)}.{base64url(hmac_sig)}`
- Never persisted raw in DB; only the session_id (opaque reference) is stored.
- Revocation: Redis set `revoked_sessions:{session_id}` with TTL matching token expiry.

### 10.5 RS256 JWT Configuration

- Algorithm: RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
- Key size: 4096-bit RSA
- Claims: `sub` (user_id), `iss` (parpour-auth), `aud` (parpour-api), `exp`, `iat`, `jti` (unique token ID for revocation)
- Rotation: key pair rotated every 90 days; JWKS endpoint serves both current and previous key for grace period.
- JTI stored in Redis for revocation; checked on every request.

### 10.6 Credential Rotation Runbook

**90-day TLS cert rotation (automated):**
1. cert-manager detects cert expiry ≤72h.
2. Issues new cert via Vault PKI intermediate CA.
3. Mounts new cert in service pod without restart (hot-reload).
4. Old cert remains valid until expiry.
5. Logs `cert.rotated.v1` event.

**30-day HMAC secret rotation:**
1. Generate new 256-bit secret in Vault.
2. Write to Vault path `secret/parpour/hmac-signing-key`.
3. Services reload secret via Vault agent sidecar (no restart needed).
4. Old tokens remain valid until their 15-min TTL expires.
5. No manual intervention required.

**180-day NATS NKey rotation:**
1. Generate new NKey seed: `nk gen user`.
2. Update NKey in Vault and NATS server config.
3. Deploy updated config; NATS accepts both old and new NKey for 24h.
4. Verify all services connected with new NKey.
5. Remove old NKey from NATS auth config.
6. Emit `credential.rotated.v1` event.

**If credential is compromised (emergency rotation):**
1. Immediately revoke: remove from Vault, add to revocation list in Redis.
2. Rotate within 1 hour (not next scheduled rotation).
3. Treat as P0 incident if credential was for finance-controller or ops-auditor.
4. Emit `credential.emergency_rotated.v1` with incident_id reference.

---

## 11. Tool Capability Restrictions and Egress Policy

### 11.1 Agent Role Tool Allowlist Matrix

| Tool / Capability | orchestrator | researcher | solver | finance-controller | ops-auditor |
|------------------|:-----------:|:----------:|:------:|:-----------------:|:-----------:|
| HTTP fetch (allow-listed domains) | YES | YES | YES | NO | YES |
| HTTP fetch (any domain) | NO | NO | NO | NO | NO |
| NATS publish | YES | YES | YES | YES | YES |
| DB write (workflows, tasks) | YES | NO | YES | NO | NO |
| DB write (financial tables) | NO | NO | NO | YES | NO |
| DB read (own tenant) | YES | YES | YES | YES | YES |
| DB read (cross-tenant) | NO | NO | NO | NO | YES (audit only) |
| Stripe API calls | NO | NO | NO | YES | NO |
| Spawn sub-agent | YES | NO | YES | NO | NO |
| Artifact write (S3) | NO | NO | YES | NO | NO |
| Admin API | NO | NO | NO | NO | YES |
| Egress to external SMTP | NO | NO | NO | NO | NO |
| Shell execution (sandbox only) | NO | NO | YES (RestrictedPython) | NO | NO |

Full matrix maintained in: `docs/reference/ROLE_TOOL_ALLOWLIST_MATRIX.md`

### 11.2 Allowed Egress Domains Per Role

| Role | Allowed Domains |
|------|----------------|
| `orchestrator` | `api.openai.com`, `api.anthropic.com`, `nats.parpour.internal` |
| `researcher` | `api.openai.com`, `api.anthropic.com`, `*.wikipedia.org`, `arxiv.org`, `github.com` |
| `solver` | `api.openai.com`, `api.anthropic.com`, `registry.npmjs.org`, `pypi.org` |
| `finance-controller` | `api.stripe.com`, `nats.parpour.internal` |
| `ops-auditor` | `nats.parpour.internal`, `prometheus.parpour.internal`, `grafana.parpour.internal` |

Requests to domains not in allowlist are blocked by iptables FORWARD rule and emit `agent.egress.blocked.v1`.

### 11.3 Blocked Egress

The following are blocked for ALL agent roles, unconditionally:

- **RFC 1918 ranges:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (SSRF prevention).
- **Link-local:** `169.254.0.0/16` (cloud metadata endpoint protection).
- **Loopback:** `127.0.0.0/8`.
- **Raw IP access:** HTTP requests to IP addresses without DNS resolution are blocked.
- **Redirect following to new host:** If HTTP redirect changes the hostname, the request is aborted.
- **Non-standard ports on allow-listed domains:** Only 443 (HTTPS) permitted; port 80 blocked.

### 11.4 iptables Rules (Container Egress)

```bash
# Applied in container init via initContainer
# Block RFC 1918 SSRF
iptables -A OUTPUT -d 10.0.0.0/8 -j REJECT
iptables -A OUTPUT -d 172.16.0.0/12 -j REJECT
iptables -A OUTPUT -d 192.168.0.0/16 -j REJECT
iptables -A OUTPUT -d 169.254.0.0/16 -j REJECT
iptables -A OUTPUT -d 127.0.0.0/8 -j REJECT

# Allow only HTTPS outbound
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 4222 -j ACCEPT  # NATS
iptables -A OUTPUT -p tcp --dport 5432 -j ACCEPT  # PostgreSQL (via PgCat)

# Default deny all other outbound
iptables -A OUTPUT -j REJECT
```

DNS resolution is performed via the cluster DNS resolver; direct UDP port 53 to external resolvers is blocked.

### 11.5 Sandbox Execution Policy

Two-tier sandboxing for `solver` role code execution:

**Tier 1 — RestrictedPython (in-process):**
- Allowed builtins: `print`, `len`, `range`, `enumerate`, `zip`, `sorted`, `min`, `max`, `sum`, `abs`
- Blocked: `exec`, `eval`, `compile`, `__import__`, `open`, `os`, `sys`
- Timeout: 30 seconds CPU time
- Memory limit: 256 MB

**Tier 2 — subprocess + seccomp-bpf:**
- Spawned in isolated subprocess with seccomp profile `docker/default`
- Additional syscall blocks: `ptrace`, `mount`, `setuid`, `setgid`, `socket` (except UNIX domain)
- Filesystem: read-only root; `/tmp` writable, cleared after execution
- Network: disabled entirely for subprocess tier

### 11.6 Capability Violation Event

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AgentCapabilityViolation",
  "type": "object",
  "required": ["event_id","event_type","session_id","agent_role","violation_type",
               "attempted_action","occurred_at"],
  "properties": {
    "event_id":         {"type": "string", "format": "uuid"},
    "event_type":       {"type": "string", "const": "agent.capability.violation.v1"},
    "session_id":       {"type": "string", "format": "uuid"},
    "agent_role":       {"type": "string"},
    "violation_type":   {"type": "string", "enum": [
                           "disallowed_tool","egress_blocked","sandbox_escape_attempt",
                           "cross_tenant_access","disallowed_db_write"]},
    "attempted_action": {"type": "string"},
    "workflow_id":      {"type": ["string","null"], "format": "uuid"},
    "occurred_at":      {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

Capability violation results in immediate session suspension. Three violations in one hour from the same agent role → that role is suspended platform-wide and ops-auditor is alerted.

---

## 12. Tamper-Evident Logs and Integrity Attestations

### 12.1 BLAKE3 Causal Hash Chain

Every `EventEnvelopeV1` carries a causal hash chain field `prev_hash`. This creates a tamper-evident linked list of all events in sequence.

```python
# events/envelope.py — EventEnvelopeV1 with BLAKE3 chain
from __future__ import annotations
from uuid import UUID
from datetime import datetime
import blake3  # type: ignore[import]
import json
from pydantic import BaseModel, Field


class EventEnvelopeV1(BaseModel):
    model_config = {"strict": True}

    event_id:         UUID                # UUIDv7 (time-ordered)
    event_type:       str
    payload:          dict
    policy_bundle_id: str
    prev_hash:        str                 # BLAKE3 hex of previous envelope
    self_hash:        str = Field(default="")  # computed on creation
    schema_version:   str = "1"
    occurred_at:      datetime

    def compute_self_hash(self) -> str:
        """Compute BLAKE3 hash of this envelope (excluding self_hash field)."""
        canonical = {
            "event_id":         str(self.event_id),
            "event_type":       self.event_type,
            "payload":          self.payload,
            "policy_bundle_id": self.policy_bundle_id,
            "prev_hash":        self.prev_hash,
            "schema_version":   self.schema_version,
            "occurred_at":      self.occurred_at.isoformat(),
        }
        serialized = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
        return blake3.blake3(serialized.encode()).hexdigest()


GENESIS_HASH = "0" * 64  # First event in stream uses this as prev_hash
```

### 12.2 Periodic Integrity Attestation

Every 1,000 events processed, `ops-auditor` emits a `sys.audit.integrity_check.v1` event containing the chain head hash. This anchors the chain state at a known point.

**Attestation trigger:** Event count modulo 1,000 == 0, checked after each event write.

**Attestation process:**
1. Fetch the last 1,000 events in order by UUIDv7.
2. Recompute the hash chain from the previous attestation's `chain_head_hash`.
3. If computed chain head matches stored chain head: emit `sys.audit.integrity_check.v1` with `integrity_ok: true`.
4. If mismatch: emit with `integrity_ok: false`; trigger P0 incident immediately; freeze system.

```python
# audit/integrity.py
from __future__ import annotations
from datetime import datetime, timezone
from uuid import uuid7
import blake3
import json
import asyncpg


async def run_integrity_attestation(
    conn: asyncpg.Connection,
    event_store_table: str = "event_log",
) -> dict:
    rows = await conn.fetch(
        f"""
        SELECT event_id, prev_hash, self_hash
        FROM {event_store_table}
        ORDER BY event_id DESC
        LIMIT 1000
        """
    )
    if not rows:
        raise RuntimeError("No events found for integrity check")

    # Verify chain: each event's prev_hash must match prior event's self_hash
    events = list(reversed(rows))  # oldest first
    for i in range(1, len(events)):
        if events[i]["prev_hash"] != events[i - 1]["self_hash"]:
            return {
                "event_id": str(uuid7()),
                "event_type": "sys.audit.integrity_check.v1",
                "integrity_ok": False,
                "chain_head_hash": events[-1]["self_hash"],
                "events_checked": len(events),
                "break_at_event_id": str(events[i]["event_id"]),
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            }

    return {
        "event_id": str(uuid7()),
        "event_type": "sys.audit.integrity_check.v1",
        "integrity_ok": True,
        "chain_head_hash": events[-1]["self_hash"],
        "events_checked": len(events),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
```

### 12.3 Event Schema: `sys.audit.integrity_check.v1`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IntegrityCheck",
  "type": "object",
  "required": ["event_id","event_type","integrity_ok","chain_head_hash",
               "events_checked","occurred_at"],
  "properties": {
    "event_id":         {"type": "string", "format": "uuid"},
    "event_type":       {"type": "string", "const": "sys.audit.integrity_check.v1"},
    "integrity_ok":     {"type": "boolean"},
    "chain_head_hash":  {"type": "string", "pattern": "^[0-9a-f]{64}$"},
    "events_checked":   {"type": "integer", "minimum": 1},
    "break_at_event_id":{"type": ["string","null"], "format": "uuid"},
    "occurred_at":      {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

### 12.4 S3 WORM Object Lock for Audit Archive

- **Bucket:** `parpour-audit-archive-{account_id}`
- **Object Lock mode:** COMPLIANCE (cannot be overridden by any user including root)
- **Retention period:** 30 days minimum lock; legal hold available for incident investigation
- **Upload cadence:** Audit log batch exported hourly; signed with Ed25519 key before upload
- **Object naming:** `audit/{YYYY}/{MM}/{DD}/{HH}/{chain_head_hash_prefix}.log.gz`
- **Versioning:** Enabled; delete markers blocked by Object Lock

```python
# audit/archive.py — S3 WORM upload
import boto3
from datetime import datetime, timedelta

def upload_audit_batch_to_worm(
    s3_client: boto3.client,
    bucket: str,
    key: str,
    data: bytes,
    chain_head_hash: str,
) -> None:
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ObjectLockMode="COMPLIANCE",
        ObjectLockRetainUntilDate=(
            datetime.utcnow() + timedelta(days=30)
        ).isoformat() + "Z",
        Metadata={"chain-head-hash": chain_head_hash},
        ServerSideEncryption="aws:kms",
    )
```

### 12.5 Attestation Schedule

| Cadence | What | Who | Output |
|---------|------|-----|--------|
| Every 1,000 events | Hash chain integrity check | ops-auditor (automated) | `sys.audit.integrity_check.v1` |
| Daily (02:00 UTC) | Full reconciliation: event count, spend vs ledger, chain head | ops-auditor (automated) | `audit.reconciliation.daily.v1` |
| Weekly (Monday 04:00 UTC) | Policy drift review: active bundles vs approved versions | ops-auditor (automated) | `audit.policy_drift.weekly.v1` |
| Monthly | Admin reviews attestation evidence; signs governance report | ops-auditor + human admin | Signed PDF in `audits/YYYY/MM/` |

---

## 13. Audit Schedule

### 13.1 Daily Automated Reconciliation

Runs daily at 02:00 UTC as a scheduled `ops-auditor` workflow.

| Check | Method | Alert If |
|-------|--------|---------|
| Budget spend vs ledger | Compare `budget_spend_log` total vs `tax_events` total | Delta > $0.01 |
| Event count vs DB count | NATS stream consumer sequence vs `event_log` row count | Delta > 0 |
| Hash chain head | Recompute last 10,000 events chain; compare to last attestation | Mismatch |
| Active budget envelopes reset | Confirm expired windows were reset | Any unreset expired envelope |
| DLQ accumulation | DLQ message count | > 100 messages |
| Quarantined sessions | Count of sessions in quarantine state | Any unreviewed > 24h old |

All daily reconciliation results are written to `audit.reconciliation.daily.v1` events and archived to S3.

### 13.2 Weekly Policy Drift Review

Runs Monday at 04:00 UTC.

| Check | Method |
|-------|--------|
| Policy bundle versions | Compare `policy_bundles.active_version` against `policy_bundles.approved_version` |
| Role tool allowlist | Compare deployed allowlist config vs `ROLE_TOOL_ALLOWLIST_MATRIX.md` version hash |
| Egress domain allowlist | Compare deployed iptables allow-list vs spec version |
| Cert expiry horizon | List any cert expiring within 14 days |
| NKey expiry horizon | List any NKey credential expiring within 30 days |

Output: `audit.policy_drift.weekly.v1` event with diff summary. If any drift detected, P2 incident auto-opened.

### 13.3 Monthly Governance Attestation

Human admin (with ops-auditor role) reviews and signs:

1. All controls in Sections 2–12 have been tested this month.
2. No unresolved P0/P1 incidents remain open.
3. All policy bundles are at approved versions.
4. Vendor trust scores reviewed; flagged vendors addressed.
5. GDPR erasure SLAs met (all requests < 48 hours technical erasure).
6. SOC2 control evidence collected for the month.

Output: Signed governance attestation PDF saved to `audits/YYYY/MM/governance_attestation.pdf`.

### 13.4 Quarterly Compliance Tabletop and Incident Drill

Each quarter, the team runs:
- **Tabletop exercise:** Walk through one P0 scenario end-to-end using runbooks in Section 5.5.
- **Incident drill:** Actually freeze and thaw the staging environment using the Section 4.6 runbook.
- **Evidence review:** Compile SOC2 Type II evidence package for the quarter.
- **Policy refresh:** Review and re-approve all policy bundles; bump versions if no changes needed.
- **FR coverage check:** Verify all FR-OPS-NNN requirements have passing tests.

### 13.5 Annual SOC2 Type II Audit Evidence Collection

Collect and package:
- 12 months of daily reconciliation reports.
- All `sys.audit.integrity_check.v1` events with `integrity_ok: true`.
- All incident records with resolution timestamps.
- All governance attestation PDFs.
- Cert rotation logs.
- Access control review (who has admin API access; review and prune).
- Penetration test results (external vendor, annual cadence).
- Vulnerability scan results (monthly, compiled into annual summary).

### 13.6 Audit Evidence Storage

```
audits/
  YYYY/
    MM/
      DD/
        reconciliation_YYYY-MM-DD.json.gz  (signed)
        policy_drift_YYYY-MM-DD.json.gz    (Mondays only)
      governance_attestation_YYYY-MM.pdf   (signed)
    QN/
      tabletop_report_YYYY-QN.md
      soc2_evidence_package_YYYY-QN.tar.gz (signed)
    soc2_annual_YYYY.tar.gz
```

All files signed with platform Ed25519 key. Signature stored as `{filename}.sig` alongside.

---

## 14. Monitoring and Alerting

### 14.1 Prometheus Metric Names

**Budget / Spend:**

```
parpour_budget_spend_cents_total{role, workflow_class, window_type}
parpour_budget_ceiling_exceeded_total{role, workflow_class}
parpour_budget_window_resets_total{role, window_type}
parpour_budget_utilization_ratio{role, window_type}   # 0.0–1.0
```

**Freeze Mode:**

```
parpour_freeze_active{trigger}    # 1 when frozen, 0 when active
parpour_freeze_duration_seconds   # histogram of freeze event durations
parpour_freeze_total{trigger}     # counter of freeze events by trigger
```

**Incidents:**

```
parpour_incident_open{severity}   # gauge of open incidents by severity
parpour_incident_resolution_seconds{severity}  # histogram of TTR
parpour_incident_total{severity}  # counter of incidents ever opened
```

**Compliance / Outreach:**

```
parpour_outreach_blocked_total{channel, reason, jurisdiction}
parpour_outreach_sent_total{channel, jurisdiction}
parpour_suppression_list_size{channel}
```

**Agent / Capability:**

```
parpour_capability_violations_total{role, violation_type}
parpour_agent_sessions_active{role}
parpour_agent_sessions_quarantined{role}
parpour_injection_blocks_total{agent_role}
```

**Integrity / Audit:**

```
parpour_integrity_checks_total{result}   # result=ok|fail
parpour_dlq_messages_pending             # gauge
parpour_event_chain_breaks_total         # counter; should always be 0
parpour_audit_reconciliation_delta_cents # gauge; should always be 0
```

**Vendor / Milestone:**

```
parpour_vendor_trust_score{vendor_id}
parpour_milestone_pending{workflow_class}
parpour_milestone_disputed_total
parpour_contractor_payment_annual_cents{party_id}   # for 1099 threshold monitoring
```

### 14.2 Alert Rules

```yaml
# alerting/ops-compliance-rules.yml — Prometheus AlertManager format
groups:
  - name: ops_compliance
    rules:

      # Budget ceiling approaching
      - alert: BudgetCeilingApproaching
        expr: parpour_budget_utilization_ratio > 0.8
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Budget utilization > 80% for role {{ $labels.role }}"

      # Budget ceiling exceeded
      - alert: BudgetCeilingExceeded
        expr: increase(parpour_budget_ceiling_exceeded_total[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Budget ceiling exceeded: {{ $labels.role }} / {{ $labels.workflow_class }}"

      # Freeze mode active
      - alert: SystemFrozen
        expr: parpour_freeze_active == 1
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "System frozen (trigger: {{ $labels.trigger }}). Manual thaw required."

      # Compliance violation rate spike
      - alert: ComplianceViolationSpike
        expr: rate(parpour_outreach_blocked_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Outreach block rate elevated: {{ $value }}/s"

      # Injection block campaign detected
      - alert: InjectionCampaignDetected
        expr: rate(parpour_injection_blocks_total[60s]) > 0.08
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Injection block rate >= 5/60s — campaign suspected"

      # DLQ accumulation
      - alert: DLQAccumulating
        expr: parpour_dlq_messages_pending > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "DLQ has {{ $value }} pending messages"

      # Hash chain break (should never fire)
      - alert: EventChainIntegrityBreak
        expr: increase(parpour_event_chain_breaks_total[1m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "BLAKE3 event chain integrity break detected. P0 incident required."

      # Reconciliation delta (should always be 0)
      - alert: AuditReconciliationDelta
        expr: abs(parpour_audit_reconciliation_delta_cents) > 1
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Budget vs ledger delta: {{ $value }} cents. Investigate immediately."

      # P0/P1 incident open too long
      - alert: IncidentSLABreached
        expr: |
          (parpour_incident_open{severity="P0"} > 0) and (time() - parpour_incident_open_since{severity="P0"} > 14400)
          or
          (parpour_incident_open{severity="P1"} > 0) and (time() - parpour_incident_open_since{severity="P1"} > 28800)
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Incident SLA breached for severity {{ $labels.severity }}"

      # Vendor trust score low
      - alert: VendorLowTrustScore
        expr: parpour_vendor_trust_score < 0.4
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Vendor {{ $labels.vendor_id }} trust score {{ $value }} below threshold"
```

### 14.3 Grafana Dashboard Panels (Ops/Compliance View)

| Panel Name | Type | Query |
|-----------|------|-------|
| System Freeze Status | Stat | `parpour_freeze_active` |
| Budget Utilization by Role | Gauge | `parpour_budget_utilization_ratio` grouped by `role` |
| Outreach Block Rate | Time series | `rate(parpour_outreach_blocked_total[5m])` |
| Open Incidents by Severity | Bar chart | `parpour_incident_open` grouped by `severity` |
| DLQ Message Count | Stat | `parpour_dlq_messages_pending` |
| Integrity Checks (ok vs fail) | Pie chart | `parpour_integrity_checks_total` grouped by `result` |
| Capability Violations | Time series | `rate(parpour_capability_violations_total[5m])` by `role` |
| Budget Spend (last 24h) | Time series | `increase(parpour_budget_spend_cents_total[24h])` by `role` |
| Vendor Trust Distribution | Histogram | `parpour_vendor_trust_score` |
| Injection Block Rate | Time series | `rate(parpour_injection_blocks_total[60s])` |
| 1099 Threshold Progress | Gauge | `parpour_contractor_payment_annual_cents / 6000000` |
| Reconciliation Delta | Stat | `parpour_audit_reconciliation_delta_cents` (green=0, red>0) |

Dashboard JSON definition stored in `grafana/dashboards/ops-compliance.json` and provisioned via Grafana sidecar.

### 14.4 On-Call Rotation Requirements

- Minimum 2 engineers in on-call rotation; one primary, one secondary.
- On-call SRE must have admin API access (MFA enrolled).
- PagerDuty escalation policy:
  - P0/P1: page primary immediately; escalate to secondary after 5 min no-ack; escalate to Compliance Lead after 15 min.
  - P2/P3: Slack alert to `#ops-alerts`; paged only if no ack within 1 hour (P2) or 4 hours (P3).
- On-call runbooks linked from PagerDuty incident descriptions.
- Post on-call handoff: 5-minute sync to review any P2/P3 incidents; all P0/P1 post-mortems reviewed.

---

## 15. FR Traceability

All controls in this spec are traceable to Functional Requirements with the prefix `FR-OPS-NNN`.

| FR ID | Requirement Statement | Section |
|-------|-----------------------|---------|
| FR-OPS-001 | The system SHALL enforce per-role budget ceilings for all agent spend, checked before every cost-incurring action. | §2 |
| FR-OPS-002 | The system SHALL enforce per-workflow-class budget ceilings across all time window types (per-call, per-hour, per-day, per-month). | §2.3 |
| FR-OPS-003 | The system SHALL emit `budget.ceiling.exceeded.v1` when any envelope would be exceeded and SHALL block the triggering action. | §2.4 |
| FR-OPS-004 | The system SHALL persist all budget spend records in `budget_spend_log` with event_id reference for audit traceability. | §2.5 |
| FR-OPS-005 | The system SHALL apply tenacity retry configurations per task class as specified; retry MUST NOT be applied to non-idempotent operations lacking idempotency keys. | §3.2 |
| FR-OPS-006 | The system SHALL implement circuit breakers (pybreaker) for all external services (Stripe, S3, AI providers, CivLab). | §3.3 |
| FR-OPS-007 | The system SHALL route failed events to a NATS DLQ with 7-day retention; the ops-auditor role SHALL subscribe for triage. | §3.4 |
| FR-OPS-008 | The system SHALL quarantine any agent session that causes 3 consecutive processing failures on the same event. | §3.5 |
| FR-OPS-009 | The system SHALL implement a freeze state machine with states: ACTIVE, FREEZE_PENDING, FROZEN, THAW_PENDING. | §4.2 |
| FR-OPS-010 | Freeze SHALL be triggered automatically by: treasury anomaly score > 0.85, >= 5 injection blocks in 60s, any critical compliance violation, any RLS bypass attempt, or >= 3 simultaneous budget ceiling exceeds. | §4.1 |
| FR-OPS-011 | Thaw SHALL require explicit admin action with MFA and a reason string of >= 20 characters. Auto-thaw is strictly prohibited. | §4.5 |
| FR-OPS-012 | The system SHALL emit `sys.mode.freeze_enabled.v1` and `sys.mode.freeze_disabled.v1` events with full trigger details. | §4.4 |
| FR-OPS-013 | The system SHALL classify incidents as P0/P1/P2/P3 and enforce SLA timelines: P0 acknowledge ≤5 min, resolve ≤4h. | §5.2 |
| FR-OPS-014 | Post-mortems SHALL be required for all P0 and P1 incidents using the template specified in §5.6. | §5.6 |
| FR-OPS-015 | The system SHALL evaluate outreach policy (consent, suppression, rate limit, jurisdiction) before every channel send; blocked sends emit `compliance.outreach.blocked.v1`. | §6.3 |
| FR-OPS-016 | The system SHALL maintain a suppression list; unsubscribes SHALL be honored within 10 business days (US) and immediately for STOP (SMS). | §6.4 |
| FR-OPS-017 | The system SHALL capture `finance.tax_event.v1` for every taxable event type and retain records for minimum 7 years. | §7.1–7.3 |
| FR-OPS-018 | The system SHALL track contractor payments per vendor per year; SHALL alert when cumulative payments reach the 1099 threshold ($600 USD). | §7.4 |
| FR-OPS-019 | Payment release (`money.authorize`) SHALL be blocked unless a `milestone.verified.v1` event exists for the milestone being paid. | §8.3 |
| FR-OPS-020 | The system SHALL compute and persist a vendor trust score; vendors with score < 0.4 SHALL be flagged and require manual approval for new payments. | §8.4 |
| FR-OPS-021 | The system SHALL classify all data into 7 classes (Secret, PII, PAN, Financial, Artifact, Policy, Telemetry) and enforce suppression defaults per class. | §9.1 |
| FR-OPS-022 | PAN SHALL never be logged. PII in log fields SHALL be masked to `[PII:sha256_prefix_8]`. Secrets SHALL be redacted to `[SECRET:REDACTED]`. | §9.2 |
| FR-OPS-023 | GDPR right-to-erasure SHALL cascade to all tables within 48 hours of request; tax records SHALL be pseudonymized (not deleted) per legal hold. | §9.5 |
| FR-OPS-024 | All inter-service communication SHALL use mutual TLS (mTLS); plaintext inter-service traffic is prohibited. | §10.2 |
| FR-OPS-025 | Service TLS certificates SHALL be rotated every 90 days via automated cert-manager workflow. | §10.3 |
| FR-OPS-026 | HMAC session tokens SHALL have a maximum TTL of 15 minutes and SHALL NOT be persisted raw. | §10.4 |
| FR-OPS-027 | The system SHALL enforce an agent role tool allowlist; all capability violations SHALL emit `agent.capability.violation.v1` and suspend the agent session. | §11.1 |
| FR-OPS-028 | The system SHALL block egress to RFC 1918 ranges, raw IP access, and non-HTTPS ports for all agent roles. | §11.3 |
| FR-OPS-029 | Solver-role code execution SHALL use two-tier sandboxing: RestrictedPython (in-process) + subprocess+seccomp-bpf. | §11.5 |
| FR-OPS-030 | All EventEnvelopeV1 events SHALL carry a BLAKE3 prev_hash forming a tamper-evident causal chain. | §12.1 |
| FR-OPS-031 | The system SHALL emit `sys.audit.integrity_check.v1` every 1,000 events; a failed integrity check SHALL trigger an immediate P0 incident and system freeze. | §12.2 |
| FR-OPS-032 | Audit log batches SHALL be archived to S3 with COMPLIANCE Object Lock (30-day minimum retention) and signed with the platform Ed25519 key. | §12.4 |
| FR-OPS-033 | The system SHALL run automated daily reconciliation checks covering budget spend vs ledger, event count vs DB count, and hash chain head. | §13.1 |
| FR-OPS-034 | The system SHALL run automated weekly policy drift reviews comparing active policy bundles and tool allowlists against approved versions. | §13.2 |
| FR-OPS-035 | Monthly governance attestations SHALL be signed by a human admin and archived in `audits/YYYY/MM/`. | §13.3 |

---

## Appendix A: Key Event Type Reference

| Event Type | Trigger | Section |
|-----------|---------|---------|
| `budget.ceiling.exceeded.v1` | Budget preflight check fails | §2.6 |
| `budget.window.reset.v1` | Budget window expires and resets | §2.6 |
| `sys.mode.freeze_enabled.v1` | Freeze triggered | §4.4 |
| `sys.mode.freeze_disabled.v1` | Successful thaw | §4.4 |
| `compliance.outreach.blocked.v1` | Outreach policy gate blocks send | §6.6 |
| `finance.tax_event.v1` | Taxable event recognized | §7.2 |
| `milestone.verified.v1` | Milestone proof verified | §8.5 |
| `vendor.trust.updated.v1` | Vendor trust score recalculated | §8.5 |
| `agent.capability.violation.v1` | Agent exceeds allowlisted capability | §11.6 |
| `sys.audit.integrity_check.v1` | Periodic BLAKE3 chain attestation | §12.3 |
| `agent.session.quarantined.v1` | Poison pill detected | §3.5 |
| `gdpr.erasure.completed.v1` | Right-to-erasure cascade complete | §9.5 |
| `credential.rotated.v1` | Scheduled credential rotation | §10.6 |
| `credential.emergency_rotated.v1` | Emergency credential rotation | §10.6 |
| `admin.mfa.failure.v1` | Admin MFA validation failed | §4.5 |

---

## Appendix B: Exception Class Reference

```python
# exceptions.py — all ops/compliance exceptions

class BudgetCeilingExceeded(Exception):
    def __init__(self, envelope_id, ceiling, current, requested):
        self.envelope_id = envelope_id
        self.ceiling = ceiling
        self.current = current
        self.requested = requested
        super().__init__(
            f"Budget ceiling exceeded: envelope={envelope_id} "
            f"ceiling={ceiling} current={current} requested={requested}"
        )

class MilestoneNotVerified(Exception):
    def __init__(self, milestone_id, workflow_id):
        self.milestone_id = milestone_id
        self.workflow_id = workflow_id
        super().__init__(
            f"No verified milestone proof for milestone={milestone_id} "
            f"in workflow={workflow_id}"
        )

class OutreachPolicyBlocked(Exception):
    def __init__(self, recipient_id, channel, reason):
        self.recipient_id = recipient_id
        self.channel = channel
        self.reason = reason
        super().__init__(
            f"Outreach blocked: recipient={recipient_id} "
            f"channel={channel} reason={reason}"
        )

class SystemFrozenError(Exception):
    """Raised when an operation is attempted while the system is frozen."""

class IntegrityCheckFailed(Exception):
    """Raised when BLAKE3 hash chain integrity check fails. Triggers P0."""
    def __init__(self, break_at_event_id):
        self.break_at_event_id = break_at_event_id
        super().__init__(f"Hash chain integrity break at event_id={break_at_event_id}")

class CapabilityViolation(Exception):
    """Raised when an agent attempts a disallowed action."""
    def __init__(self, role, violation_type, attempted_action):
        self.role = role
        self.violation_type = violation_type
        self.attempted_action = attempted_action
        super().__init__(
            f"Capability violation: role={role} "
            f"type={violation_type} action={attempted_action}"
        )
```

---

*End of Venture-Autonomy Ops/Compliance Spec v1.0.0*
