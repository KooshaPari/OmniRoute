// SPDX-License-Identifier: MIT OR Apache-2.0

//! Pheno Tracing — A port-driven distributed tracing crate
//!
//! Provides a clean port/adapter boundary for telemetry integration.

pub mod adapters;
pub mod port;

pub use port::{TracePort, TraceOperation, TraceResult, SpanId, TraceId, SpanKind};
