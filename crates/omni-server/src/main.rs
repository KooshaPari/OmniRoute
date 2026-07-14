//! OmniRoute server entrypoint. Boots the HTTP server with SQLite-backed
//! storage, applies migrations, and serves OpenAI-compat / Anthropic / admin
//! routes. Run with `omni-server` (this binary) or `omni start` (the
//! `omni-cli` thin wrapper).

use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use omni_core::Config;
use omni_server::{build_router, seed_providers_from_env, App, AppConfig};
use omni_storage::StoragePool;

const DEFAULT_DATA_DIR: &str = "./.data";

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    // Load .env if present (best effort).
    let _ = dotenvy::dotenv();

    let config = AppConfig::from_env();
    let data_dir = config
        .data_dir
        .clone()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_DATA_DIR));
    let storage = StoragePool::open(&data_dir)
        .await
        .with_context(|| format!("open storage at {}", data_dir.display()))?;
    omni_storage::migrations::run(storage.pool())
        .await
        .context("run migrations")?;
    info!(path = %data_dir.display(), "storage ready");

    let core = Config::default();
    let app = App::new(config, core).with_storage(storage);
    seed_providers_from_env(&app);
    app.mark_ready();

    let addr: SocketAddr = app.config.bind;
    info!(%addr, "omni-server starting");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    let router = build_router(app);
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve")?;
    info!("omni-server stopped");
    Ok(())
}

fn init_tracing() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,omni_server=debug,omni_core=info,omni_router=info,omni_storage=warn,omni_translator=info"));
    let layer = fmt::layer().with_target(false).compact();
    tracing_subscriber::registry()
        .with(env_filter)
        .with(layer)
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => info!("ctrl-c received"),
        _ = terminate => info!("SIGTERM received"),
    }
}
