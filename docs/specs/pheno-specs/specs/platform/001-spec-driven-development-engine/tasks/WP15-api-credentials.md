---
work_package_id: WP15
title: API Layer & Credential Management
lane: "done"
dependencies: [WP14]
base_branch: 001-spec-driven-development-engine-WP14
base_commit: 1489109d814c5f86d8e918a67accf6ae2e665966
created_at: '2026-03-02T01:38:16.832116+00:00'
subtasks:
- T085
- T086
- T087
- T088
- T089
- T090
phase: Phase 4 - Integration
assignee: ''
agent: "s1-wp15"
shell_pid: "26726"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP15: API Layer & Credential Management

## Implementation Command

```bash
spec-kitty implement WP15 --base WP14
```

## Objectives

Implement an axum HTTP API for web UI and Plane.so integration, and build the credential
management system for securely storing and retrieving integration keys (GitHub, Coderabbit,
Plane.so). The API runs alongside the gRPC server in the same Rust binary, sharing the
tokio runtime and port implementations.

### Success Criteria

1. Axum HTTP API serves JSON responses for features, work packages, governance contracts,
   and audit trails at documented endpoints.
2. API route handlers delegate to domain services via port traits — no direct adapter access.
3. Integration key auth middleware validates API keys from the credential store before
   allowing access to protected endpoints.
4. Credentials are stored in the OS keychain (macOS Keychain, Linux secret-service) with
   an encrypted-file fallback.
5. `~/.agileplus/config.toml` schema is defined, parsed, and used by all components
   (CLI, API, gRPC server) for configuration.
6. API integration tests with a mock HTTP client achieve full coverage of all endpoints.

## Context & Constraints

### Architecture Context

- The axum HTTP API lives in `crates/agileplus-api/`. It is compiled into the same binary
  as the CLI and gRPC server.
- When `agileplus serve` is invoked, both the gRPC server (port 50051) and the HTTP API
  (port 8080, configurable) start on the same tokio runtime.
- The API is designed for consumption by Plane.so (visual project management) and future
  web UIs. JSON responses should match Plane.so work item formats where feasible.
- Credential management is cross-cutting: the CLI uses credentials for `gh` commands, the
  review adapter uses them for GitHub API, and the API uses them for auth validation.

### Prior Work Dependencies

- WP14: gRPC server running in the shared binary — the `serve` command is established.
- WP05: All port traits defined.
- WP06-WP10: All adapter implementations available for DI.
- WP13: All CLI commands exist (API may dispatch commands).

### Constraints

- API must not expose internal implementation details (no raw SQL, no file paths in errors).
- Credentials must never appear in logs, API responses, or error messages.
- Config file must be backward-compatible: new fields have defaults, removed fields are
  ignored with a deprecation warning.
- HTTP API performance target: <100ms response time for all endpoints.

---

## Subtask Guidance

### T085: Implement axum Router in `crates/agileplus-api/src/`

**Files**:
- `crates/agileplus-api/src/lib.rs`
- `crates/agileplus-api/src/router.rs`

**Purpose**: Create the axum application with route definitions, shared state, and
middleware stack.

**Implementation Steps**:

1. Define the shared application state:
   ```rust
   #[derive(Clone)]
   pub struct AppState<S: StoragePort, V: VcsPort, O: ObservabilityPort> {
       pub storage: Arc<S>,
       pub vcs: Arc<V>,
       pub telemetry: Arc<O>,
       pub config: Arc<AppConfig>,
   }
   ```

2. Build the router with route groups:
   ```rust
   pub fn create_router<S, V, O>(state: AppState<S, V, O>) -> Router
   where
       S: StoragePort + Send + Sync + 'static,
       V: VcsPort + Send + Sync + 'static,
       O: ObservabilityPort + Send + Sync + 'static,
   {
       Router::new()
           .nest("/api/v1/features", features::routes())
           .nest("/api/v1/work-packages", work_packages::routes())
           .nest("/api/v1/governance", governance::routes())
           .nest("/api/v1/audit", audit::routes())
           .nest("/api/v1/metrics", metrics::routes())
           .layer(middleware::from_fn(auth::validate_api_key))
           .layer(middleware::from_fn(telemetry::trace_request))
           .layer(CorsLayer::permissive()) // tighten in production
           .with_state(state)
   }
   ```

3. Define route modules in `crates/agileplus-api/src/routes/`:
   - `features.rs`: GET /features, GET /features/:slug, POST /features
   - `work_packages.rs`: GET /features/:slug/work-packages, GET /work-packages/:id
   - `governance.rs`: GET /features/:slug/governance, POST /features/:slug/validate
   - `audit.rs`: GET /features/:slug/audit, POST /features/:slug/audit/verify

4. Add health and info endpoints (no auth required):
   ```rust
   Router::new()
       .route("/health", get(|| async { Json(json!({"status": "ok"})) }))
       .route("/info", get(info_handler))
       // ... authenticated routes
   ```

5. Set up the server startup integrated with the existing `serve` command:
   ```rust
   pub async fn start_api(addr: SocketAddr, state: AppState<...>) -> Result<()> {
       let app = create_router(state);
       let listener = tokio::net::TcpListener::bind(addr).await?;
       axum::serve(listener, app).await?;
       Ok(())
   }
   ```

6. Wire into the `agileplus serve` command alongside the gRPC server using `tokio::select!`
   or `tokio::spawn` for concurrent serving.

**Testing**: Verify router compiles with all routes. Test that health endpoint responds
without auth. Test that authenticated endpoints return 401 without a key.

---

### T086: Implement API Route Handlers

**Files**:
- `crates/agileplus-api/src/routes/features.rs`
- `crates/agileplus-api/src/routes/work_packages.rs`
- `crates/agileplus-api/src/routes/governance.rs`
- `crates/agileplus-api/src/routes/audit.rs`

**Purpose**: Implement the handler functions for each API endpoint, delegating to domain
services through port traits.

**Implementation Steps**:

1. Implement feature handlers:
   ```rust
   pub async fn list_features(
       State(state): State<AppState<impl StoragePort, impl VcsPort, impl ObservabilityPort>>,
       Query(params): Query<FeatureListParams>,
   ) -> Result<Json<Vec<FeatureResponse>>, ApiError> {
       let features = if let Some(state_filter) = params.state {
           state.storage.list_features_by_state(&state_filter).await?
       } else {
           state.storage.list_all_features().await?
       };
       Ok(Json(features.into_iter().map(FeatureResponse::from).collect()))
   }

   pub async fn get_feature(
       State(state): State<AppState<...>>,
       Path(slug): Path<String>,
   ) -> Result<Json<FeatureResponse>, ApiError> {
       let feature = state.storage.get_feature_by_slug(&slug).await
           .map_err(|_| ApiError::NotFound(format!("Feature '{slug}' not found")))?;
       Ok(Json(feature.into()))
   }
   ```

2. Implement work package handlers:
   ```rust
   pub async fn list_work_packages(
       State(state): State<AppState<...>>,
       Path(slug): Path<String>,
       Query(params): Query<WpListParams>,
   ) -> Result<Json<Vec<WorkPackageResponse>>, ApiError> {
       let feature = state.storage.get_feature_by_slug(&slug).await?;
       let wps = state.storage.list_wps_by_feature(feature.id).await?;
       Ok(Json(wps.into_iter().map(WorkPackageResponse::from).collect()))
   }
   ```

3. Implement governance handlers:
   ```rust
   pub async fn get_governance(
       State(state): State<AppState<...>>,
       Path(slug): Path<String>,
   ) -> Result<Json<GovernanceResponse>, ApiError> {
       let feature = state.storage.get_feature_by_slug(&slug).await?;
       let contract = state.storage.get_governance_contract(feature.id).await?;
       Ok(Json(contract.into()))
   }

   pub async fn trigger_validate(
       State(state): State<AppState<...>>,
       Path(slug): Path<String>,
   ) -> Result<Json<ValidationReportResponse>, ApiError> {
       // Reuse GovernanceEvaluator from WP13/T074
       let evaluator = GovernanceEvaluator::new(&*state.storage, &contract, feature.id);
       let result = evaluator.evaluate_all().await?;
       Ok(Json(result.into()))
   }
   ```

4. Implement audit handlers:
   ```rust
   pub async fn get_audit_trail(
       State(state): State<AppState<...>>,
       Path(slug): Path<String>,
   ) -> Result<Json<Vec<AuditEntryResponse>>, ApiError> {
       let feature = state.storage.get_feature_by_slug(&slug).await?;
       let trail = state.storage.get_audit_trail(feature.id).await?;
       Ok(Json(trail.into_iter().map(AuditEntryResponse::from).collect()))
   }
   ```

5. Define response types in a `responses.rs` module. These are separate from domain types —
   they control the JSON shape exposed to API consumers:
   ```rust
   #[derive(Serialize)]
   pub struct FeatureResponse {
       pub slug: String,
       pub name: String,
       pub state: String,
       pub work_packages_count: usize,
       pub created_at: String,
       pub updated_at: String,
   }
   ```

6. Define a consistent `ApiError` enum mapped to HTTP status codes:
   ```rust
   pub enum ApiError {
       NotFound(String),        // 404
       BadRequest(String),      // 400
       Unauthorized(String),    // 401
       Conflict(String),        // 409 (state machine violations)
       Internal(String),        // 500
   }

   impl IntoResponse for ApiError {
       fn into_response(self) -> Response {
           let (status, message) = match self {
               ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m),
               // ...
           };
           (status, Json(json!({"error": message}))).into_response()
       }
   }
   ```

**Testing**: Test each handler with mock StoragePort. Verify correct JSON shapes, status
codes for success and error cases, and query parameter filtering.

---

### T087: Implement Integration Key Auth Middleware (FR-030)

**File**: `crates/agileplus-api/src/middleware/auth.rs`

**Purpose**: Validate API keys from the credential store on every request to protected
endpoints.

**Implementation Steps**:

1. Define the middleware function:
   ```rust
   pub async fn validate_api_key(
       State(state): State<AppState<...>>,
       headers: HeaderMap,
       request: Request,
       next: Next,
   ) -> Result<Response, ApiError> {
       // Skip auth for health/info endpoints
       if request.uri().path().starts_with("/health") || request.uri().path().starts_with("/info") {
           return Ok(next.run(request).await);
       }

       let api_key = headers
           .get("X-API-Key")
           .and_then(|v| v.to_str().ok())
           .ok_or(ApiError::Unauthorized("Missing X-API-Key header".into()))?;

       let valid = state.config.credential_store.validate_api_key(api_key).await?;
       if !valid {
           return Err(ApiError::Unauthorized("Invalid API key".into()));
       }

       Ok(next.run(request).await)
   }
   ```

2. API keys are stored in the credential store (T088). The middleware loads valid keys
   and compares using constant-time comparison to prevent timing attacks:
   ```rust
   use subtle::ConstantTimeEq;
   fn keys_match(provided: &[u8], stored: &[u8]) -> bool {
       provided.ct_eq(stored).into()
   }
   ```

3. Support multiple API keys (e.g., one per integration: Plane.so, custom webhooks).
   Keys are identified by a prefix or looked up in a key-to-name mapping.

4. Add rate limiting (optional, but recommended): use `tower::limit::RateLimitLayer` or
   a simple in-memory counter per key.

5. Log authentication attempts (success and failure) via ObservabilityPort. Never log the
   key value itself — log only a truncated hash for identification.

**Testing**: Test middleware with valid key (passes through), invalid key (401), missing
header (401), and health endpoint (no auth required).

---

### T088: Implement Credential Management (FR-030, FR-031)

**File**: `crates/agileplus-core/src/credentials.rs` (or a new `crates/agileplus-credentials/`)

**Purpose**: Store and retrieve integration keys (GitHub token, Coderabbit API key,
Plane.so API key, AgilePlus API keys) using the OS keychain with encrypted-file fallback.

**Implementation Steps**:

1. Define the credential store trait:
   ```rust
   #[async_trait]
   pub trait CredentialStore: Send + Sync {
       async fn get(&self, service: &str, key: &str) -> Result<String, CredentialError>;
       async fn set(&self, service: &str, key: &str, value: &str) -> Result<(), CredentialError>;
       async fn delete(&self, service: &str, key: &str) -> Result<(), CredentialError>;
       async fn list_keys(&self, service: &str) -> Result<Vec<String>, CredentialError>;
       async fn validate_api_key(&self, key: &str) -> Result<bool, CredentialError>;
   }
   ```

2. Implement the OS keychain backend using the `keyring` crate:
   ```rust
   pub struct KeychainCredentialStore {
       service_prefix: String, // "agileplus"
   }

   impl KeychainCredentialStore {
       pub fn new() -> Self {
           Self { service_prefix: "agileplus".to_string() }
       }
   }

   #[async_trait]
   impl CredentialStore for KeychainCredentialStore {
       async fn get(&self, service: &str, key: &str) -> Result<String, CredentialError> {
           let entry = keyring::Entry::new(&format!("{}-{}", self.service_prefix, service), key)?;
           entry.get_password().map_err(|e| match e {
               keyring::Error::NoEntry => CredentialError::NotFound(key.to_string()),
               _ => CredentialError::BackendError(e.to_string()),
           })
       }

       async fn set(&self, service: &str, key: &str, value: &str) -> Result<(), CredentialError> {
           let entry = keyring::Entry::new(&format!("{}-{}", self.service_prefix, service), key)?;
           entry.set_password(value).map_err(|e| CredentialError::BackendError(e.to_string()))
       }
       // ... delete, list_keys, validate_api_key
   }
   ```

3. Implement the encrypted-file fallback for systems without a keychain:
   ```rust
   pub struct FileCredentialStore {
       path: PathBuf, // ~/.agileplus/credentials.enc
   }
   ```
   - Use `aes-gcm` crate for AES-256-GCM encryption.
   - Derive encryption key from a user-provided passphrase via `argon2` KDF.
   - Store credentials as encrypted JSON: `{"github_token": "...", "coderabbit_key": "..."}`.
   - On first use, prompt for passphrase and cache in memory for the session.

4. Implement automatic backend selection:
   ```rust
   pub fn create_credential_store(config: &AppConfig) -> Box<dyn CredentialStore> {
       match config.credential_backend {
           CredentialBackend::Keychain => Box::new(KeychainCredentialStore::new()),
           CredentialBackend::File => Box::new(FileCredentialStore::new(&config.credential_file)),
           CredentialBackend::Auto => {
               if keychain_available() {
                   Box::new(KeychainCredentialStore::new())
               } else {
                   Box::new(FileCredentialStore::new(&default_credential_path()))
               }
           }
       }
   }
   ```

5. Add CLI commands for credential management:
   ```
   agileplus config set-credential github-token <value>
   agileplus config get-credential github-token
   agileplus config list-credentials
   agileplus config delete-credential github-token
   ```

6. Known credential keys and their purposes:
   - `github-token`: GitHub API access (PR creation, review polling, CI checks).
   - `coderabbit-key`: Coderabbit API access (automated code review).
   - `planeso-key`: Plane.so API access (project management sync).
   - `api-keys`: Comma-separated list of valid AgilePlus API keys for auth middleware.

**Security Considerations**:
- Never log credential values. Log only "credential accessed: github-token" level messages.
- Clear credential values from memory after use (use `zeroize` crate).
- File fallback: set file permissions to 0600 on creation.
- Passphrase caching: clear on process exit via drop handler.

**Testing**: Unit test with a mock keychain (in-memory HashMap). Test set/get/delete cycle.
Test fallback to file store when keychain is unavailable. Test encrypted file round-trip.

---

### T089: Create `~/.agileplus/config.toml` Schema and Loader

**File**: `crates/agileplus-core/src/config.rs`

**Purpose**: Define the TOML configuration file schema, implement parsing, and provide
defaults for all configurable values.

**Implementation Steps**:

1. Define the config struct with serde:
   ```rust
   #[derive(Debug, Deserialize, Serialize)]
   pub struct AppConfig {
       #[serde(default)]
       pub core: CoreConfig,
       #[serde(default)]
       pub credentials: CredentialConfig,
       #[serde(default)]
       pub telemetry: TelemetryConfig,
       #[serde(default)]
       pub api: ApiConfig,
       #[serde(default)]
       pub agents: AgentConfig,
   }

   #[derive(Debug, Deserialize, Serialize)]
   pub struct CoreConfig {
       #[serde(default = "default_db_path")]
       pub database_path: PathBuf,
       #[serde(default = "default_specs_dir")]
       pub specs_dir: String,
       #[serde(default)]
       pub default_target_branch: String, // default: "main"
   }

   #[derive(Debug, Deserialize, Serialize)]
   pub struct CredentialConfig {
       #[serde(default)]
       pub backend: CredentialBackend, // auto, keychain, file
       #[serde(default = "default_credential_path")]
       pub file_path: PathBuf,
   }

   #[derive(Debug, Deserialize, Serialize)]
   pub struct TelemetryConfig {
       #[serde(default)]
       pub enabled: bool,
       #[serde(default)]
       pub otlp_endpoint: Option<String>,
       #[serde(default = "default_log_level")]
       pub log_level: String,
       #[serde(default)]
       pub log_file: Option<PathBuf>,
   }

   #[derive(Debug, Deserialize, Serialize)]
   pub struct ApiConfig {
       #[serde(default = "default_api_port")]
       pub port: u16, // default: 8080
       #[serde(default = "default_grpc_port")]
       pub grpc_port: u16, // default: 50051
       #[serde(default)]
       pub cors_origins: Vec<String>,
   }

   #[derive(Debug, Deserialize, Serialize)]
   pub struct AgentConfig {
       #[serde(default)]
       pub default_agent: String, // "claude-code" or "codex"
       #[serde(default = "default_max_subagents")]
       pub max_subagents: u32, // default: 3
       #[serde(default = "default_max_review_cycles")]
       pub max_review_cycles: u32, // default: 5
       #[serde(default = "default_review_poll_interval")]
       pub review_poll_interval_secs: u64, // default: 30
   }
   ```

2. Implement config loading with layered resolution:
   ```rust
   impl AppConfig {
       pub fn load() -> Result<Self, ConfigError> {
           let config_path = Self::config_path();
           if config_path.exists() {
               let content = fs::read_to_string(&config_path)?;
               let config: AppConfig = toml::from_str(&content)?;
               Ok(config)
           } else {
               Ok(AppConfig::default())
           }
       }

       pub fn config_path() -> PathBuf {
           dirs::home_dir()
               .unwrap_or_else(|| PathBuf::from("."))
               .join(".agileplus")
               .join("config.toml")
       }

       /// Create default config file if it doesn't exist
       pub fn init_default() -> Result<PathBuf, ConfigError> {
           let path = Self::config_path();
           if !path.exists() {
               fs::create_dir_all(path.parent().unwrap())?;
               let default = AppConfig::default();
               let content = toml::to_string_pretty(&default)?;
               fs::write(&path, content)?;
           }
           Ok(path)
       }
   }
   ```

3. Support environment variable overrides with the pattern `AGILEPLUS_<SECTION>_<KEY>`:
   ```rust
   pub fn load_with_env_overrides() -> Result<AppConfig, ConfigError> {
       let mut config = Self::load()?;
       if let Ok(port) = env::var("AGILEPLUS_API_PORT") {
           config.api.port = port.parse()?;
       }
       if let Ok(level) = env::var("AGILEPLUS_TELEMETRY_LOG_LEVEL") {
           config.telemetry.log_level = level;
       }
       // ... other overrides
       Ok(config)
   }
   ```

4. Add a CLI config command for viewing and editing:
   ```
   agileplus config show          # print current effective config
   agileplus config edit          # open config.toml in $EDITOR
   agileplus config set api.port 9090  # set a specific value
   agileplus config path          # print config file path
   ```

5. Validate config on load: port numbers in valid range, paths are writable, log level is
   valid, etc. Return actionable error messages.

**Example config.toml**:
```toml
[core]
database_path = "~/.agileplus/agileplus.db"
specs_dir = "kitty-specs"
default_target_branch = "main"

[credentials]
backend = "auto"

[telemetry]
enabled = true
log_level = "info"
otlp_endpoint = "http://localhost:4317"

[api]
port = 8080
grpc_port = 50051

[agents]
default_agent = "claude-code"
max_subagents = 3
max_review_cycles = 5
review_poll_interval_secs = 30
```

**Testing**: Test loading from valid TOML, loading with missing sections (defaults apply),
loading with invalid values (errors), and environment variable overrides.

---

### T090: Write API Integration Tests

**File**: `crates/agileplus-api/tests/api_integration.rs`

**Purpose**: Test all API endpoints end-to-end with a real axum server and mock storage.

**Implementation Steps**:

1. Set up the test harness:
   ```rust
   use axum_test::TestServer;

   async fn setup_test_server() -> TestServer {
       let storage = MockStoragePort::with_test_data();
       let vcs = MockVcsPort::new();
       let telemetry = MockObservabilityPort::new();
       let config = AppConfig::default();
       let state = AppState { storage: Arc::new(storage), vcs: Arc::new(vcs), telemetry: Arc::new(telemetry), config: Arc::new(config) };
       let app = create_router(state);
       TestServer::new(app).unwrap()
   }
   ```

2. Test each endpoint group:
   ```rust
   #[tokio::test]
   async fn test_list_features() {
       let server = setup_test_server().await;
       let response = server.get("/api/v1/features")
           .add_header("X-API-Key", "test-key")
           .await;
       response.assert_status_ok();
       let features: Vec<FeatureResponse> = response.json();
       assert!(!features.is_empty());
   }

   #[tokio::test]
   async fn test_get_feature_not_found() {
       let server = setup_test_server().await;
       let response = server.get("/api/v1/features/nonexistent")
           .add_header("X-API-Key", "test-key")
           .await;
       response.assert_status(StatusCode::NOT_FOUND);
   }

   #[tokio::test]
   async fn test_unauthorized_without_key() {
       let server = setup_test_server().await;
       let response = server.get("/api/v1/features").await;
       response.assert_status(StatusCode::UNAUTHORIZED);
   }
   ```

3. Test governance and audit endpoints:
   ```rust
   #[tokio::test]
   async fn test_get_audit_trail() { /* ... */ }

   #[tokio::test]
   async fn test_verify_audit_chain_valid() { /* ... */ }

   #[tokio::test]
   async fn test_trigger_validate() { /* ... */ }
   ```

4. Test edge cases: empty database, features with no WPs, audit trails with single entry,
   governance contracts with no rules.

5. Test CORS headers are present. Test content-type is application/json.

6. Add the tests to `make test` target.

**Testing**: These ARE the tests. Verify they pass with `cargo test -p agileplus-api`.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Keychain access fails in CI | Credential tests fail in headless environments | Use mock credential store in CI; test real keychain only in local integration tests |
| Config schema breaking changes | Existing configs fail to parse | All fields have defaults; use `#[serde(default)]` everywhere; add migration logic for removed fields |
| API key leakage in logs | Security vulnerability | Middleware never logs key values; use truncated hashes for identification; audit logging sanitizes headers |
| axum + tonic port conflicts | Both servers fail to start | Configurable ports with conflict detection at startup; clear error message if port in use |
| Plane.so API format changes | Sync integration breaks | Isolate Plane.so-specific formatting in a dedicated serializer; version the API format |

## Review Guidance

### What to Check

1. **Credential security**: No credential values in logs, error messages, or API responses.
   `zeroize` used for sensitive memory. File permissions set to 0600.

2. **API consistency**: All endpoints follow the same patterns (path style, error format,
   pagination). Response types are documented and stable.

3. **Auth middleware**: Constant-time comparison for API keys. Health endpoint accessible
   without auth. All other endpoints require valid key.

4. **Config backward compatibility**: Missing TOML sections produce defaults, not errors.
   Unknown keys are ignored (use `#[serde(deny_unknown_fields)]` only in strict mode).

5. **Port trait usage**: API handlers access storage only through `StoragePort`, never
   importing `SqliteStorageAdapter` directly.

### Acceptance Criteria Traceability

- FR-030 (Integration keys): T087, T088
- FR-031 (Credential storage): T088
- FR-032 (Configuration): T089
- API contract (api-openapi.yaml): T085, T086
- Security (no credential leakage): T087, T088

---

## Activity Log

| Timestamp | Event |
|-----------|-------|
| 2026-02-27T00:00:00Z | WP15 prompt generated via /spec-kitty.tasks |
- 2026-03-02T01:38:17Z – s1-wp15 – shell_pid=26726 – lane=doing – Assigned agent via workflow command
- 2026-03-02T02:16:48Z – s1-wp15 – shell_pid=26726 – lane=for_review – Ready: API layer and credentials
- 2026-03-02T02:17:17Z – s1-wp15 – shell_pid=26726 – lane=done – API layer and credential management complete
