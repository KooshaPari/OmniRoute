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

# --- 6. Org-convention files present (PhenoHandbook patterns/spine-roles.md) ---
# Every Phenotype repo must carry AGENTS.md and SPEC.md; STATUS.md is
# expected for active-phase tracking.
for f in AGENTS.md SPEC.md STATUS.md; do
  if [ -f "$f" ]; then
    pass "$f present"
  else
    warn "$f missing — org convention requires this file at repo root"
  fi
done

# --- 7. YAML syntax validation ---
# Validates every .yml/.yaml file (skipping node_modules) using Python's
# yaml.safe_load. This catches syntax errors before they hit CI.
yaml_errors=0
if command -v python3 >/dev/null 2>&1; then
  yaml_output=$(python3 -c '
import os, sys, yaml
errors = 0
for root, dirs, files in os.walk("."):
    if "node_modules" in root or ".git" in root:
        continue
    for f in files:
        if not (f.endswith(".yml") or f.endswith(".yaml")):
            continue
        path = os.path.join(root, f)
        try:
            with open(path) as fp:
                yaml.safe_load(fp)
        except yaml.YAMLError as e:
            mark = getattr(e, "problem_mark", None)
            line = mark.line + 1 if mark else 0
            print(f"{path}:{line}: YAML syntax error: {e.problem if hasattr(e, "problem") else e}")
            errors += 1
sys.exit(errors)
' 2>&1) || yaml_errors=$?
  if [ "$yaml_errors" -gt 0 ]; then
    echo "$yaml_output"
    fail "$yaml_errors YAML file(s) have syntax errors (see above)"
  else
    pass "all YAML files valid"
  fi
else
  warn "python3 not available — skipping YAML validation"
fi

# --- 8. Markdown internal link integrity ---
# Checks that local file references in markdown links [text](path) resolve.
# External URLs, anchors, and mailto: links are skipped.
if command -v python3 >/dev/null 2>&1; then
  md_output=$(python3 -c '
import os, re, sys

ROOT = os.path.abspath(".")
errors = 0
LINK_RE = re.compile(r"\[([^]]*)\]\(([^)]+)\)")

for root, dirs, files in os.walk("."):
    if "node_modules" in root or ".git" in root:
        continue
    for f in files:
        if not f.endswith(".md"):
            continue
        path = os.path.join(root, f)
        with open(path, encoding="utf-8", errors="replace") as fp:
            try:
                content = fp.read()
            except Exception:
                continue
        md_dir = os.path.dirname(os.path.abspath(path))
        for m in LINK_RE.finditer(content):
            link = m.group(2).strip()
            # Strip anchor from link target before checking
            target = link.split("#")[0] if "#" in link else link
            if not target:
                continue
            # Skip external URLs and mailto
            if target.startswith(("http://", "https://", "mailto:", "ftp://")):
                continue
            # Normalize path: resolve relative to the markdown file
            abs_target = os.path.normpath(os.path.join(md_dir, target))
            # If it does not exist, try resolving relative to repo root
            if not os.path.exists(abs_target):
                root_target = os.path.normpath(os.path.join(ROOT, target))
                if not os.path.exists(root_target):
                    print(f"{path}: broken link -> {link}")
                    errors += 1

sys.exit(errors)
' 2>&1) || md_errors=$?
  if [ "${md_errors:-0}" -gt 0 ]; then
    echo "$md_output"
    warn "${md_errors:-0} markdown link(s) are broken (see above)"
  else
    pass "all markdown local links resolve"
  fi
else
  warn "python3 not available — skipping markdown link check"
fi

echo "== conventions-lint: $fails fail, $warns warn =="
if [ "$fails" -gt 0 ]; then exit 1; fi
if [ "$STRICT" = "1" ] && [ "$warns" -gt 0 ]; then exit 1; fi
exit 0
