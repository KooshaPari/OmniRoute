/**
 * JSON snapshot of recent compression telemetry for dashboards.
 *
 * Returns the latest observed value per (mode, engine, combo_id)
 * tuple for the compression-specific metric families. The endpoint
 * is dashboard-friendly: small payload, predictable shape, and
 * tagged with `asOfMs` so the dashboard can compute "freshness".
 *
 * Mount path: `GET /api/compression/telemetry/recent`
 * Response: JSON `{ asOfMs, runs: [...], savings: [...], ... }`
 * Auth: management-only.
 */
import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { metricsRegistry } from "@/lib/observability/metrics";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";

interface SeriesSnapshot {
  labels: Record<string, string>;
  value: number;
}

function snapshotFamily(familyName: string): SeriesSnapshot[] {
  const family = metricsRegistry.getFamily(familyName);
  if (!family) return [];
  return family.series.map((s: SeriesSnapshot) => ({ labels: s.labels, value: s.value }));
}

export async function GET(req: Request) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;
  try {
    return NextResponse.json({
      asOfMs: Date.now(),
      runs: snapshotFamily("omniroute_compression_runs_total"),
      savings: snapshotFamily("omniroute_compression_savings_ratio"),
      duration: snapshotFamily("omniroute_compression_duration_ms"),
      originalTokens: snapshotFamily("omniroute_compression_original_tokens_total"),
      compressedTokens: snapshotFamily("omniroute_compression_compressed_tokens_total"),
      fallback: snapshotFamily("omniroute_compression_fallback_total"),
    });
  } catch (err) {
    return NextResponse.json(
      buildErrorBody(500, "Failed to snapshot compression telemetry", {
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500 }
    );
  }
}
