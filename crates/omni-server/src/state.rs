//! Server state, config, and shared error type.

use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use omni_core::Config;
use omni_protocol::WireFormat;
use omni_router::{ProviderHandle, ProviderRegistry, Router};
use omni_storage::{StorageError, StoragePool};

#[derive(Debug, Error)]
pub enum ServerError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("auth: missing or invalid API key")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("upstream: {0}")]
    Upstream(String),
    #[error("internal: {0}")]
    Internal(String),
    #[error("storage: {0}")]
    Storage(#[from] StorageError),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
}

pub type ServerResult<T> = std::result::Result<T, ServerError>;

impl axum::response::IntoResponse for ServerError {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;
        let (status, code) = match &self {
            ServerError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            ServerError::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            ServerError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            ServerError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            ServerError::Upstream(_) => (StatusCode::BAD_GATEWAY, "upstream_error"),
            ServerError::Storage(_) | ServerError::Http(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
            ServerError::Io(_) | ServerError::Internal(_) | ServerError::Json(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };
        let body = serde_json::json!({
            "error": {
                "message": self.to_string(),
                "code": code,
                "type": code,
            }
        });
        (status, axum::Json(body)).into_response()
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub bind: SocketAddr,
    pub default_wire_format: WireFormat,
    pub require_auth: bool,
    pub enable_metrics: bool,
    pub data_dir: Option<std::path::PathBuf>,
    /// Header carrying the Bearer token used for API-key auth. Default
    /// `authorization`; the TS fork also accepts `x-api-key`.
    pub api_key_header: String,
    pub accept_x_api_key: bool,
    /// If true, write a `call_logs` row for every request.
    pub record_usage: bool,
    /// "json" or "compact" for `tracing-subscriber`.
    pub log_format: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            bind: "127.0.0.1:9090".parse().unwrap(),
            default_wire_format: WireFormat::Openai,
            require_auth: true,
            enable_metrics: true,
            data_dir: None,
            api_key_header: "authorization".into(),
            accept_x_api_key: true,
            record_usage: true,
            log_format: "compact".into(),
        }
    }
}

impl AppConfig {
    /// Load config from environment variables. Falls back to defaults.
    pub fn from_env() -> Self {
        let mut c = Self::default();
        if let Ok(s) = std::env::var("OMNI_BIND") {
            if let Ok(addr) = s.parse() {
                c.bind = addr;
            }
        }
        if let Ok(s) = std::env::var("OMNI_REQUIRE_AUTH") {
            c.require_auth = !matches!(s.to_ascii_lowercase().as_str(), "0" | "false" | "no" | "off");
        }
        if let Ok(s) = std::env::var("OMNI_DATA_DIR") {
            c.data_dir = Some(std::path::PathBuf::from(s));
        }
        if let Ok(s) = std::env::var("OMNI_RECORD_USAGE") {
            c.record_usage = !matches!(s.to_ascii_lowercase().as_str(), "0" | "false" | "no" | "off");
        }
        if let Ok(s) = std::env::var("OMNI_LOG_FORMAT") {
            c.log_format = s;
        }
        c
    }
}

/// Shared application state. Cheap to clone (Arc-wrapped).
#[derive(Clone)]
pub struct App {
    pub config: Arc<AppConfig>,
    pub core_config: Arc<Config>,
    /// Provider registry shared with the router. Handlers register here.
    pub registry: Arc<ProviderRegistry>,
    pub router: Arc<Router>,
    pub server_info: Arc<ServerInfo>,
    /// Optional SQLite pool. `None` for in-memory / no-storage mode.
    pub pool: Option<Arc<StoragePool>>,
    /// In-memory cache: provider_id -> credential. Populated by
    /// `seed_providers_from_env`; the dispatcher reads from here at request
    /// time. The DB `provider_records` table is the durable home.
    pub credentials: Arc<Mutex<BTreeMap<String, String>>>,
    started_at: Arc<Instant>,
    ready: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
    pub build: String,
}

impl Default for ServerInfo {
    fn default() -> Self {
        Self {
            name: "omniroute".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            build: "rust".into(),
        }
    }
}

impl App {
    /// Build a new application instance without storage. Use `with_storage` to
    /// attach a SQLite pool after migrations have run.
    pub fn new(config: AppConfig, core_config: Config) -> Self {
        let registry = Arc::new(ProviderRegistry::new());
        let router = Arc::new(Router::new(Arc::clone(&registry)));
        Self {
            config: Arc::new(config),
            core_config: Arc::new(core_config),
            registry,
            router,
            server_info: Arc::new(ServerInfo::default()),
            pool: None,
            credentials: Arc::new(Mutex::new(BTreeMap::new())),
            started_at: Arc::new(Instant::now()),
            ready: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Add a provider. The router sees it immediately (shared registry).
    pub fn with_provider(&self, handle: ProviderHandle) {
        self.registry.insert(handle);
    }

    /// Attach a storage pool. Marks the app ready.
    pub fn with_storage(mut self, pool: StoragePool) -> Self {
        self.pool = Some(Arc::new(pool));
        self.ready.store(true, Ordering::SeqCst);
        self
    }

    /// Mark the app ready (used by main after migrations / seed data).
    pub fn mark_ready(&self) {
        self.ready.store(true, Ordering::SeqCst);
    }

    /// Seconds since process start.
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }

    /// True if the app has finished bootstrapping (storage + providers).
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }

    /// Look up the cached credential for a provider.
    pub fn credential_for(&self, provider_id: &str) -> Option<String> {
        self.credentials.lock().ok().and_then(|m| m.get(provider_id).cloned())
    }
}

/// Authenticated API-key record returned by `auth_middleware`.
#[derive(Debug, Clone)]
pub struct AuthKey {
    pub id: String,
    pub tenant_id: String,
    pub workspace_id: String,
    pub label: String,
}

/// Compute the SHA-256 hex digest of a key. Stored on disk; never log the
/// cleartext. Returned as lowercase hex (64 chars).
pub fn sha256_hex(input: &str) -> String {
    let mut h = Sha256::new();
    h.update(input.as_bytes());
    let out = h.finalize();
    let mut s = String::with_capacity(64);
    for b in out {
        use std::fmt::Write as _;
        let _ = write!(s, "{:02x}", b);
    }
    s
}

/// Re-export RwLock for downstream callers (handler modules).
pub type SharedRwLock<T> = RwLock<T>;
