# Parpour Library Manifest

**Document ID:** PARPOUR-LIB-MANIFEST-001
**Version:** 1.0.0
**Status:** ACTIVE
**Date:** 2026-02-21
**Owner:** Venture Platform Engineering
**Related Specs:**
- `TECHNICAL_SPEC.md` — System architecture, service inventory, data flow
- `TRACK_C_CONTROL_PLANE.md` — Control plane, policy engine, rollout stages
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Treasury, ledger, compliance subsystem
- `docs/reference/SERVICE_CATALOG.md` — Service catalog and health contracts
- `docs/reference/INTERFACE_CONTRACTS.md` — Interface contracts between services

---

## Table of Contents

1. [Philosophy and Governance](#1-philosophy-and-governance)
2. [Web Framework: FastAPI](#2-web-framework-fastapi)
3. [Event Streaming: nats.py](#3-event-streaming-natspy)
4. [Database: SQLAlchemy + asyncpg + Alembic](#4-database-sqlalchemy--asyncpg--alembic)
5. [HTTP Client: httpx](#5-http-client-httpx)
6. [Validation: Pydantic v2](#6-validation-pydantic-v2)
7. [Resilience: tenacity](#7-resilience-tenacity)
8. [Logging: structlog](#8-logging-structlog)
9. [Cache: redis-py async](#9-cache-redis-py-async)
10. [Configuration: pydantic-settings](#10-configuration-pydantic-settings)
11. [Artifact Generation Libraries](#11-artifact-generation-libraries)
12. [AI and LLM SDKs](#12-ai-and-llm-sdks)
13. [Testing Libraries](#13-testing-libraries)
14. [Security Libraries](#14-security-libraries)
15. [Development Tooling](#15-development-tooling)
16. [Pinned pyproject.toml Dependencies](#16-pinned-pyprojecttoml-dependencies)

---

## 1. Philosophy and Governance

### 1.1 Runtime: uv + CPython 3.14

The Parpour platform runs on **CPython 3.14** managed by **uv**. The Python runtime selection is non-negotiable for the following reasons:

- **CPython 3.14 Free-Threaded mode (PEP 703):** The GIL is disabled in the experimental free-threaded build, enabling true CPU parallelism for artifact compilation workers and agent-runtime workers.
- **uv:** Replaces `pip`, `venv`, `pip-tools`, and `pipx` with a single Rust-based tool. Dependency resolution is 10-100x faster than pip. Lockfile (`uv.lock`) is deterministic across platforms.
- **No PyPy:** PyPy is not supported. The CPython 3.14 free-threaded build meets parallelism requirements without the ecosystem incompatibilities of PyPy.
- **No conda:** conda is not used. All package management goes through uv + PyPI.

Environment setup:
```bash
uv venv --python 3.14
source .venv/bin/activate
uv sync --frozen  # Install from uv.lock exactly
```

### 1.2 Library-First Mandate

Every engineering problem that falls into a "common" category — HTTP routing, validation, retry logic, rate limiting, caching, logging, JWT handling, database querying — is solved by a library. The decision path:

1. **Does a well-maintained library solve 80%+ of this need?** Use it directly.
2. **Does it solve 60-80%?** Use it with a thin wrapper (< 100 LOC).
3. **Does it solve < 60%?** Consider two alternatives before concluding custom code is necessary. Document the decision in an ADR.

The following patterns are **absolutely forbidden** without an ADR:
- Custom retry loops (use `tenacity`)
- Custom cache TTL logic (use `redis-py` with `EX=`)
- Custom rate limiter (use `tenacity + asyncio.Semaphore`)
- Custom JWT handling (use `python-jose`)
- Custom config parsing (use `pydantic-settings`)
- Custom HTTP clients (use `httpx`)

### 1.3 Fail-Fast, Not Silent

All libraries are configured to fail loudly:
- No `try/except: pass` blocks
- No silent fallback to defaults when required config is missing
- No "graceful degradation" that hides errors from operators
- `tenacity` retries are configured with explicit `stop_after_attempt` — they do not retry indefinitely
- `structlog` captures all exceptions with full stack traces

### 1.4 Async-First

All I/O is async. No blocking I/O in the async event loop. Rules:
- Database queries: `sqlalchemy` async + `asyncpg`
- HTTP calls: `httpx.AsyncClient`
- Redis: `redis.asyncio`
- NATS: `nats.py` async client
- Any CPU-bound work exceeding 10ms: `asyncio.run_in_executor` or a dedicated worker process

### 1.5 Version Pinning Policy

All dependencies are pinned in `uv.lock` (exact hashes). `pyproject.toml` uses caret ranges for flexibility during development; `uv.lock` pins exact versions for reproducibility. The lock file is committed to the repository and updated only via `uv lock --upgrade-package <name>` after testing.

---

## 2. Web Framework: FastAPI

### 2.1 Full Decision Matrix

| Criterion | FastAPI 0.115+ | Litestar 2.x | Flask 3.x | Django REST 3.x | aiohttp |
|---|---|---|---|---|---|
| **Native async support** | YES — ASGI-first | YES — ASGI-first | PARTIAL — async views in 3.x | PARTIAL | YES |
| **Pydantic v2 integration** | NATIVE — first-class | NATIVE | NO — manual | NO — manual | NO |
| **OpenAPI auto-generation** | YES — automatic, zero config | YES | NO — flask-restx needed | YES — drf-spectacular | NO |
| **WebSocket support** | YES — via Starlette | YES | PARTIAL | NO | YES |
| **Dependency injection** | YES — `Depends()` pattern | YES — `Provide()` | NO | NO | NO |
| **Type-safety at routing** | YES — path param types | YES | PARTIAL | PARTIAL | NO |
| **Background tasks** | YES — `BackgroundTasks` | YES | NO | NO | YES |
| **Middleware composition** | YES — Starlette ASGI | YES | YES — Werkzeug | YES | YES |
| **Community size (2026)** | VERY LARGE | MEDIUM | VERY LARGE | VERY LARGE | MEDIUM |
| **Startup time** | Fast | Fast | Very fast | Slow | Fast |
| **Test client** | EXCELLENT — `httpx.AsyncClient` | GOOD | GOOD — `test_client()` | GOOD | ACCEPTABLE |
| **Active development** | YES — Tiangolo + community | YES | YES | YES | YES |
| **gRPC support** | NO — HTTP only | NO | NO | NO | NO |

### 2.2 Decision: FastAPI 0.115+

**Selected:** `fastapi==0.115.8` with `uvicorn[standard]==0.34.0`

**Why FastAPI over Litestar:**

Litestar is technically excellent and competitive with FastAPI in benchmark performance. The decision in favor of FastAPI is based on:

1. **Pydantic v2 integration maturity.** FastAPI's integration with Pydantic v2 is battle-tested with known patterns for complex nested models, discriminated unions, and computed fields. Parpour's `EventEnvelopeV1`, `TaskEnvelopeV1`, and money intent schemas are complex enough that this maturity matters.
2. **Ecosystem size.** FastAPI has a significantly larger ecosystem of compatible extensions, tutorials, and community examples. Agent-runtime developers work with FastAPI daily; context-switching to Litestar adds cognitive overhead.
3. **WebSocket integration.** FastAPI's WebSocket support via Starlette is used for the founder control plane WebSocket (founder receives real-time workflow updates). The pattern is well-documented and tested.

**Why FastAPI over Flask:**

Flask is synchronous by design. While Flask 3.x supports async views, they run in a thread pool — not on a native async event loop. For Parpour's workload (thousands of concurrent NATS event callbacks, WebSocket connections, and database queries), native async is mandatory. Using Flask would require `gunicorn` with synchronous workers and a separate async process for NATS handling — architectural complexity that FastAPI eliminates.

**Why FastAPI over Django REST:**

Django REST Framework couples the web layer to Django's ORM. Parpour uses `sqlalchemy` 2.x async with explicit SQL control, not Django's ORM. The Django dependency tree would add 40+ transitive packages for capabilities that FastAPI provides more lightly.

### 2.3 Key API Used

```python
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize NATS, database pool, Redis
    await startup_event_bus()
    await startup_db_pool()
    yield
    # Shutdown: drain connections gracefully
    await shutdown_event_bus()
    await shutdown_db_pool()

app = FastAPI(
    title="Venture Control Plane API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.post("/workflows", response_model=WorkflowCreatedResponse, status_code=201)
async def create_workflow(
    payload: CreateWorkflowRequest,
    db: AsyncSession = Depends(get_db),
    nats: NATSClient = Depends(get_nats),
    current_founder: Founder = Depends(require_founder_auth),
) -> WorkflowCreatedResponse:
    ...

@app.websocket("/ws/founder")
async def founder_websocket(ws: WebSocket, token: str):
    await ws.accept()
    # Stream workflow updates to founder in real-time
    ...
```

---

## 3. Event Streaming: nats.py

### 3.1 Selection

**Selected:** `nats-py==2.10.0` (async NATS client with JetStream support)

NATS JetStream is the event bus for all Parpour services. `nats.py` is the official Python async client maintained by the NATS.io organization.

### 3.2 Why NATS JetStream

| Property | NATS JetStream | Apache Kafka | RabbitMQ | Redis Streams |
|---|---|---|---|---|
| **At-least-once delivery** | YES | YES | YES | YES |
| **Exactly-once (with dedup)** | YES — message deduplication | YES — idempotent producer | PARTIAL | NO |
| **Consumer groups** | YES — push and pull | YES | YES | YES |
| **Message replay from offset** | YES | YES | NO (by default) | YES |
| **Persistence** | YES — file or memory backed | YES | YES | YES (AOF) |
| **Horizontal scaling** | YES — cluster mode | YES | YES | PARTIAL |
| **Operational complexity** | LOW | HIGH | MEDIUM | LOW |
| **Python async client** | EXCELLENT — official `nats.py` | ACCEPTABLE — `confluent-kafka` | GOOD — `aio-pika` | GOOD — `redis.asyncio` |
| **Request/Reply pattern** | NATIVE | NO (manual) | YES | NO |
| **Latency** | Very low (<1ms) | Low (5-15ms) | Low | Very low |

NATS is selected over Kafka because Kafka's operational complexity (ZooKeeper or KRaft, partition management, consumer group rebalancing) is disproportionate to Parpour's scale in the development-to-initial-production range. NATS JetStream provides persistence, replay, and consumer groups with a far simpler deployment (single binary, cluster via gossip). Redis Streams is rejected because it lacks NATS's native request/reply pattern (used for synchronous policy-engine checks from agent-runtime).

### 3.3 Key API Used

```python
import nats
from nats.js import JetStreamContext
from nats.js.api import StreamConfig, RetentionPolicy, StorageType, AckPolicy, DeliverPolicy

# Connection with reconnection
nc = await nats.connect(
    servers=settings.NATS_SERVERS,
    reconnect_time_wait=2,
    max_reconnect_attempts=-1,  # Reconnect indefinitely
    error_cb=nats_error_callback,
    disconnected_cb=nats_disconnect_callback,
)

# JetStream context
js: JetStreamContext = nc.jetstream()

# Create durable stream
await js.add_stream(StreamConfig(
    name="EVENTS",
    subjects=["policy.>", "workflow.>", "task.>", "artifact.>", "money.>"],
    retention=RetentionPolicy.LIMITS,
    storage=StorageType.FILE,
    max_bytes=10 * 1024 * 1024 * 1024,  # 10 GB
    num_replicas=3,
))

# Publish event
async def publish_event(event: EventEnvelopeV1) -> None:
    payload = event.model_dump_json().encode()
    ack = await js.publish(
        subject=event.event_type.replace(".", ".").replace("_v", ".v"),
        payload=payload,
        headers={"Nats-Msg-Id": str(event.event_id)},  # Deduplication key
    )

# Subscribe with durable consumer
sub = await js.subscribe(
    subject="task.>",
    durable="compliance-engine-task-consumer",
    config=nats.js.api.ConsumerConfig(
        ack_policy=AckPolicy.EXPLICIT,
        deliver_policy=DeliverPolicy.NEW,
        max_ack_pending=100,
    ),
)

async for msg in sub.messages:
    try:
        event = EventEnvelopeV1.model_validate_json(msg.data)
        await process_event(event)
        await msg.ack()
    except Exception as e:
        await msg.nak(delay=5)  # Retry after 5 seconds
        raise  # Let structlog capture it
```

### 3.4 Request/Reply Pattern for Policy Checks

NATS native request/reply is used for synchronous policy-engine validation from agent-runtime:

```python
# In agent-runtime: check tool allowlist synchronously
async def check_tool_allowed(agent_role: str, tool_name: str) -> bool:
    request = PolicyCheckRequest(agent_role=agent_role, tool_name=tool_name)
    response = await nc.request(
        subject="policy.check.tool_allowlist",
        payload=request.model_dump_json().encode(),
        timeout=0.05,  # 50ms — must be within latency budget
    )
    result = PolicyCheckResponse.model_validate_json(response.data)
    return result.allowed
```

---

## 4. Database: SQLAlchemy + asyncpg + Alembic

### 4.1 Stack Overview

| Library | Version | Role |
|---|---|---|
| `sqlalchemy` | `2.0.36` | Async ORM + Core for complex queries; session management |
| `asyncpg` | `0.30.0` | High-performance PostgreSQL async driver (used by SQLAlchemy) |
| `alembic` | `1.14.0` | Schema migrations, version control |
| `psycopg3` | — | NOT used (asyncpg is the driver) |

### 4.2 SQLAlchemy 2.x Async

SQLAlchemy 2.x introduces a fully async API using `AsyncSession` and `AsyncEngine`. The ORM is used for:
- Complex queries involving joins across multiple projections (workflow + tasks + events)
- Query construction via the ORM for type safety
- Connection pool management

Raw `asyncpg` is used directly for:
- Append-only event inserts (performance-critical, no ORM overhead needed)
- Bulk batch inserts for event materialization
- Checksum chain validation queries (custom SQL with array aggregation)

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import UUID, String, JSONB, TIMESTAMP, BigInteger, select
import uuid
from datetime import datetime, timezone

# Engine with asyncpg driver
engine = create_async_engine(
    settings.DATABASE_URL,  # postgresql+asyncpg://...
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG_SQL,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Declarative base
class Base(DeclarativeBase):
    pass

# ORM model for read projections (not for events — those are raw asyncpg)
class WorkflowProjection(Base):
    __tablename__ = "workflows"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    objective: Mapped[str] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(50))
    policy_bundle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))

# Async query
async def get_active_workflows(session: AsyncSession) -> list[WorkflowProjection]:
    result = await session.execute(
        select(WorkflowProjection)
        .where(WorkflowProjection.status.in_(["RUNNING", "PENDING"]))
        .order_by(WorkflowProjection.created_at.desc())
        .limit(100)
    )
    return list(result.scalars().all())
```

### 4.3 asyncpg for High-Performance Paths

```python
import asyncpg

# Direct asyncpg pool for event inserts (bypasses SQLAlchemy ORM overhead)
async_pool: asyncpg.Pool = await asyncpg.create_pool(
    settings.DATABASE_URL_ASYNCPG,  # postgresql://... (no +asyncpg prefix)
    min_size=5,
    max_size=20,
    command_timeout=30,
)

# Append-only event insert — called on every event, must be fast
async def insert_event_raw(pool: asyncpg.Pool, event: EventEnvelopeV1) -> None:
    await pool.execute(
        """
        INSERT INTO events (event_id, event_type, trace_id, workflow_id, task_id,
                            policy_bundle_id, payload, created_at, prev_event_hash,
                            this_event_hash, source_service)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
        ON CONFLICT (event_id) DO NOTHING
        """,
        event.event_id, event.event_type, event.trace_id, event.workflow_id,
        event.task_id, event.policy_bundle_id, event.model_dump_json(),
        event.created_at, event.prev_event_hash, event.this_event_hash,
        event.source_service.value if event.source_service else None,
    )
```

### 4.4 Alembic Migrations

```python
# alembic/env.py
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base

def run_migrations_offline() -> None:
    # Offline mode for generating SQL scripts
    context.configure(url=settings.DATABASE_URL, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.DATABASE_URL)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
```

Migration naming convention: `{YYYY_MM_DD}_{sequential}_{description}.py`

All migrations must be:
1. Reversible (implement `downgrade()`)
2. Non-destructive (add columns with defaults; rename in separate step)
3. Tested against a staging database before production

---

## 5. HTTP Client: httpx

### 5.1 Selection

**Selected:** `httpx==0.28.1`

All outbound HTTP calls in Parpour use `httpx.AsyncClient`. The `requests` library is **banned** — it blocks the async event loop. `aiohttp` is an acceptable alternative but its API is less ergonomic and its connection pooling behavior is less predictable.

### 5.2 Key API Used

```python
import httpx
from tenacity import retry, wait_random_exponential, stop_after_attempt

# Shared client with connection pooling (singleton per service)
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    headers={"User-Agent": "venture-platform/1.0"},
    follow_redirects=True,
)

# All outbound calls use tenacity for retry — never custom retry loops
@retry(
    wait=wait_random_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    reraise=True,  # Re-raise the last exception after all attempts exhausted
)
async def fetch_external_resource(url: str) -> dict:
    response = await http_client.get(url)
    response.raise_for_status()  # Raises httpx.HTTPStatusError for 4xx/5xx
    return response.json()

# Lifecycle: close on shutdown
async def shutdown_http():
    await http_client.aclose()
```

### 5.3 External API Calls: Domain Allowlist

All `web.fetch` tool calls from agent-runtime go through an allowlist check before the HTTP call is made. The allowlist is stored in Redis (policy cache) and checked by `policy-engine`. `httpx` itself does not enforce the allowlist — enforcement is at the policy layer.

---

## 6. Validation: Pydantic v2

### 6.1 Selection

**Selected:** `pydantic==2.10.6` (Pydantic v2 with Rust-backed core)

Pydantic v2 is the **only** validation library used. No `marshmallow`, no `cerberus`, no `voluptuous`, no hand-written validation. All external inputs — HTTP request bodies, NATS message payloads, environment variables, configuration files — pass through Pydantic models.

### 6.2 Why Pydantic v2 Over v1

| Property | Pydantic v2 | Pydantic v1 |
|---|---|---|
| **Validation speed** | ~5-10x faster (Rust core: pydantic-core) | Baseline |
| **Strict mode** | YES — `model_config = ConfigDict(strict=True)` | PARTIAL |
| **Computed fields** | YES — `@computed_field` decorator | NO |
| **Model serialization** | `model_dump()`, `model_dump_json()` | `dict()`, `.json()` |
| **Discriminated unions** | EXCELLENT — `Annotated[Union[...], Field(discriminator="type")]` | GOOD |
| **TypeAdapter** | YES — validate arbitrary types without a model | NO |
| **FastAPI integration** | NATIVE | NATIVE |
| **JSON Schema generation** | AUTOMATIC + customizable | AUTOMATIC |

### 6.3 Key Patterns

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, computed_field
from pydantic import UUID4, AwareDatetime, PositiveInt
from typing import Annotated, Any
import hashlib, json

# Strict model — no coercion
class EventEnvelopeV1(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)

    event_id: UUID4
    event_type: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v\d+$")]
    trace_id: UUID4
    workflow_id: UUID4
    task_id: UUID4 | None = None
    policy_bundle_id: UUID4
    payload: dict[str, Any]
    created_at: AwareDatetime
    prev_event_hash: Annotated[str | None, Field(pattern=r"^[a-fA-F0-9]{64}$")] = None
    this_event_hash: Annotated[str | None, Field(pattern=r"^[a-fA-F0-9]{64}$")] = None

    @computed_field
    @property
    def computed_hash(self) -> str:
        content = self.model_dump_json(exclude={"this_event_hash", "computed_hash"})
        return hashlib.sha256(content.encode()).hexdigest()

    @model_validator(mode="after")
    def validate_hash_chain(self) -> "EventEnvelopeV1":
        if self.this_event_hash and self.this_event_hash != self.computed_hash:
            raise ValueError(f"event hash mismatch: expected {self.computed_hash}")
        return self

# TypeAdapter for validating raw data without a model class
from pydantic import TypeAdapter
list_of_events_adapter = TypeAdapter(list[EventEnvelopeV1])
events = list_of_events_adapter.validate_json(raw_json_bytes)
```

### 6.4 Strict Mode Policy

All models used for external inputs (HTTP request bodies, NATS payloads) must use `strict=True`. Models used for internal type safety (internal function parameters) may use `strict=False` for developer convenience. The distinction is enforced via a base class:

```python
class ExternalModel(BaseModel):
    """Base for all models receiving external input. Strict by default."""
    model_config = ConfigDict(strict=True, frozen=True)

class InternalModel(BaseModel):
    """Base for internal models. Lenient coercion acceptable."""
    model_config = ConfigDict(strict=False, frozen=False)
```

---

## 7. Resilience: tenacity

### 7.1 Selection

**Selected:** `tenacity==9.0.0`

`tenacity` is the **only** retry mechanism permitted. Custom retry loops, `while True` retry patterns, and `for i in range(n): try/except` patterns are **banned**.

### 7.2 Standard Retry Configurations

```python
from tenacity import (
    retry,
    wait_random_exponential,
    wait_fixed,
    stop_after_attempt,
    stop_after_delay,
    retry_if_exception_type,
    retry_if_not_exception_type,
    before_sleep_log,
)
import structlog
import asyncio

log = structlog.get_logger()

# Standard transient error retry — used for all external I/O (NATS, HTTP, Redis)
TRANSIENT_RETRY = dict(
    wait=wait_random_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((TimeoutError, ConnectionError, OSError)),
    before_sleep=before_sleep_log(log, "warning"),
    reraise=True,
)

# Database retry — slightly longer backoff for DB connection issues
DB_RETRY = dict(
    wait=wait_random_exponential(multiplier=2, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception),
    before_sleep=before_sleep_log(log, "warning"),
    reraise=True,
)

# NATS publish retry — fast retry, short window
NATS_PUBLISH_RETRY = dict(
    wait=wait_fixed(0.5),
    stop=stop_after_delay(5),
    reraise=True,
)

# Usage
@retry(**TRANSIENT_RETRY)
async def publish_to_nats(subject: str, payload: bytes) -> None:
    await js.publish(subject, payload)

@retry(**DB_RETRY)
async def insert_event(pool: asyncpg.Pool, event: EventEnvelopeV1) -> None:
    await insert_event_raw(pool, event)
```

### 7.3 Rate Limiting Pattern

Rate limiting for external API calls uses `tenacity` combined with `asyncio.Semaphore`:

```python
# Semaphore limits concurrent in-flight requests
CLAUDE_API_SEMAPHORE = asyncio.Semaphore(10)

@retry(**TRANSIENT_RETRY)
async def call_claude_api(prompt: str) -> str:
    async with CLAUDE_API_SEMAPHORE:
        response = await anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
    return response.content[0].text
```

---

## 8. Logging: structlog

### 8.1 Selection

**Selected:** `structlog==24.4.0`

`structlog` is the **only** logging library. `print()`, `logging.getLogger()`, and `loguru` are banned for application logging. `print()` is acceptable in CLI scripts only.

### 8.2 Why structlog Over Standard logging

| Property | structlog 24.x | Python logging | loguru |
|---|---|---|---|
| **Structured JSON output** | NATIVE — `JSONRenderer` | MANUAL — `json.Formatter` | MANUAL |
| **contextvars integration** | YES — `AsyncBoundLogger` | NO | PARTIAL |
| **Async-safe** | YES — no thread-local state | PARTIAL | PARTIAL |
| **Processor pipeline** | YES — composable processors | NO | NO |
| **Stdlib bridge** | YES — `stdlib as structlog` | Baseline | YES |
| **Performance** | Fast (lazy rendering) | Fast | Fast |

### 8.3 Configuration

```python
import structlog
import logging
import sys

def configure_logging(log_level: str = "INFO", json_output: bool = True) -> None:
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    if json_output:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )

# Usage with contextvars for request tracing
import structlog.contextvars

log = structlog.get_logger(__name__)

async def handle_workflow_request(request_id: str, workflow_id: str) -> None:
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        workflow_id=workflow_id,
    )
    log.info("workflow_request_received", objective=payload.objective)
    # All subsequent log calls in this async context include request_id + workflow_id
```

### 8.4 Log Levels Policy

| Level | When to Use |
|---|---|
| `debug` | Internal state details, only useful during development |
| `info` | Normal operation events (workflow started, task completed, event published) |
| `warning` | Degraded state that does not require immediate action (retry triggered, cache miss rate elevated) |
| `error` | Error that affects a single request but does not prevent other requests |
| `critical` | System-level failure requiring immediate attention (freeze activated, ledger integrity failure) |

---

## 9. Cache: redis-py async

### 9.1 Selection

**Selected:** `redis==5.2.1` (with `redis.asyncio` subpackage)

Redis 5.x introduced a native async client in `redis.asyncio`. This replaces the need for `aioredis` (now deprecated/merged into redis-py).

### 9.2 Connection Configuration

```python
from redis.asyncio import Redis, ConnectionPool, RedisCluster

# Single-node (development + staging)
redis_pool = ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True,
)
redis_client: Redis = Redis(connection_pool=redis_pool)

# Cluster (production)
redis_cluster = RedisCluster.from_url(
    settings.REDIS_CLUSTER_URL,
    decode_responses=True,
    skip_full_coverage_check=True,  # Allow partial cluster coverage in dev
)
```

### 9.3 Usage Patterns

```python
from redis.asyncio import Redis
from app.config import settings

# Policy cache — tool allowlists cached per agent_role
async def get_tool_allowlist(redis: Redis, agent_role: str) -> list[str] | None:
    key = f"policy:allowlist:{agent_role}"
    raw = await redis.get(key)
    if raw is None:
        return None
    return json.loads(raw)

async def set_tool_allowlist(
    redis: Redis,
    agent_role: str,
    allowlist: list[str],
    ttl_seconds: int = 300,
) -> None:
    key = f"policy:allowlist:{agent_role}"
    await redis.set(key, json.dumps(allowlist), ex=ttl_seconds)

# Velocity control — spend tracking per workflow
async def check_and_increment_velocity(
    redis: Redis,
    workflow_id: str,
    merchant: str,
    amount_cents: int,
    limit_cents: int,
    window_seconds: int = 3600,
) -> bool:
    key = f"velocity:{workflow_id}:{merchant}"
    pipe = redis.pipeline()
    pipe.get(key)
    pipe.incrby(key, amount_cents)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()
    current_before = int(results[0] or 0)
    return current_before + amount_cents <= limit_cents

# Idempotency keys — prevent duplicate workflow creation
async def set_idempotency_key(
    redis: Redis,
    idempotency_key: str,
    workflow_id: str,
    ttl_seconds: int = 86400,
) -> bool:
    key = f"idempotency:{idempotency_key}"
    result = await redis.set(key, workflow_id, ex=ttl_seconds, nx=True)
    return result is True  # True = newly set; False = already exists
```

---

## 10. Configuration: pydantic-settings

### 10.1 Selection

**Selected:** `pydantic-settings==2.7.1`

`pydantic-settings` extends Pydantic v2 with environment variable parsing, `.env` file loading, and layered configuration. All service configuration is defined as `BaseSettings` subclasses.

### 10.2 Configuration Design

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AnyHttpUrl, RedisDsn, PostgresDsn
from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="VENTURE_",
        case_sensitive=False,
        extra="forbid",  # Fail on unknown env vars — prevents silent misconfiguration
    )

    # Service identity
    SERVICE_NAME: str = Field(..., description="Name of this service instance")
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Database
    DATABASE_URL: PostgresDsn = Field(..., description="PostgreSQL connection URL (SQLAlchemy async)")
    DATABASE_URL_ASYNCPG: str = Field(..., description="PostgreSQL connection URL (asyncpg, no dialect prefix)")
    DB_POOL_SIZE: int = Field(20, ge=1, le=100)
    DB_MAX_OVERFLOW: int = Field(10, ge=0, le=50)

    # Redis
    REDIS_URL: RedisDsn = Field(..., description="Redis connection URL")

    # NATS
    NATS_SERVERS: list[str] = Field(..., description="NATS server URLs")

    # Security
    JWT_SECRET_KEY: str = Field(..., min_length=32, description="JWT signing secret")
    JWT_ALGORITHM: str = Field("HS256")
    JWT_EXPIRY_SECONDS: int = Field(3600)

    # External APIs
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key")
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key")

    # MinIO / S3
    S3_ENDPOINT_URL: AnyHttpUrl = Field(..., description="S3-compatible endpoint (MinIO in dev)")
    S3_ACCESS_KEY_ID: str = Field(...)
    S3_SECRET_ACCESS_KEY: str = Field(...)
    S3_BUCKET_ARTIFACTS: str = Field("venture-artifacts")

settings = Settings()
```

---

## 11. Artifact Generation Libraries

The `artifact-compiler` service generates presentation slides, documents, spreadsheets, PDFs, videos, and images from IR (Intermediate Representation) specifications.

### 11.1 Presentation: python-pptx

| Property | Value |
|---|---|
| **Library** | `python-pptx==1.0.2` |
| **License** | MIT |
| **Purpose** | Generate PowerPoint (.pptx) from SlideSpec IR |

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def render_slide_deck(spec: SlideSpec) -> bytes:
    prs = Presentation()
    prs.slide_width = Emu(spec.width_emu)
    prs.slide_height = Emu(spec.height_emu)
    for slide_spec in spec.slides:
        layout = prs.slide_layouts[spec.layout_index]
        slide = prs.slides.add_slide(layout)
        for element in slide_spec.elements:
            _render_element(slide, element)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()
```

### 11.2 Documents: python-docx

| Property | Value |
|---|---|
| **Library** | `python-docx==1.1.2` |
| **License** | MIT |
| **Purpose** | Generate Word (.docx) from DocSpec IR |

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

def render_document(spec: DocSpec) -> bytes:
    doc = Document()
    for section in spec.sections:
        if section.type == "heading":
            doc.add_heading(section.text, level=section.level)
        elif section.type == "paragraph":
            p = doc.add_paragraph()
            run = p.add_run(section.text)
            run.font.size = Pt(section.font_size)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

### 11.3 Spreadsheets: openpyxl

| Property | Value |
|---|---|
| **Library** | `openpyxl==3.1.5` |
| **License** | MIT |
| **Purpose** | Generate Excel (.xlsx) from SpreadsheetSpec IR |

### 11.4 PDF Generation: weasyprint

| Property | Value |
|---|---|
| **Library** | `weasyprint==63.0` |
| **License** | BSD |
| **Purpose** | HTML-to-PDF rendering for report artifacts |

`weasyprint` converts HTML+CSS to PDF via a Pango/Cairo rendering pipeline. It is selected over `reportlab` for HTML-templated content because HTML/CSS is easier for agents to generate than the reportlab API. `reportlab` is retained for programmatic PDF construction (charts, data tables).

```python
from weasyprint import HTML, CSS

def render_pdf_from_html(html_content: str, css_content: str | None = None) -> bytes:
    stylesheets = [CSS(string=css_content)] if css_content else []
    return HTML(string=html_content).write_pdf(stylesheets=stylesheets)
```

### 11.5 PDF: reportlab

| Property | Value |
|---|---|
| **Library** | `reportlab==4.2.5` |
| **License** | BSD |
| **Purpose** | Programmatic PDF construction (charts, data grids, financial reports) |

### 11.6 Video: ffmpeg-python

| Property | Value |
|---|---|
| **Library** | `ffmpeg-python==0.2.0` |
| **License** | Apache-2.0 |
| **Purpose** | Video assembly from frames, audio overlay, format conversion |

Requires `ffmpeg` binary installed in the runtime environment. The Python library is a thin wrapper around the ffmpeg CLI.

```python
import ffmpeg

def assemble_video(frames_dir: str, audio_path: str | None, output_path: str) -> None:
    input_stream = ffmpeg.input(f"{frames_dir}/*.png", pattern_type="glob", framerate=24)
    if audio_path:
        audio = ffmpeg.input(audio_path)
        out = ffmpeg.output(input_stream, audio, output_path, vcodec="libx264", acodec="aac")
    else:
        out = ffmpeg.output(input_stream, output_path, vcodec="libx264")
    ffmpeg.run(out, overwrite_output=True, quiet=True)
```

### 11.7 Image Processing: Pillow

| Property | Value |
|---|---|
| **Library** | `Pillow==11.1.0` |
| **License** | MIT/HPND |
| **Purpose** | Image resizing, compositing, format conversion, thumbnail generation |

### 11.8 Background Removal: rembg

| Property | Value |
|---|---|
| **Library** | `rembg==2.0.60` |
| **License** | MIT |
| **Purpose** | AI-based background removal from images (for presentation visuals) |

`rembg` uses ONNX Runtime with a pre-trained U2Net model. No external API call required.

```python
from rembg import remove
from PIL import Image
import io

def remove_background(image_bytes: bytes) -> bytes:
    input_image = Image.open(io.BytesIO(image_bytes))
    output_image = remove(input_image)
    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    return buf.getvalue()
```

---

## 12. AI and LLM SDKs

### 12.1 Anthropic SDK

| Property | Value |
|---|---|
| **Library** | `anthropic==0.45.0` |
| **License** | MIT |
| **Purpose** | Claude API for artifact generation, L2 agent reasoning, analysis tasks |

```python
import anthropic
from app.config import settings

# Async client (singleton)
anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

@retry(**TRANSIENT_RETRY)
async def call_claude(prompt: str, system: str = "", model: str = "claude-opus-4-6") -> str:
    async with CLAUDE_API_SEMAPHORE:
        response = await anthropic_client.messages.create(
            model=model,
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    return response.content[0].text
```

### 12.2 OpenAI SDK

| Property | Value |
|---|---|
| **Library** | `openai==1.61.0` |
| **License** | MIT |
| **Purpose** | GPT-5-mini for L3 agent dispatch, cost-optimized tasks |

```python
from openai import AsyncOpenAI

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

@retry(**TRANSIENT_RETRY)
async def call_gpt(prompt: str, model: str = "gpt-5-mini") -> str:
    response = await openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
    )
    return response.choices[0].message.content
```

### 12.3 NATS for Agent Messaging

NATS is also used as the messaging substrate for dispatching tasks to L3 copilot CLI workers. The orchestrator publishes task envelopes to `task.l3.dispatch.*` subjects; result listeners subscribe to `task.l3.result.*`.

---

## 13. Testing Libraries

### 13.1 pytest-asyncio

| Property | Value |
|---|---|
| **Library** | `pytest-asyncio==0.25.2` |
| **License** | Apache-2.0 |
| **Purpose** | Run async test functions with `@pytest.mark.asyncio` |

Configuration in `pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"  # All async test functions run as async tests automatically
```

### 13.2 httpx Test Client

```python
from httpx import AsyncClient
from fastapi.testclient import TestClient

# Async test client for FastAPI
async def test_create_workflow(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/workflows",
        json={"objective": "Write blog post about AI", "budget_cents": 1000},
        headers={"Authorization": f"Bearer {test_jwt_token}"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "PENDING"
```

### 13.3 pytest-cov

| Property | Value |
|---|---|
| **Library** | `pytest-cov==6.0.0` |
| **License** | MIT |
| **Purpose** | Code coverage with branch coverage; enforced minimum in CI |

```bash
pytest --cov=app --cov-report=html --cov-report=term-missing --cov-fail-under=80
```

### 13.4 factory-boy

| Property | Value |
|---|---|
| **Library** | `factory-boy==3.3.1` |
| **License** | MIT |
| **Purpose** | Test data factories for complex Pydantic models and database rows |

```python
import factory
from factory import LazyFunction
import uuid
from datetime import datetime, timezone

class EventEnvelopeFactory(factory.Factory):
    class Meta:
        model = EventEnvelopeV1

    event_id = LazyFunction(uuid.uuid4)
    event_type = "workflow.started.v1"
    trace_id = LazyFunction(uuid.uuid4)
    workflow_id = LazyFunction(uuid.uuid4)
    policy_bundle_id = LazyFunction(uuid.uuid4)
    payload = factory.Dict({"objective": "Test workflow"})
    created_at = LazyFunction(lambda: datetime.now(timezone.utc))
```

### 13.5 freezegun

| Property | Value |
|---|---|
| **Library** | `freezegun==1.5.1` |
| **License** | Apache-2.0 |
| **Purpose** | Freeze time in tests for TTL, expiry, and timestamp-dependent logic |

```python
from freezegun import freeze_time

@freeze_time("2026-02-21 10:00:00+00:00")
async def test_money_intent_expiry():
    intent = create_money_intent(ttl_seconds=3600)
    assert not intent.is_expired()

@freeze_time("2026-02-21 11:01:00+00:00")
async def test_money_intent_expired():
    intent = create_money_intent(ttl_seconds=3600, created_at=frozen_time_minus_1h)
    assert intent.is_expired()
```

---

## 14. Security Libraries

### 14.1 JWT: python-jose

| Property | Value |
|---|---|
| **Library** | `python-jose[cryptography]==3.3.0` |
| **License** | MIT |
| **Purpose** | JWT creation and validation for founder authentication |

```python
from jose import jwt, JWTError
from app.config import settings
from datetime import datetime, timedelta, timezone

def create_jwt(founder_id: str, scope: list[str]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.JWT_EXPIRY_SECONDS)
    claims = {
        "sub": founder_id,
        "scope": " ".join(scope),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def validate_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise AuthenticationError(f"invalid token: {e}") from e
```

### 14.2 Cryptography: cryptography

| Property | Value |
|---|---|
| **Library** | `cryptography==44.0.0` |
| **License** | Apache-2.0 / BSD |
| **Purpose** | RSA key operations, event signature verification, mTLS certificate handling |

Used for signing event hashes in the tamper-evident event log and verifying workload identity tokens from agent-runtime.

### 14.3 Password Hashing: passlib

| Property | Value |
|---|---|
| **Library** | `passlib[bcrypt]==1.7.4` |
| **License** | BSD |
| **Purpose** | Bcrypt password hashing for founder account credentials |

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

---

## 15. Development Tooling

### 15.1 Linting and Formatting: ruff

| Property | Value |
|---|---|
| **Tool** | `ruff==0.9.6` |
| **License** | MIT |
| **Purpose** | Lint + format (replaces flake8, isort, black, pydocstyle) |

```toml
# pyproject.toml
[tool.ruff]
target-version = "py314"
line-length = 100

[tool.ruff.lint]
select = [
    "E", "W",   # pycodestyle
    "F",        # pyflakes
    "I",        # isort
    "N",        # pep8-naming
    "UP",       # pyupgrade
    "B",        # flake8-bugbear
    "C4",       # flake8-comprehensions
    "SIM",      # flake8-simplify
    "TCH",      # flake8-type-checking
    "ANN",      # flake8-annotations (type hint enforcement)
    "S",        # flake8-bandit (security)
    "RUF",      # ruff-specific rules
]
ignore = ["ANN101", "ANN102"]  # Self/cls annotations — not required
fixable = ["I", "UP", "C4", "RUF"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

CI enforces `ruff check --no-fix` (lint) and `ruff format --check` (format) with zero violations.

### 15.2 Type Checking: mypy

| Property | Value |
|---|---|
| **Tool** | `mypy==1.14.1` |
| **License** | MIT |
| **Purpose** | Static type checking in strict mode |

```toml
[tool.mypy]
python_version = "3.14"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_any_generics = true
disallow_untyped_defs = true
no_implicit_optional = true
plugins = ["pydantic.mypy", "sqlalchemy.ext.mypy.plugin"]

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false  # Test functions may have untyped params
```

### 15.3 Package Management: uv

| Property | Value |
|---|---|
| **Tool** | `uv==0.5.18` |
| **License** | MIT/Apache-2.0 |
| **Purpose** | Dependency resolution, virtual environment, script running |

```bash
# Install all dependencies (exact lock)
uv sync --frozen

# Add a new dependency
uv add <package>
uv lock  # Update lock file

# Run a script
uv run python -m app.services.control_plane_api

# Run tests
uv run pytest

# Export requirements for Docker (without uv)
uv export --no-dev > requirements.txt
```

---

## 16. Pinned pyproject.toml Dependencies

The following is the authoritative `[project.dependencies]` block. Versions reflect the tested stack as of 2026-02-21.

```toml
[project]
name = "venture-platform"
version = "1.0.0"
requires-python = ">=3.14"
description = "Venture autonomous AI economic civilization platform"

[project.dependencies]
# Web framework
fastapi = "==0.115.8"
uvicorn = {version = "==0.34.0", extras = ["standard"]}
websockets = "==14.1"

# Event streaming
nats-py = "==2.10.0"

# Database
sqlalchemy = {version = "==2.0.36", extras = ["asyncio"]}
asyncpg = "==0.30.0"
alembic = "==1.14.0"

# HTTP client
httpx = "==0.28.1"

# Validation
pydantic = "==2.10.6"
pydantic-settings = "==2.7.1"

# Resilience
tenacity = "==9.0.0"

# Logging
structlog = "==24.4.0"

# Cache
redis = {version = "==5.2.1", extras = ["hiredis"]}

# Artifact generation — presentations
python-pptx = "==1.0.2"

# Artifact generation — documents
python-docx = "==1.1.2"

# Artifact generation — spreadsheets
openpyxl = "==3.1.5"

# Artifact generation — PDF (HTML path)
weasyprint = "==63.0"

# Artifact generation — PDF (programmatic path)
reportlab = "==4.2.5"

# Artifact generation — video
ffmpeg-python = "==0.2.0"

# Artifact generation — images
Pillow = "==11.1.0"
rembg = "==2.0.60"

# AI/LLM
anthropic = "==0.45.0"
openai = "==1.61.0"

# Security
python-jose = {version = "==3.3.0", extras = ["cryptography"]}
cryptography = "==44.0.0"
passlib = {version = "==1.7.4", extras = ["bcrypt"]}

# Utilities
python-multipart = "==0.0.20"
orjson = "==3.10.15"
aioboto3 = "==13.3.0"
pyhumps = "==3.8.0"

[project.optional-dependencies]
dev = [
    # Testing
    "pytest==8.3.4",
    "pytest-asyncio==0.25.2",
    "pytest-cov==6.0.0",
    "factory-boy==3.3.1",
    "freezegun==1.5.1",
    "respx==0.21.1",

    # Type checking and linting
    "mypy==1.14.1",
    "ruff==0.9.6",

    # Type stubs
    "types-redis==4.6.0.20241004",
    "types-passlib==1.7.7.20240819",
    "sqlalchemy[mypy]==2.0.36",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = [
    "pytest>=8.3.4",
    "pytest-asyncio>=0.25.2",
    "pytest-cov>=6.0.0",
    "factory-boy>=3.3.1",
    "freezegun>=1.5.1",
    "respx>=0.21.1",
    "mypy>=1.14.1",
    "ruff>=0.9.6",
    "types-redis",
    "types-passlib",
]
```

### 16.1 Per-Service Dependency Matrix

| Library | control-plane-api | policy-engine | artifact-compiler | treasury-api | compliance-engine | venture-orchestrator | agent-runtime |
|---|---|---|---|---|---|---|---|
| `fastapi` | YES | YES | YES | YES | YES | YES | NO |
| `nats-py` | YES | YES | YES | YES | YES | YES | YES |
| `sqlalchemy` | YES | YES | PARTIAL | YES | YES | YES | NO |
| `asyncpg` | YES | YES | YES | YES | YES | YES | NO |
| `httpx` | YES | YES | YES | NO | YES | NO | YES |
| `pydantic` | YES | YES | YES | YES | YES | YES | YES |
| `tenacity` | YES | YES | YES | YES | YES | YES | YES |
| `structlog` | YES | YES | YES | YES | YES | YES | YES |
| `redis` | YES | YES | YES | YES | YES | YES | YES |
| `python-pptx` | NO | NO | YES | NO | NO | NO | NO |
| `weasyprint` | NO | NO | YES | NO | NO | NO | NO |
| `ffmpeg-python` | NO | NO | YES | NO | NO | NO | NO |
| `anthropic` | NO | NO | YES | NO | NO | NO | YES |
| `openai` | NO | NO | NO | NO | NO | NO | YES |
| `python-jose` | YES | YES | NO | YES | YES | NO | YES |
| `cryptography` | YES | YES | NO | YES | YES | NO | NO |

---

*Document generated 2026-02-21. Review date: 2026-08-21.*
