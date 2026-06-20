# SOTA — cargo-nextest for Parallel Test Execution (side-08)

**Date:** 2026-06-20 10:40 UTC
**Task ID:** side-08
**Agent:** orch-v11-real-research-6
**Verdict:** **Adopt** fleet-wide. `cargo-nextest` is the de facto replacement for `cargo test` in serious Rust projects (2026). Direct drop-in for the `pheno` workspace.

## What it does
cargo-nextest runs each test in its own process, parallelising across cores and isolating panics so one failing test does not corrupt sibling test state. Adds:
- A richer reporter (per-test pass/fail list, slow-test flagging)
- Test retries (`--retries`) — re-run flaky tests up to N times before failing
- Process-per-test isolation by default
- A `nextest` profile in `.config/nextest.toml` for fleet-wide defaults

## Wiring
```toml
# .config/nextest.toml (workspace root)
[profile.default]
retries = 2
test-threads = "num-cpus"
slow-timeout = { period = "60s", terminate-after = 3 }
fail-fast = false
```

```bash
cargo install cargo-nextest --locked
cargo nextest run --workspace
```

## CI swap
Replace `cargo test --workspace --all-features` with `cargo nextest run --workspace --all-features` in every `.github/workflows/ci.yml`. Most repos already have the `dtolnay/rust-toolchain` step; the `cargo install cargo-nextest` step should be cached (`Swatinem/rust-cache@v2` handles this).

## Fleet relevance
- `pheno` workspace (17+ crates): current `cargo test` takes ~6 min on GHA. `cargo nextest` should drop it to ~3-4 min due to better parallel scheduling.
- `phenotype-journeys` / `phenotype-gateway` / `phenotype-port-adapter`: independent test binaries; nextest handles them as separate processes already.
- Single-crate dev repos: drop-in, no downside.

## Risk
- Tests that share state on disk (e.g., a `target/test.db` file) can break under process-per-test isolation. Audit findings recommend: keep all DB-using tests in a single integration test binary, or use `tempfile` + unique paths.
- `cargo test --doc` runs separately; `cargo nextest run --doc` is supported but needs the doc configuration in `nextest.toml`.

**Refs:** nextest docs https://nexte.st, pheno monorepo CI.
