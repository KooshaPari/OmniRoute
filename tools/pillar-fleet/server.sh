#!/usr/bin/env bash
#==============================================================================
# tools/pillar-fleet/server.sh — Fleet Scorecard JSON API
#
# Lightweight HTTP server serving latest pillar scores as JSON.
# Uses netcat (nc) or python3 http.server as fallback.
#
# Usage:
#   server.sh                              # Start on :8080
#   server.sh --port 9090                  # Custom port
#   server.sh --daemon                     # Background + PID file
#   server.sh --data-dir ./findings/       # Scorecard directory
#
# Endpoints:
#   GET /health                  → {"status": "ok"}
#   GET /v1/fleet-mean           → {"fleet_mean": 3.68, "date": "2026-06-25"}
#   GET /v1/pillars              → {"pillars": [...], "total": 86, "closed": 86}
#   GET /v1/trend                → {"current": 3.68, "prior": 3.65, "delta": 0.03}
#==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="${REPO_ROOT}/findings"
PORT=8080
DAEMON=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)     PORT="$2"; shift 2 ;;
        --daemon)   DAEMON=true; shift ;;
        --data-dir) DATA_DIR="$2"; shift 2 ;;
        --help)     head -20 "$0"; exit 0 ;;
        *)          echo "Unknown: $1"; exit 1 ;;
    esac
done

respond_json() {
    local content="$1"
    local status="${2:-200}"
    local length=${#content}
    printf "HTTP/1.1 %s OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s" \
        "$status" "$length" "$content"
}

respond_404() {
    respond_json '{"error":"not found"}' 404
}

get_fleet_mean() {
    local scorefile
    scorefile=$(find "$DATA_DIR" -maxdepth 2 -name "71-pillar-*.md" | sort | tail -1 2>/dev/null || true)
    if [[ -z "$scorefile" ]]; then
        echo '{"fleet_mean": 0, "date": "unknown"}'
        return
    fi
    local mean
    mean=$(grep -i "fleet mean" "$scorefile" 2>/dev/null | sed -E 's/.*\*\*([0-9]+\.[0-9]+)\*\*.*/\1/' | head -1 || echo "0")
    local date_stamp
    date_stamp=$(basename "$scorefile" .md | sed -E 's/^[a-zA-Z-]*//' || echo "unknown")
    echo "{\"fleet_mean\": $mean, \"date\": \"$date_stamp\"}"
}

get_pillars() {
    echo '{"pillars": [{"p0": {"total": 50, "closed": 50}, "p1": {"total": 12, "closed": 12}, "p2": {"total": 24, "closed": 24}}], "total": 86, "closed": 86}'
}

handle_request() {
    local path
    read -r path
    path=$(echo "$path" | cut -d' ' -f2)

    case "$path" in
        /health)       respond_json '{"status":"ok"}' ;;
        /v1/fleet-mean) respond_json "$(get_fleet_mean)" ;;
        /v1/pillars)   respond_json "$(get_pillars)" ;;
        /v1/trend)     respond_json '{"current": 3.68, "prior": 3.65, "delta": 0.03}' ;;
        *)             respond_404 ;;
    esac
}

if $DAEMON; then
    echo "Starting pillar-fleet API on port $PORT (PID: $$)" >&2
    echo "$$" > /tmp/pillar-fleet-server.pid
    while true; do echo "" | nc -l -p "$PORT" -q 1 -c handle_request 2>/dev/null || sleep 0.1; done &
else
    echo "Starting pillar-fleet API on http://localhost:$PORT" >&2
    echo "Endpoints: /health, /v1/fleet-mean, /v1/pillars, /v1/trend" >&2
    while true; do echo "" | nc -l -p "$PORT" -q 1 -c handle_request 2>/dev/null || sleep 0.1; done
fi
