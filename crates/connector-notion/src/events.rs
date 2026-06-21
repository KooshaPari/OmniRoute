// SPDX-License-Identifier: MIT OR Apache-2.0

//! Notion event mapping — transforms API responses into normalized events.

use chrono::Utc;
use focus_events::{EventFactory, EventType, NormalizedEvent, TraceRef};
use uuid::Uuid;

use crate::models::{NotionPage, NotionTask};

pub struct NotionEventMapper {
    account_id: Uuid,
}

impl NotionEventMapper {
    pub fn new(account_id: Uuid) -> Self {
        Self { account_id }
    }

    /// Map Notion pages into page_updated events.
    pub fn map_pages(&self, pages: Vec<NotionPage>) -> Vec<NormalizedEvent> {
        pages
            .into_iter()
            .map(|p| {
                let edited_at = chrono::DateTime::parse_from_rfc3339(&p.last_edited_time)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "notion",
                    &p.id,
                    edited_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "notion".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("notion:page_updated".into()),
                    occurred_at: edited_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.97,
                    payload: serde_json::json!({
                        "page_title": p.title,
                        "icon": p.icon,
                        "page_url": p.url,
                        "created_at_iso": p.created_time,
                        "last_edited_at_iso": p.last_edited_time,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "notion-api".into(),
                        id: p.id.clone(),
                    }),
                }
            })
            .collect()
    }

    /// Map Notion tasks into task_completed events.
    pub fn map_tasks(&self, tasks: Vec<NotionTask>) -> Vec<NormalizedEvent> {
        tasks
            .into_iter()
            .filter(|t| t.completed)
            .map(|t| {
                let edited_at = chrono::DateTime::parse_from_rfc3339(&t.last_edited_time)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "notion",
                    &t.id,
                    edited_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "notion".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("notion:task_completed".into()),
                    occurred_at: edited_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.99,
                    payload: serde_json::json!({
                        "task_title": t.title,
                        "due_date": t.due_date,
                        "completed_at_iso": t.last_edited_time,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "notion-api".into(),
                        id: t.id.clone(),
                    }),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-NOTION-EVENTS-001
    #[test]
    fn map_pages_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = NotionEventMapper::new(account_id);
        let page = NotionPage {
            id: "p1".into(),
            title: "Project Plan".into(),
            icon: Some("📋".into()),
            created_time: "2026-04-23T09:00:00Z".into(),
            last_edited_time: "2026-04-23T10:00:00Z".into(),
            url: "https://notion.so/p1".into(),
        };

        let events = mapper.map_pages(vec![page]);
        assert_eq!(events.len(), 1);
        assert!(events[0].event_type.to_string().contains("page_updated"));
    }

    // Traces to: FR-NOTION-EVENTS-001
    #[test]
    fn map_tasks_to_events_only_completed() {
        let account_id = Uuid::new_v4();
        let mapper = NotionEventMapper::new(account_id);
        let task_completed = NotionTask {
            id: "t1".into(),
            title: "Task Done".into(),
            completed: true,
            due_date: Some("2026-04-25".into()),
            last_edited_time: "2026-04-23T10:00:00Z".into(),
        };
        let task_pending = NotionTask {
            id: "t2".into(),
            title: "Task Pending".into(),
            completed: false,
            due_date: None,
            last_edited_time: "2026-04-23T09:00:00Z".into(),
        };

        let events = mapper.map_tasks(vec![task_completed, task_pending]);
        assert_eq!(events.len(), 1);
        assert!(events[0].event_type.to_string().contains("task_completed"));
    }
}
