// SPDX-License-Identifier: MIT OR Apache-2.0

//! PenaltyStore impl for SqliteAdapter.
//!
//! Traces to: FR-STATE-002, FR-DATA-001.

use anyhow::{Context, Result};
use async_trait::async_trait;
use focus_penalties::{EscalationTier, LockoutWindow, PenaltyMutation, PenaltyState};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::{parse_rfc3339, parse_rfc3339_opt, rfc3339, SqliteAdapter};
use crate::ports::PenaltyStore;

fn tier_to_str(t: EscalationTier) -> &'static str {
    match t {
        EscalationTier::Clear => "Clear",
        EscalationTier::Warning => "Warning",
        EscalationTier::Restricted => "Restricted",
        EscalationTier::Strict => "Strict",
    }
}

fn tier_from_str(s: &str) -> Result<EscalationTier> {
    Ok(match s {
        "Clear" => EscalationTier::Clear,
        "Warning" => EscalationTier::Warning,
        "Restricted" => EscalationTier::Restricted,
        "Strict" => EscalationTier::Strict,
        other => anyhow::bail!("unknown escalation tier: {other}"),
    })
}

fn load_sync(conn: &Connection, user_id: Uuid) -> Result<PenaltyState> {
    let uid = user_id.to_string();
    let row: Option<(String, i64, i64, Option<String>)> = conn
        .query_row(
            "SELECT escalation_tier, bypass_budget, debt_balance, strict_mode_until \
             FROM penalty_state WHERE user_id = ?1",
            params![uid],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .context("query penalty_state")?;

    let (tier, bypass, debt, strict_until) =
        row.unwrap_or_else(|| ("Clear".to_string(), 0, 0, None));

    let mut lockout_windows: Vec<LockoutWindow> = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT starts_at, ends_at, reason FROM lockout_windows WHERE user_id = ?1 \
                 ORDER BY id ASC",
            )
            .context("prepare lockouts")?;
        let rows = stmt
            .query_map(params![uid], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })
            .context("query lockouts")?;
        for row in rows {
            let (s, e, r) = row.context("lockout row")?;
            lockout_windows.push(LockoutWindow {
                starts_at: parse_rfc3339(&s)?,
                ends_at: parse_rfc3339(&e)?,
                reason: r,
                rigidity: focus_domain::Rigidity::Hard,
            });
        }
    }

    Ok(PenaltyState {
        user_id,
        escalation_tier: tier_from_str(&tier)?,
        bypass_budget: bypass,
        lockout_windows,
        debt_balance: debt,
        strict_mode_until: parse_rfc3339_opt(strict_until)?,
    })
}

fn save_sync(conn: &Connection, state: &PenaltyState) -> Result<()> {
    let uid = state.user_id.to_string();
    conn.execute(
        "INSERT INTO penalty_state (user_id, escalation_tier, bypass_budget, debt_balance, strict_mode_until) \
         VALUES (?1,?2,?3,?4,?5) \
         ON CONFLICT(user_id) DO UPDATE SET \
            escalation_tier=excluded.escalation_tier, \
            bypass_budget=excluded.bypass_budget, \
            debt_balance=excluded.debt_balance, \
            strict_mode_until=excluded.strict_mode_until",
        params![
            uid,
            tier_to_str(state.escalation_tier),
            state.bypass_budget,
            state.debt_balance,
            state.strict_mode_until.map(rfc3339),
        ],
    )
    .context("upsert penalty_state")?;

    conn.execute("DELETE FROM lockout_windows WHERE user_id = ?1", params![uid])
        .context("clear lockouts")?;
    for w in &state.lockout_windows {
        conn.execute(
            "INSERT INTO lockout_windows (user_id, starts_at, ends_at, reason) \
             VALUES (?1,?2,?3,?4)",
            params![uid, rfc3339(w.starts_at), rfc3339(w.ends_at), w.reason],
        )
        .context("insert lockout")?;
    }
    Ok(())
}

#[async_trait]
impl PenaltyStore for SqliteAdapter {
    async fn load(&self, user_id: Uuid) -> Result<PenaltyState> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<PenaltyState> {
            let guard = conn.blocking_lock();
            load_sync(&guard, user_id)
        })
        .await
        .context("penalty.load join")?
    }

    async fn apply(&self, user_id: Uuid, mutation: PenaltyMutation) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            let mut guard = conn.blocking_lock();
            let tx = guard.transaction().context("begin penalty.apply")?;
            let mut state = load_sync(&tx, user_id)?;
            state.user_id = user_id;
            state
                .apply(mutation, chrono::Utc::now(), &focus_audit::NoopAuditSink)
                .map_err(|e| anyhow::anyhow!("penalty mutation: {e}"))?;
            save_sync(&tx, &state)?;
            tx.commit().context("commit penalty.apply")?;
            Ok(())
        })
        .await
        .context("penalty.apply join")?
    }
}
