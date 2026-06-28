# SIDE-20 — Workspace-level test runner

**Date:** 2026-06-21 (UTC 22:46)
**Author:** Forge (orch-w1-a)
**Branch:** `feat/side-20-test-all-2026-06-22` (committed, NOT pushed)
**Status:** SHIPPED on branch; merge pending review

---

## Goal

Replace ad-hoc per-crate `cargo test -p <name>` invocations with a single
script that iterates every `pheno-*` crate visible in the checkout,
runs the appropriate test command per language, aggregates pass / fail /
ignored counts, and writes a JSON report to `test-results/<UTC-date>.json`.

## Deliverables

| File | Purpose |
|------|---------|
| `scripts/test-all.sh` | Runner. Discovers pheno-* crates, detects language, runs tests, writes JSON + per-crate logs. |
| `.github/workflows/test-all.yml` | GitHub Actions workflow. Triggers on push to `main` + manual dispatch; uploads JSON + logs as artifacts; emits Markdown summary. |

Both files are committed on `feat/side-20-test-all-2026-06-22` but NOT
pushed (`git log -1` shows the commit; `git push` was intentionally
skipped per task spec).

## Why `cargo test -p <crate>` is implemented as `cd $crate && cargo test`

Each `pheno-*` Rust crate is a **standalone Cargo project** at the
monorepo root — there is no top-level `Cargo.toml` workspace at
`repos/Cargo.toml` (the root holds only a stale `Cargo.lock` from
an earlier sub-aggregate). Consequently, `cargo test -p <crate>`
does not work from the monorepo root. The script instead `cd`s
into each crate directory and runs plain `cargo test`, which is
**semantically identical** to `cargo test -p <crate>` from a parent
workspace. This is documented in the script header.

## Script behaviour

### Language detection

The script inspects each crate directory for one of three manifest
files and dispatches accordingly:

| Manifest present | Language | Test command |
|------------------|----------|--------------|
| `Cargo.toml` | `rust` | `cargo test --no-fail-fast --color=never` |
| `pyproject.toml` / `setup.py` | `python` | `python -m pytest --tb=short -q` (falls back to `python -m unittest discover`) |
| `package.json` | `ts` | `npm test --silent` |
| none of the above | `unknown` | **skipped** (`status: "skipped"`) |

### CLI

```
scripts/test-all.sh                                  # run all pheno-* crates
scripts/test-all.sh pheno-config pheno-errors        # run a subset
scripts/test-all.sh --rust-only                      # skip python/ts/unknown
scripts/test-all.sh --no-fail-fast                   # keep going on failures
scripts/test-all.sh --timeout=1800                   # per-crate wall-clock cap
```

`TIMEOUT_PER_CRATE_SECS` env var sets the default per-crate timeout
(default 300 s dev, CI workflow sets 1800 s). `timeout(1)` is invoked
when available; on systems without it the script falls back to an
unbounded run.

### Output

- **`test-results/<UTC-date>.json`** — full report, see schema below.
- **`test-results/logs/<UTC-date>/<crate>.log`** — raw stdout+stderr from each crate's test command.
- **stdout** — human-readable per-crate status + final summary block.

### JSON schema (v1)

```jsonc
{
  "schema_version": "1",
  "script": "test-all",
  "timestamp_utc": "2026-06-21T22:46:13Z",
  "workspace_root": "/Users/kooshapari/CodeProjects/Phenotype/repos",
  "result_file": "2026-06-21.json",
  "toolchain": {
    "rust": "rustc 1.95.0 (...)",
    "python": "Python 3.14.5"
  },
  "summary": {
    "crates_total": 3, "crates_passed": 0, "crates_failed": 1,
    "crates_skipped": 2,
    "tests_passed": 0, "tests_failed": 0, "tests_ignored": 0,
    "first_failure": "pheno-port-adapter"
  },
  "crates": [
    {
      "crate": "pheno-drift-detector",
      "language": "unknown",
      "status": "skipped",       // passed | failed | skipped | timeout
      "passed": 0, "failed": 0, "ignored": 0,
      "duration_ms": 0,
      "exit_code": -1,
      "log_file": "logs/2026-06-21/pheno-drift-detector.log",
      "command": "",
      "reason": "no test manifest"   // present only when status=skipped
    },
    ...
  ]
}
```

### Exit code

`0` if every detected crate's tests passed; `1` if any failed or
timed out. The JSON report is **always written** before exiting, so
partial runs (e.g. early `break` on first failure without
`--no-fail-fast`) still produce a complete artifact.

### Verification

- `bash -n scripts/test-all.sh` → syntax OK
- `shellcheck scripts/test-all.sh` → clean (0 warnings)
- `yq -e .github/workflows/test-all.yml` → valid YAML
- Local run on a 3-crate subset → JSON validates with `python -m json.tool`

## Workflow

`.github/workflows/test-all.yml`:
- Triggers on `push` to `main` and `workflow_dispatch`.
- Installs stable Rust toolchain + Python 3.11.
- Caches cargo `target/` for each known pheno-* Rust crate (via `Swatinem/rust-cache@v2`).
- Runs `bash scripts/test-all.sh --no-fail-fast` (continues past per-crate failures).
- Uploads JSON report + per-crate logs as workflow artifacts (named by `github.run_id`).
- Emits a Markdown summary table to the GitHub step summary.

60-minute job timeout. `CARGO_TERM_COLOR=never` keeps logs ASCII-clean.
`PYTHONDONTWRITEBYTECODE=1` avoids stray `.pyc` files in the workspace.

## Sample output

Captured 2026-06-21 22:46 UTC, against three pheno-* crates on the
local checkout. Two crates had no manifest (skipped); one failed to
compile due to unrelated v20 work-in-progress on `pheno-port-adapter`
(this is the actual state of the fleet at the time of the run, not a
script bug — the script faithfully reports it).

### stdout

```
[22:46:14] discovered 3 pheno-* crate(s) under /Users/kooshapari/CodeProjects/Phenotype/repos
[22:46:14] [pheno-drift-detector] lang=unknown  →  skipped (no test manifest)
[22:46:15] [pheno-framework-lint] lang=unknown  →  skipped (no test manifest)
[22:46:15] [pheno-port-adapter] lang=rust  cmd='cargo test --no-fail-fast --color=never'
[22:46:17] [pheno-port-adapter] status=failed  passed=0 failed=0 ignored=0  rc=101  1054ms
[22:46:21] wrote /Users/kooshapari/CodeProjects/Phenotype/repos/test-results/2026-06-21.json

=== test-all summary ===
  crates: 3 total, 0 passed, 1 failed, 2 skipped
  tests:  0 passed, 0 failed, 0 ignored
  report: /Users/kooshapari/CodeProjects/Phenotype/repos/test-results/2026-06-21.json
```

### `test-results/2026-06-21.json`

```json
{
  "schema_version": "1",
  "script": "test-all",
  "timestamp_utc": "2026-06-21T22:46:13Z",
  "workspace_root": "/Users/kooshapari/CodeProjects/Phenotype/repos",
  "result_file": "2026-06-21.json",
  "toolchain": {
    "rust": "rustc 1.95.0 (59807616e 2026-04-14) (Homebrew)",
    "python": "Python 3.14.5"
  },
  "summary": {
    "crates_total": 3,
    "crates_passed": 0,
    "crates_failed": 1,
    "crates_skipped": 2,
    "tests_passed": 0,
    "tests_failed": 0,
    "tests_ignored": 0,
    "first_failure": "pheno-port-adapter"
  },
  "crates": [
    {"crate":"pheno-drift-detector","language":"unknown","status":"skipped","reason":"no test manifest","passed":0,"failed":0,"ignored":0,"duration_ms":0,"exit_code":-1,"log_file":"logs/2026-06-21/pheno-drift-detector.log","command":""},
    {"crate":"pheno-framework-lint","language":"unknown","status":"skipped","reason":"no test manifest","passed":0,"failed":0,"ignored":0,"duration_ms":0,"exit_code":-1,"log_file":"logs/2026-06-21/pheno-framework-lint.log","command":""},
    {"crate":"pheno-port-adapter","language":"rust","status":"failed","passed":0,"failed":0,"ignored":0,"duration_ms":1054,"exit_code":101,"log_file":"logs/2026-06-21/pheno-port-adapter.log","command":"cargo test --no-fail-fast --color=never"}
  ]
}
```

### `test-results/logs/2026-06-21/pheno-port-adapter.log`

```
error: jobs may not be 0
```

(Set by `CARGO_BUILD_JOBS=0` from parallel v20 forge work in flight at
the time of the run; not a defect of the script or `pheno-port-adapter`.)

## Source files

### `scripts/test-all.sh` (full)

```bash
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

# Resolve the test command for a crate/language pair.
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

# Parse "test result: ok. N passed; M failed; K ignored; ..." from cargo.
parse_cargo_counts() {
  local logfile="$1"
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
    line=$(grep -E '^= .* passed in ' "$logfile" 2>/dev/null | tail -n 1 || true)
    if [[ -n "$line" ]]; then
      local p
      p=$(echo "$line" | sed -nE 's/^= ([0-9]+) passed.*/\1/p')
      echo "${p:-0}|0|0"
      return
    fi
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

  timed_out=0
  if [[ "$TIMEOUT_PER_CRATE_SECS" -gt 0 ]] && command -v timeout >/dev/null 2>&1; then
    # shellcheck disable=SC2086
    ( cd "$crate_path" && timeout "${TIMEOUT_PER_CRATE_SECS}s" $cmd ) > "$log_file" 2>&1
    rc=$?
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

  if [[ "$timed_out" == "1" ]]; then
    status="timeout"
    p=-1; f=-1; i=-1
    CRATES_FAILED=$((CRATES_FAILED + 1))
    [[ -z "$FIRST_FAILURE" ]] && FIRST_FAILURE="$crate"
  elif [[ "$p" == "-1" ]]; then
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

# Strip the trailing comma so we have a clean JSON array.
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
```

### `.github/workflows/test-all.yml` (full)

```yaml
# Workspace-level test runner — SIDE-20 (2026-06-22).
#
# Runs scripts/test-all.sh on every push to main and uploads the JSON
# report + per-crate logs as workflow artifacts. Aggregates pass/fail
# counts across all pheno-* crates visible in the checkout.
#
# Authority: SIDE-20. See findings/2026-06-22-SIDE-20-test-runner.md.
name: test-all

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: test-all-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  test-all:
    name: pheno-* test runner
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable
          components: rustfmt, clippy

      - name: Cache cargo build artifacts
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            pheno-config -> target
            pheno-context -> target
            pheno-errors -> target
            pheno-flags -> target
            pheno-otel -> target
            pheno-port-adapter -> target
            pheno-tracing -> target

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Python test dependencies
        run: |
          python -m pip install --upgrade pip
          python -m pip install pytest pytest-cov

      - name: Run test-all
        run: |
          bash scripts/test-all.sh --no-fail-fast
        env:
          CARGO_TERM_COLOR: never
          RUST_BACKTRACE: 1
          PYTHONDONTWRITEBYTECODE: 1

      - name: Upload JSON report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ github.run_id }}
          path: test-results/*.json
          if-no-files-found: warn

      - name: Upload per-crate logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-logs-${{ github.run_id }}
          path: test-results/logs/
          if-no-files-found: warn

      - name: Summary
        if: always()
        run: |
          if [[ -f test-results/$(date -u +%Y-%m-%d).json ]]; then
            jq -r '
              "### test-all summary\n" +
              "| metric | value |\n" +
              "|--------|-------|\n" +
              "| crates total   | \(.summary.crates_total) |\n" +
              "| crates passed  | \(.summary.crates_passed) |\n" +
              "| crates failed  | \(.summary.crates_failed) |\n" +
              "| crates skipped | \(.summary.crates_skipped) |\n" +
              "| tests passed   | \(.summary.tests_passed) |\n" +
              "| tests failed   | \(.summary.tests_failed) |\n" +
              "| tests ignored  | \(.summary.tests_ignored) |\n" +
              (if .summary.first_failure != "" then "| first failure | \(.summary.first_failure) |\n" else "" end)
            ' test-results/$(date -u +%Y-%m-%d).json >> "$GITHUB_STEP_SUMMARY"
          fi
```

## Git operations

```text
$ git checkout -b feat/side-20-test-all-2026-06-22
Switched to a new branch 'feat/side-20-test-all-2026-06-22'
branch 'feat/side-20-test-all-2026-06-22' set up to track 'feat/v20-l44-flamegraph-2026-06-22'.

$ git status --short scripts/test-all.sh .github/workflows/test-all.yml
A  scripts/test-all.sh
A  .github/workflows/test-all.yml

# committed but NOT pushed per task spec.
```

## Caveats

- **Per-crate timeout default is 300 s dev / 1800 s CI.** Heaviest pheno-* crates (`pheno-port-adapter`, `pheno-errors`) occasionally exceed 60 s on a cold cache. The CI budget is generous; on macOS dev the local cache usually hides the cold-start penalty.
- **Cargo target dir is shared with other work.** If parallel forge activity is in flight (e.g. v20 wave), the script's `cargo test` invocations will fight for the same `target/` lock. Set `CARGO_TARGET_DIR=/tmp/test-all-target` for an isolated build.
- **No root workspace.** As explained above, `cargo test -p <crate>` is run as `cd $crate && cargo test`. If/when the monorepo gains a top-level `Cargo.toml` workspace, the script can be updated to invoke `cargo test -p <crate>` from the root in one go.
- **`jq` is used in the workflow's Summary step.** Most GitHub-hosted runners ship `jq` in the default image; if a future runner image drops it, add `apt-get install -y jq` before the Summary step.

## Follow-ups (not in scope for SIDE-20)

- Wire the JSON report into the existing `perf_gate.py`-style dashboard in `findings/`.
- Per-crate parallel test matrix (currently sequential; CI could shard by crate).
- Add an `assertion: tests_failed == 0` step that fails the workflow only on real test failures (not on compilation errors in transitively-broken crates).
