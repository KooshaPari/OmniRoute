# phenotype-forge — Product Requirements Document

## Product Vision

`phenotype-forge` is a Rust-native CLI task runner and build orchestrator that executes named tasks in parallel with automatic topological dependency resolution, file-watching hot reload, and a plugin extension system. It replaces fragile shell scripts and Makefiles with a typed, composable task graph defined in Rust macros.

---

## Epics

### E1: Task Definition and Registration

**Goal**: Allow users to define named tasks as Rust functions with macro annotations, forming the fundamental building block of the orchestration system.

**User Stories**:
- E1.1: As a developer, I want to annotate a Rust function with `#[task]` so that forge can discover and invoke it by name.
  - AC: `#[task]` compiles without error on any `fn` with no arguments or context-injectable arguments.
  - AC: Task name defaults to function name; overrideable via `#[task(name = "custom")]`.
  - Source: `src/lib.rs`
- E1.2: As a developer, I want to declare task dependencies with `#[deps(build)]` so that prerequisite tasks run automatically before my task.
  - AC: `#[deps(...)]` accepts a comma-separated list of task function names.
  - AC: Missing dependency names produce a compile-time error.
- E1.3: As a developer, I want to list all available tasks with `forge list` so I can discover what is runnable without reading source code.
  - AC: Output includes task name and one-line description (from doc comment if present).

---

### E2: Dependency Graph Resolution and Topological Execution

**Goal**: Build and execute a DAG of tasks in the correct order, detecting cycles at startup.

**User Stories**:
- E2.1: As a developer, I want forge to automatically run all transitive dependencies before my target task so I never manually chain commands.
  - AC: `forge test` with `test` depending on `build` always runs `build` first.
  - AC: Topological sort completes in O(V+E) over the task graph.
  - Source: `src/lib.rs` — `core` module
- E2.2: As a developer, I want forge to detect circular task dependencies at startup and exit with a clear error so invalid configs fail loudly.
  - AC: Cycle detection runs before any task executes.
  - AC: Error message lists the cycle path (e.g., `a -> b -> a`).
- E2.3: As a developer, I want independent tasks in a dependency tier to run in parallel so build times are minimized.
  - AC: Tasks at the same dependency depth with no inter-dependency execute concurrently via `tokio::spawn`.
  - Source: `Cargo.toml` — `tokio = { version = "1.0", features = ["full"] }`

---

### E3: CLI Interface and Invocation

**Goal**: Provide a clean, ergonomic command-line interface for running, listing, and watching tasks.

**User Stories**:
- E3.1: As a developer, I want to run a task by name (`forge <task>`) so that invocation is intuitive.
  - AC: `forge build` runs the `build` task.
  - AC: Unknown task names exit 1 with "Unknown task: <name>" message.
  - Source: `src/main.rs` — `Args.task` field (clap Parser)
- E3.2: As a developer, I want `forge --watch` to automatically re-run the specified task when source files change so I get continuous feedback during development.
  - AC: File system events are captured via the `notify` crate (v6.0).
  - AC: Debounce window prevents re-runs triggered by write bursts.
  - Source: `src/main.rs:11` — `Args.watch` flag; `Cargo.toml` — `notify = "6.0"`
- E3.3: As a developer, I want the CLI to accept `--help` and `--version` flags so I can discover usage without reading documentation.
  - AC: `forge --help` prints usage derived from clap `#[command]` annotations.
  - AC: `forge --version` prints the semver from `Cargo.toml`.

---

### E4: Configuration and Serialization

**Goal**: Allow tasks and forge settings to be configured via TOML config files in addition to Rust macros.

**User Stories**:
- E4.1: As a project maintainer, I want to define task metadata (name, description, environment variables) in a `forge.toml` file so non-Rust contributors can understand the build system.
  - AC: `forge.toml` is loaded from the current working directory.
  - AC: TOML parsing uses the `toml = "0.8"` crate with strongly-typed structs.
  - Source: `Cargo.toml` — `toml = "0.8"`
- E4.2: As a developer, I want TOML config errors to fail loudly with the source location so misconfigured projects are caught immediately.
  - AC: TOML parse errors include filename and line number.
  - AC: Uses `thiserror = "1.0"` for typed error variants — no `unwrap` at config load.
  - Source: `Cargo.toml` — `thiserror = "1.0"`

---

### E5: Observability and Integration

**Goal**: Instrument task execution with tracing, logging, and metrics for developer observability and integration with the broader Phenotype ecosystem.

**User Stories**:
- E5.1: As a platform engineer, I want task execution spans to be emitted via OpenTelemetry so long build pipelines are traceable.
  - AC: Each task invocation creates a child span with task name and status attributes.
  - AC: Tracing is provided via `helix-tracing` (phenotype-tracing) path dependency.
  - Source: `Cargo.toml` — `helix-tracing = { package = "helix-tracing", path = "../phenotype-tracing" }`
- E5.2: As a developer, I want structured log output for each task (start, complete, error) so failures are diagnosable without a debugger.
  - AC: Log output uses `helix-logging` (phenotype-logger) path dependency.
  - AC: Log level is configurable via `RUST_LOG` environment variable.
  - Source: `Cargo.toml` — `helix-logging = { package = "helix-logging", path = "../phenotype-logger" }`
- E5.3: As a platform engineer, I want task execution metrics (count, duration, error rate) emitted to the Phenotype metrics collector so build health is visible in dashboards.
  - AC: Metrics are recorded via `phenotype-metrics` path dependency.
  - AC: Metric names follow the `phenotype_forge_*` namespace prefix.
  - Source: `Cargo.toml` — `phenotype-metrics = { path = "../phenotype-metrics" }`
- E5.4: As a developer, I want failed tasks to produce typed error values rather than panics so the forge process can surface actionable exit codes.
  - AC: Task errors use `thiserror`-derived error types.
  - AC: Exit code 1 on any task failure; exit code 2 on configuration failure.

---

## Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| Startup latency | Task graph construction < 50ms for up to 100 tasks |
| Concurrency | Parallel task execution via async Tokio runtime |
| Error handling | No `unwrap()` in non-test code; all errors use `thiserror` |
| Ecosystem | Integrates with `phenotype-tracing`, `phenotype-logger`, `phenotype-metrics` |
| Platform | Builds on stable Rust (2021 edition) |

---

## Acceptance Criteria Summary

| Story | Verifiable Outcome |
|-------|--------------------|
| E1.1 | `#[task]` compiles and registers function |
| E2.1 | Transitive deps run before target |
| E2.2 | Cycle exits with error before execution |
| E3.1 | `forge <name>` runs correct task |
| E3.2 | `forge --watch` re-runs on file change |
| E4.1 | `forge.toml` parsed with typed structs |
| E5.1 | OTel spans emitted per task |
