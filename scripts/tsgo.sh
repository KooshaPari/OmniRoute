#!/usr/bin/env bash
# scripts/tsgo.sh — TypeScript 7.1 (tsgo) vendored soft fork wrapper.
#
# Uses the vendored microsof/typescript-go (TS7.1, Go-based, 32-40x faster than
# tsc) for typecheck + declaration emit. Falls back to tsc if the binary is
# missing (e.g., on a contributor machine that hasn't built the vendor).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TSGO_BIN="${REPO_ROOT}/vendor/typescript-go/tsgo"
TSGO_VERSION=$("${TSGO_BIN}" --version 2>/dev/null | awk '/Version/ {print $NF}' || echo "missing")

# Use the vendored tsgo as the typecheck driver. Pass-through to the Go binary.
# The binary is API-compatible with tsc for the flags we use:
#   -p, --project, --noEmit, --pretty, --declaration, --emitDeclarationOnly, --target
if [[ -x "${TSGO_BIN}" ]]; then
  exec "${TSGO_BIN}" "$@"
else
  # Fallback: legacy tsc (TypeScript 6.0.3)
  echo "tsgo: vendored binary missing — falling back to tsc" >&2
  exec npx --no-install tsc "$@"
fi
