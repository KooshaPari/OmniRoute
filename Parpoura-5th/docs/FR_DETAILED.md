# PARPOUR Functional Requirements

**Project:** PARPOUR - Venture Control Plane  
**Version:** 2.0  
**Status:** Draft

---

## FR Numbering

```
FR-API-XXX    = REST API endpoints
FR-AUTH-XXX   = Authentication
FR-WF-XXX     = Workflow engine
FR-POL-XXX    = Policy system
FR-EVT-XXX    = Event system
FR-DB-XXX     = Database layer
FR-SEC-XXX    = Security
FR-OBS-XXX    = Observability
FR-PERF-XXX   = Performance
```

---

## API ENDPOINTS (FR-API)

### FR-API-001: Health Check
**Priority:** P0  
**Status:** ✅ Implemented

The API MUST provide a health check endpoint.

```
GET /health
Response: { "status": "OK", "service": "control-plane-api", "version": "0.1.0", "timestamp": "ISO8601" }
```

---

### FR-API-002: Workflow CRUD
**Priority:** P0  
**Status:** ✅ Implemented (in-memory)

The API MUST support workflow lifecycle operations.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /workflows | List all workflows |
| POST | /workflows | Create workflow |
| GET | /workflows/{id} | Get workflow |
| PUT | /workflows/{id} | Update workflow |
| DELETE | /workflows/{id} | Delete workflow |

**Pending:** Connect to database

---

### FR-API-003: Workflow Execution
**Priority:** P1  
**Status:** ⬜ Pending

The API MUST support workflow execution control.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /workflows/{id}/execute | Start execution |
| POST | /workflows/{id}/pause | Pause execution |
| POST | /workflows/{id}/resume | Resume execution |
| POST | /workflows/{id}/cancel | Cancel execution |

---

### FR-API-004: WebSocket Updates
**Priority:** P1  
**Status:** ⬜ Pending

The API MUST provide WebSocket for real-time updates.

```
WS /ws/workflows/{workflow_id}
```

**Events:**
- status: Workflow status change
- progress: Execution progress (0-100)
- complete: Workflow completed
- error: Error occurred

---

### FR-API-005: Policy Management
**Priority:** P1  
**Status:** ⬜ Pending

The API MUST support policy CRUD.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /policies | List policies |
| POST | /policies/publish | Publish policy |
| GET | /policies/{version} | Get policy |
| DELETE | /policies/{version} | Delete policy |

---

### FR-API-006: Control Endpoints
**Priority:** P1  
**Status:** ✅ Implemented

The API MUST support system-wide control.

```
POST /control/freeze
POST /control/unfreeze
GET /control/status
```

---

## AUTHENTICATION (FR-AUTH)

### FR-AUTH-001: JWT Tokens
**Priority:** P0  
**Status:** ✅ Implemented

The system MUST use JWT for authentication.

**Requirements:**
- HS256 algorithm
- 30-minute expiry
- Claims: sub, role, permissions, exp, iat

---

### FR-AUTH-002: Role-Based Access
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST enforce RBAC.

| Role | Permissions |
|------|-------------|
| viewer | read |
| operator | read, write, execute |
| admin | read, write, execute, admin |

---

### FR-AUTH-003: Token Refresh
**Priority:** P2  
**Status:** ⬜ Pending

The system MUST support token refresh.

```
POST /auth/refresh
Body: { "refresh_token": "..." }
Response: { "access_token": "..." }
```

---

### FR-AUTH-004: API Keys
**Priority:** P2  
**Status:** ⬜ Pending

The system MUST support API key authentication for service-to-service.

```
Header: X-API-Key: sk_live_...
```

---

## WORKFLOW ENGINE (FR-WF)

### FR-WF-001: Workflow Definition
**Priority:** P0  
**Status:** ⬜ Pending

The engine MUST support workflow definition.

```python
class Workflow(BaseModel):
    id: UUID
    objective: str
    budget_cents: int
    tasks: list[Task]
    status: WorkflowStatus
```

---

### FR-WF-002: Task Execution
**Priority:** P0  
**Status:** ⬜ Pending

The engine MUST execute tasks.

**Task Types:**
- http: HTTP request
- script: Shell script
- agent: AI agent invocation
- condition: Conditional logic

---

### FR-WF-003: Task Dependencies
**Priority:** P1  
**Status:** ⬜ Pending

The engine MUST handle task dependencies.

```python
class Task(BaseModel):
    id: UUID
    name: str
    depends_on: list[UUID]  # Task IDs this depends on
```

---

### FR-WF-004: Parallel Execution
**Priority:** P1  
**Status:** ⬜ Pending

The engine MUST support parallel task execution.

---

### FR-WF-005: Error Handling
**Priority:** P0  
**Status:** ⬜ Pending

The engine MUST handle errors gracefully.

- Retry failed tasks (configurable)
- Emit failure events
- Update workflow status
- Log errors

---

## POLICY SYSTEM (FR-POL)

### FR-POL-001: Policy Bundles
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST support policy bundles.

```python
class PolicyBundle(BaseModel):
    version: str  # semantic versioning
    rules: list[Rule]
    tool_allowlists: dict[str, list[str]]
```

---

### FR-POL-002: Rule Evaluation
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST evaluate policy rules.

**Operators:**
- eq: equals
- ne: not equals
- in: in list
- regex: regex match

---

### FR-POL-003: Tool Allowlists
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST enforce tool allowlists per role.

---

## EVENT SYSTEM (FR-EVT)

### FR-EVT-001: Event Schema
**Priority:** P1  
**Status:** ✅ Implemented

Events MUST follow EventEnvelopeV1 schema.

```python
class EventEnvelopeV1(BaseModel):
    event_id: UUID
    event_type: str
    trace_id: UUID
    workflow_id: UUID | None
    task_id: UUID | None
    created_at: datetime
    payload: dict
```

---

### FR-EVT-002: Event Publishing
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST publish events to NATS.

---

### FR-EVT-003: Event Replay
**Priority:** P2  
**Status:** ⬜ Pending

The system MUST support event replay.

---

## DATABASE (FR-DB)

### FR-DB-001: PostgreSQL Connection
**Priority:** P0  
**Status:** ✅ Implemented (config ready)

The system MUST connect to PostgreSQL.

---

### FR-DB-002: Migrations
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST support database migrations via Alembic.

---

### FR-DB-003: Connection Pooling
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST use connection pooling.

---

## SECURITY (FR-SEC)

### FR-SEC-001: Rate Limiting
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST limit request rates.

- Per-IP limits
- Per-user limits
- Configurable thresholds

---

### FR-SEC-002: CORS Configuration
**Priority:** P1  
**Status:** ✅ Implemented

The system MUST configure CORS.

---

### FR-SEC-003: Input Validation
**Priority:** P0  
**Status:** ⬜ Pending

The system MUST validate all input.

- Request body schemas
- Query parameters
- Path parameters

---

## OBSERVABILITY (FR-OBS)

### FR-OBS-001: Metrics
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST expose metrics.

**Metrics:**
- workflows_total (counter)
- task_duration_seconds (histogram)
- api_request_duration_seconds (histogram)

---

### FR-OBS-002: Tracing
**Priority:** P2  
**Status:** ⬜ Pending

The system MUST support distributed tracing.

---

### FR-OBS-003: Logging
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST log structured data.

---

## PERFORMANCE (FR-PERF)

### FR-PERF-001: Response Time
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST respond within SLA.

- P50: <100ms
- P95: <500ms
- P99: <1s

---

### FR-PERF-002: Concurrency
**Priority:** P1  
**Status:** ⬜ Pending

The system MUST handle concurrent requests.

- 1000 concurrent users
- 100 concurrent workflows

---

## Summary

| Category | Total | Done | Pending |
|----------|-------|------|---------|
| API | 6 | 3 | 3 |
| Auth | 4 | 1 | 3 |
| Workflow | 5 | 0 | 5 |
| Policy | 3 | 0 | 3 |
| Event | 3 | 1 | 2 |
| Database | 3 | 1 | 2 |
| Security | 3 | 1 | 2 |
| Observability | 3 | 0 | 3 |
| Performance | 2 | 0 | 2 |
| **TOTAL** | **32** | **7** | **25** |
