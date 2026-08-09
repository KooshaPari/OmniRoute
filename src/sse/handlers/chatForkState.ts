/**
 * chatForkState.ts — fork-original chat-state introspection (PR-κ).
 *
 * Aggregates the public API surface of every fork-original sibling module
 * (chatCooldown.ts, chatPredicates.ts, chatCombosCache.ts) into a single
 * snapshot function that returns a JSON-serializable object suitable for:
 *
 *   - HTTP observability endpoints (e.g., /v1/internal/chat-fork-state)
 *   - MCP resources (chat://fork-state) for our thegent-mcp server
 *   - Debug commands (chat-fork-state --json)
 *   - Test assertions in fork-original integration tests
 *
 * Why this exists (fork-original rationale):
 *   - chatCooldown.ts exports helpers that describe the cooldown state
 *   - chatPredicates.ts exports the breaker status set + predicates
 *   - chatCombosCache.ts exports the cache state + TTL
 *   - Without a single entry point, callers have to import + call each
 *     one separately, and the shape of the introspection payload isn't
 *     stable across fork revisions.
 *   - getForkChatState() makes the snapshot shape canonical so future
 *     endpoints / MCP resources can rely on it.
 *
 * Strategy note: this is a fork-only change per the Aug-2026 strategy
 * shift. Upstream does not have an equivalent function; the entire module
 * is fork-original.
 *
 * Anti-pattern #74: don't expect callers to import + compose multiple
 * sibling modules just to get a single snapshot. If the snapshot is
 * useful (and it is — for observability), expose it as a single
 * well-typed function with a stable shape.
 */
import {
  COMBOS_CACHE_TTL_MS,
  __getCombosCacheStateForTests,
} from "./chatCombosCache";
import {
  PROVIDER_BREAKER_FAILURE_STATUSES,
  PROVIDER_BREAKER_FAILURE_STATUSES_SORTED,
  isProviderBreakerFailureStatus,
} from "./chatPredicates";
import {
  formatWaitSeconds,
  describeCooldownWait,
} from "./chatCooldown";

/**
 * Fork-versioning metadata. Bumped whenever the snapshot shape changes
 * so callers can detect backward-incompatible revisions.
 *
 * Versioning rules:
 *   - PATCH: additive field added (callers reading old fields still work)
 *   - MINOR: field renamed or removed (callers should re-read the docs)
 *   - MAJOR: snapshot shape fundamentally changed (callers should rebuild)
 */
export const FORK_CHAT_STATE_VERSION = "1.0.0" as const;

export interface ForkCombosCacheSnapshot {
  /** Whether a cached Promise currently exists (vs. cache miss). */
  hasCachedPromise: boolean;
  /** Unix ms when the cache was last populated. 0 if never populated. */
  cachedAtMs: number;
  /** The cache-version that was snapshotted at last refresh. */
  cachedVersion: number;
  /** TTL in ms before the cache is force-refreshed. */
  ttlMs: number;
}

export interface ForkBreakerPredicatesSnapshot {
  /** Sorted array of HTTP status codes that trip the provider breaker. */
  statusCodes: readonly number[];
  /** Convenience count. */
  size: number;
  /** Sample predicate call: isProviderBreakerFailureStatus(503) === true. */
  sampleTrue: { status: number; tripsBreaker: boolean };
  /** Sample predicate call: isProviderBreakerFailureStatus(200) === false. */
  sampleFalse: { status: number; tripsBreaker: boolean };
}

export interface ForkCooldownHelpersSnapshot {
  /** Round-trip: formatWaitSeconds(7500) → 8. */
  sampleFormatSeconds: { inputMs: number; outputSec: number };
  /** Round-trip: describeCooldownWait({ shouldRetry: true, waitMs: 7500 }) → '8s'. */
  sampleDescribeWait: { input: { shouldRetry: boolean; waitMs: number }; output: string };
  /** Edge case: describeCooldownWait({ shouldRetry: false, waitMs: 999_999 }) → 'no-retry'. */
  sampleNoRetry: { output: string };
}

export interface ForkChatStateSnapshot {
  /** Fork-versioning metadata. */
  version: string;
  /** Snapshot generation timestamp (Unix ms). */
  generatedAtMs: number;
  /** Combos cache state. */
  combosCache: ForkCombosCacheSnapshot;
  /** Breaker predicates state. */
  breakerPredicates: ForkBreakerPredicatesSnapshot;
  /** Cooldown helpers state. */
  cooldownHelpers: ForkCooldownHelpersSnapshot;
}

/**
 * Aggregate the public API surface of every fork-original sibling module
 * into a single JSON-serializable snapshot.
 *
 * Pure function: never throws, never makes I/O, never reads from disk or
 * network. Reads only in-process module-level state from chatCombosCache.
 *
 * Output shape is stable across fork-revisions within FORK_CHAT_STATE_VERSION.
 * Adding fields is backward-compatible (callers ignore unknown fields);
 * removing or renaming fields requires a version bump.
 */
export function getForkChatState(): ForkChatStateSnapshot {
  const cacheState = __getCombosCacheStateForTests();

  return {
    version: FORK_CHAT_STATE_VERSION,
    generatedAtMs: Date.now(),
    combosCache: {
      hasCachedPromise: cacheState.hasCachedPromise,
      cachedAtMs: cacheState.cachedAtMs,
      cachedVersion: cacheState.cachedVersion,
      ttlMs: COMBOS_CACHE_TTL_MS,
    },
    breakerPredicates: {
      statusCodes: PROVIDER_BREAKER_FAILURE_STATUSES_SORTED,
      size: PROVIDER_BREAKER_FAILURE_STATUSES.size,
      sampleTrue: { status: 503, tripsBreaker: isProviderBreakerFailureStatus(503) },
      sampleFalse: { status: 200, tripsBreaker: isProviderBreakerFailureStatus(200) },
    },
    cooldownHelpers: {
      sampleFormatSeconds: { inputMs: 7500, outputSec: formatWaitSeconds(7500) },
      sampleDescribeWait: {
        input: { shouldRetry: true, waitMs: 7500 },
        output: describeCooldownWait({ shouldRetry: true, waitMs: 7500 }),
      },
      sampleNoRetry: { output: describeCooldownWait({ shouldRetry: false, waitMs: 999_999 }) },
    },
  };
}

/**
 * Fork-original convenience: return the snapshot as a JSON string.
 *
 * Pure function. Equivalent to `JSON.stringify(getForkChatState())` but
 * centralized so the JSON shape can be pinned with reference-equality
 * tests against `JSON.parse(JSON.stringify(snapshot))`.
 */
export function getForkChatStateJson(): string {
  return JSON.stringify(getForkChatState(), null, 2);
}
