// SPDX-License-Identifier: MIT OR Apache-2.0

use pheno_tracing::port::{TraceId, SpanId, TraceOperation, SpanKind, TraceStatus};
use pheno_tracing::adapters::StdoutAdapter;
use pheno_tracing::TracePort;  // Bring the trait into scope
use std::collections::HashMap;

#[tokio::test]
async fn test_stdout_adapter() {
    let adapter = StdoutAdapter;
    let op = TraceOperation {
        trace_id: TraceId("trace-002".into()),
        span_id: SpanId("span-002".into()),
        parent_span_id: None,
        kind: SpanKind::Client,
        name: "client-span".into(),
        attributes: HashMap::new(),
    };
    let result = adapter.submit(op).await;
    assert_eq!(result.status, TraceStatus::Ok);
}
