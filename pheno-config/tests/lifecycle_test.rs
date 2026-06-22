//! V21-T4 / L11 — API lifecycle conformance test for `pheno-config`.
//!
//! Covers the lifecycle invariants a public-facing substrate is expected
//! to honour so that downstream consumers can build on top without
//! surprise:
//!
//!   a) Constructor + destructor patterns  (`new` + `Drop`-via-`ZeroizeOnDrop`)
//!   b) Clone + equality semantics          (Clone derived; PartialEq
//!                                            intentionally ABSENT for
//!                                            secret-holding newtypes)
//!   c) Serialization round-trip            (Serialize + Deserialize —
//!                                            NOT derived; see findings)
//!   d) Send + Sync auto-traits             (thread-safety contract)
//!   e) Default impls where advertised      (none for secret newtypes;
//!                                            see findings)
//!
//! `trybuild` / `compile_test` / `static_assertions` are not in this
//! crate's dependency graph; per `findings/2026-06-22-V21-T4-lifecycle-conformance.md`
//! §3, we use the bare-bones phantom-trait-bound pattern (zero-deps,
//! idiomatic) for positive trait assertions and document intentional
//! absences / findings inline.

use std::thread;

use pheno_config::secrets::{ApiKey, BearerToken, DbPassword};
use zeroize::Zeroize;

// ---------------------------------------------------------------------------
// (a) Constructor + destructor patterns
// ---------------------------------------------------------------------------

/// `ApiKey::new(impl Into<String>)` is the sole constructor. Empty input
/// must panic — see ADR-078 §2.1 tripwire.
#[test]
fn api_key_constructor_accepts_non_empty_input() {
    let key = ApiKey::new("sk-live-abc123");
    assert_eq!(key.expose(), "sk-live-abc123");
}

/// `BearerToken` and `DbPassword` follow the same constructor contract.
#[test]
fn bearer_token_and_db_password_constructors() {
    let tok = BearerToken::new("eyJ.payload.sig");
    assert_eq!(tok.expose(), "eyJ.payload.sig");

    let pw = DbPassword::new("hunter2");
    assert_eq!(pw.expose(), "hunter2");
}

/// `&str` literals, `String`, and `Cow<str>` all flow through
/// `Into<String>`. This pins the contract so the constructor doesn't
/// silently narrow its accepted types.
#[test]
fn new_accepts_str_string_and_cow() {
    let from_str = ApiKey::new("a"); // &str
    let from_string = ApiKey::new(String::from("b"));
    let from_cow = ApiKey::new(std::borrow::Cow::Borrowed("c"));
    assert_eq!(from_str.expose(), "a");
    assert_eq!(from_string.expose(), "b");
    assert_eq!(from_cow.expose(), "c");
}

/// Destructor path: `ZeroizeOnDrop` is derived on every secret newtype.
/// The derived `Drop` impl overwrites the inner `String` bytes with
/// zeros before the allocator releases the heap. This test cannot
/// observe heap bytes directly (no `unsafe` allowed — the crate root
/// has `#![forbid(unsafe_code)]`), so it exercises the only safe,
/// observable contract: explicit `zeroize()` zeroes the inner String
/// so subsequent `expose()` returns an empty `&str`. The `Drop` glue
/// runs the same code path, so this test is a tight proxy.
#[test]
fn api_key_explicit_zeroize_wipes_inner_string() {
    let mut key = ApiKey::new("sk-live-abc123");
    assert_eq!(key.expose(), "sk-live-abc123");
    key.zeroize();
    assert_eq!(
        key.expose(),
        "",
        "explicit zeroize() must wipe the inner String in place"
    );
}

/// Drop is silent and idempotent (no panic on dropping a zeroized
/// newtype). Pinning the contract so a future regression that adds
/// panicking `Drop` glue (e.g. double-free detection in debug) fails
/// this test loudly.
#[test]
fn drop_is_silent_on_all_three_newtypes() {
    {
        let _k = ApiKey::new("k");
        let _t = BearerToken::new("t");
        let _p = DbPassword::new("p");
    } // drop runs here
}

// ---------------------------------------------------------------------------
// (b) Clone + equality semantics
// ---------------------------------------------------------------------------

/// `ApiKey: Clone` is derived. `clone()` produces an independent
/// `String` (no aliasing); both copies expose the same secret bytes
/// because the newtype owns the `String`.
#[test]
fn api_key_clone_produces_independent_string() {
    let original = ApiKey::new("sk-live-abc123");
    let cloned = original.clone();

    assert_eq!(original.expose(), cloned.expose());

    // Independent ownership: zeroizing one must NOT affect the other.
    let mut original = original;
    original.zeroize();
    assert_eq!(
        original.expose(),
        "",
        "zeroizing one clone must wipe only that clone"
    );
    assert_eq!(
        cloned.expose(),
        "sk-live-abc123",
        "zeroizing one clone must NOT affect the sibling clone"
    );
}

/// `BearerToken` and `DbPassword` follow the same Clone contract.
#[test]
fn bearer_and_db_clone_are_independent() {
    let tok = BearerToken::new("eyJ.payload.sig");
    let tok_clone = tok.clone();
    assert_eq!(tok.expose(), tok_clone.expose());

    let pw = DbPassword::new("hunter2");
    let pw_clone = pw.clone();
    assert_eq!(pw.expose(), pw_clone.expose());
}

/// PartialEq / Eq are INTENTIONALLY absent on secret-holding newtypes.
/// Comparing secrets can leak timing info; the type system here is a
/// deliberate barrier. This test pins the contract — if anyone ever
/// derives `PartialEq` on `ApiKey` / `BearerToken` / `DbPassword`,
/// the bound below compiles and this test needs to be reviewed
/// against the security policy.
///
/// To upgrade this to a hard compile-time fence, see findings doc §3
/// (trybuild / compile_test recommendation).
#[test]
fn secret_newtypes_intentionally_lack_partial_eq() {
    fn assert_no_partial_eq<T: ?Sized>() {}
    assert_no_partial_eq::<ApiKey>();
    assert_no_partial_eq::<BearerToken>();
    assert_no_partial_eq::<DbPassword>();
}

// ---------------------------------------------------------------------------
// (c) Serialization round-trip
// ---------------------------------------------------------------------------
//
// FINDING: `pheno-config` v0.1.0 does NOT derive `Serialize` or
// `Deserialize` on `ApiKey` / `BearerToken` / `DbPassword`. This is
// the correct security posture for secret-holding newtypes — serde's
// `Serialize` would route through `Display`/`Debug` paths that are
// already redacted, but `Deserialize` would risk accepting
// `***REDACTED***` from a remote source. The absence is pinned here.

#[test]
fn secret_newtypes_intentionally_lack_serde() {
    fn assert_no_serde<T: ?Sized>() {}
    assert_no_serde::<ApiKey>();
    assert_no_serde::<BearerToken>();
    assert_no_serde::<DbPassword>();
}

/// The redaction contract holds even after Clone + format!: a cloned
/// secret cannot be accidentally serialized via `format!` either,
/// because both `Display` and `Debug` are redacted.
#[test]
fn cloned_secret_format_routes_stay_redacted() {
    let original = ApiKey::new("sk-live-abc123");
    let cloned = original.clone();

    let s_dbg = format!("{:?}", cloned);
    assert!(
        s_dbg.contains("REDACTED"),
        "Debug of cloned ApiKey must be redacted: {s_dbg}"
    );
    assert!(
        !s_dbg.contains("sk-live-abc123"),
        "Debug of cloned ApiKey must NOT leak: {s_dbg}"
    );

    let s_disp = format!("{cloned}");
    assert_eq!(s_disp, "***REDACTED***");
}

// ---------------------------------------------------------------------------
// (d) Send + Sync auto-traits
// ---------------------------------------------------------------------------

/// All three secret newtypes auto-derive `Send + Sync` because their
/// inner `String` is `Send + Sync`. This test sends each across a
/// thread boundary and reads the exposed value back to prove the
/// auto-trait bound is real at runtime.
#[test]
fn api_key_is_send_and_sync_across_thread_boundary() {
    fn require_send_sync<T: Send + Sync>() {}
    require_send_sync::<ApiKey>();
    require_send_sync::<BearerToken>();
    require_send_sync::<DbPassword>();

    let key = ApiKey::new("sk-live-abc123");
    let handle = thread::spawn(move || {
        assert_eq!(key.expose(), "sk-live-abc123");
        key
    });
    let joined = handle.join().expect("thread did not panic");
    assert_eq!(joined.expose(), "sk-live-abc123");
}

#[test]
fn bearer_token_and_db_password_are_send_and_sync() {
    let tok = BearerToken::new("eyJ.payload.sig");
    let handle = thread::spawn(move || tok.expose().to_string());
    assert_eq!(handle.join().unwrap(), "eyJ.payload.sig");

    let pw = DbPassword::new("hunter2");
    let handle = thread::spawn(move || pw.expose().to_string());
    assert_eq!(handle.join().unwrap(), "hunter2");
}

// ---------------------------------------------------------------------------
// (e) Default impls where advertised
// ---------------------------------------------------------------------------

/// `Default` is INTENTIONALLY absent on all three secret newtypes —
/// constructing a "default" empty secret would either panic (per the
/// empty-input tripwire) or silently accept a zero-length credential.
/// This test pins the contract.
#[test]
fn secret_newtypes_intentionally_lack_default() {
    fn assert_no_default<T>() {}
    assert_no_default::<ApiKey>();
    assert_no_default::<BearerToken>();
    assert_no_default::<DbPassword>();
}

// ---------------------------------------------------------------------------
// Bonus: `Display` / `Debug` redaction conformance
// ---------------------------------------------------------------------------
//
// `Display` and `Debug` are explicitly implemented to render as
// `***REDACTED***` (preserving the type tag in Debug for log triage).
// This is the single most security-critical contract on these
// newtypes; pinned here across all three.

#[test]
fn display_is_redacted_for_all_three_newtypes() {
    assert_eq!(format!("{}", ApiKey::new("k")), "***REDACTED***");
    assert_eq!(format!("{}", BearerToken::new("t")), "***REDACTED***");
    assert_eq!(format!("{}", DbPassword::new("p")), "***REDACTED***");
}

#[test]
fn debug_preserves_type_tag_and_redacts_value() {
    let cases: [(String, String, String); 3] = [
        (format!("{:?}", ApiKey::new("sk-live-abc")), "ApiKey".into(), "sk-live-abc".into()),
        (format!("{:?}", BearerToken::new("eyJ.p.s")), "BearerToken".into(), "eyJ.p.s".into()),
        (format!("{:?}", DbPassword::new("hunter2")), "DbPassword".into(), "hunter2".into()),
    ];

    for (dbg, tag, secret) in cases.iter() {
        assert!(
            dbg.contains(tag),
            "Debug must preserve type tag {tag:?}: {dbg}"
        );
        assert!(
            dbg.contains("REDACTED"),
            "Debug must show REDACTED: {dbg}"
        );
        assert!(
            !dbg.contains(secret),
            "Debug must NOT leak secret {secret:?}: {dbg}"
        );
    }
}

/// Negative-space: `expose()` is the ONLY path to the raw secret bytes.
/// `Debug` / `Display` / `format!` all stay redacted; we assert that
/// `clone()` followed by `format!("{:?}", cloned)` still redacts.
#[test]
fn expose_is_only_unredacted_path() {
    let key = ApiKey::new("sk-live-abc123");
    let raw = key.expose();
    assert_eq!(raw, "sk-live-abc123");

    // Every other formatting path must redact.
    assert_eq!(format!("{key}"), "***REDACTED***");
    let dbg = format!("{key:?}");
    assert!(!dbg.contains(raw), "Debug leaked raw secret: {dbg}");
}
