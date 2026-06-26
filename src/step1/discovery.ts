// Step-1 PR1: discovery glue.
// Reads env / config to figure out which providers are "ready" (have a
// matching API key or credentials file) vs "needs-auth" vs "needs-config".
//
// Replaces the hand-rolled `src/lib/localDb.ts` provider table + the
// combo registry. One function returns the same ProviderReport shape that
// `src/lib/db/combos.ts` used to build.
import { getProvider } from "./catalog.js";
import type { ProviderId, ProviderReport, ProviderStatus } from "./types.js";

function envHas(name: string | undefined): boolean {
  if (!name) return false;
  // Multi-credential providers (e.g. AWS, Azure, Vertex) — check at least one
  if (name.includes(" + ")) {
    return name.split(" + ").every((n) => Boolean(process.env[n.trim()]));
  }
  return Boolean(process.env[name]);
}

export function probeProvider(id: ProviderId): ProviderReport {
  const desc = getProvider(id);
  if (!desc) {
    return {
      descriptor: {
        id,
        kind: "api-key",
        label: id,
        baseUrl: null,
        modelsEndpoint: null,
        supportsStreaming: false,
        supportsToolUse: false,
        notes: undefined,
      },
      status: "unsupported",
      authSource: "missing",
      lastChecked: Date.now(),
    };
  }
  const hasEnv = envHas(desc.notes);
  const status: ProviderStatus = hasEnv ? "ready" : "needs-auth";
  const authSource: ProviderReport["authSource"] = hasEnv
    ? "env"
    : desc.notes
      ? "missing"
      : "missing";
  return { descriptor: desc, status, authSource, lastChecked: Date.now() };
}

export function probeAllProviders(): readonly ProviderReport[] {
  return [
    "openai",
    "anthropic",
    "google",
    "mistral",
    "cohere",
    "groq",
    "openrouter",
    "together",
    "fireworks",
    "deepseek",
    "xai",
    "perplexity",
    "replicate",
    "bedrock",
    "azure",
    "vertex",
    "github-models",
    "huggingface",
    "anyscale",
    "deepinfra",
    "zai",
    "novita",
    "alibaba",
  ].map(probeProvider);
}
