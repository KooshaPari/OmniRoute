/**
 * Qdrant → sqlite-vec Facade
 *
 * The Qdrant sidecar was removed from docker-compose (PR-O).
 * All functions below delegate to vectorStore.ts which uses sqlite-vec.
 *
 * Public API surface preserved for all consumers:
 *   - src/app/api/settings/qdrant/{search,cleanup,health}/route.ts
 *   - src/lib/memory/retrieval.ts
 *   - src/lib/memory/store.ts
 */
import {
  searchMemory,
  deleteMemory,
  upsertMemory,
  cleanupExpiredMemory,
  getVectorStore,
} from "./vectorStore";

// ─── Config ─────────────────────────────────────────────────────────────────

interface QdrantConfig {
  enabled: boolean;
  host: string;
  port: number;
  apiKey?: string;
}

// ─── Health ─────────────────────────────────────────────────────────────────

export interface QdrantHealth {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  version?: string;
  status?: string;
  pointCount?: number;
  collections?: Array<{
    name: string;
    vectorCount: number;
    distance: string;
  }>;
}

export async function getQdrantConfig(): Promise<QdrantConfig> {
  return { enabled: true, host: "sqlite-vec", port: 0 };
}

export async function checkQdrantHealth(): Promise<QdrantHealth> {
  const start = Date.now();
  try {
    await getVectorStore();
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      latencyMs,
      version: "sqlite-vec",
      status: "ok",
      pointCount: 0,
      collections: [{ name: "default", vectorCount: 0, distance: "cosine" }],
    };
  } catch (err: unknown) {
    return { ok: false, error: String(err) };
  }
}

// ─── Search ─────────────────────────────────────────────────────────────────

interface SearchResult {
  ok: boolean;
  results: Array<{ id: string; score: number }>;
  error?: string;
}

export async function searchSemanticMemory(
  query: string,
  limit: number,
  opts?: { apiKeyId?: string; sessionId?: string; collection?: string },
): Promise<SearchResult> {
  try {
    const res = await searchMemory({
      query,
      topK: limit,
      apiKeyId: opts?.apiKeyId,
      sessionId: opts?.sessionId,
    });
    if (!res.ok) {
      return { results: [], ok: false, error: res.error };
    }
    return {
      results: (res.results ?? []).map((r) => ({ id: r.id, score: r.score })),
      ok: true,
    };
  } catch (err: unknown) {
    return { results: [], ok: false, error: String(err) };
  }
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

export async function upsertSemanticMemoryPoint(point: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}): Promise<{ status: string }> {
  try {
    const res = await upsertMemory({
      id: point.id,
      apiKeyId: (point.payload.apiKeyId as string) ?? "",
      sessionId: (point.payload.sessionId as string) ?? "",
      content: (point.payload.content as string) ?? "",
      metadata: point.payload,
      kind: (point.payload.kind as string) ?? "memory",
      type: (point.payload.type as string) ?? "semantic",
      key: (point.payload.key as string) ?? "",
    });
    return { status: res.ok ? "ok" : "error" };
  } catch {
    return { status: "error" };
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteSemanticMemoryPoint(
  id: string,
): Promise<{ deleted: number }> {
  try {
    const res = await deleteMemory(id);
    return { deleted: res.ok ? 1 : 0 };
  } catch {
    return { deleted: 0 };
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

export async function cleanupSemanticMemoryPoints(
  olderThanDays: number,
): Promise<{ deleted: number }> {
  try {
    const res = await cleanupExpiredMemory(olderThanDays);
    return { deleted: res.deletedCount };
  } catch {
    return { deleted: 0 };
  }
}

// ─── Embedding Models ───────────────────────────────────────────────────────

export async function listEmbeddingModels(): Promise<
  Array<{ name: string; dimensions: number; provider: string }>
> {
  return [{ name: "default", dimensions: 1536, provider: "sqlite-vec" }];
}
