// SPDX-License-Identifier: MIT OR Apache-2.0

//! Penalty state, escalation tiers, bypass budget.
//!
//! Traces to FR-STATE-002.
//
// The `serde_json::json!` macro expands to internal `Result::unwrap()` on
// infallible `to_value(...)` conversions. The clippy `disallowed_methods`
// policy catches those as false positives; silence it crate-wide. We do not
// call `.unwrap()` directly anywhere in this crate.
#![allow(clippy::disallowed_methods)]

use chrono::{DateTime, Utc};
use focus_audit::AuditSink;
use focus_domain::Rigidity;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

fn default_rigidity_hard() -> Rigidity {
    Rigidity::Hard
}

#[derive(Debug, Error)]
pub enum PenaltyError {
    #[error("invariant violation: {0}")]
    Invariant(String),
    #[error("insufficient bypass budget: {balance} < {requested}")]
    InsufficientBypass { balance: i64, requested: i64 },
    #[error("negative amount: {0}")]
    NegativeAmount(i64),
}

pub type Result<T> = std::result::Result<T, PenaltyError>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PenaltyState {
    pub user_id: uuid::Uuid,
    pub escalation_tier: EscalationTier,
    pub bypass_budget: i64,
    pub lockout_windows: Vec<LockoutWindow>,
    pub debt_balance: i64,
    pub strict_mode_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum EscalationTier {
    #[default]
    Clear,
    Warning,
    Restricted,
    Strict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockoutWindow {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub reason: String,
    /// Traces to: FR-RIGIDITY-001. Manual default = Hard so older serialized
    /// lockouts without this field stay fully enforced.
    #[serde(default = "default_rigidity_hard")]
    pub rigidity: Rigidity,
}

impl Default for LockoutWindow {
    fn default() -> Self {
        Self {
            starts_at: DateTime::<Utc>::MIN_UTC,
            ends_at: DateTime::<Utc>::MIN_UTC,
            reason: String::new(),
            rigidity: Rigidity::Hard,
        }
    }
}

/// Read-only preview of a bypass spend for UI confirmation.
/// Traces to: FR-ENF-005.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BypassQuote {
    pub cost: i64,
    pub remaining_after: i64,
    pub new_tier: Option<EscalationTier>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PenaltyMutation {
    Escalate(EscalationTier),
    SpendBypass(i64),
    /// Spend against budget; if budget is insufficient, accrue the shortfall
    /// onto `debt_balance` instead of rejecting the spend. Use this when the
    /// user has crossed a rigidity-cost gate that must succeed (e.g. a
    /// semi-rigid accountability ping has already fired) but the wallet is
    /// empty. Debt is paid down by `RepayDebt`.
    SpendBypassOrDebt(i64),
    GrantBypass(i64),
    /// Reduce `debt_balance` by `n`. Clamps at zero — overpayment does not
    /// credit the budget, because debt is a negative trust signal and the
    /// earned credit path is `GrantBypass`.
    RepayDebt(i64),
    AddLockout(LockoutWindow),
    ClearLockouts,
    SetStrictMode { until: DateTime<Utc> },
    Clear,
}

impl PenaltyState {
    /// Quote a bypass spend without mutating state. UI calls this to
    /// surface cost + projected tier before confirming `SpendBypass`.
    /// Traces to: FR-ENF-005.
    pub fn quote_bypass(&self, cost: i64) -> Result<BypassQuote> {
        if cost < 0 {
            return Err(PenaltyError::NegativeAmount(cost));
        }
        if self.bypass_budget < cost {
            return Err(PenaltyError::InsufficientBypass {
                balance: self.bypass_budget,
                requested: cost,
            });
        }
        Ok(BypassQuote {
            cost,
            remaining_after: self.bypass_budget - cost,
            // Bypass spend does not itself change tier; surface current tier
            // so UI can show "no escalation change" explicitly.
            new_tier: Some(self.escalation_tier),
        })
    }

    /// True iff strict-mode window covers `now`.
    /// Traces to: FR-STATE-002.
    pub fn is_strict(&self, now: DateTime<Utc>) -> bool {
        match self.strict_mode_until {
            Some(exp) => exp > now,
            None => false,
        }
    }

    /// Apply a mutation at `now`, enforcing invariants.
    ///
    /// On every successful state change, records an audit line
    /// `penalty.<variant>` to `audit`. Use `&focus_audit::NoopAuditSink` in
    /// tests / call-sites that intentionally discard audit.
    /// Traces to: FR-STATE-002, FR-STATE-004.
    pub fn apply(
        &mut self,
        mutation: PenaltyMutation,
        now: DateTime<Utc>,
        audit: &dyn AuditSink,
    ) -> Result<()> {
        // Auto-clear expired strict mode.
        if let Some(exp) = self.strict_mode_until {
            if exp <= now {
                self.strict_mode_until = None;
            }
        }
        // Drop fully-expired lockouts.
        self.lockout_windows.retain(|w| w.ends_at > now);

        let (record_type, payload): (&'static str, serde_json::Value) = match &mutation {
            PenaltyMutation::Escalate(tier) => {
                ("penalty.escalate", json!({ "tier": format!("{tier:?}") }))
            }
            PenaltyMutation::SpendBypass(n) => ("penalty.spend_bypass", json!({ "amount": n })),
            PenaltyMutation::SpendBypassOrDebt(n) => {
                ("penalty.spend_bypass_or_debt", json!({ "amount": n }))
            }
            PenaltyMutation::GrantBypass(n) => ("penalty.grant_bypass", json!({ "amount": n })),
            PenaltyMutation::RepayDebt(n) => ("penalty.repay_debt", json!({ "amount": n })),
            PenaltyMutation::AddLockout(w) => (
                "penalty.add_lockout",
                json!({
                    "starts_at": w.starts_at,
                    "ends_at": w.ends_at,
                    "reason": w.reason,
                }),
            ),
            PenaltyMutation::ClearLockouts => ("penalty.clear_lockouts", json!({})),
            PenaltyMutation::SetStrictMode { until } => {
                ("penalty.set_strict_mode", json!({ "until": until }))
            }
            PenaltyMutation::Clear => ("penalty.clear", json!({})),
        };

        match mutation {
            PenaltyMutation::Escalate(tier) => {
                if tier < self.escalation_tier {
                    return Err(PenaltyError::Invariant(
                        "escalation can only move up; use Clear to reset".into(),
                    ));
                }
                self.escalation_tier = tier;
            }
            PenaltyMutation::SpendBypass(n) => {
                if n < 0 {
                    return Err(PenaltyError::NegativeAmount(n));
                }
                if self.bypass_budget < n {
                    return Err(PenaltyError::InsufficientBypass {
                        balance: self.bypass_budget,
                        requested: n,
                    });
                }
                self.bypass_budget -= n;
                if self.bypass_budget < 0 {
                    return Err(PenaltyError::Invariant("bypass_budget < 0".into()));
                }
            }
            PenaltyMutation::SpendBypassOrDebt(n) => {
                if n < 0 {
                    return Err(PenaltyError::NegativeAmount(n));
                }
                let from_budget = self.bypass_budget.min(n);
                let shortfall = n - from_budget;
                self.bypass_budget -= from_budget;
                self.debt_balance = self
                    .debt_balance
                    .checked_add(shortfall)
                    .ok_or_else(|| PenaltyError::Invariant("debt overflow".into()))?;
            }
            PenaltyMutation::RepayDebt(n) => {
                if n < 0 {
                    return Err(PenaltyError::NegativeAmount(n));
                }
                // Clamp at zero; overpayment is silently ignored, not credited.
                self.debt_balance = (self.debt_balance - n).max(0);
            }
            PenaltyMutation::GrantBypass(n) => {
                if n < 0 {
                    return Err(PenaltyError::NegativeAmount(n));
                }
                self.bypass_budget = self
                    .bypass_budget
                    .checked_add(n)
                    .ok_or_else(|| PenaltyError::Invariant("bypass overflow".into()))?;
            }
            PenaltyMutation::AddLockout(w) => {
                if w.ends_at <= w.starts_at {
                    return Err(PenaltyError::Invariant("lockout ends <= starts".into()));
                }
                self.lockout_windows.push(w);
            }
            PenaltyMutation::ClearLockouts => {
                self.lockout_windows.clear();
            }
            PenaltyMutation::SetStrictMode { until } => {
                if until <= now {
                    return Err(PenaltyError::Invariant("strict_mode_until in past".into()));
                }
                self.strict_mode_until = Some(until);
            }
            PenaltyMutation::Clear => {
                self.escalation_tier = EscalationTier::Clear;
                self.strict_mode_until = None;
                self.lockout_windows.clear();
                self.debt_balance = 0;
            }
        }
        audit
            .record_mutation(record_type, &self.user_id.to_string(), payload, now)
            .map_err(|e| PenaltyError::Invariant(format!("audit append failed: {e}")))?;
        Ok(())
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

    fn t(y: i32, m: u32, d: u32, h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, h, 0, 0).unwrap()
    }

    // Traces to: FR-STATE-002
    #[test]
    fn escalation_only_moves_up() {
        let mut s = PenaltyState::default();
        s.apply(
            PenaltyMutation::Escalate(EscalationTier::Warning),
            t(2026, 1, 1, 0),
            &NoopAuditSink,
        )
        .unwrap();
        s.apply(
            PenaltyMutation::Escalate(EscalationTier::Restricted),
            t(2026, 1, 1, 1),
            &NoopAuditSink,
        )
        .unwrap();
        assert_eq!(s.escalation_tier, EscalationTier::Restricted);
        let err = s
            .apply(
                PenaltyMutation::Escalate(EscalationTier::Warning),
                t(2026, 1, 1, 2),
                &NoopAuditSink,
            )
            .unwrap_err();
        assert!(matches!(err, PenaltyError::Invariant(_)));
    }

    // Traces to: FR-STATE-002
    #[test]
    fn clear_resets_tier() {
        let mut s = PenaltyState::default();
        s.apply(
            PenaltyMutation::Escalate(EscalationTier::Strict),
            t(2026, 1, 1, 0),
            &NoopAuditSink,
        )
        .unwrap();
        s.apply(PenaltyMutation::Clear, t(2026, 1, 1, 1), &NoopAuditSink).unwrap();
        assert_eq!(s.escalation_tier, EscalationTier::Clear);
    }

    // Traces to: FR-STATE-002
    #[test]
    fn bypass_budget_nonnegative() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::GrantBypass(10), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        s.apply(PenaltyMutation::SpendBypass(7), t(2026, 1, 1, 1), &NoopAuditSink).unwrap();
        assert_eq!(s.bypass_budget, 3);
        let err = s
            .apply(PenaltyMutation::SpendBypass(10), t(2026, 1, 1, 2), &NoopAuditSink)
            .unwrap_err();
        assert!(matches!(err, PenaltyError::InsufficientBypass { .. }));
    }

    // Traces to: FR-STATE-002
    #[test]
    fn strict_mode_auto_clears_after_expiry() {
        let mut s = PenaltyState::default();
        s.apply(
            PenaltyMutation::SetStrictMode { until: t(2026, 1, 1, 10) },
            t(2026, 1, 1, 9),
            &NoopAuditSink,
        )
        .unwrap();
        assert!(s.is_strict(t(2026, 1, 1, 9)));
        s.apply(PenaltyMutation::ClearLockouts, t(2026, 1, 1, 11), &NoopAuditSink).unwrap();
        assert!(!s.is_strict(t(2026, 1, 1, 11)));
        assert!(s.strict_mode_until.is_none());
    }

    // Traces to: FR-STATE-002
    #[test]
    fn expired_lockouts_pruned_on_apply() {
        let mut s = PenaltyState::default();
        s.lockout_windows.push(LockoutWindow {
            starts_at: t(2026, 1, 1, 0),
            ends_at: t(2026, 1, 1, 1),
            reason: "x".into(),
            rigidity: Rigidity::Hard,
        });
        s.apply(PenaltyMutation::GrantBypass(0), t(2026, 1, 1, 5), &NoopAuditSink).unwrap();
        assert!(s.lockout_windows.is_empty());
    }

    // Traces to: FR-ENF-005
    #[test]
    fn quote_happy_path() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::GrantBypass(10), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        let q = s.quote_bypass(4).unwrap();
        assert_eq!(q.cost, 4);
        assert_eq!(q.remaining_after, 6);
        assert_eq!(q.new_tier, Some(EscalationTier::Clear));
        // Confirm read-only — budget unchanged.
        assert_eq!(s.bypass_budget, 10);
    }

    // Traces to: FR-ENF-005
    #[test]
    fn quote_insufficient_errors() {
        let s = PenaltyState::default();
        let err = s.quote_bypass(1).unwrap_err();
        assert!(matches!(err, PenaltyError::InsufficientBypass { .. }));
    }

    // Traces to: FR-ENF-005
    #[test]
    fn quote_negative_errors() {
        let s = PenaltyState::default();
        let err = s.quote_bypass(-1).unwrap_err();
        assert!(matches!(err, PenaltyError::NegativeAmount(-1)));
    }

    // Traces to: FR-STATE-002
    #[test]
    fn add_lockout_rejects_bad_window() {
        let mut s = PenaltyState::default();
        let err = s
            .apply(
                PenaltyMutation::AddLockout(LockoutWindow {
                    starts_at: t(2026, 1, 1, 5),
                    ends_at: t(2026, 1, 1, 5),
                    reason: "x".into(),
                    rigidity: Rigidity::Hard,
                }),
                t(2026, 1, 1, 0),
                &NoopAuditSink,
            )
            .unwrap_err();
        assert!(matches!(err, PenaltyError::Invariant(_)));
    }

    // Traces to: FR-STATE-004
    #[test]
    fn escalate_records_audit_line() {
        let mut s = PenaltyState::default();
        let sink = CapturingAuditSink::new();
        s.apply(PenaltyMutation::Escalate(EscalationTier::Strict), t(2026, 1, 1, 0), &sink)
            .unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "penalty.escalate");
        assert_eq!(snap[0].2["tier"], "Strict");
    }

    // Traces to: FR-STATE-004
    #[test]
    fn failed_escalation_does_not_audit() {
        let mut s = PenaltyState::default();
        let sink = CapturingAuditSink::new();
        s.apply(PenaltyMutation::Escalate(EscalationTier::Restricted), t(2026, 1, 1, 0), &sink)
            .unwrap();
        let _ =
            s.apply(PenaltyMutation::Escalate(EscalationTier::Warning), t(2026, 1, 1, 1), &sink);
        // Only the first succeeded and audited; the rejected downgrade did not.
        assert_eq!(sink.len(), 1);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn bypass_spend_and_grant_audit() {
        let mut s = PenaltyState::default();
        let sink = CapturingAuditSink::new();
        s.apply(PenaltyMutation::GrantBypass(10), t(2026, 1, 1, 0), &sink).unwrap();
        s.apply(PenaltyMutation::SpendBypass(4), t(2026, 1, 1, 1), &sink).unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 2);
        assert_eq!(snap[0].0, "penalty.grant_bypass");
        assert_eq!(snap[0].2["amount"], 10);
        assert_eq!(snap[1].0, "penalty.spend_bypass");
        assert_eq!(snap[1].2["amount"], 4);
    }

    // Traces to: FR-STATE-002 (debt mechanic)
    #[test]
    fn spend_or_debt_drains_budget_then_accrues_debt() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::GrantBypass(10), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        s.apply(PenaltyMutation::SpendBypassOrDebt(15), t(2026, 1, 1, 1), &NoopAuditSink)
            .unwrap();
        assert_eq!(s.bypass_budget, 0);
        assert_eq!(s.debt_balance, 5);
    }

    #[test]
    fn spend_or_debt_no_budget_all_to_debt() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::SpendBypassOrDebt(7), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        assert_eq!(s.bypass_budget, 0);
        assert_eq!(s.debt_balance, 7);
    }

    #[test]
    fn spend_or_debt_rejects_negative() {
        let mut s = PenaltyState::default();
        let err = s
            .apply(PenaltyMutation::SpendBypassOrDebt(-1), t(2026, 1, 1, 0), &NoopAuditSink)
            .unwrap_err();
        assert!(matches!(err, PenaltyError::NegativeAmount(_)));
    }

    #[test]
    fn repay_debt_reduces_balance_clamps_at_zero() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::SpendBypassOrDebt(10), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        assert_eq!(s.debt_balance, 10);
        s.apply(PenaltyMutation::RepayDebt(6), t(2026, 1, 1, 1), &NoopAuditSink).unwrap();
        assert_eq!(s.debt_balance, 4);
        // Overpayment — clamps, does NOT credit budget.
        s.apply(PenaltyMutation::RepayDebt(100), t(2026, 1, 1, 2), &NoopAuditSink).unwrap();
        assert_eq!(s.debt_balance, 0);
        assert_eq!(s.bypass_budget, 0);
    }

    #[test]
    fn clear_zeros_debt_balance() {
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::SpendBypassOrDebt(5), t(2026, 1, 1, 0), &NoopAuditSink).unwrap();
        s.apply(PenaltyMutation::Clear, t(2026, 1, 1, 1), &NoopAuditSink).unwrap();
        assert_eq!(s.debt_balance, 0);
    }

    #[test]
    fn debt_mutations_emit_audit_lines() {
        let sink = CapturingAuditSink::new();
        let mut s = PenaltyState::default();
        s.apply(PenaltyMutation::SpendBypassOrDebt(3), t(2026, 1, 1, 0), &sink).unwrap();
        s.apply(PenaltyMutation::RepayDebt(1), t(2026, 1, 1, 1), &sink).unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 2);
        assert_eq!(snap[0].0, "penalty.spend_bypass_or_debt");
        assert_eq!(snap[0].2["amount"], 3);
        assert_eq!(snap[1].0, "penalty.repay_debt");
        assert_eq!(snap[1].2["amount"], 1);
    }
}
