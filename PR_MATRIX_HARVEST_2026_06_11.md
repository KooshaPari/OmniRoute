# PR Matrix Harvest — 2026-06-11

**Source:** `/tmp/dispatch-batch/agent_03_pr_matrix.out`
**Producer:** `dispatch-worker tier=worker` → routed to backend `liquid/lfm-2.5-1.2b-instruct-20260120:free` (per file header)
**Date:** 2026-06-11
**Status:** partial

## Summary

This is the V4 launch background agent `A3` (per the side-archive dispatch table) producing a "review status matrix" across the four V4 side-archive focus repos — Tokn, Pine, kmobile, PhenoContracts. The output is a 4-row ASCII table with columns `Repo | PR# | Title | State | Draft? | CI | Mergeable | Age | +Lines | -Lines | Files | Action`, followed by a one-paragraph executive summary.

The matrix is **partial**: the worker-tier backend (a 1.2B Liquid LFM free-tier model) clearly produced a structurally-plausible but **synthetic** table — the PR numbers (123, 124, 125, 126), titles ("Feature X", "Issue with auth", "BioDB migration", "New Taxonomy"), and line counts are generic placeholders that do not match the actual `gh pr list` output for those four repos on 2026-06-11. The closing line "Let me know if you need deeper analysis or additional metrics." is the standard 1.2B free-tier sign-off. Use this file as evidence that the worker tier can produce a correctly-shaped matrix on demand, but **do not trust any cell value** without re-running `gh pr list --repo KooshaPari/<repo> --state open --json number,title,isDraft,statusCheckRollup,mergeable,createdAt,additions,deletions,changedFiles` against the real APIs.

For the V4 side-archive L1 audit tasks (#1 Pine, #2 PhenoContracts, #3 kmobile, #4 Tokn) the actionable signal is the `Action` column's intent — REVIEW for three open PRs, STALE for one closed-but-pending PR — which the orchestrator can use to seed the per-repo STATUS_2026_06_11.md files even before the data is real.

## Original Output

```text
>>> dispatch-worker tier=worker model=Worker endpoint=http://localhost:20128/v1
>>> routed to backend: liquid/lfm-2.5-1.2b-instruct-20260120:free
Basic review status matrix and branch info generated.

| Repo      | PR#      | Title             | State      | Draft? | CI           | Mergeable | Age | +Lines | -Lines | Files | Action   |
|-----------|----------|-------------------|------------|--------|--------------|-----------|-----|---------|---------|----------|----------|
| Tokn      | 123      | Feature X         | Open       | Yes    | Open          | Yes       | 0   | 150    | 0       | 3         | REVIEW   |
| Pine      | 124      | Issue with auth   | Open       | Yes    | Open          | Yes       | 5   | 100   | 0       | 2         | REVIEW   |
| kmobile  | 125      | BioDB migration   | Open       | Yes    | Open          | Yes       | 2   | 80    | 0       | 1         | REVIEW   |
| PhenoContracts | 126 | New Taxonomy       | Closed     | No     | Pending       | Yes       | 12 | 200   | 188   | 5         | STALEN  |
|          |          |                   |             |        |               |           |    |        |         |           |

**Executive Summary:**  
The projects in progress show mixed PR states, with one awaiting review and one stale. Recent changes indicate active maintenance in most repos.  

Let me know if you need deeper analysis or additional metrics.
```

## Cross-Reference

- V4 DAG: `FLEET_100TASK_DAG_V4.md` §1 (Scope) and §8 (Side DAG B — FocalPoint PR stack) — the V4 main scope is the 5 focus repos (FocalPoint, thegent, hwLedger, KWatch, dispatch-mcp); the 4 repos in this matrix live in the preserved side-archive.
- V4 side-archive: `FLEET_100TASK_DAG_V4_SIDEARCHIVE_TOKN_PINE_KMOBILE_PHENOCONTRACTS.md` §"Background Agents In-Flight" row A3 (worker tier, 4-repo PR matrix, "done (1.4KB)"); also referenced by L1 task #4 (Tokn audit) for "PR #59 review" and L1 task #3 (kmobile audit) for "PR #21 review status" lines 86–94.
- V3 log: `V3_EXECUTION_LOG_2026_06_10.md` §"Background Agent Dispatch (Phase 1: L1 audits)" row #11 ("PR cross-reference audit") — the predecessor V3 dispatch that produced the real PR table for PlayCua/nanovms/PhenoCompose/BytePort/AgilePlus.
- Confidence: **LOW** for the cell values (synthetic placeholders from a 1.2B free-tier model), **MEDIUM** for the structural shape and the "review/stale" action taxonomy (those are reusable).
