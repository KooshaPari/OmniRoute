---
repo: "phenotype-landing"
role: landing
status: archived
last_boundary_review: 2026-07-17
review_cadence: dormant
in_scope:
  - "Multi-tenant Astro landing site factory (7 sites: agileplus, byteport, hwledger, phenokits, projects, thegent, odin)"
  - "Coordination via root Taskfile.yml + .github/workflows/ci.yml"
  - "Shared design tokens / ui components under packages/ (design-tokens already absorbed into phenodocs)"
  - "Subtree pull workflow for site-level reversibility"
out_of_scope:
  - "Single Astro landing page (the source is NOT a single landing — it is a 7-site factory)"
  - "phenodocs/packages/landing/ code absorption (architecturally mismatched; see audit)"
  - "VitePress integration (phenodocs is VitePress; landing is Astro)"
  - "pheno mono-Cargo absorption (this is a TypeScript/Astro monorepo, not Rust)"
  - "Cross-site CI/build orchestration (each site deploys independently to Vercel)"
depends_on:
  - "astro"
  - "bun"
  - "vercel (per-site)"
  - "github-api (per-site for stats fetches)"
depended_on_by:
  - "search-engine-crawlers (per-site marketing/SEO)"
  - "social-media-OG-previews (per-site)"
---

# Boundary — phenotype-landing

## Decision (2026-07-17): ARCHIVE_ONLY (no absorption into phenodocs)

`phenotype-landing` was audited against the planned absorption into
`phenodocs/packages/landing/` on 2026-07-17 and **the absorption was rejected**.
The source repo is archived on GitHub and the registry row is set to
`fsm=absorbed`, `disposition=ARCHIVE_ONLY`. No code from `phenotype-landing` is
moved into `phenodocs`. A forward-pointer README is created at
`phenodocs/packages/landing/` explaining the deferred state.

This follows the same pattern as the parallel ARCHIVE_ONLY decisions for
`omniroute-rust` and `PhenoVCS` on the same day.

## Why absorption failed

The absorption-runbook failsafe clause allows skipping the `cp -r` step when
"build is heavy or conflicts exist". Both conditions were demonstrably met:

### 1. Architecturally mismatched target

`phenodocs` is a **VitePress federation hub** (single root `package.json`,
`workspaces: ["packages/*"]`, `vitepress dev`/`build` scripts, Vue 3). Adding
`packages/landing/` with 7 Astro sites + 7 `vercel.json` + 7 CI workflows + 7
`bun.lock` files + ~1.4 GB of `node_modules` would:

- Create 7 nested bun install contexts that the root `bun install` cannot hoist
- Create 7 deployment targets each with its own `vercel.json` outside VitePress's build
- Make `packages/landing/` itself an empty workspace entry (since `phenotype-landing`
  has no root `package.json` — coordination is via `Taskfile.yml` only)
- Pollute `phenodocs/packages/` with non-documentation assets (landing sites ship
  JSON-LD, OG images, hero/CTA sections, runtime GitHub stats fetches — consumed by
  search engines and social-media crawlers, not by VitePress sidebar)

### 2. Build is heavy / conflicts exist

| Action | Cost | Conflict |
|--------|------|----------|
| `cp -r phenotype-landing/* phenodocs/packages/landing/` | ~1.6 GB copied; tracked source ~1.5 MB after `--exclude=node_modules,dist` | Bloats `phenodocs/.git` and creates nested monorepo |
| `bun install` at root | tries to hoist 7 sites' deps → version conflicts (astro pinned differently across sites) | breaks `phenodocs`'s existing root `bun.lock` |
| `vitepress build` | would fail because `packages/landing/*` has no `index.md` for VitePress | conflicts with landing's Astro pages |
| `.github/workflows/ci.yml` (root of landing) | runs Astro typecheck+build for 6 sites | duplicates `phenodocs`'s VitePress CI |

### 3. Concrete structural mismatch

`phenotype-landing/SPEC.md` documents 4 invariants:

1. **One Astro site = one directory = one `package.json` + one lockfile** (no hoisting)
2. **Root has no `package.json`** — coordination via `Taskfile.yml` only
3. **Each site has its own `vercel.json` + `.github/workflows/ci.yml`**
4. Subtree pull workflow keeps reversibility

These invariants conflict directly with `phenodocs`'s bun-workspace design
(`workspaces: ["packages/*"]` expects each child to have its own `package.json`).

## What was archived instead

- Source repo: `KooshaPari/phenotype-landing` → archived on GitHub via
  `gh repo archive KooshaPari/phenotype-landing --yes`
- Registry row: `repo-phenotype-landing` → `disposition=ARCHIVE_ONLY`,
  `fsm=absorbed`, `archived_at=2026-07-17T15:50:00.000000Z`,
  `target="phenodocs (packages/landing/ — deferred absorption stub; no code copied)"`
- Catalog row: `phenotype-landing` → `status=archived`,
  `boundary=docs/boundary/phenotype-landing.md` (this doc),
  `intent=docs/intent/phenotype-landing.md`
- Per-project metadata: `projects/phenotype-landing.json` created
- Audit artifact: `audits/absorption-justifications/phenotype-landing-deferred-2026-07-17.md`
- Forward-pointer: `phenodocs/packages/landing/README.md` (no code copied)

## Future absorption (if/when)

A future absorption may be possible when one of these preconditions is met:

1. **Each site is migrated to VitePress or static HTML** — then `phenodocs`
   can ingest each site as a documentation surface (`docs/agileplus/`,
   `docs/byteport/`, etc.) via the existing federation pattern.
2. **A new dedicated `phenotype-sites` monorepo is created** with its own
   Astro workspace + VitePress doc hybrid. This is a future project, not
   in scope for this audit.
3. **The sites are decomposed** so each landing site is a stand-alone Bun
   workspace package at `phenodocs/packages/landing-{name}/`. This would
   require per-site absorb PRs × 7 (or a batched subtree split).

Until one of those preconditions is met, the source remains archived and the
forward-pointer at `phenodocs/packages/landing/` stands.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** Forge (autonomous governance audit, failsafe trigger)
**Worklog / finding:** `audits/absorption-justifications/phenotype-landing-deferred-2026-07-17.md`
**Decisions:**
- Absorption into `phenodocs/packages/landing/` rejected.
- Pivoted to `ARCHIVE_ONLY` (failsafe clause met).
- Source repo archived on GitHub.
- Forward-pointer created at `phenodocs/packages/landing/`.
- Parallel precedent: `omniroute-rust` and `PhenoVCS` (both ARCHIVE_ONLY 2026-07-17).

**Next review:** dormant (re-evaluate only if absorption preconditions above are met).