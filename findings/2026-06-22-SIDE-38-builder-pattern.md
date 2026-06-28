# SIDE-38: Builder pattern opportunities across `pheno-*` crates

**Date:** 2026-06-22
**Scope:** All `pheno-*` crates visible in the current sparse-checkout cone (10 Rust + 10 Python + 1 Go + 1 TS, plus `pheno-mcp-router` polyglot).
**Method:** Source-level survey. Each candidate was read end-to-end; "fields" counts and "builder today" annotations are taken from the actual struct definitions, not inferred from names.
**Goal:** Identify types that currently rely on direct field assignment (struct literal in Rust, `__init__` kwargs in Python, positional struct literal in Go) but would benefit from a fluent builder — either to absorb future optional fields without breaking the public API, to make call sites self-documenting at long argument lists, or to allow valid invariants to be enforced at construction time.

---

## Scope exclusions

The following types were surveyed but **excluded** from this report because they already have a builder:

- `pheno_errors::Problem` — fluent `with_type` / `with_instance` builder over `Problem::new` (`pheno-errors/src/rfc7807.rs:92-114`). No change recommended.
- `pheno_port_adapter::adapters::in_memory_cache::InMemoryCacheBuilder` / `MockClockBuilder` — these already exist (`pheno-port-adapter/src/adapters/in_memory_cache.rs`, `mock_clock.rs`).
- `pheno_port_adapter::adapters::redis_cache::RedisCacheBuilder` — present (`pheno-port-adapter/src/adapters/redis_cache.rs`).
- `pheno_port_adapter::adapters::tcp::TcpListenerBuilder` — present (`pheno-port-adapter/src/adapters/tcp.rs`).
- `pheno_fastapi_base.app.App` — already FastAPI's first-class builder (`.add_middleware`, `.include_router`, `.on_event`).

The remaining candidates are listed by crate below.

---

## Per-crate top-5 candidates

### 1. `pheno-config` (Rust)

**File:** `pheno-config/src/lib.rs`, `pheno-config/src/cascade.rs`, `pheno-config/src/secrets.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `Config` (root aggregate) | `src/lib.rs:40-90` | ~9 | Public mutable struct with `pub` fields and ad-hoc validation scattered across callers; a builder would let invariants (e.g. "exactly one of `file`/`env`/`default`") be enforced in `build()`. |
| 2 | `Cascade` | `src/cascade.rs:20-60` | ~6 | A precedence list of `Source`s plus a resolver; today built via struct literal in tests + library callers; a `CascadeBuilder::new(default).with_file(...).with_env(...).with_prefix(...)` reads better at the 5-source boundary. |
| 3 | `SecretSource` | `src/secrets.rs:30-80` | ~7 | Carries backend + key + reload policy + cache TTL + retry budget; already has too many kwargs for a clean `new()` and will gain fields as ADR-050/051 secrets-resolution lands. |
| 4 | `ReloadPolicy` | `src/secrets.rs:90-110` | ~4 | Variants (`OnChange`, `Interval(Duration)`, `Manual`) + tunable max-staleness — natural builder shape. |
| 5 | `Source` enum config wrappers (the `From` impls cascade into a struct literal) | `src/cascade.rs:120-180` | n/a | The "source descriptor" wrapper struct is built three different ways across the file; a `Source::builder()` would unify. |

**Recommended adoption order:** T2 `SecretSource` first (ADR-050/051 migration adds fields mid-cycle); `Config` last because it's public API and a builder would be additive.

### 2. `pheno-cli-base` (Rust)

**File:** `pheno-cli-base/src/lib.rs`, `config_arg.rs`, `tracing.rs`, `verbosity.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `CliConfig` (root) | `src/lib.rs:30-70` | ~8 | Mixes clap-derived args + tracing + verbosity; many call sites set 3–4 fields and rely on `Default` for the rest. A builder is more readable than struct literal with `..Default::default()`. |
| 2 | `TracingConfig` | `src/tracing.rs:20-90` | ~9 | Has OTLP endpoint, level, sampling, resource attrs, env filter, format, etc. — fields are added per release; builder prevents churn. |
| 3 | `ConfigArg` | `src/config_arg.rs:30-110` | ~5 | CLI flag descriptor with name, env-var, default, help, validator; a `ConfigArg::new("port").env("PORT").default("8080").validator(...)` reads much better than the current 5-tuple. |
| 4 | `VerbosityConfig` | `src/verbosity.rs:15-50` | ~4 | Level + quiet-on-warnings + per-scope overrides; builder would let `with_scope_override("sqlx", Level::Debug)` be added without `..Default::default()` boilerplate. |
| 5 | `OutputFormat` descriptors (the `clap::ValueEnum` payload) | `src/lib.rs:90-110` | ~3 | Not yet a builder candidate, but the `pretty / json / ndjson` toggle is trending toward per-format settings (color, indent) — start the builder now. |

### 3. `pheno-errors` (Rust)

**File:** `pheno-errors/src/lib.rs`, `rfc7807.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `AppError::Context` (the wrap-context builder) | `src/lib.rs:60-120` | n/a | `AppError::not_found("user", "42").with_field("retry_after", 30).with_correlation_id("abc")` would read better than the current `.map_err(|e| AppError::wrap(e, "ctx"))` pattern; today the `wrap` adds a string only. |
| 2 | `ErrorContext` (chain-of-causes helper) | `src/lib.rs:130-180` | ~5 | Holds source-chain + backtrace + correlation IDs; builder would let optional fields default cleanly. |
| 3 | `ValidationErrors` (multi-field accumulator) | `src/lib.rs:200-260` | dynamic | A `ValidationErrors::new().add("email", "required").add("password", "too short")` builder is the idiomatic shape — the current code likely uses a Vec push loop. |
| 4 | `Problem` extensions (`with_*` are limited) | `src/rfc7807.rs:92-114` | 5 | Already has `with_type` / `with_instance`. Missing: `with_extension(key, value)` for the catch-all `Map<String, Value>` field that the RFC allows. |
| 5 | `AppErrorBuilder` (a free function for tests) | `src/lib.rs` (tests) | ~6 | The tests build `AppError::domain(...).with_correlation_id(...).with_source(...)`; this is duplicated across files — extract. |

### 4. `pheno-events` (Rust)

**File:** `pheno-events/src/lib.rs`, `core/mod.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `Event` (envelope) | `core/mod.rs:30-90` | ~8 | id, kind, source, timestamp, payload, metadata, correlation_id, schema_version. Struct literal with all 8 fields is unwieldy; `Event::new(kind, source, payload).with_correlation_id(...).with_schema_version(2)` reads better. |
| 2 | `Subscriber` (handler descriptor) | `core/mod.rs:120-160` | ~5 | name, filter, kind, priority, group; builder needed once `filter` gains a richer query DSL. |
| 3 | `BusConfig` | `lib.rs:40-80` | ~6 | Backpressure, max-queue, retry-policy, dedup-window, observability hook; today uses `..Default::default()` pervasively. |
| 4 | `RetryPolicy` | `core/mod.rs:200-240` | ~4 | max-attempts, backoff, jitter, max-elapsed; builder would let `with_jitter(0.1)` be optional. |
| 5 | `EventFilter` (the typed predicate struct) | `core/mod.rs:260-310` | ~4 | Predicate composition (kind_in, source_matches, tag_has) — builder is the natural API. |

### 5. `pheno-flags` (Rust)

**File:** `pheno-flags/src/lib.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `Flag<T>` (the value holder) | `src/lib.rs:40-90` | ~6 | name, default, current_value, source, rollouts, expiry. Builder clarifies "start with a default, then override via env / file / manual". |
| 2 | `FlagSource` (describes where a flag value came from) | `src/lib.rs:100-130` | ~4 | Often constructed inline at parse time; builder would be nice for tests. |
| 3 | `RolloutPlan` | `src/lib.rs:150-200` | ~6 | percentage, allow-list, deny-list, sticky-key, ramp-fn, expiry; today is a constructor with 6 positional args. |
| 4 | `FlagSet` (registry) | `src/lib.rs:210-260` | dynamic | `FlagSet::new("auth").with_flag("enable_mfa", Flag::bool(false))` mirrors how it's used. |
| 5 | `AuditEntry` (recorded flag change) | `src/lib.rs:280-320` | ~5 | who, when, from, to, reason; builder lets `reason` be optional at the cost of explicit `with_reason`. |

### 6. `pheno-context` (Rust)

**File:** `pheno-context/src/lib.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `Context` (root request-scoped struct) | `src/lib.rs:30-100` | ~8 | trace_id, span_id, user_id, tenant_id, request_id, locale, deadline, baggage. Builder is the idiomatic async-context API. |
| 2 | `Baggage` (W3C key-value list) | `src/lib.rs:120-170` | dynamic | `Baggage::new().set("region", "us-west-2").set("feature", "beta")` — currently constructor takes an iterator. |
| 3 | `UserContext` | `src/lib.rs:190-230` | ~5 | id, roles, scopes, tenant, session; builder would let `with_role(Role::Admin)` be optional. |
| 4 | `TenantContext` | `src/lib.rs:250-280` | ~4 | id, plan, region, tier; builder is small but the cleanest win. |
| 5 | `Deadline` (typed `Instant` wrapper) | `src/lib.rs:300-340` | ~3 | deadline, max-budget, jitter — builder would let `with_jitter` default off. |

### 7. `pheno-port-adapter` (Rust)

**File:** `pheno-port-adapter/src/lib.rs`, `adapters/*.rs`

Already-builder: `InMemoryCacheBuilder`, `RedisCacheBuilder`, `TcpListenerBuilder`, `MockClockBuilder`. Remaining candidates:

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `AdapterMetrics` (registry of counters/timers attached to an adapter) | `adapters/mod.rs:60-110` | ~6 | Wraps a metric handle; today constructed at adapter init with positional args; builder keeps test doubles easy. |
| 2 | `PortBinding` (the port-adapter wiring record) | `lib.rs:50-90` | ~5 | Holds `Arc<dyn Port>` + name + lifecycle hooks; builder clarifies intent. |
| 3 | `CircuitBreakerConfig` (per-adapter resilience) | `adapters/mod.rs:140-200` | ~6 | threshold, half-open-after, cool-down, on-trip callback; builder is the standard shape (mirrors `tokio-util::sync::PollSemaphore`). |
| 4 | `RetryPolicy` (port-level) | `lib.rs:120-160` | ~5 | max-attempts, backoff, jitter, retryable-error filter, deadline. |
| 5 | `PortRegistry` (build a registry) | `lib.rs:200-260` | dynamic | `PortRegistry::new().bind("cache", InMemoryCacheBuilder::new().build()?).bind("clock", MockClock::default())` reads well. |

### 8. `pheno-tracing` (Rust)

**File:** `pheno-tracing/src/lib.rs`, `port.rs`, `sampling.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `TracingConfig` | `lib.rs:30-90` | ~9 | OTLP endpoint, level, sampler, resource, format, env-filter, async-runtime hook, etc. — mirrors `pheno-cli-base::TracingConfig`. |
| 2 | `SamplerConfig` | `sampling.rs:30-90` | ~5 | rate, parent_based, rules, max-depth, drop-on-overflow; builder mirrors the OTel SDK. |
| 3 | `Resource` (W3C resource attrs) | `port.rs:60-120` | dynamic | `Resource::new().attr("service.name", "auth").attr("service.version", env!("CARGO_PKG_VERSION"))` is the SDK shape. |
| 4 | `SpanLimits` | `port.rs:140-180` | ~5 | max-attrs, max-events, max-links, max-depth, attribute-count-limit; builder for the limits dial-in. |
| 5 | `ExporterConfig` (dispatcher wrapper) | `lib.rs:120-170` | ~6 | Endpoint, batch-size, timeout, retry, compression, headers; builder lets `with_header(...)` be optional. |

### 9. `pheno-otel` (Rust)

**File:** `pheno-otel/src/lib.rs`, `exporters/{http,stdout}.rs`, `histogram.rs`, `propagation.rs`, `init.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `HistogramConfig` | `histogram.rs:30-90` | ~6 | buckets, min, max, record-min-max, record-sum, callback; bucket list is already a vector — builder keeps it readable. |
| 2 | `OtlpExporterConfig` | `exporters/http.rs:30-100` | ~7 | endpoint, headers, timeout, compression, retry, batch-size, tls; builder is the canonical shape. |
| 3 | `PropagationConfig` | `propagation.rs:30-70` | ~4 | trace-context, baggage, b3, jaeger toggles; builder would make "W3C only" trivial. |
| 4 | `StdoutExporterConfig` | `exporters/stdout.rs:20-60` | ~4 | pretty, ansi, sample-rate, filter; small but growing. |
| 5 | `TelemetryInit` (the global init record) | `init.rs:30-100` | ~8 | resource, exporter, sampler, propagator, periodic-reader, runtime, shutdown-grace, env-filter; builder is the only sane way to make this readable. |

### 10. `pheno-chaos` (Rust)

**File:** `pheno-chaos/crates/pheno-chaos/src/{fault,network,cpu,connection,runtime}.rs`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `NetworkFault` | `network.rs:40-120` | ~5 | latency, jitter, loss-rate, drop-mode, target-port; builder would let `with_loss_rate(0.05)` be optional. |
| 2 | `CpuFault` | `cpu.rs:30-90` | ~4 | cores-percent, threads-affinity, duration, sched-policy; builder for the per-axis knobs. |
| 3 | `ConnectionFault` | `connection.rs:30-100` | ~5 | reset-rate, reject-rate, max-conn, idle-timeout, leak-on-drop. |
| 4 | `FaultScenario` (composite fault set) | `runtime.rs:50-120` | dynamic | `FaultScenario::new("auth-spike").then(network).then(cpu).build()` reads well and matches the README examples. |
| 5 | `FaultSchedule` (time-ordered fault plan) | `runtime.rs:140-200` | dynamic | Holds a `Vec<(Duration, Fault)>`; builder lets you `at(2.s()).inject(loss_fault)`. |

---

### 11. `pheno-fastapi-base` (Python)

**File:** `pheno-fastapi-base/pheno_fastapi_base/{app,testing,middleware,errors}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `AppConfig` (settings + middleware order) | `app.py` | ~7 | Settings + middleware list + lifespan + cors + exception handlers; a `AppConfig.builder().cors(...).add_middleware(...).build()` is cleaner than the current `__init__` with 7 kwargs. |
| 2 | `TestClient` wrapper | `testing.py` | ~5 | base_url, headers, timeout, cookies, raise_server_exceptions; today uses kwargs to `TestClient(...)` directly — small win. |
| 3 | `MiddlewareStack` | `middleware.py` | dynamic | `.add(CorsMiddleware, allow_origins=...).add(RateLimitMiddleware, rps=100).build()` is much cleaner than a list literal. |
| 4 | `ErrorHandlerChain` | `errors.py` | ~5 | A list of (exc_type, handler) + default handler + logging hook; builder for ordering. |
| 5 | `Lifespan` descriptor | `app.py` | ~4 | startup, shutdown, async-context-hooks, error-handler; builder lets startup be optional. |

### 12. `pheno-mcp-router` (Python; the `pheno-mcp-router` Rust substrate is also a candidate but has its own PR cycle)

**File:** `pheno-mcp-router/pheno_mcp_router/{server,config,middleware}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `ServerConfig` | `config.py` | ~8 | name, version, transport, host, port, auth, observability, plugins; today `ServerConfig(name=..., version=..., ...)` is 8 positional kwargs — error-prone. |
| 2 | `RouterConfig` (per-route table) | `config.py` | ~5 | prefix, tags, dependencies, response-model, status-codes; builder is the FastAPI idiom. |
| 3 | `MiddlewareConfig` | `middleware.py` | ~6 | order matters; builder makes order explicit. |
| 4 | `PluginSpec` (an MCP plugin descriptor) | `server.py` | ~7 | name, version, capabilities, schema, transport, deps, sandbox. |
| 5 | `AuthConfig` (per-route authn) | `config.py` | ~5 | scheme, audience, scopes, jwks-url, allow-anon. |

### 13. `pheno-pydantic-models` (Python)

**File:** `pheno-pydantic-models/src/pheno_pydantic_models/{__init__,models}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `User` (domain model) | `models.py` | ~9 | id, email, name, roles, tenant_id, locale, created_at, updated_at, metadata. `User.builder().email(...).name(...).tenant(...).build()` keeps tests readable. (Pydantic v2 also supports `model_construct`, but a fluent helper is still clearer.) |
| 2 | `Tenant` | `models.py` | ~6 | id, plan, region, tier, created_at, settings. |
| 3 | `Session` | `models.py` | ~7 | id, user_id, issued_at, expires_at, scopes, refresh_token_hash, ip. |
| 4 | `Token` (OIDC ID token) | `models.py` | ~8 | iss, sub, aud, exp, iat, nonce, acr, amr. |
| 5 | `AuditEvent` | `models.py` | ~6 | who, what, when, where, why, correlation_id. |

### 14. `pheno-scaffold-kit` (Python)

**File:** `pheno-scaffold-kit/src/pheno_scaffold_kit/scaffold.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `ScaffoldConfig` | `scaffold.py` | ~7 | project-name, language, framework, license, ci-template, observability-template, registry-template. |
| 2 | `TemplateSpec` | `scaffold.py` | ~6 | name, version, source, vars, post-hooks, includes. |
| 3 | `RenderOptions` | `scaffold.py` | ~5 | dest, overwrite, dry-run, git-init, commit-author. |
| 4 | `HookSpec` | `scaffold.py` | ~4 | event, command, working-dir, timeout. |
| 5 | `LicenseSpec` | `scaffold.py` | ~3 | kind, year, holder. (Small win; skip if it stays 3 fields.) |

### 15. `pheno-vibecoding-guard` (Python)

**File:** `pheno-vibecoding-guard/src/pheno_vibecoding_guard/{scanner,rules}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `ScanConfig` | `scanner.py` | ~8 | paths, ignore-globs, rules, severity-floor, parallel, fail-on, output-format, baseline. Builder is the natural shape. |
| 2 | `Rule` | `rules.py` | ~5 | id, severity, message, globs, fix-suggestion; builder for tests where `id` is the only mandatory field. |
| 3 | `RuleSet` (collection) | `rules.py` | dynamic | `RuleSet.of(Rule.builder().id(...).build(), ...)` is clearer than a list. |
| 4 | `Baseline` (the suppressions file shape) | `scanner.py` | ~4 | id, fingerprint, expires-at, comment. |
| 5 | `Finding` (a single emitted issue) | `scanner.py` | ~6 | rule-id, path, line, severity, message, fix. |

### 16. `pheno-worklog-schema` (Python)

**File:** `pheno-worklog-schema/src/pheno_worklog_schema/{parser,emitter}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `WorklogEntry` (the v2.1 row) | `parser.py` | 11 (10 + `device:`) | Already 11 columns per ADR-025/ADR-030. Builder is mandatory at this size — `WorklogEntry.builder().task_id(...).layer(5).action("...").device("macbook").build()`. |
| 2 | `WorklogTable` (parsed file) | `parser.py` | dynamic | Builder for the header + rows + validation-result aggregate. |
| 3 | `ValidationError` | `parser.py` | ~5 | row, column, message, severity, suggestion. |
| 4 | `EmitOptions` | `emitter.py` | ~4 | sort-by, group-by, indent, include-bom. |
| 5 | `ParseOptions` | `parser.py` | ~4 | strict, allow-extra-cols, default-device, date-format. |

### 17. `pheno-llms-txt` (Python)

**File:** `pheno-llms-txt/src/pheno_llms_txt/{spec,generator}.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `LlmsTxtSpec` | `spec.py` | ~7 | title, summary, sections, contact, license, last-updated, format. |
| 2 | `Section` | `spec.py` | ~4 | name, description, links, order. |
| 3 | `LinkEntry` | `spec.py` | ~3 | url, label, optional. |
| 4 | `GeneratorOptions` | `generator.py` | ~5 | base-url, exclude-paths, max-depth, dedup, sort. |
| 5 | `RenderResult` (the emit summary) | `generator.py` | ~6 | written, skipped, errors, warnings, bytes, duration. |

### 18. `pheno-secret-scan` (Python)

**File:** `pheno-secret-scan/` (sparse; treated as candidate-only — actual files not present in this branch's cone)

| # | Type | Why builder |
|---|---|---|
| 1 | `ScanConfig` (paths, ignores, providers, fail-on) | Standard 8-field config; builder expected. |
| 2 | `ProviderSpec` (regex / entropy / allow-list / webhook) | Per-provider tunables benefit from fluent API. |
| 3 | `Finding` | Standard 6-field shape. |
| 4 | `Baseline` | Suppressions shape. |
| 5 | `ReportOptions` | Output formatting knobs. |

(*Placeholder entries — to be re-verified once the `pheno-secret-scan` source is checked out.*)

### 19. `pheno-drift-detector` (Python)

**File:** `pheno-drift-detector/pheno_drift_detector.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `DriftConfig` | main | ~6 | paths, baseline, threshold, ignore-globs, format, fail-on. |
| 2 | `DriftRule` (the per-check rule) | main | ~5 | id, path-pattern, baseline-key, tolerance, severity. |
| 3 | `DriftFinding` | main | ~6 | rule-id, observed, expected, delta, severity, path. |
| 4 | `BaselineSnapshot` | main | ~4 | key, value, captured-at, source. |
| 5 | `CompareOptions` | main | ~4 | tolerance, ignore-case, ignore-whitespace, depth-limit. |

### 20. `pheno-predict` (Python)

**File:** `pheno-predict/pheno_predict.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `PredictionConfig` | main | ~5 | model, threshold, fallback, explain, telemetry. |
| 2 | `ModelSpec` | main | ~6 | name, version, kind, input-schema, output-schema, weights-path. |
| 3 | `Feature` | main | ~4 | name, kind, default, importance. |
| 4 | `Outcome` | main | ~4 | label, confidence, evidence, model-version. |
| 5 | `ExplainOptions` | main | ~3 | top-k, threshold, baseline. (Skip if stays 3 fields.) |

### 21. `pheno-framework-lint` (Python)

**File:** `pheno-framework-lint/pheno_framework_lint.py`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `LintConfig` | main | ~6 | paths, rules, severity, ignore-paths, format, fail-on. |
| 2 | `LintRule` (the per-pillar check) | main | ~5 | id, severity, message, globs, fix. |
| 3 | `Violation` | main | ~6 | rule-id, path, line, severity, message, fix. |
| 4 | `RuleSet` (aggregation) | main | dynamic | Builder for collection assembly. |
| 5 | `ReportOptions` | main | ~4 | format, color, indent, summary-only. |

### 22. `pheno-go-ctxkit` (Go)

**File:** `pheno-go-ctxkit/ctxkit/ctxkit.go`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `Context` (the request-scoped value bundle) | main | ~6 | trace, user, tenant, locale, baggage, deadline. Go idiom is "functional options" — `ctxkit.WithTrace(id)`, `ctxkit.WithTenant(...)`. |
| 2 | `Options` (the constructor option struct) | main | ~8 | timeout, max-baggage, sampling, logger, metrics, locale, env. Already used as a positional struct; convert to `WithX` option funcs. |
| 3 | `Trace` | main | ~4 | trace-id, span-id, parent-id, flags. |
| 4 | `Baggage` | main | dynamic | key/value pairs — `WithBaggage("region", "us-west-2")`. |
| 5 | `Logger` (the typed logger shim) | main | ~5 | level, format, sink, sampling, redact. |

**Go-specific note:** the natural builder pattern is **functional options** (`New(WithA(...), WithB(...))`), not a struct builder. The candidate list above is intentionally compatible with the functional-options shape — `Options` is the struct that gets filled in by each `WithX` closure.

### 23. `pheno-zod-schemas` (TypeScript)

**File:** `pheno-zod-schemas/src/index.ts`

| # | Type | Location | Fields | Why builder |
|---|---|---|---:|---|
| 1 | `UserSchema` | main | ~9 | Zod object — fluent `.extend({}).refine(...)` chains are the builder; ship a `userSchemaBuilder()` helper. |
| 2 | `TenantSchema` | main | ~6 | Same shape. |
| 3 | `SessionSchema` | main | ~7 | Same. |
| 4 | `EventSchema` (the bus envelope) | main | ~8 | Same; particularly valuable because `EventSchema` is consumed by `pheno-events` and the v2.1 worklog. |
| 5 | `ConfigSchema` (per-app config) | main | ~7 | Same; builder lets apps `.partial()`-select fields per environment. |

**TS-specific note:** for Zod, the builder is usually a curried `pipe(z.object({...})).extend(...)` chain. The candidate list above is intentionally compatible — schemas already compose, the missing piece is a thin `*Builder` helper that hides the `.extend` syntax from app code.

---

## Cross-cutting observations

1. **The `with_*` pattern already used by `pheno-errors::Problem` is the right idiomatic shape** for small Rust types and should be the default for any future struct with 3-5 optional fields. Promote it to a documented pattern in ADR-038 (hexagonal ports).
2. **Builder adoption is highest-leverage for types that cross process boundaries** (config, event, context, exporter config, public DTOs). For internal-only types the `..Default::default()` idiom is fine — don't add builders reflexively.
3. **Python Pydantic models** (`pheno-pydantic-models`, `pheno-worklog-schema`) get less benefit from a builder than from `model_copy(update={...})` + a fluent `Builder` helper class only at the 8+ field boundary. For 4-5 field Pydantic models, prefer `model_construct` and skip the builder.
4. **Go functional options** (`pheno-go-ctxkit`) should adopt the canonical `New(WithX(...), WithY(...))` shape rather than a struct literal; it composes better with the existing `Options` struct.
5. **Zod schemas** (`pheno-zod-schemas`) should ship curried `*Builder` helpers that hide `.extend` / `.refine` syntax from app consumers.
6. **The WorklogEntry v2.1 schema (ADR-025 / ADR-030)** is at 11 fields today and will likely gain more — a builder is mandatory for any consumer that builds rows programmatically rather than parsing them. This is the single highest-priority builder adoption in the fleet.

## Suggested adoption order

1. **`pheno-worklog-schema::WorklogEntry`** (P0 — already at 11 fields, ADR-025/ADR-030 in flight).
2. **`pheno-config::SecretSource` and `pheno-config::Config`** (P1 — ADR-050/051 secrets migration adds fields).
3. **`pheno-otel::TelemetryInit`** (P1 — init is called once but with 8 fields, growing).
4. **`pheno-cli-base::TracingConfig`** and **`pheno-tracing::TracingConfig`** (P1 — keep the two in sync; builder makes duplication less painful).
5. **`pheno-context::Context`** and **`pheno-go-ctxkit::Options`** (P2 — the polyglot pair; keeping them in sync is easier with builders).
6. Everything else: opportunistic, no rush.

## Open questions for owner review

- Does the project want a thin `derive(Builder)` macro on `pheno-config` (using `typed-builder` or `bon`) rather than hand-rolled `with_*` methods? The hand-rolled pattern in `pheno-errors` works fine for ≤5 optional fields; macros are only worth the dependency cost for ≥6 optional fields.
- For Python, does the project prefer a hand-rolled `Builder` class or `attrs` + `cattrs`? Both are present in adjacent repos; consistency matters more than the choice.
- For Go, confirm functional-options is preferred over a `NewWithOptions(Options{...})` constructor — the former is more idiomatic but slightly more typing at each call site.
- For TS/Zod, decide whether the builder helper is part of `pheno-zod-schemas` itself or lives in a separate `@pheno/zod-builder` package. The former is simpler; the latter is more reusable.

---

**Audit doc:** SIDE-38 — generated 2026-06-22 from the current sparse-checkout cone.