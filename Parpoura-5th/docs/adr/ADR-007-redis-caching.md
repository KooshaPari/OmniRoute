# ADR-007: Redis for Caching

**Status:** Proposed  
**Date:** 2026-02-23

## Context

PARPOUR needs caching for:
- Rate limiting counters
- Session storage
- API response caching
- Real-time state

## Decision

Use Redis as the caching layer.

```python
import redis.asyncio as redis

redis_client = redis.from_url("redis://localhost:6379")

# Rate limiting
await redis_client.incr(f"ratelimit:{ip}")
await redis_client.expire(f"ratelimit:{ip}", 60)

# Caching
await redis_client.setex(f"workflow:{id}", 300, json.dumps(workflow))
```

## Consequences

### Positive
- Fast in-memory data store
- Persistence options (RDB, AOF)
- Rich data structures (strings, lists, sets, sorted sets)
- TTL support
- Pub/Sub for real-time

### Negative
- Additional infrastructure
- Memory management considerations
- Cluster setup complexity

### Neutral
- Well-understood technology
- Good Python client (redis-py async)

## Caching Strategy

| Data | TTL | Invalidation |
|------|-----|--------------|
| Rate limit | 60s | Automatic |
| Workflow | 5min | On update |
| Policy | 1hr | On publish |
| Session | 24hr | On logout |

## Alternatives Considered

| Alternative | Pros | Cons |
|------------|------|------|
| Memcached | Simple, fast | No persistence, no TTL |
| In-memory dict | No deps | No persistence, single instance |
| PostgreSQL | Single DB | Slower |
| DynamoDB | Managed | Cost, complexity |
