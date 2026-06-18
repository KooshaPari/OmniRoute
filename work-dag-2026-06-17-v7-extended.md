# Phenotype v7+ Work DAG (2026-06-17, extended)
**Status:** Extends `work-dag-2026-06-17-wrapup.md` with the post-wrap-up engineering backlog
**Scope:** 5 tracks — A (WIP landing), B (strand recovery), C (⚠ pillar unblock), D (△ pillar backfill), E (foundation re-eval)
**Source:** `audit-71-pillar-2026-06-17-wrapup.md` + `work-dag-2026-06-17-wrapup.md`

---

## Pillar Health Snapshot (2026-06-17)

```
✓ healthy:   50/71 (70.4%)   ← L0-L29 (Tech, 30) + L31, L33-L34, L40-L42 (UX, 5) + L44, L46, L48-L50, L52-L53, L55 (AX, 6) + L58, L60-L62, L67, L69, L71 (DX, 7) + a few tech
△ partial:   20/71 (28.2%)   ← L30, L32, L35-L39 (UX, 6) + L43, L45, L47, L51, L54 (AX, 5) + L56-L57, L59, L63-L65, L68, L70 (DX, 8) + a few tech
⚠ blocked:    2/71  (2.8%)   ← L25 (Monorepo polyrepo) + L66 (git LFS guidance)
```

**Backlog size:** 22 actionable pillars. 2 are infrastructure blockers (L25, L66); 20 are quality improvements.

---

## v7+ DAG (Topological)

```
                          ┌──────────────────────────────────────────────┐
                          │  v7 START (post wrap-up, 2026-06-17)         │
                          │  Source: audit-71-pillar + work-dag          │
                          └───────────────────┬──────────────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              │                               │                               │
              ▼                               ▼                               ▼
     ┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
     │ TRACK A: WIP       │       │ TRACK B: STRAND    │       │ TRACK C: PILLAR    │
     │ LANDING            │       │ RECOVERY           │       │ UNBLOCK (⚠)       │
     │ (5 WIP branches)   │       │ (4 strands)        │       │ (2 blocked)        │
     │ ~3-4 h, 5 PRs      │       │ ~2-4 h, 4 PRs      │       │ ~4-8 h, 2 PRs      │
     └─────────┬──────────┘       └──────────┬─────────┘       └──────────┬─────────┘
               │                             │                            │
               ▼                             ▼                            ▼
     A1-A5 (per repo)              B1-B4 (per strand)              C1: L66 LFS guide
                                                                  C2: L25 monorepo
               │                             │                            │
               └─────────────────────────────┼────────────────────────────┘
                                             │
                                             ▼
                              ┌────────────────────────────┐
                              │ TRACK D: PILLAR BACKFILL   │
                              │ (20 △ partials, 6 UX + 5   │
                              │  AX + 8 DX + 1 tech)       │
                              │ ~12-20 h, 8-12 PRs         │
                              └────────────┬───────────────┘
                                           │
                                           ▼
                              ┌────────────────────────────┐
                              │ TRACK E: FOUNDATION RE-EVAL│
                              │ (4 governance/ADR tasks)   │
                              │ ~2-3 h, 4 ADRs             │
                              └────────────────────────────┘
```

---

## TRACK A — WIP Branch Landing (5 PRs, ~3-4 h)

The 5 WIP branches pushed during wrap-up are **not yet landed**. Each is real, recoverable work that needs review + merge.

| Task | Repo | Branch | PR title | Effort | Reviewer gate |
|---|---|---|---|---|---|
| **A1** | AgilePlus | `wip/stash-2026-06-14-spdx-license-headers-2026-06-17` | "chore(license): add SPDX-License-Identifier to 541 source files" | 30m review + 1m land | Confirm no semantic change, just headers |
| **A2** | pheno | `wip/stash-2026-05-02-pheno-cli-adapter-refactor-2026-06-17` | "chore(pheno-cli): refactor GetAdapter signature and add error variants" | 1h review + 30m land | Verify `cargo test --workspace` + Go `go test ./...` |
| **A3** | pheno | `wip/migrate-from-dmouse-chore-adr-012-2026-06-17` | "chore(pheno): import adr-012 from Dmouse92 fork (historical preservation)" | 15m review + 1m land | Verify content matches local `chore/adr-012` (local is strict superset) |
| **A4** | dispatch-mcp | `wip/migrate-from-dmouse-w2-1-2026-06-17` | "feat(dispatch-mcp): W2-1 protocol compliance (imported from Dmouse92 fork)" | 1h review + 30m land | Verify mock compliance tests pass; this is the W2-1 deliverable |
| **A5** | (none — pre-existing) | `AgilePlus:wip/preserve-agileplus-brand-rename-20260605` | (untouched, leave as-is) | 0 | Owner decides |

**A1-A4 dependencies:** Each is independent; can run in parallel across subagents. Total wall clock with parallelism: ~1.5h.

---

## TRACK B — Strand Recovery (4 PRs, ~2-4 h)

The 4 strands are documented in audit Section 6.1-6.4. Each needs an explicit decision + recovery PR.

| Task | Strand | Recovery path | PR target | Effort | Risk |
|---|---|---|---|---|---|
| **B1** | monorepo `chore/w5-adrs-sota` (3 commits incl. ADR-024/025 + 71-pillar reference) | **RECOMMENDED**: Cherry-pick `d83900c4a7` to `KooshaPari/phenotype-org-audits` `docs/2026-06-17/AGENTS-refresh.md` | `phenotype-org-audits` | 1h | LOW (doc-only) |
| **B2** | l4-80-wt worklog commit `69fe8cddee` | Re-commit as `KooshaPari/phenotype-otel` `docs/worklog-L4-080.md` (the worklog content only) | `phenotype-otel` | 15m | LOW (doc-only) |
| **B3** | l4-68 pheno-context crate (286 lines, L4 #68) | **DECISION**: Either (a) restore LFS cache and push, OR (b) copy `pheno-context/` to `KooshaPari/phenoShared` and submit a PR there | `phenoShared` | 2h | MEDIUM (new crate placement) |
| **B4** | audit-30pillar (484 commits, 30 files at `audit-30-pillar-L*.md`) | **RECOMMENDED**: `cp audit-30-pillar-L*.md KooshaPari/phenotype-org-audits/audit-30-pillar/` and submit a single PR | `phenotype-org-audits` | 30m | LOW (audit files only, no code) |

**B3 is the only one needing user decision** (new crate placement affects L10 substrate policy per ADR-023). Suggested default: copy to `phenoShared/crates/pheno-context/` to align with existing `pheno-tracing`, `pheno-config`, etc.

**B1-B4 dependencies:** B1 and B4 both target `phenotype-org-audits` and can be batched. B2 and B3 are independent. Total wall clock with parallelism: ~2h.

---

## TRACK C — Pillar Unblock (2 PRs, ~4-8 h)

The 2 ⚠ blocked pillars are infrastructure-level work.

| Task | Pillar | What to build | Effort | Risk |
|---|---|---|---|---|
| **C1** | **L66 (git LFS guidance)** | Add a `docs/git-lfs.md` to root monorepo: (a) required LFS objects for monorepo, (b) `git lfs install --local` setup, (c) `git lfs fetch --all` recovery command, (d) `git lfs push origin <ref>` for stranded monorepo branches, (e) submodule LFS pitfalls. Also add `lfs = "true"` to worktree `.gitconfig`. This unblocks monorepo pushes for all 3 strands. | 3h | LOW |
| **C2** | **L25 (Monorepo polyrepo trade-off)** | Author ADR-026 evaluating the "monorepo with 170+ submodules" architecture decision. Key questions: (a) what % of submodules are actually built? (b) what % have changed in 6 months? (c) is the dispatch cost worth the consistency benefit? (d) is "create KooshaPari/repos" the right path? Outcomes may be KEEP / DECOMPOSE / EXTRACT. | 4-6h | HIGH (governance-level) |

**C1 dependency:** None (doc work). Lands first to enable B1-B3 push.
**C2 dependency:** None (ADR work). Lands in parallel; outcome may unblock B3 or change the strand-recovery plan.

**C1 unlocks:** B1, B2, B3 (monorepo strands can actually be pushed once LFS is set up).
**C2 may modify:** B1 (cherry-pick vs create repos decision).

---

## TRACK D — Pillar Backfill (20 △ partials → ✓, ~12-20 h, 8-12 PRs)

The 20 △ partial pillars are quality improvements, not infrastructure. Cluster by repo/scope to minimize PR overhead.

### D1 — UX cluster (6 pillars, ~3-4 h, 2-3 PRs)

| Pillar | Pillar | What to do | Target repo(s) |
|---|---|---|---|
| **L30** | Onboarding ≤10min | Write a `docs/quickstart.md` per top-3 repo (pheno, AgilePlus, dispatch-mcp) with `git clone → cargo build → cargo test` path, copy-paste-run, with `time` benchmarks | `pheno`, `AgilePlus`, `dispatch-mcp` |
| **L32** | llms.txt presence | Add `llms.txt` to top-5 repos missing it (checklist: any repo w/o `llms.txt` in root) | repo-by-repo |
| **L35** | First-Deploy Path | Add `deploy/` or `k8s/` or `docker-compose.yml` to top-3 apps (focalpoint, pheno, dispatch-mcp) | per app |
| **L36** | Error messages human-readable | Audit `phenotype-error-core` and `pheno-errors` for: missing `.help()`, raw `unwrap()` in user-facing paths, cryptic error codes without message. Add 5-10 example fixes. | `pheno-errors`, `phenotype-error-core` |
| **L37** | CLI discoverability | Audit top-5 CLIs (`pheno`, `agileplus`, `dispatch-mcp`, `phenotype-pm-core`, `phenotype-dep-guard`) for: `--help` quality, subcommand list, `--version` output | per CLI |
| **L38** | Doc navigation | `phenodocs` already has TOC; verify search works; add "by-task" nav (e.g., "I want to add a new MCP server") | `phenodocs` |
| **L39** | CHANGELOG per crate | Spot-check 5-10 sub-crates; add `CHANGELOG.md` to those missing it (or document why version control alone is enough) | per crate |

### D2 — AX cluster (5 pillars, ~3-5 h, 2-3 PRs)

| Pillar | What to do | Target repo(s) |
|---|---|---|
| **L43** | Add `SPEC.md` to top-5 repos missing it (per audit, 5 of N have it; figure out the missing 5) | repo-by-repo |
| **L45** | Promote `.claude/agent-assignments.md` to repo-root `AGENTS-ASSIGNMENTS.md` in top-3 repos | top-3 repos |
| **L47** | Add `prompts/` directory with 3-5 reusable subagent prompt templates (from `.claude/` content) to `phenotype-tooling` or `thegent` | `phenotype-tooling` |
| **L51** | Generate `llms.txt` for `phenodocs` (currently △) | `phenodocs` |
| **L54** | Document forge/muse boundaries in `thegent` README or `phenotype-tooling` README (per-agent scopes) | `thegent` |

### D3 — DX cluster (8 pillars, ~5-10 h, 4-6 PRs)

| Pillar | What to do | Target repo(s) |
|---|---|---|
| **L56** | Audit test matrix quality: ratio of unit/integ/e2e across top-5 repos; document target ratios in `phenotype-e2e-base` | `phenotype-e2e-base` |
| **L57** | Add `sccache` + `cargo-chef` to monorepo's CI workflows (root `.github/workflows/`) | monorepo |
| **L59** | Add `cargo-nextest` to top-3 repos' CI; document `mold` linker setup in CONTRIBUTING.md | top-3 repos |
| **L63** | Add `.vscode/extensions.json` + `.idea/` template to top-3 repos | top-3 repos |
| **L64** | Add `cargo-flamegraph` to dev-deps of top-2 perf-critical repos (pheno, dispatch-mcp) | `pheno`, `dispatch-mcp` |
| **L65** | Enable `cargo doc --no-deps --document-private-items` in CI for top-3 repos; publish to phenodocs | top-3 repos |
| **L68** | Profile top-3 repos' CI loop time; document and add a 10-min budget gate | top-3 repos |
| **L70** | Generate cross-crate API surface docs (per ADR-0023 substrate placement) | `phenoShared`, `phenotype-python-sdk` |

### D4 — Tech (1 pillar — L22 LFS Handling)

This was marked ✓ but is actually BLOCKED (per audit 6.3). The actual work here is the implementation side of C1.

| Pillar | What to do |
|---|---|
| **L22** | Implement LFS recovery commands (the runtime side of C1's documentation). Includes: a `scripts/lfs-recover.sh` that detects missing LFS objects and refetches, and a CI smoke test. |

---

## TRACK E — Foundation Re-evaluation (4 ADRs, ~2-3 h)

| Task | ADR | Subject | Effort | When |
|---|---|---|---|---|
| **E1** | ADR-024 | **71-pillar framework canonicalization** — adopt the 71-pillar as the fleet quality model; supersede the 30-pillar reference in AGENTS.md | 30m | After D1-D3 stabilize |
| **E2** | ADR-025 | **Worklog v2.1 schema** (with `device:` field per ADR-015) — promote to canonical | 30m | Standalone (worklog schema) |
| **E3** | ADR-026 | **Monorepo architecture decision** (per C2 outcome) — KEEP / DECOMPOSE / EXTRACT the monorepo | 1h | After C2 |
| **E4** | ADR-027 | **LFS as first-class substrate** (per C1) — codify LFS as a fleet-wide concern, not repo-local | 30m | After C1 lands |

---

## Topological sort (what to do in what order)

```
Phase 1 (parallel, day 1):
  ├─ A1, A2, A3, A4          (WIP landing, 4 parallel PRs)
  ├─ C1                       (LFS guidance — unblocks monorepo strands)
  └─ C2                       (ADR-026 monorepo eval — informs B3)

Phase 2 (parallel, day 1-2):
  ├─ B1, B2                   (B1: monorepo cherry-pick; B2: l4-80 worklog)
  ├─ B4                       (audit-30pillar extract)
  ├─ D1                       (UX pillar cluster)
  └─ D2                       (AX pillar cluster)

Phase 3 (parallel, day 2-3):
  ├─ B3                       (pheno-context crate placement — depends on C2 outcome)
  ├─ D3                       (DX pillar cluster)
  └─ D4                       (L22 LFS runtime)

Phase 4 (sequential, day 3-4):
  ├─ E1 (ADR-024 71-pillar canonical)
  ├─ E2 (ADR-025 worklog v2.1)
  ├─ E3 (ADR-026 monorepo)
  └─ E4 (ADR-027 LFS substrate)

Phase 5 (validation, day 4):
  └─ Re-run 71-pillar audit; target: 65+ ✓, ≤6 △, 0 ⚠
```

**Total wall clock with 4-way parallelism:** ~3-4 days
**Total wall clock with 2-way parallelism:** ~5-6 days
**Total wall clock sequential:** ~2-3 weeks

---

## Risk register (v7+)

| # | Risk | Mitigation |
|---|---|---|
| 1 | C1 (LFS guidance) lands but B1-B3 still fail because submodule remotes also need reconfig | C1 must include submodule LFS config: `git submodule foreach 'git config lfs.allowincompletepush true'` |
| 2 | B3 (pheno-context crate) collides with L10 substrate policy (ADR-023) | C2 must be done first; default to `phenoShared/crates/pheno-context/` per existing pattern |
| 3 | D1-D3 PRs balloon in scope | Cap each at 1-2 hours of work; if bigger, split into sub-tasks |
| 4 | C2 ADR-026 decision is governance-level and may need user input | Present 3 options (KEEP/DECOMPOSE/EXTRACT) with cost estimates; user picks |
| 5 | D4 (L22 runtime) duplicates C1 docs | D4 is the **implementation**; C1 is the **documentation**. Sequential, not parallel |
| 6 | Strand commits have untracked scratch (audit_scorecard.json, phenotype-perf-budget/) polluting the diffs | Track and `.gitignore` the scratch before any cherry-pick |

---

## Per-pillar commit table (paste-into-PR format)

If landing in sub-PRs, each pillar can be one commit. Example format for D1 L30:

```
docs(quickstart): add clone-to-test path with time benchmarks (L30)

- Quickstart: git clone → cargo build → cargo test
- Time benchmarks: cold cache X min, warm cache Y min
- Top-3 repos covered: pheno, AgilePlus, dispatch-mcp

Pillar: L30 (UX, Onboarding ≤10min)
Closes: backlog item D1.L30

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Success criteria

| Metric | Before (2026-06-17 wrap-up) | After v7+ | Δ |
|---|---|---|---|
| Pillar ✓ | 50/71 (70.4%) | 65+/71 (91.5%) | +15 |
| Pillar △ | 20/71 (28.2%) | ≤6/71 (8.5%) | -14 |
| Pillar ⚠ | 2/71 (2.8%) | 0/71 (0%) | -2 |
| Stranded branches | 4 (3 monorepo + 1 FocalPoint) | 0 | -4 |
| WIP branches unlanded | 5 | 0 (or 1 pre-existing) | -4 |
| ADRs | 23 | 27 (+4) | +4 |
| Repos on KooshaPari | 4/4 active | 4/4 active + 2-3 stranded recovered | +2-3 |

---

## Recommended next-session order

1. **Start C1 + A1-A4 + C2 in parallel** (5 streams, day 1 morning)
2. **Land A1-A4 PRs** (after review, day 1 afternoon)
3. **Run C1 LFS recovery on monorepo** (1-2h, day 1 afternoon) — this should unblock the strands
4. **B1, B2, B4** (cherry-pick + extract, day 2 morning)
5. **D1, D2 in parallel** (UX/AX cluster, day 2)
6. **D3, D4** (DX cluster + LFS runtime, day 3)
7. **B3 (after C2 decision)** (day 3 afternoon)
8. **E1-E4 ADRs** (day 4)
9. **Re-run 71-pillar audit, target 65+ ✓** (day 4 end)

**Confidence:** HIGH for A1-A4, B1, B2, B4, C1. MEDIUM for D1-D3 (scope risk). LOW for B3, E3 (governance decisions).

---

**END OF v7+ DAG**
