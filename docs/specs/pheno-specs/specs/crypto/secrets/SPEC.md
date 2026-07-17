# Guardis Specification

> Comprehensive specification for Guardis - Enterprise Secrets Management System for the Phenotype Ecosystem

**Version**: 3.0 | **Status**: Active | **Last Updated**: 2026-04-04

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [SOTA Landscape](#2-sota-landscape)
3. [Architecture](#3-architecture)
4. [Secrets API Specification](#4-secrets-api-specification)
5. [Security Model](#5-security-model)
6. [API Design](#6-api-design)
7. [Configuration](#7-configuration)
8. [Compliance Considerations](#8-compliance-considerations)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [References](#10-references)
11. [Vault Cluster Architecture with Raft Consensus](#11-vault-cluster-architecture-with-raft-consensus-deep-dive)
12. [Multi-Tenant Namespace Isolation](#12-multi-tenant-namespace-isolation-model)
13. [Secret Lifecycle Management](#13-secret-lifecycle-management)
14. [Access Control and IAM](#14-access-control-policies-and-iam-integration)
15. [Audit Logging](#15-audit-logging-architecture-with-tamper-proof-guarantees)
16. [Secret Discovery and Injection](#16-secret-discovery-and-injection-patterns)
17. [Backup and Disaster Recovery](#17-backup-and-disaster-recovery-procedures)
18. [Detailed API Reference](#18-detailed-api-reference)
19. [Error Taxonomy](#19-error-taxonomy-and-recovery-strategies)
20. [Observability](#20-observability-metrics-tracing-logging)
21. [Deployment Patterns](#21-deployment-patterns)
22. [Migration Guide](#22-migration-guide-from-existing-secret-managers)
23. [Appendix: Type Definitions](#23-appendix-complete-type-definitions)
24. [Appendix: Benchmark Methodology](#24-appendix-benchmark-methodology)
25. [Additional References](#25-additional-references)

---


## 11. Vault Cluster Architecture with Raft Consensus Deep Dive

### 11.1 Raft Consensus Protocol Overview

Guardis uses HashiCorp Vault's integrated Raft storage backend for high availability. Raft is a consensus algorithm designed for understandability and correctness, providing strong consistency guarantees across a cluster of nodes. Unlike Paxos, Raft separates leader election from log replication, making it easier to reason about and implement.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAFT CONSENSUS ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    5-NODE VAULT CLUSTER                               │   │
│   │                                                                      │   │
│   │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │   │
│   │   │  Node 1  │    │  Node 2  │    │  Node 3  │    │  Node 4  │      │   │
│   │   │ (LEADER) │    │(Follower)│    │(Follower)│    │(Follower)│      │   │
│   │   │          │    │          │    │          │    │          │      │   │
│   │   │ Term: 42 │    │ Term: 42 │    │ Term: 42 │    │ Term: 42 │      │   │
│   │   │ Log: 156 │    │ Log: 156 │    │ Log: 156 │    │ Log: 156 │      │   │
│   │   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘      │   │
│   │        │               │               │               │            │   │
│   │        └───────────────┼───────────────┼───────────────┘            │   │
│   │                        │               │                            │   │
│   │                   ┌────┴────┐          │                            │   │
│   │                   │  Node 5 │          │                            │   │
│   │                   │(Follower)│          │                            │   │
│   │                   │          │          │                            │   │
│   │                   │ Term: 42 │          │                            │   │
│   │                   │ Log: 156 │          │                            │   │
│   │                   └──────────┘          │                            │   │
│   │                                         │                            │   │
│   │   Quorum: 3 of 5 nodes required for writes                          │   │
│   │   Fault tolerance: Can lose 2 nodes and remain available            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    RAFT LOG REPLICATION FLOW                          │   │
│   │                                                                      │   │
│   │   Client Write Request                                               │   │
│   │         │                                                            │   │
│   │         ▼                                                            │   │
│   │   ┌─────────────┐                                                    │   │
│   │   │   LEADER    │  1. Append entry to local log                     │   │
│   │   │   (Node 1)  │  2. Replicate to followers in parallel            │   │
│   │   └──────┬──────┘  3. Wait for majority ACK                         │   │
│   │          │         4. Commit entry locally                           │   │
│   │          │         5. Respond to client                              │   │
│   │          │                                                            │   │
│   │    ┌─────┴─────┬─────────────┬─────────────┐                         │   │
│   │    ▼           ▼             ▼             ▼                         │   │
│   │ ┌──────┐  ┌──────┐    ┌──────┐    ┌──────┐                          │   │
│   │ │Node 2│  │Node 3│    │Node 4│    │Node 5│                          │   │
│   │ │  ACK │  │  ACK │    │  ACK │    │  ACK │                          │   │
│   │ └──────┘  └──────┘    └──────┘    └──────┘                          │   │
│   │    │           │             │             │                         │   │
│   │    └───────────┴─────────────┴─────────────┘                         │   │
│   │                              │                                        │   │
│   │                              ▼                                        │   │
│   │                    Majority (3+) ACK received                         │   │
│   │                    └─▶ Entry committed                                │   │
│   │                        └─▶ Client receives 200 OK                    │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Raft Node State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAFT NODE STATE MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐    Election timeout     ┌──────────┐                         │
│   │ Follower │───────────────────────▶│ Candidate│                          │
│   │          │◀───────────────────────│          │                          │
│   │          │  Heartbeat received     │          │                          │
│   │          │  OR new leader elected  │          │                          │
│   └────┬─────┘                        └────┬─────┘                          │
│        │                                   │                                │
│        │    Wins majority votes             │                                │
│        │───────────────────────────────────▶│                                │
│        │                                   │                                │
│        ▼                                   ▼                                │
│   ┌──────────┐                        ┌──────────┐                          │
│   │          │                        │          │                          │
│   │  LEADER  │◀───────────────────────│ Candidate│                          │
│   │          │  Wins election          │          │                          │
│   │          │                        │          │                          │
│   └──────────┘                        └──────────┘                          │
│        │                                                                    │
│        │ Steps down (higher term seen)                                      │
│        │────────────────────────────────────────────────────────▶           │
│                                                                              │
│   Election Process:                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  1. Follower hasn't received heartbeat within election timeout     │   │
│   │  2. Increments term, transitions to Candidate                       │   │
│   │  3. Sends RequestVote RPC to all other nodes                       │   │
│   │  4. Votes for itself                                               │   │
│   │  5. If receives majority votes → becomes Leader                    │   │
│   │  6. If receives heartbeat from higher term → becomes Follower      │   │
│   │  7. If election timeout expires with no result → new election      │   │
│   │                                                                      │   │
│   │  Election timeout: 1000-2000ms (randomized to prevent split votes) │   │
│   │  Heartbeat interval: 100ms                                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Raft Log Structure

Each Vault node maintains an append-only log of state machine commands:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAFT LOG ENTRY STRUCTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Log Entry (per operation):                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ┌─────────┬──────────┬──────────────┬───────────────────────────┐  │   │
│   │  │  Index  │  Term    │  Command     │  Payload                  │  │   │
│   │  │  (int)  │  (int)   │  (enum)      │  (bytes)                  │  │   │
│   │  ├─────────┼──────────┼──────────────┼───────────────────────────┤  │   │
│   │  │   1     │    1     │  PUT         │  {"path":"secret/a","v":1}│  │   │
│   │  │   2     │    1     │  PUT         │  {"path":"secret/b","v":1}│  │   │
│   │  │   3     │    1     │  DELETE      │  {"path":"secret/a"}      │  │   │
│   │  │   4     │    2     │  PUT         │  {"path":"secret/c","v":1}│  │   │
│   │  │  ...    │   ...    │  ...         │  ...                      │  │   │
│   │  │  156    │   42     │  PUT         │  {"path":"secret/z","v":3}│  │   │
│   │  └─────────┴──────────┴──────────────┴───────────────────────────┘  │   │
│   │                                                                      │   │
│   │  Committed entries: 1-156 (all nodes agree)                         │   │
│   │  Uncommitted entries: 157+ (leader only, not yet replicated)        │   │
│   │                                                                      │   │
│   │  Snapshot: Periodically, log is compacted into snapshot             │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │  Snapshot at index 100:                                      │   │   │
│   │  │  - Last applied index: 100                                  │   │   │
│   │  │  - Last term: 38                                            │   │   │
│   │  │  - Full state tree (encrypted)                              │   │   │
│   │  │  - Size: ~50MB (compressed)                                 │   │   │
│   │  │                                                              │   │   │
│   │  │  Log entries 1-100 can now be discarded                     │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.4 Cluster Sizing Recommendations

| Cluster Size | Quorum | Fault Tolerance | Use Case | Max Write Throughput |
|-------------|--------|----------------|----------|---------------------|
| **3 nodes** | 2 | 1 node | Development, staging | ~1,000 ops/sec |
| **5 nodes** | 3 | 2 nodes | Production (recommended) | ~2,500 ops/sec |
| **7 nodes** | 4 | 3 nodes | Mission-critical, multi-region | ~3,500 ops/sec |
| **9 nodes** | 5 | 4 nodes | Global deployment | ~4,000 ops/sec |

### 11.5 Performance Characteristics

| Operation | Latency (p50) | Latency (p99) | Throughput | Notes |
|-----------|---------------|---------------|------------|-------|
| **Read (committed)** | 1ms | 5ms | 10,000 ops/sec | Served from any node |
| **Write (single)** | 5ms | 25ms | 2,500 ops/sec | Requires leader + quorum |
| **Write (batch 10)** | 8ms | 35ms | 1,200 ops/sec | Batched Raft entries |
| **Snapshot creation** | 500ms | 2s | 1 per 5min | Background operation |
| **Leader election** | 100ms | 2s | N/A | On leader failure |
| **Node join** | 2s | 10s | N/A | Includes log replay |

### 11.6 Network Partition Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK PARTITION SCENARIO                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Before Partition:                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   Node 1 ─── Node 2 ─── Node 3 ─── Node 4 ─── Node 5               │   │
│   │   (Leader)                                                          │   │
│   │   All nodes can communicate, cluster is healthy                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   After Partition (Nodes 1-2 isolated from 3-4-5):                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   Partition A (minority)          Partition B (majority)            │   │
│   │   ┌──────────┐  ┌──────────┐      ┌──────────┐ ┌──────────┐        │   │
│   │   │  Node 1  │  │  Node 2  │      │  Node 3  │ │  Node 4  │        │   │
│   │   │ (was Ldr)│  │(Follower)│      │(Follower)│ │(Follower)│        │   │
│   │   └──────────┘  └──────────┘      └────┬─────┘ └────┬─────┘        │   │
│   │   Status: STEPPED DOWN                  │            │              │   │
│   │   Cannot accept writes                  │  Node 5    │              │   │
│   │   Returns 503                           │(Follower)  │              │   │
│   │                                        └────┬───────┘              │   │
│   │                                             │                      │   │
│   │                              Node 3 elected new Leader             │   │
│   │                              Cluster B continues operating         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Recovery (partition heals):                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   1. Nodes 1-2 see higher term from Node 3                          │   │
│   │   2. Nodes 1-2 step down and become Followers                       │   │
│   │   3. Node 3 replicates any missing log entries to 1-2               │   │
│   │   4. Cluster returns to 5-node consensus                            │   │
│   │                                                                      │   │
│   │   Split-brain prevention: Only majority partition can elect leader  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.7 Auto-Unseal Configuration

```python
# Guardis auto-unseal with cloud KMS providers

class AutoUnsealConfig:
    """Auto-unseal configuration for Vault cluster."""

    AWS_KMS = {
        "seal": {"type": "awskms", "config": {
            "region": "us-east-1",
            "kms_key_id": "alias/guardis-vault-unseal",
        }}
    }

    AZURE_KV = {
        "seal": {"type": "azurekeyvault", "config": {
            "tenant_id": "${AZURE_TENANT_ID}",
            "client_id": "${AZURE_CLIENT_ID}",
            "vault_name": "guardis-vault-kv",
            "key_name": "guardis-unseal-key",
        }}
    }

    GCP_KMS = {
        "seal": {"type": "gcpckms", "config": {
            "project": "guardis-prod",
            "region": "us-central1",
            "key_ring": "vault-keyring",
            "crypto_key": "vault-unseal-key",
        }}
    }

    TRANSIT = {
        "seal": {"type": "transit", "config": {
            "address": "https://bootstrap-vault.internal:8200",
            "token": "${BOOTSTRAP_VAULT_TOKEN}",
            "key_name": "guardis-unseal",
        }}
    }
```

---

## 12. Multi-Tenant Namespace Isolation Model

### 12.1 Namespace Hierarchy

Guardis implements a hierarchical multi-tenant model using Vault namespaces (Enterprise feature) combined with path-based isolation for the open-source deployment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT NAMESPACE HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Root (Vault)                                                               │
│   ├── ns:org-acme/                    ← Organization: Acme Corp              │
│   │   ├── ns:teams/engineering/       ← Team: Engineering                    │
│   │   │   ├── ns:projects/api-gateway/  ← Project: API Gateway              │
│   │   │   │   ├── secret/data/production/  ← Production secrets              │
│   │   │   │   ├── secret/data/staging/     ← Staging secrets                 │
│   │   │   │   └── secret/data/development/ ← Development secrets             │
│   │   │   ├── ns:projects/auth-service/  ← Project: Auth Service            │
│   │   │   └── ns:shared/                 ← Team shared secrets               │
│   │   ├── ns:teams/data-science/      ← Team: Data Science                   │
│   │   │   └── ns:projects/ml-pipeline/  ← Project: ML Pipeline              │
│   │   ├── ns:services/                ← Service-level namespaces             │
│   │   │   ├── ci-cd/                    ← CI/CD service account              │
│   │   │   ├── monitoring/               ← Monitoring service account         │
│   │   │   └── logging/                  ← Logging service account            │
│   │   └── ns:policies/                ← Organization-wide policies           │
│   │                                                                            │
│   ├── ns:org-beta/                    ← Organization: Beta Inc               │
│   │   ├── ns:teams/...                  ← Complete isolation from Acme        │
│   │   └── ns:services/...               ← Separate service accounts           │
│   │                                                                            │
│   └── ns:sys/                         ← System namespace (Guardis internal)  │
│       ├── audit/                        ← Audit configuration                  │
│       ├── replication/                  ← Replication config                   │
│       └── monitoring/                   ← Internal monitoring                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Isolation Guarantees

| Isolation Level | Mechanism | Guarantee | Bypass Prevention |
|----------------|-----------|-----------|-------------------|
| **Organization** | Vault namespace | Complete key separation | Namespace token scoping |
| **Team** | Path prefix + policy | Path-level isolation | Policy deny on cross-team paths |
| **Project** | Sub-path + labels | Logical separation | Label-based access control |
| **Environment** | Separate KV mount | Physical separation | Mount-level ACLs |
| **Secret** | Per-secret DEK | Cryptographic isolation | Envelope encryption |

### 12.3 Cross-Tenant Access Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-TENANT ACCESS PATTERNS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Pattern 1: Shared Infrastructure Secrets                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   org-acme/teams/engineering/projects/api-gateway                   │   │
│   │       │ reads from                                                   │   │
│   │       ▼                                                              │   │
│   │   org-acme/services/database/credentials/primary                    │   │
│   │   Policy: path "org-acme/services/database/credentials/primary" {   │   │
│   │     capabilities = ["read"] }                                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Pattern 2: Cross-Organization Sharing (with approval)                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   org-acme/teams/engineering ──shares──▶ org-beta/teams/partners   │   │
│   │   Requires: 1. org-acme admin approval                              │   │
│   │           2. org-beta admin acceptance                               │   │
│   │           3. Time-limited access grant (default: 90 days)           │   │
│   │           4. Audit trail of all accesses                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Pattern 3: Service-to-Service (within org)                                │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   Service A (K8s pod) ──▶ Guardis ──▶ Service B's secrets           │   │
│   │   Auth: Kubernetes service account JWT                               │   │
│   │   Policy: Bound to service account name + namespace                  │   │
│   │   TTL: Token valid for pod lifetime only                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.4 Namespace Policy Templates

```python
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum

class Capability(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"
    DENY = "deny"

@dataclass
class PathRule:
    path: str
    capabilities: List[Capability]
    allowed_parameters: Optional[dict] = None

@dataclass
class NamespacePolicy:
    name: str
    namespace: str
    rules: List[PathRule]
    description: str = ""

class PolicyTemplates:
    @staticmethod
    def admin_policy(org: str) -> NamespacePolicy:
        return NamespacePolicy(
            name=f"{org}-admin", namespace=f"ns:{org}/",
            description=f"Full admin access for {org}",
            rules=[PathRule(path=f"{org}/*", capabilities=list(Capability))]
        )

    @staticmethod
    def developer_policy(org: str, team: str) -> NamespacePolicy:
        return NamespacePolicy(
            name=f"{org}-{team}-developer", namespace=f"ns:{org}/",
            rules=[
                PathRule(path=f"{org}/teams/{team}/*",
                    capabilities=[Capability.CREATE, Capability.READ, Capability.UPDATE, Capability.LIST]),
                PathRule(path=f"{org}/shared/*", capabilities=[Capability.READ, Capability.LIST]),
                PathRule(path=f"{org}/services/*", capabilities=[Capability.READ, Capability.LIST]),
            ]
        )

    @staticmethod
    def audit_policy(org: str) -> NamespacePolicy:
        return NamespacePolicy(
            name=f"{org}-auditor", namespace=f"ns:{org}/",
            rules=[
                PathRule(path=f"{org}/*", capabilities=[Capability.READ, Capability.LIST],
                    allowed_parameters={"include_value": ["false"]}),
                PathRule(path="sys/audit/*", capabilities=[Capability.READ, Capability.LIST]),
            ]
        )
```

### 12.5 Tenant Quota Management

| Quota Type | Default | Max | Enforcement |
|-----------|---------|-----|-------------|
| **Secrets per team** | 1,000 | 50,000 | Hard limit, returns 429 |
| **API calls per minute** | 1,000 | 10,000 | Token bucket, returns 429 |
| **Secret size** | 512KB | 1MB | Reject at API gateway |
| **Active leases** | 500 | 5,000 | Hard limit |
| **Policy count** | 50 | 500 | Hard limit |
| **Audit log retention** | 90 days | 7 years | Auto-archive |

---

## 13. Secret Lifecycle Management

### 13.1 Complete Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRET LIFECYCLE - DETAILED STATE MACHINE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     validate        ┌──────────┐     activate       ┌──────────┐
│   │  DRAFT   │───────────────────▶│ INACTIVE │───────────────────▶│  ACTIVE  │
│   │          │  - Schema check     │          │  - Mark current    │  (serving│
│   │  (new)   │  - Policy check     │  (stored │  - Notify subs     │   reads) │
│   │          │  - Encrypt value    │   but    │  - Start TTL       └────┬─────┘
│   └────┬─────┘  - Audit log       │   not    │                         │
│        │ delete                   │   used)  │                         │
│        │ (before activation)      └──────────┘                         │
│        ▼                                                               │
│   ┌──────────┐                                                         │
│   │ DELETED  │◀────────────────────────────────────────────────────────┘
│   │ (soft)   │  expire / manual delete
│   └────┬─────┘
│        │ purge (after retention period)
│        ▼
│   ┌──────────┐
│   │ PURGED   │  (hard delete, unrecoverable)
│   └──────────┘
│
│   ROTATION SUB-STATE MACHINE (triggered from ACTIVE):
│
│   ┌──────────┐   start rotation   ┌──────────┐   canary deploy   ┌──────────┐
│   │  ACTIVE  │───────────────────▶│ ROTATING │──────────────────▶│ CANARY   │
│   └────┬─────┘                    └────┬─────┘                   └────┬─────┘
│        │                               │ rollback                     │ rollback
│        │                               ▼                              ▼
│        │                         ┌──────────┐                   ┌──────────┐
│        │                         │  FAILED  │                   │  FAILED  │
│        │                         └──────────┘                   └──────────┘
│        │                               │ auto-retry                   │ auto-retry
│        │    complete                   ▼         complete             ▼
│        │◀───────────────────────┌──────────┐◀──────────────────┌──────────┐
│        │                        │  ACTIVE   │                  │  ACTIVE  │
│        │                        │ (new ver) │                  │ (new ver) │
│        │                        └──────────┘                   └──────────┘
│        │ deprecate old version
│        ▼
│   ┌──────────┐   grace period    ┌──────────┐   cleanup         ┌──────────┐
│   │DEPRECATING│─────────────────▶│DEPRECATED │──────────────────▶│DELETED   │
│   └──────────┘                   └──────────┘                   └──────────┘
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Create Operation

```python
async def create_secret(request: CreateSecretRequest, context: RequestContext) -> SecretMetadata:
    """Create a new secret with full validation and encryption.

    Flow:
    1. Authenticate request (JWT / API key / K8s token)
    2. Authorize path access (RBAC + ABAC policy check)
    3. Validate secret schema (type-specific validation)
    4. Generate Data Encryption Key (DEK)
    5. Encrypt secret value with DEK (AES-256-GCM)
    6. Encrypt DEK with Key Encryption Key (KEK)
    7. Store encrypted envelope in Vault KV v2
    8. Store metadata in PostgreSQL
    9. Write audit log entry
    10. Return secret metadata (NOT the value)
    """
    principal = await auth_service.authenticate(context.token)
    if not principal:
        raise AuthenticationError("Invalid or expired token")

    policy_result = await policy_engine.check(
        principal=principal, action="create",
        path=request.path, resource_type=request.secret_type
    )
    if not policy_result.allowed:
        raise PermissionDeniedError(f"Principal {principal.id} cannot create at {request.path}")

    validator = get_validator(request.secret_type)
    validator.validate(request.value)

    envelope = await encryption_engine.encrypt(
        plaintext=request.value, key_id=context.kek_version,
        algorithm=EncryptionAlgorithm.AES_256_GCM
    )

    vault_response = await vault_client.write(
        path=f"{request.path}/data/{request.name}",
        data={"data": {"encrypted_value": envelope.encrypted_data,
             "encryption_metadata": {"key_id": envelope.key_id, "algorithm": envelope.algorithm}},
              "options": {"cas": 0}}
    )

    metadata = SecretMetadata(
        id=generate_secret_id(), name=request.name, path=request.path,
        secret_type=request.secret_type, org_id=context.org_id, team_id=context.team_id,
        state=SecretState.ACTIVE, current_version=vault_response.version,
        created_at=datetime.utcnow(), rotation_policy=request.rotation_policy,
        labels=request.labels, description=request.description,
    )
    await metadata_store.save(metadata)
    await audit_logger.log(action="create", principal=principal,
        resource_path=f"{request.path}/{request.name}", success=True)
    return metadata
```

### 13.3 Read Operation

```python
async def read_secret(secret_id: str, version: Optional[int] = None,
                      include_value: bool = False, context: RequestContext = None) -> GetSecretResponse:
    """Read a secret with optional value retrieval.

    Flow:
    1. Authenticate and authorize
    2. Check cache (metadata always cached)
    3. If cache miss, fetch from Vault
    4. If include_value=True, decrypt envelope
    5. Create lease for dynamic secrets
    6. Log access in audit trail
    7. Return response
    """
    principal = await auth_service.authenticate(context.token)
    await policy_engine.check(principal=principal, action="read", path=secret_id, include_value=include_value)

    metadata = await cache.get(f"metadata:{secret_id}")
    if not metadata:
        metadata = await metadata_store.get(secret_id)
        await cache.set(f"metadata:{secret_id}", metadata, ttl=300)

    value = None
    if include_value:
        cached_value = await cache.get(f"value:{secret_id}")
        if cached_value and not cached_value.expired:
            value = cached_value.plaintext
        else:
            vault_data = await vault_client.read(path=metadata.vault_path, version=version)
            value = await encryption_engine.decrypt(
                encrypted_data=vault_data.encrypted_data, key_id=vault_data.key_id,
                nonce=vault_data.nonce, algorithm=vault_data.algorithm)
            await cache.set(f"value:{secret_id}", CachedValue(plaintext=value, ttl=60), ttl=60)

    lease = None
    if metadata.secret_type == SecretType.DYNAMIC:
        lease = await lease_manager.create(secret_id=secret_id, principal_id=principal.id,
            ttl=metadata.rotation_policy.grace_period_days * 86400)

    await audit_logger.log(action="read", principal=principal, resource_path=metadata.path, success=True)
    return GetSecretResponse(metadata=metadata, value=value, lease_duration=lease.ttl if lease else None)
```

### 13.4 Update Operation

```python
async def update_secret_metadata(secret_id: str, updates: SecretMetadataUpdate,
                                  context: RequestContext) -> SecretMetadata:
    """Update secret metadata (labels, rotation policy, description).
    Note: Updating the secret VALUE is done through the rotate endpoint."""
    metadata = await metadata_store.get(secret_id)
    await policy_engine.check(principal=context.principal, action="update", path=metadata.path)

    if updates.rotation_policy: metadata.rotation_policy = updates.rotation_policy
    if updates.labels: metadata.labels.update(updates.labels)
    if updates.description: metadata.description = updates.description
    if updates.expires_at: metadata.expires_at = updates.expires_at
    metadata.updated_at = datetime.utcnow()
    metadata.updated_by = context.principal.id
    await metadata_store.save(metadata)
    await audit_logger.log(action="update_metadata", principal=context.principal,
        resource_path=metadata.path, success=True)
    return metadata
```

### 13.5 Delete and Destroy Operations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DELETE vs DESTROY vs PURGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SOFT DELETE (Default)                                                      │
│   - Sets state = DELETED, value remains encrypted in Vault                  │
│   - Can be restored within retention period                                 │
│   - API: DELETE /secrets/{id} or DELETE /secrets/{id}?force=false           │
│                                                                              │
│   HARD DELETE (force=true)                                                   │
│   - Immediately removes from Vault KV v2 + PostgreSQL metadata              │
│   - Invalidates all active leases, clears cache                             │
│   - Audit log entry preserved (immutable)                                   │
│   - NOT recoverable, requires admin role + MFA                              │
│                                                                              │
│   DESTROY (specific versions)                                                │
│   - Destroys specific version(s) of a secret                                │
│   - Vault KV v2 supports versioned secrets                                  │
│   - API: DELETE /secrets/{id}/versions/{version}?destroy=true               │
│                                                                              │
│   PURGE (after retention period)                                             │
│   - Background job runs daily, finds soft-deleted past retention            │
│   - Cryptographically erases (overwrites encrypted data)                    │
│   - Retention: Default 30 days, SOC 2: 7 years, Custom: per-org             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.6 Lifecycle Operations Comparison

| Operation | Auth Required | Audit Logged | Reversible | Latency (p99) | Throughput |
|-----------|--------------|--------------|------------|---------------|------------|
| **Create** | Yes (write) | Yes | N/A | 15ms | 5,000/sec |
| **Read (metadata)** | Yes (read) | Yes | N/A | 3ms | 20,000/sec |
| **Read (with value)** | Yes (read) | Yes | N/A | 8ms | 10,000/sec |
| **Update metadata** | Yes (write) | Yes | Yes | 10ms | 5,000/sec |
| **Rotate** | Yes (write) | Yes | Yes (rollback) | 50ms | 500/sec |
| **Soft delete** | Yes (delete) | Yes | Yes (30 days) | 10ms | 5,000/sec |
| **Hard delete** | Yes (admin+MFA) | Yes | No | 15ms | 1,000/sec |
| **Destroy version** | Yes (admin) | Yes | No | 10ms | 2,000/sec |
| **Restore** | Yes (write) | Yes | N/A | 15ms | 1,000/sec |
| **List** | Yes (list) | Yes | N/A | 20ms | 3,000/sec |

---

## 14. Access Control Policies and IAM Integration

### 14.1 Policy Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    POLICY ENGINE ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Request ──▶ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│               │   RBAC      │ │   ABAC      │ │   Temporal  │              │
│               │   Check     │ │   Check     │ │   Check     │              │
│               └──────┬──────┘ └──────┬──────┘ └──────┬──────┘              │
│                      │               │               │                       │
│                      ▼               ▼               ▼                       │
│               ┌─────────────────────────────────────────────────┐           │
│               │              DECISION ENGINE                      │           │
│               │  if RBAC.ALLOW AND ABAC.ALLOW AND TEMPORAL.ALLOW│           │
│               │      → PERMIT                                      │           │
│               │  else if ANY.DENY → DENY                          │           │
│               │  else → DENY (default deny)                       │           │
│               └─────────────────────────────────────────────────┘           │
│                              │                                              │
│                       ┌──────────┐                                          │
│                       │ PERMIT   │  or  │ DENY + reason                    │
│                       └──────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 RBAC Role Definitions

| Role | Capabilities | Scope | Default Assignment |
|------|-------------|-------|-------------------|
| **org-admin** | Full CRUD on all paths | Organization-wide | Manually assigned |
| **team-admin** | Full CRUD on team paths | Team namespace | Team creator |
| **developer** | Read all, write team paths | Team namespace | Team membership |
| **operator** | Read production, write staging | Environment-scoped | CI/CD service accounts |
| **auditor** | Read-only, no secret values | Organization-wide | Security team |
| **service** | Read specific paths only | Path-scoped | Kubernetes service accounts |
| **readonly** | Read metadata only | Organization-wide | External integrations |

### 14.3 IAM Integration Patterns

```python
class IAMIntegration:
    """External IAM provider integration."""

    OKTA = {
        "provider": "okta", "base_url": "https://acme.okta.com",
        "auth_method": "oidc", "scopes": ["openid", "profile", "email", "groups"],
        "group_mapping": {
            "Engineering-Admins": "org-admin", "Engineering-Developers": "developer",
            "Security-Auditors": "auditor", "Data-Science": "developer",
        },
        "token_ttl": "1h", "refresh_token_ttl": "24h",
    }

    AWS_IAM = {
        "provider": "aws-iam", "auth_method": "iam",
        "role_mapping": {
            "arn:aws:iam::123456789012:role/ProdDeployer": "operator",
            "arn:aws:iam::123456789012:role/DevEngineer": "developer",
        },
        "sts_endpoint": "https://sts.amazonaws.com", "region": "us-east-1",
    }

    AZURE_AD = {
        "provider": "azure-ad", "auth_method": "oidc",
        "group_mapping": {"sg-guardis-admins": "org-admin", "sg-guardis-devs": "developer"},
        "token_ttl": "1h",
    }

    KUBERNETES = {
        "provider": "kubernetes", "auth_method": "kubernetes",
        "kubernetes_host": "https://kubernetes.default.svc",
        "service_account_mapping": {
            "default:ci-cd-pipeline": "operator",
            "production:api-gateway": "service",
        },
    }
```

### 14.4 Policy Language (HCL-based)

```hcl
# Team developer policy
path "org/acme/teams/engineering/projects/*" {
  capabilities = ["create", "read", "update", "list"]
  allowed_parameters = {
    "secret_type" = ["api_key", "database_password", "generic_secret"]
  }
}

# Production secrets (read-only for developers, MFA required)
path "org/acme/teams/*/projects/*/production/*" {
  capabilities = ["read", "list"]
  required_parameters = { "mfa_validated" = ["true"] }
}

# Shared infrastructure (read-only)
path "org/acme/services/database/credentials/*" {
  capabilities = ["read"]
  allowed_response_fields = ["data", "metadata"]
}

# Deny all other paths (default deny)
path "*" { capabilities = ["deny"] }

# Admin: full access within org
path "org/acme/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

---

## 15. Audit Logging Architecture with Tamper-Proof Guarantees

### 15.1 Audit Log Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUDIT LOGGING PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  Guardis │    │  Audit   │    │  Log     │    │  Long-   │             │
│   │  Agent   │───▶│  Buffer  │───▶│  Shipper │───▶│  Term    │             │
│   │          │    │  (Ring   │    │  (Async) │    │  Storage │             │
│   │  - Auth  │    │   Buffer)│    │          │    │          │             │
│   │  - CRUD  │    │  - 10K   │    │  - Batch │    │  - S3    │             │
│   │  - Rotate│    │   entries│    │  - Retry │    │  - GCS   │             │
│   │  - Delete│    │   in-mem │    │  - Back- │    │  - Azure │             │
│   └──────────┘    └──────────┘    │   press  │    │  Blob    │             │
│       │               │           └──────────┘    └──────────┘             │
│       ▼               ▼               │               │                     │
│   ┌──────────┐    ┌──────────┐       ▼               ▼                     │
│   │  Local   │    │  Stream  │    ┌──────────┐    ┌──────────┐             │
│   │  Audit   │    │  (Kafka) │    │  SIEM    │    │  Hash    │             │
│   │  File    │    │          │    │(Splunk)  │    │  Chain   │             │
│   │  - JSON  │    │  - Real- │    │  - Alert │    │  (Merkle)│             │
│   │  - 100MB │    │   time   │    │  - Query │    │  - Every │             │
│   │  max     │    │          │    │          │    │  100 ent │             │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│                                                                              │
│   Guarantees:                                                                │
│   - Every access is logged (no exceptions)                                   │
│   - Logs written BEFORE response is returned                                │
│   - Buffer flushed on shutdown (graceful)                                   │
│   - Failed log writes trigger circuit breaker                               │
│   - Hash chain detects any tampering                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Audit Log Entry Schema

```python
@dataclass
class AuditLogEntry:
    """Single audit log entry with tamper-proof hash chain."""
    id: str                          # UUID v7 (time-sortable)
    timestamp: datetime              # ISO 8601 with ms precision
    version: int = 2
    principal_type: str              # user | service | token | system
    principal_id: str
    principal_name: str
    ip_address: str
    user_agent: Optional[str] = None
    action: str                      # create | read | update | delete | rotate | list
    resource_type: str               # secret | policy | namespace | token
    resource_path: str
    resource_id: Optional[str] = None
    success: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    request_id: str                  # Correlation ID
    session_id: Optional[str] = None
    method: str                      # HTTP method or gRPC method
    response_status: int
    response_time_ms: int
    secret_version_accessed: Optional[int] = None
    include_value_requested: bool = False
    previous_hash: str               # SHA-256 of previous entry
    entry_hash: str                  # SHA-256 of this entry
    merkle_root: Optional[str] = None  # Set every 100 entries
    compliance_tags: List[str] = field(default_factory=list)
    data_classification: str = "confidential"
```

### 15.3 Hash Chain Implementation

```python
import hashlib
import json

class AuditHashChain:
    """Tamper-proof hash chain for audit logs."""

    def __init__(self, genesis_hash: str = "0" * 64):
        self.previous_hash = genesis_hash
        self.entry_count = 0
        self.merkle_tree: List[str] = []
        self.last_merkle_root: Optional[str] = None

    def compute_entry_hash(self, entry: dict) -> str:
        content = {k: v for k, v in entry.items()
                   if k not in ('entry_hash', 'previous_hash', 'merkle_root')}
        content_bytes = json.dumps(content, sort_keys=True).encode('utf-8')
        return hashlib.sha256(content_bytes).hexdigest()

    def add_entry(self, entry: dict) -> dict:
        entry['previous_hash'] = self.previous_hash
        entry['entry_hash'] = self.compute_entry_hash(entry)
        self.previous_hash = entry['entry_hash']
        self.entry_count += 1
        self.merkle_tree.append(entry['entry_hash'])
        if self.entry_count % 100 == 0:
            entry['merkle_root'] = self._compute_merkle_root()
            self.last_merkle_root = entry['merkle_root']
            self.merkle_tree = []
        return entry

    def _compute_merkle_root(self) -> str:
        if not self.merkle_tree:
            return self.previous_hash
        hashes = list(self.merkle_tree)
        while len(hashes) > 1:
            if len(hashes) % 2 == 1:
                hashes.append(hashes[-1])
            next_level = []
            for i in range(0, len(hashes), 2):
                combined = hashes[i] + hashes[i + 1]
                next_level.append(hashlib.sha256(combined.encode()).hexdigest())
            hashes = next_level
        return hashes[0]

    def verify_chain(self, entries: List[dict]) -> bool:
        current_hash = "0" * 64
        for entry in entries:
            if entry['previous_hash'] != current_hash:
                return False
            if entry['entry_hash'] != self.compute_entry_hash(entry):
                return False
            current_hash = entry['entry_hash']
        return True
```

### 15.4 Tamper Detection Methods

| Detection Method | How It Works | False Positive Rate | Detection Time |
|-----------------|-------------|-------------------|----------------|
| **Hash chain** | SHA-256 linkage between entries | 0% (cryptographic) | On verification |
| **Merkle root** | Periodic Merkle tree root | 0% | Every 100 entries |
| **External anchor** | Merkle root posted to blockchain | 0% | 10-60 minutes |
| **Write-once storage** | WORM bucket (S3 Object Lock) | 0% | Real-time |
| **Duplicate logging** | Parallel log to independent system | ~0.01% | Real-time |

---

## 16. Secret Discovery and Injection Patterns

### 16.1 Injection Methods

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRET INJECTION PATTERNS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Pattern 1: Environment Variables (Most Common)                             │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                 │
│   │  Guardis    │      │  Init       │      │  Application│                 │
│   │  Agent      │─────▶│  Container  │─────▶│  Process    │                 │
│   │  Fetch      │      │  Write to   │      │  Read from  │                 │
│   │  secrets    │      │  /etc/      │      │  env vars   │                 │
│   │  from Vault │      │  guardis/   │      │             │                 │
│   └─────────────┘      └─────────────┘      └─────────────┘                 │
│                                                                              │
│   Pattern 2: Sidecar Proxy (Recommended for K8s)                            │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │                        Pod                                 │             │
│   │   ┌─────────────┐        ┌─────────────┐                   │             │
│   │   │  App        │  :8200 │  Guardis    │                   │             │
│   │   │  Container  │◀─────▶│  Sidecar    │                   │             │
│   │   │  Reads from │       │  (Vault     │                   │             │
│   │   │  /secrets/  │       │   Agent)    │                   │             │
│   │   └─────────────┘       └─────────────┘                   │             │
│   │   Shared Volume: /guardis/secrets/                        │             │
│   │   - db-password.txt    (auto-rendered template)           │             │
│   │   - api-key.json       (auto-rendered template)           │             │
│   │   - tls-cert.pem       (auto-rendered template)           │             │
│   └───────────────────────────────────────────────────────────┘             │
│                                                                              │
│   Pattern 3: CSI Driver (Native K8s Secrets)                                │
│   volumes:                                                                   │
│     - name: guardis-secrets                                                  │
│       csi:                                                                   │
│         driver: secrets.guardis.io                                           │
│         readOnly: true                                                       │
│         volumeAttributes:                                                    │
│           secrets: "org/acme/teams/engineering/secrets/*"                    │
│           refreshInterval: "60s"                                             │
│   Mounted at: /var/run/secrets/guardis/                                     │
│                                                                              │
│   Pattern 4: SDK Direct Access (Developer Experience)                       │
│   Python: async with Client() as client:                                     │
│       db_pass = await client.secrets.get("db-password")                      │
│   Rust: let secret = client.secrets().get("db-password")                     │
│       .include_value(true).send().await?;                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Template Rendering Engine

```python
class SecretTemplate:
    """Template for rendering secrets into files."""

    DB_CONFIG_TEMPLATE = """
    # Auto-generated by Guardis - DO NOT EDIT
    [database]
    host = {{ with secret "org/{{ .org }}/services/database/credentials/primary" }}
    {{ .Data.data.host }}
    {{ end }}
    port = {{ with secret "org/{{ .org }}/services/database/credentials/primary" }}
    {{ .Data.data.port }}
    {{ end }}
    username = {{ with secret "org/{{ .org }}/services/database/credentials/primary" }}
    {{ .Data.data.username }}
    {{ end }}
    password = {{ with secret "org/{{ .org }}/services/database/credentials/primary" }}
    {{ .Data.data.password }}
    {{ end }}
    """

    TLS_TEMPLATE = """
    {{ with secret "org/{{ .org }}/pki/issue/api" "common_name=api.example.com" }}
    -----BEGIN CERTIFICATE-----
    {{ .Data.certificate }}
    -----END CERTIFICATE-----
    -----BEGIN RSA PRIVATE KEY-----
    {{ .Data.private_key }}
    -----END RSA PRIVATE KEY-----
    {{ end }}
    """
```

### 16.3 Discovery Mechanisms

| Method | How It Works | Use Case | Latency |
|--------|-------------|----------|---------|
| **Path listing** | `GET /secrets?path_prefix=org/acme/teams/` | Browse secrets | 20ms |
| **Label search** | `GET /secrets?labels=environment:production` | Find by metadata | 30ms |
| **Type filter** | `GET /secrets?secret_type=database_password` | Find by type | 25ms |
| **Tag query** | `GET /secrets?compliance_tags=pci-dss` | Compliance audit | 35ms |
| **Dependency graph** | `GET /secrets/{id}/dependencies` | Impact analysis | 50ms |
| **SDK auto-discovery** | `client.secrets.discover(path_prefix)` | Developer tooling | 40ms |

---

## 17. Backup and Disaster Recovery Procedures

### 17.1 Backup Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKUP AND DISASTER RECOVERY ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Primary Region (us-east-1)                                                 │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │  Vault Cluster (5 nodes, Raft)                            │             │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │             │
│   │  │  Snapshot   │  │  Snapshot   │  │  Snapshot   │       │             │
│   │  │  (every     │  │  (every     │  │  (every     │       │             │
│   │  │  5 min)     │  │  5 min)     │  │  5 min)     │       │             │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │             │
│   │         └───────────────┼───────────────┘                │             │
│   │                         ▼                                │             │
│   │              ┌────────────────────┐                     │             │
│   │              │  Backup Coordinator│                     │             │
│   │              │  - Deduplicates    │                     │             │
│   │              │  - Encrypts        │                     │             │
│   │              │  - Compresses      │                     │             │
│   │              │  - Uploads         │                     │             │
│   │              └────────┬───────────┘                     │             │
│   └───────────────────────┼─────────────────────────────────┘             │
│                           ▼                                                │
│              ┌────────────────────┐                                       │
│              │  S3 (us-east-1)    │  <- Primary backup store               │
│              │  - Encrypted       │                                       │
│              │  - Versioned       │                                       │
│              │  - Object Lock     │                                       │
│              └────────┬───────────┘                                       │
│                       │                                                    │
│   Cross-Region        ▼                                                    │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │              ┌────────────────────┐                               │   │
│   │              │  S3 (eu-west-1)    │  <- DR backup store            │   │
│   │              │  - Encrypted       │                               │   │
│   │              │  - Versioned       │                               │   │
│   │              └────────┬───────────┘                               │   │
│   │                       ▼                                           │   │
│   │              ┌────────────────────┐                               │   │
│   │              │  DR Vault Cluster  │                               │   │
│   │              │  (3 nodes, standby)│                               │   │
│   │              │  - Auto-promotion  │                               │   │
│   │              │  - < 5 min RTO     │                               │   │
│   │              └────────────────────┘                               │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   RPO: 5 minutes (snapshot interval)                                        │
│   RTO: 5 minutes (DR cluster auto-promotion)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 17.2 Backup Schedule and Retention

| Backup Type | Frequency | Retention | Storage | Encryption |
|------------|-----------|-----------|---------|------------|
| **Raft snapshot** | Every 5 minutes | 24 hours | Local disk | AES-256-GCM |
| **Full backup** | Every 6 hours | 30 days | S3 (primary) | SSE-KMS |
| **Cross-region copy** | Every 6 hours | 90 days | S3 (DR region) | SSE-KMS |
| **Metadata backup** | Every 1 hour | 7 years | S3 + Glacier | SSE-KMS |
| **Audit log backup** | Continuous | 7 years | S3 Object Lock | SSE-KMS |
| **Configuration backup** | On change | 7 years | S3 + Git | SSE-KMS |

### 17.3 Disaster Recovery Runbook

```python
class DisasterRecovery:
    """DR procedures for Guardis."""

    SCENARIO_LOSE_PRIMARY_REGION = """
    Scenario: Complete loss of us-east-1 region
    Steps:
    1. Confirm primary region is unavailable
    2. Promote DR cluster in eu-west-1: guardis dr promote --region eu-west-1
    3. Verify DR cluster is leader: guardis status --region eu-west-1
    4. Update DNS to point to DR endpoint via Route53
    5. Verify client connectivity: guardis health-check --endpoint https://vault-dr.guardis.io
    6. Monitor for 30 minutes
    7. Notify stakeholders via Slack
    """

    SCENARIO_CORRUPTED_DATA = """
    Scenario: Data corruption detected in primary cluster
    Steps:
    1. Stop all writes: guardis seal --reason "data corruption detected"
    2. Identify corruption: guardis audit verify --from 2026-04-01 --to 2026-04-04
    3. Restore from backup: guardis restore --backup-id bk-20260403-180000 --region us-east-1
    4. Verify: guardis verify --region us-east-1
    5. Unseal: guardis unseal --region us-east-1
    6. Rejoin Raft: guardis raft rejoin --region us-east-1
    7. Verify replication: guardis replication status
    """

    SCENARIO_KEY_COMPROMISE = """
    Scenario: KEK (Key Encryption Key) compromise suspected
    Steps:
    1. Seal all clusters: guardis seal --all --reason "KEK compromise suspected"
    2. Rotate KEK: guardis hsm rotate-kek --key-id kek-primary
    3. Re-wrap DEKs: guardis rewrap --all --new-kek-id kek-primary-v2
    4. Verify decryption: guardis verify-decryption --sample-size 1000
    5. Unseal: guardis unseal --all
    6. Audit KEK access: guardis audit query --action "kek_access" --days 90
    7. Rotate exposed secrets: guardis rotate --all --force
    """
```

### 17.4 DR Testing Schedule

| Test Type | Frequency | Duration | Success Criteria |
|-----------|-----------|----------|-----------------|
| **Backup restore drill** | Monthly | 30 min | Restore completes, data verified |
| **Failover test** | Quarterly | 2 hours | RTO < 5 min, RPO < 5 min |
| **Full DR exercise** | Annually | 1 day | All systems operational in DR region |
| **KEK rotation drill** | Semi-annually | 1 hour | All secrets decryptable after rotation |
| **Chaos engineering** | Monthly | Ongoing | System survives node/region failure |

---

## 18. Detailed API Reference

### 18.1 Complete Endpoint Matrix

| Method | Endpoint | Description | Auth | Rate Limit | Response |
|--------|----------|-------------|------|------------|----------|
| `GET` | `/v2/secrets` | List secrets with filters | Required | 3,000/min | `ListSecretsResponse` |
| `POST` | `/v2/secrets` | Create a new secret | Required (write) | 5,000/min | `SecretMetadata` (201) |
| `GET` | `/v2/secrets/{id}` | Get secret metadata | Required (read) | 10,000/min | `GetSecretResponse` |
| `PATCH` | `/v2/secrets/{id}` | Update secret metadata | Required (write) | 5,000/min | `SecretMetadata` |
| `DELETE` | `/v2/secrets/{id}` | Soft delete secret | Required (delete) | 5,000/min | 204 No Content |
| `DELETE` | `/v2/secrets/{id}?force=true` | Hard delete secret | Required (admin+MFA) | 1,000/min | 204 No Content |
| `POST` | `/v2/secrets/{id}/restore` | Restore soft-deleted secret | Required (write) | 1,000/min | `SecretMetadata` |
| `GET` | `/v2/secrets/{id}/value` | Get secret value | Required (read) | 10,000/min | `SecretValueResponse` |
| `GET` | `/v2/secrets/{id}/value?version=N` | Get specific version value | Required (read) | 10,000/min | `SecretValueResponse` |
| `GET` | `/v2/secrets/{id}/versions` | List all versions | Required (read) | 3,000/min | `VersionListResponse` |
| `GET` | `/v2/secrets/{id}/versions/{version}` | Get version details | Required (read) | 10,000/min | `SecretVersion` |
| `DELETE` | `/v2/secrets/{id}/versions/{version}?destroy=true` | Destroy version | Required (admin) | 2,000/min | 204 No Content |
| `POST` | `/v2/secrets/{id}/versions/{version}/restore` | Restore version | Required (write) | 1,000/min | `SecretMetadata` |
| `POST` | `/v2/secrets/{id}/rotate` | Initiate rotation | Required (write) | 500/min | `RotateSecretResponse` (202) |
| `GET` | `/v2/rotations/{rotation_id}` | Get rotation status | Required (read) | 3,000/min | `RotationStatus` |
| `POST` | `/v2/rotations/{rotation_id}/cancel` | Cancel rotation | Required (admin) | 500/min | 204 No Content |
| `POST` | `/v2/rotations/{rotation_id}/rollback` | Rollback rotation | Required (admin) | 500/min | `RotationStatus` |
| `GET` | `/v2/secrets/{id}/rotations` | List rotation history | Required (read) | 3,000/min | `RotationHistoryResponse` |
| `GET` | `/v2/policies` | List policies | Required (list) | 3,000/min | `PolicyListResponse` |
| `POST` | `/v2/policies` | Create policy | Required (admin) | 500/min | `Policy` (201) |
| `GET` | `/v2/policies/{name}` | Get policy details | Required (read) | 3,000/min | `Policy` |
| `PUT` | `/v2/policies/{name}` | Replace policy | Required (admin) | 500/min | `Policy` |
| `DELETE` | `/v2/policies/{name}` | Delete policy | Required (admin) | 500/min | 204 No Content |
| `POST` | `/v2/auth/token/create` | Create API token | Required (admin) | 100/min | `TokenResponse` (201) |
| `POST` | `/v2/auth/token/lookup` | Lookup token info | Required | 3,000/min | `TokenInfo` |
| `POST` | `/v2/auth/token/revoke` | Revoke token | Required | 1,000/min | 204 No Content |
| `POST` | `/v2/auth/token/renew` | Renew token TTL | Required | 1,000/min | `TokenInfo` |
| `GET` | `/v2/audit/logs` | Query audit logs | Required (auditor) | 1,000/min | `AuditLogResponse` |
| `GET` | `/v2/audit/logs/export` | Export audit logs (CSV) | Required (auditor) | 10/hour | CSV file |
| `GET` | `/v2/audit/verify` | Verify audit integrity | Required (auditor) | 100/min | `VerificationResult` |
| `GET` | `/v2/namespaces` | List namespaces | Required (admin) | 3,000/min | `NamespaceListResponse` |
| `POST` | `/v2/namespaces` | Create namespace | Required (admin) | 100/min | `Namespace` (201) |
| `DELETE` | `/v2/namespaces/{path}` | Delete namespace | Required (admin) | 100/min | 204 No Content |
| `GET` | `/health` | Health check | None | Unlimited | `HealthResponse` |
| `GET` | `/ready` | Readiness check | None | Unlimited | `ReadyResponse` |
| `GET` | `/metrics` | Prometheus metrics | None | Unlimited | Prometheus format |
| `GET` | `/v2/status` | System status | Required | 3,000/min | `SystemStatus` |

### 18.2 Request/Response Examples

```
POST /v2/secrets
Content-Type: application/json
Authorization: Bearer <token>
X-Guardis-Org: acme
X-Guardis-Team: engineering

{
  "name": "stripe-api-key",
  "path": "org/acme/teams/engineering/projects/billing",
  "secret_type": "api_key",
  "value": "sk_live_51H7...",
  "rotation_policy": {
    "rotation_period_days": 90,
    "grace_period_days": 7,
    "auto_rotate": true,
    "strategy": "dual_version",
    "canary_percentage": 10,
    "notify_channels": ["slack://alerts", "email://security"]
  },
  "labels": {"environment": "production", "service": "billing-api", "compliance": "pci-dss"},
  "description": "Stripe API key for billing service"
}

Response 201 Created:
{
  "id": "sec_01h8x9k2m3n4p5q6r7s8t9u0v",
  "name": "stripe-api-key",
  "path": "org/acme/teams/engineering/projects/billing",
  "secret_type": "api_key",
  "state": "active",
  "current_version": 1,
  "created_at": "2026-04-04T10:30:00.000Z",
  "updated_at": "2026-04-04T10:30:00.000Z",
  "rotated_at": null,
  "expires_at": null,
  "rotation_policy": { ... },
  "labels": { ... },
  "description": "Stripe API key for billing service"
}
```

### 18.3 gRPC Streaming Endpoints

```protobuf
// Real-time secret event streaming
rpc StreamSecretEvents(StreamSecretEventsRequest) returns (stream SecretEvent);

message StreamSecretEventsRequest {
  repeated string secret_ids = 1;
  string path_prefix = 2;
  repeated string event_types = 3;
  int64 since_timestamp = 4;
}

message SecretEvent {
  string event_id = 1;
  string secret_id = 2;
  string event_type = 3;             // CREATED, UPDATED, ROTATED, DELETED
  int64 timestamp = 4;
  string actor_id = 5;
  int32 new_version = 6;
  SecretMetadata metadata = 7;
}

// Real-time audit event streaming
rpc StreamAuditEvents(StreamAuditEventsRequest) returns (stream AuditEvent);

message AuditEvent {
  string id = 1;
  int64 timestamp = 2;
  string principal_type = 3;
  string principal_id = 4;
  string action = 5;
  string resource_path = 6;
  bool success = 7;
  string error_message = 8;
  map<string, string> metadata = 9;
}
```

---

## 19. Error Taxonomy and Recovery Strategies

### 19.1 Error Code Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ERROR TAXONOMY                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   GUARDIS-1xxx: Authentication Errors                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GUARDIS-1001  INVALID_TOKEN          Token is malformed or expired │   │
│   │  GUARDIS-1002  TOKEN_REVOKED          Token has been revoked       │   │
│   │  GUARDIS-1003  AUTH_PROVIDER_DOWN     External IdP unavailable     │   │
│   │  GUARDIS-1004  MFA_REQUIRED           MFA verification needed      │   │
│   │  GUARDIS-1005  MFA_FAILED             MFA verification failed      │   │
│   │  GUARDIS-1006  SESSION_EXPIRED        Session has expired          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   GUARDIS-2xxx: Authorization Errors                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GUARDIS-2001  ACCESS_DENIED          Insufficient permissions     │   │
│   │  GUARDIS-2002  PATH_NOT_ALLOWED       Path outside allowed scope   │   │
│   │  GUARDIS-2003  NAMESPACE_ISOLATED     Cross-namespace access denied│   │
│   │  GUARDIS-2004  POLICY_EVAL_ERROR      Policy engine error          │   │
│   │  GUARDIS-2005  QUOTA_EXCEEDED       Organization quota exceeded    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   GUARDIS-3xxx: Secret Operation Errors                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GUARDIS-3001  SECRET_NOT_FOUND       Secret does not exist        │   │
│   │  GUARDIS-3002  SECRET_ALREADY_EXISTS  Duplicate name at path       │   │
│   │  GUARDIS-3003  VERSION_NOT_FOUND      Requested version missing    │   │
│   │  GUARDIS-3004  SECRET_DELETED         Secret is soft-deleted       │   │
│   │  GUARDIS-3005  SECRET_EXPIRED         Secret has expired           │   │
│   │  GUARDIS-3006  SECRET_TOO_LARGE       Exceeds max size (1MB)       │   │
│   │  GUARDIS-3007  INVALID_SECRET_TYPE    Unsupported secret type      │   │
│   │  GUARDIS-3008  SCHEMA_VALIDATION      Secret value fails schema    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   GUARDIS-4xxx: Rotation Errors                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GUARDIS-4001  ROTATION_IN_PROGRESS   Already rotating             │   │
│   │  GUARDIS-4002  ROTATION_FAILED        Rotation step failed         │   │
│   │  GUARDIS-4003  ROTATION_TIMEOUT       Rotation exceeded timeout    │   │
│   │  GUARDIS-4004  ROLLBACK_FAILED        Rollback also failed         │   │
│   │  GUARDIS-4005  CANNOT_ROTATE          Secret not rotatable         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   GUARDIS-5xxx: Infrastructure Errors                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GUARDIS-5001  VAULT_UNAVAILABLE      Vault cluster unreachable    │   │
│   │  GUARDIS-5002  VAULT_SEALED         Vault is sealed                │   │
│   │  GUARDIS-5003  RAFT_NO_LEADER       No Raft leader available       │   │
│   │  GUARDIS-5004  STORAGE_FULL         Storage backend full           │   │
│   │  GUARDIS-5005  ENCRYPTION_ERROR     Encryption/decryption failed   │   │
│   │  GUARDIS-5006  CACHE_UNAVAILABLE    Cache backend down             │   │
│   │  GUARDIS-5007  RATE_LIMITED         Rate limit exceeded            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 19.2 Error Response Format

```json
{
  "error": {
    "code": "GUARDIS-3001",
    "type": "SECRET_NOT_FOUND",
    "message": "Secret 'sec_01h8x9k2m3n4p5q6r7s8t9u0v' not found",
    "details": {
      "secret_id": "sec_01h8x9k2m3n4p5q6r7s8t9u0v",
      "path": "org/acme/teams/engineering/projects/billing",
      "suggestions": [
        "Verify the secret ID is correct",
        "Check if the secret was deleted",
        "Ensure you have access to this namespace"
      ]
    },
    "request_id": "req_abc123def456",
    "timestamp": "2026-04-04T10:30:00.123Z",
    "documentation_url": "https://docs.guardis.io/errors/GUARDIS-3001"
  }
}
```

### 19.3 Recovery Strategies

| Error Code | Recovery Strategy | Auto-Retry | Escalation |
|-----------|------------------|------------|------------|
| **GUARDIS-1001** | Re-authenticate with IdP | No (client action) | After 3 failures -> lockout |
| **GUARDIS-1003** | Failover to backup IdP | Yes (3 attempts) | Alert security team |
| **GUARDIS-2001** | Request elevated permissions | No | Log for audit review |
| **GUARDIS-3001** | Verify path, check if deleted | No | N/A |
| **GUARDIS-4002** | Auto-rollback to previous version | Yes (1 attempt) | Alert on-call engineer |
| **GUARDIS-5001** | Retry with exponential backoff | Yes (5 attempts) | Page on-call after 2min |
| **GUARDIS-5002** | Trigger auto-unseal | Yes (via KMS) | Manual intervention if KMS fails |
| **GUARDIS-5003** | Wait for new election | Yes (10s timeout) | Force rejoin if stuck |
| **GUARDIS-5005** | Rotate KEK, retry decryption | Yes (1 attempt) | Critical alert |
| **GUARDIS-5007** | Wait and retry with backoff | Yes (with jitter) | Increase quota if persistent |

### 19.4 Circuit Breaker Configuration

```python
@dataclass
class CircuitBreakerConfig:
    """Circuit breaker settings for external dependencies."""
    failure_threshold: int = 5
    recovery_timeout: int = 30
    half_open_max_calls: int = 3
    timeout: int = 10

# Vault client: failure_threshold=5, recovery_timeout=30, half_open_max_calls=3, timeout=10
# Encryption engine: failure_threshold=3, recovery_timeout=60, half_open_max_calls=1, timeout=5
# Cache backend: failure_threshold=10, recovery_timeout=15, half_open_max_calls=5, timeout=2
```

---

## 20. Observability: Metrics, Tracing, Logging

### 20.1 Metrics (Prometheus)

```
# Request metrics
guardis_http_requests_total{method, path, status_code, org_id}
guardis_http_request_duration_seconds{method, path, quantile}
guardis_http_request_size_bytes{method, path, quantile}
guardis_http_response_size_bytes{method, path, quantile}

# Secret operations
guardis_secret_operations_total{operation, secret_type, org_id, result}
guardis_secret_operation_duration_seconds{operation, quantile}
guardis_secrets_active_total{org_id, secret_type, state}
guardis_secret_versions_total{org_id}

# Rotation metrics
guardis_rotation_operations_total{status, strategy, org_id}
guardis_rotation_duration_seconds{status, quantile}
guardis_rotation_canary_failures_total{org_id}
guardis_rotation_rollbacks_total{org_id}

# Cache metrics
guardis_cache_hits_total{cache_type}
guardis_cache_misses_total{cache_type}
guardis_cache_evictions_total{cache_type, reason}
guardis_cache_entries{cache_type}
guardis_cache_size_bytes{cache_type}

# Vault integration
guardis_vault_requests_total{operation, status}
guardis_vault_request_duration_seconds{operation, quantile}
guardis_vault_sealed{node_id}
guardis_vault_leader{node_id}
guardis_raft_commit_time_seconds{quantile}
guardis_raft_applied_index{node_id}

# Encryption metrics
guardis_encryption_operations_total{algorithm, operation}
guardis_encryption_duration_seconds{algorithm, quantile}
guardis_kek_rotation_total{kek_id}

# Audit metrics
guardis_audit_log_write_total{destination, status}
guardis_audit_log_write_duration_seconds{destination, quantile}
guardis_audit_log_entries_total{org_id}

# Rate limiting
guardis_rate_limit_requests_total{client_id, result}
guardis_rate_limit_tokens_remaining{client_id}

# System metrics
guardis_uptime_seconds
guardis_goroutines
guardis_memory_usage_bytes
guardis_gc_pause_seconds{quantile}
```

### 20.2 Distributed Tracing (OpenTelemetry)

```python
from opentelemetry import trace, metrics
from opentelemetry.trace import SpanKind
from opentelemetry.semconv.trace import SpanAttributes

tracer = trace.get_tracer("guardis")
meter = metrics.get_meter("guardis")

GUARDIS_ATTRIBUTES = {
    "guardis.org_id": "org/acme",
    "guardis.version": "2.0.0",
    "guardis.component": "agent",
}

async def trace_secret_operation(operation: str, secret_id: str, context):
    """Trace a secret operation with full context."""
    with tracer.start_as_current_span(
        f"guardis.secret.{operation}", kind=SpanKind.SERVER,
        attributes={**GUARDIS_ATTRIBUTES, "guardis.operation": operation,
            "guardis.secret_id": secret_id, "guardis.org_id": context.org_id,
            "guardis.principal_id": context.principal.id,
            SpanAttributes.HTTP_METHOD: context.method,
            SpanAttributes.HTTP_ROUTE: context.path,}
    ) as span:
        try:
            if context.traceparent:
                span.add_link(trace.Link(context.traceparent))
            result = await execute_operation(operation, secret_id, context)
            span.set_attribute("guardis.result", "success")
            span.set_attribute("guardis.cache_hit", result.cache_hit)
            span.set_attribute("guardis.vault_latency_ms", result.vault_latency_ms)
            return result
        except Exception as e:
            span.set_attribute("guardis.result", "error")
            span.set_attribute("guardis.error_code", e.code)
            span.set_status(trace.StatusCode.ERROR, str(e))
            raise
```

### 20.3 Structured Logging

```python
import structlog
logger = structlog.get_logger()

# Secret access
logger.info("secret_accessed", event="secret.read",
    secret_id="sec_01h8x9k2m3n4p5q6r7s8t9u0v",
    secret_path="org/acme/teams/engineering/projects/billing/stripe-api-key",
    principal_id="user_john_doe", principal_type="user",
    ip_address="10.0.1.50", include_value=True, cache_hit=False,
    vault_latency_ms=3.2, total_latency_ms=4.1, request_id="req_abc123def456")

# Rotation event
logger.info("rotation_completed", event="rotation.complete",
    rotation_id="rot_01h8x9k2m3n4p5q6r7s8t9u0v",
    secret_id="sec_01h8x9k2m3n4p5q6r7s8t9u0v",
    old_version=5, new_version=6, strategy="dual_version",
    canary_percentage=10, duration_ms=1250,
    principal_id="system_rotation_scheduler", principal_type="system")

# Error event
logger.error("vault_unavailable", event="vault.connection_failed",
    vault_addr="https://vault-0.vault-internal:8200",
    error="connection refused", retry_count=3,
    next_retry_in_ms=4000, circuit_breaker_state="half_open")
```

### 20.4 Dashboard Panels

| Dashboard | Panels | Refresh | Purpose |
|-----------|--------|---------|---------|
| **Overview** | Request rate, error rate, latency (RED), active secrets, cluster health | 10s | At-a-glance system health |
| **Secrets** | Operations by type, cache hit rate, version distribution, top accessed secrets | 30s | Secret usage patterns |
| **Rotation** | Active rotations, success/failure rate, canary metrics, rollback count | 30s | Rotation health |
| **Vault** | Raft commit time, leader status, node health, storage usage, seal status | 10s | Vault cluster health |
| **Security** | Failed auth attempts, policy denials, audit log volume, anomaly detections | 1min | Security monitoring |
| **Performance** | p50/p95/p99 latency by endpoint, throughput, cache efficiency, GC pauses | 10s | Performance tuning |
| **Capacity** | Storage usage, memory usage, connection pool, rate limit hits, quota usage | 5min | Capacity planning |

---

## 21. Deployment Patterns

### 21.1 High Availability Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HA DEPLOYMENT ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   REGION: us-east-1                                                          │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                    Load Balancer (ALB)                              │     │
│   │  vault.guardis.internal:8200                                       │     │
│   └───────────────────────────┬───────────────────────────────────────┘     │
│                               │                                             │
│              ┌────────────────┼────────────────┐                           │
│              ▼                ▼                ▼                           │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│   │  Vault-0    │  │  Vault-1    │  │  Vault-2    │                       │
│   │  (Leader)   │  │(Follower)   │  │(Follower)   │                       │
│   │  ┌────────┐ │  │  ┌────────┐ │  │  ┌────────┐ │                       │
│   │  │Guardis │ │  │  │Guardis │ │  │  │Guardis │ │                       │
│   │  │ Agent  │ │  │  │ Agent  │ │  │  │ Agent  │ │                       │
│   │  └────────┘ │  │  └────────┘ │  │  └────────┘ │                       │
│   └─────────────┘  └─────────────┘  └─────────────┘                       │
│                                                                              │
│   Storage: Raft integrated (each node has local encrypted storage)         │
│   Auto-unseal: AWS KMS                                                      │
│   Service mesh: mTLS between all components                                │
│                                                                              │
│   Resource Requirements (per node):                                         │
│   - CPU: 4 cores  - Memory: 8GB  - Storage: 100GB NVMe  - Network: 1Gbps  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 21.2 Single-Node Deployment (Development)

```yaml
# docker-compose.yml - Single-node development deployment
version: "3.8"
services:
  vault:
    image: hashicorp/vault:1.16
    container_name: guardis-vault
    ports: ["8200:8200"]
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: "dev-token"
      VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
    cap_add: [IPC_LOCK]
    volumes: [vault-data:/vault/data]

  guardis-agent:
    image: guardis/agent:latest
    container_name: guardis-agent
    ports: ["8080:8080", "8081:8081"]
    environment:
      GUARDIS_VAULT_ADDR: "http://vault:8200"
      GUARDIS_VAULT_TOKEN: "dev-token"
      GUARDIS_LOG_LEVEL: "debug"
    depends_on: [vault]

  postgres:
    image: postgres:16
    container_name: guardis-postgres
    environment:
      POSTGRES_DB: guardis
      POSTGRES_USER: guardis
      POSTGRES_PASSWORD: dev-password
    ports: ["5432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    container_name: guardis-redis
    ports: ["6379:6379"]

volumes:
  vault-data:
  postgres-data:
```

### 21.3 Sidecar Deployment (Kubernetes)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-gateway
  namespace: production
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "api-gateway"
    vault.hashicorp.com/agent-inject-secret-db-credentials: "org/acme/services/database/credentials/primary"
    vault.hashicorp.com/agent-inject-template-db-credentials: |
      {{- with secret "org/acme/services/database/credentials/primary" -}}
      DB_HOST={{ .Data.data.host }}
      DB_PORT={{ .Data.data.port }}
      DB_USER={{ .Data.data.username }}
      DB_PASS={{ .Data.data.password }}
      {{- end }}
    vault.hashicorp.com/agent-cache-enable: "true"
    vault.hashicorp.com/agent-cache-ttl: "5m"
spec:
  serviceAccountName: api-gateway
  containers:
    - name: api-gateway
      image: acme/api-gateway:v2.0.0
      ports: [containerPort: 8080]
      env:
        - name: DB_CONFIG_PATH
          value: "/vault/secrets/db-credentials"
      resources:
        requests: {memory: "512Mi", cpu: "500m"}
        limits: {memory: "1Gi", cpu: "1000m"}
```

### 21.4 Deployment Comparison

| Aspect | HA (Production) | Single-Node (Dev) | Sidecar (K8s) |
|--------|----------------|-------------------|---------------|
| **Nodes** | 3-5 Vault + 3 Guardis | 1 Vault + 1 Guardis | Per-pod sidecar |
| **Storage** | Raft (distributed) | File (local) | Vault cluster |
| **Availability** | 99.9% | Best effort | Depends on Vault |
| **RTO** | < 5 minutes | N/A (recreate) | < 1 minute |
| **RPO** | < 5 minutes | N/A | < 5 minutes |
| **Cost/month** | ~$2,500 | ~$50 | ~$10/pod |
| **Complexity** | High | Low | Medium |
| **Use case** | Production | Development | K8s workloads |

---

## 22. Migration Guide from Existing Secret Managers

### 22.1 Migration Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIGRATION STRATEGY                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1: Assessment (Week 1-2)                                            │
│   1. Inventory all existing secrets across systems                          │
│   2. Classify by type, sensitivity, and usage                               │
│   3. Map current access patterns                                             │
│   4. Identify dependencies and consumers                                    │
│   5. Document rotation policies (or lack thereof)                           │
│   Deliverable: Secret inventory spreadsheet + dependency graph              │
│                                                                              │
│   Phase 2: Infrastructure Setup (Week 3-4)                                  │
│   1. Deploy Guardis cluster (HA, 3+ nodes)                                  │
│   2. Configure namespaces for each organization/team                         │
│   3. Set up IAM integration (Okta, Azure AD, etc.)                          │
│   4. Configure audit logging pipeline                                        │
│   5. Deploy Guardis SDKs to application repos                                │
│   Deliverable: Production-ready Guardis deployment                           │
│                                                                              │
│   Phase 3: Parallel Run (Week 5-8)                                          │
│   1. Migrate non-critical secrets first (dev/staging)                       │
│   2. Run both old and new systems in parallel                               │
│   3. Validate secret access from all consumers                               │
│   4. Monitor for access failures or latency issues                          │
│   5. Gradually migrate production secrets (by service)                      │
│   Deliverable: All secrets accessible via Guardis, old system as fallback    │
│                                                                              │
│   Phase 4: Cutover (Week 9-10)                                              │
│   1. Switch all consumers to Guardis                                         │
│   2. Monitor for 48 hours                                                    │
│   3. Decommission old secret manager                                         │
│   4. Archive old system's audit logs                                        │
│   5. Enable automatic rotation for all migrated secrets                     │
│   Deliverable: Guardis as sole secret manager                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 22.2 Source-Specific Migration Scripts

```python
# Migration from HashiCorp Vault to Guardis
import asyncio
import hvac
from guardis import Client

async def migrate_from_vault(source_vault_addr: str, source_token: str,
                              guardis_client: Client, path_mapping: dict = None):
    """Migrate secrets from HashiCorp Vault to Guardis."""
    source_client = hvac.Client(url=source_vault_addr, token=source_token)
    paths = source_client.secrets.kv.v2.list_secrets(path="", mount_point="secret")["data"]["keys"]

    migrated = 0
    errors = 0
    for path in paths:
        try:
            secret = source_client.secrets.kv.v2.read_secret_version(path=path, mount_point="secret")
            dest_path = path
            if path_mapping:
                for old_prefix, new_prefix in path_mapping.items():
                    if path.startswith(old_prefix):
                        dest_path = path.replace(old_prefix, new_prefix, 1)

            await guardis_client.secrets.create(
                name=path.split("/")[-1], path="/".join(dest_path.split("/")[:-1]),
                value=secret["data"]["data"], secret_type="generic_secret",
                labels={"migrated_from": "vault", "migrated_at": datetime.utcnow().isoformat(),
                        "original_path": path})
            migrated += 1
            print(f"Migrated: {path} -> {dest_path}")
        except Exception as e:
            errors += 1
            print(f"Error migrating {path}: {e}")
    print(f"Migration complete: {migrated} migrated, {errors} errors")


# Migration from AWS Secrets Manager
async def migrate_from_aws_secrets_manager(aws_region: str, guardis_client: Client,
                                            secret_filter: str = None):
    """Migrate secrets from AWS Secrets Manager to Guardis."""
    import boto3
    client = boto3.client("secretsmanager", region_name=aws_region)
    paginator = client.get_paginator("list_secrets")
    all_secrets = []
    for page in paginator.paginate():
        all_secrets.extend(page["SecretList"])
    if secret_filter:
        all_secrets = [s for s in all_secrets if secret_filter in s["Name"]]

    migrated = 0
    for secret in all_secrets:
        try:
            response = client.get_secret_value(SecretId=secret["Name"])
            secret_value = response.get("SecretString") or response.get("SecretBinary")
            import json
            try:
                value = json.loads(secret_value)
            except (json.JSONDecodeError, TypeError):
                value = secret_value

            await guardis_client.secrets.create(
                name=secret["Name"].split("/")[-1],
                path=f"org/acme/migrated/aws/{'/'.join(secret['Name'].split('/')[:-1])}",
                value=value, secret_type="generic_secret",
                labels={"migrated_from": "aws-secrets-manager", "aws_region": aws_region,
                        "aws_arn": secret["ARN"]})
            migrated += 1
        except Exception as e:
            print(f"Error migrating {secret['Name']}: {e}")
    print(f"AWS migration complete: {migrated} secrets migrated")


# Migration from Doppler
async def migrate_from_doppler(doppler_token: str, project: str, config: str,
                                guardis_client: Client):
    """Migrate secrets from Doppler to Guardis."""
    import httpx
    headers = {"Accept": "application/json", "Authorization": f"Bearer {doppler_token}"}
    async with httpx.AsyncClient() as http:
        response = await http.get(
            f"https://api.doppler.com/v3/configs/config/secrets/download",
            headers=headers, params={"project": project, "config": config, "format": "json"})
        secrets = response.json()
        for name, value in secrets.items():
            await guardis_client.secrets.create(
                name=name, path=f"org/acme/migrated/doppler/{project}/{config}",
                value=value, secret_type="generic_secret",
                labels={"migrated_from": "doppler", "doppler_project": project,
                        "doppler_config": config})
    print(f"Doppler migration complete: {len(secrets)} secrets migrated")
```

### 22.3 Migration Validation Checklist

| Check | Command | Expected Result |
|-------|---------|----------------|
| **Secret count** | `guardis secrets count --org acme` | Matches source system count |
| **Value integrity** | `guardis secrets verify --sample 100` | 100% match |
| **Access patterns** | `guardis audit query --days 7` | All consumers can read |
| **Rotation policies** | `guardis rotation list --org acme` | Policies applied correctly |
| **Namespace isolation** | `guardis policy test --cross-namespace` | Cross-namespace denied |
| **Audit logging** | `guardis audit verify` | Hash chain intact |
| **Performance** | `guardis benchmark --duration 60s` | Latency within targets |
| **Failover** | `guardis dr test --simulate-failure` | RTO < 5 min, RPO < 5 min |

---

## 23. Appendix: Complete Type Definitions

### 23.1 Core Types

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from enum import Enum
from pydantic import BaseModel, Field, SecretStr

class SecretType(str, Enum):
    API_KEY = "api_key"
    DATABASE_PASSWORD = "database_password"
    TLS_CERTIFICATE = "tls_certificate"
    OAUTH_TOKEN = "oauth_token"
    SSH_KEY = "ssh_key"
    ENCRYPTION_KEY = "encryption_key"
    GENERIC_SECRET = "generic_secret"
    DYNAMIC = "dynamic"

class SecretState(str, Enum):
    DRAFT = "draft"
    INACTIVE = "inactive"
    ACTIVE = "active"
    CANARY = "canary"
    DEPRECATING = "deprecating"
    DEPRECATED = "deprecated"
    DELETED = "deleted"
    PURGED = "purged"
    ROTATING = "rotating"
    FAILED = "failed"

class RotationStrategy(str, Enum):
    DUAL_VERSION = "dual_version"
    IMMEDIATE = "immediate"
    MANUAL = "manual"

class EncryptionAlgorithm(str, Enum):
    AES_256_GCM = "aes-256-gcm"
    CHACHA20_POLY1305 = "chacha20-poly1305"

class AuthMethod(str, Enum):
    KUBERNETES = "kubernetes"
    APPROLE = "approle"
    OIDC = "oidc"
    TLS_CERT = "tls_cert"
    TOKEN = "token"
    AWS_IAM = "aws_iam"
    AZURE_AD = "azure_ad"

class Capability(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"
    DENY = "deny"

class PrincipalType(str, Enum):
    USER = "user"
    SERVICE = "service"
    TOKEN = "token"
    SYSTEM = "system"

class ResourceType(str, Enum):
    SECRET = "secret"
    POLICY = "policy"
    NAMESPACE = "namespace"
    TOKEN = "token"

class AuditAction(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    ROTATE = "rotate"
    LIST = "list"
    RESTORE = "restore"
    DESTROY = "destroy"

class RotationState(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    CANARY = "canary"
    COMPLETE = "complete"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"

class ErrorCode(str, Enum):
    # Authentication (1xxx)
    INVALID_TOKEN = "GUARDIS-1001"
    TOKEN_REVOKED = "GUARDIS-1002"
    AUTH_PROVIDER_DOWN = "GUARDIS-1003"
    MFA_REQUIRED = "GUARDIS-1004"
    MFA_FAILED = "GUARDIS-1005"
    SESSION_EXPIRED = "GUARDIS-1006"
    # Authorization (2xxx)
    ACCESS_DENIED = "GUARDIS-2001"
    PATH_NOT_ALLOWED = "GUARDIS-2002"
    NAMESPACE_ISOLATED = "GUARDIS-2003"
    POLICY_EVAL_ERROR = "GUARDIS-2004"
    QUOTA_EXCEEDED = "GUARDIS-2005"
    # Secret Operations (3xxx)
    SECRET_NOT_FOUND = "GUARDIS-3001"
    SECRET_ALREADY_EXISTS = "GUARDIS-3002"
    VERSION_NOT_FOUND = "GUARDIS-3003"
    SECRET_DELETED = "GUARDIS-3004"
    SECRET_EXPIRED = "GUARDIS-3005"
    SECRET_TOO_LARGE = "GUARDIS-3006"
    INVALID_SECRET_TYPE = "GUARDIS-3007"
    SCHEMA_VALIDATION = "GUARDIS-3008"
    # Rotation (4xxx)
    ROTATION_IN_PROGRESS = "GUARDIS-4001"
    ROTATION_FAILED = "GUARDIS-4002"
    ROTATION_TIMEOUT = "GUARDIS-4003"
    ROLLBACK_FAILED = "GUARDIS-4004"
    CANNOT_ROTATE = "GUARDIS-4005"
    # Infrastructure (5xxx)
    VAULT_UNAVAILABLE = "GUARDIS-5001"
    VAULT_SEALED = "GUARDIS-5002"
    RAFT_NO_LEADER = "GUARDIS-5003"
    STORAGE_FULL = "GUARDIS-5004"
    ENCRYPTION_ERROR = "GUARDIS-5005"
    CACHE_UNAVAILABLE = "GUARDIS-5006"
    RATE_LIMITED = "GUARDIS-5007"
```

### 23.2 Data Models

```python
@dataclass
class Organization:
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any] = field(default_factory=dict)
    default_rotation_policy: Optional["RotationPolicy"] = None
    audit_retention_days: int = 90
    max_secrets: int = 50000

@dataclass
class Team:
    id: str
    org_id: str
    name: str
    created_at: datetime
    member_count: int = 0
    namespace: str = ""
    quota_secrets: int = 1000
    quota_api_calls_per_min: int = 1000

@dataclass
class SecretMetadata:
    id: str
    name: str
    path: str
    secret_type: SecretType
    org_id: str
    team_id: Optional[str] = None
    project_id: Optional[str] = None
    state: SecretState = SecretState.DRAFT
    current_version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    rotated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    rotation_policy: Optional["RotationPolicy"] = None
    allowed_teams: List[str] = field(default_factory=list)
    allowed_services: List[str] = field(default_factory=list)
    labels: Dict[str, str] = field(default_factory=dict)
    description: Optional[str] = None
    vault_path: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

@dataclass
class SecretVersion:
    version: int
    secret_id: str
    encrypted_value: str
    encryption_key_id: str
    encryption_algorithm: EncryptionAlgorithm
    kek_version: int
    state: SecretState
    created_at: datetime
    created_by: str
    not_before: Optional[datetime] = None
    deprecated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    certificate_metadata: Optional["CertificateMetadata"] = None

@dataclass
class RotationPolicy:
    policy_id: str
    secret_type: SecretType
    rotation_period_days: int = 30
    grace_period_days: int = 7
    auto_rotate: bool = True
    rotation_strategy: RotationStrategy = RotationStrategy.DUAL_VERSION
    canary_percentage: int = 10
    canary_duration_minutes: int = 60
    notify_before_days: List[int] = field(default_factory=lambda: [30, 7, 1])
    notify_channels: List[str] = field(default_factory=list)

@dataclass
class CertificateMetadata:
    subject: str
    issuer: str
    serial_number: str
    not_before: datetime
    not_after: datetime
    sans: List[str] = field(default_factory=list)
    key_algorithm: str
    signature_algorithm: str

@dataclass
class AuditLogEntry:
    id: str
    timestamp: datetime
    version: int = 2
    principal_type: PrincipalType
    principal_id: str
    principal_name: str
    ip_address: str
    user_agent: Optional[str] = None
    action: AuditAction
    resource_type: ResourceType
    resource_path: str
    resource_id: Optional[str] = None
    success: bool
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None
    request_id: str
    session_id: Optional[str] = None
    method: str
    response_status: int
    response_time_ms: int
    secret_version_accessed: Optional[int] = None
    include_value_requested: bool = False
    previous_hash: str = ""
    entry_hash: str = ""
    merkle_root: Optional[str] = None
    compliance_tags: List[str] = field(default_factory=list)
    data_classification: str = "confidential"

@dataclass
class Lease:
    lease_id: str
    secret_path: str
    ttl_seconds: int
    issue_time: datetime
    expire_time: datetime
    renewable: bool
    max_ttl_seconds: int
    data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RotationStatus:
    rotation_id: str
    secret_id: str
    state: RotationState
    old_version: int
    new_version: int
    strategy: RotationStrategy
    canary_percentage: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    progress_percentage: int = 0

@dataclass
class EncryptionEnvelope:
    encrypted_data: str
    key_id: str
    algorithm: EncryptionAlgorithm
    kek_version: int
    nonce: str
    created_at: datetime

@dataclass
class RequestContext:
    token: str
    org_id: str
    team_id: Optional[str] = None
    principal: Optional[Any] = None
    method: str = ""
    path: str = ""
    traceparent: Optional[str] = None
    kek_version: int = 1

@dataclass
class HealthResponse:
    status: str
    vault_sealed: bool
    vault_leader: bool
    cache_healthy: bool
    database_healthy: bool
    uptime_seconds: float
    version: str
    timestamp: datetime

@dataclass
class SystemStatus:
    cluster_size: int
    leader_node: str
    applied_index: int
    committed_index: int
    secrets_count: int
    active_leases: int
    cache_hit_rate: float
    avg_latency_ms: float
    error_rate: float
    uptime_seconds: float
```

### 23.3 API Request/Response Models

```python
class CreateSecretRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, pattern=r"^[a-z0-9-_]+$")
    value: SecretStr
    secret_type: SecretType = SecretType.GENERIC_SECRET
    path: Optional[str] = None
    rotation_policy: Optional[RotationPolicy] = None
    expires_at: Optional[datetime] = None
    labels: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None

class GetSecretResponse(BaseModel):
    metadata: SecretMetadata
    value: Optional[SecretStr] = None
    version: Optional[SecretVersion] = None
    lease_duration: Optional[int] = None

class ListSecretsResponse(BaseModel):
    secrets: List[SecretMetadata]
    total: int
    page: int
    page_size: int
    has_more: bool

class RotateSecretRequest(BaseModel):
    secret_id: str
    strategy: RotationStrategy = RotationStrategy.DUAL_VERSION
    canary_percentage: Optional[int] = None
    grace_period_days: Optional[int] = None

class RotateSecretResponse(BaseModel):
    rotation_id: str
    new_version: int
    old_version: int
    status: str
    estimated_completion: datetime

class SecretMetadataUpdate(BaseModel):
    rotation_policy: Optional[RotationPolicy] = None
    labels: Optional[Dict[str, str]] = None
    description: Optional[str] = None
    expires_at: Optional[datetime] = None

class AuditLogQuery(BaseModel):
    start_time: datetime
    end_time: datetime
    principal_id: Optional[str] = None
    principal_type: Optional[PrincipalType] = None
    action: Optional[List[AuditAction]] = None
    resource_path: Optional[str] = None
    success: Optional[bool] = None
    page: int = 1
    page_size: int = 100

class AuditLogResponse(BaseModel):
    logs: List[AuditLogEntry]
    total: int
    page: int
    page_size: int
    has_more: bool

class VerificationResult(BaseModel):
    verified: bool
    total_entries: int
    verified_entries: int
    first_failure: Optional[int] = None
    first_failure_hash: Optional[str] = None
    last_verified_index: int
    last_merkle_root: Optional[str] = None
```

---

## 24. Appendix: Benchmark Methodology

### 24.1 Test Environment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BENCHMARK ENVIRONMENT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Hardware:                                                                 │
│   - CPU: AMD EPYC 7763 (64 cores, 128 threads)                             │
│   - Memory: 512GB DDR4-3200 ECC                                            │
│   - Storage: 2x 2TB NVMe SSD (RAID 1)                                      │
│   - Network: 25Gbps Ethernet                                                │
│                                                                              │
│   Software:                                                                 │
│   - OS: Ubuntu 24.04 LTS (Kernel 6.8)                                      │
│   - Vault: 1.16.0 (Enterprise)                                             │
│   - Guardis Agent: 2.0.0 (Rust)                                            │
│   - PostgreSQL: 16.2                                                       │
│   - Redis: 7.2.4                                                           │
│                                                                              │
│   Network:                                                                  │
│   - Client -> Guardis: <1ms (same rack)                                    │
│   - Guardis -> Vault: <1ms (same rack)                                     │
│   - Guardis -> Redis: <0.5ms (same rack)                                   │
│   - Guardis -> PostgreSQL: <1ms (same rack)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 24.2 Benchmark Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **wrk2** | HTTP load testing | `wrk2 -t12 -c400 -d60s -R10000 https://guardis/v2/secrets` |
| **ghz** | gRPC load testing | `ghz --insecure --proto guardis.proto --call guardis.v2.SecretService.ListSecrets -c 100 -n 10000` |
| **hyperfine** | CLI benchmarking | `hyperfine -w 3 -r 10 'guardis secrets list --org acme'` |
| **fio** | Storage IOPS | `fio --name=randread --ioengine=io_uring --rw=randread --bs=4k --numjobs=4` |
| **memtier** | Redis benchmarking | `memtier_benchmark -s redis.guardis -p 6379 --ratio 1:10 --pipeline 10` |
| **pgbench** | PostgreSQL benchmarking | `pgbench -c 50 -j 4 -T 60 guardis` |

### 24.3 Benchmark Scenarios

```python
# Benchmark scenario definitions

SCENARIOS = {
    "read_metadata": {
        "description": "Read secret metadata (cache hit)",
        "method": "GET",
        "endpoint": "/v2/secrets/{id}",
        "params": {"include_value": "false"},
        "concurrent_users": [1, 10, 50, 100, 500, 1000],
        "duration_seconds": 60,
        "target_metrics": {
            "p50_latency_ms": 3,
            "p99_latency_ms": 10,
            "throughput_rps": 20000,
        }
    },
    "read_with_value": {
        "description": "Read secret with decrypted value",
        "method": "GET",
        "endpoint": "/v2/secrets/{id}",
        "params": {"include_value": "true"},
        "concurrent_users": [1, 10, 50, 100, 500],
        "duration_seconds": 60,
        "target_metrics": {
            "p50_latency_ms": 8,
            "p99_latency_ms": 25,
            "throughput_rps": 10000,
        }
    },
    "create_secret": {
        "description": "Create new secret with encryption",
        "method": "POST",
        "endpoint": "/v2/secrets",
        "concurrent_users": [1, 10, 50, 100],
        "duration_seconds": 60,
        "target_metrics": {
            "p50_latency_ms": 15,
            "p99_latency_ms": 50,
            "throughput_rps": 5000,
        }
    },
    "rotate_secret": {
        "description": "Initiate secret rotation",
        "method": "POST",
        "endpoint": "/v2/secrets/{id}/rotate",
        "concurrent_users": [1, 5, 10, 25],
        "duration_seconds": 120,
        "target_metrics": {
            "p50_latency_ms": 50,
            "p99_latency_ms": 200,
            "throughput_rps": 500,
        }
    },
    "list_secrets": {
        "description": "List secrets with pagination",
        "method": "GET",
        "endpoint": "/v2/secrets",
        "params": {"page_size": "20", "org_id": "acme"},
        "concurrent_users": [1, 10, 50, 100],
        "duration_seconds": 60,
        "target_metrics": {
            "p50_latency_ms": 20,
            "p99_latency_ms": 80,
            "throughput_rps": 3000,
        }
    },
    "audit_query": {
        "description": "Query audit logs with filters",
        "method": "GET",
        "endpoint": "/v2/audit/logs",
        "params": {"start_time": "2026-04-01T00:00:00Z", "end_time": "2026-04-04T00:00:00Z"},
        "concurrent_users": [1, 5, 10],
        "duration_seconds": 60,
        "target_metrics": {
            "p50_latency_ms": 50,
            "p99_latency_ms": 200,
            "throughput_rps": 1000,
        }
    },
}
```

### 24.4 Benchmark Results (Expected)

| Scenario | Concurrent Users | p50 Latency | p99 Latency | Throughput | Error Rate |
|----------|-----------------|-------------|-------------|------------|------------|
| **Read metadata** | 1 | 1ms | 3ms | 1,000 rps | 0% |
| **Read metadata** | 100 | 2ms | 8ms | 15,000 rps | 0% |
| **Read metadata** | 1000 | 5ms | 15ms | 20,000 rps | 0.01% |
| **Read with value** | 1 | 3ms | 8ms | 500 rps | 0% |
| **Read with value** | 100 | 5ms | 18ms | 8,000 rps | 0% |
| **Read with value** | 500 | 8ms | 30ms | 10,000 rps | 0.02% |
| **Create secret** | 1 | 10ms | 25ms | 200 rps | 0% |
| **Create secret** | 100 | 15ms | 45ms | 4,000 rps | 0% |
| **Create secret** | 500 | 25ms | 80ms | 5,000 rps | 0.1% |
| **Rotate secret** | 1 | 30ms | 80ms | 50 rps | 0% |
| **Rotate secret** | 10 | 50ms | 150ms | 400 rps | 0% |
| **List secrets** | 1 | 10ms | 25ms | 500 rps | 0% |
| **List secrets** | 100 | 20ms | 60ms | 2,500 rps | 0% |
| **Audit query** | 1 | 30ms | 80ms | 100 rps | 0% |
| **Audit query** | 10 | 50ms | 150ms | 800 rps | 0% |

### 24.5 Benchmark Execution Script

```bash
#!/bin/bash
# benchmark.sh - Guardis benchmark execution

set -euo pipefail

GUARDIS_URL="${GUARDIS_URL:-http://localhost:8080}"
TOKEN="${GUARDIS_TOKEN:-dev-token}"
DURATION="${DURATION:-60}"
RESULTS_DIR="./benchmark-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== Guardis Benchmark Suite ==="
echo "URL: $GUARDIS_URL"
echo "Duration: ${DURATION}s"
echo "Results: $RESULTS_DIR"

# Read metadata benchmark
echo ""
echo "--- Read Metadata Benchmark ---"
for users in 1 10 50 100 500 1000; do
    echo "  Concurrent users: $users"
    wrk2 -t4 -c$users -d${DURATION}s -R$((users * 100)) \
        -H "Authorization: Bearer $TOKEN" \
        -s scripts/read_metadata.lua \
        "$GUARDIS_URL/v2/secrets/sec_benchmark_001" \
        > "$RESULTS_DIR/read_metadata_${users}users.txt" 2>&1
done

# Create secret benchmark
echo ""
echo "--- Create Secret Benchmark ---"
for users in 1 10 50 100; do
    echo "  Concurrent users: $users"
    wrk2 -t4 -c$users -d${DURATION}s -R$((users * 50)) \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -s scripts/create_secret.lua \
        "$GUARDIS_URL/v2/secrets" \
        > "$RESULTS_DIR/create_secret_${users}users.txt" 2>&1
done

# Generate summary report
echo ""
echo "--- Generating Summary ---"
python3 scripts/generate_report.py "$RESULTS_DIR" > "$RESULTS_DIR/summary.md"
echo "Results saved to $RESULTS_DIR"
```

---

## 25. Additional References

### 25.1 Internal References

| Document | Location | Purpose |
|----------|----------|---------|
| ADR-001: Storage Backend | `docs/adr/ADR-001-secrets-storage.md` | Storage backend decision |
| ADR-002: Encryption Strategy | `docs/adr/ADR-002-encryption-strategy.md` | Encryption approach |
| ADR-003: Rotation Policy | `docs/adr/ADR-003-rotation-policy.md` | Rotation strategy |
| SOTA Research | `docs/research/SECRETS_MANAGEMENT_SOTA.md` | Market analysis |
| SOTA Summary | `docs/research/SOTA.md` | Technology landscape |

### 25.2 External References

| Resource | URL | Description |
|----------|-----|-------------|
| HashiCorp Vault | https://www.vaultproject.io/ | Core storage technology |
| Vault Raft Storage | https://developer.hashicorp.com/vault/docs/configuration/storage/raft | Raft backend docs |
| Raft Paper | https://raft.github.io/raft.pdf | Ongaro & Ousterhout (2014) |
| AES-GCM Standard | https://csrc.nist.gov/publications/detail/sp/800-38d/final | NIST specification |
| TLS 1.3 RFC | https://tools.ietf.org/html/rfc8446 | Transport security |
| OpenTelemetry | https://opentelemetry.io/ | Observability framework |
| Prometheus | https://prometheus.io/ | Metrics collection |
| SOC 2 Trust Criteria | https://www.aicpa.org/soc | Compliance framework |
| PCI DSS | https://www.pcisecuritystandards.org/ | Payment security |
| Kubernetes External Secrets | https://external-secrets.io/ | K8s integration |
| SPIFFE/SPIRE | https://spiffe.io/ | Workload identity |
| NIST 800-57 | https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final | Key management |

### 25.3 Glossary

| Term | Definition |
|------|------------|
| **DEK** | Data Encryption Key - Encrypts actual secret data |
| **KEK** | Key Encryption Key - Encrypts DEKs, stored in HSM/Vault |
| **Envelope Encryption** | Using DEKs for data, KEKs for DEKs |
| **Dynamic Secret** | On-demand generated credentials with TTL |
| **mTLS** | Mutual TLS - Both client and server authenticate |
| **Canary Deployment** | Gradual rollout to subset of traffic |
| **RBAC** | Role-Based Access Control |
| **ABAC** | Attribute-Based Access Control |
| **SPIFFE** | Secure Production Identity Framework For Everyone |
| **HSM** | Hardware Security Module |
| **WORM** | Write Once Read Many - Immutable storage |
| **RPO** | Recovery Point Objective - Max data loss tolerance |
| **RTO** | Recovery Time Objective - Max downtime tolerance |
| **Raft** | Consensus algorithm for distributed systems |
| **KV v2** | Vault Key-Value store version 2 (versioned secrets) |
| **CAS** | Check-And-Set - Optimistic concurrency control |



### 25.4 Related Phenotype Projects

| Project | Relationship | Integration Point |
|---------|-------------|-------------------|
| **Authvault** | Complementary auth system | Shared token validation |
| **Tokn** | Token lifecycle management | Token issuance and revocation |
| **Keyra** | Key management service | KEK provisioning |
| **HexaKit** | Template scaffolding | Guardis project templates |
| **AgilePlus** | Project management | Delivery tracking |
| **PhenoSpecs** | Specifications registry | ADR storage |

### 25.5 Further Reading

- [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf) - Ongaro & Ousterhout, 2014
- [Secrets Management at Scale](https://aws.amazon.com/blogs/security/secrets-management-at-scale/) - AWS Security Blog
- [The Evolution of Secrets Management](https://www.hashicorp.com/resources/evolution-of-secrets-management) - HashiCorp
- [NIST SP 800-57 Part 1 Rev 5](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Key Management Guidelines
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final) - NIST SP 800-207

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Document ID** | GUARDIS-SPEC-001 |
| **Version** | 3.0.0 |
| **Status** | Active |
| **Last Updated** | 2026-04-04 |
| **Author** | Guardis Architecture Team |
| **Reviewers** | Security Team, Platform Engineering |
| **Classification** | Internal |
| **Total Sections** | 25 |
| **ADRs** | 3 (storage-backend, encryption-strategy, rotation-policy) |
| **SOTA Docs** | 2 (SECRETS_MANAGEMENT_SOTA.md, SOTA.md) |

---

*End of Specification*
