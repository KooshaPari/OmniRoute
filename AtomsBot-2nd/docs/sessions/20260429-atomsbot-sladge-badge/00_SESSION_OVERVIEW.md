# Session Overview

## Goal

Add the sladge badge to AtomsBot while preserving unrelated local changes in the
canonical checkout.

## Outcome

- Added the `AI Slop Inside` badge to `README.md`.
- Used isolated worktree `AtomsBot-wtrees/sladge-badge` because canonical
  `AtomsBot` already had unrelated spec, docs, ADR, PRD, research, smoke test,
  and worklog changes.
- Kept the change docs-only.

## Success Criteria

- README includes the sladge badge.
- Session docs explain the isolated-worktree decision.
- The worktree is clean after commit.
