"""Shared pytest configuration and fixtures."""

import os

# Enable CI mode for relaxed version checks
os.environ['VENTURE_CI_MODE'] = '1'

import pytest


def pytest_configure(config):
    """Configure pytest."""
    # Custom markers
    config.addinivalue_line(
        "markers", "asyncio: mark test as requiring asyncio"
    )


@pytest.fixture
def event_trace_id():
    """Provide a unique trace ID for testing."""
    from uuid import uuid4
    return uuid4()


@pytest.fixture
def event_workflow_id():
    """Provide a unique workflow ID for testing."""
    from uuid import uuid4
    return uuid4()


@pytest.fixture
def sample_payload():
    """Provide sample event payload."""
    return {
        "action": "test",
        "data": {"value": 42, "items": ["a", "b", "c"]},
    }


@pytest.fixture
def mock_clock(monkeypatch):
    """Mock datetime.utcnow for testing."""
    from datetime import datetime

    fixed_time = datetime(2026, 2, 23, 12, 0, 0)

    # Note: actual monkeypatching would be done per test if needed
    return fixed_time
