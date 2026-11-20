# Reset-aware quota routing: pool-wipe regression (2026-10-27)

## Symptom

`tests/unit/combo-strategies.test.ts` failed 11 reset-aware cases with
`404 !== 200` from `handleComboChat` ("Combo has no executable targets").
Affected: weekly-quota preference, spend-what-resets-soon, soon-reset vs empty,
5h-vs-weekly pressure, near-5h exhaustion, round-robin tie break, registered
quota fetchers, fetch dedupe, SWR stale ordering, numeric reset timestamps,
provider-specific weekly windows.

## Root cause (implementation regression, not a stale contract)

`open-sse/services/combo/quotaStrategies.ts`, in
`expandTargetsByQuotaAwareConnections`:

```ts
if (provider && getQuotaFetcher(provider) && connection?.provider !== provider) continue;
```

`connection` comes from `connectionById`, which is populated only from
`getCachedProviderConnections({ provider, isActive: true })`. For a target that
pins a connectionId (every reset-aware combo step does), a connection that is not
in that list makes `connection` `undefined`, so `undefined !== provider` is true
and EVERY candidate is dropped. The pool becomes empty and the request 404s.

Introduced by `6b14884af4` ("fix: restore 8808 files lost to git clean — full
upstream sync with batch merge 152d95108c", 2026-09-13), which is also the commit
that added `tests/unit/combo/quota-connection-eligibility.test.ts`. The fork's
prior `quotaStrategies.ts` had no such gate. `git blame` of the line lands on
that restore commit; the pre-restore file at `6b14884af4^` shows the two new
guards (`connectionIds.length === 0` early-continue and the per-connection
`provider` comparison) arriving together.

## Why the obvious revert is wrong

`quota-connection-eligibility.test.ts` requires that a pinned id with no
routable row (disabled, banned, deleted, or nonexistent) be excluded and never
consume a quota worker. Trusting every unresolved pin would let disabled/banned
accounts back into the pool (8 tests failed when that was tried).

## Fix

Make the gate depend on whether the DB is authoritative for the provider:

- Load the provider's rows WITHOUT `isActive` and split them into `connections`
  (routable) plus `providerRowsExist` (any row at all, including disabled/banned).
- If `providerRowsExist` and the pinned id resolves to no routable row -> drop
  (disabled / banned / deleted pin).
- If the provider has no DB rows at all -> keep pinned ids. Providers whose
  connections live outside the DB (in-memory registered Codex sessions, providers
  wired purely through `registerQuotaFetcher`) cannot be validated against an
  empty table, and must stay routable.
- A resolved row that belongs to a different provider is still dropped, with
  aliases canonicalized through `resolveProviderId` (so `agy` is not "foreign"
  to `antigravity`).

## Verification

- `tests/unit/combo-strategies.test.ts`: 17/17 pass (was 6/17).
- `tests/unit/combo/**/*.test.ts`: 383/386 pass, identical to the pre-change
  baseline (3 pre-existing unrelated failures: `request-scoped combo failures
never poison provider-wide resilience`, `toRetryAfterDisplayValue — zero stays
an epoch-ms Date`, `validateResponseQuality — content empty + reasoning_content
valid + tool_calls empty array`).
- `tests/integration/combo-matrix/quota-aware.test.ts`: same 3 pre-existing
  failures before and after.
- `tsc` on the module: clean. `eslint` + `prettier --check`: clean.

## Note: `tests/unit/combo-decision-matrix.test.ts`

15 failures there are unrelated to this epic and pre-existing: its `classify()`
helper maps `MODEL_CAPACITY` to `retry-then-stop` while individual rows expect
`advance`, and it asserts `stop` for 401/quota-429 where production combo
deliberately advances to the next account. The 400 branch it exercises is
byte-identical to the version at its introducing commit `bf65512098`
(2026-08-27), so nothing regressed there; that file encodes a different
(upstream PR-beta) contract and needs a separate decision.
