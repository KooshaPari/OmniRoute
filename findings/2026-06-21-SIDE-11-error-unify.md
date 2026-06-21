# SIDE-11: Error type unification across the pheno-* fleet

**Date:** 2026-06-21
**Author:** orch-w1-a (analysis), generated via SIDE-track
**Scope:** 5 pheno-* substrate crates in the sparse-checkout cone
**Method:** Direct read of each crate's `src/` + grep for `enum \w*Error` to catch every error variant
**Status:** ANALYTICAL ONLY — no code changes recommended without a follow-up ADR (see §6)

---

## 1. Crates surveyed

| # | Crate            | Path                                   | File holding the Error enum                            | Lines |
|---|------------------|----------------------------------------|--------------------------------------------------------|------:|
| 1 | `pheno-errors`   | `pheno-errors/`                        | `src/lib.rs:77-115` (`AppError`)                       |   469 |
| 2 | `pheno-config`   | `pheno-config/`                        | `src/secrets.rs:18-32` (`SecretError`)                 |    58 |
| 3 | `pheno-context`  | `pheno-context/`                       | `src/oidc.rs:43-69` (`OidcError`)                      |   229 |
| 4 | `pheno-port-adapter` | `pheno-port-adapter/`               | `src/lib.rs:38-57` (`AdapterError`) + `src/ports/cache.rs:49-62` (`CacheError`) | 195 + 84 |
| 5 | `pheno-tracing`  | `pheno-tracing/`                       | **No Error enum** — uses `Result<_, String>` and a `TraceStatus::Error(String)` carrier | 87 + 67 |

Two of the five (pheno-context, pheno-port-adapter) have *domain-specific* enums that carry more context than a generic error would; two have a small, generic enum (pheno-errors, pheno-config); one has no enum at all (pheno-tracing).

---

## 2. Per-crate Error enum dump

### 2.1 `pheno-errors::AppError` — the canonical fleet-wide type

`pheno-errors/src/lib.rs:76-115`

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("domain error: {0}")]
    Domain(String),

    #[error("not found: {entity} {id}")]
    NotFound { entity: String, id: String },

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("storage error: {0}")]
    Storage(String),
}
```

**Variant count:** 5
**Derive:** `Debug`, `thiserror::Error`
**Helpers:** `AppResult<T>` alias, `kind() -> &'static str` (returns `domain`/`not_found`/`conflict`/`validation`/`storage`), convenience constructors (`AppError::domain(...)`, `.not_found(...)`, `.conflict(...)`, `.validation(...)`, `.storage(...)`), `log_warn()` / `log_error()` passthrough emitters via `tracing`.
**From impls:** `From<std::io::Error>` → `Storage`, `From<&'static str>` → `Domain`, `From<String>` → `Domain`, `From<anyhow::Error>` → `Domain` (walks the cause chain — `pheno-errors/src/lib.rs:236-248`).
**Companion:** `pheno-errors/src/rfc7807.rs` — `Problem` struct maps every variant to an HTTP status (`Domain`/`Storage` → 500, `NotFound` → 404, `Conflict` → 409, `Validation` → 400) for `application/problem+json` responses.

### 2.2 `pheno-config::SecretError` — narrow validation only

`pheno-config/src/secrets.rs:18-32`

```rust
#[derive(Debug, PartialEq, Eq)]
pub enum SecretError {
    Empty,
}

impl fmt::Display for SecretError { /* … "secret bytes are empty" … */ }
impl std::error::Error for SecretError {}
```

**Variant count:** 1
**Derive:** `Debug`, `PartialEq`, `Eq` (no `Clone`, no `thiserror`)
**Helpers:** None.
**From impls:** None — `SecretError` is a leaf type that is `From`-converted *into* `AppError` by callers via `.map_err(...)`.
**Notes:** Hand-rolled `Display` + `Error` impl; uses `zeroize` adjacent in the file (ADR-078 alignment). Tightly scoped to "is the byte slice empty?" — it does not try to model the broader config-loading error space.

### 2.3 `pheno-context::OidcError` — domain-rich, 9 variants

`pheno-context/src/oidc.rs:43-69`

```rust
#[derive(Debug)]
pub enum OidcError {
    InvalidToken,
    TokenExpired(i64),
    AudienceMismatch { expected: String, actual: String },
    IssuerMismatch { expected: String, actual: String },
    JwksUnreachable(String),
    IssuerConfigUnavailable(String),
    UnknownKid(String),
    DecodingError(String),
    RefreshFailed(String),
}

impl std::fmt::Display for OidcError { /* one arm per variant, hand-rolled */ }
impl std::error::Error for OidcError {}
```

**Variant count:** 9
**Derive:** `Debug` only (no `Clone`, no `PartialEq`, no `thiserror`)
**Helpers:** None — no constructors, no `kind()` method, no logging helpers.
**From impls:** None.
**Notes:** Hand-rolled `Display`. Carries structured context (mismatched `expected` vs `actual` strings, `exp` expiry timestamp) that would be lost in a generic `String` payload — a key argument *against* collapse-to-`AppError` here. No `thiserror` dependency; per ADR-079 this is a reference stub slated for v20 hardening.

### 2.4 `pheno-port-adapter::AdapterError` and `CacheError` — two parallel enums

**AdapterError** — `pheno-port-adapter/src/lib.rs:38-57`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AdapterError {
    #[error("connect failed: {0}")]
    ConnectFailed(String),
    #[error("disconnect failed: {0}")]
    DisconnectFailed(String),
    #[error("health check failed: {0}")]
    HealthCheckFailed(String),
    #[error("timeout")]
    Timeout,
}
```

**Variant count:** 4
**Derive:** `Debug`, `thiserror::Error`
**Helpers:** None.
**From impls:** None.
**Notes:** One `Timeout` variant carries no payload (a unit variant); the rest carry a `String` description. Used by the transport `PortAdapter` trait (`connect` / `disconnect` / `health`).

**CacheError** — `pheno-port-adapter/src/ports/cache.rs:49-62`

```rust
#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("cache backend error: {0}")]
    Backend(String),
    #[error("invalid cache key: {0}")]
    InvalidKey(String),
    #[error("serialization error: {0}")]
    Serialization(String),
}
```

**Variant count:** 3
**Derive:** `Debug`, `thiserror::Error`
**Helpers:** None.
**From impls:** None — adapters construct via `CacheError::Backend(...)` etc.
**Notes:** Used by `HexCachePort` (`get` / `put` / `invalidate`). Contract is documented in the module doc-comment: `Backend` is for transport/server failures only — never used for cache misses (which are `Ok(None)`).

### 2.5 `pheno-tracing` — no Error enum

`pheno-tracing/src/port.rs:66` and `pheno-tracing/src/adapters.rs:55,82`:

```rust
async fn flush(&self) -> Result<(), String>;
```

And `pheno-tracing/src/port.rs:50-53`:

```rust
pub enum TraceStatus {
    Ok,
    Error(String),
}
```

**Variant count:** N/A — there is no Error enum. The crate uses opaque `String` errors on `flush()`, and wraps a per-span `TraceStatus::Error(String)` for the submission path.
**Notes:** The `pheno-tracing/AGENTS.md:15-16` and `pheno-tracing/llms.txt:28` *describe* a `TracingError` type in their public API surface, but no such type exists in `src/` yet — those docs are aspirational. This is the **most fragile** of the five: opaque `String` errors prevent `match` exhaustiveness, lose the cause chain, and break structured logging field extraction downstream.

---

## 3. Aggregate matrix

| Crate            | Type           | Variants | thiserror | kind() | Logging helpers | HTTP mapping | From impls |
|------------------|----------------|---------:|-----------|--------|-----------------|--------------|------------|
| `pheno-errors`   | `AppError`     | **5**    | yes       | yes    | `log_warn`, `log_error` | `Problem` (RFC 7807) | `io::Error`, `&str`, `String`, `anyhow::Error` |
| `pheno-config`   | `SecretError`  | **1**    | no        | no     | no              | none         | none |
| `pheno-context`  | `OidcError`    | **9**    | no        | no     | no              | none         | none |
| `pheno-port-adapter` | `AdapterError` | **4**    | yes       | no     | no              | none         | none |
| `pheno-port-adapter` | `CacheError`   | **3**    | yes       | no     | no              | none         | none |
| `pheno-tracing`  | *(none — `String`)* | —    | n/a       | n/a    | n/a             | n/a          | n/a |

**Total distinct enums across the 5 crates:** 5 (`AppError`, `SecretError`, `OidcError`, `AdapterError`, `CacheError`)
**Total distinct variants across all 5 enums:** 22 (5 + 1 + 9 + 4 + 3)

---

## 4. Common shape — what the 5 share

Across all 5 enums (excluding `pheno-tracing` which has no enum), the same skeleton recurs:

1. **`String`-payload variants dominate.** 19 of the 22 variants take either a single `String` or a small struct of `String` fields. Only 2 variants are unit (no payload): `SecretError::Empty` and `AdapterError::Timeout`. Only 1 variant carries a non-string payload: `OidcError::TokenExpired(i64)`.
2. **All implement `std::error::Error`.** Either via `thiserror::Error` derive (3 enums) or hand-rolled `impl std::error::Error for ... {}` (2 enums: `SecretError`, `OidcError`).
3. **All have a `Display` impl.** Via `#[error("…")]` attribute (thiserror) or hand-rolled `impl fmt::Display`.
4. **All five `String`-payload variants** carry the same conceptual content: a free-form message describing what failed. They differ only in the variant name (e.g. `Domain` vs `Backend` vs `ConnectFailed`).
5. **No crate uses `#[non_exhaustive]`.** Every enum is closed; `match` exhaustiveness checks work at every call site.
6. **No crate adds a blanket `From<E: Error>` impl.** Each crate is selective: either concrete `From<io::Error>` (just `pheno-errors`) or no `From` impls at all (the other three enums).
7. **Three of four enums** (with the exception of `AdapterError::Timeout`) round-trip a backend's error message verbatim into a `String` — the backend's display is the entire context.

---

## 5. Differences — where the 5 diverge

The differences cluster into three categories:

### 5.1 Macro-style split (3 vs 2)

- **thiserror consumers (3):** `AppError`, `AdapterError`, `CacheError`
- **Hand-rolled consumers (2):** `SecretError`, `OidcError`

`pheno-context` and `pheno-config` are the outliers — both rely on `impl Display` + `impl Error` boilerplate. Migrating them to `thiserror::Error` is a one-PR cosmetic fix per crate and unblocks cross-crate `From` derives.

### 5.2 Variant-count spread (1 → 9)

- **1 variant:** `SecretError` (single-purpose validation)
- **3 variants:** `CacheError`
- **4 variants:** `AdapterError`
- **5 variants:** `AppError` (the canonical fleet type)
- **9 variants:** `OidcError` (domain-rich: 9 failure modes for one wire protocol)

`OidcError`'s 9 variants are **not redundant** — they encode failure modes that `AppError`'s 5-variant set cannot distinguish (e.g. `TokenExpired(i64)` carries the unix timestamp; `AudienceMismatch { expected, actual }` carries the structural mismatch; `JwksUnreachable(String)` distinguishes JWKS network failure from generic transport failure). Forcing `OidcError` into `AppError` would lose audit-trail context. The right unification is **wrapping**, not **replacing**.

### 5.3 Helpers and instrumentation (1 vs 4)

- **`AppError` is the only type with `kind()`, `From` impls, constructors, `AppResult<T>` alias, `log_warn`/`log_error`, and an HTTP `Problem` companion.** Every other type is "just the enum" — no helpers, no aliases, no observability hooks.
- **`pheno-tracing` doesn't even have an enum.** It's the most-inconsistent crate in this set and the worst candidate for unification — anything we propose here is a *new* type, not a refactor of an existing one.

---

## 6. Suggested common base

The fleet already has a canonical type (`pheno-errors::AppError`), so the suggestion is **not** "invent a new common base" — it is "**promote `AppError` to a cross-crate contract and add From-impl bridges from each crate-specific enum**". Three layers:

### 6.1 Adopt `AppError` as the fleet boundary contract (no new type)

`AppError` already covers the canonical 5 buckets (Domain, NotFound, Conflict, Validation, Storage). Every variant in `SecretError`, `AdapterError`, `CacheError` is a *strict subset* of one of those 5 buckets. The unification work is:

- **`pheno-config`:** `From<SecretError> for AppError` → `SecretError::Empty` → `AppError::Validation("secret bytes are empty")`. One trivial impl.
- **`pheno-port-adapter`:** `From<AdapterError> for AppError` → `ConnectFailed`/`DisconnectFailed`/`HealthCheckFailed`/`Timeout` → `AppError::Storage(...)`. One trivial impl. Likewise for `From<CacheError>`: `Backend` → `Storage`, `InvalidKey` → `Validation`, `Serialization` → `Domain`.
- **`pheno-context`:** `From<OidcError> for AppError` → mapping the 9 variants (see §6.2). **But** `OidcError` itself should remain — callers inside `pheno-context` still benefit from the 9-variant match.

The benefit: every library consumer can write `Result<T, AppError>` and stop carrying 4 different `Result<T, X>` types through the call graph.

### 6.2 Wrap, don't replace, domain-rich enums (for `OidcError`)

`OidcError`'s 9 variants carry structured context that `AppError` cannot preserve in a `String`. The right move is:

```rust
// in pheno-context/src/oidc.rs (new impl)
impl From<OidcError> for AppError {
    fn from(e: OidcError) -> Self {
        match e {
            OidcError::InvalidToken       => AppError::validation("token invalid or alg not RS256"),
            OidcError::TokenExpired(t)    => AppError::validation(format!("token expired at {}", t)),
            OidcError::AudienceMismatch { expected, actual } =>
                AppError::validation(format!("aud mismatch: exp {expected} got {actual}")),
            OidcError::IssuerMismatch { expected, actual } =>
                AppError::validation(format!("iss mismatch: exp {expected} got {actual}")),
            OidcError::JwksUnreachable(s)         => AppError::storage(format!("JWKS unreachable: {s}")),
            OidcError::IssuerConfigUnavailable(s) => AppError::storage(format!(".well-known unavail: {s}")),
            OidcError::UnknownKid(k)              => AppError::not_found("jwk", k),
            OidcError::DecodingError(s)           => AppError::validation(format!("JWT decoding: {s}")),
            OidcError::RefreshFailed(s)           => AppError::storage(format!("refresh failed: {s}")),
        }
    }
}
```

`OidcError` stays put for crate-internal `match`; the bridge lifts it to `AppError` at API boundaries (HTTP handlers, CLI front-ends, app-level call sites). The `kind()` method on the resulting `AppError` still gives consumers a stable, lowercase tag.

### 6.3 Add a real `TracingError` to `pheno-tracing` (replace `String`)

`pheno-tracing` is the only crate that has *no* error enum — it uses `Result<(), String>` and a `TraceStatus::Error(String)` carrier. This is the single highest-leverage unification move, because:

- It eliminates opaque `String` errors that prevent `match` exhaustiveness.
- It gives observability hooks (the whole point of `pheno-tracing` is structured logging).
- The `AGENTS.md` and `llms.txt` already advertise a `TracingError` API; the implementation just hasn't landed.

The minimal `TracingError` could be a 3-variant enum (`Flush(String)`, `Export(String)`, `Config(String)`), all mapping cleanly into `AppError::Storage` / `AppError::Domain` via a one-liner `From<TracingError> for AppError`.

### 6.4 Codify a small `Error` convention across all 5 crates

A 4-rule policy that all five crates (and every future pheno-* crate) should follow:

1. **One canonical base type:** prefer `AppError` from `pheno-errors` for cross-crate boundaries; keep a domain-specific enum only when it carries structured context that a `String` payload would lose (e.g. `OidcError`'s mismatched-`expected/actual` structs).
2. **Always `thiserror::Error`-derive:** no hand-rolled `impl Display` + `impl Error`. This unblocks `From`, `?`-propagation, and `anyhow` interop uniformly.
3. **Always expose `kind() -> &'static str`:** stable, lowercase, snake_case tag for logging and metrics (the pattern `AppError` already establishes).
4. **No `From<E: Error>` blanket impls:** the concrete `From<io::Error>` rule is the only acceptable blanket — every other conversion must be explicit `.map_err(...)` at the call site, to keep type-system inference honest at the boundary.

### 6.5 Recommended rollout (no code in this report)

| Phase | Crate              | Change                                                                                                                  | LoC est. | Risk   |
|-------|--------------------|-------------------------------------------------------------------------------------------------------------------------|---------:|--------|
| 1     | `pheno-config`     | Add `From<SecretError> for AppError`; migrate `SecretError` to `thiserror::Error` derive.                               |       ~20 | trivial |
| 2     | `pheno-port-adapter` | Add `From<AdapterError>` + `From<CacheError> for AppError`. Both already use `thiserror`.                              |       ~30 | trivial |
| 3     | `pheno-context`    | Add `From<OidcError> for AppError` (per §6.2 mapping). Migrate `OidcError` to `thiserror::Error` derive.              |       ~50 | low (mapping decisions) |
| 4     | `pheno-tracing`    | Define a `TracingError` enum (3 variants); replace `Result<(), String>` and `TraceStatus::Error(String)` with it; add `From<TracingError> for AppError`. | ~80 | medium (touches `TracePort` trait shape) |
| 5     | All 5 crates       | Adopt the 4-rule convention from §6.4; add a one-paragraph note in each crate's `AGENTS.md` linking back to this doc.  |       ~5/crate | trivial |

**Total LoC across all phases:** ~210, plus ~25 doc lines. No public-API breaking changes if the new `From` impls are added *additively*.

**Out of scope for this report:**
- Replacing any domain-specific enum with `AppError` outright (we explicitly recommend against this for `OidcError`).
- Changing the `TracePort::flush() -> Result<(), String>` signature (that's a SemVer-breaking change to the trait; should land in a separate ADR + version bump).
- Adding an `enum Error` (rather than `AppError`) — `AppError` is already canonical per ADR-022 and the L3 #46 rollout; renaming would be churn without value.

---

## 7. Open questions

1. Should `AppError` add a 6th variant (`Auth`?) for the OIDC-vs-storage distinction in §6.2? The current 5-bucket set forces OIDC failures into `Validation` or `Storage`, which is acceptable but loses a useful tag.
2. Should the `kind()` method on `AppError` be promoted to a `Kind` enum (`pub enum Kind { Domain, NotFound, Conflict, Validation, Storage }`) for type-safe dispatch instead of stringly-typed `&'static str`? Backwards-compatible — `Kind` could `as_str()` to the existing string.
3. Should `pheno-port-adapter` unify `AdapterError` and `CacheError` into a single `PortError`? Currently they sit in different modules (transport vs cache); the 4+3 variant split tracks the port-trait split. A unified enum would let one `?` cover both, but conflates "transport-level" with "cache-level" failure modes.

---

## 8. Provenance

- Read paths: `pheno-errors/src/lib.rs:76-115` (AppError), `pheno-errors/src/rfc7807.rs:143-165` (mapping), `pheno-config/src/secrets.rs:18-32` (SecretError), `pheno-context/src/oidc.rs:43-69` (OidcError), `pheno-port-adapter/src/lib.rs:38-57` (AdapterError), `pheno-port-adapter/src/ports/cache.rs:49-62` (CacheError), `pheno-tracing/src/port.rs:50-66` (TraceStatus + flush signature), `pheno-tracing/src/adapters.rs:55,82` (Result<String> use sites).
- Cross-checked via `fs_search "enum \\w*Error"` across each crate — only the 5 enums above surfaced.
- Related prior work: `findings/2026-06-21-SIDE-05-tech-debt.md` (general debt pass), `findings/2026-06-21-SIDE-12-otel-coverage.md` (sister OTel coverage audit).
- Related ADRs: ADR-022 (config consolidation, two-crate split), ADR-038 (hexagonal port-adapter L4 policy).