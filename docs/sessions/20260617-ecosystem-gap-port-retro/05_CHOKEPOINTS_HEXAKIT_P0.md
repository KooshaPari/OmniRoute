# Chokepoints + HexaKit P0 — session evidence

**Date:** 2026-06-17  
**Lanes:** G2 chokepoints, O inventory, P0 eviction

## Chokepoint verification

| ID | Result | Evidence |
|----|--------|----------|
| Pyron | `verified-internal` | 0 org manifest git deps on pheno/Stashly/Settly/PhenoAgent |
| Tracera | `verified-clean` | 0 AuthKit in Cargo.toml/pyproject.toml |
| thegent | `verified-clean` | (prior session) |
| PhenoObservability | `repointed` | #158 on main |
| phenoRouterMonitor | `repointed` | phenotype-tooling #155 |

## HexaKit P0

- Removed `Metron` + `agileplus/crates/*` from workspace `members`
- Added `exclude` entries + README redirect stubs
- Inventory: `docs/rationalization/HEXAKIT_EVICTION_INVENTORY.md`

## Open

- `phenotype-go-sdk` → PhenoMCP (McpKit gate)
- HexaKit P1: Traceon workspace eviction
- Pyron long-term: decompose shelf → domain SDK deps (not blocking archive)
