"""Tests for Venture API."""

import pytest
from httpx import AsyncClient, ASGITransport

from venture.api.main import app
from venture.auth import create_access_token


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Create valid auth headers."""
    token = create_access_token({"sub": "test-user", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_health_check():
    """Test health endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert data["service"] == "control-plane-api"


@pytest.mark.asyncio
async def test_root():
    """Test root endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data


@pytest.mark.asyncio
async def test_create_workflow():
    """Test workflow creation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/workflows",
            params={"objective": "Test workflow", "budget_cents": 1000},
        )
        assert response.status_code == 200
        data = response.json()
        assert "workflow_id" in data
        assert data["objective"] == "Test workflow"
        assert data["budget_allocated"] == 1000


@pytest.mark.asyncio
async def test_list_workflows():
    """Test listing workflows."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a workflow first
        await client.post(
            "/workflows",
            params={"objective": "Test", "budget_cents": 5000},
        )
        # List workflows
        response = await client.get("/workflows")
        assert response.status_code == 200
        data = response.json()
        assert "workflows" in data
        assert len(data["workflows"]) >= 1


@pytest.mark.asyncio
async def test_get_workflow_not_found():
    """Test getting a non-existent workflow."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/workflows/nonexistent-id")
        assert response.status_code == 404


def test_create_access_token():
    """Test JWT token creation."""
    from venture.auth import create_access_token
    
    token = create_access_token({"sub": "test-user", "role": "admin"})
    assert token is not None
    assert len(token) > 0


def test_auth_headers_fixture(auth_headers):
    """Test auth headers fixture."""
    assert "Authorization" in auth_headers
    assert auth_headers["Authorization"].startswith("Bearer ")
