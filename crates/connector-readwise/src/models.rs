// SPDX-License-Identifier: MIT OR Apache-2.0

//! Readwise data models.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Article {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub source_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub published_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Article {
    pub fn from_readwise_json(json: &Value) -> Vec<Article> {
        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
            results
                .iter()
                .filter_map(|doc| {
                    Some(Article {
                        id: doc.get("id")?.as_str()?.into(),
                        title: doc.get("title")?.as_str()?.into(),
                        author: doc.get("author").and_then(|a| a.as_str()).map(|s| s.into()),
                        source_url: doc.get("source_url").and_then(|u| u.as_str()).map(|s| s.into()),
                        cover_image_url: doc.get("cover_image_url").and_then(|u| u.as_str()).map(|s| s.into()),
                        published_date: doc.get("published_date").and_then(|d| d.as_str()).map(|s| s.into()),
                        created_at: doc.get("created_at")?.as_str()?.into(),
                        updated_at: doc.get("updated_at")?.as_str()?.into(),
                    })
                })
                .collect()
        } else {
            vec![]
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Highlight {
    pub id: String,
    pub text: String,
    pub note: Option<String>,
    pub document_id: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Highlight {
    pub fn from_readwise_json(json: &Value) -> Vec<Highlight> {
        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
            results
                .iter()
                .filter_map(|h| {
                    Some(Highlight {
                        id: h.get("id")?.as_str()?.into(),
                        text: h.get("text")?.as_str()?.into(),
                        note: h.get("note").and_then(|n| n.as_str()).map(|s| s.into()),
                        document_id: h.get("document_id")?.as_str()?.into(),
                        color: h.get("color").and_then(|c| c.as_str()).map(|s| s.into()),
                        created_at: h.get("created_at")?.as_str()?.into(),
                        updated_at: h.get("updated_at")?.as_str()?.into(),
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

    // Traces to: FR-READWISE-MODELS-001
    #[test]
    fn article_from_json() {
        let json = serde_json::json!({
            "results": [
                {
                    "id": "123",
                    "title": "Test Article",
                    "author": "Author Name",
                    "source_url": "https://example.com",
                    "created_at": "2026-04-23T10:00:00Z",
                    "updated_at": "2026-04-23T10:00:00Z"
                }
            ]
        });
        let articles = Article::from_readwise_json(&json);
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");
    }

    // Traces to: FR-READWISE-MODELS-001
    #[test]
    fn highlight_from_json() {
        let json = serde_json::json!({
            "results": [
                {
                    "id": "456",
                    "text": "Important quote",
                    "document_id": "123",
                    "created_at": "2026-04-23T10:00:00Z",
                    "updated_at": "2026-04-23T10:00:00Z"
                }
            ]
        });
        let highlights = Highlight::from_readwise_json(&json);
        assert_eq!(highlights.len(), 1);
        assert_eq!(highlights[0].text, "Important quote");
    }
}
