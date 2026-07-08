//! Daily rollup view over `call_logs` for usage analytics.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;

use crate::error::StorageResult;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct DailyUsage {
    pub day: NaiveDate,
    pub provider: String,
    pub model: String,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub total_tokens: i64,
    pub calls: i64,
}

/// Aggregate per-day, per-provider, per-model usage over the last `since_days` days.
pub async fn daily_rollup(
    pool: &SqlitePool,
    since_days: u32,
) -> StorageResult<Vec<DailyUsage>> {
    let since_ms = chrono::Utc::now().timestamp_millis() - (since_days as i64) * 24 * 60 * 60 * 1000;
    let rows: Vec<DailyUsage> = sqlx::query_as::<_, DailyUsage>(
        "SELECT
             date(created_at / 1000, 'unixepoch') AS day,
             provider,
             model,
             COALESCE(SUM(prompt_tokens), 0)     AS prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
             COALESCE(SUM(total_tokens), 0)      AS total_tokens,
             COUNT(*)                            AS calls
         FROM call_logs
         WHERE created_at >= ?
         GROUP BY day, provider, model
         ORDER BY day DESC, provider, model"
    )
    .bind(since_ms)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::call_logs::CallLogRow;
    use crate::db::{open_memory_pool, run_migrations};

    async fn fresh_pool() -> SqlitePool {
        let pool = open_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    fn row(provider: &str, model: &str, p: i32, c: i32, days_ago: i64) -> CallLogRow {
        let mut r = CallLogRow::new(format!("req-{provider}-{model}-{p}"), provider, model, 200);
        r.prompt_tokens = p;
        r.completion_tokens = c;
        r.total_tokens = p + c;
        r.created_at = chrono::Utc::now().timestamp_millis() - days_ago * 86_400_000;
        r
    }

    #[tokio::test]
    async fn daily_rollup_aggregates_per_day_provider_model() {
        let pool = fresh_pool().await;
        for _ in 0..3 {
            crate::call_logs::insert(&pool, &row("openai", "gpt-4o", 10, 5, 0)).await.unwrap();
        }
        for _ in 0..2 {
            crate::call_logs::insert(&pool, &row("openai", "gpt-4o-mini", 5, 2, 0)).await.unwrap();
        }
        for _ in 0..1 {
            crate::call_logs::insert(&pool, &row("anthropic", "claude-3-5-sonnet", 20, 10, 1)).await.unwrap();
        }
        let out = daily_rollup(&pool, 7).await.unwrap();
        // 3 distinct (day, provider, model) tuples
        assert_eq!(out.len(), 3, "got {:?}", out);
        let openai_mini = out.iter().find(|u| u.model == "gpt-4o-mini").unwrap();
        assert_eq!(openai_mini.calls, 2);
        assert_eq!(openai_mini.prompt_tokens, 10);
        assert_eq!(openai_mini.completion_tokens, 4);
    }
}
