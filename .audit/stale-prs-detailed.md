# Stale PR Audit — `kooshapari` org

**Generated:** 2026-06-14
**Repos audited:** `KooshaPari/AgilePlus`, `KooshaPari/PhenoMCP`
**Excluded:** `KooshaPari/PhenoCompose` — **repo does not exist** in the org. The only repo matching the keyword is `KooshaPari/RIP-Fitness-App` (unrelated, archived). The org owner is `KooshaPari` (camel case), not `kooshapari` — both casings resolve to the same namespace on the API, but the canonical form is `KooshaPari`.

---

## TL;DR

- **Stale open PRs (strict filter: `state=open` AND (`created >30d ago` OR `updatedAt >14d ago`)):** **0**
  - All 36 open PRs across the two repos are 0–1 day old (all created 2026-06-14 or 2026-06-15, all by `KooshaPari`).
- **Adjacent category — "abandoned" closed-not-merged PRs >30d old (broader interpretation):** **166** (162 AgilePlus + 4 PhenoMCP). These were actively closed, not just left open, but the work was never merged. Top 5 by diff size analyzed below.
- **No PRs were closed** (per task constraint).

---

## Methodology

1. `gh pr list --state all --limit 100` per repo → confirmed 24 open + 76 closed (AgilePlus) and 12 open + 88 closed (PhenoMCP) in the most-recent 100.
2. Cross-checked via `search/issues` API for the global open/total counts: **24 / 677** (AgilePlus), **12 / 148** (PhenoMCP). My dataset contains **all open PRs** in both repos.
3. Applied the strict filter in jq: `select(.state=="OPEN") | select((.createdAt < $cutoff_30) or (.updatedAt < $cutoff_14))` → **0 matches**.
4. For the broader "abandoned" set, used `search/issues` with `is:pr+is:closed+is:unmerged+created:<2026-05-15`. Got 100 results for AgilePlus (page 1 of 162) and 4/4 for PhenoMCP.
5. Diff stats fetched via GraphQL `pullRequest` field (`additions`, `deletions`, `changedFiles`) — equivalent to `gh pr diff --stat` (note: `gh pr diff` does **not** support `--stat`; the `git diff --stat` style summary has to come from the pulls API or `gh pr view --json`). File-level detail for the top 5 fetched via `pulls/{n}/files`.
6. Cutoffs computed from system date `2026-06-14`:
   - `cutoff_30` = 2026-05-15T00:00:00Z
   - `cutoff_14` = 2026-05-31T00:00:00Z

---

## Per-repo summary

| Repo                  | Open PRs | Open & >30d old | Open & inactive >14d | Closed-not-merged & >30d old |
|-----------------------|----------|------------------|-----------------------|------------------------------|
| `KooshaPari/AgilePlus`| 24       | 0                | 0                     | 162 (100 fetched, 62 more on page 2+) |
| `KooshaPari/PhenoMCP` | 12       | 0                | 0                     | 4                            |
| `KooshaPari/PhenoCompose` | —    | —                | —                     | — (repo does not exist)      |
| **Total**             | **36**   | **0**            | **0**                 | **166**                      |

The 24 AgilePlus open PRs all sit in number range `#729`–`#752`; the 12 PhenoMCP open PRs sit in `#134`–`#150`. Every single one was created 2026-06-14 or 2026-06-15 and authored by `KooshaPari` — they are the active in-flight batch, not stale.

---

## Top 5 "stale" PRs by diff size (closed-not-merged, >30d old)

> Fork-sync outliers (≥100 files changed AND ≥50k total lines) are excluded from the main ranking because their diffs are dominated by upstream default-branch replays rather than authored work. They are listed separately below for completeness.

### AgilePlus — top 5 (real authored changes)

#### 1. PR #311 — `chore: consolidate pending changes and hygiene fixes`
- **Diff:** +29,172 / −2,253 across **226 files** (total **31,425** lines)
- **Created:** 2026-04-04 (71 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/AgilePlus/pull/311
- **Sample changed files:** `.githooks/pre-commit`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `.github/workflows/legacy-tooling-gate.yml`, `.github/workflows/pr-requirements.yml`, `.github/workflows/quality-gate.yml`, `.github/workflows/release.yml`, `.github/workflows/vitepress-deploy.yml`, `.gitignore`

#### 2. PR #560 — `chore: comprehensive CI hygiene, dispatch-mcp hardening, and governance cleanup`
- **Diff:** +12,862 / −1,776 across **114 files** (total **14,638** lines)
- **Created:** 2026-05-06 (39 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/AgilePlus/pull/560
- **Sample changed files:** `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/workflows/cargo-audit.yml`, `.github/workflows/cargo-machete.yml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/doc-links.yml`, `.github/workflows/evidence-capture.yml`
- **Note:** Superseded by #563.

#### 3. PR #563 — `chore: combined CI hygiene + workspace audit (supersedes #559, #560)`
- **Diff:** +12,785 / −1,775 across **113 files** (total **14,560** lines)
- **Created:** 2026-05-07 (38 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/AgilePlus/pull/563
- **Sample changed files:** identical pattern to #560 (CODEOWNERS, dependabot, CI workflows).
- **Note:** Title explicitly says it supersedes #559 and #560 — so the CI-hygiene work landed in some other branch (or in the rush of new "layer:" PRs that followed).

#### 4. PR #559 — `docs: workspace audit 2026-05-05 — findings, DAG v9, WS-K through WS-X`
- **Diff:** +12,631 / −1,776 across **104 files** (total **14,407** lines)
- **Created:** 2026-05-06 (39 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/AgilePlus/pull/559
- **Sample changed files:** `.github/CODEOWNERS`, `.github/dependabot.yml`, workflow files, plus docs/audit reports.

#### 5. PR #139 — `Auto: Sync and evaluate fix/rust-compile-errors`
- **Diff:** +9,610 / −2,363 across **107 files** (total **11,973** lines)
- **Created:** 2026-03-25 (81 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/AgilePlus/pull/139
- **Sample changed files:** `Cargo.lock`, `CHANGELOG.md`, `CLAUDE.md`, `crates/agileplus-api/Cargo.toml`, `crates/agileplus-api/src/{main,responses,router}.rs`.

### PhenoMCP — top 4 (all 4 stale, ranked)

#### 1. PR #65 — `Workspace update (2026-05-06)`
- **Diff:** +9,742 / −37 across **57 files** (total **9,779** lines)
- **Created:** 2026-05-06 (39 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/PhenoMCP/pull/65
- **Sample changed files:** `.fix_audit.py`, `.github/SECURITY.md`, `.github/golangci.yml`, workflow files (`cargo-audit`, `cargo-deny`, `ci`, `codeql-rust`, `codeql`, `journey-gate`, `lint`, `pages`, `scorecard`).

#### 2. PR #72 — `chore(deps): bump vite from 8.0.10 to 8.0.11`
- **Diff:** +85 / −85 across **2 files** (total **170** lines)
- **Created:** 2026-05-11 (34 days old) · **Closed:** unmerged
- **Author:** dependabot[bot] · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/PhenoMCP/pull/72

#### 3. PR #49 — `fix(ci): pin actions/checkout to SHA`
- **Diff:** +4 / −4 across **2 files** (total **8** lines)
- **Created:** 2026-05-02 (43 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/PhenoMCP/pull/49

#### 4. PR #42 — `chore: pin GitHub Actions to immutable SHAs`
- **Diff:** 0/0, 0 files (total **0** lines)
- **Created:** 2026-04-30 (45 days old) · **Closed:** unmerged
- **Author:** KooshaPari · **State:** CLOSED
- **URL:** https://github.com/KooshaPari/PhenoMCP/pull/42
- **Note:** No diff because the SHA pin was force-pushed or the comparison ref was deleted before close. Likely superseded by #49 (more targeted `actions/checkout` pin) and #561 (AgilePlus's uv-group bump). Safe to leave closed.

### Fork-sync outliers (excluded from main top 5, recorded for completeness)

| PR    | Title (truncated)                                                       | Total lines | Files | Created  | Age (d) |
|-------|--------------------------------------------------------------------------|-------------|-------|----------|---------|
| #562  | fix(deploy): restore deploy.yml for VitePress pages                     | 405,284     | 2,355 | 2026-05-07 | 38     |
| #570  | fix(AgilePlus): add .gitignore for web dashboard (exclude .env files)   | 402,850     | 2,323 | 2026-05-07 | 38     |
| #129  | Auto: Sync and evaluate feat/modernize-tooling-v2                      | 70,554      | 437   | 2026-03-25 | 81     |
| #124  | Auto: Sync and evaluate feat/agileplus-tooling-modernization            | 70,554      | 437   | 2026-03-25 | 81     |
| #127  | Auto: Sync and evaluate feat/governance-final                           | 70,549      | 437   | 2026-03-25 | 81     |
| #126  | Auto: Sync and evaluate feat/gh-pages-deploy                            | 70,545      | 437   | 2026-03-25 | 81     |
| #113  | Auto: Sync and evaluate chore/add-worktrees-gitignore                  | 70,545      | 437   | 2026-03-25 | 81     |
| #141  | Auto: Sync and evaluate fix/stabilize-agileplus                         | 61,159      | 385   | 2026-03-25 | 81     |
| #123  | Auto: Sync and evaluate feat/agileplus-governance-backup                | 61,159      | 385   | 2026-03-25 | 81     |

These are the `Auto: Sync and evaluate …` batch + a couple of "fix deploy" with a default-branch replay. They were closed but the diff is mostly upstream file content, not authored change.

---

## Recommendations (close vs. ping)

> **No PRs were closed by this audit.** The recommendations below are advisory only.

| PR(s)                                    | Recommendation   | Why                                                                                                                                            |
|------------------------------------------|------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| AgilePlus #311                           | **Leave closed** | The .github/workflows and .githooks changes likely landed via the cascade of "layer: chore/" PRs that opened after it (#736, #742, #743, #745–748). Verify the same files end up at HEAD; if yes, no action. |
| AgilePlus #559 / #560 / #563             | **Leave closed** | #563's title literally says "supersedes #559, #560". The superseding work should be in the active "layer:" PR set — cross-check by grepping the diff. |
| AgilePlus #139                           | **Leave closed** | Auto-sync artifact. 81 days old, no maintainer engagement. The Rust compile fixes it contained are presumably in the current `main`. |
| AgilePlus fork-sync batch (#113, #123, #124, #126, #127, #129, #141, #562, #570) | **Leave closed** | These are upstream-replay diffs. No human author to ping — `KooshaPari` is the only author. They're noise, not pending work. |
| PhenoMCP #65                             | **Leave closed** | The CI/workflow files in this PR (cargo-audit, cargo-deny, codeql, etc.) are the same files being touched by the new "layer:" workflow PRs in PhenoMCP. Verify HEAD contains equivalent config; if yes, abandon. |
| PhenoMCP #49                             | **Leave closed** | Tiny 2-file SHA pin. Likely superseded by the `chore: pin GitHub Actions to commit SHAs` PRs that followed (#474, #489). |
| PhenoMCP #72                             | **Leave closed** | Dependabot vite patch. If the repo has since moved past vite 8.0.11, the patch is obsolete. No human author (dependabot) to ping. |
| PhenoMCP #42                             | **Leave closed** | Empty diff (force-pushed or ref-deleted). The corresponding SHA-pin work shipped elsewhere. |
| All 36 open PRs                          | **None** (not stale) | All 0–1 day old. Not in scope. |

**Net action items for the maintainer:**
1. **Sanity check the supersession chain.** For #563 → "supersedes #559, #560" and the wave of "layer: ci/fix-*" PRs in June, open the new PRs and confirm they contain the same workflow edits (#563's content). If yes, #559/#560/#563 are noise and can stay closed.
2. **Optionally prune labels/branches.** The 162 closed-not-merged AgilePlus PRs all sit on long-lived branches (e.g. `layer/...`). A weekly `gh api -X DELETE repos/KooshaPari/AgilePlus/git/refs/heads/<branch>` sweep for the top of this list would shrink branch clutter. Not required.
3. **No reopen-and-rescue is warranted.** Nothing in the top 5 represents lost work that isn't already in `main` via a successor PR.

---

## Files & artifacts (intermediate)

- `/tmp/AgilePlus-prs.json` — first 100 PRs (state=all), stripped of ANSI.
- `/tmp/PhenoMCP-prs.json` — first 100 PRs, stripped.
- `/tmp/AgilePlus-stale-closed.json` — page 1 of `is:pr+is:closed+is:unmerged+created:<2026-05-15` (100 of 162).
- `/tmp/PhenoMCP-stale-closed.json` — all 4 matches.
- `/tmp/diff-stats-ap.json`, `/tmp/diff-stats-pmcp.json` — GraphQL result with additions/deletions/changedFiles.
- `/tmp/diff-stats-ap.tsv`, `/tmp/diff-stats-pmcp.tsv` — flat TSV for spreadsheet import.
- `/tmp/merged-prs.json` — search-API metadata merged with GraphQL diff stats.
- `/tmp/fetch-all-diffs.py` — the GraphQL batcher (4 batches × 25 PRs for AgilePlus, 1 batch for PhenoMCP).
- `/tmp/fetch-diff-stat2.sh` — single-PR REST helper used during development (now superseded by the Python script).
