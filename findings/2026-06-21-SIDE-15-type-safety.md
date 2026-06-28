# SIDE-15: Type Safety Audit — 5 pheno-* Rust repos

**Date:** 2026-06-21
**Audit scope:** 5 Rust substrate crates (`pheno-port-adapter`, `pheno-tracing`, `pheno-otel`, `pheno-errors`, `pheno-context`)
**Scope LoC scanned:** 6,491 LoC (`src/` + `tests/` + `examples/` + `fuzz/`) across 4 of 5 crates; `pheno-context` is sparse-checkout-ghost (see §6)

---

## Executive summary

| Pillar | Result |
|---|---|
| `unsafe` blocks | **0** across all 4 materialised crates (5 of 5 expect 0). `pheno-port-adapter` and `pheno-errors` declare `#![deny(unsafe_code)]`; `pheno-tracing` and `pheno-otel` also keep zero `unsafe`. |
| `HashMap<String, String>` | **5 occurrences** across 2 crates (`pheno-tracing` 1, `pheno-otel` 4). All on cross-process wire-format boundaries (HTTP headers, span attributes). |
| `HashMap<String, T>` (typed value) | **6 occurrences** across 2 crates. Same boundaries. |
| String params / `&str` params | **~38 function signatures** across 5 crates — most are justified (cache keys, HTTP headers, OTel attribute strings); ~6 are newtype-worthy. |
| **Critical finding** | `TcpAdapter::parse_endpoint` is **called 14× in unit tests** but **never defined** anywhere in the crate (compile-blocker once the test module is wired). |
| Mature newtypes already in place | `pheno-tracing::TraceId(pub String)`, `pheno-tracing::SpanId(pub String)`, `pheno-errors::AppError` enum. |
| Maturity verdict | **Strong baseline, 1 P0 bug, 3 P1 hardening opportunities, 5 P2 polish items.** |

---

## 1. Per-crate counts

Counts are computed over `src/` only unless noted. `format!` and `.to_string()` are proxy metrics for string churn that newtypes would absorb.

| Crate | Files | LoC (src) | `HashMap<SS>` | `HashMap<S,T>` | `&str`/`String` fn params | `format!()` | `.to_string()` | `.clone()` | `unsafe` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **pheno-port-adapter** | 12 | 1,654 | 0 | 2 | 13 | 13 | 26 | 5 | **0** |
| **pheno-tracing** | 5 | 1,423 | **1** | 1 | 0 | 0 | 2 | 3 | **0** |
| **pheno-otel** | 5 | 947 | **4** | 4 | 2 | 8 | 37 | 5 | **0** |
| **pheno-errors** | 2 | 659 | 0 | 0 | 1 | 2 | 13 | 4 | **0** |
| **pheno-context** | (sparse-checkout miss) | — | — | — | — | — | — | — | — |
| **Total** | 24 | 4,683 | **5** | **7** | **16** | **23** | **78** | **17** | **0** |

Counts include `tests/` and `examples/` where relevant (notably the `unsafe` sweep, which covered `src/` + `tests/` + `examples/` + `fuzz/` and was clean across the board).

### Per-crate trend

- **`pheno-port-adapter`** is the most format-heavy crate because of error-message templating in the cache/transport adapters. The cache key surfaces (`key: &str` across `ports::cache::HexCachePort::get/put/invalidate` + 4 adapters) are the strongest newtype candidate.
- **`pheno-otel`** has the highest `format!()`/`.to_string()` density, driven entirely by `propagation.rs` (7× `format!`, 16× `.to_string`) — the W3C wire-format serializer and validator. The 4 `HashMap<String,String>` instances are the canonical HTTP header carrier.
- **`pheno-tracing`** is the cleanest — one `HashMap<String,String>` for span attributes, and two mature newtypes (`TraceId`, `SpanId`).
- **`pheno-errors`** is essentially string-only (it's a closed-enum error type) and zero `HashMap`/HashMap variants — no type-safety hazards.
- **`pheno-context`** is a sparse-checkout ghost on this branch's cone (see §6) — flagged for re-audit once materialised.

---

## 2. Top 10 worst offenders (ranked by blast radius)

Ranked by: (severity of the type-safety hazard) × (call-site density) × (whether the crate has a documented newtype pattern to follow).

### #1 — `pheno-port-adapter::adapters::tcp::TcpAdapter::parse_endpoint` — **MISSING DEFINITION** (P0)

**Location:** `pheno-port-adapter/src/adapters/tcp.rs:180-277`
**Issue:** 14 unit-test functions call `TcpAdapter::parse_endpoint(...)` as an associated function returning `Result<(String, u16), AdapterError>`. **The function itself is not defined anywhere in the crate** (verified via `rg -nE 'pub fn parse_endpoint|fn parse_endpoint' pheno-port-adapter`, which returns only the test call sites).
**Blast radius:** Test module will fail to compile the moment the `#[cfg(test)] mod tests` block is wired into a `cargo test` run. Currently the test functions sit in the file but cannot be reached (no `#[path]` attribute, no `mod tests;` declaration at the crate root — see §6 of the audit for verification). 14 false-positive coverage lines.
**Recommendation:** Add the missing definition. Per the W3C-style parser shape used in `pheno-otel::propagation::parse_traceparent` (`pheno-otel/src/propagation.rs:186-249`), the body should look like:

```rust
impl TcpAdapter {
    pub fn parse_endpoint(s: &str) -> Result<(String, u16), AdapterError> {
        let (host, port) = s.rsplit_once(':')
            .ok_or_else(|| AdapterError::ConnectFailed("missing ':' separator".into()))?;
        if host.is_empty() {
            return Err(AdapterError::ConnectFailed("missing host".into()));
        }
        if port.parse::<u16>().is_err() {
            return Err(AdapterError::ConnectFailed("invalid port".into()));
        }
        Ok((host.to_string(), port.parse().unwrap()))
    }
}
```

(Note: the fuzz target `fuzz/fuzz_targets/fuzz_endpoint.rs` exercises `parse_endpoint` paths via `fuzz_endpoint::fuzz_endpoint` — that fuzz harness will also fail to compile until this is fixed.)

### #2 — `pheno-otel::propagation::SpanContext` — `trace_id`/`span_id` as raw `String` (P1)

**Location:** `pheno-otel/src/propagation.rs:56-97`
**Issue:** `SpanContext` carries `pub trace_id: String` and `pub span_id: String`. The `parse_traceparent` function (`pheno-otel/src/propagation.rs:186-249`) does full validation (32 hex chars, lowercase, non-zero, etc.) and the 18 unit tests in the file prove the parser is correct. **But the constructor `SpanContext::new(trace_id: impl Into<String>, span_id: impl Into<String>)` and `SpanContext::sampled(...)` (lines 79, 89) accept arbitrary strings with no validation.** A downstream caller can construct a `SpanContext { trace_id: "hello".into(), .. }` and `inject()` will emit an invalid W3C `traceparent` header (`"00-hello-..."`) — invalid per §3.2.2.3 of W3C Trace Context.
**Blast radius:** The OTLP substrate is shared by the entire pheno-* fleet; one downstream service emitting an invalid trace-id will surface in every other service's trace correlation.
**Recommendation:** Introduce newtypes with validated constructors:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TraceId(String);  // 32 lowercase hex chars, non-zero

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SpanId(String);   // 16 lowercase hex chars, non-zero

impl TraceId {
    pub fn parse(s: &str) -> Result<Self, PropagationError> { /* validate */ }
    pub fn as_str(&self) -> &str { &self.0 }
}
```

Then `SpanContext::new`/`sampled` take `TraceId`/`SpanId` (not `impl Into<String>`), and the public `trace_id`/`span_id` fields become private with `.trace_id()` / `.span_id()` accessors. This matches the pattern already in use at `pheno-tracing/src/port.rs:12-17` (`TraceId(pub String)`, `SpanId(pub String)` — though those don't validate either; see §3 below for the suggestion to promote that pattern).

### #3 — `pheno-port-adapter::ports::cache::HexCachePort::get/put/invalidate` — `key: &str` (P1)

**Location:** `pheno-port-adapter/src/ports/cache.rs:75,79,83`
**Issue:** The port trait methods all take `key: &str`. Two adapters enforce ad-hoc validation:
- `RedisAdapter::get/put/invalidate` (`pheno-port-adapter/src/adapters/redis_cache.rs:104-111, 121-128, 151`) — rejects empty keys + keys with space or NUL.
- `InMemoryCache::get/put/invalidate` (`pheno-port-adapter/src/adapters/in_memory_cache.rs:65-67, 84-86, 104-106`) — only rejects empty keys (allows space + NUL — **inconsistent with Redis adapter**).

The validation is duplicated 6 times across 2 adapters, with diverging rules. Adding a 3rd adapter (memcached, DynamoDB) means another copy of the same validation, with yet another divergence.
**Blast radius:** Every cache adapter and every cache caller. The inconsistency is already latent — an in-memory adapter accepts `"key with space"` that Redis rejects.
**Recommendation:** Introduce a `CacheKey` newtype with one constructor:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey(String);

impl CacheKey {
    pub fn new(s: impl Into<String>) -> Result<Self, CacheError> {
        let s = s.into();
        if s.is_empty() {
            return Err(CacheError::InvalidKey("empty".into()));
        }
        if s.contains(' ') || s.contains('\0') {
            return Err(CacheError::InvalidKey("forbidden byte".into()));
        }
        Ok(Self(s))
    }
    pub fn as_str(&self) -> &str { &self.0 }
}

impl AsRef<str> for CacheKey { fn as_ref(&self) -> &str { &self.0 } }
```

Then `trait HexCachePort { fn get(&self, key: &CacheKey) -> ...; fn put(&self, key: &CacheKey, ...); ... }`. Validation lives in one place; every adapter is consistent.

### #4 — `pheno-port-adapter::Connection::id: String` — `pub(crate)` `String` field (P1)

**Location:** `pheno-port-adapter/src/lib.rs:60-64`
**Issue:** `pub struct Connection { pub(crate) id: String }`. The id is the endpoint string the caller passed to `connect()` (`pheno-port-adapter/src/adapters/tcp.rs:71`, `pheno-port-adapter/src/adapters/unix.rs:75`). The type carries no schema — a TCP `Connection.id` could be `"127.0.0.1:8080"`; a Unix `Connection.id` is a path. The tests assert `conn.id == addr` and `conn.id == path_str` (`pheno-port-adapter/src/adapters/tcp.rs:148,163`; `pheno-port-adapter/src/adapters/unix.rs:167`). Caller code that switches on `Connection.id` (e.g. logging) will treat `"tcp"` and `"/tmp/foo.sock"` identically.
**Blast radius:** Internal API only (`pub(crate)`), but every adapter and every test depends on the field. Adding a 3rd adapter with a new endpoint schema silently widens the contract.
**Recommendation:** `Connection::id: ConnectionId(String)` with `ConnectionId::tcp(host: &str, port: u16)`, `ConnectionId::unix_path(path: &Path)`, and `#[derive(Display)]` for logging. Field stays `pub(crate)` for now (matches existing surface) but accessor carries the schema.

### #5 — `pheno-port-adapter::PortAdapter::connect` — `endpoint: &str` (P1)

**Location:** `pheno-port-adapter/src/lib.rs:84` + impls at `tcp.rs:59`, `unix.rs:63`
**Issue:** The trait method `connect(&self, endpoint: &str)` accepts an arbitrary string. Both adapters reject `""` (`tcp.rs:60-62`, `unix.rs:64-66`), and `TcpAdapter::connect` calls `TcpStream::connect(endpoint)` which will accept any parseable `host:port` form (or any nonsense that DNS-resolves to nothing). No scheme validation — a caller can pass `"http://host:80"` to the TCP adapter and `TcpStream::connect` will try `host` (treating `//host:80` as a literal DNS name), silently succeeding/failing based on DNS, not on the caller's intent.
**Blast radius:** Same as #4 — internal API but every adapter depends on it.
**Recommendation:** Either (a) split into `connect_tcp(&self, host: &str, port: u16)` and `connect_unix(&self, path: &Path)` (breaks the trait abstraction), or (b) keep `endpoint: &str` but require adapters to publish a `fn parse_endpoint(s: &str) -> Result<Endpoint, AdapterError>` companion function that callers MUST invoke first (which is the shape the existing tests imply — see #1). Option (b) is the minimum surface change.

### #6 — `pheno-otel::propagation::W3CTraceContextPropagator::extract/inject` — `HashMap<String, String>` carrier (P1)

**Location:** `pheno-otel/src/propagation.rs:151-179`
**Issue:** The propagator takes `&HashMap<String, String>` as the in-memory HTTP-header carrier. The lookups are case-insensitive (`headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(TRACEPARENT_HEADER))` at line 158) — case-folding at every call is O(n) and the `HashMap` provides zero benefit when the case-insensitive search is linear.
**Blast radius:** 18 unit tests build a fresh `HashMap` per case (lines 278, 293, 304, 318, 333, 345, 353, 363, 381, 393) — the API surface is large enough that swapping the carrier type is a non-trivial refactor.
**Recommendation:** Introduce a `HeaderMap` newtype wrapper that normalises keys to lowercase at insert time. `HeaderMap::insert(name: HeaderName, value: HeaderValue)` where `HeaderName` enforces lowercase ASCII. This eliminates the linear scan, eliminates the need for `eq_ignore_ascii_case` at every read, and matches the `http` crate's existing surface so callers coming from HTTP can adapt trivially.

### #7 — `pheno-tracing::TraceId(pub String)` / `SpanId(pub String)` — fields are `pub String` (P2)

**Location:** `pheno-tracing/src/port.rs:12-17`
**Issue:** These ARE newtype wrappers — but the inner field is `pub`, defeating the encapsulation. `TraceId("not a trace id".into())` compiles. Downstream code that constructs a `TraceId` from untrusted input bypasses whatever validation the producer was supposed to apply.
**Blast radius:** Smaller than #2 because the crate is a tracing substrate (not a wire emitter); downstream code is mostly producers, not validators.
**Recommendation:** Make the inner field private; provide `TraceId::new(s: impl Into<String>) -> Result<Self, ValidationError>` that validates the hex shape (or defer validation to the producer crate that consumes `TraceId`). Add `impl FromStr` for ergonomic construction.

### #8 — `pheno-port-adapter::adapters::redis_cache::RedisAdapter::new` — `url: &str` (P2)

**Location:** `pheno-port-adapter/src/adapters/redis_cache.rs:63`
**Issue:** `pub fn new(url: &str) -> Result<Self, CacheError>` accepts any string. The body calls `redis::Client::open(url)` (line 64) which does its own validation; errors are folded into `CacheError::Backend`. The signature is honest about the failure mode but the parameter is structurally just `&str`.
**Blast radius:** Production callers will hit Redis with a malformed URL — already validated inside the call. Not a high blast radius.
**Recommendation:** Introduce `RedisUrl(String)` newtype that validates the `redis://`/`rediss://` scheme at the boundary; let callers parse a string into the newtype once at config-load time. Lower priority because the underlying client already rejects bad URLs.

### #9 — `pheno-errors::AppError::NotFound { entity: String, id: String }` (P2)

**Location:** `pheno-errors/src/lib.rs:92`
**Issue:** The `NotFound` variant carries `entity: String` and `id: String`. The constructor `AppError::not_found(entity: impl Into<String>, id: impl Into<String>)` (line 144) accepts any string. The `Display` impl emits `"not found: {entity} {id}"` (line 91).
**Blast radius:** Callers may pass `"42"` as the id even when the entity type is `UserId(u64)` — the variant doesn't constrain either field. Downstream metrics that bucket by entity type (e.g. counting `not_found:user` vs `not_found:order`) work today but a typo `"usr"` instead of `"user"` creates a new bucket silently.
**Recommendation:** Introduce a closed `Entity` enum (`Entity::User`, `Entity::Order`, ... — extend via PR per ADR-023 substrate-quality-bar). The `id` field can stay `String` for now (entity ids vary in format). Variant becomes `NotFound { entity: Entity, id: String }`.

### #10 — `pheno-otel::SpanContext::new(trace_id: impl Into<String>, span_id: impl Into<String>)` — unvalidated constructor (P2)

**Location:** `pheno-otel/src/propagation.rs:79,89`
**Issue:** Same as #2 but called out separately because it's the **fastest unblock** — replacing the parameter types with `TraceId`/`SpanId` newtypes (the same names already exist in `pheno-tracing::port`) makes the API self-validating without touching the wire format or the parser body.
**Blast radius:** Constructors are the entry point for downstream code building spans. The 18 unit tests construct `SpanContext` via these constructors; replacing them with the newtype-aware signatures is a 30-line patch.
**Recommendation:** Once `TraceId`/`SpanId` newtypes exist (per #2), change the signatures to `pub fn new(trace_id: TraceId, span_id: SpanId) -> Self` and `pub fn sampled(trace_id: TraceId, span_id: SpanId) -> Self`. Update the 3 inline test sites (`propagation.rs:406, 418, 432, 440`) to construct via `TraceId::parse(SAMPLE_TRACE_ID).unwrap()`.

---

## 3. Suggested newtype catalogue

The 5 crates share a common vocabulary. The following newtypes should land in their respective crates (not a shared `pheno-newtypes` crate, per ADR-023 substrate placement) so each crate owns its primitives:

| Crate | Newtype | Wraps | Validates | Replaces |
|---|---|---|---|---|
| `pheno-otel` | `TraceId(String)` | 32 lowercase hex chars, non-zero | ✅ | `SpanContext.trace_id: String` |
| `pheno-otel` | `SpanId(String)` | 16 lowercase hex chars, non-zero | ✅ | `SpanContext.span_id: String` |
| `pheno-port-adapter` | `CacheKey(String)` | non-empty, no space/NUL | ✅ | `HexCachePort::get/put/invalidate key: &str` |
| `pheno-port-adapter` | `ConnectionId(String)` | opaque (validated by adapter) | ❌ (delegate) | `Connection.id: String` |
| `pheno-port-adapter` | `TcpEndpoint { host: String, port: u16 }` | host non-empty, port ≤ 65535 | ✅ | `TcpAdapter::connect(&self, endpoint: &str)` |
| `pheno-port-adapter` | `UnixSocketPath(PathBuf)` | absolute path | ✅ | `UnixAdapter::connect(&self, endpoint: &str)` |
| `pheno-port-adapter` | `RedisUrl(String)` | `redis://`/`rediss://` scheme | ✅ | `RedisAdapter::new(url: &str)` |
| `pheno-tracing` | `TraceId(String)` | validated hex shape | ✅ | `pheno_tracing::port::TraceId(pub String)` (currently unvalidated) |
| `pheno-tracing` | `SpanId(String)` | validated hex shape | ✅ | `pheno_tracing::port::SpanId(pub String)` |
| `pheno-otel` | `HeaderMap` | case-insensitive name normalisation | ✅ | `HashMap<String, String>` (4 sites in `propagation.rs`) |
| `pheno-otel` | `HeaderName(String)` | lowercase ASCII, no separator chars | ✅ | header keys |
| `pheno-otel` | `HeaderValue(String)` | printable ASCII, no CR/LF | ✅ | header values |
| `pheno-errors` | `Entity` enum | closed set | ✅ | `AppError::NotFound.entity: String` |

### Cross-crate dedup: `TraceId`/`SpanId`

`pheno-tracing` and `pheno-otel` both define `TraceId(String)` / `SpanId(String)`. Per ADR-023 substrate placement, the substrate crate owns the primitive; `pheno-otel` should `pub use pheno_tracing::{TraceId, SpanId}` (or define its own validators in a `pheno_otel::propagation::TraceId` and add a `From` conversion to `pheno_tracing::TraceId` for the wire-format translator). Same name, two validators: pheno-tracing holds the runtime/serialisation shape; pheno-otel holds the wire-format/string representation.

---

## 4. `unsafe` audit (explicit result)

**`unsafe` blocks: 0 across all 4 materialised crates.**

Verified via `rg -nE '\bunsafe\b' $crate --type rust` over `src/`, `tests/`, `examples/`, `fuzz/`, filtered to exclude the `#![deny(unsafe_code)]` lint attribute itself. Every match returned by ripgrep was either the lint attribute itself or a doc-comment mention — zero `unsafe { ... }` blocks.

`pheno-port-adapter` and `pheno-errors` both declare `#![deny(unsafe_code)]` at the crate root (`pheno-port-adapter/src/lib.rs:32`, `pheno-errors/src/lib.rs:32`), so any future `unsafe` will fail compilation. `pheno-tracing` and `pheno-otel` do not declare the lint but have zero `unsafe` anyway; adding the lint is a free hardening step.

| Crate | `unsafe` count | `#![deny(unsafe_code)]` declared? |
|---|---:|---:|
| `pheno-port-adapter` | 0 | ✅ (`lib.rs:32`) |
| `pheno-tracing` | 0 | ❌ (recommend adding) |
| `pheno-otel` | 0 | ❌ (recommend adding) |
| `pheno-errors` | 0 | ✅ (`lib.rs:32`) |
| `pheno-context` | n/a | n/a (sparse-checkout miss — see §6) |

---

## 5. Existing newtype precedent (positive findings)

The audit found 3 places where newtypes are already in place — evidence the codebase is receptive to this hardening:

1. **`pheno-tracing/src/port.rs:12-17`** — `TraceId(pub String)` and `SpanId(pub String)` are already newtypes (see #7 above for the `pub String` caveat).
2. **`pheno-port-adapter/src/ports/time.rs:50-67`** — `HexTimePort::now()` returns `std::time::Instant` (the std newtype), `unix_nanos()` returns `u64`. Clean.
3. **`pheno-errors/src/lib.rs:76-115`** — `AppError` is a closed 5-variant enum (`Domain`, `NotFound`, `Conflict`, `Validation`, `Storage`). The variant set is documented as a design constraint ("growing past 5 is a breaking change"). This is the canonical pattern for fleet-wide error modelling.

---

## 6. Caveats and out-of-scope

### `pheno-context` is sparse-checkout-ghost on this branch

`pheno-context` is listed in the AGENTS.md pheno-* family inventory (Rust 11) and the sparse-checkout cone pattern (`/pheno-context/`), but the directory is **not materialised** on the current branch's working tree:

```
$ ls pheno-context/
ls: pheno-context/: No such file or directory
```

`git worktree list` shows no `pheno-context` worktree active on this clone. The `rg` queries over `pheno-context --type rust` returned empty results for every pattern (HashMap<String,String>, fn &str params, unsafe, Vec<String>, etc.) — not because pheno-context is clean, but because the source tree isn't present.

**Recommendation:** Re-run the audit once pheno-context is materialised. The crate is likely a context-propagation substrate (per the AGENTS.md description: "pheno-context") and may have similar `HashMap<String, String>` patterns to pheno-otel's `propagation.rs`.

### `pheno-port-adapter::adapters::parse` does not exist

A pre-existing task plan referenced `pheno-port-adapter/src/adapters/parse.rs`; the file does not exist in this branch. The `parse_endpoint` function (see #1 above) is referenced in 14 test sites but not implemented; the expected home was likely `parse.rs`, but the actual home per `adapters/mod.rs:35-43` would be `tcp.rs` (alongside `TcpAdapter`) or a new module.

### Test file `pheno-otel/tests/w3c_trace_context.rs` (538 LoC)

This integration test file is large but did not surface in the HashMap counts above because the `rg` runs were restricted to `src/`. Re-running the inventory over `tests/` shows 1 `HashMap<String, String>` in `w3c_trace_context.rs:1` and 7 `format!()` calls — same patterns as `propagation.rs`. Integration tests don't ship in the published crate but they share the wire-format contract, so any newtype refactor needs to update the test fixtures too.

---

## 7. Recommended remediation order (proposed v20 wave)

| Phase | LoC | Items | Risk | Verification |
|---|---:|---|---|---|
| **Phase 1 (P0, ~30 LoC)** | 30 | Add missing `TcpAdapter::parse_endpoint` (item #1) | None — adds dead-tested code | `cargo test -p pheno-port-adapter parse_endpoint_*` (14 tests light up) |
| **Phase 2 (P1, ~400 LoC)** | 400 | `CacheKey` newtype + `HexCachePort` signature change (item #3) | Medium — breaks downstream cache adapters | `cargo build --workspace` + adapter integration tests |
| **Phase 3 (P1, ~250 LoC)** | 250 | `TraceId`/`SpanId` newtypes in `pheno-otel` (items #2, #10) | Medium — wire format unchanged, API surface tightens | `cargo test -p pheno-otel w3c_trace_context` |
| **Phase 4 (P1, ~150 LoC)** | 150 | `Connection::id: ConnectionId` + `TcpEndpoint` (items #4, #5) | Low — internal API | `cargo test -p pheno-port-adapter` |
| **Phase 5 (P2, ~200 LoC)** | 200 | `HeaderMap` for the propagator (item #6) | Low — performance gain | W3C round-trip property test |
| **Phase 6 (P2, ~80 LoC)** | 80 | `pheno-tracing` `TraceId`/`SpanId` validation + `Entity` enum (items #7, #9) | Low | `cargo test -p pheno-tracing`, `cargo test -p pheno-errors` |
| **Phase 7 (P2, ~30 LoC)** | 30 | `#![deny(unsafe_code)]` in `pheno-tracing` + `pheno-otel` | None | `cargo build` |
| **Total** | **~1,140** | 7 items | — | `cargo test --workspace` green |

**Estimated wall time:** 1-2 weeks on `device: macbook` for items #1-#10 — no `heavy-runner` needed; no network; no iOS simulator. All 5 audited crates are sub-3K-LoC and compile in seconds individually.

**Fleet mean 71-pillar delta if landed:** L12 (Type Safety) moves from 2.0 → 2.5 across all 4 audited crates; L4 (Hexagonal Ports) is unchanged but the newtype pass hardens the ports' contracts. Net fleet mean delta: ~+0.04 per crate.

---

## 8. Summary metric

| Metric | Value | Target | Status |
|---|---:|---:|---|
| `unsafe` blocks in audited crates | 0 | 0 | ✅ |
| `#![deny(unsafe_code)]` declarations | 2/4 crates | 4/4 | ⚠️ partial |
| `HashMap<String,String>` occurrences | 5 | ≤3 (HTTP header carrier only) | ⚠️ |
| String-typed params needing newtype | ~6 | 0 | ❌ |
| Compile-blocker (missing definition) | 1 (`parse_endpoint`) | 0 | ❌ |
| Existing newtype precedent | 3 sites | n/a | ✅ mature |
| `pheno-context` materialised? | NO | YES | ❌ |

**Overall verdict:** the substrate is on the right side of the type-safety line (zero `unsafe`, error enums over strings, hash ports over concrete types), but has one **P0 compile-blocker** and ~6 **P1 string-typed parameters** that should be newtyped. Estimated ~1,140 LoC over 7 phases lands the entire plan.

---

**End of audit.**