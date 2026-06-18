# Cleanup PR Reviews (2026-06-17)

**Reviewer session:** 2026-06-18
**Reviewer cwd:** `/Users/kooshapari/CodeProjects/Phenotype/repos`
**Scope:** 6 PRs authored by KooshaPari on 2026-06-17 22:30 PDT — review-only (no merges).
**Critical environmental note:** At the time of this review, `KooshaPari/pheno-cost-card`, `pheno-llms-txt`, `pheno-prompt-test`, and `phenoForge` CI runs are failing with **GitHub Actions billing-limit errors** ("The job was not started because recent account payments have failed or your spending limit needs to be increased") — these failures are infrastructure-side, **not** code defects introduced by the PRs. Where a CI status below reads "fail", the cause is either (a) GitHub Actions billing, (b) a pre-existing workflow bug in the target repo, or (c) a real issue — distinguished in the rationale per PR.

---

## PR #1: KooshaPari/pheno-cost-card#1
- **Verdict:** APPROVE (with non-blocking cleanup recommendation)
- **Files changed:** 5 (+429 / −6)
- **CI status:** FAIL on all 8 test matrix jobs (ubuntu-latest & macos-latest × py3.10–3.13), SonarCloud FAIL — **root cause: GitHub Actions billing limit on KooshaPari account**, not code. Socket / GitGuardian / Semgrep / Cursor-Approval / CodeRabbit all PASS.
- **Rationale:** Diff is a textbook v2.0 → v2.1 worklog migration. WORKLOG.md gains the 11th `device:` column with **empty cells on legacy rows** — exactly the policy prescribed by `docs/adr/2026-06-17/ADR-025-worklog-v2-1-device-column.md:24-27` ("v2.0 worklogs (existing) remain valid; no retroactive edit required"). Pre-commit hook (`.pre-commit-config.yaml`) and `requirements-dev.txt` correctly adopt `pheno-vibecoding-guard` via the documented Python-API workaround (`pheno-cost-card/.pre-commit-config.yaml:1-23`). `audit_scorecard.json` is the L6 audit delta artifact; AGENTS.md update is scoped to the new lockfiles/secrets exclusion list.
- **Concerns:**
  - **PR title says "ADR-015"** but the actual decision lives in **ADR-025** (2026-06-17). ADR-015 (2026-06-15) is the v2.0 10-col schema; ADR-025 (2026-06-17) is the v2.1 bump that adds `device:`. The PR's intent matches ADR-025, not ADR-015 — please update the title/body to reference ADR-025 (and align with `docs/adr/2026-06-17/ADR-025-worklog-v2-1-device-column.md:13-21`).
  - The middle commit `wip: pre-push snapshot 2026-06-18T02:28:47Z from wrap-up session` (`oid 27b12d7a`) is hygiene noise — recommend squash before merge.
  - `audit_scorecard.json` (+393 LOC) is committed; check that `.gitignore` does not normally exclude it (L6 audits ship committed elsewhere — verify with the L6 audit convention before this lands).

---

## PR #2: KooshaPari/pheno-llms-txt#1
- **Verdict:** APPROVE
- **Files changed:** 5 (+112 / −1)
- **CI status:** test FAIL — **root cause: GitHub Actions billing limit**, not code. CodeRabbit PASSED, Cursor Approval PASSED, GitGuardian / Socket / Semgrep all PASS, SonarCloud FAIL (cancelled as cascade from test failure).
- **Rationale:** Adds the `init_llms(repo_dir)` scaffold-kit entrypoint as advertised in the V6 Track 2 plan. Function contract `{ok, llms_txt, repo_dir}` (or `{ok: False, error}`) is uniform with the sibling `init_prompt_test` design (PR #3) — this is exactly what the pheno-scaffold-kit orchestrator needs to treat sub-steps uniformly. Three new tests cover happy-path / missing-dir / idempotent re-runs (`pheno-llms-txt/tests/test_init.py:1-28`). The pre-commit hook + `requirements-dev.txt` additions mirror PRs #1 and #3 — consistent.
- **Concerns:**
  - SonarCloud says "cancelled" (likely because the test job was blocked on billing). Once billing is restored, re-trigger to get a real SonarCloud verdict.
  - The same `wip:`-style middle commit / pre-commit hook adoption commit belongs to the parent branch — both PR #2 and PR #3 share the same first commit (`e534181a` vs `ab497388`, same message but different SHA) which is a fleet-wide pattern; verify they're not unintentionally duplicating work across PRs.
  - **PR title says "ADR-015"** — should be ADR-025 for the `device:` column migration aspect (same comment as PR #1, but this PR does **not** touch WORKLOG.md so the ADR-015/025 reference in the body is more about the pre-commit hook layer than the schema itself).

---

## PR #3: KooshaPari/pheno-prompt-test#1
- **Verdict:** APPROVE
- **Files changed:** 5 (+97 / −0)
- **CI status:** test FAIL (both runs) — **root cause: GitHub Actions billing limit**, not code. CodeRabbit PASSED, Cursor Approval PASSED, GitGuardian / Socket / Semgrep all PASS.
- **Rationale:** Same shape as PR #2: `init_prompt_test(repo_dir)` scaffold-kit entrypoint with uniform `{ok, prompts_dir, created}` / `{ok: False, error}` return contract. Three tests cover layout-creation / idempotent re-run / missing-dir (`pheno-prompt-test/tests/test_init.py:1-29`). Drive-by fix for the `pyproject.toml` `requires =` / stray `["hatchling"]` block is a real bug fix — without it, the package would not build. The exception swallow (`except Exception` → `{ok: False, error}`) is the right shape for scaffold-kit consumption.
- **Concerns:**
  - **pyproject.toml drive-by fix is silently bundled.** Recommend mentioning it explicitly in the PR body — it's the kind of thing reviewers should see even though it's pre-existing.
  - Same billing-induced test failure cascade as PR #2.
  - `tests/prompts/` skeleton created with a single `README.md` explaining `*.prompt` YAML format — good. But the README does not link to the schema or give an example YAML — consider adding a 3-line example inline (`name:`, `prompt:`, `expect:` keys).

---

## PR #4: KooshaPari/pheno-agents-md#1
- **Verdict:** REQUEST_CHANGES (CI is genuinely broken on this repo)
- **Files changed:** 19 (+1065 / −1)
- **CI status:** test FAIL — **root cause is REAL, not billing**: `.github/workflows/ci.yml` pins `dtolnay/rust-toolchain@5b0e0c1e7e6a86e7b6a7f6e7e6a86e7b6a7f6e7e # placeholder`, which is not a real commit SHA. GitHub error: *"Unable to resolve action `dtolnay/rust-toolchain@5b0e0c1e7e6a86e7b6a7f6e7e6a86e7b6a7f6e7e`, unable to find version `5b0e0c1e7e6a86e7b6a7f6e7e6a86e7b6a7f6e7e`"*. CodeRabbit FAIL with "Insufficient usage credits" (separate infra quota on the CodeRabbit bot, not the PR). Cursor Approval PASSED; Socket / GitGuardian / Semgrep all PASS.
- **Rationale:** Governance bundle is correct and complete: `CODEOWNERS` matches the meta-repo pattern (`* @kooshapari`, identical to the root `/Users/kooshapari/CodeProjects/Phenotype/repos/CODEOWNERS`); ISSUE_TEMPLATES (bug/feature/question/security_report) follow the org convention; `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE` are mirrored from the canonical meta-repo files (Commit `a5580e9` message: "Mirror canonical governance files from the org root"); PULL_REQUEST_TEMPLATE is exemplary (114 lines, What/Why/How/Testing/Checklist/Risk-and-Rollout sections — see `pheno-agents-md/.github/PULL_REQUEST_TEMPLATE.md:1-114`); `Cargo.toml` gains a top-level `[workspace]` opt-out (`pheno-agents-md/Cargo.toml:14-15`) — exactly the substrate-placement rule from ADR-023. The `ci.yml` change (`ubuntu-latest` → `ubuntu-24.04`) is the org convention per the commit message in the diff.
- **Concerns:**
  - **BLOCKING:** The placeholder SHA in `.github/workflows/ci.yml` must be fixed before merge. Replace `dtolnay/rust-toolchain@5b0e0c1e7e6a86e7b6a7f6e7e6a86e7b6a7f6e7e  # placeholder` with the real pinned SHA from the `dtolnay/rust-toolchain` repo (or use a tag like `dtolnay/rust-toolchain@stable` since `with: toolchain: stable` already pins the rust version). This is a **pre-existing** bug but blocks merge.
  - **PR body claims "6 commits"** but the actual count is **7** (verified via `gh pr view --json commits`). The 7th commit is `feat(pheno-agents-md): render AGENTS.md from config` (`oid 55e3212a`, 2026-06-18) which appears to be a post-push push. Either squash/clean the history or update the body.
  - **CONTRIBUTING.md references `docs/governance/background_agent_policy.md`** which does not exist in this repo (`ls pheno-agents-md/docs/` shows no governance directory). Same concern applies to PRs #5 and #6 — all three mirror the same CONTRIBUTING.md template with a broken link.
  - Branch name `chore/pheno-agents-md-ubuntu-pin-2026-06-12` is correct but the PR title says "add CODEOWNERS + governance files (Ubuntu pin)" — the Ubuntu pin is 1 of 6-7 commits; the title's scope (just CODEOWNERS + governance) doesn't match the diff.
  - `Cargo.toml` adds `[workspace]` as a no-op (`pheno-agents-md/Cargo.toml:14-15`) — correct per the comment ("standalone testable unit; opt out of the parent monorepo workspace"), but verify with `cargo metadata --no-deps --format-version=1` that it doesn't accidentally break the meta-repo workspace discover.

---

## PR #5: KooshaPari/phenoForge#1
- **Verdict:** APPROVE (with non-blocking CI workaround notes)
- **Files changed:** 9 (+759 / −0)
- **CI status:** Rust Benchmarks FAIL, Legacy Tooling Anti-Pattern Scan FAIL, Rust Security Audit FAIL — **all three are pre-existing workflow bugs, not code regressions from this PR**. check-changes PASS, trufflehog PASS.
- **Rationale:** The substantive change is the WORKLOG.md v2.1 migration (`phenoForge/WORKLOG.md:1-5` adds the 11th `device:` column with the same "empty on legacy rows" policy as PR #1). `SSOT.md` (`phenoForge/SSOT.md:1-31`) is a clean precedence table that matches the meta-repo SSOT.md pattern. `CODE_OF_CONDUCT.md`, `docs/index.md`, `docs/slsa.md`, `llms.txt`, and `audit_scorecard.json` are all conventional governance/docs additions. `release-attestation.yml` is the SLSA Build L2 attestation workflow — desirable for any release-grade substrate. Claim of "4 commits" verified ✓.
- **Concerns:**
  - **Rust Benchmarks FAIL is a workflow permission issue** (`actions/github-script` step gets `403 Resource not accessible by integration` when posting the PR comment — needs `permissions: pull-requests: write` at the job level). This is a **pre-existing** workflow bug in `.github/workflows/benchmark.yml`, not introduced by this PR. Note in the merge commit message so it's tracked.
  - **Legacy Tooling FAIL** is a case-sensitivity bug: the workflow does `actions/checkout` with `repository: kooshapari/phenotype` (lowercase) but the actual repo is `KooshaPari/Phenotype`. GitHub's REST API returns 404 for the lowercase form. **Pre-existing** bug; recommend a follow-up ADR or PR to fix the case.
  - **Rust Security Audit FAIL** is the gitleaks-action v2 breaking change (`gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7` requires `GITHUB_TOKEN` env var — README of the action specifies this). **Pre-existing** workflow bug; needs the GHA workflow to set `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` explicitly on the `gitleaks/gitleaks-action` step.
  - **PR title says "ADR-015"** — should be **ADR-025** (same as PR #1; the `device:` column decision lives in ADR-025 not ADR-015).
  - **WIP commit** `wip: pre-push snapshot 2026-06-18T02:28:47Z from wrap-up session` should be squashed before merge.
  - `audit_scorecard.json` L1 Architecture score = 0 ("No source files found.") and L7 Extensibility = 0 ("0 source files. Config: 0 features.") — this is correct for a governance-only PR (the source tree is unchanged in this PR), but the scorecard is committed at `phenoForge/audit_scorecard.json` which is debatable. The scorecard reflects the repo's current state, not the PR's delta.
  - `README.md` adds a "Documentation" section pointing at `docs/index.md` — good, but `docs/index.md` only has 18 lines and is a stub. Either expand it now or land a follow-up.

---

## PR #6: KooshaPari/docs-site#1
- **Verdict:** REQUEST_CHANGES (Gemini Code Assist flagged 3 substantive issues; all real)
- **Files changed:** 12 (+363 / −0)
- **CI status:** No CI test jobs (docs-only repo, no Rust/Python/Node/Go manifests to build). CodeAnt-AI Review PASS, Cursor Approval PASS, GitGuardian / Socket / Semgrep all PASS. Kilo Code Review still QUEUED. **Three Gemini Code Assist comments on the PR require author response.**
- **Rationale:** Governance bundle is consistent with PRs #4 and #5. `dependabot.yml` is conventional (cargo + pip + npm + gomod + github-actions; monthly cadence, Monday grouping, semver-major ignore) — matches the org-wide dependabot pattern. `CHANGELOG.md` is a clean Keep-a-Changelog template with the `[Unreleased]` placeholder and `[0.1.0]` initial entry. CODEOWNERS, ISSUE_TEMPLATES, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, LICENSE all mirror the meta-repo canonicals.
- **Concerns (all from Gemini Code Assist — must be addressed before merge):**
  - **HIGH SEVERITY — security_report.md as a public issue template.** Gemini flagged this as a security concern: GitHub issues are public by default, so a public "Security report" template can leak vulnerability details before they're disclosed. Recommended fix: **delete** `.github/ISSUE_TEMPLATE/security_report.md` and add a `SECURITY.md` instruction (already exists at `docs-site/SECURITY.md:1-24`) that points users at `github.com/KooshaPari/docs-site/security/advisories/new` for private disclosure. The same fix should propagate to PR #4 (pheno-agents-md) which has the identical template.
  - **MEDIUM — broken link in CONTRIBUTING.md.** CONTRIBUTING.md line 39 references `./docs/governance/background_agent_policy.md` but `docs/governance/` does not exist in this repo. Either (a) drop the governance section, (b) inline the policy, or (c) link to the meta-repo absolute URL (`https://github.com/KooshaPari/Phenotype/blob/main/docs/governance/background_agent_policy.md`). Same fix in PR #4 and PR #5.
  - **MEDIUM — dependabot.yml overreach.** `docs-site` is a documentation site with no `Cargo.toml`, `pyproject.toml`, `package.json`, or `go.mod`. Dependabot for cargo/pip/npm/gomod will produce "no manifest" warnings. Either drop the unused ecosystems or add the necessary package manifests. Recommend: **drop cargo/pip/npm/gomod blocks**; keep only `github-actions` (since this repo does run GitHub Actions).
  - **Commit author identity.** Commit `47b15d5` (the dependabot.yml commit) was authored by `forge@phenotype.local` with name "Forge Automation" — this differs from the rest of the PR (which uses `kooshapari@gmail.com` with name "Forge"). Not blocking, but suggests two different forge identities were used; pick one for audit traceability.
  - `CODEOWNERS` line uses `@kooshapari` (lowercase) instead of `@KooshaPari` (canonical case) — GitHub is case-insensitive for usernames so this works, but the root meta-repo `CODEOWNERS` uses `@KooshaPari`. Cosmetic but worth normalizing.
  - Branch name `chore/dependabot-2026-06-08` predates the governance bundle commits (which are 2026-06-15) — branch was likely rebased/force-pushed. Acceptable but worth noting in the body.

---

## Summary
- **Approve:** 4/6 — PRs #1, #2, #3, #5
- **Request changes:** 2/6 — PRs #4, #6
- **Blockers:**
  - **PR #4:** Pre-existing placeholder SHA in `.github/workflows/ci.yml` (`dtolnay/rust-toolchain@5b0e0c1e7e6a86e7b6a7f6e7e6a86e7b6a7f6e7e`) breaks the `test` job — must be replaced with a real SHA or `dtolnay/rust-toolchain@stable` (already pinned via `with: toolchain: stable`). Also: PR body claims "6 commits" but actually has 7.
  - **PR #6:** `ISSUE_TEMPLATE/security_report.md` is a security leak vector (public-by-default issues can leak vulnerability details) — must be removed or replaced with a SECURITY.md-only advisory flow pointer. `dependabot.yml` lists ecosystems (cargo/pip/npm/gomod) that have no manifest in this repo — drop unused ecosystems. CONTRIBUTING.md has a broken `./docs/governance/background_agent_policy.md` link.
  - **Cross-cutting (informational, not blockers):** PR titles referencing "ADR-015" for the `device:` column migration should reference **ADR-025** (`docs/adr/2026-06-17/ADR-025-worklog-v2-1-device-column.md`). ADR-015 is the v2.0 10-col schema; ADR-025 is the v2.1 bump.
- **Ready-to-merge list (after addressing blockers):**
  - **Approve as-is:** PR #2 (pheno-llms-txt#1), PR #3 (pheno-prompt-test#1)
  - **Approve after WIP-commit squash + ADR-025 title fix:** PR #1 (pheno-cost-card#1), PR #5 (phenoForge#1)
  - **Block until fixed:** PR #4 (pheno-agents-md#1 — replace placeholder rust-toolchain SHA), PR #6 (docs-site#1 — remove public security_report template, drop unused dependabot ecosystems, fix broken governance link)
- **Post-merge follow-ups (non-blocking):**
  - Pre-existing CI workflow bugs in `phenoForge`: `benchmark.yml` PR-comment permission scope, `legacy-tooling-gate.yml` case-sensitive `kooshapari/phenotype` checkout path, `security.yml` gitleaks-action `GITHUB_TOKEN` env var.
  - Same `ISSUE_TEMPLATE/security_report.md` template issue exists in PR #4 — propagate the PR #6 fix to PR #4.
  - Same `CONTRIBUTING.md` broken `./docs/governance/background_agent_policy.md` link exists in PRs #4, #5, #6 — fix in one place, propagate.
