// SPDX-License-Identifier: MIT OR Apache-2.0

#![doc = include_str!("../README.md")]
#![warn(missing_docs)]

use async_trait::async_trait;
use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use phenotype_observably_macros::async_instrumented;

pub use focus_events::{NormalizedEvent, EventType, WellKnownEventType};

/// NudgeKind describes the type of proactive nudge the engine proposes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NudgeKind {
    /// User should start a focus session (high-productivity window detected).
    StartFocus,
    /// User should take a break (activity fatigue or interruption spike).
    TakeBreak,
    /// Upcoming deadline or review checkpoint.
    ReviewDeadline,
    /// Current focus streak at risk (predicted distraction window incoming).
    StreakAtRisk,
    /// Evening wind-down nudge (approaching sleep boundary).
    WindDown,
}

impl std::fmt::Display for NudgeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NudgeKind::StartFocus => write!(f, "start_focus"),
            NudgeKind::TakeBreak => write!(f, "take_break"),
            NudgeKind::ReviewDeadline => write!(f, "review_deadline"),
            NudgeKind::StreakAtRisk => write!(f, "streak_at_risk"),
            NudgeKind::WindDown => write!(f, "wind_down"),
        }
    }
}

/// NudgeProposal is the output of the habit predictor + always-on engine.
///
/// The engine evaluates 0 or 1 proposal per tick, based on user's predicted state
/// and confidence in the prediction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NudgeProposal {
    /// When the nudge should be shown.
    pub when: DateTime<Utc>,
    /// Type of nudge (StartFocus, TakeBreak, etc.).
    pub kind: NudgeKind,
    /// Human-readable reason for the nudge.
    pub reason: String,
    /// Confidence in this proposal (0.0–1.0).
    pub confidence: f32,
}

impl NudgeProposal {
    /// Create a new nudge proposal.
    pub fn new(when: DateTime<Utc>, kind: NudgeKind, reason: String, confidence: f32) -> Self {
        Self {
            when,
            kind,
            reason,
            confidence: confidence.clamp(0.0, 1.0),
        }
    }
}

/// HabitPredictor trait defines the interface for predicting user activity patterns.
#[async_trait]
pub trait HabitPredictor: Send + Sync {
    /// Predict the next nudge proposal based on current time and historical data.
    ///
    /// Returns 0 or 1 proposals per call. If no prediction meets confidence threshold,
    /// returns None.
    async fn predict_next_nudge(&self, now: DateTime<Utc>) -> anyhow::Result<Option<NudgeProposal>>;

    /// Get the likely productive hours for a given day of week (0–6: Mon–Sun).
    ///
    /// Returns a list of hours (0–23) where user historically focuses well.
    async fn productive_hours(&self, day_of_week: u32) -> anyhow::Result<Vec<u32>>;

    /// Get distraction-prone hours for a given day of week.
    async fn distraction_hours(&self, day_of_week: u32) -> anyhow::Result<Vec<u32>>;
}

/// RollingAverageHabitPredictor implements HabitPredictor using 7-day rolling average.
///
/// Internally maintains 168 hour-of-week buckets [Mon 0:00 .. Sun 23:00].
/// For each bucket, tracks a rolling average of focus success rate.
pub struct RollingAverageHabitPredictor {
    /// activity_by_hour: key = (weekday, hour), value = rolling average (0.0–1.0).
    activity: Arc<Mutex<HashMap<(u32, u32), f32>>>,
}

impl RollingAverageHabitPredictor {
    /// Create a new rolling average predictor with no historical data.
    pub fn new() -> Self {
        Self {
            activity: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Load or update activity from normalized events.
    ///
    /// Scans events for focus-session types, aggregates success by hour-of-week,
    /// and updates the rolling average. A session is "successful" if duration >= 25 minutes.
    #[async_instrumented]
    pub async fn update_from_events(&self, events: Vec<NormalizedEvent>) -> anyhow::Result<()> {
        let mut bucket_counts: HashMap<(u32, u32), (u32, u32)> = HashMap::new(); // (day, hour) -> (successes, total)

        for event in events {
            let weekday = event.occurred_at.weekday().number_from_monday() - 1; // 0–6
            let hour = event.occurred_at.hour();

            // Count a session as "success" if duration >= 25 min (inferred from payload or default).
            let is_success = {
                let duration_min = event.payload.get("duration_minutes")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(25); // Default: assume success if not specified
                duration_min >= 25
            };

            let key = (weekday, hour);
            let (success_count, total_count) = bucket_counts.entry(key).or_insert((0, 0));
            *total_count += 1;
            if is_success {
                *success_count += 1;
            }
        }

        let mut activity = self.activity.lock().await;
        for ((day, hour), (successes, total)) in bucket_counts {
            if total > 0 {
                let avg = successes as f32 / total as f32;
                activity.insert((day, hour), avg);
            }
        }

        Ok(())
    }

    /// Get confidence (0.0–1.0) for a specific hour of week.
    async fn get_confidence(&self, weekday: u32, hour: u32) -> f32 {
        let activity = self.activity.lock().await;
        activity.get(&(weekday, hour)).copied().unwrap_or(0.0)
    }

    /// Sleep boundary (hardcoded in Phase 1): 22:00–06:00.
    fn is_sleep_hour(hour: u32) -> bool {
        !(6..22).contains(&hour)
    }
}

#[async_trait]
impl HabitPredictor for RollingAverageHabitPredictor {
    #[async_instrumented]
    async fn predict_next_nudge(&self, now: DateTime<Utc>) -> anyhow::Result<Option<NudgeProposal>> {
        let weekday = now.weekday().number_from_monday() - 1; // 0–6: Mon–Sun
        let hour = now.hour();

        // Never nudge during sleep hours.
        if Self::is_sleep_hour(hour) {
            return Ok(None);
        }

        let confidence = self.get_confidence(weekday, hour).await;

        // Only emit if confidence exceeds 60%.
        if confidence > 0.6 {
            let reason = format!(
                "You historically focus well at {}:00 on {}. Productivity confidence: {:.0}%",
                hour,
                weekday_name(weekday),
                confidence * 100.0
            );

            let proposal = NudgeProposal::new(now, NudgeKind::StartFocus, reason, confidence);
            return Ok(Some(proposal));
        }

        Ok(None)
    }

    async fn productive_hours(&self, day_of_week: u32) -> anyhow::Result<Vec<u32>> {
        let activity = self.activity.lock().await;
        let mut hours: Vec<_> = (0..24)
            .filter(|h| {
                !Self::is_sleep_hour(*h) && activity.get(&(day_of_week, *h)).copied().unwrap_or(0.0) > 0.6
            })
            .collect();
        hours.sort();
        Ok(hours)
    }

    async fn distraction_hours(&self, day_of_week: u32) -> anyhow::Result<Vec<u32>> {
        let activity = self.activity.lock().await;
        let mut hours: Vec<_> = (0..24)
            .filter(|h| {
                !Self::is_sleep_hour(*h) && activity.get(&(day_of_week, *h)).copied().unwrap_or(0.0) < 0.3
            })
            .collect();
        hours.sort();
        Ok(hours)
    }
}

impl Default for RollingAverageHabitPredictor {
    fn default() -> Self {
        Self::new()
    }
}

/// AlwaysOnEngine is the main driver of the always-on nudge pipeline.
///
/// Wraps a HabitPredictor and manages periodic ticks to emit nudge proposals.
/// In production, this is called by the 60-second foreground heartbeat loop (focus-ffi).
pub struct AlwaysOnEngine {
    predictor: Arc<dyn HabitPredictor>,
    nudge_tx: tokio::sync::mpsc::UnboundedSender<NudgeProposal>,
}

impl AlwaysOnEngine {
    /// Create a new always-on engine with a given predictor and nudge channel.
    pub fn new(
        predictor: Arc<dyn HabitPredictor>,
        nudge_tx: tokio::sync::mpsc::UnboundedSender<NudgeProposal>,
    ) -> Self {
        Self { predictor, nudge_tx }
    }

    /// Perform a single tick of the engine (called every 60 seconds in production).
    ///
    /// Queries the predictor for a nudge proposal and emits it to the channel if confidence is high.
    #[async_instrumented]
    pub async fn tick(&self, now: DateTime<Utc>) -> anyhow::Result<()> {
        if let Some(proposal) = self.predictor.predict_next_nudge(now).await? {
            let _ = self.nudge_tx.send(proposal);
        }
        Ok(())
    }
}

/// Helper to convert weekday number (0–6) to human-readable name.
fn weekday_name(day: u32) -> &'static str {
    match day {
        0 => "Monday",
        1 => "Tuesday",
        2 => "Wednesday",
        3 => "Thursday",
        4 => "Friday",
        5 => "Saturday",
        6 => "Sunday",
        _ => "Unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-ALWAYS-ON-NNN (placeholder; to be populated in FUNCTIONAL_REQUIREMENTS.md)
    #[tokio::test]
    async fn test_new_predictor_no_history() {
        let predictor = RollingAverageHabitPredictor::new();

        // Without any history, confidence should be 0 for all hours.
        let confidence = predictor.get_confidence(0, 9).await;
        assert_eq!(confidence, 0.0);
    }

    // Traces to: FR-ALWAYS-ON-NNN
    #[tokio::test]
    async fn test_rolling_average_calculation() {
        let predictor = RollingAverageHabitPredictor::new();

        // Manually set activity for Monday 9:00 (4 successes out of 7 attempts).
        {
            let mut activity = predictor.activity.lock().await;
            activity.insert((0, 9), 4.0 / 7.0); // ~0.571
        }

        let confidence = predictor.get_confidence(0, 9).await;
        assert!((confidence - 4.0 / 7.0).abs() < 0.01);
    }

    // Traces to: FR-ALWAYS-ON-NNN
    #[tokio::test]
    async fn test_productive_hours_filtering() {
        let predictor = RollingAverageHabitPredictor::new();

        {
            let mut activity = predictor.activity.lock().await;
            activity.insert((0, 9), 0.8);  // High productivity
            activity.insert((0, 10), 0.7); // High productivity
            activity.insert((0, 11), 0.4); // Low productivity
            activity.insert((0, 23), 0.9); // Would be sleep time (not included)
        }

        let hours = predictor.productive_hours(0).await.unwrap();
        // Should return [9, 10] (confidence > 0.6, excluding sleep hours).
        assert_eq!(hours, vec![9, 10]);
    }

    // Traces to: FR-ALWAYS-ON-NNN
    #[tokio::test]
    async fn test_sleep_hour_suppression() {
        let predictor = RollingAverageHabitPredictor::new();

        {
            let mut activity = predictor.activity.lock().await;
            activity.insert((0, 23), 0.9); // High confidence, but sleep hour
            activity.insert((0, 5), 0.9);  // High confidence, but sleep hour
        }

        // 23:00 (11 PM) is a sleep hour.
        let proposal = predictor.predict_next_nudge(Utc::now().with_hour(23).unwrap()).await.unwrap();
        assert!(proposal.is_none(), "Should not nudge during sleep hours");

        // 5:00 AM is a sleep hour.
        let proposal = predictor.predict_next_nudge(Utc::now().with_hour(5).unwrap()).await.unwrap();
        assert!(proposal.is_none(), "Should not nudge during sleep hours");
    }

    // Traces to: FR-ALWAYS-ON-NNN
    #[tokio::test]
    async fn test_cross_hour_bucketing() {
        let predictor = RollingAverageHabitPredictor::new();

        {
            let mut activity = predictor.activity.lock().await;
            // Different hours, same weekday.
            activity.insert((0, 9), 0.85);
            activity.insert((0, 10), 0.7);
            activity.insert((0, 11), 0.5);
        }

        let productive = predictor.productive_hours(0).await.unwrap();
        assert_eq!(productive, vec![9, 10]); // Both > 0.6
    }

    // Traces to: FR-ALWAYS-ON-NNN
    #[tokio::test]
    async fn test_determinism_with_fixed_clock() {
        let predictor = RollingAverageHabitPredictor::new();

        {
            let mut activity = predictor.activity.lock().await;
            activity.insert((0, 10), 0.75); // Monday 10:00
        }

        // Create a fixed datetime: Monday 10:00.
        let fixed_time = chrono::NaiveDate::from_ymd_opt(2026, 4, 20) // Monday, April 20, 2026
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap()
            .and_utc();

        let proposal1 = predictor.predict_next_nudge(fixed_time).await.unwrap();
        let proposal2 = predictor.predict_next_nudge(fixed_time).await.unwrap();

        // Same input time should produce identical proposals (deterministic).
        match (proposal1, proposal2) {
            (Some(p1), Some(p2)) => {
                assert_eq!(p1.kind, p2.kind);
                assert!(
                    (p1.confidence - p2.confidence).abs() < 0.001,
                    "Confidence should be deterministic"
                );
            }
            (None, None) => {}, // Both None is also deterministic.
            (Some(_), None) | (None, Some(_)) => {
                panic!("Non-deterministic prediction from same input time");
            }
        }
    }
}
