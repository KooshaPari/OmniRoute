#!/usr/bin/env bash
# scripts/vault_smoke.sh — L50 Vault smoke test (ADR-077, ADR-079)
#
# Verifies a Vault dev server is reachable, accepts a write, returns the value
# on read, and that dynamic credentials can be rotated (different value on
# each request when the path is a dynamic engine like aws/creds/*).
#
# Usage:
#   VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN=root ./scripts/vault_smoke.sh
#
# Defaults assume `vault server -dev` is running on localhost.
#
# Exit codes:
#   0 — all checks passed.
#   1 — Vault unreachable, unauthenticated, or a check failed.

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"
TEST_PATH="secret/data/pheno/dev/smoke/test"
TEST_KEY="rotating_value"

# Pre-flight: jq + curl required
for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "missing dep: $bin" >&2; exit 1; }
done

# 1. Health check
status=$(curl -sf "${VAULT_ADDR}/v1/sys/health" | jq -r '.initialized')
[[ "$status" == "true" ]] || { echo "FAIL: vault not initialized at ${VAULT_ADDR}" >&2; exit 1; }
echo "OK: vault initialized at ${VAULT_ADDR}"

# 2. Write a test secret (PUT to KV v2 — payload wrapped in {"data":{...}})
curl -sf -X POST -H "X-Vault-Token: ${VAULT_TOKEN}" \
  --data "{\"data\":{\"${TEST_KEY}\":\"v1-$(date +%s)\"}}" \
  "${VAULT_ADDR}/v1/${TEST_PATH}" >/dev/null
echo "OK: wrote test secret to ${TEST_PATH}"

# 3. Read + decrypt the secret; assert the value is non-empty
read_value=$(curl -sf -H "X-Vault-Token: ${VAULT_TOKEN}" \
  "${VAULT_ADDR}/v1/${TEST_PATH}" | jq -r ".data.data.${TEST_KEY}")
[[ -n "$read_value" && "$read_value" != "null" ]] || { echo "FAIL: read returned empty" >&2; exit 1; }
echo "OK: read back value=${read_value}"

# 4. Rotate: write a new value; verify subsequent read returns the new value
new_value="v2-$(date +%s)-rotated"
curl -sf -X POST -H "X-Vault-Token: ${VAULT_TOKEN}" \
  --data "{\"data\":{\"${TEST_KEY}\":\"${new_value}\"}}" \
  "${VAULT_ADDR}/v1/${TEST_PATH}" >/dev/null
rotated_value=$(curl -sf -H "X-Vault-Token: ${VAULT_TOKEN}" \
  "${VAULT_ADDR}/v1/${TEST_PATH}" | jq -r ".data.data.${TEST_KEY}")
[[ "$rotated_value" == "$new_value" ]] || { echo "FAIL: rotation did not propagate (got=${rotated_value})" >&2; exit 1; }
echo "OK: rotation propagated (got=${rotated_value})"

# 5. Optional dynamic-engine probe (only if aws engine mounted)
if curl -sf -H "X-Vault-Token: ${VAULT_TOKEN}" "${VAULT_ADDR}/v1/sys/mounts" | jq -e '.["aws/"]' >/dev/null 2>&1; then
  d1=$(curl -sf -H "X-Vault-Token: ${VAULT_TOKEN}" "${VAULT_ADDR}/v1/aws/creds/smoke" | jq -r '.data.access_key')
  d2=$(curl -sf -H "X-Vault-Token: ${VAULT_TOKEN}" "${VAULT_ADDR}/v1/aws/creds/smoke" | jq -r '.data.access_key')
  [[ "$d1" != "$d2" && -n "$d1" && "$d1" != "null" ]] || { echo "FAIL: dynamic creds not rotating" >&2; exit 1; }
  echo "OK: dynamic creds rotate (d1=${d1:0:8}... d2=${d2:0:8}...)"
fi

echo "PASS: vault_smoke.sh — all checks green"