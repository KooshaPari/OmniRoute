#!/usr/bin/env bash
set -euo pipefail

# L30 reproducible-build runner (v28 T1)
# Usage: docker_build.sh [--push]

DIGEST_FILE=".build.reproducible"
CACHE_IMAGE="${CACHE_IMAGE:-ghcr.io/kooshapari/cache-build:latest}"

docker build --iidfile=image.id \
  --cache-from "$CACHE_IMAGE" \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -f Dockerfile .

CID=$(docker create "$(cat image.id)")
docker cp "$CID":/app/app app.sha256
docker rm "$CID"

sha256=$(shasum -a 256 app.sha256 | cut -d' ' -f1)
echo "$sha256  $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIGEST_FILE"

if [ "${PREVIOUS_DIGEST:-}" ] && [ "$sha256" != "$PREVIOUS_DIGEST" ]; then
  echo "BUILD DRIFT: $sha256 != $PREVIOUS_DIGEST" >&2
  exit 2
fi

if [ "${1:-}" = "--push" ]; then
  docker tag "$(cat image.id)" "$CACHE_IMAGE"
  docker push "$CACHE_IMAGE"
fi
