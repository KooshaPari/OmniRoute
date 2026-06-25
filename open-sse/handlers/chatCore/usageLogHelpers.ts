/**
 * Usage / log metadata helpers used by the chatCore pipeline.
 *
 * All four helpers are pure and side-effect free:
 *
 *  - `toPositiveNumber`        : strict number-coercion that returns 0 for anything
 *                                non-positive, NaN, or non-numeric.
 *  - `buildCacheUsageLogMeta`  : extracts Anthropic / OpenAI / Gemini cache fields
 *                                from an upstream `usage` payload and emits a
 *                                normalized `{ cacheReadTokens, cacheCreationTokens }`
 *                                tuple (or `null` when no cache fields are present).
 *  - `attachLogMeta`           : merges a `meta` record into a `_omniroute`
 *                                envelope on `payload`, returning a new object
 *                                so callers don't accidentally mutate.
 *  - `buildExecutorClientHeaders` : normalizes a `Headers` instance or a plain
 *                                object into a `{ [k: string]: string }` map and
 *                                adds a default `User-Agent` if one isn't
 *                                already present.
 *
 * Extracted from chatCore.ts in PR-005 (post-v3.8.34 decomposition).
 *
 * @module chatCore/usageLogHelpers
 */

/**
 * Returns the input if it is a positive finite number, otherwise 0.
 *
 * @example
 *   toPositiveNumber(42)       // 42
 *   toPositiveNumber(0)        // 0  (zero is NOT positive)
 *   toPositiveNumber(-3)       // 0
 *   toPositiveNumber(NaN)      // 0
 *   toPositiveNumber("42")     // 0  (strict: strings not coerced)
 *   toPositiveNumber(null)     // 0
 *   toPositiveNumber({})       // 0
 */
export function toPositiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Walks an upstream `usage` payload and extracts cache-related token counts.
 *
 * Recognises three upstream shapes:
 *
 *   1. Anthropic (`cache_read_input_tokens`, `cache_creation_input_tokens`)
 *   2. Gemini    (`cachedTokens`)
 *   3. OpenAI    (`prompt_tokens_details.cached_tokens`,
 *                 `prompt_tokens_details.cache_creation_tokens`)
 *
 * Returns `null` when none of the above fields are present so callers can
 * cheaply skip the metadata attachment step.
 */
export function buildCacheUsageLogMeta(
  usage: Record<string, unknown> | null | undefined
): { cacheReadTokens: number; cacheCreationTokens: number } | null {
  if (!usage || typeof usage !== "object") return null;

  const promptTokenDetails =
    usage.prompt_tokens_details && typeof usage.prompt_tokens_details === "object"
      ? (usage.prompt_tokens_details as Record<string, unknown>)
      : undefined;

  const hasCacheFields =
    "cache_read_input_tokens" in usage ||
    "cachedTokens" in usage ||
    "cached_tokens" in usage ||
    "cache_creation_input_tokens" in usage ||
    (!!promptTokenDetails &&
      ("cached_tokens" in promptTokenDetails ||
        "cache_creation_tokens" in promptTokenDetails));

  const cacheReadTokens = toPositiveNumber(
    usage.cache_read_input_tokens ??
      usage.cachedTokens ??
      usage.cached_tokens ??
      promptTokenDetails?.cached_tokens
  );
  const cacheCreationTokens = toPositiveNumber(
    usage.cache_creation_input_tokens ?? promptTokenDetails?.cache_creation_tokens
  );

  if (!hasCacheFields) return null;
  return { cacheReadTokens, cacheCreationTokens };
}

/**
 * Attaches a compact metadata envelope to a payload without mutating either.
 *
 * Behavior:
 *
 *   - If `meta` is missing or empty, `payload` is returned unchanged.
 *   - If `payload` is `null`/non-object, returns `{ _omniroute: meta, _payload: payload }`
 *     so the metadata is still preserved (callers can unwrap later).
 *   - Otherwise merges `_omniroute` keys onto `payload`, preserving any
 *     pre-existing `_omniroute` keys.
 *
 * `null` / `undefined` values inside `meta` are stripped before attachment.
 */
export function attachLogMeta<T extends Record<string, unknown> | null | undefined>(
  payload: T,
  meta: Record<string, unknown> | null | undefined
): T | Record<string, unknown> {
  if (!meta || typeof meta !== "object") return payload;

  const compactMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== null && value !== undefined)
  );
  if (Object.keys(compactMeta).length === 0) return payload;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { _omniroute: compactMeta, _payload: payload ?? null };
  }

  const existing =
    payload._omniroute &&
    typeof payload._omniroute === "object" &&
    !Array.isArray(payload._omniroute)
      ? payload._omniroute
      : {};

  return {
    ...payload,
    _omniroute: {
      ...(existing as Record<string, unknown>),
      ...compactMeta,
    },
  };
}

/**
 * Normalizes a `Headers` instance or a plain record of string values into a
 * `{ [key: string]: string }` object suitable for passing into a downstream
 * `fetch` call.
 *
 * Non-string values in the plain-record branch are silently dropped (HTTP
 * headers cannot be non-string anyway).
 *
 * If the caller passed a `userAgent` and the input did not contain one, a
 * default `user-agent` is added (preserving the legacy dual-case `User-Agent`
 * fallback for the Bifrost relay path).
 *
 * Returns `null` when the result would be an empty object so callers can
 * short-circuit on `null`.
 */
export function buildExecutorClientHeaders(
  headers: Headers | Record<string, unknown> | null | undefined,
  userAgent?: string | null
): Record<string, string> | null {
  const normalized: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
  } else if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        normalized[key] = value;
      }
    }
  }

  const normalizedUserAgent = typeof userAgent === "string" ? userAgent.trim() : "";
  if (normalizedUserAgent && !normalized["user-agent"] && !normalized["User-Agent"]) {
    normalized["user-agent"] = normalizedUserAgent;
    normalized["User-Agent"] = normalizedUserAgent;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}