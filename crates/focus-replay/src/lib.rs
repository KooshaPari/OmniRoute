// SPDX-License-Identifier: MIT OR Apache-2.0

//! Time-travel debugging for the rule engine.
//!
//! [`ReplayEngine`] lets devs replay a span of events to see what WOULD
//! fire under a modified ruleset, without mutating state. [`DiffReport`]
//! identifies which rule changes caused which behavior changes.
//!

use anyhow::anyhow;
use chrono::{DateTime, Utc};
use focus_events::NormalizedEvent;
use focus_rules::{Action, Rule, RuleDecision, RuleEngine};
use focus_storage::ports::EventStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Replays a window of events under an alternate ruleset.
/// Does not mutate state.
pub struct ReplayEngine {
    event_store: Arc<dyn EventStore>,
    baseline_rules: Vec<Rule>,
    alternate_rules: Vec<Rule>,
}

impl ReplayEngine {
    /// Create a new replay engine with a baseline and alternate ruleset.
    pub fn new(
        event_store: Arc<dyn EventStore>,
        baseline_rules: Vec<Rule>,
        alternate_rules: Vec<Rule>,
    ) -> Self {
        Self {
            event_store,
            baseline_rules,
            alternate_rules,
        }
    }

    /// Replay events between `since` and `until`, evaluate both rulesets,
    /// and return a diff report.
    ///
    /// Uses the event store's cursor-based API to fetch events. In a real
    /// scenario, the cursor would have been set to the start of the window
    /// prior to calling this method. For R&D/testing, filters fetched events
    /// by their `occurred_at` timestamp.
    pub async fn replay_window(
        &self,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> anyhow::Result<DiffReport> {
        // Fetch all events from the start of the store (cursor=None, large limit).
        // In production, this would use a persisted cursor to resume.
        let all_events = self
            .event_store
            .since_cursor(None, 100_000)
            .await
            .map_err(|e| anyhow!("Failed to fetch events: {}", e))?;

        // Filter events to the window [since, until).
        let events: Vec<_> = all_events
            .into_iter()
            .filter(|e| e.occurred_at >= since && e.occurred_at < until)
            .collect();

        if events.is_empty() {
            return Ok(DiffReport {
                window_start: since,
                window_end: until,
                baseline_report: ReplayReport::default(),
                alternate_report: ReplayReport::default(),
                diffs: Vec::new(),
            });
        }

        // Evaluate under baseline ruleset.
        let baseline_report = self.evaluate_events(&events, &self.baseline_rules)?;

        // Evaluate under alternate ruleset.
        let alternate_report = self.evaluate_events(&events, &self.alternate_rules)?;

        // Compute diff.
        let diffs = Self::compute_diff(&baseline_report, &alternate_report)?;

        Ok(DiffReport {
            window_start: since,
            window_end: until,
            baseline_report,
            alternate_report,
            diffs,
        })
    }

    /// Evaluate a batch of events against a ruleset (immutably).
    fn evaluate_events(
        &self,
        events: &[NormalizedEvent],
        rules: &[Rule],
    ) -> anyhow::Result<ReplayReport> {
        let mut engine = RuleEngine::new();
        let mut decisions = Vec::new();
        let mut action_deltas: HashMap<String, i32> = HashMap::new();
        let mut streak_changes: HashMap<String, StreakChange> = HashMap::new();

        for event in events {
            // Evaluate enabled rules against this event.
            let enabled_rules: Vec<_> = rules.iter().filter(|r| r.enabled).collect();

            for rule in enabled_rules {
                // RuleEngine::evaluate returns RuleDecision directly
                let decision = engine.evaluate(rule, event, Utc::now());

                // Track decision.
                let fired = matches!(&decision, RuleDecision::Fired(_));
                if fired {
                    // Accumulate action deltas.
                    if let RuleDecision::Fired(actions) = &decision {
                        for action in actions {
                            match action {
                                Action::GrantCredit { amount } => {
                                    *action_deltas.entry("credit_delta".to_string()).or_insert(0) +=
                                        amount;
                                }
                                Action::DeductCredit { amount } => {
                                    *action_deltas.entry("credit_delta".to_string()).or_insert(0) -=
                                        amount;
                                }
                                Action::StreakIncrement(key) => {
                                    streak_changes
                                        .entry(key.clone())
                                        .or_default()
                                        .increments += 1;
                                }
                                Action::StreakReset(key) => {
                                    streak_changes
                                        .entry(key.clone())
                                        .or_default()
                                        .resets += 1;
                                }
                                _ => {}
                            }
                        }
                    }
                }

                decisions.push(ReplayDecision {
                    event_id: event.event_id,
                    rule_id: rule.id,
                    fired,
                    actions: match &decision {
                        RuleDecision::Fired(actions) => actions.clone(),
                        _ => vec![],
                    },
                });
            }
        }

        Ok(ReplayReport {
            events_seen: events.len(),
            decisions: decisions.len(),
            fired_decisions: decisions.iter().filter(|d| d.fired).count(),
            action_deltas,
            streak_changes,
        })
    }

    /// Compute differences between two reports.
    fn compute_diff(
        baseline: &ReplayReport,
        alternate: &ReplayReport,
    ) -> anyhow::Result<Vec<ReplayDiff>> {
        let mut diffs = Vec::new();

        // Compare decision counts.
        if baseline.fired_decisions != alternate.fired_decisions {
            diffs.push(ReplayDiff::FiredDecisionDelta {
                baseline: baseline.fired_decisions,
                alternate: alternate.fired_decisions,
            });
        }

        // Compare action deltas.
        for (key, baseline_val) in &baseline.action_deltas {
            let alternate_val = alternate.action_deltas.get(key).copied().unwrap_or(0);
            if baseline_val != &alternate_val {
                diffs.push(ReplayDiff::ActionDelta {
                    key: key.clone(),
                    baseline: *baseline_val,
                    alternate: alternate_val,
                });
            }
        }

        for (key, alternate_val) in &alternate.action_deltas {
            if !baseline.action_deltas.contains_key(key) {
                diffs.push(ReplayDiff::ActionDelta {
                    key: key.clone(),
                    baseline: 0,
                    alternate: *alternate_val,
                });
            }
        }

        // Compare streak changes.
        for (key, baseline_change) in &baseline.streak_changes {
            let alternate_change = alternate
                .streak_changes
                .get(key)
                .cloned()
                .unwrap_or_default();
            if baseline_change != &alternate_change {
                diffs.push(ReplayDiff::StreakChangeDelta {
                    key: key.clone(),
                    baseline: baseline_change.clone(),
                    alternate: alternate_change,
                });
            }
        }

        for (key, alternate_change) in &alternate.streak_changes {
            if !baseline.streak_changes.contains_key(key) {
                diffs.push(ReplayDiff::StreakChangeDelta {
                    key: key.clone(),
                    baseline: StreakChange::default(),
                    alternate: alternate_change.clone(),
                });
            }
        }

        Ok(diffs)
    }
}

/// Summary of a replay pass under one ruleset.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ReplayReport {
    pub events_seen: usize,
    pub decisions: usize,
    pub fired_decisions: usize,
    pub action_deltas: HashMap<String, i32>,
    pub streak_changes: HashMap<String, StreakChange>,
}

/// A single decision in a replay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayDecision {
    pub event_id: Uuid,
    pub rule_id: Uuid,
    pub fired: bool,
    pub actions: Vec<Action>,
}

/// Change to a streak metric.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StreakChange {
    pub increments: usize,
    pub resets: usize,
}

/// Difference in behavior between two ruleset evaluations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplayDiff {
    /// Different number of rules fired.
    FiredDecisionDelta { baseline: usize, alternate: usize },
    /// Different total action deltas (e.g., credit earned/spent).
    ActionDelta {
        key: String,
        baseline: i32,
        alternate: i32,
    },
    /// Different streak mutation patterns.
    StreakChangeDelta {
        key: String,
        baseline: StreakChange,
        alternate: StreakChange,
    },
}

/// Full diff report comparing baseline and alternate ruleset evaluations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffReport {
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub baseline_report: ReplayReport,
    pub alternate_report: ReplayReport,
    pub diffs: Vec<ReplayDiff>,
}

impl DiffReport {
    /// Return true if there are any diffs.
    pub fn has_diffs(&self) -> bool {
        !self.diffs.is_empty()
    }

    /// Format as markdown for CLI output.
    pub fn to_markdown(&self) -> String {
        let mut md = String::new();
        md.push_str("# Time-Travel Replay Report\n\n");

        md.push_str(&format!(
            "**Window:** {} — {}\n\n",
            self.window_start, self.window_end
        ));

        md.push_str("## Baseline Ruleset\n\n");
        md.push_str(&format!(
            "- Events Seen: {}\n",
            self.baseline_report.events_seen
        ));
        md.push_str(&format!(
            "- Decisions Evaluated: {}\n",
            self.baseline_report.decisions
        ));
        md.push_str(&format!(
            "- Rules Fired: {}\n\n",
            self.baseline_report.fired_decisions
        ));

        md.push_str("## Alternate Ruleset\n\n");
        md.push_str(&format!(
            "- Events Seen: {}\n",
            self.alternate_report.events_seen
        ));
        md.push_str(&format!(
            "- Decisions Evaluated: {}\n",
            self.alternate_report.decisions
        ));
        md.push_str(&format!(
            "- Rules Fired: {}\n\n",
            self.alternate_report.fired_decisions
        ));

        if self.diffs.is_empty() {
            md.push_str("## Differences\n\n");
            md.push_str("✓ No differences detected. Rulesets produce identical behavior.\n");
        } else {
            md.push_str("## Differences\n\n");
            for (idx, diff) in self.diffs.iter().enumerate() {
                md.push_str(&format!("### Diff {}\n\n", idx + 1));
                match diff {
                    ReplayDiff::FiredDecisionDelta { baseline, alternate } => {
                        md.push_str(&format!(
                            "**Rule Fire Count Changed:** {} → {}\n",
                            baseline, alternate
                        ));
                    }
                    ReplayDiff::ActionDelta {
                        key,
                        baseline,
                        alternate,
                    } => {
                        md.push_str(&format!(
                            "**Action Delta ({}): {} → {}\n",
                            key, baseline, alternate
                        ));
                    }
                    ReplayDiff::StreakChangeDelta {
                        key,
                        baseline,
                        alternate,
                    } => {
                        md.push_str(&format!(
                            "**Streak '{}' Changed:**\n",
                            key
                        ));
                        md.push_str(&format!(
                            "- Baseline: +{} increments, {} resets\n",
                            baseline.increments, baseline.resets
                        ));
                        md.push_str(&format!(
                            "- Alternate: +{} increments, {} resets\n",
                            alternate.increments, alternate.resets
                        ));
                    }
                }
                md.push('\n');
            }
        }

        md
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_ruleset_returns_empty_diff() {
        let rules: Vec<Rule> = vec![];
        let baseline = ReplayReport {
            events_seen: 10,
            decisions: 0,
            fired_decisions: 0,
            action_deltas: HashMap::new(),
            streak_changes: HashMap::new(),
        };
        let alternate = baseline.clone();

        let diffs = ReplayEngine::compute_diff(&baseline, &alternate)
            .expect("diff should succeed");
        assert!(diffs.is_empty(), "identical rulesets should have no diffs");
    }

    #[test]
    fn test_added_rule_shows_new_fires() {
        let baseline = ReplayReport {
            events_seen: 10,
            decisions: 10,
            fired_decisions: 2,
            action_deltas: [("credit_delta".to_string(), 50)].iter().cloned().collect(),
            streak_changes: HashMap::new(),
        };

        let mut alternate = baseline.clone();
        alternate.fired_decisions = 5; // 3 more fires

        let diffs = ReplayEngine::compute_diff(&baseline, &alternate)
            .expect("diff should succeed");
        assert!(!diffs.is_empty(), "added rule should produce diffs");
        assert!(diffs.iter().any(|d| matches!(
            d,
            ReplayDiff::FiredDecisionDelta { .. }
        )));
    }

    #[test]
    fn test_modified_action_shows_delta() {
        let baseline = ReplayReport {
            events_seen: 10,
            decisions: 10,
            fired_decisions: 5,
            action_deltas: [("credit_delta".to_string(), 100)].iter().cloned().collect(),
            streak_changes: HashMap::new(),
        };

        let alternate = ReplayReport {
            events_seen: 10,
            decisions: 10,
            fired_decisions: 5,
            action_deltas: [("credit_delta".to_string(), 150)].iter().cloned().collect(),
            streak_changes: HashMap::new(),
        };

        let diffs = ReplayEngine::compute_diff(&baseline, &alternate)
            .expect("diff should succeed");
        assert!(!diffs.is_empty(), "modified action should produce diffs");
        assert!(diffs.iter().any(|d| matches!(
            d,
            ReplayDiff::ActionDelta {
                baseline: 100,
                alternate: 150,
                ..
            }
        )));
    }

    #[test]
    fn test_zero_events_handled() {
        let baseline = ReplayReport::default();
        let alternate = ReplayReport::default();

        let diffs = ReplayEngine::compute_diff(&baseline, &alternate)
            .expect("diff should succeed");
        assert!(
            diffs.is_empty(),
            "zero-event window should have no diffs for identical rulesets"
        );
    }

    #[test]
    fn test_diff_report_markdown_format() {
        let report = DiffReport {
            window_start: "2026-04-20T00:00:00Z".parse().unwrap(),
            window_end: "2026-04-21T00:00:00Z".parse().unwrap(),
            baseline_report: ReplayReport {
                events_seen: 100,
                decisions: 500,
                fired_decisions: 42,
                action_deltas: Default::default(),
                streak_changes: Default::default(),
            },
            alternate_report: ReplayReport {
                events_seen: 100,
                decisions: 500,
                fired_decisions: 45,
                action_deltas: Default::default(),
                streak_changes: Default::default(),
            },
            diffs: vec![ReplayDiff::FiredDecisionDelta {
                baseline: 42,
                alternate: 45,
            }],
        };

        let md = report.to_markdown();
        assert!(md.contains("Time-Travel Replay Report"));
        assert!(md.contains("42"));
        assert!(md.contains("45"));
        assert!(!md.contains("No differences detected"));
    }
}
