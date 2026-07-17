# PhenoPlugins Absorption Record

**Source repo**: `KooshaPari/PhenoPlugins` (archived 2026-07-17)
**Target**: `KooshaPari/pheno` monorepo
**Path**: `crates/pheno-plugins-{core,git,sqlite,vessel,examples}/`
**Branch**: `absorb/pheno-plugins-2026-07-17`
**Wave**: `2026-07-17-queue-refresh-2`

## What was absorbed

PhenoPlugins v0.1.0 — a 5-crate workspace defining the plugin
system for the Phenotype ecosystem (adapter, VCS, storage plugins
with traits, manifest, registry, lifecycle, guardrails).

### Member mapping

| Source                          | Target                          |
|---------------------------------|---------------------------------|
| `crates/pheno-plugin-core`      | `crates/pheno-plugins-core`     |
| `crates/pheno-plugin-git`       | `crates/pheno-plugins-git`      |
| `crates/pheno-plugin-sqlite`    | `crates/pheno-plugins-sqlite`   |
| `crates/pheno-plugin-vessel`    | `crates/pheno-plugins-vessel`   |
| `crates/pheno-plugin-examples`  | `crates/pheno-plugins-examples` |

## Changes made during absorption

1. **Crate rename** — `pheno-plugin-*` → `pheno-plugins-*` (kebab-case convention from existing `pheno-context`, `pheno-cdylib-bridge`)
2. **Path deps** rewritten — `pheno-plugin-core` → `pheno-plugins-core` etc.
3. **Cross-crate `use` statements** updated in tests/, examples/, src/{error.rs, lib.rs}
4. **pheno-plugins-vessel** — removed orphan `[[bench]]` block (the
   source repo's `benches/perf.rs` doesn't match the expected
   `benches/pheno-plugins-vessel.rs` filename; the block was a
   Cargo.toml mistake)
5. **pheno-plugins-sqlite** — downgraded `rusqlite` from `0.40` to
   `0.32` (workspace already has `agileplus-benchmarks` using
   rusqlite 0.32; only one package may specify `links="sqlite3"`
   to avoid native lib conflict)
6. **Workspace members** registered in `Cargo.toml`

## Verification

```
cargo check -p pheno-plugins-{core,git,sqlite,vessel,examples}
  -> Finished `dev` profile [unoptimized + debuginfo] in 1.79s
```

All 5 plugin crates compile clean. Test imports verified.

## Outcome

- 15 files changed, 55 insertions(+), 53 deletions(-)
- Branch pushed: `absorb/pheno-plugins-2026-07-17` → `origin/main`
- Source archived 2026-07-17

## Notes

PhenoPlugins crates are now the canonical plugin system for the
pheno monorepo. The plugin contract (traits, manifest, registry,
guardrails, lifecycle) is exposed via `pheno-plugins-core` and
extended by `pheno-plugins-{git,sqlite,vessel}` for the canonical
adapter implementations.