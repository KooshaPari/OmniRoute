# Implementation Strategy

## Approach

Keep the badge change small and docs-only:

- README receives the sladge badge in the existing badge block.
- Session docs capture why the isolated worktree was required.
- No MCP protocol, package manifest, SDK generation, or Rust crate changes.

## Rationale

McpKit already had unrelated local work. A separate worktree allows the sladge
WBS item to be prepared and committed without disturbing that state.
