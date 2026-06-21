// SPDX-License-Identifier: MIT OR Apache-2.0

//! TOML ↔ IR transpiler for legacy template-pack migration.
//!
//! Handles bidirectional conversion between TOML template packs (via focus_templates)
//! and IR documents. Preserves rule semantics through canonical hashing.

use crate::Document;
use anyhow::{anyhow, Result};
use focus_ir::{ActionIr, Body, ConditionIr, DocKind, RuleIr, TriggerIr};
use focus_templates::{ActionDraft, ConditionDraft, RuleDraft, TemplatePack, TriggerDraft};
use std::collections::BTreeMap;
use uuid::Uuid;

/// Convert TOML string to IR documents via TemplatePack deserialization.
pub fn toml_to_documents(toml_str: &str) -> Result<Vec<Document>> {
    let pack: TemplatePack =
        toml::from_str(toml_str).map_err(|e| anyhow!("TOML parse error: {}", e))?;

    let mut docs = Vec::new();

    for draft in pack.rules {
        let doc = draft_to_ir_document(&pack.id, &draft)?;
        docs.push(doc);
    }

    Ok(docs)
}

/// Convert IR documents back to TOML string.
pub fn documents_to_toml(docs: &[Document]) -> Result<String> {
    // Reconstruct a TemplatePack from IR documents
    let mut rules = Vec::new();

    for doc in docs {
        let draft = ir_document_to_draft(doc)?;
        rules.push(draft);
    }

    let pack = if let Some(first) = docs.first() {
        TemplatePack {
            id: format!("migrated-{}", first.id),
            name: "Migrated Rules".to_string(),
            version: "0.1.0".to_string(),
            author: "transpiler".to_string(),
            description: String::new(),
            rules,
            recommended_connectors: Vec::new(),
            mascot_copy: BTreeMap::new(),
        }
    } else {
        TemplatePack {
            id: "empty".to_string(),
            name: "Empty".to_string(),
            version: "0.1.0".to_string(),
            author: "transpiler".to_string(),
            description: String::new(),
            rules,
            recommended_connectors: Vec::new(),
            mascot_copy: BTreeMap::new(),
        }
    };

    toml::to_string_pretty(&pack).map_err(|e| anyhow!("TOML serialize error: {}", e))
}

/// Convert a RuleDraft to an IR Document.
fn draft_to_ir_document(pack_id: &str, draft: &RuleDraft) -> Result<Document> {
    let trigger = draft_trigger_to_ir(&draft.trigger)?;
    let conditions =
        draft.conditions.iter().map(draft_condition_to_ir).collect::<Result<Vec<_>>>()?;
    let actions = draft.actions.iter().map(draft_action_to_ir).collect::<Result<Vec<_>>>()?;

    // Deterministic UUID from pack_id + rule_id
    let rule_id = format!("{}/{}", pack_id, draft.id);
    let stable_id = Uuid::new_v5(&Uuid::NAMESPACE_DNS, rule_id.as_bytes());

    let rule_ir = RuleIr {
        id: stable_id.to_string(),
        name: draft.name.clone(),
        trigger,
        conditions,
        actions,
        priority: draft.priority,
        cooldown_seconds: draft.cooldown_seconds,
        duration_seconds: draft.duration_seconds,
        explanation_template: draft.explanation_template.clone(),
        enabled: draft.enabled,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Rule,
        id: stable_id.to_string(),
        name: draft.name.clone(),
        body: Body::Rule(Box::new(rule_ir)),
    })
}

/// Convert an IR Document back to RuleDraft.
fn ir_document_to_draft(doc: &Document) -> Result<RuleDraft> {
    match &doc.body {
        Body::Rule(rule_ir) => {
            let trigger = ir_trigger_to_draft(&rule_ir.trigger)?;
            let conditions =
                rule_ir.conditions.iter().map(ir_condition_to_draft).collect::<Result<Vec<_>>>()?;
            let actions =
                rule_ir.actions.iter().map(ir_action_to_draft).collect::<Result<Vec<_>>>()?;

            Ok(RuleDraft {
                id: rule_ir.id.split('-').next().unwrap_or(&rule_ir.id).to_string(),
                name: rule_ir.name.clone(),
                trigger,
                conditions,
                actions,
                priority: rule_ir.priority,
                cooldown_seconds: rule_ir.cooldown_seconds,
                duration_seconds: rule_ir.duration_seconds,
                explanation_template: rule_ir.explanation_template.clone(),
                enabled: rule_ir.enabled,
            })
        }
        _ => Err(anyhow!("Expected Rule body, got other kind")),
    }
}

fn draft_trigger_to_ir(trigger: &TriggerDraft) -> Result<TriggerIr> {
    match trigger {
        TriggerDraft::Event(value) => Ok(TriggerIr::EventFired { event_name: value.clone() }),
        TriggerDraft::Schedule(cron_expression) => Ok(TriggerIr::ScheduleCron {
            cron_expression: cron_expression.clone(),
            timezone: "UTC".to_string(),
        }),
        TriggerDraft::StateChange(target) => Ok(TriggerIr::UserAction {
            action_type: "state_change".to_string(),
            target: target.clone(),
        }),
    }
}

fn ir_trigger_to_draft(trigger: &TriggerIr) -> Result<TriggerDraft> {
    match trigger {
        TriggerIr::EventFired { event_name } => Ok(TriggerDraft::Event(event_name.clone())),
        TriggerIr::ScheduleCron { cron_expression, .. } => {
            Ok(TriggerDraft::Schedule(cron_expression.clone()))
        }
        TriggerIr::UserAction { action_type, target } if action_type == "state_change" => {
            Ok(TriggerDraft::StateChange(target.clone()))
        }
        _ => Err(anyhow!("Unsupported trigger type for TOML conversion")),
    }
}

fn draft_condition_to_ir(cond: &ConditionDraft) -> Result<ConditionIr> {
    // ConditionDraft is generic; map to IR custom predicate
    Ok(ConditionIr::CustomPredicate { name: cond.kind.clone(), args: cond.params.clone() })
}

fn ir_condition_to_draft(cond: &ConditionIr) -> Result<ConditionDraft> {
    match cond {
        ConditionIr::CustomPredicate { name, args } => {
            Ok(ConditionDraft { kind: name.clone(), params: args.clone() })
        }
        ConditionIr::TimeInRange { start_hour, end_hour } => Ok(ConditionDraft {
            kind: "time_in_range".to_string(),
            params: serde_json::json!({
                "start_hour": start_hour,
                "end_hour": end_hour,
            }),
        }),
        ConditionIr::DayOfWeek { days } => Ok(ConditionDraft {
            kind: "day_of_week".to_string(),
            params: serde_json::json!({ "days": days }),
        }),
        _ => Err(anyhow!("Unsupported condition type for TOML conversion")),
    }
}

fn draft_action_to_ir(action: &ActionDraft) -> Result<ActionIr> {
    match action {
        ActionDraft::Block { profile, duration_seconds, .. } => Ok(ActionIr::EnforcePolicy {
            policy_id: "block".to_string(),
            params: {
                let mut m = BTreeMap::new();
                m.insert("profile".to_string(), serde_json::json!(profile));
                m.insert("duration_secs".to_string(), serde_json::json!(duration_seconds));
                m
            },
        }),
        ActionDraft::GrantCredit { amount } => Ok(ActionIr::EmitEvent {
            event_type: "grant_credit".to_string(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("amount".to_string(), serde_json::json!(amount));
                m
            },
        }),
        ActionDraft::Notify { message } => Ok(ActionIr::ShowNotification {
            notification_id: Uuid::new_v4().to_string(),
            text: message.clone(),
            duration_ms: Some(5000),
        }),
        ActionDraft::DeductCredit { amount } => Ok(ActionIr::EmitEvent {
            event_type: "deduct_credit".to_string(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("amount".to_string(), serde_json::json!(amount));
                m
            },
        }),
        ActionDraft::Unblock { profile } => Ok(ActionIr::EnforcePolicy {
            policy_id: "unblock".to_string(),
            params: {
                let mut m = BTreeMap::new();
                m.insert("profile".to_string(), serde_json::json!(profile));
                m
            },
        }),
        ActionDraft::StreakIncrement { name } => Ok(ActionIr::EmitEvent {
            event_type: "streak_increment".to_string(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("name".to_string(), serde_json::json!(name));
                m
            },
        }),
        ActionDraft::StreakReset { name } => Ok(ActionIr::EmitEvent {
            event_type: "streak_reset".to_string(),
            payload: {
                let mut m = BTreeMap::new();
                m.insert("name".to_string(), serde_json::json!(name));
                m
            },
        }),
    }
}

fn ir_action_to_draft(action: &ActionIr) -> Result<ActionDraft> {
    match action {
        ActionIr::EnforcePolicy { policy_id, params } => {
            if policy_id == "block" {
                let profile =
                    params.get("profile").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                let duration_seconds =
                    params.get("duration_secs").and_then(|v| v.as_i64()).unwrap_or(0);

                Ok(ActionDraft::Block {
                    profile,
                    duration_seconds,
                    rigidity: focus_templates::RigidityDraft::Hard,
                })
            } else if policy_id == "unblock" {
                let profile =
                    params.get("profile").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                Ok(ActionDraft::Unblock { profile })
            } else {
                Err(anyhow!("Unsupported enforcement policy: {}", policy_id))
            }
        }
        ActionIr::EmitEvent { event_type, payload } => match event_type.as_str() {
            "grant_credit" => {
                let amount = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                Ok(ActionDraft::GrantCredit { amount })
            }
            "deduct_credit" => {
                let amount = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                Ok(ActionDraft::DeductCredit { amount })
            }
            "streak_increment" => {
                let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(ActionDraft::StreakIncrement { name })
            }
            "streak_reset" => {
                let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(ActionDraft::StreakReset { name })
            }
            _ => Err(anyhow!("Unsupported event type: {}", event_type)),
        },
        ActionIr::ShowNotification { text, .. } => {
            Ok(ActionDraft::Notify { message: text.clone() })
        }
        _ => Err(anyhow!("Unsupported action type for TOML conversion")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_toml_parse_deep_work_starter() {
        let toml = r#"
id = "deep-work-starter"
name = "Deep Work Starter"
version = "0.1.0"
author = "focalpoint-team"

[[rules]]
id = "deep-work-social-block"
name = "Deep work — no social"
priority = 80
enabled = true
trigger = { kind = "event", value = "focus:session_started" }
actions = [
  { type = "block", profile = "social", duration_seconds = 3000, rigidity = "hard" },
]
"#;

        let docs = toml_to_documents(toml);
        assert!(docs.is_ok());
        let docs = docs.unwrap();
        assert_eq!(docs.len(), 1);
    }

    #[test]
    fn test_toml_round_trip() {
        let original = r#"
id = "test-pack"
name = "Test"
version = "0.1.0"
author = "test"

[[rules]]
id = "r1"
name = "Rule One"
priority = 10
enabled = true
trigger = { kind = "event", value = "test_event" }
actions = []
"#;

        let docs = toml_to_documents(original).expect("Parse TOML");
        let regenerated = documents_to_toml(&docs).expect("Regenerate TOML");
        let docs2 = toml_to_documents(&regenerated).expect("Re-parse TOML");

        // Both parses should have same number of rules
        assert_eq!(docs.len(), docs2.len());
    }

    #[test]
    fn test_ir_document_to_draft_block_action() {
        let rule_ir = RuleIr {
            id: "test".to_string(),
            name: "test".to_string(),
            trigger: TriggerIr::EventFired { event_name: "evt".to_string() },
            conditions: vec![],
            actions: vec![ActionIr::EnforcePolicy {
                policy_id: "block".to_string(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".to_string(), serde_json::json!("social"));
                    m.insert("duration_secs".to_string(), serde_json::json!(3600));
                    m
                },
            }],
            priority: 10,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "Test".to_string(),
            enabled: true,
        };

        let doc = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "test".to_string(),
            name: "test".to_string(),
            body: Body::Rule(Box::new(rule_ir)),
        };

        let draft = ir_document_to_draft(&doc);
        assert!(draft.is_ok());
        let draft = draft.unwrap();
        assert_eq!(draft.actions.len(), 1);
    }
}
