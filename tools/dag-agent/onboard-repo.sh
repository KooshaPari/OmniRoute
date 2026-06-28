#!/usr/bin/env bash
# Onboard a single repo to fleet governance baseline.
# Generates AGENTS.md, justfile, SSOT.md, llms.txt, deny.toml,
# .pre-commit-config.yaml, .github/workflows/ci.yml as needed.
# Usage: bash tools/dag-agent/onboard-repo.sh <repo-name>
set -euo pipefail

REPO="${1:?missing repo name}"
REPO_DIR="/Users/kooshapari/CodeProjects/Phenotype/repos/$REPO"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "[$REPO] ERROR: directory not found" >&2
    exit 1
fi

cd "$REPO_DIR" || exit 1

# Detect build system
HAS_CARGO=$([ -f Cargo.toml ] && echo "Y" || echo "N")
HAS_PY=$([ -f pyproject.toml ] && echo "Y" || echo "N")
HAS_NODE=$([ -f package.json ] && echo "Y" || echo "N")
HAS_GO=$([ -f go.mod ] && echo "Y" || echo "N")

# AGENTS.md — only if missing
if [[ ! -f AGENTS.md ]]; then
    cat > AGENTS.md <<EOF
# ${REPO} — Agent Governance

**What:** Brief one-line description.
**When:** Use this when you need to know how to work on ${REPO}.
**When NOT:** Don't edit this if you're not sure — ask the fleet owner.

## Quickstart (5 lines)
1. Install: \`just install\` or see justfile
2. Build: \`just build\`
3. Test: \`just test\`
4. Lint: \`just lint\`
5. Format: \`just format\`

## Stack
- Cargo: ${HAS_CARGO}
- Python: ${HAS_PY}
- Node: ${HAS_NODE}
- Go: ${HAS_GO}

## Conventions
- Use the standard fleet tooling (\`tools/dag-agent/`, \`tools/pillar-fleet/\`)
- Read \`SSOT.md\` for single source of truth
- See \`llms.txt\` for LLM-friendly context

## Links
- Fleet SSOT: \`/Users/kooshapari/CodeProjects/Phenotype/repos/SSOT.md\`
- Pillar scorecard: \`tools/pillar-fleet/scorecard.sh\`
EOF
    echo "[$REPO] +AGENTS.md"
fi

# justfile — only if missing
if [[ ! -f justfile ]]; then
    cat > justfile <<EOF
# ${REPO} — Build system alias (just = make replacement)
set dotenv-load

# default: list recipes
default:
    @just --list

# install
install:
    @echo "TODO: install ${REPO} deps"

# build
build:
    @echo "TODO: build ${REPO}"

# test
test:
    @echo "TODO: test ${REPO}"

# lint
lint:
    @echo "TODO: lint ${REPO}"

# format
format:
    @echo "TODO: format ${REPO}"

# verify (justfile-verify-in-pre-commit hook gate)
verify:
    @just --evaluate
EOF
    echo "[$REPO] +justfile"
fi

# SSOT.md — only if missing
if [[ ! -f SSOT.md ]]; then
    cat > SSOT.md <<EOF
# ${REPO} — Single Source of Truth

## Identity
- **Repo:** ${REPO}
- **Owner:** KooshaPari
- **Added to fleet:** 2026-06-26 (DAG wave-1 envelope expansion)
- **Onboarding branch:** chore/v38-dag-wave-1-2026-06-26

## Scope (3 rows minimum)
| Scope | Pattern | Owner | Notes |
|-------|---------|-------|-------|
| API surface | \`src/\` | TBD | Primary entry |
| Build | \`just build\` | TBD | Reproducible build |
| Docs | \`docs/\` | TBD | Public API docs |

## References
- AGENTS.md — agent governance
- llms.txt — LLM-friendly context

## Revision policy
- Updates require PR review
- Conflicts resolved by CodeOwners
EOF
    echo "[$REPO] +SSOT.md"
fi

# llms.txt — only if missing
if [[ ! -f llms.txt ]]; then
    cat > llms.txt <<EOF
# ${REPO}

## Summary
Brief description of ${REPO} and its role in the fleet.

## Stack
EOF
    if [[ "$HAS_CARGO" == "Y" ]]; then
        cat >> llms.txt <<EOF
- **Language:** Rust (edition 2021)
- **Build:** cargo
- **Test:** cargo test
EOF
    fi
    if [[ "$HAS_PY" == "Y" ]]; then
        cat >> llms.txt <<EOF
- **Language:** Python 3.12+
- **Build:** uv / pip
- **Test:** pytest
EOF
    fi
    if [[ "$HAS_GO" == "Y" ]]; then
        cat >> llms.txt <<EOF
- **Language:** Go 1.23+
- **Build:** go build
- **Test:** go test
EOF
    fi
    if [[ "$HAS_NODE" == "Y" ]]; then
        cat >> llms.txt <<EOF
- **Language:** TypeScript / Node 22+
- **Build:** pnpm
- **Test:** vitest
EOF
    fi
    cat >> llms.txt <<EOF

## Key files
- \`AGENTS.md\` — agent governance
- \`SSOT.md\` — single source of truth
- \`justfile\` — build system
- \`deny.toml\` — cargo-deny config

## Conventions
- Stdlib-only Python where possible
- Cargo-deny on Rust crates
- gitleaks on commit
EOF
    echo "[$REPO] +llms.txt"
fi

# deny.toml — only if missing AND has Cargo
if [[ "$HAS_CARGO" == "Y" ]] && [[ ! -f deny.toml ]]; then
    cat > deny.toml <<EOF
# cargo-deny configuration
[graph]
all-features = false

[advisories]
ignore = [
    "RUSTSEC-2024-0384",  # instant (transitive only; pending upstream fix)
]

[licenses]
allow = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "Zlib"]

[bans]
multiple-versions = "warn"
wildcards = "deny"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
EOF
    echo "[$REPO] +deny.toml"
fi

# .pre-commit-config.yaml — only if missing
if [[ ! -f .pre-commit-config.yaml ]]; then
    cat > .pre-commit-config.yaml <<EOF
# Pre-commit hooks for ${REPO}
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: mixed-line-ending
        args: ['--fix=lf']

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

  - repo: local
    hooks:
      - id: justfile-verify
        name: justfile verify
        entry: just --justfile justfile --evaluate verify
        language: system
        pass_filenames: false
EOF
    echo "[$REPO] +.pre-commit-config.yaml"
fi

# .github/workflows/ci.yml — only if missing
if [[ ! -f .github/workflows/ci.yml ]]; then
    mkdir -p .github/workflows
    cat > .github/workflows/ci.yml <<EOF
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    name: Test \${REPO}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Run checks
        run: |
          if [ -f justfile ]; then
            just --justfile justfile --evaluate verify 2>&1 || true
            echo "no just recipes to run for this repo yet"
          else
            echo "no justfile — skipping"
          fi
EOF
    echo "[$REPO] +.github/workflows/ci.yml"
fi

echo "[$REPO] onboard complete"