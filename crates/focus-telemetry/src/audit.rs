// SPDX-License-Identifier: MIT OR Apache-2.0

//! # Audit Logging for Telemetry Flushes
//!
//! Every flush operation creates an audit record showing:
//! - Event count flushed
//! - Remote endpoint domain (for user verification)
//! - Timestamp
//!
//! This allows users to verify what data was sent and to whom.

use anyhow::Result;
use chrono::Utc;
use rusqlite::params;

/// Audit record for a telemetry flush operation.
#[derive(Debug, Clone)]
pub struct AuditRecord {
    pub id: i32,
    pub event_count: usize,
    pub endpoint_domain: String,
    pub flushed_at: String,
}

impl AuditRecord {
    /// Log a telemetry flush event to the audit table.
    pub fn log(
        conn: &rusqlite::Connection,
        event_count: usize,
        endpoint_domain: String,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO telemetry_audit (event_count, endpoint_domain, flushed_at)
             VALUES (?1, ?2, ?3)",
            params![event_count as i32, endpoint_domain, now],
        )?;
        Ok(())
    }

    /// Retrieve all audit records.
    pub fn all(conn: &rusqlite::Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, event_count, endpoint_domain, flushed_at FROM telemetry_audit ORDER BY flushed_at DESC LIMIT 1000"
        )?;

        let records = stmt
            .query_map([], |row| {
                Ok(AuditRecord {
                    id: row.get(0)?,
                    event_count: row.get::<_, i32>(1)? as usize,
                    endpoint_domain: row.get(2)?,
                    flushed_at: row.get(3)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(records)
    }

    /// Clear old audit records (older than retention_days).
    pub fn cleanup_old(conn: &rusqlite::Connection, retention_days: i32) -> Result<()> {
        let cutoff = format!(
            "datetime('now', '-{} days')",
            retention_days
        );
        conn.execute(
            &format!("DELETE FROM telemetry_audit WHERE flushed_at < {}", cutoff),
            [],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_audit_record_creation() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE telemetry_audit (
                id INTEGER PRIMARY KEY,
                event_count INTEGER NOT NULL,
                endpoint_domain TEXT,
                flushed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .unwrap();

        AuditRecord::log(&conn, 42, "api.example.com".to_string()).unwrap();

        let records = AuditRecord::all(&conn).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].event_count, 42);
        assert_eq!(records[0].endpoint_domain, "api.example.com");
    }

    #[test]
    fn test_multiple_audit_records() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE telemetry_audit (
                id INTEGER PRIMARY KEY,
                event_count INTEGER NOT NULL,
                endpoint_domain TEXT,
                flushed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .unwrap();

        AuditRecord::log(&conn, 10, "api1.example.com".to_string()).unwrap();
        AuditRecord::log(&conn, 20, "api2.example.com".to_string()).unwrap();

        let records = AuditRecord::all(&conn).unwrap();
        assert_eq!(records.len(), 2);
        // Most recent first
        assert_eq!(records[0].event_count, 20);
        assert_eq!(records[1].event_count, 10);
    }
}
