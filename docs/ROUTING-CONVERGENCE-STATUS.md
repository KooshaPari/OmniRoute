# Routing Convergence Status (dom-services-routing, 2026-06-02)

Companion to [ADR-001: OmniRoute as Canonical Routing Project](./ADR-001-canonical-routing.md).
This note records the cross-repo convergence state for the Phenotype routing cluster
under the reverse-KISS principle: **one routing framework others consume.**

## Canonical
- **OmniRoute** (this repo) — canonical routing framework. OpenAI-compatible gateway:
  smart routing, load-balancing, retries, multi-provider fallback, MCP/A2A surfaces.
  Consume this surface; do not hand-roll new routers.

## Cluster members & convergence verdict
| Repo | What it is | Verdict |
|------|-----------|---------|
| **OmniRoute** | Canonical gateway (TS, 3474 files) | KEEP — canonical |
| **helios-router** | 44-file shell, `index.ts` = `console.log("Hello via Bun!")`, **0 inbound code refs** | ARCHIVE-CANDIDATE (proof: org-grep finds only inventory/governance doc mentions, no package/Cargo dep) |
| **bifrost** (`KooshaPari/bifrost`) | **Vendored fork of maximhq/bifrost** (3rd-party Go gateway) | NOT a peer framework. Future: thin Go adapter over OmniRoute's contract, or drop. Low priority; do not archive a vendored fork. |
| **phenoRouterMonitor** | Mislabeled mega-shelf (`name = phenotype-infrakit`); carries `bifrost-routing` crate + agileplus-dashboard + ~11 crates DUPLICATED with HexaKit | NEEDS DESIGN DECISION — see naming-collision note below |
| **cliproxy** | Proxy/policy layer (dom-cli-ax domain) | Coordinate; candidate OmniRoute-contract adapter. Not claimed here. |

## ⚠ Three different "bifrost" referents (naming-collision hazard)
1. `KooshaPari/bifrost` repo = vendored maximhq Go gateway fork.
2. ADR-001's "bifrost — Phenotype routing substrate (in `pheno` monorepo)".
3. `crates/bifrost-routing` inside **phenoRouterMonitor** = the actual Phenotype routing-substrate crate.

These must be disambiguated before OmniRoute's core can be rebuilt "around bifrost" per ADR-001.
Recommend: rename (2)/(3) to `phenotype-routing` or fold into OmniRoute; keep (1) clearly tagged as the vendored fork.

## Consumable surface (reverse-KISS)
OmniRoute's consumable contract = its OpenAI-compatible API surface + routing/provider/fallback config.
See [ADR-001](./ADR-001-canonical-routing.md), [AGENTROUTER.md](./AGENTROUTER.md), [PROVIDERS.md](./PROVIDERS.md),
and [architecture/RESILIENCE_GUIDE.md](./architecture/RESILIENCE_GUIDE.md).
