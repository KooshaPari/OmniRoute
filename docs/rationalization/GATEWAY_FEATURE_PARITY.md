# Gateway feature parity matrix

> **Lane H** — companion to [ADR-ECO-014](../adrs/ADR-ECO-014-phenotype-gateway-charter.md).  
> Promotion to `phenotype-gateway/packages/` requires ≥80% mapped for a component.

## Planes

| Plane | Interim canonical | phenotype-gateway target |
|-------|-------------------|--------------------------|
| Agent terminal API | agentapi-plusplus | `packages/agentapi` |
| CLI subscription proxy | cliproxyapi-plusplus | `packages/cliproxy` |
| macOS client | vibeproxy → cliproxy++ | `packages/cliproxy/client` |
| Enterprise gateway | bifrost | `packages/bifrost` |
| Plugins / SLM | argis-extensions | `packages/argis` |
| LLM router (interim) | OmniRoute | `packages/router` (revamp spike) |

## OmniRoute interim inventory (H5)

Features to revamp in `spikes/rust/router` or `spikes/zig/router` — **not** long-term canonical.

| Feature area | OmniRoute capability | Target owner |
|--------------|---------------------|--------------|
| Combo routing | 14 strategies, Auto-combo 9-factor scoring | `packages/router` revamp |
| OpenAI-compatible gateway | `/v1/*` multi-provider | cliproxy++ (Go) + router revamp |
| MCP server | 37 tools, SSE/stdio/HTTP | bifrost + argis plugins |
| A2A protocol | 6 built-in agent skills | router revamp |
| Deploy stack | Docker Compose + Caddy LB + Redis | phenotype-gateway ops docs |
| CLI surface | chat, routing, MCP subcommands | absorb into unified gateway CLI |
| SOCKS5 outbound | proxy routing | cliproxy++ / bifrost |

## argis-extensions classification (H5)

Plugin plane inside phenotype-gateway `third_party/argis-extensions` → `packages/argis`.

| Subsystem | Role | Spike lang |
|-----------|------|------------|
| `plugins/*` | toolrouter, smartfallback, promptadapter, voyage rerank | Go |
| `slm/` + `slm-server/` | local SLM inference (vLLM, MLX) | Go |
| `wrappers/cliproxy`, `wrappers/agentapi` | gateway integration clients | Go |
| `services/researchintel`, `services/promptadapter` | Python sidecars | Python (edge) |
| `providers/oauthproxy`, `providers/agentcli` | auth + agent CLI providers | Go |

## Feature matrix

| Feature | agentapi++ | cliproxy++ | bifrost | vibeproxy | OmniRoute | argis | Target spike lang |
|---------|------------|------------|---------|-----------|-----------|-------|-------------------|
| HTTP agent control | yes | — | — | — | — | via wrapper | Go |
| OpenAI-compatible `/v1/*` | — | yes | partial | — | partial | — | Go |
| Multi-provider routing | — | yes | yes | via proxy | yes | yes | Go / Rust |
| MCP integration | partial | — | yes | — | partial | partial | Go |
| macOS menu-bar client | — | — | — | yes | — | — | Swift/Go |
| Plugin architecture | — | — | partial | — | — | yes | Go |
| Auth / OAuth | partial | yes | yes | — | partial | oauthproxy | Go + Authvault |
| SLM / embeddings | — | — | — | — | — | yes | Go |
| Combo / fallback routing | — | partial | yes | — | yes | smartfallback | Go / Rust |

**Mapped:** 9/9 feature rows have target owners (100% stub → inventory complete).

## Spike status (2026-06-18)

| Spike path | Status |
|------------|--------|
| `spikes/go/agentapi` | README scaffold (#3); smoke test pending |
| `spikes/go/cliproxy` | README scaffold (#3); smoke test pending |
| `spikes/go/bifrost` | README scaffold (#3); `feat/bifrost-local-delta` (#6) |
| `spikes/go/argis` | README scaffold (#3); smoke **fail** — missing `bifrost-extensions/api/graphql/gen`; hatchet module fetch (2026-06-18) |
| `spikes/rust/router` | README scaffold (#3); OmniRoute revamp TBD |
| `spikes/zig/router` | README scaffold (#3); alt path |

## Promotion checklist (per component)

- [x] agentapi++ branch superset merged to `main` (#531)
- [x] cliproxy++ vibeproxy absorption documented (#1024)
- [x] bifrost vendor pin established (#5)
- [x] phenotype-gateway scaffold with submodule dirs (#1)
- [x] Submodule SHAs pinned in phenotype-gateway `third_party/` (#2)
- [x] Spike README scaffolds in `spikes/{go,rust,zig,mojo}/` (#3)
- [x] CI scaffold: single checkout + recursive submodules (#5)
- [x] disposition-index `fsm: done` with PR ref (Wave H gateway batch 2026-06-18 — bifrost#6, phenotype-gateway#2#3#4#5, go-sdk#17, cliproxy#1025#1026)
- [ ] Spike passes build + smoke test in `spikes/<lang>/` (argis fail logged 2026-06-18)
