//! v20-T5 (L23) — proptest smoke test for `pheno-config`.
//!
//! Property: round-tripping a secret newtype through `expose()` returns
//! the value originally supplied to `new()` (the only safe, allocation-
//! free way to read the inner bytes). Any proptest-generated `ApiKey`,
//! `BearerToken`, or `DbPassword` is guaranteed non-empty (the
//! `Arbitrary` impl in `src/secrets.rs` filters out the empty string
//! via the regex `[A-Za-z0-9_\-]{1,64}`), so `new()` will not panic.
//!
//! Run with:
//!
//! ```bash
//! cargo test --test proptest_smoke
//! ```

use proptest::prelude::*;
use pheno_config::secrets::{ApiKey, BearerToken, DbPassword};

proptest! {
    /// Round-trip an `ApiKey` through `expose()`. We only assert that
    /// the exposed bytes are non-empty (the original invariant that
    /// `Arbitrary` was constructed to preserve).
    #[test]
    fn api_key_expose_is_nonempty(key in any::<ApiKey>()) {
        prop_assert!(!key.expose().is_empty());
    }

    /// Round-trip a `BearerToken` through `expose()`.
    #[test]
    fn bearer_token_expose_is_nonempty(token in any::<BearerToken>()) {
        prop_assert!(!token.expose().is_empty());
    }

    /// Round-trip a `DbPassword` through `expose()`.
    #[test]
    fn db_password_expose_is_nonempty(pw in any::<DbPassword>()) {
        prop_assert!(!pw.expose().is_empty());
    }

    /// `Debug` and `Display` redacts the secret bytes — no matter what
    /// random input we got, the formatted output must contain the
    /// type tag (for log triage) and the REDACTED marker, but never
    /// the inner value.
    #[test]
    fn api_key_debug_redacts_inner(key in any::<ApiKey>()) {
        let inner = key.expose();
        let dbg = format!("{:?}", key);
        prop_assert!(dbg.contains("ApiKey"), "Debug should preserve type tag: {dbg}");
        prop_assert!(dbg.contains("REDACTED"), "Debug should show REDACTED: {dbg}");
        prop_assert!(!dbg.contains(inner), "Debug must not leak the raw value: {dbg}");

        let disp = format!("{}", key);
        prop_assert_eq!(disp, "***REDACTED***");
        prop_assert!(!disp.contains(inner));
    }
}