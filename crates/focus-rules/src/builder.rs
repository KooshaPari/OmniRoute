// SPDX-License-Identifier: MIT OR Apache-2.0

//! Rule authoring primitives: a type-safe `RuleBuilder` plus a static
//! `describe_dsl()` catalog emitted as JSON-friendly schema for UI
//! consumers (the in-app Rule Authoring Wizard on iOS, and any future
//! browser-hosted connector/rule builder).
//!
//! The catalog mirrors every Condition primitive recognised by
//! condition evaluation and every [`super::Action`] variant,
//! so clients can render dynamic forms without hardcoding enum lists.
//!
//! Traces to: FR-RULE-003, FR-RULE-008, FR-RULE-AUTHORING-001.

use chrono::Duration;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{Action, Condition, Rule, Trigger};

/// JSON-friendly descriptor of a single parameter for a Condition or Action.
///
/// `kind` is a loose, machine-readable type tag ("string", "number", "bool",
/// "`array<condition>`", etc). UIs use it to pick a widget.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DslParam {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl DslParam {
    fn new(name: &str, kind: &str, required: bool, description: &str) -> Self {
        Self {
            name: name.into(),
            kind: kind.into(),
            required,
            description: if description.is_empty() { None } else { Some(description.into()) },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DslConditionSpec {
    pub kind: String,
    pub params: Vec<DslParam>,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DslActionSpec {
    pub kind: String,
    pub params: Vec<DslParam>,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DslTriggerSpec {
    pub kind: String,
    pub params: Vec<DslParam>,
    pub description: String,
}

/// Full DSL catalog — emitted by [`describe_dsl`]. Returned as JSON across
/// the FFI boundary (via `FocalPointCore::rules_dsl`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DslCatalog {
    pub triggers: Vec<DslTriggerSpec>,
    pub conditions: Vec<DslConditionSpec>,
    pub actions: Vec<DslActionSpec>,
}

/// Produce the canonical catalog for the Rule DSL.
///
/// Keep this function in lockstep with `condition_matches`, the `Action`
/// enum, and the `Trigger` enum. Tests assert completeness.
pub fn describe_dsl() -> DslCatalog {
    let triggers = vec![
        DslTriggerSpec {
            kind: "Event".into(),
            params: vec![DslParam::new(
                "name",
                "string",
                true,
                "Event type name (e.g. TaskCompleted, canvas:quiz_posted, or a 'canvas:*' glob).",
            )],
            description: "Fire when a normalized event with this type is observed.".into(),
        },
        DslTriggerSpec {
            kind: "Schedule".into(),
            params: vec![DslParam::new(
                "cron",
                "string",
                true,
                "6-field cron spec (sec min hour dom mon dow), e.g. '0 0 9 * * *'.",
            )],
            description: "Fire on a wall-clock schedule tick.".into(),
        },
        DslTriggerSpec {
            kind: "StateChange".into(),
            params: vec![DslParam::new(
                "key",
                "string",
                true,
                "Dotted state path, e.g. 'wallet.balance'.",
            )],
            description: "Fire when the value at this state path changes.".into(),
        },
    ];

    let conditions = vec![
        DslConditionSpec {
            kind: "confidence_gte".into(),
            params: vec![DslParam::new("min", "number", true, "Minimum event.confidence (0..1).")],
            description: "Only fire when the source event's confidence meets the threshold.".into(),
        },
        DslConditionSpec {
            kind: "payload_eq".into(),
            params: vec![
                DslParam::new("path", "string", true, "Dotted payload path."),
                DslParam::new("value", "any", true, "Exact JSON value to match."),
            ],
            description: "Payload value at `path` equals `value`.".into(),
        },
        DslConditionSpec {
            kind: "payload_in".into(),
            params: vec![
                DslParam::new("path", "string", true, "Dotted payload path."),
                DslParam::new("values", "array<any>", true, "Set of permitted JSON values."),
            ],
            description: "Payload value at `path` is one of `values`.".into(),
        },
        DslConditionSpec {
            kind: "payload_gte".into(),
            params: vec![
                DslParam::new("path", "string", true, "Dotted payload path."),
                DslParam::new("min", "number", true, "Lower bound (inclusive)."),
            ],
            description: "Numeric payload value at `path` is >= `min`.".into(),
        },
        DslConditionSpec {
            kind: "payload_lte".into(),
            params: vec![
                DslParam::new("path", "string", true, "Dotted payload path."),
                DslParam::new("max", "number", true, "Upper bound (inclusive)."),
            ],
            description: "Numeric payload value at `path` is <= `max`.".into(),
        },
        DslConditionSpec {
            kind: "payload_exists".into(),
            params: vec![DslParam::new("path", "string", true, "Dotted payload path.")],
            description: "Payload key at `path` is present (null counts).".into(),
        },
        DslConditionSpec {
            kind: "payload_matches".into(),
            params: vec![
                DslParam::new("path", "string", true, "Dotted payload path."),
                DslParam::new("pattern", "string", true, "Rust regex pattern."),
            ],
            description: "String payload value at `path` matches `pattern`.".into(),
        },
        DslConditionSpec {
            kind: "source_eq".into(),
            params: vec![DslParam::new(
                "source",
                "string",
                true,
                "Expected NormalizedEvent.connector_id.",
            )],
            description: "Event originated from the specified connector.".into(),
        },
        DslConditionSpec {
            kind: "occurred_within".into(),
            params: vec![DslParam::new(
                "seconds",
                "number",
                true,
                "Max age of event.occurred_at, in seconds.",
            )],
            description: "Event occurred within the last N seconds.".into(),
        },
        DslConditionSpec {
            kind: "all_of".into(),
            params: vec![DslParam::new(
                "conditions",
                "array<condition>",
                true,
                "Nested condition list; all must match (AND).",
            )],
            description: "Boolean AND over nested conditions.".into(),
        },
        DslConditionSpec {
            kind: "any_of".into(),
            params: vec![DslParam::new(
                "conditions",
                "array<condition>",
                true,
                "Nested condition list; any may match (OR).",
            )],
            description: "Boolean OR over nested conditions.".into(),
        },
        DslConditionSpec {
            kind: "not".into(),
            params: vec![DslParam::new(
                "condition",
                "condition",
                true,
                "Nested condition to negate.",
            )],
            description: "Boolean NOT over a nested condition.".into(),
        },
    ];

    let actions = vec![
        DslActionSpec {
            kind: "GrantCredit".into(),
            params: vec![DslParam::new("amount", "integer", true, "Credits to grant.")],
            description: "Add credit to the wallet.".into(),
        },
        DslActionSpec {
            kind: "DeductCredit".into(),
            params: vec![DslParam::new("amount", "integer", true, "Credits to deduct.")],
            description: "Remove credit from the wallet.".into(),
        },
        DslActionSpec {
            kind: "Block".into(),
            params: vec![
                DslParam::new("profile", "string", true, "Enforcement profile id."),
                DslParam::new("duration_seconds", "integer", true, "Block duration in seconds."),
                DslParam::new(
                    "rigidity",
                    "enum<Hard|Soft>",
                    false,
                    "Defaults to Hard. Soft allows bypass.",
                ),
            ],
            description: "Activate the named enforcement profile.".into(),
        },
        DslActionSpec {
            kind: "Unblock".into(),
            params: vec![DslParam::new("profile", "string", true, "Enforcement profile id.")],
            description: "Deactivate the named enforcement profile.".into(),
        },
        DslActionSpec {
            kind: "StreakIncrement".into(),
            params: vec![DslParam::new("name", "string", true, "Streak identifier.")],
            description: "Increment a named streak counter.".into(),
        },
        DslActionSpec {
            kind: "StreakReset".into(),
            params: vec![DslParam::new("name", "string", true, "Streak identifier.")],
            description: "Reset a named streak counter to zero.".into(),
        },
        DslActionSpec {
            kind: "Notify".into(),
            params: vec![DslParam::new("message", "string", true, "Notification body.")],
            description: "Send a local notification to the user.".into(),
        },
        DslActionSpec {
            kind: "EmergencyExit".into(),
            params: vec![
                DslParam::new("profiles", "array<string>", true, "Profiles to short-circuit."),
                DslParam::new("duration_seconds", "integer", true, "Exit window in seconds."),
                DslParam::new("bypass_cost", "integer", true, "Bypass budget to consume."),
                DslParam::new("reason", "string", true, "User-visible rationale."),
            ],
            description: "Break-glass exit from an active hard block.".into(),
        },
        DslActionSpec {
            kind: "Intervention".into(),
            params: vec![
                DslParam::new("message", "string", true, "Intervention body."),
                DslParam::new(
                    "severity",
                    "enum<Gentle|Firm|Urgent>",
                    true,
                    "Drives mascot pose/emotion.",
                ),
            ],
            description: "Coaching intervention surfaced via mascot + notifications.".into(),
        },
        DslActionSpec {
            kind: "ScheduledUnlockWindow".into(),
            params: vec![
                DslParam::new("profile", "string", true, "Enforcement profile id."),
                DslParam::new("starts_at", "string<iso8601>", true, "Window start."),
                DslParam::new("ends_at", "string<iso8601>", true, "Window end."),
                DslParam::new("credit_cost", "integer", true, "Credit debited up front."),
            ],
            description: "Time-boxed paid unblock.".into(),
        },
    ];

    DslCatalog { triggers, conditions, actions }
}

/// Fluent builder for [`Rule`]s. Primarily used by tests and future
/// browser-hosted builders that assemble rules programmatically; the in-app
/// wizard constructs a [`super::Rule`]-shaped `RuleDraft` directly via FFI.
#[derive(Debug, Clone)]
pub struct RuleBuilder {
    rule: Rule,
}

impl RuleBuilder {
    pub fn new(name: impl Into<String>, trigger: Trigger) -> Self {
        Self {
            rule: Rule {
                id: Uuid::new_v4(),
                name: name.into(),
                trigger,
                conditions: Vec::new(),
                actions: Vec::new(),
                priority: 0,
                cooldown: None,
                duration: None,
                explanation_template: String::new(),
                enabled: true,
            },
        }
    }

    pub fn id(mut self, id: Uuid) -> Self {
        self.rule.id = id;
        self
    }

    pub fn condition(mut self, kind: impl Into<String>, params: serde_json::Value) -> Self {
        self.rule.conditions.push(Condition { kind: kind.into(), params });
        self
    }

    pub fn action(mut self, action: Action) -> Self {
        self.rule.actions.push(action);
        self
    }

    pub fn priority(mut self, p: i32) -> Self {
        self.rule.priority = p;
        self
    }

    pub fn cooldown(mut self, d: Duration) -> Self {
        self.rule.cooldown = Some(d);
        self
    }

    pub fn duration(mut self, d: Duration) -> Self {
        self.rule.duration = Some(d);
        self
    }

    pub fn explanation_template(mut self, tpl: impl Into<String>) -> Self {
        self.rule.explanation_template = tpl.into();
        self
    }

    pub fn enabled(mut self, enabled: bool) -> Self {
        self.rule.enabled = enabled;
        self
    }

    pub fn build(self) -> Rule {
        self.rule
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_all_three_trigger_kinds() {
        let cat = describe_dsl();
        let names: Vec<&str> = cat.triggers.iter().map(|t| t.kind.as_str()).collect();
        assert_eq!(names.len(), 3);
        for expected in ["Event", "Schedule", "StateChange"] {
            assert!(names.contains(&expected), "missing trigger {expected}");
        }
    }

    #[test]
    fn catalog_has_all_twelve_condition_kinds() {
        let cat = describe_dsl();
        let names: Vec<&str> = cat.conditions.iter().map(|c| c.kind.as_str()).collect();
        let expected = [
            "confidence_gte",
            "payload_eq",
            "payload_in",
            "payload_gte",
            "payload_lte",
            "payload_exists",
            "payload_matches",
            "source_eq",
            "occurred_within",
            "all_of",
            "any_of",
            "not",
        ];
        assert_eq!(names.len(), expected.len(), "condition count drift: {names:?}");
        for e in expected {
            assert!(names.contains(&e), "missing condition {e}");
        }
    }

    #[test]
    fn catalog_has_all_ten_action_variants() {
        let cat = describe_dsl();
        let names: Vec<&str> = cat.actions.iter().map(|a| a.kind.as_str()).collect();
        let expected = [
            "GrantCredit",
            "DeductCredit",
            "Block",
            "Unblock",
            "StreakIncrement",
            "StreakReset",
            "Notify",
            "EmergencyExit",
            "Intervention",
            "ScheduledUnlockWindow",
        ];
        assert_eq!(names.len(), expected.len(), "action count drift: {names:?}");
        for e in expected {
            assert!(names.contains(&e), "missing action {e}");
        }
    }

    #[test]
    fn catalog_json_round_trips() {
        let cat = describe_dsl();
        let s = serde_json::to_string(&cat).expect("serialize");
        let back: DslCatalog = serde_json::from_str(&s).expect("deserialize");
        assert_eq!(cat, back);
    }

    #[test]
    fn every_condition_has_at_least_one_param() {
        let cat = describe_dsl();
        for c in &cat.conditions {
            assert!(!c.params.is_empty(), "condition {} has no params", c.kind);
        }
    }

    #[test]
    fn every_action_has_required_params_where_expected() {
        let cat = describe_dsl();
        // EmergencyExit/Intervention/ScheduledUnlockWindow all require >1 param.
        for kind in ["EmergencyExit", "Intervention", "ScheduledUnlockWindow", "Block"] {
            let spec =
                cat.actions.iter().find(|a| a.kind == kind).unwrap_or_else(|| panic!("{kind}"));
            assert!(spec.params.iter().any(|p| p.required), "{kind} should have required params");
        }
    }

    #[test]
    fn rule_builder_assembles_minimal_rule() {
        let r = RuleBuilder::new("Reward homework", Trigger::Event("TaskCompleted".into()))
            .action(Action::GrantCredit { amount: 5 })
            .priority(10)
            .explanation_template("+5 credits")
            .build();
        assert_eq!(r.name, "Reward homework");
        assert_eq!(r.priority, 10);
        assert_eq!(r.actions.len(), 1);
        assert!(r.enabled);
    }
}
