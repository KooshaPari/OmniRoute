# L5-104.4 — WIP branch closure (2026-06-17)

## Decision
Three WIP branches triaged during the 2026-06-17 wrap-up:

| Original WIP | Disposition | Replacement |
|---|---|---|
| `KooshaPari/pheno:wip/stash-2026-05-02-pheno-cli-adapter-refactor-2026-06-17` (e942953) | POLLUTED (197 files, 10,949 unrelated deletions) | Extracted 4-file refactor → `wip/extract-get-adapter-refactor-2026-06-17` (4c6bf71) → **PR #232** |
| `KooshaPari/pheno:wip/migrate-from-dmouse-chore-adr-012-2026-06-17` (7a803ddc) | OBSOLETED | Work in `KooshaPari/phenotype-config#1` |
| `KooshaPari/dispatch-mcp:wip/migrate-from-dmouse-w2-1-2026-06-17` (a1aaef2d) | OBSOLETED | Work in 5 Track-8 PRs (pheno-mcp-router 1-3, dispatch-mcp#1, phenotype-ops#2) |

## Action
- The 2 obsolete WIPs were closed on origin (deleted remote ref, git history retained)
- Close-out commit on `KooshaPari/dispatch-mcp:wip/close-out-w2-1-from-dmouse-2026-06-17` documents the migration targets
- The pheno adr-012 close-out branch failed to push (source ref already deleted) — closure documented in this worklog

## Net effect
- 1 PR ready for review (KooshaPari/pheno#232) — clean 4-file refactor, 96 insertions, 20 deletions
- 2 obsolete WIPs closed, branch namespace freed
- All dmouse92-related work now consolidated in Track-8 PRs + the new clean refactor PR

## Why extraction (not close) for Branch 1
The polluted WIP contained the intended GetAdapter refactor (4 files), but mixed with:
- 11,000+ lines of unrelated deletions (test archives, grade reports, doc files)
- 5+ unrelated workflow files
- 1 corrupted state file

Extracting just the 4 intended files produces a clean, reviewable PR that preserves the work. The remaining 193 files of noise are not in the new branch.

L5-104.4 (companion to L5-104 / ADR-029 — Dmouse92 → KooshaPari migration)
