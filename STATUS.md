# STATUS.md — Phenotype monorepo

**Date:** 2026-06-15 01:25 PDT
**Branch in use:** `chore/w1-2-archive-cheap-llm-mcp-2026-06-15` (was `chore/l5-87-focus-repo-specs-2026-06-11` at session start; subagent switched mid-session)
**HEAD:** `90fc2c52c4` "feat(pheno-cli-base): scaffold shared CLI patterns"
**Working tree:** clean (170 submodule pointer drifts pre-existing; melosviz is `-dirty` per `git diff melosviz`)

This file supersedes the 2026-06-08 thin index that lived here 2026-06-08 → 2026-06-15.

---

## Real-time state

| Metric | Value | Source |
|---|---|---|
| **Real divergence from main** | +0 / −2 | `git rev-list --left-right --count main...HEAD` |
| **Working tree (line-level changes)** | 0 | `git status --short \| grep -v '^ ?'` |
| **Submodule pointer drifts** | 170+ | `git status --short` |
| **pheno-* crates (visible)** | 22 | `ls -d pheno-*/` |
| **pheno-* crates (added since 2026-06-14)** | 4 | +pheno-cli-base, +pheno-fastapi-base, +pheno-flags, +pheno-otel |
| **Buildable pheno-* crates** | 21 | (excludes pheno-wtrees container, pheno-zod-schemas TS) |
| **L6 test pass/fail** | 136 / 4 | `L6_PHENO_REPOS_HEALTH_2026_06_14.md` |
| **Last L6 full audit** | 2026-06-14 (2 days stale) | File mtime |
| **Last L6 delta** | 2026-06-15 01:25 | `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` |

---

## Sub-projects (current layout)

### Active focus repos (5)
`AgilePlus`, `PhenoCompose`, `PlayCua`, `BytePort`, `nanovms` — coordinated via `chore/l5-87-focus-repo-specs-2026-06-11` branch. Each now has a SPEC.md per L5-#87 worklog.

### Apps & shells
`apps/`, `phenotype-unity/`, `phenotype-voxel/`, `phenotype-landing/`, `phenotype-journeys/`

### Shared libraries (pheno-* family)
22 directories under `pheno-*/` (see `AGENTS.md` for the full breakdown). 21 buildable crates (Rust+Python+Go), 1 worktree container, 1 TypeScript out-of-scope.

### Shared libraries (phenotype-* and others)
`crates/`, `libs/`, `phenoShared/`, `phenoData/`, `phenoUtils/`, `phenoContracts/`, `phenoSchema/`, `phenoKits/`, `phenodocs/`, `phenotype-auth-ts/`, `phenotype-bus/`, `phenotype-dep-guard/`, `phenotype-e2e-base/`, `phenotype-errors/`, `phenotype-go-sdk/`, `phenotype-hub/`, `phenotype-infra/`, `phenotype-journeys/`, `phenotype-landing/`, `phenotype-omlx/`, `phenotype-otel/`, `phenotype-postfx/`, `phenotype-py-extras/`, `phenotype-py-utils/`, `phenotype-python-sdk/`, `phenotype-registry/`, `phenotype-request-id/`, `phenotype-teamcomm/`, `phenotype-terrain/`, `phenotype-tooling/`, `phenotype-ts-utils/`, `phenotype-water/`, `phenotype-zod-schemas/`

### Services
`services/`, `phenoMCP/`, `phenoAgents/`, `phenoVCS/`, `phenoObservability/`, `phenoEvents/`, `phenoRuntime/`, `phenoProc/`, `phenoDesign/`, `phenoCompose/`, `phenotype-bus/`, `phenotype-registry/`, `phenotype-otel/`

### Tooling
`tooling/`, `thegent/`, `dispatch-mcp/`, `cheap-llm-mcp/`, `phenotype-ops-mcp/`, `phenotype-tooling/`, `phenotype-infrakit/`, `phenotype-org-audits/`

### Active worktrees
`*-wtrees/` directories (per-feature branches) — 7+ feature branches checked out, 6 stash-backup branches also checked out

---

## Active ADRs (11 total)

**2026-06-14 wave (6 ADRs at `docs/adr/2026-06-14/`):**

| ADR | Repo | Disposition |
|---|---|---|
| ADR-001 | NetScript | **DELETE** |
| ADR-002 | KlipDot | KEEP-archived |
| ADR-003 | McpKit | MERGE into `PhenoMCP` |
| ADR-004 | Metron | KEEP |
| ADR-005 | KodeVibe | KEEP |
| ADR-006 | cheap-llm-mcp | archive verified |

**2026-06-15 wave (5 ADRs at `docs/adr/2026-06-15/`, added by parallel subagent):**

| ADR | Subject | Notes |
|---|---|---|
| ADR-007 | cheap-llm-mcp deprecation | Triggers W1-2 archive work |
| ADR-008 | dispatch-mcp as sole MCP server | consolidation decision |
| ADR-009..011 | (DAG-V5 reconciliation) | added 2026-06-15 by subagent |

---

## Wave state

### Completed waves

- **V3 (2026-06-10):** 100+20 task DAG, 180/180 marked done per `FLEET_DAG_v3.md:1-30`. Session credit ceiling deferred L3/L4/L5 lanes.
- **V4 (2026-06-14):** Narrative only. Never executed. Superseded by v6.
- **W1 (2026-06-14):** 9/11 repos pushed via SSH `push_key` per `plans/2026-06-14-push-session.md:5-15`. Metron blocked (archived on GitHub). helios-router PR pending in web UI.
- **2026-06-14 RESUME (20 tracks):** 1/24 outputs confirmed on disk (filesystem-unstable). Subagent dispatch via `task` tool failed 40/40. **Subagent dispatch via `forge -p` CLI was later verified working** (Tracera L5 integration agent, PID 6612, ran 12:59→01:18 PDT to completion). **Task tool itself re-verified working 2026-06-15 01:25 PDT** via a 1-line echo test.

### In-flight / planned

- **V6 (2026-06-15):** 5 tracks, 21 PRs, ~7h sequential / ~2h parallel via `forge` CLI. Spec at `plans/2026-06-15-v6-dag-stable.md`. **SPEC READY, NOT YET LAUNCHED.**
- **CI/GitOps/DevOps Unification Ultraplan (2026-06-14):** 12-week phased rollout (Phase 0–5) per `plans/2026-06-14-ci-gitops-devops-unification-ultraplan.md`. **NOT YET LAUNCHED.**

### Stalled / blocked

- **AtomsBot decomposition** — blocked on NetScript/McpKit/KodeVibe decisions (now resolved by 6 ADRs; can resume)
- **Wave 2 hygiene merge** — 4 YELLOW repos (Metron, Tokn, argis, McpKit) per `plans/2026-06-14-wave-1-completion-report.md:88-129`
- **Metron unarchive** — needs `admin:org` scope; `gh` is Dmouse92 (no org admin). Web UI action needed (5 sec).
- **helios-router PR** — branch on remote, web UI PR needed (Dmouse92 `gh` can't see private repos)

---

## Recent commits (last 14 days, descending)

```
90fc2c52c4 feat(pheno-cli-base): scaffold shared CLI patterns  ← Tracera subagent, 2026-06-15 01:19
cb76c143b5 chore(l5-87): v6 DAG spec + session status + .build gitignore  ← THIS SESSION, 2026-06-15 01:19
c144f58c59 fix: clean up pheno-tracing warnings and add Default impl
401ea1be4c fix: resolve blake3 Hash method ambiguity in phenotype-crypto
238999714f fix: resolve unimplemented tests and dependency path issues
b13c6b6561 build(deps): bump the npm_and_yarn group across 1 directory (#128)
de422a6383 feat(l3-60-pheno-secret-scan-2026-06-11): chore/l3-60-pheno-secret-scan-2026-06-11 (#126)
e8f65346fa feat(l3-58-pheno-ci-templates-2026-06-11): chore/l3-58-pheno-ci-templates-2026-06-11 (#125)
e8118ea313 feat(l3-56-pheno-feature-flags-2026-06-11): chore/l3-56-pheno-feature-flags-2026-06-11 (#124)
a40407d9a6 feat(l3-55-pheno-ssot-template-2026-06-11): chore/l3-55-pheno-ssot-template-2026-06-11 (#123)
```

---

## Open threads (priority order)

1. **Launch v6** — Tracks 1-4 in parallel via `forge` CLI (2h wall time, 21 PRs)
2. **Re-run L6 health audit** with this session's findings appended (4 new crates: pheno-cli-base, pheno-fastapi-base, pheno-flags, pheno-otel)
3. **Metron unarchive** (web UI, 5 sec) — unblocks the last W1 push
4. **helios-router PR** (web UI) — last W1 push cleanup
5. **Push `90fc2c52c4` (and ancestors) to remote** — needs SSH `push_key` (Dmouse92 `gh` lacks `admin:org`)
6. **Branch is 0/2 vs main** — minor; the 2 commits behind main are likely upstream drift that we'd want anyway
7. **Submodule pointer drifts (170+)** — non-urgent; commit in batches or in next L5 hygiene wave
8. **melosviz is dirty (3 uncommitted files)** — needs to be committed inside the submodule first, then the parent pointer can be updated
9. **`AGENTS.md` and `STATUS.md` (this file)** — **NOW UPDATED 2026-06-15 01:25 PDT**; previously stale (AGENTS.md was FocalPoint template; STATUS.md was 2026-06-08 thin index)

---

## Infrastructure

- **GitHub auth:** `gh` is Dmouse92 (scopes: gist, read:org, repo, workflow). SSH `~/.ssh/push_key` is the working path for pushes; web UI is needed for admin actions (unarchive, PR creation in private repos).
- **Subagent dispatch:** `task` tool (had JSON deserialization issues in 2026-06-14 wave; **re-verified working 2026-06-15 01:25 PDT**). `forge -p "..."` CLI (verified working 2026-06-15 01:18 PDT with Tracera L5 integration). `OmniRoute` is UP at `http://localhost:20128/v1/models`.
- **Sparse-checkout:** cone mode active, pattern includes `/*` + `!/*/` + re-inclusions for `pheno-*`, `plans/`, `worklogs/`, `docs/adr/2026-06-14/*`, plus 6 specific sub-paths. `findings/` and `crates/` are NOT in the cone by default.
