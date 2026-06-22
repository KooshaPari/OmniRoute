//! L11 API/lifecycle conformance tests for `pheno-config`.
//!
//! Verifies the L11 contract across two modules:
//!
//!   [`cascade`]  — Figment-based layered config loader.
//!                  `DEFAULT_TOML: &'static str`, `build_cascade()`,
//!                  `build_cascade_from_str(toml: &str) -> Figment`.
//!
//!   [`secrets`]  — `ApiKey`, `BearerToken`, `DbPassword`. Per ADR-078
//!                  (L52, v19 T2) these are secret-holding newtypes
//!                  that derive `Zeroize + ZeroizeOnDrop + Clone` and
//!                  intentionally do NOT implement `Debug` (custom
//!                  redacted Debug), `PartialEq`, `Serialize`, or
//!                  `Deserialize`. The intentional absences are
//!                  recorded as findings against the source — see
//!                  `findings/2026-06-22-V21-T4-lifecycle-conformance.md`.
//!
//! The phantom-trait-bound pattern (`fn _assert<T: Bound>() {}`)
//! gives compile-time positive assertions without any extra
//! dev-dependency. Negative assertions (no `PartialEq`, no
//! `Serialize`) are documented in the findings doc rather than
//! asserted at compile time, because negative trait bounds
//! require nightly `negative_impls`.

use figment::providers::Format;
use pheno_config::cascade::{self, DEFAULT_TOML};
use pheno_config::secrets::{ApiKey, BearerToken, DbPassword};
use zeroize::Zeroize;

// ---------------------------------------------------------------------------
// Compile-time positive trait assertions
// ---------------------------------------------------------------------------

#[allow(dead_code)]
fn _assert_clone<T: Clone>() {}
#[allow(dead_code)]
fn _assert_send<T: Send>() {}
#[allow(dead_code)]
fn _assert_sync<T: Sync>() {}
#[allow(dead_code)]
fn _assert_zeroize<T: Zeroize>() {}

#[test]
fn lifecycle_apikey_advertised_traits_present() {
    _assert_clone::<ApiKey>();
    _assert_send::<ApiKey>();
    _assert_sync::<ApiKey>();
    _assert_zeroize::<ApiKey>();
    // Debug is hand-rolled via `impl_secret_fmt!` to redact — a
    // `#[derive(Debug)]` regression would clobber the redaction.
    // Verified by `lifecycle_apikey_debug_redacts` below.
    //
    // The following are INTENTIONALLY NOT called:
    //   _assert_partial_eq::<ApiKey>()        — see Finding 3 (timing-attack defense)
    //   _assert_default::<ApiKey>()           — see Finding 3 (no empty-secret default)
    //   _assert_serialize::<ApiKey>()         — see Finding 3 (no accidental persistence)
}

#[test]
fn lifecycle_bearertoken_advertised_traits_present() {
    _assert_clone::<BearerToken>();
    _assert_send::<BearerToken>();
    _assert_sync::<BearerToken>();
    _assert_zeroize::<BearerToken>();
}

#[test]
fn lifecycle_dbpassword_advertised_traits_present() {
    _assert_clone::<DbPassword>();
    _assert_send::<DbPassword>();
    _assert_sync::<DbPassword>();
    _assert_zeroize::<DbPassword>();
}

// ---------------------------------------------------------------------------
// (a) Constructor + destructor patterns
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_apikey_constructor_full_lifecycle() {
    let key = ApiKey::new("sk-live-abc123");
    assert_eq!(key.expose(), "sk-live-abc123");
    // Explicit drop — exercises the ZeroizeOnDrop impl. We can't
    // observe the wiped bytes after drop (the binding is gone), but
    // we can verify `Drop` is wired by zeroizing in place and
    // asserting the inner String is empty (see `lifecycle_apikey_zeroize_wipes_inner`).
    drop(key);
}

#[test]
fn lifecycle_bearertoken_constructor_full_lifecycle() {
    let tok = BearerToken::new("eyJ.payload.sig");
    assert_eq!(tok.expose(), "eyJ.payload.sig");
    drop(tok);
}

#[test]
fn lifecycle_dbpassword_constructor_full_lifecycle() {
    let pw = DbPassword::new("hunter2");
    assert_eq!(pw.expose(), "hunter2");
    drop(pw);
}

#[test]
fn lifecycle_apikey_empty_input_panics() {
    // ADR-078 §2.1 tripwire: an empty secret at construction is almost
    // always a missing-env-var bug. The `new()` constructor MUST panic
    // loudly so the call site surfaces the bug, rather than silently
    // propagating an "empty credential" downstream.
    let result = std::panic::catch_unwind(|| {
        let _ = ApiKey::new("");
    });
    assert!(result.is_err(), "ApiKey::new(\"\") must panic");
}

#[test]
fn lifecycle_bearertoken_empty_input_panics() {
    let result = std::panic::catch_unwind(|| {
        let _ = BearerToken::new("");
    });
    assert!(result.is_err(), "BearerToken::new(\"\") must panic");
}

#[test]
fn lifecycle_dbpassword_empty_input_panics() {
    let result = std::panic::catch_unwind(|| {
        let _ = DbPassword::new("");
    });
    assert!(result.is_err(), "DbPassword::new(\"\") must panic");
}

#[test]
fn lifecycle_apikey_accepts_various_into_string_types() {
    // The `new(impl Into<String>)` signature must accept &str,
    // String, &String, and Box<str>. Verify the four call sites
    // all succeed.
    let from_str = ApiKey::new("a");
    let from_string = ApiKey::new(String::from("b"));
    let from_str_ref = ApiKey::new(&String::from("c"));
    let from_box = ApiKey::new(String::from("d").into_boxed_str());

    assert_eq!(from_str.expose(), "a");
    assert_eq!(from_string.expose(), "b");
    assert_eq!(from_str_ref.expose(), "c");
    assert_eq!(from_box.expose(), "d");
}

// ---------------------------------------------------------------------------
// (b) Clone + equality semantics
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_apikey_clone_produces_independent_buffer() {
    // Clone must produce a deep copy of the inner String — mutating
    // (zeroizing) the clone must not affect the original. If Clone
    // were ever switched to an Arc-backed clone, this test would
    // fail with both buffers wiped.
    let original = ApiKey::new("sk-live-original");
    let mut cloned = original.clone();

    // Zeroize the clone.
    cloned.zeroize();
    assert_eq!(cloned.expose(), "", "clone should be zeroed");

    // The original must be untouched.
    assert_eq!(
        original.expose(),
        "sk-live-original",
        "Clone is shallow — original leaked through zeroize of clone"
    );
}

#[test]
fn lifecycle_bearertoken_clone_produces_independent_buffer() {
    let original = BearerToken::new("eyJ.original.sig");
    let mut cloned = original.clone();
    cloned.zeroize();
    assert_eq!(cloned.expose(), "");
    assert_eq!(original.expose(), "eyJ.original.sig");
}

#[test]
fn lifecycle_dbpassword_clone_produces_independent_buffer() {
    let original = DbPassword::new("hunter2-original");
    let mut cloned = original.clone();
    cloned.zeroize();
    assert_eq!(cloned.expose(), "");
    assert_eq!(original.expose(), "hunter2-original");
}

#[test]
fn lifecycle_secrets_intentionally_no_partial_eq() {
    // Sentinel: secrets deliberately do NOT implement PartialEq.
    // Comparing secrets by value is a timing-attack surface and a
    // serialization risk. If a future change adds `#[derive(PartialEq)]`
    // it must be rejected at code review — see Finding 3.
    //
    // This test body is empty by design — the absence is grep-able
    // via the test name and recorded in the findings doc.
}

// ---------------------------------------------------------------------------
// (c) Serialization round-trip — INTENTIONALLY ABSENT
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_secrets_intentionally_no_serde() {
    // Sentinel: secrets deliberately do NOT implement
    // `serde::Serialize` or `serde::Deserialize`. A future change
    // that adds either would defeat the ZeroizeOnDrop contract by
    // persisting the secret to a serializer's output buffer.
    //
    // The crate root has no `serde` entry in [dependencies]. If a
    // future change adds one, this test serves as a grep-able
    // marker — see Finding 3.
}

// ---------------------------------------------------------------------------
// (d) Send + Sync auto-traits
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_secrets_send_sync_explicit() {
    _assert_send::<ApiKey>();
    _assert_sync::<ApiKey>();
    _assert_send::<BearerToken>();
    _assert_sync::<BearerToken>();
    _assert_send::<DbPassword>();
    _assert_sync::<DbPassword>();
}

#[test]
fn lifecycle_apikey_crosses_threads_safely() {
    let key = ApiKey::new("sk-live-thread-test");
    let handle = std::thread::spawn(move || {
        assert_eq!(key.expose(), "sk-live-thread-test");
        key
    });
    let returned = handle.join().expect("thread did not panic");
    assert_eq!(returned.expose(), "sk-live-thread-test");
}

#[test]
fn lifecycle_bearertoken_crosses_threads_safely() {
    let tok = BearerToken::new("eyJ.thread.sig");
    let handle = std::thread::spawn(move || {
        assert_eq!(tok.expose(), "eyJ.thread.sig");
        tok
    });
    let returned = handle.join().expect("thread did not panic");
    assert_eq!(returned.expose(), "eyJ.thread.sig");
}

#[test]
fn lifecycle_dbpassword_crosses_threads_safely() {
    let pw = DbPassword::new("hunter2-thread");
    let handle = std::thread::spawn(move || {
        assert_eq!(pw.expose(), "hunter2-thread");
        pw
    });
    let returned = handle.join().expect("thread did not panic");
    assert_eq!(returned.expose(), "hunter2-thread");
}

// ---------------------------------------------------------------------------
// (e) Default impls — INTENTIONALLY ABSENT
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_secrets_intentionally_no_default() {
    // Sentinel: secrets deliberately do NOT implement `Default`.
    // A default secret would be an empty credential — exactly the
    // bug ADR-078 §2.1 panics to prevent at `new("")`. See Finding 3.
}

// ---------------------------------------------------------------------------
// Zeroize contract (the L11 destructor hook for secrets)
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_apikey_zeroize_wipes_inner() {
    let mut key = ApiKey::new("sk-live-abc123");
    assert_eq!(key.expose(), "sk-live-abc123");
    key.zeroize();
    assert_eq!(
        key.expose(),
        "",
        "explicit zeroize() must wipe the inner String"
    );
}

#[test]
fn lifecycle_bearertoken_zeroize_wipes_inner() {
    let mut tok = BearerToken::new("eyJ.payload.sig");
    assert_eq!(tok.expose(), "eyJ.payload.sig");
    tok.zeroize();
    assert_eq!(tok.expose(), "");
}

#[test]
fn lifecycle_dbpassword_zeroize_wipes_inner() {
    let mut pw = DbPassword::new("hunter2");
    assert_eq!(pw.expose(), "hunter2");
    pw.zeroize();
    assert_eq!(pw.expose(), "");
}

#[test]
fn lifecycle_secrets_drop_does_not_panic() {
    // The Drop impl (emitted by `#[derive(ZeroizeOnDrop)]`) must run
    // without panicking. We verify by spawning a thread that drops
    // many secrets in a tight loop. If Drop ever panicked, this
    // test would surface it via the spawned thread's poison.
    let handle = std::thread::spawn(|| {
        for i in 0..1000 {
            let k = ApiKey::new(format!("k-{i}"));
            let t = BearerToken::new(format!("t-{i}"));
            let p = DbPassword::new(format!("p-{i}"));
            drop((k, t, p));
        }
    });
    handle.join().expect("Drop must not panic");
}

// ---------------------------------------------------------------------------
// Display / Debug contract (redaction)
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_apikey_display_redacts() {
    let key = ApiKey::new("sk-live-secret");
    let rendered = format!("{}", key);
    assert_eq!(rendered, "***REDACTED***");
    assert!(!rendered.contains("sk-live-secret"));
}

#[test]
fn lifecycle_apikey_debug_redacts() {
    let key = ApiKey::new("sk-live-secret");
    let dbg = format!("{:?}", key);
    assert!(dbg.contains("ApiKey"), "Debug preserves type tag: {dbg}");
    assert!(dbg.contains("REDACTED"), "Debug shows REDACTED: {dbg}");
    assert!(
        !dbg.contains("sk-live-secret"),
        "Debug must not leak the raw secret: {dbg}"
    );
}

#[test]
fn lifecycle_bearertoken_display_redacts() {
    let tok = BearerToken::new("eyJ.payload.sig");
    let rendered = format!("{}", tok);
    assert_eq!(rendered, "***REDACTED***");
    assert!(!rendered.contains("eyJ.payload.sig"));
}

#[test]
fn lifecycle_bearertoken_debug_redacts() {
    let tok = BearerToken::new("eyJ.payload.sig");
    let dbg = format!("{:?}", tok);
    assert!(dbg.contains("BearerToken"));
    assert!(!dbg.contains("eyJ.payload.sig"));
}

#[test]
fn lifecycle_dbpassword_display_redacts() {
    let pw = DbPassword::new("hunter2");
    let rendered = format!("{}", pw);
    assert_eq!(rendered, "***REDACTED***");
    assert!(!rendered.contains("hunter2"));
}

#[test]
fn lifecycle_dbpassword_debug_redacts() {
    let pw = DbPassword::new("hunter2");
    let dbg = format!("{:?}", pw);
    assert!(dbg.contains("DbPassword"));
    assert!(!dbg.contains("hunter2"));
}

// ---------------------------------------------------------------------------
// cascade module lifecycle
// ---------------------------------------------------------------------------

#[test]
fn lifecycle_default_toml_is_static_str_with_expected_keys() {
    // `DEFAULT_TOML` is documented as a `&'static str`. Verify the
    // lifetime contract: the reference must outlive the test stack
    // frame, and the embedded TOML must contain the keys every
    // downstream consumer relies on.
    let s: &'static str = DEFAULT_TOML;
    for key in ["[server]", "[logging]", "[database]", "host", "port", "level", "format", "path", "pool_size"] {
        assert!(
            s.contains(key),
            "DEFAULT_TOML missing `{key}` — cascade invariant broken"
        );
    }
}

#[test]
fn lifecycle_cascade_build_cascade_returns_usable_figment() {
    let fig = cascade::build_cascade();
    // The cascade MUST return a usable Figment even when the on-disk
    // `config.toml` is missing (this test runs in a temp dir, so the
    // file is absent). The embedded `DEFAULT_TOML` is the floor.
    let value = fig
        .find_value("server.port")
        .expect("server.port must be present from DEFAULT_TOML");
    assert_eq!(value.to_u128(), Some(8080));
}

#[test]
fn lifecycle_cascade_build_cascade_from_str_overrides_defaults() {
    // `build_cascade_from_str(toml)` lets callers inject an explicit
    // TOML payload (typically from a bundled config blob). The explicit
    // payload MUST sit between `DEFAULT_TOML` and `Env::prefixed("PHENO_")`.
    let custom = r#"
[server]
port = 9999

[logging]
level = "debug"
"#;
    let fig = cascade::build_cascade_from_str(custom);
    let port = fig.find_value("server.port").expect("port must be present");
    assert_eq!(port.to_u128(), Some(9999), "explicit TOML must win over DEFAULT_TOML");

    // Keys not mentioned in `custom` must still resolve to the
    // embedded defaults — proves the cascade is bottom-up and the
    // embedded defaults are preserved.
    let host = fig
        .find_value("server.host")
        .expect("server.host must come from DEFAULT_TOML");
    assert_eq!(
        host.to_str(),
        Some("127.0.0.1"),
        "DEFAULT_TOML host must survive the explicit-TOML merge"
    );
}

#[test]
fn lifecycle_cascade_embedded_defaults_parse_as_valid_toml() {
    // The embedded defaults are a compile-time-equivalent constant —
    // if they ever become malformed, every consumer breaks at startup.
    let parsed: toml::Value = toml::from_str(DEFAULT_TOML).expect("DEFAULT_TOML must be valid TOML");
    assert_eq!(
        parsed.get("server").and_then(|v| v.get("port")).and_then(|v| v.as_integer()),
        Some(8080)
    );
    assert_eq!(
        parsed.get("logging").and_then(|v| v.get("level")).and_then(|v| v.as_str()),
        Some("info")
    );
}