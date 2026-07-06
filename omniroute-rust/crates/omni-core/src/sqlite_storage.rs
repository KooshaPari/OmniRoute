// SPDX-License-Identifier: MIT OR Apache-2.0
//! SQLite-backed implementations of [`RequestStore`] and [`CallLogStore`].
//!
//! PR-5 of the OmniRoute Rust rewrite. The in-memory impls in `storage.rs`
//! are correct but ephemeral; this file is the production-grade persistence
//! layer that every long-lived request/response flows through.
//!
//! ## Why this lives in `omni-core`
//!
//! The trait surface is defined in `storage.rs` so the rest of the rewrite
//! can talk to `Arc<dyn RequestStore>`. SQLite is the simplest possible
//! real backend (one file, WAL, no extra services) and is correct for a
//! single-node deployment. Multi-node replication is intentionally deferred
//! to PR-N (`omni-storage-distributed`).
//!
//! ## Schema design
//!
//! Two flat tables. No joins in the hot path. Status / outcome columns are
//! stored as `TEXT` (the `snake_case` serde form) so the SQL is human-readable
//! when ops engineers run ad-hoc queries via `sqlite3`.
//!
//! The `idempotency_key` column on `requests` is reserved (PR-6) so that
//! client-supplied keys can map onto the same row. Today it is always NULL.
//!
//! ## Concurrency
//!
//! We rely on SQLite's serial writer + WAL readers. All writes are wrapped
//! in implicit transactions by sqlx. There is no application-level lock;
//! the database IS the lock.

use async_trait::async_trait;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;

use crate::error::{Error, ErrorKind, Result};
use crate::ids::{RequestId, TraceId};
use crate::provider::ProviderId;
use crate::storage::{
    CallLogEntry, CallLogStore, CallOutcome, FinalizePatch, RequestFilter, RequestRecord,
    RequestStatus, RequestStore,
};

const SCHEMA_SQL: &str = r"
CREATE TABLE IF NOT EXISTS requests (
    id              TEXT PRIMARY KEY NOT NULL,
    trace_id        TEXT NOT NULL,
    tenant_id       TEXT,
    api_key         TEXT,
    provider        TEXT,
    model           TEXT NOT NULL,
    created_at_ms   INTEGER NOT NULL,
    finished_at_ms  INTEGER,
    status          TEXT NOT NULL,
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    cached_tokens   INTEGER NOT NULL DEFAULT 0,
    error_code      TEXT,
    idempotency_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_provider_created
    ON requests (provider, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_requests_status_created
    ON requests (status, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_created
    ON requests (tenant_id, created_at_ms);

CREATE TABLE IF NOT EXISTS call_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id            TEXT NOT NULL,
    provider_id         TEXT NOT NULL,
    model               TEXT NOT NULL,
    prompt_tokens       INTEGER NOT NULL DEFAULT 0,
    completion_tokens   INTEGER NOT NULL DEFAULT 0,
    elapsed_ms          INTEGER NOT NULL DEFAULT 0,
    outcome             TEXT NOT NULL,
    inserted_at_ms      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_call_log_trace
    ON call_log (trace_id);
";

/// SQLite-backed `RequestStore`. Cheap to clone (the pool is internally
/// reference-counted). Construct via [`SqliteRequestStore::open`] for a
/// real file or [`SqliteRequestStore::in_memory`] for tests.
#[derive(Debug, Clone)]
pub struct SqliteRequestStore {
    pool: SqlitePool,
}

impl SqliteRequestStore {
    /// Open a pool on the given `sqlite:` URL. Use `sqlite::memory:` for
    /// tests or `sqlite://path/to/data.sqlite` for production.
    pub async fn open(url: &str) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(8)
            .connect(url)
            .await
            .map_err(|e| Error::with_kind(ErrorKind::Db, format!("sqlite open: {e}")))?;
        sqlx::query(SCHEMA_SQL)
            .execute(&pool)
            .await
            .map_err(|e| Error::with_kind(ErrorKind::Db, format!("sqlite schema: {e}")))?;
        Ok(Self { pool })
    }

    /// Open an in-memory store. Each call creates its own pool; to share
    /// across tasks, clone the returned handle.
    pub async fn in_memory() -> Result<Self> {
        Self::open("sqlite::memory:").await
    }

    /// Borrow the underlying pool for advanced queries (joins, ad-hoc
    /// ops) without taking ownership.
    #[must_use]
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[async_trait]
impl RequestStore for SqliteRequestStore {
    async fn insert(&self, record: &RequestRecord) -> Result<()> {
        if record.status != RequestStatus::Pending {
            return Err(Error::with_kind(
                ErrorKind::BadRequest,
                "new records must be Pending",
            ));
        }
        let res = sqlx::query(
            "INSERT OR ABORT INTO requests
                (id, trace_id, tenant_id, api_key, provider, model,
                 created_at_ms, finished_at_ms, status,
                 prompt_tokens, completion_tokens, cached_tokens, error_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)",
        )
        .bind(record.id.as_uuid().simple().to_string())
        .bind(record.trace_id.as_uuid().simple().to_string())
        .bind(record.tenant_id.as_ref().map(|t| t.as_str().to_string()))
        .bind(record.api_key.as_ref().map(|k| k.as_str().to_string()))
        .bind(record.provider.as_ref().map(|p| p.0.clone()))
        .bind(&record.model)
        .bind(record.created_at_ms)
        .bind(status_str(record.status))
        .bind(record.prompt_tokens as i64)
        .bind(record.completion_tokens as i64)
        .bind(record.cached_tokens as i64)
        .bind(record.error_code.as_deref())
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        // INSERT OR ABORT may silently succeed under sqlx when the row
        // already exists due to the binding format. We rely on the rowid
        // returned and assert distinct counts for robustness.
        if res.rows_affected() != 1 {
            return Err(Error::with_kind(
                ErrorKind::Conflict,
                "duplicate request id",
            ));
        }
        Ok(())
    }

    async fn finalize(&self, id: RequestId, patch: FinalizePatch<'_>) -> Result<()> {
        // Determine finished_at_ms. If the caller hasn't set one, use
        // server time so we have a durable value (the in-memory impl
        // derives it from now_ms()).
        let finished_at_ms = crate::storage::now_ms_or_zero();

        let res = sqlx::query(
            "UPDATE requests
                SET status = ?,
                    provider = COALESCE(?, provider),
                    model = CASE WHEN ? = '' THEN model ELSE ? END,
                    prompt_tokens = ?,
                    completion_tokens = ?,
                    cached_tokens = ?,
                    error_code = ?,
                    finished_at_ms = ?
              WHERE id = ?",
        )
        .bind(status_str(patch.status))
        .bind(patch.provider.as_ref().map(|p| p.0.clone()))
        .bind(patch.model)
        .bind(patch.model)
        .bind(patch.prompt_tokens as i64)
        .bind(patch.completion_tokens as i64)
        .bind(patch.cached_tokens as i64)
        .bind(patch.error_code)
        .bind(finished_at_ms)
        .bind(id.as_uuid().simple().to_string())
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        if res.rows_affected() == 0 {
            return Err(Error::not_found("request not found"));
        }
        Ok(())
    }

    async fn get(&self, id: RequestId) -> Result<RequestRecord> {
        let row = sqlx::query(
            "SELECT id, trace_id, tenant_id, api_key, provider, model,
                    created_at_ms, finished_at_ms, status,
                    prompt_tokens, completion_tokens, cached_tokens, error_code
               FROM requests WHERE id = ?",
        )
        .bind(id.as_uuid().simple().to_string())
        .fetch_optional(&self.pool)
        .await
        .map_err(map_sqlx_err)?
        .ok_or_else(|| Error::not_found("request not found"))?;
        row_to_record(&row)
    }

    async fn count(&self, filter: &RequestFilter<'_>) -> Result<u64> {
        // Build the query dynamically. We assemble the WHERE clause as
        // owned Strings (not Parameters) so the plan cache stays warm
        // for the common cases (no filter, provider-only).
        let mut sql = String::from("SELECT COUNT(*) AS n FROM requests WHERE 1=1");
        if filter.tenant_id.is_some() { sql.push_str(" AND tenant_id = ?"); }
        if filter.provider.is_some()  { sql.push_str(" AND provider = ?");  }
        if filter.status.is_some()    { sql.push_str(" AND status = ?");    }
        if filter.since_ms.is_some()  { sql.push_str(" AND created_at_ms >= ?"); }
        if filter.model.is_some()     { sql.push_str(" AND model = ?");     }

        let mut q = sqlx::query(&sql);
        if let Some(t) = &filter.tenant_id {
            q = q.bind(t.as_str().to_string());
        }
        if let Some(p) = &filter.provider {
            q = q.bind(p.0.clone());
        }
        if let Some(s) = filter.status {
            q = q.bind(status_str(s));
        }
        if let Some(since) = filter.since_ms {
            q = q.bind(since);
        }
        if let Some(m) = filter.model {
            q = q.bind(m);
        }

        let row = q.fetch_one(&self.pool).await.map_err(map_sqlx_err)?;
        let n: i64 = row.try_get("n").map_err(map_sqlx_err)?;
        Ok(n.max(0) as u64)
    }
}

/// SQLite-backed `CallLogStore`. Same construction rules as
/// [`SqliteRequestStore`].
#[derive(Debug, Clone)]
pub struct SqliteCallLogStore {
    pool: SqlitePool,
}

impl SqliteCallLogStore {
    pub async fn open(url: &str) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(8)
            .connect(url)
            .await
            .map_err(|e| Error::with_kind(ErrorKind::Db, format!("sqlite open: {e}")))?;
        sqlx::query(SCHEMA_SQL)
            .execute(&pool)
            .await
            .map_err(|e| Error::with_kind(ErrorKind::Db, format!("sqlite schema: {e}")))?;
        Ok(Self { pool })
    }

    pub async fn in_memory() -> Result<Self> {
        Self::open("sqlite::memory:").await
    }

    #[must_use]
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[async_trait]
impl CallLogStore for SqliteCallLogStore {
    async fn append(&self, entry: CallLogEntry) -> Result<()> {
        let now_ms = crate::storage::now_ms_or_zero();
        sqlx::query(
            "INSERT INTO call_log
                (trace_id, provider_id, model, prompt_tokens,
                 completion_tokens, elapsed_ms, outcome, inserted_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(entry.trace_id.as_uuid().simple().to_string())
        .bind(entry.provider_id.0.clone())
        .bind(&entry.model)
        .bind(entry.prompt_tokens as i64)
        .bind(entry.completion_tokens as i64)
        .bind(entry.elapsed_ms as i64)
        .bind(call_outcome_str(entry.outcome))
        .bind(now_ms)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    async fn list_for_trace(&self, trace_id: TraceId) -> Result<Vec<CallLogEntry>> {
        let rows = sqlx::query(
            "SELECT trace_id, provider_id, model, prompt_tokens,
                    completion_tokens, elapsed_ms, outcome
               FROM call_log
              WHERE trace_id = ?
              ORDER BY id ASC",
        )
        .bind(trace_id.as_uuid().simple().to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            let trace_str: String = row.try_get("trace_id").map_err(map_sqlx_err)?;
            let trace_id = uuid_from_simple(&trace_str)
                .map_err(|e| Error::with_kind(ErrorKind::Db, format!("call_log.trace_id: {e}")))?;
            out.push(CallLogEntry {
                trace_id: TraceId(trace_id),
                provider_id: ProviderId(row.try_get::<String, _>("provider_id").map_err(map_sqlx_err)?),
                model: row.try_get("model").map_err(map_sqlx_err)?,
                prompt_tokens: row.try_get::<i64, _>("prompt_tokens").map_err(map_sqlx_err)?.max(0) as u32,
                completion_tokens: row.try_get::<i64, _>("completion_tokens").map_err(map_sqlx_err)?.max(0) as u32,
                elapsed_ms: row.try_get::<i64, _>("elapsed_ms").map_err(map_sqlx_err)?.max(0) as u64,
                outcome: outcome_from_str(
                    &row.try_get::<String, _>("outcome").map_err(map_sqlx_err)?,
                )?,
            });
        }
        Ok(out)
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn map_sqlx_err(e: sqlx::Error) -> Error {
    match &e {
        sqlx::Error::RowNotFound => Error::not_found(format!("{e}")),
        sqlx::Error::Database(db_err) if db_err.code().as_deref() == Some("2067")
            || db_err.code().as_deref() == Some("1555") =>
        {
            // SQLITE_CONSTRAINT_UNIQUE / PRIMARY KEY
            Error::with_kind(ErrorKind::Conflict, format!("{e}"))
        }
        _ => Error::with_kind(ErrorKind::Db, format!("{e}")),
    }
}

fn status_str(s: RequestStatus) -> &'static str {
    match s {
        RequestStatus::Pending       => "pending",
        RequestStatus::Success       => "success",
        RequestStatus::ClientError   => "client_error",
        RequestStatus::UpstreamError => "upstream_error",
        RequestStatus::Canceled      => "canceled",
    }
}

fn status_from_str(s: &str) -> Result<RequestStatus> {
    Ok(match s {
        "pending"        => RequestStatus::Pending,
        "success"        => RequestStatus::Success,
        "client_error"   => RequestStatus::ClientError,
        "upstream_error" => RequestStatus::UpstreamError,
        "canceled"       => RequestStatus::Canceled,
        other => {
            return Err(Error::with_kind(
                ErrorKind::Db,
                format!("unknown request status: {other}"),
            ));
        }
    })
}

fn call_outcome_str(o: CallOutcome) -> &'static str {
    match o {
        CallOutcome::Success => "success",
        CallOutcome::Retry   => "retry",
        CallOutcome::Failed  => "failed",
        CallOutcome::Skipped => "skipped",
    }
}

fn outcome_from_str(s: &str) -> Result<CallOutcome> {
    Ok(match s {
        "success" => CallOutcome::Success,
        "retry"   => CallOutcome::Retry,
        "failed"  => CallOutcome::Failed,
        "skipped" => CallOutcome::Skipped,
        other => {
            return Err(Error::with_kind(
                ErrorKind::Db,
                format!("unknown call outcome: {other}"),
            ));
        }
    })
}

fn uuid_from_simple(s: &str) -> Result<uuid::Uuid> {
    uuid::Uuid::parse_str(s).map_err(|e| Error::with_kind(ErrorKind::Db, format!("uuid: {e}")))
}

fn row_to_record(row: &sqlx::sqlite::SqliteRow) -> Result<RequestRecord> {
    let id_str: String = row.try_get("id").map_err(map_sqlx_err)?;
    let trace_str: String = row.try_get("trace_id").map_err(map_sqlx_err)?;
    let id = uuid_from_simple(&id_str)
        .map_err(|e| Error::with_kind(ErrorKind::Db, format!("requests.id: {e}")))?;
    let trace_id = uuid_from_simple(&trace_str)
        .map_err(|e| Error::with_kind(ErrorKind::Db, format!("requests.trace_id: {e}")))?;

    let tenant_str: Option<String> = row.try_get("tenant_id").map_err(map_sqlx_err)?;
    let tenant_id = tenant_str.map(crate::ids::TenantId::from);

    let provider_str: Option<String> = row.try_get("provider").map_err(map_sqlx_err)?;
    let provider = provider_str.map(ProviderId);

    let status_str_v: String = row.try_get("status").map_err(map_sqlx_err)?;

    Ok(RequestRecord {
        id: RequestId(id),
        trace_id: TraceId(trace_id),
        tenant_id,
        api_key: row
            .try_get::<Option<String>, _>("api_key")
            .map_err(map_sqlx_err)?
            .map(crate::ids::ApiKeySlug::from),
        provider,
        model: row.try_get("model").map_err(map_sqlx_err)?,
        created_at_ms: row.try_get("created_at_ms").map_err(map_sqlx_err)?,
        finished_at_ms: row.try_get("finished_at_ms").map_err(map_sqlx_err)?,
        status: status_from_str(&status_str_v)?,
        prompt_tokens: row.try_get::<i64, _>("prompt_tokens").map_err(map_sqlx_err)?.max(0) as u32,
        completion_tokens: row.try_get::<i64, _>("completion_tokens").map_err(map_sqlx_err)?.max(0) as u32,
        cached_tokens: row.try_get::<i64, _>("cached_tokens").map_err(map_sqlx_err)?.max(0) as u32,
        error_code: row.try_get("error_code").map_err(map_sqlx_err)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{ApiKeySlug, RequestId, TraceId};

    fn rec(id: RequestId, model: &str) -> RequestRecord {
        RequestRecord {
            id,
            trace_id: TraceId::new(),
            tenant_id: None,
            api_key: Some(ApiKeySlug::from("test-key")),
            provider: None,
            model: model.to_string(),
            created_at_ms: crate::storage::now_ms_or_zero(),
            finished_at_ms: None,
            status: RequestStatus::Pending,
            prompt_tokens: 0,
            completion_tokens: 0,
            cached_tokens: 0,
            error_code: None,
        }
    }

    #[tokio::test]
    async fn insert_then_get_round_trip() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let id = RequestId::new();
        let r = rec(id, "gpt-4o");
        store.insert(&r).await.unwrap();
        let got = store.get(id).await.unwrap();
        assert_eq!(got.id, id);
        assert_eq!(got.model, "gpt-4o");
        assert_eq!(got.status, RequestStatus::Pending);
    }

    #[tokio::test]
    async fn finalize_marks_success_and_writes_provider() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let id = RequestId::new();
        store.insert(&rec(id, "gpt-4o")).await.unwrap();
        let patch = FinalizePatch::success(
            ProviderId::from("openai"),
            "gpt-4o",
            100, 50, 25,
        );
        store.finalize(id, patch).await.unwrap();
        let got = store.get(id).await.unwrap();
        assert_eq!(got.status, RequestStatus::Success);
        assert_eq!(got.provider.as_ref().unwrap().0, "openai");
        assert_eq!(got.prompt_tokens, 100);
        assert_eq!(got.completion_tokens, 50);
        assert_eq!(got.cached_tokens, 25);
        assert!(got.finished_at_ms.is_some());
    }

    #[tokio::test]
    async fn finalize_unknown_id_returns_not_found() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let err = store
            .finalize(RequestId::new(), FinalizePatch::upstream_error("rate_limit"))
            .await
            .unwrap_err();
        assert!(matches!(err.kind(), ErrorKind::NotFound));
    }

    #[tokio::test]
    async fn insert_rejects_non_pending() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let mut r = rec(RequestId::new(), "gpt-4o");
        r.status = RequestStatus::Success;
        let err = store.insert(&r).await.unwrap_err();
        assert!(matches!(err.kind(), ErrorKind::BadRequest));
    }

    #[tokio::test]
    async fn insert_rejects_duplicate_id() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let id = RequestId::new();
        store.insert(&rec(id, "gpt-4o")).await.unwrap();
        let err = store.insert(&rec(id, "gpt-4o")).await.unwrap_err();
        assert!(matches!(err.kind(), ErrorKind::Conflict));
    }

    #[tokio::test]
    async fn count_filters_by_provider_and_status() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let id1 = RequestId::new();
        let id2 = RequestId::new();
        store.insert(&rec(id1, "gpt-4o")).await.unwrap();
        store.insert(&rec(id2, "claude-3")).await.unwrap();
        store.finalize(id1, FinalizePatch::success(
            ProviderId::from("openai"), "gpt-4o", 10, 10, 0,
        )).await.unwrap();

        let f1 = RequestFilter { provider: Some(ProviderId::from("openai")), ..RequestFilter::default() };
        assert_eq!(store.count(&f1).await.unwrap(), 1);

        let f2 = RequestFilter { status: Some(RequestStatus::Pending), ..RequestFilter::default() };
        assert_eq!(store.count(&f2).await.unwrap(), 1);

        let f3 = RequestFilter::all();
        assert_eq!(store.count(&f3).await.unwrap(), 2);
    }

    #[tokio::test]
    async fn call_log_appends_and_lists_for_trace() {
        let store = SqliteCallLogStore::in_memory().await.unwrap();
        let trace = TraceId::new();
        store.append(CallLogEntry {
            trace_id: trace,
            provider_id: ProviderId::from("openai"),
            model: "gpt-4o".to_string(),
            prompt_tokens: 12,
            completion_tokens: 34,
            elapsed_ms: 100,
            outcome: CallOutcome::Success,
        }).await.unwrap();
        store.append(CallLogEntry {
            trace_id: trace,
            provider_id: ProviderId::from("anthropic"),
            model: "claude-3".to_string(),
            prompt_tokens: 5,
            completion_tokens: 6,
            elapsed_ms: 200,
            outcome: CallOutcome::Failed,
        }).await.unwrap();

        let rows = store.list_for_trace(trace).await.unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].provider_id.0, "openai");
        assert_eq!(rows[1].outcome, CallOutcome::Failed);

        let other = store.list_for_trace(TraceId::new()).await.unwrap();
        assert!(other.is_empty());
    }

    #[tokio::test]
    async fn sqlite_stores_finished_at_on_finalize() {
        let store = SqliteRequestStore::in_memory().await.unwrap();
        let id = RequestId::new();
        store.insert(&rec(id, "gpt-4o")).await.unwrap();
        let before = crate::storage::now_ms_or_zero();
        store.finalize(id, FinalizePatch::success(
            ProviderId::from("openai"), "gpt-4o", 1, 1, 0,
        )).await.unwrap();
        let got = store.get(id).await.unwrap();
        let finished = got.finished_at_ms.unwrap();
        assert!(finished >= before);
    }
}