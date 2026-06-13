# RND-012: Pydantic v2 Event Schema Validation + NATS Message Serialization Contracts

**Status:** RESEARCH COMPLETE
**Date:** 2026-02-21
**Assigned to:** researcher-gamma

---

## Executive Summary

This document specifies the event contract system for Parpour's Venture platform, using Pydantic v2 discriminated unions for typed event payloads, strict mode validation, and NATS JetStream message serialization. The key patterns are: (1) discriminated union on `event_type` field for type-safe event dispatch, (2) `model_dump_json()` for serialization to NATS and `model_validate_json()` for deserialization, (3) a local `EVENT_REGISTRY` dict for schema lookup (simpler than a remote registry at Parpour's scale), and (4) BLAKE3 causal hashing for event chain integrity using `prev_hash + event_type + canonical_json`. All code contracts are provided as implementable Python specifications.

---

## Research Findings

### 1. Discriminated Union Pattern for Typed Events

Pydantic v2 supports discriminated unions via `Annotated[Union[...], Field(discriminator="event_type")]`. This allows a single `parse_event()` function to accept any valid event payload and automatically dispatch to the correct Pydantic model:

```python
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, Field, model_config


# ─── Base Event Envelope ─────────────────────────────────────────────

class EventEnvelopeBase(BaseModel):
    """Base event envelope conforming to EventEnvelopeV1 spec."""

    model_config = model_config(
        strict=True,
        extra="forbid",
        frozen=True,
        ser_json_timedelta="float",
        ser_json_bytes="base64",
    )

    event_id: UUID
    event_type: str
    workflow_id: UUID
    task_id: UUID | None = None
    trace_id: UUID
    policy_bundle_id: str
    created_at: datetime
    source_system: Literal["civ", "venture"]
    replay_token: str


# ─── Workflow Events ─────────────────────────────────────────────────

class WorkflowStartedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    agent_role: Literal["analyst", "architect", "engineer", "auditor", "orchestrator"]
    workspace_id: str
    initial_task_count: int = Field(ge=0)
    policy_bundle_id: str


class WorkflowStartedEvent(EventEnvelopeBase):
    event_type: Literal["venture.workflow.started.v1"] = "venture.workflow.started.v1"
    source_system: Literal["venture"] = "venture"
    payload: WorkflowStartedPayload


class WorkflowCompletedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    status: Literal["completed", "failed", "cancelled"]
    task_count_executed: int = Field(ge=0)
    event_count: int = Field(ge=0)
    duration_ms: float = Field(ge=0)


class WorkflowCompletedEvent(EventEnvelopeBase):
    event_type: Literal["venture.workflow.completed.v1"] = "venture.workflow.completed.v1"
    source_system: Literal["venture"] = "venture"
    payload: WorkflowCompletedPayload


# ─── Task Events ─────────────────────────────────────────────────────

class TaskScheduledPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    task_type: str
    estimated_eau_cost: float = Field(ge=0)


class TaskScheduledEvent(EventEnvelopeBase):
    event_type: Literal["venture.task.scheduled.v1"] = "venture.task.scheduled.v1"
    source_system: Literal["venture"] = "venture"
    payload: TaskScheduledPayload


class TaskCompletedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    status: Literal["completed", "failed", "revoked"]
    tool_calls_count: int = Field(ge=0)
    actual_eau_cost: float = Field(ge=0)
    duration_ms: float = Field(ge=0)
    state_hash_after: str | None = None


class TaskCompletedEvent(EventEnvelopeBase):
    event_type: Literal["venture.task.completed.v1"] = "venture.task.completed.v1"
    source_system: Literal["venture"] = "venture"
    payload: TaskCompletedPayload


# ─── Money/Ledger Events ─────────────────────────────────────────────

class MoneyIntentCreatedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    intent_id: UUID
    scope_type: Literal["workflow", "task", "agent_action", "workspace", "global"]
    scope_id: str
    cap_amount: float = Field(ge=0)
    window: str
    ttl_ms: int = Field(ge=0)


class MoneyIntentCreatedEvent(EventEnvelopeBase):
    event_type: Literal["venture.money.intent_created.v1"] = "venture.money.intent_created.v1"
    source_system: Literal["venture"] = "venture"
    payload: MoneyIntentCreatedPayload


class LedgerEntryCreatedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    entry_id: UUID
    debit_account: str
    credit_account: str
    amount: float = Field(ge=0)
    reference_id: str
    reference_type: Literal["civ_transfer", "internal_spend", "allocation"]
    description: str = Field(max_length=500)
    conservation_check_hash: str | None = None


class LedgerEntryCreatedEvent(EventEnvelopeBase):
    event_type: Literal["venture.ledger.entry_created.v1"] = "venture.ledger.entry_created.v1"
    source_system: Literal["venture"] = "venture"
    payload: LedgerEntryCreatedPayload


# ─── Compliance Events ───────────────────────────────────────────────

class ComplianceViolationPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    violation_id: UUID
    violation_type: str
    severity_level: Literal["critical", "high", "medium", "low"]
    affected_workflow_id: UUID | None = None
    remediation_action: Literal[
        "suspend_workflow", "revoke_authorization", "escalate_to_human", "auto_remediate"
    ]


class ComplianceViolationEvent(EventEnvelopeBase):
    event_type: Literal["venture.compliance.violation_detected.v1"] = (
        "venture.compliance.violation_detected.v1"
    )
    source_system: Literal["venture"] = "venture"
    payload: ComplianceViolationPayload


# ─── Artifact Events ─────────────────────────────────────────────────

class ArtifactBuildCompletedPayload(BaseModel):
    model_config = model_config(strict=True, extra="forbid", frozen=True)

    build_id: UUID
    artifact_ir_id: UUID
    status: Literal["success", "failed"]
    output_hash: str
    actual_cost_eau: float = Field(ge=0)
    duration_ms: float = Field(ge=0)


class ArtifactBuildCompletedEvent(EventEnvelopeBase):
    event_type: Literal["venture.artifact.build_completed.v1"] = (
        "venture.artifact.build_completed.v1"
    )
    source_system: Literal["venture"] = "venture"
    payload: ArtifactBuildCompletedPayload
```

### 2. Discriminated Union Type

```python
# ─── The Discriminated Union ─────────────────────────────────────────

VentureEvent = Annotated[
    Union[
        WorkflowStartedEvent,
        WorkflowCompletedEvent,
        TaskScheduledEvent,
        TaskCompletedEvent,
        MoneyIntentCreatedEvent,
        LedgerEntryCreatedEvent,
        ComplianceViolationEvent,
        ArtifactBuildCompletedEvent,
    ],
    Field(discriminator="event_type"),
]


def parse_event(raw_json: bytes) -> VentureEvent:
    """Parse raw JSON bytes into a typed event.

    Uses Pydantic v2 discriminated union to dispatch
    to the correct model based on `event_type` field.

    Raises ValidationError if:
    - JSON is malformed
    - event_type is not recognized
    - Payload fields fail validation
    - Extra fields are present (strict mode)
    """
    from pydantic import TypeAdapter
    adapter = TypeAdapter(VentureEvent)
    return adapter.validate_json(raw_json)
```

### 3. NATS Serialization Contract

```python
import nats
from nats.aio.client import Client as NATSClient


async def publish_event(
    nc: NATSClient,
    tenant_id: str,
    event: EventEnvelopeBase,
) -> None:
    """Publish a typed event to NATS JetStream.

    Serialization: model.model_dump_json() produces UTF-8 bytes.
    NATS msg.data is bytes, so this is zero-copy compatible.
    """
    js = nc.jetstream()

    # Serialize to JSON bytes
    payload: bytes = event.model_dump_json().encode("utf-8")

    # Subject from event type
    subject = f"VENTURE.{tenant_id}.{event.event_type}"

    # Publish with dedup header
    await js.publish(
        subject=subject,
        payload=payload,
        headers={
            "Nats-Msg-Id": str(event.event_id),
            "Content-Type": "application/json",
            "X-Event-Type": event.event_type,
            "X-Tenant-ID": tenant_id,
        },
    )


async def consume_events(
    nc: NATSClient,
    tenant_id: str,
    handler: callable,
    consumer_name: str,
    stream_name: str,
) -> None:
    """Consume typed events from NATS JetStream.

    Deserialization: model_validate_json(msg.data) parses bytes
    directly into the discriminated union type.
    """
    js = nc.jetstream()

    sub = await js.subscribe(
        subject=f"VENTURE.{tenant_id}.>",
        durable=consumer_name,
        stream=stream_name,
    )

    async for msg in sub.messages:
        try:
            # Deserialize: bytes -> typed event
            event = parse_event(msg.data)
            await handler(event)
            await msg.ack()
        except Exception as exc:
            # Validation failure or handler error
            await msg.nak(delay=5)
            # Log the error with event context
            import structlog
            logger = structlog.get_logger()
            logger.error(
                "event_processing_failed",
                error=str(exc),
                subject=msg.subject,
                consumer=consumer_name,
            )
```

### 4. Event Registry

A local dictionary registry is simpler and sufficient for Parpour's scale (< 100 event types). A remote schema registry (Confluent, Apicurio) adds operational complexity without proportional benefit at this stage.

```python
from typing import TypeVar

T = TypeVar("T", bound=EventEnvelopeBase)

# Registry: event_type string -> Pydantic model class
EVENT_REGISTRY: dict[str, type[EventEnvelopeBase]] = {
    "venture.workflow.started.v1": WorkflowStartedEvent,
    "venture.workflow.completed.v1": WorkflowCompletedEvent,
    "venture.task.scheduled.v1": TaskScheduledEvent,
    "venture.task.completed.v1": TaskCompletedEvent,
    "venture.money.intent_created.v1": MoneyIntentCreatedEvent,
    "venture.ledger.entry_created.v1": LedgerEntryCreatedEvent,
    "venture.compliance.violation_detected.v1": ComplianceViolationEvent,
    "venture.artifact.build_completed.v1": ArtifactBuildCompletedEvent,
}


def register_event(event_cls: type[EventEnvelopeBase]) -> type[EventEnvelopeBase]:
    """Decorator to register an event class in the registry."""
    # Extract the literal event_type from the class
    event_type_field = event_cls.model_fields.get("event_type")
    if event_type_field and event_type_field.default:
        EVENT_REGISTRY[event_type_field.default] = event_cls
    return event_cls


def get_event_class(event_type: str) -> type[EventEnvelopeBase]:
    """Look up event class by event_type string."""
    cls = EVENT_REGISTRY.get(event_type)
    if cls is None:
        raise ValueError(f"Unknown event type: {event_type}")
    return cls


def get_json_schema(event_type: str) -> dict:
    """Get JSON Schema for an event type (for schema validation, docs, etc.)."""
    cls = get_event_class(event_type)
    return cls.model_json_schema()


def list_event_types() -> list[str]:
    """List all registered event types."""
    return sorted(EVENT_REGISTRY.keys())
```

### 5. Strict Mode and model_config

Pydantic v2 strict mode ensures:
- No implicit type coercion (string "123" is NOT accepted for int fields)
- No extra fields allowed (`extra="forbid"`)
- Frozen models (immutable after creation)

```python
from pydantic import ConfigDict

# Standard config for all event models
EVENT_MODEL_CONFIG = ConfigDict(
    strict=True,          # No implicit coercion
    extra="forbid",       # No extra fields
    frozen=True,          # Immutable instances
    validate_default=True,  # Validate default values
    ser_json_timedelta="float",  # Serialize timedelta as seconds
    ser_json_bytes="base64",     # Serialize bytes as base64
    json_schema_extra={
        "additionalProperties": False,
    },
)
```

**What strict mode prevents:**

| Input | Non-strict (accepts) | Strict (rejects) |
|-------|---------------------|-------------------|
| `{"amount": "100.5"}` for `float` field | Coerces to 100.5 | ValidationError |
| `{"event_id": "not-a-uuid"}` for `UUID` field | Rejects | Rejects |
| `{"extra_field": "value"}` | Depends on config | ValidationError (extra="forbid") |
| `{"status": "COMPLETED"}` for `Literal["completed"]` | Rejects (case-sensitive) | Rejects |

### 6. Causal Hash Chain

Every event includes a hash that links it to the previous event, forming an append-only causal chain. This provides tamper-proof event ordering verification:

```python
import hashlib
import json

# Use BLAKE3 for speed (pip install blake3)
# Fallback to SHA-256 if blake3 not available
try:
    import blake3
    HASH_ALGO = "blake3"
except ImportError:
    HASH_ALGO = "sha256"


def compute_causal_hash(
    prev_hash: bytes,
    event_type: str,
    payload: dict,
) -> str:
    """Compute causal hash for event chain integrity.

    Formula: HASH(prev_hash_bytes + event_type.encode() + canonical_json(payload))

    canonical_json uses sort_keys=True for deterministic ordering.
    """
    # Canonical JSON: sorted keys, no whitespace, ensure_ascii for byte stability
    canonical_payload = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        default=str,  # Handle UUID, datetime, etc.
    ).encode("utf-8")

    # Concatenate: prev_hash + event_type + payload
    data = prev_hash + event_type.encode("utf-8") + canonical_payload

    if HASH_ALGO == "blake3":
        return blake3.blake3(data).hexdigest()
    else:
        return hashlib.sha256(data).hexdigest()


# Genesis hash (first event in a chain)
GENESIS_HASH = b"\x00" * 32  # 32 zero bytes


class CausalChain:
    """Maintains the causal hash chain for a tenant's event stream."""

    def __init__(self, initial_hash: bytes = GENESIS_HASH):
        self._prev_hash = initial_hash

    def append(self, event: EventEnvelopeBase) -> str:
        """Compute and return the causal hash for this event.

        Updates internal state to chain to next event.
        """
        payload_dict = event.payload.model_dump(mode="json")
        causal_hash = compute_causal_hash(
            prev_hash=self._prev_hash,
            event_type=event.event_type,
            payload=payload_dict,
        )
        self._prev_hash = bytes.fromhex(causal_hash)
        return causal_hash

    def verify(
        self,
        events: list[EventEnvelopeBase],
        expected_hashes: list[str],
    ) -> bool:
        """Verify a sequence of events against expected causal hashes."""
        chain = CausalChain()
        for event, expected_hash in zip(events, expected_hashes):
            computed = chain.append(event)
            if computed != expected_hash:
                return False
        return True
```

### 7. Integration with EventEnvelopeBase

Add causal hash to the event envelope:

```python
class EventEnvelopeWithHash(EventEnvelopeBase):
    """Extended envelope that includes causal hash for chain integrity."""

    causal_hash: str = Field(
        ...,
        description="BLAKE3 hash linking to previous event in causal chain",
        min_length=64,
        max_length=64,
    )
    prev_hash: str = Field(
        ...,
        description="Hash of the previous event in the causal chain",
        min_length=64,
        max_length=64,
    )
```

### 8. Event Versioning and Schema Evolution

When event schemas need to change:

```python
# Version 1: original schema
class TaskCompletedPayloadV1(BaseModel):
    status: Literal["completed", "failed", "revoked"]
    tool_calls_count: int = Field(ge=0)
    actual_eau_cost: float = Field(ge=0)
    duration_ms: float = Field(ge=0)

# Version 2: added new optional field (backwards-compatible)
class TaskCompletedPayloadV2(BaseModel):
    status: Literal["completed", "failed", "revoked"]
    tool_calls_count: int = Field(ge=0)
    actual_eau_cost: float = Field(ge=0)
    duration_ms: float = Field(ge=0)
    # New in v2: optional field (backwards-compatible)
    retry_count: int = Field(default=0, ge=0)

# Both versions coexist in the discriminated union:
class TaskCompletedEventV1(EventEnvelopeBase):
    event_type: Literal["venture.task.completed.v1"] = "venture.task.completed.v1"
    payload: TaskCompletedPayloadV1

class TaskCompletedEventV2(EventEnvelopeBase):
    event_type: Literal["venture.task.completed.v2"] = "venture.task.completed.v2"
    payload: TaskCompletedPayloadV2
```

---

## Decision

**Pydantic v2 discriminated unions + local EVENT_REGISTRY + BLAKE3 causal hashing.**

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Event typing | Discriminated union on `event_type` | Type-safe dispatch; single parse function |
| Validation | Pydantic v2 strict mode | No coercion; no extra fields; immutable |
| Serialization | `model_dump_json()` -> bytes | Zero-copy to NATS; UTF-8 native |
| Deserialization | `model_validate_json(msg.data)` | Direct bytes parsing; no intermediate dict |
| Schema registry | Local `EVENT_REGISTRY` dict | Sufficient at < 100 event types; zero infrastructure |
| Causal integrity | BLAKE3(prev_hash + event_type + canonical_json) | Fast (3x SHA-256); deterministic; tamper-proof |
| Schema evolution | Versioned event types (v1, v2) | Backwards-compatible; both versions in union |

**Rejected alternatives:**

| Alternative | Reason for rejection |
|-------------|---------------------|
| Protobuf/MessagePack | JSON is human-readable, debuggable; Pydantic native; performance sufficient |
| Confluent Schema Registry | Operational overhead; overkill for < 100 event types |
| Avro | Schema evolution is better but tooling/Python ecosystem is weaker than Pydantic |
| SHA-256 for causal hash | BLAKE3 is 3x faster; equivalent security; parallelizable |
| Non-strict Pydantic | Implicit coercion creates subtle bugs in financial/compliance events |

---

## Implementation Contract

### Event Creation

```python
from uuid import uuid4
from datetime import datetime, timezone

def create_event(
    event_cls: type[EventEnvelopeBase],
    workflow_id: UUID,
    trace_id: UUID,
    policy_bundle_id: str,
    payload: BaseModel,
    task_id: UUID | None = None,
    source_system: str = "venture",
) -> EventEnvelopeBase:
    """Factory function to create a typed event."""
    event_id = uuid4()
    return event_cls(
        event_id=event_id,
        workflow_id=workflow_id,
        task_id=task_id,
        trace_id=trace_id,
        policy_bundle_id=policy_bundle_id,
        created_at=datetime.now(timezone.utc),
        source_system=source_system,
        replay_token=f"{event_id}:{source_system}:{datetime.now(timezone.utc).isoformat()}",
        payload=payload,
    )
```

### NATS Publish Contract

All event publishers MUST:
1. Create events via `create_event()` factory
2. Serialize via `event.model_dump_json().encode("utf-8")`
3. Set `Nats-Msg-Id` header to `str(event.event_id)` for dedup
4. Set `X-Event-Type` header for consumer routing

### NATS Consume Contract

All event consumers MUST:
1. Deserialize via `parse_event(msg.data)` (discriminated union)
2. Handle `ValidationError` by nak-ing the message with delay
3. Ack only after successful processing
4. Log all validation failures with `structlog`

### Causal Hash Contract

1. Each tenant has an independent causal chain
2. First event uses `GENESIS_HASH` (32 zero bytes) as `prev_hash`
3. Hash computation uses `sort_keys=True` for canonical JSON
4. Causal hash is stored alongside the event in the event store (ledger-db)
5. Verification: periodically replay events and recompute hashes; alert on mismatch

---

## Open Questions Remaining

1. **TypeAdapter caching**: `TypeAdapter(VentureEvent)` should be instantiated once and reused. Creating it per-call has startup overhead. Recommend: module-level singleton.

2. **CIV event types**: The discriminated union currently covers Venture events. CIV events (civ.tick.*, civ.economy.*, etc.) need their own models and should be included in a `CivEvent` discriminated union. The combined type would be `ParpourEvent = Union[VentureEvent, CivEvent]`.

3. **BLAKE3 dependency**: BLAKE3 via `pip install blake3` is a native extension. If BLAKE3 is not available, the fallback to SHA-256 changes the hash format. Recommendation: make BLAKE3 a hard dependency (it is fast to compile and widely available).

4. **Canonical JSON edge cases**: `json.dumps(default=str)` handles UUID and datetime but may not handle all edge cases (e.g., Decimal, bytes). For financial events, consider using `orjson` which has stricter serialization rules and is ~10x faster than stdlib json.

5. **Schema evolution governance**: Who decides when to bump event versions? Suggested: any breaking schema change requires an ADR (Architecture Decision Record) and a 2-version deprecation window.
