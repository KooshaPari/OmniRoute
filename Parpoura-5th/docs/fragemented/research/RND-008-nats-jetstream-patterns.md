# RND-008: NATS JetStream Production Patterns -- Multi-Tenant Stream Isolation

**Status:** RESEARCH COMPLETE
**Date:** 2026-02-21
**Assigned to:** researcher-gamma

---

## Executive Summary

NATS JetStream provides robust multi-tenant stream isolation through its native Account system and per-stream subject filtering. For Parpour's Venture platform, the recommended topology uses **one NATS Account per tenant** with **per-tenant stream prefixes** following the pattern `VENTURE.{tenant_id}.>`. JetStream supports up to 100k+ streams per server, making one-stream-per-tenant feasible at Parpour's projected scale (< 10k tenants). NKey-based credential generation provides cryptographic tenant identity. JetStream KV with per-key TTL (NATS 2.10+) serves as a lightweight configuration store. Pull consumers handle work-queue semantics for artifact jobs; push consumers handle fan-out for event subscribers. A 2-minute dedup window with `Nats-Msg-Id` headers ensures idempotent publish.

---

## Research Findings

### 1. Account-Based Tenant Isolation

NATS 2.0+ provides first-class multi-tenancy through **Accounts**. Each account is a securely isolated communication context:

- Messages published in one account are invisible to other accounts
- JetStream resources (streams, consumers, KV buckets) are scoped to the account
- Resource limits (memory, storage, max streams, max consumers) are configurable per account
- Import/export between accounts is explicit and controlled

**Configuration example -- per-account resource limits:**

```conf
# nats-server.conf
accounts {
  TENANT_acme_corp {
    jetstream {
      max_mem:       512MB
      max_store:     10GB
      max_streams:   50
      max_consumers: 200
    }
    users = [
      { nkey: "UAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" }
    ]
  }

  TENANT_globex {
    jetstream {
      max_mem:       256MB
      max_store:     5GB
      max_streams:   25
      max_consumers: 100
    }
    users = [
      { nkey: "UBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" }
    ]
  }

  # System account for cross-tenant admin operations
  SYS {
    users = [
      { user: "admin", password: "$ADMIN_HASH" }
    ]
  }
}

system_account: SYS
```

**Scalability ceiling:** NATS server can handle 100k+ streams. With one stream per event category per tenant (e.g., 10 streams per tenant), Parpour can support ~10k tenants on a single server. Cluster mode extends this further.

### 2. Subject Namespace Design

The recommended subject hierarchy for Parpour:

```
VENTURE.{tenant_id}.workflow.>       # Workflow lifecycle events
VENTURE.{tenant_id}.task.>           # Task dispatch/completion
VENTURE.{tenant_id}.artifact.>       # Artifact IR/build events
VENTURE.{tenant_id}.money.>          # Treasury/ledger events
VENTURE.{tenant_id}.compliance.>     # Compliance/audit events
VENTURE.{tenant_id}.policy.>         # Policy bundle events
VENTURE.{tenant_id}.privacy.>        # Privacy/DSAR events
VENTURE.{tenant_id}.civ.>            # Relayed CIV simulation events
```

Each tenant's account has a **subject export** that restricts to their namespace:

```conf
accounts {
  TENANT_acme_corp {
    exports = [
      { stream: "VENTURE.acme_corp.>" }
    ]
  }
}
```

This prevents any cross-tenant subject leakage at the server level.

### 3. Stream Topology

**Recommended stream configuration per tenant:**

```json
{
  "streams": [
    {
      "name": "EVENTS_{tenant_id}",
      "subjects": ["VENTURE.{tenant_id}.>"],
      "retention": "limits",
      "max_bytes": 1073741824,
      "max_age": "720h",
      "max_msgs_per_subject": 100000,
      "storage": "file",
      "num_replicas": 1,
      "duplicate_window": "2m",
      "discard": "old",
      "allow_rollup_hdrs": false,
      "deny_delete": true,
      "deny_purge": false
    }
  ]
}
```

**Alternative: Category-scoped streams (for high-volume tenants):**

```json
{
  "streams": [
    {
      "name": "WORKFLOW_{tenant_id}",
      "subjects": ["VENTURE.{tenant_id}.workflow.>"],
      "retention": "limits",
      "max_bytes": 268435456,
      "max_age": "720h",
      "storage": "file",
      "duplicate_window": "2m"
    },
    {
      "name": "ARTIFACT_{tenant_id}",
      "subjects": ["VENTURE.{tenant_id}.artifact.>"],
      "retention": "limits",
      "max_bytes": 536870912,
      "max_age": "720h",
      "storage": "file",
      "duplicate_window": "2m"
    },
    {
      "name": "MONEY_{tenant_id}",
      "subjects": ["VENTURE.{tenant_id}.money.>", "VENTURE.{tenant_id}.compliance.>"],
      "retention": "limits",
      "max_bytes": 268435456,
      "max_age": "2160h",
      "storage": "file",
      "duplicate_window": "2m"
    }
  ]
}
```

The single-stream-per-tenant approach is simpler and recommended for initial deployment. Split into category streams only when a tenant's event volume exceeds ~100k messages/day.

### 4. NKey Credential Generation

NKeys provide Ed25519 keypair-based authentication. Each tenant gets a unique NKey:

**Programmatic generation (Python, using `nkeys` library):**

```python
import nkeys

def generate_tenant_credentials(tenant_id: str) -> dict:
    """Generate NKey credentials for a new tenant."""
    kp = nkeys.KeyPair.create_user()
    seed = kp.seed  # Private key (store securely)
    public_key = kp.public_key  # Public key (embed in server config)
    kp.wipe()

    return {
        "tenant_id": tenant_id,
        "nkey_seed": seed.decode(),      # e.g., "SUAXXXXXXX..."
        "nkey_public": public_key.decode(),  # e.g., "UAXXXXXXX..."
    }
```

**CLI generation:**

```bash
nk -gen user -pubout
# Output:
#   SUAM...  (seed -- private)
#   UA...    (public key)
```

**JWT-based approach (for dynamic tenant provisioning without server restart):**

```bash
# Create operator
nsc add operator parpour

# Create tenant account
nsc add account --name "tenant_acme_corp"

# Set JetStream limits
nsc edit account --name "tenant_acme_corp" \
  --js-mem-storage 512M \
  --js-disk-storage 10G \
  --js-streams 50 \
  --js-consumer 200

# Generate user credentials
nsc add user --account "tenant_acme_corp" --name "service_user"
nsc generate creds --account "tenant_acme_corp" --name "service_user" > acme_corp.creds
```

The JWT/`nsc` approach is strongly recommended for production because it allows dynamic tenant provisioning without restarting the NATS server. The NATS account resolver watches for JWT changes and applies them at runtime.

### 5. JetStream KV with TTL

NATS 2.10+ supports per-key TTL in JetStream KV buckets. This is useful for tenant configuration, session state, and ephemeral data:

```python
import nats

async def setup_tenant_kv(nc, tenant_id: str):
    js = nc.jetstream()

    # Create KV bucket with default TTL
    kv = await js.create_key_value(
        config=nats.js.api.KeyValueConfig(
            bucket=f"config_{tenant_id}",
            history=5,              # Keep 5 revisions per key
            ttl=3600,               # Default TTL: 1 hour (seconds)
            max_bytes=10_485_760,   # 10 MB max
            storage="file",
        )
    )

    # Put with default TTL (1 hour)
    await kv.put("policy_bundle_id", b"v2.3.1")

    # Put with custom per-key TTL (NATS 2.11+)
    # Note: per-key TTL requires message headers
    await kv.put("session_token", b"abc123")

    # Get value
    entry = await kv.get("policy_bundle_id")
    print(entry.value)  # b"v2.3.1"

    # Watch for changes (real-time config updates)
    watcher = await kv.watchall()
    async for update in watcher:
        if update is None:
            break
        print(f"Key {update.key} changed to {update.value}")

    return kv
```

### 6. Consumer Patterns

#### Pull Consumers (Work Queues -- Artifact Jobs)

Pull consumers provide exactly-once processing semantics for work queues. Multiple service replicas share a single consumer group:

```python
async def setup_artifact_worker(nc, tenant_id: str):
    js = nc.jetstream()

    # Create durable pull consumer for artifact build jobs
    consumer_config = nats.js.api.ConsumerConfig(
        durable_name=f"artifact_worker_{tenant_id}",
        filter_subject=f"VENTURE.{tenant_id}.artifact.build_started.>",
        ack_policy="explicit",
        ack_wait=300,                # 5 min ack timeout (builds can be slow)
        max_deliver=3,               # Max 3 delivery attempts
        max_ack_pending=10,          # Max 10 in-flight per consumer
        deliver_policy="all",
        replay_policy="instant",
    )

    # Pull subscription (work queue semantics)
    sub = await js.pull_subscribe(
        subject=f"VENTURE.{tenant_id}.artifact.build_started.>",
        durable=f"artifact_worker_{tenant_id}",
        config=consumer_config,
        stream=f"EVENTS_{tenant_id}",
    )

    while True:
        try:
            msgs = await sub.fetch(batch=5, timeout=30)
            for msg in msgs:
                try:
                    await process_artifact_build(msg)
                    await msg.ack()
                except Exception:
                    await msg.nak(delay=10)  # Retry after 10s
        except nats.errors.TimeoutError:
            continue  # No messages available
```

#### Push Consumers (Event Subscribers -- Compliance Engine)

Push consumers provide fan-out for event subscribers. Each subscriber gets every message:

```python
async def setup_compliance_subscriber(nc, tenant_id: str):
    js = nc.jetstream()

    # Push consumer for compliance engine (receives all events)
    sub = await js.subscribe(
        subject=f"VENTURE.{tenant_id}.>",
        durable=f"compliance_{tenant_id}",
        stream=f"EVENTS_{tenant_id}",
        config=nats.js.api.ConsumerConfig(
            deliver_policy="all",
            ack_policy="explicit",
            ack_wait=30,
            max_deliver=5,
            flow_control=True,       # Backpressure support
            idle_heartbeat=15,       # Detect stale consumers
        ),
    )

    async for msg in sub.messages:
        try:
            await evaluate_compliance(msg)
            await msg.ack()
        except Exception:
            await msg.nak()
```

#### Consumer Groups (Fair Distribution)

For services with multiple replicas (e.g., compliance-engine with 2+ replicas), use the same `durable` name to create a consumer group:

```python
# Replica 1 and Replica 2 both use the same durable name
# NATS distributes messages fairly between them
sub = await js.subscribe(
    subject=f"VENTURE.{tenant_id}.>",
    durable="compliance_group",  # Same name = same consumer group
    queue="compliance_workers",   # Queue group for load balancing
    stream=f"EVENTS_{tenant_id}",
)
```

### 7. Idempotent Publish with Dedup

JetStream's dedup window uses `Nats-Msg-Id` headers to prevent duplicate messages:

```python
async def publish_event(js, tenant_id: str, event: dict):
    """Publish an event with idempotent delivery guarantee."""
    subject = f"VENTURE.{tenant_id}.{event['event_type'].replace('.', '.')}"
    payload = json.dumps(event).encode()

    # Nats-Msg-Id ensures dedup within the configured window (2 minutes)
    msg_id = event["event_id"]

    ack = await js.publish(
        subject=subject,
        payload=payload,
        headers={
            "Nats-Msg-Id": msg_id,
        },
        timeout=10,
    )

    if ack.duplicate:
        # Message was already published (dedup caught it)
        return {"status": "duplicate", "seq": ack.seq}

    return {"status": "published", "seq": ack.seq, "stream": ack.stream}
```

**Server-side dedup configuration** (in stream config):

```json
{
  "duplicate_window": "2m"
}
```

The 2-minute window is sufficient for Parpour because:
- Event publishing is synchronous within a task/tick lifecycle
- If a publisher crashes and retries, it will retry within seconds
- The dedup window only needs to cover the retry interval

### 8. Cross-Tenant Admin Operations

For platform-wide operations (monitoring, billing, analytics), use the system account with cross-account imports:

```conf
accounts {
  SYS {
    imports = [
      # Import all tenant events for platform analytics
      { stream: { account: "TENANT_*", subject: "VENTURE.*.>" }, to: "PLATFORM.>" }
    ]
  }
}
```

This allows the Parpour control plane to observe all tenant activity without violating tenant isolation boundaries.

### 9. Operational Patterns

#### Stream Monitoring

```python
async def monitor_tenant_stream(js, tenant_id: str) -> dict:
    """Get stream health metrics for a tenant."""
    stream_name = f"EVENTS_{tenant_id}"
    info = await js.stream_info(stream_name)

    return {
        "tenant_id": tenant_id,
        "messages": info.state.messages,
        "bytes": info.state.bytes,
        "consumers": info.state.consumer_count,
        "first_seq": info.state.first_seq,
        "last_seq": info.state.last_seq,
        "num_subjects": info.state.num_subjects,
    }
```

#### Dead Letter Queue

```python
# Consumer with max_deliver=3 automatically moves failed messages
# to a $JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES advisory subject
# Configure a DLQ stream to capture these:

dlq_config = {
    "name": f"DLQ_{tenant_id}",
    "subjects": [f"$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.EVENTS_{tenant_id}.>"],
    "retention": "limits",
    "max_age": "720h",
    "storage": "file",
}
```

#### Graceful Tenant Offboarding

```python
async def offboard_tenant(js, tenant_id: str):
    """Gracefully remove a tenant's NATS resources."""
    stream_name = f"EVENTS_{tenant_id}"

    # 1. List and delete all consumers
    consumers = await js.consumers_info(stream_name)
    for consumer in consumers:
        await js.delete_consumer(stream_name, consumer.name)

    # 2. Purge stream (optional: archive first)
    await js.purge_stream(stream_name)

    # 3. Delete stream
    await js.delete_stream(stream_name)

    # 4. Delete KV buckets
    kv_bucket = f"config_{tenant_id}"
    await js.delete_key_value(kv_bucket)
```

---

## Decision

**Use NATS Account-per-tenant isolation with JWT-based dynamic provisioning.** This provides:

1. **Cryptographic isolation**: Tenant messages are invisible to other tenants at the server level
2. **Resource governance**: Per-account limits on memory, storage, streams, and consumers
3. **Dynamic provisioning**: JWT/nsc allows adding tenants without server restarts
4. **Subject-based routing**: `VENTURE.{tenant_id}.>` pattern enables fine-grained subscriptions
5. **Built-in dedup**: 2-minute dedup window with `Nats-Msg-Id` for idempotent publish
6. **Work queue semantics**: Pull consumers for artifact jobs; push consumers for event subscribers

**Rejected alternatives:**

| Alternative | Reason for rejection |
|-------------|---------------------|
| Single account, subject-prefix-only isolation | No server-enforced isolation; relies on client-side discipline |
| Separate NATS servers per tenant | Operational overhead; not needed at < 10k tenant scale |
| Kafka | Higher operational complexity; NATS is already in Parpour's stack |
| Redis Streams | No built-in multi-tenancy; weaker delivery guarantees |

---

## Implementation Contract

### Stream Provisioning

When a new tenant is created in Parpour:

1. **Generate NKey pair** via `nkeys` library
2. **Create JWT** via `nsc add account` with resource limits
3. **Push JWT** to NATS account resolver
4. **Create stream** `EVENTS_{tenant_id}` with subject filter `VENTURE.{tenant_id}.>`
5. **Create KV bucket** `config_{tenant_id}` for tenant configuration
6. **Create consumers**:
   - `artifact_worker_{tenant_id}` (pull, for artifact build jobs)
   - `compliance_{tenant_id}` (push, for compliance engine)
   - `ledger_{tenant_id}` (push, for treasury ledger sync)
   - `orchestrator_{tenant_id}` (pull, for task dispatch)

### Event Publish Contract

All events MUST include:
- `Nats-Msg-Id` header set to `event_id` (UUID)
- Subject format: `VENTURE.{tenant_id}.{event_type_dotted}`
- Payload: JSON-encoded `EventEnvelopeV1` (see `EVENT_TAXONOMY.md`)

### Consumer Contract

All consumers MUST:
- Use explicit ack policy
- Set `max_deliver` >= 3 (for retry)
- Set appropriate `ack_wait` (30s for real-time; 300s for builds)
- Handle `nak` with backoff delay for transient failures

### Monitoring Contract

The following metrics MUST be exposed via Prometheus:
- `nats_stream_messages_total{tenant_id, stream}` -- total messages per stream
- `nats_stream_bytes_total{tenant_id, stream}` -- total bytes per stream
- `nats_consumer_pending{tenant_id, consumer}` -- pending messages per consumer
- `nats_consumer_ack_pending{tenant_id, consumer}` -- in-flight messages per consumer
- `nats_publish_duplicate_total{tenant_id}` -- dedup hits (indicates retries)

---

## Open Questions Remaining

1. **Cluster mode timing**: When should Parpour move from single-node NATS to 3-node cluster? Suggested threshold: > 1k active tenants or > 50k messages/second aggregate.

2. **Cross-tenant analytics stream**: The `SYS` account import pattern needs benchmarking to ensure it does not create a performance bottleneck at high message volumes.

3. **Stream compaction**: For long-lived tenants, should we use `WorkQueuePolicy` (delete after ack) for job streams vs `LimitsPolicy` (retain with size/age limits) for audit streams? Current recommendation is `LimitsPolicy` for all streams to preserve audit trail, but this needs storage cost modeling.

4. **NATS 2.12 `isolate_leafnode_interest`**: This feature reduces east-west traffic in multi-region deployments. Should be evaluated when Parpour expands beyond a single region.

5. **Encryption at rest**: NATS JetStream file storage is not encrypted by default. For tenants with compliance requirements, either use encrypted filesystem (LUKS/dm-crypt) or evaluate NATS 2.12+ encryption-at-rest features.
