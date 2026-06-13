# Testing

AtomsBot uses Vitest with extensive unit and integration tests. The test suite is the behavioral contract.

## Run tests
```
npx vitest
```

## Structure
- `src/**/__tests__/*.test.ts`: unit tests
- `src/__tests__/integration/*.integration.test.ts`: integration tests
- `tests/setup.ts`: global mocks for Discord, GitHub, Jira, store, logger, timers
- `tests/mocks/*`: individual module mocks (winston, store, etc.)

## Patterns
- Defer + editReply for Discord interactions
- Explicit logging assertions for key paths
- Mocked Octokit (`githubActions`) and Discord clients
- Edge cases: null/undefined fields, network errors, permissions, rate limiting

## Tips
- Prefer targeted runs when iterating:
  - `npx vitest run src/github/__tests__/autoLinker.test.ts`
  - `npx vitest run src/discord/commands/__tests__/assign.test.ts -t "Assign Command"`
- Align behavior to tests rather than changing tests
- Keep mocks consistent with ESM imports (default + named exports)

