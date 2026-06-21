// SPDX-License-Identifier: MIT OR Apache-2.0

//! Strava event mapping — transforms API responses into normalized events.

use chrono::Utc;
use focus_events::{EventFactory, EventType, NormalizedEvent, TraceRef};
use uuid::Uuid;

use crate::models::Activity;

pub struct StravaEventMapper {
    account_id: Uuid,
}

impl StravaEventMapper {
    pub fn new(account_id: Uuid) -> Self {
        Self { account_id }
    }

    /// Map Strava activities into activity_completed and pr_earned events.
    pub fn map_activities(&self, activities: Vec<Activity>) -> Vec<NormalizedEvent> {
        let mut events = Vec::new();

        for activity in activities {
            let started_at = chrono::DateTime::parse_from_rfc3339(&activity.start_date)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            // strava:activity_completed event
            let activity_dedupe_key = EventFactory::new_dedupe_key(
                "strava",
                &format!("activity_{}", activity.id),
                started_at,
            );

            events.push(NormalizedEvent {
                event_id: Uuid::new_v4(),
                connector_id: "strava".into(),
                account_id: self.account_id,
                event_type: EventType::Custom("strava:activity_completed".into()),
                occurred_at: started_at,
                effective_at: Utc::now(),
                dedupe_key: activity_dedupe_key,
                confidence: 0.98,
                payload: serde_json::json!({
                    "activity_id": activity.id,
                    "activity_name": activity.name,
                    "sport_type": activity.sport_type,
                    "distance_meters": activity.distance,
                    "moving_time_seconds": activity.moving_time,
                    "elevation_gain_meters": activity.elevation_gain,
                    "started_at_iso": activity.start_date,
                    "average_speed_mps": activity.average_speed,
                    "max_speed_mps": activity.max_speed,
                    "credit_amount": 25,
                }),
                raw_ref: Some(TraceRef {
                    source: "strava-api".into(),
                    id: activity.id.to_string(),
                }),
            });

            // strava:pr_earned event (if pr_count > 0)
            if let Some(pr_count) = activity.pr_count {
                if pr_count > 0 {
                    let pr_dedupe_key = EventFactory::new_dedupe_key(
                        "strava",
                        &format!("pr_{}", activity.id),
                        started_at,
                    );

                    events.push(NormalizedEvent {
                        event_id: Uuid::new_v4(),
                        connector_id: "strava".into(),
                        account_id: self.account_id,
                        event_type: EventType::Custom("strava:pr_earned".into()),
                        occurred_at: started_at,
                        effective_at: Utc::now(),
                        dedupe_key: pr_dedupe_key,
                        confidence: 0.99,
                        payload: serde_json::json!({
                            "activity_id": activity.id,
                            "activity_name": activity.name,
                            "sport_type": activity.sport_type,
                            "pr_count": pr_count,
                            "distance_meters": activity.distance,
                            "started_at_iso": activity.start_date,
                            "credit_amount": 50,
                        }),
                        raw_ref: Some(TraceRef {
                            source: "strava-api".into(),
                            id: format!("pr_{}", activity.id),
                        }),
                    });
                }
            }
        }

        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-STRAVA-EVENTS-001
    #[test]
    fn map_activities_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = StravaEventMapper::new(account_id);
        let activities = vec![crate::models::Activity {
            id: 12345678,
            name: "Evening Run".into(),
            sport_type: "Run".into(),
            start_date: "2026-04-23T19:30:00Z".into(),
            start_date_local: "2026-04-23T15:30:00".into(),
            distance: 5000.0,
            moving_time: 1800,
            elapsed_time: 1850,
            elevation_gain: 50.0,
            type_: Some("Run".into()),
            average_speed: Some(2.78),
            max_speed: Some(4.5),
            total_elevation_gain: Some(50.0),
            has_kudos: Some(false),
            pr_count: None,
            achievement_count: None,
        }];

        let events = mapper.map_activities(activities);
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("strava:activity_completed"));
    }

    // Traces to: FR-STRAVA-EVENTS-002
    #[test]
    fn map_pr_earned_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = StravaEventMapper::new(account_id);
        let activities = vec![crate::models::Activity {
            id: 87654321,
            name: "Fast Run".into(),
            sport_type: "Run".into(),
            start_date: "2026-04-23T07:00:00Z".into(),
            start_date_local: "2026-04-23T03:00:00".into(),
            distance: 10000.0,
            moving_time: 2400,
            elapsed_time: 2450,
            elevation_gain: 100.0,
            type_: Some("Run".into()),
            average_speed: Some(4.17),
            max_speed: Some(5.2),
            total_elevation_gain: Some(100.0),
            has_kudos: Some(true),
            pr_count: Some(1),
            achievement_count: Some(1),
        }];

        let events = mapper.map_activities(activities);
        assert_eq!(events.len(), 2);
        assert!(events
            .iter()
            .any(|e| e.event_type.to_string().contains("strava:activity_completed")));
        assert!(events
            .iter()
            .any(|e| e.event_type.to_string().contains("strava:pr_earned")));
    }

    // Traces to: FR-STRAVA-EVENTS-001
    #[test]
    fn dedupe_key_generation() {
        let account_id = Uuid::new_v4();
        let mapper = StravaEventMapper::new(account_id);
        let activity = crate::models::Activity {
            id: 99999999,
            name: "Test Activity".into(),
            sport_type: "Ride".into(),
            start_date: "2026-04-23T12:00:00Z".into(),
            start_date_local: "2026-04-23T08:00:00".into(),
            distance: 30000.0,
            moving_time: 3600,
            elapsed_time: 3700,
            elevation_gain: 200.0,
            type_: Some("Ride".into()),
            average_speed: Some(8.33),
            max_speed: Some(12.0),
            total_elevation_gain: Some(200.0),
            has_kudos: Some(false),
            pr_count: None,
            achievement_count: None,
        };

        let events = mapper.map_activities(vec![activity.clone()]);
        let activity_event = &events[0];

        // Dedupe key should include strava + activity id + timestamp
        assert!(!activity_event.dedupe_key.0.is_empty());
        assert_eq!(activity_event.event_type.to_string(), "strava:activity_completed");
    }

    // Traces to: FR-STRAVA-EVENTS-002
    #[test]
    fn multiple_prs_single_activity() {
        let account_id = Uuid::new_v4();
        let mapper = StravaEventMapper::new(account_id);
        let activities = vec![crate::models::Activity {
            id: 55555555,
            name: "Personal Best Effort".into(),
            sport_type: "Run".into(),
            start_date: "2026-04-23T06:00:00Z".into(),
            start_date_local: "2026-04-23T02:00:00".into(),
            distance: 5000.0,
            moving_time: 1500,
            elapsed_time: 1550,
            elevation_gain: 25.0,
            type_: Some("Run".into()),
            average_speed: Some(3.33),
            max_speed: Some(5.0),
            total_elevation_gain: Some(25.0),
            has_kudos: Some(true),
            pr_count: Some(2),
            achievement_count: Some(3),
        }];

        let events = mapper.map_activities(activities);
        let pr_events: Vec<_> = events
            .iter()
            .filter(|e| e.event_type.to_string().contains("strava:pr_earned"))
            .collect();

        assert_eq!(pr_events.len(), 1);
        assert_eq!(pr_events[0].payload["pr_count"], 2);
    }
}
