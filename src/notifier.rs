//! Notification dispatch — desktop alerts and webhook POSTs.
//!
//! Wire-up: when `HealthCheckScheduler` marks a process unhealthy, call
//! `Notifier::dispatch(&event)` to fan-out to every enabled channel.

use std::fmt;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

// ---------------------------------------------------------------------------
// NotificationKind
// ---------------------------------------------------------------------------

/// The class of event being reported.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationKind {
    ProcessCrashed,
    HealthCheckFailed,
    ProcessRestarted,
    ThresholdExceeded,
}

impl fmt::Display for NotificationKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ProcessCrashed => write!(f, "ProcessCrashed"),
            Self::HealthCheckFailed => write!(f, "HealthCheckFailed"),
            Self::ProcessRestarted => write!(f, "ProcessRestarted"),
            Self::ThresholdExceeded => write!(f, "ThresholdExceeded"),
        }
    }
}

// ---------------------------------------------------------------------------
// NotificationEvent
// ---------------------------------------------------------------------------

/// A single notification event produced by the health-check scheduler or
/// process manager.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEvent {
    pub kind: NotificationKind,
    pub process_name: String,
    pub message: String,
    /// Unix timestamp (seconds since epoch).
    pub timestamp: u64,
}

impl NotificationEvent {
    /// Build a new event with `timestamp` set to the current wall-clock time.
    pub fn new(
        kind: NotificationKind,
        process_name: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        let timestamp =
            SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        Self { kind, process_name: process_name.into(), message: message.into(), timestamp }
    }
}

// ---------------------------------------------------------------------------
// NotifierConfig
// ---------------------------------------------------------------------------

/// Configuration for the notification subsystem (read from `[notifications]`
/// in `~/.config/sharecli/config.toml`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct NotifierConfig {
    /// Send desktop notifications via `notify-rust`.
    pub desktop: bool,
    /// Zero or more webhook URLs that receive a JSON POST on each event.
    pub webhooks: Vec<String>,
}

impl Default for NotifierConfig {
    fn default() -> Self {
        Self { desktop: true, webhooks: vec![] }
    }
}

// ---------------------------------------------------------------------------
// Notifier
// ---------------------------------------------------------------------------

/// Fan-out dispatcher: desktop notification + webhook POST.
pub struct Notifier {
    config: NotifierConfig,
    /// Shared HTTP client (created lazily once per Notifier).
    #[cfg(feature = "notifications-http")]
    client: reqwest::Client,
}

impl Notifier {
    /// Construct a `Notifier` from the given config.
    pub fn new(config: NotifierConfig) -> Arc<Self> {
        Arc::new(Self {
            #[cfg(feature = "notifications-http")]
            client: reqwest::Client::new(),
            config,
        })
    }

    /// Fan-out to all enabled channels.  Errors are logged but never
    /// propagated — a notification failure must never affect process
    /// management logic.
    pub async fn dispatch(&self, event: &NotificationEvent) {
        if self.config.desktop {
            self.notify_send(event);
        }
        for url in &self.config.webhooks {
            self.notify_webhook(event, url).await;
        }
    }

    // -----------------------------------------------------------------------
    // Desktop notification
    // -----------------------------------------------------------------------

    /// Send a desktop notification.  Uses `notify-rust` on platforms that
    /// support it; silently skips on unsupported targets.
    pub fn notify_send(&self, event: &NotificationEvent) {
        let summary = format!("sharecli — {}", event.kind);
        let body = format!("[{}] {}", event.process_name, event.message);

        #[cfg(feature = "desktop-notifications")]
        {
            if let Err(e) = notify_rust::Notification::new().summary(&summary).body(&body).show() {
                warn!("notifier: desktop notification failed: {e}");
            } else {
                info!("notifier: desktop notification sent for '{}'", event.process_name);
            }
        }

        #[cfg(not(feature = "desktop-notifications"))]
        {
            info!("notifier: [desktop] {} — {}", summary, body);
        }
    }

    // -----------------------------------------------------------------------
    // Webhook POST
    // -----------------------------------------------------------------------

    /// POST `event` as JSON to `url`.  Logs on failure.
    pub async fn notify_webhook(&self, event: &NotificationEvent, url: &str) {
        let payload = match serde_json::to_value(event) {
            Ok(v) => v,
            Err(e) => {
                warn!("notifier: could not serialize event: {e}");
                return;
            }
        };

        #[cfg(feature = "notifications-http")]
        {
            match self.client.post(url).json(&payload).send().await {
                Ok(resp) if resp.status().is_success() => {
                    info!("notifier: webhook {} → {}", url, resp.status());
                }
                Ok(resp) => {
                    warn!("notifier: webhook {} returned non-2xx: {}", url, resp.status());
                }
                Err(e) => {
                    warn!("notifier: webhook {} POST failed: {e}", url);
                }
            }
        }

        #[cfg(not(feature = "notifications-http"))]
        {
            info!("notifier: [webhook] POST {} — payload={}", url, payload);
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // 1. Event serialization round-trip
    #[test]
    fn event_serialization_round_trip() {
        let event = NotificationEvent::new(
            NotificationKind::HealthCheckFailed,
            "my-service",
            "probe timed out",
        );
        let json = serde_json::to_string(&event).expect("serialize");
        let back: NotificationEvent = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.kind, NotificationKind::HealthCheckFailed);
        assert_eq!(back.process_name, "my-service");
        assert_eq!(back.message, "probe timed out");
        assert!(back.timestamp > 0);
    }

    // 2. Webhook payload shape: required fields present in JSON
    #[test]
    fn webhook_payload_has_required_fields() {
        let event =
            NotificationEvent::new(NotificationKind::ProcessCrashed, "worker-1", "exit code 137");
        let v = serde_json::to_value(&event).expect("to_value");
        assert!(v.get("kind").is_some(), "missing 'kind'");
        assert!(v.get("process_name").is_some(), "missing 'process_name'");
        assert!(v.get("message").is_some(), "missing 'message'");
        assert!(v.get("timestamp").is_some(), "missing 'timestamp'");
        assert_eq!(v["kind"], "process_crashed");
    }

    // 3. NotifierConfig defaults
    #[test]
    fn notifier_config_defaults() {
        let cfg = NotifierConfig::default();
        assert!(cfg.desktop, "desktop should default to true");
        assert!(cfg.webhooks.is_empty(), "webhooks should default to empty");
    }

    // 4. NotificationKind Display
    #[test]
    fn notification_kind_display() {
        assert_eq!(NotificationKind::ProcessCrashed.to_string(), "ProcessCrashed");
        assert_eq!(NotificationKind::HealthCheckFailed.to_string(), "HealthCheckFailed");
        assert_eq!(NotificationKind::ProcessRestarted.to_string(), "ProcessRestarted");
        assert_eq!(NotificationKind::ThresholdExceeded.to_string(), "ThresholdExceeded");
    }

    // 5. Notifier constructed with empty webhooks dispatches without panic
    #[tokio::test]
    async fn notifier_empty_webhooks_no_panic() {
        let cfg = NotifierConfig { desktop: false, webhooks: vec![] };
        let notifier = Notifier::new(cfg);
        let event = NotificationEvent::new(
            NotificationKind::ThresholdExceeded,
            "proc-x",
            "exceeded 5 failures",
        );
        // Should complete without panic or error
        notifier.dispatch(&event).await;
    }

    // 6. All NotificationKind variants serialize to snake_case JSON strings
    #[test]
    fn notification_kind_serializes_snake_case() {
        let cases = [
            (NotificationKind::ProcessCrashed, "process_crashed"),
            (NotificationKind::HealthCheckFailed, "health_check_failed"),
            (NotificationKind::ProcessRestarted, "process_restarted"),
            (NotificationKind::ThresholdExceeded, "threshold_exceeded"),
        ];
        for (kind, expected) in cases {
            let v = serde_json::to_value(&kind).expect("serialize");
            assert_eq!(v.as_str().unwrap(), expected, "kind={kind}");
        }
    }
}
