# L6 — pheno-* + phenotype-* Repos Health Inventory (2026-06-18 delta)

**Date:** 2026-06-18 23:55 PDT
**Source:** `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` (last delta) + `L6_PHENO_REPOS_HEALTH_2026_06_14.md` (last full audit)
**Scope of this delta:** 3-day window (2026-06-15 → 2026-06-18). Fleet-wide scope. sparse-checkout cone includes the 26 pheno-* and 49 phenotype-* dirs visible in `/Users/kooshapari/CodeProjects/Phenotype/repos/`.

---

## Delta summary

| Metric | 2026-06-15 | 2026-06-18 | Δ |
|---|---:|---:|---:|
| pheno-* dirs visible (sparse cone) | 22 | 26 | **+4** |
| phenotype-* dirs visible (sparse cone) | ~36 | 49 | **+13** |
| Total pheno-family dirs | ~58 | 75 | **+17** |
| `pheno-spec-harmonizer` (agileplus-spec-harmonizer absorbed) | n/a | merged | — |
| `agileplus-spec-harmonizer-tool` (deprecated) | exists | **deleted** | — |
| `phenotype-monorepo-state` (per ADR-033, scheduled 2026-07-17) | n/a | exists | — |
| 71-pillar audit framework | n/a | published | — |
| ADRs cumulative | 24 | **35** | **+11** |
| Pheno-agents-md broken tests | 4 | **0** | **FIXED (L5-108.1)** — `#[serde(default)]` on `extra_dont_touch: Vec<String>`; PR #3 merged |
| Pheno-agents-md fixed tests | 0 | **8/8 cargo + 2/2 pytest** | same fix |
| Dmouse92 → KooshaPari migration | 0% | **100%** | complete (ADR-029) |
| Archived repos (cumulative) | ~12 | **30+** | **+18** (Dmouse92) |

---

## New pheno-* + phenotype-* crates/repos since 2026-06-15

### pheno-* (4 new)

| Repo | Lang | Purpose | Hygiene State |
|---|---|---|---|
| **pheno-drift-detector** | Python | Detects semantic drift between source/intent/boundary docs | unknown |
| **pheno-framework-lint** | Python | Linter enforcing the `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated-service placement policy (ADR-023) | unknown |
| **pheno-secret-scan** | Rust | Pre-commit secret scanner (extends `cargo-deny`) | unknown |
| **pheno-wtrees** | container | git worktree container (out of scope for cargo/pytest) | unknown |

### phenotype-* (13 new)

| Repo | Purpose |
|---|---|
| **phenotype-auth-ts** | TypeScript auth helper (now archived; absorbed into AuthKit#120, L5-109) |
| **phenotype-dep-guard** | Dependency-drift guard (was `pheno-dep-guard` in prior) |
| **phenotype-e2e-base** | E2E test scaffolding (was `pheno-e2e-base`) |
| **phenotype-gfx** | Graphics substrate (voxel + terrain + water + postfx; L5-109..112 in progress) |
| **phenotype-infrakit** | Infra utilities (Terraform/CDK patterns) |
| **phenotype-journeys** | User-journey recording/playback framework |
| **phenotype-landing** | Marketing landing page substrate |
| **phenotype-mcp-asset** | MCP asset registry (8 TS SDKs consolidated) |
| **phenotype-mcp-sdk-cs** | C# MCP SDK |
| **phenotype-mcp-sdk-py** | Python MCP SDK (long-term Python MCP home) |
| **phenotype-monorepo-state** | Snapshot repo (per ADR-033, scheduled deletion 2026-07-17) |
| **phenotype-omlx** | OMLX integration substrate |
| **phenotype-teamcomm** | Team communication substrate |

These 13 are a mix of **newly authored** (e.g., `phenotype-infrakit`, `phenotype-omlx`, `phenotype-journeys`, `phenotype-landing`, `phenotype-gfx`) and **renamed/migrated from `pheno-*`** (e.g., `phenotype-dep-guard` from `pheno-dep-guard`, `phenotype-e2e-base` from `pheno-e2e-base`).

---

## Major repository changes (2026-06-15 → 2026-06-18)

### Absorbed (3)
| Source | Target | Status | L5 ID |
|---|---|---|---|
| `agileplus-spec-harmonizer` | `AgilePlus/crates/agileplus-spec-harmonizer/` | **merged** via PR #756 + #764 | L5-110 |
| `agileplus-spec-harmonizer-tool` | (zero net content) | **deleted** (no migration needed) | L5-110 |
| `phenotype-auth-ts` | `AuthKit` (`typescript/packages/auth-ts/`) | **merged** via PR #120 | L5-109 |

### Deleted (≥18, all Dmouse92)
Per ADR-029 (L5-108). 18 Dmouse92 phenorepos archived in read-only state. 6 PRs opened on KooshaPari to migrate unique work.

### Created (1)
| Repo | Status | Notes |
|---|---|---|
| `phenotype-monorepo-state` | scheduled deletion **2026-07-17** | Per ADR-033 + ADR-034; holds 4 governance-snapshot commits being migrated to `phenotype-org-audits` + monorepo |

### PAUSED APPs (7, per AGENTS.md § PAUSED APPs)
- AtomsBot*, FocalPoint, Dino, QuadSGM, HwLedger, WSM, *fitness* — all read-only, all WIP pushed to remote `wip/2026-06-17-pre-pause-snapshot` branches
- HwLedger bucket change `PAUSED -> CONDITIONAL` per ADR-035 (L5-105)

---

## Health table — 2026-06-18 refresh (visible pheno-* crates only)

| Crate | Lang | Tests Pass | Tests Fail | Notes |
|---|---|---:|---:|---|
| pheno-agents-md | Rust | **8** | **0** | **FIXED (L5-108.1)** — `#[serde(default)]` on `extra_dont_touch: Vec<String>`; PR #3 merged |
| pheno-cargo-template | Rust | 1 | 0 | Same |
| pheno-cli-base | Rust | TBD | TBD | Still pre-hygiene; needs first test run |
| pheno-config | Rust | 10 | 0 | Same |
| pheno-context | Rust | 5 | 0 | Same |
| pheno-cost-card | Python | 2 | 0 | Same |
| pheno-drift-detector | Python | TBD | TBD | NEW; needs first test run |
| pheno-errors | Rust | TBD | TBD | Same |
| pheno-fastapi-base | Python | TBD | TBD | Pre-hygiene |
| pheno-flags | Rust | TBD | TBD | Pre-hygiene; `must_use` policy per latest T17 |
| pheno-framework-lint | Python | TBD | TBD | NEW |
| pheno-go-ctxkit | Go | TBD | TBD | Pre-hygiene |
| pheno-llms-txt | Python | TBD | TBD | Pre-hygiene |
| pheno-mcp-router | Python | TBD | TBD | **6 new PRs landed** (cost/budget/audit tiers + LlamaAdapter + OpenAICompatAdapter) |
| pheno-otel | Rust | TBD | TBD | Pre-hygiene; excluded from root workspace per Cargo.toml |
| pheno-port-adapter | Rust | TBD | TBD | Pre-hygiene |
| pheno-predict | Python | TBD | TBD | Pre-hygiene |
| pheno-prompt-test | Python | TBD | TBD | Pre-hygiene |
| pheno-pydantic-models | Python | TBD | TBD | Pre-hygiene |
| pheno-scaffold-kit | Python | TBD | TBD | Pre-hygiene |
| pheno-secret-scan | Rust | TBD | TBD | NEW |
| pheno-ssot-template | Rust | TBD | TBD | Pre-hygiene |
| pheno-vibecoding-guard | Python | TBD | TBD | Pre-hygiene |
| pheno-worklog-schema | Python | **30/30** | 0 | v2.1 bump landed; PR #1 open |
| pheno-zod-schemas | TypeScript | TBD | TBD | Out of scope for cargo/pytest runs |

**Test totals (visible pheno-* Rust crates only):** carry-over from 2026-06-15 = 136 pass, 4 fail. **New crates in 2026-06-15..18 window not yet test-run.**

---

## 71-pillar audit (new this window, ADR-024)

**Status:** Scorecard published at `findings/71-pillar-2026-06-17-{schema,scorecard,mapping,wrapup}.md`. 9 domains, 71 pillars. Per-repo scoring 0-3 (0=absent, 1=minimal, 2=adequate, 3=SOTA). Refresh cadence: weekly.

**Top 3 highest-impact gaps identified (carry-forward to next v8+ plan):**

1. **L40 (i18n) + L41 (a11y)** — headless backend/CLI libs score 0 by design; UI surfaces (phenotype-landing, phenotype-journeys) need explicit scoring
2. **L25 (architecture eval)** — closed via ADR-028 (hybrid-with-staging-repo) but per-repo pattern still patchy
3. **L66 (binary asset policy)** — closed via ADR-027 (3-tier LFS) but gitattributes not yet propagated

---

## Other policy deltas (3-day window)

| Item | ADR | L5 ID | Date |
|---|---|---|---|
| Cheap-llm-mcp deprecation | ADR-007 | L5-100 | 2026-06-15 |
| Dispatch-mcp as sole MCP server | ADR-008 | L5-100 | 2026-06-15 |
| Settly-* archive (full deprecation) | ADR-017 | L5-097 | 2026-06-15 |
| PRCP pattern (Polyglot Reuse via Canonical Ports) | ADR-018 | L5-098 | 2026-06-15 |
| Pheno-vessel-* full deprecation | ADR-019 | L5-099 | 2026-06-15 |
| Pheno-types-* full deprecation | ADR-020 | L5-099 | 2026-06-15 |
| Pheno-profiling replaces Profila | ADR-021 | L5-100 | 2026-06-15 |
| Config consolidation (two-crate split) | ADR-022 | L5-100 | 2026-06-15 |
| Agent-effort governance (device + dogfood + app substrate) | ADR-023 | L5-101 | 2026-06-15 |
| 71-pillar audit framework | ADR-024 | L5-102 | 2026-06-17 |
| ADR-015 v2.1 worklog schema bump | ADR-025 | L5-103 | 2026-06-17 |
| Factory AI Agent Readiness crosswalk | ADR-026 | L5-104 | 2026-06-17 |
| Git LFS 3-tier policy | ADR-027 | L5-105 | 2026-06-17 |
| Monorepo architecture eval (hybrid-with-staging) | ADR-028 | L5-106 | 2026-06-17 |
| Dmouse92 → KooshaPari migration | ADR-029 | L5-108 | 2026-06-17 |
| pheno-worklog-schema v2.1 (11th column `device:`) | ADR-030 | L5-104.5 | 2026-06-17 |
| Configra absorb (canonical config name) | ADR-031 | L5-104.7 | 2026-06-17 |
| pheno-worklog-schema decision (primitive lib, not duplicate) | ADR-032 | L5-104.8 | 2026-06-17 |
| Delete phenotype-monorepo-state | ADR-033 | L5-104.9 | 2026-06-17 |
| phenotype-monorepo-state deletion schedule (2026-07-17) | ADR-034 | L5-104.10 | 2026-06-17 |
| HwLedger reclassification (PAUSED → CONDITIONAL) | ADR-035 | L5-105 | 2026-06-18 |
| agileplus-spec-harmonizer absorption | ADR-0006 (in-AgilePlus) | L5-110 | 2026-06-18 |

**Cumulative ADR count: 35** (+11 since 2026-06-15; 4 prior-wave ADRs from 2026-06-14, +24 from 2026-06-15 SOTA sweep, +6 from 2026-06-17 batch, +1 from 2026-06-18 this turn).

---

## Outstanding (P0 carry-forward)

1. **pheno-agents-md YAML `extra_dont_touch` bug** — **FIXED (L5-108.1)**. Root cause: `extra_dont_touch: Vec<String>` had no `#[serde(default)]`, so 4 tests loading minimal YAML files (empty, repo-name-only, CJK, 50K-char) failed to deserialize. PR #3 merged 2026-06-19T01:58:44Z; 8/8 cargo tests + 2/2 pytest pass.
2. **Pheno-agents-md, pheno-flags, pheno-mcp-router, pheno-otel** — first-time test run pending (TBD status). **Carry-forward**.
3. **`phenotype-monorepo-state` deletion** — scheduled 2026-07-17 (per ADR-033/034). 5-step pre-deletion checklist pending.
4. **v8 Track 1 (Triage)** — DONE in this turn (3 stashes dropped, 1 prunable worktree pruned via `git worktree prune`).
5. **v8 Track 2 (5 W5 closure PRs #129-#133)** — **W5 batch from prior session is OBSOLETE**; all referenced PRs are MERGED or closed. Actual current in-flight W5-equivalent work is the AgilePlus consolidation pair:
   - **AgilePlus #765** — `consolidation/small-stragglers-2026-06-18` (35 small stragglers, +334,760 LOC) — open with **data-hygiene blocking issue comment** (`.agileplus/` runtime state, `dispatch-mcp/` re-introduction, brand assets at root, build artifacts) per L5-104 + ADR-027.
   - **AgilePlus #766** — `consolidation/medium-stragglers-2026-06-18` (5 medium stragglers, +1,678 LOC) — open with **data-hygiene issue comment** (`.db*` files, `dispatch-mcp/` re-introduction, brand assets at root).
   - **phenotype-registry #199** — L7-001 contract-only orphan-squash (12 commits → 1 squash, +16,560/-21,219, 518 files) — authored by subagent, has subagent review pending; large curation pass. **T13 in-progress**.
   - **phenotype-registry #200** — SUPERSEDE 4 sister repos into `phenotype-gfx` (L5-104.7, ADR-031) — small, +118 LOC, 4 files. **T13 in-progress**.
   - **phenotype-python-sdk #20, #21** — McpKit deprecation notice + agentmcp-hex extraction — small, ready for review.

---

## Source-of-truth references

- `AGENTS.md` — current monorepo state
- `STATUS.md` — current state of all 35 ADRs
- `SSOT.md` — single source of truth for repo conventions
- `findings/71-pillar-2026-06-17-{schema,scorecard,mapping,wrapup}.md` — 71-pillar audit
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` — Dmouse92 migration audit
- `findings/2026-06-17-L5-104-archival-proof.md` — migration guarantee verification
- `AgilePlus/docs/adr/0006-agileplus-spec-harmonizer-absorption.md` — L5-110 absorption rationale
- `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` — last delta
- `L6_PHENO_REPOS_HEALTH_2026_06_14.md` — last full audit

**Next refresh:** 2026-06-22 (per v8 plan cadence, weekly).
