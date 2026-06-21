// SPDX-License-Identifier: MIT OR Apache-2.0

//! Unified error types for FocalPoint crates.
//!
//! Re-exports [`phenotype_error_core::PhenotypeError`] as `FocusError` for the
//! `focus-*` crate naming convention, plus domain-specific convenience methods
//! that focus crates frequently need.

pub use phenotype_error_core::{
    ErrorContext, PhenotypeError, Result, ResultExt,
};

/// Alias for [`PhenotypeError`] within the `focus-*` crate namespace.
pub type FocusError = PhenotypeError;

/// Alias for the shared [`Result`] type using `FocusError`.
pub type FocusResult<T> = Result<T>;

/// Domain-specific convenience constructors for `FocusError`.
pub trait FocusErrorExt {
    /// Create a crypto-related error.
    fn crypto(message: impl Into<String>) -> Self;
    /// Create a transpilation-related error.
    fn transpilation(source: impl Into<String>, target: impl Into<String>, message: impl Into<String>) -> Self;
    /// Create an event-related error.
    fn event(message: impl Into<String>) -> Self;
    /// Create a connector-related error.
    fn connector(message: impl Into<String>) -> Self;
    /// Create a configuration-related error.
    fn config(key: impl Into<String>, message: impl Into<String>) -> Self;
}

impl FocusErrorExt for FocusError {
    fn crypto(message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("crypto: {}", message.into()),
        }
    }

    fn transpilation(source: impl Into<String>, target: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("transpilation {} -> {}: {}", source.into(), target.into(), message.into()),
        }
    }

    fn event(message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("event: {}", message.into()),
        }
    }

    fn connector(message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("connector: {}", message.into()),
        }
    }

    fn config(key: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("config[{}]: {}", key.into(), message.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_focus_error_alias() {
        let err: FocusError = FocusError::not_found("test");
        assert_eq!(err.to_string(), "not found: test");
    }

    #[test]
    fn test_crypto_error() {
        let err = FocusError::crypto("decryption failed");
        assert!(err.to_string().contains("crypto: decryption failed"));
    }

    #[test]
    fn test_transpilation_error() {
        let err = FocusError::transpilation("toml", "json", "missing field");
        assert!(err.to_string().contains("transpilation toml -> json: missing field"));
    }

    #[test]
    fn test_event_error() {
        let err = FocusError::event("invalid confidence");
        assert!(err.to_string().contains("event: invalid confidence"));
    }

    #[test]
    fn test_connector_error() {
        let err = FocusError::connector("rate limited");
        assert!(err.to_string().contains("connector: rate limited"));
    }

    #[test]
    fn test_config_error() {
        let err = FocusError::config("api_key", "missing");
        assert!(err.to_string().contains("config[api_key]: missing"));
    }

    #[test]
    fn test_result_alias() {
        fn may_fail(succeed: bool) -> FocusResult<i32> {
            if succeed {
                Ok(42)
            } else {
                Err(FocusError::not_found("value"))
            }
        }
        assert_eq!(may_fail(true).unwrap(), 42);
        assert!(may_fail(false).is_err());
    }
}
