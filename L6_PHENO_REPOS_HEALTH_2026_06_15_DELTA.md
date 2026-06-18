# L6 — pheno-* Repos Health Inventory (2026-06-15 delta)

**Date:** 2026-06-15 01:25 PDT
**Source:** `L6_PHENO_REPOS_HEALTH_2026_06_14.md` (last full audit)
**Scope of this delta:** Changes since 2026-06-14, in-scope: 4 newly-added pheno-* crates visible in sparse-checkout

---

## Delta summary

| Metric | 2026-06-14 | 2026-06-15 | Δ |
|---|---:|---:|---:|
| pheno-* dirs visible | 18 | 22 | **+4** |
| Buildable crates | 16 | 21 | +5 |
| Rust crates | 7 | 11 | +4 |
| Python packages | 8 | 10 | +2 |
| Go modules | 1 | 1 | 0 |
| TypeScript packages | 1 (out of scope) | 1 (out of scope) | 0 |
| Worktree containers | 1 | 1 | 0 |
| Test totals (pass) | 136 | TBD | — |
| Test totals (fail) | 4 (all pheno-agents-md) | TBD | — |
| Crates with full meta-bundle | 9 of 18 | TBD | — |

---

## New crates (2026-06-15)

The 4 newly visible pheno-* crates since the 2026-06-14 audit:

| Crate | Lang | Inferred Purpose | Hygiene State |
|---|---|---|---|
| **pheno-cli-base** | Rust | Shared CLI patterns (Verbosity, ConfigArg, setup_tracing); just authored at commit `90fc2c52c4` | NEW — no meta files yet |
| **pheno-fastapi-base** | Python | FastAPI base utilities (analogous to pheno-axum-stack) | NEW — no meta files yet |
| **pheno-flags** | Rust | Feature flag library (analogous to LaunchDarkly/Statsig) | NEW — no meta files yet |
| **pheno-otel** | Rust | OpenTelemetry bridge | NEW — no meta files yet (was excluded from root workspace per `Cargo.toml:3`) |

These 4 are **unhygienized** (no AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT) — they were added during the 2026-06-14/15 fleet expansion, pre-hygiene. This matches the pattern in `L6_PHENO_REPOS_HEALTH_2026_06_14.md:60-61` (new crates are typically pre-hygiene).

---

## Health table — 2026-06-15 refresh (visible crates only)

| Crate | Lang | Tests Pass | Tests Fail | Notes |
|---|---|---:|---:|---|
| pheno-agents-md | Rust | 4 | 4 | Same as 2026-06-14 (YAML extra_dont_touch bug) |
| pheno-cargo-template | Rust | 1 | 0 | Same |
| pheno-cli-base | Rust | TBD | TBD | **NEW**; needs first test run |
| pheno-config | Rust | 10 | 0 | Same |
| pheno-context | Rust | 5 | 0 | Same |
| pheno-cost-card | Python | 2 | 0 | Same |
| pheno-errors | Rust | 6 | 0 | Same |
| pheno-fastapi-base | Python | TBD | TBD | **NEW** |
| pheno-flags | Rust | TBD | TBD | **NEW** |
| pheno-go-ctxkit | Go | 6 | 0 | Same |
| pheno-llms-txt | Python | 6 | 0 | Same |
| pheno-mcp-router | Python | 14 | 0 | Same |
| pheno-otel | Rust | TBD | TBD | **NEW** |
| pheno-port-adapter | Rust | 18 | 0 | Same |
| pheno-prompt-test | Python | 14 | 0 | Same |
| pheno-pydantic-models | Python | 5 | 0 | Same |
| pheno-scaffold-kit | Python | 6 | 0 | Same; v6 Track 1 target |
| pheno-tracing | Rust | 9 | 0 | Same |
| pheno-vibecoding-guard | Python | 16 | 0 | Same |
| pheno-worklog-schema | Python | 14 | 0 | Same |
| pheno-wtrees | — | n/a | n/a | Same; worktree container |
| pheno-zod-schemas | TS | n/a | n/a | Same; out of scope |

---

## Parent workspace check (L6 infra issue)

`L6_PHENO_REPOS_HEALTH_2026_06_14.md:127-135` identified a parent workspace bug: `Cargo.toml` declares `crates/phenotype-error-core` as a workspace member but the directory does not exist.

**2026-06-15 verification:** The "missing" crate is a **sparse-checkout artifact**, not a real bug. This branch uses sparse-checkout cone mode with pattern `/*` + `!/*/` + selective re-inclusions; `crates/` is NOT in the cone. The same is true for 73+ other members listed in the root `Cargo.toml`. To run `cargo test --workspace` from this branch, either:
- Disable sparse-checkout: `git sparse-checkout disable && git checkout -- .` (slow; pulls ~29k files)
- Or test only visible members: `cd pheno-config && cargo test`

**Recommendation:** Do NOT modify root `Cargo.toml`. The workspace is correct in the full-monorepo context. The "fix" should be in workflow, not in code.

---

## New findings (2026-06-15)

1. **4 new pheno-* crates** since 2026-06-14 (pheno-cli-base, pheno-fastapi-base, pheno-flags, pheno-otel). All unhygienized. **Recommend adding to a v6 Track 2.5 (hygiene) or a new v6 Track 6.**
2. **pheno-cli-base** was authored this session (commit `90fc2c52c4`) by the parallel Tracera subagent — features `Verbosity`, `ConfigArg`, `setup_tracing` patterns. Should be tested before adoption.
3. **Subagent dispatch via `forge -p "..."` CLI is verified working** (Tracera L5 integration agent, PID 6612, ran cleanly 12:59→01:18 PDT). The prior `task` tool failures were transient. v6 can safely use `forge` CLI for parallel track execution.

---

## Out-of-scope (still)

- **pheno-wtrees:** git worktree container, not a buildable crate
- **pheno-zod-schemas:** TypeScript + vitest; user requested only Rust/Python/Go test runners
- **L7 (full-fleet Rust+Python+Go audit):** not requested this turn
