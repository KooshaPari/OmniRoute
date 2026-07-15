//! Call log repository. Inserts are append-only; aggregates are pre-computed
//! for hot dashboard queries.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::Row;

use super::ListParams;
use crate::error::{StorageError, StorageResult};
use crate::ids::{ApiKeyId, CallLogId, ModelId, ProviderRecordId, SessionId, TenantId, WorkspaceId};
use crate::models::{CallLog, CallLogStatus};

#[async_trait]
pub trait CallLogRepo: Send + Sync {
    async fn get(&self, id: CallLogId) -> StorageResult<Option<CallLog>>;
    async fn insert(&self, log: &CallLog) -> StorageResult<CallLog>;
    async fn list_by_tenant(&self, params: &ListParams) -> StorageResult<Vec<CallLog>>;
    async fn list_by_request_id(&self, request_id: &str) -> StorageResult<Vec<CallLog>>;
    async fn aggregate(&self, tenant_id: TenantId, since: DateTime<Utc>) -> StorageResult<CallLogStats>;
    async fn count_since(&self, tenant_id: TenantId, since: DateTime<Utc>) -> StorageResult<u64>;
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct CallLogStats {
    pub total: u64,
    pub success: u64,
    pub errors: u64,
    pub total_tokens: u64,
    pub total_cost_usd: f64,
    pub p50_duration_ms: u32,
    pub p99_duration_ms: u32,
}

#[derive(Debug, Clone)]
pub struct SqliteCallLogRepo {
    pool: sqlx::SqlitePool,
}

impl SqliteCallLogRepo {
    #[must_use]
    pub fn new(pool: sqlx::SqlitePool) -> Self { Self { pool } }
}

#[async_trait]
impl CallLogRepo for SqliteCallLogRepo {
    async fn get(&self, id: CallLogId) -> StorageResult<Option<CallLog>> {
        let row = sqlx::query(&call_log_select_sql("WHERE id = ?"))
            .bind(id.0.simple().to_string())
            .fetch_optional(&self.pool)
            .await?;
        row.map(row_to_call_log).transpose()
    }

    async fn insert(&self, log: &CallLog) -> StorageResult<CallLog> {
        sqlx::query(
            "INSERT INTO call_logs
             (id, tenant_id, workspace_id, api_key_id, provider_id, model_id, model_name, status, http_status,
              prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, started_at, finished_at,
              error_kind, error_message, request_id, session_id, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(log.id.0.simple().to_string())
        .bind(log.tenant_id.0.simple().to_string())
        .bind(log.workspace_id.0.simple().to_string())
        .bind(log.api_key_id.map(|x| x.0.simple().to_string()))
        .bind(log.provider_id.map(|x| x.0.simple().to_string()))
        .bind(log.model_id.map(|x| x.0.simple().to_string()))
        .bind(&log.model_name)
        .bind(call_log_status_str(log.status))
        .bind(log.http_status.map(|x| x as i64))
        .bind(log.prompt_tokens as i64)
        .bind(log.completion_tokens as i64)
        .bind(log.total_tokens as i64)
        .bind(log.cost_usd)
        .bind(log.duration_ms as i64)
        .bind(log.started_at.to_rfc3339())
        .bind(log.finished_at.map(|t| t.to_rfc3339()))
        .bind(&log.error_kind)
        .bind(&log.error_message)
        .bind(&log.request_id)
        .bind(log.session_id.map(|x| x.0.simple().to_string()))
        .bind(serde_json::to_string(&log.metadata).unwrap_or_else(|_| "{}".into()))
        .execute(&self.pool)
        .await?;
        Ok(log.clone())
    }

    async fn list_by_tenant(&self, params: &ListParams) -> StorageResult<Vec<CallLog>> {
        let tenant_id = params.tenant_id.ok_or_else(|| StorageError::Config("tenant_id required".into()))?;
        let limit = params.limit.max(1).min(1000) as i64;
        let offset = params.offset as i64;
        let rows = sqlx::query(&format!("{} WHERE tenant_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?", call_log_select_base()))
            .bind(tenant_id.0.simple().to_string())
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;
        rows.into_iter().map(row_to_call_log).collect()
    }

    async fn list_by_request_id(&self, request_id: &str) -> StorageResult<Vec<CallLog>> {
        let rows = sqlx::query(&format!("{} WHERE request_id = ? ORDER BY started_at ASC", call_log_select_base()))
            .bind(request_id)
            .fetch_all(&self.pool)
            .await?;
        rows.into_iter().map(row_to_call_log).collect()
    }

    async fn aggregate(&self, tenant_id: TenantId, since: DateTime<Utc>) -> StorageResult<CallLogStats> {
        let row = sqlx::query(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                COALESCE(SUM(total_tokens), 0) AS total_tokens,
                COALESCE(SUM(cost_usd), 0.0) AS total_cost,
                COALESCE(MAX(duration_ms), 0) AS max_dur
             FROM call_logs WHERE tenant_id = ? AND started_at >= ?",
        )
        .bind(tenant_id.0.simple().to_string())
        .bind(since.to_rfc3339())
        .fetch_one(&self.pool)
        .await?;
        Ok(CallLogStats {
            total: row.try_get::<i64, _>("total")? as u64,
            success: row.try_get::<i64, _>("success")? as u64,
            errors: row.try_get::<i64, _>("errors")? as u64,
            total_tokens: row.try_get::<i64, _>("total_tokens")? as u64,
            total_cost_usd: row.try_get::<f64, _>("total_cost")?,
            p50_duration_ms: 0, // Percentiles need a separate query; placeholder for v1.
            p99_duration_ms: 0,
        })
    }

    async fn count_since(&self, tenant_id: TenantId, since: DateTime<Utc>) -> StorageResult<u64> {
        let row = sqlx::query("SELECT COUNT(*) AS c FROM call_logs WHERE tenant_id = ? AND started_at >= ?")
            .bind(tenant_id.0.simple().to_string())
            .bind(since.to_rfc3339())
            .fetch_one(&self.pool)
            .await?;
        let c: i64 = row.try_get("c")?;
        Ok(c as u64)
    }
}

pub fn call_log_repo(pool: &sqlx::SqlitePool) -> Box<dyn CallLogRepo> {
    Box::new(SqliteCallLogRepo::new(pool.clone()))
}

fn call_log_select_base() -> &'static str {
    "SELECT id, tenant_id, workspace_id, api_key_id, provider_id, model_id, model_name, status, http_status,
            prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, started_at, finished_at,
            error_kind, error_message, request_id, session_id, metadata FROM call_logs"
}

fn call_log_select_sql(where_clause: &str) -> String {
    format!("{} {}", call_log_select_base(), where_clause)
}

fn row_to_call_log(row: sqlx::sqlite::SqliteRow) -> StorageResult<CallLog> {
    let id: String = row.try_get("id")?;
    let tenant_id: String = row.try_get("tenant_id")?;
    let workspace_id: String = row.try_get("workspace_id")?;
    let api_key_id: Option<String> = row.try_get("api_key_id")?;
    let provider_id: Option<String> = row.try_get("provider_id")?;
    let model_id: Option<String> = row.try_get("model_id")?;
    let model_name: String = row.try_get("model_name")?;
    let status: String = row.try_get("status")?;
    let http_status: Option<i64> = row.try_get("http_status")?;
    let prompt_tokens: i64 = row.try_get("prompt_tokens")?;
    let completion_tokens: i64 = row.try_get("completion_tokens")?;
    let total_tokens: i64 = row.try_get("total_tokens")?;
    let cost_usd: Option<f64> = row.try_get("cost_usd")?;
    let duration_ms: i64 = row.try_get("duration_ms")?;
    let started_at: String = row.try_get("started_at")?;
    let finished_at: Option<String> = row.try_get("finished_at")?;
    let error_kind: Option<String> = row.try_get("error_kind")?;
    let error_message: Option<String> = row.try_get("error_message")?;
    let request_id: String = row.try_get("request_id")?;
    let session_id: Option<String> = row.try_get("session_id")?;
    let metadata_json: String = row.try_get("metadata")?;

    let id = uuid::Uuid::parse_str(&id).map_err(|e| StorageError::Other(format!("bad id: {e}")))?;
    let tenant_id = uuid::Uuid::parse_str(&tenant_id).map_err(|e| StorageError::Other(format!("bad tenant_id: {e}")))?;
    let workspace_id = uuid::Uuid::parse_str(&workspace_id).map_err(|e| StorageError::Other(format!("bad workspace_id: {e}")))?;
    let api_key_id = api_key_id.map(|s| uuid::Uuid::parse_str(&s).map(ApiKeyId)).transpose().map_err(|e| StorageError::Other(format!("bad api_key_id: {e}")))?;
    let provider_id = provider_id.map(|s| uuid::Uuid::parse_str(&s).map(ProviderRecordId)).transpose().map_err(|e| StorageError::Other(format!("bad provider_id: {e}")))?;
    let model_id = model_id.map(|s| uuid::Uuid::parse_str(&s).map(ModelId)).transpose().map_err(|e| StorageError::Other(format!("bad model_id: {e}")))?;
    let status = match status.as_str() {
        "success" => CallLogStatus::Success,
        "error" => CallLogStatus::Error,
        "timeout" => CallLogStatus::Timeout,
        "cancelled" => CallLogStatus::Cancelled,
        "pending" => CallLogStatus::Pending,
        _ => return Err(StorageError::Other(format!("bad status: {status}"))),
    };
    let started_at = chrono::DateTime::parse_from_rfc3339(&started_at).map_err(|e| StorageError::Other(format!("bad started_at: {e}")))?.with_timezone(&Utc);
    let finished_at = finished_at.map(|s| chrono::DateTime::parse_from_rfc3339(&s).map(|t| t.with_timezone(&Utc))).transpose().map_err(|e| StorageError::Other(format!("bad finished_at: {e}")))?;
    let session_id = session_id.map(|s| uuid::Uuid::parse_str(&s).map(SessionId)).transpose().map_err(|e| StorageError::Other(format!("bad session_id: {e}")))?;
    let metadata: indexmap::IndexMap<String, serde_json::Value> = serde_json::from_str(&metadata_json).unwrap_or_default();

    Ok(CallLog {
        id: CallLogId(id),
        tenant_id: TenantId(tenant_id),
        workspace_id: WorkspaceId(workspace_id),
        api_key_id,
        provider_id,
        model_id,
        model_name,
        status,
        http_status: http_status.map(|x| x as u16),
        prompt_tokens: prompt_tokens as u32,
        completion_tokens: completion_tokens as u32,
        total_tokens: total_tokens as u32,
        cost_usd,
        duration_ms: duration_ms as u32,
        started_at,
        finished_at,
        error_kind,
        error_message,
        request_id,
        session_id,
        metadata,
    })
}

fn call_log_status_str(s: CallLogStatus) -> &'static str {
    match s {
        CallLogStatus::Success => "success",
        CallLogStatus::Error => "error",
        CallLogStatus::Timeout => "timeout",
        CallLogStatus::Cancelled => "cancelled",
        CallLogStatus::Pending => "pending",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Tenant;
    use crate::models::Workspace;
    use crate::pool::StoragePool;
    use crate::repo::tenant::tenant_repo;

    async fn fixture() -> (tempfile::TempDir, StoragePool, Box<dyn CallLogRepo>, TenantId, WorkspaceId) {
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
        (dir, pool.clone(), call_log_repo(pool.pool()), tenant.id, ws.id)
    }

    fn make_log(tenant_id: TenantId, workspace_id: WorkspaceId, model: &str, status: CallLogStatus, tokens: u32) -> CallLog {
        CallLog {
            id: CallLogId::new(),
            tenant_id,
            workspace_id,
            api_key_id: None,
            provider_id: None,
            model_id: None,
            model_name: model.into(),
            status,
            http_status: Some(200),
            prompt_tokens: tokens / 2,
            completion_tokens: tokens / 2,
            total_tokens: tokens,
            cost_usd: Some(0.001),
            duration_ms: 100,
            started_at: Utc::now(),
            finished_at: Some(Utc::now()),
            error_kind: None,
            error_message: None,
            request_id: uuid::Uuid::new_v4().simple().to_string(),
            session_id: None,
            metadata: indexmap::IndexMap::new(),
        }
    }

    #[tokio::test]
    async fn insert_and_get() {
        let (_dir, _pool, cr, t, w) = fixture().await;
        let l = make_log(t, w, "gpt-4o", CallLogStatus::Success, 100);
        cr.insert(&l).await.unwrap();
        let back = cr.get(l.id).await.unwrap().expect("found");
        assert_eq!(back.model_name, "gpt-4o");
        assert_eq!(back.total_tokens, 100);
    }

    #[tokio::test]
    async fn aggregate_counts() {
        let (_dir, _pool, cr, t, w) = fixture().await;
        for _i in 0..5 {
            cr.insert(&make_log(t, w, "gpt-4o", CallLogStatus::Success, 100)).await.unwrap();
        }
        for _i in 0..2 {
            cr.insert(&make_log(t, w, "gpt-4o", CallLogStatus::Error, 50)).await.unwrap();
        }
        let since = Utc::now() - chrono::Duration::hours(1);
        let stats = cr.aggregate(t, since).await.unwrap();
        assert_eq!(stats.total, 7);
        assert_eq!(stats.success, 5);
        assert_eq!(stats.errors, 2);
        assert_eq!(stats.total_tokens, 5 * 100 + 2 * 50);
    }

    #[tokio::test]
    async fn list_by_request_id_traces_correlation() {
        let (_dir, _pool, cr, t, w) = fixture().await;
        let req = "req_abc";
        let mut l = make_log(t, w, "claude-sonnet-4-5", CallLogStatus::Success, 10);
        l.request_id = req.into();
        cr.insert(&l).await.unwrap();
        let mut l2 = make_log(t, w, "gpt-4o", CallLogStatus::Success, 20);
        l2.request_id = req.into();
        cr.insert(&l2).await.unwrap();
        let traces = cr.list_by_request_id(req).await.unwrap();
        assert_eq!(traces.len(), 2);
    }
}
