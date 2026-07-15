import {
  getAllProviderLimitsCache,
  getProviderConnectionById,
  getProviderConnections,
  getSettings,
  resolveProxyForConnection,
  setProviderLimitsCache,
  setProviderLimitsCacheBatch,
  updateProviderConnection,
  updateSettings,
  type ProviderLimitsCacheEntry,
} from "@/lib/localDb";
import { syncToCloud } from "@/lib/cloudSync";
import { setQuotaCache } from "@/domain/quotaCache";
import { buildClaudeExtraUsageConnectionUpdate } from "@/lib/providers/claudeExtraUsage";
import { getMachineId } from "@/shared/utils/machine";
import { USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";
import { getExecutor } from "@omniroute/open-sse/executors/index.ts";
import { getUsageForProvider } from "@omniroute/open-sse/services/usage.ts";
import { runWithProxyContext } from "@omniroute/open-sse/utils/proxyFetch.ts";
<<<<<<< Updated upstream
import { onUsageRecorded } from "./usageEvents";
import {
  isRecord,
  isUsageQuotaKeyAllowed,
  normalizeUsageQuotasForProvider,
  sanitizeUsageQuotasForProvider,
} from "./providerLimits/quotaNormalize";
=======
>>>>>>> Stashed changes

type JsonRecord = Record<string, unknown>;

type SyncSource = "manual" | "scheduled";

interface ProviderConnectionLike {
  id: string;
  provider: string;
  authType?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenExpiresAt?: string;
  providerSpecificData?: JsonRecord;
  testStatus?: string;
  isActive?: boolean;
  lastError?: string | null;
  lastErrorAt?: string | null;
  lastErrorType?: string | null;
  lastErrorSource?: string | null;
  errorCode?: string | number | null;
  rateLimitedUntil?: string | null;
  backoffLevel?: number;
}

const PROVIDER_LIMITS_APIKEY_PROVIDERS = new Set(["glm", "glmt", "minimax", "minimax-cn", "crof"]);
const DEFAULT_PROVIDER_LIMITS_SYNC_INTERVAL_MINUTES = 70;
const PROVIDER_LIMITS_AUTO_SYNC_SETTING_KEY = "provider_limits_auto_sync_last_run";

function toProviderLimitsCacheEntry(
  usage: JsonRecord,
  source: SyncSource,
  fetchedAt = new Date().toISOString()
): ProviderLimitsCacheEntry {
  return {
    quotas: isRecord(usage.quotas) ? usage.quotas : null,
    plan: usage.plan ?? null,
    message: typeof usage.message === "string" ? usage.message : null,
    fetchedAt,
    source,
  };
}

<<<<<<< Updated upstream
function getProviderLimitsPostUsageRefreshDelayMs(): number {
  const raw = Number(process.env.PROVIDER_LIMITS_POST_USAGE_REFRESH_DELAY_MS ?? "");
  return Number.isFinite(raw) && raw >= 0
    ? raw
    : DEFAULT_PROVIDER_LIMITS_POST_USAGE_REFRESH_DELAY_MS;
}

function scheduleProviderLimitsPostUsageRefresh(connectionId: string): void {
  if (!connectionId || pendingPostUsageRefreshes.has(connectionId)) return;

  pendingPostUsageRefreshes.add(connectionId);
  const timer = setTimeout(() => {
    pendingPostUsageRefreshes.delete(connectionId);
    void fetchAndPersistProviderLimits(connectionId, "scheduled", {
      allowRotatingRefresh: true,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ProviderLimits] Post-usage refresh failed for connection ${connectionId}: ${message}`
      );
    });
  }, getProviderLimitsPostUsageRefreshDelayMs());
  timer.unref?.();
}

export function notifyProviderUsageRecorded(
  provider: string | null | undefined,
  connectionId: string | null | undefined
): void {
  if ((provider !== "antigravity" && provider !== "agy") || !connectionId) return;
  scheduleProviderLimitsPostUsageRefresh(connectionId);
}

// Subscribe at module load so usageHistory can emit usage events without importing
// this module (and its executors/translator import graph). This module is loaded by
// the provider-limits route and the background auto-sync scheduler at server boot.
onUsageRecorded(notifyProviderUsageRecorded);

function hasRetrieveUserQuotaSource(
  provider: string,
  cache: ProviderLimitsCacheEntry | undefined
): boolean {
  if (provider !== "antigravity" && provider !== "agy") return true;
  if (!cache?.quotas) return false;
  return Object.values(cache.quotas).some((quota) => {
    if (!isRecord(quota)) return false;
    return quota.quotaSource === "retrieveUserQuota";
  });
}

function sanitizeProviderLimitsCacheForConnection(
  connection: ProviderConnectionLike | null | undefined,
  entry: ProviderLimitsCacheEntry | null
): ProviderLimitsCacheEntry | null {
  if (!connection || !entry || !entry.quotas) return entry;
  if (connection.provider !== "antigravity" && connection.provider !== "agy") return entry;

  const sanitizedQuotas = normalizeUsageQuotasForProvider(connection.provider, entry.quotas);
  return sanitizedQuotas === entry.quotas ? entry : { ...entry, quotas: sanitizedQuotas };
}

function shouldRefreshProviderLimitsCache(
  connection: ProviderConnectionLike,
  cache: ProviderLimitsCacheEntry | undefined
): boolean {
  if (!cache?.quotas) return true;
  if (connection.provider !== "antigravity" && connection.provider !== "agy") return false;

  return (
    !hasRetrieveUserQuotaSource(connection.provider, cache) ||
    Object.keys(cache.quotas).some(
      (quotaKey) => !isUsageQuotaKeyAllowed(connection.provider, quotaKey)
    )
  );
}

=======
>>>>>>> Stashed changes
function isSupportedUsageConnection(connection: ProviderConnectionLike | null): boolean {
  if (
    !connection ||
    !connection.provider ||
    !USAGE_SUPPORTED_PROVIDERS.includes(connection.provider)
  ) {
    return false;
  }

  if (connection.authType === "oauth") return true;
  return (
    connection.authType === "apikey" && PROVIDER_LIMITS_APIKEY_PROVIDERS.has(connection.provider)
  );
}

function withStatus(error: Error, status: number): Error & { status: number } {
  return Object.assign(error, { status });
}

async function syncToCloudIfEnabled() {
  try {
    const machineId = await getMachineId();
    if (!machineId) return;
    await syncToCloud(machineId);
  } catch (error) {
    console.error("[ProviderLimits] Error syncing refreshed credentials to cloud:", error);
  }
}

<<<<<<< Updated upstream
/**
 * Whether the quota path may refresh this provider's token. Exported for testing.
 *
 * Rotating-refresh providers (Codex/OpenAI share one Auth0 client_id, etc.) mint a
 * single-use refresh_token on every refresh. The BULK quota-sync path runs many
 * connections concurrently; refreshing sibling accounts in parallel makes Auth0
 * revoke the whole token family (openai/codex#9648) and kills every account but
 * the last (#3019). So the bulk path never refreshes rotating providers
 * (`allowRotatingRefresh` falsy). The on-demand, per-connection path opts in and
 * is made safe by `serializeRefresh` (one token mint at a time per rotation group,
 * so even N concurrent per-account requests can never refresh siblings in
 * parallel). Non-rotating providers are always eligible.
 */
export function shouldAttemptRotatingRefresh(
  provider: string,
  allowRotatingRefresh: boolean | undefined
): boolean {
  if (rotationGroupFor(provider) === null) return true;
  return allowRotatingRefresh === true;
}

export async function refreshAndUpdateCredentials(
  connection: ProviderConnectionLike,
  opts: { allowRotatingRefresh?: boolean; force?: boolean } = {}
) {
  if (!shouldAttemptRotatingRefresh(connection.provider, opts.allowRotatingRefresh)) {
    return { connection, refreshed: false };
  }
  const executor = await getExecutor(connection.provider);
=======
async function refreshAndUpdateCredentials(connection: ProviderConnectionLike) {
  const executor = getExecutor(connection.provider);
>>>>>>> Stashed changes
  const credentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.tokenExpiresAt || connection.expiresAt || null,
    providerSpecificData: connection.providerSpecificData,
    copilotToken: connection.providerSpecificData?.copilotToken,
    copilotTokenExpiresAt: connection.providerSpecificData?.copilotTokenExpiresAt,
  };

  if (!executor.needsRefresh(credentials)) {
    return { connection, refreshed: false };
  }

  const refreshResult = await executor.refreshCredentials(credentials, console);

  if (!refreshResult) {
    if (connection.provider === "github" && connection.accessToken) {
      return { connection, refreshed: false };
    }
    throw withStatus(
      new Error("Failed to refresh credentials. Please re-authorize the connection."),
      401
    );
  }

  const updateData: JsonRecord = {
    updatedAt: new Date().toISOString(),
  };

  if (refreshResult.accessToken) {
    updateData.accessToken = refreshResult.accessToken;
  }
  if (refreshResult.refreshToken) {
    updateData.refreshToken = refreshResult.refreshToken;
  }
  if (refreshResult.expiresIn) {
    const expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();
    updateData.expiresAt = expiresAt;
    updateData.tokenExpiresAt = expiresAt;
  } else if (refreshResult.expiresAt) {
    updateData.expiresAt = refreshResult.expiresAt;
    updateData.tokenExpiresAt = refreshResult.expiresAt;
  }
  if (refreshResult.copilotToken || refreshResult.copilotTokenExpiresAt) {
    updateData.providerSpecificData = {
      ...(connection.providerSpecificData || {}),
      copilotToken: refreshResult.copilotToken,
      copilotTokenExpiresAt: refreshResult.copilotTokenExpiresAt,
    };
  }

  await updateProviderConnection(connection.id, updateData);

  return {
    connection: {
      ...connection,
      ...updateData,
      providerSpecificData:
        (updateData.providerSpecificData as JsonRecord | undefined) ||
        connection.providerSpecificData,
    },
    refreshed: true,
  };
}

function isNetworkFailureMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("Proxy unreachable") ||
    message.includes("UND_ERR_CONNECT_TIMEOUT")
  );
}

async function syncExpiredStatusIfNeeded(connection: ProviderConnectionLike, usage: JsonRecord) {
  const errorMessage = typeof usage.message === "string" ? usage.message.toLowerCase() : "";
  const isAuthError =
    errorMessage.includes("token expired") ||
    errorMessage.includes("access denied") ||
    errorMessage.includes("re-authenticate") ||
    errorMessage.includes("unauthorized");

  if (!isAuthError || connection.testStatus === "expired") {
    return;
  }

  try {
    await updateProviderConnection(connection.id, {
      testStatus: "expired",
      lastErrorType: "token_expired",
      lastErrorAt: new Date().toISOString(),
    });
  } catch (dbError) {
    console.error("[ProviderLimits] Failed to sync expired status to DB:", dbError);
  }
}

async function syncClaudeExtraUsageStateIfNeeded(
  connection: ProviderConnectionLike,
  usage: JsonRecord
): Promise<ProviderConnectionLike> {
  const update = buildClaudeExtraUsageConnectionUpdate(connection, usage);
  if (!update) return connection;

  await updateProviderConnection(connection.id, update);
  return {
    ...connection,
    ...update,
  };
}

export function getProviderLimitsSyncIntervalMinutes(): number {
  const raw = Number.parseInt(process.env.PROVIDER_LIMITS_SYNC_INTERVAL_MINUTES ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PROVIDER_LIMITS_SYNC_INTERVAL_MINUTES;
}

export function getProviderLimitsSyncIntervalMs(): number {
  return getProviderLimitsSyncIntervalMinutes() * 60 * 1000;
}

export async function getLastProviderLimitsAutoSyncTime(): Promise<string | null> {
  try {
    const settings = await getSettings();
    const value = settings[PROVIDER_LIMITS_AUTO_SYNC_SETTING_KEY];
    return typeof value === "string" && value.trim() ? value : null;
  } catch {
    return null;
  }
}

async function setLastProviderLimitsAutoSyncTime(timestamp: string): Promise<void> {
  await updateSettings({ [PROVIDER_LIMITS_AUTO_SYNC_SETTING_KEY]: timestamp });
}

export function getCachedProviderLimitsMap(): Record<string, ProviderLimitsCacheEntry> {
  return getAllProviderLimitsCache();
}

export async function fetchLiveProviderLimits(connectionId: string): Promise<{
  connection: ProviderConnectionLike;
  usage: JsonRecord;
}> {
  return fetchLiveProviderLimitsWithOptions(connectionId, { forceRefresh: false });
}

async function fetchLiveProviderLimitsWithOptions(
  connectionId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  connection: ProviderConnectionLike;
  usage: JsonRecord;
}> {
  let connection = (await getProviderConnectionById(connectionId)) as ProviderConnectionLike | null;
  if (!connection) {
    throw withStatus(new Error("Connection not found"), 404);
  }

  if (!isSupportedUsageConnection(connection)) {
    throw withStatus(new Error("Usage not available for this connection"), 400);
  }

  if (connection.authType !== "oauth") {
    const usage = (await getUsageForProvider(connection, options)) as JsonRecord;
    if (isRecord(usage.quotas)) {
      setQuotaCache(connectionId, connection.provider, usage.quotas);
    }
    await syncExpiredStatusIfNeeded(connection, usage);
    connection = await syncClaudeExtraUsageStateIfNeeded(connection, usage);
    return { connection, usage };
  }

  const proxyInfo = await resolveProxyForConnection(connectionId);

  const fetchUsageWithContext = async (proxyConfig: unknown) =>
    runWithProxyContext(proxyConfig, async () => {
      let conn = connection as ProviderConnectionLike;
      let wasRefreshed = false;

      const result = await refreshAndUpdateCredentials(conn);
      conn = result.connection;
      wasRefreshed = result.refreshed;

      if (wasRefreshed) {
        await syncToCloudIfEnabled();
      }

      const usageData = (await getUsageForProvider(conn, options)) as JsonRecord;
      connection = conn;
      return { usage: usageData };
    });

  let result: { usage: JsonRecord };
  const proxyConfig = proxyInfo?.proxy || null;

  try {
    result = await fetchUsageWithContext(proxyConfig);
  } catch (error: any) {
    const isThrownNetworkError =
      error?.message === "fetch failed" ||
      error?.code === "PROXY_UNREACHABLE" ||
      error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error?.cause?.code === "ECONNREFUSED";

    if (proxyConfig && isThrownNetworkError) {
      console.warn(
        `[ProviderLimits] Proxy fetch threw for ${connectionId}, retrying without proxy:`,
        error?.message
      );
      result = await fetchUsageWithContext(null);
    } else {
      throw error;
    }
  }

  if (proxyConfig && isNetworkFailureMessage(result.usage?.message)) {
    console.warn(
      `[ProviderLimits] Proxy usage returned network error for ${connectionId}, retrying without proxy:`,
      result.usage.message
    );
    result = await fetchUsageWithContext(null);
  }

  if (isRecord(result.usage.quotas)) {
    setQuotaCache(connectionId, connection.provider, result.usage.quotas);
  }
  await syncExpiredStatusIfNeeded(connection, result.usage);
  connection = await syncClaudeExtraUsageStateIfNeeded(connection, result.usage);

  return {
    connection,
    usage: result.usage,
  };
}

export async function fetchAndPersistProviderLimits(
  connectionId: string,
  source: SyncSource = "manual"
): Promise<{
  connection: ProviderConnectionLike;
  usage: JsonRecord;
  cache: ProviderLimitsCacheEntry;
}> {
  const { connection, usage } = await fetchLiveProviderLimitsWithOptions(connectionId, {
    forceRefresh: source === "manual",
  });
  const cache = toProviderLimitsCacheEntry(usage, source);
  setProviderLimitsCache(connectionId, cache);
  return { connection, usage, cache };
}

export async function syncAllProviderLimits(
  options: {
    source?: SyncSource;
    concurrency?: number;
  } = {}
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  caches: Record<string, ProviderLimitsCacheEntry>;
  errors: Record<string, string>;
}> {
  const { source = "manual", concurrency = 5 } = options;
  const connections = (
    (await getProviderConnections({ isActive: true })) as ProviderConnectionLike[]
  ).filter(isSupportedUsageConnection);
  const cacheEntries: Array<{ connectionId: string; entry: ProviderLimitsCacheEntry }> = [];
  const caches: Record<string, ProviderLimitsCacheEntry> = {};
  const errors: Record<string, string> = {};

  for (let i = 0; i < connections.length; i += concurrency) {
    const chunk = connections.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (connection) => {
        const { usage } = await fetchLiveProviderLimitsWithOptions(connection.id, {
          forceRefresh: source === "manual",
        });
        const cache = toProviderLimitsCacheEntry(usage, source);
        return { connectionId: connection.id, cache };
      })
    );

    results.forEach((result, index) => {
      const connectionId = chunk[index]?.id;
      if (!connectionId) return;

      if (result.status === "fulfilled") {
        cacheEntries.push({
          connectionId: result.value.connectionId,
          entry: result.value.cache,
        });
        caches[result.value.connectionId] = result.value.cache;
        return;
      }

      const reason = result.reason as { message?: string } | undefined;
      errors[connectionId] = reason?.message || "Failed to refresh provider limits";
    });
  }

  if (cacheEntries.length > 0) {
    setProviderLimitsCacheBatch(cacheEntries);
  }

  if (source === "scheduled") {
    await setLastProviderLimitsAutoSyncTime(new Date().toISOString());
  }

  return {
    total: connections.length,
    succeeded: cacheEntries.length,
    failed: connections.length - cacheEntries.length,
    caches,
    errors,
  };
}
