# KooshaPari/PlusForges

> Meta-repo of all `KooshaPari/*` "Plus" forks of router / agent / gateway upstreams, unified under the **substrate** ecosystem.

This is a **README-only** meta-repo. It contains no source code; it exists to give
discoverability and a single landing page for every phenotype-flavoured fork the
ecosystem depends on, plus the architecture spec they all share.

| | Repo | Tier | What |
|---|---|---|---|
| Spec | [KooshaPari/phenotype-router-spec](https://github.com/KooshaPari/phenotype-router-spec) | B | Router A2A protocol spec (v0.1.0) |
| Bundle | [KooshaPari/substrate-adapters-bundle](https://github.com/KooshaPari/substrate-adapters-bundle) | B | Standalone adapter crate workspace (8 shim crates) |
| Spoke | [KooshaPari/cliproxyapi-plusplus](https://github.com/KooshaPari/cliproxyapi-plusplus) | A | Fork of [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) (38k★) with phenotype hooks (OpenAPI 3.1, journey-traceability, phenoShared CI) |
| Spoke | [KooshaPari/context-mode-plusplus](https://github.com/KooshaPari/context-mode-plusplus) | B | Fork of [mksglu/context-mode](https://github.com/mksglu/context-mode) (18.1k★) + /phenotype/ adapter specs |
| Spoke | [KooshaPari/OmniRoute](https://github.com/KooshaPari/OmniRoute) | A | Fork of [diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute) (6.7k★) — Next.js 50+ provider gateway |
| Spoke | [KooshaPari/agentapi-plusplus](https://github.com/KooshaPari/agentapi-plusplus) | A | **Folded** into [KooshaPari/substrate](https://github.com/KooshaPari/substrate) as `crates/engine-agentapi` (commit 5f67a09) |
| Spoke | [KooshaPari/substrate](https://github.com/KooshaPari/substrate) | C | Hexagonal Rust spine (28 crates, 150+ tests) — the ecosystem host |
| Spoke | [KooshaPari/phenoAI](https://github.com/KooshaPari/phenoAI) | C | Python+Rust monorepo (17 crates) — substrate-crate consumer |
| Spoke | [KooshaPari/PhenoFastMCP-rust](https://github.com/KooshaPari/PhenoFastMCP-rust) | A | Rust fastmcp realization (the substrate `driver-mcp` consumes it) |
| Spoke | [KooshaPari/PhenoMCPServers](https://github.com/KooshaPari/PhenoMCPServers) | A | MCP server catalog + skills/plugins/templates |
| Spoke | [KooshaPari/PhenoObservability](https://github.com/KooshaPari/PhenoObservability) | A | 17-crate observability substrate (pheno-otel, dashboards, alerting) |
| Spoke | [KooshaPari/phenotype-router](https://github.com/KooshaPari/phenotype-router) | C | **The bifrost** — substrate `routing-phenotype-router` wraps it via `BifrostAdapter` (ADR-050/051) |
| Spoke | [KooshaPari/phenotype-registry](https://github.com/KooshaPari/phenotype-registry) | meta | Canonical registry of all phenotype projects with status / disposition / cross-links |

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │   substrate  (KooshaPari/substrate)     │
                         │   hexagonal Rust spine, 28 crates        │
                         │   ports: Engine / Routing / Transport   │
                         │          / Store / DispatchApi / Trace  │
                         └─────┬──────────────────────┬────────────┘
                               │                      │
            ┌──────────────────┘                      └──────────────────────┐
            │                                                                 │
   ┌────────▼────────┐                          ┌────────────────────────────▼───┐
   │  PlusForges     │                          │  PhenoObservability           │
   │  (this repo)    │                          │  pheno-otel / dashboards       │
   │  README-only    │                          │  alerting / sentinel           │
   └────────┬────────┘                          └────────────────────────────────┘
            │
   ┌────────▼─────────┐    ┌──────────────────┐    ┌──────────────────┐
   │ cliproxyapi-     │    │ context-mode-    │    │  OmniRoute       │
   │ plusplus         │    │ plusplus         │    │  (diegosouzapw)  │
   │ (router-for-me)  │    │ (mksglu)         │    │                  │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
```

## Tiered contribution model

- **Tier A — FOLD** — repos that are pure implementations of a substrate trait
  (e.g. `agentapi-plusplus` → `substrate::engine-agentapi`). These get folded
  into substrate and the fork is archived.
- **Tier B — SPEC / BUNDLE** — pure-spec or meta-repo projects. README + JSON
  schema, no executable code. (`phenotype-router-spec`, `substrate-adapters-bundle`).
- **Tier C — CONSUMER** — repos that consume substrate traits but ship their own
  runtime (the bifrost realization, the Python ecosystem glue). Synced, never forked.
- **Tier D — DRIVER** — substrate-internal adapters (driver-mcp, driver-cli,
  driver-http, driver-argv). Re-export substrate types into protocol-specific
  shapes.

## Daily auto-sync policy

- `cliproxyapi-plusplus` — daily cron at 03:00 UTC pulls `router-for-me:CLIProxyAPI@main`,
  re-applies phenotype overlay, fast-forward merge when clean. Workflow:
  `.github/workflows/upstream-sync.yml`.

## Related

- Architecture plan: [`plans/2026-06-22-phenotype-ecosystem-router-architecture-v1.md`](https://github.com/KooshaPari/substrate/blob/main/plans/2026-06-22-phenotype-ecosystem-router-architecture-v1.md)
- Registry: [`KooshaPari/phenotype-registry`](https://github.com/KooshaPari/phenotype-registry)

## License

MIT — KooshaPari 2026
