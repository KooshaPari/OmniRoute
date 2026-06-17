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
| `connect` | MCP, auth, identity | **PhenoMCP**, **Authvault** | Rust bins/libs | Py mcp-kit, auth-kit; Go only with SOTA |
| `resilience` | Breakers, retry, bulkhead | **phenotype-resilience** | Rust sentinel/resilience | Py resilience-kit |
| `test` | Test SDK, journeys, fixtures | **phenotype-test** | **phenotype-journeys** (Rust CLI) | Py testing-kit, phenotype-testing (uv) |
| `quality` | Static analysis, LLM validation | **KodeVibe**, **kwality** | — | Go engine (justified), shell UX |
| `platform` | devenv, devhex, sandbox | **phenotype-go-sdk**, **phenotype-tooling** | — | Go (justified), nanovms in tooling |
| `py-sdk-index` | Python package workspace / extras | **phenotype-python-sdk** | — | uv; optional `[observe]`, `[connect]`, etc. |

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Create `phenotype-rust-sdk` as a junk drawer | Split by role (`phenotype-config`, `phenotype-observe`, …) |
| Add domain crates to HexaKit | HexaKit = `genesis` only; migrate transitional `crates/` out by role |
| Add Go without SOTA | `docs/sota/technical.md` → “Why Go at this edge” |
| Delete archive because stub | Delete when **role owner** has 100% boundary + documented lang placement |

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
| worktree-manager | — | PhenoVCS (retired) |

## Chokepoint repoints

| Consumer | Repoint to |
|----------|------------|
| Pyron | `phenotype-config`, `PhenoObservability`, transitional `stashly` — Wave 3 lockstep 2026-06-17 |
| PhenoObservability | observe role crates + python-sdk kits |
| DevHex | phenotype-go-sdk `devenv-abstraction` (documented G3) |

## Related

- [LANGUAGE_PLACEMENT.md](LANGUAGE_PLACEMENT.md)
- [RATIONALIZATION_PLAN.md](RATIONALIZATION_PLAN.md) — pending update for role model
- [ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md)
