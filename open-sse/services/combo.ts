/**
 * Shared combo (model combo) handling with fallback support
 * Supports: priority, weighted, round-robin, random, least-used, cost-optimized,
 * strict-random, auto, fill-first, p2c, lkgp, context-optimized, and context-relay strategies
 */

import {
  checkFallbackError,
  formatRetryAfter,
  getRuntimeProviderProfile,
  recordProviderFailure,
  isProviderFailureCode,
} from "./accountFallback.ts";
import { errorResponse, unavailableResponse } from "../utils/error.ts";
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
import { buildTargetTimeoutRunner } from "./combo/targetTimeoutRunner.ts";
import {
  recordComboIntent,
  recordComboRequest,
  recordComboShadowRequest,
  getComboMetrics,
} from "./comboMetrics.ts";
import {
  resolveComboConfig,
  getDefaultComboConfig,
  resolveComboQueueDepth,
} from "./comboConfig.ts";
import {
  maybeGenerateHandoff,
  maybeGenerateUniversalHandoff,
  injectUniversalHandoffBody,
  SKIP_UNIVERSAL_HANDOFF_FLAG,
  type MessageLike,
} from "./contextHandoff.ts";
import {
  recordSessionModelUsage,
  getLastSessionModel,
  getHandoff,
} from "../../src/lib/db/contextHandoffs.ts";
import { extractSessionAffinityKey } from "@/sse/services/auth";
import { getHiddenModelsByProvider } from "@/models";
import { resolveModelLockoutSettings } from "../../src/lib/resilience/modelLockoutSettings";
import { fetchCodexQuota } from "./codexQuotaFetcher.ts";
import { evaluateQuotaCutoff, getQuotaFetcher, type QuotaInfo } from "./quotaPreflight.ts";
<<<<<<< Updated upstream
=======
import { recordComboIntent, recordComboRequest, getComboMetrics } from "./comboMetrics.ts";
import { resolveComboConfig, getDefaultComboConfig } from "./comboConfig.ts";
import { maybeGenerateHandoff, resolveContextRelayConfig } from "./contextHandoff.ts";
import { fetchCodexQuota } from "./codexQuotaFetcher.ts";
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import * as semaphore from "./rateLimitSemaphore.ts";
import { getCircuitBreaker } from "../../src/shared/utils/circuitBreaker";
import { fisherYatesShuffle, getNextFromDeck } from "../../src/shared/utils/shuffleDeck";
import { parseModel } from "./model.ts";
import { applyComboAgentMiddleware, injectModelTag } from "./comboAgentMiddleware.ts";
import { classifyWithConfig, DEFAULT_INTENT_CONFIG } from "./intentClassifier.ts";
import { selectProvider as selectAutoProvider } from "./autoCombo/engine.ts";
import { selectWithStrategy } from "./autoCombo/routerStrategy.ts";
<<<<<<< Updated upstream
import { parseAutoPrefix } from "./autoCombo/autoPrefix.ts";
import { parseAutoConfig } from "./combo/autoConfig.ts";
import { handlePipelineCombo, buildPipelineResponse } from "./autoCombo/pipelineRouter.ts";
import { type ProviderCandidate } from "./autoCombo/scoring.ts";
=======
import { getTaskFitness } from "./autoCombo/taskFitness.ts";
import {
  calculateFactors,
  calculateScore,
  DEFAULT_WEIGHTS,
  type ProviderCandidate,
  type ScoringWeights,
} from "./autoCombo/scoring.ts";
>>>>>>> Stashed changes
import { supportsToolCalling } from "./modelCapabilities.ts";
import { getSessionConnection } from "./sessionManager.ts";
import { getModelContextLimit } from "../../src/lib/modelCapabilities";
import { getProviderConnections } from "../../src/lib/db/providers";
import {
  getComboModelString,
  getComboStepTarget,
  getComboStepWeight,
  normalizeComboStep,
} from "../../src/lib/combos/steps.ts";
import {
  getConnectionRoutingTags,
  matchesRoutingTags,
  resolveRequestRoutingTags,
  type RoutingTagMatchMode,
} from "../../src/domain/tagRouter.ts";

<<<<<<< Updated upstream
import {
  MAX_RR_COUNTERS,
  rrCounters,
  rrStickyTargets,
  weightedStickyTargets,
  clampStickyRoundRobinTargetLimit,
  clampStickyWeightedTargetLimit,
  getStickyRoundRobinStartIndex,
  recordStickyRoundRobinSuccess,
  getStickyWeightedExecutionKey,
  recordStickyWeightedSuccess,
} from "./combo/rrState.ts";
import { validateResponseQuality, toRetryAfterDisplayValue } from "./combo/validateQuality.ts";
import { resolveComboCooldownWaitDecision } from "./combo/comboCooldownRetry.ts";
import {
  computeClosestRetryAfter,
  waitForCooldownAwareRetry,
} from "../../src/sse/services/cooldownAwareRetry.ts";
import { handleFusionChat, type FusionTuning } from "./fusion.ts";
import {
  TRANSIENT_FOR_SEMAPHORE,
  MAX_FALLBACK_WAIT_MS,
  MAX_GLOBAL_ATTEMPTS,
  isAllAccountsRateLimitedResponse,
  clampComboDepth,
  shouldSkipForPredictedTtft,
  shouldRecordProviderBreakerFailure,
  resolveDelayMs,
  comboModelNotFoundResponse,
  isStreamReadinessFailureErrorBody,
  isTokenLimitBreachErrorBody,
  toRecordedTarget,
  getExhaustedTargetSkipReason,
} from "./combo/comboPredicates.ts";
import { applyComboTargetExhaustion } from "./combo/targetExhaustion.ts";
import { executeRuntimeUnitCombo } from "./combo/runtimeUnits.ts";
import { dedupeTargetsByExecutionKey, isRecord } from "./combo/comboData.ts";
import {
  expandProviderWildcardsInCombo,
  expandProviderWildcardsInCollection,
} from "./combo/providerWildcard.ts";
import { resolveShadowTargets, scheduleShadowRouting } from "./combo/shadowRouting.ts";
import {
  sortTargetsByCost,
  sortTargetsByUsage,
  orderTargetsByPowerOfTwoChoices,
} from "./combo/targetSorters.ts";
import {
  filterTargetsByRequestCompatibility,
  getModelContextLimitForModelString,
  resolveComboRuntimeUnits,
  resolveComboTargets,
  resolveWeightedTargets,
  resolveWeightedStepGroups,
  sortTargetsByContextSize,
} from "./combo/comboStructure.ts";
import {
  QUOTA_SOFT_DEPRIORITIZE_FACTOR,
  setCandidateQuotaSoftPenalty,
  _registerExecutionCandidates,
  _unregisterExecutionCandidates,
  extractPromptForIntent,
  mapIntentToTaskType,
  getIntentConfig,
  applyRequestTagRouting,
  scoreAutoTargets,
  expandAutoComboCandidatePool,
} from "./combo/autoStrategy.ts";
import {
  resolveResetWindowConfig,
  calculateResetWindowAffinity,
  type ResetWindowConfig,
} from "./combo/quotaScoring.ts";
import {
  fetchResetAwareQuotaWithCache,
  preScreenTargets,
  orderTargetsByResetAwareQuota,
  orderTargetsByResetWindow,
  orderTargetsByHeadroom,
  type PreScreenResult,
} from "./combo/quotaStrategies.ts";
import {
  buildAutoQuotaThresholds,
  resolveQuotaExhaustionCutoffForTarget,
} from "./combo/quotaExhaustionCutoff.ts";
import {
  classifyTask,
  getConversationCacheKey,
  isTaskRoutingStrategy,
  reorderByTaskWeight,
} from "./taskAwareRouting.ts";

export { RESET_WINDOW_NAMES };
export { QUOTA_SOFT_DEPRIORITIZE_FACTOR, setCandidateQuotaSoftPenalty };
export { scoreAutoTargets, expandAutoComboCandidatePool };
export type { SingleModelTarget, ResolvedComboTarget };
export { validateResponseQuality };
export { clampComboDepth, shouldSkipForPredictedTtft, shouldRecordProviderBreakerFailure };
export { resolveShadowTargets, scheduleShadowRouting };
export { preScreenTargets };
export { resolveComboRuntimeUnits, resolveComboTargets, filterTargetsByRequestCompatibility };
export {
  getComboFromData,
  getComboModelsFromData,
  resolveNestedComboModels,
  resolveNestedComboTargets,
  validateComboDAG,
} from "./combo/comboStructure.ts";

const DEFAULT_MODEL_P95_MS: Record<string, number> = {
=======
// Status codes that should mark round-robin target semaphores as cooling down.
const TRANSIENT_FOR_SEMAPHORE = [429, 502, 503, 504];
// Patterns that signal all accounts for a provider are rate-limited / exhausted.
// Used to detect 503 responses from handleNoCredentials so combo can fallback.
const ALL_ACCOUNTS_RATE_LIMITED_PATTERNS = [/unavailable/i, /service temporarily unavailable/i];

function isAllAccountsRateLimitedResponse(
  status: number,
  contentType: string | null,
  errorText: string
): boolean {
  if (status !== 503) return false;
  if (!contentType?.includes("application/json")) return false;
  return ALL_ACCOUNTS_RATE_LIMITED_PATTERNS.some((p) => p.test(errorText));
}

const MAX_COMBO_DEPTH = 3;
const MAX_FALLBACK_WAIT_MS = 5000;
const MAX_GLOBAL_ATTEMPTS = 30;

function comboModelNotFoundResponse(message: string) {
  return errorResponse(404, message);
}

// Bootstrap defaults from ClawRouter benchmark (used when no local latency history exists yet)
const DEFAULT_MODEL_P95_MS = {
>>>>>>> Stashed changes
  "grok-4-fast-non-reasoning": 1143,
  "grok-4-1-fast-non-reasoning": 1244,
  "gemini-2.5-flash": 1238,
  "kimi-k2.5": 1646,
  "gpt-4o-mini": 2764,
  "claude-sonnet-4.6": 4000,
  "claude-opus-4.6": 6000,
  "deepseek-chat": 2000,
};
const MIN_HISTORY_SAMPLES = 10;
<<<<<<< Updated upstream
const OUTPUT_TOKEN_RATIO = 0.4;
=======
>>>>>>> Stashed changes

type ResolvedComboTarget = {
  kind: "model";
  stepId: string;
  executionKey: string;
  modelStr: string;
  provider: string;
  providerId: string | null;
  connectionId: string | null;
  allowedConnectionIds?: string[] | null;
  weight: number;
  label: string | null;
};

type ComboRuntimeStep =
  | ResolvedComboTarget
  | {
      kind: "combo-ref";
      stepId: string;
      executionKey: string;
      comboName: string;
      weight: number;
      label: string | null;
    };

function isRecord(value): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toTrimmedString(value): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Validate that a successful (HTTP 200) non-streaming response actually contains
 * meaningful content. Returns { valid: true } or { valid: false, reason }.
 *
 * Only inspects non-streaming JSON responses — streaming responses are passed through
 * because buffering the full stream would defeat the purpose of streaming.
 *
 * Checks:
 * 1. Body is valid JSON
 * 2. Has at least one choice with non-empty content or tool_calls
 */
export async function validateResponseQuality(
  response: Response,
  isStreaming: boolean,
  log: { warn?: (...args: unknown[]) => void }
): Promise<{ valid: boolean; reason?: string; clonedResponse?: Response }> {
  if (isStreaming) return { valid: true };

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json") && !contentType.includes("text/")) {
    return { valid: true };
  }

  let cloned: Response;
  try {
    cloned = response.clone();
  } catch {
    return { valid: true };
  }

  let text: string;
  try {
    text = await cloned.text();
  } catch {
    return { valid: true };
  }

  if (!text || text.trim().length === 0) {
    return { valid: false, reason: "empty response body" };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    if (text.startsWith("data:") || text.startsWith("event:")) return { valid: true };
    return { valid: false, reason: "response is not valid JSON" };
  }

  const choices = json?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    if (json?.output || json?.result || json?.data || json?.response) return { valid: true };
    if (json?.error) {
      const err = json.error as Record<string, unknown>;
      return {
        valid: false,
        reason: `upstream error in 200 body: ${err?.message || JSON.stringify(json.error).substring(0, 200)}`,
      };
    }
    return { valid: true };
  }

  const firstChoice = choices[0];
  const message = firstChoice?.message || firstChoice?.delta;
  if (!message) {
    return { valid: false, reason: "choice has no message object" };
  }

  const content = message.content;
  const toolCalls = message.tool_calls;
  const hasContent = content !== null && content !== undefined && content !== "";
  const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;

  if (!hasContent && !hasToolCalls) {
    return { valid: false, reason: "empty content and no tool_calls in response" };
  }

  return {
    valid: true,
    clonedResponse: new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  };
}

// In-memory atomic counter per combo for round-robin distribution
// Resets on server restart (by design — no stale state)
const rrCounters = new Map();

/**
 * Normalize a model entry to { model, weight }
 * Supports both legacy string format and new object format
 */
function normalizeModelEntry(entry) {
  return {
    model: getComboStepTarget(entry) || "",
    weight: getComboStepWeight(entry),
  };
}

function getTargetProvider(modelStr: string, providerId?: string | null): string {
  const parsed = parseModel(modelStr);
  return providerId || parsed.provider || parsed.providerAlias || "unknown";
}

function isStreamReadinessTimeoutErrorBody(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== "object") return false;
  const error = (errorBody as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return false;
  return (error as Record<string, unknown>).code === "STREAM_READINESS_TIMEOUT";
}

function toRecordedTarget(target: ResolvedComboTarget) {
  return {
    executionKey: target.executionKey,
    stepId: target.stepId,
    provider: target.provider,
    providerId: target.providerId,
    connectionId: target.connectionId,
    label: target.label,
  };
}

function buildExecutionKey(path: string[], stepId: string): string {
  return [...path, stepId].join(">");
}

function normalizeRuntimeStep(entry, comboName, index, allCombos, path = []) {
  const step = normalizeComboStep(entry, {
    comboName,
    index,
    allCombos,
  });
  if (!step) return null;

  const executionKey = buildExecutionKey(path, step.id);
  const label = typeof step.label === "string" ? step.label : null;
  const weight = step.weight || 0;

  if (step.kind === "combo-ref") {
    return {
      kind: "combo-ref",
      stepId: step.id,
      executionKey,
      comboName: step.comboName,
      weight,
      label,
    };
  }

  const modelStr = getComboModelString(step);
  if (!modelStr) return null;

  return {
    kind: "model",
    stepId: step.id,
    executionKey,
    modelStr,
    provider: getTargetProvider(modelStr, step.providerId),
    providerId: step.providerId || null,
    connectionId: step.connectionId || null,
    weight,
    label,
  } satisfies ResolvedComboTarget;
}

function getDirectComboTargets(combo) {
  return getOrderedTopLevelRuntimeSteps(combo, null).filter(
    (entry): entry is ResolvedComboTarget => entry?.kind === "model"
  );
}

function getTopLevelRuntimeSteps(combo, allCombos, path = []) {
  return (combo.models || [])
    .map((entry, index) => normalizeRuntimeStep(entry, combo.name, index, allCombos, path))
    .filter((entry): entry is ComboRuntimeStep => entry !== null);
}

function getCompositeTierStepOrder(combo): string[] {
  const compositeTiers = isRecord(combo?.config) ? combo.config.compositeTiers : null;
  if (!isRecord(compositeTiers)) return [];

  const defaultTier = toTrimmedString(compositeTiers.defaultTier);
  const tiers = isRecord(compositeTiers.tiers) ? compositeTiers.tiers : null;
  if (!defaultTier || !tiers) return [];

  const orderedStepIds: string[] = [];
  const visitedTiers = new Set<string>();
  const seenStepIds = new Set<string>();
  const tierEntries = new Map(
    Object.entries(tiers)
      .map(([tierName, rawTier]) => {
        if (!isRecord(rawTier)) return null;
        const normalizedTierName = toTrimmedString(tierName);
        const stepId = toTrimmedString(rawTier.stepId);
        const fallbackTier = toTrimmedString(rawTier.fallbackTier);
        if (!normalizedTierName || !stepId) return null;
        return [normalizedTierName, { stepId, fallbackTier }] as const;
      })
      .filter(Boolean)
  );

  let currentTier = defaultTier;
  while (currentTier && tierEntries.has(currentTier) && !visitedTiers.has(currentTier)) {
    visitedTiers.add(currentTier);
    const entry = tierEntries.get(currentTier);
    if (!entry) break;
    if (!seenStepIds.has(entry.stepId)) {
      orderedStepIds.push(entry.stepId);
      seenStepIds.add(entry.stepId);
    }
    currentTier = entry.fallbackTier;
  }

  for (const entry of tierEntries.values()) {
    if (!seenStepIds.has(entry.stepId)) {
      orderedStepIds.push(entry.stepId);
      seenStepIds.add(entry.stepId);
    }
  }

  return orderedStepIds;
}

function hasCompositeTierRuntimeOrder(combo): boolean {
  return getCompositeTierStepOrder(combo).length > 0;
}

function orderRuntimeStepsByCompositeTiers(steps: ComboRuntimeStep[], combo): ComboRuntimeStep[] {
  const orderedStepIds = getCompositeTierStepOrder(combo);
  if (orderedStepIds.length === 0) return steps;

  const byStepId = new Map(steps.map((step) => [step.stepId, step]));
  const seen = new Set<string>();
  const ordered: ComboRuntimeStep[] = [];

  for (const stepId of orderedStepIds) {
    const step = byStepId.get(stepId);
    if (!step || seen.has(step.stepId)) continue;
    ordered.push(step);
    seen.add(step.stepId);
  }

  for (const step of steps) {
    if (seen.has(step.stepId)) continue;
    ordered.push(step);
    seen.add(step.stepId);
  }

  return ordered;
}

function getOrderedTopLevelRuntimeSteps(combo, allCombos, path = []) {
  return orderRuntimeStepsByCompositeTiers(getTopLevelRuntimeSteps(combo, allCombos, path), combo);
}

function expandRuntimeStep(step, allCombos, visited = new Set(), depth = 0, path = []) {
  if (step.kind === "model") return [step];
  if (depth > MAX_COMBO_DEPTH) return [];

  const combos = Array.isArray(allCombos) ? allCombos : allCombos?.combos || [];
  const nestedCombo = combos.find((combo) => combo.name === step.comboName);
  if (!nestedCombo || visited.has(step.comboName)) return [];

  return resolveNestedComboTargets(nestedCombo, combos, new Set(visited), depth + 1, [
    ...path,
    step.stepId,
  ]);
}

export function resolveNestedComboTargets(
  combo,
  allCombos,
  visited = new Set(),
  depth = 0,
  path = []
) {
  const directTargets = (combo.models || [])
    .map((entry, index) => normalizeRuntimeStep(entry, combo.name, index, null, path))
    .filter((entry): entry is ResolvedComboTarget => entry?.kind === "model");

  if (depth > MAX_COMBO_DEPTH) return directTargets;
  if (visited.has(combo.name)) return [];
  visited.add(combo.name);

  const runtimeSteps = getOrderedTopLevelRuntimeSteps(combo, allCombos, path);
  const resolved: ResolvedComboTarget[] = [];

  for (const step of runtimeSteps) {
    if (step.kind === "combo-ref") {
      resolved.push(...expandRuntimeStep(step, allCombos, new Set(visited), depth, path));
      continue;
    }
    resolved.push(step);
  }

  return resolved;
}

/**
 * Get combo models from combos data (for open-sse standalone use)
 * @param {string} modelStr - Model string to check
 * @param {Array|Object} combosData - Array of combos or object with combos
 * @returns {Object|null} Full combo object or null if not a combo
 */
export function getComboFromData(modelStr, combosData) {
  const combos = Array.isArray(combosData) ? combosData : combosData?.combos || [];
  const combo = combos.find((c) => c.name === modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo;
  }
  return null;
}

/**
 * Legacy: Get combo models as string array (backward compat)
 */
export function getComboModelsFromData(modelStr, combosData) {
  const combo = getComboFromData(modelStr, combosData);
  if (!combo) return null;
  return combo.models.map((m) => normalizeModelEntry(m).model);
}

/**
 * Validate combo DAG — detect circular references and enforce max depth
 * @param {string} comboName - Name of the combo to validate
 * @param {Array} allCombos - All combos in the system
 * @param {Set} [visited] - Set of already visited combo names (for cycle detection)
 * @param {number} [depth] - Current depth level
 * @throws {Error} If circular reference or max depth exceeded
 */
export function validateComboDAG(comboName, allCombos, visited = new Set(), depth = 0) {
  if (depth > MAX_COMBO_DEPTH) {
    throw new Error(`Max combo nesting depth (${MAX_COMBO_DEPTH}) exceeded at "${comboName}"`);
  }
  if (visited.has(comboName)) {
    throw new Error(`Circular combo reference detected: ${comboName}`);
  }
  visited.add(comboName);

  const combos = Array.isArray(allCombos) ? allCombos : allCombos?.combos || [];
  const combo = combos.find((c) => c.name === comboName);
  if (!combo || !combo.models) return;

  for (const entry of combo.models) {
    const modelName = normalizeModelEntry(entry).model;
    // Check if this model name is itself a combo (not a provider/model pattern)
    const nestedCombo = combos.find((c) => c.name === modelName);
    if (nestedCombo) {
      validateComboDAG(modelName, combos, new Set(visited), depth + 1);
    }
  }
}

/**
 * Resolve nested combos by expanding inline to a flat model list
 * Respects max depth and detects cycles
 * @param {Object} combo - The combo object
 * @param {Array} allCombos - All combos in the system
 * @param {Set} [visited] - For cycle detection
 * @param {number} [depth] - Current depth
 * @returns {Array} Flat array of model strings
 */
export function resolveNestedComboModels(combo, allCombos, visited = new Set(), depth = 0) {
  if (depth > MAX_COMBO_DEPTH) return combo.models.map((m) => normalizeModelEntry(m).model);
  if (visited.has(combo.name)) return []; // cycle safety
  visited.add(combo.name);

  const combos = Array.isArray(allCombos) ? allCombos : allCombos?.combos || [];
  const resolved = [];

  for (const entry of combo.models || []) {
    const modelName = normalizeModelEntry(entry).model;
    const nestedCombo = combos.find((c) => c.name === modelName);

    if (nestedCombo) {
      // Recursively expand the nested combo
      const nested = resolveNestedComboModels(nestedCombo, combos, new Set(visited), depth + 1);
      resolved.push(...nested);
    } else {
      resolved.push(modelName);
    }
  }

  return resolved;
}

function selectWeightedTarget<T extends { weight?: number }>(targets: T[]) {
  if (targets.length === 0) return null;

  const totalWeight = targets.reduce((sum, target) => sum + (target.weight || 0), 0);
  if (totalWeight <= 0) {
    return targets[Math.floor(Math.random() * targets.length)];
  }

  let random = Math.random() * totalWeight;
  for (const target of targets) {
    random -= target.weight || 0;
    if (random <= 0) return target;
  }

  return targets[targets.length - 1];
}

function orderTargetsForWeightedFallback<T extends { executionKey: string; weight: number }>(
  targets: T[],
  selectedExecutionKey: string,
  preserveExistingOrder = false
) {
  const selected = targets.find((target) => target.executionKey === selectedExecutionKey);
  const rest = targets.filter((target) => target.executionKey !== selectedExecutionKey);
  if (!preserveExistingOrder) {
    rest.sort((a, b) => b.weight - a.weight);
  }
  return [selected, ...rest].filter(Boolean) as T[];
}

// shuffleArray and getNextModelFromDeck moved to src/shared/utils/shuffleDeck.ts
// combo.ts now uses the shared, mutex-protected getNextFromDeck with "combo:" namespace.

/**
 * Sort models by pricing (cheapest first) for cost-optimized strategy
 * @param {Array<string>} models - Model strings in "provider/model" format
 * @returns {Promise<Array<string>>} Sorted model strings
 */
async function sortModelsByCost(models) {
  try {
    const { getPricingForModel } = await import("../../src/lib/localDb");
    const withCost = await Promise.all(
      models.map(async (modelStr) => {
        const parsed = parseModel(modelStr);
        const provider = parsed.provider || parsed.providerAlias || "unknown";
        const model = parsed.model || modelStr;
        try {
          const pricing = await getPricingForModel(provider, model);
          return { modelStr, cost: pricing?.input ?? Infinity };
        } catch {
          return { modelStr, cost: Infinity };
        }
      })
    );
    withCost.sort((a, b) => a.cost - b.cost);
    return withCost.map((e) => e.modelStr);
  } catch {
    // If pricing lookup fails entirely, return original order
    return models;
  }
}

async function sortTargetsByCost(targets: ResolvedComboTarget[]) {
  const orderedModels = await sortModelsByCost(targets.map((target) => target.modelStr));
  const byModel = new Map<string, ResolvedComboTarget[]>();
  for (const target of targets) {
    const queue = byModel.get(target.modelStr) || [];
    queue.push(target);
    byModel.set(target.modelStr, queue);
  }
  return orderedModels
    .map((modelStr) => {
      const queue = byModel.get(modelStr);
      return queue?.shift() || null;
    })
    .filter((target): target is ResolvedComboTarget => target !== null);
}

/**
 * Sort models by usage count (least-used first) for least-used strategy
 * @param {Array<string>} models - Model strings
 * @param {string} comboName - Combo name for metrics lookup
 * @returns {Array<string>} Sorted model strings
 */
function sortModelsByUsage(models, comboName) {
  const metrics = getComboMetrics(comboName);
  if (!metrics || !metrics.byModel) return models;

  const withUsage = models.map((modelStr) => ({
    modelStr,
    requests: metrics.byModel[modelStr]?.requests ?? 0,
  }));
  withUsage.sort((a, b) => a.requests - b.requests);
  return withUsage.map((e) => e.modelStr);
}

function sortTargetsByUsage(targets: ResolvedComboTarget[], comboName: string) {
  const orderedModels = sortModelsByUsage(
    targets.map((target) => target.modelStr),
    comboName
  );
  const byModel = new Map<string, ResolvedComboTarget[]>();
  for (const target of targets) {
    const queue = byModel.get(target.modelStr) || [];
    queue.push(target);
    byModel.set(target.modelStr, queue);
  }
  return orderedModels
    .map((modelStr) => {
      const queue = byModel.get(modelStr);
      return queue?.shift() || null;
    })
    .filter((target): target is ResolvedComboTarget => target !== null);
}

/**
 * Sort models by context window size (largest first) for context-optimized strategy.
 * Uses models.dev synced capabilities to get context limits.
 * @param {Array<string>} models - Model strings in "provider/model" format
 * @returns {Array<string>} Sorted model strings (largest context first)
 */
function sortModelsByContextSize(models) {
  const withContext = models.map((modelStr) => {
    const parsed = parseModel(modelStr);
    const provider = parsed.provider || parsed.providerAlias || "unknown";
    const model = parsed.model || modelStr;
    const limit = getModelContextLimit(provider, model);
    return { modelStr, context: limit ?? 0 };
  });
  withContext.sort((a, b) => b.context - a.context);
  return withContext.map((e) => e.modelStr);
}

function sortTargetsByContextSize(targets: ResolvedComboTarget[]) {
  const orderedModels = sortModelsByContextSize(targets.map((target) => target.modelStr));
  const byModel = new Map<string, ResolvedComboTarget[]>();
  for (const target of targets) {
    const queue = byModel.get(target.modelStr) || [];
    queue.push(target);
    byModel.set(target.modelStr, queue);
  }
  return orderedModels
    .map((modelStr) => {
      const queue = byModel.get(modelStr);
      return queue?.shift() || null;
    })
    .filter((target): target is ResolvedComboTarget => target !== null);
}

function toTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      return "";
    })
    .join("\n");
}

function extractPromptForIntent(body) {
  if (!body || typeof body !== "object") return "";

  const fromMessages = Array.isArray(body.messages)
    ? [...body.messages].reverse().find((m) => m && typeof m === "object" && m.role === "user")
    : null;
  if (fromMessages) return toTextContent(fromMessages.content);

  if (typeof body.input === "string") return body.input;
  if (Array.isArray(body.input)) {
    const text = body.input
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        if (typeof item.content === "string") return item.content;
        if (typeof item.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }

  if (typeof body.prompt === "string") return body.prompt;
  return "";
}

function mapIntentToTaskType(intent) {
  switch (intent) {
    case "code":
      return "coding";
    case "reasoning":
      return "analysis";
    case "simple":
      return "default";
    case "medium":
    default:
      return "default";
  }
}

function toStringArray(input) {
  if (Array.isArray(input)) {
    return input.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function getIntentConfig(settings, combo) {
  const comboIntentConfig =
    combo?.autoConfig?.intentConfig ||
    combo?.config?.auto?.intentConfig ||
    combo?.config?.intentConfig ||
    {};

  return {
    ...DEFAULT_INTENT_CONFIG,
    ...comboIntentConfig,
    ...(typeof settings?.intentDetectionEnabled === "boolean"
      ? { enabled: settings.intentDetectionEnabled }
      : {}),
    ...(Number.isFinite(Number(settings?.intentSimpleMaxWords))
      ? { simpleMaxWords: Number(settings.intentSimpleMaxWords) }
      : {}),
    ...(toStringArray(settings?.intentExtraCodeKeywords).length > 0
      ? { extraCodeKeywords: toStringArray(settings.intentExtraCodeKeywords) }
      : {}),
    ...(toStringArray(settings?.intentExtraReasoningKeywords).length > 0
      ? { extraReasoningKeywords: toStringArray(settings.intentExtraReasoningKeywords) }
      : {}),
    ...(toStringArray(settings?.intentExtraSimpleKeywords).length > 0
      ? { extraSimpleKeywords: toStringArray(settings.intentExtraSimpleKeywords) }
      : {}),
  };
}

function getBootstrapLatencyMs(modelId) {
  const normalized = String(modelId || "").toLowerCase();
  return DEFAULT_MODEL_P95_MS[normalized] ?? 1500;
}

<<<<<<< Updated upstream
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, value));
}

function quotaRemainingPercentFromQuota(quota: unknown): number {
  if (!quota || typeof quota !== "object") return 100;
  const record = quota as Record<string, unknown>;
  if (record.limitReached === true) return 0;

  const windows = record.windows;
  if (windows && typeof windows === "object" && !Array.isArray(windows)) {
    let minRemaining: number | null = null;
    for (const windowInfo of Object.values(windows as Record<string, unknown>)) {
      if (!windowInfo || typeof windowInfo !== "object") continue;
      const percentUsed = Number((windowInfo as Record<string, unknown>).percentUsed);
      if (!Number.isFinite(percentUsed)) continue;
      const remaining = clampPercent((1 - percentUsed) * 100);
      minRemaining = minRemaining === null ? remaining : Math.min(minRemaining, remaining);
    }
    if (minRemaining !== null) return minRemaining;
  }

  const percentUsed = Number(record.percentUsed);
  if (Number.isFinite(percentUsed)) return clampPercent((1 - percentUsed) * 100);
  return 100;
}

const QUOTA_BLOCKING_CONNECTION_STATUSES = new Set([
  "banned",
  "credits_exhausted",
  "deactivated",
  "expired",
  "rate_limited",
]);

function normalizeConnectionStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasFutureRateLimitUntil(value: unknown): boolean {
  if (value == null || value === "") return false;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export function getConnectionStatusQuotaCutoffReason(
  connection: Record<string, unknown> | undefined
): string | undefined {
  if (!connection) return undefined;
  const status = normalizeConnectionStatus(connection.testStatus);
  if (QUOTA_BLOCKING_CONNECTION_STATUSES.has(status)) return status;
  if (status === "unavailable" && hasFutureRateLimitUntil(connection.rateLimitedUntil)) {
    return "rate_limited";
  }
  return undefined;
}

export async function buildAutoCandidates(
  targets: ResolvedComboTarget[],
  comboName: string,
  sessionId: string | null | undefined = null,
  resetWindowConfig: ResetWindowConfig = resolveResetWindowConfig(null),
  resilienceSettings: ResilienceSettings | null = null
): Promise<AutoProviderCandidate[]> {
  const hiddenModelsMap = getHiddenModelsByProvider();
=======
async function buildAutoCandidates(targets, comboName) {
>>>>>>> Stashed changes
  const metrics = getComboMetrics(comboName);
  const { getPricingForModel } = await import("../../src/lib/localDb");
  let historicalLatencyStats = {};
  try {
    const { getModelLatencyStats } = await import("../../src/lib/usageDb");
    historicalLatencyStats = await getModelLatencyStats({
      windowHours: 24,
      minSamples: 3,
      maxRows: 10000,
    });
  } catch {
    // keep empty stats — auto-combo will use runtime + bootstrap signals
  }

<<<<<<< Updated upstream
  const uniqueProviders = Array.from(
    new Set(
      targets.map((target) => target.provider || parseModel(target.modelStr).provider || "unknown")
    )
  );
  const connectionPoolCounts = new Map<string, number>();
  const connectionsByProvider = new Map<string, Array<Record<string, unknown>>>();
  const connectionById = new Map<string, Record<string, unknown>>();
  await Promise.all(
    uniqueProviders.map(async (provider) => {
      try {
        const connections = await getProviderConnections({ provider, isActive: true });
        const active = Array.isArray(connections) ? connections : [];
        connectionPoolCounts.set(provider, active.length);
        connectionsByProvider.set(provider, active);
        for (const connection of active) {
          if (connection && typeof connection === "object" && typeof connection.id === "string") {
            connectionById.set(connection.id, connection as Record<string, unknown>);
          }
        }
      } catch {
        connectionPoolCounts.set(provider, 0);
        connectionsByProvider.set(provider, []);
      }
    })
  );

  const expandedTargets: ResolvedComboTarget[] = [];
  for (const target of targets) {
    const provider = target.provider || parseModel(target.modelStr).provider || "unknown";
    const providerConnections = connectionsByProvider.get(provider) || [];
    if (target.connectionId) {
      expandedTargets.push(target);
      continue;
    }
    const connectionIds = providerConnections
      .map((c) => (c && typeof c === "object" && typeof c.id === "string" ? c.id : null))
      .filter((id): id is string => id !== null);
    const allowedConnectionIds = Array.isArray(target.allowedConnectionIds)
      ? new Set(
          target.allowedConnectionIds.filter(
            (connectionId): connectionId is string =>
              typeof connectionId === "string" && connectionId.trim().length > 0
          )
        )
      : null;
    const scopedConnectionIds = allowedConnectionIds
      ? connectionIds.filter((connectionId) => allowedConnectionIds.has(connectionId))
      : connectionIds;
    if (scopedConnectionIds.length === 0) {
      expandedTargets.push(target);
      continue;
    }
    for (const connectionId of scopedConnectionIds) {
      expandedTargets.push({
        ...target,
        connectionId,
        executionKey: `${target.executionKey}@${connectionId}`,
      });
    }
  }

=======
>>>>>>> Stashed changes
  const candidates = await Promise.all(
    targets.map(async (target) => {
      const modelStr = target.modelStr;
      const parsed = parseModel(modelStr);
      const provider = target.provider || parsed.provider || parsed.providerAlias || "unknown";
      const model = parsed.model || modelStr;
      const historicalKey = `${provider}/${model}`;
      const historicalModelMetric = historicalLatencyStats[historicalKey] || null;
      const historicalTotal = Number(historicalModelMetric?.totalRequests);
      const hasHistoricalSignal =
        Number.isFinite(historicalTotal) && historicalTotal >= MIN_HISTORY_SAMPLES;

      let costPer1MTokens = 1;
      try {
        const pricing = await getPricingForModel(provider, model);
        const inputPrice = Number(pricing?.input);
        if (Number.isFinite(inputPrice) && inputPrice >= 0) {
          costPer1MTokens = inputPrice;
        }
      } catch {
        // keep default cost
      }

      const modelMetric = metrics?.byModel?.[modelStr] || null;
      const avgLatency = Number(modelMetric?.avgLatencyMs);
      const successRate = Number(modelMetric?.successRate);
      const historicalP95Latency = Number(historicalModelMetric?.p95LatencyMs);
      const historicalStdDev = Number(historicalModelMetric?.latencyStdDev);
      const historicalSuccessRate = Number(historicalModelMetric?.successRate); // 0..1
      const historicalAvgTtft = Number(historicalModelMetric?.avgTtftMs);
      const historicalAvgE2E = Number(historicalModelMetric?.avgE2ELatencyMs);
      const historicalAvgTokensPerSecond = Number(historicalModelMetric?.avgTokensPerSecond);

      const p95LatencyMs = hasHistoricalSignal
        ? Number.isFinite(historicalP95Latency) && historicalP95Latency > 0
          ? historicalP95Latency
          : getBootstrapLatencyMs(model)
        : Number.isFinite(avgLatency) && avgLatency > 0
          ? avgLatency
          : getBootstrapLatencyMs(model);

      const errorRate = hasHistoricalSignal
        ? Number.isFinite(historicalSuccessRate) &&
          historicalSuccessRate >= 0 &&
          historicalSuccessRate <= 1
          ? 1 - historicalSuccessRate
          : 0.05
        : Number.isFinite(successRate) && successRate >= 0 && successRate <= 100
          ? 1 - successRate / 100
          : 0.05;
      const latencyStdDev =
        hasHistoricalSignal && Number.isFinite(historicalStdDev) && historicalStdDev > 0
          ? Math.max(10, historicalStdDev)
          : Math.max(10, p95LatencyMs * 0.1);

      const breakerStateRaw = getCircuitBreaker(provider)?.getStatus?.()?.state;
      const circuitBreakerState =
        breakerStateRaw === "OPEN" || breakerStateRaw === "HALF_OPEN" ? breakerStateRaw : "CLOSED";

      return {
        stepId: target.stepId,
        executionKey: target.executionKey,
        modelStr,
        provider,
        model,
        quotaRemaining: 100,
        quotaTotal: 100,
        circuitBreakerState,
        costPer1MTokens,
        p95LatencyMs,
        avgTtftMs:
          hasHistoricalSignal && Number.isFinite(historicalAvgTtft) && historicalAvgTtft > 0
            ? historicalAvgTtft
            : undefined,
        avgE2ELatencyMs:
          hasHistoricalSignal && Number.isFinite(historicalAvgE2E) && historicalAvgE2E > 0
            ? historicalAvgE2E
            : undefined,
        avgTokensPerSecond:
          hasHistoricalSignal &&
          Number.isFinite(historicalAvgTokensPerSecond) &&
          historicalAvgTokensPerSecond > 0
            ? historicalAvgTokensPerSecond
            : undefined,
        latencyStdDev,
        errorRate,
        accountTier: "standard",
        quotaResetIntervalSecs: 86400,
      };
    })
  );

  return candidates;
}

function dedupeTargetsByExecutionKey(targets: ResolvedComboTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.executionKey)) return false;
    seen.add(target.executionKey);
    return true;
  });
}

async function applyRequestTagRouting(
  targets: ResolvedComboTarget[],
  body: Record<string, unknown> | null | undefined,
  log: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void }
): Promise<ResolvedComboTarget[]> {
  const { tags, matchMode } = resolveRequestRoutingTags(body);
  if (tags.length === 0 || targets.length === 0) {
    return targets;
  }

  const providerIds = Array.from(
    new Set(targets.map((target) => target.providerId || target.provider))
  ).filter(
    (providerId): providerId is string => typeof providerId === "string" && providerId.length > 0
  );
  const providerConnections = new Map<string, Array<Record<string, unknown>>>();

  await Promise.all(
    providerIds.map(async (providerId) => {
      try {
        const connections = await getProviderConnections({ provider: providerId, isActive: true });
        providerConnections.set(
          providerId,
          Array.isArray(connections) ? (connections as Array<Record<string, unknown>>) : []
        );
      } catch (error) {
        log.warn?.(
          "COMBO",
          `Tag routing failed to load connections for provider=${providerId}: ${error instanceof Error ? error.message : String(error)}`
        );
        providerConnections.set(providerId, []);
      }
    })
  );

  const filteredTargets = targets.reduce<ResolvedComboTarget[]>((acc, target) => {
    const providerKey = target.providerId || target.provider;
    const candidateConnections =
      providerConnections.get(providerKey)?.filter((connection) => {
        const connectionId =
          typeof connection.id === "string" && connection.id.trim().length > 0
            ? connection.id
            : null;
        if (!connectionId) return false;
        if (target.connectionId) {
          return connectionId === target.connectionId;
        }
        return true;
      }) || [];

    const matchedConnectionIds = candidateConnections
      .filter((connection) =>
        matchesRoutingTags(
          getConnectionRoutingTags(connection.providerSpecificData),
          tags,
          matchMode as RoutingTagMatchMode
        )
      )
      .map((connection) => connection.id)
      .filter((connectionId): connectionId is string => typeof connectionId === "string");

    if (matchedConnectionIds.length === 0) {
      return acc;
    }

    if (target.connectionId) {
      acc.push(target);
      return acc;
    }

    acc.push({
      ...target,
      allowedConnectionIds: Array.from(new Set(matchedConnectionIds)),
    });
    return acc;
  }, []);

  if (filteredTargets.length === 0) {
    log.info?.(
      "COMBO",
      `Tag routing matched 0/${targets.length} targets for [${tags.join(", ")}] (${matchMode}); falling back to the full target set`
    );
    return targets;
  }

  log.info?.(
    "COMBO",
    `Tag routing matched ${filteredTargets.length}/${targets.length} targets for [${tags.join(", ")}] (${matchMode})`
  );
  return filteredTargets;
}

export function resolveComboTargets(combo, allCombos) {
  return allCombos ? resolveNestedComboTargets(combo, allCombos) : getDirectComboTargets(combo);
}

function resolveWeightedTargets(combo, allCombos) {
  const topLevelSteps = getOrderedTopLevelRuntimeSteps(combo, allCombos);
  if (topLevelSteps.length === 0) {
    return { orderedTargets: [], selectedStep: null };
  }

  const selectedStep = selectWeightedTarget(topLevelSteps);
  if (!selectedStep) {
    return { orderedTargets: [], selectedStep: null };
  }

  const orderedSteps = orderTargetsForWeightedFallback(
    topLevelSteps,
    selectedStep.executionKey,
    hasCompositeTierRuntimeOrder(combo)
  );
  const expandedTargets = orderedSteps.flatMap((step) => {
    if (!allCombos) {
      return step.kind === "model" ? [step] : [];
    }
    return expandRuntimeStep(step, allCombos, new Set([combo.name]));
  });

  return {
    orderedTargets: dedupeTargetsByExecutionKey(expandedTargets),
    selectedStep,
  };
}

function scoreAutoTargets(
  targets: ResolvedComboTarget[],
  candidates: ProviderCandidate[],
  taskType: string | null,
  weights: ScoringWeights
) {
  const candidateByExecutionKey = new Map(
    candidates.map((candidate: ProviderCandidate & { executionKey: string }) => [
      candidate.executionKey,
      candidate,
    ])
  );
  return targets
    .map((target) => {
      const candidate = candidateByExecutionKey.get(target.executionKey);
      if (!candidate) return null;
      const factors = calculateFactors(
        candidate as ProviderCandidate,
        candidates,
        taskType,
        getTaskFitness
      );
      return {
        target,
        score: calculateScore(factors, weights),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/**
 * Handle combo chat with fallback.
 * @param {Object} options
 * @param {Object} options.body - Request body
 * @param {Object} options.combo - Full combo object { name, models, strategy, config }
 * @param {Function} options.handleSingleModel - Function: (body, modelStr) => Promise<Response>
 * @param {Function} [options.isModelAvailable] - Optional pre-check: (modelStr) => Promise<boolean>
 * @param {Object} options.log - Logger object
 * @returns {Promise<Response>}
 */
/** @param {object} options */
export async function handleComboChat({
  body,
  combo,
  handleSingleModel,
  isModelAvailable,
  log,
  settings,
  allCombos,
  relayOptions,
  signal,
<<<<<<< Updated upstream
  apiKeyAllowedConnections = null,
  nesting = null,
}: HandleComboChatOptions): Promise<Response> {
  const comboCtx = createComboContext({ body, combo, settings, relayOptions, log });
  const {
    strategy,
    relayConfig,
    resilienceSettings,
    universalHandoffConfig,
    effectiveSessionId,
    pinnedModel,
    clientRequestedStream,
    config,
    comboTargetTimeoutMs,
    reasoningTokenBufferEnabled,
  } = phaseComboSetup(comboCtx);
  body = comboCtx.body;

  const handleSingleModelWithTimeout = buildTargetTimeoutRunner({
    handleSingleModel,
    comboTargetTimeoutMs,
    log,
  });
<<<<<<< Updated upstream
=======
}) {
  const strategy = combo.strategy || "priority";
  const relayConfig =
    strategy === "context-relay" ? resolveContextRelayConfig(relayOptions?.config || null) : null;

  // ── Combo Agent Middleware (#399 + #401) ────────────────────────────────
  // Apply system_message override, tool_filter_regex, and extract pinned model
  // from context caching tag. These are all opt-in per combo config.
  const { body: agentBody, pinnedModel } = applyComboAgentMiddleware(
    body,
    combo,
    "" // provider/model not yet known — resolved per-model in loop
  );
  body = agentBody;
  if (pinnedModel) {
    log.info("COMBO", `[#401] Context caching: pinned model=${pinnedModel}`);
  }
  const clientRequestedStream = body?.stream === true;
  // Wrap handleSingleModel to inject context caching tag on response (#401)
  const handleSingleModelWrapped = combo.context_cache_protection
    ? async (b, modelStr, target) => {
        const res = await handleSingleModel(b, modelStr, target);
        if (!res.ok) return res;

        // Non-streaming: inject tag into JSON response
        // Fix #721: Use OpenAI choices format (json.choices[0].message) not json.messages
        if (!b.stream) {
          try {
            const json = await res.clone().json();
            const choice = json?.choices?.[0];
            if (choice?.message) {
              // Wrap single message in array for injectModelTag, then unwrap
              const tagged = injectModelTag([choice.message], modelStr);
              // If the message had tool_calls but no string content, injectModelTag
              // appends a synthetic assistant message — use the last one
              const taggedMsg = tagged[tagged.length - 1];
              const updatedJson = {
                ...json,
                choices: [{ ...choice, message: taggedMsg }, ...(json.choices?.slice(1) || [])],
              };
              return new Response(JSON.stringify(updatedJson), {
                status: res.status,
                headers: res.headers,
              });
            }
          } catch {
            /* non-JSON — skip tagging */
          }
          return res;
        }

        // Streaming (Fix #490 + #511): prepend omniModel tag into the first
        // non-empty content chunk so it arrives BEFORE finish_reason:stop.
        // SDKs close the connection on finish_reason, so anything sent after
        // that marker is silently dropped.
        if (!res.body) return res;
        const tagContent = `<omniModel>${modelStr}</omniModel>`;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let tagInjected = false;

        const transform = new TransformStream({
          transform(chunk, controller) {
            if (tagInjected) {
              // Already injected — passthrough
              controller.enqueue(chunk);
              return;
            }

            const text = decoder.decode(chunk, { stream: true });

            // Fix #721: Look for either non-empty content OR tool_calls in the
            // SSE data. Tool-call-only responses have content:null, so we inject
            // the tag when we see a finish_reason approaching, or on first content.
            const contentMatch = text.match(/"content":"([^"]+)/);
            if (contentMatch) {
              // Inject tag at the beginning of the first content value
              const injected = text.replace(
                /"content":"([^"]+)/,
                `"content":"${tagContent.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}$1`
              );
              tagInjected = true;
              controller.enqueue(encoder.encode(injected));
              return;
            }

            // Fix #721: For tool-call-only streams, inject the tag when we see
            // the finish_reason chunk (before it reaches the client SDK which
            // would close the connection). This ensures the tag roundtrips
            // through the conversation history even when there's no text content.
            if (text.includes('"finish_reason"') && !text.includes('"finish_reason":null')) {
              // Inject a content chunk with the tag just before this finish chunk
              const tagChunk = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: { content: tagContent },
                    index: 0,
                    finish_reason: null,
                  },
                ],
              })}\n\n`;
              tagInjected = true;
              controller.enqueue(encoder.encode(tagChunk));
              controller.enqueue(chunk);
              return;
            }

            // No content yet — passthrough
            controller.enqueue(chunk);
          },
          flush(controller) {
            // If stream ends without ever finding content (edge case),
            // inject tag as a standalone chunk before the stream closes
            if (!tagInjected) {
              const tagChunk = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: { content: tagContent },
                    index: 0,
                    finish_reason: null,
                  },
                ],
              })}\n\n`;
              controller.enqueue(encoder.encode(tagChunk));
            }
          },
        });

        // FIX #585: Sanitize outbound stream — strip <omniModel> tags from
        // visible content so they don't leak to the user. The tag is still
        // present in the full response for round-trip context pinning, but
        // we clean it from each SSE chunk's content field before delivery.
        //
        // IMPORTANT: Use a SEPARATE TextDecoder from the transform stream above.
        // The transform stream's decoder accumulates UTF-8 state; reusing it here
        // would corrupt multi-byte characters split across chunk boundaries.
        const sanitizeDecoder = new TextDecoder();
        const sanitize = new TransformStream({
          transform(chunk, controller) {
            const text = sanitizeDecoder.decode(chunk, { stream: true });
            if (text) {
              if (text.includes("<omniModel>")) {
                const cleaned = text.replace(
                  /(?:\\n|\n|\r)*<omniModel>[^<]+<\/omniModel>(?:\\n|\n|\r)*/g,
                  ""
                );
                if (cleaned) controller.enqueue(encoder.encode(cleaned));
              } else {
                controller.enqueue(encoder.encode(text));
              }
            }
          },
          flush(controller) {
            const tail = sanitizeDecoder.decode();
            if (tail) {
              if (tail.includes("<omniModel>")) {
                const cleaned = tail.replace(
                  /(?:\\n|\n|\r)*<omniModel>[^<]+<\/omniModel>(?:\\n|\n|\r)*/g,
                  ""
                );
                if (cleaned) controller.enqueue(encoder.encode(cleaned));
              } else {
                controller.enqueue(encoder.encode(tail));
              }
            }
          },
        });

        const transformedStream = res.body.pipeThrough(transform).pipeThrough(sanitize);
        // Add model info as response header for clients that support it
        const headers = new Headers(res.headers);
        headers.set("X-OmniRoute-Model", modelStr);
        return new Response(transformedStream, {
          status: res.status,
          headers,
        });
      }
    : handleSingleModel;
  // ─────────────────────────────────────────────────────────────────────────
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

  // Route to pinned model if context caching specifies one (Fix #679)
  if (pinnedModel) {
    log.info(
      "COMBO",
      `Bypassing strategy — routing directly to pinned context model: ${pinnedModel}`
    );
    return handleSingleModelWrapped(body, pinnedModel);
  }

  // Route to round-robin handler if strategy matches
  if (strategy === "round-robin") {
    return handleRoundRobinCombo({
      body,
      combo,
      handleSingleModel: handleSingleModelWrapped,
      isModelAvailable,
      log,
      settings,
      allCombos,
      signal,
    });
  }

  // Use config cascade if settings provided
  const config = settings
    ? resolveComboConfig(combo, settings)
    : { ...getDefaultComboConfig(), ...(combo.config || {}) };
  const maxRetries = config.maxRetries ?? 1;
  const retryDelayMs = config.retryDelayMs ?? 2000;

  let orderedTargets =
    strategy === "weighted"
      ? resolveWeightedTargets(combo, allCombos)?.orderedTargets || []
      : resolveComboTargets(combo, allCombos);

  orderedTargets = await applyRequestTagRouting(orderedTargets, body, log);

  if (strategy === "weighted") {
    log.info(
      "COMBO",
      `Weighted selection${allCombos ? " with nested resolution" : ""}: ${orderedTargets.length} total targets`
    );
  } else if (allCombos) {
    log.info("COMBO", `${strategy} with nested resolution: ${orderedTargets.length} total targets`);
  }

  if (strategy === "auto") {
    const requestHasTools = Array.isArray(body?.tools) && body.tools.length > 0;
    let eligibleTargets = [...orderedTargets];

    if (requestHasTools) {
      const filtered = eligibleTargets.filter((target) => supportsToolCalling(target.modelStr));
      if (filtered.length > 0) {
        eligibleTargets = filtered;
      } else {
        log.warn(
          "COMBO",
          "Auto strategy: all candidates filtered by tool-calling policy, falling back to full pool"
        );
      }
    }

    const prompt = extractPromptForIntent(body);
    const systemPrompt =
      typeof combo?.system_message === "string" ? combo.system_message : undefined;
    const intentConfig = getIntentConfig(settings, combo);
    const intent = classifyWithConfig(prompt, intentConfig, systemPrompt);
    recordComboIntent(combo.name, intent);
    const taskType = mapIntentToTaskType(intent);

<<<<<<< Updated upstream
    const {
      routingStrategy,
      candidatePool,
      weights,
      explorationRate,
      budgetCap,
      modePack,
      resetWindowConfig,
      slaPolicy,
    } = parseAutoConfig(combo, eligibleTargets);
=======
    const autoConfigSource = combo?.autoConfig || combo?.config?.auto || combo?.config || {};
    const routingStrategy =
      typeof autoConfigSource.routingStrategy === "string"
        ? autoConfigSource.routingStrategy
        : typeof autoConfigSource.strategyName === "string"
          ? autoConfigSource.strategyName
          : "rules";

    const candidatePool = Array.isArray(autoConfigSource.candidatePool)
      ? autoConfigSource.candidatePool
      : [...new Set(eligibleTargets.map((target) => target.provider))];

    const weights =
      autoConfigSource.weights && typeof autoConfigSource.weights === "object"
        ? autoConfigSource.weights
        : DEFAULT_WEIGHTS;
    const explorationRate = Number.isFinite(Number(autoConfigSource.explorationRate))
      ? Number(autoConfigSource.explorationRate)
      : 0.05;
    const budgetCap = Number.isFinite(Number(autoConfigSource.budgetCap))
      ? Number(autoConfigSource.budgetCap)
      : undefined;
    const modePack =
      typeof autoConfigSource.modePack === "string" ? autoConfigSource.modePack : undefined;
>>>>>>> Stashed changes

    let lastKnownGoodProvider: string | undefined;
    try {
      const { getLKGP } = await import("../../src/lib/localDb");
      const lkgp = await getLKGP(combo.name, combo.id || combo.name);
      if (lkgp) lastKnownGoodProvider = lkgp;
    } catch (err) {
      log.warn("COMBO", "Failed to retrieve Last Known Good Provider. This is non-fatal.", { err });
    }

<<<<<<< Updated upstream
    const autoCandidateResilienceSettings =
      relayOptions?.bypassProviderQuotaPolicy === true
        ? {
            ...resilienceSettings,
            quotaPreflight: {
              ...resilienceSettings.quotaPreflight,
              enabled: false,
            },
          }
        : resilienceSettings;
    const candidates = await buildAutoCandidates(
      eligibleTargets,
      combo.name,
      relayOptions?.sessionId,
      resetWindowConfig,
      autoCandidateResilienceSettings
    );
    const routableCandidates = candidates.filter(
      (candidate) => candidate.quotaCutoffBlocked !== true
    );
    const quotaBlockedCount = candidates.length - routableCandidates.length;
    if (quotaBlockedCount > 0) {
      log.info(
        "COMBO",
        `Auto strategy: quota cutoff skipped ${quotaBlockedCount}/${candidates.length} account candidates`
      );
    }
    // G2: Register candidates so chatCore can mark quotaSoftPenalty via setCandidateQuotaSoftPenalty.
    _registerExecutionCandidates(routableCandidates);
    if (candidates.length > 0 && routableCandidates.length === 0) {
      return unavailableResponse(
        429,
        "All auto strategy candidates are below configured quota cutoffs"
      );
    }
    if (routableCandidates.length > 0) {
      let selectedProvider: string | null = null;
      let selectedModel: string | null = null;
=======
    const candidates = await buildAutoCandidates(eligibleTargets, combo.name);
    if (candidates.length > 0) {
      let selectedProvider = null;
      let selectedModel = null;
>>>>>>> Stashed changes
      let selectionReason = "";

      if (routingStrategy !== "rules") {
        try {
          const decision = selectWithStrategy(
            candidates,
            { taskType, requestHasTools, lastKnownGoodProvider },
            routingStrategy
          );
          selectedProvider = decision.provider;
          selectedModel = decision.model;
          selectionReason = decision.reason;
        } catch (err) {
          log.warn(
            "COMBO",
            `Auto strategy '${routingStrategy}' failed (${err?.message || "unknown"}), falling back to rules`
          );
        }
      }

      if (!selectedProvider || !selectedModel) {
        const selection = selectAutoProvider(
          {
            id: combo.id || combo.name,
            name: combo.name,
            type: "auto",
            candidatePool,
            weights,
            modePack,
            budgetCap,
            explorationRate,
          },
          candidates,
          taskType
        );
        selectedProvider = selection.provider;
        selectedModel = selection.model;
        selectionReason = `score=${selection.score.toFixed(3)}${selection.isExploration ? " (exploration)" : ""}`;
      }

      const scoredTargets = scoreAutoTargets(eligibleTargets, candidates, taskType, weights);
      const rankedTargets = scoredTargets.map((entry) => entry.target);
      const selectedTarget =
        scoredTargets.find((entry) => {
          const parsed = parseModel(entry.target.modelStr);
          const modelId = parsed.model || entry.target.modelStr;
          return entry.target.provider === selectedProvider && modelId === selectedModel;
        })?.target ||
        rankedTargets[0] ||
        eligibleTargets[0];

      orderedTargets = dedupeTargetsByExecutionKey(
        [selectedTarget, ...rankedTargets, ...eligibleTargets].filter(Boolean)
      );

      log.info(
        "COMBO",
        `Auto selection: ${selectedTarget?.modelStr || `${selectedProvider}/${selectedModel}`} | intent=${intent} task=${taskType} | strategy=${routingStrategy} | ${selectionReason}`
      );
    } else {
      log.warn("COMBO", "Auto strategy has no candidates, keeping default ordering");
    }
  } else if (strategy === "lkgp") {
    try {
      const { getLKGP } = await import("../../src/lib/localDb");
      const lkgpProvider = await getLKGP(combo.name, combo.id || combo.name);

      if (lkgpProvider) {
        const lkgpIndex = orderedTargets.findIndex(
          (target) =>
            target.provider === lkgpProvider || target.modelStr.startsWith(`${lkgpProvider}/`)
        );

        if (lkgpIndex > 0) {
          const [lkgpTarget] = orderedTargets.splice(lkgpIndex, 1);
          orderedTargets.unshift(lkgpTarget);
          log.info(
            "COMBO",
            `[LKGP] Prioritizing last known good provider ${lkgpProvider} for combo "${combo.name}"`
          );
        } else if (lkgpIndex === 0) {
          log.debug(
            "COMBO",
            `[LKGP] Last known good provider ${lkgpProvider} already first for combo "${combo.name}"`
          );
        }
      }
    } catch (err) {
      log.warn("COMBO", "Failed to retrieve Last Known Good Provider. This is non-fatal.", { err });
    }
  } else if (strategy === "strict-random") {
    const selectedExecutionKey = await getNextFromDeck(
      `combo:${combo.name}`,
      orderedTargets.map((target) => target.executionKey)
    );
    const selectedTarget =
      orderedTargets.find((target) => target.executionKey === selectedExecutionKey) || null;
    const rest = orderedTargets.filter((target) => target.executionKey !== selectedExecutionKey);
    orderedTargets = [selectedTarget, ...rest].filter(Boolean);
    log.info(
      "COMBO",
      `Strict-random deck: ${selectedExecutionKey} selected (${orderedTargets.length} targets)`
    );
  } else if (strategy === "random") {
    orderedTargets = fisherYatesShuffle([...orderedTargets]);
    log.info("COMBO", `Random shuffle: ${orderedTargets.length} targets`);
  } else if (strategy === "least-used") {
    orderedTargets = sortTargetsByUsage(orderedTargets, combo.name);
    log.info("COMBO", `Least-used ordering: ${orderedTargets[0]?.modelStr} has fewest requests`);
  } else if (strategy === "cost-optimized") {
    orderedTargets = await sortTargetsByCost(orderedTargets);
    log.info("COMBO", `Cost-optimized ordering: cheapest first (${orderedTargets[0]?.modelStr})`);
  } else if (strategy === "context-optimized") {
    orderedTargets = sortTargetsByContextSize(orderedTargets);
    log.info("COMBO", `Context-optimized ordering: largest first (${orderedTargets[0]?.modelStr})`);
  }

  // #5923 (Finding #4) — reset-window config for the shared per-target quota-
  // exhaustion cutoff below. The "auto" strategy already applies its own cutoff
  // via buildAutoCandidates/routableCandidates, so this only affects the other
  // 16 strategies (priority, weighted, etc.) that funnel through executeTarget.
  const quotaCutoffResetWindowConfig = resolveResetWindowConfig(config as Record<string, unknown>);

  if (orderedTargets.length === 0) {
    return comboModelNotFoundResponse("Combo has no executable targets");
  }

  let lastError = null;
  let earliestRetryAfter = null;
  let lastStatus = null;
  const startTime = Date.now();
  let globalAttempts = 0;
  let fallbackCount = 0;
  let recordedAttempts = 0;

  for (let i = 0; i < orderedTargets.length; i++) {
    const target = orderedTargets[i];
    const modelStr = target.modelStr;
    const provider = target.provider;
    const profile = await getRuntimeProviderProfile(provider);

    // Pre-check: skip models where all accounts are in cooldown
    if (isModelAvailable) {
      const available = await isModelAvailable(modelStr, target);
      if (!available) {
        log.info("COMBO", `Skipping ${modelStr} (all accounts in cooldown)`);
        if (i > 0) fallbackCount++;
        continue;
      }
    }

    // Retry loop for transient errors
    for (let retry = 0; retry <= maxRetries; retry++) {
      // Fix #1681: Bail out immediately if the client has disconnected
      if (signal?.aborted) {
        log.info("COMBO", `Client disconnected — aborting combo loop before model ${modelStr}`);
        return errorResponse(499, "Client disconnected");
      }
      globalAttempts++;
      if (globalAttempts > MAX_GLOBAL_ATTEMPTS) {
        log.warn(
          "COMBO",
          `Maximum combo attempts (${MAX_GLOBAL_ATTEMPTS}) exceeded across all targets and fallbacks. Terminating loop to prevent runaway background requests.`
        );
        return errorResponse(503, "Maximum combo retry limit reached");
      }
      if (retry > 0) {
        log.info(
          "COMBO",
          `Retrying ${modelStr} in ${retryDelayMs}ms (attempt ${retry + 1}/${maxRetries + 1})`
        );
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, retryDelayMs);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve(undefined);
            },
            { once: true }
          );
        });
        if (signal?.aborted) {
          log.info("COMBO", `Client disconnected during retry delay — aborting`);
          return errorResponse(499, "Client disconnected");
        }
      }

      log.info(
        "COMBO",
        `Trying model ${i + 1}/${orderedTargets.length}: ${modelStr}${retry > 0 ? ` (retry ${retry})` : ""}`
      );

      const result = await handleSingleModelWrapped(body, modelStr, target);

<<<<<<< Updated upstream
      const executeTarget = async (
        i: number
      ): Promise<{ ok: boolean; response?: Response } | null> => {
        const target = orderedTargets[i];
        const modelStr = target.modelStr;
        const rawModel = parseModel(modelStr).model || modelStr;
        const provider = target.provider;

        const cb = getCircuitBreaker(provider);
        if (cb.getStatus().state === "OPEN") {
          log.info("COMBO", `Skipping ${modelStr} — circuit breaker OPEN for ${provider}`);
          if (i > 0) fallbackCount++;
          return null;
        }

        if (
          resilienceSettings.providerCooldown.enabled &&
          Boolean(provider && provider !== "unknown") &&
          isProviderInCooldown(provider, target.connectionId ?? undefined, resilienceSettings)
        ) {
          log.info("COMBO", `Skipping ${modelStr} — provider ${provider} in global cooldown`);
          if (i > 0) fallbackCount++;
          return null;
        }

        // Use pre-screened profile if available, otherwise fetch on demand
        const preScreenEntry = preScreenMap.get(target.executionKey);
        const profile = preScreenEntry?.profile ?? (await getRuntimeProviderProfile(provider));

        const allowRateLimitedConnection =
          Boolean(provider && provider !== "unknown") &&
          transientRateLimitedProviders.has(provider);
        const targetForAttempt = allowRateLimitedConnection
          ? {
              ...target,
              allowRateLimitedConnection: true,
              modelAbortSignal: abortControllers.get(i)!.signal,
            }
          : { ...target, modelAbortSignal: abortControllers.get(i)!.signal };

        // #1731 / #1731v2: skip targets already known-exhausted this request (shared predicate).
        const exhaustedSkip = getExhaustedTargetSkipReason(
          target,
          exhaustedProviders,
          exhaustedConnections
        );
        if (exhaustedSkip) {
          log.info("COMBO", exhaustedSkip);
          if (i > 0) fallbackCount++;
          return null;
        }

        // Pre-check: skip models locked by the resilience system (model-level lockout)
        if (provider && rawModel && isModelLocked(provider, target.connectionId || "", rawModel)) {
          log.info("COMBO", `Skipping ${modelStr} — model locked by resilience (cooldown active)`);
          if (i > 0) fallbackCount++;
          return null;
        }

        // #5923 (Finding #4) — honor the same opt-in quota-exhaustion cutoff the
        // "auto" strategy already applies (buildAutoCandidates), for every other
        // strategy (priority, weighted, etc.). Strictly scoped per (provider,
        // connectionId): a 0%-remaining connection is skipped here, but sibling
        // connections/models on the same provider are untouched — the provider
        // circuit breaker is never touched by this check. The "auto" strategy is
        // excluded to avoid a redundant duplicate fetch — it already filtered its
        // candidate pool via `routableCandidates` before reaching this loop.
        if (strategy !== "auto" && provider && target.connectionId) {
          const quotaCutoff = await resolveQuotaExhaustionCutoffForTarget(
            provider,
            target.connectionId,
            resilienceSettings,
            quotaCutoffResetWindowConfig,
            combo.name,
            log
          );
          if (quotaCutoff.blocked) {
            log.info(
              "COMBO",
              `Skipping ${modelStr} — quota exhaustion cutoff (${quotaCutoff.reason || "quota_exhausted"})`
            );
            if (i > 0) fallbackCount++;
            return null;
          }
        }

        // Pre-screen snapshot is NOT used as a permanent skip — availability
        // is always re-checked via isModelAvailable below because connection
        // cooldowns can expire between setTry retries, making a previously
        // unavailable target available again.  Circuit-breaker-OPEN providers
        // are already caught by the dedicated breaker check above.
        if (isModelAvailable) {
          const available = await isModelAvailable(modelStr, targetForAttempt);
          if (!available) {
            log.debug?.(
              "COMBO",
              `Skipping ${modelStr} — no credentials available or model excluded`
            );
            if (i > 0) fallbackCount++;
            return null;
          }
        }

        // Credential gate: skip targets with known-bad credentials (fail-fast)
        const connectionId = target.connectionId as string | undefined;
        if (connectionId) {
          const gateResult = checkCredentialGate(connectionId, provider, modelStr);
          if (gateResult.allowed === false) {
            logCredentialSkip(log, modelStr, gateResult.reason || "Credential gate blocked");
            if (i > 0) fallbackCount++;
            return null;
          }
        }

        // Retry loop for transient errors
        for (let retry = 0; retry <= maxRetries; retry++) {
          // Fix #1681: Bail out immediately if the client has disconnected
          if (signal?.aborted) {
            log.info("COMBO", `Client disconnected — aborting combo loop before model ${modelStr}`);
            return { ok: false, response: errorResponse(499, "Client disconnected") };
          }
          globalAttempts++;
          if (globalAttempts > MAX_GLOBAL_ATTEMPTS) {
            log.warn(
              "COMBO",
              `Maximum combo attempts (${MAX_GLOBAL_ATTEMPTS}) exceeded across all targets and fallbacks. Terminating loop to prevent runaway background requests.`
            );
            return { ok: false, response: errorResponse(503, "Maximum combo retry limit reached") };
          }

          // Predictive TTFT Circuit Breaker (skip slow models)
          if (
            zeroLatencyOptimizationsEnabled &&
            config.predictiveTtftMs &&
            config.predictiveTtftMs > 0 &&
            retry === 0
          ) {
            const cMetrics = getComboMetrics(combo.name);
            if (cMetrics) {
              const targetKey = orderedTargets[i].executionKey || modelStr;
              const m = cMetrics.byTarget[targetKey] || cMetrics.byModel[modelStr];
              if (shouldSkipForPredictedTtft(m, config.predictiveTtftMs)) {
                log.warn(
                  "COMBO",
                  `Predictive TTFT Circuit Breaker: skipping ${modelStr} (avg ${m.avgLatencyMs}ms > max ${config.predictiveTtftMs}ms)`
                );
                return null;
              }
            }
          }

          if (retry > 0) {
            log.info(
              "COMBO",
              `Retrying ${modelStr} in ${retryDelayMs}ms (attempt ${retry + 1}/${maxRetries + 1})`
            );
            await new Promise((resolve) => {
              const timer = setTimeout(resolve, retryDelayMs);
              signal?.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  resolve(undefined);
                },
                { once: true }
              );
            });
            if (signal?.aborted) {
              log.info("COMBO", `Client disconnected during retry delay — aborting`);
              return { ok: false, response: errorResponse(499, "Client disconnected") };
            }
          }

          log.info(
=======
      // Success — validate response quality before returning
      if (result.ok) {
        const quality = await validateResponseQuality(result, clientRequestedStream, log);
        if (!quality.valid) {
          const qualityFailureReason = `Upstream response failed quality validation: ${quality.reason}`;
          log.warn(
>>>>>>> Stashed changes
            "COMBO",
            `Model ${modelStr} returned 200 but failed quality check: ${quality.reason}`
          );
<<<<<<< Updated upstream
          emit("combo.target.attempt", {
            comboName: combo.name,
            targetIndex: i,
            provider,
            model: modelStr,
            timestamp: Date.now(),
            strategy,
          });

          // Deep clone the body to ensure context preservation and prevent mutations
          // from affecting other targets in the combo. structuredClone avoids the
          // full intermediate JSON string that JSON.parse(JSON.stringify(...)) builds
          // (a second multi-hundred-KB allocation per target on large agent payloads),
          // halving the per-target transient heap on the hot path (#5152).
          let attemptBody = structuredClone(body);

          // Proactive Context Compression for fallbacks (Zero-Latency optimization)
          if (
            zeroLatencyOptimizationsEnabled &&
            i > 0 &&
            config.fallbackCompressionMode &&
            config.fallbackCompressionMode !== "off"
          ) {
            const { estimateTokens } = await import("./contextManager.ts");
            const estimatedTokens = estimateTokens(JSON.stringify(attemptBody));
            if (estimatedTokens > (config.fallbackCompressionThreshold ?? 1000)) {
              const { applyCompression } = await import("./compression/strategySelector.ts");
              const compressionResult = applyCompression(
                attemptBody,
                config.fallbackCompressionMode as CompressionMode,
                // Opt into the TV1 bail-out so a throwing fallback engine is SKIPPED rather than
                // propagating out of executeTarget and being swallowed as a "Speculative task
                // error" (which silently drops this combo target). minGainPercent:0 keeps the
                // advance behavior identical to the default path — this only adds skip-on-throw.
                { model: modelStr, bailout: { enabled: true, minGainPercent: 0 } }
              );
              if (compressionResult.compressed) {
                log.info(
                  "COMBO",
                  `Proactive fallback compression applied (${config.fallbackCompressionMode}): ${estimatedTokens} -> ${compressionResult.stats?.compressedTokens} tokens`
                );
                attemptBody = compressionResult.body;
              }
            }
          }

          // Universal handoff: inject existing handoff if model changed
          if (
            universalHandoffConfig.enabled &&
            relayOptions?.sessionId &&
            !(body as Record<string, unknown>)?.[SKIP_UNIVERSAL_HANDOFF_FLAG]
          ) {
            const lastModel = getLastSessionModel(relayOptions.sessionId, combo.name);
            if (lastModel && lastModel !== modelStr) {
              const existingHandoff = getHandoff(relayOptions.sessionId, combo.name);
              attemptBody = injectUniversalHandoffBody(
                attemptBody, // Use the cloned body to maintain isolation
                lastModel,
                modelStr,
                `Model routing: ${lastModel} → ${modelStr}`,
                existingHandoff
              );
            }
          }

          // Issue #3587: Reasoning models can spend the whole output budget on
          // reasoning. Only add headroom when the complete buffer fits inside the
          // model's known output cap; otherwise preserve the client's explicit limit.
          {
            const bodyRecord = attemptBody as Record<string, unknown>;
            const currentMaxTokens = toPositiveInteger(bodyRecord.max_tokens);
            const bufferedMaxTokens = resolveReasoningBufferedMaxTokens(
              modelStr,
              bodyRecord.max_tokens,
              { enabled: reasoningTokenBufferEnabled }
            );
            if (currentMaxTokens !== null && bufferedMaxTokens !== null) {
              bodyRecord.max_tokens = bufferedMaxTokens;
              if (bufferedMaxTokens !== currentMaxTokens) {
                log.info(
                  "COMBO",
                  `Reasoning model ${modelStr}: adjusted max_tokens ${currentMaxTokens} -> ${bufferedMaxTokens}`
                );
              }
            }
          }
          const result = await handleSingleModelWithTimeout(attemptBody, modelStr, {
            ...targetForAttempt,
            effectiveComboStrategy: strategy,
            failoverBeforeRetry: config.failoverBeforeRetry,
          });

          // Success — validate response quality before returning
          if (result.ok) {
            const selectedConnectionId =
              result.headers?.get("X-OmniRoute-Selected-Connection-Id") ||
              result.headers?.get("x-omniroute-selected-connection-id") ||
              undefined;
            const effectiveConnectionId = selectedConnectionId || target.connectionId || "";

            const quality = await validateResponseQuality(
              result,
              clientRequestedStream,
              log,
              config.responseValidation
            );
            if (!quality.valid) {
              log.warn(
                "COMBO",
                `Model ${modelStr} returned 200 but failed quality check: ${quality.reason}`
              );
              recordComboRequest(combo.name, modelStr, {
                success: false,
                latencyMs: Date.now() - startTime,
                fallbackCount,
                strategy,
                target: toRecordedTarget(target),
              });
              recordedAttempts++;
              // Fix #1707: Set terminal state so the fallback doesn't emit
              // misleading ALL_ACCOUNTS_INACTIVE when the real issue is quality.
              lastError = `Upstream response failed quality validation: ${quality.reason}`;
              if (!lastStatus) lastStatus = 502;
              if (i > 0) fallbackCount++;
              if (provider && rawModel) {
                const mlSettings = resolveModelLockoutSettings(settings);
                if (mlSettings.enabled && mlSettings.errorCodes.includes(502)) {
                  recordModelLockoutFailure(
                    provider,
                    target.connectionId || "",
                    rawModel,
                    "quality_failure",
                    502,
                    mlSettings.baseCooldownMs,
                    profile,
                    {
                      exactCooldownMs: mlSettings.useExponentialBackoff
                        ? 0
                        : mlSettings.baseCooldownMs,
                      maxCooldownMs: mlSettings.maxCooldownMs,
                    }
                  );
                }
              }
              emit("combo.target.failed", {
                comboName: combo.name,
                targetIndex: i,
                provider,
                model: modelStr,
                error: `Quality: ${quality.reason}`,
                latencyMs: Date.now() - startTime,
              });
              return null;
            }

            // Success decay: a healthy response walks the model's lockout failure
            // count back down (and eventually clears an expired lockout entirely).
            if (provider && rawModel) {
              const dcResult = decayModelFailureCount(provider, effectiveConnectionId, rawModel);
              if (dcResult.cleared) {
                log.info("COMBO", `Model ${modelStr} fully recovered — lockout cleared`);
              } else if (dcResult.newFailureCount > 0) {
                log.debug(
                  "COMBO",
                  `Model ${modelStr} decayed to failureCount=${dcResult.newFailureCount}`
                );
              }
            }

            const latencyMs = Date.now() - startTime;
            emit("combo.target.succeeded", {
              comboName: combo.name,
              targetIndex: i,
              provider,
              model: modelStr,
              latencyMs,
            });
            log.info(
              "COMBO",
              `Model ${modelStr} succeeded (${latencyMs}ms, ${fallbackCount} fallbacks)`
            );
            recordComboRequest(combo.name, modelStr, {
              success: true,
              latencyMs,
              fallbackCount,
              strategy,
              target: toRecordedTarget(target),
            });
            recordedAttempts++;

            // Reset cooldown on success
            if (provider && provider !== "unknown") {
              recordProviderSuccess(provider, effectiveConnectionId || undefined);
            }
            if (strategy === "weighted" && stickyWeightedLimit > 1) {
              const stickySuccessKey = getWeightedStepKeyForTarget(target);
              if (stickySuccessKey) {
                recordStickyWeightedSuccess(combo.name, stickySuccessKey, stickyWeightedLimit);
              }
            }
            // Webhook fan-out: best-effort, never blocks the response stream.
            notifyWebhookEvent("request.completed", {
              combo: combo.name,
              provider,
              model: modelStr,
              account:
                typeof target.label === "string" && target.label.trim().length > 0
                  ? target.label.trim()
                  : "",
              accountId: effectiveConnectionId ?? "",
              latencyMs,
              fallbackCount,
            });

            // Context cache pinning: record model usage for session-based pinning
            // (independent of universal handoff — always fires when context_cache_protection is on)
            // #3825: write under the SAME effectiveSessionId used by the read site so a
            // sessionless conversation re-pins to this model on its next turn.
            if (
              combo.context_cache_protection &&
              effectiveSessionId &&
              !(body as Record<string, unknown>)?.[SKIP_UNIVERSAL_HANDOFF_FLAG]
            ) {
              recordSessionModelUsage(
                effectiveSessionId,
                combo.name,
                modelStr,
                provider,
                target.connectionId ?? undefined
              );
            }

            // Universal handoff: record model usage for session
            if (
              universalHandoffConfig.enabled &&
              relayOptions?.sessionId &&
              !(body as Record<string, unknown>)?.[SKIP_UNIVERSAL_HANDOFF_FLAG]
            ) {
              const prevModel = getLastSessionModel(relayOptions.sessionId, combo.name);
              recordSessionModelUsage(
                relayOptions.sessionId,
                combo.name,
                modelStr,
                provider,
                target.connectionId ?? undefined
              );
              if (prevModel && prevModel !== modelStr) {
                const handoffSourceMessages =
                  Array.isArray(body?.messages) && body.messages.length > 0
                    ? body.messages
                    : Array.isArray(body?.input)
                      ? body.input
                      : [];

                maybeGenerateUniversalHandoff({
                  sessionId: relayOptions.sessionId,
                  comboName: combo.name,
                  messages: handoffSourceMessages as MessageLike[],
                  prevModel,
                  currModel: modelStr,
                  universalConfig: universalHandoffConfig,
                  handleSingleModel: handleSingleModelWithTimeout,
                });
              }

              recordSessionModelUsage(
                relayOptions.sessionId,
                combo.name,
                modelStr,
                provider,
                target.connectionId ?? undefined
              );
            }
            // Context-relay intentionally splits responsibilities:
            // combo.ts decides whether a successful turn should generate a handoff,
            // while chat.ts injects the handoff after the real connectionId is resolved.
            if (
              strategy === "context-relay" &&
              relayOptions?.sessionId &&
              relayConfig &&
              relayConfig.handoffProviders.includes(provider) &&
              provider === "codex"
            ) {
              const connectionId = getSessionConnection(relayOptions.sessionId);
              if (connectionId) {
                const quotaInfo = await fetchCodexQuota(connectionId).catch(() => null);
                if (quotaInfo) {
                  const resetCandidates = [
                    quotaInfo.windows?.session?.resetAt,
                    quotaInfo.windows?.weekly?.resetAt,
                    quotaInfo.resetAt,
                  ]
                    .filter(
                      (value): value is string => typeof value === "string" && value.length > 0
                    )
                    .sort((a, b) => a.localeCompare(b));
                  const handoffSourceMessages =
                    Array.isArray(body?.messages) && body.messages.length > 0
                      ? body.messages
                      : Array.isArray(body?.input)
                        ? body.input
                        : [];

                  maybeGenerateHandoff({
                    sessionId: relayOptions.sessionId,
                    comboName: combo.name,
                    connectionId,
                    percentUsed: quotaInfo.percentUsed,
                    messages: handoffSourceMessages,
                    model: modelStr,
                    expiresAt: resetCandidates[0] || null,
                    config: relayConfig,
                    handleSingleModel: handleSingleModelWithTimeout,
                  });
                }
              }
            }
            if (_sticky.messageHash && target.connectionId)
              recordStickyBinding(_sticky.messageHash, target.connectionId); // LKGP (#919):
            if (provider) {
              const connId = effectiveConnectionId || undefined;
              void (async () => {
                try {
                  const { setLKGP } = await import("../../src/lib/localDb");
                  await Promise.all([
                    setLKGP(combo.name, target.executionKey, provider, connId),
                    setLKGP(combo.name, combo.id || combo.name, provider, connId),
                  ]);
                } catch (err) {
                  log.warn(
                    "COMBO",
                    "Failed to record Last Known Good Provider. This is non-fatal.",
                    {
                      err,
                    }
                  );
                }
              })();
            }

            return { ok: true, response: quality.clonedResponse ?? result };
          }

          // Extract error info from response
          let errorText = result.statusText || "";
          let errorBody: ComboErrorBody = null;
          let retryAfter: ComboRetryAfter | null = null;
          try {
            const cloned = result.clone();
            try {
              const text = await cloned.text();
              if (text) {
                errorText = text.substring(0, 500);
                errorBody = JSON.parse(text);
                const parsedError = errorBody?.error;
                errorText =
                  (typeof parsedError === "object" && parsedError?.message) ||
                  (typeof parsedError === "string" ? parsedError : null) ||
                  errorBody?.message ||
                  errorText;
                retryAfter = errorBody?.retryAfter || null;
              }
            } catch {
              /* Clone parse failed */
            }
          } catch {
            /* Clone failed */
          }

          // Track earliest retryAfter
          if (
            retryAfter &&
            (!earliestRetryAfter || new Date(retryAfter) < new Date(earliestRetryAfter))
          ) {
            earliestRetryAfter = retryAfter;
          }

          // Normalize error text
          if (typeof errorText !== "string") {
            try {
              errorText = JSON.stringify(errorText);
            } catch {
              errorText = String(errorText);
            }
          }

          const isStreamReadinessFailure =
            (result.status === 502 || result.status === 504) &&
            isStreamReadinessFailureErrorBody(errorBody);

          // FIX 5: a local per-API-key token-limit 429 must not cool shared accounts.
          const isTokenLimitBreach =
            result.status === 429 && isTokenLimitBreachErrorBody(errorBody);

          // Fix #1681: Status 499 means client disconnected — stop combo loop immediately.
          // There is no point trying fallback models when nobody is listening.
          if (result.status === 499) {
            log.info("COMBO", `Client disconnected (499) during ${modelStr} — stopping combo loop`);
            recordComboRequest(combo.name, modelStr, {
              success: false,
              latencyMs: Date.now() - startTime,
              fallbackCount,
              strategy,
              target: toRecordedTarget(target),
            });
            recordedAttempts++;
            // executeTarget must return the {ok,response} contract — a raw Response
            // here makes the speculative loop's res.ok/res.response checks both miss,
            // so the combo would wrongly fall through to the next model after a 499.
            return { ok: false, response: result };
          }

          // Combo fallback is target-level orchestration: a non-ok target response is
          // treated as local to that target and the combo continues to the next target.
          // Error classification is retained only for retry/cooldown pacing; it must
          // not decide whether fallback happens, including for generic 400 responses.
          const rawError = errorBody?.error;
          const structuredError =
            rawError && typeof rawError === "object"
              ? {
                  // Upstream JSON may carry a numeric `code`/`type` (e.g. {"code":40001}).
                  // Coerce to string if present instead of discarding, so downstream string
                  // ops (.toLowerCase, .startsWith) can run safely without type crashes.
                  code:
                    (rawError as Record<string, unknown>).code !== undefined &&
                    (rawError as Record<string, unknown>).code !== null
                      ? String((rawError as Record<string, unknown>).code)
                      : undefined,
                  type:
                    (rawError as Record<string, unknown>).type !== undefined &&
                    (rawError as Record<string, unknown>).type !== null
                      ? String((rawError as Record<string, unknown>).type)
                      : undefined,
                }
              : undefined;
          const fallbackResult = checkFallbackError(
            result.status,
            errorText,
            0,
            null,
            provider,
            result.headers,
            profile,
            structuredError
          );
          const { cooldownMs } = fallbackResult;
          const selectedConnectionId =
            result.headers?.get("X-OmniRoute-Selected-Connection-Id") ||
            result.headers?.get("x-omniroute-selected-connection-id") ||
            undefined;
          const targetWithConnection = selectedConnectionId
            ? { ...target, connectionId: selectedConnectionId }
            : target;

          // #1731 / #1731v2: classify the upstream error and update the exhaustion sets
          // (shared with handleRoundRobinCombo). Returns whether the provider is fully exhausted.
          const providerExhausted = applyComboTargetExhaustion(targetWithConnection, {
            result,
            fallbackResult,
            errorText,
            rawModel,
            isTokenLimitBreach,
            allAccountsRateLimited: false,
            sets: { exhaustedProviders, exhaustedConnections, transientRateLimitedProviders },
            log,
            tag: "COMBO",
            exhaustedLogLevel: "info",
            structuredError,
          });

          // #2101: Prevent infinite fallback loops with 400 Bad Request errors that are genuinely
          // body-specific (malformed JSON, bad format, missing required fields).
          // Context overflow and parameter validation errors are NOT body-specific:
          // - Context overflow: different models have different context windows
          // - Max_tokens / param errors: different models have different output limits
          // - Model access denied: different providers serve different model sets
          // These should fall through so the next combo target can try.
          if (
            result.status === 400 &&
            fallbackResult.shouldFallback &&
            !isContextOverflow400(errorText) &&
            !isParamValidation400(errorText) &&
            (errorText.toLowerCase().includes("context") ||
              errorText.toLowerCase().includes("prompt") ||
              errorText.toLowerCase().includes("token") ||
              errorText.toLowerCase().includes("malformed") ||
              errorText.toLowerCase().includes("invalid") ||
              errorText.toLowerCase().includes("bad request"))
          ) {
            log.warn(
              "COMBO",
              `400 Bad Request with body-specific error detected on ${modelStr} — skipping fallback to other targets to prevent infinite loop`
            );
            // Record the failure and break to avoid trying other targets with the same bad request
            recordComboRequest(combo.name, modelStr, {
              success: false,
              latencyMs: Date.now() - startTime,
              fallbackCount,
              strategy,
              target: toRecordedTarget(target),
            });
            recordedAttempts++;
            lastError = errorText || String(result.status);
            if (!lastStatus) lastStatus = result.status;
            if (i > 0) fallbackCount++;
            log.warn("COMBO", `Model ${modelStr} failed with body-specific error, stopping combo`);
            // #4279: surface the 400 via the {ok,response} contract so the OUTER
            // target loop resolves the combo and stops. A bare `break` here only
            // exits the inner retry loop; executeTarget then returns null, which
            // the outer loop treats as "this target produced nothing" and advances
            // to the next model — so the guard failed to stop fallback and a combo
            // of N body-rejecting targets tried all N. Mirrors the 499 path above.
            return { ok: false, response: result };
          }

          // Trigger shared provider circuit breaker for 5xx errors and connection failures.
          // If the next target in the combo is on the same provider, don't mark the provider
          // as failed — different models on the same provider may still succeed.
          // G-02: when fallbackResult.skipProviderBreaker is set (embedded service supervisor
          // outage signalled via X-Omni-Fallback-Hint: connection_cooldown) apply connection
          // cooldown only — do NOT trip the whole-provider breaker.
          const nextTarget = orderedTargets[i + 1];
          const sameProviderNext =
            typeof nextTarget?.provider === "string" && nextTarget.provider === provider;
          if (
            shouldRecordProviderBreakerFailure({
              isStreamReadinessFailure,
              status: result.status,
              sameProviderNext,
              skipProviderBreaker: fallbackResult.skipProviderBreaker,
            })
          ) {
            recordProviderFailure(provider, log, targetWithConnection.connectionId, profile);
          }

          // Check if this is a transient error worth retrying on same model.
          // A token-limit 429 is terminal for the client — never retry it.
          const isTransient =
            !isStreamReadinessFailure &&
            !isTokenLimitBreach &&
            [408, 429, 500, 502, 503, 504].includes(result.status);
          if (retry < maxRetries && isTransient && !providerExhausted) {
            if (
              provider &&
              rawModel &&
              isModelLocked(provider, targetWithConnection.connectionId || "", rawModel)
            ) {
              log.info("COMBO", `Skipping retry for ${modelStr} — model lockout active`);
              if (i > 0) fallbackCount++;
              return null;
            }
            // Record model lockout immediately on the first transient failure —
            // once the model is cooling down, retrying it would waste an upstream
            // call and extend the cooldown via exponential backoff.
            let lockoutRecorded = false;
            if (provider && rawModel && retry === 0) {
              const mlSettings = resolveModelLockoutSettings(settings);
              if (mlSettings.enabled && mlSettings.errorCodes.includes(result.status)) {
                recordModelLockoutFailure(
                  provider,
                  targetWithConnection.connectionId || "",
                  rawModel,
                  classifyLockoutReason(result.status),
                  result.status,
                  mlSettings.baseCooldownMs,
                  profile,
                  {
                    // #1308: honor a long upstream reset (e.g. "Resets in 160h") over
                    // the short base cooldown / exponential backoff when present.
                    exactCooldownMs: selectLockoutCooldownMs(cooldownMs, mlSettings),
                    maxCooldownMs: mlSettings.maxCooldownMs,
                  }
                );
                lockoutRecorded = true;
              }
            }
            if (lockoutRecorded) {
              log.info("COMBO", `Skipping retry for ${modelStr} — model lockout active`);
              if (i > 0) fallbackCount++;
              return null;
            }
            continue; // Retry same model (transient error, no lockout recorded)
          }

          // Done retrying this model
=======
>>>>>>> Stashed changes
          recordComboRequest(combo.name, modelStr, {
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackCount,
            strategy,
            target: toRecordedTarget(target),
          });
          recordedAttempts++;
          // Fix #1707: Set terminal state so the fallback doesn't emit
          // misleading ALL_ACCOUNTS_INACTIVE when the real issue is quality.
          lastError = `Upstream response failed quality validation: ${quality.reason}`;
          if (!lastStatus) lastStatus = 502;
          if (i > 0) fallbackCount++;
          break; // move to next model
        }
        const latencyMs = Date.now() - startTime;
        log.info(
          "COMBO",
          `Model ${modelStr} succeeded (${latencyMs}ms, ${fallbackCount} fallbacks)`
        );
        recordComboRequest(combo.name, modelStr, {
          success: true,
          latencyMs,
          fallbackCount,
          strategy,
          target: toRecordedTarget(target),
        });
        recordedAttempts++;

        // Context-relay intentionally splits responsibilities:
        // combo.ts decides whether a successful turn should generate a handoff,
        // while chat.ts injects the handoff after the real connectionId is resolved.
        if (
          strategy === "context-relay" &&
          relayOptions?.sessionId &&
          relayConfig &&
          relayConfig.handoffProviders.includes(provider) &&
          provider === "codex"
        ) {
          const connectionId = getSessionConnection(relayOptions.sessionId);
          if (connectionId) {
            const quotaInfo = await fetchCodexQuota(connectionId).catch(() => null);
            if (quotaInfo) {
              const resetCandidates = [quotaInfo.window5h?.resetAt, quotaInfo.window7d?.resetAt]
                .filter((value): value is string => typeof value === "string" && value.length > 0)
                .sort();
              const handoffSourceMessages =
                Array.isArray(body?.messages) && body.messages.length > 0
                  ? body.messages
                  : Array.isArray(body?.input)
                    ? body.input
                    : [];

              maybeGenerateHandoff({
                sessionId: relayOptions.sessionId,
                comboName: combo.name,
                connectionId,
                percentUsed: quotaInfo.percentUsed,
                messages: handoffSourceMessages,
                model: modelStr,
                expiresAt: resetCandidates[0] || null,
                config: relayConfig,
                handleSingleModel: handleSingleModelWrapped,
              });
            }
          }
        }

        // Record last known good provider (LKGP) for this combo/model (#919)
        if (provider) {
          try {
            const { setLKGP } = await import("../../src/lib/localDb");
            await Promise.all([
              setLKGP(combo.name, target.executionKey, provider),
              setLKGP(combo.name, combo.id || combo.name, provider),
            ]);
          } catch (err) {
            log.warn("COMBO", "Failed to record Last Known Good Provider. This is non-fatal.", {
              err,
            });
          }
        }

        return quality.clonedResponse ?? result;
      }

      // Extract error info from response
      let errorText = result.statusText || "";
      let errorBody = null;
      let retryAfter = null;
      try {
        const cloned = result.clone();
        try {
          const text = await cloned.text();
          if (text) {
            errorText = text.substring(0, 500);
            errorBody = JSON.parse(text);
            errorText =
              errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
            retryAfter = errorBody?.retryAfter || null;
          }
        } catch {
          /* Clone parse failed */
        }
      } catch {
        /* Clone failed */
      }

      // Track earliest retryAfter
      if (
        retryAfter &&
        (!earliestRetryAfter || new Date(retryAfter) < new Date(earliestRetryAfter))
      ) {
        earliestRetryAfter = retryAfter;
      }

      // Normalize error text
      if (typeof errorText !== "string") {
        try {
          errorText = JSON.stringify(errorText);
        } catch {
          errorText = String(errorText);
        }
      }

      const isStreamReadinessTimeout =
        result.status === 504 && isStreamReadinessTimeoutErrorBody(errorBody);

      // Fix #1681: Status 499 means client disconnected — stop combo loop immediately.
      // There is no point trying fallback models when nobody is listening.
      if (result.status === 499) {
        log.info("COMBO", `Client disconnected (499) during ${modelStr} — stopping combo loop`);
        recordComboRequest(combo.name, modelStr, {
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackCount,
          strategy,
          target: toRecordedTarget(target),
        });
        recordedAttempts++;
        return result;
      }

      // Combo fallback is target-level orchestration: a non-ok target response is
      // treated as local to that target and the combo continues to the next target.
      // Error classification is retained only for retry/cooldown pacing; it must
      // not decide whether fallback happens, including for generic 400 responses.
      const { cooldownMs } = checkFallbackError(
        result.status,
        errorText,
        0,
        null,
        provider,
        result.headers,
        profile
      );

      // Trigger shared provider circuit breaker for 5xx errors and connection failures
      if (isProviderFailureCode(result.status)) {
        recordProviderFailure(provider, log);
      }

      // Check if this is a transient error worth retrying on same model
      const isTransient =
        !isStreamReadinessTimeout && [408, 429, 500, 502, 503, 504].includes(result.status);
      if (retry < maxRetries && isTransient) {
        continue; // Retry same model
      }

      // Done retrying this model
      recordComboRequest(combo.name, modelStr, {
        success: false,
        latencyMs: Date.now() - startTime,
        fallbackCount,
        strategy,
        target: toRecordedTarget(target),
      });
      recordedAttempts++;
      lastError = errorText || String(result.status);
      if (!lastStatus) lastStatus = result.status;
      if (i > 0) fallbackCount++;
      log.warn("COMBO", `Model ${modelStr} failed, trying next`, { status: result.status });

      const fallbackWaitMs =
        retryDelayMs > 0 && cooldownMs > 0 && cooldownMs <= MAX_FALLBACK_WAIT_MS
          ? Math.min(cooldownMs, retryDelayMs)
          : 0;
      if ([502, 503, 504].includes(result.status) && fallbackWaitMs > 0) {
        log.info("COMBO", `Waiting ${fallbackWaitMs}ms before fallback to next model`);
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, fallbackWaitMs);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve(undefined);
            },
            { once: true }
          );
        });
        if (signal?.aborted) {
          log.info("COMBO", `Client disconnected during fallback wait — aborting`);
          return errorResponse(499, "Client disconnected");
        }
      }

      break; // Move to next model
    }
  }

  // All models failed
  const latencyMs = Date.now() - startTime;
  if (recordedAttempts === 0) {
    recordComboRequest(combo.name, null, { success: false, latencyMs, fallbackCount, strategy });
  }

  if (!lastStatus) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Service temporarily unavailable: all upstream accounts are inactive",
          type: "service_unavailable",
          code: "ALL_ACCOUNTS_INACTIVE",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const status = lastStatus;
  const msg = lastError || "All combo models unavailable";

  if (earliestRetryAfter) {
    const retryHuman = formatRetryAfter(earliestRetryAfter);
    log.warn("COMBO", `All models failed | ${msg} (${retryHuman})`);
    return unavailableResponse(status, msg, earliestRetryAfter, retryHuman);
  }

  log.warn("COMBO", `All models failed | ${msg}`);
  return new Response(JSON.stringify({ error: { message: msg } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Handle round-robin combo: each request goes to the next model in circular order.
 * Uses semaphore-based concurrency control with queue + rate-limit awareness.
 *
 * Flow:
 * 1. Pick target model via atomic counter (counter % models.length)
 * 2. Acquire semaphore slot (may queue if at max concurrency)
 * 3. Send request to target model
 * 4. On 429 → mark model rate-limited, try next model in rotation
 * 5. On semaphore timeout → fallback to next available model
 */
async function handleRoundRobinCombo({
  body,
  combo,
  handleSingleModel,
  isModelAvailable,
  log,
  settings,
  allCombos,
  signal,
}) {
  const config = settings
    ? resolveComboConfig(combo, settings)
    : { ...getDefaultComboConfig(), ...(combo.config || {}) };
  const concurrency = config.concurrencyPerModel ?? 3;
  const queueTimeout = config.queueTimeoutMs ?? 30000;
  const maxRetries = config.maxRetries ?? 1;
  const retryDelayMs = config.retryDelayMs ?? 2000;

  const orderedTargets = resolveComboTargets(combo, allCombos);
  const filteredTargets = await applyRequestTagRouting(orderedTargets, body, log);
  const modelCount = filteredTargets.length;
  if (modelCount === 0) {
    return comboModelNotFoundResponse("Round-robin combo has no executable targets");
  }

  // Get and increment atomic counter
  const counter = rrCounters.get(combo.name) || 0;
  rrCounters.set(combo.name, counter + 1);
  const startIndex = counter % modelCount;

  // #3825: per-conversation session stickiness for round-robin. weighted/priority honor a
  // sticky connection via applySessionStickiness, but this RR handler returns before that
  // call — so sessionless RR combos rotated every turn, busting the upstream prompt-cache.
  // Reuse the SAME mechanism: start the rotation at the conversation's sticky connection
  // (the loop still falls through to the other targets on failure → failover preserved).
  const _rrSessionSticky = await applySessionStickiness(
    filteredTargets,
    body?.messages as Array<{ role?: string; content?: unknown }>
  );
  let rrStartIndex = startIndex;
  if (_rrSessionSticky.stuck) {
    const stickyIdx = filteredTargets.findIndex(
      (t) => t.connectionId === _rrSessionSticky.targets[0]?.connectionId
    );
    if (stickyIdx >= 0) rrStartIndex = stickyIdx;
  }

  const clientRequestedStream = body?.stream === true;
  const startTime = Date.now();
  let lastError = null;
  let lastStatus = null;
  let earliestRetryAfter = null;
  let globalAttempts = 0;
  let fallbackCount = 0;
  let recordedAttempts = 0;

  // Try each model starting from the round-robin target
  for (let offset = 0; offset < modelCount; offset++) {
    const modelIndex = (rrStartIndex + offset) % modelCount;
    const target = filteredTargets[modelIndex];
    const modelStr = target.modelStr;
    const provider = target.provider;
    const profile = await getRuntimeProviderProfile(provider);
    const semaphoreKey = `combo:${combo.name}:${target.executionKey}`;

    // Pre-check availability
    if (isModelAvailable) {
      const available = await isModelAvailable(modelStr, target);
      if (!available) {
        log.info("COMBO-RR", `Skipping ${modelStr} (all accounts in cooldown)`);
        if (offset > 0) fallbackCount++;
        continue;
      }
    }

    // Acquire semaphore slot (may wait in queue)
    let release;
    try {
      release = await semaphore.acquire(semaphoreKey, {
        maxConcurrency: concurrency,
        timeoutMs: queueTimeout,
      });
    } catch (err) {
      if (err.code === "SEMAPHORE_TIMEOUT") {
        log.warn("COMBO-RR", `Semaphore timeout for ${modelStr}, trying next model`);
        if (offset > 0) fallbackCount++;
        continue;
      }
      throw err;
    }

    // Retry loop within this model
    try {
      for (let retry = 0; retry <= maxRetries; retry++) {
        globalAttempts++;
        if (globalAttempts > MAX_GLOBAL_ATTEMPTS) {
          log.warn(
            "COMBO-RR",
            `Maximum combo attempts (${MAX_GLOBAL_ATTEMPTS}) exceeded. Terminating loop to prevent runaway requests.`
          );
          return errorResponse(503, "Maximum combo retry limit reached");
        }
        if (retry > 0) {
          log.info(
            "COMBO-RR",
            `Retrying ${modelStr} in ${retryDelayMs}ms (attempt ${retry + 1}/${maxRetries + 1})`
          );
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }

        log.info(
          "COMBO-RR",
          `[RR #${counter}] → ${modelStr}${offset > 0 ? ` (fallback +${offset})` : ""}${retry > 0 ? ` (retry ${retry})` : ""}`
        );

        const result = await handleSingleModel(body, modelStr, target);

        // Success — validate response quality before returning
        if (result.ok) {
          const quality = await validateResponseQuality(
            result,
            clientRequestedStream,
            log,
            config.responseValidation
          );
          if (!quality.valid) {
            const qualityFailureReason = `Upstream response failed quality validation: ${quality.reason}`;
            log.warn(
              "COMBO-RR",
              `${modelStr} returned 200 but failed quality check: ${quality.reason}`
            );
            recordComboRequest(combo.name, modelStr, {
              success: false,
              latencyMs: Date.now() - startTime,
              fallbackCount,
              strategy: "round-robin",
              target: toRecordedTarget(target),
            });
            recordedAttempts++;
            // Fix #1707: Set terminal state so the fallback doesn't emit
            // misleading ALL_ACCOUNTS_INACTIVE when the real issue is quality.
            lastError = `Upstream response failed quality validation: ${quality.reason}`;
            if (!lastStatus) lastStatus = 502;
            if (offset > 0) fallbackCount++;
            break; // move to next model
          }
          const latencyMs = Date.now() - startTime;
          log.info(
            "COMBO-RR",
            `${modelStr} succeeded (${latencyMs}ms, ${fallbackCount} fallbacks)`
          );
          recordComboRequest(combo.name, modelStr, {
            success: true,
            latencyMs,
            fallbackCount,
            strategy: "round-robin",
            target: toRecordedTarget(target),
          });
          recordedAttempts++;
          if (provider) {
            try {
              const { setLKGP } = await import("../../src/lib/localDb");
              await Promise.all([
                setLKGP(combo.name, target.executionKey, provider),
                setLKGP(combo.name, combo.id || combo.name, provider),
              ]);
            } catch (err) {
              log.warn(
                "COMBO-RR",
                "Failed to record Last Known Good Provider. This is non-fatal.",
                {
                  err,
                }
              );
            }
          }
<<<<<<< Updated upstream

          if (provider && provider !== "unknown") {
            recordProviderSuccess(provider, effectiveConnectionId || undefined);
          }

          if (stickyRoundRobinEnabled) {
            recordStickyRoundRobinSuccess(combo.name, target, stickyLimit, filteredTargets);
          }

          // #3825: (re)record the sticky binding so the next turn re-pins (prompt-cache).
          if (_rrSessionSticky.messageHash) {
            const stickyConn = effectiveConnectionId || target.connectionId;
            if (stickyConn) recordStickyBinding(_rrSessionSticky.messageHash, stickyConn);
          }

          if (provider) {
            const connId = effectiveConnectionId || undefined;
            void (async () => {
              try {
                const { setLKGP } = await import("../../src/lib/localDb");
                await Promise.all([
                  setLKGP(combo.name, target.executionKey, provider, connId),
                  setLKGP(combo.name, combo.id || combo.name, provider, connId),
                ]);
              } catch (err) {
                log.warn(
                  "COMBO-RR",
                  "Failed to record Last Known Good Provider. This is non-fatal.",
                  {
                    err,
                  }
                );
              }
            })();
          }
          // validateResponseQuality peeks streaming bodies via getReader(),
          // which locks `result.body`. It returns a clonedResponse that replays
          // the buffered prefix and forwards the rest. Returning the original
          // (now-locked) `result` makes Next.js throw "ReadableStream is locked"
          // → 500. Mirror the priority strategy and return the replay response.
          return quality.clonedResponse ?? result;
=======
          return result;
>>>>>>> Stashed changes
        }

        // Extract error info
        let errorText = result.statusText || "";
        let retryAfter = null;
        let errorBody: {
          error?: { code?: string | null; message?: string | null } | string;
          message?: string | null;
          retryAfter?: number | string | null;
        } | null = null;
        try {
          const cloned = result.clone();
          try {
            const text = await cloned.text();
            if (text) {
              errorText = text.substring(0, 500);
              errorBody = JSON.parse(text);
              errorText =
                errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
              retryAfter = errorBody?.retryAfter || null;
            }
          } catch {
            /* Clone parse failed */
          }
        } catch {
          /* Clone failed */
        }

        if (result.status === 499) {
          log.info(
            "COMBO-RR",
            `Client disconnected (499) during ${modelStr} — stopping combo loop`
          );
          recordComboRequest(combo.name, modelStr, {
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackCount,
            strategy: "round-robin",
            target: toRecordedTarget(target),
          });
          recordedAttempts++;
          return result;
        }

        if (
          retryAfter &&
          (!earliestRetryAfter || new Date(retryAfter) < new Date(earliestRetryAfter))
        ) {
          earliestRetryAfter = retryAfter;
        }

        if (typeof errorText !== "string") {
          try {
            errorText = JSON.stringify(errorText);
          } catch {
            errorText = String(errorText);
          }
        }

        const isStreamReadinessTimeout =
          result.status === 504 && isStreamReadinessTimeoutErrorBody(errorBody);

        // Round-robin uses the same target-level fallback rule as other combo
        // strategies: non-ok target responses fall through to the next target.
        // Classification stays here only to support cooldown/semaphore pacing,
        // not to decide whether fallback is allowed.
        const { cooldownMs } = checkFallbackError(
          result.status,
          errorText,
          0,
          null,
          provider,
          result.headers,
          profile
        );

        const isAllAccountsRateLimited = isAllAccountsRateLimitedResponse(
          result.status,
          result.headers?.get("content-type") ?? null,
          errorText
        );

<<<<<<< Updated upstream
        // #1731: If the entire provider quota is exhausted, mark it so subsequent
        // same-provider targets are skipped immediately. API-key 429s still use
        // the short resilience cooldown, but explicit quota text should stop the
        // combo from trying another target for the same provider in this request.
        // #1731 / #1731v2: classify the upstream error and update the exhaustion sets
        // (shared with handleComboChat). Returns whether the provider is fully exhausted.
        const providerExhausted = applyComboTargetExhaustion(targetWithConnection, {
          result,
          fallbackResult,
          errorText,
          rawModel: parseModel(modelStr).model || modelStr,
          isTokenLimitBreach,
          allAccountsRateLimited: isAllAccountsRateLimited,
          sets: { exhaustedProviders, exhaustedConnections, transientRateLimitedProviders },
          log,
          tag: "COMBO-RR",
          exhaustedLogLevel: "debug",
          structuredError,
        });

=======
>>>>>>> Stashed changes
        // Transient errors → mark in semaphore so round-robin stops stampeding this target.
        if (TRANSIENT_FOR_SEMAPHORE.includes(result.status) && cooldownMs > 0) {
          semaphore.markRateLimited(semaphoreKey, cooldownMs);
          log.warn("COMBO-RR", `${modelStr} error ${result.status}, cooldown ${cooldownMs}ms`);
        }

        if (isAllAccountsRateLimited) {
          log.info(
            "COMBO-RR",
            `All accounts rate-limited for ${modelStr}, falling back to next model`
          );
        }

        // Transient error → retry same model
        const isTransient =
          !isStreamReadinessTimeout && [408, 429, 500, 502, 503, 504].includes(result.status);
        if (retry < maxRetries && isTransient) {
          continue;
        }

        // Done with this model
        recordComboRequest(combo.name, modelStr, {
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackCount,
          strategy: "round-robin",
          target: toRecordedTarget(target),
        });
        recordedAttempts++;
        lastError = errorText || String(result.status);
        if (!lastStatus) lastStatus = result.status;
        if (offset > 0) fallbackCount++;
        log.warn("COMBO-RR", `${modelStr} failed, trying next model`, { status: result.status });

        const fallbackWaitMs =
          retryDelayMs > 0 && cooldownMs > 0 && cooldownMs <= MAX_FALLBACK_WAIT_MS
            ? Math.min(cooldownMs, retryDelayMs)
            : 0;
        if ([502, 503, 504].includes(result.status) && fallbackWaitMs > 0) {
          log.info("COMBO-RR", `Waiting ${fallbackWaitMs}ms before fallback to next model`);
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, fallbackWaitMs);
            signal?.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                resolve(undefined);
              },
              { once: true }
            );
          });
          if (signal?.aborted) {
            log.info("COMBO-RR", `Client disconnected during fallback wait — aborting`);
            return errorResponse(499, "Client disconnected");
          }
        }

        break;
      }
    } finally {
      // ALWAYS release semaphore slot
      release();
    }
  }

  // All models exhausted
  const latencyMs = Date.now() - startTime;
  if (recordedAttempts === 0) {
    recordComboRequest(combo.name, null, {
      success: false,
      latencyMs,
      fallbackCount,
      strategy: "round-robin",
    });
  }

  if (!lastStatus) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Service temporarily unavailable: all upstream accounts are inactive",
          type: "service_unavailable",
          code: "ALL_ACCOUNTS_INACTIVE",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const status = lastStatus;
  const msg = lastError || "All round-robin combo models unavailable";

  if (earliestRetryAfter) {
    const retryHuman = formatRetryAfter(earliestRetryAfter);
    log.warn("COMBO-RR", `All models failed | ${msg} (${retryHuman})`);
    return unavailableResponse(status, msg, earliestRetryAfter, retryHuman);
  }

  log.warn("COMBO-RR", `All models failed | ${msg}`);
  return new Response(JSON.stringify({ error: { message: msg } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
