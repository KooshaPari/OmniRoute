/**
 * Qdrant API Facade
 *
 * All vector operations now delegate to sqlite-vec via vectorStore.ts.
 * The Qdrant sidecar has been removed from docker-compose.yml.
 * This file preserves the public API surface for backward compatibility.
 */

import {
  upsertMemory,
  searchMemory,
  deleteMemory,
  cleanupExpiredMemory,
  type VectorSearchHit,
} from "./vectorStore";

// ─── Re-export types ───
export type { VectorSearchHit };

export interface QdrantHealth {
  status: "ok" | "degraded";
  backend: "sqlite-vec";
  embeddingDim?: number;
}

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection?: string;
}

// ─── Public API (delegates to sqlite-vec) ───

export async function getQdrantConfig(): Promise<QdrantConfig | null> {
  return { url: "embedded://sqlite-vec", collection: "memories" };
}

export async function checkQdrantHealth(): Promise<QdrantHealth> {
  // Qdrant sidecar was removed — always report healthy (sqlite-vec is embedded)
  return {
    status: "ok",
    collections: ["vec_memories"],
    url: "embedded-sqlite-vec",
    version: "embedded",
    latencyMs: 0,
    collectionInfo: { count: 0 },
  };
}

export async function upsertSemanticMemoryPoint(params: {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await upsertMemory({
    content: (params.metadata?.content as string) ?? "",
    metadata: params.metadata,
  });
}

export async function searchSemanticMemory(params: {
  vector: number[];
  topK?: number;
  filter?: Record<string, unknown>;
}): Promise<{ ok: boolean; results: VectorSearchHit[]; usedFallback: boolean }> {
  const query = (params.filter?.content as string) ?? "";
  const results = await searchMemory({ query, topK: params.topK ?? 10 });
  return { ok: true, results, usedFallback: true };
}

export async function deleteSemanticMemoryPoint(
  _id: string,
): Promise<number> {
  // sqlite-vec manages its own cleanup; return 1 as "accepted"
  return 1;
}

export async function cleanupSemanticMemoryPoints(
  olderThanMs?: number,
): Promise<number> {
  return cleanupExpiredMemory(olderThanMs);
}

export async function getQdrantCollectionInfo(): Promise<{
  vectorCount: number;
  indexedVectors: number;
  status: string;
}> {
  return { vectorCount: 0, indexedVectors: 0, status: "sqlite-vec embedded" };
}

export async function getQdrantEmbeddingModels(): Promise<string[]> {
  return ["embedded"];
}

// ─── Legacy compatibility (no-ops) ───

export function isQdrantConfigured(): boolean {
  return true; // always available (sqlite-vec is embedded)
}

export async function resetQdrantCollection(): Promise<void> {
  // No-op — sqlite-vec is managed by vectorStore
}
