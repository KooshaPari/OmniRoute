//! `omniroute-routed` — the OmniRoute Rust data-plane binary.
//!
//! Phase 2 entry point: load default providers from environment, build the
//! server, run until signalled.
//!
//! ## Usage
//!
//! ```text
//! OMNIROUTE_OPENAI_API_KEY=sk-... \
//!     cargo run --release --bin omniroute-routed
//! ```
//!
//! The binary writes to `$XDG_RUNTIME_DIR/omniroute/routed.sock` (or
//! `/tmp/omniroute/routed.sock` if `$XDG_RUNTIME_DIR` is unset). The Next.js
//! control plane proxies `/v1/*` requests to this socket.

use std::sync::Arc;

use omniroute_core::ProviderRegistry;
use omniroute_provider::register_defaults_from_env;
use omniroute_runtime::Server;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialise structured logging. Honours RUST_LOG.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let registry: Arc<ProviderRegistry> = Arc::new(register_defaults_from_env());
    let providers = registry.ids();
    tracing::info!(
        providers = ?providers,
        "omniroute-rusted starting"
    );

    let server = Server::with_defaults(registry);
    server.run().await
}