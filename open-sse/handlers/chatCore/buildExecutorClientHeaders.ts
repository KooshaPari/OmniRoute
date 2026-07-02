/**
 * chatCore executor client-headers builder (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Pure transform extracted from handleChatCore: takes the raw inbound request headers
 * (which may arrive as either a WHATWG `Headers` instance or a plain string-keyed object,
 * neither, or null) plus an optional user-agent override, and produces a normalized
 * `Record<string, string>` of header values that downstream executor `.execute(opts)`
 * wrappers can attach to per-model upstream calls.
 *
 * Behaviour, contract:
 *   - If `headers` is a `Headers` instance, its entries are iterated; per the WHATWG
 *     spec `Headers.prototype.forEach` passes the lower-cased key, so the resulting map
 *     will use lower-cased keys for those entries.
 *   - If `headers` is a plain object, entries keep whatever key casing was supplied by
 *     the caller, and only entries whose value is a `string` are kept. Non-string values
 *     (numbers, arrays, undefined, null, booleans) are silently dropped — this matches the
 *     previous inline behaviour so executors never see non-string header values.
 *   - If a non-empty (post-trim) `userAgent` is supplied AND the inputs do not already
 *     provide a `user-agent` (lowercase) or `User-Agent` (PascalCase) header, both
 *     spellings are written so providers that normalize against either form pick up the
 *     override.
 *   - The function returns `null` when the resulting map is empty (no inbound headers and
 *     no user-agent override). Callers gate `.execute()` plumbing on truthy `clientHeaders`
 *     so `null` is the explicit "nothing to attach" sentinel; this avoids sending an
 *     empty `{}` that downstream Logging-After-Handler / MitM would still surface.
 *
 * Side-effect-free: does not mutate the input `headers` object or its `Headers` instance,
 * does not read or write any module-level state, and does not perform I/O. Behaviour is
 * byte-identical to the previous inline closure.
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
