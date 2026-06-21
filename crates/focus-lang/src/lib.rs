// SPDX-License-Identifier: MIT OR Apache-2.0

//! FocalPoint Language (FPL) — Starlark→IR Compiler
//!
//! Compiles Starlark programs to FocalPoint Intermediate Representation (IR).
//! First slice: Rules primitive only.

pub mod bulk;
pub mod macros;

use focus_ir::{
    ActionIr, AuditQueryIr, Body, CoachingConfigIr, ConditionIr,
    ConnectorIr, Document, DocKind, EnforcementPolicyIr, EventFilterIr, MascotSceneIr,
    RitualIr, RuleIr, ScheduleIr, SoundCueIr, TaskIr, TriggerIr, WalletMutationIr,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Debug, thiserror::Error)]
pub enum CompileError {
    #[error("Starlark parse error at line {line}: {message}")]
    ParseError { line: usize, message: String },

    #[error("Starlark eval error: {0}")]
    EvalError(String),

    #[error("Type error: {0}")]
    TypeError(String),

    #[error("Invalid rule: {0}")]
    InvalidRule(String),

    #[error("JSON serialization: {0}")]
    JsonError(#[from] serde_json::Error),
}

/// Compile FPL source code to IR documents.
///
/// # Example
/// ```text
/// rule(
///     id="test-rule",
///     name="Test Rule",
///     trigger=on_event("focus:session_started"),
///     conditions=[],
///     actions=[block(profile="social", duration_seconds=1800, rigidity="hard")],
///     enabled=1
/// )
/// ```
pub fn compile_fpl(source: &str) -> Result<Vec<Document>, CompileError> {
    // Prepend helper function definitions to the source.
    // Includes both base helpers and high-level macro library.
    let full_source = format!("{}\n{}\n{}", STARLARK_HELPERS, macros::MACRO_LIBRARY, source);

    // Use starlark::eval directly to evaluate.
    use starlark::environment::{Globals, Module};
    use starlark::eval::Evaluator;
    use starlark::syntax::AstModule;

    let globals = Globals::new();

    // Parse the module.
    let ast = AstModule::parse(
        "fpl",
        full_source,
        &starlark::syntax::Dialect::Standard,
    ).map_err(|e| {
        let msg = format!("{:?}", e);
        let line = extract_line_number(&msg).unwrap_or(1);
        CompileError::ParseError {
            line,
            message: msg,
        }
    })?;

    Module::with_temp_heap(|module| {
        // Evaluate.
        let mut evaluator = Evaluator::new(&module);
        let _result = evaluator.eval_module(ast, &globals)
            .map_err(|e| CompileError::EvalError(format!("{:?}", e)))?;

        // Collect all primitives from thread-local registries.
        let rules = RULE_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let tasks = TASK_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let schedules = SCHEDULE_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let connectors = CONNECTOR_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let mascot_scenes = MASCOT_SCENE_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let coachings = COACHING_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let enforcements = ENFORCEMENT_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let wallet_ops = WALLET_OP_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let rituals = RITUAL_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let sound_cues = SOUND_CUE_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());
        let audit_queries = AUDIT_QUERY_REGISTRY.with(|r| r.borrow_mut().drain(..).collect::<Vec<_>>());

        let mut docs = Vec::new();

        for rule_data in rules {
            let doc = build_rule_document(&rule_data)?;
            docs.push(doc);
        }

        for task_data in tasks {
            let doc = build_task_document(&task_data)?;
            docs.push(doc);
        }

        for schedule_data in schedules {
            let doc = build_schedule_document(&schedule_data)?;
            docs.push(doc);
        }

        for connector_data in connectors {
            let doc = build_connector_document(&connector_data)?;
            docs.push(doc);
        }

        for mascot_data in mascot_scenes {
            let doc = build_mascot_scene_document(&mascot_data)?;
            docs.push(doc);
        }

        for coaching_data in coachings {
            let doc = build_coaching_document(&coaching_data)?;
            docs.push(doc);
        }

        for enforcement_data in enforcements {
            let doc = build_enforcement_document(&enforcement_data)?;
            docs.push(doc);
        }

        for wallet_data in wallet_ops {
            let doc = build_wallet_op_document(&wallet_data)?;
            docs.push(doc);
        }

        for ritual_data in rituals {
            let doc = build_ritual_document(&ritual_data)?;
            docs.push(doc);
        }

        for sound_data in sound_cues {
            let doc = build_sound_cue_document(&sound_data)?;
            docs.push(doc);
        }

        for query_data in audit_queries {
            let doc = build_audit_query_document(&query_data)?;
            docs.push(doc);
        }

        Ok(docs)
    })
}

// Thread-local registries for collecting all primitives during Starlark evaluation.
thread_local! {
    static RULE_REGISTRY: std::cell::RefCell<Vec<RuleData>> = const { std::cell::RefCell::new(Vec::new()) };
    static TASK_REGISTRY: std::cell::RefCell<Vec<TaskData>> = const { std::cell::RefCell::new(Vec::new()) };
    static SCHEDULE_REGISTRY: std::cell::RefCell<Vec<ScheduleData>> = const { std::cell::RefCell::new(Vec::new()) };
    static CONNECTOR_REGISTRY: std::cell::RefCell<Vec<ConnectorData>> = const { std::cell::RefCell::new(Vec::new()) };
    static MASCOT_SCENE_REGISTRY: std::cell::RefCell<Vec<MascotSceneData>> = const { std::cell::RefCell::new(Vec::new()) };
    static COACHING_REGISTRY: std::cell::RefCell<Vec<CoachingData>> = const { std::cell::RefCell::new(Vec::new()) };
    static ENFORCEMENT_REGISTRY: std::cell::RefCell<Vec<EnforcementData>> = const { std::cell::RefCell::new(Vec::new()) };
    static WALLET_OP_REGISTRY: std::cell::RefCell<Vec<WalletOpData>> = const { std::cell::RefCell::new(Vec::new()) };
    static RITUAL_REGISTRY: std::cell::RefCell<Vec<RitualData>> = const { std::cell::RefCell::new(Vec::new()) };
    static SOUND_CUE_REGISTRY: std::cell::RefCell<Vec<SoundCueData>> = const { std::cell::RefCell::new(Vec::new()) };
    static AUDIT_QUERY_REGISTRY: std::cell::RefCell<Vec<AuditQueryData>> = const { std::cell::RefCell::new(Vec::new()) };
}

#[doc(hidden)]
pub fn register_rule(data: RuleData) {
    RULE_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_task(data: TaskData) {
    TASK_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_schedule(data: ScheduleData) {
    SCHEDULE_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_connector(data: ConnectorData) {
    CONNECTOR_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_mascot_scene(data: MascotSceneData) {
    MASCOT_SCENE_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_coaching(data: CoachingData) {
    COACHING_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_enforcement(data: EnforcementData) {
    ENFORCEMENT_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_wallet_op(data: WalletOpData) {
    WALLET_OP_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_ritual(data: RitualData) {
    RITUAL_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_sound_cue(data: SoundCueData) {
    SOUND_CUE_REGISTRY.with(|r| r.borrow_mut().push(data));
}

#[doc(hidden)]
pub fn register_audit_query(data: AuditQueryData) {
    AUDIT_QUERY_REGISTRY.with(|r| r.borrow_mut().push(data));
}

/// Task intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct TaskData {
    pub id: String,
    pub title: String,
    pub minutes: i64,
    pub priority: f32,
    pub deadline: Option<String>,
    pub rigidity: String,
    pub constraints: Vec<Value>,
    pub chunking: String, // "allow" or "deny"
}

/// Schedule intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct ScheduleData {
    pub id: String,
    pub cron: String,
    pub description: String,
    pub attached_rule_ids: Vec<String>,
}

/// Connector intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct ConnectorData {
    pub id: String,
    pub tier: String,
    pub auth: String,
    pub sync: String,
    pub cadence_seconds: i64,
    pub scopes: Vec<String>,
    pub event_types: Vec<String>,
}

/// Mascot scene intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct MascotSceneData {
    pub id: String,
    pub pose: String,
    pub emotion: String,
    pub accessory: Option<String>,
    pub bubble: Option<String>,
    pub sound: Option<String>,
    pub haptic: Option<String>,
    pub entry: Option<String>,
    pub hold_ms: Option<i64>,
    pub exit: Option<String>,
}

/// Coaching config intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct CoachingData {
    pub id: String,
    pub endpoint: String,
    pub model: String,
    pub rate_limit_per_min: i64,
}

/// Enforcement policy intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct EnforcementData {
    pub id: String,
    pub profile: String,
    pub targets: Vec<String>,
    pub rigidity: String,
}

/// Wallet operation intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct WalletOpData {
    pub id: String,
    pub kind: String,
    pub amount: i64,
    pub purpose: String,
}

/// Ritual intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct RitualData {
    pub id: String,
    pub name: String,
    pub ritual_type: String, // "morning_brief", "evening_shutdown"
    pub steps: Vec<Value>,
}

/// Sound cue intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct SoundCueData {
    pub id: String,
    pub name: String,
    pub source_url: String,
    pub loop_enabled: bool,
    pub gain_db: f32,
}

/// Audit query intermediate data (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct AuditQueryData {
    pub id: String,
    pub record_type: String,
    pub since_hours: i64,
}

/// Intermediate data for a rule (extracted from Starlark).
#[derive(Debug, Clone)]
pub struct RuleData {
    pub id: String,
    pub name: String,
    pub trigger: TriggerData,
    pub conditions: Vec<ConditionData>,
    pub actions: Vec<ActionData>,
    pub priority: i32,
    pub cooldown_seconds: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub explanation_template: String,
    pub enabled: bool,
}

#[derive(Debug, Clone)]
pub enum TriggerData {
    Event(String),
    Schedule(String, String), // cron, timezone
    StateChange(String),
}

#[derive(Debug, Clone)]
pub enum ConditionData {
    ConfidenceGte(f64),
    PayloadEq(String, Value),
    PayloadIn(String, Vec<Value>),
    PayloadGte(String, Value),
    PayloadLte(String, Value),
    PayloadExists(String),
    PayloadMatches(String, String), // path, regex
    SourceEq(String),
    OccurredWithin(i64), // seconds
    AllOf(Vec<Box<ConditionData>>),
    AnyOf(Vec<Box<ConditionData>>),
    Not(Box<ConditionData>),
}

#[derive(Debug, Clone)]
pub enum ActionData {
    GrantCredit(i64),
    DeductCredit(i64),
    Block {
        profile: String,
        duration_seconds: i64,
        rigidity: String,
    },
    Unblock(String),
    StreakIncrement(String),
    StreakReset(String),
    Notify(String),
}

/// Build an IR Document from collected rule data.
fn build_rule_document(data: &RuleData) -> Result<Document, CompileError> {
    let trigger_ir = build_trigger_ir(&data.trigger)?;
    let conditions_ir = data.conditions.iter()
        .map(build_condition_ir)
        .collect::<Result<Vec<_>, _>>()?;
    let actions_ir = data.actions.iter()
        .map(build_action_ir)
        .collect::<Result<Vec<_>, _>>()?;

    let rule_ir = RuleIr {
        id: data.id.clone(),
        name: data.name.clone(),
        trigger: trigger_ir,
        conditions: conditions_ir,
        actions: actions_ir,
        priority: data.priority,
        cooldown_seconds: data.cooldown_seconds,
        duration_seconds: data.duration_seconds,
        explanation_template: data.explanation_template.clone(),
        enabled: data.enabled,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Rule,
        id: data.id.clone(),
        name: data.name.clone(),
        body: Body::Rule(Box::new(rule_ir)),
    })
}

fn build_trigger_ir(trigger: &TriggerData) -> Result<TriggerIr, CompileError> {
    match trigger {
        TriggerData::Event(name) => {
            Ok(TriggerIr::EventFired {
                event_name: name.clone(),
            })
        }
        TriggerData::Schedule(cron, tz) => {
            Ok(TriggerIr::ScheduleCron {
                cron_expression: cron.clone(),
                timezone: tz.clone(),
            })
        }
        TriggerData::StateChange(path) => {
            Ok(TriggerIr::UserAction {
                action_type: "state_change".to_string(),
                target: path.clone(),
            })
        }
    }
}

fn build_condition_ir(cond: &ConditionData) -> Result<ConditionIr, CompileError> {
    match cond {
        ConditionData::ConfidenceGte(threshold) => {
            Ok(ConditionIr::CustomPredicate {
                name: "confidence_gte".to_string(),
                args: json!({"threshold": threshold}),
            })
        }
        ConditionData::PayloadEq(path, value) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_eq".to_string(),
                args: json!({"path": path, "value": value}),
            })
        }
        ConditionData::PayloadIn(path, values) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_in".to_string(),
                args: json!({"path": path, "values": values}),
            })
        }
        ConditionData::PayloadGte(path, value) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_gte".to_string(),
                args: json!({"path": path, "value": value}),
            })
        }
        ConditionData::PayloadLte(path, value) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_lte".to_string(),
                args: json!({"path": path, "value": value}),
            })
        }
        ConditionData::PayloadExists(path) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_exists".to_string(),
                args: json!({"path": path}),
            })
        }
        ConditionData::PayloadMatches(path, regex) => {
            Ok(ConditionIr::CustomPredicate {
                name: "payload_matches".to_string(),
                args: json!({"path": path, "regex": regex}),
            })
        }
        ConditionData::SourceEq(source) => {
            Ok(ConditionIr::CustomPredicate {
                name: "source_eq".to_string(),
                args: json!({"source": source}),
            })
        }
        ConditionData::OccurredWithin(seconds) => {
            Ok(ConditionIr::CustomPredicate {
                name: "occurred_within".to_string(),
                args: json!({"seconds": seconds}),
            })
        }
        ConditionData::AllOf(conds) => {
            let inner = conds.iter()
                .map(|c| build_condition_ir(c))
                .collect::<Result<Vec<_>, _>>()?;
            Ok(ConditionIr::And { conditions: inner })
        }
        ConditionData::AnyOf(conds) => {
            let inner = conds.iter()
                .map(|c| build_condition_ir(c))
                .collect::<Result<Vec<_>, _>>()?;
            Ok(ConditionIr::Or { conditions: inner })
        }
        ConditionData::Not(cond) => {
            let inner = build_condition_ir(cond)?;
            Ok(ConditionIr::Not {
                condition: Box::new(inner),
            })
        }
    }
}

fn build_action_ir(action: &ActionData) -> Result<ActionIr, CompileError> {
    match action {
        ActionData::GrantCredit(amount) => {
            Ok(ActionIr::ApplyMutation {
                mutation_id: "grant_credit".to_string(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("amount".to_string(), Value::Number((*amount).into()));
                    m
                },
            })
        }
        ActionData::DeductCredit(amount) => {
            Ok(ActionIr::ApplyMutation {
                mutation_id: "deduct_credit".to_string(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("amount".to_string(), Value::Number((*amount).into()));
                    m
                },
            })
        }
        ActionData::Block {
            profile,
            duration_seconds,
            rigidity,
        } => {
            Ok(ActionIr::EnforcePolicy {
                policy_id: format!("block-{}", profile),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".to_string(), Value::String(profile.clone()));
                    m.insert("duration_seconds".to_string(), Value::Number((*duration_seconds).into()));
                    m.insert("rigidity".to_string(), Value::String(rigidity.clone()));
                    m
                },
            })
        }
        ActionData::Unblock(profile) => {
            Ok(ActionIr::EnforcePolicy {
                policy_id: format!("unblock-{}", profile),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".to_string(), Value::String(profile.clone()));
                    m
                },
            })
        }
        ActionData::StreakIncrement(streak_id) => {
            Ok(ActionIr::ApplyMutation {
                mutation_id: "streak_increment".to_string(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("streak_id".to_string(), Value::String(streak_id.clone()));
                    m
                },
            })
        }
        ActionData::StreakReset(streak_id) => {
            Ok(ActionIr::ApplyMutation {
                mutation_id: "streak_reset".to_string(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("streak_id".to_string(), Value::String(streak_id.clone()));
                    m
                },
            })
        }
        ActionData::Notify(msg) => {
            Ok(ActionIr::ShowNotification {
                notification_id: "notify".to_string(),
                text: msg.clone(),
                duration_ms: None,
            })
        }
    }
}

fn extract_line_number(msg: &str) -> Option<usize> {
    msg.split(':')
        .nth(1)
        .and_then(|s| s.trim().parse::<usize>().ok())
}

/// Build an IR Document from task data.
fn build_task_document(data: &TaskData) -> Result<Document, CompileError> {
    let chunking_policy = focus_ir::ChunkingPolicyIr {
        allow_split: data.chunking == "allow",
        min_chunk_minutes: 15,
        max_chunk_minutes: 90,
        ideal_chunk_minutes: 45,
    };

    let deadline = data.deadline.as_ref().map(|deadline_str| focus_ir::DeadlineIr {
        when_iso8601: Some(deadline_str.clone()),
        rigidity: data.rigidity.clone(),
    });

    let task_ir = TaskIr {
        id: data.id.clone(),
        user_id: "current_user".to_string(),
        title: data.title.clone(),
        duration_spec: focus_ir::DurationSpecIr {
            fixed_minutes: Some(data.minutes),
            estimate: None,
        },
        priority_weight: data.priority,
        deadline,
        chunking: chunking_policy,
        constraints: data.constraints.iter()
            .filter_map(|_v| {
                // Parse constraint from JSON Value as passthrough for now
                // TODO: structured constraint parsing once focus-ir is finalized
                None
            })
            .collect(),
        status: focus_ir::TaskStatusIr::Pending,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Task,
        id: data.id.clone(),
        name: data.title.clone(),
        body: Body::Task(task_ir),
    })
}

/// Build an IR Document from schedule data.
fn build_schedule_document(data: &ScheduleData) -> Result<Document, CompileError> {
    let schedule_ir = ScheduleIr {
        id: data.id.clone(),
        cron_spec: data.cron.clone(),
        enabled: true,
        description: data.description.clone(),
        attached_rule_ids: data.attached_rule_ids.clone(),
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Schedule,
        id: data.id.clone(),
        name: data.description.clone(),
        body: Body::Schedule(schedule_ir),
    })
}

/// Build an IR Document from connector data.
fn build_connector_document(data: &ConnectorData) -> Result<Document, CompileError> {
    let auth_strategy = match data.auth.as_str() {
        "oauth2" => focus_ir::AuthStrategyIr::OAuth2 {
            scopes: data.scopes.clone(),
        },
        "api_key" => focus_ir::AuthStrategyIr::ApiKey,
        _ => focus_ir::AuthStrategyIr::None,
    };

    let sync_mode = match data.sync.as_str() {
        "polling" => focus_ir::SyncModeIr::Polling {
            cadence_seconds: data.cadence_seconds as u64,
        },
        "webhook" => focus_ir::SyncModeIr::Webhook,
        _ => focus_ir::SyncModeIr::Polling {
            cadence_seconds: 300,
        },
    };

    let connector_ir = ConnectorIr {
        id: data.id.clone(),
        version: "0.1.0".to_string(),
        display_name: format!("Connector: {}", data.id),
        auth_strategy,
        sync_mode,
        capabilities: vec![],
        entity_types: vec![],
        event_types: data.event_types.clone(),
        tier: data.tier.clone(),
        health_indicators: vec![],
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Connector,
        id: data.id.clone(),
        name: format!("Connector: {}", data.id),
        body: Body::Connector(connector_ir),
    })
}

/// Build an IR Document from mascot scene data.
fn build_mascot_scene_document(data: &MascotSceneData) -> Result<Document, CompileError> {
    let entry_animation = data.entry.as_ref().map(|entry_name| focus_ir::AnimationIr {
        type_: entry_name.clone(),
        duration_ms: 300,
        easing: Some("ease-out".to_string()),
    });

    let exit_animation = data.exit.as_ref().map(|exit_name| focus_ir::AnimationIr {
        type_: exit_name.clone(),
        duration_ms: 300,
        easing: Some("ease-in".to_string()),
    });

    let speech_bubble = data.bubble.as_ref().map(|text| focus_ir::SpeechBubbleIr {
        text: text.clone(),
        text_alignment: Some("center".to_string()),
        background_style: Some("rounded".to_string()),
    });

    let scene_ir = MascotSceneIr {
        id: data.id.clone(),
        name: format!("Scene: {}", data.pose),
        character: "default".to_string(),
        pose: data.pose.clone(),
        emotion: data.emotion.clone(),
        accessory: data.accessory.clone(),
        speech_bubble,
        voice_cue: None,
        sound_cue: data.sound.clone(),
        haptic_cue: data.haptic.clone(),
        entry_animation,
        hold_duration_ms: data.hold_ms.map(|ms| ms as u64),
        exit_animation,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::MascotScene,
        id: data.id.clone(),
        name: format!("Scene: {}", data.pose),
        body: Body::MascotScene(scene_ir),
    })
}

/// Build an IR Document from coaching data.
fn build_coaching_document(data: &CoachingData) -> Result<Document, CompileError> {
    let coaching_ir = CoachingConfigIr {
        id: data.id.clone(),
        name: "Coaching Config".to_string(),
        tone: "encouraging".to_string(),
        language: "en".to_string(),
        voice_profile: None,
        text_templates: {
            let mut m = BTreeMap::new();
            m.insert("default".to_string(), "Keep up the good work!".to_string());
            m
        },
        notification_style: Some("in-app".to_string()),
    };

    Ok(Document {
        version: 1,
        kind: DocKind::CoachingConfig,
        id: data.id.clone(),
        name: "Coaching Config".to_string(),
        body: Body::CoachingConfig(coaching_ir),
    })
}

/// Build an IR Document from enforcement data.
fn build_enforcement_document(data: &EnforcementData) -> Result<Document, CompileError> {
    let enforcement_ir = EnforcementPolicyIr {
        id: data.id.clone(),
        name: format!("Enforce: {}", data.profile),
        description: Some(format!("Enforcement policy for {}", data.profile)),
        targets: data.targets.clone(),
        threshold: None,
        action_on_violation: ActionIr::EnforcePolicy {
            policy_id: data.profile.clone(),
            params: BTreeMap::new(),
        },
        grace_period_ms: None,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::EnforcementPolicy,
        id: data.id.clone(),
        name: format!("Enforce: {}", data.profile),
        body: Body::EnforcementPolicy(enforcement_ir),
    })
}

/// Build an IR Document from wallet operation data.
fn build_wallet_op_document(data: &WalletOpData) -> Result<Document, CompileError> {
    let mutation_op = match data.kind.as_str() {
        "grant" => focus_ir::MutationOpIr::Add,
        "deduct" => focus_ir::MutationOpIr::Subtract,
        _ => focus_ir::MutationOpIr::Add,
    };

    let wallet_ir = WalletMutationIr {
        id: data.id.clone(),
        name: format!("Wallet: {}", data.kind),
        wallet_type: "points".to_string(),
        operation: mutation_op,
        amount: data.amount,
        reason: data.purpose.clone(),
        conditional: None,
    };

    Ok(Document {
        version: 1,
        kind: DocKind::WalletMutation,
        id: data.id.clone(),
        name: format!("Wallet: {}", data.kind),
        body: Body::WalletMutation(wallet_ir),
    })
}

/// Build an IR Document from ritual data.
fn build_ritual_document(data: &RitualData) -> Result<Document, CompileError> {
    let ritual_ir = RitualIr {
        id: data.id.clone(),
        name: data.name.clone(),
        description: Some(format!("{} ritual", data.ritual_type)),
        steps: vec![],
        daily_goal: Some(1),
        tracking: focus_ir::RitualTrackingIr {
            enabled: true,
            track_completion: true,
            track_duration: true,
            track_quality: true,
        },
        rewards: vec![],
    };

    Ok(Document {
        version: 1,
        kind: DocKind::Ritual,
        id: data.id.clone(),
        name: data.name.clone(),
        body: Body::Ritual(ritual_ir),
    })
}

/// Build an IR Document from sound cue data.
fn build_sound_cue_document(data: &SoundCueData) -> Result<Document, CompileError> {
    let sound_ir = SoundCueIr {
        id: data.id.clone(),
        name: data.name.clone(),
        asset_url: data.source_url.clone(),
        asset_hash: "TODO:compute_hash".to_string(),
        duration_ms: 3000,
        volume_level: 10_f32.powf(data.gain_db / 20.0).min(1.0),
        tags: vec!["audio".to_string()],
        usage: "notification".to_string(),
    };

    Ok(Document {
        version: 1,
        kind: DocKind::SoundCue,
        id: data.id.clone(),
        name: data.name.clone(),
        body: Body::SoundCue(sound_ir),
    })
}

/// Build an IR Document from audit query data.
fn build_audit_query_document(data: &AuditQueryData) -> Result<Document, CompileError> {
    let query_ir = AuditQueryIr {
        id: data.id.clone(),
        name: format!("Query: {}", data.record_type),
        description: Some(format!("Audit query for {}", data.record_type)),
        event_filter: EventFilterIr {
            event_types: vec![data.record_type.clone()],
            conditions: vec![],
        },
        projections: vec![],
        aggregations: vec![],
        time_range: Some(focus_ir::TimeRangeIr {
            start: format!("-{}h", data.since_hours),
            end: None,
        }),
    };

    Ok(Document {
        version: 1,
        kind: DocKind::AuditQuery,
        id: data.id.clone(),
        name: format!("Query: {}", data.record_type),
        body: Body::AuditQuery(query_ir),
    })
}

const STARLARK_HELPERS: &str = r#"
# FPL Helper Functions — Triggers
def on_event(name):
    return {"kind": "event", "value": name}

def on_schedule(cron, timezone="UTC"):
    return {"kind": "schedule", "cron": cron, "tz": timezone}

def on_state_change(path):
    return {"kind": "state_change", "value": path}

# FPL Helper Functions — Conditions
def confidence_gte(threshold):
    return {"op": "confidence_gte", "threshold": threshold}

def payload_eq(path, value):
    return {"op": "payload_eq", "path": path, "value": value}

def payload_in(path, values):
    return {"op": "payload_in", "path": path, "values": values}

def payload_gte(path, value):
    return {"op": "payload_gte", "path": path, "value": value}

def payload_lte(path, value):
    return {"op": "payload_lte", "path": path, "value": value}

def payload_exists(path):
    return {"op": "payload_exists", "path": path}

def payload_matches(path, regex):
    return {"op": "payload_matches", "path": path, "regex": regex}

def source_eq(source):
    return {"op": "source_eq", "source": source}

def occurred_within(seconds):
    return {"op": "occurred_within", "seconds": seconds}

def all_of(conditions):
    return {"op": "all_of", "conditions": conditions}

def any_of(conditions):
    return {"op": "any_of", "conditions": conditions}

def not_(condition):
    return {"op": "not", "condition": condition}

# FPL Helper Functions — Rule Actions
def grant_credit(amount):
    return {"type": "grant_credit", "amount": amount}

def deduct_credit(amount):
    return {"type": "deduct_credit", "amount": amount}

def block(profile, duration_seconds, rigidity="hard"):
    return {"type": "block", "profile": profile, "duration_seconds": duration_seconds, "rigidity": rigidity}

def unblock(profile):
    return {"type": "unblock", "profile": profile}

def streak_increment(streak_id):
    return {"type": "streak_increment", "streak_id": streak_id}

def streak_reset(streak_id):
    return {"type": "streak_reset", "streak_id": streak_id}

def notify(message):
    return {"type": "notify", "message": message}

# FPL builtin: rule()
def rule(id, name, trigger, **kwargs):
    conditions = kwargs.get("conditions", [])
    actions = kwargs.get("actions", [])
    priority = kwargs.get("priority", 0)
    cooldown_seconds = kwargs.get("cooldown_seconds", 0)
    duration_seconds = kwargs.get("duration_seconds", 0)
    explanation_template = kwargs.get("explanation_template", "")
    enabled = kwargs.get("enabled", 1)

    opts = {}
    if cooldown_seconds > 0:
        opts["cooldown_seconds"] = cooldown_seconds
    if duration_seconds > 0:
        opts["duration_seconds"] = duration_seconds

    rule_dict = {
        "id": id,
        "name": name,
        "trigger": trigger,
        "conditions": conditions,
        "actions": actions,
        "priority": priority,
        "explanation_template": explanation_template,
        "enabled": enabled,
    }
    rule_dict.update(opts)
    return rule_dict

# FPL builtin: task()
def task(title="", minutes=30, priority=0.5, deadline="", rigidity="soft", constraints=[], chunking="allow"):
    task_id = (title.replace(" ", "_").lower() if title else "task")
    return {
        "id": task_id,
        "title": title,
        "minutes": minutes,
        "priority": priority,
        "deadline": deadline,
        "rigidity": rigidity,
        "constraints": constraints,
        "chunking": chunking,
    }

# FPL builtin: schedule()
def schedule(cron="", description="", attaches=[]):
    return {
        "id": "schedule_" + cron.replace(" ", "_"),
        "cron": cron,
        "description": description,
        "attached_rule_ids": attaches,
    }

# FPL builtin: connector()
def connector(id="", tier="official", auth="oauth2", sync="polling", cadence_seconds=300, scopes=[], event_types=[]):
    return {
        "id": id,
        "tier": tier,
        "auth": auth,
        "sync": sync,
        "cadence_seconds": cadence_seconds,
        "scopes": scopes,
        "event_types": event_types,
    }

# FPL builtin: pose()
def pose(name, emotion="neutral"):
    return {"pose": name, "emotion": emotion}

# FPL builtin: scene()
def scene(pose="neutral", emotion="neutral", accessory="", bubble="", sound="", haptic="", entry="", hold_ms=0, exit=""):
    return {
        "id": "scene_" + pose,
        "pose": pose,
        "emotion": emotion,
        "accessory": accessory,
        "bubble": bubble,
        "sound": sound,
        "haptic": haptic,
        "entry": entry,
        "hold_ms": hold_ms,
        "exit": exit,
    }

# FPL builtin: coaching()
def coaching(endpoint="", model="gpt-4", rate_limit_per_min=10):
    return {
        "id": "coaching_" + model.replace("-", "_"),
        "endpoint": endpoint,
        "model": model,
        "rate_limit_per_min": rate_limit_per_min,
    }

# FPL builtin: enforcement()
def enforcement(profile="social", targets=[], rigidity="hard"):
    return {
        "id": "enforce_" + profile,
        "profile": profile,
        "targets": targets,
        "rigidity": rigidity,
    }

# FPL builtin: wallet_op()
def wallet_op(kind="grant", amount=0, purpose=""):
    amount_str = "%d" % amount
    return {
        "id": "wallet_" + kind + "_" + amount_str,
        "kind": kind,
        "amount": amount,
        "purpose": purpose,
    }

# FPL builtin: ritual()
def ritual(ritual_type="morning_brief", name="", steps=[]):
    return {
        "id": "ritual_" + ritual_type,
        "name": name,
        "ritual_type": ritual_type,
        "steps": steps,
    }

# FPL builtin: morning_brief()
def morning_brief(name="Morning Brief", steps=[]):
    return ritual("morning_brief", name, steps)

# FPL builtin: evening_shutdown()
def evening_shutdown(name="Evening Shutdown", steps=[]):
    return ritual("evening_shutdown", name, steps)

# FPL builtin: sound_cue()
def sound_cue(name="", source_url="", loop=0, gain_db=0.0):
    return {
        "id": "sound_" + name.replace(" ", "_").lower(),
        "name": name,
        "source_url": source_url,
        "loop_enabled": loop,
        "gain_db": gain_db,
    }

# FPL builtin: audit_query()
def audit_query(record_type="", since_hours=24):
    return {
        "id": "query_" + record_type.replace(":", "_"),
        "record_type": record_type,
        "since_hours": since_hours,
    }
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_rule_syntax() {
        let source = r#"
rule(
    id="test-rule",
    name="Test Rule",
    trigger=on_event("test:event"),
    conditions=[],
    actions=[grant_credit(25)],
    priority=50,
    enabled=1
)
"#;
        let result = compile_fpl(source);
        // For now, just check it parses without panic.
        let _ = result;
    }

    #[test]
    fn test_multiple_rules() {
        let source = r#"
rule(id="r1", name="Rule 1", trigger=on_event("e1"), conditions=[], actions=[], enabled=True)
rule(id="r2", name="Rule 2", trigger=on_event("e2"), conditions=[], actions=[], enabled=True)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_block_action() {
        let source = r#"
rule(
    id="block-rule",
    name="Block Rule",
    trigger=on_event("focus:session_started"),
    conditions=[],
    actions=[block(profile="social", duration_seconds=1800, rigidity="hard")],
    enabled=1
)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_loop_construction() {
        let source = r#"
for profile in ["social", "games"]:
    rule(
        id="block-" + profile,
        name="Block " + profile,
        trigger=on_event("focus:started"),
        conditions=[],
        actions=[block(profile=profile, duration_seconds=1800, rigidity="hard")],
        enabled=1
    )
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_conditions() {
        let source = r#"
rule(
    id="cond-rule",
    name="Condition Rule",
    trigger=on_event("test"),
    conditions=[confidence_gte(0.8), payload_exists("x")],
    actions=[notify("test")],
    enabled=1
)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_composite_conditions() {
        let source = r#"
rule(
    id="composite",
    name="Composite",
    trigger=on_event("test"),
    conditions=[all_of([confidence_gte(0.8), payload_exists("x")])],
    actions=[notify("msg")],
    enabled=1
)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_schedule_trigger() {
        let source = r#"
rule(
    id="sched",
    name="Scheduled",
    trigger=on_schedule("0 9 * * 1-5"),
    conditions=[],
    actions=[notify("morning")],
    enabled=1
)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_default_values() {
        let source = r#"
rule(
    id="defaults",
    name="Defaults",
    trigger=on_event("test"),
    enabled=1
)
"#;
        let result = compile_fpl(source);
        let _ = result;
    }

    #[test]
    fn test_syntax_error() {
        let source = "rule(invalid syntax";
        let result = compile_fpl(source);
        assert!(result.is_err());
    }

    #[test]
    fn test_golden_deep_work_starter_parses() {
        // Read the example FPL file
        let fpl_source = include_str!("../../../examples/fpl/deep-work-starter.fpl");
        let result = compile_fpl(fpl_source);
        // Primary goal: ensure parsing succeeds without error
        // Note: rule collection via Starlark kwargs requires custom native function hooks
        // For first slice, we validate syntax/semantics only.
        assert!(
            result.is_ok(),
            "deep-work-starter.fpl should parse without syntax errors; got: {:?}",
            result.err()
        );

        let _docs = result.unwrap();
        // Golden test will be completed once rule collection is wired up

    }

    #[test]
    fn test_task_helper_syntax() {
        let source = r#"
# Task helpers are syntactic only (no collection yet)
t1 = task(title="Ship feature", minutes=120, priority=0.8)
t2 = task(title="Review PR", minutes=45, deadline="2026-05-15", rigidity="soft")
"#;
        let result = compile_fpl(source);
        // Should parse without error (even though tasks aren't collected yet)
        assert!(result.is_ok(), "Task helper should parse: {:?}", result.err());
    }

    #[test]
    fn test_schedule_helper_syntax() {
        let source = r#"
# Schedule helpers are syntactic only (no collection yet)
s1 = schedule(cron="0 9 * * 1-5", description="Weekday standup", attaches=[])
s2 = schedule(cron="*/15 * * * *", description="Frequent check-in", attaches=["rule-1", "rule-2"])
"#;
        let result = compile_fpl(source);
        // Should parse without error (even though schedules aren't collected yet)
        assert!(result.is_ok(), "Schedule helper should parse: {:?}", result.err());
    }

    #[test]
    fn test_example_with_task_and_schedule() {
        let source = r#"
# Example plan with task + schedule + rule
task(title="Write quarterly review", minutes=180, priority=0.9, deadline="2026-06-01", rigidity="hard")
schedule(cron="0 9 * * 1", description="Monday morning prep", attaches=["prep-rule"])

rule(
    id="prep-rule",
    name="Prepare week",
    trigger=on_schedule("0 9 * * 1"),
    conditions=[],
    actions=[notify("Time to prepare for the week")],
    enabled=1
)
"#;
        let result = compile_fpl(source);
        // Should parse without error
        assert!(result.is_ok(), "Mixed example should parse: {:?}", result.err());
    }
}
