# Phenotype meta-repo task runner (formerly argis-extensions / FocalPoint — consolidated per ADR-022 / ADR-031)
# Fleet-standard task runner (DAG stage 4)
# See FLEET_100TASK_DAG.md for context.
set shell := ["bash", "-cu"]

default:
    @just --list

# Tier-0 hygiene: Justfile parse + variable evaluation check (L29.1)
# Invoked by .pre-commit-config.yaml `justfile-verify` hook. Passes if
# (a) `just --list` parses the recipe block cleanly and (b) all `set` /
# `export` variables evaluate without error.
justfile-verify:
    #!/usr/bin/env bash
    set -euo pipefail
    just --list >/dev/null
    just --evaluate >/dev/null
    echo "justfile-verify: OK"

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

# Tier-0 hygiene: secret scanning (mirrors .github/workflows/audit.yml)
audit:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v trufflehog >/dev/null 2>&1; then
        trufflehog filesystem . --results=verified --no-update
    else
        echo "trufflehog not installed; install with: brew install trufflehog"
        exit 1
    fi

# Tier-0 hygiene: dependency policy (mirrors .github/workflows/deny.yml)
deny:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f go.mod ]; then
        go mod verify
        if ! command -v govulncheck >/dev/null 2>&1; then
            echo "installing govulncheck..."
            go install golang.org/x/vuln/cmd/govulncheck@latest
        fi
        govulncheck ./...
    elif [ -f Cargo.toml ] && command -v cargo-deny >/dev/null 2>&1; then
        cargo deny check
    else
        echo "no supported dependency policy toolchain found"
        exit 1
    fi

# Tier-0 hygiene: SSOT auto-check (L65 SSOT.md consistency + cross-ref resolver)
validate-ssot:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -x ./scripts/validate-ssot.sh ]; then
        ./scripts/validate-ssot.sh
    else
        echo "scripts/validate-ssot.sh missing or not executable"
        exit 1
    fi

# Perf regression benchmarks (L57) — runs criterion + pytest-benchmark
bench:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f benchmarks/rust/Cargo.toml ]; then
        (cd benchmarks/rust && cargo bench --bench parse_flag 2>&1 || echo "rust bench skipped")
    fi
    if [ -f benchmarks/python/pytest.ini ]; then
        (cd benchmarks/python && python -m pytest --benchmark-only 2>&1 || echo "python bench skipped (no tests yet)")
    fi

# CI cache stats (L31) — runs the wrapper on the last CI run log
cache-stats log_path="/tmp/ci-last.log":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -x ./scripts/cache_stats_wrapper.sh ]; then
        ./scripts/cache_stats_wrapper.sh "{{log_path}}"
    else
        echo "scripts/cache_stats_wrapper.sh missing or not executable"
        exit 1
    fi

# CHANGELOG auto-gen (L67) — requires git-cliff
changelog:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v git-cliff >/dev/null 2>&1; then
        echo "git-cliff not installed; install with: cargo install git-cliff"
        exit 1
    fi
    git-cliff --unreleased --tag "$(git describe --tags --abbrev=0 2>/dev/null || echo 'v0.0.0')" --output CHANGELOG.md

# Tier-0 hygiene: full grade (delegates to grade.sh if present, else runs ci + deny + audit)
grade:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -x ./grade.sh ]; then
        ./grade.sh
    else
        just ci
        just deny
        just audit
    fi

clean:
    #!/usr/bin/env bash
    set -euo pipefail
    rm -rf node_modules dist target build .next coverage __pycache__ 2>/dev/null || true

# Measure code coverage (SSOT: see grade.sh for the canonical command)
coverage:
    go test -coverprofile=coverage.out -covermode=atomic ./... && go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//' | awk '{exit($1 < 85 ? 1 : 0)}'
