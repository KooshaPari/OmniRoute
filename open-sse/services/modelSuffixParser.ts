/**
 * OpenRouter-style model suffixes.
 *
 * Parses trailing `:suffix` tokens from a model id:
 *
 *   :nitro      fastest inference        (performance tier)
 *   :floor      cheapest inference       (economy tier)
 *   :free       free-tier models only
 *   :thinking   extended reasoning
 *   :online     web-search plugin
 *   :extended   extended context window
 *
 * Multiple suffixes are supported: `model:thinking:online`.
 *
 * Ported from thegent-routing's model_suffix_parser.py. The parser and the
 * request transformer keep the oracle's behavior. `ParsedModel` is a plain
 * object so it can cross a JSON boundary.
 */

export const MODEL_SUFFIXES = [
  "nitro",
  "floor",
  "free",
  "thinking",
  "online",
  "extended",
] as const;

export type ModelSuffix = (typeof MODEL_SUFFIXES)[number];

const KNOWN_SUFFIXES = new Set<string>(MODEL_SUFFIXES);
const TIER_SUFFIXES = new Set<ModelSuffix>(["nitro", "floor", "free"]);

export interface ParsedModel {
  baseModel: string;
  suffixes: ModelSuffix[];
  raw: string;
  hasSuffix: boolean;
  isThinking: boolean;
  isFreeTier: boolean;
  isPerformanceTier: boolean;
  isEconomyTier: boolean;
  needsWebSearch: boolean;
  needsExtendedContext: boolean;
}

export interface SuffixRoutingHints {
  priority?: "high" | "low";
  providerSort?: "throughput" | "price";
  providerOnlyFree?: boolean;
  reasoningEffort?: "high";
  plugins?: Array<{ id: string; maxResults?: number }>;
  contextLengthExtended?: boolean;
}

export const SUFFIX_ROUTING_HINTS: Record<ModelSuffix, SuffixRoutingHints> = {
  nitro: { priority: "high", providerSort: "throughput" },
  floor: { priority: "low", providerSort: "price" },
  free: { providerOnlyFree: true, providerSort: "price" },
  thinking: { reasoningEffort: "high" },
  online: { plugins: [{ id: "web" }] },
  extended: { contextLengthExtended: true },
};

function buildParsed(baseModel: string, suffixes: ModelSuffix[], raw: string): ParsedModel {
  return {
    baseModel,
    suffixes,
    raw,
    hasSuffix: suffixes.length > 0,
    isThinking: suffixes.includes("thinking"),
    isFreeTier: suffixes.includes("free"),
    isPerformanceTier: suffixes.includes("nitro"),
    isEconomyTier: suffixes.includes("floor"),
    needsWebSearch: suffixes.includes("online"),
    needsExtendedContext: suffixes.includes("extended"),
  };
}

/**
 * Parse a single trailing suffix. Unknown suffixes leave the model unchanged.
 */
export function parseModelSuffix(model: string): {
  baseModel: string;
  suffix: ModelSuffix | null;
} {
  const colon = model.lastIndexOf(":");
  if (colon < 0) return { baseModel: model, suffix: null };
  const candidate = model.slice(colon + 1);
  if (!KNOWN_SUFFIXES.has(candidate)) return { baseModel: model, suffix: null };
  return { baseModel: model.slice(0, colon), suffix: candidate as ModelSuffix };
}

/**
 * Parse every known suffix. Unknown tokens are ignored, matching the oracle.
 */
export function parseModelSuffixes(model: string): ParsedModel {
  const parts = model.split(":");
  const baseModel = parts[0] ?? "";
  const suffixes: ModelSuffix[] = [];
  for (const part of parts.slice(1)) {
    if (KNOWN_SUFFIXES.has(part)) suffixes.push(part as ModelSuffix);
  }
  return buildParsed(baseModel, suffixes, model);
}

/** Strip every known suffix and return only the base model. */
export function stripModelSuffixes(model: string): string {
  return parseModelSuffixes(model).baseModel;
}

/** Return a fresh hints object for one suffix, or an empty object. */
export function getRoutingHints(suffix: ModelSuffix | null): SuffixRoutingHints {
  if (suffix === null) return {};
  const hints = SUFFIX_ROUTING_HINTS[suffix];
  return {
    ...hints,
    ...(hints.plugins ? { plugins: hints.plugins.map((plugin) => ({ ...plugin })) } : {}),
  };
}

export function resolveModelAndHints(model: string): {
  baseModel: string;
  hints: SuffixRoutingHints;
} {
  const { baseModel, suffix } = parseModelSuffix(model);
  return { baseModel, hints: getRoutingHints(suffix) };
}

export interface ResolvedModelSuffixRequest {
  model: string;
  body: Record<string, unknown>;
  parsed: ParsedModel;
  autoMode?: "fast" | "cheap";
  autoFree: boolean;
}

/**
 * Normalize a request that may carry model suffixes.
 *
 * This is the safe chat-path helper: it strips every known suffix, updates
 * `body.model`, and applies `thinking`. It intentionally does not inject
 * `tg_tier` or provider plugins. Tier, online, and extended hints stay in the
 * returned `parsed` value for callers that can honor them.
 */
export function resolveModelSuffixRequest(
  model: string,
  body: Record<string, unknown>
): ResolvedModelSuffixRequest {
  const parsed = parseModelSuffixes(model);
  if (!parsed.hasSuffix) {
    return { model, body, parsed, autoMode: undefined, autoFree: false };
  }

  const autoFree = parsed.isFreeTier && parsed.baseModel === "auto";
  const nextModel = autoFree ? "auto/best-free" : parsed.baseModel;
  const autoMode = parsed.isPerformanceTier
    ? "fast"
    : parsed.isEconomyTier
      ? "cheap"
      : undefined;

  const nextBody: Record<string, unknown> = { ...body, model: nextModel };
  if (
    parsed.isThinking &&
    nextBody.reasoning === undefined &&
    nextBody.reasoning_effort === undefined
  ) {
    nextBody.reasoning = { effort: "high" };
  }
  return { model: nextModel, body: nextBody, parsed, autoMode, autoFree };
}

/**
 * Resolve a tier suffix through an optional `base:suffix` -> concrete model map.
 * Non-tier suffixes and missing entries fall back to the base model.
 */
export function resolveSuffixModel(
  parsed: ParsedModel,
  modelMap?: Record<string, string> | null
): string {
  if (modelMap) {
    for (const suffix of parsed.suffixes) {
      if (!TIER_SUFFIXES.has(suffix)) continue;
      const key = `${parsed.baseModel}:${suffix}`;
      if (Object.prototype.hasOwnProperty.call(modelMap, key)) return modelMap[key];
    }
  }
  return parsed.baseModel;
}

function cloneBody<T>(body: T): T {
  if (typeof structuredClone === "function") return structuredClone(body);
  return JSON.parse(JSON.stringify(body)) as T;
}

/**
 * Apply suffix-driven request fields to a copy of the body.
 *
 * - `thinking` adds `reasoning: { effort: "high" }` only when no reasoning
 *   configuration is already present.
 * - `online` merges `{ id: "web", max_results: 5 }` into `plugins`.
 * - tier suffixes set `tg_tier` to `performance`, `economy`, or `free`.
 *
 * `tg_tier` is a routing marker. A caller that forwards the body to a provider
 * should consume and remove it rather than passing it through.
 */
export function applySuffixToRequest(
  body: Record<string, unknown>,
  parsed: ParsedModel
): Record<string, unknown> {
  const result = cloneBody(body);

  if (parsed.isThinking && result.reasoning === undefined) {
    result.reasoning = { effort: "high" };
  }

  if (parsed.needsWebSearch) {
    const existing = Array.isArray(result.plugins)
      ? (result.plugins as Array<Record<string, unknown>>)
      : [];
    const hasWeb = existing.some((plugin) => plugin?.id === "web");
    if (!hasWeb) {
      result.plugins = [...existing, { id: "web", max_results: 5 }];
    }
  }

  if (parsed.isPerformanceTier) result.tg_tier = "performance";
  else if (parsed.isEconomyTier) result.tg_tier = "economy";
  else if (parsed.isFreeTier) result.tg_tier = "free";

  return result;
}
