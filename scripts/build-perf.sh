#!/usr/bin/env bash
# scripts/build-perf.sh — Build performance measurement for L35
# Runs cargo build with timing + reports wall-clock, user-cpu, sys-cpu, max-rss
set -euo pipefail

LABEL="${1:-all}"
OUT_DIR="${PHENO_PERF_OUT:-/tmp/pheno-perf}"
mkdir -p "$OUT_DIR"

# Clear sccache for a fresh measurement
sccache -C 2>/dev/null || true

# Run cargo build with /usr/bin/time -v for full stats
echo "=== cargo build ($LABEL) ===" > "$OUT_DIR/$LABEL.log"
/usr/bin/time -v cargo build --workspace --release 2>> "$OUT_DIR/$LABEL.log"
EXIT=$?
if [ $EXIT -ne 0 ]; then
  echo "FAIL: cargo build exited $EXIT" >> "$OUT_DIR/$LABEL.log"
  exit $EXIT
fi

# Extract stats
WALL=$(grep "wall clock" "$OUT_DIR/$LABEL.log" | awk '{print $NF}')
USER=$(grep "user time" "$OUT_DIR/$LABEL.log" | awk '{print $NF}')
SYS=$(grep "system time" "$OUT_DIR/$LABEL.log" | awk '{print $NF}')
RSS=$(grep "Maximum resident" "$OUT_DIR/$LABEL.log" | awk '{print $NF}')

echo "=== build perf summary ==="
echo "label: $LABEL"
echo "wall: ${WALL}s"
echo "user+sys: ${USER}s + ${SYS}s"
echo "max-rss: ${RSS} KB"
echo "log: $OUT_DIR/$LABEL.log"
