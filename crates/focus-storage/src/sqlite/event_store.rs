// SPDX-License-Identifier: MIT OR Apache-2.0

//! EventStore impl for SqliteAdapter.
//!
//! Traces to: FR-EVT-002, FR-DATA-001.

use anyhow::{Context, Result};
use async_trait::async_trait;
use focus_events::{DedupeKey, EventType, NormalizedEvent, TraceRef, WellKnownEventType};
use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use super::{parse_rfc3339, rfc3339, SqliteAdapter};
use crate::ports::EventStore;

fn event_type_to_string(et: &EventType) -> String {
    match et {
        EventType::WellKnown(wk) => wk.as_str().to_string(),
        EventType::Custom(s) => format!("Custom:{s}"),
    }
}

fn event_type_from_string(s: &str) -> EventType {
    if let Some(wk) = WellKnownEventType::from_canonical(s) {
        return EventType::WellKnown(wk);
    }
    if let Some(rest) = s.strip_prefix("Custom:") {
        EventType::Custom(rest.to_string())
    } else {
        EventType::Custom(s.to_string())
    }
}

#[async_trait]
impl EventStore for SqliteAdapter {
    async fn append(&self, event: NormalizedEvent) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            let guard = conn.blocking_lock();
            let raw_ref_json = match &event.raw_ref {
                Some(r) => Some(serde_json::to_string(r).context("serialize raw_ref")?),
                None => None,
            };
            let payload = serde_json::to_string(&event.payload).context("serialize payload")?;
            guard
                .execute(
                    "INSERT OR IGNORE INTO events (\
                        event_id, connector_id, account_id, event_type, occurred_at, \
                        effective_at, dedupe_key, confidence, payload, raw_ref\
                    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                    params![
                        event.event_id.to_string(),
                        event.connector_id,
                        event.account_id.to_string(),
                        event_type_to_string(&event.event_type),
                        rfc3339(event.occurred_at),
                        rfc3339(event.effective_at),
                        event.dedupe_key.0,
                        event.confidence as f64,
                        payload,
                        raw_ref_json,
                    ],
                )
                .context("insert event")?;
            Ok(())
        })
        .await
        .context("append join")?
    }

    async fn since_cursor(
        &self,
        cursor: Option<&str>,
        limit: usize,
    ) -> Result<Vec<NormalizedEvent>> {
        let conn = self.conn.clone();
        let cursor = cursor.map(|s| s.to_owned());
        tokio::task::spawn_blocking(move || -> Result<Vec<NormalizedEvent>> {
            let guard = conn.blocking_lock();
            let sql = "SELECT event_id, connector_id, account_id, event_type, occurred_at, \
                       effective_at, dedupe_key, confidence, payload, raw_ref \
                       FROM events \
                       WHERE (?1 IS NULL OR event_id > ?1) \
                       ORDER BY occurred_at ASC, event_id ASC \
                       LIMIT ?2";
            let mut stmt = guard.prepare(sql).context("prepare since_cursor")?;
            let rows = stmt
                .query_map(params![cursor, limit as i64], |row| {
                    let event_id: String = row.get(0)?;
                    let connector_id: String = row.get(1)?;
                    let account_id: String = row.get(2)?;
                    let event_type: String = row.get(3)?;
                    let occurred_at: String = row.get(4)?;
                    let effective_at: String = row.get(5)?;
                    let dedupe_key: String = row.get(6)?;
                    let confidence: f64 = row.get(7)?;
                    let payload: String = row.get(8)?;
                    let raw_ref: Option<String> = row.get(9)?;
                    Ok((
                        event_id,
                        connector_id,
                        account_id,
                        event_type,
                        occurred_at,
                        effective_at,
                        dedupe_key,
                        confidence,
                        payload,
                        raw_ref,
                    ))
                })
                .context("query since_cursor")?;
            let mut out = Vec::new();
            for row in rows {
                let (eid, cid, aid, et, occ, eff, ddk, conf, payload, raw_ref) =
                    row.context("row decode")?;
                let raw_ref: Option<TraceRef> = match raw_ref {
                    Some(s) => Some(serde_json::from_str(&s).context("deserialize raw_ref")?),
                    None => None,
                };
                let payload: serde_json::Value =
                    serde_json::from_str(&payload).context("deserialize payload")?;
                out.push(NormalizedEvent {
                    event_id: Uuid::parse_str(&eid).context("parse event_id")?,
                    connector_id: cid,
                    account_id: Uuid::parse_str(&aid).context("parse account_id")?,
                    event_type: event_type_from_string(&et),
                    occurred_at: parse_rfc3339(&occ)?,
                    effective_at: parse_rfc3339(&eff)?,
                    dedupe_key: DedupeKey(ddk),
                    confidence: conf as f32,
                    payload,
                    raw_ref,
                });
            }
            Ok(out)
        })
        .await
        .context("since_cursor join")?
    }
}

/// Look up an event by its unique id (test helper, not a port method).
pub async fn get_by_id(adapter: &SqliteAdapter, id: Uuid) -> Result<Option<NormalizedEvent>> {
    let conn = adapter.conn.clone();
    tokio::task::spawn_blocking(move || -> Result<Option<NormalizedEvent>> {
        let guard = conn.blocking_lock();
        let row = guard
            .query_row(
                "SELECT event_id, connector_id, account_id, event_type, occurred_at, \
                 effective_at, dedupe_key, confidence, payload, raw_ref \
                 FROM events WHERE event_id = ?1",
                params![id.to_string()],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, f64>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, Option<String>>(9)?,
                    ))
                },
            )
            .optional()
            .context("query get_by_id")?;
        let Some((eid, cid, aid, et, occ, eff, ddk, conf, payload, raw_ref)) = row else {
            return Ok(None);
        };
        let raw_ref: Option<TraceRef> = match raw_ref {
            Some(s) => Some(serde_json::from_str(&s).context("deserialize raw_ref")?),
            None => None,
        };
        let payload: serde_json::Value =
            serde_json::from_str(&payload).context("deserialize payload")?;
        Ok(Some(NormalizedEvent {
            event_id: Uuid::parse_str(&eid).context("parse event_id")?,
            connector_id: cid,
            account_id: Uuid::parse_str(&aid).context("parse account_id")?,
            event_type: event_type_from_string(&et),
            occurred_at: parse_rfc3339(&occ)?,
            effective_at: parse_rfc3339(&eff)?,
            dedupe_key: DedupeKey(ddk),
            confidence: conf as f32,
            payload,
            raw_ref,
        }))
    })
    .await
    .context("get_by_id join")?
}
