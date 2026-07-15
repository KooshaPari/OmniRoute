#!/usr/bin/env bash
# Cross-compile all 5 FFI cdylibs to every supported target.
#
# Outputs land under crates/omniroute-ffi/dist/<target-triple>/libomniroute_ffi_*.{so,dylib,dll}
#
# Requires the rustup target toolchains to be installed:
#   rustup target add aarch64-unknown-linux-gnu \
#                      x86_64-unknown-linux-gnu  \
#                      x86_64-apple-darwin       \
#                      aarch64-apple-darwin      \
#                      x86_64-pc-windows-msvc
#
# @see docs/adr/0032-polyglot-binding-tiers.md § Cross-compile matrix
# @see .github/workflows/rust-ffi.yml

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(git rev-parse --show-toplevel)}"
WORKSPACE="$ROOT_DIR/crates/omniroute-ffi"
DIST_DIR="$WORKSPACE/dist"

# Targets supported by OmniRoute v3.9+ Tier-3 (FFI) bindings
TARGETS=(
  "aarch64-unknown-linux-gnu"
  "x86_64-unknown-linux-gnu"
  "x86_64-apple-darwin"
  "aarch64-apple-darwin"
  "x86_64-pc-windows-msvc"
)

# Crates that have cdylib output
CRATES=(
  "combo_scorer"
  "signature_cache"
  "sse_chunking"
  "guardrails_pii"
  "token_bucket"
)

mkdir -p "$DIST_DIR"

for target in "${TARGETS[@]}"; do
  echo "=== Building for $target ==="
  if ! rustup target list --installed | grep -q "$target"; then
    echo "  warning: target $target not installed (rustup target add $target)"
    continue
  fi
  cargo build --release \
    --manifest-path "$WORKSPACE/Cargo.toml" \
    --target "$target"

  target_dir="$DIST_DIR/$target"
  mkdir -p "$target_dir"
  case "$target" in
    *windows*)
      ext="dll"
      ;;
    *apple-darwin*)
      ext="dylib"
      ;;
    *)
      ext="so"
      ;;
  esac
  for crate in "${CRATES[@]}"; do
    src="$WORKSPACE/target/$target/release/libomniroute_ffi_$crate.$ext"
    if [[ -f "$src" ]]; then
      cp "$src" "$target_dir/"
      echo "  + $(basename "$src") ($(du -h "$src" | cut -f1))"
    fi
  done
done

# Emit a manifest JSON
node <<EOF
const fs = require('fs');
const path = require('path');
const manifest = { built_at: new Date().toISOString(), targets: {} };
for (const target of fs.readdirSync('$DIST_DIR')) {
  const targetDir = path.join('$DIST_DIR', target);
  if (!fs.statSync(targetDir).isDirectory()) continue;
  manifest.targets[target] = [];
  for (const file of fs.readdirSync(targetDir)) {
    const full = path.join(targetDir, file);
    manifest.targets[target].push({
      file,
      size_bytes: fs.statSync(full).size,
    });
  }
}
fs.writeFileSync('$DIST_DIR/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest written to $DIST_DIR/manifest.json');
EOF

echo
echo "Done. Output manifest:"
cat "$DIST_DIR/manifest.json"
