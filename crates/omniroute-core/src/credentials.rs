//! Per-request credentials: bearer key, OAuth access token, or no auth.
//!
//! The runtime layer resolves a connection's stored credential into a
//! [`Credentials`] value before each dispatch. Adapters inspect this
//! value and apply the right header shape (e.g. `Authorization: Bearer <key>`
//! vs `x-api-key: <key>` vs `Cookie: session=<token>`).

use serde::{Deserialize, Serialize};

/// Authentication scheme for an upstream provider call.
///
/// Three variants cover all current providers; new variants should only
/// be added when the wire-level shape genuinely differs (e.g. AWS SigV4).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Credentials {
    /// `Authorization: Bearer <token>` (OpenAI, Anthropic, Gemini, …).
    Bearer {
        /// The bearer token / API key.
        token: String,
    },

    /// `x-api-key: <key>` (Anthropic native, some gateways).
    ApiKey {
        /// The raw key.
        key: String,
    },

    /// No authentication required (local/self-hosted with no auth, e.g. ollama).
    None,
}

impl Credentials {
    /// Convenience: build a `Bearer` credential from a token string.
    pub fn bearer(token: impl Into<String>) -> Self {
        Self::Bearer {
            token: token.into(),
        }
    }

    /// Convenience: build an `ApiKey` credential from a key string.
    pub fn api_key(key: impl Into<String>) -> Self {
        Self::ApiKey { key: key.into() }
    }

    /// Convenience: build a `None` credential.
    pub fn none() -> Self {
        Self::None
    }

    /// True if no credentials are set (or the token is empty).
    pub fn is_empty(&self) -> bool {
        match self {
            Credentials::None => true,
            Credentials::Bearer { token } => token.is_empty(),
            Credentials::ApiKey { key } => key.is_empty(),
        }
    }

    /// Render the bearer token (`Bearer` or `ApiKey`); `None` returns `None`.
    pub fn as_bearer_token(&self) -> Option<&str> {
        match self {
            Credentials::Bearer { token } => Some(token.as_str()),
            Credentials::ApiKey { key } => Some(key.as_str()),
            Credentials::None => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bearer_token_round_trip() {
        let c = Credentials::bearer("sk-test");
        assert_eq!(c.as_bearer_token(), Some("sk-test"));
        assert!(!c.is_empty());
    }

    #[test]
    fn api_key_treated_as_bearer_token() {
        let c = Credentials::api_key("sk-test");
        assert_eq!(c.as_bearer_token(), Some("sk-test"));
    }

    #[test]
    fn none_has_no_token() {
        let c = Credentials::none();
        assert!(c.is_empty());
        assert_eq!(c.as_bearer_token(), None);
    }

    #[test]
    fn empty_token_is_empty() {
        assert!(Credentials::bearer("").is_empty());
        assert!(Credentials::api_key("").is_empty());
    }

    #[test]
    fn serde_tagged_representation() {
        let c = Credentials::bearer("sk-x");
        let j = serde_json::to_string(&c).unwrap();
        assert_eq!(j, r#"{"type":"bearer","token":"sk-x"}"#);
        let de: Credentials = serde_json::from_str(&j).unwrap();
        assert_eq!(de, c);
    }
}