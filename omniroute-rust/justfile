# OmniRoute Rust — developer workflow
# Use `just` (https://github.com/casey/just) — `brew install just`

set shell := ["zsh", "-cu"]
set dotenv-load := true

# Default recipe
default: help

# Print recipe list
help:
    @just --list

# Format with rustfmt
fmt:
    cargo fmt --all

# Lint with clippy (strict)
lint:
    cargo clippy --workspace --all-targets -- -D warnings

# Quick check
check:
    cargo check --workspace --all-targets

# Run unit tests
test:
    cargo test --workspace --lib

# Build release binary
build:
    cargo build --release --workspace

# Run a single crate's tests
test-one crate:
    cargo test -p {{crate}}

# Run the server in dev mode
dev:
    cargo run -p omni-server

# Run the CLI
cli cmd:
    cargo run -p omni-cli -- {{cmd}}

# Database migration
migrate:
    cargo run -p omni-cli -- db migrate

# Start the server (release)
serve:
    cargo run -p omni-server --release

# Clean build artifacts
clean:
    cargo clean
    rm -rf target/

# Run all quality gates (CI-equivalent)
ci: fmt lint test build

# Audit dependencies
audit:
    cargo deny check
    cargo audit

# Watch + test
watch:
    cargo watch -x 'test --workspace --lib'
