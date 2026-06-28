#!/usr/bin/env bash
set -euo pipefail

# L30 devcontainer provisioner (v28 T1)
# Verifies devcontainer reproducibility: same base image + same lockfiles -> same tools

HASH_FILE=".devcontainer.hash"
BASE="${CODESPACE_NAME:-local}"

sha256=$( (cat .devcontainer/devcontainer.json Dockerfile* 2>/dev/null
           find . -name "*.lock" -o -name "lockfile" 2>/dev/null | head -5 | xargs cat 2>/dev/null
           echo "$BASE") | shasum -a 256 | cut -d' ' -f1)

if [ -f "$HASH_FILE" ]; then
  prev=$(cut -d' ' -f1 "$HASH_FILE")
  if [ "$sha256" != "$prev" ]; then
    echo "DEVCONTAINER DRIFT: $sha256 != $prev"
    exit 2
  fi
fi

echo "$sha256  $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$HASH_FILE"
echo "devcontainer hash: $sha256"
