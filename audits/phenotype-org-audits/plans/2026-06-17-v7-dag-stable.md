# DAG v7 — Stable Spec (Phenotype Fleet Wrap-up & Forward Plan)

**Date authored:** 2026-06-17
**Status:** SPEC READY (not yet launched)
**Authoritative source:** AGENTS.md § "Wave Plan (v7 — current, supersedes v6)" (2026-06-17 12:00 PDT revision)
**Supersedes:** v6 (`plans/2026-06-15-v6-dag-stable.md`) and prior waves (v3 `FLEET_100TASK_DAG_V3.md`, v4 `plans/2026-06-14-dag-v4.md`, v5 `plans/2026-06-15-CONSOLIDATED-DAG-V5.md`)
**Ships-to:** This file (stable location; replaces the inline § "Wave Plan (v7 — current, supersedes v6)" of AGENTS.md)
**Extends:** `work-dag-2026-06-17-wrapup.md` (N01-N09 wrap-up DAG) and `work-dag-2026-06-17-v7-extended.md` (Tracks A-E post-wrap-up backlog)

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

---

## 1. Executive Summary

**v7 is the post-wrap-up engineering backlog for 2026-06-17.** It converts the 5 WIP branches pushed during the wrap-up session (`work-dag-2026-06-17-wrapup.md` T7, T11) into reviewed PRs; recovers the 4 stranded worktrees flagged in the wrap-up audit (P41, P43); delivers the 9-domain, 71-pillar industry-standard audit framework ratified in ADR-024; bumps the worklog schema from v2.0 to v2.1 (ADR-025, due 2026-06-22) adding the `device:` field per ADR-023's device-fit gate; reclassifies the `HwLedger` app-level repo per ADR-023 Rule 3 (app substrate placement); rebases the cleaned branch onto main and pushes; maintains the work DAG and findings live; and executes the **Dmouse92 → KooshaPari migration** (Track 8, L5-104) per user directive 2026-06-17 — substrate-absorbing 20 Dmouse92 Phenotype repos into 6 KooshaPari substrate PRs. The plan is owned by the **forge orchestrator** with **parallel `forge` subagent dispatch** (proven working 2026-06-15 18:40 PDT per AGENTS.md § "Key Commands") for the PR-review, pillar-probe, and migration tracks. Total scope: **8 tracks, 38 PRs (operationally meaningful; 40 in the matrix per § 5), ~2 hours wall clock with 4-way parallelism, ~5 hours sequential.** It supersedes v6 (5 tracks, 21 PRs) which is closed.

---

## 2. Track Inventory

| # | Track | P-level | Goal | Scope | PR count | Effort (parallel) | Owner | Dependencies |
|---|---|---|---|---|---|---|---|---|
| **T1** | Triage | P0 | Drop empty commits + stashes, commit meta-bundle, refresh governance docs | 3 governance doc PRs, 1 stash-drop, 4 empty-branch-delete, 1 commit | 3 | ~5 min | orchestrator | none |
| **T2** | WIP Branch Landing | P1 | Review + land the 5 WIP branches from wrap-up session; recover 4 stranded worktrees | 5 WIP branch PRs + 4 strand-recovery PRs | 9 | ~10 min | orchestrator + 4 parallel forge subagents (one per repo) | T1 done |
| **T3** | 71-pillar Audit | P1 | Deliver schema + probe + score + render + crosswalk for the 9-domain, 71-pillar framework | 5 finding artifacts + 5 ADRs (ADR-024..028) | 10 | ~30 min | orchestrator + parallel forge subagents (per-repo probes) | T1 done; T2 may run in parallel |
| **T4** | Worklog v2.1 Bump | P0 | Bump worklog schema v2.0 → v2.1 with `device:` field per ADR-015 + ADR-023 device-fit gate; due 2026-06-22 | 1 spec PR, 1 validator PR, 1 exemplar-migration PR, 1 ADR-025 log PR | 4 | ~15 min | orchestrator | none (independent of T1-T3) |
| **T5** | HwLedger Reclassification | P0 | Execute ADR-023 Rule 3 for HwLedger: reclassify app → substrate (or PAUSED+archival), move underlying libs to canonical substrate | 1 ADR-023 update PR, 1 new substrate PR, 1 HwLedger archival PR, 1 migration plan PR | 4 | ~30 min | orchestrator + 1 parallel forge subagent (substrate extract) | T3 done (L25 monorepo decision informs this) |
| **T6** | Rebase + Push | P0 | Rebase cleaned branch onto main, run pre-push checks, push to origin | 1 rebase + 1 push (no PR; 0 PR count) | 0 | ~5 min | orchestrator | T1-T5 all done |
| **T7** | Work DAG Maintenance | ongoing | Keep `findings/71-pillar-2026-06-17*.md` and `plans/2026-06-17-v7-dag-stable.md` live; update on any track-state change | 0 PRs (live doc maintenance) | 0 | ongoing | orchestrator | none (parallel to all) |
| **T8** | Dmouse92 → KooshaPari Migration | P0 | Substrate-absorption of 20 Dmouse92 Phenotype repos: 4-cluster analysis → 6 substantive code PRs → archive 18 Dmouse92 repos | 6 PRs (pheno-mcp-router#1-3, phenotype-config#1, phenotype-ops#2, dispatch-mcp#1) | 6 | ~30 min parallel (4 subagents) | orchestrator + 4 parallel forge subagents | none (independent) |
| | | | | **Total** | **38** | **~2h parallel / ~5h sequential** | | |

**Track 7** is ongoing maintenance, not a discrete deliverable. Tracks T1-T6 are core work; **Track 8 is the new Dmouse92 → KooshaPari migration track** added 2026-06-17 20:55 PDT per user directive. Total: 8 tracks, 38 PRs.

**Parallelism summary:** Tracks T1, T2, T3, T4, T7, **T8** can all run in parallel from t=0. T5 depends on T3 (L25 monorepo decision from C2 of `work-dag-2026-06-17-v7-extended.md`). T6 is the final serial step that requires all of T1-T5 to be done. **T8 is independent and was added post-hoc on 2026-06-17 per user directive; it has already been executed in parallel with the other tracks and is recorded as DONE.**

---

## 3. Per-Track Task List

### 3.1 Track 1 — Triage (P0, ~5 min, orchestrator)

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T1.1** | Drop 2 pre-2026-06-17 stashes in `repos/.git` (stash 0: pheno-tracing warnings fix already in HEAD via W5 batch; stash 1: phantom `crates/phenotype-error-core/Cargo.toml` not a real file) | P0 | orchestrator | none | `git stash list` returns empty; `git stash show -p stash@{0}` content already on HEAD verified by `git log --oneline --grep="pheno-tracing"` returning the fix commit |
| **T1.2** | Delete 4 empty `gate1-0..3` local branches (probe commits, no content, not on any pushed branch) | P0 | orchestrator | none | `git branch \| grep gate1-` returns empty |
| **T1.3** | Commit meta-bundle (AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT) for the 5 fleet-critical pheno-* libs: pheno-config, pheno-context, pheno-otel, pheno-port-adapter, pheno-tracing | P0 | orchestrator | T1.1, T1.2 | Each of the 5 repos has the 5 meta-files in HEAD; `find pheno-{config,context,otel,port-adapter,tracing} -maxdepth 1 -name 'AGENTS.md' -o -name 'llms.txt' -o -name 'WORKLOG.md' -o -name 'CHANGELOG.md' -o -name 'LICENSE-MIT'` returns 25 hits |
| **T1.4** | Refresh governance docs: AGENTS.md (already updated 2026-06-17 12:00 PDT; verify), STATUS.md (refresh with W5 batch + 4 stranded worktree status), SSOT.md (add HOOKS_SKIP=1 env-var spec per P47) | P0 | orchestrator | T1.3 | `git diff main -- AGENTS.md STATUS.md SSOT.md` shows the refresh; `grep -c HOOKS_SKIP SSOT.md` returns ≥ 1 |
| **T1.5** | Open PR for governance-doc refresh on `repos` meta (or `phenotype-org-audits` per ADR-028 staging-repo decision) | P0 | orchestrator | T1.4 | PR opened with title `chore(governance): refresh AGENTS.md + STATUS.md + SSOT.md (v7 triage)`; CI green |
| **T1.6** | Open PR for `pheno-*` meta-bundle on each of 5 repos (1 PR per repo) | P0 | orchestrator | T1.3 | 5 PRs opened, one per repo, all with title prefix `chore(meta): add AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT` |
| **T1.7** | Open PR for HOOKS_SKIP=1 env-var spec in `phenotype-tooling` | P0 | orchestrator | T1.4 | 1 PR opened in `KooshaPari/phenotype-tooling` documenting `HOOKS_SKIP=1` and `SKIP=pre-push,pre-commit` env vars; links to AGENTS.md |

**Track 1 PR count: 3** (T1.5 + T1.6 [5 PRs across 5 repos] + T1.7 = 7; counting T1.6 as 5 separate PRs, total = 7. The PR matrix § 5 reports this as 7. Tracking summary at § 2 above rounds to 3 for the headline by counting T1.6 as one batch operation. The authoritative PR matrix is § 5.)

### 3.2 Track 2 — WIP Branch Landing (P1, ~10 min parallel, orchestrator + 4 forge subagents)

The 5 WIP branches from `work-dag-2026-06-17-wrapup.md` T7/T11 plus the 4 strand-recovery PRs from `work-dag-2026-06-17-v7-extended.md` Track B. Each is independent and dispatched to a `forge` subagent for review + PR.

| Task | Branch / Strand | Repo | Subagent | P-level | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| **T2.1** | `wip/stash-2026-06-14-spdx-license-headers-2026-06-17` | `KooshaPari/AgilePlus` | forge-1 | P1 | T1.1 (stash dropped) | PR #129 opened: "chore(license): add SPDX-License-Identifier to 541 source files"; `git diff main..HEAD --stat` shows 541 files; no semantic change; CI green |
| **T2.2** | `wip/stash-2026-05-02-pheno-cli-adapter-refactor-2026-06-17` | `KooshaPari/pheno` | forge-2 | P1 | T1.1 | PR #130 opened: "chore(pheno-cli): refactor GetAdapter signature and add error variants"; `cargo test --workspace` green; `go test ./...` green |
| **T2.3** | `wip/migrate-from-dmouse-chore-adr-012-2026-06-17` | `KooshaPari/pheno` | forge-3 | P1 | T1.1 | PR #131 opened: "chore(pheno): import adr-012 from Dmouse92 fork (historical preservation)"; local `chore/adr-012` is a strict superset (Dmouse92 tip is ancestor); CI green |
| **T2.4** | `wip/migrate-from-dmouse-w2-1-2026-06-17` | `KooshaPari/dispatch-mcp` | forge-4 | P1 | T1.1 | PR #132 opened: "feat(dispatch-mcp): W2-1 protocol compliance (imported from Dmouse92 fork)"; `pytest tests/test_protocol_compliance.py` green; review confirms SHA matches Dmouse92 tip `a1aaef2` |
| **T2.5** | `wip/preserve-agileplus-brand-rename-20260605` | `KooshaPari/AgilePlus` | orchestrator | P1 | T1.1 | Decision: leave as-is (pre-existing, owner-decides per `work-dag-2026-06-17-v7-extended.md` A5); document in PR #133 description with `do-not-merge` label; branch is **not** in v7 scope but is tracked in the PR matrix for completeness |
| **T2.6** | **Strand B1**: monorepo `chore/w5-adrs-sota` 3 commits (d83900c4a7 etc.) | `KooshaPari/phenotype-org-audits` | orchestrator | P1 | T5 substrate placement (per ADR-023) decided | PR opened: "docs(phenotype-org-audits): cherry-pick monorepo w5-adrs-sota commits (d83900c4a7)"; 3 commits squashed to 1; landing path per ADR-028 staging repo |
| **T2.7** | **Strand B2**: l4-80-wt worklog commit `69fe8cddee` | `KooshaPari/phenotype-otel` | orchestrator | P1 | none | PR opened: "docs(phenotype-otel): re-commit L4-080 worklog (recovered from /private/tmp/l4-80-wt)"; content matches `69fe8cddee`; pushed to `phenotype-otel/docs/worklog-L4-080.md` |
| **T2.8** | **Strand B3**: l4-68 pheno-context crate (286 lines) | `KooshaPari/phenoShared` (per ADR-023 default) | orchestrator | P1 | T5 substrate decision (L10 placement) | PR opened: "feat(phenoShared): add pheno-context crate (recovered from .worktrees/l4-68-pheno-context-2026-06-11)"; 286 lines; `cargo build -p pheno-context` green |
| **T2.9** | **Strand B4**: audit-30pillar (484 commits) | `KooshaPari/phenotype-org-audits` | orchestrator | P1 | T2.6 (both target same repo; batch) | PR opened: "chore(phenotype-org-audits): import 30-pillar fleet audit (484 commits, 30 files)"; 30 files at `audit-30-pillar-L<N>.md`; squashed to 1 commit |

**Track 2 PR count: 9** (5 WIP landing + 4 strand recovery)

**Parallelism within Track 2:** T2.1-T2.4 (4 WIP landing) and T2.6-T2.9 (4 strand recovery) are all independent and can be dispatched in parallel via 4 forge subagents. T2.5 is orchestrator-only (decision task, not a code PR). T2.6 and T2.9 both target `phenotype-org-audits` and should be **sequenced** (T2.6 first, T2.9 second) to avoid PR conflicts.

### 3.3 Track 3 — 71-pillar Audit (P1, ~30 min, orchestrator + parallel forge subagents)

The 9-domain, 71-pillar framework ratified in ADR-024 (L5-102, 2026-06-17). Domains per AGENTS.md § "71-pillar audit": Architecture (AX) L1-L12, Performance L13-L19, Quality/Correctness L20-L27, DX L28-L37, UX L38-L45, Security L46-L55, Observability & Ops L56-L63, Documentation & SSOT L64-L68, Governance & Sustainability L69-L71. Scoring: 0-3 per pillar per repo (0=absent, 1=minimal, 2=adequate, 3=strong/SOTA). N/A=3 for UI pillars (L40 i18n, L41 a11y) on headless backend/CLI libs.

| Task | Deliverable | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T3.1** | `findings/71-pillar-2026-06-17-schema.md` — full 9-domain, 71-pillar schema with industry refs (AWS Well-Architected, Azure WAF, GCP Architecture Framework, ISO 25010, OWASP ASVS, NIST SSDF, Microsoft SDL, DORA 2023, Google SRE Book, CNCF Cloud Native, OpenSSF Best Practices, Divio) | P1 | orchestrator | none | File exists at `findings/71-pillar-2026-06-17-schema.md`; 9 domain sections; 71 pillars; scoring rubric 0-3; references §; ≥ 200 lines |
| **T3.2** | `findings/71-pillar-2026-06-17-probe.md` — probe script + per-repo probe results | P1 | orchestrator + per-repo forge subagent | T3.1 | Probe script committed at `scripts/71-pillar-probe.py` (or per-language equivalent); per-repo result table for top-10 repos |
| **T3.3** | `findings/71-pillar-2026-06-17.md` — live scorecard across 10 existing repos (pheno, phenoShared, dispatch-mcp, phenodocs, AgilePlus, Civis, PhenoMCP, OmniRoute, KWatch, HeliosLab) | P1 | orchestrator | T3.2 | File exists; per-repo per-pillar 0-3 scores; aggregate ✓/△/⚠ counts; refresh cadence noted (weekly Monday 09:00 PDT) |
| **T3.4** | `findings/71-pillar-2026-06-17-render.md` — render the scorecard as human-readable markdown tables + ASCII heatmap | P1 | orchestrator | T3.3 | File exists; ASCII heatmap; tables per domain; baseline ✓/△/⚠ counts documented |
| **T3.5** | `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 (older 30-pillar at `findings/30-pillar-2026-06-16.md`) → L1-L71 crosswalk so the older audit is not orphaned | P1 | orchestrator | T3.1 | File exists; per-pillar mapping table (L1_old → L<n>_new) for all 30 old pillars; explicit "no orphan" attestation |
| **T3.6** | `docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md` — formalize the 9-domain, 71-pillar framework as canonical (supersedes 30-pillar reference in AGENTS.md) | P1 | orchestrator | T3.1-T3.5 | ADR exists; index entry at `docs/adr/2026-06-17/INDEX.md`; AGENTS.md § "Active ADRs" updated with ADR-024 row |
| **T3.7** | `docs/adr/2026-06-17/ADR-025-worklog-v2-1-schema.md` — formalize the v2.1 worklog schema bump (with `device:` field per ADR-023 device-fit gate) | P1 | orchestrator | none (independent of T3.1-T3.6) | ADR exists; v2.0 → v2.1 diff; deprecation 2026-06-22; AGENTS.md § "Active ADRs" updated with ADR-025 row |
| **T3.8** | `docs/adr/2026-06-17/ADR-026-factory-ai-agent-readiness.md` — Factory AI Agent Readiness Model as cross-cutting external standard (5-level gated progression) | P1 | orchestrator | T3.1 (L1-L30 → L1-L71 crosswalk) | ADR exists; crosswalk table to 71-pillar; org score formula; `STATUS.md` § "Factory AI Agent Readiness" pointer; `/readiness-report` slash-command mention |
| **T3.9** | `docs/adr/2026-06-17/ADR-027-git-lfs-3-tier-policy.md` — close L66 (git LFS guidance) with 3-tier policy: always-track / on-demand / never-track | P1 | orchestrator | T3.2 (L66 evidence) | ADR exists; 3-tier table; `.gitattributes.example` shipped; closes L66 |
| **T3.10** | `docs/adr/2026-06-17/ADR-028-monorepo-hybrid-with-staging.md` — close L25 (monorepo polyrepo trade-off) with hybrid-with-staging-repo architecture; staging repo = `phenotype-org-audits` | P1 | orchestrator | T3.9 (LFS unblocks monorepo) | ADR exists; decision table (KEEP / DECOMPOSE / EXTRACT); staging repo rationale; closes L25 |

**Track 3 PR count: 10** (5 finding artifacts + 5 ADRs, where each ADR landing counts as 1 governance-doc PR via the AGENTS.md / docs/adr/ INDEX.md update)

**Parallelism within Track 3:** T3.1 (schema) blocks T3.2-T3.5 (probe/score/render/crosswalk). T3.6 (ADR-024) depends on T3.1-T3.5. T3.7 (ADR-025) is **independent** of T3.1-T3.6 and can run in parallel from t=0. T3.8 (ADR-026) depends on T3.1 (crosswalk). T3.9 (ADR-027) depends on T3.2 (L66 evidence). T3.10 (ADR-028) depends on T3.9 (LFS unblocks monorepo). Per-repo probes (T3.2) can be **dispatched in parallel** via 10 forge subagents (one per top-10 repo).

### 3.4 Track 4 — Worklog v2.1 Schema Bump (P0, due 2026-06-22, ~15 min, orchestrator)

ADR-025 bumps the worklog schema from v2.0 (10 columns per ADR-015) to v2.1 (11 columns; adds `device:` field per ADR-023 device-fit gate). The bump must land by 2026-06-22 (5 days from 2026-06-17). v2.0 is deprecated 2026-06-22.

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T4.1** | Update `pheno-worklog-schema` Python package: add `device: Literal["macbook", "heavy-runner", "ci"]` field to the schema dataclass; bump version to 0.3.0 | P0 | orchestrator | ADR-025 (T3.7) | `pip install -e pheno-worklog-schema` exits 0; `python -c "from pheno_worklog_schema import Worklog; w = Worklog(...device='macbook')"` exits 0; `pyproject.toml` version = 0.3.0 |
| **T4.2** | Update `pheno-worklog-schema` validator: enforce v2.1 (reject worklogs missing `device:` field); warn on legacy v2.0 worklogs | P0 | orchestrator | T4.1 | `pheno-worklog-schema validate worklog.md` returns 0 on v2.1 worklog, 2 (warn) on v2.0; `pheno-worklog-schema migrate worklog.md` produces v2.1 |
| **T4.3** | Migrate 2 exemplar worklogs as reference: `pheno/worklogs/L5-101-app-governance-2026-06-15.json` and `pheno/worklogs/L5-102-71-pillar-audit-2026-06-17.json` (already in v2.0, add `device: macbook`) | P0 | orchestrator | T4.2 | Both files have `device: macbook` field; `pheno-worklog-schema validate` returns 0 on both |
| **T4.4** | Open PR in `KooshaPari/pheno-worklog-schema`: "feat(worklog-schema): bump v2.0 → v2.1 (add device: field per ADR-025)"; reference ADR-025 in PR body | P0 | orchestrator | T4.1-T4.3 | PR opened; CI green (pytest); review confirms backward-compat migration path documented |

**Track 4 PR count: 4** (T4.1-T4.4 are 1 PR — they all land together. Wait, re-count: T4.1 is the package change, T4.2 is the validator change, T4.3 is exemplar migration, T4.4 is the PR. T4.1-T4.3 are **commits in 1 PR** (T4.4). The PR matrix reports 1 PR for Track 4 plus 1 separate PR for the worklog v2.1 spec doc and 1 PR for the decision log. Total: 4 PRs — T4-PR1 (worklog-schema package), T4-PR2 (validator standalone, if split), T4-PR3 (exemplar migration in 2 separate repos, 2 PRs).

Reconcile: Track 4 contributes **4 PRs total** in the PR matrix § 5: (a) `pheno-worklog-schema` v2.1 spec, (b) `pheno-worklog-schema` validator, (c) `pheno` L5-101 exemplar migration, (d) `pheno` L5-102 exemplar migration.

**Parallelism within Track 4:** T4.1 → T4.2 → T4.3 are sequential. T4.4 is the PR-open step. Within T4.3, the 2 exemplar migrations are in 2 different files (same repo, `pheno`) and can be 1 commit or 2; the PR matrix reports 2 PRs (one per worklog file, 2 different worklog-IDs, so separate PRs are cleaner).

### 3.5 Track 5 — HwLedger Reclassification (P0, ADR-023 Rule 3 deliverable, ~30 min, orchestrator + 1 forge subagent)

Per AGENTS.md § "App-level repo triage & app substrate placement (ADR-023)", `HwLedger` is in the default `RECLASSIFY (default PAUSED)` bucket. ADR-023 Rule 3 requires that any reusable underlying capability be placed in one of: `pheno-*-lib` / `pheno-*-core`, `phenotype-*-sdk`, `phenotype-*-framework`, or federated service. The "random `phenoShared`" pattern is forbidden.

`HwLedger` current state (per `HwLedger/AGENTS.md` + `audit_scorecard.json`): "Hardware wallet ledger companion app — bridges hardware security devices with the Ledger ecosystem." Language: Rust. Build: Cargo. Audit scorecard: overall 50/100 (grade D+); L1 Architecture 0, L2 Dev Loop 10, L3 Agent Loop 30, L4 Observability 65, L5 Security 100. No source files in the audit (`.astro`, `.benchmarks`, `.github`, `apps/`, `tools/`, `sidecars/` are present but no `src/`).

The 4-task reclassification sequence:

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T5.1** | Author `docs/adr/2026-06-17/ADR-029-hwledger-reclassification.md` — formalize HwLedger disposition: PAUSED+archival (the L1 Architecture 0 + L2 Dev Loop 10 scores make substrate extraction uneconomical); document bucket change in AGENTS.md | P0 | orchestrator | T3.6 (ADR-024), T3.10 (ADR-028 monorepo decision) | ADR exists; AGENTS.md § "Active / Paused app-level repos" updated: HwLedger → PAUSED + `archived: true`; rationale cited (audit scores) |
| **T5.2** | Substrate placement decision: confirm HwLedger has **no** reusable underlying capability worth extracting to a new `pheno-*-lib` / `phenotype-*-sdk` (per L1=0, L2=10, L7=25 audit scores — no public API surface, no tests, no source files in audit) | P0 | orchestrator | T5.1 | Decision doc: "no substrate extraction"; archival is the correct disposition |
| **T5.3** | Archive `KooshaPari/HwLedger` (no `delete_repo` scope per P34, use `gh repo archive`); add a final README note pointing to ADR-029 for context | P0 | orchestrator + 1 forge subagent (subagent handles the multi-step repo edit) | T5.2 | `gh api repos/KooshaPari/HwLedger` → `"archived": true`; `README.md` has ADR-029 link; PR opened: "chore(HwLedger): archive repo (ADR-029)" |
| **T5.4** | Open PR in `KooshaPari/phenotype-org-audits`: "docs(phenotype-org-audits): add HwLedger reclassification record"; the reclassification record is part of the audit (P52-style entry) so future audits see the disposition | P0 | orchestrator | T5.1-T5.3 | PR opened; record at `phenotype-org-audits/audits/hwledger-reclassification-2026-06-17.md`; index updated |

**Track 5 PR count: 4** (ADR-029 + HwLedger archive PR + `phenotype-org-audits` reclassification record + AGENTS.md bucket-change PR — wait, AGENTS.md PR is part of T1.5, not separate. Re-count: T5.1 is 1 ADR (governance-doc PR), T5.3 is 1 HwLedger PR, T5.4 is 1 phenotype-org-audits PR, plus a decision doc PR for T5.2 = 4 PRs.)

**Parallelism within Track 5:** T5.1 → T5.2 (sequential dependency). T5.3 (archive) can start in parallel with T5.4 (record) once T5.1-T5.2 are decided; both depend on T5.1's ADR being written.

### 3.6 Track 6 — Rebase + Push Cleaned Branch (P0, ~5 min, orchestrator)

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T6.1** | Rebase current branch `chore/l5-87-focus-repo-specs-2026-06-11` onto `origin/main`; resolve any conflicts (low risk: branch is 0 commits ahead per wrap-up, but the T1-T5 PRs may have updated main) | P0 | orchestrator | T1-T5 all done | `git rebase origin/main` exits 0; `git log --oneline -5` shows clean history |
| **T6.2** | Run pre-push checks: `HOOKS_SKIP=0` (deliberately re-enable hooks) `git push --dry-run`; verify no lefthook/pre-commit failures | P0 | orchestrator | T6.1 | Dry-run shows expected refs; no `rc=124` lefthook config-missing; no pre-commit failures |
| **T6.3** | Push to `origin/chore/l5-87-focus-repo-specs-2026-06-11` (orchestrator's own working branch, not T1-T5 PRs which are already in their target repos) | P0 | orchestrator | T6.2 | `git push origin chore/l5-87-focus-repo-specs-2026-06-11` exits 0; `git ls-remote --heads origin chore/l5-87-focus-repo-specs-2026-06-11` shows the updated SHA |

**Track 6 PR count: 0** (this is a direct push, not a PR — the orchestrator's working branch is the meta-tracking branch, not a deliverable)

**Parallelism within Track 6:** None — fully sequential by definition.

### 3.7 Track 7 — Work DAG Maintenance (ongoing, orchestrator)

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T7.1** | Live-update `findings/71-pillar-2026-06-17.md` (Track 3) as per-repo scores come in from the parallel forge subagents | P1 | orchestrator | T3.2 partial results | Scorecard reflects all 10 probed repos within 5 min of subagent completion |
| **T7.2** | Live-update `plans/2026-06-17-v7-dag-stable.md` (this file) on any track-state change (DONE / BLOCKED / IN_PROGRESS) | P1 | orchestrator | any track event | This file's `## Status` line is current; section markers reflect latest state |
| **T7.3** | Update AGENTS.md § "Wave Plan" pointer from v6 to v7 with cross-link to this file (already done 2026-06-17 12:00 PDT; verify) | P0 | orchestrator | none | `grep -c 'plans/2026-06-17-v7-dag-stable.md' AGENTS.md` returns ≥ 2 |
| **T7.4** | Update `work-dag-2026-06-17-wrapup.md` with the 5 WIP landing outcomes (when T2.1-T2.5 land) | P1 | orchestrator | T2.1-T2.5 done | Wrap-up DAG § "Stream A/B/C" updated: T7, T11, etc. marked "DONE (landed in v7 T2.x)" |
| **T7.5** | Update `work-dag-2026-06-17-v7-extended.md` with the v7 PR landing outcomes (when T2.6-T2.9 land) | P1 | orchestrator | T2.6-T2.9 done | v7-extended DAG § "TRACK A/B" updated: A1-A4 marked "DONE (landed in v7 T2.x)"; B1-B4 marked "DONE" |
| **T7.6** | Weekly Monday 09:00 PDT refresh: re-probe all 10 repos, compute delta, write `findings/71-pillar-{date}-delta.md` | P1 | orchestrator | cron / next Monday | Delta file exists; ✓/△/⚠ counts compared to baseline |

**Track 7 PR count: 0** (live doc maintenance; no PRs)

**Parallelism within Track 7:** All 6 sub-tasks are independent and can run at any time during v7.

### 3.8 Track 8 — Dmouse92 → KooshaPari Migration (P0, DONE 2026-06-17 20:55 PDT, L5-104/ADR-029)

**User directive (2026-06-17):** *"focus solely on the dmouse92 aspects of work — merge all over to kooshapari → then reconcile/absorb to proper repos. e.g. dispatch-mcp should be deleted as it needs to have all remaining work fully absorbed to substrate (The ver on kooshapari had this done yesterday, repeat for any dmouse additions worthwhile to migrate)."*

**Approach:** Substrate-absorption (per ADR-013/022/023) — port the substrate-worthy content of each Dmouse92 repo to the canonical KooshaPari substrate, archive the Dmouse92 repo.

| Task | Description | P-level | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **T8.1** | Discovery: list all 26 Dmouse92 repos; cross-reference with KooshaPari to find 20 Phenotype-related | P0 | orchestrator | none | `gh repo list Dmouse92 --limit 200` returns 26; cross-ref matrix built |
| **T8.2** | Per-cluster analysis: 4 parallel forge subagents (dispatch-mcp / pheno ADR-012 / 14 bulk / forgecode) | P0 | 4 forge subagents | T8.1 | 4 sub-plans written: dispatch-mcp (527 lines), pheno-ADR-012 (414 lines), bulk-rust-ts (999 lines), forgecode (305 lines) |
| **T8.3** | Substrate publication: `pheno-mcp-router` (local-only) → `KooshaPari/pheno-mcp-router` (public) | P0 | subagent E | T8.2 | `gh api repos/KooshaPari/pheno-mcp-router` returns 200; default branch = `chore/l3-57-pheno-plugin-registry-2026-06-11` |
| **T8.4** | Substrate ports: 6 modules (`tiers/cost/budget/quota/audit/cost_middleware.py`) → `pheno-mcp-router/src/pheno_mcp_router/` | P0 | subagent E | T8.3 | PR [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) opened; 187/187 tests pass |
| **T8.5** | Substrate adapters: `LlamaAdapter` (LlmPort) + `OpenAICompatAdapter` (LlmPort) | P0 | subagent E | T8.3 | PR [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) + PR [#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) opened |
| **T8.6** | Cherry-pick w1-1 deprecation doc to dispatch-mcp | P0 | subagent E | none | PR [dispatch-mcp#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) opened; 1 file +22 |
| **T8.7** | Port CANONICAL.md markers + SLSA doc to phenotype-config substrate | P0 | subagent F | none | PR [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) opened; 2 CANONICAL.md + docs/slsa.md |
| **T8.8** | Port docker files to phenotype-ops (federated service per ADR-023) | P0 | subagent E | none | PR [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) opened; Dockerfile + compose + README |
| **T8.9** | Archive 18 Dmouse92 repos via Dmouse92 auth | P0 | orchestrator | T8.4-T8.8 | `gh auth switch --user Dmouse92`; `gh repo archive` for all 20 Phenotype-related Dmouse92 repos (2 already archived: PhenoProc, Nanovms on KP) |
| **T8.10** | Update governance docs (AGENTS.md + STATUS.md + SSOT.md) with ADR-029 + migration section | P0 | orchestrator | T8.9 | All 3 docs updated; ADR count 28 → 29 |

**Track 8 PR count: 6** (T8.4 + T8.5×2 + T8.6 + T8.7 + T8.8)

**Parallelism within Track 8:** T8.2 (4 parallel subagents), T8.3 (publish substrate, blocking for T8.4-T8.5), T8.6-T8.8 (independent, can run parallel), T8.9 (auth switch, single orchestrator), T8.10 (governance docs).

**Result:** 6 PRs opened on KooshaPari, 18 Dmouse92 repos archived, 0 net content loss. ADR-029 ratified.

**Audit doc:** `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (364 lines) — full cross-reference matrix + decision matrix + execution log.

---

## 4. Topological Sort

### 4.1 Phases (wall-clock order)

```
Phase 0 (t=0, parallel):
  ├─ T1.1 (drop stashes)
  ├─ T1.2 (delete empty branches)
  ├─ T3.1 (71-pillar schema doc)
  ├─ T3.7 (ADR-025 worklog v2.1, independent)
  ├─ T4.1 (worklog-schema Python update)
  └─ T7.3 (AGENTS.md § Wave Plan pointer — already done)

Phase 1 (t=0..5min, parallel):
  ├─ T1.3 (meta-bundle commit, depends on T1.1, T1.2)
  ├─ T3.2 (probe script, depends on T3.1)
  ├─ T4.2 (validator, depends on T4.1)
  └─ T7.x (live updates as events occur)

Phase 2 (t=5..10min, parallel):
  ├─ T1.4 (governance doc refresh, depends on T1.3)
  ├─ T1.5 (open PR for governance, depends on T1.4)
  ├─ T1.6 (open 5 PRs for meta-bundle, depends on T1.3)
  ├─ T1.7 (open PR for HOOKS_SKIP spec, depends on T1.4)
  ├─ T2.1 (AgilePlus SPDX WIP, depends on T1.1)
  ├─ T2.2 (pheno adapter refactor WIP, depends on T1.1)
  ├─ T2.3 (pheno adr-012 import WIP, depends on T1.1)
  ├─ T2.4 (dispatch-mcp W2-1 WIP, depends on T1.1)
  ├─ T2.5 (AgilePlus brand-rename decision, depends on T1.1)
  ├─ T2.6 (monorepo strand B1, depends on T5 substrate decision — T5 not started yet, so DEFER to Phase 3)
  ├─ T3.3 (scorecard, depends on T3.2 partial)
  ├─ T3.5 (L1-L30 → L1-L71 crosswalk, depends on T3.1)
  ├─ T3.9 (ADR-027 LFS 3-tier, depends on T3.2 L66 evidence)
  └─ T4.3 (migrate 2 exemplar worklogs, depends on T4.2)

Phase 3 (t=10..20min, parallel):
  ├─ T2.7 (l4-80-wt worklog, depends on T2.x — independent of T2.6)
  ├─ T2.8 (l4-68 pheno-context, depends on T5 substrate decision)
  ├─ T2.9 (audit-30pillar strand B4, depends on T2.6 — sequenced)
  ├─ T3.4 (render scorecard, depends on T3.3)
  ├─ T3.6 (ADR-024, depends on T3.1-T3.5)
  ├─ T3.8 (ADR-026, depends on T3.1)
  ├─ T3.10 (ADR-028, depends on T3.9)
  └─ T4.4 (open PR for worklog v2.1, depends on T4.3)

Phase 4 (t=20..30min, parallel):
  ├─ T5.1 (ADR-029 HwLedger, depends on T3.6, T3.10)
  ├─ T5.2 (substrate placement decision, depends on T5.1)
  └─ T6.1 (rebase, depends on T1-T5 all done — so DEFER to Phase 5)

Phase 5 (t=30..35min, parallel):
  ├─ T5.3 (archive HwLedger, depends on T5.2)
  ├─ T5.4 (phenotype-org-audits record, depends on T5.1-T5.3)
  └─ T2.6 (monorepo strand B1, NOW unblocked by T5.1 substrate decision)
  └─ T2.8 (pheno-context, NOW unblocked by T5.1)

Phase 6 (t=35..40min, serial):
  ├─ T6.1 (rebase)
  ├─ T6.2 (pre-push check)
  └─ T6.3 (push)

Phase 7 (t=40..120min, ongoing, parallel):
  └─ T7.1-T7.6 (live updates, weekly refresh)
```

### 4.2 Critical Path

```
T1.1 (drop stashes) → T1.3 (meta-bundle) → T1.6 (open 5 PRs)
                                            ↘
T3.1 (schema) → T3.2 (probe) → T3.3 (scorecard) → T3.4 (render)
                                                              ↘
                                                  T3.6 (ADR-024)
                                                              ↘
                                                  T5.1 (ADR-029) → T5.2 → T5.3 → T5.4
                                                                                  ↘
                                                                       T6.1 → T6.2 → T6.3
```

**Critical path length:** T1.1 → T1.3 → T1.6 (5min) + T3.1 → T3.2 → T3.3 → T3.4 → T3.6 → T5.1 → T5.2 → T5.3 → T5.4 (25min) + T6.1 → T6.2 → T6.3 (5min) = **~35 min** for the critical path with parallelism.

### 4.3 Parallelism Matrix

| Track | Internal parallelism? | Notes |
|---|---|---|
| **T1** | **Yes (partial)** | T1.1, T1.2 are parallel; T1.3 sequential after both; T1.4-T1.7 can run in parallel with T1.3 |
| **T2** | **Yes (full)** | T2.1-T2.4 dispatched to 4 parallel forge subagents; T2.5 orchestrator-only; T2.6-T2.9 dispatched in parallel with sequencing for T2.6→T2.9 (same target repo) |
| **T3** | **Yes (full)** | T3.1 is the schema doc (single); T3.2 probes dispatched to 10 parallel subagents (one per repo); T3.7 (ADR-025) is independent and runs from t=0; T3.8-T3.10 (ADRs) can be drafted in parallel |
| **T4** | **No** | Fully sequential: T4.1 → T4.2 → T4.3 → T4.4 (the 2 exemplar worklog migrations in T4.3 can be 1 commit) |
| **T5** | **Yes (partial)** | T5.1 → T5.2 sequential (decision); T5.3 + T5.4 parallel after T5.2; T5.3 dispatches 1 subagent for multi-step archive |
| **T6** | **No** | Fully serial by definition |
| **T7** | **Yes (full)** | All 6 sub-tasks independent; live updates |

**Tracks with internal parallelism: 5 of 7** (T1 partial, T2 full, T3 full, T5 partial, T7 full)

### 4.4 Cross-Track Parallelism

| Time window | Parallel tracks running |
|---|---|
| t=0..5min | T1.1 + T1.2 + T3.1 + T3.7 + T4.1 + T7.3 (6 streams) |
| t=5..10min | T1.3 + T1.4 + T3.2 + T4.2 + T7.x (5 streams) |
| t=10..20min | T1.5 + T1.6 + T1.7 + T2.1 + T2.2 + T2.3 + T2.4 + T2.5 + T3.3 + T3.5 + T3.9 + T4.3 (12 streams) |
| t=20..30min | T2.7 + T3.4 + T3.6 + T3.8 + T3.10 + T4.4 (6 streams) |
| t=30..35min | T5.1 + T5.2 + T2.6 + T2.8 (4 streams) |
| t=35..40min | T5.3 + T5.4 (2 streams) |
| t=40..45min | T6.1 + T6.2 + T6.3 (1 stream, 3 sequential steps) |
| t=45..∞ | T7.1-T7.6 (6 streams, ongoing) |

**Maximum parallelism: 12 streams at t=10..20min.**

---

## 5. PR Matrix

All 38 PRs across 8 tracks. PR# column uses estimated GitHub PR numbers (KooshaPari/<repo>); actual numbers assigned on PR-open.

| PR# | Title | Repo | Track | Status | Owner | Subagent |
|---|---|---|---|---|---|---|
| **PR-129** | chore(license): add SPDX-License-Identifier to 541 source files | `KooshaPari/AgilePlus` | T2.1 | PENDING | orchestrator | forge-1 |
| **PR-130** | chore(pheno-cli): refactor GetAdapter signature and add error variants | `KooshaPari/pheno` | T2.2 | PENDING | orchestrator | forge-2 |
| **PR-131** | chore(pheno): import adr-012 from Dmouse92 fork (historical preservation) | `KooshaPari/pheno` | T2.3 | PENDING | orchestrator | forge-3 |
| **PR-132** | feat(dispatch-mcp): W2-1 protocol compliance (imported from Dmouse92 fork) | `KooshaPari/dispatch-mcp` | T2.4 | PENDING | orchestrator | forge-4 |
| **PR-133** | (do-not-merge) chore(AgilePlus): preserve wip/preserve-agileplus-brand-rename-20260605 | `KooshaPari/AgilePlus` | T2.5 | PENDING (decision-only) | orchestrator | — |
| **PR-134** | docs(phenotype-org-audits): cherry-pick monorepo w5-adrs-sota commits (d83900c4a7) | `KooshaPari/phenotype-org-audits` | T2.6 | PENDING | orchestrator | — |
| **PR-135** | docs(phenotype-otel): re-commit L4-080 worklog (recovered from /private/tmp/l4-80-wt) | `KooshaPari/phenotype-otel` | T2.7 | PENDING | orchestrator | — |
| **PR-136** | feat(phenoShared): add pheno-context crate (recovered from .worktrees/l4-68-pheno-context-2026-06-11) | `KooshaPari/phenoShared` | T2.8 | PENDING | orchestrator | — |
| **PR-137** | chore(phenotype-org-audits): import 30-pillar fleet audit (484 commits, 30 files) | `KooshaPari/phenotype-org-audits` | T2.9 | PENDING | orchestrator | — |
| **PR-138** | docs(71-pillar): schema (9 domains, L1-L71, 0-3 scoring) | `KooshaPari/phenotype-org-audits` (per ADR-028) | T3.1 | PENDING | orchestrator | — |
| **PR-139** | feat(71-pillar): probe script + per-repo probe results (top-10 repos) | `KooshaPari/phenotype-org-audits` | T3.2 | PENDING | orchestrator | 10x forge subagents (per-repo) |
| **PR-140** | docs(71-pillar): live scorecard across 10 repos | `KooshaPari/phenotype-org-audits` | T3.3 | PENDING | orchestrator | — |
| **PR-141** | docs(71-pillar): render scorecard as markdown tables + ASCII heatmap | `KooshaPari/phenotype-org-audits` | T3.4 | PENDING | orchestrator | — |
| **PR-142** | docs(71-pillar): L1-L30 → L1-L71 crosswalk | `KooshaPari/phenotype-org-audits` | T3.5 | PENDING | orchestrator | — |
| **PR-143** | docs(adr): ADR-024 71-pillar audit framework (L1-L71, 9 domains) | `KooshaPari/repos` (or `phenotype-org-audits`) | T3.6 | PENDING | orchestrator | — |
| **PR-144** | docs(adr): ADR-025 worklog v2.1 schema (add device: field) | `KooshaPari/repos` (or `phenotype-org-audits`) | T3.7 | PENDING | orchestrator | — |
| **PR-145** | docs(adr): ADR-026 Factory AI Agent Readiness (cross-cutting) | `KooshaPari/repos` (or `phenotype-org-audits`) | T3.8 | PENDING | orchestrator | — |
| **PR-146** | docs(adr): ADR-027 git LFS 3-tier policy (closes L66) | `KooshaPari/repos` (or `phenotype-org-audits`) | T3.9 | PENDING | orchestrator | — |
| **PR-147** | docs(adr): ADR-028 monorepo hybrid-with-staging-repo (closes L25) | `KooshaPari/repos` (or `phenotype-org-audits`) | T3.10 | PENDING | orchestrator | — |
| **PR-148** | feat(worklog-schema): bump v2.0 → v2.1 (add device: field per ADR-025) | `KooshaPari/pheno-worklog-schema` | T4.1 | PENDING | orchestrator | — |
| **PR-149** | feat(worklog-schema): validator enforces v2.1, warns on v2.0 | `KooshaPari/pheno-worklog-schema` | T4.2 | PENDING | orchestrator | — |
| **PR-150** | chore(worklog): migrate L5-101-app-governance-2026-06-15.json to v2.1 | `KooshaPari/pheno` | T4.3a | PENDING | orchestrator | — |
| **PR-151** | chore(worklog): migrate L5-102-71-pillar-audit-2026-06-17.json to v2.1 | `KooshaPari/pheno` | T4.3b | PENDING | orchestrator | — |
| **PR-152** | docs(adr): ADR-029 HwLedger reclassification (PAUSED + archival per ADR-023 Rule 3) | `KooshaPari/repos` (or `phenotype-org-audits`) | T5.1 | PENDING | orchestrator | — |
| **PR-153** | docs(hwledger): substrate placement decision — no extraction (L1=0, L2=10) | `KooshaPari/HwLedger` | T5.2 | PENDING | orchestrator | — |
| **PR-154** | chore(hwledger): archive repo (ADR-029); README points to ADR-029 | `KooshaPari/HwLedger` | T5.3 | PENDING | orchestrator | forge-5 (multi-step archive) |
| **PR-155** | docs(phenotype-org-audits): add HwLedger reclassification record (2026-06-17) | `KooshaPari/phenotype-org-audits` | T5.4 | PENDING | orchestrator | — |
| **PR-156** | chore(governance): refresh AGENTS.md + STATUS.md + SSOT.md (v7 triage) | `KooshaPari/repos` (or `phenotype-org-audits`) | T1.5 | PENDING | orchestrator | — |
| **PR-157** | chore(meta): add AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT (5 repos) | `KooshaPari/pheno-config` | T1.6a | PENDING | orchestrator | — |
| **PR-158** | chore(meta): add meta-bundle to pheno-context | `KooshaPari/pheno-context` | T1.6b | PENDING | orchestrator | — |
| **PR-159** | chore(meta): add meta-bundle to pheno-otel | `KooshaPari/pheno-otel` | T1.6c | PENDING | orchestrator | — |
| **PR-160** | chore(meta): add meta-bundle to pheno-port-adapter | `KooshaPari/pheno-port-adapter` | T1.6d | PENDING | orchestrator | — |
| **PR-161** | chore(meta): add meta-bundle to pheno-tracing | `KooshaPari/pheno-tracing` | T1.6e | PENDING | orchestrator | — |
| **PR-162** | docs(ci): document HOOKS_SKIP=1 and SKIP= env vars (per P47) | `KooshaPari/phenotype-tooling` | T1.7 | PENDING | orchestrator | — |
| **PR-163** | feat(cost): port tiers/cost/budget/quota/audit/cost_middleware from dispatch-mcp W2-1 (L5-104.1) | `KooshaPari/pheno-mcp-router` | T8.4 | **OPEN** [#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) | subagent E | forge-subagent-E |
| **PR-164** | feat(adapters): add LlamaAdapter (LlmPort) — server + direct modes (L5-104.1) | `KooshaPari/pheno-mcp-router` | T8.5a | **OPEN** [#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) | subagent E | forge-subagent-E |
| **PR-165** | feat(adapters): add OpenAICompatAdapter (LlmPort) — 429/5xx retry + 17 tests (L5-104.1) | `KooshaPari/pheno-mcp-router` | T8.5b | **OPEN** [#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) | subagent E | forge-subagent-E |
| **PR-166** | feat(docs): port CANONICAL.md markers + SLSA doc from pheno ADR-012 (L5-104.2) | `KooshaPari/phenotype-config` | T8.7 | **OPEN** [#1](https://github.com/KooshaPari/phenotype-config/pull/1) | subagent F | forge-subagent-F |
| **PR-167** | feat(devops): add llama-cpp docker setup (Dockerfile + compose) (L5-104.1) | `KooshaPari/phenotype-ops` | T8.8 | **OPEN** [#2](https://github.com/KooshaPari/phenotype-ops/pull/2) | subagent E | forge-subagent-E |
| **PR-168** | docs: cherry-pick cheap-llm-mcp deprecation notice (W1.1, ADR-008) | `KooshaPari/dispatch-mcp` | T8.6 | **OPEN** [#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) | subagent E | forge-subagent-E |

**Total: 38 PRs** (re-counted from the matrix: 9 in T2 + 10 in T3 + 4 in T4 + 4 in T5 + 7 in T1 [1 governance + 5 meta + 1 ci-spec] + 6 in T8 = 40. Wait — recount: T1 = 1 + 5 + 1 = 7; T2 = 9; T3 = 10; T4 = 4; T5 = 4; T6 = 0; T7 = 0; T8 = 6. Total = 7+9+10+4+4+0+0+6 = **40 PRs** in the matrix. The § 2 headline of "38" is the **operationally meaningful** count. The matrix reports 40 to include the do-not-merge decision PR #133 and the ci-spec PR #162. **Reconciliation: 40 PRs in the matrix; § 2 reports "38 PRs" as the rounded target. Authoritative count is 40 per the matrix.**)

---

## 6. Risk Register

| # | Risk | Probability | Impact | Score (P×I, 1-9) | Mitigation |
|---|---|---|---|---|---|
| **R1** | `task` tool / forge subagent dispatch fails mid-execution (recurrence of 2026-06-14 RESUME wave 40/40 failure mode) | Medium (3) | High (3) | **9** | Track 5 (gate equivalent) — confirm `forge -p "echo test" -C /tmp` returns 0 in the first 30 sec of v7 launch; if it fails, all T2.x and T3.2 (probe) subagent dispatches fall back to direct orchestrator execution. See `plans/2026-06-15-v6-dag-stable.md:97-112` for the v6 gate pattern. |
| **R2** | Strand-recovery PRs (T2.6-T2.9) collide with each other (T2.6 + T2.9 both target `phenotype-org-audits`; T2.8 depends on T5.1 substrate decision; merge conflicts likely) | High (3) | Medium (2) | **6** | Sequence T2.6 → T2.9 (T2.6 first, T2.9 second). T2.8 deferred to Phase 5 (after T5.1 lands). Each strand PR is 1 commit, so rebase cost is low. |
| **R3** | HwLedger archival (T5.3) hits the same `gh repo archive` issue that hit `phenotype-monorepo` (no `delete_repo` scope per P34) | Low (1) | Medium (2) | **2** | Use `gh repo archive --yes` (archive is permitted; only `delete` requires `delete_repo` scope). Fallback: if archive also fails, document in `findings/HWLEDGER-ARCHIVE-FAIL-2026-06-17.md` and escalate to user. |
| **R4** | 71-pillar probe (T3.2) produces inconsistent scores across the 10 parallel forge subagents (different subagents use different heuristics for "minimal" vs "adequate") | Medium (2) | High (3) | **6** | Probe script (`scripts/71-pillar-probe.py`) is the single source of truth for scoring logic; subagents only run the script, not interpret. Pre-flight: orchestrator runs the probe on 1 repo locally and pins the expected output before dispatching to subagents. |
| **R5** | Worklog v2.1 schema bump (T4.1) lands late (after 2026-06-22 deprecation) — many in-flight worklogs would be in v2.0, blocking the device-fit gate | Low (1) | High (3) | **3** | T4.1-T4.4 are the highest-priority items in Track 4; due date 2026-06-22 = 5 days from 2026-06-17, well within schedule. If T4 slips, the existing v2.0 worklogs continue to validate (backward compat) per T4.2 (warn, not error). |
| **R6** | Monorepo strand B1 (T2.6) re-push fails due to LFS error (the original wrap-up failure mode) | Medium (2) | High (3) | **6** | T3.9 (ADR-027 git LFS 3-tier policy) is the C1 unblock from `work-dag-2026-06-17-v7-extended.md`. T2.6 is sequenced to Phase 5, **after** T3.9 lands. LFS config: `git config lfs.allowincompletepush true` set on the worktree before push. |
| **R7** | Rebase (T6.1) hits conflicts because T1-T5 PRs have updated `main` with overlapping changes | Medium (2) | Medium (2) | **4** | The orchestrator's working branch (`chore/l5-87-focus-repo-specs-2026-06-11`) is 0 commits ahead per wrap-up; conflicts are unlikely. If conflicts arise, `git rebase --abort` and re-strategize. |
| **R8** | All 5 ADRs (T3.6-T3.10, T5.1) require governance review and may be challenged by user as a "wave of paper" | Low (1) | Medium (2) | **2** | Each ADR is short (1-page max per AGENTS.md § "Quality bar for new substrate"), has evidence pointers, and supersedes a prior decision or closes a known gap (L25, L66). Group as a single "ADRs batch PR" for efficient review. |
| **R9** | 4 stranded worktrees (`/private/tmp/l4-80-wt`, `.worktrees/audit-30pillar`, `.worktrees/l4-68-pheno-context-2026-06-11`, plus 1 implicit `repos/.git` worktree) are lost before T2.6-T2.8 can recover them | Medium (2) | High (3) | **6** | T1.1 / T1.2 do not touch the worktrees; recovery (T2.6-T2.8) is in Phase 2 (t=10..20min) — well before any risk of loss. `/private/tmp/l4-80-wt` is the only `/tmp` worktree and is most at risk; pushed first (T2.7). |
| **R10** | 4 WIP landing PRs (PR-129..PR-132) hit CI failures that require code changes (not just header/SPDX/import) | Medium (2) | Medium (2) | **4** | Each subagent is scoped to "review and report; do not modify"; if CI fails, orchestrator assesses and decides. Fallback: convert PR to draft, document, defer to next wave. |

**Top 3 risks by P×I score:**

1. **R1 (subagent dispatch failure)** — P×I = 9. The most critical risk: if subagent dispatch fails, the parallel-execution plan collapses to sequential (~5h instead of ~2h). The v6 gate pattern (Track 5) is the mitigation, but v7 has no equivalent gate — **a Track 0 gate should be added pre-launch** (out of scope for v7's 7 tracks, but noted here).
2. **R4 (probe score inconsistency)** — P×I = 6. The 71-pillar framework's value depends on consistent scoring; if 10 parallel subagents produce inconsistent scores, the scorecard is unreliable. The single-source-of-truth probe script mitigates this.
3. **R6 (LFS error on monorepo re-push)** — P×I = 6. The original wrap-up failure mode could recur. Sequencing T2.6 after T3.9 (LFS 3-tier policy) is the mitigation.

(Tied at P×I = 6: R2, R6, R9. Tied at P×I = 4: R7, R10. R3, R5, R8 are lower.)

---

## 7. Success Criteria

v7 is "done" when **all** of the following are true:

| # | Criterion | Measurement | Target |
|---|---|---|---|
| **SC-1** | All 34 PRs in § 5 are opened and merged (or explicitly do-not-merged with documentation) | `gh pr list --state all --limit 100` per repo | 34/34 |
| **SC-2** | 71-pillar scorecard is live for the top-10 repos with all 71 pillars scored | `findings/71-pillar-2026-06-17.md` exists with 10 × 71 = 710 cells | 10/10 repos, 71/71 pillars |
| **SC-3** | L1-L30 → L1-L71 crosswalk is published; no orphan pillars from the older 30-pillar audit | `findings/71-pillar-2026-06-17-mapping.md` covers all 30 old pillars | 30/30 mapped |
| **SC-4** | Worklog v2.1 schema is published in `pheno-worklog-schema`; v2.0 is deprecated 2026-06-22; ≥ 2 exemplar worklogs migrated | `pheno-worklog-schema` version 0.3.0; `pip install pheno-worklog-schema` exits 0; `pheno-worklog-schema validate` returns 0 on v2.1 | 0.3.0 published; 2/2 migrated |
| **SC-5** | HwLedger is archived; ADR-029 is in `docs/adr/2026-06-17/INDEX.md`; bucket in AGENTS.md is `PAUSED` | `gh api repos/KooshaPari/HwLedger` → `"archived": true` | archived |
| **SC-6** | Orchestrator's working branch (`chore/l5-87-focus-repo-specs-2026-06-11`) is rebased onto `main` and pushed | `git rev-list --left-right --count origin/main...HEAD` shows 0 ahead | 0 ahead |
| **SC-7** | 4 stranded worktrees are recovered (T2.6-T2.9 PRs merged) | All 4 strands have a landed PR | 4/4 recovered |
| **SC-8** | AGENTS.md § "Wave Plan" pointer is current; v7 is the active plan | `grep 'plans/2026-06-17-v7-dag-stable.md' AGENTS.md` returns ≥ 2 | ≥ 2 hits |
| **SC-9** | Work DAG files (`work-dag-2026-06-17-wrapup.md`, `work-dag-2026-06-17-v7-extended.md`) reflect v7 PR landing outcomes | Both DAGs have T7/T11/A1-A4/B1-B4 marked "DONE (landed in v7 T2.x)" | All updated |
| **SC-10** | 5 ADRs (ADR-024, ADR-025, ADR-026, ADR-027, ADR-028) are in `docs/adr/2026-06-17/` with INDEX.md entries; AGENTS.md § "Active ADRs" is updated | `ls docs/adr/2026-06-17/ADR-02{4,5,6,7,8}-*.md` returns 5 files | 5/5 ADRs |
| **SC-11** | Wall-clock time: 2h with 4-way parallelism, 5h sequential (matches § 2 estimate) | Time elapsed from v7 launch to SC-1 | ≤ 2h parallel / ≤ 5h sequential |
| **SC-12** | No new stranded worktrees; no new orphan PRs; no force-pushes | `git worktree list` shows 0 stranded; `gh pr list --state open --limit 100` shows all v7 PRs in expected repos | 0 new strands |

**Aggregate done-criterion:** SC-1 (all PRs landed) AND SC-2 (71-pillar live) AND SC-5 (HwLedger archived) AND SC-6 (branch pushed). The other 8 criteria are quality bars.

---

## 8. Cross-References

### 8.1 AGENTS.md (parent governance)

- **AGENTS.md § "Wave Plan (v7 — current, supersedes v6)"** (lines 128-138) — high-level v7 plan overview
- **AGENTS.md § "Active ADRs"** (lines 78-125) — 28 ADRs as of 2026-06-17 12:00 PDT; this plan adds 1 more (ADR-029)
- **AGENTS.md § "71-pillar audit (this turn)"** (lines 205-225) — 9 domains, 71 pillars, scoring rubric
- **AGENTS.md § "App-level repo triage & app substrate placement (ADR-023)"** (lines 152-201) — HwLedger reclassification authority
- **AGENTS.md § "Factory AI Agent Readiness (external cross-cutting, ADR-026, this turn)"** (lines 229-239) — T3.8 authority
- **AGENTS.md § "Stale / warnings"** (lines 243-251) — known 2 stashes, 4 empty branches, ADR-015 v2.1 deprecation date
- **AGENTS.md § "Related"** (lines 254-271) — pointer to this v7 plan file

### 8.2 The 5 ADRs (this plan's governance backbone)

- **ADR-024** (T3.6) — `docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md` — 9-domain, 71-pillar canonical
- **ADR-025** (T3.7, T4.1-T4.4) — `docs/adr/2026-06-17/ADR-025-worklog-v2-1-schema.md` — worklog v2.1 (deprecation 2026-06-22)
- **ADR-026** (T3.8) — `docs/adr/2026-06-17/ADR-026-factory-ai-agent-readiness.md` — external cross-cutting standard
- **ADR-027** (T3.9) — `docs/adr/2026-06-17/ADR-027-git-lfs-3-tier-policy.md` — closes L66
- **ADR-028** (T3.10) — `docs/adr/2026-06-17/ADR-028-monorepo-hybrid-with-staging.md` — closes L25; staging repo = `phenotype-org-audits`
- **ADR-029** (T5.1, new in this plan) — `docs/adr/2026-06-17/ADR-029-hwledger-reclassification.md` — HwLedger PAUSED+archival

Plus the prior ADRs that v7 references but does not modify:
- **ADR-015** — worklog v2.0 (superseded by ADR-025 v2.1)
- **ADR-023** — agent-effort governance (T5 HwLedger authority)

### 8.3 The 71-pillar docs (T3 outputs)

- **`findings/71-pillar-2026-06-17-schema.md`** (T3.1) — full 9-domain, 71-pillar schema
- **`findings/71-pillar-2026-06-17-probe.md`** (T3.2) — probe script + per-repo probe results
- **`findings/71-pillar-2026-06-17.md`** (T3.3) — live scorecard (refreshed weekly)
- **`findings/71-pillar-2026-06-17-render.md`** (T3.4) — human-readable render
- **`findings/71-pillar-2026-06-17-mapping.md`** (T3.5) — L1-L30 → L1-L71 crosswalk
- **`findings/30-pillar-2026-06-16.md`** (older, superseded) — 30-pillar audit that v7's 71-pillar framework supersedes
- **`audit-71-pillar-2026-06-17-wrapup.md`** (wrap-up doc, 479 lines) — comprehensive 71-pillar audit with evidence pointers
- **`findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md`** (older, 6-domain version) — superseded by AGENTS.md's 9-domain framework
- **`findings/2026-06-17-L5-102-71-pillar-audit.md`** (ADR-024 decision log) — to be created in T3.6

### 8.4 The work-dag files

- **`work-dag-2026-06-17-wrapup.md`** (T7.4 input) — wrap-up DAG with N01-N09 nodes; T7, T11 outcomes feed T2.1-T2.5
- **`work-dag-2026-06-17-v7-extended.md`** (T7.5 input) — v7+ extended DAG with Tracks A-E; A1-A5 → T2.1-T2.5, B1-B4 → T2.6-T2.9, C1-C2 → T3.9 + T3.10, D1-D4 → deferred to v8, E1-E4 → T3.6-T3.10 (overlap with this plan)
- **`findings/2026-06-17-WRAPUP-WORK-DAG.md`** (companion to wrap-up DAG) — N01-N09 status with evidence pointers
- **`findings/2026-06-17-WRAPUP-PUSH-AUDIT.md`** (P31-P71 audit) — evidence for ADR-024 scorecard

### 8.5 Other referenced files

- **`plans/2026-06-15-v6-dag-stable.md`** (v6, superseded) — 5 tracks, 21 PRs, the v6 gate pattern (R1 mitigation reference)
- **`docs/adr/2026-06-15/`** (prior ADR wave) — ADR-001 through ADR-023, ADR-001..028 index at `docs/adr/2026-06-15/INDEX.md`
- **`L6_PHENO_REPOS_HEALTH_2026_06_14.md`** + **`L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md`** — pheno-* repos health inventory
- **`STATUS.md`** (T1.4 + T7.3 input) — current state of monorepo
- **`SSOT.md`** (T1.4 + T1.7 input) — single source of truth for repo conventions; gets HOOKS_SKIP=1 spec in T1.4
- **`HwLedger/AGENTS.md`** (T5.1 input) — current HwLedger governance doc
- **`HwLedger/audit_scorecard.json`** (T5.2 input) — current HwLedger audit (overall 50/100, grade D+)

### 8.6 Conventions

- **Branch naming:** `chore/<req-id>-<slug>-<date>` for chore; `feat/<req-id>-<slug>-<date>` for features
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`)
- **PR labels:** `governance` for cleanup, `L<n>-#<n>` for tracking
- **SOTA artifacts:** `findings/`, `plans/`, `worklogs/`, `docs/adr/<date>/`
- **Meta-bundle:** `AGENTS.md` + `llms.txt` + `WORKLOG.md` + `CHANGELOG.md` + `LICENSE-MIT` (per AGENTS.md § "Conventions")

---

## Appendix A — Why v7 supersedes v6

| Plan | Source | Status | Why v7 wins |
|---|---|---|---|
| v3 | `FLEET_100TASK_DAG_V3.md:1-725` (100+20 tasks) | Deferred 2026-06-10 by session credit ceiling | Too large; no gate |
| v4 | `plans/2026-06-14-dag-v4.md` (20×5 = 100 tasks) | Narrative only; never executed | Relied on broken subagent dispatch |
| v5 | `plans/2026-06-15-CONSOLIDATED-DAG-V5.md` (20×6 = 120 tasks) | Authored but not launched | Larger than v4; same dispatch dependency |
| **v6** | `plans/2026-06-15-v6-dag-stable.md` (5 tracks, 21 PRs) | SPEC READY 2026-06-15 01:05 PDT; superseded by v7 2026-06-17 | v6 was orchestrator-only; v7 adds parallel forge subagent dispatch for T2 (WIP landing) and T3 (probe); v7 also delivers the 71-pillar framework (ADR-024) and the worklog v2.1 bump (ADR-025) which v6 deferred |
| **v7 (this)** | AGENTS.md § "Wave Plan (v7 — current, supersedes v6)" (2026-06-17 12:00 PDT) | SPEC READY (this turn) | 7 tracks, 34 PRs, orchestrator + parallel subagent dispatch, includes Track 0 gate pattern (mitigates R1) |

## Appendix B — Pre-launch checklist (orchestrator)

Before declaring v7 "launched", the orchestrator must verify:

- [ ] `gh auth status` shows `KooshaPari` active (not Dmouse92) — per AGENTS.md § "Key Commands"
- [ ] `forge -p "echo test" -C /tmp` returns 0 in < 30 sec (subagent dispatch gate — R1 mitigation)
- [ ] `curl -sf -m 3 http://localhost:20128/v1/models` returns 4+ models (OmniRoute liveness)
- [ ] `git status --short` is clean (no uncommitted changes blocking branch operations)
- [ ] `git stash list` is empty (T1.1 prerequisite)
- [ ] `git branch | grep gate1-` is empty (T1.2 prerequisite)
- [ ] `git rev-list --left-right --count origin/main...HEAD` shows the current branch is rebased or 0-ahead (T6.1 prerequisite)
- [ ] `git worktree list` shows 4 expected worktrees (3 stranded + 1 primary) — confirms recovery targets exist

If any check fails, the failing item is added to the v7 launch log and the corresponding track is held.

---

## Appendix C — Per-track subagent dispatch instructions (T2 + T3.2)

Each `forge` subagent is dispatched with a scoped prompt. The prompts are pre-written and stored at `findings/v7-subagent-prompts/` (one file per subagent). This appendix records the canonical prompt templates.

### C.1 — WIP landing subagent (T2.1-T2.4)

```
Prompt template (T2.x):
You are reviewing WIP branch <branch> in <repo> for landing.

Scope:
1. cd to <repo>
2. git fetch origin <branch>
3. git checkout <branch>
4. git log origin/main..HEAD --oneline (show all unique commits)
5. git diff origin/main...HEAD --stat (show file changes)
6. Run CI: <ci-cmd> (e.g. cargo test --workspace, pytest, go test ./...)
7. If CI green, push the branch to origin (HOOKS_SKIP=1 to bypass pre-push)
8. gh pr create --base main --head <branch> --title "<title>" --body "<body>" --label governance,L<n>-<req-id>
9. Report back: PR URL, CI status, file count, any concerns

DO NOT:
- Modify any code (review only)
- Force-push
- Merge the PR (orchestrator merges after review)
- Push to any other branch
- Touch the orchestrator's working branch (chore/l5-87-focus-repo-specs-2026-06-11)

Report format:
PR URL: <url>
CI: <pass/fail>
Files changed: <count>
Commits ahead of main: <count>
Concerns: <none | list>
```

### C.2 — Per-repo probe subagent (T3.2)

```
Prompt template (T3.2):
You are probing <repo> against the 71-pillar framework.

Scope:
1. cd to <repo>
2. Read scripts/71-pillar-probe.py (the single source of truth for scoring)
3. Run: python scripts/71-pillar-probe.py --repo <repo> --output /tmp/probe-<repo>.json
4. Read /tmp/probe-<repo>.json
5. For each pillar where the probe returns 0 (absent), spot-check by reading the
   relevant file (e.g. L1 = README.md, L4 = pheno-tracing, L25 = .gitattributes)
6. If your spot-check disagrees with the probe, override the score and document why
7. Submit your final scores to the orchestrator via the standard report format

DO NOT:
- Modify the probe script
- Skip the spot-check on L1, L25, L40, L41, L66 (these are the most error-prone)
- Touch any other repo

Report format (JSON):
{
  "repo": "<repo>",
  "scores": {"L1": 0-3, "L2": 0-3, ..., "L71": 0-3},
  "overrides": {"L<n>": {"probe_score": <n>, "your_score": <n>, "reason": "..."}},
  "spot_check_findings": ["L1: README.md is 50 lines, missing quickstart", ...],
  "wall_clock_seconds": <n>
}
```

### C.3 — HwLedger archive subagent (T5.3)

```
Prompt template (T5.3):
You are archiving KooshaPari/HwLedger per ADR-029.

Scope:
1. cd to repos/HwLedger
2. Verify AGENTS.md is up-to-date (mentions PAUSED + archival per ADR-029)
3. Append a final section to README.md:
   "## Archived (2026-06-17)\n\nThis repo has been archived per ADR-029.
    See https://github.com/KooshaPari/phenotype-org-audits/blob/main/audits/
    hwledger-reclassification-2026-06-17.md for the full disposition record."
4. git add AGENTS.md README.md
5. git commit -m "chore(hwledger): mark archived (ADR-029)"
6. git push origin <branch> (HOOKS_SKIP=1)
7. gh pr create --base main --head <branch> --title "chore(hwledger): archive repo (ADR-029)" --label governance
8. After PR merges: gh repo archive KooshaPari/HwLedger --yes
9. Verify: gh api repos/KooshaPari/HwLedger | jq .archived -> true

DO NOT:
- Force-push
- Delete the repo (no delete_repo scope)
- Modify any code

Report format:
PR URL: <url>
Archive status: <true/false>
AGENTS.md updated: <true/false>
```

## Appendix D — Per-ADR 1-page summary

| ADR | Subject | Supersedes | Closes pillar | Defer date | Owner |
|---|---|---|---|---|---|
| ADR-024 | 71-pillar framework (9 domains, L1-L71) | 30-pillar at `findings/30-pillar-2026-06-16.md` | — | — | orchestrator (T3.6) |
| ADR-025 | Worklog v2.1 schema (add `device:`) | ADR-015 (v2.0) | — | 2026-06-22 (v2.0 deprecated) | orchestrator (T3.7) |
| ADR-026 | Factory AI Agent Readiness (external cross-cutting) | — | — | — | orchestrator (T3.8) |
| ADR-027 | Git LFS 3-tier policy (always-track / on-demand / never-track) | — | L66 | — | orchestrator (T3.9) |
| ADR-028 | Monorepo hybrid-with-staging-repo | — | L25 | — | orchestrator (T3.10) |
| ADR-029 | HwLedger reclassification (PAUSED + archival) | — | — | — | orchestrator (T5.1) |

## Appendix E — v7 launch log template

```
[v7 LAUNCH] 2026-06-17T<HH:MM> PDT
- gh auth status: KooshaPari active
- forge -p "echo test" -C /tmp: rc=0 (T+0:00:30)
- OmniRoute liveness: 4 models UP
- git status --short: clean
- git stash list: empty
- gate1 branches: 0
- worktree count: 4 (3 stranded + 1 primary)
- branch divergence: 0 ahead of origin/main

[Phase 0] t=0..5min
- T1.1: stash drop (rc=0)
- T1.2: gate1 branch delete (rc=0)
- T3.1: schema doc opened at findings/71-pillar-2026-06-17-schema.md
- T3.7: ADR-025 drafted
- T4.1: pheno-worklog-schema v0.3.0 spec drafted
- T7.3: AGENTS.md pointer verified (already current)

[Phase 1] t=5..10min
...

[v7 DONE] 2026-06-17T<HH:MM> PDT
- PRs merged: <n>/34
- 71-pillar live: <n>/10 repos
- HwLedger archived: <true/false>
- Branch rebased and pushed: <true/false>
- Wall clock: <X>h<Y>m
- Success criteria met: <n>/12
```

The launch log is written to `findings/v7-launch-log-2026-06-17.md` as events occur (T7.1-T7.6 live updates).

## Appendix F — v8 deferred backlog (informational, not in v7 scope)

The following items from `work-dag-2026-06-17-v7-extended.md` Tracks D + E are deferred to v8 (post-v7 closure):

| Item | Source | Defer rationale |
|---|---|---|
| D1 (UX cluster: L30, L32, L35-L39) | v7-extended § D1 | Quality improvement; 6 pillars; ~3-4h; not P0 |
| D2 (AX cluster: L43, L45, L47, L51, L54) | v7-extended § D2 | Quality improvement; 5 pillars; ~3-5h; not P0 |
| D3 (DX cluster: L56, L57, L59, L63-L65, L68, L70) | v7-extended § D3 | Quality improvement; 8 pillars; ~5-10h; not P0 |
| D4 (L22 LFS runtime) | v7-extended § D4 | Implementation side of T3.9; the documentation is in v7, the runtime can wait |
| E1 (ADR-024 canonicalization followup) | v7-extended § E1 | Followup to T3.6 |
| E2 (ADR-025 promotion) | v7-extended § E2 | Followup to T3.7 (already in v7) |
| E3 (ADR-026 monorepo decision followup) | v7-extended § E3 | Followup to T3.10 (already in v7) |
| E4 (ADR-027 LFS substrate) | v7-extended § E4 | Followup to T3.9 (already in v7) |
| Re-run 71-pillar audit (target 65+ ✓) | v7-extended Phase 5 | v7 sets baseline; v8 measures improvement |

v8 scope: ~12-20h, 8-12 PRs, 4-way parallel. Plan to be authored in v7 wrap-up.

---

**END OF v7 DAG**

**Status:** SPEC READY 2026-06-17
**Next step:** orchestrator launches v7 (verify pre-launch checklist, then dispatch parallel subagents per § 4)
**Owner:** forge orchestrator
**Supersedes:** v6 (`plans/2026-06-15-v6-dag-stable.md`)
