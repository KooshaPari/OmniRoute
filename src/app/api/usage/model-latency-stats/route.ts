import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getModelLatencyStats } from "@/lib/usage/usageHistory";
import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";

const sortBySchema = z.enum(["balanced", "latency", "reliability", "throughput"]);
type SortBy = z.infer<typeof sortBySchema>;

type ModelLatencyEntry = Awaited<ReturnType<typeof getModelLatencyStats>>[string];

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
  sortBy: sortBySchema.default("balanced"),
});

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function descending(a: number, b: number): number {
  return b - a;
}

function ascending(a: number, b: number): number {
  return a - b;
}

function stableEntryCompare(a: ModelLatencyEntry, b: ModelLatencyEntry): number {
  const providerCompare = a.provider.localeCompare(b.provider);
  if (providerCompare !== 0) return providerCompare;
  return a.model.localeCompare(b.model);
}

function balancedScore(entry: ModelLatencyEntry): number {
  const successRate = finiteNumber(entry.successRate, 0);
  const p95LatencyMs = finiteNumber(entry.p95LatencyMs, Number.POSITIVE_INFINITY);
  const latencyStdDev = finiteNumber(entry.latencyStdDev, Number.POSITIVE_INFINITY);
  const throughput = finiteNumber(entry.avgTokensPerSecond, 0);
  const latencyScore = Number.isFinite(p95LatencyMs) && p95LatencyMs > 0 ? 1 / p95LatencyMs : 0;
  const stabilityScore = Number.isFinite(latencyStdDev) && latencyStdDev > 0 ? 1 / latencyStdDev : 0;

  return successRate * 0.5 + latencyScore * 250 * 0.3 + stabilityScore * 100 * 0.1 + throughput * 0.001;
}

function sortEntries(entries: ModelLatencyEntry[], sortBy: SortBy): ModelLatencyEntry[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    let comparison = 0;
    if (sortBy === "latency") {
      comparison = ascending(
        finiteNumber(a.p95LatencyMs, Number.POSITIVE_INFINITY),
        finiteNumber(b.p95LatencyMs, Number.POSITIVE_INFINITY)
      );
    } else if (sortBy === "reliability") {
      comparison = descending(finiteNumber(a.successRate, 0), finiteNumber(b.successRate, 0));
      if (comparison === 0) {
        comparison = ascending(
          finiteNumber(a.latencyStdDev, Number.POSITIVE_INFINITY),
          finiteNumber(b.latencyStdDev, Number.POSITIVE_INFINITY)
        );
      }
    } else if (sortBy === "throughput") {
      comparison = descending(
        finiteNumber(a.avgTokensPerSecond, 0),
        finiteNumber(b.avgTokensPerSecond, 0)
      );
    } else {
      comparison = descending(balancedScore(a), balancedScore(b));
    }

    return comparison || stableEntryCompare(a, b);
  });
  return sorted;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      windowHours: searchParams.get("windowHours") || undefined,
      minSamples: searchParams.get("minSamples") || undefined,
      maxRows: searchParams.get("maxRows") || undefined,
      provider: searchParams.get("provider") || undefined,
      model: searchParams.get("model") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        buildErrorBody(400, parsed.error.issues[0]?.message ?? "Invalid query parameters"),
        { status: 400 }
      );
    }

    const { provider, model, sortBy, ...options } = parsed.data;
    const stats = await getModelLatencyStats(options);
    const entries = sortEntries(
      Object.values(stats).filter((entry) => {
        if (provider && entry.provider !== provider) return false;
        if (model && entry.model !== model) return false;
        return true;
      }),
      sortBy
    );

    return NextResponse.json({
      windowHours: options.windowHours,
      minSamples: options.minSamples,
      maxRows: options.maxRows,
      sortBy,
      count: entries.length,
      entries,
    });
  } catch (error) {
    console.error("[API] GET /api/usage/model-latency-stats error:", error);
    return NextResponse.json(buildErrorBody(500, "Failed to load model latency stats"), {
      status: 500,
    });
  }
}
