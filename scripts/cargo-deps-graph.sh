#!/usr/bin/env bash
# scripts/cargo-deps-graph.sh — emit a per-crate intra-crate deps SVG.
#
# Usage: scripts/cargo-deps-graph.sh <crate-dir> [output-svg]
# Install cargo-deps via: cargo install cargo-deps --locked
# Implements v14 plan Track T1 (L3 deps-graph pillar score 1→3).

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <crate-dir> [output-svg]" >&2; exit 3
fi

CRATE_DIR="$1"
OUT_SVG="${2:-${CRATE_DIR}/target/deps-graph.svg}"

[[ -d "${CRATE_DIR}" && -f "${CRATE_DIR}/Cargo.toml" ]] \
  || { echo "::error::no Cargo.toml in ${CRATE_DIR}" >&2; exit 3; }

# Install cargo-deps if missing (CI runner).
if ! command -v cargo-deps >/dev/null 2>&1; then
  echo "::notice::installing cargo-deps (cargo install cargo-deps --locked)"
  cargo install cargo-deps --locked
fi

mkdir -p "$(dirname "${OUT_SVG}")"

# `--no-deps` keeps the graph to first-party modules only (intra-crate,
# which is what the L3 pillar scores). `--format svg` writes SVG to stdout.
cd "${CRATE_DIR}"
cargo deps --no-deps --format svg > "${OUT_SVG}.tmp"

# Validate before promoting the temp file.
if ! head -c 5 "${OUT_SVG}.tmp" | grep -q "<svg\|<?xml"; then
  echo "::error::cargo-deps output is not SVG (first 200B below)" >&2
  head -c 200 "${OUT_SVG}.tmp" >&2; rm -f "${OUT_SVG}.tmp"; exit 2
fi

mv "${OUT_SVG}.tmp" "${OUT_SVG}"
echo "::notice::wrote ${OUT_SVG} ($(wc -c < "${OUT_SVG}") bytes)"
