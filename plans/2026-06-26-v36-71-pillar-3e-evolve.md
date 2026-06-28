# v36 Sprint Plan — Cycle-26 3e-Evolve (Fleet Saturation)

**Date:** 2026-06-26 | **Duration:** 3 days (2026-06-26 → 2026-06-29)
**Scale:** 100 concurrent agents, 600-5k commits/day, 47 fleet repos
**Target:** Fleet mean **3.58 → 3.72** (+0.14); all 7 evolve workflows live in all 47 repos
**Branch:** `chore/v36-71-pillar-3e-evolve-2026-06-26`

---

## Phase 1: Workflow Generation (Day 1, 7 parallel tracks)

7 evolve workflow patterns × 47 fleet repos = 329 workflow files.
Each agent session generates 5-7 repos' worth of workflows (600-800 LOC per pattern).

### T1 — Fuzz weekly (fuzz-weekly.yml)
| Agent | Repos | Files | LOC |
|-------|-------|-------|-----|
| T1-A | pheno-{config,context,otel,port-adapter,tracing,errors} | 6 | 180 |
| T1-B | phenotype-{sdk,infra,apps,landing,ops} | 5 | 150 |
| T1-C | pheno-{mcp-router,scaffold-kit,predict,framework-lint,drift-detector} | 5 | 150 |
| T1-D | pheno-{worklog-schema,vibecoding-guard,flamegraph,secret-scan,flakes} | 5 | 150 |
| T1-E | pheno-{cli-base,flags,go-ctxkit,pydantic-models,fastapi-base} | 5 | 150 |
| T1-F | OmniRoute, KaskMan, KlipDot, ObservabilityKit, ResilienceKit | 5 | 150 |
| T1-G | Tasken, TestingKit, PhenoCompose, PhenoContracts, PhenoRuntime | 5 | 150 |
| T1-H | Argis-ext, FocalPoint, Conft, HwLedger, PhenoAgent | 5 | 150 |
| T1-I | McpKit(archived), sidekick(archived), cheap-llm-mcp(archived) — skip | 3 | 0 |
| T1-J | Tracera, Chatta, Quillr, Pine, Parpoura | 5 | 150 |
| T1-K | PhenoMCPServers, PhenoPlugins, Mobile-Cli, Mobile-MCP | 4 | 120 |

**Total: 47 repos, 47 files, ~1,410 LOC**

### T2 — Perf gate weekly (perf-weekly.yml)
Same agent splitting as T1. Each perf-weekly.yml runs `tools/perf-regression-suite/run.py` on weekly schedule with p99 budget thresholds.

### T3 — SBOM weekly (sbom-weekly.yml)
Runs `tools/sbom-drift-ci-v2/check.py` weekly + SBOM OCI publish for library repos. Writes to `docs/security/sbom.cdx.json` if drift detected.

### T4 — mTLS weekly (mtls-weekly.yml)
Runs `tools/mtls-fleet-v2/apply.py` weekly to rotate + verify internal mTLS certs.

### T5 — LFS weekly (lfs-weekly.yml)
Runs `tools/lfs-audit-v2/audit.py` weekly. Reports LFS file count, storage, and pin status.

### T6 — Contract weekly (contract-weekly.yml)
Runs `tools/openapi-contract/validate.py` + PACT verification on weekly cadence.

### T7 — Chaos weekly (chaos-weekly.yml)
Runs `tests/chaos-*/` on weekly schedule. Reports pass/fail per chaos scenario.

---

## Phase 2: CI Gate + Validation (Day 2, 3 parallel tracks)

### T8 — evolve-checks.yml (metaworkflow)
Single CI gate that validates all 7 evolve workflows exist in the repo. Fails CI if any evolve file missing.
- `findings/2026-06-28-v36-evolve-checks.md` — gap analysis across 47 repos

### T9 — Stale PR cleanup (16 open PRs)
| Priority | PRs | Action |
|----------|-----|--------|
| P0 | #150, #149, #148 — v28/v27 stragglers | Review & merge or close |
| P1 | #145, #144, #143, #142 — v25 stragglers | Close resolved, merge ready |
| P2 | #139, #138, #137, #133 — v23/v24 stragglers | Close stale, rebase ready |
| P3 | #136, #135, #134, #132, #131, #130, #129, #128, #127 — v16 stragglers | Close as superseded |

Each stale PR review is ~200 LOC. 16 PRs total.

### T10 — Reproducible-build CI integration
`tools/reproducible-build/audit.py` → `tools/reproducible-build/repro.sh` → weekly CI job.
Verify deterministic builds across all 47 repos.

---

## Phase 3: Closure + Post-3e planning (Day 3, 2 parallel tracks)

### T11 — Closure artifacts
| Artifact | Contents |
|----------|----------|
| `findings/2026-06-28-v36-closure.md` | 7 workflow patterns × 47 repos = 329 files landed |
| `findings/2026-06-28-71-pillar-cycle-26-probe.md` | Fleet mean, remaining gaps |
| `docs/adr/2026-06-28/ADR-113-71-pillar-3e-closure.md` | 26 cycles, 5 commits/cycle × 47 repos × 3 phases = 18,330 commits, 6,350 files, ~200K LOC cumulative |

### T12 — Post-3e evolution plan
The 71-pillar cycles are structurally complete. Write the v37 plan for what comes after:
- Option A: **Cross-fleet reliability** (SLO dashboard, error budgets, chaos maturity)
- Option B: **Cross-fleet cost** (finops, per-repo cloud spend, per-CI-minute billing)
- Option C: **Organic maintain-only** (no new cycles; trust the 3e framework)
- Option D: **New pillar expansion** (extend 71-pillar model to 100+ for deeper observability)

---

## Fleet Coverage Summary (47 repos)

| Repo | T1 Fuzz | T2 Perf | T3 SBOM | T4 mTLS | T5 LFS | T6 Contract | T7 Chaos |
|------|---------|---------|---------|---------|--------|-------------|----------|
| pheno-config | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-context | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-otel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-port-adapter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-tracing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-errors | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-mcp-router | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-scaffold-kit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-predict | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-framework-lint | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-drift-detector | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-worklog-schema | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-vibecoding-guard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-flamegraph | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-secret-scan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-flakes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-cli-base | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-flags | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-go-ctxkit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-pydantic-models | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pheno-fastapi-base | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phenotype-sdk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phenotype-infra | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phenotype-apps | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phenotype-landing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phenotype-ops | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OmniRoute | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| KaskMan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| KlipDot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ObservabilityKit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ResilienceKit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tasken | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TestingKit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PhenoCompose | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PhenoContracts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PhenoRuntime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Argis-ext | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FocalPoint | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Conft | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HwLedger | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PhenoAgent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tracera | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chatta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quillr | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parpoura | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PhenoMCPServers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Archived repos (McpKit, Sidekick, cheap-llm-mcp) skipped per ADR-017/029 policy.*

---

## Dependencies

- **Cross-fleet only** — agents do NOT need to merge into each repo's main branch.
  Patterns are opened as PRs, reviewed by 1 approving agent, merged per repo.
- **T8 requires T1-T7 completion** (evolve-checks.yml validates the other 7 exist)
- **T9 independent of T1-T8** (stale PRs are pre-existing, not blocked)
- **T11 requires T1-T8 completion**
- **T12 independent** (planning only, no code)

## Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 7 workflow files × 47 repos = 329 PRs flood CI | Medium | High | Stage in batches of 10 repos (5 CI waves) |
| Stale PRs have conflicts after 5-30 days | High | Medium | Close stale with "superseded by v36", don't rebase |
| Workflow name collisions across repos | Low | Low | Use repo-specific job IDs (`{repo}-fuzz-weekly`) |
| Agent-session context overflows (47 repos × 7 patterns ≈ 3,000 LOC per session) | Medium | Low | Split into 11 sub-agents × 4-6 repos each |

## Exit Criteria

- 47 `/fuzz-weekly.yml` files exist and parse as valid GH Actions
- 47 `/perf-weekly.yml` files exist
- 47 `/sbom-weekly.yml` files exist
- 47 `/mtls-weekly.yml` files exist
- 47 `/lfs-weekly.yml` files exist
- 47 `/contract-weekly.yml` files exist
- 47 `/chaos-weekly.yml` files exist
- `evolve-checks.yml` passes on all 47 repos
- 16 stale PRs triaged (merged or closed)
- v36 closure + post-3e evolution plan published

**Fleet mean exit target: 3.72** — the 3e framework self-sustaining. Cycles 1-26 cumulative lift: +119% from 1.70 baseline.

Refs: v35 closure, cycle-25 probe, ADR-095 pheno-context canonical, 3e framework (Enforce → Embed → Evolve)
