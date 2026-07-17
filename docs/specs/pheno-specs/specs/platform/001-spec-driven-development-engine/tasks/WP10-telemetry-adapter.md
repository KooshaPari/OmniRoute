---
work_package_id: WP10
title: Telemetry Adapter
lane: "done"
dependencies: [WP05]
base_branch: 001-spec-driven-development-engine-WP05
base_commit: 5caddd188f117c68c177b4198250fa4251c931de
created_at: '2026-03-02T01:09:10.228118+00:00'
subtasks:
- T055
- T056
- T057
- T058
- T059
phase: Phase 2 - Adapters
assignee: ''
agent: "s1-wp10"
shell_pid: "98662"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP10 -- Telemetry Adapter

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately (right below this notice).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Mark as acknowledged**: When you understand the feedback and begin addressing it, update `review_status: acknowledged` in the frontmatter.
- **Report progress**: As you address each feedback item, update the Activity Log explaining what you changed.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes. Implementation must address every item listed below before returning for re-review.

*[This section is empty initially. Reviewers will populate it if the work is returned from review. If you see feedback here, treat each item as a must-do before completion.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP10 --base WP05
```

---

## Objectives & Success Criteria

1. **TelemetryAdapter struct** implementing the `ObservabilityPort` trait from `agileplus-core/src/ports/observability.rs` is fully functional in `crates/agileplus-telemetry/src/`.
2. **OpenTelemetry traces** are emitted for every CLI command execution and agent dispatch, with proper parent-child span relationships.
3. **Metrics** are recorded: counters for `agent_runs` and `review_cycles`, histograms for `command_duration_ms`. Metrics are both stored in SQLite (via StoragePort callback) and exported via OTLP.
4. **Structured JSON logging** via the `tracing` crate is configurable to write to stdout or a log file, with span context included in every log line.
5. **OTLP configuration** is loaded from `~/.agileplus/otel-config.yaml` with a well-defined schema. When no collector is running, the adapter degrades gracefully (logs a warning, continues without export).
6. `cargo test -p agileplus-telemetry` passes with all tests green.
7. Performance: telemetry overhead must be under 1ms per span creation and under 5ms per metric recording.

---

## Context & Constraints

### Prerequisite Work
- **WP05 (Port Traits)** must be complete. The `ObservabilityPort` trait in `agileplus-core/src/ports/observability.rs` defines the interface this adapter implements.

### Key References
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- observability requirements
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- telemetry crate in dependency graph, performance goals (<50ms CLI startup)
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- Metric entity (command, duration_ms, agent_runs, review_cycles)

### Architectural Constraints
- This crate implements `ObservabilityPort` from `agileplus-core`. It must not depend on other adapter crates.
- Use the `tracing` ecosystem for structured logging and span management. Use `opentelemetry` + `opentelemetry-otlp` for export.
- The adapter must support a "no-op" mode where all telemetry calls succeed but produce no output (for testing and minimal configurations).
- Must be `Send + Sync` for async tokio contexts.
- Initialization must be lazy or fast -- do not block CLI startup waiting for OTLP collector connection.

### Crate Dependencies
```toml
[dependencies]
agileplus-core = { path = "../agileplus-core" }
tokio = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
tracing-opentelemetry = "0.27"
opentelemetry = { version = "0.27", features = ["trace", "metrics"] }
opentelemetry-otlp = { version = "0.27", features = ["trace", "metrics", "grpc-tonic"] }
opentelemetry_sdk = { version = "0.27", features = ["trace", "metrics", "rt-tokio"] }
serde = { workspace = true, features = ["derive"] }
serde_yaml = "0.9"
chrono = { workspace = true }
thiserror = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["test-util", "macros"] }
tracing-test = "0.2"
tempfile = "3"
```

---

## Subtasks & Detailed Guidance

### Subtask T055 -- Implement `TelemetryAdapter` struct implementing `ObservabilityPort`

- **Purpose**: Create the top-level adapter struct that initializes the OpenTelemetry pipeline and exposes trace, metric, and log functionality behind the `ObservabilityPort` trait.
- **Steps**:
  1. Create `crates/agileplus-telemetry/src/lib.rs` with module declarations: `pub mod traces; pub mod metrics; pub mod logs; mod config;`.
  2. Define `TelemetryAdapter` struct:
     ```rust
     pub struct TelemetryAdapter {
         tracer: opentelemetry::global::BoxedTracer,
         meter: opentelemetry::metrics::Meter,
         config: TelemetryConfig,
         initialized: bool,
     }
     ```
  3. Implement `TelemetryAdapter::new(config: TelemetryConfig) -> Result<Self>`:
     - Initialize the OTLP trace exporter pipeline if `config.otlp_endpoint` is set.
     - Initialize the OTLP metrics exporter if enabled.
     - Set up the `tracing-subscriber` layer stack: JSON formatter + OpenTelemetry layer + env filter.
     - If OTLP endpoint is unreachable, log a warning and continue with a no-op exporter.
  4. Implement `TelemetryAdapter::noop() -> Self` for testing and minimal configs:
     - Returns an adapter where all methods succeed but produce no output.
  5. Implement `ObservabilityPort` for `TelemetryAdapter`:
     - `emit_trace(name, attributes)` -> creates and ends a span
     - `start_span(name, parent)` -> creates a span, returns a handle
     - `end_span(handle)` -> ends the span
     - `record_metric(name, value, labels)` -> records via meter
     - `write_log(level, message, fields)` -> emits via tracing macros
  6. Implement `Drop` for `TelemetryAdapter` to flush pending spans and metrics on shutdown.
- **Files**:
  - `crates/agileplus-telemetry/src/lib.rs` (create/replace)
  - `crates/agileplus-telemetry/Cargo.toml` (update dependencies)
- **Parallel?**: No -- foundation for T056-T058.
- **Notes**:
  - The OpenTelemetry SDK initialization is global. Use `opentelemetry::global::set_tracer_provider()` once. Handle double-init gracefully (return existing provider).
  - The `tracing-subscriber` must be set up exactly once via `tracing::subscriber::set_global_default()`. Guard against double-init in tests with `try_init()`.
  - Lazy initialization: defer OTLP connection until first span is created, not at `new()` time.

### Subtask T056 -- Implement `traces.rs`: OpenTelemetry trace spans

- **Purpose**: Provide span creation and management for tracing CLI command execution, agent dispatch, and review loop iterations with proper parent-child relationships.
- **Steps**:
  1. Create `crates/agileplus-telemetry/src/traces.rs`.
  2. Define span attribute constants:
     ```rust
     pub const ATTR_COMMAND: &str = "agileplus.command";
     pub const ATTR_FEATURE_SLUG: &str = "agileplus.feature.slug";
     pub const ATTR_WP_ID: &str = "agileplus.wp.id";
     pub const ATTR_AGENT_TYPE: &str = "agileplus.agent.type";
     pub const ATTR_REVIEW_CYCLE: &str = "agileplus.review.cycle";
     ```
  3. Implement `create_command_span(command_name: &str, feature_slug: Option<&str>) -> tracing::Span`:
     - Creates a top-level span with `tracing::info_span!`.
     - Sets `ATTR_COMMAND` and optionally `ATTR_FEATURE_SLUG`.
     - This span is the parent of all child spans within a single CLI invocation.
  4. Implement `create_agent_span(parent: &tracing::Span, wp_id: &str, agent_type: &str) -> tracing::Span`:
     - Child span under the command span.
     - Records agent type (claude-code, codex) and WP ID.
  5. Implement `create_review_span(parent: &tracing::Span, cycle: u32) -> tracing::Span`:
     - Child span for each review-fix iteration.
     - Records cycle number for tracking loop depth.
  6. Implement `record_span_event(span: &tracing::Span, name: &str, attributes: &[(String, String)])`:
     - Adds an event (log line) to an existing span.
     - Used for milestone markers: "PR created", "review received", "CI passed".
  7. Implement `SpanGuard` wrapper that auto-records duration on drop:
     ```rust
     pub struct SpanGuard {
         span: tracing::Span,
         start: Instant,
     }
     impl Drop for SpanGuard {
         fn drop(&mut self) {
             let duration = self.start.elapsed();
             self.span.record("duration_ms", duration.as_millis() as u64);
         }
     }
     ```
- **Files**: `crates/agileplus-telemetry/src/traces.rs`
- **Parallel?**: Yes, independent of T057 and T058 after T055.
- **Notes**:
  - Use `tracing` spans (not raw OpenTelemetry spans) so that the `tracing-opentelemetry` bridge handles export automatically.
  - Span names should be concise and follow OpenTelemetry semantic conventions where applicable.
  - Test that spans correctly nest: command -> agent -> review forms a 3-level tree.

### Subtask T057 -- Implement `metrics.rs`: Counters and histograms

- **Purpose**: Record operational metrics (agent run counts, review cycle counts, command durations) that feed both the SQLite Metric table and OTLP export.
- **Steps**:
  1. Create `crates/agileplus-telemetry/src/metrics.rs`.
  2. Define the metric instruments at module level:
     ```rust
     pub struct MetricsRecorder {
         agent_runs: Counter<u64>,
         review_cycles: Counter<u64>,
         command_duration: Histogram<f64>,
     }
     ```
  3. Implement `MetricsRecorder::new(meter: &Meter) -> Self`:
     - `agent_runs` = counter named `agileplus.agent.runs` with description "Number of agent invocations".
     - `review_cycles` = counter named `agileplus.review.cycles` with description "Number of review-fix loop iterations".
     - `command_duration` = histogram named `agileplus.command.duration_ms` with boundaries `[10, 50, 100, 500, 1000, 5000, 30000, 60000]`.
  4. Implement recording methods:
     - `record_agent_run(feature_slug: &str, wp_id: &str, agent_type: &str)`: increments counter with labels.
     - `record_review_cycle(feature_slug: &str, wp_id: &str, cycle: u32)`: increments counter.
     - `record_command_duration(command: &str, feature_slug: Option<&str>, duration: Duration)`: records histogram value.
  5. Implement `MetricSnapshot` struct for SQLite persistence:
     ```rust
     pub struct MetricSnapshot {
         pub command: String,
         pub duration_ms: u64,
         pub agent_runs: u64,
         pub review_cycles: u64,
         pub timestamp: DateTime<Utc>,
     }
     ```
  6. Implement `collect_snapshot(command: &str) -> MetricSnapshot`:
     - Captures current counter values for the given command context.
     - Returns a snapshot that the caller can persist to SQLite via StoragePort.
  7. Add a `reset()` method for test isolation.
- **Files**: `crates/agileplus-telemetry/src/metrics.rs`
- **Parallel?**: Yes, independent of T056 and T058 after T055.
- **Notes**:
  - OTLP metrics export happens on a periodic interval (default 60s). The adapter does not need to flush on every recording.
  - Counter values are monotonically increasing. The snapshot for SQLite should capture the delta since the last snapshot, not the absolute value.
  - Histogram boundaries chosen to cover the expected range: 10ms (fast queries) to 60s (slow agent dispatch).

### Subtask T058 -- Implement `logs.rs`: Structured JSON logging

- **Purpose**: Configure structured JSON logging via the `tracing` crate with span context, configurable output targets, and level filtering.
- **Steps**:
  1. Create `crates/agileplus-telemetry/src/logs.rs`.
  2. Implement `init_logging(config: &LogConfig) -> Result<()>`:
     - Build a `tracing_subscriber::fmt` layer with JSON formatter.
     - Configure output target based on `config.output`:
       - `LogOutput::Stdout` -> write to stdout
       - `LogOutput::File(path)` -> write to file with rotation (daily or size-based)
       - `LogOutput::Both(path)` -> tee to both stdout and file
     - Configure env filter from `config.level` (default: `info`, override with `AGILEPLUS_LOG` env var).
     - Compose with the OpenTelemetry layer from T055 using `tracing_subscriber::registry().with(fmt_layer).with(otel_layer)`.
  3. Define `LogConfig`:
     ```rust
     pub struct LogConfig {
         pub level: String,          // "trace", "debug", "info", "warn", "error"
         pub output: LogOutput,
         pub include_spans: bool,    // include parent span IDs in log lines
         pub include_target: bool,   // include module path
     }
     ```
  4. Define `LogOutput` enum:
     ```rust
     pub enum LogOutput {
         Stdout,
         File(PathBuf),
         Both(PathBuf),
     }
     ```
  5. Implement JSON log format with these fields:
     ```json
     {
       "timestamp": "2026-02-27T10:30:00.123Z",
       "level": "INFO",
       "target": "agileplus_cli::commands::implement",
       "span_id": "abc123",
       "parent_span_id": "def456",
       "message": "Agent dispatch started",
       "fields": {
         "wp_id": "WP09",
         "agent_type": "claude-code"
       }
     }
     ```
  6. Implement log file rotation:
     - Use `tracing-appender` for non-blocking file writes with daily rotation.
     - Keep last 7 log files by default (configurable).
  7. Add a `flush()` function to force pending log writes to disk (called on shutdown).
- **Files**: `crates/agileplus-telemetry/src/logs.rs`
- **Parallel?**: Yes, independent of T056 and T057 after T055.
- **Notes**:
  - The `tracing-subscriber` global subscriber can only be set once per process. The `init_logging` function must be called exactly once, typically from `main.rs`. Use `try_init` pattern to handle double-init in tests.
  - File logging must be non-blocking. `tracing-appender::non_blocking` returns a guard that must be held for the process lifetime. Return this guard from `init_logging` and hold it in `main()`.
  - Environment variable override (`AGILEPLUS_LOG=debug`) takes precedence over config file. Use `EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new(&config.level))`.

### Subtask T059 -- Create `~/.agileplus/otel-config.yaml` schema and loader

- **Purpose**: Define and load the OpenTelemetry configuration file that controls trace/metric export endpoints, logging levels, and sampling rates.
- **Steps**:
  1. Create `crates/agileplus-telemetry/src/config.rs`.
  2. Define `TelemetryConfig` struct (deserializable from YAML):
     ```rust
     #[derive(Deserialize, Default)]
     pub struct TelemetryConfig {
         pub otlp: Option<OtlpConfig>,
         pub logging: LogConfig,
         pub sampling: SamplingConfig,
     }

     #[derive(Deserialize)]
     pub struct OtlpConfig {
         pub endpoint: String,           // e.g., "http://localhost:4317"
         pub protocol: OtlpProtocol,     // grpc or http
         pub headers: HashMap<String, String>,  // auth headers
         pub timeout_ms: u64,            // default: 5000
         pub export_interval_ms: u64,    // default: 60000
     }

     #[derive(Deserialize)]
     pub enum OtlpProtocol {
         Grpc,
         Http,
     }

     #[derive(Deserialize, Default)]
     pub struct SamplingConfig {
         pub trace_ratio: f64,  // 0.0 to 1.0, default 1.0 (sample everything)
     }
     ```
  3. Implement `TelemetryConfig::load() -> Result<Self>`:
     - Look for config at `~/.agileplus/otel-config.yaml`.
     - If file does not exist, return `TelemetryConfig::default()` (no OTLP, info logging to stdout).
     - If file exists but is malformed, return error with clear message.
     - Expand `~` to actual home directory using `dirs::home_dir()`.
  4. Implement `TelemetryConfig::load_from(path: &Path) -> Result<Self>` for testing.
  5. Create a default config template that `agileplus init` could write:
     ```yaml
     # AgilePlus OpenTelemetry Configuration
     otlp:
       endpoint: "http://localhost:4317"
       protocol: grpc
       headers: {}
       timeout_ms: 5000
       export_interval_ms: 60000
     logging:
       level: "info"
       output: "stdout"
       include_spans: true
       include_target: true
     sampling:
       trace_ratio: 1.0
     ```
  6. Implement validation:
     - `trace_ratio` must be between 0.0 and 1.0.
     - `endpoint` must be a valid URL if present.
     - `timeout_ms` must be positive.
  7. Store the default config YAML as a const string in the module for use by init commands.
- **Files**: `crates/agileplus-telemetry/src/config.rs`
- **Parallel?**: No -- this is used by T055 initialization.
- **Notes**:
  - The config file is optional. AgilePlus must work without it, defaulting to console-only logging with no OTLP export.
  - Consider supporting environment variable overrides: `AGILEPLUS_OTLP_ENDPOINT`, `AGILEPLUS_LOG_LEVEL`. These should override YAML values.
  - YAML chosen over TOML for this specific config because OpenTelemetry ecosystem conventions use YAML.

---

## Test Strategy

### Unit Tests
- Location: `crates/agileplus-telemetry/tests/`
- Run: `cargo test -p agileplus-telemetry`
- Use `tracing-test` for capturing and asserting on emitted spans and events.
- Use `tempfile` for testing file-based log output.

### Config Tests
- Valid YAML parses correctly.
- Missing file returns defaults.
- Malformed YAML returns descriptive error.
- Environment variable overrides work.
- Validation catches invalid trace_ratio, missing endpoint, etc.

### Trace Tests
- Command span creates correctly with attributes.
- Child spans nest under parent.
- SpanGuard records duration on drop.
- No-op adapter produces no output.

### Metrics Tests
- Counter increments correctly.
- Histogram records in correct bucket.
- Snapshot captures delta values.
- Reset clears state for test isolation.

### Log Tests
- JSON format contains all expected fields.
- File output writes to correct path.
- Level filtering works (debug messages excluded at info level).
- Non-blocking writer does not block caller.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OTLP collector not running | Adapter blocks or errors on startup | Lazy init, timeout on connection, graceful fallback to no-op export |
| OpenTelemetry SDK version churn | API breaking changes between versions | Pin exact versions in Cargo.toml, test upgrade path quarterly |
| Global subscriber double-init in tests | Tests panic or produce no output | Use `try_init()` pattern, `tracing-test` crate for test isolation |
| Log file permissions on Linux | File creation fails in restricted dirs | Check write permission at init, fallback to stdout with warning |
| Telemetry overhead exceeds budget | CLI startup >50ms | Lazy initialization, async export, benchmark in CI |
| Metric counter overflow | Counters wrap on very long runs | Use u64 (18 quintillion), practically impossible to overflow |

---

## Review Guidance

1. **Port compliance**: Verify `TelemetryAdapter` implements every method of `ObservabilityPort` with correct signatures.
2. **Graceful degradation**: Confirm that missing OTLP collector does not crash or block the application.
3. **Performance**: Check that span creation and metric recording do not involve synchronous I/O.
4. **Global state safety**: Verify subscriber and tracer provider initialization handles double-init without panicking.
5. **Config validation**: Confirm malformed configs produce helpful error messages, not cryptic serde errors.
6. **Log format**: Verify JSON log lines are parseable by standard log aggregation tools (jq, Loki, etc.).
7. **No-op mode**: Verify the noop adapter is truly zero-cost (no allocations, no I/O).

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this file (Activity Log section below "Valid lanes")
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ -- agent_id -- lane=<lane> -- <action>`
4. Timestamp MUST be current time in UTC (check with `date -u "+%Y-%m-%dT%H:%M:%SZ"`)
5. Lane MUST match the frontmatter `lane:` field exactly
6. Agent ID should identify who made the change (claude-sonnet-4-5, codex, etc.)

**Format**:
```
- YYYY-MM-DDTHH:MM:SSZ -- <agent_id> -- lane=<lane> -- <brief action description>
```

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

### Updating Lane Status

To change a work package's lane, either:

1. **Edit directly**: Change the `lane:` field in frontmatter AND append activity log entry (at the end)
2. **Use CLI**: `spec-kitty agent tasks move-task WP10 --to <lane> --note "message"` (recommended)

**Initial entry**:
- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-03-02T01:09:10Z – s1-wp10 – shell_pid=98662 – lane=doing – Assigned agent via workflow command
- 2026-03-02T01:15:43Z – s1-wp10 – shell_pid=98662 – lane=for_review – Ready: telemetry adapter
- 2026-03-02T01:16:10Z – s1-wp10 – shell_pid=98662 – lane=done – Telemetry adapter complete
