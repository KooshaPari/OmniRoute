/**
 * REST: /api/virtual-keys/[id]/cost
 *
 * GET → cost summary for a single virtual key. Shape matches the
 * dashboard's per-key cost chart binding (totalCostUsd + byDay + byProvider
 * + byModel). The `since` query param accepts ISO 8601; if omitted,
 * defaults to 30 days back.
 */
import { NextResponse } from "next/server";
import { summarizeCostForKey } from "@/lib/db/costTracking";
import { getVirtualKey } from "@/lib/db/virtualKeys";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import * as log from "@/sse/utils/logger";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const key = getVirtualKey(id);
    if (!key) {
      return NextResponse.json({ error: "Virtual key not found" }, { status: 404 });
    }
    const url = new URL(request.url);
    const since = url.searchParams.get("since") ?? undefined;
    const summary = summarizeCostForKey(id, since);
    return NextResponse.json({ keyId: id, tenantId: key.tenantId, ...summary });
  } catch (error) {
    log.error("virtual-keys", "Error fetching cost summary", error);
    return NextResponse.json({ error: "Failed to fetch cost summary" }, { status: 500 });
  }
}
