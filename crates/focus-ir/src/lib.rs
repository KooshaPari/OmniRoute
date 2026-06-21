// SPDX-License-Identifier: MIT OR Apache-2.0

//! FocalPoint Intermediate Representation (IR).
//!
//! Single canonical JSON format for all FocalPoint documents: Rule, Connector,
//! Template, Task, Schedule, Pose, CoachingConfig, EnforcementPolicy, WalletMutation,
//! Ritual, SoundCue, AuditQuery.
//!
//! Content-addressed via SHA-256 hash of canonical JSON (sorted keys, no whitespace).
//! Supports versioning and deterministic serialization.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub mod codegen;

// ============================================================================
// Document Wrapper (Top-Level)
// ============================================================================

/// Top-level IR document for any FocalPoint primitive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    /// Schema version: fixed to 1 for first slice.
    pub version: u32,

    /// Document kind/variant.
    pub kind: DocKind,

    /// Stable, unique identifier.
    pub id: String,

    /// Human-readable name.
    pub name: String,

    /// Body content (variant-specific).
    pub body: Body,
}

/// Document kind enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum DocKind {
    Rule,
    Connector,
    Template,
    Task,
    Schedule,
    MascotScene,
    CoachingConfig,
    EnforcementPolicy,
    WalletMutation,
    Ritual,
    SoundCue,
    AuditQuery,
}

/// Body is a tagged enum containing the variant-specific content.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum Body {
    #[serde(rename = "Rule")]
    Rule(Box<RuleIr>),

    #[serde(rename = "Connector")]
    Connector(ConnectorIr),

    #[serde(rename = "Template")]
    Template(TemplateIr),

    #[serde(rename = "Task")]
    Task(TaskIr),

    #[serde(rename = "Schedule")]
    Schedule(ScheduleIr),

    #[serde(rename = "MascotScene")]
    MascotScene(MascotSceneIr),

    #[serde(rename = "CoachingConfig")]
    CoachingConfig(CoachingConfigIr),

    #[serde(rename = "EnforcementPolicy")]
    EnforcementPolicy(EnforcementPolicyIr),

    #[serde(rename = "WalletMutation")]
    WalletMutation(WalletMutationIr),

    #[serde(rename = "Ritual")]
    Ritual(RitualIr),

    #[serde(rename = "SoundCue")]
    SoundCue(SoundCueIr),

    #[serde(rename = "AuditQuery")]
    AuditQuery(AuditQueryIr),
}

// ============================================================================
// Rule IR (First Slice - Fully Specified)
// ============================================================================

/// Rule IR: flat, serde-stable representation of a rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleIr {
    pub id: String,
    pub name: String,
    pub trigger: TriggerIr,
    pub conditions: Vec<ConditionIr>,
    pub actions: Vec<ActionIr>,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cooldown_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<i64>,
    pub explanation_template: String,
    pub enabled: bool,
}

/// Trigger IR: union type for rule triggers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum TriggerIr {
    #[serde(rename = "UserStartsSession")]
    UserStartsSession { session_type: String },

    #[serde(rename = "EventFired")]
    EventFired { event_name: String },

    #[serde(rename = "TimeElapsed")]
    TimeElapsed { duration_ms: u64 },

    #[serde(rename = "ScheduleCron")]
    ScheduleCron {
        cron_expression: String,
        timezone: String,
    },

    #[serde(rename = "WebhookReceived")]
    WebhookReceived { path: String, method: String },

    #[serde(rename = "UserAction")]
    UserAction {
        action_type: String,
        target: String,
    },

    #[serde(rename = "ConditionMet")]
    ConditionMet { condition: Box<ConditionIr> },
}

/// Condition IR: boolean expression (and/or/not + primitives).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op")]
pub enum ConditionIr {
    #[serde(rename = "and")]
    And { conditions: Vec<ConditionIr> },

    #[serde(rename = "or")]
    Or { conditions: Vec<ConditionIr> },

    #[serde(rename = "not")]
    Not { condition: Box<ConditionIr> },

    #[serde(rename = "time_in_range")]
    TimeInRange { start_hour: u8, end_hour: u8 },

    #[serde(rename = "day_of_week")]
    DayOfWeek { days: Vec<String> },

    #[serde(rename = "user_attribute")]
    UserAttribute { key: String, value: String },

    #[serde(rename = "event_property")]
    EventProperty {
        property: String,
        expected: serde_json::Value,
    },

    #[serde(rename = "custom_predicate")]
    CustomPredicate {
        name: String,
        args: serde_json::Value,
    },
}

/// Action IR: what to execute when a rule fires.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActionIr {
    #[serde(rename = "enforce_policy")]
    EnforcePolicy {
        policy_id: String,
        #[serde(default)]
        params: BTreeMap<String, serde_json::Value>,
    },

    #[serde(rename = "emit_event")]
    EmitEvent {
        event_type: String,
        #[serde(default)]
        payload: BTreeMap<String, serde_json::Value>,
    },

    #[serde(rename = "apply_mutation")]
    ApplyMutation {
        mutation_id: String,
        #[serde(default)]
        params: BTreeMap<String, serde_json::Value>,
    },

    #[serde(rename = "schedule_task")]
    ScheduleTask {
        task_id: String,
        delay_ms: Option<u64>,
        #[serde(default)]
        params: BTreeMap<String, serde_json::Value>,
    },

    #[serde(rename = "trigger_sequence")]
    TriggerSequence { actions: Vec<ActionIr> },

    #[serde(rename = "show_notification")]
    ShowNotification {
        notification_id: String,
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
}

// ============================================================================
// Placeholder Variants (TODO: Reference spec sections)
// ============================================================================

/// Connector IR: mirrors focus_connectors::ConnectorManifest.
/// Traces to spec "Connector (Integration Definition)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorIr {
    pub id: String,
    pub version: String,
    pub display_name: String,
    pub auth_strategy: AuthStrategyIr,
    pub sync_mode: SyncModeIr,
    pub capabilities: Vec<ConnectorCapabilityIr>,
    pub entity_types: Vec<String>,
    pub event_types: Vec<String>,
    pub tier: String, // "Official", "Verified", "MCPBridged", "Private"
    #[serde(default)]
    pub health_indicators: Vec<String>,
}

/// Authentication strategy for a connector.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AuthStrategyIr {
    #[serde(rename = "oauth2")]
    OAuth2 { scopes: Vec<String> },
    #[serde(rename = "api_key")]
    ApiKey,
    #[serde(rename = "device_brokered")]
    DeviceBrokered,
    #[serde(rename = "none")]
    None,
}

/// Sync mode for a connector.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncModeIr {
    #[serde(rename = "polling")]
    Polling { cadence_seconds: u64 },
    #[serde(rename = "webhook")]
    Webhook,
    #[serde(rename = "hybrid")]
    Hybrid,
}

/// Connector capability with parameter schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCapabilityIr {
    pub name: String,
    pub params_schema: serde_json::Value,
}

/// Template IR: mirrors focus_templates domain type.
/// Traces to spec "Template (Reusable Composition)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateIr {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub inputs: BTreeMap<String, InputDefIr>,
    pub rules: Vec<RuleIr>,
}

/// Task IR: flat, serde-stable representation of a planning task.
/// Mirrors focus_planning::Task but with serializable duration/deadline fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskIr {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub duration_spec: DurationSpecIr,
    pub priority_weight: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deadline: Option<DeadlineIr>,
    pub chunking: ChunkingPolicyIr,
    pub constraints: Vec<ConstraintIr>,
    pub status: TaskStatusIr,
}

/// Duration specification: fixed or estimated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DurationSpecIr {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixed_minutes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimate: Option<EstimateIr>,
}

/// P50/P90 estimate in minutes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimateIr {
    pub p50_minutes: i64,
    pub p90_minutes: i64,
}

/// Deadline with datetime and rigidity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadlineIr {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when_iso8601: Option<String>,
    pub rigidity: String, // "hard", "soft", or "semi(N)"
}

/// Chunking policy for task splitting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkingPolicyIr {
    pub allow_split: bool,
    pub min_chunk_minutes: i64,
    pub max_chunk_minutes: i64,
    pub ideal_chunk_minutes: i64,
}

/// Constraints on task scheduling.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ConstraintIr {
    #[serde(rename = "working_hours")]
    WorkingHours {
        start_hour: u8,
        end_hour: u8,
        days: Vec<String>,
    },
    #[serde(rename = "no_earlier_than")]
    NoEarlierThan { when_iso8601: String },
    #[serde(rename = "no_later_than")]
    NoLaterThan { when_iso8601: String },
    #[serde(rename = "buffer")]
    Buffer { duration_minutes: i64 },
    #[serde(rename = "energy_tier")]
    EnergyTier { tier: String }, // "deep_focus", "light", "admin"
}

/// Task status with optional scheduled chunks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum TaskStatusIr {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "scheduled")]
    Scheduled { chunks: Vec<TimeBlockIr> },
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "cancelled")]
    Cancelled,
}

/// A scheduled time block for a task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeBlockIr {
    pub task_id: String,
    pub starts_at_iso8601: String,
    pub ends_at_iso8601: String,
    pub rigidity: String,
}

/// Schedule IR: temporal trigger specification (cron-based).
/// No native Rust type mirrors this; it's a DSL-level primitive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleIr {
    pub id: String,
    pub cron_spec: String,
    pub enabled: bool,
    pub description: String,
    pub attached_rule_ids: Vec<String>,
}

/// InputDef for template inputs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputDefIr {
    pub type_: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// MascotScene IR: visual state and speech for the mascot.
/// Traces to spec "Pose (Mascot Visual State)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MascotSceneIr {
    pub id: String,
    pub name: String,
    pub character: String, // "default", "mentor", "cheerleader"
    pub pose: String, // "neutral", "thumbs_up", "thinking", "excited"
    pub emotion: String, // "happy", "neutral", "sad", "confused"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessory: Option<String>, // "glasses", "hat", "none"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speech_bubble: Option<SpeechBubbleIr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_cue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sound_cue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub haptic_cue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_animation: Option<AnimationIr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hold_duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_animation: Option<AnimationIr>,
}

/// Speech bubble content and styling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechBubbleIr {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_alignment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_style: Option<String>,
}

/// Animation definition for mascot transitions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationIr {
    pub type_: String,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub easing: Option<String>,
}

/// CoachingConfig IR: tone, voice, and notification settings.
/// Traces to spec "CoachingConfig (Tone & Voice Settings)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoachingConfigIr {
    pub id: String,
    pub name: String,
    pub tone: String, // "encouraging", "neutral", "challenging", "humorous"
    pub language: String, // "en", "es", "fr"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_profile: Option<VoiceProfileIr>,
    pub text_templates: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_style: Option<String>,
}

/// Voice profile for text-to-speech.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceProfileIr {
    pub voice_id: String,
    pub speed: f32, // 0.5..2.0
    pub pitch: f32, // 0.5..2.0
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent: Option<String>,
}

/// EnforcementPolicy IR: mirrors focus_policy::EnforcementPolicy.
/// Traces to spec "EnforcementPolicy (Rule Constraint)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnforcementPolicyIr {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub targets: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<ThresholdIr>,
    pub action_on_violation: ActionIr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grace_period_ms: Option<u64>,
}

/// Threshold constraint for enforcement.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ThresholdIr {
    #[serde(rename = "count")]
    Count { max: u64 },
    #[serde(rename = "duration")]
    Duration { max_ms: u64 },
    #[serde(rename = "frequency")]
    Frequency { max_per_hour: u64 },
    #[serde(rename = "custom")]
    Custom { predicate: String },
}

/// WalletMutation IR: mirrors focus_rewards::WalletMutation.
/// Traces to spec "WalletMutation (Points/Rewards)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletMutationIr {
    pub id: String,
    pub name: String,
    pub wallet_type: String, // "points", "badges", "currency"
    pub operation: MutationOpIr,
    pub amount: i64,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditional: Option<ConditionIr>,
}

/// Mutation operation type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MutationOpIr {
    Add,
    Subtract,
    Multiply,
    Set,
    Transfer,
}

/// Ritual IR: mirrors focus_rituals (MorningBrief + EveningShutdown).
/// Traces to spec "Ritual (Habit Loop Sequence)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RitualIr {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub steps: Vec<RitualStepIr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub daily_goal: Option<u64>,
    pub tracking: RitualTrackingIr,
    pub rewards: Vec<WalletMutationIr>,
}

/// Single step in a ritual sequence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RitualStepIr {
    pub sequence: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub cue: String,
    pub routine: Box<TaskIr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reward: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_duration_ms: Option<u64>,
}

/// Tracking preferences for a ritual.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RitualTrackingIr {
    pub enabled: bool,
    pub track_completion: bool,
    pub track_duration: bool,
    pub track_quality: bool,
}

/// SoundCue IR: audio asset reference with metadata.
/// Traces to spec "SoundCue (Audio Asset Reference)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundCueIr {
    pub id: String,
    pub name: String,
    pub asset_url: String,
    pub asset_hash: String, // sha256: hash for integrity
    pub duration_ms: u64,
    pub volume_level: f32, // 0.0..1.0
    pub tags: Vec<String>,
    pub usage: String, // "reward", "notification", "error"
}

/// AuditQuery IR: structured event query with filters and aggregations.
/// Traces to spec "AuditQuery (Event Query)".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditQueryIr {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub event_filter: EventFilterIr,
    pub projections: Vec<String>,
    pub aggregations: Vec<AggregationIr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_range: Option<TimeRangeIr>,
}

/// Filter criteria for event queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFilterIr {
    pub event_types: Vec<String>,
    pub conditions: Vec<ConditionIr>,
}

/// Aggregation operation for queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AggregationIr {
    #[serde(rename = "count")]
    Count { field: Option<String> },
    #[serde(rename = "sum")]
    Sum { field: String },
    #[serde(rename = "avg")]
    Average { field: String },
    #[serde(rename = "distinct")]
    Distinct { field: String },
}

/// Time range constraint for queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRangeIr {
    pub start: String, // RFC 3339
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<String>,
}

// ============================================================================
// Content Addressing
// ============================================================================

/// Error type for IR operations.
#[derive(Debug, thiserror::Error)]
pub enum IrError {
    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Invalid document: {0}")]
    InvalidDocument(String),
}

impl Document {
    /// Compute the content hash (SHA-256) of this document.
    ///
    /// Uses canonical JSON format: all keys sorted alphabetically, no whitespace,
    /// deterministic serialization for stable hashing across rebuilds.
    pub fn content_hash(&self) -> Result<[u8; 32], IrError> {
        let canonical = canonical_json(self)?;
        let mut hasher = Sha256::new();
        hasher.update(canonical.as_bytes());
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result[..]);
        Ok(hash)
    }

    /// Return content hash as hex string for inspection.
    pub fn content_hash_hex(&self) -> Result<String, IrError> {
        let hash = self.content_hash()?;
        Ok(hex::encode(hash))
    }
}

/// Convert document to canonical JSON (sorted keys, no whitespace).
fn canonical_json(doc: &Document) -> Result<String, IrError> {
    // Serialize to JSON, then re-parse and re-serialize to ensure key ordering.
    let json_str = serde_json::to_string(doc)?;
    let value: serde_json::Value = serde_json::from_str(&json_str)?;
    let canonical = sort_json_object(&value);
    Ok(serde_json::to_string(&canonical)?)
}

/// Recursively sort all JSON object keys to ensure deterministic ordering.
fn sort_json_object(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted = serde_json::Map::new();
            let mut keys: Vec<_> = map.keys().cloned().collect();
            keys.sort();
            for key in keys {
                if let Some(val) = map.get(&key) {
                    sorted.insert(key, sort_json_object(val));
                }
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(arr) => {
            let sorted: Vec<_> = arr.iter().map(sort_json_object).collect();
            serde_json::Value::Array(sorted)
        }
        other => other.clone(),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use chrono::Timelike;

    // Round-Trip Conversions (focus_rules::Rule <-> RuleIr)

    /// Convert a focus_rules::Rule to RuleIr.
    #[allow(dead_code)]
    fn rule_to_ir(rule: &focus_rules::Rule) -> RuleIr {
        RuleIr {
            id: rule.id.to_string(),
            name: rule.name.clone(),
            trigger: trigger_to_ir(&rule.trigger),
            conditions: rule
                .conditions
                .iter()
                .map(condition_to_ir)
                .collect(),
            actions: rule.actions.iter().map(action_to_ir).collect(),
            priority: rule.priority,
            cooldown_seconds: rule.cooldown.map(|d| d.num_seconds()),
            duration_seconds: rule.duration.map(|d| d.num_seconds()),
            explanation_template: rule.explanation_template.clone(),
            enabled: rule.enabled,
        }
    }

    /// Convert RuleIr back to focus_rules::Rule.
    #[allow(dead_code)]
    pub fn ir_to_rule(ir: &RuleIr) -> Result<focus_rules::Rule, IrError> {
        Ok(focus_rules::Rule {
            id: Uuid::parse_str(&ir.id)
                .map_err(|_| IrError::InvalidDocument("Invalid rule ID UUID".into()))?,
            name: ir.name.clone(),
            trigger: ir_to_trigger(&ir.trigger)?,
            conditions: ir
                .conditions
                .iter()
                .map(ir_to_condition)
                .collect::<Result<_, _>>()?,
            actions: ir
                .actions
                .iter()
                .map(ir_to_action)
                .collect::<Result<_, _>>()?,
            priority: ir.priority,
            cooldown: ir.cooldown_seconds.map(chrono::Duration::seconds),
            duration: ir.duration_seconds.map(chrono::Duration::seconds),
            explanation_template: ir.explanation_template.clone(),
            enabled: ir.enabled,
        })
    }

    #[allow(dead_code)]
    fn trigger_to_ir(trigger: &focus_rules::Trigger) -> TriggerIr {
        match trigger {
            focus_rules::Trigger::Event(name) => TriggerIr::EventFired {
                event_name: name.clone(),
            },
            focus_rules::Trigger::Schedule(cron) => TriggerIr::ScheduleCron {
                cron_expression: cron.clone(),
                timezone: "UTC".into(),
            },
            focus_rules::Trigger::StateChange(state) => TriggerIr::UserAction {
                action_type: "state_change".into(),
                target: state.clone(),
            },
        }
    }

    #[allow(dead_code)]
    fn ir_to_trigger(trigger: &TriggerIr) -> Result<focus_rules::Trigger, IrError> {
        match trigger {
            TriggerIr::EventFired { event_name } => {
                Ok(focus_rules::Trigger::Event(event_name.clone()))
            }
            TriggerIr::ScheduleCron {
                cron_expression, ..
            } => Ok(focus_rules::Trigger::Schedule(cron_expression.clone())),
            TriggerIr::UserAction {
                action_type,
                target,
            } if action_type == "state_change" => {
                Ok(focus_rules::Trigger::StateChange(target.clone()))
            }
            _ => Err(IrError::InvalidDocument(
                "Unsupported trigger type".into(),
            )),
        }
    }

    #[allow(dead_code)]
    fn condition_to_ir(_condition: &focus_rules::Condition) -> ConditionIr {
        ConditionIr::CustomPredicate {
            name: _condition.kind.clone(),
            args: _condition.params.clone(),
        }
    }

    #[allow(dead_code)]
    fn ir_to_condition(ir: &ConditionIr) -> Result<focus_rules::Condition, IrError> {
        match ir {
            ConditionIr::CustomPredicate { name, args } => Ok(focus_rules::Condition {
                kind: name.clone(),
                params: args.clone(),
            }),
            _ => Err(IrError::InvalidDocument(
                "Complex conditions not yet supported in round-trip".into(),
            )),
        }
    }

    #[allow(dead_code)]
    fn action_to_ir(action: &focus_rules::Action) -> ActionIr {
        match action {
            focus_rules::Action::GrantCredit { amount } => ActionIr::EmitEvent {
                event_type: "grant_credit".into(),
                payload: {
                    let mut m = BTreeMap::new();
                    m.insert("amount".into(), serde_json::Value::Number((*amount).into()));
                    m
                },
            },
            focus_rules::Action::DeductCredit { amount } => ActionIr::EmitEvent {
                event_type: "deduct_credit".into(),
                payload: {
                    let mut m = BTreeMap::new();
                    m.insert("amount".into(), serde_json::Value::Number((*amount).into()));
                    m
                },
            },
            focus_rules::Action::Block {
                profile,
                duration,
                rigidity,
            } => ActionIr::EnforcePolicy {
                policy_id: "block".into(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".into(), serde_json::json!(profile));
                    m.insert("duration_secs".into(), serde_json::json!(duration.num_seconds()));
                    m.insert("rigidity".into(), serde_json::json!(format!("{:?}", rigidity)));
                    m
                },
            },
            focus_rules::Action::Unblock { profile } => ActionIr::EnforcePolicy {
                policy_id: "unblock".into(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".into(), serde_json::json!(profile));
                    m
                },
            },
            focus_rules::Action::StreakIncrement(name) => ActionIr::EmitEvent {
                event_type: "streak_increment".into(),
                payload: {
                    let mut m = BTreeMap::new();
                    m.insert("streak_name".into(), serde_json::json!(name));
                    m
                },
            },
            focus_rules::Action::StreakReset(name) => ActionIr::EmitEvent {
                event_type: "streak_reset".into(),
                payload: {
                    let mut m = BTreeMap::new();
                    m.insert("streak_name".into(), serde_json::json!(name));
                    m
                },
            },
            focus_rules::Action::Notify(msg) => ActionIr::ShowNotification {
                notification_id: Uuid::new_v4().to_string(),
                text: msg.clone(),
                duration_ms: None,
            },
            focus_rules::Action::EmergencyExit {
                profiles,
                duration,
                bypass_cost,
                reason,
            } => ActionIr::EnforcePolicy {
                policy_id: "emergency_exit".into(),
                params: {
                    let mut m = BTreeMap::new();
                    m.insert(
                        "profiles".into(),
                        serde_json::json!(profiles.iter().collect::<Vec<_>>()),
                    );
                    m.insert("duration_secs".into(), serde_json::json!(duration.num_seconds()));
                    m.insert("bypass_cost".into(), serde_json::json!(bypass_cost));
                    m.insert("reason".into(), serde_json::json!(reason));
                    m
                },
            },
            focus_rules::Action::Intervention {
                message,
                severity: _,
            } => ActionIr::ShowNotification {
                notification_id: Uuid::new_v4().to_string(),
                text: message.clone(),
                duration_ms: Some(5000),
            },
            focus_rules::Action::ScheduledUnlockWindow {
                profile,
                starts_at,
                ends_at,
                credit_cost,
            } => ActionIr::ScheduleTask {
                task_id: "unlock_window".into(),
                delay_ms: None,
                params: {
                    let mut m = BTreeMap::new();
                    m.insert("profile".into(), serde_json::json!(profile));
                    m.insert("starts_at".into(), serde_json::json!(starts_at.to_rfc3339()));
                    m.insert("ends_at".into(), serde_json::json!(ends_at.to_rfc3339()));
                    m.insert("credit_cost".into(), serde_json::json!(credit_cost));
                    m
                },
            },
        }
    }

    #[allow(dead_code)]
    fn ir_to_action(ir: &ActionIr) -> Result<focus_rules::Action, IrError> {
        // This is a simplified conversion; not all IR actions can round-trip yet.
        match ir {
            ActionIr::EmitEvent {
                event_type,
                payload,
            } => {
                match event_type.as_str() {
                    "grant_credit" => {
                        let amount = payload
                            .get("amount")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0) as i32;
                        Ok(focus_rules::Action::GrantCredit { amount })
                    }
                    "deduct_credit" => {
                        let amount = payload
                            .get("amount")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0) as i32;
                        Ok(focus_rules::Action::DeductCredit { amount })
                    }
                    _ => Err(IrError::InvalidDocument("Unknown event type".into())),
                }
            }
            _ => Err(IrError::InvalidDocument(
                "Action type not yet supported in IR->Rule conversion".into(),
            )),
        }
    }

    #[test]
    fn test_content_hash_stable() {
        let doc = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "rule-test-001".into(),
            name: "test-rule".into(),
            body: Body::Rule(Box::new(RuleIr {
                id: "rule-1".into(),
                name: "test".into(),
                trigger: TriggerIr::EventFired {
                    event_name: "test_event".into(),
                },
                conditions: vec![],
                actions: vec![],
                priority: 1,
                cooldown_seconds: None,
                duration_seconds: None,
                explanation_template: "Test rule".into(),
                enabled: true,
            })),
        };

        let hash1 = doc.content_hash().expect("First hash");
        let hash2 = doc.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "Content hash must be stable across calls");
    }

    #[test]
    fn test_content_hash_changes_on_field_change() {
        let mut doc = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "rule-test-001".into(),
            name: "test-rule".into(),
            body: Body::Rule(Box::new(RuleIr {
                id: "rule-1".into(),
                name: "test".into(),
                trigger: TriggerIr::EventFired {
                    event_name: "event1".into(),
                },
                conditions: vec![],
                actions: vec![],
                priority: 1,
                cooldown_seconds: None,
                duration_seconds: None,
                explanation_template: "Test rule".into(),
                enabled: true,
            })),
        };

        let hash1 = doc.content_hash().expect("First hash");

        // Change a field
        if let Body::Rule(ref mut rule) = &mut doc.body {
            rule.name = "modified".into();
        }
        let hash2 = doc.content_hash().expect("Second hash");

        assert_ne!(hash1, hash2, "Content hash must change when document changes");
    }

    #[test]
    fn test_serde_json_round_trip() {
        let original = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "rule-test-002".into(),
            name: "round-trip-test".into(),
            body: Body::Rule(Box::new(RuleIr {
                id: "rule-2".into(),
                name: "rt".into(),
                trigger: TriggerIr::ScheduleCron {
                    cron_expression: "0 9 * * 1-5".into(),
                    timezone: "America/New_York".into(),
                },
                conditions: vec![ConditionIr::TimeInRange {
                    start_hour: 8,
                    end_hour: 17,
                }],
                actions: vec![ActionIr::EnforcePolicy {
                    policy_id: "social-block".into(),
                    params: {
                        let mut m = BTreeMap::new();
                        m.insert("duration".into(), serde_json::json!(3600));
                        m
                    },
                }],
                priority: 10,
                cooldown_seconds: Some(300),
                duration_seconds: Some(7200),
                explanation_template: "Block during work hours".into(),
                enabled: true,
            })),
        };

        let json = serde_json::to_string(&original).expect("Serialize");
        let restored: Document = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(original.version, restored.version);
        assert_eq!(original.id, restored.id);
        assert_eq!(original.name, restored.name);

        let orig_hash = original.content_hash().expect("Hash original");
        let rest_hash = restored.content_hash().expect("Hash restored");
        assert_eq!(orig_hash, rest_hash, "Round-trip must preserve hash");
    }

    #[test]
    fn test_canonical_json_sorts_keys() {
        // Create a document; serialize to JSON; verify keys are sorted.
        let doc = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "rule-3".into(),
            name: "sort-test".into(),
            body: Body::Rule(Box::new(RuleIr {
                id: "r3".into(),
                name: "sort".into(),
                trigger: TriggerIr::EventFired {
                    event_name: "e".into(),
                },
                conditions: vec![],
                actions: vec![],
                priority: 1,
                cooldown_seconds: None,
                duration_seconds: None,
                explanation_template: "x".into(),
                enabled: true,
            })),
        };

        let canonical = canonical_json(&doc).expect("Canonical JSON");
        // Verify no whitespace
        assert!(!canonical.contains('\n'));
        assert!(!canonical.contains('\r'));
        // Verify it parses back
        let _: serde_json::Value = serde_json::from_str(&canonical).expect("Valid JSON");
    }

    #[test]
    fn test_rule_ir_with_complex_conditions() {
        let rule = RuleIr {
            id: "complex-1".into(),
            name: "complex condition rule".into(),
            trigger: TriggerIr::UserStartsSession {
                session_type: "focus".into(),
            },
            conditions: vec![ConditionIr::And {
                conditions: vec![
                    ConditionIr::TimeInRange {
                        start_hour: 8,
                        end_hour: 17,
                    },
                    ConditionIr::DayOfWeek {
                        days: vec!["Monday".into(), "Tuesday".into(), "Wednesday".into()],
                    },
                ],
            }],
            actions: vec![
                ActionIr::EnforcePolicy {
                    policy_id: "block-social".into(),
                    params: {
                        let mut m = BTreeMap::new();
                        m.insert("duration_ms".into(), serde_json::json!(7200000));
                        m
                    },
                },
                ActionIr::ShowNotification {
                    notification_id: "notif-1".into(),
                    text: "Deep work started".into(),
                    duration_ms: Some(5000),
                },
            ],
            priority: 100,
            cooldown_seconds: Some(600),
            duration_seconds: Some(3600),
            explanation_template: "Block social media during focus sessions".into(),
            enabled: true,
        };

        let json = serde_json::to_string(&rule).expect("Serialize");
        let restored: RuleIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(rule.id, restored.id);
        assert_eq!(rule.conditions.len(), restored.conditions.len());
    }

    #[test]
    fn test_placeholder_variants_minimal() {
        // Verify minimal connector and template structs serialize/deserialize cleanly
        let connector = Body::Connector(ConnectorIr {
            id: "test-conn".into(),
            version: "1.0".into(),
            display_name: "Test".into(),
            auth_strategy: AuthStrategyIr::None,
            sync_mode: SyncModeIr::Polling { cadence_seconds: 60 },
            capabilities: vec![],
            entity_types: vec![],
            event_types: vec![],
            tier: "Verified".into(),
            health_indicators: vec![],
        });
        let json = serde_json::to_string(&connector).expect("Serialize connector");
        let _: Body = serde_json::from_str(&json).expect("Deserialize connector");

        let template = Body::Template(TemplateIr {
            id: "test-tmpl".into(),
            name: "Test".into(),
            description: None,
            inputs: BTreeMap::new(),
            rules: vec![],
        });
        let json = serde_json::to_string(&template).expect("Serialize template");
        let _: Body = serde_json::from_str(&json).expect("Deserialize template");
    }

    #[test]
    fn test_document_with_actions_round_trip() {
        let doc = Document {
            version: 1,
            kind: DocKind::Rule,
            id: "action-test".into(),
            name: "action rule".into(),
            body: Body::Rule(Box::new(RuleIr {
                id: "ar1".into(),
                name: "actions".into(),
                trigger: TriggerIr::EventFired {
                    event_name: "badge_earned".into(),
                },
                conditions: vec![],
                actions: vec![
                    ActionIr::EnforcePolicy {
                        policy_id: "unlock".into(),
                        params: {
                            let mut m = BTreeMap::new();
                            m.insert("duration_ms".into(), serde_json::json!(600000));
                            m
                        },
                    },
                    ActionIr::ShowNotification {
                        notification_id: "reward-notif".into(),
                        text: "Great job!".into(),
                        duration_ms: Some(3000),
                    },
                ],
                priority: 1,
                cooldown_seconds: None,
                duration_seconds: None,
                explanation_template: "Reward for achievement".into(),
                enabled: true,
            })),
        };

        let json = serde_json::to_string(&doc).expect("Serialize");
        let restored: Document = serde_json::from_str(&json).expect("Deserialize");
        let json2 = serde_json::to_string(&restored).expect("Serialize again");

        assert_eq!(json, json2, "JSON round-trip must be identical");
    }

    // Round-Trip Conversions (focus_planning::Task <-> TaskIr)

    /// Convert a focus_planning::Task to TaskIr.
    #[allow(dead_code)]
    fn task_to_ir(task: &focus_planning::Task, user_id: &str) -> TaskIr {
        TaskIr {
            id: task.id.to_string(),
            user_id: user_id.to_string(),
            title: task.title.clone(),
            duration_spec: duration_spec_to_ir(&task.duration),
            priority_weight: task.priority.weight,
            deadline: Some(deadline_to_ir(&task.deadline)),
            chunking: chunking_to_ir(&task.chunking),
            constraints: task.constraints.iter().map(constraint_to_ir).collect(),
            status: status_to_ir(&task.status),
        }
    }

    /// Convert TaskIr back to focus_planning::Task.
    #[allow(dead_code)]
    pub fn ir_to_task(ir: &TaskIr) -> Result<focus_planning::Task, IrError> {
        Ok(focus_planning::Task {
            id: Uuid::parse_str(&ir.id)
                .map_err(|_| IrError::InvalidDocument("Invalid task ID UUID".into()))?,
            title: ir.title.clone(),
            duration: ir_to_duration_spec(&ir.duration_spec)?,
            priority: focus_planning::Priority::clamped(ir.priority_weight),
            deadline: ir_to_deadline(&ir.deadline)?,
            chunking: ir_to_chunking(&ir.chunking)?,
            constraints: ir
                .constraints
                .iter()
                .map(ir_to_constraint)
                .collect::<Result<_, _>>()?,
            status: ir_to_status(&ir.status)?,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    fn duration_spec_to_ir(ds: &focus_planning::DurationSpec) -> DurationSpecIr {
        DurationSpecIr {
            fixed_minutes: ds.fixed.map(|d| d.num_minutes()),
            estimate: ds.estimate.as_ref().map(|e| EstimateIr {
                p50_minutes: e.p50.num_minutes(),
                p90_minutes: e.p90.num_minutes(),
            }),
        }
    }

    fn ir_to_duration_spec(ir: &DurationSpecIr) -> Result<focus_planning::DurationSpec, IrError> {
        Ok(focus_planning::DurationSpec {
            fixed: ir.fixed_minutes.map(chrono::Duration::minutes),
            estimate: ir.estimate.as_ref().map(|e| focus_planning::Estimate {
                p50: chrono::Duration::minutes(e.p50_minutes),
                p90: chrono::Duration::minutes(e.p90_minutes),
            }),
        })
    }

    fn deadline_to_ir(d: &focus_planning::Deadline) -> DeadlineIr {
        DeadlineIr {
            when_iso8601: d.when.map(|dt| dt.to_rfc3339()),
            rigidity: format!("{:?}", d.rigidity),
        }
    }

    fn ir_to_deadline(ir: &Option<DeadlineIr>) -> Result<focus_planning::Deadline, IrError> {
        match ir {
            None => Ok(focus_planning::Deadline::none()),
            Some(d) => {
                let when = match &d.when_iso8601 {
                    None => None,
                    Some(s) => Some(
                        chrono::DateTime::parse_from_rfc3339(s)
                            .map_err(|_| IrError::InvalidDocument("Invalid ISO8601 datetime".into()))?
                            .with_timezone(&chrono::Utc),
                    ),
                };
                let rigidity = match d.rigidity.as_str() {
                    "Hard" => focus_domain::Rigidity::Hard,
                    "Soft" => focus_domain::Rigidity::Soft,
                    s if s.starts_with("Semi") => {
                        // Parse "Semi(CreditCost(N))" or similar
                        focus_domain::Rigidity::Soft // Simplified; exact parsing depends on domain
                    }
                    _ => focus_domain::Rigidity::Soft,
                };
                Ok(focus_planning::Deadline { when, rigidity })
            }
        }
    }

    fn chunking_to_ir(cp: &focus_planning::ChunkingPolicy) -> ChunkingPolicyIr {
        ChunkingPolicyIr {
            allow_split: cp.allow_split,
            min_chunk_minutes: cp.min_chunk.num_minutes(),
            max_chunk_minutes: cp.max_chunk.num_minutes(),
            ideal_chunk_minutes: cp.ideal_chunk.num_minutes(),
        }
    }

    fn ir_to_chunking(ir: &ChunkingPolicyIr) -> Result<focus_planning::ChunkingPolicy, IrError> {
        Ok(focus_planning::ChunkingPolicy {
            allow_split: ir.allow_split,
            min_chunk: chrono::Duration::minutes(ir.min_chunk_minutes),
            max_chunk: chrono::Duration::minutes(ir.max_chunk_minutes),
            ideal_chunk: chrono::Duration::minutes(ir.ideal_chunk_minutes),
        })
    }

    fn constraint_to_ir(c: &focus_planning::Constraint) -> ConstraintIr {
        match c {
            focus_planning::Constraint::WorkingHours { start, end, days } => {
                ConstraintIr::WorkingHours {
                    start_hour: start.hour() as u8,
                    end_hour: end.hour() as u8,
                    days: days.iter().map(|d| format!("{:?}", d)).collect(),
                }
            }
            focus_planning::Constraint::NoEarlierThan(dt) => ConstraintIr::NoEarlierThan {
                when_iso8601: dt.to_rfc3339(),
            },
            focus_planning::Constraint::NoLaterThan(dt) => ConstraintIr::NoLaterThan {
                when_iso8601: dt.to_rfc3339(),
            },
            focus_planning::Constraint::Buffer(d) => ConstraintIr::Buffer {
                duration_minutes: d.num_minutes(),
            },
            focus_planning::Constraint::EnergyTier(et) => ConstraintIr::EnergyTier {
                tier: format!("{:?}", et),
            },
        }
    }

    fn ir_to_constraint(ir: &ConstraintIr) -> Result<focus_planning::Constraint, IrError> {
        match ir {
            ConstraintIr::WorkingHours {
                start_hour,
                end_hour,
                days,
            } => {
                let start = chrono::NaiveTime::from_hms_opt(*start_hour as u32, 0, 0)
                    .ok_or_else(|| IrError::InvalidDocument("Invalid start hour".into()))?;
                let end = chrono::NaiveTime::from_hms_opt(*end_hour as u32, 0, 0)
                    .ok_or_else(|| IrError::InvalidDocument("Invalid end hour".into()))?;
                let days_parsed = days
                    .iter()
                    .filter_map(|s| match s.as_str() {
                        "Mon" => Some(chrono::Weekday::Mon),
                        "Tue" => Some(chrono::Weekday::Tue),
                        "Wed" => Some(chrono::Weekday::Wed),
                        "Thu" => Some(chrono::Weekday::Thu),
                        "Fri" => Some(chrono::Weekday::Fri),
                        "Sat" => Some(chrono::Weekday::Sat),
                        "Sun" => Some(chrono::Weekday::Sun),
                        _ => None,
                    })
                    .collect();
                Ok(focus_planning::Constraint::WorkingHours {
                    start,
                    end,
                    days: days_parsed,
                })
            }
            ConstraintIr::NoEarlierThan { when_iso8601 } => {
                let dt = chrono::DateTime::parse_from_rfc3339(when_iso8601)
                    .map_err(|_| IrError::InvalidDocument("Invalid ISO8601 datetime".into()))?
                    .with_timezone(&chrono::Utc);
                Ok(focus_planning::Constraint::NoEarlierThan(dt))
            }
            ConstraintIr::NoLaterThan { when_iso8601 } => {
                let dt = chrono::DateTime::parse_from_rfc3339(when_iso8601)
                    .map_err(|_| IrError::InvalidDocument("Invalid ISO8601 datetime".into()))?
                    .with_timezone(&chrono::Utc);
                Ok(focus_planning::Constraint::NoLaterThan(dt))
            }
            ConstraintIr::Buffer { duration_minutes } => {
                Ok(focus_planning::Constraint::Buffer(
                    chrono::Duration::minutes(*duration_minutes),
                ))
            }
            ConstraintIr::EnergyTier { tier } => {
                let energy = match tier.as_str() {
                    "DeepFocus" => focus_planning::EnergyTier::DeepFocus,
                    "Light" => focus_planning::EnergyTier::Light,
                    "Admin" => focus_planning::EnergyTier::Admin,
                    _ => focus_planning::EnergyTier::Light,
                };
                Ok(focus_planning::Constraint::EnergyTier(energy))
            }
        }
    }

    fn status_to_ir(s: &focus_planning::TaskStatus) -> TaskStatusIr {
        match s {
            focus_planning::TaskStatus::Pending => TaskStatusIr::Pending,
            focus_planning::TaskStatus::Scheduled { chunks } => TaskStatusIr::Scheduled {
                chunks: chunks
                    .iter()
                    .map(|tb| TimeBlockIr {
                        task_id: tb.task_id.to_string(),
                        starts_at_iso8601: tb.starts_at.to_rfc3339(),
                        ends_at_iso8601: tb.ends_at.to_rfc3339(),
                        rigidity: format!("{:?}", tb.rigidity),
                    })
                    .collect(),
            },
            focus_planning::TaskStatus::InProgress => TaskStatusIr::InProgress,
            focus_planning::TaskStatus::Completed => TaskStatusIr::Completed,
            focus_planning::TaskStatus::Cancelled => TaskStatusIr::Cancelled,
        }
    }

    fn ir_to_status(ir: &TaskStatusIr) -> Result<focus_planning::TaskStatus, IrError> {
        match ir {
            TaskStatusIr::Pending => Ok(focus_planning::TaskStatus::Pending),
            TaskStatusIr::Scheduled { chunks } => {
                let parsed = chunks
                    .iter()
                    .map(|tb| {
                        let task_id = Uuid::parse_str(&tb.task_id)
                            .map_err(|_| IrError::InvalidDocument("Invalid task ID in chunk".into()))?;
                        let starts_at = chrono::DateTime::parse_from_rfc3339(&tb.starts_at_iso8601)
                            .map_err(|_| IrError::InvalidDocument("Invalid start timestamp".into()))?
                            .with_timezone(&chrono::Utc);
                        let ends_at = chrono::DateTime::parse_from_rfc3339(&tb.ends_at_iso8601)
                            .map_err(|_| IrError::InvalidDocument("Invalid end timestamp".into()))?
                            .with_timezone(&chrono::Utc);
                        let rigidity = match tb.rigidity.as_str() {
                            "Hard" => focus_domain::Rigidity::Hard,
                            _ => focus_domain::Rigidity::Soft,
                        };
                        Ok::<focus_planning::TimeBlock, IrError>(focus_planning::TimeBlock {
                            task_id,
                            starts_at,
                            ends_at,
                            rigidity,
                        })
                    })
                    .collect::<Result<Vec<_>, IrError>>()?;
                Ok(focus_planning::TaskStatus::Scheduled { chunks: parsed })
            }
            TaskStatusIr::InProgress => Ok(focus_planning::TaskStatus::InProgress),
            TaskStatusIr::Completed => Ok(focus_planning::TaskStatus::Completed),
            TaskStatusIr::Cancelled => Ok(focus_planning::TaskStatus::Cancelled),
        }
    }

    // Task IR tests

    #[test]
    fn test_task_ir_round_trip() {
        let now = chrono::Utc::now();
        let task = focus_planning::Task::new(
            "Implement feature",
            focus_planning::DurationSpec::fixed(chrono::Duration::hours(4)),
            now,
        );
        let user_id = "user-123";

        let ir = task_to_ir(&task, user_id);
        let back = ir_to_task(&ir).expect("Convert back to Task");

        assert_eq!(back.id, task.id);
        assert_eq!(back.title, task.title);
        assert_eq!(back.priority.weight, task.priority.weight);
    }

    #[test]
    fn test_task_ir_content_hash_stable() {
        let now = chrono::Utc::now();
        let task = focus_planning::Task::new(
            "Stable test",
            focus_planning::DurationSpec::estimated(
                chrono::Duration::minutes(30),
                chrono::Duration::minutes(60),
            ),
            now,
        );
        let user_id = "stable-user";

        let ir = task_to_ir(&task, user_id);
        let doc1 = Document {
            version: 1,
            kind: DocKind::Task,
            id: ir.id.clone(),
            name: ir.title.clone(),
            body: Body::Task(ir.clone()),
        };

        let hash1 = doc1.content_hash_hex().expect("Hash 1");
        let hash2 = doc1.content_hash_hex().expect("Hash 2");
        assert_eq!(hash1, hash2, "Content hash must be stable");

        // Modifying a field should change the hash
        let mut ir2 = ir;
        ir2.title = "Modified test".to_string();
        let doc2 = Document {
            version: 1,
            kind: DocKind::Task,
            id: ir2.id.clone(),
            name: ir2.title.clone(),
            body: Body::Task(ir2),
        };

        let hash3 = doc2.content_hash_hex().expect("Hash 3");
        assert_ne!(hash1, hash3, "Changing title should change hash");
    }

    #[test]
    fn test_task_ir_serialization() {
        let now = chrono::Utc::now();
        let task = focus_planning::Task::new(
            "Serialize test",
            focus_planning::DurationSpec::fixed(chrono::Duration::minutes(45)),
            now,
        );
        let ir = task_to_ir(&task, "test-user");

        let json = serde_json::to_string(&ir).expect("Serialize TaskIr");
        let back: TaskIr = serde_json::from_str(&json).expect("Deserialize TaskIr");

        assert_eq!(back.id, ir.id);
        assert_eq!(back.title, ir.title);
        assert_eq!(back.priority_weight, ir.priority_weight);
    }

    #[test]
    fn test_schedule_ir_serialization() {
        let schedule = ScheduleIr {
            id: "sched-1".to_string(),
            cron_spec: "0 9 * * 1-5".to_string(),
            enabled: true,
            description: "Weekday standup".to_string(),
            attached_rule_ids: vec!["rule-1".to_string(), "rule-2".to_string()],
        };

        let json = serde_json::to_string(&schedule).expect("Serialize ScheduleIr");
        let back: ScheduleIr = serde_json::from_str(&json).expect("Deserialize ScheduleIr");

        assert_eq!(back.id, schedule.id);
        assert_eq!(back.cron_spec, schedule.cron_spec);
        assert!(back.enabled);
        assert_eq!(back.attached_rule_ids.len(), 2);
    }

    #[test]
    fn test_schedule_ir_in_document() {
        let schedule = ScheduleIr {
            id: "doc-sched-1".to_string(),
            cron_spec: "*/15 * * * *".to_string(),
            enabled: true,
            description: "Every 15 minutes".to_string(),
            attached_rule_ids: vec![],
        };

        let doc = Document {
            version: 1,
            kind: DocKind::Schedule,
            id: schedule.id.clone(),
            name: schedule.description.clone(),
            body: Body::Schedule(schedule.clone()),
        };

        let json = serde_json::to_string(&doc).expect("Serialize Schedule document");
        let restored: Document = serde_json::from_str(&json).expect("Deserialize Schedule document");

        match &restored.body {
            Body::Schedule(s) => {
                assert_eq!(s.id, schedule.id);
                assert_eq!(s.cron_spec, schedule.cron_spec);
            }
            _ => panic!("Expected Schedule variant"),
        }
    }

    #[test]
    fn test_task_ir_body_round_trip() {
        let ir = TaskIr {
            id: "task-123".to_string(),
            user_id: "user-abc".to_string(),
            title: "Body test".to_string(),
            duration_spec: DurationSpecIr {
                fixed_minutes: Some(30),
                estimate: None,
            },
            priority_weight: 0.75,
            deadline: None,
            chunking: ChunkingPolicyIr {
                allow_split: true,
                min_chunk_minutes: 25,
                max_chunk_minutes: 120,
                ideal_chunk_minutes: 50,
            },
            constraints: vec![],
            status: TaskStatusIr::Pending,
        };

        let body = Body::Task(ir.clone());
        let json = serde_json::to_string(&body).expect("Serialize Task body");
        let back: Body = serde_json::from_str(&json).expect("Deserialize Task body");

        match back {
            Body::Task(restored) => {
                assert_eq!(restored.id, ir.id);
                assert_eq!(restored.title, ir.title);
            }
            _ => panic!("Expected Task variant"),
        }
    }

    // ====================================================================
    // Tests for Connector, Template, EnforcementPolicy, WalletMutation, Ritual
    // ====================================================================

    #[test]
    fn test_connector_ir_content_hash_stable() {
        let connector = ConnectorIr {
            id: "conn-github".into(),
            version: "1.0.0".into(),
            display_name: "GitHub".into(),
            auth_strategy: AuthStrategyIr::OAuth2 {
                scopes: vec!["repo".into(), "user".into()],
            },
            sync_mode: SyncModeIr::Polling { cadence_seconds: 3600 },
            capabilities: vec![ConnectorCapabilityIr {
                name: "fetch_issues".into(),
                params_schema: serde_json::json!({"owner": "string"}),
            }],
            entity_types: vec!["issue".into(), "pr".into()],
            event_types: vec!["issue_opened".into()],
            tier: "Verified".into(),
            health_indicators: vec!["last_sync_ok".into()],
        };

        let doc1 = Document {
            version: 1,
            kind: DocKind::Connector,
            id: "connector-1".into(),
            name: "GitHub Connector".into(),
            body: Body::Connector(connector.clone()),
        };

        let hash1 = doc1.content_hash().expect("First hash");
        let hash2 = doc1.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "Connector content hash must be stable");
    }

    #[test]
    fn test_connector_ir_round_trip() {
        let connector = ConnectorIr {
            id: "conn-slack".into(),
            version: "2.1.0".into(),
            display_name: "Slack".into(),
            auth_strategy: AuthStrategyIr::OAuth2 {
                scopes: vec!["chat:write".into()],
            },
            sync_mode: SyncModeIr::Webhook,
            capabilities: vec![],
            entity_types: vec!["message".into()],
            event_types: vec!["message_posted".into()],
            tier: "Official".into(),
            health_indicators: vec![],
        };

        let json = serde_json::to_string(&connector).expect("Serialize");
        let restored: ConnectorIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(connector.id, restored.id);
        assert_eq!(connector.version, restored.version);
        assert_eq!(connector.display_name, restored.display_name);
    }

    #[test]
    fn test_template_ir_content_hash_stable() {
        let template = TemplateIr {
            id: "tmpl-focus".into(),
            name: "Focus Template".into(),
            description: Some("Deep work ritual".into()),
            inputs: {
                let mut m = BTreeMap::new();
                m.insert(
                    "duration_minutes".into(),
                    InputDefIr {
                        type_: "number".into(),
                        default: Some(serde_json::json!(60)),
                        description: Some("Focus block duration".into()),
                    },
                );
                m
            },
            rules: vec![],
        };

        let doc = Document {
            version: 1,
            kind: DocKind::Template,
            id: "template-1".into(),
            name: "Template Doc".into(),
            body: Body::Template(template.clone()),
        };

        let hash1 = doc.content_hash().expect("First hash");
        let hash2 = doc.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "Template content hash must be stable");
    }

    #[test]
    fn test_enforcement_policy_ir_round_trip() {
        let policy = EnforcementPolicyIr {
            id: "pol-social".into(),
            name: "Social Media Block".into(),
            description: Some("Block distracting apps".into()),
            targets: vec!["twitter".into(), "instagram".into()],
            threshold: Some(ThresholdIr::Duration { max_ms: 3600000 }),
            action_on_violation: ActionIr::ShowNotification {
                notification_id: "blocked".into(),
                text: "App is blocked".into(),
                duration_ms: Some(3000),
            },
            grace_period_ms: Some(300000),
        };

        let json = serde_json::to_string(&policy).expect("Serialize");
        let restored: EnforcementPolicyIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(policy.id, restored.id);
        assert_eq!(policy.targets.len(), restored.targets.len());
    }

    #[test]
    fn test_wallet_mutation_ir_content_hash_stable() {
        let mutation = WalletMutationIr {
            id: "mut-daily-bonus".into(),
            name: "Daily Bonus".into(),
            wallet_type: "points".into(),
            operation: MutationOpIr::Add,
            amount: 100,
            reason: "Daily check-in".into(),
            conditional: None,
        };

        let doc = Document {
            version: 1,
            kind: DocKind::WalletMutation,
            id: "mutation-1".into(),
            name: "Grant Points".into(),
            body: Body::WalletMutation(mutation.clone()),
        };

        let hash1 = doc.content_hash().expect("First hash");
        let hash2 = doc.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "WalletMutation content hash must be stable");
    }

    #[test]
    fn test_ritual_ir_round_trip() {
        let ritual = RitualIr {
            id: "ritual-morning".into(),
            name: "Morning Ritual".into(),
            description: Some("Start the day right".into()),
            steps: vec![],
            daily_goal: Some(1),
            tracking: RitualTrackingIr {
                enabled: true,
                track_completion: true,
                track_duration: true,
                track_quality: false,
            },
            rewards: vec![],
        };

        let json = serde_json::to_string(&ritual).expect("Serialize");
        let restored: RitualIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(ritual.id, restored.id);
        assert_eq!(ritual.name, restored.name);
        assert!(restored.tracking.track_completion);
    }

    #[test]
    fn test_mascot_scene_ir_content_hash_stable() {
        let scene = MascotSceneIr {
            id: "pose-excited".into(),
            name: "Excited Celebration".into(),
            character: "default".into(),
            pose: "thumbs_up".into(),
            emotion: "happy".into(),
            accessory: Some("glasses".into()),
            speech_bubble: Some(SpeechBubbleIr {
                text: "Great job!".into(),
                text_alignment: Some("center".into()),
                background_style: Some("cloud".into()),
            }),
            voice_cue: Some("voice_celebration".into()),
            sound_cue: Some("sound_chime".into()),
            haptic_cue: Some("success_pulse".into()),
            entry_animation: Some(AnimationIr {
                type_: "pop".into(),
                duration_ms: 500,
                easing: Some("ease_out".into()),
            }),
            hold_duration_ms: Some(2000),
            exit_animation: None,
        };

        let doc = Document {
            version: 1,
            kind: DocKind::MascotScene,
            id: "scene-1".into(),
            name: "Victory Scene".into(),
            body: Body::MascotScene(scene),
        };

        let hash1 = doc.content_hash().expect("First hash");
        let hash2 = doc.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "MascotScene content hash must be stable");
    }

    #[test]
    fn test_coaching_config_ir_round_trip() {
        let config = CoachingConfigIr {
            id: "coach-encouraging".into(),
            name: "Encouraging Coach".into(),
            tone: "encouraging".into(),
            language: "en".into(),
            voice_profile: Some(VoiceProfileIr {
                voice_id: "voice-sarah".into(),
                speed: 1.0,
                pitch: 1.1,
                accent: Some("american".into()),
            }),
            text_templates: {
                let mut m = BTreeMap::new();
                m.insert("welcome".into(), "Welcome back!".into());
                m
            },
            notification_style: Some("banner".into()),
        };

        let json = serde_json::to_string(&config).expect("Serialize");
        let restored: CoachingConfigIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(config.id, restored.id);
        assert_eq!(config.tone, restored.tone);
    }

    #[test]
    fn test_sound_cue_ir_content_hash_stable() {
        let sound = SoundCueIr {
            id: "sound-success".into(),
            name: "Success Chime".into(),
            asset_url: "https://cdn.example.com/success.mp3".into(),
            asset_hash: "sha256:abc123def456".into(),
            duration_ms: 1500,
            volume_level: 0.8,
            tags: vec!["positive".into(), "reward".into()],
            usage: "reward".into(),
        };

        let doc = Document {
            version: 1,
            kind: DocKind::SoundCue,
            id: "cue-1".into(),
            name: "Success Audio".into(),
            body: Body::SoundCue(sound),
        };

        let hash1 = doc.content_hash().expect("First hash");
        let hash2 = doc.content_hash().expect("Second hash");
        assert_eq!(hash1, hash2, "SoundCue content hash must be stable");
    }

    #[test]
    fn test_audit_query_ir_round_trip() {
        let query = AuditQueryIr {
            id: "query-daily-summary".into(),
            name: "Daily Activity Summary".into(),
            description: Some("Aggregate daily stats".into()),
            event_filter: EventFilterIr {
                event_types: vec!["focus_session_end".into()],
                conditions: vec![],
            },
            projections: vec!["duration_ms".into(), "completed".into()],
            aggregations: vec![
                AggregationIr::Count { field: None },
                AggregationIr::Sum {
                    field: "duration_ms".into(),
                },
            ],
            time_range: Some(TimeRangeIr {
                start: "2026-04-23T00:00:00Z".into(),
                end: Some("2026-04-24T00:00:00Z".into()),
            }),
        };

        let json = serde_json::to_string(&query).expect("Serialize");
        let restored: AuditQueryIr = serde_json::from_str(&json).expect("Deserialize");

        assert_eq!(query.id, restored.id);
        assert_eq!(query.projections.len(), restored.projections.len());
    }
}
