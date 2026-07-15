/**
 * Usage Stats — extracted from usageDb.js (T-15)
 *
 * Aggregates usage data into stats for the dashboard:
 * totals, by provider/model/account/apiKey, 10-minute buckets.
 *
 * @module lib/usage/usageStats
 */

import { getDbInstance } from "../db/core";
import { getPendingRequests } from "./usageHistory";
import { getAccountDisplayName } from "@/lib/display/names";
import { calculateCost } from "./costCalculator";

type JsonRecord = Record<string, unknown>;
type UsageBucket = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
};

type UsageBreakdown = UsageBucket & {
  rawModel?: string;
  provider?: string;
  lastUsed?: string;
  connectionId?: string;
  accountName?: string;
  apiKeyId?: string | null;
  apiKeyName?: string;
};

type ActiveRequest = {
  model: string;
  provider: string;
  account: string;
  count: number;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

<<<<<<< Updated upstream
function buildUsageSourceSql(aggregationEnabled: boolean) {
  if (!aggregationEnabled) {
    return `
      SELECT
        provider,
        model,
        timestamp,
        connection_id,
        api_key_id,
        api_key_name,
        COALESCE(tokens_input, 0) as tokens_input,
        COALESCE(tokens_output, 0) as tokens_output,
        COALESCE(tokens_cache_read, 0) as tokens_cache_read,
        COALESCE(tokens_cache_creation, 0) as tokens_cache_creation,
        COALESCE(tokens_reasoning, 0) as tokens_reasoning,
        COALESCE(tokens_input, 0) as cost_tokens_input,
        COALESCE(tokens_output, 0) as cost_tokens_output,
        COALESCE(tokens_cache_read, 0) as cost_tokens_cache_read,
        COALESCE(tokens_cache_creation, 0) as cost_tokens_cache_creation,
        COALESCE(tokens_reasoning, 0) as cost_tokens_reasoning,
        0.0 as stored_cost,
        COALESCE(service_tier, 'standard') as service_tier,
        1 as request_count
      FROM usage_history
    `;
  }

  return `
    SELECT
      provider,
      model,
      timestamp,
      connection_id,
      api_key_id,
      api_key_name,
      COALESCE(tokens_input, 0) as tokens_input,
      COALESCE(tokens_output, 0) as tokens_output,
      COALESCE(tokens_cache_read, 0) as tokens_cache_read,
      COALESCE(tokens_cache_creation, 0) as tokens_cache_creation,
      COALESCE(tokens_reasoning, 0) as tokens_reasoning,
      COALESCE(tokens_input, 0) as cost_tokens_input,
      COALESCE(tokens_output, 0) as cost_tokens_output,
      COALESCE(tokens_cache_read, 0) as cost_tokens_cache_read,
      COALESCE(tokens_cache_creation, 0) as cost_tokens_cache_creation,
      COALESCE(tokens_reasoning, 0) as cost_tokens_reasoning,
      0.0 as stored_cost,
      COALESCE(service_tier, 'standard') as service_tier,
      1 as request_count
    FROM usage_history
    WHERE DATE(timestamp) >= ?

    UNION ALL

    SELECT
      provider,
      model,
      date || 'T12:00:00.000Z' as timestamp,
      NULL as connection_id,
      NULL as api_key_id,
      NULL as api_key_name,
      COALESCE(total_input_tokens, 0) as tokens_input,
      COALESCE(total_output_tokens, 0) as tokens_output,
      0 as tokens_cache_read,
      0 as tokens_cache_creation,
      0 as tokens_reasoning,
      0 as cost_tokens_input,
      0 as cost_tokens_output,
      0 as cost_tokens_cache_read,
      0 as cost_tokens_cache_creation,
      0 as cost_tokens_reasoning,
      COALESCE(total_cost, 0.0) as stored_cost,
      'standard' as service_tier,
      COALESCE(total_requests, 0) as request_count
    FROM daily_usage_summary
    WHERE date < ?
  `;
}

const AGGREGATE_FIELDS = `
  SUM(request_count) as request_count,
  COALESCE(SUM(tokens_input), 0) as tokens_input,
  COALESCE(SUM(tokens_output), 0) as tokens_output,
  COALESCE(SUM(tokens_cache_read), 0) as tokens_cache_read,
  COALESCE(SUM(tokens_cache_creation), 0) as tokens_cache_creation,
  COALESCE(SUM(tokens_reasoning), 0) as tokens_reasoning,
  COALESCE(SUM(cost_tokens_input), 0) as cost_tokens_input,
  COALESCE(SUM(cost_tokens_output), 0) as cost_tokens_output,
  COALESCE(SUM(cost_tokens_cache_read), 0) as cost_tokens_cache_read,
  COALESCE(SUM(cost_tokens_cache_creation), 0) as cost_tokens_cache_creation,
  COALESCE(SUM(cost_tokens_reasoning), 0) as cost_tokens_reasoning,
  COALESCE(SUM(stored_cost), 0.0) as stored_cost,
  MAX(timestamp) as last_used
`;

async function calculateAggregateCost(row: JsonRecord): Promise<number> {
  const provider = toStringOrEmpty(row.provider) || "unknown";
  const model = toStringOrEmpty(row.model) || "unknown";
  const serviceTier = toStringOrEmpty(row.service_tier) || "standard";
  const storedCost = toNumber(row.stored_cost);
  const calculatedCost = await calculateCost(
    provider,
    model,
    {
      input: toNumber(row.cost_tokens_input ?? row.tokens_input),
      output: toNumber(row.cost_tokens_output ?? row.tokens_output),
      cacheRead: toNumber(row.cost_tokens_cache_read ?? row.tokens_cache_read),
      cacheCreation: toNumber(row.cost_tokens_cache_creation ?? row.tokens_cache_creation),
      reasoning: toNumber(row.cost_tokens_reasoning ?? row.tokens_reasoning),
    },
    { provider, serviceTier, flatRateAsZero: true }
  );
  return storedCost + calculatedCost;
}

function addUsage(
  bucket: UsageBucket,
  requests: number,
  promptTokens: number,
  completionTokens: number,
  cost: number
) {
  bucket.requests += requests;
  bucket.promptTokens += promptTokens;
  bucket.completionTokens += completionTokens;
  bucket.cost += cost;
}

function getApiKeyStatsKey(apiKeyId: string | null, apiKeyName: string | null): string {
  return apiKeyId ? `id:${apiKeyId}` : `name:${apiKeyName || "unknown"}`;
}

/**
 * Sum of all token columns recorded for one provider connection in the current
 * UTC calendar month. Powers SELF-TRACKED provider quotas (e.g. Xiaomi MiMo
 * Token Plan), where the upstream exposes no API-key usage endpoint — OmniRoute
 * counts the tokens it routed and compares against the known monthly limit.
 * Only reflects traffic that went THROUGH OmniRoute (not the provider's panel).
 */
export function getMonthlyProviderTokensForConnection(
  provider: string,
  connectionId: string
): number {
  if (!provider || !connectionId) return 0;
  const db = getDbInstance();
  const now = new Date();
  const monthStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_input), 0)
            + COALESCE(SUM(tokens_output), 0)
            + COALESCE(SUM(tokens_cache_read), 0)
            + COALESCE(SUM(tokens_cache_creation), 0)
            + COALESCE(SUM(tokens_reasoning), 0) AS total
       FROM usage_history
       WHERE provider = ? AND connection_id = ? AND timestamp >= ?`
    )
    .get(provider, connectionId, monthStartIso) as { total?: number } | undefined;
  return Math.max(0, Number(row?.total ?? 0));
}

/**
 * Total USD spend OmniRoute has recorded for a single provider connection, across all time
 * (i.e. "since the account was added" — usage_history rows only exist from first use onward).
 *
 * Sums per-model token usage from `usage_history` for the connection and prices each model via the
 * backend pricing table (`calculateCost`). Scoped to the given `provider` and to **successful**
 * requests (`success = 1`) so failed/errored calls and any cross-provider rows can't inflate the
 * total. Only reflects traffic that went THROUGH OmniRoute, not the provider's own dashboard. Used
 * to surface a "$X used since added" figure for providers that expose no native usage/quota API
 * (e.g. Vertex AI).
 */
export async function getConnectionSpendUsdSinceAdded(
  provider: string,
  connectionId: string
): Promise<{ costUsd: number; requests: number }> {
  if (!provider || !connectionId) return { costUsd: 0, requests: 0 };

  const db = getDbInstance();
  const rows = db
    .prepare(
      `SELECT model,
          COALESCE(SUM(tokens_input), 0) AS input,
          COALESCE(SUM(tokens_output), 0) AS output,
          COALESCE(SUM(tokens_cache_read), 0) AS cacheRead,
          COALESCE(SUM(tokens_cache_creation), 0) AS cacheCreation,
          COALESCE(SUM(tokens_reasoning), 0) AS reasoning,
          COUNT(*) AS requests
       FROM usage_history
       WHERE connection_id = ? AND provider = ? AND success = 1
       GROUP BY model`
    )
    .all(connectionId, provider) as Array<{
    model?: string;
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheCreation?: number;
    reasoning?: number;
    requests?: number;
  }>;

  let costUsd = 0;
  let requests = 0;
  for (const row of rows) {
    requests += Math.max(0, Number(row.requests ?? 0));
    const model = typeof row.model === "string" ? row.model : "";
    const tokens = {
      input: Number(row.input ?? 0),
      output: Number(row.output ?? 0),
      cacheRead: Number(row.cacheRead ?? 0),
      cacheCreation: Number(row.cacheCreation ?? 0),
      reasoning: Number(row.reasoning ?? 0),
    };
    costUsd += await calculateCost(provider, model, tokens, {
      provider,
      model,
      flatRateAsZero: true,
    });
  }

  return { costUsd: Math.max(0, costUsd), requests };
}

=======
>>>>>>> Stashed changes
/**
 * Get aggregated usage stats.
 */
export async function getUsageStats() {
  const db = getDbInstance();
  const rows = db.prepare("SELECT * FROM usage_history ORDER BY timestamp ASC").all() as unknown[];

  const { getProviderConnections } = await import("@/lib/localDb");
  let allConnections: unknown[] = [];
  try {
    const loadedConnections = await getProviderConnections();
    allConnections = Array.isArray(loadedConnections) ? loadedConnections : [];
  } catch {}

  const connectionMap: Record<string, string> = {};
  for (const connRaw of allConnections) {
    const conn = asRecord(connRaw);
    const connectionId = toStringOrEmpty(conn.id);
    if (!connectionId) continue;
    connectionMap[connectionId] =
      toStringOrEmpty(conn.name) || toStringOrEmpty(conn.email) || connectionId;
  }

  const pendingRequests = getPendingRequests();

  const stats: {
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: number;
    byProvider: Record<string, UsageBreakdown>;
    byModel: Record<string, UsageBreakdown>;
    byAccount: Record<string, UsageBreakdown>;
    byApiKey: Record<string, UsageBreakdown>;
    last10Minutes: UsageBucket[];
    pending: ReturnType<typeof getPendingRequests>;
    activeRequests: ActiveRequest[];
  } = {
    totalRequests: rows.length,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    byProvider: {},
    byModel: {},
    byAccount: {},
    byApiKey: {},
    last10Minutes: [],
    pending: pendingRequests,
    activeRequests: [],
  };

  // Build active requests
  for (const [connectionId, models] of Object.entries(pendingRequests.byAccount)) {
    for (const [modelKey, count] of Object.entries(models)) {
      if (count > 0) {
        const accountName =
          connectionMap[connectionId] || getAccountDisplayName({ id: connectionId });
        const match = modelKey.match(/^(.*) \((.*)\)$/);
        stats.activeRequests.push({
          model: match ? match[1] : modelKey,
          provider: match ? match[2] : "unknown",
          account: accountName,
          count,
        });
      }
    }
  }

  // 10-minute buckets
  const now = new Date();
  const currentMinuteStart = new Date(Math.floor(now.getTime() / 60000) * 60000);

  const bucketMap: Record<number, UsageBucket> = {};
  for (let i = 0; i < 10; i++) {
    const bucketTime = new Date(currentMinuteStart.getTime() - (9 - i) * 60 * 1000);
    const bucketKey = bucketTime.getTime();
    bucketMap[bucketKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
    stats.last10Minutes.push(bucketMap[bucketKey]);
  }

  const tenMinutesAgo = new Date(currentMinuteStart.getTime() - 9 * 60 * 1000);

  for (const rowRaw of rows) {
    const row = asRecord(rowRaw);
    const provider = toStringOrEmpty(row.provider) || "unknown";
    const model = toStringOrEmpty(row.model) || "unknown";
    const timestamp = toStringOrEmpty(row.timestamp) || new Date(0).toISOString();
    const connectionId = toStringOrEmpty(row.connection_id) || null;
    const apiKeyId = toStringOrEmpty(row.api_key_id) || null;
    const apiKeyName = toStringOrEmpty(row.api_key_name) || null;

    const promptTokens = toNumber(row.tokens_input);
    const completionTokens = toNumber(row.tokens_output);
    const entryTime = new Date(timestamp);

    const entryTokens = {
      input: toNumber(row.tokens_input),
      output: toNumber(row.tokens_output),
      cacheRead: toNumber(row.tokens_cache_read),
      cacheCreation: toNumber(row.tokens_cache_creation),
      reasoning: toNumber(row.tokens_reasoning),
    };
    const entryCost = await calculateCost(provider, model, entryTokens);

    stats.totalPromptTokens += promptTokens;
    stats.totalCompletionTokens += completionTokens;
    stats.totalCost += entryCost;

    // 10-min buckets
    if (entryTime >= tenMinutesAgo && entryTime <= now) {
      const entryMinuteStart = Math.floor(entryTime.getTime() / 60000) * 60000;
      if (bucketMap[entryMinuteStart]) {
        bucketMap[entryMinuteStart].requests++;
        bucketMap[entryMinuteStart].promptTokens += promptTokens;
        bucketMap[entryMinuteStart].completionTokens += completionTokens;
        bucketMap[entryMinuteStart].cost += entryCost;
      }
    }

    // By Provider
    if (!stats.byProvider[provider]) {
      stats.byProvider[provider] = {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      };
    }
    stats.byProvider[provider].requests++;
    stats.byProvider[provider].promptTokens += promptTokens;
    stats.byProvider[provider].completionTokens += completionTokens;
    stats.byProvider[provider].cost += entryCost;

    // By Model
    const modelKey = provider ? `${model} (${provider})` : model;
    if (!stats.byModel[modelKey]) {
      stats.byModel[modelKey] = {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
        rawModel: model,
        provider,
        lastUsed: timestamp,
      };
    }
    stats.byModel[modelKey].requests++;
    stats.byModel[modelKey].promptTokens += promptTokens;
    stats.byModel[modelKey].completionTokens += completionTokens;
    stats.byModel[modelKey].cost += entryCost;
    if (new Date(timestamp) > new Date(stats.byModel[modelKey].lastUsed || timestamp)) {
      stats.byModel[modelKey].lastUsed = timestamp;
    }

    // By Account
    if (connectionId) {
      const accountName =
        connectionMap[connectionId] || getAccountDisplayName({ id: connectionId });
      const accountKey = `${model} (${provider} - ${accountName})`;
      if (!stats.byAccount[accountKey]) {
        stats.byAccount[accountKey] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          rawModel: model,
          provider,
          connectionId,
          accountName,
          lastUsed: timestamp,
        };
      }
      stats.byAccount[accountKey].requests++;
      stats.byAccount[accountKey].promptTokens += promptTokens;
      stats.byAccount[accountKey].completionTokens += completionTokens;
      stats.byAccount[accountKey].cost += entryCost;
      if (new Date(timestamp) > new Date(stats.byAccount[accountKey].lastUsed || timestamp)) {
        stats.byAccount[accountKey].lastUsed = timestamp;
      }
    }

    // By API key
    if (apiKeyId || apiKeyName) {
      const keyName = apiKeyName || apiKeyId || "unknown";
      const keyId = apiKeyId || null;
      const apiKey = keyId ? `${keyName} (${keyId})` : keyName;
      if (!stats.byApiKey[apiKey]) {
        stats.byApiKey[apiKey] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          apiKeyId: keyId,
          apiKeyName: keyName,
          lastUsed: timestamp,
        };
      }
      stats.byApiKey[apiKey].requests++;
      stats.byApiKey[apiKey].promptTokens += promptTokens;
      stats.byApiKey[apiKey].completionTokens += completionTokens;
      stats.byApiKey[apiKey].cost += entryCost;
      if (new Date(timestamp) > new Date(stats.byApiKey[apiKey].lastUsed || timestamp)) {
        stats.byApiKey[apiKey].lastUsed = timestamp;
      }
    }
  }

  return stats;
}
