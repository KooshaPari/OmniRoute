# L8 — Memory & allocation

## Scope
Allocator choice, heap profiling, zero-copy patterns, Rc/Arc audit, memory budgets in CI, allocation hotspots across the 4-repo Phenotype bloc (AgilePlus + thegent + Tracely + Tracera, ~76 crates).

## SOTA 2026
- `jemalloc` (rust) / `mimalloc` (cross-lang) for long-running daemons; `dhat` (Valgrind-style heap profiler, 2023+) for periodic heap reports.
- `memray` (Bloomberg, native, flamegraph-capable) for Python services; `tracemalloc` (stdlib) as the minimum.
- `Cow<'_, T>`, `Bytes`, `Arc<[T]>` for zero-copy; clippy lints `borrowed_box`, `rc_buffer`, `redundant_allocation`, `box_default` enforced.
- CI memory budgets: RSS / heap bytes asserted in benchmark jobs; SOTA emits a regression PR comment.
- `Weak::new` audit, `Arc::strong_count` checks for cycle detection.
- `SOURCE_DATE_EPOCH` reproducible builds eliminate non-determinism in heap layouts.

## Phenotype state

### AgilePlus (45+ Rust crates — `agileplus-{domain,application,api,sqlite,cli,nats,p2p,git,...}`)

- `AgilePlus/Cargo.toml:1-100` — workspace root, no `[profile.release]` memory knobs — **status △**
- `AgilePlus/clippy.toml:1-10` — no `borrowed_box`, `rc_buffer`, `redundant_allocation`, `box_default` lints enforced — **status ✗**
- `AgilePlus/crates/agileplus-application/src/lib.rs:30` — 30 `Arc::new` sites (top hotspot) — **status △** (likely shared HTTP state, but no audit)
- `AgilePlus/crates/agileplus-api/src/state.rs:8` — 8 `Arc` sites — **status △**
- `AgilePlus/crates/agileplus-nats/src/bus.rs:6` — 6 `Arc` sites — **status △**
- `AgilePlus/crates/agileplus-triage/src/hybrid_pipeline.rs:143` — `sig.as_slice()` zero-copy call site — **status ✓**
- `AgilePlus/crates/agileplus-triage/src/minhash.rs:88,166` — `as_slice()` returns `&[u64]` — **status ✓**
- `AgilePlus/crates/agileplus-governance/src/audit.rs:470,601` — `query_map(..., params.as_slice())` — **status ✓**
- `AgilePlus/crates/agileplus-sqlite/src/rebuild.rs:263-264, repository/audit.rs:99-100` — `entry.hash.as_slice()` for BLAKE chain — **status ✓**
- `AgilePlus/crates/phenotype-dep-guard/src/osv.rs` — `Vec::with_capacity` pre-alloc — **status ✓**
- **No `#[global_allocator]`** in any of 45+ crates (`grep -r 'global_allocator'` → 0 hits) — **status ✗**
- **No `jemalloc`/`mimalloc`/`tikv-jemallocator`** in any Cargo.toml — **status ✗**
- **No `dhat`/`heaptrack`/`heapdump`** in any Cargo.toml — **status ✗**
- **No memory budget in CI** — `.github/workflows/ci.yml` has no `RSS`/`peak_mem`/`valgrind` — **status ✗**
- **No `bytes::Bytes` use** (0 hits across workspace) — **status ✗** for high-throughput paths
- **No `Arc<[T]>`** (0 hits) — **status ✗**
- **No `Cow<'_, T>`** (0 hits) — **status ✗**

### thegent (25+ Python+hybrid crates, Rust pyo3 bindings)

- `thegent/pyproject.toml:13,123` — `psutil>=7.0.0` for memory introspection + `psleak>=0.1.0` dev-dep for FD leak detection — **status ✓**
- `thegent/tests/test_resource_leaks.py:1-296` — `tracemalloc` used in 3 distinct leak tests (file ops, subprocess mgr, fd-leak) — **status ✓**
- `thegent/tests/test_resource_leaks.py:368-384` — additional `tracemalloc.get_traced_memory()` baseline/delta check — **status ✓**
- `thegent/crates/thegent-policy/src/policy.rs:94,120` — `Python::with_gil(|py| ...)` zero-GIL-reacquire pyo3 — **status ✓**
- `thegent/crates/thegent-git/src/lib.rs:180,347,509,543,576,603,623` — `Python::with_gil` to release GIL during blocking I/O — **status ✓**
- `thegent/crates/thegent-subprocess/src/lib.rs:246,293,345` — `allow_threads` to release GIL around `run_command` — **status ✓**
- `thegent/crates/thegent-{fs,subprocess,router,policy,resources,cache,git}/Cargo.toml` — `pyo3 = { version = "0.29", features = ["abi3-py312", "extension-module"] }` consistent — **status ✓**
- `thegent/crates/*/pyproject.toml` — `requires = ["maturin>=1.0,<2.0"]`, `build-backend = "maturin"` (most crates) — **status ✓**
- **No `memray` configured** (0 hits in pyproject.toml or CI) — **status ✗** (would catch allocation regressions in CI)
- **No `global_allocator`** in any thegent Rust crate — **status △**
- **No `tracemalloc` in production** (only in tests) — **status △**
- **No memory budget gate** in `thegent/.github/workflows/python-ci.yml` — **status ✗**

### Tracely (5 Rust crates: `tracely-core`, `helix-tracing`, `tracely-sentinel`, `zerokit`, `pheno-logging-zig`)

- `Tracely/crates/tracely-core/Cargo.toml:1-50` — tracing/log/metrics core, no `global_allocator` — **status △**
- `Tracely/crates/helix-tracing/Cargo.toml:1-25` — distributed tracing, no allocator — **status △**
- `Tracely/crates/tracely-sentinel/Cargo.toml:1-30` — bulkhead/circuit breaker, no allocator — **status △**
- **No `#[global_allocator]`** anywhere in 5 crates — **status ✗**
- **No `jemalloc`/`mimalloc`** (0 hits) — **status ✗**
- **No `dhat`/`heaptrack`** (0 hits) — **status ✗**
- **No `pheno-logging-zig` build** — `find . -name '*.zig' -o -name 'build.zig'` returns nothing despite crate listed — **status ✗** (orphan)
- **No memory budget in CI** (`Tracely/.github/workflows/ci.yml` inherits template-commons reusable-rust-ci) — **status ✗**
- **No `Bytes`/`Arc<[T]>`/`Cow`** in core — **status ✗**
- Tracely is observability-critical (long-running tracing) yet has the weakest memory discipline of the four repos.

### Tracera (1 Rust crate `tracera-core` + Go + TS polyglot)

- `Tracera/Cargo.toml:1-50` — workspace root, `phenotype-error-core`, `phenotype-string`, `phenotype-event-bus` paths — **status ✓** (shared extraction)
- `Tracera/justfile:90-110` — `coverage` recipe uses `cargo llvm-cov --workspace --fail-under-lines 85` — **status ✓**
- **No `global_allocator`** in Tracera Rust — **status △**
- **No `jemalloc`/`mimalloc`** (0 hits) — **status ✗**
- **No `GOMEMLIMIT`** in Go code (0 hits across `*.go` and `go.mod`) — **status ✗**
- **No `pprof`** integration (0 hits) — **status ✗**
- **No `process.memoryUsage()` / `v8.writeHeapSnapshot()` in TS** (0 hits in `frontend/`, `backend/`, `internal/`) — **status ✗**
- **No `tracemalloc` in Python** (Tracera has no Python surface) — **status N/A**
- **No memory budget in CI** — `Tracera/.github/workflows/{cargo-deny,governance-gates,python-ci,rust-tests}.yml` have no `RSS`/`peak_mem` — **status ✗**
- **No `Bytes`/`Arc<[T]>`/`Cow`** in Rust — **status ✗**
- **No Dockerfile / docker-compose** at repo root (Tracera is library-only) — **status N/A** (acceptable for lib)
- The justfile has no `bench` or memory profile recipe — **status ✗**

### Cross-cutting
- All four repos: **zero `#[global_allocator]` adoption** despite multiple long-running daemons (`agileplus-api`, `agileplus-p2p`, `agileplus-nats`, `thegent-runtime`) — **status ✗**
- All four repos: **zero `dhat`/`memray`/`tracemalloc` in production** — only `thegent/tests/` uses `tracemalloc` in tests
- All four repos: **zero `bytes::Bytes` use** in Rust — pervasive `Vec<u8>` instead — **status ✗**
- All four repos: **zero `Cow<'_, T>` use** in Rust — clippy lint not configured
- All four repos: **no CI memory budget** (no `RSS`/`peak_mem`/`valgrind`/heaptrack step)
- Only thegent has any proactive memory testing (`psleak` + `tracemalloc` tests)

## Gaps

1. **All repos** — `#[global_allocator]` missing on long-running daemons — `agileplus-api`, `agileplus-p2p`, `agileplus-nats`, `thegent-runtime` should adopt `tikv-jemallocator` — **effort: S**
2. **All repos** — no heap profiling (`dhat` in Rust, `memray` in Python) — add as dev-dep + CI artifact — **effort: S**
3. **All repos** — no CI memory budget — add `valgrind --error-exitcode=1` to benchmark jobs, or `memray stats` to Python — **effort: M**
4. **AgilePlus clippy.toml** — add `borrowed_box`, `rc_buffer`, `redundant_allocation`, `box_default`, `large_types_passed_by_value` to enforce alloc hygiene — **effort: S**
5. **All Rust repos** — `bytes::Bytes` for high-throughput I/O paths (NATS bus, HTTP bodies, git packfile, sqlite blob) — **effort: M**
6. **Tracera Go** — add `GOMEMLIMIT=8GiB` env knob in `go.mod` README + add `net/http/pprof` endpoint behind a build tag — **effort: S**
7. **Tracely** — `pheno-logging-zig` crate directory exists but is empty (no `build.zig`, no `.zig` files) — either implement or remove — **effort: S**
8. **AgilePlus** — audit the 30 `Arc::new` sites in `agileplus-application/src/lib.rs` for `Arc::strong_count` cycles, document which are `Arc<RwLock<T>>` vs `Arc<AtomicXxx>` — **effort: M**
9. **thegent** — promote `tracemalloc` from tests to a `thegent-memprof` runtime hook with periodic snapshots saved to `~/.local/state/thegent/mem/` — **effort: M**
10. **All repos** — `Cow<'_, T>` adoption for paths that have borrowed-then-owned transitions (e.g. `agileplus-git`, `agileplus-sqlite` row serialization) — **effort: M**

## Recommendations

1. **Adopt `tikv-jemallocator` workspace-wide** via `[workspace.dependencies]` in each repo's `Cargo.toml`, then `#[global_allocator]` in each binary crate's `main.rs`. Effort: 1-2 tool calls per crate.
2. **Wire `dhat-heap` + `memray` into CI** as opt-in profile jobs (run weekly, not every commit). Effort: 1 workflow per repo.
3. **Add memory budget assertions** to the existing benchmark harnesses (`agileplus-benchmarks`, `thegent-benchmark`, `Tracera/justfile coverage`). Use `assert!` on `Instant::now() + RSS delta` or `memray stats --json` peak.
4. **Enforce zero-copy lints in `clippy.toml`**:
   ```toml
   disallowed-methods = [{ path = "std::borrow::Cow::Owned", reason = "prefer Cow::Borrowed when input is &str" }]
   # or use the cargo_clippy.toml lint table
   ```
5. **Tracely remediation**: implement `pheno-logging-zig` as a true FFI logging shim (compile a staticlib via `build.zig`), or remove the directory.
6. **Tracera Go**: add `net/http/pprof` import under `#[cfg(debug_assertions)]` build tag, set `GOMEMLIMIT` in process supervisor.
7. **AgilePlus audit**: run `cargo +nightly udeps` + `cargo machete` to find dead `Arc<Mutex<()>>` patterns; add a clippy lint group for `await_holding_lock`.
8. **Cross-repo**: promote `phenotype-memprof` shared crate that wraps `memray` (Python) and `dhat` (Rust) into a unified regression dashboard.

## Status summary

| Repo | L8 covered | L8 partial | L8 missing |
|---|---|---|---|
| AgilePlus | 7 (zero-copy call sites) | 3 (Arc-heavy, no clippy lint) | 8 (allocator, profiling, Bytes, Cow, CI budget) |
| thegent | 6 (tracemalloc tests, psutil, pyo3 with_gil) | 2 (test-only) | 4 (no memray, no production tracemalloc, no CI budget) |
| Tracely | 0 | 3 (no allocator declared) | 8 (every SOTA primitive missing) |
| Tracera | 1 (shared extraction) | 0 | 7 (no allocator, no GOMEMLIMIT, no pprof, no CI budget) |
| **Bloc** | **14** | **8** | **27** |
