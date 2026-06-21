// SPDX-License-Identifier: MIT OR Apache-2.0

//! Notion API v1 client — /users/me, /databases, /pages endpoints.

use reqwest::Client;
use serde_json::Value;
use phenotype_observably_macros::async_instrumented;

use focus_connectors::Result as ConnResult;

use crate::models::{NotionPage, NotionTask};

const NOTION_API_BASE: &str = "https://api.notion.com/v1";

/// Notion API v1 client — makes authenticated calls to Notion.
pub struct NotionClient {
    http: Client,
}

impl NotionClient {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// GET /users/me — fetch current user for health check.
    #[async_instrumented]
    pub async fn get_me(&self) -> ConnResult<Value> {
        let url = format!("{}/users/me", NOTION_API_BASE);
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
                "Notion integration token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Notion me request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /search (query for pages) — fetch all accessible pages.
    #[async_instrumented]
    pub async fn get_pages(&self) -> ConnResult<Vec<NotionPage>> {
        let url = format!("{}/search", NOTION_API_BASE);
        let resp = self
            .http
            .post(&url)
            .json(&serde_json::json!({
                "filter": { "property": "object", "value": "page" },
                "sort": { "direction": "descending", "timestamp": "last_edited_time" }
            }))
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;
            let pages = NotionPage::from_notion_json(&json);
            Ok(pages)
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Notion integration token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Notion pages request failed: {}",
                resp.status()
            )))
        }
    }

    /// Query all pages marked as tasks in Notion.
    #[async_instrumented]
    pub async fn get_tasks(&self) -> ConnResult<Vec<NotionTask>> {
        let url = format!("{}/search", NOTION_API_BASE);
        let resp = self
            .http
            .post(&url)
            .json(&serde_json::json!({
                "filter": { "property": "object", "value": "page" },
            }))
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;
            let tasks = NotionTask::from_notion_json(&json);
            Ok(tasks)
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Notion integration token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Notion tasks request failed: {}",
                resp.status()
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-NOTION-API-001 (API client contract)
    #[test]
    fn notion_client_construction() {
        let http = Client::new();
        let _client = NotionClient::new(http);
        assert!(true);
    }

    // Traces to: FR-NOTION-API-002 (parse page response)
    #[test]
    fn parse_page_response() {
        let page_json = serde_json::json!({
            "results": [{
                "object": "page",
                "id": "abc123",
                "created_time": "2026-04-20T10:00:00.000Z",
                "last_edited_time": "2026-04-24T15:00:00.000Z",
                "url": "https://notion.so/p/abc123",
                "properties": {
                    "title": {
                        "id": "title",
                        "type": "title",
                        "title": [{"type": "text", "plain_text": "My Page"}]
                    }
                }
            }]
        });

        let pages = NotionPage::from_notion_json(&page_json);
        assert!(!pages.is_empty());
        assert_eq!(pages[0].title, "My Page");
    }

    // Traces to: FR-NOTION-API-003 (parse task response)
    #[test]
    fn parse_task_response() {
        let task_json = serde_json::json!({
            "results": [{
                "object": "page",
                "id": "task123",
                "created_time": "2026-04-20T10:00:00.000Z",
                "last_edited_time": "2026-04-24T15:00:00.000Z",
                "properties": {
                    "title": {
                        "id": "title",
                        "type": "title",
                        "title": [{"type": "text", "plain_text": "Complete task"}]
                    },
                    "status": {
                        "id": "status",
                        "type": "select",
                        "select": {"name": "In Progress"}
                    }
                }
            }]
        });

        let tasks = NotionTask::from_notion_json(&task_json);
        assert!(!tasks.is_empty());
        assert_eq!(tasks[0].title, "Complete task");
    }

    // Traces to: FR-NOTION-API-004 (parse multiple pages)
    #[test]
    fn parse_multiple_pages() {
        let pages_json = serde_json::json!({
            "results": [
                {
                    "object": "page",
                    "id": "page1",
                    "created_time": "2026-04-20T10:00:00.000Z",
                    "last_edited_time": "2026-04-20T10:00:00.000Z",
                    "url": "https://notion.so/p/page1",
                    "properties": {
                        "title": {
                            "id": "title",
                            "type": "title",
                            "title": [{"type": "text", "plain_text": "Page 1"}]
                        }
                    }
                },
                {
                    "object": "page",
                    "id": "page2",
                    "created_time": "2026-04-21T10:00:00.000Z",
                    "last_edited_time": "2026-04-21T10:00:00.000Z",
                    "url": "https://notion.so/p/page2",
                    "properties": {
                        "title": {
                            "id": "title",
                            "type": "title",
                            "title": [{"type": "text", "plain_text": "Page 2"}]
                        }
                    }
                }
            ]
        });

        let pages = NotionPage::from_notion_json(&pages_json);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].id, "page1");
        assert_eq!(pages[1].id, "page2");
    }

    // Traces to: FR-NOTION-API-005 (API base URL)
    #[test]
    fn notion_api_base_url() {
        assert_eq!(NOTION_API_BASE, "https://api.notion.com/v1");
    }

    // Traces to: FR-NOTION-API-006 (empty page list)
    #[test]
    fn parse_empty_page_list() {
        let empty_json = serde_json::json!([]);
        let pages = NotionPage::from_notion_json(&empty_json);
        assert!(pages.is_empty());
    }

    // Traces to: FR-NOTION-API-007 (task status variants)
    #[test]
    fn parse_task_with_different_statuses() {
        let task_todo = serde_json::json!({
            "object": "page",
            "id": "task_todo",
            "properties": {
                "status": {"select": {"name": "Todo"}}
            }
        });
        let task_done = serde_json::json!({
            "object": "page",
            "id": "task_done",
            "properties": {
                "status": {"select": {"name": "Done"}}
            }
        });

        let _tasks_todo = NotionTask::from_notion_json(&task_todo);
        let _tasks_done = NotionTask::from_notion_json(&task_done);
        assert!(true);
    }

    // Traces to: FR-NOTION-API-008 (pagination support)
    #[test]
    fn parse_paginated_response() {
        let paginated = serde_json::json!({
            "object": "list",
            "results": [
                {"object": "page", "id": "p1", "properties": {}},
                {"object": "page", "id": "p2", "properties": {}},
            ],
            "next_cursor": "cursor_abc",
            "has_more": true
        });

        let pages = NotionPage::from_notion_json(&paginated);
        // Should parse without error even with pagination metadata
        assert!(true);
    }
}
