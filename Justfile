# Justfile — task runner for the FocalPoint project
# See https://just.systems/man/en/

set dotenv-load

_default:
    @just --list

# Run all CI checks locally
ci: fmt-check lint test build
    @echo "✓ CI checks pass"

# Format code
fmt:
    cargo fmt --all

# Check formatting
fmt-check:
    cargo fmt --all -- --check

# Lint
lint:
    cargo clippy --all-targets --all-features -- -D warnings

# Run tests
test:
    cargo test --all-features

# Build release
build:
    cargo build --release

# Audit dependencies for security advisories
audit:
    cargo deny check advisories

# Check licenses
licenses:
    cargo deny check licenses

# Run cargo-deny (advisories + licenses + bans + sources)
deny:
    cargo deny check

# Show banned/duplicate dependency graph
deny-graph:
    cargo deny check bans --hide-inclusion-errors

# Clean build artifacts
clean:
    cargo clean
# Grade targets (strictest checks — no caching)
grade:
    @echo "=== Running full grade ==="
    ./grade.sh

grade-fast:
    @echo "=== Running fast grade ==="
    ./grade.sh --fast

grade-json:
    @echo "=== Running grade (JSON) ==="
    ./grade.sh --json

grade-html:
    @echo "=== Running grade (HTML) ==="
    ./grade.sh --html

