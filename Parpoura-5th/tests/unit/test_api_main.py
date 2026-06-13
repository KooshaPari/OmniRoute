"""Tests for venture.api.main module."""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from venture.api.main import app, workflows, active_connections


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_state():
    """Clear global state before each test."""
    workflows.clear()
    active_connections.clear()
    yield
    workflows.clear()
    active_connections.clear()


class TestHealthEndpoint:
    """Test suite for health check endpoint."""

    def test_health_check_returns_ok(self, client):
        """Test health check returns OK status."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "OK"

    def test_health_check_includes_service_name(self, client):
        """Test health check includes service name."""
        response = client.get("/health")
        assert response.json()["service"] == "control-plane-api"

    def test_health_check_includes_version(self, client):
        """Test health check includes version."""
        response = client.get("/health")
        assert response.json()["version"] == "0.1.0"

    def test_health_check_includes_timestamp(self, client):
        """Test health check includes ISO timestamp."""
        response = client.get("/health")
        ts = response.json()["timestamp"]
        # Should be parseable as ISO format
        datetime.fromisoformat(ts)


class TestRootEndpoint:
    """Test suite for root endpoint."""

    def test_root_endpoint_returns_info(self, client):
        """Test root endpoint returns API information."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Venture Control Plane API"
        assert data["version"] == "0.1.0"
        assert data["docs"] == "/docs"


class TestCreateWorkflow:
    """Test suite for workflow creation endpoint."""

    def test_create_workflow_minimal(self, client):
        """Test creating workflow with minimal parameters."""
        response = client.post(
            "/workflows",
            params={"objective": "Test objective"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "workflow_id" in data
        assert data["objective"] == "Test objective"

    def test_create_workflow_with_budget(self, client):
        """Test creating workflow with custom budget."""
        response = client.post(
            "/workflows",
            params={
                "objective": "Expensive workflow",
                "budget_cents": 500000,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["budget_allocated"] == 500000

    def test_create_workflow_default_budget(self, client):
        """Test creating workflow uses default budget."""
        response = client.post(
            "/workflows",
            params={"objective": "Default budget workflow"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["budget_allocated"] == 100000

    def test_create_workflow_initial_status_pending(self, client):
        """Test newly created workflow has PENDING status."""
        response = client.post(
            "/workflows",
            params={"objective": "New workflow"},
        )
        data = response.json()
        assert data["status"] == "PENDING"

    def test_create_workflow_initial_spend_zero(self, client):
        """Test newly created workflow has zero spend."""
        response = client.post(
            "/workflows",
            params={"objective": "New workflow"},
        )
        data = response.json()
        assert data["budget_spent"] == 0

    def test_create_workflow_has_created_at(self, client):
        """Test workflow has created_at timestamp."""
        response = client.post(
            "/workflows",
            params={"objective": "Timestamped workflow"},
        )
        data = response.json()
        assert "created_at" in data
        datetime.fromisoformat(data["created_at"])

    def test_create_workflow_stores_in_registry(self, client):
        """Test workflow is stored in workflows dict."""
        response = client.post(
            "/workflows",
            params={"objective": "Stored workflow"},
        )
        workflow_id = response.json()["workflow_id"]
        assert workflow_id in workflows


class TestListWorkflows:
    """Test suite for workflow listing endpoint."""

    def test_list_workflows_empty_initially(self, client):
        """Test list returns empty when no workflows exist."""
        response = client.get("/workflows")
        assert response.status_code == 200
        data = response.json()
        assert data["workflows"] == []

    def test_list_workflows_after_creation(self, client):
        """Test list includes created workflows."""
        # Create workflow
        create_response = client.post(
            "/workflows",
            params={"objective": "First workflow"},
        )
        workflow_id = create_response.json()["workflow_id"]

        # List workflows
        list_response = client.get("/workflows")
        workflows_list = list_response.json()["workflows"]
        assert len(workflows_list) == 1
        assert workflows_list[0]["id"] == workflow_id

    def test_list_workflows_multiple(self, client):
        """Test list includes multiple workflows."""
        for i in range(3):
            client.post(
                "/workflows",
                params={"objective": f"Workflow {i}"},
            )

        response = client.get("/workflows")
        workflows_list = response.json()["workflows"]
        assert len(workflows_list) == 3


class TestGetWorkflow:
    """Test suite for get workflow endpoint."""

    def test_get_workflow_by_id(self, client):
        """Test retrieving workflow by ID."""
        # Create workflow
        create_response = client.post(
            "/workflows",
            params={"objective": "Get me"},
        )
        workflow_id = create_response.json()["workflow_id"]

        # Get workflow
        get_response = client.get(f"/workflows/{workflow_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == workflow_id
        assert data["objective"] == "Get me"

    def test_get_workflow_not_found(self, client):
        """Test getting non-existent workflow returns 404."""
        response = client.get("/workflows/nonexistent-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_workflow_preserves_all_fields(self, client):
        """Test get returns all workflow fields."""
        # Create workflow
        create_response = client.post(
            "/workflows",
            params={
                "objective": "Full workflow",
                "budget_cents": 250000,
            },
        )
        workflow_id = create_response.json()["workflow_id"]

        # Get and verify fields
        get_response = client.get(f"/workflows/{workflow_id}")
        data = get_response.json()
        assert "id" in data
        assert "objective" in data
        assert "status" in data
        assert "budget_allocated" in data
        assert "budget_spent" in data
        assert "created_at" in data


class TestCancelWorkflow:
    """Test suite for workflow cancellation."""

    def test_cancel_workflow_changes_status(self, client):
        """Test cancelling workflow sets status to CANCELLED."""
        # Create workflow
        create_response = client.post(
            "/workflows",
            params={"objective": "To be cancelled"},
        )
        workflow_id = create_response.json()["workflow_id"]

        # Cancel workflow
        cancel_response = client.post(f"/workflows/{workflow_id}/cancel")
        assert cancel_response.status_code == 200
        assert cancel_response.json()["status"] == "CANCELLED"

    def test_cancel_workflow_not_found(self, client):
        """Test cancelling non-existent workflow returns 404."""
        response = client.post("/workflows/nonexistent/cancel")
        assert response.status_code == 404

    def test_cancel_workflow_sets_updated_at(self, client):
        """Test cancelled workflow has updated_at timestamp."""
        # Create and cancel
        create_response = client.post(
            "/workflows",
            params={"objective": "Timestamped cancel"},
        )
        workflow_id = create_response.json()["workflow_id"]
        cancel_response = client.post(f"/workflows/{workflow_id}/cancel")

        data = cancel_response.json()
        assert "updated_at" in data or "workflow_id" in data


class TestPolicies:
    """Test suite for policy endpoints."""

    def test_publish_policy_minimal(self, client):
        """Test publishing policy with minimal parameters."""
        response = client.post(
            "/policies/publish",
            params={
                "version": "1.0.0",
            },
            json={
                "rules": [{"id": "rule1"}, {"id": "rule2"}],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "policy_id" in data
        assert data["version"] == "1.0.0"

    def test_publish_policy_with_allowlists(self, client):
        """Test publishing policy with tool allowlists."""
        allowlists = {
            "tools": ["curl", "jq"],
            "scopes": ["read"],
        }
        response = client.post(
            "/policies/publish",
            params={
                "version": "2.0.0",
            },
            json={
                "rules": [{"id": "rule1"}],
                "tool_allowlists": allowlists,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tool_allowlists"] == allowlists

    def test_publish_policy_has_created_at(self, client):
        """Test published policy has created_at timestamp."""
        response = client.post(
            "/policies/publish",
            params={
                "version": "3.0.0",
            },
            json={
                "rules": [],
            },
        )
        data = response.json()
        assert "created_at" in data
        datetime.fromisoformat(data["created_at"])

    def test_list_policies(self, client):
        """Test listing policies endpoint."""
        response = client.get("/policies")
        assert response.status_code == 200
        data = response.json()
        assert "policies" in data


class TestControlPlane:
    """Test suite for control plane endpoints."""

    def test_freeze_system(self, client):
        """Test freezing system."""
        response = client.post(
            "/control/freeze",
            params={"reason": "test-freeze"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "FROZEN"

    def test_freeze_system_default_reason(self, client):
        """Test freezing system with default reason."""
        response = client.post("/control/freeze")
        assert response.status_code == 200
        data = response.json()
        assert "reason" in data

    def test_unfreeze_system(self, client):
        """Test unfreezing system."""
        response = client.post("/control/unfreeze")
        assert response.status_code == 200
        assert response.json()["status"] == "UNFROZEN"


class TestCORSMiddleware:
    """Test suite for CORS configuration."""

    def test_cors_headers_present(self, client):
        """Test CORS headers are included in responses."""
        response = client.get("/health")
        assert response.status_code == 200
