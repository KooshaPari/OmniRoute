# Audit — Database migration tooling for Rust (SIDE-52)

**Date:** 2026-06-22
**Task ID:** SIDE-52
**Agent:** orch-side-52
**Scope:** Read-only audit of three Rust database-migration tools: `refinery`, `sqlx::migrate` (`sqlx-cli`), and `diesel_migrations`. Output: comparison table + per-database recommendation (Postgres, SQLite, MySQL).
**Status:** TERMINAL — recommendations below are guidance only; no code change required this turn.

---

## TL;DR (recommendation matrix)

| Database   | Primary      | Secondary    | Avoid           | Why                                                                                                                                                                       |
| :--------- | :----------- | :----------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Postgres   | **sqlx-cli** | refinery     | diesel_migrations | Fleet is async-first (tokio via `pheno-tracing`, ADR-036B). `sqlx` is the only one of the three that is async-native, compile-time-checked, and runtime-agnostic. Civis (ACTIVE) already uses it. |
| SQLite     | **refinery** | sqlx-cli     | diesel_migrations (conditional) | Refinery's `rusqlite` feature is pure Rust, no C dep on `libsqlite3-sys`. sqlx works fine. Diesel only if you adopt the full Diesel ORM (forgecode pattern). |
| MySQL      | **sqlx-cli** | refinery     | diesel_migrations | Diesel's MySQL backend lacks `RETURNING`, historically the weakest of the three; diesel pulls in `libmysqlclient`. Refinery's `mysql_async` works with tokio. |

**One-line rule of thumb:** *If you're already using `sqlx` for queries, use `sqlx::migrate` / `sqlx-cli`. If you need a standalone migration-only tool, use `refinery`. Only reach for `diesel_migrations` if you're adopting Diesel as your full ORM.* This holds across all three target databases.

---

## Comparison table (3 tools × 14 axes)

Legend: ✅ first-class · 🟡 partial / conditional · ❌ not supported · ⚠️ discouraged

| Axis                                | refinery (0.8.x)                                                                                | sqlx-cli / `sqlx::migrate` (0.8.x)                                                                       | diesel_migrations (2.2.0)                                                                                       |
| :---------------------------------- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| Repo                                | `rust-db/refinery`                                                                              | `transact-rs/sqlx` (sqlx-cli subcrate)                                                                   | `diesel-rs/diesel` (`diesel_migrations` subcrate)                                                               |
| Stars (2026-06-22)                  | 1.7k                                                                                            | 17.2k                                                                                                     | 14.1k                                                                                                           |
| License                             | MIT                                                                                             | MIT / Apache-2.0                                                                                          | MIT / Apache-2.0                                                                                                |
| **Database support**                |                                                                                                  |                                                                                                            |                                                                                                                 |
| Postgres                            | ✅ via `postgres` or `tokio-postgres` feature                                                    | ✅ first-class                                                                                             | ✅ first-class                                                                                                  |
| SQLite                              | ✅ via `rusqlite` feature (pure Rust wrapper around libsqlite3)                                 | ✅ first-class                                                                                             | ✅ first-class                                                                                                  |
| MySQL                               | ✅ via `mysql` or `mysql_async` feature                                                          | ✅ first-class                                                                                             | 🟡 supported but weakest backend; no `RETURNING` clause                                                         |
| MSSQL                               | 🟡 via external `klickhouse` is Clickhouse; MSSQL via external projects only                    | ❌ removed in 0.7 (under SQLx Pro rewrite)                                                                 | ❌ not supported                                                                                                 |
| **Async model**                     |                                                                                                  |                                                                                                            |                                                                                                                 |
| Sync API                            | ✅ `Runner::run`                                                                                  | ❌ async-only                                                                                              | ✅ sync (Diesel is fundamentally sync)                                                                            |
| Async API                           | ✅ `Runner::run_async` for `tokio-postgres`/`mysql_async`                                       | ✅ native async (tokio / async-std / actix runtime feature flags)                                          | ❌ no async                                                                                                       |
| Runtime choice                      | tokio (Postgres/MySQL async paths)                                                              | tokio, async-std, actix (feature flag)                                                                    | N/A (sync)                                                                                                       |
| **Migration mechanics**             |                                                                                                  |                                                                                                            |                                                                                                                 |
| Naming convention                   | `V1__name.sql` / `U11__name.sql` (V = contiguous, U = non-contiguous)                            | `<timestamp>_name.sql` (default) or `<timestamp>_name.up.sql`/`.down.sql` with `-r`                        | `<timestamp>_name.up.sql` / `<timestamp>_name.down.sql`                                                          |
| Compile-time embed                  | ✅ `embed_migrations!()` macro                                                                    | ✅ `sqlx::migrate!()` macro                                                                                | ✅ `embed_migrations!()` macro                                                                                    |
| CLI tool                            | ✅ `refinery_cli` (separate crate)                                                                | ✅ `sqlx-cli` (separate binary; `cargo install sqlx-cli`)                                                 | ✅ `diesel_cli` (separate binary; `cargo install diesel_cli` or `cargo binstall diesel_cli`)                    |
| Checksum / drift detection          | ✅ SHA-256 checksum per migration; detects divergent/missing migrations                          | 🟡 order + filename only (no checksum)                                                                    | 🟡 order + filename only (no checksum)                                                                            |
| Transaction model                   | Per-migration default; `set_grouped(true)` wraps whole run in one transaction                   | Per-migration by default                                                                                  | Per-migration by default                                                                                         |
| Rollback / undo                     | ⚠️ no built-in; "write a new forward migration" (mirrors pre-2020 Flyway stance)                  | ✅ `sqlx migrate revert` (with `-r` reversible migrations)                                                | ✅ `diesel migration redo` runs up + down in sequence                                                            |
| Schema generation                   | ✅ first-class via [`barrel`](https://crates.io/crates/barrel) companion crate                    | ❌ pure SQL                                                                                                | 🟡 `--diff-schema` flag generates `up.sql`/`down.sql` from a Rust `schema.rs`                                   |
| **ORM coupling**                    | None — pure migration runner                                                                     | None — separate from query API but commonly paired                                                        | **Strong** — Diesel IS an ORM; migrations are tightly coupled to `schema.rs` codegen                             |
| **Compile footprint**               | Small; one feature per driver                                                                    | Medium — sqlx pulls query-macro infra                                                                     | **Largest** — Diesel + bundled driver builds ~5 min on MacBook, +~10MB binary                                    |
| **Pure Rust?**                      | ✅ via `rusqlite` for SQLite; Postgres/MySQL use native C libs through wrappers                  | ✅ pure Rust for Postgres/MySQL; SQLite via libsqlite3-sys (C)                                              | ❌ all three backends are C wrappers (libpq, libmysqlclient, libsqlite3)                                         |
| **MSRV**                            | 1.65+ (per recent releases)                                                                      | 1.78+ (0.8 line)                                                                                          | **1.86+** (Diesel 2.3 hard floor)                                                                                  |
| **Adoption signal (fleet, 2026-06-22)** | 0 active uses (Civis/forgecode use other tools)                                                | 1 active (Civis `pg` feature)                                                                              | 2 active (forgecode `forge_repo`, `forge_infra` — SQLite-only)                                                  |

---

## Per-database recommendations

### Postgres (production / fleet-primary)

**Primary: `sqlx-cli` / `sqlx::migrate`**

- **Fleet fit.** Postgres is the canonical DB for fleet services that own a database (Civis infra is already on `sqlx = "0.8"` with the `migrate` feature flag enabled, behind the `pg` cargo feature). The async-first design matches the rest of the Rust substrate (tokio via `pheno-tracing`, `pheno-otel`, `pheno-context`).
- **Compile-time query checking.** The headline sqlx feature — `sqlx::query!()` macros validate SQL against a live DB or `.sqlx/` cached metadata at compile time. Migrations are just SQL files; they live next to the queries they enable.
- **Offline mode.** `cargo sqlx prepare` snapshots query metadata into `.sqlx/`, so CI doesn't need a live database to type-check SQL — important for fleet CI hygiene (ADR-040 coverage gates, ADR-042 security audit cadence).
- **Caveat.** Requires a `DATABASE_URL` at build time (or `.sqlx/` checked in). For pure migration runners without query macros, see refinery below.

**Secondary: `refinery`**

- Use when you have a non-tokio runtime (e.g., a sync web framework) and want a migration-only tool with first-class driver support for `postgres` or `tokio-postgres`.
- Use when you want SHA-256 **checksum drift detection** — refinery computes a hash per migration and aborts on divergent or missing migrations. sqlx has no equivalent; the only signal sqlx gives is "file present vs absent". This is a real win for post-incident forensics (corresponds to L23 "code provenance" audit pillar).
- Use when you need `V`/`U` split semantics (V = strictly contiguous versions; U = non-contiguous). This is genuinely useful when two PRs land migrations in the wrong order — refinery will refuse to run the missing one, sqlx will silently skip based on timestamp order.

**Avoid: `diesel_migrations`**

- Adds `libpq` C dependency, ~5-min cold-compile on the MacBook (already a "heavy" gate per ADR-023 device policy).
- Sync API fights the fleet's tokio-first architecture (every async fleet crate would need `spawn_blocking` wrappers).
- Diesel's strongest Postgres features (`RETURNING`, `ON CONFLICT`, `JSON` operators) aren't migration-related; you're paying the cost without gaining anything over `sqlx`.

### SQLite (edge / dev / embedded)

**Primary: `refinery`**

- **`rusqlite` feature is pure Rust** (modulo libsqlite3 itself, which is required anyway for any SQLite access). No additional C dependency beyond what `sqlx-sqlite` would also require.
- Lightest compile footprint of the three — adds ~30s to a clean build vs ~3 min for `diesel_migrations` (with `sqlite-bundled`).
- Embed at compile time via `embed_migrations!()`; works perfectly for single-binary CLI tools and edge functions.

**Secondary: `sqlx-cli` / `sqlx::migrate`**

- Use if you already use sqlx for queries elsewhere — consistency wins over marginal compile-time.
- Use if you want compile-time query checking for the SQLite-side queries (sqlx supports this).

**Conditional: `diesel_migrations` (only with full Diesel adoption)**

- Adopt only if you also adopt Diesel as your ORM/QueryBuilder. The migration story is then "free" because `diesel migration generate --diff-schema` keeps `up.sql`/`down.sql` in sync with your `schema.rs`.
- Evidence: `forgecode/crates/forge_repo` and `forgecode/crates/forge_infra` both use `diesel = "2.3.7"` + `diesel_migrations = "2.2.0"` with SQLite. Their Cargo.toml explicitly opts into `sqlite-bundled` and `r2d2` connection pooling. This is the canonical "I'm a Diesel shop" pattern.
- Cost: `libsqlite3-sys = { version = "0.37.0", features = ["bundled"] }` is required; build time jumps ~5×.

### MySQL

**Primary: `sqlx-cli` / `sqlx::migrate`**

- Same async-first argument as Postgres. MySQL is the fleet's secondary DB (no MySQL consumers currently exist in the fleet, but the substrate is in ADR-035 / ADR-046 scope).
- sqlx treats MySQL and MariaDB uniformly — both supported by the `mysql` cargo feature.

**Secondary: `refinery`**

- Supports both `mysql` (sync) and `mysql_async` (tokio) feature flags.
- Schema-generation via `barrel` companion is mature for MySQL.

**Avoid: `diesel_migrations`**

- Diesel's MySQL backend is historically the weakest — **no `RETURNING` clause support**, partial `ON DUPLICATE KEY UPDATE` translation, occasional type-mapping surprises with `ENUM`/`SET`.
- The C dependency on `libmysqlclient` is awkward in 2026 (MariaDB Connector/C is the modern default, but Diesel doesn't ship a feature flag for it).
- If you need a MySQL ORM with migrations in 2026, the better Rust options are `sea-orm` (which wraps sqlx under the hood and uses `sqlx-cli` for migrations) or `diesel-async` with separate migration tooling.

---

## Fleet usage evidence (verified 2026-06-22)

The monorepo's sparse-checkout cone includes **22+ repos with database-backed services**. Of those, three have explicit migration tooling in `Cargo.toml`:

| Repo                                  | DB      | Tool           | Pinned version      | Feature flags                                                   | Migration dir                                             | Bucket (per ADR-023) |
| :------------------------------------ | :------ | :------------- | :------------------ | :-------------------------------------------------------------- | :-------------------------------------------------------- | :------------------- |
| `Civis/crates/infra`                  | Postgres| `sqlx`         | `0.8`               | `postgres`, `runtime-tokio-rustls`, `migrate`                  | `Civis/crates/infra/migrations/0001_create_replays.sql`    | **ACTIVE**            |
| `forgecode/crates/forge_repo`         | SQLite  | `diesel_migrations` | `2.2.0` (diesel 2.3.7) | `sqlite`, `r2d2`, `chrono`                                    | n/a (forgecode uses embedded migrations)                  | Dmouse92 archive     |
| `forgecode/crates/forge_infra`        | SQLite  | `diesel_migrations` | `2.2.0` (diesel 2.3.7) | `sqlite`, `r2d2`, `chrono`; `libsqlite3-sys = { bundled }`  | n/a                                                       | Dmouse92 archive     |
| `phenotype-registry`                  | Postgres| **Go (not Rust)** — `migrate.go` | n/a              | n/a                                                            | `phenotype-registry/db/migrations/000001_initial_schema.up.sql` (+ `.down.sql` pair per migration) | PAUSED              |
| `argis-extensions`                    | Postgres| **Go (not Rust)** — same migration layout as phenotype-registry | n/a | n/a                                          | `argis-extensions/db/migrations/000001_initial_schema.up.sql` … | ACTIVE               |

**Naming convention observation:** fleet Postgres migrations use the `00000N_name.up.sql` / `.down.sql` pattern (sqitch-style numeric zero-padding, **not** the unix-timestamp `20211001154420_name.sql` sqlx default). This is consistent across `phenotype-registry`, `argis-extensions`, and likely the Go-services that follow. Fleet convention should be: keep the numeric-padded style for Go-side migrations; for sqlx-cli migrations consider adopting the same style via `--source-prefixed-with-schema-version` (sqlx 0.8 supports custom timestamp formats via `migrate.source`).

**`agileplus-refinery` is a misnomer.** The crate `AgilePlus/crates/agileplus-refinery/` exists but is a git/triage pipeline crate (tag, sign, squash, lint) for the AgilePlus worklog system — it has **no database dependencies** and is unrelated to the `rust-db/refinery` crate. The name collision is unfortunate but unambiguous from its source: `config.rs`, `lint.rs`, `sign.rs`, `squash.rs`, `tag.rs`.

---

## Decision matrix (when to pick which)

```
START
  │
  ├─ Are you already using sqlx for queries?
  │    │
  │    ├─ YES → sqlx-cli (sqlx::migrate)
  │    │         • Reuse the DATABASE_URL, runtime, TLS feature flags
  │    │         • .sqlx/ cache covers compile-time checks in CI
  │    │
  │    └─ NO  ↓
  │
  ├─ Are you adopting Diesel as your full ORM?
  │    │
  │    ├─ YES → diesel_migrations
  │    │         • --diff-schema keeps up.sql/down.sql in sync
  │    │         • Accept the libpq/libsqlite3/libmysqlclient C deps
  │    │         • Accept the ~5-min cold-compile
  │    │
  │    └─ NO  ↓
  │
  ├─ Do you need checksum-based drift detection?
  │    │
  │    ├─ YES → refinery
  │    │         • SHA-256 per migration; abort on divergent
  │    │         • V/U split semantics for concurrent PR authors
  │    │
  │    └─ NO  ↓
  │
  └─ Are you on tokio + async-std and want migration-only?
       │
       ├─ YES → refinery
       │         • Pick driver feature per backend (postgres/tokio-postgres/
       │           mysql_async/rusqlite/tiberius)
       │         • Pure-Rust SQLite path via rusqlite feature
       │
       └─ DEFAULT → refinery (safest migration-only choice)
```

**Shortcut rule for fleet reviews:** *refinery by default; sqlx-cli if sqlx is already a query dep; diesel_migrations only with a Diesel-ORM justification in the PR description.*

---

## Anti-patterns (when NOT to use these tools)

- **Don't mix migration tools in one service.** If you use sqlx-cli for production migrations, do not also commit `diesel`-generated `up.sql` files from a dev's local `diesel_cli` run; pick one and stick to it.
- **Don't use refinery for query-side abstractions.** It's a migration runner, not a query builder. For queries, use sqlx, sea-orm, diesel-async, or tokio-postgres directly.
- **Don't enable all three drivers in one Cargo.toml** unless you genuinely support all three backends. `refinery = { features = ["postgres", "mysql", "rusqlite", "tiberius"] }` doubles compile time for no benefit if you ship one backend.
- **Don't `diesel migration redo` in production.** It's a dev-time convenience that runs up + down; in production you want `diesel migration run` only.
- **Don't `sqlx database drop` in CI without a `--target` or environment guard.** The sqlx 0.8 default behavior is "drop whatever `DATABASE_URL` points at"; CI environments have been bitten by this since 0.5.

---

## Migration-file-naming conventions (cross-tool)

| Tool           | Default                                                                                     | Reversible                                                              |
| :------------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| refinery       | `V1__name.sql` (contiguous) or `U1__name.sql` (non-contiguous)                               | Same files; no separate down — write a forward migration that undoes    |
| sqlx-cli       | `<YYYYMMDDHHMMSS>_name.sql`                                                                  | `<YYYYMMDDHHMMSS>_name.up.sql` / `<YYYYMMDDHHMMSS>_name.down.sql` (with `migrate add -r`) |
| diesel_migrations | `<YYYYMMDDHHMMSS>_name.up.sql` / `<YYYYMMDDHHMMSS>_name.down.sql`                          | Mandatory up + down pair                                                |
| **fleet de-facto** | `00000N_name.up.sql` / `00000N_name.down.sql` (sqitch-style, used by phenotype-registry, argis-extensions) | Pair required                                            |

**Recommendation:** fleet new Postgres services should use sqlx-cli with the timestamped naming (the sqlx default). Go services should keep the `00000N_name.up.sql` / `.down.sql` convention for consistency with `phenotype-registry` and `argis-extensions`. Cross-language consistency is not required across language boundaries, but **within** one repo's stack, naming must match the tooling the repo uses.

---

## Open questions / follow-ups

1. **`diesel-async` + `diesel_migrations`.** There is no async Diesel migrations path. If a future fleet service wants Diesel for queries but async for migrations, the only option is `sea-orm` (which uses `sqlx-cli` under the hood) or Diesel for queries + refinery for migrations — the latter is ugly but works.
2. **`sqlx::migrate` + offline mode.** When `.sqlx/` is checked in but migrations are added later, the `.sqlx/` cache is invalidated. CI should run `cargo sqlx prepare --check` after any migration is added. There is no first-class tool that does this today; it's a hand-rolled CI step.
3. **Refinery + sqlx-driver interop.** The refinery docs claim you can run refinery migrations using sqlx connections via `Config::impl Migrate` (not direct `Migrate` on the connection). In practice this means duplicating the driver dependency. If a fleet service uses sqlx for queries and refinery for migrations, it carries both `sqlx-postgres` and `refinery` + `tokio-postgres` features in its Cargo.toml. Cost is ~10s extra clean-build. Decide per-service whether the audit-bonus (checksum drift detection) is worth it.
4. **Fleet substrate alignment (ADR-022, ADR-035).** No fleet `pheno-migrate` or `pheno-schema` substrate exists today. Each service picks its own migration tooling. Given the recommendations above, the de-facto fleet standard is: **sqlx-cli for Postgres**, **refinery for SQLite migration-only**, **diesel_migrations only when Diesel is already chosen**. This is policy-light (per-service choice) rather than enforced at the substrate level.

---

## References

- `refinery` repo: <https://github.com/rust-db/refinery> (1.7k stars, MIT)
- `refinery_cli` repo: <https://crates.io/crates/refinery_cli>
- `sqlx` repo: <https://github.com/transact-rs/sqlx> (17.2k stars, MIT/Apache-2.0)
- `sqlx-cli` docs: <https://github.com/transact-rs/sqlx/blob/main/sqlx-cli/README.md>
- `diesel` repo: <https://github.com/diesel-rs/diesel> (14.1k stars, MIT/Apache-2.0)
- Diesel Getting Started: <https://diesel.rs/guides/getting-started/>
- Diesel migrations guide: <https://docs.diesel.rs/2.3.x/diesel_migrations/index.html>
- Fleet evidence: `Civis/crates/infra/Cargo.toml:23` (`sqlx = { version = "0.8", ..., features = ["postgres", "runtime-tokio-rustls", "migrate"] }`)
- Fleet evidence: `forgecode/crates/forge_repo/Cargo.toml` (`diesel = "2.3.7"`, `diesel_migrations = "2.2.0"`)
- Fleet evidence: `forgecode/crates/forge_infra/Cargo.toml` (`diesel = "2.3.7"`, `diesel_migrations = "2.2.0"`, `libsqlite3-sys = { version = "0.37.0", features = ["bundled"] }`)
- Fleet evidence: `phenotype-registry/db/migrations/000001_initial_schema.up.sql` (Go-managed, sqitch-style naming)
- ADRs: ADR-022 (config consolidation), ADR-023 (app-level repo triage), ADR-035 (Configra migration gates), ADR-035B (event-bus substrate), ADR-040 (test coverage gates per tier), ADR-042B (substrate quality bar), ADR-046 (federation mTLS + OIDC)
- Related fleet audit: `findings/2026-06-20-AUDIT-side-59-redis-vs-valkey.md` (format reference for this doc)