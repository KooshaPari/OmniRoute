/**
 * Normalised Cache Key Derivation — PR-037
 *
 * Generates a deterministic, stable cache key from a chat-completion
 * request. The key incorporates:
 *
 *   - model         (canonical model ID)
 *   - messages      (normalised: sorted keys, stripped volatility)
 *   - temperature   (capped to 2 decimal places for determinism)
 *   - top_p         (capped to 2 decimal places)
 *   - max_tokens    (when present)
 *   - stop          (sorted array when present)
 *   - presence_penalty / frequency_penalty (capped)
 *   - tenant_id     (isolates keys across tenants)
 *   - api_key_id    (isolates keys across API keys)
 *
 * The result is a hex-encoded SHA-256 digest.  Any key material
 * (apiKeyId, tenantId) is prepended as a plain-text prefix so that
 * the cache namespace is visible without re-hashing — but the hash
 * itself operates only on semantically meaningful request content.
 *
 * @module lib/cache/normalise
 */

import crypto from "node:crypto";

// ── Helpers ───────────────────────────────────────────────────

function cap2(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  return undefined;
}

function normaliseMessages(msgs: unknown): unknown[] {
  if (!Array.isArray(msgs)) return [];
  return msgs.map((m: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    // Only keep fields that affect model output
    if (typeof m.role === "string") out.role = m.role;
    if (m.content !== undefined) out.content = m.content;
    if (Array.isArray(m.tool_calls)) out.tool_calls = m.tool_calls;
    if (m.name !== undefined) out.name = m.name;
    if (m.function_call !== undefined) out.function_call = m.function_call;
    if (m.prefix !== undefined) out.prefix = m.prefix;
    // Strip ephemeral / runtime-only fields
    return out;
  });
}

function normaliseTools(tools: unknown): unknown {
  if (!Array.isArray(tools)) return tools;
  return tools.map((t: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    // Keep type + function shape that defines the tool
    if (typeof t.type === "string") out.type = t.type;
    if (t.function !== undefined) {
      // Normalise the function descriptor — keep only canonical fields
      const fn = t.function as Record<string, unknown>;
      const fnOut: Record<string, unknown> = {};
      if (typeof fn.name === "string") fnOut.name = fn.name;
      if (fn.parameters !== undefined) fnOut.parameters = fn.parameters;
      // Intentionally omit description — advisory only, doesn't change model output
      // for a cached response
      out.function = fnOut;
    }
    return out;
  });
}

function normaliseStop(stop: unknown): unknown {
  if (Array.isArray(stop)) return [...stop].sort();
  return stop;
}

/**
 * Recursively stringify a value with deterministically sorted object keys.
 * Preserves all values (unlike JSON.stringify(obj, arrayReplacer) which acts
 * as a property allowlist at every nesting level).
 */
function stableStringify(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map(stableStringify).join(",")}]`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val as Record<string, unknown>).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((val as Record<string, unknown>)[k])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(val);
}

// ── Public API ────────────────────────────────────────────────

export interface CacheKeyParams {
  model: string;
  messages: unknown;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: unknown;
  presence_penalty?: number;
  frequency_penalty?: number;
  tools?: unknown;
  tool_choice?: unknown;
  response_format?: unknown;
  seed?: number;
  /** Per-key isolation prefix (internal key ID, not credential) */
  apiKeyId?: string;
  /** Per-tenant isolation prefix */
  tenantId?: string;
  /** Additional user-supplied dimension (e.g. deployment slot) */
  namespace?: string;
}

/**
 * Derive a deterministic, normalised cache key from a chat-completion
 * request.  Returns `null` when the request lacks the mandatory `model`
 * or `messages` fields.
 */
export function deriveCacheKey(params: CacheKeyParams): string | null {
  const { model, apiKeyId, tenantId, namespace } = params;

  if (!model || typeof model !== "string") return null;
  if (params.messages === undefined || params.messages === null) return null;

  const normalised: Record<string, unknown> = {
    model: model.trim(),
    messages: normaliseMessages(params.messages),
  };

  // Deterministic numeric params — cap to 2dp
  const t = cap2(params.temperature);
  if (t !== undefined) normalised.temperature = t;
  const tp = cap2(params.top_p);
  if (tp !== undefined) normalised.top_p = tp;
  if (params.max_tokens !== undefined) normalised.max_tokens = params.max_tokens;
  const stop = normaliseStop(params.stop);
  if (stop !== undefined) normalised.stop = stop;
  const pp = cap2(params.presence_penalty);
  if (pp !== undefined) normalised.presence_penalty = pp;
  const fp = cap2(params.frequency_penalty);
  if (fp !== undefined) normalised.frequency_penalty = fp;

  if (params.tools !== undefined) normalised.tools = normaliseTools(params.tools);
  if (params.tool_choice !== undefined) normalised.tool_choice = params.tool_choice;
  if (params.response_format !== undefined) normalised.response_format = params.response_format;
  if (params.seed !== undefined) normalised.seed = params.seed;

  // Canonical JSON — stable stringification (sort keys at every level,
  // preserve all values — do NOT use an array replacer which would act as
  // a property allowlist and strip nested fields)
  const payload = stableStringify(normalised);
  const digest = crypto.createHash("sha256").update(payload).digest("hex");

  // Prepend isolation prefixes
  const prefix = [tenantId, apiKeyId, namespace].filter(Boolean).join(":");
  return prefix ? `${prefix}:${digest}` : digest;
}

/**
 * Extract the isolation prefix from a cache key produced by
 * `deriveCacheKey`.  Returns the portion before the first colon
 * that corresponds to tenant / api-key isolation, or an empty
 * string for un-keyed keys.
 */
export function parseCacheKeyPrefix(key: string): string {
  const idx = key.indexOf(":");
  return idx === -1 ? "" : key.slice(0, idx);
}

/**
 * Deterministic hash of a single prompt string — useful for
 * prefix-cache lookups where the full messages array is not needed.
 */
export function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 32);
}
