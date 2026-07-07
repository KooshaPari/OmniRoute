//! Hyper server wiring — Unix Domain Socket listener, route dispatch,
//! and graceful shutdown.
//!
//! Phase 2: server binds to `$XDG_RUNTIME_DIR/omniroute/routed.sock` and
//! serves a single route table. Phase 3 adds TCP fallback for containers
//! without a writable UDS path.

use std::path::PathBuf;
use std::sync::Arc;

use http_body_util::Full;
use hyper::body::Bytes;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use tokio::net::UnixListener;

use omniroute_core::ProviderRegistry;

use crate::chat::chat_completions;
use crate::health::{healthz, readyz};
use crate::metrics::{metrics_endpoint, SharedMetrics};

/// Response body type used throughout the runtime.
pub type ResponseBody = Full<Bytes>;

/// Runtime version embedded in `/healthz` responses.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default Unix socket path.
///
/// `$XDG_RUNTIME_DIR` is set per-user by most modern Linux desktops and
/// falls back to `/tmp` on systems without one. The runtime layer always
/// appends `omniroute/routed.sock` so multiple instances do not collide.
pub fn default_socket_path() -> PathBuf {
    let base = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/tmp"));
    base.join("omniroute").join("routed.sock")
}

/// Data-plane HTTP server.
#[derive(Debug)]
pub struct Server {
    socket_path: PathBuf,
    registry: Arc<ProviderRegistry>,
    metrics: SharedMetrics,
}

impl Server {
    /// Create a new server bound to the given socket path with the given
    /// provider registry.
    pub fn new(socket_path: PathBuf, registry: Arc<ProviderRegistry>) -> Self {
        Self {
            socket_path,
            registry,
            metrics: SharedMetrics::new(),
        }
    }

    /// Create a server with the given metrics handle (for tests).
    pub fn with_metrics(
        socket_path: PathBuf,
        registry: Arc<ProviderRegistry>,
        metrics: SharedMetrics,
    ) -> Self {
        Self {
            socket_path,
            registry,
            metrics,
        }
    }

    /// Create a server with the default socket path.
    pub fn with_defaults(registry: Arc<ProviderRegistry>) -> Self {
        Self::new(default_socket_path(), registry)
    }

    /// Returns the socket path the server will bind to.
    pub fn socket_path(&self) -> &std::path::Path {
        &self.socket_path
    }

    /// Access the shared metrics handle (read-only).
    pub fn metrics(&self) -> &SharedMetrics {
        &self.metrics
    }

    /// Run the server until the process is signalled or the socket errors.
    ///
    /// Returns `Ok(())` on graceful shutdown; returns `Err(e)` on bind or
    /// accept failures.
    pub async fn run(self) -> anyhow::Result<()> {
        if let Some(parent) = self.socket_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        // Remove a stale socket file so bind() succeeds.
        if self.socket_path.exists() {
            tokio::fs::remove_file(&self.socket_path).await.ok();
        }

        let listener = UnixListener::bind(&self.socket_path)?;
        tracing::info!(
            socket = %self.socket_path.display(),
            version = VERSION,
            "omniroute-rusted listening"
        );

        let registry = self.registry;
        let metrics = self.metrics;
        loop {
            let (stream, _addr) = listener.accept().await?;
            let io = TokioIo::new(stream);
            let registry = registry.clone();
            let metrics = metrics.clone();
            tokio::spawn(async move {
                let svc = service_fn(move |req| {
                    let registry = registry.clone();
                    let metrics = metrics.clone();
                    async move { route(req, registry, metrics).await }
                });
                if let Err(e) = hyper::server::conn::http1::Builder::new()
                    .serve_connection(io, svc)
                    .await
                {
                    tracing::warn!("connection error: {e}");
                }
            });
        }
    }
}

/// Route a request to the appropriate handler.
async fn route(
    req: Request<hyper::body::Incoming>,
    registry: Arc<ProviderRegistry>,
    metrics: SharedMetrics,
) -> Result<Response<ResponseBody>, hyper::Error> {
    let path = req.uri().path().to_string();
    match (req.method(), path.as_str()) {
        (&hyper::Method::POST, "/v1/chat/completions") => {
            Ok(chat_completions(registry, metrics, req).await)
        }
        (&hyper::Method::GET, "/healthz") => Ok(healthz(VERSION)),
        (&hyper::Method::GET, "/readyz") => Ok(readyz(&registry).await),
        (&hyper::Method::GET, "/metrics") => Ok(metrics_endpoint(&metrics)),
        _ => Ok(not_found(&path)),
    }
}

fn not_found(path: &str) -> Response<ResponseBody> {
    let body = serde_json::json!({
        "error": {
            "message": format!("not found: {path}"),
            "code": "not_found",
        }
    });
    Response::builder()
        .status(404)
        .header("content-type", "application/json")
        .body(Full::new(Bytes::from(body.to_string())))
        .expect("static response")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_socket_path_uses_xdg_or_tmp() {
        let p = default_socket_path();
        assert!(p.ends_with("omniroute/routed.sock"));
    }

    #[test]
    fn server_carries_registry_and_path() {
        let reg = Arc::new(ProviderRegistry::new());
        let server = Server::with_defaults(reg);
        assert_eq!(
            server.socket_path().file_name().and_then(|s| s.to_str()),
            Some("routed.sock")
        );
    }

    #[test]
    fn not_found_returns_404() {
        let r = not_found("/wat");
        assert_eq!(r.status(), 404);
    }
}