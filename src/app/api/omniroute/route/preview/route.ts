import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  extractProviderPreferences,
  filterCandidatesByPreferences,
  toOpenRouterProviderBody,
} from "@omniroute/open-sse/services/providerPreferences.ts";
import { rankCandidates } from "@/lib/routing/adaptiveRouting";

const candidateSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  capabilityScore: z.number().min(0).max(1),
  allocation: z.enum(["allow", "warn", "deny"]),
  healthScore: z.number().min(0).max(1),
  circuit: z.enum(["closed", "open", "half_open"]),
  quota: z.enum(["healthy", "approaching_limit", "exhausted", "unavailable", "unknown"]),
  latencyMs: z.number().nonnegative().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  modelPreference: z.number().min(0).max(1).optional(),
  costPreference: z.number().min(0).max(1).optional(),
});

const providerSchema = z
  .object({
    order: z.array(z.string()).optional(),
    only: z.array(z.string()).optional(),
    ignore: z.array(z.string()).optional(),
    allow_fallbacks: z.boolean().optional(),
    data_collection: z.enum(["allow", "deny"]).optional(),
    quantizations: z.array(z.string()).optional(),
    sort: z.enum(["price", "throughput", "latency"]).optional(),
    max_price: z
      .object({
        prompt: z.number().nonnegative().optional(),
        completion: z.number().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough();

const requestSchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(100),
  provider: providerSchema.optional(),
});

/** Deterministic routing preview. It never calls an upstream provider. */
export async function POST(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const preferences = parsed.data.provider
    ? extractProviderPreferences({ provider: parsed.data.provider })
    : null;
  const candidates = preferences
    ? filterCandidatesByPreferences(
        parsed.data.candidates.map((candidate) => ({
          provider: candidate.providerId,
          model: candidate.modelId,
          candidate,
        })),
        preferences
      ).map((entry) => entry.candidate)
    : parsed.data.candidates;

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No candidates match the provider preferences" },
      { status: 400 }
    );
  }

  const result = rankCandidates({ candidates });
  return NextResponse.json({
    request: { candidateCount: parsed.data.candidates.length },
    filteredCandidateCount: candidates.length,
    ...(preferences ? { providerPreferences: toOpenRouterProviderBody(preferences) } : {}),
    ...result,
    selected: result.selected?.providerId ?? null,
    liveRequestExecuted: false,
  });
}
