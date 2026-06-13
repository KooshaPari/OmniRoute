# ADR-006: NATS for Event Bus

**Status:** Proposed  
**Date:** 2026-02-23

## Context

PARPOUR needs an event bus for asynchronous communication between services, event sourcing, and real-time updates.

## Decision

Use NATS (specifically NATS JetStream) as the event bus.

```python
import nats

await nats.connect("nats://localhost:4222")
js = await nats.jetstream()

# Publish
await js.publish("events.workflow.created", json.dumps(event).encode())

# Subscribe
await js.subscribe("events.workflow.>")
```

## Consequences

### Positive
- Built-in persistence (JetStream)
- Exactly-once delivery
- High performance (100K+ msg/sec)
- Wildcard subscriptions
- No external dependencies (single binary)

### Negative
- Additional infrastructure to run
- Learning curve for team
- Monitoring requirements

### Neutral
- Can use nats-py client
- Supports clustering for HA

## Alternatives Considered

| Alternative | Pros | Cons |
|------------|------|------|
| RabbitMQ | Mature, feature-rich | heavier, more complex |
| Redis Pub/Sub | Simple, fast | no persistence |
| Kafka | High throughput | heavyweight, complex |
| In-memory | Simple | no persistence, single instance |

## Configuration

```yaml
nats:
  url: "nats://localhost:4222"
  stream: "PARPOUR"
  retention: "workqueue"
  max_bytes: 1GB
  max_age: 7d
```
