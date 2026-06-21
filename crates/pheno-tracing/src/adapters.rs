// SPDX-License-Identifier: MIT OR Apache-2.0

//! Adapter implementations for tracing backends
use crate::port::{TraceOperation, TraceResult, TracePort, TraceStatus};
use std::sync::{Arc, Mutex};

/// In-memory adapter for testing
#[derive(Default)]
pub struct InMemoryAdapter {
    pub spans: Arc<Mutex<Vec<TraceOperation>>>,
}

impl InMemoryAdapter {
    pub fn new() -> Self {
        Self {
            spans: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[async_trait::async_trait]
impl TracePort for InMemoryAdapter {
    async fn submit(&self, op: TraceOperation) -> TraceResult {
        let mut spans = self.spans.lock().unwrap();
        spans.push(op.clone());
        TraceResult {
            trace_id: op.trace_id,
            span_id: op.span_id,
            status: TraceStatus::Ok,
        }
    }

    async fn flush(&self) -> Result<(), String> {
        Ok(())
    }
}

/// Stdout adapter for debugging
pub struct StdoutAdapter;

#[async_trait::async_trait]
impl TracePort for StdoutAdapter {
    async fn submit(&self, op: TraceOperation) -> TraceResult {
        println!("[TRACE] {:?} - {}: {:?}", op.trace_id, op.name, op.kind);
        TraceResult {
            trace_id: op.trace_id,
            span_id: op.span_id,
            status: TraceStatus::Ok,
        }
    }

    async fn flush(&self) -> Result<(), String> {
        Ok(())
    }
}
