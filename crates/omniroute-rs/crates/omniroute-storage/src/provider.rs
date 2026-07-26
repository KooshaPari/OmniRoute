//! Provider repository — CRUD over the `providers` table (P4-R1).

use crate::error::StorageError;
use omniroute_core::provider::{ProviderConfig, ProviderKind};
use sqlx::Row;
use sqlx::SqlitePool;
use std::collections::HashMap;

/// Provider persistence handle.
pub struct ProviderRepo<'a> {
    pool: &'a SqlitePool,
}

impl<'a> ProviderRepo<'a> {
    /// Create a repo bound to `pool`.
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    /// Fetch one provider by id.
    pub async fn get(&self, id: &str) -> Result<ProviderConfig, StorageError> {
        let row = sqlx::query(
            "SELECT id, name, kind, base_url, default_model, models_json, api_key_env, \
                    headers_json, timeout_ms, max_retries, enabled, priority, weight, region, \
                    tags_json, cost_tier, quality_tier, latency_tier \
             FROM providers WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("provider {id}")))?;
        row_to_provider(row)
    }

    /// List all providers ordered by priority then name.
    pub async fn list(&self) -> Result<Vec<ProviderConfig>, StorageError> {
        let rows = sqlx::query(
            "SELECT id, name, kind, base_url, default_model, models_json, api_key_env, \
                    headers_json, timeout_ms, max_retries, enabled, priority, weight, region, \
                    tags_json, cost_tier, quality_tier, latency_tier \
             FROM providers ORDER BY priority ASC, name ASC",
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_provider).collect()
    }

    /// Insert a provider. Does not persist plaintext `api_key` (use env / encrypted column later).
    pub async fn insert(&self, p: &ProviderConfig) -> Result<(), StorageError> {
        if p.id.trim().is_empty() {
            return Err(StorageError::Validation("provider id required".into()));
        }
        if p.name.trim().is_empty() {
            return Err(StorageError::Validation("provider name required".into()));
        }
        if p.base_url.trim().is_empty() {
            return Err(StorageError::Validation("provider base_url required".into()));
        }
        let kind = kind_to_str(p.kind);
        let result = sqlx::query(
            "INSERT INTO providers (\
                id, name, kind, base_url, default_model, models_json, api_key_env, headers_json, \
                timeout_ms, max_retries, enabled, priority, weight, region, tags_json, \
                cost_tier, quality_tier, latency_tier\
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.id)
        .bind(&p.name)
        .bind(kind)
        .bind(&p.base_url)
        .bind(&p.default_model)
        .bind(serde_json::to_string(&p.models)?)
        .bind(&p.api_key_env)
        .bind(serde_json::to_string(&p.headers)?)
        .bind(p.timeout_ms as i64)
        .bind(p.max_retries as i64)
        .bind(i64::from(p.enabled))
        .bind(p.priority as i64)
        .bind(p.weight as i64)
        .bind(&p.region)
        .bind(serde_json::to_string(&p.tags)?)
        .bind(i64::from(p.cost_tier))
        .bind(i64::from(p.quality_tier))
        .bind(i64::from(p.latency_tier))
        .execute(self.pool)
        .await;

        match result {
            Ok(_) => Ok(()),
            Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
                Err(StorageError::Conflict(format!("provider {}", p.id)))
            }
            Err(e) => Err(e.into()),
        }
    }

    /// Replace an existing provider row.
    pub async fn update(&self, p: &ProviderConfig) -> Result<(), StorageError> {
        let kind = kind_to_str(p.kind);
        let n = sqlx::query(
            "UPDATE providers SET \
                name = ?, kind = ?, base_url = ?, default_model = ?, models_json = ?, \
                api_key_env = ?, headers_json = ?, timeout_ms = ?, max_retries = ?, enabled = ?, \
                priority = ?, weight = ?, region = ?, tags_json = ?, cost_tier = ?, \
                quality_tier = ?, latency_tier = ?, updated_at = datetime('now') \
             WHERE id = ?",
        )
        .bind(&p.name)
        .bind(kind)
        .bind(&p.base_url)
        .bind(&p.default_model)
        .bind(serde_json::to_string(&p.models)?)
        .bind(&p.api_key_env)
        .bind(serde_json::to_string(&p.headers)?)
        .bind(p.timeout_ms as i64)
        .bind(p.max_retries as i64)
        .bind(i64::from(p.enabled))
        .bind(p.priority as i64)
        .bind(p.weight as i64)
        .bind(&p.region)
        .bind(serde_json::to_string(&p.tags)?)
        .bind(i64::from(p.cost_tier))
        .bind(i64::from(p.quality_tier))
        .bind(i64::from(p.latency_tier))
        .bind(&p.id)
        .execute(self.pool)
        .await?
        .rows_affected();
        if n == 0 {
            return Err(StorageError::NotFound(format!("provider {}", p.id)));
        }
        Ok(())
    }

    /// Delete a provider by id.
    pub async fn delete(&self, id: &str) -> Result<(), StorageError> {
        let n = sqlx::query("DELETE FROM providers WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await?
            .rows_affected();
        if n == 0 {
            return Err(StorageError::NotFound(format!("provider {id}")));
        }
        Ok(())
    }
}

fn kind_to_str(kind: ProviderKind) -> String {
    serde_json::to_value(kind)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_else(|| "extension".to_string())
}

fn str_to_kind(raw: &str) -> ProviderKind {
    serde_json::from_value(serde_json::Value::String(raw.to_string())).unwrap_or(ProviderKind::Extension)
}

fn row_to_provider(row: sqlx::sqlite::SqliteRow) -> Result<ProviderConfig, StorageError> {
    let models_json: String = row.try_get("models_json").unwrap_or_else(|_| "{}".into());
    let headers_json: String = row.try_get("headers_json").unwrap_or_else(|_| "{}".into());
    let tags_json: String = row.try_get("tags_json").unwrap_or_else(|_| "[]".into());
    let kind_raw: String = row.try_get("kind")?;
    let enabled: i64 = row.try_get("enabled").unwrap_or(1);
    Ok(ProviderConfig {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        kind: str_to_kind(&kind_raw),
        base_url: row.try_get("base_url")?,
        default_model: row.try_get("default_model").ok(),
        models: serde_json::from_str(&models_json).unwrap_or_default(),
        api_key: None,
        api_key_env: row.try_get("api_key_env").ok(),
        headers: serde_json::from_str(&headers_json).unwrap_or_else(|_| HashMap::new()),
        timeout_ms: row.try_get::<i64, _>("timeout_ms").unwrap_or(60_000) as u64,
        max_retries: row.try_get::<i64, _>("max_retries").unwrap_or(0) as u32,
        enabled: enabled != 0,
        priority: row.try_get::<i64, _>("priority").unwrap_or(0) as i32,
        weight: row.try_get::<i64, _>("weight").unwrap_or(100) as u32,
        region: row.try_get("region").ok(),
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        cost_tier: row.try_get::<i64, _>("cost_tier").unwrap_or(3) as u8,
        quality_tier: row.try_get::<i64, _>("quality_tier").unwrap_or(3) as u8,
        latency_tier: row.try_get::<i64, _>("latency_tier").unwrap_or(3) as u8,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool::{open, PoolOptions};
    use omniroute_core::provider::ProviderKind;

    fn sample(id: &str) -> ProviderConfig {
        ProviderConfig {
            id: id.into(),
            name: "OpenAI".into(),
            kind: ProviderKind::OpenaiChat,
            base_url: "https://api.openai.com/v1".into(),
            default_model: Some("gpt-4o".into()),
            models: HashMap::from([("gpt-4o".into(), "gpt-4o".into())]),
            api_key: None,
            api_key_env: Some("OPENAI_API_KEY".into()),
            headers: HashMap::new(),
            timeout_ms: 30_000,
            max_retries: 1,
            enabled: true,
            priority: 10,
            weight: 100,
            region: Some("us".into()),
            tags: vec!["cloud".into()],
            cost_tier: 3,
            quality_tier: 5,
            latency_tier: 2,
        }
    }

    #[tokio::test]
    async fn crud_round_trip() {
        let pool = open(PoolOptions::in_memory()).await.unwrap();
        let repo = ProviderRepo::new(&pool);

        let p = sample("openai");
        repo.insert(&p).await.unwrap();
        let got = repo.get("openai").await.unwrap();
        assert_eq!(got.id, "openai");
        assert_eq!(got.name, "OpenAI");
        assert_eq!(got.kind, ProviderKind::OpenaiChat);
        assert_eq!(got.default_model.as_deref(), Some("gpt-4o"));
        assert_eq!(got.api_key_env.as_deref(), Some("OPENAI_API_KEY"));
        assert!(got.api_key.is_none());

        let mut updated = got.clone();
        updated.name = "OpenAI Cloud".into();
        updated.enabled = false;
        repo.update(&updated).await.unwrap();
        let got2 = repo.get("openai").await.unwrap();
        assert_eq!(got2.name, "OpenAI Cloud");
        assert!(!got2.enabled);

        let listed = repo.list().await.unwrap();
        assert_eq!(listed.len(), 1);

        repo.delete("openai").await.unwrap();
        assert!(matches!(
            repo.get("openai").await,
            Err(StorageError::NotFound(_))
        ));
    }

    #[tokio::test]
    async fn insert_conflict_and_validation() {
        let pool = open(PoolOptions::in_memory()).await.unwrap();
        let repo = ProviderRepo::new(&pool);
        repo.insert(&sample("a")).await.unwrap();
        assert!(matches!(
            repo.insert(&sample("a")).await,
            Err(StorageError::Conflict(_))
        ));
        let mut bad = sample("b");
        bad.id.clear();
        assert!(matches!(
            repo.insert(&bad).await,
            Err(StorageError::Validation(_))
        ));
    }
}
