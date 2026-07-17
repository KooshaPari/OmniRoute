# L6 — Performance budgets & profiling

## Scope
Benchmark harnesses, profiler integration, perf budgets in CI, N+1 query detection, and hot-path analysis across the Phenotype bloc (AgilePlus, thegent, Tracely, Tracera).

## SOTA 2026
- **Criterion** 0.5 (BurntSushi, *The Rust Performance Book* 2024) — micro-bench harness with statistical regression detection.
- **hyperfine** — CLI-level A/B benchmarks, used by Cargo itself, ripgrep, and `bat` for release gating.
- **`cargo flamegraph`** + **`perf`** — Linux flamegraphs; **`py-spy`** for Python (zero-overhead sampling).
- **Datadog Continuous Profiler** (2024) / **Pyroscope** — always-on prod profiling with p99 latency SLOs.
- **Tokio's `task::dump`** / `console` — async hot-path visualization.
- **TigerBeetle's "tigerbeetle-bench"** — continuous in-CI benchmark with ±5 % regression gates; canonical 2026 SOTA for financial systems.
- **Tokio's `RUSTFLAGS="--cfg tokio_unstable"` + `tokio-console`** — the 2025+ default for async perf diagnosis.

## Phenotype state

### AgilePlus
- `crates/agileplus-benchmarks/Cargo.toml:36-55` — `criterion = { version = "0.5", features = ["async_tokio", "html_reports"] }`; 5 criterion benches registered (`event_append_throughput`, `event_replay`, `api_response_times`, `sync_roundtrip`, `graph_query_perf`) — **status ✓**
- `crates/agileplus-benchmarks/benches/event_append_throughput.rs:1-10` — explicit perf target: "Target: ≥10,000 events/sec" — constitution gate — **✓**
- `crates/agileplus-benchmarks/benches/event_replay.rs:1-10` — gates "Full replay 1000 events: < 100 ms" and "Snapshot-assisted: < 10 ms" — **✓**
- `crates/agileplus-benchmarks/benches/api_response_times.rs:1-15` — explicit SLO targets (p95 list 100 items < 100 ms, get-by-id < 50 ms, state-transition < 100 ms, health-check < 10 ms) — **✓**
- `crates/agileplus-benchmarks/benches/sync_roundtrip.rs:8-13` — sync perf budget (push < 2 s, full-sync 100 features < 30 s, sync with 5 conflicts < 10 s) — **✓**
- `crates/agileplus-benchmarks/benches/graph_query_perf.rs:1-14` — graph store bench with future `neo4j` feature plan — **△** (no real graph backend benchmarked yet)
- `crates/agileplus-benchmarks/benches/` (5 files, 927 LOC total) — all `harness = false` and registered in manifest — **✓**
- `crates/agileplus-sqlite/src/lib/adapter.rs` — uses `PRAGMA journal_mode=WAL` to enable concurrent reads while serialising writes — **✓** (implicit perf design)
- `.github/workflows/ci.yml` — has `rust-check` (build/clippy/test) and `rust-build` matrix (ubuntu/macos), but **no `cargo bench --workspace` job** — **△** (bench harness exists, not in CI)
- `.github/CODEOWNERS:/crates/agileplus-benchmarks/ @KooshaPari` — bench crate owned by author — **✓**
- Hot path documentation: `crates/agileplus-nats/src/bus.rs` — "Spawn the reply asynchronously to avoid deadlock" — implicit hot-path reasoning — **△** (no formal hot-path doc)
- **N+1 detection:** no N+1 lint or grep guard. SQL is hand-written via `agileplus-sqlite/repository/`. No `dataloader` pattern. — **✗**
- **Profiler integration (`cargo flamegraph`, `perf`, `py-spy`):** absent from CI. No `RUSTFLAGS` for profiling build. — **✗**

### thegent
- `crates/thegent-router/Cargo.toml:30` — `criterion = "0.5"` dev-dep + `[[bench]] name = "audit_bench"` — **✓**
- `crates/thegent-router/benches/audit_bench.rs:1-60` — benches `AuditRecord::new` (UUID + SHA-256), `AuditLogger::append_100`, `AuditLogger::append_1000` — annotated `@trace FR-OPT-008` (links bench to functional req) — **✓**
- `crates/thegent-router/README.md` — documents `CARGO_NET_OFFLINE=true cargo bench --locked --manifest-path ../../crates/Cargo.toml -p thegent-router --bench audit_bench` — **✓**
- `crates/thegent-router/Cargo.toml:33-38` — release profile: `opt-level = 3, lto = true, codegen-units = 1, overflow-checks = false` — **✓**
- `pyproject.toml:2-4` — `pytest-benchmark>=4.0.0` in `dev` extras — **✓**
- `tests/test_benchmark_report.py:1-40` — pytest that parses `hyperfine` JSON output to generate speedup reports — **✓** (hyperfine integration tested)
- `DEPENDENCIES.md` — `pytest-benchmark | >=4.0.0 | Benchmarks` listed in dep manifest — **✓**
- `crates/thegent-benchmark/src/main.rs` — exists as a "typical execution would target a criterion bench such as `cargo bench --bench audit_bench`" comment — bench harness stub — **△**
- `crates/thegent-shm/Cargo.toml:24` — `simd-json = { version = "0.17.0", features = ["serde"] }` — SIMD JSON for high-throughput IPC parsing — **✓**
- `crates/thegent-cache/Cargo.toml:25` — `simd-json = { version = "0.14.3" }` — **✓**
- `crates/thegent-discovery/Cargo.toml:18` — `simd-json = "0.17.0"` — **✓**
- `Cargo.toml` — `max-performance-safe` portable SIMD profile mentioned in comment — **△** (not yet a real build profile)
- `crates/thegent-shm/Cargo.toml:21` + `thegent-cache/Cargo.toml:21` + `thegent-shims/Cargo.toml:18` — `parking_lot = "0.12"` (used in hot paths; `parking_lot` is faster than `std::sync`) — **✓** (indirect perf choice)
- `grade.sh:81` — `run_check "bench" "cargo bench --workspace" 1 true` — local grade includes bench — **△** (fast mode skips, not enforced in CI)
- `crates/harness-native/src/dispatcher.rs:1-7` — explicit "// hot path replacement for bin/harness" — documented hot path with Rust-implemented strategies vs. bash — **✓**
- `crates/harness-native/src/strategies/circuit_breaker.rs:1-30` — `AtomicU32/AtomicU64` with `Ordering::SeqCst` for failure-window counter — **✓** (lock-free hot path)
- Hot path N+1 / dataloader: no equivalent in the Python/Rust hybrid layer. — **✗**
- Profiler integration: `docs/research/PERF_OPTIMIZATION_RESEARCH_2026-02-20.md` documents `cargo-flamegraph`, `py-spy`, `perf`, `memray` — research only, no code integration. — **△** (docs, no code)

### Tracely
- `crates/tracely-sentinel/Cargo.toml` — `criterion = "0.5"` as dev-dep — **△** (declared but only a 13-line `noop` bench)
- `crates/tracely-sentinel/benches/perf.rs:1-13` — placeholder `c.bench_function("noop", ...)` — **✗** (not real perf coverage)
- `Taskfile.yml` — invokes `cargo bench` — **△** (CI step but no real benchmark)
- `CLAUDE.md` + `README.md` — `cargo bench` documented as a workflow step — **△**
- `crates/tracely-sentinel/CLAUDE.md` — notes "tokio (async), atomic operations" as key deps — **△** (no bench captures the atomic perf)
- Profiler integration: absent. — **✗**
- N+1: not applicable (Rust core, no ORM). — **△**
- Hot path: no `// hot path` markers in Tracely sources beyond the import paths. — **△**

### Tracera
- `pyproject.toml:30` — `pytest-benchmark>=5.2.3` (3× listed as a sub-dep) — **✓**
- `pyproject.toml:filterwarnings` — `ignore::pytest_benchmark.logger.PytestBenchmarkWarning` — configured to silence spurious benchmark warnings — **✓**
- `tests/performance/test_matrix_build_benchmark.py:1` — `@pytest.mark.benchmark(group="matrix-build")` — real pytest-benchmark test for matrix build — **✓**
- Tracera core is Go (`go.mod` present). Per `thegent/grade.sh:111` Go stack runs `go test -bench=. ./...` (1 pt) — **△** (perf runner exists in grade script but not in Tracera's own CI)
- Profiler integration: `pprof` is the Go standard; no evidence of `pprof` import or `runtime/pprof` setup in Tracera core. — **✗**
- N+1: Go + `database/sql` — no `sqlx` or `dataloader` pattern detected. — **✗**
- Hot path: no markers. — **△**

## Gaps

1. **No CI bench step (AgilePlus, Tracely, thegent)** — `cargo bench` is documented but not gated in `.github/workflows/`. **effort: S** — add `bench` job to each CI workflow calling `cargo bench --workspace` with `codspeed` or `bencher.dev` regression gate.
2. **No continuous profiler in prod (entire bloc)** — no `pyroscope-rs`, `pyroscope-py`, or Datadog Continuous Profiler agent configured. **effort: M** — instrument `agileplus-api`, `thegent-runtime`, `tracely-sentinel` with `pprof-rs`/`py-spy` exports; correlate with p95 SLOs from `api_response_times.rs`.
3. **No N+1 detection** — neither a grep guard (e.g. `rg "for.*query_one|for.*query_as"` against SQL repos) nor a runtime check (e.g. `sqlx` query-counter) is present. **effort: M** — add a dev-only query counter in `agileplus-sqlite` and a pre-commit grep pattern.
4. **Tracely `perf.rs` is a 13-line noop** — does not exercise the actual sentinel hot path. **effort: S** — replace with criterion bench for the rate-limiter/token-bucket path and the `Ordering::SeqCst` critical section.
5. **No p99 SLO assertion in tests** — `api_response_times.rs` documents the SLOs in comments but does not assert them. **effort: S** — add `assert!` at end of bench for `p95 < SLO` (criterion 0.5 supports this via `c.bench` returns).
6. **No hot-path documentation index** — only 1 explicit `// hot path` comment across the bloc. **effort: S** — add a `docs/architecture/HOT_PATHS.md` listing the 5–10 hottest functions per crate with benchmark back-references.
7. **`max-performance-safe` SIMD profile not built** — declared in thegent root comment but not present in `[profile.*]` section. **effort: S** — add `[profile.max-perf]` with `opt-level = 3, lto = "fat", codegen-units = 1, target-cpu = "native"`.
8. **No flamegraph CI artifact** — even when `cargo bench` runs locally, no SVG is archived for regression diff. **effort: S** — add `cargo flamegraph --bench <name> --output artifacts/` step in CI and upload as artifact.

## Recommendations

1. **Adopt TigerBeetle's pattern: every PR runs benches; regressions > 5 % fail CI.** Use `bencher.dev` (free OSS tier) or `codspeed` (free for OSS) to track per-commit benchmark history.
2. **Wire `pprof-rs` into `agileplus-api`, `tracely-sentinel`, and `thegent-router`**; expose `/debug/pprof/profile` and `/debug/pprof/heap` endpoints behind a feature flag.
3. **Set an SLO dashboard** for each of the 5 SOTA-pillar perf budgets in `api_response_times.rs:9-13`; alert on p95 > SLO over 1-hour window.
4. **Promote Tracely `perf.rs`** from a noop to a real bench (sentinel critical section + rate limiter) — currently the weakest link.
5. **Add `cargo-deny` license + advisory gate** to the perf regression check: a perf-critical dep can be downgraded by a vuln fix; warn if the bench target regresses > 2 %.
6. **Per-crate `BENCHMARKS.md`** summarising what is benchmarked, the SLO, and the last-100-commit trend — in the same shape as Tracera's `test_matrix_build_benchmark.py` docstring.
7. **Lock-free paths already in `harness-native/strategies/circuit_breaker.rs`** — extend the pattern to `agileplus-factory/src/queue.rs:108` (currently uses `tokio::sync::Mutex`); arc-swap or atomics would remove the lock on the issue hot path.
