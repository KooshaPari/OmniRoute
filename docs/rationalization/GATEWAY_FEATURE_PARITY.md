# Gateway feature parity matrix

> **Lane H** — companion to [ADR-ECO-014](../adrs/ADR-ECO-014-phenotype-gateway-charter.md).  
> Fill rows as H5 inventory completes. Promotion to `phenotype-gateway/packages/` requires ≥80% mapped for a component.

## Planes

| Plane | Interim canonical | phenotype-gateway target |
|-------|-------------------|--------------------------|
| Agent terminal API | agentapi-plusplus | `packages/agentapi` |
| CLI subscription proxy | cliproxyapi-plusplus | `packages/cliproxy` |
| macOS client | vibeproxy → cliproxy++ | `packages/cliproxy/client` |
| Enterprise gateway | bifrost | `packages/bifrost` |
| Plugins / SLM | argis-extensions | `packages/argis` |
| LLM router (interim) | OmniRoute | `packages/router` (revamp spike) |

## Feature matrix (stub)

| Feature | agentapi++ | cliproxy++ | bifrost | vibeproxy | OmniRoute | argis | Target spike lang |
|---------|------------|------------|---------|-----------|-----------|-------|-------------------|
| HTTP agent control | yes | — | — | — | — | — | Go |
| OpenAI-compatible `/v1/*` | — | yes | partial | — | partial | — | Go |
| Multi-provider routing | — | yes | yes | via proxy | yes | yes | Go / Rust |
| MCP integration | partial | — | yes | — | partial | partial | Go |
| macOS menu-bar client | — | — | — | yes | — | — | Swift/Go |
| Plugin architecture | — | — | partial | — | — | yes | Go |
| Auth / OAuth | partial | yes | yes | — | partial | — | Go + Authvault |

## Promotion checklist (per component)

- [ ] Branch superset merged to interim canonical `main`
- [ ] Submodule pinned in phenotype-gateway
- [ ] Spike passes build + smoke test in `spikes/<lang>/`
- [ ] Parity row ≥80% for owned features
- [ ] disposition-index `fsm: done` with PR ref
