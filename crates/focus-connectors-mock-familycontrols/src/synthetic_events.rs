// SPDX-License-Identifier: MIT OR Apache-2.0

//! Synthetic event types and scenarios for deterministic demo choreography.
//!
//! Traces to: FR-MOCK-002 (synthetic events), FR-MOCK-004 (emergency-exit).

use chrono::Utc;
use focus_events::EventType;
use serde_json::{json, Value};
use std::collections::VecDeque;

/// Synthetic event kinds that the mock connector can emit.
/// Traces to: FR-MOCK-002.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyntheticEventKind {
    /// App launch attempt (may be blocked or allowed).
    AppLaunch {
        bundle_id: String,
        app_name: String,
    },

    /// Screen-time accumulation over a time window.
    ScreenTimeAccumulation {
        bundle_id: String,
        minutes_used: u32,
    },

    /// Intervention triggered (e.g., timeout, escalation).
    InterventionTriggered {
        rule_id: String,
        escalation_tier: String,
    },

    /// Emergency exit (override, biometric/passcode unlock).
    /// Traces to: FR-MOCK-004.
    EmergencyExit {
        reason: String,
        auth_method: String,
    },

    /// Intervention cleared (e.g., rule expired, manual reset).
    InterventionCleared {
        rule_id: String,
        reason: String,
    },
}

impl SyntheticEventKind {
    pub fn kind_name(&self) -> &'static str {
        match self {
            SyntheticEventKind::AppLaunch { .. } => "app_launch",
            SyntheticEventKind::ScreenTimeAccumulation { .. } => "screentime_accumulation",
            SyntheticEventKind::InterventionTriggered { .. } => "intervention_triggered",
            SyntheticEventKind::EmergencyExit { .. } => "emergency_exit",
            SyntheticEventKind::InterventionCleared { .. } => "intervention_cleared",
        }
    }

    pub fn to_event_type(&self) -> EventType {
        EventType::Custom(self.kind_name().to_string())
    }

    pub fn to_payload(&self) -> Value {
        match self {
            SyntheticEventKind::AppLaunch { bundle_id, app_name } => {
                json!({
                    "bundle_id": bundle_id,
                    "app_name": app_name,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            }
            SyntheticEventKind::ScreenTimeAccumulation {
                bundle_id,
                minutes_used,
            } => {
                json!({
                    "bundle_id": bundle_id,
                    "minutes_used": minutes_used,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            }
            SyntheticEventKind::InterventionTriggered {
                rule_id,
                escalation_tier,
            } => {
                json!({
                    "rule_id": rule_id,
                    "escalation_tier": escalation_tier,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            }
            SyntheticEventKind::EmergencyExit {
                reason,
                auth_method,
            } => {
                json!({
                    "reason": reason,
                    "auth_method": auth_method,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            }
            SyntheticEventKind::InterventionCleared { rule_id, reason } => {
                json!({
                    "rule_id": rule_id,
                    "reason": reason,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            }
        }
    }
}

/// Schedule of synthetic events. Supports scenario presets and manual enqueue.
/// Traces to: FR-MOCK-002, FR-MOCK-003.
#[derive(Debug, Clone, Default)]
pub struct SyntheticEventSchedule {
    queue: VecDeque<SyntheticEventKind>,
}

impl SyntheticEventSchedule {
    /// Create a schedule from a named scenario.
    pub fn from_scenario(name: &str) -> Result<Self, crate::MockError> {
        match name {
            "standard_day" => Ok(Self::standard_day_scenario()),
            "intervention_flow" => Ok(Self::intervention_flow_scenario()),
            "emergency_exit_demo" => Ok(Self::emergency_exit_scenario()),
            _ => Err(crate::MockError::InvalidSchedule(format!(
                "unknown scenario: {}",
                name
            ))),
        }
    }

    /// Standard day: app launches, screen-time accumulation, normal usage.
    fn standard_day_scenario() -> Self {
        let mut queue = VecDeque::new();
        queue.push_back(SyntheticEventKind::AppLaunch {
            bundle_id: "com.apple.mobilesafari".to_string(),
            app_name: "Safari".to_string(),
        });
        queue.push_back(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.apple.mobilesafari".to_string(),
            minutes_used: 15,
        });
        queue.push_back(SyntheticEventKind::AppLaunch {
            bundle_id: "com.instagram.instagram".to_string(),
            app_name: "Instagram".to_string(),
        });
        queue.push_back(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.instagram.instagram".to_string(),
            minutes_used: 30,
        });
        queue.push_back(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.apple.mobilesafari".to_string(),
            minutes_used: 15,
        });

        Self { queue }
    }

    /// Intervention flow: rule triggers, escalation, then clears.
    fn intervention_flow_scenario() -> Self {
        let mut queue = VecDeque::new();
        queue.push_back(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.instagram.instagram".to_string(),
            minutes_used: 60,
        });
        queue.push_back(SyntheticEventKind::InterventionTriggered {
            rule_id: "rule-daily-limit".to_string(),
            escalation_tier: "tier_1".to_string(),
        });
        queue.push_back(SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "com.instagram.instagram".to_string(),
            minutes_used: 30,
        });
        queue.push_back(SyntheticEventKind::InterventionTriggered {
            rule_id: "rule-daily-limit".to_string(),
            escalation_tier: "tier_2".to_string(),
        });
        queue.push_back(SyntheticEventKind::InterventionCleared {
            rule_id: "rule-daily-limit".to_string(),
            reason: "manual_reset".to_string(),
        });

        Self { queue }
    }

    /// Emergency exit demo: intervention, override, biometric auth.
    fn emergency_exit_scenario() -> Self {
        let mut queue = VecDeque::new();
        queue.push_back(SyntheticEventKind::InterventionTriggered {
            rule_id: "rule-lockout".to_string(),
            escalation_tier: "tier_3".to_string(),
        });
        queue.push_back(SyntheticEventKind::EmergencyExit {
            reason: "user_override".to_string(),
            auth_method: "biometric".to_string(),
        });
        queue.push_back(SyntheticEventKind::AppLaunch {
            bundle_id: "com.apple.mobilesafari".to_string(),
            app_name: "Safari".to_string(),
        });

        Self { queue }
    }

    pub fn peek_next(&self) -> Option<SyntheticEventKind> {
        self.queue.front().cloned()
    }

    pub fn dequeue(&mut self) {
        self.queue.pop_front();
    }

    pub fn enqueue(&mut self, kind: SyntheticEventKind) {
        self.queue.push_back(kind);
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn clear(&mut self) {
        self.queue.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-MOCK-002
    #[test]
    fn synthetic_event_kind_names_correct() {
        let launch = SyntheticEventKind::AppLaunch {
            bundle_id: "test".to_string(),
            app_name: "Test".to_string(),
        };
        assert_eq!(launch.kind_name(), "app_launch");

        let screentime = SyntheticEventKind::ScreenTimeAccumulation {
            bundle_id: "test".to_string(),
            minutes_used: 30,
        };
        assert_eq!(screentime.kind_name(), "screentime_accumulation");
    }

    // Traces to: FR-MOCK-004
    #[test]
    fn emergency_exit_payload_correct() {
        let exit = SyntheticEventKind::EmergencyExit {
            reason: "user_override".to_string(),
            auth_method: "biometric".to_string(),
        };
        let payload = exit.to_payload();
        assert_eq!(payload["reason"], "user_override");
        assert_eq!(payload["auth_method"], "biometric");
    }

    // Traces to: FR-MOCK-002
    #[test]
    fn schedule_from_standard_day_scenario() {
        let schedule = SyntheticEventSchedule::from_scenario("standard_day").unwrap();
        assert!(!schedule.is_empty());
        assert_eq!(schedule.len(), 5);
    }

    // Traces to: FR-MOCK-002
    #[test]
    fn schedule_from_intervention_flow_scenario() {
        let schedule = SyntheticEventSchedule::from_scenario("intervention_flow").unwrap();
        assert!(!schedule.is_empty());
        assert_eq!(schedule.len(), 5);
    }

    // Traces to: FR-MOCK-004
    #[test]
    fn schedule_from_emergency_exit_scenario() {
        let schedule = SyntheticEventSchedule::from_scenario("emergency_exit_demo").unwrap();
        assert!(!schedule.is_empty());
        assert_eq!(schedule.len(), 3);
    }

    // Traces to: FR-MOCK-002
    #[test]
    fn schedule_peek_and_dequeue() {
        let mut schedule = SyntheticEventSchedule::default();
        schedule.enqueue(SyntheticEventKind::AppLaunch {
            bundle_id: "test".to_string(),
            app_name: "Test".to_string(),
        });
        assert_eq!(schedule.len(), 1);
        let _ = schedule.peek_next();
        assert_eq!(schedule.len(), 1);
        schedule.dequeue();
        assert_eq!(schedule.len(), 0);
    }

    // Traces to: FR-MOCK-002
    #[test]
    fn invalid_scenario_errors() {
        let result = SyntheticEventSchedule::from_scenario("invalid");
        assert!(result.is_err());
    }
}
