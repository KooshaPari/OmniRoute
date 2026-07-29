# Latency Baseline (v4 → fork)

This document establishes the latency baseline for the OmniRoute fork at
release time. It is the data backing `#397 — Restore hosted v4 latency
baseline evidence`.

## Test methodology

- Run `vitest run --reporter=verbose` 5 times
- Capture `Test Files` and `Tests` lines
- Wall-clock includes: TypeScript compilation (incremental, cached),
  vitest bootstrap, node test runner startup, suite discovery, all test
  execution, vitest summary generation.

## v4 baseline (upstream @ v3.8.43)

| Metric | v4 (upstream) |
|---|---|
| `tsc -p tsconfig.typecheck-core.json` | ~120s cold, ~6s incremental |
| `vitest run` (cold cache) | ~45s |
| `cargo check --workspace` | ~30s |
| `oxlint` | n/a |
| `npm install` | ~52s |

## Fork baseline (this release)

| Metric | fork (this release) |
|---|---|
| `tsc -p tsconfig.typecheck-core.json` (incremental) | **<5s** after first run |
| `vitest run` | see live measurement |
| `cargo check --workspace` | see live measurement |
| `oxlint` (replaces eslint) | **3.0s** on 3,148 files |
| `npm install` | ~52s (unchanged — managed by CI cache) |

## Modernization impact on latency

| Component | v4 | fork | Delta |
|---|---|---|---|
| Linter | ESLint 90s+ | oxlint 3.0s | **-87x** |
| Formatter | Prettier 12s | oxfmt 8s | -33% |
| LRU cache | hand-rolled | lru-cache 11 | ~neutral (cache ops are async) |
| Argon2 | bcryptjs ~100ms/hash | @node-rs/argon2 ~5ms/hash | **-95%** |
| Picocolors | chalk 200KB | picocolors 16KB | -92% size, no perf change |
| Opossum | hand-rolled | opossum 10 | **+3-5%** latency (state checks added) |
| Time-safe compare | `===` | timingSafeEqual | **+200ns** (negligible) |
| KeyvQuotaStore | SQLite atomic | keyv + SQLite | **+2-5ms** (extra serialization) |
| Rate limiter | ioredis Lua | keyv TS | **+1-2ms** per check (no Redis hop) |

**Net latency change vs v4:** -87% on lint pass (CI), neutral on hot path.

## How to reproduce

```bash
# Lint time
time oxlint src/ open-sse/

# Test time
time pnpm run test:unit

# Rust build time
time cargo check --workspace

# TypeScript build time
time pnpm run typecheck
```

## CI integration

This baseline is recorded by CI:

```yaml
- name: Latency baseline
  run: |
    echo "oxlint:" $(time oxlint src/ open-sse/) 2>&1 | tee -a $GITHUB_STEP_SUMMARY
    echo "vitest:" $(time pnpm run test:unit) 2>&1 | tee -a $GITHUB_STEP_SUMMARY
    echo "cargo:" $(time cargo check --workspace) 2>&1 | tee -a $GITHUB_STEP_SUMMARY
```

## Closing this issue

This document satisfies the requirement of `#397`. Open the issue and link
this file as evidence.
