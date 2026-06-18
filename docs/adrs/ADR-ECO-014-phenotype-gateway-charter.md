# ADR-ECO-014: phenotype-gateway domain charter

## Status
Accepted (2026-06-17)

## Context

The org has multiple overlapping gateway/router repos with heavy branch sprawl:

- **agentapi** / **agentapi-plusplus** — agent terminal HTTP API (fork of `coder/agentapi`)
- **cliproxyapi-plusplus** / **vibeproxy** — CLI subscription LLM proxy + macOS client
- **bifrost** — enterprise AI gateway (maximhq fork)
- **argis-extensions** — routing, SLM, embeddings, plugin architecture
- **OmniRoute** — interim TS LLM router MVP in active use but not long-term canonical design

Prior registry text (`ECOSYSTEM_MAP.md` Cluster A) declared OmniRoute canonical and agentapi-plusplus archive-eligible. User charter (2026-06-17) supersedes: preserve Go-native stacks via hard forks, merge branch supersets, then absorb into **phenotype-gateway** with per-component language spikes (Go / Rust / Zig / Mojo).

Protected repos (`KodeVibeGo`, `KVirtualStage`, P2/472-P2/KlipDot/kwality) are never deleted or unarchived.

## Decision

1. Create **phenotype-gateway** as the canonical domain owner for agent API + LLM proxy + enterprise gateway + router revamp.
2. **Interim hard forks** remain canonical per plane until submodule promotion:
   - `agentapi-plusplus` — agent terminal API plane
   - `cliproxyapi-plusplus` — subscription proxy plane (+ vibeproxy client)
   - `bifrost` — enterprise gateway plane (vendor-pinned)
   - `argis-extensions` — plugin/extensions plane
3. **OmniRoute** is **interim MVP** — feature inventory → parity matrix → revamp spike inside phenotype-gateway; not permanent canonical.
4. **Promotion path:** git submodule pin in phenotype-gateway → full `packages/` absorption when spike passes `GATEWAY_FEATURE_PARITY.md` checklist.
5. **agentapi** (private archive) fully absorbs into agentapi-plusplus; stay archived.

## Rationale

Rebuilding OmniRoute/bifrost/cliproxy features piecemeal in Rust discards mature Go implementations. Branch superset merges first; language spikes second; monorepo absorption last.

## Consequences

- Amend `ECOSYSTEM_MAP.md` Cluster A: OmniRoute interim; agentapi++ canonical fork.
- New disposition rows for Cluster H repos in `disposition-index.json`.
- Wave H execution ledger drives branch merges before phenotype-gateway scaffold.

## References

- [wave-h-gateway-charter-2026-06-17.md](../operations/wave-h-gateway-charter-2026-06-17.md)
- [GATEWAY_FEATURE_PARITY.md](../rationalization/GATEWAY_FEATURE_PARITY.md)
