# Phenotype-Error-Core Extraction Spec

> Status: **v0.3.0 consolidation plan**
> Author: Muse (strategic planning)
> Date: 2026-06-14
> Target crate: `phenoShared/crates/phenotype-error-core/`

## 0. Executive Summary

The `phenotype-error-core` crate **already exists** at `phenoShared/crates/phenotype-error-core/` (v0.2.0) and exports 6 error enums plus an envelope, a context trait, and a wire-code contract pinned to `phenoShared/contracts/errors/error-codes.json`. This is therefore a **consolidation spec, not a from-scratch extraction**.

Objective: deprecate the **22 duplicate error enums** scattered across the workspace and route every consumer through the canonical types in `phenotype-error-core`.

---

## 1. Current State Survey

### 1.1 Method

- **Search patterns**: `pub enum.*Error`
- **Tool**: `fs_search` scoped to `/Users/kooshapari/CodeProjects/Phenotype/repos`
- **Result**: **28 enum declarations** matched across the workspace
  - 27 in `phenoShared/`
  - 1 in `pheno-errors/src/lib.rs:1`

### 1.2 Enums already in `phenotype-error-core` (the canonical 6)

| # | Enum | File:Line | Variants | Derives / From impls |
|---|------|-----------|----------|---------------------|
| 1 | `ApiError` | `phenoShared/crates/phenotype-error-core/src/layered.rs:9` | 9 (BadRequest, Unauthorized, Forbidden, NotFound, Conflict, RateLimited, Timeout, Internal, Domain, Repository) | `thiserror` + `#[from] DomainError` + `#[from] RepositoryError` |
| 2 | `DomainError` | `phenoShared/crates/phenotype-error-core/src/layered.rs:79` | 8 (Validation, InvariantViolation, NotFound, Duplicate, InvalidStateTransition, NotPermitted, PolicyEvaluation, Other) | `thiserror` |
| 3 | `RepositoryError` | `phenoShared/crates/phenotype-error-core/src/layered.rs:100` | 8 (NotFound, Duplicate, Connection, Query, Serialization, SequenceGap, Integrity, Storage) | `thiserror` + `#[from] StorageError` + `From<serde_json::Error>` |
| 4 | `ConfigError` | `phenoShared/crates/phenotype-error-core/src/layered.rs:127` | 10 (FileNotFound, FileRead, Parse, Deserialize, UnsupportedFormat, Validation, MissingRequired, Environment, Other) | `thiserror` + `From<std::io::Error>` + `From<serde_json::Error>` |
| 5 | `StorageError` | `phenoShared/crates/phenotype-error-core/src/layered.rs:165` | 6 (Io, NotFound, PermissionDenied, CapacityExceeded, Connection, Other) | `thiserror` + `#[from] std::io::Error` |
| 6 | `ErrorCode` | `phenoShared/crates/phenotype-error-core/src/code.rs:6` | 19 wire codes (INTERNAL_ERROR … TERMINAL_BINDING_INVALID) | `serde(SCREAMING_SNAKE_CASE)` + `as_str()` |

Helpers (also in crate):
- `ErrorEnvelope` — `phenoShared/crates/phenotype-error-core/src/envelope.rs:9` (struct)
- `ErrorContext` trait — `phenoShared/crates/phenotype-error-core/src/context.rs:2`
- `phenoShared/contracts/errors/error-codes.json` — pinned wire fixture (19 codes)

Test coverage already present:
- 12 tests in `layered.rs:180-304` (status codes, error codes, retryability, `From` chains, anyhow interop)
- 2 tests in `envelope.rs:72-105` (envelope ↔ JSON fixture parity)
- 2 tests in `code.rs:78-93` (serialization, contract-order parity)
- 1 test in `context.rs:13-22` (context helper)

### 1.3 Duplicate enums (22 candidates for migration)

| # | Duplicate | File:Line | Maps to canonical |
|---|-----------|-----------|-------------------|
| 1 | `NanovmsError` | `phenoShared/crates/phenotype-nanovms-client/src/lib.rs:55` (10 variants) | new `AdapterError` + deprecated alias |
| 2 | `HarnessError` | `phenoShared/crates/phenotype-harness/src/lib.rs:38` | `DomainError::Other` / `::Internal` |
| 3 | `ValidationError` | `phenoShared/crates/phenotype-string/src/validate.rs` | `DomainError::Validation` |
| 4 | `IdError` | `phenoShared/crates/phenotype-string/src/id.rs` | `DomainError::Validation` |
| 5 | `TimeError` | `phenoShared/crates/phenotype-time/src/lib.rs:38` (2 variants) | `DomainError::Validation` + `::Parse` |
| 6 | `StateMachineError` | `phenoShared/crates/phenotype-state-machine/src/domain/entities/mod.rs:18` | `DomainError::InvalidStateTransition` |
| 7 | `RepositoryError` (state-machine) | `phenoShared/crates/phenotype-state-machine/src/domain/ports/outbound/mod.rs:42` | canonical `RepositoryError` |
| 8 | `PublisherError` | `phenoShared/crates/phenotype-state-machine/src/domain/ports/outbound/mod.rs:73` | new `AdapterError::Publish` |
| 9 | `EventSourcingError` | `phenoShared/crates/phenotype-event-sourcing/src/error.rs:7` | new `EventSourcingError` wrapper |
| 10 | `EventStoreError` | `phenoShared/crates/phenotype-event-sourcing/src/error.rs:19` | canonical `RepositoryError` + `SequenceGap` |
| 11 | `HashError` | `phenoShared/crates/phenotype-event-sourcing/src/error.rs:37` | `DomainError::InvariantViolation` |
| 12 | `PostgresError` | `phenoShared/crates/phenotype-postgres-adapter/src/error.rs:5` (**anti-pattern**) | canonical `RepositoryError` |
| 13 | `RedisError` | `phenoShared/crates/phenotype-redis-adapter/src/error.rs:5` (**anti-pattern**) | canonical `RepositoryError` |
| 14 | `HttpError` | `phenoShared/crates/phenotype-http-adapter/src/error.rs:5` (**anti-pattern**) | canonical `ApiError` |
| 15 | `PortError` | `phenoShared/crates/phenotype-port-interfaces/src/error.rs:9` (12 variants) | `DomainError` + `RepositoryError` |
| 16 | `GovernanceError` | `phenoShared/crates/phenotype-governance/src/lib.rs:40` | new `GovernanceError` in core (RFC) |
| 17 | `ObservabilityError` | `phenoShared/crates/phenotype-observability-core/src/lib.rs:30` | new `ObservabilityError` in core (RFC) |
| 18 | `SchemaError` | `phenoShared/crates/phenotype-schema-core/src/lib.rs:38` | new `SchemaError` in core (RFC) |
| 19 | `PolicyEngineError` | `phenoShared/crates/phenotype-policy-engine/src/error.rs:7` | new `PolicyError` in core (RFC) |
| 20 | `BusCoreError` | `phenoShared/crates/phenotype-bus-core/src/lib.rs:22` | new `BusError` in core (RFC) |
| 21 | `ConfigError` aliases | `phenoShared/crates/phenotype-config-core/src/lib.rs` (2 enums) | canonical `ConfigError` (drop alias) |
| 22 | `pheno-errors` enum | `pheno-errors/src/lib.rs:1` | re-export from core (single SSOT) |

Plus 6 enum declarations in `state-machine/application/use_cases`, `state-machine/domain/services`, `event-sourcing/domain/entities`, `event-sourcing/application/use_cases`, `event-sourcing/domain/ports/outbound`, `application/lib.rs`, `registry-core` — total matches the **27-line count** from `phenoShared` (5 of those lines are in `phenotype-error-core` itself, leaving 22 duplicates plus the multi-enum files).

---

## 2. Common Pattern Identification

Two patterns coexist; the canonical one is `thiserror`.

### 2.1 Preferred (canonical) — used in 18 of 22 duplicates and all 6 core enums

```rust
#[derive(thiserror::Error, Debug)]
pub enum FooError {
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<serde_json::Error> for FooError { ... }
```

- `#[derive(thiserror::Error, Debug)]` — declarative `Display` via `#[error("…")]`
- `#[error(transparent)]` + `#[from]` for nested-error composition
- Manual `From<serde_json::Error>`, `From<std::io::Error>` etc. for upstream types
- `pub type Result<T> = std::result::Result<T, FooError>` crate-local alias

### 2.2 Legacy (anti-pattern) — used in 3 duplicates

```rust
// phenotype-postgres-adapter/src/error.rs:4-27
#[derive(Debug)]
pub enum PostgresError {
    Connection(String), Query(String), NotFound(String), ...
}
impl std::fmt::Display for PostgresError { match self { ... } }
impl std::error::Error for PostgresError {}
impl From<serde_json::Error> for PostgresError { ... }
```

- Found in `PostgresError`, `RedisError`, `HttpError`
- ~25 LoC of boilerplate per enum that `thiserror` collapses to ~10
- Highest-priority migration targets (most LoC removed)

### 2.3 Serde-tagged hybrid — keep as-is (Phase 2 deferral)

`GovernanceError` (`phenotype-governance/src/lib.rs:39`), `ObservabilityError` (`phenotype-observability-core/src/lib.rs:29`), `SchemaError` (`phenotype-schema-core/src/lib.rs:37`) all use:

```rust
#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GovernanceError { ... }
```

- These need careful wire-shape handling. **Do not migrate in Phase 2** — see Risk 4.

---

## 3. Proposed Shared Crate: `phenotype-error-core`

### 3.1 Current state (v0.2.0)

`phenoShared/crates/phenotype-error-core/` already exists. `Cargo.toml` declares:

```toml
[package]
name = "phenotype-error-core"
version = "0.2.0"
[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
anyhow = { workspace = true }
```

Public re-exports (`src/lib.rs:12-15`):
```rust
pub use code::{ErrorCode, ERROR_CODES};
pub use context::ErrorContext;
pub use envelope::ErrorEnvelope;
pub use layered::{ApiError, ConfigError, DomainError, RepositoryError, StorageError};
```

### 3.2 Target state (v0.3.0)

**No greenfield creation required.** Bump version and add 5 new enums + 1 module split.

```
phenotype-error-core/
├── Cargo.toml              # version 0.3.0
├── src/
│   ├── lib.rs              # re-exports (extend)
│   ├── code.rs             # ErrorCode, ERROR_CODES       (existing)
│   ├── envelope.rs         # ErrorEnvelope                (existing)
│   ├── context.rs          # ErrorContext trait           (existing)
│   ├── layered.rs          # Api/Domain/Repository/Config/Storage (existing)
│   ├── adapter.rs          # AdapterError                (NEW)
│   ├── governance.rs       # GovernanceError, ObservabilityError, SchemaError (NEW)
│   ├── policy.rs           # PolicyError                 (NEW)
│   └── bus.rs              # BusError                    (NEW)
└── tests/
    └── contract_parity.rs  # asserts ErrorCode matches phenoShared/contracts/errors/error-codes.json
```

### 3.3 Re-export pattern in consuming crates

Each consumer keeps a **deprecated type alias** (not a re-declared enum) for source-compat:

```rust
// phenotype-postgres-adapter/src/error.rs (deprecated in v0.3.0)
#[deprecated(since = "0.3.0", note = "use phenotype_error_core::RepositoryError")]
pub type PostgresError = phenotype_error_core::RepositoryError;
```

This avoids binary-incompat issues for crates that re-export the type in their public API (e.g. `phenotype-port-interfaces::PortError` is referenced in `phenotype-state-machine/src/domain/ports/outbound/mod.rs:23`).

### 3.4 New enum RFCs (sketch)

- **`AdapterError`** — generic transport/adapter failure (Connection, Timeout, Serialization, Backend, InvalidResponse). Wraps `reqwest::Error`, `tokio_postgres::Error`, `redis::RedisError`, etc. Replaces `NanovmsError`, `HttpError`, `PostgresError`, `RedisError`, `EventStoreError`.
- **`GovernanceError`** — AuthenticationFailed, AuthorizationDenied, RoleNotFound, PolicyViolation, AuditUnavailable, Internal. Replaces `GovernanceError` in `phenotype-governance`.
- **`ObservabilityError`** — MetricNotFound, ExportFailed, HealthCheckFailed, Unavailable, Internal.
- **`SchemaError`** — ValidationFailed, TypeMismatch, RequiredField, RegexFailed, RangeError, Unavailable, Internal.
- **`PolicyError`** — RegexCompilation, Evaluation, InvalidConfiguration, PolicyNotFound, Serialization, Load, Other.
- **`BusError`** — ChannelClosed, HandlerFailed, Unavailable, Internal.

All must be **data-only** (no business types) to avoid circular deps (see Risk 5).

---

## 4. Migration Phases

### Phase 1 — Define (days 1-2)
- [ ] Bump `phenotype-error-core` from v0.2.0 → v0.3.0
- [ ] Add 5 new enums in `src/adapter.rs`, `src/governance.rs`, `src/policy.rs`, `src/bus.rs`
- [ ] Extend `lib.rs` re-exports with new enums
- [ ] Add unit tests for every new `From` impl and variant (mirror the test density in `layered.rs:180-304`)
- [ ] Add `tests/contract_parity.rs` asserting `ERROR_CODES` matches `phenoShared/contracts/errors/error-codes.json`

### Phase 2 — Adopt (days 3-5)
- [ ] Add `phenotype-error-core = { workspace = true }` to every consuming crate's `Cargo.toml`
- [ ] Replace each duplicate `pub enum` with a `#[deprecated]` type alias
- [ ] Migrate `match` sites inside the consumer crate to use canonical variants (e.g. `PostgresError::Connection` → `RepositoryError::Connection`)
- [ ] Keep crate-local `Result<T>` aliases pointing at the deprecated alias (no external breakage)
- [ ] Anti-pattern trio first: `phenotype-postgres-adapter`, `phenotype-redis-adapter`, `phenotype-http-adapter` (highest LoC reduction)
- [ ] Then: `phenotype-string`, `phenotype-time`, `phenotype-state-machine`, `phenotype-event-sourcing`
- [ ] Then: `phenotype-port-interfaces`, `phenotype-policy-engine`, `phenotype-governance`, `phenotype-observability-core`, `phenotype-schema-core`, `phenotype-bus-core`, `phenotype-harness`, `phenotype-config-core`, `phenotype-application`, `phenotype-registry-core`

### Phase 3 — Deprecate duplicates (days 6-7)
- [ ] Delete manual `impl Display` / `impl Error` / `impl From<serde_json::Error>` blocks from the anti-pattern trio
- [ ] Run `cargo build --workspace` — verify only the documented 22 deprecation warnings fire
- [ ] Run `cargo clippy --workspace --all-targets -- -D warnings` — must be green
- [ ] Run `cargo test --workspace` — all 17+ tests in `phenotype-error-core` must pass; no regressions in consumers
- [ ] Run `cargo public-api` diff — confirm only `phenotype-error-core` has new public types
- [ ] Generate migration report: 22 enums deprecated, 5 new enums added, 0 breaking in v0.3.0
- [ ] Remove deprecation aliases in v0.4.0 (next minor release)

---

## 5. Effort Estimate: 1 week

| Day | Work | Output |
|-----|------|--------|
| 1 | RFC + new enum designs in core | PR: `phenotype-error-core@0.3.0` |
| 2 | Tests for new enums + contract parity | PR: tests passing |
| 3 | Migrate anti-pattern trio (Postgres, Redis, Http adapters) | 3 PRs merged |
| 4 | Migrate string, time, state-machine, event-sourcing | 4 PRs merged |
| 5 | Migrate remaining 11 crates + pheno-errors | 11 PRs merged |
| 5 PM | `cargo clippy --workspace -- -D warnings` + `cargo test --workspace` | green CI |

**Total: 1 dev × 5 days = 1 dev-week.** Stretch to 7 days if RFC review for the 5 new enums takes more than half a day, or if `PortError` extension (see Risk 2) requires extra design discussion.

---

## 6. Risk Assessment

### Risk 1 — Public-API breakage for downstream consumers
- **Severity**: High
- **Likelihood**: Medium
- **Description**: 22 deprecated enums may be `pub use`-d by external crates. `phenotype-port-interfaces::error::PortError` is referenced in trait signatures at `phenotype-state-machine/src/domain/ports/outbound/mod.rs:23`.
- **Mitigation**: Use `#[deprecated]` type aliases, not deletions. Land deprecations in v0.3.0; remove aliases in v0.4.0.

### Risk 2 — `PortError` is richer than `DomainError`
- **Severity**: Medium
- **Likelihood**: High
- **Description**: `phenotype-port-interfaces/src/error.rs:9-42` has 12 variants (NotFound, AlreadyExists, Validation, Storage, Connection, Timeout, PermissionDenied, InvalidState, InvalidData, Serialization, Config). `DomainError` has 8.
- **Mitigation**: Extend `DomainError` with `PermissionDenied`, `InvalidState`, `InvalidData`, `Connection`, `Timeout` variants in v0.3.0 (additive, backward-compatible). Map `PortError::X` → `DomainError::X` 1:1 in the deprecation alias.

### Risk 3 — Wire-contract drift on `ErrorCode`
- **Severity**: High (consumer-visible)
- **Likelihood**: Low (test exists)
- **Description**: Adding new error codes in v0.3.0 could break the TypeScript package `@phenotype/errors` if not coordinated.
- **Mitigation**: The contract parity test at `code.rs:88-93` pins `ERROR_CODES` to `phenoShared/contracts/errors/error-codes.json`. Any new code must update the JSON fixture in the same PR. Cross-language parity check in CI.

### Risk 4 — Serde representation change for serde-tagged enums
- **Severity**: Medium
- **Likelihood**: Medium
- **Description**: `GovernanceError` (`phenotype-governance/src/lib.rs:39`) uses `#[serde(tag = "kind", rename_all = "snake_case")]`. The canonical `DomainError` does not derive `Serialize`/`Deserialize`. Adoption would change wire shape.
- **Mitigation**: Do **not** migrate serde-tagged enums in Phase 2. Keep them as-is. If unification is needed, file a separate RFC and propose adding `Serialize`/`Deserialize` to `DomainError` with a stable schema.

### Risk 5 — Circular dependency introduction
- **Severity**: High (build break)
- **Likelihood**: Low
- **Description**: `phenotype-error-core` is a leaf crate with no workspace dependencies. Adding it as a dep to all 22 crates is one-way. But: if any new enum pulls in a sibling (e.g., `GovernanceError` needing `Subject`/`Role`), we'd cycle.
- **Mitigation**: All new enums in v0.3.0 must be data-only (no business types). If a future RFC needs business types, gate behind a feature flag.

### Risk 6 — Test-suite gap in the existing crate
- **Severity**: Low
- **Likelihood**: Low
- **Description**: `phenotype-error-core` has 12 tests in `layered.rs:180-304`, 2 in `envelope.rs:72-105`, 2 in `code.rs:78-93`, 1 in `context.rs:13-22`. No doctests on the new enums, no proptests, no fuzzing.
- **Mitigation**: Add doctests to each new enum's `pub enum` doc-comment in v0.3.0. Add proptest for `ErrorEnvelope` round-trip in v0.3.1.

### Risk 7 — `pheno-errors` is outside `phenoShared/`
- **Severity**: Low
- **Likelihood**: Low
- **Description**: `pheno-errors/src/lib.rs:1` has a `pub enum.*Error` declaration. This crate is at the workspace root, not under `phenoShared/`. It may have its own `Cargo.toml` with different version pinning.
- **Mitigation**: Audit `pheno-errors/Cargo.toml` before migration. Likely outcome: `pheno-errors` becomes a thin re-export crate `pub use phenotype_error_core::*;` with a `phenotype-error-core` workspace dep.

### Risk 8 — `phenotype-state-machine` has TWO `RepositoryError` types
- **Severity**: High
- **Likelihood**: High
- **Description**: `phenotype-state-machine/src/domain/ports/outbound/mod.rs:42` declares `RepositoryError` — a *different* type with the same name as the canonical `phenotype-error-core::RepositoryError`. The local one has variants `NotFound`, `Persist`, `Serialization` (3) vs the canonical's 8.
- **Mitigation**: Treat as a rename candidate. Alias local `RepositoryError` to canonical, then update all `use` statements in `phenotype-state-machine`. Compile errors will surface all call sites.

---

## 7. Verification Criteria

1. `cargo build -p phenotype-error-core` succeeds at v0.3.0 with the 5 new enums
2. `cargo test -p phenotype-error-core` passes 17+ existing tests + new enum tests
3. `cargo test -p phenotype-error-core --test contract_parity` passes (new test pinning `ErrorCode` ↔ JSON fixture)
4. `cargo build --workspace` succeeds with **exactly 22 deprecation warnings** (one per deprecated alias)
5. `cargo clippy --workspace --all-targets -- -D warnings` is clean
6. `phenoShared/contracts/errors/error-codes.json` (19 codes) matches `phenotype_error_core::ERROR_CODES` exactly
7. `pheno-errors` is reduced to a re-export crate, ≤ 20 LoC
8. `cargo public-api` diff: 11 enums in `phenotype-error-core` (6 + 5 new), 0 new enums in any other crate
9. Anti-pattern trio: `PostgresError`, `RedisError`, `HttpError` no longer carry manual `impl Display` blocks
10. LoC reduction: ≥ 75 LoC removed from the 3 anti-pattern files combined

---

## 8. Out of Scope

- TypeScript `@phenotype/errors` package (separate consolidation)
- `anyhow` migration strategy (already supported via `#[from]` chain in `layered.rs`)
- Error observability/metrics (separate `phenotype-observability-core` workstream)
- Renaming any existing public type in `phenotype-error-core` (additive only in v0.3.0)

---

## 9. Appendix — File Inventory

### Files in `phenotype-error-core` (v0.2.0)
- `phenoShared/crates/phenotype-error-core/Cargo.toml`
- `phenoShared/crates/phenotype-error-core/src/lib.rs`
- `phenoShared/crates/phenotype-error-core/src/code.rs`
- `phenoShared/crates/phenotype-error-core/src/envelope.rs`
- `phenoShared/crates/phenotype-error-core/src/context.rs`
- `phenoShared/crates/phenotype-error-core/src/layered.rs`
- `phenoShared/contracts/errors/error-codes.json` (19 codes)

### Files with duplicates (22 source files)
- `phenoShared/crates/phenotype-nanovms-client/src/lib.rs`
- `phenoShared/crates/phenotype-harness/src/lib.rs`
- `phenoShared/crates/phenotype-string/src/validate.rs`
- `phenoShared/crates/phenotype-string/src/id.rs`
- `phenoShared/crates/phenotype-time/src/lib.rs`
- `phenoShared/crates/phenotype-state-machine/src/domain/entities/mod.rs`
- `phenoShared/crates/phenotype-state-machine/src/domain/ports/outbound/mod.rs`
- `phenoShared/crates/phenotype-state-machine/src/application/use_cases/mod.rs`
- `phenoShared/crates/phenotype-postgres-adapter/src/error.rs`
- `phenoShared/crates/phenotype-redis-adapter/src/error.rs`
- `phenoShared/crates/phenotype-http-adapter/src/error.rs`
- `phenoShared/crates/phenotype-port-interfaces/src/error.rs`
- `phenoShared/crates/phenotype-governance/src/lib.rs`
- `phenoShared/crates/phenotype-observability-core/src/lib.rs`
- `phenoShared/crates/phenotype-schema-core/src/lib.rs`
- `phenoShared/crates/phenotype-policy-engine/src/error.rs`
- `phenoShared/crates/phenotype-bus-core/src/lib.rs`
- `phenoShared/crates/phenotype-config-core/src/lib.rs`
- `phenoShared/crates/phenotype-event-sourcing/src/error.rs`
- `phenoShared/crates/phenotype-event-sourcing/src/domain/entities/mod.rs`
- `phenoShared/crates/phenotype-event-sourcing/src/domain/services/mod.rs`
- `phenoShared/crates/phenotype-event-sourcing/src/domain/ports/outbound/mod.rs`
- `phenoShared/crates/phenotype-event-sourcing/src/application/use_cases/mod.rs`
- `phenoShared/crates/phenotype-application/src/lib.rs`
- `phenoShared/crates/phenotype-registry-core/src/lib.rs`
- `pheno-errors/src/lib.rs`
