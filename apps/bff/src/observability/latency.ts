import { z } from "zod";
import { NormalizedRouteTemplateSchema } from "./benchmark-contract";

export const LatencySampleV1Schema = z
  .object({
    schemaVersion: z.literal(1),
  route: NormalizedRouteTemplateSchema,
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    durationMs: z.number().finite().nonnegative(),
    status: z.number().int().min(100).max(599),
  })
  .strict();

export type LatencySampleV1 = z.infer<typeof LatencySampleV1Schema>;

export type LatencySummaryV1 = {
  schemaVersion: 1;
  sampleCount: number;
  errorCount: number;
  errorRate: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
};

function percentile(sorted: number[], quantile: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

export function summarizeLatencySamples(input: unknown[]): LatencySummaryV1 {
  const samples = input.flatMap((value) => {
    const parsed = LatencySampleV1Schema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const errorCount = samples.filter((sample) => sample.status >= 500).length;
  return {
    schemaVersion: 1,
    sampleCount: samples.length,
    errorCount,
    errorRate: samples.length === 0 ? null : errorCount / samples.length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
  };
}
