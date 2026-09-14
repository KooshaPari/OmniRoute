import { getSyncedAvailableModelsByConnection } from "@/lib/db/models";
import { isSelfHostedChatProvider, resolveProviderId } from "@/shared/constants/providers";

export type LocalSyncedEndpointRoute = {
  provider: string;
  model: string;
  connectionIds: string[];
};

export async function resolveLocalSyncedEndpointRoute(
  modelStr: string,
  endpoint: "embeddings" | "images"
): Promise<LocalSyncedEndpointRoute | null> {
  const slashIndex = modelStr.indexOf("/");
  if (slashIndex <= 0 || slashIndex === modelStr.length - 1) return null;

  const provider = resolveProviderId(modelStr.slice(0, slashIndex));
  const model = modelStr.slice(slashIndex + 1);
  if (!isSelfHostedChatProvider(provider)) return null;

  const byConnection = await getSyncedAvailableModelsByConnection(provider);
  const connectionIds = Object.entries(byConnection)
    .filter(([, models]) =>
      models.some(
        (candidate) => candidate.id === model && candidate.supportedEndpoints?.includes(endpoint)
      )
    )
    .map(([connectionId]) => connectionId);

  return connectionIds.length > 0 ? { provider, model, connectionIds } : null;
}
