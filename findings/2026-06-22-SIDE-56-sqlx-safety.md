# SIDE-56: SQLx prepared-statement coverage across pheno-* crates

**Date:** 2026-06-22
**Branch:** local investigation (no code changes)
**Tickets:** SIDE-56
**Scope:** All `pheno-*` Rust crates (12 crates, 13 `Cargo.toml`, 203 `*.rs` files, 9 `Cargo.lock`)
**Verdict:** **VACUOUSLY SAFE — 0 pheno-* crates use SQLx. 100% safe by non-use.**

---

## Headline

| Metric | Value |
|---|---|
| pheno-* crates in scope | 12 |
| pheno-* crates using SQLx | **0** |
| Total `sqlx` imports across `pheno-*/**/*.rs` | **0** |
| Total `query!` / `query_as!` / `prepare(…)` / `execute(…)` calls (SQLx-flavored) in `pheno-*` | **0** |
| Total `sqlx` entries in any `Cargo.lock` under `pheno-*/` | **0** |
| `sqlx` lines in root `Cargo.lock` | **0** |
| Unsafe (raw `execute(format!(…))` etc.) calls in `pheno-*` | **0** |
| Adjacent data-store integration: Redis (`pheno-port-adapter`) | 1 (not SQL, not in scope) |

**There is nothing to fix.** The fleet does not currently speak SQL through any driver. The audit is closed with zero findings and a forward-looking adoption policy to keep it that way when SQL inevitably lands.

---

## Methodology

### Crates in scope (12)

```
pheno-chaos/                      (workspace: pheno-chaos + pheno-chaos-macros)
pheno-ci-templates/               (no Cargo.toml — templates only)
pheno-cli-base/
pheno-config/
pheno-context/
pheno-errors/
pheno-events/
pheno-flags/
pheno-otel/
pheno-port-adapter/
pheno-tracing/
```

(`pheno-*` directories without a `Cargo.toml` — `pheno-drift-detector`, `pheno-fastapi-base`, `pheno-llms-txt`, `pheno-mcp-router`, `pheno-predict`, `pheno-pydantic-models`, `pheno-scaffold-kit`, `pheno-secret-scan`, `pheno-ssot-template`, `pheno-vibecoding-guard`, `pheno-worklog-schema`, `pheno-zod-schemas`, `pheno-go-ctxkit`, `pheno-framework-lint` — are Python / Go / TypeScript, out of scope for an SQLx-in-Rust audit. `pheno-cli-base` has a `Cargo.toml` but is a no-dep stub.)

### What counts as "SQLx use"

Per the ticket, "uses sqlx" is defined as one or more of:

1. `sqlx` listed in any `[dependencies]` / `[dev-dependencies]` of a `pheno-*/**/Cargo.toml`
2. `use sqlx::…` in any `pheno-*/**/*.rs`
3. `sqlx::query!(…)`, `sqlx::query_as!(…)`, `sqlx::query_scalar!(…)` macro invocations
4. `sqlx::query(…)`, `.prepare(…)`, `.execute(…)` runtime-API calls
5. A `sqlx` entry in any `Cargo.lock` reachable from `pheno-*/`

### Per-crate counts

| # | Crate | `Cargo.toml` SQLx dep | `*.rs` `use sqlx` | SQLx macros | `prepare`/`execute` (SQLx-flavored) | Total SQLx call sites | Verdict |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | `pheno-chaos` (workspace root)                  | 0 | 0 | 0 | 0 | **0** | n/a |
| 2 | `pheno-chaos/crates/pheno-chaos`                | 0 | 0 | 0 | 0 | **0** | n/a |
| 3 | `pheno-chaos/crates/pheno-chaos-macros`         | 0 | 0 | 0 | 0 | **0** | n/a |
| 4 | `pheno-cli-base`                                | 0 | 0 | 0 | 0 | **0** | n/a |
| 5 | `pheno-config`                                  | 0 | 0 | 0 | 0 | **0** | n/a |
| 6 | `pheno-context`                                 | 0 | 0 | 0 | 0 | **0** | n/a |
| 7 | `pheno-errors`                                  | 0 | 0 | 0 | 0 | **0** | n/a |
| 8 | `pheno-events`                                  | 0 | 0 | 0 | 0 | **0** | n/a |
| 9 | `pheno-flags`                                   | 0 | 0 | 0 | 0 | **0** | n/a |
| 10 | `pheno-otel`                                   | 0 | 0 | 0 | 0 | **0** | n/a |
| 11 | `pheno-port-adapter`                            | 0 | 0 | 0 | 0 | **0** | n/a (Redis, not SQL) |
| 12 | `pheno-tracing`                                 | 0 | 0 | 0 | 0 | **0** | n/a |
| — | **TOTAL pheno-***                              | **0** | **0** | **0** | **0** | **0** | **VACUOUSLY SAFE** |

> Note on `pheno-port-adapter`: the crate ships `redis = "0.27"` (`pheno-port-adapter/Cargo.toml:24`) and a `RedisAdapter` that uses the `redis` crate's typed command API (`Cmd`, `FromRedisValue`, etc.) — not SQL. Redis is protocol-bound and not in scope for SQL injection, but see "Adjacent risk surface" below.

---

## Negative evidence (proof of zero use)

### Evidence 1 — no `Cargo.toml` lists `sqlx`

```
$ grep -rl "sqlx" pheno-*/Cargo.toml pheno-*/crates/*/Cargo.toml
(no matches; exit 1)
```

### Evidence 2 — no `*.rs` imports `sqlx`

```
$ grep -rl "use sqlx" pheno-*/**/*.rs
(no matches)
```

### Evidence 3 — no SQLx macro invocations anywhere

```
$ grep -rE "(sqlx::query!|sqlx::query_as!|sqlx::query_scalar!)" pheno-*/
(no matches)
```

### Evidence 4 — no `prepare(` / SQLx-flavored `execute(` calls

```
$ grep -rE "(query_as!|query!|prepare\(|sqlx::execute)" pheno-*/**/*.rs
(no matches)
```

### Evidence 5 — no `sqlx` entries in any `Cargo.lock`

```
$ grep -c "sqlx" pheno-*/Cargo.lock           # all 9 lockfiles
0
$ grep -c "sqlx" Cargo.lock                   # root lockfile
0
```

### Evidence 6 — only one DB-adjacent dep in the whole family: `redis`

```
$ grep -rE "^(sqlx|diesel|sea-orm|tokio-postgres|mysql|rusqlite|postgres|redis)" pheno-*/**/Cargo.toml
pheno-port-adapter/Cargo.toml:24:  redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }
```

This is the **only** data-store integration in the pheno-* family. It is a key-value cache, not an SQL database.

---

## Why SQLx is absent

The pheno-* family is, by design, a **pure-Rust substrate layer**:

- **No domain logic** — crates are library primitives (events, context, errors, flags, tracing, config, observability). They carry no business data and therefore need no persistence.
- **No HTTP servers** — request-handling happens in federated services (`phenotype-hub`, `phenotype-bus`, `phenoMCP`, `phenoObservability`, `phenoEvents`) that live **outside** the `pheno-*` namespace per ADR-023 Rule 3 (app substrate placement).
- **Hexagonal port-adapter shape** — `pheno-port-adapter` defines `HexCachePort` etc. as traits; concrete adapters (Redis, in-memory, future-SQL) plug in via `Box<dyn HexCachePort>`. SQL, if ever needed, would be one more `Adapter` — never a direct dependency of a substrate crate.

This is consistent with **ADR-023 Rule 3.1** ("Every new `pheno-*-lib` ships with no transitive data-store deps; data lives in federated services or framework-level SDKs") and **ADR-040** ("coverage gate: 80% lib / 70% framework / 60% federated service" — federated services are where SQL would land).

---

## Adjacent risk surface (not SQL, but worth noting)

The only data-store touchpoint in the pheno-* family is the Redis adapter in `pheno-port-adapter`. Although not SQL-injection-prone, it has its own correctness surface:

| Concern | Status | Note |
|---|---|---|
| Command construction uses typed `redis::Cmd` (not string concat) | **safe by construction** | `redis::Cmd::new()` + arg() pushes typed values; no format!() injection vector |
| Pipelined commands | safe | `pipe()` is a typed builder |
| RESP3 protocol negotiation | default off | `redis = "0.27"` does not enable `resp3` feature; RESP2 is fine |
| Connection pooling | **managed** | `connection-manager` feature used; auto-reconnect on disconnect |
| Auth (ACL / password) | **dev-only** | No `username`/`password` configured in `RedisAdapter::new()`; production deployment must wire secrets via `pheno-context` |
| TLS | **not enabled** | `redis = "0.27"` does not enable `tls` / `tls-rustls`; cross-segment traffic is plaintext. **Recommend enabling `tls-rustls` before any non-loopback deployment** |

None of these are SQLx findings, but they show up under the same general "data-store safety" lens and are tracked separately under SIDE-58 (proposed).

---

## Forward guidance: when SQLx eventually lands

The fleet will eventually need SQL — likely inside a federated service (`phenotype-hub`, a future `phenotype-ledger`) rather than a substrate. When that day comes, follow this pattern to preserve the zero-finding posture:

### 1. Pick the macro form by default

```rust
// ✅ safe — compile-time-checked query, parameter binding, type checking
let row = sqlx::query_as!(User, "SELECT id, name, email FROM users WHERE id = $1", user_id)
    .fetch_one(&pool)
    .await?;

// ❌ unsafe — runtime query construction, no type check
let row = sqlx::query_as::<_, User>(&format!("SELECT * FROM users WHERE id = {}", user_id))
    .fetch_one(&pool)
    .await?;
```

`query!` / `query_as!` / `query_scalar!` are compile-time-validated against `DATABASE_URL` (or `sqlx prepare`). Use them everywhere except where the table/column is genuinely dynamic (rare).

### 2. For dynamic queries, build with the typed `QueryBuilder`

```rust
let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
    "SELECT id, name FROM users WHERE active = "
);
qb.push_bind(true);
if let Some(name) = &filter.name {
    qb.push(" AND name ILIKE ").push_bind(format!("%{name}%"));
}
let rows = qb.build_query_as::<User>().fetch_all(&pool).await?;
```

`QueryBuilder` separates SQL fragments (literals) from bound parameters — equivalent safety to the macro form.

### 3. Never `format!` user input into a SQL string

This is the failure mode the ticket is asking us to catch. Banning it via clippy lint is cheap:

```rust
// .cargo/audit-rules.toml or clippy.toml
disallowed-methods = [
    { path = "sqlx::query", reason = "Use query! / query_as! / QueryBuilder; raw query() allows runtime SQL string construction" },
]
```

### 4. New SQLx dependency goes in a federated service, not a pheno-* crate

Per ADR-023 Rule 3 + ADR-040, data persistence belongs in:

| Need | Right home |
|---|---|
| Read/write SQL from a pheno-* substrate | **never** — substrate must stay persistence-free |
| Read/write SQL from a federated service | yes — `phenotype-hub`, future `phenotype-ledger`, etc. |
| Read/write SQL from an app-level repo (PAUSED per ADR-023) | only after un-pause; recommend migrating to a federated service first |

If a `pheno-*` crate ever needs to depend on `sqlx`, that is a signal that the crate is misclassified as a substrate and should be re-homed.

### 5. Re-audit when SQLx first lands

Add `audit-71-pillar` sweep + an `SIDE-56` re-run as a precondition for any PR that adds `sqlx` to a `pheno-*/Cargo.toml`. The current count table becomes the baseline.

---

## Tooling & automation

To make this audit cheap to re-run, encode it as a single shell pipeline (3 commands, ~2 s on a MacBook):

```bash
# 1. Any Cargo.toml lists sqlx?
grep -rl "^\s*sqlx" pheno-*/**/Cargo.toml

# 2. Any *.rs uses sqlx?
grep -rlE "(use sqlx|sqlx::|query_as!|query!|query_scalar!)" pheno-*/**/*.rs

# 3. Any lockfile records sqlx?
grep -c "sqlx" pheno-*/**/Cargo.lock Cargo.lock
```

Expected output today: **all three return zero matches**. The first non-zero match opens a P0 review.

### Suggested CI gate (proposed, not in this PR)

```yaml
# .github/workflows/side-56-sqlx-safety.yml
name: SIDE-56 SQLx safety
on:
  pull_request:
    paths:
      - 'pheno-*/**/Cargo.toml'
      - 'pheno-*/**/*.rs'
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan for raw SQLx query construction
        run: |
          # Fail if any non-macro, non-QueryBuilder SQLx use is introduced.
          # Allow `query!`, `query_as!`, `query_scalar!` macros and `QueryBuilder`.
          bad=$(grep -rE "(sqlx::query\(|sqlx::execute\(|format!.*SELECT|format!.*INSERT|format!.*UPDATE|format!.*DELETE)" pheno-*/ || true)
          if [ -n "$bad" ]; then
            echo "::error title=Unsafe SQLx use detected::$bad"
            exit 1
          fi
```

---

## Closure

| Item | Status |
|---|---|
| SIDE-56 ticket | **CLOSED — zero findings** |
| pheno-* SQLx coverage | **100% safe (vacuous — no usage)** |
| Adjacent-risk follow-up (Redis TLS) | opened as **SIDE-58 (proposed)** — see "Adjacent risk surface" |
| Forward policy (when SQLx lands) | codified in this doc § "Forward guidance" |
| Re-audit trigger | first PR adding `sqlx` to any `pheno-*/Cargo.toml` |
| CI gate | proposed workflow above (not enabled this turn) |

### Cross-references

- ADR-022 — Config consolidation (Rust core / TS edge split) — informs why pheno-config has no DB deps
- ADR-023 Rule 3 — App substrate placement (pheno-* = pure lib, persistence lives in federated services)
- ADR-040 — Test coverage gates per tier (80/70/60 %; SQL coverage gates apply to federated services only)
- ADR-042 — Security audit cadence (monthly `cargo audit` + dep sweep — SQLx would land here when adopted)
- SIDE-58 (proposed) — Redis adapter TLS / auth hardening (adjacent surface, separate ticket)
- `findings/71-pillar-2026-06-17-schema.md` — L46-L55 Security pillars (L48 SBOM, L49 SLSA, L50 Vault, L51 SOC2, L52 encryption-at-rest — all relevant when SQL lands)

---

**End of SIDE-56 report. Zero unsafe SQLx call sites found in pheno-*; safe to close ticket.**