// SPDX-License-Identifier: MIT OR Apache-2.0

//! Google Calendar v3 domain types. Field names match Google's REST API.
//!
//! Google returns `dateTime` as RFC3339 with offset, and `date` as `YYYY-MM-DD`
//! for all-day events. We keep both as `Option<String>` and let the event
//! mapper parse when possible — trying to force chrono here loses fidelity for
//! all-day events.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarListEntry {
    pub id: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub primary: Option<bool>,
    #[serde(default)]
    pub time_zone: Option<String>,
    #[serde(default, rename = "accessRole")]
    pub access_role: Option<String>,
    #[serde(default)]
    pub selected: Option<bool>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarList {
    #[serde(default)]
    pub items: Vec<CalendarListEntry>,
    #[serde(default, rename = "nextPageToken")]
    pub next_page_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct EventDateTime {
    #[serde(default, rename = "dateTime")]
    pub date_time: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default, rename = "timeZone")]
    pub time_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GCalEvent {
    pub id: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub start: Option<EventDateTime>,
    #[serde(default)]
    pub end: Option<EventDateTime>,
    #[serde(default, rename = "htmlLink")]
    pub html_link: Option<String>,
    #[serde(default, rename = "iCalUID")]
    pub ical_uid: Option<String>,
    #[serde(default, rename = "eventType")]
    pub event_type: Option<String>,
    #[serde(default, rename = "recurringEventId")]
    pub recurring_event_id: Option<String>,
    #[serde(default)]
    pub transparency: Option<String>,
    #[serde(default)]
    pub attendees: Option<Vec<Attendee>>,
    #[serde(default, rename = "conferenceData")]
    pub conference_data: Option<ConferenceData>,
    #[serde(default)]
    pub reminders: Option<Reminders>,
    #[serde(default, rename = "recurrence")]
    pub recurrence: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Attendee {
    #[serde(default)]
    pub email: String,
    #[serde(default, rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(default, rename = "responseStatus")]
    pub response_status: Option<String>,
    #[serde(default, rename = "self")]
    pub self_: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConferenceData {
    #[serde(default, rename = "entryPoints")]
    pub entry_points: Option<Vec<EntryPoint>>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntryPoint {
    #[serde(default, rename = "entryPointType")]
    pub entry_point_type: Option<String>,
    #[serde(default)]
    pub uri: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Reminders {
    #[serde(default, rename = "useDefault")]
    pub use_default: Option<bool>,
    #[serde(default)]
    pub overrides: Option<Vec<Reminder>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Reminder {
    #[serde(default)]
    pub method: String,
    #[serde(default, rename = "minutes")]
    pub minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventList {
    #[serde(default)]
    pub items: Vec<GCalEvent>,
    #[serde(default, rename = "nextPageToken")]
    pub next_page_token: Option<String>,
    #[serde(default, rename = "nextSyncToken")]
    pub next_sync_token: Option<String>,
    #[serde(default, rename = "timeZone")]
    pub time_zone: Option<String>,
}

/// User info returned by `/oauth2/v2/userinfo`. Used as a health-check probe
/// (parallel to Canvas's `/users/self`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCalUser {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub name: String,
}

/// Request body for `/watch` endpoint to set up push notifications.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchRequest {
    pub id: String,
    pub type_: String,
    pub address: String,
    #[serde(default)]
    pub expiration: Option<String>,
}

/// Response from `/watch` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchResponse {
    pub kind: String,
    pub id: String,
    pub resource_id: String,
    pub resource_uri: String,
    pub token: Option<String>,
    pub expiration: Option<String>,
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    #[test]
    fn parses_calendar_list_minimal() {
        let j = r#"{"items":[{"id":"primary","summary":"Me","primary":true}]}"#;
        let l: CalendarList = serde_json::from_str(j).unwrap();
        assert_eq!(l.items.len(), 1);
        assert_eq!(l.items[0].id, "primary");
        assert_eq!(l.items[0].primary, Some(true));
    }

    #[test]
    fn parses_event_timed() {
        let j = r#"{
            "id":"evt1",
            "summary":"Standup",
            "start":{"dateTime":"2026-05-01T09:00:00-07:00","timeZone":"America/Los_Angeles"},
            "end":{"dateTime":"2026-05-01T09:30:00-07:00"},
            "htmlLink":"https://cal.example/evt1",
            "status":"confirmed"
        }"#;
        let e: GCalEvent = serde_json::from_str(j).unwrap();
        assert_eq!(e.id, "evt1");
        assert_eq!(e.summary, "Standup");
        assert_eq!(
            e.start.as_ref().and_then(|s| s.date_time.as_deref()),
            Some("2026-05-01T09:00:00-07:00")
        );
    }

    #[test]
    fn parses_event_all_day() {
        let j = r#"{"id":"evt2","summary":"Holiday","start":{"date":"2026-07-04"},"end":{"date":"2026-07-05"}}"#;
        let e: GCalEvent = serde_json::from_str(j).unwrap();
        assert_eq!(e.start.as_ref().and_then(|s| s.date.as_deref()), Some("2026-07-04"));
        assert!(e.start.as_ref().unwrap().date_time.is_none());
    }

    #[test]
    fn parses_event_list_with_paging() {
        let j = r#"{"items":[{"id":"a","summary":"A"}],"nextPageToken":"tok","timeZone":"UTC"}"#;
        let l: EventList = serde_json::from_str(j).unwrap();
        assert_eq!(l.items.len(), 1);
        assert_eq!(l.next_page_token.as_deref(), Some("tok"));
        assert_eq!(l.time_zone.as_deref(), Some("UTC"));
    }
}
