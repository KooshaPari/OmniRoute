//! HTTP route handlers.
//!
//! The router is split into a few submodules: `health`, `openai`, `anthropic`,
//! `admin`. The `router()` function at the bottom composes them.

pub mod admin;
pub mod anthropic;
pub mod health;
pub mod openai;
pub mod v1_models;
pub mod v1_combos;

use axum::{routing::{get, post}, Router};

use crate::App;

pub fn router() -> Router<App> {
    Router::new()
        // Health
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
        .route("/metrics", get(admin::metrics))
        .route("/.well-known/agent.json", get(admin::agent_card))
        // OpenAI-compatible
        .route("/v1/chat/completions", post(openai::chat_completions))
        .route("/v1/embeddings", post(openai::embeddings))
        .route("/v1/models", get(v1_models::list_models))
        .route("/v1/models/{id}", get(v1_models::get_model))
        .route("/v1/audio/speech", post(openai::audio_speech))
        .route("/v1/audio/transcriptions", post(openai::audio_transcriptions))
        .route("/v1/images/generations", post(openai::images_generations))
        .route("/v1/moderations", post(openai::moderations))
        .route("/v1/rerank", post(openai::rerank))
        .route("/v1/responses", post(openai::responses))
        .route("/v1/combos", post(v1_combos::combos))
        // Anthropic-compatible
        .route("/v1/messages", post(anthropic::messages))
        .route("/v1/messages/count_tokens", post(anthropic::count_tokens))
        // A2A
        .route("/v1/agents/health", get(admin::agents_health))
        .route("/v1/agents/tasks", post(admin::submit_task))
        .route("/v1/agents/tasks/{id}", get(admin::get_task))
        // Me
        .route("/v1/me/status", get(admin::me_status))
}
