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

## Go smoke results (H9 — phenotype-gateway #6)

Smoke infra merged in [phenotype-gateway #6](https://github.com/KooshaPari/phenotype-gateway/pull/6): `scripts/smoke-go.{sh,ps1}`, per-spike `smoke.sh`, Taskfile `smoke` target, CI `smoke-go` matrix (Go 1.23/1.24, `continue-on-error` until fork gates green).

| Plane | Submodule pin | Smoke command | Result | Blocker / notes |
|-------|---------------|---------------|--------|-----------------|
| agentapi-plusplus | `7898704` | `go build ./...` | **fail** | `x/acpio`: `*ACPConversation` missing `ClearMessages` — does not implement `screentracker.Conversation` |
| cliproxyapi-plusplus | `866ca6dd` | `go build ./...` | **fail** | `go.mod` unresolved merge conflict markers at pin |
| argis-extensions | `2fe3f952` | `go build ./...` | **fail** | missing `github.com/kooshapari/bifrost-extensions/api/graphql/gen`; hatchet module fetch error |
| bifrost (root) | `f9cec7bb` | `go build ./...` | **pass** (vacuous) | no Go packages at root pin; vendor tag + local-delta build TBD |
| bifrost/transports | `f9cec7bb` | `go build ./...` | canonical smoke target | `scripts/smoke-go.sh` builds `third_party/bifrost/transports`; spike README defers to vendor pin bump (bifrost #7) |

**Summary:** 1 vacuous pass, 3 fail, 1 deferred (transports). Promotion blocked on fork gate fixes.

## Spike status (2026-06-18)

| Spike path | Status |
|------------|--------|
| `spikes/go/agentapi` | README + smoke (#3, #6); **fail** — `ClearMessages` interface |
| `spikes/go/cliproxy` | README + smoke (#3, #6); **fail** — `go.mod` merge conflict |
| `spikes/go/bifrost` | README + smoke (#3, #6); root vacuous pass; `feat/bifrost-local-delta` (bifrost #6); vendor pin bifrost #7 |
| `spikes/go/argis` | README + smoke (#3, #6); **fail** — `bifrost-extensions/api/graphql/gen`; hatchet fetch |
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
- [x] Go smoke infra: scripts + CI matrix + spike smoke stubs (phenotype-gateway #6)
- [x] disposition-index `fsm: done` with PR ref (Wave H gateway batch 2026-06-18 — bifrost#6, phenotype-gateway#2#3#4#5#6, go-sdk#17, cliproxy#1025#1026)
- [ ] Spike passes build + smoke test in `spikes/<lang>/` (3/4 forks fail at 2026-06-18 pins — agentapi, cliproxy, argis)
