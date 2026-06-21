// SPDX-License-Identifier: MIT OR Apache-2.0

//! focus-calendar — Calendar port + in-memory adapter.
//!
//! Traces to: FR-CONNECTOR-001 (CalendarPort trait).
//!
//! Real GCal / EventKit / CalDAV adapters land later; this crate only defines
//! the contract the scheduler and the rest of the core talk to.

#![deny(clippy::all)]

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use focus_domain::Rigidity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub source: String,
    pub rigidity: Rigidity,
}

impl CalendarEvent {
    pub fn overlaps(&self, other_start: DateTime<Utc>, other_end: DateTime<Utc>) -> bool {
        self.starts_at < other_end && other_start < self.ends_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarEventDraft {
    pub title: String,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub source: String,
    pub rigidity: Rigidity,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DateRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl DateRange {
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    pub fn contains_any(&self, e: &CalendarEvent) -> bool {
        e.overlaps(self.start, self.end)
    }
}

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

#[async_trait]
pub trait CalendarPort: Send + Sync {
    async fn list_events(&self, range: DateRange) -> anyhow::Result<Vec<CalendarEvent>>;
    async fn create_event(&self, event: &CalendarEventDraft) -> anyhow::Result<CalendarEvent>;
    async fn delete_event(&self, id: &str) -> anyhow::Result<()>;
}

// ---------------------------------------------------------------------------
// InMemory adapter
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct InMemoryCalendarPort {
    inner: Arc<RwLock<Vec<CalendarEvent>>>,
}

impl InMemoryCalendarPort {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.inner.read().await.is_empty()
    }
}

#[async_trait]
impl CalendarPort for InMemoryCalendarPort {
    async fn list_events(&self, range: DateRange) -> anyhow::Result<Vec<CalendarEvent>> {
        let guard = self.inner.read().await;
        let mut out: Vec<CalendarEvent> =
            guard.iter().filter(|e| range.contains_any(e)).cloned().collect();
        out.sort_by_key(|e| e.starts_at);
        Ok(out)
    }

    async fn create_event(&self, draft: &CalendarEventDraft) -> anyhow::Result<CalendarEvent> {
        let event = CalendarEvent {
            id: Uuid::new_v4().to_string(),
            title: draft.title.clone(),
            starts_at: draft.starts_at,
            ends_at: draft.ends_at,
            source: draft.source.clone(),
            rigidity: draft.rigidity.clone(),
        };
        self.inner.write().await.push(event.clone());
        Ok(event)
    }

    async fn delete_event(&self, id: &str) -> anyhow::Result<()> {
        let mut guard = self.inner.write().await;
        guard.retain(|e| e.id != id);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};

    fn t0() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn draft(title: &str, start_off_min: i64, dur_min: i64) -> CalendarEventDraft {
        CalendarEventDraft {
            title: title.to_string(),
            starts_at: t0() + Duration::minutes(start_off_min),
            ends_at: t0() + Duration::minutes(start_off_min + dur_min),
            source: "test".into(),
            rigidity: Rigidity::Soft,
            metadata: HashMap::new(),
        }
    }

    // Traces to: FR-CONNECTOR-001
    #[tokio::test]
    async fn in_memory_roundtrip_create_and_list() {
        let cal = InMemoryCalendarPort::new();
        let _ = cal.create_event(&draft("standup", 0, 30)).await.unwrap();
        let evs = cal.list_events(DateRange::new(t0(), t0() + Duration::hours(2))).await.unwrap();
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].title, "standup");
    }

    // Traces to: FR-CONNECTOR-001
    #[tokio::test]
    async fn overlapping_events_returned_sorted() {
        let cal = InMemoryCalendarPort::new();
        cal.create_event(&draft("late", 90, 30)).await.unwrap();
        cal.create_event(&draft("early", 0, 30)).await.unwrap();
        cal.create_event(&draft("middle", 45, 30)).await.unwrap();
        let evs = cal.list_events(DateRange::new(t0(), t0() + Duration::hours(3))).await.unwrap();
        assert_eq!(evs.len(), 3);
        assert_eq!(evs[0].title, "early");
        assert_eq!(evs[1].title, "middle");
        assert_eq!(evs[2].title, "late");
    }

    // Traces to: FR-CONNECTOR-001
    #[tokio::test]
    async fn deletion_clears_event() {
        let cal = InMemoryCalendarPort::new();
        let e = cal.create_event(&draft("gone", 0, 15)).await.unwrap();
        assert_eq!(cal.len().await, 1);
        cal.delete_event(&e.id).await.unwrap();
        assert!(cal.is_empty().await);
    }

    // Traces to: FR-CONNECTOR-001
    #[tokio::test]
    async fn list_filters_by_range() {
        let cal = InMemoryCalendarPort::new();
        cal.create_event(&draft("in", 10, 15)).await.unwrap();
        cal.create_event(&draft("out", 500, 15)).await.unwrap();
        let evs = cal.list_events(DateRange::new(t0(), t0() + Duration::hours(2))).await.unwrap();
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].title, "in");
    }
}
