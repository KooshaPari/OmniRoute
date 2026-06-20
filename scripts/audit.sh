#!/usr/bin/env bash
# scripts/audit.sh - security audit driver for phenotype-registry
# See ADR-042 (security audit cadence, monthly sweep)
# Exit code 0 = clean, 1 = vulnerabilities found, 2 = tool missing

set -euo pipefail

REPO_ROOT="$([ -d .git ] && git rev-parse --show-toplevel || pwd)"
cd "$REPO_ROOT"

AUDIT_FAIL=0
echo "==> security audit for phenotype-registry (language: typescript)"
echo "==> repository root: $REPO_ROOT"
echo

    echo "==> npm audit (npm dependencies)"; npm audit --audit-level=high || AUDIT_FAIL=1

if command -v gitleaks >/dev/null 2>&1; then
    echo "==> gitleaks (secret detection)"
    gitleaks detect --source . --no-banner --redact || AUDIT_FAIL=1
else
    echo "==> gitleaks not installed; skipping (install via brew install gitleaks)"
fi

if command -v trivy >/dev/null 2>&1; then
    echo "==> trivy (filesystem vulnerability scan)"
    trivy fs --severity HIGH,CRITICAL --no-progress . || AUDIT_FAIL=1
else
    echo "==> trivy not installed; skipping (install via brew install trivy)"
fi

echo
if [ "$AUDIT_FAIL" -eq 0 ]; then
    echo "==> security audit: PASS"
    exit 0
else
    echo "==> security audit: FAIL (see output above)"
    exit 1
fi
