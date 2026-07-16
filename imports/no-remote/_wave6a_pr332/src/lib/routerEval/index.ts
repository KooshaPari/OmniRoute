/**
 * Router evaluation core for offline corpus and replay-mode regression checks.
 *
 * Inputs are provider/router observations; this module aggregates by config,
 * computes Pareto frontiers, and computes a lightweight AIQ-like score with
 * stable normalization across a single run.
 */

export interface RouterEvalObservation {
  sampleId: string;
  configId: string;
  expectedModel: string | null;
  selectedModel: string | null;
  routerBackend?: string | null;
  providerId?: string | null;
  cooldownApplied?: boolean | null;
  cooldownReason?: string | null;
  latencyMs: number | null;
  costUsd: number | null;
  success: boolean | null;
}

export interface RouterEvalConfigSummary {
  configId: string;
  totalObservations: number;
  matchObservations: number;
  successfulObservations: number;
  routerBackends: string[];
  providerIds: string[];
  cooldownObservations: number;
  avgLatencyMs: number | null;
  avgCostUsd: number | null;
  accuracyRate: number | null;
  successRate: number;
  aiqScore: number;
}

export interface RouterEvalReport {
  generatedAt: string;
  totalObservations: number;
  configs: RouterEvalConfigSummary[];
  paretoFrontier: RouterEvalConfigSummary[];
  bestConfigId: string | null;
  bestAiq: number;
  medianAccuracyRate: number | null;
}

export interface RouterEvalComparison {
  candidate: RouterEvalReport;
  baseline: RouterEvalReport;
  aiqDelta: number;
  frontierDelta: number;
  baselineAiq: number;
  candidateAiq: number;
  candidateFrontierSize: number;
  baselineFrontierSize: number;
  regressed: boolean;
}

type QualitySourceRow = {
  match: number;
  denominator: number;
};

type MutableSummary = {
  configId: string;
  totalObservations: number;
  matchCount: number;
  matchDenominator: number;
  successCount: number;
  latencySum: number;
  latencyCount: number;
  costSum: number;
  costCount: number;
  routerBackends: Set<string>;
  providerIds: Set<string>;
  cooldownObservations: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function round(value: number | null, digits = 2): number | null {
  if (!Number.isFinite(value as number)) return null;
  return Number((value as number).toFixed(digits));
}

function computeAiq(qualityRate: number | null, avgLatency: number | null, avgCost: number | null, maxLatency: number, maxCost: number): number {
  const quality = qualityRate == null ? 0 : qualityRate;
  const latencyPenalty = maxLatency > 0 && avgLatency != null ? avgLatency / maxLatency : 0.5;
  const costPenalty = maxCost > 0 && avgCost != null ? avgCost / maxCost : 0.25;
  const penalty = 40 * Math.min(1, latencyPenalty) + 25 * Math.min(1, costPenalty);
  return Math.max(0, round(quality * 100 - penalty, 6) as number);
}

function getQualityFromObservation(
  observation: RouterEvalObservation
): QualitySourceRow {
  if (observation.expectedModel != null && observation.selectedModel != null) {
    return { match: observation.selectedModel === observation.expectedModel ? 1 : 0, denominator: 1 };
  }
  if (observation.success != null) {
    return { match: observation.success ? 1 : 0, denominator: 1 };
  }
  return { match: 0, denominator: 0 };
}

function dominates(
  left: RouterEvalConfigSummary,
  right: RouterEvalConfigSummary
): boolean {
  const leftAccuracy = left.accuracyRate ?? 0;
  const rightAccuracy = right.accuracyRate ?? 0;
  const leftLatency = left.avgLatencyMs ?? Number.POSITIVE_INFINITY;
  const rightLatency = right.avgLatencyMs ?? Number.POSITIVE_INFINITY;
  const leftCost = left.avgCostUsd ?? Number.POSITIVE_INFINITY;
  const rightCost = right.avgCostUsd ?? Number.POSITIVE_INFINITY;

  const notWorse =
    leftAccuracy >= rightAccuracy &&
    leftLatency <= rightLatency &&
    leftCost <= rightCost;
  const strictlyBetter =
    leftAccuracy > rightAccuracy ||
    leftLatency < rightLatency ||
    leftCost < rightCost;
  return notWorse && strictlyBetter;
}

export function aggregateRouterObservations(observations: RouterEvalObservation[]): RouterEvalReport {
  const byConfig = new Map<string, MutableSummary>();
  for (const observation of observations) {
    const key = observation.configId.trim().length > 0 ? observation.configId : "default";
    const summary = byConfig.get(key) ?? {
      configId: key,
      totalObservations: 0,
      matchCount: 0,
      matchDenominator: 0,
      successCount: 0,
      latencySum: 0,
      latencyCount: 0,
      costSum: 0,
      costCount: 0,
      routerBackends: new Set(),
      providerIds: new Set(),
      cooldownObservations: 0,
    };

    summary.totalObservations++;
    const quality = getQualityFromObservation(observation);
    summary.matchCount += quality.match;
    summary.matchDenominator += quality.denominator;
    if (observation.success === true) summary.successCount++;

    if (observation.latencyMs != null) {
      summary.latencySum += observation.latencyMs;
      summary.latencyCount++;
    }
    if (observation.costUsd != null) {
      summary.costSum += observation.costUsd;
      summary.costCount++;
    }
    if (observation.routerBackend != null) summary.routerBackends.add(observation.routerBackend);
    if (observation.providerId != null) summary.providerIds.add(observation.providerId);
    if (observation.cooldownApplied === true) summary.cooldownObservations++;

    byConfig.set(key, summary);
  }

  const intermediate = Array.from(byConfig.values()).map((summary) => {
    const accuracyRate = summary.matchDenominator > 0
      ? round(summary.matchCount / summary.matchDenominator, 6)
      : null;
    return {
      configId: summary.configId,
      totalObservations: summary.totalObservations,
      matchObservations: summary.matchCount,
      successfulObservations: summary.successCount,
      routerBackends: Array.from(summary.routerBackends).sort(),
      providerIds: Array.from(summary.providerIds).sort(),
      cooldownObservations: summary.cooldownObservations,
      avgLatencyMs: round(summary.latencyCount > 0 ? summary.latencySum / summary.latencyCount : null),
      avgCostUsd: round(summary.costCount > 0 ? summary.costSum / summary.costCount : null),
      accuracyRate,
      successRate: round(summary.totalObservations > 0 ? summary.successCount / summary.totalObservations : 0, 6),
      aiqScore: 0,
    };
  });

  const finiteLatencies = intermediate
    .map((item) => item.avgLatencyMs)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const finiteCosts = intermediate
    .map((item) => item.avgCostUsd)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const maxLatency = finiteLatencies.length > 0 ? Math.max(...finiteLatencies) : 1;
  const maxCost = finiteCosts.length > 0 ? Math.max(...finiteCosts) : 1;

  const configs = intermediate.map((summary) => ({
    ...summary,
    aiqScore: computeAiq(summary.accuracyRate, summary.avgLatencyMs, summary.avgCostUsd, maxLatency, maxCost),
  }));

  const paretoFrontier = computeParetoFrontier(configs);
  const sortedByAiq = [...configs].sort((left, right) => right.aiqScore - left.aiqScore || right.accuracyRate - left.accuracyRate);
  const best = sortedByAiq[0] ?? null;
  const accuracySamples = configs
    .map((summary) => summary.accuracyRate)
    .filter((accuracy): accuracy is number => accuracy != null)
    .sort((left, right) => left - right);
  const medianAccuracyRate = accuracySamples.length === 0
    ? null
    : accuracySamples[Math.floor(accuracySamples.length / 2)] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    totalObservations: observations.length,
    configs: sortedByAiq,
    paretoFrontier,
    bestConfigId: best?.configId ?? null,
    bestAiq: best?.aiqScore ?? 0,
    medianAccuracyRate,
  };
}

export function computeParetoFrontier(configs: RouterEvalConfigSummary[]): RouterEvalConfigSummary[] {
  const result: RouterEvalConfigSummary[] = [];
  for (const candidate of configs) {
    const dominated = configs.some((other) => other.configId !== candidate.configId && dominates(other, candidate));
    if (!dominated) {
      result.push(candidate);
    }
  }
  return result.sort((left, right) => {
    const leftAccuracy = left.accuracyRate ?? 0;
    const rightAccuracy = right.accuracyRate ?? 0;
    if (leftAccuracy !== rightAccuracy) return rightAccuracy - leftAccuracy;
    const leftLatency = left.avgLatencyMs ?? Number.POSITIVE_INFINITY;
    const rightLatency = right.avgLatencyMs ?? Number.POSITIVE_INFINITY;
    if (leftLatency !== rightLatency) return leftLatency - rightLatency;
    const leftCost = left.avgCostUsd ?? Number.POSITIVE_INFINITY;
    const rightCost = right.avgCostUsd ?? Number.POSITIVE_INFINITY;
    return leftCost - rightCost;
  });
}

export function compareRouterEvalRuns(candidate: RouterEvalReport, baseline: RouterEvalReport): RouterEvalComparison {
  const candidateAiq = candidate.bestAiq;
  const baselineAiq = baseline.bestAiq;
  const aiqDelta = candidateAiq - baselineAiq;
  const frontierDelta = candidate.paretoFrontier.length - baseline.paretoFrontier.length;
  const regressed =
    candidateAiq < baselineAiq - Number.EPSILON ||
    candidate.paretoFrontier.length < baseline.paretoFrontier.length;

  return {
    candidate,
    baseline,
    aiqDelta,
    frontierDelta,
    baselineAiq,
    candidateAiq,
    candidateFrontierSize: candidate.paretoFrontier.length,
    baselineFrontierSize: baseline.paretoFrontier.length,
    regressed,
  };
}

export function formatPercentage(value: number | null): string {
  if (value == null) return "n/a";
  return `${Math.round(value * 10000) / 100}%`;
}

export function formatCost(value: number | null): string {
  if (value == null) return "n/a";
  return `$${round(value, 4)}`;
}

export function formatLatency(value: number | null): string {
  if (value == null) return "n/a";
  return `${round(value, 2)}ms`;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "n/a";
}

export function formatRouterEvalReport(report: RouterEvalReport): string {
  const lines = [
    "# Router Eval Report",
    `Generated at: ${report.generatedAt}`,
    `Observations: ${report.totalObservations}`,
    `Configs: ${report.configs.length}`,
    `Pareto frontier size: ${report.paretoFrontier.length}`,
    `Median quality rate: ${formatPercentage(report.medianAccuracyRate)}`,
    "",
    "| config | samples | backend | providers | cooldowns | accuracy | success | avg latency | avg cost | AIQ |",
    "|---|---:|---|---|---:|---:|---:|---:|---:|---:|",
    ...report.configs.map((config) =>
      `| ${config.configId} | ${config.totalObservations} | ${formatList(config.routerBackends)} | ${formatList(config.providerIds)} | ${config.cooldownObservations} | ${formatPercentage(config.accuracyRate)} | ${formatPercentage(config.successRate)} | ${formatLatency(config.avgLatencyMs)} | ${formatCost(config.avgCostUsd)} | ${round(config.aiqScore, 4)} |`
    ),
    "",
    "## Pareto frontier",
    report.paretoFrontier.length === 0
      ? "_No frontier points computed._"
      : report.paretoFrontier
          .map((config, index) => `${index + 1}. ${config.configId} (AIQ=${round(config.aiqScore, 4)})`)
          .join("\n"),
  ];

  return `${lines.join("\n")}\n`;
}

export function formatRouterEvalComparison(comparison: RouterEvalComparison): string {
  const lines = [
    "# Router Eval Regression Comparison",
    `Candidate AIQ: ${round(comparison.candidateAiq, 4)}`,
    `Baseline AIQ: ${round(comparison.baselineAiq, 4)}`,
    `AIQ delta: ${round(comparison.aiqDelta, 4)}`,
    `Frontier delta: ${comparison.frontierDelta}`,
    "",
    `Candidate frontier size: ${comparison.candidateFrontierSize}`,
    `Baseline frontier size: ${comparison.baselineFrontierSize}`,
    comparison.regressed ? "- Result: regression detected." : "- Result: no regression.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

export function parseObservation(raw: unknown, fallbackConfigId = "default"): RouterEvalObservation {
  const row = raw as Record<string, unknown>;
  const sampleId =
    normalizeString(row.sampleId) ||
    normalizeString(row.sample_id) ||
    normalizeString(row.id) ||
    normalizeString(row.requestId) ||
    "sample-unknown";
  const configId =
    normalizeString(row.configId) ||
    normalizeString(row.config_id) ||
    normalizeString(row.comboName) ||
    normalizeString(row.combo) ||
    normalizeString(row.routingConfig) ||
    fallbackConfigId;
  const expectedModel =
    normalizeString(row.expectedModel) ||
    normalizeString(row.expected_model) ||
    null;
  const selectedModel =
    normalizeString(row.selectedModel) ??
    normalizeString(row.selected_model) ??
    normalizeString(row.model) ??
    normalizeString(row.requestedModel) ??
    normalizeString(row.requested_model) ??
    null;
  const routerBackend =
    normalizeString(row.routerBackend) ??
    normalizeString(row.router_backend) ??
    normalizeString(row.backend) ??
    null;
  const providerId =
    normalizeString(row.providerId) ??
    normalizeString(row.provider_id) ??
    normalizeString(row.provider) ??
    null;
  const cooldownApplied = typeof row.cooldownApplied === "boolean"
    ? row.cooldownApplied
    : typeof row.cooldown_applied === "boolean"
      ? row.cooldown_applied
      : null;
  const cooldownReason =
    normalizeString(row.cooldownReason) ??
    normalizeString(row.cooldown_reason) ??
    null;
  const rawLatency = toFiniteNumber(
    row.latency_ms ??
      row.latencyMs ??
      row.latency ??
      row.duration
  );
  const rawCost = toFiniteNumber(row.costUsd ?? row.cost_usd ?? row.cost ?? row.totalCost ?? row.total_cost);
  const status = toFiniteNumber(row.status);
  const success = typeof row.success === "boolean"
    ? row.success
    : status != null
      ? status >= 200 && status < 300
      : null;
  return {
    sampleId,
    configId,
    expectedModel,
    selectedModel,
    routerBackend,
    providerId,
    cooldownApplied,
    cooldownReason,
    latencyMs: rawLatency,
    costUsd: rawCost,
    success,
  };
}
