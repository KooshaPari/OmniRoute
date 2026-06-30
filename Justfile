# justfile for OmniRoute — https://just.systems
# Run `just` (or `just default`) to list recipes.

set dotenv-load
set shell := ["bash", "-uc"]

# Default — list available recipes
default:
    @just --list

# Install dependencies
install:
    npm install

# Start the Next.js dev server
dev:
    npm run dev

# Produce release artifacts (Next.js isolated build)
build:
    npm run build

# Run the unit test suite
test:
    npm run test

# Coverage report (SSOT for how to measure coverage)
coverage:
    npm test -- --coverage

# Lint the project (ESLint)
lint:
    npm run lint

# Apply formatter (Prettier)
fmt:
    npx --yes prettier --write .

# Type-check (TypeScript)
typecheck:
    npx tsc --noEmit

# Security advisories (npm audit)
audit:
    npm audit --omit=dev || true

# License + advisory + ban + source checks (no-op for Node — npm audit covers this)
deny:
    @echo "deny: no-op (Rust-only concept); use 'just audit' for Node dep security"

# Fleet-wide grading gate (uses vendored or central grade.sh)
grade:
    @if [ -f grade.sh ]; then ./grade.sh; \
    elif [ -f ../grade.sh ]; then bash ../grade.sh; \
    else echo "no grade.sh found (vendored or central)"; exit 1; \
    fi

grade-fast:
    @if [ -f grade.sh ]; then ./grade.sh --fast; \
    elif [ -f ../grade.sh ]; then bash ../grade.sh --fast; \
    else echo "no grade.sh found"; exit 1; \
    fi

# CI: install + build + test + lint + audit
ci: install build test lint audit deny

# Remove build artifacts and caches
clean:
    rm -rf .next .turbo out dist build node_modules/.cache
    rm -rf open-sse/dist open-sse/build
    rm -rf coverage

# ─── Shell bootstrap (added 2026-06-30, cross-platform Mac+Win parity) ────────
# Bootstraps the dev environment for the current platform.
# macOS / Linux  → scripts/bootstrap.sh
# Windows (PS)   → scripts/setup-windows.ps1
[group: 'setup']
bootstrap:
    @if [[ "$(uname -s)" == "MINGW"* || "$(uname -s)" == "CYGWIN"* || "$OS" == "Windows_NT" ]]; then \
        powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1; \
    else \
        bash scripts/bootstrap.sh; \
    fi

# Fast variant: PATH + env only, no tool installs.
[group: 'setup']
bootstrap-fast:
    @if [[ "$(uname -s)" == "MINGW"* || "$(uname -s)" == "CYGWIN"* || "$OS" == "Windows_NT" ]]; then \
        powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1 -Fast; \
    else \
        OMNI_FAST=1 bash scripts/bootstrap.sh; \
    fi

# CI variant: skip dep installs entirely (assumes pre-baked image).
[group: 'setup']
bootstrap-ci:
    @if [[ "$(uname -s)" == "MINGW"* || "$(uname -s)" == "CYGWIN"* || "$OS" == "Windows_NT" ]]; then \
        powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1 -SkipDeps; \
    else \
        OMNI_SKIP_DEPS=1 bash scripts/bootstrap.sh; \
    fi

# ─── Sanity check ─────────────────────────────────────────────────────────────
[group: 'check']
shell-doctor:
    @echo "platform: $(uname -s)"
    @echo "shell:    ${SHELL}"
    @echo "node:     $(command -v node || echo MISSING) ($(node --version 2>/dev/null || echo n/a))"
    @echo "bun:      $(command -v bun || echo MISSING)"
    @echo "npm:      $(command -v npm || echo MISSING)"
    @echo "envrc:    $(test -f .envrc && echo present || echo absent)"
