/**
 * rateLimitHeaders.ts — pure parsers for upstream rate-limit response headers.
 *
 * Extracted from rateLimitManager.ts to:
 *   - keep the orchestration file (1034 LOC) focused on Bottleneck wiring + watchdog
 *   - make the parsers directly unit-testable without spinning up a limiter
 *   - allow other modules (chatCore, provider executors) to reuse the same parsers
 *
 * Two header families:
 *   - STANDARD_HEADERS: OpenAI, xAI, Groq, Mistral, OpenRouter, Fireworks, etc.
 *   - ANTHROPIC_HEADERS: Claude / Anthropic (different prefix, no overLimit signal)
 *
 * No I/O. No side effects. No dependency on the orchestration code in
 * rateLimitManager.ts.
 */

import type { LoggerLike } from "./rateLimitTypes.ts";

// ---------------------------------------------------------------------------
// Header families
// ---------------------------------------------------------------------------

/**
 * OpenAI-compatible rate-limit headers. Used by ~80% of upstream providers
 * behind the `DefaultExecutor`. The `overLimit` signal is Fireworks-specific
 * (it warns before the actual 429). Most providers omit it.
 */
export const STANDARD_HEADERS = {
  limit: "x-ratelimit-limit-requests",
  remaining: "x-ratelimit-remaining-requests",
  reset: "x-ratelimit-reset-requests",
  limitTokens: "x-ratelimit-limit-tokens",
  remainingTokens: "x-ratelimit-remaining-tokens",
  resetTokens: "x-ratelimit-reset-tokens",
  retryAfter: "retry-after",
  overLimit: "x-ratelimit-over-limit",
} as const;

/**
 * Anthropic-specific rate-limit headers. No `overLimit` early-warning — Anthropic
 * signals degradation through the `anthropic-ratelimit-tokens-reset` family.
 */
export const ANTHROPIC_HEADERS = {
  limit: "anthropic-ratelimit-requests-limit",
  remaining: "anthropic-ratelimit-requests-remaining",
  reset: "anthropic-ratelimit-requests-reset",
  limitTokens: "anthropic-ratelimit-input-tokens-limit",
  remainingTokens: "anthropic-ratelimit-input-tokens-remaining",
  resetTokens: "anthropic-ratelimit-input-tokens-reset",
  retryAfter: "retry-after",
} as const;

export type RateLimitHeaderSet =
  | typeof STANDARD_HEADERS
  | typeof ANTHROPIC_HEADERS;

/** Pick the right header family for the given provider id. */
export function pickHeaderSetForProvider(provider: string): RateLimitHeaderSet {
  return provider === "claude" || provider === "anthropic"
    ? ANTHROPIC_HEADERS
    : STANDARD_HEADERS;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse a reset-time string into milliseconds-from-now.
 * Accepts:
 *   - Duration strings: "1s", "500ms", "1m30s", "2h15m"
 *   - Pure numbers: treated as seconds (or Unix timestamp if > year 2025)
 *   - ISO date strings
 *
 * Returns `null` if the input is unparseable or the result is non-positive.
 */
export function parseResetTime(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;

  // Duration strings: "1s", "500ms", "1m30s", "2h15m"
  const durationMatch = value.match(
    /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+)s)?(?:(\d+)ms)?$/
  );
  if (durationMatch && (durationMatch[1] || durationMatch[2] || durationMatch[3] || durationMatch[4])) {
    const [, h, m, s, ms] = durationMatch;
    const totalMs =
      (parseInt(h || "0", 10) * 3600 +
        parseInt(m || "0", 10) * 60 +
        parseInt(s || "0", 10)) *
        1000 +
      parseInt(ms || "0", 10);
    return totalMs > 0 ? totalMs : null;
  }

  // Pure number: assume seconds (or Unix timestamp if > year 2025)
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    if (num > 1_700_000_000) {
      // Unix timestamp — return ms-until-then
      return Math.max(0, num * 1000 - Date.now());
    }
    return num * 1000;
  }

  // ISO date string. Reject epoch-zero and pre-1970 dates (treated as invalid).
  if (!Number.isFinite(num)) {
    try {
      const date = new Date(value);
      const ms = date.getTime();
      if (!Number.isNaN(ms) && ms > 0) return Math.max(0, ms - Date.now());
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Normalize any header-ish object (Headers / Map / plain object / Node IncomingMessage)
 * into a `Record<string, string>` keyed by lower-cased header name.
 *
 * Returns `{}` on null / non-object inputs. Tries `forEach` first (works for
 * `Headers`), then `entries()` (works for `Map`), and finally falls back to
 * `Object.entries` (works for plain objects).
 */
export function toPlainHeaders(headers: unknown): Record<string, string> {
  if (!headers) return {};
  const obj = headers as Record<string, unknown>;
  const plain: Record<string, string> = {};

  if (typeof obj.forEach === "function") {
    try {
      (obj.forEach as (cb: (v: string, k: string) => void) => void)(
        (v: string, k: string) => {
          plain[k.toLowerCase()] = v;
        }
      );
      return plain;
    } catch {
      // fall through to next strategy
    }
  }

  if (typeof obj.entries === "function") {
    try {
      for (const [k, v] of (obj.entries as () => Iterable<[string, string]>)()) {
        plain[k.toLowerCase()] = v == null ? "" : String(v);
      }
      return plain;
    } catch {
      // fall through
    }
  }

  try {
    for (const [k, v] of Object.entries(obj)) {
      plain[k.toLowerCase()] = v == null ? "" : String(v);
    }
  } catch {
    // ignore
  }
  return plain;
}

// ---------------------------------------------------------------------------
// High-level signal extractor
// ---------------------------------------------------------------------------

/**
 * Structured signal extracted from a single upstream response. Consumed by
 * `updateFromHeaders` in `rateLimitManager.ts` to update Bottleneck settings.
 */
export interface RateLimitSignal {
  /** RPM / RPM-equivalent (request budget). Null if header absent or unparseable. */
  limit: number | null;
  /** Requests remaining in the current window. Null if absent. */
  remaining: number | null;
  /** Reset duration in ms (Retry-After or vendor reset header). Null if absent. */
  resetMs: number | null;
  /** Token-budget limit (some providers split RPM and TPM). Null if absent. */
  limitTokens: number | null;
  /** Token-budget remaining. Null if absent. */
  remainingTokens: number | null;
  /** Token reset duration in ms. Null if absent. */
  resetTokensMs: number | null;
  /** RFC 7231 `Retry-After` header parsed to ms. Null if absent. Often present on 429. */
  retryAfterMs: number | null;
  /** Fireworks-style soft "near capacity" warning. Boolean. */
  overLimit: boolean;
  /** True if the request was actually rejected (HTTP 429). */
  isHardLimit: boolean;
}

const HARD_LIMIT_STATUS = 429;

/**
 * Extract a `RateLimitSignal` from response headers + status code.
 *
 * @param headers — any header-ish object (Headers, Map, plain object)
 * @param status — HTTP status code from the upstream response
 * @param provider — provider id used to pick the right header family
 */
export function extractRateLimitSignal(
  headers: unknown,
  status: number,
  provider: string
): RateLimitSignal {
  const plain = toPlainHeaders(headers);
  const set = pickHeaderSetForProvider(provider);
  const get = (name: string): string | null => plain[name.toLowerCase()] ?? null;

  const parseIntOrNull = (v: string | null): number | null => {
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    limit: parseIntOrNull(get(set.limit)),
    remaining: parseIntOrNull(get(set.remaining)),
    resetMs: parseResetTime(get(set.reset)),
    limitTokens: parseIntOrNull(get(set.limitTokens)),
    remainingTokens: parseIntOrNull(get(set.remainingTokens)),
    resetTokensMs: parseResetTime(get(set.resetTokens)),
    retryAfterMs: parseResetTime(get(set.retryAfter)),
    overLimit: get(STANDARD_HEADERS.overLimit) === "yes",
    isHardLimit: status === HARD_LIMIT_STATUS,
  };
}

/**
 * Apply a `RateLimitSignal` to a limiter-update payload. Pure function — given
 * the same signal + previous state, returns the same updates.
 *
 * @param signal — extracted from `extractRateLimitSignal`
 * @returns partial Bottleneck update payload, or `null` if no update is warranted
 */
export function signalToLimiterUpdates(
  signal: RateLimitSignal
): Record<string, number | null> | null {
  // Hard-limit and soft-limit cases don't change minTime/reservoir here —
  // they are handled by the caller (which needs to evict + reconnect the
  // limiter instance, not just mutate settings).
  if (signal.isHardLimit || signal.overLimit) return null;

  if (signal.limit == null) return null;

  const updates: Record<string, number | null> = {
    minTime: Math.max(0, Math.floor(60_000 / signal.limit) - 10),
  };

  if (signal.remaining != null) {
    if (signal.remaining < signal.limit * 0.1) {
      // Low headroom — throttle to remaining + reset every resetMs
      updates.reservoir = signal.remaining;
      updates.reservoirRefreshAmount = signal.limit;
      updates.reservoirRefreshInterval = signal.resetMs ?? 60_000;
    } else if (signal.remaining > signal.limit * 0.5) {
      // Plenty of headroom — relax the limiter
      updates.minTime = 0;
      updates.reservoir = null;
      updates.reservoirRefreshAmount = null;
      updates.reservoirRefreshInterval = null;
    }
  }

  return updates;
}

/**
 * Optional lightweight logger for parsing diagnostics. Wired in by callers
 * (rateLimitManager) that want rate-limit telemetry in their pino stream.
 */
export type RateLimitHeaderLogger = Pick<LoggerLike, "info" | "warn" | "error">;