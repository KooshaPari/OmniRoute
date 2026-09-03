# UPSTREAM.md — fork divergence policy

> W1.12 — How this fork (`KooshaPari/OmniRoute`) relates to upstream
> (`diegosouzapw/OmniRoute`), how we keep them reconciled, and what we
> consider "portable" vs "fork-only".

## TL;DR

| Property | Upstream | This fork |
|---|---|---|
| **Repo** | `diegosouzapw/OmniRoute` | `KooshaPari/OmniRoute` |
| **Default branch** | `main` | `main` |
| **Working branch** | — | `feat/docs-site-4-quadrant-20260902` |
| **License** | AGPL-3.0 | AGPL-3.0 (inherited) |
| **Releases** | `@omniroute/omniroute` on npm | `@kooshapari/omniroute` on npm + GHCR |
| **Divergence policy** | — | [see "Cadence" below](#cadence) |
| **Portability rule** | — | [see "Portable vs fork-only"](#portable-vs-fork-only) |

## Remotes

```bash
git remote -v
# origin    https://github.com/Kooshapari/OmniRoute.git (fetch)
# origin    https://github.com/Kooshapari/OmniRoute.git (push)
# upstream  https://github.com/diegosouzapw/OmniRoute.git (fetch)
# upstream  https://github.com/diegosouzapw/OmniRoute.git (push)  ← rare
```

Upstream is set up to be **read-mostly**. The only times we push to upstream
are:

1. **Upstream PRs we open from a fork branch** — these are cherry-picks
   of portable commits, not the fork's own work.
2. **Rebase-rescue pushes** — when a bot or maintainer explicitly asks
   us to rebase a PR branch onto a newer upstream SHA. These are
   one-off, never happen on `main`.

## Cadence

We rebase against upstream `main` on a fixed schedule. The schedule is
chosen to be **fast enough that a rebase is boring** and **slow enough
that we don't churn on every upstream commit**.

| Trigger | Action | Owner |
|---|---|---|
| Daily (00:00 UTC) | `git fetch upstream` | cron (`bin/upstream-intel.mjs`) |
| Weekly (Mon 14:00 UTC) | `git rebase upstream/main` onto the working branch | on-call (manual, see `bin/rebase-fork.sh`) |
| Per upstream release (`v*` tag) | Re-run the rebaser within 24h | on-call |
| Drift > 25 commits | Open a `fork-drift-warning` issue and call in a second reviewer | automated |
| Conflict > 30 lines | Schedule a 30-min pair-rebase session | on-call |

The `bin/upstream-intel.mjs` script writes a daily digest to `upstream/digest.md`
and `upstream/tier1-issues.json`. The fork-drift warning workflow
(`.github/workflows/fork-drift-warning.yml`) opens an issue when the
working branch drifts >10 commits, and adds the `severity:critical`
label at >25.

## Portable vs fork-only

Every commit on our working branch is classified as one of:

- **Portable (P)** — fits upstream's contract, no opinionated choices.
  Examples: bug fixes, doc corrections, performance optimizations,
  supply-chain hardening, i18n string additions, test improvements.
  - **Lifecycle**: cherry-pick back to upstream as a PR (W10.03).
  - **Merge policy**: when an upstream release lands, port these
    forward automatically (cherry-pick conflict → manual).

- **Fork-only (F)** — depends on the fork's identity, branding,
  distribution, or scope. Examples: `@kooshapari/omniroute` package
  name, the 4-quadrant docs site, fork-specific CI workflows.
  - **Lifecycle**: stays in the fork; never proposed upstream.
  - **Merge policy**: rebase-friendly (no upstream churn).

- **Blocking (B)** — would conflict with an upstream-incompatible
  choice already made on the fork. Resolved by either rewinding
  the upstream release or filing a one-off PR.
  - **Lifecycle**: deprecated in favor of portable variants.

The classification lives in the **commit trailer** of every commit:

```text
W-class: P
PR-target: diegosouzapw/OmniRoute#1234
```

`bin/classify-commit.mjs` reads the trailer and updates the manifest.
`bin/cherry-pick-portable.mjs` walks `git log upstream/main..HEAD` and
emits a series of `git cherry-pick` commands for the `W-class: P`
commits, in order, with rebase-conflict stops on each.

## License and attribution

OmniRoute is **AGPL-3.0**. Our fork inherits that license. Any
contribution we make to upstream is governed by upstream's CLA (or
absence thereof; the project has not required one as of Sept 2026).
Any contribution we accept into this fork is governed by the AGPL
contribution terms — see [LICENSE](./LICENSE) and
[CONTRIBUTING.md](./CONTRIBUTING.md).

The fork's branding (forked logo, `@kooshapari` package namespace,
fork-specific docs site) is **not** AGPL-encumbered — these are
trademark and packaging choices, not code.

## Drift budget

We allow up to **25 commits** of divergence from upstream `main` at
any time. Above that, `fork-drift-warning` opens a critical issue and
the next weekly rebase becomes a blocker.

Justification: a 25-commit budget lets us work on a 2-week feature
without weekly rebases, but caps the cost of a rebase at ~2h of
conflict resolution. Past experience shows 50+ commits of drift
costs 4+ hours per rebase, with non-trivial bug-introduction risk.

## When upstream breaks the contract

If upstream merges a change that:

- Renames a public API we depend on,
- Changes the database schema without a backfill plan, or
- Drops an env var we read at boot

…then we hold the weekly rebase, file an upstream issue, and ship a
**fork-specific shim** until the upstream fix lands. The shim is
classified `W-class: B` and is a candidate for deprecation in a
later rebase.

## See also

- `01-fork-delta-report.md` — current state of divergence
- `bin/upstream-intel.mjs` — daily intelligence script
- `bin/cherry-pick-portable.mjs` — portable-commit cherry-picker
- `upstream/pr-candidates.md` — the queue of upstream PRs to file
