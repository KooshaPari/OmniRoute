//! OmniRoute HTTP server.
//!
//! Wires together: axum, the router, the translator, the providers, the storage,
//! and the telemetry. Exposes a single `App` struct that you `serve()`.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod auth;
pub mod dispatcher;
pub mod executors;
pub mod handlers;
pub mod providers;
pub mod state;
pub mod telemetry;

pub use state::{App, AppConfig, AuthKey, ServerError, ServerResult};

use std::collections::BTreeMap;
use std::net::SocketAddr;

use axum::Router as AxumRouter;
use tracing::info;

use omni_router::{ProviderHandle, ProviderId};

/// Build the application router (axum). Pure function — useful for tests.
pub fn build_router(app: App) -> AxumRouter {
    handlers::router().with_state(app)
}

/// Serve the app on the given bind address until SIGTERM.
pub async fn serve(app: App, addr: SocketAddr) -> ServerResult<()> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let router = build_router(app);
    info!(%addr, "omni-server listening");
    axum::serve(listener, router).await?;
    Ok(())
}

/// Default set of providers we auto-seed into the in-memory registry on boot
/// when their respective API key env vars are present. Each entry is
/// `(env_var, provider_id, display_name, base_url, models)`.
pub const SEED_PROVIDERS: &[(&str, &str, &str, &str, &[&str])] = &[
    (
        "OPENAI_API_KEY",
        "openai",
        "OpenAI",
        "https://api.openai.com",
        &["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o3-mini", "o4-mini"],
    ),
    (
        "ANTHROPIC_API_KEY",
        "anthropic",
        "Anthropic",
        "https://api.anthropic.com",
        &["claude-opus-4", "claude-sonnet-4-5", "claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    ),
    (
        "GROQ_API_KEY",
        "groq",
        "Groq",
        "https://api.groq.com/openai",
        &["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    ),
    (
        "OPENROUTER_API_KEY",
        "openrouter",
        "OpenRouter",
        "https://openrouter.ai/api",
        &["auto"],
    ),
    (
        "TOGETHER_API_KEY",
        "together",
        "Together AI",
        "https://api.together.xyz",
        &["meta-llama/Llama-3-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
    ),
    (
        "FIREWORKS_API_KEY",
        "fireworks",
        "Fireworks AI",
        "https://api.fireworks.ai/inference",
        &["accounts/fireworks/models/llama-v3p3-70b-instruct"],
    ),
    (
        "OLLAMA_BASE_URL",
        "ollama",
        "Ollama (local)",
        "http://127.0.0.1:11434/v1",
        &["llama3.2", "qwen2.5", "mistral", "gemma2"],
    ),
    (
        "GEMINI_API_KEY",
        "gemini",
        "Google Gemini",
        "https://generativelanguage.googleapis.com",
        &["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    ),
];

/// Seed the in-memory provider registry from environment variables. Any
/// provider with a non-empty env var gets registered. The credential is
/// stored on the App's `BTreeMap<String, String>` credential cache so the
/// dispatcher can find it at request time. (The DB `provider_records` table
/// is the durable home for credentials; this is the cheap path for
/// zero-config boot.)
pub fn seed_providers_from_env(app: &App) {
    use std::sync::Mutex;
    let cache: &Mutex<BTreeMap<String, String>> = &*app.credentials;
    for (env_var, id, display, base_url, models) in SEED_PROVIDERS {
        if let Ok(val) = std::env::var(env_var) {
            if val.is_empty() {
                continue;
            }
            let mut h = ProviderHandle::new(
                ProviderId::new(*id),
                (*display).to_string(),
                (*base_url).to_string(),
            );
            h.models = models.iter().map(|s| s.to_string()).collect();
            h.cost_per_1k_prompt = 0.0;
            h.cost_per_1k_completion = 0.0;
            h.fallback_priority = usize::MAX;
            h.weight = 1;
            app.with_provider(h);
            // Cache the credential for the dispatcher.
            if let Ok(mut g) = cache.lock() {
                g.insert((*id).to_string(), val);
            }
            info!(provider = *id, "seeded provider from env");
        }
    }
}
