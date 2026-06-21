// SPDX-License-Identifier: MIT OR Apache-2.0

use pheno_tracing::port::{TraceId, SpanId, TraceOperation, SpanKind, TracePort, TraceStatus};
use pheno_tracing::adapters::InMemoryAdapter;
use std::collections::HashMap;

#[tokio::test]
async fn test_in_memory_adapter_submits_span() {
    let adapter = InMemoryAdapter::new();
    let op = TraceOperation {
        trace_id: TraceId("trace-001".into()),
        span_id: SpanId("span-001".into()),
        parent_span_id: None,
        kind: SpanKind::Internal,
        name: "test-span".into(),
        attributes: HashMap::new(),
    };
    let result = adapter.submit(op).await;
    assert_eq!(result.trace_id.0, "trace-001");
    assert_eq!(result.span_id.0, "span-001");
    assert_eq!(result.status, TraceStatus::Ok);
    let spans = adapter.spans.lock().unwrap();
    assert_eq!(spans.len(), 1);
}

#[tokio::test]
async fn test_in_memory_adapter_flush() {
    let adapter = InMemoryAdapter::new();
    let result = adapter.flush().await;
    assert!(result.is_ok());
}
