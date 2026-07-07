//! # OmniRoute core
//!
//! Provider-agnostic types, traits, and errors for the OmniRoute Rust data plane.
//!
//! This crate has **no dependency on `tokio`, `hyper`, or any HTTP client**.
//! The [`Provider`] trait uses `async_trait` so adapters in other crates can
//! plug in their preferred runtime, and the data plane binary
//! (`omniroute-runtime`) is the only crate that pulls in `tokio`/`hyper`.
//!
//! ## Modules
//!
//! - [`types`]    — wire-compatible shapes (OpenAI / Anthropic / Gemini)
//! - [`error`]    — typed [`ProviderError`] + retry classification
//! - [`provider`] — the [`Provider`] trait
//! - [`model`]    — model metadata and capabilities
//! - [`usage`]    — token-counting helpers
//! - [`credentials`] — credential shape and rotation hooks
//!
//! ## Polyglot binding (ADR-032)
//!
//! This crate is bound to the TypeScript control plane via `T3-N (napi-rs)`,
//! exposed by the `omniroute-bindings` crate (Phase 3). The hot-path data plane
//! binary does not require the napi-rs dependency.

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod credentials;
pub mod error;
pub mod model;
pub mod provider;
pub mod types;
pub mod usage;

// Re-export the most-used types at the crate root.
pub use crate::credentials::Credentials;
pub use crate::error::{ProviderError, RetryConfig, backoff_delay};
pub use crate::model::Model;
pub use crate::provider::{Context, Provider, ProviderRegistry};
pub use crate::types::{
    ApiError, ChatMessage, ChatRequest, ChatResponse, Choice, StreamChunk, StreamChoice, Tool,
    ToolCall, ToolCallFunction, ToolFunction, Usage,
};