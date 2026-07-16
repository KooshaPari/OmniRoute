// /api/management/tokn/decide -- POST proxy to Rust /v1/tokn/decide.
//
// WP-RS-3: lets the dashboard run live routing-decision previews via
// HTTP. The browser cannot dlopen the native module, but it can fetch this
// route, which proxies to the Rust binary (the source of truth).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

const RUST_PORT = Number(process.env.OMNIROUTE_RUST_PORT ?? 20129);
const RUST_BASE = `http://127.0.0.1:${RUST_PORT}`;
const PROXY_TIMEOUT_MS = 2_000;

const ToknDecideBodySchema = z.object({
  model: z.string().trim().min(1),
  tenantId: z.string().optional(),
});

interface ToknDecideResponse {
  provider: string;
  model: string;
  fallbackChain: string[];
  source: "native" | "ts-fallback";
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ToknDecideBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const body = parsed.data;

  try {
    const upstream = await fetch(`${RUST_BASE}/v1/tokn/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: body.model, ...(body.tenantId ? { tenantId: body.tenantId } : {}) }),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return NextResponse.json(
        { error: `rust_http_${upstream.status}`, detail: errBody.slice(0, 500) },
        { status: upstream.status === 400 ? 400 : 502 },
      );
    }

    const data = (await upstream.json()) as ToknDecideResponse;
    return NextResponse.json(
      { ok: true, source: `${RUST_BASE}/v1/tokn/decide`, decision: data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "rust_unreachable",
        detail: err instanceof Error ? err.message : String(err),
        hint: `Is the omniroute-rs binary running on :${RUST_PORT}?`,
      },
      { status: 503 },
    );
  }
}
