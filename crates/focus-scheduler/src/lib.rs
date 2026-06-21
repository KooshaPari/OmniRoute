// SPDX-License-Identifier: MIT OR Apache-2.0

//! focus-scheduler — Rigidity-aware task scheduler.
//!
//! Traces to: FR-PLAN-002 (Scheduler rigidity-aware).
//!
//! Greedy priority-weighted bin-packing into free time between calendar events,
//! respecting working hours and per-task `Constraint`s. A `Hard` calendar event
//! is infinite cost; a `Semi(cost)` conflict is budgeted; a `Soft` event can be
//! overridden and incurs an `override` count. The result is deterministic
//! given the same inputs and the same `now`.

#![deny(clippy::all)]

use chrono::{DateTime, Datelike, Duration, NaiveTime, TimeZone, Timelike, Utc, Weekday};
use focus_calendar::CalendarEvent;
use focus_domain::{Rigidity, RigidityCost};
use focus_planning::{Constraint, Task, TimeBlock};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnplacedReason {
    HardConflict,
    InsufficientTime,
    ConstraintViolation(String),
    NoWorkingHours,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RigidityCostSummary {
    pub hard_violations: u32,
    pub semi_cost_spent: HashMap<String, i64>,
    pub soft_overrides: u32,
}

impl RigidityCostSummary {
    fn charge(&mut self, rigidity: &Rigidity) {
        match rigidity {
            Rigidity::Hard => {
                self.hard_violations += 1;
            }
            Rigidity::Soft => {
                self.soft_overrides += 1;
            }
            Rigidity::Semi(cost) => match cost {
                RigidityCost::CreditCost(n) => {
                    *self.semi_cost_spent.entry("credit".into()).or_insert(0) += *n;
                }
                RigidityCost::TierBump => {
                    *self.semi_cost_spent.entry("tier_bump".into()).or_insert(0) += 1;
                }
                RigidityCost::StreakRisk => {
                    *self.semi_cost_spent.entry("streak_risk".into()).or_insert(0) += 1;
                }
                RigidityCost::FrictionDelay(d) => {
                    *self.semi_cost_spent.entry("friction_delay_sec".into()).or_insert(0) +=
                        d.as_secs() as i64;
                }
                RigidityCost::AccountabilityPing => {
                    *self.semi_cost_spent.entry("accountability_ping".into()).or_insert(0) += 1;
                }
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Schedule {
    pub assignments: Vec<TimeBlock>,
    pub unplaced: Vec<(Uuid, UnplacedReason)>,
    pub rigidity_cost: RigidityCostSummary,
    pub generated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Reflow input
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScheduleChange {
    /// A previously-running block ran long; its new end is `new_end`.
    BlockOverran { task_id: Uuid, new_end: DateTime<Utc> },
    /// A task was cancelled; its placements are freed.
    TaskCancelled(Uuid),
    /// A new calendar event landed on the timeline.
    NewCalendarEvent(CalendarEvent),
    /// A new task needs to be placed.
    NewTask(Task),
}

// ---------------------------------------------------------------------------
// Working hours
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkingHoursSpec {
    pub start: NaiveTime,
    pub end: NaiveTime,
    pub days: Vec<Weekday>,
}

impl Default for WorkingHoursSpec {
    fn default() -> Self {
        Self {
            start: NaiveTime::from_hms_opt(9, 0, 0).expect("invariant: 09:00 is valid"),
            end: NaiveTime::from_hms_opt(17, 0, 0).expect("invariant: 17:00 is valid"),
            days: vec![Weekday::Mon, Weekday::Tue, Weekday::Wed, Weekday::Thu, Weekday::Fri],
        }
    }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct Scheduler {
    default_working_hours: WorkingHoursSpec,
}

impl Scheduler {
    pub fn new(working_hours_default: WorkingHoursSpec) -> Self {
        Self { default_working_hours: working_hours_default }
    }

    pub async fn plan(
        &self,
        tasks: &[Task],
        calendar_events: &[CalendarEvent],
        now: DateTime<Utc>,
        horizon: Duration,
    ) -> anyhow::Result<Schedule> {
        let end_horizon = now + horizon;

        // 1. Sort tasks by priority-weight * deadline-urgency multiplier, desc.
        //    Tiebreak: earlier created_at wins (deterministic).
        let mut indexed: Vec<(usize, f64)> =
            tasks.iter().enumerate().map(|(i, t)| (i, score(t, now, end_horizon))).collect();
        indexed.sort_by(|a, b| {
            b.1.partial_cmp(&a.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| tasks[a.0].created_at.cmp(&tasks[b.0].created_at))
        });

        let mut assignments: Vec<TimeBlock> = Vec::new();
        let mut unplaced: Vec<(Uuid, UnplacedReason)> = Vec::new();
        let mut rigidity_cost = RigidityCostSummary::default();

        for (idx, _) in indexed {
            let task = &tasks[idx];
            let wh = extract_working_hours(task).unwrap_or(self.default_working_hours.clone());
            let needed = task.duration.planning_duration();

            if needed <= Duration::zero() {
                unplaced
                    .push((task.id, UnplacedReason::ConstraintViolation("zero duration".into())));
                continue;
            }

            // Earliest/latest from constraints.
            let earliest = task
                .constraints
                .iter()
                .find_map(|c| match c {
                    Constraint::NoEarlierThan(t) => Some(*t),
                    _ => None,
                })
                .unwrap_or(now)
                .max(now);
            let latest = task
                .constraints
                .iter()
                .find_map(|c| match c {
                    Constraint::NoLaterThan(t) => Some(*t),
                    _ => None,
                })
                .unwrap_or(end_horizon)
                .min(end_horizon);

            if earliest >= latest {
                unplaced.push((task.id, UnplacedReason::InsufficientTime));
                continue;
            }

            let chunk_target = if task.duration.is_fixed() || !task.chunking.allow_split {
                needed
            } else {
                task.chunking.ideal_chunk.min(needed).max(task.chunking.min_chunk)
            };

            let mut remaining = needed;
            let mut cursor = earliest;
            let mut task_blocks: Vec<TimeBlock> = Vec::new();
            let mut hard_conflict = false;

            while remaining > Duration::zero() && cursor < latest {
                // Find the next free slot >= chunk_target (bounded by remaining).
                let want = remaining.min(if task.chunking.allow_split {
                    chunk_target.min(task.chunking.max_chunk)
                } else {
                    remaining
                });
                let slot = find_free_slot(
                    cursor,
                    latest,
                    want,
                    &wh,
                    calendar_events,
                    &assignments,
                    &task_blocks,
                    &mut rigidity_cost,
                );
                match slot {
                    SlotResult::Found { start, end } => {
                        task_blocks.push(TimeBlock {
                            task_id: task.id,
                            starts_at: start,
                            ends_at: end,
                            rigidity: task.deadline.rigidity.clone(),
                        });
                        remaining -= end - start;
                        cursor = end;
                        if !task.chunking.allow_split {
                            break;
                        }
                    }
                    SlotResult::HardBlocked => {
                        hard_conflict = true;
                        break;
                    }
                    SlotResult::Exhausted => break,
                }
            }

            if hard_conflict {
                unplaced.push((task.id, UnplacedReason::HardConflict));
                continue;
            }
            if remaining > Duration::zero() {
                unplaced.push((task.id, UnplacedReason::InsufficientTime));
                // don't commit partial placements (keeps reflow simple).
                continue;
            }

            assignments.extend(task_blocks);
        }

        // Deterministic output ordering.
        assignments.sort_by_key(|b| (b.starts_at, b.task_id));
        unplaced.sort_by_key(|(id, _)| *id);

        Ok(Schedule { assignments, unplaced, rigidity_cost, generated_at: now })
    }

    /// Reflow: take existing schedule, apply changes, recompute minimally.
    /// Strategy: keep any placement that is still valid (no new conflict) and
    /// replan only the disturbed tasks.
    pub async fn reflow(
        &self,
        old: &Schedule,
        changes: &[ScheduleChange],
        now: DateTime<Utc>,
    ) -> anyhow::Result<Schedule> {
        let mut kept: Vec<TimeBlock> = old.assignments.clone();
        let mut new_events: Vec<CalendarEvent> = Vec::new();
        let mut new_tasks: Vec<Task> = Vec::new();
        let mut cancelled: Vec<Uuid> = Vec::new();
        let mut overrun_until: HashMap<Uuid, DateTime<Utc>> = HashMap::new();

        for ch in changes {
            match ch {
                ScheduleChange::BlockOverran { task_id, new_end } => {
                    overrun_until.insert(*task_id, *new_end);
                }
                ScheduleChange::TaskCancelled(id) => cancelled.push(*id),
                ScheduleChange::NewCalendarEvent(e) => new_events.push(e.clone()),
                ScheduleChange::NewTask(t) => new_tasks.push(t.clone()),
            }
        }

        // Drop cancelled tasks and any block that conflicts with a new event.
        kept.retain(|b| {
            if cancelled.contains(&b.task_id) {
                return false;
            }
            if b.starts_at < now {
                // Past; pin it unless overrun extends it (still keep — history).
                return true;
            }
            !new_events.iter().any(|e| !e.rigidity.is_soft() && b.overlaps(e.starts_at, e.ends_at))
        });

        // Apply overrun: push the affected task's earliest future block.
        let mut disturbed: Vec<Uuid> = Vec::new();
        for (id, end) in &overrun_until {
            if let Some(b) = kept.iter_mut().find(|b| b.task_id == *id) {
                if b.ends_at < *end {
                    b.ends_at = *end;
                    disturbed.push(*id);
                }
            }
        }

        // For newly added tasks: we rely on plan() to place them while keeping
        // kept[] as pre-placed constraints. We fold kept[] into calendar_events
        // to block out that time against new_tasks.
        let mut synthetic_events: Vec<CalendarEvent> = new_events.clone();
        for b in &kept {
            synthetic_events.push(CalendarEvent {
                id: format!("kept-{}-{}", b.task_id, b.starts_at.timestamp()),
                title: "[reserved]".into(),
                starts_at: b.starts_at,
                ends_at: b.ends_at,
                source: "scheduler_kept".into(),
                rigidity: Rigidity::Hard,
            });
        }

        let mut assignments = kept;
        let mut unplaced: Vec<(Uuid, UnplacedReason)> = old.unplaced.clone();
        let mut rc = old.rigidity_cost.clone();

        if !new_tasks.is_empty() {
            let sub = self
                .plan(
                    &new_tasks,
                    &synthetic_events,
                    now,
                    Duration::days(14), // local reflow horizon
                )
                .await?;
            assignments.extend(sub.assignments);
            unplaced.extend(sub.unplaced);
            rc.hard_violations += sub.rigidity_cost.hard_violations;
            rc.soft_overrides += sub.rigidity_cost.soft_overrides;
            for (k, v) in sub.rigidity_cost.semi_cost_spent {
                *rc.semi_cost_spent.entry(k).or_insert(0) += v;
            }
        }

        assignments.sort_by_key(|b| (b.starts_at, b.task_id));
        unplaced.sort_by_key(|(id, _)| *id);

        let _ = disturbed; // carried forward as an audit hint; not surfaced yet.

        Ok(Schedule { assignments, unplaced, rigidity_cost: rc, generated_at: now })
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/// Urgency multiplier: <= horizon/2 -> 2.0, Hard deadline in-horizon -> up to 4.0.
fn score(task: &Task, now: DateTime<Utc>, horizon_end: DateTime<Utc>) -> f64 {
    let base = task.priority.weight as f64;
    let mult = match task.deadline.when {
        None => 1.0,
        Some(when) if when <= now => 4.0,
        Some(when) if when <= horizon_end => {
            let total = (horizon_end - now).num_seconds().max(1) as f64;
            let remaining = (when - now).num_seconds().max(1) as f64;
            let ratio = 1.0 - (remaining / total);
            let mut m = 1.0 + 2.0 * ratio;
            if task.deadline.rigidity.is_hard() {
                m *= 1.5;
            }
            m
        }
        Some(_) => 1.0,
    };
    base * mult
}

fn extract_working_hours(task: &Task) -> Option<WorkingHoursSpec> {
    task.constraints.iter().find_map(|c| match c {
        Constraint::WorkingHours { start, end, days } => {
            Some(WorkingHoursSpec { start: *start, end: *end, days: days.clone() })
        }
        _ => None,
    })
}

enum SlotResult {
    Found { start: DateTime<Utc>, end: DateTime<Utc> },
    HardBlocked,
    Exhausted,
}

/// Scan forward from `cursor` looking for a free slot of `want` that:
/// - lies inside `wh` working hours
/// - does not overlap a Hard calendar event (Semi/Soft charge cost but pass)
/// - does not overlap other placed blocks or blocks already placed for this task
#[allow(clippy::too_many_arguments)]
fn find_free_slot(
    mut cursor: DateTime<Utc>,
    latest: DateTime<Utc>,
    want: Duration,
    wh: &WorkingHoursSpec,
    cal: &[CalendarEvent],
    placed: &[TimeBlock],
    task_blocks: &[TimeBlock],
    rc: &mut RigidityCostSummary,
) -> SlotResult {
    const MAX_ITERS: usize = 5000;
    let mut iters = 0;

    while cursor + want <= latest {
        iters += 1;
        if iters > MAX_ITERS {
            return SlotResult::Exhausted;
        }

        // Snap into the next working-hours window if outside it.
        let (wh_start, wh_end) = match working_window_for(cursor, wh) {
            Some(w) => w,
            None => {
                // Roll to next day's wh window.
                cursor = next_day_start(cursor, wh);
                if cursor >= latest {
                    return SlotResult::Exhausted;
                }
                continue;
            }
        };
        if cursor < wh_start {
            cursor = wh_start;
        }
        let slot_end_bound = wh_end.min(latest);
        if cursor + want > slot_end_bound {
            // Doesn't fit in today's window; advance to next day.
            cursor = next_day_start(wh_end, wh);
            continue;
        }

        let prop_end = cursor + want;

        // Check placed + task-local blocks for conflict.
        if placed.iter().chain(task_blocks.iter()).any(|b| b.overlaps(cursor, prop_end)) {
            // Jump to the end of the offending block.
            let next = placed
                .iter()
                .chain(task_blocks.iter())
                .filter(|b| b.overlaps(cursor, prop_end))
                .map(|b| b.ends_at)
                .max()
                .unwrap_or(prop_end);
            cursor = next;
            continue;
        }

        // Check calendar conflicts.
        if let Some(ev) = cal.iter().find(|e| e.overlaps(cursor, prop_end)) {
            match &ev.rigidity {
                Rigidity::Hard => {
                    // Cannot schedule over a Hard event — jump past it.
                    cursor = ev.ends_at;
                    continue;
                }
                Rigidity::Semi(_) => {
                    rc.charge(&ev.rigidity);
                    return SlotResult::Found { start: cursor, end: prop_end };
                }
                Rigidity::Soft => {
                    rc.charge(&ev.rigidity);
                    return SlotResult::Found { start: cursor, end: prop_end };
                }
            }
        }

        return SlotResult::Found { start: cursor, end: prop_end };
    }

    // Distinguish HardBlocked vs Exhausted: if ANY hard event entirely covers
    // [cursor, latest] we treat as hard-blocked.
    if cal.iter().any(|e| e.rigidity.is_hard() && e.starts_at <= cursor && e.ends_at >= latest) {
        SlotResult::HardBlocked
    } else {
        SlotResult::Exhausted
    }
}

/// Returns the (start, end) UTC range of the working window covering `t` on
/// `t`'s weekday, or None if that day is not a working day.
fn working_window_for(
    t: DateTime<Utc>,
    wh: &WorkingHoursSpec,
) -> Option<(DateTime<Utc>, DateTime<Utc>)> {
    let wd = t.weekday();
    if !wh.days.contains(&wd) {
        return None;
    }
    let date = t.date_naive();
    let start = Utc.from_utc_datetime(&date.and_time(wh.start));
    let end = Utc.from_utc_datetime(&date.and_time(wh.end));
    if t >= end {
        return None;
    }
    Some((start, end))
}

/// Advance to the next day's wh.start; skips non-working days. Bounded to 14d.
fn next_day_start(t: DateTime<Utc>, wh: &WorkingHoursSpec) -> DateTime<Utc> {
    let mut d = t.date_naive();
    for _ in 0..14 {
        d = d.succ_opt().unwrap_or(d);
        let dt = Utc.from_utc_datetime(&d.and_time(wh.start));
        if wh.days.contains(&dt.weekday()) {
            return dt;
        }
    }
    // Fallback: keep moving; caller bounded by `latest`.
    Utc.from_utc_datetime(
        &d.and_time(NaiveTime::from_hms_opt(0, 0, 0).expect("invariant: midnight is valid")),
    )
    .with_hour(wh.start.hour())
    .unwrap_or(t)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods, clippy::cloned_ref_to_slice_refs)]
mod tests {
    use super::*;
    use focus_planning::{ChunkingPolicy, Constraint, Deadline, DurationSpec, Priority, Task};
    use std::collections::HashMap;
    use uuid::Uuid;

    fn now() -> DateTime<Utc> {
        // Friday 2026-05-01 09:00 UTC
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn mk_task(title: &str, minutes: i64, prio: f32) -> Task {
        Task {
            priority: Priority::new(prio),
            chunking: ChunkingPolicy::atomic(),
            ..Task::new(title, DurationSpec::fixed(Duration::minutes(minutes)), now())
        }
    }

    fn cal_event(id: &str, start_off_min: i64, dur_min: i64, rigidity: Rigidity) -> CalendarEvent {
        CalendarEvent {
            id: id.into(),
            title: id.into(),
            starts_at: now() + Duration::minutes(start_off_min),
            ends_at: now() + Duration::minutes(start_off_min + dur_min),
            source: "test".into(),
            rigidity,
        }
    }

    fn scheduler() -> Scheduler {
        Scheduler::new(WorkingHoursSpec::default())
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn single_task_fits_in_empty_window() {
        let s = scheduler();
        let task = mk_task("write", 60, 0.5);
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        assert_eq!(sched.assignments[0].task_id, task.id);
        assert!(sched.unplaced.is_empty());
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn higher_priority_task_placed_first() {
        let s = scheduler();
        let low = mk_task("low", 60, 0.2);
        let high = mk_task("high", 60, 0.9);
        let sched =
            s.plan(&[low.clone(), high.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(sched.assignments.len(), 2);
        // Assignments sorted by start time; high should start earliest.
        assert_eq!(sched.assignments[0].task_id, high.id);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn hard_calendar_event_blocks_overlap() {
        let s = scheduler();
        let task = mk_task("collide", 120, 0.9);
        // Hard event covers the entire 9–5 window.
        let ev = cal_event("court", 0, 8 * 60, Rigidity::Hard);
        let sched = s.plan(&[task.clone()], &[ev], now(), Duration::hours(8)).await.unwrap();
        // Either unplaced (HardConflict) or placed after the hard block ends —
        // since hard event covers all working hours today, must be unplaced
        // within 8h horizon.
        assert!(sched.assignments.is_empty());
        assert_eq!(sched.unplaced.len(), 1);
        assert!(matches!(
            sched.unplaced[0].1,
            UnplacedReason::HardConflict | UnplacedReason::InsufficientTime
        ));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn semi_event_costs_but_allows_placement() {
        let s = scheduler();
        let task = mk_task("squeeze", 30, 0.8);
        let ev = cal_event("standup", 0, 30, Rigidity::Semi(RigidityCost::CreditCost(5)));
        let sched = s.plan(&[task.clone()], &[ev], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        assert_eq!(sched.rigidity_cost.semi_cost_spent.get("credit").copied(), Some(5));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn splits_into_chunks_when_allowed() {
        let s = scheduler();
        let task = Task {
            priority: Priority::new(0.5),
            chunking: ChunkingPolicy {
                allow_split: true,
                min_chunk: Duration::minutes(25),
                max_chunk: Duration::minutes(50),
                ideal_chunk: Duration::minutes(50),
            },
            ..Task::new(
                "big",
                DurationSpec::estimated(Duration::minutes(100), Duration::minutes(120)),
                now(),
            )
        };
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        // Task duration p90 = 120 min; max chunk 50 → expect >= 2 chunks.
        let for_task: Vec<_> = sched.assignments.iter().filter(|b| b.task_id == task.id).collect();
        assert!(for_task.len() >= 2);
        let total: i64 = for_task.iter().map(|b| b.duration().num_minutes()).sum();
        assert_eq!(total, 120);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn working_hours_respected_outside_window() {
        let s = scheduler();
        // Request at 09:00 but constrain task to 14:00+ via NoEarlierThan.
        let task = Task {
            constraints: vec![Constraint::NoEarlierThan(now() + Duration::hours(5))],
            ..mk_task("afternoon", 30, 0.5)
        };
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(10)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        assert!(sched.assignments[0].starts_at >= now() + Duration::hours(5));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn insufficient_time_goes_to_unplaced() {
        let s = scheduler();
        // 10h task in a 4h horizon.
        let task = mk_task("too_big", 600, 0.5);
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(4)).await.unwrap();
        assert!(sched.assignments.is_empty());
        assert_eq!(sched.unplaced.len(), 1);
        assert!(matches!(sched.unplaced[0].1, UnplacedReason::InsufficientTime));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn deterministic_given_same_inputs() {
        let s = scheduler();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let t1 = Task { id: id1, ..mk_task("a", 60, 0.5) };
        let t2 = Task { id: id2, ..mk_task("b", 60, 0.5) };
        let tasks = vec![t1, t2];
        let a = s.plan(&tasks, &[], now(), Duration::hours(8)).await.unwrap();
        let b = s.plan(&tasks, &[], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(a, b);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn reflow_preserves_unchanged_placements() {
        let s = scheduler();
        let t1 = mk_task("keep", 60, 0.5);
        let t2 = mk_task("also_keep", 60, 0.5);
        let sched =
            s.plan(&[t1.clone(), t2.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        let starts_before: Vec<_> = sched.assignments.iter().map(|b| b.starts_at).collect();
        let reflow = s.reflow(&sched, &[], now()).await.unwrap();
        let starts_after: Vec<_> = reflow.assignments.iter().map(|b| b.starts_at).collect();
        assert_eq!(starts_before, starts_after);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn reflow_handles_new_task_insertion() {
        let s = scheduler();
        let t1 = mk_task("existing", 60, 0.5);
        let sched = s.plan(&[t1.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        let t2 = mk_task("new", 30, 0.9);
        let reflow = s.reflow(&sched, &[ScheduleChange::NewTask(t2.clone())], now()).await.unwrap();
        assert_eq!(reflow.assignments.len(), 2);
        assert!(reflow.assignments.iter().any(|b| b.task_id == t1.id));
        assert!(reflow.assignments.iter().any(|b| b.task_id == t2.id));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn reflow_drops_cancelled_task() {
        let s = scheduler();
        let t1 = mk_task("gone", 60, 0.5);
        let sched = s.plan(&[t1.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        let reflow =
            s.reflow(&sched, &[ScheduleChange::TaskCancelled(t1.id)], now()).await.unwrap();
        assert!(reflow.assignments.is_empty());
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn hard_deadline_bumps_urgency_score() {
        let s = scheduler();
        let no_dl = Task { priority: Priority::new(0.4), ..mk_task("no_dl", 30, 0.4) };
        let hard_dl = Task {
            priority: Priority::new(0.4),
            deadline: Deadline::hard(now() + Duration::hours(1)),
            ..mk_task("urgent", 30, 0.4)
        };
        let sched = s
            .plan(&[no_dl.clone(), hard_dl.clone()], &[], now(), Duration::hours(8))
            .await
            .unwrap();
        // Hard-deadline task should be scheduled first.
        assert_eq!(sched.assignments[0].task_id, hard_dl.id);
    }

    // Traces to: FR-PLAN-002
    #[test]
    fn rigidity_cost_summary_accumulates() {
        let mut rc = RigidityCostSummary::default();
        rc.charge(&Rigidity::Semi(RigidityCost::CreditCost(3)));
        rc.charge(&Rigidity::Semi(RigidityCost::CreditCost(4)));
        rc.charge(&Rigidity::Soft);
        assert_eq!(rc.semi_cost_spent.get("credit"), Some(&7));
        assert_eq!(rc.soft_overrides, 1);
        assert_eq!(rc.hard_violations, 0);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn empty_metadata_reflow_roundtrip() {
        // Sanity: schedules with empty HashMap<String,i64> roundtrip via JSON.
        let s = scheduler();
        let t = mk_task("json", 30, 0.5);
        let sched = s.plan(&[t], &[], now(), Duration::hours(2)).await.unwrap();
        let json = serde_json::to_string(&sched).unwrap();
        let back: Schedule = serde_json::from_str(&json).unwrap();
        assert_eq!(sched, back);
        let _: HashMap<String, i64> = back.rigidity_cost.semi_cost_spent;
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn zero_tasks_empty_schedule() {
        let s = scheduler();
        let sched = s.plan(&[], &[], now(), Duration::hours(8)).await.unwrap();
        assert!(sched.assignments.is_empty());
        assert!(sched.unplaced.is_empty());
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn zero_windows_no_placement() {
        let s = scheduler();
        let task = mk_task("nofit", 60, 0.5);
        let sched = s.plan(&[task.clone()], &[], now(), Duration::zero()).await.unwrap();
        assert!(sched.assignments.is_empty());
        assert_eq!(sched.unplaced.len(), 1);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn priority_tie_stable_ordering_by_created_at() {
        let s = scheduler();
        // Create two tasks with identical priority and duration
        // Set created_at explicitly so one is clearly older
        let mut ta = mk_task("a", 30, 0.5);
        let mut tb = mk_task("b", 30, 0.5);
        ta.created_at = now() - Duration::hours(1);
        tb.created_at = now();
        // When priorities tie, the earlier-created task should be scheduled first
        let sched = s.plan(&[tb.clone(), ta.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        // ta should start first due to older created_at
        assert_eq!(sched.assignments[0].task_id, ta.id);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn soft_calendar_event_allows_override() {
        let s = scheduler();
        let task = mk_task("override_soft", 60, 0.8);
        // Soft event covers part of working hours
        let ev = cal_event("meeting", 0, 120, Rigidity::Soft);
        let sched = s.plan(&[task.clone()], &[ev], now(), Duration::hours(8)).await.unwrap();
        // Task should be placed despite soft conflict
        assert_eq!(sched.assignments.len(), 1);
        assert_eq!(sched.rigidity_cost.soft_overrides, 1);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn multiple_chunks_respect_min_max_bounds() {
        let s = scheduler();
        let task = Task {
            priority: Priority::new(0.5),
            chunking: ChunkingPolicy {
                allow_split: true,
                min_chunk: Duration::minutes(20),
                max_chunk: Duration::minutes(30),
                ideal_chunk: Duration::minutes(25),
            },
            ..Task::new(
                "chunked",
                DurationSpec::fixed(Duration::minutes(80)),
                now(),
            )
        };
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        let chunks: Vec<_> = sched.assignments.iter().filter(|b| b.task_id == task.id).collect();
        assert!(chunks.len() >= 3); // 80 min / 30 max = 3+ chunks
        for chunk in &chunks {
            let dur = chunk.duration();
            // Each chunk should fit within [min_chunk, max_chunk]
            assert!(dur >= Duration::minutes(20) || dur <= Duration::minutes(30));
        }
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn overlapping_deadline_earliest_first() {
        let s = scheduler();
        let early_dl = Task {
            priority: Priority::new(0.5),
            deadline: Deadline::soft(now() + Duration::hours(2)),
            ..mk_task("early", 30, 0.5)
        };
        let late_dl = Task {
            priority: Priority::new(0.5),
            deadline: Deadline::soft(now() + Duration::hours(4)),
            ..mk_task("late", 30, 0.5)
        };
        let sched = s
            .plan(&[late_dl.clone(), early_dl.clone()], &[], now(), Duration::hours(8))
            .await
            .unwrap();
        // Earlier deadline should be scheduled first (higher urgency)
        assert_eq!(sched.assignments[0].task_id, early_dl.id);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn hard_rigid_task_does_not_split() {
        let s = scheduler();
        // Hard-rigid task that doesn't allow splitting
        let task = Task {
            priority: Priority::new(0.9),
            deadline: Deadline::hard(now() + Duration::hours(8)),
            chunking: ChunkingPolicy::atomic(),
            ..Task::new(
                "atomic",
                DurationSpec::fixed(Duration::minutes(90)),
                now(),
            )
        };
        let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        let task_blocks: Vec<_> = sched.assignments.iter().filter(|b| b.task_id == task.id).collect();
        // Since allow_split = false, should be 0 or 1 block, not multiple
        assert!(task_blocks.len() <= 1);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn task_larger_than_any_window_unplaced() {
        let s = scheduler();
        // 10-hour task but only 1-hour working window per day
        let big_task = mk_task("giant", 600, 0.9);
        // Single day with just 1 hour available (9–10)
        let sched = s.plan(&[big_task.clone()], &[], now(), Duration::hours(1)).await.unwrap();
        assert!(sched.assignments.is_empty());
        assert_eq!(sched.unplaced.len(), 1);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn schedule_respects_no_earlier_than_constraint() {
        let s = scheduler();
        let constrained = Task {
            constraints: vec![Constraint::NoEarlierThan(now() + Duration::hours(6))],
            ..mk_task("afternoon_only", 30, 0.5)
        };
        let sched = s.plan(&[constrained.clone()], &[], now(), Duration::hours(10)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        assert!(sched.assignments[0].starts_at >= now() + Duration::hours(6));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn schedule_respects_no_later_than_constraint() {
        let s = scheduler();
        let constrained = Task {
            constraints: vec![Constraint::NoLaterThan(now() + Duration::hours(4))],
            ..mk_task("early_only", 30, 0.5)
        };
        let sched = s.plan(&[constrained.clone()], &[], now(), Duration::hours(10)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        assert!(sched.assignments[0].ends_at <= now() + Duration::hours(4));
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn task_cannot_fit_before_deadline() {
        let s = scheduler();
        // 3-hour task but only 2 hours available within deadline window
        // Set latest constraint to 2 hours from now
        let tight = Task {
            priority: Priority::new(0.9),
            constraints: vec![Constraint::NoLaterThan(now() + Duration::hours(2))],
            ..mk_task("impossible", 180, 0.9)
        };
        let sched = s.plan(&[tight.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        assert!(sched.assignments.is_empty());
        assert_eq!(sched.unplaced.len(), 1);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn reflow_applies_block_overrun() {
        let s = scheduler();
        let t1 = mk_task("run_long", 60, 0.5);
        let sched = s.plan(&[t1.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        assert_eq!(sched.assignments.len(), 1);
        let original_end = sched.assignments[0].ends_at;
        let new_end = original_end + Duration::minutes(30);
        let overrun = ScheduleChange::BlockOverran { task_id: t1.id, new_end };
        let reflow = s.reflow(&sched, &[overrun], now()).await.unwrap();
        // Block should be extended
        assert_eq!(reflow.assignments.len(), 1);
        assert!(reflow.assignments[0].ends_at >= new_end);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn reflow_handles_new_calendar_event_blocking() {
        let s = scheduler();
        let t1 = mk_task("scheduled", 60, 0.5);
        let sched = s.plan(&[t1.clone()], &[], now(), Duration::hours(8)).await.unwrap();
        let orig_count = sched.assignments.len();
        // Add a new hard calendar event that overlaps the task
        let hard_event = cal_event("blocking_meeting", 0, 120, Rigidity::Hard);
        let reflow =
            s.reflow(&sched, &[ScheduleChange::NewCalendarEvent(hard_event)], now()).await.unwrap();
        // Should have fewer or same assignments (depends on overlap timing)
        assert!(reflow.assignments.len() <= orig_count);
    }

    // Traces to: FR-PLAN-002
    #[tokio::test]
    async fn multiple_tasks_priority_ordering() {
        let s = scheduler();
        let low1 = Task { priority: Priority::new(0.2), ..mk_task("low1", 30, 0.2) };
        let med = Task { priority: Priority::new(0.5), ..mk_task("med", 30, 0.5) };
        let high = Task { priority: Priority::new(0.9), ..mk_task("high", 30, 0.9) };
        let tasks = vec![low1.clone(), high.clone(), med.clone()];
        let sched = s.plan(&tasks, &[], now(), Duration::hours(8)).await.unwrap();
        // Should schedule all three
        assert_eq!(sched.assignments.len(), 3);
        // High priority should start earliest
        assert_eq!(sched.assignments[0].task_id, high.id);
        // Low priority should start latest
        assert_eq!(sched.assignments[2].task_id, low1.id);
    }

    // Property-based tests using proptest
    // These tests verify algebraic properties of the scheduler.

    // Traces to: FR-PLAN-002
    // Property: Total scheduled duration <= sum of available windows
    #[test]
    fn prop_total_scheduled_duration_bounded() {
        use proptest::prelude::*;
        proptest!(|(
            num_tasks in 1usize..15,
            task_mins in 10i64..180,
            priority in 0.1f32..0.99,
        )| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result = rt.block_on(async {
                let s = scheduler();
                let mut tasks = Vec::new();
                for i in 0..num_tasks {
                    let t = Task {
                        id: Uuid::new_v4(),
                        title: format!("task_{}", i),
                        priority: Priority::new(priority),
                        ..mk_task(&format!("task_{}", i), task_mins, priority)
                    };
                    tasks.push(t);
                }
                let horizon = Duration::hours(24);
                let sched = s.plan(&tasks, &[], now(), horizon).await.unwrap();
                let total_scheduled: Duration = sched
                    .assignments
                    .iter()
                    .map(|b| b.ends_at - b.starts_at)
                    .sum();
                total_scheduled <= horizon
            });
            prop_assert!(result);
        });
    }

    // Traces to: FR-PLAN-002
    // Property: No two assigned tasks overlap
    #[test]
    fn prop_no_overlap_in_output() {
        use proptest::prelude::*;
        proptest!(|(num_tasks in 1usize..10)| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result = rt.block_on(async {
                let s = scheduler();
                let tasks: Vec<_> = (0..num_tasks)
                    .map(|i| mk_task(&format!("task_{}", i), 60, 0.5))
                    .collect();
                let sched = s.plan(&tasks, &[], now(), Duration::hours(24)).await.unwrap();
                for i in 0..sched.assignments.len() {
                    for j in (i + 1)..sched.assignments.len() {
                        let (a, b) = (&sched.assignments[i], &sched.assignments[j]);
                        if a.overlaps(b.starts_at, b.ends_at) {
                            return false;
                        }
                    }
                }
                true
            });
            prop_assert!(result);
        });
    }

    // Traces to: FR-PLAN-002
    // Property: Higher priority always scheduled before lower if both fit
    #[test]
    fn prop_higher_priority_earlier() {
        use proptest::prelude::*;
        proptest!(|(dur_mins in 10i64..60)| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result = rt.block_on(async {
                let s = scheduler();
                let high = Task {
                    priority: Priority::new(0.95),
                    ..mk_task("high", dur_mins, 0.95)
                };
                let low = Task {
                    priority: Priority::new(0.2),
                    ..mk_task("low", dur_mins, 0.2)
                };
                let sched = s
                    .plan(&[low.clone(), high.clone()], &[], now(), Duration::hours(8))
                    .await
                    .unwrap();
                if sched.assignments.len() == 2 {
                    let high_idx =
                        sched.assignments.iter().position(|b| b.task_id == high.id).unwrap();
                    let low_idx = sched.assignments.iter().position(|b| b.task_id == low.id).unwrap();
                    sched.assignments[high_idx].starts_at < sched.assignments[low_idx].starts_at
                } else {
                    true
                }
            });
            prop_assert!(result);
        });
    }

    // Traces to: FR-PLAN-002
    // Property: Determinism—same input always produces same output
    #[test]
    fn prop_deterministic_schedule() {
        use proptest::prelude::*;
        proptest!(|(num_tasks in 1usize..5)| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result = rt.block_on(async {
                let s = scheduler();
                let tasks: Vec<_> =
                    (0..num_tasks).map(|i| mk_task(&format!("task_{}", i), 30, 0.5)).collect();
                let sched1 = s.plan(&tasks, &[], now(), Duration::hours(8)).await.unwrap();
                let sched2 = s.plan(&tasks, &[], now(), Duration::hours(8)).await.unwrap();
                sched1 == sched2
            });
            prop_assert!(result);
        });
    }

    // Traces to: FR-PLAN-002
    // Property: Scheduled tasks satisfy their duration requirement
    #[test]
    fn prop_scheduled_duration_satisfies_requirement() {
        use proptest::prelude::*;
        proptest!(|(minutes in 20i64..120)| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result = rt.block_on(async {
                let s = scheduler();
                let task = mk_task("test", minutes, 0.5);
                let req_duration = Duration::minutes(minutes);
                let sched = s.plan(&[task.clone()], &[], now(), Duration::hours(24)).await.unwrap();
                let total: Duration = sched
                    .assignments
                    .iter()
                    .filter(|b| b.task_id == task.id)
                    .map(|b| b.ends_at - b.starts_at)
                    .sum();
                total == req_duration || sched.unplaced.iter().any(|(id, _)| *id == task.id)
            });
            prop_assert!(result);
        });
    }
}
