// SPDX-License-Identifier: MIT OR Apache-2.0

//! MockFamilyControls adapter — synthetic screen-time events for POC TestFlight demo.
//!
//! Implements the Connector trait with deterministic, reproducible synthetic events:
//! app launches, screen-time accumulation, intervention triggers, emergency-exit flows.
//! Driven by a deterministic time source for demo repeatability without the iOS
//! `com.apple.developer.family-controls` entitlement.
//!
//! Traces to: FR-MOCK-001 (MockFamilyControls adapter), FR-MOCK-002 (synthetic events),
//! FR-MOCK-003 (deterministic time), FR-MOCK-004 (emergency-exit), FR-MOCK-005 (integration).

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use focus_connectors::{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
};
use focus_events::{DedupeKey, NormalizedEvent};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub mod synthetic_events;
pub mod time_source;

pub use synthetic_events::{SyntheticEventKind, SyntheticEventSchedule};
pub use time_source::{DeterministicTimeSource, TimeSource};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum MockError {
    #[error("time source error: {0}")]
    TimeSource(String),
    #[error("schedule exhausted: no more events")]
    ScheduleExhausted,
    #[error("invalid schedule: {0}")]
    InvalidSchedule(String),
}

impl From<MockError> for ConnectorError {
    fn from(e: MockError) -> Self {
        ConnectorError::Schema(e.to_string())
    }
}

// ---------------------------------------------------------------------------
// MockFamilyControls connector
// ---------------------------------------------------------------------------

/// Deterministic synthetic event generator for FamilyControls-like events.
/// Traces to: FR-MOCK-001.
pub struct MockFamilyControls {
    manifest: ConnectorManifest,
    time_source: Arc<dyn TimeSource>,
    schedule: Arc<Mutex<SyntheticEventSchedule>>,
    last_cursor: Arc<Mutex<Option<String>>>,
}

impl MockFamilyControls {
    /// Create a new mock connector with a default deterministic time source.
    /// Traces to: FR-MOCK-001.
    pub fn new() -> Self {
        Self::with_time_source(Arc::new(DeterministicTimeSource::default()))
    }

    /// Create with a custom time source for testing.
    pub fn with_time_source(time_source: Arc<dyn TimeSource>) -> Self {
        let manifest = ConnectorManifest {
            id: "mock-familycontrols".to_string(),
            version: "0.0.1".to_string(),
            display_name: "Mock FamilyControls (POC)".to_string(),
            auth_strategy: AuthStrategy::None,
            sync_mode: SyncMode::Polling {
                cadence_seconds: 30,
            },
            capabilities: vec![],
            entity_types: vec!["device".to_string(), "restriction".to_string()],
            event_types: vec![
                "AppLaunchAttempt".to_string(),
                "ScreenTimeAccumulation".to_string(),
                "InterventionTriggered".to_string(),
                "EmergencyExit".to_string(),
                "InterventionCleared".to_string(),
            ],
            tier: VerificationTier::Private,
            health_indicators: vec!["synthetic_generation_ok".to_string()],
        };

        Self {
            manifest,
            time_source,
            schedule: Arc::new(Mutex::new(SyntheticEventSchedule::default())),
            last_cursor: Arc::new(Mutex::new(None)),
        }
    }

    /// Load a predefined demo scenario (e.g., "standard_day", "intervention_flow").
    pub fn load_scenario(&self, scenario: &str) -> std::result::Result<(), MockError> {
        let mut schedule = self.schedule.lock().expect("schedule poisoned");
        *schedule = SyntheticEventSchedule::from_scenario(scenario)?;
        Ok(())
    }

    /// Peek at the next event without advancing the cursor.
    pub fn peek_next_event(&self) -> Option<SyntheticEventKind> {
        let schedule = self.schedule.lock().expect("schedule poisoned");
        schedule.peek_next()
    }

    /// Manually enqueue a synthetic event.
    pub fn enqueue_event(&self, kind: SyntheticEventKind) {
        let mut schedule = self.schedule.lock().expect("schedule poisoned");
        schedule.enqueue(kind);
    }

    /// Skip to a specific timestamp (for demo choreography).
    pub fn advance_to(&self, target: DateTime<Utc>) {
        if let Some(ds) = self.time_source.as_any().downcast_ref::<DeterministicTimeSource>() {
            ds.set_now(target);
        }
    }

    fn make_event(
        &self,
        kind: SyntheticEventKind,
        now: DateTime<Utc>,
    ) -> NormalizedEvent {
        let event_type = kind.to_event_type();
        let dedupe_key = DedupeKey(format!(
            "mock-familycontrols:{}:{}",
            kind.kind_name(),
            now.timestamp_nanos_opt().unwrap_or(0)
        ));

        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "mock-familycontrols".to_string(),
            account_id: Uuid::nil(),
            event_type,
            occurred_at: now,
            effective_at: now,
            dedupe_key,
            confidence: 1.0,
            payload: kind.to_payload(),
            raw_ref: None,
        }
    }
}

impl Default for MockFamilyControls {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Connector for MockFamilyControls {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        // Always healthy in mock mode.
        HealthState::Healthy
    }

    /// Sync generates the next batch of synthetic events from the schedule.
    /// Traces to: FR-MOCK-002, FR-MOCK-003.
    async fn sync(&self, _cursor: Option<String>) -> Result<SyncOutcome> {
        let now = self.time_source.now();
        let mut schedule = self.schedule.lock().expect("schedule poisoned");

        // Drain events up to the current time.
        let mut events = Vec::new();
        while let Some(event_kind) = schedule.peek_next() {
            let event = self.make_event(event_kind.clone(), now);
            events.push(event);
            schedule.dequeue();
        }

        // Generate a simple cursor (timestamp-based).
        let next_cursor = format!("cursor:{}", now.timestamp());

        let outcome = SyncOutcome {
            events,
            next_cursor: Some(next_cursor.clone()),
            partial: false,
        };

        let mut last = self.last_cursor.lock().expect("cursor poisoned");
        *last = Some(next_cursor);

        Ok(outcome)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use focus_events::EventType;

    // Traces to: FR-MOCK-001
    #[test]
    fn mock_connector_manifest_correct() {
        let conn = MockFamilyControls::new();
        let manifest = conn.manifest();
        assert_eq!(manifest.id, "mock-familycontrols");
        assert_eq!(manifest.display_name, "Mock FamilyControls (POC)");
        assert_eq!(manifest.tier, VerificationTier::Private);
        assert!(manifest.event_types.contains(&"AppLaunchAttempt".to_string()));
    }

    // Traces to: FR-MOCK-003
    #[tokio::test]
    async fn mock_connector_uses_deterministic_time() {
        use chrono::Duration;
        let time_src = Arc::new(DeterministicTimeSource::default());
        let t0 = time_src.now();
        time_src.set_now(t0 + Duration::seconds(10));
        let t1 = time_src.now();
        assert_eq!(t1 - t0, Duration::seconds(10));
    }

    // Traces to: FR-MOCK-002
    #[tokio::test]
    async fn sync_generates_events_from_schedule() {
        let conn = MockFamilyControls::new();
        conn.load_scenario("standard_day").expect("failed to load scenario");

        let outcome = conn.sync(None).await.expect("sync failed");
        assert!(!outcome.events.is_empty());
        assert_eq!(outcome.events[0].connector_id, "mock-familycontrols");
    }

    // Traces to: FR-MOCK-001
    #[tokio::test]
    async fn health_always_healthy() {
        let conn = MockFamilyControls::new();
        let health = conn.health().await;
        assert_eq!(health, HealthState::Healthy);
    }

    // Traces to: FR-MOCK-002
    #[test]
    fn enqueue_and_peek_events() {
        let conn = MockFamilyControls::new();
        assert_eq!(conn.peek_next_event(), None);

        conn.enqueue_event(SyntheticEventKind::AppLaunch {
            bundle_id: "com.apple.mobilesafari".to_string(),
            app_name: "Safari".to_string(),
        });

        assert!(conn.peek_next_event().is_some());
    }

    // Traces to: FR-MOCK-004 (emergency-exit)
    #[tokio::test]
    async fn emergency_exit_event_generates_correctly() {
        let conn = MockFamilyControls::new();
        conn.enqueue_event(SyntheticEventKind::EmergencyExit {
            reason: "user_override".to_string(),
            auth_method: "biometric".to_string(),
        });

        let outcome = conn.sync(None).await.expect("sync failed");
        assert_eq!(outcome.events.len(), 1);
        assert_eq!(outcome.events[0].event_type, EventType::Custom("emergency_exit".to_string()));
    }

    // Traces to: FR-MOCK-002
    #[tokio::test]
    async fn intervention_triggered_event_includes_payload() {
        let conn = MockFamilyControls::new();
        conn.enqueue_event(SyntheticEventKind::InterventionTriggered {
            rule_id: "rule-123".to_string(),
            escalation_tier: "tier_2".to_string(),
        });

        let outcome = conn.sync(None).await.expect("sync failed");
        let event = &outcome.events[0];
        assert_eq!(event.event_type, EventType::Custom("intervention_triggered".to_string()));
        assert!(event.payload.get("rule_id").is_some());
    }

    // Traces to: FR-MOCK-005 (integration)
    #[tokio::test]
    async fn multiple_syncs_drain_queue() {
        let conn = MockFamilyControls::new();
        conn.enqueue_event(SyntheticEventKind::AppLaunch {
            bundle_id: "com.apple.mobilesafari".to_string(),
            app_name: "Safari".to_string(),
        });
        conn.enqueue_event(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.apple.mobilesafari".to_string(),
            minutes_used: 30,
        });

        let out1 = conn.sync(None).await.expect("sync 1 failed");
        assert_eq!(out1.events.len(), 2);

        let out2 = conn.sync(out1.next_cursor).await.expect("sync 2 failed");
        assert!(out2.events.is_empty());
    }

    // Traces to: FR-MOCK-001
    #[test]
    fn load_invalid_scenario_errors() {
        let conn = MockFamilyControls::new();
        let result = conn.load_scenario("nonexistent_scenario");
        assert!(result.is_err());
    }
}
