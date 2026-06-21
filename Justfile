# phenotype-router Justfile
# Fleet-standard task runner (DAG stage 4). See FLEET_100TASK_DAG.md /
# /Users/kooshapari/CodeProjects/Phenotype/repos/Justfile for the fleet-wide
# conventions; this file is the per-repo entry point.
#
# The `bench-router` target is the primary user-facing entry point per
# AGENTS.md §"v13 outlook" and ADR-040 (performance benchmarks).

set shell := ["bash", "-cu"]

default:
    @just --list

# Tier-0 hygiene: Justfile parse + variable evaluation check (L29.1).
# Invoked by .pre-commit-config.yaml `justfile-verify` hook. Passes if
# (a) `just --list` parses the recipe block cleanly and (b) all `set` /
# `export` variables evaluate without error.
justfile-verify:
    #!/usr/bin/env bash
    set -euo pipefail
    just --list >/dev/null
    just --evaluate >/dev/null
    echo "justfile-verify: OK"

# install — fetch deps for whatever package manager the repo uses.
install:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f Cargo.toml ]; then
        cargo fetch
    fi
    if [ -f bench/go.mod ]; then
        (cd bench && go mod download)
    fi

# build — compile the Rust crate + the Go bench module.
build:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f Cargo.toml ]; then
        cargo build --workspace 2>/dev/null || cargo build
    fi
    if [ -f bench/go.mod ]; then
        (cd bench && go build ./...)
    fi

# test — run the Rust + Go test suites.
test:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f Cargo.toml ]; then
        cargo test --workspace 2>/dev/null || cargo test
    fi
    if [ -f bench/go.mod ]; then
        (cd bench && go test -count=1 -timeout 60s ./...)
    fi

# bench-router — run all three Go benchmark suites locally.
# Equivalent to:
#   make -C bench bench-all
# Each suite writes to bench-results/. Use this for pre-merge local
# verification; the full 30-min soak lives in CI (`.github/workflows/bench.yml`).
#
# Args:
#   DURATION — p95 soak duration (default: 30s; CI uses 5m; SOTA is 30m).
#   RPS      — p95 soak target RPS (default: 1000).
bench-router DURATION="30s" RPS="1000":
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p bench-results
    echo "==> bench/e2e (1k iterations)"
    (cd bench && go test -v -bench=BenchmarkRoutingE2E \
        -benchtime=1000x -benchmem -run=^$ .) \
        | tee bench-results/e2e.txt
    echo
    echo "==> bench/p95-soak (RPS={{RPS}}, duration={{DURATION}})"
    (cd bench && go run ./cmd/p95_latency \
        -rps={{RPS}} -duration={{DURATION}} \
        -workers=512 -warmup=5s -report=10s) \
        | tee bench-results/p95-soak.txt
    echo
    echo "==> bench/throughput (100 → 10k RPS, fast profile)"
    (cd bench && go run ./cmd/throughput \
        -min=100 -max=10000 -steps=8 \
        -per-step=10s -cooldown=2s \
        -workers=512 -profile=fast) \
        | tee bench-results/throughput.txt
    echo
    echo "==> done. results in bench-results/"
    ls -la bench-results/

# bench-router-strict — like bench-router but the p95 driver fails the
# run if p99 exceeds the per-route budget in docs/perf-budget.md.
bench-router-strict DURATION="30s" RPS="1000":
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p bench-results
    (cd bench && go test -v -bench=BenchmarkRoutingE2E \
        -benchtime=1000x -benchmem -run=^$ .) \
        | tee bench-results/e2e.txt
    (cd bench && go run ./cmd/p95_latency \
        -rps={{RPS}} -duration={{DURATION}} \
        -workers=512 -warmup=5s -report=10s -strict) \
        | tee bench-results/p95-soak.txt
    (cd bench && go run ./cmd/throughput \
        -min=100 -max=10000 -steps=8 \
        -per-step=10s -cooldown=2s \
        -workers=512 -profile=fast) \
        | tee bench-results/throughput.txt
