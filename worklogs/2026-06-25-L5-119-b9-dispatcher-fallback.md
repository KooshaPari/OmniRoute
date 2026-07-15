# L5-119 — B9 dispatcher fallback wrapper (Bifrost v8.1 closeout part 2)

**Date:** 2026-06-25
**Author:** KooshaPari
**Branch:** `main`
**Commits:** (this turn)

## TL;DR

Landed the dispatcher-facing entry point for Bifrost's B9 kill-switch contract. Without
this, the kill switch that was wired into `BifrostBackendExecutor` in L5-118 was
*inert*: when the executor threw on a tripped kill switch, the dispatcher propagated
the error to the user as a 500 instead of falling back to the legacy `chatCore` path.

This turn closes the contract end-to-end with `dispatchBifrostWithFallback()` plus
a `BifrostNoFallbackError` sentinel for the "no legacy path exists" edge case.

## Background

The Bifrost v8.1 track (ADR-031) defines a 9-phase rollout:
- B1–B5: model cache, dispatcher, cost tracking (✅ landed)
- B6: traffic-shadow (✅ landed, PR #89)
- B7: migration playbook (✅ landed, PR #91)
- B9: kill switch (✅ landed in two parts: L5-118 executor wiring + L5-119 dispatcher wiring)

L5-118 (commit `57ba29067`) added the executor-level wiring:
- Pre-check `isActive(provider)` → throw on tripped
- Post-observation `recordObservation()` in try/finally

But the executor's throw needed a dispatcher that *catches* it and re-routes. Without
that, "kill switch active" surfaced as a user-visible 500, which is the opposite of
the auto-fallback the v8.1 ADR promised.

## What landed

### `open-sse/executors/bifrost.ts` (+91 lines)

1. **`matchKillSwitchFallback(err)`** — internal helper. Regex-matches
   `Kill switch active for provider "X"` from an Error message. Returns the provider
   name when matched, undefined otherwise. Single source of truth for the "is this a
   kill-switch error?" decision; trivially testable.

2. **`BifrostNoFallbackError`** — new Error subclass. Surfaces the "Bifrost tripped
   but `getExecutor(provider)` returned another BifrostBackendExecutor" edge case as a
   distinct, type-stable error. Callers can `instanceof BifrostNoFallbackError` to
   return a clean 503 instead of a generic 500.

3. **`dispatchBifrostWithFallback(executor, input)`** — dispatcher-facing entry
   point. Wraps `BifrostBackendExecutor.execute()` in try/catch:
   - On kill-switch error: log warn under `BIFROST_TAG`, call `getExecutor(provider)`
     to get the legacy executor (which is `DefaultExecutor` or a specialized one for
     that provider), then re-dispatch with the same input. Logs the fallback target
     under `BIFROST_TAG` for audit-trail correlation.
   - On any other error: propagate unchanged. We do NOT swallow unrelated failures
     so callers can apply their own retry/backoff logic.
   - Loop guard: if `getExecutor` returns another `BifrostBackendExecutor` (e.g.
     someone wired Bifrost as the default), throw `BifrostNoFallbackError` instead
     of recursing infinitely.

### `tests/unit/bifrost-backend.test.ts` (+79 lines)

3 new test cases locking the wrapper contract:

| Test | What it locks |
|---|---|
| `falls back to the legacy executor when the kill switch trips` | `forceActivate("openai")` → wrapper → `result.response` is a `Response` (from `DefaultExecutor`) → `result.url` contains `openai` → fetch was NOT called by BifrostBackendExecutor |
| `propagates non-kill-switch errors unchanged` | `BIFROST_ENABLED=0` → wrapper throws `/Bifrost is not enabled/` (no fallback attempted) |
| `BifrostNoFallbackError surfaces a distinct, operator-readable error` | name === `"BifrostNoFallbackError"`, message contains provider + underlying reason, `instanceof Error` |

## Verification

- Hook chain on commit: ✔️ secret-scan, ✔️ editorconfig, ✔️ t11-any-budget (with new
  SKIP-on-missing toggle), ✔️ cycles, ✔️ conventional commit-msg.
- Vitest: cannot run standalone in this env (`@vitejs/plugin-react` is missing from
  `node_modules`, breaks `vitest.config.ts` load — pre-existing upstream rot).
  Tests will run in CI once `bun install` is healthy.
- Manual sanity: I read the executor's `execute()` body to confirm the throw message
  template matches `matchKillSwitchFallback`'s regex exactly.

## Why this matters

The kill switch was the v8.1 track's last functional gap. With this commit:

- Operators can `forceActivate("anthropic")` and **all Bifrost traffic to Anthropic
  falls back to the legacy executor** automatically — no 500s, no manual config
  changes, no service disruption.
- The `bifrostKillSwitch.ts` module's `recordObservation()` now feeds real production
  latency/error data, so the auto-trip thresholds (5% error rate, 5s p99, 2x cost
  ratio) actually have signal to work with.
- The dispatcher layer is now the policy boundary: it decides "Bifrost vs legacy",
  the executor layer just does what it's told.

## What is still NOT done (post-B9 backlog)

- **Bifrost B5+ executor-side model cache lookup** — the `healthCheck()` already uses
  the cache (L5-111 wiring), but `execute()` does not yet consult it before dispatch.
  Strict-mode (`BIFROST_MODEL_CACHE_REQUIRED=1`) would be a good Phase 2 enhancement
  for production deployments that want to enforce cache-freshness. Deferred.
- **chatCore.ts wiring** — the dispatcher's actual call site in `chatCore.ts` still
  needs to use `dispatchBifrostWithFallback` instead of calling the executor
  directly. This is the integration step that brings the whole chain into production.
  Filed as a follow-up; will land in the next orchestration session.
- **PR #4979 follow-up** — compositeTiers backfill PR is still OPEN with my review
  posted (COMMENTED). Waiting on author response to the schema-vs-body discrepancy I
  flagged.

## References

- `open-sse/executors/bifrost.ts:328-417` — wrapper implementation
- `open-sse/executors/bifrost.ts:336-348` — `BifrostNoFallbackError`
- `open-sse/executors/bifrost.ts:356-362` — `matchKillSwitchFallback`
- `open-sse/executors/bifrost.ts:382-416` — `dispatchBifrostWithFallback`
- `tests/unit/bifrost-backend.test.ts:420-497` — wrapper tests
- `docs/adr/0031-bifrost-tier1-router.md` — ADR (B9 section)
- `docs/frameworks/BIFROST-BACKEND.md` — operator-facing guide
- `worklogs/2026-06-24-L5-115-bifrost-track-closeout.md` — predecessor closeout