// SPDX-License-Identifier: MIT OR Apache-2.0

//! Notion data models.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotionPage {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub created_time: String,
    pub last_edited_time: String,
    pub url: String,
}

impl NotionPage {
    pub fn from_notion_json(json: &Value) -> Vec<NotionPage> {
        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
            results
                .iter()
                .filter_map(|page| {
                    let title = page
                        .get("properties")
                        .and_then(|p| p.get("title"))
                        .and_then(|t| t.get("title"))
                        .and_then(|arr| arr.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|t| t.get("plain_text"))
                        .and_then(|t| t.as_str())
                        .unwrap_or("Untitled");

                    Some(NotionPage {
                        id: page.get("id")?.as_str()?.into(),
                        title: title.into(),
                        icon: page
                            .get("icon")
                            .and_then(|i| i.get("emoji"))
                            .and_then(|e| e.as_str())
                            .map(|s| s.into()),
                        created_time: page.get("created_time")?.as_str()?.into(),
                        last_edited_time: page.get("last_edited_time")?.as_str()?.into(),
                        url: page.get("url")?.as_str()?.into(),
                    })
                })
                .collect()
        } else {
            vec![]
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotionTask {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub due_date: Option<String>,
    pub last_edited_time: String,
}

impl NotionTask {
    pub fn from_notion_json(json: &Value) -> Vec<NotionTask> {
        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
            results
                .iter()
                .filter_map(|task| {
                    let title = task
                        .get("properties")
                        .and_then(|p| p.get("title"))
                        .and_then(|t| t.get("title"))
                        .and_then(|arr| arr.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|t| t.get("plain_text"))
                        .and_then(|t| t.as_str())
                        .unwrap_or("Untitled");

                    let completed = task
                        .get("properties")
                        .and_then(|p| p.get("Completed"))
                        .and_then(|c| c.get("checkbox"))
                        .and_then(|c| c.as_bool())
                        .unwrap_or(false);

                    Some(NotionTask {
                        id: task.get("id")?.as_str()?.into(),
                        title: title.into(),
                        completed,
                        due_date: task
                            .get("properties")
                            .and_then(|p| p.get("Due"))
                            .and_then(|d| d.get("date"))
                            .and_then(|d| d.get("start"))
                            .and_then(|s| s.as_str())
                            .map(|s| s.into()),
                        last_edited_time: task.get("last_edited_time")?.as_str()?.into(),
                    })
                })
                .collect()
        } else {
            vec![]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-NOTION-MODELS-001
    #[test]
    fn page_from_json() {
        let json = serde_json::json!({
            "results": [
                {
                    "id": "123",
                    "url": "https://notion.so/123",
                    "created_time": "2026-04-23T10:00:00Z",
                    "last_edited_time": "2026-04-23T10:00:00Z",
                    "properties": {
                        "title": {
                            "title": [
                                { "plain_text": "My Page" }
                            ]
                        }
                    }
                }
            ]
        });
        let pages = NotionPage::from_notion_json(&json);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].title, "My Page");
    }

    // Traces to: FR-NOTION-MODELS-001
    #[test]
    fn task_from_json() {
        let json = serde_json::json!({
            "results": [
                {
                    "id": "456",
                    "last_edited_time": "2026-04-23T10:00:00Z",
                    "properties": {
                        "title": {
                            "title": [
                                { "plain_text": "Complete task" }
                            ]
                        },
                        "Completed": {
                            "checkbox": true
                        }
                    }
                }
            ]
        });
        let tasks = NotionTask::from_notion_json(&json);
        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].completed);
    }
}
