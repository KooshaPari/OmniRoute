import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: "unified-review",
    version: "0.1.0",
    description: "Unified AI Code Review GitHub App",
    endpoints: {
      webhook: "POST /api/webhook",
      health: "GET /api/health",
    },
  });
}
