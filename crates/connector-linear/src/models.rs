// SPDX-License-Identifier: MIT OR Apache-2.0

//! Linear data models.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LinearIssue {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
}

impl LinearIssue {
    pub fn from_linear_json(json: &Value) -> Vec<LinearIssue> {
        if let Some(issues) = json
            .get("data")
            .and_then(|d| d.get("issues"))
            .and_then(|i| i.get("nodes"))
            .and_then(|n| n.as_array())
        {
            issues
                .iter()
                .filter_map(|issue| {
                    Some(LinearIssue {
                        id: issue.get("id")?.as_str()?.into(),
                        identifier: issue.get("identifier")?.as_str()?.into(),
                        title: issue.get("title")?.as_str()?.into(),
                        state: issue
                            .get("state")
                            .and_then(|s| s.get("name"))
                            .and_then(|n| n.as_str())
                            .unwrap_or("Unknown")
                            .into(),
                        created_at: issue.get("createdAt")?.as_str()?.into(),
                        updated_at: issue.get("updatedAt")?.as_str()?.into(),
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

    // Traces to: FR-LINEAR-MODELS-001
    #[test]
    fn issue_from_json() {
        let json = serde_json::json!({
            "data": {
                "issues": {
                    "nodes": [
                        {
                            "id": "iss-1",
                            "identifier": "ENG-123",
                            "title": "Fix login bug",
                            "state": {
                                "name": "In Progress"
                            },
                            "createdAt": "2026-04-23T09:00:00Z",
                            "updatedAt": "2026-04-23T10:00:00Z"
                        }
                    ]
                }
            }
        });
        let issues = LinearIssue::from_linear_json(&json);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].identifier, "ENG-123");
    }
}
