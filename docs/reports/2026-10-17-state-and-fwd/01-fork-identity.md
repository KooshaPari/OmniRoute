# 01 — Fork Identity

## Yes, it is a fork

| Field                   | Value                    | Source                                |
| ----------------------- | ------------------------ | ------------------------------------- |
| Fork                    | `KooshaPari/OmniRoute`   | `gh repo view`                        |
| Parent / upstream       | `diegosouzapw/OmniRoute` | `gh repo view --json parent`          |
| `isFork`                | `true`                   | `gh repo view`                        |
| Ahead                   | **1,021 commits**        | `gh api .../compare/...`              |
| Behind                  | **92 commits**           | same                                  |
| Status                  | `diverged`               | same                                  |
| Fork point              | `v3.8.43`                | `UPSTREAM_SYNC.md`                    |
| Upstream default branch | `release/v3.8.52`        | `gh api repos/diegosouzapw/OmniRoute` |
| Upstream stars / forks  | 77,355 / 11,198          | same                                  |
| This fork's stars       | 16                       | same                                  |
| License                 | MIT                      | `LICENSE`                             |

### Remotes

```
kooshapari  https://github.com/kooshapari/omniroute.git        (fetch/push)
origin      https://github.com/KooshaPari/OmniRoute.git        (fetch/push)
upstream    https://github.com/diegosouzapw/OmniRoute.git      (fetch/push)
```

## What the fork says it is

- `package.json`: name `omniroute`, version `3.8.53`, _"Unified AI router with
  358 providers, RTK+Caveman compression, auto fallback, MCP/A2A, desktop, PWA,
  and OpenAI-compatible APIs."_
- Published under a **fork namespace**: `@kooshapari/omniroute` (npm) and
  `ghcr.io/kooshapari/omniroute` (GHCR), vs upstream's `@omniroute/omniroute`.
- The product name **OmniRoute is preserved**; only the namespace differs.

### Inconsistency worth fixing

`UPSTREAM_SYNC.md` refers to a **237-provider** catalog while `package.json`
claims **358**. The two documents disagree about the fork's own headline number.

## Fork-only surface

| Path                              | What it is                                                            |
| --------------------------------- | --------------------------------------------------------------------- |
| `apps/`                           | Application packages (13,761 files) — the largest fork-specific tree  |
| `open-sse/`                       | SSE / provider engine, 383,202 LOC                                    |
| `extensions/`                     | Extensions ecosystem (972 files), incl. `argis`                       |
| `native-clients/`                 | Native client implementations (2,173 files)                           |
| `crates/`                         | Rust: `omniroute-agent`, `omniroute-ffi`, `omniroute-rs`              |
| `electron/`                       | Electron desktop client, 2,496 LOC, **0 tests**, not in the workspace |
| `desktop-electrobun/`             | Electrobun desktop shell, 358 LOC scaffold                            |
| `docs-site/`                      | Docs site                                                             |
| `UPSTREAM.md`, `UPSTREAM_SYNC.md` | Fork divergence policy                                                |

## Fork governance automation

| Workflow                 | Purpose                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `fork-drift-warning.yml` | Daily cron; computes ahead/behind; opens an issue at ≥10 ahead (soft warning, never blocks) |
| `build-fork.yml`         | Builds/pushes the fork Docker image                                                         |

## What "finishing the fork" means

The fork's own policy is **cherry-pick only, never merge or rebase** — because
~11,796 files have diverged, and merging "would create unresolvable conflicts."
That makes the fork a permanent independent product, not a staging branch.

So "the fork is finished / intentional" would look like:

1. **A green CI on `main`** — see 04. Today there is none.
2. **A published artifact under the fork namespace** (ghcr image + npm scope)
   that a fresh user can actually run.
3. **A documented divergence policy** that is _accurate_ (fix the 237-vs-358
   contradiction) and a stated answer to "do we track upstream at all?"
4. **A clean working tree** — currently blocked by uncommitted edits and a
   stash (see 06).
5. **A decision on the Rust rewrite** — it is the largest unfinished ambition
   and has no defined scope.

### Blocking that today

- CI has never succeeded on this fork (04).
- The Rust rewrite is 6-of-9 scaffolds (03).
- `electron/` is unmaintained and untested but still present.
- Disk pressure prevents a production build on this machine (02/05).
