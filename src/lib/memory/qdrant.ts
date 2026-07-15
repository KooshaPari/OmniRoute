/**
 * Qdrant → sqlite-vec adapter (migration 2026-07).
 *
 * This file previously proxied calls to a Qdrant sidecar HTTP API. Since Qdrant
 * has been removed from the stack, all 6 public exports now delegate to the
 * sqlite-vec backend (src/lib/memory/vectorStore.ts) instead.
 *
 * All function signatures are preserved so consumers (store.ts, retrieval.ts,
 * routes, tests) work unchanged.
 */

import { getSettings } from "@/lib/db/settings";
import { resolveEmbeddingSource, embed } from "./embedding";
import { getVectorStore, type VectorSearchHit } from "./vectorStore";
import { getMemorySettings } from "./settings";

type JsonRecord = Record<string, unknown>;

// ──────────────── Types (preserved for API compatibility) ────────────────

export type QdrantQuantization = "none";

export type QdrantConfig = {
  enabled: boolean;
  host: string;
  port: number;
  apiKey: string | null;
  collection: string;
  embeddingModel: string;
  quantization: QdrantQuantization;
  vectorSize: number;
  hnswEfConstruct: number;
};

// ──────────────── Public exports ────────────────

/**
 * No-op — quantization is handled natively by sqlite-vec (int8 via env flag).
 * Preserved for API compatibility.
 */
export function buildQuantizationConfig(
  _quantization: QdrantQuantization,
): Record<string, unknown> | undefined {
  return undefined;
}

/**
 * No-op — quantization rescore is handled natively by sqlite-vec.
 * Preserved for API compatibility.
 */
export function searchQuantizationParams(
  _quantization: QdrantQuantization,
): Record<string, unknown> | undefined {
  return undefined;
}

/**
 * Return a minimal QdrantConfig from settings.
 * The Qdrant-specific fields are unused (sqlite-vec ignores them) but
 * preserved so consumers that read cfg.enabled / cfg.host etc. don't break.
 */
export function normalizeQdrantConfig(settings: Record<string, unknown>): QdrantConfig {
  return {
    enabled: true, // sqlite-vec is always "enabled" when the module loads
    host: "",
    port: 0,
    apiKey: null,
    collection: "",
    embeddingModel:
      (typeof settings.memoryEmbeddingProviderModel === "string" &&
      settings.memoryEmbeddingProviderModel.trim().length > 0
        ? settings.memoryEmbeddingProviderModel.trim()
        : null) ?? "sqlite-vec",
    quantization: "none",
    vectorSize: 0,
    hnswEfConstruct: 0,
  };
}

/** Return the current "Qdrant" config (now just sqlite-vec settings). */
export async function getQdrantConfig(): Promise<QdrantConfig> {
  const settings = (await getSettings()) as Record<string, unknown>;
  return normalizeQdrantConfig(settings);
}

/**
 * sqlite-vec is always healthy when the process is running.
 * Always returns healthy=true with 0ms latency.
 */
export async function checkQdrantHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  return { ok: true, latencyMs: 0 };
}

/**
 * Search semantic memory via sqlite-vec.
 */
export async function searchSemanticMemory(
  query: string,
  topK = 5,
  scope?: { apiKeyId?: string; sessionId?: string | null },
): Promise<{
  ok: boolean;
  latencyMs: number;
  results?: Array<{ id: string; score: number; payload?: JsonRecord }>;
  error?: string;
}> {
  const start = Date.now();
  try {
    const settings = await getMemorySettings();
    const resolution = resolveEmbeddingSource(settings);
    if (!resolution.source) {
      return { ok: false, latencyMs: Date.now() - start, error: "no_embedding_source" };
    }

    const embeddingResult = await embed(query, settings);
    if (!("vector" in embeddingResult)) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: embeddingResult.message ?? "embedding_failed",
      };
    }

    const vec = getVectorStore();
    if (!vec) {
      return { ok: false, latencyMs: Date.now() - start, error: "vector_store_unavailable" };
    }

    await vec.ensureReady(resolution);
    const hits = await vec.searchVector(embeddingResult.vector, topK, scope?.apiKeyId);

    return {
      ok: true,
      latencyMs: Date.now() - start,
      results: hits.map((h: VectorSearchHit) => ({
        id: h.memoryId,
        score: h.score,
      })),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Upsert a semantic memory point into sqlite-vec.
 */
export async function upsertSemanticMemoryPoint(input: {
  id: string;
  apiKeyId: string;
  sessionId: string;
  key: string;
  content: string;
  metadata: JsonRecord;
  createdAt: string;
  expiresAt: string | null;
}): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const settings = await getMemorySettings();
    const resolution = resolveEmbeddingSource(settings);
    if (!resolution.source) {
      return { ok: false, latencyMs: Date.now() - start, error: "no_embedding_source" };
    }

    const embeddingText = `${input.key}\n\n${input.content}`;
    const embeddingResult = await embed(embeddingText, settings);
    if (!("vector" in embeddingResult)) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: embeddingResult.message ?? "embedding_failed",
      };
    }

    const vec = getVectorStore();
    if (!vec) {
      return { ok: false, latencyMs: Date.now() - start, error: "vector_store_unavailable" };
    }

    await vec.ensureReady(resolution);
    await vec.upsertVector(input.id, embeddingResult.vector);

    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Delete a semantic memory point from sqlite-vec.
 */
export async function deleteSemanticMemoryPoint(
  id: string,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const vec = getVectorStore();
    if (!vec) {
      return { ok: false, latencyMs: Date.now() - start, error: "vector_store_unavailable" };
    }

    await vec.deleteVector(id);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ──────────────── cleanupSemanticMemoryPoints (removed) ────────────────

/**
 * @deprecated Point cleanup is now handled by the sqlite-vec reindex
 * mechanism. This function always returns 0 deleted.
 */
export async function cleanupSemanticMemoryPoints(_input: {
  retentionDays: number;
}): Promise<{ ok: boolean; deletedCount: number; latencyMs: number; error?: string }> {
  return { ok: true, deletedCount: 0, latencyMs: 0 };
}
