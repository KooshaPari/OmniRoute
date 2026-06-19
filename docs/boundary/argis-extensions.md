# argis-extensions — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Clean extension layer on top of `bifrost` and `cliproxy` (vendored Go modules, **zero upstream modifications**, replace directive pins to `./bifrost/core`)
- Cobra-based CLI (`bifrost init`, `bifrost server`, `bifrost deploy fly`) with Viper YAML + env-var config cascade
- Plugin system under `plugins/` with extensible hooks (rate limit, cost accounting, route transform)
- Serverless deployment targets: Fly.io (primary), Vercel, Railway, Render, Homebox (Docker + fly.toml)
- Operational surfaces: PostgreSQL (pgx + golang-migrate), Redis (go-redis), Neo4j (graph store), NATS (messaging), Prometheus (metrics), structured logging (zerolog)
- API: Connect-RPC + GraphQL (gqlgen) + REST (chi) + WebSocket (gorilla) + fasthttp hot-path

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Bifrost core gateway engine | `bifrost/core` (vendored) | argis-extensions is the clean extension layer; the engine is `maximhq/bifrost` upstream, vendored via replace |
| Generic LLM routing substrate (Rust) | `Tokn` `tokenledger::routing` | per ECOSYSTEM_MAP § 3 Cluster A, Tokn is the canonical Rust routing substrate |
| LLM router UI / desktop client convergence | `OmniRoute` | per ADR-ECO-015, OmniRoute is the app/shell layer for router UI |
| Cost / budget / quota / audit (consumer-side) | `pheno-mcp-router` (L5-104 absorption) | Cost governance lives in the substrate, not the extension layer |
| MCP server runtime (driver-argv, driver-http) | `substrate` | argis-extensions is gateway/extension, not an MCP runtime |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Bifrost engine consumption | this-repo→`bifrost/core` | Go module + replace directive | green |
| Cliproxy subscription proxy | this-repo→`cliproxy` | Go module | green |
| CLI proxy (OAuth / subscription mgmt) | this-repo→`cliproxyapi-plusplus` (peer) | Go module | amber — Wave H merge per ADR-ECO-014 |
| Observability (Prometheus / Tempo) | this-repo→`phenoObservability` | OTel exporter | amber — wiring under review |
| Cost / budget / quota (L5-104) | this-repo→`pheno-mcp-router` | HTTP / MCP | green — absorbed |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/argis-extensions.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
