//! Model metadata and capabilities.
//!
//! Mirrors the Go native client's `Model` struct
//! (`native-clients/omniroute-go/internal/provider/registry/provider.go`).

use serde::{Deserialize, Serialize};

/// A single model entry in a provider's catalog.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Model {
    /// Model ID (e.g. `"gpt-4o"`, `"claude-3-5-sonnet-20241022"`).
    pub id: String,
    /// Always `"model"` for OpenAI compatibility.
    pub object: String,
    /// Unix timestamp of when the model was registered.
    pub created: i64,
    /// Owner identifier (e.g. `"openai"`, `"anthropic"`).
    pub owned_by: String,
    /// Set by the runtime — which provider serves this model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
}

impl Model {
    /// Build a minimal `Model` entry.
    pub fn new(id: impl Into<String>, owned_by: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            object: "model".into(),
            created: chrono::Utc::now().timestamp(),
            owned_by: owned_by.into(),
            provider: None,
        }
    }

    /// Builder: attach a `provider` ID (set by the registry).
    pub fn with_provider(mut self, provider: impl Into<String>) -> Self {
        self.provider = Some(provider.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_minimal() {
        let m = Model::new("gpt-4o", "openai");
        assert_eq!(m.id, "gpt-4o");
        assert_eq!(m.owned_by, "openai");
        assert_eq!(m.object, "model");
        assert!(m.created > 0);
        assert!(m.provider.is_none());
    }

    #[test]
    fn model_with_provider_serializes() {
        let m = Model::new("claude-3-5-sonnet-20241022", "anthropic").with_provider("anthropic");
        let j = serde_json::to_string(&m).unwrap();
        assert!(j.contains("\"provider\":\"anthropic\""));
        let de: Model = serde_json::from_str(&j).unwrap();
        assert_eq!(de.provider.as_deref(), Some("anthropic"));
    }
}