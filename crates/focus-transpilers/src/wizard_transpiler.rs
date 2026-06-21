// SPDX-License-Identifier: MIT OR Apache-2.0

//! Wizard form state ↔ IR transpiler.
//!
//! Handles bidirectional conversion between flat wizard form state (matching RuleBuilderView)
//! and IR documents. Preserves rule semantics through deterministic field mapping.

use crate::{Document, RuleTranspiler};
use anyhow::{anyhow, Result};
use focus_ir::{ActionIr, ConditionIr, RuleIr, TriggerIr};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Wizard form state: flat struct matching RuleBuilderView field list.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WizardState {
    pub rule_id: String,
    pub rule_name: String,
    #[serde(default)]
    pub rule_description: Option<String>,

    pub trigger_kind: String,
    #[serde(default)]
    pub trigger_value: serde_json::Value,

    #[serde(default)]
    pub conditions_json: String, // JSON array of condition objects

    #[serde(default)]
    pub actions_json: String, // JSON array of action objects

    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub cooldown_seconds: Option<i64>,
    #[serde(default)]
    pub duration_seconds: Option<i64>,
    #[serde(default)]
    pub explanation_template: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

/// Convert WizardState to IR Document.
///
/// Delegates to `RuleTranspiler::to_document` to avoid duplicate Document wrapping.
pub fn wizard_to_document(state: &WizardState) -> Result<Document> {
    WizardTranspiler::to_document(state)
}

/// Convert IR Document back to WizardState.
///
/// Delegates to `RuleTranspiler::from_document` to avoid duplicate Document unwrapping.
pub fn document_to_wizard(doc: &Document) -> Result<WizardState> {
    WizardTranspiler::from_document(doc)
}

/// Transpiler implementation for `WizardState`.
///
/// Domain-specific logic: JSON string parsing for conditions/actions and trigger mapping.
struct WizardTranspiler;

impl RuleTranspiler<WizardState> for WizardTranspiler {
    fn domain_to_ir(state: &WizardState) -> Result<RuleIr> {
        let trigger = parse_wizard_trigger(&state.trigger_kind, &state.trigger_value)?;

        let conditions: Vec<ConditionIr> = if state.conditions_json.is_empty() {
            Vec::new()
        } else {
            serde_json::from_str(&state.conditions_json)
                .map_err(|e| anyhow!("Invalid conditions JSON: {}", e))?
        };

        let actions: Vec<ActionIr> = if state.actions_json.is_empty() {
            Vec::new()
        } else {
            serde_json::from_str(&state.actions_json)
                .map_err(|e| anyhow!("Invalid actions JSON: {}", e))?
        };

        // Deterministic ID from rule_id
        let stable_id = Uuid::new_v5(&Uuid::NAMESPACE_DNS, state.rule_id.as_bytes());

        Ok(RuleIr {
            id: stable_id.to_string(),
            name: state.rule_name.clone(),
            trigger,
            conditions,
            actions,
            priority: state.priority,
            cooldown_seconds: state.cooldown_seconds,
            duration_seconds: state.duration_seconds,
            explanation_template: state.explanation_template.clone(),
            enabled: state.enabled,
        })
    }

    fn ir_to_domain(rule_ir: &RuleIr) -> Result<WizardState> {
        let (trigger_kind, trigger_value) = ir_trigger_to_wizard_fields(&rule_ir.trigger)?;

        let conditions_json = if rule_ir.conditions.is_empty() {
            String::new()
        } else {
            serde_json::to_string(&rule_ir.conditions)
                .map_err(|e| anyhow!("Failed to serialize conditions: {}", e))?
        };

        let actions_json = if rule_ir.actions.is_empty() {
            String::new()
        } else {
            serde_json::to_string(&rule_ir.actions)
                .map_err(|e| anyhow!("Failed to serialize actions: {}", e))?
        };

        Ok(WizardState {
            rule_id: rule_ir.id.clone(),
            rule_name: rule_ir.name.clone(),
            rule_description: None,
            trigger_kind,
            trigger_value,
            conditions_json,
            actions_json,
            priority: rule_ir.priority,
            cooldown_seconds: rule_ir.cooldown_seconds,
            duration_seconds: rule_ir.duration_seconds,
            explanation_template: rule_ir.explanation_template.clone(),
            enabled: rule_ir.enabled,
        })
    }

    fn domain_id(state: &WizardState) -> String {
        Uuid::new_v5(&Uuid::NAMESPACE_DNS, state.rule_id.as_bytes()).to_string()
    }

    fn domain_name(state: &WizardState) -> String {
        state.rule_name.clone()
    }
}

fn parse_wizard_trigger(kind: &str, value: &serde_json::Value) -> Result<TriggerIr> {
    match kind {
        "event" => {
            let event_name = value
                .as_str()
                .or_else(|| value.get("value").and_then(|v| v.as_str()))
                .unwrap_or("unknown")
                .to_string();
            Ok(TriggerIr::EventFired { event_name })
        }
        "schedule" => {
            let cron = value
                .as_str()
                .or_else(|| value.get("cron").and_then(|v| v.as_str()))
                .unwrap_or("0 * * * *")
                .to_string();
            Ok(TriggerIr::ScheduleCron { cron_expression: cron, timezone: "UTC".to_string() })
        }
        "user_starts_session" => {
            let session_type = value
                .as_str()
                .or_else(|| value.get("session_type").and_then(|v| v.as_str()))
                .unwrap_or("focus")
                .to_string();
            Ok(TriggerIr::UserStartsSession { session_type })
        }
        "state_change" => {
            let target = value
                .as_str()
                .or_else(|| value.get("target").and_then(|v| v.as_str()))
                .unwrap_or("unknown")
                .to_string();
            Ok(TriggerIr::UserAction { action_type: "state_change".to_string(), target })
        }
        _ => Err(anyhow!("Unknown trigger kind: {}", kind)),
    }
}

fn ir_trigger_to_wizard_fields(trigger: &TriggerIr) -> Result<(String, serde_json::Value)> {
    match trigger {
        TriggerIr::EventFired { event_name } => {
            Ok(("event".to_string(), serde_json::Value::String(event_name.clone())))
        }
        TriggerIr::ScheduleCron { cron_expression, .. } => {
            Ok(("schedule".to_string(), serde_json::Value::String(cron_expression.clone())))
        }
        TriggerIr::UserStartsSession { session_type } => {
            Ok(("user_starts_session".to_string(), serde_json::Value::String(session_type.clone())))
        }
        TriggerIr::UserAction { target, .. } => {
            Ok(("state_change".to_string(), serde_json::Value::String(target.clone())))
        }
        _ => Err(anyhow!("Unsupported trigger type for wizard conversion")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wizard_state_to_document() {
        let state = WizardState {
            rule_id: "wizard-rule-1".to_string(),
            rule_name: "Test Rule".to_string(),
            rule_description: Some("A test".to_string()),
            trigger_kind: "event".to_string(),
            trigger_value: serde_json::json!("focus:session_started"),
            conditions_json: "[]".to_string(),
            actions_json: "[]".to_string(),
            priority: 10,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "Test".to_string(),
            enabled: true,
        };

        let doc = wizard_to_document(&state);
        assert!(doc.is_ok());
        let doc = doc.unwrap();
        assert_eq!(doc.name, "Test Rule");
    }

    #[test]
    fn test_wizard_round_trip() {
        let original = WizardState {
            rule_id: "wz-1".to_string(),
            rule_name: "RT".to_string(),
            rule_description: None,
            trigger_kind: "event".to_string(),
            trigger_value: serde_json::json!("evt"),
            conditions_json: "[]".to_string(),
            actions_json: "[]".to_string(),
            priority: 1,
            cooldown_seconds: Some(60),
            duration_seconds: Some(3600),
            explanation_template: "x".to_string(),
            enabled: true,
        };

        let doc = wizard_to_document(&original).expect("Convert to doc");
        let restored = document_to_wizard(&doc).expect("Convert back to wizard");

        assert_eq!(original.rule_name, restored.rule_name);
        assert_eq!(original.priority, restored.priority);
        assert_eq!(original.cooldown_seconds, restored.cooldown_seconds);
    }

    #[test]
    fn test_wizard_with_complex_actions() {
        let actions_json = serde_json::json!([
            { "type": "enforce_policy", "policy_id": "block", "params": {} },
            { "type": "show_notification", "notification_id": "n1", "text": "hello" }
        ]);

        let state = WizardState {
            rule_id: "wz-actions".to_string(),
            rule_name: "Actions Test".to_string(),
            rule_description: None,
            trigger_kind: "event".to_string(),
            trigger_value: serde_json::json!("evt"),
            conditions_json: "[]".to_string(),
            actions_json: actions_json.to_string(),
            priority: 5,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "".to_string(),
            enabled: true,
        };

        let doc = wizard_to_document(&state);
        assert!(doc.is_ok());
    }
}
