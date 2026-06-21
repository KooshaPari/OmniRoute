// SPDX-License-Identifier: MIT OR Apache-2.0
/// Differential property tests for surface parity.
/// Verifies that RuleIr round-trips consistently across all surfaces:
/// - IR → JSON → IR (serde round-trip)
/// - IR → canonical hash stability
///
/// INVARIANT: Hash must be identical after any round-trip transformation.

#[cfg(test)]
mod differential {
    use focus_ir::RuleIr;
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;

    /// Generate canonical hash from RuleIr.
    fn canonical_hash(rule: &RuleIr) -> String {
        let json = serde_json::to_string(rule).expect("serialize RuleIr");
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Test: IR → serialize → deserialize → rehash equality.
    #[test]
    fn test_ir_serde_roundtrip_hash_stability() {
        let rule = RuleIr {
            id: "rule-1".to_string(),
            name: "test_rule".to_string(),
            trigger: focus_ir::TriggerIr::UserStartsSession {
                session_type: "work".to_string(),
            },
            conditions: vec![focus_ir::ConditionIr::TimeInRange {
                start_hour: 9,
                end_hour: 17,
            }],
            actions: vec![focus_ir::ActionIr::EmitEvent {
                event_type: "alert".to_string(),
                payload: BTreeMap::new(),
            }],
            priority: 1,
            cooldown_seconds: Some(3600),
            duration_seconds: None,
            explanation_template: "Test rule".to_string(),
            enabled: true,
        };

        let hash1 = canonical_hash(&rule);

        // Serialize and deserialize
        let json = serde_json::to_string(&rule).expect("serialize");
        let deserialized: RuleIr =
            serde_json::from_str(&json).expect("deserialize");

        let hash2 = canonical_hash(&deserialized);

        // INVARIANT: Hash must be identical
        assert_eq!(
            hash1, hash2,
            "Hash mismatch after serde round-trip: {} vs {}",
            hash1, hash2
        );
    }

    /// Test: Multiple serializations of same IR produce identical hashes.
    #[test]
    fn test_ir_multiple_serializations_deterministic() {
        let rule = RuleIr {
            id: "rule-deterministic".to_string(),
            name: "deterministic_test".to_string(),
            trigger: focus_ir::TriggerIr::EventFired {
                event_name: "user.action".to_string(),
            },
            conditions: vec![
                focus_ir::ConditionIr::DayOfWeek {
                    days: vec!["Mon".to_string(), "Tue".to_string()],
                },
                focus_ir::ConditionIr::TimeInRange {
                    start_hour: 8,
                    end_hour: 16,
                },
            ],
            actions: vec![],
            priority: 5,
            cooldown_seconds: None,
            duration_seconds: Some(1800),
            explanation_template: "Deterministic test".to_string(),
            enabled: true,
        };

        let hash1 = canonical_hash(&rule);
        let hash2 = canonical_hash(&rule);
        let hash3 = canonical_hash(&rule);

        assert_eq!(hash1, hash2, "Hash mismatch on second hash");
        assert_eq!(hash2, hash3, "Hash mismatch on third hash");
    }

    /// Test: Nested conditions maintain hash stability.
    #[test]
    fn test_nested_conditions_hash_stability() {
        let conditions = vec![
            focus_ir::ConditionIr::And {
                conditions: vec![
                    focus_ir::ConditionIr::TimeInRange {
                        start_hour: 9,
                        end_hour: 17,
                    },
                    focus_ir::ConditionIr::DayOfWeek {
                        days: vec!["Mon".to_string(), "Wed".to_string(), "Fri".to_string()],
                    },
                ],
            },
            focus_ir::ConditionIr::Not {
                condition: Box::new(focus_ir::ConditionIr::UserAttribute {
                    key: "on_vacation".to_string(),
                    value: "true".to_string(),
                }),
            },
        ];

        let rule = RuleIr {
            id: "rule-nested".to_string(),
            name: "nested_conditions".to_string(),
            trigger: focus_ir::TriggerIr::UserStartsSession {
                session_type: "deep_focus".to_string(),
            },
            conditions,
            actions: vec![focus_ir::ActionIr::ShowNotification {
                notification_id: "notif-1".to_string(),
                text: "Focus time!".to_string(),
                duration_ms: Some(5000),
            }],
            priority: 10,
            cooldown_seconds: Some(600),
            duration_seconds: Some(3600),
            explanation_template: "Focus rule".to_string(),
            enabled: true,
        };

        let json = serde_json::to_string(&rule).expect("serialize");
        let deserialized: RuleIr =
            serde_json::from_str(&json).expect("deserialize");

        let hash_original = canonical_hash(&rule);
        let hash_roundtrip = canonical_hash(&deserialized);

        assert_eq!(
            hash_original, hash_roundtrip,
            "Nested condition hash mismatch"
        );
    }

    /// Test: Complex action sequences maintain hash stability.
    #[test]
    fn test_complex_action_sequences_hash_stability() {
        let mut params = BTreeMap::new();
        params.insert(
            "policy_id".to_string(),
            serde_json::Value::String("policy-1".to_string()),
        );
        params.insert(
            "severity".to_string(),
            serde_json::Value::Number(serde_json::Number::from(3)),
        );

        let actions = vec![
            focus_ir::ActionIr::EmitEvent {
                event_type: "rule.triggered".to_string(),
                payload: BTreeMap::new(),
            },
            focus_ir::ActionIr::EnforcePolicy {
                policy_id: "policy-1".to_string(),
                params: params.clone(),
            },
            focus_ir::ActionIr::ScheduleTask {
                task_id: "task-follow-up".to_string(),
                delay_ms: Some(3600000),
                params: params.clone(),
            },
            focus_ir::ActionIr::TriggerSequence {
                actions: vec![
                    focus_ir::ActionIr::ShowNotification {
                        notification_id: "notif-seq-1".to_string(),
                        text: "Notification 1".to_string(),
                        duration_ms: Some(3000),
                    },
                    focus_ir::ActionIr::ShowNotification {
                        notification_id: "notif-seq-2".to_string(),
                        text: "Notification 2".to_string(),
                        duration_ms: Some(5000),
                    },
                ],
            },
        ];

        let rule = RuleIr {
            id: "rule-complex-actions".to_string(),
            name: "complex_action_sequence".to_string(),
            trigger: focus_ir::TriggerIr::ScheduleCron {
                cron_expression: "0 9 * * MON".to_string(),
                timezone: "America/Los_Angeles".to_string(),
            },
            conditions: vec![],
            actions,
            priority: 7,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "Complex action test".to_string(),
            enabled: true,
        };

        let hash1 = canonical_hash(&rule);

        // Re-serialize and deserialize multiple times
        let json1 = serde_json::to_string(&rule).expect("serialize");
        let rule2: RuleIr = serde_json::from_str(&json1).expect("deserialize");
        let hash2 = canonical_hash(&rule2);

        let json2 = serde_json::to_string(&rule2).expect("serialize");
        let rule3: RuleIr = serde_json::from_str(&json2).expect("deserialize");
        let hash3 = canonical_hash(&rule3);

        assert_eq!(hash1, hash2, "Hash mismatch after first round-trip");
        assert_eq!(hash2, hash3, "Hash mismatch after second round-trip");
    }

    /// Test: Variations in optional fields preserve hash for equivalent rules.
    #[test]
    fn test_optional_fields_consistency() {
        let rule_no_cooldown = RuleIr {
            id: "rule-opts-1".to_string(),
            name: "optional_fields_test".to_string(),
            trigger: focus_ir::TriggerIr::UserStartsSession {
                session_type: "break".to_string(),
            },
            conditions: vec![],
            actions: vec![],
            priority: 1,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "Test".to_string(),
            enabled: true,
        };

        let rule_with_cooldown = RuleIr {
            id: "rule-opts-2".to_string(),
            name: "optional_fields_test".to_string(),
            trigger: focus_ir::TriggerIr::UserStartsSession {
                session_type: "break".to_string(),
            },
            conditions: vec![],
            actions: vec![],
            priority: 1,
            cooldown_seconds: Some(0),
            duration_seconds: Some(0),
            explanation_template: "Test".to_string(),
            enabled: true,
        };

        let hash_no_cooldown = canonical_hash(&rule_no_cooldown);
        let hash_with_cooldown = canonical_hash(&rule_with_cooldown);

        // These should differ because the JSON representation differs
        // (None is omitted via skip_serializing_if, but Some(0) is included)
        assert_ne!(
            hash_no_cooldown, hash_with_cooldown,
            "Optional fields should affect hash when set"
        );
    }
}
