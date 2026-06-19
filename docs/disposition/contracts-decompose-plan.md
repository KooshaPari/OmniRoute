# phenotype-contracts decompose plan (D-01)

**Source:** HexaKit `crates/phenotype-contracts` / phenoShared interim  
**Disposition:** DECOMPOSE → role workspace owners  
**ADR:** ADR-ECO-014 (phenoShared interim only)  
**Consumer manifest:** [phenotype-contracts-consumer-manifest.md](./phenotype-contracts-consumer-manifest.md)

## Slice owners

| Slice | Target owner | Manifest | Status |
|-------|--------------|----------|--------|
| 1 — Port traits / domain contracts | phenoShared (interim) → role repos | [consumer manifest](./phenotype-contracts-consumer-manifest.md) | **in_progress** |
| — InMemory adapters | HexaKit `phenotype-contract-adapters` | — | done |
| 2 — Auth / policy contracts | **Authvault** | [consumer manifest § Next slices](./phenotype-contracts-consumer-manifest.md#next-slices-domain_roles-terminal-owners) | **partial** — Authvault#88 |
| 3 — Event / bus contracts | **Eventra** | [consumer manifest § Next slices](./phenotype-contracts-consumer-manifest.md#next-slices-domain_roles-terminal-owners) | pending |
| 4 — HTTP/event adapters | **Agentora** / substrate | [consumer manifest § Next slices](./phenotype-contracts-consumer-manifest.md#next-slices-domain_roles-terminal-owners) | TBD per consumer scan |

Slice 1 interim pin: [HexaKit#264](https://github.com/KooshaPari/HexaKit/pull/264).

## Next PRs

1. ~~Registry consumer manifest for `phenotype-contracts` imports~~ — slice 1 manifest landed (this PR)
2. Per-domain PR when owner named in DOMAIN_ROLES (not phenoShared terminal)
