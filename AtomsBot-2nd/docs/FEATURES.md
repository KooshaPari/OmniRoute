# Features Overview

AtomsBot focuses on developer productivity in Discord while keeping GitHub as the source of truth. Jira support is available when needed.

## Discord-first workflows
- Forum thread as the unit of collaboration
- Slash commands for common actions:
  - /assign, /unassign
  - /priority, /status, /label
  - /issue (create/open), /link (bind), /links, /user-link
  - /help, /dashboard, /github, /jira, /meeting, /schedule
- Rich follow-ups with embeds/messages
- Interaction patterns use deferReply + editReply

## GitHub integration
- Webhooks: issues (opened, closed, reopened, locked, unlocked, deleted), comments
- githubActions wraps Octokit for CRUD, assignment, transitions
- getRepoCredentialsForThread helps resolve owner/repo context
- Synchronization helpers update Discord threads (embed refresh, archive/unarchive)

## Auto-linker
- Scans recent thread messages for:
  - Full GitHub issue URLs
  - Shorthand references (#123) using default or thread-specific repo
- Validates existence via GitHub API before binding
- Updates thread.number, repoOwner, repoName and logs the outcome
- Robust error handling: missing channels, API errors, invalid patterns

## Jira (optional)
- jiraClient exposes transition and assignment helpers
- Commands and handlers gracefully no-op when Jira is not configured

## Storage
- Database-backed store (src/store-db.ts) with caching and legacy-compat methods
- Legacy JSON store (src/store.ts) preserved for compatibility and tests
- Store tracks threads and link mappings (GitHub/Jira)

## Logging
- Winston-based logger with colorized timestamps
- Tests mock logger and assert key calls

## Testing
- Vitest-based unit and integration tests with comprehensive mocks
- tests/setup.ts sets up global mocks for Discord, GitHub, Jira, store, logger
- Integration tests validate webhook flows, concurrency, and edge cases

## Deployment / Runtime
- api/webhooks/github.ts as a Vercel entrypoint for GitHub webhooks
- src/index.ts initializes DB, Redis (optional), Discord client, calendar services
- env/settings validated with src/env.ts; legacy src/config.ts remains for compatibility

