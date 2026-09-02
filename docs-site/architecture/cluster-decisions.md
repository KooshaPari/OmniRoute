---
title: Cluster Decisions
---

# Cluster Decisions

How OmniRoute behaves when running as multiple nodes.

## Quorum

Routing decisions are local. There is no global lock.

- Each node reads its own SQLite (or its own row in shared Postgres)
- Quota counters are eventually consistent
- Provider failover is per-node, decided in <2 ms

## Cross-region failover

```
Client → nearest region (geo DNS) → node picks provider
                                          ↓
                              if all providers exhausted → 503
```

Failover is **fail-stop**: if a node cannot reach any provider, it returns 503 immediately. It does NOT silently route to a degraded provider.

## Lockless quorum

There is no leader election. Every node is a peer.

Why: routing decisions are stateless. A peer can lose 50% of the cluster and still serve the same requests.
