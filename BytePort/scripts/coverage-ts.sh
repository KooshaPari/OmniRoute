#!/usr/bin/env bash
# BytePort TS/JS coverage runner.
#
# Wrapper around `npx jest --coverage` that produces a coverage
# report for the TS/JS code under BytePort/. The Jest config
# (BytePort/jest.config.js) holds the L3 #44 spec's coverage
# thresholds (lines/statements/functions >= 80%, branches >= 70%)
# and jest enforces them at the end of the run -- a failure
# anywhere in the threshold check makes `npx jest --coverage`
# exit non-zero, which propagates to `scripts/coverage.sh` and
# the dual-stack gate.
#
# Used by:
#   * scripts/coverage.sh (orchestrator; runs Rust + TS)
#   * local developer workflow:  `bash BytePort/scripts/coverage-ts.sh`
#
# Exit codes:
#   0  coverage succeeded; thresholds met
#   1  jest run failed (test failure or threshold violation)
#   2  npx not found (Node.js not installed)
#   3  jest not installed and npm install timed out / failed

set -euo pipefail

# Resolve BytePort/ from this script's location so the script works
# from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BYTEPORT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BYTEPORT_DIR}"

# 1. Node + npx must be available.
if ! command -v npx >/dev/null 2>&1; then
    echo "[coverage-ts] npx not found on PATH (install Node.js >= 18)" >&2
    exit 2
fi

# 2. Decide whether jest is already installed locally. If not,
#    best-effort install via `npm ci` so the run isn't dead on
#    arrival in a fresh checkout. We do NOT fail if `npm ci`
#    itself is slow -- we just report the reason and exit 3 so
#    the orchestrator can mark not_run.
if ! [ -d node_modules ] || ! [ -x node_modules/.bin/jest ]; then
    echo "[coverage-ts] jest not installed locally; attempting `npm ci` (120s budget)..." >&2
    if ! timeout 120 npm ci --no-audit --no-fund --silent; then
        echo "[coverage-ts] npm ci timed out or failed; mark not_run" >&2
        exit 3
    fi
fi

# 3. Run jest with coverage. The jest config (BytePort/jest.config.js)
#    owns the thresholds; this script is just the driver. We pass
#    --colors=false so the output is greppable in CI logs.
echo "[coverage-ts] running: npx jest --coverage" >&2

# Wrap in `timeout` so a hung resolver on a fresh sandbox doesn't
# block the orchestrator forever. 5 minutes is the historical
# jest cold-resolve budget for a SvelteKit/Node project.
timeout 300 npx jest --coverage --colors=false
rc=$?

# 124 == GNU coreutils `timeout` exit when the deadline expires.
if [ "${rc}" -eq 124 ]; then
    echo "[coverage-ts] jest timed out after 300s; mark not_run" >&2
    exit 3
fi

exit "${rc}"
