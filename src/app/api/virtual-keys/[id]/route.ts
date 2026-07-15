/**
 * REST: /api/virtual-keys/[id]
 *
 * DELETE → revoke a virtual key. Idempotent (returns 200 on already-revoked
 * or unknown id, so clients can replay without error; full 404 is reserved
 * for malformed ids so the caller can distinguish "this id was never valid"
 * from "this id was already revoked").
 */
import { NextResponse } from "next/server";
import { revokeVirtualKey, getVirtualKey } from "@/lib/db/virtualKeys";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import * as log from "@/sse/utils/logger";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(_request);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    // Distinguish "never existed" (404) from "already revoked" (200).
    const existing = getVirtualKey(id);
    if (!existing) {
      return NextResponse.json({ error: "Virtual key not found" }, { status: 404 });
    }
    const revoked = revokeVirtualKey(id);
    return NextResponse.json({
      message: revoked ? "Virtual key revoked" : "Virtual key was already revoked",
      id,
      alreadyRevoked: !revoked,
    });
  } catch (error) {
    log.error("virtual-keys", "Error revoking virtual key", error);
    return NextResponse.json({ error: "Failed to revoke virtual key" }, { status: 500 });
  }
}
