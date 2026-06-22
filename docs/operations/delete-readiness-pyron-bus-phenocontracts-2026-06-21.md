# Delete-readiness ledger: Pyron, phenotype-bus, PhenoContracts

**Date:** 2026-06-21  
**Authority:** phenotype-registry `registry/disposition-index.json`, `registry/components.lock`, `registry/chokepoints.json`  
**Scope:** answer whether Pyron, phenotype-bus, and PhenoContracts are 100% migrated to absorb targets and therefore delete-ready.

## Verdict summary

| Repo | Current state | 100% migrated? | Delete-ready? | Absorb target |
|------|---------------|----------------|---------------|---------------|
| `KooshaPari/Pyron` | Private/inaccessible by current `gh` token; local clone exists with legacy workspace | **No, not proven** | **No: HOLD_ARCHIVE** | DOMAIN_ROLES owners by surface |
| `KooshaPari/phenotype-bus` | Private/archive record; remote returns 404 to current token | **Mostly, with explicit cleanup gates** | **No: HOLD_DELETE until gates clear** | Eventra + phenotype-python-sdk pheno-events |
| `KooshaPari/PhenoContracts` | Public active repo, non-archived | **No** | **No: HOLD_DECOMPOSE** | PhenoSpecs/TestingKit or new verifier owner TBD + ADR-ECO-014 Rust owners |

## Pyron granular absorption

Pyron is fleet-dependency clean, but that is narrower than full content migration.

Migrated or repointed surfaces:

| Surface | Absorb target | Evidence |
|---------|---------------|----------|
| Config / Settly dependency | `phenotype-config` / `Configra` | `registry/chokepoints.json` marks Pyron verified-clean; local `Cargo.toml` has `settly = { git = "https://github.com/KooshaPari/phenotype-config" }`. |
| Observability / Traceon | `PhenoObservability` | Pyron chokepoint row repoints Traceon/observe class to PhenoObservability. |
| Auth / policy / cipher contracts | `Authvault` / AuthKit lineage | `disposition-index.json` row #11 and `phenoshared-p4-checkpoint.md` list Authvault#88 for contracts slice 2. |
| Event / bus contracts | `Eventra` | `phenoshared-p4-checkpoint.md` lists Eventra#19/#20; Eventra tree contains `rust/phenotype-event-bus` and `rust/phenotype-event-contracts`. |
| Agent / HTTP adapter contracts | `Agentora` | `phenoshared-p4-checkpoint.md` lists Agentora#92/#93 for slice 4. |
| Python MCP redirect | `substrate` / `PhenoMCP` | `disposition-index.json` `py-pheno-mcp` row cites substrate#28, HexaKit#270, Pyron#58. |
| Python SDK edge packages | `phenotype-python-sdk` | `py-pheno-core` row redirects Python core to python SDK; phenotype-python-sdk owns current Python package index. |

Not proven migrated:

| Surface | Current evidence | Required gate |
|---------|------------------|---------------|
| Local vendored Rust crates | Local Pyron still has workspace members `crates/phenotype-contracts`, `crates/phenotype-event-bus`, `crates/phenotype-config-core`, `crates/phenotype-mcp`, etc. | Confirm Pyron tombstone/gutted branch is pushed and archived, or migrate/delete those surfaces with PR evidence. |
| Historical Python middleware/utilities | Local Pyron has `phenotype-middleware-py`, `hexagon-python`, `packages/pheno-core`, and many docs/worklogs. | Map Python middleware to `phenotype-python-sdk` or retire with explicit no-merit verdict. |
| Hard delete claim | Current token sees `KooshaPari/Pyron` as 404, but local clone and components.lock say restored-archived after prior premature delete. | Do not hard-delete from registry evidence alone. Keep archive/hold until authoritative remote state plus tombstone content is verified. |

## phenotype-bus granular absorption

Migrated surfaces:

| Surface | Absorb target | Evidence |
|---------|---------------|----------|
| Rust in-memory bus/helper material | `phenoEvents#9` / Eventra lineage | `registry/components.lock` states direct absorption lifted `InMemoryBus` adapter plus audit/deny/cliff/version helper. |
| Rust event bus API | `Eventra/rust/phenotype-event-bus` | GitHub tree for Eventra lists `rust/phenotype-event-bus/src/lib.rs` and `memory.rs`. |
| Event contract traits | `Eventra/rust/phenotype-event-contracts` | Eventra tree lists `bus.rs`, `contract.rs`, `envelope.rs`, `event.rs`, `pubsub.rs`, `store.rs`. |
| Event sourcing | `Eventra/rust/phenotype-event-sourcing` | Eventra tree lists event sourcing domain/application/adapters modules. |
| Python event bus edge | `phenotype-python-sdk/packages/pheno-events` | GitHub tree lists `packages/pheno-events/src/pheno_events/bus.py`, `core/event_bus.py`, and `nats_bus.py`. |
| Stale observability refs | `PhenoObservability` cleanup | components.lock cites PhenoObservability#178 removing stale phenotype-bus test/docs surface. |

Delete blockers:

| Blocker | Required evidence |
|---------|-------------------|
| Cleanup PRs | 2026-06-21 check: `phenokits-commons#7` MERGED and `phenotype-apps#43` MERGED; `Eidolon#66`, `Sidekick#75`, and `PhenoObservability#178` remain OPEN. |
| Raw gitlinks/path refs | Still blocked. Org search finds `Eidolon/crates/eidolon-mobile/Cargo.toml` with `phenotype-bus = { path = "../../../phenotype-bus" }`, `Sidekick/docs/getting-started.md` with a path dependency example, and PhenoObservability phenotype-bus E2E docs. |
| Remote state | Current token gets 404; registry says archived private. Treat as archive-held, not hard-delete-ready. |


### 2026-06-21 phenotype-bus gate recheck

| Check | Result | Evidence |
|-------|--------|----------|
| `phenokits-commons#7` | MERGED | `docs: redirect archived phenotype-bus to phenoEvents`, merged 2026-06-21T01:45:06Z |
| `phenotype-apps#43` | MERGED | `chore(apps): remove archived delete-gate repo gitlinks`, merged 2026-06-21T06:19:42Z |
| `Eidolon#66` | OPEN | `fix(eidolon): repoint archived phenotype-bus dependency`; org search still finds `crates/eidolon-mobile/Cargo.toml` path dep |
| `Sidekick#75` | OPEN | `fix(sidekick): repoint archived phenotype-bus dependency`; org search still finds `docs/getting-started.md` path dep example |
| `PhenoObservability#178` | OPEN | `fix(observability): remove stale phenotype-bus test surface`; org search still finds phenotype-bus E2E docs |

**Ruling:** keep `gate-phenotype-bus` at HOLD_DELETE / blocked-open-prs. The repo is substantially absorbed, but delete-readiness is not proven while production/path references and stale observability docs remain visible.

## PhenoContracts granular absorption

Migrated or governed surfaces:

| Surface | Absorb target | Evidence |
|---------|---------------|----------|
| Runtime contract slices | ADR-ECO-014 role owners | `phenoshared-p4-checkpoint.md` lists Authvault, Eventra, Agentora, phenotype-rust-sdk, and python-sdk slice PRs. |
| Event/bus contract slice | Eventra | Eventra tree contains `rust/phenotype-event-contracts`. |
| Contract specs | PhenoSpecs candidate | PhenoSpecs owns platform contracts/spec registry, but no evidence yet that PhenoContracts verifier surfaces moved there. |

Not migrated:

| Surface | Current evidence | Required absorb target |
|---------|------------------|------------------------|
| TypeScript verifier port | `PhenoContracts/ports/contract_verifier.ts` exists on active remote | Assign to TestingKit, PhenoSpecs, or a new verification substrate. |
| Formal adapter ports | `ports/adapters/kani.ts` and `ports/adapters/prusti.ts` exist | Same owner as verifier; preserve Kani/Prusti semantics and tests. |
| Verification tests/benches | `ports/tests/*`, bench and property tests exist | Move with verifier/adapters. |
| Rust crate copy | `rust/crates/phenotype-contracts` exists | Reconcile against ADR-ECO-014 terminal slices; either retire as duplicate or migrate missing deltas. |
| Boundary/intent docs and coverage | `docs/boundary/PhenoContracts.md`, `docs/intent/PhenoContracts.md`, coverage HTML exist | Move docs to registry/PhenoSpecs and retire generated coverage if not needed. |

## Next execution gates

1. Pyron: locate the tombstone/gutted PR or branch, compare against local legacy surfaces, then update `gate-pyron` only after the remote archived content is proven.
2. phenotype-bus: verify cited cleanup PRs merged and run a post-merge org reference sweep; only then change `gate-phenotype-bus` from `hold` to `delete-eligible`.
3. PhenoContracts: open a decomposition ADR/ledger assigning verifier/adapters/tests to a terminal owner before any archive/delete action.
