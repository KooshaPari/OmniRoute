import { NextResponse } from "next/server";
import { pingDb, runManagedDbHealthCheck } from "@/lib/db/core";
import { APP_CONFIG } from "@/shared/constants/config";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

type HealthCheck = {
  status: "ok" | "degraded" | "error";
  latencyMs?: number;
  detail?: unknown;
  error?: string;
};

function statusFromChecks(checks: Record<string, HealthCheck>): "ok" | "degraded" | "error" {
  const values = Object.values(checks).map((check) => check.status);
  if (values.includes("error")) return "error";
  if (values.includes("degraded")) return "degraded";
  return "ok";
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const startedAt = Date.now();
  const checks: Record<string, HealthCheck> = {};

  try {
    const pingStartedAt = Date.now();
    checks.ping = pingDb()
      ? { status: "ok", latencyMs: Date.now() - pingStartedAt }
      : { status: "error", error: "db_ping_failed" };
  } catch (error) {
    checks.ping = {
      status: "error",
      error: "db_ping_failed",
    };
  }

  try {
    checks.database = {
      status: "ok",
      detail: runManagedDbHealthCheck({ autoRepair: false }),
    };
  } catch (error) {
    checks.database = {
      status: "degraded",
      error: "db_health_check_failed",
    };
  }

  const status = statusFromChecks(checks);
  return NextResponse.json(
    {
      status,
      service: "omniroute-management",
      version: APP_CONFIG.version,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks,
      transports: {
        browser: ["REST", "SSE", "WebSocket"],
        localDaemon: ["UnixDomainSocket", "WindowsNamedPipe", "RPC"],
        readAggregation: ["GraphQL"],
      },
    },
    {
      status: status === "error" ? 503 : 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    }
  );
}
