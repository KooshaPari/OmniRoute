//! `api_keys` repository: insert / lookup / revoke / touch.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;

use crate::error::StorageResult;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ApiKeyRow {
    pub id: String,
    pub name: String,
    pub scope: String,
    pub tier: String,
    pub hashed_secret: String,
    /// Unix epoch milliseconds.
    pub created_at: i64,
    pub last_used_at: Option<i64>,
    pub revoked_at: Option<i64>,
    pub metadata: String,
}

impl ApiKeyRow {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        scope: impl Into<String>,
        tier: impl Into<String>,
        hashed_secret: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            scope: scope.into(),
            tier: tier.into(),
            hashed_secret: hashed_secret.into(),
            created_at: Utc::now().timestamp_millis(),
            last_used_at: None,
            revoked_at: None,
            metadata: "{}".to_string(),
        }
    }

    pub fn is_revoked(&self) -> bool {
        self.revoked_at.is_some()
    }

    pub fn created_at_chrono(&self) -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp_millis(self.created_at).unwrap_or_else(Utc::now)
    }
}

/// Insert a row. Idempotent on `id` (UPDATEs the existing row on conflict).
pub async fn insert(pool: &SqlitePool, row: &ApiKeyRow) -> StorageResult<()> {
    sqlx::query(
        "INSERT INTO api_keys (id, name, scope, tier, hashed_secret, created_at, last_used_at, revoked_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             scope = excluded.scope,
             tier = excluded.tier,
             hashed_secret = excluded.hashed_secret,
             metadata = excluded.metadata"
    )
    .bind(&row.id)
    .bind(&row.name)
    .bind(&row.scope)
    .bind(&row.tier)
    .bind(&row.hashed_secret)
    .bind(row.created_at)
    .bind(row.last_used_at)
    .bind(row.revoked_at)
    .bind(&row.metadata)
    .execute(pool)
    .await?;
    Ok(())
}

/// Find by hashed secret. Used by the auth middleware.
pub async fn find_by_hashed_secret(
    pool: &SqlitePool,
    hashed: &str,
) -> StorageResult<Option<ApiKeyRow>> {
    let row: Option<ApiKeyRow> = sqlx::query_as::<_, ApiKeyRow>(
        "SELECT * FROM api_keys WHERE hashed_secret = ? LIMIT 1"
    )
    .bind(hashed)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// Revoke a key. Returns true if a row was actually updated.
pub async fn revoke(pool: &SqlitePool, id: &str) -> StorageResult<bool> {
    let now = Utc::now().timestamp_millis();
    let result = sqlx::query("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Bump `last_used_at` to the current wall-clock time.
pub async fn touch_last_used(pool: &SqlitePool, id: &str) -> StorageResult<()> {
    let now = Utc::now().timestamp_millis();
    sqlx::query("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_memory_pool, run_migrations};

    async fn fresh_pool() -> SqlitePool {
        let pool = open_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn upsert_then_find_by_hashed_secret() {
        let pool = fresh_pool().await;
        let row = ApiKeyRow::new("key_1", "first", "user", "free", "hash_a");
        insert(&pool, &row).await.unwrap();
        let got = find_by_hashed_secret(&pool, "hash_a").await.unwrap().unwrap();
        assert_eq!(got.id, "key_1");
        assert_eq!(got.name, "first");
    }

    #[tokio::test]
    async fn upsert_replaces_existing_row() {
        let pool = fresh_pool().await;
        let row = ApiKeyRow::new("key_1", "first", "user", "free", "hash_a");
        insert(&pool, &row).await.unwrap();
        let row2 = ApiKeyRow::new("key_1", "renamed", "admin", "paid", "hash_b");
        insert(&pool, &row2).await.unwrap();
        let got = find_by_hashed_secret(&pool, "hash_b").await.unwrap().unwrap();
        assert_eq!(got.name, "renamed");
        assert_eq!(got.scope, "admin");
    }

    #[tokio::test]
    async fn revoke_sets_revoked_at() {
        let pool = fresh_pool().await;
        let row = ApiKeyRow::new("key_1", "first", "user", "free", "hash_a");
        insert(&pool, &row).await.unwrap();
        assert!(revoke(&pool, "key_1").await.unwrap());
        let got = find_by_hashed_secret(&pool, "hash_a").await.unwrap().unwrap();
        assert!(got.is_revoked());
    }

    #[tokio::test]
    async fn revoke_returns_false_when_already_revoked() {
        let pool = fresh_pool().await;
        let row = ApiKeyRow::new("key_1", "first", "user", "free", "hash_a");
        insert(&pool, &row).await.unwrap();
        assert!(revoke(&pool, "key_1").await.unwrap());
        assert!(!revoke(&pool, "key_1").await.unwrap());
    }

    #[tokio::test]
    async fn touch_last_used_updates_timestamp() {
        let pool = fresh_pool().await;
        let row = ApiKeyRow::new("key_1", "first", "user", "free", "hash_a");
        insert(&pool, &row).await.unwrap();
        let before = find_by_hashed_secret(&pool, "hash_a").await.unwrap().unwrap();
        assert!(before.last_used_at.is_none());
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        touch_last_used(&pool, "key_1").await.unwrap();
        let after = find_by_hashed_secret(&pool, "hash_a").await.unwrap().unwrap();
        assert!(after.last_used_at.is_some());
        assert!(after.last_used_at.unwrap() >= before.created_at);
    }
}
