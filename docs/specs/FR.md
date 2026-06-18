# Functional Requirements — sharecli

> Canonical FR index for the sharecli CLI. Each requirement is traceable to source
> code, tests, and acceptance criteria via `docs/specs/TRACEABILITY.md`.

**Scope:** This document defines the *minimum* set of Functional Requirements (FRs)
that the sharecli binary MUST satisfy to be considered Phase 3 complete. Additional
NFRs and design notes live in `SPEC.md` and `PRD.md`; this file is the spec-of-record
for the CLI surface.

**Conventions:**

- FR IDs are stable: `FR-NNN`. They MUST NOT be renumbered once published.
- Each FR has a single **MUST** statement, plus acceptance criteria (AC) that are
  independently testable.
- The `Source` column points at the canonical Rust source file(s) that implement
  the requirement. The `Test` column points at the acceptance test file(s) that
  cover it.
- Phase 3 only covers FR-001..FR-005. New FRs MAY be appended in later phases
  (FR-006, FR-007, …) but MUST NOT renumber or rewrite existing entries.

---

## FR-001 — Managed Process Lifecycle (start / list / stop)

**Statement:** The CLI MUST be able to start a named process associated with a
project and harness type, list the running managed processes with optional
filtering, and stop them by PID, project, harness, or `--all`.

**Source:**

- `src/main.rs:38-91` — `Commands::Ps`, `Commands::Start`, `Commands::Stop` enum variants
- `src/commands/mod.rs:25-138` — `ps`, `start`, `stop` command implementations
- `src/runtime.rs:44-156` — `ProcessPool::spawn`, `ProcessPool::list`, `ProcessPool::kill`, `ProcessPool::kill_all`

**Acceptance Criteria:**

- **AC-001.1:** `sharecli start <project> --harness <harness>` records a process
  in the in-memory `ProcessPool` and returns a non-zero PID.
- **AC-001.2:** `sharecli ps` prints a table with columns `PID`, `NAME`, `MEM(MB)`,
  `PROJECT`, `HARNESS` plus a totals footer.
- **AC-001.3:** `sharecli ps --project <p>` returns only processes whose
  `project` field equals `<p>`.
- **AC-001.4:** `sharecli stop --all` terminates every managed process and
  reports `All processes stopped.`
- **AC-001.5:** `sharecli stop` with no selector exits with an error message
  instructing the user to specify `--pid`, `--project`, `--harness`, or `--all`.

**Test refs:** `tests/fr001_process_lifecycle.rs`, `tests/fr001_stop_filter.rs`

---

## FR-002 — TOML Configuration Management

**Statement:** The CLI MUST load, initialize, validate, and display its TOML
configuration from the platform config directory
(`$XDG_CONFIG_HOME/sharecli/config.toml` or OS equivalent), and it MUST persist
project registrations across invocations.

**Source:**

- `src/config.rs:1-119` — `Config`, `RuntimeConfig`, `Config::load`, `Config::init`, `Config::save`
- `src/commands/mod.rs:194-222` — `config` command (Init, Validate, Show, Get, Set)

**Acceptance Criteria:**

- **AC-002.1:** `sharecli config init` creates the config directory if missing
  and writes a default TOML file that round-trips through `Config::load`.
- **AC-002.2:** `sharecli config validate` reports the number of registered
  projects on success.
- **AC-002.3:** `sharecli config show` prints the serialized TOML containing
  a `[projects]` and `[runtime]` table.
- **AC-002.4:** A `Config` deserialized from TOML preserves the `projects`
  `HashMap<String, String>` and the `RuntimeConfig` fields
  (`node_path`, `bun_path`, `max_memory_mb`, `max_processes`).
- **AC-002.5:** `RuntimeConfig::default()` returns `max_memory_mb = Some(4096)`
  and `max_processes = Some(100)`.

**Test refs:** `tests/fr002_config_load.rs`, `tests/fr002_config_init.rs`

---

## FR-003 — Project Registry (add / list / show / discover / remove)

**Statement:** The CLI MUST maintain a registry of named projects (each mapping
to a filesystem path) under the `[projects]` table, and MUST support add, list,
show, remove, and discover (recursive scan for git repos) operations.

**Source:**

- `src/config.rs:8-68` — `Config.projects`, `default_projects`
- `src/commands/mod.rs:225-313` — `project` command (Add, Remove, List, Show, Discover, Generate)

**Acceptance Criteria:**

- **AC-003.1:** `sharecli project add <name> <path>` inserts a new entry into
  `Config.projects` and persists the change via `Config::save`.
- **AC-003.2:** `sharecli project list` prints one `name -> path` line per
  registered project, or the empty-state hint if none are registered.
- **AC-003.3:** `sharecli project show <name>` prints the resolved path and
  whether the path currently exists on disk.
- **AC-003.4:** `sharecli project discover [path]` scans the given directory
  and reports any subdirectory that contains a `.git` directory.
- **AC-003.5:** `sharecli project remove <name>` removes the entry from the
  `Config.projects` map and persists the change.

**Test refs:** `tests/fr003_project_registry.rs`, `tests/fr003_project_discover.rs`

---

## FR-004 — Process & Pool Health Status

**Statement:** The CLI MUST be able to report the health of managed processes
(per-harness counts, per-harness memory, system memory) and of the shared
runtime pool (node/bun totals, idle count, in-use count, max-per-type), and
MUST report per-process resource compliance.

**Source:**

- `src/runtime.rs:152-356` — `system_memory_usage`, `SharedRuntime::status`, `SharedRuntime::health_check`, `PoolStatus`, `RuntimeHealth`
- `src/monitoring.rs:1-118` — `HealthStatus`, `ProcessStats`, `MonitoringReport`, `ProcessStats::is_idle`
- `src/commands/mod.rs:140-191` — `status` command
- `src/commands/mod.rs:325-396` — `pool_status`, `health` commands

**Acceptance Criteria:**

- **AC-004.1:** `sharecli status` prints a per-harness table of `(count,
  memory_mb)` totals, followed by a shared-runtime pool table, and a
  system-memory line.
- **AC-004.2:** `sharecli pool` reports node and bun pool totals, idle
  counts, and the `max_per_type` ceiling.
- **AC-004.3:** `sharecli health [--harness <h>]` reports
  `HEALTHY`/`DEGRADED` based on whether every pooled process is still alive
  and under the 1 GB high-memory threshold.
- **AC-004.4:** `HealthStatus::mark_unhealthy(reason)` increments
  `checks_failed` and emits a `Health check failed: <reason>` message to
  stderr.
- **AC-004.5:** `ProcessStats::is_idle(threshold)` returns `true` only when
  the process has been up longer than `threshold` seconds AND `cpu_percent < 1.0`.

**Test refs:** `tests/fr004_status_health.rs`, `tests/fr004_pool_status.rs`

---

## FR-005 — Per-Project Resource Limits

**Statement:** The CLI MUST be able to set per-project memory and
max-process-count limits, persist them in-memory across calls within a single
process lifetime, and check whether the currently running processes for a
project are within those limits.

**Source:**

- `src/runtime.rs:358-455` — `ProjectLimits`, `ProjectResources::set_limits`,
  `ProjectResources::get_limits`, `ProjectResources::check_limits`, `ResourceCheck`
- `src/commands/mod.rs:398-447` — `set_limits`, `check_limits` commands

**Acceptance Criteria:**

- **AC-005.1:** `ProjectLimits::default()` returns
  `memory_limit_mb = 1024`, `max_processes = 10`, `cpu_affinity = None`.
- **AC-005.2:** `sharecli limits <project> --memory <mb> --processes <n>` sets
  the project's limits and prints a confirmation.
- **AC-005.3:** `ProjectResources::get_limits` returns the most recently
  set limits, or `ProjectLimits::default()` for unknown projects.
- **AC-005.4:** `ResourceCheck::overall_ok` is `true` only when both
  `memory_ok` and `processes_ok` are `true`.
- **AC-005.5:** `sharecli check <project>` prints memory, process count, and
  per-axis status (`OK` / `EXCEEDED`) plus an overall verdict line.

**Test refs:** `tests/fr005_project_limits.rs`, `tests/fr005_resource_check.rs`

---

## NFR Notes (out of scope for FR-001..FR-005)

- **NFR-001 Platform Support:** The CLI MUST build and run on Linux, macOS,
  and Windows. Process-pool tests are gated with `#[cfg(unix)]` /
  `#[cfg(windows)]` blocks to honour this.
- **NFR-002 Observability:** The CLI MUST emit structured logs via
  `tracing`/`tracing-subscriber`, gated on `--verbose` / `--quiet`.
- **NFR-003 Error Handling:** All commands MUST return `anyhow::Result<()>`
  and MUST NOT panic on missing config (FR-002 covers the missing-file case
  by returning `Config::default()`).

These NFRs are documented for context only; acceptance tests for them will
land in a later phase (FR-006+).
