//! OmniRoute wire types for OpenAI, Claude, Gemini, Codex, and A2A.
//!
//! This crate is the foundation of the OmniRoute Rust rewrite. It defines
//! request/response/SSE types for every major LLM provider wire format and
//! exposes them to all downstream crates (translator, router, server).
//!
//! Conventions:
//! - All public types are `Send + Sync` and derive `Debug, Clone, Serialize, Deserialize, PartialEq`.
//! - Field naming follows each provider's official spec verbatim
//!   (snake_case for OpenAI/Codex, snake_case for Claude, camelCase for Gemini).
//! - SSE event types are tagged enums (`#[serde(tag = "type", rename_all = "snake_case")]`).
//! - `Option<T>` denotes genuinely optional fields; defaultable fields use `#[serde(default)]`.
//! - utoipa `ToSchema` derives are present on top-level request/response types
//!   so the server can publish an OpenAPI document.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::struct_excessive_bools)]

pub mod a2a;
pub mod claude;
pub mod codex;
pub mod gemini;
pub mod openai;
pub mod shared;

pub use shared::{RequestId, Role as SharedRole, StopReason, Timestamp, UsageBucket};

/// Top-level wire formats OmniRoute speaks. New formats must be added here
/// and routed in `omni-translator`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WireFormat {
    Openai,
    OpenaiResponses,
    Claude,
    Gemini,
    Codex,
    A2a,
}

impl WireFormat {
    /// Canonical lowercase identifier used in headers, env vars, and logs.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::OpenaiResponses => "openai-responses",
            Self::Claude => "claude",
            Self::Gemini => "gemini",
            Self::Codex => "codex",
            Self::A2a => "a2a",
        }
    }

    /// Parse a wire format from a string. Accepts common aliases.
    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "openai" | "openai-chat" | "openai-chatcompletion" => Some(Self::Openai),
            "openai-responses" | "responses" => Some(Self::OpenaiResponses),
            "claude" | "anthropic" => Some(Self::Claude),
            "gemini" | "google" => Some(Self::Gemini),
            "codex" | "openai-codex" => Some(Self::Codex),
            "a2a" => Some(Self::A2a),
            _ => None,
        }
    }
}

impl std::fmt::Display for WireFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
