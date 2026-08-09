/**
 * chatCombosCache.ts — combos cache for the chat handler (PR-ι fork-only).
 *
 * Extracted from `chat.ts` (fork-main) so the 1666-line file can shed one of
 * its smaller self-contained concerns. This module owns the in-process
 * promise-cached snapshot of the combos list, with a 10s TTL and a
 * cache-version invalidation hook so combo edits take effect immediately.
 *
 * Mirrors the existing sibling-decomposition pattern at chatCooldown.ts,
 * chatPredicates.ts, chatHelpers.ts, and resolveRoutingModel.ts.
 *
 * Public API:
 *   - COMBOS_CACHE_TTL_MS: number (10_000) — exported for tests/observability
 *   - getCombosCachedForChat(): Promise<unknown[]> — read-through cache
 *   - __resetCombosCacheForTests(): void — fork-original test helper
 *
 * Why we cache (extracted from upstream chat.ts comment block):
 *  - combos reads hit localDb; without caching every request would re-read
 *  - the Promise is cached too (not the resolved array) so concurrent
 *    callers share one in-flight read instead of N parallel reads
 *  - the cache-version check (#3147) means combo edits (create/update/
 *    delete/reorder) bust the cache immediately instead of waiting for the
 *    10s TTL — otherwise a removed target/model could keep being served
 *    as a "phantom" for up to 10s.
 *
 * Strategy note: this is a fork-only change per the Aug-2026 strategy
 * shift. chat.ts continues to call getCombosCachedForChat(); the cache
 * state lives here instead of in chat.ts's module scope. No behavior
 * change at runtime — both forms share the same Promise-cached semantics.
 *
 * Anti-pattern #73: don't couple cache state to the module that happens
 * to use it. If the cache logic is self-contained (TTL + version check +
 * promise dedupe), it belongs in its own file so it can be tested and
 * reasoned about in isolation. The fork-original `__resetCombosCacheForTests`
 * helper makes this explicit — without it, tests would have to wait 10s
 * for the TTL to expire.
 */
import { getCombos, getCombosCacheVersion } from "@/lib/localDb";

/** TTL in milliseconds. Combo reads hit localDb; 10s is the upper bound
 * for how stale a snapshot can be before the cache is force-refreshed.
 * Tunable via env var in upstream chat.ts; not exposed here on the fork
 * since chat.ts is the only caller.
 */
export const COMBOS_CACHE_TTL_MS = 10_000;

let combosCachePromise: Promise<unknown[]> | null = null;
let combosCacheTs = 0;
let combosCacheVersionSnapshot = -1;

/**
 * Read-through cache for the combos list.
 *
 *  - Returns the cached Promise if (a) one exists, (b) it's < TTL old,
 *    and (c) the cache-version hasn't changed.
 *  - Otherwise, refreshes the cache and returns the new Promise.
 *
 * The Promise is cached (not the resolved array) so concurrent callers
 * share one in-flight read instead of N parallel reads. Errors are
 * silently swallowed and return an empty array — callers can handle
 * the empty case gracefully.
 *
 * Fork-original: callers can reset the cache state via
 * `__resetCombosCacheForTests()` so tests don't have to wait 10s
 * for the TTL to expire.
 */
export async function getCombosCachedForChat(): Promise<unknown[]> {
  const now = Date.now();
  if (
    combosCachePromise !== null &&
    now - combosCacheTs < COMBOS_CACHE_TTL_MS &&
    combosCacheVersionSnapshot === getCombosCacheVersion()
  ) {
    return combosCachePromise;
  }

  combosCacheTs = now;
  combosCacheVersionSnapshot = getCombosCacheVersion();
  combosCachePromise = getCombos().catch(() => []);
  return combosCachePromise;
}

/**
 * Fork-original test helper: reset the module-level cache state so the
 * next call to `getCombosCachedForChat()` triggers a fresh read.
 *
 * NOT exported from chat.ts's index — only this module exports it.
 * Tests use this to bypass the 10s TTL between test cases.
 */
export function __resetCombosCacheForTests(): void {
  combosCachePromise = null;
  combosCacheTs = 0;
  combosCacheVersionSnapshot = -1;
}

/**
 * Fork-original test helper: read-only snapshot of the current cache
 * state for assertion purposes. Returns null if no cache has been
 * populated yet.
 */
export function __getCombosCacheStateForTests(): {
  hasCachedPromise: boolean;
  cachedAtMs: number;
  cachedVersion: number;
} {
  return {
    hasCachedPromise: combosCachePromise !== null,
    cachedAtMs: combosCacheTs,
    cachedVersion: combosCacheVersionSnapshot,
  };
}
