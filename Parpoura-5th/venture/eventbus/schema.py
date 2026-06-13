"""Venture Platform - Event Envelope Schema

All events in the Venture platform follow EventEnvelopeV1.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class EventEnvelopeV1(BaseModel):
    """Standard event envelope for all Venture events."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "event_id": "evt-550e8400-e29b-41d4-a716-446655440000",
                "event_type": "policy.published.v1",
                "trace_id": "trace-550e8400-e29b-41d4-a716-446655440001",
                "workflow_id": None,
                "task_id": None,
                "policy_bundle_id": "policy-550e8400-e29b-41d4-a716-446655440002",
                "created_at": "2026-02-23T12:00:00Z",
                "payload": {"version": "1.0", "rules": []}
            }
        }
    )

    event_id: UUID = Field(default_factory=uuid4, description="Unique event identifier")
    event_type: str = Field(..., description="Event type, e.g., 'policy.published.v1'")
    trace_id: UUID = Field(..., description="Correlation ID for causal chains")
    workflow_id: UUID | None = Field(None, description="Workflow this event belongs to")
    task_id: UUID | None = Field(None, description="Task this event belongs to")
    policy_bundle_id: UUID | None = Field(None, description="Policy version in effect")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)


# Event type constants
class EventTypes:
    """Canonical event type prefixes."""
    POLICY = "policy"
    WORKFLOW = "workflow"
    TASK = "task"
    ARTIFACT = "artifact"
    MONEY = "money"
    LEDGER = "ledger"
    COMPLIANCE = "compliance"
    PRIVACY = "privacy"
    CONTROL = "control"
