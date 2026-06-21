# L14 — Error handling & user feedback

**Owner:** forge-A08 (UX)
**Scope:** Per-crate error types, user-facing error envelope, recovery suggestions, Sentry/error tracking.
**Status legend:** ✓ implemented · △ partial · ✗ missing

## Scope

How the bloc surfaces failures to (a) developers (typed error enums, structured context) and (b) end users (CLI/HTTP envelopes, recovery hints). Includes the cross-ecosystem `phenotype-error-core` wire contract that keeps Rust ↔ TypeScript errors in lockstep.

## SOTA 2026

- Per-crate strongly-typed error enums (thiserror) with a `From<DomainError> for ApiError` boundary mapper.
- Shared wire envelope `{code, message, details, retryable, fatal}` shared across languages.
- Stable `ErrorCode` enum with `SCREAMING_SNAKE_CASE` wire form, mirrored in TS.
- Layered taxonomy: `DomainError → RepositoryError → StorageError → ApiError → ErrorEnvelope`.
- `recovery` / `Suggestion` / `hint()` methods on user-facing variants.
- Backend error reporting via Sentry (`sentry::init`, `sentry::capture_error`) or OpenTelemetry error events.

## Phenotype state

### Error type libraries (Rust)
- `phenoShared/crates/phenotype-error-core/src/lib.rs:1-15` — canonical crate ✓
  - `code.rs:6-30` — `ErrorCode` enum (19 variants), SOTA stable codes
  - `code.rs:34-58` — `ERROR_CODES` array for cross-language parity tests
  - `envelope.rs:7-16` — `ErrorEnvelope { code, message, details, fatal, retryable }` wire struct
  - `envelope.rs:45-50` — `From<&ApiError> for ErrorEnvelope` bridge
  - `layered.rs:1-305` — 5-layer taxonomy (`ApiError`/`ConfigError`/`DomainError`/`RepositoryError`/`StorageError`)
- `crates/focus-errors/Cargo.toml:11` — re-exports/extends `phenotype-error-core` ✓

### TS parity (cross-language)
- `phenoShared/packages/errors/src/index.ts:7-30` — `ErrorCode` enum (1:1 mirror) ✓
- `phenoShared/packages/errors/src/index.ts:52-58` — `PhenotypeErrorEnvelope` interface ✓
- `phenoShared/packages/errors/src/index.ts:64-92` — `HeliosAppError` class with `toJSON()` envelope ✓

### Per-crate error enums
- **AgilePlus (20+ enums)** — `crates/agileplus-domain/src/error.rs:7-60` (14 variants) ✓
  - `crates/agileplus-api/src/error.rs:14-28` — `ApiError` with thiserror
  - `crates/agileplus-api/src/error.rs:30-54` — `IntoResponse` mapper to HTTP status
  - `crates/agileplus-api/src/error.rs:56-100` — `From<DomainError>` + `From<AppError>` boundary mappers
  - `crates/agileplus-p2p/src/error.rs` — `PeerDiscoveryError`, `SyncError`, `ConnectionError`
  - `crates/agileplus-p2p/src/export/errors.rs` — `ExportError`
  - `crates/agileplus-p2p/src/git_merge/types.rs` — `MergeError`
  - `crates/agileplus-nats/src/bus.rs` — `EventBusError`
  - `crates/agileplus-nats/src/nats_adapter.rs` — `NatsEventBusError`
  - `crates/agileplus-plane/src/sync_queue.rs` — `QueueError`
  - `crates/agileplus-triage/src/claim_store_sqlite.rs` — `SqliteClaimStoreError`
  - `crates/agileplus-triage/src/claim.rs` — `ClaimError`
  - `crates/agileplus-artifacts/src/store.rs` — `ArtifactError`
  - `crates/agileplus-governance/src/error.rs` — `GovernanceError`
  - `crates/agileplus-mcp-intent/src/http.rs` — `ApiError` (MCP variant)
  - `crates/agileplus-subcmds/src/tracera_bridge.rs` — `BridgeError`
  - `crates/agileplus-integration-tests/src/common/harness.rs` — `HarnessError`
  - `crates/agileplus-sync/src/error.rs` — `SyncError`
  - `crates/phenotype-mcp-sdk-rs/src/lib.rs` — `McpError`
  - `crates/agileplus-application/src/error.rs` — `AppError` (5-variant boundary error)
  - Domain → wire code projection test suite: `agileplus-domain/src/error.rs:103-190` ✓
- **thegent (20+ enums)** — see `thegent/crates/thegent-*/src/*.rs`:
  - `thegent/crates/thegent-maif/src/lib.rs` — `MaifError`
  - `thegent/crates/thegent-subprocess/src/lib.rs` — `SubprocessError`
  - `thegent/crates/thegent-zmx-interop/src/error.rs` — `ZmxError`
  - `thegent/crates/thegent-policy/src/errors.rs` — `PolicyError`
  - `thegent/crates/thegent-policy/src/cost_enforcer.rs` — `PolicyBudgetError`
  - `thegent/crates/thegent-nvms/src/lib.rs` — `NvmsError`
  - `thegent/crates/thegent-plugin-host/src/domain/entities/mod.rs` — `PluginError`
  - `thegent/crates/thegent-wasm-tools/src/error.rs` — `WasmToolsError`
  - `thegent/crates/thegent-docs/src/lib.rs` — `DocsError`
  - `thegent/crates/thegent-tui/src/themes/mod.rs` — `ThemeLoadError`
  - `thegent/crates/thegent-hooks/src/types.rs` — `HookError`
  - `thegent/crates/thegent-hooks/src/file_discovery.rs` — `FileDiscoveryError`
  - `thegent/crates/thegent-hooks/src/git_ops.rs` — `GitOpsError`
  - `thegent/crates/thegent-hooks/src/git_cache.rs` — `GitCacheError`
  - `thegent/crates/thegent-hooks/src/changed_files.rs` — `ChangedFilesError`
  - `thegent/crates/thegent-hooks/src/affected_tests.rs` — `AffectedTestsError`
  - `thegent/crates/thegent-hooks/src/utils.rs` — `UtilsError`
  - `thegent/crates/thegent-hooks/src/prewarm.rs` — `PrewarmError`
  - `thegent/crates/thegent-hooks/src/report.rs` — `ReportError`
  - `thegent/crates/thegent-jsonl/src/audit.rs` — `AuditError`
  - `thegent/crates/thegent-memory/src/error.rs` — memory error
  - `thegent/libs/nexus/src/error.rs` — `NexusError`
  - `thegent/crates/thegent-hooks/src/colors.rs` — color config errors
- **Tracely** — `crates/tracely-sentinel/src/rate_limiter.rs`, `circuit_breaker.rs`, `bulkhead.rs` — 3 sentinel-pattern enums △
  - No CLI, no API surface, no envelope, no Sentry
- **Tracera (6 enums)** — `crates/tracera-core/src/registry.rs` — `RegistryError`, `crates/tracera-core/src/health.rs` — `HealthError`, `crates/tracera-core/src/notification.rs` — `DispatchError`, `crates/tracera-core/src/config.rs` — `ConfigError` (incl. `SentryConfig`), `crates/tracera-core/src/lib.rs` — `TraceLinkError`, `crates/tracera-core/src/pagination.rs` — `PaginationError` △
  - Declares `phenotype-error-core` dep but does not project to `ErrorCode`/`ErrorEnvelope`

### User-facing CLI error reporting
- `AgilePlus/crates/agileplus-cli/src/main.rs:582` — `eprintln!("error: {e:#}")` with `{:#}` for context chain ✓
- `AgilePlus/crates/agileplus-cli/src/main.rs:583` — `std::process::exit(1)` — basic non-zero exit ✓
- The `eprintln!("error: ...")` pattern in `agileplus-cli` handlers (e.g. line 224, 271, 401) — uses string messages, no structured envelope ✗
- `agileplus-cli/src/main.rs:549,555,562` — wraps `SqliteStorageAdapter` errors with `anyhow::anyhow!("open db: {e}")` — uses anyhow at boundary, doesn't map to ErrorEnvelope ✗
- No rich error reporter (`color_eyre`/`miette`) anywhere in the bloc ✗

### Sentry / error tracking
- **Main bloc repos (AgilePlus, thegent, Tracely, Tracera) — none.** No `sentry` dep, no init, no capture. ✗
- `Tracera/crates/tracera-core/src/config.rs` — `SentryConfig` struct + env-var load (DSN, traces_sample_rate, environment) △ config only
- `Tokn/sentry_config.rs:5-9` — real Sentry init via `sentry::init((dsn, sentry::ClientOptions {…}))` △ present but dep not declared in this version's `Tokn/Cargo.toml` (drift)
- `Tokn/sentry_config.rs:30-35` — `before_send` callback to scrub sensitive blockchain data ✓ good privacy pattern
- `PhenoProc-wtrees/dep-tighten-2026-06-08/.../phenotype-sentry-config/src/lib.rs:1` — `phenotype-sentry-config::initialize() -> sentry::ClientInitGuard` wrapper △
- Satellite usage in worktrees: `HexaKit-wtrees/hexakit-config-error-from-parse-int-20260614/Cargo.toml` (`sentry = "0.34"`), `HexaKit-wtrees/next-hygiene-2026-06-14/Cargo.toml` (`sentry = "0.34"`), `HeliosCLI/codex-rs/Cargo.toml` (`sentry = "0.46.0"`), `HeliosCLI/helios-rs/Cargo.toml` (`sentry = "0.46.0"`) — but no main-bloc integration △
- **No `sentry-sdk` in any Python crate** ✗
- **Sentry event capture is absent from the 4 main bloc repos** ✗

### Recovery suggestions / hints
- `AgilePlus/crates/agileplus-api/src/error.rs:37-43` — `Template` error logs internal message but returns generic `"template render error"` to client (good practice; no internal leak) ✓
- `AgilePlus/crates/agileplus-api/src/error.rs:44-50` — `Internal` error similarly logs + returns generic `"internal server error"` ✓
- No `Suggestion` / `hint()` methods on enum variants ✗
- No CLI-level `--suggest` or `--fix` recovery flow ✗
- API errors carry the raw internal message via `From<DomainError>` (e.g. `ApiError::Internal(other.to_string())` at `agileplus-api/src/error.rs:64`) — leaks internal details to the wire △

## Gaps

1. **No Sentry SDK / error tracking backend** — bloc defines config but never initializes or captures ✗ — effort: M
   - Add `sentry = "0.34"` (or `sentry-actix` / `sentry-tower` for HTTP) to `agileplus-api`, `agileplus-telemetry`, `tracera-core`.
   - Wire `sentry::init` from `SentryConfig` (`Tracera/crates/tracera-core/src/config.rs:1-50`) at startup; call `sentry::capture_error(&e)` at HTTP boundary.
2. **CLI errors do not project to `ErrorEnvelope`** — `agileplus-cli/src/main.rs:582` writes bare string ✗ — effort: S
   - Convert top-level `anyhow::Error` → `ErrorEnvelope` via `phenotype_error_core::ErrorEnvelope::from(...)` and serialize as JSON when `--format json`, plain text otherwise.
3. **Internal error details leak through `From<DomainError>::Internal(other.to_string())`** — `agileplus-api/src/error.rs:64` ✗ — effort: S
   - Log the inner detail with `tracing::error!`, return a generic message and a correlation id.
4. **No recovery / `Suggestion` mechanism** — bloc has none ✗ — effort: M
   - Add `pub fn suggestion(&self) -> Option<&'static str>` to `ApiError` / `DomainError` for actionable messages (e.g. "run `agileplus migrate` to apply pending schema").
5. **No rich diagnostic reporter (`color_eyre` / `miette`)** — bloc still uses bare `anyhow` ✗ — effort: S
   - Replace `anyhow::Result` in CLI binary mains with `color_eyre::Result` so backtraces render with ANSI when `RUST_BACKTRACE=1`.
6. **Tracely has no error envelope projection** — sentinel errors stay internal △ — effort: S
   - Add `From<RateLimiterError>` / `CircuitBreakerError` / `BulkheadError` to `ErrorCode` projection table.
7. **Tracera declares `phenotype-error-core` but does not use `ErrorCode`/`ErrorEnvelope`** — `Tracera/Cargo.toml:25` ✗ — effort: S
   - Project every `tracera-core` error enum variant to an `ErrorCode` (mirroring `agileplus-domain/src/error.rs:70-100`).
8. **No `correlation_id` propagation** — `ErrorEnvelope` lacks `correlation_id` field even though `ErrorCode::MissingCorrelationId` exists in `code.rs:17` △ — effort: M
   - Add `#[serde(skip_serializing_if = "Option::is_none")] pub correlation_id: Option<String>` to `ErrorEnvelope`; populate from tracing span context at every boundary.
9. **Python CLI surface (`thegent/cli/`) has fragmented error handling** — bare `except Exception` in 15+ files ✗ — effort: S
   - Adopt `HeliosAppError` (`phenoShared/packages/errors/src/index.ts:64-92`) analog in Python and raise it from CLI commands.

## Recommendations

1. **Standardize on `phenotype-error-core` as the canonical envelope** for every service in the bloc. Mirror the wire contract in TS (`@phenotype/errors`) and Python (`phenotype.errors.HeliosAppError`) so any error from any layer can be re-emitted on any surface.
2. **Introduce Sentry** in `agileplus-api` and `tracera-core` so that `Internal` / `Storage` errors are captured with their full context. Tracera already has `SentryConfig` — finish the loop.
3. **Enrich user-facing error variants with `Suggestion`** so CLI/API can emit "did you mean to run X?" hints; this is the cheapest UX win and complements L15 (CLI/UX) progress bars and prompts.
4. **Leak no internal details**: any `ApiError::Internal(_)` (and analog) should be logged with full context but returned to the client as a stable, generic message + correlation id.
5. **Project every bloc error enum to `ErrorCode`** so cross-ecosystem logs, Sentry tags, and TS error maps all speak the same vocabulary.
