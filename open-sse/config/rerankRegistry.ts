/**
 * Rerank Provider Registry
 *
 * Defines providers that support the /v1/rerank endpoint.
 * Follows the Cohere rerank API request/response format (industry standard).
 *
 * API keys are stored in the same provider credentials system,
 * keyed by provider ID (e.g. "cohere", "together").
 */

export const RERANK_PROVIDERS = {
  cohere: {
    id: "cohere",
    baseUrl: "https://api.cohere.com/v2/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [
      { id: "rerank-v3.5", name: "Rerank v3.5" },
      { id: "rerank-english-v3.0", name: "Rerank English v3.0" },
      { id: "rerank-multilingual-v3.0", name: "Rerank Multilingual v3.0" },
    ],
  },

  together: {
    id: "together",
    baseUrl: "https://api.together.xyz/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [{ id: "Salesforce/Llama-Rank-V2", name: "Llama Rank V2" }],
  },

  nvidia: {
    id: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1/ranking",
    authType: "apikey",
    authHeader: "bearer",
    format: "nvidia", // NVIDIA uses slightly different field names
    models: [{ id: "nvidia/nv-rerankqa-mistral-4b-v3", name: "NV RerankQA Mistral 4B v3" }],
  },

  fireworks: {
    id: "fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [{ id: "accounts/fireworks/models/nomic-rerank-v1", name: "Nomic Rerank v1" }],
  },

  "voyage-ai": {
    id: "voyage-ai",
    baseUrl: "https://api.voyageai.com/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [
      { id: "rerank-2.5", name: "Rerank 2.5" },
      { id: "rerank-2.5-lite", name: "Rerank 2.5 Lite" },
      { id: "rerank-2", name: "Rerank 2" },
      { id: "rerank-2-lite", name: "Rerank 2 Lite" },
      { id: "rerank-1", name: "Rerank 1" },
      { id: "rerank-lite-1", name: "Rerank Lite 1" },
    ],
  },

  "jina-ai": {
    id: "jina-ai",
    baseUrl: "https://api.jina.ai/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [
      { id: "jina-reranker-v3", name: "Jina Reranker v3" },
      { id: "jina-reranker-m0", name: "Jina Reranker m0" },
      {
        id: "jina-reranker-v2-base-multilingual",
        name: "Jina Reranker v2 Base Multilingual",
      },
      { id: "jina-colbert-v2", name: "Jina ColBERT v2" },
    ],
  },

  // SiliconFlow rerank is Cohere-compatible (POST /v1/rerank, {model,query,documents}). The
  // reranker models arrive in /v1/models via live model-sync; without this entry the rerank
  // router rejected them with "Invalid rerank model" (#5332). Model IDs keep their vendor slash
  // (e.g. "Qwen/Qwen3-Reranker-8B") — parseRerankModel splits on the FIRST slash, so it's safe.
  siliconflow: {
    id: "siliconflow",
    baseUrl: "https://api.siliconflow.com/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    models: [
      { id: "Qwen/Qwen3-Reranker-8B", name: "Qwen3 Reranker 8B" },
      { id: "Qwen/Qwen3-Reranker-4B", name: "Qwen3 Reranker 4B" },
      { id: "Qwen/Qwen3-Reranker-0.6B", name: "Qwen3 Reranker 0.6B" },
      { id: "BAAI/bge-reranker-v2-m3", name: "BGE Reranker v2 m3" },
    ],
  },

  // DeepInfra rerank is NOT Cohere-shaped: POST /v1/inference/<MODEL> with {queries:[q],documents}
  // returning {scores:[…]} (one score per document, positional). The `deepinfra` format adapter in
  // open-sse/handlers/rerank.ts builds the per-model URL and maps scores → Cohere results (#5332).
  deepinfra: {
    id: "deepinfra",
    baseUrl: "https://api.deepinfra.com/v1/inference",
    authType: "apikey",
    authHeader: "bearer",
    format: "deepinfra",
    models: [
      { id: "Qwen/Qwen3-Reranker-8B", name: "Qwen3 Reranker 8B" },
      { id: "Qwen/Qwen3-Reranker-4B", name: "Qwen3 Reranker 4B" },
      { id: "Qwen/Qwen3-Reranker-0.6B", name: "Qwen3 Reranker 0.6B" },
    ],
  },
};

/**
 * Get rerank provider config by ID
 */
export function getRerankProvider(providerId) {
  return RERANK_PROVIDERS[providerId] || null;
}

/**
 * Parse rerank model string (format: "provider/model" or just "model")
 * Returns { provider, model }
 */
export function parseRerankModel(modelStr) {
  if (!modelStr) return { provider: null, model: null };

  // Try each provider prefix
  for (const [providerId, config] of Object.entries(RERANK_PROVIDERS)) {
    if (modelStr.startsWith(providerId + "/")) {
      return { provider: providerId, model: modelStr.slice(providerId.length + 1) };
    }
  }

  // No provider prefix — search all providers for the model
  for (const [providerId, config] of Object.entries(RERANK_PROVIDERS)) {
    if (config.models.some((m) => m.id === modelStr)) {
      return { provider: providerId, model: modelStr };
    }
  }

  return { provider: null, model: modelStr };
}

/**
 * Get all rerank models as a flat list
 */
export function getAllRerankModels() {
  const models = [];
  for (const [providerId, config] of Object.entries(RERANK_PROVIDERS)) {
    for (const model of config.models) {
      models.push({
        id: `${providerId}/${model.id}`,
        name: model.name,
        provider: providerId,
      });
    }
  }
  return models;
}
