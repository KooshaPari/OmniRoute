#!/usr/bin/env bash
# proccompose tests - run with `bun test tests/proccompose.test.sh` or just bash
set -euo pipefail

PROCCOMPOSE_BIN="$(cd "$(dirname "$0")/.." && pwd)/proccompose"
YAML_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.yaml"
EXAMPLE_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.example.yaml"

echo "[1/4] syntax check"
bash -n "$PROCCOMPOSE_BIN" || { echo "FAIL: proccompose has syntax errors"; exit 1; }

echo "[2/4] symlink resolution (script dir lookup works)"
cd "$(dirname "$0")/.."
out1=$("$PROCCOMPOSE_BIN" validate 2>&1)
[[ "$out1" == *"OK"* ]] || { echo "FAIL: validate from script dir failed: $out1"; exit 1; }
cd /tmp && out2=$("$PROCCOMPOSE_BIN" validate 2>&1)
[[ "$out2" == *"OK"* ]] || { echo "FAIL: validate from /tmp failed: $out2"; exit 1; }

echo "[3/4] plan produces expected output"
out=$("$PROCCOMPOSE_BIN" plan 2>&1)
echo "$out" | grep -q "bff  host=desktop" || { echo "FAIL: plan missing bff service"; exit 1; }
echo "$out" | grep -q "kbridge  host=desktop" || { echo "FAIL: plan missing kbridge service"; exit 1; }
echo "$out" | grep -q "tailscale_funnel  host=desktop" || { echo "FAIL: plan missing tailscale_funnel service"; exit 1; }
echo "$out" | grep -q "vercel_projects:" || { echo "FAIL: plan missing vercel_projects section"; exit 1; }
echo "$out" | grep -q "cutover phases:" || { echo "FAIL: plan missing cutover phases section"; exit 1; }
echo "$out" | grep -q "argismonitor-homepage" || { echo "FAIL: plan missing argismonitor-homepage project"; exit 1; }

echo "[4/4] example.yaml is also valid"
python3 -c "import yaml; yaml.safe_load(open('$EXAMPLE_FILE')); print('example.yaml: valid')" || { echo "FAIL: example.yaml invalid"; exit 1; }

echo ""
echo "ALL TESTS PASS"
