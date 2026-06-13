# Getting Started (Fresh Developer)

This guide walks you through running AtomsBot locally, understanding the moving parts, and making your first change confidently.

## Prerequisites
- Node.js 18+
- npm 9+

## Install
```
npm i
```

## Environment
AtomsBot validates env with zod (see src/env.ts), but some modules still reference src/config.ts (legacy). Minimal local dev can run tests without full env. For end-to-end runs you’ll want:

```
DISCORD_TOKEN=xxx
DISCORD_CLIENT_ID=xxx
GITHUB_ACCESS_TOKEN=ghp_xxx
GITHUB_USERNAME=your-gh-user
GITHUB_REPOSITORY=your/repo
DISCORD_CHANNEL_ID=123
# Optional Jira
JIRA_HOST=your.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=xxx
JIRA_PROJECT_KEY=PRJ
```

Tip: For tests, most external clients are mocked; you can run `npx vitest` without real credentials.

## Run tests
```
npx vitest
```

Focused runs are fast and recommended during development, e.g.:
```
npx vitest run src/discord/commands/__tests__/assign.test.ts
```

## Project anatomy
- Discord bot
  - src/discord/discordHandlers.ts: lifecycle and events
  - src/discord/commands: slash commands (assign, status, priority, label, link, etc.)
- GitHub integration
  - src/github/githubActions.ts: wrappers around Octokit
  - src/github/githubHandlers.ts: webhook handlers
  - api/webhooks/github.ts: Vercel-compatible endpoint
  - src/github/autoLinker.ts: parses thread messages to bind to an issue
- Jira (optional)
  - src/jira/jiraClient.ts
- Storage
  - src/store-db.ts: database-backed (preferred)
  - src/store.ts: legacy JSON store used by tests and for compatibility
- Logging
  - src/logger.ts
- Config
  - src/env.ts (preferred), src/config.ts (legacy)

## Common tasks
- Implement/modify a command:
  - Edit `src/discord/commands/<name>.ts`
  - Update tests in `src/discord/commands/__tests__`
- Add a webhook behavior:
  - Edit `src/github/githubHandlers.ts` or `api/webhooks/github.ts`
  - Add/extend tests in `src/github/__tests__` or `src/__tests__/integration`
- Tweak auto-linker:
  - Edit `src/github/autoLinker.ts`
  - Extend `src/github/__tests__/autoLinker.test.ts`

## Best practices
- Defer + editReply for interactions that call external APIs
- Keep handlers small; push API details to githubActions/jiraService helpers
- Prefer getRepoCredentialsForThread to resolve repo context
- Handle null/undefined gracefully; tests exercise many edge cases
- Log outcomes; tests assert certain logger calls

## Troubleshooting
- Failing tests? Read the test expectations carefully; adjust behavior, not tests
- Mock issues? Check tests/setup.ts for global mocks and patterns
- ESM import errors? Ensure mocks return default + named exports where needed

## Next steps
- Read docs/FEATURES.md and docs/COMMANDS.md for a deeper tour
- Explore tests to understand intended behavior; they are the contract

