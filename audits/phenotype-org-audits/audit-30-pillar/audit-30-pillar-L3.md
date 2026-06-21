# L3 — Data Model & State Management

## Scope

Inventory and grade the **data model and state management** of the four
target repos (AgilePlus, thegent, Tracely, Tracera): domain entities,
value objects, state machines, persistence (SQLite / file / in-memory),
schema migrations, transactional integrity.

Reference: `AUDIT_BLOC_VS_2026_SOTA.md` §0.1 (crate inventory),
§1.1-1.7 (per-project comparisons), `agileplus-graph/src/types.rs`,
`agileplus-triage/src/claim.rs`, `phenotype-dep-guard/src/`.

## SOTA 2026

| Project | Data model pattern | Persistence | State machines |
|---|---|---|---|
| **gastown MEOW** | `Bead` 5-state + `Convoy` 1-many-beads | SQLite (single file) | `BeadState` (Pending/Claimed/InProgress/Completed/Failed) |
| **dark-factory** | `Issue` + `Worker` + `Trail` (append-only log) | Linear append-only log | Implicit (issue → PR) |
| **attractor** | `DotNode` + `DotEdge` (typed) | DOT files in VCS | Implicit (topological order) |
| **fabric-api (Stripe, 2025)** | Versioned `id` (`obj_…`), `created`/`updated` ints, `metadata` Map<string,string> | Postgres + idempotency table | `Status` transitions guarded by API |
| **fabric-store (Temporal, 2025)** | Workflow + Activity typed structs | Event history + visibility | Replay-driven state recovery |
| **CRDT (Shapiro 2011)** | State-based / Op-based CRDTs | Eventually-consistent | Conflict-free merge |
| **Neo4j (Phenotype-style)** | Node labels + relationship types | Property graph | N/A (graph is data) |
| **Mongoose (MongoDB)** | Schema + discriminator | Document store | N/A |

The bar for 2026: typed enums for state (not strings), explicit
transition functions that return errors (not booleans), append-only
event sourcing for auditability, idempotent schema migrations, and a
declarative graph schema (DDL) when the project has a graph layer.

## Phenotype state

### AgilePlus (45 crates)

#### Domain entities — `agileplus-domain/src/domain/`

- **`state_machine.rs:1-101`** — `FeatureState` enum with **8 explicit
  variants** (`Created`, `Specified`, `Researched`, `Planned`,
  `Implementing`, `Validated`, `Shipped`, `Retrospected`); `FromStr`
  for parsing, `Display` for serialization, and a `transition(target)`
  method that returns `Result<TransitionResult, DomainError::InvalidTransition>`
  with the explicit allow-list
  (`Created→Specified→Researched→Planned→Implementing→Validated→Shipped→Retrospected`).
  **Status: ✓** — this is SOTA-grade state-machine-as-code.
- **`work_package.rs`** (`src/domain/work_package.rs`): `WpState` is
  a separate enum (per inventory), and `WorkPackage` is the aggregate.
- **`backlog.rs`**: `BacklogItem`, `BacklogFilters`, `BacklogPriority`,
  `BacklogStatus`, `Intent`. `pop_next_backlog_item()` is on the port.
- **`feature.rs`**, **`epic.rs`**, **`story.rs`**, **`module.rs`**,
  **`cycle.rs`**, **`project.rs`**, **`user.rs`**, **`sync_mapping.rs`**,
  **`governance.rs`**, **`metric.rs`**, **`audit.rs`** — all 11
  aggregate roots have their own domain module. **Status: ✓** for
  granularity; **△** because no file:line was read in this audit
  window — assume present per `ports.rs:34-50` import block.
- **`ports.rs:55-117`**: `TriageOutcome` (Accepted/Dismissed),
  `TriageTicket` (id, title, description, intent, priority, status,
  source, feature_slug, tags), `TriageError` (4 variants). **Status: ✓.**
- **`builder.rs`**, **`credentials.rs`**, **`config.rs`**,
  **`intent_graph.rs`** — supporting modules present.

#### Graph types — `agileplus-graph/src/types.rs`

- **5 `NodeType`s** (`Feature`, `WorkPackage`, `Agent`, `Label`, `Project`)
  — `types.rs:4-10`. **Status: ✓.**
- **13 `RelType`s** (`Owns`, `AssignedTo`, `DependsOn`, `Blocks`, `Tagged`,
  `InProject`, **`OwnsClaim`**, **`ClaimsWorktree`**, **`DispatchedBy`**,
  `Verifies`, `Produces`, `Consumes`, `Retries`) — `types.rs:25-39`.
  `as_str()` returns the SCREAMING_SNAKE form for SQL/Neo4j round-trip.
  **Status: ✓** — far ahead of gastown's 0 `RelType`s.

#### Claim primitive — `agileplus-triage/src/claim.rs:1-594`

- **4 `ClaimKind`s** (Repo, Branch, Worktree, Subproject) — `claim.rs:40-49`.
- **3 `ClaimState`s** (Active, Draining, Expired) — `claim.rs:54-61`.
- **`ClaimReason` tagged enum** (`#[serde(tag = "kind", content = "value",
  rename_all = "snake_case")]`) with 5 variants (TaskRef, Branch,
  Subproject, WipRun, Manual) — `claim.rs:69-89`. Default =
  `ClaimReason::Manual(String::new())`.
- **`Claim` aggregate** (`claim.rs:120-132`) with `id`, `resource`,
  `kind`, `agent_id`, `created_at`, `last_heartbeat`, `ttl_seconds`,
  `state`, `reason`.
- **TTL uses millisecond precision** — `is_expired` at `claim.rs:143-145`:
  `(now - last_heartbeat).num_milliseconds() > ttl_seconds * 1000`.
  **Status: ✓** — SOTA-grade.
- **In-memory `ClaimStore` + trait `ClaimStoreTrait`**
  (`claim.rs:177-216, 220-437`) for cross-implementation swapping.
- **`claim_transfer` semantics** (`claim.rs:359-396`) — old claim
  becomes `Draining`; new claim inherits resource/kind/ttl/reason.
  Returns `ClaimError` (3 variants: NotFound, WrongOwner, WrongState).
- **6 test cases** in `claim.rs:439-594` covering serde roundtrip,
  default reason, trait dispatch, transfer semantics, error display.
  **Status: ✓.**

#### Bead (convoy unit of work) — `agileplus-convoy/src/bead.rs:1-69`

- **5 `BeadState`s** (Pending, Claimed, InProgress, Completed, Failed) —
  `bead.rs:11-23` — 1:1 mirror of gastown MEOW (`AUDIT_BLOC_VS_2026_SOTA.md:191`).
- **`Bead` struct** (`bead.rs:26-35`) wraps a `Claim` and tracks
  `state`, `payload`, `owner`, `created_at`, `completed_at`.
- **3 transition methods** (`start`, `complete`, `fail`) — `bead.rs:52-67`
  — no validation that the current state permits the transition
  (e.g. `start` from `Completed` is allowed). **Status: △** — should
  use a `transition()` function like `FeatureState::transition()` to
  reject invalid state changes (SOTA pattern).
- **Missing: `Bead.stack_id`** per `AUDIT_BLOC_VS_2026_SOTA.md:215` (P2 gap).

#### Event sourcing — `agileplus-events/src/lib.rs:1-46`

- **Typed domain events** (re-exported at `lib.rs:18-23`): `FeatureCreated`,
  `FeatureShipped`, `FeatureStateAdvanced`, `EpicCreated`, `EpicStatusChanged`,
  `StoryCreated`, `StoryAssigned`, `StoryStatusChanged`,
  `WorkPackageCreated`, `WorkPackageStateChanged`, `ProjectCreated`,
  `ProjectArchived`, `ProjectRenamed`, `UserAdded`, `UserRoleChanged`,
  `UserStatusChanged`. **Status: ✓.**
- **SHA-256 hash chain** — `pub use hash::{compute_hash, verify_chain, HashError}`.
  **Status: ✓** (matches `AUDIT_BLOC_VS_2026_SOTA.md:90`).
- **Snapshot management** — `pub use snapshot::{should_snapshot,
  InMemorySnapshotStore, LoadedState, SnapshotConfig, SnapshotError,
  SnapshotStore}`. **Status: ✓.**
- **Aggregate replay** — `pub use replay::{replay_events,
  replay_events_since, Aggregate, ReplayError}`. **Status: ✓.**
- **Event bus** — `EventBus` / `AsyncEventBus` / `EventHandler` /
  `AsyncEventHandler` / `EventHandlerError` ports.
  **Status: ✓.**
- **In-memory event store** — `pub use store::{EventError, EventStore,
  InMemoryEventStore}`. **Status: ✓.**

#### Persistence — `agileplus-sqlite/`

- **25 SQL migrations** under `crates/agileplus-sqlite/src/migrations/`
  (001-025, plus 025_views):
  `001_create_features`, `002_create_work_packages`,
  `003_create_governance_contracts`, `004_create_audit_log`,
  `005_create_evidence`, `006_create_policy_rules`,
  `007_create_metrics`, `008_create_wp_dependencies`, `009_create_indexes`,
  `010_create_events`, `011_create_snapshots`, `012_create_sync_mappings`,
  `013_create_api_keys`, `014_create_device_nodes`, `015_modules_cycles`,
  `016_create_backlog_items`, `016_git_bindings`, `017_create_projects`,
  `018_create_users`, `019_create_epics`, `020_create_stories`,
  `021_add_requirement_id`, `022_create_trace_links`,
  `023_create_worklog_entries`, `024_l2_38_worklog_trace_gate_run_scope`,
  `025_create_intent_graph`, `025_intent_graph_views`. **Status: ✓** for
  coverage of the domain.
- **Embedded SQL via `include_str!`** — `migrations/mod.rs:8-26`.
  **Status: ✓.**
- **Both UP and DOWN sections** per migration — `mod.rs:73-93` (`parse_up`
  and `parse_down` look for `-- UP` / `-- DOWN` markers). **Status: ✓** —
  fully reversible migrations.
- **In-order apply** — `MIGRATIONS` const slice in
  `migrations/mod.rs:36-58`. **Status: ✓.**
- **No formal `version` table visible in this audit window** — but the
  doc-comment at `mod.rs:1-4` says "Applied migrations are tracked in
  the `_migrations` meta table" (consistent with rusqlite migrations
  convention). **Status: △** (assumed present, not verified).
- **Repository pattern — `crates/agileplus-sqlite/src/repository/`**:
  12 modules — `features`, `work_packages`, `stories`, `epics`,
  `backlog`, `events`, `audit`, `users`, `metrics`, `evidence`,
  `governance`, `projects`, `sync_mappings` (13 files in this listing;
  one is `mod.rs`). **Status: ✓** for granularity.
- **Transactional integrity**: rusqlite-based, but **`rusqlite` is
  sync-only**; the adapter must run sync DB calls inside
  `tokio::task::spawn_blocking` or similar. Without seeing the
  adapter, the audit cannot confirm ACID boundaries. **Status: △** —
  `agileplus-domain/ports.rs:131-277` is `async`, so the SQLite
  adapter must bridge sync↔async; the pattern is implicit.

#### Validation — `agileplus-domain/src/ports.rs:61-127`

- `TriageError` 4 variants with `From<DomainError>` — typed error
  envelope decoupled from storage. **Status: ✓.**

#### Verdict types — `agileplus-witness/src/verdict.rs:16-66`

- 3 `Verdict`s (Pass, Fail, Abstain); `VerdictEngine::evaluate` is
  majority-based. **Status: ✓** (per
  `AUDIT_BLOC_VS_2026_SOTA.md:51-53`).

#### Worktree binding — `agileplus-git/src/claim_bound.rs:49-138`

- `ClaimBoundWorktree::create` validates claim kind/state, runs
  `git worktree add`, encodes path into `ClaimReason::Branch`.
  `lookup` and `validate` round out the API. **Status: ✓.**

#### Phenotype-dep-guard (lives in AgilePlus workspace)

- `crates/phenotype-dep-guard/src/dependency.rs` — `Dependency` /
  `Ecosystem` / `Source`. 4 ecosystems: Cargo, Npm, Pypi, Go
  (`src/ecosystem.rs`).
- `crates/phenotype-dep-guard/src/sbom.rs` — CycloneDX 1.5 SBOM.
- `crates/phenotype-dep-guard/src/scanner.rs` — ScannerBuilder ties
  manifest + lockfile + OSV + SBOM.
- `crates/phenotype-dep-guard/src/vulnerability.rs` — `Vulnerability`,
  `Severity`.
- **Status: ✓** (no state machines, but the data model is
  intentionally declarative: input files → typed records → SBOM).

### thegent (25+ crates)

- **No relational persistence** in any of the 25+ crates audited
  here. The closest to a data model is `thegent-memory` (moka cache +
  ed25519 + async client/DB), but it's an external LLM-context cache,
  not thegent's domain state.
- **`thegent-dspy`** (Python) has module types (`compiler.py`,
  `predict.py`, `teleprompter.py`, `module.py`) — DSPy-style
  signatures and predictors. **Status: △** for SOTA alignment with
  DSPy 2024 (Khattab et al.).
- **The `thegent-runtime` binary** has its own private
  `CircuitBreaker` struct (`src/main.rs:14-29`) — a 3-state
  (closed/open/recovering) with hard-coded thresholds. **Status: △**
  — duplicated pattern; should use `tracely-sentinel::circuit_breaker`
  (canonical, public, tested).
- **`thegent-swe-runner`** — a mini-SWE-agent harness; the data model
  is per-issue: a `patch` + a `test_report` + a `trace`. No DB.
  **Status: N/A** (no domain state).
- **No state machines, no migrations, no transactional layer.**
  **Status: ✗ for L3 by design** — thegent is a stateless substrate
  on top of LLM calls.

### Tracely (5 crates)

#### `tracely-core` (logging + tracing primitives)

- **`TracingConfig` struct** (`tracing.rs:13-25`) with 5 fields
  (`level`, `span_events`, `include_thread_ids`,
  `include_thread_names`, `target`) and a builder
  (`with_*` methods). **Status: ✓.**
- **`TraceContext`** (`tracing.rs:133-138`) — pairs `trace_id` /
  `span_id`, both UUID v4. **Status: ✓** (W3C-style, no
  parent_id / flags — see gap below).
- **State machine**: none.

#### `tracely-sentinel` (resilience)

- **`CircuitState` 3-state enum** — `circuit_breaker.rs:18-26`:
  `Closed` / `Open` / `HalfOpen`. Transitions:
  - `Closed → Open` after `failure_threshold` failures
    (`circuit_breaker.rs:99-103`)
  - `Open → HalfOpen` after `recovery_timeout` elapses
    (`circuit_breaker.rs:64-69`)
  - `HalfOpen → Closed` on success (`circuit_breaker.rs:81-85`)
  - `HalfOpen → Open` on any failure (`circuit_breaker.rs:104-108`)
  - 3 in-file tests cover these transitions. **Status: ✓.**
- **`Bulkhead` 2-level partitioning** — `bulkhead.rs:14-86`:
  per-partition and total capacity, `PartitionGuard` with `Drop`
  auto-release via `tokio::spawn`. **Status: ✓** (RAII-style guard
  is SOTA).
- **3 rate limiters** — `rate_limiter.rs:38-201`:
  `TokenBucket`, `LeakyBucket`, each with `try_acquire`.
  5 tests. **Status: ✓.**
- **No persistence** in any of the 5 Tracely crates — all in-memory.
  **Status: N/A** by design.

### Tracera (1 Rust port + Python FastAPI + Go backend)

#### `tracera-core` (canonical entity model)

- **`TraceLinkType` 7-variant enum** — `lib.rs:51-61`: Satisfies,
  Verifies, Implements, DerivesFrom, Refines, ConflictsWith,
  Duplicates. `as_db_str()` returns SCREAMING_SNAKE for SQL/Neo4j.
  **Status: ✓.**
- **`ArtifactKind` 7-variant enum** — `lib.rs:87-97`: Requirement,
  Design, Code, Test, Evidence, Risk, Rationale. `neo4j_label()`
  for graph round-trip. **Status: ✓.**
- **`RequirementStatus` 7-state enum** — `lib.rs:114-125`: Draft,
  Proposed, Approved, Implemented, Verified, Deprecated, Rejected
  (ISO 29148 §5.2.8). **Status: ✓.**
- **`VerificationMethod` 5-variant enum** — `lib.rs:128-136`: Test,
  Analysis, Inspection, Demonstration, Review (DO-178C / IEEE 1012).
  **Status: ✓.**
- **`Artifact` value object** — `lib.rs:142-154`: id (Uuid),
  project_id, kind, title, description, external_id, metadata
  (BTreeMap), created_at, updated_at. **Status: ✓.**
- **`Requirement` aggregate** — `lib.rs:157-186`: extends `Artifact`
  via `#[serde(flatten)] artifact`, adds `status`, `priority` (0..=5),
  `rationale`, `acceptance_criteria: Vec<String>`,
  `verification_method`. **Status: ✓.**
- **`TraceLink` aggregate** — `lib.rs:189-243`: id, project_id,
  source/target IDs, `from`/`to` `ArtifactRef`, link_type,
  confidence (f32, 0.0..=1.0), rationale, metadata, created_at,
  updated_at. `is_core()` checks `CORE_TRACE_LINK_TYPES` const.
  **Status: ✓.**
- **`ArtifactRef` tagged enum** — `lib.rs:245-272`: 7 variants
  (Requirement, NonFunctionalRequirement, Test, CodeEntity, Journey,
  AgentRun, Evidence, Document). `kind_str()` accessor. **Status: ✓.**
- **`TraceLinkError` typed errors** — `lib.rs:276-287`: SelfLoop,
  WrongArtifactKind, BadConfidence (defined but not yet enforced
  in `TraceLink::new`). **Status: △** (declared, partial
  enforcement).
- **`CoverageState` 5-variant enum** — `lib.rs:312-320`: Covered,
  Partial, Missing, Stale, Conflict. **Status: ✓.**
- **`CoverageMatrix` + `MatrixCell`** — `lib.rs:296-309`:
  `IndexMap<(String, String), MatrixCell>` keyed by
  `(from, to)`. **Status: ✓** (IndexMap preserves insertion order,
  ideal for stable diffs).
- **Declarative Neo4j DDL** — `lib.rs:323-385`: 3 constraints
  (artifact_id_unique, requirement_id_unique, project_id_unique) +
  4 indexes (artifact_project_kind, artifact_external_id,
  requirement_status, fulltext artifact_text). All `IF NOT EXISTS`
  for idempotency. `all_statements()` returns apply order
  (constraints before indexes). **Status: ✓** (2026 best practice).
- **Constructor validation**:
  - `TraceLink::new` (`lib.rs:208-237`) rejects self-loop. **Status: ✓.**
  - `Requirement::new` (`lib.rs:168-186`) rejects wrong artifact
    kind. **Status: ✓.**
  - `confidence` is not yet range-checked (`BadConfidence` is
    defined but `TraceLink::new` always sets `confidence: 1.0`).
    **Status: △.**
- **8 unit tests in `tracera-core/src/lib.rs:387-490`**: roundtrip,
  self-loop, wrong kind, db_strings, ui_link, neo4j_schema, neo4j_labels.
  **Status: ✓** for what they cover (mostly constructors + DDL).

#### `tracera-core` (pagination, rate_limit, health, etc.)

- **`OffsetRequest` + `OffsetPageInfo`** — `pagination.rs:83-145`:
  page (1-indexed, saturates to 1), page_size (clamped 1..=500),
  `offset()` for SQL `LIMIT/OFFSET`, `page_info(total)` for
  metadata. **Status: ✓.**
- **`Cursor` with versioned encoding** — `pagination.rs:147-202`:
  `b64url_encode("v1:{offset}:{sort_key}")`. `decode()` rejects
  bad payloads, wrong version, non-utf8. **Status: ✓.**
- **`KeysetRequest<K, S>`** — `pagination.rs:247-294`:
  `after: Option<(K, S)>`, `keyset_slice()` in-memory filter.
  Production code should push down to SQL
  `WHERE (score, id) > (last_score, last_id)`. **Status: ✓** for
  the abstraction; **△** for the SQL push-down note.
- **3 rate limiters** — `rate_limit.rs:19-230`: TokenBucket (with
  `available()` for tests/metrics), SlidingWindow (with timestamp
  pruning), LeakyBucket. 5 tests. **Status: ✓.**

#### Tracera Python (`src/tracertm/`)

- **FastAPI app — `api/main.py:1-22`**: `app = FastAPI(title="Tracera
  API", version="0.2.0")`; includes `RequestIdMiddleware` (from
  `phenotype_request_id.fastapi`); mounts
  `traceability_router` at `/api/v1`. **Status: ✓.**
- **Pydantic v2 DTOs — `api/routers/traceability.py:21-93`**:
  `TraceRelationship = Literal[...]` (7 values), `CoverageState =
  Literal[...]` (5 values), `TraceLinkInput`, `MatrixCellResponse`,
  `CoverageMatrixRequest`, `ImpactRequest`, `ImpactResponse`.
  Field validators: `min_length=1`, `ge=0.0, le=1.0` on
  confidence, `ge=1` on stale_after_days, `ge=0` on max_depth.
  **Status: ✓.**
- **Spec-first governance types — `governance.py:9-48`**:
  `GovernanceSpec`, `GovernanceTrace`, `GovernanceViolation`,
  `GovernanceReport` with `Literal["pass","fail"]` and
  `Literal["draft","approved","implemented"]` enums. **Status: ✓.**
- **No SQLAlchemy / no Alembic / no formal schema migration tool** —
  Python layer is in-memory. **Status: ✗** for persistence.

#### Tracera Go backend (`backend/internal/`)

- **`config/config.go`** — typed config; 1 file + 1 test.
- **`observability/otel.go`** — OpenTelemetry bridge.
- **`ml/registry.go`** — model registry (the only stateful Go surface).
  **Status: △** — not investigated in depth in this audit window.

## Gaps

1. **`Bead` state transitions are not validated**
   (`agileplus-convoy/src/bead.rs:52-67`) — `start()`, `complete()`,
   `fail()` allow any from-state. SOTA pattern: use
   `FeatureState::transition()`-style explicit allow-list.
   **Effort: S** (1 file, 20 lines).
2. **`TraceLink::new` does not validate `confidence` in range**
   (`tracera-core/src/lib.rs:208-237`) — `TraceLinkError::BadConfidence`
   is defined but unused. **Effort: S** (1 if-check).
3. **No Neo4j persistence adapter in the Phenotype bloc** despite the
   declarative DDL in `tracera-core/src/lib.rs:323-385` and
   `AUDIT_BLOC_VS_2026_SOTA.md:143-145` listing Neo4j. **Effort: L**
   (a new `agileplus-graph-neo4j` crate, bolt driver, query layer).
4. **`thegent-runtime` has its own private `CircuitBreaker`**
   (`src/main.rs:14-29`) — duplicates `tracely-sentinel::circuit_breaker`
   and lacks the Open/Closed/HalfOpen enum discipline.
   **Effort: S** (replace with the canonical type).
5. **Tracera Python has no persistence layer** — `src/tracertm/api/`
   uses in-memory Pydantic models only; no SQLAlchemy, no Alembic, no
   Neo4j driver. **Effort: L** (depends on chosen store).
6. **AgilePlus `Bead.stack_id` missing** (per
   `AUDIT_BLOC_VS_2026_SOTA.md:215`) — closes the last gastown MEOW
   feature gap. **Effort: S** (1 field, 1 migration).
7. **No transactional integrity audit on the SQLite adapter** — the
   `agileplus-domain/ports.rs:131-277` is `async`; the SQLite
   adapter bridges sync↔async; the audit cannot confirm whether
   `BEGIN; ... COMMIT;` boundaries are correct without reading the
   adapter. **Effort: S** (1 audit, possibly follow-up fix).
8. **Tracely `TraceContext` has no `parent_span_id` or `flags`** —
   W3C TraceContext has 4 fields (`trace-id`, `parent-id`, `trace-flags`,
   `trace-state`); current is 2. **Effort: S** (add 2 fields,
   update `init_tracing`).
9. **No formal `MigrationVersion` enum / migration diffing tool** in
   any of the 3 Rust workspaces — migrations are string-embedded SQL
   applied in slice order. Drift is caught only by `_migrations`
   table presence. **Effort: M** (adopt `refinery` or similar).
10. **No CQRS / read-model split** in AgilePlus — all reads go through
    the same `StoragePort` that writes go through. At scale this
    blurs hot/cold read paths. **Effort: L** (architectural).

## Recommendations

1. **Add `BeadState::transition()` validator**
   (`agileplus-convoy/src/bead.rs:1-69`) — allow-list
   `Pending→Claimed→InProgress→Completed` and `InProgress→Failed`,
   reject all others with `BeadError::InvalidTransition`. 1 PR, 1 day.
2. **Enforce `confidence` range in `TraceLink::new`**
   (`tracera-core/src/lib.rs:208-237`) — return
   `TraceLinkError::BadConfidence(c)` if not 0.0..=1.0. 1 PR, 1 day.
3. **Replace `thegent-runtime` private `CircuitBreaker` with
   `tracely-sentinel::circuit_breaker`** — delete the 30-line struct
   in `thegent-runtime/src/main.rs:14-29`, import the canonical
   typed `CircuitState` + `CircuitBreakerError`. 1 PR, 1 day.
4. **Add `Bead.stack_id: Option<String>`** per
   `AUDIT_BLOC_VS_2026_SOTA.md:215` — 1 field + 1 migration. 1 PR, 1 day.
5. **Build `agileplus-graph-neo4j` adapter** for the 13 `RelType`s
   (uses `Neo4jSchema::all_statements()` from
   `tracera-core/src/lib.rs:370-374` as the bootstrap DDL). 1 PR, 1 week.
6. **Extend `TraceContext`** with `parent_span_id: Option<String>` and
   `trace_flags: u8` (W3C TraceContext). 1 PR, 1 day.
7. **Adopt `refinery` or `sqlx::migrate!`** for migration discovery
   instead of `const MIGRATIONS: &[(&str, &str)]`. 1 PR, 2 days.
8. **Add a CI check that hashes the committed migration SQL** and
   fails the build if a row in `_migrations` is missing. 1 PR, 1 day.
9. **Document the `TriageError`/`DomainError`/`ApiError` mapping in a
   single ADR** — currently the conversion is spread across
   `agileplus-api/src/error.rs:56-100`. 1 PR, 1 day.
10. **Run `agileplus-events/src/hash.rs` round-trip test in CI** to
    catch hash-chain breaks. 1 PR, 1 day.
