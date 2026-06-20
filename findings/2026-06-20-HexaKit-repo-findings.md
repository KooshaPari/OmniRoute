# HexaKit — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `HexaKit/` (also known as phenotype-infrakit — Phenotype Infrastructure Kit)
**Status:** ACTIVE — AI-DD metaproject, ~80% progress

---

## 1. Overview

HexaKit is the **Phenotype Infrastructure Kit**, a Rust workspace containing 16+ specialized infrastructure libraries for building scalable, maintainable systems. It is the canonical home for cross-cutting concerns across the Phenotype platform — error handling, port/adapter patterns, health checks, policy evaluation, compliance scanning, cost tracking, process orchestration, and hexagonal architecture scaffolding. The repository manages a complex dependency graph with git dependencies to ~15+ other phenotype repos.

**Core Mission:** Provide shared infrastructure libraries that prevent re-invention of cross-cutting concerns across all Phenotype projects.

## 2. Repository Structure

```
HexaKit/
├── crates/                           # 43+ crate directories (some excluded from workspace)
│   ├── hexakit-cli/                  # Fleet repository bootstrap CLI
│   ├── phenotype-core/               # Umbrella re-export crate (~245 lines)
│   ├── phenotype-port-traits/        # Inbound/outbound port trait definitions (~48 lines)
│   ├── phenotype-ports-canonical/    # Canonical port implementations (stub)
│   ├── phenotype-contract-adapters/  # Contract adapter implementations
│   ├── phenotype-contract-tests/     # Contract test utilities
│   ├── phenotype-compliance-scanner/ # Compliance scanning
│   ├── phenotype-cost-core/          # Cost tracking primitives
│   ├── phenotype-error-macros/       # Error derive macros
│   ├── phenotype-git-core/           # Git core operations
│   ├── phenotype-infrastructure/     # Infrastructure abstractions
│   ├── phenotype-process/            # Process orchestration
│   ├── phenotype-project-registry/   # Project registry
│   ├── phenotype-shared-config/      # Shared configuration
│   ├── phenotype-xdd-lib/            # X-DD methodology library
│   ├── phenotype-security-aggregator/ # Security scanning aggregation
│   ├── phenotype-cache-adapter-stub/ # Inline cache adapter stub
│   ├── forgecode-fork/               # Forked forge tooling
│   ├── cipher/                       # Cryptography (excluded → Authvault)
│   ├── phenotype-analytics/          # Analytics (excluded)
│   ├── phenotype-async-traits/       # Async traits (excluded → phenotype-rust-sdk)
│   ├── phenotype-bdd/                # BDD toolkit (excluded → TestingKit)
│   ├── phenotype-casbin-wrapper/     # Casbin auth (excluded → Authvault)
│   ├── phenotype-config-loader/      # Config loading (excluded → phenotype-config)
│   ├── phenotype-contract/           # Contract testing (excluded → TestingKit)
│   ├── phenotype-contracts/          # Contracts (excluded → phenotype-rust-sdk)
│   ├── phenotype-crypto/             # Crypto (excluded → Authvault)
│   ├── phenotype-error-core/         # Error core (excluded → phenotype-types)
│   ├── phenotype-errors/             # Error types (excluded → phenotype-types)
│   ├── phenotype-health/             # Health traits (excluded → ResilienceKit)
│   ├── phenotype-http-client-core/   # HTTP client (excluded → ResilienceKit)
│   ├── phenotype-iter/               # Iter utilities (excluded → phenotype-types)
│   ├── phenotype-logging/            # Logging (excluded → PhenoObservability)
│   ├── phenotype-macros/             # Macros (excluded → phenotype-rust-sdk)
│   ├── phenotype-mcp/                # MCP (excluded → substrate)
│   ├── phenotype-policy-engine/      # Policy engine (excluded → ResilienceKit)
│   ├── phenotype-state-machine/      # State machine (excluded → ResilienceKit)
│   ├── phenotype-string/             # String utils (excluded → phenotype-types)
│   ├── phenotype-telemetry/          # Telemetry (excluded → PhenoObservability)
│   ├── phenotype-test-fixtures/      # Test fixtures (excluded → TestingKit)
│   ├── phenotype-test-infra/         # Test infra (excluded → TestingKit)
│   ├── phenotype-time/               # Time utils (excluded → phenotype-types)
│   ├── phenotype-validation/         # Validation (excluded → phenotype-types)
│   ├── settly/                       # Config (excluded → phenotype-config)
│   └── stashly/                      # Stash (excluded → phenoShared)
├── python/                           # Legacy Python packages (being migrated)
├── libs/                             # Shared libraries
│   ├── nexus/                        # Nexus (excluded)
│   └── phenotype-config-core/        # Config core (excluded → phenotype-config)
├── agileplus/                        # Excluded → KooshaPari/AgilePlus
├── Metron/                           # Excluded → PhenoObservability
├── Traceon/                          # Excluded → PhenoObservability
├── Flowra/                           # Flow orchestration
├── Eventra/                          # Event bus (excluded)
├── okf/                              # OKF utilities
├── forgecode-fork/                   # Forked forge
├── templates/                        # Scaffolding templates
├── docs/                             # Documentation site
├── scripts/                          # Build scripts
├── tests/                            # Integration tests
├── BOUNDARY.md                       # Domain ownership boundary
├── Cargo.toml                        # Workspace manifest (~223 lines, 86 members + exclusions)
├── Cargo.lock                        # 79,247 lines
├── README.md                         # Shelf overview (~165 lines)
├── SPEC.md                           # Specification (~74,486 lines)
├── PLAN.md                           # Plan
├── ADR.md / ADR_REGISTRY.md          # Architecture decisions
└── charter.md                        # Project charter
```

## 3. Core Crate Analysis

### 3.1 `phenotype-core` — Umbrella Re-export Crate (`crates/phenotype-core/src/lib.rs`)

This is the main entry point for consumers. It re-exports all common phenotype crates under a single `phenotype-core` dependency:

```toml
[dependencies]
phenotype-core = { workspace = true }  # Instead of 10+ individual crates
```

Re-exported modules:
- `error` — ApiError, DomainError, RepositoryError, StorageError, ConfigError, ErrorEnvelope (all from `phenotype-error-core`)
- `config` — ConfigLoader, ConfigSource, Priority, ValidateConfig (from `phenotype-config-core`)
- `event_bus` — EventBus, EventEnvelope, EventId (from `phenotype-event-bus`)
- `validation` — ValidationRule, RequiredRule (from `phenotype-validation`)
- `health` — HealthStatus, HealthChecker (from `phenotype-health`)
- `telemetry` — Metric, MetricsCollector, SpanContext (from `phenotype-telemetry`)
- `ports` — Repository, CachePort (from `phenotype-port-traits`)
- `contracts` — InMemoryRepository, InMemoryCache (from `phenotype-contract-adapters`)
- `retry` — RetryPolicy, ExponentialBackoff (from `phenotype-http-client-core`)
- `async_traits` — AsyncIterator (from `phenotype-async-traits`)
- `state_machine` — StateMachine, StateMachineBuilder (from `phenotype-state-machine`)
- `policy` — PolicyEngine, PolicyResult (from `phenotype-policy-engine`)
- `cache` — CacheAdapter (from `phenotype-cache-adapter-stub`)
- `string` — StringExt (from `phenotype-string`)
- `time` — DurationExt, Timestamp (from `phenotype-time`)
- `http` — HttpClient, RequestBuilder (from `phenotype-http-client-core`)

This is a pure re-export facade — no logic, just dependency routing.

### 3.2 `hexakit-cli` — Fleet Scaffolding CLI (`crates/hexakit-cli/src/main.rs`)

A small CLI for bootstrapping new fleet repositories:

```rust
enum Commands {
    Init(InitArgs),       // Bootstrap new fleet repo (boundary, hooks, CI docs)
    Boundary {            // Validate BOUNDARY.md structure
        command: BoundaryCommands,
    },
}
```

Sub-modules: `init`, `lint`, `boundary`, `lang`, `manifest`, `registry`.

### 3.3 `phenotype-port-traits` — Port Trait Definitions

Minimal crate (~48 lines) defining hexagonal architecture port boundaries:
- `inbound/` — Inbound port traits
- `outbound/` — Outbound port traits
- Error type: `Error::Invalid(String)`
- Result alias: `Result<T> = std::result::Result<T, Error>`

### 3.4 `phenotype-ports-canonical` — Canonical Ports

Single-line stub crate documenting canonical port trait implementations. Empty implementation body — serves as documentation and placeholder for future work.

### 3.5 Excluded Crate Pattern

The workspace's `Cargo.toml` `exclude` list contains ~40 entries that are **physically present on disk** but excluded from the workspace build. These fall into categories:

1. **Archived/absorbed** (canonical home exists elsewhere):
   - `agileplus` → KooshaPari/AgilePlus
   - `Metron` → PhenoObservability crates/metrickit
   - `Traceon` → PhenoObservability crates/tracingkit
   - `settly`, `stashly` → phenoShared per v2 charter
   - `phenotype-bdd` → TestingKit

2. **P3 wave migrations in progress** (interim until absorbed):
   - Error crates → phenoShared (API-compatible)
   - Event crates → Eventra → phenoShared
   - HTTP client → ResilienceKit
   - Logging → PhenoObservability
   - Time → phenoShared
   - State machine + policy → ResilienceKit
   - Security + macros + async-traits → phenoShared
   - Config → phenotype-config
   - MCP → substrate (PhenoMCP)
   - Crypto → Authvault
   - Test infra → TestingKit

3. **Phase 3/4 waves** (being drained to domain repos):
   - Observability → PhenoObservability
   - Testing → TestingKit
   - Analytics + nexus decompose
   - Config core → phenoShared

This is an ongoing consolidation effort (ADR-ECO-014) — migrating crate ownership to domain-specific repos while maintaining API compatibility.

## 4. Dependency Graph

### 4.1 Workspace Members (active = 16 crates)

| Crate | Status |
|-------|--------|
| `hexakit-cli` | Active — CLI tooling |
| `phenotype-contract-adapters` | Active — contract implementations |
| `phenotype-contract-tests` | Active — contract testing utilities |
| `phenotype-compliance-scanner` | Active — compliance scanning |
| `phenotype-cost-core` | Active — cost tracking |
| `phenotype-error-macros` | Active — error derive macros |
| `phenotype-git-core` | Active — git operations |
| `phenotype-port-traits` | Active — port definitions |
| `phenotype-ports-canonical` | Stub — canonical ports |
| `phenotype-process` | Active — process orchestration |
| `phenotype-shared-config` | Active — shared config |
| `phenotype-core` | Active — umbrella re-export |
| `phenotype-infrastructure` | Active — infra abstractions |
| `phenotype-project-registry` | Active — project registry |
| `phenotype-security-aggregator` | Incomplete stub |
| `phenotype-xdd-lib` | Active — X-DD methodology |
| `forgecode-fork` | Active — forked forge code |

### 4.2 Git Dependencies (~15 external repos)

Complex dependency graph referencing many phenotype repos:
- `phenotype-types` — error-core, errors, iter, string, validation, time
- `Eventra` — event-bus, event-sourcing, event-contracts
- `ResilienceKit` — http-client-core, state-machine, policy-engine, health
- `PhenoObservability` — logging, sentry-config, telemetry
- `phenotype-rust-sdk` — async-traits, macros, contracts
- `phenotype-config` — config-loader, config-core
- `substrate` — mcp
- `Authvault` — auth-contracts, security-aggregator, cipher, crypto, casbin-wrapper
- `Agentora` — agent-contracts
- `TestingKit` — test-infra, contract, test-fixtures
- `clap-ext` (local path in workspace: `forgecode-fork`?)

## 5. Boundary Model (`BOUNDARY.md`)

HexaKit's explicit boundary definition:

**Owns:**
- New-project bootstrap (hexagonal layout, folder folding, file templates)
- Fleet architectural pattern enforcement (`.template.ci.yml`, `.template.editorconfig`, `.forge` recipes)
- Spec-kitty / AgilePlus scaffolding integration
- Generators that stamp per-repo config

**Does NOT own (must install domain SDKs separately):**
- Runtime types → `phenotype-types`
- Auth → `AuthKit` / `phenotype-auth-ts`
- MCP → `PhenoMCP` / `McpKit`
- Telemetry → `PhenoObservability` / `Tracely`
- Testing utils → `TestingKit`
- Agent runtime → `thegent`

**Transitional:** Python packages under `python/` are being migrated to domain SDK repos.

## 6. Test Coverage

### hexakit-cli

Minimal tests — primarily CLI structure and boundary validation.

### phenotype-port-traits

| Test | Coverage |
|------|----------|
| 4 inline tests | Error display, error debug, Result Ok/Err |

### phenotype-core

No inline tests found — this is a re-export facade crate.

### General Pattern

Many active crates have minimal or no unit tests. The emphasis is on workspace-level integration via git dependencies consuming the re-exported facade.

## 7. Key Observations

1. **Massive exclusion list**: 40+ crates are physically present but excluded from the workspace — an artifact of the ongoing `ADR-ECO-014` migration. This is a deliberate consolidation strategy but makes the workspace harder to navigate.

2. **Umbrella facade pattern**: `phenotype-core` as a re-export-only crate is an elegant solution for managing the complex dependency graph. Consumers add one dependency and get 15+ crate interfaces.

3. **Complex git dependency graph**: ~15 external repos as git dependencies. This creates tight coupling to `main` branch states across the org — CI failures in any dependency cascade.

4. **Stub-heavy**: Several active crates (`phenotype-ports-canonical`, `phenotype-security-aggregator`) are stubs with minimal or no implementation. The workspace resolves but many crates are not production-ready.

5. **Scaffolding focus**: Despite the name "Infrastructure Kit," HexaKit's primary _active development_ appears to be the scaffolding CLI (`hexakit-cli` init/boundary/lint). The infrastructure crates are being migrated out to domain repos.

6. **Cross-cutting concern hub**: HexaKit serves as the staging ground for cross-cutting concerns until they reach sufficient maturity for standalone repos. This is an intentional architectural pattern.

7. **BOUNDARY.md clarity**: The boundary document is unusually clear for the Phenotype org — it explicitly states what HexaKit owns and doesn't own, with a transition plan for legacy packages.

8. **No benchmark infrastructure**: Despite having `criterion` as a workspace dependency, no benchmarks are visible in the active crates.

9. **SPEC.md is 74KB**: The specification document is enormous, suggesting it may be an aggregation of multiple absorbed specs rather than a single coherent document.

## 8. Recommendations

1. **Reduce crate exclusion list**: The 40+ excluded crates create confusion. Either remove the source directories (if fully migrated) or make the workspace resolver skip them cleanly with a tracking issue per removal.

2. **Add smoke tests for the facade**: `phenotype-core` has tests — add compilation smoke tests that verify all re-exports resolve correctly.

3. **Define a crate lifecycle policy**: Formalize the "staged in HexaKit → promoted to domain repo" lifecycle with clear gates (API stability, test coverage, adoption by N consumers).

4. **Pin git dependencies**: With 15+ git deps tracking `main` branches, CI is fragile. Consider pinning to tags/shas with a regular update cadence.

5. **Fill ports-canonical and security-aggregator**: These are named as active members but have no implementation. Either implement the canonical ports or move them to the exclude list.

6. **Add scaffold templates validation**: The `hexakit-cli` should validate that scaffolded projects match HexaKit's architectural conventions (BOUNDARY.md compliance).

7. **Consolidate SPEC.md**: At 74KB the spec is unwieldy. Split into per-crate specs or link to domain-repo specs where ownership has transferred.

8. **Consider workspace feature flags**: Instead of excluding crates at the workspace level, use Cargo feature flags to let consumers choose which HexaKit modules they need.
