//! # OmniRoute provider adapters
//!
//! Concrete implementations of [`omniroute_core::Provider`] for each upstream
//! LLM provider. Phase 2 ships:
//!
//! - [`openai::OpenAIProvider`] — OpenAI + OpenAI-compatible (Together,
//!   Groq, Fireworks, OpenRouter, vLLM, Ollama Cloud, …)
//! - [`anthropic::AnthropicProvider`] — Anthropic Messages API
//! - [`gemini::GeminiProvider`] — Google Gemini Generative Language API
//! - [`registry::ProviderRegistry`] — runtime registry helper that registers
//!   providers from env vars (`OMNIROUTE_OPENAI_API_KEY`, etc.)
//!
//! Phase 3 will add Anthropic, Gemini, Bedrock adapters.

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod anthropic;
pub mod gemini;
pub mod openai;
pub mod registry;

pub use anthropic::{AnthropicProvider, ProviderInit as AnthropicProviderInit};
pub use gemini::{GeminiProvider, ProviderInit as GeminiProviderInit};
pub use openai::{OpenAIProvider, ProviderInit};
pub use registry::{ProviderConfig, ProviderRegistryBuilder, register_defaults_from_env};