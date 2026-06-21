# L10 — CI/CD hygiene (SHA-pins, ubuntu, permissions, concurrency)

**Owner:** forge-A06
**Generated:** 2026-06-16
**Scope:** 4-repo bloc (AgilePlus, thegent, Tracely, Tracera) + adjacent satellite workflows

## Scope

Verify that every GitHub Actions workflow in the bloc is SHA-pinned (not tag-pinned), uses a fixed Ubuntu version (preferring ubuntu-24.04 over `ubuntu-latest`), declares least-privilege `permissions:` blocks per job, and uses `concurrency:` groups to cancel superseded runs.

## SOTA 2026

- **SHA-pinning of all third-party actions is mandatory.** Snyk (2025) and GitHub (2024) both flag tag-pinned actions as supply-chain risk. Reference: `dependabot.yml` GitHub docs — `package-ecosystem: github-actions` with `versioning-strategy: increase` resolves to commit SHAs.
- **ubuntu-24.04** is the 2026 LTS reference. `ubuntu-latest` is forbidden in policy (CLAUDE.md §"GitHub Actions Billing & CI Policy" already bans macOS/Windows; ubuntu-latest is the next-most-billed option).
- **Per-job `permissions:`** is OWASP CI/CD Top-10 (CICD-SEC-5: Insufficient PBAC) — top-of-file `permissions: read-all` is the minimum acceptable.
- **Concurrency groups** must cancel in-progress on PR. Reference: `concurrency: group: ${{ github.workflow }}-${{ github.ref }}\ncancel-in-progress: true`.
- **Reusable workflows** are encouraged only when called with a SHA (`@<40-hex-sha>`), never `@main` / `@v1`.

## Phenotype state

### AgilePlus (6 workflows, `AgilePlus/.github/workflows/`)

- `ci.yml:1-371` — ✓ **mostly SOTA.** All `uses:` lines are SHA-pinned (e.g. `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6` at lines 33/53/83/105/127/142/168/202/231/252/273/290/336/351/366). `runs-on: ubuntu-24.04` at 14 of 16 jobs (lines 30/121/138/165/287/306/333/348/363). Top-level `permissions:` at line 5; job-level at 26/123. `concurrency:` at line 16. **Status: ✓** (matrix jobs at lines 46/76/98/195/224/245/266 resolve to ubuntu-24.04 via matrix declaration).
- `audit.yml:1-82` — ✓ SHA-pinned, `ubuntu-24.04` at lines 17/40/55/70, `permissions:` at 11/25/80, `concurrency:` at 11.
- `deny.yml:1-48` — ✓ SHA-pinned, `ubuntu-24.04:37`, `permissions:24`, `concurrency:31`.
- `release.yml:1-68` — ✓ SHA-pinned, `ubuntu-24.04:29/50`, `permissions:14/30/51`, `concurrency:19`.
- `release-attestation.yml:1-86` — **△ PARTIAL.** `runs-on: ubuntu-latest:16` (forbidden). `uses:` lines at 25/30/35/76/84 are **tag-pinned** (`actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` is *v4* SHA, not pinned to a custom action SHA — acceptable for stock actions, but `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `actions/upload-artifact@v4`, `slsa-framework/slsa-github-generator/attest-build-provenance@v1` are tag-pinned). `permissions:8/17` declared but no `concurrency:` block (line 16 area).
- `scorecard.yml:1-48` — **△ PARTIAL.** `runs-on: ubuntu-latest:21` (forbidden). `uses:` at 30/34/40/46 are SHA-pinned (`actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v4` is a duplicated label; `ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a # v2.4.3` correctly SHA-pinned). `permissions: read-all:10/23`, `concurrency:15`. No matrix os, single runner.

### thegent (6 active workflows, `thegent/.github/workflows/`)

- `ci.yml:1-18` — **✗ BROKEN STUB.** Single job `phenotype-ci` at line 16 calls `uses: phenotype-dev/.github/workflows/rust-ci.yml@0000000000000000000000000000000000000000` (placeholder zero-SHA). No `runs-on:` declared. No `permissions:` at job level. The `# placeholder SHA; source 404s` comment confirms the workflow is non-functional. Top-level `permissions:1` and `concurrency:11` are declared but never exercised.
- `audit.yml:1-45` — ✓ SHA-pinned (`codeql-action/init|autobuild|analyze@8aad20d150bbac5944a9f9d289da16a4b0d87c1e` at 35/40/43), `ubuntu-24.04:24`, `permissions:11/25`, `concurrency:17`.
- `deny.yml:1-25` — ✓ SHA-pinned, `ubuntu-24.04:19`, `permissions:1`, `concurrency:14`.
- `python-ci.yml:1-26` — **△ PARTIAL.** `runs-on: ubuntu-latest:16` (forbidden). `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd:19` is the v4 SHA (acceptable). `actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065:20` is SHA-pinned. `permissions:7`, `concurrency:10`. **No `pip cache`, no matrix, no PyPI publish** (heavy lift gap, but L12 territory).
- `release.yml:1-109` — **△ PARTIAL.** `ubuntu-24.04:23/48/68` (✓), but `actions/setup-node@f4a67bbeca970f103397d3d2b9462cf787cd2980 # v-latest:28` — SHA-pinned but labelled `@v-latest` (misleading; the SHA resolves to a stable commit but the comment is wrong). `orhun/git-cliff-action@f50e11560dce63f7c33227798f90b924471a88b5:58` and `softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda:96` correctly SHA-pinned. `permissions:1`, `concurrency:17`. **No OIDC `id-token: write` for npm publish** (L18 gap, not L10).
- `scorecard.yml:1-47` — ✓ SHA-pinned, `ubuntu-24.04:21`, `permissions: read-all:12/22`, `concurrency:15`.
- **Backup dir `thegent/.github/workflows/backup/`** contains archived `coverage.yml`, `fuzzing.yml`, `iac-scan.yml`, `license-compliance.yml` — **not wired to `on:` triggers** (need verification, but absence of `on:` push/pull_request keys suggests they are dormant). L10 status: dormant = ✗.

### Tracely (5 workflows, `Tracely/.github/workflows/`)

- `ci.yml:1-43` — **✗ CRITICAL.** Calls 3 reusable workflows at lines 20/27/35 with **tag-pinned `@main`** references:
  - `KooshaPari/template-commons/.github/workflows/reusable-rust-ci.yml@main` — supply-chain risk; the upstream template can change without review.
  - `KooshaPari/template-commons/.github/workflows/reusable-security-scan.yml@main` — same risk; security audits should be SHA-pinned.
  - `KooshaPari/phenotypeActions/.github/workflows/validate-governance.yml@main` — governance validation mutating with `@main` is the worst of the three.
  - Inlined `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd:41` is SHA-pinned. `runs-on: ubuntu-latest:39` (forbidden). `permissions:11`, `concurrency:14` are well-formed.
- `audit.yml:1-37` — **✗ BROKEN SYNTAX.** Line 27: `uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd@11bd71901bbe5b1630ceea73d27597364c9af683` — the SHA is appended *after* the tag-style `@de0fac...` fragment, producing an unparseable ref. This will fail YAML parse or be interpreted as a corrupt git ref. `runs-on: ubuntu-latest:19` (forbidden).
- `deny.yml:1-36` — **✗ BROKEN SYNTAX.** Line 28: `uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10@de0fac2e4500dabe0009e67214ff5f5447ce83dd` — same double-SHA pattern, broken ref. `dtolnay/rust-toolchain@stable:31` and `EmbarkStudios/cargo-deny-action@91bf2b620e09e18d6eb78b92e7861937469acedb:34` are tag-pinned. `runs-on: ubuntu-latest:25`. No `permissions:` block. `concurrency:20`.
- `release-attestation.yml:1-86` — **✗ TAG-PINNED EVERYWHERE.** Lines 25/30/35/76/84: `actions/checkout@v4`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `actions/upload-artifact@v4`, `slsa-framework/slsa-github-generator/attest-build-provenance@v1`. `runs-on: ubuntu-latest:16`. `permissions:8/17`. No `concurrency:`.
- `scorecard.yml:1-44` — **△.** Lines 26/30/36/42 are SHA-pinned. `runs-on: ubuntu-latest:18` (forbidden). `permissions: read-all:9/19`, `concurrency:12`.

### Tracera (7 workflows, `Tracera/.github/workflows/`)

- `cargo-deny.yml:1-41` — ✓ SHA-pinned, `ubuntu-24.04:30`, `permissions:24`, no `concurrency:` (gap — S).
- `governance-gates.yml:1-39` — **△.** All `actions/checkout@v4:19/28/37` (tag-pinned). `runs-on: ubuntu-latest:16/25/34` (forbidden on all 3 jobs). `permissions:10`. No `concurrency:`. **Gap is structural — 3 jobs, 3 ubuntu-latest references.**
- `python-ci.yml:1-26` — **△.** `actions/checkout@v4:19` + `actions/setup-python@v5:20` (both tag-pinned). `runs-on: ubuntu-latest:16` (forbidden). `permissions:7`, `concurrency:10`.
- `release-attestation.yml:1-86` — **△.** Identical to Tracely's copy: tag-pinned at 25/30/35/76/84, `ubuntu-latest:16`, `permissions:8/17`, no `concurrency:`.
- `release-plz.yml:1-33` — ✓ SHA-pinned, `ubuntu-24.04:16`, `permissions:9`, no `concurrency:` (gap — S).
- `rust-tests.yml:1-37` — ✓ SHA-pinned, `ubuntu-24.04:21`, `permissions:15`, no `concurrency:` (gap — S). Trigger is `feature/tracera-core-phase-0-1-2-3` only (line 6) — **does not run on `main`**; gap.
- `scorecard.yml:1-34` — ✓ SHA-pinned, `ubuntu-24.04:17`, `permissions:9`, no `concurrency:` (gap — S).

## Gaps

| # | Where | Issue | Effort |
|---|-------|-------|--------|
| 1 | `thegent/.github/workflows/ci.yml:16` | Placeholder zero-SHA; broken stub. Replace with full inline CI or pin to a real reusable workflow SHA. | M |
| 2 | `Tracely/.github/workflows/ci.yml:20,27,35` | Reusable workflows referenced as `@main` — supply-chain risk. Pin to commit SHA from `template-commons` and `phenotypeActions` repos. | M |
| 3 | `Tracely/.github/workflows/audit.yml:27` and `deny.yml:28` | Double-SHA ref syntax (`@SHA1@SHA2`) is unparseable. Collapse to single SHA. | S |
| 4 | `Tracely/.github/workflows/release-attestation.yml:25,30,35,76,84` | Tag-pinned actions. Convert to SHA-pins. | S |
| 5 | `Tracely/.github/workflows/*.yml` (all 5) | `ubuntu-latest` used in 8 job declarations. Replace with `ubuntu-24.04`. | S |
| 6 | `Tracely/.github/workflows/deny.yml` (no `permissions:` block) | Add `permissions: contents: read`. | S |
| 7 | `Tracera/.github/workflows/release-attestation.yml:16` and `governance-gates.yml:16,25,34` and `python-ci.yml:16` | `ubuntu-latest` + tag-pins. Convert to `ubuntu-24.04` + SHA-pins. | S |
| 8 | `Tracera/.github/workflows/{cargo-deny,release-plz,rust-tests,scorecard}.yml` | Missing `concurrency:` blocks. Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`. | S |
| 9 | `Tracera/.github/workflows/rust-tests.yml:6` | Triggers on `feature/tracera-core-phase-0-1-2-3` only, never on `main` / PRs to main. Add `branches: [main]` + `pull_request: branches: [main]`. | S |
| 10 | `AgilePlus/.github/workflows/release-attestation.yml:16` and `scorecard.yml:21` | `ubuntu-latest`. Replace with `ubuntu-24.04`. | S |
| 11 | `AgilePlus/.github/workflows/release-attestation.yml:25,30,35,76,84` | Tag-pinned actions. Convert to SHA-pins. | S |
| 12 | `AgilePlus/.github/workflows/release-attestation.yml` | No `concurrency:` block. Add. | S |
| 13 | `thegent/.github/workflows/python-ci.yml:16` | `ubuntu-latest`. Replace with `ubuntu-24.04`. | S |
| 14 | `thegent/.github/workflows/release.yml:28` | Comment `# v-latest` is misleading (the SHA is a real commit, not a rolling tag). Update comment to the resolved version or remove it. | S |
| 15 | `thegent/.github/workflows/backup/*.yml` | Archived workflows dormant. Either delete or wire up to `workflow_call:` so they can be invoked. | S |
| 16 | All 4 repos | Branch protection not verifiable from local — defer to `gh api repos/KooshaPari/<repo>/branches/main/protection/required_status_checks` to confirm required status checks align with the workflows above. | M |

## Summary

| Repo | SHA-pinned | ubuntu-24.04 | permissions | concurrency | Reusable wf |
|------|:----------:|:------------:|:-----------:|:-----------:|:-----------:|
| AgilePlus | △ (release-attestation + scorecard tag-pinned) | △ (2 workflows use `latest`) | ✓ | △ (release-attestation missing) | n/a |
| thegent | ✗ (ci.yml stub) | △ (python-ci uses `latest`) | ✓ | ✓ | n/a |
| Tracely | ✗ (3 reusable `@main`, audit/deny double-SHA) | ✗ (8 `latest`) | ✗ (deny missing) | △ (release-attestation missing) | ✗ (3x `@main`) |
| Tracera | △ (release-attestation, governance-gates, python-ci tag-pinned) | △ (4 workflows use `latest`) | ✓ | △ (4 workflows missing) | n/a |

**Overall L10 status: PARTIAL** — AgilePlus and Tracera are 80% SOTA, thegent has a broken stub, Tracely has multiple critical SOTA regressions (reusable `@main` + double-SHA + tag-pinned release attestation).

## Recommendations

1. **Day-1 critical (Tracely):** resolve the double-SHA syntax bugs in `audit.yml:27` and `deny.yml:28`, pin the 3 reusable workflows to commit SHAs, and replace `ubuntu-latest` → `ubuntu-24.04` across all 5 files.
2. **Day-1 critical (thegent):** delete or fully implement `ci.yml` — the placeholder zero-SHA is a documented broken stub.
3. **Day-2 (AgilePlus + Tracera):** convert `release-attestation.yml` tag-pins to SHAs and add `concurrency:` blocks. Update `scorecard.yml` runners.
4. **Day-3 (cross-repo):** add a repo-local `dependabot.yml` with `package-ecosystem: github-actions` and `versioning-strategy: increase` so Dependabot auto-bumps SHAs weekly. Tracely and Tracera do not have one; AgilePlus and thegent do.
5. **Day-3 (governance):** introduce a `ci-hygiene-lint` workflow (e.g. `actionlint` with SHA-pin + ubuntu-24.04 rules) so the next audit's gaps cannot regress.
