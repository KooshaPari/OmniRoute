# Branch protection + repo policy for ArgisMonitor.

This document is the human-readable companion to
`.github/branch-protection.main.json` (the strict JSON payload applied
to `KooshaPari/ArgisMonitor`'s `main` branch via the GitHub REST API).

## Apply

```bash
gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  repos/KooshaPari/ArgisMonitor/branches/main/protection \
  --input .github/branch-protection.main.json
```

Requires admin scope on `KooshaPari/ArgisMonitor`. The repo is
currently `KooshaPari/OmniRoute`; rename it via GitHub Settings →
General → Repository name → `ArgisMonitor` (when ready).

## Policy (effective state once applied)

| Setting | Value |
|---------|-------|
| Required status checks (strict) | yes — see contexts in JSON |
| Enforce on admins | yes |
| Required PR reviews | yes, ≥1 approval |
| Code-owner review required | yes |
| Dismiss stale reviews on new push | yes |
| Last-push approval required | yes |
| Bypass list | `KooshaPari`, `maintainers` team, `renovate` & `github-actions` apps |
| Required linear history | yes (squash / rebase merges only) |
| Allow force pushes | **no** |
| Allow deletions | **no** |
| Block new branch creations | no |
| Required conversation resolution | yes |
| Lock branch | no |
| Allow fork syncing | yes |
| Required signed commits | yes |

## Branching model

- `main` — protected, linear history, signed, all checks required.
- `renames/<...>` — temporary, additive rename branches (Gate 1).
- `feature/<short-name>` — feature branches off `main`, PR required.
- `fix/<short-name>` — fix branches off `main`, PR required.
- `release/<semver-rc>` — release-candidate branches for `HeliosLite` /
  `ArgisMonitor` family RC verification; cut from `main`, merged back
  into `main` once RC is green.
- `nightly/<date>` — auto-generated nightly snapshot branches; never
  merged, archived after 30 days.

## Merge strategy

- All PRs merge into `main` via **squash** or **rebase**.
- Merge commits are forbidden on `main` (`required_linear_history: true`).
- Releases are cut from `main` by tagging with `v<semver>`.

## Release tags

- `v<MAJOR>.<MINOR>.<PATCH>` — stable
- `v<MAJOR>.<MINOR>.<PATCH>-rc.<n>` — release candidate
- `v<MAJOR>.<MINOR>.<PATCH>-nightly.<date>` — nightly snapshot

Tag triggers: `.github/workflows/argismonitor-publish.yml` (Gate 4),
`nightly-release-green.yml` (Gate 5), `cliff.yml` (Gate 3).

## Renovate

`renovate.json5` defines dependency-update policy. Patch + minor updates
auto-merge; major updates disabled by default and require manual review.

## Code owners

`CODEOWNERS` (added in Gate 3) defines per-path ownership. Required for
the `require_code_owner_reviews: true` setting above.

## Out of scope (Gate 4+)

- Multi-registry publishing workflows (Homebrew tap, Chocolatey, winget,
  crates.io) — separate per-registry files added in Gate 4.
- Deploy workflows (Vercel, Caddy) — added in Gate 6.
- Update notification cadence — added in Gate 5.