//! OmniRoute pipeline: request -> provider -> response, with SSE parsing,
//! usage accumulation, bounded backpressure, and cancellation.
//!
//! This crate is the orchestration layer between the HTTP server, the
//! provider registry, and the streaming/SSE plumbing. The HTTP layer
//! hands a `ChatRequest` + `ProviderCallContext` to `Pipeline::run` and
//! either gets back a `ChatResponse` (non-streaming) or a stream of
//! `PipelineEvent`s (streaming).

#![deny(unsafe_code)]
#![warn(missing_debug_implementations)]
#![allow(clippy::module_inception)]

pub mod error;
pub mod sse;
pub mod stream;
pub mod usage;

pub use error::{PipelineError, PipelineResult};
pub use sse::parse_sse_bytes;
pub use stream::{ChatResponse, Pipeline, PipelineEvent, PipelineOutcome};
pub use usage::UsageAccumulator;
