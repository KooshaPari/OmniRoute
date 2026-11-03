import { NextResponse } from "next/server";
import { ONLINE_REPLACEMENT_UNAVAILABLE } from "@/lib/db/backup";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { isAuthRequired, isAuthenticated } from "@/shared/utils/apiAuth";

const DEFAULT_MAX_UPLOAD_MB = 100;
// Hard ceiling so a misconfigured/hostile value can't ask the route to buffer an
// unbounded file into memory.
const MAX_UPLOAD_MB_CEILING = 4096;

/**
 * Resolve the maximum accepted backup size (bytes) from the environment.
 *
 * Real databases bloat well past the historical 100 MB cap (#4719 — a 156 MB file that
 * VACUUMs down to 5 MB still can't be re-imported), so the limit is now operator-tunable
 * via `OMNIROUTE_DB_IMPORT_MAX_MB`. Invalid / out-of-range values fall back to the 100 MB
 * default and are clamped to a 4 GB ceiling.
 */
export function resolveMaxUploadSizeBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.OMNIROUTE_DB_IMPORT_MAX_MB;
  const parsed = raw === undefined ? NaN : Number(raw);
  const mb =
    Number.isFinite(parsed) && parsed >= 1
      ? Math.min(Math.floor(parsed), MAX_UPLOAD_MB_CEILING)
      : DEFAULT_MAX_UPLOAD_MB;
  return mb * 1024 * 1024;
}

export async function POST(request: Request) {
  if (await isAuthRequired(request)) {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({ error: sanitizeErrorMessage(new Error(ONLINE_REPLACEMENT_UNAVAILABLE)) }, { status: 503 });
}
