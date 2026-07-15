//! SQLite connection pool with sane defaults for the OmniRoute data plane.

use std::path::{Path, PathBuf};
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use tracing::{info, instrument};

use crate::error::{StorageError, StorageResult};

/// Owns a `sqlx::SqlitePool` rooted at a specific data directory.
#[derive(Debug, Clone)]
pub struct StoragePool {
    inner: sqlx::SqlitePool,
    data_dir: PathBuf,
}

impl StoragePool {
    /// Open a pool on `{data_dir}/storage.sqlite`, running migrations on connect.
    #[instrument(skip(data_dir), fields(data_dir = %data_dir.as_ref().display()))]
    pub async fn open(data_dir: impl AsRef<Path>) -> StorageResult<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&data_dir)?;
        let db_file = data_dir.join("storage.sqlite");

        let opts = SqliteConnectOptions::new()
            .filename(&db_file)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(5))
            .foreign_keys(true);

        let inner = SqlitePoolOptions::new()
            .max_connections(16)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(opts)
            .await?;

        info!("storage pool opened; running migrations");
        crate::migrations::run(&inner).await.map_err(|e| StorageError::Migration(e.to_string()))?;

        Ok(Self { inner, data_dir })
    }

    /// Open a pool on an in-memory SQLite database (for tests).
    pub async fn open_in_memory() -> StorageResult<Self> {
        // Shared-cache in-memory so all pool connections see the same db
        // (otherwise migration on conn 1 is invisible to conn 2).
        let opts = SqliteConnectOptions::new()
            .filename("file::memory:?cache=shared")
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Memory)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true);

        let inner = SqlitePoolOptions::new()
            .max_connections(1)
            .min_connections(1)
            .connect_with(opts)
            .await?;

        crate::migrations::run(&inner).await.map_err(|e| StorageError::Migration(e.to_string()))?;

        Ok(Self { inner, data_dir: PathBuf::from(":memory:") })
    }

    /// Underlying pool for direct queries. Repos use this.
    pub fn pool(&self) -> &sqlx::SqlitePool {
        &self.inner
    }

    /// Data directory the pool was opened against.
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// Close the pool.
    pub async fn close(&self) {
        self.inner.close().await;
    }
}

/// Ergonomic builder for tests and one-off configurations.
#[derive(Debug, Default)]
pub struct StoragePoolBuilder {
    max_connections: Option<u32>,
    acquire_timeout: Option<Duration>,
}

impl StoragePoolBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn max_connections(mut self, n: u32) -> Self {
        self.max_connections = Some(n);
        self
    }

    #[must_use]
    pub fn acquire_timeout(mut self, t: Duration) -> Self {
        self.acquire_timeout = Some(t);
        self
    }

    pub async fn open(self, data_dir: impl AsRef<Path>) -> StorageResult<StoragePool> {
        let data_dir = data_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&data_dir)?;
        let db_file = data_dir.join("storage.sqlite");
        let mut opts = SqliteConnectOptions::new()
            .filename(&db_file)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(5))
            .foreign_keys(true);
        if let Some(t) = self.acquire_timeout {
            opts = opts.busy_timeout(t);
        }
        let mut pool_opts = SqlitePoolOptions::new();
        if let Some(n) = self.max_connections {
            pool_opts = pool_opts.max_connections(n);
        }
        let inner = pool_opts.acquire_timeout(Duration::from_secs(5)).connect_with(opts).await?;
        crate::migrations::run(&inner).await.map_err(|e| StorageError::Migration(e.to_string()))?;
        Ok(StoragePool { inner, data_dir })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn open_in_memory_runs_migrations() {
        let pool = StoragePool::open_in_memory().await.unwrap();
        let tables = crate::schema::list_tables(pool.pool()).await.unwrap();
        assert!(!tables.is_empty(), "expected at least one table after migrations");
        assert!(tables.iter().any(|t| t == "tenants"));
        assert!(tables.iter().any(|t| t == "api_keys"));
    }

    #[tokio::test]
    async fn close_releases_pool() {
        let (_dir, pool) = crate::pool::open_test().await.unwrap();
        pool.close().await;
    }
}

/// Open a pool rooted at a fresh temporary directory. Returns the temp
/// directory handle and the pool. When the `TempDir` is dropped, the
/// directory is removed. Used by tests to avoid shared-state races.
#[cfg(test)]
pub async fn open_test() -> std::result::Result<(tempfile::TempDir, StoragePool), StorageError> {
    use tempfile::TempDir;
    let dir = TempDir::new().map_err(StorageError::Io)?;
    let pool = StoragePool::open(dir.path()).await?;
    Ok((dir, pool))
}
