#!/usr/bin/env bash
set -euo pipefail

# Device adapter for the canonical production Compose stack.  It deliberately
# does not provision cloud infrastructure: the desktop owns the data volume and
# only exposes the loopback dashboard/API by default.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
DATA_DIR="${OMNIROUTE_DEVICE_DATA_DIR:-${ROOT_DIR}/.local-data/omniroute}"
DASHBOARD_PORT="${PROD_DASHBOARD_PORT:-20130}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

[[ -f "${COMPOSE_FILE}" ]] || { echo "missing compose file: ${COMPOSE_FILE}" >&2; exit 2; }
[[ -f "${ENV_FILE}" ]] || {
  echo "missing secrets file: ${ENV_FILE}; copy .env.example and keep it outside git" >&2
  exit 2
}
mkdir -p "${DATA_DIR}"

# Validate interpolation before mutating containers. Secrets remain in ENV_FILE
# and are never echoed by this adapter.
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config --quiet
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl --fail --silent --show-error "http://127.0.0.1:${DASHBOARD_PORT}/api/monitoring/health" >/dev/null; do
  (( SECONDS < deadline )) || {
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
    exit 1
  }
  sleep 2
done
echo "OmniRoute device services ready on http://127.0.0.1:${DASHBOARD_PORT}"
