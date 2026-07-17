# McpKit Branch Provenance — 2026-06-18

This file records **which McpKit branch / commit each archived artifact came from**, so future readers can reconstruct the source of every file in this archive.

The source repo `KooshaPari/McpKit` is archived (read-only) on GitHub since 2026-06-17, so all branch-only content is now frozen locally. This provenance is the only way to recover the original lineage.

## Source branches (live query, 2026-06-18)

| # | Ref | Type | Tip commit | Date | Origin |
|---|---|---|---|---|---|
| 1 | `origin/main` | remote | `c557c3c` | 2026-06-17 | `KooshaPari/McpKit` (archived) |
| 2 | `origin/feat/journey-impl` | remote | `6b6156a` | 2026-05-01 | `KooshaPari/McpKit` |
| 3 | `origin/chore/1st-hygiene-2026-06-08` | remote | `1363e07` | 2026-06-14 | `KooshaPari/McpKit` |
| 4 | `origin/wip/2026-06-18-McpKit-l7-001-propagation` | remote | `28eef29` | 2026-06-18 | `KooshaPari/McpKit` |
| 5 | `docs/mcpkit-sladge-badge` | local | `971a6c7` | 2026-05-01 | worktree-only (no remote push) |
| 6 | `docs/mcpkit-sladge-ci-refresh` | local | `f660fb0` | 2026-05-07 | worktree-only (no remote push) |
| 7 | `chore/audit-safe-workflows-0605` | local | includes `430a882` | 2026-06-05 | worktree-only (no remote push) |
| 8 | `chore/audit-safe-workflows-0605-r2` | local | includes `430a882` | 2026-06-05 | worktree-only (no remote push) |
| 9 | `fix/trufflehog-setup-pin-0605` | local | includes `430a882` | 2026-06-05 | worktree-only (no remote push) |

Local-only branches (#5-9) never received a remote push before the archive — they exist in worktree refs only.

## File → branch provenance

| Archived file | Source ref | Commit | Size | Notes |
|---|---|---|---|---|
| `MCP_TOOLKITS_SOTA.md` | `origin/feat/journey-impl` | `6b6156a` | 3,638 lines | Aspirational research documenting non-existent Python substrate tree; richest unique doc |
| `journey-traceability-RICH.md` | `430a882` (commit hash) | `430a88270daa8352f64bb2d05eebf650022e4a80` | 79 lines (+4 stub) | Full traceability model + rich-media stubs + 6-flow table. **Not on `feat/journey-impl`** (which has the 14-line stub). Available on local branches `chore/audit-safe-workflows-0605`, `chore/audit-safe-workflows-0605-r2`, `fix/trufflehog-setup-pin-0605`. See *Discrepancy note* below. |
| `sessions/20260428-taskfile-mcpkit/00_SESSION_OVERVIEW.md` | `origin/feat/journey-impl` | `6b6156a` | 326 B | Taskfile session, day-1 |
| `sessions/20260428-taskfile-mcpkit/01_RESEARCH.md` | `origin/feat/journey-impl` | `6b6156a` | 485 B | |
| `sessions/20260428-taskfile-mcpkit/02_SPECIFICATIONS.md` | `origin/feat/journey-impl` | `6b6156a` | 493 B | |
| `sessions/20260428-taskfile-mcpkit/03_DAG_WBS.md` | `origin/feat/journey-impl` | `6b6156a` | 212 B | |
| `sessions/20260428-taskfile-mcpkit/04_IMPLEMENTATION_STRATEGY.md` | `origin/feat/journey-impl` | `6b6156a` | 337 B | |
| `sessions/20260428-taskfile-mcpkit/05_KNOWN_ISSUES.md` | `origin/feat/journey-impl` | `6b6156a` | 238 B | |
| `sessions/20260428-taskfile-mcpkit/06_TESTING_STRATEGY.md` | `origin/feat/journey-impl` | `6b6156a` | 276 B | |
| `sessions/20260429-mcpkit-sladge-badge/00_SESSION_OVERVIEW.md` | `origin/feat/journey-impl` | `6b6156a` | 566 B | Sladge badge session, day-2 |
| `sessions/20260429-mcpkit-sladge-badge/01_RESEARCH.md` | `origin/feat/journey-impl` | `6b6156a` | 757 B | |
| `sessions/20260429-mcpkit-sladge-badge/02_SPECIFICATIONS.md` | `origin/feat/journey-impl` | `6b6156a` | 483 B | |
| `sessions/20260429-mcpkit-sladge-badge/03_DAG_WBS.md` | `origin/feat/journey-impl` | `6b6156a` | 381 B | |
| `sessions/20260429-mcpkit-sladge-badge/04_IMPLEMENTATION_STRATEGY.md` | `origin/feat/journey-impl` | `6b6156a` | 450 B | |
| `sessions/20260429-mcpkit-sladge-badge/05_KNOWN_ISSUES.md` | `origin/feat/journey-impl` | `6b6156a` | 294 B | |
| `sessions/20260429-mcpkit-sladge-badge/06_TESTING_STRATEGY.md` | `origin/feat/journey-impl` | `6b6156a` | 264 B | |
| `sladge-badge-scripts/cmd/generate/main.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 8,618 B | Entry point: Go CLI for badge generation |
| `sladge-badge-scripts/cmd/generate/generate.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 3,140 B | Generator dispatch |
| `sladge-badge-scripts/cmd/generate/methods.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 4,444 B | |
| `sladge-badge-scripts/cmd/generate/output.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 16,666 B | Output formatting (largest file) |
| `sladge-badge-scripts/cmd/generate/tables.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 12,214 B | Markdown table emitters |
| `sladge-badge-scripts/cmd/generate/types.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 5,675 B | |
| `sladge-badge-scripts/cmd/generate/typenames.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 4,747 B | |
| `sladge-badge-scripts/cmd/generate/main_test.go` | `docs/mcpkit-sladge-badge` | `971a6c7` | 2,927 B | |
| `sladge-badge-scripts/cmd/generate/README.md` | `docs/mcpkit-sladge-badge` | `971a6c7` | 10,932 B | |
| `sladge-badge-scripts/cmd/generate/LICENSE` | `docs/mcpkit-sladge-badge` | `971a6c7` | 1,453 B | |
| `sladge-badge-scripts/demo.cast` | `docs/mcpkit-sladge-badge` | `971a6c7` | 4,385 B | asciinema recording of the badge generator running |

## Discrepancy note (journey-traceability.md)

The originating task description (2026-06-18) stated:

> `feat/journey-impl` rich `docs/operations/journey-traceability.md` (79 lines vs main's 14-line stub)

**Verified 2026-06-18 04:55 PDT:** `origin/feat/journey-impl:docs/operations/journey-traceability.md` is **14 lines**, identical to `main` and `origin/wip/2026-06-18-McpKit-l7-001-propagation`. The 79-line rich version (`+75 lines` diff, total `+75` over the stub) is reachable **only at commit `430a882`** ("docs(McpKit): scaffold rich journey traceability autograder", 2026-06-05 06:37:06 -0700), contained in local-only branches `chore/audit-safe-workflows-0605`, `chore/audit-safe-workflows-0605-r2`, and `fix/trufflehog-setup-pin-0605`. None of these were pushed to remote before the archive. The rich version was extracted via `git show 430a882:docs/operations/journey-traceability.md` directly from the dangling commit hash.

The 79-line version is materially richer (full traceability model + rich-media stubs + 6-flow table with autograder gates); see `journey-traceability-RICH.md`.

## Session directory origin (Taskfile vs sladge)

Both session directories live in tree on `origin/feat/journey-impl:docs/sessions/` but were authored in two separate worktree sessions:

- `20260428-taskfile-mcpkit/` — Taskfile session (2026-04-28)
- `20260429-mcpkit-sladge-badge/` — sladge badge session (2026-04-29, same author Forge/Codex pair as Taskfile)

The sladge-badge session originally lived on the local `docs/mcpkit-sladge-badge` worktree branch (initial commit `169b207`, 2026-04-29 18:39:55 -0700). When `feat/journey-impl` was rebased onto a later main snapshot, it inherited the sessions dir from the local worktree (verified by `git log --all --follow -- docs/sessions/20260429-mcpkit-sladge-badge/00_SESSION_OVERVIEW.md`). Both versions are byte-identical.

## Refresh provenance

The `docs/mcpkit-sladge-ci-refresh` local branch (tip `f660fb0`, 2026-05-07 04:51:34 -0700) is the **second sladge-badge commit** ("docs: refresh mcpkit sladge badge"). It is 1 commit ahead of `docs/mcpkit-sladge-badge` (which is at `971a6c7`, a `fix(config): migrate team email` post-sladge commit). The Go scripts at the two branch tips are **byte-identical** — only the README.md badge link was refreshed. Therefore the scripts archived here from `docs/mcpkit-sladge-badge` are also a faithful snapshot of `docs/mcpkit-sladge-ci-refresh`'s scripts.

## Verification commands (re-runnable)

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/McpKit

# Verify SOTA doc provenance
git show origin/feat/journey-impl:docs/research/MCP_TOOLKITS_SOTA.md | wc -l    # 3638

# Verify journey-traceability rich version (NOT on journey-impl)
git show origin/feat/journey-impl:docs/operations/journey-traceability.md | wc -l   # 14
git show 430a882:docs/operations/journey-traceability.md | wc -l                    # 85 (79 + trailing)

# Verify branch ancestry
git branch -a --contains 430a882    # chore/audit-safe-workflows-0605, -r2, fix/trufflehog-setup-pin-0605
git log --all --follow -- docs/sessions/20260429-mcpkit-sladge-badge/00_SESSION_OVERVIEW.md

# Verify sladge scripts
git show docs/mcpkit-sladge-badge:rust/mcp-forge/cmd/generate/main.go | wc -c   # 8618
```