---
layout: doc
title: User Journeys
---

# Guardis User Journeys

> Visual workflows for Guardis secrets management

## Quick Navigation

| Journey | Time | Complexity | Status |
|---------|------|------------|--------|
| [Getting Started](./getting-started) | 10 min | ⭐ Beginner | ✅ Ready |
| [Team Secrets Sharing](./team-secrets-sharing) | 15 min | ⭐⭐ Intermediate | ✅ Ready |
| [Secret Rotation](./secret-rotation) | 20 min | ⭐⭐⭐ Advanced | ✅ Ready |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Guardis Cluster                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Node 1    │    │   Node 2    │    │   Node 3    │             │
│  │  (Leader)   │◀──▶│ (Follower)  │◀──▶│ (Follower)  │             │
│  └──────┬──────┘    └─────────────┘    └─────────────┘             │
│         │                                                           │
│         │         Raft Consensus (3-of-5 quorum)                     │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Vault KV v2 (Encrypted Secrets)                  │    │
│  │                                                               │    │
│  │   Namespace: org-acme/teams/engineering/                      │    │
│  │   └── secret/data/production/api-keys                         │    │
│  │                                                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Security Model

| Layer | Protection | Mechanism |
|-------|------------|-----------|
| Transport | TLS 1.3 | mTLS between nodes |
| Storage | AES-256-GCM | Vault encryption |
| Access | RBAC + ABAC | Policy-based auth |
| Audit | Tamper-proof logs | WAL + HMAC signatures |

## Performance

| Operation | P50 | P99 | Throughput |
|-----------|-----|-----|-----------|
| Read metadata | 1ms | 5ms | 10,000/sec |
| Read secret value | 5ms | 15ms | 5,000/sec |
| Create secret | 10ms | 30ms | 2,000/sec |
| Rotate secret | 50ms | 150ms | 500/sec |
