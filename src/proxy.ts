import type { NextRequest } from "next/server";
import { runAuthzPipeline } from "./server/authz/pipeline";
import { withProxySpan } from "./lib/observability/proxySpan.ts";

export async function proxy(request: NextRequest) {
  // withProxySpan joins the inbound traceparent (if any) so the authz
  // pipeline + downstream route handlers all share one trace. The
  // wrapper is a no-op on the response shape (returns the inner
  // pipeline result unchanged) so middleware semantics are preserved.
  return withProxySpan(request, () => runAuthzPipeline(request, { enforce: true }));
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/home",
    "/home/:path*",
    "/api/:path*",
    "/v1/:path*",
    "/v1",
    "/chat/:path*",
    "/responses/:path*",
    "/responses",
    "/codex/:path*",
    "/codex",
    "/models",
  ],
};
