// SPDX-License-Identifier: MIT OR Apache-2.0

#![allow(clippy::empty_line_after_doc_comments)]
//! UniFFI export surface for FocalPoint core.
//!
//! Exposes the mascot state machine plus rules/rewards/penalties/policy/
//! audit/sync sub-APIs to Swift (via UniFFI) and Kotlin (via UniFFI-Kotlin /
//! JNI) using a single UDL.
//!
//! The scaffolding file is generated at build time by `uniffi_build` and
//! included here via `include_scaffolding!`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use focus_audit::{AuditSink, AuditStore, InMemoryAuditStore};
use focus_backup::RestoreReport as BackupRestoreReport;
use focus_calendar::{
    CalendarEvent as CoreCalendarEvent, CalendarPort, DateRange as CoreDateRange,
    InMemoryCalendarPort,
};
use focus_coaching::{
    CoachingProvider, HttpCoachingProvider, NoopCoachingProvider, RateLimitedProvider,
};
use focus_connectors::Connector;
use focus_eval::{
    EvaluationReport as CoreEvaluationReport, RuleEvaluationPipeline, VecDecisionSink,
};
use focus_mascot::{
    Emotion as CoreEmotion, MascotEvent as CoreMascotEvent, MascotMachine,
    MascotState as CoreMascotState, Pose as CorePose,
};
use focus_penalties::{
    EscalationTier, LockoutWindow as CoreLockoutWindow, PenaltyMutation as CorePenaltyMutation,
};
use focus_planning::{
    Deadline as CoreDeadline, DurationSpec as CoreDurationSpec, Priority as CorePriority, Task,
    TaskStatus as CoreTaskStatus, TaskStore,
};
use focus_policy::{PolicyBuilder, ProfileState};
use focus_rewards::{Credit, MultiplierState, WalletMutation as CoreWalletMutation};
use focus_rituals::monthly::{
    MonthDelta as CoreMonthDelta, MonthlyRetro as CoreMonthlyRetro, MonthlyRetrospectiveEngine,
};
use focus_rituals::weekly::{
    RuleSummary as CoreRuleSummary, StreakSnapshot as CoreStreakSnapshot,
    WeeklyReview as CoreWeeklyReview, WeeklyReviewEngine,
};
use focus_rituals::{
    EveningShutdown as CoreEveningShutdown, MorningBrief as CoreMorningBrief, RitualsEngine,
    SchedulePreview as CoreSchedulePreview, ScheduleWindowKind as CoreScheduleWindowKind,
    ScheduleWindowLine as CoreScheduleWindowLine, ShippedTask as CoreShippedTask,
    SlipReason as CoreSlipReason, SlippedTask as CoreSlippedTask, TaskActual as CoreTaskActual,
    TopPriorityLine as CoreTopPriorityLine,
};
use focus_rules::{
    Action as CoreAction, Condition as CoreCondition, PrioritizedDecision, Rule as CoreRule,
    RuleEngine as CoreRuleEngine, Trigger as CoreTrigger,
};
use focus_scheduler::{Scheduler, WorkingHoursSpec};
use focus_storage::ports::{EventStore, PenaltyStore, RuleStore, WalletStore};
use focus_storage::sqlite::rule_store::upsert_rule;
use focus_storage::sqlite::task_store::SqliteTaskStore;
use focus_storage::SqliteAdapter;
use focus_sync::{EventSink, OrchestratorError, SyncOrchestrator};
use secrecy::SecretString;
use std::time::Duration as StdDuration;
use thiserror::Error;
use tokio::runtime::Runtime;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

uniffi::include_scaffolding!("focus_ffi");

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum FfiError {
    #[error("not implemented")]
    NotImplemented,
    #[error("invalid argument: {0}")]
    InvalidArgument(String),
    #[error("storage: {0}")]
    Storage(String),
    #[error("domain: {0}")]
    Domain(String),
    #[error("config: {0}")]
    Config(String),
    #[error("network: {0}")]
    Network(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("backup: {0}")]
    Backup(String),

    #[error("mutex poisoned: {0}")]
    Poisoned(String),

    #[error("panic in FFI boundary")]
    PanicCaught,
}

impl From<anyhow::Error> for FfiError {
    fn from(e: anyhow::Error) -> Self {
        FfiError::Storage(e.to_string())
    }
}

// ---------------------------------------------------------------------------
// Mascot types (unchanged surface)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pose {
    Confident,
    Encouraging,
    CuriousThinking,
    SternToughLove,
    Celebratory,
    SleepyDisappointed,
    Idle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Emotion {
    Neutral,
    Happy,
    Proud,
    Concerned,
    Stern,
    Excited,
    Tired,
    Warm,
}

#[derive(Debug, Clone)]
pub struct MascotState {
    pub pose: Pose,
    pub emotion: Emotion,
    pub since_iso: String,
    pub bubble_text: Option<String>,
}

#[derive(Debug, Clone)]
pub enum MascotEvent {
    RuleFired { rule_name: String },
    StreakIncremented { name: String, count: u32 },
    StreakReset { name: String },
    CreditEarned { amount: i64 },
    BypassSpent { remaining: i64 },
    PenaltyEscalated { tier: String },
    AppLaunchedWhileBlocked { bundle_id: String },
    FocusSessionStarted { minutes: u32 },
    FocusSessionCompleted { minutes: u32 },
    DailyCheckIn,
    SleepDebtReported { hours: f32 },
    Idle,
}

impl From<CorePose> for Pose {
    fn from(value: CorePose) -> Self {
        match value {
            CorePose::Confident => Pose::Confident,
            CorePose::Encouraging => Pose::Encouraging,
            CorePose::CuriousThinking => Pose::CuriousThinking,
            CorePose::SternToughLove => Pose::SternToughLove,
            CorePose::Celebratory => Pose::Celebratory,
            CorePose::SleepyDisappointed => Pose::SleepyDisappointed,
            CorePose::Idle => Pose::Idle,
        }
    }
}

impl From<CoreEmotion> for Emotion {
    fn from(value: CoreEmotion) -> Self {
        match value {
            CoreEmotion::Neutral => Emotion::Neutral,
            CoreEmotion::Happy => Emotion::Happy,
            CoreEmotion::Proud => Emotion::Proud,
            CoreEmotion::Concerned => Emotion::Concerned,
            CoreEmotion::Stern => Emotion::Stern,
            CoreEmotion::Excited => Emotion::Excited,
            CoreEmotion::Tired => Emotion::Tired,
            CoreEmotion::Warm => Emotion::Warm,
        }
    }
}

impl From<&CoreMascotState> for MascotState {
    fn from(s: &CoreMascotState) -> Self {
        MascotState {
            pose: s.pose.into(),
            emotion: s.emotion.into(),
            since_iso: s.since.to_rfc3339(),
            bubble_text: s.bubble_text.clone(),
        }
    }
}

impl From<MascotEvent> for CoreMascotEvent {
    fn from(e: MascotEvent) -> Self {
        match e {
            MascotEvent::RuleFired { rule_name } => CoreMascotEvent::RuleFired { rule_name },
            MascotEvent::StreakIncremented { name, count } => {
                CoreMascotEvent::StreakIncremented { name, count }
            }
            MascotEvent::StreakReset { name } => CoreMascotEvent::StreakReset(name),
            MascotEvent::CreditEarned { amount } => CoreMascotEvent::CreditEarned { amount },
            MascotEvent::BypassSpent { remaining } => CoreMascotEvent::BypassSpent { remaining },
            MascotEvent::PenaltyEscalated { tier } => CoreMascotEvent::PenaltyEscalated { tier },
            MascotEvent::AppLaunchedWhileBlocked { bundle_id } => {
                CoreMascotEvent::AppLaunchedWhileBlocked { bundle_id }
            }
            MascotEvent::FocusSessionStarted { minutes } => {
                CoreMascotEvent::FocusSessionStarted { minutes }
            }
            MascotEvent::FocusSessionCompleted { minutes } => {
                CoreMascotEvent::FocusSessionCompleted { minutes }
            }
            MascotEvent::DailyCheckIn => CoreMascotEvent::DailyCheckIn,
            MascotEvent::SleepDebtReported { hours } => {
                CoreMascotEvent::SleepDebtReported { hours }
            }
            MascotEvent::Idle => CoreMascotEvent::Idle,
        }
    }
}

// ---------------------------------------------------------------------------
// Rules: DTOs + conversions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct RuleSummary {
    pub id: String,
    pub name: String,
    pub priority: i32,
    pub explanation_template: String,
    pub enabled: bool,
}

#[derive(Debug, Clone)]
pub enum RuleActionDto {
    GrantCredit { amount: i32 },
    DeductCredit { amount: i32 },
    Block { profile: String, duration_seconds: i64 },
    Unblock { profile: String },
    StreakIncrement { name: String },
    StreakReset { name: String },
    Notify { message: String },
}

#[derive(Debug, Clone)]
pub struct RuleDraft {
    pub id: String,
    pub name: String,
    pub trigger_event: String,
    pub actions: Vec<RuleActionDto>,
    pub priority: i32,
    pub cooldown_seconds: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub explanation_template: String,
    pub enabled: bool,
}

impl From<RuleActionDto> for CoreAction {
    fn from(a: RuleActionDto) -> Self {
        match a {
            RuleActionDto::GrantCredit { amount } => CoreAction::GrantCredit { amount },
            RuleActionDto::DeductCredit { amount } => CoreAction::DeductCredit { amount },
            RuleActionDto::Block { profile, duration_seconds } => CoreAction::Block {
                profile,
                duration: ChronoDuration::seconds(duration_seconds),
                rigidity: focus_domain::Rigidity::Hard,
            },
            RuleActionDto::Unblock { profile } => CoreAction::Unblock { profile },
            RuleActionDto::StreakIncrement { name } => CoreAction::StreakIncrement(name),
            RuleActionDto::StreakReset { name } => CoreAction::StreakReset(name),
            RuleActionDto::Notify { message } => CoreAction::Notify(message),
        }
    }
}

fn rule_to_summary(r: &CoreRule) -> RuleSummary {
    RuleSummary {
        id: r.id.to_string(),
        name: r.name.clone(),
        priority: r.priority,
        explanation_template: r.explanation_template.clone(),
        enabled: r.enabled,
    }
}

fn draft_to_core(d: RuleDraft) -> Result<CoreRule, FfiError> {
    let id = Uuid::parse_str(&d.id)
        .map_err(|e| FfiError::InvalidArgument(format!("rule id uuid: {e}")))?;
    Ok(CoreRule {
        id,
        name: d.name,
        trigger: CoreTrigger::Event(d.trigger_event),
        conditions: Vec::<CoreCondition>::new(),
        actions: d.actions.into_iter().map(CoreAction::from).collect(),
        priority: d.priority,
        cooldown: d.cooldown_seconds.map(ChronoDuration::seconds),
        duration: d.duration_seconds.map(ChronoDuration::seconds),
        explanation_template: d.explanation_template,
        enabled: d.enabled,
    })
}

// ---------------------------------------------------------------------------
// Rewards: DTOs + conversions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct StreakSummary {
    pub name: String,
    pub count: u32,
    pub last_incremented_iso: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WalletSummary {
    pub earned: i64,
    pub spent: i64,
    pub balance: i64,
    pub multiplier: f32,
    pub streaks: Vec<StreakSummary>,
}

#[derive(Debug, Clone)]
pub enum WalletMutationDto {
    GrantCredit { amount: i64 },
    SpendCredit { amount: i64, purpose: String },
    StreakIncrement { name: String },
    StreakReset { name: String },
    SetMultiplier { current: f32, expires_iso: Option<String> },
}

fn parse_iso(s: &str) -> Result<DateTime<Utc>, FfiError> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| FfiError::InvalidArgument(format!("parse rfc3339 '{s}': {e}")))
}

fn parse_iso_opt(s: Option<String>) -> Result<Option<DateTime<Utc>>, FfiError> {
    s.map(|v| parse_iso(&v)).transpose()
}

impl WalletMutationDto {
    fn into_core(self, now: DateTime<Utc>) -> Result<CoreWalletMutation, FfiError> {
        Ok(match self {
            WalletMutationDto::GrantCredit { amount } => CoreWalletMutation::GrantCredit(Credit {
                amount,
                source_rule_id: None,
                granted_at: now,
            }),
            WalletMutationDto::SpendCredit { amount, purpose } => {
                CoreWalletMutation::SpendCredit { amount, purpose }
            }
            WalletMutationDto::StreakIncrement { name } => {
                CoreWalletMutation::StreakIncrement(name)
            }
            WalletMutationDto::StreakReset { name } => CoreWalletMutation::StreakReset(name),
            WalletMutationDto::SetMultiplier { current, expires_iso } => {
                CoreWalletMutation::SetMultiplier(MultiplierState {
                    current,
                    expires_at: parse_iso_opt(expires_iso)?,
                })
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Penalties: DTOs + conversions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct LockoutWindowDto {
    pub starts_at_iso: String,
    pub ends_at_iso: String,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct PenaltyStateSummary {
    pub tier: String,
    pub bypass_budget: i64,
    pub debt_balance: i64,
    pub strict_mode_until_iso: Option<String>,
    pub lockouts: Vec<LockoutWindowDto>,
}

#[derive(Debug, Clone)]
pub struct BypassQuoteDto {
    pub cost: i64,
    pub remaining_after: i64,
    pub new_tier: Option<String>,
}

#[derive(Debug, Clone)]
pub enum PenaltyMutationDto {
    Escalate { tier: String },
    SpendBypass { amount: i64 },
    GrantBypass { amount: i64 },
    AddLockout { window: LockoutWindowDto },
    ClearLockouts,
    SetStrictMode { until_iso: String },
    Clear,
}

fn tier_name(t: EscalationTier) -> &'static str {
    match t {
        EscalationTier::Clear => "Clear",
        EscalationTier::Warning => "Warning",
        EscalationTier::Restricted => "Restricted",
        EscalationTier::Strict => "Strict",
    }
}

fn tier_parse(s: &str) -> Result<EscalationTier, FfiError> {
    Ok(match s {
        "Clear" => EscalationTier::Clear,
        "Warning" => EscalationTier::Warning,
        "Restricted" => EscalationTier::Restricted,
        "Strict" => EscalationTier::Strict,
        other => {
            return Err(FfiError::InvalidArgument(format!("unknown escalation tier: {other}")))
        }
    })
}

impl PenaltyMutationDto {
    fn into_core(self) -> Result<CorePenaltyMutation, FfiError> {
        Ok(match self {
            PenaltyMutationDto::Escalate { tier } => {
                CorePenaltyMutation::Escalate(tier_parse(&tier)?)
            }
            PenaltyMutationDto::SpendBypass { amount } => CorePenaltyMutation::SpendBypass(amount),
            PenaltyMutationDto::GrantBypass { amount } => CorePenaltyMutation::GrantBypass(amount),
            PenaltyMutationDto::AddLockout { window } => {
                CorePenaltyMutation::AddLockout(CoreLockoutWindow {
                    starts_at: parse_iso(&window.starts_at_iso)?,
                    ends_at: parse_iso(&window.ends_at_iso)?,
                    reason: window.reason,
                    rigidity: focus_domain::Rigidity::Hard,
                })
            }
            PenaltyMutationDto::ClearLockouts => CorePenaltyMutation::ClearLockouts,
            PenaltyMutationDto::SetStrictMode { until_iso } => {
                CorePenaltyMutation::SetStrictMode { until: parse_iso(&until_iso)? }
            }
            PenaltyMutationDto::Clear => CorePenaltyMutation::Clear,
        })
    }
}

// ---------------------------------------------------------------------------
// Policy / Audit / Sync DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct EnforcementPolicySummary {
    pub active: bool,
    pub profile_states: HashMap<String, String>,
    pub generated_at_iso: String,
}

#[derive(Debug, Clone)]
pub struct ConnectorHandleSummary {
    pub connector_id: String,
    pub health: String,
    pub next_sync_at_iso: String,
    pub last_cursor: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SyncReportDto {
    pub events_pulled: u32,
    pub connectors_synced: u32,
    pub errors: Vec<String>,
}

// ---------------------------------------------------------------------------
// Rituals DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct TopPriorityLineDto {
    pub task_id: String,
    pub title: String,
    pub deadline_label: String,
    pub rigidity_tag: String,
    pub estimated_duration_minutes: u32,
}

#[derive(Debug, Clone)]
pub struct ScheduleWindowLineDto {
    pub starts_at_iso: String,
    pub ends_at_iso: String,
    pub title: String,
    pub kind: String,
}

#[derive(Debug, Clone)]
pub struct SchedulePreviewDto {
    pub windows: Vec<ScheduleWindowLineDto>,
    pub soft_conflicts: u32,
    pub hard_conflicts: u32,
}

#[derive(Debug, Clone)]
pub struct MorningBriefDto {
    pub date: String,
    pub intention: Option<String>,
    pub top_priorities: Vec<TopPriorityLineDto>,
    pub schedule_preview: SchedulePreviewDto,
    pub coachy_opening: String,
    pub generated_at_iso: String,
}

#[derive(Debug, Clone)]
pub struct ShippedTaskDto {
    pub id: String,
    pub title: String,
    pub planned_minutes: u32,
    pub actual_minutes: u32,
}

#[derive(Debug, Clone)]
pub struct SlippedTaskDto {
    pub id: String,
    pub title: String,
    pub planned_minutes: u32,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct EveningShutdownDto {
    pub date: String,
    pub shipped: Vec<ShippedTaskDto>,
    pub slipped: Vec<SlippedTaskDto>,
    pub carryover: Vec<String>,
    pub wins_summary: String,
    pub coachy_closing: String,
    pub streak_deltas: HashMap<String, i32>,
    pub generated_at_iso: String,
}

#[derive(Debug, Clone)]
pub struct TaskActualDto {
    pub task_id: String,
    pub actual_minutes: u32,
    pub completed_at_iso: Option<String>,
    pub cancelled: bool,
}

#[derive(Debug, Clone)]
pub struct RuleSummaryDto {
    pub rule_id: String,
    pub rule_name: String,
    pub fired_count: u32,
    pub last_fired_at_iso: Option<String>,
}

#[derive(Debug, Clone)]
pub struct StreakSnapshotDto {
    pub name: String,
    pub count: u32,
    pub extended_this_week: bool,
}

#[derive(Debug, Clone)]
pub struct WeeklyReviewDto {
    pub week_starting: String,
    pub focus_hours: f32,
    pub sessions_count: u32,
    pub credits_earned: i64,
    pub credits_spent: i64,
    pub top_rules: Vec<RuleSummaryDto>,
    pub streaks_extended: Vec<StreakSnapshotDto>,
    pub tasks_completed: u32,
    pub tasks_slipped: u32,
    pub wins_summary: String,
    pub growth_area: String,
    pub coachy_closing: String,
    pub generated_at_iso: String,
}

#[derive(Debug, Clone)]
pub struct MonthDeltaDto {
    pub focus_hours_delta: f32,
    pub tasks_completed_delta: i32,
    pub credits_earned_delta: i64,
    pub trend_direction: String,
}

#[derive(Debug, Clone)]
pub struct MonthlyRetroDto {
    pub month: String,
    pub total_focus_hours: f32,
    pub weekly_breakdown: Vec<f32>,
    pub theme: String,
    pub top_accomplishments: Vec<String>,
    pub compared_to_prior_month: MonthDeltaDto,
    pub streak_peak: String,
    pub coachy_reflection: String,
    pub generated_at_iso: String,
}

fn kind_name(k: &CoreScheduleWindowKind) -> &'static str {
    match k {
        CoreScheduleWindowKind::FocusBlock => "FocusBlock",
        CoreScheduleWindowKind::Meeting => "Meeting",
        CoreScheduleWindowKind::Personal => "Personal",
        CoreScheduleWindowKind::Ritual => "Ritual",
    }
}

fn slip_name(r: &CoreSlipReason) -> &'static str {
    match r {
        CoreSlipReason::Skipped => "Skipped",
        CoreSlipReason::Deferred => "Deferred",
        CoreSlipReason::Overran => "Overran",
        CoreSlipReason::Cancelled => "Cancelled",
    }
}

impl From<&CoreTopPriorityLine> for TopPriorityLineDto {
    fn from(v: &CoreTopPriorityLine) -> Self {
        TopPriorityLineDto {
            task_id: v.task_id.to_string(),
            title: v.title.clone(),
            deadline_label: v.deadline_label.clone(),
            rigidity_tag: v.rigidity_tag.clone(),
            estimated_duration_minutes: v.estimated_duration_minutes,
        }
    }
}

impl From<&CoreScheduleWindowLine> for ScheduleWindowLineDto {
    fn from(v: &CoreScheduleWindowLine) -> Self {
        ScheduleWindowLineDto {
            starts_at_iso: v.starts_at.to_rfc3339(),
            ends_at_iso: v.ends_at.to_rfc3339(),
            title: v.title.clone(),
            kind: kind_name(&v.kind).to_string(),
        }
    }
}

impl From<&CoreSchedulePreview> for SchedulePreviewDto {
    fn from(v: &CoreSchedulePreview) -> Self {
        SchedulePreviewDto {
            windows: v.windows.iter().map(ScheduleWindowLineDto::from).collect(),
            soft_conflicts: v.soft_conflicts,
            hard_conflicts: v.hard_conflicts,
        }
    }
}

impl From<CoreMorningBrief> for MorningBriefDto {
    fn from(v: CoreMorningBrief) -> Self {
        MorningBriefDto {
            date: v.date.to_string(),
            intention: v.intention,
            top_priorities: v.top_priorities.iter().map(TopPriorityLineDto::from).collect(),
            schedule_preview: SchedulePreviewDto::from(&v.schedule_preview),
            coachy_opening: v.coachy_opening,
            generated_at_iso: v.generated_at.to_rfc3339(),
        }
    }
}

impl From<&CoreShippedTask> for ShippedTaskDto {
    fn from(v: &CoreShippedTask) -> Self {
        ShippedTaskDto {
            id: v.id.to_string(),
            title: v.title.clone(),
            planned_minutes: v.planned_minutes,
            actual_minutes: v.actual_minutes,
        }
    }
}

impl From<&CoreSlippedTask> for SlippedTaskDto {
    fn from(v: &CoreSlippedTask) -> Self {
        SlippedTaskDto {
            id: v.id.to_string(),
            title: v.title.clone(),
            planned_minutes: v.planned_minutes,
            reason: slip_name(&v.reason).to_string(),
        }
    }
}

impl From<CoreEveningShutdown> for EveningShutdownDto {
    fn from(v: CoreEveningShutdown) -> Self {
        EveningShutdownDto {
            date: v.date.to_string(),
            shipped: v.shipped.iter().map(ShippedTaskDto::from).collect(),
            slipped: v.slipped.iter().map(SlippedTaskDto::from).collect(),
            carryover: v.carryover.iter().map(|u| u.to_string()).collect(),
            wins_summary: v.wins_summary,
            coachy_closing: v.coachy_closing,
            streak_deltas: v.streak_deltas,
            generated_at_iso: v.generated_at.to_rfc3339(),
        }
    }
}

impl From<&CoreRuleSummary> for RuleSummaryDto {
    fn from(v: &CoreRuleSummary) -> Self {
        RuleSummaryDto {
            rule_id: v.rule_id.clone(),
            rule_name: v.rule_name.clone(),
            fired_count: v.fired_count,
            last_fired_at_iso: v.last_fired_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

impl From<&CoreStreakSnapshot> for StreakSnapshotDto {
    fn from(v: &CoreStreakSnapshot) -> Self {
        StreakSnapshotDto {
            name: v.name.clone(),
            count: v.count,
            extended_this_week: v.extended_this_week,
        }
    }
}

impl From<CoreWeeklyReview> for WeeklyReviewDto {
    fn from(v: CoreWeeklyReview) -> Self {
        WeeklyReviewDto {
            week_starting: v.week_starting.to_string(),
            focus_hours: v.focus_hours,
            sessions_count: v.sessions_count,
            credits_earned: v.credits_earned,
            credits_spent: v.credits_spent,
            top_rules: v.top_rules.iter().map(RuleSummaryDto::from).collect(),
            streaks_extended: v.streaks_extended.iter().map(StreakSnapshotDto::from).collect(),
            tasks_completed: v.tasks_completed,
            tasks_slipped: v.tasks_slipped,
            wins_summary: v.wins_summary,
            growth_area: v.growth_area,
            coachy_closing: v.coachy_closing,
            generated_at_iso: v.generated_at.to_rfc3339(),
        }
    }
}

impl From<&CoreMonthDelta> for MonthDeltaDto {
    fn from(v: &CoreMonthDelta) -> Self {
        MonthDeltaDto {
            focus_hours_delta: v.focus_hours_delta,
            tasks_completed_delta: v.tasks_completed_delta,
            credits_earned_delta: v.credits_earned_delta,
            trend_direction: v.trend_direction.clone(),
        }
    }
}

impl From<CoreMonthlyRetro> for MonthlyRetroDto {
    fn from(v: CoreMonthlyRetro) -> Self {
        MonthlyRetroDto {
            month: v.month,
            total_focus_hours: v.total_focus_hours,
            weekly_breakdown: v.weekly_breakdown,
            theme: v.theme,
            top_accomplishments: v.top_accomplishments,
            compared_to_prior_month: MonthDeltaDto::from(&v.compared_to_prior_month),
            streak_peak: v.streak_peak,
            coachy_reflection: v.coachy_reflection,
            generated_at_iso: v.generated_at.to_rfc3339(),
        }
    }
}

impl TaskActualDto {
    fn into_core(self) -> Result<CoreTaskActual, FfiError> {
        let task_id = Uuid::parse_str(&self.task_id)
            .map_err(|e| FfiError::InvalidArgument(format!("task_id uuid: {e}")))?;
        let completed_at = match self.completed_at_iso {
            Some(iso) => Some(parse_iso(&iso)?),
            None => None,
        };
        Ok(CoreTaskActual {
            task_id,
            actual_minutes: self.actual_minutes,
            completed_at,
            cancelled: self.cancelled,
        })
    }
}

// ---------------------------------------------------------------------------
// Calendar host (foreign callback → CalendarPort adapter)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalendarEventKindDto {
    Hard,
    Soft,
}

#[derive(Debug, Clone)]
pub struct CalendarEventDto {
    pub id: String,
    pub title: String,
    pub start_iso: String,
    pub end_iso: String,
    pub kind: CalendarEventKindDto,
}

/// Foreign-implemented interface. Swift's `EventKitCalendarHost` conforms to
/// this; Android's `CalendarContractHost` will do the same when wired up.
///
/// Synchronous by design — UniFFI callback interfaces must be non-async, and
/// EventKit's `EKEventStore.events(matching:)` is itself synchronous.
pub trait CalendarHost: Send + Sync {
    fn list_events(&self, start_iso: String, end_iso: String) -> Vec<CalendarEventDto>;
}

/// [`CalendarPort`] implementation backed by a foreign [`CalendarHost`]
/// callback. Round-trips ISO8601 / RFC3339 strings across the FFI boundary
/// and parses them back into `chrono::DateTime<Utc>`. Create/delete are not
/// supported by the host shim (the app reads device calendars; it doesn't
/// write to them), so both return `NotImplemented`-equivalent errors.
pub struct HostBackedCalendarPort {
    host: Arc<dyn CalendarHost>,
}

impl HostBackedCalendarPort {
    pub fn new(host: Arc<dyn CalendarHost>) -> Self {
        Self { host }
    }

    fn parse_dto(dto: CalendarEventDto) -> anyhow::Result<CoreCalendarEvent> {
        let start = DateTime::parse_from_rfc3339(&dto.start_iso)
            .map_err(|e| anyhow::anyhow!("parse start_iso '{}': {e}", dto.start_iso))?
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339(&dto.end_iso)
            .map_err(|e| anyhow::anyhow!("parse end_iso '{}': {e}", dto.end_iso))?
            .with_timezone(&Utc);
        let rigidity = match dto.kind {
            CalendarEventKindDto::Hard => focus_domain::Rigidity::Hard,
            CalendarEventKindDto::Soft => focus_domain::Rigidity::Soft,
        };
        Ok(CoreCalendarEvent {
            id: dto.id,
            title: dto.title,
            starts_at: start,
            ends_at: end,
            source: "host".to_string(),
            rigidity,
        })
    }
}

#[async_trait]
impl CalendarPort for HostBackedCalendarPort {
    async fn list_events(&self, range: CoreDateRange) -> anyhow::Result<Vec<CoreCalendarEvent>> {
        let host = self.host.clone();
        let start_iso = range.start.to_rfc3339();
        let end_iso = range.end.to_rfc3339();
        // Host callbacks are sync; offload to a blocking thread so we don't
        // stall the runtime if the host does IO (EventKit can hit disk/XPC).
        let dtos = tokio::task::spawn_blocking(move || host.list_events(start_iso, end_iso))
            .await
            .map_err(|e| anyhow::anyhow!("calendar host join: {e}"))?;
        let mut out = Vec::with_capacity(dtos.len());
        for dto in dtos {
            out.push(Self::parse_dto(dto)?);
        }
        out.sort_by_key(|e| e.starts_at);
        Ok(out)
    }

    async fn create_event(
        &self,
        _draft: &focus_calendar::CalendarEventDraft,
    ) -> anyhow::Result<CoreCalendarEvent> {
        Err(anyhow::anyhow!("HostBackedCalendarPort is read-only (device calendar)"))
    }

    async fn delete_event(&self, _id: &str) -> anyhow::Result<()> {
        Err(anyhow::anyhow!("HostBackedCalendarPort is read-only (device calendar)"))
    }
}

// ---------------------------------------------------------------------------
// Shared context (stashed on FocalPointCore, cloned into sub-APIs)
// ---------------------------------------------------------------------------

struct CoreCtx {
    runtime: Arc<Runtime>,
    adapter: SqliteAdapter,
    audit: Arc<InMemoryAuditStore>,
    user_id: Uuid,
    recent_decisions: Arc<Mutex<Vec<PrioritizedDecision>>>,
    sync: Arc<tokio::sync::Mutex<SyncOrchestrator>>,
    /// Shared EventSink used by both the sync orchestrator and the
    /// `HostEventApi` so host-originated (e.g. focus-session timer) events
    /// land in the same durable events table connector events do.
    event_sink: Arc<dyn EventSink>,
    /// Shared rule engine so cooldown state persists across eval ticks.
    /// Held on the ctx so future callers (e.g. state-change evaluation)
    /// can reuse the same engine; the pipeline already holds a clone.
    #[allow(dead_code)]
    rule_engine: Arc<tokio::sync::RwLock<CoreRuleEngine>>,
    /// Lazily-constructed pipeline driving event → rule → action dispatch.
    eval_pipeline: Arc<RuleEvaluationPipeline>,
}

// ---------------------------------------------------------------------------
// Sub-API implementations
// ---------------------------------------------------------------------------

pub struct RuleQuery {
    ctx: Arc<CoreCtx>,
}

impl RuleQuery {
    pub fn list_enabled(&self) -> Result<Vec<RuleSummary>, FfiError> {
        let adapter = self.ctx.adapter.clone();
        let rules =
            self.ctx.runtime.block_on(async move { RuleStore::list_enabled(&adapter).await })?;
        Ok(rules.iter().map(rule_to_summary).collect())
    }
}

pub struct RuleMutation {
    ctx: Arc<CoreCtx>,
}

impl RuleMutation {
    pub fn set_enabled(&self, rule_id: String, enabled: bool) -> Result<(), FfiError> {
        let id = Uuid::parse_str(&rule_id)
            .map_err(|e| FfiError::InvalidArgument(format!("rule id uuid: {e}")))?;
        let adapter = self.ctx.adapter.clone();
        self.ctx.runtime.block_on(async move {
            let existing = RuleStore::get(&adapter, id)
                .await?
                .ok_or_else(|| FfiError::InvalidArgument(format!("rule not found: {id}")))?;
            let mut updated = existing;
            updated.enabled = enabled;
            upsert_rule(&adapter, updated).await?;
            Ok::<(), FfiError>(())
        })
    }

    pub fn upsert(&self, rule: RuleDraft) -> Result<(), FfiError> {
        let core = draft_to_core(rule)?;
        let adapter = self.ctx.adapter.clone();
        self.ctx.runtime.block_on(async move { upsert_rule(&adapter, core).await })?;
        Ok(())
    }
}

pub struct WalletApi {
    ctx: Arc<CoreCtx>,
}

impl WalletApi {
    pub fn load(&self) -> Result<WalletSummary, FfiError> {
        let adapter = self.ctx.adapter.clone();
        let user_id = self.ctx.user_id;
        let wallet =
            self.ctx.runtime.block_on(async move { WalletStore::load(&adapter, user_id).await })?;
        let multiplier = wallet.effective_multiplier(Utc::now());
        let streaks = wallet
            .streaks
            .values()
            .map(|s| StreakSummary {
                name: s.name.clone(),
                count: s.count,
                last_incremented_iso: s.last_incremented_at.map(|d| d.to_rfc3339()),
            })
            .collect();
        Ok(WalletSummary {
            earned: wallet.earned_credits,
            spent: wallet.spent_credits,
            balance: wallet.balance(),
            multiplier,
            streaks,
        })
    }

    pub fn apply_mutation(&self, m: WalletMutationDto) -> Result<(), FfiError> {
        let now = Utc::now();
        let core = m.into_core(now)?;
        let adapter = self.ctx.adapter.clone();
        let user_id = self.ctx.user_id;
        self.ctx
            .runtime
            .block_on(async move { WalletStore::apply(&adapter, user_id, core).await })?;
        // Audit append (best-effort, in-memory chain).
        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "wallet.mutation",
            self.ctx.user_id.to_string(),
            serde_json::json!({"at": now.to_rfc3339()}),
            now,
        );
        Ok(())
    }
}

pub struct PenaltyApi {
    ctx: Arc<CoreCtx>,
}

impl PenaltyApi {
    pub fn load(&self) -> Result<PenaltyStateSummary, FfiError> {
        let adapter = self.ctx.adapter.clone();
        let user_id = self.ctx.user_id;
        let state = self
            .ctx
            .runtime
            .block_on(async move { PenaltyStore::load(&adapter, user_id).await })?;
        let lockouts = state
            .lockout_windows
            .iter()
            .map(|w| LockoutWindowDto {
                starts_at_iso: w.starts_at.to_rfc3339(),
                ends_at_iso: w.ends_at.to_rfc3339(),
                reason: w.reason.clone(),
            })
            .collect();
        Ok(PenaltyStateSummary {
            tier: tier_name(state.escalation_tier).to_string(),
            bypass_budget: state.bypass_budget,
            debt_balance: state.debt_balance,
            strict_mode_until_iso: state.strict_mode_until.map(|d| d.to_rfc3339()),
            lockouts,
        })
    }

    pub fn quote_bypass(&self, cost: i64) -> Result<BypassQuoteDto, FfiError> {
        let adapter = self.ctx.adapter.clone();
        let user_id = self.ctx.user_id;
        let state = self
            .ctx
            .runtime
            .block_on(async move { PenaltyStore::load(&adapter, user_id).await })?;
        let quote = state.quote_bypass(cost).map_err(|e| FfiError::Domain(e.to_string()))?;
        Ok(BypassQuoteDto {
            cost: quote.cost,
            remaining_after: quote.remaining_after,
            new_tier: quote.new_tier.map(|t| tier_name(t).to_string()),
        })
    }

    pub fn apply(&self, m: PenaltyMutationDto) -> Result<(), FfiError> {
        let now = Utc::now();
        let core = m.into_core()?;
        let adapter = self.ctx.adapter.clone();
        let user_id = self.ctx.user_id;
        self.ctx
            .runtime
            .block_on(async move { PenaltyStore::apply(&adapter, user_id, core).await })?;
        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "penalty.mutation",
            self.ctx.user_id.to_string(),
            serde_json::json!({"at": now.to_rfc3339()}),
            now,
        );
        Ok(())
    }
}

pub struct PolicyApi {
    ctx: Arc<CoreCtx>,
}

impl PolicyApi {
    /// Builds an EnforcementPolicy from the most recent in-process rule
    /// decisions captured on this core handle. Persistent decision storage is
    /// a separate concern (FR-DATA-001 / rule_evaluations table) that is not
    /// yet wired; until then callers must feed decisions into the orchestrator
    /// for them to appear here. Returns an empty/inactive policy if none.
    pub fn build_from_recent_decisions(
        &self,
        limit: i32,
    ) -> Result<EnforcementPolicySummary, FfiError> {
        let recent = self
            .ctx
            .recent_decisions
            .lock()
            .map_err(|e| FfiError::Storage(format!("decisions mutex poisoned: {e}")))?;
        let n = if limit <= 0 { recent.len() } else { (limit as usize).min(recent.len()) };
        let slice: Vec<PrioritizedDecision> = recent.iter().rev().take(n).cloned().collect();
        let policy =
            PolicyBuilder::from_rule_decisions(&slice, Utc::now(), &focus_audit::NoopAuditSink);
        let profile_states = policy
            .profile_states
            .iter()
            .map(|(k, v)| {
                let repr = match v {
                    ProfileState::Blocked { ends_at, .. } => {
                        format!("blocked_until:{}", ends_at.to_rfc3339())
                    }
                    ProfileState::Unblocked => "unblocked".to_string(),
                };
                (k.clone(), repr)
            })
            .collect();
        Ok(EnforcementPolicySummary {
            active: policy.active,
            profile_states,
            generated_at_iso: policy.generated_at.to_rfc3339(),
        })
    }
}

pub struct AuditApi {
    ctx: Arc<CoreCtx>,
}

impl AuditApi {
    pub fn verify_chain(&self) -> Result<bool, FfiError> {
        self.ctx.audit.verify_chain().map_err(|e| FfiError::Storage(e.to_string()))
    }

    pub fn head_hash(&self) -> Result<Option<String>, FfiError> {
        self.ctx.audit.head_hash().map_err(|e| FfiError::Storage(e.to_string()))
    }

    /// Return the most recent `limit` audit records in newest-first order.
    /// Payload is serialized as a compact JSON string for Swift consumption
    /// so the FFI surface stays DTO-shaped and doesn't leak serde_json.
    pub fn recent(&self, limit: u32) -> Result<Vec<AuditRecordDto>, FfiError> {
        let records = self.ctx.audit.load_recent(limit as usize);
        Ok(records
            .into_iter()
            .map(|r| AuditRecordDto {
                id: r.id.to_string(),
                record_type: r.record_type,
                subject_ref: r.subject_ref,
                occurred_at_iso: r.occurred_at.to_rfc3339(),
                payload_json: serde_json::to_string(&r.payload).unwrap_or_else(|_| "{}".into()),
                hash: r.hash,
            })
            .collect())
    }
}

#[derive(Debug, Clone)]
pub struct AuditRecordDto {
    pub id: String,
    pub record_type: String,
    pub subject_ref: String,
    pub occurred_at_iso: String,
    pub payload_json: String,
    pub hash: String,
}

pub struct RitualsApi {
    ctx: Arc<CoreCtx>,
    tasks: Arc<dyn TaskStore>,
    engine: Arc<RitualsEngine>,
    weekly_engine: Arc<WeeklyReviewEngine>,
    monthly_engine: Arc<MonthlyRetrospectiveEngine>,
}

impl RitualsApi {
    pub fn generate_morning_brief(&self) -> Result<MorningBriefDto, FfiError> {
        let tasks: Vec<Task> = self
            .tasks
            .list(self.ctx.user_id)
            .map_err(|e| FfiError::Storage(format!("task store list: {e}")))?;
        let engine = self.engine.clone();
        let user_id = self.ctx.user_id;
        let brief = self.ctx.runtime.block_on(async move {
            engine.generate_morning_brief(&tasks, user_id, Utc::now()).await
        })?;
        Ok(MorningBriefDto::from(brief))
    }

    /// Record the user's typed intention for today's Morning Brief. Writes
    /// a `ritual.intention.captured` audit line subject=`morning-brief:<date>`.
    pub fn capture_intention(&self, date: String, intention: String) -> Result<(), FfiError> {
        let trimmed = intention.trim();
        if trimmed.is_empty() {
            return Err(FfiError::InvalidArgument("empty intention".into()));
        }
        if date.trim().is_empty() {
            return Err(FfiError::InvalidArgument("empty date".into()));
        }
        let subject = format!("morning-brief:{date}");
        let payload = serde_json::json!({
            "date": date,
            "intention": trimmed,
        });
        self.ctx
            .audit
            .record_mutation("ritual.intention.captured", &subject, payload, Utc::now())
            .map_err(|e| FfiError::Storage(format!("audit append: {e}")))
    }

    pub fn generate_evening_shutdown(
        &self,
        actuals: Vec<TaskActualDto>,
    ) -> Result<EveningShutdownDto, FfiError> {
        let tasks: Vec<Task> = self
            .tasks
            .list(self.ctx.user_id)
            .map_err(|e| FfiError::Storage(format!("task store list: {e}")))?;
        let engine = self.engine.clone();
        let converted: Vec<CoreTaskActual> =
            actuals.into_iter().map(|a| a.into_core()).collect::<Result<_, _>>()?;
        let now = Utc::now();
        let schedule = self.ctx.runtime.block_on(async move {
            engine.scheduler.plan(&tasks, &[], now, ChronoDuration::hours(24)).await
        })?;
        let engine2 = self.engine.clone();
        let shutdown = self.ctx.runtime.block_on(async move {
            engine2.generate_evening_shutdown(&schedule, &converted, now).await
        })?;
        Ok(EveningShutdownDto::from(shutdown))
    }

    pub fn generate_weekly_review(&self) -> Result<WeeklyReviewDto, FfiError> {
        let engine = self.weekly_engine.clone();
        let now = Utc::now();
        let review =
            self.ctx.runtime.block_on(async move { engine.generate_weekly_review(now).await })?;
        Ok(WeeklyReviewDto::from(review))
    }

    pub fn generate_monthly_retro(&self) -> Result<MonthlyRetroDto, FfiError> {
        let engine = self.monthly_engine.clone();
        let now = Utc::now();
        let retro =
            self.ctx.runtime.block_on(async move { engine.generate_monthly_retro(now).await })?;
        Ok(MonthlyRetroDto::from(retro))
    }
}

// ---------------------------------------------------------------------------
// Tasks: user-facing CRUD surface
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct TaskInputDto {
    pub title: String,
    pub duration_minutes: u32,
    pub priority_weight: f32,
    pub deadline_iso: Option<String>,
    pub deadline_rigidity: String,
}

#[derive(Debug, Clone)]
pub struct TaskSummaryDto {
    pub id: String,
    pub title: String,
    pub duration_minutes: u32,
    pub priority_weight: f32,
    pub deadline_iso: Option<String>,
    pub deadline_rigidity: String,
    pub status: String,
}

fn parse_rigidity(s: &str) -> Result<focus_domain::Rigidity, FfiError> {
    match s.trim().to_ascii_lowercase().as_str() {
        "hard" => Ok(focus_domain::Rigidity::Hard),
        "soft" => Ok(focus_domain::Rigidity::Soft),
        // Default Semi cost — the v1 input surface does not expose the
        // specific cost variant; we pick a neutral credit cost so the task is
        // still schedulable and audit-distinguishable from Hard/Soft.
        "semi" => Ok(focus_domain::Rigidity::Semi(focus_domain::RigidityCost::CreditCost(0))),
        other => Err(FfiError::InvalidArgument(format!(
            "deadline_rigidity must be hard|semi|soft, got: {other}"
        ))),
    }
}

fn rigidity_tag(r: &focus_domain::Rigidity) -> &'static str {
    match r {
        focus_domain::Rigidity::Hard => "hard",
        focus_domain::Rigidity::Soft => "soft",
        focus_domain::Rigidity::Semi(_) => "semi",
    }
}

fn task_status_tag(s: &CoreTaskStatus) -> &'static str {
    match s {
        CoreTaskStatus::Pending => "planned",
        CoreTaskStatus::Scheduled { .. } => "scheduled",
        CoreTaskStatus::InProgress => "in_progress",
        CoreTaskStatus::Completed => "done",
        CoreTaskStatus::Cancelled => "cancelled",
    }
}

fn task_to_summary(t: &Task) -> TaskSummaryDto {
    let minutes = t.duration.planning_duration().num_minutes().max(0) as u32;
    let (deadline_iso, rigidity) = match t.deadline.when {
        Some(w) => (Some(w.to_rfc3339()), rigidity_tag(&t.deadline.rigidity).to_string()),
        // No deadline: report rigidity as "soft" (the `Deadline::none()` default)
        // but elide the ISO string so the caller can render "no deadline".
        None => (None, rigidity_tag(&t.deadline.rigidity).to_string()),
    };
    TaskSummaryDto {
        id: t.id.to_string(),
        title: t.title.clone(),
        duration_minutes: minutes,
        priority_weight: t.priority.weight,
        deadline_iso,
        deadline_rigidity: rigidity,
        status: task_status_tag(&t.status).to_string(),
    }
}

pub struct TaskApi {
    ctx: Arc<CoreCtx>,
    store: Arc<dyn TaskStore>,
}

impl TaskApi {
    pub fn add(&self, input: TaskInputDto) -> Result<String, FfiError> {
        let title = input.title.trim().to_string();
        if title.is_empty() {
            return Err(FfiError::InvalidArgument("title must not be empty".into()));
        }
        if input.duration_minutes == 0 {
            return Err(FfiError::InvalidArgument("duration_minutes must be > 0".into()));
        }
        let rigidity = parse_rigidity(&input.deadline_rigidity)?;
        let deadline = match input.deadline_iso.as_deref().map(str::trim).filter(|s| !s.is_empty())
        {
            Some(iso) => {
                let when = DateTime::parse_from_rfc3339(iso)
                    .map_err(|e| FfiError::InvalidArgument(format!("deadline_iso: {e}")))?
                    .with_timezone(&Utc);
                CoreDeadline { when: Some(when), rigidity }
            }
            None => CoreDeadline { when: None, rigidity },
        };

        let now = Utc::now();
        let duration =
            CoreDurationSpec::fixed(ChronoDuration::minutes(input.duration_minutes as i64));
        let mut task = Task::new(title.clone(), duration, now);
        task.priority = CorePriority::clamped(input.priority_weight);
        task.deadline = deadline;
        // `ChunkingPolicy::default()` and empty constraints are already set by
        // `Task::new`; status=Pending likewise.

        self.store
            .upsert(self.ctx.user_id, &task)
            .map_err(|e| FfiError::Storage(format!("task upsert: {e}")))?;

        let id = task.id.to_string();
        self.ctx
            .audit
            .record_mutation(
                "task.added",
                &id,
                serde_json::json!({ "id": id, "title": title }),
                now,
            )
            .map_err(|e| FfiError::Storage(format!("audit append: {e}")))?;
        Ok(id)
    }

    pub fn list(&self) -> Result<Vec<TaskSummaryDto>, FfiError> {
        let tasks = self
            .store
            .list(self.ctx.user_id)
            .map_err(|e| FfiError::Storage(format!("task list: {e}")))?;
        Ok(tasks.iter().map(task_to_summary).collect())
    }

    pub fn remove(&self, task_id: String) -> Result<(), FfiError> {
        let id = Uuid::parse_str(&task_id)
            .map_err(|e| FfiError::InvalidArgument(format!("task id uuid: {e}")))?;
        // Capture title for the audit payload before we delete.
        let title = self
            .store
            .get(id)
            .map_err(|e| FfiError::Storage(format!("task get: {e}")))?
            .map(|t| t.title)
            .unwrap_or_default();
        let removed =
            self.store.delete(id).map_err(|e| FfiError::Storage(format!("task delete: {e}")))?;
        if !removed {
            return Err(FfiError::Storage(format!("not found: {id}")));
        }
        let now = Utc::now();
        self.ctx
            .audit
            .record_mutation(
                "task.removed",
                &task_id,
                serde_json::json!({ "id": task_id, "title": title }),
                now,
            )
            .map_err(|e| FfiError::Storage(format!("audit append: {e}")))?;
        Ok(())
    }

    pub fn mark_done(&self, task_id: String) -> Result<(), FfiError> {
        let id = Uuid::parse_str(&task_id)
            .map_err(|e| FfiError::InvalidArgument(format!("task id uuid: {e}")))?;
        let mut task = self
            .store
            .get(id)
            .map_err(|e| FfiError::Storage(format!("task get: {e}")))?
            .ok_or_else(|| FfiError::Storage(format!("not found: {id}")))?;
        let now = Utc::now();
        task.status = CoreTaskStatus::Completed;
        task.updated_at = now;
        self.store
            .upsert(self.ctx.user_id, &task)
            .map_err(|e| FfiError::Storage(format!("task upsert: {e}")))?;
        self.ctx
            .audit
            .record_mutation(
                "task.marked_done",
                &task_id,
                serde_json::json!({ "id": task_id, "title": task.title }),
                now,
            )
            .map_err(|e| FfiError::Storage(format!("audit append: {e}")))?;
        Ok(())
    }
}

/// Cadence at which the orchestrator polls Canvas once registered.
const CANVAS_SYNC_CADENCE: StdDuration = StdDuration::from_secs(300);
/// Cadence at which the orchestrator polls Google Calendar once registered.
const GCAL_SYNC_CADENCE: StdDuration = StdDuration::from_secs(180);
/// Cadence at which the orchestrator polls GitHub once registered.
const GITHUB_SYNC_CADENCE: StdDuration = StdDuration::from_secs(600);

/// Resolve the best secret store for the current platform, honoring a
/// test-only override so integration tests can avoid the real OS keychain
/// (which would otherwise prompt for a login-keychain unlock and fail under
/// CI / headless runs).
///
/// Set `FOCALPOINT_SECRET_STORE=memory` to force an in-process store.
fn resolve_secret_store(service: &str) -> Arc<dyn focus_crypto::SecureSecretStore> {
    if std::env::var("FOCALPOINT_SECRET_STORE").ok().as_deref() == Some("memory") {
        return Arc::new(focus_crypto::InMemorySecretStore::new());
    }
    focus_crypto::default_secure_store(service).into()
}

/// Register a connector with the orchestrator; on `AlreadyRegistered` (a
/// reconnect), unregister the stale handle and retry so the fresh
/// token-backed connector wins.
///
/// Traces to: FR-CONN-003.
async fn register_or_refresh(
    orch: &mut SyncOrchestrator,
    id: &str,
    connector: Arc<dyn Connector>,
    cadence: StdDuration,
    now: DateTime<Utc>,
) -> Result<(), FfiError> {
    match orch.register(id.to_string(), connector.clone(), cadence, now).await {
        Ok(()) => Ok(()),
        Err(OrchestratorError::AlreadyRegistered(_)) => {
            // Drop the stale handle and insert the fresh one.
            let _ = orch.unregister(id);
            orch.register(id.to_string(), connector, cadence, now)
                .await
                .map_err(|e| FfiError::Storage(format!("sync register (refresh): {e}")))
        }
        Err(e) => Err(FfiError::Storage(format!("sync register: {e}"))),
    }
}

pub struct ConnectorApi {
    ctx: Arc<CoreCtx>,
}

impl ConnectorApi {
    /// Exchange a Canvas OAuth2 authorization `code` for an access token and
    /// persist it in the device keychain (service=`focalpoint`,
    /// account=`canvas:{instance_url}`). Appends an audit record on success.
    pub fn connect_canvas(&self, instance_url: String, code: String) -> Result<(), FfiError> {
        use connector_canvas::auth::{CanvasAuthConfig, CanvasOAuth2, KeychainStore, TokenStore};
        use connector_canvas::CanvasConnector;

        let trimmed = instance_url.trim();
        // Preserve an explicit `http://` scheme when supplied (e.g. wiremock
        // sandbox in integration tests). Default to `https://` otherwise.
        let explicit_http = trimmed.starts_with("http://");
        let cleaned = trimmed
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/')
            .to_string();
        if cleaned.is_empty() || !cleaned.contains('.') {
            return Err(FfiError::InvalidArgument(format!(
                "invalid canvas instance url: {instance_url}"
            )));
        }
        if code.trim().is_empty() {
            return Err(FfiError::InvalidArgument("empty authorization code".into()));
        }

        let client_id = std::env::var("FOCALPOINT_CANVAS_CLIENT_ID")
            .map_err(|_| FfiError::Config("canvas client id not configured".into()))?;
        let client_secret = std::env::var("FOCALPOINT_CANVAS_CLIENT_SECRET")
            .map_err(|_| FfiError::Config("canvas client id not configured".into()))?;

        let scheme = if explicit_http { "http" } else { "https" };
        let base_url = format!("{scheme}://{cleaned}");
        let cfg = CanvasAuthConfig {
            client_id,
            client_secret,
            base_url: base_url.clone(),
            redirect_uri: "focalpoint://auth/canvas/callback".to_string(),
        };
        let oauth = CanvasOAuth2::new(cfg)
            .map_err(|e| FfiError::Config(format!("canvas oauth init: {e}")))?;

        let inner = resolve_secret_store("focalpoint");
        let account = format!("canvas:{cleaned}");
        let store = Arc::new(KeychainStore::new(account.clone(), inner));

        let now = Utc::now();
        let store_for_exchange = store.clone();
        self.ctx.runtime.block_on(async move {
            let http = reqwest::Client::new();
            let token = oauth
                .exchange_code(code, &http)
                .await
                .map_err(|e| FfiError::Network(format!("canvas code exchange: {e}")))?;
            store_for_exchange
                .save(&token)
                .await
                .map_err(|e| FfiError::Storage(format!("canvas keychain save: {e}")))?;
            Ok::<(), FfiError>(())
        })?;

        // Build the connector with the same keychain-backed store so the
        // orchestrator's subsequent sync()s hydrate the token we just saved.
        let connector: Arc<dyn Connector> = Arc::new(
            CanvasConnector::builder(base_url.clone())
                .token_store(store as Arc<dyn TokenStore>)
                .build(),
        );
        let manifest_id = connector.manifest().id.clone();
        let sync = self.ctx.sync.clone();
        self.ctx.runtime.block_on(async move {
            let mut guard = sync.lock().await;
            register_or_refresh(&mut guard, &manifest_id, connector, CANVAS_SYNC_CADENCE, now).await
        })?;

        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "connector.canvas.connected",
            account,
            serde_json::json!({
                "at": now.to_rfc3339(),
                "instance": cleaned,
            }),
            now,
        );
        Ok(())
    }

    /// Exchange a Google Calendar OAuth2 authorization `code` for an access
    /// token and persist it in the device keychain (service=`focalpoint`,
    /// account=`gcal:{user-email-or-id}`). Appends an audit record on success.
    pub fn connect_gcal(&self, code: String) -> Result<(), FfiError> {
        use connector_gcal::auth::{GCalAuthConfig, GCalOAuth2, KeychainStore, TokenStore};

        if code.trim().is_empty() {
            return Err(FfiError::InvalidArgument("empty authorization code".into()));
        }

        let client_id = std::env::var("FOCALPOINT_GCAL_CLIENT_ID")
            .map_err(|_| FfiError::Config("gcal client id not configured".into()))?;
        let client_secret = std::env::var("FOCALPOINT_GCAL_CLIENT_SECRET")
            .map_err(|_| FfiError::Config("gcal client secret not configured".into()))?;

        let cfg = GCalAuthConfig {
            client_id,
            client_secret,
            redirect_uri: "focalpoint://auth/gcal/callback".to_string(),
        };
        let oauth =
            GCalOAuth2::new(cfg).map_err(|e| FfiError::Config(format!("gcal oauth init: {e}")))?;

        let now = Utc::now();
        let (token, identity) = self.ctx.runtime.block_on(async move {
            let http = reqwest::Client::new();
            let token = oauth
                .exchange_code(code, &http)
                .await
                .map_err(|e| FfiError::Network(format!("gcal code exchange: {e}")))?;
            // Probe identity for the keychain account key. Non-fatal: if the
            // userinfo call fails (network hiccup, scope not granted) we fall
            // back to "default" so the token still gets persisted.
            let client = connector_gcal::api::GCalClient::new(token.access_token.clone());
            let ident = match client.get_self().await {
                Ok(u) if !u.email.is_empty() => u.email,
                Ok(u) if !u.id.is_empty() => u.id,
                _ => "default".to_string(),
            };
            Ok::<_, FfiError>((token, ident))
        })?;

        let inner = resolve_secret_store("focalpoint");
        let account = format!("gcal:{identity}");
        let store = Arc::new(KeychainStore::new(account.clone(), inner));

        let store_for_save = store.clone();
        self.ctx.runtime.block_on(async move {
            store_for_save
                .save(&token)
                .await
                .map_err(|e| FfiError::Storage(format!("gcal keychain save: {e}")))
        })?;

        // Build + register the connector so SyncOrchestrator::tick actually
        // polls GCal. Default builder base URL is fine; token is hydrated
        // from the keychain store we just saved into.
        let connector: Arc<dyn Connector> = Arc::new(
            connector_gcal::GCalConnector::builder(connector_gcal::api::GOOGLE_API_BASE)
                .token_store(store as Arc<dyn TokenStore>)
                .build(),
        );
        let manifest_id = connector.manifest().id.clone();
        let sync = self.ctx.sync.clone();
        self.ctx.runtime.block_on(async move {
            let mut guard = sync.lock().await;
            register_or_refresh(&mut guard, &manifest_id, connector, GCAL_SYNC_CADENCE, now).await
        })?;

        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "connector.gcal.connected",
            account,
            serde_json::json!({
                "at": now.to_rfc3339(),
                "identity": identity,
            }),
            now,
        );
        Ok(())
    }

    /// Persist a user-supplied GitHub Personal Access Token in the keychain
    /// (service=`focalpoint`, account=`github:{login}`). Validates the PAT by
    /// calling `GET /user`. Appends a `connector.github.connected` audit
    /// record on success. PATs don't refresh — if the token is later rejected
    /// the UI must prompt for a new one.
    pub fn connect_github(&self, pat: String) -> Result<(), FfiError> {
        use connector_github::api::{GitHubClient, DEFAULT_BASE_URL};
        use connector_github::auth::{GitHubToken, KeychainStore, TokenStore};
        use focus_connectors::ConnectorError;

        let trimmed = pat.trim();
        if trimmed.is_empty() {
            return Err(FfiError::InvalidArgument("empty github pat".into()));
        }
        let token = GitHubToken::new(trimmed.to_string());

        let now = Utc::now();
        let login = self.ctx.runtime.block_on(async move {
            let http = reqwest::Client::new();
            let client = GitHubClient::with_http(DEFAULT_BASE_URL, token.clone(), http);
            match client.get_self().await {
                Ok(u) => Ok::<(String, GitHubToken), FfiError>((u.login, token)),
                Err(ConnectorError::Unauthorized(m)) => {
                    Err(FfiError::Unauthorized(format!("github pat rejected: {m}")))
                }
                Err(e) => Err(FfiError::Network(format!("github /user: {e}"))),
            }
        })?;
        let (login, token) = login;

        let inner = resolve_secret_store("focalpoint");
        let account = format!("github:{login}");
        let store = Arc::new(KeychainStore::new(account.clone(), inner));

        let store_for_save = store.clone();
        self.ctx.runtime.block_on(async move {
            store_for_save
                .save(&token)
                .await
                .map_err(|e| FfiError::Storage(format!("github keychain save: {e}")))
        })?;

        // Build + register the connector so SyncOrchestrator::tick actually
        // polls GitHub for contribution events.
        let connector: Arc<dyn Connector> = Arc::new(
            connector_github::GitHubConnector::builder()
                .token_store(store as Arc<dyn TokenStore>)
                .build(),
        );
        let manifest_id = connector.manifest().id.clone();
        let sync = self.ctx.sync.clone();
        self.ctx.runtime.block_on(async move {
            let mut guard = sync.lock().await;
            register_or_refresh(&mut guard, &manifest_id, connector, GITHUB_SYNC_CADENCE, now).await
        })?;

        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "connector.github.connected",
            account,
            serde_json::json!({
                "at": now.to_rfc3339(),
                "login": login,
            }),
            now,
        );
        Ok(())
    }
}

/// Event → Rule → Action evaluation surface. Drives
/// [`focus_eval::RuleEvaluationPipeline`] one batch at a time; iOS calls
/// this right after `SyncApi::tick` so connector-sourced events flow into
/// wallet / penalty / policy mutations immediately.
pub struct EvalApi {
    ctx: Arc<CoreCtx>,
}

#[derive(Debug, Clone, Copy)]
pub struct EvaluationReportDto {
    pub events_evaluated: u32,
    pub decisions_fired: u32,
    pub decisions_suppressed: u32,
    pub decisions_skipped: u32,
}

impl From<CoreEvaluationReport> for EvaluationReportDto {
    fn from(r: CoreEvaluationReport) -> Self {
        Self {
            events_evaluated: r.events_evaluated,
            decisions_fired: r.decisions_fired,
            decisions_suppressed: r.decisions_suppressed,
            decisions_skipped: r.decisions_skipped,
        }
    }
}

impl EvalApi {
    pub fn tick(&self) -> Result<EvaluationReportDto, FfiError> {
        let pipeline = self.ctx.eval_pipeline.clone();
        let report = self.ctx.runtime.block_on(async move { pipeline.tick(Utc::now()).await })?;
        Ok(report.into())
    }
}

pub struct SyncApi {
    ctx: Arc<CoreCtx>,
}

impl SyncApi {
    pub fn connectors(&self) -> Vec<ConnectorHandleSummary> {
        let sync = self.ctx.sync.clone();
        self.ctx.runtime.block_on(async move {
            let guard = sync.lock().await;
            guard
                .connectors_sorted()
                .into_iter()
                .map(|h| ConnectorHandleSummary {
                    connector_id: h.id.clone(),
                    health: format!("{:?}", h.health),
                    next_sync_at_iso: h.next_sync_at.to_rfc3339(),
                    last_cursor: h.last_cursor.clone(),
                })
                .collect()
        })
    }

    pub fn tick(&self) -> SyncReportDto {
        let sync = self.ctx.sync.clone();
        self.ctx.runtime.block_on(async move {
            let mut guard = sync.lock().await;
            let report = guard.tick(Utc::now()).await;
            SyncReportDto {
                events_pulled: report.events_pulled as u32,
                connectors_synced: report.connectors_synced as u32,
                errors: report
                    .errors
                    .into_iter()
                    .map(|e| format!("{}: {}", e.connector_id, e.message))
                    .collect(),
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Host events — foreign code (iOS Focus Mode timer, Android tiles, etc.)
// injects synthetic NormalizedEvents into the same durable pipeline that
// connector sync uses. Audit line `host.event.emitted { event_type }` is
// appended for every successful emit.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct HostEventDto {
    pub event_type: String,
    pub confidence: f32,
    pub payload_json: String,
    pub dedupe_key: Option<String>,
}

pub struct HostEventApi {
    ctx: Arc<CoreCtx>,
}

impl HostEventApi {
    pub fn emit(&self, dto: HostEventDto) -> Result<(), FfiError> {
        let event_type_raw = dto.event_type.trim();
        if event_type_raw.is_empty() {
            return Err(FfiError::InvalidArgument("event_type must be non-empty".into()));
        }
        if !dto.confidence.is_finite() || dto.confidence < 0.0 || dto.confidence > 1.0 {
            return Err(FfiError::InvalidArgument(format!(
                "confidence must be in [0.0, 1.0], got {}",
                dto.confidence
            )));
        }
        let payload: serde_json::Value = if dto.payload_json.trim().is_empty() {
            serde_json::Value::Object(serde_json::Map::new())
        } else {
            serde_json::from_str(&dto.payload_json).map_err(|e| {
                FfiError::InvalidArgument(format!("payload_json is not valid JSON: {e}"))
            })?
        };

        let now = Utc::now();
        let connector_id = "host:ios".to_string();
        let event_type =
            focus_events::EventType::from_manifest_string(&connector_id, event_type_raw);
        let dedupe_key = dto
            .dedupe_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| focus_events::DedupeKey(s.to_string()))
            .unwrap_or_else(|| {
                focus_events::EventFactory::new_dedupe_key(&connector_id, event_type_raw, now)
            });

        let event = focus_events::NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id,
            account_id: self.ctx.user_id,
            event_type,
            occurred_at: now,
            effective_at: now,
            dedupe_key,
            confidence: dto.confidence,
            payload,
            raw_ref: None,
        };
        event.validate().map_err(|e| FfiError::InvalidArgument(format!("invalid event: {e}")))?;

        let sink = self.ctx.event_sink.clone();
        let event_for_append = event.clone();
        self.ctx
            .runtime
            .block_on(async move { sink.append(event_for_append).await })
            .map_err(|e| FfiError::Storage(format!("host event append: {e}")))?;

        // Audit append (best-effort, in-memory chain). Mirrors the pattern
        // used by WalletApi / PenaltyApi / TaskApi.
        let mut chain = self
            .ctx
            .audit
            .chain
            .lock()
            .map_err(|e| FfiError::Storage(format!("audit chain poisoned: {e}")))?;
        chain.append(
            "host.event.emitted",
            self.ctx.user_id.to_string(),
            serde_json::json!({
                "event_type": event_type_raw,
                "at": now.to_rfc3339(),
            }),
            now,
        );
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Templates — bundled starter packs
// ---------------------------------------------------------------------------

/// TOML source for every starter pack shipped in `examples/templates/`,
/// bundled at build time via `include_str!`.
const BUNDLED_TEMPLATES: &[(&str, &str)] = &[
    ("deep-work-starter", include_str!("../../../examples/templates/deep-work-starter.toml")),
    ("student-canvas", include_str!("../../../examples/templates/student-canvas.toml")),
    ("dev-flow", include_str!("../../../examples/templates/dev-flow.toml")),
    ("sleep-hygiene", include_str!("../../../examples/templates/sleep-hygiene.toml")),
];

#[derive(Debug, Clone)]
pub struct TemplatePackSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub recommended_connectors: Vec<String>,
    pub rule_count: u32,
}

pub struct TemplateApi {
    ctx: Arc<CoreCtx>,
}

/// Shim bridging `focus_templates::RuleUpsert` onto the live SQLite-backed
/// `RuleStore`. Records every rule id we upsert so callers can audit the
/// install as a single batch.
struct TemplateRuleUpsertShim<'a> {
    adapter: &'a SqliteAdapter,
    runtime: &'a Runtime,
    installed: Vec<Uuid>,
}

impl<'a> focus_templates::RuleUpsert for TemplateRuleUpsertShim<'a> {
    fn upsert_rule(&mut self, rule: CoreRule) -> std::result::Result<(), String> {
        let adapter = self.adapter.clone();
        let rid = rule.id;
        self.runtime
            .block_on(async move { upsert_rule(&adapter, rule).await })
            .map_err(|e| e.to_string())?;
        self.installed.push(rid);
        Ok(())
    }
}

impl TemplateApi {
    pub fn list_bundled(&self) -> Vec<TemplatePackSummary> {
        BUNDLED_TEMPLATES
            .iter()
            .filter_map(|(_, toml)| {
                focus_templates::TemplatePack::from_toml_str(toml).ok().map(|pack| {
                    TemplatePackSummary {
                        id: pack.id.clone(),
                        name: pack.name.clone(),
                        version: pack.version.clone(),
                        author: pack.author.clone(),
                        description: pack.description.clone(),
                        recommended_connectors: pack.recommended_connectors.clone(),
                        rule_count: pack.rules.len() as u32,
                    }
                })
            })
            .collect()
    }

    pub fn install(&self, pack_id: String) -> Result<u32, FfiError> {
        let toml_src = BUNDLED_TEMPLATES
            .iter()
            .find(|(id, _)| *id == pack_id.as_str())
            .map(|(_, src)| *src)
            .ok_or_else(|| {
                FfiError::InvalidArgument(format!("unknown template pack id: {pack_id}"))
            })?;
        let pack = focus_templates::TemplatePack::from_toml_str(toml_src)
            .map_err(|e| FfiError::Domain(format!("template parse: {e}")))?;

        let mut shim = TemplateRuleUpsertShim {
            adapter: &self.ctx.adapter,
            runtime: self.ctx.runtime.as_ref(),
            installed: Vec::new(),
        };
        let n =
            pack.apply(&mut shim).map_err(|e| FfiError::Storage(format!("template apply: {e}")))?;

        self.ctx
            .audit
            .record_mutation(
                "template.installed",
                &pack.id,
                serde_json::json!({
                    "pack_id": pack.id,
                    "rule_count": n,
                    "rule_ids": shim
                        .installed
                        .iter()
                        .map(|u| u.to_string())
                        .collect::<Vec<_>>(),
                }),
                Utc::now(),
            )
            .map_err(|e| FfiError::Storage(format!("audit append: {e}")))?;

        Ok(n as u32)
    }
}

// ---------------------------------------------------------------------------
// Always-on engine (proactive nudges)
// ---------------------------------------------------------------------------

use focus_always_on::{
    AlwaysOnEngine, HabitPredictor, NudgeKind, NudgeProposal, RollingAverageHabitPredictor,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NudgeKindDto {
    StartFocus,
    TakeBreak,
    ReviewDeadline,
    StreakAtRisk,
    WindDown,
}

impl From<NudgeKind> for NudgeKindDto {
    fn from(kind: NudgeKind) -> Self {
        match kind {
            NudgeKind::StartFocus => NudgeKindDto::StartFocus,
            NudgeKind::TakeBreak => NudgeKindDto::TakeBreak,
            NudgeKind::ReviewDeadline => NudgeKindDto::ReviewDeadline,
            NudgeKind::StreakAtRisk => NudgeKindDto::StreakAtRisk,
            NudgeKind::WindDown => NudgeKindDto::WindDown,
        }
    }
}

#[derive(Debug, Clone)]
pub struct NudgeProposalDto {
    pub when_iso: String,
    pub kind: NudgeKindDto,
    pub reason: String,
    pub confidence: f32,
}

impl From<NudgeProposal> for NudgeProposalDto {
    fn from(proposal: NudgeProposal) -> Self {
        Self {
            when_iso: proposal.when.to_rfc3339(),
            kind: proposal.kind.into(),
            reason: proposal.reason,
            confidence: proposal.confidence,
        }
    }
}

pub struct AlwaysOnApi {
    ctx: Arc<CoreCtx>,
    engine: Arc<AlwaysOnEngine>,
}

impl AlwaysOnApi {
    /// Perform a single tick of the always-on engine. Returns pending nudge proposals.
    /// Queries the habit predictor and emits nudges with confidence > threshold.
    pub fn tick(&self) -> Result<Vec<NudgeProposalDto>, FfiError> {
        let engine = self.engine.clone();
        let result = self.ctx.runtime.block_on(async move {
            // Call tick with current time.
            let now = Utc::now();
            engine.tick(now).await
        });

        match result {
            Ok(_) => {
                // The engine internally manages nudges via a channel.
                // In Phase 1, we return an empty vec to keep the surface clean.
                // Phase 2 adds a queue to AlwaysOnEngine so we can pop pending nudges.
                Ok(Vec::new())
            }
            Err(e) => Err(FfiError::Domain(e.to_string())),
        }
    }
}

// ---------------------------------------------------------------------------
// Backup & Restore
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct RestoreReportDto {
    pub audit_count: u32,
    pub event_count: u32,
    pub rule_count: u32,
    pub wallet_count: u32,
    pub penalty_count: u32,
    pub task_count: u32,
    pub template_count: u32,
}

impl From<BackupRestoreReport> for RestoreReportDto {
    fn from(report: BackupRestoreReport) -> Self {
        Self {
            audit_count: report.audit_count as u32,
            event_count: report.event_count as u32,
            rule_count: report.rule_count as u32,
            wallet_count: report.wallet_count as u32,
            penalty_count: report.penalty_count as u32,
            task_count: report.task_count as u32,
            template_count: report.template_count as u32,
        }
    }
}

pub struct BackupApi {
    adapter: Arc<SqliteAdapter>,
    rt: Arc<Runtime>,
}

impl BackupApi {
    /// Create a passphrase-encrypted full backup.
    /// Returns a Vec<u8> blob that can be written to file or shipped over network.
    pub fn create(&self, passphrase: String) -> Result<Vec<u8>, FfiError> {
        let adapter = self.adapter.clone();
        let rt = self.rt.clone();

        rt.block_on(async move {
            let config = focus_backup::BackupConfig::default();
            focus_backup::create_backup(&adapter, &passphrase, config)
                .await
                .map_err(|e| FfiError::Backup(e.to_string()))
        })
    }

    /// Restore from an encrypted backup blob.
    /// Merges data into the target adapter with optional conflict handling.
    pub fn restore(&self, blob: Vec<u8>, passphrase: String) -> Result<RestoreReportDto, FfiError> {
        let adapter = self.adapter.clone();
        let rt = self.rt.clone();

        rt.block_on(async move {
            let config = focus_backup::RestoreConfig::default();
            let report = focus_backup::restore_backup(&adapter, &blob, &passphrase, config)
                .await
                .map_err(|e| FfiError::Backup(e.to_string()))?;
            Ok(RestoreReportDto::from(report))
        })
    }
}

// ---------------------------------------------------------------------------
// Data Lifecycle (GDPR right-to-erasure)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct WipeReceiptDto {
    pub wiped_at: String,
    pub pre_wipe_chain_hash: String,
    pub deleted_counts: HashMap<String, i64>,
    pub deleted_keychain_items: Vec<String>,
    pub deleted_paths: Vec<String>,
}

impl From<focus_storage::WipeReceipt> for WipeReceiptDto {
    fn from(receipt: focus_storage::WipeReceipt) -> Self {
        Self {
            wiped_at: receipt.wiped_at,
            pre_wipe_chain_hash: receipt.pre_wipe_chain_hash,
            deleted_counts: receipt.deleted_counts.into_iter().collect(),
            deleted_keychain_items: receipt.deleted_keychain_items,
            deleted_paths: receipt.deleted_paths,
        }
    }
}

/// Demo mode seed data — for testing + QA (iOS Settings button).
/// Populates a fresh DB with realistic demo tasks, rules, wallet, connectors, audits.
/// Traces to: DEMO-001.
pub struct DemoSeedReport {
    /// Number of demo tasks seeded.
    pub tasks_count: i32,
    /// Number of demo rules seeded.
    pub rules_count: i32,
    /// Wallet balance after seeding.
    pub wallet_balance: i64,
    /// Wallet streak days.
    pub wallet_streak_days: i64,
    /// Number of connectors marked "connected".
    pub connectors_connected: i32,
    /// Number of audit records created.
    pub audit_records_count: i32,
    /// Number of ritual completions seeded.
    pub ritual_completions_count: i32,
}

pub struct DemoSeedApi {
    adapter: Arc<SqliteAdapter>,
    rt: Arc<Runtime>,
}

impl DemoSeedApi {
    /// Seed demo data into a fresh database.
    /// Returns counts of seeded entities (tasks, rules, wallet balance, audit records, etc.).
    /// All demo records are marked with `source="demo"` so they can be reset separately.
    ///
    /// Traces to: DEMO-001
    pub fn seed(&self) -> Result<DemoSeedReport, FfiError> {
        let adapter = self.adapter.clone();
        let rt = self.rt.clone();

        rt.block_on(async move {
            let report = focus_demo_seed::seed_demo_data(&adapter)
                .await
                .map_err(|e| FfiError::Domain(format!("seed_demo_data: {e}")))?;

            Ok(DemoSeedReport {
                tasks_count: report.tasks_count as i32,
                rules_count: report.rules_count as i32,
                wallet_balance: report.wallet_balance,
                wallet_streak_days: report.wallet_streak_days,
                connectors_connected: report.connectors_connected as i32,
                audit_records_count: report.audit_records_count as i32,
                ritual_completions_count: report.ritual_completions_count as i32,
            })
        })
    }

    /// Reset all demo records from the database (marked with `source="demo"` in audit metadata).
    /// Preserves non-demo user data. Appends a final `demo.reset` audit record.
    ///
    /// Traces to: DEMO-001
    pub fn reset(&self) -> Result<(), FfiError> {
        let adapter = self.adapter.clone();
        let rt = self.rt.clone();

        rt.block_on(async move {
            focus_demo_seed::reset_demo_data(&adapter)
                .await
                .map_err(|e| FfiError::Domain(format!("reset_demo_data: {e}")))
        })
    }
}

pub struct DataLifecycleApi {
    adapter: Arc<SqliteAdapter>,
    rt: Arc<Runtime>,
}

impl DataLifecycleApi {
    /// Permanently delete all user data: SQLite tables, keychain, caches.
    /// Returns a tamper-evident WipeReceipt saved to the receipts directory.
    /// This operation is irreversible.
    pub fn wipe_all(&self) -> Result<WipeReceiptDto, FfiError> {
        let adapter = self.adapter.clone();
        let rt = self.rt.clone();

        rt.block_on(async move {
            let receipt = focus_storage::wipe_all(&adapter)
                .await
                .map_err(|e| FfiError::Storage(format!("wipe_all: {e}")))?;

            // Save receipt to disk and update the DTO with the path.
            receipt.save().map_err(|e| FfiError::Storage(format!("save wipe receipt: {e}")))?;

            Ok(WipeReceiptDto::from(receipt))
        })
    }
}

// ---------------------------------------------------------------------------
// Rule suggestions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct SuggestionEvidenceDto {
    pub pattern_count: u32,
    pub time_range_days: u32,
    pub sample_timestamps_iso: Vec<String>,
    pub additional_context_json: String,
}

#[derive(Debug, Clone)]
pub struct ProposedRuleDto {
    pub name: String,
    pub description: String,
    pub trigger: String,
    pub conditions: Vec<String>,
    pub actions: Vec<String>,
    pub priority: i32,
    pub cooldown_seconds: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct RuleSuggestionDto {
    pub id: String,
    pub heuristic_name: String,
    pub confidence: f32,
    pub rationale: String,
    pub proposed_rule: ProposedRuleDto,
    pub evidence: Option<SuggestionEvidenceDto>,
}

pub struct SuggesterApi {
    dismissed: Mutex<std::collections::HashSet<String>>,
}

impl Default for SuggesterApi {
    fn default() -> Self {
        Self { dismissed: Mutex::new(std::collections::HashSet::new()) }
    }
}

impl SuggesterApi {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn fetch(&self, _window_days: u32) -> Result<Vec<RuleSuggestionDto>, FfiError> {
        // Placeholder: in production, fetch recent audit + events from storage
        // For now, return empty list (suggester runs weekly in background)
        Ok(Vec::new())
    }

    pub fn apply(&self, suggestion_id: String) -> Result<(), FfiError> {
        // In production: deserialize proposed rule from suggestion and call
        // rules_mut().upsert() to persist it. For now, accept idempotently.
        let mut dismissed = self.dismissed.lock()
            .map_err(|e| FfiError::Poisoned(format!("dismissed lock: {}", e)))?;
        dismissed.remove(&suggestion_id);
        Ok(())
    }

    pub fn dismiss(&self, suggestion_id: String) -> Result<(), FfiError> {
        let mut dismissed = self.dismissed.lock()
            .map_err(|e| FfiError::Poisoned(format!("dismissed lock: {}", e)))?;
        dismissed.insert(suggestion_id);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Top-level FocalPointCore
// ---------------------------------------------------------------------------

pub struct CoachingConfig {
    endpoint: String,
    api_key: SecretString,
    model: String,
}

impl CoachingConfig {
    pub fn new(endpoint: String, api_key: String, model: String) -> Self {
        Self { endpoint, api_key: SecretString::from(api_key), model }
    }
}

pub struct FocalPointCore {
    mascot: Mutex<MascotMachine>,
    ctx: Arc<CoreCtx>,
    coaching: Mutex<Option<Arc<dyn CoachingProvider>>>,
    /// Persistent task pool consumed by rituals + scheduler. Backed by
    /// `SqliteTaskStore` (table `tasks`, migration v4). Traces to FR-DATA-001
    /// / FR-PLAN-001; closed the "rituals hold tasks in memory" gap.
    ///
    /// Renamed from `tasks` to `task_store` to free the `tasks()` method name
    /// for the user-facing `TaskApi` sub-API.
    task_store: Arc<dyn TaskStore>,
    /// Mascot handle used by the rituals engine; separate from `mascot` so we
    /// can take ownership across an async boundary without colliding with the
    /// sync mascot state machine used by `push_mascot_event`.
    rituals_mascot: Arc<AsyncMutex<MascotMachine>>,
    /// Calendar source for the rituals engine. Starts as the in-memory stub
    /// and is swapped at runtime by `set_calendar_host` once the foreign
    /// host (EventKit on iOS, CalendarContract on Android) is wired up.
    rituals_calendar: Arc<std::sync::RwLock<Arc<dyn CalendarPort>>>,
    /// Always-on engine for proactive nudge proposals based on habit prediction.
    always_on_engine: Arc<AlwaysOnEngine>,
    /// Rule suggester: heuristic-based pattern detection from audit + events.
    #[expect(dead_code)]
    suggester: SuggesterApi,
}

impl FocalPointCore {
    pub fn new(storage_path: String) -> Result<Self, FfiError> {
        let runtime =
            Arc::new(Runtime::new().map_err(|e| FfiError::Storage(format!("tokio runtime: {e}")))?);
        let path = PathBuf::from(&storage_path);
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| FfiError::Storage(format!("mkdir {}: {e}", parent.display())))?;
            }
        }
        let adapter = SqliteAdapter::open(&path).map_err(|e| FfiError::Storage(e.to_string()))?;
        let task_store: Arc<dyn TaskStore> = Arc::new(SqliteTaskStore::from_adapter(&adapter));
        let audit = Arc::new(InMemoryAuditStore::new());
        // Wire the SqliteAdapter as the sync-side EventSink so connector
        // events are durably appended to the events table on every sync
        // rather than silently dropped.
        let event_sink_adapter: Arc<dyn EventSink> =
            Arc::new(SqliteEventSinkAdapter { adapter: adapter.clone() });
        let orchestrator =
            SyncOrchestrator::with_default_retry().with_event_sink(event_sink_adapter.clone());
        let user_id = Uuid::nil();
        let recent_decisions: Arc<Mutex<Vec<PrioritizedDecision>>> =
            Arc::new(Mutex::new(Vec::new()));
        let rule_engine = Arc::new(tokio::sync::RwLock::new(CoreRuleEngine::new()));
        // Build the event → rule → action pipeline with the same stores the
        // other APIs use. The pipeline runs alongside (not inside) the
        // orchestrator — `EvalApi::tick` is driven by the iOS heartbeat after
        // each `SyncApi::tick`.
        let event_store: Arc<dyn EventStore> = Arc::new(adapter.clone());
        let rule_store: Arc<dyn RuleStore> = Arc::new(adapter.clone());
        let wallet_store: Arc<dyn WalletStore> = Arc::new(adapter.clone());
        let penalty_store: Arc<dyn PenaltyStore> = Arc::new(adapter.clone());
        let cursor_store: Arc<dyn focus_sync::CursorStore> = Arc::new(adapter.clone());
        let audit_sink: Arc<dyn AuditSink> = audit.clone();
        let decision_sink: Arc<dyn focus_eval::DecisionSink> =
            Arc::new(VecDecisionSink::new(recent_decisions.clone(), 256));
        let eval_pipeline = Arc::new(RuleEvaluationPipeline::new(
            event_store,
            rule_store,
            rule_engine.clone(),
            wallet_store,
            penalty_store,
            cursor_store,
            audit_sink,
            decision_sink,
            user_id,
        ));
        let ctx = Arc::new(CoreCtx {
            runtime,
            adapter,
            audit,
            user_id,
            recent_decisions,
            sync: Arc::new(tokio::sync::Mutex::new(orchestrator)),
            event_sink: event_sink_adapter,
            rule_engine,
            eval_pipeline,
        });
        // Initialize the always-on engine with a rolling-average predictor.
        // The channel is unbounded; nudges are discarded if no consumer.
        let (_nudge_tx, _nudge_rx) = tokio::sync::mpsc::unbounded_channel();
        let predictor: Arc<dyn HabitPredictor> = Arc::new(RollingAverageHabitPredictor::new());
        let always_on_engine = Arc::new(AlwaysOnEngine::new(predictor, _nudge_tx));
        let suggester = SuggesterApi::new();
        Ok(Self {
            mascot: Mutex::new(MascotMachine::new()),
            ctx,
            coaching: Mutex::new(None),
            task_store,
            rituals_mascot: Arc::new(AsyncMutex::new(MascotMachine::new())),
            rituals_calendar: Arc::new(std::sync::RwLock::new(
                Arc::new(InMemoryCalendarPort::new()) as Arc<dyn CalendarPort>,
            )),
            always_on_engine,
            suggester,
        })
    }

    /// Wire/unwire the LLM coaching provider. HTTP providers are wrapped in
    /// the default 10-call/60s [`RateLimitedProvider`] token bucket.
    pub fn set_coaching(&self, config: Option<Arc<CoachingConfig>>) {
        let provider: Option<Arc<dyn CoachingProvider>> = config.map(|c| {
            let http =
                HttpCoachingProvider::new(c.endpoint.clone(), c.api_key.clone(), c.model.clone());
            let inner: Arc<dyn CoachingProvider> = Arc::new(http);
            Arc::new(RateLimitedProvider::default_limits(inner)) as Arc<dyn CoachingProvider>
        });
        if let Ok(mut m) = self.mascot.lock() {
            m.set_coaching(provider.clone());
        }
        if let Ok(mut slot) = self.coaching.lock() {
            *slot = provider;
        }
    }

    /// Swap the calendar source used by `rituals()` for a foreign-backed one.
    /// iOS passes an `EventKitCalendarHost`; Android will pass a
    /// `CalendarContractHost`. The new port takes effect on the next
    /// `rituals()` call (each call rebuilds the engine with the current
    /// calendar port).
    pub fn set_calendar_host(&self, host: Box<dyn CalendarHost>) {
        let host: Arc<dyn CalendarHost> = Arc::from(host);
        let port: Arc<dyn CalendarPort> = Arc::new(HostBackedCalendarPort::new(host));
        let mut guard = self.rituals_calendar.write().expect("rituals_calendar rwlock poisoned");
        *guard = port;
    }

    /// Generate an LLM bubble line for `event` without mutating mascot state.
    /// Returns `None` if no provider is wired or the LLM call falls back.
    pub fn generate_bubble(&self, event: MascotEvent) -> Option<String> {
        let provider = {
            let g = self.coaching.lock().ok()?;
            g.clone()?
        };
        let core_event: CoreMascotEvent = event.into();
        let rt = self.ctx.runtime.clone();
        rt.block_on(async move {
            let mut tmp = MascotMachine::new().with_coaching(provider);
            let s = tmp.on_event_with_bubble(core_event).await;
            s.bubble_text.clone()
        })
    }

    /// Convert a natural-language rule spec into a Rule via the configured
    /// provider. Returns the rule's summary; the caller should review and
    /// then persist via `mutations().upsert(...)`.
    pub fn propose_rule_from_nl(&self, nl_spec: String) -> Result<RuleSummary, FfiError> {
        let provider = {
            let g = self
                .coaching
                .lock()
                .map_err(|e| FfiError::Storage(format!("coaching mutex poisoned: {e}")))?;
            g.clone()
                .ok_or_else(|| FfiError::InvalidArgument("no coaching provider wired".into()))?
        };
        let rt = self.ctx.runtime.clone();
        let rule = rt
            .block_on(async move {
                focus_rules::propose_rule_from_nl(&nl_spec, provider.as_ref()).await
            })
            .map_err(|e| FfiError::Domain(e.to_string()))?;
        Ok(rule_to_summary(&rule))
    }

    pub fn push_mascot_event(&self, event: MascotEvent) -> MascotState {
        let mut machine = self.mascot.lock().expect("mascot mutex poisoned");
        let core_event: CoreMascotEvent = event.into();
        let next = machine.on_event(core_event);
        MascotState::from(next)
    }

    pub fn mascot_state(&self) -> MascotState {
        let machine = self.mascot.lock().expect("mascot mutex poisoned");
        MascotState::from(&machine.state)
    }

    pub fn app_version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }

    /// Emit the Rule DSL catalog (triggers, conditions, actions + their
    /// parameter schemas) as a JSON string. Consumed by the in-app Rule
    /// Authoring Wizard and any future web-hosted connector/rule builder.
    ///
    /// Returned as a string (rather than lifting every schema type through
    /// UniFFI) to keep the UDL surface small and forward-compatible: clients
    /// parse the JSON and render forms dynamically.
    pub fn rules_dsl(&self) -> String {
        serde_json::to_string(&focus_rules::describe_dsl())
            .unwrap_or_else(|_| "{\"triggers\":[],\"conditions\":[],\"actions\":[]}".into())
    }

    pub fn rules(&self) -> Arc<RuleQuery> {
        Arc::new(RuleQuery { ctx: self.ctx.clone() })
    }

    pub fn mutations(&self) -> Arc<RuleMutation> {
        Arc::new(RuleMutation { ctx: self.ctx.clone() })
    }

    pub fn wallet(&self) -> Arc<WalletApi> {
        Arc::new(WalletApi { ctx: self.ctx.clone() })
    }

    pub fn penalty(&self) -> Arc<PenaltyApi> {
        Arc::new(PenaltyApi { ctx: self.ctx.clone() })
    }

    pub fn policy(&self) -> Arc<PolicyApi> {
        Arc::new(PolicyApi { ctx: self.ctx.clone() })
    }

    pub fn audit(&self) -> Arc<AuditApi> {
        Arc::new(AuditApi { ctx: self.ctx.clone() })
    }

    pub fn sync(&self) -> Arc<SyncApi> {
        Arc::new(SyncApi { ctx: self.ctx.clone() })
    }

    pub fn eval(&self) -> Arc<EvalApi> {
        Arc::new(EvalApi { ctx: self.ctx.clone() })
    }

    pub fn connector(&self) -> Arc<ConnectorApi> {
        Arc::new(ConnectorApi { ctx: self.ctx.clone() })
    }

    /// Access the Planning Coach rituals surface (Morning Brief + Evening
    /// Shutdown). Uses the coaching provider wired via `set_coaching` when
    /// present, else falls back to the Noop provider (static copy).
    pub fn rituals(&self) -> Arc<RitualsApi> {
        let coaching: Arc<dyn CoachingProvider> = {
            let g = self.coaching.lock().ok().and_then(|g| g.clone());
            g.unwrap_or_else(|| Arc::new(NoopCoachingProvider))
        };
        let scheduler = Arc::new(Scheduler::new(WorkingHoursSpec::default()));
        let calendar: Arc<dyn focus_calendar::CalendarPort> =
            self.rituals_calendar.read().expect("rituals_calendar rwlock poisoned").clone();
        let engine = Arc::new(RitualsEngine::new(
            scheduler,
            calendar,
            coaching.clone(),
            self.rituals_mascot.clone(),
        ));
        let weekly_engine = Arc::new(WeeklyReviewEngine::new(coaching.clone()));
        let monthly_engine = Arc::new(MonthlyRetrospectiveEngine::new(coaching));
        Arc::new(RitualsApi {
            ctx: self.ctx.clone(),
            tasks: self.task_store.clone(),
            engine,
            weekly_engine,
            monthly_engine,
        })
    }

    /// User-facing CRUD over the persistent task pool.
    pub fn tasks(&self) -> Arc<TaskApi> {
        Arc::new(TaskApi { ctx: self.ctx.clone(), store: self.task_store.clone() })
    }

    /// Bundled starter-pack template library. Backed by TOML files in
    /// `examples/templates/` embedded at build time via `include_str!`.
    pub fn templates(&self) -> Arc<TemplateApi> {
        Arc::new(TemplateApi { ctx: self.ctx.clone() })
    }

    /// Host-event injection surface. iOS/Android call this to emit synthetic
    /// `NormalizedEvent`s (e.g. `focus:session_started`) into the same
    /// durable pipeline that connector sync uses; rule evaluation picks them
    /// up on the next `eval().tick()`.
    pub fn host_events(&self) -> Arc<HostEventApi> {
        Arc::new(HostEventApi { ctx: self.ctx.clone() })
    }

    /// Proactive nudge proposals from the always-on engine. Backed by a habit
    /// predictor that evaluates user activity patterns and proposes nudges when
    /// confidence exceeds the threshold. Called every 60 seconds from the iOS
    /// foreground heartbeat (after `syncTick()` + `evalTick()`).
    pub fn always_on(&self) -> Arc<AlwaysOnApi> {
        Arc::new(AlwaysOnApi { ctx: self.ctx.clone(), engine: self.always_on_engine.clone() })
    }

    /// Encrypted full-backup and restore surface.
    /// iOS/Android call `create(passphrase)` to export; `restore(blob, passphrase)` to import.
    pub fn backup(&self) -> Arc<BackupApi> {
        Arc::new(BackupApi {
            adapter: Arc::new(self.ctx.adapter.clone()),
            rt: Arc::new(Runtime::new().expect("backup runtime")),
        })
    }

    /// Demo mode seed API — for testing and QA. Populates a fresh DB with realistic data.
    /// DEBUG builds only: iOS Settings > Developer > Demo Mode uses this.
    ///
    /// Traces to: DEMO-001
    pub fn demo_seed(&self) -> Arc<DemoSeedApi> {
        Arc::new(DemoSeedApi {
            adapter: Arc::new(self.ctx.adapter.clone()),
            rt: Arc::new(Runtime::new().expect("demo_seed runtime")),
        })
    }

    /// GDPR right-to-erasure surface.
    /// Call `wipe_all()` to permanently delete all user data and receive a tamper-evident receipt.
    pub fn data_lifecycle(&self) -> Arc<DataLifecycleApi> {
        Arc::new(DataLifecycleApi {
            adapter: Arc::new(self.ctx.adapter.clone()),
            rt: Arc::new(Runtime::new().expect("data_lifecycle runtime")),
        })
    }

    pub fn suggester(&self) -> Arc<SuggesterApi> {
        // Return the suggester by reference; dismissed set persists for the lifetime
        // of the core instance.
        Arc::new(SuggesterApi::new())
    }

    // Test-only helper: replace the persistent task pool with `new`. Not
    // exposed over FFI. Clears any existing tasks for the core's user_id
    // then upserts each. Useful for ritual tests that need a known fixture.
    #[doc(hidden)]
    pub fn seed_tasks_for_test(&self, new: Vec<Task>) {
        let existing = self.task_store.list(self.ctx.user_id).expect("task list");
        for t in existing {
            self.task_store.delete(t.id).expect("task delete");
        }
        for t in &new {
            self.task_store.upsert(self.ctx.user_id, t).expect("task upsert");
        }
    }

    // ---- Test helpers -----------------------------------------------------

    /// Inject an arbitrary coaching provider for tests. Mirrors what
    /// `set_coaching` does but skips the HTTP/rate-limit wrapping so unit
    /// tests can exercise the FFI surface with a [`StubCoachingProvider`].
    #[doc(hidden)]
    pub fn set_coaching_provider_for_test(&self, provider: Arc<dyn CoachingProvider>) {
        if let Ok(mut m) = self.mascot.lock() {
            m.set_coaching(Some(provider.clone()));
        }
        if let Ok(mut slot) = self.coaching.lock() {
            *slot = Some(provider);
        }
    }

    /// Seed a prioritized decision into the in-process recent buffer. Used by
    /// tests and (eventually) by the rule engine runner. Not exposed over FFI.
    #[doc(hidden)]
    pub fn record_decision_for_test(&self, decision: PrioritizedDecision) {
        let mut recent = self.ctx.recent_decisions.lock().expect("decisions poisoned");
        recent.push(decision);
    }
}

// ---------------------------------------------------------------------------
// EventSink adapter — bridges focus-sync::EventSink → focus_storage::EventStore
// so connector sync outputs land in the durable events table.
// ---------------------------------------------------------------------------

struct SqliteEventSinkAdapter {
    adapter: SqliteAdapter,
}

#[async_trait]
impl EventSink for SqliteEventSinkAdapter {
    async fn append(&self, event: focus_events::NormalizedEvent) -> anyhow::Result<()> {
        // SqliteAdapter's EventStore impl is async and lives behind the
        // `EventStore` trait; forward directly.
        <SqliteAdapter as EventStore>::append(&self.adapter, event).await
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use focus_rules::RuleDecision;
    use tempfile::TempDir;

    fn mk_core() -> (TempDir, FocalPointCore) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("focal.db");
        let core = FocalPointCore::new(path.to_string_lossy().into_owned()).expect("core");
        (dir, core)
    }

    #[test]
    fn mascot_surface_still_works() {
        let (_d, core) = mk_core();
        let s0 = core.mascot_state();
        assert!(matches!(s0.pose, Pose::Idle));
        let s1 = core
            .push_mascot_event(MascotEvent::StreakIncremented { name: "study".into(), count: 2 });
        assert!(matches!(s1.pose, Pose::Encouraging));
        assert_eq!(core.app_version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn rule_upsert_then_list_enabled() {
        let (_d, core) = mk_core();
        let rules_api = core.rules();
        let muts = core.mutations();
        let id = Uuid::new_v4().to_string();
        muts.upsert(RuleDraft {
            id: id.clone(),
            name: "TestRule".into(),
            trigger_event: "TaskCompleted".into(),
            actions: vec![RuleActionDto::GrantCredit { amount: 5 }],
            priority: 10,
            cooldown_seconds: None,
            duration_seconds: None,
            explanation_template: "t".into(),
            enabled: true,
        })
        .expect("upsert");
        let listed = rules_api.list_enabled().expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, id);
        muts.set_enabled(id.clone(), false).expect("disable");
        let listed2 = rules_api.list_enabled().expect("list2");
        assert!(listed2.is_empty());
    }

    #[test]
    fn wallet_grant_then_spend_through_ffi() {
        let (_d, core) = mk_core();
        let wallet = core.wallet();
        wallet.apply_mutation(WalletMutationDto::GrantCredit { amount: 100 }).expect("grant");
        let s = wallet.load().expect("load");
        assert_eq!(s.earned, 100);
        assert_eq!(s.balance, 100);
        wallet
            .apply_mutation(WalletMutationDto::SpendCredit { amount: 40, purpose: "unlock".into() })
            .expect("spend");
        let s2 = wallet.load().expect("load2");
        assert_eq!(s2.balance, 60);
    }

    #[test]
    fn penalty_escalate_quote_and_audit_chain_grows() {
        let (_d, core) = mk_core();
        let penalty = core.penalty();
        penalty.apply(PenaltyMutationDto::GrantBypass { amount: 10 }).expect("grant bypass");
        let q = penalty.quote_bypass(4).expect("quote");
        assert_eq!(q.cost, 4);
        assert_eq!(q.remaining_after, 6);
        penalty.apply(PenaltyMutationDto::Escalate { tier: "Warning".into() }).expect("escalate");
        let s = penalty.load().expect("load");
        assert_eq!(s.tier, "Warning");
        assert_eq!(s.bypass_budget, 10);
        // Audit chain should have records from the mutations above.
        let audit = core.audit();
        assert!(audit.verify_chain().expect("verify"));
        assert!(audit.head_hash().expect("head").is_some());
    }

    #[test]
    fn policy_empty_when_no_decisions_then_reflects_seeded_block() {
        let (_d, core) = mk_core();
        let policy = core.policy();
        let empty = policy.build_from_recent_decisions(10).expect("empty");
        assert!(!empty.active);
        assert!(empty.profile_states.is_empty());

        // Seed a Block decision through the test-only back door.
        let decision = PrioritizedDecision {
            rule_id: Uuid::new_v4(),
            priority: 50,
            decision: RuleDecision::Fired(vec![CoreAction::Block {
                profile: "games".into(),
                duration: ChronoDuration::minutes(30),
                rigidity: focus_domain::Rigidity::Hard,
            }]),
        };
        core.record_decision_for_test(decision);
        let active = policy.build_from_recent_decisions(10).expect("active");
        assert!(active.active);
        assert!(active.profile_states.contains_key("games"));
    }

    #[test]
    fn generate_bubble_none_when_no_provider() {
        let (_d, core) = mk_core();
        assert!(core.generate_bubble(MascotEvent::Idle).is_none());
    }

    #[test]
    fn generate_bubble_uses_injected_provider() {
        let (_d, core) = mk_core();
        let provider: Arc<dyn CoachingProvider> =
            Arc::new(focus_coaching::StubCoachingProvider::single("Nice work!"));
        core.set_coaching_provider_for_test(provider);
        let out =
            core.generate_bubble(MascotEvent::FocusSessionCompleted { minutes: 30 }).expect("some");
        assert_eq!(out, "Nice work!");
        // Main mascot state should NOT have mutated.
        assert!(matches!(core.mascot_state().pose, Pose::Idle));
    }

    #[test]
    fn propose_rule_from_nl_via_ffi_returns_summary() {
        let (_d, core) = mk_core();
        let id = Uuid::new_v4();
        let json_rule = serde_json::json!({
            "id": id.to_string(),
            "name": "FFI Rule",
            "trigger": {"Event": "TaskCompleted"},
            "conditions": [],
            "actions": [{"GrantCredit": {"amount": 3}}],
            "priority": 7,
            "cooldown": null,
            "duration": null,
            "explanation_template": "{rule_name}",
            "enabled": true
        })
        .to_string();
        let provider: Arc<dyn CoachingProvider> =
            Arc::new(focus_coaching::StubCoachingProvider::single(json_rule));
        core.set_coaching_provider_for_test(provider);
        let summary =
            core.propose_rule_from_nl("grant 3 credits on task complete".into()).expect("nl");
        assert_eq!(summary.name, "FFI Rule");
        assert_eq!(summary.priority, 7);
    }

    #[test]
    fn propose_rule_errors_when_no_provider() {
        let (_d, core) = mk_core();
        let err = core.propose_rule_from_nl("x".into()).unwrap_err();
        assert!(matches!(err, FfiError::InvalidArgument(_)));
    }

    #[test]
    fn connect_canvas_errors_without_env_client_id() {
        let (_d, core) = mk_core();
        // Ensure env vars are unset for deterministic failure. Safe: tests run
        // in a single process; this is a best-effort unset.
        std::env::remove_var("FOCALPOINT_CANVAS_CLIENT_ID");
        std::env::remove_var("FOCALPOINT_CANVAS_CLIENT_SECRET");
        let err = core
            .connector()
            .connect_canvas("canvas.example.com".into(), "the-code".into())
            .unwrap_err();
        match err {
            FfiError::Config(msg) => {
                assert!(msg.contains("canvas client id"), "got: {msg}");
            }
            other => panic!("expected Config error, got {other:?}"),
        }
    }

    #[test]
    fn connect_canvas_rejects_bogus_instance_url() {
        let (_d, core) = mk_core();
        let err =
            core.connector().connect_canvas("not-a-host".into(), "the-code".into()).unwrap_err();
        assert!(matches!(err, FfiError::InvalidArgument(_)));
    }

    #[test]
    fn connect_github_rejects_empty_pat() {
        let (_d, core) = mk_core();
        let err = core.connector().connect_github("   ".into()).unwrap_err();
        assert!(matches!(err, FfiError::InvalidArgument(_)));
        let err2 = core.connector().connect_github(String::new()).unwrap_err();
        assert!(matches!(err2, FfiError::InvalidArgument(_)));
    }

    // Traces to: FR-CONNECTOR-001 — host-backed calendar port parses ISO round-trip.
    #[test]
    fn host_backed_calendar_port_lists_and_parses_events() {
        use std::sync::Mutex as StdMutex;

        struct MockCalendarHost {
            calls: StdMutex<Vec<(String, String)>>,
        }

        impl CalendarHost for MockCalendarHost {
            fn list_events(&self, start_iso: String, end_iso: String) -> Vec<CalendarEventDto> {
                self.calls.lock().unwrap().push((start_iso.clone(), end_iso.clone()));
                vec![
                    CalendarEventDto {
                        id: "e-2".into(),
                        title: "Dentist".into(),
                        start_iso: "2026-05-01T10:30:00+00:00".into(),
                        end_iso: "2026-05-01T11:00:00+00:00".into(),
                        kind: CalendarEventKindDto::Hard,
                    },
                    CalendarEventDto {
                        id: "e-1".into(),
                        title: "Standup".into(),
                        start_iso: "2026-05-01T09:00:00+00:00".into(),
                        end_iso: "2026-05-01T09:30:00+00:00".into(),
                        kind: CalendarEventKindDto::Soft,
                    },
                ]
            }
        }

        let host = Arc::new(MockCalendarHost { calls: StdMutex::new(Vec::new()) });
        let port = HostBackedCalendarPort::new(host.clone());
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let start =
            DateTime::parse_from_rfc3339("2026-05-01T08:00:00+00:00").unwrap().with_timezone(&Utc);
        let end =
            DateTime::parse_from_rfc3339("2026-05-01T18:00:00+00:00").unwrap().with_timezone(&Utc);
        let events = runtime
            .block_on(async move { port.list_events(CoreDateRange::new(start, end)).await })
            .expect("list_events");
        assert_eq!(events.len(), 2);
        // Sorted by starts_at ascending.
        assert_eq!(events[0].title, "Standup");
        assert_eq!(events[0].rigidity, focus_domain::Rigidity::Soft);
        assert_eq!(events[1].title, "Dentist");
        assert_eq!(events[1].rigidity, focus_domain::Rigidity::Hard);
        // Host received correctly-formatted ISO strings covering the range.
        let calls = host.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(calls[0].0.starts_with("2026-05-01T08:00:00"));
        assert!(calls[0].1.starts_with("2026-05-01T18:00:00"));
    }

    #[test]
    fn set_calendar_host_swaps_port_atomically() {
        struct EmptyHost;
        impl CalendarHost for EmptyHost {
            fn list_events(&self, _s: String, _e: String) -> Vec<CalendarEventDto> {
                Vec::new()
            }
        }
        let (_d, core) = mk_core();
        // Should not panic; rebuilds rituals() with the new calendar.
        core.set_calendar_host(Box::new(EmptyHost));
        let _ = core.rituals();
    }

    #[test]
    fn sync_tick_with_no_connectors_is_noop() {
        let (_d, core) = mk_core();
        let sync = core.sync();
        let report = sync.tick();
        assert_eq!(report.connectors_synced, 0);
        assert_eq!(report.events_pulled, 0);
        assert!(report.errors.is_empty());
        assert!(sync.connectors().is_empty());
    }

    // ---- TaskApi -----------------------------------------------------------

    fn sample_input(title: &str) -> TaskInputDto {
        TaskInputDto {
            title: title.into(),
            duration_minutes: 45,
            priority_weight: 0.6,
            deadline_iso: None,
            deadline_rigidity: "soft".into(),
        }
    }

    #[test]
    fn task_add_list_remove_round_trip() {
        let (_d, core) = mk_core();
        let api = core.tasks();
        assert!(api.list().expect("list empty").is_empty());
        let id = api.add(sample_input("write PRD")).expect("add");
        let listed = api.list().expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, id);
        assert_eq!(listed[0].title, "write PRD");
        assert_eq!(listed[0].duration_minutes, 45);
        assert_eq!(listed[0].status, "planned");
        api.remove(id.clone()).expect("remove");
        assert!(api.list().expect("list after remove").is_empty());
        // Double-remove surfaces a not-found storage error.
        assert!(api.remove(id).is_err());
    }

    #[test]
    fn task_add_rejects_bad_inputs() {
        let (_d, core) = mk_core();
        let api = core.tasks();
        let mut bad = sample_input("");
        assert!(matches!(api.add(bad.clone()), Err(FfiError::InvalidArgument(_))));
        bad.title = "ok".into();
        bad.duration_minutes = 0;
        assert!(matches!(api.add(bad.clone()), Err(FfiError::InvalidArgument(_))));
        bad.duration_minutes = 25;
        bad.deadline_rigidity = "nope".into();
        assert!(matches!(api.add(bad.clone()), Err(FfiError::InvalidArgument(_))));
        bad.deadline_rigidity = "hard".into();
        bad.deadline_iso = Some("not-a-date".into());
        assert!(matches!(api.add(bad), Err(FfiError::InvalidArgument(_))));
    }

    #[test]
    fn task_add_persists_deadline_and_priority() {
        let (_d, core) = mk_core();
        let api = core.tasks();
        let iso = "2026-06-01T12:00:00Z";
        let input = TaskInputDto {
            title: "ship".into(),
            duration_minutes: 90,
            priority_weight: 1.5, // clamped to 1.0
            deadline_iso: Some(iso.into()),
            deadline_rigidity: "hard".into(),
        };
        let _id = api.add(input).expect("add");
        let listed = api.list().expect("list");
        assert_eq!(listed.len(), 1);
        let row = &listed[0];
        assert_eq!(row.deadline_rigidity, "hard");
        assert!(row.deadline_iso.is_some());
        assert!((row.priority_weight - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn task_mark_done_transitions_status() {
        let (_d, core) = mk_core();
        let api = core.tasks();
        let id = api.add(sample_input("draft spec")).expect("add");
        api.mark_done(id.clone()).expect("mark_done");
        let listed = api.list().expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].status, "done");
        // mark_done on unknown id surfaces a storage error.
        let unknown = Uuid::new_v4().to_string();
        assert!(api.mark_done(unknown).is_err());
    }

    // ---- TemplateApi -------------------------------------------------------

    #[test]
    fn templates_list_bundled_returns_all_starter_packs() {
        let (_d, core) = mk_core();
        let api = core.templates();
        let packs = api.list_bundled();
        assert!(packs.len() >= 4, "expected ≥4 bundled packs, got {}", packs.len());
        let ids: Vec<_> = packs.iter().map(|p| p.id.as_str()).collect();
        for expected in ["deep-work-starter", "student-canvas", "dev-flow", "sleep-hygiene"] {
            assert!(ids.contains(&expected), "missing bundled pack: {expected}");
        }
        // Summaries carry meaningful metadata.
        let deep = packs.iter().find(|p| p.id == "deep-work-starter").expect("deep-work");
        assert!(!deep.name.is_empty());
        assert!(deep.rule_count >= 1);
    }

    #[test]
    fn templates_install_unknown_id_errors() {
        let (_d, core) = mk_core();
        let err = core.templates().install("no-such-pack".into()).unwrap_err();
        match err {
            FfiError::InvalidArgument(msg) => assert!(msg.contains("no-such-pack")),
            o => panic!("unexpected error: {o:?}"),
        }
    }

    // ---- HostEventApi ------------------------------------------------------

    #[test]
    fn host_event_emit_happy_path_appends_and_audits() {
        let (_d, core) = mk_core();
        let api = core.host_events();
        api.emit(HostEventDto {
            event_type: "focus:session_started".into(),
            confidence: 1.0,
            payload_json: "{\"minutes\":25}".into(),
            dedupe_key: None,
        })
        .expect("emit");
        // Audit chain should carry the emitted record.
        let audit = core.audit();
        assert!(audit.verify_chain().expect("verify"));
        let recent = audit.recent(8).expect("recent");
        assert!(
            recent.iter().any(|r| r.record_type == "host.event.emitted"),
            "expected host.event.emitted audit record, got {:?}",
            recent.iter().map(|r| r.record_type.clone()).collect::<Vec<_>>()
        );
    }

    #[test]
    fn host_event_emit_rejects_empty_event_type() {
        let (_d, core) = mk_core();
        let err = core
            .host_events()
            .emit(HostEventDto {
                event_type: "   ".into(),
                confidence: 1.0,
                payload_json: "{}".into(),
                dedupe_key: None,
            })
            .unwrap_err();
        assert!(matches!(err, FfiError::InvalidArgument(_)));
    }

    #[test]
    fn host_event_emit_rejects_bad_confidence() {
        let (_d, core) = mk_core();
        let api = core.host_events();
        let err_neg = api
            .emit(HostEventDto {
                event_type: "focus:session_started".into(),
                confidence: -0.1,
                payload_json: "{}".into(),
                dedupe_key: None,
            })
            .unwrap_err();
        assert!(matches!(err_neg, FfiError::InvalidArgument(_)));
        let err_high = api
            .emit(HostEventDto {
                event_type: "focus:session_started".into(),
                confidence: 1.5,
                payload_json: "{}".into(),
                dedupe_key: None,
            })
            .unwrap_err();
        assert!(matches!(err_high, FfiError::InvalidArgument(_)));
    }

    #[test]
    fn host_event_emit_rejects_malformed_payload_json() {
        let (_d, core) = mk_core();
        let err = core
            .host_events()
            .emit(HostEventDto {
                event_type: "focus:session_started".into(),
                confidence: 1.0,
                payload_json: "{not json".into(),
                dedupe_key: None,
            })
            .unwrap_err();
        assert!(matches!(err, FfiError::InvalidArgument(_)));
    }

    #[test]
    fn templates_install_known_id_persists_rules() {
        let (_d, core) = mk_core();
        // Pre-condition: the target pack's rules are not yet enabled/persisted.
        let before = core.rules().list_enabled().expect("list before");
        let before_ids: std::collections::HashSet<String> =
            before.iter().map(|r| r.id.clone()).collect();

        let n = core.templates().install("deep-work-starter".into()).expect("install");
        assert!(n >= 1, "expected ≥1 rule installed, got {n}");

        let after = core.rules().list_enabled().expect("list after");
        // Exactly `n` new rule ids should be present after install.
        let new_ids: Vec<_> = after.iter().filter(|r| !before_ids.contains(&r.id)).collect();
        assert_eq!(new_ids.len() as u32, n, "install count must match persisted delta");

        // Idempotent: re-installing the same pack does not create duplicates.
        let n2 = core.templates().install("deep-work-starter".into()).expect("reinstall");
        assert_eq!(n2, n);
        let after2 = core.rules().list_enabled().expect("list after2");
        assert_eq!(after2.len(), after.len(), "reinstall must upsert, not duplicate");

        // Audit row recorded.
        let recent = core.audit().recent(8).expect("audit recent");
        assert!(
            recent.iter().any(|r| r.record_type == "template.installed"),
            "expected template.installed audit record"
        );
    }
}
