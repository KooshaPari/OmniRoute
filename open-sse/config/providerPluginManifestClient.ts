import type {
  ProviderPluginManifest,
  ProviderPluginManifestEntry,
} from "./providerPluginManifest.ts";
import {
  PROVIDER_PLUGIN_MANIFEST_ENV,
  PROVIDER_PLUGIN_MANIFEST_PATH,
  resolveProviderPluginManifestUrl as resolveProviderPluginManifestUrlFromOrigin,
} from "./providerPluginManifestUrl.ts";

export interface ProviderPluginManifestClientOptions {
  baseUrl?: string | null;
  manifestUrl?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal | null;
}

export { PROVIDER_PLUGIN_MANIFEST_ENV, PROVIDER_PLUGIN_MANIFEST_PATH };

export function resolveProviderPluginManifestUrl(
  options: Pick<ProviderPluginManifestClientOptions, "baseUrl" | "manifestUrl"> = {}
): string {
  const explicitUrl = options.manifestUrl?.trim();
  if (explicitUrl) return explicitUrl;

  const envUrl = process.env[PROVIDER_PLUGIN_MANIFEST_ENV]?.trim();
  if (envUrl) return envUrl;

  return resolveProviderPluginManifestUrlFromOrigin(options.baseUrl);
}

export async function fetchProviderPluginManifest(
  options: ProviderPluginManifestClientOptions = {}
): Promise<ProviderPluginManifest> {
  const fetcher = options.fetchImpl ?? fetch;
  const url = resolveProviderPluginManifestUrl(options);
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: options.signal ?? undefined,
  });

  if (!response.ok) {
    throw new Error(`Provider plugin manifest request failed: HTTP ${response.status}`);
  }

  const manifest = (await response.json()) as ProviderPluginManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.providers)) {
    throw new Error("Provider plugin manifest response is not schemaVersion 1");
  }

  return manifest;
}

export function getProviderPluginManifestEntryForModelFromManifest(
  manifest: ProviderPluginManifest,
  model: string | undefined
): ProviderPluginManifestEntry | null {
  if (!model) return null;

  const providerPrefix = model.includes("/") ? model.split("/", 1)[0] : "";
  if (providerPrefix) {
    const prefixed = manifest.providers.find(
      (provider) => provider.id === providerPrefix || provider.alias === providerPrefix
    );
    if (prefixed) return prefixed;
  }

  return (
    manifest.providers.find((provider) =>
      provider.models.some((candidate) => candidate.id === model)
    ) ?? null
  );
}

export async function fetchProviderPluginManifestEntryForModel(
  model: string | undefined,
  options: ProviderPluginManifestClientOptions = {}
): Promise<ProviderPluginManifestEntry | null> {
  const manifest = await fetchProviderPluginManifest(options);
  return getProviderPluginManifestEntryForModelFromManifest(manifest, model);
}
