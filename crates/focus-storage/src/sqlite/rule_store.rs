// SPDX-License-Identifier: MIT OR Apache-2.0

//! RuleStore impl for SqliteAdapter.
//!
//! Traces to: FR-DATA-001.

use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::Duration;
use focus_rules::{Action, Condition, Rule, Trigger};
use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use super::SqliteAdapter;
use crate::ports::RuleStore;

type RuleRow = (String, String, i64, i64, Option<i64>, Option<i64>, String, String, String, String);

fn row_to_rule(row: RuleRow) -> Result<Rule> {
    let (id, name, enabled, priority, cs, ds, tmpl, tj, cj, aj) = row;
    let trigger: Trigger = serde_json::from_str(&tj).context("deserialize trigger_json")?;
    let conditions: Vec<Condition> =
        serde_json::from_str(&cj).context("deserialize conditions_json")?;
    let actions: Vec<Action> = serde_json::from_str(&aj).context("deserialize actions_json")?;
    Ok(Rule {
        id: Uuid::parse_str(&id).context("parse rule id")?,
        name,
        trigger,
        conditions,
        actions,
        priority: priority as i32,
        cooldown: cs.map(Duration::seconds),
        duration: ds.map(Duration::seconds),
        explanation_template: tmpl,
        enabled: enabled != 0,
    })
}

/// Upsert a rule. Not on the `RuleStore` trait; helper for tests/seed.
pub async fn upsert_rule(adapter: &SqliteAdapter, rule: Rule) -> Result<()> {
    let conn = adapter.conn.clone();
    tokio::task::spawn_blocking(move || -> Result<()> {
        let guard = conn.blocking_lock();
        let trigger_json = serde_json::to_string(&rule.trigger).context("serialize trigger")?;
        let conditions_json =
            serde_json::to_string(&rule.conditions).context("serialize conditions")?;
        let actions_json = serde_json::to_string(&rule.actions).context("serialize actions")?;
        guard
            .execute(
                "INSERT INTO rules (id, name, enabled, priority, cooldown_secs, duration_secs, \
                 explanation_template, trigger_json, conditions_json, actions_json) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) \
                 ON CONFLICT(id) DO UPDATE SET \
                    name=excluded.name, enabled=excluded.enabled, priority=excluded.priority, \
                    cooldown_secs=excluded.cooldown_secs, duration_secs=excluded.duration_secs, \
                    explanation_template=excluded.explanation_template, \
                    trigger_json=excluded.trigger_json, conditions_json=excluded.conditions_json, \
                    actions_json=excluded.actions_json",
                params![
                    rule.id.to_string(),
                    rule.name,
                    rule.enabled as i64,
                    rule.priority as i64,
                    rule.cooldown.map(|d| d.num_seconds()),
                    rule.duration.map(|d| d.num_seconds()),
                    rule.explanation_template,
                    trigger_json,
                    conditions_json,
                    actions_json,
                ],
            )
            .context("upsert rule")?;
        Ok(())
    })
    .await
    .context("upsert_rule join")?
}

#[async_trait]
impl RuleStore for SqliteAdapter {
    async fn get(&self, id: Uuid) -> Result<Option<Rule>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<Option<Rule>> {
            let guard = conn.blocking_lock();
            let row = guard
                .query_row(
                    "SELECT id, name, enabled, priority, cooldown_secs, duration_secs, \
                     explanation_template, trigger_json, conditions_json, actions_json \
                     FROM rules WHERE id = ?1",
                    params![id.to_string()],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                            row.get::<_, Option<i64>>(4)?,
                            row.get::<_, Option<i64>>(5)?,
                            row.get::<_, String>(6)?,
                            row.get::<_, String>(7)?,
                            row.get::<_, String>(8)?,
                            row.get::<_, String>(9)?,
                        ))
                    },
                )
                .optional()
                .context("query rule.get")?;
            let Some(row) = row else {
                return Ok(None);
            };
            Ok(Some(row_to_rule(row)?))
        })
        .await
        .context("rule.get join")?
    }

    async fn list_enabled(&self) -> Result<Vec<Rule>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<Vec<Rule>> {
            let guard = conn.blocking_lock();
            let mut stmt = guard
                .prepare(
                    "SELECT id, name, enabled, priority, cooldown_secs, duration_secs, \
                     explanation_template, trigger_json, conditions_json, actions_json \
                     FROM rules WHERE enabled = 1 ORDER BY priority DESC, id ASC",
                )
                .context("prepare list_enabled")?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, Option<i64>>(4)?,
                        row.get::<_, Option<i64>>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                    ))
                })
                .context("query list_enabled")?;
            let mut out = Vec::new();
            for row in rows {
                let row = row.context("row decode")?;
                out.push(row_to_rule(row)?);
            }
            Ok(out)
        })
        .await
        .context("list_enabled join")?
    }
}
