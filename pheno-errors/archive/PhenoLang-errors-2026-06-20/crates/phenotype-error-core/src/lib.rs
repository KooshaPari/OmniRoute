//! Canonical error types for the Phenotype ecosystem.
//!
//! This crate provides a unified error framework that consolidates the
//! duplicated error enums scattered across Phenotype crates. Each error
//! category maps to a distinct architectural layer:
//!
//! | Error type | Layer | Typical producer |
//! |---|---|---|
//! | [`ApiError`] | HTTP / transport | Route handlers, middleware |
//! | [`DomainError`] | Business rules | Domain services, aggregates |
//! | [`RepositoryError`] | Persistence | Store adapters, query layers |
//! | [`ConfigError`] | Configuration | Loaders, environment readers |
//! | [`StorageError`] | Raw I/O | File, network, cache adapters |
//!
//! # Migration from per-crate errors
//!
//! Replace a local `error.rs` with a re-export:
//!
//! ```rust,ignore
//! // old: mod error; pub use error::MyError;
//! // new:
//! pub use phenotype_error_core::DomainError;
//! pub type Result<T> = std::result::Result<T, DomainError>;
//! ```

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ---------------------------------------------------------------------------
// API / transport layer
// ---------------------------------------------------------------------------

/// Errors originating from the HTTP / transport boundary.
#[derive(Error, Debug)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("not found: {resource} {id}")]
    NotFound { resource: String, id: String },

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("rate limited")]
    RateLimited,

    #[error("timeout")]
    Timeout,

    #[error("internal: {0}")]
    Internal(String),

    #[error(transparent)]
    Domain(#[from] DomainError),

    #[error(transparent)]
    Repository(#[from] RepositoryError),
}

impl ApiError {
    /// HTTP status code for this error.
    pub fn status_code(&self) -> u16 {
        match self {
            Self::BadRequest(_) => 400,
            Self::Unauthorized(_) => 401,
            Self::Forbidden(_) => 403,
            Self::NotFound { .. } => 404,
            Self::Conflict(_) => 409,
            Self::RateLimited => 429,
            Self::Timeout => 504,
            Self::Internal(_) => 500,
            Self::Domain(_) => 422,
            Self::Repository(_) => 500,
        }
    }

    /// Whether the caller should retry.
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::RateLimited | Self::Timeout | Self::Internal(_))
    }
}

// ---------------------------------------------------------------------------
// Domain / business-logic layer
// ---------------------------------------------------------------------------

/// Errors from domain logic: validation, invariant violations, state issues.
#[derive(Error, Debug)]
pub enum DomainError {
    #[error("validation failed: {0}")]
    Validation(String),

    #[error("invariant violated: {0}")]
    InvariantViolation(String),

    #[error("entity not found: {entity} {id}")]
    NotFound { entity: String, id: String },

    #[error("duplicate entity: {entity} {id}")]
    Duplicate { entity: String, id: String },

    #[error("invalid state transition: {from} -> {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("operation not permitted: {0}")]
    NotPermitted(String),

    #[error("policy evaluation failed: {0}")]
    PolicyEvaluation(String),

    #[error("{0}")]
    Other(String),
}

// ---------------------------------------------------------------------------
// Repository / persistence layer
// ---------------------------------------------------------------------------

/// Errors from persistence adapters.
#[derive(Error, Debug)]
pub enum RepositoryError {
    #[error("record not found: {entity} {id}")]
    NotFound { entity: String, id: String },

    #[error("duplicate record: {entity} {id}")]
    Duplicate { entity: String, id: String },

    #[error("connection error: {0}")]
    Connection(String),

    #[error("query error: {0}")]
    Query(String),

    #[error("serialization error: {0}")]
    Serialization(String),

    #[error("sequence gap: expected {expected}, got {actual}")]
    SequenceGap { expected: i64, actual: i64 },

    #[error("integrity error: {0}")]
    Integrity(String),

    #[error(transparent)]
    Storage(#[from] StorageError),
}

impl From<serde_json::Error> for RepositoryError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

// ---------------------------------------------------------------------------
// Configuration layer
// ---------------------------------------------------------------------------

/// Errors from configuration loading, parsing, and validation.
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("file not found: {}", path.display())]
    FileNotFound { path: PathBuf },

    #[error("file read error: {}: {reason}", path.display())]
    FileRead { path: PathBuf, reason: String },

    #[error("parse error ({format}): {reason}")]
    Parse { format: String, reason: String },

    #[error("deserialization error: {0}")]
    Deserialize(String),

    #[error("unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("missing required field: {0}")]
    MissingRequired(String),

    #[error("environment error: {0}")]
    Environment(String),

    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for ConfigError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => Self::FileNotFound {
                path: PathBuf::from("<unknown>"),
            },
            _ => Self::Other(err.to_string()),
        }
    }
}

impl From<serde_json::Error> for ConfigError {
    fn from(err: serde_json::Error) -> Self {
        Self::Parse {
            format: "json".into(),
            reason: err.to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// Storage / raw I/O layer
// ---------------------------------------------------------------------------

/// Low-level storage errors (files, network, cache).
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("capacity exceeded: {0}")]
    CapacityExceeded(String),

    #[error("connection error: {0}")]
    Connection(String),

    #[error("{0}")]
    Other(String),
}

// ---------------------------------------------------------------------------
// Serializable error envelope (for API responses / logging)
// ---------------------------------------------------------------------------

/// Wire-format error envelope suitable for JSON API responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEnvelope {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl From<&ApiError> for ErrorEnvelope {
    fn from(err: &ApiError) -> Self {
        Self {
            code: format!("ERR_{}", err.status_code()),
            message: err.to_string(),
            details: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

/// Extension trait adding `.context()` to `Result` types for richer messages.
pub trait ErrorContext<T, E> {
    /// Wrap the error with additional context.
    fn context(self, msg: impl Into<String>) -> Result<T, String>;
}

impl<T, E: std::fmt::Display> ErrorContext<T, E> for Result<T, E> {
    fn context(self, msg: impl Into<String>) -> Result<T, String> {
        self.map_err(|e| format!("{}: {e}", msg.into()))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_error_status_codes() {
        assert_eq!(ApiError::BadRequest("x".into()).status_code(), 400);
        assert_eq!(ApiError::Unauthorized("x".into()).status_code(), 401);
        assert_eq!(ApiError::Forbidden("x".into()).status_code(), 403);
        assert_eq!(
            ApiError::NotFound {
                resource: "user".into(),
                id: "1".into()
            }
            .status_code(),
            404
        );
        assert_eq!(ApiError::Conflict("x".into()).status_code(), 409);
        assert_eq!(ApiError::RateLimited.status_code(), 429);
        assert_eq!(ApiError::Timeout.status_code(), 504);
        assert_eq!(ApiError::Internal("x".into()).status_code(), 500);
    }

    #[test]
    fn api_error_retryable() {
        assert!(ApiError::RateLimited.is_retryable());
        assert!(ApiError::Timeout.is_retryable());
        assert!(ApiError::Internal("boom".into()).is_retryable());
        assert!(!ApiError::BadRequest("nope".into()).is_retryable());
    }

    #[test]
    fn domain_error_display() {
        let err = DomainError::Validation("name required".into());
        assert_eq!(err.to_string(), "validation failed: name required");
    }

    #[test]
    fn domain_error_state_transition() {
        let err = DomainError::InvalidStateTransition {
            from: "draft".into(),
            to: "published".into(),
        };
        assert!(err.to_string().contains("draft"));
        assert!(err.to_string().contains("published"));
    }

    #[test]
    fn repository_error_from_serde() {
        let json_err = serde_json::from_str::<String>("not json").unwrap_err();
        let repo_err = RepositoryError::from(json_err);
        assert!(matches!(repo_err, RepositoryError::Serialization(_)));
    }

    #[test]
    fn repository_error_sequence_gap() {
        let err = RepositoryError::SequenceGap {
            expected: 5,
            actual: 7,
        };
        assert!(err.to_string().contains("expected 5"));
        assert!(err.to_string().contains("got 7"));
    }

    #[test]
    fn config_error_from_io_not_found() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "gone");
        let cfg_err = ConfigError::from(io_err);
        assert!(matches!(cfg_err, ConfigError::FileNotFound { .. }));
    }

    #[test]
    fn config_error_from_io_other() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "nope");
        let cfg_err = ConfigError::from(io_err);
        assert!(matches!(cfg_err, ConfigError::Other(_)));
    }

    #[test]
    fn config_error_from_serde_json() {
        let json_err = serde_json::from_str::<String>("bad").unwrap_err();
        let cfg_err = ConfigError::from(json_err);
        assert!(matches!(cfg_err, ConfigError::Parse { format, .. } if format == "json"));
    }

    #[test]
    fn storage_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::BrokenPipe, "pipe");
        let store_err = StorageError::from(io_err);
        assert!(matches!(store_err, StorageError::Io(_)));
    }

    #[test]
    fn error_envelope_from_api_error() {
        let api_err = ApiError::NotFound {
            resource: "project".into(),
            id: "42".into(),
        };
        let envelope = ErrorEnvelope::from(&api_err);
        assert_eq!(envelope.code, "ERR_404");
        assert!(envelope.message.contains("project"));
    }

    #[test]
    fn error_envelope_serialization() {
        let envelope = ErrorEnvelope {
            code: "ERR_500".into(),
            message: "internal".into(),
            details: Some("stack trace".into()),
        };
        let json = serde_json::to_string(&envelope).unwrap();
        assert!(json.contains("ERR_500"));
        assert!(json.contains("stack trace"));

        let roundtrip: ErrorEnvelope = serde_json::from_str(&json).unwrap();
        assert_eq!(roundtrip.code, "ERR_500");
    }

    #[test]
    fn api_error_from_domain() {
        let domain_err = DomainError::Validation("bad input".into());
        let api_err = ApiError::from(domain_err);
        assert_eq!(api_err.status_code(), 422);
        assert!(api_err.to_string().contains("bad input"));
    }

    #[test]
    fn api_error_from_repository() {
        let repo_err = RepositoryError::Connection("db down".into());
        let api_err = ApiError::from(repo_err);
        assert_eq!(api_err.status_code(), 500);
    }

    #[test]
    fn repository_error_from_storage() {
        let store_err = StorageError::NotFound("file.dat".into());
        let repo_err = RepositoryError::from(store_err);
        assert!(matches!(repo_err, RepositoryError::Storage(_)));
    }

    #[test]
    fn context_helper() {
        let result: Result<(), &str> = Err("boom");
        let ctx = result.context("loading config");
        assert_eq!(ctx.unwrap_err(), "loading config: boom");
    }

    #[test]
    fn anyhow_interop() {
        let domain_err = DomainError::Validation("test".into());
        let anyhow_err: anyhow::Error = domain_err.into();
        assert!(anyhow_err.to_string().contains("validation failed: test"));

        let api_err = ApiError::Internal("crash".into());
        let anyhow_err: anyhow::Error = api_err.into();
        assert!(anyhow_err.to_string().contains("crash"));
    }
}
