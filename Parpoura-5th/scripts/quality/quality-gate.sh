#!/usr/bin/env bash
# quality-gate.sh — 9-gate quality system for per-project CI/pre-push use
# Language-agnostic: auto-detects stack from marker files
# Gates: syntax, lint, type-safety, tests, coverage, security, complexity, duplication, dependencies
set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
CONFIG_FILE="${QUALITY_GATE_CONFIG:-${PROJECT_DIR}/quality-gate.yml}"

# --- Defaults (overridden by quality-gate.yml) ---
COVERAGE_THRESHOLD=80
CYCLOMATIC_MAX=10
COGNITIVE_MAX=15
MAX_FUNCTION_LINES=40
DUPLICATION_THRESHOLD=5
TIMEOUT_PER_GATE=60
FAIL_FAST="${QUALITY_GATE_FAIL_FAST:-false}"
VERBOSE="${QUALITY_GATE_VERBOSE:-false}"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# --- State ---
TOTAL_GATES=0
PASSED_GATES=0
FAILED_GATES=0
SKIPPED_GATES=0
GATE_RESULTS=()
START_TIME=$(date +%s)

# --- Utility ---
log_gate() {
  local gate_num="$1" gate_name="$2" status="$3" detail="${4:-}"
  TOTAL_GATES=$((TOTAL_GATES + 1))
  case "${status}" in
    PASS)
      PASSED_GATES=$((PASSED_GATES + 1))
      GATE_RESULTS+=("${GREEN}PASS${NC} Gate ${gate_num}: ${gate_name}")
      [[ "${VERBOSE}" == "true" ]] && printf "${GREEN}[PASS]${NC} Gate %s: %s\n" "${gate_num}" "${gate_name}"
      ;;
    FAIL)
      FAILED_GATES=$((FAILED_GATES + 1))
      GATE_RESULTS+=("${RED}FAIL${NC} Gate ${gate_num}: ${gate_name} — ${detail}")
      printf "${RED}[FAIL]${NC} Gate %s: %s — %s\n" "${gate_num}" "${gate_name}" "${detail}" >&2
      [[ "${FAIL_FAST}" == "true" ]] && print_summary && exit 1
      ;;
    SKIP)
      SKIPPED_GATES=$((SKIPPED_GATES + 1))
      GATE_RESULTS+=("${YELLOW}SKIP${NC} Gate ${gate_num}: ${gate_name} — ${detail}")
      [[ "${VERBOSE}" == "true" ]] && printf "${YELLOW}[SKIP]${NC} Gate %s: %s — %s\n" "${gate_num}" "${gate_name}" "${detail}"
      ;;
  esac
}

tool_exists() { command -v "$1" &>/dev/null; }

run_timed() {
  local timeout_s="${TIMEOUT_PER_GATE}"
  if tool_exists timeout; then
    timeout "${timeout_s}" "$@" 2>&1
  elif tool_exists gtimeout; then
    gtimeout "${timeout_s}" "$@" 2>&1
  else
    "$@" 2>&1
  fi
}

print_summary() {
  local end_time elapsed
  end_time=$(date +%s)
  elapsed=$((end_time - START_TIME))
  echo ""
  printf "${BOLD}=== Quality Gate Summary ===${NC}\n"
  for r in "${GATE_RESULTS[@]}"; do
    printf "  %b\n" "${r}"
  done
  echo ""
  printf "  Passed: ${GREEN}%d${NC}  Failed: ${RED}%d${NC}  Skipped: ${YELLOW}%d${NC}  Time: %ds\n" \
    "${PASSED_GATES}" "${FAILED_GATES}" "${SKIPPED_GATES}" "${elapsed}"
  if [[ "${FAILED_GATES}" -gt 0 ]]; then
    printf "\n  ${RED}${BOLD}QUALITY GATE: FAILED${NC}\n"
  else
    printf "\n  ${GREEN}${BOLD}QUALITY GATE: PASSED${NC}\n"
  fi
}

# --- Stack Detection ---
detect_stacks() {
  HAS_PYTHON=false
  HAS_GO=false
  HAS_NODE=false
  HAS_RUST=false
  HAS_SHELL=false
  [[ -f "${PROJECT_DIR}/pyproject.toml" ]] || [[ -f "${PROJECT_DIR}/setup.py" ]] || [[ -f "${PROJECT_DIR}/requirements.txt" ]] && HAS_PYTHON=true
  [[ -f "${PROJECT_DIR}/go.mod" ]] && HAS_GO=true
  [[ -f "${PROJECT_DIR}/package.json" ]] && HAS_NODE=true
  [[ -f "${PROJECT_DIR}/Cargo.toml" ]] && HAS_RUST=true
  # Shell scripts are always checked if present
  if compgen -G "${PROJECT_DIR}/**/*.sh" >/dev/null 2>&1 || compgen -G "${PROJECT_DIR}/scripts/*.sh" >/dev/null 2>&1; then
    HAS_SHELL=true
  fi
}

# --- Config Loading ---
load_config() {
  if [[ -f "${CONFIG_FILE}" ]] && tool_exists yq; then
    COVERAGE_THRESHOLD=$(yq -r '.thresholds.coverage // 80' "${CONFIG_FILE}" 2>/dev/null || echo 80)
    CYCLOMATIC_MAX=$(yq -r '.thresholds.cyclomatic_complexity // 10' "${CONFIG_FILE}" 2>/dev/null || echo 10)
    COGNITIVE_MAX=$(yq -r '.thresholds.cognitive_complexity // 15' "${CONFIG_FILE}" 2>/dev/null || echo 15)
    MAX_FUNCTION_LINES=$(yq -r '.thresholds.max_function_lines // 40' "${CONFIG_FILE}" 2>/dev/null || echo 40)
    DUPLICATION_THRESHOLD=$(yq -r '.thresholds.duplication_pct // 5' "${CONFIG_FILE}" 2>/dev/null || echo 5)
    TIMEOUT_PER_GATE=$(yq -r '.thresholds.timeout_per_gate // 60' "${CONFIG_FILE}" 2>/dev/null || echo 60)
  elif [[ -f "${PROJECT_DIR}/.qa-config.json" ]] && tool_exists jq; then
    COVERAGE_THRESHOLD=$(jq -r '.coverage_threshold // 80' "${PROJECT_DIR}/.qa-config.json" 2>/dev/null || echo 80)
    CYCLOMATIC_MAX=$(jq -r '.cyclomatic_max // 10' "${PROJECT_DIR}/.qa-config.json" 2>/dev/null || echo 10)
    COGNITIVE_MAX=$(jq -r '.cognitive_max // 15' "${PROJECT_DIR}/.qa-config.json" 2>/dev/null || echo 15)
    DUPLICATION_THRESHOLD=$(jq -r '.max_duplication_pct // 5' "${PROJECT_DIR}/.qa-config.json" 2>/dev/null || echo 5)
  fi
}

# --- Changed files (for targeted runs) ---
get_target_files() {
  local ext="$1"
  if [[ "${QUALITY_GATE_ALL_FILES:-false}" == "true" ]]; then
    /usr/bin//usr/bin/find "${PROJECT_DIR}" -name "*.${ext}" -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/vendor/*" -not -path "*/.git/*" 2>/dev/null
  else
    git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null | /usr/bin/grep -E "\.${ext}$" || true
  fi
}

# ============================================================
# GATE 1: Syntax Validation (fast-fail)
# ============================================================
gate_1_syntax() {
  local errors=0 detail=""

  if [[ "${HAS_PYTHON}" == "true" ]]; then
    local py_files
    py_files=$(get_target_files "py")
    if [[ -n "${py_files}" ]]; then
      while IFS= read -r f; do
        if ! python3 -c "import ast; ast.parse(open('${f}').read())" 2>/dev/null; then
          errors=$((errors + 1))
          detail+="${f} "
        fi
      done <<<"${py_files}"
    fi
  fi

  if [[ "${HAS_NODE}" == "true" ]]; then
    for ext in ts tsx js jsx; do
      local js_files
      js_files=$(get_target_files "${ext}")
      if [[ -n "${js_files}" ]] && tool_exists node; then
        while IFS= read -r f; do
          if ! node --check "${f}" 2>/dev/null; then
            errors=$((errors + 1))
            detail+="${f} "
          fi
        done <<<"${js_files}"
      fi
    done
  fi

  if [[ "${HAS_GO}" == "true" ]] && tool_exists go; then
    if ! (cd "${PROJECT_DIR}" && go build ./... 2>/dev/null); then
      errors=$((errors + 1))
      detail+="go build failed "
    fi
  fi

  if [[ "${HAS_RUST}" == "true" ]] && tool_exists cargo; then
    if ! (cd "${PROJECT_DIR}" && cargo check --quiet 2>/dev/null); then
      errors=$((errors + 1))
      detail+="cargo check failed "
    fi
  fi

  if [[ "${HAS_SHELL}" == "true" ]]; then
    local sh_files
    sh_files=$(get_target_files "sh")
    if [[ -n "${sh_files}" ]]; then
      while IFS= read -r f; do
        if ! bash -n "${f}" 2>/dev/null; then
          errors=$((errors + 1))
          detail+="${f} "
        fi
      done <<<"${sh_files}"
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 1 "Syntax Validation" PASS
  else
    log_gate 1 "Syntax Validation" FAIL "${errors} file(s): ${detail}"
  fi
}

# ============================================================
# GATE 2: Linting
# ============================================================
gate_2_lint() {
  local errors=0 detail=""

  # Python: ruff
  if [[ "${HAS_PYTHON}" == "true" ]]; then
    if tool_exists ruff; then
      local out
      out=$(run_timed ruff check "${PROJECT_DIR}" --no-fix 2>&1) || true
      if [[ -n "${out}" ]] && echo "${out}" | /usr/bin/grep -qE "^Found [1-9]"; then
        local count
        count=$(echo "${out}" | /usr/bin/grep -oE "^Found [0-9]+" | /usr/bin/grep -oE "[0-9]+" || echo "?")
        errors=$((errors + 1))
        detail+="ruff: ${count} issues "
      fi
    else
      log_gate 2 "Linting" SKIP "ruff not installed (Python)"
      return
    fi
  fi

  # JS/TS: oxlint or eslint
  if [[ "${HAS_NODE}" == "true" ]]; then
    if tool_exists oxlint; then
      if ! run_timed oxlint "${PROJECT_DIR}" >/dev/null 2>&1; then
        errors=$((errors + 1))
        detail+="oxlint: issues found "
      fi
    elif tool_exists eslint; then
      if ! run_timed eslint "${PROJECT_DIR}" --quiet >/dev/null 2>&1; then
        errors=$((errors + 1))
        detail+="eslint: issues found "
      fi
    fi
  fi

  # Go: golangci-lint
  if [[ "${HAS_GO}" == "true" ]]; then
    if tool_exists golangci-lint; then
      if ! (cd "${PROJECT_DIR}" && run_timed golangci-lint run ./... >/dev/null 2>&1); then
        errors=$((errors + 1))
        detail+="golangci-lint: issues found "
      fi
    fi
  fi

  # Shell: shellcheck
  if [[ "${HAS_SHELL}" == "true" ]] && tool_exists shellcheck; then
    local sh_files
    sh_files=$(/usr/bin/find "${PROJECT_DIR}" -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null)
    if [[ -n "${sh_files}" ]]; then
      local sh_errors=0
      while IFS= read -r f; do
        if ! shellcheck "${f}" >/dev/null 2>&1; then
          sh_errors=$((sh_errors + 1))
        fi
      done <<<"${sh_files}"
      if [[ "${sh_errors}" -gt 0 ]]; then
        errors=$((errors + 1))
        detail+="shellcheck: ${sh_errors} file(s) "
      fi
    fi
  fi

  # Rust: clippy
  if [[ "${HAS_RUST}" == "true" ]] && tool_exists cargo; then
    if ! (cd "${PROJECT_DIR}" && run_timed cargo clippy --quiet -- -D warnings >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="clippy: issues found "
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 2 "Linting" PASS
  else
    log_gate 2 "Linting" FAIL "${detail}"
  fi
}

# ============================================================
# GATE 3: Type Safety
# ============================================================
gate_3_type_safety() {
  local errors=0 detail=""

  # Python: ty or mypy or pyright
  if [[ "${HAS_PYTHON}" == "true" ]]; then
    if tool_exists ty; then
      if ! run_timed ty check "${PROJECT_DIR}" >/dev/null 2>&1; then
        errors=$((errors + 1))
        detail+="ty: type errors "
      fi
    elif tool_exists mypy; then
      if ! run_timed mypy "${PROJECT_DIR}" --ignore-missing-imports >/dev/null 2>&1; then
        errors=$((errors + 1))
        detail+="mypy: type errors "
      fi
    elif tool_exists pyright; then
      if ! run_timed pyright "${PROJECT_DIR}" >/dev/null 2>&1; then
        errors=$((errors + 1))
        detail+="pyright: type errors "
      fi
    else
      log_gate 3 "Type Safety" SKIP "no Python type checker (ty/mypy/pyright)"
      return
    fi
  fi

  # TypeScript: tsc
  if [[ "${HAS_NODE}" == "true" ]] && [[ -f "${PROJECT_DIR}/tsconfig.json" ]]; then
    if tool_exists tsc; then
      if ! (cd "${PROJECT_DIR}" && run_timed tsc --noEmit >/dev/null 2>&1); then
        errors=$((errors + 1))
        detail+="tsc: type errors "
      fi
    elif tool_exists npx; then
      if ! (cd "${PROJECT_DIR}" && run_timed npx tsc --noEmit >/dev/null 2>&1); then
        errors=$((errors + 1))
        detail+="tsc(npx): type errors "
      fi
    fi
  fi

  # Go: go vet
  if [[ "${HAS_GO}" == "true" ]] && tool_exists go; then
    if ! (cd "${PROJECT_DIR}" && run_timed go vet ./... >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="go vet: issues found "
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 3 "Type Safety" PASS
  else
    log_gate 3 "Type Safety" FAIL "${detail}"
  fi
}

# ============================================================
# GATE 4: Tests
# ============================================================
gate_4_tests() {
  local ran=false errors=0 detail=""

  # Python: pytest
  if [[ "${HAS_PYTHON}" == "true" ]]; then
    if tool_exists pytest; then
      ran=true
      if ! (cd "${PROJECT_DIR}" && run_timed pytest -q --tb=short 2>&1); then
        errors=$((errors + 1))
        detail+="pytest failed "
      fi
    elif [[ -f "${PROJECT_DIR}/pyproject.toml" ]] && tool_exists uv; then
      ran=true
      if ! (cd "${PROJECT_DIR}" && run_timed uv run pytest -q --tb=short 2>&1); then
        errors=$((errors + 1))
        detail+="pytest(uv) failed "
      fi
    fi
  fi

  # Node: vitest or jest
  if [[ "${HAS_NODE}" == "true" ]]; then
    if [[ -f "${PROJECT_DIR}/vitest.config.ts" ]] || [[ -f "${PROJECT_DIR}/vitest.config.js" ]]; then
      ran=true
      if ! (cd "${PROJECT_DIR}" && run_timed npx vitest run --reporter=verbose 2>&1); then
        errors=$((errors + 1))
        detail+="vitest failed "
      fi
    elif tool_exists jest || [[ -f "${PROJECT_DIR}/jest.config.js" ]]; then
      ran=true
      if ! (cd "${PROJECT_DIR}" && run_timed npx jest --passWithNoTests 2>&1); then
        errors=$((errors + 1))
        detail+="jest failed "
      fi
    fi
  fi

  # Go: go test
  if [[ "${HAS_GO}" == "true" ]] && tool_exists go; then
    ran=true
    if ! (cd "${PROJECT_DIR}" && run_timed go test ./... -count=1 2>&1); then
      errors=$((errors + 1))
      detail+="go test failed "
    fi
  fi

  # Rust: cargo test
  if [[ "${HAS_RUST}" == "true" ]] && tool_exists cargo; then
    ran=true
    if ! (cd "${PROJECT_DIR}" && run_timed cargo test --quiet 2>&1); then
      errors=$((errors + 1))
      detail+="cargo test failed "
    fi
  fi

  if [[ "${ran}" == "false" ]]; then
    log_gate 4 "Tests" SKIP "no test runner detected"
  elif [[ "${errors}" -eq 0 ]]; then
    log_gate 4 "Tests" PASS
  else
    log_gate 4 "Tests" FAIL "${detail}"
  fi
}

# ============================================================
# GATE 5: Coverage
# ============================================================
gate_5_coverage() {
  local coverage=-1 detail=""

  # Python: coverage via pytest-cov
  if [[ "${HAS_PYTHON}" == "true" ]] && tool_exists pytest; then
    local cov_out
    cov_out=$(cd "${PROJECT_DIR}" && run_timed pytest --cov --cov-report=term-missing -q 2>&1) || true
    local pct
    pct=$(echo "${cov_out}" | /usr/bin/grep -oE "TOTAL[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+([0-9]+)%" | /usr/bin/grep -oE "[0-9]+%" | tr -d '%' || true)
    if [[ -n "${pct}" ]]; then
      coverage="${pct}"
    fi
  fi

  # Go: go test -cover
  if [[ "${HAS_GO}" == "true" ]] && tool_exists go && [[ "${coverage}" == "-1" ]]; then
    local cov_out
    cov_out=$(cd "${PROJECT_DIR}" && run_timed go test ./... -cover 2>&1) || true
    local pct
    pct=$(echo "${cov_out}" | /usr/bin/grep -oE "coverage: [0-9]+\.[0-9]+%" | head -1 | /usr/bin/grep -oE "[0-9]+" | head -1 || true)
    if [[ -n "${pct}" ]]; then
      coverage="${pct}"
    fi
  fi

  if [[ "${coverage}" == "-1" ]]; then
    log_gate 5 "Coverage (>=${COVERAGE_THRESHOLD}%)" SKIP "no coverage data"
  elif [[ "${coverage}" -ge "${COVERAGE_THRESHOLD}" ]]; then
    log_gate 5 "Coverage (>=${COVERAGE_THRESHOLD}%)" PASS "${coverage}%"
  else
    log_gate 5 "Coverage (>=${COVERAGE_THRESHOLD}%)" FAIL "${coverage}% < ${COVERAGE_THRESHOLD}%"
  fi
}

# ============================================================
# GATE 6: Security
# ============================================================
gate_6_security() {
  local errors=0 detail=""

  # Python: bandit
  if [[ "${HAS_PYTHON}" == "true" ]] && tool_exists bandit; then
    local out
    out=$(run_timed bandit -r "${PROJECT_DIR}" -q --skip B101 -f json 2>/dev/null) || true
    local sev_count
    sev_count=$(echo "${out}" | jq -r '.results | length' 2>/dev/null || echo "0")
    if [[ "${sev_count}" -gt 0 ]]; then
      errors=$((errors + 1))
      detail+="bandit: ${sev_count} issues "
    fi
  fi

  # Go: gosec
  if [[ "${HAS_GO}" == "true" ]] && tool_exists gosec; then
    if ! (cd "${PROJECT_DIR}" && run_timed gosec -quiet ./... >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="gosec: issues found "
    fi
  fi

  # Secrets: gitleaks
  if tool_exists gitleaks; then
    if ! run_timed gitleaks detect --source "${PROJECT_DIR}" --no-git --quiet >/dev/null 2>&1; then
      errors=$((errors + 1))
      detail+="gitleaks: secrets detected "
    fi
  fi

  # Node: npm audit (high/critical only)
  if [[ "${HAS_NODE}" == "true" ]] && [[ -f "${PROJECT_DIR}/package-lock.json" ]] && tool_exists npm; then
    local audit_out
    audit_out=$(cd "${PROJECT_DIR}" && npm audit --audit-level=high --json 2>/dev/null) || true
    local vuln_count
    vuln_count=$(echo "${audit_out}" | jq -r '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' 2>/dev/null || echo "0")
    if [[ "${vuln_count}" -gt 0 ]]; then
      errors=$((errors + 1))
      detail+="npm audit: ${vuln_count} high/critical "
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 6 "Security" PASS
  else
    log_gate 6 "Security" FAIL "${detail}"
  fi
}

# ============================================================
# GATE 7: Complexity
# ============================================================
gate_7_complexity() {
  local errors=0 detail=""

  # Python: radon for cyclomatic complexity
  if [[ "${HAS_PYTHON}" == "true" ]] && tool_exists radon; then
    local out
    out=$(run_timed radon cc "${PROJECT_DIR}" -s -n C 2>/dev/null) || true
    if [[ -n "${out}" ]] && [[ "${out}" =~ [^[:space:]] ]]; then
      local high_count
      high_count=$(echo "${out}" | /usr/bin/grep -cE "^\s+[A-Z] " || echo "0")
      if [[ "${high_count}" -gt 0 ]]; then
        errors=$((errors + 1))
        detail+="radon: ${high_count} functions >CC${CYCLOMATIC_MAX} "
      fi
    fi
  fi

  # Cognitive complexity via custom check (Python)
  if [[ "${HAS_PYTHON}" == "true" ]] && tool_exists ruff; then
    local out
    out=$(run_timed ruff check "${PROJECT_DIR}" --select C901 --no-fix 2>&1) || true
    if [[ -n "${out}" ]] && echo "${out}" | /usr/bin/grep -qE "^Found [1-9]"; then
      errors=$((errors + 1))
      detail+="ruff C901: complex functions "
    fi
  fi

  # Go: gocyclo
  if [[ "${HAS_GO}" == "true" ]] && tool_exists gocyclo; then
    local out
    out=$(run_timed gocyclo -over "${CYCLOMATIC_MAX}" "${PROJECT_DIR}" 2>/dev/null) || true
    if [[ -n "${out}" ]] && [[ "${out}" =~ [^[:space:]] ]]; then
      local count
      count=$(echo "${out}" | wc -l | tr -d ' ')
      errors=$((errors + 1))
      detail+="gocyclo: ${count} functions >CC${CYCLOMATIC_MAX} "
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 7 "Complexity (CC<=${CYCLOMATIC_MAX}, Cog<=${COGNITIVE_MAX})" PASS
  else
    log_gate 7 "Complexity (CC<=${CYCLOMATIC_MAX}, Cog<=${COGNITIVE_MAX})" FAIL "${detail}"
  fi
}

# ============================================================
# GATE 8: Duplication
# ============================================================
gate_8_duplication() {
  if ! tool_exists jscpd; then
    log_gate 8 "Duplication (<${DUPLICATION_THRESHOLD}%)" SKIP "jscpd not installed"
    return
  fi

  local out
  out=$(run_timed jscpd "${PROJECT_DIR}" \
    --threshold "${DUPLICATION_THRESHOLD}" \
    --reporters console \
    --ignore "**/node_modules/**,**/.venv/**,**/vendor/**,**/.git/**" \
    --min-lines 5 --min-tokens 50 2>&1) || true

  if echo "${out}" | /usr/bin/grep -qiE "duplicat.*found|clones found"; then
    local pct
    pct=$(echo "${out}" | /usr/bin/grep -oE "[0-9]+\.[0-9]+%" | head -1 || echo "?")
    log_gate 8 "Duplication (<${DUPLICATION_THRESHOLD}%)" FAIL "duplication: ${pct}"
  else
    log_gate 8 "Duplication (<${DUPLICATION_THRESHOLD}%)" PASS
  fi
}

# ============================================================
# GATE 9: Dependencies
# ============================================================
gate_9_dependencies() {
  local errors=0 detail=""

  # Python: pip-audit
  if [[ "${HAS_PYTHON}" == "true" ]] && tool_exists pip-audit; then
    local out
    out=$(run_timed pip-audit --strict 2>&1) || true
    if echo "${out}" | /usr/bin/grep -qiE "found [1-9].*vulnerabilit"; then
      errors=$((errors + 1))
      detail+="pip-audit: vulnerabilities "
    fi
  fi

  # Node: npm audit
  if [[ "${HAS_NODE}" == "true" ]] && [[ -f "${PROJECT_DIR}/package-lock.json" ]] && tool_exists npm; then
    if ! (cd "${PROJECT_DIR}" && npm audit --audit-level=moderate >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="npm audit: vulnerabilities "
    fi
  fi

  # Go: govulncheck
  if [[ "${HAS_GO}" == "true" ]] && tool_exists govulncheck; then
    if ! (cd "${PROJECT_DIR}" && run_timed govulncheck ./... >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="govulncheck: vulnerabilities "
    fi
  fi

  # Rust: cargo audit
  if [[ "${HAS_RUST}" == "true" ]] && tool_exists cargo-audit; then
    if ! (cd "${PROJECT_DIR}" && run_timed cargo audit --quiet >/dev/null 2>&1); then
      errors=$((errors + 1))
      detail+="cargo-audit: vulnerabilities "
    fi
  fi

  if [[ "${errors}" -eq 0 ]]; then
    log_gate 9 "Dependencies" PASS
  else
    log_gate 9 "Dependencies" FAIL "${detail}"
  fi
}

# ============================================================
# Main
# ============================================================
main() {
  printf "${BOLD}${BLUE}Running 9-Gate Quality System${NC}\n"
  printf "Project: %s\n\n" "${PROJECT_DIR}"

  detect_stacks
  load_config

  local stacks=""
  [[ "${HAS_PYTHON}" == "true" ]] && stacks+="Python "
  [[ "${HAS_GO}" == "true" ]] && stacks+="Go "
  [[ "${HAS_NODE}" == "true" ]] && stacks+="Node "
  [[ "${HAS_RUST}" == "true" ]] && stacks+="Rust "
  [[ "${HAS_SHELL}" == "true" ]] && stacks+="Shell "
  printf "Detected stacks: ${BLUE}%s${NC}\n\n" "${stacks:-none}"

  gate_1_syntax
  gate_2_lint
  gate_3_type_safety
  gate_4_tests
  gate_5_coverage
  gate_6_security
  gate_7_complexity
  gate_8_duplication
  gate_9_dependencies

  print_summary

  [[ "${FAILED_GATES}" -gt 0 ]] && exit 1
  exit 0
}

main "$@"
