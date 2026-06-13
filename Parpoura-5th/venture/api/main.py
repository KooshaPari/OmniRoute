"""Venture Control Plane API

Founder-facing REST API for task submission, policy management, and system control.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup/shutdown."""
    logger.info("Starting Venture Control Plane API...")
    yield
    logger.info("Shutting down Venture Control Plane API...")


app = FastAPI(
    title="Venture Control Plane API",
    description="Founder-facing API for venture orchestration",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory storage (replace with database in production)
workflows: dict[str, dict] = {}
active_connections: list[WebSocket] = []


@app.get("/health")
async def health_check():
    """System health check."""
    return {
        "status": "OK",
        "service": "control-plane-api",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
async def root():
    """API root."""
    return {
        "name": "Venture Control Plane API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.post("/workflows")
async def create_workflow(objective: str, budget_cents: int = 100000):
    """
    Create a new workflow.
    
    Args:
        objective: The goal/objective of the workflow
        budget_cents: Budget allocated in cents
    """
    workflow_id = str(uuid.uuid4())
    workflow = {
        "id": workflow_id,
        "objective": objective,
        "budget_allocated": budget_cents,
        "budget_spent": 0,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    workflows[workflow_id] = workflow

    logger.info(f"Created workflow {workflow_id}: {objective}")

    return {"workflow_id": workflow_id, **workflow}


@app.get("/workflows")
async def list_workflows():
    """List all workflows."""
    return {"workflows": list(workflows.values())}


@app.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get workflow details."""
    if workflow_id not in workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows[workflow_id]


@app.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """Cancel a workflow."""
    if workflow_id not in workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflows[workflow_id]["status"] = "CANCELLED"
    workflows[workflow_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    logger.info(f"Cancelled workflow {workflow_id}")

    return {"status": "CANCELLED", "workflow_id": workflow_id}


@app.post("/control/freeze")
async def freeze_system(reason: str = "founder-initiated"):
    """
    Global pause - freeze all agent execution.
    """
    logger.warning(f"SYSTEM FROZEN: {reason}")

    # Broadcast freeze event to all connected clients
    event = {
        "event_type": "control.freeze.activated.v1",
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    for conn in active_connections:
        try:
            await conn.send_json(event)
        except Exception:
            pass

    return {"status": "FROZEN", "reason": reason}


@app.post("/control/unfreeze")
async def unfreeze_system():
    """Unfreeze the system."""
    logger.info("SYSTEM UNFROZEN")

    event = {
        "event_type": "control.unfreeze.activated.v1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    for conn in active_connections:
        try:
            await conn.send_json(event)
        except Exception:
            pass

    return {"status": "UNFROZEN"}


@app.websocket("/ws/workflows/{workflow_id}")
async def workflow_websocket(websocket: WebSocket, workflow_id: str):
    """WebSocket for real-time workflow updates."""
    await websocket.accept()
    active_connections.append(websocket)

    try:
        if workflow_id in workflows:
            await websocket.send_json(workflows[workflow_id])

        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            logger.debug(f"WebSocket received: {data}")

    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


# Policy endpoints
@app.post("/policies/publish")
async def publish_policy(version: str, rules: list[dict], tool_allowlists: dict | None = None):
    """Publish a new policy bundle."""
    policy_id = str(uuid.uuid4())

    policy = {
        "id": policy_id,
        "version": version,
        "rules": rules,
        "tool_allowlists": tool_allowlists or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info(f"Published policy {version}: {policy_id}")

    return {"policy_id": policy_id, **policy}


@app.get("/policies")
async def list_policies():
    """List all policy bundles."""
    # Placeholder - would query database
    return {"policies": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
