#!/usr/bin/env bash
# common.sh — shared logging + error handling for the heavy-runner-cron bundle.
#
# Sourced (not executed) by run-with-flock.sh, install-cron.sh, and dry-run.sh.
# All output is timestamped ISO-8601 (local time, no UTC offset) to ease
# correlation with `journalctl`, the cron's local mail spool, and the GitHub
# audit logs.
#
# Environment variables (all optional, all read at source time):
#   HEAVY_RUNNER_LOG_DIR  — where per-run logs go; default
#                            ${HEAVY_RUNNER_BUNDLE_DIR:-/path/to}/logs
#   HEAVY_RUNNER_QUIET    — if set to 1, log() emits only WARN/ERR severity
#   HEAVY_RUNNER_BUNDLE_DIR — path to this bundle; default derived from $BASH_SOURCE
#
# Public functions:
#   log <msg>               — info-level (suppressed when QUIET=1)
#   warn <msg>              — warning-level (always printed to stderr)
#   err <msg>               — error-level (always printed to stderr)
#   die <rc> <msg>          — print err, exit <rc>
#   require_cmd <cmd>       — exit 127 with err if <cmd> not on PATH
#   timestamp               — echo current local time in ISO-8601
#
# Shell hardening: this file is safe to source under `set -euo pipefail`
# callers. It does NOT enable those flags itself (sourcing should not
# mutate the caller's shell options).

# --- path resolution --------------------------------------------------------
# Resolve BUNDLE_DIR from the caller's BASH_SOURCE if not pre-set. This works
# for both direct invocation (`source lib/common.sh`) and re-source from a
# script in bin/ that does `source "$(dirname "$0")/../lib/common.sh"`.
if [[ -z "${HEAVY_RUNNER_BUNDLE_DIR:-}" ]]; then
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "common.sh" ]]; then
    # Sourced from another file: walk up to the bundle root.
    HEAVY_RUNNER_BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  else
    # Sourced directly in a test harness; caller is expected to set it.
    HEAVY_RUNNER_BUNDLE_DIR="${PWD}"
  fi
fi
export HEAVY_RUNNER_BUNDLE_DIR

# --- timestamp helper -------------------------------------------------------
timestamp() {
  # %Y-%m-%dT%H:%M:%S%z gives ISO-8601 with local-zone offset. macOS `date`
  # does not support --version but DOES support this format flag.
  date '+%Y-%m-%dT%H:%M:%S%z'
}

# --- severity-aware logging -------------------------------------------------
_log() {
  local level="$1"; shift
  if [[ "${HEAVY_RUNNER_QUIET:-0}" == "1" && "$level" == "INFO" ]]; then
    return 0
  fi
  # INFO -> stdout, WARN/ERR -> stderr
  if [[ "$level" == "INFO" ]]; then
    printf '%s [%s] %s\n' "$(timestamp)" "$level" "$*"
  else
    printf '%s [%s] %s\n' "$(timestamp)" "$level" "$*" >&2
  fi
}

log()  { _log INFO "$*"; }
warn() { _log WARN  "$*"; }
err()  { _log ERR   "$*"; }

# --- fatal exit -------------------------------------------------------------
# Usage: die <rc> <msg>
die() {
  local rc="$1"; shift
  err "$*"
  exit "$rc"
}

# --- command existence check ------------------------------------------------
# Usage: require_cmd <cmd>
require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    die 127 "required command not on PATH: $cmd"
  fi
}

# --- log directory bootstrap ------------------------------------------------
# Creates the per-run log directory if missing. Idempotent.
ensure_log_dir() {
  local log_dir="${HEAVY_RUNNER_LOG_DIR:-${HEAVY_RUNNER_BUNDLE_DIR}/logs}"
  if ! mkdir -p "$log_dir" 2>/dev/null; then
    # Fall back to a tmp dir if the configured location is unwritable.
    # Common on macOS where ~/logs may not exist and the heavy-runner
    # service runs as a user without write access to system paths.
    log_dir="/tmp/fleet-substrate-tools-logs"
    mkdir -p "$log_dir"
    warn "could not create ${HEAVY_RUNNER_LOG_DIR:-${HEAVY_RUNNER_BUNDLE_DIR}/logs}; using $log_dir"
  fi
  HEAVY_RUNNER_LOG_DIR="$log_dir"
  export HEAVY_RUNNER_LOG_DIR
}
