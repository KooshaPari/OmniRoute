#!/usr/bin/env bash
# .devcontainer/post-create.sh — run once after devcontainer creation.
#
# Installs tooling the devcontainer.json features do not cover:
#   - just (command runner; the Phenotype fleet uses Justfile recipes)
#   - gh (GitHub CLI; needed for the dispatch + label flows)
#   - git-cliff (conventional-commits changelog generator, ADR-027 / cliff.toml)
#   - cargo-binstall + sccache + cargo-nextest (Rust perf)
#   - pre-commit framework + the fleet .githooks/pre-commit hook
#
# Idempotent: re-running is safe; tools are skipped if already on PATH.

set -euo pipefail

log() { printf '\033[1;34m[post-create]\033[0m %s\n' "$*"; }

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# just
# ---------------------------------------------------------------------------
if ! command -v just >/dev/null 2>&1; then
    log "installing just"
    sudo apt-get update -y >/dev/null
    sudo apt-get install -y --no-install-recommends just >/dev/null \
        || (cargo install just --locked)
fi

# ---------------------------------------------------------------------------
# gh (GitHub CLI)
# ---------------------------------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
    log "installing gh"
    (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null)
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
    sudo apt-get update -y >/dev/null
    sudo apt-get install -y --no-install-recommends gh >/dev/null
fi

# ---------------------------------------------------------------------------
# git-cliff (CHANGELOG generator; matches cliff.toml)
# ---------------------------------------------------------------------------
if ! command -v git-cliff >/dev/null 2>&1; then
    log "installing git-cliff"
    (cd /tmp && curl -fsSL https://github.com/orhun/git-cliff/releases/latest/download/git-cliff-x86_64-unknown-linux-gnu.tar.gz \
        | tar -xz -C /tmp && sudo mv /tmp/git-cliff /usr/local/bin/)
fi

# ---------------------------------------------------------------------------
# Rust perf tooling (sccache, nextest, cargo-binstall)
# ---------------------------------------------------------------------------
if ! command -v sccache >/dev/null 2>&1; then
    log "installing sccache"
    cargo install sccache --locked >/dev/null 2>&1 || true
fi
if ! command -v cargo-nextest >/dev/null 2>&1; then
    log "installing cargo-nextest"
    cargo install cargo-nextest --locked >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
# pre-commit framework + fleet hook install
# ---------------------------------------------------------------------------
if ! command -v pre-commit >/dev/null 2>&1; then
    log "installing pre-commit"
    pip install --quiet pre-commit >/dev/null 2>&1 || true
fi

if [ -f ".githooks/pre-commit" ] && git config core.hooksPath >/dev/null 2>&1; then
    log "wiring fleet pre-commit hook"
    git config core.hooksPath .githooks
fi

# ---------------------------------------------------------------------------
# jq (cache-stats wrapper depends on it; fallback exists if missing)
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
    log "installing jq"
    sudo apt-get install -y --no-install-recommends jq >/dev/null
fi

log "devcontainer ready"
