// /api/management/tokn -- proxies the Rust binary's /v1/tokn/* endpoints.
//
// Default port: OMNIROUTE_RUST_PORT (defaults to 20129). The Rust binary is
// the source of truth for routing decisions; this route is a thin HTTP
// proxy so the management-console dashboard can render live stats and
// run "what would this call do?" previews without touching the FFI directly
// (the browser cannot dlopen native modules).
//
// WP-RS-3.

import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

const RUST_PORT = Number(process.env.OMNIROUTE_RUST_PORT ?? 20129);
const RUST_BASE = `http://127.0.0.1:${RUST_PORT}`;
const PROXY_TIMEOUT_MS = 2_000;

interface ToknStatsResponse {
  implKind: "native" | "ts-fallback";
  version: string;
  healthy: boolean;
  transport: string;
}

async function fetchRustStats(): Promise<{ ok: boolean; data?: ToknStatsResponse; error?: string }> {
  try {
    const res = await fetch(`${RUST_BASE}/v1/tokn/stats`, {
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `rust_http_${res.status}` };
    const data = (await res.json()) as ToknStatsResponse;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const upstream = await fetchRustStats();
  if (!upstream.ok || !upstream.data) {
    return NextResponse.json(
      {
        ok: false,
        source: `${RUST_BASE}/v1/tokn/stats`,
        service: "omniroute-management",
        rustReachable: false,
        error: upstream.error ?? "rust_unreachable",
        hint: `Is the omniroute-rs binary running on :${RUST_PORT}? Start with OMNIROUTE_PORT=${RUST_PORT} cargo run -p omniroute-rs --release`,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      source: `${RUST_BASE}/v1/tokn/stats`,
      service: "omniroute-management",
      rustReachable: true,
      stats: upstream.data,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
