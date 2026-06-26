/**
 * Cache key normalisation — PR-036 Multi-tier LRU Cache
 *
 * Generates deterministic, collision-resistant cache keys from request
 * parameters. The key incorporates:
 *   - Model name
 *   - Normalised message payload (canonical JSON)
 *   - Temperature + top_p (determinism gate)
 *   - Provider ID (isolates per-provider cache)
 *   - Tenant ID (prevents cross-tenant leakage)
 *
 * SHA-256 truncation gives us 128-bit collision resistance (1 in 2^128)
 * while keeping keys at a manageable length for SQLite indexing.
 *
 * @module lib/cache/normalise
 */

import crypto from "crypto";

export interface NormaliseParams {
  model: string;
  messages: unknown;
  temperature?: number;
  top_p?: number;
  provider?: string;
  tenant?: string;
}

/**
 * Deterministic canonical JSON serialisation.
 * Sorts keys so the same logical object always produces the same string.
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map((k) => `${canonicalJson(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${pairs.join(",")}}`;
  }
  return String(value);
}

/**
 * Generate a deterministic cache key from request parameters.
 *
 * Key format: `{provider}.{tenant}.{sha256[:32]}` — keeping provider/tenant
 * as plain-text prefixes allows prefix scans in SQLite and quick
 * per-provider/tenant invalidation without scanning every row.
 *
 * @returns 64-char hex string
 */
export function generateCacheKey(params: NormaliseParams): string {
  const body = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0,
    top_p: params.top_p ?? 1,
  };
  const canonical = canonicalJson(body);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  const prefix = [params.provider ?? "_", params.tenant ?? "_"].filter(Boolean).join(".");
  return `${prefix}.${hash}`;
}

/**
 * Fast prefix for SQLite index scans (first 16 chars = provider.tenant.sha_prefix).
 */
export function keyPrefix(key: string): string {
  return key.slice(0, key.indexOf(".", key.indexOf(".") + 1) + 17);
}

/**
 * Extract the raw SHA-256 portion from a cache key.
 */
export function keyHash(key: string): string {
  const dot = key.lastIndexOf(".");
  return dot === -1 ? key : key.slice(dot + 1);
}
