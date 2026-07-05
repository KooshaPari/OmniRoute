//! API key repository.

use async_trait::async_trait;
use chrono::Utc;
use sqlx::Row;

use super::ListParams;
use crate::error::{StorageError, StorageResult};
use crate::ids::{ApiKeyId, TenantId, WorkspaceId};
use crate::models::{ApiKey, ApiKeyStatus};

#[async_trait]
pub trait ApiKeyRepo: Send + Sync {
    async fn get(&self, id: ApiKeyId) -> StorageResult<Option<ApiKey>>;
    async fn get_by_hash(&self, key_hash: &str) -> StorageResult<Option<ApiKey>>;
    async fn list(&self, params: &ListParams) -> StorageResult<Vec<ApiKey>>;
    async fn create(&self, k: &ApiKey) -> StorageResult<ApiKey>;
    async fn revoke(&self, id: ApiKeyId) -> StorageResult<()>;
    async fn touch_last_used(&self, id: ApiKeyId) -> StorageResult<()>;
}

#[derive(Debug, Clone)]
pub struct SqliteApiKeyRepo {
    pool: sqlx::SqlitePool,
}

impl SqliteApiKeyRepo {
    #[must_use]
    pub fn new(pool: sqlx::SqlitePool) -> Self { Self { pool } }
}

#[async_trait]
impl ApiKeyRepo for SqliteApiKeyRepo {
    async fn get(&self, id: ApiKeyId) -> StorageResult<Option<ApiKey>> {
        let row = sqlx::query(&api_key_select_sql("WHERE id = ?"))
            .bind(id.0.simple().to_string())
            .fetch_optional(&self.pool)
            .await?;
        row.map(row_to_api_key).transpose()
    }

    async fn get_by_hash(&self, key_hash: &str) -> StorageResult<Option<ApiKey>> {
        let row = sqlx::query(&api_key_select_sql("WHERE key_hash = ?"))
            .bind(key_hash)
            .fetch_optional(&self.pool)
            .await?;
        row.map(row_to_api_key).transpose()
    }

    async fn list(&self, params: &ListParams) -> StorageResult<Vec<ApiKey>> {
        let limit = params.limit.max(1).min(1000) as i64;
        let offset = params.offset as i64;
        let rows = match params.tenant_id {
            Some(tid) => {
                sqlx::query(&format!(
                    "{} WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    api_key_select_base()
                ))
                .bind(tid.0.simple().to_string())
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
            }
            None => {
                sqlx::query(&format!(
                    "{} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    api_key_select_base()
                ))
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
            }
        };
        rows.into_iter().map(row_to_api_key).collect()
    }

    async fn create(&self, k: &ApiKey) -> StorageResult<ApiKey> {
        let res = sqlx::query(
            "INSERT INTO api_keys (id, tenant_id, workspace_id, key_hash, label, status, last_used_at, created_at, updated_at, expires_at, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(k.id.0.simple().to_string())
        .bind(k.tenant_id.0.simple().to_string())
        .bind(k.workspace_id.0.simple().to_string())
        .bind(&k.key_hash)
        .bind(&k.label)
        .bind(api_key_status_str(k.status))
        .bind(k.last_used_at.map(|t| t.to_rfc3339()))
        .bind(k.created_at.to_rfc3339())
        .bind(k.updated_at.to_rfc3339())
        .bind(k.expires_at.map(|t| t.to_rfc3339()))
        .bind(serde_json::to_string(&k.metadata).unwrap_or_else(|_| "{}".into()))
        .execute(&self.pool)
        .await;
        match res {
            Ok(_) => Ok(k.clone()),
            Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("2067") || e.code().as_deref() == Some("1555") => {
                Err(StorageError::duplicate("api_key", &k.key_hash))
            }
            Err(e) => Err(e.into()),
        }
    }

    async fn revoke(&self, id: ApiKeyId) -> StorageResult<()> {
        let res = sqlx::query(
            "UPDATE api_keys SET status = 'revoked', updated_at = ? WHERE id = ?",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(id.0.simple().to_string())
        .execute(&self.pool)
        .await?;
        if res.rows_affected() == 0 {
            return Err(StorageError::not_found("api_key", id.to_string()));
        }
        Ok(())
    }

    async fn touch_last_used(&self, id: ApiKeyId) -> StorageResult<()> {
        sqlx::query("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
            .bind(Utc::now().to_rfc3339())
            .bind(id.0.simple().to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

pub fn api_key_repo(pool: &sqlx::SqlitePool) -> Box<dyn ApiKeyRepo> {
    Box::new(SqliteApiKeyRepo::new(pool.clone()))
}

fn api_key_select_base() -> &'static str {
    "SELECT id, tenant_id, workspace_id, key_hash, label, status, last_used_at, created_at, updated_at, expires_at, metadata FROM api_keys"
}

fn api_key_select_sql(where_clause: &str) -> String {
    format!("{} {}", api_key_select_base(), where_clause)
}

fn row_to_api_key(row: sqlx::sqlite::SqliteRow) -> StorageResult<ApiKey> {
    let id: String = row.try_get("id")?;
    let tenant_id: String = row.try_get("tenant_id")?;
    let workspace_id: String = row.try_get("workspace_id")?;
    let key_hash: String = row.try_get("key_hash")?;
    let label: String = row.try_get("label")?;
    let status: String = row.try_get("status")?;
    let last_used_at: Option<String> = row.try_get("last_used_at")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;
    let expires_at: Option<String> = row.try_get("expires_at")?;
    let metadata_json: String = row.try_get("metadata")?;

    let id = uuid::Uuid::parse_str(&id).map_err(|e| StorageError::Other(format!("bad id: {e}")))?;
    let tenant_id = uuid::Uuid::parse_str(&tenant_id).map_err(|e| StorageError::Other(format!("bad tenant_id: {e}")))?;
    let workspace_id = uuid::Uuid::parse_str(&workspace_id).map_err(|e| StorageError::Other(format!("bad workspace_id: {e}")))?;
    let status = match status.as_str() {
        "active" => ApiKeyStatus::Active,
        "revoked" => ApiKeyStatus::Revoked,
        "expired" => ApiKeyStatus::Expired,
        _ => return Err(StorageError::Other(format!("bad status: {status}"))),
    };
    let last_used_at = last_used_at.map(|s| chrono::DateTime::parse_from_rfc3339(&s).map(|t| t.with_timezone(&Utc))).transpose().map_err(|e| StorageError::Other(format!("bad last_used_at: {e}")))?;
    let created_at = chrono::DateTime::parse_from_rfc3339(&created_at).map_err(|e| StorageError::Other(format!("bad created_at: {e}")))?.with_timezone(&Utc);
    let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at).map_err(|e| StorageError::Other(format!("bad updated_at: {e}")))?.with_timezone(&Utc);
    let expires_at = expires_at.map(|s| chrono::DateTime::parse_from_rfc3339(&s).map(|t| t.with_timezone(&Utc))).transpose().map_err(|e| StorageError::Other(format!("bad expires_at: {e}")))?;
    let metadata: indexmap::IndexMap<String, serde_json::Value> = serde_json::from_str(&metadata_json).unwrap_or_default();

    Ok(ApiKey {
        id: ApiKeyId(id),
        tenant_id: TenantId(tenant_id),
        workspace_id: WorkspaceId(workspace_id),
        key_hash,
        label,
        status,
        last_used_at,
        created_at,
        updated_at,
        expires_at,
        metadata,
    })
}

fn api_key_status_str(s: ApiKeyStatus) -> &'static str {
    match s {
        ApiKeyStatus::Active => "active",
        ApiKeyStatus::Revoked => "revoked",
        ApiKeyStatus::Expired => "expired",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Tenant;
    use crate::models::Workspace;
    use crate::pool::StoragePool;
    use crate::repo::tenant::tenant_repo;

    async fn fixture() -> (tempfile::TempDir, StoragePool, Box<dyn ApiKeyRepo>, TenantId, WorkspaceId) {
        let (dir, pool) = crate::pool::open_test().await.unwrap();
        let tr = tenant_repo(pool.pool());
        let now = Utc::now();
        let tenant = Tenant {
            id: TenantId::new(),
            slug: "t".into(),
            display_name: "T".into(),
            contact_email: None,
            status: crate::models::TenantStatus::Active,
            plan: crate::models::TenantPlan::Free,
            settings: indexmap::IndexMap::new(),
            created_at: now,
            updated_at: now,
        };
        tr.create(&tenant).await.unwrap();
        let ws = Workspace {
            id: WorkspaceId::new(),
            tenant_id: tenant.id,
            slug: "w".into(),
            display_name: "W".into(),
            created_at: now,
            updated_at: now,
        };
        sqlx::query("INSERT INTO workspaces (id, tenant_id, slug, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(ws.id.0.simple().to_string())
            .bind(ws.tenant_id.0.simple().to_string())
            .bind(&ws.slug)
            .bind(&ws.display_name)
            .bind(ws.created_at.to_rfc3339())
            .bind(ws.updated_at.to_rfc3339())
            .execute(pool.pool())
            .await
            .unwrap();
        let ar = api_key_repo(pool.pool());
        (dir, pool, ar, tenant.id, ws.id)
    }

    fn make_key(tenant_id: TenantId, workspace_id: WorkspaceId, label: &str) -> ApiKey {
        let now = Utc::now();
        ApiKey {
            id: ApiKeyId::new(),
            tenant_id,
            workspace_id,
            key_hash: format!("hash-{}", uuid::Uuid::new_v4()),
            label: label.into(),
            status: ApiKeyStatus::Active,
            last_used_at: None,
            created_at: now,
            updated_at: now,
            expires_at: None,
            metadata: indexmap::IndexMap::new(),
        }
    }

    #[tokio::test]
    async fn create_and_get_by_hash() {
        let (_dir, _pool, ar, t, w) = fixture().await;
        let k = make_key(t, w, "alpha");
        let key_hash = k.key_hash.clone();
        ar.create(&k).await.unwrap();
        let by_hash = ar.get_by_hash(&key_hash).await.unwrap().expect("found");
        assert_eq!(by_hash.id, k.id);
    }

    #[tokio::test]
    async fn revoke_marks_status() {
        let (_dir, _pool, ar, t, w) = fixture().await;
        let k = make_key(t, w, "beta");
        ar.create(&k).await.unwrap();
        ar.revoke(k.id).await.unwrap();
        let after = ar.get(k.id).await.unwrap().unwrap();
        assert_eq!(after.status, ApiKeyStatus::Revoked);
    }

    #[tokio::test]
    async fn list_filtered_by_tenant() {
        let (_dir, _pool, ar, t, w) = fixture().await;
        for i in 0..3 {
            ar.create(&make_key(t, w, &format!("k{i}"))).await.unwrap();
        }
        let list = ar.list(&ListParams::new().with_tenant(t)).await.unwrap();
        assert_eq!(list.len(), 3);
    }
}
