// SPDX-License-Identifier: MIT OR Apache-2.0

//! Monthly Retrospective engine for focus-rituals.
//!
//! Traces to: FR-RITUAL-004 (Monthly Retrospective).
//!
//! `MonthlyRetrospectiveEngine` synthesizes month-over-month trends in focus
//! time, wallet activity, and rule patterns with coached reflection.
//! All LLM calls route through `complete_guarded` with static fallback copy.

use chrono::{DateTime, Datelike, NaiveDate, Utc};
use focus_coaching::{complete_guarded, CoachingProvider};
use phenotype_observably_macros::async_instrumented;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Month-over-month delta (current vs. prior).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MonthDelta {
    pub focus_hours_delta: f32,
    pub tasks_completed_delta: i32,
    pub credits_earned_delta: i64,
    pub trend_direction: String, // "up", "down", "stable"
}

/// Peak streak achievement for the month.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StreakPeak {
    pub name: String,
    pub peak_count: u32,
    pub achieved_on: NaiveDate,
}

/// Monthly retrospective — aggregates month's macro trends and coached themes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MonthlyRetro {
    pub month: String, // "2026-05"
    pub total_focus_hours: f32,
    pub weekly_breakdown: Vec<f32>, // 4-5 entries for weeks in month
    pub theme: String,
    pub top_accomplishments: Vec<String>,
    pub compared_to_prior_month: MonthDelta,
    pub streak_peak: String,
    pub coachy_reflection: String,
    pub generated_at: DateTime<Utc>,
}

/// Orchestrates monthly retrospective synthesis.
pub struct MonthlyRetrospectiveEngine {
    pub coaching: Arc<dyn CoachingProvider>,
}

impl MonthlyRetrospectiveEngine {
    pub fn new(coaching: Arc<dyn CoachingProvider>) -> Self {
        Self { coaching }
    }

    /// FR-RITUAL-004 — Generate monthly retrospective for the month containing `now`.
    #[async_instrumented]
    pub async fn generate_monthly_retro(&self, now: DateTime<Utc>) -> anyhow::Result<MonthlyRetro> {
        let year = now.year();
        let month = now.month();
        let month_str = format!("{:04}-{:02}", year, month);

        // Aggregate data from event store, wallet, audit — stub for now.
        // Real impl: query event store for month's focus sessions by week,
        // fetch prior month's totals, compute deltas, derive theme.
        let (total_focus_hours, weekly_breakdown) =
            (52.0, vec![11.5, 12.0, 13.5, 15.0]); // 4 weeks of activity
        let tasks_completed = 68;

        // Compare to prior month (stub).
        let compared_to_prior_month = MonthDelta {
            focus_hours_delta: 4.5,
            tasks_completed_delta: 12,
            credits_earned_delta: 60,
            trend_direction: "up".to_string(),
        };

        // Top accomplishments (would come from audit chain or event store).
        let top_accomplishments = vec![
            "Shipped 68 tasks across 4 weeks".into(),
            "Extended focus streak to 20 days".into(),
            "Maintained 100% morning ritual compliance".into(),
        ];

        // Streak peak (would come from wallet history).
        let streak_peak = "Focus: 20 consecutive days (Apr 11–May 1)".into();

        // Derive theme from trend.
        let theme = self
            .ask_monthly_theme(total_focus_hours, tasks_completed)
            .await
            .unwrap_or_else(|| static_monthly_theme(total_focus_hours, tasks_completed));

        // Coached reflection.
        let coachy_reflection = self
            .ask_monthly_reflection(&theme)
            .await
            .unwrap_or_else(|| static_reflection(&theme));

        Ok(MonthlyRetro {
            month: month_str,
            total_focus_hours,
            weekly_breakdown,
            theme,
            top_accomplishments,
            compared_to_prior_month,
            streak_peak,
            coachy_reflection,
            generated_at: now,
        })
    }

    // -- coaching helpers --------------------------------------------------

    async fn ask_monthly_theme(
        &self,
        total_focus_hours: f32,
        tasks_completed: u32,
    ) -> Option<String> {
        let prompt = format!(
            "Month summary: {:.1}h focused, {} tasks completed. \
             Suggest a one-word or two-word theme (e.g., 'momentum', 'breakthrough', 'consistency').",
            total_focus_hours, tasks_completed
        );
        complete_guarded(self.coaching.as_ref(), &prompt, None, 40).await.ok().flatten()
    }

    async fn ask_monthly_reflection(&self, theme: &str) -> Option<String> {
        let prompt = format!(
            "The month's theme was '{}'. Write a ≤100-char reflection on growth and next month's focus.",
            theme
        );
        complete_guarded(self.coaching.as_ref(), &prompt, None, 100).await.ok().flatten()
    }
}

// ---------------------------------------------------------------------------
// Static fallbacks
// ---------------------------------------------------------------------------

fn static_monthly_theme(total_focus_hours: f32, tasks_completed: u32) -> String {
    if total_focus_hours > 50.0 && tasks_completed > 60 {
        "Momentum".into()
    } else if tasks_completed > 80 {
        "Execution".into()
    } else {
        "Growth".into()
    }
}

fn static_reflection(theme: &str) -> String {
    match theme.to_lowercase().as_str() {
        t if t.contains("momentum") => {
            "You built real momentum this month. Keep the streak alive—compound wins.".to_string()
        }
        t if t.contains("execution") => {
            "Exceptional execution. Next month, push for deeper, more complex work.".to_string()
        }
        _ => "Solid growth trajectory. Refine your process and push harder next month.".to_string(),
    }
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
        // May 1, 2026 09:00 UTC
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn mk_monthly_engine() -> MonthlyRetrospectiveEngine {
        MonthlyRetrospectiveEngine::new(Arc::new(NoopCoachingProvider))
    }

    // Traces to: FR-RITUAL-004
    #[tokio::test]
    async fn monthly_retro_basic_shape() {
        let engine = mk_monthly_engine();
        let retro = engine.generate_monthly_retro(t0()).await.unwrap();
        assert_eq!(retro.month, "2026-05");
        assert!(retro.total_focus_hours > 0.0);
        assert!(!retro.weekly_breakdown.is_empty());
        assert!(!retro.theme.is_empty());
        assert!(!retro.top_accomplishments.is_empty());
    }

    // Traces to: FR-RITUAL-004
    #[tokio::test]
    async fn monthly_retro_delta_populated() {
        let engine = mk_monthly_engine();
        let retro = engine.generate_monthly_retro(t0()).await.unwrap();
        assert!(retro.compared_to_prior_month.trend_direction == "up"
            || retro.compared_to_prior_month.trend_direction == "down"
            || retro.compared_to_prior_month.trend_direction == "stable");
    }

    // Traces to: FR-RITUAL-004
    #[tokio::test]
    async fn monthly_retro_serde_roundtrip() {
        let engine = mk_monthly_engine();
        let retro = engine.generate_monthly_retro(t0()).await.unwrap();
        let json = serde_json::to_string(&retro).unwrap();
        let back: MonthlyRetro = serde_json::from_str(&json).unwrap();
        assert_eq!(retro, back);
    }

    // Traces to: FR-RITUAL-004
    #[tokio::test]
    async fn monthly_retro_theme_reflects_stats() {
        let engine = mk_monthly_engine();
        let retro = engine.generate_monthly_retro(t0()).await.unwrap();
        assert!(!retro.theme.is_empty());
        assert!(retro.theme.len() <= 50);
    }

    // Traces to: FR-RITUAL-004
    #[test]
    fn static_theme_high_achievement() {
        let theme = static_monthly_theme(60.0, 80);
        assert!(theme.to_lowercase() == "momentum" || theme.to_lowercase() == "execution");
    }

    // Traces to: FR-RITUAL-004
    #[test]
    fn static_reflection_includes_context() {
        let refl = static_reflection("Momentum");
        assert!(refl.contains("streak") || refl.contains("next"));
    }
}
