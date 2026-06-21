# L2 — API Surface & Contract

## Scope

Inventory and grade the **public API surface and contract** of the four target repos
(AgilePlus, thegent, Tracely, Tracera): public types and re-exports, versioning,
backward-compatibility patterns, schema files (OpenAPI / JSONSchema / Protobuf),
idempotency, pagination, error envelopes, and API stability tests.

Reference: `AUDIT_BLOC_VS_2026_SOTA.md` §1.6 (MCP), §1.7 (claude-code / codex),
§0.1 (crate inventory).

## SOTA 2026

| Project | Public surface | Contract artifacts |
|---|---|---|
| **fastmcp / Anthropic official Python SDK** | `@mcp.tool` decorator → JSON-RPC tool | `pyproject.toml` version, semver on PyPI |
| **MCP TS / Rust SDKs** | Typed transport + tool macro | Cargo version, `schemas/` in repo |
| **dark-factory (Go)** | `Queue` / `Worker` / `Trail` / `PR` Go interfaces | Go module `go.mod` semver, `internal/` private |
| **gastown (Go)** | Bead/Convoy/Hook/MEOW public packages | Apache-2.0, go.mod semver, `internal/` private |
| **attractor (Go)** | DOT parser + executor | Apache-2.0, public Go packages |
| **claude-code / codex CLI** | Flags: `--worktree`, `--iter`, `--auto-merge` | CHANGELOG.md, semver on npm |
| **fabric-api (Stripe, 2025 SOTA)** | Versioned URL `v1/`, idempotency-key header, error envelope `{code, message, request_id, type}` | `api.stripe.com/v1` |

The bar for 2026: typed schema files (OpenAPI 3 / JSONSchema / Protobuf),
versioned URL prefix or Cargo `version = "1.0"`, idempotency keys on every
mutating endpoint, pagination on every list endpoint, structured error
envelope with code + request_id, and a CI drift check that compares
committed schema to freshly generated schema.

## Phenotype state

### AgilePlus (45 crates, 646 tests, multi-protocol API)

- **Typed HTTP API (axum) — `agileplus-api/`** (`crates/agileplus-api/src/router.rs:1-115`):
  13 protected routes + 6 public routes; `?page`/`?page_size` is **not** used;
  stateful handlers rely on `axum::extract::State<AppState<S, V, O>>`
  generic over `StoragePort + VcsPort + ObservabilityPort`. **Status: △** —
  routes do not surface `OffsetRequest` / `Cursor` from `tracera-core`'s
  pagination module; list endpoints return `Vec<T>` directly (no page metadata).
- **OpenAPI generator — `agileplus-api/src/openapi.rs:1-82`**: utoipa 5-based
  `ApiDoc` struct; **explicitly MVP** ("5 representative endpoints of 36").
  API key auth via `X-API-Key` header registered as `SecurityScheme::ApiKey`.
  Drift check is **deferred** (gated on resolving a `git` SHA-pinned dep).
  **Status: △ (partial).**
- **Response DTOs separated from domain — `agileplus-api/src/responses.rs:1-242`**:
  `FeatureResponse`, `WorkPackageResponse`, `GovernanceResponse`,
  `AuditEntryResponse`, `HealthResponse`. Each has `From<Domain> for Response`
  mapping. **Status: ✓** (this is a 2026 SOTA pattern — internal repr can
  evolve without breaking the wire).
- **Error envelope — `agileplus-api/src/error.rs:1-100`**: `ApiError` 6 variants
  (`NotFound`, `BadRequest`, `Unauthorized`, `Conflict`, `Template`,
  `Internal`) → maps to HTTP status, JSON body `{"error": "<message>"}`.
  **No `code` field, no `request_id` field, no `type` discriminator.**
  **Status: △.** SOTA (Stripe 2025) requires `{code, message, request_id, type}`.
- **gRPC / Protobuf — `agileplus-proto/`**: present (workspace inventory
  `AUDIT_BLOC_VS_2026_SOTA.md:98`); `agileplus-grpc` is the tonic server.
  **Status: ✓** but no `proto/agileplus.proto` citation in this audit window.
- **MCP server (internal) — `agileplus-mcp-intent/src/types.rs`** (1:1 SOTA
  mirror per §1.6; 30+ tools, prompt→intent-graph compiler).
  **Status: ✓.**
- **MCP SDK (Rust) — `phenotype-mcp-sdk-rs/src/`** (645 lines).
  **Status: ✓ for Rust; ✗ for TypeScript** (gap from §3.1).
- **Hexagonal ports — `agileplus-domain/src/ports.rs:1-496`**: 4 `async_trait`
  ports (`StoragePort`, `ContentStoragePort`, `VcsPort`, `TriagePort`,
  `PlaneSyncPort`, `ObservabilityPort`). `StoragePort` is **93 methods** long
  (features, work packages, audit, evidence, policy, modules, cycles, sync
  mappings, projects, users, epics, stories). Blanket impls
  `T: StoragePort → StoryRepository` / `EpicRepository` reuse the surface.
  **Status: △** — the port is so wide that any change ripples; some
  SOTA systems split into per-aggregate ports (e.g. `FeatureRepository`).
- **Contract tests — `agileplus-contract-tests/Cargo.toml:32-42`**: 4 contract
  suites wired (`events_sqlite_contract`, `sync_plane_contract`,
  `dashboard_api_contract`, `api_events_contract`, paths under
  `tests/contracts/`). Sample contract (`events_sqlite_contract.rs:1-30`)
  enforces "append returns strictly monotonic per-(entity_type, entity_id)
  sequence" by comparing `SqliteStorageAdapter` against `InMemoryEventStore`.
  **Status: ✓** — this is SOTA-grade trait-based contract verification
  (cf. Rust API Guidelines "C-testable"); **but these are intra-bloc, not
  public API stability tests** for downstream consumers.
- **Versioning — `agileplus-api/src/openapi.rs:38`**: `version = "0.1.1"`,
  `agileplus-api/src/responses.rs:138` reads `env!("CARGO_PKG_VERSION")`.
  Workspace version is `version.workspace = true` everywhere; pre-1.0 semver.
  **Status: △** — no public API stability promise (no `#[stable]` annotations,
  no `cargo-semver-checks` in CI, no CHANGELOG.md per crate API section).
- **Idempotency keys**: **absent** on POST endpoints
  (`POST /api/v1/features`, `POST /api/v1/work-packages`,
  `POST /api/v1/features/:slug/transition`, `POST /api/v1/audit/verify`).
  `agileplus-factory/src/queue.rs:9-23` defines `Issue` queue but no
  `Idempotency-Key` header is plumbed through. **Status: ✗.**
- **JSONSchema / AsyncAPI**: not present in `agileplus-api/`. OpenAPI is
  the only schema artifact. **Status: ✗** (no JSONSchema for inbound
  bodies beyond what utoipa derives from `ToSchema` derives).
- **Re-exports — `agileplus-events/src/lib.rs:18-32`**: well-organized
  (`pub use domain_event::{...}` for ~15 typed events; `pub use
  hash::{compute_hash, verify_chain, HashError}`). **Status: ✓.**
- **Tracera-python-style request-id middleware** is **not** present in
  `agileplus-api/src/middleware/`. OTel middleware
  (`middleware/otel.rs`) exists but no request-id echo. **Status: △.**

### thegent (25+ Rust crates + thegent-dspy in Python)

- **No public multi-protocol API** — thegent is an internal substrate
  (router, runtime, cache, memory, dspy, tree-of-thoughts, swe-runner,
  wasm-tools, plugin-host, offload, maif, tui). No `agileplus-api`-style
  HTTP, no gRPC, no MCP server. **Status: N/A by design.**
- **Public crate surface is Rust traits + fns**, e.g. `thegent-memory`
  exposes `client.rs` + `error.rs` + `lib.rs` (all `pub`-re-exported in
  `lib.rs`). No OpenAPI / JSONSchema / Protobuf. **Status: ✗** for schema
  artifacts (but **N/A** for thegent's role).
- **Re-exports — `crates/thegent-maif/src/lib.rs` and others**: small,
  focused `pub use` blocks. **Status: ✓.**
- **Versioning**: every crate pinned to `version = "0.1.0"` (e.g.
  `crates/thegent-memory/Cargo.toml:3`,
  `crates/thegent-runtime/Cargo.toml:4`,
  `crates/thegent-dspy/Cargo.toml:3`). Pre-1.0. **Status: △** (no
  per-crate CHANGELOG.md, no `cargo-semver-checks`).
- **The `thegent-dspy` crate is a Python shim around DSPy** —
  `crates/thegent-dspy/src/{__init__.py, compiler.py, predict.py,
  teleprompter.py, module.py}` (per `ls crates/thegent-dspy/src/`).
  This is a multi-language surface; SOTA ML frameworks pin a single
  language (DSPy is Python-only upstream). **Status: △** — wrapping DSPy
  in a Rust crate that contains Python is fine, but a versioned
  Python `pyproject.toml` would be SOTA. None found in this audit window.
- **API stability tests**: **absent** for thegent. No
  `thegent-contract-tests/` crate, no trait-compatibility tests.
  **Status: ✗.**
- **Idempotency / pagination / error envelopes**: not applicable —
  thegent is a library substrate, not a service.

### Tracely (5 crates: tracely-core, helix-tracing, tracely-sentinel, zerokit, pheno-logging-zig)

- **Clean focused surface — `tracely-core/src/lib.rs:1-29`**: 2 modules
  (`logging`, `tracing`), 4 re-exports at crate root
  (`LogContext`, `LoggerConfig`, `TraceContext`, `TracingConfig`).
  **Status: ✓** (a model of minimal API surface).
- **Pagination primitives — `tracely-core/src/pagination.rs:1-365`**:
  three strategies (`OffsetRequest`, `Cursor`, `KeysetRequest`) with
  explicit test coverage (offset clamp, cursor roundtrip + bad-payload
  rejection, keyset filter). **Status: ✓** — this is 2026-grade
  pagination.
- **Rate limiting — `tracely-core/src/rate_limit.rs:1-230`**:
  3 algorithms (TokenBucket, SlidingWindow, LeakyBucket) with uniform
  `try_acquire() -> bool` interface. **Status: ✓.**
- **Resilience port — `tracely-sentinel/src/lib.rs:1-47`**:
  `RateLimiter`, `CircuitBreaker`, `Bulkhead`, validation, config; typed
  `Error` enum (`RateLimiter`, `CircuitBreaker`, `BulkheadExhausted`).
  **Status: ✓.**
- **Error envelopes**: each module uses
  `#[derive(Debug, thiserror::Error)]` for typed errors. No HTTP/gRPC
  envelope because there's no transport. **Status: N/A.**
- **OpenAPI / JSONSchema / Protobuf**: **absent**. **Status: ✗** (but
  N/A — Tracely is a library, not a service).
- **Versioning**: workspace pinned to `version = "0.1.0"`
  (`Tracely/Cargo.toml:5`). Pre-1.0. **Status: △.**
- **Idempotency**: N/A (no transport).
- **API stability tests**: only the in-file `#[cfg(test)]` blocks
  (`tracely-core/src/pagination.rs:302-365`,
  `tracely-sentinel/src/circuit_breaker.rs:163-194`). No
  cross-crate contract suite. **Status: △.**

### Tracera (1 Rust port + Python FastAPI + Go backend)

- **Canonical Rust types — `tracera-core/src/lib.rs:51-321`**:
  - `TraceLinkType` (7 variants: Satisfies, Verifies, Implements,
    DerivesFrom, Refines, ConflictsWith, Duplicates)
  - `ArtifactKind` (7 variants: Requirement, Design, Code, Test,
    Evidence, Risk, Rationale)
  - `RequirementStatus` (7 states, ISO 29148 §5.2.8)
  - `VerificationMethod` (5 methods, DO-178C / IEEE 1012)
  - `CoverageState` (5: Covered, Partial, Missing, Stale, Conflict)
  - `ArtifactRef` tagged enum (7 variants via `#[serde(tag = "kind")]`)
  - `as_db_str()` and `as_str()` helpers for SQL/Neo4j round-trip.
  **Status: ✓** — this is SOTA-grade vocabulary locking.
- **Validation in `new()` constructors**:
  - `TraceLink::new` rejects self-loop (`tracera-core/src/lib.rs:208-237`)
  - `Requirement::new` rejects wrong artifact kind
    (`tracera-core/src/lib.rs:168-186`)
  - `confidence: f32` is **not yet validated** at constructor
    (`tracera-core/src/lib.rs:198` — comment says 0.0..=1.0 but the
    `TraceLinkError::BadConfidence` variant exists at `lib.rs:286` and
    is not yet invoked). **Status: △.**
- **Declarative Neo4j schema — `tracera-core/src/lib.rs:323-385`**:
  `Neo4jSchema::CONSTRAINTS` (3) + `Neo4jSchema::INDEXES` (4), all
  with `IF NOT EXISTS`; `all_statements()` returns the apply order.
  **Status: ✓** (idempotent DDL is a 2026 best practice).
- **Pagination — `tracera-core/src/pagination.rs:1-365`** (read above
  via grep for the same path; this is the same file in `tracera-core`):
  3 strategies, versioned cursor (`v1:` prefix), `PaginationError` enum.
  **Status: ✓.**
- **Rate limiting — `tracera-core/src/rate_limit.rs:1-230`**: 3
  strategies, all `Send + Sync` synchronous. **Status: ✓.**
- **Python FastAPI surface — `src/tracertm/api/main.py:1-22`**:
  `FastAPI(title="Tracera API", version="0.2.0")`,
  `RequestIdMiddleware` (from `phenotype_request_id.fastapi`),
  `/api/v1/traceability/*` router. **Status: ✓** (request-id
  middleware is a Stripe-style 2026 pattern).
- **Pydantic v2 request/response — `src/tracertm/api/routers/traceability.py:33-93`**:
  `TraceLinkInput` (with `Field(..., min_length=1)`, `ge=0.0, le=1.0`
  on confidence), `CoverageMatrixRequest` (with `stale_after_days:
  int = Field(90, ge=1)`), `ImpactRequest` (with `min_length=1` on
  `changed_artifact_ids`, `max_depth: int = Field(10, ge=0)`).
  **Status: ✓** — Pydantic v2 with `Literal[...]` enums is the 2026
  standard for FastAPI.
- **Spec-first governance — `src/tracertm/governance.py:1-116`**:
  typed `GovernanceSpec` / `GovernanceTrace` / `GovernanceViolation` /
  `GovernanceReport` with Pydantic v2 + `Literal["pass","fail"]` and
  `status: Literal["draft","approved","implemented"]` enum. Validator
  function `evaluate_spec_first_governance()` returns
  `GovernanceReport`. **Status: ✓.**
- **OpenAPI artifact**: not yet checked-in (FastAPI auto-generates
  `/openapi.json` at runtime, but no committed `openapi.yaml` /
  `openapi.json` was found in this audit window — confirmed by
  `find . -name "openapi*"` returning only `.mypy_cache` entries).
  **Status: △** (auto-generated, not committed/drift-checked).
- **Protobuf**: **absent** in Tracera. **Status: ✗.**
- **Idempotency keys**: **absent** on
  `POST /api/v1/traceability/coverage-matrix` /
  `POST /api/v1/traceability/governance/spec-check` /
  `POST /api/v1/traceability/impact`. **Status: ✗.**
- **Versioning**: workspace `0.1.0`; FastAPI surface "0.2.0";
  per-route, no per-route version. **Status: △.**
- **Error envelope (Python)**: FastAPI default `{"detail": ...}` —
  not a Stripe-style structured envelope. **Status: △.**
- **API stability tests**:
  - Rust: 8 in-file unit tests in `tracera-core/src/lib.rs:387-490`
    (roundtrip, self-loop, wrong kind, db_strings, ui_link, neo4j
    schema, neo4j labels) — **good unit coverage, no API contract
    suite.**
  - Python: `tests/test_traceability_api.py` (per `find` above) — at
    least one API test file exists. **Status: △** (presence
    confirmed, depth not audited here).
- **Re-exports — `tracera-core/src/lib.rs:31-44`**: 11 modules
  re-exported at crate root (`cache::*`, `coverage::*`, `health::*`,
  `impact::*`, `matrix::*`, `notification::*`, `observability::*`,
  `pagination::*`, `rate_limit::*`, `registry::*`, `ui_links::*`).
  **Status: ✓.**

## Gaps

1. **`agileplus-api` error envelope is `{"error": "..."}` only** — no
   `code`, no `request_id`, no `type` discriminator. **Effort: S** (3-5
   tool calls; touch `error.rs:52` and the `IntoResponse` impl).
2. **AgilePlus OpenAPI is MVP (5 of 36 routes)** — see
   `agileplus-api/src/openapi.rs:37-40`. No drift check wired. **Effort: M**
   (annotate the remaining 31 routes; wire a CI step that
   `cargo run --bin agileplus-api -- --dump-openapi` and diff).
3. **No idempotency keys on AgilePlus POST endpoints** (`router.rs:11-27`).
   The pattern exists in `agileplus-factory/src/queue.rs` but is not
   plumbed to HTTP. **Effort: S** (one new middleware, four headers
   threaded).
4. **No pagination on AgilePlus list endpoints** — `tracera-core` has it
   but `agileplus-api` doesn't import it; list handlers return
   `Vec<Response>` directly. **Effort: S** (re-export and apply).
5. **No `cargo-semver-checks` or API stability suite** in any of the
   three Rust workspaces. **Effort: M** (CI step + utoipa snapshot test).
6. **`thegent-dspy` is a Rust crate that contains Python** — no
   `pyproject.toml` (would be the SOTA surface for a hybrid crate).
   **Effort: S** (add a stub pyproject + version pin).
7. **Tracera Python OpenAPI is auto-generated, not committed or
   drift-checked**. **Effort: S** (commit `openapi.json`, add CI diff).
8. **AgilePlus `StoragePort` is 93 methods wide** — risks review
   surface; SOTA ports split per-aggregate. **Effort: L** (split
   `StoragePort` into `FeatureRepository`, `WorkPackageRepository`, etc.,
   keep `StoragePort` as a marker trait).
9. **Tracera `TraceLink::new` does not yet validate `confidence` in
   range** (`tracera-core/src/lib.rs:208-237`) — `TraceLinkError::BadConfidence`
   is defined but unused. **Effort: S** (one if-check).
10. **No `cargo-public-api` snapshot test** for any Rust workspace —
    public surface drift is invisible to CI. **Effort: M** (add
    `cargo-public-api` baseline and review on PR).

## Recommendations

1. **Add Stripe-style error envelope to `agileplus-api`** (`error.rs:30-53`).
   Replace `Json(json!({"error": message}))` with
   `Json(json!({"code": variant_name, "message": message, "request_id":
   req_id, "type": "https://docs/errors/<slug>"}))`. Wire request_id
   from a new `RequestIdLayer` (mirroring
   `phenotype_request_id.fastapi` from Tracera). 1 PR, 1 day.
2. **Annotate all 36 routes with `#[utoipa::path(...)]` and enable
   drift check in CI** (`agileplus-api/src/openapi.rs:33-69`). 1 PR, 3 days.
3. **Introduce `Idempotency-Key` middleware** modeled on Stripe:
   - Header: `Idempotency-Key: <uuid>`
   - Store `(key, route, body_hash, response)` in a TTL'd table
   - Replay cached response on duplicate
   - 1 PR, 2 days; touches `agileplus-api/src/middleware/`.
4. **Adopt `tracera-core::pagination` in `agileplus-api`** — re-export
   `OffsetRequest` from `tracera-core` and apply to all `list_*` routes.
5. **Split `StoragePort` per-aggregate** — `FeatureRepository` (CRUD on
   features), `WorkPackageRepository`, `CycleRepository`, etc. Re-export
   the union as a marker trait. 1 PR, 1 week; matches
   `agileplus-domain/src/ports.rs:286-318` blanket-impl pattern.
6. **Wire `cargo-semver-checks` and `cargo-public-api`** as
   mandatory CI checks in `AgilePlus/.github/workflows/`. 1 PR, 1 day.
7. **Commit Tracera's auto-generated `openapi.json`** at
   `Tracera/docs/openapi.json`; add CI diff against `src/tracertm/api/`.
8. **Add `TraceLink::new` confidence range check** — 1 line, 1 day.
9. **Add `pyproject.toml` to `thegent-dspy`** mirroring upstream DSPy
   version, even if the binary is invoked from Rust. 1 PR, 1 day.
10. **Publish per-crate CHANGELOG.md** with a `## API` section listing
    breaking changes — current `cliff.toml` config emits release notes
    but no API surface diff. 1 PR per repo, 1 day each.
