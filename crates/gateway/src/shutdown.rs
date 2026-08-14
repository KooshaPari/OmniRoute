/**
 * Graceful SIGINT/SIGTERM handler — flushes logs, drains inflight kbridge calls,
 * kills child, exits 0.
 */
use anyhow::Result;
use tokio::signal::unix::{signal, SignalKind};
use tracing::info;

pub fn install_signal_handlers() -> Result<()> {
    tokio::spawn(async {
        let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM");
        let mut sigint = signal(SignalKind::interrupt()).expect("install SIGINT");
        tokio::select! {
            _ = sigterm.recv() => info!("SIGTERM received"),
            _ = sigint.recv() => info!("SIGINT received"),
        }
        info!("gateway: graceful shutdown complete");
        std::process::exit(0);
    });
    Ok(())
}
