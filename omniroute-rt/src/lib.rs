//! # OmniRoute Runtime — ADR-033 Rust Data Plane Phase 0
//!
//! Minimum viable executor proving the Rust data plane pattern before
//! scaling to multi-provider, multi-strategy routing.
//!
//! ## Current scope
//!
//! - [`ProviderExecutor`] trait for generic request dispatch
//! - [`OpenAiExecutor`] — OpenAI `/v1/chat/completions` via reqwest
//! - SSE streaming via `tokio-stream`
//! - OTel-compatible metrics (histogram + counter)
//!
//! ## Non-goals (Phase 0)
//!
//! - Multi-provider routing, config reload, full TS parity, Bifrost integration.

pub mod openai;
pub mod sse;
pub mod metrics;

use async_trait::async_trait;
use bytes::Bytes;
use std::time::Duration;
use thiserror::Error;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors produced by a [`ProviderExecutor`].
#[derive(Error, Debug)]
pub enum ExecutorError {
    /// Upstream returned a non-2xx status.
    #[error("upstream error: {status} {body}")]
    Upstream { status: u16, body: String },

    /// HTTP transport failure (connect timeout, DNS, TLS, etc.).
    #[error("transport: {0}")]
    Transport(#[from] reqwest::Error),

    /// IO / stream error.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    /// Payload serialization failed.
    #[error("serialization: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Operation timed out.
    #[error("timeout after {0:?}")]
    Timeout(Duration),
}

/// Convenience alias.
pub type Result<T> = std::result::Result<T, ExecutorError>;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/// A provider-agnostic LLM chat-completion request.
///
/// In Phase 0 this is a thin wrapper around the JSON body. Future phases will
/// add structured fields for model, messages, tools, etc., but for now we keep
/// it generic to avoid over-abstracting before we have benchmarks.
#[derive(Debug, Clone)]
pub struct ExecuteRequest {
    /// Target upstream URL (e.g. `https://api.openai.com/v1/chat/completions`).
    pub url: String,
    /// HTTP method (currently always POST).
    pub method: String,
    /// Request headers (Authorization, Content-Type, etc.).
    pub headers: Vec<(String, String)>,
    /// JSON body.
    pub body: serde_json::Value,
    /// SSE streaming — if `Some(chunk_size)`, the response body is returned
    /// as a stream of byte chunks.
    pub stream: Option<usize>,
    /// Per-request timeout (None = use client default).
    pub timeout: Option<Duration>,
}

/// A provider-agnostic response.
#[derive(Debug)]
pub struct ExecuteResponse {
    /// HTTP status from upstream.
    pub status: u16,
    /// Response headers.
    pub headers: Vec<(String, String)>,
    /// Full JSON body (non-streaming) or empty (streaming).
    pub body: serde_json::Value,
    /// Optional SSE event stream (present when `request.stream` is `Some`).
    pub stream: Option<tokio::sync::mpsc::Receiver<Result<Bytes>>>,
}

impl ExecuteResponse {
    /// True if the upstream responded with a 2xx status.
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }
}

// ---------------------------------------------------------------------------
// Core trait
// ---------------------------------------------------------------------------

/// A provider executor that can dispatch a request to an LLM upstream.
///
/// Implementations are typically stateless or hold a shared HTTP client.
#[async_trait]
pub trait ProviderExecutor: Send + Sync {
    /// Execute a request against the upstream provider.
    async fn execute(&self, request: ExecuteRequest) -> Result<ExecuteResponse>;
}
