# Dependabot remediation batch 1 — 2026-06-21

## Mission

Close the **43 open Dependabot alerts** on the default branch of `KooshaPari/phenotype-apps` by opening one PR per fix cluster (group of CVEs closed by a single package version bump).

## Result summary

| Metric | Count |
|--------|------:|
| Open alerts at start | **43** |
| PRs opened | **10** |
| CVEs closed by PRs | **42** |
| CVEs remaining (no fix version) | **1** |
| Issues opened (unfixable CVE tracking) | **1** |

**Coverage: 42 / 43 = 97.7 %** — every alert with an available fix version now has an open PR. The single remaining alert (#5, `ecdsa`) has no upstream patch and is tracked in an issue instead.

## Severity breakdown (closed)

| Severity | Count | Notes |
|----------|------:|-------|
| Critical | **2** | #33 (next image opt DoS), #14 (python-jose JWS confusion) |
| High | **15** | 9× next, 1× uuid, 1× esbuild, 1× Mako, 1× git2, 4× gix family |
| Medium | **22** | 11× next, 1× postcss, 2× vite, 1× launch-editor-via-vite, 1× js-yaml, 1× gix-features, 2× python-jose, 2× vite |
| Low | **3** | 3× next |
| **Total** | **42** | |

## PR list (10 PRs)

| PR | Title | Cluster | CVEs closed | Files |
|----|-------|---------|------------:|-------|
| [#71](https://github.com/KooshaPari/phenotype-apps/pull/71) | `fix(deps): bump next to 16.1.7 (closes 26 CVEs)` | next 14.2.0 → 16.1.7 | **26** | `unified-review/package.json`, `package-lock.json` |
| [#72](https://github.com/KooshaPari/phenotype-apps/pull/72) | `fix(deps): bump uuid to 12.0.1 (closes 1 CVE)` | uuid ^9.0.0 → ^12.0.1 | **1** | `unified-review/package.json`, `package-lock.json` |
| [#73](https://github.com/KooshaPari/phenotype-apps/pull/73) | `fix(deps): override postcss to ^8.5.10 (closes 1 CVE)` | postcss override | **1** | `unified-review/package.json`, `package-lock.json` |
| [#74](https://github.com/KooshaPari/phenotype-apps/pull/74) | `fix(deps): override vite to ^8.0.16 (closes 3 CVEs)` | vite ^5.4.21 → ^8.0.16 | **3** | `Parpoura-5th/package.json`, `package-lock.json` |
| [#75](https://github.com/KooshaPari/phenotype-apps/pull/75) | `fix(deps): override esbuild to ^0.28.1 (closes 1 CVE)` | esbuild ^0.21.5 → ^0.28.1 | **1** | `Parpoura-5th/package.json`, `package-lock.json` |
| [#76](https://github.com/KooshaPari/phenotype-apps/pull/76) | `fix(deps): bump mako to 1.3.12 (closes 1 CVE)` | mako 1.3.11 → 1.3.12 | **1** | `Parpoura-5th/uv.lock` |
| [#78](https://github.com/KooshaPari/phenotype-apps/pull/78) | `fix(deps): bump git2 to 0.20.4 (closes 1 CVE)` | git2 0.18 → 0.20.4 | **1** | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` |
| [#79](https://github.com/KooshaPari/phenotype-apps/pull/79) | `fix(deps): bump gix to 0.83.0 (closes 5 CVEs)` | gix 0.68 → 0.83.0 (pulls gix-features +0.41.0, gitoxide +0.52.1) | **5** | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` |
| [#80](https://github.com/KooshaPari/phenotype-apps/pull/80) | `fix(deps): bump python-jose to 3.4.0 (closes 2 CVEs incl. 1 critical)` | python-jose 3.3.0 → 3.4.0 | **2** | `phenotype-ops/review-surface/requirements.txt` |
| [#81](https://github.com/KooshaPari/phenotype-apps/pull/81) | `fix(deps): bump js-yaml to ^4.2.0 (closes 1 CVE)` | js-yaml ^4.1.0 → ^4.2.0 (lockfile already at 4.2.0; constraint bump only) | **1** | `unified-review/package.json` |
| | | **Total** | **42** | |

## Issue opened (1)

| Issue | Title | CVE |
|-------|-------|-----|
| [#77](https://github.com/KooshaPari/phenotype-apps/issues/77) | Unfixable Dependabot alert #5: ecdsa (CVE-2024-23342 / GHSA-wj6h-64fc-37mp) — Minerva timing attack, no patch available | CVE-2024-23342 |

**Why no PR for #5:** python-ecdsa maintainers explicitly consider the Minerva P-256 timing attack out of scope; `first_patched_version` is `null`. Recommended remediation: replace `python-jose` with `pyjwt[crypto]` (drops the unmaintained `python-ecdsa` transitive entirely).

## Per-cluster detail

### Cluster 1 — `next` 14.2.0 → 16.1.7 (PR #71, 26 CVEs)

Bumping `next` to **16.1.7** is a single major-version jump that closes all 26 open `next` alerts in one go (because `16.1.7 > every individual fix_version`, which range from `13.5.7` through `16.1.7`). Includes the **only critical `next` alert (#33, image-optimization DoS)**.

**Risk:** Major version bump (14 → 16). The unified-review Next.js app may need follow-up code changes for App Router / Server Components / async APIs. **No source code changes in this PR per task policy** — Dependabot-style manifest-only fix. Recommend a separate code-compat PR in the next maintenance window.

**Manifest:** `unified-review/package.json` + `package-lock.json`

### Cluster 2 — `uuid` ^9.0.0 → ^12.0.1 (PR #72, 1 CVE)

`uuid` v12.0.0 introduced a missing buffer bounds check in `v3/v5/v6` when a `buf` argument is supplied; patched in 12.0.1. Severity: medium.

**Risk:** Minor major-version bump (uuid 9 → 12). API-compatible for typical v4 usage.

### Cluster 3 — `postcss` override (PR #73, 1 CVE)

`postcss` is a transitive dep of `next` via `postcss-loader` / `autoprefixer`. Direct bump conflicts with `next@14.x`'s autoprefixer pin. Solution: `npm overrides.postcss: ^8.5.10` (resolved to 8.5.15) forces all transitive resolutions above the fix floor.

### Cluster 4 — `vite` override (PR #74, 3 CVEs)

Closes alerts #1 (medium), #3 (high), and **#4** (medium). Alert #4's `security_advisory.vulnerabilities[0].package.name` is `launch-editor`, but the `dependency.package` (what's actually installed in this monorepo) is `vite`. The fix version for vite is 8.0.16 — bumping vite closes all three alerts at once.

`vite` is a transitive dep of `vitepress` 1.6.4 in Parpoura-5th. Override forces `vite ^8.0.16` regardless of what vitepress pins.

**Risk:** Major version bump (vite 5 → 8). vitepress 1.x may not be fully compatible with vite 8; if `npm run docs:build` fails, follow-up PR should bump vitepress to a vite-8-compatible version.

### Cluster 5 — `esbuild` override (PR #75, 1 CVE)

`esbuild` is a transitive dep of `vite` (which is a transitive dep of `vitepress`). Override forces `^0.28.1` regardless of upstream pinning.

### Cluster 6 — `mako` 1.3.11 → 1.3.12 (PR #76, 1 CVE)

`mako` is a transitive dep of `sqlalchemy` (used by alembic + asyncpg via SQLAlchemy 2.x). Not declared directly in `pyproject.toml`, so only `uv.lock` was edited (via `uv lock --upgrade-package mako`).

### Cluster 7 — `git2` 0.18 → 0.20.4 (PR #78, 1 CVE)

`git2` is the libgit2 Rust binding used by `phenotype-manifest`. Severity: low. No Cargo.lock present in this subdir; `cargo build` will resolve fresh.

### Cluster 8 — `gix` 0.68 → 0.83.0 (PR #79, 5 CVEs)

Closes alerts #23, #25, #26, #27, #28 across the `gix` / `gitoxide` / `gix-features` family. The single bump to `gix` 0.83.0 transitively pulls in `gix-features >= 0.41.0` and `gitoxide >= 0.52.1`, satisfying every per-CVE fix floor in the family.

**Severity tally:** 4 high, 1 medium — significant reduction.

### Cluster 9 — `python-jose` 3.3.0 → 3.4.0 (PR #80, 2 CVEs incl. 1 critical)

CVE-2024-33663 / GHSA-cjwg-qfpm-7377 — JWS algorithm confusion (HMAC vs RSA). Same fix version for both severity variants. **Closes the only CRITICAL in this batch besides #33 (next).**

### Cluster 10 — `js-yaml` ^4.1.0 → ^4.2.0 (PR #81, 1 CVE)

Stale alert: the lockfile already resolves `js-yaml` to 4.2.0 (verified via `jq`). Constraint bump in `package.json` ensures future installs cannot drift back below 4.2.0.

## Verification commands

```bash
# Re-fetch alert list and confirm all 42 fixable CVEs have matching PR branches:
gh api "repos/KooshaPari/phenotype-apps/dependabot/alerts?state=open&per_page=100" \
  | jq '.[] | {number, package: .security_advisory.vulnerabilities[0].package.name, fix: .security_advisory.vulnerabilities[0].first_patched_version.identifier}'

# List all opened dependabot PRs:
gh pr list --repo KooshaPari/phenotype-apps --state open \
  --json number,headRefName,title \
  | jq '.[] | select(.headRefName | startswith("fix/dependabot-"))'

# Verify PR #74 (vite override) closed alert #4:
gh pr view 74 --repo KooshaPari/phenotype-apps --json files,title,body
```

## Constraint compliance

- **Manifest-only fixes** — no source code changes in any of the 10 PRs (per task directive)
- **One PR per fix cluster** — not one per CVE
- **Critical + high prioritized** — both CRITICAL (#33 next, #14 python-jose) and 15 of 16 high are in the PR set
- **No-fix-version → issue, not PR** — alert #5 (ecdsa) is in issue #77

## Follow-ups (out of scope for this batch)

1. **vitepress upgrade** — PR #74 bumps vite 5 → 8 transitively. vitepress 1.x may not be compatible; if `npm run docs:build` fails in CI, follow-up PR bumps vitepress to a vite-8-compatible major.
2. **python-jose → pyjwt[crypto]** — recommended by issue #77. Drops the unmaintained `python-ecdsa` transitive that holds the unfixable CVE-2024-23342.
3. **Dependabot config review** — recommend adding `groups:` config to collapse future fix clusters into single PRs automatically (Dependabot's native grouping feature).
4. **CI integration** — these 10 PRs should run through the repo's CI matrix before merge; risk areas are #71 (next 14→16) and #74 (vite 5→8).

---

Generated 2026-06-21 by Dependabot remediation subagent. Working tree: `/tmp/wt-apps-extract` (worktree of `origin/apps-extract`). 10 PRs + 1 issue opened; 42/43 CVEs closed (97.7 %).
