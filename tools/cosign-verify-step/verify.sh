#!/usr/bin/env bash
set -euo pipefail
# T4 (L53.1) — Cosign verify step: verify a signed artifact's signature
ARTIFACT="${1:-dist/artifact.bin}"
SIG="${2:-${ARTIFACT}.sig}"
CERT="${3:-${ARTIFACT}.cert}"
IMAGE="${4:-}"

echo "=== Cosign Verify ==="
if [ -n "$IMAGE" ]; then
    cosign verify "$IMAGE" --in-ignore-sct
else
    cosign verify-blob --signature "$SIG" --certificate "$CERT" "$ARTIFACT"
fi
echo "PASS: signature verified."
