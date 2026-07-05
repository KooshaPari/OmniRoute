//! Schema introspection helpers.

use crate::error::StorageResult;

/// `true` if a table with the given name exists in the connected database.
pub async fn table_exists(pool: &sqlx::SqlitePool, name: &str) -> StorageResult<bool> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

/// List every user table in the database.
pub async fn list_tables(pool: &sqlx::SqlitePool) -> StorageResult<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(n,)| n).collect())
}

/// Latest applied migration version.
pub async fn schema_version(pool: &sqlx::SqlitePool) -> StorageResult<i64> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT MAX(version) FROM _sqlx_migrations",
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(v,)| v).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn list_tables_includes_core() {
        let (_dir, pool) = crate::pool::open_test().await.unwrap();
        let tables = list_tables(pool.pool()).await.unwrap();
        for required in &["tenants", "workspaces", "api_keys", "provider_records", "model_records", "call_logs", "combos", "feature_flags"] {
            assert!(tables.iter().any(|t| t == required), "missing table {required}");
        }
    }

    #[tokio::test]
    async fn table_exists_works() {
        let (_dir, pool) = crate::pool::open_test().await.unwrap();
        assert!(table_exists(pool.pool(), "tenants").await.unwrap());
        assert!(!table_exists(pool.pool(), "definitely_not_a_table").await.unwrap());
    }
}
