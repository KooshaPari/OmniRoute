#!/usr/bin/env bash
set -euo pipefail
# Embed gitleaks into CI for a given repo.
# Usage: bash tools/embed-gitleaks/embed.sh <repo-name>

REPO="${1:?Usage: $0 <repo-name>}"
echo "# Embedding gitleaks CI for $REPO"

cat > .github/workflows/gitleaks.yml <<GITLEAKS
name: Secret Scan ($REPO)
on:
  push: {branches: [main]}
  pull_request: {branches: [main]}
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: gitleaks/gitleaks-action@v2
GITLEAKS

echo "Wrote .github/workflows/gitleaks.yml for $REPO"
