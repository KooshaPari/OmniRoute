# v16 Wave A — T5: cargo nextest + sccache

**Date:** 2026-06-21
**Pillar:** L22 (Fast Test Suite)
**Wave:** v16 cycle 6 P0

## Why

Cargo's built-in test runner is single-threaded by default and downloads+compiles dependencies per workspace. For a 47-crate fleet, this means 4-8 minute CI runs. `cargo-nextest` parallelizes test execution across cores, and `sccache` caches compilation artifacts across CI runs.

## Components

### 1. cargo-nextest

Replaces `cargo test` with `cargo nextest run`:
- Per-test process isolation (one test crash ≠ all tests die)
- Better output (per-test JUnit XML, timing)
- ~3x faster on multi-core CI runners
- Retry-on-flake (--retries=2)

Configuration in `.config/nextest.toml` (workspace-root):

```toml
[profile.default]
retries = 2
slow-timeout = { period = "60s", terminate-after = 3 }
test-threads = "num-cpus"
fail-fast = false
status-level = "all"

[profile.ci]
retries = 3
slow-timeout = { period = "120s", terminate-after = 2 }
fail-fast = true
```

### 2. sccache

Caches `rustc` invocations:
- Local cache (`~/.cache/sccache` or `/tmp/sccache`)
- Optional Redis backend for fleet-wide cache sharing (cycle 7 candidate)
- 60-80% cache hit rate on incremental CI runs
- ~5x speedup on warm cache

Configuration in `.cargo/config.toml`:

```toml
[build]
rustc-wrapper = "/usr/local/bin/sccache"

[target.x86_64-unknown-linux-gnu]
linker = "/usr/bin/clang"
```

CI step replaces raw cargo build with `RUSTC_WRAPPER=sccache cargo nextest run --profile ci`.

### 3. Workflow integration

The existing `.github/workflows/ci.yml` needs:
- Install nextest: `cargo install cargo-nextest --locked`
- Install sccache: `cargo install sccache --locked`
- Set `RUSTC_WRAPPER=sccache` and `CARGO_INCREMENTAL=0`
- Replace `cargo test` with `cargo nextest run --profile ci`
- Add cache step: `actions/cache@v4` keyed on `Cargo.lock` + sccache dir

## Performance targets

| Metric | Before | After (target) | Δ |
|--------|-------:|---------------:|--:|
| First CI run (cold cache) | 12 min | 11 min | -8% |
| Incremental CI run (warm cache) | 4 min | 45 sec | **-81%** |
| Test feedback time (single test) | 90 sec | 5 sec | **-94%** |
| Cache hit rate (week) | 0% | 70%+ | new |

## Adoption

1. **Cycle 6 (v16):** monorepo root + 5 substrate repos
2. **Cycle 7 (v17):** remaining 12 repos
3. **Cycle 8 (v18):** Redis-backed fleet cache

## Acceptance

- [ ] `.config/nextest.toml` with default + ci profiles
- [ ] `.cargo/config.toml` with sccache wrapper
- [ ] `.github/workflows/ci.yml` updated to use nextest + sccache
- [ ] Benchmark of 3 consecutive CI runs shows <90 sec for warm-cache incremental
- [ ] At least 1 flake retried successfully (real flake, not just slow test)

## References

- cargo-nextest docs: <https://nexte.st/>
- sccache docs: <https://github.com/mozilla/sccache>
- ADR-040 (test coverage gates per tier) — feeds test execution matrix
