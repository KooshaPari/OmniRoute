// SPDX-License-Identifier: MIT OR Apache-2.0

//! Dedupe contract: Connector returning the same NormalizedEvent twice
//! results in only one persisted event in an EventStore.
//!
//! Traces to: FR-CONN-003.
#![allow(clippy::disallowed_methods)]

use async_trait::async_trait;
use chrono::{TimeZone, Utc};
use connector_testkit::HelperEventStore;
use focus_connectors::{
    AuthStrategy, Connector, ConnectorManifest, HealthState, Result as ConnResult, SyncMode,
    SyncOutcome, VerificationTier,
};
use focus_events::{DedupeKey, EventType, NormalizedEvent, WellKnownEventType};
use uuid::Uuid;

struct MockConnector {
    manifest: ConnectorManifest,
    event: NormalizedEvent,
}

impl MockConnector {
    fn new() -> Self {
        let manifest = ConnectorManifest {
            id: "mock".into(),
            version: "0.0.1".into(),
            display_name: "Mock".into(),
            auth_strategy: AuthStrategy::None,
            sync_mode: SyncMode::Polling { cadence_seconds: 60 },
            capabilities: vec![],
            entity_types: vec![],
            event_types: vec![],
            tier: VerificationTier::Verified,
            health_indicators: vec![],
        };
        let event = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "mock".into(),
            account_id: Uuid::new_v4(),
            event_type: EventType::WellKnown(WellKnownEventType::AssignmentDue),
            occurred_at: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            effective_at: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            dedupe_key: DedupeKey("mock:assignment:42".into()),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        };
        Self { manifest, event }
    }
}

#[async_trait]
impl Connector for MockConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        HealthState::Healthy
    }

    // Returns the *same* event each sync call — simulates duplicate delivery.
    async fn sync(&self, _cursor: Option<String>) -> ConnResult<SyncOutcome> {
        Ok(SyncOutcome { events: vec![self.event.clone()], next_cursor: None, partial: false })
    }
}

// Traces to: FR-CONN-003
#[tokio::test]
async fn connector_dedupe_contract_in_memory() {
    let connector = MockConnector::new();
    let mut store = HelperEventStore::new();

    let first = connector.sync(None).await.unwrap();
    let second = connector.sync(None).await.unwrap();

    for e in first.events.into_iter().chain(second.events.into_iter()) {
        store.ingest(e);
    }

    // Connector delivered 2 events with identical dedupe_key; store keeps 1.
    assert_eq!(store.len(), 1, "dedupe_key collision must yield single row");
}
