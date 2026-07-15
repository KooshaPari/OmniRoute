#!/usr/bin/env bash
# Publish the 5 per-platform @omniroute/ffi-* packages to the registry.
# Expects `crates/omniroute-ffi/target/<target>/release/libomniroute_ffi_*.dylib`
# to already exist (built by `bash scripts/build-cross-ffi.sh`).
#
# Usage:  bash scripts/publish-ffi-packages.sh <registry-token>
set -euo pipefail

REGISTRY_TOKEN="${1:-${NPM_TOKEN:-}}"
if [ -z "${REGISTRY_TOKEN}" ]; then
  echo "Usage: $0 <npm-token>   (or set NPM_TOKEN in env)" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGETS=(
  "aarch64-apple-darwin:@omniroute/ffi-darwin-arm64:.dylib"
  "x86_64-apple-darwin:@omniroute/ffi-darwin-x64:.dylib"
  "x86_64-unknown-linux-gnu:@omniroute/ffi-linux-x64-gnu:.so"
  "aarch64-unknown-linux-gnu:@omniroute/ffi-linux-arm64-gnu:.so"
  "x86_64-pc-windows-msvc:@omniroute/ffi-win32-x64:.dll"
)

publish_one() {
  local target="$1" pkg="$2" ext="$3"
  local src_dir="${ROOT_DIR}/crates/omniroute-ffi/target/${target}/release"
  local dst_dir="${ROOT_DIR}/packages/${pkg}/native"
  mkdir -p "${dst_dir}"
  rm -f "${dst_dir}"/* 2>/dev/null || true
  for f in "${src_dir}"/libomniroute_ffi_*"${ext}"; do
    [ -e "$f" ] || continue
    cp "$f" "${dst_dir}/$(basename "$f")"
  done
  echo "→ publishing ${pkg} from ${src_dir} ($(ls "${dst_dir}" | wc -l | xargs) binaries)"
  (cd "${ROOT_DIR}/packages/${pkg}" && \
    npm publish --access=restricted --registry=https://registry.npmjs.org/ \
    // .npmrc would override per-publish; passed via env instead:
    NPM_TOKEN="${REGISTRY_TOKEN}" \
    npm publish --access=restricted \
      --//registry.npmjs.org/:_authToken="${REGISTRY_TOKEN}" 2>&1)
}

for entry in "${TARGETS[@]}"; do
  IFS=":" read -ra parts <<< "$entry"
  publish_one "${parts[0]}" "${parts[1]}" "${parts[2]}"
done

echo ""
echo "Published all 5 @omniroute/ffi-* packages."
echo "Also publish the workspace aggregator:"
echo "  cd packages/omniroute-ffi && npm publish --access=restricted ..."