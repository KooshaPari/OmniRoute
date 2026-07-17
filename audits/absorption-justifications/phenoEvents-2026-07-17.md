# phenoEvents — Absorption Justification

**Status:** ABSORBED 2026-07-17
**Source:** `KooshaPari/phenoEvents` (664 KB, 17 branches, last push 2026-07-14)
**Target:** `KooshaPari/pheno` at `crates/phenotype-event-bus/`
**Disposition:** ABSORB

## Confidence

**0.85** — HIGH. EventBus port with hexagonal architecture; phenoEvents is a natural crate for the pheno workspace. Bonus: the absorption resolved a phantom workspace dependency in `pheno/Cargo.toml` (`phenotype-event-bus = { path = "crates/phenotype-event-bus" }` had no crate at the path).

## What was absorbed

| Item | Source path | Target path | Notes |
|------|-------------|-------------|-------|
| Main crate | `src/*.rs` (10 files) | `crates/phenotype-event-bus/src/` | renamed package `pheno-events` → `phenotype-event-bus`; lib name preserved as `pheno_events` |
| Tests | `tests/property_tests.rs` | `crates/phenotype-event-bus/tests/` | 8 property tests for envelope + schema |
| Benches | `benches/{bus,schema}.rs` | `crates/phenotype-event-bus/benches/` | Criterion benchmarks |
| Docs | `CHANGELOG.md`, `SSOT.md` | `crates/phenotype-event-bus/` | historical provenance |
| README | `README.md` | `crates/phenotype-event-bus/README.md` | rewritten to reflect post-absorption identity + migration notes |
| Observability backend | `crates/phenoevents-observability/` | (workspace-level) `pheno/crates/phenoevents-observability/` | REUSED existing workspace member — no copy created |

**Total: ~16 files transferred** (10 src + 1 test + 2 bench + 2 docs + 1 readme + Cargo.toml). Observability is provided by the pre-existing workspace member; no parallel copy was created.

## Renaming applied

| Was | Now |
|-----|-----|
| Crate package name: `pheno-events` | `phenotype-event-bus` |
| Crate lib name (in `[lib].name`): `pheno_events` | `pheno_events` (preserved) |
| Source `use` paths: `use pheno_events::...` | `use pheno_events::...` (unchanged) |
| Cargo.toml consumer: `pheno-events = { path = ... }` | `phenotype-event-bus = { path = ... }` |

**Strategy**: package renamed, lib name preserved. This avoids touching 13+ source files while still resolving the phantom workspace dep.

## Workspace integration

```toml
# pheno/Cargo.toml — added to members:
members = [
    ...
    "crates/phenotype-event-bus",
    ...
]

# workspace.dependencies: phantom path now resolves
phenotype-event-bus = { path = "crates/phenotype-event-bus" }
```

The absorbed crate's `[dependencies]` declares `phenoevents-observability = { path = "../phenoevents-observability" }` — this is the pre-existing workspace member, not a new crate.

## What was NOT absorbed

- Workspace-level files from the source repo (`AGENTS.md`, `CLAUDE.md`, `lefthook.yml`, `justfile`, `audit_scorecard.json`, `.github/`, `docs/`, `Cargo.lock` from the source repo) — these were specific to the standalone-repo workflow. The absorbed crate adopts the parent `pheno` workflows.
- The source repo's `crates/phenoevents-observability/` directory — this is satisfied by the existing workspace member at `pheno/crates/phenoevents-observability/`. No duplicate was created.

## Verification

| Check | Result |
|-------|--------|
| `cargo check -p phenotype-event-bus` | ✅ Compiles clean (workspace context) |
| `cargo test -p phenotype-event-bus --lib` | ✅ 37 unit tests pass |
| `cargo test -p phenotype-event-bus --tests` | ✅ 37 unit + 8 property tests pass (45 total) |
| `cargo metadata` workspace resolution | ✅ `phenotype-event-bus` resolves as a real workspace member |
| Phantom workspace dep `phenotype-event-bus` | ✅ Now resolves to a real crate at the declared path |
| `use pheno_events::...` still works | ✅ Lib name preserved as `pheno_events` |

## Boundary

See `docs/boundary/phenotype-event-bus.md` in the registry spine.

## Restore procedure

```sh
# 1. Un-archive the source repo
gh repo unarchive KooshaPari/phenoEvents

# 2. Remove the absorbed crate from the workspace
cd /Users/kooshapari/CodeProjects/Phenotype/repos/pheno
git rm -r crates/phenotype-event-bus/
# Edit Cargo.toml: remove the workspace member entry and the workspace.dependencies path entry
git commit -m "revert: undo phenoEvents absorption"

# 3. In the registry spine
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/phenoEvents.json from git history (revert to queued status)
```

## Cross-references

- Disposition row: `registry/disposition-index.json` → `"KooshaPari/phenoEvents"`
- Boundary doc: `docs/boundary/phenotype-event-bus.md`
- Target repo: https://github.com/KooshaPari/pheno
- Source repo: https://github.com/KooshaPari/phenoEvents
- Workspace phantom-dep resolved: `pheno/Cargo.toml` `phenotype-event-bus = { path = "crates/phenotype-event-bus" }`
