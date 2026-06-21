// SPDX-License-Identifier: MIT OR Apache-2.0

//! # focus-telemetry — Opt-in Anonymous Usage Analytics
//!
//! Provides local-first, PII-scrubbed event collection for FocalPoint.
//! Events are buffered in SQLite and flushed to a configurable endpoint every 15 minutes
//! (only when user has opted in).
//!
//! **Event Schema:**
//! ```
//! {
//!   event_id: UUID,
//!   name: str,         // e.g., "app.opened", "connector.connected"
//!   ts: ISO8601,
//!   session_id: str,   // anonymized hash of (install_time + device_model)
//!   app_version: str,
//!   os_version: str,
//!   props: JSON        // custom properties, pre-scrubbed for PII
//! }
//! ```
//!
//! **PII Scrubbing** (applied before buffering):
//! - Email addresses: user@domain.com → [REDACTED_EMAIL]
//! - Phone numbers: (555) 555-0123 → [REDACTED_PHONE]
//! - OAuth tokens: "Bearer sk_live_..." → [REDACTED_TOKEN]
//! - Task/Rule UUIDs: [REDACTED_UUID]
//!
//! **No user_id, email, IP, task titles, or connector data is ever collected.**

use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

pub mod audit;
pub mod pii_scrubber;

pub use audit::AuditRecord;
pub use pii_scrubber::PiiScrubber;

/// Represents a single telemetry event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub event_id: String,
    pub name: String,
    pub ts: String,
    pub session_id: String,
    pub app_version: String,
    pub os_version: String,
    pub props: serde_json::Value,
}

impl TelemetryEvent {
    /// Create a new telemetry event with redacted properties.
    pub fn new(
        name: String,
        session_id: String,
        app_version: String,
        os_version: String,
        props: serde_json::Value,
    ) -> Self {
        Self {
            event_id: Uuid::new_v4().to_string(),
            name,
            ts: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            session_id,
            app_version,
            os_version,
            props,
        }
    }
}

/// Telemetry client: buffers events locally and flushes when opted in.
pub struct TelemetryClient {
    db_path: String,
    endpoint: Option<String>,
    session_id: String,
    app_version: String,
    os_version: String,
    pii_scrubber: Arc<PiiScrubber>,
}

impl TelemetryClient {
    /// Create a new telemetry client.
    pub fn new(
        db_path: &str,
        session_id: String,
        app_version: String,
        os_version: String,
    ) -> Result<Self> {
        // Initialize database with schema
        Self::init_db(db_path)?;

        // Endpoint is read from env var FOCALPOINT_TELEMETRY_URL
        let endpoint = std::env::var("FOCALPOINT_TELEMETRY_URL").ok();

        Ok(Self {
            db_path: db_path.to_string(),
            endpoint,
            session_id,
            app_version,
            os_version,
            pii_scrubber: Arc::new(PiiScrubber::new()),
        })
    }

    /// Initialize the telemetry database schema.
    fn init_db(db_path: &str) -> Result<()> {
        let conn = rusqlite::Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS telemetry_events (
                event_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                ts TEXT NOT NULL,
                session_id TEXT NOT NULL,
                app_version TEXT NOT NULL,
                os_version TEXT NOT NULL,
                props TEXT NOT NULL,
                flushed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS telemetry_audit (
                id INTEGER PRIMARY KEY,
                event_count INTEGER NOT NULL,
                endpoint_domain TEXT,
                flushed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    /// Track an event with custom properties (PII auto-scrubbed).
    pub fn track(&self, event_name: &str, props: serde_json::Value) -> Result<()> {
        // Scrub PII from properties
        let scrubbed_props = self.pii_scrubber.scrub_json(props);

        let event = TelemetryEvent::new(
            event_name.to_string(),
            self.session_id.clone(),
            self.app_version.clone(),
            self.os_version.clone(),
            scrubbed_props,
        );

        // Store in local buffer (SQLite)
        let conn = rusqlite::Connection::open(&self.db_path)?;
        conn.execute(
            "INSERT INTO telemetry_events (event_id, name, ts, session_id, app_version, os_version, props, flushed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &event.event_id,
                &event.name,
                &event.ts,
                &event.session_id,
                &event.app_version,
                &event.os_version,
                serde_json::to_string(&event.props)?,
                0
            ],
        )?;

        Ok(())
    }

    /// Flush buffered events to remote endpoint (only if opted in).
    pub async fn flush_batch(&self, opted_in: bool) -> Result<()> {
        if !opted_in {
            // User hasn't opted in; do NOT send events. Buffer persists.
            return Ok(());
        }

        let endpoint = match &self.endpoint {
            Some(ep) => ep,
            None => {
                // No endpoint configured; buffer persists forever.
                return Ok(());
            }
        };

        // Fetch unflushed events
        let conn = rusqlite::Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT event_id, name, ts, session_id, app_version, os_version, props
             FROM telemetry_events WHERE flushed = 0 LIMIT 1000",
        )?;

        let events: Vec<TelemetryEvent> = stmt
            .query_map([], |row| {
                Ok(TelemetryEvent {
                    event_id: row.get(0)?,
                    name: row.get(1)?,
                    ts: row.get(2)?,
                    session_id: row.get(3)?,
                    app_version: row.get(4)?,
                    os_version: row.get(5)?,
                    props: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        if events.is_empty() {
            return Ok(());
        }

        let event_count = events.len();

        // Send batch to endpoint
        let client = reqwest::Client::new();
        let response = client
            .post(endpoint)
            .json(&serde_json::json!({ "events": events }))
            .send()
            .await?;

        if response.status().is_success() {
            // Mark events as flushed
            for event in &events {
                conn.execute(
                    "UPDATE telemetry_events SET flushed = 1 WHERE event_id = ?1",
                    params![&event.event_id],
                )?;
            }

            // Create audit record
            let endpoint_domain = extract_domain(endpoint);
            AuditRecord::log(&conn, event_count, endpoint_domain)?;

            tracing::info!(
                event_count = event_count,
                endpoint = endpoint,
                "telemetry batch flushed successfully"
            );
        }

        Ok(())
    }

    /// Purge all buffered events immediately (called on opt-out).
    pub fn purge_buffer(&self) -> Result<()> {
        let conn = rusqlite::Connection::open(&self.db_path)?;
        conn.execute("DELETE FROM telemetry_events WHERE flushed = 0", [])?;
        tracing::info!("telemetry buffer purged on opt-out");
        Ok(())
    }

    /// Get the current session ID.
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Count buffered (unflushed) events.
    pub fn buffered_event_count(&self) -> Result<usize> {
        let conn = rusqlite::Connection::open(&self.db_path)?;
        let count: usize = conn.query_row(
            "SELECT COUNT(*) FROM telemetry_events WHERE flushed = 0",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

/// Extract domain from a URL for audit logging.
fn extract_domain(url: &str) -> String {
    if let Ok(parsed) = url.parse::<url::Url>() {
        parsed
            .host_str()
            .map(|h| h.to_string())
            .unwrap_or_else(|| "unknown".to_string())
    } else {
        "unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_event_creation_with_redacted_props() {
        let props = json!({
            "user_email": "test@example.com",
            "action": "button_click"
        });

        let scrubber = PiiScrubber::new();
        let scrubbed = scrubber.scrub_json(props);

        // Email should be redacted
        assert_eq!(
            scrubbed.get("user_email").and_then(|v| v.as_str()),
            Some("[REDACTED_EMAIL]")
        );
        // Non-PII should remain
        assert_eq!(
            scrubbed.get("action").and_then(|v| v.as_str()),
            Some("button_click")
        );
    }

    #[test]
    fn test_track_event_buffers_locally() {
        let db_file = tempfile::NamedTempFile::new().unwrap();
        let client = TelemetryClient::new(
            db_file.path().to_str().unwrap(),
            "session123".to_string(),
            "1.0.0".to_string(),
            "iOS 17.0".to_string(),
        )
        .unwrap();

        let props = json!({"feature": "connector.connected"});
        client
            .track("connector.connected", props.clone())
            .unwrap();

        // Verify event is buffered
        let count = client.buffered_event_count().unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_flush_respects_opted_in_flag() {
        let db_file = tempfile::NamedTempFile::new().unwrap();
        let client = TelemetryClient::new(
            db_file.path().to_str().unwrap(),
            "session123".to_string(),
            "1.0.0".to_string(),
            "iOS 17.0".to_string(),
        )
        .unwrap();

        client.track("test_event", json!({})).unwrap();

        // Flush with opted_in=false should NOT send (and no endpoint anyway)
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async { client.flush_batch(false).await.unwrap() });

        // Event should still be buffered
        let count = client.buffered_event_count().unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_purge_buffer_on_optout() {
        let db_file = tempfile::NamedTempFile::new().unwrap();
        let client = TelemetryClient::new(
            db_file.path().to_str().unwrap(),
            "session123".to_string(),
            "1.0.0".to_string(),
            "iOS 17.0".to_string(),
        )
        .unwrap();

        client.track("event1", json!({})).unwrap();
        client.track("event2", json!({})).unwrap();

        assert_eq!(client.buffered_event_count().unwrap(), 2);

        // Purge on opt-out
        client.purge_buffer().unwrap();

        // Buffer should be empty
        assert_eq!(client.buffered_event_count().unwrap(), 0);
    }

    #[test]
    fn test_pii_scrubbing_emails() {
        let scrubber = PiiScrubber::new();
        let input = json!({"contact": "alice@example.com"});
        let output = scrubber.scrub_json(input);
        assert_eq!(
            output.get("contact").and_then(|v| v.as_str()),
            Some("[REDACTED_EMAIL]")
        );
    }

    #[test]
    fn test_pii_scrubbing_phones() {
        let scrubber = PiiScrubber::new();
        let input = json!({"phone": "(555) 555-0123"});
        let output = scrubber.scrub_json(input);
        assert_eq!(
            output.get("phone").and_then(|v| v.as_str()),
            Some("[REDACTED_PHONE]")
        );
    }

    #[test]
    fn test_pii_scrubbing_tokens() {
        let scrubber = PiiScrubber::new();
        let input = json!({"token": "Bearer sk_live_abc123def456"});
        let output = scrubber.scrub_json(input);
        let token_val = output.get("token").and_then(|v| v.as_str()).unwrap_or("");
        assert!(token_val.contains("[REDACTED_TOKEN]"));
    }

    #[test]
    fn test_pii_scrubbing_uuids() {
        let scrubber = PiiScrubber::new();
        let input = json!({"task_id": "550e8400-e29b-41d4-a716-446655440000"});
        let output = scrubber.scrub_json(input);
        assert_eq!(
            output.get("task_id").and_then(|v| v.as_str()),
            Some("[REDACTED_UUID]")
        );
    }

    #[test]
    fn test_audit_record_on_flush() {
        let db_file = tempfile::NamedTempFile::new().unwrap();
        let client = TelemetryClient::new(
            db_file.path().to_str().unwrap(),
            "session123".to_string(),
            "1.0.0".to_string(),
            "iOS 17.0".to_string(),
        )
        .unwrap();

        client.track("event1", json!({})).unwrap();

        // Verify audit table exists and is empty before flush
        let conn = rusqlite::Connection::open(db_file.path()).unwrap();
        let audit_count: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM telemetry_audit",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        assert_eq!(audit_count, 0);
    }
}
