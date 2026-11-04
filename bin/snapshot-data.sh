#!/usr/bin/env bash
# bin/snapshot-data.sh — fail closed until secure snapshot publication exists.
set -euo pipefail
SCRIPT_NAME="snapshot-data"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ops-common.sh"

usage() {
  cat <<'EOF'
Usage: bin/snapshot-data.sh [--label <name>] [--data-dir <path>] [-h|--help]

Snapshot creation is unavailable until secure staging and publication are implemented.

Env: DATA_DIR (default ~/.omniroute), DB_BACKUPS_DIR (default $DATA_DIR/db_backups).
EOF
}

LABEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="${2:?--label needs a value}"; shift 2 ;;
    --data-dir) ops_set_data_dir "${2:?--data-dir needs a value}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) ops_die "unknown argument: $1 (see --help)" ;;
  esac
done

ops_die "Snapshot creation is unavailable until stable no-follow directory authority is implemented. Preserve the database and existing backups."
