//! Append-only audit log. One event per line, structured for log shippers.
//! In-memory; for production durability, write to a `tracing` layer or a
//! real backend. The shape is stable.

use std::sync::Mutex;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Categorical kind for an audit event. Stable enum; do not reorder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditKind {
    Auth,
    Config,
    Provider,
    Routing,
    Storage,
    Telemetry,
    Admin,
}

impl AuditKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth => "auth",
            Self::Config => "config",
            Self::Provider => "provider",
            Self::Routing => "routing",
            Self::Storage => "storage",
            Self::Telemetry => "telemetry",
            Self::Admin => "admin",
        }
    }
}

/// Outcome of an audited action. Stable enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditOutcome {
    Success,
    Failure,
    Denied,
}

impl AuditOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Failure => "failure",
            Self::Denied => "denied",
        }
    }
}

/// Single audit event. Serializable to JSON; stable shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub ts: DateTime<Utc>,
    pub kind: AuditKind,
    pub actor: String,
    pub action: String,
    pub target: String,
    pub outcome: AuditOutcome,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl AuditEvent {
    pub fn new(
        kind: AuditKind,
        actor: impl Into<String>,
        action: impl Into<String>,
        target: impl Into<String>,
        outcome: AuditOutcome,
    ) -> Self {
        Self {
            ts: Utc::now(),
            kind,
            actor: actor.into(),
            action: action.into(),
            target: target.into(),
            outcome,
            request_id: None,
            trace_id: None,
            reason: None,
        }
    }

    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = Some(id.into());
        self
    }

    pub fn with_trace_id(mut self, id: impl Into<String>) -> Self {
        self.trace_id = Some(id.into());
        self
    }

    pub fn with_reason(mut self, r: impl Into<String>) -> Self {
        self.reason = Some(r.into());
        self
    }
}

/// Append-only audit log. Holds events in memory. For a real backend,
/// implement a sink that forwards to disk / SIEM / etc.
#[derive(Debug, Default)]
pub struct AuditLog {
    events: Mutex<Vec<AuditEvent>>,
}

impl AuditLog {
    pub fn new() -> Self { Self::default() }
    pub fn append(&self, e: AuditEvent) {
        let mut g = self.events.lock().expect("audit mutex poisoned");
        g.push(e);
    }
    pub fn len(&self) -> usize {
        self.events.lock().expect("audit mutex poisoned").len()
    }
    pub fn is_empty(&self) -> bool { self.len() == 0 }
    pub fn snapshot(&self) -> Vec<AuditEvent> {
        self.events.lock().expect("audit mutex poisoned").clone()
    }
    pub fn clear(&self) {
        self.events.lock().expect("audit mutex poisoned").clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn append_and_snapshot() {
        let log = AuditLog::new();
        assert!(log.is_empty());
        log.append(AuditEvent::new(AuditKind::Auth, "u1", "login", "self", AuditOutcome::Success));
        log.append(AuditEvent::new(AuditKind::Auth, "u2", "login", "self", AuditOutcome::Denied)
            .with_reason("bad password"));
        assert_eq!(log.len(), 2);
        let snap = log.snapshot();
        assert_eq!(snap[0].actor, "u1");
        assert_eq!(snap[0].outcome, AuditOutcome::Success);
        assert_eq!(snap[1].reason.as_deref(), Some("bad password"));
    }

    #[test]
    fn kind_as_str_stable() {
        assert_eq!(AuditKind::Auth.as_str(), "auth");
        assert_eq!(AuditKind::Admin.as_str(), "admin");
    }

    #[test]
    fn event_json_shape() {
        let e = AuditEvent::new(AuditKind::Provider, "u1", "add", "openai", AuditOutcome::Success)
            .with_request_id("r-1");
        let j = serde_json::to_string(&e).unwrap();
        assert!(j.contains("\"kind\":\"provider\""));
        assert!(j.contains("\"action\":\"add\""));
        assert!(j.contains("\"request_id\":\"r-1\""));
    }
}
