"""Integration tests for workflow lifecycle."""

import pytest
from fastapi.testclient import TestClient

from venture.api.main import app, workflows


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def clear_workflows():
    """Clear workflows before each test."""
    workflows.clear()
    yield
    workflows.clear()


class TestWorkflowLifecycle:
    """Test complete workflow lifecycle."""

    def test_workflow_create_and_retrieve(self, client, clear_workflows):
        """Test creating and retrieving a workflow."""
        # Create workflow
        create_resp = client.post(
            "/workflows",
            params={
                "objective": "Integration test workflow",
                "budget_cents": 500000,
            },
        )
        assert create_resp.status_code == 200
        workflow_id = create_resp.json()["workflow_id"]

        # Retrieve workflow
        get_resp = client.get(f"/workflows/{workflow_id}")
        assert get_resp.status_code == 200
        workflow = get_resp.json()

        # Verify fields
        assert workflow["id"] == workflow_id
        assert workflow["objective"] == "Integration test workflow"
        assert workflow["budget_allocated"] == 500000
        assert workflow["status"] == "PENDING"

    def test_multiple_workflows_isolation(self, client, clear_workflows):
        """Test that multiple workflows are isolated."""
        # Create multiple workflows
        ids = []
        for i in range(3):
            resp = client.post(
                "/workflows",
                params={
                    "objective": f"Workflow {i}",
                    "budget_cents": (i + 1) * 100000,
                },
            )
            ids.append(resp.json()["workflow_id"])

        # Verify each workflow has correct budget
        for i, wid in enumerate(ids):
            resp = client.get(f"/workflows/{wid}")
            assert resp.json()["budget_allocated"] == (i + 1) * 100000

    def test_workflow_cancellation_flow(self, client, clear_workflows):
        """Test workflow cancellation updates status."""
        # Create workflow
        create_resp = client.post(
            "/workflows",
            params={"objective": "Cancellable workflow"},
        )
        workflow_id = create_resp.json()["workflow_id"]

        # Verify initial status
        get_resp = client.get(f"/workflows/{workflow_id}")
        assert get_resp.json()["status"] == "PENDING"

        # Cancel workflow
        cancel_resp = client.post(f"/workflows/{workflow_id}/cancel")
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "CANCELLED"

        # Verify status persisted
        get_resp = client.get(f"/workflows/{workflow_id}")
        workflow = get_resp.json()
        assert workflow["status"] == "CANCELLED"

    def test_list_reflects_all_created_workflows(self, client, clear_workflows):
        """Test workflow list includes all created workflows."""
        created_ids = []
        
        # Create workflows
        for i in range(5):
            resp = client.post(
                "/workflows",
                params={"objective": f"Workflow {i}"},
            )
            created_ids.append(resp.json()["workflow_id"])

        # List all workflows
        list_resp = client.get("/workflows")
        workflows_list = list_resp.json()["workflows"]

        # Verify count and IDs
        assert len(workflows_list) == 5
        retrieved_ids = {w["id"] for w in workflows_list}
        assert retrieved_ids == set(created_ids)


class TestPolicyLifecycle:
    """Test policy publishing lifecycle."""

    def test_publish_and_retrieve_policy(self, client):
        """Test publishing and basic policy retrieval."""
        # Publish policy
        publish_resp = client.post(
            "/policies/publish",
            params={
                "version": "1.0.0",
            },
            json={
                "rules": [{"id": "rule-a"}, {"id": "rule-b"}],
                "tool_allowlists": {"tools": ["tool1"]},
            },
        )
        assert publish_resp.status_code == 200
        policy = publish_resp.json()

        # Verify fields
        assert "policy_id" in policy
        assert policy["version"] == "1.0.0"
        assert len(policy["rules"]) == 2
        assert policy["tool_allowlists"]["tools"] == ["tool1"]

    def test_multiple_policy_versions(self, client):
        """Test publishing multiple policy versions."""
        policy_ids = []

        # Publish multiple policies
        for version in ["1.0.0", "2.0.0", "3.0.0"]:
            resp = client.post(
                "/policies/publish",
                params={
                    "version": version,
                },
                json={
                    "rules": [{"id": f"rule-{version}"}],
                },
            )
            policy_ids.append(resp.json()["policy_id"])

        # All should have unique IDs
        assert len(set(policy_ids)) == 3


class TestSystemControl:
    """Test system control plane operations."""

    def test_freeze_unfreeze_cycle(self, client):
        """Test freezing and unfreezing system."""
        # Freeze system
        freeze_resp = client.post("/control/freeze", params={"reason": "test"})
        assert freeze_resp.status_code == 200
        assert freeze_resp.json()["status"] == "FROZEN"

        # Unfreeze system
        unfreeze_resp = client.post("/control/unfreeze")
        assert unfreeze_resp.status_code == 200
        assert unfreeze_resp.json()["status"] == "UNFROZEN"

    def test_health_remains_ok_during_operations(self, client, clear_workflows):
        """Test health check remains OK during workflow operations."""
        # Initial health
        health1 = client.get("/health")
        assert health1.json()["status"] == "OK"

        # Create workflow
        client.post(
            "/workflows",
            params={"objective": "Test"},
        )

        # Health still OK
        health2 = client.get("/health")
        assert health2.json()["status"] == "OK"

        # Freeze system
        client.post("/control/freeze")

        # Health still OK
        health3 = client.get("/health")
        assert health3.json()["status"] == "OK"


class TestErrorHandling:
    """Test error handling in API."""

    def test_get_nonexistent_workflow_404(self, client):
        """Test getting non-existent workflow returns proper 404."""
        resp = client.get("/workflows/nonexistent-id-12345")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_cancel_nonexistent_workflow_404(self, client):
        """Test cancelling non-existent workflow returns 404."""
        resp = client.post("/workflows/nonexistent-id-12345/cancel")
        assert resp.status_code == 404
