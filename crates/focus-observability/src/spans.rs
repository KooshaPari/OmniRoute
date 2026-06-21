// SPDX-License-Identifier: MIT OR Apache-2.0

//! # Span Conventions and Attributes
//!
//! Standardized span types with typed attributes for common FocalPoint operations.
//! Each span kind has a structured attribute type that enforces consistency.

use serde::{Deserialize, Serialize};

/// Span types for FocalPoint operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SpanKind {
    /// Connector synchronization span.
    ConnectorSync,
    /// Rule evaluation engine span.
    RuleEval,
    /// Audit log append span.
    AuditAppend,
    /// Wallet mutation (reward/penalty) span.
    WalletMutate,
}

impl SpanKind {
    /// Get the canonical span name.
    pub fn as_str(&self) -> &'static str {
        match self {
            SpanKind::ConnectorSync => "connector.sync",
            SpanKind::RuleEval => "rule.evaluate",
            SpanKind::AuditAppend => "audit.append",
            SpanKind::WalletMutate => "wallet.mutate",
        }
    }
}

/// Attributes for connector sync spans.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorSpanAttrs {
    pub connector_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ConnectorSpanAttrs {
    pub fn new(connector_id: String) -> Self {
        Self {
            connector_id,
            state: None,
            duration_ms: None,
            error: None,
        }
    }

    pub fn with_state(mut self, state: String) -> Self {
        self.state = Some(state);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }
}

/// Attributes for rule evaluation spans.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSpanAttrs {
    pub rule_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl RuleSpanAttrs {
    pub fn new(rule_id: String) -> Self {
        Self {
            rule_id,
            rule_type: None,
            matched: None,
            duration_ms: None,
            error: None,
        }
    }

    pub fn with_type(mut self, rule_type: String) -> Self {
        self.rule_type = Some(rule_type);
        self
    }

    pub fn with_matched(mut self, matched: bool) -> Self {
        self.matched = Some(matched);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }
}

/// Attributes for audit append spans.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSpanAttrs {
    pub audit_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl AuditSpanAttrs {
    pub fn new(audit_type: String) -> Self {
        Self {
            audit_type,
            entry_count: None,
            duration_ms: None,
            error: None,
        }
    }

    pub fn with_entry_count(mut self, count: usize) -> Self {
        self.entry_count = Some(count);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }
}

/// Attributes for wallet mutation spans.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletSpanAttrs {
    pub wallet_id: String,
    pub delta: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl WalletSpanAttrs {
    pub fn new(wallet_id: String, delta: i64) -> Self {
        Self {
            wallet_id,
            delta,
            reason: None,
            error: None,
        }
    }

    pub fn with_reason(mut self, reason: String) -> Self {
        self.reason = Some(reason);
        self
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_span_kind_names() {
        assert_eq!(SpanKind::ConnectorSync.as_str(), "connector.sync");
        assert_eq!(SpanKind::RuleEval.as_str(), "rule.evaluate");
        assert_eq!(SpanKind::AuditAppend.as_str(), "audit.append");
        assert_eq!(SpanKind::WalletMutate.as_str(), "wallet.mutate");
    }

    #[test]
    fn test_connector_span_attrs_builder() {
        let attrs = ConnectorSpanAttrs::new("github".to_string())
            .with_state("syncing".to_string())
            .with_duration(1234)
            .with_error("timeout".to_string());

        assert_eq!(attrs.connector_id, "github");
        assert_eq!(attrs.state, Some("syncing".to_string()));
        assert_eq!(attrs.duration_ms, Some(1234));
        assert_eq!(attrs.error, Some("timeout".to_string()));
    }

    #[test]
    fn test_rule_span_attrs_builder() {
        let attrs = RuleSpanAttrs::new("rule-123".to_string())
            .with_type("time_window".to_string())
            .with_matched(true)
            .with_duration(567);

        assert_eq!(attrs.rule_id, "rule-123");
        assert_eq!(attrs.rule_type, Some("time_window".to_string()));
        assert_eq!(attrs.matched, Some(true));
        assert_eq!(attrs.duration_ms, Some(567));
    }

    #[test]
    fn test_audit_span_attrs_builder() {
        let attrs = AuditSpanAttrs::new("reward_grant".to_string())
            .with_entry_count(5)
            .with_duration(890);

        assert_eq!(attrs.audit_type, "reward_grant");
        assert_eq!(attrs.entry_count, Some(5));
        assert_eq!(attrs.duration_ms, Some(890));
    }

    #[test]
    fn test_wallet_span_attrs_builder() {
        let attrs = WalletSpanAttrs::new("wallet-456".to_string(), 100)
            .with_reason("daily_streak".to_string());

        assert_eq!(attrs.wallet_id, "wallet-456");
        assert_eq!(attrs.delta, 100);
        assert_eq!(attrs.reason, Some("daily_streak".to_string()));
    }

    #[test]
    fn test_span_attrs_serialization() {
        let attrs = RuleSpanAttrs::new("rule-789".to_string())
            .with_type("budget".to_string())
            .with_matched(false);

        let json = serde_json::to_string(&attrs).expect("should serialize");
        assert!(json.contains("rule-789"));
        assert!(json.contains("budget"));
        assert!(json.contains("false"));
    }
}
