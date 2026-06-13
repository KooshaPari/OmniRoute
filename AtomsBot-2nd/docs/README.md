# AtomsBot Documentation

This repository hosts a Discord-first issue management bot that synchronizes GitHub issues and (optionally) Jira, with rich Discord experiences (forum threads, slash-commands, embeds), GitHub webhooks, and an auto-linker that infers issue context from conversation.

This doc set is optimized for a fresh developer onboarding quickly:
- What it does and main components
- How to run locally
- How to test and contribute with confidence
- Where to look for each feature

## Core Features
- Discord forum thread ↔ GitHub issue linking and synchronization
- GitHub webhook handling (issues, comments, PR/workflows checks limited)
- Auto-linker: resolves full URLs and shorthand (#123) to bind thread to issue
- Slash commands: assign, unassign, priority, status, label, issue, link, etc.
- Optional Jira integration (transition/assignment helpers)
- Database-backed store with legacy JSON compatibility
- Robust test suite (unit + integration) using Vitest

See also:
- docs/GETTING_STARTED.md
- docs/FEATURES.md
- docs/COMMANDS.md
- docs/WEBHOOKS.md
- docs/AUTO_LINKER.md
- docs/STORE.md
- docs/TESTING.md

## Code Map (High-level)
- src/discord
  - discordHandlers.ts: Discord client wiring and event handling
  - commands/: Slash command implementations (assign, status, priority, etc.)
  - embeds/, framework/, handlers/: UI helpers and supporting logic
- src/github
  - githubActions.ts: GitHub API operations and helpers
  - githubHandlers.ts: GitHub webhook event handlers (opened/closed/etc.)
  - autoLinker.ts: message scanning → issue binding
  - linkFormats.ts: regex + parsing helpers
- src/jira
  - jiraClient.ts: Jira API wrapper (optional)
- src/store-db.ts: Database-backed store with caches (preferred)
- src/store.ts: Legacy JSON store (tests still mock/use portions)
- api/webhooks/github.ts: Vercel-style HTTP webhook entrypoint
- src/logger.ts: Winston-based logger configuration
- src/env.ts and src/config.ts: environment validation and legacy config access

## Development Workflow
- Install: `npm i`
- Run tests: `npx vitest`
- Focused test (example): `npx vitest run src/github/__tests__/autoLinker.test.ts`
- Lint/format: use your editor defaults (repo favors TypeScript + Prettier)
- Local webhook testing: post sample payloads to api/webhooks/github.ts handler

## Architecture Notes
- Event-driven sync: Discord actions and GitHub webhooks maintain state
- Thread is the primary unit: id maps to Discord thread; node_id/number map to GitHub
- Store abstracts persistence; DB store keeps in-memory caches for performance
- Logging is non-fatal in test mode; tests assert logging side-effects

## Contributing Tips
- Prefer minimal, targeted changes; keep behavior aligned to tests
- When adding features, write/extend tests first
- Follow the repo’s patterns: small helpers, guarded API calls, clear logging
- Use GitHub API via githubActions helpers; keep handlers thin and predictable
- For Discord, stick to deferReply/editReply when interactions can be slow

## Support
If anything is unclear or missing, open a PR to docs/ or add tests asserting the intended behavior. Fast iteration with tight tests is the preferred workflow.

