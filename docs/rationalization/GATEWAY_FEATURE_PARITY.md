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

## Go smoke results (H9 closeout — phenotype-gateway #12)

Smoke infra: [phenotype-gateway #6](https://github.com/KooshaPari/phenotype-gateway/pull/6); pin bump [phenotype-gateway #12](https://github.com/KooshaPari/phenotype-gateway/pull/12) (`3974924`); CI `continue-on-error` removed when 4/4 forks pass.

| Plane | Submodule pin | Smoke command | Result | Fix / notes |
|-------|---------------|---------------|--------|-----------------|
| agentapi-plusplus | `5ae7736` | `go build ./...` | **pass** | agentapi-plusplus#540/#541 — `ClearMessages` + httpapi repair |
| cliproxyapi-plusplus | `54102578` | `go build ./...` | **pass** | go.mod conflict #1031+#1032; Windows Umask guard #1033 |
| argis-extensions | `0419dcf` | `go build ./...` | **pass** | graphql/gen committed argis-extensions#82 |
| bifrost/transports | `9c0d904` | `go build ./...` in `transports/` | **pass** | UI embed stub bifrost#9; monorepo replaces bifrost#10 |

**Summary:** 4/4 Go plane smokes pass at H9 pins (2026-06-19). Promotion gates unblocked; physical copy to `packages/` remains ordered per [PROMOTION.md](https://github.com/KooshaPari/phenotype-gateway/blob/master/docs/PROMOTION.md).

## Spike status (2026-06-19)

| Spike path | Status |
|------------|--------|
| `spikes/go/agentapi` | **pass** @ `5ae7736` |
| `spikes/go/cliproxy` | **pass** @ `54102578` |
| `spikes/go/bifrost` | **pass** @ `9c0d904` (`transports/`) |
| `spikes/go/argis` | **pass** @ `0419dcf` |
| `spikes/rust/router` | README scaffold (#3); OmniRoute revamp TBD |
| `spikes/zig/router` | README scaffold (#3); alt path |

## Promotion evaluation — `packages/agentapi` (Phase 4 task 10)

**Verdict:** **Eligible** — ≥80% parity met; smoke green at pin `5ae7736`. Physical re-home deferred until cliproxy dry-run completes (recommended order in phenotype-gateway `PROMOTION.md`).

| Criterion | Result | Evidence |
|-----------|--------|----------|
| ≥80% feature mapping | **95%** (9.5/10) | agentapi++ [PRD Features 1–10](https://github.com/KooshaPari/agentapi-plusplus/blob/main/PRD.md): all core agent-terminal features mapped; Feature 10 (cliproxy++/MCP peer integration) partial by design — ownership stays in cliproxy++/bifrost |
| Global matrix rows owned | **1 primary + 2 partial** | HTTP agent control (primary); Auth/OAuth, MCP (partial) |
| H9 smoke | **pass** | `spikes/go/agentapi` @ `5ae7736`; agentapi-plusplus#540 |
| `packages/agentapi` state | **stub** | README-only promotion target; submodule remains canonical until dry-run copy PR |

**Next step:** cliproxy++ → `packages/cliproxy` dry-run first; then agentapi copy PR with unchanged submodule pin contract.

## Promotion checklist (per component)

- [x] agentapi++ branch superset merged to `main` (#531)
- [x] cliproxy++ vibeproxy absorption documented (#1024)
- [x] bifrost vendor pin established (#5)
- [x] phenotype-gateway scaffold with submodule dirs (#1)
- [x] Submodule SHAs pinned in phenotype-gateway `third_party/` (#2, #12)
- [x] Spike README scaffolds in `spikes/{go,rust,zig,mojo}/` (#3)
- [x] CI scaffold: single checkout + recursive submodules (#5)
- [x] Go smoke infra: scripts + CI matrix + spike smoke stubs (phenotype-gateway #6)
- [x] disposition-index `fsm: done` with PR ref (Wave H gateway batch 2026-06-18 — bifrost#6, phenotype-gateway#2#3#4#5#6#12, go-sdk#17, cliproxy#1025#1026)
- [x] Spike passes build + smoke test in `spikes/go/` (4/4 pass at H9 pins — 2026-06-19)
