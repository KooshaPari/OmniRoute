# Phenotype Registry — STATUS REPORT

**Generated:** 2026-06-18
**Scope:** L7-001 / L7-002 / L7-003 sweep — `phenotype-registry`
**Author device:** macbook
**Audience:** user (consolidated, not committed, not pushed)

---

## 1. L7 Sweep History (3 turns)

The L7 sweep is a 3-turn series on the `phenotype-registry` repo that establishes a
**capability + intent SSOT layer** across the Phenotype fleet. It pairs an
authoring contract (`docs/intent/` + `docs/boundary/`) with a curation pipeline
that scrapes LLM interaction history from Mac + Windows workstations and renders
per-repo artifacts.

| Turn | ID    | Date       | Theme                                                       | Status   | Headline artifact |
| :--- | :---- | :--------- | :---------------------------------------------------------- | :------- | :---------------- |
| 1    | L7-001 | 2026-06-17 | Contract + full Mac+Windows prompt/plan/response curation | complete | 82 intent + 123 boundary files rendered; 45,091 unique records |
| 2    | L7-002 | 2026-06-18 | Collision resolution (alias → canonical rebinding)          | complete (per L7-003 cross-ref) | 15 merges + 6 drops → 108 canonical repos bound; branch tip `f5b6d7d6` |
| 3    | L7-003 | 2026-06-18 | Ecosystem reconciliation (ECOSYSTEM_MAP ↔ L7-002 _bindings) | complete (orphan LIVE; main PUSH-PENDING) | 0 merge conflicts; +SSOT layer; 8 stubs; orphan @ `cef45570` |

### 1.1 L7-001 (2026-06-17) — Intent + Boundary Contract + Curation Sweep

Source of truth: `phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json:1-77`

Key deliverables:

- `docs/intent/{README,_template,REGISTRY}.md` — the contract
- `docs/boundary/_template.md` — boundary template
- `docs/intent/<repo>.md` × 82 and `docs/boundary/<repo>.md` × 123 — per-repo artifacts
- `scripts/scrape.py`, `scripts/run-all.sh`, `scripts/run-windows.sh`, `scripts/render-per-repo.py`

Curation scale:

- Mac raw: 47,774 → kept 41,263 (claude-code 27,809 / codex 13,757 / cursor-agent 7 / forge 12)
- Windows raw: 4,512 → kept 3,829 (claude-code 3,252 / codex 578 / cursor-agent 12)
- Merged unique: **45,091 records**
- Tag distribution: narrative 24,505 / implementation 4,753 / bugfix 3,601 / policy-setting 4,259 / idea 494 / repo-defining 3,973
- Trash filters: slash-command-only, single-word-confirm, empty/null, duplicate-continue

ADRs referenced: ADR-023 (device-fit), ADR-024 (71-pillar), ADR-025 (worklog v2.1), ADR-026 (Factory AI Agent Readiness).

### 1.2 L7-002 (2026-06-18) — Collision Resolution

> **Caveat:** The worklog file `worklogs/L7-002-collision-resolution-2026-06-18.json` is **NOT present on disk** (verified via `ls worklogs/`, 2026-06-18). The state below is reconstructed from cross-references in L7-001 (`phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json:73`) and L7-003 (`phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:13,38`).

Headline outcomes:

- **15 merges** applied (lowercase-variants → canonical, e.g. `dino` → `Dino`, `helios-cli` → `HeliosCLI`, `focalpoint` → `FocalPoint`, `agileplus` → `AgilePlus`)
- **6 drops** applied (typos, retired, or out-of-fleet)
- Net: **108 canonical repos bound** (vs 82 in registry canon — a 26-entry L7-002-specific superset covering worktree variants + process artifacts)
- Branch tip: `f5b6d7d6` on `chore/l7-001-contract-only-orphan-2026-06-17`
- Output: `phenotype-registry-curation-data/_bindings.json`

### 1.3 L7-003 (2026-06-18) — Ecosystem Reconciliation

Source of truth: `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:1-102`

Key actions:

- Resolved 2 merge conflict blocks in `phenotype-registry/ECOSYSTEM_MAP.md` (lines 34-40 and 48-58) → both resolved in favor of `origin/main`
- Updated `phenotype-registry/docs/registries.md`: added "Capability & Intent SSOT" layer (3 → 4 SSOT layers: Specs / Handbook / HexaKit / **Capability & Intent SSOT**)
- Authored `phenotype-registry/docs/prompts-to-intent.crosswalk.md` (136 lines, 0 → 136) documenting the 80-entry L7-001-bound vs registry-canon gap (3 buckets: worktree suffixes / process artifacts / off-fleet) + 27-entry canon-not-bound gap + 108-vs-82 reconciliation logic
- **L7-003 final-pass delta (subagent C):** authored `scripts/render-stubs.py` + extended `scripts/propagate-intent-to-repos.py`; rendered 8 stubs (Paginary, PhenoCompose, agentapi-plusplus, argis-extensions, forgecode, phenoObservability, vibeproxy-monitoring-unified, PhenoDesign); canon-not-bound 24 → 16; pushed as commit `0034b391`; PhenoDesign case-fix as `d1a8a032` + `fcf30c3c`; final live tip `cef45570`

Branch state at L7-003 close: orphan branch `chore/l7-001-contract-only-orphan-2026-06-17` is **LIVE on remote @ `cef45570`**; registry `main` is **PUSH-PENDING** (39-commit remote divergence + ECOSYSTEM_MAP.md rebase conflict per L7-003 `next_steps`).

### 1.4 2026-06-19 Snapshot (L7-003, embedded status block)

From `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:79-101`:

- Orphan SHA: `cef45570fac3`
- Monorepo-propagated intent: 125
- Monorepo-propagated boundary: 106
- Registry intent files: 123
- Manager mode: as-of 2026-06-18 user directive — manager delegates work to task/forge subagents, audits only
- Subagents used: A:status-report, B:registries-update, C:stub-generator, D:aliases-update (redirected), E:render+propagate, F:worklog-update

---

## 2. Final State Metrics

All numbers verified 2026-06-18.

### 2.1 Curation corpus

| Metric                          | Value         | Source |
| :------------------------------ | :------------ | :----- |
| Total merged unique records     | **45,091**    | L7-001 `merged_unique_records` |
| Mac kept records                | 41,263        | L7-001 `mac_kept_records` |
| Windows kept records            | 3,829         | L7-001 `win_kept_records` |
| Sources covered                 | 7 (claude-code, codex, cursor-agent, forge, droid, aider, other) | L7-001 `sources_scraped` |

### 2.2 Repository bindings

| Metric                          | Value         | Source |
| :------------------------------ | :------------ | :----- |
| Repos bound (L7-002 output)     | **108**       | L7-003 `l7_002_bound_count` |
| Repos in registry canon         | 82            | L7-003 `registry_canon_count` |
| Canon-not-bound (pre L7-003)    | 24            | L7-003 `metric_deltas` |
| Canon-not-bound (post L7-003)   | **16**        | L7-003 `metric_deltas` |
| Stubs rendered (L7-003 final)   | 8             | L7-003 final-pass delta |

### 2.3 File propagation

Verified live (2026-06-18) via `find /Users/kooshapari/CodeProjects/Phenotype/repos -path "*/docs/intent/*.md" -not -path "*phenotype-registry*" ...` (and equivalent for boundary).

| Location                                       | Intent | Boundary |
| :--------------------------------------------- | -----: | -------: |
| `phenotype-registry/docs/{intent,boundary}/` (registry itself) | 128 | 122 |
| Monorepo (other repos, propagated)             | **181** | **107** |
| **Total artifacts across fleet**               | **309** | **229** |
| Delta vs 2026-06-19 snapshot (L7-003: 125 / 106) | +56 propagated intent | +1 propagated boundary |

### 2.4 Substrate

| Layer                | L7-001 | L7-003 close |
| :------------------- | :----: | :----------: |
| Specs                | yes    | yes          |
| Handbook             | yes    | yes          |
| HexaKit              | yes    | yes          |
| **Capability & Intent SSOT** | no | **yes (new)** |

---

## 3. Live Remote SHAs

Verified via `https://api.github.com/repos/KooshaPari/phenotype-registry/branches/<branch>` (2026-06-18).

### 3.1 Orphan branch — `chore/l7-001-contract-only-orphan-2026-06-17`

| Field     | Value |
| :-------- | :---- |
| **SHA**   | `cef45570fac35f8cefbcae40e5f702fc1af5d9cd` |
| Protected | false |
| Tip message | `docs(worklog): L7-003 FINAL — orphan @ fcf30c3c LIVE w/ 8 stubs + PhenoDesign case-fix` |

Local branch tip history (last 5, all on orphan):
- `cef45570` — docs(worklog): L7-003 FINAL
- `46e73eac` — fix(registry): add canonical PhenoDesign.md files
- `63d46c65` — fix(registry): remove lowercase phenoDesign.md duplicates
- `fcf30c3c` — docs(registry): overwrite PhenoDesign stub
- `0034b391` — feat(registry): render-stubs.py + 8 canonical stub files

### 3.2 Main branch — `main`

| Field     | Value |
| :-------- | :---- |
| **SHA**   | `65cca990b1aa5a6de3fbd93b52156db02efbce2a` |
| Tip message | `docs(registry): mark gw-* H9 smoke gates fixed (#198) — Update disposition notes after agentapi-plusplus#540/#541, cliproxyapi-plusplus#1031, and argis-extension...` |

Local `main` HEAD: `ea31bc43` — `docs: LOCAL_WORKSTATION.md and H14-H17 hygiene ledger. (#174)` — **local is behind remote; the L7-003 work has not been pushed to `main`**.

### 3.3 Local working tree (macbook)

`git status --short` shows 100+ `A docs/boundary/<repo>.md` entries — boundary files staged for a new commit. They are not yet committed and not yet pushed.

---

## 4. Outstanding Human-Judgment Tasks

These require human review or coordinated pushes that the L7 sweep is explicitly not allowed to perform unattended.

### 4.1 TODO prose fill-in (per-repo authoring)

- **What:** Each `docs/intent/<repo>.md` has a placeholder `## Intent Statement` paragraph; each `docs/boundary/<repo>.md` has placeholder `## In Scope` / `## Out of Scope` lists. These need human-authored prose so they reflect intentional design, not auto-derived inference.
- **Scope:** Per L7-003 2026-06-19 snapshot (`phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:99`): 108 intent + 108 boundary files. Per current `find` (2026-06-18): 128 + 122 = **250 files** total — the gap between 108 and 128 is the L7-003 final-pass stub wave (8 stubs) plus subsequent additions.
- **Why human-only:** Intent + boundary are *commitments*, not data. Auto-rendering cannot tell the user what a repo is *for*; only the maintainer can.
- **Source:** L7-001 `next_steps` (`phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json:71-72`), L7-003 `remaining` (`phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:99`).

### 4.2 Cherry-pick L7-003 onto `main`

- **What:** Mirror the L7-003 work (registries.md update, ECOSYSTEM_MAP.md resolution, prompts-to-intent.crosswalk.md, 8 stubs, PhenoDesign case-fix) onto `phenotype-registry:main`.
- **Blockers (per L7-003 `next_steps`):**
  1. 39-commit remote divergence on `origin/main` (wave I + wave H9 + PR #162 + kilo task #144 wave)
  2. ECOSYSTEM_MAP.md rebase conflict — the canonical resolution is in the orphan branch, but `main` has the kilo audit wave #144 which also touched ECOSYSTEM_MAP.md
- **Why human-only:** Rebase strategy on a 39-commit divergence with conflicting edits to a fleet-wide map is a coordination decision, not a mechanical operation. A bot rebase may silently drop the wrong side of the conflict.
- **Source:** L7-003 `next_steps` (`phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:51`) and `branch_target` (line 57).

### 4.3 3.2 GB curated corpus push

- **What:** Push the full `docs/curated-prompts/`, `docs/curated-plans/`, `docs/curated-responses/` corpus to remote. Estimated size: **3.2 GB** (45,091 records × ~70 KB markdown average).
- **Trigger:** kilo task #144 left a placeholder to push `curated_corpus_3_2_gb` per the ADR-024 weekly cadence.
- **Blockers / considerations:**
  1. Git LFS tier (per ADR-027) — 3.2 GB is on-demand tier; needs `.gitattributes` LFS ruleset for the curated-*/**/*.md pattern
  2. Push window: must be off-peak; a 3.2 GB push will block other git operations on this network
  3. Verification: the 3 directories (`docs/curated-prompts/`, `docs/curated-plans/`, `docs/curated-responses/`) are **currently empty in the registry repo** (verified via `ls`, 2026-06-18); the corpus lives in the worktree or has not yet been rendered into the registry
- **Why human-only:** LFS tier decision, push scheduling, and corpus-vs-worktree reconciliation are governance calls.
- **Source:** L7-003 `next_steps` (`phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:49`).

### 4.4 Other open questions (per L7-003 `open_questions`)

- Extend `scrape.py` with a template-prefix binding mode for HexaKit-template-derived paths (closes ~20 of 27 "canonical-but-not-bound" entries; ~30 min)
- Surface the "process artifact" bucket as its own role in `ECOSYSTEM_MAP.md` (worktrees, dashboards, scratch dirs)
- Merge "app substrate" (currently in monorepo row) into its own row for clarity
- Long-term: when `registry-bundlr1=registry-curation-data`, should the registry be a thin wrapper of just `curated_prompts/` + `curated_plans/` + `curated_responses/` + `intent/` + `boundary/` + `ALIASES.md` plus governance templates?

---

## 5. Next 3 Actionable Items

In priority order. Each item is sized for the macbook (`device: macbook` per worklog v2.1).

### Item 1 — Cherry-pick L7-003 onto `phenotype-registry:main`

- **Owner:** user
- **Size:** 1-2 hours (39-commit rebase + ECOSYSTEM_MAP.md three-way merge)
- **Steps:**
  1. `git fetch origin` to confirm remote is at `65cca990`
  2. `git checkout main && git pull --rebase` to land on remote tip
  3. `git cherry-pick f5b6d7d6^..cef45570` (L7-002 + L7-003 wave)
  4. Resolve ECOSYSTEM_MAP.md conflict at lines 34-40 and 48-58 — **take the orphan branch's resolution** (already incorporates `origin/main`'s 21-wide shared-lib + 6-stub update from wave I + wave H9)
  5. `git push origin main` (will require ADR-027 LFS tier 2 allow-incomplete-push config if any LFS-tracked file slips in)
- **Verification:** `git rev-list --left-right --count main...chore/l7-001-contract-only-orphan-2026-06-17` should return `0\tN` where N is the count of intentional orphan-only commits (currently zero intentional orphans expected)
- **Risk:** Medium. The rebase may surface additional conflicts in `registries.md` (kilo audit wave #144 also touched it). Pre-merge read of both branches' `registries.md` is recommended.

### Item 2 — Author TODO prose for 250 intent + boundary files

- **Owner:** user (with optional subagent assistance per L7-003 subagent model)
- **Size:** 1-2 days of focused authoring (or ~4 hours if using subagent D:aliases-update pattern with user HITL per file)
- **Suggested order:** Start with the 5 focus repos (`AgilePlus`, `PhenoCompose`, `PlayCua`, `BytePort`, `nanovms`), then the 4 federated services (phenoMCP, phenoObservability, phenoEvents, phenotype-hub), then the 11 `pheno-*-lib` crates, then the rest in fleet size order.
- **Template:** `phenotype-registry/docs/intent/_template.md` and `phenotype-registry/docs/boundary/_template.md` provide structure; 1-paragraph intent + 3-bullet in-scope + 3-bullet out-of-scope is the recommended minimum.
- **Verification:** `grep -l "TODO\|TBD\|<fill-in>" docs/intent/*.md docs/boundary/*.md | wc -l` should return 0.
- **Risk:** Low. Pure prose; no code changes.

### Item 3 — Push 3.2 GB curated corpus

- **Owner:** user
- **Size:** 1-2 hours push time + 30 min setup
- **Steps:**
  1. Confirm corpus exists in registry worktree: `find docs/curated-prompts docs/curated-plans docs/curated-responses -name "*.md" | wc -l` should approach 45,091 × 3 = ~135,000 files. **Currently 0** — corpus is not in the registry worktree; it lives elsewhere (likely in `phenotype-registry-curation-data` or a worktree).
  2. Reconcile: decide whether corpus is shipped *into* the registry repo or *referenced from* the registry (L7-003 `open_questions` line 44 hints at the thin-wrapper pattern)
  3. Apply `.gitattributes` LFS ruleset per ADR-027 tier 2 (on-demand) for `docs/curated-*/**/*.md`
  4. `git add docs/curated-* && git commit -m "feat(registry): ship 3.2GB curated corpus (45,091 records × {prompts,plans,responses})"`
  5. `git config lfs.allowincompletepush=true && git push origin main --no-verify` (per ADR-027 tier 2 strategy)
  6. Verify: `gh api repos/KooshaPari/phenotype-registry | jq .size` should report ~3.4 GB (3.2 GB corpus + ~0.2 GB existing)
- **Verification:** `gh release list --repo KooshaPari/phenotype-registry` shows a `v0.7.0-curated-corpus-3.2gb` tag with the corpus attached
- **Risk:** High if LFS is not configured (3.2 GB will balloon the git pack to ~10-15 GB). Medium with LFS. Low with LFS + LFS tier 2 allow-incomplete-push.

---

## 6. Notes & Caveats

- **L7-002 worklog file is missing on disk.** Only L7-001 and L7-003 are present in `phenotype-registry/worklogs/`. The L7-002 state in this report is reconstructed from cross-references in the other two worklogs. Author should recreate `worklogs/L7-002-collision-resolution-2026-06-18.json` from git history (`git log chore/l7-001-contract-only-orphan-2026-06-17 -- docs/curated-*` around `f5b6d7d6`).
- **Local main is behind remote main.** Local HEAD `ea31bc43` (PR #174); remote HEAD `65cca990` (PR #198). Pull or rebase before any `main` push.
- **Working tree has uncommitted boundary files.** 100+ `A docs/boundary/<repo>.md` entries are staged. These are likely the L7-002 collision-resolution wave that was not committed before the L7-003 worktree shift. Either commit and push on the orphan branch, or `git restore --staged docs/boundary/` if they are duplicates.
- **Subagent model in effect.** Per L7-003 2026-06-19 status block: "manager delegates work to task/forge subagents, audits only". This report is consistent with that model — synthesis only, no code edits, no pushes.
- **This report is not committed and not pushed.** It is a synthesis artifact for the user.

---

## 7. References

- L7-001 worklog: `phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json:1-77`
- L7-003 worklog: `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:1-102`
- Orphan branch tip: `cef45570fac35f8cefbcae40e5f702fc1af5d9cd` (verified 2026-06-18 via GitHub API)
- Main branch tip: `65cca990b1aa5a6de3fbd93b52156db02efbce2a` (verified 2026-06-18 via GitHub API)
- Local main HEAD: `ea31bc43` (`docs: LOCAL_WORKSTATION.md and H14-H17 hygiene ledger. (#174)`)
- Crosswalk doc: `phenotype-registry/docs/prompts-to-intent.crosswalk.md` (136 lines, authored in L7-003)
- ADRs: ADR-023 (device-fit), ADR-024 (71-pillar + L7 cadence), ADR-025 (worklog v2.1 `device:` field), ADR-026 (Factory AI Agent Readiness), ADR-027 (Git LFS 3-tier policy)
