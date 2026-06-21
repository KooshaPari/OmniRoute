// SPDX-License-Identifier: MIT OR Apache-2.0

//! Google Calendar -> NormalizedEvent mapping.
#![allow(clippy::disallowed_methods)]

use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use focus_events::{DedupeKey, EventType, NormalizedEvent, TraceRef, WellKnownEventType};
use serde_json::json;
use uuid::Uuid;

use crate::models::{CalendarListEntry, EventDateTime, GCalEvent};

pub const CONNECTOR_ID: &str = "gcal";

/// Compute a stable dedupe key for a Google Calendar entity.
pub fn dedupe_key(entity_type: &str, id: &str, timestamp: i64) -> DedupeKey {
    DedupeKey(format!("gcal:{entity_type}:{id}:{timestamp}"))
}

pub struct GCalEventMapper;

impl GCalEventMapper {
    /// Map a Google Calendar event to an `EventStarted` NormalizedEvent.
    pub fn map_event_started(
        ev: &GCalEvent,
        account_id: Uuid,
        calendar_id: &str,
    ) -> NormalizedEvent {
        let occurred = start_datetime(ev.start.as_ref()).unwrap_or_else(Utc::now);
        let end = end_datetime(ev.end.as_ref());
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: CONNECTOR_ID.into(),
            account_id,
            event_type: EventType::WellKnown(WellKnownEventType::EventStarted),
            occurred_at: occurred,
            effective_at: occurred,
            dedupe_key: dedupe_key("event_started", &ev.id, occurred.timestamp()),
            confidence: 1.0,
            payload: json!({
                "calendar_id": calendar_id,
                "event_id": ev.id,
                "summary": ev.summary,
                "description": ev.description,
                "location": ev.location,
                "start": ev.start,
                "end": ev.end,
                "end_at": end,
                "html_link": ev.html_link,
                "ical_uid": ev.ical_uid,
                "status": ev.status,
                "transparency": ev.transparency,
                "all_day": is_all_day(ev),
            }),
            raw_ref: Some(TraceRef { source: CONNECTOR_ID.into(), id: format!("event:{}", ev.id) }),
        }
    }

    /// Map the event-end as its own signal (useful for freeing focus windows).
    pub fn map_event_ended(
        ev: &GCalEvent,
        account_id: Uuid,
        calendar_id: &str,
    ) -> Option<NormalizedEvent> {
        let end = end_datetime(ev.end.as_ref())?;
        Some(NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: CONNECTOR_ID.into(),
            account_id,
            event_type: EventType::WellKnown(WellKnownEventType::EventEnded),
            occurred_at: end,
            effective_at: end,
            dedupe_key: dedupe_key("event_ended", &ev.id, end.timestamp()),
            confidence: 1.0,
            payload: json!({
                "calendar_id": calendar_id,
                "event_id": ev.id,
                "summary": ev.summary,
                "end_at": end,
            }),
            raw_ref: Some(TraceRef { source: CONNECTOR_ID.into(), id: format!("event:{}", ev.id) }),
        })
    }

    /// Signal that a calendar is visible / subscribed — parallels the
    /// `course_enrolled` event in Canvas.
    pub fn map_calendar_subscribed(cal: &CalendarListEntry, account_id: Uuid) -> NormalizedEvent {
        let occurred = Utc::now();
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: CONNECTOR_ID.into(),
            account_id,
            event_type: EventType::Custom("gcal:calendar_subscribed".into()),
            occurred_at: occurred,
            effective_at: occurred,
            dedupe_key: dedupe_key("calendar", &cal.id, occurred.timestamp()),
            confidence: 1.0,
            payload: json!({
                "calendar_id": cal.id,
                "summary": cal.summary,
                "primary": cal.primary.unwrap_or(false),
                "access_role": cal.access_role,
                "time_zone": cal.time_zone,
            }),
            raw_ref: Some(TraceRef {
                source: CONNECTOR_ID.into(),
                id: format!("calendar:{}", cal.id),
            }),
        }
    }
}

/// Parse a Google `EventDateTime` into a UTC timestamp.
///
/// Google returns:
/// - `dateTime` — RFC3339 with offset, for timed events
/// - `date` — `YYYY-MM-DD`, for all-day events; treat as midnight UTC
pub fn start_datetime(dt: Option<&EventDateTime>) -> Option<DateTime<Utc>> {
    let dt = dt?;
    if let Some(s) = dt.date_time.as_deref() {
        return DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&Utc));
    }
    if let Some(s) = dt.date.as_deref() {
        return NaiveDate::parse_from_str(s, "%Y-%m-%d")
            .ok()
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|n| Utc.from_utc_datetime(&n));
    }
    None
}

pub fn end_datetime(dt: Option<&EventDateTime>) -> Option<DateTime<Utc>> {
    // Same semantics as start — Google uses the same shape for both.
    start_datetime(dt)
}

/// An event is "all day" iff the start has a `date` field (not `dateTime`).
pub fn is_all_day(ev: &GCalEvent) -> bool {
    ev.start.as_ref().map(|s| s.date.is_some() && s.date_time.is_none()).unwrap_or(false)
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    fn acct() -> Uuid {
        Uuid::nil()
    }

    fn timed_event(id: &str, start_rfc: &str, end_rfc: &str) -> GCalEvent {
        GCalEvent {
            id: id.into(),
            status: Some("confirmed".into()),
            summary: "Meeting".into(),
            description: None,
            location: None,
            start: Some(EventDateTime {
                date_time: Some(start_rfc.into()),
                date: None,
                time_zone: Some("UTC".into()),
            }),
            end: Some(EventDateTime {
                date_time: Some(end_rfc.into()),
                date: None,
                time_zone: Some("UTC".into()),
            }),
            html_link: Some("https://cal/x".into()),
            ical_uid: Some(format!("{id}@google")),
            event_type: None,
            recurring_event_id: None,
            transparency: None,
            attendees: None,
            conference_data: None,
            reminders: None,
            recurrence: None,
        }
    }

    #[test]
    fn maps_timed_event_to_event_started() {
        let e = timed_event("e1", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z");
        let ev = GCalEventMapper::map_event_started(&e, acct(), "primary");
        assert_eq!(ev.event_type, EventType::WellKnown(WellKnownEventType::EventStarted));
        assert_eq!(ev.payload["calendar_id"], "primary");
        assert_eq!(ev.payload["all_day"], false);
        assert!(ev.dedupe_key.0.starts_with("gcal:event_started:e1:"));
    }

    #[test]
    fn maps_event_ended_when_end_present() {
        let e = timed_event("e1", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z");
        let ev = GCalEventMapper::map_event_ended(&e, acct(), "primary").unwrap();
        assert_eq!(ev.event_type, EventType::WellKnown(WellKnownEventType::EventEnded));
        assert!(ev.dedupe_key.0.starts_with("gcal:event_ended:e1:"));
    }

    #[test]
    fn event_ended_none_when_no_end() {
        let mut e = timed_event("e1", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z");
        e.end = None;
        assert!(GCalEventMapper::map_event_ended(&e, acct(), "primary").is_none());
    }

    #[test]
    fn all_day_event_marks_all_day_and_parses_midnight_utc() {
        let e = GCalEvent {
            id: "h".into(),
            status: None,
            summary: "Holiday".into(),
            description: None,
            location: None,
            start: Some(EventDateTime {
                date: Some("2026-07-04".into()),
                date_time: None,
                time_zone: None,
            }),
            end: Some(EventDateTime {
                date: Some("2026-07-05".into()),
                date_time: None,
                time_zone: None,
            }),
            html_link: None,
            ical_uid: None,
            event_type: None,
            recurring_event_id: None,
            transparency: None,
            attendees: None,
            conference_data: None,
            reminders: None,
            recurrence: None,
        };
        let ev = GCalEventMapper::map_event_started(&e, acct(), "primary");
        assert_eq!(ev.payload["all_day"], true);
        assert_eq!(ev.occurred_at, Utc.with_ymd_and_hms(2026, 7, 4, 0, 0, 0).unwrap());
    }

    #[test]
    fn maps_calendar_subscribed() {
        let c = CalendarListEntry {
            id: "primary".into(),
            summary: "Me".into(),
            description: None,
            primary: Some(true),
            time_zone: Some("UTC".into()),
            access_role: Some("owner".into()),
            selected: None,
            color: None,
        };
        let ev = GCalEventMapper::map_calendar_subscribed(&c, acct());
        assert_eq!(ev.event_type, EventType::Custom("gcal:calendar_subscribed".into()));
        assert_eq!(ev.payload["calendar_id"], "primary");
        assert_eq!(ev.payload["primary"], true);
    }

    #[test]
    fn dedupe_keys_are_distinct_per_entity() {
        let e = timed_event("e1", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z");
        let c = CalendarListEntry {
            id: "primary".into(),
            summary: "".into(),
            description: None,
            primary: None,
            time_zone: None,
            access_role: None,
            selected: None,
            color: None,
        };
        let a = GCalEventMapper::map_event_started(&e, acct(), "primary");
        let b = GCalEventMapper::map_calendar_subscribed(&c, acct());
        assert_ne!(a.dedupe_key, b.dedupe_key);
    }

    #[test]
    fn trace_ref_points_at_event_id() {
        let e = timed_event("abc", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z");
        let ev = GCalEventMapper::map_event_started(&e, acct(), "primary");
        let tr = ev.raw_ref.unwrap();
        assert_eq!(tr.source, "gcal");
        assert_eq!(tr.id, "event:abc");
    }
}
