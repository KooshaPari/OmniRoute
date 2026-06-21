// SPDX-License-Identifier: MIT OR Apache-2.0

//! Shared Result type alias for FocalPoint crates.
//!
//! Provides a consistent `Result<T, E>` type across all `focus-*` and
//! `phenotype-*` crates, defaulting to [`FocusError`] / [`PhenotypeError`].

pub use focus_errors::{FocusError, FocusResult, PhenotypeError, Result};

/// Re-export of [`Result`] with the standard default error type.
pub use focus_errors::Result as StdResult;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_result_type() {
        fn compute() -> Result<i32> {
            Ok(42)
        }
        assert_eq!(compute().unwrap(), 42);
    }

    #[test]
    fn test_focus_result_type() {
        fn compute() -> FocusResult<i32> {
            Ok(42)
        }
        assert_eq!(compute().unwrap(), 42);
    }

    #[test]
    fn test_std_result_type() {
        fn compute() -> StdResult<i32> {
            Ok(42)
        }
        assert_eq!(compute().unwrap(), 42);
    }
}
