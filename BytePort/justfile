# justfile — BytePort developer task runner
# https://github.com/casey/just
#
# Mirrors what CI runs so contributors can reproduce CI locally.
# Install:  brew install just   |   cargo install just

set dotenv-load := false
set shell := ["bash", "-uc"]

# ----- meta -----
_default:
    @just --list

# Print this justfile's location
where:
    @echo "{{justfile()}}"

# ----- workspace -----
# Rust workspace members
workspace:
    @cargo metadata --no-deps --format-version 1 \
        | jq -r '.workspace_members[] | split(":")[1]' \
        2>/dev/null || cargo metadata --no-deps --format-version 1 | head -c 200

# ----- go -----
go_dir  := "backend/byteport"

# go build ./...
go-build:
    cd {{go_dir}} && go build ./...

# go test ./...
go-test:
    cd {{go_dir}} && go test ./...

# go vet ./...
go-vet:
    cd {{go_dir}} && go vet ./...

# gofmt -l . (advisory; CI runs the same)
go-fmt:
    @unformatted=$(gofmt -l backend/byteport backend/nvms); \
    if [ -n "$unformatted" ]; then \
        echo "The following files are not gofmt-clean:"; \
        echo "$unformatted"; \
        exit 1; \
    else \
        echo "All Go files are gofmt-clean."; \
    fi

# golangci-lint run
go-lint:
    cd {{go_dir}} && golangci-lint run --disable=staticcheck --disable=errcheck

# Format all Go in place
go-fmt-fix:
    gofmt -w backend/byteport backend/nvms

# ----- rust -----
# cargo build --workspace
rust-build:
    cargo build --workspace

# cargo test --workspace
rust-test:
    cargo test --workspace

# cargo machete — surface unused dependencies
rust-machete:
    cargo machete .

# ----- audit (mirrors audit.yml) -----
# cargo install cargo-audit
audit-rustsec:
    cargo install --locked cargo-audit --version "^0.21" || true
    cargo audit

# cargo install cargo-semver-checks
audit-semver:
    cargo install --locked cargo-semver-checks || true
    cargo semver-checks

# gitleaks detect (requires `brew install gitleaks`)
audit-gitleaks:
    gitleaks detect --source . --config .gitleaks.toml --no-banner

# trufflehog filesystem scan (requires trufflehog on PATH)
audit-trufflehog:
    trufflehog filesystem . --only-verified --fail

# CodeQL local analyze (requires `codeql` CLI)
audit-codeql:
    @echo "CodeQL local analysis: use 'codeql database create' + 'codeql database analyze'"

# All audit checks (long)
audit: audit-rustsec audit-semver audit-gitleaks audit-trufflehog

# ----- deny (mirrors deny.yml) -----
# cargo install cargo-deny
deny:
    cargo install --locked cargo-deny || true
    cargo deny check

# ----- scorecard (mirrors scorecard.yml) -----
# OpenSSF Scorecard CLI: `brew install scorecard` or `go install github.com/ossf/scorecard/v5@latest`
scorecard:
    @command -v scorecard >/dev/null || { \
        echo "Install scorecard: https://github.com/ossf/scorecard#install"; exit 1; \
    }
    scorecard --repo=local --format=cli

# ----- pre-commit -----
# Install pre-commit hooks into .git/hooks
precommit-install:
    pip install --user pre-commit
    pre-commit install --install-hooks
    @echo "Run 'just precommit' to invoke on all files."

# Run pre-commit on every file (auto + manual stages)
precommit:
    pre-commit run --hook-stage manual --all-files

# ----- ci (mirrors ci.yml) -----
# Run the full PR-gating CI suite locally
ci: go-build go-test go-vet go-fmt go-lint rust-machete precommit
    @echo "Local CI complete."

# ----- release (mirrors release.yml) -----
# Verify a release can be cut: builds, tests, deny, audit
release-check: ci deny audit
    @echo "Release checks passed."

# ----- housekeeping -----
# Remove build artifacts
clean:
    cargo clean
    go clean -cache -testcache
    rm -rf .audit/*.json .audit/*.md
