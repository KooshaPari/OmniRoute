# L1 — Module Structure & Boundaries

## Scope
Per-crate internal layering (domain / application / infrastructure / interface), test scaffolding separation, re-export discipline, and prelude/umbrella patterns across the Phenotype bloc.

## SOTA 2026
- **Anthropic Claude Code** (claude-code-sdk-rs): `claude_code/src/` is layered `domain → service → adapters → bin`; per-crate `prelude` re-exports the 5–10 most-used types; `tests/` lives at workspace root with `#[path = ...]` attrs to reach in-crate fixtures.
- **jlowin/fastmcp**: `server.py` exposes `Server`, `Context`, `Tool`; every sub-component is a separate file; integration tests are kept under `tests/integration/` separate from `tests/unit/`.
- **gastown** (`steveyegge/gastown`): `gastown/agent/<agent_name>/` per-agent folder with `beads/`, `manifest.toml`, `state/`; common kernel in `gastown/bd/`. Test fixtures in `gastown/testdata/`.
- **octopusgarden / fabro / dark-factory** (Phenotype SOTA): use `tracing::instrument(skip_all, fields(...))` as the prelude pattern; every domain fn carries an instrumented entry/exit; a `prelude.rs` re-exports traits + error types only.
- **phenotype-infrakit** guidance: each shared crate ships a single `lib.rs` with explicit `pub mod` declarations; `pub use` only at the leaf (no transitive re-exports).

## Phenotype state

### AgilePlus — exemplary internal layering

`AgilePlus/crates/agileplus-domain/src/lib.rs:1-9`:
```
pub mod builder;
pub mod config;
pub mod credentials;
pub mod domain;
pub mod error;
pub mod intent_graph;
pub mod ports;
```
7 modules, each with a single concern:
- `domain/` — 14 sub-aggregates (`audit`, `backlog`, `cycle`, `epic`, `event`, `feature`, `governance`, `metric`, `module`, `project`, `snapshot`, `state_machine`, `story`, `sync_mapping`, `user`, `work_package`) under `domain/mod.rs` (status ✓).
- `ports/` — 8 traits + re-exports (`agent`, `epic`, `events`, `observability`, `plane_sync`, `storage`, `story`, `vcs`); each port in its own file (status ✓).
- `error.rs` — single `DomainError` enum (status ✓).

`AgilePlus/crates/agileplus-application/src/lib.rs:1-22`:
```
pub mod dto;
pub mod error;
pub mod events;
pub mod use_cases;
```
- `use_cases/` — one struct per use case (7 files, see `use_cases/mod.rs:1-9`); each use case holds `Arc<dyn Port>` deps (status ✓).
- `dto/mod.rs:1-30` re-exports *third-party* types from `agileplus-triage` (Claim, ClaimKind, DuplicateCandidate, RepoInfo) at the dto boundary, so callers `use crate::dto::*` get a closed surface (status ✓ — well-disciplined).
- `error.rs:1-50` `AppError` deliberately hides storage types: `#[error("storage error")] Storage(#[source] Box<dyn Error + Send + Sync>)` (status ✓).
- `events.rs` re-exports `DomainEvent`/`DomainEventPublisher` from `agileplus-domain` (status ✓).

`AgilePlus/crates/agileplus-events/src/lib.rs:1-30`:
- 6 modules (`domain_event`, `hash`, `query`, `replay`, `snapshot`, `store`) + a flat `pub use` re-export of 16 event variants and helper types at `lib.rs:13-22`. Single `EventSourcingError` enum (status ✓).

`AgilePlus/crates/agileplus-telemetry/src/lib.rs:1-30`:
- 5 modules (`adapter`, `config`, `logs`, `metrics`, `traces`); re-exports `init_telemetry`, `TelemetryAdapter`, `TelemetryError`, `TelemetryGuard`. Re-exports `phenotype_logging::init_tracing_for_test` from shared kernel (status ✓).

`AgilePlus/crates/agileplus-fixtures/src/lib.rs:1-25`:
- 4 modules (`builders`, `dogfood`, `payloads`, `test_fixtures`); `pub use` re-exports the 3 builder types and `seed_*` helpers at crate root (status ✓ — test scaffolding isolated in its own crate, no production crate depends on it).

`AgilePlus/crates/agileplus-graph/src/lib.rs:1-19`:
- 3 modules (`graph_store`, `rel_type_ext`, `types`); single `Error` enum aggregating `GraphError` and a `Config(String)` variant (status ✓).

`AgilePlus/crates/agileplus-api/src/lib.rs:1-13`:
- 7 modules (`api_key`, `error`, `middleware`, `openapi`, `responses`, `router`, `routes`, `state`); `pub use router::create_router; pub use state::AppState;` (status ✓).

### Test scaffolding separation
- `agileplus-fixtures` — sole *production* crate designated for test data; declared `[categories] = "development-tools::testing"` in its Cargo.toml. Other production crates do **not** import it; instead `agileplus-integration-tests` and per-crate `#[cfg(test)]` modules build their own doubles. (status ✓).
- `agileplus-application/src/lib.rs:23-200` — the in-file `#[cfg(test)] mod tests` defines in-memory `Double` repos inline (verified in `lib.rs:23-50` test stub); does not pull from `agileplus-fixtures` — keeps the test surface local and dependency-free (status ✓).
- `agileplus-sqlite/src/tests.rs` — separate `tests.rs` (status ✓).
- `agileplus-cli/Cargo.toml:50-53` declares `proptest`, `tokio-test`, `assert_cmd`, `predicates` as dev-deps (status ✓ — proper integration-test tooling).

### Re-export discipline
- `agileplus-domain/src/ports.rs:18-25` re-exports every port trait (`pub use agent::AgentPort; ... pub use story::StoryRepository;`) so callers do `use agileplus_domain::ports::*` to get the full port surface (status ✓).
- `agileplus-events/src/lib.rs:13-29` re-exports the typed `DomainEvent` enum and the 4 store traits at root for ergonomic `use agileplus_events::*` imports (status ✓).
- `agileplus-telemetry/src/lib.rs:11-15` re-exports `phenotype_logging::init_tracing*` from the shared kernel — cross-crate promotion of the kernel's API (status ✓).
- `Tracera/crates/tracera-core/src/lib.rs:31-41` re-exports *every* module at crate root (`pub use cache::*; pub use coverage::*; pub use health::*; ... pub use ui_links::*;`) — convenience over encapsulation. Acceptable for a single-purpose canonical-model crate, but couples consumers to flat import paths (status △).

### Tracely — minimal but consistent
- `Tracely/crates/tracely-core/src/lib.rs:1-30` — 2 modules (`logging`, `tracing`); root re-exports `LogContext`, `LoggerConfig`, `TraceContext`, `TracingConfig` (status ✓ — small, focused).
- `Tracely/crates/tracely-sentinel/src/lib.rs:1-50` — 5 modules (`bulkhead`, `circuit_breaker`, `config`, `rate_limiter`, `validation`) + a single `Error` enum with `From` conversions to/from each module's error type (status ✓ — textbook error-aggregation pattern).
- `Tracely/crates/zerokit/` and `pheno-logging-zig/` have empty `src/` (status ✗ — see L0 gap #2).

### thegent — hybrid boundary gaps
- Python shell at `thegent/src/thegent/__init__.py:1-30` re-exports 5 doctor/config helpers; flat top-level API. CLI scripts (`thegent`, `clode`, `roid`, `droid`, `dex`, `anen`, `fanta`, `antigma`) declared in `thegent/pyproject.toml:50-58` point at `thegent.cli.apps.main:app` and 7 `thegent.rust_wrappers:*` modules (status △ — no formal contract file between Rust crates and Python wrappers).
- `thegent/cli/commands/specs.py:1-15` directly imports `thegent.specs.generate_all_specs.SpecsGenerator` after `sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))` — manual path manipulation (status ✗ — implies a packaging problem; `pyproject.toml` should make `thegent` installable so the path hack is unnecessary).
- 26 Rust sub-crates in `thegent/crates/` each ship their own `src/lib.rs` and `Cargo.toml`; module boundaries are by-crate, not by-file (status ✓ at the Rust side; △ at the cross-language boundary).
- `thegent/core/errors` exists as a folder, suggesting a Python "core" layer separate from `thegent/cli/` (status △ — read `thegent/ARCHITECTURE.md:11-13`: "`core/errors`" is the only listing).

### Tracera — single-crate layered module
- `Tracera/crates/tracera-core/src/lib.rs:11-29` — 13 modules organised by concern:
  - **Identity / vocab**: `ids`, `workspace`
  - **Domain algorithms**: `coverage`, `impact`, `matrix` (Phase 2 stub), `registry`
  - **Cross-cutting**: `ui_links`, `cache`, `health`, `notification`, `observability`, `pagination`, `rate_limit`
- Each module owns one concept; flat re-exports at `lib.rs:31-41` (status △ — see L0 gap #4: matrix.rs is a Phase-2 stub).
- Tests colocated in each module via `#[cfg(test)] mod tests` (e.g. `workspace.rs:34-50`). (status ✓).

## Gaps
1. **`agileplus-subcmds` is a stub crate** — `agileplus-subcmds/src/lib.rs` is empty and the crate has zero deps (`agileplus-subcmds/Cargo.toml:13-16`). Listed in `AgilePlus/Cargo.toml:25-26` as a workspace member. Either populate (move 5 subcommand files from `agileplus-cli/src/commands/` here) or drop. — effort: S
2. **`Tracely/crates/zerokit/` and `pheno-logging-zig/` have empty `src/`** — `ls Tracely/crates/zerokit/` returns no `src` dir; `pheno-logging-zig` lists no `src` either. Listed as workspace members in `Tracely/Cargo.toml:8-12`. — effort: S
3. **`thegent/cli/commands/specs.py:8` uses `sys.path.insert`** — packaging defect: `thegent` package isn't installable from `pyproject.toml` cleanly, forcing runtime path hacks. Should add a `[tool.hatch.build.targets.wheel] packages = ["src/thegent"]` or similar, plus `pip install -e .` for devs. — effort: S
4. **thegent hybrid Python↔Rust boundary has no IDL** — `thegent/rust_wrappers` are imported by Python entry points in `pyproject.toml:50-58` but no `.pyi` stub or `pyo3-stub-typing` contract exists. Rust signatures can drift silently. — effort: M
5. **Tracera `matrix.rs` is a stub** — `tracera-core/src/lib.rs:20` says "excluded from default build until Phase 2 lands". Coverage matrix is the canonical public surface. — effort: M
6. **Tracera `tracera-core/src/lib.rs:31-41` does flat `pub use module::*` for 11 modules** — convenience import but couples consumers to root-level paths and makes it hard to gate modules behind features. (status △ — minor).
7. **No `agileplus-graph` and `agileplus-triage` placement rationale** — both are *application-layer* utilities consumed by `agileplus-application` (`agileplus-application/Cargo.toml:18-22`). Why are they not under `agileplus-application/src/`? The split may be intentional (separate versioning) but the rationale isn't captured. — effort: S
8. **No shared `prelude.rs` in any crate** — every consumer imports `agileplus_domain::ports::*` or `agileplus_events::*` ad-hoc. SOTA (claude-code-sdk-rs, fabro) ships a one-line `pub use` prelude per crate. — effort: S

## Recommendations
1. **Populate or remove `agileplus-subcmds`** — copy the 5 stub files (`audit.rs`, `dashboard.rs`, `events.rs`, `sync/`, `tracera_bridge.rs`) from their current `agileplus-cli/src/commands/` to `agileplus-subcmds/src/` and move their `Cargo.toml` deps over. ~80 LOC.
2. **Initialise `Tracely/crates/zerokit/` and `pheno-logging-zig/`** with `pub fn version() -> &'static str { env!("CARGO_PKG_VERSION") }` + a module-level `lib.rs` so the workspace member has substance. Or drop from `Tracely/Cargo.toml:8-12`.
3. **Fix `thegent` packaging** — add `pyproject.toml` `[tool.hatch.build.targets.wheel] packages = ["src/thegent"]` and remove the `sys.path.insert` hack in `cli/commands/specs.py:8`.
4. **Author `thegent/boundary/idl.toml`** — a stub or `pyo3-stub-typing`-generated `.pyi` for every Rust crate in `thegent/crates/`. Catches signature drift in CI.
5. **Replace Tracera `matrix.rs` stub** — minimum viable: 30 LOC that builds an empty `CoverageMatrix` with `Default`. Defer the real algorithm to a follow-up ADR.
6. **Add `prelude.rs` to the 4 most-imported AgilePlus crates** — `agileplus-domain/src/prelude.rs` (re-export `ports::*`, `error::DomainError`); `agileplus-events/src/prelude.rs`; `agileplus-application/src/prelude.rs`; `agileplus-telemetry/src/prelude.rs`. ~5 LOC each.
7. **Document the `agileplus-graph`/`agileplus-triage` placement** in `AgilePlus/ARCHITECTURE.md` — add a 3-line "Application-adjacent crates" subsection explaining why they live at workspace top-level.
