//! Provider repository (minimal scaffold for workspace compile).

use sqlx::SqlitePool;

/// Provider persistence handle (full CRUD to follow).
pub struct ProviderRepo<'a> {
    _pool: &'a SqlitePool,
}

impl<'a> ProviderRepo<'a> {
    /// Create a repo bound to `pool`.
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { _pool: pool }
    }
}
