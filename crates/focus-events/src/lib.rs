// SPDX-License-Identifier: MIT OR Apache-2.0

//! Normalized event schema, dedupe keys, trace references.

pub mod dedup;

use chrono::{DateTime, Utc};
use focus_errors::{FocusError, FocusResult};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedEvent {
    pub event_id: Uuid,
    pub connector_id: String,
    pub account_id: Uuid,
    pub event_type: EventType,
    pub occurred_at: DateTime<Utc>,
    pub effective_at: DateTime<Utc>,
    pub dedupe_key: DedupeKey,
    pub confidence: f32,
    pub payload: serde_json::Value,
    pub raw_ref: Option<TraceRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DedupeKey(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceRef {
    pub source: String,
    pub id: String,
}

/// The closed set of canonical event types we understand first-party.
///
/// Traces to: FR-EVT-VOCAB-001.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WellKnownEventType {
    // Learning
    AssignmentDue,
    AssignmentGraded,
    CourseEnrolled,
    // Calendar
    EventStarted,
    EventEnded,
    // Task
    TaskCompleted,
    TaskAdded,
    // Health
    SleepRecorded,
    ExerciseLogged,
    // App usage
    AppSessionStarted,
    AppSessionEnded,
}

impl WellKnownEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            WellKnownEventType::AssignmentDue => "AssignmentDue",
            WellKnownEventType::AssignmentGraded => "AssignmentGraded",
            WellKnownEventType::CourseEnrolled => "CourseEnrolled",
            WellKnownEventType::EventStarted => "EventStarted",
            WellKnownEventType::EventEnded => "EventEnded",
            WellKnownEventType::TaskCompleted => "TaskCompleted",
            WellKnownEventType::TaskAdded => "TaskAdded",
            WellKnownEventType::SleepRecorded => "SleepRecorded",
            WellKnownEventType::ExerciseLogged => "ExerciseLogged",
            WellKnownEventType::AppSessionStarted => "AppSessionStarted",
            WellKnownEventType::AppSessionEnded => "AppSessionEnded",
        }
    }

    /// Parse a canonical (CamelCase) or lower_snake_case string into a
    /// well-known event type.
    pub fn from_canonical(s: &str) -> Option<Self> {
        match s {
            "AssignmentDue" | "assignment_due" => Some(Self::AssignmentDue),
            "AssignmentGraded" | "assignment_graded" => Some(Self::AssignmentGraded),
            "CourseEnrolled" | "course_enrolled" => Some(Self::CourseEnrolled),
            "EventStarted" | "event_started" => Some(Self::EventStarted),
            "EventEnded" | "event_ended" => Some(Self::EventEnded),
            "TaskCompleted" | "task_completed" => Some(Self::TaskCompleted),
            "TaskAdded" | "task_added" => Some(Self::TaskAdded),
            "SleepRecorded" | "sleep_recorded" => Some(Self::SleepRecorded),
            "ExerciseLogged" | "exercise_logged" => Some(Self::ExerciseLogged),
            "AppSessionStarted" | "app_session_started" => Some(Self::AppSessionStarted),
            "AppSessionEnded" | "app_session_ended" => Some(Self::AppSessionEnded),
            _ => None,
        }
    }
}

/// Open-ended event vocabulary: canonical well-known variants, plus custom
/// connector-scoped strings for anything outside the built-in taxonomy.
///
/// Traces to: FR-EVT-VOCAB-001.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EventType {
    WellKnown(WellKnownEventType),
    Custom(String),
}

impl EventType {
    /// Resolve a connector-emitted (`connector_id`, `type_str`) pair into an
    /// `EventType`. Canonical strings map to `WellKnown(_)`; anything else
    /// becomes `Custom("{connector_id}:{type_str}")` so the origin is
    /// preserved on the wire.
    pub fn from_manifest_string(connector_id: &str, type_str: &str) -> Self {
        if let Some(wk) = WellKnownEventType::from_canonical(type_str) {
            EventType::WellKnown(wk)
        } else {
            EventType::Custom(format!("{connector_id}:{type_str}"))
        }
    }
}

impl std::fmt::Display for EventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventType::WellKnown(wk) => f.write_str(wk.as_str()),
            EventType::Custom(s) => f.write_str(s),
        }
    }
}

impl NormalizedEvent {
    /// Validate required-fields schema.
    /// Traces to: FR-EVT-001.
    pub fn validate(&self) -> FocusResult<()> {
        if self.connector_id.is_empty() {
            return Err(FocusError::invalid_input("connector_id", "empty"));
        }
        if self.dedupe_key.0.is_empty() {
            return Err(FocusError::invalid_input("dedupe_key", "empty"));
        }
        if !self.confidence.is_finite() || self.confidence < 0.0 || self.confidence > 1.0 {
            return Err(FocusError::invalid_input(
                "confidence",
                format!("{} (must be in [0.0, 1.0])", self.confidence),
            ));
        }
        if self.occurred_at > self.effective_at {
            return Err(FocusError::invalid_input(
                "occurred_at/effective_at",
                "time order invalid: occurred_at must be <= effective_at",
            ));
        }
        Ok(())
    }
}

pub struct EventFactory;

impl EventFactory {
    pub fn new_dedupe_key(source: &str, id: &str, occurred_at: DateTime<Utc>) -> DedupeKey {
        DedupeKey(format!("{source}:{id}:{}", occurred_at.timestamp()))
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn t(h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, h, 0, 0).unwrap()
    }

    fn sample() -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "canvas".into(),
            account_id: Uuid::new_v4(),
            event_type: EventType::WellKnown(WellKnownEventType::AssignmentDue),
            occurred_at: t(1),
            effective_at: t(2),
            dedupe_key: DedupeKey("canvas:1:1".into()),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        }
    }

    // Traces to: FR-EVT-001
    #[test]
    fn validate_happy_path() {
        assert!(sample().validate().is_ok());
    }

    // Traces to: FR-EVT-001
    #[test]
    fn validate_rejects_empty_connector_id() {
        let mut e = sample();
        e.connector_id = String::new();
        assert_eq!(
            e.validate().unwrap_err(),
            FocusError::invalid_input("connector_id", "empty")
        );
    }

    // Traces to: FR-EVT-001
    #[test]
    fn validate_rejects_empty_dedupe_key() {
        let mut e = sample();
        e.dedupe_key = DedupeKey(String::new());
        assert_eq!(
            e.validate().unwrap_err(),
            FocusError::invalid_input("dedupe_key", "empty")
        );
    }

    // Traces to: FR-EVT-001
    #[test]
    fn validate_rejects_out_of_range_confidence() {
        let mut e = sample();
        e.confidence = 1.5;
        assert_eq!(
            e.validate().unwrap_err(),
            FocusError::invalid_input("confidence", "1.5 (must be in [0.0, 1.0])")
        );
        let mut e2 = sample();
        e2.confidence = -0.1;
        assert!(matches!(
            e2.validate().unwrap_err(),
            FocusError::InvalidInput { .. }
        ));
    }

    // Traces to: FR-EVT-001
    #[test]
    fn validate_rejects_time_order() {
        let mut e = sample();
        e.occurred_at = t(5);
        e.effective_at = t(1);
        assert_eq!(
            e.validate().unwrap_err(),
            FocusError::invalid_input(
                "occurred_at/effective_at",
                "time order invalid: occurred_at must be <= effective_at"
            )
        );
    }

    // ------------------------------------------------------------------
    // EventType vocabulary (Task #31) — Traces to: FR-EVT-VOCAB-001
    // ------------------------------------------------------------------

    #[test]
    fn from_manifest_string_canonical_yields_well_known() {
        let et = EventType::from_manifest_string("canvas", "assignment_due");
        assert!(matches!(et, EventType::WellKnown(WellKnownEventType::AssignmentDue)));
        let et2 = EventType::from_manifest_string("canvas", "AssignmentGraded");
        assert!(matches!(et2, EventType::WellKnown(WellKnownEventType::AssignmentGraded)));
    }

    #[test]
    fn from_manifest_string_unknown_becomes_custom_prefixed() {
        let et = EventType::from_manifest_string("canvas", "quiz_posted");
        match et {
            EventType::Custom(s) => assert_eq!(s, "canvas:quiz_posted"),
            _ => panic!("expected Custom"),
        }
    }

    #[test]
    fn display_renders_canonical_and_custom() {
        let a = EventType::WellKnown(WellKnownEventType::TaskCompleted);
        assert_eq!(a.to_string(), "TaskCompleted");
        let b = EventType::Custom("canvas:quiz_posted".into());
        assert_eq!(b.to_string(), "canvas:quiz_posted");
    }

    #[test]
    fn event_type_roundtrip_serde_well_known() {
        let et = EventType::WellKnown(WellKnownEventType::SleepRecorded);
        let json = serde_json::to_string(&et).expect("serialize EventType");
        let back: EventType = serde_json::from_str(&json).expect("deserialize EventType");
        assert_eq!(et, back);
    }

    #[test]
    fn event_type_roundtrip_serde_custom() {
        let et = EventType::Custom("canvas:quiz_posted".into());
        let json = serde_json::to_string(&et).expect("serialize EventType");
        let back: EventType = serde_json::from_str(&json).expect("deserialize EventType");
        assert_eq!(et, back);
    }

    #[test]
    fn well_known_from_canonical_rejects_garbage() {
        assert!(WellKnownEventType::from_canonical("totally_unknown").is_none());
    }
}
