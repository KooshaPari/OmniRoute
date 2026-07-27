#!/usr/bin/env bash
# #440: Emit SHA.txt and provenance metadata for release builds
set -euo pipefail

SHA=$(git rev-parse HEAD)
SHORT_SHA=${SHA:0:12}
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILD_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REMOTE=$(git config --get remote.origin.url || echo "no-remote")

OUT_DIR="\${1:-dist/release}"
mkdir -p "\$OUT_DIR"

cat > "\$OUT_DIR/SHA.txt" <<EOM
sha=\$SHA
short_sha=\$SHORT_SHA
branch=\$BRANCH
built_at=\$BUILD_AT
remote=\$REMOTE
node_version=\$(node --version)
rust_version=\$(rustc --version 2>/dev/null || echo "n/a")
EOM

echo "Wrote \$OUT_DIR/SHA.txt"
cat "\$OUT_DIR/SHA.txt"
