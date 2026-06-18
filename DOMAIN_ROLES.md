# Phenotype Domain Roles

> **Authority:** `phenotype-registry`  
> **Supersedes:** language-monorepo absorption (e.g. “phenotype-rust-sdk absorbs everything”)  
> **Genesis standard:** [HexaKit docs/genesis/STANDARD.md](https://github.com/KooshaPari/HexaKit/blob/main/docs/genesis/STANDARD.md) (PR #234+)

Organize the fleet by **what boundary you own**, not by primary programming language.

## Role map

| Role ID | Mission | Canonical owner(s) | Core (Rust / Zig / Mojo) | Justified edges |
|---------|---------|-------------------|--------------------------|-----------------|
| `genesis` | Repo bootstrap, templates, charter/review/OKF | **HexaKit** | template smoke, compliance schema | all lang scaffolds in `templates/` |
| `config` | Layered config, validation, env | **phenotype-config** (workspace; `settly` crate) | Rust `settly` | **Conft** (TS), **phenotype-config** (Py 3.14/uv) |
| `observe` | Metrics, tracing, OTLP, exporters | **PhenoObservability**, **phenotype-otel** | tracing/metrics crates (Traceon domain) | Py observability-kit, dashboards |
| `connect` | MCP, auth, identity | **[PhenoFastMCP](https://github.com/KooshaPari/PhenoFastMCP)***, **[PhenoMCPServers](https://github.com/KooshaPari/PhenoMCPServers)**, **[substrate](https://github.com/KooshaPari/substrate)**, **Authvault** | Rust/Go/Python per ADR-017 | Py `[connect]` via phenotype-python-sdk; Go HTTP/SSE edges (MCPForge, ops-mcp) |
| `resilience` | Breakers, retry, bulkhead | **phenotype-resilience** | Rust sentinel/resilience | Py resilience-kit |
| `test` | Test SDK, journeys, fixtures | **phenotype-test** | **phenotype-journeys** (Rust CLI) | Py testing-kit, phenotype-testing (uv) |
| `quality` | Static analysis, LLM validation | **KodeVibe**, **kwality** | — | Go engine (justified), shell UX |
| `route` | LLM routing, cost-aware dispatch, router policy | **OmniRoute** (TS), **Tokn** (`tokenledger::routing`) | Rust pareto router / ports | TS router UI; phenoAI consumes — not SSOT |
| `cli_proxy` | OAuth CLI → OpenAI-compatible proxy; agent HTTP API | **agentapi-plusplus**, **cliproxyapi-plusplus** (peer/submodule) | Go services | cliproxy Plus providers; bifrost is vendor-only gateway |
| `agent-control` | Terminal agent control plane HTTP surface (`/message`, `/status`, `/events`) | **agentapi-plusplus** + **substrate** `engine-agentapi` | Rust adapter in substrate | Coder AgentAPI parity; not OmniRoute merge target |
| `inference` | Local model server, menu-bar runtime | **phenotype-omlx** (FINISH vs DROP per ADR-ECO-008) | mlx-lm / jundot/omlx engine upstream | phenoAI skeleton consumes routers |
| `platform` | devenv, devhex, sandbox, NVMS isolation | **phenotype-go-sdk**, **phenotype-tooling**, **PhenoCompose**, **nanovms** (tooling) | nanovms crates in tooling | Go (justified); engine layer separate from gateway |
| `py-sdk-index` | Python package workspace / extras | **phenotype-python-sdk** | — | uv; optional `[observe]`, `[connect]`, etc. |

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Create `phenotype-rust-sdk` as a junk drawer | Split by role (`phenotype-config`, `phenotype-observe`, …) |
| Add domain crates to HexaKit | HexaKit = `genesis` only; migrate transitional `crates/` out by role |
| Add Go without SOTA | `docs/sota/technical.md` → “Why Go at this edge” |
| Delete archive because stub | Delete when **role owner** has 100% boundary + documented lang placement |
| Consolidate into `phenoShared` | **DECOMPOSE** per [ADR-ECO-014](docs/adrs/ADR-ECO-014-phenoshared-decompose.md) — route each crate to its role owner |
| Use `phenoShared` as fleet repoint target | Repoint manifests to **domain role owners** (`phenotype-config`, `phenotype-resilience`, `PhenoObservability`, `phenotype-types`, `Eventra`, …) |

## Archive → role routing

| Archived repo | Target role | Owner |
|---------------|-------------|-------|
| ObservabilityKit | `observe` (Py edge) | phenotype-python-sdk |
| ResilienceKit | `resilience` (Py edge) | phenotype-python-sdk |
| TestingKit | `test` (Py edge) | phenotype-python-sdk |
| Settly | `config` | phenotype-config (Rust core) |
| Traceon | `observe` (Rust core) | phenotype-observe workspace |
| PlatformKit | `platform` | go-sdk + tooling |
| PhenoKits templates | `genesis` | HexaKit `templates/` |
| phenoStandards | `genesis` | HexaKit (retired) |
| agentapi | `cli_proxy` | agentapi-plusplus (archived upstream) |
| vibeproxy | `cli_proxy` (deprecated) | cliproxyapi-plusplus redirect |
| worktree-manager | — | PhenoVCS (retired) |
| McpKit | `connect` (Py edge) | PhenoFastMCP + PhenoMCPServers (archived 2026-06-17) |
| PhenoMCP | `connect` (Rust/Go lib) | PhenoMCPServers + PhenoFastMCP* (archived 2026-06-17) |
| cheap-llm-mcp | `connect` (runtime CLI) | substrate + PhenoMCPServers (deleted 2026-06-17) |

## Chokepoint repoints

| Consumer | Repoint to |
|----------|------------|
| Pyron | `phenotype-config`, `PhenoObservability`, `phenotype-resilience` (`stashly`) — Wave 7; phenoShared was interim only (ADR-ECO-014) |
| PhenoObservability | observe role crates + python-sdk kits |
| DevHex | phenotype-go-sdk `devenv-abstraction` (documented G3) |

## phenoShared (decompose — not a role owner)

`phenoShared` is **not** a `DOMAIN_ROLES` entry. It is a **temporary staging monorepo** slated for decomposition per [ADR-ECO-014](docs/adrs/ADR-ECO-014-phenoshared-decompose.md). Do not classify it as shared-lib SSOT, SDK, or framework.

## Gateway / merge program

- [ADR-ECO-007-gateway-merge-superset](docs/adrs/ADR-ECO-007-gateway-merge-superset.md)
- [ADR-ECO-014-phenoshared-decompose](docs/adrs/ADR-ECO-014-phenoshared-decompose.md)
- [GATEWAY_MERGE_DAG.md](docs/rationalization/GATEWAY_MERGE_DAG.md)
- [wave14-gateway-ssot-2026-06-17.md](docs/operations/wave14-gateway-ssot-2026-06-17.md)

## Related

- [LANGUAGE_PLACEMENT.md](LANGUAGE_PLACEMENT.md)
- [RATIONALIZATION_PLAN.md](RATIONALIZATION_PLAN.md) — Step 1 archive list corrected Wave 14
- [ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md)
