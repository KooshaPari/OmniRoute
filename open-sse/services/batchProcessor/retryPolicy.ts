/**
 * retryPolicy.ts — pure HTTP retry / backoff / throttle helpers used by the
 * batch processor. Extracted from `open-sse/services/batchProcessor.ts` so
 * the policy can be reasoned about and tested in isolation (no DB, no
 * dispatch, no I/O).
 *
 * The module deliberately exposes small pure functions plus a single
 * `sleep` helper. All callers in `batchProcessor.ts` continue to work
 * unchanged because the public API exports the same names with the same
 * signatures.
 *
 * Extracted surface (no behavioural changes):
 *   - getRetryDelayMs   — parse `Retry-After` (delta-seconds or HTTP-date)
 *   - getBackoffDelayMs — exponential backoff with ±20% jitter
 *   - maybeThrottle     — derive a delay from `x-ratelimit-*` response headers
 *   - throttleDelay     — convert a 0..1 pressure scalar into a delay (ms)
 *   - sleep             — Promise-based timeout helper
 *   - toNumber          — defensive header value coercion
 *   - BATCH_BACKOFF_BASE_MS / BATCH_BACKOFF_MAX_MS — env-tunable bounds
 */

const BATCH_BACKOFF_BASE_MS: number =
  Number.parseInt(process.env.BATCH_BACKOFF_BASE_MS ?? "", 10) || 5_000;
const BATCH_BACKOFF_MAX_MS: number =
  Number.parseInt(process.env.BATCH_BACKOFF_MAX_MS ?? "", 10) || 3_600_000;

/**
 * Resolves a delay in ms from a HTTP `Retry-After` header.
 *
 * Supports both forms:
 *   - delta-seconds: `Retry-After: 120`
 *   - HTTP-date:     `Retry-After: Wed, 21 Oct 2015 07:28:00 GMT`
 *
 * Returns `null` when the header is missing or unparseable so the caller
 * can fall back to its own backoff policy.
 */
export function getRetryDelayMs(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) {
      return seconds * 1_000;
    }

    // fallback: HTTP-date
    const date = new Date(retryAfter).getTime();
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }
  }

  return null;
}

/**
 * Exponential backoff with ±20% jitter, clamped to `BATCH_BACKOFF_MAX_MS`.
 *
 * The jitter is critical — without it, a fleet of worker processes retrying
 * in lockstep will hammer the provider as soon as the rate-limit window
 * resets (the "thundering herd" problem).
 */
export function getBackoffDelayMs(attempt: number): number {
  const baseMs = BATCH_BACKOFF_BASE_MS;
  const maxMs = BATCH_BACKOFF_MAX_MS;

  // exponential: 2^attempt * base
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);

  // jitter ±20%
  const jitterFactor = 1 + (Math.random() * 0.4 - 0.2);

  return Math.floor(exp * jitterFactor);
}

/**
 * Computes an optional delay based on Mistral-style rate-limit headers.
 * Returns `null` when no useful signal is present, otherwise a delay in ms.
 *
 * Pressure is the smaller of two values:
 *   - request pressure: `remaining / limit`
 *   - token pressure:   `remaining / (remaining + cost)`
 *
 * Both ratios are in [0, 1]; the smaller the "remaining", the tighter the
 * pressure. Below 20% remaining we start throttling.
 */
export function maybeThrottle(headers: Headers): number | null {
  // Mistral reports these headers from their API
  const remainingReq = toNumber(headers.get("x-ratelimit-remaining-req-minute"));
  const limitReq = toNumber(headers.get("x-ratelimit-limit-req-minute"));

  const remainingTokens = toNumber(headers.get("x-ratelimit-remaining-tokens-minute"));
  const cost = toNumber(headers.get("x-ratelimit-tokens-query-cost"));

  let pressures: number[] = [];

  // Request pressureRemaining
  if (remainingReq !== null && limitReq !== null) {
    if (limitReq > 0) {
      pressures.push(remainingReq / limitReq);
    }
  }

  // Token pressureRemaining
  if (remainingTokens !== null && cost !== null) {
    if (remainingTokens + cost > 0) {
      pressures.push(remainingTokens / (remainingTokens + cost));
    }
  }

  if (pressures.length === 0) {
    console.log("[BATCH] Throttle check - no rate-limit headers present");
    return null;
  } else {
    const tokenTotal = remainingTokens != null && cost != null ? remainingTokens + cost : null;
    console.log(
      `[BATCH] Throttle check - Request pressure: ${remainingReq ?? "n/a"}/${limitReq ?? "n/a"}, Token pressure: ${remainingTokens ?? "n/a"}/${tokenTotal ?? "n/a"}`
    );
  }

  const pressureRemaining = Math.min(...pressures);

  const delay = throttleDelay(pressureRemaining);
  if (delay !== null) {
    console.log(
      `[BATCH] Throttling next request with delay of ${Math.round(delay)}ms (pressure remaining: ${(pressureRemaining * 100).toFixed(2)}%)`
    );
  }
  return delay;
}

/**
 * Maps a 0..1 `pressureRemaining` value to a delay in ms.
 *
 * - >= 0.2 → no throttling (null)
 * - < 0.2  → quadratic ramp from 200ms (at 0.2) to ~30_200ms (at 0.0),
 *           plus up to 1_000ms of additional random jitter.
 *
 * Exposed for direct testing because the mapping is non-trivial and the
 * original ensemble is hard to assert against without a Headers object.
 */
export function throttleDelay(pressure: number): number | null {
  if (pressure >= 0.2) return null;

  const severity = (0.2 - pressure) / 0.2;

  const delay = Math.pow(severity, 2) * 30_000;

  return 200 + delay + Math.random() * 1000;
}

/**
 * Defensive numeric coercion for header values. `null` / empty / NaN /
 * non-finite inputs all collapse to `null` so callers can skip them
 * without further guarding.
 */
export const toNumber = (v: string | null): number | null => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Promise-based sleep. Re-exported from the original module so the
 * extracted retry policy can be self-contained.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
