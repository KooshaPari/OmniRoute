import { getLoggedOutputTokens } from "@/lib/usage/tokenAccounting.ts";
import { resolveCanonicalProviderModel } from "../../services/model.ts";
import { applyBifrostModelOverride, resolveBifrostProviderId } from "../../executors/bifrostProviderMap.ts";

export interface BifrostStreamOutcomeRecord {
  provider: string;
  model: string;
  status: number;
  latencyMs: number;
  ttftMs?: number;
  outputTokens?: number;
  generationDurationMs?: number;
}

export function resolveBifrostStreamRouteTarget(
  provider: string,
  model: string,
): { provider: string; model: string } {
  const canonical = resolveCanonicalProviderModel(provider, model);
  const canonicalProvider = canonical.provider || provider;
  const canonicalModel = canonical.model || model;
  return {
    provider: resolveBifrostProviderId(canonicalProvider) ?? canonicalProvider,
    model: applyBifrostModelOverride(canonicalProvider, canonicalModel),
  };
}

export function buildBifrostStreamOutcomePayload({
  shouldRecord,
  provider,
  model,
  status,
  startTime,
  ttft,
  streamUsage,
  now,
}: {
  shouldRecord: boolean;
  provider: string;
  model: string;
  status: number;
  startTime: number;
  ttft?: number | null;
  streamUsage?: unknown;
  now?: () => number;
}): BifrostStreamOutcomeRecord | null {
  if (!shouldRecord) return null;
  const normalizedStatus = Number.isFinite(status) ? Math.max(0, Math.floor(status)) : 200;
  const nowMs = now?.() ?? Date.now();
  const normalizedTtft =
    typeof ttft === "number" && Number.isFinite(ttft) && ttft > 0 ? Math.floor(ttft) : null;
  const usage = streamUsage && typeof streamUsage === "object" ? streamUsage : null;
  const outputTokens = usage ? getLoggedOutputTokens(usage) : undefined;
  const generationDurationMs =
    normalizedTtft === null ? undefined : Math.max(0, nowMs - startTime - normalizedTtft);
  return {
    provider,
    model,
    status: normalizedStatus,
    latencyMs: Math.max(0, nowMs - startTime),
    ttftMs: normalizedTtft ?? undefined,
    outputTokens,
    generationDurationMs,
  };
}
