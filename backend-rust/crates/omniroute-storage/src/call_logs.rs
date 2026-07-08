//! `call_logs` repository: insert + query for the canonical call log.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::{StorageError, StorageResult};

/// One row from the `call_logs` table. The struct mirrors the SQL schema
/// in `migrations/20260705000001_create_call_logs.sql`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct CallLogRow {
    /// UUID v4 (stored as a 16-byte blob).
    #[serde(skip)]
    pub id: Vec<u8>,
    pub request_id: String,
    /// Unix epoch milliseconds.
    pub created_at: i64,
    pub provider: String,
    pub model: String,
    pub key_id: Option<String>,
    pub status_code: i32,
    pub error: Option<String>,
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
    pub reasoning_tokens: Option<i32>,
    pub cached_tokens: Option<i32>,
    /// Cost in micro-dollars (1e-6 USD). Use i64 for headroom.
    pub cost_micros: Option<i64>,
    pub latency_ms: Option<i32>,
    /// Free-form JSON metadata (stored as a TEXT column).
    pub metadata: String,
    pub request_body: Option<String>,
    pub response_body: Option<String>,
}

impl CallLogRow {
    /// Build a new row from the canonical fields. `id` is a fresh UUID v4
    /// and `created_at` is set to the current wall-clock time in ms.
    pub fn new(
        request_id: impl Into<String>,
        provider: impl Into<String>,
        model: impl Into<String>,
        status_code: i32,
    ) -> Self {
        Self {
            id: Uuid::new_v4().as_bytes().to_vec(),
            request_id: request_id.into(),
            created_at: Utc::now().timestamp_millis(),
            provider: provider.into(),
            model: model.into(),
            key_id: None,
            status_code,
            error: None,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            reasoning_tokens: None,
            cached_tokens: None,
            cost_micros: None,
            latency_ms: None,
            metadata: "{}".to_string(),
            request_body: None,
            response_body: None,
        }
    }

    pub fn created_at_chrono(&self) -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp_millis(self.created_at).unwrap_or_else(Utc::now)
    }
}

/// Insert a row. Returns the SQLite `rowid` of the new entry.
pub async fn insert(pool: &SqlitePool, row: &CallLogRow) -> StorageResult<i64> {
    let result = sqlx::query(
        "INSERT INTO call_logs (
            id, request_id, created_at, provider, model, key_id, status_code, error,
            prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, cached_tokens,
            cost_micros, latency_ms, metadata, request_body, response_body
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&row.id)
    .bind(&row.request_id)
    .bind(row.created_at)
    .bind(&row.provider)
    .bind(&row.model)
    .bind(&row.key_id)
    .bind(row.status_code)
    .bind(&row.error)
    .bind(row.prompt_tokens)
    .bind(row.completion_tokens)
    .bind(row.total_tokens)
    .bind(row.reasoning_tokens)
    .bind(row.cached_tokens)
    .bind(row.cost_micros)
    .bind(row.latency_ms)
    .bind(&row.metadata)
    .bind(&row.request_body)
    .bind(&row.response_body)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

/// List the most recent N rows, ordered by `created_at` desc.
pub async fn list_recent(pool: &SqlitePool, limit: u32) -> StorageResult<Vec<CallLogRow>> {
    let rows: Vec<CallLogRow> = sqlx::query_as::<_, CallLogRow>(
        "SELECT * FROM call_logs ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Find one row by `request_id` (returns the most recent if duplicates exist).
pub async fn find_by_request_id(
    pool: &SqlitePool,
    request_id: &str,
) -> StorageResult<Option<CallLogRow>> {
    let row: Option<CallLogRow> = sqlx::query_as::<_, CallLogRow>(
        "SELECT * FROM call_logs WHERE request_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// Total row count.
pub async fn count(pool: &SqlitePool) -> StorageResult<i64> {
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM call_logs")
        .fetch_one(pool)
        .await?;
    Ok(n)
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
    async fn insert_then_find_by_request_id() {
        let pool = fresh_pool().await;
        let mut row = CallLogRow::new("req-1", "openai", "gpt-4o", 200);
        row.prompt_tokens = 5;
        row.completion_tokens = 3;
        row.total_tokens = 8;
        let rid = insert(&pool, &row).await.unwrap();
        assert!(rid > 0);
        let got = find_by_request_id(&pool, "req-1").await.unwrap().unwrap();
        assert_eq!(got.provider, "openai");
        assert_eq!(got.model, "gpt-4o");
        assert_eq!(got.total_tokens, 8);
    }

    #[tokio::test]
    async fn list_recent_orders_by_created_at_desc() {
        let pool = fresh_pool().await;
        for i in 0..3 {
            let row = CallLogRow::new(format!("req-{i}"), "openai", "gpt-4o", 200);
            insert(&pool, &row).await.unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
        let recent = list_recent(&pool, 2).await.unwrap();
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].request_id, "req-2");
        assert_eq!(recent[1].request_id, "req-1");
    }

    #[tokio::test]
    async fn count_returns_n() {
        let pool = fresh_pool().await;
        assert_eq!(count(&pool).await.unwrap(), 0);
        for i in 0..4 {
            let row = CallLogRow::new(format!("req-{i}"), "openai", "gpt-4o", 200);
            insert(&pool, &row).await.unwrap();
        }
        assert_eq!(count(&pool).await.unwrap(), 4);
    }

    #[tokio::test]
    async fn find_returns_none_for_missing_request() {
        let pool = fresh_pool().await;
        let got = find_by_request_id(&pool, "absent").await.unwrap();
        assert!(got.is_none());
    }
}
