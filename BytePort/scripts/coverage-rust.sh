#!/usr/bin/env bash
# BytePort Rust coverage runner.
#
# Wrapper around `cargo llvm-cov` that produces an LCOV report for the
# BytePort workspace (members: tools/cli, frontend/web/src-tauri).
# The LCOV output is written to `BytePort/coverage-rust.lcov` so it
# can be uploaded to Codecov / Coveralls in CI.
#
# Used by:
#   * scripts/coverage.sh (orchestrator; runs Rust + TS)
#   * local developer workflow:  `bash BytePort/scripts/coverage-rust.sh`
#
# Exit codes:
#   0  coverage succeeded (all targets built and tests passed; LCOV
#      file written to coverage-rust.lcov)
#   1  cargo build / test failed
#   2  cargo llvm-cov not installed (install with
#      `cargo install cargo-llvm-cov --locked`)
#   3  network/resolver timeout (caller should mark not_run)

set -euo pipefail

# Resolve BytePort/ from this script's location so the script works
# from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BYTEPORT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BYTEPORT_DIR}"

# 1. cargo must be available.
if ! command -v cargo >/dev/null 2>&1; then
    echo "[coverage-rust] cargo not found on PATH" >&2
    exit 1
fi

# 2. cargo-llvm-cov must be installed.
if ! cargo llvm-cov --version >/dev/null 2>&1; then
    echo "[coverage-rust] cargo-llvm-cov not installed; install with: cargo install cargo-llvm-cov --locked" >&2
    exit 2
fi

# 3. Run the coverage suite. --workspace covers both members
#    (tools/cli and frontend/web/src-tauri). --lcov writes the
#    LCOV report. Branch coverage is enabled by default in
#    cargo-llvm-cov 0.6+ via the LLVM source-based coverage
#    profile that the .cargo/config.toml sets up.
#
#    We deliberately do NOT pass --no-fail-fast: a failing test
#    should fail the coverage gate (otherwise the LCOV report
#    would still be written but the gate would silently pass).
echo "[coverage-rust] running: cargo llvm-cov --workspace --lcov --output-path coverage-rust.lcov" >&2

# Wrap in `timeout` so a hung resolver on a fresh sandbox doesn't
# block the orchestrator forever. 10 minutes is the historical
# cargo-llvm-cov cold-resolve budget for the BytePort workspace
# (OpenTelemetry + Tauri transitive tree on first run).
timeout 600 cargo llvm-cov --workspace --lcov --output-path coverage-rust.lcov
rc=$?

# 124 == GNU coreutils `timeout` exit when the deadline expires.
if [ "${rc}" -eq 124 ]; then
    echo "[coverage-rust] cargo llvm-cov timed out after 600s; mark not_run" >&2
    exit 3
fi

exit "${rc}"
