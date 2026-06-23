# SIDE-62 — Serde zero-copy deserialization audit

**Date:** 2026-06-22
**Branch:** `docs/v21-l15-slo-2026-06-22` (working tree)
**Scope:** 8 pheno-* Rust substrate crates that use `serde` in their dependency graph
**Method:** Direct read of every `Cargo.toml` + every `src/*.rs` file in the
canonical pheno-* substrate set, plus `git ls-files` cross-check, plus
`#[derive(Deserialize)]` / `#[derive(Serialize)]` ripgrep.

---

## 1. TL;DR — per-crate opportunity count

| # | Crate              | `serde` form in `Cargo.toml`                              | `#[derive(Deserialize)]` sites | Raw `&'de str` opportunities |
|---|--------------------|-----------------------------------------------------------|--------------------------------|------------------------------|
| 1 | `pheno-cli-base`   | none                                                      | 0                              | **0**                        |
| 2 | `pheno-config`     | transitive via `figment = { ..., features = [...] }`      | 0                              | **0**                        |
| 3 | `pheno-context`    | none                                                      | 0                              | **0**                        |
| 4 | `pheno-errors`     | direct: `serde = { version = "1", features = ["derive"] }` | 0 (`Serialize` only on `Problem`) | **0**                   |
| 5 | `pheno-flags`      | direct: `serde = { version = "1", features = ["derive"] }` | 0 (explicit comment: *"FlagSet itself does not derive Serialize/Deserialize"*) | **0** |
| 6 | `pheno-otel`       | direct: `serde = { version = "1.0", features = ["derive"] }` | 3 (`Route`, `Status`, `HistogramSnapshot`) | **0** (no `String` fields — unit enums + numeric snapshot) |
| 7 | `pheno-port-adapter` | dev-dep only: `serde_json = "1"` (Pact contract test)   | 0                              | **0**                        |
| 8 | `pheno-tracing`    | direct: `serde = { version = "1.0", features = ["derive"] }` | 6 (`TraceId`, `SpanId`, `SpanKind`, `TraceOperation`, `TraceResult`, `TraceStatus`) | **5** |
| — | **TOTAL (8 crates)** | 5 direct + 1 transitive + 2 absent | **9 Deserialize sites** | **5 borrow opportunities** |

> **Bonus (not in the AGENTS.md canonical 8):** `pheno-events` adds **2 more
> opportunities** (`event_type`, `source` on `EventEnvelope`), bringing the
> audited fleet total to **7 raw `&'de str` opportunities across 3 crates**.

---

## 2. Per-crate deep dive

### 2.1 `pheno-cli-base` — **0 opportunities**

`Cargo.toml` deps: `clap` (with `derive`, `env`), `tracing`, `tracing-subscriber`. No `serde`.

`clap`'s `derive` feature pulls `serde` transitively (for `clap::ValueEnum` and env-var parsing), but no `pheno-cli-base` type derives `Serialize` or `Deserialize`. Nothing to borrow.

### 2.2 `pheno-config` — **0 opportunities**

`Cargo.toml` deps: `zeroize`, `figment = { features = ["toml", "env", "yaml"] }`, `toml`, `arc-swap`, `signal-hook`, `crossbeam-channel`, `tempfile`. No direct `serde` dep.

`figment` brings `serde` in for its provider-cascade machinery, but every `pheno-config` own type (`ApiKey`, cascade config, etc.) is constructed via figment *deserializing into a target type defined inside `figment` itself*, not into a pheno-config struct. Ripgrep across `pheno-config/src/{cascade.rs,lib.rs,secrets.rs}` returns zero matches for `Deserialize` or `derive(Serialize)`.

### 2.3 `pheno-context` — **0 opportunities**

`Cargo.toml` deps: `thiserror`, `http`, `proptest`. No `serde`. The `Context` builder is a pure in-memory construct; consumers can serialize the `Context` *themselves* via a 3rd-party shim, but the type does not opt in.

### 2.4 `pheno-errors` — **0 opportunities**

`Cargo.toml` has `serde = { version = "1", features = ["derive"] }` (direct).

Audit of `src/lib.rs:76` and `src/rfc7807.rs:50`:

- `AppError` enum: `#[derive(Debug, thiserror::Error)]` only — **no `Serialize` or `Deserialize`**.
- `Problem` struct (RFC 7807): `#[derive(Debug, Clone, PartialEq, Eq, Serialize)]` — **`Serialize` only**, no `Deserialize`.

`Problem` has 5 `String`-typed fields (`problem_type`, `title`, `detail`, `instance`, all `Option<String>`); these are output-only — the crate publishes problems, it does not consume them. No borrow target.

### 2.5 `pheno-flags` — **0 opportunities**

`Cargo.toml` has `serde = { version = "1", features = ["derive"] }` and `serde_json = "1"` (direct).

Audit of `src/lib.rs`:

- `FlagSet` struct (`pheno-flags/src/lib.rs:94`): `#[derive(Debug, Clone, Default, PartialEq, Eq)]` — no `Serialize`/`Deserialize`.
- `FlagError` enum (`pheno-flags/src/lib.rs:73`): `#[derive(Debug, Error, PartialEq, Eq)]` — no `Serialize`/`Deserialize`.

The crate author left a deliberate breadcrumb in `tests/proptest_arbitrary.rs:12`:
> `Note: FlagSet itself does not derive Serialize/Deserialize`.

`serde` is in `Cargo.toml` because the planned `snapshot()` `BTreeMap<String, bool>` output is meant to be serialized by the *caller* via `serde_json` (a transitively-available dep), not by the crate. The `serde = { features = ["derive"] }` dep is a forward-compat stub.

### 2.6 `pheno-otel` — **0 opportunities (3 Deserialize sites, 0 borrowable fields)**

`Cargo.toml` has `serde = { version = "1.0", features = ["derive"] }` (direct).

Audit of `src/histogram.rs`:

- `Route` enum (`pheno-otel/src/histogram.rs:47`): `#[derive(..., Serialize, Deserialize)]` — 6 unit variants, **no `String` payload**.
- `Status` enum (`pheno-otel/src/histogram.rs:78`): `#[derive(..., Serialize, Deserialize)]` — 3 unit variants, **no `String` payload**.
- `HistogramSnapshot` struct (`pheno-otel/src/histogram.rs:210`): `#[derive(Debug, Clone, Serialize, Deserialize)]` — fields are `Vec<u64>` + `u64`, **no `String`**.

Zero `String`/`&'de str` opportunities. The crate is already at peak zero-copy
for its Deserialize types — all field types are primitives.

### 2.7 `pheno-port-adapter` — **0 opportunities**

`Cargo.toml` has `serde_json = "1"` **in `[dev-dependencies]` only** (line 41). No `[dependencies]` `serde`. The dep exists to back the Pact consumer-driven contract test (`tests/contracts/provider_cache_hex_port_pact.rs`); no production `pheno-port-adapter` type derives `Deserialize`.

### 2.8 `pheno-tracing` — **5 opportunities (6 Deserialize sites)**

`Cargo.toml` has `serde = { version = "1.0", features = ["derive"] }` (direct).

Audit of `src/port.rs`:

| # | Type / site                                | Field                        | Type         | Could be `&'de str` with `#[serde(borrow)]`? |
|---|--------------------------------------------|------------------------------|--------------|------------------------------------------------|
| 1 | `TraceId` newtype (`port.rs:13`)           | `pub String`                 | newtype wrap | **Yes** — `TraceId(pub &'de str)` + `#[serde(borrow)]` on the struct |
| 2 | `SpanId` newtype (`port.rs:17`)            | `pub String`                 | newtype wrap | **Yes** — same shape as `TraceId`             |
| 3 | `SpanKind` enum (`port.rs:21`)             | 5 unit variants              | enum         | **No** — no `String` payload                   |
| 4 | `TraceOperation.name` (`port.rs:36`)       | `String`                     | struct field | **Yes** — `pub name: &'de str` + `#[serde(borrow)]` on the field |
| 5 | `TraceOperation.attributes` (`port.rs:37`) | `HashMap<String, String>`    | struct field | **Yes (value-side)** — `HashMap<String, &'de str>` with `#[serde(borrow)]` on the field; key-side `String` borrow is the `Borrow` trait's job (no annotation needed) |
| 6 | `TraceResult` (`port.rs:42`)               | 3 fields (id-wrappers + status) | struct     | **No new** — wraps `TraceId`, `SpanId`, `TraceStatus` (all counted below) |
| 7 | `TraceStatus::Error` variant (`port.rs:52`) | tuple variant `Error(String)` | enum       | **Yes** — `Error(&'de str)` with `#[serde(borrow)]` on the variant |
| 8 | `TracePort` trait (`port.rs:60`)           | trait method `submit`        | trait        | **N/A** — not a Deserialize type               |

**Unique raw `&'de str` opportunities: 5**
(`TraceId`, `SpanId`, `name`, `attributes` value, `TraceStatus::Error`).

#### Migration cost (pheno-tracing)

These 5 opportunities are **non-trivial** to land because the rest of the
crate ecosystem would have to accept the new lifetimes:

- `TraceId`/`SpanId` are currently `pub String` (newtype with public field). Changing to `TraceId<'de>(pub &'de str)` forces every call site that does `TraceId(s.into())` to use `Cow<'_, str>` or own-then-borrow. Existing `Arbitrary` impls (`port.rs:107-133`) already produce owned `String`; those keep working, but the produced value can't directly be assigned to a `&'de str` field without re-borrowing from the strategy result.
- `TraceOperation::name` is passed to adapters (OTLP exporter, stdout, in-memory) that may want to keep the string around for a batch. Borrowing means the OTLP batcher can't outlive the input slice — this is the **classic "borrow only works for transient pipelines" caveat**.
- `TraceStatus::Error(&'de str)` similarly has lifetime implications for the trait return type `TraceResult`.

**Recommended approach:** introduce a `pheno-tracing::borrowed` feature-gated
module with `TraceOpBorrowed<'de>`, `TraceStatusBorrowed<'de>`, etc. — only the
in-memory + stdout adapters enable the feature. OTLP exporter stays on owned
`String` (it needs to flush async batches past the input lifetime). This is a
forward-compat pattern; see serde docs §"Borrow" for the canonical recipe.

---

## 2.bonus `pheno-events` — **2 opportunities** (1 Deserialize site)

Not in the AGENTS.md canonical 8 but present in the monorepo. `Cargo.toml` has
`serde = { version = "1", features = ["derive"] }` (direct).

Audit of `src/core/mod.rs:34-44`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub id: Uuid,
    pub event_type: String,        // <-- opportunity 1
    pub source: String,            // <-- opportunity 2
    pub timestamp: DateTime<Utc>,
    pub causation_id: Option<Uuid>,
    pub correlation_id: Option<Uuid>,
    pub schema_version: u32,
    pub payload: Value,
}
```

**2 opportunities** — `event_type` and `source` could be `&'de str` with
`#[serde(borrow)]` on the struct.

#### Migration cost (pheno-events)

**High** — `EventEnvelope` is the *primary wire type* of the events substrate
and is:

1. Constructed via `EventEnvelope::new(event_type: impl Into<String>, source: impl Into<String>, ...)` (`core/mod.rs:162`), which takes owned `String` and stores it.
2. Validated post-construction via `validate_event_type(&self.event_type)` (`core/mod.rs:189`).
3. Cloned across service boundaries — pubsub topics, schema-registry handshakes, etc. all rely on owned `String`.
4. Subject to an `Arbitrary` impl that generates owned `String` (`core/mod.rs:113-116`).

Borrowing `event_type`/`source` would force every consumer to either
(a) immediately `.to_owned()` after deserialize (defeats the point), or
(b) thread a lifetime through the events pubsub — which is a substantial
architectural change to the substrate.

**Recommendation:** **Do NOT apply `#[serde(borrow)]` to `EventEnvelope` in
this cycle.** The cost outweighs the benefit unless/until `EventEnvelope`
becomes a transient "just-deserialized, immediately consumed" type (e.g., a
streaming validator).

---

## 3. Cross-cutting analysis

### 3.1 Where the opportunities actually live

- **5/7 opportunities are in `pheno-tracing`** (the OTLP wire-format substrate). This is consistent with pheno-tracing's role: it sits at the network ingress/egress boundary, so deserializing off a contiguous `&[u8]` buffer is the canonical hot path.
- **2/7 opportunities are in `pheno-events`** (`EventEnvelope.event_type` + `source`). High migration cost; recommend defer.
- **0/7 opportunities are in the 6 other pheno-* crates** — they either don't derive `Deserialize` at all, or their Deserialize types have no `String` fields.

### 3.2 The `&'de str` vs `Cow<'_, str>` trade-off

`#[serde(borrow)]` on a field only works when:
1. The deserializer input is a single contiguous byte slice (e.g., `serde_json::from_slice(&[u8])` or `from_str(&str)`).
2. The lifetime `'de` is shorter than the borrow of the input.

It does **not** work with `serde_json::from_reader` (which streams) — that path would error at deserialize time. Callers that stream must stick to owned `String`.

**This is the load-bearing caveat for `pheno-tracing`**: the OTLP exporter pipeline is `from_slice(&bytes)`-style today, so borrowing is viable *if* the buffer lives for the duration of `submit()`. If any future adapter wants to ingest from a streaming source, it must clone to `String` before submitting.

### 3.3 The `&'static str` for `as_str()` returns — already correct

`pheno-otel/src/histogram.rs:64-73` and `:89-95` already return `&'static str` from the `Route::as_str()` / `Status::as_str()` accessors. These are not Deserialize types, so no change needed — but it confirms the crate is zero-copy-friendly on the read side.

---

## 4. Recommendations

1. **`pheno-tracing` T1** (P1, ~300 LoC, **macbook** device) — add a feature-gated `borrowed` module exposing `TraceId<'de>`, `SpanId<'de>`, `TraceOperation<'de>`, `TraceStatus<'de>`, all annotated with `#[serde(borrow)]`. Land in a v23-cycle-13 P1 track. **5 opportunities covered.**
2. **`pheno-events`** — **defer** with a comment in the `EventEnvelope` docstring pointing at this finding. Migration cost is high and the current owned-`String` design is correct for the pubsub use case.
3. **The other 6 pheno-* crates** — **no action**; either zero Deserialize sites or zero borrowable fields.
4. **Substrate quality bar (ADR-042B) implication:** add a `serde.borrow` row to the per-crate scorecard, scored 0 (no opportunity), 1 (opportunity identified but deferred), 2 (feature-gated module exists), 3 (default-on borrow across the crate). `pheno-tracing` would go from 0 → 2 after T1.

---

## 5. Verifier checklist (closure criteria)

- [x] All 8 pheno-* crates' `Cargo.toml` `serde` status read directly.
- [x] Every `src/*.rs` file ripgrepped for `derive(Deserialize)`.
- [x] Every `derive(Deserialize)` site enumerated with field-level `String` count.
- [x] `pheno-events` flagged as bonus (outside canonical 8).
- [x] Migration cost assessed per opportunity.
- [x] Forward-compat path (feature-gated `borrowed` module) sketched for pheno-tracing.
- [x] Caveats (streaming deser, lifetime threading, Arbitrary) called out.

**Audit status:** COMPLETE 2026-06-22 (this turn). Ready for cycle-13 planning
intake as P1 track candidate.
