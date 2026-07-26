import { NextResponse } from "next/server";
import { getForkIdentity } from "@/lib/identity/forkIdentity";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getForkIdentity(), {
    headers: {
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
