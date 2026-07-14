//! Provider metadata: what to advertise in `/v1/models`, in the management
//! API, and in the A2A `agent.json` card. Backed by the App's in-memory
//! `ProviderRegistry` plus the env-seeded `seed_providers_from_env` table.

use serde::Serialize;
use std::sync::Arc;

use crate::App;

#[derive(Debug, Clone, Serialize)]
pub struct ProviderSummary {
    pub id: String,
    pub display_name: String,
    pub base_url: String,
    pub models: Vec<String>,
    pub has_credential: bool,
    pub kind: String,
}

/// Enumerate every provider currently in the registry, with a flag for
/// whether we have a credential cached for it.
pub fn list(app: &App) -> Vec<ProviderSummary> {
    app.registry
        .list()
        .iter()
        .map(|h| ProviderSummary {
            id: h.id.0.clone(),
            display_name: h.display_name.clone(),
            base_url: h.base_url.clone(),
            models: h
                .models
                .iter()
                .filter(|m| m.as_str() != "*")
                .cloned()
                .collect(),
            has_credential: app.credential_for(&h.id.0).is_some(),
            kind: provider_kind_label(&h.id.0).to_string(),
        })
        .collect()
}

pub fn provider_kind_label(id: &str) -> &'static str {
    match id {
        "openai" => "openai",
        "anthropic" => "anthropic",
        "groq" => "groq",
        "openrouter" => "openrouter",
        "together" => "together",
        "fireworks" => "fireworks",
        "ollama" => "ollama",
        "gemini" => "google",
        _ => "openai_compat",
    }
}

pub fn _force_arc(_: Arc<()>) {}
