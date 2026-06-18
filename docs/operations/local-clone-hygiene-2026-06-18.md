# Local clone hygiene — Cluster H

**Canonical active clones** (use these for gateway work):

| Repo | Path |
|------|------|
| phenotype-gateway | `C:\Users\koosh\dev\phenotype-gateway` |
| agentapi-plusplus | `C:\Users\koosh\dev\agentapi-plusplus` |
| cliproxyapi-plusplus | `C:\Users\koosh\dev\cliproxyapi-plusplus` |
| bifrost | `C:\Users\koosh\dev\bifrost` |
| argis-extensions | `C:\Users\koosh\dev\argis-extensions` |
| vibeproxy | `C:\Users\koosh\dev\vibeproxy` |
| OmniRoute | `C:\Users\koosh\dev\OmniRoute` |
| phenotype-tooling (BytePort canonical) | `C:\Users\koosh\dev\phenotype-tooling` |

## BytePort duplicates (archived repo absorbed)

| Path | Disposition |
|------|-------------|
| `C:\Users\koosh\dev\phenotype-tooling` | **CANONICAL** — BytePort → phenotype-tooling |
| `C:\Users\koosh\dev\BytePort` | Stale archive clone; safe to remove when disk needed |
| `C:\Users\koosh\BytePort` | Duplicate; removed 2026-06-18 |
| `C:\Users\koosh\dev\HexaKit-work\BytePort` | Worktree-era copy; do not use |
| `C:\Users\koosh\dev\pheno\BytePort` | Legacy pheno monorepo slice; do not use |

## Removed

- `C:\Users\koosh\OmniRoute` — wrong upstream (`diegosouzapw/OmniRoute`); removed Cluster H

## Stash supersede (H9)

- `phenotype-gateway` `stash@{0}: local-scaffold` — **superseded** by phenotype-gateway #5 (single `actions/checkout@v4` + `submodules: recursive`); stash dropped 2026-06-18; do not re-apply

## Remote branch hygiene (2026-06-18)

| Repo | Remotes after prune | Notes |
|------|---------------------|-------|
| phenotype-gateway | `master` only | #5/#6 branches deleted post-merge |
| bifrost | `main` only | G17 #7; `feat/bifrost-local-delta` deleted post-merge |
| cliproxyapi-plusplus | `main` only | G16 #1026 |
| agentapi-plusplus | `main` only | G15 #534 |
