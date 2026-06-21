// SPDX-License-Identifier: MIT OR Apache-2.0
// use std::fmt;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// The canonical error type shared across all Phenotype crates.
///
/// Replaces the scattered per-crate error enums (EventSourcingError, PolicyEngineError, etc.)
/// with a single, unified error type that provides structured error information.
#[derive(Error, Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PhenotypeError {
    #[error("not found: {resource}")]
    NotFound { resource: String },

    #[error("conflict: {message}")]
    Conflict { message: String },

    #[error("serialization error: {message}")]
    Serialization { message: String },

    #[error("storage error: {message}")]
    Storage { message: String },

    #[error("invalid input: {field} — {message}")]
    InvalidInput { field: String, message: String },

    #[error("timeout: {operation} after {duration_ms}ms")]
    Timeout { operation: String, duration_ms: u64 },

    #[error("authentication failed: {message}")]
    Authentication { message: String },

    #[error("authorization denied: {message}")]
    Authorization { message: String },

    #[error("policy violation: {message}")]
    Policy { message: String },

    #[error("event sourcing error: {message}")]
    EventSourcing { message: String },

    #[error("workflow error: {message}")]
    Workflow { message: String },

    #[error("validation error: {message}")]
    Validation { message: String },

    #[error("internal error: {message}")]
    Internal { message: String },

    #[error("service unavailable: {service}")]
    Unavailable { service: String },

    #[error("rate limited: {message}")]
    RateLimited { message: String },

    #[error("unknown error: {message}")]
    Unknown { message: String },
}

impl PhenotypeError {
    /// Create a NotFound error.
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound {
            resource: resource.into(),
        }
    }

    /// Create a Conflict error.
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict {
            message: message.into(),
        }
    }

    /// Create a Serialization error from a source string.
    pub fn serialization(source: impl Into<String>) -> Self {
        Self::Serialization {
            message: source.into(),
        }
    }

    /// Create a Storage error.
    pub fn storage(message: impl Into<String>) -> Self {
        Self::Storage {
            message: message.into(),
        }
    }

    /// Create an InvalidInput error.
    pub fn invalid_input(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::InvalidInput {
            field: field.into(),
            message: message.into(),
        }
    }

    /// Create a Timeout error.
    pub fn timeout(operation: impl Into<String>, duration_ms: u64) -> Self {
        Self::Timeout {
            operation: operation.into(),
            duration_ms,
        }
    }

    /// Create an Authentication error.
    pub fn authentication(message: impl Into<String>) -> Self {
        Self::Authentication {
            message: message.into(),
        }
    }

    /// Create an Authorization error.
    pub fn authorization(message: impl Into<String>) -> Self {
        Self::Authorization {
            message: message.into(),
        }
    }

    /// Create an Internal error.
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    /// Create a Validation error.
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
        }
    }

    /// Create a Policy error.
    pub fn policy(message: impl Into<String>) -> Self {
        Self::Policy {
            message: message.into(),
        }
    }

    /// Create a Workflow error.
    pub fn workflow(message: impl Into<String>) -> Self {
        Self::Workflow {
            message: message.into(),
        }
    }

    /// Create an EventSourcing error.
    pub fn event_sourcing(message: impl Into<String>) -> Self {
        Self::EventSourcing {
            message: message.into(),
        }
    }

    /// Create an Unavailable error.
    pub fn unavailable(service: impl Into<String>) -> Self {
        Self::Unavailable {
            service: service.into(),
        }
    }

    /// Create a RateLimited error.
    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self::RateLimited {
            message: message.into(),
        }
    }

    /// Returns true if this error is a client-side error (4xx-like).
    pub fn is_client_error(&self) -> bool {
        matches!(
            self,
            Self::NotFound { .. }
                | Self::Conflict { .. }
                | Self::InvalidInput { .. }
                | Self::Authentication { .. }
                | Self::Authorization { .. }
                | Self::Validation { .. }
        )
    }

    /// Returns true if this error is a server-side error (5xx-like).
    pub fn is_server_error(&self) -> bool {
        matches!(
            self,
            Self::Storage { .. }
                | Self::Internal { .. }
                | Self::Unavailable { .. }
                | Self::Serialization { .. }
        )
    }

    /// Returns true if this error is retryable.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Timeout { .. } | Self::Storage { .. } | Self::Serialization { .. }
        )
    }
}

impl From<serde_json::Error> for PhenotypeError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization {
            message: err.to_string(),
        }
    }
}

impl From<std::io::Error> for PhenotypeError {
    fn from(err: std::io::Error) -> Self {
        Self::Storage {
            message: err.to_string(),
        }
    }
}

/// Context for structured error reporting.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ErrorContext {
    pub request_id: Option<Uuid>,
    pub operation: Option<String>,
    pub resource: Option<String>,
    pub extra: std::collections::HashMap<String, String>,
}

impl ErrorContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_request_id(mut self, id: Uuid) -> Self {
        self.request_id = Some(id);
        self
    }

    pub fn with_operation(mut self, op: impl Into<String>) -> Self {
        self.operation = Some(op.into());
        self
    }

    pub fn with_resource(mut self, res: impl Into<String>) -> Self {
        self.resource = Some(res.into());
        self
    }

    pub fn with_extra(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra.insert(key.into(), value.into());
        self
    }
}

/// Result type alias using PhenotypeError.
pub type Result<T> = std::result::Result<T, PhenotypeError>;

/// Extension trait for Results to add context.
pub trait ResultExt<T> {
    fn with_context(self, ctx: ErrorContext) -> Result<T>;
    fn with_operation(self, op: impl Into<String>) -> Result<T>;
}

impl<T> ResultExt<T> for std::result::Result<T, PhenotypeError> {
    fn with_context(self, _ctx: ErrorContext) -> Result<T> {
        // Context can be attached via tracing/logging; the error itself is already structured
        self
    }

    fn with_operation(self, _op: impl Into<String>) -> Result<T> {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found() {
        let err = PhenotypeError::not_found("user/42");
        assert!(err.is_client_error());
        assert!(!err.is_retryable());
        assert_eq!(err.to_string(), "not found: user/42");
    }

    #[test]
    fn test_timeout_is_retryable() {
        let err = PhenotypeError::timeout("db_query", 5000);
        assert!(err.is_retryable());
    }

    #[test]
    fn test_from_serde_json() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid").unwrap_err();
        let err: PhenotypeError = json_err.into();
        assert!(err.is_server_error());
    }

    #[test]
    fn test_error_context() {
        let ctx = ErrorContext::new()
            .with_request_id(Uuid::new_v4())
            .with_operation("create_feature")
            .with_extra("workspace_id", "ws-123");
        assert!(ctx.request_id.is_some());
        assert_eq!(ctx.operation, Some("create_feature".to_string()));
    }
}
