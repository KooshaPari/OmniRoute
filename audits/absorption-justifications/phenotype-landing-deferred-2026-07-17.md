# phenotype-landing Absorption-Justification Audit (2026-07-17) — DEFERRED / ARCHIVE_ONLY

**Audit ID:** ABS-JUS-phenotype-landing-2026-07-17
**Auditor:** Forge (autonomous governance audit)
**Date:** 2026-07-17
**Phase:** Queue Refresh — `2026-07-17-queue-refresh-2`
**Source Repo:** `gh api repos/KooshaPari/phenotype-landing` (remote)
**Initial Disposition:** ABSORB with target `phenodocs (packages/landing/)`
**Final Disposition:** **ARCHIVE_ONLY** (failsafe triggered)
**Target (final):** `phenodocs (packages/landing/ — deferred absorption stub; no code copied)`
**Confidence:** HIGH (0.85) — failsafe conditions met on concrete structural verification

---

## Source

`phenotype-landing` is the **multi-tenant landing site factory** owned by
`kooshapari`.

- Default branch: `main`
- Languages: `astro` (primary) + bun
- Has README: True
- Disk usage (remote): 2718 KB tracked + ~1.6 GB on disk
  (per `du -sh` at the local clone: ~1.6 GB total, of which ~1.4 GB is
  `node_modules` across 7 sites)
- Branches: 1 (per remote_branch_count)
- Last push: 2026-07-17T05:27:00Z (predecessor audit timestamp)

### What the source actually is (verified 2026-07-17)

A pre-audit spot-check revealed the source is **not** a single landing page but
a **7-site Astro multi-tenant factory**:

| Path under `phenotype-landing/` | Stack | Size (on disk) | Notes |
|---------------------------------|-------|----------------|-------|
| `sites/agileplus-landing/` | Astro + Bun | 201 MB | |
| `sites/byteport-landing/` | Astro + Bun | 197 MB | |
| `sites/hwledger-landing/` | Astro + Bun | 196 MB | |
| `sites/odin-landing/` | Static HTML/CSS | 184 MB | No Astro build |
| `sites/phenokits-landing/` | Astro + Bun | 196 MB | |
| `sites/projects-landing/` | Astro + Bun | 196 MB | |
| `sites/thegent-landing/` | Astro + Bun | 196 MB | |
| `packages/{design-tokens,github-fetcher,ui}/` | shared | small | ui has `.astro` components; design-tokens already absorbed into `phenodocs/packages/design-tokens` |
| `docs/`, `templates/`, `scripts/`, `Taskfile.yml`, `justfile`, `cliff.toml`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `SPEC.md` | meta | ~1.5 MB tracked | Coordination/orchestration only; no root `package.json` |

**Architectural invariants** (per `phenotype-landing/SPEC.md`):
1. One Astro site = one directory = one `package.json` + one lockfile (no hoisting across sites).
2. Root has **no** `package.json` / no `bun.lockb`; coordination via `Taskfile.yml` only.
3. Each site has its **own** `vercel.json`, `.github/workflows/ci.yml`, and `vitest.config.ts`.
4. Subtree pull flow: `git subtree pull --prefix=sites/<name> <remote> main --squash` keeps reversibility on a branch.

## Target (pre-audit)

`phenodocs (packages/landing/)` — the docs hub is the canonical home for
landing/marketing, per `RATIONALIZATION_PLAN.md` and `RATIONALIZATION_EXECUTION.md`.

## Why absorption failed (failsafe conditions met)

Both conditions from the absorption-runbook failsafe clause were met:

### 1. Architecturally mismatched target

`phenodocs` is a **VitePress federation hub** (single root `package.json`,
`workspaces: ["packages/*"]`, `vitepress dev`/`build` scripts, Vue 3). Adding
`packages/landing/` with 7 Astro sites + their 7 `vercel.json` + 7 CI workflows +
7 `bun.lock` files + ~1.4 GB of `node_modules` would create:

- **7 nested bun install contexts** that the root `bun install` cannot hoist.
- **7 deployment targets** (each `vercel.json`) that VitePress build can't orchestrate.
- **A nested monorepo** with no shared TypeScript path, no cross-site dependency
  graph, and no coherent root `package.json` (landing has none).
- A workspace entry whose real children (`sites/*`) are not Bun workspaces
  (`workspaces: ["packages/*/sites/*"]` would have to be added, but then
  `packages/landing/` itself is empty in workspace terms).

`phenodocs`'s purpose per its own `README.md` is "Aggregate documentation from
multiple projects". Landing sites are **marketing surfaces**, not documentation.
They ship JSON-LD, OG images, structured hero/CTA sections, and runtime data
fetches (GitHub stats, release feeds). They are consumed by search engines and
social-media crawlers, not by a VitePress sidebar.

### 2. Build is heavy / conflicts exist

| Item | Cost | Conflict |
|------|------|----------|
| `cp -r phenotype-landing/* phenodocs/packages/landing/` | ~1.6 GB copied (would need `--exclude=node_modules,dist` for sanity) | inflates `phenodocs/packages/landing/.git` to ~10–20 MB (tracked source) but locally bloats to GBs |
| `bun install` at root | tries to hoist 7 sites' deps → version conflicts (astro, @astrojs/check, vite each pinned differently across sites per the site-level lockfiles) | breaks `phenodocs`'s existing root `bun.lock` resolution |
| `vitepress build` | would fail because `packages/landing/*` has no `index.md` for VitePress to ingest | conflicts with landing's Astro pages |
| `.github/workflows/ci.yml` (root of landing) | runs Astro typecheck+build for 6 sites on `main` and PRs | duplicates `phenodocs`'s VitePress CI |
| `phenodag.db` (4096 bytes, tracked) | a local SQLite artifact | pollution |

These are the **same failsafe triggers** that recently produced
`omniroute-rust → ARCHIVE_ONLY` (13-member Rust workspace vs HexaKit/crates)
and `PhenoVCS → ARCHIVE_ONLY` (5-crate Rust workspace vs pheno/crates).

## Status

**Status:** `ARCHIVE_ONLY` (was `ABSORB` in pre-audit queue). Failsafe triggered.

- `disposition` (registry/disposition-index.json): `ABSORB` → `ARCHIVE_ONLY`
- `target`: `phenodocs (packages/landing/ — deferred absorption stub; no code copied)`
- `fsm`: `active` → `absorbed`
- `archived_at`: `2026-07-17T15:50:00.000000Z`
- Source repo `KooshaPari/phenotype-landing` archived on GitHub via `gh repo archive`.
- No code copied into `phenodocs/packages/landing/` (only a forward-pointer README).

## Confidence

**Confidence:** 0.85 (HIGH).

**Confidence drivers:**
- **+0.35** — Repo is real, non-archived (pre-audit), on `kooshapari` remote.
- **+0.25** — Concrete structural verification (`git ls-files`, `du -sh`,
  per-site `ls`) confirms the 7-site factory layout matches `SPEC.md`.
- **+0.15** — Failsafe conditions (build heavy + architectural conflict) are
  demonstrably met with measurable evidence.
- **+0.10** — Precedent: `omniroute-rust` and `PhenoVCS` both pivoted to
  `ARCHIVE_ONLY` for the same pattern (multi-crate/-site workspace vs
  monolithic absorber) within the past 24 hours of audit work.
- **-0.10** — Future absorption may still be possible if/when (a) each landing
  site is independently migrated to VitePress / static HTML, or (b) a new
  dedicated `phenotype-sites` monorepo is created to host the 7 sites.

**Final:** 0.85 = HIGH. Failsafe disposition is justified; no further content
audit required for the archive action.

---

## Restore-Command

```bash
# Source repo was archived (not deleted); restore from local clone + GitHub archive
git clone https://github.com/KooshaPari/phenotype-landing.git /tmp/phenotype-landing-restore
# Forensic: see git log for the airlock-v2 auto-commit + subtree merges
```

**Restore posture:** Source repo archived on GitHub after absorption decision.
Local clone at `repos/phenotype-landing/` is preserved per the container
policy (no bulk-clean). All 7 sites' `bun.lock` and source files remain
inspectable.

---

## Cross-References

- `RATIONALIZATION_PLAN.md` — canonical absorbers per domain role.
- `RATIONALIZATION_EXECUTION.md` — per-absorber merge order + archive shortlist.
- `DOMAIN_ROLES.md` — terminal owners per language/domain.
- `BOUNDARY_OWNERS.md` — boundary ownership map.
- `registry/disposition-index.json` — registry spine, row `repo-phenotype-landing`.
- `catalog/registry.yaml` — substrate catalog entry `phenotype-landing` (status: archived).
- `projects/phenotype-landing.json` — per-project metadata.
- `docs/boundary/phenotype-landing.md` — boundary doc (filled in from this audit).
- `docs/intent/phenotype-landing.md` — intent doc (filled in from this audit).
- `audits/absorption-justifications/omniroute-rust-failsafe-2026-07-17.md` — parallel ARCHIVE_ONLY precedent.
- `audits/absorption-justifications/PhenoVCS-2026-07-17.md` — parallel ARCHIVE_ONLY precedent.

**End of audit.**