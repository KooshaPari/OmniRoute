//! OpenAI-style error envelope.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// The standard OpenAI error envelope. Always returned with a 4xx/5xx status
/// code; the `type` field discriminates the kind of failure.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiErrorEnvelope {
    pub error: ApiError,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiError {
    pub message: String,
    #[serde(rename = "type")]
    pub kind: ApiErrorType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub param: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    /// Provider-specific extra fields (e.g. Azure's `innererror`).
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiErrorType {
    InvalidRequestError,
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    RateLimitError,
    ServerError,
    ServiceUnavailableError,
    TimeoutError,
    /// Catch-all for unknown provider error strings.
    Other,
}

impl ApiError {
    /// Build a simple internal error.
    #[must_use]
    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            kind: ApiErrorType::ServerError,
            param: None,
            code: None,
            extra: IndexMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_envelope_round_trip() {
        let env = ApiErrorEnvelope {
            error: ApiError::internal("boom"),
        };
        let s = serde_json::to_string(&env).unwrap();
        assert!(s.contains("\"type\":\"server_error\""));
        let back: ApiErrorEnvelope = serde_json::from_str(&s).unwrap();
        assert_eq!(env, back);
    }
}
