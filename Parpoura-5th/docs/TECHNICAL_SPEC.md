# PARPOUR - Comprehensive Technical Specification

**Project:** PARPOUR - Venture Control Plane  
**Version:** 2.0  
**Status:** Draft  
**Last Updated:** 2026-02-23

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [API Specification](#api-specification)
3. [Database Schema](#database-schema)
4. [Event System](#event-system)
5. [Authentication & Authorization](#authentication--authorization)
6. [Workflow Engine](#workflow-engine)
7. [Policy System](#policy-system)
8. [Security](#security)
9. [Observability](#observability)
10. [Deployment](#deployment)

---

## System Architecture

### 1.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Clients                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │  Web UI │  │  CLI    │  │  SDK    │  │ Agents  │                  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                  │
│       │             │             │             │                        │
│       └─────────────┴─────────────┴─────────────┘                        │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        API Gateway                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │ │
│  │  │   Rate       │  │    Auth      │  │    CORS      │         │ │
│  │  │   Limiter    │  │   Middleware │  │   Middleware │         │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                     Business Logic Layer                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │   Workflow   │  │    Policy   │  │   Control    │          │ │
│  │  │   Service    │  │   Service   │  │   Service    │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        Data Layer                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │  PostgreSQL  │  │    Redis     │  │    NATS     │          │ │
│  │  │  (primary)   │  │   (cache)    │  │  (events)   │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| API Gateway | Request routing, rate limiting | FastAPI |
| Auth Service | JWT validation, RBAC | python-jose |
| Workflow Service | Workflow lifecycle | Custom |
| Policy Service | Policy management | Custom |
| Database | Persistent storage | PostgreSQL |
| Cache | Session, rate limits | Redis |
| Event Bus | Async messaging | NATS |

---

## API Specification

### 2.1 REST Endpoints

#### Health
```
GET /health
Response: { "status": "OK", "service": "control-plane-api", "version": "0.1.0", "timestamp": "ISO8601" }
```

#### Workflows
```
GET    /workflows
POST   /workflows
        Body: { "objective": string, "budget_cents": int }
        Response: { "workflow_id": uuid, ... }

GET    /workflows/{workflow_id}
PUT    /workflows/{workflow_id}
DELETE /workflows/{workflow_id}

POST   /workflows/{workflow_id}/cancel
POST   /workflows/{workflow_id}/execute
POST   /workflows/{workflow_id}/pause
POST   /workflows/{workflow_id}/resume
```

#### Policies
```
GET    /policies
POST   /policies/publish
        Body: { "version": string, "rules": [], "tool_allowlists": {} }
        Response: { "policy_id": uuid, ... }

GET    /policies/{version}
DELETE /policies/{version}
```

#### Control
```
POST   /control/freeze
        Body: { "reason": string }
POST   /control/unfreeze
GET    /control/status
```

### 2.2 WebSocket

```
WS /ws/workflows/{workflow_id}

Messages:
- { "type": "status", "data": { ... } }
- { "type": "progress", "data": { "percent": 50 } }
- { "type": "complete", "data": { "result": "..." } }
- { "type": "error", "data": { "message": "..." } }
```

### 2.3 Error Responses

```json
{
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "Workflow with ID xyz not found",
    "details": {}
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request body |
| UNAUTHORIZED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Database Schema

### 3.1 Entity Relationship

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Workflow   │────<│    Task     │────<│   Artifact  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                      Events (append-only)                │
│  event_id, event_type, trace_id, workflow_id, payload │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Policy    │────<│   Rules     │
└─────────────┘     └─────────────┘
```

### 3.2 Tables

```sql
-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    objective TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    budget_allocated BIGINT DEFAULT 0,
    budget_spent BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    name VARCHAR(255),
    status VARCHAR(20),
    input JSONB,
    output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events (append-only)
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    trace_id UUID NOT NULL,
    workflow_id UUID,
    task_id UUID,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_workflow ON events(workflow_id, created_at);
CREATE INDEX idx_events_trace ON events(trace_id);

-- Policy Bundles
CREATE TABLE policy_bundles (
    id UUID PRIMARY KEY,
    version VARCHAR(20) UNIQUE NOT NULL,
    rules JSONB NOT NULL,
    tool_allowlists JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Checkpoints
CREATE TABLE audit_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL,
    event_id_start UUID NOT NULL,
    event_id_end UUID NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Event System

### 4.1 Event Schema

```python
class EventEnvelopeV1(BaseModel):
    event_id: UUID
    event_type: str  # e.g., "workflow.created.v1"
    trace_id: UUID
    workflow_id: UUID | None
    task_id: UUID | None
    policy_bundle_id: UUID | None
    created_at: datetime
    payload: dict[str, Any]
```

### 4.2 Event Types

| Category | Event | Description |
|----------|-------|-------------|
| Workflow | workflow.created | New workflow |
| | workflow.started | Execution started |
| | workflow.completed | Successful completion |
| | workflow.failed | Execution failed |
| | workflow.cancelled | User cancelled |
| Task | task.started | Task started |
| | task.completed | Task finished |
| | task.failed | Task failed |
| Policy | policy.published | New policy |
| | policy.activated | Policy in effect |
| Control | control.freeze | System frozen |
| | control.unfreeze | System unfrozen |

### 4.3 Event Publishing

```python
async def publish_event(event: EventEnvelopeV1):
    await nats_client.publish(
        subject=f"events.{event.event_type}",
        payload=event.model_dump_json().encode()
    )
```

---

## Authentication & Authorization

### 5.1 JWT Flow

```
1. Client → POST /auth/login
   Body: { "username": "...", "password": "..." }

2. Server validates credentials
   - Check password hash (bcrypt)
   - Generate JWT with claims

3. Server → Response
   { "access_token": "eyJ...", "token_type": "Bearer" }

4. Client → API Request
   Headers: { "Authorization": "Bearer eyJ..." }

5. Server validates token
   - Verify signature
   - Check expiration
   - Extract claims
```

### 5.2 Token Claims

```python
{
    "sub": "user_id",
    "role": "admin|operator|viewer",
    "permissions": ["workflow:read", "workflow:write"],
    "exp": 1234567890,
    "iat": 1234567890
}
```

### 5.3 Role Permissions

| Role | workflows | policies | control | admin |
|------|-----------|----------|---------|-------|
| viewer | read | read | read | no |
| operator | read/write | read | freeze/unfreeze | no |
| admin | read/write | read/write | read/write | yes |

---

## Workflow Engine

### 6.1 Workflow States

```
PENDING → RUNNING → COMPLETED
    ↓         ↓         ↑
  CANCELLED  PAUSED   FAILED
```

### 6.2 Workflow Execution

```python
class WorkflowEngine:
    async def execute(self, workflow: Workflow):
        await self.set_status(workflow, "RUNNING")
        
        for task in workflow.tasks:
            try:
                await self.execute_task(task)
                await self.emit_event("task.completed", task)
            except Exception as e:
                await self.emit_event("task.failed", { "error": str(e) })
                await self.set_status(workflow, "FAILED")
                raise
        
        await self.set_status(workflow, "COMPLETED")
```

### 6.3 Task Types

| Type | Handler |
|------|---------|
| http | HTTP request |
| script | Run script |
| agent | Invoke agent |
| condition | Conditional branch |
| parallel | Parallel execution |
| wait | Delay |

---

## Policy System

### 7.1 Policy Structure

```python
class PolicyBundle(BaseModel):
    version: str
    rules: list[Rule]
    tool_allowlists: dict[str, list[str]]

class Rule(BaseModel):
    id: str
    action: Literal["allow", "deny"]
    resource: str  # glob pattern
    conditions: list[Condition]

class Condition(BaseModel):
    field: str
    operator: Literal["eq", "ne", "in", "regex"]
    value: Any
```

### 7.2 Tool Allowlists

```python
# Example: Only allow certain tools per role
tool_allowlists = {
    "viewer": ["read", "list"],
    "operator": ["read", "list", "write", "execute"],
    "admin": ["*"]
}
```

---

## Security

### 8.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | Parameterized queries (SQLAlchemy) |
| XSS | Output encoding |
| CSRF | CSRF tokens |
| Token Theft | Short expiry, refresh tokens |
| Rate Limiting | slowapi per-IP |
| Data Breach | Encryption at rest |

### 8.2 Security Headers

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization"],
)
```

---

## Observability

### 9.1 Metrics

```python
from opentelemetry import metrics

meter = metrics.get_meter(__name__)
workflows_total = meter.create_counter("workflows_total")
task_duration = meter.create_histogram("task_duration_seconds")
```

### 9.2 Logging

```python
import structlog

logger = structlog.get_logger()
logger.info("workflow_created", workflow_id=id, user=user)
```

---

## Deployment

### 10.1 Docker

```dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install .
COPY . .
EXPOSE 8000
CMD ["uvicorn", "venture.api.main:app", "--host", "0.0.0.0"]
```

### 10.2 Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: parpour
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: parpour:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: parpour-secrets
              key: database-url
```

---

## Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| API Server | ✅ Done | P0 |
| JWT Auth | ✅ Done | P0 |
| In-Memory Storage | ✅ Done | P0 |
| PostgreSQL Config | ✅ Done | P1 |
| Workflow Engine | ⬜ Pending | P1 |
| Policy Engine | ⬜ Pending | P1 |
| WebSocket | ⬜ Pending | P1 |
| NATS Integration | ⬜ Pending | P2 |
| Redis Caching | ⬜ Pending | P2 |
| Rate Limiting | ⬜ Pending | P2 |
