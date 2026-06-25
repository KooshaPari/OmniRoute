/**
 * Small, pure helpers extracted from chatCore.ts.
 *
 * These three functions have in common that they are:
 *   1. Self-contained (no side effects, no module-level state).
 *   2. Generic enough to be useful from sibling modules (executorHelpers,
 *      codexFailover, imageGen subcommand, etc.).
 *   3. Trivial to unit-test in isolation.
 *
 * They were previously defined as inline private helpers inside the 4,944-line
 * `chatCore.ts` monolith.  Hoisting them:
 *   - Makes them reusable from the post-v3.8.34 imageGen subcommand and the
 *     bifrost relay without copy-paste.
 *   - Lets them be imported by sibling modules without dragging in the entire
 *     chatCore dependency graph (which includes caching, billing, semantic
 *     cache, plugins, gamification, etc.).
 *   - Makes them individually testable -- chatCore.ts itself was too tangled
 *     to unit-test any of these in isolation.
 *
 * The functions are exported with stable, well-documented signatures and
 * are backwards-compatible re-exports from chatCore.ts.
 */

// ---------------------------------------------------------------------------
// Token expiry
// ---------------------------------------------------------------------------

/**
 * Returns true when the given token expiry timestamp is within `bufferMs`
 * of the current wall-clock time (or already past it).
 *
 * The default buffer of 5 minutes matches the upstream Claude/OpenAI
 * refresh-window: by the time the next request fires, the token is
 * guaranteed to be expired, so the caller should trigger a refresh now.
 *
 * Behavior:
 *   - `null` / `undefined` / `0` / `""` -> `false` (no known expiry, treat
 *     as "still good").
 *   - Invalid date strings -> `false` (`NaN - Date.now() < bufferMs` is
 *     always `false` because `NaN < anything` is `false`).
 *   - Numeric epoch milliseconds are accepted because `new Date(n)` works.
 *
 * @param expiresAt - ISO date string, epoch milliseconds, or `Date` instance.
 * @param bufferMs - How close to expiry (in ms) counts as "expiring soon".
 *                   Defaults to 5 minutes.
 * @returns `true` if the token expires within `bufferMs`; `false` otherwise.
 *
 * @example
 *   isTokenExpiringSoon("2026-06-24T12:00:00Z", 60_000); // true if within 1 min
 *   isTokenExpiringSoon(null);                            // false
 *   isTokenExpiringSoon("not a date");                    // false
 */
export function isTokenExpiringSoon(
  expiresAt: string | number | Date | null | undefined,
  bufferMs: number = 5 * 60 * 1000,
): boolean {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return expiresAtMs - Date.now() <= bufferMs;
}

// ---------------------------------------------------------------------------
// Error identification
// ---------------------------------------------------------------------------

/**
 * Pulls a stable string identifier out of an error-like value.
 *
 * chatCore classifies failures by an upstream-emitted error code (e.g.
 * `rate_limit_exceeded`, `insufficient_quota`, `context_length_exceeded`)
 * to drive combo selection, retry decisions, and observability grouping.
 * The upstream executor may surface that code via:
 *   - `error.code` (most common -- a string)
 *   - `error.code` is a non-string (number, object, undefined) -> ignored
 *   - the value is not an Error instance -> `undefined`
 *
 * Returns `undefined` for any input where a stable identifier cannot be
 * extracted.  Callers should fall back to `error.message` or `error.name`
 * in that case.
 *
 * @param error - Any value (typically an Error subclass).
 * @returns The upstream error code as a string, or `undefined`.
 *
 * @example
 *   getUpstreamErrorIdentifier({ code: "rate_limit_exceeded" }); // "rate_limit_exceeded"
 *   getUpstreamErrorIdentifier(new Error("boom"));              // undefined
 *   getUpstreamErrorIdentifier(null);                           // undefined
 *   getUpstreamErrorIdentifier({ code: 429 });                  // undefined (numbers rejected)
 *   getUpstreamErrorIdentifier({ code: "" });                   // undefined (empty strings rejected)
 */
export function getUpstreamErrorIdentifier(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Semaphore classification
// ---------------------------------------------------------------------------

/**
 * Narrow type guard for semaphore-related errors raised by
 * `chatCore/executorHelpers.ts` (and a few sibling modules).
 *
 * Two error codes can be raised when the per-account concurrency limiter
 * rejects a request:
 *
 *   - `SEMAPHORE_TIMEOUT`    - The request waited for the full timeout
 *                              window and was abandoned.  The caller should
 *                              fall back to a different account if one is
 *                              available, otherwise fail the request.
 *
 *   - `SEMAPHORE_QUEUE_FULL` - The per-account queue is at capacity and
 *                              cannot accept new requests right now.
 *                              The caller should immediately try the next
 *                              account in the combo, OR shed load.
 *
 * These two codes are the only signals that say "this account is at
 * capacity -- pick another", so the caller code paths are unified.
 *
 * @param error - Any value (typically thrown from `acquireAccountSemaphore`).
 * @returns A type predicate that narrows to `Error & { code: string }`
 *          when the error code is `SEMAPHORE_TIMEOUT` or
 *          `SEMAPHORE_QUEUE_FULL`.
 *
 * @example
 *   try {
 *     await acquireAccountSemaphore(accountId, 5_000);
 *   } catch (error) {
 *     if (isSemaphoreCapacityError(error)) {
 *       // error.code is now typed as `string`
 *       fallBackToNextAccount(error.code);
 *     } else {
 *       throw error;
 *     }
 *   }
 */
export function isSemaphoreCapacityError(
  error: unknown,
): error is Error & { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    ((error as { code?: unknown }).code === "SEMAPHORE_TIMEOUT" ||
      (error as { code?: unknown }).code === "SEMAPHORE_QUEUE_FULL")
  );
}
