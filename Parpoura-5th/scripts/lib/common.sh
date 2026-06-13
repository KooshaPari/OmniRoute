#!/usr/bin/env bash
set -euo pipefail
# common.sh — Shared utilities for parpour scripts

# Logging functions
log_info() {
  echo "[INFO] $*" >&2
}

log_debug() {
  if [ "${DEBUG:-0}" = "1" ]; then
    echo "[DEBUG] $*" >&2
  fi
}

log_success() {
  echo "[OK] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

log_warn() {
  echo "[WARN] $*" >&2
}

# Returns the project root directory
get_project_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

# Check if a spec file exists
spec_exists() {
  local spec_file="$1"
  [ -f "$spec_file" ]
}
