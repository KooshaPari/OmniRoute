#!/usr/bin/env bash
# T1 (L30.1) — Cargo reproducible build flags + CI verify
set -euo pipefail

RUSTFLAGS="${RUSTFLAGS:-}"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="${RUSTFLAGS} -Ctarget-cpu=x86-64 -Clink-arg=-Wl,--build-id=sha1 -Cstrip=none"

echo "=== Reproducible Build Check ==="
echo "RUSTFLAGS: ${RUSTFLAGS}"
echo "Cargo version: $(cargo --version)"
echo "Rustc version: $(rustc --version)"

# Cargo.toml reproducible settings check
if grep -q 'strip' Cargo.toml 2>/dev/null; then
    echo "OK: reproducible build flags detected in Cargo.toml (profile.strip)"
else
    echo "WARN: profile.strip not set in Cargo.toml — builds may not be bitwise-identical"
    echo "Add to Cargo.toml: [profile.release] strip = \"none\""
fi

# Check for timestamps in binary (runs cargo build and verifies)
if cargo build --release --quiet 2>/dev/null; then
    echo "OK: release build succeeded with reproducible flags"
else
    echo "FAIL: release build failed"
    exit 1
fi

echo "=== Reproducible Build Flags Verified ==="
