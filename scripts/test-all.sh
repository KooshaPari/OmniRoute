#!/usr/bin/env bash
# scripts/test-all.sh — SIDE-20 workspace-level test runner.
#
# Iterates every pheno-* crate visible on this checkout, detects its
# primary language by manifest file, and runs the appropriate test
# command (cargo test for Rust, pytest for Python, npm test for
# TypeScript). Aggregates pass/fail/ignored counts per crate and
# writes a structured JSON report to test-results/<UTC-date>.json.
#
# Usage:
#   scripts/test-all.sh                      # run all pheno-* crates
#   scripts/test-all.sh pheno-config pheno-errors   # run a subset
#   scripts/test-all.sh --rust-only          # skip python/ts/unknown
#   scripts/test-all.sh --no-fail-fast       # keep going on failures
#
# Authority: SIDE-20 (2026-06-22). See findings/2026-06-22-SIDE-20-test-runner.md.
#
# Exit code: 0 if every detected crate's tests passed; 1 otherwise.
# Always writes the JSON report before exiting so partial runs still
# produce a result file.

set -uo pipefail

# ── Defaults ────────────────────────────────────────────────────────────
SCRIPT_NAME="test-all"
SCHEMA_VERSION="1"
WORKSPACE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TEST_RESULTS_DIR="${WORKSPACE_ROOT}/test-results"
RUST_ONLY=0
PYTHON_ONLY=0
NO_FAIL_FAST=0
SELECTED_CRATES=()
UTC_DATE="$(date -u +%Y-%m-%d)"
UTC_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESULT_FILE="${TEST_RESULTS_DIR}/${UTC_DATE}.json"
LOGS_DIR="${TEST_RESULTS_DIR}/logs/${UTC_DATE}"
# Per-crate wall-clock budget in seconds. 0 = no timeout.
# Override via TIMEOUT_PER_CRATE_SECS env var (CI: 1800, dev: 120).
TIMEOUT_PER_CRATE_SECS="${TIMEOUT_PER_CRATE_SECS:-300}"

# ── Args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --rust-only)         RUST_ONLY=1 ;;
    --python-only)       PYTHON_ONLY=1 ;;
    --no-fail-fast)      NO_FAIL_FAST=1 ;;
    --timeout=*)         TIMEOUT_PER_CRATE_SECS="${arg#--timeout=}" ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    --*)                 echo "unknown flag: $arg" >&2; exit 2 ;;
    *)                   SELECTED_CRATES+=("$arg") ;;
  esac
done

mkdir -p "$TEST_RESULTS_DIR" "$LOGS_DIR"

# ── Helpers ─────────────────────────────────────────────────────────────
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# Detect a crate's primary language by manifest file. Emits one of:
#   rust | python | ts | unknown
detect_language() {
  local d="$1"
  if [[ -f "$d/Cargo.toml" ]]; then
    echo "rust"
  elif [[ -f "$d/pyproject.toml" || -f "$d/setup.py" ]]; then
    echo "python"
  elif [[ -f "$d/package.json" ]]; then
    echo "ts"
  else
    echo "unknown"
  fi
}

# Resolve the test command for a crate/language pair. Echoes a
# space-separated string: "<command> | <args...>" — split by callers
# via a sentinel pipe separator.
test_command_for() {
  local lang="$1" crate="$2"
  case "$lang" in
    rust)
      # Each pheno-* Rust crate is standalone (no parent workspace at
      # the monorepo root), so `cd` into the crate and run plain
      # `cargo test`. This is equivalent to `cargo test -p <crate>`
      # from a workspace root.
      echo "cargo test --no-fail-fast --color=never"
      ;;
    python)
      if [[ -f "$crate/pyproject.toml" ]] && grep -q '\[tool.pytest' "$crate/pyproject.toml" 2>/dev/null; then
        echo "python -m pytest --tb=short -q"
      elif command -v pytest >/dev/null 2>&1; then
        echo "pytest --tb=short -q"
      else
        echo "python -m unittest discover -s tests -t . -v"
      fi
      ;;
    ts)
      echo "npm test --silent"
      ;;
    *)
      echo ""
      ;;
  esac
}

# Parse "test result: ok. N passed; M failed; K ignored; ..." from cargo
# output. Echoes "passed|failed|ignored" with -1 for unknown.
parse_cargo_counts() {
  local logfile="$1"
  # The summary line looks like: "test result: ok. 42 passed; 0 failed; 0 ignored; ..."
  # or "test result: FAILED. 5 passed; 3 failed; 0 ignored; ..."
  # Pull the LAST occurrence (cargo prints one per test binary).
  local line
  line=$(grep -E '^test result:' "$logfile" 2>/dev/null | tail -n 1 || true)
  if [[ -z "$line" ]]; then
    echo "-1|-1|-1"
    return
  fi
  local p f i
  p=$(echo "$line" | sed -nE 's/.* ([0-9]+) passed.*/\1/p')
  f=$(echo "$line" | sed -nE 's/.* ([0-9]+) failed.*/\1/p')
  i=$(echo "$line" | sed -nE 's/.* ([0-9]+) ignored.*/\1/p')
  [[ -z "$p" ]] && p=0
  [[ -z "$f" ]] && f=0
  [[ -z "$i" ]] && i=0
  echo "${p}|${f}|${i}"
}

# Parse "= N passed, M failed, K error in T.TTs =" from pytest.
parse_pytest_counts() {
  local logfile="$1"
  local line
  line=$(grep -E '^=.*passed.*(failed|error).*in ' "$logfile" 2>/dev/null | tail -n 1 || true)
  if [[ -z "$line" ]]; then
    # All-pass form: "= N passed in T.TTs ="
    line=$(grep -E '^= .* passed in ' "$logfile" 2>/dev/null | tail -n 1 || true)
    if [[ -n "$line" ]]; then
      local p
      p=$(echo "$line" | sed -nE 's/^= ([0-9]+) passed.*/\1/p')
      echo "${p:-0}|0|0"
      return
    fi
    # All-skip form
    line=$(grep -E '^= .* skipped in ' "$logfile" 2>/dev/null | tail -n 1 || true)
    if [[ -n "$line" ]]; then
      echo "0|0|-1"
      return
    fi
    echo "-1|-1|-1"
    return
  fi
  local p f e
  p=$(echo "$line" | sed -nE 's/^= ([0-9]+) passed.*/\1/p')
  f=$(echo "$line" | sed -nE 's/.* ([0-9]+) failed.*/\1/p')
  e=$(echo "$line" | sed -nE 's/.* ([0-9]+) error.*/\1/p')
  echo "${p:-0}|${f:-0}|${e:-0}"
}

# json_escape — emit a string safely for inclusion inside a JSON value.
json_escape() {
  local s="${1//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//	/\\t}"
  printf '%s' "$s"
}

# ── Discover crates ─────────────────────────────────────────────────────
if [[ ${#SELECTED_CRATES[@]} -gt 0 ]]; then
  CRATES=("${SELECTED_CRATES[@]}")
else
  # `find` from repo root for top-level pheno-* directories only.
  # Use a portable pattern that works on both GNU find (Linux CI) and
  # BSD find (macOS dev). We strip the leading "./" prefix below.
  while IFS= read -r d; do
    d="${d#./}"
    CRATES+=("$d")
  done < <(cd "$WORKSPACE_ROOT" && find . -maxdepth 1 -mindepth 1 -type d -name 'pheno-*' | sort)
fi

if [[ ${#CRATES[@]} -eq 0 ]]; then
  log "no pheno-* crates found under ${WORKSPACE_ROOT}"
  exit 1
fi

log "discovered ${#CRATES[@]} pheno-* crate(s) under ${WORKSPACE_ROOT}"

# ── Run tests per crate ─────────────────────────────────────────────────
# We build a JSON array of per-crate result objects in a tempfile, then
# splice into the final report. This avoids quoting headaches.
PER_CRATE_JSON="$(mktemp -t test-all.XXXXXX.json)"
trap 'rm -f "$PER_CRATE_JSON"' EXIT
: > "$PER_CRATE_JSON"

TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_IGNORED=0
CRATES_PASSED=0
CRATES_FAILED=0
CRATES_SKIPPED=0
FIRST_FAILURE=""

for crate in "${CRATES[@]}"; do
  crate_path="${WORKSPACE_ROOT}/${crate}"
  if [[ ! -d "$crate_path" ]]; then
    log "WARN: ${crate} directory not found, skipping"
    continue
  fi

  lang="$(detect_language "$crate_path")"

  # Filter by language selection flags.
  if [[ "$RUST_ONLY" == "1" && "$lang" != "rust" ]]; then
    continue
  fi
  if [[ "$PYTHON_ONLY" == "1" && "$lang" != "python" ]]; then
    continue
  fi

  cmd="$(test_command_for "$lang" "$crate_path")"
  log_file="${LOGS_DIR}/${crate}.log"

  if [[ "$lang" == "unknown" || -z "$cmd" ]]; then
    log "[$crate] lang=$lang  →  skipped (no test manifest)"
    CRATES_SKIPPED=$((CRATES_SKIPPED + 1))
    cat >> "$PER_CRATE_JSON" <<EOF
{"crate":"$(json_escape "$crate")","language":"$lang","status":"skipped","reason":"no test manifest","passed":0,"failed":0,"ignored":0,"duration_ms":0,"exit_code":-1,"log_file":"$(json_escape "logs/${UTC_DATE}/${crate}.log")","command":""},
EOF
    continue
  fi

  log "[$crate] lang=$lang  cmd='$cmd'"
  start_ns=$(date +%s%N)

  # Run with an optional wall-clock timeout. `gtimeout` (macOS coreutils)
  # falls back to `timeout` (Linux CI). A zero timeout means unbounded.
  timed_out=0
  if [[ "$TIMEOUT_PER_CRATE_SECS" -gt 0 ]] && command -v timeout >/dev/null 2>&1; then
    # shellcheck disable=SC2086
    ( cd "$crate_path" && timeout "${TIMEOUT_PER_CRATE_SECS}s" $cmd ) > "$log_file" 2>&1
    rc=$?
    # timeout(1) exits 124 on timeout; mark it explicitly.
    if [[ "$rc" == "124" ]]; then timed_out=1; fi
  else
    # shellcheck disable=SC2086
    ( cd "$crate_path" && $cmd ) > "$log_file" 2>&1
    rc=$?
  fi
  end_ns=$(date +%s%N)
  duration_ms=$(( (end_ns - start_ns) / 1000000 ))

  case "$lang" in
    rust)   counts="$(parse_cargo_counts "$log_file")" ;;
    python) counts="$(parse_pytest_counts "$log_file")" ;;
    *)      counts="0|0|0" ;;
  esac
  p="${counts%%|*}"
  rest="${counts#*|}"
  f="${rest%%|*}"
  i="${rest#*|}"

  # Timeout short-circuits all status logic below.
  if [[ "$timed_out" == "1" ]]; then
    status="timeout"
    p=-1; f=-1; i=-1
    CRATES_FAILED=$((CRATES_FAILED + 1))
    [[ -z "$FIRST_FAILURE" ]] && FIRST_FAILURE="$crate"
  elif [[ "$p" == "-1" ]]; then
    # Parsing yielded no summary line — fall back to exit code.
    if [[ "$rc" == "0" ]]; then
      status="passed"
      p=0; f=0; i=0
      CRATES_PASSED=$((CRATES_PASSED + 1))
    else
      status="failed"
      p=0; f=0; i=0
      CRATES_FAILED=$((CRATES_FAILED + 1))
      [[ -z "$FIRST_FAILURE" ]] && FIRST_FAILURE="$crate"
    fi
  elif [[ "$rc" == "0" && "$f" == "0" ]]; then
    status="passed"
    CRATES_PASSED=$((CRATES_PASSED + 1))
  else
    status="failed"
    CRATES_FAILED=$((CRATES_FAILED + 1))
    [[ -z "$FIRST_FAILURE" ]] && FIRST_FAILURE="$crate"
  fi

  # Skip the totals bookkeeping for timeout entries — their counts are
  # sentinel -1 and would corrupt the aggregate sums.
  if [[ "$timed_out" != "1" ]]; then
    TOTAL_PASSED=$((TOTAL_PASSED + p))
    TOTAL_FAILED=$((TOTAL_FAILED + f))
    TOTAL_IGNORED=$((TOTAL_IGNORED + i))
  fi

  log "[$crate] status=$status  passed=$p failed=$f ignored=$i  rc=$rc  ${duration_ms}ms"

  cat >> "$PER_CRATE_JSON" <<EOF
{"crate":"$(json_escape "$crate")","language":"$lang","status":"$status","passed":$p,"failed":$f,"ignored":$i,"duration_ms":$duration_ms,"exit_code":$rc,"log_file":"$(json_escape "logs/${UTC_DATE}/${crate}.log")","command":"$(json_escape "$cmd")"},
EOF

  if [[ "$status" == "failed" && "$NO_FAIL_FAST" == "0" ]]; then
    log "stopping on first failure (re-run with --no-fail-fast to continue)"
    break
  fi
done

# Strip the trailing comma so we have a clean JSON array. Avoid
# `sed -i` (BSD/GNU differ on macOS) — use Python, which is already
# a workflow dep per test-all.yml.
if [[ -s "$PER_CRATE_JSON" ]]; then
  python3 - "$PER_CRATE_JSON" <<'PYEOF'
import sys
p = sys.argv[1]
with open(p) as f:
    lines = f.readlines()
if lines and lines[-1].rstrip().endswith(','):
    lines[-1] = lines[-1].rstrip('\n').rstrip(',') + '\n'
with open(p, 'w') as f:
    f.writelines(lines)
PYEOF
fi

# ── Toolchain info ──────────────────────────────────────────────────────
RUST_VERSION=""
if command -v cargo >/dev/null 2>&1; then
  RUST_VERSION="$(rustc --version 2>/dev/null || cargo --version)"
fi
PY_VERSION=""
if command -v python3 >/dev/null 2>&1; then
  PY_VERSION="$(python3 --version 2>&1)"
fi

# ── Emit final JSON report ──────────────────────────────────────────────
{
  printf '{\n'
  printf '  "schema_version": "%s",\n'                "$SCHEMA_VERSION"
  printf '  "script": "%s",\n'                        "$SCRIPT_NAME"
  printf '  "timestamp_utc": "%s",\n'                 "$UTC_TIMESTAMP"
  printf '  "workspace_root": "%s",\n'                "$(json_escape "$WORKSPACE_ROOT")"
  printf '  "result_file": "%s",\n'                   "$(json_escape "${UTC_DATE}.json")"
  printf '  "toolchain": {\n'
  printf '    "rust": "%s",\n'                        "$(json_escape "$RUST_VERSION")"
  printf '    "python": "%s"\n'                       "$(json_escape "$PY_VERSION")"
  printf '  },\n'
  printf '  "summary": {\n'
  printf '    "crates_total": %d,\n'                  "${#CRATES[@]}"
  printf '    "crates_passed": %d,\n'                 "$CRATES_PASSED"
  printf '    "crates_failed": %d,\n'                 "$CRATES_FAILED"
  printf '    "crates_skipped": %d,\n'                "$CRATES_SKIPPED"
  printf '    "tests_passed": %d,\n'                  "$TOTAL_PASSED"
  printf '    "tests_failed": %d,\n'                  "$TOTAL_FAILED"
  printf '    "tests_ignored": %d,\n'                 "$TOTAL_IGNORED"
  printf '    "first_failure": "%s"\n'                "$(json_escape "$FIRST_FAILURE")"
  printf '  },\n'
  printf '  "crates": [\n'
  cat "$PER_CRATE_JSON"
  printf '  ]\n'
  printf '}\n'
} > "$RESULT_FILE"

log "wrote ${RESULT_FILE}"

# Final summary line for humans reading CI logs.
echo
echo "=== ${SCRIPT_NAME} summary ==="
echo "  crates: ${#CRATES[@]} total, ${CRATES_PASSED} passed, ${CRATES_FAILED} failed, ${CRATES_SKIPPED} skipped"
echo "  tests:  ${TOTAL_PASSED} passed, ${TOTAL_FAILED} failed, ${TOTAL_IGNORED} ignored"
echo "  report: ${RESULT_FILE}"
echo

if [[ "$CRATES_FAILED" -gt 0 ]]; then
  exit 1
fi
exit 0
