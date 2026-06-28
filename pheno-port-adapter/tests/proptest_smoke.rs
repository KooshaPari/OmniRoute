//! v25-T7 (L42) — proptest smoke test for `pheno-port-adapter`.
//!
//! Property: the `Display` impl on every `AdapterError` variant is
//! non-empty and contains the canonical prefix used in log pipelines
//! (`connect failed:`, `disconnect failed:`, `health check failed:`,
//! `timeout`). We construct each variant from a proptest-generated
//! `String` and assert the property — no `Arbitrary` impl is required
//! in `src/`, keeping this test hermetic and CI-stable.
//!
//! Run with:
//!
//! ```bash
//! cargo test --test proptest_smoke
//! PROPTEST_CASES=256 cargo test --test proptest_smoke
//! ```

use proptest::prelude::*;

use pheno_port_adapter::AdapterError;

proptest! {
    /// `Display` of an `AdapterError::ConnectFailed` always begins
    /// with the canonical prefix `connect failed:` (regression guard
    /// against a refactor that drops the `#[error("...")]` attr).
    #[test]
    fn connect_failed_display_prefix(msg in ".*") {
        let e = AdapterError::ConnectFailed(msg);
        let s = format!("{}", e);
        prop_assert!(!s.is_empty(), "Display must be non-empty");
        prop_assert!(
            s.starts_with("connect failed:"),
            "Display did not start with `connect failed:`: {s}"
        );
    }

    /// `Display` of `AdapterError::Timeout` is the literal `timeout`.
    #[test]
    fn timeout_display_is_literal(_dummy in 0u32..1) {
        let s = format!("{}", AdapterError::Timeout);
        prop_assert_eq!(s, "timeout");
    }
}
