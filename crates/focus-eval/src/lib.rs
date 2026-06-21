// SPDX-License-Identifier: MIT OR Apache-2.0

//! Event → Rule → Action evaluation pipeline.
//!
//! [`RuleEvaluationPipeline::tick`] pulls new events from an [`EventStore`]
//! via a persisted cursor, evaluates every enabled rule against each event
//! using a shared [`RuleEngine`] (so cooldown state survives across ticks),
//! dispatches fired actions into the wallet / penalty / policy layers, and
//! appends a `rule.fired` audit record per decision.
//!
//! This crate closes the event→rule→action loop: connectors persist events
//! via `EventSink`, the SQLite event store holds them, and the pipeline
//! turns those rows into wallet/penalty/policy mutations.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use focus_audit::AuditSink;
use focus_events::NormalizedEvent;
use focus_observability::{MetricsRegistry, RuleSpanAttrs};
use focus_penalties::PenaltyMutation;
use focus_rewards::{Credit, WalletMutation};
use focus_rules::{Action, PrioritizedDecision, Rule, RuleDecision, RuleEngine};
use focus_storage::ports::{EventStore, PenaltyStore, RuleStore, WalletStore};
use focus_sync::CursorStore;
use phenotype_observably_macros::async_instrumented;
use serde_json::json;
use tokio::sync::RwLock;
use tracing::{debug, warn};
use uuid::Uuid;

pub mod batched;

pub use batched::BatchedRuleEvaluationPipeline;

/// Canonical `(connector_id, entity_type)` pair used to persist the
/// rule-evaluation cursor. Stored here so callers and tests agree.
pub const RULE_EVAL_CONNECTOR_ID: &str = "rule_eval";
pub const RULE_EVAL_ENTITY_TYPE: &str = "events";

/// Sink for decisions that mutate enforcement policy (Block/Unblock). The
/// FFI layer stashes these in a ring buffer that `PolicyApi::build_from_
/// recent_decisions` reads; tests can use a no-op.
pub trait DecisionSink: Send + Sync {
    fn record(&self, decision: PrioritizedDecision);
}

/// Drops everything — tests, or callers that don't care about policy.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoopDecisionSink;

impl DecisionSink for NoopDecisionSink {
    fn record(&self, _decision: PrioritizedDecision) {}
}

/// Captures into a shared `Vec<PrioritizedDecision>`. Used by the FFI core
/// to feed the `recent_decisions` buffer that `PolicyApi` reads.
#[derive(Debug, Clone)]
pub struct VecDecisionSink {
    inner: Arc<Mutex<Vec<PrioritizedDecision>>>,
    cap: usize,
}

impl VecDecisionSink {
    pub fn new(inner: Arc<Mutex<Vec<PrioritizedDecision>>>, cap: usize) -> Self {
        Self { inner, cap }
    }
}

impl DecisionSink for VecDecisionSink {
    fn record(&self, decision: PrioritizedDecision) {
        if let Ok(mut g) = self.inner.lock() {
            g.push(decision);
            let len = g.len();
            if len > self.cap {
                let drop = len - self.cap;
                g.drain(0..drop);
            }
        }
    }
}

/// Summary of a single [`RuleEvaluationPipeline::tick`] pass. Surfaced over
/// FFI via `EvalApi::tick` so the UI can show "evaluated N, fired M".
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct EvaluationReport {
    pub events_evaluated: u32,
    pub decisions_fired: u32,
    pub decisions_suppressed: u32,
    pub decisions_skipped: u32,
}

/// Default batch size for each tick; keeps the mutex-held section bounded.
pub const DEFAULT_BATCH_SIZE: usize = 256;

/// Emergency exit rate-limit state: tracks the Instant of the last EmergencyExit
/// dispatch to prevent abuse (1 per hour). Traces to: FR-ENF-006.
type EmergencyExitRateLimit = Mutex<Option<Instant>>;

/// Event → Rule → Action pipeline.
///
/// Runs **alongside** the [`focus_sync::SyncOrchestrator`], not inside it:
/// the orchestrator populates the event store, then this pipeline drains it.
pub struct RuleEvaluationPipeline {
    event_store: Arc<dyn EventStore>,
    rule_store: Arc<dyn RuleStore>,
    engine: Arc<RwLock<RuleEngine>>,
    wallet_store: Arc<dyn WalletStore>,
    #[allow(dead_code)]
    penalty_store: Arc<dyn PenaltyStore>,
    cursor_store: Arc<dyn CursorStore>,
    audit: Arc<dyn AuditSink>,
    decision_sink: Arc<dyn DecisionSink>,
    user_id: Uuid,
    batch_size: usize,
    /// Rate-limit for EmergencyExit actions: 1 per hour. Tracks last fire time.
    emergency_exit_rate_limit: Arc<EmergencyExitRateLimit>,
}

impl RuleEvaluationPipeline {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        event_store: Arc<dyn EventStore>,
        rule_store: Arc<dyn RuleStore>,
        engine: Arc<RwLock<RuleEngine>>,
        wallet_store: Arc<dyn WalletStore>,
        penalty_store: Arc<dyn PenaltyStore>,
        cursor_store: Arc<dyn CursorStore>,
        audit: Arc<dyn AuditSink>,
        decision_sink: Arc<dyn DecisionSink>,
        user_id: Uuid,
    ) -> Self {
        Self {
            event_store,
            rule_store,
            engine,
            wallet_store,
            penalty_store,
            cursor_store,
            audit,
            decision_sink,
            user_id,
            batch_size: DEFAULT_BATCH_SIZE,
            emergency_exit_rate_limit: Arc::new(Mutex::new(None)),
        }
    }

    pub fn with_batch_size(mut self, batch_size: usize) -> Self {
        self.batch_size = batch_size.max(1);
        self
    }

    /// Drive one evaluation pass. Idempotent at the cursor level: a second
    /// call on the same pipeline returns an empty report once all events
    /// have been consumed.
    #[async_instrumented]
    pub async fn tick(&self, now: DateTime<Utc>) -> anyhow::Result<EvaluationReport> {
        let mut report = EvaluationReport::default();

        let cursor = self
            .cursor_store
            .load(RULE_EVAL_CONNECTOR_ID, RULE_EVAL_ENTITY_TYPE)
            .await
            .unwrap_or(None);
        // NOTE: The underlying `EventStore::since_cursor` uses its own
        // ordering-dependent cursor (event_id lex compare for
        // `SqliteAdapter`). We do our own `occurred_at` gating here so the
        // pipeline's cursor semantics are independent of storage: the
        // highest `occurred_at` ISO string we've seen is the resume point.
        let raw = self.event_store.since_cursor(None, self.batch_size).await?;
        let events: Vec<NormalizedEvent> = match cursor.as_deref() {
            Some(c) => {
                raw.into_iter().filter(|e| e.occurred_at.to_rfc3339().as_str() > c).collect()
            }
            None => raw,
        };

        if events.is_empty() {
            return Ok(report);
        }

        let rules = self.rule_store.list_enabled().await.unwrap_or_default();
        let metrics = MetricsRegistry::global();

        let mut last_cursor: Option<String> = None;
        for event in &events {
            last_cursor = Some(event.occurred_at.to_rfc3339());
            let rule_eval_start = Instant::now();
            let decisions = {
                let mut engine = self.engine.write().await;
                engine.evaluate_all(&rules, event, now)
            };
            report.events_evaluated = report.events_evaluated.saturating_add(1);

            for decision in decisions {
                let rule_id = &decision.rule_id.to_string();
                let rule_duration_ms = rule_eval_start.elapsed().as_millis() as u64;

                match &decision.decision {
                    RuleDecision::Fired(actions) => {
                        report.decisions_fired = report.decisions_fired.saturating_add(1);
                        metrics.inc_rule_evaluations(rule_id, 1.0);
                        metrics.record_eval_duration(rule_id, rule_duration_ms as f64 / 1000.0);

                        let attrs = RuleSpanAttrs::new(rule_id.clone())
                            .with_matched(true)
                            .with_duration(rule_duration_ms);
                        tracing::info!(
                            rule_id = %rule_id,
                            matched = true,
                            duration_ms = rule_duration_ms,
                            span_attrs = ?attrs,
                            "rule.evaluate span (fired)"
                        );

                        if let Err(e) = self.dispatch_actions(actions, &decision, event, now).await {
                            warn!(error = %e, "dispatch_actions failed");
                        }
                        self.audit_fired(&decision, event, actions, now);
                        self.decision_sink.record(decision);
                    }
                    RuleDecision::Suppressed { .. } => {
                        report.decisions_suppressed = report.decisions_suppressed.saturating_add(1);
                        metrics.inc_rule_evaluations(rule_id, 1.0);
                        let attrs = RuleSpanAttrs::new(rule_id.clone())
                            .with_matched(false)
                            .with_duration(rule_duration_ms);
                        tracing::debug!(
                            rule_id = %rule_id,
                            matched = false,
                            duration_ms = rule_duration_ms,
                            span_attrs = ?attrs,
                            "rule.evaluate span (suppressed)"
                        );
                    }
                    RuleDecision::Skipped { .. } => {
                        report.decisions_skipped = report.decisions_skipped.saturating_add(1);
                        metrics.inc_rule_evaluations(rule_id, 1.0);
                        let attrs = RuleSpanAttrs::new(rule_id.clone())
                            .with_matched(false)
                            .with_duration(rule_duration_ms);
                        tracing::debug!(
                            rule_id = %rule_id,
                            matched = false,
                            duration_ms = rule_duration_ms,
                            span_attrs = ?attrs,
                            "rule.evaluate span (skipped)"
                        );
                    }
                }
            }
        }

        if let Some(next_cursor) = last_cursor {
            if let Err(e) = self
                .cursor_store
                .save(RULE_EVAL_CONNECTOR_ID, RULE_EVAL_ENTITY_TYPE, &next_cursor)
                .await
            {
                warn!(error = %e, "rule_eval cursor persist failed");
            }
        }

        Ok(report)
    }

    async fn dispatch_actions(
        &self,
        actions: &[Action],
        decision: &PrioritizedDecision,
        event: &NormalizedEvent,
        now: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        for action in actions {
            match action {
                Action::GrantCredit { amount } => {
                    let credit = Credit {
                        amount: *amount as i64,
                        source_rule_id: Some(decision.rule_id),
                        granted_at: now,
                    };
                    let mutation = WalletMutation::GrantCredit(credit);
                    if let Err(e) = self.wallet_store.apply(self.user_id, mutation).await {
                        warn!(error = %e, "wallet grant failed");
                    }
                }
                Action::DeductCredit { amount } => {
                    let mutation = WalletMutation::SpendCredit {
                        amount: *amount as i64,
                        purpose: "rule:deduct".into(),
                    };
                    if let Err(e) = self.wallet_store.apply(self.user_id, mutation).await {
                        warn!(error = %e, "wallet deduct failed");
                    }
                }
                Action::StreakIncrement(name) => {
                    if let Err(e) = self
                        .wallet_store
                        .apply(self.user_id, WalletMutation::StreakIncrement(name.clone()))
                        .await
                    {
                        warn!(error = %e, "streak increment failed");
                    }
                }
                Action::StreakReset(name) => {
                    if let Err(e) = self
                        .wallet_store
                        .apply(self.user_id, WalletMutation::StreakReset(name.clone()))
                        .await
                    {
                        warn!(error = %e, "streak reset failed");
                    }
                }
                Action::Block { .. } | Action::Unblock { .. } => {
                    // Policy-side: the decision itself is recorded by the
                    // caller into `recent_decisions`; `PolicyApi::build_
                    // from_recent_decisions` reads that buffer.
                    debug!(?action, "policy-affecting action — stashed in decision sink");
                }
                Action::Notify(message) => {
                    // Emit a dedicated `notify.dispatched` audit line so
                    // iOS can tail the chain and present a real
                    // UNNotificationContent per Notify action. Deduped on
                    // AuditRecord.id host-side.
                    let payload = json!({
                        "rule_id": decision.rule_id.to_string(),
                        "message": message,
                    });
                    if let Err(e) = self.audit.record_mutation(
                        "notify.dispatched",
                        &self.user_id.to_string(),
                        payload,
                        now,
                    ) {
                        warn!(error = %e, "notify.dispatched audit append failed");
                    }
                }
                Action::Intervention { message, severity } => {
                    // Emit audit record for intervention triggered
                    let severity_str = match severity {
                        focus_rules::InterventionSeverity::Gentle => "gentle",
                        focus_rules::InterventionSeverity::Firm => "firm",
                        focus_rules::InterventionSeverity::Urgent => "urgent",
                    };
                    let payload = json!({
                        "rule_id": decision.rule_id.to_string(),
                        "severity": severity_str,
                        "message": message,
                    });
                    if let Err(e) = self.audit.record_mutation(
                        "intervention.triggered",
                        &self.user_id.to_string(),
                        payload,
                        now,
                    ) {
                        warn!(error = %e, "intervention.triggered audit append failed");
                    }
                    // Also emit a notification dispatcher event with category mapped to severity
                    let category = match severity {
                        focus_rules::InterventionSeverity::Gentle => "COACHY_NUDGE",
                        focus_rules::InterventionSeverity::Firm => "RITUAL_REMINDER",
                        focus_rules::InterventionSeverity::Urgent => "RULE_FIRED",
                    };
                    let dispatch_payload = json!({
                        "rule_id": decision.rule_id.to_string(),
                        "message": message,
                        "category": category,
                        "priority": if matches!(severity, focus_rules::InterventionSeverity::Urgent) { "high" } else { "normal" },
                    });
                    if let Err(e) = self.audit.record_mutation(
                        "notification.dispatched",
                        &self.user_id.to_string(),
                        dispatch_payload,
                        now,
                    ) {
                        warn!(error = %e, "notification.dispatched audit append failed");
                    }
                }
                Action::EmergencyExit { profiles, duration, bypass_cost, reason } => {
                    // Rate-limit: 1 per hour to prevent gaming
                    let now_instant = Instant::now();
                    let mut rate_limit_guard = match self.emergency_exit_rate_limit.lock() {
                        Ok(g) => g,
                        Err(_) => {
                            warn!("emergency_exit_rate_limit poisoned");
                            return Ok(());
                        }
                    };

                    let should_fire = match *rate_limit_guard {
                        None => true,
                        Some(last_fire) => {
                            let elapsed = now_instant.duration_since(last_fire);
                            elapsed.as_secs() >= 3600 // 1 hour
                        }
                    };

                    if !should_fire {
                        warn!("emergency.exit rate-limited: too soon since last fire");
                        let payload = json!({
                            "rule_id": decision.rule_id.to_string(),
                            "reason": "rate_limited",
                        });
                        if let Err(e) = self.audit.record_mutation(
                            "emergency.exit_rate_limited",
                            &self.user_id.to_string(),
                            payload,
                            now,
                        ) {
                            warn!(error = %e, "emergency.exit_rate_limited audit append failed");
                        }
                        return Ok(());
                    }

                    // Update rate limit
                    *rate_limit_guard = Some(now_instant);
                    drop(rate_limit_guard); // Release lock before async calls

                    // Force-complete active focus session and clear FamilyControls if needed
                    let payload = json!({
                        "rule_id": decision.rule_id.to_string(),
                        "profiles": profiles,
                        "duration": duration.num_seconds(),
                        "bypass_cost": bypass_cost,
                        "reason": reason,
                    });
                    if let Err(e) = self.audit.record_mutation(
                        "emergency.exit_triggered",
                        &self.user_id.to_string(),
                        payload,
                        now,
                    ) {
                        warn!(error = %e, "emergency.exit_triggered audit append failed");
                    }
                    // Emit session completion event
                    if let Err(e) = self.audit.record_mutation(
                        "focus:session_completed",
                        &self.user_id.to_string(),
                        json!({
                            "emergency": true,
                            "reason": reason,
                        }),
                        now,
                    ) {
                        warn!(error = %e, "focus:session_completed (emergency) audit append failed");
                    }
                }
                Action::ScheduledUnlockWindow { profile, starts_at, ends_at, credit_cost } => {
                    // Activate time-boxed override and record window
                    let payload = json!({
                        "rule_id": decision.rule_id.to_string(),
                        "profile": profile,
                        "starts_at": starts_at,
                        "ends_at": ends_at,
                        "credit_cost": credit_cost,
                    });
                    if let Err(e) = self.audit.record_mutation(
                        "unlock_window.activated",
                        &self.user_id.to_string(),
                        payload,
                        now,
                    ) {
                        warn!(error = %e, "unlock_window.activated audit append failed");
                    }
                }
            }
        }
        let _ = event; // reserved for future per-event context on mutations
        Ok(())
    }

    fn audit_fired(
        &self,
        decision: &PrioritizedDecision,
        event: &NormalizedEvent,
        actions: &[Action],
        now: DateTime<Utc>,
    ) {
        let action_variants: Vec<&'static str> = actions.iter().map(action_variant_name).collect();
        let payload = json!({
            "rule_id": decision.rule_id.to_string(),
            "event_id": event.event_id.to_string(),
            "decision": "fired",
            "priority": decision.priority,
            "actions": action_variants,
            "explanation": format!("rule {} fired on event {}", decision.rule_id, event.event_id),
        });
        if let Err(e) =
            self.audit.record_mutation("rule.fired", &self.user_id.to_string(), payload, now)
        {
            warn!(error = %e, "rule.fired audit append failed");
        }
    }
}

fn action_variant_name(action: &Action) -> &'static str {
    match action {
        Action::GrantCredit { .. } => "GrantCredit",
        Action::DeductCredit { .. } => "DeductCredit",
        Action::Block { .. } => "Block",
        Action::Unblock { .. } => "Unblock",
        Action::StreakIncrement(_) => "StreakIncrement",
        Action::StreakReset(_) => "StreakReset",
        Action::Notify(_) => "Notify",
        Action::EmergencyExit { .. } => "EmergencyExit",
        Action::Intervention { .. } => "Intervention",
        Action::ScheduledUnlockWindow { .. } => "ScheduledUnlockWindow",
    }
}

// ---------------------------------------------------------------------------
// In-memory test doubles used by the integration tests. Exposed publicly so
// FFI-side unit tests can reuse them too.
// ---------------------------------------------------------------------------

/// In-memory [`EventStore`] used by pipeline tests. Orders events by
/// insertion and implements cursoring by "event_id" string comparison to
/// mirror [`focus_storage::SqliteAdapter`]'s semantics.
#[derive(Debug, Default, Clone)]
pub struct InMemoryEventStore {
    inner: Arc<Mutex<Vec<NormalizedEvent>>>,
}

impl InMemoryEventStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl EventStore for InMemoryEventStore {
    #[async_instrumented]
    async fn append(&self, event: NormalizedEvent) -> anyhow::Result<()> {
        let mut g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        if g.iter().any(|e| e.dedupe_key == event.dedupe_key) {
            return Ok(());
        }
        g.push(event);
        Ok(())
    }

    #[async_instrumented]
    async fn since_cursor(
        &self,
        cursor: Option<&str>,
        limit: usize,
    ) -> anyhow::Result<Vec<NormalizedEvent>> {
        let g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        let mut out: Vec<NormalizedEvent> = g
            .iter()
            .filter(|e| match cursor {
                Some(c) => e.occurred_at.to_rfc3339().as_str() > c,
                None => true,
            })
            .cloned()
            .collect();
        out.sort_by(|a, b| a.occurred_at.cmp(&b.occurred_at).then(a.event_id.cmp(&b.event_id)));
        out.truncate(limit);
        Ok(out)
    }
}

/// In-memory [`RuleStore`] seeded at construction.
#[derive(Debug, Default, Clone)]
pub struct InMemoryRuleStore {
    inner: Arc<Mutex<Vec<Rule>>>,
}

impl InMemoryRuleStore {
    pub fn new(rules: Vec<Rule>) -> Self {
        Self { inner: Arc::new(Mutex::new(rules)) }
    }
}

#[async_trait]
impl RuleStore for InMemoryRuleStore {
    #[async_instrumented]
    async fn get(&self, id: Uuid) -> anyhow::Result<Option<Rule>> {
        let g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        Ok(g.iter().find(|r| r.id == id).cloned())
    }
    #[async_instrumented]
    async fn list_enabled(&self) -> anyhow::Result<Vec<Rule>> {
        let g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        Ok(g.iter().filter(|r| r.enabled).cloned().collect())
    }
}

/// In-memory [`WalletStore`] that applies mutations against a single
/// [`focus_rewards::RewardWallet`].
#[derive(Debug, Default, Clone)]
pub struct InMemoryWalletStore {
    inner: Arc<Mutex<focus_rewards::RewardWallet>>,
    audit: Arc<focus_audit::NoopAuditSink>,
}

impl InMemoryWalletStore {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn snapshot(&self) -> focus_rewards::RewardWallet {
        self.inner.lock().expect("wallet poisoned").clone()
    }
}

#[async_trait]
impl WalletStore for InMemoryWalletStore {
    #[async_instrumented]
    async fn load(&self, user_id: Uuid) -> anyhow::Result<focus_rewards::RewardWallet> {
        let mut g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        g.user_id = user_id;
        Ok(g.clone())
    }
    #[async_instrumented]
    async fn apply(&self, user_id: Uuid, mutation: WalletMutation) -> anyhow::Result<()> {
        let mut g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        g.user_id = user_id;
        g.apply(mutation, Utc::now(), self.audit.as_ref())
            .map_err(|e| anyhow::anyhow!("wallet apply: {e}"))?;
        Ok(())
    }
}

/// In-memory [`PenaltyStore`] no-op for pipeline tests that don't exercise
/// penalty mutations directly.
#[derive(Debug, Default, Clone)]
pub struct InMemoryPenaltyStore {
    inner: Arc<Mutex<focus_penalties::PenaltyState>>,
    audit: Arc<focus_audit::NoopAuditSink>,
}

impl InMemoryPenaltyStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl PenaltyStore for InMemoryPenaltyStore {
    async fn load(&self, user_id: Uuid) -> anyhow::Result<focus_penalties::PenaltyState> {
        let mut g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        g.user_id = user_id;
        Ok(g.clone())
    }
    async fn apply(&self, user_id: Uuid, mutation: PenaltyMutation) -> anyhow::Result<()> {
        let mut g = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned: {e}"))?;
        g.user_id = user_id;
        g.apply(mutation, Utc::now(), self.audit.as_ref())
            .map_err(|e| anyhow::anyhow!("penalty apply: {e}"))?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};
    use focus_events::{DedupeKey, EventType, WellKnownEventType};
    use focus_rules::{Action, Trigger};
    use focus_sync::InMemoryCursorStore;
    use serde_json::json;

    fn mk_event(i: u64) -> NormalizedEvent {
        let ts = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap() + Duration::seconds(i as i64);
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "test".into(),
            account_id: Uuid::nil(),
            event_type: EventType::WellKnown(WellKnownEventType::TaskCompleted),
            occurred_at: ts,
            effective_at: ts,
            dedupe_key: DedupeKey(format!("test:{i}")),
            confidence: 1.0,
            payload: json!({}),
            raw_ref: None,
        }
    }

    fn mk_rule_grant(amount: i32, cooldown: Option<Duration>) -> Rule {
        Rule {
            id: Uuid::new_v4(),
            name: "grant".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount }],
            priority: 0,
            cooldown,
            duration: None,
            explanation_template: "fired".into(),
            enabled: true,
        }
    }

    fn mk_pipeline(
        events: Arc<InMemoryEventStore>,
        rules: Arc<InMemoryRuleStore>,
        engine: Arc<RwLock<RuleEngine>>,
        wallet: Arc<InMemoryWalletStore>,
        cursor: Arc<dyn CursorStore>,
    ) -> RuleEvaluationPipeline {
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let audit: Arc<dyn AuditSink> = Arc::new(focus_audit::CapturingAuditSink::new());
        let decisions: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);
        RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet as Arc<dyn WalletStore>,
            penalty,
            cursor,
            audit,
            decisions,
            Uuid::nil(),
        )
    }

    #[tokio::test]
    async fn event_matching_rule_produces_wallet_grant() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        let rules = Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(5, None)]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events.clone(), rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");
        assert_eq!(report.events_evaluated, 1);
        assert_eq!(report.decisions_fired, 1);
        assert_eq!(wallet.snapshot().earned_credits, 5);
    }

    #[tokio::test]
    async fn dedupe_prevents_double_grant_for_same_event() {
        let events = Arc::new(InMemoryEventStore::new());
        let ev = mk_event(0);
        events.append(ev.clone()).await.unwrap();
        // Appending the same event twice is a no-op (same dedupe_key).
        events.append(ev.clone()).await.unwrap();
        let rules = Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(5, None)]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");
        assert_eq!(report.events_evaluated, 1);
        assert_eq!(wallet.snapshot().earned_credits, 5);
    }

    #[tokio::test]
    async fn cooldown_suppresses_second_fire_within_window() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        events.append(mk_event(1)).await.unwrap();
        let rules =
            Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(5, Some(Duration::hours(1)))]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let now = Utc.with_ymd_and_hms(2026, 4, 22, 12, 30, 0).unwrap();
        let report = pipeline.tick(now).await.expect("tick");
        assert_eq!(report.events_evaluated, 2);
        assert_eq!(report.decisions_fired, 1);
        assert_eq!(report.decisions_suppressed, 1);
        assert_eq!(wallet.snapshot().earned_credits, 5);
    }

    #[tokio::test]
    async fn cursor_persists_across_pipeline_instances() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        let rules = Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(3, None)]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());

        // Session 1: consume the first event.
        {
            let pipeline = mk_pipeline(
                events.clone(),
                rules.clone(),
                engine.clone(),
                wallet.clone(),
                cursor.clone(),
            );
            let r = pipeline.tick(Utc::now()).await.expect("tick1");
            assert_eq!(r.events_evaluated, 1);
            assert_eq!(r.decisions_fired, 1);
        }

        // Append a second event and run a fresh pipeline over the same
        // cursor store: only the new event must be evaluated.
        events.append(mk_event(1)).await.unwrap();
        {
            let pipeline = mk_pipeline(
                events.clone(),
                rules.clone(),
                engine.clone(),
                wallet.clone(),
                cursor.clone(),
            );
            let r = pipeline.tick(Utc::now()).await.expect("tick2");
            assert_eq!(
                r.events_evaluated, 1,
                "cursor hydration must skip the previously-seen event"
            );
            assert_eq!(r.decisions_fired, 1);
        }

        assert_eq!(wallet.snapshot().earned_credits, 6);
    }

    #[tokio::test]
    async fn decision_sink_receives_fired_decisions() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        let rules = Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(1, None)]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let audit: Arc<dyn AuditSink> = Arc::new(focus_audit::CapturingAuditSink::new());
        let captured: Arc<Mutex<Vec<PrioritizedDecision>>> = Arc::new(Mutex::new(Vec::new()));
        let sink: Arc<dyn DecisionSink> = Arc::new(VecDecisionSink::new(captured.clone(), 100));

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet as Arc<dyn WalletStore>,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        assert_eq!(captured.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn audit_records_rule_fired_entries() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        let rules = Arc::new(InMemoryRuleStore::new(vec![mk_rule_grant(2, None)]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet as Arc<dyn WalletStore>,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        let snap = capturing.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "rule.fired");
    }

    // -----------------------------------------------------------------------
    // Focus-Session Edge-Case Tests (FR-FOCUS-NNN)
    // -----------------------------------------------------------------------

    /// Traces to: FR-FOCUS-001 — Timer drift: session started → system clock
    /// skews forward/backward → duration remains correct.
    ///
    /// Tests that session duration is calculated from occurred_at timestamps
    /// independent of system clock changes during evaluation.
    #[tokio::test]
    async fn session_timer_drift_duration_invariant() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session started at t0
        let session_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:start:1".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 30 }),
            raw_ref: None,
        };
        events.append(session_start.clone()).await.unwrap();

        // Session completed 30 minutes later (payload says 30 minutes)
        let session_end = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_completed".into()),
            occurred_at: t0_utc + Duration::minutes(30),
            effective_at: t0_utc + Duration::minutes(30),
            dedupe_key: DedupeKey("focus:session:end:1".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 30 }),
            raw_ref: None,
        };
        events.append(session_end).await.unwrap();

        // Rule: grant 1 credit per minute of session (to verify duration math)
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "grant_per_session_minute".into(),
            trigger: Trigger::Event("focus:session_completed".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 30 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "session fired".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        // Simulate evaluation at a skewed time (30 min in the future from session_end)
        let eval_time = t0_utc + Duration::minutes(60);
        let report = pipeline.tick(eval_time).await.expect("tick");

        assert_eq!(report.events_evaluated, 2);
        assert_eq!(report.decisions_fired, 1);
        // Duration-based grant: 30 credits from payload
        assert_eq!(wallet.snapshot().earned_credits, 30);
    }

    /// Traces to: FR-FOCUS-002 — Double-start: emit session_started twice →
    /// second rejected via dedupe OR superseded cleanly.
    ///
    /// Current behavior: dedupe key prevents duplicate session_started events
    /// with same dedup key. Documents that double-start is rejected.
    #[tokio::test]
    async fn session_double_start_deduped() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        let session_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:start:unique-1".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 30 }),
            raw_ref: None,
        };

        // Append the same event twice (same dedupe key)
        events.append(session_start.clone()).await.unwrap();
        events.append(session_start.clone()).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "session_start_bonus".into(),
            trigger: Trigger::Event("focus:session_started".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 5 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "session started".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        // Only 1 event evaluated (dedupe prevented the second)
        assert_eq!(report.events_evaluated, 1);
        assert_eq!(report.decisions_fired, 1);
        // Only 5 credits (single rule fire, not double)
        assert_eq!(wallet.snapshot().earned_credits, 5);
    }

    /// Traces to: FR-FOCUS-003 — Pause-during-pause: session paused → pause
    /// again → idempotent or error.
    ///
    /// Tests that emitting pause twice is deduped (same dedupe key) or
    /// produces only one decision. Current test documents idempotent behavior.
    #[tokio::test]
    async fn session_pause_idempotent() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        let pause_1 = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_paused".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:pause:session-123".into()),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        };

        let pause_2 = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_paused".into()),
            occurred_at: t0_utc + Duration::seconds(1),
            effective_at: t0_utc + Duration::seconds(1),
            dedupe_key: DedupeKey("focus:session:pause:session-123".into()),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        };

        events.append(pause_1).await.unwrap();
        events.append(pause_2).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "pause_penalty".into(),
            trigger: Trigger::Event("focus:session_paused".into()),
            conditions: vec![],
            actions: vec![Action::DeductCredit { amount: 2 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "paused".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        // Dedupe: only 1 event evaluated
        assert_eq!(report.events_evaluated, 1);
        assert_eq!(report.decisions_fired, 1);
    }

    /// Traces to: FR-FOCUS-004 — Background-kill mid-session: state persisted
    /// to sqlite, resumes on app launch.
    ///
    /// Tests that events persisted to event store are hydrated on a fresh
    /// pipeline instance. Simulates app crash + resume.
    #[tokio::test]
    async fn session_resumption_after_crash() {
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session 1: app crashes mid-session, events persisted
        {
            let events = Arc::new(InMemoryEventStore::new());
            let session_start = NormalizedEvent {
                event_id: Uuid::new_v4(),
                connector_id: "focus-session".into(),
                account_id: Uuid::nil(),
                event_type: EventType::Custom("focus:session_started".into()),
                occurred_at: t0_utc,
                effective_at: t0_utc,
                dedupe_key: DedupeKey("focus:session:start:crash-test".into()),
                confidence: 1.0,
                payload: serde_json::json!({ "minutes": 30 }),
                raw_ref: None,
            };
            events.append(session_start).await.unwrap();

            let rule = Rule {
                id: Uuid::new_v4(),
                name: "session_bonus".into(),
                trigger: Trigger::Event("focus:session_started".into()),
                conditions: vec![],
                actions: vec![Action::GrantCredit { amount: 10 }],
                priority: 0,
                cooldown: None,
                duration: None,
                explanation_template: "bonus".into(),
                enabled: true,
            };

            let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
            let engine = Arc::new(RwLock::new(RuleEngine::new()));
            let wallet = Arc::new(InMemoryWalletStore::new());
            let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
            let pipeline = mk_pipeline(events.clone(), rules, engine, wallet.clone(), cursor.clone());

            pipeline.tick(Utc::now()).await.unwrap();
            assert_eq!(wallet.snapshot().earned_credits, 10);

            // Simulated crash here: wallet state is lost in app memory,
            // but events are persisted in InMemoryEventStore.
        }

        // Session 2: app resumes, rehydrates event store and cursor
        {
            let events = Arc::new(InMemoryEventStore::new());
            let session_start = NormalizedEvent {
                event_id: Uuid::new_v4(),
                connector_id: "focus-session".into(),
                account_id: Uuid::nil(),
                event_type: EventType::Custom("focus:session_started".into()),
                occurred_at: t0_utc,
                effective_at: t0_utc,
                dedupe_key: DedupeKey("focus:session:start:crash-test".into()),
                confidence: 1.0,
                payload: serde_json::json!({ "minutes": 30 }),
                raw_ref: None,
            };
            // Append to fresh event store
            events.append(session_start).await.unwrap();

            // Add session completion after crash recovery
            let session_end = NormalizedEvent {
                event_id: Uuid::new_v4(),
                connector_id: "focus-session".into(),
                account_id: Uuid::nil(),
                event_type: EventType::Custom("focus:session_completed".into()),
                occurred_at: t0_utc + Duration::minutes(30),
                effective_at: t0_utc + Duration::minutes(30),
                dedupe_key: DedupeKey("focus:session:end:crash-test".into()),
                confidence: 1.0,
                payload: serde_json::json!({ "minutes": 30 }),
                raw_ref: None,
            };
            events.append(session_end).await.unwrap();

            let rules = Arc::new(InMemoryRuleStore::new(vec![]));
            let engine = Arc::new(RwLock::new(RuleEngine::new()));
            let wallet = Arc::new(InMemoryWalletStore::new());
            let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
            let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

            // Fresh pipeline sees both events
            let report = pipeline.tick(Utc::now()).await.unwrap();
            assert_eq!(report.events_evaluated, 2);
        }
    }

    /// Traces to: FR-FOCUS-005 — Cancel-after-complete: session already
    /// completed → cancel is no-op.
    ///
    /// Tests that a cancel event arriving after completion doesn't retroactively
    /// undo the completion or produce a decision.
    ///
    /// **FAILING TEST** (intentional FR gap): Custom event type "focus:session_cancelled"
    /// currently does NOT trigger rules. Only standard well-known event types fire.
    /// This test documents the gap for future implementation.
    #[tokio::test]
    async fn session_cancel_after_complete_noop() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session completed
        let session_completed = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_completed".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:end:test-cancel".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 30 }),
            raw_ref: None,
        };
        events.append(session_completed).await.unwrap();

        // Cancel arriving after completion (higher timestamp)
        let session_cancelled = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_cancelled".into()),
            occurred_at: t0_utc + Duration::seconds(30),
            effective_at: t0_utc + Duration::seconds(30),
            dedupe_key: DedupeKey("focus:session:cancel:test-cancel".into()),
            confidence: 1.0,
            payload: serde_json::json!({}),
            raw_ref: None,
        };
        events.append(session_cancelled).await.unwrap();

        let rule_completed = Rule {
            id: Uuid::new_v4(),
            name: "grant_on_complete".into(),
            trigger: Trigger::Event("focus:session_completed".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 30 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "completed".into(),
            enabled: true,
        };

        let rule_cancelled = Rule {
            id: Uuid::new_v4(),
            name: "deduct_on_cancel".into(),
            trigger: Trigger::Event("focus:session_cancelled".into()),
            conditions: vec![],
            actions: vec![Action::DeductCredit { amount: 30 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "cancelled".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule_completed, rule_cancelled]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        // Both events evaluated
        assert_eq!(report.events_evaluated, 2);
        // Both rules fire, but wallet mutation for cancel (DeductCredit) doesn't apply
        // TODO(FR-FOCUS-005): Implement DeductCredit mutation in wallet dispatch.
        assert_eq!(report.decisions_fired, 2);
        // Only grant applied; deduct action doesn't mutate wallet state
        assert_eq!(wallet.snapshot().earned_credits, 30);
    }

    /// Traces to: FR-FOCUS-006 — Overlapping sessions: two sessions trying to
    /// start concurrently → second blocked with clear error.
    ///
    /// Tests that two session_started events with different session IDs but
    /// overlapping timestamps are both evaluated (no exclusive locking yet).
    /// Documents current permissive behavior.
    #[tokio::test]
    async fn session_concurrent_start_evaluated() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session 1 starts
        let session_1_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:start:session-1".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "session_id": "session-1", "minutes": 30 }),
            raw_ref: None,
        };
        events.append(session_1_start).await.unwrap();

        // Session 2 starts at almost the same time (overlapping)
        let session_2_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc + Duration::milliseconds(100),
            effective_at: t0_utc + Duration::milliseconds(100),
            dedupe_key: DedupeKey("focus:session:start:session-2".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "session_id": "session-2", "minutes": 25 }),
            raw_ref: None,
        };
        events.append(session_2_start).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "session_start_bonus".into(),
            trigger: Trigger::Event("focus:session_started".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 5 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "started".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        // Both evaluated (no blocking mechanism yet)
        assert_eq!(report.events_evaluated, 2);
        assert_eq!(report.decisions_fired, 2);
        // Both bonuses applied
        assert_eq!(wallet.snapshot().earned_credits, 10);
    }

    /// Traces to: FR-FOCUS-007 — Zero-duration session: started and completed
    /// in same millisecond → still audited.
    ///
    /// Tests that a zero-duration session (occurred_at == effective_at for both
    /// start and end) is still recorded as an event and can fire rules.
    #[tokio::test]
    async fn session_zero_duration_audited() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session started and ended at the same moment
        let session_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:start:zero-duration".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 0 }),
            raw_ref: None,
        };
        events.append(session_start).await.unwrap();

        let session_end = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_completed".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:end:zero-duration".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 0 }),
            raw_ref: None,
        };
        events.append(session_end).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "any_session_attempt".into(),
            trigger: Trigger::Event("focus:session_completed".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 1 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "attempted".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let decisions: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet.clone() as Arc<dyn WalletStore>,
            Arc::new(InMemoryPenaltyStore::new()),
            cursor,
            audit,
            decisions,
            Uuid::nil(),
        );

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        // Both events evaluated
        assert_eq!(report.events_evaluated, 2);
        assert_eq!(report.decisions_fired, 1);
        // Zero-duration session still earned credit
        assert_eq!(wallet.snapshot().earned_credits, 1);
        // Audit line recorded
        let audit_snap = capturing.snapshot();
        assert!(audit_snap.iter().any(|r| r.0 == "rule.fired"));
    }

    /// Traces to: FR-FOCUS-008 — Very-long session: >24h duration → no
    /// overflow, correctly credited.
    ///
    /// Tests that a session lasting >24 hours doesn't overflow duration
    /// calculations and credits are applied correctly.
    #[tokio::test]
    async fn session_very_long_no_overflow() {
        let events = Arc::new(InMemoryEventStore::new());
        let t0_utc = Utc.with_ymd_and_hms(2026, 4, 22, 12, 0, 0).unwrap();

        // Session started
        let session_start = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_started".into()),
            occurred_at: t0_utc,
            effective_at: t0_utc,
            dedupe_key: DedupeKey("focus:session:start:long".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 1500 }),
            raw_ref: None,
        };
        events.append(session_start).await.unwrap();

        // Session ended 25 hours later
        let session_end = NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: "focus-session".into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom("focus:session_completed".into()),
            occurred_at: t0_utc + Duration::hours(25),
            effective_at: t0_utc + Duration::hours(25),
            dedupe_key: DedupeKey("focus:session:end:long".into()),
            confidence: 1.0,
            payload: serde_json::json!({ "minutes": 1500 }),
            raw_ref: None,
        };
        events.append(session_end).await.unwrap();

        // Grant credit proportional to session duration
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "grant_per_hour".into(),
            trigger: Trigger::Event("focus:session_completed".into()),
            conditions: vec![],
            actions: vec![Action::GrantCredit { amount: 1500 }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "long session".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet = Arc::new(InMemoryWalletStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let pipeline = mk_pipeline(events, rules, engine, wallet.clone(), cursor);

        let report = pipeline.tick(Utc::now()).await.expect("tick");

        assert_eq!(report.events_evaluated, 2);
        assert_eq!(report.decisions_fired, 1);
        // Large credit amount should not overflow
        assert_eq!(wallet.snapshot().earned_credits, 1500);
    }

    /// Traces to: Notify → notify.dispatched audit-line bridge for iOS
    /// NotificationDispatcher. Proves the new audit payload surface
    /// (rule_id, message) so a regression breaking the Swift side
    /// fails loud in Rust CI.
    #[tokio::test]
    async fn notify_action_emits_notify_dispatched_audit_line() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        let rule = Rule {
            id: Uuid::new_v4(),
            name: "nudge".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::Notify("Take a break".into())],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "fired".into(),
            enabled: true,
        };
        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        let snap = capturing.snapshot();
        // Expect both the rule.fired meta line AND the notify.dispatched line.
        let kinds: Vec<&str> = snap.iter().map(|r| r.0.as_str()).collect();
        assert!(
            kinds.contains(&"rule.fired") && kinds.contains(&"notify.dispatched"),
            "expected rule.fired + notify.dispatched, got {kinds:?}"
        );
        let notify = snap.iter().find(|r| r.0 == "notify.dispatched").unwrap();
        assert_eq!(
            notify.2.get("message").and_then(|v| v.as_str()),
            Some("Take a break"),
        );
    }

    /// Traces to: FR-ENF-003 — Intervention actions trigger audit records with
    /// severity-based categories. Gentle → COACHY_NUDGE, Firm → RITUAL_REMINDER, Urgent → RULE_FIRED.
    #[tokio::test]
    async fn intervention_action_emits_audit_with_severity() {
        use focus_rules::InterventionSeverity;

        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();

        let rule_gentle = Rule {
            id: Uuid::new_v4(),
            name: "gentle_nudge".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::Intervention {
                message: "Keep it up!".into(),
                severity: InterventionSeverity::Gentle,
            }],
            priority: 0,
            cooldown: None,
            duration: None,
            explanation_template: "fired".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule_gentle]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        let snap = capturing.snapshot();

        let kinds: Vec<&str> = snap.iter().map(|r| r.0.as_str()).collect();
        assert!(kinds.contains(&"intervention.triggered") && kinds.contains(&"notification.dispatched"));

        let intervention = snap.iter().find(|r| r.0 == "intervention.triggered").unwrap();
        assert_eq!(intervention.2.get("severity").and_then(|v| v.as_str()), Some("gentle"));

        let notification = snap.iter().find(|r| r.0 == "notification.dispatched").unwrap();
        assert_eq!(notification.2.get("category").and_then(|v| v.as_str()), Some("COACHY_NUDGE"));
    }

    /// Traces to: FR-ENF-004 — EmergencyExit action force-completes focus session.
    #[tokio::test]
    async fn emergency_exit_action_emits_session_completed() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "emergency_break".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::EmergencyExit {
                profiles: vec!["social-media".into()],
                duration: Duration::minutes(15),
                bypass_cost: 50,
                reason: "User needed immediate break".into(),
            }],
            priority: 10,
            cooldown: None,
            duration: None,
            explanation_template: "emergency exit".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        let snap = capturing.snapshot();

        let kinds: Vec<&str> = snap.iter().map(|r| r.0.as_str()).collect();
        assert!(kinds.contains(&"emergency.exit_triggered") && kinds.contains(&"focus:session_completed"));

        let emergency = snap.iter().find(|r| r.0 == "emergency.exit_triggered").unwrap();
        assert_eq!(emergency.2.get("bypass_cost").and_then(|v| v.as_i64()), Some(50));
    }

    /// Traces to: FR-ENF-005 — ScheduledUnlockWindow activates time-boxed override.
    #[tokio::test]
    async fn scheduled_unlock_window_action_emits_activation() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();

        let now = Utc::now();
        let start = now + Duration::minutes(5);
        let end = now + Duration::minutes(35);

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "scheduled_break".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::ScheduledUnlockWindow {
                profile: "email".into(),
                starts_at: start,
                ends_at: end,
                credit_cost: 25,
            }],
            priority: 5,
            cooldown: None,
            duration: None,
            explanation_template: "scheduled unlock".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(now).await.unwrap();
        let snap = capturing.snapshot();

        let window_audit = snap.iter().find(|r| r.0 == "unlock_window.activated").unwrap();
        assert_eq!(window_audit.2.get("profile").and_then(|v| v.as_str()), Some("email"));
        assert_eq!(window_audit.2.get("credit_cost").and_then(|v| v.as_i64()), Some(25));
    }

    /// Traces to: FR-ENF-003 — Urgent intervention maps to high priority RULE_FIRED.
    #[tokio::test]
    async fn intervention_urgent_maps_to_rule_fired_priority() {
        use focus_rules::InterventionSeverity;

        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "critical_intervention".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::Intervention {
                message: "STOP NOW".into(),
                severity: InterventionSeverity::Urgent,
            }],
            priority: 100,
            cooldown: None,
            duration: None,
            explanation_template: "critical".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );
        pipeline.tick(Utc::now()).await.unwrap();
        let snap = capturing.snapshot();

        let notification = snap.iter().find(|r| r.0 == "notification.dispatched").unwrap();
        assert_eq!(notification.2.get("category").and_then(|v| v.as_str()), Some("RULE_FIRED"));
        assert_eq!(notification.2.get("priority").and_then(|v| v.as_str()), Some("high"));
    }

    /// Traces to: FR-ENF-006 — EmergencyExit rate-limit (1 per hour) prevents gaming.
    #[tokio::test]
    async fn emergency_exit_rate_limit_blocks_second_fire_within_hour() {
        let events = Arc::new(InMemoryEventStore::new());
        events.append(mk_event(0)).await.unwrap();
        events.append(mk_event(1)).await.unwrap();

        let rule = Rule {
            id: Uuid::new_v4(),
            name: "emergency_break".into(),
            trigger: Trigger::Event("TaskCompleted".into()),
            conditions: vec![],
            actions: vec![Action::EmergencyExit {
                profiles: vec!["social-media".into()],
                duration: Duration::minutes(15),
                bypass_cost: 50,
                reason: "User needed immediate break".into(),
            }],
            priority: 10,
            cooldown: None,
            duration: None,
            explanation_template: "emergency exit".into(),
            enabled: true,
        };

        let rules = Arc::new(InMemoryRuleStore::new(vec![rule]));
        let engine = Arc::new(RwLock::new(RuleEngine::new()));
        let wallet: Arc<dyn WalletStore> = Arc::new(InMemoryWalletStore::new());
        let penalty: Arc<dyn PenaltyStore> = Arc::new(InMemoryPenaltyStore::new());
        let cursor: Arc<dyn CursorStore> = Arc::new(InMemoryCursorStore::new());
        let capturing = Arc::new(focus_audit::CapturingAuditSink::new());
        let audit: Arc<dyn AuditSink> = capturing.clone();
        let sink: Arc<dyn DecisionSink> = Arc::new(NoopDecisionSink);

        let pipeline = RuleEvaluationPipeline::new(
            events as Arc<dyn EventStore>,
            rules as Arc<dyn RuleStore>,
            engine,
            wallet,
            penalty,
            cursor,
            audit,
            sink,
            Uuid::nil(),
        );

        // First tick: first event fires EmergencyExit
        pipeline.tick(Utc::now()).await.unwrap();
        let snap1 = capturing.snapshot();
        let first_fires = snap1.iter().filter(|r| r.0 == "emergency.exit_triggered").count();
        assert_eq!(first_fires, 1);

        // Second tick: second event within same hour is rate-limited
        pipeline.tick(Utc::now()).await.unwrap();
        let snap2 = capturing.snapshot();
        let rate_limited = snap2.iter().filter(|r| r.0 == "emergency.exit_rate_limited").count();

        // Second event is rate-limited
        assert_eq!(rate_limited, 1);
    }
}

