// SPDX-License-Identifier: MIT OR Apache-2.0

//! Fitbit event mapping — transforms API responses into normalized events.

use chrono::Utc;
use focus_events::{EventFactory, EventType, NormalizedEvent, TraceRef};
use uuid::Uuid;

use crate::models::{Activity, HeartRate, Sleep};

pub struct FitbitEventMapper {
    account_id: Uuid,
}

impl FitbitEventMapper {
    pub fn new(account_id: Uuid) -> Self {
        Self { account_id }
    }

    /// Map Fitbit activities into workout_completed events.
    pub fn map_activities(&self, activity: Activity) -> Vec<NormalizedEvent> {
        activity
            .activities
            .into_iter()
            .map(|logged| {
                let started_at = chrono::DateTime::parse_from_rfc3339(&logged.start_time)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "fitbit",
                    &logged.name,
                    started_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "fitbit".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("fitbit:workout_completed".into()),
                    occurred_at: started_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.95,
                    payload: serde_json::json!({
                        "activity": logged.name,
                        "duration_minutes": logged.duration / 60000,
                        "calories": logged.calories,
                        "distance": logged.distance,
                        "started_at_iso": logged.start_time,
                        "credit_amount": 30,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "fitbit-api".into(),
                        id: logged.name.clone(),
                    }),
                }
            })
            .collect()
    }

    /// Map Fitbit sleep into sleep_reported events.
    pub fn map_sleep(&self, sleep: Sleep) -> Vec<NormalizedEvent> {
        sleep
            .sleep
            .into_iter()
            .map(|session| {
                let in_bed_at = chrono::DateTime::parse_from_rfc3339(&session.start_time)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let _ended_at = chrono::DateTime::parse_from_rfc3339(&session.end_time)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "fitbit",
                    "sleep",
                    in_bed_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "fitbit".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("fitbit:sleep_reported".into()),
                    occurred_at: in_bed_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.92,
                    payload: serde_json::json!({
                        "hours": session.duration as f64 / 3600000.0,
                        "in_bed_at_iso": session.start_time,
                        "ended_at_iso": session.end_time,
                        "sleep_efficiency": session.efficiency,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "fitbit-api".into(),
                        id: format!("sleep:{}", in_bed_at.timestamp()),
                    }),
                }
            })
            .collect()
    }

    /// Map daily steps into milestone events (≥10000).
    pub fn map_steps(&self, activity: &Activity) -> Vec<NormalizedEvent> {
        if activity.summary.steps >= 10000 {
            let now = Utc::now();
            let dedupe_key = EventFactory::new_dedupe_key(
                "fitbit",
                "daily_steps_milestone",
                now,
            );

            vec![NormalizedEvent {
                event_id: Uuid::new_v4(),
                connector_id: "fitbit".into(),
                account_id: self.account_id,
                event_type: EventType::Custom("fitbit:daily_steps_milestone".into()),
                occurred_at: now,
                effective_at: now,
                dedupe_key,
                confidence: 1.0,
                payload: serde_json::json!({
                    "steps": activity.summary.steps,
                    "date_iso": now.format("%Y-%m-%d").to_string(),
                }),
                raw_ref: Some(TraceRef {
                    source: "fitbit-api".into(),
                    id: "steps_10k".into(),
                }),
            }]
        } else {
            vec![]
        }
    }

    /// Map resting heart rate into heart_rate_resting events.
    pub fn map_heart_rate(&self, heart_rate: HeartRate) -> Vec<NormalizedEvent> {
        heart_rate
            .heart_data
            .into_iter()
            .filter(|entry| entry.value.resting_heart_rate > 0)
            .map(|entry| {
                let now = Utc::now();
                let dedupe_key = EventFactory::new_dedupe_key(
                    "fitbit",
                    "resting_heart_rate",
                    now,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "fitbit".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("fitbit:heart_rate_resting".into()),
                    occurred_at: now,
                    effective_at: now,
                    dedupe_key,
                    confidence: 0.95,
                    payload: serde_json::json!({
                        "bpm": entry.value.resting_heart_rate,
                        "date_iso": entry.date_time,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "fitbit-api".into(),
                        id: format!("hr:{}", entry.date_time),
                    }),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-FITBIT-EVENTS-001
    #[test]
    fn map_activities_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = FitbitEventMapper::new(account_id);
        let activity = Activity {
            summary: Default::default(),
            activities: vec![crate::models::LoggedActivity {
                name: "Running".into(),
                duration: 3600000,
                calories: 400,
                distance: 5.0,
                start_time: "2026-04-23T09:00:00Z".into(),
            }],
        };

        let events = mapper.map_activities(activity);
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("fitbit:workout_completed"));
    }

    // Traces to: FR-FITBIT-EVENTS-001
    #[test]
    fn map_sleep_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = FitbitEventMapper::new(account_id);
        let sleep = Sleep {
            sleep: vec![crate::models::SleepSession {
                duration: 28800000,
                efficiency: 92,
                start_time: "2026-04-23T22:00:00Z".into(),
                end_time: "2026-04-24T06:00:00Z".into(),
            }],
            summary: Default::default(),
        };

        let events = mapper.map_sleep(sleep);
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("fitbit:sleep_reported"));
    }

    // Traces to: FR-FITBIT-EVENTS-001
    #[test]
    fn map_steps_milestone() {
        let account_id = Uuid::new_v4();
        let mapper = FitbitEventMapper::new(account_id);
        let activity = Activity {
            summary: crate::models::ActivitySummary {
                steps: 10500,
                calories_burned: 2000,
                distance: 8.5,
                very_active_minutes: 30,
                fairly_active_minutes: 20,
                lightly_active_minutes: 100,
            },
            activities: vec![],
        };

        let events = mapper.map_steps(&activity);
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("fitbit:daily_steps_milestone"));
    }

    // Traces to: FR-FITBIT-EVENTS-001
    #[test]
    fn map_heart_rate_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = FitbitEventMapper::new(account_id);
        let hr = HeartRate {
            heart_data: vec![crate::models::HeartRateEntry {
                date_time: "2026-04-23".into(),
                value: crate::models::HeartRateValue {
                    resting_heart_rate: 62,
                },
            }],
        };

        let events = mapper.map_heart_rate(hr);
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("fitbit:heart_rate_resting"));
    }
}
