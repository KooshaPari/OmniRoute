# Workspace hygiene — Sprint 0

**Date:** 2026-06-17  
**Owner:** ecosystem disposition wave

## Dedupe candidates (`archive-migration/`)

| Path | Action | Rationale |
|------|--------|-----------|
| `HexaKit-boundary` | Archive or remove after diff | Duplicate of HexaKit; canonical clone is `HexaKit/` |
| `HexaKit-sparse` | Keep if active sparse checkout | Verify before delete |
| `phenoTypes` | Prune when phenotype-types confirmed SSOT | Superseded by phenotype-types repo |
| `phenoVessel` | Prune | Stale migration source |
| `router-docs` | Prune | Stale migration source |

## Worktree audit

- `HexaKit-wtrees/*` — retain through Wave C–E merge batch; prune after lane PRs land
- `phenotype-registry-wtrees/*` — prune `phase0-exec` after registry sync merges

## Session-end hook (manual until automated)

```powershell
git -C C:\Users\koosh\archive-migration\HexaKit worktree list
git -C C:\Users\koosh\archive-migration\phenotype-registry worktree list
```

Remove worktrees whose branches are merged and deleted on origin.
