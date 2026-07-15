//! Embedded migrations. The `MIGRATOR` is built from `./migrations/*.sql`
//! at runtime by `init()`. Use `run(pool)` to apply pending migrations.

use sqlx::migrate::Migrator;
use std::path::PathBuf;

/// One-shot lazy migrator. `init()` builds it; `run()` applies it (consuming
/// a clone, so the static is reusable across pools).
static MIGRATOR: tokio::sync::OnceCell<Migrator> = tokio::sync::OnceCell::const_new();

/// Path to the migrations directory. Resolved at call time from `CARGO_MANIFEST_DIR`.
fn migrations_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
}

/// Build (or return the cached) migrator. Safe to call repeatedly.
pub async fn init() -> Result<&'static Migrator, sqlx::migrate::MigrateError> {
    let p = migrations_path();
    MIGRATOR
        .get_or_try_init(|| async move { Migrator::new(p).await })
        .await
}

/// Run all pending migrations against the pool. The migrator is cloned so
/// the static remains usable for subsequent calls.
pub async fn run(pool: &sqlx::SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    let m = init().await?;
    m.run(pool).await
}
