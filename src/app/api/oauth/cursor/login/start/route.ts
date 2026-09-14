import { NextResponse } from "next/server";
import { isAuthRequired, isAuthenticated } from "@/shared/utils/apiAuth";
import {
  createCursorLoginSession,
  generateCursorAuthParams,
} from "@/lib/oauth/services/cursorLogin";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";

async function requireOAuthAuth(request: Request) {
  if (!(await isAuthRequired(request))) return null;
  if (await isAuthenticated(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * POST /api/oauth/cursor/login/start
 * Begin deep-control PKCE login. Verifier stays server-side.
 */
export async function POST(request: Request) {
  const authResponse = await requireOAuthAuth(request);
  if (authResponse) return authResponse;

  try {
    const params = await generateCursorAuthParams();
    const { sessionId, loginUrl } = createCursorLoginSession(params);
    return NextResponse.json({
      success: true,
      sessionId,
      loginUrl,
      // Multi-replica note: sessions are in-process; use sticky routing if scaled out.
      expiresInSeconds: 15 * 60,
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error) || "Failed to start Cursor login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
