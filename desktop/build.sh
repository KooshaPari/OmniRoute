#!/usr/bin/env bash
# build.sh — build the sharecli desktop client (macOS).
#
# Usage:
#   ./desktop/build.sh              # debug build
#   ./desktop/build.sh --release    # release build
#
# Prerequisites (macOS):
#   - Rust toolchain (rustup)
#   - Xcode Command Line Tools (swift, swiftc)
#   - The sharecli repo root is the working directory

set -euo pipefail

RELEASE="${1:-}"
PROFILE="debug"
CARGO_FLAGS=()

if [[ "$RELEASE" == "--release" ]]; then
    PROFILE="release"
    CARGO_FLAGS+=(--release)
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$REPO_ROOT/target/$PROFILE"

# Build macOS .icns from the Backbone-2 iconset so cargo bundle / swift build
# can pick it up. iconutil is a macOS-only tool; skip on other platforms.
if [[ "$(uname -s)" == "Darwin" ]]; then
    ICONSET="$REPO_ROOT/assets/icons/sharecli.iconset"
    ICNS="$REPO_ROOT/assets/icons/sharecli.icns"
    if [[ -d "$ICONSET" ]]; then
        echo "==> Building .icns from .iconset"
        iconutil -c icns "$ICONSET" -o "$ICNS"
    fi
fi

echo "==> Building Rust crates (profile: $PROFILE)"
cd "$REPO_ROOT"
cargo build "${CARGO_FLAGS[@]}" -p sharecli-ipc -p sharecli-ffi

IPC_BIN="$TARGET_DIR/sharecli-ipc"
FFI_LIB="$TARGET_DIR/libsharecli_ffi.dylib"

echo "    sharecli-ipc → $IPC_BIN"
echo "    sharecli-ffi → $FFI_LIB"

echo ""
echo "==> Building Swift tray app"
cd "$REPO_ROOT/desktop/ShareCLITray"

# Linker needs to find the Rust dylib at build time.
export SHARECLI_FFI_LIB_DIR="$TARGET_DIR"

swift build \
    -Xlinker "-L$TARGET_DIR" \
    -Xlinker "-lsharecli_ffi" \
    -Xlinker "-rpath" \
    -Xlinker "@executable_path/../Frameworks"

SWIFT_BIN=".build/$PROFILE/ShareCLITray"
echo "    Swift tray → $SWIFT_BIN"

echo ""
echo "==> Build complete."
echo "    Run IPC sidecar:  $IPC_BIN"
echo "    Run tray app:     $(pwd)/$SWIFT_BIN"
echo ""
echo "    Quick test:"
echo "      # terminal 1"
echo "      $IPC_BIN &"
echo "      # terminal 2"
echo "      $(pwd)/$SWIFT_BIN"
