# Wave 2 execution — 2026-06-17

Chokepoint repoints and domain-role excisions per [RFC 001](./rfc/001-traceon-observe-role.md) and [RFC 002](./rfc/002-settly-config-role.md).

## Completed in this wave

| Track | Repo PR | Change |
|-------|---------|--------|
| Pyron → phenotype-config | `Pyron` | Remove `Settly/` workspace member; add `settly` git dep |
| HexaKit settly excision | `HexaKit` | Remove `crates/settly` from workspace; `MIGRATED.md` stub |
| Traceon → observe | `PhenoObservability` | RFC 001 status doc; source parity verified |
| PlatformKit devenv | `phenotype-go-sdk` | Document nanovms as canonical devenv successor |

## Chokepoint table (updated)

| Consumer | Repoint to | Status |
|----------|------------|--------|
| Pyron | `phenotype-config` / `settly` | **Repointed** (git dep) |
| PhenoObservability | observe workspace `tracingkit` | **Canonical** — parity verified |
| DevHex | `phenotype-go-sdk` `packages/devhex` | Pending consumer PR |
| thegent | python-sdk auth-kit; tooling byteport | Blocked |

## Archive impact

| Archive | Prior verdict | Wave 2 note |
|---------|---------------|-------------|
| Settly (source repo) | archived | Safe after HexaKit stub removal + zero path deps |
| Traceon (source repo) | archived | Safe after HexaKit `Traceon/` member removal |
| PlatformKit | KEEP_ARCHIVED | devhex absorbed; devenv → nanovms canonical |

## Next wave

1. Pyron lockstep: `Stashly`, `Traceon`, pheno workspace members.
2. HexaKit: remove `Traceon/` workspace member after consumer audit.
3. DevHex repoint → unblock PlatformKit archive delete eligibility.
4. Genesis rollout on remaining canonical repos (~12).
