import { Hono } from "hono";

/**
 * Batch 3 BFF routes — Analytics dashboard.
 *
 * Provides mock/placeholder data for the SvelteKit analytics pages:
 *   - GET /analytics          overview tab data
 *   - GET /analytics/evals    evals tab data
 *   - GET /analytics/search   search tab data
 *   - GET /analytics/utilization utilization tab data
 *   - GET /analytics/combo-health combo health tab data
 *   - GET /analytics/cache-health cache health tab data
 *   - GET /analytics/route-trace route trace tab data
 */
export const analyticsRoutes = new Hono()

  /** Overview tab data matching UsageAnalyticsPayload shape. */
  .get("/", (c) => {
    const range = c.req.query("range") ?? "30d";
    return c.json({
      summary: {
        totalCost: 0,
        totalRequests: 0,
        uniqueModels: 0,
        uniqueAccounts: 0,
        uniqueApiKeys: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        fallbackCount: 0,
        fallbackRatePct: 0,
        requestedModelCoveragePct: 0,
        streak: 0,
      },
      byProvider: [],
      byModel: [],
      byApiKey: [],
      byAccount: [],
      byServiceTier: [],
      dailyTrend: [],
      weeklyPattern: [],
      activityMap: {},
      presetSummaries: {
        "1d": { totalCost: 0 },
        "7d": { totalCost: 0 },
        "30d": { totalCost: 0 },
      },
      range,
    });
  })

  /** Evals tab data. */
  .get("/evals", (c) => {
    return c.json({
      evals: [],
      summary: {
        totalEvals: 0,
        passedEvals: 0,
        failedEvals: 0,
        avgScore: 0,
      },
    });
  })

  /** Search tab data. */
  .get("/search", (c) => {
    const range = c.req.query("range") ?? "30d";
    return c.json({
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgLatencyMs: 0,
      byProvider: [],
      byModel: [],
      dailyTrend: [],
      cacheHitRate: 0,
      costSummary: {
        totalCost: 0,
        promptCost: 0,
        completionCost: 0,
      },
      range,
    });
  })

  /** Utilization tab data. */
  .get("/utilization", (c) => {
    const range = c.req.query("range") ?? "30d";
    return c.json({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 0,
      byProvider: [],
      byModel: [],
      byAccount: [],
      dailyTrend: [],
      peakConcurrent: 0,
      range,
    });
  })

  /** Combo health tab data. */
  .get("/combo-health", (c) => {
    return c.json({
      combos: [],
      summary: {
        totalCombos: 0,
        healthyCombos: 0,
        degradedCombos: 0,
        unhealthyCombos: 0,
      },
      alerts: [],
    });
  })

  /** Cache health tab data. */
  .get("/cache-health", (c) => {
    const range = c.req.query("range") ?? "30d";
    return c.json({
      totalCalls: 0,
      cacheReadTotal: 0,
      cacheWriteTotal: 0,
      writeReadRatio: 0,
      warmCalls: 0,
      coldCalls: 0,
      rewriteCalls: 0,
      uncachedCalls: 0,
      writeP50: 0,
      writeP90: 0,
      writeP99: 0,
      writeMax: 0,
      heavyWriteCalls: 0,
      heavyWriteCallShare: 0,
      heavyWriteTokenShare: 0,
      heavyWriteThreshold: 0,
      verdict: "no-data" as const,
      byModel: [],
      timeRange: range as any,
      since: new Date().toISOString(),
      truncated: false,
    });
  })

  /** Route trace tab data. */
  .get("/route-trace", (c) => {
    return c.json({
      traces: [],
      summary: {
        totalTraces: 0,
        successfulTraces: 0,
        failedTraces: 0,
        avgDurationMs: 0,
      },
    });
  });