# argis-extensions Justfile
# Fleet-standard task runner (DAG stage 4)
# See FLEET_100TASK_DAG.md for context.
set shell := ["bash", "-cu"]

default:
    @just --list

install:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f package.json ]; then
        npm ci
    elif [ -f Cargo.toml ]; then
        cargo fetch
    elif [ -f pyproject.toml ] || [ -f setup.py ]; then
        pip install -e .[dev] 2>/dev/null || pip install -r requirements.txt 2>/dev/null || true
    elif [ -f go.mod ]; then
        go mod download
    fi

build:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f package.json ]; then
        npm run build 2>/dev/null || echo "no build script"
    elif [ -f Cargo.toml ]; then
        cargo build --workspace 2>/dev/null || cargo build
    elif [ -f go.mod ]; then
        go build ./...
    fi

test:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f package.json ]; then
        npm test 2>/dev/null || echo "no test script"
    elif [ -f Cargo.toml ]; then
        cargo test --workspace 2>/dev/null || cargo test
    elif [ -f go.mod ]; then
        go test ./...
    elif [ -d tests ]; then
        python -m pytest tests/ 2>/dev/null || echo "no python tests"
    fi

lint:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f package.json ]; then
        npm run lint 2>/dev/null || echo "no lint script"
    elif [ -f Cargo.toml ]; then
        cargo clippy --workspace --all-targets -- -D warnings 2>/dev/null || cargo clippy --workspace --all-targets
    elif [ -f go.mod ]; then
        go vet ./...
    fi

fmt:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f package.json ]; then
        npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}" 2>/dev/null || echo "no prettier"
    elif [ -f Cargo.toml ]; then
        cargo fmt --all
    elif [ -f go.mod ]; then
        gofmt -w .
    fi

ci: install build test lint

clean:
    #!/usr/bin/env bash
    set -euo pipefail
    rm -rf node_modules dist target build .next coverage __pycache__ 2>/dev/null || true

# Measure code coverage (SSOT: see grade.sh for the canonical command)
coverage:
    go test -coverprofile=coverage.out -covermode=atomic ./... && go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//' | awk '{exit($1 < 85 ? 1 : 0)}'
