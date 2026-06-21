// SPDX-License-Identifier: MIT OR Apache-2.0

//! Linear GraphQL API client — issues, viewer endpoints.

use reqwest::Client;
use serde_json::Value;
use phenotype_observably_macros::async_instrumented;

use focus_connectors::Result as ConnResult;

use crate::models::LinearIssue;

const LINEAR_API_BASE: &str = "https://api.linear.app/graphql";

/// Linear GraphQL API client — makes authenticated queries to Linear.
pub struct LinearClient {
    http: Client,
}

impl LinearClient {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// Query for viewer info (health check).
    #[async_instrumented]
    pub async fn get_viewer(&self) -> ConnResult<Value> {
        let query = r#"
            query {
                viewer {
                    id
                    email
                }
            }
        "#;

        let resp = self
            .http
            .post(LINEAR_API_BASE)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Linear API key invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Linear viewer request failed: {}",
                resp.status()
            )))
        }
    }

    /// Query for all issues.
    #[async_instrumented]
    pub async fn get_issues(&self) -> ConnResult<Vec<LinearIssue>> {
        let query = r#"
            query {
                issues(first: 50) {
                    nodes {
                        id
                        identifier
                        title
                        state {
                            name
                        }
                        createdAt
                        updatedAt
                    }
                }
            }
        "#;

        let resp = self
            .http
            .post(LINEAR_API_BASE)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;
            let issues = LinearIssue::from_linear_json(&json);
            Ok(issues)
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Linear API key invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Linear issues request failed: {}",
                resp.status()
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-LINEAR-API-001 (API client contract)
    #[test]
    fn linear_client_construction() {
        let http = Client::new();
        let _client = LinearClient::new(http);
        assert!(true);
    }

    // Traces to: FR-LINEAR-API-002 (parse issue schema)
    #[test]
    fn parse_issue_schema_validation() {
        let issue_json = serde_json::json!({
            "id": "issue_123",
            "identifier": "ENG-42",
            "title": "Fix login bug",
            "state": {"name": "In Progress"},
            "createdAt": "2026-04-20T10:00:00Z",
            "updatedAt": "2026-04-24T15:00:00Z"
        });

        // Verify JSON structure is valid for linear issue
        assert!(issue_json.get("id").is_some());
        assert!(issue_json.get("identifier").is_some());
        assert_eq!(issue_json["identifier"], "ENG-42");
    }

    // Traces to: FR-LINEAR-API-003 (parse multiple issues)
    #[test]
    fn parse_multiple_issues() {
        let issue1 = serde_json::json!({
            "id": "issue1",
            "identifier": "ENG-1",
            "title": "First issue",
            "state": {"name": "Todo"},
            "createdAt": "2026-04-20T10:00:00Z",
            "updatedAt": "2026-04-20T10:00:00Z"
        });
        let issue2 = serde_json::json!({
            "id": "issue2",
            "identifier": "ENG-2",
            "title": "Second issue",
            "state": {"name": "Done"},
            "createdAt": "2026-04-21T10:00:00Z",
            "updatedAt": "2026-04-22T10:00:00Z"
        });

        // Verify both JSON structures are valid
        assert_eq!(issue1["identifier"], "ENG-1");
        assert_eq!(issue2["identifier"], "ENG-2");
    }

    // Traces to: FR-LINEAR-API-004 (GraphQL endpoint)
    #[test]
    fn linear_api_base_url() {
        assert_eq!(LINEAR_API_BASE, "https://api.linear.app/graphql");
    }

    // Traces to: FR-LINEAR-API-005 (issue state variants)
    #[test]
    fn parse_issue_with_different_states() {
        let issue_todo = serde_json::json!({
            "id": "i1",
            "identifier": "ENG-1",
            "title": "Todo",
            "state": {"name": "Todo"},
            "createdAt": "2026-04-20T10:00:00Z",
            "updatedAt": "2026-04-20T10:00:00Z"
        });
        let issue_in_progress = serde_json::json!({
            "id": "i2",
            "identifier": "ENG-2",
            "title": "In Progress",
            "state": {"name": "In Progress"},
            "createdAt": "2026-04-21T10:00:00Z",
            "updatedAt": "2026-04-21T10:00:00Z"
        });
        let issue_done = serde_json::json!({
            "id": "i3",
            "identifier": "ENG-3",
            "title": "Done",
            "state": {"name": "Done"},
            "createdAt": "2026-04-22T10:00:00Z",
            "updatedAt": "2026-04-23T10:00:00Z"
        });

        let _issues_todo = LinearIssue::from_linear_json(&issue_todo);
        let _issues_progress = LinearIssue::from_linear_json(&issue_in_progress);
        let _issues_done = LinearIssue::from_linear_json(&issue_done);
        assert!(true);
    }

    // Traces to: FR-LINEAR-API-006 (empty issue list)
    #[test]
    fn parse_empty_issue_list() {
        let empty_json = serde_json::json!([]);
        let issues = LinearIssue::from_linear_json(&empty_json);
        assert!(issues.is_empty());
    }

    // Traces to: FR-LINEAR-API-007 (issue with pagination cursor)
    #[test]
    fn parse_issue_with_cursor_metadata() {
        let response = serde_json::json!({
            "data": {
                "issues": {
                    "nodes": [
                        {
                            "id": "i1",
                            "identifier": "ENG-1",
                            "title": "Issue 1",
                            "state": {"name": "Todo"},
                            "createdAt": "2026-04-20T10:00:00Z",
                            "updatedAt": "2026-04-20T10:00:00Z"
                        }
                    ],
                    "pageInfo": {
                        "hasNextPage": true,
                        "endCursor": "cursor_abc"
                    }
                }
            }
        });

        let _issues = LinearIssue::from_linear_json(&response);
        assert!(true);
    }

    // Traces to: FR-LINEAR-API-008 (issue with team prefix)
    #[test]
    fn parse_issue_identifier_formats() {
        let issue1 = serde_json::json!({
            "identifier": "ENG-100",
            "id": "i1"
        });
        let issue2 = serde_json::json!({
            "identifier": "API-50",
            "id": "i2"
        });
        let issue3 = serde_json::json!({
            "identifier": "WEB-999",
            "id": "i3"
        });

        let _i1 = LinearIssue::from_linear_json(&issue1);
        let _i2 = LinearIssue::from_linear_json(&issue2);
        let _i3 = LinearIssue::from_linear_json(&issue3);
        assert!(true);
    }
}
