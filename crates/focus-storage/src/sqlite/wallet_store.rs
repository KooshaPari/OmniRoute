// SPDX-License-Identifier: MIT OR Apache-2.0

//! WalletStore impl for SqliteAdapter.
//!
//! Traces to: FR-STATE-001, FR-DATA-001.

use anyhow::{Context, Result};
use async_trait::async_trait;
use focus_rewards::{MultiplierState, RewardWallet, Streak, WalletMutation};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use uuid::Uuid;

use super::{parse_rfc3339_opt, rfc3339, SqliteAdapter};
use crate::ports::WalletStore;

fn load_wallet_sync(conn: &Connection, user_id: Uuid) -> Result<RewardWallet> {
    let uid_str = user_id.to_string();

    let wallet_row: Option<(i64, i64, f64, Option<String>)> = conn
        .query_row(
            "SELECT earned, spent, multiplier_current, multiplier_expires_at \
             FROM wallet WHERE user_id = ?1",
            params![uid_str],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .context("query wallet")?;

    let (earned, spent, mult_current, mult_exp) = wallet_row.unwrap_or((0, 0, 1.0, None));

    let mut streaks: HashMap<String, Streak> = HashMap::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT name, count, last_incremented_at FROM wallet_streaks WHERE user_id = ?1",
            )
            .context("prepare streaks")?;
        let rows = stmt
            .query_map(params![uid_str], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .context("query streaks")?;
        for row in rows {
            let (name, count, last) = row.context("streak row")?;
            let last = parse_rfc3339_opt(last)?;
            streaks.insert(
                name.clone(),
                Streak { name, count: count as u32, last_incremented_at: last },
            );
        }
    }

    let mut unlock_balances: HashMap<String, i64> = HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT key, value FROM wallet_unlocks WHERE user_id = ?1")
            .context("prepare unlocks")?;
        let rows = stmt
            .query_map(params![uid_str], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .context("query unlocks")?;
        for row in rows {
            let (k, v) = row.context("unlock row")?;
            unlock_balances.insert(k, v);
        }
    }

    Ok(RewardWallet {
        user_id,
        earned_credits: earned,
        spent_credits: spent,
        streaks,
        unlock_balances,
        multiplier_state: MultiplierState {
            current: mult_current as f32,
            expires_at: parse_rfc3339_opt(mult_exp)?,
        },
    })
}

fn save_wallet_sync(conn: &Connection, wallet: &RewardWallet) -> Result<()> {
    let uid = wallet.user_id.to_string();
    conn.execute(
        "INSERT INTO wallet (user_id, earned, spent, multiplier_current, multiplier_expires_at) \
         VALUES (?1,?2,?3,?4,?5) \
         ON CONFLICT(user_id) DO UPDATE SET \
            earned=excluded.earned, spent=excluded.spent, \
            multiplier_current=excluded.multiplier_current, \
            multiplier_expires_at=excluded.multiplier_expires_at",
        params![
            uid,
            wallet.earned_credits,
            wallet.spent_credits,
            wallet.multiplier_state.current as f64,
            wallet.multiplier_state.expires_at.map(rfc3339),
        ],
    )
    .context("upsert wallet")?;

    conn.execute("DELETE FROM wallet_streaks WHERE user_id = ?1", params![uid])
        .context("clear streaks")?;
    for (name, s) in &wallet.streaks {
        conn.execute(
            "INSERT INTO wallet_streaks (user_id, name, count, last_incremented_at) \
             VALUES (?1,?2,?3,?4)",
            params![uid, name, s.count as i64, s.last_incremented_at.map(rfc3339)],
        )
        .context("insert streak")?;
    }

    conn.execute("DELETE FROM wallet_unlocks WHERE user_id = ?1", params![uid])
        .context("clear unlocks")?;
    for (k, v) in &wallet.unlock_balances {
        conn.execute(
            "INSERT INTO wallet_unlocks (user_id, key, value) VALUES (?1,?2,?3)",
            params![uid, k, v],
        )
        .context("insert unlock")?;
    }
    Ok(())
}

#[async_trait]
impl WalletStore for SqliteAdapter {
    async fn load(&self, user_id: Uuid) -> Result<RewardWallet> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<RewardWallet> {
            let guard = conn.blocking_lock();
            load_wallet_sync(&guard, user_id)
        })
        .await
        .context("wallet.load join")?
    }

    async fn apply(&self, user_id: Uuid, mutation: WalletMutation) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            let mut guard = conn.blocking_lock();
            let tx = guard.transaction().context("begin wallet.apply")?;
            let mut wallet = load_wallet_sync(&tx, user_id)?;
            wallet.user_id = user_id;
            wallet
                .apply(mutation, chrono::Utc::now(), &focus_audit::NoopAuditSink)
                .map_err(|e| anyhow::anyhow!("wallet mutation: {e}"))?;
            save_wallet_sync(&tx, &wallet)?;
            tx.commit().context("commit wallet.apply")?;
            Ok(())
        })
        .await
        .context("wallet.apply join")?
    }
}
