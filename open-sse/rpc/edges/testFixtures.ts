/**
 * Test fixtures for dispatch edge coverage verification (ADR-032 / Option C).
 *
 * The 6 expanded edges (`usage.sync`, `pricing.sync`, `webhook.dispatch`,
 * `metrics.render`, `scheduler.tick`, `config.reload`) are registered in
 * `open-sse/rpc/dispatchEdges.ts` and each has a T1/T2/T3 handler in its
 * respective edge module. This file provides:
 *   - `seedMetrics()` — populates the in-process metrics sink with sample
 *     counter/gauge/histogram values so the test can render text + assert.
 *   - `makeWebhookEvent()` / `makeUsageRecord()` / etc. — input factories
 *     that match the per-edge `TIn` contract exactly.
 *
 * Tests live in `tests/unit/dispatch-expanded-edges.test.ts`.
 */

import { recordTierDecision, recordReconcileSweep, setCurrentTier } from "../metrics.ts";

export function seedMetrics(): void {
  // Counter — tier decisions
  recordTierDecision({
    edgeName: "scoring.combo.scoreSimd",
    oldTier: "T2",
    newTier: "T3",
    reason: "tier-resolver:force",
    actor: "tier-resolver",
  });
  recordTierDecision({
    edgeName: "sse.chunk.sseStream",
    oldTier: "T3",
    newTier: "T1",
    reason: "kill-switch:openai",
    actor: "kill-switch-bridge",
  });
  // Histogram — reconcile sweep durations
  recordReconcileSweep({
    actor: "dispatch_reconciler",
    durationMs: 2.1,
  });
  recordReconcileSweep({
    actor: "dispatch_reconciler",
    durationMs: 3.4,
  });
  // Gauge — current tier per edge
  setCurrentTier("scoring.combo.scoreSimd", "T3");
  setCurrentTier("sse.chunk.sseStream", "T1");
  setCurrentTier("guardrails.pii.anonymize", "T3");
}

export interface WebhookEventInput {
  url: string;
  payload: Record<string, unknown>;
  signature?: string;
  retryCount?: number;
}

export function makeWebhookEvent(overrides: Partial<WebhookEventInput> = {}): WebhookEventInput {
  return {
    url: overrides.url ?? "https://example.com/webhook",
    payload: overrides.payload ?? { event: "tier_flip", edge: "scoring.combo.scoreSimd" },
    signature: overrides.signature ?? "sha256=0000",
    retryCount: overrides.retryCount ?? 0,
  };
}

export interface UsageRecordInput {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export function makeUsageRecord(overrides: Partial<UsageRecordInput> = {}): UsageRecordInput {
  return {
    provider: overrides.provider ?? "openai",
    model: overrides.model ?? "gpt-4o-mini",
    promptTokens: overrides.promptTokens ?? 1234,
    completionTokens: overrides.completionTokens ?? 567,
    costUsd: overrides.costUsd ?? 0.0023,
  };
}

export interface PricingSyncInput {
  source: "litellm" | "openrouter" | "manual";
  ttlSeconds?: number;
  forceRefresh?: boolean;
}

export function makePricingSyncInput(overrides: Partial<PricingSyncInput> = {}): PricingSyncInput {
  return {
    source: overrides.source ?? "litellm",
    ttlSeconds: overrides.ttlSeconds ?? 3600,
    forceRefresh: overrides.forceRefresh ?? false,
  };
}

export interface SchedulerTickInput {
  intervalMs: number;
  lastTickAt: number;
  isLeader: boolean;
}

export function makeSchedulerTick(overrides: Partial<SchedulerTickInput> = {}): SchedulerTickInput {
  return {
    intervalMs: overrides.intervalMs ?? 1000,
    lastTickAt: overrides.lastTickAt ?? Date.now() - 2000,
    isLeader: overrides.isLeader ?? true,
  };
}

export interface ConfigReloadInput {
  configPath: string;
  watchedPaths?: readonly string[];
}

export function makeConfigReload(overrides: Partial<ConfigReloadInput> = {}): ConfigReloadInput {
  return {
    configPath: overrides.configPath ?? "/etc/omniroute/config.json",
    watchedPaths: overrides.watchedPaths ?? ["/etc/omniroute/config.d/"],
  };
}
