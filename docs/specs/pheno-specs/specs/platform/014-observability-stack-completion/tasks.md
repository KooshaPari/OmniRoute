# Work Packages: Observability Stack Completion — Complete Across 8 Repositories

**Inputs**: Design documents from `kitty-specs/014-observability-stack-completion/`
**Prerequisites**: spec.md, Rust toolchain, OpenTelemetry knowledge
**Scope**: Cross-repo (8 repositories): tracely, thegent-metrics, thegent-shm, helix-logging, Tracera, Profila, Phench, helix-tracing (archive)

---

## WP-001: Phench (Benchmarking) — Complete Implementation with Reporting

- **State:** planned
- **Sequence:** 1
- **File Scope:** Phench repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Phench benchmarking framework fully implemented with statistical analysis
  - Benchmark results exportable to JSON, CSV, and human-readable formats
  - Integration hooks for correlation with production metrics pipeline
  - ≥80% test coverage on benchmarking core
  - All quality checks passing (clippy, tests, fmt)
- **Estimated Effort:** M

Complete the Phench benchmarking framework with full statistical analysis, result reporting, and integration hooks for the observability pipeline. Phench serves as the benchmarking component that correlates development-time benchmarks with production performance metrics.

### Subtasks
- [ ] T001 Audit current Phench state: existing code, gaps, dependencies
- [ ] T002 Implement statistical analysis module: mean, stddev, percentiles, confidence intervals
- [ ] T003 Implement benchmark result exporters: JSON, CSV, Markdown report
- [ ] T004 Add benchmark suite runner with warmup, iteration, and cooldown phases
- [ ] T005 Implement observability integration hooks: emit benchmark results as metrics events
- [ ] T006 Write unit tests for statistical analysis (target: ≥80% coverage)
- [ ] T007 Write integration tests for result export formats
- [ ] T008 Add comprehensive rustdoc with benchmarking examples
- [ ] T009 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- None (can start independently)

### Risks & Mitigations
- Statistical analysis complexity: Use existing crates (statrs) as reference, implement core functions
- Benchmark flakiness: Implement warmup phases, multiple iterations, outlier rejection

---

## WP-002: tracely — Implement Distributed Tracing with OpenTelemetry

- **State:** planned
- **Sequence:** 2
- **File Scope:** tracely repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - W3C Trace Context propagation implemented for HTTP, gRPC, and message queues
  - Trace context extraction and injection working across all protocol adapters
  - OpenTelemetry SDK integration with configurable exporters (OTLP, stdout, file)
  - Integration with thegent-metrics and thegent-shm for trace-metric correlation
  - ≥80% test coverage on tracing core
  - All quality checks passing
- **Estimated Effort:** L

Complete the tracely distributed tracing implementation with full W3C Trace Context propagation. This is the backbone of the observability stack, providing trace IDs that correlate logs, metrics, and profiling data across services.

### Subtasks
- [ ] T010 Audit current tracely state: existing tracing code, protocol adapters, gaps
- [ ] T011 Implement W3C Trace Context: traceparent and traceparent header parsing/generation
- [ ] T012 Implement HTTP trace context injection/extraction middleware
- [ ] T013 Implement gRPC trace context propagation via metadata
- [ ] T014 Implement message queue trace context propagation (for async workflows)
- [ ] T015 Integrate OpenTelemetry SDK with configurable exporters (OTLP, stdout, file)
- [ ] T016 Implement trace sampling strategies: always-on, probability-based, head/tail
- [ ] T017 Add trace-metric correlation hooks for thegent-metrics integration
- [ ] T018 Write unit tests for trace context propagation (target: ≥80% coverage)
- [ ] T019 Write integration tests for HTTP and gRPC trace propagation
- [ ] T020 Add comprehensive rustdoc with tracing setup examples
- [ ] T021 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- None (can start in parallel with WP-001)

### Risks & Mitigations
- W3C spec compliance: Reference official W3C Trace Context spec, test against conformance suite
- Performance overhead: Benchmark tracing overhead, optimize hot paths, support sampling

---

## WP-003: thegent-metrics + thegent-shm — Metrics Collection and Shared Memory

- **State:** planned
- **Sequence:** 3
- **File Scope:** thegent-metrics repository, thegent-shm repository
- **Acceptance Criteria:**
  - thegent-metrics integrated with tracely for trace-metric correlation
  - Consistent labeling scheme across all metrics (service, environment, version)
  - thegent-shm shared memory optimized for low-latency metric writes
  - Metrics exportable via OTLP with consistent schema
  - Integration tests verifying trace ID propagation into metrics
  - All quality checks passing
- **Estimated Effort:** M

Integrate thegent-metrics with the tracing pipeline and optimize thegent-shm shared memory for low-latency metric collection. Metrics receive trace context from tracely, enabling correlation between traces and metric anomalies.

### Subtasks
- [ ] T022 Audit thegent-metrics: current metric types, collection patterns, export formats
- [ ] T023 Audit thegent-shm: shared memory layout, read/write performance, safety guarantees
- [ ] T024 Implement trace ID injection into metric labels in thegent-metrics
- [ ] T025 Establish consistent labeling scheme: service, environment, version, trace_id
- [ ] T026 Integrate thegent-metrics with tracely trace context extraction
- [ ] T027 Optimize thegent-shm: reduce lock contention, batch writes, memory alignment
- [ ] T028 Implement OTLP metric export with consistent schema
- [ ] T029 Write integration tests: trace → metric correlation, SHM read/write correctness
- [ ] T030 Benchmark SHM performance: latency, throughput, memory usage
- [ ] T031 Run quality checks across both crates

### Dependencies
- WP-002 (tracely trace context available for metric injection)

### Risks & Mitigations
- SHM safety: Use unsafe carefully, add extensive safety tests, consider memmap2 crate
- Metric cardinality explosion: Enforce label limits, document cardinality best practices

---

## WP-004: helix-logging — Structured Logging with Correlation IDs

- **State:** planned
- **Sequence:** 4
- **File Scope:** helix-logging repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Automatic trace ID injection into all log entries
  - Unified log format across all services (JSON with standard fields)
  - Log levels configurable per module/service
  - Integration with tracely for trace-log correlation
  - ≥80% test coverage on logging core
  - All quality checks passing
- **Estimated Effort:** M

Complete helix-logging with automatic trace ID injection and unified log format. Logs become correlated with traces and metrics through shared trace IDs, enabling full-stack observability queries.

### Subtasks
- [ ] T032 Audit helix-logging: current log format, structured logging support, output targets
- [ ] T033 Implement automatic trace ID injection via tracing subscriber layer
- [ ] T034 Define unified log format: timestamp, level, service, trace_id, span_id, message, fields
- [ ] T035 Implement JSON log formatter with the unified format
- [ ] T036 Add configurable log levels per module/service
- [ ] T037 Implement multiple output targets: stdout, file, OTLP
- [ ] T038 Integrate with tracely: extract trace context from current span
- [ ] T039 Write unit tests for log formatting and trace ID injection (target: ≥80%)
- [ ] T040 Write integration tests: log → trace correlation verification
- [ ] T041 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-002 (tracely trace context available for log injection)

### Risks & Mitigations
- Log volume: Implement sampling, rate limiting, and structured field filtering
- Trace ID extraction failures: Graceful degradation — log without trace_id, warn once

---

## WP-005: Profila — Profiling Toolkit Integration

- **State:** planned
- **Sequence:** 5
- **File Scope:** Profila repository, Tracera repository
- **Acceptance Criteria:**
  - Profila profiling toolkit integrated with tracing pipeline
  - CPU, memory, and allocation profiling supported
  - Profile data correlated with trace spans
  - Tracera profiling prototype completed and merged into Profila
  - Profile export in standard formats (pprof, flamegraph)
  - All quality checks passing
- **Estimated Effort:** M

Complete Profila as the profiling toolkit and integrate it with the tracing pipeline. Tracera's profiling prototype functionality is merged into Profila. Profile data is correlated with trace spans, enabling identification of performance bottlenecks within specific request flows.

### Subtasks
- [ ] T042 Audit Profila and Tracera: existing profiling code, overlap, gaps
- [ ] T043 Merge Tracera profiling functionality into Profila
- [ ] T044 Implement CPU profiling with pprof-compatible output
- [ ] T045 Implement memory/allocation profiling
- [ ] T046 Integrate Profila with tracely: attach profile data to trace spans
- [ ] T047 Implement flamegraph generation from profile data
- [ ] T048 Write unit tests for profiling core (target: ≥80% coverage)
- [ ] T049 Write integration tests: profile → trace correlation
- [ ] T050 Run quality checks across merged codebase

### Dependencies
- WP-002 (tracely trace context for profile correlation)

### Risks & Mitigations
- Profiling overhead: Support sampling profilers, document overhead benchmarks
- Platform-specific profiling: Test on macOS and Linux, document platform limitations

---

## WP-006: Archive helix-tracing and Document Rationale

- **State:** planned
- **Sequence:** 6
- **File Scope:** helix-tracing repository, observability documentation
- **Acceptance Criteria:**
  - helix-tracing archived via GitHub API
  - Archival README documents: why archived, functionality migrated to tracely, migration guide
  - All references to helix-tracing in active repos updated to use tracely
  - No broken imports or dependencies on helix-tracing
- **Estimated Effort:** S

Archive helix-tracing now that tracely provides complete distributed tracing functionality. Document the archival rationale, migration path, and ensure no active repos depend on the archived code.

### Subtasks
- [ ] T051 Audit helix-tracing: confirm all functionality covered by tracely
- [ ] T052 Create archival README with rationale, tracely migration guide, and timeline
- [ ] T053 Archive helix-tracing via GitHub API
- [ ] T054 Search all active repos for helix-tracing references
- [ ] T055 Update any remaining references to use tracely instead
- [ ] T056 Verify no broken imports or dependencies remain
- [ ] T057 Document archival decision in observability stack documentation

### Dependencies
- WP-002 (tracely complete and verified as replacement)
- WP-004 (helix-logging updated to use tracely)

### Risks & Mitigations
- Missed references: Comprehensive grep/search across all active repos before archival
- Functionality gap: Audit (T051) confirms tracely covers all helix-tracing features

---

## Dependency & Execution Summary

```
WP-001 (Phench benchmarking) ───────── first, no deps (parallel with WP-002)
WP-002 (tracely distributed tracing) ─ first, no deps (parallel with WP-001)
WP-003 (thegent-metrics + thegent-shm) ── depends on WP-002
WP-004 (helix-logging) ───────────────── depends on WP-002
WP-005 (Profila profiling) ───────────── depends on WP-002
WP-006 (Archive helix-tracing) ───────── depends on WP-002, WP-004
```

**Parallelization**: WP-001 and WP-002 can run in parallel (independent codebases). WP-003, WP-004, and WP-005 can run in parallel after WP-002. WP-006 is the final cleanup step.

**MVP Scope**: WP-002 alone provides distributed tracing. WP-003 + WP-004 adds metrics and logging correlation.
