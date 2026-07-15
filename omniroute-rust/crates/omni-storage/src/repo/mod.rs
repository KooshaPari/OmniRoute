//! Repository pattern: trait + sqlx-backed impl per entity. All repos are
//! `Send + Sync` and operate on a shared `&SqlitePool`.

pub mod api_key;
pub mod call_log;
pub mod tenant;

pub use api_key::{ApiKeyRepo, SqliteApiKeyRepo, api_key_repo};
pub use call_log::{CallLogRepo, CallLogStats, SqliteCallLogRepo, call_log_repo};
pub use tenant::{SqliteTenantRepo, TenantRepo, tenant_repo};

use crate::ids::TenantId;

/// Shared filter passed to list queries.
#[derive(Debug, Clone, Default)]
pub struct ListParams {
    pub limit: u32,
    pub offset: u32,
    pub tenant_id: Option<TenantId>,
}

impl ListParams {
    #[must_use]
    pub fn new() -> Self {
        Self { limit: 100, offset: 0, tenant_id: None }
    }

    #[must_use]
    pub fn with_limit(mut self, n: u32) -> Self { self.limit = n; self }
    #[must_use]
    pub fn with_offset(mut self, n: u32) -> Self { self.offset = n; self }
    #[must_use]
    pub fn with_tenant(mut self, t: TenantId) -> Self { self.tenant_id = Some(t); self }
}
