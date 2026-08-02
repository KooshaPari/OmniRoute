# Testing Strategy

## Passed

- `bun test tests/unit/resilience-provider-cooldown-api-3556.test.ts`: 8 passed.
- `bun test tests/unit/stream-handler.test.ts tests/unit/stream-payload-collector.test.ts`: 36
  passed.
- Direct `createProxyRegistrySchema` parse for `deno`/`deno-relay` and
  `cloudflare`/`cloudflare-relay`: passed.
- `git diff --check`: passed.

## Blocked

- `tests/unit/proxy-registry.test.ts` and `tests/unit/batch_api.test.ts` require temporary SQLite
  directories; the host had 101 MB free and returned `ENOSPC`.
- `tsc --noEmit -p desktop-electrobun/tsconfig.json` requires the absent `electrobun` dependency.
- Local `npx prettier --check` could not refresh cache after the host reached `ENOSPC`; formatter
  writes completed before the disk filled.

## Remote evidence

- PR 492 failed `check` and `Lint & Format` at head `fc9201feab`; all other completed checks were
  not treated as release evidence until the new head reruns.
