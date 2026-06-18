import { NextRequest, NextResponse } from "next/server";
import { processPR } from "@/lib/engine";
import { ReviewRequest, Tool } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Manual review trigger.
 * POST /api/review
 * Body: { owner, repo, number, head_sha, base_sha, tool? }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { owner, repo, number, head_sha, base_sha, tool } = body || {};
  if (!owner || !repo || !number || !head_sha || !base_sha) {
    return NextResponse.json({ error: "Missing required fields: owner, repo, number, head_sha, base_sha" }, { status: 400 });
  }

  const req: ReviewRequest = {
    pr: { owner, repo, number, head_sha, base_sha },
    event: "manual",
    preferred_tool: tool as Tool | undefined,
  };

  try {
    const result = await processPR(req);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
