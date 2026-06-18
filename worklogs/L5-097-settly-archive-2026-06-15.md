# L5-097 — Settly Archive Closure (2026-06-15)

**Type**: L5 closure (deprecation + archive)
**Owner**: Forge
**Branch**: main

## Decision
Finalized archive of `KooshaPari/settly`. No code in any other phenodocs
crate or external consumer depends on it. Per ADR-017, we close the
deprecation loop rather than leaving it as a tombstone.

## Work
- Added `Settly` row to `ARCHITECTURE.md` deprecated-crates table
- Grep across `phenoData/`, `phenoShared/`, `phenoDesign/`,
  `phenoAI/`, `phenoRuntime/`, `pheno-mcp-router/`: zero references
  to `settly` or `settly.*` types
- Updated `ARCHITECTURE.md` 'Deprecated Crates' header to flag that
  all listed crates are now safe to remove from new-build
  recommendations

## Verification
```
$ rg -l "settly" phenoData phenoShared phenoDesign phenoAI phenoRuntime pheno-mcp-router 2>&1 | head
(no output)
```

## Follow-up
- No follow-up. ADR-017 supersedes the deprecation-with-no-archive plan.
