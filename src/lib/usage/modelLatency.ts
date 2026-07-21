/** Model latency aggregation backed by usage_history. */

import { getDbInstance } from "../db/core";
import { percentile, stdDev, toNumber, toStringOrNull } from "./usageHistory/helpers";

export interface ModelLatencyStatsEntry {
  provider: string;
  model: string;
  key: string;
  connectionId?: string;
  totalRequests: number;
  successfulRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  latencyStdDev: number;
  latencySampleCount: number;
  avgTtftMs?: number;
  ttftSampleCount: number;
  avgTokensPerSecond?: number;
  tpsSampleCount: number;
  windowHours: number;
}

export async function getModelLatencyStats(
  options: {
    windowHours?: number;
    minSamples?: number;
    maxRows?: number;
    connectionId?: string | null;
    keyByConnectionId?: boolean;
  } = {}
): Promise<Record<string, ModelLatencyStatsEntry>> {
  const windowHours =
    Number.isFinite(Number(options.windowHours)) && Number(options.windowHours) > 0
      ? Number(options.windowHours)
      : 24;
  const minSamples =
    Number.isFinite(Number(options.minSamples)) && Number(options.minSamples) > 0
      ? Number(options.minSamples)
      : 1;
  const maxRows =
    Number.isFinite(Number(options.maxRows)) && Number(options.maxRows) > 0
      ? Number(options.maxRows)
      : 10000;
  const db = getDbInstance();
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const connectionFilter =
    typeof options.connectionId === "string" && options.connectionId.length > 0
      ? " AND connection_id = @connectionId"
      : "";
  const rows = db
    .prepare(
      `
      SELECT provider, model, connection_id, success, latency_ms, ttft_ms, tokens_output
      FROM usage_history
      WHERE timestamp >= @sinceIso AND provider IS NOT NULL AND model IS NOT NULL
        ${connectionFilter}
      ORDER BY timestamp DESC LIMIT @maxRows
    `
    )
    .all({
      sinceIso,
      maxRows,
      ...(connectionFilter ? { connectionId: options.connectionId } : {}),
    }) as Array<{
    provider: string | null;
    model: string | null;
    connection_id: string | null;
    success: number | null;
    latency_ms: number | null;
    ttft_ms: number | null;
    tokens_output: number | null;
  }>;
  type Bucket = {
    provider: string;
    model: string;
    connectionId: string | null;
    totalRequests: number;
    successfulRequests: number;
    successfulLatencies: number[];
    allLatencies: number[];
    successfulTtfts: number[];
    allTtfts: number[];
    successfulTokensPerSecond: number[];
    allTokensPerSecond: number[];
  };
  const grouped = new Map<string, Bucket>();
  for (const row of rows) {
    const provider = toStringOrNull(row.provider);
    const model = toStringOrNull(row.model);
    if (!provider || !model) continue;
    const connectionId = toStringOrNull(row.connection_id);
    const key =
      options.keyByConnectionId && connectionId
        ? `${provider}/${model}/${connectionId}`
        : `${provider}/${model}`;
    if (!grouped.has(key))
      grouped.set(key, {
        provider,
        model,
        connectionId,
        totalRequests: 0,
        successfulRequests: 0,
        successfulLatencies: [],
        allLatencies: [],
        successfulTtfts: [],
        allTtfts: [],
        successfulTokensPerSecond: [],
        allTokensPerSecond: [],
      });
    const bucket = grouped.get(key);
    if (!bucket) continue;
    bucket.totalRequests += 1;
    const isSuccess = toNumber(row.success) !== 0;
    if (isSuccess) bucket.successfulRequests += 1;
    const latency = toNumber(row.latency_ms);
    if (latency > 0) {
      bucket.allLatencies.push(latency);
      if (isSuccess) bucket.successfulLatencies.push(latency);
    }
    const ttft = toNumber(row.ttft_ms);
    if (ttft > 0) {
      bucket.allTtfts.push(ttft);
      if (isSuccess) bucket.successfulTtfts.push(ttft);
    }
    const generationDurationMs = latency - ttft;
    if (toNumber(row.tokens_output) > 0 && ttft > 0 && generationDurationMs > 0) {
      const tokensPerSecond = (toNumber(row.tokens_output) * 1000) / generationDurationMs;
      if (Number.isFinite(tokensPerSecond) && tokensPerSecond > 0) {
        bucket.allTokensPerSecond.push(tokensPerSecond);
        if (isSuccess) bucket.successfulTokensPerSecond.push(tokensPerSecond);
      }
    }
  }
  const stats: Record<string, ModelLatencyStatsEntry> = {};
  for (const [key, bucket] of grouped.entries()) {
    const baseLatencies =
      bucket.successfulLatencies.length >= minSamples
        ? bucket.successfulLatencies
        : bucket.allLatencies;
    if (baseLatencies.length < minSamples) continue;
    const sorted = [...baseLatencies].sort((a, b) => a - b);
    const avg = sorted.reduce((acc, n) => acc + n, 0) / sorted.length;
    const successRate =
      bucket.totalRequests > 0 ? bucket.successfulRequests / bucket.totalRequests : 0;
    const ttfts =
      bucket.successfulTtfts.length >= minSamples ? bucket.successfulTtfts : bucket.allTtfts;
    const tokensPerSecond =
      bucket.successfulTokensPerSecond.length >= minSamples
        ? bucket.successfulTokensPerSecond
        : bucket.allTokensPerSecond;
    stats[key] = {
      provider: bucket.provider,
      model: bucket.model,
      key,
      ...(options.keyByConnectionId && bucket.connectionId
        ? { connectionId: bucket.connectionId }
        : {}),
      totalRequests: bucket.totalRequests,
      successfulRequests: bucket.successfulRequests,
      successRate,
      avgLatencyMs: Math.round(avg),
      p50LatencyMs: Math.round(percentile(sorted, 0.5)),
      p95LatencyMs: Math.round(percentile(sorted, 0.95)),
      p99LatencyMs: Math.round(percentile(sorted, 0.99)),
      latencyStdDev: Math.round(stdDev(sorted, avg)),
      latencySampleCount: baseLatencies.length,
      ...(ttfts.length > 0
        ? { avgTtftMs: Math.round(ttfts.reduce((acc, n) => acc + n, 0) / ttfts.length) }
        : {}),
      ...(tokensPerSecond.length > 0
        ? {
            avgTokensPerSecond: Number(
              (tokensPerSecond.reduce((acc, n) => acc + n, 0) / tokensPerSecond.length).toFixed(3)
            ),
          }
        : {}),
      ttftSampleCount: ttfts.length,
      tpsSampleCount: tokensPerSecond.length,
      windowHours,
    };
  }
  return stats;
}
