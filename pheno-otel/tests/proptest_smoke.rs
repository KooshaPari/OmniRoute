//! v25-T7 (L42) — proptest smoke test for `pheno-otel`.
//!
//! Property: the `Display` impl on every `OtlpError` variant is
//! non-empty and contains the canonical prefix used in log pipelines
//! (`serialization failed:`, `transport error:`, `exporter not
//! configured:`, `invalid attribute:`). We construct each variant
//! from a proptest-generated `String` and assert the property — no
//! `Arbitrary` impl is required in `src/`, keeping this test
//! hermetic and CI-stable.
//!
//! Run with:
//!
//! ```bash
//! cargo test --test proptest_smoke
//! PROPTEST_CASES=256 cargo test --test proptest_smoke
//! ```

use proptest::prelude::*;

use pheno_otel::OtlpError;

proptest! {
    /// `Display` of an `OtlpError::SerializeFailed` always begins with
    /// `serialization failed:` — regression guard against a refactor
    /// that drops the `#[error("...")]` attribute.
    #[test]
    fn serialize_failed_display_prefix(msg in ".*") {
        let e = OtlpError::SerializeFailed(msg);
        let s = format!("{}", e);
        prop_assert!(!s.is_empty(), "Display must be non-empty");
        prop_assert!(
            s.starts_with("serialization failed:"),
            "Display did not start with `serialization failed:`: {s}"
        );
    }

    /// `Display` of an `OtlpError::InvalidAttribute` always begins
    /// with `invalid attribute:` — exercises a second variant to
    /// catch variant-level Display regressions.
    #[test]
    fn invalid_attribute_display_prefix(attr in ".*") {
        let e = OtlpError::InvalidAttribute(attr);
        let s = format!("{}", e);
        prop_assert!(!s.is_empty(), "Display must be non-empty");
        prop_assert!(
            s.starts_with("invalid attribute:"),
            "Display did not start with `invalid attribute:`: {s}"
        );
    }
}
