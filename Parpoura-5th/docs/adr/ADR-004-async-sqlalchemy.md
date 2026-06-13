# ADR-004: Async SQLAlchemy for Database Layer

**Status:** Proposed  
**Date:** 2026-02-23

## Context

PARPOUR needs database persistence for workflows, policies, and ledger entries. The current implementation uses in-memory storage which is not suitable for production.

## Decision

We will use SQLAlchemy 2.0 with asyncpg for async database operations.

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine("postgresql+asyncpg://...")
session_factory = async_sessionmaker(engine, class_=AsyncSession)
```

## Consequences

### Positive
- Non-blocking I/O for better concurrency
- Connection pooling built-in
- SQLAlchemy provides migration support via Alembic
- Type-safe with SQLModel or Pydantic integration

### Negative
- Requires async/await patterns throughout
- More complex testing (need test database)
- Connection string format changes (postgresql+asyncpg://)

### Neutral
- Need to add alembic migrations
- Must handle session lifecycle carefully

## Alternatives Considered

| Alternative | Pros | Cons |
|------------|------|------|
| Synchronous SQLAlchemy | Simpler | Blocks event loop |
| Raw asyncpg | More control | More boilerplate |
| Prisma (via edge) | Type-safe | Not Python-native |
| Drizzle | Type-safe | New, less mature |
