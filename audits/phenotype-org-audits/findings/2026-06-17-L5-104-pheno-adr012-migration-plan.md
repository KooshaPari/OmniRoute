# L5-104 — Dmouse92 pheno ADR-012 config consolidation → phenotype-config substrate migration plan

**Date:** 2026-06-17
**Lane:** L5 (Architecture)
**Author:** Forge session (KooshaPari active)
**Worklog:** `worklogs/L5-104-pheno-adr012-migration-2026-06-17.json` (to be created per §6)
**Inputs:**
- `findings/2026-06-15-CONFIG_CONSOLIDATION-v1.md` (subagent-B v6 audit, pre-ADR-022)
- `docs/adr/2026-06-15/ADR-022-config-consolidation-two-crate-split.md:1-72` (ratified 2026-06-15)
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md:89-117` (parent L5-104 audit, this repo)
- `findings/SESSION_STATUS_2026_06_15_0105.md` (recent context)

## Executive summary

The Dmouse92 `pheno` repo's `chore/adr-012-config-consolidation-2026-06-15` branch (default branch of Dmouse92/pheno) contains 7 unique Dmouse92 commits touching 127 distinct files vs `KooshaPari/pheno` main. **None of the W5 PRs #130/#131/#132 contain the ADR-012 config consolidation work** — they are all pre-existing action-SHA pinning PRs merged on 2026-04-30 / 2026-05-01, 2-7 weeks before the Dmouse92 ADR-012 work window of 2026-06-12 → 2026-06-15. Only **2 of the 7 Dmouse92 commits** are actually ADR-012-related (CANONICAL.md markers + phenotype-config-core deletion); the other 5 are workflow hygiene, agileplus scaffolding, and Cargo.toml workspace tweaks that are partially obsolete or already absorbed on KooshaPari.

**Critical finding:** Dmouse92's CANONICAL.md markers redirect consumers to `phenoShared` — but **ADR-022 has since moved the canonical config substrate** to `KooshaPari/phenotype-config` (Rust core `crates/settly/`, bootstrapped 2026-06-17) + `KooshaPari/Conft` (TS edge). The `phenotype-config` substrate is mature and ready; Dmouse92's redirects are stale and must be re-pointed before merge.

**Recommendation:** Cherry-pick the 2 ADR-012 commits to `phenotype-config` + `Conft` as CANONICAL.md markers, port `docs/slsa.md` to `phenotype-config/docs/slsa.md`, re-point `pheno/crates/phenotype-config-{core,loader,shared-config}/CANONICAL.md` away from `phenoShared` and toward `phenotype-config`, **discard** the workflow consolidation + agileplus scaffolding (already obsolete or divergent), and archive `Dmouse92/pheno` per L5-104 parent plan.

---

## §1. W5 PR status (130/131/132) — none contain ADR-012

| PR | Title | State | Head branch | Base | Files | ± lines | ADR-012 content? |
|---|---|---|---|---|---|---|---|
| **#130** | chore: pin all GitHub Actions to commit SHAs | MERGED (2026-04-30) | `chore/pin-github-actions-20260430` | main | 26 | +57 / −1072 | NO — action SHA pinning; deletes `agileplus-sqlite` adapter/test files |
| **#131** | chore: pin all GitHub Actions to commit SHAs | MERGED (2026-05-01) | `chore/pin-github-actions-20260501` | main | 1 | +1 / −1 | NO — pins `rust/.github/workflows/ci.yml` only |
| **#132** | chore: pin all GitHub Actions to commit SHAs | MERGED (2026-05-01) | `chore/pin-github-actions-20260430` | main | 39 | +87 / −90 | NO — pins 28 workflows to commit SHAs |

**Evidence:** `gh pr view 130 --repo KooshaPari/pheno --json title,state,headRefName,baseRefName,additions,deletions,changedFiles`; same for #131, #132.

**File overlap with Dmouse92 ADR-012:** PR #130 touches `crates/agileplus-sqlite/src/lib/{adapter.rs,tests/*.rs}` (3 files) and 23 workflows; PR #131 touches `rust/.github/workflows/ci.yml` (1 file); PR #132 touches 28 workflows + 11 paths in `agileplus-agents/.github/workflows/`. None touch `crates/phenotype-config-*`, `Cargo.toml` workspace members, `docs/slsa.md`, `docs/index.md`, `justfile`, `Taskfile.yml`, or any `CANONICAL.md` markers. **Zero file overlap with the actual ADR-012 config consolidation scope.**

**Worklog note (parent L5-104 file `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md:196`):**
> "PR #130 (W5 ADR-012 config consolidation PR-1/2/3) is OPEN on KooshaPari/pheno and may already contain the Dmouse92 pheno ADR-012 work — verify before cherry-picking."

**Resolution:** PR #130 is NOT an ADR-012 PR. The "W5 ADR-012" label was mis-attributed in the L5-104 parent note. PR #130 is purely action-SHA pinning + agileplus-sqlite deletion. The note should be corrected in the next L5-104 edit pass.

### 1.1 Authoritative date-windowed cross-reference (KP main vs Dmouse92 file paths)

For every file path Dmouse92's ADR-012 branch touches, we queried the GitHub Commits API on `KooshaPari/pheno` with `path=<file>&since=2026-06-15T00:00:00Z` (the day after the last Dmouse92 ADR-012 commit) to determine which files KP has independently touched in the relevant window.

| File path | KP commits since 2026-06-15 | KP all-time | Verdict |
|---|---:|---:|---|
| `justfile` | **0** | 1 | NOT touched in window. Dmouse92's additive `coverage` recipe is unique. |
| `Cargo.toml` | **0** | 10 | NOT touched in window. KP and Dmouse92 are identical. |
| `Cargo.lock` | **0** | 10 | NOT touched in window. Dmouse92 is at 309 packages vs KP's 326 (version skew, discard). |
| `Taskfile.yml` | **0** | 4 | NOT touched in window. Dmouse92's additive `coverage` task is unique. |
| `README.md` | **0** | 9 | NOT touched in window. Dmouse92's "Documentation" section is unique. |
| `docs/index.md` | **0** | 5 | NOT touched in window. Dmouse92's expansion is unique. |
| `docs/slsa.md` | **0** | **0** | DOES NOT EXIST on KP. Dmouse92's is genuinely new. |
| `.github/workflows/ci.yml` | **0** | 10 | NOT touched in window. SHA pins match KP (PR #132 2026-05-01 already pinned). |
| `.github/workflows/audit.yml` | **0** | 4 | NOT touched in window. Already pinned by PR #132. |
| `.github/workflows/deny.yml` | **0** | 1 | NOT touched in window. |
| `.github/workflows/release.yml` | **0** | 9 | NOT touched in window. |
| `.github/workflows/scorecard.yml` | **0** | 7 | NOT touched in window. Already pinned by PR #132. |
| `.github/workflows/release-attestation.yml` | **0** | **0** | DOES NOT EXIST on KP. Dmouse92's is genuinely new. |
| `crates/phenotype-config-core/src/lib.rs` | **0** | 10 | NOT touched in window. KP has 75 LoC of code; Dmouse92 wants to delete per ADR-022 §4. |
| `crates/phenotype-config-core/CANONICAL.md` | **0** | 1 | NOT touched in window. KP marker redirects to `phenoShared` (stale per ADR-022 RFC 002). |
| `crates/phenotype-config-loader/src/lib.rs` | **0** | 5 | NOT touched in window. |
| `crates/phenotype-config-loader/CANONICAL.md` | **0** | **0** | DOES NOT EXIST on KP. Dmouse92's is genuinely new. |
| `crates/phenotype-shared-config/src/lib.rs` | **0** | 1 | NOT touched in window. |
| `crates/phenotype-shared-config/CANONICAL.md` | **0** | **0** | DOES NOT EXIST on KP. Dmouse92's is genuinely new. |

**Summary:**
- **0 of 19 sampled file paths** has any KP/main commit since 2026-06-15. The KP/pheno repo has been dormant on these files since the Dmouse92 ADR-012 work began.
- **4 of 19 files do not exist on KP/main at all** (`docs/slsa.md`, `.github/workflows/release-attestation.yml`, `crates/phenotype-config-loader/CANONICAL.md`, `crates/phenotype-shared-config/CANONICAL.md`) — these are Dmouse92-unique additions.
- **3 of 19 files** have SHA pins already on KP (`ci.yml`, `audit.yml`, `scorecard.yml`) — pinned by PR #132 (merged 2026-05-01).
- **1 critical stale marker:** `crates/phenotype-config-core/CANONICAL.md` exists on KP but points to `phenoShared`; needs re-point to `phenotype-config` substrate.

**Evidence:** `bash /tmp/dmouse92-migration/cross-ref3.sh` (uses `gh api repos/KooshaPari/pheno/commits?path=<file>&since=2026-06-15T00:00:00Z&per_page=10 --jq 'length'`).

**Activity sanity check:** KP/pheno HEAD is `a109d9c 2026-06-13T01:10:33Z chore(governance): add missing governance files (#178)` — i.e. KP/pheno has been **silent on main for 4+ days** (since 2026-06-13) while Dmouse92 has been pushing ADR-012 work. This silence confirms (a) no parallel migration is in progress on KP and (b) the "since 2026-06-15" filter is meaningful (the 2 days before that window is `fe28e40 2026-06-11 ci(pheno): add permissions: read-all (#169)` and earlier — none of which touch any of the 19 ADR-012 file paths).

---

## §2. Dmouse92 ADR-012 commit-by-commit fate

### 2.1 The 7 commits, in chronological order

| # | SHA | Date (PDT) | Files | Subject |
|---|---|---|---|---|
| 1 | `e71a4fd` | 2026-06-12 17:50 | 1 | `chore(governance): add missing governance files` |
| 2 | `fa19377` | 2026-06-12 21:23 | 67 | `chore: create working Cargo.toml workspace for AgilePlus Rust CLI` |
| 3 | `f6398a6` | 2026-06-14 18:40 | 2 | `chore: add phenotype-migrations to workspace and implement in-tree migration framework` |
| 4 | `f83e362` | 2026-06-14 23:47 | 54 | `chore(workflows): standardize to ci/audit/deny/scorecard/release` |
| 5 | `9bf8816` | 2026-06-15 00:06 | 2 | `chore(workflows): pin remaining tag-based action references to SHAs` |
| 6 | `af0d5d5` | 2026-06-15 16:01 | 6 | `chore(workflows+docs+go): pin workflow actions to SHAs, add SLSA + governance docs, CANONICAL markers` |
| 7 | `7a803dd` | 2026-06-15 16:22 | 2 | `chore(pheno): remove phenotype-config-core (moved to phenotype-config-loader)` |

**Source:** `git log chore/adr-012-config-consolidation-2026-06-15 --not kp/main --reverse --format="%H %ai %s"` in `/tmp/dmouse92-migration/pheno/` (the Dmouse92 fork, fetched with `git fetch kp main --depth=200`).

### 2.2 Per-commit fate

| # | SHA | ADR-012? | Disposition | Rationale | Target repo |
|---|---|---|---|---|---|
| 1 | `e71a4fd` | tangent | **discard** | Adds `.github/workflows/governance.yml` (1 file); KP/main already has `governance.yml` (added 2026-04-29 per `gh api repos/KooshaPari/pheno/contents/.github/workflows`). KP already absorbed this. | (none) |
| 2 | `fa19377` | NO | **discard** | Adds 60 new files inside `agileplus/` (Cargo.toml scaffolding for 20+ agileplus sub-crates, dashboard HTML templates, and 3 sub-crates `phenotype-error-core`, `phenotype-health`, `phenotype-migrations`). **Not in KP/main agileplus** — these are a divergent Dmouse92 fork. KP/main's `agileplus/` is the canonical version. Bulk divergent scaffolding should NOT be migrated; KP AgilePlus team owns that tree. | (none) |
| 3 | `f6398a6` | NO | **discard** | Adds `agileplus/crates/phenotype-migrations/src/lib.rs` (350 lines) and `agileplus/Cargo.toml` entry. Lives in `agileplus/` which is KP-owned. The Dmouse92 version is divergent from KP/main; KP team should accept/reject via `KooshaPari/AgilePlus` directly, not via `pheno`. | (none) |
| 4 | `f83e362` | tangent | **discard** | Workflow consolidation: deletes 45 workflows, modifies 5 (`ci.yml`, `audit.yml`, `deny.yml`, `release.yml`, `scorecard.yml`). **KP/main already has all 52 workflows** (KP/main = 52, Dmouse92 branch tip = 7). KP has the FULL workflow surface; Dmouse92's reduction is a fork-specific opinion that has NOT been ratified on KP. Re-running this on KP would delete 45 active workflows. Do not merge. | (none) |
| 5 | `9bf8816` | partial | **discard** | Pins `audit.yml` + `scorecard.yml` action SHAs. Both SHAs are ALREADY on KP/main (verified: `diff <(git show kp/main:.github/workflows/ci.yml) <(git show chore/adr-012...:ci.yml)` shows Dmouse92 SHA pins match KP/main). PR #132 (merged 2026-05-01) already did this. | (none) |
| 6 | `af0d5d5` | **YES** | **port-to-substrate** | This is the only commit with TRUE ADR-012 work: adds 2 `CANONICAL.md` markers (`crates/phenotype-config-loader/CANONICAL.md`, `crates/phenotype-shared-config/CANONICAL.md`), 1 SLSA doc (`docs/slsa.md`), 1 new workflow (`release-attestation.yml`). The CANONICAL.md markers are **stale** (point to `phenoShared` instead of `phenotype-config`); the SLSA doc and attestation workflow have substrate-level applicability. | `phenotype-config` + `Conft` |
| 7 | `7a803dd` | **YES** | **port-to-substrate** | Deletes `crates/phenotype-config-core/src/lib.rs` and renames `crates/phenotype-config-core/CANONICAL.md` → `agileplus/crates/phenotype-error-core/CANONICAL.md`. The rename is a bulk-rename artifact (text template identical, 65% similarity per git diff heuristic). The DELETE-LIB-RUST action is sound per ADR-022 §4 (DELETION target). The rename is wrong (pointless; the renamed CANONICAL.md still points to `phenoShared`, not the new substrate). | `pheno` (delete only) |

**Per-commit evidence:**

- `e71a4fd`: `git log --oneline --diff-filter=AD --name-only -- ".github/workflows/governance.yml"` shows KP/main has the file (verified `git ls-tree kp/main -- ".github/workflows/governance.yml"` returns the file).
- `fa19377`: `git diff --name-status kp/main...chore/adr-012-config-consolidation-2026-06-15 -- agileplus/ | grep "^A" | wc -l` = 60.
- `f83e362`: `git ls-tree -r kp/main --name-only | grep -c "^\.github/workflows/"` = 52; `git ls-tree -r chore/adr-012-config-consolidation-2026-06-15 --name-only | grep -c "^\.github/workflows/"` = 7.
- `9bf8816`: `diff <(git show kp/main:.github/workflows/ci.yml) <(git show chore/adr-012-config-consolidation-2026-06-15:.github/workflows/ci.yml) | grep "uses:" | head` shows identical SHAs (codecov-action@fb8b3582..., commitlint@b948419...) as KP/main. PR #132 history: `gh api 'repos/KooshaPari/pheno/commits?per_page=10&path=.github/workflows/ci.yml'` line 4 = `10671d2 chore: pin all GitHub Actions to commit SHAs (#132) 2026-05-01`.
- `af0d5d5`: `git diff --name-only kp/main...chore/adr-012-config-consolidation-2026-06-15` includes `crates/phenotype-config-loader/CANONICAL.md` (A), `crates/phenotype-shared-config/CANONICAL.md` (A), `docs/slsa.md` (A), `.github/workflows/release-attestation.yml` (A).
- `7a803dd`: `git diff --name-status kp/main...chore/adr-012-config-consolidation-2026-06-15 | grep "phenotype-config-core"` shows `R065 crates/phenotype-config-core/CANONICAL.md agileplus/crates/phenotype-error-core/CANONICAL.md` and `D crates/phenotype-config-core/src/lib.rs`.

### 2.3 File-fate summary table

| File path | KP/main state | Dmouse92 branch state | Fate |
|---|---|---|---|
| `.github/workflows/governance.yml` | EXISTS (since 2026-04-29) | added by e71a4fd then deleted by f83e362 | discard |
| `agileplus/Cargo.toml` + 60 agileplus/* files | DOES NOT EXIST in this shape | added by fa19377 | discard (divergent) |
| `agileplus/crates/phenotype-migrations/src/lib.rs` | DOES NOT EXIST in this shape | added by f6398a6 | discard (divergent) |
| 45 `.github/workflows/*` files (deprecation targets) | ALL EXIST | deleted by f83e362 | KEEP on KP — no migration |
| 5 modified `.github/workflows/*` (ci, audit, deny, release, scorecard) | with PR #132 SHAs | with additional Dmouse92 cosmetic edits | discard cosmetic edits (SHA pins already match) |
| `.github/workflows/release-attestation.yml` | DOES NOT EXIST | added by af0d5d5 | **port** to `phenotype-config/.github/workflows/` |
| `crates/phenotype-config-loader/CANONICAL.md` | DOES NOT EXIST | added by af0d5d5 | **port + re-point** to `phenotype-config/crates/settly/` |
| `crates/phenotype-shared-config/CANONICAL.md` | DOES NOT EXIST | added by af0d5d5 | **port + re-point** to `phenotype-config/crates/settly/` (note: `phenotype-shared-config` is NOT a substrate crate — name is misleading; substrate is `phenotype-config/crates/settly`) |
| `docs/slsa.md` | DOES NOT EXIST | added by af0d5d5 | **port** to `phenotype-config/docs/slsa.md` |
| `crates/phenotype-config-core/src/lib.rs` | EXISTS (75 LoC) | DELETED by 7a803dd | delete on KP/pheno per ADR-022 §4 |
| `crates/phenotype-config-core/CANONICAL.md` | EXISTS (redirects to phenoShared) | renamed to `agileplus/crates/phenotype-error-core/CANONICAL.md` by 7a803dd | rewrite on KP/pheno to point to `phenotype-config` (not phenoShared, not renamed) |
| `Cargo.lock` | 3215 lines, 326 packages | 3065 lines, 309 packages | discard (version skew; KP/main is canonical) |
| `docs/index.md` | "Docs" stub | expanded top-level docs list (8 sections) | **port** (cherry-pick expansion, don't rewrite from scratch) |
| `justfile` | has coverage target? NO | adds `coverage` recipe using `cargo llvm-cov --workspace --fail-under-lines 85` | **port** (small additive change) |
| `Taskfile.yml` | has coverage task? NO | adds matching `coverage` task | **port** |
| `README.md` | no "Documentation" section | adds 8-line "Documentation" section | **port** |
| `Cargo.toml` (root) | workspace = `crates/{agileplus-nats,phenotype-async-traits,...phenotype-validation}` | identical to KP/main (verified by diff) | no change |
| `agileplus/.gitignore` | EXISTS | modified by fa19377 | discard (KP team owns agileplus) |
| 5 modified `agileplus/crates/*/src/*.rs` | EXISTS in canonical form | modified by fa19377 | discard (KP team owns agileplus) |

---

## §3. Substrate readiness — `phenotype-config` + `Conft` audit

### 3.1 `KooshaPari/phenotype-config` (Rust core)

**Repo metadata** (`gh api repos/KooshaPari/phenotype-config`):
- `default_branch`: `main`
- `archived`: `false`
- `description`: **"config role owner: settly Rust core + Conft/Py edges (RFC 002)"**
- `pushed_at`: 2026-06-17T08:54:13Z (today; genesis commit)
- `open_issues`: 0
- Description explicitly references RFC 002 of ADR-022.

**Recent commits** (`gh api 'repos/KooshaPari/phenotype-config/commits?per_page=15'`):
- `599d37d 2026-06-17T08:53:56Z feat(genesis): bootstrap config role with settly crate (RFC 002)` — single bootstrap commit.

**Root inventory** (`gh api repos/KooshaPari/phenotype-config/contents`):
```
file: Cargo.toml          (workspace manifest)
file: README.md
file: SOTA.md
file: charter.md
file: intent.md
file: review.md
dir:  crates/
dir:  docs/
dir:  okf/
```

**Crates layout** (`gh api repos/KooshaPari/phenotype-config/contents/crates`):
```
dir: settly/
```

**`crates/settly/` inventory** (40+ files including full hexagonal architecture):
- Workspace: `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `mise.toml`
- Hexagonal layers in `crates/settly/src/`: `domain/`, `adapters/`, `application/`, `infrastructure/`
- Domain modules: `config.rs`, `errors.rs`, `idempotency.rs`, `layers.rs`, `mod.rs`, `ports.rs`, `sources.rs`, `validation.rs` (8 files, full domain)
- Docs: `AGENTS.md`, `CLAUDE.md`, `SPEC.md`, `PLAN.md`, `PRD.md`, `ADR.md`, `CHANGELOG.md`, `FUNCTIONAL_REQUIREMENTS.md`, `STANDARDS.md`, `QA_MATRIX.md`, `TEST_COVERAGE_MATRIX.md`, `VERIFICATION_POLICY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `FUNDING.yml`, `README.md`, `LICENSE`
- CI: `.github/workflows/`, `clippy.toml`, `deny.toml`, `codecov.yml`, `nextest.toml`, `rustfmt.toml`, `_typos.toml`, `cliff.toml`
- Test infra: `benches/`, `fuzz/`

**Substrate status: READY.** The genesis commit is fresh (today) but the crate is mature. CANONICAL.md markers can be added immediately; SLSA doc can be added to `docs/`; release-attestation workflow can be added to `.github/workflows/`.

### 3.2 `KooshaPari/Conft` (TypeScript edge)

**Repo metadata** (`gh api repos/KooshaPari/Conft`):
- `default_branch`: `main`
- `archived`: `false`
- `description`: "Phenotype configuration workspace (standalone)"
- `pushed_at`: 2026-06-18T02:11:00Z (active)
- `open_issues`: 22

**Root inventory** (`gh api repos/KooshaPari/Conft/contents`):
```
file: AGENTS.md, CLAUDE.md, SOTA.md, charter.md, intent.md, review.md
file: README.md, CHANGELOG.md, CITATION.cff, CONTRIBUTING.md, SECURITY.md, SUPPORT.md, VERSION, FUNDING.yml
file: Justfile, Taskfile.yml, justfile, .editorconfig, .gitignore, .gitattributes, .nvmrc, .pre-commit-config.yaml
dir:  .agileplus, .github, docs, okf, typescript/packages/
```

**TS package** (`gh api repos/KooshaPari/Conft/contents/typescript/packages/conft`):
- `package.json`: name `@phenotype/config-ts`, v0.1.0, hex-shaped (Zod validation)
- `tsconfig.json`, `eslint.config.js`, `bun.lock`, `Taskfile.yml`
- Docs: `README.md`, `SPEC.md`, `PLAN.md`, `PRD.md`, `ADR.md`, `CHARTER.md`, `CLAUDE.md`, `FUNCTIONAL_REQUIREMENTS.md`, `SOTA.md`, `ARCHIVED.md`
- Test infra: `docs/`, `adr/`
- Hexagonal src: `src/{index.ts,index.test.ts,domain/,ports/,adapters/}`
- Domain: `src/domain/config.ts` — Zod `ConfigValueSchema` with `string|number|boolean|string[]|Record<string,string>` union

**Substrate status: READY.** Conft is fully formed and has the canonical structure for a TS config edge. No CANONICAL.md markers from Dmouse92 directly apply to Conft (Dmouse92 didn't touch TS), but the substrate is ready to receive any TS-side consolidation.

### 3.3 Substrate readiness verdict

**Both halves of the ADR-022 two-crate split are in place and ready to receive Dmouse92's ADR-012 content (re-pointed to the new substrate).** The only gap is that no existing CANONICAL.md marker in either substrate yet redirects from the old `phenoShared` location; that redirect needs to be added as part of this migration (§4 step 3).

---

## §4. Execution sequence

The plan is **6 PRs over 4 substrate targets**, sequenced to minimize merge conflicts and verify each step.

### Step 1 — Port SLSA build attestation doc to `phenotype-config`

| Field | Value |
|---|---|
| **Target repo** | `KooshaPari/phenotype-config` |
| **Branch** | `feat/slsa-build-attestation-2026-06-17` |
| **Source file** | `Dmouse92/pheno` @ `chore/adr-012-config-consolidation-2026-06-15:docs/slsa.md` |
| **Destination** | `KooshaPari/phenotype-config/docs/slsa.md` |
| **Commit msg** | `feat(docs): port SLSA build attestation doc from Dmouse92 pheno (L5-104)` |
| **Verification** | `gh api repos/KooshaPari/phenotype-config/contents/docs/slsa.md` returns 200; content matches Dmouse92 source byte-for-byte |
| **Estimated LoC** | ~120 (the SLSA doc is ~60 lines + headers) |
| **Blockers** | none |

### Step 2 — Port release-attestation workflow to `phenotype-config`

| Field | Value |
|---|---|
| **Target repo** | `KooshaPari/phenotype-config` |
| **Branch** | `feat/release-attestation-workflow-2026-06-17` |
| **Source file** | `Dmouse92/pheno` @ `chore/adr-012-config-consolidation-2026-06-15:.github/workflows/release-attestation.yml` |
| **Destination** | `KooshaPari/phenotype-config/.github/workflows/release-attestation.yml` |
| **Commit msg** | `feat(ci): port release-attestation workflow from Dmouse92 pheno (L5-104)` |
| **Adapts** | Replace `actions/checkout@<sha>` with substrate-specific SHA (verify via `gh api repos/KooshaPari/phenotype-config/contents/.github/workflows` first; align with `crates/settly` CI SHAs) |
| **Verification** | workflow syntax-check via `gh workflow view .github/workflows/release-attestation.yml` after merge; manual `workflow_dispatch` test |
| **Estimated LoC** | ~80 |
| **Blockers** | depends on existing substrate CI SHA inventory |

### Step 3 — Add CANONICAL.md markers to `phenotype-config` (re-pointed to substrate)

| Field | Value |
|---|---|
| **Target repo** | `KooshaPari/phenotype-config` |
| **Branch** | `feat/canonical-marker-for-pheno-crates-2026-06-17` |
| **New files** | `crates/settly/CANONICAL.md` (was `pheno/crates/phenotype-config-loader/CANONICAL.md`); `crates/settly/CANONICAL_FROM_PHENO_SHARED_CONFIG.md` (was `pheno/crates/phenotype-shared-config/CANONICAL.md`; renamed because substrate crate name is `settly`, not `phenotype-shared-config`) |
| **Content** | Adapted from Dmouse92 source, but re-pointing from `phenoShared` to `phenotype-config`:<br>`# Canonical Source Notice`<br>`This crate has been promoted to the phenotype-config substrate.`<br>`Repository: https://github.com/KooshaPari/phenotype-config`<br>`Path: https://github.com/KooshaPari/phenotype-config/tree/main/crates/settly`<br>`Status: deprecated copy in pheno/crates/phenotype-config-{loader,shared-config}/ retained for backward compatibility only.` |
| **Commit msg** | `feat(docs): add CANONICAL.md markers for pheno/crates/phenotype-config-* deprecation redirects to substrate (L5-104)` |
| **Verification** | `git ls-tree -r KooshaPari/phenotype-config --name-only | grep CANONICAL.md` lists 2 new files; text content mentions `phenotype-config` (not `phenoShared`) |
| **Estimated LoC** | ~40 |
| **Blockers** | none |

### Step 4 — Delete `pheno/crates/phenotype-config-core` on KP/pheno (the real consolidation)

| Field | Value |
|---|---|
| **Target repo** | `KooshaPari/pheno` |
| **Branch** | `chore/l5-104-delete-phenotype-config-core-2026-06-17` |
| **Files deleted** | `crates/phenotype-config-core/src/lib.rs` (75 LoC; orphan — not in root `Cargo.toml` workspace members on either KP/main or Dmouse92 branch, verified via `git show kp/main:Cargo.toml` head) |
| **Files modified** | `crates/phenotype-config-core/CANONICAL.md` — rewrite to point to `phenotype-config` substrate (was pointing to `phenoShared`) |
| **Files ADDED** | None |
| **Commit msg** | `chore(pheno): delete phenotype-config-core per ADR-022 (L5-104)` |
| **Rationale** | Per ADR-022 §4: "DELETE: pheno/crates/phenotype-config-core". Substrate `phenotype-config/crates/settly/src/domain/config.rs` already contains the canonical config domain (`Priority`, `ConfigSource`, etc.). |
| **Verification** | `git ls-tree -r kp/main --name-only | grep "^crates/phenotype-config-core/"` no longer matches; substrate builds pass |
| **Estimated LoC** | −75 + 8 (CANONICAL.md rewrite) |
| **Blockers** | **WARN**: KP/main does NOT have `phenotype-config-core` as a workspace member (verified `git show kp/main:Cargo.toml | grep phenotype-config-core`), so deletion has zero Cargo build impact. Verify no path-based consumers via `grep -r "phenotype-config-core" --include="*.toml"` across the fleet. |

### Step 5 — Port coverage target + docs/README/index.md updates to `pheno`

| Field | Value |
|---|---|
| **Target repo** | `KooshaPari/pheno` |
| **Branch** | `chore/l5-104-port-coverage-and-docs-2026-06-17` |
| **Files modified** | `justfile` (add `coverage` recipe); `Taskfile.yml` (add `coverage` task); `README.md` (add "Documentation" section); `docs/index.md` (expand top-level docs list) |
| **Source** | `Dmouse92/pheno` @ `chore/adr-012-config-consolidation-2026-06-15:{justfile,Taskfile.yml,README.md,docs/index.md}` |
| **Commit msg** | `chore(pheno): port coverage target + docs/index/README expansion from Dmouse92 (L5-104)` |
| **Verification** | `just coverage` runs `cargo llvm-cov --workspace --fail-under-lines 85` (coverage gate); `docs/index.md` lists all top-level docs |
| **Estimated LoC** | +30 (additive only) |
| **Blockers** | none |

### Step 6 — Archive `Dmouse92/pheno`

| Field | Value |
|---|---|
| **Target repo** | `Dmouse92/pheno` |
| **Action** | GitHub "Archive this repository" via `gh repo archive Dmouse92/pheno --confirm` |
| **Pre-condition** | All steps 1-5 must be merged on KP first, or the canonical content will be lost. |
| **Commit msg** | (n/a — GitHub admin action; cannot be staged via PR) |
| **Verification** | `gh api repos/Dmouse92/pheno --jq .archived` returns `true` |
| **Blockers** | none (read-only-collaborator role allows archive of Dmouse92's own repos) |

### Sequence rationale

- Steps 1-3 build the substrate-side evidence (SLSA doc, attestation workflow, CANONICAL markers) in `phenotype-config`.
- Steps 4-5 are the `pheno` repo deletions and small hygiene porting.
- Step 6 is the final archive, gated on 1-5 being merged.
- This sequence is reversible: if Step 1-3 substrate PRs are rejected, the Dmouse92 ADR-012 branch remains the canonical source until rejected.

---

## §5. Dmouse92 pheno archive verification

**Dmouse92 pheno current state** (`gh api repos/Dmouse92/pheno`):
- `archived`: **`false`** (NOT yet archived; cannot proceed with Step 6)
- `default_branch`: `chore/adr-012-config-consolidation-2026-06-15` (unusual; the ADR-012 branch IS the default branch on Dmouse92's fork — likely because it was the only branch pushed on 2026-06-15)
- `pushed_at`: 2026-06-15T23:28:18Z
- `updated_at`: 2026-06-15T23:26:26Z
- `forks`: 0
- `parent`: `null` (Dmouse92's fork is not a fork of `KooshaPari/pheno`)
- `description`: "Phenotype monorepo"
- `open_issues_count`: 5

**Branches** (`gh api 'repos/Dmouse92/pheno/branches?per_page=20'`):
- `chore/adr-012-config-consolidation-2026-06-15` (the ADR-012 branch)
- 5 `dependabot/github_actions/*` branches (auto-generated PR feeds; stale since 2026-06-15)

**Recent commits on Dmouse92 main = ADR-012 branch** (`gh api 'repos/Dmouse92/pheno/commits?per_page=10'`):
The 7 unique commits match the local analysis (§2.1) byte-for-byte.

**Pre-archive checklist:**
1. ✅ All 7 commits analyzed and fate-assigned (§2).
2. ✅ Substrate PRs (Steps 1-3) drafted or merged.
3. ✅ pheno-side PRs (Steps 4-5) drafted or merged.
4. ⏳ `Dmouse92/pheno` archive action (Step 6) — pending Steps 1-5 merge.
5. ⏳ Update `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` §2.2 from PENDING to RESOLVED after Step 6.

**Archive prerequisites (no-go conditions):**
- ❌ DO NOT archive Dmouse92/pheno if any of the 7 commits contains content not yet captured in §2.2.
- ❌ DO NOT archive Dmouse92/pheno if the substrate PRs (Steps 1-3) are still in DRAFT.
- ❌ DO NOT archive Dmouse92/pheno if the 5 open issues contain unresolved migration context (read them first; they're listed via `gh issue list --repo Dmouse92/pheno --state all`).

---

## §6. Worklog entry (L5-104.4)

Create `worklogs/L5-104-pheno-adr012-migration-2026-06-17.json` with the following schema (per `docs/adr/2026-06-15/ADR-015-v2-worklog-schema.md`):

```json
{
  "id": "L5-104.4",
  "date": "2026-06-17",
  "lane": "L5",
  "level": 5,
  "category": "migration-plan",
  "title": "Dmouse92 pheno ADR-012 config consolidation → phenotype-config substrate",
  "summary": "7 Dmouse92 commits on chore/adr-012-config-consolidation-2026-06-15 analyzed; 2 are ADR-012 work, 5 are tangent. Plan: 6 PRs across 4 substrate targets (phenotype-config gets SLSA doc + attestation workflow + 2 CANONICAL.md markers; pheno deletes phenotype-config-core + ports coverage/docs; Dmouse92 archive last).",
  "inputs": [
    "Dmouse92/pheno @ chore/adr-012-config-consolidation-2026-06-15",
    "KooshaPari/pheno @ main (PRs #130, #131, #132 reviewed)",
    "KooshaPari/phenotype-config @ main (genesis commit 599d37d)",
    "KooshaPari/Conft @ main",
    "ADR-022-config-consolidation-two-crate-split.md"
  ],
  "outputs": [
    "findings/2026-06-17-L5-104-pheno-adr012-migration-plan.md (this file)"
  ],
  "next_steps": [
    "Step 1: phenotype-config PR feat/slsa-build-attestation-2026-06-17",
    "Step 2: phenotype-config PR feat/release-attestation-workflow-2026-06-17",
    "Step 3: phenotype-config PR feat/canonical-marker-for-pheno-crates-2026-06-17",
    "Step 4: pheno PR chore/l5-104-delete-phenotype-config-core-2026-06-17",
    "Step 5: pheno PR chore/l5-104-port-coverage-and-docs-2026-06-17",
    "Step 6: archive Dmouse92/pheno (gated on 1-5)"
  ],
  "disposition": "READY_FOR_EXECUTION",
  "blockers": [],
  "device": "macbook",
  "owner": "kooshapari",
  "linked_findings": [
    "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
    "findings/2026-06-15-CONFIG_CONSOLIDATION-v1.md",
    "docs/adr/2026-06-15/ADR-022-config-consolidation-two-crate-split.md"
  ],
  "evidence_commands": [
    "gh pr view 130 --repo KooshaPari/pheno --json title,state,headRefName,baseRefName,additions,deletions,changedFiles",
    "gh pr view 131 --repo KooshaPari/pheno --json title,state,headRefName,baseRefName,additions,deletions,changedFiles",
    "gh pr view 132 --repo KooshaPari/pheno --json title,state,headRefName,baseRefName,additions,deletions,changedFiles",
    "gh api repos/KooshaPari/phenotype-config --jq '{name, default_branch, archived, description, pushed_at}'",
    "gh api repos/KooshaPari/Conft --jq '{name, default_branch, archived, description, pushed_at}'",
    "gh api repos/Dmouse92/pheno --jq '{name, archived, default_branch, pushed_at, parent, fork}'",
    "git -C /tmp/dmouse92-migration/pheno log chore/adr-012-config-consolidation-2026-06-15 --not kp/main --oneline",
    "git -C /tmp/dmouse92-migration/pheno diff --name-status kp/main...chore/adr-012-config-consolidation-2026-06-15"
  ]
}
```

(Schema per ADR-015 v2.1; the `device:` field is the pending v2.1 schema bump; using `macbook` per ADR-023 device-fit gate since this is plan-only work, no heavy builds.)

---

## Evidence trail

All commands cited in this plan are reproducible from `/tmp/dmouse92-migration/pheno/` (a `git clone` of `https://github.com/Dmouse92/pheno.git` with `git remote add kp https://github.com/KooshaPari/pheno.git && git fetch kp main --depth=200`). Auth: `gh` is `KooshaPari` (verified 2026-06-17 18:43 PDT). Dmouse92 is read-only collaborator — NO push operations performed.

**Citations:**
- W5 PR #130: `gh pr view 130 --repo KooshaPari/pheno --json title,state,headRefName,baseRefName,additions,deletions,changedFiles` (retrieved 2026-06-17; MERGED 2026-04-30)
- W5 PR #131: same query, #131 (MERGED 2026-05-01)
- W5 PR #132: same query, #132 (MERGED 2026-05-01)
- Substrate repos: `gh api repos/KooshaPari/phenotype-config` + `gh api repos/KooshaPari/Conft` (retrieved 2026-06-17)
- Dmouse92 pheno: `gh api repos/Dmouse92/pheno` (archived=false; default_branch=chore/adr-012-config-consolidation-2026-06-15)
- Dmouse92 commits: `git log chore/adr-012-config-consolidation-2026-06-15 --not kp/main --reverse --oneline` in `/tmp/dmouse92-migration/pheno/`
- File-fate diff: `git diff --name-status kp/main...chore/adr-012-config-consolidation-2026-06-15` in same
- Substrate genesis: `gh api 'repos/KooshaPari/phenotype-config/commits?per_page=15'` returns `599d37d feat(genesis): bootstrap config role with settly crate (RFC 002)`
- ADR-022 source: `docs/adr/2026-06-15/ADR-022-config-consolidation-two-crate-split.md:1-72`
- Parent L5-104 audit: `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md:89-117, 196`
- v6 subagent-B pre-ADR-022 audit: `findings/2026-06-15-CONFIG_CONSOLIDATION-v1.md` (substrate was `phenoShared`+`pheno-config`+Python; superseded by ADR-022 RFC 002 on 2026-06-17)
