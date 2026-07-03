/**
 * GET /api/bifrost/kill-switch — Bifrost kill switch state per provider
 *
 * Returns the current kill switch state for all providers (or a specific
 * provider if `?provider=` is specified). The kill switch monitors Bifrost
 * health over a sliding window and activates when degradation is detected
 * (p99 latency > threshold, error rate > threshold, etc.).
 *
 * Reference: ADR-031 § B9, PLAN.md § 2.5.2 (B9), docs/adr/0031-bifrost-tier1-router.md.
 *
 * @example
 *   GET /api/bifrost/kill-switch              → all providers
 *   GET /api/bifrost/kill-switch?provider=openai → just that provider
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";

async function loadKillSwitch() {
  const { listStates, getState } = await import(
    "@omniroute/open-sse/services/bifrostKillSwitch"
  );
  return { listStates, getState };
}

export async function GET(request: NextRequest) {
  try {
    const { listStates, getState } = await loadKillSwitch();
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    const result = provider
      ? { provider, state: getState(provider) ?? null }
      : { providers: listStates() };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[API] GET /api/bifrost/kill-switch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
