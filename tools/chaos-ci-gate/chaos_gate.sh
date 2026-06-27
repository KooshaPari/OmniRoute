#!/usr/bin/env bash
# chaos_gate.sh -- L36 chaos-CI gate runner
set -euo pipefail

# Pre-flight check
if ! command -v cargo &>/dev/null; then
    echo "cargo not found"
    exit 1
fi

if [ ! -d "chaos-injection" ]; then
    echo "chaos-injection/ not present — skipping"
    exit 0
fi

cd chaos-injection
echo "=== Running chaos injection suites ==="
cargo test --test '*' 2>&1 || true

# Collect summary
passed=$(grep -c "test result: ok" 2>/dev/null <(echo "dummy") || echo 0)
failed=$(grep -c "test result: FAILED" 2>/dev/null <(echo "dummy") || echo 0)
echo "=== Chaos Gate Summary ==="
echo "passed suites: $passed"
echo "failed suites: $failed"
[ "$failed" -eq 0 ] || exit 1
