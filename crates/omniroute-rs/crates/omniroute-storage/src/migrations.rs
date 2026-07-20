//! Migration runner.
//!
//! Maintains a `schema_version` table. Version 1 delegates to
//! [`crate::schema::ensure_schema`] so Rust-side DDL stays canonical.
//! Historical quota tables from the removed `backend-rust` tree are deferred;
//! they are provenance-only and not restored here.

use crate::error::StorageError;
use crate::schema::{ensure_schema, SCHEMA_VERSION};
use sqlx::{SqliteConnection, SqlitePool};

/// A single migration.
pub struct Migration {
    /// Version (monotonically increasing).
    pub version: i64,
    /// Human-readable description.
    pub description: &'static str,
    /// SQL statements to apply.
    pub sql: &'static str,
}

/// Built-in migrations, in order.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "initial schema",
        sql: include_str!("../migrations/0001_initial.sql"),
    },
];

/// Apply all pending migrations.
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), StorageError> {
    ensure_schema(pool).await?;

    let mut conn = pool.acquire().await?;
    let current: Option<i64> = sqlx::query_scalar("SELECT MAX(version) FROM schema_version")
        .fetch_optional(&mut *conn)
        .await?
        .flatten();

    for mig in MIGRATIONS {
        if current.map(|c| c >= mig.version).unwrap_or(false) {
            continue;
        }
        run_migration(&mut conn, mig).await?;
    }
    Ok(())
}

async fn run_migration(
    conn: &mut SqliteConnection,
    mig: &Migration,
) -> Result<(), StorageError> {
    tracing::info!(version = mig.version, desc = mig.description, "applying migration");
    let mut tx = conn.begin().await?;
    for stmt in mig.sql.split(';') {
        let trimmed = stmt.trim();
        if trimmed.is_empty() {
            continue;
        }
        sqlx::query(trimmed).execute(&mut *tx).await.map_err(|e| {
            StorageError::Migration(format!("v{}: {e}: {trimmed}", mig.version))
        })?;
    }
    sqlx::query("INSERT OR IGNORE INTO schema_version (version, description) VALUES (?, ?)")
        .bind(mig.version)
        .bind(mig.description)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool::{open, PoolOptions};

    #[tokio::test]
    async fn migrations_are_idempotent() {
        let pool = open(PoolOptions::in_memory()).await.unwrap();
        run_migrations(&pool).await.unwrap();
        run_migrations(&pool).await.unwrap();
        let version: i64 = sqlx::query_scalar("SELECT MAX(version) FROM schema_version")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[tokio::test]
    async fn request_logs_is_canonical_log_table() {
        let pool = open(PoolOptions::in_memory()).await.unwrap();
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='request_logs'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(n, 1);
        let legacy: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='call_logs'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(legacy, 0);
    }
}
