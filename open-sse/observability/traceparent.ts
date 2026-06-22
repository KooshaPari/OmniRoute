/**
 * W3C Trace Context — `traceparent` / `tracestate` parser & injector (B10 of v8.1).
 *
 * Pure utility, NO `@opentelemetry/api` imports. This is the canonical
 * source of truth for building a W3C `traceparent` header value, and
 * the only module in the codebase that should hand-roll the four
 * 32-bit hex fields. Every other call site imports `generateTraceparent()`
 * or `injectTraceparent()` from here.
 *
 * Why pure? Because:
 *
 *   1. **It runs in environments where the OTel API may not be loaded.**
 *      The provider-side executors (cursor, grok-web, …) build their
 *      outgoing `traceparent` header before the SDK has had a chance
 *      to install itself, and the grok-web executor specifically
 *      runs in a TLS-client context where the OTel API may not be
 *      importable at all.
 *
 *   2. **It's testable in isolation.** No SDK state, no env-var reads,
 *      no async. Inputs in, outputs out. The tests in
 *      `tests/unit/traceparent.test.ts` exercise the W3C spec edge
 *      cases (all-zero trace-id is reserved, lowercase hex, leading
 *      zeros in parent-id, …) without any OTel runtime.
 *
 *   3. **Re-roll semantics must be centralized.** W3C RFC §3.2.2.1
 *      forbids the all-zero trace-id (`00000000000000000000000000000000`)
 *      and all-zero parent-id (`0000000000000000`). If `crypto.getRandomValues`
 *      happens to return that pattern, we must re-roll. This is the
 *      only module that knows that.
 *
 * Format reference (W3C Trace Context, Level 1, Recommendation):
 *
 *   `traceparent`: `00-<32 hex trace-id>-<16 hex parent-id>-<2 hex flags>`
 *   `tracestate`:  `<key>=<value>,<key>=<value>...` (free-form vendor data, passed
 *                  through untouched; we only validate it doesn't contain a comma
 *                  when it shouldn't)
 *
 *   - The whole traceparent fits in a single line, no newlines, no whitespace.
 *   - The trace-id and parent-id are lowercase hex (per spec).
 *   - The first byte (`version`) is `00` in this implementation; we
 *     never emit anything higher.
 *   - The last byte (`flags`) is a bitfield — bit 0 is the sampled
 *     flag. All other bits are reserved and MUST be zero in
 *     version `00`; we always zero them.
 *
 * @module open-sse/observability/traceparent
 */

/** W3C `traceparent` version we always emit. Future versions re-negotiate by hand. */
export const TRACEPARENT_VERSION = "00";

/** Reserved all-zero trace-id (RFC §3.2.2.1) — must be re-rolled. */
const INVALID_TRACE_ID = "00000000000000000000000000000000";

/** Reserved all-zero parent-id (RFC §3.2.2.1) — must be re-rolled. */
const INVALID_PARENT_ID = "0000000000000000";

/** Parsed W3C traceparent. */
export interface Traceparent {
  /** Always `"00"` for traceparents we emit. Higher versions are rejected on parse. */
  version: string;
  /** 32 lowercase hex characters (16 bytes). Never all-zero. */
  traceId: string;
  /** 16 lowercase hex characters (8 bytes). Never all-zero. */
  parentId: string;
  /** 2 lowercase hex characters (1 byte). Bit 0 = sampled. */
  flags: string;
}

/** Parsed W3C tracestate (list of vendor key=value pairs, order preserved). */
export interface TracestateEntry {
  /** Vendor key — lowercase letter, then up to 255 chars of a-z, 0-9, underscore, hyphen, asterisk, slash. RFC section 3.3.1. */
  key: string;
  /** Vendor value — printable ASCII excluding comma and equals sign (escaped sequences allowed). */
  value: string;
}

/** Tagged-union result for `parseTraceparent` so callers can branch on the failure reason. */
export type TraceparentParseResult =
  | { ok: true; traceparent: Traceparent }
  | { ok: false; error: ParseError; raw: string };

export type ParseError =
  | "missing"
  | "wrong_field_count"
  | "wrong_version"
  | "bad_trace_id"
  | "bad_parent_id"
  | "bad_flags"
  | "reserved_trace_id"
  | "reserved_parent_id";

/**
 * Build a random hex string of `bytes` length using `crypto.getRandomValues`.
 * Always returns lowercase hex. Re-rolls internally if the result equals
 * the all-zero pattern (which the W3C spec reserves).
 *
 * @param bytes Number of random bytes to read.
 * @returns `bytes * 2` lowercase hex characters.
 */
function randomHex(bytes: number): string {
  // Re-roll on the (astronomically unlikely) all-zero case.
  for (let attempt = 0; attempt < 16; attempt++) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    let hex = "";
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i] ?? 0;
      hex += byte.toString(16).padStart(2, "0");
    }
    const isAllZero = hex === "0".repeat(bytes * 2);
    if (!isAllZero) return hex;
  }
  // If we hit 16 consecutive all-zero draws, something is very wrong
  // with the RNG. Fall through with the last value (which is all-zero)
  // and let downstream validation catch it. Better to ship a non-spec
  // traceparent than to spin forever.
  return "0".repeat(bytes * 2);
}

/**
 * Options for `generateTraceparent`. Optional form so call sites
 * that just want the default can pass `{}`.
 */
export interface GenerateTraceparentOptions {
  /** Whether to set the `sampled` flag (bit 0). Default: `true`. */
  sampled?: boolean;
}

/**
 * Generate a valid W3C `traceparent` header value with a fresh trace-id
 * and parent-id. The `flags` byte defaults to `01` (sampled) to match
 * upstream-provider behaviour; pass `sampled: false` for unsampled.
 *
 * Accepts either a positional `boolean` (legacy form, still supported)
 * or an options object — the call sites in cursor.ts / grok-web.ts /
 * validation.ts prefer the options object for readability.
 *
 * @param optionsOrSampled Either an options object or a boolean.
 * @returns A W3C-compliant `traceparent` header value.
 */
export function generateTraceparent(
  optionsOrSampled: GenerateTraceparentOptions | boolean = true
): string {
  const sampled =
    typeof optionsOrSampled === "boolean"
      ? optionsOrSampled
      : (optionsOrSampled.sampled ?? true);
  let traceId = randomHex(16);
  while (traceId === INVALID_TRACE_ID) traceId = randomHex(16);
  let parentId = randomHex(8);
  while (parentId === INVALID_PARENT_ID) parentId = randomHex(8);
  const flags = sampled ? "01" : "00";
  return `${TRACEPARENT_VERSION}-${traceId}-${parentId}-${flags}`;
}

/**
 * Parse a `traceparent` header value. Never throws — returns a discriminated
 * union so callers can log the failure reason without try/catch.
 *
 * Accepts version `00` strictly. Higher versions (`01`–`fe`) are tolerated
 * by some implementations per RFC §3.2.2.1 ("A vendor might receive a
 * traceparent with a higher version and choose to forward it"), but for
 * OmniRoute's own emitted headers we only ever produce `00`, so anything
 * higher is treated as "use the lower 32 bits of trace-id/parent-id and
 * the lowest 8 bits of flags" per the version-negotiation rule.
 *
 * We do NOT implement version negotiation here — we are strict on `00`.
 * For higher versions, return `wrong_version` so callers can decide.
 */
export function parseTraceparent(raw: string | null | undefined): TraceparentParseResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "missing", raw: String(raw) };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, error: "missing", raw };
  }

  // Reject any value containing whitespace, control chars, or non-ASCII.
  // W3C requires the value to be on a single line.
  if (!/^[!-~]+$/.test(trimmed)) {
    return { ok: false, error: "wrong_field_count", raw };
  }

  const parts = trimmed.split("-");
  if (parts.length !== 4) {
    return { ok: false, error: "wrong_field_count", raw };
  }

  const [version, traceId, parentId, flags] = parts as [string, string, string, string];

  if (version !== TRACEPARENT_VERSION) {
    return { ok: false, error: "wrong_version", raw };
  }
  if (!/^[0-9a-f]{32}$/.test(traceId)) {
    return { ok: false, error: "bad_trace_id", raw };
  }
  if (traceId === INVALID_TRACE_ID) {
    return { ok: false, error: "reserved_trace_id", raw };
  }
  if (!/^[0-9a-f]{16}$/.test(parentId)) {
    return { ok: false, error: "bad_parent_id", raw };
  }
  if (parentId === INVALID_PARENT_ID) {
    return { ok: false, error: "reserved_parent_id", raw };
  }
  if (!/^[0-9a-f]{2}$/.test(flags)) {
    return { ok: false, error: "bad_flags", raw };
  }

  return {
    ok: true,
    traceparent: { version, traceId, parentId, flags },
  };
}

/**
 * Parse a `tracestate` header value (RFC §3.3). Returns an empty array
 * when missing or unparseable — never throws.
 *
 * Validation is intentionally lax: we split on `,`, then on the first
 * `=` in each entry. We do NOT enforce the full key/value charset rules
 * because the field is free-form vendor data that we pass through
 * untouched. Callers that need stricter validation can post-process
 * the entries.
 */
export function parseTracestate(raw: string | null | undefined): TracestateEntry[] {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  const entries: TracestateEntry[] = [];
  for (const part of trimmed.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key || !value) continue;
    entries.push({ key, value });
  }
  return entries;
}

/**
 * Build a `traceparent` header value from an explicit Traceparent.
 * Useful for constructing a child traceparent (overwrite parentId with
 * a fresh value, keep traceId) or for log redaction tests.
 */
export function formatTraceparent(tp: Traceparent): string {
  return `${tp.version}-${tp.traceId}-${tp.parentId}-${tp.flags}`;
}

/**
 * Build a `traceparent` for a child span given a parent traceparent and
 * a fresh parent-id. The trace-id and flags are preserved. This is what
 * bifrostSpan.ts uses to set the `traceparent` header on the
 * cross-tier request to Bifrost.
 *
 * The parent's parent-id becomes the trace-id's "parent segment" only
 * in the sense of being the previous hop; in traceparent syntax the
 * child's parent-id is whatever fresh id the child span picked.
 */
export function childTraceparent(parent: Traceparent, childParentId: string): string {
  if (childParentId === INVALID_PARENT_ID) {
    // Re-roll until we get a non-reserved id. Caller cannot easily do
    // this because they passed a fixed id (e.g. the active span's
    // parent-id) so we centralize the guarantee here.
    let next = randomHex(8);
    while (next === INVALID_PARENT_ID) next = randomHex(8);
    return formatTraceparent({
      version: parent.version,
      traceId: parent.traceId,
      parentId: next,
      flags: parent.flags,
    });
  }
  return formatTraceparent({
    version: parent.version,
    traceId: parent.traceId,
    parentId: childParentId,
    flags: parent.flags,
  });
}

/**
 * Build a `tracestate` header value from a list of pairs. Order is preserved.
 * Empty input → empty string. Single entry with empty value → `key=` (legal per RFC).
 */
export function formatTracestate(entries: TracestateEntry[]): string {
  if (entries.length === 0) return "";
  return entries.map((e) => `${e.key}=${e.value}`).join(",");
}

/**
 * Add `traceparent` (and optionally `tracestate`) to a headers map. If a
 * `traceparent` is already present, it is overwritten. If a tracestate is
 * already present, the new one is appended (comma-joined), unless
 * `replaceTracestate` is `true`. Useful for `bifrostSpan.ts` to inject
 * the active span's traceparent into the outbound request.
 *
 * The implementation walks the headers object once for case-insensitive
 * detection (HTTP headers are case-insensitive per RFC 7230 §3.2) but
 * writes back using the lowercase key for forward-compat with header
 * validators.
 */
export function injectTraceparent(
  headers: Record<string, string>,
  traceparent: string,
  tracestate?: string,
  options: { replaceTracestate?: boolean } = {}
): void {
  // Look for an existing traceparent / tracestate (case-insensitive).
  let foundTraceparent = false;
  let foundTracestate = false;
  for (const k of Object.keys(headers)) {
    const lower = k.toLowerCase();
    if (lower === "traceparent") foundTraceparent = true;
    if (lower === "tracestate") foundTracestate = true;
  }

  if (!foundTraceparent) {
    headers["traceparent"] = traceparent;
  } else {
    // Overwrite the existing entry (case-insensitive) with the new value.
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === "traceparent") {
        headers[k] = traceparent;
        break;
      }
    }
  }

  if (tracestate) {
    if (!foundTracestate) {
      headers["tracestate"] = tracestate;
    } else if (options.replaceTracestate) {
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "tracestate") {
          headers[k] = tracestate;
          break;
        }
      }
    } else {
      // Append the new tracestate to the existing one (RFC §3.3 — order matters).
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "tracestate") {
          const existing = headers[k] ?? "";
          headers[k] = existing ? `${existing},${tracestate}` : tracestate;
          break;
        }
      }
    }
  }
}

/**
 * Extract the `traceparent` and `tracestate` from a headers map, parsed.
 * Returns `null` for `traceparent` if absent or unparseable (use
 * `parseTraceparent()` directly if you need the failure reason).
 */
export function readTraceparentFromHeaders(headers: Record<string, string>): {
  traceparent: Traceparent | null;
  tracestate: TracestateEntry[];
} {
  let rawTp: string | null = null;
  let rawTs: string | null = null;
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (lower === "traceparent" && typeof v === "string") rawTp = v;
    if (lower === "tracestate" && typeof v === "string") rawTs = v;
  }
  const parsed = parseTraceparent(rawTp);
  return {
    traceparent: parsed.ok ? parsed.traceparent : null,
    tracestate: parseTracestate(rawTs),
  };
}
