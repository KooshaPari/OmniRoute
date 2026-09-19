/**
 * No-auth / anonymous fallback credential generation.
 *
 * Handles synthetic credentials for providers that can serve requests
 * without user-supplied API keys (e.g. opencode, mimocode).
 *
 * Extracted from auth.ts for modularity. The barrel re-exports from auth.ts
 * preserve all existing import paths.
 */
import { getProviderConnections } from "@/lib/db/providers";
import { toProviderConnection } from "@/lib/db/providers/lazyConnectionView";
import {
  getProviderById,
  NOAUTH_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
} from "@/shared/constants/providers";
import { isAnonymousFallbackDisabledBySettings } from "./noAuthProviderSettings";
import { resolveAccountProxiesFromRegistry } from "./noAuthProxyResolution";
import { getNoAuthHydrationProviderIds } from "./noAuthProviderSiblings";
import * as log from "../utils/logger";
import type { JsonRecord } from "./authQuotaPolicy";

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

/**
 * Sentinel connection id used for the synthetic credentials of no-auth /
 * keyless providers. It is NOT a real DB row, so it
 * cannot carry cooldown state -- the account-fallback loop must be able to
 * exclude it (#3061), otherwise it gets re-selected forever.
 */
export const SYNTHETIC_NOAUTH_CONNECTION_ID = "noauth";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

type AnonymousFallbackProviderDefinition = {
  anonymousFallback?: boolean;
  noAuth?: boolean;
};

// ──────────────────────────────────────────────────────────
// Synthetic credential builder
// ──────────────────────────────────────────────────────────

export function buildSyntheticNoAuthCredentials(providerSpecificData: JsonRecord = {}): {
  authType: "none";
  apiKey: null;
  accessToken: null;
  refreshToken: null;
  expiresAt: null;
  projectId: null;
  defaultModel: null;
  copilotToken: null;
  providerSpecificData: JsonRecord;
  connectionId: typeof SYNTHETIC_NOAUTH_CONNECTION_ID;
  testStatus: "active";
  lastError: null;
  lastErrorType: null;
  lastErrorSource: null;
  errorCode: null;
  rateLimitedUntil: null;
  maxConcurrent: null;
  allRateLimited?: never;
  allExpired?: never;
  retryAfter?: never;
  retryAfterHuman?: never;
} {
  return {
    authType: "none",
    apiKey: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    projectId: null,
    defaultModel: null,
    copilotToken: null,
    providerSpecificData,
    connectionId: SYNTHETIC_NOAUTH_CONNECTION_ID,
    testStatus: "active",
    lastError: null,
    lastErrorType: null,
    lastErrorSource: null,
    errorCode: null,
    rateLimitedUntil: null,
    maxConcurrent: null,
  };
}

// ──────────────────────────────────────────────────────────
// Provider-specific data hydration
// ──────────────────────────────────────────────────────────

/** Merge one connection's fingerprints/accountProxies into `hydrated`, first-wins. */
export function mergeNoAuthProviderSpecificData(
  hydrated: JsonRecord,
  conn: { providerSpecificData?: unknown }
): void {
  const psd = conn.providerSpecificData;
  if (!psd || typeof psd !== "object") return;
  const record = psd as JsonRecord;
  if (Array.isArray(record.fingerprints) && !Array.isArray(hydrated.fingerprints)) {
    hydrated.fingerprints = record.fingerprints;
  }
  if (Array.isArray(record.accountProxies) && !Array.isArray(hydrated.accountProxies)) {
    hydrated.accountProxies = record.accountProxies;
  }
}

/**
 * #4954 / #5217 (Gap 1) -- no-auth providers persist a connection row whose
 * `providerSpecificData` carries `fingerprints` + `accountProxies`. Hydrate those
 * and resolve by-id Proxy Pool references to live records (./noAuthProxyResolution)
 * so the executor gets a resolved inline `proxy`. Best-effort: failures -> empty.
 *
 * #7993: also checks sibling ids (e.g. "opencode-zen" -> "opencode") so a
 * proxy/fingerprint row saved under the no-auth id is still found when
 * credentials are hydrated for the apikey-gateway id that shares its public
 * endpoint.
 */
export async function loadNoAuthProviderSpecificData(providerId: string): Promise<JsonRecord> {
  try {
    const providerIdsToQuery = getNoAuthHydrationProviderIds(providerId);
    const hydrated: JsonRecord = {};
    for (const pid of providerIdsToQuery) {
      const connectionsRaw = await getProviderConnections({ provider: pid });
      const connections = (Array.isArray(connectionsRaw) ? connectionsRaw : []).map(
        toProviderConnection
      );
      for (const conn of connections) mergeNoAuthProviderSpecificData(hydrated, conn);
    }
    if (Array.isArray(hydrated.accountProxies)) {
      hydrated.accountProxies = await resolveAccountProxiesFromRegistry(hydrated.accountProxies);
    }
    return hydrated;
  } catch {
    return {};
  }
}

// ──────────────────────────────────────────────────────────
// Provider eligibility checks
// ──────────────────────────────────────────────────────────

export function providerCanUseSyntheticNoAuthFallback(providerId: string): boolean {
  const providerDef = getProviderById(providerId) as
    AnonymousFallbackProviderDefinition | undefined;
  const noAuthProviderDef = (
    NOAUTH_PROVIDERS as Record<string, AnonymousFallbackProviderDefinition | undefined>
  )[providerId];
  const webCookieProviderDef = (
    WEB_COOKIE_PROVIDERS as Record<string, AnonymousFallbackProviderDefinition | undefined>
  )[providerId];
  return (
    providerDef?.anonymousFallback === true ||
    noAuthProviderDef?.noAuth === true ||
    webCookieProviderDef?.noAuth === true
  );
}

/**
 * True only for API-key gateway providers whose synthetic anonymous fallback
 * eligibility comes from `anonymousFallback: true` on the static definition --
 * NOT for true no-auth providers (NOAUTH_PROVIDERS / WEB_COOKIE_PROVIDERS),
 * where the synthetic credential is the only credential path (blockedProviders
 * is the disable mechanism for those). `noAuthFallbackDisabledProviders` gates
 * exactly this subset.
 */
export function isAnonymousFallbackOnlyProvider(providerId: string): boolean {
  const providerDef = getProviderById(providerId) as
    AnonymousFallbackProviderDefinition | undefined;
  const noAuthProviderDef = (
    NOAUTH_PROVIDERS as Record<string, AnonymousFallbackProviderDefinition | undefined>
  )[providerId];
  const webCookieProviderDef = (
    WEB_COOKIE_PROVIDERS as Record<string, AnonymousFallbackProviderDefinition | undefined>
  )[providerId];
  return (
    providerDef?.anonymousFallback === true &&
    noAuthProviderDef?.noAuth !== true &&
    webCookieProviderDef?.noAuth !== true
  );
}

// ──────────────────────────────────────────────────────────
// Main fallback entry point
// ──────────────────────────────────────────────────────────

export async function maybeSyntheticNoAuthFallback(
  providerId: string,
  excludedConnectionIds: Set<string>,
  allowedConnections: string[] | null = null
) {
  if (!providerCanUseSyntheticNoAuthFallback(providerId)) return null;
  // #9057: a key pinned to specific connections via allowedConnections must
  // NOT receive the synthetic "noauth" connection -- the synthetic id is
  // never in an explicit allowlist, so returning it would let a restricted
  // key reach free providers (OpenCode Free, etc.) that it should not access.
  if (Array.isArray(allowedConnections) && allowedConnections.length > 0) return null;
  if (excludedConnectionIds.has(SYNTHETIC_NOAUTH_CONNECTION_ID)) return null;
  if (
    isAnonymousFallbackOnlyProvider(providerId) &&
    (await isAnonymousFallbackDisabledBySettings(providerId))
  ) {
    log.info("AUTH", `${providerId} | anonymous no-auth fallback disabled by settings`);
    return null;
  }
  // #4954: hydrate per-account proxy/rotation config off the connection row so
  // no-auth executors (opencode, mimocode) actually honor configured proxies.
  const providerSpecificData = await loadNoAuthProviderSpecificData(providerId);
  return buildSyntheticNoAuthCredentials(providerSpecificData);
}
