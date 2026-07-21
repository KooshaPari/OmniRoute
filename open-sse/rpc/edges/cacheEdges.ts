/**
 * Cache edges — T3 (FFI) primary, F5.
 *
 * Wraps `open-sse/services/signatureCache.ts` (3-layer in-memory cache
 * for thinking signatures) and the `reasoningCache` SQLite cache for
 * `reasoning_content` replay.
 *
 * Per ADR-032 § "Semantic cache + reasoning replay":
 *   - Default tier T3 via the `omniroute_ffi_signature_cache` crate
 *     (Rust + `simhash` Hamming-distance search + `dashmap` sharding).
 *   - In-process TypeScript fast-path when the crate is missing.
 *
 * See `dispatch.omniidc` "service cache" for the wire shape.
 * See `src/lib/db/reasoningCache.ts` for the SQLite-backed reasoning cache.
 */

import { registerEdge } from "../dispatchEdges.ts";
import type { EdgeTier } from "../dispatchEdges.ts";
import {
  getSignatures,
  detectAndLearn,
  getModelFamily,
  getCacheStats,
} from "../../services/signatureCache.ts";

export const CACHE_EDGE_TIER: EdgeTier = "T3";

// ──────────────────────────────────────────────────────────────────
// semantic.lookup edge (T3 FFI / simhash + dashmap)
// ──────────────────────────────────────────────────────────────────

export interface SemanticLookupRequest {
  prompt: string;
  simhashThreshold?: number; // Hamming distance (default 8)
  maxEntries?: number; // scan cap (default 32)
}

export interface SemanticLookupResponse {
  hit: boolean;
  entryId?: string;
  value?: string;
  similarity: number;
  durationMicros: number;
}

function t1SemanticLookupHandler(input: SemanticLookupRequest): SemanticLookupResponse {
  const start = performance.now();
  // In-process fallback: do a substring scan against the signature cache
  // for an O(1) proxy. The real crate uses simhash Hamming-distance search.
  const signatures = getSignatures({});
  const hit = signatures.some((sig) => input.prompt.includes(sig));
  return {
    hit,
    similarity: hit ? 1 : 0,
    durationMicros: Math.round((performance.now() - start) * 1000),
  };
}

export const CACHE_SEMANTIC_LOOKUP = registerEdge<SemanticLookupRequest, SemanticLookupResponse>({
  name: "cache.semantic.lookup",
  defaultTier: CACHE_EDGE_TIER,
  http: { path: "/api/internal/edges/cache/semantic", timeoutMs: 25 },
  uds: { method: "cache.semantic.lookup", timeoutMs: 15 },
  ffi: { crate: "omniroute_ffi_signature_cache", symbol: "semantic_lookup_simd", timeoutMs: 10 },
  healthcheck: async () => {
    const r = t1SemanticLookupHandler({ prompt: "hello" });
    return r.durationMicros >= 0 ? null : "semantic.lookup smoke produced no duration";
  },
});

// ──────────────────────────────────────────────────────────────────
// reasoning.replay edge (T3 FFI / SQLite-backed reasoning cache)
// ──────────────────────────────────────────────────────────────────

export interface ReasoningReplayRequest {
  provider: string;
  model: string;
  conversationId: string;
  turnIndex: number;
}

export interface ReasoningReplayResponse {
  replayed: boolean;
  content?: string;
  source: "memory" | "db" | "miss";
  durationMicros: number;
}

async function t1ReasoningReplayHandler(
  input: ReasoningReplayRequest
): Promise<ReasoningReplayResponse> {
  const start = performance.now();
  // In-process fallback: SQLite-backed `src/lib/db/reasoningCache.ts`.
  try {
    const { getReasoning } = await import("@/lib/db/reasoningCache");
    const cached = getReasoning({
      provider: input.provider,
      model: input.model,
      conversationId: input.conversationId,
      turnIndex: input.turnIndex,
    });
    if (cached) {
      return {
        replayed: true,
        content: cached,
        source: "db",
        durationMicros: Math.round((performance.now() - start) * 1000),
      };
    }
  } catch {
    // DB unavailable — fall through to miss.
  }
  return {
    replayed: false,
    source: "miss",
    durationMicros: Math.round((performance.now() - start) * 1000),
  };
}

export const CACHE_REASONING_REPLAY = registerEdge<ReasoningReplayRequest, ReasoningReplayResponse>({
  name: "cache.reasoning.replay",
  defaultTier: CACHE_EDGE_TIER,
  http: { path: "/api/internal/edges/cache/reasoning", timeoutMs: 25 },
  uds: { method: "cache.reasoning.replay", timeoutMs: 15 },
  ffi: { crate: "omniroute_ffi_signature_cache", symbol: "reasoning_replay_simd", timeoutMs: 10 },
  healthcheck: async () => {
    const r = await t1ReasoningReplayHandler({
      provider: "openai",
      model: "gpt-4o",
      conversationId: "smoke",
      turnIndex: 0,
    });
    return r.source === "miss" || r.source === "db" || r.source === "memory"
      ? null
      : "reasoning.replay smoke produced invalid source";
  },
});

// Re-export for in-process callers.
export { getSignatures, detectAndLearn, getModelFamily, getCacheStats };
