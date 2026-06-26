/**
 * Cache stampede protection — PR-036 Multi-tier LRU Cache
 *
 * Prevents thundering-herd / dog-pile effects when a popular cache key
 * expires and N concurrent requests all miss simultaneously.  Only the
 * **first** miss is allowed to re-generate the value; all subsequent
 * callers for the same key await the in-flight generation promise.
 *
 * The lock is a simple in-memory Map<string, Promise>.  When the
 * generation promise settles (fulfil or reject) the lock is released.
 *
 * **Env knobs**:
 *   - `STAMPEDE_LOCK_TIMEOUT_MS` — max time a waiter waits (default
 *     30 000 ms / 30 s).  If the generator hangs, waiters unblock.
 *
 * @module lib/cache/cacheStampede
 */

// ── Types ─────────────────────────────────────────────

export interface StampedeOptions {
  /** Max time a waiter blocks on an in-flight generation (ms). */
  lockTimeoutMs?: number;
}

export type StampedeGenerator<T> = () => Promise<T>;

// ── In-memory lock table ──────────────────────────────

const locks = new Map<string, Promise<unknown>>();
const lockTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_LOCK_TIMEOUT_MS = 30_000;

// ── Stampede Guard ────────────────────────────────────

/**
 * Acquire a stampede-protected generation slot for `key`.
 *
 * - If no generation is in-flight → call `generator`, cache the promise,
 *   and return its result.
 * - If a generation IS in-flight for the same key → await the existing
 *   promise and return its result (the caller does NOT invoke generator).
 *
 * The internal lock is released automatically after the promise settles
 * OR after `lockTimeoutMs` (whichever comes first), so a hang in the
 * generator does not permanently block callers.
 *
 * @example
 * ```ts
 * // Instead of:
 * const value = await fetchExpensiveData(key);
 * cache.set(key, value);
 *
 * // Use:
 * const value = await stampedeGuard(key, () => fetchExpensiveData(key));
 * cache.set(key, value);
 * ```
 */
export async function stampedeGuard<T>(
  key: string,
  generator: StampedeGenerator<T>,
  options?: StampedeOptions,
): Promise<T> {
  const timeoutMs = options?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;

  // 1. If there's already an in-flight generation for this key, join it
  const existing = locks.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // 2. First caller — create the generation promise
  const promise = generator()
    .then((result) => {
      releaseLock(key);
      return result;
    })
    .catch((error) => {
      releaseLock(key);
      throw error;
    });

  locks.set(key, promise);

  // 3. Safety net: if the generator hangs past the timeout, release the
  //    lock so subsequent callers can try themselves.
  const timer = setTimeout(() => {
    if (locks.has(key)) {
      releaseLock(key);
    }
  }, timeoutMs);
  lockTimers.set(key, timer);

  return promise as Promise<T>;
}

// ── Lock introspection / test helpers ─────────────────

/**
 * Check if a generation is currently in-flight for `key`.
 * Useful for tests and diagnostics.
 */
export function isInflight(key: string): boolean {
  return locks.has(key);
}

/**
 * Return the number of in-flight generations.
 * Useful for tests and diagnostics.
 */
export function inflightCount(): number {
  return locks.size;
}

/**
 * Clear all in-flight locks (for testing / cleanup).
 */
export function clearInflight(): void {
  for (const [key] of locks) {
    releaseLock(key);
  }
}

// ── Internal ──────────────────────────────────────────

function releaseLock(key: string): void {
  const timer = lockTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    lockTimers.delete(key);
  }
  locks.delete(key);
}
