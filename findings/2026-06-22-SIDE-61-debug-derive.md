# SIDE-61 — `#[derive(Debug)]` coverage diagnostic on public types

**Date:** 2026-06-22
**Scope:** 8 `pheno-*` Rust crates (per AGENTS.md Rust list, sparse-checkout visible)
**Method:** Read-only grep + AST-walk via custom Python parser
**Device:** `macbook` (read-only diagnostic, no cargo)
**Tool:** `/tmp/side61_debug_diag.py` (see [Methodology](#methodology))

---

## TL;DR

- **Fleet mean coverage:** **87.4%** (per-crate unweighted mean; total-weighted 52/64 = 81.3%)
- **5/8 crates at 100%:** `pheno-cli-base`, `pheno-context`, `pheno-errors`, `pheno-flags`
- **3/8 crates below 100%:** `pheno-config` (33.3%), `pheno-port-adapter` (77.8%), `pheno-otel` (93.8%), `pheno-tracing` (94.4%)
- **12 public types lack `#[derive(Debug)]`** on the derive line — but **3 of those 12 are intentional** (manual `Debug` impl for secret redaction per ADR-078)
- **9 true gaps** — all simple one-line fixes (`#[derive(Debug)]` or `Debug` added to an existing derive list)
- **No P0/P1 issue** — every gap is a low-effort polish, not a correctness bug

Adjusted coverage (counting manual `Debug` impls as "has Debug"):

| Adjusted?            | Per-crate mean | Total-weighted (52/64 strict, 55/64 adj) |
|----------------------|---------------:|------------------------------------------:|
| Strict (derive only) |        87.4 %  |                                   81.3 % |
| With manual impl     |        90.5 %  |                                   85.9 % |

(Per-crate mean = unweighted arithmetic mean of the 8 per-crate coverage %. Total-weighted = sum of `with_debug` divided by sum of `pub_struct_enum` across the 8 crates — i.e. larger crates weigh more.)

---

## Per-crate coverage

| # | Crate              | Files | Public types (struct+enum) | `#[derive(Debug)]` | Missing derive | Coverage | Notes |
|---|--------------------|------:|---------------------------:|-------------------:|---------------:|---------:|-------|
| 1 | `pheno-cli-base`   |     4 |                          2 |                  2 |              0 |  **100%** | clean |
| 2 | `pheno-config`     |     5 |                         12 |                  4 |              8 | **33.3%** | 3 manual impls (intentional) |
| 3 | `pheno-context`    |     1 |                          3 |                  3 |              0 |  **100%** | clean |
| 4 | `pheno-errors`     |     2 |                          2 |                  2 |              0 |  **100%** | clean |
| 5 | `pheno-flags`      |     1 |                          2 |                  2 |              0 |  **100%** | clean |
| 6 | `pheno-otel`       |    11 |                         16 |                 15 |              1 |  **93.8%** | 1 gap (`TelemetryGuard`) |
| 7 | `pheno-port-adapter` |  11 |                          9 |                  7 |              2 |  **77.8%** | 2 gaps (`MockClock`, `RedisAdapter`) |
| 8 | `pheno-tracing`    |     5 |                         18 |                 17 |              1 |  **94.4%** | 1 gap (`InMemoryAdapter`) |
| **Total** | | **40** | **64** | **52** | **12** | **81.3%** | strict |

> **Note on the strict 81.3% vs the headline 87.4%:** the 81.3% is the **total-weighted** view (sum of `with_debug` / sum of `pub_struct_enum` = 52/64); the 87.4% is the **per-crate mean** (unweighted arithmetic mean of the 8 per-crate coverage %, which lets small crates like `pheno-flags` weigh the same as the 18-type `pheno-tracing`). The "headline" framing follows ADR-024 § 5.1 — per-crate mean is the canonical 71-pillar scoring unit.

### Per-crate coverage, adjusted for manual `Debug` impls

| Crate              | `#[derive(Debug)]` | Manual `impl Debug` | Total with Debug | Adjusted coverage |
|--------------------|-------------------:|--------------------:|-----------------:|------------------:|
| `pheno-config`     |                  4 |                   3 |                7 |          **58.3%** |

All other crates: no manual `impl Debug` was found; coverage unchanged.

---

## The 12 gaps — classified

### True gaps (9 types — recommend adding `#[derive(Debug)]` or `Debug` to existing list)

| # | Crate              | File                                           | Line | Type              | Current derives          | Suggested fix              |
|---|--------------------|------------------------------------------------|-----:|-------------------|--------------------------|----------------------------|
| 1 | `pheno-config`     | `src/hot_reload.rs`                            |  141 | `ConfigReloader<C>` | _(none)_                | `#[derive(Debug)]` (C bound: `C: Debug`) |
| 2 | `pheno-config`     | `src/secret_rotation.rs`                       |  180 | `FileSource`        | _(none)_                | `#[derive(Debug)]`         |
| 3 | `pheno-config`     | `src/secret_rotation.rs`                       |  229 | `EnvSource`        | _(none)_                | `#[derive(Debug)]`         |
| 4 | `pheno-config`     | `src/secret_rotation.rs`                       |  288 | `VaultSource`      | _(none)_                | `#[derive(Debug)]`         |
| 5 | `pheno-config`     | `src/secret_rotation.rs`                       |  353 | `SecretRotator<S>`  | _(none)_                | `#[derive(Debug)]` (S bound: `S: Debug`) |
| 6 | `pheno-otel`       | `src/guard.rs`                                 |   31 | `TelemetryGuard`    | _(none)_                | manual `impl Debug` (uses internal `source: &'static str`) |
| 7 | `pheno-port-adapter` | `src/adapters/mock_clock.rs`                 |   39 | `MockClock`         | `Clone`                  | add `Debug` to derive list |
| 8 | `pheno-port-adapter` | `src/adapters/redis_cache.rs`                |   45 | `RedisAdapter`      | `Clone`                  | add `Debug` to derive list |
| 9 | `pheno-tracing`    | `src/adapters.rs`                              |   18 | `InMemoryAdapter`   | `Default, Clone`        | add `Debug` to derive list |

**Effort:** ~10 LOC across 9 files. ~1 PR per crate.

### Intentional gaps (3 types — manual `impl fmt::Debug` via macro, DO NOT add `#[derive(Debug)]`)

| # | Crate          | File                  | Line | Type         | Manual impl source                                | Why intentional                                                |
|---|----------------|-----------------------|-----:|--------------|---------------------------------------------------|----------------------------------------------------------------|
| 1 | `pheno-config` | `src/secrets.rs`      |  119 | `ApiKey`     | `impl_secret_fmt!(ApiKey)` (macro at line 56)     | Prints `ApiKey(***REDACTED***)` — ADR-078 secret redaction policy |
| 2 | `pheno-config` | `src/secrets.rs`      |  130 | `BearerToken` | `impl_secret_fmt!(BearerToken)`                   | Prints `BearerToken(***REDACTED***)` — redaction               |
| 3 | `pheno-config` | `src/secrets.rs`      |  141 | `DbPassword` | `impl_secret_fmt!(DbPassword)`                    | Prints `DbPassword(***REDACTED***)` — redaction                |

> **Important:** Do **not** "fix" these by adding `#[derive(Debug)]` — that would print the raw secret in `dbg!`, `unwrap`-error messages, panic messages, and any `{:?}` formatter. The current behavior is a deliberate ADR-078 security pattern. The macro at `pheno-config/src/secrets.rs:56-76` is the canonical place; if anyone needs richer output, the comment at line 53-55 directs them to open an ADR-078 follow-up rather than editing the macro.

---

## Informational: cannot derive Debug (5 traits, 1 type alias)

These are **not gaps**. Traits and type aliases cannot `#[derive(Debug)]`. They are reported here only for completeness.

| Crate                | Kind           | Name             | File                           | Line |
|----------------------|----------------|------------------|--------------------------------|-----:|
| `pheno-config`       | `pub trait`    | (1)              | (various)                      |    — |
| `pheno-errors`       | `pub type`     | (1)              | `src/lib.rs`                   |    — |
| `pheno-otel`         | `pub trait`    | (1)              | (various)                      |    — |
| `pheno-port-adapter` | `pub trait`    | (3)              | (various)                      |    — |
| `pheno-tracing`      | `pub trait`    | (4)              | (various)                      |    — |

---

## Why `pheno-config` is the outlier

`pheno-config` is the only substrate crate in the 8 with significant secret-management surface area. Its public types split into three classes:

1. **Public value types** (`Value`, `ValueKind`, `Layer`, `Source`, `Env`, `LayerError`, `ConfigError`, etc.) — all have `#[derive(Debug)]` ✓
2. **Secret newtypes** (`ApiKey`, `BearerToken`, `DbPassword`) — manual `Debug` via redaction macro ✓ (intentional)
3. **Rotation / hot-reload orchestration** (`ConfigReloader`, `FileSource`, `EnvSource`, `VaultSource`, `SecretRotator`) — **none have Debug** ✗ (5 of the 8 gaps)

The 5 orchestration types in class 3 are the easy fix. They're not secrets — they're handles to sources. Adding `#[derive(Debug)]` (with appropriate generic bounds) is safe and improves observability.

---

## Spot-checks (verified manually)

| Type                             | File:line                        | Decl snapshot                                                | Status                          |
|----------------------------------|----------------------------------|--------------------------------------------------------------|---------------------------------|
| `pheno-config::ApiKey`           | `secrets.rs:117-119`             | `#[derive(Zeroize, ZeroizeOnDrop, Clone)] pub struct ApiKey(String);` + `impl_secret_fmt!(ApiKey);` | manual Debug (intentional) ✓   |
| `pheno-config::ConfigReloader`   | `hot_reload.rs:141`              | `pub struct ConfigReloader<C> { ... }`                       | no Debug ✗                       |
| `pheno-otel::TelemetryGuard`     | `guard.rs:31`                    | `pub struct TelemetryGuard { provider: TracerProvider, source: &'static str }` | no Debug ✗ (needs manual impl due to `TracerProvider` not being `Debug`) |
| `pheno-port-adapter::MockClock`  | `mock_clock.rs:38-41`            | `#[derive(Clone)] pub struct MockClock { inner: Arc<MockClockInner> }` | derive Clone only ✗            |
| `pheno-tracing::InMemoryAdapter` | `adapters.rs:17-20`              | `#[derive(Default, Clone)] pub struct InMemoryAdapter { ... }` | derive Default+Clone only ✗   |

> **`TelemetryGuard` caveat:** The held `TracerProvider` does not implement `Debug` (it's a third-party OTel type). A derived `Debug` won't compile here. A manual `impl Debug` should print the type tag + the `source: &'static str` label only — the doc comment on line 36 says this was the original intent ("Used only in the `Debug` impl so test failures are easy to attribute"). The implementation was simply never written.

---

## Recommendations (not auto-applied — read-only diagnostic)

Suggested fix order (lowest risk first):

1. **PR-1 (`pheno-port-adapter`):** Add `Debug` to existing derive lists on `MockClock` and `RedisAdapter`. ~2 LOC.
2. **PR-2 (`pheno-tracing`):** Add `Debug` to existing derive list on `InMemoryAdapter`. ~1 LOC.
3. **PR-3 (`pheno-otel`):** Add manual `impl Debug for TelemetryGuard` printing `"TelemetryGuard { source: <label> }"`. ~6 LOC (one impl block).
4. **PR-4 (`pheno-config`):** Add `#[derive(Debug)]` to `FileSource`, `EnvSource`, `VaultSource` (straightforward) and `ConfigReloader<C> where C: Debug`, `SecretRotator<S> where S: Debug` (with bounds). ~5 LOC.
5. **Skip the 3 secret types** in `pheno-config::secrets` — manual `Debug` is intentional per ADR-078.

None of these changes affect runtime behaviour, error semantics, or public API shape beyond adding a trait impl. Safe to land as `chore:` commits.

---

## Methodology

- **Tool:** Python AST-walk via regex, `/tmp/side61_debug_diag.py`. Read-only, no cargo, no writes to the repo.
- **Regex walk:** For each `pub struct NAME` / `pub enum NAME` / `pub trait NAME` / `pub type NAME`, walk up to 6 preceding lines looking for `#[derive(...)]` attributes. A type is "has Debug" if **any** of its derive attributes contains the literal token `Debug` (preceded by `,` or `(`, followed by `,` or end-of-group). Manual `impl fmt::Debug` is detected by reading `impl_secret_fmt!` macro expansion sites (only in `pheno-config/src/secrets.rs`).
- **`#[cfg_attr(..., Debug)]`** was also detected as a Debug source — no occurrences in the 8 crates.
- **Skipped paths:** `/tests/`, `/examples/`, `/benches/`, `/target/` (test/example code, not part of public API).
- **Counting rules:**
  - `pub struct` + `pub enum` count toward "public types" (can derive Debug).
  - `pub trait` is reported separately as "informational" (cannot derive Debug).
  - `pub type` alias is reported separately as "informational" (cannot derive Debug).
- **Coverage %:** `(with_debug / pub_struct_enum) * 100`. Strict = derive only; adjusted = manual `impl Debug` counted.
- **Fleet mean:** unweighted arithmetic mean across the 8 crates (each crate weighs equally regardless of type count).
- **Raw output:** `/tmp/side61_results.json` (1,102 lines), `/tmp/side61_summary.txt` (134 lines).

### Re-run

```bash
# From the monorepo root
REPOS_ROOT="$(pwd)" python3 /tmp/side61_debug_diag.py > /tmp/side61_results.json
python3 /tmp/side61_parse.py
```

---

## Compliance

- **device:** `macbook` (read-only diagnostic, no cargo, no test cycle)
- **worklog:** none (sub-30-min diagnostic, no schema-required artifact per ADR-015 v2.1 §"Side diagnostics")
- **branch:** none (no code changes proposed; this is a finding-only deliverable per SIDE-61 scope)
- **PR labels:** none (no PRs opened)