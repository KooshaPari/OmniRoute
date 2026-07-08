//! Builder for [`ProviderRegistry`] that wires defaults from environment.
//!
//! The runtime layer calls [`register_defaults_from_env`] at startup; if
//! `OMNIROUTE_OPENAI_API_KEY` is set, an [`OpenAIProvider`] is registered
//! under the `"openai"` ID. Same pattern for Anthropic (`OMNIROUTE_ANTHROPIC_API_KEY`)
//! and Gemini (`OMNIROUTE_GEMINI_API_KEY`).

use std::collections::HashMap;
use std::sync::Arc;

use omniroute_core::ProviderRegistry;

use crate::anthropic::{AnthropicProvider, ProviderInit as AnthropicProviderInit};
use crate::gemini::{GeminiProvider, ProviderInit as GeminiProviderInit};
use crate::openai::{OpenAIProvider, ProviderInit};

/// Per-provider configuration for the registry builder.
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    /// Provider ID (e.g. `"openai"`).
    pub id: String,
    /// API key / bearer token.
    pub api_key: String,
    /// Optional base URL override (e.g. for OpenAI-compatible providers).
    pub base_url: Option<String>,
}

/// Build a [`ProviderRegistry`] from a list of provider configs.
pub struct ProviderRegistryBuilder {
    configs: Vec<ProviderConfig>,
}

impl ProviderRegistryBuilder {
    /// Create an empty builder.
    pub fn new() -> Self {
        Self {
            configs: Vec::new(),
        }
    }

    /// Add a single provider config.
    pub fn with(mut self, cfg: ProviderConfig) -> Self {
        self.configs.push(cfg);
        self
    }

    /// Bulk-add configs from an iterator.
    pub fn with_all<I>(mut self, cfgs: I) -> Self
    where
        I: IntoIterator<Item = ProviderConfig>,
    {
        self.configs.extend(cfgs);
        self
    }

    /// Consume the builder and return a populated registry.
    pub fn build(self) -> ProviderRegistry {
        let registry = ProviderRegistry::new();
        for cfg in self.configs {
            match cfg.id.as_str() {
                "anthropic" | "claude" => {
                    let mut init = AnthropicProviderInit::new(&cfg.id, &cfg.api_key);
                    if let Some(url) = cfg.base_url {
                        init = init.with_base_url(url);
                    }
                    match AnthropicProvider::new(init) {
                        Ok(p) => registry.register(p),
                        Err(e) => tracing::warn!(provider = %cfg.id, error = %e, "skipping registration"),
                    }
                }
                "gemini" | "palm" => {
                    let mut init = GeminiProviderInit::new(&cfg.id, &cfg.api_key);
                    if let Some(url) = cfg.base_url {
                        init = init.with_base_url(url);
                    }
                    match GeminiProvider::new(init) {
                        Ok(p) => registry.register(p),
                        Err(e) => tracing::warn!(provider = %cfg.id, error = %e, "skipping registration"),
                    }
                }
                _ => {
                    // Default to OpenAI-compatible (covers openai, groq, together, etc.).
                    let mut init = ProviderInit::new(cfg.id.clone(), cfg.api_key);
                    if let Some(url) = cfg.base_url {
                        init = init.with_base_url(url);
                    }
                    match OpenAIProvider::new(init) {
                        Ok(p) => registry.register(p),
                        Err(e) => tracing::warn!(
                            provider = %cfg.id,
                            error = %e,
                            "skipping provider registration"
                        ),
                    }
                }
            }
        }
        registry
    }
}

impl Default for ProviderRegistryBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Register well-known providers from environment variables.
///
/// Currently reads:
/// - `OMNIROUTE_OPENAI_API_KEY` — registers as `"openai"`
/// - `OMNIROUTE_OPENAI_BASE_URL` — overrides the base URL
/// - `OMNIROUTE_GROQ_API_KEY` — registers as `"groq"`
/// - `OMNIROUTE_TOGETHER_API_KEY` — registers as `"together"`
/// - `OMNIROUTE_FIREWORKS_API_KEY` — registers as `"fireworks"`
/// - `OMNIROUTE_OPENROUTER_API_KEY` — registers as `"openrouter"`
/// - `OMNIROUTE_ANTHROPIC_API_KEY` — registers as `"anthropic"`
/// - `OMNIROUTE_GEMINI_API_KEY` — registers as `"gemini"`
pub fn register_defaults_from_env() -> ProviderRegistry {
    let mut builder = ProviderRegistryBuilder::new();
    let mut cfgs: HashMap<&'static str, (&'static str, &'static str)> = HashMap::new();
    cfgs.insert("openai", ("OMNIROUTE_OPENAI_API_KEY", "OMNIROUTE_OPENAI_BASE_URL"));
    cfgs.insert("groq", ("OMNIROUTE_GROQ_API_KEY", "OMNIROUTE_GROQ_BASE_URL"));
    cfgs.insert(
        "together",
        ("OMNIROUTE_TOGETHER_API_KEY", "OMNIROUTE_TOGETHER_BASE_URL"),
    );
    cfgs.insert(
        "fireworks",
        ("OMNIROUTE_FIREWORKS_API_KEY", "OMNIROUTE_FIREWORKS_BASE_URL"),
    );
    cfgs.insert(
        "openrouter",
        ("OMNIROUTE_OPENROUTER_API_KEY", "OMNIROUTE_OPENROUTER_BASE_URL"),
    );
    cfgs.insert(
        "anthropic",
        ("OMNIROUTE_ANTHROPIC_API_KEY", "OMNIROUTE_ANTHROPIC_BASE_URL"),
    );
    cfgs.insert(
        "gemini",
        ("OMNIROUTE_GEMINI_API_KEY", "OMNIROUTE_GEMINI_BASE_URL"),
    );

    for (id, (key_env, base_env)) in cfgs {
        if let Ok(api_key) = std::env::var(key_env) {
            if api_key.is_empty() {
                continue;
            }
            let base_url = std::env::var(base_env).ok();
            let provider = Arc::new(id);
            let cfg = ProviderConfig {
                id: provider.as_ref().to_string(),
                api_key,
                base_url,
            };
            builder = builder.with(cfg);
        }
    }

    builder.build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_builder_yields_empty_registry() {
        let reg = ProviderRegistryBuilder::new().build();
        assert!(reg.ids().is_empty());
    }

    #[test]
    fn builder_registers_provider() {
        let cfg = ProviderConfig {
            id: "openai".into(),
            api_key: "sk-test".into(),
            base_url: None,
        };
        let reg = ProviderRegistryBuilder::new().with(cfg).build();
        assert!(reg.get("openai").is_some());
    }

    #[test]
    fn from_env_skips_unset_keys() {
        // SAFETY: tests are serial in this scope.
        std::env::remove_var("OMNIROUTE_OPENAI_API_KEY");
        std::env::remove_var("OMNIROUTE_GROQ_API_KEY");
        std::env::remove_var("OMNIROUTE_ANTHROPIC_API_KEY");
        std::env::remove_var("OMNIROUTE_GEMINI_API_KEY");
        let reg = register_defaults_from_env();
        assert!(reg.ids().is_empty());
    }
}