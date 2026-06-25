/**
 * Prometheus-format metrics scrape endpoint for the compression subsystem.
 *
 * Exposes `metricsRegistry.render()` (from src/lib/observability/metrics)
 * filtered to compression-only metric families so operators can wire
 * just the compression scrape into a single Grafana panel without
 * pulling the whole process metric set.
 *
 * Mount path: `GET /api/compression/telemetry/metrics`
 * Response content type: `text/plain; version=0.0.4; charset=utf-8`
 * Auth: management-only (same gate as /api/compression/engines).
 *
 * Companion endpoint: `/api/compression/telemetry/recent` returns a
 * JSON snapshot of the most recent N compression runs for dashboards.
 */
import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { metricsRegistry } from "@/lib/observability/metrics";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";

/**
 * Subset of metric families we expose under the compression namespace.
 *
 * We deliberately do NOT expose every registered family — pulling the
 * whole registry here would leak request counts, quota, cache stats,
 * etc. that operators wire to OTHER dashboards. Keep this list narrow
 * and add to it as compression dashboards grow.
 */
const COMPRESSION_FAMILIES = new Set([
  "omniroute_compression_runs_total",
  "omniroute_compression_savings_ratio",
  "omniroute_compression_duration_ms",
  "omniroute_compression_original_tokens_total",
  "omniroute_compression_compressed_tokens_total",
  "omniroute_compression_fallback_total",
]);

export async function GET(req: Request) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;
  try {
    const fullRender = metricsRegistry.render();
    // Filter to compression-only metric families. The prom exposition
    // format is line-oriented: each `# HELP` / `# TYPE` header is
    // followed by one or more sample lines until the next header.
    const lines = fullRender.split("\n");
    const kept: string[] = [];
    let currentFamily: string | null = null;
    for (const line of lines) {
      if (line.startsWith("# HELP ")) {
        const family = line.split(" ")[2] ?? "";
        if (COMPRESSION_FAMILIES.has(family)) {
          kept.push(line);
          currentFamily = family;
        } else {
          currentFamily = null;
        }
      } else if (line.startsWith("# TYPE ")) {
        if (currentFamily) kept.push(line);
      } else if (line === "") {
        if (currentFamily) kept.push(line);
      } else if (currentFamily) {
        kept.push(line);
      }
    }
    const body = kept.join("\n");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      buildErrorBody(500, "Failed to render compression metrics", {
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500 }
    );
  }
}
