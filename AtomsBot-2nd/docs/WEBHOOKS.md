# GitHub Webhooks

Entry point: `api/webhooks/github.ts`

## Handled events (core)
- issues: opened, closed, reopened, locked, unlocked, deleted
- issue_comment: created

## Behavior
- opened: create Discord thread (if not present), map labels, set initial embed
- closed/reopened: archive/unarchive thread, update embed
- locked/unlocked: update thread state and embed
- deleted: remove thread from store (no embed update)
- created (comment): mirror comment into Discord unless it contains bot-generated markers

## Helpers
- getIssueNodeId: safely read nested properties from the request
- updateThreadEmbed: updates the thread embed if thread + channel exist
- githubActions: Octokit wrappers used across handlers

## Error Handling
- Missing fields → early return
- Missing Discord channel → skip embed update
- Store misses are tolerated; handlers log and return

## Testing
- See `src/github/__tests__/githubHandlers.test.ts`
- Integration flows in `src/__tests__/integration/webhook-integration.integration.test.ts`

