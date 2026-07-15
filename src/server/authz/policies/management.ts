import { isModelSyncInternalRequest } from "../../../shared/services/modelSyncScheduler";
import { isAuthRequired, isDashboardSessionAuthenticated } from "../../../shared/utils/apiAuth";
import type { AuthOutcome, PolicyContext, RoutePolicy } from "../context";
import { allow, reject } from "../context";

const MODEL_SYNC_MANAGEMENT_PATH = /^\/api\/providers\/[^/]+\/(sync-models|models)$/;

function hasBearerToken(headers: Headers): boolean {
  const authHeader = headers.get("authorization") ?? headers.get("Authorization");
  return typeof authHeader === "string" && authHeader.trim().toLowerCase().startsWith("bearer ");
}

function isInternalModelSyncRequest(ctx: PolicyContext): boolean {
  if (!MODEL_SYNC_MANAGEMENT_PATH.test(ctx.classification.normalizedPath)) return false;
  return isModelSyncInternalRequest(ctx.request);
}

export const managementPolicy: RoutePolicy = {
  routeClass: "MANAGEMENT",
  async evaluate(ctx: PolicyContext): Promise<AuthOutcome> {
<<<<<<< Updated upstream
    const path = ctx.classification.normalizedPath;

    // Codex Responses-over-WS bridge: honor the per-process bridge secret before
    // the loopback/auth gates so the proxy's internal calls aren't 401'd (which
    // would corrupt the WS upgrade response). The internal route re-checks it.
    if (isValidWsBridgeRequest(ctx)) {
      return allow({ kind: "management_key", id: "ws-bridge", label: "codex-ws-bridge-secret" });
    }

    // Tier 1: local-only gate — block spawn-capable routes from non-loopback.
    //
    // Carve-out: a small allow-list of LOCAL_ONLY paths (see
    // LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES) is reachable from non-loopback
    // when the caller presents EITHER (a) a valid API key with the `manage`
    // scope, or (b) an authenticated dashboard session. This lets:
    //   - headless / remote MCP clients drive the management surface with a
    //     manage-scope Bearer key, and
    //   - the Dashboard UI itself (cookie session) render its MCP pages
    //     (/api/mcp/status, /api/mcp/tools) from a public hostname.
    //
    // The strict-loopback default still applies to everything else (notably
    // the subprocess-spawning /api/cli-tools/runtime/* surface, which is NOT
    // in the bypass list).
    //
    // Anonymous (no Bearer / invalid key / wrong scope / no session) requests
    // still hit the same 403 LOCAL_ONLY they did before.
    if (isLocalOnlyPath(path, ctx.request?.method) && !isLoopbackRequest(ctx) && !isPrivateLanRequest(ctx)) {
      if (isLocalOnlyBypassableByManageScope(path)) {
        // Management auth is header-only — a URL-borne token must never satisfy a
        // manage-scope bypass of a LOCAL_ONLY route. See #3300 follow-up.
        const apiKey = extractApiKey(ctx.request as unknown as Request, { allowUrl: false });
        if (apiKey) {
          try {
            if (await isValidApiKey(apiKey)) {
              const meta = await getApiKeyMetadata(apiKey);
              if (meta && hasManageScope(meta.scopes)) {
                // Distinguish admin vs manage in the audit label so log review
                // can tell which privilege actually granted the bypass.
                const grantedBy = meta.scopes.includes("admin") ? "admin" : "manage";
                return allow({
                  kind: "management_key",
                  id: meta.id,
                  label: `api-key-${grantedBy}-scope-local-only-bypass`,
                });
              }
            }
          } catch (err) {
            // Auth backend (DB / file store) failure: surface as 503 so the
            // caller can retry. Anything else (TypeError / ReferenceError /
            // programmer error) is logged so it's not silently swallowed —
            // the policy still degrades closed (503) to avoid leaking the
            // route, but we leave a breadcrumb for ops.
            console.error("[managementPolicy] manage-scope bypass auth check failed", err);
            return reject(503, "AUTH_BACKEND_UNAVAILABLE", "Service temporarily unavailable");
          }
        }
        // Dashboard session bypass: the Dashboard UI itself needs to render
        // /api/mcp/status, /api/mcp/tools, etc. from a public hostname. Cookie
        // auth is already proof of an authenticated admin — same trust level
        // as a manage-scope Bearer for the surface in scope here.
        try {
          if (await isDashboardSessionAuthenticated(ctx.request)) {
            return allow({
              kind: "dashboard_session",
              id: "dashboard",
              label: "dashboard-session-local-only-bypass",
            });
          }
        } catch (err) {
          // Mirror the manage-scope branch above: degrade closed (503) rather
          // than leaking the route through an unhandled 500, but log a
          // breadcrumb for ops. Session-store DB failure / cookie parsing
          // error / JWT decode throw all land here.
          console.error("[managementPolicy] dashboard-session bypass auth check failed", err);
          return reject(503, "AUTH_BACKEND_UNAVAILABLE", "Service temporarily unavailable");
        }
      }
      return reject(403, "LOCAL_ONLY", "This endpoint requires localhost access");
    }

    // Inspector ingest (D4): the standalone MITM proxy (server.cjs) posts
    // captured AgentBridge traffic to this loopback-only endpoint. It carries
    // its own shared-secret token (validated in the route handler), so it does
    // not also need a dashboard session / management key. The LOCAL_ONLY gate
    // above already rejected any non-loopback caller; we additionally require a
    // strict loopback request here so a LAN peer cannot reach it without auth.
    if (path === INSPECTOR_INGEST_PATH && isLoopbackRequest(ctx)) {
      return allow({
        kind: "management_key",
        id: "inspector-ingest",
        label: "inspector-ingest-token",
      });
=======
    if (!(await isAuthRequired())) {
      return allow({ kind: "anonymous", id: "anonymous", label: "auth-disabled" });
>>>>>>> Stashed changes
    }

    if (isInternalModelSyncRequest(ctx)) {
      return allow({ kind: "management_key", id: "model-sync", label: "internal-model-sync" });
    }

    if (await isDashboardSessionAuthenticated(ctx.request)) {
      return allow({ kind: "dashboard_session", id: "dashboard" });
    }

    const bearerPresent = hasBearerToken(ctx.request.headers);
    return reject(
      bearerPresent ? 403 : 401,
      "AUTH_001",
      bearerPresent ? "Invalid management token" : "Authentication required"
    );
  },
};
