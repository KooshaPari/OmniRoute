"use server";

import { NextResponse } from "next/server";
<<<<<<< Updated upstream
import { getSupervisor } from "@/lib/services/registry";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

import { parseVersionManagerToolRequest } from "../request";

export async function POST(request: Request) {
  const parsed = await parseVersionManagerToolRequest(request);
  if (!parsed.ok) {
    return parsed.response;
=======
import { stopTool } from "@/lib/versionManager";
import { versionManagerToolSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(versionManagerToolSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
>>>>>>> Stashed changes
  }

  try {
    const { tool } = validation.data;
    await stopTool(tool);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop";
    console.error("[version-manager] stop error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
