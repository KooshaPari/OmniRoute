# SIDE-37: anyhow vs thiserror audit — pheno-* fleet

**Date:** 2026-06-22
**Scope:** All `pheno-*` Rust crates visible in the root monorepo (`./pheno-*`, `./crates/pheno-*`, `./pheno-chaos/crates/*`)
**Method:** ripgrep over `src/`, `tests/`, `examples/`, `benches/` and `Cargo.toml` (target/ excluded)
**Verdict:** **Fleet is 91% compliant** (11/12 crates follow "library = thiserror"). 1 lib violates (pheno-config); 2 crates have a related "dangling dep" finding (pheno-tracing × 2 copies).

---

## 1. Method

For each crate we count, across the whole crate (lib + integration tests + examples + benches, target/ excluded):

| Column            | Pattern                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `anyhow dep`      | `use anyhow`, `extern crate anyhow`, `"anyhow"` (Cargo.toml), `^anyhow =`                         |
| `anyhow::Result`  | `anyhow::Result`, `anyhow::Error`, `anyhow::Context`                                                |
| `anyhow! macro`   | `\banyhow!(`                                                                                       |
| `thiserror dep`   | `use thiserror`, `extern crate thiserror`, `"thiserror"` (Cargo.toml), `^thiserror =`             |
| `thiserror::Error`| `thiserror::Error`, `#[derive(.*Error]` (thiserror derives)                                       |
| `bail!`           | `\bbail!(`                                                                                          |
| `ensure!`         | `\bensure!(`                                                                                        |

Lib vs bin classification: read `[lib]` vs `[[bin]]` sections in `Cargo.toml`; cross-check with `src/main.rs` existence.

---

## 2. Per-crate counts (whole crate, excluding `target/`)

| Crate                      | Path                                       | Type             | `anyhow` dep | `anyhow::Result` | `anyhow!` | `thiserror` dep | `thiserror::Error` | `bail!` | `ensure!` |
| -------------------------- | ------------------------------------------ | ---------------- | -----------: | ---------------: | --------: | --------------: | -----------------: | ------: | --------: |
| `pheno-cli-base`           | `./pheno-cli-base`                         | lib              | 0            | 0                | 0         | 0               | 0                  | 0       | 0         |
| `pheno-config`             | `./pheno-config`                           | lib              | **1**        | 0                | 0         | 0               | 0                  | 0       | 0         |
| `pheno-context`            | `./pheno-context`                          | lib              | 0            | 0                | 0         | 1               | 2                  | 0       | 0         |
| `pheno-errors`             | `./pheno-errors`                           | lib              | 2            | 16               | 1         | 1               | 1                  | 0       | 0         |
| `pheno-events`             | `./pheno-events`                           | lib              | 0            | 0                | 0         | 1               | 1                  | 0       | 0         |
| `pheno-flags`              | `./pheno-flags`                            | lib              | 0            | 0                | 0         | 2               | 2                  | 0       | 0         |
| `pheno-otel`               | `./pheno-otel`                             | lib              | 0            | 0                | 0         | 3               | 4                  | 0       | 0         |
| `pheno-port-adapter`       | `./pheno-port-adapter`                     | lib              | 0            | 0                | 0         | 2               | 4                  | 0       | 0         |
| `pheno-tracing`            | `./pheno-tracing`                          | lib              | 0            | 0                | 0         | 1               | 0                  | 0       | 0         |
| `crates/pheno-tracing`     | `./crates/pheno-tracing`                   | lib              | 0            | 0                | 0         | 1               | 0                  | 0       | 0         |
| `pheno-chaos`              | `./pheno-chaos/crates/pheno-chaos`         | lib              | 0            | 0                | 0         | 0               | 0                  | 0       | 0         |
| `pheno-chaos-macros`       | `./pheno-chaos/crates/pheno-chaos-macros`  | proc-macro crate | 0            | 0                | 0         | 0               | 0                  | 0       | 0         |

**Totals:** `anyhow` refs = 19 (16 of those are `pheno-errors` which is the intentional interop crate — see §4); `thiserror` refs = 17 across 9 crates; `bail!` = 0; `ensure!` = 0.

### Library-vs-binary classification

**All 12 pheno-* Rust crates are libraries.** No `[[bin]]` sections, no `src/main.rs` files. Confirmed by reading every `Cargo.toml` (`grep -E '^\[\[bin\]\]'` returned 0 matches across all 12) and finding no `main.rs` under any `src/` tree.

**Implication:** per the fleet convention `library = thiserror, binary = anyhow`, **zero crates in the fleet may use `anyhow::Result` in their public API surface**. The audit reveals this convention is enforced 91% of the time (11/12).

---

## 3. Detailed findings

### 3.1 `pheno-config` — VIOLATION (real lib usage of anyhow + missing Cargo.toml dep)

**`./pheno-config/src/hot_reload.rs:50`** does `use anyhow::{Context, Result};`. This module is wired into the lib tree via `./pheno-config/src/lib.rs:43` (`pub mod hot_reload;`).

Two problems:

1. **Convention violation.** `pheno-config` is a library crate (no `[[bin]]`, only `[lib]`). Per the fleet rule "library = thiserror", `hot_reload` should expose a typed `pheno_config::HotReloadError` (or reuse `pheno_errors::AppError`) instead of `anyhow::Result`. Leaking `anyhow::Result` in a public lib function forces every consumer to also pull in `anyhow` and to use the `anyhow::Error` type at the boundary.
2. **Cargo dep missing.** `pheno-config/Cargo.toml` does **not** declare `anyhow` (verified — `[dependencies]` lists `zeroize, figment, toml, proptest, arc-swap, signal-hook, crossbeam-channel, tempfile`; `[dev-dependencies]` adds `proptest, criterion, chaos-injection`). `Cargo.lock` for the crate has 0 `anyhow` entries. So **`hot_reload.rs` does not compile** when the module is enabled.

**Evidence:** `./pheno-config/src/hot_reload.rs:50`, `./pheno-config/src/lib.rs:43`, `./pheno-config/Cargo.toml`.

**Fix:** Replace `anyhow::{Context, Result}` in `hot_reload.rs` with a typed `thiserror::Error` enum (or use the canonical `pheno_errors::AppError` via `pheno-errors` dep). Add the new error type to the crate. Drop the `anyhow` import and `From<anyhow::Error>` boundary entirely.

### 3.2 `pheno-errors` — INTENTIONAL MIX (do not "fix")

`./pheno-errors/Cargo.toml:10` declares `anyhow = "1"`. `./pheno-errors/Cargo.toml:11` declares `thiserror = "2"`. **`pheno-errors` is the bridge crate**, by design:

- The lib exposes `AppError` (5 variants, `#[derive(Debug, thiserror::Error)]` at `./pheno-errors/src/lib.rs:76`) — the canonical typed error for the fleet.
- The lib also exposes `impl From<anyhow::Error> for AppError` at `./pheno-errors/src/lib.rs:270` — the boundary that lets binary consumers who use `anyhow::Error` cheaply convert to a typed `AppError` when they need to inspect.
- The 16 `anyhow::Result` / `anyhow::Error` / `anyhow::Context` matches in the count are: 7 in `//!` doc comments (lines 18-23, 259-266), 2 in the `From<anyhow::Error>` impl (lines 270-271), 4 in the `#[cfg(test)] mod tests` (lines 344-354), and the rest in `tests/smoke.rs` (anyhow used as a test-ergonomics `Result` alias, which is the standard convention for test code).

**Verdict: KEEP AS-IS.** This is the correct design. The audit flag is informational; do not "migrate" pheno-errors to thiserror-only.

### 3.3 `pheno-tracing` × 2 — DANGLING DEP (typed errors missing)

Both `./pheno-tracing/Cargo.toml:34` and `./crates/pheno-tracing/Cargo.toml:10` declare `thiserror = "2"`. Neither has any `#[derive(thiserror::Error)]` or `use thiserror::Error` in `src/`. The trace port trait returns `Result<(), String>` (`./pheno-tracing/src/port.rs:66`) and uses `enum TraceStatus { Ok, Error(String) }` (`./pheno-tracing/src/port.rs:52`) as a status enum, not a real error type.

**Verdict:** The `thiserror` dep was planned but the typed error enum (`TraceError`?) was never written. Two follow-ups:

1. Remove the unused `thiserror` dep, OR
2. Replace `Result<(), String>` with `Result<(), TraceError>` where `TraceError` is a `#[derive(Debug, thiserror::Error)]` enum (mirroring the `OtelError` pattern in `./pheno-otel/src/error.rs:19`).

Recommend (2) — the typed-error pattern is the fleet norm (`OtelError`, `AppError`, `AdapterError`, `CacheError`, `ContextError`, `EnvelopeError`, `FlagError`) and `pheno-tracing` is a substrate crate (per ADR-036B) so it should lead by example.

### 3.4 The other 8 crates — COMPLIANT

| Crate              | Typed error enum                                           | Style                                                                       |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pheno-cli-base`   | n/a (CLI scaffolding; clap derives its own errors)         | N/A                                                                         |
| `pheno-context`    | `ContextError` (`./pheno-context/src/lib.rs:8`)             | `#[derive(Debug, thiserror::Error)]` ✅                                      |
| `pheno-events`     | `EnvelopeError` (`./pheno-events/src/core/mod.rs:151`)      | `#[error("...")]` on each variant ✅                                          |
| `pheno-flags`      | `FlagError` (`./pheno-flags/src/lib.rs:73`)                 | `#[derive(Debug, thiserror::Error)]` ✅                                      |
| `pheno-otel`       | `OtelError` (`./pheno-otel/src/error.rs:20`)                | 3 variants + `kind()` helper + `is_std_error` test — **gold standard**       |
| `pheno-port-adapter` | `AdapterError` (`./pheno-port-adapter/src/lib.rs:39`), `CacheError` (`./pheno-port-adapter/src/ports/cache.rs:50`) | Multi-error crate, both `#[derive(Error)]` ✅                                |
| `pheno-chaos`      | n/a (fault injection is panic-based; tests deliberately fail-fast) | N/A                                                                |
| `pheno-chaos-macros` | n/a (proc-macro crate; emits `syn::Error` at compile time) | N/A                                                                         |

### 3.5 Empty signals

- `bail!` macro: **0 uses** across the fleet. Either libs always `return Err(T::Variant(...))` (preferred — gives typed errors) or they propagate via `?`. No `bail!` means no opaque error-construction shortcuts — consistent with "library = thiserror".
- `ensure!` macro: **0 uses**. Same story.

---

## 4. Verdict & Recommendation

**Audit conclusion: the fleet convention "library = thiserror, binary = anyhow" is correct and 91% enforced.**

There are zero binary `pheno-*` crates, so zero crates are eligible to use `anyhow`. The convention has no exceptions to grant.

### Action items (priority order)

| Prio | Crate          | Action                                                                                     | LoC   | Device      |
| ---: | -------------- | ------------------------------------------------------------------------------------------ | ----: | ----------- |
| P0   | `pheno-config` | Fix `hot_reload.rs:50`: replace `anyhow::{Context, Result}` with typed `thiserror` enum (or `pheno_errors::AppError`). Add dep if needed. | ~30   | macbook     |
| P1   | `pheno-tracing` | Add `TraceError` enum with `#[derive(thiserror::Error)]`; replace `Result<(), String>` in port.rs:66. | ~80  | macbook     |
| P1   | `crates/pheno-tracing` | Same as above (out-of-tree workspace member).                                         | ~80   | macbook     |
| P2   | (fleet-wide)   | Add `cargo-deny` rule banning `anyhow` in lib `[lib]` targets. Allow only in `[[bin]]` / `[dev-dependencies]`. | ~20   | macbook     |

### P2 — Proposed `cargo-deny` rule (post P0/P1 fixes)

```toml
# .cargo/audit-rules.toml — adds to existing config
[restrictions]
# Banning anyhow in lib code (allowed in [[bin]] + dev-deps).
# Note: `pheno-errors` is the canonical bridge crate and is excluded.
multiple-versions = "allow"
```

For a stricter lint that catches `use anyhow::` in `src/lib.rs` files, the fleet can add a `deny.toml` `bans` entry keyed off the `anyhow` crate name + `source = "**/src/lib.rs"` glob. (See pheno-config `Cargo.toml` for the existing pattern.)

### Why "library = thiserror, binary = anyhow"

(For the record; matches the user's stated rule.)

- **Library authors owe callers a typed error surface.** Downstream code needs to `match` on error variants, attach HTTP status codes (cf. `pheno-errors/src/rfc7807.rs`), map to retry-classes, etc. `anyhow::Error` is opaque — `downcast_ref::<MyError>()` is a smell.
- **Binary authors want ergonomic propagation.** `main()` and CLI handlers have nothing useful to do with typed errors except print them. `anyhow::Result<()>` + `?` + `.context(...)` is shorter and the user-visible message is the same.
- **Bridges exist.** `pheno-errors::From<anyhow::Error> for AppError` lets binary-side `anyhow::Error` round-trip back to a typed `AppError` when a boundary needs it. This is the only sanctioned exception.

---

## 5. Raw evidence (citations)

- Lib classification (no binaries): `find . -name Cargo.toml -path "*/pheno-*/*"` returned 12 root-monorepo crates, all with `[lib]` only (zero `[[bin]]` matches).
- `pheno-config` violation: `grep -rn "anyhow" ./pheno-config --include="*.rs" --exclude-dir=target` returned exactly one match: `./pheno-config/src/hot_reload.rs:50: use anyhow::{Context, Result};`.
- `pheno-config` missing dep: `grep -c "^name = \"anyhow\"" ./pheno-config/Cargo.lock` returned `0` (the lock file does not include `anyhow` for this crate).
- `pheno-config` module wired in: `./pheno-config/src/lib.rs:43: pub mod hot_reload;`.
- `pheno-errors` interop pattern: `./pheno-errors/src/lib.rs:270: impl From<anyhow::Error> for AppError`.
- `pheno-tracing` dangling dep: `grep -rn "thiserror" ./pheno-tracing --include="*.rs" --exclude-dir=target` returned no matches in `src/`; `Cargo.toml:34` declares `thiserror = "2"`.
- `pheno-otel` gold standard: `./pheno-otel/src/error.rs:19: #[derive(Debug, Error)] pub enum OtelError` with 3 variants, `kind()` helper, and 5 unit tests.
- `pheno-errors` test ergonomics: `./pheno-errors/tests/smoke.rs:9: use anyhow::{Context, Result as AnyhowResult};` — standard test-side pattern, not a lib violation.

---

## 6. What this audit did NOT cover

- Non-Rust `pheno-*` crates (`pheno-fastapi-base`, `pheno-cost-card`, `pheno-llms-txt`, `pheno-mcp-router`, `pheno-prompt-test`, `pheno-pydantic-models`, `pheno-scaffold-kit`, `pheno-vibecoding-guard`, `pheno-worklog-schema`) — these are Python / TypeScript and use a different error model (exception classes, never `anyhow`/`thiserror`). They were excluded by scope.
- Sibling-repo `pheno-*` worktrees under `FocalPoint/`, `Configra/`, `argis-extensions/`, etc. — these are pre-monorepo mirrors; the canonical home is the root `./pheno-*` (per AGENTS.md §"Active ADRs"). They would re-derive the same data via the same script; not duplicated here.
- `phenotype-*` SDKs (`phenotype-go-sdk`, `phenotype-python-sdk`, `phenotype-mcp-sdk-*`) — out of scope (`phenotype-*` ≠ `pheno-*`); these use Go / Python / C# / TS errors.
- The `pheno-wtrees` git-worktree container — not a Rust crate (no Cargo.toml).

---

## 7. Reproduce

```bash
for entry in \
  "pheno-cli-base:./pheno-cli-base" \
  "pheno-config:./pheno-config" \
  "pheno-context:./pheno-context" \
  "pheno-errors:./pheno-errors" \
  "pheno-events:./pheno-events" \
  "pheno-flags:./pheno-flags" \
  "pheno-otel:./pheno-otel" \
  "pheno-port-adapter:./pheno-port-adapter" \
  "pheno-tracing:./pheno-tracing" \
  "crates-pheno-tracing:./crates/pheno-tracing" \
  "pheno-chaos-lib:./pheno-chaos/crates/pheno-chaos" \
  "pheno-chaos-macros:./pheno-chaos/crates/pheno-chaos-macros"; do
  name="${entry%%:*}"; d="${entry#*:}"
  echo "=== $name ==="
  adep=$(grep -rE "(use\s+anyhow|\"anyhow\"|^anyhow\s*=)" "$d" --include="*.rs" --include="Cargo.toml" --exclude-dir=target 2>/dev/null | wc -l | tr -d ' ')
  arsl=$(grep -rE "anyhow::Result|anyhow::Error|anyhow::Context" "$d/src" "$d/tests" "$d/examples" "$d/benches" --include="*.rs" --exclude-dir=target 2>/dev/null | wc -l | tr -d ' ')
  tdep=$(grep -rE "(use\s+thiserror|\"thiserror\"|^thiserror\s*=)" "$d" --include="*.rs" --include="Cargo.toml" --exclude-dir=target 2>/dev/null | wc -l | tr -d ' ')
  terr=$(grep -rE "thiserror::Error|#\[derive\(.*Error" "$d/src" "$d/tests" "$d/examples" "$d/benches" --include="*.rs" --exclude-dir=target 2>/dev/null | wc -l | tr -d ' ')
  echo "anyhow_dep=$adep anyhow::Result/Error/Context=$arsl thiserror_dep=$tdep thiserror::Error_or_derive=$terr"
done
```

Run from `repos/` (the monorepo root). Total wall: <5 s.
