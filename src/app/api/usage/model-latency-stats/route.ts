import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getModelLatencyStats, type ModelLatencyStatsEntry } from "@/lib/usage/usageHistory";
import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";

const querySchema = z.object({
  windowHours: z.coerce
    .number()
    .positive()
    .max(24 * 30)
    .default(24),
  minSamples: z.coerce.number().int().positive().max(10_000).default(1),
  maxRows: z.coerce.number().int().positive().max(100_000).default(10_000),
  provider: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  connectionId: z.string().trim().min(1).max(200).optional(),
  keyByConnectionId: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
});

type ModelLatencyStatsOptions = Parameters<typeof getModelLatencyStats>[0];
type ModelLatencyStatsReader = (
  options: ModelLatencyStatsOptions
) => Promise<Record<string, ModelLatencyStatsEntry>>;

export function parseModelLatencyStatsQuery(url: string) {
  const { searchParams } = new URL(url);
  return querySchema.safeParse({
    windowHours: searchParams.get("windowHours") || undefined,
    minSamples: searchParams.get("minSamples") || undefined,
    maxRows: searchParams.get("maxRows") || undefined,
    provider: searchParams.get("provider") || undefined,
    model: searchParams.get("model") || undefined,
    connectionId: searchParams.get("connectionId") || undefined,
    keyByConnectionId: searchParams.get("keyByConnectionId") || undefined,
  });
}

export async function buildModelLatencyStatsResponse(
  query: z.infer<typeof querySchema>,
  readStats: ModelLatencyStatsReader = getModelLatencyStats
) {
  const { provider, model, ...options } = query;
  const stats = await readStats(options);
  const entries = Object.values(stats).filter((entry) => {
    if (provider && entry.provider !== provider) return false;
    if (model && entry.model !== model) return false;
    return true;
  });

  return {
    windowHours: options.windowHours,
    minSamples: options.minSamples,
    maxRows: options.maxRows,
    keyByConnectionId: options.keyByConnectionId,
    count: entries.length,
    entries,
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const parsed = parseModelLatencyStatsQuery(request.url);

    if (!parsed.success) {
      return NextResponse.json(
        buildErrorBody(400, parsed.error.issues[0]?.message ?? "Invalid query parameters"),
        { status: 400 }
      );
    }

    return NextResponse.json(await buildModelLatencyStatsResponse(parsed.data));
  } catch (error) {
    console.error("[API] GET /api/usage/model-latency-stats error:", error);
    return NextResponse.json(buildErrorBody(500, "Failed to load model latency stats"), {
      status: 500,
    });
  }
}
