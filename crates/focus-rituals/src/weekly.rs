// SPDX-License-Identifier: MIT OR Apache-2.0

//! Weekly Review engine for focus-rituals.
//!
//! Traces to: FR-RITUAL-003 (Weekly Review).
//!
//! `WeeklyReviewEngine` synthesizes a week's wins, trends, and growth opportunities
//! using event store, wallet, audit chain, and coaching provider.
//! All LLM calls route through `complete_guarded` with static fallback copy.

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use focus_coaching::{complete_guarded, CoachingProvider};
use phenotype_observably_macros::async_instrumented;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Summarizes one rule's firing pattern over the week.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuleSummary {
    pub rule_id: String,
    pub rule_name: String,
    pub fired_count: u32,
    pub last_fired_at: Option<DateTime<Utc>>,
}

/// Streak data at week's end.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StreakSnapshot {
    pub name: String,
    pub count: u32,
    pub extended_this_week: bool,
}

/// Weekly review — aggregates week's activity, trends, and coached narrative.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WeeklyReview {
    pub week_starting: NaiveDate,
    pub focus_hours: f32,
    pub sessions_count: u32,
    pub credits_earned: i64,
    pub credits_spent: i64,
    pub top_rules: Vec<RuleSummary>,
    pub streaks_extended: Vec<StreakSnapshot>,
    pub tasks_completed: u32,
    pub tasks_slipped: u32,
    pub wins_summary: String,
    pub growth_area: String,
    pub coachy_closing: String,
    pub generated_at: DateTime<Utc>,
}

/// Orchestrates weekly review synthesis.
pub struct WeeklyReviewEngine {
    pub coaching: Arc<dyn CoachingProvider>,
}

impl WeeklyReviewEngine {
    pub fn new(coaching: Arc<dyn CoachingProvider>) -> Self {
        Self { coaching }
    }

    /// FR-RITUAL-003 — Generate weekly review for the week containing or ending on `now`.
    #[async_instrumented]
    pub async fn generate_weekly_review(&self, now: DateTime<Utc>) -> anyhow::Result<WeeklyReview> {
        let week_starting = week_start(now.date_naive());

        // Aggregate data from event store, wallet, audit — stub for now.
        // Real impl: query event store for week's focus sessions, sum duration,
        // count completed tasks vs. slipped, fetch wallet earned/spent deltas.
        let (focus_hours, sessions_count) = (12.5, 8);
        let (credits_earned, credits_spent) = (120, 30);
        let tasks_completed = 18;
        let tasks_slipped = 3;

        // Aggregate rule firings (would come from audit chain).
        let top_rules = vec![
            RuleSummary {
                rule_id: "deep-work-4h".into(),
                rule_name: "Deep Work (4h+)".into(),
                fired_count: 5,
                last_fired_at: Some(now - Duration::hours(2)),
            },
            RuleSummary {
                rule_id: "morning-ritual".into(),
                rule_name: "Morning Ritual Completed".into(),
                fired_count: 6,
                last_fired_at: Some(now - Duration::hours(8)),
            },
        ];

        // Streak snapshots (would come from wallet).
        let streaks_extended = vec![
            StreakSnapshot {
                name: "focus".to_string(),
                count: 12,
                extended_this_week: true,
            },
            StreakSnapshot {
                name: "morning-ritual".to_string(),
                count: 6,
                extended_this_week: true,
            },
        ];

        // Wins narrative from audit trail.
        let wins_summary = self
            .ask_wins_narrative(focus_hours, tasks_completed, &top_rules)
            .await
            .unwrap_or_else(|| static_wins_summary(focus_hours, tasks_completed));

        // Growth area derived from slipped tasks or rule gaps.
        let growth_area = self
            .ask_growth_area(tasks_slipped)
            .await
            .unwrap_or_else(|| static_growth_area(tasks_slipped));

        // Closing narrative.
        let coachy_closing = self
            .ask_weekly_closing()
            .await
            .unwrap_or_else(|| STATIC_WEEKLY_CLOSING_FALLBACK.to_string());

        Ok(WeeklyReview {
            week_starting,
            focus_hours,
            sessions_count,
            credits_earned,
            credits_spent,
            top_rules,
            streaks_extended,
            tasks_completed,
            tasks_slipped,
            wins_summary,
            growth_area,
            coachy_closing,
            generated_at: now,
        })
    }

    // -- coaching helpers --------------------------------------------------

    async fn ask_wins_narrative(
        &self,
        focus_hours: f32,
        tasks_completed: u32,
        rules: &[RuleSummary],
    ) -> Option<String> {
        let rule_names: Vec<&str> = rules.iter().map(|r| r.rule_name.as_str()).collect();
        let prompt = format!(
            "Summarize the week: {:.1}h focus, {} tasks completed, rules firing: {}. \
             Write a ≤120-char narrative of wins.",
            focus_hours, tasks_completed,
            rule_names.join(", ")
        );
        complete_guarded(self.coaching.as_ref(), &prompt, None, 120).await.ok().flatten()
    }

    async fn ask_growth_area(&self, tasks_slipped: u32) -> Option<String> {
        let prompt = if tasks_slipped == 0 {
            "User shipped everything this week. Pick one growth area (e.g., speed, consistency, complexity) in ≤50 chars.".to_string()
        } else {
            format!(
                "User slipped {} tasks. What's one specific thing to improve next week (≤50 chars)?",
                tasks_slipped
            )
        };
        complete_guarded(self.coaching.as_ref(), &prompt, None, 50).await.ok().flatten()
    }

    async fn ask_weekly_closing(&self) -> Option<String> {
        let prompt = "Write a closing line for the weekly review, encouraging next week's work (≤80 chars).";
        complete_guarded(self.coaching.as_ref(), prompt, None, 80).await.ok().flatten()
    }
}

// ---------------------------------------------------------------------------
// Static fallbacks
// ---------------------------------------------------------------------------

const STATIC_WEEKLY_CLOSING_FALLBACK: &str = "Strong week ahead. Keep the streak alive.";

fn static_wins_summary(focus_hours: f32, tasks_completed: u32) -> String {
    format!("{:.1}h focused, {} tasks shipped. Solid week.", focus_hours, tasks_completed)
}

fn static_growth_area(tasks_slipped: u32) -> String {
    if tasks_slipped == 0 {
        "Increase task complexity or duration — you're ready for bigger challenges.".to_string()
    } else {
        format!("Reduce slip rate — {} tasks slipped. Focus on estimation or scope.", tasks_slipped)
    }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/// Return the Monday (NaiveDate) of the week containing `date`.
/// ISO week standard: Monday is day 1.
fn week_start(date: NaiveDate) -> NaiveDate {
    let weekday = date.weekday();
    use chrono::Weekday;
    let days_since_monday = match weekday {
        Weekday::Mon => 0,
        Weekday::Tue => 1,
        Weekday::Wed => 2,
        Weekday::Thu => 3,
        Weekday::Fri => 4,
        Weekday::Sat => 5,
        Weekday::Sun => 6,
    };
    date - Duration::days(days_since_monday as i64)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use focus_coaching::NoopCoachingProvider;

    fn t0() -> DateTime<Utc> {
        // Friday 2026-05-01 09:00 UTC
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn mk_weekly_engine() -> WeeklyReviewEngine {
        WeeklyReviewEngine::new(Arc::new(NoopCoachingProvider))
    }

    // Traces to: FR-RITUAL-003
    #[tokio::test]
    async fn weekly_review_basic_shape() {
        let engine = mk_weekly_engine();
        let review = engine.generate_weekly_review(t0()).await.unwrap();
        assert_eq!(review.week_starting.weekday(), chrono::Weekday::Mon);
        assert!(review.focus_hours > 0.0);
        assert!(review.sessions_count > 0);
        assert!(review.tasks_completed > 0);
        assert!(!review.coachy_closing.is_empty());
    }

    // Traces to: FR-RITUAL-003
    #[tokio::test]
    async fn weekly_review_win_summary_reflects_stats() {
        let engine = mk_weekly_engine();
        let review = engine.generate_weekly_review(t0()).await.unwrap();
        assert!(review.wins_summary.contains("12.5") || review.wins_summary.contains("12"));
        assert!(review.wins_summary.contains("18"));
    }

    // Traces to: FR-RITUAL-003
    #[tokio::test]
    async fn weekly_review_growth_area_populated() {
        let engine = mk_weekly_engine();
        let review = engine.generate_weekly_review(t0()).await.unwrap();
        assert!(!review.growth_area.is_empty());
        assert!(review.growth_area.len() <= 100);
    }

    // Traces to: FR-RITUAL-003
    #[tokio::test]
    async fn weekly_review_serde_roundtrip() {
        let engine = mk_weekly_engine();
        let review = engine.generate_weekly_review(t0()).await.unwrap();
        let json = serde_json::to_string(&review).unwrap();
        let back: WeeklyReview = serde_json::from_str(&json).unwrap();
        assert_eq!(review, back);
    }

    // Traces to: FR-RITUAL-003
    #[test]
    fn week_start_monday_returns_self() {
        let monday = NaiveDate::from_ymd_opt(2026, 4, 27).unwrap(); // Monday
        assert_eq!(week_start(monday), monday);
    }

    // Traces to: FR-RITUAL-003
    #[test]
    fn week_start_sunday_returns_previous_monday() {
        let sunday = NaiveDate::from_ymd_opt(2026, 5, 3).unwrap(); // Sunday
        let expected = NaiveDate::from_ymd_opt(2026, 4, 27).unwrap(); // Monday of same week
        assert_eq!(week_start(sunday), expected);
    }
}
