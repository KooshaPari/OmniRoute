# thegent-sharecli — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `thegent-sharecli/` — **ARCHIVED**
**Status:** Historical — Python hexagonal-architecture prototype for CLI sharing

---

## 1. Overview

`thegent-sharecli` was a **Python prototype** exploring CLI share/directory functionality for multi-agent orchestration within the Phenotype agent ecosystem. It implemented command deduplication, a Maildir-style task queue, smart merge coordination, request coalescing (Singleflight pattern), and distributed coordination via HLC (Hybrid Logical Clocks), OCC (Optimistic Concurrency Control), and leases.

The project followed **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** layers, applying DDD, CQRS, and EDA principles. It is now **archived** — the active Rust implementation of process management lives in the separate `sharecli` repo, which shares only the naming convention.

## 2. Repository Structure

```
thegent-sharecli/
├── src/
│   └── thegent_cli_share/
│       ├── __init__.py         # Package root + full public API exports
│       ├── cli.py              # Typer CLI interface (6 commands)
│       ├── config.py           # Configuration constants
│       │
│       ├── domain/             # Pure business logic (hexagonal core)
│       │   ├── __init__.py
│       │   ├── entities.py     # CommandLock, TaskQueueItem, MergeCandidate, CoordinationState, EditIntent
│       │   ├── value_objects.py# CommandHash, TaskMetadata, MergeConflict, LockStatus, QueuePriority, MergeStrategy, HealthScore
│       │   └── events.py       # CliShareEvent, TaskEvent, MergeEvent, CoordinationEvent (9 event types)
│       │
│       ├── application/        # Use cases (CQRS)
│       │   ├── __init__.py
│       │   ├── commands.py     # AcquireLockCommand, ReleaseLockCommand, EnqueueTaskCommand, MergeCommand
│       │   └── queries.py      # GetLockQuery, ListLocksQuery, GetQueueDepthQuery, GetMergeCandidatesQuery
│       │
│       ├── adapters/           # I/O implementations
│       │   ├── __init__.py
│       │   ├── dedup.py        # InMemoryLockAdapter (48 lines)
│       │   └── queue.py        # InMemoryQueueAdapter (58 lines)
│       │
│       └── ports/              # Driven port interfaces
│           └── driven.py       # LockPort, QueuePort, MergePort, CoordinationPort protocols
│
├── tests/
├── docs/
├── pyproject.toml
├── README.md
├── AGENTS.md
├── SPEC.md
├── CONFIG.md
├── PLAN.md
├── GEMINI.md
├── TEST_COVERAGE_MATRIX.md
├── CHANGELOG.md
├── CLAUDE.md
└── SECURITY.md
```

## 3. Architecture — Hexagonal (Ports & Adapters) + Clean Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     CLI (typer)                              │
│  lock-acquire | lock-release | lock-list | queue-enqueue    │
│  queue-list | version                                      │
├────────────────────────────────────────────────────────────┤
│                   Application Layer                         │
│  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │     Commands           │  │      Queries              │  │
│  │  AcquireLockCommand    │  │  GetLockQuery             │  │
│  │  ReleaseLockCommand    │  │  ListLocksQuery           │  │
│  │  EnqueueTaskCommand    │  │  GetQueueDepthQuery       │  │
│  │  MergeCommand          │  │  GetMergeCandidatesQuery  │  │
│  └────────────────────────┘  └──────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│                    Domain Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Entities │ │Value Objs│ │ Events   │ │ Ports (iface)│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
├────────────────────────────────────────────────────────────┤
│                   Adapter Layer                              │
│  ┌─────────────────────┐  ┌──────────────────────────┐    │
│  │ InMemoryLockAdapter │  │  InMemoryQueueAdapter     │    │
│  └─────────────────────┘  └──────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

## 4. Domain Model

### Entities (with identity)
| Entity | Description | Key Fields |
|--------|-------------|------------|
| `CommandLock` | Lock for command deduplication | cmd_hash, pid, status, timeout_seconds |
| `TaskQueueItem` | Maildir-style task queue item | id (UUID), command, priority, status |
| `MergeCandidate` | Smart merge candidate | base/their/our commits, strategy, conflict_count |
| `CoordinationState` | Distributed coordination state | resource_id, owner_id, lease, version, hlc_timestamp |
| `EditIntent` | File edit coordination between agents | agent_id, file_path, start/end lines |

### Value Objects (immutable)
| Value Object | Purpose |
|-------------|---------|
| `CommandHash` | Unique command hash for deduplication |
| `TaskMetadata` | Task context (command, cwd, env, timeout) |
| `MergeConflict` | File conflict range + both sides' content |
| `LockStatus` | Acquired/released with TTL and expiration |
| `QueuePriority` | Priority levels (high, normal, low) |
| `MergeStrategy` | Strategy types (auto, ours, theirs, manual) |
| `HealthScore` | Multi-component health scoring |

### Domain Events (immutable facts)
| Event Type | Trigger |
|-----------|---------|
| `lock_acquired` / `lock_released` / `lock_completed` / `lock_timeout` | Lock lifecycle |
| `task_enqueued` / `task_started` / `task_completed` / `task_failed` | Queue lifecycle |
| `merge_started` / `merge_completed` / `merge_conflict` | Merge lifecycle |
| `coord_lease_acquired` / `coord_lease_released` | Coordination lifecycle |

## 5. Port Interfaces (Driven Ports)

| Port | Purpose | Methods |
|------|---------|---------|
| `LockPort` | Command lock operations | acquire, release, get, list_all |
| `QueuePort` | Task queue operations | enqueue, dequeue, peek, length, clear, list_all |
| `MergePort` | Merge conflict operations | find_conflicts, merge, apply_resolution |
| `CoordinationPort` | Distributed coordination | acquire_lease, release_lease, check_lease |

## 6. CLI Commands

| Command | Description |
|---------|-------------|
| `lock-acquire <cmd_hash>` | Acquire a command lock (with optional --pid, --output-path) |
| `lock-release <cmd_hash>` | Release a command lock (requires --pid) |
| `lock-list` | List all active locks |
| `queue-enqueue <command>` | Enqueue a task (with optional --priority) |
| `queue-list` | List all queued tasks |
| `version` | Show version |

## 7. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| watchfiles | >=0.21 | File watching for merge coordination |
| pydantic | >=2.0 | Domain entity validation (BaseModel) |
| rich | >=13 | Terminal output formatting (tables) |
| typer | >=0.9 | CLI interface |
| pytest, pytest-cov, ruff, pyright | Dev | Quality tooling |

## 8. Key Design Patterns Applied

| Pattern | Implementation | Location |
|---------|---------------|----------|
| Hexagonal Architecture | Ports (interfaces) + Adapters (impls) | `ports/` + `adapters/` |
| Domain-Driven Design | Entities with identity, value objects, domain events | `domain/` |
| CQRS | Separate Command and Query objects | `application/commands.py`, `application/queries.py` |
| Event-Driven Architecture | Immutable domain events with event types | `domain/events.py` |
| Protocol-based Ports | Python `Protocol` for dependency inversion | `ports/driven.py` |
| Singleflight (conceptual) | Lock deduplication via CommandHash | `adapters/dedup.py` |
| HLC + OCC (conceptual) | CoordinationState with version + hlc_timestamp | `domain/entities.py` |

## 9. Relationship with sharecli (Active Rust Repo)

Per `AGENTS.md`:

| Aspect | sharecli (active) | thegent-sharecli (archived) |
|--------|-------------------|---------------------------|
| Status | **Active** | **Archived** |
| Language | Rust | Python |
| Purpose | Process management, pooling, resource limits | CLI share / dedup / coordination |
| Architecture | ProcessPool, SharedRuntime, ResourceManager | Ports & Adapters (Hexagonal) |
| Code relationship | None | None |

## 10. Key Observations

1. **Textbook hexagonal architecture**: This is the most academically "correct" implementation of ports-and-adapters in the Phenotype Python repos — full separation of domain/application/adapter/port layers, CQRS command/query separation, immutable domain events, protocol-based port interfaces.

2. **Over-engineered for its scope**: The pure in-memory adapters (`InMemoryLockAdapter`, `InMemoryQueueAdapter`) bypass the port abstraction entirely — the CLI directly instantiates adapters rather than injecting them through the port interfaces. The full hexagonal machinery isn't exercised.

3. **Archived without completion**: Several ports (`MergePort`, `CoordinationPort`) have no adapter implementations. The merge and coordination domains are modeled but not wired to any real backend (no git integration for merges, no Redis/etcd for coordination).

4. **Module naming conflict**: The `LockStatus` name appears as both:
   - A value object in `domain/value_objects.py` (immutable dataclass with `locked`, `pid`, `expires_at`)
   - An enum in `domain/entities.py` (`UNLOCKED`, `LOCKED`, `COMPLETED`, `TIMED_OUT`)
   
   While this doesn't cause import errors (different modules), it creates conceptual confusion about which "lock status" is canonical.

5. **No sharecli overlap**: Despite the similar name, there is zero code or dependency overlap — the Rust `sharecli` was a clean-sheet rewrite with a different scope (process management vs. command coordination).

6. **Agent-centric**: The `AGENTS.md` references Kilo Gastown rig/polecat concepts, and the `GEMINI.md` suggests Gemini agent integration — this repo was designed as a multi-agent coordination layer, not a user-facing tool.

## 11. Recommendations (Historical — repo is archived)

1. **Preserve as architecture reference**: The hexagonal/CQRS/DDD/EAD implementation is a useful pattern reference for future Python projects in the org — the port/driven.py protocols and domain event model are particularly well-structured.

2. **Resolve the LockStatus name conflict**: If any future Python project absorbs these patterns, the value object and entity `LockStatus` should be unified into a single canonical type.

3. **No active development needed**: The functionality (command dedup, task queueing) is either provided by the Rust `sharecli` (process management) or by thegent itself (tool/server coordination). The Python prototype served its purpose.
