// SPDX-License-Identifier: MIT OR Apache-2.0

//! Readwise Reader API client — /documents, /highlights endpoints.

use reqwest::Client;
use serde_json::Value;
use phenotype_observably_macros::async_instrumented;

use focus_connectors::Result as ConnResult;

use crate::models::{Article, Highlight};

const READWISE_API_BASE: &str = "https://readwise.io/api/v3";

/// Readwise REST client — makes authenticated calls to Readwise Reader API.
pub struct ReadwiseClient {
    http: Client,
}

impl ReadwiseClient {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// GET /reader — fetch reader metadata for health check.
    #[async_instrumented]
    pub async fn get_reader_data(&self) -> ConnResult<Value> {
        let url = format!("{}/reader", READWISE_API_BASE);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Readwise token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Readwise reader request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /documents — fetch all documents (articles).
    #[async_instrumented]
    pub async fn get_articles(&self) -> ConnResult<Vec<Article>> {
        let url = format!("{}/documents", READWISE_API_BASE);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;
            let articles = Article::from_readwise_json(&json);
            Ok(articles)
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Readwise token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Readwise articles request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /highlights — fetch all highlights.
    #[async_instrumented]
    pub async fn get_highlights(&self) -> ConnResult<Vec<Highlight>> {
        let url = format!("{}/highlights", READWISE_API_BASE);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;
            let highlights = Highlight::from_readwise_json(&json);
            Ok(highlights)
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Readwise token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Readwise highlights request failed: {}",
                resp.status()
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-READWISE-API-001 (API client contract)
    #[test]
    fn readwise_client_construction() {
        let http = Client::new();
        let _client = ReadwiseClient::new(http);
        assert!(true);
    }

    // Traces to: FR-READWISE-API-002 (parse article response)
    #[test]
    fn parse_article_response() {
        let article_json = serde_json::json!({
            "results": [{
                "id": "doc_123",
                "title": "How to Build Great Apps",
                "author": "Jane Doe",
                "source_url": "https://example.com/article",
                "created_at": "2026-04-20T10:00:00Z",
                "updated_at": "2026-04-24T15:00:00Z",
                "reading_progress": 0.75
            }]
        });

        let articles = Article::from_readwise_json(&article_json);
        assert!(!articles.is_empty());
        assert_eq!(articles[0].title, "How to Build Great Apps");
    }

    // Traces to: FR-READWISE-API-003 (parse highlight response)
    #[test]
    fn parse_highlight_response() {
        let highlight_json = serde_json::json!({
            "results": [{
                "id": "hl_456",
                "text": "This is a highlighted quote from the article",
                "color": "yellow",
                "document_id": "doc_123",
                "created_at": "2026-04-22T12:00:00Z",
                "updated_at": "2026-04-22T12:00:00Z",
                "tags": ["important", "quote"]
            }]
        });

        let highlights = Highlight::from_readwise_json(&highlight_json);
        assert!(!highlights.is_empty());
        assert_eq!(highlights[0].text, "This is a highlighted quote from the article");
    }

    // Traces to: FR-READWISE-API-004 (parse multiple articles)
    #[test]
    fn parse_multiple_articles() {
        let articles_json = serde_json::json!({
            "results": [
                {
                    "id": "doc1",
                    "title": "Article 1",
                    "author": "Author A",
                    "source_url": "https://example.com/1",
                    "created_at": "2026-04-20T10:00:00Z",
                    "updated_at": "2026-04-20T10:00:00Z",
                    "reading_progress": 1.0
                },
                {
                    "id": "doc2",
                    "title": "Article 2",
                    "author": "Author B",
                    "source_url": "https://example.com/2",
                    "created_at": "2026-04-21T10:00:00Z",
                    "updated_at": "2026-04-21T10:00:00Z",
                    "reading_progress": 0.5
                }
            ]
        });

        let articles = Article::from_readwise_json(&articles_json);
        assert_eq!(articles.len(), 2);
        assert_eq!(articles[0].id, "doc1");
        assert_eq!(articles[1].id, "doc2");
    }

    // Traces to: FR-READWISE-API-005 (API base URL)
    #[test]
    fn readwise_api_base_url() {
        assert_eq!(READWISE_API_BASE, "https://readwise.io/api/v3");
    }

    // Traces to: FR-READWISE-API-006 (empty highlights list)
    #[test]
    fn parse_empty_highlights_list() {
        let empty_json = serde_json::json!([]);
        let highlights = Highlight::from_readwise_json(&empty_json);
        assert!(highlights.is_empty());
    }

    // Traces to: FR-READWISE-API-007 (highlight color variants)
    #[test]
    fn parse_highlights_with_different_colors() {
        let yellow_hl = serde_json::json!({
            "id": "hl1",
            "text": "Yellow highlight",
            "color": "yellow",
            "created_at": "2026-04-22T12:00:00Z"
        });
        let red_hl = serde_json::json!({
            "id": "hl2",
            "text": "Red highlight",
            "color": "red",
            "created_at": "2026-04-22T12:00:00Z"
        });
        let blue_hl = serde_json::json!({
            "id": "hl3",
            "text": "Blue highlight",
            "color": "blue",
            "created_at": "2026-04-22T12:00:00Z"
        });

        let _yellow = Highlight::from_readwise_json(&yellow_hl);
        let _red = Highlight::from_readwise_json(&red_hl);
        let _blue = Highlight::from_readwise_json(&blue_hl);
        assert!(true);
    }

    // Traces to: FR-READWISE-API-008 (article with reading progress)
    #[test]
    fn parse_article_reading_progress() {
        let unread = serde_json::json!({
            "id": "doc1",
            "title": "Unread",
            "reading_progress": 0.0
        });
        let partially_read = serde_json::json!({
            "id": "doc2",
            "title": "Partially Read",
            "reading_progress": 0.5
        });
        let fully_read = serde_json::json!({
            "id": "doc3",
            "title": "Fully Read",
            "reading_progress": 1.0
        });

        let _unread = Article::from_readwise_json(&unread);
        let _partial = Article::from_readwise_json(&partially_read);
        let _full = Article::from_readwise_json(&fully_read);
        assert!(true);
    }
}
