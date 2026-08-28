type JsonRecord = Record<string, unknown>;

const MAX_DELAY_TEXT_LENGTH = 64;
const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

function objectRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function positiveCappedMs(value: unknown, maxMs: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(value, maxMs)
    : null;
}

function futureTimestampMs(value: unknown, maxMs: number): number | null {
  if (typeof value !== "string") return null;
  const parsedTs = Date.parse(value);
  if (!Number.isFinite(parsedTs)) return null;
  const waitMs = parsedTs - Date.now();
  return waitMs > 0 ? Math.min(waitMs, maxMs) : null;
}

/**
 * Parse delay strings like "33s", "26.660853464s", "2m", "1h", "1500ms", or a bare
 * number of seconds. Shared by account-fallback retry parsing and rate-limit handling.
 */
export function parseDelayString(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value * 1000 <= MAX_DELAY_MS
      ? Math.round(value * 1000)
      : null;
  }
  if (typeof value !== "string" || value.length > MAX_DELAY_TEXT_LENGTH) return null;
  const str = value.trim();
  if (!str || str.length > MAX_DELAY_TEXT_LENGTH) return null;

  function toDelayMs(amount: string, multiplier: number): number | null {
    const delayMs = Number(amount) * multiplier;
    return Number.isFinite(delayMs) && delayMs >= 0 && delayMs <= MAX_DELAY_MS
      ? Math.round(delayMs)
      : null;
  }

  const msMatch = /^(\d+(?:\.\d+)?)\s*ms$/i.exec(str);
  if (msMatch) return toDelayMs(msMatch[1], 1);
  const secMatch = /^(\d+(?:\.\d+)?)\s*s$/i.exec(str);
  if (secMatch) return toDelayMs(secMatch[1], 1000);
  const minMatch = /^(\d+(?:\.\d+)?)\s*m$/i.exec(str);
  if (minMatch) return toDelayMs(minMatch[1], 60 * 1000);
  const hrMatch = /^(\d+(?:\.\d+)?)\s*h$/i.exec(str);
  if (hrMatch) return toDelayMs(hrMatch[1], 3600 * 1000);
  // Bare number means seconds.
  return /^\d+(?:\.\d+)?$/.test(str) ? toDelayMs(str, 1000) : null;
}

/**
 * Parse Retry-After hints from a 429 JSON response body. Providers use both
 * top-level and nested `error` fields for ISO timestamps and millisecond values.
 */
export function parseRetryHintFromJsonBody(body: string, maxMs: number): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const root = objectRecord(parsed);
  if (!Object.keys(root).length) return null;
  const errorObj = objectRecord(root.error);

  const isoHint = futureTimestampMs(errorObj.retryAfter ?? root.retryAfter, maxMs);
  if (isoHint !== null) return isoHint;

  return positiveCappedMs(
    errorObj.retry_after_ms ?? root.retry_after_ms ?? errorObj.retryAfterMs ?? root.retryAfterMs,
    maxMs
  );
}
