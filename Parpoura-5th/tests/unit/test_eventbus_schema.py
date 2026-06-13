"""Tests for venture.eventbus.schema module."""

import pytest
from datetime import datetime, timezone
from uuid import UUID, uuid4

from venture.eventbus.schema import EventEnvelopeV1, EventTypes


class TestEventEnvelopeV1:
    """Test suite for EventEnvelopeV1."""

    def test_create_event_with_defaults(self):
        """Test creating event with default values."""
        event = EventEnvelopeV1(
            event_type="policy.published.v1",
            trace_id=uuid4(),
        )
        assert event.event_type == "policy.published.v1"
        assert isinstance(event.event_id, UUID)
        assert isinstance(event.trace_id, UUID)
        assert isinstance(event.created_at, datetime)
        assert event.workflow_id is None
        assert event.task_id is None
        assert event.policy_bundle_id is None
        assert event.payload == {}

    def test_create_event_with_all_fields(self):
        """Test creating event with all fields populated."""
        trace_id = uuid4()
        workflow_id = uuid4()
        task_id = uuid4()
        policy_bundle_id = uuid4()
        payload = {"version": "1.0", "rules": ["rule1", "rule2"]}

        event = EventEnvelopeV1(
            event_type="workflow.created.v1",
            trace_id=trace_id,
            workflow_id=workflow_id,
            task_id=task_id,
            policy_bundle_id=policy_bundle_id,
            payload=payload,
        )

        assert event.trace_id == trace_id
        assert event.workflow_id == workflow_id
        assert event.task_id == task_id
        assert event.policy_bundle_id == policy_bundle_id
        assert event.payload == payload

    def test_event_model_dict(self):
        """Test converting event to dictionary."""
        event = EventEnvelopeV1(
            event_type="test.event.v1",
            trace_id=uuid4(),
        )
        event_dict = event.model_dump()
        assert "event_id" in event_dict
        assert "event_type" in event_dict
        assert "trace_id" in event_dict
        assert event_dict["event_type"] == "test.event.v1"

    def test_event_model_json(self):
        """Test converting event to JSON."""
        trace_id = uuid4()
        event = EventEnvelopeV1(
            event_type="policy.published.v1",
            trace_id=trace_id,
            payload={"version": "2.0"},
        )
        json_str = event.model_dump_json()
        assert "policy.published.v1" in json_str
        assert "version" in json_str

    def test_event_timestamp_is_recent(self):
        """Test that event created_at is recent."""
        before = datetime.now(timezone.utc)
        event = EventEnvelopeV1(
            event_type="test.event.v1",
            trace_id=uuid4(),
        )
        after = datetime.now(timezone.utc)

        assert before <= event.created_at <= after

    def test_event_id_uniqueness(self):
        """Test that each event gets a unique event_id."""
        trace_id = uuid4()
        event1 = EventEnvelopeV1(event_type="test.v1", trace_id=trace_id)
        event2 = EventEnvelopeV1(event_type="test.v1", trace_id=trace_id)

        assert event1.event_id != event2.event_id

    def test_event_with_complex_payload(self):
        """Test event with complex nested payload."""
        payload = {
            "metadata": {
                "user_id": "user123",
                "tags": ["important", "urgent"],
                "nested": {
                    "level": 3,
                    "data": [1, 2, 3],
                }
            },
            "rules": [{"id": "rule1", "enabled": True}],
        }
        event = EventEnvelopeV1(
            event_type="complex.event.v1",
            trace_id=uuid4(),
            payload=payload,
        )
        assert event.payload == payload
        assert event.payload["metadata"]["nested"]["level"] == 3

    def test_event_with_empty_payload(self):
        """Test event with explicitly empty payload."""
        event = EventEnvelopeV1(
            event_type="minimal.event.v1",
            trace_id=uuid4(),
            payload={},
        )
        assert event.payload == {}

    def test_event_type_policy_constants(self):
        """Test EventTypes.POLICY constant."""
        assert EventTypes.POLICY == "policy"

    def test_event_type_workflow_constants(self):
        """Test EventTypes.WORKFLOW constant."""
        assert EventTypes.WORKFLOW == "workflow"

    def test_event_type_task_constants(self):
        """Test EventTypes.TASK constant."""
        assert EventTypes.TASK == "task"

    def test_event_type_artifact_constants(self):
        """Test EventTypes.ARTIFACT constant."""
        assert EventTypes.ARTIFACT == "artifact"

    def test_event_type_money_constants(self):
        """Test EventTypes.MONEY constant."""
        assert EventTypes.MONEY == "money"

    def test_event_type_ledger_constants(self):
        """Test EventTypes.LEDGER constant."""
        assert EventTypes.LEDGER == "ledger"

    def test_event_type_compliance_constants(self):
        """Test EventTypes.COMPLIANCE constant."""
        assert EventTypes.COMPLIANCE == "compliance"

    def test_event_type_privacy_constants(self):
        """Test EventTypes.PRIVACY constant."""
        assert EventTypes.PRIVACY == "privacy"

    def test_event_type_control_constants(self):
        """Test EventTypes.CONTROL constant."""
        assert EventTypes.CONTROL == "control"

    def test_all_event_type_constants_are_strings(self):
        """Test that all EventTypes constants are strings."""
        for attr in dir(EventTypes):
            if not attr.startswith('_'):
                value = getattr(EventTypes, attr)
                assert isinstance(value, str)

    def test_event_validation_requires_event_type(self):
        """Test that event_type is required."""
        with pytest.raises(ValueError):
            EventEnvelopeV1(trace_id=uuid4())

    def test_event_validation_requires_trace_id(self):
        """Test that trace_id is required."""
        with pytest.raises(ValueError):
            EventEnvelopeV1(event_type="test.v1")

    def test_event_uuid_fields_are_uuids(self):
        """Test that UUID fields accept UUID objects."""
        trace_id = uuid4()
        workflow_id = uuid4()
        event = EventEnvelopeV1(
            event_type="test.v1",
            trace_id=trace_id,
            workflow_id=workflow_id,
        )
        assert isinstance(event.trace_id, UUID)
        assert isinstance(event.workflow_id, UUID)

    def test_event_preserves_optional_ids(self):
        """Test that optional IDs are preserved when provided."""
        trace_id = uuid4()
        workflow_id = uuid4()
        task_id = uuid4()
        policy_bundle_id = uuid4()

        event = EventEnvelopeV1(
            event_type="full.event.v1",
            trace_id=trace_id,
            workflow_id=workflow_id,
            task_id=task_id,
            policy_bundle_id=policy_bundle_id,
        )

        assert event.workflow_id == workflow_id
        assert event.task_id == task_id
        assert event.policy_bundle_id == policy_bundle_id
