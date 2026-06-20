# phenotype-bus — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `phenotype-bus/` — Typed async pub/sub event bus (Rust)
**Status:** **DEPRECATED** (2026-06-18) — Absorbed into `phenoEvents` (PR #9)

---

## 1. Overview

`phenotype-bus` is a **typed async pub/sub event bus** for cross-collection communication within the Phenotype ecosystem. It provides in-memory event bus with topic routing, at-least-once delivery with retry, and idempotent handler support. The crate reached end-of-life on 2026-06-18 and is being absorbed into `phenoEvents`.

**Language:** Rust (edition 2021)
**Target:** Library crate (no binary)
**License:** Apache-2.0
**Deprecation timeline:** 2026-06-18 (deprecated) → 2026-06-25 (read-only) → 2026-09-23 (deleted)

---

## 2. Repository Structure

```
phenotype-bus/
├── src/                       # Source code (5 files)
│   ├── lib.rs                 # Crate root, re-exports, inline tests (unit tests)
│   ├── config.rs              # Environment-variable-driven configuration
│   ├── observability.rs       # Tracing initialization and span helpers
│   └── events/
│       ├── mod.rs             # Event trait, impl_event! macro
│       ├── bus.rs             # EventBus trait, InMemoryBus, Handler, Ack, retry
│       └── subscription.rs    # Subscription handle with oneshot cancel
├── tests/
│   ├── smoke.rs               # Basic smoke test
│   └── smoke_test.rs          # Basic smoke test (duplicate)
├── docs/                      # Architecture, intent, boundary, operations docs
├── worklogs/                  # Architecture, governance, research worklogs
├── scripts/                   # check-cliff-template.sh
├── Cargo.toml                 # Package manifest
├── Cargo.lock
├── justfile                   # Task runner
├── Taskfile.yml               # Go-task runner (mirrors justfile)
├── deny.toml                  # cargo-deny policy
├── cliff.toml                 # Changelog generator config
├── README.md, AGENTS.md, CLAUDE.md, CONTRIBUTING.md, CHANGELOG.md
└── worklog.md                 # Active worklog
```

---

## 3. Core Architecture

### 3.1 Event Trait & Macro (`events/mod.rs`)

```rust
pub trait Event: Send + Sync {
    fn kind(&self) -> &str;        // Topic identifier (e.g., "user.created")
    fn source(&self) -> &str;      // Service/collection name
    fn id(&self) -> Uuid;           // Default: Uuid::new_v4()
    fn ts(&self) -> DateTime<Utc>; // Default: Utc::now()
}
```

Auto-implemented for `Arc<T: Event>`.

**`impl_event!` macro** — Two forms:
- `impl_event!(Type, kind = "x", source = "y")` — explicit
- `impl_event!(Type, "name")` — uses type name as source

### 3.2 EventBus Trait (`events/bus.rs`)

```rust
#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish(&self, event: &dyn Event) -> Result<Ack, PublishError>;
    async fn subscribe(&self, handler: impl IntoHandler) -> Subscription;
    async fn subscribe_to(&self, topic: &str, handler: impl IntoHandler) -> Subscription;
    fn handler_count(&self) -> usize;
}
```

### 3.3 InMemoryBus — Primary Implementation

Uses `HashMap<String, Vec<HandlerSlot>>` behind `Arc<RwLock<>>`.

**Publish flow:**
1. Acquire read lock on all channels
2. Collect handler IDs from wildcard (`*`) topic + event's specific topic
3. Return `PublishError::NoHandlers` if none match
4. For each matching handler, call `deliver_with_retry()` — loop retries on `HandlerError::Transient` up to `max_attempts`
5. Return `Ack` with event_id, kind, source, ts, delivered_to count

**Subscribe flow:**
1. Generate UUID, create `oneshot::channel()`
2. Insert handler into `HashMap` under given topic
3. Spawn `tokio::spawn` task that awaits oneshot receiver → removes handler on cancel

### 3.4 Handler System

| Type | Purpose |
|---|---|
| `Handler` (trait) | `async fn handle(&dyn Event) -> Result<(), HandlerError>` |
| `HandlerError` | `Failed(String)` — permanent, `Transient(String)` — triggers retry |
| `IdempotentHandler<H>` | Deduplicates by event UUID via `HashSet<Uuid>` behind `Mutex` |
| `HandlerSlot` | Internal: `id: Uuid` + `handler: Box<dyn Handler>` |
| `Subscription` | Handle: `id: Uuid`, `topic: String`, `cancel: oneshot::Sender<()>` |

### 3.5 Topic Routing

- `"*"` is a wildcard topic — wildcard handlers always fire
- Topic-specific handlers fire only when `event.kind() == topic`
- Wildcard handlers fire first (insertion order), then topic-specific

### 3.6 Retry & Acknowledgement

- **RetryPolicy**: `max_attempts` (default 3), `backoff` (default 10ms)
- **Ack**: Contains `event_id`, `kind`, `source`, `ts`, `delivered_to` count
- **PublishError**: `Shutdown`, `NoHandlers(String)`, `HandlerExhausted { attempts, message }`, `Internal(String)`

---

## 4. Configuration

Environment-variable-driven (zero config files):

| Env Variable | Default | Purpose |
|---|---|---|
| `PHENOTYPE_BUS_LOG_LEVEL` | `"info"` | Default log level |
| `PHENOTYPE_BUS_RETRY_MAX_ATTEMPTS` | `3` | Max delivery attempts per handler |
| `PHENOTYPE_BUS_RETRY_BACKOFF_MS` | `10` | Retry backoff in milliseconds |

**Config structs:**

| Type | Fields |
|---|---|
| `Config` | `observability: ObservabilityConfig`, `bus: BusConfig` |
| `BusConfig` | `retry_max_attempts`, `retry_backoff_ms` |
| `ObservabilityConfig` | `default_log_level` |

---

## 5. Dependencies

| Dependency | Version | Features | Role |
|---|---|---|---|
| **tokio** | 1.39 | sync, rt, rt-multi-thread, macros, time | Async runtime |
| **serde** | 1.0 | derive | Event serialization |
| **serde_json** | 1.0 | — | JSON serialization |
| **thiserror** | 2.0 | — | Error derive |
| **anyhow** | 1.0 | — | Flexible errors |
| **tracing** | 0.1 | — | Structured logging |
| **tracing-subscriber** | 0.3 | env-filter, fmt | Log subscriber |
| **async-trait** | 0.1 | — | Async trait support |
| **uuid** | 1.10 | v4, serde | Event/subscription IDs |
| **chrono** | 0.4 | serde | Timestamps |
| **futures** | 0.3 | — | Future utilities |
| **async-channel** | 2.3 | — | Async channel (available) |

---

## 6. Test Coverage

| Test | Location | What it Tests |
|---|---|---|
| `publish_subscribe_wave2` | `lib.rs` | Basic pub/sub round-trip |
| `at_least_once_retry_wave2` | `lib.rs` | Transient failure → retry 3x → success |
| `idempotency_dedup_wave2` | `lib.rs` | Same event 3x → handler fires once |
| `multiple_handlers_wave2` | `lib.rs` | 3 handlers (2 wildcard + 1 topic) all fire |
| `version_helper_matches_cargo` | `lib.rs` | Version constant matches | 
| `name_helper_matches_cargo` | `lib.rs` | Name constant matches |
| `from_env_* tests` | `config.rs` | Config defaults, env reading, retry policy |
| `cancel_signals_receiver` | `subscription.rs` | Cancel sends oneshot signal |
| `drop_signals_receiver` | `subscription.rs` | Drop sends cancel signal |
| `is_active_reflects_cancel` | `subscription.rs` | is_active() reflects state |
| `smoke_test` | `tests/` | 2+2=4 (2 files) |

**Total:** ~15 tests (unit co-located with impl, plus 2 integration smoke tests)

---

## 7. Key Design Decisions

1. **Read-lock-whole-dispatch**: Holds read lock for entire publish cycle. Simple but means all handlers run sequentially under read lock.

2. **Ordered handler dispatch**: Wildcard first (insertion order), then topic-specific.

3. **Background cancel watchers**: Each subscription spawns a tokio task to remove handlers on cancel/drop.

4. **In-memory only**: No persistence — events lost on restart. Intentional for in-process bus.

5. **No serialization bound on Event trait**: Events only need `Send + Sync`. Serialization is optional (consumer can derive `Serialize`/`Deserialize` on their event types).

6. **`impl_event!` macro**: Reduces boilerplate for common Event implementations.

---

## 8. Deprecation & Migration

| Date | Event |
|---|---|
| 2026-06-18 | Deprecated; functionality lifted to `phenoEvents` (PR #9) |
| 2026-06-25 | Repo set to read-only |
| 2026-09-23 | Repo deleted (90-day retention) |

**Migration path:**
- Replace `phenotype-bus` dependency with `pheno-events = "0.1"`
- Update imports: `phenotype_bus::` → `pheno_events::bus::`

---

## 9. Observations

1. **Deprecated**: Functionality absorbed into `phenoEvents`, making this crate a historical artifact.

2. **Duplicate smoke tests**: `tests/smoke.rs` and `tests/smoke_test.rs` both contain identical 2+2=4 tests — likely a scaffolding artifact.

3. **Zero persistence**: Pure in-memory design means no durability guarantees.

4. **Heavy use of `Arc<RwLock<>>`** for thread-safe shared state.

5. **Well-instrumented**: Uses `tracing` for all operations with structured spans.

6. **No client/server or network transport**: This is an in-process bus only — no distributed event bus capability.

---

## 10. Recommendations

1. **Verify absorption completeness**: Ensure all features are ported to `phenoEvents` before archive
2. **Remove duplicate smoke tests**: Clean up `tests/smoke_test.rs` before deletion
3. **Document migration guide** in `phenoEvents` README
4. **Archive repo per deprecation schedule** — 2026-09-23 target for deletion
