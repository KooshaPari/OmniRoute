#!/usr/bin/env bash
# BytePort dual-stack coverage orchestrator.
#
# Runs BOTH the Rust and TS/JS coverage halves and exits 0 only
# if BOTH pass. Either side failing the gate (low coverage, test
# failure, threshold violation, missing tool, or timeout) makes
# the orchestrator exit non-zero.
#
# The L3 #44 spec calls for one script that owns the dual-stack
# gate. The two halves stay independently runnable
# (`bash coverage-rust.sh`, `bash coverage-ts.sh`) for fast
# inner-loop developer feedback; this script is the CI / pre-merge
# surface.
#
# Exit codes (mirrored by the halves):
#   0  both halves pass
#   1  at least one half failed
#   2  required tool missing (cargo or npx)
#   3  network/resolver timeout (caller should mark not_run)
#
# Side artifacts (on success):
#   BytePort/coverage-rust.lcov          (cargo llvm-cov LCOV)
#   BytePort/coverage-ts/lcov.info       (jest LCOV)
#   BytePort/coverage-ts/index.html      (jest HTML report)
#   BytePort/target/llvm-cov/            (cargo llvm-cov HTML, if used)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BYTEPORT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BYTEPORT_DIR}"

# Pretty banner for human readers; the orchestrator's caller can
# still parse the exit code to know which side failed.
banner() {
    echo
    echo "================================================================"
    echo "  $1"
    echo "================================================================"
}

# Track per-side status so we can summarize at the end. We always
# run BOTH halves even if the first fails -- a partial-coverage
# report is more useful than no report at all when triaging.
rust_status="not_run"
ts_status="not_run"

# ---- Rust side ----------------------------------------------------------
banner "BytePort dual-stack coverage :: Rust half (cargo llvm-cov)"

set +e
bash "${SCRIPT_DIR}/coverage-rust.sh"
rust_rc=$?
set -e

case "${rust_rc}" in
    0) rust_status="pass" ;;
    2) rust_status="missing_tool:cargo-llvm-cov" ;;
    3) rust_status="timeout" ;;
    *) rust_status="fail" ;;
esac

echo "[coverage.sh] rust half: ${rust_status} (rc=${rust_rc})"

# ---- TS side ------------------------------------------------------------
banner "BytePort dual-stack coverage :: TS half (npx jest --coverage)"

set +e
bash "${SCRIPT_DIR}/coverage-ts.sh"
ts_rc=$?
set -e

case "${ts_rc}" in
    0) ts_status="pass" ;;
    2) ts_status="missing_tool:npx" ;;
    3) ts_status="timeout" ;;
    *) ts_status="fail" ;;
esac

echo "[coverage.sh] ts half: ${ts_status} (rc=${ts_rc})"

# ---- Summary ------------------------------------------------------------
banner "BytePort dual-stack coverage :: summary"
echo "  rust: ${rust_status} (rc=${rust_rc})"
echo "  ts:   ${ts_status} (rc=${ts_rc})"

# Exit 0 only if both halves are `pass`. Any other combination
# (fail / missing_tool / timeout) fails the gate.
if [ "${rust_status}" = "pass" ] && [ "${ts_status}" = "pass" ]; then
    echo "  result: PASS"
    exit 0
else
    echo "  result: FAIL (see per-half rc above)"
    exit 1
fi
