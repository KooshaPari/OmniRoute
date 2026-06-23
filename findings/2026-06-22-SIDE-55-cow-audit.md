# SIDE-55 — Cow vs clone audit (8 pheno-* crates)

**Date:** 2026-06-22
**Branch:** SIDE-55 (task-only, no branch — sub-task of v21 cycle-11 closure)
**Scope:** 8 canonical Rust substrate crates (`pheno-*` Rust family per AGENTS.md §"pheno-* family")
**Method:** `ripgrep` over `*.rs` for `.clone() / .to_string() / .to_vec() / String::from`, then per-site manual classification into `cow-suitable / false-positive / inherent`.
**Cow adoption in audited crates today:** **0** call sites use `Cow<'_, T>` (zero `use std::borrow::Cow` imports in any of the 8 crates' `src/` trees).

## Crates audited (8)

| # | Crate | LoC (`src/`) | Files | Total clone-ish sites¹ | Production sites² | Cow-suitable sites³ |
|---|-------|----:|---:|---:|---:|---:|
| 1 | `pheno-config` | 1,797 | 5 | 8 | 5 | **2** |
| 2 | `pheno-context` | 325 | 1 | 15 | 4 | **0** |
| 3 | `pheno-errors` | 693 | 2 | 17 | 5 | **4** |
| 4 | `pheno-flags` | 262 | 1 | 5 | 3 | **1** |
| 5 | `pheno-tracing` | 2,386 | 7 | 14 | 4 | **1** |
| 6 | `pheno-port-adapter` | 1,795 | 11 | 43 | 22 | **4** |
| 7 | `pheno-cli-base` | 369 | 4 | **0** | 0 | **0** |
| 8 | `pheno-otel` | 1,972 | 11 | 56 | 14 | **5** |
| **Total** | | **9,599** | **42** | **158** | **59** | **17** |

¹ every `.clone()`, `.to_string()`, `.to_vec()`, `String::from` site (includes tests + docstrings).
² non-test, non-docstring call sites in production code paths.
³ site where replacing with `Cow<'_, T>` (or `Arc<str>` / `&'static str`) is a clean win — see "Cow-suitable criteria" below.

### Cow-suitable criteria (what counts)

A site is "Cow-suitable" iff **all** of the following hold:

1. The cloned value's source is a **borrow** (`&str` / `&[T]` / `Cow` already) or a **short-lived owned value** (`String::trim() → &str`, `String` from a HashMap iteration, etc.).
2. The cloned value's destination is a struct field, function argument, or local that **could be typed as `Cow<'a, T>`** (or `Arc<str>` for shared ownership) without breaking the public API contract OR with a contained breaking change.
3. The site is on a **hot path** (request handler, telemetry span, cache op, parse path) OR the cloned value is **non-trivially large** (longer than a few bytes).
4. The site is **not** an error-construction literal (e.g. `"empty key".to_string()` inside an `Err(...)` constructor), which is infrequent by definition.

Excluded categories (intentionally not flagged as Cow candidates):

- **`Arc::clone()` calls** — atomic increment, no heap allocation. (`pheno-config/src/hot_reload.rs:23,55,287` `reloader.clone()` × 3.)
- **`redis::Client::clone()` / `ConnectionManager::clone()`** — internally `Arc`-backed, no allocation. (`pheno-port-adapter/src/adapters/redis_cache.rs:84,91,93,96`.)
- **HashMap internals** — `entry().or_insert(value.clone())` / `seen.entry(name.clone())` — borrow-checker idiom; Cow doesn't help here.
- **proptest `Strategy::clone()`** — `BoxedStrategy<T>` clone is a documented cheap operation in proptest's design (the inner state is `Arc`-shared). Idiomatic.
- **`Display::to_string()` on stdlib errors** — required by the `String` destination; cannot avoid without changing the error type wholesale.
- **Test code (`#[cfg(test)]`)** — non-production, not on the hot path.
- **Constructor-only string literals** (`"/v1/traces".to_string()` in `HttpExporter::traces(...)`) — once-per-process.

---

## Top 10 hot spots (ranked)

Each hot spot lists the **crate · file:line · current code · Cow-suitable replacement · frequency · est. impact**.

### #1 — `pheno-errors` · `src/rfc7807.rs:146,156,159,161` (4 sites)

```rust
// Current — src/rfc7807.rs:143-165 (impl From<&AppError> for Problem)
impl From<&AppError> for Problem {
    fn from(err: &AppError) -> Self {
        match err {
            AppError::Domain(msg) => Problem::new(500, "Internal Server Error", msg.clone())
                .with_type("about:blank"),
            // …
            AppError::Conflict(msg) => {
                Problem::new(409, "Conflict", msg.clone())
                    .with_type("https://errors.pheno.dev/conflict")
            }
            AppError::Validation(msg) => Problem::new(400, "Bad Request", msg.clone())
                .with_type("https://errors.pheno.dev/validation"),
            AppError::Storage(msg) => Problem::new(500, "Internal Server Error", msg.clone())
                .with_type("about:blank"),
        }
    }
}
```

`Problem` (line 50-82) stores `title: Option<String>` and `detail: Option<String>`. `Problem::new(...)` (line 92-100) takes `impl Into<String>` for both.

**Cow replacement:** change `Problem.title` and `Problem.detail` from `Option<String>` to `Option<Cow<'a, str>>` where `'a` matches `&'a AppError`'s lifetime. `impl Into<String>` becomes `impl Into<Cow<'a, str>>` for the borrowed constructor and `impl Into<Cow<'static, str>>` for the literal title paths. `Serialize` derivation handles `Cow<'a, str>` natively (serde serializes Cow::Borrowed as the borrowed str and Cow::Owned as the String).

**Frequency:** every `AppError → Problem` conversion — fires once per failed HTTP request that returns a Problem response. This is the **fleet-wide error path** (every consumer service uses `pheno-errors::Problem` for RFC 7807 responses).

**Est. impact:** **4 clones eliminated per error response.** For a service at 100 req/s with a 1% error rate, that's **4 allocations/s saved fleet-wide**. **HIGH.**

---

### #2 — `pheno-otel` · `src/propagation.rs:245-246` (2 sites)

```rust
// Current — src/propagation.rs:186-249 (parse_traceparent)
let trace_id = parts[1];   // &str, borrowed from `value: &str`
let span_id = parts[2];    // &str, borrowed from `value: &str`
// …
Ok(SpanContext {
    version,
    trace_id: trace_id.to_string(),   // ← alloc 1: 32-char hex
    span_id: span_id.to_string(),     // ← alloc 2: 16-char hex
    trace_flags,
})
```

`SpanContext` (line 55-70) stores `trace_id: String` and `span_id: String`. `parse_traceparent` is the canonical entry point for **every incoming HTTP request** that carries a `traceparent` header.

**Cow replacement:** change `SpanContext.trace_id` and `SpanContext.span_id` to `Cow<'a, str>` with a lifetime parameter on `SpanContext<'a>` (or, more invasively, into a non-generic `Cow<'static, str>` if you adopt a copy-on-parse semantic — but lifetime-generic is cleaner). The `inject(...)` path (line 169-179) still `format!`s into the output map, which is owned.

**Frequency:** once per incoming HTTP request at every service boundary. `propagation::parse_traceparent` is called by every cross-service hop.

**Est. impact:** **2 allocations saved per request.** At 1k req/s fleet-wide, **2k allocations/s saved**. **HIGH.**

---

### #3 — `pheno-otel` · `src/init.rs:112` (1 site, **pure waste**)

```rust
// Current — src/init.rs:97-114 (build_resource)
fn build_resource(service_name: &str) -> Result<Resource, OtelError> {
    let trimmed = service_name.trim();
    if trimmed.is_empty() {
        return Err(OtelError::resource_build(
            "service_name must be a non-empty, non-whitespace string",
        ));
    }
    Ok(Resource::new_with_defaults([KeyValue::new(
        "service.name",
        trimmed.to_string(),   // ← PURE WASTE: alloc 1, no benefit
    )]))
}
```

`opentelemetry::KeyValue::new` is generic over `impl Into<Value>` and `Value` accepts `Cow<'static, str>` directly. The `&str` from `trim()` is already `'a`-borrowed; passing it as `Cow::Borrowed(trimmed)` would not allocate. Even simpler: `KeyValue::new("service.name", trimmed.to_string())` can become `KeyValue::new("service.name", trimmed)` if `opentelemetry::Value::from(&str)` is implemented (it is).

**Frequency:** once per process startup (i.e. once per service lifetime). **Low call count, but the simplest, highest-confidence Cow win in the entire audit.**

**Est. impact:** **1 allocation saved per init.** Zero risk; not strictly a "Cow" change — just stop calling `.to_string()` on a `&str` that's already accepted by the callee. **HIGH (cleanliness score), LOW (frequency).**

---

### #4 — `pheno-otel` · `src/exporters/http.rs:75` (1 site)

```rust
// Current — src/exporters/http.rs:65-77 (OtlpPort::export impl)
fn export(&self, payload: &[u8]) -> Result<ExportHandle, OtlpError> {
    if payload.is_empty() {
        return Err(OtlpError::SerializeFailed("empty payload".to_string()));
    }
    Ok(ExportHandle {
        endpoint: self.target_url(),   // already returns String (via format!)
        service_name: self.config.service_name.clone(),  // ← alloc per export
    })
}
```

`ExporterConfig` (in `exporters/mod.rs`) stores `service_name: String`. Each `export()` call clones it into the returned `ExportHandle.service_name`.

**Cow replacement:** change `ExporterConfig.service_name` to `Arc<str>` (cheap clone via atomic increment) OR store the `service_name` directly in `ExportHandle` as `Cow<'static, str>` (since `service_name` is configured once at init). The cleanest path is `Arc<str>` because `ExporterConfig` is constructed once and read many times.

**Frequency:** once per OTLP export — called on every span batch flush.

**Est. impact:** **1 allocation saved per export** (typically batched, so ~1 / 5s per service). **MODERATE.**

---

### #5 — `pheno-otel` · `src/exporter/stdout.rs:47-54` (4 sites)

```rust
// Current — src/exporter/stdout.rs:43-55 (render)
fn render(span: &SpanData, seq: u64) -> String {
    let name = if span.name.is_empty() {
        format!("span#{seq}")
    } else {
        span.name.to_string()       // ← alloc 1: span.name is Cow<'static, str> already
    };
    let trace_id = span.span_context.trace_id().to_string();    // alloc 2
    let span_id = span.span_context.span_id().to_string();      // alloc 3
    let parent_span_id = if span.parent_span_id == SpanId::INVALID {
        String::new()
    } else {
        span.parent_span_id.to_string()    // alloc 4
    };
    // …
}
```

`SpanData.name` is **already typed as `Cow<'static, str>`** in the `opentelemetry_sdk` API. Calling `.to_string()` on it allocates when `Cow::Borrowed` (the common case). The `trace_id()` / `span_id()` / `parent_span_id()` return owned `String`s from the SDK, so `.to_string()` on those is cheap (no-op for owned), but the `name.to_string()` is a **clean Cow win**.

**Cow replacement:** for `name`, change `let name: &str` (or `Cow<'_, str>`) and pass `&name` to `push_kv` (line 64) which already takes `&str`. Eliminates 1 alloc per span. For the ID fields, no Cow benefit — they're owned `String`s.

**Frequency:** once per span per export when stdout exporter is active (typically dev / CI smoke tests, not prod).

**Est. impact:** **1 allocation saved per span (for name)** in the stdout path. **MODERATE.**

---

### #6 — `pheno-flags` · `src/lib.rs:206` (1 site, **loop over all keys**)

```rust
// Current — src/lib.rs:200-207 (snapshot)
pub fn snapshot(&self) -> BTreeMap<String, bool> {
    self.flags.iter().map(|(k, v)| (k.clone(), *v)).collect()
}
```

`snapshot()` is documented (line 49-65) as the observability/debug endpoint for the flag set. It clones **every key** in the underlying `HashMap<String, bool>`. For a flag set with N keys, that's N clones per call.

**Cow replacement:** return `BTreeMap<&str, bool>` (zero-copy, but tightens the lifetime to `&self`'s lifetime), OR `BTreeMap<Cow<'_, str>, bool>` (zero-copy for borrowed callers, owns for mutable consumers). The `BTreeMap<&str, bool>` form is the lowest-allocation option but requires callers to not outlive `&self`.

**Frequency:** per observability dump / per debug snapshot / per config-diff endpoint. Typically low (1 / minute), but the per-call cost is O(N flags).

**Est. impact:** **N clones saved per call** where N = flag count. For a service with 50 flags, **50 allocations saved per snapshot**. **MODERATE.**

---

### #7 — `pheno-port-adapter` · `src/adapters/{unix,tcp}.rs:73,75 / 69,71` (4 sites)

```rust
// Current — src/adapters/tcp.rs:59-72 (impl PortAdapter for TcpAdapter::connect)
fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError> {
    if endpoint.is_empty() {
        return Err(AdapterError::ConnectFailed("empty endpoint".to_string()));
    }
    let stream = TcpStream::connect(endpoint)
        .map_err(|e| AdapterError::ConnectFailed(format!("{endpoint}: {e}")))?;
    let mut state = self.inner.lock().expect("tcp adapter mutex poisoned");
    state.stream = Some(stream);
    state.endpoint = Some(endpoint.to_string());   // ← alloc 1: stores borrowed as owned
    Ok(Connection {
        id: endpoint.to_string(),                  // ← alloc 2: returns borrowed as owned
    })
}
// (identical pattern in src/adapters/unix.rs:63-77)
```

`endpoint: &str` is borrowed from the caller (typically a config file or env var), then cloned twice — once into `state.endpoint: Option<String>` (internal cache) and once into `Connection.id: String` (returned to caller).

**Cow replacement:** change `Connection.id` to `Cow<'_, str>` (with a lifetime parameter on `Connection<'a>`) — but this is a **public trait contract change** (`PortAdapter::connect` returns `Result<Connection, _>`). Alternatively, store `endpoint: Arc<str>` in the adapter state (cheap clone via atomic increment on every `connect` call) and return `Connection { id: Arc<str> }`.

**Frequency:** once per `connect()` call. Adapter reconnection is rare in prod (once at startup, occasionally on failover), so the **absolute call count is low**, but the **double-clone-per-call pattern is the textbook Cow win.**

**Est. impact:** **2 allocations saved per connect** (4 across unix + tcp). Low absolute, high cleanliness. **MODERATE-LOW.**

---

### #8 — `pheno-port-adapter` · `src/adapters/in_memory_cache.rs:94` (1 site)

```rust
// Current — src/adapters/in_memory_cache.rs:83-101 (HexCachePort::put)
async fn put(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError> {
    if key.is_empty() {
        return Err(CacheError::InvalidKey("empty key".to_string()));
    }
    let expires_at = if ttl.is_zero() { None } else { Some(Instant::now() + ttl) };
    let mut guard = self.inner.lock().await;
    guard.insert(
        key.to_string(),   // ← alloc per put: &str → String for HashMap key
        Entry { value, expires_at },
    );
    Ok(())
}
```

**Cow replacement:** change `inner: Arc<Mutex<HashMap<String, Entry>>>` to `Arc<Mutex<HashMap<Cow<'_, str>, Entry>>>` — callers passing `&'static str` keys (config-time keys, common in tests) clone zero times; callers passing `&str` from request data still pay one `to_string()`. The Cow form is strictly better.

**Frequency:** once per `put()` call. Cache writes can be hot in write-through patterns.

**Est. impact:** **1 allocation saved per put for `&'static str` keys.** **MODERATE.**

---

### #9 — `pheno-tracing` · `src/cardinality_cap.rs:218` (1 site, **per-overflow hot path**)

```rust
// Current — src/cardinality_cap.rs:189-224 (CardinalityCap::process, the per-span middleware)
pub fn process(&self, attrs: &mut HashMap<String, String>) -> CardinalityReport {
    // …
    for (name, value) in attrs.iter_mut() {
        // …
        if entry.len() < self.cap {
            entry.insert(value.clone());   // alloc per below-cap attribute
            report.kept += 1;
        } else {
            *value = self.overflow_marker.clone();   // ← alloc per overflowed attribute
            report.overflowed += 1;
        }
    }
}
```

The cardinality cap is the **fleet-standard span-attribute middleware** (per L26). It runs on **every span emission** in the fleet. The `self.overflow_marker.clone()` allocates a new `String` for every attribute that exceeds the cap. The `entry.insert(value.clone())` clones every below-cap value into the seen-set.

**Cow replacement:** change `CardinalityCap.overflow_marker` from `String` to `Arc<str>` (or `Cow<'static, str>`). Arc::clone is an atomic increment — no heap allocation. The seen-set itself (line 132 `HashMap<String, HashSet<String>>`) is harder to Cow because `HashSet<String>` membership testing wants owned `String`; the cleanest win is the overflow_marker only.

**Frequency:** once per span attribute that exceeds the cap. With cap=100 and reasonable attribute cardinality, most attributes don't overflow — but when they do, it's the **per-span telemetry hot path**.

**Est. impact:** **1 allocation saved per overflowed attribute** (1 per over-cap span attribute). **MODERATE** — bursts under cardinality pressure.

---

### #10 — `pheno-config` · `src/secret_rotation.rs:210,254` (2 sites)

```rust
// Current — src/secret_rotation.rs:196-262 (FileSource::fetch and EnvSource::fetch)
impl RotationSource for FileSource {
    fn fetch(&self) -> Result<ApiKey, RotationError> {
        let raw = fs::read_to_string(&self.path).map_err(|e| { /* … */ })?;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(RotationError::EmptyKey);
        }
        Ok(ApiKey::new(trimmed.to_string()))   // ← alloc 1: &str → String for ApiKey::new
    }
}
// (identical pattern in EnvSource::fetch at line 254)
```

`ApiKey::new` (in `src/secrets.rs`) takes `String` and zeroizes on drop (per ADR-078).

**Cow replacement:** change `ApiKey::new` to accept `impl Into<Arc<str>>` or `Cow<'_, str>` — the secret material must be owned eventually (it's a `ZeroizeOnDrop` newtype) but the **borrower's storage path doesn't need an owned `String` allocation**. `Arc<str>` works because `ZeroizeOnDrop` only requires the bytes to be exclusively owned for zeroize, which `Arc::strong_count == 1` guarantees.

**Frequency:** once per secret rotation. Secret rotation is rare (typically hourly or on-demand), so the **absolute call count is low**.

**Est. impact:** **1 allocation saved per rotate.** Low frequency, but the change aligns with ADR-078 (encryption-at-rest / zeroization) — the `Arc<str>` form makes the zeroize path explicit. **LOW-MODERATE.**

---

## Summary

- **17 Cow-suitable sites** across 6 of 8 audited crates. (2 crates — `pheno-context`, `pheno-cli-base` — have no actionable Cow candidates; their clones are proptest idioms or error-construction literals.)
- **Top 3 hot spots** (#1 `pheno-errors/rfc7807.rs`, #2 `pheno-otel/propagation.rs`, #3 `pheno-otel/init.rs`) account for **7 of the 17 sites** and are on the **fleet-wide request / telemetry hot path**.
- **Estimated savings fleet-wide** (back-of-envelope): ~10–20 allocations per typical request (1 Problem clone + 2 SpanContext clones + 1 stdout name clone + 1 service_name clone + 1 endpoint clone × N adapters + 1 in-memory cache put) — material for high-RPS services.
- **Zero `Cow` adoption today** in the audited crates. The substrate is a clean slate for this pattern.
- **No new external dependencies needed** — `std::borrow::Cow` is in `std::prelude` (no Cargo.toml change).

### Recommended adoption order (next cycle, e.g. v22-cycle-12 P1 candidate)

| Prio | Crate | Site | Why |
|------|-------|------|-----|
| P0 | `pheno-otel` | `src/init.rs:112` | Pure waste; 1-line change; zero risk. |
| P0 | `pheno-errors` | `src/rfc7807.rs:146,156,159,161` | Fleet-wide error path; 4 clones/request. |
| P1 | `pheno-otel` | `src/propagation.rs:245,246` | Per-request span-id parsing; 2 clones/request. |
| P1 | `pheno-otel` | `src/exporter/stdout.rs:47` | span.name is already Cow; trivial dedup. |
| P2 | `pheno-flags` | `src/lib.rs:206` | Snapshot loop; bounded by flag count. |
| P2 | `pheno-port-adapter` | `adapters/{unix,tcp}.rs:73,75 / 69,71` | Cleanliness; trait-contract invasive. |
| P2 | `pheno-tracing` | `src/cardinality_cap.rs:218` | Per-overflow, low frequency in steady state. |
| P3 | `pheno-port-adapter` | `adapters/in_memory_cache.rs:94` | Cache write path; modest gain. |
| P3 | `pheno-otel` | `src/exporters/http.rs:75` | Per-export; low frequency (batched). |
| P3 | `pheno-config` | `src/secret_rotation.rs:210,254` | Rare path; aligns with ADR-078. |

### Out of scope (explicitly excluded)

- **`pheno-config/src/hot_reload.rs:23,55,287`** — `reloader.clone()` is `Arc::clone`, atomic increment, no heap allocation. **No Cow benefit.**
- **`pheno-port-adapter/src/adapters/redis_cache.rs:84,91,93,96`** — `redis::Client::clone()` and `ConnectionManager::clone()` are internally `Arc`-backed. **No Cow benefit.**
- **`pheno-tracing/src/cardinality_cap.rs:198,211`** — `seen.entry(name.clone())` and `entry.insert(value.clone())` are HashMap internals; the seen-set's `HashMap<String, HashSet<String>>` requires owned keys. **No Cow benefit** without changing the seen-set data structure (which is a much bigger refactor).
- **`pheno-context/src/lib.rs:108-111`** — `id_strat.clone()` × 3 in proptest `Arbitrary` impl. `BoxedStrategy<T>::clone()` is an idiomatic, documented cheap operation in proptest's design (internally `Arc`-shared). **No Cow benefit.**
- **Error-construction literals** (`"empty key".to_string()`, `"empty endpoint".to_string()`, `"not connected".to_string()`, etc.) — these are infrequent by definition (only on the error path) and the cost is dwarfed by the actual error condition. **Excluded by Cow-suitable criterion #4.**
- **Test code** (`#[cfg(test)]` modules) — not on the production hot path; auditing it would inflate the numbers without actionable insight.

### Methodology notes

- **Tooling:** `ripgrep` (`rg -En "\.clone\(\)|\.to_string\(\)|\.to_vec\(\)|String::from"`) across `src/` for each crate, followed by per-site file:line inspection.
- **Source-of-truth:** AGENTS.md §"pheno-* family (22 visible)" Rust subset (11 crates listed; 8 audited = the canonical substrate after excluding `pheno-agents-md` (worklog-format spec) and `pheno-cargo-template` (scaffolding-only) — neither has production runtime code where Cow would apply).
- **Companion document:** this audit complements `L42 cheap-llm-mcp archive` (no Cow migration in that archive scope) and the v22-T1 fleet substrate audit (`findings/2026-06-21-v22-T1-fleet-substrate-audit.md` — does not score Cow adoption; this audit closes the gap).
