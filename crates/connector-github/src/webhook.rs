// SPDX-License-Identifier: MIT OR Apache-2.0

//! GitHub webhook handler — maps incoming GitHub events to NormalizedEvents.

use async_trait::async_trait;
use focus_connectors::{ConnectorError, Result, WebhookDelivery, WebhookHandler};
use focus_events::NormalizedEvent;
use serde_json::Value;
use uuid::Uuid;

use crate::events::{GitHubEventMapper, CONNECTOR_ID};
use crate::models::GitHubEvent;

/// GitHub webhook handler implementing WebhookHandler trait.
pub struct GitHubWebhookHandler {
    /// Account ID to stamp into emitted NormalizedEvents.
    pub account_id: Uuid,
}

#[async_trait]
impl WebhookHandler for GitHubWebhookHandler {
    async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
        // Parse the raw JSON body
        let payload: Value = serde_json::from_slice(&delivery.body)
            .map_err(|e| ConnectorError::Schema(format!("invalid json: {}", e)))?;

        // Construct a GitHub event from the payload
        let gh_event = GitHubEvent {
            id: payload
                .get("id")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| ConnectorError::Schema("missing 'id' field".to_string()))?
                .to_string(),
            event_type: payload
                .get("type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| ConnectorError::Schema("missing 'type' field".to_string()))?
                .to_string(),
            actor: crate::models::GitHubActor {
                id: payload.get("actor").and_then(|a| a.get("id")).and_then(|v| v.as_u64()).unwrap_or(0),
                login: payload
                    .get("actor")
                    .and_then(|a| a.get("login"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
            },
            repo: crate::models::GitHubRepo {
                id: payload.get("repo").and_then(|r| r.get("id")).and_then(|v| v.as_u64()).unwrap_or(0),
                name: payload
                    .get("repo")
                    .and_then(|r| r.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
            },
            created_at: chrono::Utc::now(),
            public: payload.get("public").and_then(|v| v.as_bool()).unwrap_or(false),
            payload: payload.clone(),
        };

        // Map to NormalizedEvent(s) using the existing mapper
        let normalized = GitHubEventMapper::map(&gh_event, self.account_id);

        Ok(normalized.into_iter().collect())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn mk_delivery(id: u64, event_type: &str, payload: Value) -> WebhookDelivery {
        let mut full_payload = payload;
        if !full_payload.is_object() {
            full_payload = json!({});
        }
        if let Some(obj) = full_payload.as_object_mut() {
            obj.insert("id".to_string(), json!(id));
            obj.insert("type".to_string(), json!(event_type));
        }

        let body = serde_json::to_vec(&full_payload).unwrap();
        let headers = std::collections::HashMap::new();

        WebhookDelivery {
            connector_id: CONNECTOR_ID.to_string(),
            kind: event_type.to_string(),
            headers,
            body,
            received_at: chrono::Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_github_webhook_push_event() {
        let account_id = Uuid::new_v4();
        let handler = GitHubWebhookHandler { account_id };

        let payload = json!({
            "ref": "refs/heads/main",
            "repository": {
                "name": "test-repo"
            }
        });

        let delivery = mk_delivery(12345, "PushEvent", payload);
        let result = handler.handle(&delivery).await;

        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].account_id, account_id);
        assert_eq!(events[0].connector_id, "github");
    }

    #[tokio::test]
    async fn test_github_webhook_pull_request_merged() {
        let account_id = Uuid::new_v4();
        let handler = GitHubWebhookHandler { account_id };

        let payload = json!({
            "action": "closed",
            "pull_request": {
                "merged": true,
                "title": "Fix: widget issues"
            }
        });

        let delivery = mk_delivery(67890, "PullRequestEvent", payload);
        let result = handler.handle(&delivery).await;

        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert!(events[0]
            .event_type
            .to_string()
            .contains("github.pr.merged"));
    }

    #[tokio::test]
    async fn test_github_webhook_invalid_json() {
        let account_id = Uuid::new_v4();
        let handler = GitHubWebhookHandler { account_id };

        let delivery = WebhookDelivery {
            connector_id: CONNECTOR_ID.to_string(),
            kind: "PushEvent".to_string(),
            headers: std::collections::HashMap::new(),
            body: b"not json".to_vec(),
            received_at: chrono::Utc::now(),
        };

        let result = handler.handle(&delivery).await;
        assert!(result.is_err());
    }
}
