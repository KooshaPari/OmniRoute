//! # OmniRoute provider adapters
//!
//! Concrete implementations of [`omniroute_core::Provider`] for each upstream
//! LLM provider. Phase 2 ships:
//!
//! - [`openai::OpenAIProvider`] — OpenAI + OpenAI-compatible (Together,
//!   Groq, Fireworks, OpenRouter, vLLM, Ollama Cloud, …)
//! - [`registry::ProviderRegistry`] — runtime registry helper that registers
//!   providers from env vars (`OMNIROUTE_OPENAI_API_KEY`, etc.)
//!
//! Phase 3 will add Anthropic, Gemini, Bedrock adapters.

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod openai;
pub mod registry;

pub use openai::{OpenAIProvider, ProviderInit};
pub use registry::{ProviderConfig, ProviderRegistryBuilder, register_defaults_from_env};