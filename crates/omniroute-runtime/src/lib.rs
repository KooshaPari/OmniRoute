//! # OmniRoute runtime — the data-plane binary
//!
//! This is the only crate in the workspace that depends on `tokio` / `hyper`.
//! It hosts the HTTP server, the executor loop, and the SSE encoder.
//!
//! ## Endpoints
//!
//! | Path                      | Method | Notes                              |
//! |---------------------------|--------|------------------------------------|
//! | `/v1/chat/completions`    | POST   | OpenAI-compatible; stream + non    |
//! | `/v1/models`              | GET    | Catalog relay (Phase 3)            |
//! | `/healthz`                | GET    | Liveness                           |
//! | `/readyz`                 | GET    | Readiness + provider health        |
//!
//! ## Polyglot binding (ADR-032)
//!
//! The runtime binds to the TypeScript control plane via Unix Domain Socket
//! (`$XDG_RUNTIME_DIR/omniroute/routed.sock`). T2 UDS RPC binding tier.
//! The `omniroute-bindings` crate (Phase 3) adds the in-process napi-rs
//! binding for callers that need it.

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod chat;
pub mod health;
pub mod metrics;
pub mod retry;
pub mod server;
pub mod sse;

pub use metrics::{
    CircuitBreaker, CircuitConfig, CircuitOpen, CircuitRegistry, CircuitState, Metrics,
};
pub use server::{ResponseBody, Server};