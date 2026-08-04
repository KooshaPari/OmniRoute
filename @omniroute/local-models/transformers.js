/**
 * Runtime boundary for local embeddings.
 *
 * OmniRoute imports this module only when a caller enables local Transformers
 * embeddings. Keeping the heavy dependency here lets the base package remain
 * free of the local-model dependency closure.
 */
export async function loadTransformers() {
  return import("@huggingface/transformers");
}
