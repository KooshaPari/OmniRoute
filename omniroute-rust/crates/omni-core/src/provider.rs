//! Provider abstraction: identity, kind, metadata, and runtime config.
//!
//! - [`ProviderId`] — opaque slug like `"openai"`, `"anthropic"`, or a
//!   fork-specific id like `"claude-web"`.
//! - [`ProviderKind`] — coarse classification used by the translator and
//!   the wire-format picker. Stable across versions (snake_case in JSON).
//! - [`ProviderMetadata`] — catalog-style metadata (base URL, default
//!   headers, model list, OAuth requirement).
//! - [`Provider`] — runtime struct bundling metadata + credential +
//!   per-provider rate limit.
//!
//! All public types implement [`ProviderMetadata::validate`]; the runtime
//! loader should call it before accepting a provider into the registry.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::error::{Error, ErrorKind, Result};
use crate::executor::RetryPolicy;
use crate::ids::ModelId;

/// Stable identifier for a provider. Opaque slug (not the same as a
/// display name).
///
/// ```
/// use omni_core::provider::ProviderId;
///
/// let p = ProviderId::from("openai");
/// assert_eq!(p.as_str(), "openai");
/// assert_eq!(p.to_string(), "openai");
/// assert_ne!(p, ProviderId::default());
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ProviderId(pub String);

impl ProviderId {
    /// Default sentinel for the catch-all provider.
    pub const DEFAULT: &'static str = "default";

    /// Borrow the inner string.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// True if the slug is empty after trimming.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.0.trim().is_empty()
    }
}

impl Default for ProviderId {
    fn default() -> Self {
        Self(Self::DEFAULT.into())
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl AsRef<str> for ProviderId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ProviderId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for ProviderId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&String> for ProviderId {
    fn from(s: &String) -> Self {
        Self(s.clone())
    }
}

/// Coarse provider classification used by the translator and the
/// executor factory.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    #[serde(rename = "openai")]
    OpenAI,
    #[default]
    #[serde(rename = "anthropic")]
    Anthropic,
    #[serde(rename = "google")]
    Google,
    Cohere,
    Mistral,
    Groq,
    Bedrock,
    Vertex,
    Azure,
    /// Catch-all for fork-specific providers (`claude-web`, `chatgpt-web`,
    /// ...) that drive their own bespoke executors.
    Browser,
    /// Stateless passthrough / mock.
    Default,
    Unknown,
}

impl ProviderKind {
    /// Stable, snake_case string form (matches the serde representation).
    ///
    /// ```
    /// use omni_core::provider::ProviderKind;
    ///
    /// assert_eq!(ProviderKind::OpenAI.as_str(), "openai");
    /// assert_eq!(ProviderKind::Bedrock.as_str(), "bedrock");
    /// ```
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OpenAI => "openai",
            Self::Anthropic => "anthropic",
            Self::Google => "google",
            Self::Cohere => "cohere",
            Self::Mistral => "mistral",
            Self::Groq => "groq",
            Self::Bedrock => "bedrock",
            Self::Vertex => "vertex",
            Self::Azure => "azure",
            Self::Browser => "browser",
            Self::Default => "default",
            Self::Unknown => "unknown",
        }
    }
}

impl fmt::Display for ProviderKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Catalog-style metadata for a provider. Persistable to SQLite and
/// round-trips through serde.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProviderMetadata {
    pub id: ProviderId,
    pub kind: ProviderKind,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    /// Base URL for the upstream API (no trailing slash).
    pub base_url: String,
    /// Canonical model slugs this provider exposes.
    pub models: Vec<ModelId>,
    /// Default request headers (e.g. `User-Agent`, `x-client`).
    pub default_headers: BTreeMap<String, String>,
    /// Whether this provider requires OAuth / browser session.
    pub requires_oauth: bool,
}

impl ProviderMetadata {
    /// Validate structural invariants. Returns an [`Error`] with kind
    /// [`ErrorKind::ConfigInvalid`] on failure.
    ///
    /// ```
    /// use omni_core::provider::{ProviderMetadata, ProviderKind, ProviderId};
    /// use omni_core::ids::ModelId;
    /// use std::collections::BTreeMap;
    ///
    /// let md = ProviderMetadata {
    ///     id: ProviderId::from("openai"),
    ///     kind: ProviderKind::OpenAI,
    ///     display_name: "OpenAI".into(),
    ///     base_url: "https://api.openai.com/v1".into(),
    ///     models: vec![ModelId::from("gpt-4o")],
    ///     default_headers: BTreeMap::new(),
    ///     requires_oauth: false,
    /// };
    /// assert!(md.validate().is_ok());
    /// ```
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "provider id must not be empty",
            ));
        }
        if self.display_name.trim().is_empty() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "provider display_name must not be empty",
            ));
        }
        let base = self.base_url.trim();
        if base.is_empty() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "provider base_url must not be empty",
            ));
        }
        if url::Url::parse(base).is_err() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "provider base_url must be a valid URL",
            ));
        }
        // Reject model duplicates — they cause shadow entries in the catalog.
        let mut seen = std::collections::BTreeSet::new();
        for m in &self.models {
            if !seen.insert(m.clone()) {
                return Err(Error::with_kind(
                    ErrorKind::ConfigInvalid,
                    format!("provider has duplicate model entry: {m}"),
                ));
            }
        }
        Ok(())
    }
}

/// Runtime provider: metadata + credential + per-provider rate limit +
/// retry policy override.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub metadata: ProviderMetadata,
    /// API key, OAuth token, or empty for [`ProviderId::default`].
    pub credential: Option<String>,
    /// Per-provider rate limit (requests / minute). `None` falls back to
    /// the global [`crate::config::ProvidersConfig::rate_limit_per_minute`].
    pub rate_limit_rpm: Option<u32>,
    /// Per-provider retry override. `None` falls back to the executor's
    /// default policy.
    pub retry_policy: Option<RetryPolicy>,
}

impl Provider {
    /// Construct a provider from metadata with no credential and no
    /// rate-limit override.
    #[must_use]
    pub fn new(metadata: ProviderMetadata) -> Self {
        Self {
            metadata,
            credential: None,
            rate_limit_rpm: None,
            retry_policy: None,
        }
    }

    /// Convenience: set credential and return self (builder).
    #[must_use]
    pub fn with_credential(mut self, credential: impl Into<String>) -> Self {
        self.credential = Some(credential.into());
        self
    }

    /// Validate the underlying metadata. Convenience wrapper.
    pub fn validate(&self) -> Result<()> {
        self.metadata.validate()
    }

    /// Borrow the provider id.
    #[must_use]
    pub fn id(&self) -> &ProviderId {
        &self.metadata.id
    }

    /// Borrow the provider kind.
    #[must_use]
    pub fn kind(&self) -> ProviderKind {
        self.metadata.kind
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_metadata() -> ProviderMetadata {
        ProviderMetadata {
            id: ProviderId::from("openai"),
            kind: ProviderKind::OpenAI,
            display_name: "OpenAI".into(),
            base_url: "https://api.openai.com/v1".into(),
            models: vec![ModelId::from("gpt-4o"), ModelId::from("gpt-4o-mini")],
            default_headers: BTreeMap::new(),
            requires_oauth: false,
        }
    }

    #[test]
    fn validate_ok_for_typical_provider() {
        assert!(make_metadata().validate().is_ok());
    }

    #[test]
    fn validate_rejects_empty_id() {
        let mut m = make_metadata();
        m.id = ProviderId::from("");
        assert!(m.validate().is_err());
    }

    #[test]
    fn validate_rejects_empty_display_name() {
        let mut m = make_metadata();
        m.display_name = "  ".into();
        assert!(m.validate().is_err());
    }

    #[test]
    fn validate_rejects_invalid_url() {
        let mut m = make_metadata();
        m.base_url = "not a url".into();
        assert!(m.validate().is_err());
    }

    #[test]
    fn validate_rejects_duplicate_models() {
        let mut m = make_metadata();
        m.models = vec![ModelId::from("gpt-4o"), ModelId::from("gpt-4o")];
        let err = m.validate().unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
    }

    #[test]
    fn provider_kind_serializes_snake_case() {
        let s = serde_json::to_string(&ProviderKind::OpenAI).unwrap();
        assert_eq!(s, "\"openai\"");
        let s = serde_json::to_string(&ProviderKind::Bedrock).unwrap();
        assert_eq!(s, "\"bedrock\"");
    }

    #[test]
    fn provider_kind_as_str_matches_serde() {
        // Every kind round-trips through serde identically.
        for k in [
            ProviderKind::OpenAI,
            ProviderKind::Anthropic,
            ProviderKind::Google,
            ProviderKind::Cohere,
            ProviderKind::Mistral,
            ProviderKind::Groq,
            ProviderKind::Bedrock,
            ProviderKind::Vertex,
            ProviderKind::Azure,
            ProviderKind::Browser,
            ProviderKind::Default,
            ProviderKind::Unknown,
        ] {
            let s = serde_json::to_string(&k).unwrap();
            let unquoted = s.trim_matches('"');
            assert_eq!(unquoted, k.as_str(), "mismatch for {k:?}");
        }
    }

    #[test]
    fn provider_id_round_trips() {
        let p = ProviderId::from("openai");
        assert_eq!(p.to_string(), "openai");
        assert_eq!(p, ProviderId::from("openai"));
        assert_ne!(p, ProviderId::default());
    }

    #[test]
    fn provider_new_has_no_credential_or_overrides() {
        let p = Provider::new(make_metadata());
        assert!(p.credential.is_none());
        assert!(p.rate_limit_rpm.is_none());
        assert!(p.retry_policy.is_none());
        assert_eq!(p.id(), &ProviderId::from("openai"));
        assert_eq!(p.kind(), ProviderKind::OpenAI);
    }
}
