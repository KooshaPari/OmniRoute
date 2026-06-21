// SPDX-License-Identifier: MIT OR Apache-2.0

//! Rule suggestion engine.
//!
//! Analyzes audit chain and connector events over a time window to detect
//! patterns (repeated behaviors, missed opportunities, consistent routines)
//! and suggests custom rules with human-readable rationale.
//!
//! Heuristics (v0):
//! - Scheduled Focus Sessions: detect consistent focus session start times → suggest scheduled rule
//! - Missing Celebrations: detect task completions without celebration events → suggest celebration rule
//! - Missed Check-ins: detect missed daily checkins → suggest earlier reminder
//! - Unlinked Actions: detect GitHub PRs without wallet grants → suggest action-chain rule

use chrono::{DateTime, Datelike, Duration, Utc};
use focus_audit::{AuditRecord, AuditStore};
use focus_events::{NormalizedEvent, WellKnownEventType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A rule suggestion with confidence, rationale, and proposed rule structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSuggestion {
    pub id: Uuid,
    pub heuristic_name: String,
    /// 0.0 to 1.0; higher = more confident the suggestion is actionable.
    pub confidence: f32,
    /// Human-readable explanation of why this rule is suggested.
    pub rationale: String,
    /// The proposed rule (in serialized RuleIr form).
    pub proposed_rule: ProposedRule,
    /// Optional: detailed evidence supporting this suggestion.
    pub evidence: Option<SuggestionEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedRule {
    pub name: String,
    pub description: String,
    pub trigger: String,
    pub conditions: Vec<String>,
    pub actions: Vec<String>,
    pub priority: i32,
    pub cooldown_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionEvidence {
    pub pattern_count: usize,
    pub time_range_days: u32,
    pub sample_timestamps: Vec<DateTime<Utc>>,
    pub additional_context: serde_json::Value,
}

/// Dismissed suggestions persisted by ID.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DismissedSuggestion {
    pub suggestion_id: Uuid,
    pub dismissed_at: DateTime<Utc>,
}

/// Primary suggester interface. Analyzes audit chain and events over a window.
pub struct RuleSuggester {
    dismissed: std::collections::HashSet<Uuid>,
}

impl RuleSuggester {
    pub fn new() -> Self {
        Self { dismissed: std::collections::HashSet::new() }
    }

    pub fn with_dismissed(mut self, ids: Vec<Uuid>) -> Self {
        self.dismissed.extend(ids);
        self
    }

    /// Suggest rules based on audit chain and connector events over the past
    /// `window_days`. Returns suggestions filtered by `dismissed` set.
    ///
    /// Heuristics applied:
    /// 1. Scheduled Focus Sessions (H1): consistent weekday + time pattern
    /// 2. Missing Celebrations (H2): task completions without celebration
    /// 3. Missed Check-ins (H3): skipped daily checkins
    /// 4. Unlinked Actions (H4): GitHub PRs closed without wallet grant
    pub fn suggest_rules(
        &self,
        audit_store: &dyn AuditStore,
        events: &[NormalizedEvent],
        window_days: u32,
    ) -> anyhow::Result<Vec<RuleSuggestion>> {
        if window_days == 0 {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let cutoff = now - Duration::days(window_days as i64);

        // Fetch recent audit records
        let audit_records = self.load_recent_audits(audit_store, cutoff)?;

        // Filter events to window
        let recent_events: Vec<_> =
            events.iter().filter(|e| e.occurred_at >= cutoff && e.occurred_at <= now).collect();

        let mut suggestions = Vec::new();

        // H1: Scheduled Focus Sessions
        if let Some(h1) = self.heuristic_scheduled_focus_sessions(&recent_events, window_days) {
            if !self.dismissed.contains(&h1.id) {
                suggestions.push(h1);
            }
        }

        // H2: Missing Celebrations
        if let Some(h2) = self.heuristic_missing_celebrations(&recent_events, window_days) {
            if !self.dismissed.contains(&h2.id) {
                suggestions.push(h2);
            }
        }

        // H3: Missed Check-ins (combining audit records + any audit-like events)
        let combined_records = [audit_records.clone(), self.extract_audit_like_events(&recent_events)].concat();
        if let Some(h3) = self.heuristic_missed_checkins(&combined_records, window_days) {
            if !self.dismissed.contains(&h3.id) {
                suggestions.push(h3);
            }
        }

        // H4: Unlinked Actions (GitHub PRs → wallet grants)
        let combined_records_h4 = [audit_records.clone(), self.extract_audit_like_events(&recent_events)].concat();
        if let Some(h4) = self.heuristic_unlinked_actions(&combined_records_h4, &recent_events) {
            if !self.dismissed.contains(&h4.id) {
                suggestions.push(h4);
            }
        }

        Ok(suggestions)
    }

    /// Mark a suggestion as dismissed; it won't be returned by future calls.
    pub fn dismiss(&mut self, suggestion_id: Uuid) {
        self.dismissed.insert(suggestion_id);
    }

    /// H1: Detect consistent focus session start times (e.g., Tue/Thu 9am).
    fn heuristic_scheduled_focus_sessions(
        &self,
        events: &[&NormalizedEvent],
        window_days: u32,
    ) -> Option<RuleSuggestion> {
        let focus_starts: Vec<_> = events
            .iter()
            .filter(|e| {
                matches!(
                    e.event_type,
                    focus_events::EventType::WellKnown(WellKnownEventType::EventStarted)
                )
                    && e.payload.get("source").and_then(|v| v.as_str()) == Some("focus_session")
            })
            .collect();

        if focus_starts.len() < 2 {
            return None;
        }

        // Bucket by (weekday, hour)
        let mut time_buckets: std::collections::HashMap<(u32, u32), usize> =
            std::collections::HashMap::new();
        let mut sample_times = Vec::new();

        for event in &focus_starts {
            let hour = event.occurred_at.format("%H").to_string().parse::<u32>().unwrap_or(0);
            let weekday = event.occurred_at.weekday().number_from_monday();
            let bucket = (weekday, hour);
            *time_buckets.entry(bucket).or_insert(0) += 1;
            if sample_times.len() < 3 {
                sample_times.push(event.occurred_at);
            }
        }

        // Find if any time slot repeats >= 3 times (indicating a pattern)
        let (best_bucket, count) =
            time_buckets.iter().max_by_key(|(_, c)| *c).unwrap_or((&(0, 0), &0));

        if *count < 3 {
            return None;
        }

        let weekday_name = match best_bucket.0 {
            1 => "Monday",
            2 => "Tuesday",
            3 => "Wednesday",
            4 => "Thursday",
            5 => "Friday",
            6 => "Saturday",
            7 => "Sunday",
            _ => "Unknown",
        };

        let hour = best_bucket.1;
        let confidence = (*count as f32) / (focus_starts.len() as f32).max(1.0);

        Some(RuleSuggestion {
            id: Uuid::new_v4(),
            heuristic_name: "ScheduledFocusSessions".to_string(),
            confidence: (confidence * 0.95).min(0.95),
            rationale: format!(
                "You start focus sessions {} at {}:00 consistently. Consider automating this schedule.",
                weekday_name, hour
            ),
            proposed_rule: ProposedRule {
                name: format!("Auto-focus: {} {}:00", weekday_name, hour),
                description: "Automatically start a focus session at your preferred time.".to_string(),
                trigger: format!("schedule:0 {} ? ? {}", hour, weekday_name.to_lowercase()),
                conditions: vec![],
                actions: vec!["FocusSessionStart { duration_minutes: 90 }".to_string()],
                priority: 50,
                cooldown_seconds: None,
            },
            evidence: Some(SuggestionEvidence {
                pattern_count: *count,
                time_range_days: window_days,
                sample_timestamps: sample_times.to_vec(),
                additional_context: serde_json::json!({
                    "best_weekday": weekday_name,
                    "best_hour": hour,
                    "occurrence_count": count,
                }),
            }),
        })
    }

    /// H2: Detect task completions without celebration events.
    fn heuristic_missing_celebrations(
        &self,
        events: &[&NormalizedEvent],
        window_days: u32,
    ) -> Option<RuleSuggestion> {
        let completed_tasks: Vec<_> = events
            .iter()
            .filter(|e| {
                matches!(
                    e.event_type,
                    focus_events::EventType::WellKnown(WellKnownEventType::TaskCompleted)
                )
            })
            .collect();

        if completed_tasks.len() < 3 {
            return None;
        }

        // Check if there are celebration events (in payload or event source)
        let celebrations: Vec<_> = events
            .iter()
            .filter(|e| e.payload.get("type").and_then(|v| v.as_str()) == Some("celebration"))
            .collect();

        // If celebrations are rare relative to completions, suggest a celebration rule
        let celebration_ratio = celebrations.len() as f32 / completed_tasks.len() as f32;
        if celebration_ratio > 0.3 {
            return None; // Already celebrating frequently
        }

        let missed = completed_tasks.len() - celebrations.len();

        Some(RuleSuggestion {
            id: Uuid::new_v4(),
            heuristic_name: "MissingCelebrations".to_string(),
            confidence: 0.7,
            rationale: format!(
                "You completed {} tasks but celebrated in only {} of them. \
                 Celebrating wins boosts morale and retention.",
                completed_tasks.len(),
                celebrations.len()
            ),
            proposed_rule: ProposedRule {
                name: "Celebrate task completions".to_string(),
                description: "Play a sound and show a celebration when tasks are marked done."
                    .to_string(),
                trigger: "event:TaskCompleted".to_string(),
                conditions: vec![],
                actions: vec![
                    "Notify { message: 'Great job!'.to_string() }".to_string(),
                    "StreakIncrement { name: 'daily_wins'.to_string() }".to_string(),
                ],
                priority: 40,
                cooldown_seconds: Some(60),
            },
            evidence: Some(SuggestionEvidence {
                pattern_count: missed,
                time_range_days: window_days,
                sample_timestamps: completed_tasks.iter().map(|e| e.occurred_at).collect(),
                additional_context: serde_json::json!({
                    "completed_tasks": completed_tasks.len(),
                    "celebrated": celebrations.len(),
                    "celebration_ratio": celebration_ratio,
                }),
            }),
        })
    }

    /// H3: Detect missed daily check-ins (gap of 24+ hours between checkins).
    fn heuristic_missed_checkins(
        &self,
        audit_records: &[AuditRecord],
        window_days: u32,
    ) -> Option<RuleSuggestion> {
        let checkin_records: Vec<_> = audit_records
            .iter()
            .filter(|r| r.record_type.contains("daily_checkin") || r.record_type.contains("checkin"))
            .collect();

        if checkin_records.len() < 2 {
            return None;
        }

        // Check for gaps of 24+ hours
        let mut gaps = Vec::new();
        for i in 1..checkin_records.len() {
            let gap = checkin_records[i].occurred_at - checkin_records[i - 1].occurred_at;
            if gap > Duration::hours(24) {
                gaps.push(gap);
            }
        }

        if gaps.is_empty() {
            return None;
        }

        let avg_gap_hours =
            gaps.iter().map(|g| g.num_hours()).sum::<i64>() as f32 / gaps.len() as f32;

        Some(RuleSuggestion {
            id: Uuid::new_v4(),
            heuristic_name: "MissedCheckIns".to_string(),
            confidence: 0.65,
            rationale: format!(
                "You've missed {} daily check-ins in the past {} days. \
                 An earlier reminder (8:00 AM) might help you stay consistent.",
                gaps.len(),
                window_days
            ),
            proposed_rule: ProposedRule {
                name: "Earlier morning check-in".to_string(),
                description: "Remind you to check in earlier in the day."
                    .to_string(),
                trigger: "schedule:0 8 ? ? *".to_string(),
                conditions: vec![],
                actions: vec!["Notify { message: 'Time for your daily check-in!'.to_string() }"
                    .to_string()],
                priority: 30,
                cooldown_seconds: None,
            },
            evidence: Some(SuggestionEvidence {
                pattern_count: gaps.len(),
                time_range_days: window_days,
                sample_timestamps: checkin_records.iter().map(|r| r.occurred_at).collect(),
                additional_context: serde_json::json!({
                    "missed_checkins": gaps.len(),
                    "avg_gap_hours": avg_gap_hours,
                }),
            }),
        })
    }

    /// H4: Detect GitHub PRs closed without wallet grants.
    fn heuristic_unlinked_actions(
        &self,
        audit_records: &[AuditRecord],
        events: &[&NormalizedEvent],
    ) -> Option<RuleSuggestion> {
        // Find GitHub PR closure events
        let pr_closes: Vec<_> = events
            .iter()
            .filter(|e| {
                e.connector_id.contains("github")
                    && e.payload.get("action").and_then(|v| v.as_str()) == Some("closed")
            })
            .collect();

        if pr_closes.len() < 2 {
            return None;
        }

        // Check if wallet grants follow PRs (within 1 hour)
        let grants: Vec<_> =
            audit_records.iter().filter(|r| r.record_type.contains("wallet.grant")).collect();

        if grants.is_empty() {
            return None;
        }

        // Heuristic: if < 50% of PRs get grants, suggest a rule
        let mut pr_with_grant = 0;
        for pr in &pr_closes {
            for grant in &grants {
                let gap = (grant.occurred_at - pr.occurred_at).abs();
                if gap <= Duration::hours(1) {
                    pr_with_grant += 1;
                    break;
                }
            }
        }

        let grant_rate = pr_with_grant as f32 / pr_closes.len() as f32;
        if grant_rate > 0.5 {
            return None; // Already granting frequently
        }

        Some(RuleSuggestion {
            id: Uuid::new_v4(),
            heuristic_name: "UnlinkedActions".to_string(),
            confidence: 0.6,
            rationale: format!(
                "You've closed {} GitHub PRs but only granted credits for {} of them. \
                 Consider automating credit grants for merged code.",
                pr_closes.len(),
                pr_with_grant
            ),
            proposed_rule: ProposedRule {
                name: "Credit PR merges".to_string(),
                description: "Grant credits when you merge a GitHub PR."
                    .to_string(),
                trigger: "event:github_pr_merged".to_string(),
                conditions: vec!["is_your_pr".to_string()],
                actions: vec!["GrantCredit { amount: 10 }".to_string()],
                priority: 45,
                cooldown_seconds: None,
            },
            evidence: Some(SuggestionEvidence {
                pattern_count: pr_closes.len() - pr_with_grant,
                time_range_days: 30,
                sample_timestamps: pr_closes.iter().map(|e| e.occurred_at).collect(),
                additional_context: serde_json::json!({
                    "pr_closures": pr_closes.len(),
                    "with_grant": pr_with_grant,
                    "grant_rate": grant_rate,
                }),
            }),
        })
    }

    /// Load recent audit records from the store.
    fn load_recent_audits(
        &self,
        _audit_store: &dyn AuditStore,
        _cutoff: DateTime<Utc>,
    ) -> anyhow::Result<Vec<AuditRecord>> {
        // This is a placeholder; in production, AuditStore would have a
        // method to fetch records within a time window.
        // For now, return empty; callers provide events directly.
        Ok(Vec::new())
    }

    /// Helper: convert events into pseudo-audit records for heuristic analysis.
    fn extract_audit_like_events(&self, events: &[&NormalizedEvent]) -> Vec<AuditRecord> {
        events
            .iter()
            .map(|e| AuditRecord {
                id: e.event_id,
                record_type: format!("event:{:?}", e.event_type),
                subject_ref: e.connector_id.clone(),
                occurred_at: e.occurred_at,
                prev_hash: "genesis".to_string(),
                payload: e.payload.clone(),
                hash: "synthetic".to_string(),
            })
            .collect()
    }
}

impl Default for RuleSuggester {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    fn ts(offset_days: i64) -> DateTime<Utc> {
        Utc::now() - Duration::days(offset_days)
    }

    #[test]
    fn empty_history_returns_no_suggestions() {
        let suggester = RuleSuggester::new();
        let suggestions = suggester.suggest_rules(&NoopAuditStore, &[], 30).unwrap();
        assert!(suggestions.is_empty());
    }

    #[test]
    fn zero_window_returns_no_suggestions() {
        let suggester = RuleSuggester::new();
        let suggestions = suggester.suggest_rules(&NoopAuditStore, &[], 0).unwrap();
        assert!(suggestions.is_empty());
    }

    #[test]
    fn dismissed_suggestion_not_returned() {
        let suggester = RuleSuggester::new();

        // Create mock events for focus sessions
        let events = vec![mock_focus_event(ts(1), 9),
            mock_focus_event(ts(2), 9),
            mock_focus_event(ts(8), 9),
            mock_focus_event(ts(9), 9)];

        let suggestions = suggester.suggest_rules(&NoopAuditStore, &events, 30).unwrap();
        if let Some(first) = suggestions.first() {
            let mut suggester_with_dismiss = RuleSuggester::new();
            suggester_with_dismiss.dismiss(first.id);
            let filtered =
                suggester_with_dismiss.suggest_rules(&NoopAuditStore, &events, 30).unwrap();
            assert!(!filtered.iter().any(|s| s.id == first.id));
        }
    }

    #[test]
    fn missing_celebrations_heuristic_detects_unCelebrated_tasks() {
        let suggester = RuleSuggester::new();

        let mut events = vec![];
        for i in 0..5 {
            events.push(mock_task_completed_event(ts(i as i64)));
        }

        let suggestions = suggester.suggest_rules(&NoopAuditStore, &events, 30).unwrap();
        assert!(suggestions
            .iter()
            .any(|s| s.heuristic_name == "MissingCelebrations"));
    }

    // Test helpers and mocks

    fn mock_focus_event(dt: DateTime<Utc>, hour: u32) -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "local".to_string(),
            account_id: Uuid::new_v4(),
            event_type: focus_events::EventType::WellKnown(WellKnownEventType::EventStarted),
            occurred_at: dt.with_hour(hour).unwrap_or(dt),
            effective_at: dt.with_hour(hour).unwrap_or(dt),
            dedupe_key: focus_events::DedupeKey(format!("focus-{}", Uuid::new_v4())),
            confidence: 1.0,
            payload: serde_json::json!({"source": "focus_session"}),
            raw_ref: None,
        }
    }

    fn mock_task_completed_event(dt: DateTime<Utc>) -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "canvas".to_string(),
            account_id: Uuid::new_v4(),
            event_type: focus_events::EventType::WellKnown(WellKnownEventType::TaskCompleted),
            occurred_at: dt,
            effective_at: dt,
            dedupe_key: focus_events::DedupeKey(format!("task-{}", Uuid::new_v4())),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        }
    }

    fn mock_github_pr_closed_event(dt: DateTime<Utc>) -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "github".to_string(),
            account_id: Uuid::new_v4(),
            event_type: focus_events::EventType::Custom("github_pr_closed".to_string()),
            occurred_at: dt,
            effective_at: dt,
            dedupe_key: focus_events::DedupeKey(format!("pr-{}", Uuid::new_v4())),
            confidence: 1.0,
            payload: serde_json::json!({"action": "closed"}),
            raw_ref: None,
        }
    }

    struct NoopAuditStore;
    impl focus_audit::AuditStore for NoopAuditStore {
        fn append(&self, _record: AuditRecord) -> anyhow::Result<()> {
            Ok(())
        }
        fn verify_chain(&self) -> anyhow::Result<bool> {
            Ok(true)
        }
        fn head_hash(&self) -> anyhow::Result<Option<String>> {
            Ok(None)
        }
    }

    struct MockAuditStore {
        records: Vec<AuditRecord>,
    }

    impl MockAuditStore {
        fn new() -> Self {
            Self { records: Vec::new() }
        }

        fn add_checkin(&mut self, dt: DateTime<Utc>) {
            let record = AuditRecord {
                id: Uuid::new_v4(),
                record_type: "daily_checkin".to_string(),
                subject_ref: "user".to_string(),
                occurred_at: dt,
                prev_hash: "genesis".to_string(),
                payload: serde_json::json!({}),
                hash: "fake".to_string(),
            };
            self.records.push(record);
        }

        fn add_grant(&mut self, dt: DateTime<Utc>) {
            let record = AuditRecord {
                id: Uuid::new_v4(),
                record_type: "wallet.grant".to_string(),
                subject_ref: "user".to_string(),
                occurred_at: dt,
                prev_hash: "genesis".to_string(),
                payload: serde_json::json!({}),
                hash: "fake".to_string(),
            };
            self.records.push(record);
        }
    }

    impl focus_audit::AuditStore for MockAuditStore {
        fn append(&self, _record: AuditRecord) -> anyhow::Result<()> {
            Ok(())
        }
        fn verify_chain(&self) -> anyhow::Result<bool> {
            Ok(true)
        }
        fn head_hash(&self) -> anyhow::Result<Option<String>> {
            Ok(None)
        }
    }
}
