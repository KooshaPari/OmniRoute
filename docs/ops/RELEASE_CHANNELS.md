---
title: Release Channels
---

# Release Channels

Automated release channel system for OmniRoute. Defines the channel taxonomy, how builds are auto-triggered, how they climb the stability ladder, and how to manually intervene.

This doc covers the **auto-release system**. For the manual release procedure see [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md). For the green-validation gate see [`RELEASE_GREEN.md`](./RELEASE_GREEN.md).

## Channel taxonomy

Six channels, in stability order. Each one is a separate `npm dist-tag`, a separate Docker tag, and a separate GitHub Release marked appropriately as prerelease.

| Channel | Stability | Blocking CI gates | npm dist-tag | Docker tag | GitHub prerelease | Trigger |
|---------|-----------|-------------------|--------------|------------|-------------------|---------|
| `nightly` | 0 (most primitive) | `build` | `nightly` | `nightly` | yes | auto (24h OR ≥5k LOC) |
| `canary` | 1 | + `unit`, `vitest`, `integration` | `canary` | `canary` | yes | auto-promote |
| `alpha` | 2 | + `e2e`, `security` | `alpha` | `alpha` | yes | auto-promote |
| `beta` | 3 | + `resilience`, `llm-security` | `beta` | `beta` | yes | auto-promote |
| `rc` | 4 | + `chaos`, `fuzz`, `perf`, `load` | `next` | `rc` | yes | auto-promote |
| `stable` | 5 | + `cross-platform`, `a11y`, `release-green` | `latest` | `latest` | no | auto-promote |
| `lts-{n}` | past stable | `core` matrix only | `lts-{n}` | `lts-{n}` | no | manual cut |

Canonical definition: [`config/release/channels.json`](../../config/release/channels.json). Runtime gate lookup: [`config/release/ci-matrix.json`](../../config/release/ci-matrix.json).

## How a release happens

```
   ┌───────────────────────┐
   │  push to main OR      │
   │  cron @07:00 UTC      │  ← .github/workflows/auto-release.yml
   └──────────┬────────────┘
              │
              ▼
   ┌───────────────────────┐
   │  trigger-evaluator    │  ← scripts/release/trigger-evaluator.mjs
   │  24h  OR +5k  OR -5k  │
   └──────────┬────────────┘
              │ fire?
       no ────┴──── yes
       │              │
       ▼              ▼
    exit 0    ┌─────────────────────┐
              │  channel-resolver   │  ← scripts/release/channel-resolver.mjs
              │  walks promotion    │
              │  order until a gate │
              │  fails              │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  publish-github     │
              │  publish-npm        │
              │  publish-docker     │
              └─────────────────────┘
```

### 1. Auto-trigger rule

The trigger fires when **any** of these is true:

- `now - lastReleaseTs ≥ 24h`
- `git diff --shortstat lastRelease..HEAD` adds **≥ 5,000 lines**
- `git diff --shortstat lastRelease..HEAD` removes **≥ 5,000 lines**

The trigger always produces a `nightly` build (the most primitive channel). Higher channels are reached by promotion, not re-trigger.

Tunable in [`config/release/channels.json`](../../config/release/channels.json) under
`autoTrigger.conditions`. CLI: `npm run release:trigger`.

### 2. Channel resolution

Given the trigger fired, the resolver walks the ladder:

```
nightly (build) → canary (+unit,vitest,integration) → alpha (+e2e,security)
  → beta (+resilience,llm-security) → rc (+chaos,fuzz,perf,load)
  → stable (+cross-platform,a11y,release-green)
```

For each channel, all `requiredGates.blocking` must be green for the commit SHA. Advisory gates are reported but never block.

The walker stops at the **first channel whose blocking-gate list is incomplete**. So:

- Build red → still publishes `nightly` (the trigger fired; build was red at the moment of trigger but green by the time the resolver runs, or the resolver never sees it because the trigger can't fire on red builds anyway — see note below).
- Build green but unit red → publishes `nightly`.
- Unit green, e2e red → publishes `canary`.
- All green through `stable` → publishes `stable`.

> **Note**: in practice the trigger only fires on a green build of `main` because `auto-release.yml` runs *after* the `ci.yml` build job has finished. If `main` is red, neither the time-based nor the diff-based trigger produces a release; the next push that turns green re-evaluates both conditions and fires.

### 3. Publish

Per channel:

- **GitHub Release**: `v{version}` with `prerelease=true` for nightly/canary/alpha/beta/rc.
- **npm**: `npm publish --tag={npmDistTag}`. The `latest` tag is only moved by `stable` promotion.
- **Docker**: `ghcr.io/{owner}/omniroute:{dockerTag}` and `:v{version}`. **Skipped for `nightly`** (too much churn, fills GHCR storage).

## Manual operations

### Promote a build to a specific channel

```bash
gh workflow run release-channels.yml -f promote-channel=beta -f promote-sha=abc1234 -f promote-version=3.8.43
```

This runs `release-channels.yml#promote`, which re-evaluates the resolver with `--max-channel=beta` so even a stable-eligible build is held at `beta`.

### Force-cut an LTS branch

```bash
gh workflow run release-channels.yml -f lts-base=3.8.43 -f lts-branch=lts/3.8
```

Creates `lts/3.8` from the tag, opens a backport-tracking issue, and pins CI to the core matrix only.

### Cleanup (retention)

`release-channels.yml#cleanup` runs weekly. Enforces `channels.<ch>.retention`:

- `nightly`: latest 3 per base version
- `canary`/`alpha`/`beta`/`rc`: latest 5 per base version
- `stable`: keep forever
- `lts-{n}`: keep until the LTS branch is EOL (tracked in `channels.json#channels.lts`)

### Dry-run the full pipeline locally

```bash
npm run release:dry-run
```

Runs `trigger-evaluator --dry-run` then `channel-resolver --dry-run` against synthetic check-runs and prints the resolved channel + version without contacting GitHub.

## CI matrix coverage

| Gate | In PR (ci.yml) | Nightly | Weekly | On-demand | Channels that gate on it |
|------|:---:|:---:|:---:|:---:|---------|
| `build` | ✓ | ✓ | — | — | all |
| `unit`, `vitest`, `integration` | ✓ | ✓ | — | — | canary+ |
| `e2e`, `security` | ✓ | ✓ | — | — | alpha+ |
| `release-green` | — | ✓ | — | ✓ | stable |
| `resilience` (heap, chaos, k6-soak) | — | ✓ | — | — | beta+ |
| `llm-security` (promptfoo, garak) | — | ✓ | — | — | beta+ |
| `mutation` | — | ✓ | — | — | advisory |
| `property` | — | ✓ | — | — | advisory |
| `schemathesis` | — | ✓ | — | — | advisory |
| `a11y` | — | ✓ | — | — | stable |
| `chaos` | — | — | ✓ | — | rc+ |
| `fuzz` | — | ✓ | ✓ | — | rc+ |
| `perf` | — | — | ✓ | — | rc+ |
| `load` (k6 smoke) | — | ✓ | — | — | rc+ |
| `cross-platform` | — | — | — | ✓ | stable |

### Known gaps

- **`cross-platform`** is `workflow_dispatch`-only. To make `stable` fully automatable, schedule it weekly (e.g. `cron: '0 6 * * 1'`).
- **LTS backport CI** is not yet implemented as a reusable workflow. The `lts-cut` job in `release-channels.yml` references one but it needs to be created.

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run release:matrix` | Print gate-ID alignment between `channels.json` and `ci-matrix.json`. |
| `npm run release:trigger` | Run the trigger evaluator with `--last-release-ts`, `--added-lines`, and `--removed-lines`. |
| `npm run release:trigger:json` | Same, JSON output only (for piping). |
| `npm run release:resolve` | Run channel resolver for a SHA. Reads `gh api .../check-runs` by default; pass `--check-runs file.json` or `--gate-status '{...}'` for offline runs. |
| `npm run release:resolve:test` | Run resolver against a synthetic check-runs file. |
| `npm run release:dry-run` | End-to-end dry run: trigger → resolve → print publish plan. |

## Adding a new channel

1. Add the channel definition to [`config/release/channels.json`](../../config/release/channels.json).
2. Add the new gate IDs to `config/release/channels.json#gates` with workflow + check-run names.
3. Mirror them in [`config/release/ci-matrix.json`](../../config/release/ci-matrix.json) with the freshness window.
4. Insert into `promotionOrder`.
5. Run `npm run release:matrix` to verify alignment.
6. If the channel needs a new artifact destination (e.g. an apt repo), extend `auto-release.yml#publish-*` jobs.
