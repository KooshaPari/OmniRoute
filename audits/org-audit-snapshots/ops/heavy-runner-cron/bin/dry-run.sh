#!/usr/bin/env bash
# dry-run.sh — manually exercise the 3-tool suite without installing cron.
#
# Runs the same tools in the same order as run-with-flock.sh, but:
#   - does NOT acquire the flock (safe to run while a real cron is mid-run)
#   - does NOT redirect to per-run log files (prints to stdout in real time)
#   - does NOT modify any crontab
#
# Use this to:
#   - validate the bundle after upgrading any of the 3 tools
#   - debug a failing weekly run by replaying it interactively
#   - give a new operator a sanity check before install-cron.sh
#
# Exit codes: same as run-with-flock.sh (0/1/2).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# source= directive is the documented form; shellcheck's relative-path
# resolver still emits info-level "Not following" noise on this version.
# The source succeeds at runtime (verified via bash -n + --help + --dry-run).
# shellcheck disable=SC1091
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

FLEET_ROOT="${HEAVY_RUNNER_FLEET_ROOT:-$HOME/code/phenotype-fleet}"

require_cmd pheno-predict
require_cmd pheno-framework-lint
require_cmd pheno-drift-detector

log "=== dry-run.sh start (fleet_root=$FLEET_ROOT; no flock, no log redirect) ==="

declare -a TOOL_RC=()

run_tool() {
  local name="$1"; shift
  log "starting $name (stdout follows)"
  local rc=0
  if "$@"; then
    rc=0
  else
    rc=$?
  fi
  TOOL_RC+=("$rc")
  if [[ $rc -eq 0 ]]; then
    log "$name OK"
  else
    err "$name FAILED (rc=$rc)"
  fi
}

# pheno-framework-lint uses `check-all`, not `scan` — see
# pheno-framework-lint/pheno_framework_lint.py:455-469 (argparse
# subcommands are `check` + `check-all`).
run_tool pheno-predict        pheno-predict           scan --target "$FLEET_ROOT" --format md
run_tool pheno-framework-lint pheno-framework-lint    check-all --root "$FLEET_ROOT"
run_tool pheno-drift-detector pheno-drift-detector    scan --root "$FLEET_ROOT" --format md

ANY_FAIL=0
for rc in "${TOOL_RC[@]}"; do
  if [[ "$rc" -ne 0 ]]; then
    ANY_FAIL=1
    break
  fi
done

if [[ $ANY_FAIL -eq 0 ]]; then
  log "=== dry-run.sh OK (all 3 tools) ==="
  exit 0
else
  err "=== dry-run.sh FAILED (rcs=${TOOL_RC[*]}) ==="
  exit 1
fi
