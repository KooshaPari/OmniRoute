//! Canonical error types, traits, and wire codes for the Phenotype ecosystem.
//!
//! This crate provides the shared error foundation used across all Phenotype
//! crates (AgilePlus, Tasken, Focus, etc.). It replaces scattered per-crate
//! error enums with a single unified type that can be lifted into the stable
//! wire [`ErrorCode`] for cross-ecosystem observability.
//!
//! # Organisation
//!
//! | Module | Contents |
//! |--------|----------|
//! | [`ErrorCode`] | Stable wire codes shared with TypeScript |
//! | [`PhenotypeError`] | Canonical error enum with structured variants |
//! | [`PhenotypeError` trait] | Trait for projecting domain errors into the canon |
//! | [`PhenotypeResult`] | `Result<T, PhenotypeError>` alias |
//!
//! # Crate features
//!
//! - **`serde`** (default): enables serialization of [`ErrorCode`] and
//!   [`PhenotypeError`] for wire transport.
//!
//! # Minimum supported Rust version
//!
//! Rust 1.75+ (edition 2021).

mod code;
mod error_enum;
mod traits;

pub use code::ErrorCode;
pub use error_enum::PhenotypeError;
pub use traits::PhenotypeErrorTrait;

/// Convenience alias using the canonical [`PhenotypeError`] as the error type.
pub type PhenotypeResult<T> = Result<T, PhenotypeError>;

// ---------------------------------------------------------------------------
// Common From impls – allow the `?` operator on standard library / ecosystem
// error types without explicit `.map_err` at every call site.
// ---------------------------------------------------------------------------

impl From<anyhow::Error> for PhenotypeError {
    fn from(err: anyhow::Error) -> Self {
        PhenotypeError::internal(err.to_string())
    }
}

impl From<std::io::Error> for PhenotypeError {
    fn from(err: std::io::Error) -> Self {
        PhenotypeError::storage(err.to_string())
    }
}

#[cfg(feature = "serde")]
#[cfg_attr(docsrs, doc(cfg(feature = "serde")))]
impl From<serde_json::Error> for PhenotypeError {
    fn from(err: serde_json::Error) -> Self {
        PhenotypeError::serialization(err.to_string())
    }
}

impl From<std::num::ParseIntError> for PhenotypeError {
    fn from(err: std::num::ParseIntError) -> Self {
        PhenotypeError::invalid_input("value", err.to_string())
    }
}

impl From<std::num::ParseFloatError> for PhenotypeError {
    fn from(err: std::num::ParseFloatError) -> Self {
        PhenotypeError::invalid_input("value", err.to_string())
    }
}

impl From<String> for PhenotypeError {
    fn from(msg: String) -> Self {
        PhenotypeError::internal(msg)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- PhenotypeError tests ---

    #[test]
    fn test_not_found() {
        let err = PhenotypeError::not_found("user/42");
        assert!(err.is_client_error());
        assert!(!err.is_retryable());
        assert_eq!(err.to_string(), "not found: user/42");
    }

    #[test]
    fn test_validation() {
        let err = PhenotypeError::validation("name is required");
        assert!(err.is_client_error());
        assert_eq!(err.to_string(), "validation error: name is required");
    }

    #[test]
    fn test_conflict() {
        let err = PhenotypeError::conflict("workspace already exists");
        assert!(err.is_client_error());
        assert_eq!(err.to_string(), "conflict: workspace already exists");
    }

    #[test]
    fn test_invalid_input() {
        let err = PhenotypeError::invalid_input("email", "must be a valid email");
        assert!(err.is_client_error());
        assert!(!err.is_retryable());
        assert!(err.to_string().contains("email"));
        assert!(err.to_string().contains("valid email"));
    }

    #[test]
    fn test_timeout_is_retryable() {
        let err = PhenotypeError::timeout("db_query", 5000);
        assert!(err.is_retryable());
        assert!(!err.is_client_error());
        assert!(!err.is_server_error());
        assert!(err.to_string().contains("db_query"));
    }

    #[test]
    fn test_storage_is_server_error() {
        let err = PhenotypeError::storage("disk full");
        assert!(err.is_server_error());
        assert!(err.is_retryable());
    }

    #[test]
    fn test_internal_is_server_error() {
        let err = PhenotypeError::internal("unexpected nil pointer");
        assert!(err.is_server_error());
        assert!(!err.is_client_error());
    }

    #[test]
    fn test_authentication_is_client_error() {
        let err = PhenotypeError::authentication("invalid token");
        assert!(err.is_client_error());
    }

    #[test]
    fn test_authorization_is_client_error() {
        let err = PhenotypeError::authorization("insufficient permissions");
        assert!(err.is_client_error());
    }

    #[test]
    fn test_unavailable_classification() {
        let err = PhenotypeError::unavailable("postgres");
        assert!(err.is_server_error());
        assert!(!err.is_client_error());
    }

    #[test]
    fn test_cancelled() {
        let err = PhenotypeError::cancelled("user aborted");
        assert_eq!(err.to_string(), "cancelled: user aborted");
    }

    #[test]
    fn test_serialization_is_retryable() {
        let err = PhenotypeError::serialization("invalid UTF-8 sequence");
        assert!(err.is_retryable());
        assert!(err.is_server_error());
    }

    #[test]
    #[cfg(feature = "serde")]
    fn test_from_serde_json() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid").unwrap_err();
        let err: PhenotypeError = json_err.into();
        assert!(err.is_server_error());
        assert!(matches!(err, PhenotypeError::Serialization { .. }));
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err: PhenotypeError = io_err.into();
        assert!(matches!(err, PhenotypeError::Storage { .. }));
    }

    #[test]
    fn test_from_parse_int_error() {
        let parse_err = "not_a_number".parse::<i32>().unwrap_err();
        let err: PhenotypeError = parse_err.into();
        assert!(matches!(err, PhenotypeError::InvalidInput { .. }));
    }

    #[test]
    fn test_from_string() {
        let err: PhenotypeError = "something went wrong".to_string().into();
        assert!(matches!(err, PhenotypeError::Internal { .. }));
    }

    #[test]
    fn test_into_anyhow() {
        let pe = PhenotypeError::not_found("order/99");
        // PhenotypeError implements std::error::Error, so anyhow's
        // blanket From<E: StdError> impl should cover this.
        let any = anyhow::Error::from(pe);
        assert!(any.to_string().contains("not found"));
    }

    #[test]
    fn test_from_anyhow() {
        let any = anyhow::anyhow!("network error");
        let pe: PhenotypeError = any.into();
        assert!(matches!(pe, PhenotypeError::Internal { .. }));
        assert!(pe.to_string().contains("network error"));
    }

    #[test]
    fn test_error_code_projection() {
        let err = PhenotypeError::not_found("order/1");
        assert_eq!(err.error_code(), ErrorCode::NotFound);

        let err = PhenotypeError::validation("bad input");
        assert_eq!(err.error_code(), ErrorCode::ValidationError);

        let err = PhenotypeError::internal("crash");
        assert_eq!(err.error_code(), ErrorCode::InternalError);

        let err = PhenotypeError::authentication("bad token");
        assert_eq!(err.error_code(), ErrorCode::Unauthenticated);

        let err = PhenotypeError::authorization("no access");
        assert_eq!(err.error_code(), ErrorCode::PermissionDenied);

        let err = PhenotypeError::conflict("exists");
        assert_eq!(err.error_code(), ErrorCode::AlreadyExists);

        let err = PhenotypeError::unavailable("db");
        assert_eq!(err.error_code(), ErrorCode::Unavailable);

        let err = PhenotypeError::timeout("query", 100);
        assert_eq!(err.error_code(), ErrorCode::Timeout);

        let err = PhenotypeError::cancelled("aborted");
        assert_eq!(err.error_code(), ErrorCode::Cancelled);

        let err = PhenotypeError::rate_limited("too many requests");
        assert_eq!(err.error_code(), ErrorCode::ResourceExhausted);

        let err = PhenotypeError::serialization("bad json");
        assert_eq!(err.error_code(), ErrorCode::InternalError);

        let err = PhenotypeError::invalid_input("age", "must be positive");
        assert_eq!(err.error_code(), ErrorCode::InvalidArgument);

        let err = PhenotypeError::storage("disk full");
        assert_eq!(err.error_code(), ErrorCode::InternalError);

        let err = PhenotypeError::unknown("something odd");
        assert_eq!(err.error_code(), ErrorCode::InternalError);
    }

    // --- PhenotypeResult tests ---

    #[test]
    fn test_phenotype_result_ok() {
        let r: PhenotypeResult<i32> = Ok(42);
        assert_eq!(r.unwrap(), 42);
    }

    #[test]
    fn test_phenotype_result_err() {
        let r: PhenotypeResult<i32> = Err(PhenotypeError::not_found("item"));
        assert!(r.is_err());
        assert_eq!(r.unwrap_err().error_code(), ErrorCode::NotFound);
    }

    // --- PhenotypeErrorTrait implementation tests ---

    /// A concrete domain error that implements [`PhenotypeErrorTrait`].
    #[derive(Debug)]
    struct MyDomainError {
        kind: MyErrorKind,
        source: Option<anyhow::Error>,
    }

    #[derive(Debug, Clone, PartialEq)]
    enum MyErrorKind {
        NotFound,
        Validation,
        Internal,
    }

    impl std::fmt::Display for MyDomainError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self.kind {
                MyErrorKind::NotFound => write!(f, "not found"),
                MyErrorKind::Validation => write!(f, "validation failed"),
                MyErrorKind::Internal => write!(f, "internal error"),
            }
        }
    }

    impl std::error::Error for MyDomainError {}

    impl PhenotypeErrorTrait for MyDomainError {
        fn error_code(&self) -> ErrorCode {
            match self.kind {
                MyErrorKind::NotFound => ErrorCode::NotFound,
                MyErrorKind::Validation => ErrorCode::ValidationError,
                MyErrorKind::Internal => ErrorCode::InternalError,
            }
        }

        fn is_retryable(&self) -> bool {
            matches!(self.kind, MyErrorKind::Internal)
        }

        fn message(&self) -> String {
            self.to_string()
        }

        fn into_canonical(self) -> PhenotypeError {
            match self.kind {
                MyErrorKind::NotFound => PhenotypeError::not_found(self.message()),
                MyErrorKind::Validation => PhenotypeError::validation(self.message()),
                MyErrorKind::Internal => PhenotypeError::internal(self.message()),
            }
        }
    }

    #[test]
    fn test_trait_projection_to_error_code() {
        let err = MyDomainError { kind: MyErrorKind::NotFound, source: None };
        assert_eq!(err.error_code(), ErrorCode::NotFound);
    }

    #[test]
    fn test_trait_retryable() {
        let err = MyDomainError { kind: MyErrorKind::Internal, source: None };
        assert!(err.is_retryable());
    }

    #[test]
    fn test_trait_into_canonical() {
        let err = MyDomainError { kind: MyErrorKind::Validation, source: None };
        let canon: PhenotypeError = err.into_canonical();
        assert_eq!(canon.error_code(), ErrorCode::ValidationError);
    }

    // --- ErrorCode tests ---

    #[test]
    #[cfg(feature = "serde")]
    fn test_error_code_serde_roundtrip() {
        let json = serde_json::to_string(&ErrorCode::NotFound).unwrap();
        let deserialized: ErrorCode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ErrorCode::NotFound);
    }

    #[test]
    fn test_error_code_as_str() {
        assert_eq!(ErrorCode::NotFound.as_str(), "NOT_FOUND");
        assert_eq!(ErrorCode::InternalError.as_str(), "INTERNAL_ERROR");
        assert_eq!(ErrorCode::ValidationError.as_str(), "VALIDATION_ERROR");
        assert_eq!(ErrorCode::InvalidArgument.as_str(), "INVALID_ARGUMENT");
        assert_eq!(ErrorCode::Cancelled.as_str(), "CANCELLED");
        assert_eq!(ErrorCode::Timeout.as_str(), "TIMEOUT");
    }

    // --- Derive macro integration tests ---

    /// Domain error using the #[derive(PhenotypeError)] proc-macro.
    ///
    /// Uses `crate` path so the derive macro resolves references inside
    /// this crate.
    #[derive(Debug, phenotype_error_core_derive::PhenotypeError)]
    #[phenotype_error(crate = "crate")]
    enum DbError {
        #[phenotype_error(code = "NotFound")]
        RowNotFound(String),

        #[phenotype_error(code = "AlreadyExists")]
        DuplicateKey { key: String },

        #[phenotype_error(code = "InternalError", retryable)]
        ConnectionLost(String),

        #[phenotype_error(code = "Timeout", retryable)]
        QueryTimeout { query: String, ms: u64 },
    }

    #[test]
    fn test_derive_error_code_mapping() {
        let err = DbError::RowNotFound("user/42".into());
        assert_eq!(err.error_code(), ErrorCode::NotFound);
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_derive_retryable_flag() {
        let err = DbError::ConnectionLost("timeout".into());
        assert_eq!(err.error_code(), ErrorCode::InternalError);
        assert!(err.is_retryable());
    }

    #[test]
    fn test_derive_display() {
        let err = DbError::RowNotFound("user/42".into());
        let msg = err.to_string();
        assert!(msg.contains("RowNotFound"));
        assert!(msg.contains("user/42"));
    }

    #[test]
    fn test_derive_into_canonical() {
        let err = DbError::DuplicateKey { key: "email_idx".into() };
        let canon: PhenotypeError = err.into_canonical();
        assert_eq!(canon.error_code(), ErrorCode::AlreadyExists);
    }
}
