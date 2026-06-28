#!/usr/bin/env bash
set -euo pipefail
# v35 3e-Embed T1: Embed SBOM generation in every Rust crate's CI.
# Scans Cargo.toml files and injects cargo-cyclonedx step into ci.yml if missing.
REPO_ROOT="${1:-.}"
count=0
for dir in "$REPO_ROOT"/*/; do
  if [ -f "$dir/Cargo.toml" ] && [ -f "$dir/.github/workflows/ci.yml" ]; then
    if ! grep -q "cyclonedx\|sbom" "$dir/.github/workflows/ci.yml" 2>/dev/null; then
      echo "EMBED SBOM: $dir"
      # Inject after cargo build step
      sed -i '' '/- run: cargo build/a\
      - name: Generate SBOM\
        run: cargo cyclonedx --output build/' "$dir/.github/workflows/ci.yml"
      count=$((count + 1))
    fi
  fi
done
echo "T1 SBOM embed: $count repos patched"
