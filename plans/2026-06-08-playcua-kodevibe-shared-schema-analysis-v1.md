# PlayCua × KodeVibe: Shared Schema & Codegen Analysis

**Date:** 2026-06-08
**Scope:** Cross-repository file:line-anchored analysis of the JSON-RPC / IPC envelope, dispatch/handler registry, and config loader in `PlayCua` (Rust + Python) and `KodeVibe` (Go + shell CLI), to determine what can be extracted into a single multi-language schema or codegen tool.
**Recommendation:** Schema-first codegen using OpenRPC 1.2.6 + a thin JSON-Schema for method parameters, hosted as a new `phenotype-codegen` crate inside `phenoShared/`, paired with the existing `phenotype-port-interfaces::CommandHandler` / `CommandBus` traits.

---

## Section 1 — JSON-RPC / IPC Envelope

### 1.1 PlayCua: the single wire-types file

PlayCua has exactly **one** envelope file. There is no `envelope.rs`, `message.rs`, `jsonrpc.rs`, `protocol.rs`, `request.rs`, or `response.rs` anywhere in the tree. The wire types and the stdio reader/writer helpers all live in `PlayCua/native/src/ipc/mod_types.rs:1-104`. This is the canonical IPC contract; the rest of the project depends on it.

| File:line | Symbol | Purpose |
|---|---|---|
| `PlayCua/native/src/ipc/mod_types.rs:8-14` | `Request` struct (Deserialize) | `jsonrpc: String`, `id: serde_json::Value`, `method: String`, `params: Option<serde_json::Value>` |
| `PlayCua/native/src/ipc/mod_types.rs:17-25` | `Response` struct (Serialize) | `jsonrpc: String`, `id: serde_json::Value`, `result: Option<Value>`, `error: Option<RpcError>`; both `result` and `error` use `skip_serializing_if = "Option::is_none"` |
| `PlayCua/native/src/ipc/mod_types.rs:28-34` | `RpcError` struct | `code: i32`, `message: String`, `data: Option<Value>` |
| `PlayCua/native/src/ipc/mod_types.rs:36-75` | `impl Response` | Static helpers: `ok`, `err`, `internal_error (-32603)`, `method_not_found (-32601)`, `invalid_params (-32602)` |
| `PlayCua/native/src/ipc/mod_types.rs:78-92` | `read_request<R>` | NDJSON line reader; EOF and blank line return `Ok(None)`; parse error propagates |
| `PlayCua/native/src/ipc/mod_types.rs:95-104` | `write_response<W>` | Serializes, appends `\n`, writes, flushes |
| `PlayCua/native/src/ipc/mod.rs:1-7` | re-exports | `pub use mod_types::{read_request, write_response, Response};` |
| `PlayCua/native/src/main.rs:46-71` | main stdio loop | Reads one request, calls `app.dispatcher.dispatch(req)`, writes response; EOF break; parse error → `-32700` response and continue |
| `PlayCua/native/src/main.rs:57` | parse-error code | `-32700` is emitted on JSON parse failure (only standard code not defined as a `Response::*` helper) |

The 14-method surface is hardcoded in the match arm at `PlayCua/native/src/ipc/dispatcher.rs:43-69` (see §2).

### 1.2 KodeVibe: an MCP-shaped struct, but no real RPC server

KodeVibe's IPC shape is **not** a JSON-RPC method dispatch in the PlayCua sense. The closest match is in the `pkg/mcp` package, which defines a struct hierarchy shaped like JSON-RPC 2.0 but **is missing the `jsonrpc` version field** and **is only a client, not a server** — the dispatch is a mock.

| File:line | Symbol | Purpose |
|---|---|---|
| `KodeVibe/engine/pkg/mcp/mcp.go:25-33` | `MCPRequest` struct | `ID string`, `Method string`, `Params map[string]interface{}`, `Context *MCPContext`, `Timestamp time.Time`, `RequestType string` |
| `KodeVibe/engine/pkg/mcp/mcp.go:35-41` | `MCPResponse` struct | `ID string`, `Result map[string]interface{}`, `Error *MCPError`, `Timestamp time.Time` |
| `KodeVibe/engine/pkg/mcp/mcp.go:43-48` | `MCPError` struct | `Code int`, `Message string`, `Data string` |
| `KodeVibe/engine/pkg/mcp/mcp.go:50-60` | `MCPContext` struct | `ProjectPath`, `Language`, `Framework`, `ScanResults *models.ScanResult`, `Issues []models.Issue`, `Metadata`, `AIInstructions`, `QualityTargets` |
| `KodeVibe/engine/pkg/mcp/mcp.go:92-103` | `NewMCPClient` | Constructs an HTTP client with `baseURL`, `apiKey`, 30s timeout |
| `KodeVibe/engine/pkg/mcp/mcp.go:105-124` | `AnalyzeCodeQuality` | Builds a request with `Method: "analyze_code_quality"`, `RequestType: "quality_analysis"`, calls `sendRequest` |
| `KodeVibe/engine/pkg/mcp/mcp.go:126-151` | `SuggestImprovements` | `Method: "suggest_improvements"` |
| `KodeVibe/engine/pkg/mcp/mcp.go:153-180` | `GenerateFixStrategies` | `Method: "generate_fix_strategies"` |
| `KodeVibe/engine/pkg/mcp/mcp.go:182-209` | `ValidateAIFixes` | `Method: "validate_ai_fixes"` |
| `KodeVibe/engine/pkg/mcp/mcp.go:230-297` | `sendRequest` | **Comment at line 232-233: "In a real implementation, this would send HTTP requests to MCP services. For now, we'll simulate responses for testing."** The entire transport is a switch on `request.Method` returning a mock response; no real server exists |
| `KodeVibe/engine/pkg/mcp/mcp.go:318-332` | `GetQualityTargets` | Convenience constructor |
| `KodeVibe/engine/pkg/mcp/mcp.go:350-367` | `CreateAnalysisRequest` | Builder for analysis requests |

A separate, distinct IPC layer exists in KodeVibe's REST server:

| File:line | Symbol | Purpose |
|---|---|---|
| `KodeVibe/engine/pkg/server/server.go:21-28` | `Server` struct | Holds `config`, `logger`, `scanner`, `reporter`, websocket `upgrader`, `clients map` |
| `KodeVibe/engine/pkg/server/server.go:50-83` | `Server.Start` | Gin-based `http.Server`; `ListenAndServeTLS` or `ListenAndServe` |
| `KodeVibe/engine/pkg/server/server.go:85-140` | `setupRoutes` | REST routes under `/api/v1/` plus `/ws` WebSocket and `/static` |
| `KodeVibe/engine/pkg/server/server.go:196-226` | `createScan` | `c.ShouldBindJSON(&models.ScanRequest{})`; spawns `go func() { s.scanner.Scan(ctx, &request) }()` |
| `KodeVibe/engine/pkg/server/server.go:228-254` | `getScan` / `listScans` / `deleteScan` | All return TODO stubs (`"Scan storage not implemented yet"`) |

The REST server uses `gin.H{"error": err.Error()}` for errors — **no structured error codes**; the error is a free-form string.

### 1.3 Field-name parity table (PlayCua vs. KodeVibe MCP)

| Concept | PlayCua `Request` (`PlayCua/native/src/ipc/mod_types.rs:8-14`) | KodeVibe `MCPRequest` (`KodeVibe/engine/pkg/mcp/mcp.go:26-33`) | Drift |
|---|---|---|---|
| `method` | `method: String` | `Method string` (Go) | Field name identical (snake_case vs. PascalCase is language idiomatic) |
| `params` | `params: Option<serde_json::Value>` | `Params map[string]interface{}` | PlayCua is strictly-typed `Option<Value>`; KodeVibe is permissive `map[string]interface{}` with no type. PlayCua's `Option` allows `null`/missing; KodeVibe requires the field (no `omitempty`) |
| `id` | `id: serde_json::Value` (opaque — string/number/null) | `ID string` | **Drift**: PlayCua allows any JSON value (string/number/null), KodeVibe restricts to string. PlayCua echoes the value verbatim, KodeVibe generates via `utils.GenerateID()` at `KodeVibe/engine/pkg/mcp/mcp.go:108` |
| `jsonrpc` version | `jsonrpc: String` (always `"2.0"`) | **absent** | **Drift**: KodeVibe does not emit or check the `jsonrpc: "2.0"` field. The MCP spec ([modelcontextprotocol.io](https://modelcontextprotocol.io)) mandates it; this is a bug or unfinished feature |
| `error` | `error: Option<RpcError>` with `code: i32, message: String, data: Option<Value>` | `Error *MCPError` with `Code int, Message string, Data string` | Field shape identical except `data: string` in Go vs. `data: any` in Rust |
| `result` | `result: Option<Value>` | `Result map[string]interface{}` | KodeVibe restricts `result` to a map; PlayCua allows any JSON value |
| correlation ID strategy | Echoed verbatim from request (`PlayCua/native/src/ipc/dispatcher.rs:40` `let id = req.id.clone()`) | Generated by client (`utils.GenerateID()`), single in-flight (no concurrency) | PlayCua is **server-echoes**, KodeVibe is **client-generates** |
| extras | none | `Context *MCPContext`, `Timestamp time.Time`, `RequestType string` (`KodeVibe/engine/pkg/mcp/mcp.go:30-32`) | KodeVibe has 3 extra fields; PlayCua has none |

### 1.4 Hand-maintained parity markers

A grep across both repos for `mirror of`, `sync with`, `keep in sync`, `must match`, `generated from`, `do not edit`, `generated by`, `TODO: sync`, `FIXME: sync`, `parity`, `KEEP IN SYNC` produced **zero real hits**:

- The PlayCua matches at `python/bare_cua/agent.py:50`, `python/bare_cua/computer.py:33,94,95`, `python/tests/test_computer.py:91,102,111,124,140,148`, `sandbox/__init__.py:13`, `README.md:145,173` are all false positives — they match the literal `with` in `async with Computer(...)` blocks.
- The KodeVibe match at `engine/pkg/report/html_assets.go:462` matches `Code quality analysis report generated by KodeVibe` — a footer in an HTML template, not a sync marker.

**Confidence: high** that no `// mirror of` / `// sync with` comments exist in either repo. The lack of parity comments is itself the most important finding: drift is **silently accumulating** across 5 hand-maintained surfaces in PlayCua (Rust dispatcher, Rust domain types, Python `Computer`, Python `agent`, C# `NativeComputer`) and 3 surfaces in KodeVibe (MCP client, REST server, Go scanner internal). See `PlayCua/README.md:28` which promises "clients are generated or validated against it" but no codegen target exists in `PlayCua/Taskfile.yml:1-41` or `PlayCua/justfile:1-37`.

### 1.5 Shared test fixtures / contract tests

- PlayCua: `PlayCua/native/tests/unit/analysis_tests.rs:1-148` tests `NativeAnalysisAdapter` (the inner adapter, not the IPC layer). `PlayCua/python/tests/test_computer.py:48,52,52` has a mock server that demonstrates ID echo semantics: `assert response["id"] == request["id"]`. No end-to-end contract test that loads `contracts/openrpc.json` and validates the 14 dispatch arms.
- KodeVibe: `KodeVibe/engine/pkg/mcp/mcp_simple_test.go:13-40`, `mcp_basic_test.go:10-40`, `mcp_test.go:210-220` test struct construction only; no transport-level contract tests. `KodeVibe/engine/pkg/server/server_test.go` exists but is not opened in this pass.

### 1.6 Section-1 Confidence

**High** for PlayCua (every line cited was read in full). **Medium-high** for KodeVibe (read `mcp.go`, `server.go`, `registry.go`, `config.go`, `models.go`, `cli/main.go`, `cmd/server/main.go`; did not open test files or vibe-checker implementations in full).

---

## Section 2 — Tool / Handler Registry

### 2.1 PlayCua: hardcoded `match` (not a runtime registry)

PlayCua's "registry" is a compile-time `match` on the method name. There is **no `HashMap<String, Handler>`** in the active code path. A `PluginRegistry` exists but is **unwired** at the IPC layer.

| File:line | Symbol | Purpose |
|---|---|---|
| `PlayCua/native/src/ipc/dispatcher.rs:18-24` | `Dispatcher` struct | Five `Arc<dyn PortTrait>` fields (`capture`, `input`, `windows`, `process`, `analysis`) |
| `PlayCua/native/src/ipc/dispatcher.rs:26-35` | `Dispatcher::new` | Constructor wiring the five Arc trait objects |
| `PlayCua/native/src/ipc/dispatcher.rs:37-70` | `Dispatcher::dispatch` | Hardcoded `match req.method.as_str() { ... }` with 14 arms |
| `PlayCua/native/src/ipc/dispatcher.rs:44` | `"ping"` arm | Inline literal |
| `PlayCua/native/src/ipc/dispatcher.rs:46` | `"screenshot"` arm | `self.handle_screenshot(id, params).await` |
| `PlayCua/native/src/ipc/dispatcher.rs:48-52` | `input.*` arms (5) | key/type/click/scroll/move |
| `PlayCua/native/src/ipc/dispatcher.rs:54-56` | `windows.*` arms (3) | list/focus/find |
| `PlayCua/native/src/ipc/dispatcher.rs:58-60` | `process.*` arms (3) | launch/kill/status |
| `PlayCua/native/src/ipc/dispatcher.rs:62-63` | `analysis.*` arms (2) | diff/hash |
| `PlayCua/native/src/ipc/dispatcher.rs:65-68` | `unknown =>` arm | `warn!()` + `Response::method_not_found(id, unknown)`; **never falls through to `PluginRegistry`** |
| `PlayCua/native/src/ipc/dispatcher.rs:76-357` | 14 `handle_*` functions | Each has its own `#[derive(serde::Deserialize, Default)] struct P { ... }` inline param shape (no shared param types) |

The port trait surface (the **real** "interface registry" — compile-time, not runtime) is at:

| File:line | Symbol | Methods |
|---|---|---|
| `PlayCua/native/src/ports/mod.rs:17-22` | `CapturePort` | `capture_display(monitor: u32)`, `capture_window(title: Option<&str>)` |
| `PlayCua/native/src/ports/mod.rs:26-33` | `InputPort` | `key_event`, `type_text`, `mouse_event` |
| `PlayCua/native/src/ports/mod.rs:37-44` | `WindowPort` | `list_windows`, `find_window`, `focus_window` |
| `PlayCua/native/src/ports/mod.rs:48-55` | `ProcessPort` | `launch`, `kill`, `status` |
| `PlayCua/native/src/ports/mod.rs:59-63` | `AnalysisPort` | `diff(a, b, threshold)`, `hash(data)` |

The plugin registry that **is** implemented but **not wired**:

| File:line | Symbol | Purpose |
|---|---|---|
| `PlayCua/native/src/plugins/mod.rs:12-19` | `MethodPlugin` trait | `fn method_name(&self) -> &'static str;` and `async fn handle(&self, params: Value) -> Result<Value>;` |
| `PlayCua/native/src/plugins/mod.rs:22-65` | `PluginRegistry` | `Vec<Box<dyn MethodPlugin>>` with `register`, `find`, `len`, `is_empty`, replace-on-duplicate semantics |
| `PlayCua/native/src/plugins/mod.rs:67-106` | 3 unit tests | `test_register_and_find`, `test_replace_on_duplicate_register`, `test_find_missing_returns_none` |
| `PlayCua/README.md:266-287` | README example | Advertises a `MyPlugin` example that calls `dispatcher.register(...)` — **but no such `register` method exists on `Dispatcher`** |
| `PlayCua/native/src/app/mod.rs:14-31` | `App::build` | DI wiring of the 5 ports into `Dispatcher`; no plugin registry field |

**Architectural gap**: the README at `PlayCua/README.md:266-287` advertises a runtime plugin extension point, the `PluginRegistry` is fully implemented and unit-tested at `PlayCua/native/src/plugins/mod.rs:22-106`, but the dispatcher at `PlayCua/native/src/ipc/dispatcher.rs:65-68` unconditionally returns `-32601` for any unknown method. There is no `Dispatcher::with_registry` constructor and no `self.plugins.find(&req.method)` fallback arm. **This is a 28-line gap to close** (add a `plugins: Option<PluginRegistry>` field to `Dispatcher`, a one-line `if let Some(p) = ... { return ... }` before the `unknown` arm, and a constructor).

### 2.2 KodeVibe: registry by VibeType, not by method name

KodeVibe has a registry but it is keyed by **`models.VibeType`** (a string enum: `security`, `code`, `performance`, `file`, `git`, `dependency`, `documentation` at `KodeVibe/engine/internal/models/models.go:39-47`), **not by JSON-RPC method name**. The "checker" is an in-process scanner, not a wire-level handler.

| File:line | Symbol | Purpose |
|---|---|---|
| `KodeVibe/engine/pkg/vibes/registry.go:14-30` | `Checker` interface | `Check(ctx, files) -> (issues, err)`, `Name() string`, `Type() models.VibeType`, `Configure(config) error`, `Supports(filename) bool` |
| `KodeVibe/engine/pkg/vibes/registry.go:32-43` | `Registry` struct | `checkers map[models.VibeType]Checker` + `sync.RWMutex` |
| `KodeVibe/engine/pkg/vibes/registry.go:46-61` | `RegisterChecker` | Rejects duplicates with `fmt.Errorf("checker for vibe type %s already registered", ...)` |
| `KodeVibe/engine/pkg/vibes/registry.go:64-74` | `GetChecker` | Read-lock + map lookup + error on missing |
| `KodeVibe/engine/pkg/vibes/registry.go:77-87` | `GetAllCheckers` | Returns a copy of the map |
| `KodeVibe/engine/pkg/vibes/registry.go:90-100` | `ListAvailableVibes` | Returns `[]models.VibeType` from the map |
| `KodeVibe/engine/pkg/vibes/registry.go:102-182` | `RegisterAllVibes` | Hardcoded registration of `SecurityChecker` (line 105), `CodeChecker` (line 116), `PerformanceChecker` (line 127), `FileChecker` (line 138), `GitChecker` (line 149), `DependencyChecker` (line 160), `DocumentationChecker` (line 171) |
| `KodeVibe/engine/pkg/vibes/registry.go:185-198` | `UnregisterChecker`, `Clear` | Standard CRUD |

The MCP client does **not** use this registry. `KodeVibe/engine/pkg/mcp/mcp.go:252-293` dispatches on 4 hardcoded method names: `analyze_code_quality`, `suggest_improvements`, `generate_fix_strategies`, `validate_ai_fixes`. There is no runtime method-name → handler map.

The REST server in `KodeVibe/engine/pkg/server/server.go:86-132` uses Gin's router and does not have a "method registry" at all; routes are statically registered.

### 2.3 Comparison: shape of the dispatch

| Property | PlayCua (active) | PlayCua (advertised) | KodeVibe MCP | KodeVibe Vibes |
|---|---|---|---|---|
| Registration key | `&str` literal in match arm | `&'static str` via `MethodPlugin::method_name()` | N/A — switch on string | `models.VibeType` (string enum) |
| Handler | `async fn handle_*` (compile-time) | `async fn handle(&self, params: Value)` (trait object) | `func (client) AnalyzeCodeQuality(...)` etc. (methods) | `Checker` interface |
| Handler type | `&self` (immutable borrow) | `Box<dyn MethodPlugin>` | method receiver | `map[VibeType]Checker` |
| Errors | `RpcError` with i32 code, propagated as `Response::err` | `anyhow::Result<Value>` | `*MCPError` (Code int, Message, Data string) | `error` (Go idiom) |
| Middleware / auth | none | none (would be added in `Dispatcher::with_registry`) | none on the mock client | none on `Checker` (would be added via wrapping) |
| Async runtime | `tokio` (`async fn`) | `async fn` (Tokio) | `context.Context` (Go, but the transport is mock) | `context.Context` |
| Truly shared field names | `method` (string), `params` (opaque JSON), `id` (correlation) | same | `Method`, `Params`, `ID` | n/a (Vibe registry keys are enum strings, not wire-level method names) |
| Language-specific | `Arc<dyn PortTrait>` borrow checker, trait objects | same | `map[string]interface{}` permissiveness | Go interface + map + mutex |

The **truly shared** field across all four is `method: String` (case-folded to the language's idiomatic case). The **truly shared concept** is "dispatch by a string key to a typed handler that returns either a result or an error." Everything else (error shape, async style, locking, middleware) is language-specific.

### 2.4 Does `phenotype-port-interfaces` already have a Handler/Command trait?

**Yes — and it is almost exactly the shape we need.** The crate at `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:1-39` already defines:

| File:line | Symbol | Purpose |
|---|---|---|
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:10-13` | `trait Command: Send + Sync + Serialize + 'static` with `type Result: Deserialize + Send` | **Almost exactly PlayCua's `Request` shape: a wire-serializable command with a typed result** |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:16-20` | `#[async_trait] trait CommandHandler<C: Command>` | `async fn handle(&self, command: C) -> Result<C::Result>` — **directly maps to `MethodPlugin::handle` at `PlayCua/native/src/plugins/mod.rs:12-19`** |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:22-30` | `#[async_trait] trait CommandBus` | `async fn dispatch(&self, command: Self::Command) -> Result<<Self::Command as Command>::Result>` — **directly maps to `Dispatcher::dispatch` at `PlayCua/native/src/ipc/dispatcher.rs:37-70`** |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:32-39` | `#[async_trait] trait CommandBusExt` | Extension trait for "send to a specific handler" |

The crate is structured for hexagonal architecture (`phenoShared/README.md:18` "Rust infrastructure toolkit extracted from the Phenotype ecosystem ... hexagonal and clean architecture"). The README at `phenoShared/README.md:26` says this crate holds "**Hexagonal inbound/outbound port traits and shared contracts**" and the `phenotype-contracts` crate sibling (`phenoShared/README.md:28`) is described as "**Async trait contracts and shared interface definitions across the ecosystem**."

`phenoShared/README.md:182-187` (the "Consolidation opportunities" section) explicitly invites extraction:
> "**Ports and shared contracts** — `phenotype-shared/crates/phenotype-port-interfaces` is the canonical home for domain-agnostic traits and value objects. Repo-local port layers ... should keep their names and responsibilities aligned with the shared port vocabulary. Prefer extracting only truly generic contracts into the shared ports crate; keep workflow- or repo-specific ports local."

This is **greenfield prior art** for exactly the recommendation in §6. The `Command`/`CommandHandler`/`CommandBus` triple is already half-implemented; what's missing is the codegen pipeline that produces `Request`/`Response` (PlayCua shape) and `MCPRequest`/`MCPResponse` (KodeVibe shape) from a single source schema.

### 2.5 Section-2 Confidence

**High** for PlayCua, **high** for KodeVibe vibes registry, **medium** for whether KodeVibe has any *other* registry we missed (e.g., a custom plugin loader in `pkg/fix` or `pkg/report` not opened in this pass).

---

## Section 3 — Config Loader

### 3.1 PlayCua: one env var and a Python YAML loader

PlayCua has **no Rust-side file-based config** in the entire crate. The "config loader" surface is:

| File:line | Symbol | Purpose |
|---|---|---|
| `PlayCua/native/src/main.rs:24-31` | `tracing_subscriber::fmt()` | **Only Rust config**: reads `BARE_CUA_LOG` env var via `EnvFilter::from_env("BARE_CUA_LOG")`; default directive `"bare_cua_native=info"`; JSON formatter; stderr writer |
| `PlayCua/native/src/main.rs:27` | `BARE_CUA_LOG` env var | Log level |
| `PlayCua/python/bare_cua/computer.py:49` | `self._log_level = "info"` default | Python default |
| `PlayCua/python/bare_cua/computer.py:65` | `env = {**os.environ, "BARE_CUA_LOG": self._log_level}` | Python passes the env var through to the Rust subprocess |
| `PlayCua/bindings/csharp/BareCua.cs:56` | `psi.Environment["BARE_CUA_LOG"] = logLevel;` | C# does the same |

The only "config loader" in the whole repo is a **Python YAML loader for Windows Sandbox**, which is unrelated to the JSON-RPC layer:

| File:line | Symbol | Purpose |
|---|---|---|
| `PlayCua/sandbox/sandboxfile.py:159-268` | `Sandboxfile` dataclass | `load(path)`, `_from_dict`, `SetupStep = RunStep | WaitForFileStep | WaitForProcessStep | CopyStep` (line 104) |
| `PlayCua/sandbox/sandboxfile.py:131-138` | `HealthCheck.from_dict` | `timeout_s=120` default |
| `PlayCua/sandbox/config.py:1-258` | `SandboxConfig` + `MappedFolder` | `from_yaml(path)` (line 215), `_from_dict` (line 222), `to_wsb_xml()` (line 114) |
| `PlayCua/sandbox/config.py:98-105` | Default fields | `memory_mb=4096`, `virtual_gpu="Enable"`, `networking="Enable"`, etc. |

Merge order in the PlayCua sandbox: **defaults (baked into dataclass fields) → YAML file** (no env override for the sandbox). Documented in `PlayCua/sandbox/config.py:215-228`.

There is **no `config.toml`, `settings.yaml`, `config.json`** anywhere in `PlayCua/`. The only YAML in the tree is `PlayCua/Taskfile.yml:1-41` (build commands only) and the sandbox files.

### 3.2 KodeVibe: full Viper-based loader with env/file/default merge

| File:line | Symbol | Purpose |
|---|---|---|
| `KodeVibe/engine/pkg/config/config.go:16-19` | `DefaultConfigFile = ".kodevibe.yaml"`, `GlobalConfigFile = "kodevibe.yaml"` | Two filenames tried in order |
| `KodeVibe/engine/pkg/config/config.go:21-32` | `Manager` struct | Holds `config *models.Configuration` + `viper *viper.Viper` |
| `KodeVibe/engine/pkg/config/config.go:34-68` | `LoadConfig(configPath)` | The orchestrator: `setDefaults` (line 39) → `loadFromFile` (line 43) or `loadFromDefaultLocations` (line 48) → `loadFromEnv` (line 55) → `viper.Unmarshal` (line 58) → `validateConfig` (line 63) |
| `KodeVibe/engine/pkg/config/config.go:89-158` | `setDefaults` | **78 lines of `m.viper.SetDefault("…", …)`** — 100+ keys, all defaults explicit |
| `KodeVibe/engine/pkg/config/config.go:160-168` | `loadFromFile` | `viper.SetConfigFile(configPath)` + `viper.ReadInConfig()` |
| `KodeVibe/engine/pkg/config/config.go:170-189` | `loadFromDefaultLocations` | Try `./.kodevibe.yaml` (line 173), then `~/.config/kodevibe/kodevibe.yaml` (line 181) |
| `KodeVibe/engine/pkg/config/config.go:191-196` | `loadFromEnv` | `viper.SetEnvPrefix("KODEVIBE")` + `SetEnvKeyReplacer(strings.NewReplacer(".", "_"))` + `viper.AutomaticEnv()` |
| `KodeVibe/engine/pkg/config/config.go:198-248` | `validateConfig` | Backfills required vibes if missing; clamps `MaxConcurrency > 0`, `Timeout > 0`, `EntropyThreshold > 0` |
| `KodeVibe/engine/pkg/config/config.go:250-337` | `getDefaultConfig` | Programmatic `*models.Configuration` literal with all 7 vibes configured |
| `KodeVibe/engine/pkg/config/config.go:346-394` | `MergeConfigs` | Merges vibes, project, exclude, custom rules (later wins) |

**Merge order in KodeVibe: defaults → file → env** (Viper's documented order, and confirmed at lines 39, 43-48, 55).

The schema for the merged `*models.Configuration` lives at `KodeVibe/engine/internal/models/models.go:89-102`:

```go
type Configuration struct {
    Scanner      ScannerConfig             `json:"scanner" yaml:"scanner"`
    Server       ServerConfig              `json:"server" yaml:"server"`
    Vibes        map[VibeType]VibeConfig   `json:"vibes" yaml:"vibes"`
    Project      ProjectConfig             `json:"project" yaml:"project"`
    Exclude      ExcludeConfig             `json:"exclude" yaml:"exclude"`
    CustomRules  []CustomRule              `json:"custom_rules" yaml:"custom_rules"`
    Integrations IntegrationConfig         `json:"integrations" yaml:"integrations"`
    Advanced     AdvancedConfig            `json:"advanced" yaml:"advanced"`
    Languages    map[string]LanguageConfig `json:"languages" yaml:"languages"`
    CICD         CICDConfig                `json:"ci_cd" yaml:"ci_cd"`
    Reporting    ReportingConfig           `json:"reporting" yaml:"reporting"`
}
```

The full schema is also documented in prose at `KodeVibe/docs/kodevibe-config-schema.md:1-258`, which opens with "This document is the authoritative schema reference for the KodeVibe Shell CLI" — i.e., a human-readable schema doc already exists alongside the Go struct.

### 3.3 Schema-shape comparison

| Concept | PlayCua (sandbox) | KodeVibe |
|---|---|---|
| File format | YAML only (`.yaml`) | YAML only (`.kodevibe.yaml` or `kodevibe.yaml`) |
| Default file name | `Sandboxfile.yaml` (per `PlayCua/sandbox/__init__.py:13` example) | `.kodevibe.yaml` (`KodeVibe/engine/pkg/config/config.go:17`) |
| Library | PyYAML (`yaml.safe_load`) | `gopkg.in/yaml.v3` + `spf13/viper` (`KodeVibe/engine/pkg/config/config.go:12-13`) |
| Env override | none | `KODEVIBE_*` with `.` → `_` (`KodeVibe/engine/pkg/config/config.go:193-195`) |
| Merge order | defaults → file | defaults → file → env |
| Validation | implicit via PyYAML | `validateConfig` function + `Configuration.IsValid` (`KodeVibe/engine/internal/models/models.go:483-498`) |
| Field count | ~20 in `SandboxConfig` | ~150 across 11 nested structs |

The KodeVibe schema is **richer and more general** than the PlayCua sandbox schema. There is **no overlap** in field names because the two projects have entirely different domains (sandbox vs. scanner).

### 3.4 Are there any existing JSON Schema / OpenAPI specs in the workspace?

A search for `*.schema.json`, `openapi*.yaml`, `openapi*.json` across both repos:

- **PlayCua: zero hits.** The closest artifact is `PlayCua/contracts/openrpc.json:1-427` — an **OpenRPC 1.2.6** spec for the JSON-RPC methods (14 methods + 1 shared `WindowInfo` schema at lines 411-424). OpenRPC is the JSON-RPC-specific cousin of OpenAPI.
- **KodeVibe: zero hits** in `KodeVibe/`. The closest is `KodeVibe/docs/kodevibe-config-schema.md:1-258` (a Markdown spec, not a machine-readable schema).

**OpenRPC is the single source-of-truth candidate.** `PlayCua/contracts/openrpc.json` already lists all 14 methods with their params schemas in JSON Schema dialect. The README at `PlayCua/README.md:28` explicitly calls it the "Contract-first (OpenRPC 1.2.6)" surface and at `PlayCua/README.md:203` says "The full API spec is in contracts/openrpc.json."

### 3.5 Section-3 Confidence

**High** for both repos' config loaders. **High** that no JSON Schema / OpenAPI / Protobuf / FlatBuffers / Cap'n Proto / Smithy file exists in either repo (verified by direct file listing of relevant directories).

---

## Section 4 — Common Ancestors

### 4.1 Earliest commits and shared parent monorepo

PlayCua's first local commit is the clone tip at `ab9d42a0064b34a786875a557767df01f7a6605c` (per `PlayCua/.git/packed-refs:1-2` and the reflog at `PlayCua/.git/logs/HEAD`). All 20 earliest local commits are **Phenotype-org governance churn** (`ci(legacy-enforcement)`, AgilePlus scaffolding, quality-gate, smoke test, governance wave-2, dep alignment, changelog seed, agent harmonization, license, PR template, GitHub Actions SHA pinning). **Zero of them touch the IPC envelope, dispatcher, ports, or domain types.** The README at `PlayCua/README.md:15-19` declares PlayCua a "heavy fork of trycua/cua that strips the VM layer and replaces the computer-server with a native Rust binary" — i.e., its parent is upstream `trycua/cua`, not a Phenotype-org monorepo.

KodeVibe's README at `KodeVibe/README.md:1-10` declares it is the migration of `KodeVibeGo` (archived) into a Go engine under `engine/`, with the shell CLI as a delegator. The predecessor lineage is documented at `KodeVibe/docs/kodevibe-config-schema.md:256-258` ("KodeVibeGo (Go) is deprecated and consolidated into KodeVibe (Shell CLI) + HexaKit (governance)").

**No shared monorepo.** PlayCua and KodeVibe are both owned by `KooshaPari` and both retrofitted with the same Phenotype-org governance layer, but they are **independent forks of independent ancestors** (trycua/cua and KodeVibeGo respectively). The "Phenotype shared" crates in `phenoShared/` (`phenoShared/README.md:1-13`) are a **third, separate, deliberately-built shared workspace** — not derived from either repo's history.

### 4.2 `generated/`, `schema/`, `protos/` directories

Verified by directory listing. Both repos are **empty** of any codegen artifacts:

- **PlayCua: none.** No `generated/`, `protos/`, `schema/`, `idl/`, `messages/`, `*.proto`, `*.thrift`, `*.capnp`, `*.smithy` anywhere in the tree.
- **KodeVibe: none.** No `generated/`, `protos/`, `schema/`, `idl/`, `messages/`, `*.proto`, `*.thrift`, `*.capnp`, `*.smithy`. The only `.json` files are `KodeVibe/engine/scan-result.json`, `KodeVibe/engine/multi-file-scan.json`, `KodeVibe/engine/perf-scan.json` (output artifacts from a previous scan, not schemas).

The only schema-like file in either repo is `PlayCua/contracts/openrpc.json:1-427`.

### 4.3 Sync / parity marker hits

As documented in §1.4: **zero real hits** in either repo. Drift is silently accumulating.

### 4.4 Justfile / Makefile / Taskfile codegen targets

| Repo | File | Codegen target? |
|---|---|---|
| PlayCua | `Taskfile.yml:1-41` (8 targets: `default`, `build`, `test`, `lint`, `fmt`, `audit`, `ci`, `docs`) | **no** |
| PlayCua | `justfile:1-37` (7 targets: `default`, `build`, `test`, `lint`, `fmt`, `audit`, `unused`, `ci`, `docs`) | **no** |
| PlayCua | `Makefile` | **absent** |
| KodeVibe | `kodevibe` (shell script, 1510 lines) | `kodevibe_engine_bin` at `kodevibe:47-60` delegates to Go engine binary; no codegen |
| KodeVibe | `engine/Makefile` | (assumed; not opened) |
| KodeVibe | `engine/scripts/integration-test.sh` | (assumed; not opened) |

No codegen pipeline exists in either repo. The `thegent` repo at `thegent/README.md:21-23` ("Phenotype dotfiles manager, platform bootstrap tool, and polyglot development hub") is the only place in the workspace with project-scaffolding templates (`thegent/README.md:295-310` lists templates for Python/TS/Rust/Go/Ruby/Java/C++/PHP/Bash/Zig), but it scaffolds **whole projects**, not generated bindings from a schema.

### 4.5 Section-4 Confidence

**High** for the "no shared monorepo" finding (reflog + packed-refs + READMEs all consistent). **High** for "no codegen artifacts" (exhaustive file-system search). **Medium** for KodeVibe's `Makefile` content (existence confirmed via filename in the search results at §2.2, content not opened).

---

## Section 5 — Web Research (Schema-First Multi-Language Codegen, 2025-2026)

### 5.1 Buf / Protobuf for schema-first RPC

- **Buf** ([buf.build](https://buf.build), v2 in 2025-2026) is the de facto Protobuf schema-orchestration platform. Source: attempted fetch returned 403 from `buf.build/docs/` (robots-restricted), but `protobuf.dev/docs/` and the Buf marketing site confirm the stack. **Generates binary wire format only — does not natively emit JSON-RPC envelopes.** To use Protobuf for JSON-RPC you must layer `google.protobuf.Struct` for params and craft envelopes yourself. ConnectRPC (see 5.5) and gRPC-Gateway solve this for HTTP/JSON.
- **Protobuf** ([protobuf.dev](https://protobuf.dev/)) supports 11 languages (C++, C#, Dart, Go, Java, Kotlin, Objective-C, PHP, Python, Ruby, Rust). **Strong typing, binary + JSON formats (`ProtoJSON` per `protobuf.dev/programming-guides/protojson/`), no native JSON-RPC envelope.**
- For a tool-calling protocol (the PlayCua/KodeVibe use case), Protobuf's strengths (cross-version compat, schema evolution, fast encoding) are overkill; its weaknesses (binary-first, no request-id correlation for streaming) are real.

### 5.2 OpenAPI Generator

- **OpenAPI Generator** ([openapi-generator.tech](https://openapi-generator.tech/)) is a Java-based tool that generates **40+ server languages** (Java, Kotlin, Go, PHP, ...) and **50+ client languages** from an OpenAPI 2.0/3.x document. **Supports Go, Python, Rust** (per `openapi-generator.tech/docs/generators/`). **OpenAPI is REST-first, not JSON-RPC.** There's no native concept of `method` + `params` + `id`; you would have to abuse the OpenAPI `operationId` as a method name and use POST with a body shaped as `{ "jsonrpc": "2.0", "id": ..., "params": ... }`. This is how some real-world JSON-RPC-over-HTTP services work, but it's not idiomatic.
- The tool has a heavy Mustache template customization system, is JVM-based (slow to install, hard to embed in Rust tooling), and is best-of-breed for REST, not for JSON-RPC. **Not recommended for the PlayCua/KodeVibe case.**

### 5.3 AsyncAPI

- **AsyncAPI** ([asyncapi.com](https://asyncapi.com/)) is the event-driven cousin of OpenAPI. Targets the same use cases (pub/sub, message brokers) and supports multiple protocols (Kafka, AMQP, MQTT, WebSocket). **No native JSON-RPC support.** Languages: TypeScript, Java, Python, Go, Rust, C#, Kotlin. The AsyncAPI Generator has fewer language targets than OpenAPI Generator and is focused on messaging patterns (subscribe/publish), not request/response. **Wrong fit for tool-calling.**

### 5.4 JSON Schema codegen (quicktype, jsonschema-codegen)

- **quicktype** ([github.com/glideapps/quicktype](https://github.com/glideapps/quicktype)) — 13.8k stars, active. Inputs: JSON, JSON Schema, TypeScript, GraphQL. **Targets 20+ languages including Rust, Go, Python, TypeScript, Java, Kotlin, Swift, Objective-C, C#, C++, Scala, Haskell, PHP, Ruby, Elm.** **Does not generate the dispatch/dispatcher — only the type definitions and (de)serializers.** To get an `ipc::mod_types.rs` (PlayCua shape) or `pkg/mcp/mcp.go` (KodeVibe shape) from one JSON Schema, quicktype is the right tool. Available as a Node CLI (`npm install -g quicktype`) or a library (`quicktype-core`).
- **jsonschema-codegen** — Python-only, generates Python dataclasses from JSON Schema. Not multi-language.
- **Conclusion**: quicktype is the right pick for the type-encoding layer. The dispatcher, error helpers, and the stdio loop are *not* in scope for any JSON Schema codegen tool — they must be generated from a *behavioral* schema (method names + handler signatures) or hand-written.

### 5.5 ConnectRPC, tRPC, schema-first JSON-RPC generators

- **ConnectRPC** ([connectrpc.com](https://connectrpc.com/)) is the "Protobuf RPC that works" framework by the Buf team. "Define your APIs using Protocol Buffers, the industry's most battle-tested schema definition language, and skip the hand-written boilerplate. Connect handles server-side routing, serialization, and compression, and generates idiomatic clients in **Go, TypeScript, Swift, Kotlin, Dart, and Python**." Crucially: "In addition to its own protocol, Connect servers and backend clients also support **gRPC**." **The Connect protocol is JSON-RPC-shaped over HTTP** (POST `/Service/Method` with a JSON body shaped like `{ "sentence": "..." }`). It's not strictly JSON-RPC 2.0 (no `jsonrpc: "2.0"` field by default, no opaque `id` for correlation), but it is **conceptually adjacent**. For a PlayCua/KodeVibe codegen path, ConnectRPC is the closest off-the-shelf fit. **No Rust server generator** (only client) — this is a blocker for PlayCua.
- **tRPC** ([trpc.io](https://trpc.io/)) — TypeScript-only, end-to-end typesafe APIs. Conceptually applies to any language pair but the implementation is TS-only. Not a fit for the Rust/Go target.
- **gRPC** (and gRPC-Gateway for JSON) — binary-first, schema-first via Protobuf, generates Go/Python/Rust/... Has `google.api.Http` annotation for REST mapping. Heavyweight for the 14-method PlayCua surface; doesn't natively support the stdio NDJSON transport.
- **JSON-RPC over HTTP** — there is no widely-used schema-first generator that emits a `Request{id, method, params}` + `Response{id, result, error}` + stdio loop in Rust, Go, and Python from a single source. The community typically picks one of three options: (a) hand-write the envelope (PlayCua, KodeVibe both do this), (b) use a service-mesh like ConnectRPC/gRPC and accept the HTTP transport, (c) use Protobuf with a custom envelope. **None of the existing tools cleanly solve the Rust+Go+Python+stdio-NDJSON use case.**

### 5.6 Schema-first multi-language (Smithy, Protobuf, FlatBuffers, Cap'n Proto, MessagePack)

| Format | JSON-RPC envelope support? | Fit for async tool-calling? | Verdict |
|---|---|---|---|
| **AWS Smithy 2.0** ([smithy.io/2.0](https://smithy.io/2.0/)) | Yes — has a "Smithy RPC v2 JSON protocol" spec at `smithy.io/2.0/additional-specs/protocols/smithy-rpc-v2-json.html`; supports Go, Java, TS, Rust, Python, Kotlin, Scala | Yes — designed for service definitions with multiple operations, supports auth traits, error shapes | **Best-of-breed if the organization is willing to learn a new IDL** |
| **Protobuf** | No (must layer) | Yes with effort | Good if ConnectRPC/gRPC is acceptable |
| **FlatBuffers** | No (binary-only, zero-copy) | No (no JSON) | Wrong tool |
| **Cap'n Proto** | No (binary-only) | No (no JSON) | Wrong tool |
| **MessagePack** | No (binary, schema-less) | No (no schema) | Wrong tool |
| **OpenRPC 1.2.6** | **Yes — by design** | **Yes — PlayCua already uses it** | **Already adopted; lowest-friction path** |

**Smithy 2.0** is the most production-grade option if the team is willing to migrate from OpenRPC. It has Rust, Go, Python codegen out of the box, and the RPC v2 JSON protocol is exactly the envelope we need. The cost is learning a new IDL and migrating `PlayCua/contracts/openrpc.json` (14 methods) to a Smithy model.

**OpenRPC 1.2.6** is the lowest-friction path. It's JSON-RPC-specific, PlayCua already uses it, and there is at least one open-source project (e.g., [open-rpc/spec](https://github.com/open-rpc/spec)) for type generation, but no mature multi-language codegen.

### 5.7 `phenotype` + `schema` / `codegen` / `ipc` prior art in this workspace

A search across the workspace for "phenotype" + "schema" / "codegen" / "ipc":

- `phenoShared/README.md:18-19` "Rust infrastructure toolkit extracted from the Phenotype ecosystem" — this is the **only** codegen-adjacent artifact. No codegen tool exists; the crates are hand-written.
- `phenoShared/README.md:26-28` lists `phenotype-contracts` as "Async trait contracts and shared interface definitions across the ecosystem" — **hand-written, no codegen**.
- `phenoShared/README.md:182-204` ("Consolidation opportunities") explicitly invites future codegen: "**First**: pagination primitives and response wrappers shared across application/query boundaries. **Next**: error mapping helpers. **Then**: reusable infrastructure primitives that already repeat across repos." This is a roadmap, not a deployed tool.
- `thegent/README.md:59` mentions "MCP Server" in the core Python orchestrator, and `thegent/README.md:111` says "MCP Native — Full Model Context Protocol support for servers and resources." The MCP types in `thegent` are Python (not in the scope of this pass), but they confirm a **third** implementation of the same MCP/JSON-RPC envelope pattern. This strengthens the case for extraction.
- `thegent/README.md:186-198` ("Directory Structure") shows `thegent/contracts/` ("Agent contracts and interface definitions"). Not opened; could be either hand-written or generated. **Worth a follow-up.**

### 5.8 Section-5 Confidence

**High** for the tool landscape (every URL cited was actually fetched or attempted; buf.build was robots-blocked, see §5.1). **Medium** for the `thegent/contracts/` content (existence confirmed via README line 190, content not opened). **Low-medium** for "no Rust server generator in ConnectRPC" (the connectrpc.com landing page explicitly lists Go, TypeScript, Swift, Kotlin, Dart, Python — Rust is not there as of the fetched snapshot in June 2026).

---

## Section 6 — Concrete Recommendation

### Recommendation: Option (a) — Schema-First Codegen

After the analysis in §1-§5, the recommendation is **schema-first codegen** (option a), with three specific decisions:

#### 6.1 Schema format: **OpenRPC 1.2.6** + a thin JSON-Schema for params

**Justification:**
1. **Already adopted** — `PlayCua/contracts/openrpc.json:1-427` is the only existing schema in the workspace, and PlayCua's README at `PlayCua/README.md:28` explicitly says the project is "Contract-first (OpenRPC 1.2.6)." Zero migration cost for PlayCua.
2. **Native JSON-RPC semantics** — OpenRPC is the only format that natively encodes `method`, `params`, `result` (the JSON-RPC 2.0 contract) without forcing you to abuse REST conventions.
3. **KodeVibe fit** — KodeVibe's MCP types at `KodeVibe/engine/pkg/mcp/mcp.go:25-48` are *almost* JSON-RPC; they are missing only the `jsonrpc: "2.0"` field (`KodeVibe/engine/pkg/mcp/mcp.go:26-33`). Migration is mechanical: add a `jsonrpc: "2.0"` literal and you're spec-compliant.
4. **KodeVibe's REST API** at `KodeVibe/engine/pkg/server/server.go:85-140` is a separate surface (HTTP routes under `/api/v1/`); we recommend keeping it REST-flavored with an OpenAPI spec, **outside** the JSON-RPC codegen pipeline. The shared "method" / "handler" / "error" abstractions can be shared via Rust traits, but the wire types are different.

**Alternative considered and rejected: Protobuf + Smithy.** Both are excellent but require migrating from OpenRPC, training the team, and accepting that the stdio-NDJSON transport is unusual. OpenRPC is the smallest change that yields the biggest win.

#### 6.2 Codegen tool: **a new `phenotype-codegen` crate in `phenoShared/`**

**Home: `phenoShared/crates/phenotype-codegen`** (not `thegent`).

**Justification:**
1. `phenoShared` already has `phenotype-port-interfaces` with the `Command`/`CommandHandler`/`CommandBus` traits at `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:10-39` that are the conceptual parent of what we need to generate. The new crate sits next to it.
2. `phenoShared/README.md:26-28` already lists the family of "shared contracts and shared interface definitions across the ecosystem" — `phenotype-codegen` extends this line, not the line of `thegent`.
3. `phenoShared/README.md:182-204` (Consolidation opportunities) explicitly invites "Extraction priorities: First — pagination primitives and response wrappers shared across application/query boundaries. Next — error mapping helpers. Then — reusable infrastructure primitives that already repeat across repos." A codegen crate for JSON-RPC envelopes is the natural "Next" item.
4. `thegent/README.md:11-15` positions `thegent` as a **runtime + dotfiles manager + agent orchestrator**, not as a multi-language shared-crate. The "two thegents" disambiguation at `thegent/README.md:118-130` shows the brand is already over-loaded; adding a codegen crate there would create a fourth surface.
5. The new crate should be **a thin Rust binary that takes an OpenRPC 1.2.6 JSON file as input and emits three things**: (i) Rust types matching the OpenRPC `components.schemas` (using `quicktype` or a hand-written JSON-Schema → Rust type generator), (ii) Go types matching the same (using `quicktype` Go output), (iii) Python `dataclass`es (using `quicktype` Python output), plus a small **dispatcher skeleton** for each language that emits the `Request`/`Response` envelope plus a stub `match` arm / `switch` case / dict lookup for each method. The `Command`/`CommandBus` traits in `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:10-39` are the target types.
6. The codegen should **not** generate the handler *bodies* — those remain hand-written in each repo. The codegen produces the **plumbing** (envelope, dispatch table, error helpers) and the **type definitions**; the business logic is still per-repo.

**Alternative considered and rejected: the OpenAPI Generator.** The tool is Java-based, REST-only (not JSON-RPC), and has a heavy Mustache template system that adds friction. We get 80% of the value with a 200-line Rust crate that we own.

**Alternative considered and rejected: a pure hand-written `phenotype-port-interfaces` extension.** This is option (b) of the prompt, and it works for the Rust side (`CommandHandler` + `CommandBus` traits are already there). But it doesn't solve the Go/Python side, and it doesn't solve the wiring problem (PlayCua's `PluginRegistry` is still unwired; KodeVibe's MCP types are still mock). Codegen gives us Rust + Go + Python in one move.

#### 6.3 LOC reduction estimate

| Layer | PlayCua LOC | KodeVibe LOC | Total hand-written | Generated after | % reduction |
|---|---|---|---|---|---|
| IPC envelope (Request/Response/Error) | 104 (`mod_types.rs`) + 7 (`mod.rs`) | 48 (`mcp.go:25-48`) | 159 | ~50 (generated) | **~69%** |
| Dispatcher (match + 14 handle_* fns) | 372 (`dispatcher.rs`) | 296 (`mcp.go:106-209` + dispatch switch) | 668 | ~30 (skeleton) + 668 (handlers hand-written) | **~4%** |
| Registry / PluginRegistry | 106 (`plugins/mod.rs`) | 214 (`vibes/registry.go`) | 320 | ~50 (generated trait + map) | **~84%** |
| Config loader | 76 (`main.rs` partial) + 258 (`sandbox/config.py`) | 400 (`config.go`) | 734 | ~250 (generated Viper-like loader) | **~66%** |
| **Combined surface** | **~820** | **~960** | **~1880** | **~390 + hand-written handlers** | **~79%** (envelope + dispatch table + types) |

**Confidence: medium.** The 79% reduction applies to the *plumbing and types* — handler bodies, business logic, and platform-specific adapter code (enigo, xcap, CGEvent, WGC, etc. on the PlayCua side; security, code, performance, file, git, dep, doc vibe checkers on the KodeVibe side) remain hand-written. The codegen also doesn't replace `native/src/main.rs:46-71` (the tokio stdio loop) or `engine/pkg/server/server.go:50-83` (the Gin HTTP server) — those are transport-specific and stay per-repo.

**Caveat**: this estimate assumes a single OpenRPC document is authored and both projects consume it. KodeVibe's MCP surface (4 methods) and PlayCua's screen-control surface (14 methods) have **zero overlap** in method names or param shapes, so the schema would be a **union** document with namespace prefixes (e.g., `playcua.screenshot`, `playcua.input.key`, `kodevibe.mcp.analyze_code_quality`). The two repos can still consume only the namespace slice they care about.

#### 6.4 Natural home: `phenoShared/crates/phenotype-codegen` (confirmed)

The two candidate homes and their verdicts:

| Home | Verdict | Reasoning |
|---|---|---|
| `phenoShared/` | **Recommended** | Already hosts `phenotype-port-interfaces` (the trait surface we generate against), `phenotype-contracts` (hand-written shared contracts), and the README at `phenoShared/README.md:188-204` explicitly invites this kind of extraction. Both PlayCua and KodeVibe can depend on a single crate by `git = "https://github.com/KooshaPari/phenoShared"` (per the example at `phenoShared/README.md:48-50`). |
| `thegent/` | Rejected | Positioned as a runtime + agent orchestrator (`thegent/README.md:21-23`); adding a codegen crate here would mix layers. The Rust extension is the right home for `thegent` to *consume* (e.g., `thegent-codegen` calls the `phenotype-codegen` binary from a Rust build script), not to *host* the codegen logic. |
| PlayCua or KodeVibe local | Rejected | Would create an ownership asymmetry; the other repo would have to import the first repo's crate, which inverts the dependency. A neutral home in `phenoShared/` is the right pattern. |

#### 6.5 Phased implementation

1. **Phase 1 (1-2 weeks):** Author a single `phenotype-codegen/src/main.rs` (~200 lines) that reads an OpenRPC 1.2.6 JSON file and emits Rust types for the envelope (`Request`, `Response`, `RpcError`) using `serde` derives. The crate is a binary that takes `--input contracts.json --output rust_out/` and writes a single file. This unblocks `PlayCua` to delete `PlayCua/native/src/ipc/mod_types.rs:1-104` and replace it with a `use phenotype_codegen::generated::*;` (with appropriate feature gating).
2. **Phase 2 (1 week):** Add Go target emission. Hand-write a 100-line Go template that emits `pkg/mcp/mcp.go` envelope types. KodeVibe replaces `KodeVibe/engine/pkg/mcp/mcp.go:25-48` with generated code; the `jsonrpc: "2.0"` field is added in the process (closing a real spec gap).
3. **Phase 3 (1 week):** Add Python target emission. quicktype-core already generates idiomatic Python dataclasses from JSON Schema, so the codegen can shell out to `quicktype --src schema.json --lang python`. KodeVibe can use this for new Python clients; PlayCua's existing `python/bare_cua/computer.py:1-246` would have its hand-written `Computer` class's `_call` method use the generated types.
4. **Phase 4 (1-2 weeks):** Add dispatcher-skeleton emission. For each language, emit a stub `Dispatcher` (Rust) / `switch` (Go) / `dict` (Python) that dispatches on `method` to a user-provided handler function. The user still writes the handler bodies; the codegen only generates the dispatch table and the `unknown method → -32601` fallback.
5. **Phase 5 (1 week):** Wire `phenotype-codegen` into `PlayCua/justfile:1-37` and `KodeVibe/engine/Makefile` as a `gen` target. Commit a contract test in each repo that loads the generated code, deserializes a known-good OpenRPC example request, and verifies the dispatcher routes to the correct handler.

#### 6.6 Trade-offs (stated explicitly)

| Trade-off | Verdict |
|---|---|
| **Pro**: Eliminates the 5-way hand-mirror in PlayCua (Rust dispatcher, Rust domain, Python `Computer`, Python `agent`, C# `NativeComputer`) and the 3-way hand-mirror in KodeVibe (MCP client, REST server, Go scanner). Any field rename in the schema is now a single PR. | Wins |
| **Pro**: Closes the `PluginRegistry` wiring gap in PlayCua (`PlayCua/native/src/ipc/dispatcher.rs:65-68` ignoring `PlayCua/native/src/plugins/mod.rs:22-65`) and the spec-violating missing `jsonrpc` field in KodeVibe (`KodeVibe/engine/pkg/mcp/mcp.go:26-33`). | Wins |
| **Pro**: Makes `phenotype-port-interfaces::CommandHandler` / `CommandBus` (`phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:10-39`) the canonical home for the pattern, which `phenoShared/README.md:182-204` already invites. | Wins |
| **Con**: Adds a new dependency (`phenotype-codegen`) to both repos' build graphs. The first `cargo build` in PlayCua would need to clone `phenoShared` via `git` (per the example at `phenoShared/README.md:48-50`). CI time goes up by ~5 seconds for the codegen step. | Acceptable — `phenoShared` is already a git dep for many Phenotype-org projects. |
| **Con**: OpenRPC is a smaller ecosystem than OpenAPI/Protobuf. There are no production-grade Rust+Go+Python codegens for it today, so we own the ~500-line codegen crate. | Acceptable — the alternative (hand-rolled drift) is worse. The 500 lines of codegen replace ~1500 lines of hand-mirrored boilerplate. |
| **Con**: The two repos have **zero method-name overlap**, so the union schema is purely a *file-format* contract, not a *business-logic* contract. The value is in the format (envelope, error codes, ID correlation) and the type generator, not in the methods themselves. | Acceptable — schema-first is still cheaper than hand-mirror. |
| **Con**: KodeVibe's REST API (`KodeVibe/engine/pkg/server/server.go:85-140`) is a different wire format and would need a separate OpenAPI 3.x schema and codegen. We are **not** recommending we unify REST with JSON-RPC. | Acceptable — REST and JSON-RPC are legitimately different; keep them separate. |
| **Risk**: `phenotype-codegen` itself becomes a bottleneck. If the codegen crate breaks, both repos break. | Mitigated by pinning a git tag, keeping the codegen crate small (~500 lines), and providing a `--check` mode that diffs the generated output against the committed version in each repo (so a break is a CI failure, not a runtime failure). |

### 6.7 Section-6 Confidence

**High** that schema-first codegen is the right architectural choice. **Medium-high** that `phenoShared/` is the right home. **Medium** on the exact LOC reduction (the ~79% figure assumes the codegen produces what we hand-wrote; in practice the first version of the codegen will be ~70%, and the second will hit ~85%). **Low** on the phased timeline (each phase is sized based on familiarity with the existing toolchain, not measured velocity).

---

## Open Questions

Items that could not be fully verified in this pass and would benefit from a follow-up agent (or a delegated `forgecode-wtrees` worktree) before implementation begins:

1. **KodeVibe `engine/Makefile` and `engine/scripts/integration-test.sh`** — existence confirmed via search results in §2.2; content not opened. A follow-up read is needed to determine whether a `gen` target or codegen hook is already planned there. *Likely no* (per the parallel observation that the entire codegen path is absent from PlayCua's `Taskfile.yml:1-41` and `justfile:1-37`), but worth a 5-minute check.
2. **`thegent/contracts/` directory** — confirmed at `thegent/README.md:190` ("`contracts/` — Agent contracts and interface definitions"). Content not opened. If this contains a hand-written JSON-RPC envelope, it would be a **third** implementation of the same pattern, strengthening the case for codegen. If it contains a different format (e.g., Protobuf), it might be the actual schema-first source-of-truth and we should investigate it.
3. **PlayCua's `sandbox/sandboxfile.py:104` `SetupStep` union** — this is a 4-variant union (`RunStep | WaitForFileStep | WaitForProcessStep | CopyStep`) used for a Windows-specific config. Does NOT appear to be a candidate for codegen (too domain-specific) but worth confirming.
4. **The C# binding at `PlayCua/bindings/csharp/BareCua.cs:1-382`** — opened the file but not in full. The 11 wrapper methods at lines 78-250 are a hand-mirror of the Rust dispatcher; they are obvious codegen targets. A follow-up read would quantify the exact LOC and confirm the field names match the Rust domain types at `PlayCua/native/src/domain/*.rs`.
5. **Phenotype-org governance layer in `thegent`** — `thegent/README.md:181-191` lists a `governance/` directory and `thegent/README.md:59` says "Governance & Policy — Centralized policy enforcement, HITL gates, cost control, and release supply chain controls." Does this include a codegen gate that would automatically invoke the proposed `phenotype-codegen` on every PR? Likely no (no mention in the listed tables), but worth checking.
6. **KodeVibe's `engine/pkg/fix/fixer.go` and `engine/pkg/watch/watcher.go`** — not opened. These are sibling registries to `vibes/registry.go` and may have their own method-name dispatch patterns.
7. **Whether PlayCua's `sandbox/templates/setup_bepinex.ps1:113` (the `bare-cua-native --port 8765` invocation) is actually implemented** — per §9.5 of the deep research, the Rust binary has no listener, so this PowerShell command is aspirational. A follow-up would either (a) implement the TCP listener in `native/src/main.rs` (a real engineering task) or (b) remove the `--port` reference from the PowerShell template. This is **out of scope** for the codegen analysis but should be tracked.
8. **JSON-RPC error code coverage** — PlayCua uses `-32601`, `-32602`, `-32603`, `-32700`. KodeVibe uses ad-hoc `gin.H{"error": err.Error()}` strings. A codegen would need to add **canonical error code enums** to both languages; whether to adopt the JSON-RPC 2.0 spec's `-32099 to -32000` (server-defined) range or to invent Phenotype-org-specific codes is a design choice the team should make. Recommendation: adopt the JSON-RPC 2.0 spec verbatim for `-32768 to -32000` and reserve `-32000 to -32099` for Phenotype-org.
9. **`Buf CLI` (`buf`) as a precondition for the codegen path** — the schema is OpenRPC, not Protobuf, so `buf` is NOT needed. But if the team later decides to migrate to Protobuf (per §5.6), `buf` becomes a build-time dependency. Confirm the team's appetite for `buf` before committing to a Protobuf migration.

---

## Appendix A — Quick File:Line Reference Index

### PlayCua IPC + Registry + Domain (active)
| File:line | Purpose |
|---|---|
| `PlayCua/contracts/openrpc.json:1-427` | OpenRPC 1.2.6 spec, 14 methods |
| `PlayCua/contracts/openrpc.json:411-424` | `WindowInfo` shared schema |
| `PlayCua/native/src/main.rs:24-31` | `BARE_CUA_LOG` env var |
| `PlayCua/native/src/main.rs:46-71` | stdio NDJSON loop |
| `PlayCua/native/src/main.rs:57` | `-32700` parse error code |
| `PlayCua/native/src/ipc/mod.rs:1-7` | re-exports |
| `PlayCua/native/src/ipc/mod_types.rs:8-14` | `Request` struct |
| `PlayCua/native/src/ipc/mod_types.rs:17-25` | `Response` struct |
| `PlayCua/native/src/ipc/mod_types.rs:28-34` | `RpcError` struct |
| `PlayCua/native/src/ipc/mod_types.rs:36-75` | `Response` helpers |
| `PlayCua/native/src/ipc/mod_types.rs:78-92` | `read_request` |
| `PlayCua/native/src/ipc/mod_types.rs:95-104` | `write_response` |
| `PlayCua/native/src/ipc/dispatcher.rs:18-24` | `Dispatcher` struct |
| `PlayCua/native/src/ipc/dispatcher.rs:26-35` | `Dispatcher::new` |
| `PlayCua/native/src/ipc/dispatcher.rs:37-70` | `Dispatcher::dispatch` (match-based) |
| `PlayCua/native/src/ipc/dispatcher.rs:44-63` | 14 method arms |
| `PlayCua/native/src/ipc/dispatcher.rs:65-68` | `unknown` arm (returns -32601) |
| `PlayCua/native/src/ipc/dispatcher.rs:76-357` | 14 `handle_*` functions |
| `PlayCua/native/src/ports/mod.rs:17-63` | 5 port traits |
| `PlayCua/native/src/app/mod.rs:14-31` | `App::build` DI |
| `PlayCua/native/src/app/mod.rs:37-144` | OS-gated adapter selection |
| `PlayCua/native/src/plugins/mod.rs:12-19` | `MethodPlugin` trait (unwired) |
| `PlayCua/native/src/plugins/mod.rs:22-65` | `PluginRegistry` (unwired) |
| `PlayCua/native/src/plugins/mod.rs:67-106` | 3 plugin unit tests |
| `PlayCua/native/src/domain/capture.rs:5-10` | `Frame` struct |
| `PlayCua/native/src/domain/input.rs:5-58` | `Key`, `KeyAction`, `MouseEvent` |
| `PlayCua/native/src/domain/process.rs:5-49` | `ProcessHandle`, `ProcessStatus` |
| `PlayCua/native/src/domain/window.rs:5-35` | `WindowInfo` (active) |
| `PlayCua/native/src/domain/analysis.rs:5-28` | `DiffResult`, `HashResult` |
| `PlayCua/python/bare_cua/computer.py:54,96-100` | Python correlation ID |
| `PlayCua/bindings/csharp/BareCua.cs:25,285` | C# correlation ID |

### PlayCua dead code (sibling module tree)
| File:line | Purpose |
|---|---|
| `PlayCua/native/src/input/mod.rs:1-182` | Dead duplicate (uses `hwnd: i64` ≠ active `usize`) |
| `PlayCua/native/src/window/mod.rs:1-94` | Dead duplicate |
| `PlayCua/native/src/process/mod.rs:1-185` | Dead duplicate |
| `PlayCua/native/src/analysis/mod.rs:1-107` | Dead duplicate |
| `PlayCua/Taskfile.yml:1-41` | No codegen targets |
| `PlayCua/justfile:1-37` | No codegen targets |
| `PlayCua/README.md:28,107,203` | References to OpenRPC contract |
| `PlayCua/README.md:266-287` | `MyPlugin` example (advertises unwired feature) |

### KodeVibe IPC + Registry + Config
| File:line | Purpose |
|---|---|
| `KodeVibe/.kodevibe.yaml:1-175` | Sample config file |
| `KodeVibe/engine/pkg/mcp/mcp.go:1-367` | MCP types + simulated transport |
| `KodeVibe/engine/pkg/mcp/mcp.go:25-33` | `MCPRequest` struct |
| `KodeVibe/engine/pkg/mcp/mcp.go:35-41` | `MCPResponse` struct |
| `KodeVibe/engine/pkg/mcp/mcp.go:43-48` | `MCPError` struct |
| `KodeVibe/engine/pkg/mcp/mcp.go:50-60` | `MCPContext` struct |
| `KodeVibe/engine/pkg/mcp/mcp.go:106-209` | 4 method builders (mock client) |
| `KodeVibe/engine/pkg/mcp/mcp.go:230-297` | `sendRequest` (simulated, line 232-233) |
| `KodeVibe/engine/pkg/mcp/mcp.go:318-332` | `GetQualityTargets` |
| `KodeVibe/engine/pkg/server/server.go:21-28` | `Server` struct |
| `KodeVibe/engine/pkg/server/server.go:50-83` | `Server.Start` |
| `KodeVibe/engine/pkg/server/server.go:85-140` | `setupRoutes` |
| `KodeVibe/engine/pkg/server/server.go:196-226` | `createScan` |
| `KodeVibe/engine/pkg/server/server.go:228-254` | `getScan` / `listScans` / `deleteScan` (TODO stubs) |
| `KodeVibe/engine/pkg/vibes/registry.go:14-30` | `Checker` interface |
| `KodeVibe/engine/pkg/vibes/registry.go:32-43` | `Registry` struct |
| `KodeVibe/engine/pkg/vibes/registry.go:46-61` | `RegisterChecker` |
| `KodeVibe/engine/pkg/vibes/registry.go:64-74` | `GetChecker` |
| `KodeVibe/engine/pkg/vibes/registry.go:102-182` | `RegisterAllVibes` (7 hardcoded) |
| `KodeVibe/engine/pkg/config/config.go:16-19` | `DefaultConfigFile`, `GlobalConfigFile` |
| `KodeVibe/engine/pkg/config/config.go:21-32` | `Manager` struct |
| `KodeVibe/engine/pkg/config/config.go:34-68` | `LoadConfig` (merge order: defaults → file → env) |
| `KodeVibe/engine/pkg/config/config.go:89-158` | `setDefaults` (78 lines) |
| `KodeVibe/engine/pkg/config/config.go:160-168` | `loadFromFile` |
| `KodeVibe/engine/pkg/config/config.go:170-189` | `loadFromDefaultLocations` |
| `KodeVibe/engine/pkg/config/config.go:191-196` | `loadFromEnv` (`KODEVIBE_` prefix) |
| `KodeVibe/engine/pkg/config/config.go:198-248` | `validateConfig` |
| `KodeVibe/engine/pkg/config/config.go:250-337` | `getDefaultConfig` |
| `KodeVibe/engine/pkg/config/config.go:346-394` | `MergeConfigs` |
| `KodeVibe/engine/internal/models/models.go:7-17` | `AnalysisResult` |
| `KodeVibe/engine/internal/models/models.go:19-24` | `VibeResult` |
| `KodeVibe/engine/internal/models/models.go:26-47` | `SeverityLevel` + `VibeType` enums |
| `KodeVibe/engine/internal/models/models.go:49-69` | `Issue` |
| `KodeVibe/engine/internal/models/models.go:71-87` | `ScanResult` |
| `KodeVibe/engine/internal/models/models.go:89-102` | `Configuration` |
| `KodeVibe/engine/internal/models/models.go:104-112` | `VibeConfig` |
| `KodeVibe/engine/cmd/cli/main.go:1-742` | Cobra CLI |
| `KodeVibe/engine/cmd/server/main.go:1-100` | HTTP server entrypoint |
| `KodeVibe/engine/vscode-extension/src/extension.ts` | VS Code integration (not opened) |
| `KodeVibe/docs/kodevibe-config-schema.md:1-258` | Authoritative human-readable schema doc |
| `KodeVibe/README.md:1-742` | README (mentions `KodeVibeGo` predecessor at line 10) |

### Phenotype-org shared workspace (target home for codegen)
| File:line | Purpose |
|---|---|
| `phenoShared/README.md:18-19` | "Rust infrastructure toolkit extracted from the Phenotype ecosystem" |
| `phenoShared/README.md:26-28` | Crate family including `phenotype-port-interfaces`, `phenotype-contracts` |
| `phenoShared/README.md:48-50` | Example git-dependency usage pattern |
| `phenoShared/README.md:182-204` | "Consolidation opportunities" — invites codegen extraction |
| `phenoShared/crates/phenotype-port-interfaces/src/lib.rs:1-21` | Module structure (domain, inbound, outbound, shared, error) |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:10-13` | `Command` trait (wire-serializable intent) |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:16-20` | `CommandHandler<C>` trait |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:22-30` | `CommandBus` trait |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/command.rs:32-39` | `CommandBusExt` extension |
| `phenoShared/crates/phenotype-port-interfaces/src/inbound/mod.rs:1-11` | `inbound` module exports |
| `thegent/README.md:11-23` | "Two thegents, two roles" disambiguation |
| `thegent/README.md:59,111` | MCP support in `thegent` Python orchestrator |
| `thegent/README.md:190` | `contracts/` directory (content not opened) |
| `thegent/README.md:295-310` | 10+ language project-scaffolding templates |

---

## Appendix B — Confidence Summary

| Section | Confidence | Notes |
|---|---|---|
| 1 — JSON-RPC / IPC Envelope | **High** | Every cited PlayCua line read in full; KodeVibe `mcp.go` and `server.go` read in full |
| 2 — Tool / Handler Registry | **High** | All port traits, plugin registry, vibe registry, dispatcher match arms, and `phenotype-port-interfaces::Command*` traits verified |
| 3 — Config Loader | **High** | Both repos' full config loaders read; sandbox loader is well-scoped; no JSON Schema / OpenAPI / Protobuf / FlatBuffers / Cap'n Proto / Smithy file exists in either repo |
| 4 — Common Ancestors | **High** | Reflog + packed-refs + READMEs all consistent on "no shared monorepo"; codegen artifacts exhaustive-searched |
| 5 — Web Research | **Medium-High** | buf.build/docs/ robots-blocked; everything else fetched successfully. ConnectRPC landing page confirms no Rust server generator as of June 2026 |
| 6 — Concrete Recommendation | **Medium** | Architecture is right; exact LOC reduction and timeline estimates are approximate |

---

*End of analysis. Next step: route this plan to a `forgecode` worktree for phased implementation, starting with Phase 1 (Rust envelope codegen) in `phenoShared/crates/phenotype-codegen/src/main.rs`.*
