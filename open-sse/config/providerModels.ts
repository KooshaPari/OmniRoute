import { generateModels, generateAliasMap, type RegistryModel } from "./providerRegistry.ts";

// Provider models - Generated from providerRegistry.js (single source of truth)
export const PROVIDER_MODELS = generateModels();

// Provider ID to alias mapping - Generated from providerRegistry.js
export const PROVIDER_ID_TO_ALIAS = generateAliasMap();

// Helper functions
export function getProviderModels(aliasOrId: string): RegistryModel[] {
  return PROVIDER_MODELS[aliasOrId] || [];
}

export function getDefaultModel(aliasOrId: string): string | null {
  const models = PROVIDER_MODELS[aliasOrId];
  return models?.[0]?.id || null;
}

export function getProviderModel(aliasOrId: string, modelId: string): RegistryModel | undefined {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return undefined;
  return models.find((model) => model.id === modelId);
}

export function isValidModel(
  aliasOrId: string,
  modelId: string,
  passthroughProviders = new Set<string>()
): boolean {
  if (passthroughProviders.has(aliasOrId)) return true;
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return false;
  return models.some((m) => m.id === modelId);
}

export function findModelName(aliasOrId: string, modelId: string): string {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return modelId;
  const found = models.find((m) => m.id === modelId);
  return found?.name || modelId;
}

export function getModelTargetFormat(aliasOrId: string, modelId: string): string | null {
  const models = PROVIDER_MODELS[aliasOrId];
  const found = models?.find((m) => m.id === modelId);
  if (found?.targetFormat) return found.targetFormat;
  // #5842: OpenAI "*-pro" reasoning models (o1-pro, gpt-5.x-pro) are only served by
  // the native /v1/responses endpoint — /v1/chat/completions 404s ("only supported
  // in v1/responses"). Curated catalog entries are tagged explicitly; this heuristic
  // covers dynamically-synced ids that post-date the catalog (same spirit as the gh
  // executor's /codex/i routing, 9router#102). Scoped to the openai alias so other
  // providers shipping *-pro ids keep their own endpoint semantics.
  if (aliasOrId === "openai" && /-pro$/i.test(modelId)) return "openai-responses";
  return null;
}

export function getModelStripTypes(aliasOrId: string, modelId: string): string[] {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return [];
  const found = models.find((m) => m.id === modelId);
  return Array.isArray(found?.strip) ? [...found.strip] : [];
}

export function getModelsByProviderId(providerId: string): RegistryModel[] {
  const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  return PROVIDER_MODELS[alias] || [];
}

export function supportsXHighEffort(aliasOrId: string, modelId: string): boolean {
  const alias = PROVIDER_ID_TO_ALIAS[aliasOrId] || aliasOrId;
  return getProviderModel(alias, modelId)?.supportsXHighEffort === true;
}
