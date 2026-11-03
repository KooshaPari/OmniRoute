#!/usr/bin/env bash
# bin/restore-data.sh — restore the OmniRoute SQLite data volume from a snapshot
# created by bin/snapshot-data.sh. Used by the data-layer incident-recovery
# flow after stopping writers.
#
# Restore is disabled until exclusive ownership and safe replacement are implemented.
set -euo pipefail
SCRIPT_NAME="restore-data"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ops-common.sh"

usage() {
  cat <<'EOF'
Usage: bin/restore-data.sh <snapshot-id> [--data-dir <path>] [--yes|-y] [-h|--help]

Restore is currently unavailable. Preserve the current database, sidecars,
and snapshot until exclusive ownership and crash-safe recovery are available.
EOF
}

ID=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes | -y) ASSUME_YES=1; shift ;;
    --data-dir) ops_set_data_dir "${2:?--data-dir needs a value}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    -*) ops_die "unknown argument: $1 (see --help)" ;;
    *) ID="$1"; shift ;;
  esac
done

[ -n "$ID" ] || ops_die "snapshot id required (see --help)"
ops_die "Restore is unavailable until exclusive writer ownership and crash-safe recovery are implemented. Preserve the current database, sidecars, and snapshot."
