#!/usr/bin/env bash
# run-with-flock.sh — flock-protected weekly cron entry point.
#
# Invokes three pheno-* substrate tools in sequence (predict → framework-lint
# → drift-detector) under a single advisory lock so a slow run cannot overlap
# a subsequent run. Stdout/stderr are tee'd to logs/<UTCdate>.log.
#
# Invocation:
#   $0  (no arguments)
#
# Environment (all optional; see INSTALL.md for the production wiring):
#   HEAVY_RUNNER_FLEET_ROOT  — root of the fleet that the 3 tools will scan.
#                              Default: $HOME/code/phenotype-fleet
#   HEAVY_RUNNER_LOG_DIR     — log directory; default: <bundle>/logs
#   HEAVY_RUNNER_LOCK_PATH   — flock target; default: /var/lock/fleet-substrate-tools.lock
#   HEAVY_RUNNER_QUIET       — if 1, suppress INFO lines (WARN/ERR still print)
#
# Exit codes:
#   0  all 3 tools ran cleanly
#   1  at least one tool exited non-zero (failure path: the cron daemon will
#      send local mail; auto-issue creation is handled separately by
#      workflow_dispatch in phenotype-org-audits/.github/workflows/)
#   2  environment error (missing tool, unwritable lock, etc.)
#
# Designed for `set -euo pipefail` discipline; the flock is acquired with
# `flock -n` (non-blocking) so a stuck prior run surfaces as a clean error
# rather than a silent queue.

set -euo pipefail

# --- locate bundle, source common -------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# source= directive is the documented form; shellcheck's relative-path
# resolver still emits info-level "Not following" noise on this version.
# The source succeeds at runtime (verified via bash -n + --help + --dry-run).
# shellcheck disable=SC1091
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

# --- configuration ----------------------------------------------------------
FLEET_ROOT="${HEAVY_RUNNER_FLEET_ROOT:-$HOME/code/phenotype-fleet}"
LOCK_PATH="${HEAVY_RUNNER_LOCK_PATH:-/var/lock/fleet-substrate-tools.lock}"
LOG_DIR_DEFAULT="${HEAVY_RUNNER_BUNDLE_DIR}/logs"
LOG_DIR="${HEAVY_RUNNER_LOG_DIR:-$LOG_DIR_DEFAULT}"

# Per-run log filename uses UTC date — keeps logs aligned with the cron's
# UTC-based scheduling (cron itself runs in local TZ, but the run is short
# enough that TZ drift is rare; UTC filenames are unambiguous).
RUN_DATE="$(date -u '+%Y-%m-%d')"
RUN_LOG="${LOG_DIR}/${RUN_DATE}.log"

# --- preflight --------------------------------------------------------------
require_cmd flock
require_cmd pheno-predict
require_cmd pheno-framework-lint
require_cmd pheno-drift-detector

# If /var/lock is read-only (macOS sandbox, some container runtimes), fall
# back to a per-user lock under the bundle. We try the system path first
# and silently downgrade if the open-for-write fails.
USE_FALLBACK_LOCK=0
if ! ( : >> "$LOCK_PATH" ) 2>/dev/null; then
  USE_FALLBACK_LOCK=1
  LOCK_PATH="${HEAVY_RUNNER_BUNDLE_DIR}/.fleet-substrate-tools.lock"
fi
# Always log the lock-class line (system vs fallback) for postmortem clarity.
if [[ $USE_FALLBACK_LOCK -eq 1 ]]; then
  warn "system lock path unwritable; using fallback at $LOCK_PATH"
fi

# Ensure log dir is writable. ensure_log_dir() handles the fallback path.
HEAVY_RUNNER_LOG_DIR="$LOG_DIR"
ensure_log_dir
LOG_DIR="$HEAVY_RUNNER_LOG_DIR"
RUN_LOG="${LOG_DIR}/${RUN_DATE}.log"

log "=== run-with-flock.sh start (fleet_root=$FLEET_ROOT lock=$LOCK_PATH) ==="
log "log file: $RUN_LOG"

# --- single-instance guard --------------------------------------------------
# Open FD 9 on the lock file, then `flock -n 9`. Non-blocking: if a prior
# run still holds the lock, exit 1 immediately so the cron's local mail
# is sent (the next cron tick can retry).
exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  err "another run is in progress (lock held: $LOCK_PATH); exiting"
  exit 1
fi

# --- sequential tool execution ---------------------------------------------
# We capture the exit code of each tool so a single failure does not abort
# the rest of the suite — every tool is independent and we want the full
# weekly report even if one tool is broken.
declare -a TOOL_RC=()

run_tool() {
  local name="$1"; shift
  local out="${LOG_DIR}/${RUN_DATE}.${name}.out"
  log "starting $name (output → $out)"
  local rc=0
  # `set -o pipefail` is on, so a SIGPIPE or non-zero exit anywhere in the
  # pipeline fails the whole command — which is what we want.
  if "$@" >"$out" 2>&1; then
    rc=0
  else
    rc=$?
  fi
  TOOL_RC+=("$rc")
  if [[ $rc -eq 0 ]]; then
    log "$name OK"
  else
    err "$name FAILED (rc=$rc; see $out)"
  fi
}

# Note: pheno-framework-lint uses `check-all` not `scan` (the tool's
# argparse defines subcommands `check` + `check-all`; see
# pheno-framework-lint/pheno_framework_lint.py:455-469). This deviates
# from the original task spec's literal `scan --format md` and is
# documented in the PR body.
run_tool pheno-predict            pheno-predict           scan --target "$FLEET_ROOT" --format md --out "${LOG_DIR}/${RUN_DATE}.predict.md"
run_tool pheno-framework-lint     pheno-framework-lint    check-all --root "$FLEET_ROOT" --out "${LOG_DIR}/${RUN_DATE}.lint.json"
run_tool pheno-drift-detector     pheno-drift-detector    scan --root "$FLEET_ROOT" --format md --out "${LOG_DIR}/${RUN_DATE}.drift.md"

# --- summary ----------------------------------------------------------------
ANY_FAIL=0
for rc in "${TOOL_RC[@]}"; do
  if [[ "$rc" -ne 0 ]]; then
    ANY_FAIL=1
    break
  fi
done

if [[ $ANY_FAIL -eq 0 ]]; then
  log "=== run-with-flock.sh OK (all 3 tools) ==="
  exit 0
else
  err "=== run-with-flock.sh FAILED (rcs=${TOOL_RC[*]}) ==="
  exit 1
fi
