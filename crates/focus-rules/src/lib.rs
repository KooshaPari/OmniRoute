// SPDX-License-Identifier: MIT OR Apache-2.0

//! Rule DSL, evaluation, priority, cooldowns, explanation.
//!
//! Traces to FR-RULE-001..005.

pub mod builder;
pub use builder::{describe_dsl, DslActionSpec, DslCatalog, DslConditionSpec, DslParam, DslTriggerSpec, RuleBuilder};

use chrono::{DateTime, Duration, Utc};
use focus_coaching::{complete_guarded, prompts, CoachingProvider};
use focus_domain::Rigidity;
use focus_events::{EventType, NormalizedEvent, WellKnownEventType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::warn;
use uuid::Uuid;

fn default_rigidity_hard() -> Rigidity {
    Rigidity::Hard
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: Uuid,
    pub name: String,
    pub trigger: Trigger,
    pub conditions: Vec<Condition>,
    pub actions: Vec<Action>,
    pub priority: i32,
    pub cooldown: Option<Duration>,
    pub duration: Option<Duration>,
    pub explanation_template: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Trigger {
    Event(String),    // EventType name
    Schedule(String), // cron-like
    StateChange(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub kind: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    GrantCredit {
        amount: i32,
    },
    DeductCredit {
        amount: i32,
    },
    Block {
        profile: String,
        duration: Duration,
        /// Traces to: FR-RIGIDITY-001. Defaulted to `Hard` for backward
        /// compatibility so existing serialized rules still deserialize.
        #[serde(default = "default_rigidity_hard")]
        rigidity: Rigidity,
    },
    Unblock {
        profile: String,
    },
    StreakIncrement(String),
    StreakReset(String),
    Notify(String),
    /// Break-glass exit from an active hard block. Consumes `bypass_cost`
    /// bypass budget and short-circuits the listed profiles for
    /// `duration`. Callers must surface the cost to the user first (via
    /// `quote_bypass`) and gate on explicit confirmation.
    EmergencyExit {
        profiles: Vec<String>,
        duration: Duration,
        bypass_cost: i64,
        reason: String,
    },
    /// Coaching intervention — dispatched through the mascot + notification
    /// pipe. Severity drives mascot pose/emotion on the iOS side.
    Intervention {
        message: String,
        severity: InterventionSeverity,
    },
    /// Time-boxed unblock that debits credit up front. For "I need 30 min
    /// of social media, I'll pay for it." The policy builder treats this
    /// like a scheduled Unblock starting at `starts_at`.
    ScheduledUnlockWindow {
        profile: String,
        starts_at: DateTime<Utc>,
        ends_at: DateTime<Utc>,
        credit_cost: i64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterventionSeverity {
    Gentle,
    Firm,
    Urgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleEvaluation {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub event_ids: Vec<Uuid>,
    pub evaluated_at: DateTime<Utc>,
    pub decision: RuleDecision,
    pub state_snapshot_ref: Option<String>,
    pub explanation: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RuleDecision {
    Fired(Vec<Action>),
    Suppressed { reason: String },
    Skipped { reason: String },
}

impl PartialEq for Action {
    fn eq(&self, other: &Self) -> bool {
        use Action::*;
        match (self, other) {
            (GrantCredit { amount: a }, GrantCredit { amount: b }) => a == b,
            (DeductCredit { amount: a }, DeductCredit { amount: b }) => a == b,
            (
                Block { profile: p1, duration: d1, rigidity: r1 },
                Block { profile: p2, duration: d2, rigidity: r2 },
            ) => p1 == p2 && d1 == d2 && r1 == r2,
            (Unblock { profile: p1 }, Unblock { profile: p2 }) => p1 == p2,
            (StreakIncrement(a), StreakIncrement(b)) => a == b,
            (StreakReset(a), StreakReset(b)) => a == b,
            (Notify(a), Notify(b)) => a == b,
            (
                EmergencyExit {
                    profiles: p1,
                    duration: d1,
                    bypass_cost: c1,
                    reason: r1,
                },
                EmergencyExit {
                    profiles: p2,
                    duration: d2,
                    bypass_cost: c2,
                    reason: r2,
                },
            ) => p1 == p2 && d1 == d2 && c1 == c2 && r1 == r2,
            (
                Intervention { message: m1, severity: s1 },
                Intervention { message: m2, severity: s2 },
            ) => m1 == m2 && s1 == s2,
            (
                ScheduledUnlockWindow {
                    profile: p1,
                    starts_at: s1,
                    ends_at: e1,
                    credit_cost: c1,
                },
                ScheduledUnlockWindow {
                    profile: p2,
                    starts_at: s2,
                    ends_at: e2,
                    credit_cost: c2,
                },
            ) => p1 == p2 && s1 == s2 && e1 == e2 && c1 == c2,
            _ => false,
        }
    }
}

/// Decision bundled with source rule metadata for priority aggregation.
#[derive(Debug, Clone)]
pub struct PrioritizedDecision {
    pub rule_id: Uuid,
    pub priority: i32,
    pub decision: RuleDecision,
}

pub struct RuleEngine {
    /// Per-rule last fired timestamp (for cooldown enforcement).
    cooldowns: HashMap<Uuid, DateTime<Utc>>,
}

impl RuleEngine {
    pub fn new() -> Self {
        Self { cooldowns: HashMap::new() }
    }

    /// Seed cooldowns (e.g. from persisted state).
    pub fn with_cooldowns(cooldowns: HashMap<Uuid, DateTime<Utc>>) -> Self {
        Self { cooldowns }
    }

    /// Expose cooldown map for persistence (read-only).
    pub fn cooldowns(&self) -> &HashMap<Uuid, DateTime<Utc>> {
        &self.cooldowns
    }

    /// Evaluate a single rule against a single event at `now`.
    ///
    /// Deterministic given (rule, event, cooldown state, now).
    /// Traces to: FR-RULE-001, FR-RULE-002, FR-RULE-003.
    pub fn evaluate(
        &mut self,
        rule: &Rule,
        event: &NormalizedEvent,
        now: DateTime<Utc>,
    ) -> RuleDecision {
        // FR-RULE-001: disabled rules skip.
        if !rule.enabled {
            return RuleDecision::Skipped { reason: "disabled".into() };
        }

        // FR-RULE-001: trigger must match event.
        match &rule.trigger {
            Trigger::Event(expected) => {
                if !event_type_matches(&event.event_type, expected) {
                    return RuleDecision::Skipped { reason: "trigger_mismatch".into() };
                }
            }
            Trigger::Schedule(_) | Trigger::StateChange(_) => {
                return RuleDecision::Skipped { reason: "non_event_trigger".into() };
            }
        }

        // FR-RULE-003: evaluate conditions (best-effort built-ins).
        for cond in &rule.conditions {
            if !condition_matches(cond, event) {
                return RuleDecision::Skipped { reason: format!("condition_failed:{}", cond.kind) };
            }
        }

        // FR-RULE-002: cooldown check.
        if let Some(cooldown) = rule.cooldown {
            if let Some(last) = self.cooldowns.get(&rule.id) {
                if now.signed_duration_since(*last) < cooldown {
                    return RuleDecision::Suppressed { reason: "cooldown".into() };
                }
            }
        }

        // Fire.
        self.cooldowns.insert(rule.id, now);
        RuleDecision::Fired(rule.actions.clone())
    }

    /// Evaluate `rule` against `event` and return both the decision and a
    /// persistable [`RuleEvaluation`] record. Use this variant when the caller
    /// wants to store the evaluation audit (firing history, suppressed
    /// streaks, explanation strings) rather than only react to the decision.
    ///
    /// Traces to: FR-RULE-001/002/003, FR-RULE-006 (evaluation audit trail).
    pub fn evaluate_with_trace(
        &mut self,
        rule: &Rule,
        event: &NormalizedEvent,
        now: DateTime<Utc>,
    ) -> (RuleDecision, RuleEvaluation) {
        let decision = self.evaluate(rule, event, now);
        let explanation = explain_decision(rule, &decision);
        let eval = RuleEvaluation {
            id: Uuid::new_v4(),
            rule_id: rule.id,
            event_ids: vec![event.event_id],
            evaluated_at: now,
            decision: decision.clone(),
            state_snapshot_ref: None,
            explanation,
        };
        (decision, eval)
    }

    /// Schedule-tick variant of [`Self::evaluate_with_trace`]. `event_ids` is left
    /// empty because there is no originating event — the trigger is the tick.
    pub fn evaluate_schedule_tick_with_trace(
        &mut self,
        rule: &Rule,
        now: DateTime<Utc>,
    ) -> (RuleDecision, RuleEvaluation) {
        let decision = self.evaluate_schedule_tick(rule, now);
        let explanation = explain_decision(rule, &decision);
        let eval = RuleEvaluation {
            id: Uuid::new_v4(),
            rule_id: rule.id,
            event_ids: vec![],
            evaluated_at: now,
            decision: decision.clone(),
            state_snapshot_ref: None,
            explanation,
        };
        (decision, eval)
    }

    /// FR-RULE-007 — evaluate a state-change-triggered rule. Fires when the
    /// dotted `key` path resolves to different JSON values between `before`
    /// and `after`. Returns [`RuleDecision::Skipped`] for non-StateChange
    /// triggers or when the key is absent in both snapshots. Cooldown map
    /// still applies: a second transition within the cooldown window is
    /// [`RuleDecision::Suppressed`].
    ///
    /// Example key: `"wallet.balance"`, `"penalty.tier"`,
    /// `"rituals.morning_brief.intention"`.
    pub fn evaluate_state_change(
        &mut self,
        rule: &Rule,
        before: &serde_json::Value,
        after: &serde_json::Value,
        now: DateTime<Utc>,
    ) -> RuleDecision {
        if !rule.enabled {
            return RuleDecision::Skipped { reason: "disabled".into() };
        }
        let key = match &rule.trigger {
            Trigger::StateChange(k) => k,
            _ => return RuleDecision::Skipped { reason: "non_state_change_trigger".into() },
        };
        let b = resolve_path(before, key);
        let a = resolve_path(after, key);
        if b == a {
            return RuleDecision::Skipped { reason: "no_change".into() };
        }
        // Cooldown check (identical to event eval).
        if let Some(cooldown) = rule.cooldown {
            if let Some(last) = self.cooldowns.get(&rule.id) {
                if now.signed_duration_since(*last) < cooldown {
                    return RuleDecision::Suppressed { reason: "cooldown".into() };
                }
            }
        }
        self.cooldowns.insert(rule.id, now);
        RuleDecision::Fired(rule.actions.clone())
    }

    /// State-change variant of [`Self::evaluate_with_trace`].
    pub fn evaluate_state_change_with_trace(
        &mut self,
        rule: &Rule,
        before: &serde_json::Value,
        after: &serde_json::Value,
        now: DateTime<Utc>,
    ) -> (RuleDecision, RuleEvaluation) {
        let decision = self.evaluate_state_change(rule, before, after, now);
        let explanation = explain_decision(rule, &decision);
        let eval = RuleEvaluation {
            id: Uuid::new_v4(),
            rule_id: rule.id,
            event_ids: vec![],
            evaluated_at: now,
            decision: decision.clone(),
            state_snapshot_ref: Some(match &rule.trigger {
                Trigger::StateChange(k) => k.clone(),
                _ => String::new(),
            }),
            explanation,
        };
        (decision, eval)
    }

    /// FR-RULE-005 — evaluate a schedule-triggered rule against a wall-clock
    /// tick. The rule fires when `now` matches `Trigger::Schedule(cron)` and
    /// the last fire (if any) is strictly before the most recent scheduled
    /// slot. Returns [`RuleDecision::Skipped`] for non-Schedule triggers so
    /// the caller can run this blindly across all rules.
    ///
    /// Cron syntax is the standard 6-field form (sec min hour dom mon dow)
    /// used by the `cron` crate. Examples:
    /// - `"0 0 9 * * *"` — every day at 09:00:00.
    /// - `"0 */15 * * * *"` — every 15 minutes on the minute.
    pub fn evaluate_schedule_tick(
        &mut self,
        rule: &Rule,
        now: DateTime<Utc>,
    ) -> RuleDecision {
        if !rule.enabled {
            return RuleDecision::Skipped { reason: "disabled".into() };
        }
        let cron_spec = match &rule.trigger {
            Trigger::Schedule(s) => s,
            _ => return RuleDecision::Skipped { reason: "non_schedule_trigger".into() },
        };
        let schedule = match cron_spec.parse::<cron::Schedule>() {
            Ok(s) => s,
            Err(e) => {
                return RuleDecision::Skipped {
                    reason: format!("bad_cron:{e}"),
                };
            }
        };
        // Most recent scheduled slot at or before `now`.
        let Some(most_recent) = schedule.after(&(now - chrono::Duration::days(365))).take_while(|t| *t <= now).last() else {
            return RuleDecision::Skipped { reason: "no_slot_in_window".into() };
        };
        // Dedupe against cooldown map, treating the slot as the firing key.
        if let Some(last) = self.cooldowns.get(&rule.id) {
            if *last >= most_recent {
                return RuleDecision::Suppressed { reason: "already_fired_for_slot".into() };
            }
        }
        self.cooldowns.insert(rule.id, most_recent);
        RuleDecision::Fired(rule.actions.clone())
    }

    /// Evaluate many rules; returns all decisions in input order alongside
    /// an aggregated winner per (profile, conflict-class).
    ///
    /// Traces to: FR-RULE-004 (priority conflict resolution).
    pub fn evaluate_all(
        &mut self,
        rules: &[Rule],
        event: &NormalizedEvent,
        now: DateTime<Utc>,
    ) -> Vec<PrioritizedDecision> {
        let mut out = Vec::with_capacity(rules.len());
        // Sort by priority descending so higher-priority rules evaluate first
        // and can "win" cooldown-free slots. Preserve input order for ties.
        let mut indexed: Vec<(usize, &Rule)> = rules.iter().enumerate().collect();
        indexed.sort_by(|a, b| b.1.priority.cmp(&a.1.priority).then(a.0.cmp(&b.0)));
        for (_, rule) in indexed {
            let decision = self.evaluate(rule, event, now);
            out.push(PrioritizedDecision { rule_id: rule.id, priority: rule.priority, decision });
        }
        out
    }

    /// Render a rule's explanation template, substituting placeholders.
    /// Traces to: FR-RULE-005.
    pub fn render_explanation(rule: &Rule, event: &NormalizedEvent) -> String {
        let event_type = event_type_name(&event.event_type);
        rule.explanation_template
            .replace("{rule_name}", &rule.name)
            .replace("{event_type}", &event_type)
            .replace("{event_id}", &event.event_id.to_string())
    }
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Ask the LLM to convert a natural-language rule spec into a [`Rule`].
pub async fn propose_rule_from_nl(
    nl_spec: &str,
    coaching: &dyn CoachingProvider,
) -> anyhow::Result<Rule> {
    let system = prompts::rule_authoring_prompt();
    let out = complete_guarded(coaching, nl_spec, Some(&system), 800)
        .await?
        .ok_or_else(|| anyhow::anyhow!("coaching provider returned no content"))?;
    let trimmed = out
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str::<Rule>(trimmed)
        .map_err(|e| anyhow::anyhow!("LLM returned invalid Rule JSON: {e}; raw output: {out}"))
}

/// Rewrite a rule's explanation template via the LLM, grounded in the event
/// payload. Falls back to the static [`RuleEngine::render_explanation`] on
/// any failure (kill switch, empty response, transport error).
pub async fn render_llm_explanation(
    rule: &Rule,
    event: &NormalizedEvent,
    coaching: &dyn CoachingProvider,
) -> anyhow::Result<String> {
    let fallback = RuleEngine::render_explanation(rule, event);
    let payload = serde_json::to_string(&event.payload).unwrap_or_else(|_| "{}".into());
    let user = format!(
        "Rule name: {}\nStatic template: {}\nEvent type: {}\nEvent payload JSON: {}",
        rule.name,
        rule.explanation_template,
        event_type_name(&event.event_type),
        payload,
    );
    match complete_guarded(coaching, &user, Some(prompts::RULE_EXPLANATION_SYSTEM_PROMPT), 220)
        .await
    {
        Ok(Some(text)) => Ok(text),
        Ok(None) => Ok(fallback),
        Err(e) => {
            warn!(target: "coaching.fallback", error = %e, "explanation LLM error");
            Ok(fallback)
        }
    }
}

/// Match an event's type against a rule trigger pattern.
///
/// Supports:
/// * exact match on `EventType::to_string()` (e.g. `"AssignmentDue"`,
///   `"canvas:quiz_posted"`)
/// * trailing glob, where `"canvas:*"` matches any `Custom("canvas:...")`.
///
/// Traces to: FR-EVT-VOCAB-001, FR-RULE-001.
fn event_type_matches(et: &EventType, expected: &str) -> bool {
    let name = event_type_name(et);
    if let Some(prefix) = expected.strip_suffix('*') {
        name.starts_with(prefix)
    } else {
        name == expected
    }
}

fn event_type_name(et: &EventType) -> String {
    et.to_string()
}

// Keep the WellKnownEventType import referenced so the re-export in other
// modules doesn't dead-code out via the pub-use path.
#[allow(dead_code)]
type _KeepWellKnown = WellKnownEventType;

/// Built-in condition kinds:
///   * `confidence_gte`   — params.min: f32
///   * `payload_eq`       — params.path: str, params.value: any
///   * `payload_in`       — params.path: str, params.values: array
///   * `payload_gte`      — params.path: str, params.min: number
///   * `payload_lte`      — params.path: str, params.max: number
///   * `payload_exists`   — params.path: str
///   * `payload_matches`  — params.path: str, params.pattern: regex
///   * `source_eq`        — params.source: str (matches NormalizedEvent.source)
///   * `occurred_within`  — params.seconds: u64 (occurred_at within last N from now)
///   * `all_of`           — params.conditions: `array<Condition>` (AND)
///   * `any_of`           — params.conditions: `array<Condition>` (OR)
///   * `not`              — params.condition: Condition (negate)
///
/// Paths support dotted access (e.g. `"assignment.points"`).
///
/// Unknown kinds are treated as "pass" (forward-compat).
fn condition_matches(cond: &Condition, event: &NormalizedEvent) -> bool {
    match cond.kind.as_str() {
        "confidence_gte" => cond
            .params
            .get("min")
            .and_then(|v| v.as_f64())
            .map(|min| event.confidence as f64 >= min)
            .unwrap_or(false),
        "payload_eq" => {
            let Some(path) = cond.params.get("path").and_then(|v| v.as_str()) else {
                return false;
            };
            let Some(expected) = cond.params.get("value") else {
                return false;
            };
            resolve_path(&event.payload, path).map(|v| v == expected).unwrap_or(false)
        }
        "payload_in" => {
            let Some(path) = cond.params.get("path").and_then(|v| v.as_str()) else {
                return false;
            };
            let Some(values) = cond.params.get("values").and_then(|v| v.as_array()) else {
                return false;
            };
            resolve_path(&event.payload, path)
                .map(|got| values.iter().any(|v| v == got))
                .unwrap_or(false)
        }
        "payload_gte" | "payload_lte" => {
            let Some(path) = cond.params.get("path").and_then(|v| v.as_str()) else {
                return false;
            };
            let key = if cond.kind == "payload_gte" { "min" } else { "max" };
            let Some(threshold) = cond.params.get(key).and_then(|v| v.as_f64()) else {
                return false;
            };
            resolve_path(&event.payload, path)
                .and_then(|v| v.as_f64())
                .map(|got| {
                    if cond.kind == "payload_gte" {
                        got >= threshold
                    } else {
                        got <= threshold
                    }
                })
                .unwrap_or(false)
        }
        "payload_exists" => {
            let Some(path) = cond.params.get("path").and_then(|v| v.as_str()) else {
                return false;
            };
            resolve_path(&event.payload, path).is_some()
        }
        "payload_matches" => {
            let Some(path) = cond.params.get("path").and_then(|v| v.as_str()) else {
                return false;
            };
            let Some(pattern) = cond.params.get("pattern").and_then(|v| v.as_str()) else {
                return false;
            };
            let Ok(re) = regex::Regex::new(pattern) else {
                return false;
            };
            resolve_path(&event.payload, path)
                .and_then(|v| v.as_str())
                .map(|s| re.is_match(s))
                .unwrap_or(false)
        }
        "source_eq" => cond
            .params
            .get("source")
            .and_then(|v| v.as_str())
            .map(|s| event.connector_id == s)
            .unwrap_or(false),
        "occurred_within" => cond
            .params
            .get("seconds")
            .and_then(|v| v.as_u64())
            .map(|secs| {
                // Evaluate against Utc::now() — the one time-sensitive condition;
                // acceptable for the engine to read the clock here.
                let age = Utc::now().signed_duration_since(event.occurred_at);
                age.num_seconds() >= 0 && (age.num_seconds() as u64) <= secs
            })
            .unwrap_or(false),
        "all_of" => cond
            .params
            .get("conditions")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().all(|c| parse_sub(c).map(|s| condition_matches(&s, event)).unwrap_or(false)))
            .unwrap_or(false),
        "any_of" => cond
            .params
            .get("conditions")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().any(|c| parse_sub(c).map(|s| condition_matches(&s, event)).unwrap_or(false)))
            .unwrap_or(false),
        "not" => cond
            .params
            .get("condition")
            .and_then(parse_sub)
            .map(|s| !condition_matches(&s, event))
            .unwrap_or(false),
        _ => true,
    }
}

/// Render a short, user-visible explanation for a rule decision. Uses the
/// rule's `explanation_template` as the base (rendered via the existing
/// `render_explanation` helper) for Fired, and a short reason-only line for
/// Suppressed / Skipped — persistable as `RuleEvaluation.explanation`.
fn explain_decision(rule: &Rule, decision: &RuleDecision) -> String {
    match decision {
        RuleDecision::Fired(_) => {
            if rule.explanation_template.is_empty() {
                format!("Rule '{}' fired.", rule.name)
            } else {
                rule.explanation_template.clone()
            }
        }
        RuleDecision::Suppressed { reason } => {
            format!("Rule '{}' suppressed: {reason}.", rule.name)
        }
        RuleDecision::Skipped { reason } => {
            format!("Rule '{}' skipped: {reason}.", rule.name)
        }
    }
}

/// Dotted-path access into a JSON object (`"a.b.c"` → `root["a"]["b"]["c"]`).
/// Returns `None` if any segment is missing or a non-object is traversed.
fn resolve_path<'a>(root: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut cur = root;
    for seg in path.split('.') {
        cur = cur.get(seg)?;
    }
    Some(cur)
}

fn parse_sub(v: &serde_json::Value) -> Option<Condition> {
    serde_json::from_value::<Condition>(v.clone()).ok()
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use focus_events::DedupeKey;
    use serde_json::json;

    fn mk_event(et: EventType, confidence: f32, payload: serde_json::Value) -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::nil(),
            connector_id: "test".into(),
            account_id: Uuid::nil(),
            event_type: et,
            occurred_at: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            effective_at: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            dedupe_key: DedupeKey("k".into()),
            confidence,
            payload,
            raw_ref: None,
        }
    }

    fn mk_rule(name: &str, trigger: &str, actions: Vec<Action>, priority: i32) -> Rule {
        Rule {
            id: Uuid::new_v4(),
            name: name.into(),
            trigger: Trigger::Event(trigger.into()),
            conditions: vec![],
            actions,
            priority,
            cooldown: None,
            duration: None,
            explanation_template: "{rule_name} fired on {event_type}".into(),
            enabled: true,
        }
    }

    // Traces to: FR-RULE-001
    #[test]
    fn disabled_rule_is_skipped() {
        let mut eng = RuleEngine::new();
        let mut rule = mk_rule("r", "TaskCompleted", vec![], 0);
        rule.enabled = false;
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        assert!(matches!(eng.evaluate(&rule, &ev, now), RuleDecision::Skipped { .. }));
    }

    // Traces to: FR-RULE-001
    #[test]
    fn trigger_mismatch_is_skipped() {
        let mut eng = RuleEngine::new();
        let rule = mk_rule("r", "TaskCompleted", vec![], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::SleepRecorded), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        match eng.evaluate(&rule, &ev, now) {
            RuleDecision::Skipped { reason } => assert_eq!(reason, "trigger_mismatch"),
            o => panic!("unexpected: {o:?}"),
        }
    }

    // Traces to: FR-RULE-001
    #[test]
    fn matching_event_fires_rule() {
        let mut eng = RuleEngine::new();
        let rule = mk_rule("r", "TaskCompleted", vec![Action::GrantCredit { amount: 5 }], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        match eng.evaluate(&rule, &ev, now) {
            RuleDecision::Fired(actions) => {
                assert_eq!(actions, vec![Action::GrantCredit { amount: 5 }])
            }
            o => panic!("unexpected: {o:?}"),
        }
    }

    // Traces to: FR-RULE-002
    #[test]
    fn cooldown_suppresses_repeat_within_window() {
        let mut eng = RuleEngine::new();
        let mut rule = mk_rule("r", "TaskCompleted", vec![Action::GrantCredit { amount: 1 }], 0);
        rule.cooldown = Some(Duration::minutes(10));
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let t0 = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        assert!(matches!(eng.evaluate(&rule, &ev, t0), RuleDecision::Fired(_)));
        let t1 = t0 + Duration::minutes(5);
        match eng.evaluate(&rule, &ev, t1) {
            RuleDecision::Suppressed { reason } => assert_eq!(reason, "cooldown"),
            o => panic!("unexpected: {o:?}"),
        }
    }

    // Traces to: FR-RULE-002
    #[test]
    fn cooldown_expires_allows_refire() {
        let mut eng = RuleEngine::new();
        let mut rule = mk_rule("r", "TaskCompleted", vec![Action::GrantCredit { amount: 1 }], 0);
        rule.cooldown = Some(Duration::minutes(10));
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let t0 = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        let _ = eng.evaluate(&rule, &ev, t0);
        let t2 = t0 + Duration::minutes(11);
        assert!(matches!(eng.evaluate(&rule, &ev, t2), RuleDecision::Fired(_)));
    }

    // Traces to: FR-RULE-003
    #[test]
    fn condition_confidence_gate_filters() {
        let mut eng = RuleEngine::new();
        let mut rule = mk_rule("r", "TaskCompleted", vec![], 0);
        rule.conditions
            .push(Condition { kind: "confidence_gte".into(), params: json!({"min": 0.9}) });
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 0.5, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        match eng.evaluate(&rule, &ev, now) {
            RuleDecision::Skipped { reason } => {
                assert!(reason.starts_with("condition_failed"))
            }
            o => panic!("unexpected: {o:?}"),
        }
    }

    // Traces to: FR-RULE-005
    #[test]
    fn explanation_template_substitutes_placeholders() {
        let rule = mk_rule("MyRule", "TaskCompleted", vec![], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let rendered = RuleEngine::render_explanation(&rule, &ev);
        assert!(rendered.contains("MyRule"));
        assert!(rendered.contains("TaskCompleted"));
    }

    // Traces to: FR-RULE-004
    #[test]
    fn evaluate_all_orders_by_priority_desc() {
        let mut eng = RuleEngine::new();
        let low =
            mk_rule("low", "TaskCompleted", vec![Action::Unblock { profile: "games".into() }], 1);
        let high = mk_rule(
            "high",
            "TaskCompleted",
            vec![Action::Block {
                profile: "games".into(),
                duration: Duration::minutes(30),
                rigidity: Rigidity::Hard,
            }],
            100,
        );
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        let decisions = eng.evaluate_all(&[low, high], &ev, now);
        assert_eq!(decisions.len(), 2);
        assert_eq!(decisions[0].priority, 100);
        assert_eq!(decisions[1].priority, 1);
    }

    // Traces to: FR-EVT-VOCAB-001, FR-RULE-001
    #[test]
    fn trigger_exact_match_against_custom_event_type() {
        let mut eng = RuleEngine::new();
        let rule = mk_rule("r", "canvas:quiz_posted", vec![Action::GrantCredit { amount: 1 }], 0);
        let ev = mk_event(EventType::Custom("canvas:quiz_posted".into()), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        assert!(matches!(eng.evaluate(&rule, &ev, now), RuleDecision::Fired(_)));
    }

    // Traces to: FR-EVT-VOCAB-001, FR-RULE-001
    #[test]
    fn trigger_prefix_glob_matches_custom_namespace() {
        let mut eng = RuleEngine::new();
        let rule = mk_rule("r", "canvas:*", vec![Action::GrantCredit { amount: 1 }], 0);
        let ev = mk_event(EventType::Custom("canvas:quiz_posted".into()), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        assert!(matches!(eng.evaluate(&rule, &ev, now), RuleDecision::Fired(_)));
    }

    // Traces to: FR-EVT-VOCAB-001, FR-RULE-001
    #[test]
    fn trigger_prefix_glob_rejects_out_of_namespace_custom() {
        let mut eng = RuleEngine::new();
        let rule = mk_rule("r", "canvas:*", vec![Action::GrantCredit { amount: 1 }], 0);
        let ev = mk_event(EventType::Custom("slack:message".into()), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        match eng.evaluate(&rule, &ev, now) {
            RuleDecision::Skipped { reason } => assert_eq!(reason, "trigger_mismatch"),
            o => panic!("unexpected: {o:?}"),
        }
    }

    // Traces to: FR-RULE-001, FR-RULE-002
    #[test]
    fn evaluate_is_deterministic() {
        let mut eng_a = RuleEngine::new();
        let mut eng_b = RuleEngine::new();
        let rule = mk_rule("r", "TaskCompleted", vec![Action::GrantCredit { amount: 7 }], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap();
        let a = eng_a.evaluate(&rule, &ev, now);
        let b = eng_b.evaluate(&rule, &ev, now);
        assert_eq!(format!("{a:?}"), format!("{b:?}"));
    }

    // -----------------------------------------------------------------------
    // LLM coaching integration tests (Stub provider)
    // -----------------------------------------------------------------------

    use focus_coaching::{NoopCoachingProvider, StubCoachingProvider};

    fn sample_rule_json() -> String {
        let id = Uuid::new_v4();
        serde_json::json!({
            "id": id.to_string(),
            "name": "Reward homework",
            "trigger": {"Event": "TaskCompleted"},
            "conditions": [],
            "actions": [{"GrantCredit": {"amount": 5}}],
            "priority": 10,
            "cooldown": null,
            "duration": null,
            "explanation_template": "{rule_name} fired on {event_type}",
            "enabled": true
        })
        .to_string()
    }

    #[tokio::test]
    async fn propose_rule_parses_valid_llm_json() {
        let provider = StubCoachingProvider::single(sample_rule_json());
        let rule = propose_rule_from_nl("give me 5 credits per task completion", &provider)
            .await
            .expect("parse");
        assert_eq!(rule.name, "Reward homework");
        assert_eq!(rule.priority, 10);
    }

    #[tokio::test]
    async fn propose_rule_strips_markdown_fences() {
        let fenced = format!("```json\n{}\n```", sample_rule_json());
        let provider = StubCoachingProvider::single(fenced);
        let rule = propose_rule_from_nl("x", &provider).await.expect("parse");
        assert_eq!(rule.name, "Reward homework");
    }

    #[tokio::test]
    async fn propose_rule_errors_on_garbage() {
        let provider = StubCoachingProvider::single("not even close to json");
        let err = propose_rule_from_nl("whatever", &provider).await.unwrap_err();
        assert!(err.to_string().contains("invalid Rule JSON"));
    }

    #[tokio::test]
    async fn propose_rule_errors_on_noop() {
        let provider = NoopCoachingProvider;
        let err = propose_rule_from_nl("x", &provider).await.unwrap_err();
        assert!(err.to_string().contains("no content"));
    }

    #[tokio::test]
    async fn render_llm_explanation_uses_provider_text() {
        let provider = StubCoachingProvider::single(
            "You finished the assignment — +5 credits banked.".to_string(),
        );
        let rule = mk_rule("Reward", "TaskCompleted", vec![], 0);
        let ev = mk_event(
            EventType::WellKnown(WellKnownEventType::TaskCompleted),
            1.0,
            json!({"title": "Essay"}),
        );
        let out = render_llm_explanation(&rule, &ev, &provider).await.expect("explain");
        assert!(out.contains("+5 credits"));
    }

    #[tokio::test]
    async fn render_llm_explanation_falls_back_when_noop() {
        let rule = mk_rule("Reward", "TaskCompleted", vec![], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let provider = NoopCoachingProvider;
        let out = render_llm_explanation(&rule, &ev, &provider).await.expect("explain");
        assert!(out.contains("Reward"));
    }

    // Traces to: FR-RULE-005 (schedule-triggered rules)
    fn mk_schedule_rule(cron: &str) -> Rule {
        Rule {
            id: Uuid::new_v4(),
            name: "Daily Reset".into(),
            trigger: Trigger::Schedule(cron.into()),
            conditions: vec![],
            actions: vec![Action::Notify("reset".into())],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "Scheduled".into(),
            enabled: true,
        }
    }

    #[test]
    fn schedule_tick_fires_when_now_is_past_most_recent_slot() {
        let mut eng = RuleEngine::default();
        // 09:00 UTC every day
        let rule = mk_schedule_rule("0 0 9 * * *");
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        assert!(matches!(eng.evaluate_schedule_tick(&rule, now), RuleDecision::Fired(_)));
    }

    #[test]
    fn schedule_tick_suppresses_duplicate_fire_within_slot() {
        let mut eng = RuleEngine::default();
        let rule = mk_schedule_rule("0 0 9 * * *");
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        assert!(matches!(eng.evaluate_schedule_tick(&rule, now), RuleDecision::Fired(_)));
        let second = eng.evaluate_schedule_tick(&rule, now + Duration::minutes(5));
        assert!(matches!(second, RuleDecision::Suppressed { .. }));
    }

    #[test]
    fn schedule_tick_refires_on_next_slot() {
        let mut eng = RuleEngine::default();
        let rule = mk_schedule_rule("0 0 9 * * *");
        let d1 = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        let d2 = Utc.with_ymd_and_hms(2026, 4, 24, 9, 30, 0).unwrap();
        assert!(matches!(eng.evaluate_schedule_tick(&rule, d1), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate_schedule_tick(&rule, d2), RuleDecision::Fired(_)));
    }

    #[test]
    fn schedule_tick_skips_event_triggered_rule() {
        let mut eng = RuleEngine::default();
        let rule = mk_rule("Evt", "TaskCompleted", vec![], 0);
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        assert!(matches!(
            eng.evaluate_schedule_tick(&rule, now),
            RuleDecision::Skipped { .. }
        ));
    }

    #[test]
    fn schedule_tick_rejects_malformed_cron() {
        let mut eng = RuleEngine::default();
        let rule = mk_schedule_rule("not a cron");
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        match eng.evaluate_schedule_tick(&rule, now) {
            RuleDecision::Skipped { reason } => assert!(reason.starts_with("bad_cron")),
            other => panic!("expected Skipped bad_cron, got {other:?}"),
        }
    }

    // Traces to: FR-RULE-003 (condition DSL)
    fn cond(kind: &str, params: serde_json::Value) -> Condition {
        Condition { kind: kind.into(), params }
    }

    // Traces to: FR-RULE-006 (evaluation audit trail)
    #[test]
    fn evaluate_with_trace_fired_carries_template_explanation() {
        let mut eng = RuleEngine::default();
        let mut rule = mk_rule("Reward", "TaskCompleted", vec![], 0);
        rule.explanation_template = "Good job on {{event.type}}".into();
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        let (decision, eval) = eng.evaluate_with_trace(&rule, &ev, Utc::now());
        assert!(matches!(decision, RuleDecision::Fired(_)));
        assert_eq!(eval.rule_id, rule.id);
        assert_eq!(eval.event_ids, vec![ev.event_id]);
        assert!(eval.explanation.contains("Good job"));
    }

    #[test]
    fn evaluate_with_trace_skipped_has_reason_explanation() {
        let mut eng = RuleEngine::default();
        let rule = mk_rule("X", "TaskCompleted", vec![], 0);
        let ev = mk_event(EventType::WellKnown(WellKnownEventType::AssignmentDue), 1.0, json!({}));
        let (decision, eval) = eng.evaluate_with_trace(&rule, &ev, Utc::now());
        assert!(matches!(decision, RuleDecision::Skipped { .. }));
        assert!(eval.explanation.contains("skipped"));
    }

    #[test]
    fn evaluate_schedule_tick_with_trace_has_empty_event_ids() {
        let mut eng = RuleEngine::default();
        let rule = mk_schedule_rule("0 0 9 * * *");
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        let (decision, eval) = eng.evaluate_schedule_tick_with_trace(&rule, now);
        assert!(matches!(decision, RuleDecision::Fired(_)));
        assert!(eval.event_ids.is_empty());
        assert_eq!(eval.rule_id, rule.id);
    }

    #[test]
    fn payload_dotted_path_resolution() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_eq", json!({"path":"assignment.late","value":true})));
            r
        };
        let ev_late = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"assignment":{"late":true}}));
        let ev_not = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"assignment":{"late":false}}));
        assert!(matches!(eng.evaluate(&rule, &ev_late, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&rule, &ev_not, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn payload_in_matches_enum() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_in", json!({"path":"status","values":["done","graded"]})));
            r
        };
        let ev_done = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"status":"done"}));
        let ev_other = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"status":"draft"}));
        assert!(matches!(eng.evaluate(&rule, &ev_done, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&rule, &ev_other, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn payload_gte_lte_thresholds() {
        let mut eng = RuleEngine::default();
        let gte = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_gte", json!({"path":"points","min":80.0})));
            r
        };
        let lte = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_lte", json!({"path":"points","max":50.0})));
            r
        };
        let ev90 = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"points":90.0}));
        let ev40 = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"points":40.0}));
        assert!(matches!(eng.evaluate(&gte, &ev90, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&gte, &ev40, Utc::now()), RuleDecision::Skipped { .. }));
        assert!(matches!(eng.evaluate(&lte, &ev40, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&lte, &ev90, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn payload_matches_regex() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_matches", json!({"path":"url","pattern":r"^https://.*\.edu/"})));
            r
        };
        let ev_ok = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"url":"https://mit.edu/assign/1"}));
        let ev_no = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"url":"http://example.com/"}));
        assert!(matches!(eng.evaluate(&rule, &ev_ok, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&rule, &ev_no, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn any_of_and_not_compose() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond(
                "all_of",
                json!({"conditions":[
                    {"kind":"any_of","params":{"conditions":[
                        {"kind":"payload_eq","params":{"path":"kind","value":"a"}},
                        {"kind":"payload_eq","params":{"path":"kind","value":"b"}}
                    ]}},
                    {"kind":"not","params":{"condition":{"kind":"payload_eq","params":{"path":"blocked","value":true}}}}
                ]}),
            ));
            r
        };
        let yes = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"kind":"a","blocked":false}));
        let no_blocked = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"kind":"a","blocked":true}));
        let no_kind = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"kind":"c","blocked":false}));
        assert!(matches!(eng.evaluate(&rule, &yes, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&rule, &no_blocked, Utc::now()), RuleDecision::Skipped { .. }));
        assert!(matches!(eng.evaluate(&rule, &no_kind, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn payload_exists_true_when_present_null_ok() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("payload_exists", json!({"path":"maybe"})));
            r
        };
        let ev_null = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({"maybe":null}));
        let ev_missing = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        assert!(matches!(eng.evaluate(&rule, &ev_null, Utc::now()), RuleDecision::Fired(_)));
        assert!(matches!(eng.evaluate(&rule, &ev_missing, Utc::now()), RuleDecision::Skipped { .. }));
    }

    #[test]
    fn source_eq_matches_event_source() {
        let mut eng = RuleEngine::default();
        let rule = {
            let mut r = mk_rule("x", "TaskCompleted", vec![], 0);
            r.conditions.push(cond("source_eq", json!({"source":"canvas"})));
            r
        };
        let mut ev = mk_event(EventType::WellKnown(WellKnownEventType::TaskCompleted), 1.0, json!({}));
        ev.connector_id = "canvas".into();
        assert!(matches!(eng.evaluate(&rule, &ev, Utc::now()), RuleDecision::Fired(_)));
        ev.connector_id = "gcal".into();
        assert!(matches!(eng.evaluate(&rule, &ev, Utc::now()), RuleDecision::Skipped { .. }));
    }

    // Traces to: FR-RULE-008 (expanded Action catalog)
    #[test]
    fn emergency_exit_roundtrips_serde() {
        let a = Action::EmergencyExit {
            profiles: vec!["social".into(), "games".into()],
            duration: Duration::minutes(15),
            bypass_cost: 25,
            reason: "medical".into(),
        };
        let s = serde_json::to_string(&a).unwrap();
        let back: Action = serde_json::from_str(&s).unwrap();
        assert_eq!(a, back);
    }

    #[test]
    fn intervention_severity_roundtrips_serde() {
        for sev in [
            InterventionSeverity::Gentle,
            InterventionSeverity::Firm,
            InterventionSeverity::Urgent,
        ] {
            let a = Action::Intervention { message: "take a walk".into(), severity: sev };
            let s = serde_json::to_string(&a).unwrap();
            let back: Action = serde_json::from_str(&s).unwrap();
            assert_eq!(a, back);
        }
    }

    #[test]
    fn scheduled_unlock_window_roundtrips_serde() {
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 12, 0, 0).unwrap();
        let a = Action::ScheduledUnlockWindow {
            profile: "social".into(),
            starts_at: now,
            ends_at: now + Duration::minutes(30),
            credit_cost: 10,
        };
        let s = serde_json::to_string(&a).unwrap();
        let back: Action = serde_json::from_str(&s).unwrap();
        assert_eq!(a, back);
    }

    // Traces to: FR-RULE-007 (state-change triggers)
    fn mk_state_rule(key: &str) -> Rule {
        Rule {
            id: Uuid::new_v4(),
            name: "Wallet hit zero".into(),
            trigger: Trigger::StateChange(key.into()),
            conditions: vec![],
            actions: vec![Action::Notify("wallet empty".into())],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "State change".into(),
            enabled: true,
        }
    }

    #[test]
    fn state_change_fires_on_value_transition() {
        let mut eng = RuleEngine::default();
        let rule = mk_state_rule("wallet.balance");
        let before = json!({"wallet":{"balance":5}});
        let after = json!({"wallet":{"balance":0}});
        let d = eng.evaluate_state_change(&rule, &before, &after, Utc::now());
        assert!(matches!(d, RuleDecision::Fired(_)));
    }

    #[test]
    fn state_change_skips_when_value_equal() {
        let mut eng = RuleEngine::default();
        let rule = mk_state_rule("wallet.balance");
        let before = json!({"wallet":{"balance":5}});
        let after = json!({"wallet":{"balance":5}});
        match eng.evaluate_state_change(&rule, &before, &after, Utc::now()) {
            RuleDecision::Skipped { reason } => assert_eq!(reason, "no_change"),
            other => panic!("expected Skipped no_change, got {other:?}"),
        }
    }

    #[test]
    fn state_change_skips_non_state_trigger() {
        let mut eng = RuleEngine::default();
        let rule = mk_rule("x", "TaskCompleted", vec![], 0);
        let before = json!({});
        let after = json!({"wallet":{"balance":5}});
        let d = eng.evaluate_state_change(&rule, &before, &after, Utc::now());
        assert!(matches!(d, RuleDecision::Skipped { .. }));
    }

    #[test]
    fn state_change_respects_cooldown() {
        let mut eng = RuleEngine::default();
        let mut rule = mk_state_rule("penalty.tier");
        rule.cooldown = Some(Duration::minutes(10));
        let t0 = Utc.with_ymd_and_hms(2026, 4, 23, 9, 0, 0).unwrap();
        let a = json!({"penalty":{"tier":"Clear"}});
        let b = json!({"penalty":{"tier":"Warn"}});
        let c = json!({"penalty":{"tier":"Strict"}});
        assert!(matches!(eng.evaluate_state_change(&rule, &a, &b, t0), RuleDecision::Fired(_)));
        // 5 min later, another transition → within cooldown.
        let d = eng.evaluate_state_change(&rule, &b, &c, t0 + Duration::minutes(5));
        assert!(matches!(d, RuleDecision::Suppressed { .. }));
    }

    #[test]
    fn state_change_with_trace_carries_snapshot_ref() {
        let mut eng = RuleEngine::default();
        let rule = mk_state_rule("wallet.balance");
        let before = json!({"wallet":{"balance":5}});
        let after = json!({"wallet":{"balance":0}});
        let (_, eval) = eng.evaluate_state_change_with_trace(&rule, &before, &after, Utc::now());
        assert_eq!(eval.state_snapshot_ref.as_deref(), Some("wallet.balance"));
        assert!(eval.event_ids.is_empty());
    }

    #[test]
    fn schedule_tick_respects_disabled_flag() {
        let mut eng = RuleEngine::default();
        let mut rule = mk_schedule_rule("0 0 9 * * *");
        rule.enabled = false;
        let now = Utc.with_ymd_and_hms(2026, 4, 23, 9, 30, 0).unwrap();
        match eng.evaluate_schedule_tick(&rule, now) {
            RuleDecision::Skipped { reason } => assert_eq!(reason, "disabled"),
            other => panic!("expected Skipped disabled, got {other:?}"),
        }
    }
}
