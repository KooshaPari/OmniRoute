//! Database connection management. The pool is configured for WAL mode,
//! 4 connections, and a 5-second busy timeout. Test code uses `:memory:`
//! with a single connection (each `:memory:` is per-connection).

use std::path::Path;
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::error::{StorageError, StorageResult};

/// Open a new SQLite pool rooted at the given path (or `:memory:`).
pub async fn open_pool<P: AsRef<Path>>(path: P) -> StorageResult<SqlitePool> {
    let opts = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(opts)
        .await?;
    Ok(pool)
}

/// Open a single-connection `:memory:` pool, suitable for tests.
pub async fn open_memory_pool() -> StorageResult<SqlitePool> {
    let opts = SqliteConnectOptions::new()
        .filename(":memory:")
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await?;
    Ok(pool)
}

/// Run all embedded migrations against the given pool. Idempotent.
pub async fn run_migrations(pool: &SqlitePool) -> StorageResult<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrations_apply_clean_to_empty_db() {
        let pool = open_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        // The tables must exist.
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('call_logs','api_keys')")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(n, 2, "expected 2 tables, got {n}");
    }

    #[tokio::test]
    async fn migrations_are_idempotent() {
        let pool = open_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        // Running twice must not error.
        run_migrations(&pool).await.unwrap();
    }
}
