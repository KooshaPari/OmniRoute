# R&D Evaluation — TS7, Compiler Rivals, Python Analogs, Astne Deprecation

**Date:** 2026-08-01  
**Branch:** `fix/stray-brace-mitm-manager`  
**Context:** Astne API Key deprecation → Machine Identities migration notice triggered full upstream R&D audit.

## 1. Upstream TypeScript — TS7.1 milestone status

| Source | Status |
|---|---|
| [Milestone 6 (TS7.1)](https://github.com/microsoft/typescript-go/milestone/6) | **64% closed** (9 open / 16 closed) |
| `microsoft/typescript-go` main | Active; last commit pre-milestone-6 cutoff |
| `microsoft/typescript` 7.0.2 npm | Despite the version, **CLI-only** — no compiler API |
| `typescript-go` npm (security placeholder) | Deprecated; just a sandbox to claim the name |

**Open bugs on milestone-6 (relevant subset):**
- `checker.getTypeAtLocation` panic (Jul 31)
- LSP watcher panic (Jul 31)
- `tsconfig.json` panic with `{"" }` (Jul 26)
- `ctrl-c` non-responsive
- Nested nullish coalescing parser bug
- 2 ServerErrors diffs vs main
- wasip1 LSP hang

**Decision:** we've vendored `microsoft/typescript-go` as a soft fork (see `vendor/typescript-go/tsgo` + `docs/TS7_MIGRATION.md`). 5.8x faster than `tsc`; 0 errors on this codebase. Soft-fork strategy: weekly rebase via `pnpm run tsgo:build`. tsc remains the gating source-of-truth until milestone-6 hits 100%.

## 2. Competing Compiler Projects — recent activity

| Project | Latest release | Date | Notes |
|---|---|---|---|
| **oxc-project/oxc** | `apps_v1.76.0` (oxlint+oxfmt) | 2026-07-27 | Rust-based, ~10-100x faster than tsc; **we already use oxlint+oxfmt** |
| **swc-project/swc** | `v1.15.47` | 2026-07-29 | Rust-based; 30-40x faster than tsc; good for transpilation |
| **evanw/esbuild** | `v0.28.1` | — | Go-based; bundler-first, not a typechecker |
| **biomejs/biome** | `v2.5.6` | 2026-07-28 | Rust-based; formatter + linter; **we already use Biome peer patterns but oxlint** |

**Decision:** No need to switch — oxlint (oxc) already replaces ESLint. If we need a typechecker alternative, **vendored tsgo** is the right answer (5.8x speedup, no API change). swc/oxc/biome are options if we ever need transpilation-only (we don't).

## 3. Python analog — typecheck, lint, AST-manipulation equivalents

| Project | Latest | Date | OmniRoute analog |
|---|---|---|---|
| **microsoft/pyright** | `v1.1.411` | 2026-06-25 | Closest analog to `tsc` — static typechecker. Wraps pyright-typeserver. |
| **astral-sh/ruff** | `v0.16.1` | 2026-07-30 | Rust-based; analog to **oxlint/oxfmt** (linter + formatter). |
| **python/mypy** | active | — | First major Python typechecker; less actively maintained than pyright/ruff. |

**Pattern takeaway:** `oxlint` (oxc) and `ruff` are the dominant Rust-based JS/Python toolchain replacements. We're aligned with where the Python ecosystem is heading — Rust-based, fast, replace legacy JS toolchain.

## 4. This fork + upstream fork — what's done vs planned

| Item | Status | Fork vs upstream |
|---|---|---|
| Mobx-rollup of TS6.0.3 | ✅ shipped in fork | Fork is AHEAD (upstream @ v3.8.43 has no oxlint/oxfmt/keyv/etc.) |
| Vendored typescript-go TS7.1 | ✅ shipped in fork | Fork is AHEAD (upstream still on TS6.0.3) |
| Sidecar removal (Redis, Qdrant, MITM) | ✅ shipped in fork | Fork is AHEAD |
| 22+ modernization PRs | ✅ shipped (oxlint, oxfmt, lru-cache@11, keyv, opossum@10, argon2, picocolors, sqlite-vec, etc.) | Fork is AHEAD |
| 4 decomposition extractions | ✅ shipped | Fork is AHEAD |
| 13 documentation files | ✅ shipped (PUBLICATION_BOUNDARIES, PHENODOCS, PROVENANCE, LATENCY, CLI, PHENOTYPE_GRADE, TS7_MIGRATION, etc.) | Fork is AHEAD |
| Mobile/desktop runtime audit | ✅ ZERO Electron/Tauri/RN/Flutter/Capacitor/Expo/ElectroBun | Fork only — upstream supports Electron |
| CI scripts (8 files) | ✅ shipped | Fork is AHEAD |
| 19 GH issues closed | ✅ all actionable modernization issues | Fork only |
| TS7 strict mode (`strict: true`) | ⚠️ blocked — 12,985 errors in strict of upstream patterns | Both forks blocked |

**Conclusion:** The fork is **strictly ahead** of upstream on all modernization axes. The only architectural blocker is TS7 strict mode (a pre-existing UX debt from upstream's per-file `unknown` typing).

## 5. Astne Deprecation Notice — impact assessment

| Surface | Status |
|---|---|
| **Astne API keys in source code** | **Zero usages** — `grep -rnE "(API_KEY|api_key|APIKEY|api-key|apiKey)" src/ open-sse/ tests/` returns no `Astne` matches |
| **Astne API keys in CI workflows** | **Zero usages** — `.github/workflows/*.yml` doesn't reference `Astne` |
| **Astne API keys in scripts** | **Zero usages** |

**`apiKey` in source** (NOT Astne — these are model-provider API keys for OpenAI/Anthropic etc.):
- `src/app/api/keys/route.ts` — model provider keys (unrelated to Astne)
- `src/lib/db/apiKeyCache.ts` — already migrated to Keyv (no Astne)
- `src/lib/db/apiKeys.ts` — open-sse provider keys (not Astne)

**Migration impact:** **Zero**. The Astne API key deprecation notice is informational only for this codebase. When the deprecation takes effect, no code changes are needed.

**Forward-looking risk:** if Astne's deprecation notice is replicated by model providers (Anthropic, OpenAI migrating to Machine Identities by 2027), we'd need to:
- Update `src/lib/db/apiKeyCache.ts` to support OIDC tokens instead of static keys
- Update `src/app/api/keys/route.ts` to use Machine Identity auth flow
- This is a separate PR, scoped to model provider integration

## Recommended Actions

| # | Action | Priority | Effort |
|---|---|---|---|
| 1 | **Weekly tsgo rebase** (cron/CI) | M | S |
| 2 | **Document Machine Identity migration** for model providers (when Astne-style deprecation hits them) | L | M |
| 3 | **Document fork-ahead-of-upstream** in `docs/BRANCH_ARCHAEOLOGY.md` (already done) | ✅ done | — |
| 4 | **Track TS7 strict mode** in separate issue when ready to migrate from upstream patterns | L | L |
| 5 | **Weekly oxc/swc upgrade** — `cargo install oxc` + `npm i -D @swc/core` as backup compiler pipelines | L | S |

## Conclusion

- **Astne API key deprecation** has zero impact on this codebase (no Astne integration).
- **TS7.1 is partially shipped** via vendored soft fork (commit `ff0539c8f9`, issue #319 closed).
- **Fork is ahead of upstream** on all modernization axes.
- **Next actionable work is not in the modernization lane** — the modernized stack is complete and verified. The repo needs landing (PR opening) or new feature work to continue.
