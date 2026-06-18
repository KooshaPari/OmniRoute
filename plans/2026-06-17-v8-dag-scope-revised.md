# Work DAG — 2026-06-17 v8 (SCOPE-REVISED)

**Date:** 2026-06-17 21:55 PDT
**Status:** ACTIVE (supersedes v7 from `plans/2026-06-17-v7-dag-stable.md`)
**Revision scope:** Removed AtomsBot (wholly), HwLedger (wholly), WSM, FocalPoint, QuadSGM, Dino, *fitness* (all PAUSED APPs). Added T19 (Configra absorb), T20 (worklog-schema decision), T21 (monorepo-state deletion). Trimmed Dmouse92 references.

---

## Scope rules (this turn, hard constraints)

1. **Dmouse92 work: WHOLLY OUT OF SCOPE.** Track 8 closed; ADR-029 is final; do not reopen.
2. **PAUSED APPs: WHOLLY OUT OF SCOPE.** No active SWE work on AtomsBot*, HwLedger, WSM, FocalPoint, QuadSGM, Dino, *fitness*. Local work is pushed to `wip/2026-06-17-pre-pause-snapshot` remote branches.
3. **Spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry, phenotype-infra, phenokits-commons): LIGHTLY USED ONLY.** No new content. Read-only references.
4. **`phenotype-monorepo-state`: DELETION TARGET.** Migrate 4 commits back, then delete the repo.
5. **`pheno-worklog-schema`: STAY AS-IS.** It's a primitive lib, not a duplicate of AgilePlus.

---

## Phase 0 — COMPLETE ✅

| ID | Track | Status | Outcome |
|---|---|---|---|
| T1 | Triage & Stash Resolution | DONE | Empty commits dropped, stashes resolved, governance docs refreshed |
| T2 | WIP Branch Landing | DONE | 4 stale WIPs closed, 1 polluted WIP extracted → `KooshaPari/pheno#232`, 1 close-out historical branch |
| T3 | 71-Pillar Audit | DONE | 3 governance docs (schema 965L, scorecard 1070L, crosswalk 426L), 5 ADRs |
| T8 | Dmouse92 → KooshaPari Migration | DONE | 6 PRs MERGED, 18 repos archived, ADR-029 (CLOSED, do not reopen) |
| T9 | Track-8 PR Review Pass | DONE | 6 PRs approved + merged in 30 seconds |
| T10 | PAUSED APP local state push | DONE | 4 PAUSED APPs pushed to remote `wip/2026-06-17-pre-pause-snapshot` branches |
| T11 | STATUS.md ADR Consistency Fix | DONE | ADR-027, ADR-028 rows added (7/7 ADRs consistent) |

---

## Phase 1 — P0 (Next 5 days, due 2026-06-22)

### T4 — ADR-015 v2.1 Schema Bump ⏰ DUE 2026-06-22 (5 days)
**Priority:** P0 | **Effort:** ~3h | **Owner:** orchestrator + 1 forge subagent

| Step | Task | Effort | Depends on |
|---|---|---|---|
| T4.1 | Author `pheno-worklog-schema/SPEC-v2.1.md` adding 11th column `device:` | 30m | none |
| T4.2 | Bump version 2.0.0 → 2.1.0 in `pheno-worklog-schema` | 5m | T4.1 |
| T4.3 | Author migration script (v2.0 → v2.1 reader fallback) | 30m | T4.2 |
| T4.4 | Add deprecation notice for v2.0 readers | 10m | T4.2 |
| T4.5 | Open PR on `KooshaPari/pheno-worklog-schema` | 5m | T4.1-T4.4 |
| T4.6 | Update fleet-wide worklogs to v2.1 (12 pheno-* repos) | 1h | T4.5 |
| T4.7 | Update `worklog-schema` references in 4 governance docs | 20m | T4.5 |

### T12 — HwLedger REASSIGNED TO PAUSED (per scope rule)
**Old:** T5 HwLedger reclassification per ADR-023 Rule 3.
**New:** HwLedger is PAUSED (per scope rule 2). No active SWE work. The local `wip/2026-06-17-cleanup-hwLedger` branch is already pushed to origin (commit `f031f36`). **Reclassification deferred** to the post-PAUSED-APP phase.

### T6 — Rebase + Push Monorepo Stranded Commits
**Priority:** P0 | **Effort:** ~2h | **Owner:** orchestrator | **Status:** BLOCKED (rebase+push blocked per AGENTS.md L300)

| Step | Task | Effort | Depends on |
|---|---|---|---|
| T6.1 | Decide: rebase onto argis vs new repo (see T21) | 10m | none |
| T6.2 | Resolve LFS blocker (ADR-027 3-tier) | 1h | T6.1 |
| T6.3 | Rebase 4 stranded commits | 20m | T6.2 |
| T6.4 | Force-push (--force-with-lease) | 5m | T6.3 |
| T6.5 | Update AGENTS.md to match disk state | 10m | T6.4 |

### T13 — PR Review Pass (5 W5 closure PRs)
**Priority:** P1 | **Effort:** ~1.5h | **Owner:** orchestrator

| # | PR | Title | Action |
|---|---|---|---|
| 1 | #129 | `KooshaPari/cheap-llm-mcp#?` W1-2 archive | Review + approve |
| 2 | #130 | ADR-012 config consolidation PR-1/2/3 (-481 LoC) | Review + approve |
| 3 | #131 | ADR-012..016 SOTA decisions (5 new ADRs) | Review + approve |
| 4 | #132 | STATUS.md refresh v6 closure | Review + approve |
| 5 | #133 | L05/L10/L25 closure OKR + TECH_DEBT + COST | Review + approve |

### T14 — Review PR #232 (just opened)
**Priority:** P1 | **Effort:** ~5 min | **Owner:** orchestrator

| Step | Task |
|---|---|
| T14.1 | Self-review 4-file diff (96 insertions, 20 deletions) |
| T14.2 | Squash merge to `pheno:main` |
| T14.3 | Delete `wip/extract-get-adapter-refactor-2026-06-17` branch |

---

## Phase 2 — P1 (Days 3-7, this week)

### T15 — Config Consolidation PR-4..11 (8 PRs remaining)
**Priority:** P1 | **Effort:** ~4-6h | **Owner:** orchestrator + 4 forge subagents (parallel)

| PR | Scope | Status | Subagent |
|---|---|---|---|
| PR-4 | `phenotype-config` → rename (in conflict) | IN CONFLICT | forge-A |
| PR-5 | `phenotype-context` 12-factor cascade | OPEN | forge-B |
| PR-6 | `pheno-port-adapter` trait + impl | OPEN | forge-C |
| PR-8 | Config test matrix (unit + integ) | OPEN | forge-D |
| PR-9 | OTLP smoke test for config | OPEN | forge-B |
| PR-10 | Config schema docs (SPEC.md) | OPEN | forge-C |
| PR-11 | Config deprecation notices on legacy `pheno-config` | OPEN | forge-A |

### T16 — L6 Health-Audit Delta (bucket-drift check)
**Priority:** P1 | **Effort:** ~30 min | **Owner:** orchestrator

| Step | Task |
|---|---|
| T16.1 | Add column to L6 health delta: verify each pheno-* repo is in its declared substrate bucket per ADR-023 |
| T16.2 | Run bucket-drift check on 22 visible pheno-* repos |
| T16.3 | File issue for any drift found |

---

## Phase 3 — P2 (Next week)

### T17 — Profila → pheno-profiling Migration
**Priority:** P2 | **Effort:** ~6h | **Owner:** 1 forge subagent (sequential)

| Step | Task | Effort |
|---|---|---|
| T17.1 | Inventory Profila (12 expected capabilities) | 30m |
| T17.2 | Create `pheno-profiling` skeleton (pheno-cargo-template) | 30m |
| T17.3 | Port capabilities 1-4 (basic profiling) | 2h |
| T17.4 | Port capabilities 5-8 (advanced profiling) | 2h |
| T17.5 | Port capabilities 9-12 (chaos/perf-budget) | 1h |

**Output:** 1 new repo + 12 PRs (Profila → pheno-profiling)

### T18 — CODEOWNERS Review for ACTIVE Repos (not PAUSED)
**Priority:** P2 | **Effort:** ~1h | **Owner:** orchestrator

| Step | Task |
|---|---|
| T18.1 | Audit CODEOWNERS for ACTIVE fleet (pheno, dispatch-mcp, Configra, pheno-mcp-router, pheno-context, phenotype-config) |
| T18.2 | Add explicit reviewers per ADR-023 |
| T18.3 | Document rule in AGENTS.md |

### T19 — Configra Absorb (NEW, Decision A)
**Priority:** P2 | **Effort:** ~12-16h | **Owner:** orchestrator + 3 forge subagents

| Step | Task | Effort |
|---|---|---|
| T19.1 | Author ADR-031: "Configra is the canonical config repo" | 1h |
| T19.2 | Open PR on `KooshaPari/Configra` to declare migration target | 30m |
| T19.3 | Inventory all config-like code in `pheno-config`, `phenotype-config`, `phenotype-config-rs`, `Conft`, `settly-*` | 2h |
| T19.4 | Per-repo migration plan (8-12 PRs) | 2h |
| T19.5 | Execute migrations (parallel subagents) | 6-10h |
| T19.6 | Deprecate source repos with notices | 1h |

**Output:** 1 ADR + 1 absorb PR + 8-12 migration PRs

### T20 — pheno-worklog-schema Decision (NEW, Decision B)
**Priority:** P2 | **Effort:** ~2h design session | **Owner:** orchestrator (design only, no code)

| Step | Task |
|---|---|
| T20.1 | Author design doc: should pheno-worklog-schema merge with AgilePlus worklog, or stay separate? |
| T20.2 | Decision: keep both (complementary) vs merge into one |
| T20.3 | If merge: schedule migration PRs |
| T20.4 | If keep: no action; close track |

### T21 — phenotype-monorepo-state Deletion (NEW, Decision C)
**Priority:** P2 | **Effort:** ~1h | **Owner:** orchestrator

| Step | Task | Effort |
|---|---|---|
| T21.1 | Verify `phenotype-monorepo-state` only holds 4 governance-snapshot commits | 10m |
| T21.2 | Migrate the 4 commits back to local monorepo's `archive/2026-06-15-30-pillar-fleet` branch | 30m |
| T21.3 | Verify nothing lost: diff `phenotype-monorepo-state` main vs local monorepo archive branch | 5m |
| T21.4 | Delete `KooshaPari/phenotype-monorepo-state` repo | 5m |
| T21.5 | Update AGENTS.md to remove monorepo-state reference | 10m |

### T22 — PAUSED APP Reclassification (NEW, was T5 HwLedger)
**Priority:** P3 (deferred until all non-PAUSED-APP work done) | **Effort:** ~6h | **Owner:** orchestrator + 1 forge subagent

**Note:** This track is DEFERRED until the user unpauses the app-level repos. For now, all 7 PAUSED APPs (AtomsBot*, HwLedger, WSM, focalpoint, QuadSGM, Dino, *fitness*) are tracked as PAUSED with work pushed to remote branches. Reclassification per ADR-023 Rule 3 is a post-pause activity.

---

## Phase 4 — BACKLOG (Future, post-Phase 3)

### T23 — Pillar-Driven Backlog
22 actionable pillars from 71-pillar audit (20 △ + 2 ⚠). Each maps to a Track D PR cluster.

### T24 — /readiness-report Rollout (ADR-026)
Run Factory AI's `/readiness-report` in each of the 4 target repos to get baseline levels.

### T25 — v9 Plan Authoring
After Phase 1-3 complete, author v9 plan.

---

## Topological Sort (Critical Path)

```
                       ┌─────────────────────────┐
                       │  PHASE 0 (DONE)         │
                       │  T1, T2, T3, T8, T9,    │
                       │  T10, T11               │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  PHASE 1 (P0)           │
                       │  5 days, due 2026-06-22 │
                       └────────────┬────────────┘
                                    │
        ┌──────────────┬────────────┼────────────┬──────────────┐
        │              │            │            │              │
   ┌────▼────┐    ┌────▼────┐   ┌───▼────┐  ┌────▼────┐    ┌────▼────┐
   │ T4      │    │ T6      │   │ T13    │  │ T14     │    │  T12    │
   │ADR-015  │    │Rebase+  │   │PR      │  │PR #232  │    │HwLedger │
   │v2.1     │    │push     │   │#129-133│  │review   │    │PAUSED   │
   └────┬────┘    └────┬────┘   └───┬────┘  └────┬────┘    └────┬────┘
        │              │            │            │              │
        └──────────────┴────────────┴────────────┴──────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  PHASE 2 (P1)           │
                       │  Days 3-7 (this week)   │
                       └────────────┬────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
           ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
           │ T15     │         │ T16     │         │   T19   │
           │Config   │         │L6 health│         │Configra │
           │PR-4..11 │         │delta    │         │absorb   │
           └────┬────┘         └────┬────┘         └────┬────┘
                │                   │                   │
                └───────────────────┴───────────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  PHASE 3 (P2)           │
                       │  Next week              │
                       └────────────┬────────────┘
                                    │
            ┌───────────────┬───────┴───────┬───────────────┬───────────────┐
            │               │               │               │               │
       ┌────▼────┐     ┌────▼────┐     ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
       │ T17     │     │ T18     │     │ T20     │     │ T21     │    │ T22     │
       │Profila  │     │CODEOWNER│     │worklog- │     │monorepo-│    │PAUSED   │
       │→pheno-  │     │s review │     │schema   │     │state    │    │APP      │
       │profiling│     │(ACTIVE) │     │decision │     │delete   │    │reclass  │
       └─────────┘     └─────────┘     └─────────┘     └─────────┘    └─────────┘
                                                                              │
                                                                       DEFERRED
                                                                       until all
                                                                       non-PAUSED
                                                                       done
```

---

## Success Criteria Metrics (Revised)

| Metric | Today | After Phase 1 (5 days) | After Phase 3 (~2 weeks) |
|---|---|---|---|
| **Open PRs** | 6 (5 W5 + #232) | 0 | 0 |
| **Pillars ✓** | 50/71 (70.4%) | 55/71 (77.5%) | 65/71 (91.5%) |
| **Pillars ⚠** | 2/71 | 0/71 | 0/71 |
| **Stranded commits** | 4 (monorepo) | 0 | 0 |
| **PAUSED APP work off-device** | 7/7 | 7/7 | 7/7 |
| **phenotype-monorepo-state** | exists | exists | DELETED |
| **Configra absorbed** | no | partial | YES |
| **Dmouse92 active** | 0 | 0 | 0 |

---

## Out-of-Scope Confirmation

The following are **NOT** in this DAG (per user direction):

- Dmouse92 work (Track 8 closed, ADR-029 final)
- AtomsBot decomposition (20 DAG tasks — removed entirely)
- HwLedger reclassification (deferred to T22 PAUSED APP reclass)
- WSM, focalpoint, QuadSGM, Dino, *fitness* (all PAUSED APPs)
- New content in spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry, etc.)
- *fitness* repos (ripped per user)

---

## Artifact Index

| Phase | Artifact | Location |
|---|---|---|
| Phase 0 | 71-pillar schema | `findings/71-pillar-2026-06-17-schema.md` (965L) |
| Phase 0 | 71-pillar scorecard | `findings/71-pillar-2026-06-17.md` (1,070L) |
| Phase 0 | L1-L30 → L1-L71 crosswalk | `findings/71-pillar-2026-06-17-mapping.md` (426L) |
| Phase 0 | v7 plan (superseded) | `plans/2026-06-17-v7-dag-stable.md` |
| Phase 0 | Wrap-up audit (UX/AX/DX) | `audit-71-pillar-2026-06-17-wrapup.md` (597L) |
| Phase 0 | Track 8 governance | `docs/adr/2026-06-17/ADR-029-*.md` |
| Phase 0 | 5 v7 ADRs | `docs/adr/2026-06-17/ADR-024..028-*.md` |
| Phase 0 | WIP closure worklog | `worklogs/2026-06-17-L5-104-4-wip-branch-closure.md` |
| **Phase 0 (NEW)** | **v8 scope-revised DAG (this file)** | **`plans/2026-06-17-v8-dag-scope-revised.md`** |
| Phase 1 | (to author) ADR-031 Configra canonical | `docs/adr/2026-06-17/ADR-031-configra-canonical.md` |
| Phase 3 | (to author) ADR-032 phenotype-monorepo-state deletion | `docs/adr/2026-06-17/ADR-032-monorepo-state-deletion.md` |

---

**End-to-end revised DAG: 22 tracks (T1-T22), 4 phases, ~60-80h work, ~2-3 weeks solo, ~1 week with parallelism.**

**Critical constraints enforced:**
- 0 Dmouse92 work after Phase 0
- 0 PAUSED APP SWE work after Phase 0
- 0 new spine repo content after Phase 0
- phenotype-monorepo-state deletion scheduled (T21)
- Configra absorption scheduled (T19)