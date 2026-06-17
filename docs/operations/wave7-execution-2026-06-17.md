# Wave 7 — stashly canonical + HexaKit genesis refresh — 2026-06-17

**Predecessor:** [wave6-execution-2026-06-17.md](./wave6-execution-2026-06-17.md)

## Wave 7 PRs

| Repo | PR | Change |
|------|-----|--------|
| Pyron | TBD | Repoint `stashly` git dep HexaKit → phenoShared |
| HexaKit | TBD | Post-eviction genesis refresh (charter, SOTA, migration doc) |
| phenotype-registry | TBD | This ledger + chokepoint/DOMAIN_ROLES updates |

## stashly repoint

| Consumer | Before | After |
|----------|--------|-------|
| Pyron | `stashly` → HexaKit (transitional) | `stashly` → phenoShared |

Canonical absorption: disposition #46, ADR-ECO-001, phenoShared#176.

## HexaKit genesis refresh

Updated charter out-of-scope table and transitional note to reflect Waves 2–7 evictions (settly, Traceon, stashly, Metron, agileplus). HexaKit remains genesis-only owner.

## Fleet verify

`rg 'HexaKit.*stashly' Cargo.toml` — Pyron was sole git consumer; repoint closes transitional pin.

## Next

1. ~~Archive delete eligibility review (Settly/Traceon/stashly/Metron stubs)~~ → Wave 8 audit; settly stub prune PR
2. Remaining HexaKit `crates/*` disposition rows → role owners (Wave 9+ P3)
3. Dedicated `phenotype-resilience` repo (optional) — phenoShared holds `stashly` today per ADR-ECO-001 absorption path
