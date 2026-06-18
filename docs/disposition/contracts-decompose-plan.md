# phenotype-contracts decompose plan (D-01)

**Source:** HexaKit `crates/phenotype-contracts` / phenoShared interim  
**Disposition:** DECOMPOSE → role workspace owners  
**ADR:** ADR-ECO-014 (phenoShared interim only)

## Slice owners

| Slice | Target owner | Status |
|-------|--------------|--------|
| Port traits / domain contracts | phenoShared (interim) → role repos | git-pinned HexaKit#264 |
| InMemory adapters | HexaKit `phenotype-contract-adapters` | done |
| HTTP/event adapters | Agentora / substrate | TBD per consumer scan |

## Next PRs

1. Registry consumer manifest for `phenotype-contracts` imports
2. Per-domain PR when owner named in DOMAIN_ROLES (not phenoShared terminal)
