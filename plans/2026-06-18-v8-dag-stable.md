# DAG v8 — Stable Spec (Phenotype Fleet Post-Wrap-up Backlog)

**Date authored:** 2026-06-18
**Status:** SPEC READY (not yet launched)
**Authoritative source:** AGENTS.md § "Wave Plan" + this file
**Supersedes:** v7 (`plans/2026-06-17-v7-dag-stable.md`)
**Ships-to:** This file (replaces v7)
**Extends:** `work-dag-2026-06-17-v7-extended.md` Tracks D + E (deferred from v7) + wrap-up P0/P1/P2 items + Decisions A/B/C/D from AGENTS.md

---

## Table of Contents

1. Executive Summary
2. Track Inventory
3. Per-Track Task List
4. Topological Sort
5. PR Matrix
6. Risk Register
7. Success Criteria
8. Cross-References
9. Appendices A-F

---

## 1. Executive Summary

**v8 is the post-push engineering backlog for 2026-06-18.** It picks up where the push wrap-up session ended (19/20 branches now on `KooshaPari/phenotype-apps`) and the v7 closure, then drives the fleet toward 71-pillar ✓ status across all substrate repos. v8 has **18 tracks, ~210 tasks, ~200 PRs**, sized to ~15 minutes wall-clock per task. With 6-way forge subagent parallelism, the critical path is ~22 hours; sequential, ~52 hours.

**v8 unique goals vs v7:**
- **Conclude the wrap-up push** (T9.x: secret-blocked branch + AGENTS.md refresh)
- **Adopt the user-requested bigger scope** (100-500 tasks; v8 = ~210)
- **Execute AGENTS.md Decisions A-D** (T10/T11/T12: Configra absorption, worklog merge decision, monorepo-state cleanup)
- **Refresh the 71-pillar audit** (T13.x: weekly cadence + 20 more repos probed)
- **Backlog the v7-deferred Tracks D + E** (T14-T18: UX, AX, DX, runtime LFS, ADRs 030-040)
- **Sweep the fleet** (T15-T18: pheno-flake homogenization, substrate audit, lean code, test coverage)
- **Hardening** (T19-T23: CI templates, doc refresh, security, observability, registry)

**Owners:** orchestrator + 6 parallel forge subagents (forge-A through forge-F). Each subagent owns 1 track at a time, rotates when its track lands.

**v8 supersedes v7** (8 tracks, ~40 PRs, ~2h parallel).

---

## 2. Track Inventory

| # | Track | P-level | Goal | Task count | PR count | Effort (parallel) | Owner |
|---|---|---|---|---|---|---|---|
| **T0** | Pre-flight Gate | P0 | Verify auth + forge + OmniRoute + clean tree before launching | 5 | 0 | ~10 min | orchestrator |
| **T9** | Push Wrap-up Completion | P0 | Land secret-blocked branch, refresh AGENTS.md, set upstream tracking | 6 | 4 | ~15 min | orchestrator |
| **T10** | Configra Absorption (Decision A) | P0 | ADR-031 + absorb `pheno-config` / `phenotype-config*` / `Conft` / `settly-*` → `KooshaPari/Configra` | 12 | 12 | ~90 min | orchestrator + 3 subagents |
| **T11** | Worklog Schema Merge Decision (Decision B) | P1 | Decide whether to keep `pheno-worklog-schema` + AgilePlus worklogs separate, or merge | 6 | 4 | ~45 min | orchestrator |
| **T12** | Monorepo-state Cleanup (Decision C) | P1 | Migrate 4 governance-snapshot commits from `KooshaPari/phenotype-monorepo-state` back to local, then delete | 6 | 2 | ~30 min | orchestrator |
| **T13** | 71-pillar Re-audit | P1 | Re-probe top-10 repos, extend to 20 more repos (30 total), compute weekly delta | 18 | 3 | ~120 min | orchestrator + 6 subagents (per-repo) |
| **T14** | ADR Backlog (ADR-030 .. ADR-040) | P1 | Author 11 new ADRs covering governance gaps surfaced by 71-pillar | 11 | 11 | ~90 min | orchestrator |
| **T15** | Pheno-flake Refresh | P1 | Homogenize meta-bundle + tests + CI across 22 pheno-* repos | 22 | 22 | ~150 min | orchestrator + 4 subagents |
| **T16** | Substrate Audit | P1 | Deep audit of 4 fleet-critical substrates: config, tracing, mcp-router, observability | 18 | 4 | ~120 min | orchestrator + 3 subagents |
| **T17** | Lean Code Quality | P2 | `cargo clippy --strict` + dead-code + unused-imports sweep across pheno-* crates | 25 | 25 | ~180 min | orchestrator + 4 subagents |
| **T18** | Test Coverage Pass | P1 | Bring each substrate tier to gate (80% lib / 70% framework / 60% service) | 22 | 22 | ~150 min | orchestrator + 4 subagents |
| **T19** | CI Templates Refresh | P1 | `pheno-ci-templates`: HOOKS_SKIP, SKIP, dependabot, OIDC, SBOM | 10 | 8 | ~75 min | orchestrator |
| **T20** | Documentation Refresh | P1 | llms.txt + SPEC.md + ADR-015 quickstart across 20 substrate repos | 18 | 18 | ~120 min | orchestrator + 3 subagents |
| **T21** | Security Audit | P0 | Secret-scan fleet, SBOM generation, dependency vulnerability scan, SLSA provenance | 12 | 8 | ~90 min | orchestrator + 2 subagents |
| **T22** | Observability Wiring | P1 | Adopt `pheno-tracing` + OTLP export across substrate fleet | 15 | 15 | ~120 min | orchestrator + 3 subagents |
| **T23** | Registry Refresh | P1 | `phenotype-registry`: rebase stale entries, adopt ADR-013 substrate model | 8 | 6 | ~60 min | orchestrator |
| **T16.5** | Stranded Worktree Recovery | P0 | Sweep `/private/tmp/*` and `.worktrees/*` for any remaining unrecovered work | 6 | 4 | ~45 min | orchestrator |
| **T0.5** | Wrap-up | P0 | Author `v8-wrapup.md`, push final branch to origin, write postmortem | 5 | 0 | ~15 min | orchestrator |
| | | | **Total** | **~210 tasks** | **~200 PRs** | **~22h parallel / ~52h sequential** | |

**Tracks with internal parallelism: 14 of 18** (T9, T10, T13, T15, T16, T17, T18, T19, T20, T21, T22, T23, T16.5 have 2-6 subagent streams; T0, T11, T12, T14, T0.5 are orchestrator-only)

---

## 3. Per-Track Task List

### 3.0 Track T0 — Pre-flight Gate (P0, ~10 min, orchestrator)

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T0.1** | Verify `gh auth status` → KooshaPari active | P0 | orchestrator | `gh auth status 2>&1 | grep -q 'Logged in to github.com account KooshaPari'` returns 0 |
| **T0.2** | Verify `forge -p "echo ok" -C /tmp` returns 0 in < 30s | P0 | orchestrator | Subagent dispatch gate (R1 mitigation from v7) |
| **T0.3** | Verify OmniRoute liveness | P0 | orchestrator | `curl -sf -m 3 http://localhost:20128/v1/models` returns 4+ models |
| **T0.4** | Verify clean working tree | P0 | orchestrator | `git status --short | wc -l` ≤ 5 (submodule pointer drifts expected) |
| **T0.5** | Verify 0 stashes + 0 gate1 branches | P0 | orchestrator | `git stash list | wc -l` = 0; `git branch | grep -c gate1-` = 0 |

If any check fails, the launch log records the failure and the corresponding track is held.

### 3.1 Track T9 — Push Wrap-up Completion (P0, ~15 min, orchestrator)

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T9.1** | Resolve `chore/w5-adrs-sota-2026-06-15-v2` secret scanner block: `git log -p 3c645788ff` to identify secret; rotate credential in `phenotype-python-sdk@7499fd2` upstream | P0 | orchestrator | Secret identified; rotated; SDK history scrubbed |
| **T9.2** | Re-bump submodule to clean SDK SHA; re-attempt push to origin | P0 | orchestrator | `git push origin chore/w5-adrs-sota-2026-06-15-v2` exits 0 |
| **T9.3** | Refresh `AGENTS.md`: update `origin` → `KooshaPari/phenotype-apps` (was stale `KooshaPari/FocalPoint`) | P0 | orchestrator | `grep -c 'KooshaPari/phenotype-apps' AGENTS.md` ≥ 3 |
| **T9.4** | Set upstream tracking on 19 pushed branches | P0 | orchestrator | `git for-each-ref --format='%(upstream:short)' refs/heads/ | grep -c origin/` ≥ 19 |
| **T9.5** | Refresh `STATUS.md` with new branch inventory (20 on origin) + push hygiene state | P0 | orchestrator | `grep -c 'KooshaPari/phenotype-apps' STATUS.md` ≥ 2 |
| **T9.6** | Commit `chore(governance): refresh AGENTS.md + STATUS.md for v8 launch` on `chore/l5-87-focus-repo-specs-2026-06-11`; push to origin | P0 | orchestrator | Push succeeds; new SHA on origin |

**Track T9 PR count: 4** (T9.2 secret-blocked branch + T9.3 AGENTS.md + T9.5 STATUS.md + T9.6 chore commit PR)

### 3.2 Track T10 — Configra Absorption (P0, ~90 min parallel, orchestrator + 3 subagents)

Per AGENTS.md **Decision A** — `KooshaPari/Configra` is the canonical config repo. All `pheno-config*` / `phenotype-config*` / `Conft` / `settly-*` migrate into it.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T10.1** | Author ADR-031: "Configra is canonical config substrate; deprecate all config-like repos" | P0 | orchestrator | ADR at `docs/adr/2026-06-18/ADR-031-configra-canonical.md` |
| **T10.2** | Author `KooshaPari/Configra` absorbing PR: import `pheno-config`'s canonical Rust config from `phenoShared/phenotype-config-core` | P0 | forge-A | `cargo build -p configra` green; 80% coverage |
| **T10.3** | Import `phenotype-config`'s Rust core | P0 | forge-A | `cargo build -p configra` green; existing tests pass |
| **T10.4** | Import `phenotype-config-rs` (if separate) | P0 | forge-A | `cargo build -p configra` green |
| **T10.5** | Import `Conft` TypeScript edge layer | P0 | forge-B | `pnpm test` green; TypeScript types match |
| **T10.6** | Import `settly-config` (deprecated) | P0 | forge-B | SettlyConfig wraps Configra; deprecation note |
| **T10.7** | Import `settly-config-py` (deprecated) | P0 | forge-B | Python wrapper; deprecation note |
| **T10.8** | Migration PR #1: `pheno-config` → points to Configra via `pheno-config = { package = "configra" }` | P0 | forge-A | `cargo build` green; `pheno-config` is now a thin re-export |
| **T10.9** | Migration PR #2: `phenotype-config` → Configra | P0 | forge-A | Same |
| **T10.10** | Migration PR #3: `phenotype-config-rs` → Configra (or absorbed) | P0 | forge-A | Same |
| **T10.11** | Migration PR #4: `Conft` → Configra TS edge | P0 | forge-B | `pnpm test` green |
| **T10.12** | Migration PR #5-8: `settly-*` → Configra (4 repos) | P0 | forge-B | 4 PRs opened; deprecation note in each README |

**Track T10 PR count: 12** (1 ADR + 5 import + 8 migration; T10.2-T10.7 are absorb-import into Configra, T10.8-T10.12 are migrate-from-PRs)

**Parallelism:** forge-A handles pheno-config / phenotype-config* absorption; forge-B handles Conft / settly-* absorption; orchestrator authors ADR + reviews.

### 3.3 Track T11 — Worklog Schema Merge Decision (P1, ~45 min, orchestrator)

Per AGENTS.md **Decision B** — `pheno-worklog-schema` is a primitive lib; AgilePlus worklogs are machine-readable. Decision: keep separate (v8 default) OR merge. Decision deferred pending design session.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T11.1** | Author design doc `findings/2026-06-18-worklog-merge-decision.md` covering: schema layer (markdown) vs audit trail (JSONL); merge cost; tool gap analysis | P1 | orchestrator | Doc exists; ≥ 200 lines; 3 options analyzed |
| **T11.2** | Run probe: count worklog files in `pheno-worklog-schema` vs AgilePlus | P1 | orchestrator | `find / -path '*/worklogs/*.json' | wc -l` vs `find / -path '*/worklogs/*.md' | wc -l` |
| **T11.3** | Run probe: count consumers of each format | P1 | orchestrator | `git grep -l 'worklog-' pheno-*/src` count |
| **T11.4** | Author ADR-032: "Worklog format split (markdown schema + JSONL audit trail) — KEEP SEPARATE" | P1 | orchestrator | ADR exists; rationale cited |
| **T11.5** | Update `pheno-worklog-schema` README to clarify scope vs AgilePlus | P1 | orchestrator | "What this is NOT" section added |
| **T11.6** | Open PR in `AgilePlus` clarifying its worklog scope | P1 | orchestrator | README updated; cross-link to pheno-worklog-schema |

**Track T11 PR count: 4** (T11.4 ADR + T11.5 pheno-worklog-schema README + T11.6 AgilePlus README + 1 decision log)

### 3.4 Track T12 — Monorepo-state Cleanup (P1, ~30 min, orchestrator)

Per AGENTS.md **Decision C** — `KooshaPari/phenotype-monorepo-state` should not exist going forward.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T12.1** | Fetch `KooshaPari/phenotype-monorepo-state` (single branch, 4 commits, 0 PRs) | P1 | orchestrator | `git ls-remote --heads KooshaPari/phenotype-monorepo-state` returns 1 |
| **T12.2** | Identify the 4 governance-snapshot commits; extract their `findings/` + `docs/adr/` + `plans/` content | P1 | orchestrator | `git log --oneline origin/main` shows 4 commits; content extracted |
| **T12.3** | Apply content to local `archive/2026-06-15-30-pillar-fleet` branch as 1 squash commit | P1 | orchestrator | Local branch has the content; commit message references source |
| **T12.4** | Push updated branch to origin (`KooshaPari/phenotype-apps:archive/2026-06-15-30-pillar-fleet`) | P1 | orchestrator | `git ls-remote origin archive/...` returns new SHA |
| **T12.5** | Open PR in `KooshaPari/phenotype-monorepo-state` marking it for deletion: `chore: migrate to local monorepo, ready for archival` | P1 | orchestrator | PR opened; body references Decision C |
| **T12.6** | Archive `KooshaPari/phenotype-monorepo-state` via `gh repo archive --yes` | P1 | orchestrator | `gh api repos/KooshaPari/phenotype-monorepo-state | jq .archived` → true |

**Track T12 PR count: 2** (T12.5 monorepo-state archival PR + T12.4 archive branch update)

### 3.5 Track T13 — 71-pillar Re-audit (P1, ~120 min, orchestrator + 6 subagents)

Re-probe top-10 repos (already in v7 scorecard) + extend to 20 more repos (30 total). Compute weekly delta.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T13.1** | Run probe on `KooshaPari/AgilePlus` (top-10) | P1 | forge-A | Score JSON at `findings/71-pillar-2026-06-18-AgilePlus.json` |
| **T13.2** | Run probe on `KooshaPari/pheno` | P1 | forge-A | Same |
| **T13.3** | Run probe on `KooshaPari/phenoShared` | P1 | forge-A | Same |
| **T13.4** | Run probe on `KooshaPari/dispatch-mcp` | P1 | forge-A | Same |
| **T13.5** | Run probe on `KooshaPari/phenodocs` | P1 | forge-B | Same |
| **T13.6** | Run probe on `KooshaPari/Civis` | P1 | forge-B | Same |
| **T13.7** | Run probe on `KooshaPari/PhenoMCP` | P1 | forge-B | Same |
| **T13.8** | Run probe on `KooshaPari/OmniRoute` | P1 | forge-B | Same |
| **T13.9** | Run probe on `KooshaPari/KWatch` | P1 | forge-B | Same |
| **T13.10** | Run probe on `KooshaPari/HeliosLab` | P1 | forge-B | Same |
| **T13.11** | Run probe on extended 20 repos: `pheno-config`, `pheno-context`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`, `pheno-flags`, `pheno-errors`, `pheno-cli-base`, `pheno-cargo-template`, `pheno-agents-md` | P1 | forge-C | 10 score JSONs |
| **T13.12** | Run probe on remaining: `pheno-fastapi-base`, `pheno-pydantic-models`, `pheno-zod-schemas`, `pheno-mcp-router`, `pheno-cost-card`, `pheno-worklog-schema`, `pheno-vibecoding-guard`, `pheno-scaffold-kit`, `pheno-llms-txt`, `pheno-prompt-test` | P1 | forge-C | 10 score JSONs |
| **T13.13** | Aggregate scores into `findings/71-pillar-2026-06-18.md` | P1 | orchestrator | 30 × 71 = 2130 cells |
| **T13.14** | Render heatmap at `findings/71-pillar-2026-06-18-render.md` | P1 | orchestrator | ASCII heatmap; per-domain counts |
| **T13.15** | Compute weekly delta: `findings/71-pillar-2026-06-18-delta.md` (vs 2026-06-17 baseline) | P1 | orchestrator | ✓/△/⚠ counts compared |
| **T13.16** | Author ADR-033: "71-pillar refresh cadence formalized (weekly Monday 09:00 PDT)" | P1 | orchestrator | ADR exists |
| **T13.17** | Add `/.github/workflows/71-pillar-weekly.yml` to `phenotype-org-audits` | P1 | forge-D | Cron workflow: Mon 09:00 PDT |
| **T13.18** | Open PR in `KooshaPari/phenotype-org-audits`: "chore(71-pillar): 2026-06-18 refresh" | P1 | orchestrator | PR opened; CI green |

**Track T13 PR count: 3** (T13.18 + T13.16 ADR-033 + T13.17 cron workflow)

**Parallelism:** forge-A handles first 4, forge-B handles next 6, forge-C handles 20 extended (heaviest), forge-D handles workflow, orchestrator aggregates.

### 3.6 Track T14 — ADR Backlog (P1, ~90 min, orchestrator)

11 new ADRs covering governance gaps surfaced by the 71-pillar audit and v7 wrap-up.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T14.1** | ADR-030: "Spine repos are read-only references (Decision D)" | P1 | orchestrator | ADR exists |
| **T14.2** | ADR-031: "Configra canonical config substrate" (also referenced by T10.1) | P1 | orchestrator | Same |
| **T14.3** | ADR-032: "Worklog format split (markdown schema + JSONL audit trail)" (T11.4) | P1 | orchestrator | Same |
| **T14.4** | ADR-033: "71-pillar refresh cadence (weekly Monday 09:00 PDT)" (T13.16) | P1 | orchestrator | Same |
| **T14.5** | ADR-034: "Substrate quality bar (Rule 3.1)" — codified from AGENTS.md § "Quality bar" | P1 | orchestrator | Same |
| **T14.6** | ADR-035: "Pheno-flake naming convention (pheno-*-lib vs pheno-*-core)" | P1 | orchestrator | Same |
| **T14.7** | ADR-036: "Worklog schema deprecation cycle (6-month sunset)" | P1 | orchestrator | Same |
| **T14.8** | ADR-037: "Federated service SLAs (phenoMCP, phenoObservability)" | P1 | orchestrator | Same |
| **T14.9** | ADR-038: "Dmouse92 archival policy (90-day GitHub retention)" | P1 | orchestrator | Same |
| **T14.10** | ADR-039: "Pre-flight gate (T0) is mandatory for v9+ waves" | P1 | orchestrator | Same |
| **T14.11** | ADR-040: "Track sizing convention (~15 min wall per task; ≤ 25 tasks per track)" | P1 | orchestrator | Same |

**Track T14 PR count: 11** (1 per ADR; each opens as its own PR for review; can be batched into single PR if user prefers)

**Parallelism:** All orchestrator; can run 2-3 in parallel via draft-then-review.

### 3.7 Track T15 — Pheno-flake Refresh (P1, ~150 min parallel, orchestrator + 4 subagents)

Homogenize meta-bundle + tests + CI across 22 pheno-* repos. Each repo gets a meta-bundle PR + tests PR + CI PR.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T15.1** | `pheno-config`: meta-bundle + tests | P1 | forge-A | 5 files + test suite |
| **T15.2** | `pheno-context`: meta-bundle + tests | P1 | forge-A | Same |
| **T15.3** | `pheno-otel`: meta-bundle + tests | P1 | forge-A | Same |
| **T15.4** | `pheno-port-adapter`: meta-bundle + tests | P1 | forge-A | Same |
| **T15.5** | `pheno-tracing`: meta-bundle + tests | P1 | forge-A | Same |
| **T15.6** | `pheno-flags`: meta-bundle + tests | P1 | forge-B | Same |
| **T15.7** | `pheno-errors`: meta-bundle + tests | P1 | forge-B | Same |
| **T15.8** | `pheno-cli-base`: meta-bundle + tests | P1 | forge-B | Same |
| **T15.9** | `pheno-cargo-template`: meta-bundle + tests | P1 | forge-B | Same |
| **T15.10** | `pheno-agents-md`: meta-bundle + tests | P1 | forge-B | Same |
| **T15.11** | `pheno-fastapi-base`: meta-bundle + tests | P1 | forge-C | Same |
| **T15.12** | `pheno-pydantic-models`: meta-bundle + tests | P1 | forge-C | Same |
| **T15.13** | `pheno-zod-schemas`: meta-bundle + tests | P1 | forge-C | Same |
| **T15.14** | `pheno-mcp-router`: meta-bundle + tests | P1 | forge-C | Same |
| **T15.15** | `pheno-cost-card`: meta-bundle + tests | P1 | forge-C | Same |
| **T15.16** | `pheno-worklog-schema`: meta-bundle + tests | P1 | forge-D | Same |
| **T15.17** | `pheno-vibecoding-guard`: meta-bundle + tests | P1 | forge-D | Same |
| **T15.18** | `pheno-scaffold-kit`: meta-bundle + tests | P1 | forge-D | Same |
| **T15.19** | `pheno-llms-txt`: meta-bundle + tests | P1 | forge-D | Same |
| **T15.20** | `pheno-prompt-test`: meta-bundle + tests | P1 | forge-D | Same |
| **T15.21** | `pheno-go-ctxkit`: meta-bundle + tests | P1 | forge-A | Same (Go) |
| **T15.22** | `pheno-context` (Python variant if separate): meta-bundle + tests | P1 | forge-B | Same (Python) |

**Track T15 PR count: 22** (1 per repo)

**Parallelism:** forge-A handles 6, forge-B handles 6, forge-C handles 5, forge-D handles 5.

### 3.8 Track T16 — Substrate Audit (P1, ~120 min, orchestrator + 3 subagents)

Deep audit of 4 fleet-critical substrates: config, tracing, mcp-router, observability.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T16.1** | Audit `Configra` (post-T10) against 71-pillar | P1 | orchestrator | Score JSON + gap analysis |
| **T16.2** | Audit `pheno-tracing` against 71-pillar | P1 | orchestrator | Same |
| **T16.3** | Audit `pheno-mcp-router` against 71-pillar | P1 | orchestrator | Same |
| **T16.4** | Audit `phenotype-otel` against 71-pillar | P1 | orchestrator | Same |
| **T16.5** | Gap analysis: identify top-5 weakest pillars per substrate | P1 | forge-E | Gap doc at `findings/2026-06-18-substrate-gaps.md` |
| **T16.6** | Configra gap-closure PR: spec, docs, tests, coverage, observability per Rule 3.1 | P1 | forge-E | 5 PRs (1 per gap) |
| **T16.7** | pheno-tracing gap-closure PR | P1 | forge-E | Same |
| **T16.8** | pheno-mcp-router gap-closure PR | P1 | forge-F | Same |
| **T16.9** | phenotype-otel gap-closure PR | P1 | forge-F | Same |
| **T16.10** | Verify each substrate meets Rule 3.1 quality bar | P1 | orchestrator | 4/4 ✓ |
| **T16.11** | Adopt pheno-tracing in Configra | P1 | forge-E | OTLP export configured |
| **T16.12** | Adopt pheno-tracing in pheno-mcp-router | P1 | forge-F | Same |
| **T16.13** | Adopt pheno-tracing in phenotype-otel | P1 | forge-F | Same |
| **T16.14** | Adopt pheno-tracing in 3 other key repos | P1 | forge-E | 3 PRs |
| **T16.15** | Cross-substrate integration test | P1 | orchestrator | Test exercises config → tracing → mcp-router → otel |
| **T16.16** | Substrate ownership matrix doc update | P1 | orchestrator | SSOT.md + AGENTS.md updated |
| **T16.17** | ADR-041: "Substrate audit cycle (quarterly)" | P1 | orchestrator | ADR exists |
| **T16.18** | Cron workflow: `/.github/workflows/substrate-audit-quarterly.yml` | P1 | forge-E | Quarterly trigger |

**Track T16 PR count: 4** (T16.6-16.9 are 1 PR each per substrate = 4; T16.11-16.14 are bundled into the gap-closure PRs)

### 3.9 Track T17 — Lean Code Quality (P2, ~180 min parallel, orchestrator + 4 subagents)

`cargo clippy --strict` + dead-code + unused-imports sweep across pheno-* crates.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T17.1** | `pheno-config`: clippy strict + dead-code pass | P2 | forge-A | 0 clippy warnings; 0 dead-code |
| **T17.2** | `pheno-context`: clippy strict + dead-code pass | P2 | forge-A | Same |
| **T17.3** | `pheno-otel`: clippy strict + dead-code pass | P2 | forge-A | Same |
| **T17.4** | `pheno-port-adapter`: clippy strict + dead-code pass | P2 | forge-A | Same |
| **T17.5** | `pheno-tracing`: clippy strict + dead-code pass | P2 | forge-A | Same |
| **T17.6** | `pheno-flags`: clippy strict + dead-code pass | P2 | forge-B | Same |
| **T17.7** | `pheno-errors`: clippy strict + dead-code pass | P2 | forge-B | Same |
| **T17.8** | `pheno-cli-base`: clippy strict + dead-code pass | P2 | forge-B | Same |
| **T17.9** | `pheno-cargo-template`: clippy strict + dead-code pass | P2 | forge-B | Same |
| **T17.10** | `pheno-agents-md`: clippy strict + dead-code pass | P2 | forge-B | Same |
| **T17.11** | `pheno-worklog-schema` (Python): ruff strict + dead-code | P2 | forge-C | 0 ruff warnings |
| **T17.12** | `pheno-pydantic-models`: mypy strict + ruff | P2 | forge-C | Same |
| **T17.13** | `pheno-fastapi-base`: mypy strict + ruff | P2 | forge-C | Same |
| **T17.14** | `pheno-zod-schemas`: tsc strict + eslint strict | P2 | forge-C | Same |
| **T17.15** | `pheno-mcp-router`: mypy strict + ruff | P2 | forge-C | Same |
| **T17.16** | `pheno-vibecoding-guard`: ruff | P2 | forge-D | Same |
| **T17.17** | `pheno-scaffold-kit`: ruff | P2 | forge-D | Same |
| **T17.18** | `pheno-llms-txt`: ruff | P2 | forge-D | Same |
| **T17.19** | `pheno-prompt-test`: ruff | P2 | forge-D | Same |
| **T17.20** | `pheno-cost-card`: ruff | P2 | forge-D | Same |
| **T17.21** | `pheno-go-ctxkit`: golangci-lint strict | P2 | forge-A | Same |
| **T17.22** | Sweep unused-imports across all 22 pheno-* repos | P2 | forge-D | 0 unused imports |
| **T17.23** | Sweep unsafe code blocks (audit, not remove) | P2 | orchestrator | Doc at `findings/2026-06-18-unsafe-audit.md` |
| **T17.24** | Sweep TODOs / FIXMEs | P2 | orchestrator | Doc at `findings/2026-06-18-todo-audit.md` |
| **T17.25** | Author `lint-justfile` recipe: `just lint` runs all linters across fleet | P2 | orchestrator | Recipe in Justfile |

**Track T17 PR count: 25** (1 per pheno-* repo for clippy/ruff/etc. sweep)

### 3.10 Track T18 — Test Coverage Pass (P1, ~150 min parallel, orchestrator + 4 subagents)

Bring each substrate tier to gate (80% lib / 70% framework / 60% service).

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T18.1** | `pheno-config`: measure baseline coverage; add tests to 80% | P1 | forge-A | tarpaulin report; ≥ 80% |
| **T18.2** | `pheno-context`: ≥ 80% | P1 | forge-A | Same |
| **T18.3** | `pheno-otel`: ≥ 80% | P1 | forge-A | Same |
| **T18.4** | `pheno-port-adapter`: ≥ 80% | P1 | forge-A | Same |
| **T18.5** | `pheno-tracing`: ≥ 80% | P1 | forge-A | Same |
| **T18.6** | `pheno-flags`: ≥ 80% | P1 | forge-B | Same |
| **T18.7** | `pheno-errors`: ≥ 80% | P1 | forge-B | Same |
| **T18.8** | `pheno-cli-base`: ≥ 80% | P1 | forge-B | Same |
| **T18.9** | `pheno-cargo-template`: ≥ 80% | P1 | forge-B | Same |
| **T18.10** | `pheno-agents-md`: ≥ 80% | P1 | forge-B | Same |
| **T18.11** | `phenotype-hub` (framework): ≥ 70% | P1 | forge-C | Same |
| **T18.12** | `phenotype-bus` (framework): ≥ 70% | P1 | forge-C | Same |
| **T18.13** | `phenoMCP` (service): ≥ 60% | P1 | forge-C | Same |
| **T18.14** | `phenoObservability` (service): ≥ 60% | P1 | forge-C | Same |
| **T18.15** | `phenoEvents` (service): ≥ 60% | P1 | forge-C | Same |
| **T18.16** | `phenoRegistry` (service): ≥ 60% | P1 | forge-D | Same |
| **T18.17** | `phenoWorkspace` (service): ≥ 60% | P1 | forge-D | Same |
| **T18.18** | `phenoAgent` (service): ≥ 60% | P1 | forge-D | Same |
| **T18.19** | `phenoHub` (service): ≥ 60% | P1 | forge-D | Same |
| **T18.20** | `phenoBus` (service): ≥ 60% | P1 | forge-D | Same |
| **T18.21** | Coverage gate in CI: each PR fails if coverage drops below tier | P1 | orchestrator | `pheno-ci-templates/coverage-gate.yml` |
| **T18.22** | Weekly coverage trend report | P1 | orchestrator | Cron workflow |

**Track T18 PR count: 22** (1 per repo; T18.21 is a CI template PR)

### 3.11 Track T19 — CI Templates Refresh (P1, ~75 min, orchestrator)

`pheno-ci-templates`: HOOKS_SKIP, SKIP, dependabot, OIDC, SBOM.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T19.1** | Audit current `pheno-ci-templates` repo: list all templates, identify staleness | P1 | orchestrator | Doc at `findings/2026-06-18-ci-templates-audit.md` |
| **T19.2** | Author `HOOKS_SKIP=1` spec (already in v7 T1.7; verify) | P1 | orchestrator | Spec doc exists |
| **T19.3** | Author `SKIP=pre-push,pre-commit` spec | P1 | orchestrator | Same |
| **T19.4** | Author `OIDC` token spec for cloud-native CI | P1 | orchestrator | Same |
| **T19.5** | Author `SBOM` (CycloneDX) generation spec | P1 | orchestrator | Same |
| **T19.6** | Add `.github/dependabot.yml` template for Cargo workspaces | P1 | orchestrator | PR opened |
| **T19.7** | Add `.github/dependabot.yml` template for Python (Poetry) | P1 | orchestrator | Same |
| **T19.8** | Add `.github/dependabot.yml` template for npm | P1 | orchestrator | Same |
| **T19.9** | Add OIDC workflow template (cargo + npm + pypi) | P1 | orchestrator | Same |
| **T19.10** | Add SBOM generation workflow template | P1 | orchestrator | Same |

**Track T19 PR count: 8** (T19.2-19.5 specs + T19.6-19.8 dependabot + T19.9 OIDC + T19.10 SBOM = 8; T19.1 is audit doc, no PR)

### 3.12 Track T20 — Documentation Refresh (P1, ~120 min parallel, orchestrator + 3 subagents)

llms.txt + SPEC.md + ADR-015 quickstart across 20 substrate repos.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T20.1** | Author canonical `llms.txt` template (200 lines; what/when/when-not/quickstart) | P1 | orchestrator | Template at `templates/llms.txt.template` |
| **T20.2** | Author canonical `SPEC.md` template (1-page max) | P1 | orchestrator | Same |
| **T20.3** | Author canonical `WORKLOG.md` template | P1 | orchestrator | Same |
| **T20.4** | Generate llms.txt for `pheno-config` | P1 | forge-A | File in HEAD |
| **T20.5** | Generate llms.txt for `pheno-context` | P1 | forge-A | Same |
| **T20.6** | Generate llms.txt for `pheno-otel` | P1 | forge-A | Same |
| **T20.7** | Generate llms.txt for `pheno-port-adapter` | P1 | forge-A | Same |
| **T20.8** | Generate llms.txt for `pheno-tracing` | P1 | forge-A | Same |
| **T20.9** | Generate llms.txt for `pheno-flags` | P1 | forge-B | Same |
| **T20.10** | Generate llms.txt for `pheno-errors` | P1 | forge-B | Same |
| **T20.11** | Generate llms.txt for `pheno-cli-base` | P1 | forge-B | Same |
| **T20.12** | Generate llms.txt for `pheno-cargo-template` | P1 | forge-B | Same |
| **T20.13** | Generate llms.txt for `pheno-agents-md` | P1 | forge-B | Same |
| **T20.14** | Generate llms.txt for 5 federated services: `phenoMCP`, `phenoObservability`, `phenoEvents`, `phenoWorkspace`, `phenoRegistry` | P1 | forge-C | 5 files |
| **T20.15** | Generate llms.txt for 3 SDKs: `phenotype-python-sdk`, `phenotype-go-sdk`, `phenotype-ts-utils` | P1 | forge-C | 3 files |
| **T20.16** | Author 1-page concept docs (per ADR-015 quickstart): 5 docs | P1 | forge-C | 5 concept docs |
| **T20.17** | Cross-link all llms.txt files via "see also" section | P1 | orchestrator | All 20 llms.txt have cross-links |
| **T20.18** | Doc-lint script: verify each substrate has llms.txt + SPEC.md + WORKLOG.md | P1 | orchestrator | Script at `scripts/doc-lint.sh` |

**Track T20 PR count: 18** (T20.4-20.15 = 12 repo PRs + T20.1-20.3 = 3 template PRs + T20.16-20.18 = 3 cross-cutting PRs)

### 3.13 Track T21 — Security Audit (P0, ~90 min, orchestrator + 2 subagents)

Secret-scan fleet, SBOM generation, dependency vulnerability scan, SLSA provenance.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T21.1** | Run `gitleaks` across all 100+ fleet repos | P0 | forge-A | 0 secrets detected (or list of false positives) |
| **T21.2** | Run `cargo audit` on all Rust substrate repos | P0 | forge-A | 0 unpatched RUSTSEC advisories |
| **T21.3** | Run `npm audit` on all TS substrate repos | P0 | forge-A | Same |
| **T21.4** | Run `pip-audit` on all Python substrate repos | P0 | forge-B | Same |
| **T21.5** | Generate SBOM (CycloneDX) for each substrate | P0 | forge-B | SBOM files committed |
| **T21.6** | Pin all dependencies to exact versions across substrate | P0 | forge-B | All `Cargo.toml` / `pyproject.toml` / `package.json` use exact versions |
| **T21.7** | Add SLSA provenance generation to release workflow | P0 | orchestrator | `.github/workflows/slsa.yml` template |
| **T21.8** | Rotate any leaked credentials found by T21.1 | P0 | orchestrator | All rotated; old creds revoked |
| **T21.9** | Add `dependabot.yml` security-only updates to all substrate repos | P0 | forge-A | 22 PRs |
| **T21.10** | Author ADR-042: "Security audit cadence (monthly)" | P0 | orchestrator | ADR exists |
| **T21.11** | Monthly security cron workflow | P0 | forge-B | Workflow committed |
| **T21.12** | Open PR in each substrate: security audit fixes | P0 | orchestrator | 22 PRs (one per repo) |

**Track T21 PR count: 8** (T21.5 SBOM = 1, T21.7 SLSA = 1, T21.10 ADR-042 = 1, T21.11 cron = 1, T21.12 fix PRs = 4 batches of 5-6 = 4; T21.9 is bundled into T21.12)

### 3.14 Track T22 — Observability Wiring (P1, ~120 min parallel, orchestrator + 3 subagents)

Adopt `pheno-tracing` + OTLP export across substrate fleet.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T22.1** | Adopt `pheno-tracing` in `pheno-config` | P1 | forge-A | OTLP export configured |
| **T22.2** | Adopt in `pheno-context` | P1 | forge-A | Same |
| **T22.3** | Adopt in `pheno-otel` | P1 | forge-A | Same |
| **T22.4** | Adopt in `pheno-port-adapter` | P1 | forge-A | Same |
| **T22.5** | Adopt in `pheno-tracing` (self-host) | P1 | forge-A | Same |
| **T22.6** | Adopt in `pheno-flags` | P1 | forge-B | Same |
| **T22.7** | Adopt in `pheno-errors` | P1 | forge-B | Same |
| **T22.8** | Adopt in `pheno-cli-base` | P1 | forge-B | Same |
| **T22.9** | Adopt in `pheno-cargo-template` | P1 | forge-B | Same |
| **T22.10** | Adopt in `pheno-agents-md` | P1 | forge-B | Same |
| **T22.11** | Adopt in `phenoMCP` | P1 | forge-C | Same |
| **T22.12** | Adopt in `phenoObservability` | P1 | forge-C | Same |
| **T22.13** | Adopt in `phenoEvents` | P1 | forge-C | Same |
| **T22.14** | Adopt in `phenoWorkspace` | P1 | forge-C | Same |
| **T22.15** | Adopt in `phenoRegistry` | P1 | forge-C | Same |

**Track T22 PR count: 15** (1 per repo)

### 3.15 Track T23 — Registry Refresh (P1, ~60 min, orchestrator)

`phenotype-registry`: rebase stale entries, adopt ADR-013 substrate model.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T23.1** | Audit `phenotype-registry`: list stale entries (last commit > 6 months) | P1 | orchestrator | Doc at `findings/2026-06-18-registry-audit.md` |
| **T23.2** | Cross-reference registry with ADR-013 substrate model | P1 | orchestrator | Mapping doc |
| **T23.3** | Mark stale entries as `deprecated` (don't delete) | P1 | orchestrator | PR opened |
| **T23.4** | Adopt new substrate model schema (`substrate: pheno-* \| phenotype-*-sdk \| phenotype-*-framework \| service`) | P1 | orchestrator | PR opened |
| **T23.5** | Migrate all entries to new schema | P1 | orchestrator | PR opened |
| **T23.6** | Add "owner" + "slack-channel" fields per ADR-013 | P1 | orchestrator | PR opened |
| **T23.7** | Add CI lint: every entry has owner + substrate classification | P1 | orchestrator | CI workflow |
| **T23.8** | Author ADR-043: "Registry refresh cadence (quarterly)" | P1 | orchestrator | ADR exists |

**Track T23 PR count: 6** (T23.3-23.7 + ADR-043 = 6)

### 3.16 Track T16.5 — Stranded Worktree Recovery (P0, ~45 min, orchestrator)

Sweep `/private/tmp/*` and `.worktrees/*` for any remaining unrecovered work.

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T16.5.1** | Sweep `/private/tmp/*` for git worktrees | P0 | orchestrator | `ls -la /private/tmp/*/.git` returns N worktrees |
| **T16.5.2** | Sweep `.worktrees/*` (relative to each substrate repo) | P0 | orchestrator | Same |
| **T16.5.3** | For each stranded worktree: extract unique commits; push as branch to origin | P0 | orchestrator | N branches on origin |
| **T16.5.4** | For each: open recovery PR | P0 | orchestrator | N PRs opened |
| **T16.5.5** | Remove stranded worktree directories after push | P0 | orchestrator | `git worktree list` shows only primary |
| **T16.5.6** | Update AGENTS.md "Stale / warnings" section to reflect 0 stranded worktrees | P0 | orchestrator | Section updated |

**Track T16.5 PR count: 4** (assumes 4 stranded worktrees recovered)

### 3.17 Track T0.5 — Wrap-up (P0, ~15 min, orchestrator)

| Task | Description | P-level | Owner | Acceptance |
|---|---|---|---|---|
| **T0.5.1** | Author `findings/v8-wrapup.md`: task completion matrix, success criteria scorecard, lessons learned | P0 | orchestrator | Doc ≥ 300 lines |
| **T0.5.2** | Push final orchestrator branch to origin | P0 | orchestrator | `git push` exits 0 |
| **T0.5.3** | Update AGENTS.md § "Wave Plan" pointer from v7 to v8 | P0 | orchestrator | `grep -c 'plans/2026-06-18-v8-dag-stable.md' AGENTS.md` ≥ 2 |
| **T0.5.4** | Author v9 deferred backlog doc (next 100-200 tasks for next session) | P0 | orchestrator | Doc at `findings/2026-06-18-v9-deferred.md` |
| **T0.5.5** | Postmortem: 1-page summary of v8 outcome (what worked, what didn't) | P0 | orchestrator | Doc at `findings/2026-06-18-postmortem.md` |

**Track T0.5 PR count: 0** (live doc maintenance)

---

## 4. Topological Sort

### 4.1 Phases (wall-clock order)

```
Phase 0 (t=0, parallel — pre-flight):
  ├─ T0.1, T0.2, T0.3, T0.4, T0.5 (5 checks, ~10 min)

Phase 1 (t=10..25min, parallel — push wrap-up + early ADRs):
  ├─ T9.1, T9.2 (secret resolution)
  ├─ T9.3, T9.5 (governance doc refresh)
  ├─ T14.1-T14.5 (ADR-030..034)
  └─ T11.1, T11.2, T11.3 (worklog decision probes)

Phase 2 (t=25..55min, parallel — Configra absorption + spine ADRs):
  ├─ T10.1, T10.2-T10.7 (Configra absorb imports)
  ├─ T10.8-T10.12 (Configra migration PRs)
  ├─ T14.6-T14.11 (ADR-035..040)
  ├─ T11.4-T11.6 (worklog decision ADRs + READMEs)
  └─ T12.1-T12.4 (monorepo-state cleanup)

Phase 3 (t=55..175min, parallel — fleet sweep):
  ├─ T13.1-T13.10 (re-probe top-10)
  ├─ T13.11-T13.12 (probe 20 more)
  ├─ T15.1-T15.22 (pheno-flake refresh)
  ├─ T17.1-T17.25 (lean code)
  ├─ T18.1-T18.22 (coverage)
  ├─ T19.1-T19.10 (CI templates)
  ├─ T20.1-T20.18 (doc refresh)
  ├─ T21.1-T21.12 (security)
  ├─ T22.1-T22.15 (observability)
  ├─ T23.1-T23.8 (registry)
  └─ T12.5, T12.6 (monorepo-state archival)

Phase 4 (t=175..295min, parallel — substrate audit + aggregation):
  ├─ T16.1-T16.18 (substrate audit + gap closure)
  ├─ T13.13-T13.18 (71-pillar aggregation + delta + cron)
  ├─ T16.5.1-T16.5.6 (stranded worktree sweep)
  └─ T9.4, T9.6 (upstream tracking + governance chore commit)

Phase 5 (t=295..310min, serial — wrap-up):
  ├─ T0.5.1 (v8-wrapup.md)
  ├─ T0.5.2 (push final branch)
  ├─ T0.5.3 (AGENTS.md pointer)
  ├─ T0.5.4 (v9 deferred)
  └─ T0.5.5 (postmortem)
```

### 4.2 Critical Path

```
T0.1 → T0.5 (10 min)
  ↓
T9.1 → T9.2 → T9.6 (15 min, push wrap-up)
  ↓
T10.1 → T10.2 → T10.6 → T10.8 → T10.12 (90 min, Configra)
  ↓
T15.1 → T15.22 (150 min, pheno-flake refresh, longest track)
  ↓
T16.10 → T16.16 → T16.18 (45 min, substrate audit)
  ↓
T0.5.1 → T0.5.5 (15 min, wrap-up)
```

**Critical path length:** ~325 min (~5.4 hours) sequential, but **with 6-way parallelism, wall-clock ~22 hours** for full v8 coverage (vs ~52 hours fully sequential).

### 4.3 Parallelism Matrix

| Time window | Active tracks | Max parallel streams |
|---|---|---|
| t=0..10min | T0 | 5 (T0.1-T0.5) |
| t=10..25min | T9, T14 (partial), T11 (partial) | 6 (T9.1-9.2 + T9.3 + T14.1-14.5 + T11.1-11.3) |
| t=25..55min | T10, T14 (rest), T11 (rest), T12 (partial) | **12** (T10.1-10.12 + T14.6-14.11 + T11.4-11.6 + T12.1-12.4) |
| t=55..175min | T13, T15, T17, T18, T19, T20, T21, T22, T23, T12 (rest) | **~80** (6 subagents × multiple tasks per subagent) |
| t=175..295min | T16, T13 (rest), T16.5, T9 (rest) | **6** |
| t=295..310min | T0.5 | 1 (orchestrator) |

**Maximum parallelism: ~80 streams at t=55..175min** (limited by 6 forge subagents + orchestrator).

---

## 5. PR Matrix

| PR# | Title | Repo | Track | Status |
|---|---|---|---|---|
| PR-169 | feat(configra): absorb pheno-config core | `KooshaPari/Configra` | T10.2 | PENDING |
| PR-170 | feat(configra): absorb phenotype-config core | `KooshaPari/Configra` | T10.3 | PENDING |
| PR-171 | feat(configra): absorb phenotype-config-rs | `KooshaPari/Configra` | T10.4 | PENDING |
| PR-172 | feat(configra): absorb Conft TS edge | `KooshaPari/Configra` | T10.5 | PENDING |
| PR-173 | feat(configra): absorb settly-config | `KooshaPari/Configra` | T10.6 | PENDING |
| PR-174 | feat(configra): absorb settly-config-py | `KooshaPari/Configra` | T10.7 | PENDING |
| PR-175 | refactor(pheno-config): re-export from configra | `KooshaPari/pheno-config` | T10.8 | PENDING |
| PR-176 | refactor(phenotype-config): re-export from configra | `KooshaPari/phenotype-config` | T10.9 | PENDING |
| PR-177 | refactor(phenotype-config-rs): absorb | `KooshaPari/phenotype-config-rs` | T10.10 | PENDING |
| PR-178 | refactor(conft): point at configra | `KooshaPari/Conft` | T10.11 | PENDING |
| PR-179..182 | refactor(settly-*): point at configra (4 PRs) | `KooshaPari/settly-*` | T10.12 | PENDING |
| PR-183 | feat(71-pillar): 2026-06-18 refresh | `KooshaPari/phenotype-org-audits` | T13.18 | PENDING |
| PR-184..204 | chore(pheno-*): meta-bundle (22 PRs, one per repo) | `KooshaPari/pheno-*` | T15 | PENDING |
| PR-205..224 | chore(pheno-*): clippy/ruff/tsc strict (22 PRs) | `KooshaPari/pheno-*` | T17 | PENDING |
| PR-225..243 | test(pheno-*): coverage gate (22 PRs) | `KooshaPari/pheno-*` | T18 | PENDING |
| PR-244..255 | docs(*): llms.txt (12 PRs) | `KooshaPari/*` | T20 | PENDING |
| PR-256..270 | feat(*): adopt pheno-tracing (15 PRs) | `KooshaPari/*` | T22 | PENDING |
| PR-271..274 | fix(*): security audit (4 batched PRs) | `KooshaPari/*` | T21 | PENDING |
| PR-275..282 | chore(ci): HOOKS_SKIP + SKIP + OIDC + SBOM (8 PRs) | `KooshaPari/pheno-ci-templates` | T19 | PENDING |
| PR-283..294 | docs(adr): ADR-030..041 (12 ADRs) | `KooshaPari/repos` (or phenotype-org-audits) | T14 | PENDING |
| PR-295 | docs(adr): ADR-042 security audit cadence | `KooshaPari/repos` | T21.10 | PENDING |
| PR-296 | docs(adr): ADR-043 registry refresh cadence | `KooshaPari/repos` | T23.8 | PENDING |
| PR-297..302 | docs(*): registry refresh (6 PRs) | `KooshaPari/phenotype-registry` | T23 | PENDING |
| PR-303 | chore(governance): refresh AGENTS.md + STATUS.md for v8 launch | `KooshaPari/phenotype-apps` | T9.6 | PENDING |
| PR-304 | chore(worklog-schema): ADR-032 keep separate | `KooshaPari/pheno-worklog-schema` | T11.4 | PENDING |
| PR-305 | docs(agileplus): clarify worklog scope | `KooshaPari/AgilePlus` | T11.6 | PENDING |
| PR-306 | chore(monorepo-state): mark for archival | `KooshaPari/phenotype-monorepo-state` | T12.5 | PENDING |
| PR-307..310 | feat(*): substrate gap-closure (4 PRs) | `KooshaPari/Configra`, `pheno-tracing`, `pheno-mcp-router`, `phenotype-otel` | T16 | PENDING |
| PR-311 | chore(github): weekly 71-pillar cron | `KooshaPari/phenotype-org-audits` | T13.17 | PENDING |
| PR-312 | chore(github): quarterly substrate audit cron | `KooshaPari/phenotype-org-audits` | T16.18 | PENDING |
| PR-313 | chore(github): monthly security cron | `KooshaPari/phenotype-org-audits` | T21.11 | PENDING |
| PR-314 | chore(github): quarterly registry refresh cron | `KooshaPari/phenotype-org-audits` | T23 (next quarter) | PENDING |

**Total: ~200 PRs across 18 tracks.**

---

## 6. Risk Register

| # | Risk | P | I | P×I | Mitigation |
|---|---|---|---|---|---|
| **R1** | Subagent dispatch fails (recurrence of 2026-06-14) | 3 | 3 | **9** | T0 pre-flight gate; fallback to sequential |
| **R2** | Configra absorption introduces regressions in dependent repos | 3 | 3 | **9** | Each migration PR is 1 commit; CI gates; phased rollout (core → edge → adapters) |
| **R3** | Secret scanner block on T9.2 takes longer than 15 min | 2 | 3 | **6** | T9.1 identifies secret first; if upstream rotation is non-trivial, document + defer T9.2 |
| **R4** | 71-pillar probe produces inconsistent scores (v7 R4) | 2 | 3 | **6** | Single probe script + spot-check on L1, L25, L40, L41, L66 |
| **R5** | 22 pheno-* homogenization PRs conflict with each other | 3 | 2 | **6** | Each PR targets 1 repo only; subagents operate on disjoint repos |
| **R6** | Clippy/ruff strict generates too many warnings; hard to fix in 15 min | 3 | 2 | **6** | First pass: lint warnings as `#[allow(...)]` with TODO; second pass in v9 |
| **R7** | Coverage gate fails on legacy code with low coverage | 3 | 2 | **6** | Exclude legacy code with `#[cfg(coverage)]` + `#[cfg_attr(coverage, allow(dead_code))]`; gate applies to NEW code only |
| **R8** | Subagent rotation across 18 tracks causes context loss | 2 | 2 | **4** | Each subagent gets a self-contained prompt template (Appendix C); orchestrator holds global state |
| **R9** | ADR backlog (ADR-030..043) becomes "wave of paper" | 2 | 2 | **4** | Each ADR has evidence pointer + closes a known gap; batch into single PR if user prefers |
| **R10** | Stranded worktree sweep finds nothing or finds many | 2 | 2 | **4** | T16.5.1-T16.5.2 are diagnostic; if 0, T16.5.3-T16.5.5 are no-ops; if many, batch into 1 PR |

**Top 3 risks:**
1. **R1 (subagent dispatch)** — P×I = 9. T0 gate is the mitigation.
2. **R2 (Configra absorption)** — P×I = 9. Critical dependency for many downstream tasks.
3. **R3, R4, R5, R6, R7 (tied at 6)** — multiple medium-risk items.

---

## 7. Success Criteria

v8 is "done" when **all** of the following are true:

| # | Criterion | Measurement | Target |
|---|---|---|---|
| **SC-1** | All ~200 PRs in § 5 are opened and merged | `gh pr list --state all --limit 250 --json number,state` per repo | 200/200 |
| **SC-2** | 71-pillar scorecard is live for 30 repos | `findings/71-pillar-2026-06-18.md` exists with 30 × 71 = 2130 cells | 30/30 repos |
| **SC-3** | Configra is canonical config substrate; all `pheno-config*` / `phenotype-config*` / `Conft` / `settly-*` are deprecated | `KooshaPari/Configra` exists with absorbed code; deprecation notes in 8 source repos | 8/8 migrated |
| **SC-4** | 22 pheno-* repos have full meta-bundle (AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT) | `find pheno-*/AGENTS.md | wc -l` = 22; same for other 4 files | 22/22 |
| **SC-5** | Clippy strict + ruff strict + tsc strict + golangci-lint strict pass on all substrate | CI green on each repo | 22/22 |
| **SC-6** | Coverage gates met per substrate tier | tarpaulin/pytest/coverage reports per repo | 22/22 |
| **SC-7** | `pheno-tracing` adopted in 15 key repos; OTLP export verified | OTLP collector receives spans | 15/15 |
| **SC-8** | Security audit clean (0 secrets, 0 RUSTSEC advisories, 0 npm advisories) | gitleaks + cargo audit + npm audit | 0/0/0 |
| **SC-9** | All 11 new ADRs (ADR-030..043) in `docs/adr/2026-06-18/INDEX.md` | `ls docs/adr/2026-06-18/ | wc -l` ≥ 14 (11 ADRs + INDEX + 2 misc) | 11/11 |
| **SC-10** | `phenotype-registry` adopts new substrate schema | PR merged | 1/1 |
| **SC-11** | `phenotype-monorepo-state` archived | `gh api ... | jq .archived` → true | archived |
| **SC-12** | 0 stranded worktrees | `git worktree list` shows 1 (primary) | 1/1 |
| **SC-13** | All cron workflows in place: weekly 71-pillar, quarterly substrate, monthly security, quarterly registry | 4 cron workflows | 4/4 |
| **SC-14** | Wall-clock: ~22 hours with 6-way parallelism | Time elapsed | ≤ 22h |
| **SC-15** | No force-pushes; no orphan PRs | gh pr list shows expected | clean |

**Aggregate done-criterion:** SC-1 (all PRs landed) AND SC-2 (71-pillar live for 30 repos) AND SC-3 (Configra canonical) AND SC-4 (22 pheno-* meta-bundle) AND SC-11 (monorepo-state archived). The other 10 criteria are quality bars.

---

## 8. Cross-References

### 8.1 AGENTS.md (parent governance)
- § "Wave Plan (v7 — current, supersedes v6)" — superseded by v8
- § "Active ADRs" — adds ADR-030..043 (T14, T21, T23)
- § "App-level repo triage & app substrate placement (ADR-023)" — T10, T15, T22 substrate placement authority
- § "Scope decisions (this turn, 2026-06-17 21:55)" — Decisions A/B/C/D → T10/T11/T12
- § "Factory AI Agent Readiness" — T13 weekly refresh cadence

### 8.2 The 11 new ADRs (T14)
- **ADR-030** (T14.1) — Spine repos read-only
- **ADR-031** (T14.2 / T10.1) — Configra canonical config
- **ADR-032** (T14.3 / T11.4) — Worklog format split
- **ADR-033** (T14.4 / T13.16) — 71-pillar refresh cadence
- **ADR-034** (T14.5) — Substrate quality bar (Rule 3.1 codified)
- **ADR-035** (T14.6) — Pheno-flake naming convention
- **ADR-036** (T14.7) — Worklog deprecation cycle (6-month sunset)
- **ADR-037** (T14.8) — Federated service SLAs
- **ADR-038** (T14.9) — Dmouse92 archival policy (90-day)
- **ADR-039** (T14.10) — Pre-flight gate mandatory
- **ADR-040** (T14.11) — Track sizing convention (≤ 25 tasks per track, ~15 min each)
- **ADR-041** (T16.17) — Substrate audit cadence (quarterly)
- **ADR-042** (T21.10) — Security audit cadence (monthly)
- **ADR-043** (T23.8) — Registry refresh cadence (quarterly)

### 8.3 Prior ADRs referenced
- **ADR-012** — config substrate (origin)
- **ADR-013** — mcp-router substrate (origin)
- **ADR-014** — Hexagonal L4 ports (origin)
- **ADR-015** — Worklog v2.0 (superseded by ADR-025, due 2026-06-22)
- **ADR-022** — Config consolidation (split into ADR-031)
- **ADR-023** — Agent-effort governance (T9-T23 substrate placement authority)
- **ADR-024** — 71-pillar framework (T13 refresh)
- **ADR-025** — Worklog v2.1 schema
- **ADR-026** — Factory AI Agent Readiness
- **ADR-027** — Git LFS 3-tier policy
- **ADR-028** — Monorepo hybrid-with-staging-repo
- **ADR-029** — Dmouse92 → KooshaPari migration

### 8.4 Other referenced files
- `findings/71-pillar-2026-06-17.md` — baseline scorecard (v7)
- `findings/71-pillar-2026-06-17-schema.md` — schema (T3.1)
- `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 → L1-L71 crosswalk
- `L6_PHENO_REPOS_HEALTH_2026_06_14.md` + `_2026_06_15_DELTA.md` — pheno-* health
- `audit-71-pillar-2026-06-17-wrapup.md` — 71-pillar wrap-up
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` — Dmouse92 migration audit
- `findings/SESSION_STATUS_2026_06_15_0105.md` — last session status (pre-W5)
- `STATUS.md` — current state (refreshed in T9.5)
- `SSOT.md` — SSOT (refreshed in T9.x for `KooshaPari/phenotype-apps` origin)
- `templates/llms.txt.template` — T20.1

### 8.5 Conventions
- **Branch naming:** `chore/<req-id>-<slug>-<date>` for chore; `feat/<req-id>-<slug>-<date>` for features
- **Commit messages:** Conventional Commits
- **PR labels:** `governance` for cleanup, `L<n>-#<n>` for tracking
- **SOTA artifacts:** `findings/`, `plans/`, `worklogs/`, `docs/adr/<date>/`
- **Meta-bundle:** `AGENTS.md` + `llms.txt` + `WORKLOG.md` + `CHANGELOG.md` + `LICENSE-MIT`
- **Track sizing (new in v8):** ~15 min wall per task; ≤ 25 tasks per track (per ADR-040)

---

## Appendix A — Why v8 supersedes v7

| Plan | Source | Status | Why v8 wins |
|---|---|---|---|
| v6 | `plans/2026-06-15-v6-dag-stable.md` (5 tracks, 21 PRs) | Closed 2026-06-17 | Orchestrator-only; no parallelism |
| **v7** | `plans/2026-06-17-v7-dag-stable.md` (8 tracks, ~40 PRs) | Spec ready; launched | 4-way parallelism; Dmouse92 migration; 71-pillar framework |
| **v8 (this)** | this file (18 tracks, ~210 tasks, ~200 PRs) | SPEC READY (this turn) | 6-way parallelism; Configra absorption; monorepo-state cleanup; full fleet sweep; ~22h wall-clock |

**v8 vs v7 deltas:**
- **+10 tracks** (T9-T23 + T16.5 + T0.5)
- **+170 tasks** (T9-T23)
- **+160 PRs**
- **+6 subagent parallelism** (vs v7's 4)
- **+20h wall-clock** (22h vs 2h) — but covers ~5× the scope

---

## Appendix B — Pre-launch checklist (Track T0)

```bash
# T0.1
gh auth status 2>&1 | grep -q 'Logged in to github.com account KooshaPari'

# T0.2
forge -p "echo ok" -C /tmp

# T0.3
curl -sf -m 3 http://localhost:20128/v1/models | jq '.data | length'

# T0.4
git status --short | wc -l  # should be ≤ 5

# T0.5
git stash list | wc -l       # = 0
git branch | grep -c gate1-   # = 0
```

If any check fails, the launch log records the failure and the corresponding track is held.

---

## Appendix C — Subagent dispatch templates

### C.1 — Configra absorption (T10.x)
```
You are absorbing a config-like repo into KooshaPari/Configra.

Scope:
1. cd to <source-repo>
2. Inspect Cargo.toml / pyproject.toml / package.json
3. Identify canonical Rust config code (in src/ or lib/)
4. Fork KooshaPari/Configra; clone
5. Copy canonical code to Configra/src/<module>/
6. Update Configra/Cargo.toml to include new module
7. Add tests covering the absorbed code
8. Run `cargo build -p configra` and `cargo test -p configra`
9. Push branch to KooshaPari/Configra:<branch>
10. Open PR with title "feat(configra): absorb <source-repo>"

DO NOT:
- Modify absorbed code semantically (pure code move)
- Touch Configra's existing modules
- Force-push
```

### C.2 — Pheno-flake refresh (T15.x)
```
You are refreshing the meta-bundle + tests + CI for <repo>.

Scope:
1. cd to <repo>
2. Verify AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT exist
3. If any missing, add from templates/llms.txt.template + spec templates
4. Add tests if < 5 test files; target ≥ 80% coverage
5. Add CI workflow if missing: .github/workflows/ci.yml using pheno-ci-templates
6. Update AGENTS.md § "Active ADRs" pointer
7. Push branch and open PR

DO NOT:
- Modify source code
- Touch other repos
```

### C.3 — 71-pillar probe (T13.x)
```
You are probing <repo> against the 71-pillar framework.

Scope:
1. cd to <repo>
2. Run: python scripts/71-pillar-probe.py --repo <repo> --output /tmp/probe-<repo>.json
3. For pillars returning 0 (absent), spot-check by reading relevant files
4. Submit your final scores as JSON to orchestrator

DO NOT:
- Modify the probe script
- Touch any other repo
```

### C.4 — Lean code quality (T17.x)
```
You are running lint sweep on <repo>.

Scope:
1. cd to <repo>
2. Run: <lint-cmd> (e.g. cargo clippy --strict, ruff check ., tsc --noEmit, golangci-lint run)
3. Fix warnings in 1 PR (use #[allow(...)] for warnings that are too disruptive to fix)
4. Verify CI green
5. Push branch and open PR

DO NOT:
- Skip warnings with #[allow(...)] unless explicitly justified
- Touch other repos
```

### C.5 — Coverage pass (T18.x)
```
You are bringing coverage to the gate (<tier-threshold>) for <repo>.

Scope:
1. cd to <repo>
2. Run: <coverage-cmd> (e.g. cargo tarpaulin, pytest --cov, jest --coverage)
3. Identify low-coverage modules
4. Add tests to bring coverage to gate
5. Verify CI gate passes
6. Push branch and open PR

DO NOT:
- Exclude legitimate test targets
- Touch other repos
```

### C.6 — Observability wiring (T22.x)
```
You are adopting pheno-tracing in <repo>.

Scope:
1. cd to <repo>
2. Add pheno-tracing to Cargo.toml / pyproject.toml / package.json
3. Initialize tracing in main.rs / __main__.py / index.ts
4. Configure OTLP export endpoint (env var: OTEL_EXPORTER_OTLP_ENDPOINT)
5. Add 1 integration test verifying span emission
6. Push branch and open PR

DO NOT:
- Modify existing tracing code
- Touch other repos
```

---

## Appendix D — Per-track subagent allocation

| Subagent | Tracks | Task count | Repos touched |
|---|---|---|---|
| **forge-A** | T10.2-10.4, T13.1-13.4, T15.1-15.5, T17.1-17.5, T21.1-21.3, T22.1-22.5 | ~30 | pheno-config, pheno-context, pheno-otel, pheno-port-adapter, pheno-tracing, pheno-go-ctxkit |
| **forge-B** | T10.5-10.7, T13.5-13.10, T15.6-15.10, T17.6-17.10, T21.4-21.6, T22.6-22.10 | ~30 | pheno-flags, pheno-errors, pheno-cli-base, pheno-cargo-template, pheno-agents-md |
| **forge-C** | T13.11-13.12, T15.11-15.15, T17.11-17.15, T21.5, T22.11-22.15 | ~30 | 10+ Python+TS repos |
| **forge-D** | T15.16-15.20, T17.16-17.20, T21.9, T22 (none) | ~20 | remaining pheno-* repos |
| **forge-E** | T16.5-16.7, T16.11-16.14, T16.18 | ~10 | Configra, pheno-tracing, federated services |
| **forge-F** | T16.8-16.9, T16.12, T16.13 | ~5 | pheno-mcp-router, phenotype-otel |
| **orchestrator** | T0, T9, T10.1, T11, T12, T13.13-13.18, T14, T16.1-16.4, T16.10, T16.15-16.17, T18.21-18.22, T19, T20.1-20.3 + 20.17-20.18, T21.7-21.8 + 21.10-21.12, T23, T16.5, T0.5 | ~85 | cross-cutting + decisions |

---

## Appendix E — v8 launch log template

```
[v8 LAUNCH] 2026-06-18T<HH:MM> PDT
- T0.1: gh auth status: KooshaPari active (rc=0)
- T0.2: forge -p "echo ok" -C /tmp: rc=0 (T+0:00:30)
- T0.3: OmniRoute liveness: 4+ models UP
- T0.4: working tree: N dirty (submodule pointers expected)
- T0.5: stash list: 0; gate1 branches: 0

[Phase 1] t=0..25min
- T9.1: secret identified in phenotype-python-sdk@7499fd2
- T9.2: rotated; branch pushed (rc=0)
- T9.3: AGENTS.md refreshed
- T14.1-14.5: ADR-030..034 drafted (5 ADRs)
- T11.1-11.3: worklog decision probes run

[Phase 2] t=25..55min
- T10.1: ADR-031 Configra canonical
- T10.2-10.7: 6 absorb-import PRs opened in Configra
- T10.8-10.12: 8 migration PRs opened in source repos
- T14.6-14.11: ADR-035..040 drafted
- T11.4-11.6: ADR-032 + READMEs updated
- T12.1-12.4: monorepo-state content migrated to local

[Phase 3] t=55..175min
- T13.1-13.12: 30 repos probed
- T15.1-15.22: 22 pheno-* repos refreshed
- T17.1-17.25: 25 lint sweep PRs
- T18.1-18.22: 22 coverage PRs + CI gate
- T19.1-19.10: 8 CI template PRs
- T20.1-20.18: 18 doc refresh PRs
- T21.1-21.12: 8 security audit PRs
- T22.1-22.15: 15 observability PRs
- T23.1-23.8: 6 registry refresh PRs
- T12.5-12.6: monorepo-state archived

[Phase 4] t=175..295min
- T16.1-16.18: substrate audit + gap closure
- T13.13-13.18: 71-pillar aggregation + cron
- T16.5.1-16.5.6: stranded worktree sweep (N recovered)
- T9.4-9.6: upstream tracking + governance chore commit

[Phase 5] t=295..310min
- T0.5.1: v8-wrapup.md authored
- T0.5.2: final branch pushed
- T0.5.3: AGENTS.md pointer updated
- T0.5.4: v9 deferred backlog doc
- T0.5.5: postmortem

[v8 DONE] 2026-06-19T<HH:MM> PDT
- PRs merged: <n>/200
- 71-pillar live: <n>/30 repos
- Configra canonical: <true/false>
- Monorepo-state archived: <true/false>
- Stranded worktrees: <n>
- Wall clock: <X>h<Y>m
- Success criteria met: <n>/15
```

---

## Appendix F — v9 deferred backlog (informational, not in v8 scope)

Items deferred to v9 (post-v8 closure):

| Item | Source | Defer rationale |
|---|---|---|
| F1 | Factory AI `/readiness-report` per repo | T13 weekly refresh does 71-pillar; Factory AI is separate |
| F2 | Federated service SLA implementation (ADR-037 spec) | Spec in v8; impl in v9 |
| F3 | Worklog deprecation cycle tooling (ADR-036 spec) | Spec in v8; tooling in v9 |
| F4 | Spine repo archival (Decision D) | T23 sets cadence; archival in v9 |
| F5 | 30 more repos to 71-pillar (T13 only covers 30; total fleet ~100) | Continuous |
| F6 | 71-pillar L1-L100 extension (currently L1-L71) | If gaps found in v8 audit |
| F7 | Pheno-flake v2 schema (deps + API stability) | After v8 meta-bundle lands |
| F8 | Cross-substrate contract tests (T16.15 only does 1; need 10+) | After gap closure lands |
| F9 | Heterogeneous substrate adoption (e.g. nim, zig substrates) | Out of scope; needs ADR |
| F10 | Public API stability guarantees (semver, deprecation policy per crate) | Per-crate work; T17 enables |

v9 scope estimate: ~150-200 tasks; ~12-15h wall-clock with 6-way parallelism.

---

**END OF v8 DAG**

**Status:** SPEC READY 2026-06-18
**Next step:** orchestrator launches v8 (T0 pre-flight gate, then Phase 1)
**Owner:** forge orchestrator + 6 parallel forge subagents (forge-A through forge-F)
**Supersedes:** v7 (`plans/2026-06-17-v7-dag-stable.md`)
