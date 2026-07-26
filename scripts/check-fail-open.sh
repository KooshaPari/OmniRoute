#!/usr/bin/env bash
# #436: CI check for residual fail-open paths
# Surfaces any catch{} swallow that returns null/undefined/false/0/'' without logging
set -euo pipefail

PATTERN='catch\s*\([^)]*\)\s*\{\s*(//[^\n]*\n\s*)?\s*return\s+(null|undefined|false|0|""\047)\s*;?\s*\}'

if grep -rEn "$PATTERN" src/ open-sse/ --include="*.ts" 2>/dev/null; then
  echo "::error file=scripts::Detected fail-open catch block — must log or annotate"
  exit 1
fi
echo "✓ No fail-open paths"
