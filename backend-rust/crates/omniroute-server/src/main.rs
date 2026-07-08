use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use omniroute_storage::db::{open_pool, run_migrations};

mod kbridge;

#[derive(Parser, Debug)]
#[command(name = "omniroute-server", version, about = "argismonitor HTTP server (Rust)")]
struct Server {
    #[arg(short, long, env = "OMNIROUTE_PORT", default_value_t = 20128)]
    port: u16,
    #[arg(long, env = "OMNIROUTE_DATA_DIR", default_value = "~/.omniroute")]
    data_dir: String,
    #[arg(long, default_value_t = false)]
    mitm: bool,
    #[arg(long, env = "OMNIRoute_GATEWAY_SOCKET", default_value = "/var/run/omniroute/gateway.sock")]
    kbridge_socket: PathBuf,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();
    let s = Server::parse();
    tracing::info!(
        port = s.port,
        data_dir = %s.data_dir,
        mitm = s.mitm,
        kbridge_socket = %s.kbridge_socket.display(),
        "argismonitor-server starting (axum + kbridge wired)"
    );

    // Bootstrap the SQLite storage at data_dir. Used by kbridge.usage.record
    // and by the future pipeline hand-off (still placeholder).
    let pool = match open_pool(&s.data_dir).await {
        Ok(p) => {
            if let Err(e) = run_migrations(&p).await {
                tracing::warn!(error = %e, "kbridge: storage migrations failed (continuing)");
            }
            Some(Arc::new(p))
        }
        Err(e) => {
            tracing::warn!(error = %e, "kbridge: storage open failed (continuing without pool)");
            None
        }
    };

    // Spawn the kbridge listener (BFF <-> gateway Unix-socket + MessagePack-RPC).
    let mut ctx = kbridge::KbridgeContext::new();
    if let Some(p) = pool {
        ctx = kbridge::KbridgeContext::with_pool(p);
    }
    let _kbridge_stop = kbridge::spawn(s.kbridge_socket.clone(), ctx);

    // Keep the main task alive; the kbridge listener runs in the background.
    tokio::signal::ctrl_c().await.ok();
    tracing::info!("argismonitor-server: shutting down");
    Ok(())
}
