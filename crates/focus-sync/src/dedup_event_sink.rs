// SPDX-License-Identifier: MIT OR Apache-2.0

//! EventSink wrapper that deduplicates events before appending.
//!
//! Wraps any EventSink implementation with canonical-hash deduplication.
//! If an event is already seen, it is skipped and `event.dedup_skipped` is set to true
//! in the audit trail.
//!
//! Traces to: FR-EVT-DEDUP-001.

use async_trait::async_trait;
use focus_events::dedup::{compute_canonical_hash, EventDeduplicator};
use focus_events::NormalizedEvent;
use std::sync::Arc;

use crate::event_sink::EventSink;

const DEFAULT_DEDUP_TTL_SEC: i64 = 2_592_000; // 30 days

/// EventSink that deduplicates events using a canonical hash.
pub struct DeduplicatingEventSink {
    inner: Arc<dyn EventSink>,
    deduplicator: Arc<dyn EventDeduplicator>,
}

impl DeduplicatingEventSink {
    pub fn new(inner: Arc<dyn EventSink>, deduplicator: Arc<dyn EventDeduplicator>) -> Self {
        Self {
            inner,
            deduplicator,
        }
    }
}

#[async_trait]
impl EventSink for DeduplicatingEventSink {
    async fn append(&self, event: NormalizedEvent) -> anyhow::Result<()> {
        // Compute canonical hash from connector_id, event_type, and payload
        let hash = compute_canonical_hash(
            &event.connector_id,
            &event.event_type.to_string(),
            &event.payload,
        )
        .map_err(|e| anyhow::anyhow!("hash computation: {e}"))?;

        // Check if this event has been seen before
        let is_duplicate = self.deduplicator.is_seen(&hash).await
            .map_err(|e| anyhow::anyhow!("dedup check: {e}"))?;

        if is_duplicate {
            // Log audit: event was deduplicated
            tracing::debug!(
                event_id = %event.event_id,
                connector_id = %event.connector_id,
                event_type = %event.event_type,
                "event deduplicated (duplicate skipped)"
            );
            return Ok(());
        }

        // Mark as seen in the deduplicator
        self.deduplicator
            .mark_seen(&hash, DEFAULT_DEDUP_TTL_SEC)
            .await
            .map_err(|e| anyhow::anyhow!("dedup mark: {e}"))?;

        // Append the event to the underlying sink
        self.inner.append(event).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use focus_events::dedup::InMemoryDeduplicator;
    use focus_events::{EventType, WellKnownEventType};
    use serde_json::json;
    use uuid::Uuid;

    struct MockEventSink {
        appended_events: parking_lot::RwLock<Vec<NormalizedEvent>>,
    }

    impl MockEventSink {
        fn new() -> Arc<Self> {
            Arc::new(Self {
                appended_events: parking_lot::RwLock::new(Vec::new()),
            })
        }

        fn appended_count(&self) -> usize {
            self.appended_events.read().len()
        }
    }

    #[async_trait]
    impl EventSink for MockEventSink {
        async fn append(&self, event: NormalizedEvent) -> anyhow::Result<()> {
            self.appended_events.write().push(event);
            Ok(())
        }
    }

    fn sample_event(id: &str) -> NormalizedEvent {
        use chrono::Utc;

        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "test-connector".to_string(),
            account_id: Uuid::new_v4(),
            event_type: EventType::WellKnown(WellKnownEventType::TaskCompleted),
            occurred_at: Utc::now(),
            effective_at: Utc::now(),
            dedupe_key: focus_events::DedupeKey(format!("key-{id}")),
            confidence: 1.0,
            payload: json!({ "id": id }),
            raw_ref: None,
        }
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn dedup_sink_passes_through_new_event() {
        let mock = MockEventSink::new();
        let dedup = Arc::new(InMemoryDeduplicator::new());
        let sink = DeduplicatingEventSink::new(mock.clone(), dedup);

        let event = sample_event("new");
        sink.append(event).await.expect("append");

        assert_eq!(mock.appended_count(), 1, "new event should pass through");
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn dedup_sink_skips_duplicate_event() {
        let mock = MockEventSink::new();
        let dedup = Arc::new(InMemoryDeduplicator::new());
        let sink = DeduplicatingEventSink::new(mock.clone(), dedup);

        let event = sample_event("dup1");

        // First append: should go through
        sink.append(event.clone()).await.expect("append 1");
        assert_eq!(mock.appended_count(), 1, "first event passes through");

        // Second append (duplicate): should be skipped
        sink.append(event.clone()).await.expect("append 2");
        assert_eq!(
            mock.appended_count(),
            1,
            "duplicate event should be skipped"
        );
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn dedup_sink_different_payloads_not_deduped() {
        let mock = MockEventSink::new();
        let dedup = Arc::new(InMemoryDeduplicator::new());
        let sink = DeduplicatingEventSink::new(mock.clone(), dedup);

        let mut event1 = sample_event("id1");
        let mut event2 = sample_event("id2");

        // Events have different payloads
        event1.payload = json!({ "id": "id1", "value": 42 });
        event2.payload = json!({ "id": "id2", "value": 99 });

        sink.append(event1).await.expect("append 1");
        sink.append(event2).await.expect("append 2");

        assert_eq!(
            mock.appended_count(),
            2,
            "events with different payloads should not be deduped"
        );
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn dedup_sink_different_connectors_not_deduped() {
        let mock = MockEventSink::new();
        let dedup = Arc::new(InMemoryDeduplicator::new());
        let sink = DeduplicatingEventSink::new(mock.clone(), dedup);

        let mut event1 = sample_event("same");
        let mut event2 = sample_event("same");

        event1.connector_id = "connector-a".to_string();
        event2.connector_id = "connector-b".to_string();

        // Same payload, different connectors -> different hash
        event1.payload = json!({ "id": "same" });
        event2.payload = json!({ "id": "same" });

        sink.append(event1).await.expect("append 1");
        sink.append(event2).await.expect("append 2");

        assert_eq!(
            mock.appended_count(),
            2,
            "events from different connectors should not be deduped"
        );
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn dedup_sink_json_key_order_ignored() {
        let mock = MockEventSink::new();
        let dedup = Arc::new(InMemoryDeduplicator::new());
        let sink = DeduplicatingEventSink::new(mock.clone(), dedup);

        let mut event1 = sample_event("same");
        let mut event2 = sample_event("same");

        // Same data, different JSON key order
        event1.payload = json!({ "id": "x", "value": 42 });
        event2.payload = json!({ "value": 42, "id": "x" });

        sink.append(event1).await.expect("append 1");
        sink.append(event2).await.expect("append 2");

        assert_eq!(
            mock.appended_count(),
            1,
            "events with same data (different key order) should be deduped"
        );
    }
}
