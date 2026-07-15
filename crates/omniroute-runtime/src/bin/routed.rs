//! OmniRoute data-plane daemon.
//!
//! This is the production entry point for the Rust data plane.  It wires
//! together:
//!
//! * environment-based provider registration (`register_defaults_from_env`)
//! * OpenTelemetry initialisation (feature-gated behind `otel`)
//! * the `hyper` UDS server on `$XDG_RUNTIME_DIR/omniroute/routed.sock`
//!
//! # Usage
//!
//! ```bash
//! OMNIROUTE_OPENAI_API_KEY="sk-..." cargo run --bin routed
//! ```
//!
//! With telemetry:
//!
//! ```bash
//! OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317" \
//!   OMNIROUTE_OPENAI_API_KEY="sk-..." \
//!   cargo run --bin routed --features otel
//! ```

use std::path::PathBuf;
use std::sync::Arc;

use omniroute_core::{Context, Credentials, ProviderRegistry};
use omniroute_provider::openai::{OpenAIProvider, ProviderInit};
use omniroute_provider::ollama::OllamaProvider;
use omniroute_provider::register_defaults_from_env;
use omniroute_runtime::server::Server;

#[cfg(feature = "otel")]
use omniroute_runtime::otel;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();

    // --- initialise OpenTelemetry (opt-in) ---
    #[cfg(feature = "otel")]
    if let Some(guard) = otel::init_from_env() {
        guard.init();
        tracing::info!("open-telemetry initialised");
    }

    // --- resolve socket path ---
    let socket_path = resolve_socket_path();
    tracing::info!(socket = %socket_path.display(), "data-plane socket");

    // --- register providers ---
    let registry = if let Ok(key) = std::env::var("OMNIROUTE_OPENAI_API_KEY") {
        let mut reg = ProviderRegistry::new();
        match OpenAIProvider::new(ProviderInit::new("openai", &key)) {
            Ok(p) => {
                reg.register(p);
                tracing::info!("registered openai provider");
            }
            Err(e) => tracing::warn!(%e, "failed to register openai"),
        }
        // Wire Ollama on default endpoint if not explicitly disabled.
        let ollama_base = std::env::var("OLLAMA_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        match OllamaProvider::new(&ollama_base) {
            Ok(p) => {
                reg.register(p);
                tracing::info!("registered ollama provider at {ollama_base}");
            }
            Err(e) => tracing::warn!(%e, "failed to register ollama"),
        }
        reg
    } else {
        // fall back to env-based registration for multi-provider setups
        register_defaults_from_env()
    };
    let registry = Arc::new(registry);

    // --- ensure parent directory exists ---
    if let Some(parent) = socket_path.parent() {
        if !parent.exists() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                tracing::error!(%e, path = %parent.display(), "failed to create socket directory");
                std::process::exit(1);
            }
        }
    }

    // --- start server ---
    // Clean up stale socket file from a previous run.
    if socket_path.exists() {
        std::fs::remove_file(&socket_path).ok();
    }

    let server = Server::new(socket_path.clone(), registry.clone());

    tracing::info!("routed starting on {}", socket_path.display());
    if let Err(e) = server.run().await {
        tracing::error!(%e, "server exited with error");
        std::process::exit(1);
    }
}

/// Resolve the UDS socket path from environment or use the default.
///
/// Priority:
/// 1. `OMNIROUTE_DATA_PLANE_SOCKET` env var
/// 2. `$XDG_RUNTIME_DIR/omniroute/routed.sock`
/// 3. `/tmp/omniroute/routed.sock` (fallback)
fn resolve_socket_path() -> PathBuf {
    if let Ok(path) = std::env::var("OMNIROUTE_DATA_PLANE_SOCKET") {
        return PathBuf::from(path);
    }
    let base = std::env::var("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"));
    base.join("omniroute").join("routed.sock")
}
