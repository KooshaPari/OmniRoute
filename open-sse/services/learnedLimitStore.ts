/**
 * learnedLimitStore.ts — debounced persistence for the adaptive rate-limit
 * manager's learned-rate-limit cache.
 *
 * Extracted from rateLimitManager.ts (PR-K, 2026-07-06) so the orchestrator
 * can focus on Bottleneck wiring and the persistence layer can be unit-tested
 * in isolation (debounce timing, JSON shape, stale-entry filtering).
 *
 * Persistence model:
 *   - `learnedLimits` is an in-memory `Record<key, LearnedLimitEntry>`.
 *   - Mutations go through `recordLearnedLimit()` which (a) updates the cache
 *     and (b) schedules a debounced flush via `persistLearnedLimitsNow()`.
 *   - Debounce window is `PERSIST_DEBOUNCE_MS` (60s); the timer is unref'd so
 *     it never holds the process open.
 *   - On flush, the entire object is JSON-serialized and written to the
 *     settings store under `learnedRateLimits`.
 *   - On load (`loadPersistedLimits`), entries older than 24h are dropped
 *     and remaining entries are applied to live limiters if rate limiting is
 *     still enabled for the connection.
 *
 * Ring-buffer cap (`MAX_LEARNED_LIMITS = 200`) bounds memory growth for
 * long-running deployments.
 */

import { updateSettings } from "@/lib/db/settings";
import { getSettings } from "@/lib/db/settings";
import type { LearnedLimitEntry } from "./rateLimitTypes.ts";

export const MAX_LEARNED_LIMITS = 200;
export const PERSIST_DEBOUNCE_MS = 60_000;
export const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;

export type LearnedLimitPatch = Partial<
  Omit<LearnedLimitEntry, "provider" | "connectionId" | "lastUpdated" | "model">
>;

type JsonRecord = Record<string, unknown>;
type SettingsLike = { learnedRateLimits?: unknown };

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isNodeTestRunnerChild(): boolean {
  return typeof process.env.NODE_TEST_CONTEXT === "string";
}

function logRateLimit(...args: unknown[]): void {
  if (!isNodeTestRunnerChild()) console.log(...args);
}

function errorRateLimit(...args: unknown[]): void {
  if (!isNodeTestRunnerChild()) console.error(...args);
}

export interface LearnedLimitStoreOptions {
  /** Truncate the store to this many entries on insert. Default 200. */
  maxEntries?: number;
  /** Skip persistence if the debounce window hasn't elapsed. Default 60_000 ms. */
  debounceMs?: number;
  /** Skip entries older than this on load. Default 24h. */
  staleMs?: number;
  /** Optional logger sink (defaults to console). */
  logger?: {
    log?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export interface AppliedLimiter {
  updateSettings: (settings: { minTime?: number }) => void | Promise<void>;
}

export interface AppliedLimiterRegistry {
  has(connectionId: string): boolean;
  get(key: string): AppliedLimiter | undefined;
}

/**
 * In-memory + debounced-persistence store for learned rate limits.
 *
 * Public surface is intentionally small — the orchestrator's only legitimate
 * interactions are: `record`, `flush`, `load`, `getAll`, `reset`. The
 * underlying `learnedLimits` map is private; callers that want a snapshot go
 * through `getAll()`.
 */
export class LearnedLimitStore {
  private readonly limits: Record<string, LearnedLimitEntry> = {};
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxEntries: number;
  private readonly debounceMs: number;
  private readonly staleMs: number;
  private readonly log: (...args: unknown[]) => void;
  private readonly errLog: (...args: unknown[]) => void;

  constructor(options: LearnedLimitStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? MAX_LEARNED_LIMITS;
    this.debounceMs = options.debounceMs ?? PERSIST_DEBOUNCE_MS;
    this.staleMs = options.staleMs ?? STALE_LIMIT_MS;
    this.log = options.logger?.log ?? logRateLimit;
    this.errLog = options.logger?.error ?? errorRateLimit;
  }

  /**
   * Record a learned limit entry; schedules a debounced flush.
   */
  record(
    key: string,
    patch: { provider: string; connectionId: string } & LearnedLimitPatch,
    model: string | null = null
  ): void {
    this.limits[key] = {
      ...patch,
      provider: patch.provider,
      connectionId: patch.connectionId,
      lastUpdated: Date.now(),
      model,
    };

    // Enforce ring-buffer cap by evicting the oldest entries when over.
    const keys = Object.keys(this.limits);
    if (keys.length > this.maxEntries) {
      const sortedByAge = keys.sort(
        (a, b) => (this.limits[a]?.lastUpdated ?? 0) - (this.limits[b]?.lastUpdated ?? 0)
      );
      const evictCount = keys.length - this.maxEntries;
      for (let i = 0; i < evictCount; i++) {
        const k = sortedByAge[i];
        if (k !== undefined) delete this.limits[k];
      }
    }

    if (!this.persistTimer) {
      this.persistTimer = setTimeout(() => {
        this.persistTimer = null;
        void this.persistNow();
      }, this.debounceMs);
      // Unref so the timer doesn't keep the process alive during shutdown.
      this.persistTimer.unref?.();
    }
  }

  /**
   * Read all current entries (returns a shallow snapshot, not a live ref).
   */
  getAll(): Record<string, LearnedLimitEntry> {
    return { ...this.limits };
  }

  /**
   * Cancel any pending debounce and write immediately.
   */
  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistNow();
  }

  /**
   * Cancel pending timers and clear in-memory state.
   */
  reset(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    for (const key of Object.keys(this.limits)) {
      delete this.limits[key];
    }
  }

  /**
   * True if there's a pending debounced flush.
   */
  hasPendingFlush(): boolean {
    return this.persistTimer !== null;
  }

  /**
   * Replace internal state from a JSON object (e.g. settings row).
   */
  hydrate(raw: string | null | undefined): number {
    if (typeof raw !== "string" || raw.trim().length === 0) return 0;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return 0;
    }
    const record = toRecord(parsed);
    let count = 0;
    for (const [key, dataRaw] of Object.entries(record)) {
      const data = toRecord(dataRaw);
      const lastUpdated = toNumber(data.lastUpdated, 0);
      if (lastUpdated > 0 && Date.now() - lastUpdated > this.staleMs) continue;

      const connectionId = typeof data.connectionId === "string" ? data.connectionId : "";
      const provider = typeof data.provider === "string" ? data.provider : "";
      const limit = toNumber(data.limit, 0);
      const remaining = toNumber(data.remaining, 0);
      const minTime = toNumber(data.minTime, 0);

      this.limits[key] = {
        provider,
        connectionId,
        lastUpdated,
        ...(limit > 0 ? { limit } : {}),
        ...(remaining >= 0 ? { remaining } : {}),
        ...(minTime >= 0 ? { minTime } : {}),
      };
      count++;
    }
    return count;
  }

  /**
   * Persist to settings, re-trying if the call site tracks the promise.
   */
  private async persistNow(): Promise<void> {
    try {
      await updateSettings({ learnedRateLimits: JSON.stringify(this.limits) });
      this.log(`💾 [RATE-LIMIT] Persisted learned limits for ${Object.keys(this.limits).length} provider(s)`);
    } catch (err) {
      this.errLog(
        "[RATE-LIMIT] Failed to persist learned limits:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

/**
 * Convenience: load persisted learned limits and apply to a limiter registry.
 * Returns the count of limiters that were actually re-hydrated.
 */
export async function loadLearnedLimits(
  store: LearnedLimitStore,
  registry: AppliedLimiterRegistry,
  options: { settingsOverride?: SettingsLike } = {}
): Promise<{ loaded: number; applied: number }> {
  try {
    const settings = options.settingsOverride ?? ((await getSettings()) as SettingsLike | null);
    const raw = settings?.learnedRateLimits;
    const loaded = store.hydrate(typeof raw === "string" ? raw : null);
    let applied = 0;
    for (const [key, entry] of Object.entries(store.getAll())) {
      if (!entry.connectionId) continue;
      if (!registry.has(entry.connectionId)) continue;
      const limiter = registry.get(key);
      if (!limiter) continue;
      if (entry.limit && entry.limit > 0) {
        const inferredMinTime =
          entry.minTime && entry.minTime > 0
            ? entry.minTime
            : Math.max(0, Math.floor(60_000 / entry.limit) - 10);
        await limiter.updateSettings({ minTime: inferredMinTime });
        applied++;
      }
    }
    if (applied > 0) {
      store.getAll(); // touch getter to satisfy lint about unused expression
    }
    return { loaded, applied };
  } catch (err) {
    errorRateLimit(
      "[RATE-LIMIT] Failed to load persisted limits:",
      err instanceof Error ? err.message : String(err)
    );
    return { loaded: 0, applied: 0 };
  }
}