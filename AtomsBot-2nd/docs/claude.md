# Claude / LLM Contributor Guide

This document helps LLM-driven contributors (Claude, GPT, Cursor, etc.) implement changes safely and predictably.

## Principles
- Tests are the contract — read tests to understand expected behavior
- Prefer minimal, localized changes
- Align to project patterns (e.g., deferReply + editReply for Discord)
- Keep external calls behind githubActions/jiraClient helpers

## Typical Flows
- Add a new slash command
  1) Create tests in `src/discord/commands/__tests__`
  2) Implement command in `src/discord/commands/<name>.ts`
  3) Use `getRepoCredentialsForThread` for repo context
  4) Mock any new API calls in tests/setup.ts

- Enhance webhook handling
  1) Add tests to `src/github/__tests__`
  2) Update `src/github/githubHandlers.ts`
  3) Keep field validation strict but resilient (missing fields → early return)

- Improve auto-linker
  1) Add tests to `src/github/__tests__/autoLinker.test.ts`
  2) Update `src/github/autoLinker.ts` and helpers in `src/github/linkFormats.ts`

## Do / Don’t
- Do: return early on invalid inputs, log consistent messages
- Do: wrap Octokit/Discord calls in try/catch in handlers
- Don’t: introduce new global state without tests
- Don’t: bypass helper utilities for credentials or parsing

## Running Locally
```
npm i
npx vitest
```

## Checklist before PR
- [ ] Tests added or updated
- [ ] All tests pass locally
- [ ] Logging messages match assertions
- [ ] Behavior documented in docs/*.md

