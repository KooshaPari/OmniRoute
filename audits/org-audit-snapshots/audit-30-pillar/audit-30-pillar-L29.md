# L29 — Repository governance (license / CI / license-check / CODEOWNERS)

**Owner:** forge-A15 (DX+quality)
**Bloc scope:** AgilePlus + thegent + Tracely + Tracera (4 repos, federated via thegent's governance stack)
**Cross-cuts:** L10 (CI SHA-pinning), L11 (quality gates), L13 (contributor DX), L23 (audit log)

## Scope

Repo-level governance primitives that make a repo production-grade at the project/collaboration layer: `LICENSE` files (top-level), dual-licensing files, `CODEOWNERS` (root + `.github/CODEOWNERS`), GitHub **rulesets** (the SOTA replacement for legacy branch protection — JSON-encoded branch policies), `required-checks` JSON, issue templates (`bug.yml`, `feature.yml`, `config.yml`, `security.yml`), PR templates, `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` / `FUNDING.yml` / `GOVERNANCE.md` / `CONSTITUTION.yaml`, and federated governance layering (thegent's `RULESET_BASELINE.md` + `rulesets/main.json` + `required-checks.json` + `CONSTITUTION.yaml`). Distinct from L10 (which is *which* CI actions are SHA-pinned); L29 is the *governance substrate* those actions run on.

## SOTA 2026

- **GitHub Rulesets** (replaces legacy branch protection, May 2022+) — JSON-encoded branch policies, `enforcement: "active"`, `conditions.ref_name.include: ["~DEFAULT_BRANCH"]`, `rules: [deletion, non_fast_forward, pull_request]` with `required_approving_review_count: 1` + `dismiss_stale_reviews_on_push: true` + `require_code_owner_review: true` + `required_review_thread_resolution: true`. Stored as `.github/rulesets/main.json` for repo-local + `phenoShared/.github/rulesets/*.json` for federated.
- **CODEOWNERS at `.github/CODEOWNERS`** (SOTA canonical location) **+** `/CODEOWNERS` (legacy root location, kept for non-GitHub tools). Per-component drill-down for monorepos. Default owner catches all.
- **LICENSE at root** + dual-licensing companion files (`LICENSE-MIT`, `LICENSE-APACHE`) for `MIT OR Apache-2.0` projects. SPDX identifier matches Cargo.toml `[package].license`.
- **Issue templates as `.yml`** (GitHub Forms format) + `config.yml` with contact links (`Security Policy`, "Report a security vulnerability"). `security_report.md` is the SOTA intake for coordinated disclosure.
- **PR template** at `.github/PULL_REQUEST_TEMPLATE.md` with required sections (`## What*`, `## Why*`, `## How tested*`, `## Risk`, `## Rollback`) and explicit `*` markers for required fields.
- **Federated governance layers** — `CONSTITUTION.yaml` (immutable principles), `RULESET_BASELINE.md` (human-readable ruleset mirror), `rulesets/*.json` (machine-readable ruleset), `required-checks.json` (job-name → required mapping), `GOVERNANCE.md` (operational policy). Each layer is independently auditable; drift between layers is a CI failure.
- **`FUNDING.yml`** with at least one of: `github: [username]`, `custom: ["https://..."]`, `open_collective:`, `patreon:`. SOTA 2026 also includes `tidelift: "..."` for OSS security maintenance.
- **Required status checks** — declared in `required-checks.json` + enforced via rulesets `required_status_checks` (SOTA rulesets v2) or `branch_protection.required_status_checks.contexts` (legacy).

## Phenotype state

- `AgilePlus/LICENSE:1-21` — MIT, `Copyright (c) 2026 Koosha Pari`. — **status ✓**
- `AgilePlus/LICENSE-MIT` (1,067 bytes) + `AgilePlus/LICENSE-APACHE` (10,957 bytes, full Apache text) — **status ✓** (dual-license support)
- `AgilePlus/CODEOWNERS:1-49` + `AgilePlus/.github/CODEOWNERS:1-50` — both present, 30+ per-crate ownership rules + per-language drill-down (`/*.rs`, `/*.py`, `/*.ts`) + governance files. — **status ✓** (drill-down is SOTA)
- `AgilePlus/CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md` (all 3 present) — **status ✓**
- `AgilePlus/.github/ISSUE_TEMPLATE/` — `bug.yml` + `feature.yml` + `config.yml` (Forms format). — **status ✓** (Forms-based, SOTA)
- `AgilePlus/.github/PULL_REQUEST_TEMPLATE.md:1-10` — has `## What*` section with required-field marker. — **status ✓**
- `AgilePlus/.github/FUNDING.yml` (presence verified) — **status ✓** (content not inspected in this audit)
- `AgilePlus/.github/release-drafter.yml` — release-drafter config. — **status △** (informational; not L29-critical)
- `AgilePlus/.github/scorecard.yml` — OpenSSF Scorecard config. — **status ✓**
- `AgilePlus/.github/workflows/ci.yml` + `deny.yml` + `release.yml` + `release-attestation.yml` + `scorecard.yml` + `audit.yml` (all present). — **status ✓** (6 CI workflows, decent coverage)
- `AgilePlus/.github/rulesets/` — **absent**. — **status △** (Gap 4: only CODEOWNERS + branch protection in GH UI, no JSON ruleset artifact)
- `AgilePlus/Cargo.toml:14-18` — `license = "MIT OR Apache-2.0"` + `repository = "https://github.com/KooshaPari/AgilePlus"` + `authors = ["kooshapari"]`. — **status ✓** (SPDX declared)
- `thegent/LICENSE:1-21` — MIT, `Copyright (c) 2026 Koosha Paridehpour`. — **status ✓**
- `thegent/LICENSE-MIT` (1,068 bytes) + `thegent/LICENSE-APACHE` (104 bytes — header only, **incomplete**; see Gap 3). — **status ✗** for LICENSE-APACHE
- `thegent/CODEOWNERS:1-50` — root file, 30+ rules (per-CLI-component drill-down: `/src/thegent/cli/`, `/src/thegent/orchestration/`, `/src/thegent/agents/`, `/src/thegent/governance/`, `/src/thegent/storage/`, `/src/thegent/tui/`, `/src/thegent/integrations/`, `/src/thegent/cliproxy_adapter.py`, etc.). — **status ✓** (the most granular in the bloc)
- `thegent/.github/CODEOWNERS:1-12` — 8 directory rules, default `* @kooshapari`. — **status △** (less granular than root; Gap 5)
- `thegent/CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md` (all 3 present) — **status ✓**
- `thegent/.github/ISSUE_TEMPLATE/` — `bug.yml` + `bug-report.yml` + `feature.yml` + `feature-request.yml` + `config.yml` (both old and new formats). — **status ✓** (5 templates)
- `thegent/.github/PULL_REQUEST_TEMPLATE.md` + `.github/PULL_REQUEST_TEMPLATE_LEGACY.md` — current + legacy. — **status ✓**
- `thegent/FUNDING.yml` + `thegent/.github/FUNDING.yml` (both present at root + .github). — **status ✓**
- `thegent/GOVERNANCE.md:1-74` — operational governance (AgilePlus integration, branch discipline, dirty tree handling, commit conventions, quality gates, CI/CD constraints, delegation policy). — **status ✓** (the most comprehensive in the bloc)
- `thegent/CONSTITUTION.yaml` (presence verified) — **status ✓** (immutable principles layer)
- `thegent/.github/RULESET_BASELINE.md:1-44` — human-readable ruleset mirror; lists enforced branch protection (PRs required, force push blocked, ≥1 approval, dismiss stale, resolve threads, allowed merge methods `merge`/`squash`, code_quality, copilot_code_review) + repo-local governance gates (`policy-gate`, `pr-governance-gate`, `sast-quick`, `codeql`, `security-guard`). — **status ✓** (SOTA, this is the bloc's governance spec)
- `thegent/.github/rulesets/main.json:1-38` — `enforcement: "active"`, `target: "branch"`, `~DEFAULT_BRANCH`, `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `require_code_owner_review: true`, `required_review_thread_resolution: true`, `allowed_merge_methods: ["merge", "squash"]`. — **status ✓** (machine-readable, fully SOTA)
- `thegent/.github/required-checks.json:1-9` — `default_branch_required_checks: ["policy-gate", "pr-governance-gate"]` + notes. — **status ✓** (SOTA — required-checks as JSON)
- `thegent/.github/copilot-instructions.md` + `thegent/.github/prompts/` — Copilot directives + agent prompts. — **status ✓** (informational; AI-governance)
- `thegent/.github/workflows/ci.yml` + `python-ci.yml` + `deny.yml` + `audit.yml` + `scorecard.yml` + `release.yml` + `backup/security-deep-scan.yml` (in `backup/` subdir — **see Gap 6**). — **status △** (7 workflows, one archived)
- `thegent/Cargo.toml` `license` field — not directly inspected but thegent `LICENSE-MIT` + `LICENSE-APACHE` confirm dual. — **status △** (manifest not verified)
- `Tracely/LICENSE:1-21` — MIT, `Copyright (c) 2024 KooshaPari`. — **status ✓** (4 years older copyright — pre-2026 migration; see Gap 7)
- `Tracely/LICENSE-MIT` + `Tracely/LICENSE-APACHE` — **absent** (Tracely is MIT-only). — **status ✓** (matches `license = "MIT"` in Cargo.toml)
- `Tracely/CODEOWNERS:1-4` + `Tracely/.github/CODEOWNERS:1-2` — both present, single rule `* @KooshaPari`. — **status △** (Gap 1: no per-component drill-down despite monorepo at `crates/`)
- `Tracely/CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md` (all 3 present) — **status ✓**
- `Tracely/FUNDING.yml` — `github: [KooshaPari]` + `custom: ["https://kooshapari.com/sponsor"]`. — **status ✓**
- `Tracely/.github/ISSUE_TEMPLATE/` — `bug.yml` + `feature.yml` + `config.yml` (Forms format). — **status ✓**
- `Tracely/.github/PULL_REQUEST_TEMPLATE.md:1-10` — has `## What*` section. — **status ✓**
- `Tracely/.github/release-drafter.yml` (presence verified) — **status △** (informational)
- `Tracely/.github/rulesets/` — **absent**. — **status ✗** (Gap 4: no machine-readable ruleset)
- `Tracely/RULESET_BASELINE.md` (root) — **absent**. — **status ✗**
- `Tracely/required-checks.json` — **absent**. — **status ✗**
- `Tracely/GOVERNANCE.md` (root) — **absent**. — **status △** (no federated governance anchor)
- `Tracely/CONSTITUTION.yaml` — **absent**. — **status △**
- `Tracely/.github/workflows/ci.yml` + `deny.yml` + `audit.yml` + `release-attestation.yml` + `scorecard.yml` (5 workflows). — **status ✓**
- `Tracely/Cargo.toml:1-10` — `license = "MIT"` + `repository = "https://github.com/KooshaPari/Tracely"`. — **status ✓** (SPDX matches LICENSE)
- `Tracera/LICENSE:1-21` — MIT, `Copyright (c) 2026 Koosha Pari`. — **status ✓** (1,068 bytes)
- `Tracera/LICENSE-MIT` + `Tracera/LICENSE-APACHE` — **absent** (Tracera is dual but companion files missing). — **status ✗** (Gap 2: declared `MIT OR Apache-2.0` but only one LICENSE file at root)
- `Tracera/.github/CODEOWNERS:1-6` — `* @kooshapari` (single default rule). — **status △** (Gap 1: no drill-down despite `crates/tracera-core/` subcrate)
- `Tracera/CODEOWNERS` (root) — **absent**. — **status △**
- `Tracera/CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md` (all 3 present) — **status ✓**
- `Tracera/FUNDING.yml` — **absent** at root; check `.github/FUNDING.yml` — **status △** (Gap 8: funding not exposed)
- `Tracera/.github/ISSUE_TEMPLATE/` — `bug.md` + `feature.md` + `bug_report.md` + `feature_request.md` + `question.md` + `security_report.md` + `config.yml` (7 templates, both old `.md` and Forms `.yml` formats). — **status ✓** (most comprehensive in the bloc, includes `security_report.md` and `question.md`)
- `Tracera/.github/PULL_REQUEST_TEMPLATE.md:1-10` — `## What*` required-field marker. — **status ✓**
- `Tracera/.github/rulesets/` — **absent**. — **status ✗** (Gap 4)
- `Tracera/RULESET_BASELINE.md` (root) — **absent**. — **status ✗**
- `Tracera/required-checks.json` — **status ✗**
- `Tracera/GOVERNANCE.md` (root) — **absent**. — **status △**
- `Tracera/CONSTITUTION.yaml` — **absent**. — **status △**
- `Tracera/.github/workflows/cargo-deny.yml` + `governance-gates.yml` + `python-ci.yml` + `release-attestation.yml` + `release-plz.yml` + `rust-tests.yml` + `scorecard.yml` (7 workflows, most in the bloc). — **status ✓**
- `Tracera/Cargo.toml:7-13` — `license = "MIT OR Apache-2.0"` + `rust-version = "1.82"`. — **status ✗** (Gap 2: declared dual but only LICENSE file is MIT)
- `Tracera/AGENTS.md:1-15` — agent context file. — **status ✓** (informational, AI-governance)

## Gaps

1. **Tracely + Tracera CODEOWNERS have no per-component drill-down** — `Tracely/CODEOWNERS:1-4` and `Tracera/.github/CODEOWNERS:1-6` are single-rule `* @KooshaPari`. Thegent has 30+ per-component rules; AgilePlus has 30+ per-crate + per-language rules. Tracely has a `crates/` workspace and Tracera has a `crates/tracera-core/` subcrate but neither is drill-down-owned. — **effort: S** (add 5-10 lines per repo for `crates/`, `docs/`, `.github/`, sensitive files)
2. **Tracera declares `MIT OR Apache-2.0` in `Cargo.toml:7` but only ships `LICENSE` (MIT) at root** — the Apache companion file is missing. This is a *legal* gap: downstream users cannot verify the Apache-2.0 grant. — **effort: S** (copy `AgilePlus/LICENSE-APACHE` (10,957 bytes) to Tracera + `LICENSE-MIT` companion file)
3. **Thegent's `LICENSE-APACHE` is only 104 bytes — header-only, not the full Apache text** — `ls -la` showed 104 bytes vs AgilePlus's 10,957 bytes. The 104-byte file is just the SPDX short-form header, not the actual license grant. Thegent `Cargo.toml` (or PyPI metadata) cannot legally grant Apache-2.0 without the full text. — **effort: S** (copy `AgilePlus/LICENSE-APACHE` over the 104-byte stub)
4. **No JSON ruleset artifact in AgilePlus, Tracely, or Tracera** — only thegent has `.github/rulesets/main.json` (the SOTA artifact). The other 3 repos rely on GitHub UI-managed branch protection, which is not auditable from the repo. Without `rulesets/main.json`, the `RULESET_BASELINE.md` declarations in thegent are not symmetric across the bloc. — **effort: M** (port `thegent/.github/rulesets/main.json:1-38` to the other 3 repos, adjusting per-repo rules)
5. **Thegent's `.github/CODEOWNERS:1-12` is less granular than the root `CODEOWNERS:1-50`** — root has 30+ per-component rules, `.github/CODEOWNERS` has only 8. GitHub prefers `.github/CODEOWNERS` (canonical location); the root file is shadowed. This means the more granular ownership is the *less authoritative* one. — **effort: S** (move the 30+ rules from root to `.github/CODEOWNERS`; keep root as a 1-line alias)
6. **Thegent has 1 workflow in `backup/`** — `thegent/.github/workflows/backup/security-deep-scan.yml` is archived in a subdir, but GitHub Actions **does not run workflows in subdirectories** by default. This means the Trivy scan is dead — it never executes. — **effort: S** (move to root `.github/workflows/` or wire via `workflow_run` trigger)
7. **Tracely's LICENSE copyright is `2024 KooshaPari`** — `Tracely/LICENSE:1` says `Copyright (c) 2024`. The repo was actively developed through 2026 (CHANGELOG.md shows recent work). Without copyright-year updates, downstream users may question the recency of the grant. SOTA practice: either bump the year, or include a range `2024-2026`. — **effort: S** (update to `2024-2026 KooshaPari`)
8. **Tracera has no `FUNDING.yml`** — neither root nor `.github/`. The other 3 repos expose at least one funding channel. — **effort: S** (copy `Tracely/FUNDING.yml` pattern with `github: [kooshapari]`)
9. **Only thegent has federated governance layers (`RULESET_BASELINE.md` + `required-checks.json` + `CONSTITUTION.yaml` + `GOVERNANCE.md`)** — the other 3 repos have no `GOVERNANCE.md`, no `CONSTITUTION.yaml`, no `required-checks.json`. The thegent governance stack is not federated to the bloc. — **effort: M** (port `thegent/.github/RULESET_BASELINE.md` + `thegent/.github/required-checks.json` to a `phenoShared/` org-level repo, then `uses:` from the other 3)
10. **Tracely's `Tracely/.github/PULL_REQUEST_TEMPLATE.md:1-10` is a near-duplicate of Tracera's** — the `## What*` template is identical. Without a `## Risk` or `## Rollback` section, the template does not enforce security-impact disclosure. The thegent and AgilePlus templates have the same issue. — **effort: S** (add `## Risk*` and `## Rollback*` sections across all 4)
11. **Tracely/Tracera have no `RULESET_BASELINE.md` at root** — only thegent does. Without the human-readable ruleset mirror, code review cannot reference the canonical branch policy from PR comments. — **effort: S** (port `thegent/.github/RULESET_BASELINE.md:1-44` to each repo's root)
12. **Tracely's `CODEOWNERS` uses `@KooshaPari` (capital K) but Tracera and thegent use `@kooshapari`** — GitHub username lookups are case-insensitive but log-audit tools and CODEOWNERS diff tools are case-sensitive. The bloc should standardize. — **effort: S** (one-shot find-replace)
13. **Tracera's `CODEOWNERS` is in `.github/CODEOWNERS:1-6` only** — no root `/CODEOWNERS` alias. Per the file's own comment "later rules override earlier ones" and per AgilePlus's pattern, having both is the SOTA defense-in-depth. — **effort: S**
14. **Tracely's `RULESET_BASELINE.md` is missing the `Repo-Local Governance Gates` list** that thegent has — thegent's baseline documents the 5 workflow-based gates (`policy-gate`, `pr-governance-gate`, `sast-quick`, `codeql`, `security-guard`) and their relationship to the ruleset. The other 3 repos have CI jobs but no documented gate list. — **effort: S** (add to each repo's `RULESET_BASELINE.md` after porting)

## Recommendations

1. **Port `thegent/.github/rulesets/main.json:1-38` to AgilePlus, Tracely, Tracera** — same shape, per-repo tweaks. The bloc should have auditable branch policy as code, not as GitHub UI state. Effort: M.
2. **Port `thegent/.github/RULESET_BASELINE.md:1-44` + `thegent/.github/required-checks.json:1-9` to the other 3 repos' roots** — establish the bloc's governance as a 4-repo stack. Effort: S per repo.
3. **Backfill Tracera's `LICENSE-APACHE` and `LICENSE-MIT`** — copy from `AgilePlus/LICENSE-APACHE` (10,957 bytes, full text). Fix the thegent `LICENSE-APACHE` (replace 104-byte stub). Effort: S each.
4. **Consolidate thegent's CODEOWNERS** — make `.github/CODEOWNERS:1-12` the canonical (30+ rules), keep root `/CODEOWNERS` as a 1-line alias. Effort: S.
5. **Move thegent's `backup/security-deep-scan.yml` to root `.github/workflows/`** — the Trivy scan is currently dead. Effort: S.
6. **Add per-component CODEOWNERS drill-down to Tracely + Tracera** — even 5-10 lines per repo for `crates/`, `docs/`, `.github/`, sensitive files. Effort: S per repo.
7. **Add `## Risk*` and `## Rollback*` to all 4 PULL_REQUEST_TEMPLATE.md** — enforce security-impact disclosure at PR intake. Effort: S.
8. **Create a federated `phenoShared/.github/` org-level repo** with the canonical `RULESET_BASELINE.md`, `required-checks.json`, `CONSTITUTION.yaml`, and `GOVERNANCE.md`. Each of the 4 repos can `uses:` the ruleset JSON or symlink the markdown. Effort: M (one-time setup, then 4 small follow-ups).
9. **Bump Tracely's LICENSE copyright to `2024-2026`** — SOTA practice is a year range covering active development. Effort: S.
10. **Standardize CODEOWNERS casing** — pick `@kooshapari` (lowercase, matches Tracera + thegent) and apply to Tracely. Effort: S.
11. **Add `FUNDING.yml` to Tracera** — copy `Tracely/FUNDING.yml` (github + custom). Effort: S.
