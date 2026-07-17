import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAllProjectedBifrostRouteMetrics } from "@omniroute/open-sse/observability/bifrostRouteMetrics";

export async function GET(req: Request) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  return NextResponse.json({ metrics: getAllProjectedBifrostRouteMetrics() });
}
