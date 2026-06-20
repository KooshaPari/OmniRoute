use serde::{Deserialize, Serialize};

/// Stable wire error codes shared across Rust and TypeScript interfaces.
///
/// These codes are the language-agnostic classification used for wire
/// responses, structured logs, and observability events. Each domain
/// error type should project into one of these codes via
/// [`super::PhenotypeErrorTrait`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// Catch-all for unexpected server-side failures.
    InternalError,
    /// Caller supplied an invalid argument (malformed, out of range, etc.).
    InvalidArgument,
    /// The requested resource does not exist.
    NotFound,
    /// The resource already exists (conflict on create / idempotency key).
    AlreadyExists,
    /// The caller lacks permission for the operation.
    PermissionDenied,
    /// The caller is not authenticated.
    Unauthenticated,
    /// A resource quota or rate limit was exceeded.
    ResourceExhausted,
    /// The operation was cancelled (typically by the caller).
    Cancelled,
    /// The service is currently unavailable (planned downtime, load-shedding).
    Unavailable,
    /// The operation is not implemented / supported.
    NotImplemented,
    /// The operation exceeded a deadline.
    Timeout,
    /// Input failed domain validation rules.
    ValidationError,
    /// The requested method is not supported on this endpoint.
    MethodNotSupported,
}

impl ErrorCode {
    /// Return the stable string representation used on the wire.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InternalError => "INTERNAL_ERROR",
            Self::InvalidArgument => "INVALID_ARGUMENT",
            Self::NotFound => "NOT_FOUND",
            Self::AlreadyExists => "ALREADY_EXISTS",
            Self::PermissionDenied => "PERMISSION_DENIED",
            Self::Unauthenticated => "UNAUTHENTICATED",
            Self::ResourceExhausted => "RESOURCE_EXHAUSTED",
            Self::Cancelled => "CANCELLED",
            Self::Unavailable => "UNAVAILABLE",
            Self::NotImplemented => "NOT_IMPLEMENTED",
            Self::Timeout => "TIMEOUT",
            Self::ValidationError => "VALIDATION_ERROR",
            Self::MethodNotSupported => "METHOD_NOT_SUPPORTED",
        }
    }
}

impl std::fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_code_serializes_to_contract_value() {
        let json = serde_json::to_string(&ErrorCode::InvalidArgument).unwrap();
        assert_eq!(json, "\"INVALID_ARGUMENT\"");
    }

    #[test]
    fn error_code_display_matches_as_str() {
        for code in &[
            ErrorCode::InternalError,
            ErrorCode::NotFound,
            ErrorCode::ValidationError,
        ] {
            assert_eq!(code.to_string(), code.as_str());
        }
    }

    #[test]
    fn all_codes_are_distinct() {
        use std::collections::HashSet;
        let codes = vec![
            ErrorCode::InternalError,
            ErrorCode::InvalidArgument,
            ErrorCode::NotFound,
            ErrorCode::AlreadyExists,
            ErrorCode::PermissionDenied,
            ErrorCode::Unauthenticated,
            ErrorCode::ResourceExhausted,
            ErrorCode::Cancelled,
            ErrorCode::Unavailable,
            ErrorCode::NotImplemented,
            ErrorCode::Timeout,
            ErrorCode::ValidationError,
            ErrorCode::MethodNotSupported,
        ];
        let set: HashSet<_> = codes.iter().collect();
        assert_eq!(set.len(), codes.len());
    }

    #[test]
    fn error_code_roundtrip() {
        let cases = vec![
            (ErrorCode::NotFound, "\"NOT_FOUND\""),
            (ErrorCode::InternalError, "\"INTERNAL_ERROR\""),
            (ErrorCode::ValidationError, "\"VALIDATION_ERROR\""),
            (ErrorCode::Cancelled, "\"CANCELLED\""),
            (ErrorCode::Unauthenticated, "\"UNAUTHENTICATED\""),
        ];
        for (code, expected) in cases {
            let json = serde_json::to_string(&code).unwrap();
            assert_eq!(json, expected);
            let back: ErrorCode = serde_json::from_str(&json).unwrap();
            assert_eq!(back, code);
        }
    }
}
