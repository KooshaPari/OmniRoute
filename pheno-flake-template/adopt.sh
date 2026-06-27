#!/usr/bin/env bash
# adopt.sh — Adopt pheno-flake-template into a pheno-* crate.
#
# Usage (from the root of a pheno-* crate):
#   curl -fsSL https://raw.githubusercontent.com/phenotype/pheno-flake-template/main/adopt.sh | bash
#
# What it does:
#   1. Downloads flake.nix + flake.lock to ./.
#   2. Detects the crate's specific dependencies (from Cargo.toml).
#   3. Adds them to the devShell.
#   4. Runs `nix flake lock` to commit the initial lock.
#
# Idempotent: safe to re-run; will overwrite flake.nix and re-lock.
set -euo pipefail

CRATE_ROOT="${1:-$PWD}"
TEMPLATE_REPO="https://raw.githubusercontent.com/phenotype/pheno-flake-template/main"
TEMPLATE_FILES=("flake.nix" "README.md" ".envrc")

echo "[adopt] target: $CRATE_ROOT"
cd "$CRATE_ROOT"

# 1. Download template files
for f in "${TEMPLATE_FILES[@]}"; do
  if [ -f "$f" ] && [ "$f" != "flake.lock" ]; then
    echo "[adopt]   $f already exists, leaving it alone (delete manually to re-template)"
    continue
  fi
  echo "[adopt] downloading $f"
  if ! curl -fsSL "$TEMPLATE_REPO/$f" -o "$f"; then
    echo "[adopt]   WARNING: failed to download $f, skipping"
  fi
done

# 2. Detect crate-specific deps from Cargo.toml
CRATE_NAME=$(grep '^name = ' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo "[adopt] crate name detected: $CRATE_NAME"

# Look for common pheno-* crate deps and add them to the devShell
COMMON_DEPS=()
if grep -q "pheno-otel" Cargo.toml; then
  COMMON_DEPS+=("protobuf" "tonic-tools")
fi
if grep -q "pheno-tracing" Cargo.toml; then
  COMMON_DEPS+=("pkg-config" "openssl")
fi
if grep -q "pheno-events" Cargo.toml; then
  COMMON_DEPS+=("librdkafka")
fi
if grep -q "sqlx" Cargo.toml; then
  COMMON_DEPS+=("sqlite")
fi

if [ ${#COMMON_DEPS[@]} -gt 0 ]; then
  echo "[adopt] detected deps that need system packages: ${COMMON_DEPS[*]}"
  echo "[adopt]   Add these to the devShells.default buildInputs in flake.nix"
fi

# 3. Generate initial lock (if Nix is available)
if command -v nix >/dev/null 2>&1; then
  echo "[adopt] generating flake.lock (this may take 1-2 minutes)..."
  nix flake lock 2>&1 | tail -3 || echo "[adopt]   WARNING: nix flake lock failed; run manually later"
else
  echo "[adopt] nix not installed; skipping flake.lock generation"
  echo "[adopt]   install Nix from https://nixos.org/download.html and run 'nix flake lock'"
fi

# 4. Print followup steps
cat <<EOF

[adopt] done. Next steps:
  1. Review flake.nix — add any crate-specific buildInputs
  2. cd into the crate and run:    nix develop
  3. Verify the toolchain:          rustc --version
  4. Run the tests:                 cargo test --workspace
  5. Commit flake.nix + flake.lock + .envrc + README.md update

EOF
