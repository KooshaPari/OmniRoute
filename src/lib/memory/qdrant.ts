/**
 * @deprecated Qdrant sidecar removed. Functions delegate to sqlite-vec.
 * Config types retained for settings UI backward compatibility.
 *
 * All runtime operations (search, upsert, delete, cleanup, health) now delegate
 * to the `VectorStore` interface from `./vectorStore.ts` backed by sqlite-vec.
 * Config normalization and quantization helpers remain for the Settings UI.
 */

import { getSettings } from "@/lib/db/settings";
import { getMemorySettings } from "./settings";
import { embed } from "./embedding";
import { getVectorStore } from "./vectorStore";

type JsonRecord = Record<string, unknown>;

// ──────────────── Config types (retained for Settings UI) ────────────────

/**
 * Vector quantization mode for the memory collection (F4.4 / Q1).
 * - `none`: float32 vectors (default, unchanged behavior).
 * - `int8`: scalar int8 quantization (~4× less vector RAM, rescore preserves quality).
 * - `binary`: binary quantization (up to ~32× less, lossier — opt-in for scale).
 */
export type QdrantQuantization = "none" | "int8" | "binary";

const QDRANT_QUANTIZATION_MODES: readonly QdrantQuantization[] = ["none", "int8", "binary"];

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

/**
 * Build the Qdrant `quantization_config` block for collection creation.
 * Returns `undefined` for `none` so the create body stays byte-identical to the
 * pre-quantization behavior (no silent change for existing deployments).
 * Reference: Qdrant scalar/binary quantization + rescore docs.
 */
export function buildQuantizationConfig(
  quantization: QdrantQuantization
): Record<string, unknown> | undefined {
  switch (quantization) {
    case "int8":
      return { scalar: { type: "int8", always_ram: true, quantile: 0.99 } };
    case "binary":
      return { binary: { always_ram: true } };
    case "none":
    default:
      return undefined;
  }
}

/**
 * Build the Qdrant search `params` block. When the collection is quantized we
 * request `rescore: true` so the original vectors refine the quantized shortlist
 * (preserves recall). Returns `undefined` for `none` (no `params` sent).
 */
export function searchQuantizationParams(
  quantization: QdrantQuantization
): Record<string, unknown> | undefined {
  if (quantization === "none") return undefined;
  return { quantization: { rescore: true } };
}

export function normalizeQdrantConfig(settings: Record<string, unknown>): QdrantConfig {
  // Env-var fallbacks (cluster profile: docker compose --profile memory).
  // Settings-table values take precedence when present, so users who configure
  // Qdrant via the Settings UI are not overridden by the container hostname.
  const envHost = typeof process.env.QDRANT_HOST === "string" ? process.env.QDRANT_HOST.trim() : "";
  const envPortRaw = process.env.QDRANT_PORT;
  const envPort =
    typeof envPortRaw === "string" && envPortRaw.trim().length > 0
      ? Math.round(Number(envPortRaw) || 6333)
      : undefined;
  const envApiKey =
    typeof process.env.QDRANT_API_KEY === "string" && process.env.QDRANT_API_KEY.trim().length > 0
      ? process.env.QDRANT_API_KEY.trim()
      : undefined;
  const envCollection =
    typeof process.env.QDRANT_COLLECTION === "string" && process.env.QDRANT_COLLECTION.trim().length > 0
      ? process.env.QDRANT_COLLECTION.trim()
      : undefined;

  const host =
    (typeof settings.qdrantHost === "string" ? settings.qdrantHost.trim() : "") || envHost || "";
  const portRaw = settings.qdrantPort;
  const port =
    typeof portRaw === "number" && Number.isFinite(portRaw)
      ? Math.round(portRaw)
      : typeof portRaw === "string"
        ? Math.round(Number(portRaw) || 6333)
        : envPort ?? 6333;
  const apiKey =
    (typeof settings.qdrantApiKey === "string" && settings.qdrantApiKey.trim().length > 0
      ? settings.qdrantApiKey.trim()
      : null) ?? envApiKey ?? null;
  const collection =
    (typeof settings.qdrantCollection === "string" && settings.qdrantCollection.trim().length > 0
      ? settings.qdrantCollection.trim()
      : null) ?? envCollection ?? "omniroute_memory";
  const embeddingModel =
    (typeof settings.qdrantEmbeddingModel === "string" &&
    settings.qdrantEmbeddingModel.trim().length > 0
      ? settings.qdrantEmbeddingModel.trim()
      : null) ??
    (typeof process.env.QDRANT_EMBEDDING_MODEL === "string" &&
    process.env.QDRANT_EMBEDDING_MODEL.trim().length > 0
      ? process.env.QDRANT_EMBEDDING_MODEL.trim()
      : null) ??
    "openai/text-embedding-3-small";
  const enabled = settings.qdrantEnabled === true;
  const quantizationRaw = settings.qdrantQuantization;
  const quantization: QdrantQuantization =
    typeof quantizationRaw === "string" &&
    (QDRANT_QUANTIZATION_MODES as readonly string[]).includes(quantizationRaw)
      ? (quantizationRaw as QdrantQuantization)
      : "none";

  const vectorSizeRaw =
    typeof settings.qdrantVectorSize === "number"
      ? settings.qdrantVectorSize
      : typeof settings.qdrantVectorSize === "string"
        ? Number(settings.qdrantVectorSize)
        : Number(process.env.QDRANT_VECTOR_SIZE) || 1536;
  const vectorSize = Number.isFinite(vectorSizeRaw) && vectorSizeRaw > 0 ? vectorSizeRaw : 1536;

  const hnswEfRaw =
    typeof settings.qdrantHnswEfConstruct === "number"
      ? settings.qdrantHnswEfConstruct
      : typeof settings.qdrantHnswEfConstruct === "string"
        ? Number(settings.qdrantHnswEfConstruct)
        : Number(process.env.QDRANT_HNSW_EF_CONSTRUCT) || 128;
  const hnswEfConstruct = Number.isFinite(hnswEfRaw) && hnswEfRaw > 0 ? hnswEfRaw : 128;

  return {
    enabled,
    host,
    port,
    apiKey,
    collection,
    embeddingModel,
    quantization,
    vectorSize,
    hnswEfConstruct,
  };
}

export async function getQdrantConfig(): Promise<QdrantConfig> {
  const settings = (await getSettings()) as Record<string, unknown>;
  return normalizeQdrantConfig(settings);
}

// ──────────────── Embedding helper ────────────────

async function embedText(text: string): Promise<Float32Array> {
  const settings = await getMemorySettings();
  const result = await embed(text, settings);
  if (!("vector" in result)) {
    const reason = "reason" in result ? result.reason : "unknown";
    const message = "message" in result ? result.message : "embedding failed";
    throw new Error(`Embedding failed (${reason}): ${message}`);
  }
  return result.vector;
}

// ──────────────── Runtime operations (delegated to sqlite-vec VectorStore) ────────────────

export async function checkQdrantHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const vec = getVectorStore();
    if (!vec) {
      return { ok: false, latencyMs: Date.now() - start, error: "sqlite-vec not available" };
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
    const vec = getVectorStore();
    if (!vec) return { ok: false, latencyMs: 0, error: "not_configured" };

    const vector = await embedText(`${input.key}\n\n${input.content}`);
    await vec.upsertVector(input.id, vector);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function searchSemanticMemory(
  query: string,
  topK = 5,
  scope?: { apiKeyId?: string; sessionId?: string | null }
): Promise<{
  ok: boolean;
  latencyMs: number;
  results?: Array<{ id: string; score: number; payload?: JsonRecord }>;
  error?: string;
}> {
  const start = Date.now();
  try {
    const vec = getVectorStore();
    if (!vec) return { ok: false, latencyMs: 0, error: "not_configured" };

    const vector = await embedText(query);
    const hits = await vec.searchVector(vector, Math.max(1, Math.min(20, topK)), scope?.apiKeyId);
    return {
      ok: true,
      latencyMs: Date.now() - start,
      results: hits.map((h) => ({ id: h.memoryId, score: h.score })),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function deleteSemanticMemoryPoint(
  id: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const vec = getVectorStore();
    if (!vec) return { ok: false, latencyMs: 0, error: "not_configured" };

    await vec.deleteVector(id);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Cleanup is a no-op when backed by sqlite-vec: expired memories are already
 * filtered at query time via the SQL `expires_at` predicate in the `memories`
 * table, and vec_memories rows are removed by `deleteVector` when their parent
 * memory is deleted. Returns success with `deletedCount: 0` so callers see
 * a clean response without needing to handle the difference.
 */
export async function cleanupSemanticMemoryPoints(_input: {
  retentionDays: number;
}): Promise<{ ok: boolean; deletedCount: number; latencyMs: number; error?: string }> {
  return { ok: true, deletedCount: 0, latencyMs: 0 };
}
