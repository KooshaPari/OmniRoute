# L0 — Architecture Foundations

## Scope
Identify and judge the 3–5 architectural patterns in use across the AgilePlus + thegent + Tracely + Tracera bloc, the workspace organisation model, cross-crate dependency rules, and public-API boundary discipline.

## SOTA 2026
- **Anthropic Claude Code** (claude-code-sdk-rs, 2026): single-CLI binary over a hexagonal `core::` (pure domain) + `service::` (use cases) + `adapters/` (LSP/MCP/IO) layering; per-feature worktrees (`-w`) with strict canonical/main separation.
- **jlowin/fastmcp**: pure-Python hexagonal (transport-agnostic) — `Server.tools: list[Tool]` + tool handlers depend on injected context; no framework leakage to domain.
- **gastown** (steveyegge/gastown, 2026): microkernel + agent-beads; `bd` CLI thin shell, `gastown/agent/` core kernel, beads persisted in `~/beads` SQLite, agent manifests declared declaratively in TOML.
- **attractor / dark-factory / octopusgarden / fabro** (phenotype-shared 2026 SOTA): polyglot polyrepo with shared kernel crates (`phenotype-error-core`, `phenotype-logging`, `phenotype-event-bus`, `phenotype-string`, `phenotype-test-infra`) consumed via `path = "../phenoShared/..."`; per-product repos stay thin shells over the shared kernel.
- **phenotype-governance** (the `23_ARCHITECTURAL_GOVERNANCE.md` framework): mandates hexagonal *ports and adapters* with explicit dep-arrows, shared `phenotype-error-core`, forbid cyclic deps between domain and infra.

## Phenotype state

### Workspace topology
- **AgilePlus** (`AgilePlus/Cargo.toml:1-79`) — 45-crate Cargo workspace; `resolver = "3"`, edition 2021, rust-version 1.88, PGO profile. Members enumerated: `crates/agileplus-{domain,application,config,cache,governance,dashboard,events,fixtures,git,sqlite,cli,api,grpc,github,plane,nats,p2p,telemetry,triage,subcmds,pipeline,trace-validator,validate,proto,mcp-intent,convoy,factory,graph,hook,import,integration-tests,refinery,sync,witness,contract-tests,artifacts,benchmarks}` + 5 cross-cutting `pheno-*`/`phenotype-*` shared crates (cargo.toml:18-58). Public-API index declared in `AgilePlus/CARGO-WORKSPACE.md:18-35` (status ✓ — explicit per-crate role table). **Shared kernel** comes from `phenoShared/` via `path = "../phenoShared/crates/phenotype-error-core"` etc. (Cargo.toml:91-95) (status ✓).
- **thegent** (`thegent/crates/Cargo.toml:1-30`) — 26-crate Rust sub-workspace (members: `thegent-{resources,parser,crypto,shm,git,discovery,cache,hooks,docs,utils,router,maif,shims,zmx-interop,zmx,jsonl,policy,metrics,fs,offload,memory,subprocess,plugin-host,nvms,tui}` + `harness-native`) **plus** a Python `pyproject.toml:1-18` declaring `thegent`, `clode`, `roid`, `droid`, `dex`, `anen`, `fanta`, `antigma` console scripts. `resolver = "3"`, `gix` pinned to 0.82. **Hybrid** workspace: Rust kernel under `crates/`, Python glue under `src/`, `cli/`, `core/`. (status △ — hybrid boundary not formally documented; cross-language IDL/contract missing).
- **Tracely** (`Tracely/Cargo.toml:1-12`) — 5-crate workspace (`helix-tracing`, `tracely-core`, `tracely-sentinel`, plus a stub `pheno-logging-zig` and `zerokit` whose `src/` is empty as of 2026-06-16). `resolver = "2"`, edition 2021. (status △ — empty crate stubs still listed as members).
- **Tracera** (`Tracera/Cargo.toml:1-23`) — single-crate `tracera-core` workspace (`crates/tracera-core`); Python `src/tracertm/`, Go `backend/`, TypeScript `frontend/` live *outside* Cargo. Polyglot layered repo with Rust core + 4 language shells. (status ✓ — by-design polyglot parity, see `Tracera/ARCHITECTURE.md:48-58`).

### Architectural patterns in use
1. **Hexagonal (Ports & Adapters)** — `AgilePlus/crates/agileplus-domain/src/ports.rs:1-44` declares 8 port traits (`AgentPort`, `EpicRepository`, `DomainEventPublisher`, `ObservabilityPort`, `PlaneSyncPort`, `StoragePort`, `StoryRepository`, `VcsPort`) re-exported from `ports/agent.rs`, `epic.rs`, `events.rs`, `observability.rs`, `plane_sync.rs`, `storage.rs`, `story.rs`, `vcs.rs`. `agileplus-application/src/use_cases/create_feature.rs:14-37` shows the textbook port-injection pattern: `pub struct CreateFeature { repo: Arc<dyn StoragePort>, publisher: Arc<dyn DomainEventPublisher> }`. Domain has **zero** transport/storage deps (Cargo.toml:13-25, no axum/sqlx/tonic). (status ✓ — exemplary).
2. **Use-Case Per-Module** — `agileplus-application/src/use_cases/mod.rs:1-9` declares 7 use-case submodules (`advance_feature`, `create_epic`, `create_feature`, `create_story`, `persist_synced_stories`, `transition_story`, `triage`), one struct per use case. Mirrors gastown's `bd <verb>` decomposition. (status ✓).
3. **Event-Sourcing Engine** — `agileplus-events/src/lib.rs:1-18` exposes typed `DomainEvent` enum (16 variants re-exported at `lib.rs:13-22`), append-only store with SHA-256 hash chain (`hash.rs`), snapshot/replay, query — a small self-contained ES engine. Cross-crate dep on `agileplus-domain` only (`domain_event.rs:13-18`); no concrete bus persistence. (status ✓).
4. **Adapter / Plugin layer** — `agileplus-{sqlite,cache,git,nats,telemetry,import,grpc,api,dashboard,github,plane,p2p,triage}` map 1:1 to the *Interface* and *Infrastructure* rows in `AgilePlus/CARGO-WORKSPACE.md:11-15`. Each adapter implements one or more domain port traits. (status ✓).
5. **Microkernel / Hex kernel + agent shells** — thegent: 26 micro-crates plus Python shell scripts (`thegent`/`clode`/`roid`/`droid`/`dex`/`anen`/`fanta`/`antigma`, `pyproject.toml:50-58`) wrap Rust kernels. (status △ — kernel↔shell contract not formalised; thegent-pyutils pin locks the boundary to a single tagged version `v0.1.0` at `pyproject.toml:69`).

### Cross-crate dependency rules
- `agileplus-domain` depends on `phenotype-error-core` + `phenotype-string` + `agileplus-validate` only (`agileplus-domain/Cargo.toml:13-26`); no I/O. (status ✓).
- `agileplus-application` → `agileplus-domain`, `agileplus-triage`, `agileplus-graph` (`agileplus-application/Cargo.toml:13-23`); no `agileplus-sqlite` / `agileplus-api` import — strict port-only dep. (status ✓).
- `agileplus-events` → `agileplus-domain` for status/state types (`agileplus-events/src/domain_event.rs:13-18`); no bus framework. (status ✓).
- `agileplus-subcmds` is **declared** in `Cargo.toml:25-26` and `Cargo.toml:30` as a workspace member but its own `agileplus-subcmds/Cargo.toml:13-16` is a stub with `[lib] path = "src/lib.rs"` and no dependencies. Comment in `Cargo.toml:13` says `# No deps for now - just a stub crate` — placeholder in the workspace member list. (status ✗ — ship a stub or remove from `members`).
- `agileplus-trace-validator` consumed by `agileplus-cli` (`agileplus-cli/Cargo.toml:30-32`) but the `tracera-core` dep is **commented out** in `agileplus-subcmds/Cargo.toml:13` — partial Tracera integration. (status △).

### Public-API boundary discipline
- `agileplus-domain` re-exports its public surface through `lib.rs:1-9` (`builder`, `config`, `credentials`, `domain`, `error`, `intent_graph`, `ports`); flat, predictable. (status ✓).
- `agileplus-application` re-exports submodules in `lib.rs:18-22`; no `pub use` of internal structs at crate root (every use case is namespaced under `use_cases::*`). (status ✓).
- `tracely-core` re-exports *every* internal module via `pub use` flat-list at `tracera-core/src/lib.rs:31-41` — convenience over encapsulation; external consumers may import `tracera_core::CoverageMatrix` directly. (status △ — flat `pub use` weakens module boundary, but works because crate is single-purpose).
- `tracely` (`Tracely/crates/tracely-core/src/lib.rs:1-30`) is itself the umbrella for `logging` + `tracing` and re-exports the most-used items at root (`pub use logging::{LogContext, LoggerConfig}; pub use tracing::{TraceContext, TracingConfig};`). (status ✓).
- `agileplus-governance` exports `GovernanceClient`, release channels, audit logger, policy engine — `CARGO-WORKSPACE.md:25` lists it as Operations/DX. (status ✓).

### Tracera polyglot layering
`Tracera/ARCHITECTURE.md:35-58` declares a 5-language table with Rust core as the canonical entity model and Python/Go/TS shells. `crates/tracera-core/src/lib.rs:11-29` defines 11 modules (`ids`, `workspace`, `coverage`, `impact`, `matrix`, `registry`, `ui_links`, `cache`, `health`, `notification`, `observability`, `pagination`, `rate_limit`). (status ✓ for layout, △ for parity: matrix.rs is a *Phase 2 stub*, see comment `lib.rs:20`).

## Gaps
1. **`AgilePlus/crates/agileplus-subcmds/src/lib.rs` is a stub** — `agileplus-subcmds/Cargo.toml:13-16` declares zero deps; `subcmds/src/` contains 5 unimplemented shells (audit.rs, dashboard.rs, events.rs, sync/, tracera_bridge.rs). Either populate or drop from `Cargo.toml:25-26` workspace members. — effort: S
2. **`Tracely/crates/zerokit/` and `Tracely/crates/pheno-logging-zig/` have empty `src/`** — listed in `Tracely/Cargo.toml:8-12` as workspace members but contain no source. Either initialise or remove from workspace. — effort: S
3. **thegent hybrid boundary undocumented** — `thegent/pyproject.toml:69` pins `phenotype-py-utils @ git+...@v0.1.0` and Rust crates depend on `gix`/`glib`/`rand` (Cargo.toml:32-40), but the contract between `thegent/src/*.py` and `thegent/crates/thegent-*/src/lib.rs` is not captured in any ADR or sequence diagram. `thegent/ARCHITECTURE.md:1-50` is a skeleton ("Replace the skeleton with module-level ADRs"). — effort: M
4. **Tracera `matrix.rs` is a stub** — `Tracera/crates/tracera-core/src/lib.rs:20` says "Phase 2 stubs — see matrix.rs; excluded from default build until Phase 2 lands." Coverage matrix is the central public surface; placeholder risks silent regressions. — effort: M
5. **No `agileplus-subcmds` ↔ `tracera-core` link wired** — `agileplus-subcmds/Cargo.toml:13` has commented-out `tracera-core = { path = "../../../Tracera/crates/tracera-core" }`. Either wire the bridge or drop `tracera_bridge.rs`. — effort: S
6. **The bloc's "spec-first" rule has no machine-checkable guard** — the 4 repos each ship their own `Cargo.toml`/`pyproject.toml` and the only common constraint is `deny.toml` per repo. The Phenotype `23_ARCHITECTURAL_GOVERNANCE.md` mandates "explicit dep-arrows; forbid cyclic deps between domain and infra", but no `cargo metadata --format-version 1` cycle-check is wired. — effort: M (xtask-anti-patterns is mentioned in `AgilePlus/CARGO-WORKSPACE.md:60` but I did not verify it covers cycle detection)

## Recommendations
1. Run `cargo metadata --format-version 1` in a CI check per bloc repo; assert `agileplus-domain` and `agileplus-events` have no transitive `agileplus-sqlite` / `agileplus-api` / `agileplus-grpc` deps.
2. Either implement `agileplus-subcmds` (move 5 subcommand files from `agileplus-cli/src/commands` to `agileplus-subcmds/src/`) or delete it. Currently it's a workspace member with no source — confusing to consumers.
3. Initialise `Tracely/crates/zerokit/` and `pheno-logging-zig/` with at least a `pub fn version() -> &'static str` and a Cargo.toml description, or remove from `Tracely/Cargo.toml:8-12` workspace members.
4. Author a single `thegent/ADR-hybrid-boundary.md` enumerating which symbols the Python shell re-exports from each Rust crate (a la `pyo3-stub-typing` or `uniffi-bindgen` UDL files). 1 ADR, ~80 lines.
5. Replace Tracera `matrix.rs` Phase-2 stub with a `todo!()`-free minimum-viable implementation or move to a `tracera-core-matrix` sub-crate and add `#[cfg(feature = "matrix")]` gate.
6. Wire the `agileplus-subcmds` → `tracera-core` dep so the Tracera bridge call in `tracera_bridge.rs` actually compiles.
