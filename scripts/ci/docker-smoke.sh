#!/usr/bin/env bash
# W9.15 - Docker smoke test for the published image.
#
# Boots a candidate tag, runs /healthz (or the documented healthcheck), captures
# stdout+stderr, and asserts the process stays up for at least 5s. Exits 0 on
# success, 1 on any failure. Designed for nightly-release-green.yml and
# docker-publish.yml merge job.
#
# Usage:  docker-smoke.sh <image[:tag]> [health-path=/healthz] [wait-secs=5]
set -euo pipefail

IMAGE="${1:?docker image:tag required}"
HEALTH_PATH="${2:-/healthz}"
WAIT_SECS="${3:-5}"

if ! command -v docker >/dev/null 2>&1; then
  echo "::error::docker not installed" >&2; exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "::error::curl not installed" >&2; exit 1
fi

echo "🧪 Smoke-testing $IMAGE (path=$HEALTH_PATH, wait=${WAIT_SECS}s)…"

# Pull lazily (CI runner may already have it).
docker pull --quiet "$IMAGE" >/dev/null 2>&1 || true

# Boot detached on an ephemeral port. The image must NOT depend on host
# networking (we use -P 0 to let docker pick a free random port).
CID=$(docker run --rm -d --network bridge -P \
        -e JWT_SECRET=ci-smoke-test-secret-with-sufficient-length \
        -e NODE_ENV=test \
        "$IMAGE" 2>&1)
if [ -z "$CID" ]; then
  echo "::error::docker run produced no container id" >&2
  exit 1
fi
cleanup() { docker rm -f "$CID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Resolve the published port. The image must EXPOSE the web port (3000 by
# convention; honor PORT env if set). 30s grace for boot.
for i in $(seq 1 30); do
  PORT=$(docker port "$CID" 3000/tcp 2>/dev/null | awk -F: '{print $NF}' | head -1 || true)
  if [ -n "$PORT" ] && [ "$PORT" != "0" ]; then break; fi
  sleep 1
done
if [ -z "$PORT" ] || [ "$PORT" = "0" ]; then
  echo "::error::container did not publish port 3000 within 30s" >&2
  docker logs "$CID" 2>&1 | tail -50 >&2 || true
  exit 1
fi

# First /healthz probe.
status=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://127.0.0.1:${PORT}${HEALTH_PATH}" 2>/dev/null || echo "000")
if [ "$status" != "200" ]; then
  echo "::error::first ${HEALTH_PATH} probe returned HTTP $status" >&2
  docker logs "$CID" 2>&1 | tail -30 >&2 || true
  exit 1
fi

# Stability window: must stay 200 for the whole window.
echo "✅ First probe OK. Holding for ${WAIT_SECS}s stability window…"
end=$(( $(date +%s) + WAIT_SECS ))
while [ "$(date +%s)" -lt "$end" ]; do
  status=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 \
    "http://127.0.0.1:${PORT}${HEALTH_PATH}" 2>/dev/null || echo "000")
  if [ "$status" != "200" ]; then
    echo "::error::${HEALTH_PATH} probe returned HTTP $status mid-window" >&2
    exit 1
  fi
  sleep 1
done

# Final container-state check: must still be running (didn't crash loop).
state=$(docker inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo "false")
if [ "$state" != "true" ]; then
  echo "::error::container exited during smoke window" >&2
  docker logs "$CID" 2>&1 | tail -50 >&2 || true
  exit 1
fi

echo "✅ Smoke test passed: $IMAGE stable on :$PORT for ${WAIT_SECS}s"
