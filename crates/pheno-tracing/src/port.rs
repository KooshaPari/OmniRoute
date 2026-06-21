// SPDX-License-Identifier: MIT OR Apache-2.0

//! Port layer for tracing operations
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique trace identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TraceId(pub String);

/// Unique span identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SpanId(pub String);

/// Kind of span (e.g., client, server, internal)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpanKind {
    Internal,
    Client,
    Server,
    Producer,
    Consumer,
}

/// Single trace/span operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceOperation {
    pub trace_id: TraceId,
    pub span_id: SpanId,
    pub parent_span_id: Option<SpanId>,
    pub kind: SpanKind,
    pub name: String,
    pub attributes: HashMap<String, String>,
}

/// Result of a trace submission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceResult {
    pub trace_id: TraceId,
    pub span_id: SpanId,
    pub status: TraceStatus,
}

/// Status of a trace operation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TraceStatus {
    Ok,
    Error(String),
}

/// Port trait for tracing backends
#[async_trait::async_trait]
pub trait TracePort: Send + Sync {
    async fn submit(&self, op: TraceOperation) -> TraceResult;
    async fn flush(&self) -> Result<(), String>;
}
