// SPDX-License-Identifier: MIT OR Apache-2.0
//! Request + response storage layer (PR-4).
//!
//! The PR-4 milestone is to introduce a typed storage abstraction so that
//! the OmniRoute Rust rewrite can swap persistence backends (in-memory for
//! tests, SQLite for production, optional libSQL/Turso for HA) without
//! changing call sites.
//!
//! The trait surface intentionally returns [`crate::Result`] so callers
//! can use `?` everywhere, matching the PR-3 error taxonomy.
//!
//! Two responsibilities live in this module:
//!
//! 1. [`RequestStore`] — durable persistence of inbound requests + their
//!    provider responses. The data shape is enough to answer questions
//!    like "how many GPT-4o calls landed on provider X last hour?" which
//!    is needed by the router's quota + cost path.
//! 2. [`CallLogStore`] — append-only audit log of successful calls, used
//!    by the rate-limit manager + billing path. A separate trait because
//!    audit logs have a different lifecycle (append-only, no replay) than
//!    request records (read-modify-write within a single request).
//!
//! The in-memory implementations are the canonical reference: any future
//! persistent backend MUST produce the same observable behavior under
//! concurrent access. Tests live alongside and assert exactly that.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::error::{Error, ErrorKind, Result};
use crate::ids::{ApiKeySlug, RequestId, TenantId, TraceId};
use crate::provider::ProviderId;

/// Persisted record of a single inbound request + the upstream response
/// that satisfied it. `provider` may be `None` for request-shape-only
/// audit (e.g., rejected before routing).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RequestRecord {
    pub id: RequestId,
    pub trace_id: TraceId,
    pub tenant_id: Option<TenantId>,
    pub api_key: Option<ApiKeySlug>,
    pub provider: Option<ProviderId>,
    pub model: String,
    pub created_at_ms: i64,
    pub finished_at_ms: Option<i64>,
    pub status: RequestStatus,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub cached_tokens: u32,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RequestStatus {
    #[default]
    Pending,
    Success,
    ClientError,
    UpstreamError,
    Canceled,
}

/// Trait bound that any persistent store must satisfy.
///
/// Implementations should be `Send + Sync` so they can be shared via
/// `Arc<dyn RequestStore>` across the request-handler pool.
#[async_trait::async_trait]
pub trait RequestStore: Send + Sync {
    /// Persist a brand-new request in `Pending` status.
    async fn insert(&self, record: &RequestRecord) -> Result<()>;

    /// Update an existing request with finish metadata. Returns `NotFound`
    /// when the record was never inserted (or has been deleted).
    async fn finalize(&self, id: RequestId, patch: FinalizePatch<'_>) -> Result<()>;

    /// Fetch a single record by id. Returns `NotFound` when absent.
    async fn get(&self, id: RequestId) -> Result<RequestRecord>;

    /// Count records matching the given filter. Used by quota + cost paths.
    async fn count(&self, filter: &RequestFilter<'_>) -> Result<u64>;
}

/// Partial update applied at request finalization. `patch_duration`
/// is derived from `finished_at_ms - created_at_ms` so callers don't
/// have to compute it themselves.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FinalizePatch<'a> {
    pub status: RequestStatus,
    pub provider: Option<ProviderId>,
    pub model: &'a str,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub cached_tokens: u32,
    pub error_code: Option<&'a str>,
}

impl<'a> FinalizePatch<'a> {
    /// Construct the most common case: a successful response with token counts.
    #[must_use]
    pub fn success(
        provider: ProviderId,
        model: &'a str,
        prompt_tokens: u32,
        completion_tokens: u32,
        cached_tokens: u32,
    ) -> Self {
        Self {
            status: RequestStatus::Success,
            provider: Some(provider),
            model,
            prompt_tokens,
            completion_tokens,
            cached_tokens,
            error_code: None,
        }
    }

    /// Construct an upstream-error patch with a stable code.
    #[must_use]
    pub fn upstream_error(error_code: &'a str) -> Self {
        Self {
            status: RequestStatus::UpstreamError,
            provider: None,
            model: "",
            prompt_tokens: 0,
            completion_tokens: 0,
            cached_tokens: 0,
            error_code: Some(error_code),
        }
    }

    /// Duration between start and now. Returns `0` when `finished_at_ms`
    /// is unset (still pending).
    #[must_use]
    pub fn duration_since(&self, created_at_ms: i64, finished_at_ms: i64) -> Duration {
        let ms = (finished_at_ms - created_at_ms).max(0) as u64;
        Duration::from_millis(ms)
    }
}

/// Cheap-to-clone filter used by `count`. The lifetimes match strings
/// passed in by the caller; no allocation.
#[derive(Debug, Default, Clone)]
pub struct RequestFilter<'a> {
    pub tenant_id: Option<TenantId>,
    pub provider: Option<ProviderId>,
    pub since_ms: Option<i64>,
    pub status: Option<RequestStatus>,
    pub model: Option<&'a str>,
}

impl<'a> RequestFilter<'a> {
    #[must_use]
    pub fn all() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn for_provider(provider: ProviderId) -> Self {
        Self {
            provider: Some(provider),
            ..Self::default()
        }
    }

    #[must_use]
    pub fn for_tenant(tenant_id: TenantId) -> Self {
        Self {
            tenant_id: Some(tenant_id),
            ..Self::default()
        }
    }
}

/// Append-only audit log interface. Distinct from [`RequestStore`]
/// because audit rows are immutable after insert (no updates), and
/// the shape is intentionally flat for cheap indexing by trace.
#[async_trait::async_trait]
pub trait CallLogStore: Send + Sync {
    async fn append(&self, entry: CallLogEntry) -> Result<()>;
    async fn list_for_trace(&self, trace_id: TraceId) -> Result<Vec<CallLogEntry>>;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CallLogEntry {
    pub trace_id: TraceId,
    pub provider_id: ProviderId,
    pub model: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub elapsed_ms: u64,
    pub outcome: CallOutcome,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CallOutcome {
    Success,
    Retry,
    Failed,
    Skipped,
}

// ---------------------------------------------------------------------------
// In-memory implementations
// ---------------------------------------------------------------------------

/// `RequestStore` backed by a `tokio::sync::RwLock<HashMap>`. Locking
/// granularity is whole-map; fine for tests and ephemeral routing pools,
/// not for production hot-path. Real backend will be SQLite.
#[derive(Debug, Default, Clone)]
pub struct InMemoryRequestStore {
    inner: Arc<RwLock<HashMap<RequestId, RequestRecord>>>,
}

impl InMemoryRequestStore {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of records currently stored (test/diagnostic).
    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.inner.read().await.is_empty()
    }
}

#[async_trait::async_trait]
impl RequestStore for InMemoryRequestStore {
    async fn insert(&self, record: &RequestRecord) -> Result<()> {
        if record.status != RequestStatus::Pending {
            return Err(Error::with_kind(
                ErrorKind::BadRequest,
                "new records must be Pending",
            ));
        }
        let mut g = self.inner.write().await;
        if g.contains_key(&record.id) {
            return Err(Error::with_kind(
                ErrorKind::Conflict,
                "duplicate request id",
            ));
        }
        g.insert(record.id, record.clone());
        Ok(())
    }

    async fn finalize(&self, id: RequestId, patch: FinalizePatch<'_>) -> Result<()> {
        let mut g = self.inner.write().await;
        let Some(rec) = g.get_mut(&id) else {
            return Err(Error::not_found("request not found"));
        };
        rec.status = patch.status;
        if patch.provider.is_some() {
            rec.provider = patch.provider;
        }
        if !patch.model.is_empty() {
            rec.model = patch.model.to_string();
        }
        rec.prompt_tokens = patch.prompt_tokens;
        rec.completion_tokens = patch.completion_tokens;
        rec.cached_tokens = patch.cached_tokens;
        rec.error_code = patch.error_code.map(str::to_string);
        rec.finished_at_ms = Some(now_ms());
        Ok(())
    }

    async fn get(&self, id: RequestId) -> Result<RequestRecord> {
        self.inner
            .read()
            .await
            .get(&id)
            .cloned()
            .ok_or_else(|| Error::not_found("request not found"))
    }

    async fn count(&self, filter: &RequestFilter<'_>) -> Result<u64> {
        let g = self.inner.read().await;
        let mut n: u64 = 0;
        for r in g.values() {
            if let Some(ref t) = filter.tenant_id {
                if r.tenant_id.as_ref() != Some(t) {
                    continue;
                }
            }
            if let Some(ref p) = filter.provider {
                if r.provider.as_ref() != Some(p) {
                    continue;
                }
            }
            if let Some(s) = filter.status {
                if r.status != s {
                    continue;
                }
            }
            if let Some(since) = filter.since_ms {
                if r.created_at_ms < since {
                    continue;
                }
            }
            if let Some(m) = filter.model {
                if r.model != m {
                    continue;
                }
            }
            n += 1;
        }
        Ok(n)
    }
}

/// `CallLogStore` backed by a `Vec` under a single mutex. Append-only.
#[derive(Debug, Default, Clone)]
pub struct InMemoryCallLogStore {
    inner: Arc<RwLock<Vec<CallLogEntry>>>,
}

impl InMemoryCallLogStore {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.inner.read().await.is_empty()
    }
}

#[async_trait::async_trait]
impl CallLogStore for InMemoryCallLogStore {
    async fn append(&self, entry: CallLogEntry) -> Result<()> {
        self.inner.write().await.push(entry);
        Ok(())
    }

    async fn list_for_trace(&self, trace_id: TraceId) -> Result<Vec<CallLogEntry>> {
        Ok(self
            .inner
            .read()
            .await
            .iter()
            .filter(|e| e.trace_id == trace_id)
            .cloned()
            .collect())
    }
}

fn now_ms() -> i64 {
    now_ms_or_zero()
}

/// Returns the current wall-clock time in milliseconds since the Unix
/// epoch, or `0` if the system clock is set before 1970. `pub(crate)` so
/// the SQLite storage layer can stamp `finished_at_ms` consistently.
pub(crate) fn now_ms_or_zero() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{ApiKeySlug, RequestId, TraceId};

    fn rec(id: RequestId, model: &str, status: RequestStatus) -> RequestRecord {
        RequestRecord {
            id,
            trace_id: TraceId::new(),
            tenant_id: None,
            api_key: Some(ApiKeySlug::from("test-key")),
            provider: None,
            model: model.to_string(),
            created_at_ms: now_ms(),
            finished_at_ms: None,
            status,
            prompt_tokens: 0,
            completion_tokens: 0,
            cached_tokens: 0,
            error_code: None,
        }
    }

    #[tokio::test]
    async fn insert_then_get() {
        let store = InMemoryRequestStore::new();
        let id = RequestId::new();
        let r = rec(id, "gpt-4o", RequestStatus::Pending);
        store.insert(&r).await.unwrap();
        let got = store.get(id).await.unwrap();
        assert_eq!(got.id, id);
        assert_eq!(got.model, "gpt-4o");
    }

    #[tokio::test]
    async fn insert_rejects_non_pending() {
        let store = InMemoryRequestStore::new();
        let id = RequestId::new();
        let r = rec(id, "gpt-4o", RequestStatus::Success);
        let err = store.insert(&r).await.unwrap_err();
        assert_eq!(err.kind(), ErrorKind::BadRequest);
    }

    #[tokio::test]
    async fn insert_rejects_duplicate_id() {
        let store = InMemoryRequestStore::new();
        let id = RequestId::new();
        store.insert(&rec(id, "gpt-4o", RequestStatus::Pending)).await.unwrap();
        let err = store
            .insert(&rec(id, "gpt-4o", RequestStatus::Pending))
            .await
            .unwrap_err();
        assert_eq!(err.kind(), ErrorKind::Conflict);
    }

    #[tokio::test]
    async fn finalize_unknown_id_returns_not_found() {
        let store = InMemoryRequestStore::new();
        let err = store
            .finalize(
                RequestId::new(),
                FinalizePatch::success(ProviderId::from("openai"), "gpt-4o", 10, 20, 0),
            )
            .await
            .unwrap_err();
        assert_eq!(err.kind(), ErrorKind::NotFound);
    }

    #[tokio::test]
    async fn finalize_marks_success_and_records_tokens() {
        let store = InMemoryRequestStore::new();
        let id = RequestId::new();
        store
            .insert(&rec(id, "gpt-4o", RequestStatus::Pending))
            .await
            .unwrap();
        store
            .finalize(
                id,
                FinalizePatch::success(ProviderId::from("openai"), "gpt-4o", 12, 34, 5),
            )
            .await
            .unwrap();
        let got = store.get(id).await.unwrap();
        assert_eq!(got.status, RequestStatus::Success);
        assert_eq!(got.provider.as_ref().map(|p| p.as_str()), Some("openai"));
        assert_eq!(got.prompt_tokens, 12);
        assert_eq!(got.completion_tokens, 34);
        assert_eq!(got.cached_tokens, 5);
        assert!(got.finished_at_ms.is_some());
    }

    #[tokio::test]
    async fn finalize_with_upstream_error_records_code() {
        let store = InMemoryRequestStore::new();
        let id = RequestId::new();
        store
            .insert(&rec(id, "gpt-4o", RequestStatus::Pending))
            .await
            .unwrap();
        store
            .finalize(id, FinalizePatch::upstream_error("upstream_unavailable"))
            .await
            .unwrap();
        let got = store.get(id).await.unwrap();
        assert_eq!(got.status, RequestStatus::UpstreamError);
        assert_eq!(
            got.error_code.as_deref(),
            Some("upstream_unavailable")
        );
    }

    #[tokio::test]
    async fn count_filters_by_provider_and_status() {
        let store = InMemoryRequestStore::new();
        let id_a = RequestId::new();
        let id_b = RequestId::new();
        store
            .insert(&rec(id_a, "gpt-4o", RequestStatus::Pending))
            .await
            .unwrap();
        store
            .insert(&rec(id_b, "claude-opus", RequestStatus::Pending))
            .await
            .unwrap();
        store
            .finalize(
                id_a,
                FinalizePatch::success(ProviderId::from("openai"), "gpt-4o", 1, 2, 0),
            )
            .await
            .unwrap();
        store
            .finalize(
                id_b,
                FinalizePatch::success(ProviderId::from("anthropic"), "claude-opus", 1, 2, 0),
            )
            .await
            .unwrap();

        assert_eq!(
            store.count(&RequestFilter::all()).await.unwrap(),
            2
        );
        assert_eq!(
            store
                .count(&RequestFilter::for_provider(ProviderId::from("openai")))
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            store
                .count(&RequestFilter {
                    provider: Some(ProviderId::from("openai")),
                    status: Some(RequestStatus::Success),
                    ..RequestFilter::default()
                })
                .await
                .unwrap(),
            1
        );
    }

    #[tokio::test]
    async fn call_log_appends_and_lists_for_trace() {
        let log = InMemoryCallLogStore::new();
        let trace = TraceId::new();
        log.append(CallLogEntry {
            trace_id: trace,
            provider_id: ProviderId::from("openai"),
            model: "gpt-4o".into(),
            prompt_tokens: 1,
            completion_tokens: 2,
            elapsed_ms: 100,
            outcome: CallOutcome::Success,
        })
        .await
        .unwrap();
        log.append(CallLogEntry {
            trace_id: trace,
            provider_id: ProviderId::from("openai"),
            model: "gpt-4o".into(),
            prompt_tokens: 1,
            completion_tokens: 2,
            elapsed_ms: 100,
            outcome: CallOutcome::Retry,
        })
        .await
        .unwrap();

        let entries = log.list_for_trace(trace).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert!(matches!(entries[0].outcome, CallOutcome::Success));
        assert!(matches!(entries[1].outcome, CallOutcome::Retry));
    }

    #[tokio::test]
    async fn call_log_list_for_unknown_trace_is_empty() {
        let log = InMemoryCallLogStore::new();
        let entries = log.list_for_trace(TraceId::new()).await.unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn filter_for_provider_is_default_with_provider() {
        let f = RequestFilter::for_provider(ProviderId::from("anthropic"));
        assert_eq!(f.provider.as_ref().map(|p| p.as_str()), Some("anthropic"));
        assert!(f.tenant_id.is_none());
        assert!(f.since_ms.is_none());
        assert!(f.status.is_none());
        assert!(f.model.is_none());
    }

    #[test]
    fn finalize_patch_duration_since_is_non_negative() {
        let p = FinalizePatch::default();
        assert_eq!(p.duration_since(100, 50), Duration::from_millis(0));
        assert_eq!(p.duration_since(100, 250), Duration::from_millis(150));
    }
}
