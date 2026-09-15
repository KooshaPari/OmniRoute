/**
 * Specialty model catalog loops — embedding, image, rerank, audio, moderation,
 * video, and music models.
 *
 * Extracted from catalog.ts to reduce file size.
 */
import { aiHordeImageCatalog } from "@omniroute/open-sse/services/aihordeImageCatalog";
import { getAllEmbeddingModels } from "@omniroute/open-sse/config/embeddingRegistry";
import {
  getAllImageModels,
} from "@omniroute/open-sse/config/imageRegistry";
import { getAllRerankModels } from "@omniroute/open-sse/config/rerankRegistry";
import { getAllAudioModels } from "@omniroute/open-sse/config/audioRegistry";
import { getAllModerationModels } from "@omniroute/open-sse/config/moderationRegistry";
import { getAllVideoModels } from "@omniroute/open-sse/config/videoRegistry";
import { getAllMusicModels } from "@omniroute/open-sse/config/musicRegistry";

type SpecialtyModelContext = {
  models: Array<Record<string, unknown>>;
  timestamp: number;
  providerIdToAlias: Record<string, string>;
  blockedProviders: Set<string>;
  activeAliases: Set<string>;
  providerIdToPrefix: Record<string, string>;
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string;
  providerSupportsModel: (providerKey: string, modelId: string) => boolean;
  isModelHiddenBulk: (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality?: string
  ) => boolean;
  maybeYieldCatalogBuild: () => Promise<void>;
};

// -- Internal helpers --------------------------------------------------------

function isProviderActive(
  provider: string,
  activeAliases: Set<string>,
  blockedProviders: Set<string>,
  providerIdToAlias: Record<string, string>,
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string
): boolean {
  if (activeAliases.size === 0) return false;
  const alias = providerIdToAlias[provider] || provider;
  const canonicalProviderId = resolveCanonicalProviderId(alias, provider);

  if (
    blockedProviders.has(alias) ||
    blockedProviders.has(canonicalProviderId) ||
    blockedProviders.has(provider)
  ) {
    return false;
  }

  return activeAliases.has(alias) || activeAliases.has(provider);
}

function findEquivalentSpecialtyModel(
  models: Array<Record<string, unknown>>,
  providerId: string,
  rawModelId: string,
  type: string,
  scopedModelId: string
) {
  return models.find((model: any) => {
    if (model?.id === scopedModelId) return true;
    if (model?.owned_by !== providerId || model?.type !== type) return false;
    const existingRoot =
      typeof model?.root === "string"
        ? model.root
        : typeof model?.id === "string"
          ? model.id.split("/").pop()
          : null;
    return existingRoot === rawModelId;
  });
}

function hasEquivalentSpecialtyModel(
  models: Array<Record<string, unknown>>,
  providerId: string,
  rawModelId: string,
  type: string,
  scopedModelId: string
): boolean {
  return (
    findEquivalentSpecialtyModel(models, providerId, rawModelId, type, scopedModelId) !== undefined
  );
}

/**
 * Strip the provider prefix from a specialty model ID to get the
 * provider-relative path (e.g. "openrouter/google/chirp-3" -> "google/chirp-3").
 */
function getSpecialtyModelRelativeId(modelId: string, provider: string): string {
  return modelId.startsWith(`${provider}/`) ? modelId.slice(provider.length + 1) : modelId;
}

// -- Main entry point --------------------------------------------------------

/**
 * Add all specialty model types (embedding, image, rerank, audio, moderation,
 * video, music) to the models array.
 */
export async function addSpecialtyModels(ctx: SpecialtyModelContext): Promise<void> {
  const {
    models,
    timestamp,
    providerIdToAlias,
    blockedProviders,
    activeAliases,
    resolveCanonicalProviderId,
    providerSupportsModel,
    isModelHiddenBulk,
  } = ctx;

  const checkProviderActive = (provider: string) =>
    isProviderActive(
      provider,
      activeAliases,
      blockedProviders,
      providerIdToAlias,
      resolveCanonicalProviderId
    );

  // Add embedding models (filtered by active providers)
  for (const embModel of getAllEmbeddingModels()) {
    if (!checkProviderActive(embModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(embModel.id, embModel.provider);
    if (!providerSupportsModel(embModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(embModel.provider, rawModelId, null, "embeddings")) continue;
    const existingEmbedding = findEquivalentSpecialtyModel(
      models,
      embModel.provider,
      rawModelId,
      "embedding",
      embModel.id
    );
    if (existingEmbedding) {
      if (embModel.dimensions !== undefined) {
        existingEmbedding.dimensions = embModel.dimensions;
      }
      if (!existingEmbedding.type) {
        existingEmbedding.type = "embedding";
      }
      continue;
    }
    models.push({
      id: embModel.id,
      object: "model",
      created: timestamp,
      owned_by: embModel.provider,
      root: rawModelId,
      type: "embedding",
      dimensions: embModel.dimensions,
    });
  }

  // Add image models (filtered by active providers).
  // AI Horde image workers come and go — refresh the live detector first.
  if (isProviderActive("aihorde", activeAliases, blockedProviders, providerIdToAlias, resolveCanonicalProviderId)) {
    try {
      await aiHordeImageCatalog.ensureFresh();
    } catch {
      // Keep the last good snapshot (or none) if Horde is unreachable.
    }
  }
  for (const imgModel of getAllImageModels()) {
    if (!checkProviderActive(imgModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(imgModel.id, imgModel.provider);
    if (!providerSupportsModel(imgModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(imgModel.provider, rawModelId, null, "images")) continue;
    models.push({
      id: imgModel.id,
      object: "model",
      created: timestamp,
      owned_by: imgModel.provider,
      type: "image",
      supported_sizes: imgModel.supportedSizes,
      input_modalities: imgModel.inputModalities || ["text"],
      output_modalities: ["image"],
      ...(imgModel.description ? { description: imgModel.description } : {}),
      ...(imgModel.mediaCapabilities ? { media_capabilities: imgModel.mediaCapabilities } : {}),
    });
  }

  // Add rerank models (filtered by active providers)
  for (const rerankModel of getAllRerankModels()) {
    if (!checkProviderActive(rerankModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(rerankModel.id, rerankModel.provider);
    if (!providerSupportsModel(rerankModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(rerankModel.provider, rawModelId, null, "rerank")) continue;
    if (hasEquivalentSpecialtyModel(models, rerankModel.provider, rawModelId, "rerank", rerankModel.id)) {
      continue;
    }
    models.push({
      id: rerankModel.id,
      object: "model",
      created: timestamp,
      owned_by: rerankModel.provider,
      root: rawModelId,
      type: "rerank",
    });
  }

  // Add audio models (filtered by active providers)
  for (const audioModel of getAllAudioModels()) {
    if (!checkProviderActive(audioModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(audioModel.id, audioModel.provider);
    if (!providerSupportsModel(audioModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(audioModel.provider, rawModelId, null, "audio")) continue;
    models.push({
      id: audioModel.id,
      object: "model",
      created: timestamp,
      owned_by: audioModel.provider,
      type: "audio",
      subtype: audioModel.subtype,
    });
  }

  // Add moderation models (filtered by active providers)
  for (const modModel of getAllModerationModels()) {
    if (!checkProviderActive(modModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(modModel.id, modModel.provider);
    if (!providerSupportsModel(modModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(modModel.provider, rawModelId, null, "moderation")) continue;
    models.push({
      id: modModel.id,
      object: "model",
      created: timestamp,
      owned_by: modModel.provider,
      type: "moderation",
    });
  }

  // Add video models (filtered by active providers)
  for (const videoModel of getAllVideoModels()) {
    if (!checkProviderActive(videoModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(videoModel.id, videoModel.provider);
    if (!providerSupportsModel(videoModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(videoModel.provider, rawModelId, null, "videos")) continue;
    models.push({
      id: videoModel.id,
      object: "model",
      created: timestamp,
      owned_by: videoModel.provider,
      type: "video",
      supported_sizes: videoModel.supportedSizes,
      input_modalities: ["text"],
      output_modalities: ["video"],
      ...(videoModel.mediaCapabilities
        ? { media_capabilities: videoModel.mediaCapabilities }
        : {}),
    });
  }

  // Add music models (filtered by active providers)
  for (const musicModel of getAllMusicModels()) {
    if (!checkProviderActive(musicModel.provider)) continue;
    const rawModelId = getSpecialtyModelRelativeId(musicModel.id, musicModel.provider);
    if (!providerSupportsModel(musicModel.provider, rawModelId)) continue;
    if (isModelHiddenBulk(musicModel.provider, rawModelId, null, "music")) continue;
    models.push({
      id: musicModel.id,
      object: "model",
      created: timestamp,
      owned_by: musicModel.provider,
      type: "music",
    });
  }
}
