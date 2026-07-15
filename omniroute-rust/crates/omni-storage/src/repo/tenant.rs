//! Tenant repository.

use async_trait::async_trait;
use chrono::Utc;
use sqlx::Row;

use super::ListParams;
use crate::error::{StorageError, StorageResult};
use crate::ids::TenantId;
use crate::models::{Tenant, TenantPlan, TenantStatus};

#[async_trait]
pub trait TenantRepo: Send + Sync {
    async fn get(&self, id: TenantId) -> StorageResult<Option<Tenant>>;
    async fn get_by_slug(&self, slug: &str) -> StorageResult<Option<Tenant>>;
    async fn list(&self, params: &ListParams) -> StorageResult<Vec<Tenant>>;
    async fn create(&self, t: &Tenant) -> StorageResult<Tenant>;
    async fn update(&self, t: &Tenant) -> StorageResult<Tenant>;
    async fn delete(&self, id: TenantId) -> StorageResult<()>;
    async fn count(&self) -> StorageResult<u64>;
}

#[derive(Debug, Clone)]
pub struct SqliteTenantRepo {
    pool: sqlx::SqlitePool,
}

impl SqliteTenantRepo {
    #[must_use]
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TenantRepo for SqliteTenantRepo {
    async fn get(&self, id: TenantId) -> StorageResult<Option<Tenant>> {
        let row = sqlx::query("SELECT id, slug, display_name, contact_email, status, plan, settings, created_at, updated_at FROM tenants WHERE id = ?")
            .bind(id.0.simple().to_string())
            .fetch_optional(&self.pool)
            .await?;
        row.map(row_to_tenant).transpose()
    }

    async fn get_by_slug(&self, slug: &str) -> StorageResult<Option<Tenant>> {
        let row = sqlx::query("SELECT id, slug, display_name, contact_email, status, plan, settings, created_at, updated_at FROM tenants WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.pool)
            .await?;
        row.map(row_to_tenant).transpose()
    }

    async fn list(&self, params: &ListParams) -> StorageResult<Vec<Tenant>> {
        let limit = params.limit.max(1).min(1000) as i64;
        let offset = params.offset as i64;
        let rows = sqlx::query(
            "SELECT id, slug, display_name, contact_email, status, plan, settings, created_at, updated_at
             FROM tenants
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(row_to_tenant).collect()
    }

    async fn create(&self, t: &Tenant) -> StorageResult<Tenant> {
        let res = sqlx::query(
            "INSERT INTO tenants (id, slug, display_name, contact_email, status, plan, settings, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(t.id.0.simple().to_string())
        .bind(&t.slug)
        .bind(&t.display_name)
        .bind(&t.contact_email)
        .bind(tenant_status_str(t.status))
        .bind(tenant_plan_str(t.plan))
        .bind(serde_json::to_string(&t.settings).unwrap_or_else(|_| "{}".into()))
        .bind(t.created_at.to_rfc3339())
        .bind(t.updated_at.to_rfc3339())
        .execute(&self.pool)
        .await;
        match res {
            Ok(_) => Ok(t.clone()),
            Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("2067") || e.code().as_deref() == Some("1555") => {
                Err(StorageError::duplicate("tenant", &t.slug))
            }
            Err(e) => Err(e.into()),
        }
    }

    async fn update(&self, t: &Tenant) -> StorageResult<Tenant> {
        let res = sqlx::query(
            "UPDATE tenants SET slug = ?, display_name = ?, contact_email = ?, status = ?, plan = ?, settings = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&t.slug)
        .bind(&t.display_name)
        .bind(&t.contact_email)
        .bind(tenant_status_str(t.status))
        .bind(tenant_plan_str(t.plan))
        .bind(serde_json::to_string(&t.settings).unwrap_or_else(|_| "{}".into()))
        .bind(Utc::now().to_rfc3339())
        .bind(t.id.0.simple().to_string())
        .execute(&self.pool)
        .await?;
        if res.rows_affected() == 0 {
            return Err(StorageError::not_found("tenant", t.id.to_string()));
        }
        Ok(t.clone())
    }

    async fn delete(&self, id: TenantId) -> StorageResult<()> {
        let res = sqlx::query("DELETE FROM tenants WHERE id = ?")
            .bind(id.0.simple().to_string())
            .execute(&self.pool)
            .await?;
        if res.rows_affected() == 0 {
            return Err(StorageError::not_found("tenant", id.to_string()));
        }
        Ok(())
    }

    async fn count(&self) -> StorageResult<u64> {
        let row = sqlx::query("SELECT COUNT(*) AS c FROM tenants")
            .fetch_one(&self.pool)
            .await?;
        let c: i64 = row.try_get("c")?;
        Ok(c as u64)
    }
}

pub fn tenant_repo(pool: &sqlx::SqlitePool) -> Box<dyn TenantRepo> {
    Box::new(SqliteTenantRepo::new(pool.clone()))
}

fn row_to_tenant(row: sqlx::sqlite::SqliteRow) -> StorageResult<Tenant> {
    let id: String = row.try_get("id")?;
    let slug: String = row.try_get("slug")?;
    let display_name: String = row.try_get("display_name")?;
    let contact_email: Option<String> = row.try_get("contact_email")?;
    let status: String = row.try_get("status")?;
    let plan: String = row.try_get("plan")?;
    let settings_json: String = row.try_get("settings")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;

    let id = uuid::Uuid::parse_str(&id).map_err(|e| StorageError::Other(format!("bad tenant id: {e}")))?;
    let status = match status.as_str() {
        "active" => TenantStatus::Active,
        "suspended" => TenantStatus::Suspended,
        "deleted" => TenantStatus::Deleted,
        _ => return Err(StorageError::Other(format!("bad tenant status: {status}"))),
    };
    let plan = match plan.as_str() {
        "free" => TenantPlan::Free,
        "pro" => TenantPlan::Pro,
        "enterprise" => TenantPlan::Enterprise,
        "internal" => TenantPlan::Internal,
        _ => return Err(StorageError::Other(format!("bad tenant plan: {plan}"))),
    };
    let settings: indexmap::IndexMap<String, serde_json::Value> = serde_json::from_str(&settings_json).unwrap_or_default();
    let created_at = chrono::DateTime::parse_from_rfc3339(&created_at).map_err(|e| StorageError::Other(format!("bad created_at: {e}")))?.with_timezone(&Utc);
    let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at).map_err(|e| StorageError::Other(format!("bad updated_at: {e}")))?.with_timezone(&Utc);

    Ok(Tenant {
        id: TenantId(id),
        slug,
        display_name,
        contact_email,
        status,
        plan,
        settings,
        created_at,
        updated_at,
    })
}

fn tenant_status_str(s: TenantStatus) -> &'static str {
    match s {
        TenantStatus::Active => "active",
        TenantStatus::Suspended => "suspended",
        TenantStatus::Deleted => "deleted",
    }
}

fn tenant_plan_str(p: TenantPlan) -> &'static str {
    match p {
        TenantPlan::Free => "free",
        TenantPlan::Pro => "pro",
        TenantPlan::Enterprise => "enterprise",
        TenantPlan::Internal => "internal",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool::StoragePool;

    async fn fresh_repo() -> (tempfile::TempDir, StoragePool, Box<dyn TenantRepo>) {
        let (dir, pool) = crate::pool::open_test().await.unwrap();
        let repo = tenant_repo(pool.pool());
        (dir, pool, repo)
    }

    fn make_tenant(slug: &str) -> Tenant {
        let now = Utc::now();
        Tenant {
            id: TenantId::new(),
            slug: slug.into(),
            display_name: format!("{slug} display"),
            contact_email: None,
            status: TenantStatus::Active,
            plan: TenantPlan::Free,
            settings: indexmap::IndexMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    #[tokio::test]
    async fn create_get_delete_round_trip() {
        let (_dir, _pool, repo) = fresh_repo().await;
        let t = make_tenant("acme");
        let created = repo.create(&t).await.unwrap();
        assert_eq!(created.id, t.id);

        let fetched = repo.get(t.id).await.unwrap().expect("tenant exists");
        assert_eq!(fetched.slug, "acme");
        assert_eq!(fetched.status, TenantStatus::Active);

        let by_slug = repo.get_by_slug("acme").await.unwrap().expect("by slug");
        assert_eq!(by_slug.id, t.id);

        repo.delete(t.id).await.unwrap();
        let after = repo.get(t.id).await.unwrap();
        assert!(after.is_none());
    }

    #[tokio::test]
    async fn duplicate_slug_fails() {
        let (_dir, _pool, repo) = fresh_repo().await;
        let t1 = make_tenant("dup");
        let t2 = make_tenant("dup");
        repo.create(&t1).await.unwrap();
        let err = repo.create(&t2).await.unwrap_err();
        assert!(matches!(err, StorageError::Duplicate { .. }));
    }

    #[tokio::test]
    async fn list_and_count() {
        let (_dir, _pool, repo) = fresh_repo().await;
        for s in &["a", "b", "c"] {
            repo.create(&make_tenant(s)).await.unwrap();
        }
        let list = repo.list(&ListParams::new().with_limit(10)).await.unwrap();
        assert_eq!(list.len(), 3);
        let count = repo.count().await.unwrap();
        assert_eq!(count, 3);
    }

    #[tokio::test]
    async fn delete_missing_errors() {
        let (_dir, _pool, repo) = fresh_repo().await;
        let err = repo.delete(TenantId::new()).await.unwrap_err();
        assert!(matches!(err, StorageError::NotFound { .. }));
    }
}
