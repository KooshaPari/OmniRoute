//! argismonitor gateway — Tauri-side companion that supervises the Rust
//! backend (`omniroute-server`) and bridges Tauri IPC <-> kbridge Unix socket.

pub mod kbridge_client;
pub mod log_stream;
pub mod process;
pub mod shutdown;

use std::sync::Arc;
use tauri::{Manager, Runtime};

pub use kbridge_client::{KbridgeClient, KbridgeRequest, KbridgeResponse};
pub use process::{GatewayProcess, ProcessStatus};
pub use shutdown::install_signal_handlers;

/// Tauri plugin entrypoint: register state, commands, event handlers.
pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("omniroute-gateway")
        .setup(|app, _api| {
            let process = Arc::new(GatewayProcess::start(app.handle().clone())?);
            app.manage(process.clone());
            let client = Arc::new(KbridgeClient::new());
            app.manage(client);
            let log_ring = Arc::new(log_stream::RingBuffer::new(8 * 1024));
            app.manage(log_ring);
            Ok(())
        })
        .build()
}
