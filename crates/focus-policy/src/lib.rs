// SPDX-License-Identifier: MIT OR Apache-2.0

//! Enforcement policy generation from rule decisions.
//!
//! Traces to FR-ENF-001.
//
// See focus-penalties for the rationale: `serde_json::json!` expands to a
// chain of infallible `.unwrap()` calls that clippy's disallowed_methods lint
// flags spuriously. Silence crate-wide.
#![allow(clippy::disallowed_methods)]

use chrono::{DateTime, Duration, Utc};
use focus_audit::AuditSink;
use focus_domain::Rigidity;
use focus_rules::{Action, PrioritizedDecision, RuleDecision};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnforcementPolicy {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub block_profile: BlockProfile,
    pub app_targets: Vec<AppTarget>,
    pub scheduled_windows: Vec<Window>,
    pub active: bool,
    /// Per-profile computed effective state (Block or Unblock).
    pub profile_states: HashMap<String, ProfileState>,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BlockProfile {
    pub name: String,
    pub categories: Vec<String>,
    pub exceptions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppTarget {
    Category(String),
    BundleId(String),
    PackageName(String),
    Domain(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProfileState {
    /// Profile is actively blocked; window describes duration.
    ///
    /// `rigidity` carries through from the firing `Action::Block`. Defaulted
    /// to `Hard` for serialized states authored before the rigidity spectrum
    /// existed. Traces to: FR-RIGIDITY-001.
    Blocked {
        ends_at: DateTime<Utc>,
        #[serde(default)]
        rigidity: Rigidity,
    },
    /// Profile explicitly unblocked by a higher-priority rule.
    Unblocked,
}

pub struct PolicyBuilder;

impl PolicyBuilder {
    pub fn new() -> Self {
        Self
    }

    /// Build an `EnforcementPolicy` from rule decisions without a
    /// profile→targets registry — `app_targets` will be empty. Prefer
    /// [`Self::from_rule_decisions_with_targets`] so the platform enforcement
    /// driver can actually know which bundle IDs / domains to block.
    pub fn from_rule_decisions(
        decisions: &[PrioritizedDecision],
        now: DateTime<Utc>,
        audit: &dyn AuditSink,
    ) -> EnforcementPolicy {
        Self::from_rule_decisions_with_targets(decisions, &HashMap::new(), now, audit)
    }

    /// Build an `EnforcementPolicy` from an ordered list of prioritized rule
    /// decisions plus a registry mapping profile names to the concrete
    /// [`AppTarget`]s the host platform should act on.
    ///
    /// Conflict rules (FR-ENF-001):
    /// * Within a single rule's action list, `Unblock{profile=X}` beats
    ///   `Block{profile=X}`.
    /// * Across rule decisions, the highest-priority rule wins. Callers pass
    ///   decisions in any order; we sort by `priority` descending, stable.
    /// * The union of targets from every `Blocked` profile becomes
    ///   `policy.app_targets`, deduped in insertion order.
    pub fn from_rule_decisions_with_targets(
        decisions: &[PrioritizedDecision],
        profile_targets: &HashMap<String, Vec<AppTarget>>,
        now: DateTime<Utc>,
        audit: &dyn AuditSink,
    ) -> EnforcementPolicy {
        // Sort a copy by descending priority, stable on input order.
        let mut sorted: Vec<&PrioritizedDecision> = decisions.iter().collect();
        sorted.sort_by_key(|pd| std::cmp::Reverse(pd.priority));

        let mut profile_states: HashMap<String, ProfileState> = HashMap::new();
        let mut scheduled_windows: Vec<Window> = Vec::new();

        for pd in sorted {
            let actions = match &pd.decision {
                RuleDecision::Fired(a) => a,
                _ => continue,
            };
            // Within a single decision, Unblock beats Block for same profile.
            let mut local: HashMap<String, ProfileState> = HashMap::new();
            for action in actions {
                match action {
                    Action::Block { profile, duration, rigidity } => {
                        let rigidity = rigidity.clone();
                        local.entry(profile.clone()).or_insert_with(|| ProfileState::Blocked {
                            ends_at: now + clamp_duration(*duration),
                            rigidity,
                        });
                    }
                    Action::Unblock { profile } => {
                        // Force-overwrite within the same decision.
                        local.insert(profile.clone(), ProfileState::Unblocked);
                    }
                    _ => {}
                }
            }
            // Merge: only set profile state if not already set by a
            // higher-priority decision.
            for (profile, state) in local {
                profile_states.entry(profile).or_insert(state);
            }
            // Accumulate scheduled windows for any Block action (informational).
            for action in actions {
                if let Action::Block { duration, .. } = action {
                    scheduled_windows
                        .push(Window { starts_at: now, ends_at: now + clamp_duration(*duration) });
                }
            }
        }

        let any_blocked =
            profile_states.values().any(|s| matches!(s, ProfileState::Blocked { .. }));

        // Union of targets across every Blocked profile, deduped in insertion
        // order. Only Blocked profiles contribute; Unblocked ones cannot
        // re-enable targets that were never enumerated here.
        let mut app_targets: Vec<AppTarget> = Vec::new();
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        for (profile, state) in &profile_states {
            if !matches!(state, ProfileState::Blocked { .. }) {
                continue;
            }
            if let Some(targets) = profile_targets.get(profile) {
                for t in targets {
                    let key = app_target_key(t);
                    if seen.insert(key) {
                        app_targets.push(t.clone());
                    }
                }
            }
        }

        let policy = EnforcementPolicy {
            id: uuid::Uuid::new_v4(),
            user_id: uuid::Uuid::nil(),
            block_profile: BlockProfile::default(),
            app_targets,
            scheduled_windows,
            active: any_blocked,
            profile_states,
            generated_at: now,
        };

        // Best-effort audit: a failed append shouldn't corrupt policy
        // construction (the function is infallible by type). Serialize a
        // compact summary: decision ids + profile states + active flag.
        let decision_ids: Vec<String> = decisions.iter().map(|d| d.rule_id.to_string()).collect();
        let states_json: HashMap<String, serde_json::Value> = policy
            .profile_states
            .iter()
            .map(|(k, v)| {
                let payload = match v {
                    ProfileState::Blocked { ends_at, rigidity } => {
                        json!({"state": "Blocked", "ends_at": ends_at, "rigidity": rigidity})
                    }
                    ProfileState::Unblocked => json!({"state": "Unblocked"}),
                };
                (k.clone(), payload)
            })
            .collect();
        let payload = json!({
            "policy_id": policy.id,
            "active": policy.active,
            "decision_ids": decision_ids,
            "profile_states": states_json,
        });
        // Swallow audit errors; construction is infallible. Callers that need
        // hard failure should wrap with their own sink impl that panics or
        // bubbles up via a thread-local.
        let _ = audit.record_mutation("policy.built", &policy.id.to_string(), payload, now);

        policy
    }
}

// ---------------------------------------------------------------------------
// EnforcementCallbackPort — inbound channel from the platform enforcement
// driver (iOS FamilyControls, Android AccessibilityService, macOS ScreenTime)
// back into the core so rules/rewards/penalties can react to observed user
// behaviour that the OS surfaces.
// ---------------------------------------------------------------------------

/// What the platform driver observed and is reporting back to the core.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EnforcementCallback {
    /// The driver successfully applied `policy_id`.
    ApplySucceeded { policy_id: uuid::Uuid, at: DateTime<Utc> },
    /// Apply failed with a reason the driver can share (e.g. user revoked
    /// FamilyControls authorization, Accessibility service killed).
    ApplyFailed { policy_id: uuid::Uuid, reason: String, at: DateTime<Utc> },
    /// Retract succeeded (policy no longer in effect).
    RetractSucceeded { policy_id: uuid::Uuid, at: DateTime<Utc> },
    /// User attempted to launch a target currently in a Blocked state.
    /// `target_key` is the stringified AppTarget (see `app_target_key`).
    BlockAttempted { target_key: String, profile: String, at: DateTime<Utc> },
    /// User invoked the bypass UI. Quote/confirmation is upstream; this is
    /// only the observed intent.
    BypassRequested { profile: String, at: DateTime<Utc> },
    /// The platform signalled that its own authorization was revoked (user
    /// turned off Screen Time / disabled Accessibility). Core should
    /// surface a reconnect prompt.
    AuthorizationRevoked { at: DateTime<Utc> },
}

/// Sink the platform enforcement driver calls to hand callbacks back to the
/// core. Every method must be callable from any thread (`Send + Sync`), and
/// the sink is expected to be cheap (drops into a channel / buffer).
pub trait EnforcementCallbackPort: Send + Sync {
    fn record(&self, cb: EnforcementCallback);
}

/// In-memory sink that stores every callback for later inspection. Tests
/// and the CLI use this; iOS / Android drive a real sink that forwards to
/// the events pipeline.
#[derive(Default)]
pub struct InMemoryEnforcementCallbackPort {
    inner: std::sync::Mutex<Vec<EnforcementCallback>>,
}

impl InMemoryEnforcementCallbackPort {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn snapshot(&self) -> Vec<EnforcementCallback> {
        self.inner.lock().expect("callback port poisoned").clone()
    }

    pub fn len(&self) -> usize {
        self.inner.lock().expect("callback port poisoned").len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl EnforcementCallbackPort for InMemoryEnforcementCallbackPort {
    fn record(&self, cb: EnforcementCallback) {
        self.inner.lock().expect("callback port poisoned").push(cb);
    }
}

/// Canonical string key for an [`AppTarget`] — used for dedupe in
/// [`PolicyBuilder`] and as the `target_key` in
/// [`EnforcementCallback::BlockAttempted`].
pub fn app_target_key(t: &AppTarget) -> String {
    match t {
        AppTarget::Category(s) => format!("category:{s}"),
        AppTarget::BundleId(s) => format!("bundle:{s}"),
        AppTarget::PackageName(s) => format!("package:{s}"),
        AppTarget::Domain(s) => format!("domain:{s}"),
    }
}

impl Default for PolicyBuilder {
    fn default() -> Self {
        Self::new()
    }
}

fn clamp_duration(d: Duration) -> Duration {
    if d < Duration::zero() {
        Duration::zero()
    } else {
        d
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use focus_audit::{CapturingAuditSink, NoopAuditSink};
    use focus_rules::{Action, PrioritizedDecision, RuleDecision};
    use uuid::Uuid;

    fn t() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap()
    }

    fn fired(priority: i32, actions: Vec<Action>) -> PrioritizedDecision {
        PrioritizedDecision {
            rule_id: Uuid::new_v4(),
            priority,
            decision: RuleDecision::Fired(actions),
        }
    }

    // Traces to: FR-ENF-001
    #[test]
    fn block_produces_active_policy() {
        let d = fired(
            10,
            vec![Action::Block {
                profile: "games".into(),
                duration: Duration::minutes(30),
                rigidity: Rigidity::Hard,
            }],
        );
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &NoopAuditSink);
        assert!(p.active);
        assert!(matches!(p.profile_states.get("games"), Some(ProfileState::Blocked { .. })));
    }

    // Traces to: FR-ENF-001
    #[test]
    fn unblock_within_same_decision_beats_block() {
        let d = fired(
            10,
            vec![
                Action::Block {
                    profile: "games".into(),
                    duration: Duration::minutes(30),
                    rigidity: Rigidity::Hard,
                },
                Action::Unblock { profile: "games".into() },
            ],
        );
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &NoopAuditSink);
        assert_eq!(p.profile_states.get("games"), Some(&ProfileState::Unblocked));
    }

    // Traces to: FR-ENF-001
    #[test]
    fn higher_priority_rule_wins_across_decisions() {
        let low = fired(1, vec![Action::Unblock { profile: "social".into() }]);
        let high = fired(
            100,
            vec![Action::Block {
                profile: "social".into(),
                duration: Duration::minutes(60),
                rigidity: Rigidity::Hard,
            }],
        );
        // Input order intentionally low-first to prove sort.
        let p = PolicyBuilder::from_rule_decisions(&[low, high], t(), &NoopAuditSink);
        assert!(matches!(p.profile_states.get("social"), Some(ProfileState::Blocked { .. })));
    }

    // Traces to: FR-ENF-001
    #[test]
    fn no_fired_decisions_yields_inactive_policy() {
        let skipped = PrioritizedDecision {
            rule_id: Uuid::new_v4(),
            priority: 5,
            decision: RuleDecision::Skipped { reason: "x".into() },
        };
        let p = PolicyBuilder::from_rule_decisions(&[skipped], t(), &NoopAuditSink);
        assert!(!p.active);
        assert!(p.profile_states.is_empty());
    }

    // Traces to: FR-ENF-001
    #[test]
    fn multiple_profiles_are_independent() {
        let d = fired(
            10,
            vec![
                Action::Block {
                    profile: "games".into(),
                    duration: Duration::minutes(30),
                    rigidity: Rigidity::Hard,
                },
                Action::Unblock { profile: "education".into() },
            ],
        );
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &NoopAuditSink);
        assert!(matches!(p.profile_states.get("games"), Some(ProfileState::Blocked { .. })));
        assert_eq!(p.profile_states.get("education"), Some(&ProfileState::Unblocked));
    }

    // Traces to: FR-STATE-004
    #[test]
    fn policy_build_records_audit() {
        let d = fired(
            10,
            vec![Action::Block {
                profile: "games".into(),
                duration: Duration::minutes(30),
                rigidity: Rigidity::Hard,
            }],
        );
        let sink = CapturingAuditSink::new();
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &sink);
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "policy.built");
        assert_eq!(snap[0].1, p.id.to_string());
        assert_eq!(snap[0].2["active"], true);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn policy_audit_payload_includes_decision_ids() {
        let d1 = fired(10, vec![Action::Unblock { profile: "x".into() }]);
        let d2 = fired(5, vec![Action::Unblock { profile: "y".into() }]);
        let ids: Vec<String> = vec![d1.rule_id.to_string(), d2.rule_id.to_string()];
        let sink = CapturingAuditSink::new();
        let _ = PolicyBuilder::from_rule_decisions(&[d1, d2], t(), &sink);
        let snap = sink.snapshot();
        let decisions = snap[0].2["decision_ids"].as_array().expect("decision_ids array");
        let got: Vec<String> = decisions.iter().map(|v| v.as_str().unwrap().to_string()).collect();
        // Order in payload matches input order (we preserve input order).
        assert_eq!(got, ids);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn policy_audit_payload_has_profile_states() {
        let d = fired(
            10,
            vec![
                Action::Block {
                    profile: "games".into(),
                    duration: Duration::minutes(30),
                    rigidity: Rigidity::Hard,
                },
                Action::Unblock { profile: "education".into() },
            ],
        );
        let sink = CapturingAuditSink::new();
        let _ = PolicyBuilder::from_rule_decisions(&[d], t(), &sink);
        let snap = sink.snapshot();
        let states = &snap[0].2["profile_states"];
        assert_eq!(states["education"]["state"], "Unblocked");
        assert_eq!(states["games"]["state"], "Blocked");
    }

    // Traces to: FR-ENF-001 (app_targets registry)
    #[test]
    fn with_targets_populates_app_targets_from_blocked_profiles() {
        let d = fired(
            10,
            vec![Action::Block {
                profile: "social".into(),
                duration: Duration::hours(1),
                rigidity: Rigidity::Hard,
            }],
        );
        let mut targets: HashMap<String, Vec<AppTarget>> = HashMap::new();
        targets.insert(
            "social".into(),
            vec![
                AppTarget::BundleId("com.burbn.instagram".into()),
                AppTarget::BundleId("com.zhiliaoapp.musically".into()),
                AppTarget::Domain("twitter.com".into()),
            ],
        );
        let p = PolicyBuilder::from_rule_decisions_with_targets(
            &[d],
            &targets,
            t(),
            &NoopAuditSink,
        );
        assert_eq!(p.app_targets.len(), 3);
    }

    #[test]
    fn with_targets_dedupes_across_profiles() {
        let d1 = fired(
            10,
            vec![Action::Block {
                profile: "social".into(),
                duration: Duration::hours(1),
                rigidity: Rigidity::Hard,
            }],
        );
        let d2 = fired(
            9,
            vec![Action::Block {
                profile: "news".into(),
                duration: Duration::hours(1),
                rigidity: Rigidity::Hard,
            }],
        );
        let mut targets: HashMap<String, Vec<AppTarget>> = HashMap::new();
        targets.insert("social".into(), vec![AppTarget::Domain("twitter.com".into())]);
        targets.insert("news".into(), vec![AppTarget::Domain("twitter.com".into())]);
        let p = PolicyBuilder::from_rule_decisions_with_targets(
            &[d1, d2],
            &targets,
            t(),
            &NoopAuditSink,
        );
        assert_eq!(p.app_targets.len(), 1, "twitter.com appeared in both profiles, should dedupe");
    }

    #[test]
    fn with_targets_skips_unblocked_profile_targets() {
        let d = fired(
            10,
            vec![
                Action::Block {
                    profile: "social".into(),
                    duration: Duration::hours(1),
                    rigidity: Rigidity::Hard,
                },
                Action::Unblock { profile: "education".into() },
            ],
        );
        let mut targets: HashMap<String, Vec<AppTarget>> = HashMap::new();
        targets.insert("social".into(), vec![AppTarget::BundleId("com.x".into())]);
        targets.insert("education".into(), vec![AppTarget::BundleId("com.edu".into())]);
        let p = PolicyBuilder::from_rule_decisions_with_targets(
            &[d],
            &targets,
            t(),
            &NoopAuditSink,
        );
        // Only "social" is blocked → only com.x present.
        let bundles: Vec<_> = p
            .app_targets
            .iter()
            .filter_map(|a| match a {
                AppTarget::BundleId(s) => Some(s.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(bundles, vec!["com.x"]);
    }

    // Traces to: EnforcementCallbackPort
    #[test]
    fn callback_port_records_and_snapshots() {
        let port = InMemoryEnforcementCallbackPort::new();
        let policy_id = Uuid::new_v4();
        let now = Utc::now();
        port.record(EnforcementCallback::ApplySucceeded { policy_id, at: now });
        port.record(EnforcementCallback::BlockAttempted {
            target_key: app_target_key(&AppTarget::BundleId("com.x".into())),
            profile: "social".into(),
            at: now,
        });
        port.record(EnforcementCallback::AuthorizationRevoked { at: now });
        let snap = port.snapshot();
        assert_eq!(snap.len(), 3);
        assert!(matches!(snap[0], EnforcementCallback::ApplySucceeded { .. }));
        if let EnforcementCallback::BlockAttempted { target_key, .. } = &snap[1] {
            assert_eq!(target_key, "bundle:com.x");
        } else {
            panic!("expected BlockAttempted");
        }
    }

    #[test]
    fn callback_roundtrips_serde() {
        let now = Utc::now();
        let cases = vec![
            EnforcementCallback::ApplySucceeded { policy_id: Uuid::new_v4(), at: now },
            EnforcementCallback::ApplyFailed {
                policy_id: Uuid::new_v4(),
                reason: "auth revoked".into(),
                at: now,
            },
            EnforcementCallback::RetractSucceeded { policy_id: Uuid::new_v4(), at: now },
            EnforcementCallback::BlockAttempted {
                target_key: "bundle:com.x".into(),
                profile: "social".into(),
                at: now,
            },
            EnforcementCallback::BypassRequested { profile: "games".into(), at: now },
            EnforcementCallback::AuthorizationRevoked { at: now },
        ];
        for c in cases {
            let s = serde_json::to_string(&c).unwrap();
            let back: EnforcementCallback = serde_json::from_str(&s).unwrap();
            assert_eq!(c, back);
        }
    }

    #[test]
    fn legacy_from_rule_decisions_still_yields_empty_targets() {
        let d = fired(
            11,
            vec![Action::Block {
                profile: "social".into(),
                duration: Duration::hours(1),
                rigidity: Rigidity::Hard,
            }],
        );
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &NoopAuditSink);
        assert!(p.app_targets.is_empty(), "legacy call path must stay empty");
    }

    // Traces to: FR-ENF-004
    #[test]
    fn policy_activation_and_deactivation_are_audited() {
        let sink = CapturingAuditSink::new();

        // Activate policy (fire a block action)
        let block_decision = fired(
            10,
            vec![Action::Block {
                profile: "games".into(),
                duration: Duration::minutes(30),
                rigidity: Rigidity::Hard,
            }],
        );
        let active_policy =
            PolicyBuilder::from_rule_decisions(&[block_decision], t(), &sink);
        assert!(active_policy.active);

        // Verify activation was recorded
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "policy.built");
        assert_eq!(snap[0].2["active"], true);
        assert_eq!(snap[0].2["profile_states"]["games"]["state"], "Blocked");

        // Deactivate policy (all rules skipped or no fired decisions)
        let sink2 = CapturingAuditSink::new();
        let skipped_decision = PrioritizedDecision {
            rule_id: Uuid::new_v4(),
            priority: 5,
            decision: RuleDecision::Skipped { reason: "not triggered".into() },
        };
        let inactive_policy =
            PolicyBuilder::from_rule_decisions(&[skipped_decision], t(), &sink2);
        assert!(!inactive_policy.active);

        // Verify deactivation was recorded
        let snap2 = sink2.snapshot();
        assert_eq!(snap2.len(), 1);
        assert_eq!(snap2[0].0, "policy.built");
        assert_eq!(snap2[0].2["active"], false);
    }

    // Traces to: FR-ENF-002
    #[test]
    fn test_fr_enf_002_ios_family_controls_policy() {
        let d = fired(
            10,
            vec![Action::Block {
                profile: "social".into(),
                duration: Duration::minutes(30),
                rigidity: Rigidity::Hard,
            }],
        );
        let p = PolicyBuilder::from_rule_decisions(&[d], t(), &NoopAuditSink);
        assert!(p.active);
        assert!(matches!(p.profile_states.get("social"), Some(ProfileState::Blocked { .. })));
    }
}
