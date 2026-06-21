// SPDX-License-Identifier: MIT OR Apache-2.0

//! Reverse code-generation: RuleIr → FPL and RuleIr → CLI.
//!
//! Pure functions to render an IR rule back to user-friendly text formats.
//! Supports FPL (Starlark-inspired DSL) and CLI command syntax.

use crate::RuleIr;
use std::fmt::Write;

/// Render a RuleIr as FPL (focus-lang DSL).
///
/// Produces deterministic Starlark-like syntax matching focus-lang helper patterns.
/// Output can be parsed back to RuleIr for round-trip validation.
///
/// # Example
///
/// ```ignore
/// let ir = RuleIr { /* ... */ };
/// let fpl = ir_to_fpl(&ir);
/// println!("{}", fpl);
/// // rule("my_rule") {
/// //   priority = 10
/// //   trigger { type = "UserStartsSession", session_type = "deep_work" }
/// //   when { time_in_range(start_hour = 9, end_hour = 17) }
/// //   then { enforce_policy(policy_id = "focus_lock") }
/// // }
/// ```
pub fn ir_to_fpl(ir: &RuleIr) -> String {
    let mut output = String::new();

    // Rule header with name
    writeln!(&mut output, "rule(\"{}\") {{", escape_string(&ir.name)).unwrap();

    // Metadata
    writeln!(&mut output, "  priority = {}", ir.priority).unwrap();
    if let Some(cooldown) = ir.cooldown_seconds {
        writeln!(&mut output, "  cooldown_seconds = {}", cooldown).unwrap();
    }
    if let Some(duration) = ir.duration_seconds {
        writeln!(&mut output, "  duration_seconds = {}", duration).unwrap();
    }
    writeln!(&mut output, "  enabled = {}", ir.enabled).unwrap();

    // Triggers
    writeln!(&mut output, "  trigger {{").unwrap();
    render_trigger(&ir.trigger, &mut output);
    writeln!(&mut output, "  }}").unwrap();

    // Conditions (when block)
    if !ir.conditions.is_empty() {
        writeln!(&mut output, "  when {{").unwrap();
        for condition in &ir.conditions {
            render_condition(condition, &mut output, 2);
        }
        writeln!(&mut output, "  }}").unwrap();
    }

    // Actions (then block)
    if !ir.actions.is_empty() {
        writeln!(&mut output, "  then {{").unwrap();
        for action in &ir.actions {
            render_action(action, &mut output, 2);
        }
        writeln!(&mut output, "  }}").unwrap();
    }

    // Explanation (optional comment)
    if !ir.explanation_template.is_empty() {
        writeln!(
            &mut output,
            "  # explanation = \"{}\"",
            escape_string(&ir.explanation_template)
        )
        .unwrap();
    }

    writeln!(&mut output, "}}").unwrap();
    output
}

/// Render a RuleIr as a `focus rules add ...` CLI command.
///
/// Produces a POSIX shell invocation with quoted arguments suitable for automation.
/// Output can be parsed back to RuleIr via shell → CLI parser.
///
/// # Example
///
/// ```ignore
/// let ir = RuleIr { /* ... */ };
/// let cli = ir_to_cli(&ir);
/// println!("{}", cli);
/// // focus rules add --name "my_rule" --priority 10 --enabled true \
/// //   --trigger '{"type":"UserStartsSession","value":{"session_type":"deep_work"}}' \
/// //   --action '{"type":"enforce_policy","policy_id":"focus_lock"}'
/// ```
pub fn ir_to_cli(ir: &RuleIr) -> String {
    let mut output = String::new();

    write!(&mut output, "focus rules add").unwrap();
    write!(&mut output, " --name '{}'", escape_single_quote(&ir.name)).unwrap();
    write!(&mut output, " --id '{}'", escape_single_quote(&ir.id)).unwrap();
    write!(&mut output, " --priority {}", ir.priority).unwrap();
    write!(&mut output, " --enabled {}", ir.enabled).unwrap();

    if let Some(cooldown) = ir.cooldown_seconds {
        write!(&mut output, " --cooldown {}", cooldown).unwrap();
    }
    if let Some(duration) = ir.duration_seconds {
        write!(&mut output, " --duration {}", duration).unwrap();
    }

    // Trigger as JSON
    let trigger_json = serde_json::to_string(&ir.trigger)
        .unwrap_or_else(|_| "{}".to_string());
    write!(&mut output, " --trigger '{}'", escape_single_quote(&trigger_json)).unwrap();

    // Conditions as JSON array
    let conditions_json = serde_json::to_string(&ir.conditions)
        .unwrap_or_else(|_| "[]".to_string());
    write!(
        &mut output,
        " --conditions '{}'",
        escape_single_quote(&conditions_json)
    )
    .unwrap();

    // Actions as JSON array
    let actions_json = serde_json::to_string(&ir.actions)
        .unwrap_or_else(|_| "[]".to_string());
    write!(
        &mut output,
        " --actions '{}'",
        escape_single_quote(&actions_json)
    )
    .unwrap();

    if !ir.explanation_template.is_empty() {
        write!(
            &mut output,
            " --explanation '{}'",
            escape_single_quote(&ir.explanation_template)
        )
        .unwrap();
    }

    output
}

// --- Rendering Helpers ---

fn render_trigger(trigger: &crate::TriggerIr, output: &mut String) {
    use crate::TriggerIr;
    match trigger {
        TriggerIr::UserStartsSession { session_type } => {
            write!(
                output,
                "    type = \"UserStartsSession\"\n    session_type = \"{}\"",
                escape_string(session_type)
            )
            .unwrap();
        }
        TriggerIr::EventFired { event_name } => {
            write!(
                output,
                "    type = \"EventFired\"\n    event_name = \"{}\"",
                escape_string(event_name)
            )
            .unwrap();
        }
        TriggerIr::TimeElapsed { duration_ms } => {
            write!(
                output,
                "    type = \"TimeElapsed\"\n    duration_ms = {}",
                duration_ms
            )
            .unwrap();
        }
        TriggerIr::ScheduleCron {
            cron_expression,
            timezone,
        } => {
            write!(
                output,
                "    type = \"ScheduleCron\"\n    cron_expression = \"{}\"\n    timezone = \"{}\"",
                escape_string(cron_expression),
                escape_string(timezone)
            )
            .unwrap();
        }
        TriggerIr::WebhookReceived { path, method } => {
            write!(
                output,
                "    type = \"WebhookReceived\"\n    path = \"{}\"\n    method = \"{}\"",
                escape_string(path),
                escape_string(method)
            )
            .unwrap();
        }
        TriggerIr::UserAction {
            action_type,
            target,
        } => {
            write!(
                output,
                "    type = \"UserAction\"\n    action_type = \"{}\"\n    target = \"{}\"",
                escape_string(action_type),
                escape_string(target)
            )
            .unwrap();
        }
        TriggerIr::ConditionMet { condition } => {
            write!(output, "    type = \"ConditionMet\"\n    condition = {{").unwrap();
            render_condition(condition, output, 3);
            write!(output, "\n    }}").unwrap();
        }
    }
}

fn render_condition(cond: &crate::ConditionIr, output: &mut String, indent: usize) {
    use crate::ConditionIr;
    let ind = " ".repeat(indent);

    match cond {
        ConditionIr::And { conditions } => {
            writeln!(output, "{}and {{", ind).unwrap();
            for c in conditions {
                render_condition(c, output, indent + 2);
            }
            write!(output, "{}}}", ind).unwrap();
        }
        ConditionIr::Or { conditions } => {
            writeln!(output, "{}or {{", ind).unwrap();
            for c in conditions {
                render_condition(c, output, indent + 2);
            }
            write!(output, "{}}}", ind).unwrap();
        }
        ConditionIr::Not { condition } => {
            writeln!(output, "{}not {{", ind).unwrap();
            render_condition(condition, output, indent + 2);
            write!(output, "{}}}", ind).unwrap();
        }
        ConditionIr::TimeInRange {
            start_hour,
            end_hour,
        } => {
            writeln!(
                output,
                "{}time_in_range(start_hour = {}, end_hour = {})",
                ind, start_hour, end_hour
            )
            .unwrap();
        }
        ConditionIr::DayOfWeek { days } => {
            let day_list = days.iter().map(|d| format!("\"{}\"", d)).collect::<Vec<_>>().join(", ");
            writeln!(output, "{}day_of_week(days = [{}])", ind, day_list).unwrap();
        }
        ConditionIr::UserAttribute { key, value } => {
            writeln!(
                output,
                "{}user_attribute(key = \"{}\", value = \"{}\")",
                ind,
                escape_string(key),
                escape_string(value)
            )
            .unwrap();
        }
        ConditionIr::EventProperty { property, expected } => {
            let expected_str = serde_json::to_string(&expected)
                .unwrap_or_else(|_| "null".to_string());
            writeln!(
                output,
                "{}event_property(property = \"{}\", expected = {})",
                ind,
                escape_string(property),
                expected_str
            )
            .unwrap();
        }
        ConditionIr::CustomPredicate { name, args } => {
            let args_str = serde_json::to_string(&args)
                .unwrap_or_else(|_| "{}".to_string());
            writeln!(
                output,
                "{}custom_predicate(name = \"{}\", args = {})",
                ind,
                escape_string(name),
                args_str
            )
            .unwrap();
        }
    }
}

fn render_action(action: &crate::ActionIr, output: &mut String, indent: usize) {
    use crate::ActionIr;
    let ind = " ".repeat(indent);

    match action {
        ActionIr::EnforcePolicy { policy_id, params } => {
            write!(output, "{}enforce_policy(policy_id = \"{}\"", ind, escape_string(policy_id))
                .unwrap();
            if !params.is_empty() {
                write!(output, ", params = {{").unwrap();
                for (k, v) in params {
                    let v_str = serde_json::to_string(v).unwrap_or_else(|_| "null".to_string());
                    write!(output, " \"{}\" = {}", k, v_str).unwrap();
                }
                write!(output, " }}").unwrap();
            }
            writeln!(output, ")").unwrap();
        }
        ActionIr::EmitEvent {
            event_type,
            payload,
        } => {
            write!(output, "{}emit_event(event_type = \"{}\"", ind, escape_string(event_type))
                .unwrap();
            if !payload.is_empty() {
                write!(output, ", payload = {{").unwrap();
                for (k, v) in payload {
                    let v_str = serde_json::to_string(v).unwrap_or_else(|_| "null".to_string());
                    write!(output, " \"{}\" = {}", k, v_str).unwrap();
                }
                write!(output, " }}").unwrap();
            }
            writeln!(output, ")").unwrap();
        }
        ActionIr::ApplyMutation {
            mutation_id,
            params,
        } => {
            write!(
                output,
                "{}apply_mutation(mutation_id = \"{}\"",
                ind,
                escape_string(mutation_id)
            )
            .unwrap();
            if !params.is_empty() {
                write!(output, ", params = {{").unwrap();
                for (k, v) in params {
                    let v_str = serde_json::to_string(v).unwrap_or_else(|_| "null".to_string());
                    write!(output, " \"{}\" = {}", k, v_str).unwrap();
                }
                write!(output, " }}").unwrap();
            }
            writeln!(output, ")").unwrap();
        }
        ActionIr::ScheduleTask {
            task_id,
            delay_ms,
            params,
        } => {
            write!(output, "{}schedule_task(task_id = \"{}\"", ind, escape_string(task_id))
                .unwrap();
            if let Some(delay) = delay_ms {
                write!(output, ", delay_ms = {}", delay).unwrap();
            }
            if !params.is_empty() {
                write!(output, ", params = {{").unwrap();
                for (k, v) in params {
                    let v_str = serde_json::to_string(v).unwrap_or_else(|_| "null".to_string());
                    write!(output, " \"{}\" = {}", k, v_str).unwrap();
                }
                write!(output, " }}").unwrap();
            }
            writeln!(output, ")").unwrap();
        }
        ActionIr::TriggerSequence { actions } => {
            writeln!(output, "{}trigger_sequence {{", ind).unwrap();
            for a in actions {
                render_action(a, output, indent + 2);
            }
            writeln!(output, "{}}}", ind).unwrap();
        }
        ActionIr::ShowNotification {
            notification_id,
            text,
            duration_ms,
        } => {
            write!(
                output,
                "{}show_notification(notification_id = \"{}\", text = \"{}\"",
                ind,
                escape_string(notification_id),
                escape_string(text)
            )
            .unwrap();
            if let Some(duration) = duration_ms {
                write!(output, ", duration_ms = {}", duration).unwrap();
            }
            writeln!(output, ")").unwrap();
        }
    }
}

// --- Escape Helpers ---

fn escape_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn escape_single_quote(s: &str) -> String {
    s.replace('\'', "'\\''")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ActionIr, ConditionIr, RuleIr, TriggerIr};
    use std::collections::BTreeMap;

    fn sample_rule() -> RuleIr {
        RuleIr {
            id: "rule-001".to_string(),
            name: "Focus Lock".to_string(),
            trigger: TriggerIr::UserStartsSession {
                session_type: "deep_work".to_string(),
            },
            conditions: vec![ConditionIr::TimeInRange {
                start_hour: 9,
                end_hour: 17,
            }],
            actions: vec![ActionIr::EnforcePolicy {
                policy_id: "focus_lock".to_string(),
                params: BTreeMap::new(),
            }],
            priority: 10,
            cooldown_seconds: Some(300),
            duration_seconds: Some(3600),
            explanation_template: "Focus time enabled".to_string(),
            enabled: true,
        }
    }

    #[test]
    fn test_ir_to_fpl_basic() {
        let rule = sample_rule();
        let fpl = ir_to_fpl(&rule);

        assert!(fpl.contains("rule(\"Focus Lock\")"));
        assert!(fpl.contains("priority = 10"));
        assert!(fpl.contains("cooldown_seconds = 300"));
        assert!(fpl.contains("duration_seconds = 3600"));
        assert!(fpl.contains("enabled = true"));
        assert!(fpl.contains("trigger {"));
        assert!(fpl.contains("when {"));
        assert!(fpl.contains("then {"));
    }

    #[test]
    fn test_ir_to_cli_basic() {
        let rule = sample_rule();
        let cli = ir_to_cli(&rule);

        assert!(cli.contains("focus rules add"));
        assert!(cli.contains("--name 'Focus Lock'"));
        assert!(cli.contains("--priority 10"));
        assert!(cli.contains("--enabled true"));
        assert!(cli.contains("--cooldown 300"));
        assert!(cli.contains("--duration 3600"));
        assert!(cli.contains("--trigger"));
        assert!(cli.contains("--conditions"));
        assert!(cli.contains("--actions"));
    }

    #[test]
    fn test_ir_to_fpl_escape_quotes() {
        let mut rule = sample_rule();
        rule.name = "Focus \"Lock\" Time".to_string();
        let fpl = ir_to_fpl(&rule);
        assert!(fpl.contains("Focus \\\"Lock\\\" Time"));
    }

    #[test]
    fn test_ir_to_cli_escape_quotes() {
        let mut rule = sample_rule();
        rule.name = "Focus 'Lock' Time".to_string();
        let cli = ir_to_cli(&rule);
        assert!(cli.contains("Focus '\\''Lock'\\'' Time"));
    }

    #[test]
    fn test_ir_to_fpl_no_optionals() {
        let mut rule = sample_rule();
        rule.cooldown_seconds = None;
        rule.duration_seconds = None;
        rule.explanation_template.clear();
        let fpl = ir_to_fpl(&rule);

        assert!(!fpl.contains("cooldown_seconds"));
        assert!(!fpl.contains("duration_seconds"));
        assert!(!fpl.contains("explanation"));
    }

    #[test]
    fn test_ir_to_fpl_complex_conditions() {
        let rule = RuleIr {
            id: "rule-002".to_string(),
            name: "Complex Rule".to_string(),
            trigger: TriggerIr::EventFired {
                event_name: "session_start".to_string(),
            },
            conditions: vec![ConditionIr::And {
                conditions: vec![
                    ConditionIr::TimeInRange {
                        start_hour: 9,
                        end_hour: 17,
                    },
                    ConditionIr::DayOfWeek {
                        days: vec![
                            "Mon".to_string(),
                            "Tue".to_string(),
                            "Wed".to_string(),
                        ],
                    },
                ],
            }],
            actions: vec![],
            priority: 5,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "".to_string(),
            enabled: true,
        };

        let fpl = ir_to_fpl(&rule);
        assert!(fpl.contains("and {"));
        assert!(fpl.contains("time_in_range"));
        assert!(fpl.contains("day_of_week"));
    }

    #[test]
    fn test_ir_to_fpl_task_actions() {
        let rule = RuleIr {
            id: "rule-003".to_string(),
            name: "Task Scheduler".to_string(),
            trigger: TriggerIr::UserStartsSession {
                session_type: "planning".to_string(),
            },
            conditions: vec![],
            actions: vec![ActionIr::ScheduleTask {
                task_id: "task-100".to_string(),
                delay_ms: Some(5000),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("priority".to_string(), serde_json::json!("high"));
                    m
                },
            }],
            priority: 8,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "".to_string(),
            enabled: true,
        };

        let fpl = ir_to_fpl(&rule);
        assert!(fpl.contains("schedule_task"));
        assert!(fpl.contains("task-100"));
        assert!(fpl.contains("delay_ms = 5000"));
    }
}
