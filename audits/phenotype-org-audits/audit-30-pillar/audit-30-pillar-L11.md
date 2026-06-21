# L11 — Test coverage & quality gates

**Owner:** forge-A06
**Generated:** 2026-06-16
**Scope:** 4-repo bloc (AgilePlus, thegent, Tracely, Tracera)

## Scope

Verify that each bloc repo has (1) coverage tooling wired into CI, (2) a coverage gate enforced on PRs, (3) mutation testing, (4) property-based testing, (5) fuzz testing, (6) snapshot tests, and (7) an explicit unit-vs-integration test split.

## SOTA 2026

- **Coverage tooling (Rust):** `cargo-llvm-cov` is the 2025+ SOTA. `cargo-tarpaulin` is acceptable but slower and Linux-only. (Reference: `dtolnay/rust-toolchain` + `taiki-e/install-action` + `cargo llvm-cov` — the canonical trio.)
- **Coverage tooling (Python):** `pytest-cov` + `coverage.py` v7 with `--cov-fail-under` and branch coverage enabled.
- **Coverage tooling (TypeScript):** `jest --coverage` with `coverageThreshold` on branches/functions/lines/statements.
- **Mutation testing (Rust):** `cargo-mutants` is the active 2026 tool (`mutagen` deprecated; `mutest` experimental). Target: ≥75% mutation score on critical crates.
- **Property-based (Rust):** `proptest` is dominant. `quickcheck` is acceptable but less ergonomic.
- **Property-based (Python):** `hypothesis` 6.x with `@given` + `HealthCheck` suppressions.
- **Fuzz (Rust):** `cargo-fuzz` with `libfuzzer-sys`. AFL++ is acceptable but harder to wire.
- **Fuzz (Python):** `atheris` (libFuzzer bindings).
- **Snapshot:** `insta` (Rust), `syrupy`/`pytest-snapshot` (Python).
- **Gates:** PR must fail if `coverage < target - threshold`. Patch coverage also enforced (Codecov `patch: target: 85%`).

## Phenotype state

### AgilePlus (`AgilePlus/Cargo.toml`, `AgilePlus/.github/workflows/ci.yml`, `AgilePlus/codecov.yml`)

- **Coverage tooling:** ✓ `cargo-tarpaulin` at `ci.yml:179-184` (`cargo install cargo-tarpaulin` → `cargo tarpaulin --workspace --out xml` → upload to Codecov). Codecov upload at `ci.yml:183` with `fail_ci_if_error: false` — **softens the gate**, not strict.
- **Coverage gate (Codecov):** ✓ `codecov.yml:1-23` declares `target: 80%` + `threshold: 1%` for 3 crates: `agileplus-cli`, `agileplus-sqlite`, `agileplus-trace-validator` (lines 7-19). **33 other crates have no per-crate coverage target** — major gap. Project status `patch:` not declared (no patch-coverage gate).
- **Mutation testing:** ✗ **absent.** No `cargo-mutants` / `mutagen` config or workflow.
- **Property-based:** ✗ **absent.** No `proptest` / `quickcheck` dev-dep. (Searched all `AgilePlus/crates/*/Cargo.toml` — zero hits for `proptest::`, `quickcheck`, `proptest`.)
- **Fuzz:** ✗ **absent.** No `AgilePlus/fuzz/` dir; no `cargo-fuzz` workspace member; no fuzz workflow.
- **Snapshot:** △ `cucumber = "0.23"` at `Cargo.toml:135` for BDD feature files, but no `insta` snapshot tests.
- **Unit/integration split:** △ Integration tests in `AgilePlus/crates/agileplus-integration-tests/` (dedicated crate) and `agileplus-contract-tests/`. Per-crate `#[cfg(test)]` modules exist (verified by `tests/` dir search). No explicit ratio mandate.
- **Test deps in workspace `Cargo.toml:134-136`:** `axum-test = "20.1.0"`, `cucumber = "0.23"`. Limited.

### thegent (`thegent/codecov.yml`, `thegent/pyproject.toml`, `thegent/crates/*/Cargo.toml`)

- **Coverage tooling:** ✓ **Robust Python stack.** `pyproject.toml:131` `pytest-cov>=6.0.0`; `:95,133,146,193` `hypothesis>=6.140.0` / `6.151.4`; `:97` `pytest-benchmark`; `:96` `pytest-xdist`; `:94` `pytest-mock`. **Coverage gate is configured in Codecov but NOT enforced in CI** (no `coverage` job in `thegent/.github/workflows/ci.yml` — the `backup/coverage.yml` file is dormant).
- **Coverage gate (Codecov):** ✓ `thegent/codecov.yml:1-72` — `project.default.target: 85%`, `patch.default.target: 85%`, `threshold: 2%`, `if_ci_failed: error`, `only_pulls: true` for patch. **Strong config** — one of the better Codecov setups in the bloc.
- **Property-based:** ✓ **Hypothesis present** (pyproject dev-deps line 95: `hypothesis>=6.140.0`). ✓ `proptest = "1.4"` at `thegent/crates/thegent-plugin-host/Cargo.toml:45`. ✓ `criterion = "0.5"` at `thegent/crates/thegent-router/Cargo.toml:23` (benchmarks).
- **Mutation testing:** △ `test_mutation_perf_pilot.py` exists (Python file) — likely a pilot study, not a wired gate.
- **Fuzz:** ✗ **absent.** No `thegent/fuzz/` dir; no `cargo-fuzz` member; no fuzz workflow.
- **Snapshot:** △ `test_session_snapshot_cli_helpers*.py` files exist (multiple variants, batch5-10) — likely pytest snapshots or custom, not `syrupy`/`pytest-snapshot`.
- **Unit/integration split:** ✓ **Excellent** — top-level `thegent/tests/` has unit/, integration/, e2e/, bdd/, perf/, chaos/, a11y/, security/, governance/ subdirs. ~400+ `test_*.py` files total. Per-crate `tests/` dirs verified: `thegent-memory`, `thegent-hooks`, `thegent-jsonl`, `thegent-shims`, `thegent-router`, `thegent-policy`, `thegent-zmx`, `thegent-swe-runner`, `thegent-plugin-host`, `thegent-tree-of-thoughts`, `thegent-dspy`. Hysteresis + phase-3 integration tests: `crates/thegent-runtime/tests/{hysteresis_tests.rs, phase3_integration_tests.rs, python_ffi_tests.rs, router_hysteresis_tests.rs}`.
- **Mocking:** ✓ `mockall = "0.12"` at `thegent/crates/thegent-plugin-host/Cargo.toml:44`.

### Tracely (`Tracely/crates/*/Cargo.toml`, `Tracely/justfile`, `Tracely/.github/workflows/ci.yml`)

- **Coverage tooling:** △ `Tracely/justfile:15-17` `coverage: cargo tarpaulin --workspace` (local only). `Tracely/.github/workflows/ci.yml:23` passes `enable-coverage: true` to the reusable `KooshaPari/template-commons/.github/workflows/reusable-rust-ci.yml@main` — but the upstream is tag-pinned, so the actual coverage tool used is opaque.
- **Coverage gate:** ✗ **No Codecov config** (`Tracely/codecov.yml` and `Tracely/.codecov.yml` do not exist). The `enable-coverage: true` flag is unverified.
- **Property-based:** ✗ **absent.** No `proptest` / `quickcheck` in any `Tracely/crates/*/Cargo.toml`.
- **Fuzz:** △ **Half-wired.** `Tracely/crates/tracely-sentinel/fuzz/Cargo.toml` exists with `libfuzzer-sys = "0.4"`, but `Tracely/crates/tracely-sentinel/fuzz/fuzz_targets/` is empty — no `*.rs` fuzz targets committed. No CI job runs `cargo fuzz run all`.
- **Snapshot:** ✗ **absent.** No `insta` / `trycmd`.
- **Mutation testing:** ✗ **absent.**
- **Benchmark:** ✓ `criterion = { version = "0.5", features = ["html_reports"] }` at `Tracely/crates/tracely-core/Cargo.toml:31`. `Tracely/crates/tracely-sentinel/benches/perf.rs` exists.
- **Unit/integration split:** △ `Tracely/crates/tracely-sentinel/tests/bdd/steps.rs` is BDD; no explicit integration-tests crate.
- **Misc:** `criterion` configured for tracely-core; `tracely-sentinel` has both unit tests (per source file) and `benches/perf.rs` + `tests/bdd/steps.rs`.

### Tracera (`Tracera/justfile`, `Tracera/pyproject.toml`, `Tracera/.github/workflows/rust-tests.yml`, `Tracera/jest.config.ts`)

- **Coverage tooling:** ✓ **Best in bloc.** `Tracera/justfile:67-80` declares stack-detected coverage with hard gates:
  - Rust: `cargo llvm-cov --workspace --fail-under-lines 85` (line 73) — **SOTA-grade** (uses llvm-cov, not tarpaulin).
  - JS/TS: `npx jest --coverage --coverageThreshold='{"global":{"branches":85,"functions":85,"lines":85,"statements":85}}'` (line 75) — strict 4-axis gate.
  - Python: `pytest --cov=src --cov-report=term-missing --cov-fail-under 85` (line 77) — 85% line coverage with branch via `term-missing`.
  - Go: `go tool cover -func` piped to awk gate (line 79) — 85% minimum.
- **Coverage gate in CI:** ✗ **Manual/local only.** `rust-tests.yml` runs `cargo hack test --workspace --each-feature --no-dev-deps` (line 35) — **no coverage invocation** in any CI workflow. `python-ci.yml` only installs pyright. `governance-gates.yml` runs `actions/checkout` 3× but no test/coverage step.
- **Property-based:** ✓ **Hypothesis present** in `pyproject.toml:95,133,146,193` (4 separate `hypothesis>=6.151.4` declarations). ✓ `proptest.workspace = true` at `Tracera/crates/tracera-core/Cargo.toml:33` — SOTA-grade.
- **Fuzz:** ✗ **absent.** No fuzz targets in any Tracera crate.
- **Mutation testing:** ✗ **absent.** No `cargo-mutants` / `mutmut`.
- **Snapshot:** △ `Tracera/jest.config.ts:14` `testMatch: ['**/*.test.ts', '**/*.spec.ts']` — TS test discovery only, no `insta`/jest-snapshot config.
- **Unit/integration split:** △ `Tracera/tests/` (top-level) has hysteresis, phase3, python_ffi, router_hysteresis integration tests. Frontend uses jest's default split.
- **Feature matrix testing:** ✓ `Tracera/.github/workflows/rust-tests.yml:35` `cargo hack test --workspace --each-feature --no-dev-deps` — **SOTA-grade** feature combination coverage.
- **Python test infra:** ✓ `pyproject.toml:91-97,126-136` — `pytest>=9.0.2`, `pytest-asyncio`, `pytest-cov`, `pytest-mock`, `pytest-xdist`, `pytest-benchmark`, `hypothesis`. `testcontainers[neo4j]>=4.10.0` for DB-integration tests.

## Gaps

| # | Where | Issue | Effort |
|---|-------|-------|--------|
| 1 | `AgilePlus/codecov.yml` | 33/36 crates have no per-crate target; only 3 (`agileplus-cli`, `agileplus-sqlite`, `agileplus-trace-validator`) are gated. Add a default `default: target: 80%` block. | S |
| 2 | `AgilePlus/.github/workflows/ci.yml:183` | `fail_ci_if_error: false` on Codecov upload — coverage is informational, not gating. Change to `true` or add a separate `coverage-gate` job. | S |
| 3 | `AgilePlus/` bloc-wide | No `cargo-mutants`, no `proptest`, no `insta`, no `cargo-fuzz`. **0/4 of the SOTA test categories present.** | L (effort = M per category, 4 categories) |
| 4 | `AgilePlus/Cargo.toml:134-136` | Test dev-deps are minimal: only `axum-test` + `cucumber`. Add `proptest.workspace = true`, `insta = { version = "1.40", features = ["yaml"] }`, `cargo-mutants` to `[dev-dependencies]`. | M |
| 5 | `thegent/.github/workflows/ci.yml:16` | The active CI workflow is a broken stub (also L10 gap #1). No `coverage` job in active workflows — `backup/coverage.yml` is dormant. Either delete the backup or wire it via `workflow_call:`. | S |
| 6 | `thegent/crates/*` (Rust) | No fuzz targets. With 40 Rust crates exposed to external input (plugin-host, parser, jsonl, fs, swe-runner), fuzzing is the highest-leverage gap. Add `thegent-fuzz` workspace member with at least one target per parser. | L |
| 7 | `thegent/test_mutation_perf_pilot.py` | Pilot file exists; not wired as a CI gate. Wire `mutmut` (Python) into a `mutation` workflow. | M |
| 8 | `Tracely/codecov.yml` | Does not exist. Add one with `project.default.target: 80%` and `patch.default.target: 80%`. | S |
| 9 | `Tracely/crates/tracely-sentinel/fuzz/fuzz_targets/` | Empty. Add fuzz targets for `bulkhead`, `circuit_breaker`, `rate_limiter`, `validation` modules (4 files in `src/`). | M |
| 10 | `Tracely/.github/workflows/ci.yml` | `enable-coverage: true` is unverified because the upstream `KooshaPari/template-commons` reusable is tag-pinned (`@main`). Either verify the coverage tool used and add a Codecov config, or fork the workflow. | M |
| 11 | `Tracely/` bloc-wide | No `proptest` / `quickcheck` / `cargo-mutants` / `insta`. **0/4 SOTA test categories present.** | L |
| 12 | `Tracera/.github/workflows/rust-tests.yml:35` | Runs `cargo hack test --each-feature` but does **not** invoke `cargo llvm-cov` despite `justfile:73` declaring `--fail-under-lines 85`. Wire the justfile target into CI. | S |
| 13 | `Tracera/.github/workflows/python-ci.yml` | No pytest invocation, no `--cov-fail-under`. Add `uv run pytest --cov --cov-fail-under=85`. | S |
| 14 | `Tracera/.github/workflows/governance-gates.yml` | 3 `actions/checkout` jobs but no test step. Add a test job that runs `just test` + `just coverage`. | S |
| 15 | `Tracera/jest.config.ts:14-17` | No `coverageThreshold` declared in the config file. Move the threshold from `justfile:75` into `jest.config.ts.collectCoverage` so the gate is enforced in CI without depending on justfile. | S |
| 16 | `Tracera/crates/tracera-core` | No fuzz targets despite proptest presence. Add at least one `cargo-fuzz` target to validate the property-test inputs survive mutation. | M |
| 17 | `Tracera/` bloc-wide | No `cargo-mutants` / `mutmut`. Tracera is the only repo with hypothesis + proptest, so it is the lowest-friction place to add mutation testing. | M |

## Summary

| Repo | Coverage tool | Coverage gate | Mutation | Property | Fuzz | Snapshot | Unit/Integration |
|------|:-------------:|:-------------:|:--------:|:--------:|:----:|:--------:|:----------------:|
| AgilePlus | ✓ tarpaulin | △ 3/36 crates, soft fail | ✗ | ✗ | ✗ | △ (cucumber only) | △ |
| thegent | ✓ pytest-cov (Python) | △ Codecov config exists, no CI job | △ pilot | ✓ hypothesis + proptest | ✗ | △ custom | ✓ excellent split |
| Tracely | △ tarpaulin (local), opaque via reusable | ✗ no codecov | ✗ | ✗ | △ stub crate, no targets | ✗ | △ |
| Tracera | ✓ llvm-cov (SOTA) | ✗ justfile only, no CI | ✗ | ✓ hypothesis + proptest | ✗ | △ jest match | △ |

**Overall L11 status: PARTIAL** — Tracera has the best-defined coverage strategy (justfile gates at 85% across 4 stacks) but it isn't enforced in CI. thegent has the best unit/integration test split and property-based testing, but its active CI workflow is a stub. AgilePlus and Tracely are missing 3-4 of the 6 SOTA categories.

**Strongest axis:** Property-based testing (2/4 repos).
**Weakest axis:** Mutation testing (0/4 repos) and fuzz testing (1/4 repos with stub).

## Recommendations

1. **Day-1 (Tracera):** wire `just coverage` into `rust-tests.yml` and `python-ci.yml` so the 85% llvm-cov and pytest-cov gates are actually enforced. The justfile already has the gate logic — only the CI invocation is missing. Effort: S.
2. **Day-1 (thegent):** fix or replace the broken `ci.yml` stub (L10 gap #1) and add a `coverage` job that runs `pytest --cov-fail-under=85 --cov-branch`. Move the dormant `backup/coverage.yml` content into the active workflow. Effort: M.
3. **Day-1 (Tracely):** add a `Tracely/codecov.yml` and commit fuzz targets for the 4 input-parsing modules in `tracely-sentinel/src/` (`bulkhead.rs`, `circuit_breaker.rs`, `rate_limiter.rs`, `validation.rs`). Effort: M.
4. **Day-2 (cross-repo, mutation):** introduce `cargo-mutants` in `AgilePlus` (start with `agileplus-graph` — the highest-leverage crate) and `Tracely` (`tracely-sentinel` circuit-breaker logic). Add a `mutation` workflow that runs weekly on `main`. Effort: M.
5. **Day-2 (AgilePlus coverage breadth):** add a default `target: 80%` to `codecov.yml` so the 33 un-gated crates get coverage tracking. Keep the 3 explicit per-crate targets. Effort: S.
6. **Day-3 (cross-repo, fuzz):** create a shared `thegent-fuzz` workspace member with targets for `thegent-parser`, `thegent-jsonl`, `thegent-fs`, `thegent-plugin-host` (4 highest-surface-area crates). Mirror with `AgilePlus/fuzz/` for the 8 crates that parse external input (`agileplus-graph`, `agileplus-triage`, `agileplus-import`, `agileplus-validate`, `agileplus-pipeline`, `agileplus-factory`, `agileplus-refinery`, `agileplus-witness`). Effort: L.
7. **Day-3 (cross-repo, snapshot):** add `insta` to the workspace `[dev-dependencies]` of AgilePlus and Tracely; add `pytest-snapshot` to thegent dev-deps. These are 1-line adds with outsized stability benefits. Effort: S.
