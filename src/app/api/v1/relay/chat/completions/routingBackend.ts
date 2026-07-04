import { getSupervisor } from "@/lib/services/registry";

export type RelayRoutingBackend = "ts" | "bifrost" | "auto";
export type RelayRoutingFallbackReason =
  | "bifrost"
  | "bifrost-cooldown"
  | "bifrost-error"
  | "bifrost-ineligible"
  | "bifrost-provider-unknown";

const VALID_BACKENDS = new Set<RelayRoutingBackend>(["ts", "bifrost", "auto"]);

export interface BifrostRoutingConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  streamingEnabled: boolean;
  enabled: boolean;
}

export interface SidecarEligibility {
  eligible: boolean;
  reasons: readonly string[];
}

export type ProviderSidecarLookup = (model: string | undefined) => SidecarEligibility | null;

export interface BifrostRoutingDecision {
  tryBifrost: boolean;
  fallbackReason?: RelayRoutingFallbackReason;
}

export function getBifrostRoutingConfig(
  env: NodeJS.ProcessEnv = process.env
): BifrostRoutingConfig | null {
  const baseUrl = env.BIFROST_BASE_URL?.replace(/\/$/, "");

  // §4b: if BIFROST_BASE_URL is unset, check if supervised instance is running
  let resolvedBaseUrl = baseUrl;
  if (!resolvedBaseUrl) {
    const sup = getSupervisor("bifrost");
    if (sup?.getStatus().state === "running") {
      resolvedBaseUrl = `http://127.0.0.1:${sup.getStatus().port}`;
    }
  }

  if (!resolvedBaseUrl) return null;

  const timeoutMs = Number.parseInt(env.BIFROST_TIMEOUT_MS || "", 10);

  return {
    baseUrl: resolvedBaseUrl,
    apiKey: env.BIFROST_API_KEY || env.OMNIROUTE_BIFROST_KEY || undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    streamingEnabled: env.BIFROST_STREAMING_ENABLED !== "0",
    enabled: env.BIFROST_ENABLED !== "0",
  };
}

export function resolveRelayRoutingBackend(
  env: NodeJS.ProcessEnv = process.env
): RelayRoutingBackend {
  const configured = env.OMNIROUTE_RELAY_BACKEND || env.RELAY_ROUTING_BACKEND;
  if (configured && VALID_BACKENDS.has(configured as RelayRoutingBackend)) {
    return configured as RelayRoutingBackend;
  }

  return getBifrostRoutingConfig(env)?.enabled ? "auto" : "ts";
}

export function shouldTryBifrost(
  backend: RelayRoutingBackend,
  config: BifrostRoutingConfig | null
): config is BifrostRoutingConfig {
  return Boolean(config?.enabled && backend !== "ts");
}

export function shouldTryBifrostForRequest(
  backend: RelayRoutingBackend,
  config: BifrostRoutingConfig | null,
  body: unknown,
  lookupProviderSidecar: ProviderSidecarLookup
): BifrostRoutingDecision {
  if (!shouldTryBifrost(backend, config)) {
    return { tryBifrost: false };
  }
  if (backend === "bifrost") {
    return { tryBifrost: true };
  }

  const model =
    typeof (body as { model?: unknown } | null)?.model === "string"
      ? (body as { model: string }).model
      : undefined;
  const provider = lookupProviderSidecar(model);
  if (provider?.eligible) {
    return { tryBifrost: true };
  }

  return {
    tryBifrost: false,
    fallbackReason: provider ? "bifrost-ineligible" : "bifrost-provider-unknown",
  };
}

export function getRoutingBackendHeader(backend: Exclude<RelayRoutingBackend, "auto">): string {
  return backend;
}

export function getRoutingFallbackHeader(
  backend: RelayRoutingBackend,
  config: BifrostRoutingConfig | null
): RelayRoutingFallbackReason | undefined {
  return backend === "auto" && config?.enabled ? "bifrost" : undefined;
}

export function getRoutingFallbackReasonHeader(
  reason: RelayRoutingFallbackReason | null,
  backend: RelayRoutingBackend,
  config: BifrostRoutingConfig | null
): RelayRoutingFallbackReason | undefined {
  const fallbackBackend = getRoutingFallbackHeader(backend, config);
  if (!fallbackBackend) return undefined;
  return reason ?? fallbackBackend;
}
