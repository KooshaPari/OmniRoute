# SPEC: pheno-template

## Meta
- **ID:** pheno-template
- **State:** specified
- **Version:** 1.0.0
- **Language:** Python 3 (stdlib only)
- **Source of truth:** `worklogs/pheno-template-skeleton-20260608.json`,
  `worklogs/pheno-template-generator-impl-evidence-20260608.json`

## 1. Overview
Reusable starter that emits the Phenotype Org + AgilePlus compliance
skeleton into a new KooshaPari repo. Distilled from five reference
adopters (focalpoint, phenotype-infra, phenotype-registry,
phenotype-tooling, phenotype-hub) that already converge on this exact
file set. Adopting the template removes governance drift before the
first commit.

**Non-goals:** language-specific scaffolding (Cargo.toml, pyproject,
package.json), CI runner images, secret material, vendor forks.

## 2. Surface
Single Python CLI: `pheno-template-generator-20260608.py`. One
flag-driven invocation emits 19 files at the repo root:

| # | File | Role |
|---|------|------|
| 1 | LICENSE | MIT, KooshaPari copyright |
| 2 | README.md | status badges + quick start |
| 3 | CONTRIBUTING.md | Conventional Commits + ADR/SPEC-first |
| 4 | SECURITY.md | private disclosure to kooshapari@gmail.com |
| 5 | CODEOWNERS | @KooshaPari default + per-path scoping |
| 6 | CODE_OF_CONDUCT.md | Contributor Covenant v2.1 |
| 7 | .github/FUNDING.yml | github: KooshaPari |
| 8 | CHANGELOG.md | Keep-a-Changelog, Unreleased section |
| 9 | .github/PULL_REQUEST_TEMPLATE.md | Summary / Type / Test plan |
| 10 | .github/ISSUE_TEMPLATE/bug_report.md | bug form |
| 11 | .github/ISSUE_TEMPLATE/feature_request.md | feature form |
| 12 | .github/dependabot.yml | weekly, 5 PR cap, multi-ecosystem |
| 13 | renovate.json5 | config:recommended, weekend, no docker/github-tags automerge |
| 14 | .github/release-drafter.yml | Conventional-Commits categories |
| 15 | .github/workflows/ci.yml | thin caller to phenoShared reusable |
| 16 | .github/workflows/scorecard.yml | OpenSSF Scorecard weekly |
| 17 | .github/workflows/health.yml | weekly governance checks |
| 18 | SPEC.md | meta + overview + ASCII arch + WBS |
| 19 | worklogs/README.md | category index |

## 3. Cross-Repo Roles
- **Template consumer:** every new KooshaPari repo (the five adopters
  above, plus future repos at `repos/<name>`).
- **Upstream dependency:** `KooshaPari/phenoShared/.github/workflows/reusable/ci.yml`
  pinned to a SHA — CI is delegated, not duplicated.
- **Sibling contract:** generator output must match the audit schemas
  in `worklogs/ossf-scorecard-audit-20260608.json` and
  `worklogs/repo-state-snapshot-20260608.json` byte-for-byte on the
  governed fields (CODEOWNERS, SECURITY.md age, dependabot enabled).

## 4. Compliance Table

| Requirement | File(s) | Status |
|---|---|---|
| OpenSSF Scorecard weekly | scorecard.yml | satisfied |
| Dependabot + Renovate | dependabot.yml, renovate.json5 | satisfied |
| Branch protection admin-enforced | health.yml check | satisfied |
| SECURITY.md age <180d | SECURITY.md | satisfied |
| CODEOWNERS present, default owner | CODEOWNERS | satisfied |
| Conventional Commits + release drafter | release-drafter.yml | satisfied |
| SPEC.md phased WBS | SPEC.md | satisfied |
| License, CoC, Funding | LICENSE, CODE_OF_CONDUCT.md, FUNDING.yml | satisfied |

## 5. Top Gaps
1. **No idempotency guard.** Re-running overwrites hand-edited files;
   needs a `--check` diff mode and a manifest hash.
2. **No language templates.** No Cargo.toml / pyproject.toml / package.json
   emitters; adopters hand-author language glue.
3. **Reusable workflow SHA pin is placeholder.** Spec uses `<sha>` literal;
   must resolve to a real phenoShared release tag before merge.
4. **No `--owner` flag.** Owner hardcoded to KooshaPari; blocks
   forks and org-internal transfers.
5. **No test fixture or golden snapshot.** The 19-file emission has no
   regression test; any string change is silent.
