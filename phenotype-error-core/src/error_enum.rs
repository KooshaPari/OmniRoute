use crate::code::ErrorCode;
use thiserror::Error;

/// The canonical error type shared across all Phenotype crates.
///
/// This replaces scattered per-crate error enums with a single unified type
/// that provides structured error information and projects into the stable
/// wire [`ErrorCode`].
///
/// # Construction
///
/// Prefer the builder methods (`not_found`, `validation`, …) over direct
/// construction — they are stable even if the internal variant shape changes.
#[derive(Error, Debug, Clone, PartialEq)]
#[non_exhaustive]
pub enum PhenotypeError {
    /// The requested resource was not found.
    #[error("not found: {resource}")]
    NotFound {
        /// Human-readable resource identifier.
        resource: String,
    },

    /// The operation conflicted with existing state.
    #[error("conflict: {message}")]
    Conflict {
        /// Description of the conflict.
        message: String,
    },

    /// Input failed validation rules.
    #[error("validation error: {message}")]
    Validation {
        /// Validation failure details.
        message: String,
    },

    /// A specific field in the input is invalid.
    #[error("invalid input: {field} — {message}")]
    InvalidInput {
        /// The name of the invalid field.
        field: String,
        /// Why the field is invalid.
        message: String,
    },

    /// Serialization / deserialization failure.
    #[error("serialization error: {message}")]
    Serialization {
        /// Serialization error details.
        message: String,
    },

    /// Storage / persistence failure.
    #[error("storage error: {message}")]
    Storage {
        /// Storage error details.
        message: String,
    },

    /// The operation timed out.
    #[error("timeout: {operation} after {duration_ms}ms")]
    Timeout {
        /// Operation that timed out.
        operation: String,
        /// Timeout duration in milliseconds.
        duration_ms: u64,
    },

    /// Authentication failure (not logged in).
    #[error("authentication failed: {message}")]
    Authentication {
        /// Authentication error details.
        message: String,
    },

    /// Authorization failure (insufficient permissions).
    #[error("authorization denied: {message}")]
    Authorization {
        /// Authorization error details.
        message: String,
    },

    /// Internal / unexpected server error.
    #[error("internal error: {message}")]
    Internal {
        /// Internal error details.
        message: String,
    },

    /// The service is unavailable.
    #[error("service unavailable: {service}")]
    Unavailable {
        /// Service that is unavailable.
        service: String,
    },

    /// The operation was cancelled.
    #[error("cancelled: {message}")]
    Cancelled {
        /// Cancellation reason.
        message: String,
    },

    /// Rate limit exceeded.
    #[error("rate limited: {message}")]
    RateLimited {
        /// Rate limit details.
        message: String,
    },

    /// Catch-all for errors that don't fit any other variant.
    #[error("unknown error: {message}")]
    Unknown {
        /// Description of the error.
        message: String,
    },
}

// ---------------------------------------------------------------------------
// Builder methods
// ---------------------------------------------------------------------------

impl PhenotypeError {
    /// Create a `NotFound` error.
    #[must_use]
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound { resource: resource.into() }
    }

    /// Create a `Conflict` error.
    #[must_use]
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict { message: message.into() }
    }

    /// Create a `Validation` error.
    #[must_use]
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation { message: message.into() }
    }

    /// Create an `InvalidInput` error.
    #[must_use]
    pub fn invalid_input(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::InvalidInput { field: field.into(), message: message.into() }
    }

    /// Create a `Serialization` error.
    #[must_use]
    pub fn serialization(message: impl Into<String>) -> Self {
        Self::Serialization { message: message.into() }
    }

    /// Create a `Storage` error.
    #[must_use]
    pub fn storage(message: impl Into<String>) -> Self {
        Self::Storage { message: message.into() }
    }

    /// Create a `Timeout` error.
    #[must_use]
    pub fn timeout(operation: impl Into<String>, duration_ms: u64) -> Self {
        Self::Timeout { operation: operation.into(), duration_ms }
    }

    /// Create an `Authentication` error.
    #[must_use]
    pub fn authentication(message: impl Into<String>) -> Self {
        Self::Authentication { message: message.into() }
    }

    /// Create an `Authorization` error.
    #[must_use]
    pub fn authorization(message: impl Into<String>) -> Self {
        Self::Authorization { message: message.into() }
    }

    /// Create an `Internal` error.
    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal { message: message.into() }
    }

    /// Create an `Unavailable` error.
    #[must_use]
    pub fn unavailable(service: impl Into<String>) -> Self {
        Self::Unavailable { service: service.into() }
    }

    /// Create a `Cancelled` error.
    #[must_use]
    pub fn cancelled(message: impl Into<String>) -> Self {
        Self::Cancelled { message: message.into() }
    }

    /// Create a `RateLimited` error.
    #[must_use]
    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self::RateLimited { message: message.into() }
    }

    /// Create an `Unknown` error.
    #[must_use]
    pub fn unknown(message: impl Into<String>) -> Self {
        Self::Unknown { message: message.into() }
    }
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

impl PhenotypeError {
    /// Returns `true` if this error is a client-side error (4xx-like).
    #[must_use]
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

    /// Returns `true` if this error is a server-side error (5xx-like).
    #[must_use]
    pub fn is_server_error(&self) -> bool {
        matches!(
            self,
            Self::Storage { .. }
                | Self::Internal { .. }
                | Self::Unavailable { .. }
                | Self::Serialization { .. }
        )
    }

    /// Returns `true` if this error is likely retryable.
    #[must_use]
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Timeout { .. }
                | Self::Storage { .. }
                | Self::Serialization { .. }
                | Self::Unavailable { .. }
                | Self::RateLimited { .. }
        )
    }

    /// Project this error into the stable wire [`ErrorCode`].
    #[must_use]
    pub fn error_code(&self) -> ErrorCode {
        match self {
            Self::NotFound { .. } => ErrorCode::NotFound,
            Self::Conflict { .. } => ErrorCode::AlreadyExists,
            Self::Validation { .. } => ErrorCode::ValidationError,
            Self::InvalidInput { .. } => ErrorCode::InvalidArgument,
            Self::Serialization { .. } => ErrorCode::InternalError,
            Self::Storage { .. } => ErrorCode::InternalError,
            Self::Timeout { .. } => ErrorCode::Timeout,
            Self::Authentication { .. } => ErrorCode::Unauthenticated,
            Self::Authorization { .. } => ErrorCode::PermissionDenied,
            Self::Internal { .. } => ErrorCode::InternalError,
            Self::Unavailable { .. } => ErrorCode::Unavailable,
            Self::Cancelled { .. } => ErrorCode::Cancelled,
            Self::RateLimited { .. } => ErrorCode::ResourceExhausted,
            Self::Unknown { .. } => ErrorCode::InternalError,
        }
    }
}

// ---------------------------------------------------------------------------
// Serde support (behind "serde" feature)
// ---------------------------------------------------------------------------

#[cfg(feature = "serde")]
mod serde_impl {
    use super::*;
    use serde::de::{self, Deserializer, MapAccess, Visitor};
    use serde::ser::{SerializeMap, Serializer};
    use serde::{Deserialize, Serialize};
    use std::fmt;

    /// Serialize PhenotypeError as a structured JSON object.
    impl Serialize for PhenotypeError {
        fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
            let code = self.error_code();
            let (code_str, msg) = (code.as_str(), self.to_string());

            let mut map = serializer.serialize_map(Some(2))?;
            map.serialize_entry("code", code_str)?;
            map.serialize_entry("message", &msg)?;
            map.end()
        }
    }

    /// Deserialize PhenotypeError from a structured JSON object.
    impl<'de> Deserialize<'de> for PhenotypeError {
        fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
            enum Field {
                Code,
                Message,
            }

            impl<'de> Deserialize<'de> for Field {
                fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                    struct FieldVisitor;
                    impl<'de> Visitor<'de> for FieldVisitor {
                        type Value = Field;
                        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                            f.write_str("`code` or `message`")
                        }
                        fn visit_str<E: de::Error>(self, v: &str) -> Result<Field, E> {
                            match v {
                                "code" => Ok(Field::Code),
                                "message" => Ok(Field::Message),
                                _ => Err(de::Error::unknown_field(v, &["code", "message"])),
                            }
                        }
                    }
                    d.deserialize_identifier(FieldVisitor)
                }
            }

            struct PhenotypeErrorVisitor;
            impl<'de> Visitor<'de> for PhenotypeErrorVisitor {
                type Value = PhenotypeError;

                fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                    f.write_str("struct PhenotypeError")
                }

                fn visit_map<V: MapAccess<'de>>(self, mut map: V) -> Result<PhenotypeError, V::Error> {
                    let mut code: Option<ErrorCode> = None;
                    let mut message: Option<String> = None;
                    while let Some(key) = map.next_key::<Field>()? {
                        match key {
                            Field::Code => {
                                let s: String = map.next_value()?;
                                // SCREAMING_SNAKE_CASE serde should handle this,
                                // but fallback to trying to parse from string.
                                code = Some(
                                    serde_json::from_value(serde_json::Value::String(s))
                                        .map_err(de::Error::custom)?,
                                );
                            }
                            Field::Message => {
                                message = Some(map.next_value()?);
                            }
                        }
                    }
                    let code = code.unwrap_or(ErrorCode::InternalError);
                    let message = message.unwrap_or_default();
                    // Reconstruct a PhenotypeError from code + message.
                    // This is lossy — the structured payload is gone, but
                    // the wire code + message are preserved.
                    match code {
                        ErrorCode::NotFound => Ok(Self::Value::not_found(message)),
                        ErrorCode::AlreadyExists => Ok(Self::Value::conflict(message)),
                        ErrorCode::ValidationError => Ok(Self::Value::validation(message)),
                        ErrorCode::InvalidArgument => Ok(Self::Value::invalid_input("", message)),
                        ErrorCode::Timeout => Ok(Self::Value::timeout(message, 0)),
                        ErrorCode::Unauthenticated => Ok(Self::Value::authentication(message)),
                        ErrorCode::PermissionDenied => Ok(Self::Value::authorization(message)),
                        ErrorCode::Cancelled => Ok(Self::Value::cancelled(message)),
                        ErrorCode::ResourceExhausted => Ok(Self::Value::rate_limited(message)),
                        ErrorCode::Unavailable => Ok(Self::Value::unavailable(message)),
                        _ => Ok(Self::Value::internal(message)),
                    }
                }
            }

            deserializer.deserialize_struct("PhenotypeError", &["code", "message"], PhenotypeErrorVisitor)
        }
    }
}
