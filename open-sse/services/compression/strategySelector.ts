<<<<<<< Updated upstream
import type {
  CompressionConfig,
  CompressionMode,
  CompressionPipelineStep,
  CompressionResult,
} from "./types.ts";
import { applyHardBudget } from "./hardBudget.ts";
import { type FidelityGateConfig } from "./fidelityGate.ts";
import { gateAdvance } from "./fidelityGateStep.ts";
import type { CompressionEngineApplyOptions } from "./engines/types.ts";
=======
import type { CompressionConfig, CompressionMode, CompressionResult } from "./types.ts";
>>>>>>> Stashed changes
import { applyLiteCompression } from "./lite.ts";
import { cavemanCompress } from "./caveman.ts";
import { compressAggressive } from "./aggressive.ts";
import { ultraCompress } from "./ultra.ts";
import { createCompressionStats } from "./stats.ts";
<<<<<<< Updated upstream
import { guardPipelineInflation } from "./pipelineGuards.ts";
import {
  resolvePipelineBreakerConfig,
  canRunEngine,
  recordEngineFailure,
  recordEngineSuccess,
  type PipelineCircuitBreakerConfig,
} from "./pipelineEngineBreaker.ts";
import {
  type BailoutConfig,
  type StackAccumulator,
  createStackAccumulator,
  decideStep,
  mergeStackStep,
} from "./stackedStepCore.ts";
import { registerBuiltinCompressionEngines } from "./engines/index.ts";
import { getCompressionEngine, getEngineEntry } from "./engines/registry.ts";
import { applyRtkCompression } from "./engines/rtk/index.ts";
import { adaptBodyForCompression } from "./bodyAdapter.ts";
=======
>>>>>>> Stashed changes
import {
  detectCachingContext,
  getCacheAwareStrategy,
  type CachingDetectionContext,
} from "./cachingAware.ts";
<<<<<<< Updated upstream
import { resolveCompressionPlan } from "./resolveCompressionPlan.ts";
import { deriveDefaultPlan, type DerivedPlan } from "./deriveDefaultPlan.ts";
import {
  withSource,
  planFromHeader,
  formatCompressionMeta,
  formatCompressionAnnotation,
  deriveDefaultPlanFromConfig,
  buildNamedComboLookup,
} from "./planResolution.ts";
import { resolveAdaptivePlan } from "./adaptiveCompression/resolveAdaptivePlan.ts";
import type { AdaptiveTelemetry } from "./adaptiveCompression/types.ts";
import type { RiskGateConfig } from "./riskGate/riskGate.ts";
import { resolveRiskGate, withRiskGate, withRiskGateAsync } from "./riskGate/strategyWrap.ts";
import {
  withCompressionEntrypointGuards,
  withCompressionEntrypointGuardsAsync,
} from "./entrypointWrap.ts";
import { makeMemoKey, memoLookup, memoStore, isDeterministicMode } from "./resultMemo.ts";
export { resolveCacheAwareConfig } from "./cacheAwareConfig.ts";

// Re-export so existing importers (resolver test + chatCore dynamic import) keep resolving.
export {
  planFromHeader,
  formatCompressionMeta,
  formatCompressionAnnotation,
  buildNamedComboLookup,
};

/** Named-combo map: combo id → its stacked pipeline (operator-defined profiles). */
type NamedCombos = Record<string, CompressionPipelineStep[]>;
=======
>>>>>>> Stashed changes

export function checkComboOverride(
  config: CompressionConfig,
  comboId: string | null
): CompressionMode | null {
  if (!comboId || !config.comboOverrides) return null;
  return config.comboOverrides[comboId] ?? null;
}

export function shouldAutoTrigger(config: CompressionConfig, estimatedTokens: number): boolean {
  return config.autoTriggerTokens > 0 && estimatedTokens >= config.autoTriggerTokens;
}

export function getEffectiveMode(
  config: CompressionConfig,
  comboId: string | null,
  estimatedTokens: number
): CompressionMode {
  if (!config.enabled) return "off";

  const comboMode = checkComboOverride(config, comboId);
  if (comboMode) return comboMode;

  if (shouldAutoTrigger(config, estimatedTokens)) return "lite";

  return config.defaultMode;
}

export function selectCompressionStrategy(
  config: CompressionConfig,
  comboId: string | null,
  estimatedTokens: number,
  body?: Record<string, unknown>,
<<<<<<< Updated upstream
  context?: CachingDetectionContext,
  combos: NamedCombos = {},
  header: string | null = null
): CompressionMode {
  return selectCompressionPlan(config, comboId, estimatedTokens, body, context, combos, header)
    .mode as CompressionMode;
=======
  context?: CachingDetectionContext
): CompressionMode {
  const selectedMode = getEffectiveMode(config, comboId, estimatedTokens);

  // Apply caching-aware adjustments if body is provided
  if (body) {
    const ctx = detectCachingContext(body, context);
    const cacheAware = getCacheAwareStrategy(selectedMode, ctx);
    return cacheAware.strategy as CompressionMode;
  }

  return selectedMode;
>>>>>>> Stashed changes
}

export function applyCompression(
  body: Record<string, unknown>,
  mode: CompressionMode,
<<<<<<< Updated upstream
  options?: {
    model?: string;
    supportsVision?: boolean | null;
    config?: CompressionConfig;
    principalId?: string;
    /**
     * Opt into the TV1 stacked bail-out (skip-on-throw + min-gain). Default off keeps the
     * legacy behavior. The combo proactive-fallback path enables it so a throwing engine is
     * skipped instead of silently dropping the target. Flows through to applyStackedCompression.
     */
    bailout?: BailoutConfig;
    /** Risk-gate mask/restore wrapper (opt-in, default off). Read via resolveRiskGate. */
    riskGate?: RiskGateConfig;
    /** Force/override the caching gate (studio dry-run, or chatCore's resolved context). */
    cachingContext?: CachingDetectionContext;
  }
): CompressionResult {
  return withCompressionEntrypointGuards(body, options, (b) => runCompression(b, mode, options));
}

function runCompression(
  body: Record<string, unknown>,
  mode: CompressionMode,
  options?: {
    model?: string;
    supportsVision?: boolean | null;
    config?: CompressionConfig;
    principalId?: string;
    bailout?: BailoutConfig;
    riskGate?: RiskGateConfig;
    cachingContext?: CachingDetectionContext;
  }
=======
  options?: { model?: string; supportsVision?: boolean | null; config?: CompressionConfig }
>>>>>>> Stashed changes
): CompressionResult {
  if (mode === "off") {
    return { body, compressed: false, stats: null };
  }
<<<<<<< Updated upstream
  if (
    options?.config?.memoizeCompressionResults === true &&
    // Only memoize for an explicit principal — a missing principalId would collapse
    // authenticated callers into the shared anonymous (null) key space and let one
    // principal receive another's cached body. No principal ⇒ skip the cache.
    typeof options?.principalId === "string" &&
    options.principalId.length > 0 &&
    isDeterministicMode(mode, options.config)
  ) {
    const key = makeMemoKey(
      body,
      mode,
      options.config,
      options.principalId,
      options.model,
      options.supportsVision
    );
    const hit = memoLookup(key);
    if (hit) return hit;
    const result = runCompression({ ...body }, mode, {
      ...options,
      config: { ...options.config, memoizeCompressionResults: false },
    });
    memoStore(key, result);
    return memoLookup(key)!;
  }
  if (mode === "rtk") {
    return applyRtkCompression(body, {
      // Selecting the "rtk" mode IS the enable signal — run it even if the per-engine
      // rtkConfig.enabled flag is off (that flag gates stacked steps). (B-MODE-ENGINE-DECOUPLE)
      config: { ...(options?.config?.rtkConfig ?? {}), enabled: true },
    });
  }
  const adapter = adaptBodyForCompression(body);
  const compressionBody = adapter.body;
=======
>>>>>>> Stashed changes
  if (mode === "lite") {
    return applyLiteCompression(body, options);
  }
  if (mode === "standard") {
    return cavemanCompress(
      body as Parameters<typeof cavemanCompress>[0],
      options?.config?.cavemanConfig
    );
  }
  if (mode === "aggressive") {
    const messages = (body.messages ?? []) as Array<{
      role: string;
      content?: string | Array<{ type: string; text?: string }>;
      [key: string]: unknown;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { body, compressed: false, stats: null };
    }
    const aggressiveConfig = options?.config?.aggressive;
    const result = compressAggressive(messages, aggressiveConfig);
    const compressedBody = { ...body, messages: result.messages };
    return {
      body: compressedBody,
      compressed: result.stats.savingsPercent > 0,
      stats: createCompressionStats(
        body,
        compressedBody,
        mode,
        ["aggressive"],
        result.stats.rulesApplied,
        result.stats.durationMs
      ),
    };
  }
  if (mode === "ultra") {
    const messages = (body.messages ?? []) as Array<{
      role: string;
      content?: string | unknown[];
      [key: string]: unknown;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { body, compressed: false, stats: null };
    }
    const ultraConfig = options?.config?.ultra;
    const result = ultraCompress(messages, ultraConfig ?? {});
    const compressedBody = { ...body, messages: result.messages };
    return {
      body: compressedBody,
      compressed: result.stats.savingsPercent > 0,
      stats: createCompressionStats(
        body,
        compressedBody,
        mode,
        ["ultra"],
        result.stats.rulesApplied,
        result.stats.durationMs
      ),
    };
  }
  return { body, compressed: false, stats: null };
}
<<<<<<< Updated upstream

/**
 * Async entry point mirroring {@link applyCompression}. Only the stacked mode
 * can host async engines, so it routes through {@link applyStackedCompressionAsync};
 * every other mode delegates to the synchronous path unchanged. Call sites that
 * already run in an async context (e.g. chatCore) await this so a future
 * worker-thread engine can await without changing the surrounding code.
 */
export async function applyCompressionAsync(
  body: Record<string, unknown>,
  mode: CompressionMode,
  options?: {
    model?: string;
    supportsVision?: boolean | null;
    config?: CompressionConfig;
    principalId?: string;
    onEngineStep?: (step: StackedCompressionStep) => void;
    cachingContext?: CachingDetectionContext;
  }
): Promise<CompressionResult> {
  return withCompressionEntrypointGuardsAsync(body, options, (b) =>
    runCompressionAsync(b, mode, options)
  );
}

async function runCompressionAsync(
  body: Record<string, unknown>,
  mode: CompressionMode,
  options?: {
    model?: string;
    supportsVision?: boolean | null;
    config?: CompressionConfig;
    principalId?: string;
    onEngineStep?: (step: StackedCompressionStep) => void;
    cachingContext?: CachingDetectionContext;
  }
): Promise<CompressionResult> {
  if (
    options?.config?.memoizeCompressionResults === true &&
    // Only memoize for an explicit principal — a missing principalId would collapse
    // authenticated callers into the shared anonymous (null) key space and let one
    // principal receive another's cached body. No principal ⇒ skip the cache.
    typeof options?.principalId === "string" &&
    options.principalId.length > 0 &&
    isDeterministicMode(mode, options.config)
  ) {
    const key = makeMemoKey(
      body,
      mode,
      options.config,
      options.principalId,
      options.model,
      options.supportsVision
    );
    const hit = memoLookup(key);
    if (hit) return hit;
    const result = await runCompressionAsync({ ...body }, mode, {
      ...options,
      config: { ...options.config, memoizeCompressionResults: false },
    });
    memoStore(key, result);
    return memoLookup(key)!;
  }
  if (mode === "stacked") {
    const adapter = adaptBodyForCompression(body);
    const result = await applyStackedCompressionAsync(
      adapter.body,
      options?.config?.stackedPipeline,
      options
    );
    return adapter.adapted ? { ...result, body: adapter.restore(result.body) } : result;
  }
  // Ultra's optional SLM (model) tier is async — route it here when a model is configured.
  if (mode === "ultra") {
    return applyUltraAsync(body, options);
  }
  return applyCompression(body, mode, options);
}

/**
 * Ultra mode with the optional local SLM (model) tier.
 *
 * When `config.ultra.modelPath` is set, the prose is routed through the llmlingua engine
 * (the real local-model compressor). The llmlingua backend fail-opens when the model is
 * absent (e.g. the ONNX model is not provisioned), so this degrades gracefully:
 *  - model present and it compresses  → return the SLM result (tagged "ultra-slm");
 *  - model absent / no gain / failure → fall back to `aggressive` when
 *    `slmFallbackToAggressive` is set, otherwise the heuristic ultra (`pruneByScore`).
 *
 * Without `modelPath` the behavior is byte-identical to the synchronous heuristic ultra.
 */
async function applyUltraAsync(
  body: Record<string, unknown>,
  options?: {
    model?: string;
    supportsVision?: boolean | null;
    config?: CompressionConfig;
    principalId?: string;
    onEngineStep?: (step: StackedCompressionStep) => void;
  }
): Promise<CompressionResult> {
  const ultraConfig = options?.config?.ultra;
  const modelPath = typeof ultraConfig?.modelPath === "string" ? ultraConfig.modelPath.trim() : "";

  // No explicit modelPath → run the two-tier ultra resolver (heuristic, or SLM when
  // config.ultraEngine === "slm" and the worker backend is available). This is the
  // Phase-4 (B) path; it fail-opens to the heuristic and records the resolved tier.
  if (!modelPath) {
    const adapter = adaptBodyForCompression(body);
    const messages = (adapter.body.messages ?? []) as Array<{
      role: string;
      content?: string | unknown[];
      [key: string]: unknown;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { body, compressed: false, stats: null };
    }
    const ultraConfig = {
      ...(options?.config?.ultra ?? {}),
      preserveSystemPrompt: options?.config?.preserveSystemPrompt !== false,
      ultraEngine: options?.config?.ultraEngine,
    };
    const result = await ultraCompress(messages, ultraConfig);
    const compressedBody = { ...adapter.body, messages: result.messages };
    return {
      body: adapter.restore(compressedBody),
      compressed: result.stats.savingsPercent > 0,
      stats: {
        ...createCompressionStats(
          adapter.body,
          compressedBody,
          "ultra",
          result.stats.techniquesUsed,
          result.stats.rulesApplied,
          result.stats.durationMs
        ),
        ultraTier: result.stats.ultraTier,
      },
    };
  }

  registerBuiltinCompressionEngines();
  const slmEngine = getCompressionEngine("llmlingua");
  if (slmEngine?.applyAsync) {
    const engineOptions: CompressionEngineApplyOptions = {
      model: options?.model,
      supportsVision: options?.supportsVision,
      config: options?.config,
      principalId: options?.principalId,
      stepConfig: {
        modelPath,
        ...(typeof ultraConfig?.compressionRate === "number"
          ? { compressionRate: ultraConfig.compressionRate }
          : {}),
      },
    };
    try {
      const slm = await slmEngine.applyAsync(body, engineOptions);
      if (slm.compressed && slm.stats) {
        // Attribute the result to ultra (the selected mode) while marking the SLM tier.
        return {
          ...slm,
          stats: {
            ...slm.stats,
            mode: "ultra",
            techniquesUsed: Array.from(new Set([...(slm.stats.techniquesUsed ?? []), "ultra-slm"])),
          },
        };
      }
    } catch {
      // llmlingua fail-opens internally, but guard anyway and use the configured fallback.
    }
  }

  // SLM tier unavailable or produced no gain → fall back per slmFallbackToAggressive.
  return applyCompression(
    body,
    ultraConfig?.slmFallbackToAggressive ? "aggressive" : "ultra",
    options
  );
}

function normalizePipelineStep(step: CompressionPipelineStep | string): CompressionPipelineStep {
  if (typeof step !== "string") return step;
  if (step === "standard") return { engine: "caveman" };
  if (step === "rtk") return { engine: "rtk" };
  if (step === "lite" || step === "aggressive" || step === "ultra") return { engine: step };
  return { engine: "caveman" };
}

/** Per-engine progress emitted mid-pipeline by the stacked loops (F3.3 live streaming). */
export interface StackedCompressionStep {
  stepIndex: number;
  totalSteps: number;
  engine: string;
  state: "done" | "skipped";
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  durationMs?: number;
}

interface StackOptions {
  model?: string;
  supportsVision?: boolean | null;
  config?: CompressionConfig;
  compressionComboId?: string | null;
  /** TV1 bail-out discipline (opt-in, default disabled). */
  bailout?: BailoutConfig;
  /** T02 per-engine circuit-breaker (opt-in, default disabled). Falls back to config + env. */
  circuitBreaker?: Partial<PipelineCircuitBreakerConfig>;
  /** Opt-in per-step fidelity gate (default disabled). */
  fidelityGate?: FidelityGateConfig;
  /** Risk-gate mask/restore wrapper (opt-in, default off). Read via resolveRiskGate. */
  riskGate?: RiskGateConfig;
  /** Authenticated principal id — threaded through to CCR engine for store scoping. */
  principalId?: string;
  /** F3.3: called once per engine as it completes (live per-engine streaming). */
  onEngineStep?: (step: StackedCompressionStep) => void;
}

/** Emit a per-engine step to the live streaming callback (best-effort, no-op when unset). */
function reportEngineStep(
  onStep: ((step: StackedCompressionStep) => void) | undefined,
  stepIndex: number,
  totalSteps: number,
  engine: string,
  result: CompressionResult
): void {
  if (!onStep) return;
  const s = result.stats;
  onStep({
    stepIndex,
    totalSteps,
    engine,
    state: result.compressed ? "done" : "skipped",
    originalTokens: s?.originalTokens ?? 0,
    compressedTokens: s?.compressedTokens ?? s?.originalTokens ?? 0,
    savingsPercent: s?.savingsPercent ?? 0,
    ...(s?.durationMs !== undefined ? { durationMs: s.durationMs } : {}),
  });
}

function resolveStackSteps(
  pipeline?: Array<CompressionPipelineStep | string>
): CompressionPipelineStep[] {
  return pipeline && pipeline.length > 0
    ? pipeline.map(normalizePipelineStep)
    : [
        { engine: "rtk", intensity: "standard" },
        { engine: "caveman", intensity: "full" },
      ];
}

function buildStepOptions(
  step: CompressionPipelineStep,
  options?: StackOptions
): CompressionEngineApplyOptions {
  return {
    ...options,
    compressionComboId: options?.compressionComboId ?? options?.config?.compressionComboId,
    principalId: options?.principalId,
    stepConfig: {
      ...(step.config ?? {}),
      ...(step.intensity ? { intensity: step.intensity } : {}),
    },
  };
}

function finalizeStackedResult(
  originalBody: Record<string, unknown>,
  currentBody: Record<string, unknown>,
  compressed: boolean,
  acc: StackAccumulator,
  start: number,
  compressionComboId: string | null | undefined
): CompressionResult {
  const stats = createCompressionStats(
    originalBody,
    currentBody,
    "stacked",
    Array.from(acc.techniques),
    acc.rules.size > 0 ? Array.from(acc.rules) : undefined,
    Math.round((performance.now() - start) * 100) / 100
  );
  stats.engine = "stacked";
  stats.compressionComboId = compressionComboId ?? null;
  stats.engineBreakdown = acc.breakdown;
  if (acc.validationWarnings.size > 0) {
    stats.validationWarnings = Array.from(acc.validationWarnings);
  }
  if (acc.validationErrors.size > 0) {
    stats.validationErrors = Array.from(acc.validationErrors);
  }
  if (acc.fallbackApplied) {
    stats.fallbackApplied = true;
  }
  if (acc.rtkRawOutputPointers.length > 0) {
    const seenPointers = new Set<string>();
    stats.rtkRawOutputPointers = acc.rtkRawOutputPointers.filter((pointer) => {
      if (seenPointers.has(pointer.id)) return false;
      seenPointers.add(pointer.id);
      return true;
    });
  }

  // T02 / H1: honest aggregate inflation guard. If the fully-stacked body did not actually shrink
  // (its token count is >= the original), discard it and return the verbatim original — safe by
  // construction, since the original request body is always a valid payload.
  const inflation = guardPipelineInflation({
    originalBody,
    compressedBody: currentBody,
    originalTokens: stats.originalTokens,
    compressedTokens: stats.compressedTokens,
  });
  if (inflation.inflated) {
    const inflatedTokens = stats.compressedTokens;
    const warnings = new Set(stats.validationWarnings ?? []);
    warnings.add(
      `pipeline-inflation-guard: stacked output (${inflatedTokens} tok) did not shrink input ` +
        `(${stats.originalTokens} tok); reverted to original`
    );
    stats.validationWarnings = Array.from(warnings);
    stats.fallbackApplied = true;
    stats.compressedTokens = stats.originalTokens;
    stats.savingsPercent = 0;
    return { body: inflation.body, compressed: false, stats };
  }

  return { body: currentBody, compressed, stats };
}

// ── Shared per-step helpers (used by the sync + async stacked loops; keep them in lockstep) ──

interface StepCommitCtx {
  bailout?: BailoutConfig;
  breakerOn: boolean;
  breaker: PipelineCircuitBreakerConfig;
  fidelityGate?: FidelityGateConfig;
}

/** Failure path: record the breaker failure (when on) + keep the verbatim body, surfacing it in telemetry. */
function recordStepFailure(
  acc: StackAccumulator,
  engineId: string,
  err: unknown,
  ctx: StepCommitCtx
): void {
  if (ctx.breakerOn) recordEngineFailure(engineId, ctx.breaker);
  acc.validationErrors.add(
    `${engineId}: bailed out — ${err instanceof Error ? err.message : String(err)}`
  );
  acc.fallbackApplied = true;
}

/**
 * Success path: record the breaker success (when on), merge telemetry, and decide whether to
 * advance `currentBody`. Advance rule: TV1 bail-out uses min-gain (`decideStep`); otherwise the
 * legacy `result.compressed`. Returns the (possibly unchanged) body + whether it advanced.
 */
function commitStepResult(
  acc: StackAccumulator,
  step: CompressionPipelineStep,
  result: CompressionResult,
  currentBody: Record<string, unknown>,
  ctx: StepCommitCtx
): { body: Record<string, unknown>; advanced: boolean } {
  if (ctx.breakerOn) recordEngineSuccess(step.engine, ctx.breaker);
  mergeStackStep(acc, step.engine, result);
  const advance = ctx.bailout?.enabled
    ? decideStep(result, ctx.bailout).advance
    : result.compressed;
  if (advance && gateAdvance(result, currentBody, ctx.fidelityGate, acc, step.engine)) {
    return { body: result.body, advanced: true };
  }
  return { body: currentBody, advanced: false };
}

export function applyStackedCompression(
  body: Record<string, unknown>,
  pipeline?: Array<CompressionPipelineStep | string>,
  options?: StackOptions
): CompressionResult {
  return withRiskGate(body, resolveRiskGate(options), (b) =>
    runStackedCompression(b, pipeline, options)
  );
}

function runStackedCompression(
  body: Record<string, unknown>,
  pipeline?: Array<CompressionPipelineStep | string>,
  options?: StackOptions
): CompressionResult {
  const steps = resolveStackSteps(pipeline);
  registerBuiltinCompressionEngines();

  let currentBody = body;
  let compressed = false;
  const acc = createStackAccumulator();
  const start = performance.now();

  const bailout = options?.bailout;
  const breaker = resolvePipelineBreakerConfig(
    options?.circuitBreaker ?? options?.config?.pipelineCircuitBreaker
  );
  const breakerOn = breaker.enabled;
  const fidelityGate = options?.fidelityGate ?? options?.config?.fidelityGate;
  const onStep = options?.onEngineStep;
  const totalSteps = steps.length;
  let stepIdx = 0;

  for (const step of steps) {
    const engine = getCompressionEngine(step.engine);
    if (!engine) continue;
    // Respect the registry enabled flag: a step naming a disabled engine is skipped, so an
    // operator can turn an engine off (setEngineEnabled) without editing every pipeline.
    if (getEngineEntry(step.engine)?.enabled === false) continue;
    // T02: when the per-engine breaker is OPEN, skip this step (verbatim body kept — fail-open).
    if (breakerOn && !canRunEngine(step.engine, breaker)) {
      acc.validationWarnings.add(`${step.engine}: skipped (pipeline circuit-breaker open)`);
      continue;
    }

    // TV1 bail-out (per-request) OR T02 breaker (cross-request) wrap the call so a throwing engine
    // is caught + recorded; when neither is on, a throw propagates (byte-identical to legacy).
    const ctx = { bailout, breakerOn, breaker, fidelityGate };
    let result: CompressionResult;
    if (bailout?.enabled || breakerOn) {
      try {
        result = engine.apply(currentBody, buildStepOptions(step, options));
      } catch (err) {
        recordStepFailure(acc, step.engine, err, ctx);
        continue;
      }
    } else {
      result = engine.apply(currentBody, buildStepOptions(step, options));
    }
    const committed = commitStepResult(acc, step, result, currentBody, ctx);
    currentBody = committed.body;
    if (committed.advanced) compressed = true;
    // The pre-existing bail-out path did not stream per-step; everything else does.
    if (!bailout?.enabled) reportEngineStep(onStep, stepIdx++, totalSteps, step.engine, result);
  }

  // Hard-budget post-pass (#17): runs after all engines, before finalize.
  if (options?.config?.targetTokens != null || options?.config?.targetRatio != null) {
    const hbResult = applyHardBudget(currentBody, {
      targetTokens: options.config.targetTokens,
      targetRatio: options.config.targetRatio,
    });
    if (hbResult.compressed) {
      mergeStackStep(acc, "hard-budget", hbResult);
      currentBody = hbResult.body;
      compressed = true;
    } else {
      // No unit could be dropped (e.g. every unit is preserve-guarded): surface the
      // unreachable-budget validationWarnings instead of dropping them silently (#17 fix #3).
      // mergeStackStep is gated on `compressed`, so propagate the warnings here directly.
      hbResult.stats?.validationWarnings?.forEach((w) => acc.validationWarnings.add(w));
    }
  }

  return finalizeStackedResult(
    body,
    currentBody,
    compressed,
    acc,
    start,
    options?.compressionComboId ?? options?.config?.compressionComboId
  );
}

/**
 * Async sibling of {@link applyStackedCompression} (H10). Awaits engines that
 * expose `applyAsync` (e.g. worker-thread models) and runs synchronous engines
 * inline. Behaviour is otherwise identical: same step order, same accumulated
 * telemetry, same final stats — so sync-only pipelines yield the same result.
 */
export async function applyStackedCompressionAsync(
  body: Record<string, unknown>,
  pipeline?: Array<CompressionPipelineStep | string>,
  options?: StackOptions
): Promise<CompressionResult> {
  return withRiskGateAsync(body, resolveRiskGate(options), (b) =>
    runStackedCompressionAsync(b, pipeline, options)
  );
}

async function runStackedCompressionAsync(
  body: Record<string, unknown>,
  pipeline?: Array<CompressionPipelineStep | string>,
  options?: StackOptions
): Promise<CompressionResult> {
  const steps = resolveStackSteps(pipeline);
  registerBuiltinCompressionEngines();

  let currentBody = body;
  let compressed = false;
  const acc = createStackAccumulator();
  const start = performance.now();

  const bailout = options?.bailout;
  const breaker = resolvePipelineBreakerConfig(
    options?.circuitBreaker ?? options?.config?.pipelineCircuitBreaker
  );
  const breakerOn = breaker.enabled;
  const fidelityGate = options?.fidelityGate ?? options?.config?.fidelityGate;
  const onStep = options?.onEngineStep;
  const totalSteps = steps.length;
  let stepIdx = 0;

  for (const step of steps) {
    const engine = getCompressionEngine(step.engine);
    if (!engine) continue;
    // Respect the registry enabled flag (same as the sync loop) — keep both in lockstep.
    if (getEngineEntry(step.engine)?.enabled === false) continue;
    // T02: skip an engine whose breaker is OPEN (verbatim body kept — fail-open). Lockstep w/ sync.
    if (breakerOn && !canRunEngine(step.engine, breaker)) {
      acc.validationWarnings.add(`${step.engine}: skipped (pipeline circuit-breaker open)`);
      continue;
    }
    const stepOptions = buildStepOptions(step, options);

    // TV1 bail-out (per-request) OR T02 breaker (cross-request) wrap the call (lockstep w/ sync).
    const ctx = { bailout, breakerOn, breaker, fidelityGate };
    let result: CompressionResult;
    if (bailout?.enabled || breakerOn) {
      try {
        result = engine.applyAsync
          ? await engine.applyAsync(currentBody, stepOptions)
          : engine.apply(currentBody, stepOptions);
      } catch (err) {
        recordStepFailure(acc, step.engine, err, ctx);
        continue;
      }
    } else {
      result = engine.applyAsync
        ? await engine.applyAsync(currentBody, stepOptions)
        : engine.apply(currentBody, stepOptions);
    }
    const committed = commitStepResult(acc, step, result, currentBody, ctx);
    currentBody = committed.body;
    if (committed.advanced) compressed = true;
    if (!bailout?.enabled) reportEngineStep(onStep, stepIdx++, totalSteps, step.engine, result);
  }

  // Hard-budget post-pass (#17): runs after all engines, before finalize.
  if (options?.config?.targetTokens != null || options?.config?.targetRatio != null) {
    const hbResult = applyHardBudget(currentBody, {
      targetTokens: options.config.targetTokens,
      targetRatio: options.config.targetRatio,
    });
    if (hbResult.compressed) {
      mergeStackStep(acc, "hard-budget", hbResult);
      currentBody = hbResult.body;
      compressed = true;
    } else {
      // No unit could be dropped (e.g. every unit is preserve-guarded): surface the
      // unreachable-budget validationWarnings instead of dropping them silently (#17 fix #3).
      // mergeStackStep is gated on `compressed`, so propagate the warnings here directly.
      hbResult.stats?.validationWarnings?.forEach((w) => acc.validationWarnings.add(w));
    }
  }

  return finalizeStackedResult(
    body,
    currentBody,
    compressed,
    acc,
    start,
    options?.compressionComboId ?? options?.config?.compressionComboId
  );
}
=======
>>>>>>> Stashed changes
