// SPDX-License-Identifier: MIT OR Apache-2.0

//! Embedded SQL migrations for the focus-storage SQLite adapter.
//!
//! Traces to: FR-DATA-001.

use anyhow::{Context, Result};
use rusqlite::{params, Connection};

/// Ordered migrations. Each entry is `(version, sql)` where `sql` may contain
/// multiple statements separated by semicolons.
pub const MIGRATIONS: &[(u32, &str)] = &[
    (
        1,
        r#"
    CREATE TABLE IF NOT EXISTS events (
        event_id      TEXT PRIMARY KEY,
        connector_id  TEXT NOT NULL,
        account_id    TEXT NOT NULL,
        event_type    TEXT NOT NULL,
        occurred_at   TEXT NOT NULL,
        effective_at  TEXT NOT NULL,
        dedupe_key    TEXT NOT NULL UNIQUE,
        confidence    REAL NOT NULL,
        payload       TEXT NOT NULL,
        raw_ref       TEXT
    );
    CREATE INDEX IF NOT EXISTS events_occurred_at_idx ON events(occurred_at);

    CREATE TABLE IF NOT EXISTS rules (
        id                    TEXT PRIMARY KEY,
        name                  TEXT NOT NULL,
        enabled               INTEGER NOT NULL,
        priority              INTEGER NOT NULL,
        cooldown_secs         INTEGER,
        duration_secs         INTEGER,
        explanation_template  TEXT NOT NULL,
        trigger_json          TEXT NOT NULL,
        conditions_json       TEXT NOT NULL,
        actions_json          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet (
        user_id                TEXT PRIMARY KEY,
        earned                 INTEGER NOT NULL DEFAULT 0,
        spent                  INTEGER NOT NULL DEFAULT 0,
        multiplier_current     REAL    NOT NULL DEFAULT 1.0,
        multiplier_expires_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS wallet_streaks (
        user_id               TEXT NOT NULL,
        name                  TEXT NOT NULL,
        count                 INTEGER NOT NULL DEFAULT 0,
        last_incremented_at   TEXT,
        PRIMARY KEY (user_id, name)
    );

    CREATE TABLE IF NOT EXISTS wallet_unlocks (
        user_id  TEXT NOT NULL,
        key      TEXT NOT NULL,
        value    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS penalty_state (
        user_id             TEXT PRIMARY KEY,
        escalation_tier     TEXT NOT NULL,
        bypass_budget       INTEGER NOT NULL DEFAULT 0,
        debt_balance        INTEGER NOT NULL DEFAULT 0,
        strict_mode_until   TEXT
    );

    CREATE TABLE IF NOT EXISTS lockout_windows (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        starts_at  TEXT NOT NULL,
        ends_at    TEXT NOT NULL,
        reason     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS lockout_windows_user_idx ON lockout_windows(user_id);
    "#,
    ),
    (
        2,
        // Traces to: FR-EVT-003 (cursor persistence across restarts).
        r#"
    CREATE TABLE IF NOT EXISTS connector_cursors (
        connector_id  TEXT NOT NULL,
        entity_type   TEXT NOT NULL,
        cursor        TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        PRIMARY KEY (connector_id, entity_type)
    );
    "#,
    ),
    (
        3,
        // Traces to: FR-STATE-004 (persistent tamper-evident audit chain).
        r#"
    CREATE TABLE IF NOT EXISTS audit_records (
        id            TEXT PRIMARY KEY,
        record_type   TEXT NOT NULL,
        subject_ref   TEXT NOT NULL,
        occurred_at   TEXT NOT NULL,
        prev_hash     TEXT NOT NULL,
        payload       TEXT NOT NULL,
        hash          TEXT NOT NULL,
        seq           INTEGER NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS audit_records_seq_idx ON audit_records(seq);
    CREATE INDEX IF NOT EXISTS audit_records_subject_idx ON audit_records(subject_ref);
    "#,
    ),
    (
        4,
        // Traces to: FR-DATA-001, FR-PLAN-001 (persistent Task pool for rituals + scheduler).
        r#"
    CREATE TABLE IF NOT EXISTS tasks (
        id             TEXT PRIMARY KEY,
        user_id        TEXT NOT NULL,
        title          TEXT NOT NULL,
        status         TEXT NOT NULL,
        priority       INTEGER NOT NULL,
        duration_spec  TEXT NOT NULL,
        deadline       TEXT,
        chunking       TEXT NOT NULL,
        constraints    TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    "#,
    ),
    (
        5,
        // Traces to: FR-EVT-DEDUP-001 (canonical-hash deduplication + TTL expiry).
        r#"
    CREATE TABLE IF NOT EXISTS event_dedup (
        hash_key       BLOB PRIMARY KEY,
        first_seen_at  INTEGER NOT NULL,
        ttl_sec        INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_event_dedup_ttl ON event_dedup(first_seen_at);
    "#,
    ),
];

/// Apply all pending migrations in order.
///
/// Idempotent: re-running against an up-to-date DB is a no-op.
pub fn run(conn: &mut Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (\
            version    INTEGER PRIMARY KEY,\
            applied_at TEXT NOT NULL\
        )",
        [],
    )
    .context("create _migrations table")?;

    let applied: std::collections::BTreeSet<u32> = {
        let mut stmt = conn.prepare("SELECT version FROM _migrations")?;
        let rows = stmt.query_map([], |row| row.get::<_, i64>(0).map(|v| v as u32))?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    for (version, sql) in MIGRATIONS {
        if applied.contains(version) {
            continue;
        }
        let tx = conn.transaction().with_context(|| format!("begin migration {version}"))?;
        tx.execute_batch(sql).with_context(|| format!("apply migration {version}"))?;
        tx.execute(
            "INSERT INTO _migrations (version, applied_at) VALUES (?1, ?2)",
            params![*version as i64, chrono::Utc::now().to_rfc3339()],
        )
        .with_context(|| format!("record migration {version}"))?;
        tx.commit().with_context(|| format!("commit migration {version}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-DATA-001
    #[test]
    fn migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().expect("open");
        run(&mut conn).expect("first run");
        run(&mut conn).expect("second run");
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM _migrations", [], |r| r.get(0)).expect("count");
        assert_eq!(count, MIGRATIONS.len() as i64);
    }
}
