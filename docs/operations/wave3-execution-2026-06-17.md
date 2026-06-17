# Wave 3 execution — 2026-06-17

Chokepoint lockstep + HexaKit excision + genesis fleet start.

## Completed (this wave)

| Track | Repo | Change |
|-------|------|--------|
| Pyron lockstep | Pyron | Remove `Traceon`/`Stashly` members; git-pin `tracingkit`, transitional `stashly` |
| HexaKit excision | HexaKit | Remove `Traceon/` + `crates/stashly` from workspace; `MIGRATED.md` stubs |
| DevHex alignment | DevHex | PlatformKit consumer migration doc → go-sdk `devenv-abstraction` |
| Registry | phenotype-registry | This ledger + chokepoint updates |

## Chokepoint status

| Consumer | Repoint to | Status |
|----------|------------|--------|
| Pyron | phenotype-config, PhenoObservability, HexaKit stashly (transitional) | **Wave 3 lockstep** |
| DevHex | phenotype-go-sdk `packages/devhex` | **Documented** — library canonical; CLI remains DevHex |
| PhenoObservability | observe workspace | **Canonical** (G2) |

## Genesis fleet (Wave 3 matrix — pending PRs)

| Repo | Role | Genesis PR |
|------|------|------------|
| phenotype-otel | observe | pending |
| PhenoMCP | connect | pending |
| Authvault | connect | pending |
| phenotype-journeys | test | pending |
| kwality | quality | pending |
| AgilePlus | specs/WP | pending |

## Blockers discovered

| Item | Finding |
|------|---------|
| `phenotype-resilience` | Repo **404** — stashly stays on HexaKit git dep until Rust workspace exists |
| Genesis subagents | `resource_exhausted` — parent agent executed manifest/docs lanes directly |

## Next (Wave 4)

1. Pyron pheno workspace members lockstep (`Logify`, `Metron`, …)
2. Metron archive path remap (`crates/metron/` vs repo root)
3. Genesis batch PRs for 6 repos above
4. PlatformKit delete eligibility after DevHex consumer audit
