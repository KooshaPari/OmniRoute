// SPDX-License-Identifier: MIT OR Apache-2.0

//! focus_rules::Rule ↔ IR transpiler.
//!
//! Handles bidirectional conversion between native focus_rules::Rule format and IR.
//! Reuses the converters already defined in focus-ir module tests.

use crate::{Document, RuleTranspiler};
use anyhow::{anyhow, Result};
use chrono::Duration;
use focus_ir::{ActionIr, ConditionIr, RuleIr, TriggerIr};
use focus_rules::{Action, Condition, Rule, Trigger};
use std::collections::BTreeMap;
use uuid::Uuid;

/// Convert focus_rules::Rule to IR Document.
///
/// Delegates to `RuleTranspiler::to_document` to avoid duplicate Document wrapping.
pub fn rule_to_document(rule: &Rule) -> Result<Document> {
    FocusRuleTranspiler::to_document(rule)
}

/// Convert IR Document back to focus_rules::Rule.
///
/// Delegates to `RuleTranspiler::from_document` to avoid duplicate Document unwrapping.
pub fn document_to_rule(doc: &Document) -> Result<Rule> {
    FocusRuleTranspiler::from_document(doc)
}

/// Transpiler implementation for `focus_rules::Rule`.
///
/// Domain-specific logic: trigger/action/condition conversions and UUID mapping.
struct FocusRuleTranspiler;

impl RuleTranspiler<Rule> for FocusRuleTranspiler {
    fn domain_to_ir(rule: &Rule) -> Result<RuleIr> {
        Ok(RuleIr {
            id: rule.id.to_string(),
            name: rule.name.clone(),
            trigger: trigger_to_ir(&rule.trigger),
            conditions: rule.conditions.iter().map(condition_to_ir).collect(),
            actions: rule.actions.iter().map(action_to_ir).collect(),
            priority: rule.priority,
            cooldown_seconds: rule.cooldown.map(|d| d.num_seconds()),
            duration_seconds: rule.duration.map(|d| d.num_seconds()),
            explanation_template: rule.explanation_template.clone(),
            enabled: rule.enabled,
        })
    }

    fn ir_to_domain(rule_ir: &RuleIr) -> Result<Rule> {
        Ok(Rule {
            id: Uuid::parse_str(&rule_ir.id).map_err(|_| anyhow!("Invalid rule ID UUID"))?,
            name: rule_ir.name.clone(),
            trigger: ir_to_trigger(&rule_ir.trigger)?,
            conditions: rule_ir.conditions.iter().map(ir_to_condition).collect::<Result<_, _>>()?,
            actions: rule_ir.actions.iter().map(ir_to_action).collect::<Result<_, _>>()?,
            priority: rule_ir.priority,
            cooldown: rule_ir.cooldown_seconds.map(Duration::seconds),
            duration: rule_ir.duration_seconds.map(Duration::seconds),
            explanation_template: rule_ir.explanation_template.clone(),
            enabled: rule_ir.enabled,
        })
    }

    fn domain_id(rule: &Rule) -> String {
        rule.id.to_string()
    }

    fn domain_name(rule: &Rule) -> String {
        rule.name.clone()
    }
}

fn trigger_to_ir(trigger: &Trigger) -> TriggerIr {
    match trigger {
        Trigger::Event(name) => TriggerIr::EventFired { event_name: name.clone() },
        Trigger::Schedule(cron) => {
            TriggerIr::ScheduleCron { cron_expression: cron.clone(), timezone: "UTC".into() }
        }
        Trigger::StateChange(state) => {
            TriggerIr::UserAction { action_type: "state_change".into(), target: state.clone() }
        }
    }
}

fn ir_to_trigger(trigger: &TriggerIr) -> Result<Trigger> {
    match trigger {
        TriggerIr::EventFired { event_name } => Ok(Trigger::Event(event_name.clone())),
        TriggerIr::ScheduleCron { cron_expression, .. } => {
            Ok(Trigger::Schedule(cron_expression.clone()))
        }
        TriggerIr::UserAction { action_type, target } if action_type == "state_change" => {
            Ok(Trigger::StateChange(target.clone()))
        }
        _ => Err(anyhow!("Unsupported trigger type")),
    }
}

fn condition_to_ir(condition: &Condition) -> ConditionIr {
    ConditionIr::CustomPredicate { name: condition.kind.clone(), args: condition.params.clone() }
}

fn ir_to_condition(ir: &ConditionIr) -> Result<Condition> {
    match ir {
        ConditionIr::CustomPredicate { name, args } => {
            Ok(Condition { kind: name.clone(), params: args.clone() })
        }
        _ => Err(anyhow!("Complex conditions not yet supported in round-trip")),
    }
}

fn action_to_ir(action: &Action) -> ActionIr {
    match action {
        Action::GrantCredit { amount } => ActionIr::EmitEvent {
            event_type: "grant_credit".into(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("amount".into(), serde_json::Value::Number((*amount).into()));
                m
            },
        },
        Action::DeductCredit { amount } => ActionIr::EmitEvent {
            event_type: "deduct_credit".into(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("amount".into(), serde_json::Value::Number((*amount).into()));
                m
            },
        },
        Action::Block { profile, duration, rigidity } => ActionIr::EnforcePolicy {
            policy_id: "block".into(),
            params: {
                let mut m = BTreeMap::new();
                m.insert("profile".into(), serde_json::json!(profile));
                m.insert("duration_secs".into(), serde_json::json!(duration.num_seconds()));
                m.insert("rigidity".into(), serde_json::json!(format!("{:?}", rigidity)));
                m
            },
        },
        Action::Unblock { profile } => ActionIr::EnforcePolicy {
            policy_id: "unblock".into(),
            params: {
                let mut m = BTreeMap::new();
                m.insert("profile".into(), serde_json::json!(profile));
                m
            },
        },
        Action::StreakIncrement(name) => ActionIr::EmitEvent {
            event_type: "streak_increment".into(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("streak_name".into(), serde_json::json!(name));
                m
            },
        },
        Action::StreakReset(name) => ActionIr::EmitEvent {
            event_type: "streak_reset".into(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("streak_name".into(), serde_json::json!(name));
                m
            },
        },
        Action::Notify(msg) => ActionIr::ShowNotification {
            notification_id: Uuid::new_v4().to_string(),
            text: msg.clone(),
            duration_ms: None,
        },
        Action::EmergencyExit { profiles, duration, bypass_cost, reason } => {
            ActionIr::EnforcePolicy {
                policy_id: "emergency_exit".into(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert(
                        "profiles".into(),
                        serde_json::json!(profiles.iter().collect::<Vec<_>>()),
                    );
                    m.insert("duration_secs".into(), serde_json::json!(duration.num_seconds()));
                    m.insert("bypass_cost".into(), serde_json::json!(bypass_cost));
                    m.insert("reason".into(), serde_json::json!(reason));
                    m
                },
            }
        }
        Action::Intervention { message, severity: _ } => ActionIr::ShowNotification {
            notification_id: Uuid::new_v4().to_string(),
            text: message.clone(),
            duration_ms: Some(5000),
        },
        Action::ScheduledUnlockWindow { profile, starts_at, ends_at, credit_cost } => {
            ActionIr::ScheduleTask {
                task_id: "unlock_window".into(),
                delay_ms: None,
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".into(), serde_json::json!(profile));
                    m.insert("starts_at".into(), serde_json::json!(starts_at.to_rfc3339()));
                    m.insert("ends_at".into(), serde_json::json!(ends_at.to_rfc3339()));
                    m.insert("credit_cost".into(), serde_json::json!(credit_cost));
                    m
                },
            }
        }
    }
}

fn ir_to_action(ir: &ActionIr) -> Result<Action> {
    match ir {
        ActionIr::EmitEvent { event_type, payload } => match event_type.as_str() {
            "grant_credit" => {
                let amount = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                Ok(Action::GrantCredit { amount })
            }
            "deduct_credit" => {
                let amount = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                Ok(Action::DeductCredit { amount })
            }
            "streak_increment" => {
                let name =
                    payload.get("streak_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Action::StreakIncrement(name))
            }
            "streak_reset" => {
                let name =
                    payload.get("streak_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Action::StreakReset(name))
            }
            _ => Err(anyhow!("Unknown event type: {}", event_type)),
        },
        ActionIr::EnforcePolicy { policy_id, params } => match policy_id.as_str() {
            "block" => {
                let profile =
                    params.get("profile").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let duration_secs =
                    params.get("duration_secs").and_then(|v| v.as_i64()).unwrap_or(0);
                Ok(Action::Block {
                    profile,
                    duration: Duration::seconds(duration_secs),
                    rigidity: focus_domain::Rigidity::Hard,
                })
            }
            "unblock" => {
                let profile =
                    params.get("profile").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Action::Unblock { profile })
            }
            _ => Err(anyhow!("Unsupported policy: {}", policy_id)),
        },
        ActionIr::ShowNotification { text, .. } => Ok(Action::Notify(text.clone())),
        _ => Err(anyhow!("Action type not yet supported in IR->Rule conversion")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rule_to_document_simple() {
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "Test Rule".to_string(),
            trigger: Trigger::Event("test_event".to_string()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 10 }],
            priority: 5,
            cooldown: None,
            duration: None,
            explanation_template: "Test".to_string(),
            enabled: true,
        };

        let doc = rule_to_document(&rule);
        assert!(doc.is_ok());
        let doc = doc.unwrap();
        assert_eq!(doc.name, "Test Rule");
    }

    #[test]
    fn test_rule_round_trip_event_trigger() {
        let original = Rule {
            id: Uuid::new_v4(),
            name: "RT Rule".to_string(),
            trigger: Trigger::Event("evt".to_string()),
            conditions: vec![],
            actions: vec![],
            priority: 1,
            cooldown: Some(Duration::seconds(60)),
            duration: Some(Duration::seconds(3600)),
            explanation_template: "x".to_string(),
            enabled: true,
        };

        let doc = rule_to_document(&original).expect("Convert to doc");
        let restored = document_to_rule(&doc).expect("Convert back");

        assert_eq!(original.id, restored.id);
        assert_eq!(original.name, restored.name);
        assert_eq!(original.priority, restored.priority);
        assert_eq!(original.cooldown, restored.cooldown);
    }

    #[test]
    fn test_action_grant_credit_round_trip() {
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "Credit".to_string(),
            trigger: Trigger::Event("evt".to_string()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 42 }],
            priority: 1,
            cooldown: None,
            duration: None,
            explanation_template: "".to_string(),
            enabled: true,
        };

        let doc = rule_to_document(&rule).expect("To doc");
        let restored = document_to_rule(&doc).expect("From doc");

        match &restored.actions[..] {
            [Action::GrantCredit { amount }] => assert_eq!(*amount, 42),
            _ => panic!("Expected GrantCredit action"),
        }
    }

    #[test]
    fn test_action_block_round_trip() {
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "Block".to_string(),
            trigger: Trigger::Event("evt".to_string()),
            conditions: vec![],
            actions: vec![Action::Block {
                profile: "social".to_string(),
                duration: Duration::seconds(1800),
                rigidity: focus_domain::Rigidity::Hard,
            }],
            priority: 1,
            cooldown: None,
            duration: None,
            explanation_template: "".to_string(),
            enabled: true,
        };

        let doc = rule_to_document(&rule).expect("To doc");
        let restored = document_to_rule(&doc).expect("From doc");

        match &restored.actions[..] {
            [Action::Block { profile, duration, rigidity: _ }] => {
                assert_eq!(profile, "social");
                assert_eq!(duration.num_seconds(), 1800);
            }
            _ => panic!("Expected Block action"),
        }
    }
}
