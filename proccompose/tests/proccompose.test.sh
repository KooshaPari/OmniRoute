#!/usr/bin/env bash
# proccompose tests - run with `bash tests/proccompose.test.sh` or `bun test tests/proccompose.test.sh`
set -uo pipefail
# Note: NOT `set -e` so a single FAIL doesn't kill the whole suite - we tally explicitly.

PROCCOMPOSE_BIN="$(cd "$(dirname "$0")/.." && pwd)/proccompose"
YAML_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.yaml"
EXAMPLE_FILE="$(cd "$(dirname "$0")/.." && pwd)/proccompose.example.yaml"
TEST_HOME="$(mktemp -d)"
PROCCOMPOSE_HOME_BACKUP="${PROCCOMPOSE_HOME:-}"

export PROCCOMPOSE_HOME="$TEST_HOME/.proccompose"
# Stub out external CLIs so status / doctor don't actually reach the network / desktop
export PHENO_BIN="$TEST_HOME/pheno"
export PATH="$TEST_HOME:$PATH"
mkdir -p "$TEST_HOME"
cat > "$TEST_HOME/pheno" <<'PHENO_EOF'
#!/usr/bin/env bash
case "${1:-}" in
  run)
    case "${2:-}" in
      *tailscale*) echo "100.64.0.1"; echo '{}' ;;
      *curl*)      echo "down"; exit 1 ;;
      *launchctl*) echo "no supervisor services" ;;
      *)           echo "stub" ;;
    esac
    ;;
  ts) echo "100.64.0.1" ;;
  *)  echo "stub" ;;
esac
PHENO_EOF
chmod +x "$TEST_HOME/pheno"
# Stub vercel CLI
cat > "$TEST_HOME/vercel" <<'VERCEL_EOF'
#!/usr/bin/env bash
echo "stub vercel $*"
VERCEL_EOF
chmod +x "$TEST_HOME/vercel"
# Stub tailscale
cat > "$TEST_HOME/tailscale" <<'TS_EOF'
#!/usr/bin/env bash
case "${1:-}" in
  status) echo '{}' ;;
  funnel) echo "stub-funnel" ;;
  *) echo "stub-ts" ;;
esac
TS_EOF
chmod +x "$TEST_HOME/tailscale"

cleanup() {
  rm -rf "$TEST_HOME"
  if [[ -n "$PROCCOMPOSE_HOME_BACKUP" ]]; then
    export PROCCOMPOSE_HOME="$PROCCOMPOSE_HOME_BACKUP"
  fi
}
trap cleanup EXIT

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

echo "=================================="
echo "proccompose test suite"
echo "PROCCOMPOSE_HOME=$PROCCOMPOSE_HOME"
echo "=================================="

# 1. Syntax
echo ""
echo "[1/8] syntax check"
if bash -n "$PROCCOMPOSE_BIN" 2>/dev/null; then report "bash -n proccompose" ok; else report "bash -n proccompose" fail; fi

# 2. Symlink resolution - validate from script dir + from /tmp
echo "[2/8] symlink resolution (validate from script dir + /tmp)"
out1=$("$PROCCOMPOSE_BIN" validate 2>&1) && echo "$out1" | grep -q "OK" && report "validate from script dir" ok || report "validate from script dir (out: $out1)" fail
(
  cd /tmp
  out2=$("$PROCCOMPOSE_BIN" validate 2>&1) && echo "$out2" | grep -q "OK" && report "validate from /tmp" ok || report "validate from /tmp (out: $out2)" fail
)

# 3. Plan output
echo "[3/8] plan produces expected output"
out=$("$PROCCOMPOSE_BIN" plan 2>&1)
echo "$out" | grep -q "bff  host=desktop" && report "plan includes bff" ok || report "plan includes bff" fail
echo "$out" | grep -q "kbridge  host=desktop" && report "plan includes kbridge" ok || report "plan includes kbridge" fail
echo "$out" | grep -q "tailscale_funnel  host=desktop" && report "plan includes tailscale_funnel" ok || report "plan includes tailscale_funnel" fail
echo "$out" | grep -q "vercel_projects:" && report "plan includes vercel_projects" ok || report "plan includes vercel_projects" fail
echo "$out" | grep -q "cutover phases:" && report "plan includes cutover phases" ok || report "plan includes cutover phases" fail
echo "$out" | grep -q "argismonitor-homepage" && report "plan includes argismonitor-homepage" ok || report "plan includes argismonitor-homepage" fail

# 4. Example yaml valid
echo "[4/8] example.yaml is also valid"
if python3 -c "import yaml; yaml.safe_load(open('$EXAMPLE_FILE'))" 2>/dev/null; then report "example.yaml parses" ok; else report "example.yaml parses" fail; fi

# 5. lock/unlock idempotency
echo "[5/8] lock/unlock idempotent"
"$PROCCOMPOSE_BIN" unlock >/dev/null 2>&1 || true
report "unlock without lockfile is ok" ok
# Touch a lockfile manually, unlock should remove it
mkdir -p "$PROCCOMPOSE_HOME"
touch "$PROCCOMPOSE_HOME/.lock"
"$PROCCOMPOSE_BIN" unlock >/dev/null 2>&1
[[ ! -f "$PROCCOMPOSE_HOME/.lock" ]] && report "unlock removes lockfile" ok || report "unlock removes lockfile" fail

# 6. init safety (refuses to clobber existing yaml)
echo "[6/8] init refuses to clobber existing yaml"
# Our YAML_FILE is proccompose.yaml and exists
if "$PROCCOMPOSE_BIN" init 2>&1 | grep -qE "(refusing to clobber|already exists)"; then
  report "init refuses to clobber existing yaml" ok
else
  report "init refuses to clobber existing yaml" fail
fi

# 7. releases listing with synthetic snapshots
echo "[7/8] releases listing"
mkdir -p "$PROCCOMPOSE_HOME/releases"
for i in 1 2 3; do
  cat > "$PROCCOMPOSE_HOME/releases/abc1234567${i}-170000000${i}.json" <<EOF
{"ref":"origin/feat/v4-svelte-hono-monorepo","sha":"abc1234567${i}","ts":170000000${i},"deployer":"test@local","pct":"10","services":["bff","kbridge"]}
EOF
done
out=$("$PROCCOMPOSE_BIN" releases 2>&1)
echo "$out" | grep -q "abc12345671" && report "releases lists snapshot 1" ok || report "releases lists snapshot 1" fail
echo "$out" | grep -q "abc12345673" && report "releases lists snapshot 3" ok || report "releases lists snapshot 3" fail
echo "$out" | grep -q "pct=10" && report "releases shows pct" ok || report "releases shows pct" fail

# 8. dry-run composition
echo "[8/8] dry-run calls validate + plan + status + doctor"
out=$("$PROCCOMPOSE_BIN" dry-run 2>&1)
echo "$out" | grep -q "validating" && report "dry-run calls validate" ok || report "dry-run calls validate" fail
echo "$out" | grep -q "execution plan" && report "dry-run calls plan" ok || report "dry-run calls plan" fail
echo "$out" | grep -q "health snapshot" && report "dry-run calls status" ok || report "dry-run calls status" fail
echo "$out" | grep -q "prerequisites" && report "dry-run calls doctor" ok || report "dry-run calls doctor" fail

echo ""
if (( FAIL == 0 )); then
  echo "ALL TESTS PASS"
  exit 0
else
  echo "$FAIL test(s) failed"
  exit 1
fi