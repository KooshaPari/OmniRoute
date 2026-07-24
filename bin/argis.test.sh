#!/usr/bin/env bash
# bin/argis.test.sh - test the master CLI proxy to proccompose
# 
# This is intentionally a bash script (not proccompose.test.sh style) because
# argis is itself a bash wrapper. Stays hermetic by mocking the pheno binary.

set -uo pipefail

ARGIS="$(cd "$(dirname "$0")" && pwd)/argis"
PROCCOMPOSE_BIN_DIR="$(cd "$(dirname "$0")/../proccompose" && pwd)"

PASS=0
FAIL=0
report() {
  local label="$1" status="$2"
  if [[ "$status" == "ok" ]]; then
    PASS=$((PASS+1))
    printf "  \033[1;32m[OK]\033[0m   %s\n" "$label"
  else
    FAIL=$((FAIL+1))
    printf "  \033[1;31m[FAIL]\033[0m %s\n" "$label"
  fi
}

# Stub pheno so argis's desktop-touching commands don't blow up
TEST_STUBS="$(mktemp -d)"
cat > "$TEST_STUBS/pheno" <<'PHENO_EOF'
#!/usr/bin/env bash
case "${1:-}" in
  run)
    case "${2:-}" in
      *tailscale*) echo '{}' ;;
      *curl*)      exit 1 ;;
      *launchctl*) echo no ;;
      *)           echo stub ;;
    esac ;;
  ts) echo "100.64.0.1" ;;
  *)  echo stub ;;
esac
PHENO_EOF
cat > "$TEST_STUBS/vercel" <<'VERCEL_EOF'
#!/usr/bin/env bash
echo "stub vercel $*"
VERCEL_EOF
cat > "$TEST_STUBS/tailscale" <<'TS_EOF'
#!/usr/bin/env bash
case "${1:-}" in
  status) echo '{}' ;;
  *) echo stub ;;
esac
TS_EOF
cat > "$TEST_STUBS/yq" <<'EOF'
#!/usr/bin/env bash
python3 -c "import sys,yaml,json;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))" "$1"
EOF
chmod +x "$TEST_STUBS"/*

echo "[1/4] argis help shows the deploy-plane aliases"
help_out=$("$ARGIS" 2>&1)
for sub in "argis test" "argis doctor" "argis release" "argis matrix" "argis proccompose"; do
  echo "$help_out" | grep -qF "$sub" && report "help lists '$sub'" ok || report "help lists '$sub'" fail
done

echo "[2/4] argis doctor proxies to proccompose doctor"
PATH="$TEST_STUBS:$PATH" doctor_out=$("$ARGIS" doctor 2>&1)
echo "$doctor_out" | grep -q "prerequisites met" && report "argis doctor: prerequisites met" ok || report "argis doctor: prerequisites met" fail
echo "$doctor_out" | grep -q "pheno present" && report "argis doctor: pheno check" ok || report "argis doctor: pheno check" fail

echo "[3/4] argis test proxies to cmd_test (5 gates)"
PATH="$TEST_STUBS:$PATH" test_out=$("$ARGIS" test 2>&1)
echo "$test_out" | grep -q "all 5 gates passed" && report "argis test: 5 gates pass" ok || report "argis test: 5 gates pass" fail
echo "$test_out" | grep -q "v4 test suite complete" && report "argis test: suite complete message" ok || report "argis test: suite complete message" fail

echo "[4/4] argis proccompose <sub> passes through"
PATH="$TEST_STUBS:$PATH" pass_out=$("$ARGIS" proccompose help 2>&1)
echo "$pass_out" | grep -q "argismonitor v4 process composition" && report "argis proccompose: passthrough works" ok || report "argis proccompose: passthrough works" fail

rm -rf "$TEST_STUBS"

echo ""
echo "=================================="
echo "RESULTS:  $PASS passed,  $FAIL failed"
echo "=================================="
exit $FAIL
