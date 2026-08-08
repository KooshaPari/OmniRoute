import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createLogger } from "@/shared/utils/logger";

const log = createLogger("api:auth-status");

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim();
  return secret ? new TextEncoder().encode(secret) : null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const secret = getJwtSecret();

    if (!token || !secret) {
      return NextResponse.json({ authenticated: false });
    }

    await jwtVerify(token, secret);
    return NextResponse.json({ authenticated: true });
  } catch (err) {
    // SECURITY: log the JWT verification failure so forged tokens are
    // visible in audit logs. The catch returns `{ authenticated: false }`
    // (fail-closed) but operators need to know when this fires — repeated
    // failures indicate either misconfigured clients (legitimate) or
    // active probing (attack). Debug level to avoid log flooding on
    // legitimate failures (e.g., expired sessions).
    if (process.env.NODE_ENV !== "test") {
      log.debug(
        { err: (err as Error)?.message },
        "api.auth.status: JWT verification failed",
      );
    }
    return NextResponse.json({ authenticated: false });
  }
}
