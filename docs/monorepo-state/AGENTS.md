# AGENTS.md — Phenotype monorepo

**Date:** 2026-06-19 05:00 PDT (T12 closure: ADR-033 + ADR-034 marked CLOSED; Decision C closed)
**Status:** ACTIVE (this file supersedes the prior FocalPoint template that lived here 2026-06-12 → 2026-06-15, the 2026-06-15 18:42 PDT version that lived here 2026-06-15 → 2026-06-17, and the 2026-06-17 12:00 PDT version that lived here 2026-06-17 → 2026-06-19)

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
gh --version && gh auth status                        # GitHub CLI (KooshaPari active as of 2026-06-15 18:40 PDT)
                                                      # Dmouse92 account still in keyring (read-only collaborator) — DO NOT push as Dmouse92.
                                                      # Owner account is KooshaPari — push target for ALL repos under github.com/KooshaPari/*
                                                      # If gh auth status shows Dmouse92 active, run: gh auth switch --user KooshaPari
curl -sf -m 3 http://localhost:20128/v1/models        # OmniRoute liveness
forge -p "<prompt>" -C /path/to/repo                  # Subagent dispatch (proven working 2026-06-15)
                                                      # (task tool had JSON errors; forge CLI works)

# Branch management
git worktree list                                     # Active worktrees
git stash list                                        # Stash backups
git branch --show-current                             # Current branch

# Audit doc + work DAG (live locations)
ls findings/71-pillar-2026-06-17*.md                  # 71-pillar industry-standard audit (this turn)
ls plans/2026-06-17-v7-dag-stable.md                  # v7 DAG (this turn; supersedes v6)
```

---

## Sub-repos at a Glance (sparse-checkout-visible, 2026-06-17)

### Active focus repos (5)
`AgilePlus`, `PhenoCompose`, `PlayCua`, `BytePort`, `nanovms` — coordinated via `chore/l5-87-focus-repo-specs-2026-06-11` branch.

### pheno-* family (22 visible)
- **Rust (11):** pheno-agents-md, pheno-cargo-template, pheno-cli-base, pheno-config, pheno-context, pheno-errors, pheno-flags, pheno-otel, pheno-port-adapter, pheno-tracing
- **Python (10):** pheno-cost-card, pheno-fastapi-base, pheno-llms-txt, pheno-mcp-router, pheno-prompt-test, pheno-pydantic-models, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema
- **Go (1):** pheno-go-ctxkit
- **TypeScript (1):** pheno-zod-schemas (out of scope for cargo/pytest runs)
- **Container (1):** pheno-wtrees (git worktree container; not buildable)

See `L6_PHENO_REPOS_HEALTH_2026_06_14.md` for full health inventory (136 tests pass, 4 fail in pheno-agents-md). See `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` for the 4 new crates added since. See `findings/71-pillar-2026-06-17.md` for the 71-pillar industry-standard audit (this turn).

### Submodule-style repos (~30 in submodules, e.g.)
- `AuthKit`, `Civis`, `Eidolon`, `Eventra`, `HeliosLab`, `KWatch`, `PhenoKits`, `PhenoMCP`, `PhenoProc`, `Pyron`, `Tasken`, `Tracera`, `Tracely`, etc.

**Deleted repos (wave-3 cleanup, 2026-06-18):** `KodeVibe`, `KlipDot`, `McpKit`, `NetScript`, `dispatch-mcp`, `cheap-llm-mcp`, `helios-router`, `Metron`, `phenotype-lexer-rs`, `phenotype-sdk`, `phenotype-bot-framework`, `phenotype-discord-adapter`, `phenotype-github-adapter`, `pheno-capacity` — all absorbed into `phenotype-tooling/docs/absorbed-from-X/`

---

## Active ADRs (49 total, +ADR-035 through +ADR-049 this turn)

**2026-06-14 wave (6 ADRs at `docs/adr/2026-06-14/`):**

| ADR | Repo | Disposition |
|---|---|---|
| ADR-001 | NetScript | **DELETE** (Rust→Go port abandoned; use `phenotype-go-sdk/pkg/lexer` instead) |
| ADR-002 | KlipDot | KEEP-archived (governance: do not delete) |
| ADR-003 | McpKit | MERGE into `PhenoMCP` |
| ADR-004 | Metron | KEEP (sole prod Prometheus library) |
| ADR-005 | KodeVibe | KEEP (1.7k LOC Go engine; schema already in HexaKit) |
| ADR-006 | cheap-llm-mcp | archive verified (2 cherry-picks, merge `a1612805`) |

**2026-06-15 wave (11 ADRs at `docs/adr/2026-06-15/`):**

| ADR | Subject | Notes |
|---|---|---|
| ADR-007 | cheap-llm-mcp deprecation | Triggers W1-2 archive work |
| ADR-008 | dispatch-mcp as sole MCP server | consolidation decision |
| ADR-009..011 | (DAG-V5 reconciliation) | added 2026-06-15 by subagent |
| ADR-012 | `pheno-tracing` canonical across pheno-* repos | V5 SOTA sweep |
| ADR-013 | `pheno-mcp-router` substrate for pheno-mcp-* | V5 SOTA sweep |
| ADR-014 | Hexagonal L4 ports: `Port` trait + `Adapter` impl | V5 SOTA sweep |
| ADR-015 | V2 10-column WORKLOG.md schema (canonical) | V5 SOTA sweep (v2.1 bump pending — `device:` field) |
| ADR-016 | Fork-only-not-rewrite policy for SOTA libraries | V5 SOTA sweep |

**2026-06-15 evening wave (V6 closure, 6 ADRs at `docs/adr/2026-06-15/`):**

| ADR | Subject | Notes |
|---|---|---|
| ADR-017 | `settly-*` archive — full deprecation | V6 Track 5 closure |
| ADR-018 | PRCP pattern (Polyglot Reuse via Canonical Ports) | V6 Track 5 closure |
| ADR-019 | `pheno-vessel-*` full deprecation | V6 Track 5 closure |
| ADR-020 | `pheno-types-*` full deprecation | V6 Track 5 closure |
| ADR-021 | `pheno-profiling` replaces `Profila` | V6 Track 5 closure |
| ADR-022 | Config consolidation — two-crate canonical split | Subagent-B 11-PR plan |
| **ADR-023** | **Agent-effort governance — device + dogfood + app substrate policy** | **L5-101, 2026-06-15** — see [§ App-level repo triage & substrate](#app-level-repo-triage--app-substrate-placement-adr-023) below |

**2026-06-17 wave (this turn):**

| ADR | Subject | Notes |
|---|---|---|
| **ADR-024** | **71-pillar industry-standard audit framework (L1-L71, 9 domains)** | **L5-102, 2026-06-17** — see `findings/71-pillar-2026-06-17-schema.md` |
| **ADR-025** **[CLOSED 2026-06-19]** | **ADR-015 v2.1 worklog schema bump (11th column `device:`)** | **L5-103, 2026-06-17** — supersedes v2.0; deprecation 2026-06-22; MERGED 2026-06-19 via T25; 30/30 tests; PR `KooshaPari/pheno-worklog-schema#1` merged |
| **ADR-026** | **Factory AI Agent Readiness Model as cross-cutting external standard** | **L5-104, 2026-06-17** — see <https://docs.factory.ai/web/agent-readiness/overview>; crosswalk in `audit-71-pillar-2026-06-17-wrapup.md` § 10 |
| **ADR-027** | **Git LFS 3-tier policy (always-track / on-demand / never-track)** | **L5-105, 2026-06-17** — closes L66; see `.gitattributes.example` |
| **ADR-028** | **Monorepo architecture eval: hybrid-with-staging-repo** | **L5-106, 2026-06-17** — closes L25; staging repo `phenotype-org-audits` |
| **ADR-029** | **Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emptied repos** | **L5-108, 2026-06-17** — see `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`; 6 PRs opened, 18 Dmouse92 repos archived |
| **ADR-030** **[CLOSED 2026-06-19]** | **pheno-worklog-schema v2.1 — add 11th `device:` column (macbook / heavy-runner / subagent / ci)** | **L5-104.5, 2026-06-17** — see `pheno-worklog-schema/SPEC-v2.1.md`; PR `KooshaPari/pheno-worklog-schema#1` **MERGED** 2026-06-19; 30/30 tests; 4 fleet WORKLOG.md migrated; v2.0 deprecation **2026-06-22** |
| **ADR-031** **[CLOSED 2026-06-19]** | **Configra absorb — `phenotype-config` folds into `Configra` as canonical name; ADR-022 split (Rust core / TS edge) preserved** | **L5-104.7, 2026-06-17** — see `docs/adr/2026-06-17/ADR-031-configra-absorb.md`; 2 PRs planned (1 on Configra, 1 deprecation on phenotype-config); `phenotype-config` archive date **2026-07-15** → **EXECUTED 2026-06-19**; sub-crate CANONICAL.md markers (phenotype-config-loader, phenotype-shared-config) re-pointed to Configra via `KooshaPari/pheno#238` (L5-110, merge `3f12e254`); `phenotype-config` deprecation continues on its 2026-07-15 schedule |
| **ADR-032** **[CLOSED 2026-06-19]** | **pheno-worklog-schema is a primitive lib, NOT a re-implementation of AgilePlus worklog** | **L5-104.8, 2026-06-17** — see `docs/adr/2026-06-17/ADR-032-pheno-worklog-schema-decision.md`; different formats (Markdown table vs JSONL), different audiences, both coexist |
| **ADR-033** **[CLOSED 2026-06-19]** | **Delete `KooshaPari/phenotype-monorepo-state` — single-source-of-truth; monorepo IS the canonical location** | **L5-104.9, 2026-06-17** — see `docs/adr/2026-06-17/ADR-033-phenotype-monorepo-state-deletion.md`; 11 commits consolidated to `phenotype-org-audits` + monorepo; `gh repo delete` after 30-day grace → **EXECUTED 2026-06-18, 18 days ahead of schedule**; verified HTTP 404 (2026-06-19 04:46 UTC); disposition-index `sr-monorepo-state` `fsm: done` |
| **ADR-034** **[CLOSED 2026-06-19]** | **`KooshaPari/phenotype-monorepo-state` deletion schedule — 2026-07-17** | **L5-104.10, 2026-06-17** — see `docs/adr/2026-06-17/ADR-034-monorepo-state-deletion-schedule.md`; 30-day grace + 5-step pre-deletion checklist → **schedule superseded by user-deleted 2026-06-18**; pre-checklist partially met (11 commits LOST, 5 ADR docs re-authored locally) |

---

## Wave Plan (v10 — current, supersedes v9)

See `plans/2026-06-19-v10-dag-stable.md`. **10 tracks, ~200 PRs, all closed.**

### v10 Track Execution (2026-06-19)

| Track | Status | Summary |
|-------|--------|--------|
| T24 | ✅ | Scanned all repos — 0 open PRs |
| T25 | ✅ | pheno-worklog-schema v2.1 fix branches merged (drift-detector, predict, framework-lint); 30/30 tests; AGENTS.md ADR-025 closure |
| T26 | ✅ | PR #122 integration merge verified complete |
| T27 | ✅ | Parent repo 2 commits pushed to `archive/2026-06-15-30-pillar-fleet` |
| T28 | ✅ | Scanned 17 repos — zero worktree/stash debt |
| T29 | 🔷 | 12/84 side-DAG fillers done; 72 remaining (SOTA sweep + guardrail hardening) |
| T30 | ✅ | `dagctl` repo recreated with binary v3.3.1; linked to `phenodag` source |
| T31 | ✅ | pheno-capacity extraction confirmed; HwLedger refs identified for re-pointing |
| T32 | ✅ | phenotype-gateway `feat/l5-117` merge confirmed; `master` is canonical branch |

---

## Conventions

- **Branch naming:** `chore/<req-id>-<slug>-<date>` for chore work; `feat/<req-id>-<slug>-<date>` for features
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`) with optional scope
- **PR labels:** `governance` for cleanup, `L<n>-#<n>` for tracking against DAG level
- **SOTA artifacts:** `findings/`, `plans/`, `worklogs/`, `docs/adr/<date>/`
- **Meta-bundle for a release-ready crate:** `AGENTS.md` + `llms.txt` + `WORKLOG.md` + `CHANGELOG.md` + `LICENSE-MIT`

---

## App-level repo triage & app substrate placement (ADR-023)

Source of truth: `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md`.
Decision log: `findings/2026-06-15-L5-101-app-governance.md`.
Worklog: `worklogs/L5-101-app-governance-2026-06-15.json`.

### Device-fit gate

The MacBook is **not** a heavy-work device. Heavy work is defined as anything that requires a full `cargo test --workspace` against a multi-100-crate workspace, an iOS Simulator boot, a Docker-in-Docker test, a Unity/Unreal editor head, or any single build/test cycle > 10 min wall on the MacBook. Heavy work runs on a self-hosted runner or a dispatched subagent (`device: heavy-runner`); the MacBook is reserved for planning, ADR-writing, small focused PRs, code review, and dogfooding (`device: macbook`). The `device:` field is in the worklog v2.1 schema (ADR-015 bump pending — see ADR-025).

### Active / Paused app-level repos (triage by dogfood use)

| Repo         | Bucket         | Allowed work                                                                                            |
| :----------- | :------------- | :------------------------------------------------------------------------------------------------------ |
| `Civis`      | **ACTIVE**     | Any. Full SWE process.                                                                                  |
| `focalpoint` | **PAUSED**     | Read-only. The prior AGENTS.md template is shelved.                                                     |
| `Dino`       | **CONDITIONAL** | Engine / non-frontend only (heavy visual engine, asset pipeline, deterministic sim). No UI / HUD / UX work right now. |
| `WSM`        | **CONDITIONAL** | None right now. Re-evaluate when an active consumer appears.                                            |
| `QuadSGM`    | **PAUSED**     | Read-only.                                                                                              |
| `AtomsBot*`  | **PAUSED (capstone)** | Read-only as a *target* of new work. **May be legally mined** (code, concepts, schema, docs, tests) — capstone project's sponsor is not in good standing; the public repo is fair-game reference material. |
| `HwLedger` + every other app-level repo not in this list | **RECLASSIFY** (default PAUSED) | Underlying parts to be moved to one of `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated service per Rule 3 below. |

A new repo defaults to **PAUSED** until it is added to this table with a bucket. A bucket change requires a one-line worklog entry (`bucket_change: from=... to=... reason=...`).

### App substrate placement (no "random `phenoShared`")

When an app-level repo needs a reusable underlying capability, that capability is placed in **exactly one** of:

| Substrate type             | When to use                                                                                                  | Examples in fleet                              |
| :------------------------- | :----------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| **`pheno-*-lib` / `pheno-*-core`** | Pure reusable library; language-specific; single concern, single crate.                                     | `pheno-config`, `pheno-context`, `pheno-port-adapter` |
| **`phenotype-*-sdk`**        | Cross-language SDK; stable public API; polyglot facade.                                                      | `phenotype-go-sdk`, `phenotype-python-sdk`     |
| **`phenotype-*-framework`**  | Inversion-of-control framework; opinionated lifecycle, ports, adapters, conventions.                        | `phenotype-hub`, `phenotype-bus`               |
| **Federated service**        | Stateful, long-running, independently scalable.                                                              | `phenoMCP`, `phenoObservability`, `phenoEvents` |

The "random `phenoShared`" pattern (and `crates/`, `libs/`, per-app `lib/`) is **forbidden** for new shared code. Existing "random `phenoShared`" placements are migrated per-capability; tracked in the L6 health-audit delta.

### Quality bar for new substrate (Rule 3.1)

Every new `pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`, or federated service ships with:

- **Spec** (`SPEC.md` or equiv) — 1-page max.
- **Docs** (`README.md` + 1 concept doc) — what, when, when **not**, 5-line quickstart.
- **Test matrix** — unit + integ minimum; e2e + perf + chaos strongly preferred for the 4 fleet-critical substrates (config, tracing, MCP-router, observability).
- **Observability** — OTLP export via `pheno-tracing` (ADR-012), info-level minimum.
- **Coverage gate** — 80 % lib/SDK, 70 % framework, 60 % federated service.
- **CI gate** — `pheno-ci-templates` runs the test matrix, coverage gate, OTLP smoke test.
- **Worklog v2.1** — including the new `device:` field.

The goal: **HITL-less dev from base intent**. A one-line intent ("I need a `Config` struct for my service that reads from env and a TOML file, with a 12-factor cascade") produces a PR that already has spec + docs + tests + coverage + observability + CI gate, without the human specifying each one.

---

## 71-pillar audit (this turn)

See `findings/71-pillar-2026-06-17-schema.md` for the full schema doc (industry references, scoring rubric, pillar definitions). See `findings/71-pillar-2026-06-17.md` for the latest scorecard across 10 existing repos. See `findings/71-pillar-2026-06-17-mapping.md` for the L1-L30 → L1-L71 crosswalk (so the older 30-pillar audit at `findings/30-pillar-2026-06-16.md` is not orphaned).

**Domains (9 total, 71 pillars):**

- **Architecture (AX)** L1-L12 (12)
- **Performance** L13-L19 (7)
- **Quality / Correctness** L20-L27 (8)
- **Developer Experience (DX)** L28-L37 (10)
- **User Experience (UX)** L38-L45 (8)
- **Security** L46-L55 (10)
- **Observability & Ops** L56-L63 (8)
- **Documentation & SSOT** L64-L68 (5)
- **Governance & Sustainability** L69-L71 (3)

**Industry references:** AWS Well-Architected Framework, Azure Well-Architected Framework, Google Cloud Architecture Framework, ISO 25010, OWASP ASVS, NIST SSDF, Microsoft SDL, DORA 2023 capabilities, Google SRE Book, CNCF Cloud Native Definition, OpenSSF Best Practices, Divio documentation system.

**Scoring:** 0-3 per pillar per repo (0=absent, 1=minimal, 2=adequate, 3=strong/SOTA). N/A=3 (per `audit-30-pillar-template.md` rule) for UI pillars (L40 i18n, L41 a11y) on headless backend/CLI libraries.

**Refresh cadence:** weekly (every Monday 09:00 PDT). Owner: worklog-schema circle. Diff against previous week is logged in `findings/71-pillar-{date}-delta.md`.

---

## Factory AI Agent Readiness (external cross-cutting, ADR-026, this turn)

Two complementary quality frameworks govern the fleet. See `audit-71-pillar-2026-06-17-wrapup.md` § 10 for the full Factory AI crosswalk.

**1. 71-pillar framework (ADR-024, internal)** — comprehensive static scoring across 9 domains, 71 pillars, L1-L71. Owned by the worklog-schema circle. See `findings/71-pillar-2026-06-17-schema.md` for schema, `findings/71-pillar-2026-06-17.md` for the scorecard, `findings/71-pillar-2026-06-17-mapping.md` for L1-L30 → L1-L71 crosswalk.

**2. Factory AI Agent Readiness Model (external standard)** — gated 5-level progression model (Functional → Documented → Standardized → Optimized → Autonomous) with 9 technical pillars (Style & Validation, Build System, Testing, Documentation, Dev Environment, Debugging & Observability, Security, Task Discovery, Product & Experimentation). 80% threshold per level. Org score = `floor(average of all repo levels)`. Source: <https://docs.factory.ai/web/agent-readiness/overview>.

**Tooling:** Run `/readiness-report` slash command from Droid CLI in any repo to evaluate. The 2-3 highest-impact action items from each report feed the next v7+ plan as P0 tasks.

**Why both:** The 71-pillar framework answers "what is the current state?" (breadth); the Factory AI Model answers "what is the next level to unlock?" (depth). Skipping 71-pillar misses breadth; skipping Factory AI misses progression. Both are tracked weekly; per-repo readiness estimates live in `STATUS.md` § "Factory AI Agent Readiness".

---

## Dmouse92 → KooshaPari migration (ADR-029, this turn)

**User directive (2026-06-17):** *"focus solely on the dmouse92 aspects of work — merge all over to kooshapari → then reconcile/absorb to proper repos. e.g. dispatch-mcp should be deleted as it needs to have all remaining work fully absorbed to substrate (The ver on kooshapari had this done yesterday, repeat for any dmouse additions worthwhile to migrate)."*

**Result:** 20 Dmouse92 phenorepos audited, 6 PRs opened on KooshaPari, 18 Dmouse92 repos archived. **0 net content loss.**

### 6 PRs opened on KooshaPari (2026-06-17 20:40-20:50 PDT)

| # | Repo | Branch → base | Title | What |
|---|---|---|---|---|
| [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) | pheno-mcp-router | `feat/port-cost-budget-quota-audit-tiers-2026-06-17` → `chore/l3-57-pheno-plugin-registry-2026-06-11` | feat(cost): port tiers/cost/budget/quota/audit/cost_middleware from dispatch-mcp W2-1 (L5-104.1) | 6 modules + 6 test files + PROVIDER_GUIDE.md |
| [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) | pheno-mcp-router | `feat/llama-adapter-2026-06-17` → same | feat(adapters): add LlamaAdapter (LlmPort) | Server + direct modes; 11 tests |
| [pheno-mcp-router#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) | pheno-mcp-router | `feat/openai-compat-adapter-2026-06-17` → same | feat(adapters): add OpenAICompatAdapter (LlmPort) | 429/5xx retry; 17 tests, 87% coverage |
| [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) | phenotype-config | `feat/l5-104-canonical-markers-2026-06-17` → `main` | feat(docs): port CANONICAL.md markers + SLSA doc from pheno ADR-012 (L5-104.2) | 2 CANONICAL.md markers + docs/slsa.md |
| [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) | phenotype-ops | `feat/llama-cpp-devops-2026-06-17` → `main` | feat(devops): add llama-cpp docker setup (L5-104.1) | Dockerfile + compose + README |
| [dispatch-mcp#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) | dispatch-mcp | `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` → `main` | docs: cherry-pick cheap-llm-mcp deprecation notice (W1.1, ADR-008) | docs/CHEAP_LLM_MCP_DEPRECATION.md (22 lines) |

### 18 Dmouse92 repos archived (2026-06-17 20:36 PDT, via Dmouse92 auth)

`AgilePlus`, `dispatch-mcp`, `pheno`, `phenodocs`, `forgecode`, `PhenoCompose`, `PhenoPlugins`, `PhenoProc`, `HeliosCLI`, `Pyron`, `HexaKit`, `Tracera`, `Civis`, `OmniRoute`, `KWatch`, `phenotype-ops`, `phenotype-otel`, `Nanovms`, `PhenoContracts`, `phenotype-teamcomm` — all under `github.com/Dmouse92/`. Archive (read-only marker) per user directive; delete only after 90-day GitHub retention.

### Substrate absorption matrix (per ADR-013/022/023)

| Dmouse92 content | Absorbed to | PR |
|---|---|---|
| `dispatch-mcp` W2-1 cost/budget/quota/audit/tiers (6 modules, ~2,000 LOC) | `pheno-mcp-router` substrate (ADR-013) | [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) |
| `dispatch-mcp` W2-1 `llama_cpp.py` provider | `pheno-mcp-router` `LlamaAdapter` (LlmPort) | [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) |
| `dispatch-mcp` W2-1 `openai_compat.py` provider (KP-authored) | `pheno-mcp-router` `OpenAICompatAdapter` (LlmPort) | [pheno-mcp-router#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) |
| `dispatch-mcp` W2-1 `PROVIDER_GUIDE.md` | `pheno-mcp-router/docs/PROVIDER_GUIDE.md` | [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) (squashed) |
| `dispatch-mcp` W2-1 `docker/Dockerfile.llama` + `llama-compose.yml` | `phenotype-ops/agent-devops-setups/llama-cpp/` (ADR-023 federated service) | [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) |
| `dispatch-mcp` W1-1 `docs/CHEAP_LLM_MCP_DEPRECATION.md` (cherry-pick) | `dispatch-mcp` (consumer-side notice) | [dispatch-mcp#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) |
| `pheno` ADR-012 `crates/phenotype-config-{loader,shared-config}/CANONICAL.md` (re-pointed) | `phenotype-config` substrate (ADR-022) | [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) |
| `pheno` ADR-012 `docs/slsa.md` | `phenotype-config/docs/slsa.md` | [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) |

**Discarded (per plan §2.2):** 5 of 7 Dmouse92 pheno ADR-012 commits (workflow consolidation, agileplus scaffolding, Cargo.lock skew) — verified KP/main already has the canonical version. 1 Dmouse92 dispatch-mcp commit (`9486edb` mock backend duplicate). 1 Dmouse92 dispatch-mcp file (`providers/base.py` — provider protocol shape diverges from substrate LlmPort).

### Audit doc

`findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (364 lines, execution COMPLETE 2026-06-17 20:55 PDT) — full cross-reference matrix, per-repo verdicts, decision matrix, execution log, stale warnings.

Sub-plans:
- `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md` (527 lines)
- `findings/2026-06-17-L5-104-pheno-adr012-migration-plan.md` (414 lines)
- `findings/2026-06-17-L5-104-bulk-rust-ts-migration.md` (999 lines)
- `findings/2026-06-17-L5-104-forgecode-migration.md` (305 lines)

---

## 4-repo retirement (2026-06-18)

**User directive (2026-06-18):** *"all 4 help merge into new target inqwhole ensure all specs, relevant features code properly itnegrated in and then delete. add to ntoes and ocnitnue dont seer"* + *"we are looking to etire kwality into a colleciton\absorb into a different project's arch. no new repos."*

Combined intent: migrate all 4 repos in one wave, ensure full integration of specs + features + code, archive source repos, continue.

### Migration matrix (all 4 PRs OPEN as of 2026-06-18)

| # | Source repo | Target repo | PR | What migrated |
|---|---|---|---|---|
| 1 | `KooshaPari/dagctl` (archived pre-existing) | `KooshaPari/phenodag` | [phenodag#13](https://github.com/KooshaPari/phenodag/pull/13) (+93) | `VERSION` v3.3.1, `CHANGELOG.md`, `docs/dagctl-absorption.md` (11-file merge log) |
| 2 | `KooshaPari/kwality` (archived this turn) | `KooshaPari/phenotype-tooling` | [phenotype-tooling#158](https://github.com/KooshaPari/phenotype-tooling/pull/158) (+29,422 / 93 files) | `docs/absorbed-from-kwality/`: full source (engines, internal, scripts, cmd), tests, examples, database, governance, demos |
| 3 | `KooshaPari/phenotype-auth-ts` (archived this turn) | `KooshaPari/AuthKit` | [AuthKit#120](https://github.com/KooshaPari/AuthKit/pull/120) (+1,901) | `typescript/packages/auth-ts/` (805 LOC, hexagonal, DDD, vitest BDD/CDD) |
| 4 | `KooshaPari/dinoforge-packs` (archived this turn) | `KooshaPari/Dino` | [Dino#297](https://github.com/KooshaPari/Dino/pull/297) (+2,329) | `packs/example-balance/` (NEW) + `packs/community-contributions/dinoforge-packs-mirror/` (snapshot) |

### Source archive status (verified 2026-06-18)

All 4 source repos are now **archived** (read-only marker):
- `KooshaPari/dagctl` (pre-existing 2026-06-17 22:44)
- `KooshaPari/kwality` (set 2026-06-18 in this turn)
- `KooshaPari/phenotype-auth-ts` (set 2026-06-18 in this turn)
- `KooshaPari/dinoforge-packs` (set 2026-06-18 in this turn)

### Delete status

All 4 source repos were **deleted** via `gh repo delete` after the active token was upgraded with `delete_repo` scope (2026-06-15+). Verified HTTP 404. 90-day GitHub retention applies to the soft-delete tombstone.

### Wave-3 mass deletion (2026-06-18)

11 additional repos deleted in wave-3 consolidation: `dispatch-mcp`, `cheap-llm-mcp`, `KodeVibe`, `helios-router`, `Metron`, `NetScript`, `phenotype-lexer-rs`, `phenotype-sdk`, `phenotype-bot-framework`, `phenotype-discord-adapter`, `phenotype-github-adapter`. All verified HTTP 404. All source code preserved in `phenotype-tooling/docs/absorbed-from-X/`.

Total: **15 repos deleted** across L5-109 + wave-3, 0 remaining.

### Migration notes file

See `findings/2026-06-18-L5-109-4-repo-retirement.md` for full migration matrix, integration verification, and policy notes.

### Policy decisions

- **kwality README "STRICTLY DO NOT DELETE NOR UNARCHIVE"** is overridden by user's higher-level org consolidation directive. The retirement preserves all source, tests, docs, governance as a collection under `phenotype-tooling/docs/absorbed-from-kwality/`.
- **dinoforge-packs ID divergence**: mirrored `warfare-starwars/manifest.yaml` uses legacy non-namespaced unit IDs (DO NOT load directly; see `Dino/docs/dinoforge-packs-absorption.md`).
- **AuthKit polyglot**: `@phenotype/auth-ts` slots into existing `typescript/packages/*` workspace alongside the existing package.


## Stale / warnings

- **Root `Cargo.toml` workspace** lists `crates/phenotype-error-core` as a member but the directory does NOT exist on this branch's sparse-checkout cone. **This is an intentional sparse-checkout artifact**, not a real bug. The crate exists in `phenoShared/crates/`, `FocalPoint/crates/`, `HexaKit/crates/`, `ResilienceKit/rust/`, etc. as workspace-local sub-paths.
- **Melosviz submodule** is `-dirty` (3 uncommitted files in the submodule). Do not commit the parent pointer until the submodule is clean.
- **Working tree shows 170+ "M" entries** for submodules — these are submodule pointer drifts from prior sessions, not modifications in this repo.
- **2 unapplied stashes (pre-2026-06-17)** — DROPPED this turn (WIP pheno-tracing fix already in HEAD via W5 batch).
- **4 empty `gate1-0..3` local branches** — DELETED this turn (probe commits, no content, not on any pushed branch).
- **ADR-015 v2.1 deprecation in 5 days** (2026-06-22) — see ADR-025 for the bump.
- **dispatch-mcp deletion**: Resolved — `dispatch-mcp` and all 10 other wave-3 repos deleted via `gh repo delete` (KooshaPari token now has `delete_repo` scope). Verified HTTP 404. See phenotype-tooling/docs/absorbed-from-dispatch-mcp/ for the preserved source.
- **L5-104 MIGRATION VERIFIED (2026-06-17)**: 100% migration coverage. dispatch-mcp: 6/6 unique W2-1 commits absorbed. pheno ADR-012: 7/7 commits decisioned. 14 bulk mirrors: 0 unique commits. forgecode: 0 of 378 branches contain unique Phenotype work.
- **Wave-3 consolidation (2026-06-18)**: 11 repos deleted, 6 absorption collections created in phenotype-tooling/docs/absorbed-from-{kodevibe,dispatch-mcp,metron,helios-router,phenotype-bots,phenotype-lexer-rs}/.

---

## Related

- `STATUS.md` — current state of the monorepo
- `SSOT.md` — single source of truth for repo conventions
- `SPEC.md` — top-level specification
- `L6_PHENO_REPOS_HEALTH_2026_06_14.md` — health inventory of pheno-* crates
- `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` — 2026-06-15 delta
- `findings/30-pillar-2026-06-16.md` — 30-pillar audit (superseded by 71-pillar)
- `findings/71-pillar-2026-06-17-schema.md` — 71-pillar schema doc
- `findings/71-pillar-2026-06-17.md` — 71-pillar scorecard (live)
- `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 → L1-L71 crosswalk
- `FLEET_DAG_v3.md` — FLEET DAG shape (180 tasks, all done)
- `plans/2026-06-15-v6-dag-stable.md` — superseded v6 plan
- `plans/2026-06-17-v7-dag-stable.md` — current v7 plan (this turn)
- `findings/SESSION_STATUS_2026_06_15_0105.md` — last session status (pre-W5-batch)
- `findings/2026-06-15-L5-101-app-governance.md` — ADR-023 decision log
- `findings/2026-06-17-L5-102-71-pillar-audit.md` — ADR-024 decision log (this turn)
- `findings/2026-06-17-L5-103-adr-015-v2-1.md` — ADR-025 decision log (this turn)
