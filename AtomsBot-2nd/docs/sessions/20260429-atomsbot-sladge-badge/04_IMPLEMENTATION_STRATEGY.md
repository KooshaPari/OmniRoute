# Implementation Strategy

## Approach

Keep the badge change small and docs-only:

- README receives the sladge badge in the existing badge block.
- Session docs capture why the isolated worktree was required.
- No bot runtime, provider, command, webhook, or database changes.

## Rationale

AtomsBot already had unrelated local work. A separate worktree allows the sladge
WBS item to be prepared and committed without disturbing that state.
