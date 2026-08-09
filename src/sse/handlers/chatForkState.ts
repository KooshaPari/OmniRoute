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

// ─────────────────────────────────────────────────────────────────────────────
// PR-λ: diff + format helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fork-original structured diff between two snapshots.
 *
 * Useful for change tracking in observability endpoints — instead of
 * comparing two full JSON blobs (noisy), callers can read the structured
 * diff and surface only what changed.
 *
 * Diff rules:
 *   - `versionChanged: true` if the snapshot version differs (rare;
 *     indicates a backward-incompatible shape change)
 *   - `cacheChanged: true` if any combosCache field differs
 *   - `cacheFieldsChanged`: array of field names that changed
 *   - `generatedAtMsDelta`: positive if `after` is newer than `before`
 *
 * Pure function. Never throws. If `before` or `after` is null/undefined,
 * returns a diff with `cacheChanged: null` and an empty fields array.
 */
export interface ForkChatStateDiff {
  versionChanged: boolean;
  cacheChanged: boolean;
  cacheFieldsChanged: readonly string[];
  generatedAtMsDelta: number;
}

export function diffForkChatStates(
  before: ForkChatStateSnapshot | null | undefined,
  after: ForkChatStateSnapshot | null | undefined,
): ForkChatStateDiff {
  if (!before || !after) {
    return {
      versionChanged: false,
      cacheChanged: false,
      cacheFieldsChanged: [],
      generatedAtMsDelta: 0,
    };
  }

  const versionChanged = before.version !== after.version;

  const cacheFieldsChanged: string[] = [];
  const cacheKeys: (keyof ForkCombosCacheSnapshot)[] = [
    "hasCachedPromise",
    "cachedAtMs",
    "cachedVersion",
    "ttlMs",
  ];
  for (const key of cacheKeys) {
    if (before.combosCache[key] !== after.combosCache[key]) {
      cacheFieldsChanged.push(key);
    }
  }

  return {
    versionChanged,
    cacheChanged: cacheFieldsChanged.length > 0,
    cacheFieldsChanged,
    generatedAtMsDelta: after.generatedAtMs - before.generatedAtMs,
  };
}

/**
 * Fork-original CLI formatter. Returns a multi-line string suitable for
 * terminal output — one row per snapshot field, aligned columns.
 *
 * Pure function. Useful for `chat-fork-state --cli` debug commands and
 * for piping into log aggregation tools.
 *
 * Example output:
 *   Fork Chat State v1.0.0
 *   generatedAtMs           1786308712000
 *   combosCache.hasCachedPromise   false
 *   combosCache.cachedAtMs         0
 *   combosCache.cachedVersion      -1
 *   combosCache.ttlMs              10000
 *   breakerPredicates.size         5
 *   breakerPredicates.statusCodes  [408, 500, 502, 503, 504]
 *   breakerPredicates.sampleTrue   { status: 503, tripsBreaker: true }
 *   breakerPredicates.sampleFalse  { status: 200, tripsBreaker: false }
 *   cooldownHelpers.formatSample   7500ms → 8s
 *   cooldownHelpers.describeSample 8s
 *   cooldownHelpers.noRetrySample  no-retry
 */
export function formatForkChatStateForCli(snapshot?: ForkChatStateSnapshot): string {
  const snap = snapshot ?? getForkChatState();
  const lines: string[] = [];

  lines.push(`Fork Chat State v${snap.version}`);
  lines.push(`generatedAtMs           ${snap.generatedAtMs}`);

  lines.push(`combosCache.hasCachedPromise   ${snap.combosCache.hasCachedPromise}`);
  lines.push(`combosCache.cachedAtMs         ${snap.combosCache.cachedAtMs}`);
  lines.push(`combosCache.cachedVersion      ${snap.combosCache.cachedVersion}`);
  lines.push(`combosCache.ttlMs              ${snap.combosCache.ttlMs}`);

  lines.push(`breakerPredicates.size         ${snap.breakerPredicates.size}`);
  lines.push(`breakerPredicates.statusCodes  [${snap.breakerPredicates.statusCodes.join(", ")}]`);
  lines.push(
    `breakerPredicates.sampleTrue   { status: ${snap.breakerPredicates.sampleTrue.status}, tripsBreaker: ${snap.breakerPredicates.sampleTrue.tripsBreaker} }`,
  );
  lines.push(
    `breakerPredicates.sampleFalse  { status: ${snap.breakerPredicates.sampleFalse.status}, tripsBreaker: ${snap.breakerPredicates.sampleFalse.tripsBreaker} }`,
  );

  lines.push(
    `cooldownHelpers.formatSample   ${snap.cooldownHelpers.sampleFormatSeconds.inputMs}ms → ${snap.cooldownHelpers.sampleFormatSeconds.outputSec}s`,
  );
  lines.push(`cooldownHelpers.describeSample ${snap.cooldownHelpers.sampleDescribeWait.output}`);
  lines.push(`cooldownHelpers.noRetrySample  ${snap.cooldownHelpers.sampleNoRetry.output}`);

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-μ: fork-original module metadata + poll helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fork-original module metadata. Lets callers enumerate which fork-original
 * sibling modules are loaded + what their exports look like.
 *
 * Useful for:
 *   - "what fork modules are loaded?" debugging
 *   - Dynamic dispatch in future MCP resources / HTTP endpoints
 *   - Self-describing dashboards ("fork modules: 4, predicates: 7")
 */
export interface ForkModuleMetadata {
  name: string;
  description: string;
  exportCount: number;
  /** Most useful exports (subset, up to 5). */
  notableExports: readonly string[];
}

export const FORK_MODULES: readonly ForkModuleMetadata[] = [
  {
    name: "chatCooldown",
    description:
      "Credential cooldown/retry helpers extracted from chat.ts (PR-α). Owns the wait-log-retry dance for allRateLimited branches.",
    exportCount: 6,
    notableExports: [
      "decideAndWaitForCooldownRetry",
      "recordAccountCooldown",
      "shouldAbortOnRetryWait",
      "createCooldownPropagationState",
      "describeCooldownWait",
    ],
  },
  {
    name: "chatPredicates",
    description:
      "Pure predicates + tuning constants for chat.ts (PR-δ/ε/θ). Owns the breaker-trip decision surface.",
    exportCount: 6,
    notableExports: [
      "PROVIDER_BREAKER_FAILURE_STATUSES",
      "shouldTripProviderBreakerForResult",
      "shouldTripBreakerForAllRateLimited",
      "isProviderBreakerFailureStatus",
      "isAntigravityMissingProjectError",
    ],
  },
  {
    name: "chatCombosCache",
    description:
      "Read-through Promise cache for combos (PR-ι). 10s TTL + cache-version invalidation (#3147).",
    exportCount: 4,
    notableExports: [
      "COMBOS_CACHE_TTL_MS",
      "getCombosCachedForChat",
      "__resetCombosCacheForTests",
      "__getCombosCacheStateForTests",
    ],
  },
  {
    name: "chatForkState",
    description:
      "Fork-original introspection (PR-κ/λ/μ). Aggregates the public API surface of every fork-original sibling module into a single snapshot.",
    exportCount: 5,
    notableExports: [
      "getForkChatState",
      "getForkChatStateJson",
      "diffForkChatStates",
      "formatForkChatStateForCli",
      "FORK_MODULES",
    ],
  },
] as const;

/**
 * Aggregate metadata about every fork-original sibling module loaded.
 * Pairs with `getForkChatState()` for self-describing dashboards.
 */
export interface ForkModuleSummary {
  moduleCount: number;
  totalExports: number;
  modules: readonly ForkModuleMetadata[];
}

export function summarizeForkModules(): ForkModuleSummary {
  const modules = FORK_MODULES;
  const totalExports = modules.reduce((sum, m) => sum + m.exportCount, 0);
  return {
    moduleCount: modules.length,
    totalExports,
    modules,
  };
}

/**
 * Fork-original poll helper. Repeatedly snapshots + diffs the fork state
 * and invokes `callback` for each tick. Returns an unsubscribe handle.
 *
 * Pure orchestration — does NOT actually schedule timers (callers do that
 * with `setInterval` or in tests with manual loops). This keeps the
 * function testable without flakiness from real timers.
 *
 * Anti-pattern #77: don't bake setInterval into a snapshot function. Tests
 * should drive the polling manually, and production code should control
 * the timing for observability. Returning an unsubscribe handle makes
 * both cases ergonomic.
 */
export type ForkStateListener = (snapshot: ForkChatStateSnapshot) => void;

export interface ForkStatePoller {
  /** Read the latest snapshot and invoke the listener with it. */
  tick(): ForkChatStateSnapshot;
  /** Stop the poller. Idempotent. */
  unsubscribe(): void;
}

export function pollForkChatState(listener: ForkStateListener): ForkStatePoller {
  let active = true;
  let lastSnapshot: ForkChatStateSnapshot = getForkChatState();

  // Fire once immediately so subscribers get the initial state.
  listener(lastSnapshot);

  return {
    tick() {
      if (!active) return lastSnapshot;
      lastSnapshot = getForkChatState();
      listener(lastSnapshot);
      return lastSnapshot;
    },
    unsubscribe() {
      active = false;
    },
  };
}
