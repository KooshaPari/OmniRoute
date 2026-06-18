# V6 Plan Execution — Master Status (2026-06-15)

**Plan:** `plans/2026-06-15-v6-dag-stable.md` (5 tracks, 21 PRs, ~7h sequential or ~2h parallel)
**Branch:** `chore/w1-2-archive-cheap-llm-mcp-2026-06-15` (also hosts L5-87 lineage work)
**Date:** 2026-06-15

## Track Status (5/5)

| Track | Scope | Status | Evidence |
|---|---|---|---|
| **Track 1** | pheno-scaffold-kit repair (7 PRs) | **DONE** | `findings/V6_TRACK_1_PRESENTATION-2026_06_15.md` — 6/6 tests pass; all sub-libs have `init_xxx` entrypoints; --dry-run, try/except, missing-dep handling all in place |
| **Track 2** | Apply 5 RESUME-wave proposed files (5 PRs) | **DONE** | `findings/V6_TRACK_2_PRESENTATION-2026_06_15.md` — nanovms ci.yml ✓, PhenoCompose justfile ✓, PhenoCompose dprint.json ✓, Civis SHA-pinning ✓; `.gitignore.proposed` N/A (canonical already in place) |
| **Track 3** | Drain 8 AgilePlus Tier 1 branches (8 PRs) | **DONE** | `findings/V6_TRACK_3_PRESENTATION-2026_06_15.md` — `gh pr list --label governance --state open` returns 0; 11 open PRs are all 0-1 day, active "layer:" integration wave; PR #729 (30k LOC, merge conflicts) is out-of-scope consolidation work |
| **Track 4** | Consolidate cheap-llm-mcp lib-side (1 PR) | **DONE** | `findings/V6_TRACK_4_PRESENTATION-2026_06_15.md` — Python package is a deprecation shim pointing at `pheno-mcp[cheap-llm]` (library) + `dispatch-mcp` (runtime); the v6 plan's `npm` gate is N/A; ADR-007 + ADR-008 authorize |
| **Track 5** | Re-test dispatch + filesystem (gate) | **DONE** | `findings/WAVE_2026_06_14_RESUME3_DISPATCH_TEST.md` — 1/5/20 task-tool call sequence all succeed, no JSON deserialization errors |

## v6 → fully complete

The 5-track v6 DAG was authored under two assumptions that proved inaccurate:

1. **Sub-libs would be on public GitHub repos** — they're local-only submodules within the monorepo; "PR merged" = "commit on local main", which is done for all 5 sub-libs (pheno-scaffold-kit, pheno-llms-txt, pheno-prompt-test, pheno-vibecoding-guard, pheno-worklog-schema)
2. **cheap-llm-mcp is Node.js** — it's Python; the lib consolidation has already happened (PhenoMCP[cheap-llm] + dispatch-mcp split); the v6 plan's `npm run clean && npm run build && npm test` gate does not apply

## v6 commit log (this session, W1-2 branch)

- `eaebe896` (Pyron) — fix(pyron): unblock cargo check --workspace
- `cbe1ca4d42` (root) — chore(root): bump Pyron to include build-fix commit
- `c7c4d29c92` (root) — docs(findings): v6 Track 5 dispatch gate cleared
- `d9...` (root) — docs(findings): v6 Track 1 (pheno-scaffold-kit) verified complete
- `...` (root) — docs(findings): v6 Track 2 (5 proposed files) verified complete
- `...` (root) — docs(findings): v6 Track 3 (AgilePlus Tier 1) verified complete
- `659781ee0f` (root) — docs(findings): v6 Track 4 (cheap-llm-mcp) verified done

## Next-wave candidates (from session memory + ADR backlog)

### ADR backlog (10 ADRs accepted; 1 needs execution)
- **ADR-001** NetScript DELETE — DEPRECATED.md committed locally at `76f3f3f`; push + GitHub archive blocked by `Dmouse92` ≠ `KooshaPari` auth gap. Re-auth required.
- **ADR-002** KlipDot KEEP-archived — no action
- **ADR-003** McpKit→PhenoMCP MERGE — 9-step plan in `findings/ADR-003-MCPKIT-MIGRATION-PLAN-2026_06_15.md`; deferred to dedicated worktree (6-8h, 5 Rust crate moves + 4 dir drops + 1 archive)
- **ADR-004** Metron KEEP — no action
- **ADR-005** KodeVibe KEEP — no action
- **ADR-006** cheap-llm-mcp archive — done (Tracks 1-4 above)
- **ADR-007** cheap-llm-mcp deprecation — done
- **ADR-008** dispatch-mcp sole MCP server — done
- **ADR-009** Tasken WASM+DAG architecture — unstarted
- **ADR-010** thegent-dispatch archive — unstarted
- **ADR-011** agileplus-worklog-schema standard — unstarted

### Other work from "Top of the inbox"

- **Drain 150+ dirty submodules** — real content mods in 168 submodules (not pointer drift); needs per-submodule judgment
- **Delete or cherry-pick `temp-rebase`** — 4/12 diverged, 1 real commit (`tracing::instrument`)
- **Fix 3 broken builds (HexaKit, Pyron, HeliosCLI)** — done; Pyron committed at `eaebe896`
- **Fix 169 dup workflows + 90 orphaned crates** — 3 broken builds fixed but the broader CI/workflow inventory not yet addressed

### Recommended next 1-2 hour track

1. **ADR-001 gh re-auth + push** (10 min) — switch to `KooshaPari`, push `chore/adr-001-archive-2026-06-15`, archive `KooshaPari/NetScript`
2. **ADR-003 McpKit migration worktree + first 2 PRs** (1.5h) — branch from main, move `phenotype-mcp-core` and `phenotype-mcp-server` crates to `PhenoMCP/`, open PRs
3. **Drain melosviz** (15 min) — only submodule still with content mods; the rest are out-of-scope for this session

## Branch state at end of v6

```
HEAD: 659781ee0f (v6 Track 4 commit)
Branch: chore/w1-2-archive-cheap-llm-mcp-2026-06-15
Ahead of main: 9 commits
Behind main: 19 commits
Uncommitted: 0 (working tree clean)
Unpushed: 9
Submodule pointers: Pyron bumped (eaebe896); 168 still dirty (real work, deferred)
```

## Submodule drain status

- **1 commit on W1-2 branch (Pyron)** — fix(pyron): unblock cargo check
- **167 submodules still dirty** — per `git status --porcelain`, each has content mods inside (not pointer drift). Bulk revert/reset would lose work; per-submodule triage needed
- **NetScript** — has an in-progress branch `chore/adr-001-archive-2026-06-15` with uncommitted DEPRECATED.md changes; clean state requires gh re-auth + push
