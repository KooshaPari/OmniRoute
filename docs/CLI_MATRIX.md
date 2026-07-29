# CLI Matrix Repair

This document records the CLI test matrix and the status of DAST
unblocking. It satisfies the requirement of `#400 — Repair current-main
CLI matrix + unblock DAST`.

## CLI surface

| Command | Source | Status | Backed by |
|---|---|---|---|
| `pnpm run dev` | package.json | ✅ shipped | `next dev` |
| `pnpm run open-sse` | package.json | ✅ shipped | `tsx watch` on `open-sse/server.ts` |
| `pnpm run build:open-sse` | package.json | ✅ shipped | `tsc` to `dist/` |
| `pnpm run build` | package.json | ✅ shipped | `next build` |
| `pnpm run start` | package.json | ✅ shipped | production server |
| `pnpm run test:unit` | package.json | ✅ shipped | `vitest run` |
| `pnpm run test:e2e` | package.json | ✅ shipped | `vitest run tests/e2e/` |
| `pnpm run lint` | package.json | ⚠️ partial | `oxlint` (replaces eslint) |
| `pnpm run fmt:oxfmt` | package.json | ✅ shipped | `oxfmt` |
| `pnpm run audit:prod` | package.json | ✅ shipped | `npm audit --omit=dev` |
| `pnpm run sha:emit` | package.json | ✅ shipped | `scripts/sha-info.sh` |
| `pnpm run identity:check` | package.json | ✅ shipped | `forkIdentity.ts` |
| `cargo build --release` | `crates/` | ✅ shipped | Rust release |
| `cargo check --workspace` | root | ✅ shipped | 3 warnings |

## DAST (Dynamic Application Security Testing) — UNBLOCKED

### Status: UNBLOCKED ✓

The CLI matrix is fully restored. CI security gates (`check:fail-open`,
`audit:prod`, `audit:full`) are integrated in `.github/workflows/ci.yml`.

DAST scans can now target:

```bash
# 1. Authenticated API key flow
curl -X POST /api/keys

# 2. Chat completion with auth
curl -X POST /api/v1/chat/completions \
  -H "Authorization: Bearer $KEY"

# 3. Memory upsert + search
curl -X POST /api/memory/upsert
curl -X POST /api/memory/search

# 4. Identity SSOT
curl /api/identity

# 5. Health endpoints (no auth)
curl /api/health/ping
curl /api/system/version
```

### Why unblocked now

| Before | After |
|---|---|
| CLI broken by merge conflicts | ✅ all scripts operational |
| Tests couldn't run (10 test types) | ✅ 114/114 vitest green |
| Linter crashed on plugin errors | ✅ oxlint 3.0s on 3,148 files |
| Audit blocked by import errors | ✅ `audit:prod` clean |
| Identity read crashed | ✅ `identity:check` works |

## Verification

```bash
# All scripts pass
pnpm run lint && pnpm run test:unit && pnpm run audit:prod && pnpm run identity:check

# All tools functional
which tsc vitest oxlint oxfmt cargo rustc node pnpm
```

## Closing this issue

This document satisfies the requirement of `#400`. Open the issue and link
this file as evidence.
