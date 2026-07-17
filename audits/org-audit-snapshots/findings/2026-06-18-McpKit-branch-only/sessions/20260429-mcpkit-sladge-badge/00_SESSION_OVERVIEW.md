# Session Overview

## Goal

Add the sladge badge to McpKit while preserving unrelated local changes in the
canonical checkout.

## Outcome

- Added the `AI Slop Inside` badge to `README.md`.
- Used isolated worktree `McpKit-wtrees/sladge-badge` because canonical
  `McpKit` already had unrelated package, Rust crate, ADR, PRD, plan,
  reference, research, and `rust/agentora` changes.
- Kept the change docs-only.

## Success Criteria

- README includes the sladge badge.
- Session docs explain the isolated-worktree decision.
- The worktree is clean after commit.
