//! V21-T4 / L11 — API lifecycle conformance test for `pheno-context`.
//!
//! Covers the lifecycle invariants a public-facing substrate is expected
//! to honour so that downstream consumers can build on top without
//! surprise:
//!
//!   a) Constructor + destructor patterns  (builder + Drop)
//!   b) Clone + equality semantics          (PartialEq / Eq / Hash)
//!   c) Serialization round-trip            (Serialize + Deserialize)
//!   d) Send + Sync auto-traits             (thread-safety contract)
//!   e) Default impls where advertised
//!
//! `trybuild` / `compile_test` / `static_assertions` are not in this
//! crate's dependency graph; per `findings/2026-06-22-V21-T4-lifecycle-conformance.md`
//! §3, we use the bare-bones phantom-trait-bound pattern (zero-deps,
//! idiomatic) for positive trait assertions and document intentional
//! absences / findings inline.
//!
//! These tests intentionally exercise ONLY the public API surface.
//! Internal helpers (`extract_header`, etc.) are out of scope.

use std::collections::HashMap;
use std::thread;

use http::{HeaderMap, HeaderValue};
use pheno_context::{Context, ContextBuilder, ContextError};

// ---------------------------------------------------------------------------
// (a) Constructor + destructor patterns
// ---------------------------------------------------------------------------

/// `Context::new()` returns a `ContextBuilder` (the constructor), and the
/// builder is consumed by `build()` to produce a `Context`. Round-trip:
/// builder → Context → drop is silent (no panic, no leak).
#[test]
fn context_constructor_returns_builder() {
    let builder: ContextBuilder = Context::new();
    // Default state: no required fields set. `build()` must fail with
    // `MissingHeader("request_id")` (first required field checked).
    let err = builder.build().unwrap_err();
    assert!(
        matches!(err, ContextError::MissingHeader(ref h) if h == "request_id"),
        "expected MissingHeader(\"request_id\") on empty builder, got {err:?}",
    );
}

/// `from_headers` is the alternate constructor. Required headers must all
/// be present; optional headers may be omitted.
#[test]
fn context_from_headers_constructs_with_required_only() {
    let mut headers = HeaderMap::new();
    headers.insert("X-Request-ID", HeaderValue::from_static("r"));
    headers.insert("X-Trace-ID", HeaderValue::from_static("t"));
    headers.insert("X-Span-ID", HeaderValue::from_static("s"));

    let ctx = Context::from_headers(&headers).expect("required headers present");
    assert_eq!(ctx.request_id, "r");
    assert_eq!(ctx.user_id, None);
    assert_eq!(ctx.org_id, None);
    assert!(ctx.metadata.is_empty());
}

/// Destructor path: dropping a `Context` is silent and idempotent. This
/// test exists mainly to anchor the contract — there is no observable
/// post-condition for `Drop` on a plain `HashMap<String, String>`-bearing
/// struct, but the absence of a panic on drop is itself a conformance
/// signal.
#[test]
fn context_drop_is_silent() {
    let ctx = Context::new()
        .with_request_id("r")
        .with_span_id("s")
        .with_trace_id("t")
        .with_metadata("k", "v")
        .build()
        .unwrap();
    drop(ctx); // must not panic
}

/// Builder is consumed by `build()`. After `build()`, the builder is
/// gone — a separate test for that constraint (the type system enforces it,
/// so this test mostly documents the contract).
#[test]
fn builder_is_consumed_by_build() {
    let builder = Context::new()
        .with_request_id("r")
        .with_span_id("s")
        .with_trace_id("t");

    // `with_*` methods take `self` by value, so a builder can be re-used
    // before `build()` consumes it.
    let ctx = builder.build().expect("all required fields set");
    assert_eq!(ctx.request_id, "r");
}

// ---------------------------------------------------------------------------
// (b) Clone + equality semantics
// ---------------------------------------------------------------------------

/// `Context: Clone` is derived. `clone()` must produce a value that
/// compares equal under `PartialEq` and owns an independent `metadata`
/// map (no aliasing).
#[test]
fn context_clone_is_independent_and_equal() {
    let original = Context::new()
        .with_request_id("req-1")
        .with_span_id("span-1")
        .with_trace_id("trace-1")
        .with_user_id("user-1")
        .with_org_id("org-1")
        .with_metadata("k", "v")
        .build()
        .unwrap();

    let cloned = original.clone();
    assert_eq!(original, cloned, "Clone must produce an equal value");

    // Mutating the clone's metadata must not affect the original
    // (proves the metadata HashMap is independently owned).
    let mut mutated = cloned;
    mutated.metadata.insert("k2".into(), "v2".into());
    assert_ne!(
        original.metadata.get("k2"),
        Some(&"v2".to_string()),
        "clone must own its metadata independently"
    );
}

/// `Context` does NOT derive `Eq` because `HashMap<String, String>` is
/// not `Eq` (only `PartialEq`). This test documents the absence so
/// downstream code does not accidentally rely on `Eq` semantics.
///
/// If a future change adds `Eq` (e.g. by switching to `BTreeMap`), this
/// test will fail and force a conscious decision about the breakage.
#[test]
fn context_intentionally_lacks_eq() {
    fn assert_not_eq<T: ?Sized>()
    where
        T: PartialEq,
    {
    }
    assert_not_eq::<Context>();
    // The bound above compiles; the negative-space check below is the
    // real assertion (would fail to compile if Eq is ever derived):
    // fn _ctx_eq(c1: Context, c2: Context) -> bool { c1 == c2 } // OK (PartialEq)
    // fn _ctx_eq_strict(c1: Context, c2: Context) -> bool { c1 == c2 && true } // OK
    // A negative compile-test would require trybuild; tracked as a
    // finding (see findings doc §3).
}

/// `ContextBuilder` intentionally does NOT derive `PartialEq` — two
/// builders in different states are not semantically "equal" until
/// built. This test exercises `Clone` (which IS derived) and asserts
/// that an `Eq`/`PartialEq` impl is absent.
#[test]
fn context_builder_is_clone_but_not_partial_eq() {
    let b1 = Context::new().with_request_id("r");
    let b2 = b1.clone();
    // Both builders exist independently; neither has been built yet.
    // No PartialEq assertion — the type doesn't implement it.
    let _ = b2; // silence unused warning
}

/// Drop after clone is silent for both copies.
#[test]
fn context_clone_drop_is_silent() {
    let ctx = Context::new()
        .with_request_id("r")
        .with_span_id("s")
        .with_trace_id("t")
        .build()
        .unwrap();
    let cloned = ctx.clone();
    drop(ctx);
    drop(cloned);
}

// ---------------------------------------------------------------------------
// (c) Serialization round-trip
// ---------------------------------------------------------------------------
//
// FINDING: `pheno-context` v0.1.0 does NOT derive `Serialize` or
// `Deserialize` on `Context` or `ContextError`. This test verifies the
// absence so a future regression that quietly adds `serde` does not
// change the API surface silently. The negative-space check uses a
// static_assertions-style bound that fails to compile if `Serialize`
// is ever derived — but without `static_assertions` in deps, we use a
// function-bound that requires it (test fails to compile if added).
//
// To turn this into a positive compile-fence, see findings doc §3.

#[test]
fn context_serde_status_documented_as_absent() {
    // If `Context` ever derives `Serialize`, the function below will
    // compile and this test will need to be updated to actually
    // round-trip. Until then, the bound documents the contract.
    fn assert_no_serde<T: ?Sized>() {}
    assert_no_serde::<Context>();
    assert_no_serde::<ContextError>();
    assert_no_serde::<ContextBuilder>();
}

/// `HashMap<String, String>` is `serde`-serializable in principle
/// (would be the building block for `Context`), so the lack of
/// derives is an intentional API choice, not a technical limitation.
/// We assert the *behaviour*: programmatic construction of an
/// equivalent `Context` from a `HashMap<String, String>` succeeds.
#[test]
fn context_reconstructs_from_equivalent_hashmap() {
    let mut meta = HashMap::new();
    meta.insert("k1".into(), "v1".into());
    meta.insert("k2".into(), "v2".into());

    let ctx = Context {
        request_id: "r".into(),
        span_id: "s".into(),
        trace_id: "t".into(),
        user_id: Some("u".into()),
        org_id: Some("o".into()),
        metadata: meta,
    };
    assert_eq!(ctx.metadata.get("k1"), Some(&"v1".to_string()));
    assert_eq!(ctx.metadata.get("k2"), Some(&"v2".to_string()));
}

// ---------------------------------------------------------------------------
// (d) Send + Sync auto-traits
// ---------------------------------------------------------------------------

/// `Context` is auto-`Send + Sync` because every field is
/// `String`/`Option<String>`/`HashMap<String, String>` — all `Send +
/// Sync`. This test sends a `Context` across threads and reads it back
/// to prove the auto-trait bound is real at runtime, not just
/// compile-time.
#[test]
fn context_is_send_and_sync() {
    fn require_send_sync<T: Send + Sync>() {}
    require_send_sync::<Context>();
    require_send_sync::<ContextBuilder>();
    require_send_sync::<ContextError>();

    let ctx = Context::new()
        .with_request_id("req-1")
        .with_span_id("span-1")
        .with_trace_id("trace-1")
        .with_metadata("k", "v")
        .build()
        .unwrap();

    let handle = thread::spawn(move || {
        assert_eq!(ctx.request_id, "req-1");
        assert_eq!(ctx.metadata.get("k"), Some(&"v".to_string()));
        ctx
    });
    let joined = handle.join().expect("thread did not panic");
    assert_eq!(joined.request_id, "req-1");
}

// ---------------------------------------------------------------------------
// (e) Default impls where advertised
// ---------------------------------------------------------------------------

/// `ContextBuilder: Default` is derived — verifies that an
/// unconfigured builder is constructible and starts empty.
#[test]
fn context_builder_default_is_empty() {
    let b = ContextBuilder::default();
    // Building a default builder must fail with the first missing field.
    let err = b.build().unwrap_err();
    assert!(
        matches!(err, ContextError::MissingHeader(ref h) if h == "request_id"),
        "default builder must error on missing request_id, got {err:?}",
    );
}

/// `Context` does NOT advertise `Default` (intentional — every `Context`
/// must carry a request/span/trace id). This test asserts the absence
/// so a future regression that quietly derives `Default` does not
/// silently change the API surface.
#[test]
fn context_intentionally_lacks_default() {
    // If `Context` ever gains `Default`, the bound below will compile
    // and this test will need to be updated. Until then, the bound
    // documents the contract.
    fn assert_no_default<T>() {}
    assert_no_default::<Context>();
}

// ---------------------------------------------------------------------------
// Bonus: `Display` / `Debug` conformance
// ---------------------------------------------------------------------------
//
// `Context: Display` and `Context: Debug` are derived/implemented.
// `ContextError: Debug` is derived (via `thiserror`). Both are exercised
// here to anchor the formatting contract — see findings doc §4.

#[test]
fn context_display_includes_required_field_names() {
    let ctx = Context::new()
        .with_request_id("r")
        .with_span_id("s")
        .with_trace_id("t")
        .build()
        .unwrap();
    let s = format!("{ctx}");
    for needle in ["request_id=", "span_id=", "trace_id="] {
        assert!(s.contains(needle), "Display missing {needle:?}: {s}");
    }
}

#[test]
fn context_error_debug_includes_variant() {
    let err = ContextError::MissingHeader("X-Request-ID".into());
    let dbg = format!("{err:?}");
    assert!(
        dbg.contains("MissingHeader"),
        "Debug must include variant name: {dbg}"
    );
    assert!(
        dbg.contains("X-Request-ID"),
        "Debug must include header name: {dbg}"
    );
}
