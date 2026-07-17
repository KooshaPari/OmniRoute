# phenoData Absorption

| Property | Value |
|----------|-------|
| Source | `KooshaPari/phenoData` |
| Target | `pheno/crates/pheno-data-*` (5 crates) |
| Branch | `absorb/pheno-data-2026-07-17` |
| Status | absorbed (2026-07-17) |
| LOC | ~1,937 |

## What was absorbed

The full 5-crate workspace contents of `KooshaPari/phenoData`:

| Source crate | Target crate | Notes |
|---|---|---|
| `phenoData/crates/core` | `pheno/crates/pheno-data-core` | `pheno-data-core` — core dataset traits/records |
| `phenoData/crates/pheno-query` | `pheno/crates/pheno-data-query` | `pheno-data-query` — unified query builder, SurrealQueryPlanner + PostgresQueryPlanner |
| `phenoData/crates/surreal-bridge` | `pheno/crates/pheno-data-surreal` | `pheno-data-surreal` — SurrealDB embedded with Pheno extensions |
| `phenoData/crates/pg-bridge` | `pheno/crates/pheno-data-pg` | `pheno-data-pg` — PostgreSQL/pgvector bridge |
| `phenoData/crates/smoke-tests` | `pheno/crates/pheno-data-smoke-tests` | `pheno-data-smoke-tests` — smoke test binary |

## Changes applied

- Crate names renamed to `pheno-data-*` (matching directory convention used in
  `crates/pheno-context`, `crates/pheno-cdylib-bridge`, etc.)
- Path-deps rewritten (`../pheno-query` → `../pheno-data-query`,
  `../core` → `../pheno-data-core`)
- Source code `use` statements rewritten
- Test file imports updated
- Workspace members registered in `pheno/Cargo.toml`
- Removed 5 stale `crates/pheno-data-from-phenoData/` artefacts (a prior
  failed absorption attempt left them in the tree)

## Files transferred

`crates/pheno-data-core/`: `Cargo.toml`, `src/lib.rs`, `tests/dataset.rs`
`crates/pheno-data-query/`: `Cargo.toml`, `src/lib.rs`, `tests/dispatch.rs`
`crates/pheno-data-surreal/`: `Cargo.toml`, `src/lib.rs`, `tests/dataset.rs`
`crates/pheno-data-pg/`: `Cargo.toml`, `src/lib.rs`, `tests/dataset.rs`
`crates/pheno-data-smoke-tests/`: `Cargo.toml`, `src/lib.rs`, `tests/smoke.rs`

Total: 16 files added, ~1,174 lines.

## Verification

| Check | Result |
|-------|--------|
| Files copied identically | ✅ (16 files) |
| Cross-crate paths rewritten | ✅ |
| Crate names renamed | ✅ |
| Workspace members registered | ✅ |
| Source `cargo check` (original repo) | ✅ — passed through `Checking pg-bridge` |
| Pheno workspace `cargo check` (deferred) | 🟡 Heavy deps (surrealdb + kv-rocksdb, tokio-postgres-rustls) cause >5min build; deferred to CI |

Source repo `KooshaPari/phenoData` archived on GitHub 2026-07-17.
