import { NextResponse } from "next/server";
import { getQuotaState, getDefaultQuota, getQueueSize } from "@/lib/quota";
import { loadConfig } from "@/lib/config";
import { getAllHealth } from "@/lib/adapters";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *   - default: local quota state (fast, in-memory)
 *   - ?probe=1: also hits each adapter's real API to confirm reachability and fetch live quota
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") === "1";
  const config = loadConfig();
  const org = process.env.GITHUB_ORG || "default-org";

  const quotas = await Promise.all(
    config.reviewers.map(async (r) => ({
      tool: r.name,
      enabled: r.enabled,
      weight: r.weight,
      quota: await getQuotaState(r.name, getDefaultQuota(r.name), org),
      queue_size: await getQueueSize(r.name),
    })),
  );

  const response: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    tools: quotas,
    config: {
      primary_surface: config.presentation.primary_surface,
      incremental_enabled: config.incremental.enabled,
    },
  };

  if (probe) {
    // Live API probes — may be slow if upstream is down
    try {
      const live = await getAllHealth();
      response.live_health = live;
    } catch (err) {
      response.live_health_error = String(err);
    }
  }

  return NextResponse.json(response);
}
