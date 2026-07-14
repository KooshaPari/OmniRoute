//! Provider executors. Each executor implements `omni_core::Executor` and is
//! registered by `ProviderKind`. The router picks the executor for the chosen
//! provider handle; the handler then drives `execute()`.
//!
//! For v1 we ship two executors: OpenAI-compat (covers every provider that
//! speaks the OpenAI Chat Completions wire format) and Anthropic-Messages. New
//! wire formats are added as new executors behind the same trait.

pub mod anthropic;
pub mod openai;

use std::sync::Arc;

use omni_core::provider::ProviderKind;
use omni_core::Executor;

use crate::ServerError;

/// Look up the executor that knows how to talk to the given `ProviderKind`.
/// `OpenAI` and `Default` go to the OpenAI-compat executor (most providers
/// expose an OpenAI-compat surface). `Anthropic`, `Google` (Gemini), and
/// `Vertex` get their own executor when one is registered. Everything else
/// falls back to OpenAI-compat with the provider's `base_url` as the API root.
pub fn executor_for_kind(kind: ProviderKind) -> Arc<dyn Executor> {
    match kind {
        ProviderKind::Anthropic => Arc::new(anthropic::AnthropicExecutor::new()),
        // Gemini's API has its own shape; for v1 we treat it as OpenAI-compat
        // because most gateway providers (OpenRouter, etc.) expose Gemini
        // through an OpenAI-compat surface. Native Gemini support comes in
        // v1.1 once the request/response shape is plumbed through the
        // translator.
        _ => Arc::new(openai::OpenAiCompatExecutor::new()),
    }
}

/// Convert an upstream HTTP error from reqwest into a `ServerError`.
pub fn map_reqwest_error(e: reqwest::Error) -> ServerError {
    if e.is_timeout() {
        ServerError::Upstream(format!("upstream timeout: {e}"))
    } else if e.is_connect() {
        ServerError::Upstream(format!("upstream connect: {e}"))
    } else {
        ServerError::Upstream(e.to_string())
    }
}
