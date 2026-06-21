// SPDX-License-Identifier: MIT OR Apache-2.0

//! Reward wallet aggregate + mutations.
//!
//! Traces to FR-STATE-001.

#![cfg_attr(test, allow(clippy::disallowed_methods))]

use chrono::{DateTime, Datelike, Utc};
use focus_audit::AuditSink;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WalletError {
    #[error("invariant violation: {0}")]
    Invariant(String),
    #[error("insufficient credit: balance {balance}, requested {requested}")]
    InsufficientCredit { balance: i64, requested: i64 },
    #[error("negative amount not allowed: {0}")]
    NegativeAmount(i64),
}

pub type Result<T> = std::result::Result<T, WalletError>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RewardWallet {
    pub user_id: uuid::Uuid,
    pub earned_credits: i64,
    pub spent_credits: i64,
    pub streaks: HashMap<String, Streak>,
    pub unlock_balances: HashMap<String, i64>,
    pub multiplier_state: MultiplierState,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Streak {
    pub name: String,
    pub count: u32,
    pub last_incremented_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Credit {
    pub amount: i64,
    pub source_rule_id: Option<uuid::Uuid>,
    pub granted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MultiplierState {
    pub current: f32,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WalletMutation {
    GrantCredit(Credit),
    SpendCredit { amount: i64, purpose: String },
    StreakIncrement(String),
    StreakReset(String),
    SetMultiplier(MultiplierState),
}

impl RewardWallet {
    /// Current credit balance (non-negative invariant: earned >= spent).
    pub fn balance(&self) -> i64 {
        self.earned_credits - self.spent_credits
    }

    /// Multiplier in effect at `now`, or 1.0 if none / expired.
    /// Traces to: FR-STATE-001.
    pub fn effective_multiplier(&self, now: DateTime<Utc>) -> f32 {
        match self.multiplier_state.expires_at {
            Some(exp) if exp <= now => 1.0,
            _ => {
                if self.multiplier_state.current > 0.0 {
                    self.multiplier_state.current
                } else {
                    1.0
                }
            }
        }
    }

    /// Apply a mutation at `now`, enforcing invariants.
    ///
    /// On every successful state change, records an audit line
    /// `wallet.<variant>` to `audit`. Use `&focus_audit::NoopAuditSink` in
    /// tests / call-sites that intentionally discard audit.
    /// Traces to: FR-STATE-001, FR-STATE-004.
    pub fn apply(
        &mut self,
        mutation: WalletMutation,
        now: DateTime<Utc>,
        audit: &dyn AuditSink,
    ) -> Result<()> {
        // Prune expired multiplier deterministically on every apply.
        if let Some(exp) = self.multiplier_state.expires_at {
            if exp <= now {
                self.multiplier_state = MultiplierState::default();
            }
        }

        // Capture shape for audit payload based on mutation variant.
        let (record_type, payload): (&'static str, serde_json::Value) = match &mutation {
            WalletMutation::GrantCredit(c) => (
                "wallet.grant_credit",
                json!({
                    "amount": c.amount,
                    "source_rule_id": c.source_rule_id,
                    "granted_at": c.granted_at,
                }),
            ),
            WalletMutation::SpendCredit { amount, purpose } => {
                ("wallet.spend_credit", json!({ "amount": amount, "purpose": purpose }))
            }
            WalletMutation::StreakIncrement(name) => {
                ("wallet.streak_increment", json!({ "name": name }))
            }
            WalletMutation::StreakReset(name) => ("wallet.streak_reset", json!({ "name": name })),
            WalletMutation::SetMultiplier(m) => (
                "wallet.set_multiplier",
                json!({ "current": m.current, "expires_at": m.expires_at }),
            ),
        };

        match mutation {
            WalletMutation::GrantCredit(c) => {
                if c.amount < 0 {
                    return Err(WalletError::NegativeAmount(c.amount));
                }
                self.earned_credits = self
                    .earned_credits
                    .checked_add(c.amount)
                    .ok_or_else(|| WalletError::Invariant("earned overflow".into()))?;
            }
            WalletMutation::SpendCredit { amount, .. } => {
                if amount < 0 {
                    return Err(WalletError::NegativeAmount(amount));
                }
                if self.balance() < amount {
                    return Err(WalletError::InsufficientCredit {
                        balance: self.balance(),
                        requested: amount,
                    });
                }
                self.spent_credits = self
                    .spent_credits
                    .checked_add(amount)
                    .ok_or_else(|| WalletError::Invariant("spent overflow".into()))?;
                if self.spent_credits > self.earned_credits {
                    return Err(WalletError::Invariant("spent > earned".into()));
                }
            }
            WalletMutation::StreakIncrement(name) => {
                let entry = self.streaks.entry(name.clone()).or_insert_with(|| Streak {
                    name: name.clone(),
                    count: 0,
                    last_incremented_at: None,
                });
                // One increment per UTC day per streak.
                if let Some(last) = entry.last_incremented_at {
                    if same_utc_day(last, now) {
                        return Ok(()); // idempotent no-op — skip audit too
                    }
                }
                entry.count = entry.count.saturating_add(1);
                entry.last_incremented_at = Some(now);
            }
            WalletMutation::StreakReset(name) => {
                if let Some(s) = self.streaks.get_mut(&name) {
                    s.count = 0;
                    s.last_incremented_at = None;
                }
            }
            WalletMutation::SetMultiplier(m) => {
                if m.current.is_nan() || m.current < 0.0 {
                    return Err(WalletError::Invariant("invalid multiplier".into()));
                }
                if let Some(exp) = m.expires_at {
                    if exp <= now {
                        return Ok(()); // expired-on-arrival — skip audit
                    }
                }
                self.multiplier_state = m;
            }
        }

        audit
            .record_mutation(record_type, &self.user_id.to_string(), payload, now)
            .map_err(|e| WalletError::Invariant(format!("audit append failed: {e}")))?;
        Ok(())
    }
}

fn same_utc_day(a: DateTime<Utc>, b: DateTime<Utc>) -> bool {
    a.year() == b.year() && a.ordinal() == b.ordinal()
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use focus_audit::{CapturingAuditSink, NoopAuditSink};

    fn t(y: i32, m: u32, d: u32, h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, h, 0, 0).unwrap()
    }

    // Traces to: FR-STATE-001
    #[test]
    fn grant_and_spend_balance() {
        let mut w = RewardWallet::default();
        w.apply(
            WalletMutation::GrantCredit(Credit {
                amount: 100,
                source_rule_id: None,
                granted_at: t(2026, 1, 1, 0),
            }),
            t(2026, 1, 1, 0),
            &NoopAuditSink,
        )
        .unwrap();
        w.apply(
            WalletMutation::SpendCredit { amount: 40, purpose: "unlock".into() },
            t(2026, 1, 1, 1),
            &NoopAuditSink,
        )
        .unwrap();
        assert_eq!(w.balance(), 60);
    }

    // Traces to: FR-STATE-001
    #[test]
    fn spend_more_than_balance_errors() {
        let mut w = RewardWallet::default();
        let err = w
            .apply(
                WalletMutation::SpendCredit { amount: 5, purpose: "x".into() },
                t(2026, 1, 1, 0),
                &NoopAuditSink,
            )
            .unwrap_err();
        assert!(matches!(err, WalletError::InsufficientCredit { .. }));
    }

    // Traces to: FR-STATE-001
    #[test]
    fn streak_increments_only_once_per_utc_day() {
        let mut w = RewardWallet::default();
        w.apply(WalletMutation::StreakIncrement("daily".into()), t(2026, 1, 1, 8), &NoopAuditSink)
            .unwrap();
        w.apply(WalletMutation::StreakIncrement("daily".into()), t(2026, 1, 1, 23), &NoopAuditSink)
            .unwrap();
        assert_eq!(w.streaks["daily"].count, 1);
        w.apply(WalletMutation::StreakIncrement("daily".into()), t(2026, 1, 2, 0), &NoopAuditSink)
            .unwrap();
        assert_eq!(w.streaks["daily"].count, 2);
    }

    // Traces to: FR-STATE-001
    #[test]
    fn multiplier_expires_and_effective_is_one() {
        let mut w = RewardWallet::default();
        w.apply(
            WalletMutation::SetMultiplier(MultiplierState {
                current: 2.0,
                expires_at: Some(t(2026, 1, 1, 10)),
            }),
            t(2026, 1, 1, 9),
            &NoopAuditSink,
        )
        .unwrap();
        assert_eq!(w.effective_multiplier(t(2026, 1, 1, 9)), 2.0);
        w.apply(WalletMutation::StreakReset("noop".into()), t(2026, 1, 1, 11), &NoopAuditSink)
            .unwrap();
        assert_eq!(w.effective_multiplier(t(2026, 1, 1, 11)), 1.0);
        assert!(w.multiplier_state.expires_at.is_none());
    }

    // Traces to: FR-STATE-001
    #[test]
    fn negative_grant_rejected() {
        let mut w = RewardWallet::default();
        let err = w
            .apply(
                WalletMutation::GrantCredit(Credit {
                    amount: -1,
                    source_rule_id: None,
                    granted_at: t(2026, 1, 1, 0),
                }),
                t(2026, 1, 1, 0),
                &NoopAuditSink,
            )
            .unwrap_err();
        assert!(matches!(err, WalletError::NegativeAmount(_)));
    }

    // Traces to: FR-STATE-001
    #[test]
    fn streak_reset_clears_count() {
        let mut w = RewardWallet::default();
        w.apply(WalletMutation::StreakIncrement("s".into()), t(2026, 1, 1, 0), &NoopAuditSink)
            .unwrap();
        w.apply(WalletMutation::StreakReset("s".into()), t(2026, 1, 1, 1), &NoopAuditSink).unwrap();
        assert_eq!(w.streaks["s"].count, 0);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn grant_records_audit_line() {
        let mut w = RewardWallet::default();
        let sink = CapturingAuditSink::new();
        w.apply(
            WalletMutation::GrantCredit(Credit {
                amount: 25,
                source_rule_id: None,
                granted_at: t(2026, 1, 1, 0),
            }),
            t(2026, 1, 1, 0),
            &sink,
        )
        .unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "wallet.grant_credit");
        assert_eq!(snap[0].2["amount"], 25);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn failed_mutation_does_not_audit() {
        let mut w = RewardWallet::default();
        let sink = CapturingAuditSink::new();
        let _ = w.apply(
            WalletMutation::SpendCredit { amount: 10, purpose: "x".into() },
            t(2026, 1, 1, 0),
            &sink,
        );
        assert!(sink.is_empty(), "rejected mutation must not write audit");
    }

    // Traces to: FR-STATE-004
    #[test]
    fn idempotent_streak_does_not_audit_twice() {
        let mut w = RewardWallet::default();
        let sink = CapturingAuditSink::new();
        w.apply(WalletMutation::StreakIncrement("daily".into()), t(2026, 1, 1, 8), &sink).unwrap();
        w.apply(WalletMutation::StreakIncrement("daily".into()), t(2026, 1, 1, 23), &sink).unwrap();
        // First increment audits, second same-day no-op does not.
        assert_eq!(sink.len(), 1);
        assert_eq!(sink.snapshot()[0].0, "wallet.streak_increment");
    }

    // Traces to: FR-STATE-004
    #[test]
    fn spend_credit_audit_captures_amount_and_purpose() {
        let mut w = RewardWallet::default();
        let sink = CapturingAuditSink::new();
        w.apply(
            WalletMutation::GrantCredit(Credit {
                amount: 50,
                source_rule_id: None,
                granted_at: t(2026, 1, 1, 0),
            }),
            t(2026, 1, 1, 0),
            &sink,
        )
        .unwrap();
        w.apply(
            WalletMutation::SpendCredit { amount: 20, purpose: "unlock-games".into() },
            t(2026, 1, 1, 1),
            &sink,
        )
        .unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 2);
        assert_eq!(snap[1].0, "wallet.spend_credit");
        assert_eq!(snap[1].2["amount"], 20);
        assert_eq!(snap[1].2["purpose"], "unlock-games");
    }
}
