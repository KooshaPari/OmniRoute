use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub const DEFAULT: &'static str = "default";

    pub fn default() -> Self {
        Self(Self::DEFAULT.into())
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<&str> for ProviderId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    #[serde(rename = "openai")]
    OpenAI,
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
    /// Catch-all for fork-specific providers (claude-web, chatgpt-web, ...).
    Browser,
    /// Stateless passthrough / mock.
    Default,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    pub id: ProviderId,
    pub kind: ProviderKind,
    pub display_name: String,
    pub base_url: String,
    pub models: Vec<String>,
    /// Default request headers (e.g. User-Agent, x-client).
    pub default_headers: BTreeMap<String, String>,
    /// Whether this provider requires OAuth / browser session.
    pub requires_oauth: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub metadata: ProviderMetadata,
    /// API key, OAuth token, or empty for `default`.
    pub credential: Option<String>,
    /// Per-provider rate limit (requests / minute).
    pub rate_limit_rpm: Option<u32>,
}

impl Provider {
    #[must_use]
    pub fn new(metadata: ProviderMetadata) -> Self {
        Self { metadata, credential: None, rate_limit_rpm: None }
    }
}
