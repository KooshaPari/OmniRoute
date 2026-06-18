# AGENTS.md — Phenotype monorepo

**Date:** 2026-06-15 01:25 PDT
**Status:** ACTIVE (this file supersedes the prior FocalPoint template that lived here 2026-06-12 → 2026-06-15)

---

## Project Overview

The `repos/` directory is a **monorepo of sub-repos** for the Phenotype organization (`KooshaPari` on GitHub). It is the top-level coordination point for ~50+ Rust crates, Python packages, Go modules, and TypeScript packages, organized as either git submodules, worktree containers, or as worktrees of other repos.

**It is NOT a single project.** It is a meta-repo that aggregates sibling repos. Each `pheno-*`, `phenotype-*`, `phenodocs-*`, etc. subdirectory is its own repository (or a worktree of one) with its own `Cargo.toml` / `pyproject.toml` / `go.mod` / `package.json` and its own release cadence.

---

## Stack

- **Languages:** Rust (primary), Python, Go, TypeScript, Swift (iOS)
- **Build systems:** Cargo, Cargo workspaces, Poetry/pyproject, Go modules, npm/pnpm, Xcode
- **Orchestration:** `just` (Justfile), sparse-checkout cone, git worktrees, forge/muse subagent dispatch

---

## Key Commands

```bash
# Repo state
git status --short                                    # All changes (incl. submodule pointer drift)
git log --oneline -10                                 # Last 10 commits on current branch
git rev-list --left-right --count main...HEAD         # Real divergence from main
git submodule status                                  # Submodule pointer health

# Sparse-checkout (this branch uses cone mode)
cat .git/info/sparse-checkout                         # Current cone pattern
git config core.sparseCheckout                        # true = sparse enabled
git config core.sparseCheckoutCone                    # true = cone mode

# Dispatch
gh --version && gh auth status                        # GitHub CLI (Dmouse92 by default)
curl -sf -m 3 http://localhost:20128/v1/models        # OmniRoute liveness
forge -p "<prompt>" -C /path/to/repo                  # Subagent dispatch (proven working 2026-06-15)
                                                      # (task tool had JSON errors; forge CLI works)

# Branch management
git worktree list                                     # Active worktrees
git stash list                                        # Stash backups
git branch --show-current                             # Current branch
```

---

## Sub-repos at a Glance (sparse-checkout-visible, 2026-06-15)

### Active focus repos (5)
`AgilePlus`, `PhenoCompose`, `PlayCua`, `BytePort`, `nanovms` — coordinated via `chore/l5-87-focus-repo-specs-2026-06-11` branch.

### pheno-* family (22 visible)
- **Rust (11):** pheno-agents-md, pheno-cargo-template, pheno-cli-base, pheno-config, pheno-context, pheno-errors, pheno-flags, pheno-otel, pheno-port-adapter, pheno-tracing
- **Python (10):** pheno-cost-card, pheno-fastapi-base, pheno-llms-txt, pheno-mcp-router, pheno-prompt-test, pheno-pydantic-models, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema
- **Go (1):** pheno-go-ctxkit
- **TypeScript (1):** pheno-zod-schemas (out of scope for cargo/pytest runs)
- **Container (1):** pheno-wtrees (git worktree container; not buildable)

See `L6_PHENO_REPOS_HEALTH_2026_06_14.md` for full health inventory (136 tests pass, 4 fail in pheno-agents-md). See `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` for the 4 new crates added since.

### Submodule-style repos (~30 in submodules, e.g.)
- `AuthKit`, `Civis`, `Eidolon`, `Eventra`, `HeliosLab`, `KWatch`, `KodeVibe`, `KlipDot`, `McpKit`, `NetScript`, `PhenoKits`, `PhenoMCP`, `PhenoProc`, `Pyron`, `Tasken`, `Tracera`, `Tracely`, etc.

---

## Active ADRs (11 total)

**2026-06-14 wave (6 ADRs at `docs/adr/2026-06-14/`):**

| ADR | Repo | Disposition |
|---|---|---|
| ADR-001 | NetScript | **DELETE** (Rust→Go port abandoned; use `phenotype-go-sdk/pkg/lexer` instead) |
| ADR-002 | KlipDot | KEEP-archived (governance: do not delete) |
| ADR-003 | McpKit | MERGE into `PhenoMCP` |
| ADR-004 | Metron | KEEP (sole prod Prometheus library) |
| ADR-005 | KodeVibe | KEEP (1.7k LOC Go engine; schema already in HexaKit) |
| ADR-006 | cheap-llm-mcp | archive verified (2 cherry-picks, merge `a1612805`) |

**2026-06-15 wave (5 ADRs at `docs/adr/2026-06-15/`, added by parallel subagent):**

| ADR | Subject | Notes |
|---|---|---|
| ADR-007 | cheap-llm-mcp deprecation | Triggers W1-2 archive work |
| ADR-008 | dispatch-mcp as sole MCP server | consolidation decision |
| ADR-009..011 | (DAG-V5 reconciliation) | added 2026-06-15 by subagent |

---

## Wave Plan (v6 — current)

See `plans/2026-06-15-v6-dag-stable.md`. **5 tracks, 21 PRs, orchestrator-only, no subagent dependency.**

- Track 1: pheno-scaffold-kit repair (P0, ~3h, 7 PRs)
- Track 2: Apply 5 RESUME-wave proposed files (P1, ~2h, 5 PRs)
- Track 3: Drain 8 AgilePlus Tier 1 branches (P1, ~30min, 8 PRs)
- Track 4: cheap-llm-mcp lib-side refactor (P1, ~1.5h, 1 PR)
- Track 5: Re-test dispatch + filesystem stability (P0 gate, ~5min) — **3/4 components verified 2026-06-15 01:21 PDT** (gh, OmniRoute, fs pass; `task` tool verified working 01:25 PDT)

---

## Conventions

- **Branch naming:** `chore/<req-id>-<slug>-<date>` for chore work; `feat/<req-id>-<slug>-<date>` for features
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`) with optional scope
- **PR labels:** `governance` for cleanup, `L<n>-#<n>` for tracking against DAG level
- **SOTA artifacts:** `findings/`, `plans/`, `worklogs/`, `docs/adr/<date>/`
- **Meta-bundle for a release-ready crate:** `AGENTS.md` + `llms.txt` + `WORKLOG.md` + `CHANGELOG.md` + `LICENSE-MIT`

---

## Stale / warnings

- **Root `Cargo.toml` workspace** lists `crates/phenotype-error-core` as a member but the directory does NOT exist on this branch's sparse-checkout cone. **This is an intentional sparse-checkout artifact**, not a real bug. The crate exists in `phenoShared/crates/`, `FocalPoint/crates/`, `HexaKit/crates/`, `ResilienceKit/rust/`, etc. as workspace-local sub-paths.
- **Melosviz submodule** is `-dirty` (3 uncommitted files in the submodule). Do not commit the parent pointer until the submodule is clean.
- **Working tree shows 170+ "M" entries** for submodules — these are submodule pointer drifts from prior sessions, not modifications in this repo.

---

## Related

- `STATUS.md` — current state of the monorepo
- `SSOT.md` — single source of truth for repo conventions
- `SPEC.md` — top-level specification
- `L6_PHENO_REPOS_HEALTH_2026_06_14.md` — health inventory of pheno-* crates
- `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` — 2026-06-15 delta (4 new crates)
- `FLEET_DAG_v3.md` — FLEET DAG shape (180 tasks, all done)
- `plans/2026-06-15-v6-dag-stable.md` — current execution plan
- `findings/SESSION_STATUS_2026_06_15_0105.md` — most recent session status
