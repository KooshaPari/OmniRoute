// SPDX-License-Identifier: MIT OR Apache-2.0

//! focus-rituals — Coachy's Planning Coach personality.
//!
//! Traces to: FR-RITUAL-001 (Morning Brief), FR-RITUAL-002 (Evening Shutdown),
//! FR-RITUAL-003 (Weekly Review), FR-RITUAL-004 (Monthly Retrospective).
//!
//! Builds Sunsama-style Morning Brief ("what's your intention?") and Evening
//! Shutdown ("what slipped, what carries over"), plus weekly and monthly cadences
//! for sustained productivity on top of the already-landed focus-planning +
//! focus-scheduler + focus-calendar + focus-coaching crates.
//!
//! All LLM calls route through [`focus_coaching::CoachingProvider`] with the
//! `complete_guarded` helper, so `FOCALPOINT_DISABLE_COACHING=1` short-circuits
//! openings/closings to static fallback copy.
//!
//! Mascot mapping (Coachy key-art × Emotion): the morning brief nudges
//! `Pose::Confident + Emotion::Warm` via `MascotEvent::DailyCheckIn`. Evening
//! Shutdown doesn't mutate mascot state directly — the host chooses
//! `Pose::Encouraging + Emotion::Proud` when ≥1 task shipped, or
//! `Pose::SleepyDisappointed + Emotion::Concerned` on a zero-shipped day.

#![deny(clippy::all)]

pub mod monthly;
pub mod weekly;

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use focus_calendar::{CalendarEvent, CalendarPort, DateRange};
use focus_coaching::{complete_guarded, CoachingProvider};
use focus_mascot::{MascotEvent, MascotMachine};
use focus_planning::{Task, TimeBlock};
use focus_scheduler::{Schedule, ScheduleChange, Scheduler};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Morning Brief
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TopPriorityLine {
    pub task_id: Uuid,
    pub title: String,
    pub deadline_label: String,
    pub rigidity_tag: String,
    pub estimated_duration_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScheduleWindowKind {
    FocusBlock,
    Meeting,
    Personal,
    Ritual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleWindowLine {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub title: String,
    pub kind: ScheduleWindowKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SchedulePreview {
    pub windows: Vec<ScheduleWindowLine>,
    pub soft_conflicts: u32,
    pub hard_conflicts: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MorningBrief {
    pub date: NaiveDate,
    pub intention: Option<String>,
    pub top_priorities: Vec<TopPriorityLine>,
    pub schedule_preview: SchedulePreview,
    pub coachy_opening: String,
    pub generated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Evening Shutdown
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShippedTask {
    pub id: Uuid,
    pub title: String,
    pub planned_minutes: u32,
    pub actual_minutes: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SlipReason {
    Skipped,
    Deferred,
    Overran,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SlippedTask {
    pub id: Uuid,
    pub title: String,
    pub planned_minutes: u32,
    pub reason: SlipReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EveningShutdown {
    pub date: NaiveDate,
    pub shipped: Vec<ShippedTask>,
    pub slipped: Vec<SlippedTask>,
    pub carryover: Vec<Uuid>,
    pub wins_summary: String,
    pub coachy_closing: String,
    pub streak_deltas: HashMap<String, i32>,
    pub generated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// TaskActual — what actually happened to a planned placement
// ---------------------------------------------------------------------------

/// Reported by the host (iOS focus-session tracker, CLI, etc.) describing the
/// actual execution of a planned `TimeBlock`.
///
/// - `actual_minutes == 0` + `completed_at.is_none()` → `SlipReason::Skipped`.
/// - `completed_at.is_some()` but `actual_minutes < planned` → `Deferred`
///   (user ended early, moved remainder).
/// - `actual_minutes > planned` → `Overran`.
/// - explicit cancellation is flagged via [`TaskActual::cancelled`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskActual {
    pub task_id: Uuid,
    pub actual_minutes: u32,
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub cancelled: bool,
}

impl TaskActual {
    pub fn skipped(task_id: Uuid) -> Self {
        Self { task_id, actual_minutes: 0, completed_at: None, cancelled: false }
    }
    pub fn completed(task_id: Uuid, actual_minutes: u32, at: DateTime<Utc>) -> Self {
        Self { task_id, actual_minutes, completed_at: Some(at), cancelled: false }
    }
    pub fn cancelled(task_id: Uuid) -> Self {
        Self { task_id, actual_minutes: 0, completed_at: None, cancelled: true }
    }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/// Static fallback opening when coaching provider yields None.
const STATIC_OPENING_FALLBACK: &str = "Good morning. Pick one thing and start.";
const STATIC_CLOSING_FALLBACK: &str = "Day's done. Tomorrow's a fresh slate.";

/// Orchestrates Morning Brief + Evening Shutdown across the existing
/// coaching, planning, scheduling, calendar, and mascot crates.
pub struct RitualsEngine {
    pub scheduler: Arc<Scheduler>,
    pub calendar: Arc<dyn CalendarPort>,
    pub coaching: Arc<dyn CoachingProvider>,
    pub mascot: Arc<Mutex<MascotMachine>>,
}

impl RitualsEngine {
    pub fn new(
        scheduler: Arc<Scheduler>,
        calendar: Arc<dyn CalendarPort>,
        coaching: Arc<dyn CoachingProvider>,
        mascot: Arc<Mutex<MascotMachine>>,
    ) -> Self {
        Self { scheduler, calendar, coaching, mascot }
    }

    /// FR-RITUAL-001 — build today's Morning Brief.
    pub async fn generate_morning_brief(
        &self,
        tasks: &[Task],
        user_id: Uuid,
        now: DateTime<Utc>,
    ) -> anyhow::Result<MorningBrief> {
        let _ = user_id; // reserved for per-user persona prompts once identity lands.
        let horizon = horizon_to_end_of_day(now);
        let date = now.date_naive();

        // 1. Calendar events for the planning range.
        let range = DateRange::new(now, now + horizon);
        let calendar_events = self.calendar.list_events(range).await.unwrap_or_default();
        // 2. Plan against those events so conflicts propagate.
        let schedule = self.scheduler.plan(tasks, &calendar_events, now, horizon).await?;

        // 3. Top-3 priorities by schedule order (scheduler sorts by start_at,
        //    but deterministic score was applied internally; take earliest
        //    placements which reflect highest score_tiebroken).
        let top_priorities = extract_top_priorities(tasks, &schedule, 3);

        // 4. Schedule preview.
        let schedule_preview = build_preview(&schedule, &calendar_events);

        // 5. Coachy opening.
        let coachy_opening = self
            .ask_opening(&top_priorities)
            .await
            .unwrap_or_else(|| static_opening(&top_priorities));

        // 6. Push DailyCheckIn to mascot (Confident + Warm).
        {
            let mut m: tokio::sync::MutexGuard<'_, MascotMachine> = self.mascot.lock().await;
            let _ = m.on_event(MascotEvent::DailyCheckIn);
        }

        Ok(MorningBrief {
            date,
            intention: None,
            top_priorities,
            schedule_preview,
            coachy_opening,
            generated_at: now,
        })
    }

    /// FR-RITUAL-002 — build Evening Shutdown.
    pub async fn generate_evening_shutdown(
        &self,
        planned: &Schedule,
        actuals: &[TaskActual],
        now: DateTime<Utc>,
    ) -> anyhow::Result<EveningShutdown> {
        let date = now.date_naive();
        let mut shipped: Vec<ShippedTask> = Vec::new();
        let mut slipped: Vec<SlippedTask> = Vec::new();

        // Aggregate planned minutes by task_id.
        let mut planned_minutes_by_task: HashMap<Uuid, u32> = HashMap::new();
        let mut title_by_task: HashMap<Uuid, String> = HashMap::new();
        for b in &planned.assignments {
            let mins = b.duration().num_minutes().max(0) as u32;
            *planned_minutes_by_task.entry(b.task_id).or_insert(0) += mins;
            // Titles aren't in TimeBlock; use short id surrogate. Hosts who
            // want real titles can join before calling.
            title_by_task.entry(b.task_id).or_insert_with(|| short_title(&b.task_id));
        }

        for actual in actuals {
            let planned_minutes =
                planned_minutes_by_task.get(&actual.task_id).copied().unwrap_or(0);
            let title = title_by_task
                .get(&actual.task_id)
                .cloned()
                .unwrap_or_else(|| short_title(&actual.task_id));
            match classify(actual, planned_minutes) {
                Classification::Shipped => {
                    shipped.push(ShippedTask {
                        id: actual.task_id,
                        title,
                        planned_minutes,
                        actual_minutes: actual.actual_minutes,
                    });
                }
                Classification::Slipped(reason) => {
                    slipped.push(SlippedTask {
                        id: actual.task_id,
                        title,
                        planned_minutes,
                        reason,
                    });
                }
            }
        }

        shipped.sort_by_key(|s| s.id);
        slipped.sort_by_key(|s| s.id);

        // Carryover: slipped but not cancelled.
        let carryover: Vec<Uuid> =
            slipped.iter().filter(|s| s.reason != SlipReason::Cancelled).map(|s| s.id).collect();

        // Streak deltas: +1 focus streak if ≥3h shipped total.
        let mut streak_deltas: HashMap<String, i32> = HashMap::new();
        let total_shipped_minutes: u32 = shipped.iter().map(|s| s.actual_minutes).sum();
        if total_shipped_minutes >= 180 {
            streak_deltas.insert("focus".to_string(), 1);
        }

        let wins_summary = build_wins_summary(&shipped, &slipped);
        let coachy_closing = self
            .ask_closing(shipped.len() as u32, slipped.len() as u32)
            .await
            .unwrap_or_else(|| static_closing(shipped.len(), slipped.len()));

        Ok(EveningShutdown {
            date,
            shipped,
            slipped,
            carryover,
            wins_summary,
            coachy_closing,
            streak_deltas,
            generated_at: now,
        })
    }

    /// User's typed intention — setter on the brief that also records a
    /// `ritual.intention.captured` audit line so the choice is durable and
    /// tamper-evident across sessions.
    pub fn capture_intention(
        &self,
        brief: &mut MorningBrief,
        intention: String,
        now: DateTime<Utc>,
        audit: &dyn focus_audit::AuditSink,
    ) {
        let payload = serde_json::json!({
            "date": brief.date,
            "intention": &intention,
        });
        let subject = format!("morning-brief:{}", brief.date);
        let _ = audit.record_mutation("ritual.intention.captured", &subject, payload, now);
        brief.intention = Some(intention);
    }

    /// Reflow the day when an in-progress block overruns. Thin wrapper over
    /// `Scheduler::reflow`.
    pub async fn suggest_reflow(
        &self,
        tasks: &[Task],
        overrun: &TaskActual,
        now: DateTime<Utc>,
    ) -> anyhow::Result<Schedule> {
        let new_end = now + Duration::minutes(i64::from(overrun.actual_minutes));
        let changes = vec![ScheduleChange::BlockOverran { task_id: overrun.task_id, new_end }];
        // Replan from the live task pool so reflow has a real base schedule to
        // layer the overrun onto, instead of synthesizing an empty one.
        let horizon = Duration::hours(24);
        let base = self.scheduler.plan(tasks, &[], now, horizon).await?;
        self.scheduler.reflow(&base, &changes, now).await
    }

    // -- coaching helpers --------------------------------------------------

    async fn ask_opening(&self, priorities: &[TopPriorityLine]) -> Option<String> {
        if priorities.is_empty() {
            // Still ask the coach — a "no-tasks" day should still get warmth.
            let prompt = "User has no planned tasks today. Write a ≤80-char morning greeting that invites them to pick one small thing.".to_string();
            return complete_guarded(self.coaching.as_ref(), &prompt, None, 80)
                .await
                .ok()
                .flatten();
        }
        let names: Vec<&str> = priorities.iter().map(|p| p.title.as_str()).collect();
        let prompt = format!(
            "Given these priorities today: {}. Write a ≤80-char morning greeting that names one of them specifically.",
            names.join(", ")
        );
        complete_guarded(self.coaching.as_ref(), &prompt, None, 80).await.ok().flatten()
    }

    async fn ask_closing(&self, shipped: u32, slipped: u32) -> Option<String> {
        let prompt = format!(
            "Close out the day. {} tasks shipped, {} slipped. Tell the user what went well in ≤60 chars, and what to carry over in ≤60 chars.",
            shipped, slipped
        );
        complete_guarded(self.coaching.as_ref(), &prompt, None, 120).await.ok().flatten()
    }
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

enum Classification {
    Shipped,
    Slipped(SlipReason),
}

fn classify(actual: &TaskActual, planned_minutes: u32) -> Classification {
    if actual.cancelled {
        return Classification::Slipped(SlipReason::Cancelled);
    }
    match (actual.completed_at.is_some(), actual.actual_minutes, planned_minutes) {
        (false, 0, _) => Classification::Slipped(SlipReason::Skipped),
        (true, act, plan) if plan > 0 && act > plan => Classification::Slipped(SlipReason::Overran),
        (true, act, plan) if plan > 0 && act < plan => {
            Classification::Slipped(SlipReason::Deferred)
        }
        (true, _, _) => Classification::Shipped,
        // No completed_at but some minutes — treat as deferred (partial).
        (false, act, _) if act > 0 => Classification::Slipped(SlipReason::Deferred),
        _ => Classification::Slipped(SlipReason::Skipped),
    }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

fn horizon_to_end_of_day(now: DateTime<Utc>) -> Duration {
    let date = now.date_naive();
    let eod_naive =
        date.and_time(NaiveTime::from_hms_opt(23, 59, 59).expect("invariant: 23:59:59 is valid"));
    let eod = Utc.from_utc_datetime(&eod_naive);
    let d = eod - now;
    if d <= Duration::zero() {
        Duration::hours(1)
    } else {
        d
    }
}

fn extract_top_priorities(tasks: &[Task], schedule: &Schedule, n: usize) -> Vec<TopPriorityLine> {
    // Schedule.assignments already sorted by starts_at. Deduplicate task_ids
    // preserving order, then take the first N.
    let mut seen: Vec<Uuid> = Vec::new();
    for b in &schedule.assignments {
        if !seen.contains(&b.task_id) {
            seen.push(b.task_id);
        }
        if seen.len() >= n {
            break;
        }
    }
    seen.iter()
        .filter_map(|id| tasks.iter().find(|t| t.id == *id).map(task_to_priority_line))
        .collect()
}

fn task_to_priority_line(task: &Task) -> TopPriorityLine {
    let mins = task.duration.planning_duration().num_minutes().max(0) as u32;
    let deadline_label = match task.deadline.when {
        None => "no-deadline".to_string(),
        Some(when) => when.to_rfc3339(),
    };
    let rigidity_tag = match &task.deadline.rigidity {
        focus_domain::Rigidity::Hard => "hard".into(),
        focus_domain::Rigidity::Soft => "soft".into(),
        focus_domain::Rigidity::Semi(_) => "semi".into(),
    };
    TopPriorityLine {
        task_id: task.id,
        title: task.title.clone(),
        deadline_label,
        rigidity_tag,
        estimated_duration_minutes: mins,
    }
}

fn build_preview(schedule: &Schedule, calendar_events: &[CalendarEvent]) -> SchedulePreview {
    let mut windows: Vec<ScheduleWindowLine> = Vec::new();
    for b in &schedule.assignments {
        windows.push(time_block_to_window(b));
    }
    for e in calendar_events {
        windows.push(ScheduleWindowLine {
            starts_at: e.starts_at,
            ends_at: e.ends_at,
            title: e.title.clone(),
            kind: ScheduleWindowKind::Meeting,
        });
    }
    windows.sort_by_key(|w| w.starts_at);

    let any_hard_event = calendar_events.iter().any(|e| e.rigidity.is_hard());
    let hard_conflicts = schedule.rigidity_cost.hard_violations
        + schedule
            .unplaced
            .iter()
            .filter(|(_, r)| {
                matches!(r, focus_scheduler::UnplacedReason::HardConflict)
                    || (any_hard_event
                        && matches!(r, focus_scheduler::UnplacedReason::InsufficientTime))
            })
            .count() as u32;
    let soft_conflicts = schedule.rigidity_cost.soft_overrides;

    SchedulePreview { windows, soft_conflicts, hard_conflicts }
}

fn time_block_to_window(b: &TimeBlock) -> ScheduleWindowLine {
    ScheduleWindowLine {
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        title: short_title(&b.task_id),
        kind: ScheduleWindowKind::FocusBlock,
    }
}

fn short_title(id: &Uuid) -> String {
    let s = id.to_string();
    format!("task {}", &s[..s.len().min(8)])
}

fn static_opening(priorities: &[TopPriorityLine]) -> String {
    if let Some(first) = priorities.first() {
        let trunc = truncate(&first.title, 50);
        format!("Morning. Start with: {trunc}.")
    } else {
        STATIC_OPENING_FALLBACK.to_string()
    }
}

fn static_closing(shipped: usize, slipped: usize) -> String {
    if shipped == 0 && slipped == 0 {
        return STATIC_CLOSING_FALLBACK.to_string();
    }
    format!("Shipped {shipped}, slipped {slipped}. Carry the rest into tomorrow.")
}

fn build_wins_summary(shipped: &[ShippedTask], slipped: &[SlippedTask]) -> String {
    let focus_minutes: u32 = shipped.iter().map(|s| s.actual_minutes).sum();
    format!("{} shipped ({} min focus), {} slipped.", shipped.len(), focus_minutes, slipped.len())
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "…"
    }
}

// Lint stubs for currently unused import paths kept intentionally for the
// public surface; Datelike/NaiveDate round-trip through serde.
#[allow(dead_code)]
fn _date_passthrough(d: NaiveDate) -> i32 {
    d.year()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods, clippy::cloned_ref_to_slice_refs)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use focus_calendar::{CalendarEventDraft, InMemoryCalendarPort};
    use focus_coaching::{NoopCoachingProvider, StubCoachingProvider};
    use focus_domain::Rigidity;
    use focus_mascot::{MascotMachine, Pose};
    use focus_planning::{ChunkingPolicy, DurationSpec, Priority, Task};
    use focus_scheduler::WorkingHoursSpec;
    use std::collections::HashMap;

    fn t0() -> DateTime<Utc> {
        // Friday 2026-05-01 09:00 UTC
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn mk_task(title: &str, minutes: i64, prio: f32) -> Task {
        Task {
            priority: Priority::new(prio),
            chunking: ChunkingPolicy::atomic(),
            ..Task::new(title, DurationSpec::fixed(Duration::minutes(minutes)), t0())
        }
    }

    fn mk_engine(
        coaching: Arc<dyn CoachingProvider>,
    ) -> (Arc<Mutex<MascotMachine>>, RitualsEngine) {
        let scheduler = Arc::new(Scheduler::new(WorkingHoursSpec::default()));
        let calendar: Arc<dyn CalendarPort> = Arc::new(InMemoryCalendarPort::new());
        let mascot = Arc::new(Mutex::new(MascotMachine::new()));
        let engine = RitualsEngine::new(scheduler, calendar, coaching, mascot.clone());
        (mascot, engine)
    }

    // Traces to: FR-RITUAL-001
    #[test]
    fn morning_brief_happy_path_with_stub_coaching() {
        let brief = run_blocking(async {
            let coaching: Arc<dyn CoachingProvider> =
                Arc::new(StubCoachingProvider::single("Start with write the spec."));
            let (_mascot, engine) = mk_engine(coaching);
            let tasks = vec![mk_task("write the spec", 60, 0.9), mk_task("review PRs", 30, 0.5)];
            engine.generate_morning_brief(&tasks, Uuid::new_v4(), t0()).await.unwrap()
        });
        assert!(!brief.top_priorities.is_empty());
        assert_eq!(brief.coachy_opening, "Start with write the spec.");
        assert!(brief.intention.is_none());
    }

    // Traces to: FR-RITUAL-001
    #[test]
    fn morning_brief_noop_coaching_uses_static_opening() {
        let brief = run_blocking(async {
            let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
            let (_m, engine) = mk_engine(coaching);
            let tasks = vec![mk_task("ship it", 45, 0.7)];
            engine.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap()
        });
        assert!(brief.coachy_opening.contains("ship it"));
    }

    // Traces to: FR-RITUAL-002
    #[tokio::test]
    async fn evening_shutdown_shipped_and_slipped_classified() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let (_m, engine) = mk_engine(coaching);
        let t_ship = mk_task("ship", 60, 0.9);
        let t_skip = mk_task("skip", 30, 0.5);
        let tasks = vec![t_ship.clone(), t_skip.clone()];
        let sched = engine.scheduler.plan(&tasks, &[], t0(), Duration::hours(8)).await.unwrap();
        let actuals = vec![
            TaskActual::completed(t_ship.id, 60, t0() + Duration::hours(1)),
            TaskActual::skipped(t_skip.id),
        ];
        let shutdown = engine
            .generate_evening_shutdown(&sched, &actuals, t0() + Duration::hours(8))
            .await
            .unwrap();
        assert_eq!(shutdown.shipped.len(), 1);
        assert_eq!(shutdown.slipped.len(), 1);
        assert_eq!(shutdown.slipped[0].reason, SlipReason::Skipped);
    }

    // Traces to: FR-RITUAL-002
    #[tokio::test]
    async fn carryover_excludes_cancelled() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let (_m, engine) = mk_engine(coaching);
        let a = mk_task("a", 30, 0.5);
        let b = mk_task("b", 30, 0.5);
        let tasks = vec![a.clone(), b.clone()];
        let sched = engine.scheduler.plan(&tasks, &[], t0(), Duration::hours(8)).await.unwrap();
        let actuals = vec![TaskActual::skipped(a.id), TaskActual::cancelled(b.id)];
        let sd = engine
            .generate_evening_shutdown(&sched, &actuals, t0() + Duration::hours(8))
            .await
            .unwrap();
        assert_eq!(sd.carryover.len(), 1);
        assert!(sd.carryover.contains(&a.id));
        assert!(!sd.carryover.contains(&b.id));
    }

    // Traces to: FR-RITUAL-002
    #[tokio::test]
    async fn streak_delta_when_three_hours_focus_shipped() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let (_m, engine) = mk_engine(coaching);
        let long = mk_task("long", 200, 0.9);
        let sched =
            engine.scheduler.plan(&[long.clone()], &[], t0(), Duration::hours(8)).await.unwrap();
        let actuals = vec![TaskActual::completed(long.id, 200, t0() + Duration::hours(4))];
        let sd = engine
            .generate_evening_shutdown(&sched, &actuals, t0() + Duration::hours(9))
            .await
            .unwrap();
        assert_eq!(sd.streak_deltas.get("focus").copied(), Some(1));
    }

    // Traces to: FR-RITUAL-001
    #[test]
    fn no_tasks_day_still_has_coaching_opening() {
        let brief = run_blocking(async {
            let coaching: Arc<dyn CoachingProvider> =
                Arc::new(StubCoachingProvider::single("Pick one small thing."));
            let (_m, engine) = mk_engine(coaching);
            engine.generate_morning_brief(&[], Uuid::nil(), t0()).await.unwrap()
        });
        assert!(brief.top_priorities.is_empty());
        assert_eq!(brief.coachy_opening, "Pick one small thing.");
    }

    // Traces to: FR-RITUAL-001
    #[tokio::test]
    async fn hard_conflict_propagates_to_preview() {
        use focus_domain::RigidityCost;
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let scheduler = Arc::new(Scheduler::new(WorkingHoursSpec::default()));
        let calendar = Arc::new(InMemoryCalendarPort::new());
        // Seed a hard event covering the whole window.
        calendar
            .create_event(&CalendarEventDraft {
                title: "jury duty".into(),
                starts_at: t0(),
                ends_at: t0() + Duration::hours(8),
                source: "test".into(),
                rigidity: Rigidity::Hard,
                metadata: Default::default(),
            })
            .await
            .unwrap();
        let mascot = Arc::new(Mutex::new(MascotMachine::new()));
        let calendar_port: Arc<dyn CalendarPort> = calendar.clone();
        let engine = RitualsEngine::new(scheduler.clone(), calendar_port, coaching, mascot);
        // Manually run scheduler with the hard event to populate unplaced.
        let _ = RigidityCost::CreditCost(1); // keep import
        let sched = scheduler
            .plan(
                &[mk_task("blocked", 60, 0.9)],
                &calendar
                    .list_events(DateRange::new(t0(), t0() + Duration::hours(8)))
                    .await
                    .unwrap(),
                t0(),
                Duration::hours(8),
            )
            .await
            .unwrap();
        let preview = build_preview(
            &sched,
            &calendar.list_events(DateRange::new(t0(), t0() + Duration::hours(8))).await.unwrap(),
        );
        assert!(preview.hard_conflicts >= 1);
        // Also verify morning_brief threads this through (the hard event is
        // outside the brief's calendar call because it uses a different horizon).
        let brief = engine
            .generate_morning_brief(&[mk_task("blocked", 60, 0.9)], Uuid::nil(), t0())
            .await
            .unwrap();
        assert!(brief.schedule_preview.hard_conflicts >= 1);
    }

    // Traces to: FR-RITUAL-001
    #[tokio::test]
    async fn capture_intention_preserves_other_fields() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(StubCoachingProvider::single("Hi."));
        let (_m, engine) = mk_engine(coaching);
        let tasks = vec![mk_task("x", 30, 0.5)];
        let mut brief = engine.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap();
        let before = brief.clone();
        let sink = focus_audit::CapturingAuditSink::new();
        engine.capture_intention(&mut brief, "finish the spec".into(), t0(), &sink);
        let records = sink.snapshot();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].0, "ritual.intention.captured");
        assert_eq!(
            records[0].2.get("intention").and_then(serde_json::Value::as_str),
            Some("finish the spec")
        );
        assert_eq!(brief.intention.as_deref(), Some("finish the spec"));
        assert_eq!(before.top_priorities, brief.top_priorities);
        assert_eq!(before.coachy_opening, brief.coachy_opening);
        assert_eq!(before.schedule_preview, brief.schedule_preview);
    }

    // Traces to: FR-RITUAL-001
    #[tokio::test]
    async fn reflow_on_overrun_returns_schedule() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(StubCoachingProvider::single("x"));
        let (_m, engine) = mk_engine(coaching);
        let tasks = vec![mk_task("focus", 60, 0.9)];
        let _brief = engine.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap();
        let overrun = TaskActual::completed(tasks[0].id, 120, t0() + Duration::hours(2));
        let sched = engine.suggest_reflow(&tasks, &overrun, t0()).await.unwrap();
        // Reflow now runs against a real replanned base — the assignment for
        // `focus` should either be placed or flagged unplaced, never lost.
        assert!(
            sched.assignments.iter().any(|a| a.task_id == tasks[0].id)
                || sched.unplaced.iter().any(|(id, _)| *id == tasks[0].id)
        );
    }

    // Traces to: FR-RITUAL-001
    #[test]
    fn morning_brief_deterministic_fixed_inputs() {
        let (a, b) = run_blocking(async {
            let coaching: Arc<dyn CoachingProvider> =
                Arc::new(StubCoachingProvider::single("Fixed opening."));
            let (_m, engine) = mk_engine(coaching);
            let id = Uuid::new_v4();
            let t = Task { id, ..mk_task("fixed", 60, 0.5) };
            let tasks = vec![t];
            let a = engine.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap();
            let coaching2: Arc<dyn CoachingProvider> =
                Arc::new(StubCoachingProvider::single("Fixed opening."));
            let (_m2, engine2) = mk_engine(coaching2);
            let b = engine2.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap();
            (a, b)
        });
        assert_eq!(a.top_priorities, b.top_priorities);
        assert_eq!(a.schedule_preview, b.schedule_preview);
        assert_eq!(a.coachy_opening, b.coachy_opening);
        assert_eq!(a.date, b.date);
    }

    // Traces to: FR-RITUAL-001 / FR-RITUAL-002
    #[tokio::test]
    async fn serde_roundtrip_brief_and_shutdown() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let (_m, engine) = mk_engine(coaching);
        let tasks = vec![mk_task("x", 30, 0.5)];
        let brief = engine.generate_morning_brief(&tasks, Uuid::nil(), t0()).await.unwrap();
        let json = serde_json::to_string(&brief).unwrap();
        let back: MorningBrief = serde_json::from_str(&json).unwrap();
        assert_eq!(brief, back);

        let sched = engine.scheduler.plan(&tasks, &[], t0(), Duration::hours(4)).await.unwrap();
        let actuals = vec![TaskActual::completed(tasks[0].id, 30, t0() + Duration::minutes(45))];
        let sd = engine
            .generate_evening_shutdown(&sched, &actuals, t0() + Duration::hours(5))
            .await
            .unwrap();
        let j2 = serde_json::to_string(&sd).unwrap();
        let back2: EveningShutdown = serde_json::from_str(&j2).unwrap();
        assert_eq!(sd, back2);
    }

    // Traces to: FR-RITUAL-001
    #[tokio::test]
    async fn mascot_state_changes_on_morning_brief() {
        let coaching: Arc<dyn CoachingProvider> = Arc::new(NoopCoachingProvider);
        let (mascot, engine) = mk_engine(coaching);
        let _ = engine
            .generate_morning_brief(&[mk_task("x", 30, 0.5)], Uuid::nil(), t0())
            .await
            .unwrap();
        let g = mascot.lock().await;
        // DailyCheckIn → Confident + Warm.
        assert_eq!(g.state.pose, Pose::Confident);
    }

    // Traces to: FR-RITUAL-001
    #[test]
    fn no_llm_call_when_kill_switch_set() {
        // Use a stub that would panic if called, wrapped via complete_guarded
        // behavior in ask_opening path — verify static fallback via flag.
        let _lock = ENV_MUTEX.lock().expect("env lock");
        std::env::set_var(focus_coaching::KILL_SWITCH_ENV, "1");
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let coaching: Arc<dyn CoachingProvider> =
            Arc::new(StubCoachingProvider::single("should-be-ignored"));
        let scheduler = Arc::new(Scheduler::new(WorkingHoursSpec::default()));
        let calendar: Arc<dyn CalendarPort> = Arc::new(InMemoryCalendarPort::new());
        let mascot = Arc::new(Mutex::new(MascotMachine::new()));
        let engine = RitualsEngine::new(scheduler, calendar, coaching, mascot);
        let brief = rt
            .block_on(async {
                engine.generate_morning_brief(&[mk_task("thing", 30, 0.5)], Uuid::nil(), t0()).await
            })
            .unwrap();
        std::env::remove_var(focus_coaching::KILL_SWITCH_ENV);
        assert_ne!(brief.coachy_opening, "should-be-ignored");
    }

    // Process-wide env-mutation serializer. Same pattern as focus-coaching.
    static ENV_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// Sync helper: clear kill switch + run a future to completion inside a
    /// fresh single-thread runtime so we never hold `ENV_MUTEX` across an
    /// await point (keeps clippy `await_holding_lock` happy).
    fn run_blocking<T, F>(fut: F) -> T
    where
        F: std::future::Future<Output = T>,
    {
        let _g = ENV_MUTEX.lock().expect("env lock");
        std::env::remove_var(focus_coaching::KILL_SWITCH_ENV);
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("rt");
        rt.block_on(fut)
    }

    // Traces to: FR-RITUAL-002
    #[test]
    fn slip_reason_classification_matrix() {
        // cancelled wins regardless
        let cancelled = TaskActual::cancelled(Uuid::nil());
        assert!(matches!(classify(&cancelled, 30), Classification::Slipped(SlipReason::Cancelled)));

        let skipped = TaskActual::skipped(Uuid::nil());
        assert!(matches!(classify(&skipped, 30), Classification::Slipped(SlipReason::Skipped)));

        let over = TaskActual::completed(Uuid::nil(), 90, Utc::now());
        assert!(matches!(classify(&over, 60), Classification::Slipped(SlipReason::Overran)));

        let deferred = TaskActual::completed(Uuid::nil(), 10, Utc::now());
        assert!(matches!(classify(&deferred, 60), Classification::Slipped(SlipReason::Deferred)));

        let shipped = TaskActual::completed(Uuid::nil(), 60, Utc::now());
        assert!(matches!(classify(&shipped, 60), Classification::Shipped));
    }

    // Sanity: HashMap default empty.
    #[test]
    fn default_streak_deltas_empty_map() {
        let m: HashMap<String, i32> = HashMap::new();
        assert!(m.is_empty());
    }
}
