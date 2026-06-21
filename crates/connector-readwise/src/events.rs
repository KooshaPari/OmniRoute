// SPDX-License-Identifier: MIT OR Apache-2.0

//! Readwise event mapping — transforms API responses into normalized events.

use chrono::Utc;
use focus_events::{EventFactory, EventType, NormalizedEvent, TraceRef};
use uuid::Uuid;

use crate::models::{Article, Highlight};

pub struct ReadwiseEventMapper {
    account_id: Uuid,
}

impl ReadwiseEventMapper {
    pub fn new(account_id: Uuid) -> Self {
        Self { account_id }
    }

    /// Map Readwise highlights into highlight_created events.
    pub fn map_highlights(&self, highlights: Vec<Highlight>) -> Vec<NormalizedEvent> {
        highlights
            .into_iter()
            .map(|h| {
                let created_at = chrono::DateTime::parse_from_rfc3339(&h.created_at)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "readwise",
                    &h.id,
                    created_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "readwise".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("readwise:highlight_created".into()),
                    occurred_at: created_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.98,
                    payload: serde_json::json!({
                        "highlight_text": h.text,
                        "note": h.note,
                        "document_id": h.document_id,
                        "color": h.color,
                        "created_at_iso": h.created_at,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "readwise-api".into(),
                        id: h.id.clone(),
                    }),
                }
            })
            .collect()
    }

    /// Map Readwise articles into article_read events.
    pub fn map_articles(&self, articles: Vec<Article>) -> Vec<NormalizedEvent> {
        articles
            .into_iter()
            .map(|a| {
                let updated_at = chrono::DateTime::parse_from_rfc3339(&a.updated_at)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let dedupe_key = EventFactory::new_dedupe_key(
                    "readwise",
                    &a.id,
                    updated_at,
                );

                NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "readwise".into(),
                    account_id: self.account_id,
                    event_type: EventType::Custom("readwise:article_read".into()),
                    occurred_at: updated_at,
                    effective_at: Utc::now(),
                    dedupe_key,
                    confidence: 0.90,
                    payload: serde_json::json!({
                        "title": a.title,
                        "author": a.author,
                        "source_url": a.source_url,
                        "cover_image_url": a.cover_image_url,
                        "published_date": a.published_date,
                        "updated_at_iso": a.updated_at,
                    }),
                    raw_ref: Some(TraceRef {
                        source: "readwise-api".into(),
                        id: a.id.clone(),
                    }),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-READWISE-EVENTS-001
    #[test]
    fn map_highlights_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = ReadwiseEventMapper::new(account_id);
        let highlight = Highlight {
            id: "h1".into(),
            text: "Key insight".into(),
            note: Some("Important".into()),
            document_id: "doc1".into(),
            color: Some("yellow".into()),
            created_at: "2026-04-23T09:00:00Z".into(),
            updated_at: "2026-04-23T09:00:00Z".into(),
        };

        let events = mapper.map_highlights(vec![highlight]);
        assert_eq!(events.len(), 1);
        assert!(events[0].event_type.to_string().contains("highlight_created"));
    }

    // Traces to: FR-READWISE-EVENTS-001
    #[test]
    fn map_articles_to_events() {
        let account_id = Uuid::new_v4();
        let mapper = ReadwiseEventMapper::new(account_id);
        let article = Article {
            id: "a1".into(),
            title: "Test Article".into(),
            author: Some("Test Author".into()),
            source_url: Some("https://example.com".into()),
            cover_image_url: None,
            published_date: None,
            created_at: "2026-04-23T09:00:00Z".into(),
            updated_at: "2026-04-23T10:00:00Z".into(),
        };

        let events = mapper.map_articles(vec![article]);
        assert_eq!(events.len(), 1);
        assert!(events[0].event_type.to_string().contains("article_read"));
    }
}
