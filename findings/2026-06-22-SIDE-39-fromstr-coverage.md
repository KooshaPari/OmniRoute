# SIDE-39 — FromStr impl coverage across `pheno-*` crates

**Date:** 2026-06-22 (audit pre-staged for cycle 9 window)
**Author:** orch-w1-a (device: macbook)
**Scope:** 12 `pheno-*` Rust crates in the monorepo's sparse-checkout cone
**Method:** AST grep for tuple-struct newtypes (`pub struct X(String | &str | &'a str | Cow<'a, str>)`) followed by `impl ... FromStr ... for X` matching in the same crate.

---

## TL;DR

| Fleet-wide FromStr coverage | `0 / 5` newtypes = **0.00 %** |
| :--- | :--- |
| Crates with at least one newtype | `2 / 12` (16.7 %) |
| Crates at 100 % coverage | `0 / 12` |
| Recommended next wave | `SIDE-40` — add `FromStr` (with `ParseError`) for the 5 existing newtypes +1 `Endpoint` newtype in `pheno-port-adapter` |

The fleet has **near-zero** FromStr coverage on its newtype wrappers. The two
crates that own newtypes (`pheno-config`, `pheno-tracing`) construct via
`new(impl Into<String>)` and rely on `serde` for round-tripping, never via
`str::parse`. This is consistent with the L7 substrate-canonical position
(`pheno-port-adapter` exposes `PortAdapter::connect(endpoint: &str)`) but
inconsistent with the v19 T4 (L19 perf) goal of reducing `String::from` calls
on hot paths (every `Endpoint::from_str` → `Self` saves one allocation).

---

## Methodology

1. **Crate inventory** — every `pheno-*/Cargo.toml` in the sparse-checkout cone
   (excludes worktrees/archives). Result: **12 Rust crates**:

   | # | Crate | Cargo path |
   |---|---|---|
   | 1 | `pheno-chaos` (lib) | `pheno-chaos/crates/pheno-chaos` |
   | 2 | `pheno-chaos-macros` (proc) | `pheno-chaos/crates/pheno-chaos-macros` |
   | 3 | `pheno-cli-base` | `pheno-cli-base` |
   | 4 | `pheno-config` | `pheno-config` |
   | 5 | `pheno-context` | `pheno-context` |
   | 6 | `pheno-errors` | `pheno-errors` |
   | 7 | `pheno-events` | `pheno-events` |
   | 8 | `pheno-flags` | `pheno-flags` |
   | 9 | `pheno-otel` | `pheno-otel` |
   | 10 | `pheno-port-adapter` | `pheno-port-adapter` |
   | 11 | `pheno-tracing` | `pheno-tracing` |

   (`pheno-port-adapter/fuzz/` has no `src/`; `pheno-mcp-router` is Python;
   `pheno-zod-schemas` is TypeScript; `pheno-go-ctxkit` is Go; the rest are
   Python — all out of scope for `FromStr`.)

2. **Newtype detection** — ripgrep pattern
   `\bstruct\s+[A-Z][A-Za-z0-9_:]*(<[^>]*>)?\s*\(\s*(pub\s+)?(String|&str|&\x27[a-z]+\s*str|Cow<\x27[a-z]+,\s*str>)\s*\)`
   scoped to each crate's `src/`.

3. **FromStr coverage** — ripgrep pattern
   `impl(<[^>]*>)?\s+(std::str::)?FromStr(\s*<[^>]+>)?\s+for`
   in the same `src/`. Cross-checked with a `FromStr|::from_str` reference
   sweep (returned zero hits across all 12 crates — confirms the absent
   coverage is not a partial-impl miss).

4. **Sanity check** — read each candidate file by hand to confirm struct
   definition matches the newtype shape (no `pub(crate)` / private fields
   smuggling through).

---

## Per-crate coverage table

| # | Crate | Newtypes | FromStr impls | Coverage % |
|---|---|---:|---:|---:|
| 1 | `pheno-chaos` | 0 | 0 | **N/A** (no newtypes) |
| 2 | `pheno-chaos-macros` | 0 | 0 | **N/A** (proc-macro, no runtime types) |
| 3 | `pheno-cli-base` | 0 | 0 | **N/A** (only clap `#[derive(Parser)]` structs) |
| 4 | `pheno-config` | 3 | 0 | **0.00 %** |
| 5 | `pheno-context` | 0 | 0 | **N/A** (struct-with-named-fields, no newtype) |
| 6 | `pheno-errors` | 0 | 0 | **N/A** (enum-only error vocabulary) |
| 7 | `pheno-events` | 0 | 0 | **N/A** (uses `uuid::Uuid` for IDs, no wrapper) |
| 8 | `pheno-flags` | 0 | 0 | **N/A** (wraps `HashMap<String, bool>`) |
| 9 | `pheno-otel` | 0 | 0 | **N/A** (histogram / exporter / guard, no domain newtypes) |
| 10 | `pheno-port-adapter` | 0 | 0 | **N/A** (named-field structs `Connection`, `TcpAdapter`, …) |
| 11 | `pheno-tracing` | 2 | 0 | **0.00 %** |
| 12 | **Fleet total** | **5** | **0** | **0.00 %** |

---

## Detailed newtype inventory

### `pheno-config/src/secrets.rs` — 3 newtypes, 0 FromStr

| Newtype | Visibility | Inner | FromStr? | Constructor in use |
|---|---|---|---|---|
| `ApiKey` | `pub` (private field) | `String` | ❌ | `ApiKey::new(impl Into<String>)` — panics on empty (`pheno-config/src/secrets.rs:93`) |
| `BearerToken` | `pub` (private field) | `String` | ❌ | `BearerToken::new(impl Into<String>)` (`pheno-config/src/secrets.rs:130`) |
| `DbPassword` | `pub` (private field) | `String` | ❌ | `DbPassword::new(impl Into<String>)` (`pheno-config/src/secrets.rs:141`) |

**Notes:**
- Each newtype derives `Zeroize + ZeroizeOnDrop + Clone` (`pheno-config/src/secrets.rs:118`, `:129`, `:140`).
- `Display`/`Debug` both render as `"***REDACTED***"` via the `impl_secret_fmt!` macro (`pheno-config/src/secrets.rs:56-76`) — adding FromStr must preserve this redaction contract (e.g. the `Err` variant must NOT echo the raw input).
- Constructor rejects empty input with a panic (`assert!(!inner.is_empty())` at `pheno-config/src/secrets.rs:96-98`). A FromStr impl would return `Err` instead — breaking change for any caller that relied on the panic; recommend FromStr return `Err(SecretParseError::Empty)` and keep `new()` panicking.

### `pheno-tracing/src/port.rs` — 2 newtypes, 0 FromStr

| Newtype | Visibility | Inner | FromStr? | Constructor in use |
|---|---|---|---|---|
| `TraceId` | `pub` (public field) | `String` | ❌ | Direct field init `TraceId("...".to_string())` (`pheno-tracing/src/port.rs:13`) |
| `SpanId` | `pub` (public field) | `String` | ❌ | Direct field init (`pheno-tracing/src/port.rs:17`) |

**Notes:**
- Both wrap the OTLP base16 wire format (128-bit trace id, 64-bit span id). The current `String`-typed inner is the simplest substrate — FromStr impl should validate base16 length (`32` for `TraceId`, `16` for `SpanId`) and reject anything else with `ParseTraceIdError::InvalidLength { expected, found }`.
- Field is `pub` so the FromStr impl must guard against invalid OTLP IDs at construction, which it currently does not.

---

## Negative findings (searched, found nothing)

- **No `TryFrom<&str>` fallback** — the only "construct from string" path is the `new(impl Into<String>)` constructor or direct field init. Confirmed by ripgrep `impl(<[^>]*>)?\s+(std::convert::)?TryFrom(<[^>]*>)?\s+for` returning zero hits across all 12 crates.
- **No `Model` / `Provider` / `Endpoint` newtypes in any `pheno-*` crate** — those domain types live in `phenoEvents/src/schema` (Python) and in the LLM-provider layer under `phenotype-python-sdk` (out of scope). The fleet's Rust substrate uses string-typed `endpoint: &str` parameters on the hex-port traits (`pheno-port-adapter/src/lib.rs:84` `PortAdapter::connect(&self, endpoint: &str)`) rather than introducing an `Endpoint` newtype.
- **No private (non-`pub`) newtypes hidden in test modules** — searched `mod tests` blocks; all `String`-wrapper structs found are crate-public.
- **No `Cow<'a, str>` newtypes** — ripgrep pattern found zero matches.
- **No `&'static str` newtypes** beyond the constant `REDACTED` in `pheno-config/src/secrets.rs:49` (which is a const, not a newtype).

---

## Why coverage is 0.00 % (root-cause analysis)

1. **Construction style is `Into<String>`-based, not `FromStr`-based.** Every
   crate that needs to build a string-shaped value accepts `impl Into<String>`
   on a builder method or `new()` function. This is idiomatic Rust but
   deliberately *not* `FromStr` — `Into<String>` permits owned `String`s from
   env-var reads, `format!` results, and `String::from_utf8` conversions, all
   of which are common in the substrate-canonical pipelines (config cascade,
   env-var flag loading).

2. **Validation is delegated to the constructor, not `FromStr`.**
   `ApiKey::new` panics on empty input (`pheno-config/src/secrets.rs:96-98`).
   `EventEnvelopeBuilder::build` returns `Err(EnvelopeError::EmptyEventType)`
   (`pheno-events/src/core/mod.rs:117`). The substrate author chose "panic on
   construction in debug builds" and "explicit validation in a dedicated
   builder" over "fail at parse time via `FromStr::Err`".

3. **The substrate does not need to round-trip through `&str`.** All
   newtypes are either secret material (never logged, never stringified) or
   OTLP identifiers (already a `String`). A `FromStr` impl would add API
   surface without changing any current call site.

---

## Recommended follow-up — `SIDE-40` (proposed)

If the org decides to raise this score above 0.00 %, the smallest viable
patch is **5 impls + 1 new newtype**:

| Track | PR | LoC | Notes |
|---|---|---:|---|
| `pheno-config/src/secrets.rs` | `impl FromStr for ApiKey / BearerToken / DbPassword` | ~30 | New `SecretParseError` enum; redaction-safe `Display`; constructor panic-path unchanged |
| `pheno-tracing/src/port.rs` | `impl FromStr for TraceId / SpanId` + length validation | ~50 | New `ParseTraceIdError` enum; base16 length check |
| `pheno-port-adapter/src/ports/` | **New** `pub struct Endpoint(pub String)` + `impl FromStr for Endpoint` + URI scheme validation per adapter (`tcp://`, `unix://`) | ~80 | Closes the `PortAdapter::connect(endpoint: &str)` ambiguity — URI scheme vs opaque string |
| `pheno-context/src/lib.rs` | `impl FromStr for Context::request_id` (extract into `RequestId` newtype first) | ~120 | Optional; larger refactor |
| Tests | proptest round-trip + invalid-input coverage | ~150 | Bumps `pheno-config` and `pheno-tracing` to L23 (proptest) status |
| **Total** | | **~430** | Brings fleet coverage to **5 / 6** = **83.3 %** |

This is a single-wave SIDE-40 work package, scoped to macbook (no heavy
build), ~430 LoC across 4 crates, ~2-day wall.

---

## Appendix — verification commands

```bash
# Newtype scan (returns the 5 hits in pheno-config + pheno-tracing)
for crate in pheno-chaos/crates/pheno-chaos pheno-chaos/crates/pheno-chaos-macros \
             pheno-cli-base pheno-config pheno-context pheno-errors \
             pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  grep -rnE '\bstruct\s+[A-Z][A-Za-z0-9_:]*(<[^>]*>)?\s*\(\s*(pub\s+)?(String|&str|&\x27[a-z]+\s*str|Cow<\x27[a-z]+,\s*str>)\s*\)' \
       "$crate/src" 2>/dev/null
done

# FromStr impl scan (returns zero hits)
for crate in pheno-chaos/crates/pheno-chaos pheno-chaos/crates/pheno-chaos-macros \
             pheno-cli-base pheno-config pheno-context pheno-errors \
             pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  grep -rnE 'impl(<[^>]*>)?\s+(std::str::)?FromStr(\s*<[^>]+>)?\s+for' \
       "$crate/src" 2>/dev/null
done

# Cross-check: any FromStr reference (also zero)
for crate in pheno-chaos pheno-cli-base pheno-config pheno-context pheno-errors \
             pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  grep -rln -E 'FromStr|::from_str\(' "$crate/src" 2>/dev/null
done
```

All three commands reproduce the table above.
