#!/usr/bin/env bash
# conventions-lint — checks a repo against the Phenotype org conventions
# (PhenoHandbook patterns/). Local enforcement copy derived from:
#   https://github.com/KooshaPari/phenotype-org-governance/blob/main/scripts/conventions-lint.sh
#
# Usage: conventions-lint.sh [REPO_DIR]
#   REPO_DIR defaults to the current directory.
#
# Exit codes: 0 = no failures (warnings allowed), 1 = one or more FAIL checks.
# Env:
#   STRICT=1   treat warnings as failures too.
set -uo pipefail

ROOT="${1:-.}"
cd "$ROOT" || { echo "conventions-lint: cannot cd to $ROOT" >&2; exit 2; }

STRICT="${STRICT:-0}"
fails=0
warns=0

fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails+1)); }
warn() { printf 'WARN  %s\n' "$1"; warns=$((warns+1)); }
pass() { printf 'PASS  %s\n' "$1"; }

echo "== conventions-lint: $(basename "$(pwd)") =="

# --- 1. README work-state header (org convention) ---
# Expect a "> **Work state:**" blockquote near the top of README.
if [ -f README.md ]; then
  if head -n 8 README.md | grep -q "Work state:"; then
    pass "README has a work-state header"
  else
    warn "README missing work-state header (> **Work state:** ... near top)"
  fi
else
  warn "no README.md at repo root"
fi

# --- 2. Secrets convention: .env must be gitignored; .env.example committed if .env used ---
# (PhenoHandbook patterns/stack/defaults.md)
uses_env=0
[ -f .env.example ] && uses_env=1
grep -rqsI --include='*.env' '' . 2>/dev/null && uses_env=1
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  fail ".env is COMMITTED — secrets must never be in git (gitignore it; commit .env.example)"
elif [ -f .gitignore ] && grep -qE '(^|/)\.env($|[[:space:]]|/\*?)' .gitignore; then
  pass ".env is gitignored"
elif [ "$uses_env" = "1" ]; then
  warn ".env not found in .gitignore though the repo appears to use env config"
fi
if [ -f .env.example ]; then pass ".env.example present"; fi

# --- 3. Single canonical ADR home (PhenoHandbook patterns/spine-roles.md) ---
# A repo should not carry two competing TOP-LEVEL ADR dirs (adr/ AND adrs/).
if [ -d adr ] && [ -d adrs ]; then
  fail "two competing top-level ADR dirs (adr/ AND adrs/) — consolidate to one"
elif [ -d adrs ] || [ -d adr ]; then
  pass "single top-level ADR dir"
fi

# --- 4. Task runner present (PhenoHandbook patterns/tooling/task-runner.md) ---
# Justfile primary, Taskfile mirror. Warn-only (docs-only repos exempt by absence of build).
if [ -f justfile ] || [ -f Justfile ] || [ -f Taskfile.yml ] || [ -f Taskfile.yaml ]; then
  pass "task runner present (Justfile/Taskfile)"
else
  warn "no Justfile/Taskfile task runner (org convention: Justfile primary, Taskfile mirror)"
fi

# --- 5. CI hygiene: no floating ubuntu-latest, no phantom-action rot ---
# (PhenoHandbook patterns/ci/never-billable-ci.md)
if [ -d .github/workflows ]; then
  if grep -rqsE 'runs-on:\s*ubuntu-latest' .github/workflows 2>/dev/null; then
    warn "workflows use ubuntu-latest — pin ubuntu-24.04 for reproducibility"
  fi
  # Phantom-action rot class (repository-not-found refs seen org-wide).
  if grep -rqsE 'uses:\s*(trufflehog/actions|KooshaPari/phenotypeActions)' .github/workflows 2>/dev/null; then
    fail "phantom action ref (trufflehog/actions or KooshaPari/phenotypeActions) — does not resolve; use canonical action"
  fi
fi

echo "== conventions-lint: $fails fail, $warns warn =="
if [ "$fails" -gt 0 ]; then exit 1; fi
if [ "$STRICT" = "1" ] && [ "$warns" -gt 0 ]; then exit 1; fi
exit 0
