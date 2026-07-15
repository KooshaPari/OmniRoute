export type EmbeddingSource = "remote" | "static" | "transformers" | "auto";

export interface EmbeddingProviderListing {
  provider: string; // e.g. "openai"
  hasKey: boolean;
  models: Array<{
    id: string; // format `provider/model`, e.g. "openai/text-embedding-3-small"
    name: string;
    dimensions: number | null;
  }>;
}

export interface EmbeddingResolution {
  /** Active source after resolveEmbeddingSource(settings). null = none available → falls back to FTS5. */
  source: "remote" | "static" | "transformers" | null;
  /** Active model (format provider/model for remote, "potion-base-8M" for static, "Xenova/all-MiniLM-L6-v2" for transformers). */
  model: string | null;
  /** Dimension of the produced vector. null before the 1st call (lazy probe). */
  dimensions: number | null;
  /** Unique signature used as vectorStore key to detect model swap. */
  signature: string; // ${source}:${model}:${dim}
  /** Reason for the choice (UI displays in Engine status). */
  reason: string; // e.g. "provider openai with key configured"
}

export interface EmbeddingResult {
  vector: Float32Array;
  source: "remote" | "static" | "transformers";
  model: string;
  dimensions: number;
  latencyMs: number;
  cached: boolean;
}

export interface EmbeddingError {
  source: "remote" | "static" | "transformers";
  model: string | null;
  reason: "no_key" | "model_load_failed" | "request_failed" | "rate_limited" | "timeout" | "unknown";
  message: string; // ALWAYS via sanitizeErrorMessage()
}
