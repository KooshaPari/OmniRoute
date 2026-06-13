# DAG: melosviz-Metron-nanovms-NetScript 100-task execution plan
# 5 levels x 20 tasks = 100 tasks
# Max parallelism: 20 per level
# Date: 2026-06-08

## Level 1: Setup & Build Fixes (20 tasks, no dependencies)

### melosviz (5 tasks)
M1.01  Restore backend/pyproject.toml with dependencies
M1.02  Restore backend/src/melosviz/__init__.py
M1.03  Restore backend/src/melosviz/main.py (FastAPI app)
M1.04  Restore backend/src/melosviz/analysis/models.py (Pydantic models)
M1.05  Restore backend/src/melosviz/analysis/engine.py (AudioAnalysisEngine)

### Metron (5 tasks)
MT1.01  Fix clippy approx_constant error in tests/lib_tests.rs:671
MT1.02  Fix clippy assertions_on_constants in tests/smoke_test.rs:4
MT1.03  Fix clippy default_constructed_unit_structs in tests/lib_tests.rs:586
MT1.04  Run cargo fmt to fix formatting across all files
MT1.05  Fix Cargo.toml crate name mismatch (metrickit vs metron in README)

### nanovms (5 tasks)
NV1.01  Restore go.mod with proper module path
NV1.02  Restore cmd/nvms/main.go (CLI entrypoint)
NV1.03  Restore pkg/deploy/deploy.go (Deploy orchestrator)
NV1.04  Restore pkg/tier/wasm.go (Tier1 WASM adapter)
NV1.05  Restore pkg/tier/gvisor.go (Tier2 gVisor adapter)

### NetScript (5 tasks)
NS1.01  Add rust-version, license, repository, description to Cargo.toml
NS1.02  Add lints table for clippy configuration in Cargo.toml
NS1.03  Remove or deprecate redundant Taskfile.yml (coexists with Justfile)
NS1.04  Derive PartialEq for Token struct in src/domain/lexer.rs:52-67
NS1.05  Derive Eq and Hash for Token struct in src/domain/lexer.rs:52-67

## Level 2: Core Domain Fixes (20 tasks, depends on Level 1)

### melosviz (5 tasks)
M2.01  Restore backend/src/melosviz/presets/registry.py (ThemePresetRegistry)
M2.02  Restore backend/src/melosviz/render/spec_builder.py (VisualizationSpecBuilder)
M2.03  Restore backend/src/melosviz/render/webgl_exporter.py (WebGL exporter)
M2.04  Restore backend/src/melosviz/render/video_exporter.py (Video exporter)
M2.05  Restore backend/src/melosviz/sdk/py_client.py (MelosvizClient HTTP client)

### Metron (5 tasks)
MT2.01  Add Default derive to GaugeValue for API consistency
MT2.02  Add Histogram::with_unit() method
MT2.03  Add Registry::get_counter(name) lookup method
MT2.04  Add Registry::get_gauge(name) lookup method
MT2.05  Add Registry::get_histogram(name) lookup method

### nanovms (5 tasks)
NV2.01  Restore pkg/tier/firecracker.go (Tier3 Firecracker adapter)
NV2.02  Restore pkg/config/config.go (NVMS config parser)
NV2.03  Restore pkg/orchestrate/orchestrate.go (Orchestration engine)
NV2.04  Restore pkg/runtime/runtime.go (Runtime interface)
NV2.05  Restore pkg/validate/validate.go (Config validation)

### NetScript (5 tasks)
NS2.01  Implement LexerPort for Lexer in src/domain/lexer.rs
NS2.02  Wire App::new() to select adapter and lexer in src/app/mod.rs
NS2.03  Use App instead of bypassing it in src/main.rs
NS2.04  Add Float TokenType and handle . in numbers in src/domain/lexer.rs:132-139
NS2.05  Replace unwrap_or(0) with overflow-safe error handling in src/domain/lexer.rs:138

## Level 3: Feature Implementation (20 tasks, depends on Level 2)

### melosviz (5 tasks)
M3.01  Restore backend/tests/test_analysis_engine.py (FFT/BPM tests)
M3.02  Restore backend/tests/test_api_contracts.py (API contract tests)
M3.03  Restore backend/tests/test_models.py (Pydantic validation tests)
M3.04  Restore backend/tests/conftest.py (pytest fixtures)
M3.05  Restore sdk/python/src/melosviz_sdk/client.py (Python SDK client)

### Metron (5 tasks)
MT3.01  Implement Summary metric type and SummaryValue struct
MT3.02  Add Summary registry methods (register_summary, summary, summaries)
MT3.03  Create src/adapters/statsd.rs (StatsD exporter adapter)
MT3.04  Create src/adapters/json.rs (JSON export adapter)
MT3.05  Create src/adapters/in_memory.rs (In-memory registry adapter)

### nanovms (5 tasks)
NV3.01  Restore sdk/rust/Cargo.toml (Rust SDK manifest)
NV3.02  Restore sdk/rust/src/lib.rs (Rust SDK library)
NV3.03  Restore integrations/pheno-compose/README.md (PhenoCompose integration)
NV3.04  Restore docs/reference/architecture.md (Architecture docs)
NV3.05  Restore docs/guides/quickstart.md (Quickstart guide)

### NetScript (5 tasks)
NS3.01  Add escape sequence parsing (\\n, \\t, \\, \") in src/domain/lexer.rs:141-149
NS3.02  Add /* */ block comment support in src/domain/lexer.rs:151-155
NS3.03  Support Unicode identifiers in src/domain/lexer.rs:124-130
NS3.04  Add 0x/0o/0b numeric literal support in src/domain/lexer.rs:132-139
NS3.05  Add Span/Loc struct for precise source positions in src/domain/lexer.rs

## Level 4: Integration & Testing (20 tasks, depends on Level 3)

### melosviz (5 tasks)
M4.01  Restore sdk/python/tests/test_entrypoints.py (SDK entrypoint tests)
M4.02  Restore sdk/python/tests/conftest.py (SDK pytest fixtures)
M4.03  Restore desktop/src-tauri/Cargo.toml (Tauri manifest)
M4.04  Restore desktop/src-tauri/src/main.rs (Tauri entrypoint)
M4.05  Restore desktop/src-tauri/tauri.conf.json (Tauri config)

### Metron (5 tasks)
MT4.01  Fix histogram bucket +Inf label for Prometheus spec compliance
MT4.02  Create examples/prometheus_export.rs (Prometheus scrape example)
MT4.03  Create examples/statsd_push.rs (StatsD push example)
MT4.04  Create examples/custom_exporter.rs (Custom adapter example)
MT4.05  Create src/application/cardinality.rs (Cardinality management)

### nanovms (5 tasks)
NV4.01  Restore .github/workflows/ci.yml (CI workflow)
NV4.02  Restore .github/workflows/release.yml (Release workflow)
NV4.03  Restore Taskfile.yml build targets (backend:build, sdk:rs:build, etc.)
NV4.04  Restore grade.sh stack detection (fix unknown stack error)
NV4.05  Restore lefthook.yml pre-commit lint hooks (fix source file detection)

### NetScript (5 tasks)
NS4.01  Add test_illegal_tokens for malformed input in tests/unit_tests.rs
NS4.02  Add integration tests for CliAdapter stdin/stdout behavior
NS4.03  Add unit tests for App::run_cli() in src/app/mod.rs
NS4.04  Add unit tests for CLI argument parsing in src/main.rs
NS4.05  Add doc tests and runnable examples in src/lib.rs

## Level 5: Polish, Benchmarks, Docs (20 tasks, depends on Level 4)

### melosviz (5 tasks)
M5.01  Restore web/package.json (Node manifest)
M5.02  Restore web/vite.config.ts (Vite config)
M5.03  Restore web/tsconfig.json (TypeScript config)
M5.04  Restore web/src/ directory with React/TypeScript source
M5.05  Restore web/index.html (Vite entry HTML)

### Metron (5 tasks)
MT5.01  Create benches/metric_update_perf.rs (Benchmark)
MT5.02  Create benches/cardinality_check.rs (Benchmark)
MT5.03  Create benches/export_performance.rs (Benchmark)
MT5.04  Create tests/integration/prometheus_export_test.rs (Integration test)
MT5.05  Create tests/integration/cardinality_limits_test.rs (Integration test)

### nanovms (5 tasks)
NV5.01  Restore desktop/electrobun/package.json (Electrobun manifest)
NV5.02  Replace desktop/electrobun/dist/main.js stub with real implementation
NV5.03  Restore sdk/python/pyproject.toml (Python SDK manifest)
NV5.04  Restore sdk/python/src/melosviz_sdk/__init__.py (SDK exports)
NV5.05  Fix .github/workflows/ci.yml paths (fix backend pip install reference)

### NetScript (5 tasks)
NS5.01  Create ReplAdapter with readline support in src/adapters/
NS5.02  Create FileAdapter for .ns file input in src/adapters/
NS5.03  Create parser.rs with Expr/Stmt/Program AST in src/domain/
NS5.04  Add structured error type instead of bare Illegal in src/domain/lexer.rs
NS5.05  Add criterion benchmark for Lexer::tokenize() in Cargo.toml/tests/

## Side DAG Fillers (used to fill width gaps when repo tasks are blocked)

### Additional nanovms (if needed)
NVS.01  Fix pkg/tier/wasm.go stub (empty function bodies)
NVS.02  Fix pkg/tier/gvisor.go stub (hardcoded return values)
NVS.03  Fix pkg/tier/firecracker.go stub (missing interface implementations)
NVS.04  Add unit tests for Deploy orchestrator
NVS.05  Add unit tests for Config validator

### Additional NetScript (if needed)
NSS.01  Fix column tracking for tokens after multi-char reads
NSS.02  Error on unterminated strings (EOF before closing quote)
NSS.03  Add BigInt variant for integer overflow
NSS.04  Verify all Justfile recipes are documented and tested
NSS.05  Create tracking issues for P4 (parser) and P5 (REPL) in docs/SSOT.md

### Cross-repo hygiene (if needed)
H1.01  Audit all 4 repos for duplicate dependency versions
H1.02  Standardize .github/workflows across all 4 repos
H1.03  Add dependabot config to all 4 repos
H1.04  Add CODEOWNERS to all 4 repos
H1.05  Add scorecard.yml to all 4 repos
